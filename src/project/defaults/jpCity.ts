// 일본 도시 · 상가·주택·역·신사 (손 도트) 번들 칩셋 — modern3 팔레트 손 도트를 16px 칸으로 구운 96열 시트(2026-10, 10-08 에 48열에서 다시 놓음).
// 시트 public/assets/jp-city/jp-city-chipset.png, 시트 메타 src/assets/jpCitySheet.json, 정의 src/assets/jpCityTileset.json 은
// scripts/content/jp-city/bake_jp.py 가 굽는다. 참고문서는 src/assets/jpCityReferences.json(그림은 public/assets/jp-city-references/ 경로만,
// 바이트 없음; scripts/content/jp-city/bake_refs.py 가 굽는다 — 7용도 52쪽·그림 137장). 위키: openwiki/jp-city.md. `modern_city`(oprn-modern)와 별개 번들이다 — 칸 번호 체계가 다르다.
//
// 칸 번호는 덧붙이기 전용이다(자리 키 핀) — 다시 구워도 앞 번호는 그대로이고 새 칸은 끝에 붙는다. 그래서 칸 수가 번들 이하이고 한 줄 폭이 같은
// 사본은 같은 시트의 옛 굽기로 보고, 번들 소유 칸 표(통행·층·그룹·오토타일·움직임·조립 부품)만 새 굽기로 바꾼다. 맵은 건드리지 않는다.
// 번들 소유 = id 가 `jp-` 로 시작하는 조립 부품·오토타일 그룹·참고문서. 저자가 더한 것(다른 id)은 갱신 때 보존한다.
// 시트 칸 수·열 수는 하드코딩하지 않고 정의 JSON 에서 읽는다.
import sheet from "@/assets/jpCitySheet.json" with { type: "json" };
import { bundledJson } from "./bundledJson";
/** 번들 정의 JSON — 처음 쓸 때 읽는다(bundledJson.ts). 칸 수·한 줄 폭은 같은 굽기가 쓰는 작은 시트 메타(`jpCitySheet.json`)에서 읽는다. */
const data = () => {
  const d = bundledJson("jpCityTileset");
  markSupersededBuildings(d.structureKits as unknown as StructureKitDef[]);
  sealRailway(d as unknown as RailwayData);
  return d;
};
/**
 * 한 게임 안에서 건물 가족은 하나다. 새 건물(`jp-bldg-f-*`, 탑 3/4 시점)이 구워져 있으면 옛 손 도트 건물(`jp-bldg-*`)은 정의에 남기되
 * 조수에게 권하는 목록에서 뺀다(`ai.supersededBy`). 새 가족에 같은 구실이 없는 것(학교·체육관·유치원·주유소 사무소·시장 건물·공장·창고·마치코바)은 그대로 둔다.
 */
const NEW_BUILDING_PREFIX = "jp-bldg-f-";
const CARBON_BUILDING_PREFIX = "jp-bldg-c-";
const HAND_ONLY_BUILDINGS = new Set(["school", "school-gym", "kindergarten", "gas-office", "market-hall", "factory", "warehouse", "machikoba-home"].map((s) => `jp-bldg-${s}`));
/**
 * 선로와 열차는 못 걷는 칸이다(2026-11-16 r6 브라우저 플레이 P1: 게임이 선로 위에서 시작했고 열차 안·역 지붕 밑으로 걸어 들어갔다).
 * 구운 자료에서는 선로 오토타일이 «걸을 수 있는 길»(role path)이고 열차 그림은 맨 아랫줄까지 지나가는 칸(★/○)이었다 — 정의를 읽을 때 막힌 칸으로 고친다.
 * 고가 정면 키트(viaduct6-*)의 발 줄 가운데 두 칸(가게 문·통로 그림)도 막는다 — 그 뒤는 선로 바닥뿐이다. 건널목은 선로 위에 깐 길 칸(생활도로)이라 그대로 건넌다.
 */
