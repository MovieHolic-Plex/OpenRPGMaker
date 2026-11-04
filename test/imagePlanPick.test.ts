import { describe, expect, it } from "vitest";
import type { ImagePlanRead } from "@/ai/imagePlan";
import { meetsBar, parsePlanJudge, pickBest, readYield } from "@/ai/imagePlanPick";

const village = (houses: number, extra: Record<string, unknown> = {}): ImagePlanRead => ({
  subject: "village", cols: 24, rows: 18,
  data: { gather: { x: 5, y: 5 }, landmark: { x: 3, y: 2 }, houses: Array.from({ length: houses }, (_, i) => ({ x: i, y: 4 })), ...extra },
});

describe("imagePlanPick", () => {
  it("counts builder inputs a read yields and 0 for no read", () => {
    expect(readYield(null)).toBe(0);
    expect(readYield(village(4))).toBe(6);
    expect(readYield({ subject: "dungeon", cols: 24, rows: 16, data: { rooms: [{}, {}, {}], links: [[0, 1], [1, 2]] } })).toBe(5);
  });

  it("parses a judge answer and rejects a missing candidate", () => {
    const ok = parsePlanJudge({ candidates: [{ i: 1, elements: 4, setting: true, clean: true }, { i: 2, elements: 1, setting: "false", clean: true }], reason: "1번이 요소가 다 있다" }, 2);
    expect(ok?.candidates[1]).toEqual({ elements: 1, setting: false, clean: true });
    expect(parsePlanJudge({ candidates: [{ i: 1, elements: 4, setting: true, clean: true }] }, 2)).toBeNull();
    expect(parsePlanJudge(null, 2)).toBeNull();
  });

  it("prefers the candidate with the right setting and more builder inputs, and flags when the bar is missed", () => {
    const cands = [{ dataUrl: "", read: village(1) }, { dataUrl: "", read: village(5) }];
    const judge = parsePlanJudge({ candidates: [{ i: 1, elements: 4, setting: false, clean: true }, { i: 2, elements: 3, setting: true, clean: true }], reason: "" }, 2)!;
    const best = pickBest("village", cands, judge);
    expect(best.index).toBe(1);
    expect(best.met).toBe(true);
    const weak = parsePlanJudge({ candidates: [{ i: 1, elements: 1, setting: true, clean: true }, { i: 2, elements: 2, setting: true, clean: true }], reason: "" }, 2)!;
    expect(pickBest("village", cands, weak).met).toBe(false);
    expect(meetsBar("village", village(1), { elements: 5, setting: true, clean: true })).toBe(false);
  });

  it("falls back to the first candidate that reads best when the judge is missing", () => {
    const cands = [{ dataUrl: "", read: null }, { dataUrl: "", read: village(4) }];
    expect(pickBest("village", cands, null).index).toBe(1);
  });
});
