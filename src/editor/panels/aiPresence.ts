// editor/panels/aiPresence.ts
// 「AI 가 지금 누구고, 무엇을 하고, 나는 뭘 해야 하나」의 단일 원천.
//
// 지도 위 이름표(aiMapPresence)·지도 아래 상태 줄(aiStatusBar)·도크의 받은함(aiInbox)이 전부 이 모듈 하나만 본다.
// 단독 `/pi` 와 팀은 이미 같은 TeamBoardState 로 합쳐져 있으므로 새 관측을 만들지 않고 그 상태를 사람의 말로만 바꾼다.
// 화면마다 달랐던 「모델 응답 대기 / 작업을 마쳤어요 / 초안 종료 / 적용」을 아래 6가지로 통일한다.

import type { TeamBoardAgent, TeamBoardState } from "@/ai/piAgent/teamBoardState";
import { currentTeamActivity, requestTeamStop, subscribeTeamActivity } from "@/ai/piAgent/teamActivity";
import { REGION_TASK_STATUS_EVENT, regionTaskStatusDetail } from "@/editor/regionTask/regionTaskStatus";
import { mapRunQueue, type MapRunTicket } from "@/editor/aiMapRunQueue";
import { store } from "@/project/store";
import { adoptJobNumber, jobNumber, jobTone } from "@/editor/aiJobNumbers";
import { teamObservation } from "./aiTeamObservation";

export type PresenceState = "waiting" | "working" | "review" | "draft" | "applied" | "failed";

export const PRESENCE_LABEL: Readonly<Record<PresenceState, string>> = {
  waiting: "대기",
  working: "일하는 중",
  review: "내 차례",
  draft: "초안 완료",
  applied: "적용됨",
  failed: "실패",
};

export interface PresenceRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Presence {
  readonly id: string;
  /** chat = 대화창 앞 턴(팀 포함), background = 다른 맵에서 같이 도는 실행(맵별 대기열), region = 지도를 드래그해서 시킨 일. 전부 서로 다른 스레드다. */
  readonly source: "chat" | "background" | "region";
  /** 맵별 대기열 표 번호(background). 취소·확인 이동에 쓴다. */
  readonly ticketId?: number;
  /** region 일은 사용자가 드래그한 정확한 영역. chat 일은 도구가 만진 영역이 있을 때만 지도 위에서 채운다. */
  readonly region?: PresenceRegion;
  readonly name: string;
  /** 검수처럼 지도를 읽기만 하는 역할이면 true — 지도 위 작업 영역을 가져가지 않는다. */
  readonly readsOnly: boolean;
  /** 작업 번호 — 지도 위 이름표·작업 목록 행이 같은 번호를 쓴다(aiJobNumbers). publish 가 채운다. */
  readonly no: number;
  /** 번호에서 나온 색 번호(0~3). 지도 이름표·상태 줄 칩·받은함·작업 목록이 같은 색을 쓴다. */
  readonly tone: number;
  readonly state: PresenceState;
  readonly mapId: string | null;
  readonly mapName: string | null;
  readonly task: string;
  /** 사람 말로 다듬은 지금 하는 일 한 줄. */
  readonly action: string;
  readonly steps: number;
  readonly startedAt: number | undefined;
  /** 내 차례·실패일 때 이유 한 줄(변경 요약 칩, 오류 문장). */
  readonly note?: string;
  /** 지도를 드래그해서 시킨 대화 일이다(handleRegionHandoff 가 표식을 남긴다). region 은 그 드래그 영역. 작업 목록의 「드래그」 종류. */
  readonly drag?: boolean;
  /** 최신이 앞. */
  readonly recent: readonly { readonly label: string; readonly failed: boolean; readonly running: boolean }[];
}

/** 모델·연결 용어를 사람의 말로. 사용자는 「모델 응답」이 무슨 뜻인지 모른다. */
export function plainAction(text: string): string {
  if (/모델 응답을 (기다리는|받는) 중/.test(text)) return "생각 중";
  if (text === "작업 시작을 기다리는 중") return "차례를 기다리는 중";
  return text;
}

function stateOf(agent: TeamBoardAgent, board: TeamBoardState): PresenceState {
  if (agent.state === "대기") return "waiting";
  if (agent.state === "실행 중") return "working";
  if (agent.state === "실패" || agent.state === "중단") return "failed";
  // 여기부터 agent.state === "완료".
  if (board.phase === "검토 대기") return "review";
  if (board.phase === "적용됨" || board.phase === "완료") return "applied";
  if (board.phase === "적용 중") return "working";
  return "draft";
}

