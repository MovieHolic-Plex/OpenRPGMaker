// 타일 이식(tile graft) 공용 로직.
// 다른 번들 타일 그림판의 개별 타일을 현재 타일셋 아틀라스에 16×16 blit 으로 "부분 로딩"한다.
// 넘버링 보존 원칙: 기존 타일 id 는 절대 변하지 않는다 —
//   (a) targetTile < 원본 count → 기존 슬롯 덮어쓰기,
//   (b) targetTile >= 원본 count → 행 단위 확장(count 를 tilesPerRow 배수로 확장, 아틀라스가 세로로 자람).
// 렌더는 베이크(캔버스 합성): Phaser 텍스처는 ensureTilesetTexture(tilesetImage.ts /
// (export 번들은 vite alias 없이 실제 tilesetImage.ts 를 그대로 사용), DOM 미리보기는 tileGraftImageCache.ts 가 이 모듈을 공유한다.
import { bundledChipsetTileSize, bundledChipsetTilesPerRow } from "./bundledChipsetGeometry";
import type { TileGraft, TilesetDef } from "@/project/types";
import { tilesetLookGrafts, tilesetLookSignature } from "./tilesetLooks";

type GraftSource = HTMLImageElement | HTMLCanvasElement;

// 유효한 graft 만 남기고 targetTile 중복은 마지막 항목이 이긴다(덮어쓰기 의미론).
// 타일셋이 겉모습(look)을 골랐으면 그 그림도 여기서 겹친다 — 저장된 이식 목록은 그대로이고, 그리는 쪽(아틀라스 굽기·미리 싣기)만 본다(tilesetLooks.ts).
//
// 기억해 둔다(tileGraftsTextureSuffix 와 같은 전제: 배열 정체성·길이가 같으면 같은 답). 이식 소스가 아직 안 실린 채 맵을 그리면
// ensureTilesetTexture 가 칸마다 이 목록을 두 번 만든다 — 버들항(이식 2,515개) 빈 맵 첫 그리기가 이것만으로 약 0.5s 였다(2026-11-27 패키지 프로파일).
// 돌려주는 배열은 부르는 쪽 소유 사본이다.
const EMPTY_ACTIVE_GRAFTS: { readonly grafts: readonly TileGraft[]; readonly sourceChipsets: readonly string[] } = Object.freeze({
  grafts: Object.freeze([]),
  sourceChipsets: Object.freeze([]),
});
const activeGraftCache = new WeakMap<readonly TileGraft[], { readonly length: number; readonly look: string; readonly grafts: readonly TileGraft[]; readonly sourceChipsets: readonly string[] }>();

function getCachedActiveTileGrafts(tileset: Pick<TilesetDef, "tileGrafts"> & Partial<Pick<TilesetDef, "look" | "image">>): { readonly grafts: readonly TileGraft[]; readonly sourceChipsets: readonly string[] } {
  const source = tileset.tileGrafts;
  const look = tilesetLookSignature(tileset);
  if (!source || source.length === 0) {
    if (!look) return EMPTY_ACTIVE_GRAFTS;
    const grafts = computeActiveTileGrafts(tileset);
    const sourceChipsets = grafts.length === 0 ? [] : [...new Set(grafts.map((g) => g.sourceChipset))];
    return { grafts, sourceChipsets };
  }
  const cached = activeGraftCache.get(source);
  if (cached && cached.length === source.length && cached.look === look) return cached;
  const grafts = computeActiveTileGrafts(tileset);
  const sourceChipsets = grafts.length === 0 ? [] : [...new Set(grafts.map((g) => g.sourceChipset))];
  const entry = { length: source.length, look, grafts, sourceChipsets };
  activeGraftCache.set(source, entry);
  return entry;
}

export function activeTileGrafts(tileset: Pick<TilesetDef, "tileGrafts"> & Partial<Pick<TilesetDef, "look" | "image">>): TileGraft[] {
  return getCachedActiveTileGrafts(tileset).grafts.slice();
}

/** O(1) cached check without cloning the full graft array. */
export function hasActiveTileGrafts(tileset: Pick<TilesetDef, "tileGrafts"> & Partial<Pick<TilesetDef, "look" | "image">>): boolean {
  return getCachedActiveTileGrafts(tileset).grafts.length > 0;
}

/** Cached unique source chipset texture keys referenced by active grafts. */
export function activeTileGraftSourceChipsets(tileset: Pick<TilesetDef, "tileGrafts"> & Partial<Pick<TilesetDef, "look" | "image">>): readonly string[] {
  return getCachedActiveTileGrafts(tileset).sourceChipsets;
}

function computeActiveTileGrafts(tileset: Pick<TilesetDef, "tileGrafts"> & Partial<Pick<TilesetDef, "look" | "image">>): TileGraft[] {
  const byTarget = new Map<number, TileGraft>();
  for (const graft of tileset.tileGrafts ?? []) {
    if (!isValidTileGraft(graft)) continue;
    byTarget.set(graft.targetTile, graft);
  }
  for (const graft of tilesetLookGrafts(tileset)) byTarget.set(graft.targetTile, graft);
  return [...byTarget.values()].sort((a, b) => a.targetTile - b.targetTile);
}

