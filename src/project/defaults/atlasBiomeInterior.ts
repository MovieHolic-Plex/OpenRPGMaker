// 생성 칩셋(oprn-atlas) 계열의 공용 실내 = 손 도트 실내 v5 전용 시트(2026-09-29, tiledata/hand-interior/v5).
// 시트 public/assets/atlas-interior/interior-chipset.png(48칸 폭), 정의 src/assets/atlasBiomeInteriorTileset.json,
// 조립 사양 src/assets/handInteriorSpec.json — 셋 다 scripts/content/hand-interior/build_tileset.py 가 만든다.
//   빈 칸 · 공허 · 천장(기본+7종 × 이웃 32) · 바닥 27종(64px 주기 4×4 × 그림자 4) · 벽면 19종(2줄 × 4열 × 서쪽 그림자)
//   · 가구 381종(발밑 = 막힘, 솟은 칸·걸이 = ★, 바닥 무늬·계단 = 밟음; 움직이는 칸은 12프레임 animationStrips)
//   · 탁자 자동 타일 9종 · 줄 자동 타일 11종(깔개·선로·울타리·창살·제단 난간·증기관) · 탁상 물건 119종
//   · 예제 26맵(tiledata/hand-interior/v5-maps)의 합성 칸(탁상 물건을 얹은 가구·창 빛)
// 옛 정의(2026-09-29 오전, Tibo 실내 번호 0~2159 + 배·던전 블록)는 폐기했다. 배·던전은 atlasBiomeDungeon.ts 로 떼었다.
// 조립은 src/editor/handInterior/builder.ts(평면 문자열 → 구조 자동, 가구는 v5 물건 id), 도구 build_hand_interior_room.
import sheet from "@/assets/atlasBiomeInteriorSheet.json";
import { bundledJson } from "./bundledJson";
/** 번들 정의 JSON — 처음 쓸 때 읽는다(bundledJson.ts). 칸 수·한 줄 폭은 같은 굽기가 쓰는 작은 시트 메타(`atlasBiomeInteriorSheet.json`)에서 읽는다. */
const data = () => bundledJson("atlasBiomeInteriorTileset");
import references from "@/assets/sharedHandInteriorReferences.json";
import type { AutotileGroup, PassFlag, Project, SlideRule, StructureKitDef, TileAiMetadata, TileGroupMetadata, TilesetDef } from "../types";
import { REFERENCE_LIMITS, type TilesetReferenceCategory } from "../tilesetReferences";
import { PAD_LABEL, attachWorkshopTiles, detachGraftTail, detachWorkshopTiles } from "../workshopTiles";

export const ATLAS_BIOME_INTERIOR_ID = "atlas_biome_interior";
export const ATLAS_BIOME_INTERIOR_TEXTURE = "tex_atlas_biome_interior";
export const ATLAS_BIOME_INTERIOR_FAMILY = "oprn-atlas";
export const ATLAS_BIOME_INTERIOR_COUNT: number = sheet.count;
export const ATLAS_BIOME_INTERIOR_TILES_PER_ROW: number = sheet.tilesPerRow;
/** 옛(Tibo 번호 기반) 정의가 번들로 심은 참고문서 분류 — 새 정의로 바꿀 때 함께 뺀다. */
const RETIRED_REFERENCE_PREFIX = "atlas-interior-";
const REFERENCES = references as unknown as readonly { tilesetId: string; category: TilesetReferenceCategory }[];

/** 굽기 JSON 의 빙판 규칙(없을 수 있다 — 얼음 바닥을 굽기 전 판본). */
function slideTilesOf(json: unknown): Record<string, SlideRule> | undefined {
  return (json as { slideTiles?: Record<string, SlideRule> }).slideTiles;
}

/** 새 사본이 들고 태어나는 참고문서 — 정의 JSON 없이 만든다(로드가 저장본에서 뺀 번들 참고문서를 되돌릴 때 쓴다, installReferenceOwners.ts). */
export function atlasBiomeInteriorBundledReferenceDocuments(): TilesetReferenceCategory[] {
  return REFERENCES.filter((r) => r.tilesetId === ATLAS_BIOME_INTERIOR_ID).map((r) => structuredClone(r.category));
}

export function createAtlasBiomeInteriorTileset(): TilesetDef {
  return {
    id: ATLAS_BIOME_INTERIOR_ID,
    name: data().name,
    image: { type: "bundled", id: ATLAS_BIOME_INTERIOR_TEXTURE },
    kind: "custom",
    family: ATLAS_BIOME_INTERIOR_FAMILY,
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
    // 빙판(퍼즐 얼음 미끄럼 방) — interior-plus 굽기가 얼음 바닥 칸을 "ice" 규칙으로 적는다.
    ...(slideTilesOf(data()) ? { slideTiles: structuredClone(slideTilesOf(data())!) } : {}),
    referenceDocuments: atlasBiomeInteriorBundledReferenceDocuments(),
    roomKit: { builtin: ATLAS_BIOME_INTERIOR_ID },
  };
}

