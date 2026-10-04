// 현대 도시 · 도쿄풍 (손 도트) 번들 칩셋 — modern-chipset 하네스가 합성한 도시를 16px 칸으로 자른 시트(2026-10).
// 시트 public/assets/modern-city/modern-city-chipset.png, 시트 메타 src/assets/modernCitySheet.json, 정의 src/assets/modernCityTileset.json 은
// src/harnesses/modern-chipset/bake_tileset.py 가 굽는다. 참고문서는 src/assets/modernCityReferences.json(그림은 public/assets/modern-city-references/ 경로만,
// 바이트 없음). 위키: openwiki/modern-city.md.
//
// 칸 번호는 덧붙이기 전용이다 — 다시 구워도 앞 번호는 그대로이고 새 칸은 끝에 붙는다. 그래서 칸 수가 번들 이하이고 한 줄 폭이 같은
// 사본은 같은 시트의 옛 굽기로 보고, 번들 소유 칸 표(통행·층·그룹·오토타일·움직임·조립 부품)만 새 굽기로 바꾼다. 맵은 건드리지 않는다.
// 시트 칸 수·열 수는 하드코딩하지 않고 정의 JSON 에서 읽는다.
import data from "@/assets/modernCityTileset.json";
import references from "@/assets/modernCityReferences.json";
import type { AutotileGroup, PassFlag, StructureKitDef, TileAiMetadata, TileGroupMetadata, TilesetDef } from "../types";
import type { TilesetReferenceCategory } from "../tilesetReferences";

export const MODERN_CITY_ID = "modern_city";
export const MODERN_CITY_TEXTURE = "tex_modern_city";
/** 현대 칩셋 계열. 버들항(oprn-atlas)·조선(oprn-joseon)과 칸 번호 체계가 달라, 맵이 있는 채로 말없이 바꾸면 깨진다. */
export const MODERN_CITY_FAMILY = "oprn-modern";
export const MODERN_CITY_COUNT: number = data.count;
export const MODERN_CITY_TILES_PER_ROW: number = data.tilesPerRow;
/** 조립 부품(structureKits)·참고문서 id 머리. 번들이 소유한다(기존 사본에서 같은 id 는 번들 것으로 바꾼다). */
export const MODERN_CITY_PREFIX = "mc-";
const REFERENCES = references as unknown as TilesetReferenceCategory[];

/** 번들 정의의 독립 사본 — 참고문서를 들고 태어난다. */
export function createModernCityTileset(): TilesetDef {
  return {
    id: MODERN_CITY_ID,
    name: data.name,
    image: { type: "bundled", id: MODERN_CITY_TEXTURE },
    kind: "custom",
    family: MODERN_CITY_FAMILY,
    tileSize: data.tileSize,
    tilesPerRow: data.tilesPerRow,
    count: data.count,
    passability: structuredClone(data.passability) as PassFlag[],
    priority: [...data.priority] as ("lower" | "upper")[],
    terrain: [...data.terrain],
    tileMeta: structuredClone(data.tileMeta) as TileAiMetadata[],
    tileGroups: structuredClone(data.tileGroups) as unknown as TileGroupMetadata[],
    autotileGroups: structuredClone(data.autotileGroups) as unknown as AutotileGroup[],
    animationStrips: structuredClone(data.animationStrips),
    structureKits: structuredClone(data.structureKits) as unknown as StructureKitDef[],
    referenceDocuments: structuredClone(REFERENCES),
  };
}

export function isModernCityTileset(tileset: Pick<TilesetDef, "image"> | undefined): boolean {
  return tileset?.image.type === "bundled" && tileset.image.id === MODERN_CITY_TEXTURE;
}

/**
 * 참고문서를 최신으로 맞춘다. `mc-` 로 시작하는 문서·그림은 번들 소유(학습 결과는 번들이 소유한다):
 * 빠진 용도는 덧붙이고, 있는 용도에서는 `mc-` 항목만 번들 것으로 바꾼다. 저자가 쓴 문서(다른 id)·저작 용도·공유 포인터는 건드리지 않는다.
 */
