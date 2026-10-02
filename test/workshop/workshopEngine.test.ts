// test/workshop/workshopEngine.test.ts
import { describe, expect, it } from "vitest";
import { createWorkshopEngine } from "@/harnesses/_core/workshop/engine";
import { makePalette } from "@/harnesses/_core/workshop/grid";
import { createMemoryWorkshopStore } from "@/harnesses/_core/workshop/store";
import type { ChatFn, DrawContext, Verdict, WorkshopItem, WorkshopRunner, WorkshopSurface } from "@/harnesses/_core/workshop/types";

const palette = makePalette([{ key: "k", rgba: [0, 0, 0, 255] }]);
const item: WorkshopItem = { key: "box", title: "상자", description: "", kind: "floor", category: "c", width: 2, height: 2, padTop: 0, isNew: false, refs: [], use: [] };
const GOOD = '{"legend":{"a":"k"},"rows":["aa","aa"],"note":"ok","topRows":3}';
const WRONG_SIZE = '{"legend":{"a":"k"},"rows":["a"]}';
const pass = '{"verdict":"PASS","codes":[],"top":"윗판 3행","top_rows":3,"reasons":"","fix":"","worse":false}';
const failVerdict = '{"verdict":"FAIL","codes":["FRONT"],"top":"윗판 1행","top_rows":1,"reasons":"납작","fix":"윗판을 3행으로","worse":false}';

function fakeRunner(seen: DrawContext[] = []): WorkshopRunner {
  return {
    harnessId: "fake", candidates: 2,
    prepare: async () => {},
    items: () => [item],
    palette: () => palette,
    currentGrid: () => null,
    directions: () => [{ letter: "A", text: "가" }, { letter: "B", text: "나" }],
    anchors: () => [],
    drawMessages: async (ctx) => { seen.push(ctx); return [{ role: "user", content: `draw ${ctx.direction.letter} ${ctx.attempt}` }]; },
    selfCheckMessage: () => ({ role: "user", content: "check" }),
    reviewMessages: async () => [{ role: "user", content: "review" }],
    hardCheck: (_item, grid) => (grid.width === 2 && grid.height === 2 ? [] : ["크기"]),
    parseVerdict: (text) => {
      const raw = JSON.parse(text);
      return { verdict: raw.verdict, codes: raw.codes, top: raw.top, topRows: raw.top_rows, reasons: raw.reasons, fix: raw.fix, worse: raw.worse } as Verdict;
    },
    gate: (_item, verdict) => verdict,
  };
}

/** surface·편지별로 답을 차례대로 낸다. 남은 답이 없으면 기본값. */
function scriptedChat(script: Partial<Record<string, string[]>>, log: string[] = []): ChatFn {
  return async (surface: WorkshopSurface, request) => {
    const first = request.messages[0]?.content;
    const letter = typeof first === "string" ? (first.split(" ")[1] ?? "") : "";
    const key = `${surface}:${letter}`;
    log.push(key);
    const queue = script[key] ?? script[surface];
    const next = queue?.shift();
    return next ?? (surface === "workshop-draw" ? GOOD : pass);
  };
}

const engineWith = (chat: ChatFn, runner = fakeRunner(), store = createMemoryWorkshopStore()) =>
  ({ store, engine: createWorkshopEngine({ runner, env: { loadImage: async () => ({ width: 0, height: 0, data: new Uint8ClampedArray() }), encodePng: () => "data:", assetUrl: (p) => p }, chat, store, projectKey: "p", sleep: async () => {}, now: () => 1000 }) });