export function isAtlasBiomeInteriorTileset(tileset: Pick<TilesetDef, "image"> | undefined): boolean {
  return tileset?.image.type === "bundled" && tileset.image.id === ATLAS_BIOME_INTERIOR_TEXTURE;
}

/**
 * 손 도트 v5 정의인가 — 가로 칸 수·첫 킷 id 로 가른다(옛 정의는 30칸 폭, Tibo 킷). 칸 수는 굽기마다 끝에 붙어 늘어날 뿐
 * 이미 있는 번호는 그대로다(scripts/content/hand-interior/pin_ids.py) — 그래서 칸 수가 번들 이하이면 같은 시트의 옛 빌드다.
 */
export function isHandInteriorV5Definition(tileset: TilesetDef): boolean {
  return tileset.count <= sheet.count && tileset.tilesPerRow === sheet.tilesPerRow
    && (tileset.structureKits ?? []).some((k) => k.id.startsWith("hand-interior:"));
}

/** 통행·층·잠금 한 줄 요약 — 번들 메타가 바뀌었는지(같은 시트의 새 빌드인지) 싸게 가른다. */
function layerSignature(t: Pick<TilesetDef, "priority" | "passability" | "tileMeta">): string {
  let out = "";
  for (let i = 0; i < t.priority.length; i++) {
    const m = t.tileMeta?.[i];
    out += (t.priority[i] === "upper" ? "u" : "l") + (t.passability[i]?.up ? "1" : "0") + (m?.defaultLayer === "upper" ? "U" : m?.defaultLayer === "lower" ? "L" : "-") + (m?.locked ? "k" : "");
  }
  return out;
}
let bundled: string | undefined;
function bundleSignature(): string {
  return bundled ??= layerSignature({ priority: data().priority as ("lower" | "upper")[], passability: data().passability as PassFlag[], tileMeta: data().tileMeta as TileAiMetadata[] });
}

/** 옛 정의를 새 정의로 바꿀 때 남기는 경고(맵은 건드리지 않는다). 편집기 콘솔과 테스트가 읽는다. */
export const atlasBiomeInteriorReplacementWarnings: string[] = [];

/**
 * 번들 참고문서를 한 번 더한다. 저자가 쓴 분류·공유 포인터는 건드리지 않는다.
 */
export function ensureAtlasBiomeInteriorReferences(tileset: TilesetDef): boolean {
  if (!isAtlasBiomeInteriorTileset(tileset) || tileset.id !== ATLAS_BIOME_INTERIOR_ID || tileset.referenceSourceTilesetId) return false;
  let changed = false;
  for (const { tilesetId, category } of REFERENCES) {
    if (tilesetId !== tileset.id) continue;
    const existing = (tileset.referenceDocuments ?? []).find(c => c.id === category.id);
    if (!existing) {
      tileset.referenceDocuments = [...(tileset.referenceDocuments ?? []), structuredClone(category)];
      changed = true;
      continue;
    }
    // 같은 시트 판본에도 새 문서를 배포한다. 기존 문서·그림(저자 수정 포함)은 덮지 않는다.
    const documents = category.documents.filter(d => !existing.documents.some(old => old.id === d.id));
    const images = category.images.filter(i => !existing.images.some(old => old.id === i.id));
    if (!documents.length && !images.length) continue;
    // 번들이 기물 사전 문서를 다시 나눠 id 가 바뀌면(2026-10 실측: objects-elf-farm-guild-hall → objects-elf-farm-gimmick-guild …) 옛 조각과 새 조각이
    // 합쳐져 문서 한도(64)를 넘고, 그 프로젝트는 저장 검사에서 막힌다. 한도를 넘을 때만 번들에 없는 옛 번들 조각(같은 용도 id 머리)을 뺀다.
    const ownPrefix = `${category.id}-`;
    const keptDocs = existing.documents.length + documents.length > REFERENCE_LIMITS.documents
      ? existing.documents.filter(old => !old.id.startsWith(ownPrefix) || category.documents.some(d => d.id === old.id))
      : existing.documents;
    const next = { ...existing, documents: [...keptDocs, ...structuredClone(documents)], images: [...existing.images, ...structuredClone(images)] };
    tileset.referenceDocuments = tileset.referenceDocuments!.map(c => c === existing ? next : c);
    changed = true;
  }
  return changed;
}

type InteriorProject = Pick<Project, "tilesets"> & { assets?: { uploaded: Record<string, unknown> }; maps?: Readonly<Record<string, { tilesetId?: string; lowerTiles?: number[]; upperTiles?: number[]; lowerOverlayTiles?: number[]; upperOverlayTiles?: number[] }>> };

/**
 * 번들 정의를 최신으로 맞춘다. 공방에서 구운 칸(project/workshopTiles.ts)은 새로 고치기 전에 떼어 두었다가
 * 새 번들 끝 뒤에 다시 붙인다 — 번들이 칸을 덧붙여 번호가 밀리면 그 칩셋을 쓰는 맵도 함께 고쳐 쓴다.
 */
