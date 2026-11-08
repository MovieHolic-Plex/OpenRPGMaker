import { describe, expect, it } from "vitest";
import { cutPieceFor, LONG_RAMP_RUNOUT } from "@/project/relief/cutPieces";
import { planReliefRamp } from "@/editor/reliefRampPlan";
import { reliefAllowsStep } from "@/project/relief/walk";
import rampArt from "@/project/relief/rampArt.json";
import type { ReliefArtPatch } from "@/project/relief/render";
import type { GameMap } from "@/project/types";

const pieces = (rampArt as Record<string, { pieces?: Record<string, ReliefArtPatch> }>)["grass-steps"]!.pieces!;

function hill(): GameMap {
  const w = 20, h = 15, n = w * h, levels = new Array<number>(n).fill(0);
  for (let y = 3; y < 8; y++) for (let x = 1; x < 19; x++) levels[y * w + x] = 2;
  return { id: "m", name: "m", width: w, height: h, tileSize: 16, tilesetId: "t", lowerTiles: new Array(n).fill(0), upperTiles: new Array(n).fill(-1), events: [], relief: { width: w, height: h, levels } };
}

describe("경사로 한 장짜리 비탈", () => {
  it("넓은 경사로는 3칸 조각의 왼쪽·가운데·오른쪽 칸으로 늘린다(옆벽은 양끝에 한 번씩)", () => {
    const three = cutPieceFor(pieces, "ramp", "n", 3, 1, 2)!, five = cutPieceFor(pieces, "ramp", "n", 5, 1, 2)!;
    const cell = three.w / 3, at = (p: ReliefArtPatch, x: number, y: number) => Array.from({ length: 4 }, (_, k) => p.rgba[(y * p.w + x) * 4 + k]);
    for (let y = 0; y < five.h; y++) for (let x = 0; x < cell; x++) {
      expect(at(five, x, y)).toEqual(at(three, x, y));
      expect(at(five, 4 * cell + x, y)).toEqual(at(three, 2 * cell + x, y));
      for (const col of [1, 2, 3]) expect(at(five, col * cell + x, y)).toEqual(at(three, cell + x, y));
    }
  });

  // 2단 이상 북쪽 경사로는 긴 비탈이다 — 낮은 땅 위 LONG_RAMP_RUNOUT 줄(133d84ccb9). 1단만 발치 한 줄.
  for (const width of [2, 3, 5]) it(`북쪽 경사로 폭 ${width}: 절벽 발치 ${LONG_RAMP_RUNOUT}줄 긴 비탈, 걸어서 올라간다`, () => {
    const map = hill();
    const plan = planReliefRamp(map, { x: 9, y: 8, face: "top" }, width, false);
    expect(plan.ok).toBe(true);
    plan.apply!(map);
    const rows = new Set(map.relief!.ramps!.flatMap((v, i) => (v ? [Math.floor(i / map.width)] : [])));
    expect([...rows].sort((x, y) => x - y)).toEqual([8, 9]);
    expect(reliefAllowsStep(map.relief, 9, 9, 9, 8) && reliefAllowsStep(map.relief, 9, 8, 9, 7)).toBe(true);
  });
});
