// 클릭 없이 보는 시각 시트 — 모든 맵을 PNG 로 그리고, 검사 결과·자동 플레이 경로와 함께 자체완결 report.html 로 묶는다.
//
//   bun scripts/qa-game/render.mts qa-runs/<id>        → <id>/render/*.png + <id>/report.html
//   옵션: --project x.json (다른 프로젝트)  --out <dir>  --scale 1
//
// 타일은 에디터 캔버스 렌더러와 같은 함수(`editor/mapTileDraw.drawMapTileLayer`: 받침 타일·4분면 오토타일·호수·겹침 스택)로
// 그린다. 캔버스 대신 pngjs 버퍼 위에 drawImage 만 구현한 작은 2D 컨텍스트를 넘긴다. 이벤트는 스프라이트 대신 표식(문·전투·엔딩·기타).

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { drawCharsetPreview, type CharsetPreviewCandidate } from '../../src/ai/charsetPreview.ts';
import { resolveAssetResourceUrl } from '../../src/assets/generatedAssetResourceResolver.ts';
import { drawMapTileLayer } from "../../src/editor/mapTileDraw.ts";
import { reliefMapView } from "../../src/editor/reliefMapView.ts";
import { sunlightField } from "../../src/project/sunlight.ts";
import { rasterSunlightArt } from "../../src/project/sunlightArt.ts";
import { createReliefGroundSurface } from "../../src/editor/reliefGroundSurface.ts";
import { cropExtraLayers } from "../../src/project/mapLayers.ts";
import { tilesetBaseImageUrl } from "../../src/editor/tilesetImage.ts";
import { uploadedAssetUrl } from "../../src/project/persistence/assetAccessors.ts";
import { isColorKeyedChipsetTextureKey, resolveTransparentColorKeys } from "../../src/assets/chipsetTransparency.ts";
import { applyTransparentColorKey, applyTransparentColorKeys } from "../../src/assets/transparentColorKey.ts";
import { activeTileGrafts, tileCountWithGrafts } from "../../src/assets/tileGrafts.ts";
import { bundledChipsetTileSize, bundledChipsetTilesPerRow } from "../../src/assets/bundledChipsetGeometry.ts";
import { store } from "../../src/project/store.ts";
import { whereText, type GameCheckReport } from "../../src/qa/gameCheck/index.ts";
import type { GameMap, Project, TilesetDef } from "../../src/project/types.ts";
import { loadProjectFile } from "./check.mts";
import { readRecordedCalls } from "./lib/recorder.ts";

let ARGV: readonly string[] = process.argv.slice(2);
const arg = (name: string): string | undefined => { const i = ARGV.indexOf(`--${name}`); return i >= 0 ? ARGV[i + 1] : undefined; };

type Raster = { width: number; height: number; data: Uint8Array };

/** CanvasRenderingContext2D 중 mapTileDraw 가 쓰는 것만 — drawImage(9인자, 최근접 표본 + 알파 합성)와
 * 그림자 사분면(drawShadowQuarters)의 save/restore/fillStyle/fillRect(rgba 반투명 채움). */
