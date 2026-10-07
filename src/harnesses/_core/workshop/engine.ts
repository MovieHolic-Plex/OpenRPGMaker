// src/harnesses/_core/workshop/engine.ts
/**
 * 공방 실행기. 파이썬 하네스(src/harnesses/interior-props/harness.py)와 같은 흐름을 브라우저에서 돈다:
 * 그리기 → (깨지면 고치기 ≤2) → (실행기가 주면 자기 점검 1번) → 독립 검수 → 하네스 판정(gate) → 불통과면 다시(시도 ≤3).
 * 사람만 고른다 — 엔진은 고르지 않는다. 판은 바뀔 때마다 통째로 저장해, 탭을 닫아도 resume() 로 잇는다.
 */
import type { ChatMessage } from "@/ai/llmClient";
import { parseDrawAnswer } from "./grid";
import type { WorkshopStore } from "./store";
import type {
  AnchorSample, ChatFn, DrawContext, Grid, RejectedSample, Verdict, WorkshopEnv, WorkshopItem, WorkshopRound, WorkshopRun,
  WorkshopRunner, WorkshopSurface,
} from "./types";

export const MAX_ATTEMPTS = 3;
export const MAX_FIXES = 2;
export const DEFAULT_CONCURRENCY = 3;
/** 판을 열 때 보여 주는 「호출 약 N번」 계산용(그리기·검수 + 가끔 고치기·다시) */
export const CALLS_PER_CANDIDATE_ESTIMATE = 3;
const MAX_RATE_RETRIES = 5;
const RATE_WAIT_MS = 20_000;
const BLOCKED_AUTH = "AI 연결이 끊겼습니다. AI 설정에서 다시 연결하세요.";
const PENDING = new Set(["queued", "drawing", "reviewing"]);

export type WorkshopEngineOptions = {
  runner: WorkshopRunner;
  env: WorkshopEnv;
  chat: ChatFn;
  store: WorkshopStore;
  projectKey: string;
  concurrency?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  newId?: () => string;
  onChange?: (round: WorkshopRound) => void;
  /** running·queued·blocked 같은 실행 상태가 바뀐 뒤(실행이 running 에서 빠진 직후 등)에 부른다. */
  onStatus?: () => void;
};

export interface WorkshopEngine {
  startRound(item: WorkshopItem, options?: { note?: string }): Promise<WorkshopRound>;
  redrawRun(roundId: string, letter: string, note: string): Promise<void>;
  cancelRound(roundId: string): Promise<void>;
  resume(): Promise<number>;
  setConcurrency(n: number): void;
  status(): { running: number; queued: number; concurrency: number; blocked: string | null };
  idle(): Promise<void>;
  dispose(): void;
}

class Cancelled extends Error {}

const statusOf = (error: unknown): number | undefined => {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : undefined;
};
const isAbort = (error: unknown): boolean => error instanceof Cancelled || (error as { name?: string } | null)?.name === "AbortError";
const clampConcurrency = (n: number): number => Math.max(1, Math.min(6, Math.round(n)));

