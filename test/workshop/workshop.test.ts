import { describe, expect, it } from "vitest";
import { createWorkshopEngine, runErrorKind } from "@/harnesses/_core/workshop/engine";
import { makePalette, collectOpaqueColors, gridToAnswer, imageToGrid, onBackground, opaqueBounds, parseDrawAnswer, renderGrid, scaleImage, repairStringExpressions, rowsNeedingFix, applyRowFix } from "@/harnesses/_core/workshop/grid";
import { createMemoryWorkshopStore, openWorkshopStore, type WorkshopStore } from "@/harnesses/_core/workshop/store";
import type { ChatFn, DrawContext, Verdict, WorkshopItem, WorkshopRunner, WorkshopSurface, WorkshopRound, WorkshopRun } from "@/harnesses/_core/workshop/types";
import { blockedRun, countdownText, isAccountPause, jobEtaMs, jobProgress, jobState, networkBackoffMs, pauseFor, pauseLine, rateBackoffMs, resetsInMs, retryText, type WorkshopJob } from "@/editor/workshop/queue/jobModel";
import { IDBFactory } from "fake-indexeddb";
import "fake-indexeddb/auto";
import { isolateTimers } from "../mergedTeardown";

// test/workshop/workshopEngine.test.ts
describe("workshopEngine", () => {
  isolateTimers();
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

    it("자기 점검이 없는 실행기는 그리기 → 검수, 호출 2번", async () => {
      const runner = fakeRunner();
      delete (runner as { selfCheckMessage?: unknown }).selfCheckMessage;
      const { engine, store } = engineWith(scriptedChat({}), runner);
      const round = await engine.startRound(item);
      await engine.idle();
      expect((await store.getRound(round.id))!.runs.map((r) => [r.status, r.calls])).toEqual([["done", 2], ["done", 2]]);
    });

    it("폭이 틀린 줄만 있으면 그 줄만 다시 받는다(전체 격자를 다시 받지 않는다)", async () => {
      const runner = fakeRunner();
      delete (runner as { selfCheckMessage?: unknown }).selfCheckMessage;
      const asks: string[] = [];
      const chat: ChatFn = async (surface, request) => {
        if (surface === "workshop-review") return pass;
        const last = request.messages[request.messages.length - 1]?.content;
        asks.push(typeof last === "string" ? last : "");
        if (asks.length === 1) return '{"legend":{"a":"k"},"rows":["aa","aaa"]}';
        return '{"rows":{"1":"aa"}}';
      };
      const { engine, store } = engineWith(chat, { ...runner, candidates: 1, directions: () => [{ letter: "A", text: "가" }] });
      const round = await engine.startRound(item);
      await engine.idle();
      const a = (await store.getRound(round.id))!.runs[0];
      expect([a.status, a.calls]).toEqual(["done", 3]);
      expect(asks[1]).toContain("줄 1(3글자)");
      expect(a.grid).toEqual({ width: 2, height: 2, cells: ["k", "k", "k", "k"] });
    });
  });
});

