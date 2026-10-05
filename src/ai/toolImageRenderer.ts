import { drawMapTileLayer } from "@/editor/mapTileDraw";
import { drawCharsetPreview, type CharsetPreviewCandidate } from './charsetPreview';
import { encodePng, type RgbaImage } from '@/editor/cutsceneArt/imageProcess';
import { resolveAssetResourceUrl } from '@/assets/generatedAssetResourceResolver';
import { presentationArtIds } from '@/editor/tools/presentationTools';
import { tileBackingTile } from "@/editor/tileLayerPolicy";
import { cropExtraLayers } from "@/project/mapLayers";
import { reliefMapView } from "@/editor/reliefMapView";
import { sunlightField } from "@/project/sunlight";
import { canvasSunlightArt } from "@/project/sunlightArtCanvas";
import { reliefGroundFromImage } from "@/editor/reliefGroundSurface";
import { cellLift, reliefLiftField } from "@/project/relief/screen";
import type { GameMap, Project, TilesetDef } from "@/project/types";
import { mapVisualEvidenceUnavailable } from "./mapVisualEvidence";
import {
  canvasDataUrl,
  createCanvas,
  drawCheckerBackground,
  drawTile,
  EMPTY_TILE,
  keyedTilesetImage,
  loadKeyedCharsetImage,
  loadTilesetImage,
  tileDrawSize,
} from "./toolImageCanvas";
import {
  drawRegionEventSprites,
  resolveRegionEventSprites,
  type RegionEventSprite,
} from "./toolImageEventSprites";

export type RenderedToolImage = { readonly dataUrl: string; readonly label: string };

const MAX_TILE_SWATCHES = 12;
const TILE_SWATCH_SCALE = 6;
const MIN_SWATCH_SIZE = 48;
const MAX_SWATCH_COLUMNS = 6;

type UnknownRecord = { readonly [key: string]: unknown };

type TileGridPayload = {
  readonly tileset: TilesetDef;
  readonly map?: GameMap;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly lower: readonly (readonly number[])[];
  readonly upper: readonly (readonly number[])[];
  readonly events: readonly RegionEventSprite[];
};

/** 뷰포트/영역 타일 그리드를 데이터 URL 이미지로 렌더(어시스턴트 턴 시작 비전 주입용). */
export async function renderMapRegionImages(
  project: Project,
  data: unknown,
  label = "에디터 뷰포트",
): Promise<RenderedToolImage[]> {
  if (typeof document === "undefined") return [];
  try {
    return await renderTileGrid(project, data, label);
  } catch (cause) {
    if (cause instanceof Error && cause.message.includes("rendering-unavailable")) throw cause;
    return [];
  }
}

export async function renderPiMapImage(project: Project, data: unknown): Promise<string> {
  const raw = toolPayload(data), map = raw ? mapField(project, raw) : undefined;
  if (!map) throw new Error("map-rendering-unavailable: map missing");
  const unavailable = mapVisualEvidenceUnavailable(map);
  if (unavailable) throw new Error(unavailable);
  if (!project.tilesets[map.tilesetId]) throw new Error("map-rendering-unavailable: tileset missing");
  const payload = tileGridPayload(project, data);
  if (!payload) throw new Error("map-rendering-unavailable: invalid region");
  const images = await renderTileGridPayload(payload, "현재 초안", project);
  if (!images[0]) throw new Error("map-rendering-unavailable: no PNG");
  return images[0].dataUrl;
}