export function ensureAtlasBiomeInteriorCurrent(project: InteriorProject, id: string): boolean {
  const tileset = project.tilesets[id];
  if (!tileset || !isAtlasBiomeInteriorTileset(tileset) || id !== ATLAS_BIOME_INTERIOR_ID) return false;
  const parked = detachWorkshopTiles(tileset);
  const tail = detachV5GraftTail(tileset);
  const changed = refreshAtlasBiomeInterior(project, id);
  // 꼬리 이식을 먼저, 공방 칸을 그 뒤에 — 떼기 전과 같은 순서다.
  const graftsMoved = tail ? attachWorkshopTiles(project, id, tail) : false;
  const moved = parked ? attachWorkshopTiles(project, id, parked) : false;
  const current = project.tilesets[id]!;
  const kit = !current.roomKit;
  if (kit) current.roomKit = { builtin: ATLAS_BIOME_INTERIOR_ID };
  return changed || graftsMoved || moved || kit;
}

/**
 * 손 도트 v5 칩셋 끝에 다른 칩셋 그림을 이식해 붙인 꼬리(폴른 스타가 버들항 던전 수정 받침을 7677~ 에 붙였다)를 떼어 둔다.
 * 떼지 않으면 count 가 번들 시트보다 커서 isHandInteriorV5Definition 이 거짓 → 옛 Tibo 정의로 오인해 통째로 갈아 끼우고
 * 이식 칸을 잃는다(맵 17개 「다시 지어야 한다」 거짓 경고, 2026-10-27). 꼬리 = 끝에서부터 이식 칸·빈 칸(이름 없음·공방 자리 칸)만 이어진 구간.
 */
function detachV5GraftTail(tileset: TilesetDef) {
  const targets = new Set((tileset.tileGrafts ?? []).map((g) => g.targetTile));
  if (!targets.size) return null;
  let start = tileset.count;
  while (start > 0 && (targets.has(start - 1) || [undefined, "", PAD_LABEL].includes(tileset.tileMeta?.[start - 1]?.label))) start -= 1;
  if (start >= tileset.count || ![...targets].some((t) => t >= start)) return null;
  if (!isHandInteriorV5Definition({ ...tileset, count: start })) return null;
  return detachGraftTail(tileset, start);
}

/**
 * 옛 저장본(Tibo 번호 기반 atlas_biome_interior)은 손 도트 v5 정의로 통째로 바꾼다 — 칸 번호가 전혀 다르므로
 * 이어 붙이기가 아니다. 그 칩셋을 쓰던 맵은 그대로 두고(칸 번호가 다른 그림을 가리키게 된다) 경고만 남긴다.
 * 저자가 직접 쓴 참고문서 분류(옛 번들 분류 atlas-interior-* 가 아닌 것)는 옮겨 둔다.
 */
function refreshAtlasBiomeInterior(project: InteriorProject, id: string): boolean {
  const tileset = project.tilesets[id]!;
  if (isHandInteriorV5Definition(tileset)) {
    // same sheet, older build (new tiles appended, passage/layer/labels refreshed): refresh the bundle-owned fields.
    // Tile ids already placed on maps keep their meaning (append-only build), so maps are not touched.
    if (tileset.count === sheet.count && layerSignature(tileset) === bundleSignature()) return ensureAtlasBiomeInteriorReferences(tileset);
    const fresh = createAtlasBiomeInteriorTileset();
    for (const key of ["count", "passability", "priority", "terrain", "tileMeta", "tileGroups", "autotileGroups", "animationStrips", "structureKits"] as const) {
      (tileset as unknown as Record<string, unknown>)[key] = fresh[key];
    }
    if (fresh.slideTiles) tileset.slideTiles = fresh.slideTiles;
    // the bundle-owned reference category (furniture dictionary, examples) follows the new build; authored categories stay
    tileset.referenceDocuments = (tileset.referenceDocuments ?? []).map((c) => fresh.referenceDocuments!.find((f) => f.id === c.id) ?? c);
    ensureAtlasBiomeInteriorReferences(tileset);
    return true;
  }
  const fresh = createAtlasBiomeInteriorTileset();
  const authored = (tileset.referenceDocuments ?? []).filter((c) => !c.id.startsWith(RETIRED_REFERENCE_PREFIX)
    && !fresh.referenceDocuments!.some((f) => f.id === c.id));
  if (authored.length) fresh.referenceDocuments = [...fresh.referenceDocuments!, ...authored];
  project.tilesets[id] = fresh;
  const users = Object.entries(project.maps ?? {}).filter(([, m]) => m.tilesetId === id).map(([mapId]) => mapId);
  if (users.length) {
    const warning = `atlas_biome_interior 가 손 도트 v5 정의로 바뀌었다 — 옛 정의(Tibo 번호)로 깐 맵 ${users.length}개는 그대로 두었다: ${users.slice(0, 12).join(", ")}${users.length > 12 ? " …" : ""}. 칸 번호가 새 시트의 다른 그림을 가리키므로 다시 지어야 한다(build_hand_interior_room).`;
    atlasBiomeInteriorReplacementWarnings.push(warning);
    console.warn(`[tilesets] ${warning}`);
  }
  return true;
}