describe("workshopGrid", () => {
  isolateTimers();
  const palette = makePalette([
    { key: "wood:2", rgba: [99, 49, 11, 255] },
    { key: "wood:6", rgba: [183, 114, 70, 255] },
    { key: "shadow:0", rgba: [28, 20, 24, 110] },
  ]);
  describe("parseDrawAnswer", () => {
    it("코드 펜스와 앞뒤 글을 걸러 격자를 읽는다", () => {
      const text = '좋아요.\n```json\n{"legend":{"a":"wood:2","b":"wood:6"},"rows":["ab.","..a"],"note":"윗판 3행","topRows":3}\n```\n끝';
      const parsed = parseDrawAnswer(text, palette);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      expect(parsed.grid).toEqual({ width: 3, height: 2, cells: ["wood:2", "wood:6", null, null, null, "wood:2"] });
      expect(parsed.note).toBe("윗판 3행");
      expect(parsed.topRows).toBe(3);
    });
    it("팔레트 밖 색·legend 에 없는 글자·길이가 다른 줄을 이유와 함께 거절한다", () => {
      expect(parseDrawAnswer('{"legend":{"a":"gold:9"},"rows":["a"]}', palette)).toEqual({ ok: false, error: expect.stringContaining("gold:9") });
      expect(parseDrawAnswer('{"legend":{"a":"wood:2"},"rows":["ax"]}', palette)).toEqual({ ok: false, error: expect.stringContaining("「x」") });
      expect(parseDrawAnswer('{"legend":{"a":"wood:2"},"rows":["aa","a"]}', palette)).toEqual({ ok: false, error: expect.stringContaining("rows[1]") });
      expect(parseDrawAnswer('{"legend":{".":"wood:2"},"rows":["."]}', palette)).toEqual({ ok: false, error: expect.stringContaining("투명") });
      expect(parseDrawAnswer("그림을 못 그렸어요", palette)).toEqual({ ok: false, error: expect.stringContaining("JSON") });
    });
  });
  describe("격자 ↔ 그림", () => {
    const grid = { width: 2, height: 2, cells: ["wood:2", null, "shadow:0", "wood:6"] };
    it("renderGrid 는 팔레트 색을 그대로, 투명은 0 으로 쓴다", () => {
      const image = renderGrid(grid, palette);
      expect([...image.data.slice(0, 8)]).toEqual([99, 49, 11, 255, 0, 0, 0, 0]);
      expect([...image.data.slice(8, 12)]).toEqual([28, 20, 24, 110]);
    });
    it("imageToGrid 는 renderGrid 의 역이고 모르는 색을 따로 돌려준다", () => {
      expect(imageToGrid(renderGrid(grid, palette), palette)).toEqual({ grid, unknown: [] });
      const odd = renderGrid(grid, palette);
      odd.data.set([1, 2, 3, 255], 4);
      expect(imageToGrid(odd, palette).unknown).toEqual(["#010203"]);
    });
    it("gridToAnswer 는 parseDrawAnswer 로 그대로 되읽힌다", () => {
      const parsed = parseDrawAnswer(JSON.stringify(gridToAnswer(grid)), palette);
      expect(parsed.ok && parsed.grid).toEqual(grid);
    });
    it("scaleImage·onBackground·opaqueBounds·collectOpaqueColors", () => {
      const image = renderGrid(grid, palette);
      const big = scaleImage(image, 3);
      expect([big.width, big.height]).toEqual([6, 6]);
      expect([...big.data.slice((5 * 6 + 5) * 4, (5 * 6 + 5) * 4 + 4)]).toEqual([183, 114, 70, 255]);
      const bg = onBackground(image, [150, 120, 90, 255]);
      expect([...bg.data.slice(4, 8)]).toEqual([150, 120, 90, 255]);
      expect(opaqueBounds(image)).toEqual({ x0: 0, y0: 0, x1: 1, y1: 1 });
      expect(collectOpaqueColors(image).length).toBe(3);
    });
  });
  describe("모델 답 수선(2026-10-07 실측 꼴)", () => {
    it("JSON 안에 남긴 .replace·[a:b]·if False else 를 값으로 풀어 읽는다", () => {
      const sliced = '{"legend":{"a":"wood:2"},"rows":["aaa"[0:2],"a."]}';
      expect(parseDrawAnswer(sliced, palette)).toMatchObject({ ok: true, grid: { width: 2, height: 2 } });
      const replaced = '{"legend":{"a":"wood:2"},"rows":["aа".replace("а","a"),"a."]}';
      expect(parseDrawAnswer(replaced, palette)).toMatchObject({ ok: true, grid: { cells: ["wood:2", "wood:2", "wood:2", null] } });
      const conditional = '{"legend":{"a":"wood:2"},"rows":["aaa"[0:2] if False else "a.","aa"]}';
      expect(parseDrawAnswer(conditional, palette)).toMatchObject({ ok: true, grid: { cells: ["wood:2", null, "wood:2", "wood:2"] } });
      expect(repairStringExpressions('{"a":"x\\"y"}')).toBe('{"a":"x\\"y"}');
    });
    it("[0:0] 으로 지운 빈 줄은 뺀다", () => {
      expect(parseDrawAnswer('{"legend":{"a":"wood:2"},"rows":["aa","aa"[0:0],"a."]}', palette)).toMatchObject({ ok: true, grid: { height: 2 } });
    });
    it("키릴 「о」는 legend 의 라틴 「o」로 읽고, 그 밖의 깨진 JSON 은 그대로 거절한다", () => {
      expect(parseDrawAnswer('{"legend":{"o":"wood:2"},"rows":["oо"]}', palette)).toMatchObject({ ok: true, grid: { cells: ["wood:2", "wood:2"] } });
      expect(parseDrawAnswer('{"legend":{"a":"wood:2"},"rows":["a." "a"]}', palette).ok).toBe(false);
    });
    it("폭이 틀린 줄만 골라 다시 받고 덮어 쓴다", () => {
      const text = '{"legend":{"a":"wood:2"},"rows":["aa","aaa","a."],"note":"n"}';
      expect(rowsNeedingFix(text, 2, 3)).toEqual({ rows: ["aa", "aaa", "a."], bad: [1] });
      expect(rowsNeedingFix(text, 2, 4)).toBeNull();
      const patched = applyRowFix(text, '고친 줄: {"rows":{"1":".a"}}')!;
      expect(parseDrawAnswer(patched, palette)).toMatchObject({ ok: true, note: "n", grid: { cells: ["wood:2", "wood:2", null, "wood:2", "wood:2", null] } });
      expect(applyRowFix(text, '{"rows":{"9":"aa"}}')).toBeNull();
    });
  });
});

