import { automaticCharacterScale } from "@/project/characterScale";
import { mapTileSize } from "@/project/tileGeometry";
import type { GameMap } from "@/project/types";

const appliedScales = new WeakMap<object, number>();

/** Update on map/graphic changes, without resetting active swing/jump animation every refresh. */
export function syncPlayerCharacterScale(scene: {
  readonly map: GameMap;
  readonly player?: { readonly width?: number; setScale?(scale: number): unknown };
}): void {
  const player = scene.player;
  if (!player?.setScale) return;
  const scale = automaticCharacterScale(player.width, mapTileSize(scene.map));
  if (appliedScales.get(player) === scale) return;
  player.setScale(scale);
  appliedScales.set(player, scale);
}
