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

export const FOREST_GROVE_WALK_GROUP = "forest_harmony_grove_walk_47";

const walkMeta = (meta: TileAiMetadata): TileAiMetadata => ({ ...meta,
  label: `${meta.label} · 지나감`, passage: "star",
  description: "쌍꾸르식 통행 가능한 수관(★). 일반 굽이숲 수관과 같은 그림이고 이어 그린다. 주인공이 밑으로 걸어 들어가고 캐릭터 위에 그려진다 — 숨은 길·보물 자리." });

/**
 * 쌍꾸르 관례의 «통행 가능한 수관»: 같은 굽이숲 픽셀을 새 슬롯에 한 벌 더 이식하고 ★(통행 + 상위)로 둔다.
 * ★ 는 이동 판정에서 건너뛰어 바닥(잔디)이 통행을 정하고(collision.layeredPassability), 런타임은 항상 캐릭터 위에 그린다
 * (characterDepth.mapUpperTileDepth) — 주인공이 잎 아래로 사라진다. 두 그룹은 서로를 이웃으로 세어 경계가 이어진다.
 * 원래 수관 슬롯·번호·동결 메타는 건드리지 않는다. 이미 있으면 아무것도 하지 않고 그룹을 돌려준다.
 */
export function ensureWalkableCanopy(tileset: TilesetDef): AutotileGroup | undefined {
  const existing = tileset.autotileGroups?.find(group => group.id === FOREST_GROVE_WALK_GROUP);
  if (existing) return existing;
  const grove = tileset.autotileGroups?.find(group => group.id === FOREST_GROVE_GROUP);
  if (!grove || tileset.image.type !== "bundled" || tileset.image.id !== "tex_forest_harmony") return undefined;
  const sources = new Map((tileset.tileGrafts ?? []).map(graft => [graft.targetTile, graft] as const));
  const tiles = [...forestCanopyTiles(grove)].sort((a, b) => a - b);
  if (tiles.some(tile => !sources.has(tile))) return undefined;
  const lastGraft = Math.max(-1, ...(tileset.tileGrafts ?? []).map(graft => graft.targetTile));
  const start = Math.ceil(Math.max(tileset.count, lastGraft + 1) / tileset.tilesPerRow) * tileset.tilesPerRow;
  const twin = new Map(tiles.map((tile, i) => [tile, start + i] as const));
  const count = Math.ceil((start + tiles.length) / tileset.tilesPerRow) * tileset.tilesPerRow;
  for (let tile = tileset.count; tile < count; tile++) setCanopySlot(tileset, tile, canopyMeta());
  tileset.count = count;
  for (const [tile, slot] of twin) {
    setCanopySlot(tileset, slot, walkMeta(tileset.tileMeta?.[tile] ?? canopyMeta()));
    tileset.passability[slot] = { up: true, down: true, left: true, right: true };
  }
  tileset.tileGrafts = [...(tileset.tileGrafts ?? []), ...tiles.map(tile => ({ ...sources.get(tile)!, targetTile: twin.get(tile)! }))];
  const walk: AutotileGroup = {
    ...grove,
    id: FOREST_GROVE_WALK_GROUP,
    name: "굽이숲 · 지나가는 수관(★)",
    memberTileIds: grove.memberTileIds.map(tile => twin.get(tile)!),
    connectTileIds: [...tiles, ...twin.values()],
    variantMap: Object.fromEntries(Object.entries(grove.variantMap).map(([mask, tile]) => [mask, twin.get(tile)!])),
    ...(grove.interiorVariants ? { interiorVariants: grove.interiorVariants.map(tier => tier.map(tile => twin.get(tile)!)) } : {}),
  };
  const joined: AutotileGroup = { ...grove, connectTileIds: [...(grove.connectTileIds ?? grove.memberTileIds), ...twin.values()] };
  tileset.autotileGroups = [...tileset.autotileGroups!.map(group => group === grove ? joined : group), walk];
  return walk;
}
