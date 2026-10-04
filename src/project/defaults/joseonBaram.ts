// 조선(바람의나라풍 손 도트) 번들 칩셋 — 마을 20호·국내성 맵이 같은 시트를 쓴다. 시트·정의는 scripts/content/build-joseon-tileset.py 가
// (입력 시트·pieces.json·map.json·extra.json 만 바꿔 같은 명령으로) 다시 구운 public/assets/joseon-baram/joseon-baram-chipset.png 와
// src/assets/joseonBaramTileset.json 이고, 참고문서는 scripts/content/prepare-joseon-baram-references.py 의 src/assets/joseonBaramReferences.json
// (그림은 public/assets/joseon-baram/references/ 경로만)다. 위키: openwiki/joseon-baram.md.
//
// 칸마다 통행·레이어가 구워져 있다(조각별 X 막힘 / C 걸음★ / F 걸음 격자 = tiledata/joseon-village/piece-walk.json).
// 시트 칸 수·열 수는 하드코딩하지 않고 정의 JSON 에서 읽는다 — 국내성 조각이 합쳐지면 칸이 늘어난다.
import data from "@/assets/joseonBaramTileset.json";
import references from "@/assets/joseonBaramReferences.json";
import type { AutotileGroup, PassFlag, StructureKitDef, TileAiMetadata, TileGroupMetadata, TilesetDef } from "../types";
import type { TilesetReferenceCategory } from "../tilesetReferences";

export const JOSEON_BARAM_TEXTURE = "tex_joseon_baram";
export const JOSEON_BARAM_ID = "joseon_baram";
/** 조선 칩셋 계열. 버들항(oprn-atlas)과 칸 번호 체계가 전혀 달라, 맵이 있는 채로 말없이 바꾸면 깨진다. */
export const JOSEON_BARAM_FAMILY = "oprn-joseon";
export const JOSEON_BARAM_TILE_COUNT: number = data.count;
export const JOSEON_BARAM_TILES_PER_ROW: number = data.tilesPerRow;
/** 조립 부품(structureKits)·참고문서 id 머리. 번들이 소유한다(기존 사본에서 같은 id 는 번들 것으로 바꾼다). */
export const JOSEON_BARAM_PREFIX = "jb-";
const REFERENCES = references as unknown as TilesetReferenceCategory[];

/** 번들 정의의 독립 사본 — 참고문서를 들고 태어난다. */
export function createJoseonBaramTileset(): TilesetDef {
  return {
    id: JOSEON_BARAM_ID,
    name: data.name,
    image: { type: "bundled", id: JOSEON_BARAM_TEXTURE },
    kind: "custom",
    family: JOSEON_BARAM_FAMILY,
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

/**
 * 참고문서를 최신으로 맞춘다. `jb-` 로 시작하는 문서·그림은 번들 소유(학습 결과는 번들이 소유한다):
 * 빠진 용도는 덧붙이고, 있는 용도에서는 `jb-` 항목만 번들 것으로 바꾼다. 저자가 쓴 문서(다른 id)·저작 용도·공유 포인터는 건드리지 않는다.
 */
export function ensureJoseonBaramReferences(tileset: TilesetDef): boolean {
  if (tileset.id !== JOSEON_BARAM_ID || tileset.image.type !== "bundled" || tileset.image.id !== JOSEON_BARAM_TEXTURE
    || tileset.referenceSourceTilesetId) return false;
  const own = (id: string) => id.startsWith(JOSEON_BARAM_PREFIX);
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
 * 칸 수가 다른 사본(옛 시트)은 칸 번호가 가리키는 그림이 달라 칸 표(통행·레이어·그룹·오토타일·부품)를 번들 것으로 통째로 바꾼다.
 * 칸 수가 같은 사본(저자가 그룹·부품을 더한 것 포함)은 건드리지 않고, 없는 번들 부품(id 기준)만 덧붙이며 번들 소유 `jb-` 부품은 최신으로 바꾼다.
 * 더 새 번들에서 저장된(칸이 더 많은) 사본은 줄이지 않는다. 계열이 비어 있거나 다르면 `oprn-joseon` 으로 고친다.
 * 번들 배포 뒤 시트는 칸 끝에만 덧붙인다 — 앞 칸 번호가 바뀌면 이미 칠한 맵이 달라진다.
 */
export function ensureJoseonBaramTileset(tileset: TilesetDef): boolean {
  if (tileset.id !== JOSEON_BARAM_ID || tileset.image.type !== "bundled" || tileset.image.id !== JOSEON_BARAM_TEXTURE) return false;
  let changed = false;
  if (tileset.family !== JOSEON_BARAM_FAMILY) { tileset.family = JOSEON_BARAM_FAMILY; changed = true; }
  const shippedAutotiles = (data.autotileGroups as unknown as AutotileGroup[]);
  const sheetCopy = tileset.autotileGroups?.some(group => shippedAutotiles.some(ship => ship.id === group.id)) ?? false;
  if (sheetCopy && tileset.count > data.count) return changed;
  if (sheetCopy && tileset.count === data.count) return mergeShippedKits(tileset) || changed;
  const fresh = createJoseonBaramTileset();
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

/** 번들 부품 중 사본에 없는 것은 덧붙이고, 번들 소유 `jb-` 부품은 최신으로 바꾼다. 나머지(저자 부품)는 그대로. */
function mergeShippedKits(tileset: TilesetDef): boolean {
  const shipped = data.structureKits as unknown as StructureKitDef[];
  const shippedById = new Map(shipped.map(kit => [kit.id, kit]));
  const current = tileset.structureKits ?? [];
  let changed = false;
  const kept = current.filter(kit => {
    if (!kit.id.startsWith(JOSEON_BARAM_PREFIX)) return true;
    const ship = shippedById.get(kit.id);
    if (!ship) { changed = true; return false; }
    if (JSON.stringify(ship) !== JSON.stringify(kit)) { changed = true; return false; }
    return true;
  });
  const have = new Set(kept.map(kit => kit.id));
  const missing = shipped.filter(kit => !have.has(kit.id));
  if (!missing.length && !changed) return false;
  tileset.structureKits = [...kept, ...structuredClone(missing)];
  return true;
}
