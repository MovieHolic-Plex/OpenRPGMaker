import { afterEach, describe, expect, it, vi } from "vitest";
import { handleCompanionRequest } from "../scripts/lib/ohMyPiHttp.mjs";
import { resetRelayForTests } from "../scripts/lib/piRunRelay.mjs";
import { PiTeamMessaging } from "../scripts/lib/piTeamMessaging";
import { buildPiIntentNote, composePiTask } from "@/ai/piAgent/executionRoute";
import { INTENT_NOTE_BOUNDARY } from "@/ai/piAgent/monsterGameRequest";
import { emptyIntentDeclaration, type IntentDeclaration } from "@/ai/intentDeclaration";
import { holdWorkerKeys, liveWorkerKeyRings, refreshWorkerKeys } from "../scripts/lib/piWorkerKeys";
import { createWriterTool } from "../scripts/lib/piWriterTool";
import { isolateTimers } from "./mergedTeardown";

// 호스트 실행 중계(scripts/lib/piRunRelay.mjs)의 읽는 이 번호(?reader=) — 이어 받기는 같은 읽는 이의 앞 스트림만 끝낸다.
// 왜(2026-11-11): 본문을 복제해 같이 읽는 시험 구동기가 앞 스트림을 놓지 않아 이어 받기마다 연결 하나가 남았고, 브라우저의 호스트당 연결 6개가 차면
// 저장·적용 응답이 나가지 못해 턴이 끝맺음에서 30분 멈췄다. 번호 없는 읽기(끝난 실행을 따로 읽는 QA 스크립트)·다른 번호의 읽기는 건드리면 안 된다 —
// 편집기의 스트림이 «오류 없이» 닫히면 편집기는 실행이 끝난 줄 안다.
describe("piRunRelayReaders", () => {
  isolateTimers();
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
});

describe("piTeamMessaging", () => {
  isolateTimers();
  function team() {
    const bus = new PiTeamMessaging();
    bus.register("chief", "팀장", null);
    bus.register("outside", "외부", "village");
    bus.register("inside", "실내", "inn");
    return bus;
  }
  describe("team direct messaging", () => {
    it("routes a door negotiation to its recipient, correlates the reply and requires explicit application acknowledgement", () => {
      const bus = team();
      const question = bus.send("outside", "inside", "여관 진입 좌표?", "question");
      expect(bus.read("chief")).toEqual([]);
      expect(() => bus.acknowledge("inside", question.id)).toThrow();
      expect(bus.read("inside")).toMatchObject([{ id: question.id, read: true, acknowledged: false }]);
      expect(bus.read("inside")).toEqual([]);
      const reply = bus.send("inside", "outside", "inn (8,12)", "reply", question.id);
      expect(bus.outstanding()).toHaveLength(1);
      expect(bus.read("outside")).toMatchObject([{ replyTo: question.id }]);
      bus.acknowledge("outside", reply.id);
      expect(bus.unread("inside")).toBe(true);
      expect(bus.sent("inside")[0]).toMatchObject({ id: reply.id, acknowledged: true });
      expect(bus.outstanding()).toEqual([]);
    });
    it("rejects misrouted replies, spoofed acknowledgements, self messages and unavailable recipients", () => {
      const bus = team();
      const question = bus.send("outside", "inside", "문?", "question");
      expect(() => bus.send("chief", "outside", "응", "reply", question.id)).toThrow();
      expect(() => bus.acknowledge("chief", question.id)).toThrow();
      expect(() => bus.send("inside", "inside", "나")).toThrow();
      expect(() => bus.send("inside", "missing", "문")).toThrow();
      bus.close("outside");
      expect(() => bus.send("inside", "outside", "응", "reply", question.id)).toThrow(/unavailable/);
    });
    it("wakes on delivery and distinguishes timeout, cancellation and a closed teammate", async () => {
      const bus = team();
      const waiting = bus.wait("inside");
      bus.send("outside", "inside", "문 옮김");
      expect(await waiting).toBe("messages");
      bus.read("inside");
      expect(await bus.wait("inside", 0)).toBe("timeout");
      const abort = new AbortController();
      const cancelled = bus.wait("inside", 10000, abort.signal);
      abort.abort();
      expect(await cancelled).toBe("aborted");
      const closing = bus.wait("inside");
      bus.close("outside");
      expect(await closing).toBe("team_changed");
    });
    it("isolates runs and bounds payload/history without silently truncating agreements", () => {
      const bus = team();
      expect(() => bus.send("inside", "outside", "x".repeat(4001))).toThrow();
      for (let i = 0; i < 256; i++) bus.send("inside", "outside", `message ${i}`);
      expect(() => bus.send("inside", "outside", "overflow")).toThrow(/budget/);
      expect(team().read("outside")).toEqual([]);
    });
  });
  it("reading or acknowledging a question does not fabricate an answer", () => {
    const bus = team();
    const q = bus.send("outside", "inside", "입구?", "question");
    bus.read("inside");
    bus.acknowledge("inside", q.id);
    expect(bus.outstanding()).toMatchObject([{ id: q.id }]);
  });
});

