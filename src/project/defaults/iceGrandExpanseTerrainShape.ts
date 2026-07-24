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

export function paintCliffFringe(lower: number[], snow: Uint8Array, basin: Uint8Array, width: number): void {
  for (let index = 0; index < lower.length; index += 1) {
    if (snow[index] === 1 || basin[index] === 1) continue;
    if (neighbors(snow, width, index, 1)) lower[index] = TOP_WALL[index % TOP_WALL.length] ?? TOP_WALL[1];
    else if (neighbors(snow, width, index, 2)) lower[index] = BODY_WALL[index % BODY_WALL.length] ?? BODY_WALL[1];
  }
}

export function paintRouteOutline(lower: number[], route: Uint8Array, node: Uint8Array, width: number): void {
  const path = new Uint8Array(route.length);
  for (let index = 0; index < path.length; index += 1) if (route[index] === 1 || node[index] === 1) path[index] = 1;
  for (let index = 0; index < path.length; index += 1) if (path[index] === 1) lower[index] = outlinedSnowTile(path, width, index);
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
