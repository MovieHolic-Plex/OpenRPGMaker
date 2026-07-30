import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { iceDiagonalRole, validateIceDiagonalTerrain } from "@/project/defaults/iceDiagonalTerrain";
import {
  ICE_GRAND_EXPANSE_BANNED_VOID_TILES,
  ICE_GRAND_EXPANSE_BOSS,
  ICE_GRAND_EXPANSE_CEILING_TILE,
  ICE_GRAND_EXPANSE_LIP_TILE,
  ICE_GRAND_EXPANSE_GATE_GEOMETRY,
  ICE_GRAND_EXPANSE_HEIGHT,
  ICE_GRAND_EXPANSE_MAP_ID,
  ICE_GRAND_EXPANSE_MAP_NAME,
  ICE_GRAND_EXPANSE_REGION_BASES,
  ICE_GRAND_EXPANSE_RIDGES,
  ICE_GRAND_EXPANSE_START,
  ICE_GRAND_EXPANSE_TERRAIN_ROUTE_PLAN,
  ICE_GRAND_EXPANSE_WIDTH,
} from "@/project/defaults/iceGrandExpansePlan";
import { expandIceGrandExpanseRidges, IceGrandExpanseTerrainError } from "@/project/defaults/iceGrandExpanseRidges";
import { buildIceGrandExpanseTerrain } from "@/project/defaults/iceGrandExpanseTerrain";
import { enclosedComponentSizes, isCutByBlockedCell } from "./helpers/iceGrandExpanseTerrainStructure";

const sha256 = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");

const expectedRoleCounts = { "left:cap": 264, "left:body": 528, "left:base": 264, "right:cap": 264, "right:body": 528, "right:base": 264 } as const;

function expectTerrainError(action: () => void, code: IceGrandExpanseTerrainError["code"]): void {
  try {
    action();
    throw new Error(`Expected ${code}`);
  } catch (error) {
    if (!(error instanceof IceGrandExpanseTerrainError)) throw error;
    expect(error.code).toBe(code);
  }
}