class PngContext {
  fillStyle = "rgba(0,0,0,1)";
  private saved: string[] = [];
  constructor(readonly target: Raster) {}
  save(): void { this.saved.push(this.fillStyle); }
  restore(): void { this.fillStyle = this.saved.pop() ?? this.fillStyle; }
  fillRect(x: number, y: number, w: number, h: number): void {
    const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/u.exec(this.fillStyle);
    if (!match) return;
    const rgb = [Number(match[1]), Number(match[2]), Number(match[3])];
    const a = match[4] === undefined ? 1 : Number(match[4]);
    const { target } = this;
    const x1 = Math.min(target.width, Math.ceil(x + w)), y1 = Math.min(target.height, Math.ceil(y + h));
    for (let py = Math.max(0, Math.floor(y)); py < y1; py += 1) {
      for (let px = Math.max(0, Math.floor(x)); px < x1; px += 1) {
        const di = (py * target.width + px) * 4;
        for (let c = 0; c < 3; c += 1) target.data[di + c] = Math.round(rgb[c]! * a + target.data[di + c]! * (1 - a));
        target.data[di + 3] = Math.max(target.data[di + 3]!, Math.round(a * 255));
      }
    }
  }
  drawImage(image: Raster, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void {
    const { target } = this;
    const x0 = Math.max(0, Math.floor(dx));
    const y0 = Math.max(0, Math.floor(dy));
    const x1 = Math.min(target.width, Math.ceil(dx + dw));
    const y1 = Math.min(target.height, Math.ceil(dy + dh));
    for (let y = y0; y < y1; y += 1) {
      const syy = Math.floor(sy + ((y - dy + 0.5) * sh) / dh);
      if (syy < 0 || syy >= image.height) continue;
      for (let x = x0; x < x1; x += 1) {
        const sxx = Math.floor(sx + ((x - dx + 0.5) * sw) / dw);
        if (sxx < 0 || sxx >= image.width) continue;
        const si = (syy * image.width + sxx) * 4;
        const a = image.data[si + 3]! / 255;
        if (a === 0) continue;
        const di = (y * target.width + x) * 4;
        for (let c = 0; c < 3; c += 1) target.data[di + c] = Math.round(image.data[si + c]! * a + target.data[di + c]! * (1 - a));
        target.data[di + 3] = Math.max(target.data[di + 3]!, image.data[si + 3]!);
      }
    }
  }
}

const imageCache = new Map<string, Raster | null>();

/** 에디터 createGraftedTilesetCanvas 와 같은 합성 — 이식 타일(숲마을 수관·절벽 등)을 아틀라스에 붙인다.
 * 빠뜨리면 숲이 줄기만 남은 그림이 되어 「나무가 잘렸다」는 거짓 결함을 낳는다. */
function loadTilesetRaster(project: Project, tileset: TilesetDef): Raster | null {
  const base = loadBaseTilesetRaster(project, tileset);
  const grafts = activeTileGrafts(tileset);
  if (!base || grafts.length === 0) return base;
  const key = `grafts|${tileset.id}|${grafts.map(g => `${g.targetTile}:${g.sourceChipset}:${g.sourceTile}`).join(",")}`;
  if (imageCache.has(key)) return imageCache.get(key)!;
  const size = tileset.tileSize, columns = Math.max(1, tileset.tilesPerRow);
  const rows = Math.ceil(tileCountWithGrafts(tileset) / columns);
  const width = Math.max(base.width, columns * size), height = Math.max(base.height, rows * size);
  const out: Raster = { width, height, data: new Uint8Array(width * height * 4) };
  for (let y = 0; y < base.height; y += 1) out.data.set(base.data.subarray(y * base.width * 4, (y + 1) * base.width * 4), y * width * 4);
  for (const graft of grafts) {
    // 업로드 자산 이식(공방 기물·방 짓기 변형 칸)은 프로젝트 자산에서 읽는다.
    const sourceType = project.assets.uploaded[graft.sourceChipset] ? "uploaded" : "bundled";
    const source = loadBaseTilesetRaster(project, { id: graft.sourceChipset, image: { type: sourceType, id: graft.sourceChipset } } as TilesetDef);
    if (!source) continue;
    const ss = bundledChipsetTileSize(graft.sourceChipset), sc = bundledChipsetTilesPerRow(graft.sourceChipset);
    const sx = (graft.sourceTile % sc) * ss, sy = Math.floor(graft.sourceTile / sc) * ss;
    const dx = (graft.targetTile % columns) * size, dy = Math.floor(graft.targetTile / columns) * size;
    for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
      const px = sx + Math.floor((x * ss) / size), py = sy + Math.floor((y * ss) / size);
      const di = ((dy + y) * width + dx + x) * 4;
      if (px >= source.width || py >= source.height) { out.data.fill(0, di, di + 4); continue; }
      const si = (py * source.width + px) * 4;
      for (let c = 0; c < 4; c += 1) out.data[di + c] = source.data[si + c]!;
    }
  }
  imageCache.set(key, out);
  return out;
}

