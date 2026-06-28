import { isPassable } from "@/project/collision";
import { setMapTileOverride } from "@/project/session";
import { store } from "@/project/store";
import type { MapId } from "@/project/types";
import { characterSpriteX, characterSpriteY, updateCharacterDepth } from "@/player/characterDepth";
import type { StepResult } from "@/player/interpreter";
import { applyMapOverrides, fireAutoTriggers } from "@/player/playSceneMapRuntime";
import type { PlaySceneContext } from "@/player/playSceneTypes";

export function applyChangeTileStep(
  scene: PlaySceneContext,
  step: Extract<StepResult, { kind: "changeTile" }>
): void {
  const targetMap = store.getCurrent().maps[step.mapId];
  if (!targetMap) return;
  const index = step.y * targetMap.width + step.x;
  if (index < 0 || index >= targetMap.lowerTiles.length) return;
  setMapTileOverride(scene.session, step.mapId, step.layer, index, step.tile);
  if (step.mapId === scene.getMapId()) applyMapOverrides(scene);
}

export function transferTo(scene: PlaySceneContext, mapId: MapId, x: number, y: number): void {
  const project = store.getCurrent();
  const targetMap = project.maps[mapId];
  if (!targetMap) {
    console.warn(`[player] transfer target map missing: ${mapId}`);
    return;
  }
  const destination = nearestPassableTile(project, targetMap, x, y);
  scene.loadMap(mapId);
  scene.tileX = destination.x;
  scene.tileY = destination.y;
  scene.session.x = destination.x;
  scene.session.y = destination.y;
  scene.player.setPosition(characterSpriteX(destination.x), characterSpriteY(destination.y));
  updateCharacterDepth(scene.player, "same");
  scene.moving = false;
  scene.centerCamera();
  void fireAutoTriggers(scene);
}

function nearestPassableTile(
  project: ReturnType<typeof store.getCurrent>,
  map: ReturnType<typeof store.getCurrent>["maps"][MapId],
  x: number,
  y: number
): { x: number; y: number } {
  const fx = Math.max(0, Math.min(map.width - 1, x));
  const fy = Math.max(0, Math.min(map.height - 1, y));
  if (isPassable(project, map, fx, fy)) return { x: fx, y: fy };
  for (let radius = 0; radius < Math.max(map.width, map.height); radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (isPassable(project, map, fx + dx, fy + dy)) return { x: fx + dx, y: fy + dy };
      }
    }
  }
  return { x: fx, y: fy };
}
