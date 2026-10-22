// 버들항 v6 (로마풍 항구 도시, 100×100, 세 단) — the Python render (scripts/content/lib/city_v6) cut into one bundled
// 16px sheet. Built by scripts/content/build-beodeul-city.py (sheet + src/assets/beodeulCityTileset.json), references by
// scripts/content/prepare-beodeul-city-references.mjs (src/assets/beodeulCityReferences.json). openwiki/beodeul-city.md.
//
// Every cell of the city is a tile (lower = ground, upper = what the objects put over it); animated cells are
// consecutive frames with animationStrips. The structure kits are the districts and houses of the city, cut from it.
import sheet from "@/assets/beodeulCitySheet.json";
import { bundledJson } from "./bundledJson";
/** 번들 정의 JSON — 처음 쓸 때 읽는다(bundledJson.ts). 칸 수·한 줄 폭은 같은 굽기가 쓰는 작은 시트 메타(`beodeulCitySheet.json`)에서 읽는다. */
const data = () => bundledJson("beodeulCityTileset");
import references from "@/assets/beodeulCityReferences.json";
import { beodeulGroundReferences } from './beodeulGround';
import {beodeulFacilityReferences,ensureBeodeulFacilityKits} from './beodeulFacilities';
import {beodeulFormsHostReferences,ensureBeodeulForms} from './beodeulForms';
import {beodeulReviewedHostReferences,ensureBeodeulReviewed} from './beodeulReviewed';
import type { AutotileGroup, PassFlag, StructureKitDef, TileAiMetadata, TileGroupMetadata, TilesetDef } from "../types";
import type { TilesetReferenceCategory } from "../tilesetReferences";
import { copyBundleEnd, relocateLocalTail, type LocalTailRelocation, type RelocationProject } from "./localTailRelocation";

/** 이번 실행에서 옮긴 사본 꼬리(진단용 — 로드 로그·증거 스크립트가 읽는다). */
export const beodeulTailRelocations: (LocalTailRelocation & { projectTileset: string })[] = [];

export const BEODEUL_CITY_TEXTURE = "tex_beodeul_city";
export const BEODEUL_CITY_ID = "beodeul_city";
export const BEODEUL_CITY_TILE_COUNT: number = sheet.count;
export const BEODEUL_CITY_TILES_PER_ROW: number = sheet.tilesPerRow;
/**
 * 도시 시트(build-beodeul-city.py) 의 칸 수. 그 뒤(23,936~)는 버들항 변형 20곳에서 사용자가 고른 조각 칸이다
 * (scripts/content/beodeul-picks/bake_picks.py, 키트 `bd-pick-*`). 덧붙이기 전용 — 앞 칸 번호는 바뀌지 않는다.
 */
export const BEODEUL_CITY_BASE_COUNT = 23936;
/**
 * 농장(beodeul_farm, 2026-10-13 첫 판 · 2026-10-14 2판 다시 그림 · 같은 날 3판 버들항 화풍 정렬 + 흙길 오토타일 `beodeul_farm_lane`·풀 무늬): 고른 조각 꼬리(27,648칸) 바로 뒤 768칸. 오토타일 `farmland`(농사 런타임이 경작지를 그릴 때 읽는 id)·
 * `farmland_watered`(런타임이 물 준 칸을 그릴 때 읽는 id), 작물 10칸, 울타리 13칸, 헛간 6×6·닭장 3×3, 키트 `bd-farm-*`. 번들이 소유하며 덧붙이기 전용이다
 * (scripts/content/beodeul-farm/bake_farm.py — 2판의 새 칸은 같은 768칸 안 빈 자리라 총 칸 수는 그대로다).
 */
export const BEODEUL_FARM_BASE = 27648;
export const BEODEUL_FARM_KIT_PREFIX = "bd-farm-";
export const BEODEUL_FARM_AUTOTILE_IDS: readonly string[] = ["farmland", "farmland_watered", "beodeul_farm_lane"];
/**
 * 던전 천장 테두리(2026-10-14 적대 QA, scripts/content/beodeul-dungeon/bake_dungeon_ceiling.py): 농장 꼬리(~28,415) 바로 뒤 한 행 128칸.
 * 변형 던전 렌더와 같은 함수(dlib.ceiling)로 자른 47 모양 × 결 2 + 허공 결 2. 오토타일 `beodeul_dungeon_ceiling`(+`_b`) —
 * author_beodeul_dungeon 이 방·통로 바깥 천장을 이 그룹으로 깔아 바닥·벽과 닿는 쪽마다 벽 두께 띠를 두른다. 번들 소유, 덧붙이기 전용.
 */