interface RailwayData { passability: (PassFlag | null)[]; priority: ("lower" | "upper")[]; tileGroups: { id: string; tileIds?: number[] }[]; structureKits: { id: string; rows: { tiles?: number[]; upperTiles?: number[] }[] }[] }
const RAILWAY_GROUPS = new Set(["jp:rail-track", "jp:prop:train"]);
const sealed = new WeakSet<object>();
function sealRailway(d: RailwayData): void {
  if (sealed.has(d)) return;
  const block = (tile: number | undefined) => { if (tile !== undefined && tile >= 0 && tile < d.passability.length) d.passability[tile] = { up: false, down: false, left: false, right: false }; };
  for (const group of d.tileGroups) if (RAILWAY_GROUPS.has(group.id)) for (const tile of group.tileIds ?? []) block(tile);
  for (const kit of d.structureKits) {
    if (!kit.id.startsWith("jp-prop-viaduct6-")) continue;
    const foot = kit.rows[kit.rows.length - 1];
    for (const tile of [...(foot?.tiles ?? []), ...(foot?.upperTiles ?? [])]) block(tile);
  }
  // 새 건물(탑 3/4 시점)의 지붕은 건물이 선 자리다 — 지붕 칸은 «뒤로 지나가는 칸»(★)이 아니라 막힌 칸이다. 옛 정면 그림 건물과 지나가는 조각(도리이·산몬·대문)은 그대로 둔다.
  const streetCatalog = bundledJson("jpCityStreetCatalog");
  const buildings = new Set((streetCatalog as unknown as { buildings: { id: string }[] }).buildings.map((b) => b.id).filter((id) => id.startsWith(NEW_BUILDING_PREFIX)));
  for (const kit of d.structureKits) {
    if (!buildings.has(kit.id)) continue;
    for (const row of kit.rows) for (const tile of [...(row.tiles ?? []), ...(row.upperTiles ?? [])]) if (tile >= 0 && d.priority[tile] === "upper") block(tile);
  }
  sealed.add(d);
}
const marked = new WeakSet<object>();
function markSupersededBuildings(kits: StructureKitDef[]): void {
  if (marked.has(kits)) return;
  marked.add(kits);
  if (!kits.some((kit) => kit.id.startsWith(NEW_BUILDING_PREFIX))) return;
  for (const kit of kits) if (kit.id.startsWith("jp-bldg-") && !kit.id.startsWith(NEW_BUILDING_PREFIX) && !kit.id.startsWith(CARBON_BUILDING_PREFIX) && !HAND_ONLY_BUILDINGS.has(kit.id) && kit.ai) kit.ai.supersededBy = NEW_BUILDING_PREFIX;
}
import references from "@/assets/jpCityReferences.json" with { type: "json" };
import forestReferences from "@/assets/jpForestReferences.json" with { type: "json" };
import type { AutotileGroup, PassFlag, StructureKitDef, TileAiMetadata, TileGroupMetadata, TilesetDef } from "../types";
import type { TilesetReferenceCategory } from "../tilesetReferences";
import { settleThemeBundleTail, type RelocationProject } from "./localTailRelocation";

export const JP_CITY_ID = "jp_city";
export const JP_CITY_TEXTURE = "tex_jp_city";
/** 일본 도시 칩셋 계열. 버들항(oprn-atlas)·현대 도시(oprn-modern)와 칸 번호 체계가 달라, 맵이 있는 채로 말없이 바꾸면 깨진다. */
export const JP_CITY_FAMILY = "oprn-jp";
export const JP_CITY_COUNT: number = sheet.count;
export const JP_CITY_TILES_PER_ROW: number = sheet.tilesPerRow;
/** 조립 부품·오토타일 그룹·참고문서 id 머리. 번들이 소유한다(기존 사본에서 같은 id 는 번들 것으로 바꾼다). */
export const JP_CITY_PREFIX = "jp-";
// 숲 용도(jp-forest)는 따로 굽는다(scripts/content/jp-city/forest/bake_forest_refs.py) — bake_refs.py 가 다른 용도를 다시 구워도 숲 문서가 지워지지 않게.
const ALL_REFERENCES = [...(references as unknown as TilesetReferenceCategory[]), ...(forestReferences as unknown as TilesetReferenceCategory[])];
// 새 건물 용도(jp-buildings-f)가 실려 있으면 옛 손 도트 건물 용도(jp-buildings-hand)는 번들 참고문서에서 내린다 — 읽는 순서·시트 지도가 가리키는 용도 이름도 새 것으로 바꾼다.
const HAND_BUILDING_REFS = "jp-buildings-hand", NEW_BUILDING_REFS = "jp-buildings-f";
const REFERENCES = !ALL_REFERENCES.some((category) => category.id === NEW_BUILDING_REFS) ? ALL_REFERENCES
  : ALL_REFERENCES.filter((category) => category.id !== HAND_BUILDING_REFS).map((category) => category.id !== "jp-start" ? category : {
    ...category,
    documents: category.documents.map((doc) => ({ ...doc, markdown: doc.markdown.replaceAll("용도 「손 도트 건물」(`jp-bldg-hand-rules`)", "용도 「새 건물」(`jp-bldg-f-rules`)").replaceAll("용도 「손 도트 건물」", "용도 「새 건물」") })),
  });

