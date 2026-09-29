// 버들항 v6 (로마풍 항구 도시, 100×100, 세 단) — the Python render (scripts/content/lib/city_v6) cut into one bundled
// 16px sheet. Built by scripts/content/build-beodeul-city.py (sheet + src/assets/beodeulCityTileset.json), references by
// scripts/content/prepare-beodeul-city-references.mjs (src/assets/beodeulCityReferences.json). openwiki/beodeul-city.md.
//
// Every cell of the city is a tile (lower = ground, upper = what the objects put over it); animated cells are
// consecutive frames with animationStrips. The structure kits are the districts and houses of the city, cut from it.
import data from "@/assets/beodeulCityTileset.json";
import references from "@/assets/beodeulCityReferences.json";
import type { AutotileGroup, PassFlag, StructureKitDef, TileAiMetadata, TileGroupMetadata, TilesetDef } from "../types";
import type { TilesetReferenceCategory } from "../tilesetReferences";

export const BEODEUL_CITY_TEXTURE = "tex_beodeul_city";
export const BEODEUL_CITY_ID = "beodeul_city";
export const BEODEUL_CITY_TILE_COUNT: number = data.count;
export const BEODEUL_CITY_TILES_PER_ROW: number = data.tilesPerRow;
const REFERENCES = references as unknown as TilesetReferenceCategory[];

/** Independent copy of the shipped tileset, born with its reference documents. */
export function createBeodeulCityTileset(): TilesetDef {
  return {
    id: BEODEUL_CITY_ID,
    name: data.name,
    image: { type: "bundled", id: BEODEUL_CITY_TEXTURE },
    kind: "custom",
    family: data.family,
    tileSize: data.tileSize,
    tilesPerRow: data.tilesPerRow,
    count: data.count,
    passability: structuredClone(data.passability) as PassFlag[],
    priority: [...data.priority] as ("lower" | "upper")[],
    terrain: [...data.terrain],
    tileMeta: structuredClone(data.tileMeta) as TileAiMetadata[],
    tileGroups: structuredClone(data.tileGroups) as TileGroupMetadata[],
    animationStrips: structuredClone(data.animationStrips),
    structureKits: structuredClone(data.structureKits) as unknown as StructureKitDef[],
    autotileGroups: structuredClone(data.autotileGroups) as unknown as AutotileGroup[],
    referenceDocuments: structuredClone(REFERENCES),
  };
}

/** Add the shipped guidance to older copies; authored categories and shared pointers are left alone. */
export function ensureBeodeulCityReferences(tileset: TilesetDef): boolean {
  if (tileset.id !== BEODEUL_CITY_ID || tileset.image.type !== "bundled" || tileset.image.id !== BEODEUL_CITY_TEXTURE
    || tileset.referenceSourceTilesetId) return false;
  const missing = REFERENCES.filter(category => !(tileset.referenceDocuments ?? []).some(existing => existing.id === category.id));
  if (!missing.length) return false;
  tileset.referenceDocuments = [...(tileset.referenceDocuments ?? []), ...structuredClone(missing)];
  return true;
}

/**
 * A copy cut from an older sheet (another cell count) points at tile numbers that no longer exist, so its cell tables are
 * replaced by the shipped ones (tile tables, groups, autotiles, kits, strips). Same-count copies — including ones whose
 * author added groups or kits — are left alone. When the cell tables are replaced, the shipped reference categories (same
 * category id) are replaced too: their cell numbers belong to the old sheet. Authored categories stay; missing shipped ones are
 * added by ensureBeodeulCityReferences. A same-count copy only gains the shipped kits it lacks (by kit id).
 */
export function ensureBeodeulCityTileset(tileset: TilesetDef): boolean {
  if (tileset.id !== BEODEUL_CITY_ID || tileset.image.type !== "bundled" || tileset.image.id !== BEODEUL_CITY_TEXTURE) return false;
  if (tileset.count === data.count && tileset.autotileGroups?.some(group => group.id === "beodeul_road_autotile")) {
    // same sheet: only add shipped kits the copy does not have yet (round 3 block kits bd-block-*); authored and existing kits stay
    const have = new Set((tileset.structureKits ?? []).map(kit => kit.id));
    const missing = (data.structureKits as unknown as StructureKitDef[]).filter(kit => !have.has(kit.id));
    if (!missing.length) return false;
    tileset.structureKits = [...(tileset.structureKits ?? []), ...structuredClone(missing)];
    return true;
  }
  const fresh = createBeodeulCityTileset();
  tileset.count = fresh.count;
  tileset.tilesPerRow = fresh.tilesPerRow;
  tileset.passability = fresh.passability;
  tileset.priority = fresh.priority;
  tileset.terrain = fresh.terrain;
  tileset.tileMeta = fresh.tileMeta;
  tileset.tileGroups = fresh.tileGroups;
  tileset.animationStrips = fresh.animationStrips;
  tileset.structureKits = fresh.structureKits;
  tileset.autotileGroups = fresh.autotileGroups;
  if (!tileset.referenceSourceTilesetId && tileset.referenceDocuments?.length) {
    const shipped = new Map(REFERENCES.map(category => [category.id, category]));
    tileset.referenceDocuments = tileset.referenceDocuments.map(category => shipped.has(category.id) ? structuredClone(shipped.get(category.id)!) : category);
  }
  return true;
}
