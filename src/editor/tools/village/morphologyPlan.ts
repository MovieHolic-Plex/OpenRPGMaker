// editor/tools/village/morphologyPlan.ts
// 취락 형태 유형(morphology) 기반 마을 설계 — 순수 기하. 맵을 만지지 않는다.
//
// 왜 있는가(2026-09-17): 기존 시공기는 「집 산포 → 집 앞을 잇는 최소 신장 골목」이라 집이 잔디에
// 떠 있고 필지가 없었다. 정주지 생성 문헌(Emilien 2012 성장·관심도, watabou 「길 먼저」, Vanegas 2012
// 필지 분할, 독일 취락 형태 유형)은 전부 반대다: 뼈대(큰길·공동 녹지)를 먼저 깔고, 길에 면한
// 필지를 나누고, 집은 필지 앞면에 문을 길 쪽으로 앉힌다. 밭·과수원은 필지 뒤, 나무는 마을에서
// 멀어질수록 짙어진다. 이 모듈은 그 순서를 네 유형으로 계획한다.
//
// 타일 제약: 이 칩셋의 집은 문이 항상 남쪽 벽 하단이다. 그래서 「길을 본다」= 길이 집 남쪽에 있다.
// 가로 길엔 북쪽 줄이 길을 보고, 남쪽 줄은 뒷골목(Hintergasse)을 본다. 세로 길엔 양쪽 집이
// 남쪽 문에서 짧은 옆길로 길에 붙는다.

import { mulberry32, type Rng } from "@/util/rng";
import type { HouseTemplate, Plaza, Point, Rect } from "./constants";

import type { VillageMorphology } from "./morphologyTypes";
export { VILLAGE_MORPHOLOGIES, MORPHOLOGY_LABEL, type VillageMorphology } from "./morphologyTypes";

export type RoadRole = "main" | "lane" | "ring" | "spur";

export interface RoadStroke {
  /** 이미 폭을 반영한 칸 집합(중복 없음). */
  readonly cells: readonly Point[];
  readonly width: 1 | 2 | 3;
  readonly role: RoadRole;
}

export interface HouseSlot {
  readonly bbox: Rect;
  readonly template: HouseTemplate;
  /** 문 앞 칸에서 길로 가는 방향 — 남쪽 문이라 down 이 기본, 세로 길 옆 집은 east/west. */
  readonly frontDir: "down" | "east" | "west";
  /** 필지(울타리 둘레). bbox 를 포함하고, 앞면(남쪽) 행은 문 앞 칸 행이다. */
  readonly parcel: Rect;
  /** 계획 단계에서 확보한 옆길(문 앞 칸부터 길 직전 칸까지). 없으면 시공기가 스스로 찾는다. */
  readonly spur?: readonly Point[];
}

export type FieldKind = "farm" | "orchard" | "meadow";

export interface FieldPatch {
  readonly rect: Rect;
  readonly kind: FieldKind;
}

export interface MorphologyExit {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

export interface MorphologyPlan {
  readonly morphology: VillageMorphology;
  readonly roads: readonly RoadStroke[];
  readonly houses: readonly HouseSlot[];
  readonly fields: readonly FieldPatch[];
  /** 공동 녹지·광장. 잔디로 남긴다(데크 없음). */
  readonly commons: Rect;
  readonly plaza: Plaza;
  /** 녹지 안 연못(타원 fill). */
  readonly pond?: Rect;
  /** 녹지·뒷마당 큰나무(2×2) 앵커. */
  readonly bigTrees: readonly Point[];
  readonly exits: readonly MorphologyExit[];
  /** 마을 세포 점유표(0=빈 잔디). 나무 기울기·검사용. */
  readonly occupancy: Uint8Array;
  readonly mapWidth: number;
  readonly notes: readonly string[];
}

export interface MorphologyPlanArgs {
  readonly morphology: VillageMorphology;
  readonly area: Rect;
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly seed: number;
  /** 집 수 상한. 형태가 허용하는 필지 수와 상한 중 작은 값이 실제 집 수다. */
  readonly maxHouses: number;
  readonly templates: readonly HouseTemplate[];
  /** 물·기존 집 등 절대 못 쓰는 칸(index = y*mapWidth+x). 길도 못 지난다. */
  readonly blocked: ReadonlySet<number>;
  /** 숲 밴드 — 집·필지·밭은 못 들어가지만 큰길·옆길은 지나간다(출구가 숲 띠 너머에 있다). */
  readonly softBlocked?: ReadonlySet<number>;
  /** 절벽 띠(고저차) — 집·필지·밭·옆길·골목 성장은 못 들어가고 큰길·링 길만 가로지른다(비탈이 된다). */
  readonly cliffBlocked?: ReadonlySet<number>;
  readonly roadWidth: number;
}

/** 점유표 값. */
export const OCC = {
  free: 0,
  road: 1,
  house: 2,
  commons: 3,
  field: 4,
  reserved: 5,
  spur: 6,
  pond: 7,
  /** 숲 예정지 — 길만 지난다. */
  forest: 8,
  /** 절벽 띠 — 큰길만 지난다(옆길·골목 성장은 막힌다). */
  cliff: 9,
} as const;

const MAX_TEMPLATE_W = 8;
const MAX_TEMPLATE_H = 9;

class PlanGrid {
  readonly occ: Uint8Array;
  constructor(readonly width: number, readonly height: number, readonly area: Rect, blocked: ReadonlySet<number>, softBlocked?: ReadonlySet<number>, cliffBlocked?: ReadonlySet<number>) {
    this.occ = new Uint8Array(width * height);
    if (softBlocked) for (const index of softBlocked) this.occ[index] = OCC.forest;
    if (cliffBlocked) for (const index of cliffBlocked) this.occ[index] = OCC.cliff;
    for (const index of blocked) this.occ[index] = OCC.reserved;
    // 영역 밖은 예약(못 쓴다).
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (x < area.x || y < area.y || x >= area.x + area.w || y >= area.y + area.h) this.occ[y * width + x] = OCC.reserved;
      }
    }
  }
  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }
  get(x: number, y: number): number {
    return this.inside(x, y) ? this.occ[y * this.width + x]! : OCC.reserved;
  }
  set(x: number, y: number, value: number): void {
    if (this.inside(x, y)) this.occ[y * this.width + x] = value;
  }
  setRect(rect: Rect, value: number): void {
    for (let y = rect.y; y < rect.y + rect.h; y += 1) for (let x = rect.x; x < rect.x + rect.w; x += 1) this.set(x, y, value);
  }
  rectFree(rect: Rect, allow: readonly number[] = []): boolean {
    for (let y = rect.y; y < rect.y + rect.h; y += 1) {
      for (let x = rect.x; x < rect.x + rect.w; x += 1) {
        const value = this.get(x, y);
        if (value !== OCC.free && !allow.includes(value)) return false;
      }
    }
    return true;
  }
  isRoad(x: number, y: number): boolean {
    const value = this.get(x, y);
    return value === OCC.road || value === OCC.spur;
  }
}

interface PlanCtx {
  readonly args: MorphologyPlanArgs;
  readonly area: Rect;
  readonly rng: Rng;
  readonly grid: PlanGrid;
  readonly roads: RoadStroke[];
  readonly houses: HouseSlot[];
  readonly fields: FieldPatch[];
  readonly bigTrees: Point[];
  readonly exits: MorphologyExit[];
  readonly notes: string[];
  readonly templates: readonly HouseTemplate[];
  lastTemplateId: string;
  storeyDebt: number;
}

