// project/collision.ts
// 타일 좌표 → 통과 가능 여부 판정. 순수 함수(Phaser/DOM 무관).
// v2: 4방향 passability 기반(RM2K3 정석). TilesetDef.passability 사용.
// 스펙 docs/specs/2026-06-18-oprn-overhaul-design.md §8.3.

import type { GameMap, Project, TilesetDef, Dir, PassFlag, CharacterFootprint, FootprintRect } from "./types";
import { topTileInStack } from "./mapOverlayTiles";
import { cellLayerTiles } from "./mapLayers";
import { passageMarkForTile } from "./tilesetPassage";
import { footprintBounds, passageBounds } from "./footprint";
import { reliefAllowsStep } from "./relief/walk";

// 주어진 타일 좌표가 맵 경계 안인가?
export function inBounds(map: GameMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

// 맵의 타일셋 정의 조회(편의).
export function getTileset(project: Project, map: GameMap): TilesetDef | null {
  return project.tilesets[map.tilesetId] ?? null;
}

// 맵의 (x,y) 칸의 타일. lower/upper 는 옛 스택 top 을 반영한 1·3층, layers 는 1~4층 원래 값.
// 충돌 판정은 layeredPassability(위에서부터 ★ 건너뛰기)가 한다.
export function tileAt(map: GameMap, x: number, y: number): {
  lower: number;
  upper: number;
  layers: readonly [number, number, number, number];
} {
  if (!inBounds(map, x, y)) return { lower: -1, upper: -1, layers: [-1, -1, -1, -1] };
  const i = y * map.width + x;
  const layers = cellLayerTiles(map, i);
  return {
    lower: topTileInStack(map, "lower", i) ?? layers[0],
    upper: topTileInStack(map, "upper", i) ?? layers[2],
    layers,
  };
}

const BLOCKED: PassFlag = { up: false, down: false, left: false, right: false };
const OPEN_WATER: PassFlag = { up: true, down: true, left: true, right: true };

/**
 * 칸의 통행(MZ 규칙). tiles 는 1층부터 위로. 맨 위부터 내려가며 빈칸과 ★ 를 건너뛰고,
 * 처음 만난 타일의 통행이 칸을 정한다. 1층은 ★ 여도 바닥이므로 그 자체로 정한다.
 * 1층이 비었거나 통행 정보가 없으면 막힘. 두 층([1층,-1,3층,-1])이면 옛 tilePassability 와 같다.
 * 배열을 받는 외부 호출자·테스트용이다. 뜨거운 경로는 passabilityOf / cellPassability 를 쓴다.
 */
export function layeredPassability(tileset: TilesetDef, tiles: readonly number[]): PassFlag {
  const base = tiles[0] ?? -1;
  const basePass = base >= 0 && base < tileset.passability.length ? tileset.passability[base] : null;
  if (!basePass) return { ...BLOCKED };
  for (let layer = tiles.length - 1; layer >= 1; layer -= 1) {
    const tile = tiles[layer] ?? -1;
    if (tile < 0 || tile >= tileset.passability.length) continue;
    if (passageMarkForTile(tileset, tile) === "star") continue;
    const pass = tileset.passability[tile];
    if (pass) return pass;
  }
  return basePass;
}

// 한 층이 칸을 정하는가: 범위 밖·빈칸·★·통행 정보 없음이면 null(아래 층으로 내려간다).
function decidingPass(tileset: TilesetDef, tile: number): PassFlag | null {
  if (tile < 0 || tile >= tileset.passability.length) return null;
  if (passageMarkForTile(tileset, tile) === "star") return null;
  return tileset.passability[tile] ?? null;
}

// layeredPassability 와 같은 규칙을 네 층으로 펼친 것. 막힘이면 null — 배열도 결과 객체도 만들지 않는다.
function passabilityOrNull(tileset: TilesetDef, l1: number, l2: number, l3: number, l4: number): PassFlag | null {
  const basePass = l1 >= 0 && l1 < tileset.passability.length ? tileset.passability[l1] : null;
  if (!basePass) return null;
  return decidingPass(tileset, l4) ?? decidingPass(tileset, l3) ?? decidingPass(tileset, l2) ?? basePass;
}

/** 네 층(1층부터) 통행 — layeredPassability(tileset, [l1, l2, l3, l4]) 와 같고 배열을 만들지 않는다. */
export function passabilityOf(tileset: TilesetDef, l1: number, l2: number, l3: number, l4: number): PassFlag {
  return passabilityOrNull(tileset, l1, l2, l3, l4) ?? { ...BLOCKED };
}

// 칸 i 의 네 층 값을 직접 읽는다. 옛 스택 top 이 있으면 1·3층을 대신한다(tileAt 의 lower/upper 와 같다).
function cellPassOrNull(tileset: TilesetDef, map: GameMap, i: number): PassFlag | null {
  const depth = map.terrainDesign?.waterDepth?.[i] ?? 0;
  if (depth > 0 && map.relief?.ramps?.[i] !== 9) {
    if (depth > 1) return BLOCKED;
    // Shallows replace the water floor's X; objects/upper layers still decide normally.
    return decidingPass(tileset, map.upperOverlayTiles?.[i] ?? -1)
      ?? decidingPass(tileset, map.upperTiles[i] ?? -1)
      ?? decidingPass(tileset, map.lowerOverlayTiles?.[i] ?? -1) ?? OPEN_WATER;
  }
  return passabilityOrNull(
    tileset,
    topTileInStack(map, "lower", i) ?? map.lowerTiles[i] ?? -1,
    map.lowerOverlayTiles?.[i] ?? -1,
    topTileInStack(map, "upper", i) ?? map.upperTiles[i] ?? -1,
    map.upperOverlayTiles?.[i] ?? -1,
  );
}

/** 칸 번호 i(= y*width+x) 의 통행. 1~4층과 옛 스택 top 을 모두 본다. 경계 검사는 호출자가 한다. */
export function cellPassability(tileset: TilesetDef, map: GameMap, i: number): PassFlag {
  return cellPassOrNull(tileset, map, i) ?? { ...BLOCKED };
}

// 두 층(1층 + 3층) 통행. 3층이 O/X이면 덮어쓰고, ★이면 1층을 따른다.
export function tilePassability(
  tileset: TilesetDef,
  lower: number,
  upper: number
): PassFlag {
  return passabilityOf(tileset, lower, -1, upper, -1);
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
  // 칸 밖 from 은 tileAt 처럼 네 층 모두 빈칸 → 막힘.
  const fromPass = inBounds(map, fromX, fromY) ? cellPassOrNull(tileset, map, fromY * map.width + fromX) : null;
  const toPass = cellPassOrNull(tileset, map, toY * map.width + toX);
  // 한 방향 턱: 정해진 방향이 아니면 턱 칸으로 들어설 수 없다. 정해진 방향의 진입은 주인공 이동이
  // 2칸 뛰어넘기로 가로챈다(playSceneMovement). 턱이 없는 타일셋은 이 검사가 항상 null 이다.
  const ledge = ledgeDirectionAt(tileset, map, toX, toY);
  if (ledge !== null && ledge !== dir) return false;
  // from에서 해당 방향으로 나갈 수 있고, to에 해당 방향으로 들어올 수 있어야 함.
  // RM2K3 관례: from의 나가는 방향 + to의 들어오는 방향(반대) 체크.
  // 단순화: from과 to 양쪽의 해당 방향 비트가 열려있으면 통과.
  return dirPassable(fromPass ?? BLOCKED, dir) && dirPassable(toPass ?? BLOCKED, oppositeDir(dir))
    && reliefAllowsStep(map.relief, fromX, fromY, toX, toY);
}

/**
 * 칸 (x,y) 가 한 방향 턱이면 뛰어내릴 수 있는 방향, 아니면 null. 위층부터 보고 처음 만난 턱 타일이 정한다.
 * `tileset.ledgeDirections` 가 없으면(옛 프로젝트) 곧바로 null — 기존 통행 판정과 같다.
 */
export function ledgeDirectionAt(tileset: TilesetDef, map: GameMap, x: number, y: number): Dir | null {
  const ledges = tileset.ledgeDirections;
  if (!ledges || !inBounds(map, x, y)) return null;
  const i = y * map.width + x;
  const tiles = [
    map.upperOverlayTiles?.[i] ?? -1,
    topTileInStack(map, "upper", i) ?? map.upperTiles[i] ?? -1,
    map.lowerOverlayTiles?.[i] ?? -1,
    topTileInStack(map, "lower", i) ?? map.lowerTiles[i] ?? -1,
  ];
  for (const tile of tiles) {
    if (tile < 0) continue;
    const dir = ledges[String(tile)];
    if (dir) return dir;
  }
  return null;
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
  const pass = cellPassOrNull(tileset, map, y * map.width + x);
  return pass !== null && (pass.up || pass.down || pass.left || pass.right);
}

/**
 * transfer 착지처럼 좌표를 직접 정할 때 쓰는 런타임 통행 권위.
 *
 * 왜 `isPassable` 만으로 부족한가: 한 방향 비트만 열린 타일은 레거시 OR 판정을 통과해도
 * 이웃과 비트가 맞지 않으면 네 방향 어디로도 나갈 수 없다. 런타임과 저작 검증이 이 함수를
 * 함께 써야 AI가 허용한 좌표를 플레이어가 다시 옮기는 불일치가 생기지 않는다.
 */
export function isPassableLanding(
  project: Project,
  map: GameMap,
  x: number,
  y: number
): boolean {
  if (!isPassable(project, map, x, y)) return false;
  return (
    canMove(project, map, x, y, x + 1, y) ||
    canMove(project, map, x, y, x - 1, y) ||
    canMove(project, map, x, y, x, y + 1) ||
    canMove(project, map, x, y, x, y - 1)
  );
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
