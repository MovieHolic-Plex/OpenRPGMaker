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
  CLOUD_SHADOW_LOBE_CORE_FRACTION,
  CLOUD_SHADOW_SILHOUETTE_COUNT,
  cloudShadowBlobs,
  cloudShadowSeedForMap,
  cloudShadowSilhouette,
  normalizeCloudShadowParams,
  type CloudShadowParams,
} from "@/player/cloudShadows";
import type { PlaySceneContext } from "@/player/playSceneTypes";

/** 상층 타일·캐릭터(25만)보다 위, 맵 애니메이션·날씨(80만)·시간 틴트·조명(90만)보다 아래. */
export const CLOUD_SHADOW_DEPTH = 700_000;
export const CLOUD_SHADOW_TEXTURE_KEY = "__rpg_zzu_cloud_shadow_blob";
/** 텍스처 한 변(px). 실루엣은 이 상자를 가득 채운다. */
const CLOUD_SHADOW_TEXTURE_SIZE = 256;
/**
 * 그늘의 색. 순수 검정은 RGB 를 같은 비율로 깎아 채도까지 죽인다(실측: 잔디가 진흙색으로 내려앉는다).
 * 그늘에 남는 빛은 하늘빛이라 짙은 남색으로 깔아야 색이 살아있다.
 */
export const CLOUD_SHADOW_TINT = 0x121c2e;

export function installCloudShadowLayer(scene: PlaySceneContext): void {
  if (scene.cloudShadowSprites) return;
  ensureCloudShadowTextures(scene);
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
    // 풀은 재사용되므로 덩어리가 바뀌면 실루엣도 같이 바꿔야 한다.
    const textureKey = cloudShadowTextureKey(blob.variant);
    if (sprite.texture?.key !== textureKey && scene.textures.exists(textureKey)) sprite.setTexture(textureKey);
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
  const sprite = scene.add.image(0, 0, cloudShadowTextureKey(0));
  sprite.setOrigin(0.5, 0.5);
  sprite.setDepth(CLOUD_SHADOW_DEPTH);
  // 텍스처는 흰색 + 알파만 쓴다. 틴트가 곧 «그늘의 색» 이다.
  sprite.setTint(CLOUD_SHADOW_TINT);
  sprite.setVisible(false);
  pool[index] = sprite;
  return sprite;
}

/** 변주 번호 → 텍스처 이름. 0번은 예전 이름을 그대로 써 밖에서 참조하던 키를 깨지 않는다. */
function cloudShadowTextureKey(variant: number): string {
  const index = Math.abs(Math.trunc(variant)) % CLOUD_SHADOW_SILHOUETTE_COUNT;
  return index === 0 ? CLOUD_SHADOW_TEXTURE_KEY : `${CLOUD_SHADOW_TEXTURE_KEY}_${index}`;
}

function ensureCloudShadowTextures(scene: PlaySceneContext): void {
  for (let variant = 0; variant < CLOUD_SHADOW_SILHOUETTE_COUNT; variant += 1) {
    ensureCloudShadowTexture(scene, variant);
  }
}

/**
 * 순수 모델의 로브 합집합을 알파 텍스처로 굽는다. 로브마다 코어는 평평하고 바깥만 흐려,
 * 합집합의 윤곽은 울퉁불퉁하되 안쪽은 고른 그늘이 된다 — 원 하나짜리 그라디언트와의 핵심 차이다.
 */
function ensureCloudShadowTexture(scene: PlaySceneContext, variant: number): void {
  const key = cloudShadowTextureKey(variant);
  if (scene.textures.exists(key)) return;
  const texture = scene.textures.createCanvas(key, CLOUD_SHADOW_TEXTURE_SIZE, CLOUD_SHADOW_TEXTURE_SIZE);
  if (!texture) return;
  const context = texture.canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, CLOUD_SHADOW_TEXTURE_SIZE, CLOUD_SHADOW_TEXTURE_SIZE);
  for (const lobe of cloudShadowSilhouette(variant)) {
    const cx = lobe.cx * CLOUD_SHADOW_TEXTURE_SIZE;
    const cy = lobe.cy * CLOUD_SHADOW_TEXTURE_SIZE;
    const radius = lobe.radius * CLOUD_SHADOW_TEXTURE_SIZE;
    const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(CLOUD_SHADOW_LOBE_CORE_FRACTION, "rgba(255,255,255,1)");
    gradient.addColorStop(Math.min(0.93, CLOUD_SHADOW_LOBE_CORE_FRACTION + 0.22), "rgba(255,255,255,0.55)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.fill();
  }
  texture.refresh();
}
