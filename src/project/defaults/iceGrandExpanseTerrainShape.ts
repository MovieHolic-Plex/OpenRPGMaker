import { ICE_DIAGONAL_TILES } from "@/project/defaults/iceDiagonalTerrain";
import type { IceGrandExpanseTerrainBarrier } from "@/project/defaults/iceGrandExpansePlan";

const TOP_WALL = [372, 373, 374] as const;
const BODY_WALL = [402, 403, 404] as const;
const SNOW = { nw: 36, n: 37, ne: 38, w: 66, floor: 67, e: 68, sw: 96, s: 97, se: 98 } as const;

function neighbors(mask: Uint8Array, width: number, index: number, radius: number): boolean {
  const height = mask.length / width;
  const x = index % width;
  const y = Math.floor(index / width);
  for (let dy = -radius; dy <= radius; dy += 1) for (let dx = -radius; dx <= radius; dx += 1) {
    const nx = x + dx;
    const ny = y + dy;
    if ((dx !== 0 || dy !== 0) && nx >= 0 && ny >= 0 && nx < width && ny < height && mask[ny * width + nx] === 1) return true;
  }
  return false;
}

export function outlinedSnowTile(mask: Uint8Array, width: number, index: number): number {
  const x = index % width;
  const y = Math.floor(index / width);
  const north = y > 0 && mask[index - width] === 1;
  const south = y + 1 < mask.length / width && mask[index + width] === 1;
  const west = x > 0 && mask[index - 1] === 1;
  const east = x + 1 < width && mask[index + 1] === 1;
  if (!north && !west) return SNOW.nw;
  if (!north && !east) return SNOW.ne;
  if (!south && !west) return SNOW.sw;
  if (!south && !east) return SNOW.se;
  if (!west) return SNOW.w;
  if (!east) return SNOW.e;
  if (!north) return SNOW.n;
  if (!south) return SNOW.s;
  return SNOW.floor;
}

export function fillSmallVoids(snow: Uint8Array, basin: Uint8Array, width: number, minimum: number): void {
  const height = snow.length / width;
  const seen = new Uint8Array(snow.length);
  for (let origin = 0; origin < snow.length; origin += 1) {
    if (snow[origin] === 1 || basin[origin] === 1 || seen[origin] === 1) continue;
    let edge = false;
    const cells = [origin];
    seen[origin] = 1;
    for (let cursor = 0; cursor < cells.length; cursor += 1) {
      const index = cells[cursor];
      if (index === undefined) continue;
      const x = index % width;
      const y = Math.floor(index / width);
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) edge = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (seen[next] === 1 || snow[next] === 1 || basin[next] === 1) continue;
        seen[next] = 1;
        cells.push(next);
      }
    }
    if (!edge && cells.length < minimum) for (const index of cells) snow[index] = 1;
  }
}

/**
 * 절뱽 페이스를 눈밭 주변에 두 겹으로 둘린다. 링1 = 상단, 링2 = 밑동.
 *
 * 조각 선택은 **가로 위치**로 한다. 1차 판은 `index % 3` 이었고, 그것은 타일 번호와
 * 지형이 무관하다는 뜻이다 — 374(오른 끝) 옆에 372(왼 끝)가 붙는 9슬라이스 위반이 생긴다
 * (실측: 한 맵에서 195쌍). 이제 같은 역할이 가로로 이어지는 구간의 양 끝만 끝 조각이다.
 */
export function paintCliffFringe(lower: number[], snow: Uint8Array, basin: Uint8Array, width: number): void {
  const role = new Int8Array(lower.length);
  for (let index = 0; index < lower.length; index += 1) {
    if (snow[index] === 1 || basin[index] === 1) continue;
    if (neighbors(snow, width, index, 1)) role[index] = 1;
    else if (neighbors(snow, width, index, 2)) role[index] = 2;
  }
  for (let index = 0; index < lower.length; index += 1) {
    const kind = role[index];
    if (kind !== 1 && kind !== 2) continue;
    const x = index % width;
    const sameWest = x > 0 && role[index - 1] === kind;
    const sameEast = x + 1 < width && role[index + 1] === kind;
    const piece = !sameWest ? 0 : !sameEast ? 2 : 1;
    const set = kind === 1 ? TOP_WALL : BODY_WALL;
    lower[index] = set[piece] ?? set[1];
  }
}