describe("ice grand expanse deterministic terrain", () => {
  it("freezes the exact map identity, traversal endpoints, and eight region bases", () => {
    expect({
      id: ICE_GRAND_EXPANSE_MAP_ID,
      name: ICE_GRAND_EXPANSE_MAP_NAME,
      start: ICE_GRAND_EXPANSE_START,
      boss: ICE_GRAND_EXPANSE_BOSS,
    }).toEqual({
      id: "map_g_ice_grand_expanse",
      name: "빙결 대원정 · 열네 능선 (128×128)",
      start: { x: 64, y: 120 },
      boss: { x: 64, y: 11 },
    });
    expect(ICE_GRAND_EXPANSE_REGION_BASES).toEqual([
      { id: "south-camp", x: 45, y: 109, width: 38, height: 16, tile: 67 },
      { id: "twin-fang", x: 10, y: 88, width: 108, height: 23, tile: 97 },
      { id: "central-gate", x: 42, y: 76, width: 45, height: 21, tile: 67 },
      { id: "west-mine", x: 8, y: 50, width: 47, height: 39, tile: 66 },
      { id: "mirror-lake", x: 38, y: 46, width: 53, height: 28, tile: 96 },
      { id: "east-cliff", x: 74, y: 48, width: 47, height: 41, tile: 68 },
      { id: "crown-switchbacks", x: 20, y: 21, width: 89, height: 32, tile: 37 },
      { id: "dragon-altar", x: 46, y: 4, width: 37, height: 20, tile: 7 },
    ]);
  });

  it("freezes the exact fourteen-ridge declaration and 528 expanded columns", () => {
    expect(ICE_GRAND_EXPANSE_RIDGES.map((ridge) => [ridge.id, ridge.bounds, ridge.direction, ridge.motifOrigins])).toEqual([
      ["r01-southwest-wall", { minX: 4, maxX: 39, minY: 94, maxY: 112 }, "rise", [[4, 104], [16, 99], [28, 94]]],
      ["r02-southeast-wall", { minX: 88, maxX: 123, minY: 90, maxY: 108 }, "fall", [[88, 90], [100, 95], [112, 100]]],
      ["r03-central-gate", { minX: 40, maxX: 87, minY: 76, maxY: 99 }, "rise", [[40, 91], [52, 86], [64, 81], [76, 76]]],
      ["r04-west-lower", { minX: 4, maxX: 39, minY: 66, maxY: 84 }, "rise", [[4, 76], [16, 71], [28, 66]]],
      ["r05-east-lower", { minX: 88, maxX: 123, minY: 70, maxY: 88 }, "fall", [[88, 70], [100, 75], [112, 80]]],
      ["r06-west-hook", { minX: 4, maxX: 39, minY: 48, maxY: 66 }, "rise", [[4, 58], [16, 53], [28, 48]]],
      ["r07-east-hook", { minX: 88, maxX: 123, minY: 48, maxY: 66 }, "fall", [[88, 48], [100, 53], [112, 58]]],
      ["r08-lake-south", { minX: 40, maxX: 87, minY: 53, maxY: 76 }, "rise", [[40, 68], [52, 63], [64, 58], [76, 53]]],
      ["r09-lake-north", { minX: 40, maxX: 87, minY: 24, maxY: 47 }, "fall", [[40, 24], [52, 29], [64, 34], [76, 39]]],
      ["r10-crown-west", { minX: 4, maxX: 27, minY: 39, maxY: 52 }, "rise", [[4, 44], [16, 39]]],
      ["r11-crown-east", { minX: 100, maxX: 123, minY: 39, maxY: 52 }, "fall", [[100, 39], [112, 44]]],
      ["r12-summit-left", { minX: 4, maxX: 39, minY: 16, maxY: 34 }, "rise", [[4, 26], [16, 21], [28, 16]]],
      ["r13-summit-right", { minX: 88, maxX: 123, minY: 16, maxY: 34 }, "fall", [[88, 16], [100, 21], [112, 26]]],
      ["r14-altar-ring", { minX: 40, maxX: 87, minY: 2, maxY: 25 }, "fall", [[40, 2], [52, 7], [64, 12], [76, 17]]],
    ]);
    expect(ICE_GRAND_EXPANSE_RIDGES).toHaveLength(14);
    expect(ICE_GRAND_EXPANSE_RIDGES.map((ridge) => ridge.motifOrigins.length)).toEqual([3, 3, 4, 3, 3, 3, 3, 4, 4, 2, 2, 3, 3, 4]);
    for (const ridge of ICE_GRAND_EXPANSE_RIDGES) {
      const phaseY = ridge.direction === "rise" ? -5 : 5;
      for (let index = 1; index < ridge.motifOrigins.length; index += 1) {
        const previous = ridge.motifOrigins[index - 1];
        const current = ridge.motifOrigins[index];
        if (previous === undefined || current === undefined) throw new Error(`Missing phase origin for ${ridge.id}`);
        expect([current[0] - previous[0], current[1] - previous[1]], ridge.id).toEqual([12, phaseY]);
      }
    }
    const columns = expandIceGrandExpanseRidges(ICE_GRAND_EXPANSE_RIDGES);
    expect(columns).toHaveLength(528);
  });

  it("builds immutable 128 by 128 layers with all six canonical roles", () => {
    const terrain = buildIceGrandExpanseTerrain();
    expect([terrain.width, terrain.height]).toEqual([ICE_GRAND_EXPANSE_WIDTH, ICE_GRAND_EXPANSE_HEIGHT]);
    expect(terrain.lowerTiles).toHaveLength(16_384);
    expect(terrain.upperTiles).toHaveLength(16_384);
    expect(terrain.ceilingMask).toHaveLength(16_384);
    expect(terrain.columns).toHaveLength(528);
    expect(terrain.roleCounts).toEqual(expectedRoleCounts);
    expect(validateIceDiagonalTerrain({ width: terrain.width, height: terrain.height, lower: terrain.lowerTiles })).toEqual([]);
    expect(terrain.lowerTiles.filter((tile, index) => iceDiagonalRole(tile) !== null && terrain.ceilingMask[index] === 1)).toEqual([]);
    expect(terrain.ceilingMask.some((cell) => cell === 1)).toBe(true);
    // 네거티브 공간은 심연 428 이 아니라 광석 암반 285 다 — 428 은 85% 순검정이라 나락으로 읽혔다.
    expect(ICE_GRAND_EXPANSE_CEILING_TILE).toBe(285);
    expect(terrain.lowerTiles[0]).toBe(ICE_GRAND_EXPANSE_CEILING_TILE);
    expect(terrain.lowerTiles.filter((tile) => tile === ICE_GRAND_EXPANSE_CEILING_TILE).length).toBeGreaterThan(1_000);
    expect(terrain.lowerTiles.filter((tile) => [372, 373, 374, 402, 403, 404].includes(tile)).length).toBeGreaterThan(300);
    expect(enclosedComponentSizes(terrain.lowerTiles, terrain.width, ICE_GRAND_EXPANSE_CEILING_TILE).filter((size) => size < 24)).toEqual([]);
  });

  /**
   * 감독 지시 — **물타일은 끝까지 없앤다**.
   *
   * 64×64 에서 427(순검정 심연)을 지웠는데 이 맵은 같은 심연 집합의 428 을 2,800칸
   * 네거티브 공간으로 쓰고 있었다. 한 맵만 고치면 같은 결함이 다른 맵에 남는다.
   */
  it("places no abyss or water tile anywhere on the map", () => {
    const terrain = buildIceGrandExpanseTerrain();
    const present = new Set<number>();
    for (const tile of [...terrain.lowerTiles, ...terrain.upperTiles]) {
      if ((ICE_GRAND_EXPANSE_BANNED_VOID_TILES as readonly number[]).includes(tile)) present.add(tile);
    }
    expect([...present]).toEqual([]);
  });

  /**
   * 감독 지시 — "373 위에 평지놓을거면 343 놓으라니까".
   *
   * 절벽 상단 바로 위가 바닥이면 343 을 깐다. 눈 남변 97 은 `97 ↓ 373` = 173 으로
   * 벽 윗선과 부딪히고 343 은 38 이다. 립은 절벽 칸이 아니라 위 대지의 바닥이며,
   * 대각 밑동 밑 지지 행은 정본 규칙이 눈을 요구하므로 건드리지 않는다.
   */
  it("lays the 343 lip on floor above cliff tops without breaking the canonical ridges", () => {
    const terrain = buildIceGrandExpanseTerrain();
    expect(ICE_GRAND_EXPANSE_LIP_TILE).toBe(343);
    const lipCells = terrain.lowerTiles.filter((tile) => tile === ICE_GRAND_EXPANSE_LIP_TILE).length;
    expect(lipCells).toBeGreaterThan(100);
    // 립을 깔고도 정본 대각 문법이 깨지지 않는다(지지 행 규칙 포함).
    expect(validateIceDiagonalTerrain({ width: terrain.width, height: terrain.height, lower: terrain.lowerTiles })).toEqual([]);
    // 립은 천장(네거티브 공간)이 아니다.
    expect(terrain.lowerTiles.filter((tile, index) => tile === ICE_GRAND_EXPANSE_LIP_TILE && terrain.ceilingMask[index] === 1)).toEqual([]);
  });

  it("materializes the route plan as five-cell corridors, plazas, and irregular regions", () => {
    const terrain = buildIceGrandExpanseTerrain();
    expect(ICE_GRAND_EXPANSE_TERRAIN_ROUTE_PLAN.nodes.find(({ id }) => id === "lake-north")).toEqual({
      id: "lake-north", x: 60, y: 43, width: 9, height: 10,
    });
    expect(ICE_GRAND_EXPANSE_TERRAIN_ROUTE_PLAN.routes.find(({ id }) => id === "c3-lake-north-crown-west")?.waypoints).toEqual([
      [64, 49], [64, 43], [40, 43], [40, 38],
    ]);
    expect(ICE_GRAND_EXPANSE_TERRAIN_ROUTE_PLAN.routes.find(({ id }) => id === "c3-crown-east-lake-north")?.waypoints).toEqual([
      [88, 38], [88, 40], [73, 40], [73, 43], [64, 43], [64, 49],
    ]);
    const routeCells = [...terrain.routeMaterialMask].filter((cell) => cell === 1).length;
    const routeSnowCells = terrain.routeMaterialMask.reduce((count, cell, index) => {
      if (cell !== 1) return count;
      const visible = terrain.upperTiles[index] === -1 ? terrain.lowerTiles[index] : terrain.upperTiles[index];
      return count + ([6, 7, 8, 36, 37, 38, 66, 67, 68, 96, 97, 98].includes(visible ?? -1) ? 1 : 0);
    }, 0);
    expect(ICE_GRAND_EXPANSE_TERRAIN_ROUTE_PLAN.routes).toHaveLength(12);
    expect(sha256(ICE_GRAND_EXPANSE_TERRAIN_ROUTE_PLAN)).toBe("ea0b6120d8298f9cdb55ec1daecb8d0678a8e72bdb1705d320bc2ba761b5dbfe");
    expect(routeCells).toBeGreaterThan(0);
    expect(routeSnowCells / routeCells).toBeGreaterThanOrEqual(0.9);
    expect([45, 46, 47, 48, 49].map((x) => terrain.routeMaterialMask[105 * terrain.width + x])).toEqual([1, 1, 1, 1, 1]);

    const supportedPassable = terrain.passableMaterialMask.reduce((count, cell, index) => (
      count + (cell === 1 && (
        terrain.routeMaterialMask[index] === 1
        || terrain.nodeMaterialMask[index] === 1
        || terrain.regionMaterialMask[index] === 1
      ) ? 1 : 0)
    ), 0);
    const passableCells = [...terrain.passableMaterialMask].filter((cell) => cell === 1).length;
    expect(supportedPassable / passableCells).toBeGreaterThanOrEqual(0.9);
    expect([...terrain.nodeMaterialMask].filter((cell) => cell === 1).length).toBeGreaterThanOrEqual(10 * 7 * 7);
    expect([...terrain.basinMaterialMask].filter((cell) => cell === 1).length).toBeGreaterThan(500);
    expect(terrain.ceilingMask[123 * terrain.width + 20]).toBe(1);
    expect(terrain.regionMaterialMask[119 * terrain.width + 64]).toBe(1);
  });

  it("keeps coastline fills irregular and the crown gate a single-cell chokepoint", () => {
    const terrain = buildIceGrandExpanseTerrain();
    const fills = [...ICE_GRAND_EXPANSE_TERRAIN_ROUTE_PLAN.regions, ...ICE_GRAND_EXPANSE_TERRAIN_ROUTE_PLAN.basins];
    for (const fill of fills) {
      const xs = fill.points.map(([x]) => x);
      const ys = fill.points.map(([, y]) => y);
      const axisAligned = fill.points.every((point, index) => {
        const next = fill.points[(index + 1) % fill.points.length];
        return next !== undefined && (point[0] === next[0] || point[1] === next[1]);
      });
      const rectangularOrCross = axisAligned && new Set(xs).size <= 4 && new Set(ys).size <= 4;
      expect(fill.points.length, fill.id).toBeGreaterThanOrEqual(12);
      expect(rectangularOrCross, fill.id).toBe(false);
    }
    expect(ICE_GRAND_EXPANSE_GATE_GEOMETRY).toEqual({
      event: { x: 64, y: 47 },
      southFacing: { x: 64, y: 48 },
      northExit: { x: 64, y: 45 },
      barrier: { minX: 0, maxX: 127, topY: 46, depth: 2 },
    });
    for (let x = 0; x < terrain.width; x += 1) for (const y of [46, 47]) {
      expect(terrain.passableMaterialMask[y * terrain.width + x], `${x},${y}`).toBe(x === 64 ? 1 : 0);
    }
    expect(terrain.passableMaterialMask[84 * terrain.width + 63]).toBe(1);
    expect(terrain.passableMaterialMask[84 * terrain.width + 64]).toBe(1);
    expect(terrain.passableMaterialMask[84 * terrain.width + 65]).toBe(1);
    expect(terrain.passableMaterialMask[92 * terrain.width + 111]).toBe(1);
    const anchors = [[60, 38], [93, 98], [53, 34], [23, 58], [64, 92], [34, 72], [98, 58], [40, 82], [40, 81], [88, 82], [88, 81]] as const;
    for (const [x, y] of anchors) {
      expect(iceDiagonalRole(terrain.lowerTiles[y * terrain.width + x] ?? -1), `${x},${y}`).toBeNull();
      expect(terrain.passableMaterialMask[y * terrain.width + x], `${x},${y}`).toBe(1);
    }
    expect([terrain.upperTiles[82 * terrain.width + 40], terrain.upperTiles[81 * terrain.width + 40]]).toEqual([-1, -1]);
    expect([terrain.upperTiles[82 * terrain.width + 88], terrain.upperTiles[81 * terrain.width + 88]]).toEqual([-1, -1]);
    expect([terrain.passableMaterialMask[83 * terrain.width + 40], terrain.passableMaterialMask[83 * terrain.width + 88]]).toEqual([1, 1]);
    expect(isCutByBlockedCell(terrain.passableMaterialMask, terrain.width, [64, 120], [64, 11], [64, 47])).toBe(true);
  });

  it("puts terrain landmarks in the start, central, and summit camera frames", () => {
    const terrain = buildIceGrandExpanseTerrain();
    const landmarkCount = (x: number, y: number): number => {
      let count = 0;
      for (let yy = y; yy < y + 20; yy += 1) for (let xx = x; xx < x + 30; xx += 1) {
        const index = yy * terrain.width + xx;
        const lower = terrain.lowerTiles[index] ?? -1;
        const visible = terrain.upperTiles[index] === -1 ? lower : terrain.upperTiles[index] ?? -1;
        if (visible === -1 || [69, 70, 71, 99, 100, 101].includes(visible) || iceDiagonalRole(lower) !== null) count += 1;
      }
      return count;
    };
    expect(landmarkCount(49, 108)).toBeGreaterThanOrEqual(120);
    expect(landmarkCount(49, 75)).toBeGreaterThanOrEqual(120);
    expect(landmarkCount(49, 2)).toBeGreaterThanOrEqual(120);
  });

  it("keeps continuous canonical belts while opening the central and boss connectors", () => {
    const terrain = buildIceGrandExpanseTerrain();
    for (const ridge of ICE_GRAND_EXPANSE_RIDGES) {
      const occupiedX = new Set(expandIceGrandExpanseRidges([ridge]).map((column) => column.x));
      for (let x = ridge.bounds.minX; x <= ridge.bounds.maxX; x += 1) expect(occupiedX.has(x), `${ridge.id}:${x}`).toBe(true);
    }
    for (let y = 86; y <= 94; y += 1) expect(terrain.passableMaterialMask[y * terrain.width + 64]).toBe(1);
    for (let y = 11; y <= 25; y += 1) expect(terrain.passableMaterialMask[y * terrain.width + 64]).toBe(1);
    let bridgedRidgeCells = 0;
    for (let y = 12; y <= 20; y += 1) {
      const index = y * terrain.width + 64;
      if (iceDiagonalRole(terrain.lowerTiles[index] ?? -1) !== null) {
        bridgedRidgeCells += 1;
        expect([6, 7, 8, 36, 37, 38, 66, 67, 68, 96, 97, 98]).toContain(terrain.upperTiles[index]);
      }
    }
    expect(bridgedRidgeCells).toBeGreaterThan(0);
  });

  it("is byte-deterministic and leaves exported config tables unchanged", () => {
    const ridgeBefore = JSON.stringify(ICE_GRAND_EXPANSE_RIDGES);
    const regionBefore = JSON.stringify(ICE_GRAND_EXPANSE_REGION_BASES);
    const first = buildIceGrandExpanseTerrain();
    const second = buildIceGrandExpanseTerrain();
    expect(first).toEqual(second);
    expect(JSON.stringify(ICE_GRAND_EXPANSE_RIDGES)).toBe(ridgeBefore);
    expect(JSON.stringify(ICE_GRAND_EXPANSE_REGION_BASES)).toBe(regionBefore);
  });

  it("rejects malformed configs atomically with typed errors", () => {
    const first = ICE_GRAND_EXPANSE_RIDGES[0];
    const second = ICE_GRAND_EXPANSE_RIDGES[1];
    if (first === undefined || second === undefined) throw new Error("Frozen ridge fixtures are incomplete");

    expectTerrainError(
      () => buildIceGrandExpanseTerrain({ ridgeConfigs: [{ ...first, motifOrigins: [[-1, 10]] }], regionBases: ICE_GRAND_EXPANSE_REGION_BASES }),
      "RIDGE_OUT_OF_BOUNDS",
    );
    expectTerrainError(
      () => buildIceGrandExpanseTerrain({ ridgeConfigs: [first, { ...second, id: first.id }], regionBases: ICE_GRAND_EXPANSE_REGION_BASES }),
      "RIDGE_DUPLICATE_ID",
    );
    expectTerrainError(
      () => buildIceGrandExpanseTerrain({ ridgeConfigs: [], regionBases: ICE_GRAND_EXPANSE_REGION_BASES }),
      "RIDGE_ROLE_OMITTED",
    );
    expectTerrainError(
      () => buildIceGrandExpanseTerrain({
        ridgeConfigs: [
          { ...first, id: "conflict-rise", direction: "rise", motifOrigins: [[20, 60]] },
          { ...second, id: "conflict-fall", direction: "fall", motifOrigins: [[20, 60]] },
        ],
        regionBases: ICE_GRAND_EXPANSE_REGION_BASES,
      }),
      "RIDGE_COLUMN_CONFLICT",
    );
    expectTerrainError(
      () => buildIceGrandExpanseTerrain({ ridgeConfigs: [{ ...first, motifOrigins: [[0, 2]] }], regionBases: ICE_GRAND_EXPANSE_REGION_BASES }),
      "RIDGE_CEILING_COLLISION",
    );
    expectTerrainError(
      () => buildIceGrandExpanseTerrain({
        ridgeConfigs: [{ ...first, motifOrigins: [[8.5, 98]] }],
        regionBases: ICE_GRAND_EXPANSE_REGION_BASES,
      }),
      "RIDGE_STAMP_REJECTED",
    );
  });
});
