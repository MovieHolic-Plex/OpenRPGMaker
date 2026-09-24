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

/**
 * 썸네일 한 장의 주문. 행 썸네일(40×30)이 유일한 크기였는데 맵 상세 칸이 큰 미리보기를
 * 필요로 한다 — 같은 캔버스를 CSS 로 늘리면 80×60 백킹을 확대해 뭉개진다.
 *
 * `testId` 를 따로 받는 이유: 재렌더 완료 시 `liveCanvasesFor` 가 testid 로 살아 있는
 * 캔버스를 찾아 blit 한다. 큰 미리보기가 행과 같은 testid 를 쓰면 서로의 스테이지를
 * 자기 크기에 맞춰 덮어써 한쪽이 늘 흐려진다.
 */
export type MapThumbnailOptions = {
  readonly width?: number;
  readonly height?: number;
  readonly className?: string;
  readonly testId?: string;
};
/** 한 번에 그리는 썸네일 수 상한 — 맵 30개짜리 프로젝트가 한꺼번에 큰 캔버스를 잡지 않게 한다. */
const MAX_PARALLEL = 3;
/** 중간 렌더 긴 변 상한 — 100×100 맵을 원본 배율로 그리면 1600px 캔버스가 된다. */
const STAGE_MAX_EDGE = 512;
const CACHE_LIMIT = 120;

const renderedCache = new Map<string, HTMLCanvasElement>();
const mapContentHashes = new WeakMap<GameMap, number>();
const pendingKeys = new Set<string>();
let active = 0;
const waiting: (() => void)[] = [];

export function createMapThumbnail(mapId: MapId, options: MapThumbnailOptions = {}): HTMLElement {
  const width = Math.max(1, Math.round(options.width ?? MAP_THUMB_WIDTH));
  const height = Math.max(1, Math.round(options.height ?? MAP_THUMB_HEIGHT));
  const testId = options.testId ?? `map-thumb-${mapId}`;
  const canvas = el("canvas", {
    class: options.className ?? "map-tree-thumb",
    attrs: {
      "aria-hidden": "true",
      height: String(height * BACKING_SCALE),
      width: String(width * BACKING_SCALE),
    },
    dataset: { testid: testId, thumbState: "pending" },
  }) as HTMLCanvasElement;

  const project = store.getCurrent();
  const map = project.maps[mapId];
  if (!map) {
    paintFallback(canvas, mapId);
    return canvas;
  }

  const key = thumbnailKey(mapId, map, width, height);
  const cached = renderedCache.get(key);
  if (cached) {
    blit(canvas, cached, "map");
    return canvas;
  }

  paintFallback(canvas, mapId);
  if (!pendingKeys.has(key)) {
    pendingKeys.add(key);
    // Let the editor canvas paint once before thumbnail rasterization starts. Canvas previews are
    // intentionally asynchronous, but a resolved Promise still runs before the browser gets a
    // paint opportunity and can make opening a large map feel frozen.
    const start = (): void => { void paintFromMap(project, map, key, width, height, testId); };
    if (typeof window !== "undefined" && typeof window.setTimeout === "function") window.setTimeout(start, 0);
    else start();
  }
  return canvas;
}

/** 캐시 키에 목표 크기가 들어가야 한다 — 안 넣으면 40×30 스테이지가 큰 미리보기로 확대된다. */
function thumbnailKey(mapId: MapId, map: GameMap, width: number, height: number): string {
  let hash = mapContentHashes.get(map);
  if (hash === undefined) {
    hash = hashMapContent(map);
    mapContentHashes.set(map, hash);
  }
  return `${mapId}:${map.tilesetId}:${width}x${height}:${(hash >>> 0).toString(36)}`;
}

function hashMapContent(map: GameMap): number {
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
  // 선택 층은 있을 때만 태그·길이를 앞에 섞는다 — 옛 맵(선택 층 없음)의 해시는 그대로이고,
  // 같은 길이의 두 층이 내용을 맞바꿔도 다른 값이 된다.
  const mixOptional = (tag: number, values: readonly number[] | undefined): void => {
    if (!values) return;
    mix(tag);
    mix(values.length);
    for (const value of values) mix(value);
  };
  mixOptional(0x4c32, map.lowerOverlayTiles);
  mixOptional(0x4c34, map.upperOverlayTiles);
  mixOptional(0x5348, map.shadowBits);
  return hash;
}

async function paintFromMap(
  project: Project,
  map: GameMap,
  key: string,
  width: number,
  height: number,
  testId: string,
): Promise<void> {
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) return;
  await acquire();
  try {
    const stage = await renderStage(map, tileset, width, height);
    if (!stage) return;
    renderedCache.set(key, stage);
    evictOverflow();
    for (const live of liveCanvasesFor(testId)) blit(live, stage, "map");
  } catch {
    // 대체 무늬가 이미 그려져 있다 — 목록 렌더가 썸네일 하나 때문에 멈추면 안 된다.
  } finally {
    pendingKeys.delete(key);
    release();
  }
}

async function renderStage(
  map: GameMap,
  tileset: TilesetDef,
  targetWidth: number,
  targetHeight: number,
): Promise<HTMLCanvasElement | null> {
  const tile = map.tileSize || tileset.tileSize || 16;
  const pixelWidth = map.width * tile;
  const pixelHeight = map.height * tile;
  if (pixelWidth <= 0 || pixelHeight <= 0) return null;

  const image = await loadTilesetImage(tileset);
  if ("complete" in image && (!image.complete || image.naturalWidth === 0)) return null;

  // 타일을 곧바로 2px 로 그리면 소스 사각형이 서브픽셀이 되어 격자가 뭉개진다.
  // 중간 캔버스에 정수 배율로 그린 뒤 한 번만 축소한다. 큰 미리보기(상세 칸)는 목표가
  // 512px 상한보다 클 수 있으므로 상한을 목표 백킹 크기까지 올린다 — 안 올리면
  // 512px 스테이지를 확대하게 되어 큰 칸에서 흐려진다.
  const stageMaxEdge = Math.max(STAGE_MAX_EDGE, targetWidth * BACKING_SCALE, targetHeight * BACKING_SCALE);
  const stageScale = Math.min(1, stageMaxEdge / Math.max(pixelWidth, pixelHeight));
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
  target.width = targetWidth * BACKING_SCALE;
  target.height = targetHeight * BACKING_SCALE;
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

function liveCanvasesFor(testId: string): HTMLCanvasElement[] {
  return Array.from(document.querySelectorAll<HTMLCanvasElement>(`canvas[data-testid="${testId}"]`));
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