export function paintRouteOutline(lower: number[], route: Uint8Array, node: Uint8Array, width: number): void {
  const path = new Uint8Array(route.length);
  for (let index = 0; index < path.length; index += 1) if (route[index] === 1 || node[index] === 1) path[index] = 1;
  for (let index = 0; index < path.length; index += 1) if (path[index] === 1) lower[index] = outlinedSnowTile(path, width, index);
}

const CLIFF_TOPS: readonly number[] = [372, 373, 374];

/** 대각 뱙벽 밑동 — 이 타일 밑 행은 정본 규칙이 눈을 요구하므로 립을 깔지 않는다. */
const DIAGONAL_BASES: readonly number[] = [ICE_DIAGONAL_TILES.left.base, ICE_DIAGONAL_TILES.right.base];

/**
 * 절뱽 상단 바로 위 칸이 **바닥**이라면 평지 립 343 으로 바꾼다.
 *
 * 눈밭 9슬라이스가 깔는 남변 97 은 벌 윗선과 `97 ↓ 373` = 173 으로 부딪치고,
 * 343 은 `343 ↓ 373` = 38 로 이어진다(실측 · 64×64 와 같은 근거).
 *
 * 안 바꾸는 칸이 둘 있다:
 *  · 바닥(눈 마스크)이 아닌 칸 — 343 은 통행 `o` 라 벽에 깔면 절뱽이 뚫린다.
 *  · 대각 밑동(346/347) 바로 아랫 행 — 정본 검증기의 `*-base-needs-snow-support` 가
 *    그 행을 눈 계열로 제한한다. 여기에 343 을 깔았다가 실제로 거부당해서 막은 것이다.
 */
export function paintCliffLip(lower: number[], snow: Uint8Array, width: number, lipTile: number): number {
  let painted = 0;
  for (let index = width; index < lower.length; index += 1) {
    if (!CLIFF_TOPS.includes(lower[index] ?? -1)) continue;
    const lip = index - width;
    if (snow[lip] !== 1) continue;
    if (CLIFF_TOPS.includes(lower[lip] ?? -1)) continue;
    if (lip >= width && DIAGONAL_BASES.includes(lower[lip - width] ?? -1)) continue;
    lower[lip] = lipTile;
    painted += 1;
  }
  return painted;
}

function barrierCells(barrier: IceGrandExpanseTerrainBarrier): readonly (readonly [number, number])[] {
  const cells: [number, number][] = [];
  for (let point = 1; point < barrier.waypoints.length; point += 1) {
    const from = barrier.waypoints[point - 1];
    const to = barrier.waypoints[point];
    if (from === undefined || to === undefined) continue;
    const steps = Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1]));
    let previousY = from[1];
    for (let step = 0; step <= steps; step += 1) {
      const x = Math.round(from[0] + ((to[0] - from[0]) * step) / steps);
      const y = Math.round(from[1] + ((to[1] - from[1]) * step) / steps);
      for (let fillY = Math.min(previousY, y); fillY <= Math.max(previousY, y); fillY += 1) cells.push([x, fillY]);
      previousY = y;
    }
  }
  return cells;
}

export function paintBarriers(input: {
  readonly upper: number[];
  readonly passable: Uint8Array;
  readonly barriers: readonly IceGrandExpanseTerrainBarrier[];
  readonly clearings: readonly (readonly [number, number])[];
  readonly width: number;
}): void {
  const protectedCells = new Set(input.clearings.map(([x, y]) => y * input.width + x));
  for (const barrier of input.barriers) {
    const paintCell = (x: number, y: number, depth: number): void => {
      if (x === barrier.opening[0]) return;
      const index = (y + depth) * input.width + x;
      if (protectedCells.has(index)) return;
      input.upper[index] = (depth === 0 ? TOP_WALL : BODY_WALL)[x % 3] ?? 373;
      input.passable[index] = 0;
    };
    for (const [x, y] of barrierCells(barrier)) for (let depth = 0; depth < 2; depth += 1) paintCell(x, y, depth);
    for (let x = barrier.collisionSpine.minX; x <= barrier.collisionSpine.maxX; x += 1) {
      for (let depth = 0; depth < barrier.collisionSpine.depth; depth += 1) paintCell(x, barrier.collisionSpine.topY, depth);
    }
  }
}
