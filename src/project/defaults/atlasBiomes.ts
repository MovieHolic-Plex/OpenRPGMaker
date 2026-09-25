import base from "@/assets/climateVillageTilesets.json";
import data from "@/assets/atlasBiomeTilesets.json";
import saved from "@/assets/sharedAtlasBiomeReferences.json";
import type { TilesetDef } from "../types";
import { referenceRevision, type TilesetReferenceCategory } from "../tilesetReferences";
import previousReferences from "../../../tiledata/atlas-biomes/previous-reference.json";

// Atlas biome sheets (scripts/content/build-atlas-biome-chipsets.py): eleven repaints of the diverse forest-village
// sheet — jungle, swamp, mushroom forest, crystal plain, badlands, savanna, taiga, tundra, blighted land, sky isles and
// tropical coast — each with drawn pieces of its own (giant trees, mangroves, giant mushrooms, crystals, acacias,
// spruces, cairns, obelisks, clouds, palms, corals…) from 3030, blob grounds, and (eight of them) a border block that
// paints the neighbour biome's lawn. Cells 0..2729 are forest_harmony's (same numbers, passage and layers).
export type AtlasBiomeKind = keyof typeof data.biomes;
type Biome = (typeof data.biomes)[AtlasBiomeKind];
const BIOMES = data.biomes as Record<AtlasBiomeKind, Biome>;
const CATEGORY_BY_TILESET = saved as unknown as Record<string, TilesetReferenceCategory>;

export const ATLAS_BIOME_TEXTURES: Readonly<Record<string, AtlasBiomeKind>> = Object.fromEntries(
  (Object.keys(BIOMES) as AtlasBiomeKind[]).map(kind => [BIOMES[kind].textureKey, kind]));

export function atlasBiomeTilesetId(kind: AtlasBiomeKind): string {
  return BIOMES[kind].id;
}

/** Independent copy: the shared forest-village base, this biome's labels, appended cells, groups and autotiles. */
export function createAtlasBiomeTileset(kind: AtlasBiomeKind): TilesetDef {
  const biome = BIOMES[kind];
  const shared = structuredClone(base.base) as unknown as Omit<TilesetDef, "id" | "name" | "image" | "count">;
  const append = structuredClone(biome.append) as unknown as Pick<TilesetDef, "terrain" | "priority" | "passability" | "tileMeta">;
  const tileMeta = [...(shared.tileMeta ?? []), ...(append.tileMeta ?? [])];
  for (const [tile, label] of Object.entries(biome.relabels as Record<string, string>)) {
    const meta = tileMeta[Number(tile)];
    if (!meta) continue;
    tileMeta[Number(tile)] = { ...meta, label, description: [meta.description, biome.relabelNote].filter(Boolean).join(" ") };
  }
  const names = biome.autotileNames as Record<string, string>;
  const autotileGroups = [...(shared.autotileGroups ?? []), ...(structuredClone(biome.extraAutotileGroups) as unknown as NonNullable<TilesetDef["autotileGroups"]>)]
    .map(group => names[group.id] ? { ...group, name: names[group.id]! } : group);
  const tileGroups = [...(shared.tileGroups ?? []), ...(structuredClone(biome.extraTileGroups) as unknown as NonNullable<TilesetDef["tileGroups"]>)];
  const tileset: TilesetDef = {
    ...shared,
    id: biome.id,
    name: biome.name,
    image: { type: "bundled", id: biome.textureKey },
    count: biome.count,
    terrain: [...shared.terrain, ...append.terrain],
    priority: [...shared.priority, ...append.priority],
    passability: [...shared.passability, ...append.passability],
    tileMeta,
    tileGroups,
    autotileGroups,
  };
  ensureAtlasBiomeReferences(tileset);
  return tileset;
}

/** Add the shipped biome guidance once and retire unedited older revisions; authored or shared-from categories are left alone. */
export function ensureAtlasBiomeReferences(tileset: TilesetDef): boolean {
  const category = CATEGORY_BY_TILESET[tileset.id];
  const kind = tileset.image.type === "bundled" ? ATLAS_BIOME_TEXTURES[tileset.image.id] : undefined;
  if (!category || !kind || BIOMES[kind].id !== tileset.id || tileset.referenceSourceTilesetId) return false;
  const kept = (tileset.referenceDocuments ?? []).filter(c => {
    const previous = (previousReferences as { id: string; revision: string }[]).find(p => p.id === c.id);
    return !previous || previous.revision !== referenceRevision(c);
  });
  const retired = kept.length !== (tileset.referenceDocuments ?? []).length;
  if (retired) tileset.referenceDocuments = kept;
  if (kept.some(c => c.id === category.id)) return retired;
  tileset.referenceDocuments = [...kept, structuredClone(category)];
  return true;
}