const isOwned = (id: string): boolean => id.startsWith(JP_CITY_PREFIX);

/** 새 사본이 들고 태어나는 참고문서 — 정의 JSON 없이 만든다(로드가 저장본에서 뺀 번들 참고문서를 되돌릴 때 쓴다, installReferenceOwners.ts). */
export function jpCityBundledReferenceDocuments(): TilesetReferenceCategory[] {
  return structuredClone(REFERENCES);
}

/** 번들 정의의 독립 사본 — 참고문서를 들고 태어난다. */
export function createJpCityTileset(): TilesetDef {
  return {
    id: JP_CITY_ID,
    name: data().name,
    image: { type: "bundled", id: JP_CITY_TEXTURE },
    kind: "custom",
    family: JP_CITY_FAMILY,
    tileSize: data().tileSize,
    tilesPerRow: sheet.tilesPerRow,
    count: sheet.count,
    passability: structuredClone(data().passability) as PassFlag[],
    priority: [...data().priority] as ("lower" | "upper")[],
    terrain: [...data().terrain],
    tileMeta: structuredClone(data().tileMeta) as TileAiMetadata[],
    tileGroups: structuredClone(data().tileGroups) as unknown as TileGroupMetadata[],
    autotileGroups: structuredClone(data().autotileGroups) as unknown as AutotileGroup[],
    animationStrips: structuredClone(data().animationStrips),
    structureKits: structuredClone(data().structureKits) as unknown as StructureKitDef[],
    referenceDocuments: jpCityBundledReferenceDocuments(),
    roomKit: { builtin: JP_CITY_ID },
  };
}

export function isJpCityTileset(tileset: Pick<TilesetDef, "image"> | undefined): boolean {
  return tileset?.image.type === "bundled" && tileset.image.id === JP_CITY_TEXTURE;
}

/**
 * 참고문서를 최신으로 맞춘다. `jp-` 로 시작하는 문서·그림은 번들 소유(학습 결과는 번들이 소유한다):
 * 빠진 용도는 덧붙이고, 있는 용도에서는 `jp-` 항목만 번들 것으로 바꾼다. 저자가 쓴 문서(다른 id)·저작 용도·공유 포인터는 건드리지 않는다.
 * 번들 참고문서 용도 id·문서 id·그림 id 는 모두 `jp-` 로 시작한다(그림은 `/assets/jp-city-references/*.png` 경로).
 */
export function ensureJpCityReferences(tileset: TilesetDef): boolean {
  if (tileset.id !== JP_CITY_ID || !isJpCityTileset(tileset) || tileset.referenceSourceTilesetId) return false;
  const cats = [...(tileset.referenceDocuments ?? [])];
  let changed = false;
  for (const shipped of REFERENCES) {
    const i = cats.findIndex((existing) => existing.id === shipped.id);
    if (i < 0) { cats.push(structuredClone(shipped)); changed = true; continue; }
    const cur = cats[i]!;
    const next = { ...cur, name: shipped.name, description: shipped.description,
      documents: [...(cur.documents ?? []).filter((doc) => !isOwned(doc.id)), ...shipped.documents],
      images: [...(cur.images ?? []).filter((image) => !isOwned(image.id)), ...shipped.images] } as TilesetReferenceCategory;
    if (JSON.stringify(next) !== JSON.stringify(cur)) { cats[i] = structuredClone(next); changed = true; }
  }
  if (changed) tileset.referenceDocuments = cats;
  return changed;
}

