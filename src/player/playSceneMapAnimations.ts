import { mapTileSize } from "@/project/tileGeometry";
import type Phaser from "phaser";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { playAudioCommand } from "@/player/audio";
import {
  battleAnimationDurationMs,
  battleAnimationFrameDurationMs,
  battleAnimationSheetRmScale,
} from "@/player/battleAnimationPlayback";
import { characterSpriteX, characterSpriteY, footprintSpriteX } from "@/player/characterDepth";
import type { StepResult } from "@/player/interpreter";
import { ensureSceneImageTexture } from "@/player/playSceneImageTexture";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { UNIT_FOOTPRINT } from "@/project/footprint";
import { store } from "@/project/store";
import type { BattleAnimationRecord, CharacterFootprint, ShowAnimationTarget } from "@/project/types";
import { runtimeEventViewsForMap } from "@/project/runtimeEventState"

const MAP_ANIMATION_DEPTH = 800_000;
const RAW_TEXTURE_PREFIX = "__oprn_battle_animation_raw_";
const CHROMA_TEXTURE_PREFIX = "__oprn_battle_animation_";

export type ShowAnimationTileResolver = {
  readonly player: { readonly x: number; readonly y: number };
  readonly currentEventId?: string;
  /** 발자국은 선택이다 — 타일 해석에는 필요 없고, 픽셀 변환이 몸 중앙을 잡을 때만 쓴다. */
  eventPosition(eventId: string): {
    readonly x: number;
    readonly y: number;
    readonly footprint?: CharacterFootprint;
  } | undefined;
};

export function resolveShowAnimationTargetTile(
  target: ShowAnimationTarget,
  resolver: ShowAnimationTileResolver
): { readonly x: number; readonly y: number } | undefined {
  if (target === "player") return resolver.player;
  if ("eventId" in target) {
    const eventId = target.eventId || resolver.currentEventId;
    return eventId ? resolver.eventPosition(eventId) : undefined;
  }
  return { x: target.x, y: target.y };
}

export function playMapAnimation(
  scene: PlaySceneContext,
  step: Extract<StepResult, { kind: "showAnimation" }>,
  currentEventId?: string
): Promise<void> {
  const project = store.getCurrent();
  const record = project.database.battleAnimations.find((entry) => entry.id === step.animationId);
  const durationMs = battleAnimationDurationMs(record);
  const layer = ensureMapAnimationLayer(scene);
  const target = resolveAnimationTargetPixel(scene, step.target, currentEventId);
  if (!target) return waitForDuration(scene, durationMs);

  const container = scene.add.container(target.x, target.y);
  container.setDepth(MAP_ANIMATION_DEPTH);
  container.setScrollFactor(1);
  container.setData("animationId", step.animationId);
  container.setData("targetX", target.x);
  container.setData("targetY", target.y);
  layer.add(container);
  scene.activeMapAnimations.add(container);

  const done = new Promise<void>((resolve) => {
    const finish = (): void => {
      container.destroy(true);
      scene.activeMapAnimations.delete(container);
      resolve();
    };
    scene.time.delayedCall(durationMs, finish);
  });

  void renderBattleAnimationFrames(scene, container, record).catch(() => {
    renderFallbackFlash(scene, container);
  });
  return done;
}

function ensureMapAnimationLayer(scene: PlaySceneContext): Phaser.GameObjects.Container {
  if (scene.mapAnimationLayer) return scene.mapAnimationLayer;
  const layer = scene.add.container(0, 0);
  layer.setDepth(MAP_ANIMATION_DEPTH);
  scene.mapAnimationLayer = layer;
  scene.activeMapAnimations = scene.activeMapAnimations ?? new Set();
  return layer;
}