export function isValidTileGraft(graft: TileGraft | undefined | null): graft is TileGraft {
  return (
    !!graft &&
    Number.isInteger(graft.targetTile) &&
    graft.targetTile >= 0 &&
    Number.isInteger(graft.sourceTile) &&
    graft.sourceTile >= 0 &&
    typeof graft.sourceChipset === "string" &&
    graft.sourceChipset.length > 0
  );
}

// graft 구성에 따라 달라지는 텍스처 캐시 suffix. graft 가 없으면 빈 문자열.
// tilesetTextureKey 가 baseKey(+투명색 suffix) 뒤에 붙인다 — graft 편집 시 캐시 자동 무효화.
//
// 기억해 둔다. 이 값은 타일 한 칸을 그릴 때마다 불리는데(tilesetTextureKey), 기본 타일셋(forest_harmony)은
// 이식이 553개라 매번 정렬·이어 붙이기·해시를 다시 하면 칸당 약 0.18ms, 100×100 맵 한 번 그리기에 3초가
// 넘었다(Node 실측). 배열 정체성과 길이가 같으면 같은 답이다 — 이식을 바꾸는 코드는 배열을 새로 만들거나
// push 한다(길이가 바뀐다). 항목을 제자리에서 고치는 코드는 없다.
const graftSuffixCache = new WeakMap<readonly TileGraft[], { readonly length: number; readonly suffix: string }>();
export function tileGraftsTextureSuffix(tileset: Pick<TilesetDef, "tileGrafts"> & Partial<Pick<TilesetDef, "look" | "image">>): string {
  // 겉모습은 저장된 이식 배열과 따로 바뀐다 — 서명을 뒤에 붙인다(배열 캐시는 저장된 이식만 본다).
  const look = tilesetLookSignature(tileset);
  const lookSuffix = look ? `__look_${hashString(look)}` : "";
  const source = tileset.tileGrafts;
  if (!source || source.length === 0) return lookSuffix;
  const cached = graftSuffixCache.get(source);
  if (cached && cached.length === source.length) return cached.suffix + lookSuffix;
  const suffix = computeTileGraftsTextureSuffix(tileset);
  graftSuffixCache.set(source, { length: source.length, suffix });
  return suffix + lookSuffix;
}

function computeTileGraftsTextureSuffix(tileset: Pick<TilesetDef, "tileGrafts">): string {
  // 저장된 이식만(겉모습 서명은 tileGraftsTextureSuffix 가 따로 붙인다)
  const grafts = activeTileGrafts({ tileGrafts: tileset.tileGrafts });
  if (grafts.length === 0) return "";
  const signature = grafts
    .map((graft) => `${graft.targetTile}:${graft.sourceChipset}:${graft.sourceTile}`)
    .join("|");
  return `__grafts_${hashString(signature)}`;
}

// minCount 이상이면서 tilesPerRow 의 배수인 최소 count(행 단위 확장 규칙).
export function rowAlignedTileCount(minCount: number, tilesPerRow: number): number {
  const columns = Math.max(1, Math.floor(tilesPerRow));
  return Math.ceil(Math.max(0, minCount) / columns) * columns;
}

// graft 를 포함해 타일셋이 실제로 필요로 하는 count (확장 모드 반영).
export function tileCountWithGrafts(
  tileset: Pick<TilesetDef, "count" | "tilesPerRow" | "tileGrafts">
): number {
  const grafts = activeTileGrafts(tileset);
  const maxTarget = grafts.reduce((max, graft) => Math.max(max, graft.targetTile), -1);
  return Math.max(tileset.count, rowAlignedTileCount(maxTarget + 1, tileset.tilesPerRow));
}

