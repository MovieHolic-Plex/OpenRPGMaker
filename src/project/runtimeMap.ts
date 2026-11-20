import type { PlaySessionLike } from './sessionRuntimeTypes';
import type { GameMap } from './types';
import { layerTileAt, setLayerTileAt } from './mapLayers';
import { invalidateSightBlocker } from './sightBlockers';
import { cloneTerrainDesign } from './terrainDesign';

/** Read runtime terrain, including unloaded rooms, without modifying authored tile arrays. */
export function runtimeMap(map: GameMap, session: Pick<PlaySessionLike, 'mapOverrides'>): GameMap {
  if (!session.mapOverrides?.[map.id]) return map;
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
export function applyRuntimeMapOverrides(map: GameMap, session: Pick<PlaySessionLike, 'mapOverrides'>, groundCover?: (tile: number) => boolean): void {
  const overrides = session.mapOverrides?.[map.id];
  if (!overrides) return;
  let copiedWater = false;
  let sightChanged = false;
  for (const [layer, changes] of [[1, overrides.lower], [2, overrides.lower2], [3, overrides.upper], [4, overrides.upper2]] as const) {
    if (!changes) continue;
    for (const [key, tile] of Object.entries(changes)) {
      const index = Number(key);
      if (Number.isInteger(index) && index >= 0 && index < map.width * map.height) {
        const changed = tile !== layerTileAt(map, layer, index);
        // 방 사이에서는 네 층의 통행 판정이 시야에도 쓰인다.
        if (changed) sightChanged = true;
        if (layer === 1 && changed && map.terrainDesign?.waterDepth?.[index]) {
          if (!copiedWater) { map.terrainDesign = cloneTerrainDesign(map.terrainDesign)!; copiedWater = true; }
          map.terrainDesign.waterDepth![index] = 0;
        }
        // 바닥 덧그림(풀 결 등 — groundCover)은 그 밑 바닥의 한 부분: 이벤트가 바닥 칸을 바꾸면 같이 걷는다(안 걷으면 새 바닥이 덧그림에 가린다)
        if (layer === 1 && groundCover && changed && overrides.lower2?.[index] === undefined && groundCover(layerTileAt(map, 2, index))) setLayerTileAt(map, 2, index, -1);
        setLayerTileAt(map, layer, index, tile);
      }
    }
  }
  if (sightChanged) invalidateSightBlocker(map);
}
