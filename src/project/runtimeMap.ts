import type { PlaySession } from './session';
import type { GameMap } from './types';

/** Read runtime terrain, including unloaded rooms, without modifying authored tile arrays. */
export function runtimeMap(map: GameMap, session: Pick<PlaySession, 'mapOverrides'>): GameMap {
  if (!session.mapOverrides[map.id]) return map;
  const projected = { ...map, lowerTiles: [...map.lowerTiles], upperTiles: [...map.upperTiles] };
  applyRuntimeMapOverrides(projected, session);
  return projected;
}

/** Live scenes retain map and tile-array identity for schedules and passability consumers. */
export function applyRuntimeMapOverrides(map: GameMap, session: Pick<PlaySession, 'mapOverrides'>): void {
  const overrides = session.mapOverrides[map.id];
  if (!overrides) return;
  for (const [layer, changes] of [['lowerTiles', overrides.lower], ['upperTiles', overrides.upper]] as const) {
    for (const [key, tile] of Object.entries(changes)) {
      const index = Number(key);
      if (Number.isInteger(index) && index >= 0 && index < map[layer].length) map[layer][index] = tile;
    }
  }
}
