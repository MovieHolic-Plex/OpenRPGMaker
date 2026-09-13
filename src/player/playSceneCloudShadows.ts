// player/playSceneCloudShadows.ts
// 구름 그림자 레이어. 계산은 cloudShadows.ts 의 순수 함수가 소유하고, 이 파일은 그 결과를
// Phaser 스프라이트로 그린다.
//
// 구름은 **월드 좌표**에 놓인다(scrollFactor 기본값 1). 카메라가 움직이면 그림자도 같이
// 밀려 지나간다 — 화면에 매달린 효과가 아니라 땅에 드리운 그늘이다. 덩어리 하나는
// 소프트 그라디언트 텍스처를 늘린 검은 스프라이트라, 겹치면 진해지고 혼자면 옅다.

import type Phaser from "phaser";
import { PLAY_RESOLUTION } from "@/player/playResolution";
import {
  cloudShadowBlobs,
  cloudShadowSeedForMap,
  normalizeCloudShadowParams,
  type CloudShadowParams,
} from "@/player/cloudShadows";
import type { PlaySceneContext } from "@/player/playSceneTypes";

/** 상층 타일·캐릭터(25만)보다 위, 맵 애니메이션·날씨(80만)·시간 틴트·조명(90만)보다 아래. */
export const CLOUD_SHADOW_DEPTH = 700_000;
export const CLOUD_SHADOW_TEXTURE_KEY = "__rpg_zzu_cloud_shadow_blob";
/** 텍스처 한 변(px). 그라디언트 반지름은 이 값의 절반이다. */
const CLOUD_SHADOW_TEXTURE_SIZE = 256;

export function installCloudShadowLayer(scene: PlaySceneContext): void {
  if (scene.cloudShadowSprites) return;
  ensureCloudShadowTexture(scene);
  scene.cloudShadowSprites = [];
  scene.cloudShadowClockMs = 0;
}

export function updateCloudShadows(scene: PlaySceneContext, deltaMs: number): void {
  installCloudShadowLayer(scene);
  scene.cloudShadowClockMs = (scene.cloudShadowClockMs ?? 0) + Math.max(0, deltaMs);
  syncCloudShadowLayer(scene);
}

/** 맵 전환·설정 변경 직후에도 같은 자리에서 다시 계산한다. 꺼져 있으면 전부 감춘다. */
export function syncCloudShadowLayer(scene: PlaySceneContext): void {
  installCloudShadowLayer(scene);
  const pool = scene.cloudShadowSprites;
  if (!pool) return;
  const params = normalizeCloudShadowParams(scene.map?.cloudShadows);
  if (!params.enabled || params.opacity <= 0) {
    for (const sprite of pool) sprite.setVisible(false);
    return;
  }

  const blobs = cloudShadowBlobs(
    params,
    scene.cloudShadowClockMs ?? 0,
    cloudShadowView(scene),
    cloudShadowSeedForMap(scene.map?.id ?? ""),
  );
  for (let index = 0; index < blobs.length; index += 1) {
    const blob = blobs[index]!;
    const sprite = pool[index] ?? createCloudShadowSprite(scene, index);
    if (!sprite) continue;
    sprite.setPosition(blob.x, blob.y);
    sprite.setDisplaySize(blob.radius * 2, blob.radius * 2 * blob.squash);
    sprite.setRotation((blob.rotationDeg * Math.PI) / 180);
    sprite.setAlpha(blob.alpha);
    sprite.setVisible(true);
  }
  for (let index = blobs.length; index < pool.length; index += 1) pool[index]?.setVisible(false);
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

function createCloudShadowSprite(scene: PlaySceneContext, index: number): Phaser.GameObjects.Image | null {
  const pool = scene.cloudShadowSprites;
  if (!pool) return null;
  const sprite = scene.add.image(0, 0, CLOUD_SHADOW_TEXTURE_KEY);
  sprite.setOrigin(0.5, 0.5);
  sprite.setDepth(CLOUD_SHADOW_DEPTH);
  // 텍스처는 흰색 + 알파만 쓴다. 검정 틴트가 곧 «그늘» 이다.
  sprite.setTint(0x000000);
  sprite.setVisible(false);
  pool[index] = sprite;
  return sprite;
}

/** 부드러운 방사 그라디언트 하나. 늘려 쓰므로 타원이 되어도 가장자리가 뭉개지지 않는다. */
function ensureCloudShadowTexture(scene: PlaySceneContext): void {
  if (scene.textures.exists(CLOUD_SHADOW_TEXTURE_KEY)) return;
  const texture = scene.textures.createCanvas(CLOUD_SHADOW_TEXTURE_KEY, CLOUD_SHADOW_TEXTURE_SIZE, CLOUD_SHADOW_TEXTURE_SIZE);
  if (!texture) return;
  const context = texture.canvas.getContext("2d");
  if (!context) return;
  const radius = CLOUD_SHADOW_TEXTURE_SIZE / 2;
  const gradient = context.createRadialGradient(radius, radius, 0, radius, radius, radius);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.45, "rgba(255,255,255,0.62)");
  gradient.addColorStop(0.75, "rgba(255,255,255,0.24)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, CLOUD_SHADOW_TEXTURE_SIZE, CLOUD_SHADOW_TEXTURE_SIZE);
  texture.refresh();
}
