// editor/tools/mapHelpers.ts
// 맵 타일 조작 순수 헬퍼(도구 공용). emberQuestGame.ts의 setLower/setUpper/rect 관례를 그대로 따른다.

import { canMove, isPassable } from "@/project/collision";
import { TILE } from "@/project/defaults/constants";
import { setLayerTileAt, setShadowAt, layerTileAt, type TileLayerNo } from "@/project/mapLayers";
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

// lower 타일 지정 + 같은 칸 위의 층을 모두 비움(emberQuest setLower 관례: 지면 교체 시 상단 장식 제거).
// MZ 4층: 2층 바닥 장식·4층·그림자도 같은 칸에서 지운다. 옛 맵(선택 칸 없음)에는 no-op — 새 키를 만들지 않는다.
// 선택 칸이 모두 비면 키 정리는 toolRunner 가 쓰기 도구 끝에서 compactMapLayers 로 한다.
export function setLower(map: GameMap, x: number, y: number, tile: number): void {
  if (!inMapBounds(map, x, y)) return;
  const i = y * map.width + x;
  map.lowerTiles[i] = tile;
  map.upperTiles[i] = TILE.EMPTY;
  setLayerTileAt(map, 2, i, TILE.EMPTY);
  setLayerTileAt(map, 4, i, TILE.EMPTY);
  setShadowAt(map, i, 0);
}

// upper 타일만 지정(지면 보존).
export function setUpper(map: GameMap, x: number, y: number, tile: number): void {
  if (!inMapBounds(map, x, y)) return;
  map.upperTiles[y * map.width + x] = tile;
}

// ── MZ 4층 인자 ──
// 모델이 보내는 층 인자는 문자열 enum 이다(Gemini 함수 선언은 정수 enum 이 불안정). lower=1층, upper=3층 별칭.
// 층 번호와 맵 칸 이름의 대응은 @/project/mapLayers 가 정본이다.
export const TOOL_LAYER_ENUM = ["lower", "upper", "1", "2", "3", "4"] as const;
export type ToolLayerArg = (typeof TOOL_LAYER_ENUM)[number];

/** 네 층 뜻 — 층을 받는 도구 설명이 모두 이 한 문장을 쓴다(같은 낱말로 가르친다). */
export const FOUR_LAYER_GUIDANCE =
  "층: 1층 바닥(물·흙·벽 자동타일), 2층 바닥 장식(1층 위에 겹치는 풀·흙 자동타일, 캐릭터 아래), "
  + "3층 물체(나무·바위·건물, ★ 은 캐릭터 위), 4층 물체 위 물체(3층 위에 겹쳐 쌓기), 그림자(벽 아래 사분면). "
  + "lower=1층, upper=3층. 1층을 칠하면 그 칸 2층이 지워진다(paint_tiles 1층은 기존처럼 3·4층·그림자까지 비운다).";

/**
 * 짧은 층 안내 — 층을 고르기만 하거나 층 설명이 곁가지인 도구(tile_erase·paint_shadow·fill_region·show_map_region)용.
 * 뜻은 FOUR_LAYER_GUIDANCE 와 같다. 설명은 모든 프로젝트에 실리므로 긴 안내는 칠하기 본 도구(paint_tiles·stamp_layer_block)에만 둔다.
 */
export const FOUR_LAYER_GUIDANCE_SHORT =
  "층: 1 바닥·2 바닥 장식·3 물체·4 물체 위 물체·그림자(벽 아래 사분면). lower=1층, upper=3층.";

/** 층 인자 → 층 번호. 모르는 값이면 null. */
export function parseToolLayer(value: unknown): TileLayerNo | null {
  if (value === "lower" || value === "1") return 1;
  if (value === "upper" || value === "3") return 3;
  if (value === "2") return 2;
  if (value === "4") return 4;
  return null;
}

/** 결과 data 에 싣는 층 이름("1".."4"). */
export function toolLayerLabel(layer: TileLayerNo): "1" | "2" | "3" | "4" {
  return String(layer) as "1" | "2" | "3" | "4";
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

/**
 * 시작 칸과 같은 타일로 이어진 칸(4방향). layer 기본 1층.
 * 2층 채우기는 (1층, 2층) 쌍이 시작 칸과 같은 칸으로만 번진다 — 2층이 비어 있으면 모든 칸이 -1 이라
 * 2층만 보면 물·벽·길까지 맵 전체가 이어진다(「이 풀밭에 풀 장식」이 맵 전체가 된다).
 */
export function floodFillCells(map: GameMap, start: Point, tile: number, layer: TileLayerNo = 1): Point[] {
  if (!inMapBounds(map, start.x, start.y)) return [];
  const startIndex = start.y * map.width + start.x;
  const source = layerTileAt(map, layer, startIndex);
  const ground = layer === 2 ? layerTileAt(map, 1, startIndex) : null;
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
    const index = point.y * map.width + point.x;
    if (layerTileAt(map, layer, index) !== source) continue;
    if (ground !== null && layerTileAt(map, 1, index) !== ground) continue;
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
