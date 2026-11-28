// editor/aiThreadList.ts — 왼쪽 열 스레드 목록의 자료(2026-11-28, 설계 docs/superpowers/specs/2026-11-28-assistant-thread-sidebar-design.md §4.2·§5).
//
// 스레드 = 저장된 대화 기록 하나(conversationStore). 이 파일은 그 요약을 집 맵별로 묶고(groupThreads),
// 실행 표·열린 확인 카드로 스레드마다 「작업 중·기다림·확인 필요」를 단다(threadStates). 화면은 그리지 않는다.
//
// 수명: 모듈 싱글턴(aiMapRunQueue 와 같은 이유 — 패널이 다시 만들어져도 목록은 하나다).
// 범위 키는 conversationScopeKey 와 같은 것을 패널이 setScope 로 넣는다.

import {
  onConversationSaved,
  queryConversationArchive,
  type ConversationArchiveSummary,
} from "@/ai/conversationStore";
import { mapRunQueue, type MapRunQueue, type MapRunTicket } from "@/editor/aiMapRunQueue";
import {
  openAssistantDecisions,
  subscribeAssistantDecisions,
  type OpenAssistantDecision,
} from "@/editor/panels/aiDecisionPrompt";
import { store } from "@/project/store";

export type ThreadState = "working" | "waiting" | "needs-answer";
export interface ThreadRow {
  readonly id: string;
  readonly title: string;
  readonly savedAt: number;
  /** 실제로 보일 집 맵. 저장된 집 맵이 지금 없으면 null(게임 전체). */
  readonly homeMapId: string | null;
  readonly state?: ThreadState;
}
export interface ThreadListSnapshot {
  /** 집이 게임 전체인 스레드, 최신순. */
  readonly gameWide: readonly ThreadRow[];
  /** 집 맵별, 최신순. */
  readonly byMap: ReadonlyMap<string, readonly ThreadRow[]>;
  /** 집 밖에서 고친 맵(targetMapIds)별 — 그 맵 밑에 「↗ 제목」 꼬리표로 한 번 더 비친다. 최신순. */
  readonly echoes: ReadonlyMap<string, readonly ThreadRow[]>;
}

/** 목록에 읽어 오는 최근 스레드 수. */
export const THREAD_LIST_LIMIT = 200;
/** 저장 알림을 모아 다시 읽는 간격. 매 도구 호출마다 저장되므로 묶는다. */
export const THREAD_LIST_DEBOUNCE_MS = 100;

const EMPTY_SNAPSHOT: ThreadListSnapshot = { gameWide: [], byMap: new Map(), echoes: new Map() };

const newestFirst = (a: ThreadRow, b: ThreadRow): number => b.savedAt - a.savedAt || a.id.localeCompare(b.id);
function push(map: Map<string, ThreadRow[]>, key: string, row: ThreadRow): void {
  const list = map.get(key);
  if (list) list.push(row); else map.set(key, [row]);
}

/** 순수: 요약을 집 맵·게임 전체·꼬리표로 묶는다. 지금 없는 맵은 집으로도 꼬리표로도 쓰지 않는다. */
export function groupThreads(rows: readonly ConversationArchiveSummary[], mapExists: (id: string) => boolean,
  states: ReadonlyMap<string, ThreadState>): ThreadListSnapshot {
  const gameWide: ThreadRow[] = [];
  const byMap = new Map<string, ThreadRow[]>();
  const echoes = new Map<string, ThreadRow[]>();
  const seen = new Set<string>();
  for (const summary of rows) {
    if (seen.has(summary.id)) continue;
    seen.add(summary.id);
    const stored = summary.homeMapId ?? null;
    const homeMapId = stored !== null && mapExists(stored) ? stored : null;
    const state = states.get(summary.id);
    const row: ThreadRow = { id: summary.id, title: summary.title, savedAt: summary.savedAt, homeMapId, ...(state ? { state } : {}) };
    if (homeMapId === null) gameWide.push(row); else push(byMap, homeMapId, row);
    for (const target of new Set(summary.targetMapIds)) {
      if (target !== homeMapId && mapExists(target)) push(echoes, target, row);
    }
  }
  gameWide.sort(newestFirst);
  for (const list of byMap.values()) list.sort(newestFirst);
  for (const list of echoes.values()) list.sort(newestFirst);
  return { gameWide, byMap, echoes };
}

const STATE_RANK: Record<ThreadState, number> = { waiting: 1, working: 2, "needs-answer": 3 };

/** 순수: 스레드마다 가장 급한 상태. 확인 필요 > 작업 중 > 기다림. 스레드 id 가 없는 표·카드는 어느 줄에도 달지 않는다. */
export function threadStates(tickets: readonly MapRunTicket[], decisions: readonly OpenAssistantDecision[]): ReadonlyMap<string, ThreadState> {
  const states = new Map<string, ThreadState>();
  const raise = (threadId: string | undefined, state: ThreadState) => {
    if (threadId === undefined) return;
    const current = states.get(threadId);
    if (!current || STATE_RANK[state] > STATE_RANK[current]) states.set(threadId, state);
  };
  for (const ticket of tickets) {
    if (ticket.status === "running") raise(ticket.threadId, "working");
    else if (ticket.status === "waiting") raise(ticket.threadId, "waiting");
  }
  for (const decision of decisions) raise(decision.threadId, "needs-answer");
  return states;
}

