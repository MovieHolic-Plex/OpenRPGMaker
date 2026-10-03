import type { GameMap, TilesetDef } from "./types";
import { layerTileAt } from "./mapLayers";
import { autotileGroupsForTileset } from "./defaults/autotileGroups";
import { DEFAULT_TERRAIN_GAMEPLAY } from "./terrainDesign";
import { cellLift, reliefLiftField } from "./relief/screen";
export interface TerrainSightPoint { x: number; y: number }
const obstacles = new WeakMap<TilesetDef, Set<number>>();
/** Passage is a fallback for unnamed walls, but water and walkable decorations never cast a wall shadow. */
function opaqueTiles(tileset: TilesetDef): Set<number> {
  const old = obstacles.get(tileset); if (old) return old;
  const water = new Set(autotileGroupsForTileset(tileset).filter(g => /water|river|lake|lava|물|호수|강물/i.test(`${g.id} ${g.name}`)).flatMap(g => g.memberTileIds));
  const out = new Set<number>();
  for (let i = 0; i < tileset.passability.length; i++) {
    const meta = tileset.tileMeta?.[i], name = `${meta?.role ?? ""} ${meta?.label ?? ""} ${meta?.tags?.join(" ") ?? ""}`, f = tileset.passability[i];
    if (water.has(i) || /water|river|lake|lava|물|호수|강물/i.test(name)) continue;
    if (/ground|floor|grass|road|path|바닥|잔디|길|풀밭/i.test(name)) continue;
    if (/(?:^|[ .:-])(wall|roof|canopy|tree|forest)(?:$|[ .:_-])|벽|지붕|수관|나무/i.test(name) || f && !f.up && !f.down && !f.left && !f.right) out.add(i);
  }
  obstacles.set(tileset, out); return out;
}
export function terrainSightObstacle(map: GameMap, x: number, y: number, tileset?: TilesetDef): boolean {
  if (!tileset || x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  const opaque = opaqueTiles(tileset), i = y * map.width + x;
  return ([1, 2, 3, 4] as const).some(layer => opaque.has(layerTileAt(map, layer, i)));
}
export function terrainHeight(map: GameMap, x: number, y: number): number {
  return map.relief ? cellLift(reliefLiftField(map.relief), x, y) : 0;
}
export function terrainVisionRange(map: GameMap, origin: TerrainSightPoint, base: number): number {
  const g = map.terrainDesign?.gameplay;
  return Math.min(64, base + (g?.highGroundVision ? terrainHeight(map, origin.x, origin.y) * g.visionGain : 0));
}
/** Supercover ray at the observer's eye height: high ground can see down across its own plateau. */
export function terrainLineOfSight(map: GameMap, from: TerrainSightPoint, to: TerrainSightPoint, tileset?: TilesetDef): boolean {
  const g = map.terrainDesign?.gameplay;
  if (!g?.visionBlocking) return true;
  // Callers may supply interpolated NPC positions; the ray traverses cell centers.
  from = { x: Math.floor(from.x), y: Math.floor(from.y) }; to = { x: Math.floor(to.x), y: Math.floor(to.y) };
  const dx = to.x - from.x, dy = to.y - from.y, length2 = dx * dx + dy * dy;
  if (!length2) return true;
  const eye = terrainHeight(map, from.x, from.y) + g.eyeHeight;
  // The target's own raised cell is not a hole in the cliff occlusion test.
  if (terrainHeight(map, to.x, to.y) > eye) return false;
  const clear = (x: number, y: number) => {
    if (x === from.x && y === from.y || x === to.x && y === to.y) return true;
    return !terrainSightObstacle(map, x, y, tileset) && terrainHeight(map, x, y) < eye;
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
export function terrainVisibleCells(map: GameMap, origin: TerrainSightPoint, tileset?: TilesetDef): Set<number> {
  const g = map.terrainDesign?.gameplay ?? DEFAULT_TERRAIN_GAMEPLAY, range = terrainVisionRange(map, origin, g.visionRadius), out = new Set<number>();
  for (let y = Math.max(0, Math.ceil(origin.y - range)); y <= Math.min(map.height - 1, Math.floor(origin.y + range)); y++) for (let x = Math.max(0, Math.ceil(origin.x - range)); x <= Math.min(map.width - 1, Math.floor(origin.x + range)); x++) {
    if (Math.hypot(x - origin.x, y - origin.y) <= range && terrainLineOfSight(map, origin, { x, y }, tileset)) out.add(y * map.width + x);
  }
  return out;
}
export function terrainBlocksProjectile(map: GameMap, x: number, y: number, flightHeight: number): boolean {
  return map.terrainDesign?.gameplay?.projectileHeight === true && terrainHeight(map, x, y) >= flightHeight;
}