export function createWorkshopEngine(options: WorkshopEngineOptions): WorkshopEngine {
  const { runner, env, chat, store, projectKey } = options;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? (() => Date.now());
  const newId = options.newId ?? (() => `w${now().toString(36)}${Math.random().toString(36).slice(2, 7)}`);
  let concurrency = clampConcurrency(options.concurrency ?? DEFAULT_CONCURRENCY);
  let blocked: string | null = null;
  let disposed = false;
  const rounds = new Map<string, WorkshopRound>();
  const queue: { roundId: string; letter: string }[] = [];
  const running = new Map<string, AbortController>();
  const writes = new Map<string, Promise<void>>();
  let idleWaiters: (() => void)[] = [];

  const runKey = (roundId: string, letter: string) => `${roundId}\n${letter}`;
  const runOf = (round: WorkshopRound, letter: string): WorkshopRun => {
    const run = round.runs.find((r) => r.letter === letter);
    if (!run) throw new Error(`판 ${round.id} 에 장 ${letter} 가 없다`);
    return run;
  };

  function save(round: WorkshopRound): Promise<void> {
    const snapshot = structuredClone(round);
    const next = (writes.get(round.id) ?? Promise.resolve()).then(() => store.putRound(snapshot)).catch((error) => {
      console.warn("[workshop] 판 저장 실패:", error);
    });
    writes.set(round.id, next);
    options.onChange?.(snapshot);
    return next;
  }

  function settleIdle(): void {
    if (running.size > 0 || (queue.length > 0 && !blocked)) return;
    void Promise.all(writes.values()).then(() => {
      const waiters = idleWaiters;
      idleWaiters = [];
      for (const resolve of waiters) resolve();
    });
  }

  function pump(): void {
    while (!disposed && !blocked && running.size < concurrency && queue.length > 0) {
      const next = queue.shift()!;
      const round = rounds.get(next.roundId);
      if (!round) continue;
      const controller = new AbortController();
      running.set(runKey(next.roundId, next.letter), controller);
      void runOne(round, runOf(round, next.letter), controller.signal).finally(() => {
        running.delete(runKey(next.roundId, next.letter));
        pump();
        settleIdle();
        options.onStatus?.();
      });
    }
    settleIdle();
  }

  async function call(surface: WorkshopSurface, messages: ChatMessage[], run: WorkshopRun, round: WorkshopRound, signal: AbortSignal): Promise<string> {
    for (let retry = 0; ; retry++) {
      if (signal.aborted) throw new Cancelled();
      try {
        run.calls += 1;
        void save(round);
        return await chat(surface, { messages, response_format: { type: "json_object" }, temperature: surface === "workshop-draw" ? 0.6 : 0.1, signal, disableTransientRetry: true });
      } catch (error) {
        if (isAbort(error)) throw new Cancelled();
        if (statusOf(error) === 429 && retry < MAX_RATE_RETRIES) {
          concurrency = Math.max(1, concurrency - 1);
          await sleep(RATE_WAIT_MS * (retry + 1));
          continue;
        }
        throw error;
      }
    }
  }

  /** 그리기 대화 하나: 답 → 해석·깨짐 검사 → (고치기) → (자기 점검). 끝까지 깨지면 오류 글을 돌려준다. */
  async function drawOnce(ctx: DrawContext, run: WorkshopRun, round: WorkshopRound, signal: AbortSignal): Promise<{ grid: Grid; note: string; topRows: number | null } | { error: string }> {
    const messages = await runner.drawMessages(ctx, env);
    let lastError = "";
    for (let fix = 0; fix <= MAX_FIXES; fix++) {
      const text = await call("workshop-draw", messages, run, round, signal);
      const parsed = parseDrawAnswer(text, ctx.palette);
      const problems = parsed.ok ? runner.hardCheck(ctx.item, parsed.grid) : [parsed.error];
      if (parsed.ok && problems.length === 0) {
        if (!runner.selfCheckMessage) return { grid: parsed.grid, note: parsed.note, topRows: parsed.topRows };
        messages.push({ role: "assistant", content: text }, runner.selfCheckMessage(ctx, parsed.grid, env));
        const checkedText = await call("workshop-draw", messages, run, round, signal);
        const checked = parseDrawAnswer(checkedText, ctx.palette);
        if (checked.ok && runner.hardCheck(ctx.item, checked.grid).length === 0) {
          return { grid: checked.grid, note: checked.note || parsed.note, topRows: checked.topRows ?? parsed.topRows };
        }
        return { grid: parsed.grid, note: parsed.note, topRows: parsed.topRows };
      }
      lastError = problems.join(" / ");
      messages.push(
        { role: "assistant", content: text },
        { role: "user", content: `답을 쓸 수 없다: ${lastError}\n같은 JSON 형식으로 전체 격자를 다시 내라. 캔버스는 ${ctx.item.width}×${ctx.item.height}px 이다.` },
      );
    }
    return { error: lastError };
  }

  async function contextFor(round: WorkshopRound, run: WorkshopRun, item: WorkshopItem, attempt: number, previousGrid: Grid | null, lastVerdict: Verdict | null): Promise<DrawContext> {
    const feedback = await store.listFeedback(projectKey, item.key);
    const rejected: RejectedSample[] = [];
    for (const entry of feedback.filter((f) => f.verdict === "reject" && f.letter).slice(-4)) {
      const grid = (rounds.get(entry.roundId) ?? (await store.getRound(entry.roundId)))?.runs.find((r) => r.letter === entry.letter)?.grid;
      if (grid) rejected.push({ grid, reasons: entry.reasons, note: entry.note });
    }
    const picked: AnchorSample[] = [];
    for (const pick of await store.listPicks(projectKey)) {
      if (pick.itemKey === item.key) continue;
      const grid = (rounds.get(pick.roundId) ?? (await store.getRound(pick.roundId)))?.runs.find((r) => r.letter === pick.letter)?.grid;
      if (grid) picked.push({ itemKey: pick.itemKey, title: pick.itemKey, grid, picked: true });
    }
    return {
      item,
      palette: runner.palette(item),
      direction: { letter: run.letter, text: run.direction },
      roundNote: round.note,
      redrawNote: run.redrawNote,
      attempt,
      maxAttempts: MAX_ATTEMPTS,
      previousGrid,
      lastVerdict,
      current: runner.currentGrid(item),
      anchors: runner.anchors(item, picked),
      rejected,
      notes: feedback.map((f) => f.note).filter(Boolean).slice(-5),
    };
  }

  async function runOne(round: WorkshopRound, run: WorkshopRun, signal: AbortSignal): Promise<void> {
    try {
      await runner.prepare(env);
      const defs = await store.listItemDefs(projectKey);
      const item = runner.items(defs).find((candidate) => candidate.key === round.itemKey);
      if (!item) throw new Error(`기물 ${round.itemKey} 를 찾지 못했다`);
      run.status = "drawing";
      run.startedAt = now();
      run.error = null;
      void save(round);
      let previousGrid = run.grid;
      // 다시 그리기(redrawRun)는 지난 격자를 출발점으로 넘긴다. 지난 판정은 불통과일 때만 「떨어진 이유」로 넘긴다.
      let lastVerdict: Verdict | null = run.verdict?.verdict === "FAIL" ? run.verdict : null;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        run.attempt = attempt;
        run.status = "drawing";
        void save(round);
        const ctx = await contextFor(round, run, item, attempt, previousGrid, lastVerdict);
        const drawn = await drawOnce(ctx, run, round, signal);
        if ("error" in drawn) {
          run.attempts.push({ attempt, hard: [drawn.error], verdict: null, grid: null });
          if (attempt === MAX_ATTEMPTS) {
            run.status = "failed";
            run.error = `그림을 못 냈다: ${drawn.error}`;
            return;
          }
          continue;
        }
        run.grid = drawn.grid;
        run.note = drawn.note;
        run.topRows = drawn.topRows;
        run.status = "reviewing";
        void save(round);
        const reviewText = await call("workshop-review", await runner.reviewMessages({
          item, palette: ctx.palette, direction: ctx.direction, attempt, maxAttempts: MAX_ATTEMPTS,
          candidate: drawn.grid, current: ctx.current, anchors: ctx.anchors, previousVerdict: lastVerdict,
        }, env), run, round, signal);
        let parsed: Verdict;
        try {
          parsed = runner.parseVerdict(reviewText);
        } catch {
          parsed = { verdict: "FAIL", codes: ["READ"], top: "", topRows: null, reasons: "검수 답을 읽지 못했다", fix: "", worse: false };
        }
        const verdict = runner.gate(item, parsed);
        run.verdict = verdict;
        run.attempts.push({ attempt, hard: [], verdict, grid: drawn.grid });
        if (verdict.verdict === "PASS") break;
        previousGrid = drawn.grid;
        lastVerdict = verdict;
      }
      run.status = "done";
    } catch (error) {
      if (isAbort(error) || signal.aborted) {
        // dispose(프로젝트 전환)로 끊긴 장은 취소가 아니다 — 다시 열면 resume 이 잇는다.
        run.status = disposed ? "queued" : "cancelled";
        return;
      }
      const status = statusOf(error);
      if (status === 401 || status === 403) blocked = BLOCKED_AUTH;
      run.status = "failed";
      run.error = error instanceof Error ? error.message : String(error);
    } finally {
      run.finishedAt = now();
      await save(round);
    }
  }

  function enqueue(round: WorkshopRound, letter: string): void {
    rounds.set(round.id, round);
    if (!queue.some((q) => q.roundId === round.id && q.letter === letter)) queue.push({ roundId: round.id, letter });
  }

  const freshRun = (letter: string, direction: string): WorkshopRun => ({
    letter, direction, status: "queued", attempt: 0, attempts: [], grid: null, note: "", topRows: null, verdict: null,
    error: null, calls: 0, redrawNote: "", startedAt: null, finishedAt: null,
  });

  return {
    async startRound(item, startOptions = {}) {
      blocked = null;
      const round: WorkshopRound = {
        id: newId(), projectKey, harnessId: runner.harnessId, itemKey: item.key, note: startOptions.note ?? "", created: now(),
        runs: runner.directions(item).slice(0, runner.candidates).map((d) => freshRun(d.letter, d.text)),
      };
      await save(round);
      for (const run of round.runs) enqueue(round, run.letter);
      pump();
      return structuredClone(round);
    },
    async redrawRun(roundId, letter, note) {
      const round = rounds.get(roundId) ?? (await store.getRound(roundId));
      if (!round) throw new Error(`판 ${roundId} 가 없다`);
      // 같은 글자가 진행 중이거나 줄 서 있으면 겹쳐 돌리지 않는다(두 번째 실행이 첫 실행의 취소 줄을 지운다).
      if (running.has(runKey(roundId, letter)) || queue.some((q) => q.roundId === roundId && q.letter === letter)) return;
      const old = runOf(round, letter);
      const run = { ...freshRun(letter, old.direction), grid: old.grid, verdict: old.verdict, redrawNote: note };
      round.runs = round.runs.map((r) => (r.letter === letter ? run : r));
      blocked = null;
      await save(round);
      enqueue(round, letter);
      pump();
    },
    async cancelRound(roundId) {
      const round = rounds.get(roundId) ?? (await store.getRound(roundId));
      if (!round) return;
      for (let i = queue.length - 1; i >= 0; i--) if (queue[i].roundId === roundId) queue.splice(i, 1);
      for (const run of round.runs) {
        const controller = running.get(runKey(roundId, run.letter));
        if (controller) controller.abort();
        else if (run.status === "queued") run.status = "cancelled";
      }
      await save(round);
      settleIdle();
      options.onStatus?.();
    },
    async resume() {
      let count = 0;
      for (const round of await store.listRounds(projectKey)) {
        if (round.harnessId !== runner.harnessId) continue;
        const target = rounds.get(round.id) ?? round;
        let requeued = 0;
        for (const run of target.runs) {
          if (!PENDING.has(run.status) || running.has(runKey(target.id, run.letter))) continue;
          // 지난 시도 기록은 비운다(격자·판정은 남겨 previousGrid·lastVerdict 로 이어진다).
          run.status = "queued";
          run.attempts = [];
          run.attempt = 0;
          run.error = null;
          enqueue(target, run.letter);
          requeued += 1;
        }
        count += requeued;
        if (requeued > 0) await save(target);
      }
      pump();
      return count;
    },
    setConcurrency(n) {
      concurrency = clampConcurrency(n);
      pump();
      options.onStatus?.();
    },
    status: () => ({ running: running.size, queued: queue.length, concurrency, blocked }),
    idle: () => new Promise<void>((resolve) => {
      idleWaiters.push(resolve);
      settleIdle();
    }),
    dispose() {
      disposed = true;
      for (const controller of running.values()) controller.abort();
      queue.length = 0;
    },
  };
}
