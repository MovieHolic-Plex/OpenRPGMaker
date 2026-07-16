import { describe, expect, it } from "vitest";
import {
  AUTOTILE_DIR,
  autotileEditTriggersGroup,
  autotileNeighborMask,
  autotileVariantForCell,
  autotileVariantForMask,
  buildEdgeCornerVariantMap,
  shapeAutotileGroupAround,
} from "@/project/defaults/autotileEngine";
import {
  DEFAULT_AUTOTILE_GROUPS,
  DEFAULT_ROAD_AUTOTILE_GROUP,
  DEFAULT_SAND_AUTOTILE_GROUP,
  autotileGroupsForTileset,
  cloneDefaultAutotileGroups,
} from "@/project/defaults/autotileGroups";
import { DIRT_ROAD_TILE, SAND_TILE } from "@/project/defaults/chipsetMapping";
import { createBlankProject, DEFAULT_TILESET_ID, TILE } from "@/project/defaults";
import type { AutotileGroup } from "@/project/types";

type MapView = { width: number; height: number; lowerTiles: number[] };

function mapFromRows(rows: readonly (readonly number[])[]): MapView {
  return { width: rows[0]?.length ?? 0, height: rows.length, lowerTiles: rows.flatMap((row) => [...row]) };
}

function at(map: MapView, x: number, y: number): number {
  return map.lowerTiles[y * map.width + x];
}

// 단순 대칭 오토타일 그룹: 몸통 0, 변/모서리 10~18.
const SIMPLE_TILES = {
  body: 10,
  edgeN: 11,
  edgeS: 12,
  edgeW: 13,
  edgeE: 14,
  cornerNW: 15,
  cornerNE: 16,
  cornerSW: 17,
  cornerSE: 18,
} as const;
const SIMPLE_MEMBERS = [SIMPLE_TILES.body, 11, 12, 13, 14, 15, 16, 17, 18];
const SIMPLE_GROUP: AutotileGroup = {
  id: "simple",
  name: "simple",
  neighborhood: 4,
  memberTileIds: SIMPLE_MEMBERS,
  variantMap: buildEdgeCornerVariantMap(SIMPLE_TILES),
};

describe("autotile bitmask engine", () => {
  it("계산한 4방향 비트마스크가 방향 비트와 일치한다", () => {
    // 중앙(1,1)만 멤버, 동/남 이웃만 멤버 → E|S 비트.
    const map = mapFromRows([
      [99, 99, 99],
      [99, 10, 10],
      [99, 10, 99],
    ]);
    const members = new Set(SIMPLE_MEMBERS);
    const mask = autotileNeighborMask(map, 1, 1, (t) => members.has(t), 4);
    expect(mask).toBe(AUTOTILE_DIR.E | AUTOTILE_DIR.S);
  });

  it("8방향에서 대각선 이웃 비트를 포함한다", () => {
    const map = mapFromRows([
      [10, 99, 99],
      [99, 10, 99],
      [99, 99, 99],
    ]);
    const members = new Set(SIMPLE_MEMBERS);
    const mask = autotileNeighborMask(map, 1, 1, (t) => members.has(t), 8);
    expect(mask & AUTOTILE_DIR.NW).toBe(AUTOTILE_DIR.NW);
    expect(mask & AUTOTILE_DIR.N).toBe(0);
  });

  it("variantMap 은 몸통/변/모서리 16종을 모두 매핑한다", () => {
    const variantMap = buildEdgeCornerVariantMap(SIMPLE_TILES);
    expect(Object.keys(variantMap)).toHaveLength(16);
    // 이웃 전무 → 좌상 모서리, 사방 연결 → 몸통.
    expect(variantMap[String(0)]).toBe(SIMPLE_TILES.cornerNW);
    const all = AUTOTILE_DIR.N | AUTOTILE_DIR.E | AUTOTILE_DIR.S | AUTOTILE_DIR.W;
    expect(variantMap[String(all)]).toBe(SIMPLE_TILES.body);
  });

  it("autotileVariantForMask 가 마스크로 타일을 조회한다", () => {
    // 북쪽만 없음 → 북쪽 변.
    const mask = AUTOTILE_DIR.E | AUTOTILE_DIR.S | AUTOTILE_DIR.W;
    expect(autotileVariantForMask(SIMPLE_GROUP, mask)).toBe(SIMPLE_TILES.edgeN);
  });

  it("autotileVariantForCell 은 멤버가 아닌 셀에는 undefined 를 반환한다", () => {
    const map = mapFromRows([[99]]);
    expect(autotileVariantForCell(map, SIMPLE_GROUP, 0, 0)).toBeUndefined();
  });

  it("shapeAutotileGroupAround 가 2x2 블록을 4모서리로 만든다", () => {
    const map = mapFromRows([
      [10, 10],
      [10, 10],
    ]);
    shapeAutotileGroupAround(map, SIMPLE_GROUP, [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]);
    expect(at(map, 0, 0)).toBe(SIMPLE_TILES.cornerNW);
    expect(at(map, 1, 0)).toBe(SIMPLE_TILES.cornerNE);
    expect(at(map, 0, 1)).toBe(SIMPLE_TILES.cornerSW);
    expect(at(map, 1, 1)).toBe(SIMPLE_TILES.cornerSE);
  });

  it("variantMap 에 매핑이 없으면 타일을 바꾸지 않는다", () => {
    const partial: AutotileGroup = { id: "p", name: "p", memberTileIds: [10], variantMap: {} };
    const map = mapFromRows([[10]]);
    shapeAutotileGroupAround(map, partial, [{ x: 0, y: 0 }]);
    expect(at(map, 0, 0)).toBe(10);
  });
});