export const BEODEUL_DUNGEON_CEILING_BASE = 28416;
export const BEODEUL_DUNGEON_AUTOTILE_IDS: readonly string[] = ["beodeul_dungeon_ceiling", "beodeul_dungeon_ceiling_b"];
/**
 * 마을 성벽(2026-10-22, scripts/content/beodeul-wall/bake_wall.py · wall_art.py): 던전 천장 꼬리(~28,543) 바로 뒤 한 행 128칸(조각 88).
 * 3/4 성벽 통로·앞면·모서리·갈림목·끝 마감, 4×4 성문루(열림·닫힘), 2×6 망루, 계단. 키트 `bd-wall-*`, 칸 묶음 `beodeul:town_wall*`.
 * author_beodeul_town walls:"ring" 이 마을 둘레에 쓴다(beodeulTownWall.ts). 번들 소유, 덧붙이기 전용.
 */
export const BEODEUL_TOWN_WALL_BASE = 28544;
export const BEODEUL_WALL_KIT_PREFIX = "bd-wall-";
/** 고른 조각 키트 id 머리. 번들이 소유한다(기존 사본에서 같은 id 는 번들 것으로 바꾼다). */
export const BEODEUL_PICK_KIT_PREFIX = "bd-pick-";
/**
 * 버들항은 처음부터 코드로 그린 생성 칩셋이다(2026-09-29 EasyRPG 계열 폐기 결정). 시트 JSON 은 "easyrpg" 로 적혀 있어
 * 숲마을과 같은 계열로 묶였고, 계열 검사가 버들항 맵에서 숲마을 새 맵으로 가는 것을 막지 못했다.
 */
export const BEODEUL_CITY_FAMILY = "oprn-atlas";
const REFERENCES = references as unknown as TilesetReferenceCategory[];

/** 새 사본의 기본 참고문서(시설·형태·허용 건물 문서는 아래 create 의 ensure 들이 덧붙인다). */
function baseReferenceDocuments(): TilesetReferenceCategory[] {
  return [...structuredClone(REFERENCES),...beodeulGroundReferences()];
}

/**
 * 새 사본이 들고 태어나는 참고문서 전부 — `createBeodeulCityTileset().referenceDocuments` 와 같은 값을 정의 JSON 없이 만든다
 * (로드가 저장본에서 뺀 번들 참고문서를 되돌릴 때 쓴다, installReferenceOwners.ts). create 의 ensure 셋은 새 용도를 끝에 덧붙인다.
 * 용도 id 가 겹치면(합치기 규칙이 끼면) 통째로 만든 값을 쓴다.
 */
export function beodeulCityBundledReferenceDocuments(): TilesetReferenceCategory[] {
  const docs = baseReferenceDocuments();
  const ids = new Set(docs.map((category) => category.id));
  for (const category of [...beodeulFacilityReferences(), ...beodeulFormsHostReferences(), ...beodeulReviewedHostReferences()]) {
    if (ids.has(category.id)) return createBeodeulCityTileset().referenceDocuments ?? [];
    ids.add(category.id);
    docs.push(structuredClone(category));
  }
  return docs;
}