// 베이스 이미지 위에 graft 타일들을 합성한 캔버스를 만든다.
// - 캔버스 크기: 베이스 크기와 count 가 요구하는 크기의 최대(확장 모드에서 세로로 자람).
// - resolveSourceImage: sourceChipset textureKey → 이미지(투명색 처리 완료본). 못 찾으면 해당 graft 는 건너뛰고 경고.
export function createGraftedTilesetCanvas(
  tileset: Pick<TilesetDef, "count" | "tileSize" | "tilesPerRow" | "tileGrafts">,
  base: GraftSource,
  resolveSourceImage: (sourceChipset: string) => GraftSource | null
): HTMLCanvasElement | null {
  const grafts = activeTileGrafts(tileset);
  const tileSize = tileset.tileSize;
  const rows = Math.ceil(tileCountWithGrafts(tileset) / Math.max(1, tileset.tilesPerRow));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(sourceWidth(base), tileset.tilesPerRow * tileSize);
  canvas.height = Math.max(sourceHeight(base), rows * tileSize);
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.imageSmoothingEnabled = false;
  context.drawImage(base, 0, 0);
  // 같은 소스에서 같은 줄의 이웃 칸을 이웃 칸으로 옮기는 이식은 한 번에 그린다(같은 화소). 버들항은 이식 7,737개가 3,286개 띠다.
  // 못 찾은 소스는 소스마다 한 번만 알린다(맵이 안 쓰는 이식 소스는 일부러 싣지 않는다 — 버들항 1,778장).
  const missing = new Map<string, number>();
  let index = 0;
  while (index < grafts.length) {
    const graft = grafts[index]!;
    const source = resolveSourceImage(graft.sourceChipset);
    if (!source) {
      missing.set(graft.sourceChipset, (missing.get(graft.sourceChipset) ?? 0) + 1);
      index += 1;
      continue;
    }
    const geometry = graftSourceGeometry(graft);
    const sourceTileSize = geometry.tileSize;
    let run = 1;
    while (index + run < grafts.length) {
      const next = grafts[index + run]!;
      if (next.sourceChipset !== graft.sourceChipset || next.targetTile !== graft.targetTile + run || next.sourceTile !== graft.sourceTile + run) break;
      if (next.targetTile % Math.max(1, tileset.tilesPerRow) === 0 || next.sourceTile % Math.max(1, geometry.tilesPerRow) === 0) break;
      const nextGeometry = graftSourceGeometry(next);
      if (nextGeometry.tileSize !== sourceTileSize || nextGeometry.tilesPerRow !== geometry.tilesPerRow) break;
      run += 1;
    }
    const src = tileXY(graft.sourceTile, geometry.tilesPerRow, sourceTileSize);
    const dst = tileXY(graft.targetTile, tileset.tilesPerRow, tileSize);
    context.clearRect(dst.x, dst.y, tileSize * run, tileSize);
    context.drawImage(
      source,
      src.x,
      src.y,
      sourceTileSize * run,
      sourceTileSize,
      dst.x,
      dst.y,
      tileSize * run,
      tileSize
    );
    index += run;
  }
  if (missing.size > 0) {
    const skipped = [...missing.values()].reduce((sum, count) => sum + count, 0);
    const sample = [...missing.keys()].slice(0, 5).join(", ");
    console.warn(`[tileGrafts] 소스 타일 그림판 ${missing.size}장을 찾지 못해 이식 ${skipped}칸을 건너뜁니다: ${sample}${missing.size > 5 ? " …" : ""}`);
  }
  return canvas;
}

type GraftGeometry = { tileSize: number; tilesPerRow: number };
/** 업로드 그림판 키 → 그 그림판을 쓰는 타일셋의 칸 배치. 프로젝트를 아는 쪽(tilesetImage.ts·헤드리스 렌더)이 등록한다. */
let uploadedGraftGeometry: (sourceChipset: string) => GraftGeometry | null = () => null;
export function setUploadedGraftGeometryResolver(resolve: (sourceChipset: string) => GraftGeometry | null): void {
  uploadedGraftGeometry = resolve;
}

/**
 * 이식 소스 칸의 크기·한 줄 칸 수 — 이식에 적힌 값이 먼저, 그다음 업로드 그림판을 쓰는 타일셋(칸 배치를 적기 전에 만든 이식),
 * 마지막으로 번들 키. 업로드 그림판을 번들 기본값(30칸)으로 읽으면 엉뚱한 칸·투명 칸이 그려진다.
 */
export function graftSourceGeometry(graft: Pick<TileGraft, "sourceChipset" | "sourceTileSize" | "sourceTilesPerRow">): GraftGeometry {
  const uploaded = graft.sourceTileSize && graft.sourceTilesPerRow ? null : uploadedGraftGeometry(graft.sourceChipset);
  return {
    tileSize: graft.sourceTileSize ?? uploaded?.tileSize ?? bundledChipsetTileSize(graft.sourceChipset),
    tilesPerRow: graft.sourceTilesPerRow ?? uploaded?.tilesPerRow ?? bundledChipsetTilesPerRow(graft.sourceChipset),
  };
}

/** 프로젝트에서 업로드 그림판 키를 쓰는 타일셋의 칸 배치. */
export function uploadedGraftGeometryIn(tilesets: Readonly<Record<string, TilesetDef>>, sourceChipset: string): GraftGeometry | null {
  for (const tileset of Object.values(tilesets)) {
    if (tileset.image.type === "uploaded" && tileset.image.id === sourceChipset) return { tileSize: tileset.tileSize, tilesPerRow: tileset.tilesPerRow };
  }
  return null;
}

function tileXY(tile: number, tilesPerRow: number, tileSize: number): { x: number; y: number } {
  const columns = Math.max(1, tilesPerRow);
  return { x: (tile % columns) * tileSize, y: Math.floor(tile / columns) * tileSize };
}

function sourceWidth(source: GraftSource): number {
  return source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width;
}

function sourceHeight(source: GraftSource): number {
  return source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function graftExpandedBadge(tileset: Pick<TilesetDef, "count" | "tilesPerRow" | "tileGrafts">): string | null {
  const base = tileset.count;
  const expanded = tileCountWithGrafts(tileset);
  if (expanded <= base) return null;
  return `+${expanded - base} tiles (${Math.ceil(expanded / Math.max(1, tileset.tilesPerRow))} rows)`;
}
