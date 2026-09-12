import { TILE } from "@/project/defaults/constants";
import { LAKE_AUTOTILE_TILE } from "@/project/defaults/lakeAutotile";
import { footprintBounds, normalizeCharacterFootprint } from "@/project/footprint";
import { isCombinedTownTileset } from "@/project/tilesetHarness";
import type { GameMap, Project, Rect } from "@/project/types";
import { mulberry32 } from "@/util/rng";
import { protectedHouseCells } from "../houseProtection";
import { protectedEventCells } from "../placementTools";
import { ToolError } from "../types";

type Point = { readonly x: number; readonly y: number };
export type OrganicVillageLakePlan = {
  readonly bounds: Rect;
  readonly cells: readonly Point[];
};
export type OrganicVillageLakeOptions = {
  readonly avoid?: ReadonlySet<number>;
  /** Index stride for avoid: y * mapWidth + x, including a nonzero area origin. */
  readonly mapWidth?: number;
};

/** Reserve once before houses/roads/trees; pass this same plan to the final painter.
 * Broad, separately authored north/south banks form offset bays and headlands.
 * Randomness moves bank control points, never individual shoreline pixels. */
export function planOrganicVillageLake(area: Rect, seed: number, options: OrganicVillageLakeOptions = {}): OrganicVillageLakePlan {
  if (!validRect(area) || area.w < 16 || area.h < 16 || !Number.isSafeInteger(seed)) {
    throw new ToolError("호수 계획에는 정수 좌표의 16×16 이상 영역과 정수 시드가 필요합니다.", { code: "village-lake-plan" });
  }
  const rng = mulberry32(seed);
  const width = Math.round(area.w * (0.50 + rng() * 0.035));
  const depth = Math.max(4, Math.min(Math.floor(width / 2), Math.round(area.h * (0.22 + rng() * 0.015))));
  const x = area.x + area.w - width - Math.max(2, Math.round(area.w * 0.065));
  const y = area.y + area.h - depth - Math.max(2, Math.round(area.h * 0.075));
  const preferred = lakeAt({ x, y, w: width, h: depth }, seed, false);
  if (!options.avoid?.size) return preferred;
  const stride = options.mapWidth;
  if (!Number.isSafeInteger(stride) || stride! < area.x + area.w) {
    throw new ToolError("호수 회피 셀에는 실제 맵 너비(mapWidth)가 필요합니다.", { code: "village-lake-plan" });
  }
  const fits = (plan: OrganicVillageLakePlan): boolean => {
    const ratio = plan.cells.length / (area.w * area.h);
    return ratio >= 0.035 && ratio <= 0.08 && plan.bounds.w >= plan.bounds.h * 1.8
      && plan.bounds.x >= area.x && plan.bounds.y >= area.y
      && plan.bounds.x + plan.bounds.w <= area.x + area.w && plan.bounds.y + plan.bounds.h <= area.y + area.h
      && plan.cells.every(p => !options.avoid!.has(p.y * stride! + p.x));
  };
  if (fits(preferred)) return preferred;
  // A central cross can leave only ~26 columns in an 80×80 southeast lot.
  // Reduce the water share to 3.5–8% before sacrificing the horizontal silhouette.
  // Try 2:1 first, then 1.8:1 only when the thinner body cannot meet that share.
  // Each candidate is still one complete silhouette; never cut forbidden pixels out.
  for (const widthRatio of [0.50, 0.42, 0.35, 0.32, 0.31]) {
    const w = Math.round(area.w * widthRatio);
    for (const aspect of [2, 1.8]) {
      const h = Math.max(4, Math.min(Math.round(area.h * 0.23), Math.floor(w / aspect)));
      for (const [right, bottom] of [[1, 4], [1, 8], [4, 3], [1, 2]] as const) {
        const candidate = lakeAt({ x: area.x + area.w - w - right, y: area.y + area.h - h - bottom, w, h }, seed, widthRatio < 0.5);
        if (fits(candidate)) return candidate;
      }
    }
  }
  throw new ToolError("우하단에 길을 피하면서 마을 면적의 3.5~8%를 차지하는 가로로 긴 연결 호수를 놓을 수 없습니다. 길 예약이나 마을 크기를 조정하세요.",
    { code: "village-lake-capacity" });
}

