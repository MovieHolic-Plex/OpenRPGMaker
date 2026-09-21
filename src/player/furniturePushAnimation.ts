import { mapTileSize } from "@/project/tileGeometry";
import { characterSpriteY, footprintSpriteX, updateCharacterDepth } from './characterDepth';
import { footprintBounds, rectsOverlap } from '@/project/footprint';
import type { RuntimeEventView } from '@/project/runtimeEventState';
import type { PlaySceneContext } from './playSceneTypes';

type Push = {
  readonly view: RuntimeEventView;
  readonly dx: number;
  readonly dy: number;
  readonly frames: number;
  progress: number;
};

// Presentation only. Like NPC steps, the destination is reserved in session state
// immediately; neither fractional positions nor sprite references enter save data.
const pushes = new WeakMap<object, Push>();

export function beginFurniturePush(scene: PlaySceneContext, view: RuntimeEventView, dx: number, dy: number): void {
  pushes.set(scene, { view, dx, dy, frames: Math.round(Math.max(320, scene.moveDurationMs * 2) / (1000 / 60)), progress: 0 });
}

export function furniturePushFrames(scene: object): number | undefined {
  return pushes.get(scene)?.frames;
}

export function furniturePushPosition(scene: object, eventId: string): { x: number; y: number } | undefined {
  const push = pushes.get(scene);
  if (!push || push.view.event.id !== eventId) return undefined;
  return { x: push.view.x + push.dx * push.progress, y: push.view.y + push.dy * push.progress };
}

/** Reserve the swept footprint, including the source, while a wide object slides. */
export function furniturePushBlocks(scene: object, rect: ReturnType<typeof footprintBounds>, eventId?: string): boolean {
  const push = pushes.get(scene);
  return !!push && push.view.event.id !== eventId
    && rectsOverlap(rect, footprintBounds(push.view.x, push.view.y, push.view.footprint));
}

/** Two preparation ticks, then a shared ease-in/out for the body and furniture. */
export function advanceFurniturePush(scene: PlaySceneContext): number | undefined {
  const push = pushes.get(scene);
  if (!push) return undefined;
  const t = Math.max(0, Math.min(1, (scene.moveElapsedFrames - 2) / (push.frames - 2)));
  push.progress = t * t * (3 - 2 * t);
  const sprite = scene.eventSprites.get(push.view.event.id);
  if (sprite) {
    const position = furniturePushPosition(scene, push.view.event.id)!;
    sprite.x = footprintSpriteX(position.x, push.view.footprint, mapTileSize(scene.map));
    sprite.y = characterSpriteY(position.y, mapTileSize(scene.map));
    updateCharacterDepth(sprite, push.view.priority);
  }
  return push.progress;
}

export function clearFurniturePush(scene: object): void {
  pushes.delete(scene);
}

/** Command cancellation rolls both participants back together. Map loads simply clear. */
export function cancelFurniturePush(scene: PlaySceneContext): void {
  const push = pushes.get(scene);
  if (!push) return;
  const id = push.view.event.id;
  const current = scene.session.eventLocations[id];
  if (current?.mapId === scene.map.id && current.x === push.view.x + push.dx && current.y === push.view.y + push.dy) {
    scene.session.eventLocations[id] = { ...current, x: push.view.x, y: push.view.y };
    scene.eventPositions[id] = { x: push.view.x, y: push.view.y, direction: push.view.direction };
    const sprite = scene.eventSprites.get(id);
    if (sprite) {
      sprite.x = footprintSpriteX(push.view.x, push.view.footprint, mapTileSize(scene.map));
      sprite.y = characterSpriteY(push.view.y, mapTileSize(scene.map));
      updateCharacterDepth(sprite, push.view.priority);
    }
  }
  clearFurniturePush(scene);
}