/**
 * 업로드 타일셋은 **그리는 프로젝트의** 자산에서 그림을 찾는다. `tilesetBaseImageUrl(tileset)` 은 프로젝트를 안 받으면
 * 전역 store 를 보고, 거기에 그 자산이 없으면 기본 칩셋 경로로 떨어진다 — 헤드리스 조수(pi-agent·gen)는 store 에
 * 다른 프로젝트가 있어 업로드 그림판(Rasak 48px 등)이 엉뚱한 기본 칩셋 조각으로 그려졌다(2026-09-25 실측).
 * 자산이 없거나 ref 만 있고 해석기가 없으면 null — 호출자가 「그림을 못 읽었다」로 보고한다(기본 칩셋 대체 금지).
 */
function tilesetSourceUrl(project: Project, tileset: TilesetDef): string | null {
  if (tileset.image.type !== "uploaded") return tilesetBaseImageUrl(tileset, project);
  const asset = project.assets.uploaded[tileset.image.id];
  return (asset ? uploadedAssetUrl(asset) : "") || null;
}

function loadBaseTilesetRaster(project: Project, tileset: TilesetDef): Raster | null {
  const url = tilesetSourceUrl(project, tileset);
  if (!url) return null;
  const key = `${url}|${tileset.transparentColor ?? ""}`;
  if (imageCache.has(key)) return imageCache.get(key)!;
  let bytes: Buffer | null = null;
  if (url.startsWith("data:image/png;base64,")) bytes = Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
  else if (/^\.?\/?assets\//u.test(url)) {
    const file = path.join("public", url.replace(/^\.?\//u, ""));
    if (fs.existsSync(file)) bytes = fs.readFileSync(file);
  }
  let raster: Raster | null = null;
  if (bytes) {
    const png = PNG.sync.read(bytes);
    raster = { width: png.width, height: png.height, data: png.data };
    // 에디터 loadTilesetImage 와 같은 투명색 규칙 — 명시 투명색, 또는 알려진 색키 칩셋.
    const known = tileset.image.type === "bundled" && isColorKeyedChipsetTextureKey(tileset.image.id);
    if (tileset.transparentColor || known) {
      const pixels = new Uint8ClampedArray(raster.data.buffer, raster.data.byteOffset, raster.data.byteLength);
      const keys = resolveTransparentColorKeys(tileset);
      if (keys) applyTransparentColorKeys(pixels, keys); else applyTransparentColorKey(pixels);
    }
  }
  imageCache.set(key, raster);
  return raster;
}

const MARK = { start: [60, 230, 110], door: [70, 150, 255], battle: [235, 60, 60], ending: [255, 200, 40], other: [230, 70, 230] } as const;

function eventKind(event: GameMap["events"][number]): keyof typeof MARK {
  const kinds = new Set<string>();
  const walk = (list: unknown): void => {
    for (const command of Array.isArray(list) ? list : []) {
      if (!command || typeof command !== "object") continue;
      kinds.add(String((command as { kind?: unknown }).kind));
      for (const value of Object.values(command as Record<string, unknown>)) {
        if (Array.isArray(value)) walk(value);
        if (Array.isArray((value as { branch?: unknown })?.branch)) walk((value as { branch: unknown }).branch);
      }
      for (const option of Array.isArray((command as { options?: unknown }).options) ? (command as { options: { branch?: unknown }[] }).options : []) walk(option?.branch);
    }
  };
  for (const page of event.pages ?? []) walk(page.commands);
  walk(event.commands);
  if (kinds.has("triggerEnding") || kinds.has("ending")) return "ending";
  if (kinds.has("battleProcessing")) return "battle";
  if (kinds.has("transfer")) return "door";
  return "other";
}

function outline(target: Raster, x: number, y: number, size: number, rgb: readonly number[]): void {
  for (let i = 0; i < size; i += 1) {
    for (const [px, py] of [[x + i, y], [x + i, y + size - 1], [x, y + i], [x + size - 1, y + i], [x + i, y + 1], [x + i, y + size - 2], [x + 1, y + i], [x + size - 2, y + i]] as const) {
      if (px < 0 || py < 0 || px >= target.width || py >= target.height) continue;
      const di = (py * target.width + px) * 4;
      target.data[di] = rgb[0]!; target.data[di + 1] = rgb[1]!; target.data[di + 2] = rgb[2]!; target.data[di + 3] = 255;
    }
  }
}

export function renderMapPng(project: Project, map: GameMap, scale = 1, sunSource?: { map: GameMap; x: number; y: number }): { png: Buffer; note?: string } {
  const tileset = project.tilesets[map.tilesetId];
  const size = (tileset?.tileSize ?? 16) * scale;
  const image = tileset ? loadTilesetRaster(project, tileset) : null;
  const relief = reliefMapView(map, size, image && tileset ? createReliefGroundSurface(map, tileset, image) : undefined);
  const height = Math.ceil(relief?.height ?? map.height * size);
  const target: Raster = { width: map.width * size, height, data: new Uint8Array(map.width * size * height * 4) };
  // 바둑판 바탕 — 비어 있는 칸이 보이게.
  for (let y = 0; y < target.height; y += 1) for (let x = 0; x < target.width; x += 1) {
    const dark = ((Math.floor(x / (size / 2)) + Math.floor(y / (size / 2))) % 2) === 0;
    const i = (y * target.width + x) * 4;
    target.data[i] = dark ? 42 : 51; target.data[i + 1] = dark ? 42 : 51; target.data[i + 2] = dark ? 46 : 58; target.data[i + 3] = 255;
  }
  let note: string | undefined;
  if (!tileset || !image) note = `타일셋 이미지를 읽지 못했습니다(${map.tilesetId})`;
  else {
    const context = new PngContext(target) as unknown as CanvasRenderingContext2D;
    const sun = sunlightField(sunSource?.map ?? map, tileset,
      rasterSunlightArt(image, tileset.tileSize, tileset.tilesPerRow));
    const sunRow = (row: number) => {
      if (!sun) return;
      const x = sunSource?.x ?? 0, y = sunSource?.y ?? 0, s = sun.row(row + y, x, x + map.width);
      new PngContext(target).drawImage({ width: s.w, height: s.h, data: new Uint8Array(s.rgba) }, 0, 0, s.w, s.h,
        0, (s.y * s.scale - y) * size + (relief?.pad ?? 0), s.w * s.scale * size, s.h * s.scale * size);
    };
    if (relief) {
      const flat = () => ({ width: map.width * size, height: map.height * size, data: new Uint8Array(map.width * size * map.height * size * 4) });
      const lower = flat(), upper = flat(), ctx = new PngContext(target);
      drawMapTileLayer(new PngContext(lower) as never, image as never, map, tileset, "lower", scale);
      drawMapTileLayer(new PngContext(upper) as never, image as never, map, tileset, "upper", scale);
      const strip = (s: (typeof relief.rows)[number]["under"]) => {
        if (s) ctx.drawImage({ width: s.w, height: s.h, data: new Uint8Array(s.rgba) }, 0, 0, s.w, s.h, s.x * relief.scale, s.y * relief.scale, s.w * relief.scale, s.h * relief.scale);
      };
      for (const row of relief.rows) {
        strip(row.under);
        for (const cell of row.cells) if (cell.paintLower) ctx.drawImage(lower, cell.x * size, row.y * size, size, size, cell.x * size, cell.y, size, size);
        strip(row.over);
        for (const cell of row.cells) ctx.drawImage(upper, cell.x * size, row.y * size, size, size, cell.x * size, cell.y, size, size);
        sunRow(row.y);
      }
    } else {
      drawMapTileLayer(context, image as never, map, tileset, "lower", scale);
      drawMapTileLayer(context, image as never, map, tileset, "upper", scale);
      for (let row = 0; row < map.height; row++) sunRow(row);
    }
  }
  const surfaceY = (x: number, y: number) => relief?.rows[y]?.cells[x]?.y ?? y * size;
  for (const event of map.events ?? []) outline(target, event.x * size, surfaceY(event.x, event.y), size, MARK[eventKind(event)]);
  if (map.id === project.startMapId) {
    const sx = project.startPos.x * size;
    const sy = surfaceY(project.startPos.x, project.startPos.y);
    outline(target, sx - 3, sy - 3, size + 6, MARK.start);
    outline(target, sx, sy, size, MARK.start);
  }
  const png = new PNG({ width: target.width, height: target.height });
  png.data = Buffer.from(target.data);
  return { png: PNG.sync.write(png), ...(note ? { note } : {}) };
}

/**
 * show_map_region 의 도구 이미지 — 헤드리스 gen 은 캔버스가 없어 renderToolImage 를 넘기지 않았고,
 * 런타임은 「맵 이미지 전달 경로가 없습니다」로 호출을 실패시켰다(r0735: 4회, 모델은 결과를 못 봄).
 * 같은 타일 렌더러로 맵을 그린 뒤 도구가 돌려준 영역(data.x/y/w/h)만 잘라 base64 PNG 로 준다.
 * 긴 변이 maxSide 를 넘으면 정수 배로 줄인다(브라우저도 전맵 요청은 축소 렌더한다).
 */
export function renderToolRegionPngBase64(project: Project, data: unknown, maxSide = 1024): string {
  const candidates = (data as { charsetCandidates?: readonly CharsetPreviewCandidate[] } | undefined)?.charsetCandidates;
  if (candidates?.length) {
    const sheets = new Map<string, { width: number; height: number; data: Uint8ClampedArray }>();
    for (const id of new Set(candidates.map(row => row.textureKey))) {
      const url = resolveAssetResourceUrl(id, { project });
      const bytes = url?.startsWith('data:image/png;base64,') ? Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')
        : url && /^\/?assets\//u.test(url) ? fs.readFileSync(path.join('public', url.replace(/^\//u, ''))) : null;
      // 못 읽는 시트(헤드리스에 없는 공용 칩 등)는 빈 칸으로 그린다 — 한 장 때문에 미리보기 전체가 실패하면 모델이 그 검색 결과를 통째로 못 쓴다.
      if (!bytes) { sheets.set(id, { width: 288, height: 256, data: new Uint8ClampedArray(288 * 256 * 4) }); continue; }
      const png = PNG.sync.read(bytes);
      sheets.set(id, { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) });
    }
    const raster = drawCharsetPreview(candidates, id => sheets.get(id)!);
    const png = new PNG({ width: raster.width, height: raster.height }); png.data.set(raster.data);
    return PNG.sync.write(png).toString('base64');
  }
  const region = (data && typeof data === "object" ? data : {}) as { mapId?: unknown; x?: unknown; y?: unknown; w?: unknown; h?: unknown };
  const map = typeof region.mapId === "string" ? project.maps[region.mapId] : undefined;
  if (!map) throw new Error(`show_map_region 이미지: 맵을 찾을 수 없습니다(${String(region.mapId)})`);
  if (map.relief?.levels.some(n => n > 0)) {
    const int = (value: unknown, fallback: number) => typeof value === "number" && Number.isInteger(value) ? value : fallback;
    const x = Math.max(0, int(region.x, 0)), y = Math.max(0, int(region.y, 0));
    const w = Math.min(map.width - x, int(region.w, map.width)), h = Math.min(map.height - y, int(region.h, map.height));
    if (w <= 0 || h <= 0) throw new Error("map-rendering-unavailable: invalid region");
    const cut = (tiles: readonly number[]) => Array.from({ length: w * h }, (_, i) => tiles[(y + Math.floor(i / w)) * map.width + x + i % w] ?? -1);
    const cropped: GameMap = { ...map, width: w, height: h, lowerTiles: cut(map.lowerTiles), upperTiles: cut(map.upperTiles),
      events: map.events.filter(e => e.x >= x && e.x < x + w && e.y >= y && e.y < y + h).map(e => ({ ...e, x: e.x - x, y: e.y - y })) };
    cropExtraLayers(cropped, map.width, map.height, x, y, w, h);
    const { png, note } = renderMapPng({ ...project, startPos: { x: project.startPos.x - x, y: project.startPos.y - y } }, cropped, 1, { map, x, y });
    if (note) throw new Error(`map-rendering-unavailable: ${note}`);
    const full = PNG.sync.read(png), step = Math.max(1, Math.ceil(Math.max(full.width, full.height) / maxSide));
    const out = new PNG({ width: Math.max(1, Math.floor(full.width / step)), height: Math.max(1, Math.floor(full.height / step)) });
    for (let yy = 0; yy < out.height; yy++) for (let xx = 0; xx < out.width; xx++) for (let c = 0; c < 4; c++)
      out.data[(yy * out.width + xx) * 4 + c] = full.data[((yy * step) * full.width + xx * step) * 4 + c]!;
    return PNG.sync.write(out).toString("base64");
  }
  const { png, note } = renderMapPng(project, map);
  // 그림판을 못 읽은 바둑판 그림을 「맵 이미지」로 주면 모델이 빈 맵으로 오해한다 — 도구 실패로 돌려준다.
  if (note) throw new Error(`map-rendering-unavailable: ${note}`);
  const full = PNG.sync.read(png);
  const tile = Math.round(full.width / Math.max(1, map.width));
  const num = (value: unknown, fallback: number): number => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
  const rx = Math.max(0, num(region.x, 0)) * tile;
  const ry = Math.max(0, num(region.y, 0)) * tile;
  const rw = Math.min(full.width - rx, num(region.w, map.width) * tile);
  const rh = Math.min(full.height - ry, num(region.h, map.height) * tile);
  const step = Math.max(1, Math.ceil(Math.max(rw, rh) / maxSide));
  const out = new PNG({ width: Math.max(1, Math.floor(rw / step)), height: Math.max(1, Math.floor(rh / step)) });
  for (let y = 0; y < out.height; y += 1) for (let x = 0; x < out.width; x += 1) {
    const si = ((ry + y * step) * full.width + rx + x * step) * 4;
    const di = (y * out.width + x) * 4;
    for (let c = 0; c < 4; c += 1) out.data[di + c] = full.data[si + c]!;
  }
  return PNG.sync.write(out).toString("base64");
}

function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"]/gu, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]!));
}

