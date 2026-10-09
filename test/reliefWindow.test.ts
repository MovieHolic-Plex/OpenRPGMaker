// test/reliefWindow.test.ts
// 높이 붓 부분 다시 굽기(relief/window.ts)가 전체 굽기와 화소 하나 다르지 않은지 — 무작위로 더 많이 돌리는 확인은 scripts/check-relief-window.mts.
import { describe, expect, it } from "vitest";
import { brushRelief, type ReliefBrushMode } from "@/project/relief/edit";
import { reliefPadPx, renderRelief } from "@/project/relief/render";
import { reliefRenderOptions } from "@/project/relief/screen";
import type { ReliefData } from "@/project/relief/types";
import { rampCode } from "@/project/relief/walk";
import { applyReliefPatch, emptyReliefImage, planReliefPatch, reliefGrids, reliefImageFromRender, type ReliefImage, type ReliefScene } from "@/project/relief/window";

const sceneOf = (r: ReliefData): ReliefScene => ({ grids: reliefGrids(r), opts: reliefRenderOptions(r) });
const full = (r: ReliefData): ReliefImage => reliefImageFromRender(renderRelief(reliefGrids(r).eff, reliefRenderOptions(r)), r.width, r.height);

/** 다른 화소 수(RGBA·주인 줄·띠 중 하나라도 다르면 1) */
function differing(a: ReliefImage, b: ReliefImage): number {
  expect([a.PW, a.SH, a.pad]).toEqual([b.PW, b.SH, b.pad]);
  let n = 0;
  for (let i = 0; i < a.owner.length; i++) {
    if (a.owner[i] !== b.owner[i] || a.part[i] !== b.part[i]) { n++; continue; }
    for (let c = 0; c < 4; c++) if (a.rgba[i * 4 + c] !== b.rgba[i * 4 + c]) { n++; break; }
  }
  return n;
}

function hill(W: number, H: number, style?: string): ReliefData {
  const r: ReliefData = { width: W, height: H, levels: new Array(W * H).fill(0), ...(style ? { style } : {}) };
  brushRelief(r, Math.floor(W / 2), Math.floor(H / 2), "set", { radius: 5, level: 3 });
  return r;
}

/** 붓질들을 차례로 칠하며 매번 창 굽기 결과 == 전체 굽기. 창 굽기를 실제로 쓴 횟수를 돌려준다. */
function paint(start: ReliefData | null, base: ReliefData, strokes: readonly [number, number, ReliefBrushMode, number?][]): number {
  let relief = start ?? { ...base, levels: base.levels.map(() => 0) };
  let image = start ? full(start) : emptyReliefImage(base.width, base.height);
  let prev: ReliefScene | null = start ? sceneOf(start) : null;
  let windowed = 0;
  for (const [x, y, mode, level] of strokes) {
    const next: ReliefData = { ...relief, levels: relief.levels.slice() };
    brushRelief(next, x, y, mode, { radius: 2, ...(level === undefined ? {} : { level }) });
    const scene = sceneOf(next), truth = full(next);
    expect(reliefPadPx(scene.grids.pruned, scene.opts.slopes ?? [])).toBe(truth.pad);
    const plan = planReliefPatch(prev, scene, image);
    if (plan === null) image = truth;
    else if (plan !== "same") { applyReliefPatch(image, scene, plan); windowed++; }
    expect(differing(image, truth)).toBe(0);
    relief = next; prev = scene;
  }
  return windowed;
}

describe("relief 부분 다시 굽기", () => {
  it("언덕을 올리고 내리는 붓질이 전체 굽기와 같다", () => {
    expect(paint(hill(40, 34), hill(40, 34), [[12, 10, "raise"], [13, 11, "raise"], [25, 20, "lower"], [20, 17, "set", 1]])).toBeGreaterThan(0);
  });
  it("최고 단이 바뀌어 pad 가 바뀌어도 같다(버퍼를 밀고 맨 위 띠를 다시 굽는다)", () => {
    expect(paint(hill(40, 34, "grass-cliff"), hill(40, 34), [[8, 4, "set", 6], [8, 4, "set", 0], [30, 2, "mountain", 5]])).toBeGreaterThan(0);
  });
  it("빈 맵에 처음 칠할 때 평지 그림에서 창으로 굽는다", () => {
    expect(paint(null, hill(40, 34, "swamp-peat"), [[20, 16, "raise"], [22, 16, "raise"], [24, 17, "set", 4]])).toBeGreaterThan(0);
  });
  it("맵 가장자리 붓(줄 끝이 반대쪽 끝을 읽는 곳)도 같다", () => {
    expect(paint(hill(40, 34), hill(40, 34), [[0, 15, "set", 4], [39, 16, "set", 3], [20, 33, "set", 5], [20, 0, "set", 2]])).toBeGreaterThan(0);
  });
  it("경사로·계단 둘레에서 단이 바뀌어도 같다", () => {
    const r = hill(40, 34, "tundra-snow");
    const ramps = new Array(40 * 34).fill(0);
    for (let x = 18; x < 21; x++) { ramps[23 * 40 + x] = rampCode("n", true); r.levels[23 * 40 + x] = r.levels[22 * 40 + x]!; }
    r.ramps = ramps;
    paint(r, r, [[19, 20, "raise"], [10, 12, "lower"], [19, 25, "set", 2]]);
  });
});
