// project/collision.ts
// 타일 좌표 → 통과 가능 여부 판정. 순수 함수(Phaser/DOM 무관).
// v2: 4방향 passability 기반(RM2K3 정석). TilesetDef.passability 사용.
// 스펙 docs/specs/2026-06-18-oprn-overhaul-design.md §8.3.

import type { GameMap, Project, TilesetDef, Dir, PassFlag, CharacterFootprint, FootprintRect } from "./types";
import { topTileInStack } from "./mapOverlayTiles";
import { passageMarkForTile } from "./tilesetPassage";
import { footprintBounds, passageBounds } from "./footprint";

// 주어진 타일 좌표가 맵 경계 안인가?
export function inBounds(map: GameMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

// 맵의 타일셋 정의 조회(편의).
export function getTileset(project: Project, map: GameMap): TilesetDef | null {
  return project.tilesets[map.tilesetId] ?? null;
}

// 맵의 (x,y) 칸의 합성 타일 인덱스(lower + upper).
// 충돌 판정은 upper가 우선(upper에 타일이 있으면 upper, 없으면 lower).
export function tileAt(map: GameMap, x: number, y: number): {
  lower: number;
  upper: number;
} {
  if (!inBounds(map, x, y)) return { lower: -1, upper: -1 };
  const i = y * map.width + x;
  return {
    lower: topTileInStack(map, "lower", i) ?? map.lowerTiles[i],
    upper: topTileInStack(map, "upper", i) ?? map.upperTiles[i],
  };
}

// 한 타일의 합성 passability: upper가 O/X이면 덮어쓰고, ★이면 lower를 따른다.
export function tilePassability(
  tileset: TilesetDef,
  lower: number,
  upper: number
): PassFlag {
  const lp = lower >= 0 && lower < tileset.passability.length ? tileset.passability[lower] : null;
  if (!lp) return { up: false, down: false, left: false, right: false };
  if (upper < 0 || upper >= tileset.passability.length) return lp;
  const upperMark = passageMarkForTile(tileset, upper);
  if (upperMark === "star") return lp;
  const up = tileset.passability[upper];
  if (!up) return lp;
  return up;
}

// 방향 → 해당 방향으로 "나가는/들어가는" 통과 비트.
function dirPassable(pass: PassFlag, dir: Dir): boolean {
  switch (dir) {
    case "up": return pass.up;
    case "down": return pass.down;
    case "left": return pass.left;
    case "right": return pass.right;
  }
}

// (fromX,fromY)에서 (toX,toY)로 한 칸 이동 가능한가?
// RM2K3: from의 이동 방향 통과 + to의 진입 방향 통과 양쪽 체크.
export function canMove(
  project: Project,
  map: GameMap,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): boolean {
  if (!inBounds(map, toX, toY)) return false;
  const tileset = getTileset(project, map);
  if (!tileset) return false;
  // 이동 방향 결정.
  const dx = toX - fromX;
  const dy = toY - fromY;
  let dir: Dir;
  if (dx > 0) dir = "right";
  else if (dx < 0) dir = "left";
  else if (dy > 0) dir = "down";
  else if (dy < 0) dir = "up";
  else return false; // 같은 칸
  const from = tileAt(map, fromX, fromY);
  const to = tileAt(map, toX, toY);
  const fromPass = tilePassability(tileset, from.lower, from.upper);
  const toPass = tilePassability(tileset, to.lower, to.upper);
  // from에서 해당 방향으로 나갈 수 있고, to에 해당 방향으로 들어올 수 있어야 함.
  // RM2K3 관례: from의 나가는 방향 + to의 들어오는 방향(반대) 체크.
  // 단순화: from과 to 양쪽의 해당 방향 비트가 열려있으면 통과.
  return dirPassable(fromPass, dir) && dirPassable(toPass, oppositeDir(dir));
}

function oppositeDir(dir: Dir): Dir {
  switch (dir) {
    case "up": return "down";
    case "down": return "up";
    case "left": return "right";
    case "right": return "left";
  }
}

// 레거시 호환: 단순 passability(방향 무시) — EditScene 표시 등에 사용.
export function isPassable(
  project: Project,
  map: GameMap,
  x: number,
  y: number
): boolean {
  if (!inBounds(map, x, y)) return false;
  const tileset = getTileset(project, map);
  if (!tileset) return false;
  const t = tileAt(map, x, y);
  const pass = tilePassability(tileset, t.lower, t.upper);
  return pass.up || pass.down || pass.left || pass.right;
}

/**
 * 발자국 전체가 통과 가능한가. 이동 방향의 **선행 모서리**만 검사한다 —
 * 3x3 이 오른쪽으로 갈 때 새로 밟는 건 오른쪽 열 3칸뿐이고 9칸 전부가 아니다.
 *
 * `passRows` 를 주면 몸 사각이 아니라 **통행 사각**(하단 N행)으로 검사한다. 3x3 몸에
 * passRows 1 이면 발밑 한 줄만 밟으므로 상체가 걸치는 칸의 지형은 보지 않는다.
 * 생략하면 몸 사각 전체다(= 1차 동작). 2차 스펙 §3.
 *
 * canMove 와 같이 **인접 한 칸 이동**을 전제한다.
 *
 * 1x1 · **직교** 이동이면 정확히 canMove 1회 호출로 환원된다(= 기존 동작 동일).
 * 대각은 다르다: canMove 는 dx 가 0 이 아니면 가로 방향 하나만 보는데 이쪽은 H·V 두
 * 경로로 분해하므로, 두 경로가 다 막힌 대각에서 canMove 는 true, 이 함수는 false 다.
 * 지금 canMove 에 대각을 넘기는 호출부는 없다(chaseAi 는 4방향, canNpcMove·tryStartMove
 * 는 호출 전에 분해한다). 2차에서 그 자리들을 이 함수로 갈아끼울 때 이 차이를 볼 것.
 */
export function canMoveFootprint(
  project: Project,
  map: GameMap,
  fromX: number,
  fromY: number,
  fp: CharacterFootprint,
  toX: number,
  toY: number,
  passRows?: number
): boolean {
  const dx = toX - fromX;
  const dy = toY - fromY;
  if (dx === 0 && dy === 0) return false;
  if (dx !== 0 && dy !== 0) {
    // 기존 대각 관례(playSceneMovement.ts / playSceneAutonomousMapActions.ts):
    // H·V 로 분해해 둘 중 한 경로가 열려 있으면 통과한다.
    const horizontalFirst =
      canMoveFootprint(project, map, fromX, fromY, fp, fromX + dx, fromY, passRows) &&
      canMoveFootprint(project, map, fromX + dx, fromY, fp, toX, toY, passRows);
    if (horizontalFirst) return true;
    return (
      canMoveFootprint(project, map, fromX, fromY, fp, fromX, fromY + dy, passRows) &&
      canMoveFootprint(project, map, fromX, fromY + dy, fp, toX, toY, passRows)
    );
  }
  const rect = passRows === undefined
    ? footprintBounds(fromX, fromY, fp)
    : passageBounds(fromX, fromY, fp, passRows);
  return canMoveRect(project, map, rect, dx, dy);
}

/**
 * 사각의 선행 모서리가 전부 한 칸 이동 가능한가. 직교 이동만 받는다
 * (대각 분해는 canMoveFootprint 가 한다).
 *
 * 지형 통행은 **통행 사각**으로 판정한다 — 3x3 몸에 passRows 1 이면 발밑 한 줄만
 * 밟고 지나가므로 상체가 걸치는 칸의 지형은 보지 않는다. 2차 스펙 §3.
 */
export function canMoveRect(
  project: Project,
  map: GameMap,
  rect: FootprintRect,
  dx: number,
  dy: number
): boolean {
  if ((dx === 0) === (dy === 0)) return false;
  for (const cell of leadingEdgeCellsOfRect(rect, dx, dy)) {
    if (!canMove(project, map, cell.x, cell.y, cell.x + dx, cell.y + dy)) return false;
  }
  return true;
}

/** 이동 방향에서 새로 칸을 밟게 되는 사각 모서리 셀들. */
function leadingEdgeCellsOfRect(
  rect: FootprintRect,
  dx: number,
  dy: number
): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  if (dx !== 0) {
    const column = dx > 0 ? rect.right : rect.left;
    for (let cy = rect.top; cy <= rect.bottom; cy += 1) cells.push({ x: column, y: cy });
    return cells;
  }
  const row = dy > 0 ? rect.bottom : rect.top;
  for (let cx = rect.left; cx <= rect.right; cx += 1) cells.push({ x: cx, y: row });
  return cells;
}
