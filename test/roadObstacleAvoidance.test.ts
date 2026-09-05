// test/roadObstacleAvoidance.test.ts
// 고정하는 계약: 도로/길 툴은 건물을 관통하지 않는다.
//   (1) paint_road 가 집 사이를 가로지르면 집 칸을 덮지 않고 우회한다
//   (2) 우회해도 경로 연결성(문 앞 → 목표)이 유지된다
//   (3) 장애물이 없는 맵에서는 결과가 예전과 바이트 동일하다(퇴행 방지)
//   (4) lay_path 도 같은 보호를 받는다 — 두 레이어 바이트 동일로 검사한다
//   (5) 폭 셀은 경로가 아니므로 우회로를 만들지 않는다(엉뚱한 들판 길 금지)
//   (6) 끊긴 길은 커밋하지 않고 좌표와 함께 거절한다
//   (7) 나무는 길이 치우고, 물은 마른 우회로가 없을 때만 건넌다

import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext, ToolResult } from "@/editor/tools/types";
import { filterRoadWidthCells, repairRoadPath, roadObstacleMaskFor } from "@/editor/tools/roadObstacles";
import type { Point } from "@/editor/tools/mapHelpers";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { isRoadTile } from "@/project/defaults/roadAutotile";
import { captureHouseProtection } from "@/editor/tools/houseProtection";
import { DIRT_ROAD_TILE, SAND_TILE } from "@/project/defaults/chipsetMapping";
import { isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";

const MAP_ID = "map_road_obstacle";

function context(width = 40, height = 24): { readonly ctx: ToolContext; readonly mapId: string } {
  const ctx: ToolContext = { project: createBlankProject() };
  const created = runTool(ctx, "create_map", { id: MAP_ID, name: "도로 우회", width, height });
  expect(created.ok, created.summary).toBe(true);
  return { ctx, mapId: MAP_ID };
}

function mapOf(ctx: ToolContext): GameMap {
  const map = ctx.project.maps[MAP_ID];
  if (!map) throw new Error("missing map");
  return map;
}

function expectOk(result: ToolResult): void {
  expect(result.ok, result.summary).toBe(true);
}

function buildHouse(ctx: ToolContext, origin: Point, width: number, height: number): void {
  expectOk(runTool(ctx, "build_house", { mapId: MAP_ID, origin, width, height, material: "plaster" }));
}

// 통행 불가 + 저작물이 있는 칸 = 도로가 덮으면 안 되는 칸.
function blockedCells(project: Project, map: GameMap): ReadonlySet<string> {
  const cells = new Set<string>();
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const index = y * map.width + x;
      const authored = (map.lowerTiles[index] ?? TILE.EMPTY) !== TILE.EMPTY
        || (map.upperTiles[index] ?? TILE.EMPTY) !== TILE.EMPTY;
      if (authored && !isPassable(project, map, x, y)) cells.add(`${x},${y}`);
    }
  }
  return cells;
}

// 셀별 (lower,upper) 스냅샷 — "덮지 않았다"를 두 레이어 바이트 동일로 검사한다.
function layerSnapshot(map: GameMap, keys: Iterable<string>): ReadonlyMap<string, string> {
  const snapshot = new Map<string, string>();
  for (const key of keys) {
    const [x, y] = key.split(",").map(Number);
    const index = y * map.width + x;
    snapshot.set(key, `${map.lowerTiles[index] ?? TILE.EMPTY}/${map.upperTiles[index] ?? TILE.EMPTY}`);
  }
  return snapshot;
}

function changedCells(before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>): string[] {
  return [...before.entries()].filter(([key, value]) => after.get(key) !== value).map(([key]) => key);
}

// 지표면(lower)만 보는 스냅샷 — 길이 쓰는 레이어가 lower 다.
function groundSnapshot(map: GameMap, keys: Iterable<string>): ReadonlyMap<string, string> {
  const snapshot = new Map<string, string>();
  for (const key of keys) {
    const [x, y] = key.split(",").map(Number);
    snapshot.set(key, String(map.lowerTiles[y * map.width + x] ?? TILE.EMPTY));
  }
  return snapshot;
}