function lakeAt(box: Rect, seed: number, broad: boolean): OrganicVillageLakePlan {
  const rng = mulberry32(seed ^ 0x4c414b45);
  const { x, y, w: width, h: depth } = box;
  const stations = [0, 0.12, 0.28, 0.43, 0.57, 0.73, 0.90, 1];
  const north = broad ? [0.47, 0.05, 0.025, 0.12, 0.30, 0.025, 0.08, 0.46] : [0.47, 0.16, 0.08, 0.34, 0.40, 0.10, 0.21, 0.46];
  const south = broad ? [0.57, 0.92, 0.98, 0.94, 0.85, 0.98, 0.90, 0.57] : [0.57, 0.77, 0.93, 0.96, 0.71, 0.85, 0.78, 0.57];
  for (let i = 1; i < stations.length - 1; i++) {
    stations[i]! += (rng() - 0.5) * 0.035;
    north[i]! += (rng() - 0.5) * 0.055;
    south[i]! += (rng() - 0.5) * 0.055;
    south[i] = Math.min(0.99, south[i]!);
  }
  const topBank: number[] = [], bottomBank: number[] = [];
  for (let dx = 0; dx < width; dx++) {
    const t = dx / (width - 1);
    const top = Math.round(depth * bankAt(stations, north, t));
    topBank.push(top);
    bottomBank.push(Math.max(top + 2, Math.round(depth * bankAt(stations, south, t))));
  }
  // Quantizing a smooth extremum can leave one projecting pixel. A three-column
  // median removes that raster artifact without introducing independent jitter.
  const smoothTop = smoothBank(topBank), smoothBottom = smoothBank(bottomBank);
  const cells: Point[] = [];
  for (let dx = 0; dx < width; dx++) {
    const top = smoothTop[dx]!, bottom = Math.max(top + 2, smoothBottom[dx]!);
    for (let dy = top; dy < bottom; dy++) cells.push({ x: x + dx, y: y + dy });
  }
  return { bounds: boundsOf(cells), cells };
}

function smoothBank(bank: readonly number[]): number[] {
  return bank.map((v, i) => i === 0 || i === bank.length - 1 ? v
    : [bank[i - 1]!, v, bank[i + 1]!].sort((a, b) => a - b)[1]!);
}

/** Paint exactly the reserved cells, or reject the entire operation before writing.
 * Town water is a render-time quarter autotile: the canonical stored 0 is composed
 * by lakeAutotileQuarterSources in the editor, snapshots and runtime. It is NOT a
 * 3×4 terrain group, and shaping neighboring land would exceed this reservation. */