/** Media refs stay in SQLite/assets. Resolve through the browser's real asset bridge. */
export async function renderPiToolImage(project: Project, toolName: string, data: unknown): Promise<string> {
  const candidates = (data as { charsetCandidates?: readonly CharsetPreviewCandidate[] } | undefined)?.charsetCandidates;
  if (candidates?.length) {
    const sheets = new Map<string, RgbaImage>();
    for (const id of new Set(candidates.map(row => row.textureKey))) {
      const url = resolveAssetResourceUrl(id, { project });
      if (!url) throw new Error(`캐릭터 칩 원본을 찾을 수 없습니다: ${id}`);
      const image = await loadKeyedCharsetImage(url);
      const pair = createCanvas(image.naturalWidth, image.naturalHeight);
      if (!pair) throw new Error('캐릭터 칩 미리보기 캔버스를 만들 수 없습니다.');
      pair.context.drawImage(image, 0, 0);
      const rgba = pair.context.getImageData(0, 0, pair.canvas.width, pair.canvas.height);
      sheets.set(id, { width: rgba.width, height: rgba.height, data: rgba.data });
    }
    return encodePng(drawCharsetPreview(candidates, id => sheets.get(id)!));
  }
  if (toolName !== 'show_title_opening') return renderPiMapImage(project, data);
  const resourceId = (data as { resourceId?: unknown } | undefined)?.resourceId;
  if (typeof resourceId !== 'string') throw new Error('presentation-rendering-unavailable: resource id missing');
  const url = resolveAssetResourceUrl(resourceId, { project });
  if (!url) throw new Error('presentation-rendering-unavailable: image missing');
  const image = new Image();
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('presentation-rendering-unavailable: image failed to load')); image.src = url; });
  const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
  const pair = createCanvas(Math.max(1, Math.round(image.naturalWidth * scale)), Math.max(1, Math.round(image.naturalHeight * scale)));
  if (!pair) throw new Error('presentation-rendering-unavailable: canvas missing');
  const { canvas, context } = pair;
  context.imageSmoothingEnabled = true;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const png = canvasDataUrl(canvas);
  if (!png) throw new Error('presentation-rendering-unavailable: no PNG');
  return png;
}

export async function renderToolImages(project: Project, toolName: string, data: unknown): Promise<RenderedToolImage[]> {
  if (typeof document === "undefined") return [];
  try {
    if (toolName === "show_tiles") return await renderShowTiles(project, data);
    if (toolName === "show_map_region") return await renderTileGrid(project, data, "맵 미리보기");
    if (toolName === "show_tile_grid") return await renderTileGrid(project, data);
    if (toolName === "get_map_region") return await renderTileGrid(project, data);
    if (toolName === "preview_house") return await renderTileGrid(project, data, "집 미리보기");
    if (toolName === "look_at_houses") return await renderTileGrid(project, data, "깔린 집 관찰");
    if (toolName === "render_group_sample") return await renderGroupSamples(project, data);
    if (toolName === 'show_title_opening') {
      const images: RenderedToolImage[] = [];
      for (const resourceId of presentationArtIds(project)) images.push({
        dataUrl: await renderPiToolImage(project, toolName, { resourceId }),
        label: `${resourceId}: ${project.assets.uploaded[resourceId]?.name ?? resourceId}`,
      });
      return images;
    }
    return [];
  } catch (cause) {
    // Intentional unavailable contracts must stay observable; load/decode noise stays soft.
    if (cause instanceof Error && cause.message.includes("rendering-unavailable")) throw cause;
    return [];
  }
}

async function renderShowTiles(project: Project, data: unknown): Promise<RenderedToolImage[]> {
  const payload = toolPayload(data);
  if (!payload) return [];
  const tilesetId = stringValue(payload.tilesetId);
  if (!tilesetId) return [];
  const tileset = project.tilesets[tilesetId];
  if (!isRenderableTileset(tileset)) return [];
  const tiles = integerArrayField(payload, "tiles")
    ?? integerArrayField(payload, "tileIds")
    ?? [];
  const visibleTiles = tiles.filter((tile) => tile >= 0).slice(0, MAX_TILE_SWATCHES);
  if (visibleTiles.length === 0) return [];

  const image = keyedTilesetImage(tileset, await loadTilesetImage(tileset));
  const swatchSize = Math.max(tileset.tileSize * TILE_SWATCH_SCALE, MIN_SWATCH_SIZE);
  const captionHeight = 20;
  const gap = 8;
  const margin = 8;
  const columns = Math.min(MAX_SWATCH_COLUMNS, visibleTiles.length);
  const rows = Math.ceil(visibleTiles.length / columns);
  const width = margin * 2 + columns * swatchSize + (columns - 1) * gap;
  const height = margin * 2 + rows * (swatchSize + captionHeight) + (rows - 1) * gap;
  const canvasPair = createCanvas(width, height);
  if (!canvasPair) return [];
  const { canvas, context } = canvasPair;
  drawCheckerBackground(context, canvas.width, canvas.height, 8);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "bold 14px sans-serif";
  for (let index = 0; index < visibleTiles.length; index += 1) {
    const tile = visibleTiles[index];
    const column = index % columns;
    const row = Math.floor(index / columns);
    const targetX = margin + column * (swatchSize + gap);
    const targetY = margin + row * (swatchSize + captionHeight + gap);
    drawTile(context, image, tile, tileset, targetX, targetY, swatchSize);
    const captionX = targetX + swatchSize / 2;
    const captionY = targetY + swatchSize + captionHeight / 2;
    context.lineWidth = 3;
    context.strokeStyle = "#ffffff";
    context.strokeText(String(tile), captionX, captionY);
    context.fillStyle = "#111111";
    context.fillText(String(tile), captionX, captionY);
  }
  const dataUrl = canvasDataUrl(canvas);
  return dataUrl ? [{ dataUrl, label: `타일 ${visibleTiles.join(", ")}` }] : [];
}