async function renderBattleAnimationFrames(
  scene: PlaySceneContext,
  container: Phaser.GameObjects.Container,
  record: BattleAnimationRecord | undefined
): Promise<void> {
  if (!record?.sheet || !record.frames || record.frames.length === 0) {
    renderFallbackFlash(scene, container);
    return;
  }
  const textureKey = await ensureBattleAnimationTexture(scene, record);
  if (!textureKey || !container.active) {
    renderFallbackFlash(scene, container);
    return;
  }
  let frameIndex = 0;
  renderFrame(scene, container, record, textureKey, frameIndex);
  if (record.frames.length <= 1) return;
  scene.time.addEvent({
    delay: battleAnimationFrameDurationMs(record),
    repeat: record.frames.length - 2,
    callback: () => {
      if (!container.active) return;
      frameIndex += 1;
      renderFrame(scene, container, record, textureKey, frameIndex);
    },
  });
}

function renderFrame(
  scene: PlaySceneContext,
  container: Phaser.GameObjects.Container,
  record: BattleAnimationRecord,
  textureKey: string,
  frameIndex: number
): void {
  container.removeAll(true);
  const frame = record.frames?.[frameIndex];
  if (!frame) return;
  const timing = record.timings?.find((entry) => entry.frameIndex === frameIndex);
  if (timing?.soundResourceId) playAudioCommand({ resourceId: timing.soundResourceId, loop: false }, store.getCurrent());
  for (const cell of frame.cells) {
    if (cell.visible === false || !record.sheet) continue;
    const sprite = scene.add.sprite(cell.x, cell.y, textureKey, frameName(cell.pattern));
    sprite.setOrigin(0.5, 0.5);
    sprite.setAlpha(Math.max(0, Math.min(255, cell.opacity ?? 255)) / 255);
    // 맵은 320×240 RM px 좌표계다. 96px 레거시 시트는 그대로(1), 384px 고해상도 시트는 0.25 로
    // 같은 96 맵 px 를 차지한다. 셀 zoom 은 그 위에 곱한다.
    sprite.setScale((Math.max(1, cell.zoom ?? 100) / 100) * battleAnimationSheetRmScale(record.sheet));
    container.add(sprite);
  }
}

function renderFallbackFlash(scene: PlaySceneContext, container: Phaser.GameObjects.Container): void {
  if (!container.active || container.length > 0) return;
  const flash = scene.add.circle(0, 0, mapTileSize(scene.map) * 0.8, 0xffffff, 0.85);
  container.add(flash);
  scene.tweens.add({
    targets: flash,
    alpha: 0,
    scale: 1.6,
    duration: 220,
  });
}

function resolveAnimationTargetPixel(
  scene: PlaySceneContext,
  target: ShowAnimationTarget,
  currentEventId: string | undefined
): { readonly x: number; readonly y: number } | undefined {
  if (target === "player") return { x: scene.player.x, y: scene.player.y - mapTileSize(scene.map) / 2 };
  if ("eventId" in target) {
    const eventId = target.eventId || currentEventId;
    if (!eventId) return undefined;
    const sprite = scene.eventSprites.get(eventId);
    // 이벤트가 이동 중이어도 시작 시점의 좌표만 캡처하고 이후 추적하지 않는다.
    // 스프라이트가 있으면 그 x 는 이미 발자국 중앙이다(playSceneMapRuntime·playSceneAutonomous).
    if (sprite) return { x: sprite.x, y: sprite.y - mapTileSize(scene.map) / 2 };
    const resolver = sceneTileResolver(scene, currentEventId);
    const tile = resolveShowAnimationTargetTile(target, resolver);
    if (!tile) return undefined;
    // 그림 없는 이벤트(투명 트리거)도 **몸 중앙**에 터뜨린다 — 앵커를 쓰면 3x3 투명 영역의
    // 왼쪽에 치우친다. 발자국이 없으면 footprintSpriteX 가 곧 타일 중앙이라 항등이다.
    const footprint = resolver.eventPosition(eventId)?.footprint ?? UNIT_FOOTPRINT;
    return { x: footprintSpriteX(tile.x, footprint, mapTileSize(scene.map)), y: characterSpriteY(tile.y, mapTileSize(scene.map)) - mapTileSize(scene.map) / 2 };
  }
  return tileCenter(target.x, target.y, mapTileSize(scene.map));
}