// Pi 턴이 의도 노트를 싣는가 — 세션 → Pi 이관(2026-09-11)에서 formatIntentNote/formatScopeNote 가 빠져
// 「마을을 만들어달라」의 계획·실행 모델이 author_village·권장 크기를 한 번도 못 봤다(2026-09-17 실측:
// 계획은 도구 이름 없는 산문, 실행은 paint_road 5번으로 16턴 소진). 여기서 본문이 읽는 문자열을 고정한다.
describe("piTurnIntentNote", () => {
  isolateTimers();
  const villageIntent: IntentDeclaration = {
    ...emptyIntentDeclaration(),
    mode: "create",
    space: "outdoor",
    needsPlan: true,
    tools: ["author_village"],
    construction: { scale: "medium" },
    summary: "마을을 만들어달라",
    source: "llm",
  };
  describe("Pi 턴 의도 노트", () => {
    // 마을 시공 노트(author_village·author_house·설계서 houseCount·resize 선행) 사례 10개는 은퇴 —
    // 두 도구가 2026-10-07 저작권 정리로 삭제됐다(toolRegistry CONSTRUCTION_WRITE_SUPERSEDED 주석).

    it("모호한 점은 되묻지 않고 해석을 밝히라고 한다 — Pi 경로에는 되묻는 자리가 없다", () => {
      const note = buildPiIntentNote({ intent: { ...villageIntent, clarify: "어느 맵에?" }, targetMap: null, selection: null });
      expect(note).toContain("모호한 점: 어느 맵에?");
      expect(note).toContain("되묻지 않는다");
    });

    it("폴백 선언은 노트가 없고 지시문은 그대로다", () => {
      const fallback: IntentDeclaration = { ...emptyIntentDeclaration(), source: "fallback" };
      expect(buildPiIntentNote({ intent: fallback, targetMap: null, selection: null })).toBeNull();
      expect(composePiTask("마을을 만들어달라", null)).toBe("마을을 만들어달라");
    });

    it("지시문 뒤에 노트를 붙인다 — 사용자 문장이 먼저, 노트가 뒤", () => {
      const task = composePiTask("마을을 만들어달라", "[의도] 야외 시공");
      expect(task.startsWith("마을을 만들어달라")).toBe(true);
      expect(task).toBe(`마을을 만들어달라${INTENT_NOTE_BOUNDARY}[의도] 야외 시공`);
    });
  });
});

// 긴 Pi 실행 도중 호스트가 갱신한 키가 진행 중인 실행에 들어가는지(2026-10-05 팀 실행 18분 40초째 토큰 만료).
describe("piWorkerKeys", () => {
  isolateTimers();
  describe("워커 요청 키 갱신", () => {
    it("진행 중인 실행의 키 묶음만 갱신하고, 쓰지 않던 제공자는 끼워 넣지 않는다", () => {
      const run = holdWorkerKeys({ "google-antigravity": "old", "openai-codex": undefined }, "google-antigravity", "old");
      expect(refreshWorkerKeys({ "google-antigravity": "new", "anthropic": "x" })).toBe(1);
      expect(run.keys["google-antigravity"]).toBe("new");
      expect("anthropic" in run.keys).toBe(false);
      run.release();
      expect(refreshWorkerKeys({ "google-antigravity": "newer" })).toBe(0);
      expect(run.keys["google-antigravity"]).toBe("new");
    });

    it("providerApiKeys 가 없으면 실행 제공자의 apiKey 로 묶음을 만든다", () => {
      const before = liveWorkerKeyRings();
      const run = holdWorkerKeys(undefined, "google-antigravity", "k1");
      expect(run.keys).toEqual({ "google-antigravity": "k1" });
      expect(liveWorkerKeyRings()).toBe(before + 1);
      refreshWorkerKeys({ "google-antigravity": "k2" });
      expect(run.keys["google-antigravity"]).toBe("k2");
      run.release();
    });
  });
});

describe("piWriterTool", () => {
  isolateTimers();
  const writer = { provider: "openai-codex", model: "chosen-writer", thinkingLevel: "high" as const };
  const response = (finish = "stop") => ({ completion: { choices: [{ finish_reason: finish, message: { content: "어서 오세요, 여행자님." } }] } });
  describe("Writer consultation", () => {
    it("routes prose through the selected writer and returns text without editing", async () => {
      const complete = vi.fn().mockResolvedValue(response());
      const tool = createWriterTool(writer, complete, "writer-test-token");
      const signal = new AbortController().signal;
      expect(await tool.execute("t", { brief: "친절한 여관 주인의 대사" }, signal)).toEqual({ content: [{ type: "text", text: "어서 오세요, 여행자님." }] });
      expect(complete).toHaveBeenCalledWith("openai-codex", expect.objectContaining({ model: "chosen-writer", reasoning: { effort: "high" } }), { apiKey: "writer-test-token", signal });
    });
    it("rejects truncated output, invalid briefs and cancellation", async () => {
      const complete = vi.fn().mockResolvedValue(response("length"));
      const tool = createWriterTool(writer, complete);
      await expect(tool.execute("t", { brief: "대사" })).rejects.toThrow("완료");
      complete.mockClear();
      await expect(tool.execute("t", { brief: "" })).rejects.toThrow("brief");
      await expect(tool.execute("t", { brief: "대사" }, AbortSignal.abort())).rejects.toThrow();
      expect(complete).not.toHaveBeenCalled();
    });
  });
});
