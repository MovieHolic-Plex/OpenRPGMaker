// 바로 깔기 주문 대기열 — 겹치는 영역만 기다리고, 떨어진 영역은 동시에 읽고, 조수 턴 동안에는 깔기를 미룬다.
// 러너는 주입한다(모델·스토어 없음). 러너가 받는 waitForApply 를 실제로 기다려야 게이트 동작이 보인다.
import { afterEach, describe, expect, it } from "vitest";
import {
  createStampOrderQueue,
  formatStampOrderSummary,
  stampOrderRect,
  stampRectsOverlap,
  type StampOrderQueue,
} from "@/editor/stampOrderQueue";
import type { StampRunInput, StampRunResult } from "@/editor/stampPlaceRunner";

interface Pending {
  readonly input: StampRunInput;
  finish(result?: Partial<StampRunResult>): Promise<void>;
}

function harness(options: { readonly concurrency?: number; readonly projectKey?: () => string } = {}) {
  const started: Pending[] = [];
  const applied: string[] = [];
  const queue = createStampOrderQueue({
    concurrency: options.concurrency ?? 3,
    projectKey: options.projectKey ?? (() => "p1"),
    mapSize: (mapId) => (mapId === "m1" || mapId === "m2" ? { width: 20, height: 20 } : undefined),
    run: (input) => new Promise<StampRunResult>((resolve) => {
      started.push({
        input,
        finish: async (result) => {
          // 실제 러너처럼: 모델 계획이 끝나면 적용 차례를 기다린 뒤 깐다.
          await input.waitForApply?.();
          if (input.signal?.aborted) {
            resolve({ ok: false, lines: ["바로 깔기를 중단했습니다."], applied: 0, usedModel: true });
            return;
          }
          applied.push(input.text);
          resolve({ ok: true, lines: [input.text + " 깔림"], applied: 1, usedModel: true, ...result });
        },
      });
    }),
  });
  return { queue, started, applied };
}

const sel = (x: number, y: number, width = 4, height = 4, mapId = "m1") => ({ mapId, x, y, width, height });
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

let live: StampOrderQueue | null = null;
afterEach(() => {
  live?.dispose();
  live = null;
});

describe("stampOrderRect / overlap", () => {
  it("clips the selection to the map and falls back to the whole map", () => {
    expect(stampOrderRect({ width: 10, height: 10 }, "m1", sel(8, 8, 5, 5))).toEqual({ x: 8, y: 8, w: 2, h: 2 });
    expect(stampOrderRect({ width: 10, height: 10 }, "m1", null)).toEqual({ x: 0, y: 0, w: 10, h: 10 });
    expect(stampOrderRect({ width: 10, height: 10 }, "m1", sel(0, 0, 3, 3, "other"))).toEqual({ x: 0, y: 0, w: 10, h: 10 });
  });

  it("treats touching edges as separate", () => {
    expect(stampRectsOverlap({ x: 0, y: 0, w: 4, h: 4 }, { x: 4, y: 0, w: 4, h: 4 })).toBe(false);
    expect(stampRectsOverlap({ x: 0, y: 0, w: 4, h: 4 }, { x: 3, y: 3, w: 4, h: 4 })).toBe(true);
  });
});

