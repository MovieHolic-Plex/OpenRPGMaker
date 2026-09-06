import { derivePatternGrammar } from "@/editor/tools/v3/rmTypeExpander";
import { buildEdgeCornerInnerVariantMap } from "@/project/defaults/autotileEngine";
import { DIRT_ROAD_TILE } from "@/project/defaults/chipsetMapping";
import { COMBINED_TOWN_HARNESS_PREFIX } from "@/project/tilesetHarness/combinedTownGroups";
import type { TileGroupMetadata, TileGroupRole, TilesetDef } from "@/project/types";

const ROOF_EAVE_TILE = 405;

type BuildPaletteGroupRole = "wall" | "door" | "window" | "roof" | "path" | "water" | "tree" | "prop";

const P = COMBINED_TOWN_HARNESS_PREFIX;

export const BUILD_PALETTE_GROUP_IDS: Record<BuildPaletteGroupRole, string> = {
  wall: `${P}plaster-wall-9slice`,
  door: `${P}doors`,
  window: `${P}windows`,
  roof: `${P}roof-wall-boundary`,
  path: `${P}dirt-road-autotile`,
  water: `${P}lake-water-autotile`,
  tree: `${P}conifer-tree`,
  prop: `${P}flower-props`,
};

export interface BuildPaletteGroupClaim {
  readonly name: string;
  readonly role: TileGroupRole;
  readonly layerHome: "lower" | "upper" | "perCell";
  readonly patternKind?: NonNullable<NonNullable<TileGroupMetadata["patternGrammar"]>["kind"]>;
}

export const BUILD_PALETTE_GROUP_CLAIMS: Record<BuildPaletteGroupRole, BuildPaletteGroupClaim> = {
  wall: { name: "흰 집 벽", role: "wall", layerHome: "lower", patternKind: "nine_slice_expandable" },
  door: { name: "문", role: "prop", layerHome: "lower", patternKind: "vertical_expandable" },
  window: { name: "창문", role: "prop", layerHome: "upper" },
  roof: { name: "직선 지붕", role: "roof", layerHome: "lower", patternKind: "horizontal_expandable" },
  path: { name: "흙길", role: "terrain", layerHome: "lower", patternKind: "autotile_3x3" },
  water: { name: "물", role: "water", layerHome: "lower" },
  tree: { name: "침엽수", role: "prop", layerHome: "perCell", patternKind: "vertical_expandable" },
  prop: { name: "꽃", role: "prop", layerHome: "upper" },
};

export function ensureBuildPaletteTileGroups(tileset: TilesetDef): void {
  for (const role of Object.keys(BUILD_PALETTE_GROUP_IDS) as BuildPaletteGroupRole[]) {
    const group = tileset.tileGroups?.find((entry) => entry.id === BUILD_PALETTE_GROUP_IDS[role]);
    if (!group) continue;
    const claim = BUILD_PALETTE_GROUP_CLAIMS[role];
    group.name = claim.name;
    group.role = claim.role;
    group.layerHome = claim.layerHome;
    group.defaultLayer = claim.layerHome === "perCell" ? "mixed" : claim.layerHome;
    group.origin = "user";
    group.source = "user";
    if (role === "door") {
      group.patternGrammar = {
        axis: "vertical",
        kind: "vertical_expandable",
        minHeight: 2,
        parts: [{ role: "top", tileIds: [116] }, { role: "bottom", tileIds: [146] }],
        preserveCaps: true,
        repeat: "body",
      };
    } else if (role === "roof") {
      // 처마(405)는 가로로 균일 반복되는 기와 — 캡 구분 없이 동일 타일. 파란 계열(406~) 혼입 금지.
      group.patternGrammar = {
        axis: "horizontal",
        kind: "horizontal_expandable",
        minWidth: 2,
        parts: [{ role: "leftCap", tileIds: [ROOF_EAVE_TILE] }, { role: "repeatBody", tileIds: [ROOF_EAVE_TILE] }, { role: "rightCap", tileIds: [ROOF_EAVE_TILE] }],
        preserveCaps: true,
        repeat: "body",
      };
    } else if (claim.patternKind && (!group.patternGrammar || group.patternGrammar.kind !== claim.patternKind)) {
      group.patternGrammar = derivePatternGrammar(claim.patternKind, group.tileIds, tileset, { groupId: group.id, name: group.name });
    }
  }
  // 프리셋 외 추가 승인 그룹 — 집 키트가 쓰는 벽 세트는 place_door/place_window의
  // "승인된 벽 어휘" 검사를 통과해야 한다 (연습08 기준 집의 목골 석벽).
  for (const groupId of EXTRA_APPROVED_GROUP_IDS) {
    const group = tileset.tileGroups?.find((entry) => entry.id === groupId);
    if (!group) continue;
    group.origin = "user";
    group.source = "user";
  }
  ensurePathAutotile(tileset);
}

const EXTRA_APPROVED_GROUP_IDS = [`${P}timber-stone-wall-9slice`, `${P}sand-autotile`] as const;

function ensurePathAutotile(tileset: TilesetDef): void {
  const id = `${P}build-palette-dirt-road-8`;
  // 항상 최신 정의로 재생성한다(멱등) — 오목 코너(362)/외딴 점(360)이 없는
  // 구버전 정의가 프로젝트에 영속돼 있으면 여기서 교체된다.
  const next = {
    id,
    name: "건축 팔레트 흙길 8방향",
    neighborhood: 8 as const,
    memberTileIds: [
      DIRT_ROAD_TILE.CORNER_NORTH_WEST, DIRT_ROAD_TILE.EDGE_NORTH, DIRT_ROAD_TILE.CORNER_NORTH_EAST,
      DIRT_ROAD_TILE.EDGE_WEST, DIRT_ROAD_TILE.BODY, DIRT_ROAD_TILE.EDGE_EAST,
      DIRT_ROAD_TILE.CORNER_SOUTH_WEST, DIRT_ROAD_TILE.EDGE_SOUTH, DIRT_ROAD_TILE.CORNER_SOUTH_EAST, DIRT_ROAD_TILE.BODY_ALT,
      DIRT_ROAD_TILE.ISOLATED, DIRT_ROAD_TILE.INNER_CORNER,
    ],
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
  const existingIndex = (tileset.autotileGroups ?? []).findIndex((group) => group.id === id);
  if (existingIndex >= 0) {
    tileset.autotileGroups = tileset.autotileGroups!.map((group, index) => (index === existingIndex ? next : group));
    return;
  }
  tileset.autotileGroups = [...(tileset.autotileGroups ?? []), next];
}