function actionOf(state: PresenceState, raw: string, board: TeamBoardState): string {
  if (state === "working" && board.phase === "적용 중") return "변경을 지도에 적용하는 중";
  if (state === "review") return "변경을 검토해 주세요";
  if (state === "draft") return "초안을 마쳤어요 · 아직 적용 전";
  if (state === "applied") return "지도에 적용했어요";
  if (state === "failed") return raw === "작업을 중단했어요" ? raw : "작업을 끝내지 못했어요";
  return plainAction(raw);
}

function noteOf(state: PresenceState, agent: TeamBoardAgent, board: TeamBoardState): string {
  if (state === "review") return board.reviewChips.slice(0, 4).join(" · ");
  // lastLine 은 도구 원문(「✓ place_object — …」)일 수 있어 쓰지 않는다 — 보고문이나 오류 문장만.
  if (state === "failed") return agent.summary || board.error || "";
  return "";
}

interface DragOrigin { readonly text: string; readonly mapId: string; readonly region: PresenceRegion; readonly at: number }
const dragOrigins: DragOrigin[] = [];
const DRAG_ORIGIN_TTL_MS = 30 * 60_000;

/**
 * 지도를 드래그해 시킨 대화 일의 표식 — 드래그 직후 같은 문장으로 시작한 실행을 「드래그」 일로 읽게 한다.
 * 왜(2026-10-16): 드래그 AI 는 대화 턴이라 Presence 에는 영역이 없었다. 지도 위 상자가 드래그한 자리가 아니라 구석 이름표 → 초안 고스트가 생긴 뒤에야 따라붙었다.
 */
export function markDragOrigin(origin: { readonly text: string; readonly mapId: string; readonly region: PresenceRegion }): void {
  const text = origin.text.trim();
  if (!text) return;
  const now = Date.now();
  while (dragOrigins.length > 0 && now - dragOrigins[0]!.at > DRAG_ORIGIN_TTL_MS) dragOrigins.shift();
  dragOrigins.push({ text, mapId: origin.mapId, region: { x: origin.region.x, y: origin.region.y, width: origin.region.width, height: origin.region.height }, at: now });
  if (dragOrigins.length > 20) dragOrigins.shift();
}

function dragOriginFor(board: TeamBoardState): DragOrigin | undefined {
  if (board.mode !== "single" || dragOrigins.length === 0) return undefined;
  const task = board.task.trim();
  if (!task) return undefined;
  for (let i = dragOrigins.length - 1; i >= 0; i -= 1) if (task.includes(dragOrigins[i]!.text)) return dragOrigins[i];
  return undefined;
}

export function derivePresences(board: TeamBoardState | null): readonly Presence[] {
  if (!board || board.phase === "버림") return [];
  if (board.agents.length === 0) {
    // 에이전트 행이 생기기 전의 준비 구간 — 비어 보이지 않게 하나는 그려 준다.
    if (board.phase !== "준비" && board.phase !== "실행 중") return [];
    return [{ id: "run", source: "chat", name: "조수", readsOnly: false, no: 0, tone: 0, state: "working", mapId: null, mapName: null, task: board.task,
      action: "생각 중", steps: 0, startedAt: undefined, recent: [] }];
  }
  const origin = dragOriginFor(board);
  return board.agents.map((agent, index): Presence => {
    const observation = teamObservation(agent, board.trace);
    const state = stateOf(agent, board);
    const dragged = origin !== undefined && agent.role !== "reviewer";
    return {
      id: agent.agentId,
      source: "chat",
      name: agent.roleLabel || agent.kindLabel || "조수",
      readsOnly: agent.role === "reviewer",
      no: 0,
      tone: index % 4,
      state,
      mapId: dragged ? origin.mapId : agent.mapId,
      mapName: agent.mapName,
      ...(dragged ? { drag: true, region: origin.region } : {}),
      task: agent.task,
      action: actionOf(state, observation.action, board),
      ...(noteOf(state, agent, board) ? { note: noteOf(state, agent, board) } : {}),
      steps: agent.toolCalls,
      startedAt: observation.startedAt,
      recent: [...observation.recent].reverse().map(entry => ({ label: entry.label, failed: entry.failed, running: entry.running === true })),
    };
  });
}