describe("공방 엔진", () => {
  it("그리기 → 자기 점검 → 검수 PASS 면 장이 done, 호출 3번", async () => {
    const { engine, store } = engineWith(scriptedChat({}));
    const round = await engine.startRound(item);
    await engine.idle();
    const saved = (await store.getRound(round.id))!;
    expect(saved.runs.map((r) => [r.letter, r.status, r.attempt, r.calls, r.verdict?.verdict])).toEqual([["A", "done", 1, 3, "PASS"], ["B", "done", 1, 3, "PASS"]]);
    expect(saved.runs[0].grid).toEqual({ width: 2, height: 2, cells: ["k", "k", "k", "k"] });
  });

  it("onStatus 는 마지막 실행이 running 에서 빠진 뒤에 불린다", async () => {
    const store = createMemoryWorkshopStore();
    const runningAtStatus: number[] = [];
    let engineRef: ReturnType<typeof createWorkshopEngine> | null = null;
    const engine = createWorkshopEngine({
      runner: fakeRunner(), env: { loadImage: async () => ({ width: 0, height: 0, data: new Uint8ClampedArray() }), encodePng: () => "data:", assetUrl: (p) => p },
      chat: scriptedChat({}), store, projectKey: "p", sleep: async () => {}, now: () => 1000,
      onStatus: () => { runningAtStatus.push(engineRef!.status().running); },
    });
    engineRef = engine;
    await engine.startRound(item);
    await engine.idle();
    expect(runningAtStatus.length).toBeGreaterThan(0);
    expect(runningAtStatus[runningAtStatus.length - 1]).toBe(0);
  });

  it("검수 FAIL 이면 판정을 들고 다시 그린다", async () => {
    const seen: DrawContext[] = [];
    const { engine, store } = engineWith(scriptedChat({ "workshop-review": [failVerdict] }), fakeRunner(seen));
    const round = await engine.startRound(item);
    await engine.idle();
    const runs = (await store.getRound(round.id))!.runs;
    const redrawn = runs.find((r) => r.attempt === 2)!;
    expect(redrawn.status).toBe("done");
    expect(redrawn.attempts.map((a) => a.verdict?.verdict)).toEqual(["FAIL", "PASS"]);
    expect(seen.find((c) => c.attempt === 2)?.lastVerdict?.fix).toBe("윗판을 3행으로");
  });

  it("깨진 답은 같은 대화로 고치게 하고, 고치면 계속한다", async () => {
    const log: string[] = [];
    const { engine, store } = engineWith(scriptedChat({ "workshop-draw:A": [WRONG_SIZE] }, log));
    const round = await engine.startRound(item);
    await engine.idle();
    const a = (await store.getRound(round.id))!.runs[0];
    expect(a.status).toBe("done");
    expect(a.calls).toBe(4);
  });

  it("세 번 다 검수 불통과여도 장은 done(불통과 표시)", async () => {
    const { engine, store } = engineWith(scriptedChat({ "workshop-review": Array(6).fill(failVerdict) }));
    const round = await engine.startRound(item);
    await engine.idle();
    const runs = (await store.getRound(round.id))!.runs;
    expect(runs.map((r) => [r.status, r.attempt, r.verdict?.verdict])).toEqual([["done", 3, "FAIL"], ["done", 3, "FAIL"]]);
  });

  it("고칠 기회를 다 써도 깨진 답이면 마지막 시도 뒤 failed", async () => {
    const { engine, store } = engineWith(scriptedChat({ "workshop-draw:A": Array(20).fill(WRONG_SIZE) }));
    const round = await engine.startRound(item);
    await engine.idle();
    const a = (await store.getRound(round.id))!.runs[0];
    expect(a.status).toBe("failed");
    expect(a.error).toContain("크기");
  });

  it("429 는 동시 수를 줄이고 같은 호출을 다시 한다", async () => {
    let first = true;
    const chat: ChatFn = async (surface) => {
      if (first) { first = false; throw Object.assign(new Error("too many"), { status: 429 }); }
      return surface === "workshop-draw" ? GOOD : pass;
    };
    const { engine, store } = engineWith(chat);
    engine.setConcurrency(3);
    const round = await engine.startRound(item);
    await engine.idle();
    expect(engine.status().concurrency).toBe(2);
    expect((await store.getRound(round.id))!.runs.every((r) => r.status === "done")).toBe(true);
  });

  it("401 이면 그 장은 failed, 엔진은 막힘 표시", async () => {
    const chat: ChatFn = async () => { throw Object.assign(new Error("unauthorized"), { status: 401 }); };
    const { engine, store } = engineWith(chat);
    engine.setConcurrency(1);
    const round = await engine.startRound(item);
    await engine.idle();
    expect(engine.status().blocked).toContain("AI 설정");
    const runs = (await store.getRound(round.id))!.runs;
    expect(runs[0].status).toBe("failed");
    expect(runs[1].status).toBe("queued");
  });

  it("취소하면 대기·진행 중인 장이 cancelled", async () => {
    let release: () => void = () => {};
    const chat: ChatFn = (_surface, request) => new Promise((resolve, reject) => {
      release = () => resolve(GOOD);
      request.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    });
    const { engine, store } = engineWith(chat);
    engine.setConcurrency(1);
    const round = await engine.startRound(item);
    await engine.cancelRound(round.id);
    release();
    await engine.idle();
    expect((await store.getRound(round.id))!.runs.map((r) => r.status)).toEqual(["cancelled", "cancelled"]);
  });

  it("재개: 저장소에 남은 drawing 장을 다시 돌린다", async () => {
    const store = createMemoryWorkshopStore();
    await store.putRound({
      id: "r9", projectKey: "p", harnessId: "fake", itemKey: "box", note: "", created: 1,
      runs: [{ letter: "A", direction: "가", status: "drawing", attempt: 1, attempts: [{ attempt: 1, hard: [], verdict: null, grid: null }], grid: null, note: "", topRows: null, verdict: null, error: null, calls: 1, redrawNote: "", startedAt: 1, finishedAt: null }],
    });
    const { engine } = engineWith(scriptedChat({}), fakeRunner(), store);
    expect(await engine.resume()).toBe(1);
    await engine.idle();
    const resumed = (await store.getRound("r9"))!.runs[0];
    expect(resumed.status).toBe("done");
    expect(resumed.attempts.map((a) => a.attempt)).toEqual([1]);
  });

  it("redrawRun 은 한 장만 메모를 붙여 처음부터 다시 그린다", async () => {
    const seen: DrawContext[] = [];
    const { engine, store } = engineWith(scriptedChat({}), fakeRunner(seen));
    const round = await engine.startRound(item);
    await engine.idle();
    await engine.redrawRun(round.id, "B", "더 밝게");
    await engine.idle();
    const b = (await store.getRound(round.id))!.runs[1];
    expect(b.status).toBe("done");
    expect(b.redrawNote).toBe("더 밝게");
    expect(seen.at(-1)?.redrawNote).toBe("더 밝게");
    expect(seen.at(-1)?.previousGrid).not.toBeNull();
  });

  it("redrawRun 은 같은 글자가 진행 중이면 아무것도 하지 않는다", async () => {
    let open: () => void = () => {};
    const gate = new Promise<void>((resolve) => { open = resolve; });
    const drawA: string[] = [];
    const chat: ChatFn = async (surface, request) => {
      const first = request.messages[0]?.content;
      if (surface === "workshop-draw" && typeof first === "string" && first.startsWith("draw A")) drawA.push(first);
      await gate;
      return surface === "workshop-draw" ? GOOD : pass;
    };
    const { engine, store } = engineWith(chat);
    const round = await engine.startRound(item);
    expect(engine.status().running).toBe(2);
    await engine.redrawRun(round.id, "A", "또");
    expect(engine.status()).toMatchObject({ running: 2, queued: 0 });
    open();
    await engine.idle();
    const runs = (await store.getRound(round.id))!.runs;
    expect(runs.map((r) => r.status)).toEqual(["done", "done"]);
    expect(runs[0].redrawNote).toBe("");
    expect(drawA).toHaveLength(2);
  });

  it("검수 답을 못 읽으면 그 시도는 불통과로 적고 다음 시도로 간다", async () => {
    const { engine, store } = engineWith(scriptedChat({ "workshop-review": ["not json"] }));
    const round = await engine.startRound(item);
    await engine.idle();
    const runs = (await store.getRound(round.id))!.runs;
    expect(runs.every((r) => r.status === "done" && r.verdict?.verdict === "PASS")).toBe(true);
    const retried = runs.find((r) => r.attempt === 2)!;
    expect(retried.attempts[0].verdict?.codes).toEqual(["READ"]);
    expect(retried.attempts.map((a) => a.verdict?.verdict)).toEqual(["FAIL", "PASS"]);
  });
});
