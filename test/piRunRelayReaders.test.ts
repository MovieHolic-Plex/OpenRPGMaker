// 호스트 실행 중계(scripts/lib/piRunRelay.mjs)의 읽는 이 번호(?reader=) — 이어 받기는 같은 읽는 이의 앞 스트림만 끝낸다.
// 왜(2026-11-11): 본문을 복제해 같이 읽는 시험 구동기가 앞 스트림을 놓지 않아 이어 받기마다 연결 하나가 남았고, 브라우저의 호스트당 연결 6개가 차면
// 저장·적용 응답이 나가지 못해 턴이 끝맺음에서 30분 멈췄다. 번호 없는 읽기(끝난 실행을 따로 읽는 QA 스크립트)·다른 번호의 읽기는 건드리면 안 된다 —
// 편집기의 스트림이 «오류 없이» 닫히면 편집기는 실행이 끝난 줄 안다.
import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error plain ESM JS module
import { handleCompanionRequest } from "../scripts/lib/ohMyPiHttp.mjs";
// @ts-expect-error plain ESM JS module
import { resetRelayForTests } from "../scripts/lib/piRunRelay.mjs";

type Line = { seq: number; type: string; index?: number };
type Read = { done: true } | { done: false; lines: Line[] } | "pending";

/** 가짜 워커 — 줄을 손으로 흘리고, 중단 신호를 센다. */
function fakeWorker() {
  const state = { aborted: 0, emit: (_event: unknown) => {}, end: () => {} };
  const adapters = { runAgent: async (_provider: string, _body: unknown, { signal }: { signal: AbortSignal }) => {
    signal.addEventListener("abort", () => { state.aborted++; state.end(); });
    const encoder = new TextEncoder();
    return { ndjson: new ReadableStream<Uint8Array>({ start(controller) {
      state.emit = (event) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      state.end = () => { try { controller.close(); } catch { /* 이미 닫힘 */ } };
    } }) };
  } };
  return { state, adapters };
}

/** 스트림 하나를 읽는 손잡이. next() 는 50ms 안에 아무것도 안 오면 "pending"(열려 있고 줄이 없다)을 돌려주고, 그 읽기는 다음 next() 가 이어 기다린다. */
function tap(stream: unknown): () => Promise<Read> {
  const reader = (stream as ReadableStream<Uint8Array>).getReader();
  let outstanding: Promise<Read> | null = null;
  return async () => {
    outstanding ??= reader.read().then((r): Read => r.done ? { done: true }
      : { done: false, lines: new TextDecoder().decode(r.value).trim().split("\n").map((l) => JSON.parse(l) as Line) });
    const result = await Promise.race([outstanding, new Promise<Read>((resolve) => setTimeout(() => resolve("pending"), 50))]);
    if (result !== "pending") outstanding = null;
    return result;
  };
}
const seqs = (read: Read) => (read !== "pending" && !read.done ? read.lines.map((l) => l.seq) : read);

const open = (adapters: unknown, runId: string, reader?: string) => handleCompanionRequest(
  { method: "POST", url: `/v1/agent/run?provider=openai-codex${reader ? `&reader=${reader}` : ""}`, headers: {}, body: { task: "t", mapIds: [], runId, project: { maps: {} } } }, adapters);
const resume = (adapters: unknown, runId: string, after: number, reader?: string) => handleCompanionRequest(
  { method: "GET", url: `/v1/agent/run?provider=openai-codex&runId=${runId}&after=${after}${reader ? `&reader=${reader}` : ""}`, headers: {}, body: {} }, adapters);

afterEach(() => resetRelayForTests());

describe("실행 중계: 읽는 이 번호", () => {
  it("이어 받기는 같은 읽는 이의 앞 스트림을 끝내고, 새 스트림이 이어서 받는다 — 워커는 멈추지 않는다", async () => {
    const { state, adapters } = fakeWorker();
    const first = await open(adapters, "run-reader-0001", "reader-aaaa");
    expect(first.status).toBe(200);
    let previous = tap(first.ndjson);
    state.emit({ type: "turn", index: 1 });
    expect(seqs(await previous())).toEqual([0]);
    // 줄이 없으면 앞 스트림은 열린 채 기다린다.
    expect(await previous()).toBe("pending");

    // 이어 받기를 다섯 번 — 매번 바로 앞 스트림이 닫힌다(앞 스트림을 읽는 쪽이 남아 있어도 연결이 풀린다).
    let current = previous;
    for (let i = 0; i < 5; i++) {
      const resumed = await resume(adapters, "run-reader-0001", 1, "reader-aaaa");
      expect(resumed.status).toBe(200);
      current = tap(resumed.ndjson);
      expect(await previous()).toEqual({ done: true });
      expect(await current()).toBe("pending");
      previous = current;
    }
    state.emit({ type: "turn", index: 2 });
    expect(seqs(await current())).toEqual([1]);
    expect(state.aborted).toBe(0);

    state.emit({ type: "done", project: {}, stats: {}, changedKeys: [] });
    state.end();
    expect(seqs(await current())).toEqual([2]);
    expect(await current()).toEqual({ done: true });
  });

  it("번호 없는 읽기와 다른 번호의 읽기는 편집기의 스트림을 끝내지 않는다", async () => {
    const { state, adapters } = fakeWorker();
    const editor = tap((await open(adapters, "run-reader-0002", "reader-aaaa")).ndjson);
    state.emit({ type: "turn", index: 1 });
    expect(seqs(await editor())).toEqual([0]);

    // 끝난 실행의 기록을 따로 읽는 쪽(번호 없음)과 다른 탭(다른 번호)이 같은 실행을 읽는다.
    const journal = tap((await resume(adapters, "run-reader-0002", 0)).ndjson);
    const other = tap((await resume(adapters, "run-reader-0002", 0, "reader-bbbb")).ndjson);
    expect(seqs(await journal())).toEqual([0]);
    expect(seqs(await other())).toEqual([0]);
    expect(await editor()).toBe("pending");

    // 셋 다 다음 줄을 받는다 — 아무도 닫히지 않았다.
    state.emit({ type: "turn", index: 2 });
    expect(seqs(await editor())).toEqual([1]);
    expect(seqs(await journal())).toEqual([1]);
    expect(seqs(await other())).toEqual([1]);

    // 다른 번호가 다시 이어 받으면 그 번호의 앞 스트림만 닫힌다.
    const otherAgain = tap((await resume(adapters, "run-reader-0002", 2, "reader-bbbb")).ndjson);
    expect(await other()).toEqual({ done: true });
    state.emit({ type: "turn", index: 3 });
    expect(seqs(await editor())).toEqual([2]);
    expect(seqs(await journal())).toEqual([2]);
    expect(seqs(await otherAgain())).toEqual([2]);
    expect(state.aborted).toBe(0);
  });

  it("모양이 틀린 번호는 없는 것으로 본다 — 앞 스트림을 끝내지 않는다", async () => {
    const { state, adapters } = fakeWorker();
    const editor = tap((await open(adapters, "run-reader-0003", "x")).ndjson);
    const second = tap((await resume(adapters, "run-reader-0003", 0, "x")).ndjson);
    state.emit({ type: "turn", index: 1 });
    expect(seqs(await editor())).toEqual([0]);
    expect(seqs(await second())).toEqual([0]);
    expect(state.aborted).toBe(0);
  });
});