async function renderTileGrid(project: Project, data: unknown, label = "영역"): Promise<RenderedToolImage[]> {
  const raw = toolPayload(data), map = raw ? mapField(project, raw) : undefined;
  const unavailable = map ? mapVisualEvidenceUnavailable(map) : null;
  if (unavailable) throw new Error(unavailable);
  const payload = tileGridPayload(project, data);
  if (!payload) return [];
  return renderTileGridPayload(payload, `${label} (${payload.x},${payload.y}) ${payload.w}×${payload.h}`);
}

async function renderTileGridPayload(payload: TileGridPayload, label: string, draft?: Project): Promise<RenderedToolImage[]> {
  const image = keyedTilesetImage(payload.tileset, await loadTilesetImage(payload.tileset, draft));
  // Whole-map coverage renders reach here, so the canvas is sized to the delivered
  // image rather than drawn huge and shrunk. Small regions keep the native scale.
  const drawSize = tileDrawSize(payload.w, payload.h, payload.tileset.tileSize);
  const region = payload.map ? cropMapRegion(payload.map, payload.x, payload.y, payload.w, payload.h) : undefined;
  const relief = region ? reliefMapView(region, drawSize, reliefGroundFromImage(region, payload.tileset, image)) : null;
  const canvasPair = createCanvas(payload.w * drawSize, relief?.height ?? payload.h * drawSize);
  if (!canvasPair) return [];
  const { canvas, context } = canvasPair;
  const sunlight = payload.map ? sunlightField(payload.map, payload.tileset,
    canvasSunlightArt(image, payload.tileset.tileSize, payload.tileset.tilesPerRow)) : null;
  const sunRow = (row: number, pad = 0) => {
    if (!sunlight) return;
    const s = sunlight.row(payload.y + row, payload.x, payload.x + payload.w), pair = createCanvas(s.w, s.h);
    if (!pair) throw new Error("map-sunlight-rendering-unavailable: canvas unavailable");
    pair.context.putImageData(new ImageData(new Uint8ClampedArray(s.rgba), s.w, s.h), 0, 0);
    context.drawImage(pair.canvas, 0, (s.y * s.scale - payload.y) * drawSize + pad, s.w * s.scale * drawSize, s.h * s.scale * drawSize);
  };
  drawCheckerBackground(context, canvas.width, canvas.height, Math.max(4, Math.floor(drawSize / 2)));
  if (payload.map) {
    const scale = drawSize / payload.tileset.tileSize;
    if (relief && region) {
      const lower = createCanvas(payload.w * drawSize, payload.h * drawSize), upper = createCanvas(payload.w * drawSize, payload.h * drawSize);
      if (!lower || !upper) throw new Error("map-relief-rendering-unavailable: canvas unavailable");
      drawMapTileLayer(lower.context, image, region, payload.tileset, "lower", scale);
      drawMapTileLayer(upper.context, image, region, payload.tileset, "upper", scale);
      const field = reliefLiftField(region.relief!);
      const events = payload.events.map(event => {
        const source = payload.map!.events.find(e => e.id === event.eventId);
        const x = (source?.x ?? payload.x) - payload.x, y = (source?.y ?? payload.y) - payload.y;
        return { ...event, row: y, destY: event.destY + relief.pad - cellLift(field, x, y) * drawSize };
      });
      const strip = (s: (typeof relief.rows)[number]["under"]) => {
        if (!s) return;
        const pair = createCanvas(s.w, s.h);
        if (!pair) throw new Error("map-relief-rendering-unavailable: strip canvas unavailable");
        pair.context.putImageData(new ImageData(new Uint8ClampedArray(s.rgba), s.w, s.h), 0, 0);
        context.drawImage(pair.canvas, s.x * relief.scale, s.y * relief.scale, s.w * relief.scale, s.h * relief.scale);
      };
      for (const row of relief.rows) {
        strip(row.under);
        for (const cell of row.cells) if (cell.paintLower) context.drawImage(lower.canvas, cell.x * drawSize, row.y * drawSize, drawSize, drawSize, cell.x * drawSize, cell.y, drawSize, drawSize);
        await drawRegionEventSprites(context, events.filter(e => e.row === row.y && e.priority === "below"));
        strip(row.over);
        for (const cell of row.cells) context.drawImage(upper.canvas, cell.x * drawSize, row.y * drawSize, drawSize, drawSize, cell.x * drawSize, cell.y, drawSize, drawSize);
        sunRow(row.y, relief.pad);
        await drawRegionEventSprites(context, events.filter(e => e.row === row.y && e.priority === "same"));
      }
      await drawRegionEventSprites(context, events.filter(e => e.priority === "above"));
      const dataUrl = canvasDataUrl(canvas);
      return dataUrl ? [{ dataUrl, label: `${label} · 실제 절벽 높이 포함` }] : [];
    }
    if (!region) return [];
    drawMapTileLayer(context, image, region, payload.tileset, "lower", scale);
    const below = payload.events.filter((event) => event.priority === "below");
    const rest = payload.events.filter((event) => event.priority !== "below");
    await drawRegionEventSprites(context, below);
    drawMapTileLayer(context, image, region, payload.tileset, "upper", scale);
    for (let row = 0; row < payload.h; row++) sunRow(row);
    await drawRegionEventSprites(context, rest);
    const dataUrl = canvasDataUrl(canvas);
    return dataUrl ? [{ dataUrl, label }] : [];
  }
  for (let row = 0; row < payload.h; row += 1) {
    for (let column = 0; column < payload.w; column += 1) {
      const lowerTile = tileAt(payload.lower, row, column);
      if (lowerTile < 0) continue;
      const backing = tileBackingTile(payload.tileset, lowerTile);
      if (backing !== null) drawTile(context, image, backing, payload.tileset, column * drawSize, row * drawSize, drawSize);
      drawTile(context, image, lowerTile, payload.tileset, column * drawSize, row * drawSize, drawSize);
    }
  }
  const below = payload.events.filter((event) => event.priority === "below");
  const rest = payload.events.filter((event) => event.priority !== "below");
  await drawRegionEventSprites(context, below);
  for (let row = 0; row < payload.h; row += 1) {
    for (let column = 0; column < payload.w; column += 1) {
      const upperTile = tileAt(payload.upper, row, column);
      if (upperTile >= 0) drawTile(context, image, upperTile, payload.tileset, column * drawSize, row * drawSize, drawSize);
    }
  }
  await drawRegionEventSprites(context, rest);
  const dataUrl = canvasDataUrl(canvas);
  return dataUrl ? [{ dataUrl, label }] : [];
}

