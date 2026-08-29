// editor/tools/mapHelpers.ts
// 맵 타일 조작 순수 헬퍼(도구 공용). emberQuestGame.ts의 setLower/setUpper/rect 관례를 그대로 따른다.

import { isPassable } from "@/project/collision";
import { TILE } from "@/project/defaults/constants";
import type { GameMap, Project } from "@/project/types";
import { ToolError } from "./types";

export interface Point {
  readonly x: number;
  readonly y: number;
}

export function inMapBounds(map: GameMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

// 지정 맵을 draft에서 조회(없으면 ToolError).
export function requireMap(project: Project, mapId: string): GameMap {
  const map = project.maps[mapId];
  if (!map) throw new ToolError(`맵을 찾을 수 없습니다: ${mapId}`, { code: "map-not-found", mapId });
  return map;
}

// lower 타일 지정 + 같은 칸 upper 비움(emberQuest setLower 관례: 지면 교체 시 상단 장식 제거).
export function setLower(map: GameMap, x: number, y: number, tile: number): void {
  if (!inMapBounds(map, x, y)) return;
  const i = y * map.width + x;
  map.lowerTiles[i] = tile;
  map.upperTiles[i] = TILE.EMPTY;
}

// upper 타일만 지정(지면 보존).
export function setUpper(map: GameMap, x: number, y: number, tile: number): void {
  if (!inMapBounds(map, x, y)) return;
  map.upperTiles[y * map.width + x] = tile;
}

// (from~to) 직사각형을 lower 타일로 채운다.
export function fillRect(map: GameMap, from: Point, to: Point, tile: number): void {
  const x0 = Math.min(from.x, to.x);
  const x1 = Math.max(from.x, to.x);
  const y0 = Math.min(from.y, to.y);
  const y1 = Math.max(from.y, to.y);
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) setLower(map, x, y, tile);
  }
}

// 브레젠험 유사 직선(4방향 근사)으로 두 점을 잇는 셀 목록.
export function lineCells(from: Point, to: Point): Point[] {
  const cells: Point[] = [];
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - x);
  const dy = Math.abs(to.y - y);
  const sx = x < to.x ? 1 : -1;
  const sy = y < to.y ? 1 : -1;
  let err = dx - dy;
  for (;;) {
    cells.push({ x, y });
    if (x === to.x && y === to.y) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return cells;
}

// 4방향 flood fill: 시작 칸과 같은 lower 타일을 target으로 교체.
export function floodFill(map: GameMap, start: Point, tile: number): Point[] {
  const filled = floodFillCells(map, start, tile);
  for (const point of filled) setLower(map, point.x, point.y, tile);
  return filled;
}

export function floodFillCells(map: GameMap, start: Point, tile: number): Point[] {
  if (!inMapBounds(map, start.x, start.y)) return [];
  const source = map.lowerTiles[start.y * map.width + start.x];
  if (source === tile) return [];
  const filled: Point[] = [];
  const stack: Point[] = [start];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const point = stack.pop() as Point;
    const key = `${point.x},${point.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!inMapBounds(map, point.x, point.y)) continue;
    if (map.lowerTiles[point.y * map.width + point.x] !== source) continue;
    filled.push(point);
    stack.push({ x: point.x + 1, y: point.y }, { x: point.x - 1, y: point.y }, { x: point.x, y: point.y + 1 }, { x: point.x, y: point.y - 1 });
  }
  return filled;
}

/**
 * 직사각 영역 안에서 아직 걸어 들어갈 수 있는 칸 수. "아예 통행불가능하게" 같은 지시가
 * 실제로 달성됐는지 말하려면 결과를 세어야 한다 — 배치 개수만으로는 알 수 없다.
 */
export function passableCellCount(
  project: Project,
  map: GameMap,
  area: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
): number {
  let passable = 0;
  for (let y = area.y; y < area.y + area.h; y += 1) {
    for (let x = area.x; x < area.x + area.w; x += 1) {
      if (inMapBounds(map, x, y) && isPassable(project, map, x, y)) passable += 1;
    }
  }
  return passable;
}

// 지정 칸들 중 통행 불가가 된 셀 수를 세어 경고 문구를 만든다(passability 변화 감지용).
export function passabilityWarning(project: Project, map: GameMap, cells: readonly Point[]): string | null {
  let blocked = 0;
  for (const cell of cells) {
    if (inMapBounds(map, cell.x, cell.y) && !isPassable(project, map, cell.x, cell.y)) blocked += 1;
  }
  if (blocked === 0) return null;
  return `경고: ${blocked}개 칸이 통행 불가가 되었습니다(${map.id}).`;
}