/** 통행·층·잠금 한 줄 요약 — 번들 메타가 바뀌었는지(같은 시트의 새 굽기인지) 싸게 가른다. */
function layerSignature(t: Pick<TilesetDef, "priority" | "passability" | "tileMeta">): string {
  let out = "";
  for (let i = 0; i < t.priority.length; i++) {
    const m = t.tileMeta?.[i];
    out += (t.priority[i] === "upper" ? "u" : "l") + (t.passability[i]?.up ? "1" : "0") + (m?.defaultLayer === "upper" ? "U" : m?.defaultLayer === "lower" ? "L" : "-") + (m?.locked ? "k" : "");
  }
  return out;
}
/**
 * 표 길이까지 합친 요약. 오토타일 그룹·조립 부품은 번들 소유(`jp-`)만 센다 — 저자가 더한 것까지 세면
 * 번들과 영영 달라 보여 로드마다 다시 갱신하게 된다. 키트 본문이 같은 개수로 바뀐 경우는 못 잡는다 —
 * 그때는 칸 수나 층 표도 함께 바뀌는 굽기 규약이다.
 */
function shapeSignature(t: Pick<TilesetDef, "priority" | "passability" | "tileMeta" | "tileGroups" | "autotileGroups" | "animationStrips" | "structureKits">): string {
  const ownedAutotiles = (t.autotileGroups ?? []).filter((group) => isOwned(group.id)).length;
  const ownedKits = (t.structureKits ?? []).filter((kit) => isOwned(kit.id)).length;
  // 그룹 층(`defaultLayer`·`layerHome`)도 센다 — 칸 층 표가 같아도 굽기 규칙이 그룹 선언을 바로잡으면(2026-10-04 층 정정 13그룹) 기존 사본이 갱신돼야 한다.
  const groupLayers = (t.tileGroups ?? []).map((group) => {
    const g = group as { defaultLayer?: string; layerHome?: string };
    return `${(g.defaultLayer ?? "-")[0]}${(g.layerHome ?? "-")[0]}`;
  }).join("");
  // 오토타일의 맵 밖 연결(`edgeConnects`)도 센다 — 이 값만 바뀐 굽기(2026-10-20 지면 7그룹 false→true)도 기존 사본이 갱신돼야 한다.
  const edgeBits = (t.autotileGroups ?? []).filter((group) => isOwned(group.id)).map((group) => (group.edgeConnects ? "1" : "0") + (group.outsideConnects ? "1" : "0")).join("");
  return `${layerSignature(t)}|${t.tileGroups?.length ?? 0}|${groupLayers}|${ownedAutotiles}|${edgeBits}|${t.animationStrips?.length ?? 0}|${ownedKits}`;
}
let bundledShape: string | undefined;
function bundleShape(): string {
  return bundledShape ??= shapeSignature({
    priority: data().priority as ("lower" | "upper")[],
    passability: data().passability as PassFlag[],
    tileMeta: data().tileMeta as TileAiMetadata[],
    tileGroups: data().tileGroups as unknown as TileGroupMetadata[],
    autotileGroups: data().autotileGroups as unknown as AutotileGroup[],
    animationStrips: data().animationStrips,
    structureKits: data().structureKits as unknown as StructureKitDef[],
  });
}

/** 이 번들이 예전에 쓴 열 수(2026-10-08 48 → 96). 그 열 수의 사본은 칸 번호가 같은 시트다. */
export const JP_CITY_RELAYOUT_FROM: readonly number[] = [48];

