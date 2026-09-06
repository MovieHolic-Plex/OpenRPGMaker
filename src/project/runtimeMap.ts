import type { PlaySession } from './session';
import type { GameMap } from './types';

/** Read runtime terrain, including unloaded rooms, without modifying authored tile arrays. */
export function runtimeMap(map: GameMap, session: Pick<PlaySession, 'mapOverrides'>): GameMap {
  const overrides = session.mapOverrides[map.id];
  if (!overrides) return map;
  const projectLayer = (tiles: number[], changes: Record<number, number>): number[] => {
    const result = [...tiles];
    for (const [key, tile] of Object.entries(changes)) {
      const index = Number(key);
      if (Number.isInteger(index) && index >= 0 && index < result.length) result[index] = tile;
    }
    return result;
  };
  return { ...map, lowerTiles: projectLayer(map.lowerTiles, overrides.lower),
    upperTiles: projectLayer(map.upperTiles, overrides.upper) };
}