function roadKeys(map: GameMap): ReadonlySet<string> {
  const keys = new Set<string>();
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (isRoadTile(map.lowerTiles[y * map.width + x] ?? TILE.EMPTY)) keys.add(`${x},${y}`);
    }
  }
  return keys;
}

// 도로 칸 집합이 4-이웃으로 이어져 있는가(끊긴 조각 수).
function roadFragments(map: GameMap): number {
  const remaining = new Set(roadKeys(map));
  let fragments = 0;
  while (remaining.size > 0) {
    fragments += 1;
    const seed = remaining.values().next().value as string;
    const queue = [seed];
    remaining.delete(seed);
    while (queue.length > 0) {
      const [x, y] = (queue.pop() as string).split(",").map(Number);
      for (const step of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const key = `${x + step[0]},${y + step[1]}`;
        if (remaining.delete(key)) queue.push(key);
      }
    }
  }
  return fragments;
}

describe("도로 우회 — 건물 관통 방지", () => {
  it("두 집 사이를 가로지르는 paint_road 가 집 칸을 한 칸도 덮지 않는다", () => {
    const { ctx } = context();
    buildHouse(ctx, { x: 10, y: 6 }, 8, 8);
    buildHouse(ctx, { x: 24, y: 6 }, 8, 8);
    const map = mapOf(ctx);
    const protectedCells = blockedCells(ctx.project, map);
    expect(protectedCells.size).toBeGreaterThan(20);
    const before = layerSnapshot(map, protectedCells);
    const houses = captureHouseProtection(ctx.project);

    // 집 몸통을 정통으로 관통하는 폴리라인 — 벽·지붕이 이 경로상에 있다.
    const result = runTool(ctx, "paint_road", {
      mapId: MAP_ID,
      points: [{ x: 2, y: 9 }, { x: 37, y: 9 }],
      style: "dirt",
      naturalness: 0,
    });

    expectOk(result);
    const after = mapOf(ctx);
    expect(changedCells(before, layerSnapshot(after, protectedCells))).toEqual([]);
    expect(captureHouseProtection(ctx.project)).toEqual(houses);
    expect((result.data as { obstacleCells: number }).obstacleCells).toBeGreaterThan(0);
  });

  it("집을 피한 도로가 하나로 이어진다(우회로가 연결성을 지킨다)", () => {
    const { ctx } = context();
    buildHouse(ctx, { x: 14, y: 5 }, 10, 9);

    expectOk(runTool(ctx, "paint_road", {
      mapId: MAP_ID,
      points: [{ x: 3, y: 9 }, { x: 36, y: 9 }],
      style: "dirt",
      naturalness: 0,
    }));

    expect(roadFragments(mapOf(ctx))).toBe(1);
  });

  it("집을 관통하던 칸 수를 결과 data 와 경고로 보고한다", () => {
    const { ctx } = context();
    buildHouse(ctx, { x: 14, y: 5 }, 10, 9);

    const result = runTool(ctx, "paint_road", {
      mapId: MAP_ID,
      points: [{ x: 3, y: 9 }, { x: 36, y: 9 }],
      style: "dirt",
      naturalness: 0,
    });

    expectOk(result);
    const data = result.data as { detouredSegments: number; obstacleCells: number; structureCells: number };
    expect(data.obstacleCells).toBeGreaterThan(0);
    expect(data.structureCells).toBeGreaterThan(0);
    expect(data.detouredSegments).toBeGreaterThan(0);
    expect((result.diff?.warnings ?? []).join(" ")).toContain("통행 불가");
  });

  it("장애물이 없으면 경로 셀을 그대로 쓴다(기존 결과 유지)", () => {
    const { ctx } = context();
    const map = mapOf(ctx);
    const mask = roadObstacleMaskFor(ctx.project, map);
    const candidate: readonly Point[] = [{ x: 3, y: 9 }, { x: 4, y: 9 }, { x: 5, y: 9 }];

    const repaired = repairRoadPath(map, mask, candidate);

    expect(repaired.cells).toEqual(candidate);
    expect(repaired.blocked).toBe(0);
    expect(repaired.detours).toBe(0);
    expect(repaired.gaps).toBe(0);
    expect(repaired.startBlocked).toBe(false);
    expect(repaired.endBlocked).toBe(false);
  });

  it("빈 칸(EMPTY)은 장애물이 아니다 — 갓 만든 맵에서 길이 안 깔리는 퇴행 방지", () => {
    const { ctx } = context();
    const map = mapOf(ctx);
    const index = 9 * map.width + 5;
    map.lowerTiles[index] = TILE.EMPTY;
    map.upperTiles[index] = TILE.EMPTY;

    expect(roadObstacleMaskFor(ctx.project, map)(5, 9)).toBe("open");
  });

  it("폭 셀은 경로가 아니라 표본이므로 우회로를 만들지 않는다", () => {
    const { ctx } = context();
    buildHouse(ctx, { x: 14, y: 7 }, 10, 10);
    const map = mapOf(ctx);
    const mask = roadObstacleMaskFor(ctx.project, map);
    // 서로 인접하지 않은 폭 표본들 — 이 사이를 이으면 들판에 엉뚱한 길이 난다.
    const samples: readonly Point[] = [{ x: 12, y: 11 }, { x: 16, y: 11 }, { x: 27, y: 11 }];

    const filtered = filterRoadWidthCells(mask, samples);

    expect(filtered.cells).toEqual([{ x: 12, y: 11 }, { x: 27, y: 11 }]);
    expect(filtered.blocked).toBe(1);
    expect(filtered.structureCells).toBe(1);
  });

  it("자연도 높은 paint_road 가 요청 경로 주변만 칠한다(엉뚱한 들판 길 금지)", () => {
    const { ctx } = context();
    buildHouse(ctx, { x: 14, y: 7 }, 10, 10);

    expectOk(runTool(ctx, "paint_road", {
      mapId: MAP_ID,
      points: [{ x: 3, y: 12 }, { x: 36, y: 12 }],
      style: "dirt",
      naturalness: 0.9,
      seed: 1,
    }));

    const painted = [...roadKeys(mapOf(ctx))].map((key) => {
      const [x, y] = key.split(",").map(Number);
      return { x, y };
    });
    // 집 위(y<7)는 요청 경로(y=12)와 무관한 들판이다 — 여기 칠하면 우회로가 폭 셀을 이은 것.
    expect(painted.filter((cell) => cell.y < 7)).toEqual([]);
  });

  it("건물에 완전히 막히면 끊긴 길을 커밋하지 않고 좌표와 함께 거절한다", () => {
    const { ctx } = context(12, 8);
    const map = mapOf(ctx);
    // 세로 벽으로 맵을 두 쪽으로 가른다 — 우회로가 존재할 수 없다.
    for (let y = 0; y < map.height; y += 1) map.lowerTiles[y * map.width + 6] = 374;
    const before = layerSnapshot(map, blockedCells(ctx.project, map));

    const result = runTool(ctx, "paint_road", {
      mapId: MAP_ID,
      points: [{ x: 2, y: 4 }, { x: 10, y: 4 }],
      style: "dirt",
      naturalness: 0,
    });

    expect(result.ok).toBe(false);
    expect(result.summary).toContain("끊깁");
    expect(result.summary).toContain("6,4");
    expect(changedCells(before, layerSnapshot(mapOf(ctx), before.keys()))).toEqual([]);
    expect(roadKeys(mapOf(ctx)).size).toBe(0);
  });

  it("끝점이 벽이면 벽 앞까지 깔고 endpointBlocked 로 알린다", () => {
    const { ctx } = context(12, 8);
    const map = mapOf(ctx);
    map.lowerTiles[4 * map.width + 9] = 374;

    const result = runTool(ctx, "paint_road", {
      mapId: MAP_ID,
      points: [{ x: 2, y: 4 }, { x: 9, y: 4 }],
      style: "dirt",
      naturalness: 0,
    });

    expectOk(result);
    const data = result.data as { endpointBlocked: boolean; disconnectedSegments: number };
    expect(data.endpointBlocked).toBe(true);
    expect(data.disconnectedSegments).toBe(0);
    expect((result.diff?.warnings ?? []).join(" ")).toContain("끝점");
    expect(mapOf(ctx).lowerTiles[4 * map.width + 9]).toBe(374);
  });

  it("나무는 길이 치운다 — 숲을 가로지르는 길이 뱀처럼 휘지 않는다", () => {
    const { ctx } = context(20, 10);
    const map = mapOf(ctx);
    // 나무 = 통행 불가 밑동(290) + ★수관(260).
    map.lowerTiles[5 * map.width + 9] = 290;
    map.upperTiles[5 * map.width + 9] = 260;

    expect(roadObstacleMaskFor(ctx.project, map)(9, 5)).toBe("open");

    const result = runTool(ctx, "paint_road", {
      mapId: MAP_ID,
      points: [{ x: 2, y: 5 }, { x: 17, y: 5 }],
      style: "dirt",
      naturalness: 0,
    });

    expectOk(result);
    expect((result.data as { detouredSegments: number }).detouredSegments).toBe(0);
    expect(isRoadTile(mapOf(ctx).lowerTiles[5 * map.width + 9] ?? TILE.EMPTY)).toBe(true);
  });

  it("물은 마른 우회로가 있으면 살리고, 없으면 건너며 좌표로 알린다", () => {
    const { ctx } = context(20, 10);
    const map = mapOf(ctx);
    for (let y = 0; y < map.height; y += 1) map.lowerTiles[y * map.width + 10] = TILE.WATER;

    const result = runTool(ctx, "paint_road", {
      mapId: MAP_ID,
      points: [{ x: 2, y: 5 }, { x: 17, y: 5 }],
      style: "dirt",
      naturalness: 0,
    });

    expectOk(result);
    const data = result.data as { disconnectedSegments: number; waterCrossings: number };
    expect(data.disconnectedSegments).toBe(0);
    expect(data.waterCrossings).toBeGreaterThan(0);
    expect(roadFragments(mapOf(ctx))).toBe(1);
    expect((result.diff?.warnings ?? []).join(" ")).toContain("다리");
  });

  it("lay_path 도 집 칸을 덮지 않는다(두 레이어 바이트 동일)", () => {
    const { ctx } = context();
    buildHouse(ctx, { x: 14, y: 5 }, 10, 9);
    const protectedCells = blockedCells(ctx.project, mapOf(ctx));
    expect(protectedCells.size).toBeGreaterThan(20);
    const before = layerSnapshot(mapOf(ctx), protectedCells);
    const houses = captureHouseProtection(ctx.project);

    const result = runTool(ctx, "lay_path", {
      mapId: MAP_ID,
      points: [{ x: 3, y: 9 }, { x: 36, y: 9 }],
      material: "흙길",
      naturalness: 0,
      seed: 5,
    });

    expectOk(result);
    expect(changedCells(before, layerSnapshot(mapOf(ctx), protectedCells))).toEqual([]);
    expect(captureHouseProtection(ctx.project)).toEqual(houses);
    expect(roadFragments(mapOf(ctx))).toBe(1);
    const data = result.data as { obstacleCells: number; structureCells: number; detouredSegments: number };
    expect(data.structureCells).toBeGreaterThan(0);
    expect(data.detouredSegments).toBeGreaterThan(0);
    expect((result.diff?.warnings ?? []).join(" ")).toContain("통행 불가");
  });

  it("stamp_structure road 템플릿의 길이 기존 집 지표면을 덮지 않는다", () => {
    const { ctx } = context(40, 32);
    buildHouse(ctx, { x: 2, y: 14 }, 10, 8);
    // 길이 덮으면 안 되는 것은 벽·지붕이 놓인 지표면이다(맨 잔디는 길이 덮어도 된다).
    const structureGround = [...blockedCells(ctx.project, mapOf(ctx))].filter((key) => {
      const [x, y] = key.split(",").map(Number);
      return (mapOf(ctx).lowerTiles[y * mapOf(ctx).width + x] ?? TILE.EMPTY) !== TILE.GRASS;
    });
    expect(structureGround.length).toBeGreaterThan(20);
    const before = groundSnapshot(mapOf(ctx), structureGround);
    const houses = captureHouseProtection(ctx.project);

    // road 템플릿의 십자 길(원점 기준 y+14~15)이 집 몸통을 지나가게 원점을 잡는다.
    expectOk(runTool(ctx, "stamp_structure", {
      mapId: MAP_ID,
      template: "road",
      origin: { x: 0, y: 0 },
      naturalness: 0,
    }));

    expect(changedCells(before, groundSnapshot(mapOf(ctx), structureGround))).toEqual([]);
    expect(captureHouseProtection(ctx.project)).toEqual(houses);
    // Fence rails/corners are independent single-cell units; keep the unprotected corner.
    expect(mapOf(ctx).upperTiles[15 * mapOf(ctx).width + 17]).toBe(410);
  });
});

