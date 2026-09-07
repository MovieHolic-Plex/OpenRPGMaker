import type { GameMap, Project, TilesetDef } from "@/project/types";
import { mapVisualEvidenceUnavailable } from "./mapVisualEvidence";
import {
  canvasDataUrl,
  createCanvas,
  drawCheckerBackground,
  drawTile,
  EMPTY_TILE,
  loadTilesetImage,
} from "./toolImageCanvas";
import {
  drawRegionEventSprites,
  resolveRegionEventSprites,
  type RegionEventSprite,
} from "./toolImageEventSprites";

export type RenderedToolImage = { readonly dataUrl: string; readonly label: string };

const MAX_TILE_SWATCHES = 12;
const TILE_SWATCH_SCALE = 6;
/** 맵 미리보기 타일 배율 — 너무 크면 base64가 컨텍스트를 잠식(16×16×3×16px ≈ 거대). */
const TILE_GRID_SCALE = 2;
const MIN_SWATCH_SIZE = 48;
const MAX_SWATCH_COLUMNS = 6;

type UnknownRecord = { readonly [key: string]: unknown };

type TileGridPayload = {
  readonly tileset: TilesetDef;
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
  } catch {
    return [];
  }
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
    return [];
  } catch {
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

  const image = await loadTilesetImage(tileset);
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

async function renderTileGridPayload(payload: TileGridPayload, label: string): Promise<RenderedToolImage[]> {
  const image = await loadTilesetImage(payload.tileset);
  const drawSize = payload.tileset.tileSize * TILE_GRID_SCALE;
  const canvasPair = createCanvas(payload.w * drawSize, payload.h * drawSize);
  if (!canvasPair) return [];
  const { canvas, context } = canvasPair;
  drawCheckerBackground(context, canvas.width, canvas.height, Math.max(4, Math.floor(drawSize / 2)));
  for (let row = 0; row < payload.h; row += 1) {
    for (let column = 0; column < payload.w; column += 1) {
      const lowerTile = tileAt(payload.lower, row, column);
      if (lowerTile >= 0) drawTile(context, image, lowerTile, payload.tileset, column * drawSize, row * drawSize, drawSize);
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
    ? resolveRegionEventSprites(project, map, { x, y, w, h }, tileset.tileSize * TILE_GRID_SCALE)
    : { ok: true as const, sprites: [] };
  if (!events.ok) throw new Error(events.reason);
  return { tileset, x, y, w, h, lower, upper, events: events.sprites };
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
