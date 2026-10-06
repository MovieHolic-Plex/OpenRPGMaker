// 마법 학교 · 해리포터풍 (손 도트) 번들 칩셋 — HP 테마 42색 팔레트 손 도트 조각을 16px 칸으로 구운 48열 시트(2026-10).
// 시트 public/assets/wizarding-world/wizarding-world-chipset.png, 시트 메타 src/assets/wizardingWorldSheet.json, 정의 src/assets/wizardingWorldTileset.json 은
// scripts/content/wizarding/bake_wz.py 가 굽는다(검수 통과 조각만). 참고문서는 src/assets/wizardingWorldReferences.json(그림은 public/assets/wizarding-world-references/ 경로만,
// 바이트 없음; scripts/content/wizarding/bake_refs_wz.py 가 굽는다). 위키: openwiki/wizarding-world.md.
//
// 칸 번호는 덧붙이기 전용이다(자리 키 핀) — 다시 구워도 앞 번호는 그대로이고 새 칸은 끝에 붙는다. 그래서 칸 수가 번들 이하이고 한 줄 폭이 같은
// 사본은 같은 시트의 옛 굽기로 보고, 번들 소유 칸 표(통행·층·그룹·오토타일·움직임·조립 부품)만 새 굽기로 바꾼다. 맵은 건드리지 않는다.
// 번들 소유 = id 가 `wz-` 로 시작하는 조립 부품·오토타일 그룹·참고문서. 저자가 더한 것(다른 id)은 갱신 때 보존한다.
// 구조는 jpCity.ts 와 같다(같은 갱신 규약). 시트 칸 수·열 수는 하드코딩하지 않고 정의 JSON 에서 읽는다.
import data from "@/assets/wizardingWorldTileset.json";
import references from "@/assets/wizardingWorldReferences.json";
import type { AutotileGroup, PassFlag, StructureKitDef, TileAiMetadata, TileGroupMetadata, TilesetDef } from "../types";
import type { TilesetReferenceCategory } from "../tilesetReferences";

export const WIZARDING_WORLD_ID = "wizarding_world";
export const WIZARDING_WORLD_TEXTURE = "tex_wizarding_world";
/** 마법 학교 칩셋 계열. 다른 번들과 칸 번호 체계가 달라, 맵이 있는 채로 말없이 바꾸면 깨진다. */
export const WIZARDING_WORLD_FAMILY = "oprn-wizard";
export const WIZARDING_WORLD_COUNT: number = data.count;
export const WIZARDING_WORLD_TILES_PER_ROW: number = data.tilesPerRow;
/** 조립 부품·오토타일 그룹·참고문서 id 머리. 번들이 소유한다(기존 사본에서 같은 id 는 번들 것으로 바꾼다). */
export const WIZARDING_WORLD_PREFIX = "wz-";
const REFERENCES = references as unknown as TilesetReferenceCategory[];

const isOwned = (id: string): boolean => id.startsWith(WIZARDING_WORLD_PREFIX);

/** 번들 정의의 독립 사본 — 참고문서를 들고 태어난다. */
export function createWizardingWorldTileset(): TilesetDef {
  return {
    id: WIZARDING_WORLD_ID,
    name: data.name,
    image: { type: "bundled", id: WIZARDING_WORLD_TEXTURE },
    kind: "custom",
    family: WIZARDING_WORLD_FAMILY,
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

export function isWizardingWorldTileset(tileset: Pick<TilesetDef, "image"> | undefined): boolean {
  return tileset?.image.type === "bundled" && tileset.image.id === WIZARDING_WORLD_TEXTURE;
}

/**
 * 참고문서를 최신으로 맞춘다. `wz-` 로 시작하는 문서·그림은 번들 소유(학습 결과는 번들이 소유한다):
 * 빠진 용도는 덧붙이고, 있는 용도에서는 `wz-` 항목만 번들 것으로 바꾼다. 저자가 쓴 문서(다른 id)·저작 용도·공유 포인터는 건드리지 않는다.
 * 번들 참고문서 용도 id·문서 id·그림 id 는 모두 `wz-` 로 시작한다(그림은 `/assets/wizarding-world-references/*.png` 경로).
 */
export function ensureWizardingWorldReferences(tileset: TilesetDef): boolean {
  if (tileset.id !== WIZARDING_WORLD_ID || !isWizardingWorldTileset(tileset) || tileset.referenceSourceTilesetId) return false;
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
 * 표 길이까지 합친 요약. 오토타일 그룹·조립 부품은 번들 소유(`wz-`)만 센다 — 저자가 더한 것까지 세면
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
 * 기존 프로젝트의 사본을 번들에 맞춘다. 계열이 비었거나 다르면 `oprn-wizard` 로 고친다.
 * - 한 줄 폭이 같고 칸 수가 번들 이하인 사본(같은 시트의 옛 굽기, 덧붙이기 전용): 번들 소유 칸 표를 새 굽기로 바꾼다.
 *   저자가 더한 조립 부품·오토타일 그룹(`wz-` 가 아닌 id)은 남기고, 번들 소유 `wz-` 항목은 최신으로 바꾼다. 맵·저작 참고문서는 건드리지 않는다.
 * - 더 새 번들에서 저장된(칸이 더 많은) 사본은 줄이지 않는다.
 * - 한 줄 폭이 다른 사본은 다른 시트라 칸 번호가 가리키는 그림이 다르다 — 칸 표를 번들 것으로 통째로 바꾼다(저자 항목도 번호가 무의미하므로 버린다).
 */
export function ensureWizardingWorldTileset(tileset: TilesetDef): boolean {
  if (tileset.id !== WIZARDING_WORLD_ID || !isWizardingWorldTileset(tileset)) return false;
  let changed = false;
  if (tileset.family !== WIZARDING_WORLD_FAMILY) { tileset.family = WIZARDING_WORLD_FAMILY; changed = true; }
  if (tileset.tilesPerRow === data.tilesPerRow) {
    if (tileset.count > data.count) return changed;
    if (tileset.count === data.count && shapeSignature(tileset) === bundleShape()) return changed;
    const fresh = createWizardingWorldTileset();
    const authoredKits = (tileset.structureKits ?? []).filter((kit) => !isOwned(kit.id));
    const authoredAutotiles = (tileset.autotileGroups ?? []).filter((group) => !isOwned(group.id));
    for (const key of ["count", "passability", "priority", "terrain", "tileMeta", "tileGroups", "animationStrips"] as const) {
      (tileset as unknown as Record<string, unknown>)[key] = fresh[key];
    }
    tileset.autotileGroups = [...(fresh.autotileGroups ?? []), ...authoredAutotiles];
    tileset.structureKits = [...(fresh.structureKits ?? []), ...authoredKits];
    return true;
  }
  const fresh = createWizardingWorldTileset();
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