describe("createStampOrderQueue", () => {
  it("runs separate regions at the same time and holds an overlapping one", async () => {
    const h = harness();
    live = h.queue;
    const a = h.queue.enqueue({ text: "숲", mapId: "m1", selection: sel(0, 0) })!;
    const b = h.queue.enqueue({ text: "연못", mapId: "m1", selection: sel(10, 10) })!;
    const c = h.queue.enqueue({ text: "길", mapId: "m1", selection: sel(2, 2) })!;
    expect(h.started.map((p) => p.input.text)).toEqual(["숲", "연못"]);
    expect(c.status).toBe("waiting");
    expect(c.wait).toBe("overlap");
    expect(c.blockedBy).toBe(a.id);
    expect(h.queue.summary()).toEqual({ waiting: 1, running: 2, total: 3 });

    await h.started[1]!.finish();
    await flush();
    expect(b.status).toBe("done");
    expect(c.status).toBe("waiting"); // 연못은 길과 겹치지 않는다 — 숲이 끝나야 길이 선다.

    await h.started[0]!.finish();
    await flush();
    expect(a.status).toBe("done");
    expect(c.status).toBe("planning");
    expect(h.started.map((p) => p.input.text)).toEqual(["숲", "연못", "길"]);
  });

  it("does not treat the same rect on another map as an overlap", () => {
    const h = harness();
    live = h.queue;
    h.queue.enqueue({ text: "숲", mapId: "m1", selection: sel(0, 0) });
    h.queue.enqueue({ text: "숲", mapId: "m2", selection: sel(0, 0, 4, 4, "m2") });
    expect(h.started).toHaveLength(2);
  });

  it("a whole-map order waits for every order on that map", () => {
    const h = harness();
    live = h.queue;
    h.queue.enqueue({ text: "숲", mapId: "m1", selection: sel(15, 15) });
    const whole = h.queue.enqueue({ text: "알아서", mapId: "m1", selection: null })!;
    expect(whole.wait).toBe("overlap");
    expect(h.started).toHaveLength(1);
  });

  it("caps concurrent orders and marks the rest as capacity waits", async () => {
    const h = harness({ concurrency: 2 });
    live = h.queue;
    h.queue.enqueue({ text: "a", mapId: "m1", selection: sel(0, 0, 2, 2) });
    h.queue.enqueue({ text: "b", mapId: "m1", selection: sel(5, 0, 2, 2) });
    const c = h.queue.enqueue({ text: "c", mapId: "m1", selection: sel(10, 0, 2, 2) })!;
    expect(h.started).toHaveLength(2);
    expect(c.wait).toBe("capacity");
    await h.started[0]!.finish();
    await flush();
    expect(c.status).toBe("planning");
  });

  it("holds the apply while a chat turn runs and releases it on poke", async () => {
    let chatBusy = true;
    const h = harness();
    live = h.queue;
    h.queue.setChatBusyProbe(() => chatBusy);
    const order = h.queue.enqueue({ text: "숲", mapId: "m1", selection: sel(0, 0) })!;
    const done = h.started[0]!.finish();
    await flush();
    expect(order.status).toBe("applying");
    expect(order.wait).toBe("chat");
    expect(h.applied).toEqual([]);
    chatBusy = false;
    h.queue.pokeGate();
    await done;
    await flush();
    expect(h.applied).toEqual(["숲"]);
    expect(order.status).toBe("done");
  });

  it("aborts an order whose project was replaced before its apply", async () => {
    let key = "p1";
    const h = harness({ projectKey: () => key });
    live = h.queue;
    const order = h.queue.enqueue({ text: "숲", mapId: "m1", selection: sel(0, 0) })!;
    key = "p2";
    await h.started[0]!.finish();
    await flush();
    expect(h.applied).toEqual([]);
    expect(order.status).toBe("aborted");
  });

  it("cancelAll drops waiting orders without starting them", async () => {
    const h = harness();
    live = h.queue;
    const a = h.queue.enqueue({ text: "숲", mapId: "m1", selection: sel(0, 0) })!;
    const b = h.queue.enqueue({ text: "길", mapId: "m1", selection: sel(1, 1) })!;
    expect(h.queue.cancelAll()).toBe(2);
    await h.started[0]!.finish();
    await flush();
    expect(a.status).toBe("aborted");
    expect(b.status).toBe("aborted");
    expect(h.started).toHaveLength(1);
    expect(h.queue.active()).toBe(false);
  });

  it("reports each finished order once", async () => {
    const h = harness();
    live = h.queue;
    h.queue.enqueue({ text: "숲", mapId: "m1", selection: sel(0, 0) });
    await h.started[0]!.finish();
    await flush();
    expect(h.queue.takeUnreported().map((o) => o.lines)).toEqual([["숲 깔림"]]);
    expect(h.queue.takeUnreported()).toEqual([]);
  });

  it("rejects an unknown map", () => {
    const h = harness();
    live = h.queue;
    expect(h.queue.enqueue({ text: "숲", mapId: "nope", selection: null })).toBeNull();
  });
});

describe("formatStampOrderSummary", () => {
  it("is empty when nothing runs", () => {
    expect(formatStampOrderSummary({ waiting: 0, running: 0, total: 0 })).toBe("");
    expect(formatStampOrderSummary({ waiting: 2, running: 3, total: 5 })).toBe("바로 깔기 3개 진행 · 2개 대기");
  });
});