async function renderGroupSamples(project: Project, data: unknown): Promise<RenderedToolImage[]> {
  const payload = toolPayload(data);
  if (!payload) return [];
  const tilesetId = stringValue(payload.tilesetId);
  const rawSamples = payload.samples;
  if (!tilesetId || !Array.isArray(rawSamples)) return [];
  const images: RenderedToolImage[] = [];
  for (const sample of rawSamples) {
    const record = objectRecord(sample);
    if (!record) continue;
    const label = stringValue(record.label) ?? "샘플";
    const w = positiveIntegerValue(record.w);
    const h = positiveIntegerValue(record.h);
    if (!w || !h) continue;
    const grid = tileGridPayload(project, { h, lower: record.lower, tilesetId, upper: record.upper, w, x: 0, y: 0 });
    if (!grid) continue;
    images.push(...(await renderTileGridPayload(grid, label)));
  }
  return images;
}

function tileGridPayload(project: Project, data: unknown): TileGridPayload | null {
  const payload = toolPayload(data);
  if (!payload) return null;
  const x = integerValue(payload.x) ?? 0;
  const y = integerValue(payload.y) ?? 0;
  const requestedW = positiveIntegerValue(payload.w) ?? positiveIntegerValue(payload.width);
  const requestedH = positiveIntegerValue(payload.h) ?? positiveIntegerValue(payload.height);
  const lower = numberGrid(payload.lower, requestedW, requestedH)
    ?? numberGrid(payload.lowerTiles, requestedW, requestedH)
    ?? numberGrid(payload.tiles, requestedW, requestedH)
    ?? [];
  const upper = numberGrid(payload.upper, requestedW, requestedH)
    ?? numberGrid(payload.upperTiles, requestedW, requestedH)
    ?? [];
  if (lower.length === 0 && upper.length === 0) return null;
  const w = requestedW ?? Math.max(gridWidth(lower), gridWidth(upper));
  const h = requestedH ?? Math.max(lower.length, upper.length);
  if (w <= 0 || h <= 0) return null;
  const tileset = tilesetForPayload(project, payload);
  if (!isRenderableTileset(tileset)) return null;
  const map = mapField(project, payload);
  const events = map
    // Must be the same draw size renderTileGridPayload uses, or sprites land off-grid.
    ? resolveRegionEventSprites(project, map, { x, y, w, h }, tileDrawSize(w, h, tileset.tileSize))
    : { ok: true as const, sprites: [] };
  if (!events.ok) throw new Error(events.reason);
  return { tileset, map, x, y, w, h, lower, upper, events: events.sprites };
}

