import type { PlaySession } from './session';
import type { GameMap } from './types';
import { layerTileAt, setLayerTileAt } from './mapLayers';
import { cloneTerrainDesign } from './terrainDesign';

/** Read runtime terrain, including unloaded rooms, without modifying authored tile arrays. */
export function runtimeMap(map: GameMap, session: Pick<PlaySession, 'mapOverrides'>): GameMap {
  if (!session.mapOverrides[map.id]) return map;
  // 2·4층 배열도 복사한다 — setLayerTileAt 이 제자리에서 쓰므로 공유하면 저작 원본이 오염된다.
  const projected = {
    ...map,
    lowerTiles: [...map.lowerTiles],
    upperTiles: [...map.upperTiles],
    ...(map.lowerOverlayTiles ? { lowerOverlayTiles: [...map.lowerOverlayTiles] } : {}),
    ...(map.upperOverlayTiles ? { upperOverlayTiles: [...map.upperOverlayTiles] } : {}),
  };
  applyRuntimeMapOverrides(projected, session);
  return projected;
}

/** Live scenes retain map and tile-array identity for schedules and passability consumers. */
export function applyRuntimeMapOverrides(map: GameMap, session: Pick<PlaySession, 'mapOverrides'>): void {
  const overrides = session.mapOverrides[map.id];
  if (!overrides) return;
  let copiedWater = false;
  for (const [layer, changes] of [[1, overrides.lower], [2, overrides.lower2], [3, overrides.upper], [4, overrides.upper2]] as const) {
    if (!changes) continue;
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