/** 사람이 움직여야 하는 상태인가. 상태 줄이 앰버로 바뀌고 받은함에 올라온다. */
export function needsUser(presence: Presence): boolean {
  return presence.state === "review" || presence.state === "failed";
}

/**
 * 대화 카드가 이미 이 일들을 말하고 있나. 오른쪽 도크가 열려 있고(접힘·스튜디오 아님) 일이 **정확히 하나**이고 대화창의 일(source=chat)이면
 * 대화 속 카드 하나가 진행·확인·실패를 맡는다 — 지도 아래 줄·받은함·실패 이름표는 같은 말을 되풀이하는 두 번째 알림이다.
 * 도크가 접혔거나 스튜디오이거나, 영역 작업·다른 맵 작업처럼 대화 카드가 없는 일이 섞였거나, **일이 둘 이상(팀 레인·검수 조수)**이면 false —
 * 팀은 한 대화 카드에 시간순 한 줄로 합쳐져 「누가 무엇을 하나·누가 실패했나」가 안 읽힌다(2026-10-16 실측: 레인 4명이 카드에서는 「시공 3」 한 줄뿐).
 * 도크 상태는 패널이 body 클래스(`ai-dock-collapsed`·`ai-studio-open`)로 알린다.
 */
export function conversationCardCovers(presences: readonly Presence[]): boolean {
  if (typeof document === "undefined" || !document.body) return false;
  const body = document.body.classList;
  if (body.contains("ai-dock-collapsed") || body.contains("ai-studio-open")) return false;
  // 팀 실행은 팀장 한 명만 보이는 구간에도 줄을 남긴다 — 곧 팀원 칩이 붙고, 사용자는 그 줄에서 팀원을 눌러 본다.
  if (currentTeamActivity()?.mode === "team") return false;
  return presences.length === 1 && presences[0]!.source === "chat";
}

/** 급한 순서: 내 확인 필요 > 실패 > 일하는 중 > 대기 > 초안 완료 > 적용됨. 작을수록 급하다. */
export function urgencyRank(presence: Presence): number {
  switch (presence.state) {
    case "review": return 0;
    case "failed": return 1;
    case "working": return 2;
    case "waiting": return 3;
    case "draft": return 4;
    case "applied": return 5;
  }
}

export interface JobSummary {
  readonly total: number;
  /** 사람이 확인해야 하는 검토. */
  readonly review: number;
  readonly failed: number;
  /** 일하는 중 + 대기. */
  readonly running: number;
  /** 가장 급한 상태(없으면 null). */
  readonly top: "review" | "failed" | "running" | null;
}

/** 접힌 도크·상태 줄이 「몇 개가 돌고 무엇이 급한가」를 한 줄로 말하는 데 쓰는 개수. 끝난(적용됨) 일은 세지 않는다. */
export function summarizeJobs(presences: readonly Presence[], extraRunning = 0): JobSummary {
  const live = presences.filter(presence => presence.state !== "applied");
  const review = live.filter(presence => presence.state === "review").length;
  const failed = live.filter(presence => presence.state === "failed").length;
  const running = live.filter(isActive).length + extraRunning;
  const total = live.length + extraRunning;
  return { total, review, failed, running, top: review > 0 ? "review" : failed > 0 ? "failed" : running > 0 ? "running" : null };
}

/** 한 번에 하나만 취소·중단할 때. background 는 대기열 표를, 앞 턴은 팀 중지 슬롯을 쓴다. */
export function stopPresence(presence: Presence): void {
  if (presence.source === "background" && presence.ticketId !== undefined) mapRunQueue().cancel(presence.ticketId);
  else requestTeamStop();
}

/** 전부 멈춘다 — 앞 턴 + 모든 대기열 표. */
export function stopAllPresences(): void {
  requestTeamStop();
  for (const ticket of mapRunQueue().tickets()) {
    if (ticket.foreground) continue;
    if (ticket.status === "waiting" || ticket.status === "running") mapRunQueue().cancel(ticket.id);
  }
}

export function isActive(presence: Presence): boolean {
  return presence.state === "working" || presence.state === "waiting";
}

type Listener = (presences: readonly Presence[]) => void;
const listeners = new Set<Listener>();
let boardPresences: readonly Presence[] = [];
const regionPresences = new Map<string, Presence>();
/** 다른 맵에서 도는 실행이 흘려 준 보드 — 키는 대기열 표 번호. */
const backgroundBoards = new Map<number, TeamBoardState>();
const dismissed = new Set<string>();
let current: readonly Presence[] = [];
let unsubscribeBoard: (() => void) | null = null;

