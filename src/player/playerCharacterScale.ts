import { mapCharacterScale, mapCharacterSizeFactor } from "@/project/characterScale";
import { projectReferenceTileSize } from "@/project/mapViewScale";
import { store } from "@/project/store";
import { mapTileSize } from "@/project/tileGeometry";
import type { GameMap } from "@/project/types";

const appliedScales = new WeakMap<object, number>();

/** The player's map-derived scale; swing/jump tweens return to this value. */
export function playerCharacterScale(scene: {
  readonly map: GameMap;
  readonly player?: { readonly width?: number };
}): number {
  return mapCharacterScale(scene.player?.width, mapTileSize(scene.map), projectReferenceTileSize(store.getCurrent())) * mapCharacterSizeFactor(scene.map);
}

/** Update on map/graphic changes, without resetting active swing/jump animation every refresh. */
export function syncPlayerCharacterScale(scene: {
  readonly map: GameMap;
  readonly player?: { readonly width?: number; setScale?(scale: number): unknown };
}): void {
  const player = scene.player;
  if (!player?.setScale) return;
  const scale = playerCharacterScale(scene);
  if (appliedScales.get(player) === scale) return;
  player.setScale(scale);
  appliedScales.set(player, scale);
}
