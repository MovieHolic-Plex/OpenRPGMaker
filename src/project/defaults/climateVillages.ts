import data from "@/assets/climateVillageTilesets.json";
import saved from "@/assets/sharedClimateVillageReferences.json";
import type { TilesetDef } from "../types";
import { referenceRevision, type TilesetReferenceCategory } from "../tilesetReferences";
import previousReferences from "../../../tiledata/climate-villages/previous-reference.json";

// Snow, volcano, desert and autumn repaints of the diverse forest-village sheet (scripts/content/build-climate-chipsets.py).
// Tile numbers match forest_harmony (grafts baked in); the snow sheet appends frozen copies of the water tiles, and
// snow, volcano and desert carry leafless trees from 2880 (tile groups bare-trees:*).
export type ClimateVillageKind = "snow" | "volcano" | "desert" | "autumn";
type Climate = (typeof data.climates)[ClimateVillageKind];
const CLIMATES = data.climates as Record<ClimateVillageKind, Climate>;
const CATEGORY_BY_TILESET = saved as unknown as Record<string, TilesetReferenceCategory>;

export const CLIMATE_VILLAGE_TEXTURES: Readonly<Record<string, ClimateVillageKind>> = Object.fromEntries(
  (Object.keys(CLIMATES) as ClimateVillageKind[]).map(kind => [CLIMATES[kind].textureKey, kind]));

export function climateVillageTilesetId(kind: ClimateVillageKind): string {
  return CLIMATES[kind].id;
}

/** Independent copy: shared base arrays + this climate's labels, appended ice tiles and extra autotile. */
export function createClimateVillageTileset(kind: ClimateVillageKind): TilesetDef {
  const climate = CLIMATES[kind];
  const base = structuredClone(data.base) as unknown as Omit<TilesetDef, "id" | "name" | "image" | "count">;
  const append = structuredClone(climate.append) as unknown as Pick<TilesetDef, "terrain" | "priority" | "passability" | "tileMeta">;
  const tileMeta = [...(base.tileMeta ?? []), ...(append.tileMeta ?? [])];
  for (const [tile, meta] of Object.entries(structuredClone(climate.metaPatch))) tileMeta[Number(tile)] = meta as NonNullable<TilesetDef["tileMeta"]>[number];
  const names = climate.autotileNames as Record<string, string>;
  const autotileGroups = [...(base.autotileGroups ?? []), ...(structuredClone(climate.extraAutotileGroups) as unknown as NonNullable<TilesetDef["autotileGroups"]>)]
    .map(group => names[group.id] ? { ...group, name: names[group.id]! } : group);
  // Leafless trees (bare-trees:*) on snow, volcano and desert; autumn has none.
  const tileGroups = [...(base.tileGroups ?? []), ...(structuredClone(climate.extraTileGroups) as unknown as NonNullable<TilesetDef["tileGroups"]>)];
  const tileset: TilesetDef = {
    ...base,
    id: climate.id,
    name: climate.name,
    image: { type: "bundled", id: climate.textureKey },
    count: climate.count,
    terrain: [...base.terrain, ...append.terrain],
    priority: [...base.priority, ...append.priority],
    passability: [...base.passability, ...append.passability],
    tileMeta,
    tileGroups,
    autotileGroups,
  };
  ensureClimateVillageReferences(tileset);
  return tileset;
}

/**
 * Climate tilesets saved before the leafless trees (2026-09-25) end at the old sheet size: grow them to the bundled
 * count (the appended cells and their bare-trees:* groups). Existing cells and user edits are left alone.
 */
export function ensureClimateBareTrees(tileset: TilesetDef): boolean {
  const kind = tileset.image.type === "bundled" ? CLIMATE_VILLAGE_TEXTURES[tileset.image.id] : undefined;
  if (!kind || CLIMATES[kind].id !== tileset.id || !CLIMATES[kind].extraTileGroups.length) return false;
  const have = new Set((tileset.tileGroups ?? []).map(g => g.id));
  const haveAuto = new Set((tileset.autotileGroups ?? []).map(g => g.id));
  const groups = CLIMATES[kind].extraTileGroups as unknown as { id: string }[];
  const autos = CLIMATES[kind].extraAutotileGroups as unknown as { id: string }[];
  // Cheap check first: a current tileset is left alone without building a fresh copy.
  if (tileset.count >= CLIMATES[kind].count && groups.every(g => have.has(g.id)) && autos.every(g => haveAuto.has(g.id))) return false;
  const fresh = createClimateVillageTileset(kind);
  let changed = false;
  if (tileset.count < fresh.count) {
    const from = tileset.count;
    tileset.terrain = [...tileset.terrain.slice(0, from), ...fresh.terrain.slice(from)];
    tileset.priority = [...tileset.priority.slice(0, from), ...fresh.priority.slice(from)];
    tileset.passability = [...tileset.passability.slice(0, from), ...fresh.passability.slice(from)];
    tileset.tileMeta = [...(tileset.tileMeta ?? []).slice(0, from), ...(fresh.tileMeta ?? []).slice(from)];
    tileset.count = fresh.count;
    changed = true;
  }
  const missing = (fresh.tileGroups ?? []).filter(g => (g.id.startsWith("bare-trees:") || g.id.startsWith("climate-terrain:")) && !have.has(g.id));
  if (missing.length) {
    tileset.tileGroups = [...(tileset.tileGroups ?? []), ...missing];
    changed = true;
  }
  // Climate ground autotiles (lava cracks, lava plates and pools, cracked earth — 2026-09-25).
  const missingAuto = (fresh.autotileGroups ?? []).filter(g => autos.some(a => a.id === g.id) && !haveAuto.has(g.id));
  if (missingAuto.length) {
    tileset.autotileGroups = [...(tileset.autotileGroups ?? []), ...missingAuto];
    changed = true;
  }
  return changed;
}

/** Add the shipped climate guidance once and retire unedited older revisions; authored or shared-from categories are left alone. */
export function ensureClimateVillageReferences(tileset: TilesetDef): boolean {
  const category = CATEGORY_BY_TILESET[tileset.id];
  const kind = tileset.image.type === "bundled" ? CLIMATE_VILLAGE_TEXTURES[tileset.image.id] : undefined;
  if (!category || !kind || CLIMATES[kind].id !== tileset.id || tileset.referenceSourceTilesetId) return false;
  // Retire exact shipped revisions only; keep any locally edited guidance.
  const kept = (tileset.referenceDocuments ?? []).filter(c => {
    const previous = previousReferences.find(p => p.id === c.id);
    return !previous || previous.revision !== referenceRevision(c);
  });
  const retired = kept.length !== (tileset.referenceDocuments ?? []).length;
  if (retired) tileset.referenceDocuments = kept;
  if (kept.some(c => c.id === category.id)) return retired;
  tileset.referenceDocuments = [...kept, structuredClone(category)];
  return true;
}
