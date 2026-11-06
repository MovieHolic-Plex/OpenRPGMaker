import { describe, expect, it } from "vitest";
import { planReliefRamp } from "@/editor/reliefRampPlan";
import { reliefAllowsStep } from "@/project/relief/walk";
import type { GameMap } from "@/project/types";

function cliff(rise: number): GameMap {
  const w = 12, h = 12, n = w * h, levels = new Array<number>(n).fill(0);
  for (let y = 1; y <= 5; y++) for (let x = 2; x < 10; x++) levels[y * w + x] = rise;
  return { id: "m", name: "m", width: w, height: h, tileSize: 16, tilesetId: "t", lowerTiles: new Array(n).fill(0), upperTiles: new Array(n).fill(-1), events: [], relief: { width: w, height: h, levels } } as GameMap;
}

function climbs(map: GameMap, rise: number): boolean {
  const r = map.relief!;
  let y = 9;
  while (y > 1) {
    if (!reliefAllowsStep(r, 5, y, 5, y - 1)) return false;
    y--;
    if (r.levels[y * map.width + 5] === rise && !r.ramps?.[y * map.width + 5]) return true;
  }
  return false;
}

describe("높은 절벽 경사로", () => {
  for (const [rise, rows] of [[1, 1], [2, 1], [3, 1], [4, 1], [6, 2], [8, 2]] as const) it(`${rise}단 절벽: 발치 ${rows}줄, 걸어서 오른다`, () => {
    const map = cliff(rise);
    const plan = planReliefRamp(map, { x: 5, y: 6, face: "top" }, 2, false);
    expect(plan.ok).toBe(true);
    plan.apply!(map);
    const rampRows = new Set(map.relief!.ramps!.flatMap((v, i) => (v ? [Math.floor(i / map.width)] : [])));
    expect(rampRows.size).toBe(rows);
    expect(climbs(map, rise)).toBe(true);
  });

  it("그림이 없는 높이(10단)는 이유와 한 번에 고치는 길을 준다", () => {
    const map = cliff(10);
    const plan = planReliefRamp(map, { x: 5, y: 6, face: "top" }, 2, false);
    expect(plan.ok).toBe(false);
    expect(plan.fix).toBeDefined();
    plan.fix!.apply(map);
    expect(map.relief!.levels[3 * map.width + 5]).toBe(8);
    expect(climbs(map, 8)).toBe(true);
  });
});
