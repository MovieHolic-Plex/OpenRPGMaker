// Sparse world-anchored cloud silhouettes. Ground shading stays below weather and lighting.
import { PLAY_RESOLUTION } from "@/player/playResolution";
import { cloudShadowDrift, cloudShadowSeedForMap, normalizeCloudShadowParams, type CloudShadowParams } from "@/player/cloudShadows";
import {
  CLOUD_FIELD_SIZE, CLOUD_SHAPE_FRAMES, CLOUD_SHAPE_PERIOD_MS,
  cloudShapeTextureKey, ensureCloudShapeTextures,
} from "@/player/weather/cloudShadowTexture";
import type { PlaySceneContext } from "@/player/playSceneTypes";

export const CLOUD_SHADOW_DEPTH = 700_000;
export const CLOUD_SHADOW_TEXTURE_KEY = cloudShapeTextureKey(0);
export const CLOUD_SHADOW_TINT = 0x121c2e;

export function installCloudShadowLayer(scene: PlaySceneContext): void {
  if (scene.cloudShadowSprites) return;
  scene.cloudShadowSprites = [];
  scene.events.once("shutdown", () => { scene.cloudShadowSprites = undefined; });
  scene.cloudShadowClockMs = 0;
}

export function updateCloudShadows(scene: PlaySceneContext, deltaMs: number): void {
  installCloudShadowLayer(scene);
  scene.cloudShadowClockMs = (scene.cloudShadowClockMs ?? 0) + Math.max(0, deltaMs);
  syncCloudShadowLayer(scene);
}

export function syncCloudShadowLayer(scene: PlaySceneContext): void {
  installCloudShadowLayer(scene);
  const pool = scene.cloudShadowSprites!;
  const params = normalizeCloudShadowParams(scene.map?.cloudShadows);
  if (!params.enabled || params.opacity <= 0 || params.amount === 0) {
    for (const sprite of pool) sprite.setVisible(false);
    return;
  }
  const clock = scene.cloudShadowClockMs ?? 0;
  // Speed zero freezes shape as well as translation (the existing stationary-cloud setting).
  const shapePhase = (params.speed > 0 ? clock % CLOUD_SHAPE_PERIOD_MS : 0) / CLOUD_SHAPE_PERIOD_MS * CLOUD_SHAPE_FRAMES;
  const firstFrame = Math.floor(shapePhase);
  // 모양 여덟 장을 한 프레임에 굽지 않는다(한 장 약 40ms) — 프레임마다 한 장씩, 지금 보이는 장부터.
  // 다 구워질 때까지는 이미 있는 장만 그린다. 굽는 동안 크로스페이드 짝이 없으면 한 장만 보인다.
  if (!scene.cloudShadowTexturesReady?.has(params.amount)) {
    const ready = ensureCloudShapeTextures(scene.textures, params.amount, { budget: 1, firstFrame });
    if (ready) (scene.cloudShadowTexturesReady ??= new Set()).add(params.amount);
  }
  const mix = shapePhase - firstFrame;
  const view = cloudShadowView(scene);
  const seed = cloudShadowSeedForMap(scene.map?.id ?? "") % 256;
  const drift = cloudShadowDrift(params, scene.cloudShadowClockMs ?? 0);
  for (let index = 0; index < 2; index += 1) {
    const key = cloudShapeTextureKey((firstFrame + index) % CLOUD_SHAPE_FRAMES, params.amount);
    if (!scene.textures.exists(key)) {
      pool[index]?.setVisible(false);
      continue;
    }
    const sprite = pool[index] ?? scene.add.tileSprite(0, 0, 1, 1, key)
      .setOrigin(0).setDepth(CLOUD_SHADOW_DEPTH).setTint(CLOUD_SHADOW_TINT);
    pool[index] = sprite;
    if (sprite.texture.key !== key) sprite.setTexture(key);
    // Position cancels only the viewport crop; UVs retain world position. Panning never drags the shade.
    const x = Math.floor(view.x) - 2;
    const y = Math.floor(view.y) - 2;
    sprite.setPosition(x, y);
    const width = Math.ceil(view.width) + 4;
    const height = Math.ceil(view.height) + 4;
    if (sprite.width !== width || sprite.height !== height) sprite.setSize(width, height);
    sprite.setTileScale(params.scale * CLOUD_FIELD_SIZE / 256);
    sprite.tilePositionX = (x - drift.dx) / sprite.tileScaleX + seed + 89;
    sprite.tilePositionY = (y - drift.dy) / sprite.tileScaleY + seed * 0.7 + 43;
    // Crossfade the same silhouette, keeping overlapping solid cores at authored opacity.
    const firstAlpha = params.opacity * (1 - mix);
    const alpha = index === 0 ? firstAlpha : params.opacity * mix / (1 - firstAlpha);
    sprite.setAlpha(alpha).setVisible(alpha > 0);
  }
}

/** 이 맵의 설정을 그대로 읽는다 — QA 와 패널이 같은 값을 본다. */
export function cloudShadowLayerParams(scene: PlaySceneContext): CloudShadowParams {
  return normalizeCloudShadowParams(scene.map?.cloudShadows);
}

export function cloudShadowView(scene: PlaySceneContext): { x: number; y: number; width: number; height: number } {
  const camera = scene.cameras.main;
  return {
    x: camera.worldView?.x ?? camera.scrollX,
    y: camera.worldView?.y ?? camera.scrollY,
    width: camera.worldView?.width || camera.width || PLAY_RESOLUTION.width,
    height: camera.worldView?.height || camera.height || PLAY_RESOLUTION.height,
  };
}