describe("roads respect completed-house geometry", () => {
  it("blocks passable bbox gaps, empty ridge, deck attachment, and recorded placements only", () => {
    const { ctx } = context();
    const map = mapOf(ctx);
    map.layoutPlan = { version: 1, kind: "houses", regions: [
      { id: "deck", role: "house", label: "Deck", x: 10, y: 5, w: 8, h: 8,
        shape: "rooftop-deck", doorAt: { x: 12, y: 12 } },
    ] };
    map.upperTiles[13 * map.width + 15] = 322;
    map.lowerTiles[4 * map.width + 10] = TILE.EMPTY;
    map.structurePlacements = [{ id: "human", kitId: "human-kit", x: 25, y: 5, w: 2, h: 2,
      before: { lower: [], upper: [] }, afterHash: "recorded" }];
    const mask = roadObstacleMaskFor(ctx.project, map);
    expect(isPassable(ctx.project, map, 12, 8)).toBe(true);
    for (let y = 4; y < 13; y += 1) {
      for (let x = 10; x < 18; x += 1) expect(mask(x, y), `${x},${y}`).toBe("structure");
    }
    expect(mask(15, 13)).toBe("structure");
    expect(mask(14, 13)).toBe("open");
    expect(mask(25, 5)).toBe("structure");
    expect(mask(26, 6)).toBe("structure");
    expect(mask(25, 4)).toBe("open");
    expect(mask(9, 4)).toBe("open");
  });

  it.each([
    { tool: "paint_road", args: { style: "dirt" }, tile: DIRT_ROAD_TILE.BODY },
    { tool: "paint_road", args: { style: "sand" }, tile: SAND_TILE.BODY },
    { tool: "lay_path", args: { material: "흙길" }, tile: DIRT_ROAD_TILE.BODY },
  ])("$tool $tile preserves protected autotile neighbors and their stacks", ({ tool, args, tile }) => {
    const { ctx } = context();
    const map = mapOf(ctx);
    map.layoutPlan = { version: 1, kind: "houses", regions: [
      { id: "house", role: "house", label: "House", x: 10, y: 5, w: 8, h: 8 },
    ] };
    const ridge = 4 * map.width + 10;
    map.lowerTiles[ridge] = tile;
    map.lowerTileStacks = { [ridge]: [TILE.GRASS, tile] };
    map.upperTileStacks = { [ridge]: [] };
    const before = captureHouseProtection(ctx.project);
    expectOk(runTool(ctx, tool, { mapId: MAP_ID, points: [{ x: 3, y: 3 }, { x: 30, y: 3 }],
      naturalness: 0, ...args }));
    expect(captureHouseProtection(ctx.project)).toEqual(before);
    expect(mapOf(ctx).lowerTiles[3 * map.width + 3]).not.toBe(TILE.GRASS);
    expect(mapOf(ctx).lowerTiles[3 * map.width + 30]).not.toBe(TILE.GRASS);
  });

  it.each(["paint_road", "lay_path"])("%s rejects a metadata-only barrier instead of committing disconnected pieces", (tool) => {
    const { ctx } = context(12, 8);
    mapOf(ctx).layoutPlan = { version: 1, kind: "houses", regions: [
      { id: "barrier", role: "house", label: "Barrier", x: 6, y: 0, w: 1, h: 8 },
    ] };
    const before = structuredClone(ctx.project);
    const result = runTool(ctx, tool, { mapId: MAP_ID, points: [{ x: 2, y: 4 }, { x: 10, y: 4 }],
      naturalness: 0, ...(tool === "paint_road" ? { style: "dirt" } : { material: "흙길" }) });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe(tool === "paint_road" ? "road-blocked" : "path-blocked");
    expect(ctx.project).toEqual(before);
    expect(roadKeys(mapOf(ctx)).size).toBe(0);
  });
});
