import type { GameMap } from "./types";
import { DEFAULT_TERRAIN_GAMEPLAY } from "./terrainDesign";
import { cellLift, reliefLiftField } from "./relief/screen";
export interface TerrainSightPoint { x: number; y: number }
export function terrainHeight(map: GameMap, x: number, y: number): number {
  return map.relief ? cellLift(reliefLiftField(map.relief), x, y) : 0;
}
export function terrainVisionRange(map: GameMap, origin: TerrainSightPoint, base: number): number {
  const g = map.terrainDesign?.gameplay;
  return Math.min(64, base + (g?.highGroundVision ? terrainHeight(map, origin.x, origin.y) * g.visionGain : 0));
}
/** Supercover ray. Both cells touched at a grid corner must be below the interpolated eye line. */
export function terrainLineOfSight(map: GameMap, from: TerrainSightPoint, to: TerrainSightPoint): boolean {
  const g = map.terrainDesign?.gameplay;
  if (!g?.visionBlocking) return true;
  const dx = to.x - from.x, dy = to.y - from.y, length2 = dx * dx + dy * dy;
  if (!length2) return true;
  const eye = terrainHeight(map, from.x, from.y) + g.eyeHeight, target = terrainHeight(map, to.x, to.y) + g.eyeHeight;
  const clear = (x: number, y: number) => {
    if (x === from.x && y === from.y || x === to.x && y === to.y) return true;
    const t = Math.max(0, Math.min(1, ((x - from.x) * dx + (y - from.y) * dy) / length2));
    return terrainHeight(map, x, y) < eye + (target - eye) * t;
  };
  const nx = Math.abs(dx), ny = Math.abs(dy), sx = Math.sign(dx), sy = Math.sign(dy);
  let x = from.x, y = from.y, ix = 0, iy = 0;
  while (ix < nx || iy < ny) {
    const a = (1 + 2 * ix) * ny, b = (1 + 2 * iy) * nx;
    if (a === b) { if (!clear(x + sx, y) || !clear(x, y + sy)) return false; x += sx; y += sy; ix++; iy++; }
    else if (a < b) { x += sx; ix++; } else { y += sy; iy++; }
    if (!clear(x, y)) return false;
  }
  return true;
}
export function terrainVisibleCells(map: GameMap, origin: TerrainSightPoint): Set<number> {
  const g = map.terrainDesign?.gameplay ?? DEFAULT_TERRAIN_GAMEPLAY, range = terrainVisionRange(map, origin, g.visionRadius), out = new Set<number>();
  for (let y = Math.max(0, Math.ceil(origin.y - range)); y <= Math.min(map.height - 1, Math.floor(origin.y + range)); y++) for (let x = Math.max(0, Math.ceil(origin.x - range)); x <= Math.min(map.width - 1, Math.floor(origin.x + range)); x++) {
    if (Math.hypot(x - origin.x, y - origin.y) <= range && terrainLineOfSight(map, origin, { x, y })) out.add(y * map.width + x);
  }
  return out;
}
export function terrainBlocksProjectile(map: GameMap, x: number, y: number, flightHeight: number): boolean {
  return map.terrainDesign?.gameplay?.projectileHeight === true && terrainHeight(map, x, y) >= flightHeight;
}