export interface AiThreadList {
  snapshot(): ThreadListSnapshot;
  subscribe(fn: () => void): () => void;
  /** 현재 범위의 최근 스레드를 다시 읽는다. 범위가 없으면 비운다. 읽기 실패는 앞 목록을 남긴다. */
  refresh(): Promise<void>;
  /** 패널이 지금 프로젝트의 conversationScopeKey 를 넣는다. 바뀌면 다시 읽는다. */
  setScope(projectContextKey: string | null): void;
}

export interface AiThreadListDeps {
  readonly load?: (projectContextKey: string) => Promise<readonly ConversationArchiveSummary[]>;
  readonly mapExists?: (id: string) => boolean;
  /** 이 값이 바뀌면(맵 추가·삭제) 묶음을 다시 계산한다. */
  readonly mapsToken?: () => unknown;
  readonly queue?: () => MapRunQueue;
  readonly decisions?: () => readonly OpenAssistantDecision[];
  readonly subscribeDecisions?: (fn: () => void) => () => void;
  readonly onSaved?: (fn: (id: string) => void) => () => void;
  readonly debounceMs?: number;
}

/** 테스트용 공장 — 편집기는 aiThreadList() 싱글턴을 쓴다. dispose 는 듣던 것을 모두 끊는다. */
export function createAiThreadList(deps: AiThreadListDeps = {}): AiThreadList & { dispose(): void } {
  const load = deps.load ?? (async (projectContextKey: string) =>
    (await queryConversationArchive({ projectContextKey, offset: 0, limit: THREAD_LIST_LIMIT })).records);
  const mapExists = deps.mapExists ?? ((id: string) => store.getCurrent().maps[id] !== undefined);
  const mapsToken = deps.mapsToken ?? (() => store.getCurrent().maps);
  const queue = deps.queue ?? mapRunQueue;
  const decisions = deps.decisions ?? openAssistantDecisions;
  const debounceMs = deps.debounceMs ?? THREAD_LIST_DEBOUNCE_MS;

  const listeners = new Set<() => void>();
  let scope: string | null = null;
  let rows: readonly ConversationArchiveSummary[] = [];
  let generation = 0;
  let states = threadStates(queue().tickets(), decisions());
  let cached: { snapshot: ThreadListSnapshot; rows: readonly ConversationArchiveSummary[]; states: ReadonlyMap<string, ThreadState>; token: unknown } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const emit = (): void => {
    for (const listener of [...listeners]) {
      try { listener(); } catch (error) { console.warn("[aiThreadList] listener", error); }
    }
  };
  const refresh = async (): Promise<void> => {
    const mine = ++generation;
    const key = scope;
    if (key === null) {
      rows = [];
      emit();
      return;
    }
    try {
      const next = await load(key);
      if (mine !== generation) return; // 범위가 바뀌었거나 더 새 읽기가 있다.
      rows = next;
      emit();
    } catch (error) {
      if (mine === generation) console.warn("[aiThreadList] 스레드 목록을 읽지 못했습니다:", error);
    }
  };
  const schedule = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void refresh(); }, debounceMs);
  };
  const restate = (): void => {
    states = threadStates(queue().tickets(), decisions());
    emit();
  };

  const unsubscribers = [
    (deps.onSaved ?? onConversationSaved)(() => { if (scope !== null) schedule(); }),
    queue().subscribe(restate),
    (deps.subscribeDecisions ?? subscribeAssistantDecisions)(restate),
  ];

  return {
    snapshot() {
      if (scope === null && rows.length === 0) return EMPTY_SNAPSHOT;
      const token = mapsToken();
      if (cached && cached.rows === rows && cached.states === states && cached.token === token) return cached.snapshot;
      const snapshot = groupThreads(rows, mapExists, states);
      cached = { snapshot, rows, states, token };
      return snapshot;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
    refresh,
    setScope(projectContextKey) {
      if (projectContextKey === scope) return;
      scope = projectContextKey;
      rows = [];
      if (timer !== null) { clearTimeout(timer); timer = null; }
      void refresh();
    },
    dispose() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      generation++;
      for (const off of unsubscribers) off();
      listeners.clear();
    },
  };
}

let current: (AiThreadList & { dispose(): void }) | null = null;

/** 편집기 전체에 하나. */
export function aiThreadList(): AiThreadList {
  return (current ??= createAiThreadList());
}

/** 테스트용 — 싱글턴을 끊고 비운다. */
export function resetAiThreadListForTests(): void {
  current?.dispose();
  current = null;
}