export function buildReportHtml(input: {
  readonly project: Project;
  readonly report: GameCheckReport | null;
  readonly maps: readonly { map: GameMap; png: Buffer; note?: string }[];
  readonly meta?: Record<string, unknown> | null;
  readonly replay?: string | null;
  /** gen 녹화(tools.jsonl)에서 실패한 호출 — 모델이 무엇을 포기하고 우회했는지의 단서. */
  readonly toolFailures?: readonly { order: number; phase: string; name: string; summary: string }[];
}): string {
  const { project, report } = input;
  const summaryByMap = new Map((report?.maps ?? []).map((m) => [m.id, m]));
  const findingsByMap = new Map<string, number>();
  for (const f of report?.findings ?? []) if (f.where?.mapId) findingsByMap.set(f.where.mapId, (findingsByMap.get(f.where.mapId) ?? 0) + 1);
  const cards = input.maps.map(({ map, png, note }) => {
    const s = summaryByMap.get(map.id);
    const flags = [
      map.id === project.startMapId ? "<b class=start>시작</b>" : "",
      s && !s.reachable ? "<b class=bad>못 감</b>" : "",
      s && s.events === 0 && s.inbound === 0 && map.id !== project.startMapId ? "<b class=bad>빈 껍데기</b>" : "",
      s?.climate ? `<b>${esc(s.climate)}</b>` : "",
      findingsByMap.get(map.id) ? `<b class=warn>지적 ${findingsByMap.get(map.id)}</b>` : "",
    ].join(" ");
    return `<figure><img src="data:image/png;base64,${png.toString("base64")}" alt="${esc(map.name)}"><figcaption><strong>${esc(map.name)}</strong> <code>${esc(map.id)}</code><br>${map.width}×${map.height} · 이벤트 ${map.events.length} · 들어오는 문 ${s?.inbound ?? "?"} · ${esc(map.tilesetId)} ${flags}${note ? `<br><span class=bad>${esc(note)}</span>` : ""}</figcaption></figure>`;
  }).join("\n");
  const rows = (report?.findings ?? []).map((f) => `<tr class="${f.severity}"><td>${f.severity === "blocker" ? "막힘" : f.severity === "warning" ? "경고" : "참고"}</td><td><code>${esc(f.code)}</code></td><td>${esc(f.message)}</td><td>${esc(whereText(f.where))}</td></tr>`).join("\n");
  const auto = report?.autoPlay;
  const autoHtml = auto ? [
    auto.skipped ? `<p>건너뜀: ${esc(auto.skipped)}</p>` : "",
    auto.plan.length ? `<p><b>경로</b>: ${auto.plan.map(esc).join(" → ")}</p>` : "",
    ...auto.runs.map((run) => `<h3>${esc(run.label)} — ${run.ok ? `<span class=ok>성공${run.endingReached ? ` (엔딩 ${esc(run.endingReached)})` : ""}</span>` : "<span class=bad>실패</span>"} <small>러너 ${run.runs}회 · ${run.ms}ms · 끝 파티 ${esc(JSON.stringify(run.partyAtEnd ?? []))}</small></h3><ol>${run.steps.map((step) => `<li class="${step.ok ? "ok" : "bad"}">${esc(step.goal)} — ${esc(step.detail)} <small>${esc(step.mapId ?? "")} (${step.x ?? "?"},${step.y ?? "?"})${step.where ? ` · ${esc(whereText(step.where))}` : ""}</small></li>`).join("")}</ol>`),
  ].join("\n") : "<p>검사 결과(check.json)가 없습니다 — check 를 먼저 돌리세요.</p>";
  const meta = input.meta;
  const metaHtml = meta ? `<details open><summary>생성 기록(meta.json)</summary><pre>${esc(JSON.stringify({ config: meta.config, ms: meta.ms, timings: meta.timings, toolCalls: meta.toolCalls, toolErrors: meta.toolErrors, tokens: meta.tokens, differences: meta.differences }, null, 2))}</pre></details>` : "";
  const counts = report?.counts;
  return `<!doctype html><html lang=ko><head><meta charset=utf-8><title>QA — ${esc(project.meta.title)}</title>
<style>
body{font:14px/1.5 system-ui,"Apple SD Gothic Neo","Noto Sans KR",sans-serif;margin:24px;background:#111318;color:#e6e6ea;word-break:keep-all}
h1{margin:0 0 4px}h2{margin-top:32px;border-bottom:1px solid #333;padding-bottom:4px}code{color:#9fc4ff}
.counts b{display:inline-block;padding:2px 10px;border-radius:10px;margin-right:6px}.counts .blocker{background:#5b1d1d}.counts .warning{background:#5b4a1d}
.grid{display:flex;flex-wrap:wrap;gap:16px}figure{margin:0;background:#1b1e26;border:1px solid #2c3140;border-radius:8px;padding:8px;max-width:560px}
figure img{max-width:100%;max-height:420px;image-rendering:pixelated;display:block;margin:auto}figcaption{margin-top:6px;font-size:13px}
figcaption b{font-weight:600;font-size:12px;padding:1px 6px;border-radius:6px;background:#2c3140}b.bad{background:#7a2323}b.warn{background:#6b5a1f}b.start{background:#1f5a3a}
table{border-collapse:collapse;width:100%}td{border-bottom:1px solid #2a2d38;padding:4px 6px;vertical-align:top}tr.blocker td:first-child{color:#ff7b7b;font-weight:700}tr.warning td:first-child{color:#f3c75b}
.ok{color:#7ddc9a}.bad{color:#ff8a8a}li{margin:2px 0}small{color:#9aa0ae}pre{white-space:pre-wrap;background:#1b1e26;padding:8px;border-radius:6px}
.legend span{display:inline-block;width:12px;height:12px;border:2px solid;margin:0 4px -2px 10px}
</style></head><body>
<h1>${esc(project.meta.title)} <small>QA 시트</small></h1>
<p class=counts>${counts ? `<b class=blocker>막힘 ${counts.blocker}</b><b class=warning>경고 ${counts.warning}</b>` : ""} 맵 ${input.maps.length}개 · 시작 <code>${esc(project.startMapId)}</code> (${project.startPos.x},${project.startPos.y}) · 파티 ${esc(JSON.stringify(project.session?.partyActorIds ?? []))}</p>
<p class=legend>표식: <span style="border-color:rgb(60,230,110)"></span>시작 위치 <span style="border-color:rgb(70,150,255)"></span>문 <span style="border-color:rgb(235,60,60)"></span>전투 <span style="border-color:rgb(255,200,40)"></span>엔딩 <span style="border-color:rgb(230,70,230)"></span>기타 이벤트</p>
<h2>자동 플레이</h2>${autoHtml}
<h2>검사 지적 ${report?.findings.length ?? 0}건</h2><table>${rows || "<tr><td>지적 없음</td></tr>"}</table>
${input.toolFailures?.length ? `<h2>생성 중 실패한 툴 호출 ${input.toolFailures.length}건</h2><table>${input.toolFailures.map((f) => `<tr><td>#${f.order}</td><td><code>${esc(f.name)}</code></td><td>${esc(f.summary.replace(/\s+/gu, " ").slice(0, 400))}</td></tr>`).join("")}</table>` : ""}
${input.replay ? `<h2>재생</h2><pre>${esc(input.replay)}</pre>` : ""}
<h2>맵</h2><div class=grid>${cards}</div>
${metaHtml}
</body></html>`;
}

