// editor/panels/aiPresence.ts
// 「AI 가 지금 누구고, 무엇을 하고, 나는 뭘 해야 하나」의 단일 원천.
//
// 지도 위 이름표(aiMapPresence)·지도 아래 상태 줄(aiStatusBar)·도크의 받은함(aiInbox)이 전부 이 모듈 하나만 본다.
// 단독 `/pi` 와 팀은 이미 같은 TeamBoardState 로 합쳐져 있으므로 새 관측을 만들지 않고 그 상태를 사람의 말로만 바꾼다.
// 화면마다 달랐던 「모델 응답 대기 / 작업을 마쳤어요 / 초안 종료 / 적용」을 아래 6가지로 통일한다.

import type { TeamBoardAgent, TeamBoardState } from "@/ai/piAgent/teamBoardState";
import { subscribeTeamActivity } from "@/ai/piAgent/teamActivity";
import { REGION_TASK_STATUS_EVENT, regionTaskStatusDetail } from "@/editor/regionTask/regionTaskStatus";
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
  /** chat = 대화창 요청(팀 포함), region = 지도를 드래그해서 시킨 일. 둘은 서로 다른 스레드로 돈다. */
  readonly source: "chat" | "region";
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

export function isActive(presence: Presence): boolean {
  return presence.state === "working" || presence.state === "waiting";
}

type Listener = (presences: readonly Presence[]) => void;
const listeners = new Set<Listener>();
let boardPresences: readonly Presence[] = [];
const regionPresences = new Map<string, Presence>();
let current: readonly Presence[] = [];
let unsubscribeBoard: (() => void) | null = null;

function publish(): void {
  const chat = boardPresences.map(p => ({ ...p, tone: p.tone % 4 }));
  const regions = [...regionPresences.values()].map((p, index) => ({ ...p, tone: (chat.length + index) % 4 }));
  current = [...chat, ...regions];
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
    unsubscribeBoard = () => {
      offBoard();
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
      current = [];
    }
  };
}
