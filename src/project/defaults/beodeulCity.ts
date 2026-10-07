// 버들항 v6 (로마풍 항구 도시, 100×100, 세 단) — the Python render (scripts/content/lib/city_v6) cut into one bundled
// 16px sheet. Built by scripts/content/build-beodeul-city.py (sheet + src/assets/beodeulCityTileset.json), references by
// scripts/content/prepare-beodeul-city-references.mjs (src/assets/beodeulCityReferences.json). openwiki/beodeul-city.md.
//
// Every cell of the city is a tile (lower = ground, upper = what the objects put over it); animated cells are
// consecutive frames with animationStrips. The structure kits are the districts and houses of the city, cut from it.
import data from "@/assets/beodeulCityTileset.json";
import references from "@/assets/beodeulCityReferences.json";
import { beodeulGroundReferences } from './beodeulGround';
import {ensureBeodeulFacilityKits} from './beodeulFacilities';
import {ensureBeodeulForms} from './beodeulForms';
import type { AutotileGroup, PassFlag, StructureKitDef, TileAiMetadata, TileGroupMetadata, TilesetDef } from "../types";
import type { TilesetReferenceCategory } from "../tilesetReferences";

export const BEODEUL_CITY_TEXTURE = "tex_beodeul_city";
export const BEODEUL_CITY_ID = "beodeul_city";
export const BEODEUL_CITY_TILE_COUNT: number = data.count;
export const BEODEUL_CITY_TILES_PER_ROW: number = data.tilesPerRow;
/**
 * 도시 시트(build-beodeul-city.py) 의 칸 수. 그 뒤(23,936~)는 버들항 변형 20곳에서 사용자가 고른 조각 칸이다
 * (scripts/content/beodeul-picks/bake_picks.py, 키트 `bd-pick-*`). 덧붙이기 전용 — 앞 칸 번호는 바뀌지 않는다.
 */
export const BEODEUL_CITY_BASE_COUNT = 23936;
/** 고른 조각 키트 id 머리. 번들이 소유한다(기존 사본에서 같은 id 는 번들 것으로 바꾼다). */
export const BEODEUL_PICK_KIT_PREFIX = "bd-pick-";
/**
 * 버들항은 처음부터 코드로 그린 생성 칩셋이다(2026-09-29 EasyRPG 계열 폐기 결정). 시트 JSON 은 "easyrpg" 로 적혀 있어
 * 숲마을과 같은 계열로 묶였고, 계열 검사가 버들항 맵에서 숲마을 새 맵으로 가는 것을 막지 못했다.
 */
export const BEODEUL_CITY_FAMILY = "oprn-atlas";
const REFERENCES = references as unknown as TilesetReferenceCategory[];

/** Independent copy of the shipped tileset, born with its reference documents. */
export function createBeodeulCityTileset(): TilesetDef {
  const tileset:TilesetDef = {
    id: BEODEUL_CITY_ID,
    name: data.name,
    image: { type: "bundled", id: BEODEUL_CITY_TEXTURE },
    kind: "custom",
    family: BEODEUL_CITY_FAMILY,
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
    referenceDocuments: [...structuredClone(REFERENCES),...beodeulGroundReferences()],
  };
  ensureBeodeulFacilityKits(tileset);
  ensureBeodeulForms(tileset);
  return tileset;
}

/**
 * Keep the shipped guidance current in older copies. The bundle owns every document/image whose id starts with `bd-`
 * (the learning result belongs to the bundle, not to one project row): a shipped category that is missing is added, and in a
 * shipped category that exists the `bd-` entries are replaced by the shipped ones. Entries an author added (other ids),
 * authored categories and shared pointers are left alone. Round 4 needed this: the round-3 copies still taught the square grid.
 */
export function ensureBeodeulCityReferences(tileset: TilesetDef): boolean {
  if (tileset.id !== BEODEUL_CITY_ID || tileset.image.type !== "bundled" || tileset.image.id !== BEODEUL_CITY_TEXTURE
    || tileset.referenceSourceTilesetId) return false;
  const own = (id: string) => id.startsWith("bd-");
  const cats = [...(tileset.referenceDocuments ?? [])];
  let changed = false;
  for (const shipped of REFERENCES) {
    const i = cats.findIndex(existing => existing.id === shipped.id);
    if (i < 0) { cats.push(structuredClone(shipped)); changed = true; continue; }
    const cur = cats[i]!;
    const next = { ...cur, name: shipped.name, description: shipped.description,
      documents: [...(cur.documents ?? []).filter(doc => !own(doc.id)), ...shipped.documents],
      images: [...(cur.images ?? []).filter(image => !own(image.id)), ...shipped.images] } as TilesetReferenceCategory;
    if (JSON.stringify(next) !== JSON.stringify(cur)) { cats[i] = structuredClone(next); changed = true; }
  }
  if (changed) tileset.referenceDocuments = cats;
  return changed;
}