function sceneTileResolver(scene: PlaySceneContext, currentEventId: string | undefined): ShowAnimationTileResolver {
  return {
    player: { x: scene.tileX, y: scene.tileY },
    currentEventId,
    eventPosition: (eventId) =>
      runtimeEventViewsForMap(store.getCurrent(), scene.map, scene.session, scene.eventPositions)
        .find((entry) => entry.event.id === eventId),
  };
}

function tileCenter(x: number, y: number, tileSize: number): { readonly x: number; readonly y: number } {
  return { x: characterSpriteX(x, tileSize), y: characterSpriteY(y, tileSize) - tileSize / 2 };
}

function waitForDuration(scene: PlaySceneContext, durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    scene.time.delayedCall(durationMs, resolve);
  });
}

function ensureBattleAnimationTexture(
  scene: PlaySceneContext,
  record: BattleAnimationRecord
): Promise<string | undefined> {
  if (!record.resourceId) return Promise.resolve(undefined);
  const textureKey = chromaTextureKey(record.resourceId);
  if (scene.textures.exists(textureKey)) {
    registerBattleAnimationFrames(scene, textureKey, record);
    return Promise.resolve(textureKey);
  }
  const url = resolveAssetResourceUrl(record.resourceId, { project: store.getCurrent() });
  if (!url) return Promise.resolve(undefined);
  // 원본 로드·중복 제거는 공용 로더가 맡는다. 색상 키아웃은 그 위에 한 겹이다.
  const rawKey = rawTextureKey(record.resourceId);
  return ensureSceneImageTexture(scene, rawKey, url).then((loadedKey) => {
    if (!loadedKey) return undefined;
    const key = createChromaKeyTexture(scene, loadedKey, textureKey);
    if (key) registerBattleAnimationFrames(scene, key, record);
    return key;
  });
}

function createChromaKeyTexture(
  scene: PlaySceneContext,
  rawKey: string,
  textureKey: string
): string | undefined {
  if (scene.textures.exists(textureKey)) return textureKey;
  if (!scene.textures.exists(rawKey)) return undefined;
  const source = scene.textures.get(rawKey).getSourceImage() as CanvasImageSource & { width?: number; height?: number };
  const width = Math.max(1, Number(source.width ?? 0));
  const height = Math.max(1, Number(source.height ?? 0));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  context.drawImage(source, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const red = pixels.data[index] ?? 0;
    const green = pixels.data[index + 1] ?? 0;
    const blue = pixels.data[index + 2] ?? 0;
    if (green > 90 && red < 40 && blue < 40) pixels.data[index + 3] = 0;
  }
  context.putImageData(pixels, 0, 0);
  const texture = scene.textures.addCanvas(textureKey, canvas);
  return texture ? textureKey : undefined;
}

function registerBattleAnimationFrames(
  scene: PlaySceneContext,
  textureKey: string,
  record: BattleAnimationRecord
): void {
  if (!record.sheet || !scene.textures.exists(textureKey)) return;
  const texture = scene.textures.get(textureKey);
  const names = texture.getFrameNames();
  const frameCount = record.frames?.reduce((max, frame) => {
    const frameMax = frame.cells.reduce((cellMax, cell) => Math.max(cellMax, cell.pattern), -1);
    return Math.max(max, frameMax);
  }, -1) ?? -1;
  for (let pattern = 0; pattern <= frameCount; pattern += 1) {
    const name = frameName(pattern);
    if (names.includes(name)) continue;
    const column = pattern % record.sheet.columns;
    const row = Math.floor(pattern / record.sheet.columns);
    texture.add(
      name,
      0,
      column * record.sheet.frameWidth,
      row * record.sheet.frameHeight,
      record.sheet.frameWidth,
      record.sheet.frameHeight
    );
  }
}

function frameName(pattern: number): string {
  return `battle_animation_${pattern}`;
}

function rawTextureKey(resourceId: string): string {
  return `${RAW_TEXTURE_PREFIX}${sanitizeKey(resourceId)}`;
}

function chromaTextureKey(resourceId: string): string {
  return `${CHROMA_TEXTURE_PREFIX}${sanitizeKey(resourceId)}`;
}

function sanitizeKey(value: string): string {
  return value.replace(/[^a-z0-9_-]/gi, "_");
}
