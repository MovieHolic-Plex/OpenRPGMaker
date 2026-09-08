import type { GameMap, TilesetDef } from "../types";
import { LEGACY_INTERIOR_CABINET } from "./interiorCabinetLegacy";
import { structuralJson } from "@/util/structuralJson";

export function hasInteriorCabinetOverride(tileset: TilesetDef): boolean {
  const tiles = [148, 178];
  return tiles.some(tile => {
    const meta = tileset.tileMeta?.[tile];
    return meta?.source === "user" || meta?.origin === "user" || meta?.locked === true
      || meta?.userLocked === true || meta?.defaultLayer === "lower"
      || (meta?.defaultLayer === "upper" && tileset.priority[tile] === "lower")
      || tileset.tileGrafts?.some(graft => graft.targetTile === tile);
  }) || (tileset.tileGroups ?? []).some(group =>
    group.tileIds.some(tile => tiles.includes(tile))
    && (group.layerHome === "lower" || group.defaultLayer === "lower"));
}

export function repairLegacyInteriorCabinetKit(tileset: TilesetDef): boolean {
  if (tileset.image.type !== "bundled" || tileset.image.id !== "tex_easyrpg_chipset_interior"
    || hasInteriorCabinetOverride(tileset)) return false;
  const legacy = structuralJson(LEGACY_INTERIOR_CABINET);
  let changed = false;
  for (const kit of tileset.structureKits ?? []) {
    if (kit.kind !== "section" || structuralJson(kit) !== legacy) continue;
    kit.rows = [{ tiles: [-1], upperTiles: [148] }, { tiles: [-1], upperTiles: [178] }];
    changed = true;
  }
  return changed;
}

/**
 * Only known seed records have enough provenance to repair automatically.
 * Map tile membership (even beside a room plan or an untouched kit) cannot prove
 * per-cell authorship or recover the original floor. Keep those placed layers intact.
 */
export function repairInteriorTransparentPropLayers(project: { readonly maps: Record<string, GameMap>; readonly tilesets: Record<string, TilesetDef> }): boolean {
  let changed = false;
  for (const tileset of Object.values(project.tilesets)) {
    changed = repairLegacyInteriorCabinetKit(tileset) || changed;
  }
  return changed;
}