export function ensureModernCityReferences(tileset: TilesetDef): boolean {
  if (tileset.id !== MODERN_CITY_ID || !isModernCityTileset(tileset) || tileset.referenceSourceTilesetId) return false;
  const own = (id: string) => id.startsWith(MODERN_CITY_PREFIX);
  const cats = [...(tileset.referenceDocuments ?? [])];
  let changed = false;
  for (const shipped of REFERENCES) {
    const i = cats.findIndex((existing) => existing.id === shipped.id);
    if (i < 0) { cats.push(structuredClone(shipped)); changed = true; continue; }
    const cur = cats[i]!;
    const next = { ...cur, name: shipped.name, description: shipped.description,
      documents: [...(cur.documents ?? []).filter((doc) => !own(doc.id)), ...shipped.documents],
      images: [...(cur.images ?? []).filter((image) => !own(image.id)), ...shipped.images] } as TilesetReferenceCategory;
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
/** 표 길이까지 합친 요약. 키트 본문이 같은 개수로 바뀐 경우는 못 잡는다 — 그때는 칸 수나 층 표도 함께 바뀌는 굽기 규약이다. */
function shapeSignature(t: Pick<TilesetDef, "priority" | "passability" | "tileMeta" | "tileGroups" | "autotileGroups" | "animationStrips" | "structureKits">): string {
  return `${layerSignature(t)}|${t.tileGroups?.length ?? 0}|${t.autotileGroups?.length ?? 0}|${t.animationStrips?.length ?? 0}|${t.structureKits?.length ?? 0}`;
}
let bundledShape: string | undefined;
function bundleShape(): string {
  return bundledShape ??= shapeSignature({
    priority: data.priority as ("lower" | "upper")[],
    passability: data.passability as PassFlag[],
    tileMeta: data.tileMeta as TileAiMetadata[],
    tileGroups: data.tileGroups as unknown as TileGroupMetadata[],
    autotileGroups: data.autotileGroups as unknown as AutotileGroup[],
    animationStrips: data.animationStrips,
    structureKits: data.structureKits as unknown as StructureKitDef[],
  });
}

/**
 * 기존 프로젝트의 사본을 번들에 맞춘다. 계열이 비었거나 다르면 `oprn-modern` 으로 고친다.
 * - 한 줄 폭이 같고 칸 수가 번들 이하인 사본(같은 시트의 옛 굽기, 덧붙이기 전용): 번들 소유 칸 표를 새 굽기로 바꾼다.
 *   저자가 더한 조립 부품(`mc-` 가 아닌 id)은 남기고, 번들 소유 `mc-` 부품은 최신으로 바꾼다. 맵·저작 참고문서는 건드리지 않는다.
 * - 더 새 번들에서 저장된(칸이 더 많은) 사본은 줄이지 않는다.
 * - 한 줄 폭이 다른 사본은 다른 시트라 칸 번호가 가리키는 그림이 다르다 — 칸 표를 번들 것으로 통째로 바꾼다.
 */
export function ensureModernCityTileset(tileset: TilesetDef): boolean {
  if (tileset.id !== MODERN_CITY_ID || !isModernCityTileset(tileset)) return false;
  let changed = false;
  if (tileset.family !== MODERN_CITY_FAMILY) { tileset.family = MODERN_CITY_FAMILY; changed = true; }
  if (tileset.tilesPerRow === data.tilesPerRow) {
    if (tileset.count > data.count) return changed;
    if (tileset.count === data.count && shapeSignature(tileset) === bundleShape()) return changed;
    const fresh = createModernCityTileset();
    const authoredKits = (tileset.structureKits ?? []).filter((kit) => !kit.id.startsWith(MODERN_CITY_PREFIX));
    for (const key of ["count", "passability", "priority", "terrain", "tileMeta", "tileGroups", "autotileGroups", "animationStrips"] as const) {
      (tileset as unknown as Record<string, unknown>)[key] = fresh[key];
    }
    tileset.structureKits = [...(fresh.structureKits ?? []), ...authoredKits];
    return true;
  }
  const fresh = createModernCityTileset();
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
