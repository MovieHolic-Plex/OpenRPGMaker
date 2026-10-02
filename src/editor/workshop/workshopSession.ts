// src/editor/workshop/workshopSession.ts
/**
 * 프로젝트 하나 × 하네스 하나의 공방 묶음(실행기·엔진·저장소). 화면을 닫아도 엔진은 계속 돈다.
 * 프로젝트가 바뀌면 옛 묶음을 dispose 한다. 프로젝트 스토어는 매 그리기마다 알리므로 구독하지 않고,
 * 프로젝트를 바꾼 뒤 공방을 다음에 열 때(get)·들여다볼 때(peek) 하네스를 가리지 않고 한꺼번에 정리한다.
 * dispose 된 장은 저장소에 queued 로 남아, 그 프로젝트의 공방을 다시 열면 resume 된다.
 */
import { conversationScopeKey } from "@/ai/conversationStore";
import { getHarness } from "@/harnesses/_core/registry";
import { createWorkshopEngine, type WorkshopEngine } from "@/harnesses/_core/workshop/engine";
import { openWorkshopStore, type WorkshopStore } from "@/harnesses/_core/workshop/store";
import type { ItemDefinition, WorkshopEnv, WorkshopItem, WorkshopPick, WorkshopRound, WorkshopRunner } from "@/harnesses/_core/workshop/types";
import { store as projectStore } from "@/project/store";
import { createWorkshopChat } from "./chat";
import { browserWorkshopEnv } from "./pixels";

const CONCURRENCY_KEY = "oprn:workshop-concurrency";
/** 세션(판·고른 것)이 바뀌면 window 에 낸다 — 왼쪽 판이 듣는다. */
export const WORKSHOP_CHANGED_EVENT = "oprn:workshop-changed";

export type WorkshopSession = {
  readonly harnessId: string;
  readonly projectKey: string;
  readonly runner: WorkshopRunner;
  readonly engine: WorkshopEngine;
  readonly store: WorkshopStore;
  readonly env: WorkshopEnv;
  items(): WorkshopItem[];
  defs: ItemDefinition[];
  rounds: WorkshopRound[];
  picks: WorkshopPick[];
  subscribe(listener: () => void): () => void;
  reload(): Promise<void>;
};

const sessions = new Map<string, Promise<WorkshopSession>>();
const ready = new Map<string, WorkshopSession>();
let storePromise: Promise<WorkshopStore> | null = null;

export function currentWorkshopProjectKey(): string {
  return conversationScopeKey(projectStore.getProjectIdentity(), projectStore.getCurrent());
}

export function savedConcurrency(): number {
  try {
    const value = Number(localStorage.getItem(CONCURRENCY_KEY));
    return Number.isFinite(value) && value >= 1 && value <= 6 ? value : 3;
  } catch {
    return 3;
  }
}

export function saveConcurrency(n: number): void {
  try { localStorage.setItem(CONCURRENCY_KEY, String(n)); } catch { /* restricted storage */ }
}

/** 지금 프로젝트가 아닌 모든 묶음(하네스 무관, 만드는 중인 것 포함)을 dispose 하고 맵에서 지운다. */
function disposeStaleSessions(): void {
  const suffix = `|${currentWorkshopProjectKey()}`;
  for (const key of [...new Set([...sessions.keys(), ...ready.keys()])]) {
    if (key.endsWith(suffix)) continue;
    const live = ready.get(key);
    const pending = sessions.get(key);
    ready.delete(key);
    sessions.delete(key);
    if (live) live.engine.dispose();
    else pending?.then((session) => session.engine.dispose(), () => undefined);
  }
}

export function peekWorkshopSession(harnessId: string): WorkshopSession | null {
  disposeStaleSessions();
  return ready.get(`${harnessId}|${currentWorkshopProjectKey()}`) ?? null;
}

export function getWorkshopSession(harnessId: string): Promise<WorkshopSession> {
  disposeStaleSessions();
  const projectKey = currentWorkshopProjectKey();
  const id = `${harnessId}|${projectKey}`;
  let pending = sessions.get(id);
  if (!pending) {
    const created = createSession(harnessId, projectKey);
    pending = created;
    sessions.set(id, created);
    created.then(
      (session) => { if (sessions.get(id) === created) ready.set(id, session); },
      () => { if (sessions.get(id) === created) sessions.delete(id); },
    );
  }
  return pending;
}

async function createSession(harnessId: string, projectKey: string): Promise<WorkshopSession> {
  const harness = getHarness(harnessId);
  if (!harness?.workshop) throw new Error(`${harnessId} 는 공방 실행기가 없다`);
  const [runner, store] = await Promise.all([harness.workshop(), (storePromise ??= openWorkshopStore())]);
  const env = browserWorkshopEnv();
  await runner.prepare(env);
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
    window.dispatchEvent(new Event(WORKSHOP_CHANGED_EVENT));
  };
  const session: WorkshopSession = {
    harnessId, projectKey, runner, store, env,
    engine: createWorkshopEngine({
      runner, env, store, projectKey, chat: createWorkshopChat(), concurrency: savedConcurrency(),
      onChange: (round) => {
        const index = session.rounds.findIndex((r) => r.id === round.id);
        if (index >= 0) session.rounds[index] = round;
        else session.rounds.push(round);
        notify();
      },
    }),
    defs: [], rounds: [], picks: [],
    items: () => runner.items(session.defs),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async reload() {
      const [defs, rounds, picks] = await Promise.all([store.listItemDefs(projectKey), store.listRounds(projectKey), store.listPicks(projectKey)]);
      session.defs = defs;
      session.rounds = rounds.filter((round) => round.harnessId === harnessId);
      session.picks = picks;
      notify();
    },
  };
  await session.reload();
  if (currentWorkshopProjectKey() !== projectKey) {
    session.engine.dispose();
    throw new Error("공방을 여는 동안 프로젝트가 바뀌었습니다");
  }
  await session.engine.resume();
  return session;
}
