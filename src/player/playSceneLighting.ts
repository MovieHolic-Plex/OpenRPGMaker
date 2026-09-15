import type Phaser from "phaser";
import { TILE_SIZE } from "@/assets/bundled";
import { PLAY_RESOLUTION } from "@/player/playResolution";
import { followerPositions } from "@/project/followers";
import {
  advanceLightingAmbientTransition,
  ensureLightingState,
  LIGHTING_FIXED_STEP_MS,
  normalizeLightingState,
  setSessionLighting,
  type LightTilePosition,
} from "@/project/lightingRules";
import {
  drawLightingMask,
  lightingGradientParams,
  lightingMaskSignature,
} from "@/player/lighting";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { LightSource, LightSourceAnchor } from "@/project/types";
import { store } from "@/project/store";
import { runtimeEventViewsForMap } from "@/project/runtimeEventState"

const LIGHTING_MASK_TEXTURE_KEY = "__oprn_lighting_mask";

export function installLightingLayer(scene: PlaySceneContext): void {
  if (scene.lightingOverlayImage && scene.lightingMaskTexture) return;
  const camera = scene.cameras.main;
  const texture = scene.textures.exists(LIGHTING_MASK_TEXTURE_KEY)
    ? (scene.textures.get(LIGHTING_MASK_TEXTURE_KEY) as Phaser.Textures.CanvasTexture)
    : scene.textures.createCanvas(
        LIGHTING_MASK_TEXTURE_KEY,
        camera.width || PLAY_RESOLUTION.width,
        camera.height || PLAY_RESOLUTION.height,
      );
  if (!texture) return;
  const overlay = scene.add.image(0, 0, LIGHTING_MASK_TEXTURE_KEY);
  overlay.setOrigin(0, 0);
  overlay.setScrollFactor(0);
  overlay.setDepth(900_000);
  overlay.setVisible(false);
  scene.lightingOverlayImage = overlay;
  scene.lightingMaskTexture = texture;
  scene.lightingMaskSignature = "";
  scene.lightingClockMs = 0;
  scene.lightingFixedAccumulatorMs = 0;
  scene.lightingTransition = null;
  scene.lightingTransitionWaiters = [];
}

export function updateLighting(scene: PlaySceneContext, deltaMs: number): void {
  installLightingLayer(scene);
  const steps = advanceFixedClock(scene, deltaMs);
  if (scene.lightingTransition) {
    for (let index = 0; index < steps && scene.lightingTransition; index += 1) {
      const next = advanceLightingAmbientTransition(scene.lightingTransition, LIGHTING_FIXED_STEP_MS);
      setSessionLighting(scene.session, { ambient: next.ambient, color: next.color });
      if (next.done) {
        setSessionLighting(scene.session, {
          ambient: scene.lightingTransition.toAmbient,
          color: scene.lightingTransition.toColor,
        });
        scene.lightingTransition = null;
        resolveLightingWaiters(scene);
      }
    }
  }
  syncLightingLayer(scene);
}

export function syncLightingLayer(scene: PlaySceneContext): void {
  installLightingLayer(scene);
  const overlay = scene.lightingOverlayImage;
  const texture = scene.lightingMaskTexture;
  if (!overlay || !texture) return;

  const lighting = ensureLightingState(scene.session);
  const camera = scene.cameras.main;
  const params = lightingGradientParams(lighting, {
    viewportWidth: camera.width || PLAY_RESOLUTION.width,
    viewportHeight: camera.height || PLAY_RESOLUTION.height,
    tileSize: TILE_SIZE,
    cameraX: camera.worldView?.x ?? camera.scrollX,
    cameraY: camera.worldView?.y ?? camera.scrollY,
    zoom: camera.zoom,
    timeMs: scene.lightingClockMs ?? 0,
    resolveAnchor: (anchor, source) => resolveLightAnchor(scene, anchor, source),
  });
  const signature = lightingMaskSignature(params);
  if (signature === scene.lightingMaskSignature) return;

  if (texture.width !== params.width || texture.height !== params.height) {
    texture.setSize(params.width, params.height);
  }
  drawLightingMask(texture.canvas, params);
  texture.refresh();
  overlay.setDisplaySize(params.width, params.height);
  overlay.setVisible(params.ambient > 0);
  scene.lightingMaskSignature = signature;
}

