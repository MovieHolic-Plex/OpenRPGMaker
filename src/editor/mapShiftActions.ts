import { TILE } from "@/project/defaults";
import { store } from "@/project/store";
import type { GameMap, MapId } from "@/project/types";

export type MapShiftOffset = {
  readonly dx: number;
  readonly dy: number;
};

type ShiftSpec = {
  readonly dx: number;
  readonly dy: number;
  readonly height: number;
  readonly width: number;
};

export function shiftMapContent(mapId: MapId, offset: MapShiftOffset): boolean {
  const dx = Math.trunc(offset.dx);
  const dy = Math.trunc(offset.dy);
  if (dx === 0 && dy === 0) return false;

  let shifted = false;
  store.update((project) => {
    const map = project.maps[mapId];
    if (!map) return;
    const spec: ShiftSpec = { dx, dy, height: map.height, width: map.width };
    map.lowerTiles = shiftedTiles(map.lowerTiles, spec, TILE.GRASS);
    map.upperTiles = shiftedTiles(map.upperTiles, spec, TILE.EMPTY);
    replaceShiftedStacks(map, spec);
    for (const event of map.events) {
      event.x = clamp(event.x + dx, 0, map.width - 1);
      event.y = clamp(event.y + dy, 0, map.height - 1);
    }
    if (project.startMapId === mapId) {
      project.startPos = {
        x: clamp(project.startPos.x + dx, 0, map.width - 1),
        y: clamp(project.startPos.y + dy, 0, map.height - 1),
      };
    }
    shifted = true;
  });
  return shifted;
}

function shiftedTiles(source: readonly number[], spec: ShiftSpec, fillTile: number): number[] {
  const next = new Array<number>(spec.width * spec.height).fill(fillTile);
  for (let y = 0; y < spec.height; y += 1) {
    for (let x = 0; x < spec.width; x += 1) {
      const targetX = x + spec.dx;
      const targetY = y + spec.dy;
      if (!isInside(targetX, targetY, spec)) continue;
      next[targetY * spec.width + targetX] = source[y * spec.width + x] ?? fillTile;
    }
  }
  return next;
}

function replaceShiftedStacks(map: GameMap, spec: ShiftSpec): void {
  const lowerStacks = shiftedStacks(map.lowerTileStacks, spec);
  const upperStacks = shiftedStacks(map.upperTileStacks, spec);
  if (lowerStacks) map.lowerTileStacks = lowerStacks;
  else delete map.lowerTileStacks;
  if (upperStacks) map.upperTileStacks = upperStacks;
  else delete map.upperTileStacks;
}

function shiftedStacks(source: Record<number, number[]> | undefined, spec: ShiftSpec): Record<number, number[]> | undefined {
  if (!source) return undefined;
  const next: Record<number, number[]> = {};
  for (const [key, stack] of Object.entries(source)) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0) continue;
    const x = index % spec.width;
    const y = Math.floor(index / spec.width);
    const targetX = x + spec.dx;
    const targetY = y + spec.dy;
    if (!isInside(targetX, targetY, spec) || stack.length === 0) continue;
    next[targetY * spec.width + targetX] = [...stack];
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function isInside(x: number, y: number, spec: ShiftSpec): boolean {
  return x >= 0 && y >= 0 && x < spec.width && y < spec.height;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
