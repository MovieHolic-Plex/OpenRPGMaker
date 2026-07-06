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
    // 중앙 모래의 서쪽만 물, 나머지는 모래 → 물이 연결로 취급되어 사방 연결 = 몸통.
    const map = mapFromRows([
      [99, TILE.SAND, 99],
      [TILE.WATER, TILE.SAND, TILE.SAND],
      [99, TILE.SAND, 99],
    ]);
    expect(autotileVariantForCell(map, DEFAULT_SAND_AUTOTILE_GROUP, 1, 1)).toBe(SAND_TILE.BODY);
    // 물을 비멤버(잔디)로 바꾸면 서쪽 연결이 끊겨 서쪽 변이 된다.
    const landMap = mapFromRows([
      [99, TILE.SAND, 99],
      [TILE.GRASS, TILE.SAND, TILE.SAND],
      [99, TILE.SAND, 99],
    ]);
    expect(autotileVariantForCell(landMap, DEFAULT_SAND_AUTOTILE_GROUP, 1, 1)).toBe(SAND_TILE.EDGE_WEST);
  });

  it("autotileGroupsForTileset 는 기본 Combined Town에서만 내장 그룹으로 폴백한다", () => {
    expect(autotileGroupsForTileset(undefined)).toHaveLength(2);
    const project = createBlankProject();
    expect(autotileGroupsForTileset(project.tilesets[DEFAULT_TILESET_ID])).toHaveLength(2);
    expect(autotileGroupsForTileset(project.tilesets.easyrpg_chipset_dungeon)).toHaveLength(0);
    const cloned = cloneDefaultAutotileGroups();
    expect(cloned).toHaveLength(2);
    expect(cloned[0]?.memberTileIds).not.toBe(DEFAULT_ROAD_AUTOTILE_GROUP.memberTileIds);
  });
});
