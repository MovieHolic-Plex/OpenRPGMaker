// 몬스터 수집 손 도트 시트(지역별) — src/harnesses/tileset-authoring 하네스가 그리고(좌표 손 도트) 굽고, lib/wire.py 가
// src/assets/monsterKit/<테마>.json + index.json + monsterKitSheets.generated.ts 를 쓴다. 그림은 public/assets/monster-kit/<테마>.png.
// 정의(참고문서 용도 `mk-<테마>` 포함)는 번들이 소유한다: 새 프로젝트는 처음부터 갖고, 기존 프로젝트는 ensureBundledTilesets 가 심는다.
// openwiki/harnesses/tileset-authoring.md.
import { MONSTER_KIT_SHEET_DATA } from "./monsterKitSheets.generated";
import { monsterKitSheet } from "@/assets/monsterKitAssets";
import type { AutotileGroup, PassFlag, StructureKitDef, TileAiMetadata, TilesetDef } from "../types";
import type { TilesetReferenceCategory } from "../tilesetReferences";

/** 몬스터 수집 시트는 코드로 찍은 생성 칩셋 계열이다(맵·칩셋 계열 검사가 다른 계열과 섞지 않게). */
export const MONSTER_KIT_FAMILY = "oprn-atlas";

type SheetData = {
  id: string; name: string; tileSize: number; tilesPerRow: number; count: number;
  passability: PassFlag[]; priority: ("lower" | "upper")[]; terrain: number[]; tileMeta: TileAiMetadata[];
  animationStrips: TilesetDef["animationStrips"]; autotileGroups: unknown[]; structureKits: unknown[];
  ledgeDirections?: TilesetDef["ledgeDirections"]; slideTiles?: TilesetDef["slideTiles"];
  referenceDocuments?: TilesetReferenceCategory[];
};

export function isMonsterKitTexture(textureKey: string): boolean {
  return textureKey in MONSTER_KIT_SHEET_DATA;
}

/** 번들 정의의 독립 사본. */
export function createMonsterKitTileset(textureKey: string): TilesetDef {
  const data = MONSTER_KIT_SHEET_DATA[textureKey] as SheetData | undefined;
  const sheet = monsterKitSheet(textureKey);
  if (!data || !sheet) throw new Error(`몬스터 수집 시트 ${textureKey} 가 번들에 없습니다.`);
  return {
    id: data.id,
    name: data.name,
    image: { type: "bundled", id: textureKey },
    kind: "custom",
    family: MONSTER_KIT_FAMILY,
    tileSize: data.tileSize,
    tilesPerRow: data.tilesPerRow,
    count: data.count,
    passability: structuredClone(data.passability),
    priority: [...data.priority],
    terrain: [...data.terrain],
    tileMeta: structuredClone(data.tileMeta),
    animationStrips: structuredClone(data.animationStrips),
    autotileGroups: structuredClone(data.autotileGroups) as AutotileGroup[],
    structureKits: structuredClone(data.structureKits) as StructureKitDef[],
    ...(data.ledgeDirections ? { ledgeDirections: structuredClone(data.ledgeDirections) } : {}),
    ...(data.slideTiles ? { slideTiles: structuredClone(data.slideTiles) } : {}),
    ...(data.referenceDocuments?.length ? { referenceDocuments: structuredClone(data.referenceDocuments) } : {}),
  };
}

/** 번들이 낸 참고문서 용도(id `mk-<테마>`)인가 — 저자가 만든 용도는 건드리지 않는다. */
const isShippedCategory = (c: TilesetReferenceCategory) => c.id.startsWith("mk-");
/** 다시 구운 문서인지 싸게 가린다(문서 수백 KB 를 매 로드마다 통째로 비교하지 않는다). */
const fingerprint = (c: TilesetReferenceCategory) =>
  [c.description, ...c.documents.map(d => `${d.id}:${d.markdown.length}`), ...c.images.map(i => i.id)].join("|");

/**
 * 번들 참고문서 맞추기: 빠진 번들 용도는 더하고, 다시 구워 달라진 번들 용도는 같은 id 자리에서 바꾼다. 저자 용도는 그대로.
 * 저자가 참고문서를 일부러 비웠으면(빈 배열) 다시 심지 않는다.
 */
function ensureMonsterKitReferences(tileset: TilesetDef, fresh: TilesetDef): boolean {
  const shipped = fresh.referenceDocuments ?? [];
  if (!shipped.length || tileset.referenceDocuments?.length === 0) return false;
  const have = tileset.referenceDocuments ?? [];
  let changed = false;
  const next = have.map(c => {
    const f = isShippedCategory(c) ? shipped.find(s => s.id === c.id) : undefined;
    if (f && fingerprint(f) !== fingerprint(c)) { changed = true; return structuredClone(f); }
    return c;
  });
  for (const f of shipped) if (!next.some(c => c.id === f.id)) { next.push(structuredClone(f)); changed = true; }
  if (changed) tileset.referenceDocuments = next;
  return changed;
}

/**
 * 기존 사본 맞추기. 칸 수가 다르면(시트를 다시 구웠다) 칸 표 전체를 번들 것으로 바꾼다 — 칸 번호가 그 시트의 것이다.
 * 같은 칸 수면 저자가 덧붙인 킷·그룹은 두고, 빠진 번들 킷(`mk-` id)만 더한다.
 */
export function ensureMonsterKitTileset(tileset: TilesetDef): boolean {
  if (tileset.image.type !== "bundled" || !isMonsterKitTexture(tileset.image.id)) return false;
  const fresh = createMonsterKitTileset(tileset.image.id);
  if (tileset.count !== fresh.count) {
    Object.assign(tileset, {
      count: fresh.count, tilesPerRow: fresh.tilesPerRow, passability: fresh.passability, priority: fresh.priority,
      terrain: fresh.terrain, tileMeta: fresh.tileMeta, animationStrips: fresh.animationStrips, autotileGroups: fresh.autotileGroups,
      structureKits: fresh.structureKits, ledgeDirections: fresh.ledgeDirections, slideTiles: fresh.slideTiles, family: MONSTER_KIT_FAMILY,
    });
    ensureMonsterKitReferences(tileset, fresh);
    return true;
  }
  const refs = ensureMonsterKitReferences(tileset, fresh);
  const have = new Set((tileset.structureKits ?? []).map(kit => kit.id));
  const missing = (fresh.structureKits ?? []).filter(kit => !have.has(kit.id));
  if (!missing.length) return refs;
  tileset.structureKits = [...(tileset.structureKits ?? []), ...missing];
  return true;
}
