import type { TileGroupMetadata, TilesetDef } from "@/project/types";
import { structuralJson } from "@/util/structuralJson";

// Complete factory output before the repeatable middle/right-cap correction.
// The source marker alone (or a matching ID) is never replacement authority.
const LEGACY: TileGroupMetadata = {
  id: "harness-interior-house-v1-tavern-table", name: "긴 탁자", role: "prop", defaultLayer: "upper",
  tileIds: [325, 326], description: "openFloor, 좌우 한 쌍", placementRules: "openFloor, 좌우 한 쌍",
  confidence: "high", source: "bundled-default", layerHome: "upper",
  rules: [{ id: "r_interior_long_table_h_pair", kind: "adjacency", strength: "hard",
    message: "긴 탁자 좌(325)는 우(326) 바로 왼쪽에 있어야 합니다 (hard cluster).",
    params: { a: 325, b: 326, relation: "aLeftOfB" } }],
  patternGrammar: { kind: "horizontal_expandable", axis: "horizontal", minWidth: 2, minHeight: 1,
    preserveCaps: true, repeat: "source_order",
    parts: [{ role: "leftCap", tileIds: [325] }, { role: "rightCap", tileIds: [326] }] },
};

export function hasInteriorLongTableOverride(tileset: TilesetDef): boolean {
  if (tileset.image.type !== "bundled" || tileset.image.id !== "tex_easyrpg_chipset_interior") return false;
  const tiles = [325, 326, 327];
  return tiles.some(tile => {
    const meta = tileset.tileMeta?.[tile];
    return meta?.source === "user" || meta?.origin === "user" || meta?.locked || meta?.userLocked
      || meta?.defaultLayer === "lower"
      || tileset.tileGrafts?.some(graft => graft.targetTile === tile);
  });
}

export function migrateLegacyInteriorLongTable(tileset: TilesetDef, replacement: TileGroupMetadata): boolean {
  if (tileset.image.type !== "bundled" || tileset.image.id !== "tex_easyrpg_chipset_interior"
    || tileset.tileSize !== 16 || tileset.tilesPerRow !== 30 || tileset.count !== 480
    || hasInteriorLongTableOverride(tileset)) return false;
  const matching = (tileset.tileGroups ?? []).filter(group => group.id === LEGACY.id);
  if (matching.length !== 1 || structuralJson(matching[0]) !== structuralJson(LEGACY)) return false;
  const index = tileset.tileGroups!.indexOf(matching[0]!);
  tileset.tileGroups![index] = replacement;
  return true;
}
