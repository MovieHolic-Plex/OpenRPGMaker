// 타일 이식(tile graft) 공용 로직.
// 다른 번들 타일 그림판의 개별 타일을 현재 타일셋 아틀라스에 16×16 blit 으로 "부분 로딩"한다.
// 넘버링 보존 원칙: 기존 타일 id 는 절대 변하지 않는다 —
//   (a) targetTile < 원본 count → 기존 슬롯 덮어쓰기,
//   (b) targetTile >= 원본 count → 행 단위 확장(count 를 tilesPerRow 배수로 확장, 아틀라스가 세로로 자람).
// 렌더는 베이크(캔버스 합성): Phaser 텍스처는 ensureTilesetTexture(tilesetImage.ts /
// (export 번들은 vite alias 없이 실제 tilesetImage.ts 를 그대로 사용), DOM 미리보기는 tileGraftImageCache.ts 가 이 모듈을 공유한다.
import { bundledChipsetTileSize, bundledChipsetTilesPerRow } from "./bundledChipsetGeometry";
import type { TileGraft, TilesetDef } from "@/project/types";

type GraftSource = HTMLImageElement | HTMLCanvasElement;

// 유효한 graft 만 남기고 targetTile 중복은 마지막 항목이 이긴다(덮어쓰기 의미론).
export function activeTileGrafts(tileset: Pick<TilesetDef, "tileGrafts">): TileGraft[] {
  const byTarget = new Map<number, TileGraft>();
  for (const graft of tileset.tileGrafts ?? []) {
    if (!isValidTileGraft(graft)) continue;
    byTarget.set(graft.targetTile, graft);
  }
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
export function tileGraftsTextureSuffix(tileset: Pick<TilesetDef, "tileGrafts">): string {
  const grafts = activeTileGrafts(tileset);
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
  for (const graft of grafts) {
    const source = resolveSourceImage(graft.sourceChipset);
    if (!source) {
      console.warn(`[tileGrafts] 소스 타일 그림판 이미지를 찾지 못해 이식을 건너뜁니다: ${graft.sourceChipset}#${graft.sourceTile}`);
      continue;
    }
    const sourceTileSize = bundledChipsetTileSize(graft.sourceChipset);
    const src = tileXY(graft.sourceTile, bundledChipsetTilesPerRow(graft.sourceChipset), sourceTileSize);
    const dst = tileXY(graft.targetTile, tileset.tilesPerRow, tileSize);
    context.clearRect(dst.x, dst.y, tileSize, tileSize);
    context.drawImage(
      source,
      src.x,
      src.y,
      sourceTileSize,
      sourceTileSize,
      dst.x,
      dst.y,
      tileSize,
      tileSize
    );
  }
  return canvas;
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
