// editor/panels/aiPresence.ts
// 「AI 가 지금 누구고, 무엇을 하고, 나는 뭘 해야 하나」의 단일 원천.
//
// 지도 위 이름표(aiMapPresence)·지도 아래 상태 줄(aiStatusBar)·도크의 받은함(aiInbox)이 전부 이 모듈 하나만 본다.
// 단독 `/pi` 와 팀은 이미 같은 TeamBoardState 로 합쳐져 있으므로 새 관측을 만들지 않고 그 상태를 사람의 말로만 바꾼다.
// 화면마다 달랐던 「모델 응답 대기 / 작업을 마쳤어요 / 초안 종료 / 적용」을 아래 6가지로 통일한다.

import type { TeamBoardAgent, TeamBoardState } from "@/ai/piAgent/teamBoardState";
import { requestTeamStop, subscribeTeamActivity } from "@/ai/piAgent/teamActivity";
import { REGION_TASK_STATUS_EVENT, regionTaskStatusDetail } from "@/editor/regionTask/regionTaskStatus";
import { mapRunQueue, type MapRunTicket } from "@/editor/aiMapRunQueue";
import { store } from "@/project/store";
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
  /** 같은 실행 안에서 안정적인 색 번호(0~3). 지도 이름표·상태 줄 칩·받은함이 같은 색을 쓴다. */
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

export function derivePresences(board: TeamBoardState | null): readonly Presence[] {
  if (!board || board.phase === "버림") return [];
  if (board.agents.length === 0) {
    // 에이전트 행이 생기기 전의 준비 구간 — 비어 보이지 않게 하나는 그려 준다.
    if (board.phase !== "준비" && board.phase !== "실행 중") return [];
    return [{ id: "run", source: "chat", name: "조수", readsOnly: false, tone: 0, state: "working", mapId: null, mapName: null, task: board.task,
      action: "생각 중", steps: 0, startedAt: undefined, recent: [] }];
  }
  return board.agents.map((agent, index): Presence => {
    const observation = teamObservation(agent, board.trace);
    const state = stateOf(agent, board);
    return {
      id: agent.agentId,
      source: "chat",
      name: agent.roleLabel || agent.kindLabel || "조수",
      readsOnly: agent.role === "reviewer",
      tone: index % 4,
      state,
      mapId: agent.mapId,
      mapName: agent.mapName,
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
    return derivePresences(board).map((p, i) => ({ ...p, ...base, id: `bg${ticket.id}:${p.id}`, mapId: p.mapId ?? where.mapId, mapName: p.mapName ?? where.mapName, readsOnly: p.readsOnly, task: p.task || ticket.label, tone: i }));
  }
  const waiting = ticket.status === "waiting";
  const action = !waiting ? "생각 중"
    : ticket.wait === "capacity" ? "동시에 도는 작업이 많아 기다리는 중"
    : ticket.wait === "exclusive" ? "팀 작업이 끝나길 기다리는 중"
    : `같은 맵 ${ticket.ahead + 1}번째로 기다리는 중`;
  return [{ ...base, id: `bg${ticket.id}`, name: "조수", tone: 0, state: waiting ? "waiting" : "working", task: ticket.label,
    action, steps: 0, startedAt: ticket.startedAt ?? undefined, recent: [] }];
}

function publish(): void {
  const chat = boardPresences;
  const background = backgroundPresences();
  const regions = [...regionPresences.values()];
  // 색은 표면 전체에서 겹치지 않게 순서대로 — 지도의 파란 상자 = 상태 줄의 파란 칩.
  current = [...chat, ...background, ...regions].filter(p => !dismissed.has(p.id)).map((p, index) => ({ ...p, tone: index % 4 }));
  for (const next of [...listeners]) next(current);
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
    id: `region-${key}`, source: "region", name: "영역 작업", readsOnly: false, tone: 0,
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
  if (!unsubscribeBoard) {
    window.addEventListener(REGION_TASK_STATUS_EVENT, onRegionStatus);
    const offBoard = subscribeTeamActivity(board => {
      boardPresences = derivePresences(board);
      publish();
    });
    const offQueue = mapRunQueue().subscribe(() => publish());
    unsubscribeBoard = () => {
      offBoard();
      offQueue();
      window.removeEventListener(REGION_TASK_STATUS_EVENT, onRegionStatus);
    };
  } else {
    listener(current);
  }
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