export function planVillageMorphology(args: MorphologyPlanArgs): MorphologyPlan {
  const rng = mulberry32((args.seed ^ 0x6d0f2a31) >>> 0);
  const grid = new PlanGrid(args.mapWidth, args.mapHeight, args.area, args.blocked, args.softBlocked, args.cliffBlocked);
  const templates = args.templates.filter((template) =>
    template.w <= MAX_TEMPLATE_W && template.h <= MAX_TEMPLATE_H && !template.id.startsWith("estate"));
  if (templates.length === 0) throw new Error("형태 마을: 폭 8·높이 9 이하 집 형태가 하나도 없다.");
  const ctx: PlanCtx = {
    args, area: args.area, rng, grid, roads: [], houses: [], fields: [], bigTrees: [], exits: [], notes: [], templates,
    lastTemplateId: "", storeyDebt: 0,
  };
  let commons: Rect;
  let plaza: Plaza;
  let pond: Rect | undefined;
  switch (args.morphology) {
    case "street": ({ commons, plaza } = planStreetVillage(ctx)); break;
    case "green": ({ commons, plaza, pond } = planGreenVillage(ctx)); break;
    case "round": ({ commons, plaza, pond } = planRoundVillage(ctx)); break;
    case "cluster": ({ commons, plaza } = planClusterVillage(ctx)); break;
  }
  planFields(ctx);
  const roadComponents = countStrokeComponents(ctx.roads);
  ctx.notes.push(`morphology=${args.morphology} 집 ${ctx.houses.length} 길 ${ctx.roads.length}획 밭 ${ctx.fields.length} 출구 ${ctx.exits.length}${roadComponents > 1 ? ` 길 성분(계획) ${roadComponents}` : ""}`);
  return {
    morphology: args.morphology,
    roads: ctx.roads,
    houses: ctx.houses,
    fields: ctx.fields,
    commons,
    plaza,
    ...(pond ? { pond } : {}),
    bigTrees: ctx.bigTrees,
    exits: ctx.exits,
    occupancy: grid.occ,
    mapWidth: args.mapWidth,
    notes: ctx.notes,
  };
}

/** 계획 길(옆길 제외)의 4-이웃 성분 수 — 1 이 정상. 막힌 칸(물·기존 집)이 큰길을 끊으면 2 이상. */
export function countStrokeComponents(roads: readonly RoadStroke[]): number {
  const cells = new Set<string>();
  for (const stroke of roads) for (const cell of stroke.cells) cells.add(`${cell.x},${cell.y}`);
  let components = 0;
  const seen = new Set<string>();
  for (const start of cells) {
    if (seen.has(start)) continue;
    components += 1;
    const stack = [start];
    seen.add(start);
    while (stack.length > 0) {
      const key = stack.pop()!;
      const [x, y] = key.split(",").map(Number) as [number, number];
      for (const next of [`${x + 1},${y}`, `${x - 1},${y}`, `${x},${y + 1}`, `${x},${y - 1}`]) {
        if (cells.has(next) && !seen.has(next)) { seen.add(next); stack.push(next); }
      }
    }
  }
  return components;
}

// ───────────────────────── 기하 원시 ─────────────────────────