export async function renderMain(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  ARGV = argv;
  const dir = argv.find((value, index) => !value.startsWith("--") && !(index > 0 && argv[index - 1]!.startsWith("--")));
  const projectFile = arg("project") ?? (dir ? path.join(dir, "project.json") : undefined);
  if (!projectFile || !fs.existsSync(projectFile)) { console.error("사용법: bun scripts/qa-game/render.mts qa-runs/<id>  또는  --project x.json --out <dir>"); return 2; }
  const out = arg("out") ?? dir ?? path.dirname(projectFile);
  const scale = Number(arg("scale") ?? 1);
  const started = Date.now();
  const { project } = loadProjectFile(projectFile);
  store.replaceProject(project);
  const current = store.getCurrent();
  fs.mkdirSync(path.join(out, "render"), { recursive: true });
  const order = Object.values(current.maps).sort((a, b) => Number(b.id === current.startMapId) - Number(a.id === current.startMapId));
  const maps = order.map((map) => {
    const { png, note } = renderMapPng(current, map, scale);
    fs.writeFileSync(path.join(out, "render", `${map.id}.png`), png);
    return { map, png, ...(note ? { note } : {}) };
  });
  const read = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null);
  const checkText = read(path.join(out, "check.json"));
  const metaText = read(path.join(out, "meta.json"));
  const html = buildReportHtml({
    project: current,
    report: checkText ? JSON.parse(checkText) as GameCheckReport : null,
    maps,
    meta: metaText ? JSON.parse(metaText) as Record<string, unknown> : null,
    replay: read(path.join(out, "replay", "replay.txt")),
    toolFailures: fs.existsSync(path.join(out, "tools.jsonl"))
      ? readRecordedCalls(path.join(out, "tools.jsonl")).filter((call) => !call.ok).map((call) => ({ order: call.order, phase: call.phase, name: call.name, summary: call.summary }))
      : [],
  });
  fs.writeFileSync(path.join(out, "report.html"), html);
  console.log(`[qa-game] 맵 ${maps.length}장 → ${path.join(out, "render")} · report.html ${(html.length / 1024).toFixed(0)}KB · ${Date.now() - started}ms`);
  return 0;
}

if (import.meta.main) process.exit(await renderMain());