/**
 * A copy cut from an older sheet (another cell count) points at tile numbers that no longer exist, so its cell tables are
 * replaced by the shipped ones (tile tables, groups, autotiles, kits, strips). Same-count copies — including ones whose
 * author added groups or kits — are left alone. When the cell tables are replaced, the shipped reference categories (same
 * category id) are replaced too: their cell numbers belong to the old sheet. Authored categories stay; missing shipped ones are
 * added by ensureBeodeulCityReferences. A same-count copy only gains the shipped kits it lacks (by kit id).
 *
 * Picked-parts extension (2026-10-01): the sheet grows only at the end (BEODEUL_CITY_BASE_COUNT onward = the picked Beodeul
 * variant parts). A copy whose count is between the base and the shipped count is the same city sheet with a shorter (or no)
 * picks tail, so it is extended in place: the cell tables from the base onward are taken from the bundle (the bundle owns that
 * range), animation strips in that range are replaced, bundle-owned `bd-pick-*` kits are replaced/added, and every other kit,
 * group and authored entry stays. Cells 0..base-1 are not touched, so maps painted on the city sheet do not change.
 */
export function ensureBeodeulCityTileset(tileset: TilesetDef): boolean {
  if (tileset.id !== BEODEUL_CITY_ID || tileset.image.type !== "bundled" || tileset.image.id !== BEODEUL_CITY_TEXTURE) return false;
  // 옛 사본은 계열이 "easyrpg" 로 들어 있다 — 생성 칩셋 계열로 고친다.
  const familyFixed = tileset.family !== BEODEUL_CITY_FAMILY;
  if (familyFixed) tileset.family = BEODEUL_CITY_FAMILY;
  const citySheet = tileset.autotileGroups?.some(group => group.id === "beodeul_road_autotile") ?? false;
  if (citySheet && tileset.count >= BEODEUL_CITY_BASE_COUNT) {
    // 더 새 번들에서 저장된 사본(꼬리가 더 긴 것)은 칸 표를 줄이지 않는다.
    if (tileset.count > data.count) return familyFixed;
    const extended = extendPickedParts(tileset);
    return mergeShippedKits(tileset) || extended || familyFixed;
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

/** Cell tables from BEODEUL_CITY_BASE_COUNT on are the bundle's: copy them in (and grow the copy to the shipped count). */
function extendPickedParts(tileset: TilesetDef): boolean {
  const base = BEODEUL_CITY_BASE_COUNT;
  const shippedPass = data.passability as PassFlag[];
  const shippedMeta = data.tileMeta as TileAiMetadata[];
  const same = tileset.count === data.count
    && JSON.stringify(tileset.passability.slice(base)) === JSON.stringify(shippedPass.slice(base))
    && JSON.stringify(tileset.priority.slice(base)) === JSON.stringify(data.priority.slice(base))
    && JSON.stringify((tileset.tileMeta ?? []).slice(base)) === JSON.stringify(shippedMeta.slice(base));
  const shippedStrips = data.animationStrips.filter(strip => strip.baseTile >= base);
  const ownStrips = (tileset.animationStrips ?? []).filter(strip => strip.baseTile >= base);
  if (same && JSON.stringify(ownStrips) === JSON.stringify(shippedStrips)) return false;
  tileset.count = data.count;
  tileset.passability = [...tileset.passability.slice(0, base), ...structuredClone(shippedPass.slice(base))];
  tileset.priority = [...tileset.priority.slice(0, base), ...(data.priority.slice(base) as ("lower" | "upper")[])];
  tileset.terrain = [...tileset.terrain.slice(0, base), ...data.terrain.slice(base)];
  tileset.tileMeta = [...(tileset.tileMeta ?? []).slice(0, base), ...structuredClone(shippedMeta.slice(base))];
  tileset.animationStrips = [...(tileset.animationStrips ?? []).filter(strip => strip.baseTile < base), ...structuredClone(shippedStrips)];
  return true;
}

/** Shipped kits the copy lacks are added (by id); bundle-owned `bd-pick-*` kits are replaced by the shipped ones. Others stay. */
function mergeShippedKits(tileset: TilesetDef): boolean {
  const shipped = data.structureKits as unknown as StructureKitDef[];
  const shippedById = new Map(shipped.map(kit => [kit.id, kit]));
  const current = tileset.structureKits ?? [];
  let changed = false;
  const kept = current.filter(kit => {
    if (!kit.id.startsWith(BEODEUL_PICK_KIT_PREFIX)) return true;
    const ship = shippedById.get(kit.id);
    if (!ship) { changed = true; return false; }                       // a pick that was dropped from the bundle
    if (JSON.stringify(ship) !== JSON.stringify(kit)) { changed = true; return false; }
    return true;
  });
  const have = new Set(kept.map(kit => kit.id));
  const missing = shipped.filter(kit => !have.has(kit.id));
  if (!missing.length && !changed) return false;
  tileset.structureKits = [...kept, ...structuredClone(missing)];
  return true;
}
