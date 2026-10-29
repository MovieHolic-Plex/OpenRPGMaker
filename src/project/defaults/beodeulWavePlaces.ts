// 버들항 웨이브 장소 (원본 그림 칸) 번들 칩셋 — 2026-10-08 장르 웨이브에서 Python 손 도트로 그린 장소 넷(화산 지대 필드·폐허 마을·빙하기 설원·산악 요새)의
// 원본 그림을 16px 칸으로 자른 128열 시트(2026-10-29 되살림). 2026-10-09 저장소 리셋으로 산출 그림·배치가 사라져 공용 칩셋에 구워진 적이 없었다.
// 시트 public/assets/beodeul-wave-places/beodeul-wave-places-chipset.png, 시트 메타 src/assets/beodeulWavePlacesSheet.json,
// 정의 src/assets/beodeulWavePlacesTileset.json, 장소 스냅숏 src/project/regionReferences/beodeul-wave-places.json 은
// tiledata/beodeul-variants/_revive/bake.py 가 굽는다(extract.py → layers.py → bake.py). 위키: openwiki/beodeul-city.md 「웨이브 장소 되살리기」.
//
// 칸 = 원본 그림 그대로(아래층 = 원본 칸, 위층 = 키 큰 물체 화소). 조립 부품·오토타일은 없다 — 이 칩셋은 「장소 맵을 그대로 가져오는」 용도다
// (import_region_reference 「bd-wave-*」). 새 맵에 낱칸을 골라 까는 재료가 아니다.
import sheet from "@/assets/beodeulWavePlacesSheet.json";
import { bundledJson } from "./bundledJson";
import references from "@/assets/beodeulWavePlacesReferences.json";
import type { PassFlag, TileAiMetadata, TilesetDef } from "../types";
import type { TilesetReferenceCategory } from "../tilesetReferences";

const data = () => bundledJson("beodeulWavePlacesTileset");

export const BEODEUL_WAVE_PLACES_ID = "beodeul_wave_places";
export const BEODEUL_WAVE_PLACES_TEXTURE = "tex_beodeul_wave_places";
/** 칸 번호 체계가 버들항 도시(oprn-atlas)와 다르다 — 칸을 섞지 않는다. */
export const BEODEUL_WAVE_PLACES_FAMILY = "oprn-atlas-wave";
const PREFIX = "bd-wave-";
const REFERENCES = references as unknown as TilesetReferenceCategory[];
const isOwned = (id: string): boolean => id.startsWith(PREFIX);

export function beodeulWavePlacesBundledReferenceDocuments(): TilesetReferenceCategory[] {
  return structuredClone(REFERENCES);
}

export function createBeodeulWavePlacesTileset(): TilesetDef {
  return {
    id: BEODEUL_WAVE_PLACES_ID,
    name: data().name,
    image: { type: "bundled", id: BEODEUL_WAVE_PLACES_TEXTURE },
    kind: "custom",
    family: BEODEUL_WAVE_PLACES_FAMILY,
    tileSize: data().tileSize,
    tilesPerRow: sheet.tilesPerRow,
    count: sheet.count,
    passability: structuredClone(data().passability) as PassFlag[],
    priority: [...data().priority] as ("lower" | "upper")[],
    terrain: [...data().terrain],
    tileMeta: structuredClone(data().tileMeta) as TileAiMetadata[],
    tileGroups: [],
    autotileGroups: [],
    animationStrips: [],
    structureKits: [],
    referenceDocuments: beodeulWavePlacesBundledReferenceDocuments(),
  };
}

export function isBeodeulWavePlacesTileset(tileset: Pick<TilesetDef, "image"> | undefined): boolean {
  return tileset?.image.type === "bundled" && tileset.image.id === BEODEUL_WAVE_PLACES_TEXTURE;
}

/** 옛 굽기 사본(칸이 번들보다 적거나 표가 다르다)의 칸 표를 번들 것으로 맞춘다. 칸 번호는 덧붙이기 전용이라 맵은 그대로다. 더 새 사본은 줄이지 않는다. */
export function ensureBeodeulWavePlacesTileset(tileset: TilesetDef): boolean {
  if (tileset.id !== BEODEUL_WAVE_PLACES_ID || !isBeodeulWavePlacesTileset(tileset)) return false;
  let changed = false;
  if (tileset.family !== BEODEUL_WAVE_PLACES_FAMILY) { tileset.family = BEODEUL_WAVE_PLACES_FAMILY; changed = true; }
  if (tileset.tilesPerRow === sheet.tilesPerRow && tileset.count > sheet.count) return changed;
  if (tileset.tilesPerRow === sheet.tilesPerRow && tileset.count === sheet.count && tileset.passability.length === sheet.count) return changed;
  const fresh = createBeodeulWavePlacesTileset();
  for (const key of ["tilesPerRow", "count", "passability", "priority", "terrain", "tileMeta"] as const) {
    (tileset as unknown as Record<string, unknown>)[key] = fresh[key];
  }
  return true;
}

/** 번들 참고문서(`bd-wave-` 용도·문서·그림)를 최신으로. 저자가 쓴 다른 id 는 그대로 둔다. */
export function ensureBeodeulWavePlacesReferences(tileset: TilesetDef): boolean {
  if (tileset.id !== BEODEUL_WAVE_PLACES_ID || !isBeodeulWavePlacesTileset(tileset) || tileset.referenceSourceTilesetId) return false;
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
