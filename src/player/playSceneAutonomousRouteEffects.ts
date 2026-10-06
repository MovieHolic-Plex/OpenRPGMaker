import { setCharacterBaseOrigin, characterBaseOrigin } from "./characterOrigin";
import { eventSpriteScale, resolveEventSpriteTexture } from "@/player/eventSpriteResources";
import { projectReferenceTileSize } from "@/project/mapViewScale";
import { resourceDisplayName } from "@/player/resourceDisplay";
import type {
  AutonomousNpcSceneContext,
  AutonomousNpcSprite,
} from "@/player/playSceneAutonomousTypes";
import type { RuntimeEventView } from "@/project/runtimeEventState"
import { setAudioState } from "@/project/session";
import { store } from "@/project/store";

export function clampRouteRank(value: number): number {
  if (!Number.isFinite(value)) return 3;
  return Math.min(8, Math.max(1, Math.trunc(value)));
}

export function clampRouteOpacity(value: number): number {
  if (!Number.isFinite(value)) return 255;
  return Math.min(255, Math.max(0, Math.trunc(value)));
}

export function applyMoveRouteGraphicChange(
  spriteId: string,
  view: RuntimeEventView,
  sprite: AutonomousNpcSprite | undefined,
  tileSize = 16,
  mapCharacterFactor = 1,
): void {
  const normalized = spriteId.trim();
  if (!normalized || !sprite) return;
  const texture = resolveEventSpriteTexture(store.getCurrent(), normalized, view.page?.graphic.pattern);
  if (texture) {
    sprite.setTexture(texture.texture, texture.frame);
    setCharacterBaseOrigin(sprite, texture.origin);
    const origin = characterBaseOrigin(sprite);
    sprite.setOrigin(origin.x, origin.y);
    sprite.setScale?.(eventSpriteScale(texture, sprite, view.page?.graphic.scale, tileSize, view.page?.graphic.scaleMode, projectReferenceTileSize(store.getCurrent()), mapCharacterFactor));
  }
}

export function playMoveRouteSound(scene: AutonomousNpcSceneContext, resourceId: string): void {
  const normalized = resourceId.trim();
  if (!normalized) return;
  setAudioState(scene.session, { channel: "se", resourceId: normalized, loop: false });
  scene.showRuntimeOverlay?.("audio-indicator", resourceDisplayName(normalized, normalized));
}
