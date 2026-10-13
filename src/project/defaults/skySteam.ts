// 하늘섬·증기 도시 (스팀펑크 손 도트) 번들 칩셋 — 줄 A(하늘섬: 구름 바다·떠 있는 섬·풍차·비공정)와 줄 B(증기 산업도시: 벽돌·철 공장·보일러동·톱니 탑·
// 배관·선로·전차·기중기·가스등·비공정 부두·공방/보일러실/기관실/연구소/여관 실내)를 16px 칸으로 구운 48열 시트(2026-10).
// 시트 public/assets/sky-steam/sky-steam-chipset.png, 시트 메타 src/assets/skySteamSheet.json, 정의 src/assets/skySteamTileset.json 은
// scripts/content/sky-steam/bake_sky.py 가 굽는다(object-gate 영수증 PASS·그림 해시 일치 조각만). 참고문서는 src/assets/skySteamReferences.json
// (그림은 public/assets/sky-steam-references/ 경로만, 바이트 없음; bake_refs_sky.py). 위키: openwiki/sky-steam.md.
//
// 칸 번호는 덧붙이기 전용이다(자리 키 핀 tiledata/sky-steam/pins.json). 구조·갱신 규약은 wizardingWorld.ts 와 같다.
// 번들 소유 = 조립 부품 id `sky-a-*`·`steam-*`, 오토타일 그룹 `steam-at-*`, 칸 그룹 `sky:*`, 참고문서 `sky-*`. 저자가 더한 것(다른 id)은 갱신 때 보존한다.
import data from "@/assets/skySteamTileset.json";
import references from "@/assets/skySteamReferences.json";
import type { AutotileGroup, PassFlag, StructureKitDef, TileAiMetadata, TileGroupMetadata, TilesetDef } from "../types";
import type { TilesetReferenceCategory } from "../tilesetReferences";

export const SKY_STEAM_ID = "sky_steam";
export const SKY_STEAM_TEXTURE = "tex_sky_steam";
/** 스팀펑크 칩셋 계열. 다른 번들과 칸 번호 체계가 달라, 맵이 있는 채로 말없이 바꾸면 깨진다. */
export const SKY_STEAM_FAMILY = "oprn-sky-steam";
export const SKY_STEAM_COUNT: number = data.count;
export const SKY_STEAM_TILES_PER_ROW: number = data.tilesPerRow;
const REFERENCES = references as unknown as TilesetReferenceCategory[];

const isOwnedKit = (id: string): boolean => id.startsWith("sky-a-") || id.startsWith("steam-");
const isOwnedDoc = (id: string): boolean => id.startsWith("sky-");

