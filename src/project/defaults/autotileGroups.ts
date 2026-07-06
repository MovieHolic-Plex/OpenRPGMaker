import type { AutotileGroup, TilesetDef } from "../types";
import { buildEdgeCornerVariantMap } from "./autotileEngine";
import { CHIPSET_TILE_GROUPS, DIRT_ROAD_TILE, SAND_TILE } from "./chipsetMapping";

// 내장 오토타일 기본 그룹 정의.
// 기존에 하드코딩돼 있던 흙길(road)/모래(sand) 셰이핑을 범용 엔진 데이터 모델로 표현한다.
// (호수/물 water 는 별도 4분할 렌더링 체계라 여기서 재배치하지 않고, 모래의 연결 이웃으로만 참여한다.)

// 흙길 표면 타일: 몸통 2종 + 변/모서리 8종. (BODY_ALT 는 연결/멤버로만 쓰이며 결과로는 배치되지 않음)
const ROAD_SURFACE_TILES: readonly number[] = [
  DIRT_ROAD_TILE.BODY,
  DIRT_ROAD_TILE.BODY_ALT,
  DIRT_ROAD_TILE.EDGE_NORTH,
  DIRT_ROAD_TILE.EDGE_SOUTH,
  DIRT_ROAD_TILE.EDGE_WEST,
  DIRT_ROAD_TILE.EDGE_EAST,
  DIRT_ROAD_TILE.CORNER_NORTH_WEST,
  DIRT_ROAD_TILE.CORNER_NORTH_EAST,
  DIRT_ROAD_TILE.CORNER_SOUTH_WEST,
  DIRT_ROAD_TILE.CORNER_SOUTH_EAST,
];

// 모래가 "물"과 연결된 것으로 간주하는 타일(기존 isSandCompatibleSurface = 모래 ∪ water).
const WATER_CONNECT_TILES: readonly number[] = CHIPSET_TILE_GROUPS.water;
// 모래 셰이핑을 유발하는 물 타일(기존 isSandOrWaterEdit = 모래 ∪ lake 오토타일).
const LAKE_TRIGGER_TILES: readonly number[] = [
  ...CHIPSET_TILE_GROUPS.lakeWaterBodyAnimationFrames,
  ...CHIPSET_TILE_GROUPS.lakeShoreEdgeAnimationFrames,
];
const SAND_SURFACE_TILES: readonly number[] = CHIPSET_TILE_GROUPS.sandGround;

export const DEFAULT_ROAD_AUTOTILE_GROUP: AutotileGroup = {
  id: "builtin_dirt_road",
  name: "흙길",
  neighborhood: 4,
  memberTileIds: [...ROAD_SURFACE_TILES],
  connectTileIds: [...ROAD_SURFACE_TILES],
  variantMap: buildEdgeCornerVariantMap({
    body: DIRT_ROAD_TILE.BODY,
    edgeN: DIRT_ROAD_TILE.EDGE_NORTH,
    edgeS: DIRT_ROAD_TILE.EDGE_SOUTH,
    edgeW: DIRT_ROAD_TILE.EDGE_WEST,
    edgeE: DIRT_ROAD_TILE.EDGE_EAST,
    cornerNW: DIRT_ROAD_TILE.CORNER_NORTH_WEST,
    cornerNE: DIRT_ROAD_TILE.CORNER_NORTH_EAST,
    cornerSW: DIRT_ROAD_TILE.CORNER_SOUTH_WEST,
    cornerSE: DIRT_ROAD_TILE.CORNER_SOUTH_EAST,
  }),
};

export const DEFAULT_SAND_AUTOTILE_GROUP: AutotileGroup = {
  id: "builtin_sand",
  name: "모래 지형",
  neighborhood: 4,
  memberTileIds: [...SAND_SURFACE_TILES],
  connectTileIds: [...SAND_SURFACE_TILES, ...WATER_CONNECT_TILES],
  triggerTileIds: [...SAND_SURFACE_TILES, ...LAKE_TRIGGER_TILES],
  variantMap: buildEdgeCornerVariantMap({
    body: SAND_TILE.BODY,
    edgeN: SAND_TILE.EDGE_NORTH,
    edgeS: SAND_TILE.EDGE_SOUTH,
    edgeW: SAND_TILE.EDGE_WEST,
    edgeE: SAND_TILE.EDGE_EAST,
    cornerNW: SAND_TILE.CORNER_NORTH_WEST,
    cornerNE: SAND_TILE.CORNER_NORTH_EAST,
    cornerSW: SAND_TILE.CORNER_SOUTH_WEST,
    cornerSE: SAND_TILE.CORNER_SOUTH_EAST,
  }),
};

// 순서 유지: 흙길 → 모래 (기존 shapeTerrainAfterLowerEdit 호출 순서와 동일).
export const DEFAULT_AUTOTILE_GROUPS: readonly AutotileGroup[] = [
  DEFAULT_ROAD_AUTOTILE_GROUP,
  DEFAULT_SAND_AUTOTILE_GROUP,
];

// 내장 기본 그룹을 사용자 편집 가능한 형태로 복제한다(UI '기본값 불러오기'용).
export function cloneDefaultAutotileGroups(): AutotileGroup[] {
  return DEFAULT_AUTOTILE_GROUPS.map((group) => ({
    ...group,
    memberTileIds: [...group.memberTileIds],
    connectTileIds: group.connectTileIds ? [...group.connectTileIds] : undefined,
    triggerTileIds: group.triggerTileIds ? [...group.triggerTileIds] : undefined,
    variantMap: { ...group.variantMap },
  }));
}

// 타일셋에 정의된 오토타일 그룹을 반환한다. 없으면 내장 기본 그룹(흙길/모래)으로 폴백.
export function autotileGroupsForTileset(tileset: TilesetDef | undefined): readonly AutotileGroup[] {
  if (tileset?.autotileGroups && tileset.autotileGroups.length > 0) return tileset.autotileGroups;
  return DEFAULT_AUTOTILE_GROUPS;
}