/** Catmull-Rom 스플라인을 촘촘히 샘플해 4-연결 정수 폴리라인으로 만든다. */
export function smoothCurveCells(points: readonly Point[]): Point[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [{ x: Math.round(points[0]!.x), y: Math.round(points[0]!.y) }];
  const padded = [points[0]!, ...points, points[points.length - 1]!];
  const samples: Point[] = [];
  for (let i = 0; i + 3 < padded.length; i += 1) {
    const p0 = padded[i]!, p1 = padded[i + 1]!, p2 = padded[i + 2]!, p3 = padded[i + 3]!;
    const steps = Math.max(4, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) * 2));
    for (let s = 0; s < steps; s += 1) {
      const t = s / steps;
      const t2 = t * t, t3 = t2 * t;
      samples.push({
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  samples.push(points[points.length - 1]!);
  const cells: Point[] = [];
  let prev: Point | undefined;
  for (const sample of samples) {
    const cell = { x: Math.round(sample.x), y: Math.round(sample.y) };
    if (prev === undefined) cells.push(cell);
    else if (prev.x !== cell.x || prev.y !== cell.y) cells.push(...line4(prev, cell).slice(1));
    prev = cell;
  }
  return dedupe(cells);
}

/** 4-연결 브레젠험 — 대각 이동을 가로·세로 두 걸음으로 쪼갠다(길 성분 판정이 4-이웃이다). */
export function line4(a: Point, b: Point): Point[] {
  const cells: Point[] = [{ x: a.x, y: a.y }];
  let x = a.x, y = a.y;
  const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
  const sx = a.x < b.x ? 1 : -1, sy = a.y < b.y ? 1 : -1;
  let err = dx - dy;
  let guard = dx + dy + 2;
  while ((x !== b.x || y !== b.y) && guard-- > 0) {
    const e2 = 2 * err;
    if (e2 > -dy && x !== b.x) { err -= dy; x += sx; cells.push({ x, y }); }
    if (x === b.x && y === b.y) break;
    if (e2 < dx && y !== b.y) { err += dx; y += sy; cells.push({ x, y }); }
  }
  return cells;
}

export function dedupe(cells: readonly Point[]): Point[] {
  const seen = new Set<string>();
  const out: Point[] = [];
  for (const cell of cells) {
    const key = `${cell.x},${cell.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cell);
  }
  return out;
}

/** 연속한 칸 사이가 대각선(또는 건너뜀)이면 4-연결 계단으로 채운다 — 열별 오프셋으로 만든 골목용. */
export function connect4(cells: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (const cell of cells) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(cell.x - prev.x) + Math.abs(cell.y - prev.y) > 1) out.push(...line4(prev, cell).slice(1, -1));
    out.push({ x: cell.x, y: cell.y });
  }
  return dedupe(out);
}

/** 중심선을 폭만큼 두껍게. 2 는 오른쪽·아래로, 3 은 3×3 붓. */
export function thickenCells(cells: readonly Point[], width: number): Point[] {
  if (width <= 1) return dedupe(cells);
  const out: Point[] = [];
  for (const cell of cells) {
    if (width === 2) out.push(cell, { x: cell.x + 1, y: cell.y }, { x: cell.x, y: cell.y + 1 }, { x: cell.x + 1, y: cell.y + 1 });
    else for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) out.push({ x: cell.x + dx, y: cell.y + dy });
  }
  return dedupe(out);
}

interface ColumnExtent { top: number; bottom: number }
interface RowExtent { left: number; right: number }

function columnExtents(cells: readonly Point[]): Map<number, ColumnExtent> {
  const map = new Map<number, ColumnExtent>();
  for (const cell of cells) {
    const current = map.get(cell.x);
    if (!current) map.set(cell.x, { top: cell.y, bottom: cell.y });
    else { current.top = Math.min(current.top, cell.y); current.bottom = Math.max(current.bottom, cell.y); }
  }
  return map;
}

function rowExtents(cells: readonly Point[]): Map<number, RowExtent> {
  const map = new Map<number, RowExtent>();
  for (const cell of cells) {
    const current = map.get(cell.y);
    if (!current) map.set(cell.y, { left: cell.x, right: cell.x });
    else { current.left = Math.min(current.left, cell.x); current.right = Math.max(current.right, cell.x); }
  }
  return map;
}

function dedupeNumbers(values: readonly number[]): number[] {
  return [...new Set(values)];
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function jitter(rng: Rng, amplitude: number): number {
  return Math.round((rng() * 2 - 1) * amplitude);
}

function addRoad(ctx: PlanCtx, centerline: readonly Point[], width: 1 | 2 | 3, role: RoadRole): Point[] {
  const cells = thickenCells(centerline, width).filter((cell) => {
    const value = ctx.grid.get(cell.x, cell.y);
    return value === OCC.free || value === OCC.road || value === OCC.spur || value === OCC.forest || value === OCC.cliff;
  });
  for (const cell of cells) ctx.grid.set(cell.x, cell.y, OCC.road);
  if (cells.length > 0) ctx.roads.push({ cells, width, role });
  return cells;
}

// ───────────────────────── 집·필지 ─────────────────────────

function pickTemplate(ctx: PlanCtx, maxW: number, maxH: number): HouseTemplate | undefined {
  const fits = ctx.templates.filter((template) => template.w <= maxW && template.h <= maxH);
  if (fits.length === 0) return undefined;
  // 다층 빚: 다섯 채마다 한 채는 2층 이상을 우선한다(마을의 실루엣).
  const preferTall = ctx.storeyDebt >= 4 && fits.some((template) => (template.stories ?? 1) > 1);
  const pool = preferTall ? fits.filter((template) => (template.stories ?? 1) > 1) : fits;
  const distinct = pool.filter((template) => template.id !== ctx.lastTemplateId);
  const source = distinct.length > 0 ? distinct : pool;
  const chosen = source[Math.floor(ctx.rng() * source.length)]!;
  ctx.lastTemplateId = chosen.id;
  ctx.storeyDebt = (chosen.stories ?? 1) > 1 ? 0 : ctx.storeyDebt + 1;
  return chosen;
}

function tryPlaceSlot(ctx: PlanCtx, slot: HouseSlot): boolean {
  if (ctx.houses.length >= ctx.args.maxHouses) return false;
  const { parcel, bbox } = slot;
  if (parcel.x < ctx.area.x + 1 || parcel.y < ctx.area.y + 1) return false;
  if (parcel.x + parcel.w > ctx.area.x + ctx.area.w - 1 || parcel.y + parcel.h > ctx.area.y + ctx.area.h - 1) return false;
  if (!ctx.grid.rectFree(parcel)) return false;
  // 용마루 행(bbox.y-1)은 필지 안이어야 한다.
  if (bbox.y - 1 < parcel.y) return false;
  ctx.grid.setRect(parcel, OCC.house);
  ctx.houses.push(slot);
  return true;
}

/**
 * 길(또는 골목) 위에 앉는 집 한 줄 — 집은 앞면(frontage) 곡선 위에 문을 아래로 두고 선다.
 * frontTopAt(x) = 그 열에서 앞면 길의 가장 위 행. ceilingAt(x) = 그 열에서 집 위로 넘지 못하는 행(있으면).
 * 반환: 골목을 낼 수 있는 빈 열들.
 */
function planRowAbove(
  ctx: PlanCtx,
  frontTopAt: (x: number) => number | undefined,
  xFrom: number,
  xTo: number,
  options: { readonly ceilingAt?: (x: number) => number | undefined; readonly back?: readonly [number, number]; readonly alleyEvery?: number; readonly skip?: Rect; readonly maxW?: number },
): number[] {
  const alleys: number[] = [];
  const [backMin, backMax] = options.back ?? [2, 4];
  const alleyEvery = options.alleyEvery ?? 3;
  // 열 구간 [from, from+count) 의 앞면 행(가장 위 길 행 - 1)과 천장(넘지 못하는 길 바닥 행).
  const span = (from: number, count: number): { frontY: number; ceiling: number } | undefined => {
    let frontY = Number.POSITIVE_INFINITY;
    let ceiling = Number.NEGATIVE_INFINITY;
    for (let cx = from; cx < from + count; cx += 1) {
      const top = frontTopAt(cx);
      if (top === undefined) return undefined;
      frontY = Math.min(frontY, top - 1);
      const cap = options.ceilingAt?.(cx);
      if (cap !== undefined) ceiling = Math.max(ceiling, cap);
    }
    return { frontY, ceiling };
  };
  let x = xFrom;
  let placedInRow = 0;
  let stall = 0;
  while (x <= xTo - 5 && ctx.houses.length < ctx.args.maxHouses) {
    if (options.skip && x >= options.skip.x - 1 && x < options.skip.x + options.skip.w + 1) { x = options.skip.x + options.skip.w + 1; continue; }
    // 가장 좁은 필지(폭 6)로 가용 높이를 먼저 재고, 그 높이에 들어가는 형태만 고른다(뒷골목 줄은 큰길과 골목 사이가 좁다).
    const probe = span(x, 6);
    if (!probe) { x += 1; continue; }
    const roomAbove = probe.ceiling === Number.NEGATIVE_INFINITY ? MAX_TEMPLATE_H : probe.frontY - probe.ceiling - 3;
    const roomArea = probe.frontY - ctx.area.y - 2 - backMin;
    const maxH = Math.min(MAX_TEMPLATE_H, roomAbove, roomArea);
    if (maxH < 3) { x += 1; if (++stall > 24) break; continue; }
    const template = pickTemplate(ctx, Math.min(options.maxW ?? MAX_TEMPLATE_W, xTo - x - 1), maxH);
    if (!template) { x += 1; if (++stall > 24) break; continue; }
    const pw = template.w + 2;
    const exact = span(x, pw);
    if (!exact) { x += 1; continue; }
    const bbox: Rect = { x: x + 1, y: exact.frontY - template.h, w: template.w, h: template.h };
    if (exact.ceiling !== Number.NEGATIVE_INFINITY && bbox.y - 1 < exact.ceiling + 2) { x += 1; if (++stall > 24) break; continue; }
    const back = backMin + Math.floor(ctx.rng() * (backMax - backMin + 1));
    const parcelTop = Math.max(ctx.area.y + 1, bbox.y - 1 - back);
    if (exact.ceiling !== Number.NEGATIVE_INFINITY && parcelTop < exact.ceiling + 1) { x += 1; continue; }
    const parcel: Rect = { x, y: parcelTop, w: pw, h: exact.frontY - parcelTop + 1 };
    const slot: HouseSlot = { bbox, template, frontDir: "down", parcel };
    if (tryPlaceSlot(ctx, slot)) {
      placedInRow += 1;
      stall = 0;
      const wantsAlley = placedInRow % alleyEvery === 0;
      const gap = wantsAlley ? 2 : ctx.rng() < 0.4 ? 1 : 0;
      if (wantsAlley) alleys.push(x + pw);
      x += pw + gap;
    } else {
      x += 1;
      if (++stall > 24) break;
    }
  }
  return alleys;
}

/**
 * 세로 길 옆에 쌓는 집 기둥 — 문은 남쪽, 문 앞 칸에서 옆길이 길까지 이어진다.
 * side=west: 집이 길의 서쪽(문 앞에서 동쪽으로 옆길). frontEdgeAt(y) = 그 행에서 길의 왼쪽(또는 오른쪽) 끝 열.
 */
function planColumnBeside(
  ctx: PlanCtx,
  frontEdgeAt: (y: number) => number | undefined,
  yFrom: number,
  yTo: number,
  side: "west" | "east",
  options: { readonly back?: readonly [number, number]; readonly verge?: number } = {},
): void {
  const [backMin, backMax] = options.back ?? [2, 3];
  const verge = options.verge ?? 1;
  let y = yFrom;
  let stall = 0;
  while (y <= yTo - 5 && ctx.houses.length < ctx.args.maxHouses) {
    const template = pickTemplate(ctx, MAX_TEMPLATE_W, Math.min(MAX_TEMPLATE_H, yTo - y - 1));
    if (!template) break;
    const ridgeY = y;
    const bboxY = ridgeY + 1;
    const frontRow = bboxY + template.h;
    let edge: number | undefined = side === "west" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    for (let cy = ridgeY; cy <= frontRow; cy += 1) {
      const e = frontEdgeAt(cy);
      if (e === undefined) { edge = undefined; break; }
      edge = side === "west" ? Math.min(edge, e) : Math.max(edge, e);
    }
    if (edge === undefined || !Number.isFinite(edge)) { y += 1; if (++stall > 30) break; continue; }
    const bboxX = side === "west" ? edge - 1 - verge - template.w : edge + 1 + verge + 1;
    const bbox: Rect = { x: bboxX, y: bboxY, w: template.w, h: template.h };
    const back = backMin + Math.floor(ctx.rng() * (backMax - backMin + 1));
    const parcel: Rect = side === "west"
      ? { x: bbox.x - back, y: ridgeY, w: back + template.w + 1 + verge, h: template.h + 2 }
      : { x: edge + 1, y: ridgeY, w: verge + 1 + template.w + back, h: template.h + 2 };
    const slot: HouseSlot = { bbox, template, frontDir: side === "west" ? "east" : "west", parcel };
    if (tryPlaceSlot(ctx, slot)) {
      stall = 0;
      y += parcel.h + (ctx.rng() < 0.5 ? 1 : 2);
    } else {
      y += 1;
      if (++stall > 30) break;
    }
  }
}

/** 세로 연결 골목 — 열 x 에서 위 길 바닥(+1)부터 아래 길 꼭대기(-1)까지. 빈 칸·길 칸만 지난다. */
function connectVertical(ctx: PlanCtx, x: number, upperBottom: number | undefined, lowerTop: number | undefined): boolean {
  if (upperBottom === undefined || lowerTop === undefined) return false;
  const from = upperBottom + 1;
  const to = lowerTop - 1;
  if (to < from) return true;
  const cells = line4({ x, y: from }, { x, y: to });
  const passable = cells.every((cell) => {
    const value = ctx.grid.get(cell.x, cell.y);
    return value === OCC.free || value === OCC.road || value === OCC.spur;
  });
  if (!passable) return false;
  addRoad(ctx, cells, 1, "lane");
  return true;
}

// ───────────────────────── 유형 ① 가로촌 ─────────────────────────

function planStreetVillage(ctx: PlanCtx): { commons: Rect; plaza: Plaza } {
  const { area, rng } = ctx;
  const width = clampInt(ctx.args.roadWidth, 2, 3) as 2 | 3;
  const horizontal = area.w >= area.h ? true : area.h - area.w < 10 ? rng() < 0.5 : false;
  if (!horizontal) return planStreetVillageVertical(ctx, width);
  const midY = area.y + Math.floor(area.h * (0.46 + rng() * 0.12));
  const amplitude = Math.max(2, Math.floor(area.h * 0.07));
  const waypoints: Point[] = [
    { x: area.x, y: midY + jitter(rng, amplitude) },
    { x: area.x + Math.floor(area.w * 0.3), y: midY + jitter(rng, amplitude) },
    { x: area.x + Math.floor(area.w * 0.62), y: midY + jitter(rng, amplitude) },
    { x: area.x + area.w - 1, y: midY + jitter(rng, amplitude) },
  ];
  const mainCenter = smoothCurveCells(waypoints);
  const mainCells = addRoad(ctx, mainCenter, width, "main");
  const mainExt = columnExtents(mainCells);
  ctx.exits.push({ id: "west-exit", x: mainCenter[0]!.x, y: mainCenter[0]!.y }, { id: "east-exit", x: mainCenter[mainCenter.length - 1]!.x, y: mainCenter[mainCenter.length - 1]!.y });

  // 마을 녹지 — 길 북쪽, 가운데. 집 줄은 이 자리를 비운다.
  const cx = area.x + Math.floor(area.w * (0.42 + rng() * 0.16));
  const gw = 8, gh = 5;
  let top = Number.POSITIVE_INFINITY;
  for (let x = cx - 4; x < cx + 4; x += 1) top = Math.min(top, mainExt.get(x)?.top ?? Number.POSITIVE_INFINITY);
  const commons: Rect = { x: cx - 4, y: Math.max(area.y + 1, top - gh), w: gw, h: Math.min(gh, top - Math.max(area.y + 1, top - gh)) };
  ctx.grid.setRect(commons, OCC.commons);
  ctx.bigTrees.push({ x: commons.x + 1, y: commons.y + 1 });

  // 북쪽 줄 — 큰길을 본다.
  const northAlleys = planRowAbove(ctx, (x) => mainExt.get(x)?.top, area.x + 2, area.x + area.w - 3, { skip: commons, back: [2, 4] });
  void northAlleys;

  // 남쪽 줄 — 영역이 충분히 높으면 뒷골목을 내고 그 골목을 보는 집을 세운다(Straßendorf 양측형).
  if (area.h >= 44) {
    const laneOffset = 12;
    // 열마다 큰길 바닥 + 오프셋 — 계단은 connect4 로 4-연결(길 성분 판정이 4-이웃이다).
    const laneCenter: Point[] = [];
    for (let x = area.x + 1; x <= area.x + area.w - 2; x += 1) {
      const bottom = mainExt.get(x)?.bottom;
      if (bottom === undefined) continue;
      laneCenter.push({ x, y: Math.min(area.y + area.h - 3, bottom + laneOffset) });
    }
    const laneCells = addRoad(ctx, connect4(laneCenter), 1, "lane");
    const laneExt = columnExtents(laneCells);
    const alleys = planRowAbove(ctx, (x) => laneExt.get(x)?.top, area.x + 3, area.x + area.w - 4, {
      ceilingAt: (x) => mainExt.get(x)?.bottom, back: [0, 0], alleyEvery: 3,
    });
    // 골목 ↔ 큰길 연결: 양 끝 + 집 사이 빈 열(골목이 없으면 가운데 하나).
    const connectors = dedupeNumbers([area.x + 2, ...(alleys.length > 0 ? alleys : [area.x + Math.floor(area.w / 2)]), area.x + area.w - 3]);
    for (const x of connectors) connectVertical(ctx, x, mainExt.get(x)?.bottom, laneExt.get(x)?.top);
  }
  // 결정적 배치가 모자랄 때만 길에 붙여 채운다 — 이미 채운 경우는 한 칸도 안 바뀐다.
  const grown = ctx.houses.length < ctx.args.maxHouses
    ? growHousesOnRoads(ctx, { x: commons.x + Math.floor(commons.w / 2), y: commons.y + Math.floor(commons.h / 2) })
    : 0;
  const plaza: Plaza = { rect: commons, centerX: commons.x + Math.floor(commons.w / 2), centerRow: commons.y + Math.floor(commons.h / 2) };
  ctx.notes.push(`가로촌 가로축 midY=${midY}${grown ? ` 보충 시도 ${grown}` : ""}`);
  return { commons, plaza };
}

function planStreetVillageVertical(ctx: PlanCtx, width: 2 | 3): { commons: Rect; plaza: Plaza } {
  const { area, rng } = ctx;
  const midX = area.x + Math.floor(area.w * (0.46 + rng() * 0.12));
  const amplitude = Math.max(2, Math.floor(area.w * 0.07));
  const waypoints: Point[] = [
    { x: midX + jitter(rng, amplitude), y: area.y },
    { x: midX + jitter(rng, amplitude), y: area.y + Math.floor(area.h * 0.3) },
    { x: midX + jitter(rng, amplitude), y: area.y + Math.floor(area.h * 0.62) },
    { x: midX + jitter(rng, amplitude), y: area.y + area.h - 1 },
  ];
  const mainCenter = smoothCurveCells(waypoints);
  const mainCells = addRoad(ctx, mainCenter, width, "main");
  const ext = rowExtents(mainCells);
  ctx.exits.push({ id: "north-exit", x: mainCenter[0]!.x, y: mainCenter[0]!.y }, { id: "south-exit", x: mainCenter[mainCenter.length - 1]!.x, y: mainCenter[mainCenter.length - 1]!.y });
  // 녹지 — 길 동쪽 가운데, 6×6.
  const cy = area.y + Math.floor(area.h * (0.42 + rng() * 0.16));
  let right = Number.NEGATIVE_INFINITY;
  for (let y = cy - 3; y < cy + 3; y += 1) right = Math.max(right, ext.get(y)?.right ?? Number.NEGATIVE_INFINITY);
  const commons: Rect = { x: Math.min(area.x + area.w - 8, right + 1), y: cy - 3, w: 7, h: 6 };
  ctx.grid.setRect(commons, OCC.commons);
  ctx.bigTrees.push({ x: commons.x + commons.w - 3, y: commons.y + 1 });
  planColumnBeside(ctx, (y) => ext.get(y)?.left, area.y + 2, area.y + area.h - 3, "west");
  planColumnBeside(ctx, (y) => ext.get(y)?.right, area.y + 2, area.y + area.h - 3, "east");
  const plaza: Plaza = { rect: commons, centerX: commons.x + Math.floor(commons.w / 2), centerRow: commons.y + Math.floor(commons.h / 2) };
  ctx.notes.push(`가로촌 세로축 midX=${midX}`);
  return { commons, plaza };
}

// ───────────────────────── 유형 ② 광장촌 ─────────────────────────

function planGreenVillage(ctx: PlanCtx): { commons: Rect; plaza: Plaza; pond?: Rect } {
  const { area, rng } = ctx;
  const width = clampInt(ctx.args.roadWidth, 2, 3) as 2 | 3;
  const cx = area.x + Math.floor(area.w / 2) + jitter(rng, 2);
  const cy = area.y + Math.floor(area.h * 0.5) + jitter(rng, 2);
  // 하한 11×5(=렌즈 23×11)는 32×24 맵을 가로로 다 먹었다 — 맵에 맞춰 함께 줄인다.
  const halfLength = clampInt(area.w * 0.36, Math.min(11, Math.floor(area.w / 4)), 26);
  const halfWidth = clampInt(area.h * 0.14, Math.min(5, Math.floor(area.h / 6)), 9);
  const westTip: Point = { x: cx - halfLength, y: cy };
  const eastTip: Point = { x: cx + halfLength, y: cy };
  const northArc = smoothCurveCells([
    westTip,
    { x: cx - Math.floor(halfLength * 0.5), y: cy - Math.floor(halfWidth * 0.85) },
    { x: cx, y: cy - halfWidth },
    { x: cx + Math.floor(halfLength * 0.5), y: cy - Math.floor(halfWidth * 0.85) },
    eastTip,
  ]);
  const southArc = smoothCurveCells([
    westTip,
    { x: cx - Math.floor(halfLength * 0.5), y: cy + Math.floor(halfWidth * 0.85) },
    { x: cx, y: cy + halfWidth },
    { x: cx + Math.floor(halfLength * 0.5), y: cy + Math.floor(halfWidth * 0.85) },
    eastTip,
  ]);
  // 녹지(렌즈 안)를 먼저 예약해 길·집이 들어오지 못하게 한다.
  const northExt = columnExtents(northArc);
  const southExt = columnExtents(southArc);
  const lensCells: Point[] = [];
  for (let x = westTip.x; x <= eastTip.x; x += 1) {
    const top = northExt.get(x)?.top;
    const bottom = southExt.get(x)?.bottom;
    if (top === undefined || bottom === undefined) continue;
    for (let y = top; y <= bottom; y += 1) lensCells.push({ x, y });
  }
  const northCells = addRoad(ctx, northArc, width, "ring");
  const southCells = addRoad(ctx, southArc, width, "ring");
  for (const cell of lensCells) if (ctx.grid.get(cell.x, cell.y) === OCC.free) ctx.grid.set(cell.x, cell.y, OCC.commons);
  const commons: Rect = { x: westTip.x, y: cy - halfWidth, w: halfLength * 2 + 1, h: halfWidth * 2 + 1 };
  // 큰길 — 양 끝에서 영역 밖으로.
  const westRoad = smoothCurveCells([{ x: area.x, y: cy + jitter(rng, 3) }, { x: Math.floor((area.x + westTip.x) / 2), y: cy + jitter(rng, 2) }, westTip]);
  const eastRoad = smoothCurveCells([eastTip, { x: Math.floor((eastTip.x + area.x + area.w - 1) / 2), y: cy + jitter(rng, 2) }, { x: area.x + area.w - 1, y: cy + jitter(rng, 3) }]);
  const westCells = addRoad(ctx, westRoad, width, "main");
  const eastCells = addRoad(ctx, eastRoad, width, "main");
  ctx.exits.push({ id: "west-exit", x: westRoad[0]!.x, y: westRoad[0]!.y }, { id: "east-exit", x: eastRoad[eastRoad.length - 1]!.x, y: eastRoad[eastRoad.length - 1]!.y });
  // 연못(렌즈 서쪽 안) + 우물 자리(동쪽) + 큰나무.
  const pondW = Math.min(8, halfLength - 4), pondH = Math.min(5, halfWidth * 2 - 5);
  const pond: Rect | undefined = pondW >= 4 && pondH >= 3
    ? { x: cx - Math.floor(halfLength * 0.45) - Math.floor(pondW / 2), y: cy - Math.floor(pondH / 2), w: pondW, h: pondH }
    : undefined;
  if (pond) ctx.grid.setRect(pond, OCC.pond);
  ctx.bigTrees.push({ x: cx + Math.floor(halfLength * 0.05), y: cy - Math.floor(halfWidth * 0.55) }, { x: cx + Math.floor(halfLength * 0.6), y: cy + 1 });
  // 북쪽 줄 — 북쪽 호(녹지를 향해)와 양쪽 큰길 북측을 한 앞면으로 본다.
  const northTop = columnExtents(northCells);
  const westTop = columnExtents(westCells);
  const eastTop = columnExtents(eastCells);
  const frontTop = (x: number): number | undefined => {
    const tops = [northTop.get(x)?.top, westTop.get(x)?.top, eastTop.get(x)?.top].filter((v): v is number => v !== undefined);
    return tops.length > 0 ? Math.min(...tops) : undefined;
  };
  planRowAbove(ctx, frontTop, area.x + 2, area.x + area.w - 3, { back: [2, 4], alleyEvery: 4 });
  // 남쪽 줄 — 남쪽 호 아래에 앉아 바깥 순환 농로(Hintergasse)를 본다. 골목은 호와 나란히(열별 오프셋),
  // 양 끝과 집 사이 빈 열에서 세로로 호에 붙는다.
  const southBottom = columnExtents(southCells);
  const laneOffset = 11;
  const laneCenter: Point[] = [];
  for (let x = westTip.x + 2; x <= eastTip.x - 2; x += 1) {
    const bottom = southBottom.get(x)?.bottom;
    if (bottom === undefined) continue;
    laneCenter.push({ x, y: Math.min(area.y + area.h - 3, bottom + laneOffset) });
  }
  const laneCells = addRoad(ctx, connect4(laneCenter), 1, "lane");
  const laneTop = columnExtents(laneCells);
  const alleys = planRowAbove(ctx, (x) => laneTop.get(x)?.top, westTip.x + 3, eastTip.x - 3, {
    ceilingAt: (x) => southBottom.get(x)?.bottom, back: [0, 0], alleyEvery: 3,
  });
  for (const x of dedupeNumbers([westTip.x + 2, ...alleys, eastTip.x - 2])) connectVertical(ctx, x, southBottom.get(x)?.bottom, laneTop.get(x)?.top);
  // 결정적 배치가 모자랄 때만 길에 붙여 채운다 — 이미 채운 경우는 한 칸도 안 바뀐다.
  const grown = ctx.houses.length < ctx.args.maxHouses ? growHousesOnRoads(ctx, { x: cx, y: cy }) : 0;
  if (grown) ctx.notes.push(`광장촌 보충 시도 ${grown}`);
  const plaza: Plaza = { rect: commons, centerX: cx + Math.floor(halfLength * 0.3), centerRow: cy };
  ctx.notes.push(`광장촌 렌즈 ${commons.w}×${commons.h}`);
  return { commons, plaza, ...(pond ? { pond } : {}) };
}

// ───────────────────────── 유형 ③ 환촌 ─────────────────────────

/**
 * 길에 앵커해 관심도 순으로 집을 채운다(Emilien 2012 식 성장). 괴촌의 뼈대이자, 다른 형태 유형이
 * 결정적 배치 한 번으로 목표 채수를 못 채웠을 때의 보충이다.
 *
 * 왜 보충이 필요한가(2026-09-18 실측): 환촌은 링 둘레와 진입로 옆에 한 번만 놓고 끝나서 큰 맵에서도
 * 목표에 1~2채 모자랐다 — 64×56 에 8채 요청하면 7~8채, 80×72 에 12채 요청하면 10~11채.
 * 시공기는 그 부족을 `village-count-shortfall` 로 거절하므로 요청 자체가 실패했다.
 *
 * 돌려주는 값은 시도 횟수(노트용). 채운 채수는 `ctx.houses.length` 로 본다.
 */
function growHousesOnRoads(ctx: PlanCtx, center: Point): number {
  const { area, rng, grid } = ctx;
  // 성장(Emilien 2012 식 관심도): 후보는 반드시 기존 길 칸에 앵커한다 — 길 위(문이 길을 봄) 75%,
  // 길 아래(용마루가 길에 붙고 문 앞에서 옆으로 돌아 길에 붙는 뒷골목형) 25%. 관심도 = 사교성(이웃 수) ×
  // 중심 편향 × 흔들림. 세 채마다 새 골목을 바깥으로 뻗어 다음 성장을 부르고, 세 번 연속 실패해도 뻗는다.
  const maxDist = Math.hypot(area.w, area.h) / 2;
  let attempts = 0;
  let failures = 0;
  const maxAttempts = ctx.args.maxHouses * 8;
  while (ctx.houses.length < ctx.args.maxHouses && attempts < maxAttempts) {
    attempts += 1;
    const anchors = ctx.roads.filter((stroke) => stroke.role !== "spur").flatMap((stroke) => stroke.cells)
      .filter((cell) => cell.x >= area.x + 3 && cell.x <= area.x + area.w - 4 && cell.y >= area.y + 3 && cell.y <= area.y + area.h - 4);
    if (anchors.length === 0) break;
    let best: { slot: HouseSlot; interest: number } | undefined;
    for (let k = 0; k < 80; k += 1) {
      const anchor = anchors[Math.floor(rng() * anchors.length)]!;
      const above = rng() < 0.75;
      const template = pickTemplate(ctx, MAX_TEMPLATE_W, MAX_TEMPLATE_H);
      if (!template) break;
      let bbox: Rect;
      let parcel: Rect;
      let front: Point;
      if (above) {
        const gap = rng() < 0.6 ? 1 : 2;
        front = { x: anchor.x + jitter(rng, 1), y: anchor.y - gap };
        bbox = { x: front.x - Math.floor(template.w / 2), y: front.y - template.h, w: template.w, h: template.h };
        const back = 1 + Math.floor(rng() * 2);
        const parcelTop = bbox.y - 1 - back;
        parcel = { x: bbox.x - 1, y: parcelTop, w: template.w + 2, h: front.y - parcelTop + 1 };
      } else {
        const ridgeY = anchor.y + 2;
        bbox = { x: anchor.x + jitter(rng, 2) - Math.floor(template.w / 2), y: ridgeY + 1, w: template.w, h: template.h };
        parcel = { x: bbox.x - 1, y: ridgeY, w: template.w + 2, h: template.h + 2 };
        front = { x: bbox.x + Math.floor(bbox.w / 2), y: bbox.y + bbox.h };
      }
      if (!grid.rectFree(parcel)) continue;
      // 옆 필지와 최소 1칸 띄운다(울타리가 붙지 않게).
      if (!grid.rectFree({ x: parcel.x - 1, y: parcel.y, w: 1, h: parcel.h }, [OCC.road, OCC.spur, OCC.commons, OCC.pond])) continue;
      if (!grid.rectFree({ x: parcel.x + parcel.w, y: parcel.y, w: 1, h: parcel.h }, [OCC.road, OCC.spur, OCC.commons, OCC.pond])) continue;
      let neighbours = 0;
      for (const house of ctx.houses) {
        const dist = Math.hypot(house.bbox.x + house.bbox.w / 2 - front.x, house.bbox.y + house.bbox.h / 2 - front.y);
        if (dist <= 14) neighbours += 1;
      }
      // 옆길을 지금 확보한다 — 길 아래 집은 문 앞에서 필지를 돌아 길에 붙는다(못 붙으면 후보 탈락).
      const spur = planSpur(ctx, front, parcel, above ? 4 : 14);
      if (!spur) continue;
      const sociability = ctx.houses.length === 0 ? 1 : Math.min(1, 0.35 + neighbours * 0.22);
      const centrality = 1 - 0.5 * Math.min(1, Math.hypot(front.x - center.x, front.y - center.y) / maxDist);
      const interest = sociability * centrality * (above ? 1 : 0.55) * (0.7 + rng() * 0.3);
      if (!best || interest > best.interest) best = { slot: { bbox, template, frontDir: "down", parcel, spur }, interest };
    }
    if (!best || !tryPlaceSlot(ctx, best.slot)) {
      failures += 1;
      if (failures % 3 === 0) growLane(ctx, center, 1);
      continue;
    }
    for (const cell of best.slot.spur ?? []) if (grid.get(cell.x, cell.y) === OCC.free) grid.set(cell.x, cell.y, OCC.spur);
    failures = 0;
    if (ctx.houses.length % 3 === 0) growLane(ctx, center, 1);
  }
  return attempts;
}

function planRoundVillage(ctx: PlanCtx): { commons: Rect; plaza: Plaza; pond?: Rect } {
  const { area, rng } = ctx;
  const width = clampInt(ctx.args.roadWidth, 2, 3) as 2 | 3;
  // 하한 7(=지름 15)은 26줄짜리 맵을 통째로 먹어 집 자리가 안 남았다(2026-09-18 실측: 3채 요청에 2채).
  // 좁은 변의 1/4 로 함께 줄인다 — 작은 환촌이 되지, 링만 있고 집이 없는 맵이 되지는 않는다.
  const shortSide = Math.min(area.w, area.h);
  const radius = clampInt(shortSide * 0.17, Math.min(7, Math.floor(shortSide / 4)), 12);
  const cx = area.x + Math.floor(area.w / 2) + jitter(rng, 2);
  const cy = area.y + Math.floor(area.h * 0.44) + jitter(rng, 2);
  const ringPoints: Point[] = [];
  const steps = 28;
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    ringPoints.push({ x: cx + Math.round(Math.sin(angle) * radius), y: cy - Math.round(Math.cos(angle) * radius) });
  }
  const ringCenter = dedupe(smoothCurveCells(ringPoints));
  // 링 길을 먼저 깔고, 그 안의 빈 칸을 녹지로 예약한다(반대 순서면 곡선 반올림으로 안쪽에 떨어진 링 칸이
  // 녹지에 걸려 빠지고 길이 대각선으로 끊긴다 — 2026-09-17 성분 2 의 원인).
  const ringCells = addRoad(ctx, ringCenter, 2, "ring");
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      if (Math.hypot(x - cx, y - cy) < radius - 0.5 && ctx.grid.get(x, y) === OCC.free) ctx.grid.set(x, y, OCC.commons);
    }
  }
  const commons: Rect = { x: cx - radius, y: cy - radius, w: radius * 2 + 1, h: radius * 2 + 1 };
  // 입구 — 남쪽 한 곳(방어 취락). 세드로 40% 북쪽 뒷문.
  const entrance = smoothCurveCells([{ x: cx, y: cy + radius }, { x: cx + jitter(rng, 3), y: cy + radius + Math.floor((area.y + area.h - 1 - cy - radius) / 2) }, { x: cx + jitter(rng, 4), y: area.y + area.h - 1 }]);
  addRoad(ctx, entrance, width, "main");
  ctx.exits.push({ id: "south-exit", x: entrance[entrance.length - 1]!.x, y: entrance[entrance.length - 1]!.y });
  let backLaneCells: Point[] = [];
  if (rng() < 0.4) {
    const back = smoothCurveCells([{ x: cx, y: cy - radius }, { x: cx + jitter(rng, 3), y: Math.floor((area.y + cy - radius) / 2) }, { x: cx + jitter(rng, 4), y: area.y }]);
    backLaneCells = addRoad(ctx, back, 1, "lane");
    ctx.exits.push({ id: "north-exit", x: back[back.length - 1]!.x, y: back[back.length - 1]!.y });
  }
  // 연못(링 안 서쪽) + 큰나무.
  const pond: Rect | undefined = radius >= 9 ? { x: cx - Math.floor(radius * 0.55) - 2, y: cy - 1, w: 5, h: 4 } : undefined;
  if (pond) ctx.grid.setRect(pond, OCC.pond);
  ctx.bigTrees.push({ x: cx + 1, y: cy - Math.floor(radius * 0.5) });
  // 집 — 북쪽 호 위 줄, 동·서 옆 기둥. 남쪽은 입구.
  const ringExt = columnExtents(ringCells);
  const ringRows = rowExtents(ringCells);
  // 북쪽 호는 굽어서 넓은 집이 뜬다 — 폭 6 이하로 촘촘히.
  planRowAbove(ctx, (x) => ringExt.get(x)?.top, cx - radius + 1, cx + radius - 1, { back: [2, 3], alleyEvery: 9, maxW: 6 });
  planColumnBeside(ctx, (y) => ringRows.get(y)?.left, cy - Math.floor(radius * 0.75), cy + Math.floor(radius * 0.8), "west");
  planColumnBeside(ctx, (y) => ringRows.get(y)?.right, cy - Math.floor(radius * 0.75), cy + Math.floor(radius * 0.8), "east");
  // 북쪽 뒷길이 있으면 그 양옆에도.
  if (backLaneCells.length > 0) {
    const laneRows = rowExtents(backLaneCells);
    planColumnBeside(ctx, (y) => laneRows.get(y)?.left, area.y + 2, cy - radius - 3, "west", { back: [1, 2] });
    planColumnBeside(ctx, (y) => laneRows.get(y)?.right, area.y + 2, cy - radius - 3, "east", { back: [1, 2] });
  }
  // 입구 길 양옆에도 한두 채.
  const entranceCells = thickenCells(entrance, width);
  const entranceRows = rowExtents(entranceCells);
  planColumnBeside(ctx, (y) => entranceRows.get(y)?.left, cy + radius + 3, area.y + area.h - 4, "west");
  planColumnBeside(ctx, (y) => entranceRows.get(y)?.right, cy + radius + 3, area.y + area.h - 4, "east");
  // 링 둘레·진입로 옆 배치만으로는 큰 맵에서도 목표에 1~2채 모자랐다 — 모자란 만큼만 길에 붙여 채운다.
  const grown = ctx.houses.length < ctx.args.maxHouses ? growHousesOnRoads(ctx, { x: cx, y: cy }) : 0;
  const plaza: Plaza = { rect: commons, centerX: cx + 2, centerRow: cy + 1 };
  ctx.notes.push(`환촌 r=${radius}${grown ? ` 보충 시도 ${grown}` : ""}`);
  return { commons, plaza, ...(pond ? { pond } : {}) };
}

// ───────────────────────── 유형 ④ 괴촌(성장 시뮬레이션) ─────────────────────────

function planClusterVillage(ctx: PlanCtx): { commons: Rect; plaza: Plaza } {
  const { area, rng, grid } = ctx;
  const width = clampInt(ctx.args.roadWidth, 2, 3) as 2 | 3;
  const center: Point = { x: area.x + Math.floor(area.w / 2) + jitter(rng, Math.floor(area.w * 0.08)), y: area.y + Math.floor(area.h / 2) + jitter(rng, Math.floor(area.h * 0.08)) };
  // 출구 2~3변 — 시드로 고른다. 출구 → 중심으로 굽은 길.
  const sides = (["north", "south", "west", "east"] as const).slice();
  for (let i = sides.length - 1; i > 0; i -= 1) { const j = Math.floor(rng() * (i + 1)); [sides[i], sides[j]] = [sides[j]!, sides[i]!]; }
  const exitCount = rng() < 0.5 ? 2 : 3;
  const chosen = sides.slice(0, exitCount);
  chosen.forEach((side, index) => {
    const edge: Point = side === "north" ? { x: center.x + jitter(rng, Math.floor(area.w * 0.2)), y: area.y }
      : side === "south" ? { x: center.x + jitter(rng, Math.floor(area.w * 0.2)), y: area.y + area.h - 1 }
        : side === "west" ? { x: area.x, y: center.y + jitter(rng, Math.floor(area.h * 0.2)) }
          : { x: area.x + area.w - 1, y: center.y + jitter(rng, Math.floor(area.h * 0.2)) };
    const mid: Point = { x: Math.floor((edge.x + center.x) / 2) + jitter(rng, 4), y: Math.floor((edge.y + center.y) / 2) + jitter(rng, 4) };
    addRoad(ctx, smoothCurveCells([edge, mid, center]), index < 2 ? width : 1, index < 2 ? "main" : "lane");
    ctx.exits.push({ id: `${side}-exit`, x: edge.x, y: edge.y });
  });
  // 출구가 없는 변으로는 막다른 골목(Sackgasse)을 하나씩 — 괴촌의 뼈대는 별 모양이다.
  for (const side of sides.slice(exitCount)) {
    const reach = side === "north" || side === "south" ? Math.floor(area.h * 0.3) : Math.floor(area.w * 0.3);
    const end: Point = side === "north" ? { x: center.x + jitter(rng, 6), y: center.y - reach }
      : side === "south" ? { x: center.x + jitter(rng, 6), y: center.y + reach }
        : side === "west" ? { x: center.x - reach, y: center.y + jitter(rng, 6) }
          : { x: center.x + reach, y: center.y + jitter(rng, 6) };
    const mid: Point = { x: Math.floor((center.x + end.x) / 2) + jitter(rng, 3), y: Math.floor((center.y + end.y) / 2) + jitter(rng, 3) };
    addRoad(ctx, smoothCurveCells([center, mid, end]), 1, "lane");
  }
  // 공동 녹지 — 중심 근처 빈 6×5.
  const commons = findFreeRect(ctx, center, 6, 5, 10) ?? { x: center.x + 2, y: center.y + 2, w: 6, h: 5 };
  grid.setRect(commons, OCC.commons);
  ctx.bigTrees.push({ x: commons.x + 1, y: commons.y + 1 });

  const attempts = growHousesOnRoads(ctx, center);
  const plaza: Plaza = { rect: commons, centerX: commons.x + Math.floor(commons.w / 2), centerRow: commons.y + Math.floor(commons.h / 2) };
  ctx.notes.push(`괴촌 출구 ${chosen.join(",")} 시도 ${attempts}`);
  return { commons, plaza };
}

/**
 * 기존 길에서 옆으로 갈라지는 골목을 하나 뻗는다(7~12칸). 시작 칸 주변 길의 접선을 재서 그 수직 방향(±30°)으로
 * 나가고, 집·녹지·다른 길에 닿으면 거기서 끊는다. 기존 길에 나란히 붙는 골목(30% 넘게 길 2칸 안)은 버린다.
 */
function growLane(ctx: PlanCtx, center: Point, width: 1 | 2 | 3): void {
  const { rng, grid, area } = ctx;
  const roadCells = ctx.roads.filter((stroke) => stroke.role !== "spur").flatMap((stroke) => stroke.cells)
    .filter((cell) => cell.x > area.x + 2 && cell.x < area.x + area.w - 3 && cell.y > area.y + 2 && cell.y < area.y + area.h - 3);
  if (roadCells.length === 0) return;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const start = roadCells[Math.floor(rng() * roadCells.length)]!;
    const tangent = roadTangent(grid, start);
    const outward = Math.atan2(start.y - center.y, start.x - center.x);
    const base = tangent === undefined ? outward : tangent + (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const angle = base + (rng() * 2 - 1) * (Math.PI / 6);
    const length = 7 + Math.floor(rng() * 6);
    const end: Point = {
      x: clampInt(start.x + Math.cos(angle) * length, area.x + 2, area.x + area.w - 3),
      y: clampInt(start.y + Math.sin(angle) * length, area.y + 2, area.y + area.h - 3),
    };
    const mid: Point = { x: Math.floor((start.x + end.x) / 2) + jitter(rng, 2), y: Math.floor((start.y + end.y) / 2) + jitter(rng, 2) };
    const cells = smoothCurveCells([start, mid, end]);
    const clear: Point[] = [];
    for (const [index, cell] of cells.entries()) {
      if (index > 0 && grid.get(cell.x, cell.y) !== OCC.free) break;
      clear.push(cell);
    }
    if (clear.length < 6) continue;
    let hugging = 0;
    for (const cell of clear.slice(3)) if (roadWithin(grid, cell, 2)) hugging += 1;
    if (hugging > (clear.length - 3) * 0.3) continue;
    addRoad(ctx, clear, width, "lane");
    return;
  }
}

/** 시작 칸 주변(체비셰프 3) 길 칸의 주축 각도 — 길이 한 칸뿐이면 undefined. */
function roadTangent(grid: PlanGrid, at: Point): number | undefined {
  const cells: Point[] = [];
  for (let dy = -3; dy <= 3; dy += 1) for (let dx = -3; dx <= 3; dx += 1) if (grid.isRoad(at.x + dx, at.y + dy)) cells.push({ x: at.x + dx, y: at.y + dy });
  if (cells.length < 3) return undefined;
  const mx = cells.reduce((sum, c) => sum + c.x, 0) / cells.length;
  const my = cells.reduce((sum, c) => sum + c.y, 0) / cells.length;
  let cxx = 0, cyy = 0, cxy = 0;
  for (const c of cells) { cxx += (c.x - mx) ** 2; cyy += (c.y - my) ** 2; cxy += (c.x - mx) * (c.y - my); }
  if (cxx + cyy < 1e-6) return undefined;
  return 0.5 * Math.atan2(2 * cxy, cxx - cyy);
}

function roadWithin(grid: PlanGrid, at: Point, radius: number): boolean {
  for (let dy = -radius; dy <= radius; dy += 1) for (let dx = -radius; dx <= radius; dx += 1) if (grid.isRoad(at.x + dx, at.y + dy)) return true;
  return false;
}

/**
 * 문 앞 칸에서 가장 가까운 길까지 4-이웃 BFS(빈 칸·옆길 칸만, 필지 안은 시작 칸만). 길 직전 칸까지의 경로를 돌려준다.
 * 문 앞이 이미 길이면 빈 배열. 못 찾으면 undefined.
 */
function planSpur(ctx: PlanCtx, front: Point, parcel: Rect, maxSteps: number): Point[] | undefined {
  const { grid } = ctx;
  if (grid.isRoad(front.x, front.y)) return [];
  const inParcel = (p: Point): boolean => p.x >= parcel.x && p.x < parcel.x + parcel.w && p.y >= parcel.y && p.y < parcel.y + parcel.h;
  const key = (p: Point): number => p.y * grid.width + p.x;
  const prev = new Map<number, number>([[key(front), -1]]);
  const queue: Point[] = [front];
  let head = 0;
  while (head < queue.length) {
    const cell = queue[head++]!;
    if (Math.abs(cell.x - front.x) + Math.abs(cell.y - front.y) > maxSteps) continue;
    for (const next of [{ x: cell.x, y: cell.y + 1 }, { x: cell.x + 1, y: cell.y }, { x: cell.x - 1, y: cell.y }, { x: cell.x, y: cell.y - 1 }]) {
      if (prev.has(key(next))) continue;
      if (grid.isRoad(next.x, next.y)) {
        const path: Point[] = [];
        let cursor = key(cell);
        while (cursor !== -1) {
          path.push({ x: cursor % grid.width, y: Math.floor(cursor / grid.width) });
          cursor = prev.get(cursor) ?? -1;
        }
        return path.reverse();
      }
      if (inParcel(next)) continue;
      const value = grid.get(next.x, next.y);
      if (value !== OCC.free && value !== OCC.spur && value !== OCC.forest) continue;
      prev.set(key(next), key(cell));
      queue.push(next);
    }
  }
  return undefined;
}

function findFreeRect(ctx: PlanCtx, near: Point, w: number, h: number, radius: number): Rect | undefined {
  let best: { rect: Rect; dist: number } | undefined;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const rect: Rect = { x: near.x + dx - Math.floor(w / 2), y: near.y + dy - Math.floor(h / 2), w, h };
      if (!ctx.grid.rectFree({ x: rect.x - 1, y: rect.y - 1, w: rect.w + 2, h: rect.h + 2 })) continue;
      const dist = Math.hypot(dx, dy);
      if (!best || dist < best.dist) best = { rect, dist };
    }
  }
  return best?.rect;
}

/** 길까지의 4-이웃 거리장(영역 안). 길 칸 = 0. */
export function roadDistanceField(grid: PlanGrid, area: Rect): Uint16Array {
  const dist = new Uint16Array(grid.width * grid.height).fill(0xffff);
  const queue: number[] = [];
  for (let y = area.y; y < area.y + area.h; y += 1) {
    for (let x = area.x; x < area.x + area.w; x += 1) {
      if (grid.isRoad(x, y)) { dist[y * grid.width + x] = 0; queue.push(y * grid.width + x); }
    }
  }
  let head = 0;
  while (head < queue.length) {
    const index = queue[head++]!;
    const x = index % grid.width, y = Math.floor(index / grid.width);
    const d = dist[index]! + 1;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      if (nx < area.x || ny < area.y || nx >= area.x + area.w || ny >= area.y + area.h) continue;
      const nIndex = ny * grid.width + nx;
      if (dist[nIndex]! <= d) continue;
      dist[nIndex] = d;
      queue.push(nIndex);
    }
  }
  return dist;
}

// ───────────────────────── 밭·과수원·풀밭 ─────────────────────────

/**
 * 필지 뒤(북쪽 줄은 북쪽, 골목 줄은 남쪽, 옆 기둥은 바깥쪽)에 밭을 붙인다. 밭은 길·필지에서 1칸 띄운다.
 * 형태별로 55% 경작지 · 25% 과수원 · 20% 풀밭.
 */
function planFields(ctx: PlanCtx): void {
  const { rng, grid, area } = ctx;
  const tryField = (rect: Rect): boolean => {
    if (rect.w < 4 || rect.h < 3) return false;
    if (rect.x < area.x + 1 || rect.y < area.y + 1 || rect.x + rect.w > area.x + area.w - 1 || rect.y + rect.h > area.y + area.h - 1) return false;
    if (!grid.rectFree({ x: rect.x - 1, y: rect.y - 1, w: rect.w + 2, h: rect.h + 2 })) return false;
    const roll = rng();
    const kind: FieldKind = roll < 0.55 ? "farm" : roll < 0.8 ? "orchard" : "meadow";
    grid.setRect(rect, OCC.field);
    ctx.fields.push({ rect, kind });
    return true;
  };
  for (const [index, slot] of ctx.houses.entries()) {
    if (rng() < 0.25) continue; // 모든 필지에 밭이 붙으면 단조롭다.
    const wanted = 4 + Math.floor(rng() * 5);
    const parcel = slot.parcel;
    if (slot.frontDir === "down") {
      // 위쪽(뒷마당 너머) — 영역 위 가장자리까지 남은 만큼만. 골목 줄(ceiling 아래 집)은 위가 큰길이라 실패하고, 그러면 아래쪽 시도.
      const depthAbove = Math.min(wanted, parcel.y - 2 - area.y);
      const above: Rect = { x: parcel.x + 1, y: parcel.y - 1 - depthAbove, w: parcel.w - 2 + (rng() < 0.5 ? 2 : 0), h: depthAbove };
      if (depthAbove >= 3 && tryField(above)) continue;
      const depthBelow = Math.min(wanted, area.y + area.h - 2 - (parcel.y + parcel.h + 2));
      const below: Rect = { x: parcel.x + 1, y: parcel.y + parcel.h + 2, w: parcel.w - 2, h: depthBelow };
      if (depthBelow >= 3) tryField(below);
    } else if (slot.frontDir === "east") {
      const depth = Math.min(wanted, parcel.x - 2 - area.x);
      if (depth >= 3) tryField({ x: parcel.x - 1 - depth, y: parcel.y, w: depth, h: parcel.h + (index % 2 === 0 ? 1 : 0) });
    } else {
      const depth = Math.min(wanted, area.x + area.w - 2 - (parcel.x + parcel.w + 1));
      if (depth >= 3) tryField({ x: parcel.x + parcel.w + 1, y: parcel.y, w: depth, h: parcel.h + (index % 2 === 0 ? 1 : 0) });
    }
  }
  // 마을 밖 자유 밭 — 남는 빈 땅에 큼직한 밭 3~5개.
  const extra = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < extra * 20 && ctx.fields.length < ctx.houses.length + extra; i += 1) {
    const w = 6 + Math.floor(rng() * 6), h = 4 + Math.floor(rng() * 4);
    const x = area.x + 2 + Math.floor(rng() * Math.max(1, area.w - w - 4));
    const y = area.y + 2 + Math.floor(rng() * Math.max(1, area.h - h - 4));
    tryField({ x, y, w, h });
  }
}