/** Independent copy of the shipped tileset, born with its reference documents. */
export function createBeodeulCityTileset(): TilesetDef {
  const tileset:TilesetDef = {
    id: BEODEUL_CITY_ID,
    name: data().name,
    image: { type: "bundled", id: BEODEUL_CITY_TEXTURE },
    kind: "custom",
    family: BEODEUL_CITY_FAMILY,
    tileSize: data().tileSize,
    tilesPerRow: sheet.tilesPerRow,
    count: sheet.count,
    passability: structuredClone(data().passability) as PassFlag[],
    priority: [...data().priority] as ("lower" | "upper")[],
    terrain: [...data().terrain],
    tileMeta: structuredClone(data().tileMeta) as TileAiMetadata[],
    tileGroups: structuredClone(data().tileGroups) as TileGroupMetadata[],
    animationStrips: structuredClone(data().animationStrips),
    structureKits: structuredClone(data().structureKits) as unknown as StructureKitDef[],
    autotileGroups: structuredClone(data().autotileGroups) as unknown as AutotileGroup[],
    referenceDocuments: baseReferenceDocuments(),
  };
  ensureBeodeulFacilityKits(tileset);
  ensureBeodeulForms(tileset);
  ensureBeodeulReviewed(tileset);
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
  // 성벽 꼬리를 받지 못한 사본(그 자리에 이식 칸이 있던 옛 사본)에는 성벽 참고문서를 심지 않는다 — 없는 칸을 가리키게 된다
  const hasWall = (tileset.tileMeta?.[BEODEUL_TOWN_WALL_BASE]?.label ?? "").includes("성벽");
  for (const shipped of REFERENCES) {
    if (shipped.id === "beodeul-town-wall" && !hasWall) continue;
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
export function ensureBeodeulCityTileset(tileset: TilesetDef, project?: RelocationProject): boolean {
  if (tileset.id !== BEODEUL_CITY_ID || tileset.image.type !== "bundled" || tileset.image.id !== BEODEUL_CITY_TEXTURE) return false;
  // 옛 사본은 계열이 "easyrpg" 로 들어 있다 — 생성 칩셋 계열로 고친다.
  const familyFixed = tileset.family !== BEODEUL_CITY_FAMILY;
  if (familyFixed) tileset.family = BEODEUL_CITY_FAMILY;
  const citySheet = tileset.autotileGroups?.some(group => group.id === "beodeul_road_autotile") ?? false;
  if (citySheet && tileset.count >= BEODEUL_CITY_BASE_COUNT) {
    // 사본의 번들 끝 = 바탕 이후 첫 이식 칸(없으면 칸 수). 더 새 번들에서 저장된 사본(번들 끝이 지금보다 뒤)은 칸 표를 줄이지 않는다.
    const copyEnd = copyBundleEnd(tileset, BEODEUL_CITY_BASE_COUNT);
    if (copyEnd > sheet.count) return familyFixed;
    // 그 뒤 프로젝트 이식 칸(민가·형태·허용 건물·바닥·공방 칸)이 지금 번들 꼬리(농장·던전 천장·성벽 …)와 겹치면 새 번들 끝 뒤로 통째로 민다 —
    // 이 칩셋을 쓰는 맵·킷·오토타일·changeTile 의 번호도 같이 고친다(localTailRelocation.ts). 그래야 기존 프로젝트도 새 꼬리를 받는다.
    const moved = project && copyEnd < sheet.count ? relocateLocalTail(project, tileset.id, BEODEUL_CITY_BASE_COUNT, sheet.count) : null;
    if (moved) beodeulTailRelocations.push({ projectTileset: tileset.id, ...moved });
    // 옮기지 못한 사본(프로젝트 없이 부른 경우)은 예전처럼 겹치는 꼬리를 받지 않는다.
    // 농장 꼬리(27,648~28,415)가 생기기 전에 저장된 사본은 그 자리에 공방·기물 이식 칸(tileGrafts)을 이미 쓰고 있을 수 있다.
    // 번들 꼬리를 덮으면 그 칸의 통행·그림이 바뀌므로 그 사본은 농장 칸을 받지 않는다(밭은 단색 흙 폴백).
    const grafts = tileset.tileGrafts ?? [];
    if (grafts.some(graft => graft.targetTile >= BEODEUL_FARM_BASE && graft.targetTile < BEODEUL_DUNGEON_CEILING_BASE)) return familyFixed || !!moved;
    // 던전 천장 꼬리(28,416~)도 같은 이유: 그 자리에 이식 칸을 쓴 사본은 꼬리를 농장 끝까지만 받는다(던전은 테두리 없는 허공으로 물러선다).
    const dungeonBlocked = grafts.some(graft => graft.targetTile >= BEODEUL_DUNGEON_CEILING_BASE && graft.targetTile < BEODEUL_TOWN_WALL_BASE);
    // 성벽 꼬리(28,544~)도 같다: 그 자리에 이식 칸을 쓴 사본은 꼬리를 던전 천장 끝까지만 받고 성벽 키트·묶음도 받지 않는다(마을은 성벽 없이 지어진다).
    const wallBlocked = dungeonBlocked || grafts.some(graft => graft.targetTile >= BEODEUL_TOWN_WALL_BASE && graft.targetTile < sheet.count);
    const limit = dungeonBlocked ? BEODEUL_DUNGEON_CEILING_BASE : wallBlocked ? BEODEUL_TOWN_WALL_BASE : sheet.count;
    const extended = extendPickedParts(tileset, limit);
    const farm = mergeShippedFarm(tileset, !dungeonBlocked, !wallBlocked);
    return mergeShippedKits(tileset, !wallBlocked) || extended || farm || familyFixed || !!moved;
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
function extendPickedParts(tileset: TilesetDef, limit: number = sheet.count): boolean {
  const base = BEODEUL_CITY_BASE_COUNT;
  const shippedPass = data().passability as PassFlag[];
  const shippedMeta = data().tileMeta as TileAiMetadata[];
  const end = Math.min(limit, sheet.count);
  // 막힌 사본(limit < 시트 끝)은 end 뒤 칸(그 사본의 이식 칸)을 그대로 둔다 — 표를 end 까지만 번들 것으로 바꾸고 칸 수는 줄이지 않는다
  const count = Math.max(tileset.count, end);
  const same = tileset.count === count
    && JSON.stringify(tileset.passability.slice(base, end)) === JSON.stringify(shippedPass.slice(base, end))
    && JSON.stringify(tileset.priority.slice(base, end)) === JSON.stringify(data().priority.slice(base, end))
    && JSON.stringify((tileset.tileMeta ?? []).slice(base, end)) === JSON.stringify(shippedMeta.slice(base, end));
  const shippedStrips = data().animationStrips.filter(strip => strip.baseTile >= base && strip.baseTile < end);
  // end 뒤 띠는 그 사본의 이식 칸 것이다(옮긴 꼬리) — 두고, [base, end) 만 번들 것으로 맞춘다
  const ownStrips = (tileset.animationStrips ?? []).filter(strip => strip.baseTile >= base && strip.baseTile < end);
  if (same && JSON.stringify(ownStrips) === JSON.stringify(shippedStrips)) return false;
  tileset.count = count;
  tileset.passability = [...tileset.passability.slice(0, base), ...structuredClone(shippedPass.slice(base, end)), ...tileset.passability.slice(end)];
  tileset.priority = [...tileset.priority.slice(0, base), ...(data().priority.slice(base, end) as ("lower" | "upper")[]), ...tileset.priority.slice(end)];
  tileset.terrain = [...tileset.terrain.slice(0, base), ...data().terrain.slice(base, end), ...tileset.terrain.slice(end)];
  tileset.tileMeta = [...(tileset.tileMeta ?? []).slice(0, base), ...structuredClone(shippedMeta.slice(base, end)), ...(tileset.tileMeta ?? []).slice(end)];
  tileset.animationStrips = [...(tileset.animationStrips ?? []).filter(strip => strip.baseTile < base), ...structuredClone(shippedStrips),
    ...(tileset.animationStrips ?? []).filter(strip => strip.baseTile >= end)];
  return true;
}

/** Shipped kits the copy lacks are added (by id); bundle-owned `bd-pick-*` kits are replaced by the shipped ones. Others stay. */
function mergeShippedKits(tileset: TilesetDef, withWall = true): boolean {
  const shipped = (data().structureKits as unknown as StructureKitDef[]).filter(kit => withWall || !kit.id.startsWith(BEODEUL_WALL_KIT_PREFIX));
  const shippedById = new Map(shipped.map(kit => [kit.id, kit]));
  const current = tileset.structureKits ?? [];
  let changed = false;
  const kept = current.filter(kit => {
    if (!kit.id.startsWith(BEODEUL_PICK_KIT_PREFIX) && !kit.id.startsWith(BEODEUL_FARM_KIT_PREFIX) && !kit.id.startsWith(BEODEUL_WALL_KIT_PREFIX)) return true;
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

/**
 * 농장·던전 천장 오토타일과 칸 묶음은 번들 소유(같은 id 는 번들 것으로 바꾸고, 없으면 더한다). 칸 그림·표는 extendPickedParts 가 꼬리째 들여온다.
 * 이 단계가 없으면 칸만 생기고 `farmland` 그룹이 없어 기존 프로젝트의 농사 런타임이 단색 흙 폴백을 쓴다.
 */
function mergeShippedFarm(tileset: TilesetDef, withDungeon = true, withWall = true): boolean {
  let changed = false;
  const groups = [...(tileset.autotileGroups ?? [])];
  for (const shipped of data().autotileGroups as unknown as AutotileGroup[]) {
    if (!BEODEUL_FARM_AUTOTILE_IDS.includes(shipped.id) && !(withDungeon && BEODEUL_DUNGEON_AUTOTILE_IDS.includes(shipped.id))) continue;
    const i = groups.findIndex(group => group.id === shipped.id);
    if (i < 0) { groups.push(structuredClone(shipped)); changed = true; }
    else if (JSON.stringify(groups[i]) !== JSON.stringify(shipped)) { groups[i] = structuredClone(shipped); changed = true; }
  }
  if (changed) tileset.autotileGroups = groups;
  const tileGroups = [...(tileset.tileGroups ?? [])];
  let groupsChanged = false;
  for (const shipped of data().tileGroups as unknown as TileGroupMetadata[]) {
    if (!shipped.id.startsWith("beodeul:farm") && !(withDungeon && shipped.id === "beodeul:dungeon_ceiling")
      && !(withWall && shipped.id.startsWith("beodeul:town_wall"))) continue;
    const i = tileGroups.findIndex(group => group.id === shipped.id);
    if (i < 0) { tileGroups.push(structuredClone(shipped)); groupsChanged = true; }
    else if (JSON.stringify(tileGroups[i]) !== JSON.stringify(shipped)) { tileGroups[i] = structuredClone(shipped); groupsChanged = true; }
  }
  if (groupsChanged) tileset.tileGroups = tileGroups;
  return changed || groupsChanged;
}