describe("workshopJobModel", () => {
  isolateTimers();
  const run = (status: WorkshopRun["status"], extra: Partial<WorkshopRun> = {}): WorkshopRun => ({
    letter: "A", direction: "", status, attempt: status === "drawing" ? 1 : 0, attempts: [], grid: null, note: "", topRows: null, verdict: null,
    error: null, errorKind: null, calls: 0, redrawNote: "", startedAt: null, finishedAt: null, ...extra,
  } as WorkshopRun);
  const round = (runs: WorkshopRun[]): WorkshopRound => ({ id: "r1", itemKey: "new:x", runs } as unknown as WorkshopRound);
  const job = (extra: Partial<WorkshopJob> = {}): WorkshopJob => ({
    id: "j1", projectKey: "p", generator: "object-gen", source: "workshop", title: "x", createdAt: 0, harnessId: "map-objects", itemKey: "new:x",
    roundId: "r1", startedAt: 0, finishedAt: null, pause: null, cancelled: false, installWait: null, installed: null, error: null, calls: 0, timeline: [], ...extra,
  });
  describe("workshop job model", () => {
    it("reads the visible state from the round", () => {
      expect(jobState(job({ roundId: null }), null)).toBe("queued");
      expect(jobState(job(), round([run("drawing"), run("queued")]))).toBe("drawing");
      // 참고 그림 단계: 장은 그리는 중이지만 첫 시도 전, reference 없음
      expect(jobState(job(), round([run("drawing", { attempt: 0 }), run("drawing", { attempt: 0 })]))).toBe("reference");
      expect(jobState(job(), { ...round([run("drawing", { attempt: 0 })]), reference: { status: "ok", tries: 1 } } as never)).toBe("drawing");
      expect(jobState(job(), round([run("reviewing"), run("done")]))).toBe("review");
      expect(jobState(job(), round([run("done", { grid: { width: 1, height: 1, cells: [0] } as never }), run("failed")]))).toBe("ready");
      expect(jobState(job(), round([run("failed"), run("failed")]))).toBe("failed");
      expect(jobState(job({ pause: { kind: "quota", reason: "계정 사용 한도", until: 1, at: 0 } }), round([run("failed")]))).toBe("paused");
      expect(jobState(job({ cancelled: true }), null)).toBe("cancelled");
      expect(jobState(job({ generator: "char-gen", pack: { folder: "f", manifest: {} } }), null)).toBe("ready");
    });

    it("estimates progress and time left", () => {
      const r = round([run("done"), run("reviewing"), run("drawing")]);
      expect(jobProgress(job(), r)).toBeGreaterThan(0.5);
      expect(jobEtaMs(job({ startedAt: 0 }), r, { now: 60_000, averageMs: 120_000, queuePosition: 0, limit: 10 })).toBeGreaterThan(0);
      expect(jobEtaMs(job({ roundId: null, startedAt: null }), null, { now: 0, averageMs: 120_000, queuePosition: 12, limit: 10 })).toBe(240_000);
    });

    it("classifies blocked runs, including network drops", () => {
      expect(blockedRun(run("failed", { errorKind: "quota" }))).toBe("quota");
      expect(blockedRun(run("failed", { error: "네트워크 오류: LLM 엔드포인트에 연결할 수 없습니다(/v1). Failed to fetch" }))).toBe("network");
      expect(blockedRun(run("failed", { error: "JSON 을 읽지 못했다" }))).toBeNull();
      expect(blockedRun(run("done"))).toBeNull();
      expect(isAccountPause("network")).toBe(false);
      expect(isAccountPause("quota")).toBe(true);
    });

    it("maps provider errors to kinds", () => {
      expect(runErrorKind(Object.assign(new Error("Individual quota reached (RESOURCE_EXHAUSTED). Resets in 0h2m"), { status: 429 }))).toBe("quota");
      expect(runErrorKind(Object.assign(new Error("expired"), { status: 401 }))).toBe("auth");
      expect(runErrorKind(new Error("boom"))).toBeNull();
    });

    it("reads reset hints in both provider and engine wording", () => {
      expect(resetsInMs("Resets in 61h28m")).toBe((61 * 60 + 28) * 60_000);
      expect(resetsInMs("계정 사용 한도 소진 · 약 2분 뒤 풀림")).toBe(120_000);
      expect(resetsInMs("계정 사용 한도 소진 · 약 3시간 뒤 풀림")).toBe(3 * 3_600_000);
      expect(resetsInMs("nothing")).toBeNull();
    });

    it("backs off and words pauses", () => {
      expect(rateBackoffMs(1)).toBe(120_000);
      expect(rateBackoffMs(10)).toBe(30 * 60_000);
      expect(networkBackoffMs(1)).toBe(20_000);
      expect(networkBackoffMs(10)).toBe(5 * 60_000);
      expect(pauseFor("quota", "Resets in 0h2m", 0, 1).until).toBe(120_000);
      expect(pauseFor("auth", "", 0, 1).until).toBeNull();
      expect(pauseLine(pauseFor("network", "", 0, 1), 0)).toBe("연결이 끊김 · 20초 뒤 다시 시도");
      expect(retryText(749_000)).toBe("12분 29초 뒤 다시 시도");
      expect(retryText(3 * 3_600_000 + 5 * 60_000)).toBe("3시간 5분 뒤 다시 시도");
      expect(retryText(0)).toBe("곧 다시 시도");
      expect(countdownText(3_725_000)).toBe("1:02:05");
    });
  });
});