/** 번들 정의의 독립 사본 — 참고문서를 들고 태어난다. */
export function createSkySteamTileset(): TilesetDef {
  return {
    id: SKY_STEAM_ID,
    name: data.name,
    image: { type: "bundled", id: SKY_STEAM_TEXTURE },
    kind: "custom",
    family: SKY_STEAM_FAMILY,
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

export function isSkySteamTileset(tileset: Pick<TilesetDef, "image"> | undefined): boolean {
  return tileset?.image.type === "bundled" && tileset.image.id === SKY_STEAM_TEXTURE;
}

/**
 * 참고문서를 최신으로 맞춘다. `sky-` 로 시작하는 용도·문서·그림은 번들 소유: 빠진 용도는 덧붙이고, 있는 용도에서는 `sky-` 항목만 번들 것으로 바꾼다.
 * 저자가 쓴 문서(다른 id)·저작 용도·공유 포인터는 건드리지 않는다.
 */
export function ensureSkySteamReferences(tileset: TilesetDef): boolean {
  if (tileset.id !== SKY_STEAM_ID || !isSkySteamTileset(tileset) || tileset.referenceSourceTilesetId) return false;
  const cats = [...(tileset.referenceDocuments ?? [])];
  let changed = false;
  for (const shipped of REFERENCES) {
    const i = cats.findIndex((existing) => existing.id === shipped.id);
    if (i < 0) { cats.push(structuredClone(shipped)); changed = true; continue; }
    const cur = cats[i]!;
    const next = { ...cur, name: shipped.name, description: shipped.description,
      documents: [...(cur.documents ?? []).filter((doc) => !isOwnedDoc(doc.id)), ...shipped.documents],
      images: [...(cur.images ?? []).filter((image) => !isOwnedDoc(image.id)), ...shipped.images] } as TilesetReferenceCategory;
    if (JSON.stringify(next) !== JSON.stringify(cur)) { cats[i] = structuredClone(next); changed = true; }
  }
  if (changed) tileset.referenceDocuments = cats;
  return changed;
}

function layerSignature(t: Pick<TilesetDef, "priority" | "passability" | "tileMeta">): string {
  let out = "";
  for (let i = 0; i < t.priority.length; i++) {
    const m = t.tileMeta?.[i];
    out += (t.priority[i] === "upper" ? "u" : "l") + (t.passability[i]?.up ? "1" : "0") + (m?.defaultLayer === "upper" ? "U" : m?.defaultLayer === "lower" ? "L" : "-") + (m?.locked ? "k" : "");
  }
  return out;
}
function shapeSignature(t: Pick<TilesetDef, "priority" | "passability" | "tileMeta" | "tileGroups" | "autotileGroups" | "animationStrips" | "structureKits">): string {
  const ownedAutotiles = (t.autotileGroups ?? []).filter((group) => isOwnedKit(group.id)).length;
  const ownedKits = (t.structureKits ?? []).filter((kit) => isOwnedKit(kit.id)).length;
  const groupLayers = (t.tileGroups ?? []).map((group) => {
    const g = group as { defaultLayer?: string; layerHome?: string };
    return `${(g.defaultLayer ?? "-")[0]}${(g.layerHome ?? "-")[0]}`;
  }).join("");
  return `${layerSignature(t)}|${t.tileGroups?.length ?? 0}|${groupLayers}|${ownedAutotiles}|${t.animationStrips?.length ?? 0}|${ownedKits}`;
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
 * 기존 프로젝트의 사본을 번들에 맞춘다(wizardingWorld.ts 와 같은 규약). 계열이 다르면 `oprn-sky-steam` 으로 고친다.
 * - 한 줄 폭이 같고 칸 수가 번들 이하인 사본: 번들 소유 칸 표를 새 굽기로 바꾸고, 저자 항목은 남긴다. 맵·저작 참고문서는 건드리지 않는다.
 * - 더 새 번들에서 저장된(칸이 더 많은) 사본은 줄이지 않는다. 한 줄 폭이 다른 사본은 칸 표를 통째로 바꾼다.
 */
export function ensureSkySteamTileset(tileset: TilesetDef): boolean {
  if (tileset.id !== SKY_STEAM_ID || !isSkySteamTileset(tileset)) return false;
  let changed = false;
  if (tileset.family !== SKY_STEAM_FAMILY) { tileset.family = SKY_STEAM_FAMILY; changed = true; }
  if (tileset.tilesPerRow === data.tilesPerRow) {
    if (tileset.count > data.count) return changed;
    if (tileset.count === data.count && shapeSignature(tileset) === bundleShape()) return changed;
    const fresh = createSkySteamTileset();
    const authoredKits = (tileset.structureKits ?? []).filter((kit) => !isOwnedKit(kit.id));
    const authoredAutotiles = (tileset.autotileGroups ?? []).filter((group) => !isOwnedKit(group.id));
    for (const key of ["count", "passability", "priority", "terrain", "tileMeta", "tileGroups", "animationStrips"] as const) {
      (tileset as unknown as Record<string, unknown>)[key] = fresh[key];
    }
    tileset.autotileGroups = [...(fresh.autotileGroups ?? []), ...authoredAutotiles];
    tileset.structureKits = [...(fresh.structureKits ?? []), ...authoredKits];
    return true;
  }
  const fresh = createSkySteamTileset();
  for (const key of ["count", "tilesPerRow", "passability", "priority", "terrain", "tileMeta", "tileGroups", "autotileGroups", "animationStrips", "structureKits"] as const) {
    (tileset as unknown as Record<string, unknown>)[key] = fresh[key];
  }
  return true;
}
