import type { AutotileGroup, TilesetDef } from "../types";
import { buildEdgeCornerInnerVariantMap, type EdgeCornerInnerTileSet } from "./autotileEngine";
import { CHIPSET_TILE_GROUPS, COBBLE_TILE, DIRT_ROAD_TILE, FARMLAND_TILE, SAND_TILE } from "./chipsetMapping";
import { DEFAULT_TILES_PER_ROW, COMBINED_TOWN_TILESET_TEXTURE_KEY } from "./constants";

// 내장 오토타일 기본 그룹 정의.
// 기존에 하드코딩돼 있던 흙길(road)/모래(sand) 셰이핑을 범용 엔진 데이터 모델로 표현한다.
// (호수/물 water 는 별도 4분할 렌더링 체계라 여기서 재배치하지 않고, 모래의 연결 이웃으로만 참여한다.)

// 흙길 표면 타일: 몸통 2종 + 변/모서리 8종 + 외딴 점/오목 코너.
// (BODY_ALT 는 연결/멤버로만 쓰이며 결과로는 배치되지 않음)
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
  DIRT_ROAD_TILE.ISOLATED,
  DIRT_ROAD_TILE.INNER_CORNER,
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
  neighborhood: 8,
  memberTileIds: [...ROAD_SURFACE_TILES],
  connectTileIds: [...ROAD_SURFACE_TILES],
  variantMap: buildEdgeCornerInnerVariantMap({
    body: DIRT_ROAD_TILE.BODY,
    edgeN: DIRT_ROAD_TILE.EDGE_NORTH,
    edgeS: DIRT_ROAD_TILE.EDGE_SOUTH,
    edgeW: DIRT_ROAD_TILE.EDGE_WEST,
    edgeE: DIRT_ROAD_TILE.EDGE_EAST,
    cornerNW: DIRT_ROAD_TILE.CORNER_NORTH_WEST,
    cornerNE: DIRT_ROAD_TILE.CORNER_NORTH_EAST,
    cornerSW: DIRT_ROAD_TILE.CORNER_SOUTH_WEST,
    cornerSE: DIRT_ROAD_TILE.CORNER_SOUTH_EAST,
    isolated: DIRT_ROAD_TILE.ISOLATED,
    inner: DIRT_ROAD_TILE.INNER_CORNER,
  }),
};

export const DEFAULT_SAND_AUTOTILE_GROUP: AutotileGroup = {
  id: "builtin_sand",
  name: "모래 지형",
  neighborhood: 8,
  memberTileIds: [...SAND_SURFACE_TILES],
  connectTileIds: [...SAND_SURFACE_TILES, ...WATER_CONNECT_TILES],
  triggerTileIds: [...SAND_SURFACE_TILES, ...LAKE_TRIGGER_TILES],
  variantMap: buildEdgeCornerInnerVariantMap({
    body: SAND_TILE.BODY,
    edgeN: SAND_TILE.EDGE_NORTH,
    edgeS: SAND_TILE.EDGE_SOUTH,
    edgeW: SAND_TILE.EDGE_WEST,
    edgeE: SAND_TILE.EDGE_EAST,
    cornerNW: SAND_TILE.CORNER_NORTH_WEST,
    cornerNE: SAND_TILE.CORNER_NORTH_EAST,
    cornerSW: SAND_TILE.CORNER_SOUTH_WEST,
    cornerSE: SAND_TILE.CORNER_SOUTH_EAST,
    isolated: SAND_TILE.ISOLATED,
    inner: SAND_TILE.INNER_CORNER,
  }),
};

function templateSurfaceTiles(tiles: Record<keyof typeof COBBLE_TILE, number>): number[] {
  return [
    tiles.BODY,
    tiles.EDGE_NORTH,
    tiles.EDGE_SOUTH,
    tiles.EDGE_WEST,
    tiles.EDGE_EAST,
    tiles.CORNER_NORTH_WEST,
    tiles.CORNER_NORTH_EAST,
    tiles.CORNER_SOUTH_WEST,
    tiles.CORNER_SOUTH_EAST,
    tiles.ISOLATED,
    tiles.INNER_CORNER,
  ];
}

// 포석(돌길) — 129 템플릿 블록. RM2003식 3×4(외딴+오목+3×3) 정본 (2026-07-16).
export const DEFAULT_COBBLE_AUTOTILE_GROUP: AutotileGroup = {
  id: "builtin_cobble",
  name: "포석",
  neighborhood: 8,
  memberTileIds: templateSurfaceTiles(COBBLE_TILE),
  connectTileIds: templateSurfaceTiles(COBBLE_TILE),
  variantMap: buildEdgeCornerInnerVariantMap({
    body: COBBLE_TILE.BODY,
    edgeN: COBBLE_TILE.EDGE_NORTH,
    edgeS: COBBLE_TILE.EDGE_SOUTH,
    edgeW: COBBLE_TILE.EDGE_WEST,
    edgeE: COBBLE_TILE.EDGE_EAST,
    cornerNW: COBBLE_TILE.CORNER_NORTH_WEST,
    cornerNE: COBBLE_TILE.CORNER_NORTH_EAST,
    cornerSW: COBBLE_TILE.CORNER_SOUTH_WEST,
    cornerSE: COBBLE_TILE.CORNER_SOUTH_EAST,
    isolated: COBBLE_TILE.ISOLATED,
    inner: COBBLE_TILE.INNER_CORNER,
  }),
};

