import { eventSpriteScale, resolveEventSpriteTexture } from "@/player/eventSpriteResources";
import { isGeneratedMonsterSprite } from "@/assets/generatedMonsterSprites";
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
  sprite: AutonomousNpcSprite | undefined
): void {
  const normalized = spriteId.trim();
  if (!normalized || !sprite) return;
  const texture = resolveEventSpriteTexture(store.getCurrent(), normalized, view.page?.graphic.pattern);
  if (texture) {
    const wasMonster = isGeneratedMonsterSprite(sprite.texture.key);
    sprite.setTexture(texture.texture, texture.frame);
    if (texture.fitSize || wasMonster) sprite.setScale?.(eventSpriteScale(texture, sprite, view.scale));
  }
}

export function playMoveRouteSound(scene: AutonomousNpcSceneContext, resourceId: string): void {
  const normalized = resourceId.trim();
  if (!normalized) return;
  setAudioState(scene.session, { channel: "se", resourceId: normalized, loop: false });
  scene.showRuntimeOverlay?.("audio-indicator", resourceDisplayName(normalized, normalized));
}