describe("workshopStore", () => {
  isolateTimers();
  const round = (id: string, projectKey: string, itemKey = "bookshelf"): WorkshopRound => ({
    id, projectKey, harnessId: "interior-props", itemKey, note: "", created: 1, runs: [],
  });
  async function exercise(store: WorkshopStore): Promise<void> {
    await store.putRound(round("r1", "local:A::m1"));
    await store.putRound(round("r2", "local:B::m1"));
    await store.putRound({ ...round("r1", "local:A::m1"), note: "다시" });
    expect((await store.listRounds("local:A::m1")).map((r) => [r.id, r.note])).toEqual([["r1", "다시"]]);
    expect((await store.getRound("r2"))?.projectKey).toBe("local:B::m1");
    await store.deleteRound("r2");
    expect(await store.getRound("r2")).toBeNull();

    await store.putPick({ projectKey: "local:A::m1", itemKey: "bookshelf", roundId: "r1", letter: "C", at: 5 });
    await store.putPick({ projectKey: "local:A::m1", itemKey: "bookshelf", roundId: "r1", letter: "D", at: 6 });
    expect((await store.listPicks("local:A::m1")).map((p) => p.letter)).toEqual(["D"]);
    await store.deletePick("local:A::m1", "bookshelf");
    expect(await store.listPicks("local:A::m1")).toEqual([]);

    await store.addFeedback({ id: "f1", projectKey: "local:A::m1", itemKey: "bookshelf", roundId: "r1", letter: "A", verdict: "reject", reasons: ["view"], note: "", at: 1 });
    await store.addFeedback({ id: "f2", projectKey: "local:A::m1", itemKey: "stool", roundId: "r3", letter: null, verdict: "reject", reasons: [], note: "", at: 2 });
    expect((await store.listFeedback("local:A::m1", "bookshelf")).map((f) => f.id)).toEqual(["f1"]);
    expect((await store.listFeedback("local:A::m1")).length).toBe(2);

    const def = { key: "new:herb-rack", title: "약초 걸이", description: "말린 약초", tilesW: 1, tilesH: 1, rise: 16, kind: "wall", category: "약방", use: [], refs: [] };
    await store.putItemDef("local:A::m1", def);
    expect(await store.listItemDefs("local:A::m1")).toEqual([def]);
    expect(await store.listItemDefs("local:B::m1")).toEqual([]);
  }
  describe("공방 저장소", () => {
    it("IndexedDB: 프로젝트 범위로 판·고른 것·버린 이유·새 기물을 나눠 둔다", async () => {
      const store = await openWorkshopStore(new IDBFactory());
      expect(store.backend).toBe("indexeddb");
      await exercise(store);
    });
    it("메모리 폴백도 같은 계약을 지킨다", async () => {
      const store = createMemoryWorkshopStore();
      expect(store.backend).toBe("memory");
      await exercise(store);
    });
    it("factory 가 없으면 메모리로 산다", async () => {
      expect((await openWorkshopStore(null)).backend).toBe("memory");
    });
    it("메모리 저장소는 넣은 객체를 복사한다(나중에 고쳐도 저장본이 안 바뀐다)", async () => {
      const store = createMemoryWorkshopStore();
      const r = round("r1", "p");
      await store.putRound(r);
      r.runs.push({} as never);
      expect((await store.getRound("r1"))?.runs).toEqual([]);
    });
  });
});