describe("autotile trigger", () => {
  it("다음/이전 타일이 트리거 집합에 있으면 참", () => {
    expect(autotileEditTriggersGroup(SIMPLE_GROUP, undefined, 10)).toBe(true);
    expect(autotileEditTriggersGroup(SIMPLE_GROUP, 10, 99)).toBe(true);
    expect(autotileEditTriggersGroup(SIMPLE_GROUP, undefined, 99)).toBe(false);
  });

  it("모래 기본 그룹은 물 편집으로도 트리거된다", () => {
    expect(autotileEditTriggersGroup(DEFAULT_SAND_AUTOTILE_GROUP, undefined, TILE.WATER)).toBe(true);
  });
});

describe("built-in default groups reproduce legacy road/sand behavior", () => {
  it("흙길 2x2 → 4모서리", () => {
    const map = mapFromRows([
      [TILE.PATH, TILE.PATH],
      [TILE.PATH, TILE.PATH],
    ]);
    shapeAutotileGroupAround(map, DEFAULT_ROAD_AUTOTILE_GROUP, [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]);
    expect(at(map, 0, 0)).toBe(DIRT_ROAD_TILE.CORNER_NORTH_WEST);
    expect(at(map, 1, 0)).toBe(DIRT_ROAD_TILE.CORNER_NORTH_EAST);
    expect(at(map, 0, 1)).toBe(DIRT_ROAD_TILE.CORNER_SOUTH_WEST);
    expect(at(map, 1, 1)).toBe(DIRT_ROAD_TILE.CORNER_SOUTH_EAST);
  });

  it("모래는 인접 물을 연결된 이웃으로 취급한다", () => {
    // 중앙 모래의 서쪽 열이 전부 물, 나머지는 모래 → 물이 연결로 취급되어 8방 전부 연결 = 몸통.
    const map = mapFromRows([
      [TILE.WATER, TILE.SAND, TILE.SAND],
      [TILE.WATER, TILE.SAND, TILE.SAND],
      [TILE.WATER, TILE.SAND, TILE.SAND],
    ]);
    expect(autotileVariantForCell(map, DEFAULT_SAND_AUTOTILE_GROUP, 1, 1)).toBe(SAND_TILE.BODY);
    // 물을 비멤버(잔디)로 바꾸면 서쪽 연결이 끊겨 서쪽 변이 된다.
    const landMap = mapFromRows([
      [TILE.GRASS, TILE.SAND, TILE.SAND],
      [TILE.GRASS, TILE.SAND, TILE.SAND],
      [TILE.GRASS, TILE.SAND, TILE.SAND],
    ]);
    expect(autotileVariantForCell(landMap, DEFAULT_SAND_AUTOTILE_GROUP, 1, 1)).toBe(SAND_TILE.EDGE_WEST);
  });

  it("외딴 1칸 모래/흙길은 외딴 점 타일이 되고, 외딴 점을 칠하면 그대로 유지된다", () => {
    const map = mapFromRows([
      [TILE.GRASS, TILE.GRASS, TILE.GRASS],
      [TILE.GRASS, TILE.SAND, TILE.GRASS],
      [TILE.GRASS, TILE.GRASS, TILE.GRASS],
    ]);
    expect(autotileVariantForCell(map, DEFAULT_SAND_AUTOTILE_GROUP, 1, 1)).toBe(SAND_TILE.ISOLATED);
    const roadMap = mapFromRows([
      [TILE.GRASS, TILE.GRASS, TILE.GRASS],
      [TILE.GRASS, DIRT_ROAD_TILE.BODY, TILE.GRASS],
      [TILE.GRASS, TILE.GRASS, TILE.GRASS],
    ]);
    expect(autotileVariantForCell(roadMap, DEFAULT_ROAD_AUTOTILE_GROUP, 1, 1)).toBe(DIRT_ROAD_TILE.ISOLATED);
    // "363을 깔면 알아서 오토타일" 요건: 외딴 점 타일 자체를 칠해도 성형 후 그대로.
    const dotMap = mapFromRows([
      [TILE.GRASS, TILE.GRASS, TILE.GRASS],
      [TILE.GRASS, SAND_TILE.ISOLATED, TILE.GRASS],
      [TILE.GRASS, TILE.GRASS, TILE.GRASS],
    ]);
    shapeAutotileGroupAround(dotMap, DEFAULT_SAND_AUTOTILE_GROUP, [{ x: 1, y: 1 }]);
    expect(at(dotMap, 1, 1)).toBe(SAND_TILE.ISOLATED);
  });

  it("십자 교차로의 오목 코너 4칸은 합성 오목 타일이 된다", () => {
    // 3칸 폭 십자: 가로 rows 3~5, 세로 cols 3~5 (9x9).
    const S = TILE.SAND;
    const grid: number[][] = Array.from({ length: 9 }, () => Array<number>(9).fill(TILE.GRASS));
    for (let x = 0; x < 9; x++) for (let y = 3; y <= 5; y++) grid[y][x] = S;
    for (let y = 0; y < 9; y++) for (let x = 3; x <= 5; x++) grid[y][x] = S;
    const map = mapFromRows(grid);
    const points: { x: number; y: number }[] = [];
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if (at(map, x, y) === S) points.push({ x, y });
    shapeAutotileGroupAround(map, DEFAULT_SAND_AUTOTILE_GROUP, points);
    // 오목 4칸: 4방 모래 + 대각 1곳 잔디.
    for (const [x, y] of [[3, 3], [5, 3], [3, 5], [5, 5]] as const) {
      expect(at(map, x, y), `(${x},${y})`).toBe(SAND_TILE.INNER_CORNER);
    }
    // 교차 중심은 대각까지 전부 모래 → 몸통 유지.
    expect(at(map, 4, 4)).toBe(SAND_TILE.BODY);
    // 팔 끝 볼록 모서리는 기존 9-슬라이스 유지.
    expect(at(map, 3, 0)).toBe(SAND_TILE.CORNER_NORTH_WEST);
    expect(at(map, 5, 0)).toBe(SAND_TILE.CORNER_NORTH_EAST);
  });

  it("대각에 접한 셀만 편집해도 이웃 몸통이 오목 코너로 재성형된다(8방 재검사)", () => {
    const grid: number[][] = Array.from({ length: 5 }, () => Array<number>(5).fill(SAND_TILE.BODY));
    const map = mapFromRows(grid);
    // (0,0)을 잔디로 바꾼 편집 — 대각 이웃 (1,1)은 몸통에서 오목 코너로 바뀌어야 한다.
    map.lowerTiles[0] = TILE.GRASS;
    shapeAutotileGroupAround(map, DEFAULT_SAND_AUTOTILE_GROUP, [{ x: 0, y: 0 }]);
    expect(at(map, 1, 1)).toBe(SAND_TILE.INNER_CORNER);
  });

  it("autotileGroupsForTileset 는 기본 Combined Town에서만 내장 그룹으로 폴백한다", () => {
    // 내장 그룹 수가 늘어도 깨지지 않게 파생값으로 대조 (2026-07-17: 4→11종).
    expect(autotileGroupsForTileset(undefined)).toHaveLength(DEFAULT_AUTOTILE_GROUPS.length);
    const project = createBlankProject();
    expect(autotileGroupsForTileset(project.tilesets[DEFAULT_TILESET_ID])).toHaveLength(DEFAULT_AUTOTILE_GROUPS.length);
    // 던전은 내장 Combined Town 그룹으로 폴백하지 않고 자기 시드 그룹만 노출한다.
    const dungeonGroups = autotileGroupsForTileset(project.tilesets.easyrpg_chipset_dungeon);
    expect(dungeonGroups.every((group) => group.id.startsWith("harness-dungeon-v1-terrain-"))).toBe(true);
    expect(dungeonGroups.some((group) => group.id.startsWith("builtin_"))).toBe(false);
    // 병합 폴백: 흙길만 덮는 사용자 그룹이 영속돼 있어도 내장 모래 그룹은 살아있어야 한다.
    const withCustomRoad = structuredClone(project.tilesets[DEFAULT_TILESET_ID]!);
    withCustomRoad.autotileGroups = [
      { id: "custom_road", name: "커스텀 흙길", neighborhood: 8, memberTileIds: [DIRT_ROAD_TILE.BODY], variantMap: {} },
    ];
    const merged = autotileGroupsForTileset(withCustomRoad);
    expect(merged.map((group) => group.id)).toEqual([
      "custom_road",
      ...DEFAULT_AUTOTILE_GROUPS.filter((group) => group.id !== "builtin_dirt_road").map((group) => group.id),
    ]);
    const cloned = cloneDefaultAutotileGroups();
    expect(cloned).toHaveLength(DEFAULT_AUTOTILE_GROUPS.length);
    expect(cloned[0]?.memberTileIds).not.toBe(DEFAULT_ROAD_AUTOTILE_GROUP.memberTileIds);
  });
});