export function paintOrganicVillageLake(project: Project, map: GameMap, plan: OrganicVillageLakePlan): number {
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset || !isCombinedTownTileset(tileset)) {
    throw new ToolError("이 호수는 합본 마을 칩셋 전용입니다.", { code: "village-tileset-mismatch", mapId: map.id });
  }
  validatePlan(map, plan);
  const houses = new Set(protectedHouseCells(map).map(key));
  const events = protectedEventCells(project, map);
  // Protect every authored page footprint, including a non-anchor body cell.
  for (const event of map.events) for (const page of event.pages ?? []) {
    const body = footprintBounds(event.x, event.y, normalizeCharacterFootprint(page.footprint));
    for (let y = body.top; y <= body.bottom; y++) for (let x = body.left; x <= body.right; x++) events.add(key({ x, y }));
  }
  const owned = Object.values(project.spatialAuthoring?.occurrences ?? {}).flatMap(occurrence =>
    occurrence.bindings.filter(binding => binding.kind !== "projection" && binding.mapId === map.id).map(binding => binding.rect));
  for (const p of plan.cells) {
    const index = p.y * map.width + p.x;
    const reason = houses.has(key(p)) ? "완성된 집"
      : owned.some(rect => p.x >= rect.x && p.y >= rect.y && p.x < rect.x + rect.width && p.y < rect.y + rect.height) ? "공간 저작 영역"
      : events.has(key(p)) ? "이벤트·시작·이동 착지"
      : map.lowerTileStacks?.[index]?.length || map.upperTileStacks?.[index]?.length ? "기존 타일 스택"
      : map.lowerTiles[index] !== TILE.GRASS || map.upperTiles[index] !== TILE.EMPTY ? "기존 지형·길·나무·소품"
      : undefined;
    if (reason) throw new ToolError(`호수 예약 칸(${p.x},${p.y})에 ${reason}이 있습니다. 예약과 배치를 다시 확인하세요.`,
      { code: "village-water-conflict", mapId: map.id, x: p.x, y: p.y });
  }
  // No clipping, clearing, global autotile repair or shared project mutation.
  for (const p of plan.cells) map.lowerTiles[p.y * map.width + p.x] = LAKE_AUTOTILE_TILE.OUTER_CORNER;
  return plan.cells.length;
}

function bankAt(stations: readonly number[], bank: readonly number[], t: number): number {
  let segment = 0;
  while (segment < stations.length - 2 && t > stations[segment + 1]!) segment++;
  const u = (t - stations[segment]!) / (stations[segment + 1]! - stations[segment]!);
  const smooth = u * u * (3 - 2 * u);
  return bank[segment]! + (bank[segment + 1]! - bank[segment]!) * smooth;
}

function validRect(rect: Rect): boolean {
  return [rect.x, rect.y, rect.w, rect.h, rect.x + rect.w, rect.y + rect.h].every(Number.isSafeInteger)
    && rect.x >= 0 && rect.y >= 0 && rect.w > 0 && rect.h > 0;
}
function key(p: Point): string { return `${p.x},${p.y}`; }
function boundsOf(cells: readonly Point[]): Rect {
  let x = Infinity, y = Infinity, right = -Infinity, bottom = -Infinity;
  for (const p of cells) { x = Math.min(x, p.x); y = Math.min(y, p.y); right = Math.max(right, p.x); bottom = Math.max(bottom, p.y); }
  return { x, y, w: right - x + 1, h: bottom - y + 1 };
}

function validatePlan(map: GameMap, plan: OrganicVillageLakePlan): void {
  const fail = (): never => { throw new ToolError("호수 예약은 맵 안의 중복 없는 연결 수역과 정확한 경계여야 합니다.", { code: "village-lake-plan", mapId: map.id }); };
  if (!validRect(plan.bounds) || !plan.cells.length || plan.bounds.x + plan.bounds.w > map.width
    || plan.bounds.y + plan.bounds.h > map.height) fail();
  const reserved = new Set<string>();
  for (const p of plan.cells) {
    if (!Number.isSafeInteger(p.x) || !Number.isSafeInteger(p.y) || p.x < plan.bounds.x || p.y < plan.bounds.y
      || p.x >= plan.bounds.x + plan.bounds.w || p.y >= plan.bounds.y + plan.bounds.h || reserved.has(key(p))) fail();
    reserved.add(key(p));
  }
  const actual = boundsOf(plan.cells);
  if (actual.x !== plan.bounds.x || actual.y !== plan.bounds.y || actual.w !== plan.bounds.w || actual.h !== plan.bounds.h) fail();
  const queue = [plan.cells[0]!], seen = new Set<string>([key(queue[0]!)]);
  for (let i = 0; i < queue.length; i++) for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
    const next = { x: queue[i]!.x + dx, y: queue[i]!.y + dy }, k = key(next);
    if (reserved.has(k) && !seen.has(k)) { seen.add(k); queue.push(next); }
  }
  if (seen.size !== reserved.size) fail();
}