// 경작지(밭고랑+새싹) — 126 템플릿 블록.
export const DEFAULT_FARMLAND_AUTOTILE_GROUP: AutotileGroup = {
  id: "builtin_farmland",
  name: "경작지",
  neighborhood: 8,
  memberTileIds: templateSurfaceTiles(FARMLAND_TILE),
  connectTileIds: templateSurfaceTiles(FARMLAND_TILE),
  variantMap: buildEdgeCornerInnerVariantMap({
    body: FARMLAND_TILE.BODY,
    edgeN: FARMLAND_TILE.EDGE_NORTH,
    edgeS: FARMLAND_TILE.EDGE_SOUTH,
    edgeW: FARMLAND_TILE.EDGE_WEST,
    edgeE: FARMLAND_TILE.EDGE_EAST,
    cornerNW: FARMLAND_TILE.CORNER_NORTH_WEST,
    cornerNE: FARMLAND_TILE.CORNER_NORTH_EAST,
    cornerSW: FARMLAND_TILE.CORNER_SOUTH_WEST,
    cornerSE: FARMLAND_TILE.CORNER_SOUTH_EAST,
    isolated: FARMLAND_TILE.ISOLATED,
    inner: FARMLAND_TILE.INNER_CORNER,
  }),
};

// RM2K식 3×4 템플릿 블록 공식: 앵커(블록 좌상단) 하나로 11역할 좌표를 계산한다.
// 윗줄 [외딴, (미사용 변형), 오목] + 아래 3×3 [NW·N·NE / W·몸통·E / SW·S·SE].
// 에디터 위저드 buildTemplateGroup("oprn-3x4")과 동일한 공식 — 회귀 테스트로 상호 대조한다.
export function templateBlockFromAnchor(anchor: number): EdgeCornerInnerTileSet {
  const row = DEFAULT_TILES_PER_ROW;
  return {
    isolated: anchor,
    inner: anchor + 2,
    cornerNW: anchor + row,
    edgeN: anchor + row + 1,
    cornerNE: anchor + row + 2,
    edgeW: anchor + row * 2,
    body: anchor + row * 2 + 1,
    edgeE: anchor + row * 2 + 2,
    cornerSW: anchor + row * 3,
    edgeS: anchor + row * 3 + 1,
    cornerSE: anchor + row * 3 + 2,
  };
}

function templateBlockGroup(id: string, name: string, anchor: number): AutotileGroup {
  const tiles = templateBlockFromAnchor(anchor);
  const members = [
    tiles.body, tiles.edgeN, tiles.edgeS, tiles.edgeW, tiles.edgeE,
    tiles.cornerNW, tiles.cornerNE, tiles.cornerSW, tiles.cornerSE,
    tiles.isolated, tiles.inner,
  ];
  return {
    id,
    name,
    neighborhood: 8,
    memberTileIds: members,
    connectTileIds: [...members],
    variantMap: buildEdgeCornerInnerVariantMap(tiles),
  };
}

// 시트 지형 앵커 격자(4행 밴드 × 열 0/3/6/9)의 나머지 블록 7종 (2026-07-17 사용자 확정).
// 주의: 앵커 240(잔디)은 TILE.GRASS=240 — 맵 기본 바닥 그 자체라 성형 그룹으로 승격하지 않는다
// (전 맵이 멤버가 되어 인접 편집마다 기본 잔디를 재도색하는 회귀). 잔디는 grass-autotile 문법 그룹 전담.
export const DEFAULT_SNOW_AUTOTILE_GROUP = templateBlockGroup("builtin_snow", "눈", 6);
export const DEFAULT_UNDERGROWTH_AUTOTILE_GROUP = templateBlockGroup("builtin_undergrowth", "짙은 수풀", 9);
export const DEFAULT_TALL_GRASS_AUTOTILE_GROUP = templateBlockGroup("builtin_tall_grass", "키큰 풀", 243);
// 246/249 블록은 석축 테두리 단(성벽 상단/축대) — 통행성은 기존 stoneWall 분류(solid) 그대로.
export const DEFAULT_STONE_COURT_AUTOTILE_GROUP = templateBlockGroup("builtin_stone_court", "석축 단(석판)", 246);
export const DEFAULT_GRAVEL_COURT_AUTOTILE_GROUP = templateBlockGroup("builtin_gravel_court", "석축 단(자갈)", 249);
// 366/369 블록은 어둠(심연) 바닥 — 통행성은 기존 darkWallBody 분류(solid) 그대로.
export const DEFAULT_DARKNESS_AUTOTILE_GROUP = templateBlockGroup("builtin_darkness", "어둠(석축 테)", 366);
export const DEFAULT_DARKNESS_DEEP_AUTOTILE_GROUP = templateBlockGroup("builtin_darkness_deep", "어둠(짙은 테)", 369);

