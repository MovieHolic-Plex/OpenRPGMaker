import canopy from "@/assets/forestGroveCanopy.json";
import type { AutotileGroup, TileAiMetadata, TilesetDef } from "../types";

export const FOREST_GROVE_GROUP = "forest_harmony_grove_47";

/** Climate repaints bake every graft into the sheet, the interior variants included (build-climate-chipsets.py). */
const BAKED_CANOPY_TEXTURES = new Set(["tex_forest_harmony_snow", "tex_forest_harmony_volcano", "tex_forest_harmony_desert", "tex_forest_harmony_autumn"]);

const CANOPY_COUNT = canopy.sources.length;
const INTERIOR_COUNT = canopy.interior.sources.length;
const solid = () => ({ up: false, down: false, left: false, right: false });
const canopyMeta = (): TileAiMetadata => ({ label: "굽이숲 수관", description: "굽이숲 수관 이식 칸. 상위·통행 불가.",
  source: "user", passage: "solid", userLocked: true, defaultLayer: "upper", layerBacking: "none" });
function interiorMeta(k: number): TileAiMetadata {
  const [depth, leaf] = canopy.interior.variants[k]!;
  const where = depth === 1 ? "얕은 속(2칸 안에 빈 땅)" : "깊은 속";
  return { label: `굽이숲 수관 속 · ${depth === 1 ? "얕음" : "깊음"} ${leaf + 1}`,
    description: `굽이숲 수관의 잎 채움 ${where}. 8방향이 모두 수관인 칸에만 놓는다(칠하는 도구가 위치로 고른다). 상위·통행 불가.`,
    source: "user", passage: "solid", userLocked: true, defaultLayer: "upper", layerBacking: "none" };
}

/** Tier ids of the full canopy cell: canopy offsets < 47 are slots from `start`, the rest from `interiorStart`. */
function interiorTiers(start: number, interiorStart: number): number[][] {
  return canopy.interior.tiers.map(tier => tier.map(offset => offset < CANOPY_COUNT ? start + offset : interiorStart + offset - CANOPY_COUNT));
}

/** Every tile of the grove canopy: the 47 autotile variants and the depth variants of its full cell. */
export function forestCanopyTiles(group: Pick<AutotileGroup, "memberTileIds" | "variantMap" | "interiorVariants">): Set<number> {
  return new Set([...group.memberTileIds, ...Object.values(group.variantMap), ...(group.interiorVariants ?? []).flat()]);
}

function setCanopySlot(tileset: TilesetDef, tile: number, meta: TileAiMetadata): void {
  tileset.terrain[tile] = 0;
  tileset.priority[tile] = "upper";
  tileset.passability[tile] = solid();
  (tileset.tileMeta ??= [])[tile] = meta;
}

/** Append approved reference pixels through normal graft/export support. Never
 * replace old canopy slots, locked metadata, or a user's existing extension. */
export function ensureForestGroveTileset(tileset: TilesetDef): void {
  if (tileset.image.type !== "bundled" || tileset.image.id !== "tex_forest_harmony") return;
  if (tileset.autotileGroups?.some(group => group.id === FOREST_GROVE_GROUP)) { ensureForestGroveInterior(tileset); return; }
  const lastGraft = Math.max(-1, ...(tileset.tileGrafts ?? []).map(graft => graft.targetTile));
  const start = Math.ceil(Math.max(tileset.count, lastGraft + 1) / tileset.tilesPerRow) * tileset.tilesPerRow;
  const interiorStart = start + CANOPY_COUNT;
  const members = Array.from({ length: CANOPY_COUNT + INTERIOR_COUNT }, (_, i) => start + i);
  const group: AutotileGroup = {
    id: FOREST_GROVE_GROUP, name: "굽이숲 · 이어진 수관", neighborhood: 8,
    memberTileIds: members, connectTileIds: members,
    variantMap: Object.fromEntries(canopy.variants.map((offset, mask) => [String(mask), start + offset])),
    interiorVariants: interiorTiers(start, interiorStart),
  };
  tileset.count = Math.ceil((start + members.length) / tileset.tilesPerRow) * tileset.tilesPerRow;
  tileset.tileMeta ??= [];
  for (let tile = start; tile < tileset.count; tile++) {
    const k = tile - interiorStart;
    setCanopySlot(tileset, tile, k >= 0 && k < INTERIOR_COUNT ? interiorMeta(k) : canopyMeta());
  }
  tileset.tileGrafts = [...(tileset.tileGrafts ?? []), ...[...canopy.sources, ...canopy.interior.sources].map((sourceTile, i) => ({
    sourceChipset: canopy.sourceChipset, sourceTile, targetTile: start + i,
  }))];
  tileset.autotileGroups = [...(tileset.autotileGroups ?? []), group];
}

