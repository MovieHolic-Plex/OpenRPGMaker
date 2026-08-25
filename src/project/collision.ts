// project/collision.ts
// 타일 좌표 → 통과 가능 여부 판정. 순수 함수(Phaser/DOM 무관).
// v2: 4방향 passability 기반(RM2K3 정석). TilesetDef.passability 사용.
// 스펙 docs/specs/2026-06-18-oprn-overhaul-design.md §8.3.

import type { GameMap, Project, TilesetDef, Dir, PassFlag } from "./types";
import { topTileInStack } from "./mapOverlayTiles";
import { passageMarkForTile } from "./tilesetPassage";

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