function cropMapRegion(map: GameMap, x: number, y: number, w: number, h: number): GameMap {
  const cut = (tiles: readonly number[]): number[] => Array.from({ length: w * h }, (_, index) => {
    const column = index % w;
    const row = Math.floor(index / w);
    return tiles[(y + row) * map.width + x + column] ?? -1;
  });
  const cropped: GameMap = {
    ...map,
    width: w,
    height: h,
    lowerTiles: cut(map.lowerTiles),
    upperTiles: cut(map.upperTiles),
    events: [],
  };
  cropExtraLayers(cropped, map.width, map.height, x, y, w, h);
  return cropped;
}

function tilesetForPayload(project: Project, payload: UnknownRecord): TilesetDef | undefined {
  const map = mapField(project, payload);
  const tilesetId = stringValue(payload.tilesetId) ?? map?.tilesetId;
  return tilesetId ? project.tilesets[tilesetId] : undefined;
}

function isRenderableTileset(tileset: TilesetDef | undefined): tileset is TilesetDef {
  return Boolean(tileset && tileset.tileSize > 0 && tileset.tilesPerRow > 0);
}

function toolPayload(data: unknown): UnknownRecord | null {
  const root = objectRecord(data);
  if (!root) return null;
  return objectRecord(root.data) ?? root;
}

function mapField(project: Project, payload: UnknownRecord): GameMap | undefined {
  const mapId = stringValue(payload.mapId);
  return mapId ? project.maps[mapId] : undefined;
}

function objectRecord(value: unknown): UnknownRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as UnknownRecord;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function integerValue(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function integerArrayField(record: UnknownRecord, key: string): readonly number[] | null {
  const value = record[key];
  if (!Array.isArray(value)) return null;
  return value.map(integerValue).filter((tile): tile is number => tile !== null);
}

function positiveIntegerValue(value: unknown): number | null {
  const integer = integerValue(value);
  return integer !== null && integer > 0 ? integer : null;
}

function numberGrid(value: unknown, width: number | null, height: number | null): readonly (readonly number[])[] | null {
  if (!Array.isArray(value)) return null;
  if (value.every(Array.isArray)) {
    return value.map((row) => row.map((cell) => integerValue(cell) ?? EMPTY_TILE));
  }
  if (width === null || height === null) return null;
  const flat = value.map((cell) => integerValue(cell) ?? EMPTY_TILE);
  return Array.from({ length: height }, (_, row) => flat.slice(row * width, row * width + width));
}

function gridWidth(grid: readonly (readonly number[])[]): number {
  return grid.reduce((max, row) => Math.max(max, row.length), 0);
}

function tileAt(grid: readonly (readonly number[])[], row: number, column: number): number {
  return grid[row]?.[column] ?? EMPTY_TILE;
}