/**
 * Give a grove made before the leaf interior its 11 depth variants (an old project, a catalog download, a climate
 * tileset). The 47 canopy slots keep their numbers; the new ones take the canopy's own padding right after it
 * (start+47.., 2597..2607 for the usual start 2550 — the shipped catalog and every climate sheet), else a fresh row
 * after the end. Climate sheets already carry the pixels there; forest_harmony gets grafts. Returns whether anything changed.
 */
export function ensureForestGroveInterior(tileset: TilesetDef): boolean {
  const group = tileset.autotileGroups?.find(candidate => candidate.id === FOREST_GROVE_GROUP);
  if (!group || group.interiorVariants || tileset.image.type !== "bundled") return false;
  const baked = BAKED_CANOPY_TEXTURES.has(tileset.image.id);
  if (!baked && tileset.image.id !== "tex_forest_harmony") return false;
  const full = group.variantMap["255"];
  const start = full === undefined ? undefined : full - canopy.variants[255]!;
  if (start === undefined || canopy.variants.some((offset, mask) => group.variantMap[String(mask)] !== start + offset)) return false;
  const grafted = new Set((tileset.tileGrafts ?? []).map(graft => graft.targetTile));
  const members = new Set(forestCanopyTiles(group));
  // Padding: the canopy slots' own label, no graft, not yet a member (or past the end, for forest_harmony).
  const padding = Array.from({ length: INTERIOR_COUNT }, (_, i) => start + CANOPY_COUNT + i).every(tile => !grafted.has(tile)
    && !members.has(tile) && (tile < tileset.count ? tileset.tileMeta?.[tile]?.label === canopyMeta().label : !baked));
  if (baked && !padding) return false;
  const interiorStart = padding ? start + CANOPY_COUNT
    : Math.ceil(Math.max(tileset.count, 1 + Math.max(-1, ...grafted)) / tileset.tilesPerRow) * tileset.tilesPerRow;
  const slots = Array.from({ length: INTERIOR_COUNT }, (_, i) => interiorStart + i);
  const count = Math.max(tileset.count, Math.ceil((interiorStart + INTERIOR_COUNT) / tileset.tilesPerRow) * tileset.tilesPerRow);
  // Rows appended past the old end: canopy padding like ensureForestGroveTileset's.
  for (let tile = tileset.count; tile < count; tile++) setCanopySlot(tileset, tile, canopyMeta());
  tileset.count = count;
  slots.forEach((tile, k) => setCanopySlot(tileset, tile, interiorMeta(k)));
  if (!baked) tileset.tileGrafts = [...(tileset.tileGrafts ?? []), ...canopy.interior.sources.map((sourceTile, i) => ({
    sourceChipset: canopy.sourceChipset, sourceTile, targetTile: slots[i]!,
  }))];
  const next: AutotileGroup = {
    ...group,
    memberTileIds: [...group.memberTileIds, ...slots],
    ...(group.connectTileIds ? { connectTileIds: [...group.connectTileIds, ...slots] } : {}),
    interiorVariants: interiorTiers(start, interiorStart),
  };
  tileset.autotileGroups = tileset.autotileGroups!.map(candidate => candidate === group ? next : candidate);
  return true;
}