// 지형 템플릿 앵커 카탈로그 — openwiki/autotiles.md 표와 유닛 테스트가 이 상수를 대조한다.
// kind: group=내장 오토타일 그룹, water=별도 물 시스템(쿼터/애니), base=기본 바닥(승격 금지), strip=애니 스트립.
export const TERRAIN_TEMPLATE_ANCHORS: readonly {
  readonly anchor: number;
  readonly label: string;
  readonly kind: "group" | "water" | "base" | "strip";
  readonly groupId?: string;
}[] = [
  { anchor: 0, label: "호수 물가", kind: "water" },
  { anchor: 3, label: "석축 수로", kind: "strip" },
  { anchor: 6, label: "눈", kind: "group", groupId: "builtin_snow" },
  { anchor: 9, label: "짙은 수풀", kind: "group", groupId: "builtin_undergrowth" },
  { anchor: 120, label: "물 몸통", kind: "water" },
  { anchor: 123, label: "폭포", kind: "water" },
  { anchor: 126, label: "경작지", kind: "group", groupId: "builtin_farmland" },
  { anchor: 129, label: "포석", kind: "group", groupId: "builtin_cobble" },
  { anchor: 240, label: "잔디(기본 바닥)", kind: "base" },
  { anchor: 243, label: "키큰 풀", kind: "group", groupId: "builtin_tall_grass" },
  { anchor: 246, label: "석축 단(석판)", kind: "group", groupId: "builtin_stone_court" },
  { anchor: 249, label: "석축 단(자갈)", kind: "group", groupId: "builtin_gravel_court" },
  { anchor: 360, label: "흙길", kind: "group", groupId: "builtin_dirt_road" },
  { anchor: 363, label: "모래", kind: "group", groupId: "builtin_sand" },
  { anchor: 366, label: "어둠(석축 테)", kind: "group", groupId: "builtin_darkness" },
  { anchor: 369, label: "어둠(짙은 테)", kind: "group", groupId: "builtin_darkness_deep" },
];

// 순서 유지: 흙길 → 모래 (기존 shapeTerrainAfterLowerEdit 호출 순서와 동일) → 포석 → 경작지 → 신규 7종.
export const DEFAULT_AUTOTILE_GROUPS: readonly AutotileGroup[] = [
  DEFAULT_ROAD_AUTOTILE_GROUP,
  DEFAULT_SAND_AUTOTILE_GROUP,
  DEFAULT_COBBLE_AUTOTILE_GROUP,
  DEFAULT_FARMLAND_AUTOTILE_GROUP,
  DEFAULT_SNOW_AUTOTILE_GROUP,
  DEFAULT_UNDERGROWTH_AUTOTILE_GROUP,
  DEFAULT_TALL_GRASS_AUTOTILE_GROUP,
  DEFAULT_STONE_COURT_AUTOTILE_GROUP,
  DEFAULT_GRAVEL_COURT_AUTOTILE_GROUP,
  DEFAULT_DARKNESS_AUTOTILE_GROUP,
  DEFAULT_DARKNESS_DEEP_AUTOTILE_GROUP,
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

// 타일셋에 정의된 오토타일 그룹을 반환한다.
// 기본 Combined Town 타일셋에서는 내장 기본 그룹(흙길/모래)을 "보완 폴백"으로 병합한다 —
// 사용자/하네스 정의 그룹이 멤버를 하나라도 덮는 내장 그룹만 제외(정의 우선).
// (예: 건축 팔레트가 흙길 8방 그룹만 영속시킨 프로젝트에서 모래 오토타일이 죽는 회귀 방지)
export function autotileGroupsForTileset(tileset: TilesetDef | undefined): readonly AutotileGroup[] {
  const custom = tileset?.autotileGroups ?? [];
  const isDefaultTileset = !tileset || (tileset.image.type === "bundled" && tileset.image.id === COMBINED_TOWN_TILESET_TEXTURE_KEY);
  if (!isDefaultTileset) return custom;
  if (custom.length === 0) return DEFAULT_AUTOTILE_GROUPS;
  const coveredMembers = new Set<number>(custom.flatMap((group) => group.memberTileIds));
  const builtinFallback = DEFAULT_AUTOTILE_GROUPS.filter(
    (group) => !group.memberTileIds.some((tileId) => coveredMembers.has(tileId))
  );
  return [...custom, ...builtinFallback];
}