/**
 * 기존 프로젝트의 사본을 번들에 맞춘다. 계열이 비었거나 다르면 `oprn-jp` 로 고친다.
 * - 한 줄 폭이 같고 칸 수가 번들 이하인 사본(같은 시트의 옛 굽기, 덧붙이기 전용): 번들 소유 칸 표를 새 굽기로 바꾼다.
 *   저자가 더한 조립 부품·오토타일 그룹(`jp-` 가 아닌 id)은 남기고, 번들 소유 `jp-` 항목은 최신으로 바꾼다. 맵·저작 참고문서는 건드리지 않는다.
 * - 더 새 번들에서 저장된(칸이 더 많은) 사본은 줄이지 않는다.
 * - 옛 열 수(JP_CITY_RELAYOUT_FROM)의 사본은 같은 시트를 다시 놓은 것이라 tilesPerRow 만 고치고 위와 같이 다룬다.
 * - 그 밖에 한 줄 폭이 다른 사본은 다른 시트라 칸 번호가 가리키는 그림이 다르다 — 칸 표를 번들 것으로 통째로 바꾼다(저자 항목도 번호가 무의미하므로 버린다).
 */
export function ensureJpCityTileset(tileset: TilesetDef, project?: RelocationProject): boolean {
  if (tileset.id !== JP_CITY_ID || !isJpCityTileset(tileset)) return false;
  let changed = false;
  if (tileset.family !== JP_CITY_FAMILY) { tileset.family = JP_CITY_FAMILY; changed = true; }
  if (!tileset.roomKit) { tileset.roomKit = { builtin: JP_CITY_ID }; changed = true; }
  // 같은 시트를 열 수만 바꿔 다시 놓은 판(칸 번호 = 시트 위 순서라 번호는 그대로) — 옛 열 수 사본은 같은 시트로 본다(저자 항목 보존).
  if (tileset.tilesPerRow !== sheet.tilesPerRow && JP_CITY_RELAYOUT_FROM.includes(tileset.tilesPerRow)) { tileset.tilesPerRow = sheet.tilesPerRow; changed = true; }
  if (tileset.tilesPerRow === sheet.tilesPerRow) {
    // 프로젝트 이식 칸(stamp_tileset_object 가 다른 칩셋 그림을 끝에 붙인 칸)이 있는 사본: 번들이 그 자리까지 자랐으면 꼬리를 새 번들 끝 뒤로 밀고
    // (맵·킷 번호도 — `project` 를 받았을 때만) 번들 구간만 새 굽기로 채운다(localTailRelocation.ts). 전에는 «칸이 더 많은 사본» 이라 건너뛰어 새 킷을 못 받았다.
    const tail = settleThemeBundleTail(tileset, project, { count: sheet.count, fresh: createJpCityTileset, owned: isOwned, signature: shapeSignature, bundleSignature: bundleShape });
    if (tail !== undefined) return tail || changed;
    if (tileset.count > sheet.count) return changed;
    if (tileset.count === sheet.count && shapeSignature(tileset) === bundleShape()) return changed;
    const fresh = createJpCityTileset();
    const authoredKits = (tileset.structureKits ?? []).filter((kit) => !isOwned(kit.id));
    const authoredAutotiles = (tileset.autotileGroups ?? []).filter((group) => !isOwned(group.id));
    for (const key of ["count", "passability", "priority", "terrain", "tileMeta", "tileGroups", "animationStrips"] as const) {
      (tileset as unknown as Record<string, unknown>)[key] = fresh[key];
    }
    tileset.autotileGroups = [...(fresh.autotileGroups ?? []), ...authoredAutotiles];
    tileset.structureKits = [...(fresh.structureKits ?? []), ...authoredKits];
    return true;
  }
  const fresh = createJpCityTileset();
  tileset.count = fresh.count;
  tileset.tilesPerRow = fresh.tilesPerRow;
  tileset.passability = fresh.passability;
  tileset.priority = fresh.priority;
  tileset.terrain = fresh.terrain;
  tileset.tileMeta = fresh.tileMeta;
  tileset.tileGroups = fresh.tileGroups;
  tileset.autotileGroups = fresh.autotileGroups;
  tileset.animationStrips = fresh.animationStrips;
  tileset.structureKits = fresh.structureKits;
  return true;
}
