import type { PlaySession } from './session';
import type { GameMap } from './types';
import { layerTileAt, setLayerTileAt } from './mapLayers';
import { cloneTerrainDesign } from './terrainDesign';

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
  let copiedWater = false;
  for (const [layer, changes] of [[1, overrides.lower], [3, overrides.upper]] as const) {
    for (const [key, tile] of Object.entries(changes)) {
      const index = Number(key);
      if (Number.isInteger(index) && index >= 0 && index < map.width * map.height) {
        if (layer === 1 && tile !== layerTileAt(map, 1, index) && map.terrainDesign?.waterDepth?.[index]) {
          if (!copiedWater) { map.terrainDesign = cloneTerrainDesign(map.terrainDesign)!; copiedWater = true; }
          map.terrainDesign.waterDepth![index] = 0;
        }
        setLayerTileAt(map, layer, index, tile);
      }
    }
  }
}