/** 맵별 실행이 보드 상태를 올린다(앞 턴과 달리 팀 활동 버스를 쓰지 않으므로). null 이면 거둔다. */
export function reportBackgroundBoard(ticketId: number, board: TeamBoardState | null): void {
  if (board) backgroundBoards.set(ticketId, board); else backgroundBoards.delete(ticketId);
  publish();
}

/** 실패 같은 「확인만 하면 되는」 항목을 받은함에서 치운다. */
export function dismissPresence(id: string): void {
  dismissed.add(id);
  publish();
}

function mapNameOf(mapKey: string): { mapId: string | null; mapName: string | null } {
  if (mapKey === "__project__") return { mapId: null, mapName: "프로젝트 전체" };
  const map = store.getCurrent().maps[mapKey];
  return { mapId: map ? mapKey : null, mapName: map?.name ?? mapKey };
}

function backgroundPresences(): Presence[] {
  const out: Presence[] = [];
  const seen = new Set<number>();
  for (const ticket of mapRunQueue().tickets()) {
    if (ticket.foreground) continue;
    const active = ticket.status === "waiting" || ticket.status === "running";
    const board = backgroundBoards.get(ticket.id);
    if (!active && !board) continue;
    seen.add(ticket.id);
    out.push(...presencesForTicket(ticket, board));
  }
  // 표는 끝나 사라졌는데 보드가 남은 것(검토 대기 등)은 그대로 둔다. 적용·버림이면 거둔다.
  for (const [id, board] of backgroundBoards) {
    if (seen.has(id)) continue;
    if (board.phase === "적용됨" || board.phase === "버림" || board.phase === "완료") backgroundBoards.delete(id);
  }
  return out;
}

function presencesForTicket(ticket: MapRunTicket, board: TeamBoardState | undefined): Presence[] {
  const where = mapNameOf(ticket.mapKey);
  const base = { source: "background" as const, ticketId: ticket.id, readsOnly: false, mapId: where.mapId, mapName: where.mapName };
  if (board && board.agents.length > 0) {
    return derivePresences(board).map((p, i) => ({ ...p, ...base, id: `bg${ticket.id}:${p.id}`, mapId: p.mapId ?? where.mapId, mapName: p.mapName ?? where.mapName, readsOnly: p.readsOnly, task: p.task || ticket.label, no: 0, tone: i }));
  }
  const waiting = ticket.status === "waiting";
  const action = !waiting ? "생각 중"
    : ticket.wait === "capacity" ? "동시에 도는 작업이 많아 기다리는 중"
    : ticket.wait === "exclusive" ? "팀 작업이 끝나길 기다리는 중"
    : `같은 맵 ${ticket.ahead + 1}번째로 기다리는 중`;
  return [{ ...base, id: `bg${ticket.id}`, name: "조수", no: 0, tone: 0, state: waiting ? "waiting" : "working", task: ticket.label,
    action, steps: 0, startedAt: ticket.startedAt ?? undefined, recent: [] }];
}

/** 두 Presence 가 화면에 같은 것을 말하는가 — 구독자를 깨울지 판정하는 데 쓴다. */
function samePresence(a: Presence, b: Presence): boolean {
  if (a === b) return true;
  if (a.id !== b.id || a.source !== b.source || a.ticketId !== b.ticketId || a.name !== b.name || a.readsOnly !== b.readsOnly || a.drag !== b.drag || a.no !== b.no || a.tone !== b.tone
    || a.state !== b.state || a.mapId !== b.mapId || a.mapName !== b.mapName || a.task !== b.task || a.action !== b.action || a.steps !== b.steps
    || a.startedAt !== b.startedAt || a.note !== b.note) return false;
  const ra = a.region; const rb = b.region;
  if ((ra === undefined) !== (rb === undefined)) return false;
  if (ra && rb && (ra.x !== rb.x || ra.y !== rb.y || ra.width !== rb.width || ra.height !== rb.height)) return false;
  if (a.recent.length !== b.recent.length) return false;
  for (let i = 0; i < a.recent.length; i += 1) {
    const x = a.recent[i]!; const y = b.recent[i]!;
    if (x.label !== y.label || x.failed !== y.failed || x.running !== y.running) return false;
  }
  return true;
}

