import { describe, expect, it } from "vitest";
import { cutPieceFor, LONG_RAMP_RUNOUT } from "@/project/relief/cutPieces";
import { planReliefRamp } from "@/editor/reliefRampPlan";
import { reliefAllowsStep } from "@/project/relief/walk";
import rampArt from "@/project/relief/rampArt.json";
import tileset from "@/assets/beodeulCityTileset.json";
import type { ReliefArtPatch } from "@/project/relief/render";
import type { GameMap } from "@/project/types";

const pieces = (rampArt as Record<string, { pieces?: Record<string, ReliefArtPatch> }>)["grass-steps"]!.pieces!;

function cliff(rise: number): GameMap {
  const w = 12, h = 16, n = w * h, levels = new Array<number>(n).fill(0);
  for (let y = 1; y <= 5; y++) for (let x = 2; x < 10; x++) levels[y * w + x] = rise;
  return { id: "m", name: "m", width: w, height: h, tileSize: 16, tilesetId: "t", lowerTiles: new Array(n).fill(0), upperTiles: new Array(n).fill(-1), events: [], relief: { width: w, height: h, levels } } as GameMap;
}

describe("긴 비탈", () => {
  for (const rise of [2, 4, 6, 8, 10]) it(`${rise}단: 절벽 면을 따라 내려와 낮은 땅 위 ${LONG_RAMP_RUNOUT}칸, 한 장 그림, 걸어서 오른다`, () => {
    const map = cliff(rise);
    const plan = planReliefRamp(map, { x: 5, y: 6, face: "top" }, 2, false);
    expect(plan.ok).toBe(true);
    plan.apply!(map);
    const rows = new Set(map.relief!.ramps!.flatMap((v, i) => (v ? [Math.floor(i / map.width)] : [])));
    expect(rows.size).toBe(LONG_RAMP_RUNOUT);
    const art = cutPieceFor(pieces, "ramp", "n", 2, LONG_RAMP_RUNOUT, rise);
    expect(art?.h).toBe((rise + LONG_RAMP_RUNOUT) * 16);
    let y = map.height - 1;
    while (y > 1 && reliefAllowsStep(map.relief, 5, y, 5, y - 1)) { y--; if (map.relief!.levels[y * map.width + 5] === rise && !map.relief!.ramps?.[y * map.width + 5]) break; }
    expect(map.relief!.levels[y * map.width + 5]).toBe(rise);
  });

  it("1단과 돌계단은 기존 낱조각 그대로", () => {
    const map = cliff(1);
    planReliefRamp(map, { x: 5, y: 6, face: "top" }, 2, false).apply!(map);
    expect(map.relief!.ramps!.filter(Boolean).length).toBe(2);
    expect(cutPieceFor(pieces, "stairs", "n", 2, 1, 3)).toBe(pieces["stairs:n:2x1:3"]);
  });
});

describe("자연 호숫가 오토타일", () => {
  const groups = (tileset as { autotileGroups: { id: string; memberTileIds: number[]; variantMap: Record<string, number> }[] }).autotileGroups;
  for (const id of ["beodeul_lakeshore_grass", "beodeul_lakeshore_sand"]) it(`${id}: 47장, 256 마스크 모두 구성원으로`, () => {
    const g = groups.find((x) => x.id === id)!;
    expect(g.memberTileIds.length).toBe(47);
    const members = new Set(g.memberTileIds);
    for (let m = 0; m < 256; m++) expect(members.has(g.variantMap[String(m)]!)).toBe(true);
  });
});
