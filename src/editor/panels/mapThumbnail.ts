// 맵 트리 행 썸네일 — 실제 맵 타일을 작게 렌더한다.
//
// projectPickerCover.ts 와 같은 계약: 재료(타일셋 이미지)를 못 구하면 맵 그림인 척하지
// 않고 맵 id 해시로 만든 대체 무늬를 남긴다. 캐시 키는 맵 내용 시그니처라서 타일을
// 고치면 자동으로 다시 렌더된다. 캐시는 렌더된 캔버스를 그대로 들고 있는다 — data URL
// 로 두면 재렌더마다 이미지 디코드를 기다려야 해서 행이 한 번 비어 보인다.
import { drawMapTileLayers, loadTilesetImage } from "@/editor/mapTileDraw";
import { store } from "@/project/store";
import type { GameMap, MapId, Project, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

export const MAP_THUMB_WIDTH = 40;
export const MAP_THUMB_HEIGHT = 30;

/** 캔버스 백킹 배율 — 40×30 CSS 픽셀을 고밀도 화면에서도 또렷하게 유지한다. */
const BACKING_SCALE = 2;
/** 한 번에 그리는 썸네일 수 상한 — 맵 30개짜리 프로젝트가 한꺼번에 큰 캔버스를 잡지 않게 한다. */
const MAX_PARALLEL = 3;
/** 중간 렌더 긴 변 상한 — 100×100 맵을 원본 배율로 그리면 1600px 캔버스가 된다. */
const STAGE_MAX_EDGE = 512;
const CACHE_LIMIT = 120;

const renderedCache = new Map<string, HTMLCanvasElement>();
let active = 0;
const waiting: (() => void)[] = [];

export function createMapThumbnail(mapId: MapId): HTMLElement {
  const canvas = el("canvas", {
    class: "map-tree-thumb",
    attrs: {
      "aria-hidden": "true",
      height: String(MAP_THUMB_HEIGHT * BACKING_SCALE),
      width: String(MAP_THUMB_WIDTH * BACKING_SCALE),
    },
    dataset: { testid: `map-thumb-${mapId}`, thumbState: "pending" },
  }) as HTMLCanvasElement;

  const project = store.getCurrent();
  const map = project.maps[mapId];
  if (!map) {
    paintFallback(canvas, mapId);
    return canvas;
  }

  const key = thumbnailKey(mapId, map);
  const cached = renderedCache.get(key);
  if (cached) {
    blit(canvas, cached, "map");
    return canvas;
  }

  paintFallback(canvas, mapId);
  void paintFromMap(project, map, mapId, key);
  return canvas;
}

function thumbnailKey(mapId: MapId, map: GameMap): string {
  let hash = 2166136261;
  const mix = (value: number): void => {
    hash ^= value + 0x9e3779b9;
    hash = Math.imul(hash, 16777619);
  };
  mix(map.width);
  mix(map.height);
  mix(map.tileSize);
  for (const tile of map.lowerTiles) mix(tile);
  for (const tile of map.upperTiles) mix(tile);
  return `${mapId}:${map.tilesetId}:${(hash >>> 0).toString(36)}`;
}

async function paintFromMap(project: Project, map: GameMap, mapId: MapId, key: string): Promise<void> {
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) return;
  await acquire();
  try {
    const stage = await renderStage(map, tileset);
    if (!stage) return;
    renderedCache.set(key, stage);
    evictOverflow();
    for (const live of liveCanvasesFor(mapId)) blit(live, stage, "map");
  } catch {
    // 대체 무늬가 이미 그려져 있다 — 목록 렌더가 썸네일 하나 때문에 멈추면 안 된다.
  } finally {
    release();
  }
}

async function renderStage(map: GameMap, tileset: TilesetDef): Promise<HTMLCanvasElement | null> {
  const tile = map.tileSize || tileset.tileSize || 16;
  const pixelWidth = map.width * tile;
  const pixelHeight = map.height * tile;
  if (pixelWidth <= 0 || pixelHeight <= 0) return null;

  const image = await loadTilesetImage(tileset);
  if (!image.complete || image.naturalWidth === 0) return null;

  // 타일을 곧바로 2px 로 그리면 소스 사각형이 서브픽셀이 되어 격자가 뭉개진다.
  // 중간 캔버스에 정수 배율로 그린 뒤 한 번만 축소한다.
  const stageScale = Math.min(1, STAGE_MAX_EDGE / Math.max(pixelWidth, pixelHeight));
  const stageWidth = Math.max(1, Math.floor(pixelWidth * stageScale));
  const stageHeight = Math.max(1, Math.floor(pixelHeight * stageScale));
  const full = document.createElement("canvas");
  full.width = stageWidth;
  full.height = stageHeight;
  const fullContext = full.getContext("2d", { alpha: false });
  if (!fullContext) return null;
  fullContext.imageSmoothingEnabled = false;
  fullContext.fillStyle = "#1b2430";
  fullContext.fillRect(0, 0, stageWidth, stageHeight);
  drawMapTileLayers(fullContext, image, map, tileset, stageScale);

  const target = document.createElement("canvas");
  target.width = MAP_THUMB_WIDTH * BACKING_SCALE;
  target.height = MAP_THUMB_HEIGHT * BACKING_SCALE;
  const context = target.getContext("2d", { alpha: false });
  if (!context) return null;
  const fit = Math.min(target.width / stageWidth, target.height / stageHeight);
  const drawWidth = Math.max(1, Math.round(stageWidth * fit));
  const drawHeight = Math.max(1, Math.round(stageHeight * fit));
  context.fillStyle = "#111827";
  context.fillRect(0, 0, target.width, target.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    full,
    Math.floor((target.width - drawWidth) / 2),
    Math.floor((target.height - drawHeight) / 2),
    drawWidth,
    drawHeight,
  );
  return target;
}

function liveCanvasesFor(mapId: MapId): HTMLCanvasElement[] {
  return Array.from(document.querySelectorAll<HTMLCanvasElement>(`canvas[data-testid="map-thumb-${mapId}"]`));
}

function blit(canvas: HTMLCanvasElement, source: HTMLCanvasElement, state: "map" | "fallback"): void {
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return;
  context.imageSmoothingEnabled = false;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  canvas.dataset.thumbState = state;
}

function paintFallback(canvas: HTMLCanvasElement, mapId: MapId): void {
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return;
  let seed = hash(mapId);
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const hue = hash(mapId) % 360;
  context.fillStyle = `hsl(${hue}, 16%, 18%)`;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const cols = 5;
  const cellWidth = canvas.width / cols;
  const rows = Math.max(1, Math.round(canvas.height / cellWidth));
  const cellHeight = canvas.height / rows;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const value = random();
      if (value < 0.5) continue;
      context.fillStyle = `hsla(${hue}, 40%, 60%, ${(0.1 + value * 0.3).toFixed(3)})`;
      context.fillRect(x * cellWidth + 1, y * cellHeight + 1, cellWidth - 2, cellHeight - 2);
    }
  }
  canvas.dataset.thumbState = "fallback";
}

function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function evictOverflow(): void {
  while (renderedCache.size > CACHE_LIMIT) {
    const oldest = renderedCache.keys().next();
    if (oldest.done) return;
    renderedCache.delete(oldest.value);
  }
}

function acquire(): Promise<void> {
  if (active < MAX_PARALLEL) {
    active += 1;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    waiting.push(() => {
      active += 1;
      resolve();
    });
  });
}

function release(): void {
  active -= 1;
  const next = waiting.shift();
  if (next) next();
}