export function applyLightingStep(
  scene: PlaySceneContext,
  step: { readonly ambient: number; readonly color?: string; readonly transitionMs: number }
): Promise<void> {
  installLightingLayer(scene);
  const current = normalizeLightingState(scene.session.lighting);
  const durationMs = Math.max(0, Math.round(step.transitionMs));
  if (durationMs <= 0) {
    setSessionLighting(scene.session, { ambient: step.ambient, color: step.color });
    scene.lightingTransition = null;
    resolveLightingWaiters(scene);
    syncLightingLayer(scene);
    return Promise.resolve();
  }
  scene.lightingTransition = {
    fromAmbient: current.ambient,
    toAmbient: normalizeLightingState({ ambient: step.ambient, color: step.color, sources: current.sources }).ambient,
    fromColor: current.color,
    toColor: step.color,
    durationMs,
    elapsedMs: 0,
  };
  syncLightingLayer(scene);
  return new Promise((resolve) => {
    scene.lightingTransitionWaiters.push(resolve);
  });
}

function advanceFixedClock(scene: PlaySceneContext, deltaMs: number): number {
  scene.lightingFixedAccumulatorMs = (scene.lightingFixedAccumulatorMs ?? 0) + Math.max(0, deltaMs);
  let steps = 0;
  while (scene.lightingFixedAccumulatorMs >= LIGHTING_FIXED_STEP_MS) {
    scene.lightingFixedAccumulatorMs -= LIGHTING_FIXED_STEP_MS;
    scene.lightingClockMs = (scene.lightingClockMs ?? 0) + LIGHTING_FIXED_STEP_MS;
    steps += 1;
  }
  return steps;
}

function resolveLightingWaiters(scene: PlaySceneContext): void {
  const waiters = scene.lightingTransitionWaiters.splice(0);
  for (const resolve of waiters) resolve();
}

function resolveLightAnchor(
  scene: PlaySceneContext,
  anchor: LightSourceAnchor,
  _source: LightSource
): LightTilePosition | undefined {
  if (anchor === "player") return spriteToTilePosition(scene.player);
  if ("eventId" in anchor) {
    const eventSprite = scene.eventSprites.get(anchor.eventId);
    if (eventSprite) return spriteToTilePosition(eventSprite);
    const project = store.getCurrent();
    const follower = followerPositions(scene.session, project.system.companions, { project, map: scene.map }).find((entry) =>
      entry.follower.eventId === anchor.eventId || entry.follower.name === anchor.eventId
    );
    if (follower) return { x: follower.x, y: follower.y };
    const view = runtimeEventViewsForMap(project, scene.map, scene.session, scene.eventPositions)
      .find((entry) => entry.event.id === anchor.eventId);
    // 스프라이트가 없으면 뷰에서 몸 중앙을 계산한다 — spriteToTilePosition 과 같은 좌표계다
    // (중앙 타일 인덱스). Y 는 발밑이 곧 앵커라 그대로다.
    return view
      ? { x: view.bodyRect.left + view.footprint.width / 2 - 0.5, y: view.y }
      : undefined;
  }
  return { x: anchor.x, y: anchor.y };
}

function spriteToTilePosition(sprite: Phaser.GameObjects.Sprite): LightTilePosition {
  const centerX = sprite.x;
  const centerY = sprite.y - TILE_SIZE / 2;
  return {
    x: centerX / TILE_SIZE - 0.5,
    y: centerY / TILE_SIZE - 0.5,
  };
}