/**
 * 조수 이벤트 한 건마다 불린다(스트림 조각·도구 신호 — 초당 수십 번). 보드에서 다시 도출한 Presence 가 직전과 **화면에 보이는 값이 같으면**
 * 같은 객체를 다시 쓰고, 목록 전체가 그대로면 구독자를 깨우지 않는다.
 *
 * 왜(2026-10-16 실측, 합성 스트림 N=10~20): 조각 이벤트 대부분은 이름·상태·한 줄 동작이 그대로인데도 구독자 일곱 곳(이름표·상태 줄·받은함·레일·…)이
 * 매번 새 배열을 받아 비교·재그리기를 돌았다. 바뀐 일만 새 객체가 되면 구독자는 `===` 로 거르고, 아무것도 안 바뀐 이벤트는 여기서 끝난다.
 */
function publish(): void {
  const chat = boardPresences;
  const background = backgroundPresences();
  const regions = [...regionPresences.values()];
  // 색은 번호에서 나온다(aiJobNumbers) — 지도의 파란 상자 = 상태 줄의 파란 칩 = 작업 목록의 파란 번호. 일이 끝나도 다른 일의 색이 밀리지 않는다.
  const previous = new Map(current.map(item => [item.id, item]));
  const next: Presence[] = [];
  for (const p of [...chat, ...background, ...regions]) {
    if (dismissed.has(p.id)) continue;
    const handoff = /^bg(\d+):/.exec(p.id);
    if (handoff) adoptJobNumber(`p:${p.id}`, `p:bg${handoff[1]}`);
    const no = jobNumber(`p:${p.id}`);
    const tone = jobTone(no);
    const candidate = p.no === no && p.tone === tone ? p : { ...p, no, tone };
    const old = previous.get(p.id);
    next.push(old && samePresence(old, candidate) ? old : candidate);
  }
  if (next.length === current.length && next.every((item, index) => item === current[index])) return;
  current = next;
  for (const listener of [...listeners]) listener(current);
}

const onRegionStatus = (event: Event): void => {
  const detail = regionTaskStatusDetail(event);
  if (!detail) return;
  const key = detail.runId !== undefined ? `run:${detail.runId}` : `${detail.mapId}:${detail.region.x},${detail.region.y}`;
  if (!detail.running) {
    if (regionPresences.delete(key)) publish();
    return;
  }
  const waiting = detail.phase === "pending";
  const previous = regionPresences.get(key);
  regionPresences.set(key, {
    id: `region-${key}`, source: "region", name: "영역 작업", readsOnly: false, no: 0, tone: 0,
    state: waiting ? "waiting" : "working", mapId: detail.mapId, mapName: null,
    region: { x: detail.region.x, y: detail.region.y, width: detail.region.width, height: detail.region.height },
    task: "", action: waiting ? "차례를 기다리는 중" : "만드는 중",
    steps: 0, startedAt: previous?.startedAt ?? Date.now(), recent: [],
  });
  publish();
};

export function currentPresences(): readonly Presence[] {
  return current;
}

/** 첫 구독자가 생길 때만 버스에 붙고, 마지막 구독자가 빠지면 뗀다. 구독 즉시 현재 값을 한 번 준다. */
export function subscribeAiPresence(listener: Listener): () => void {
  listeners.add(listener);
  const first = !unsubscribeBoard;
  if (first) {
    // 창이 없는 환경(가짜 DOM 테스트)에서는 영역 작업 상태 이벤트만 못 듣는다 — 보드·대기열 구독은 그대로다.
    const win = typeof window !== "undefined" ? window : null;
    win?.addEventListener(REGION_TASK_STATUS_EVENT, onRegionStatus);
    const offBoard = subscribeTeamActivity(board => {
      boardPresences = derivePresences(board);
      publish();
    });
    const offQueue = mapRunQueue().subscribe(() => publish());
    unsubscribeBoard = () => {
      offBoard();
      offQueue();
      win?.removeEventListener(REGION_TASK_STATUS_EVENT, onRegionStatus);
    };
  }
  // 처음 붙을 때 값이 비어 있으면 publish 가 구독자를 깨우지 않는다(바뀐 게 없어서) — 구독 즉시 현재 값을 한 번은 준다.
  listener(current);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      unsubscribeBoard?.();
      unsubscribeBoard = null;
      boardPresences = [];
      regionPresences.clear();
      backgroundBoards.clear();
      dismissed.clear();
      current = [];
    }
  };
}
