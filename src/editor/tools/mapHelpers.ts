// editor/tools/mapHelpers.ts
// 맵 타일 조작 순수 헬퍼(도구 공용). emberQuestGame.ts의 setLower/setUpper/rect 관례를 그대로 따른다.

import { canMove, isPassable } from "@/project/collision";
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
  if (!map) {
    throw new ToolError(
      `맵을 찾을 수 없습니다: ${mapId} — list_maps 로 실제 맵 id 를 확인하세요(새 맵을 만들어 우회하지 말 것).`,
      { code: "map-not-found", mapId },
    );
  }
  return map;
}

/**
 * 새 맵 id 가 비어 있는지 확인한다. 모든 맵 생성 경로가 **같은 문구**를 쓴다
 * (2026-08-29 modify 진단 근본원인 15). 옛 메시지는 툴마다 달랐고("Map already exists",
 * "이미 존재하는 맵 id입니다") 전부 "그러면 다음엔 뭘 해야 하는가"를 말해 주지 않아, 모델이
 * `map_town_2` 처럼 id 를 바꿔 **새 맵을 하나 더 만드는** 우회로 빠졌다. 수정 요청에서는
 * 그 우회가 곧 사용자가 본 증상(원본은 그대로, 새 맵이 생김)이다.
 */
export const MAP_ID_TAKEN_GUIDANCE =
  "이 맵을 고치려면 새로 만들지 말고 그 맵을 대상으로 get_map_region 으로 현재 상태를 본 뒤 "
  + "paint_tiles/fill_region/tile_erase/place_props/move_event 를 쓰세요. "
  + "id 뒤에 숫자를 붙여 새 맵을 만드는 우회는 금지입니다.";

export function mapIdTakenMessage(mapId: string): string {
  return `이미 존재하는 맵 id입니다: ${mapId} — ${MAP_ID_TAKEN_GUIDANCE}`;
}

export function assertMapIdAvailable(project: Project, mapId: string): void {
  if (project.maps[mapId]) throw new ToolError(mapIdTakenMessage(mapId), { code: "map-exists", mapId });
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

/**
 * 영역 **밖에서 걸어 들어올 수 있는** 칸 수. passableCellCount 와 달리 실제 진입 경로를 본다 —
 * 사방이 막혀 밖에서 닿지 않는 안쪽 주머니는 세지 않는다. "지나갈 수 없다"를 말할 때
 * 필요한 수치다(수관 타일은 통행 가능이라 통행 가능 칸 수만으로는 판단할 수 없다).
 */
export function reachableCellCount(
  project: Project,
  map: GameMap,
  area: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
): number {
  return reachableCells(project, map, area).length;
}

/** reachableCellCount 의 칸 목록판 — 그 칸들을 실제로 막으려면 좌표가 필요하다. */
export function reachableCells(
  project: Project,
  map: GameMap,
  area: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
): Point[] {
  const insideArea = (x: number, y: number): boolean => (
    x >= area.x && y >= area.y && x < area.x + area.w && y < area.y + area.h
  );
  const seen = new Set<string>();
  const queue: Point[] = [];
  const reached: Point[] = [];
  const enter = (outsideX: number, outsideY: number, x: number, y: number): void => {
    if (!insideArea(x, y) || !inMapBounds(map, outsideX, outsideY)) return;
    const key = `${x},${y}`;
    if (seen.has(key) || !canMove(project, map, outsideX, outsideY, x, y)) return;
    seen.add(key);
    queue.push({ x, y });
  };
  // 왜 영역 경계 자체를 시작점으로 삼으면 안 되는가(4×4 실측): 바로 바깥 한 겹이 덤불로
  // 완전히 막혀 입구가 0개여도, 안쪽 경계가 passable 이라는 이유만으로 16칸 전부를 셌다.
  // 실제 런타임과 같은 canMove 로 바깥 인접 칸에서 경계를 넘을 수 있을 때만 시작한다.
  for (let x = area.x; x < area.x + area.w; x += 1) {
    enter(x, area.y - 1, x, area.y);
    enter(x, area.y + area.h, x, area.y + area.h - 1);
  }
  for (let y = area.y; y < area.y + area.h; y += 1) {
    enter(area.x - 1, y, area.x, y);
    enter(area.x + area.w, y, area.x + area.w - 1, y);
  }
  while (queue.length > 0) {
    const cell = queue.pop()!;
    reached.push(cell);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = cell.x + dx;
      const y = cell.y + dy;
      if (!insideArea(x, y)) continue;
      const key = `${x},${y}`;
      if (seen.has(key) || !canMove(project, map, cell.x, cell.y, x, y)) continue;
      seen.add(key);
      queue.push({ x, y });
    }
  }
  return reached;
}

// 지정 칸들 중 통행 불가가 된 셀 수와 그 칸에 남은 이벤트를 경고한다(passability 변화 감지용).
export function passabilityWarning(project: Project, map: GameMap, cells: readonly Point[]): string | null {
  const blockedCells = new Set<string>();
  for (const cell of cells) {
    if (inMapBounds(map, cell.x, cell.y) && !isPassable(project, map, cell.x, cell.y)) {
      blockedCells.add(`${cell.x},${cell.y}`);
    }
  }
  if (blockedCells.size === 0) return null;
  const base = `경고: ${blockedCells.size}개 칸이 통행 불가가 되었습니다(${map.id}).`;
  const stranded = map.events.filter((event) => blockedCells.has(`${event.x},${event.y}`));
  if (stranded.length === 0) return base;
  const samples = stranded.slice(0, 5).map((event) => `${event.id}(${event.x},${event.y})`);
  const extra = stranded.length > samples.length ? ` 외 ${stranded.length - samples.length}건` : "";
  return `${base} 해당 칸의 이벤트: ${samples.join(", ")}${extra}`;
}
