import type { BattleSnapshot } from "@/battle/runtime";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { applyAutoTransparencyKey } from "@/assets/transparentColorKey";
import { store } from "@/project/store";
import type { BattleAnimationRecord } from "@/project/types";
import { BATTLE_ANIMATION_FRAME_MS } from "@/player/battleAnimationPlayback";
import { findBattlerNode } from "@/player/battleFieldDom";
import { BATTLE_ASSET_PIXEL_SCALE } from "@/player/battleStageScale";

type CellSourceRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export interface BattleAnimationPlayback {
  readonly element: HTMLElement;
  readonly animationKey: string | undefined;
  destroy(): void;
}

export function syncBattleAnimationLayer(
  layer: HTMLElement,
  snapshot: BattleSnapshot,
  sceneRoot: HTMLElement
): BattleAnimationPlayback | undefined {
  const lastAnimation = snapshot.lastAnimation;
  const animationKey = lastAnimation ? `${lastAnimation.animationId}:${lastAnimation.targetId}` : undefined;
  const existing = layer.querySelector<HTMLElement>("[data-testid='battle-animation']");
  if (!animationKey) {
    existing?.remove();
    sceneRoot.classList.remove("battle-screen-shake", "battle-screen-flash");
    return undefined;
  }
  if (existing?.dataset.animationKey === animationKey) {
    return {
      element: existing,
      animationKey,
      destroy(): void {
        /* retained across ticks */
      },
    };
  }
  existing?.remove();
  const playback = mountBattleAnimationPlayback(snapshot, sceneRoot);
  if (!playback) return undefined;
  playback.element.dataset.animationKey = animationKey;
  positionAnimationOnTarget(playback.element, lastAnimation!.targetId);
  layer.append(playback.element);
  return playback;
}

export function mountBattleAnimationPlayback(
  snapshot: BattleSnapshot,
  sceneRoot: HTMLElement | null = null
): BattleAnimationPlayback | undefined {
  const lastAnimation = snapshot.lastAnimation;
  if (!lastAnimation) return undefined;

  const record = battleAnimationRecord(lastAnimation.animationId);
  const element = document.createElement("div");
  element.className = "battle-animation";
  element.dataset.testid = "battle-animation";
  element.dataset.animationId = lastAnimation.animationId;
  setOptionalDataset(element, "animationName", lastAnimation.name);
  setOptionalDataset(element, "animationResourceId", lastAnimation.resourceId);
  setOptionalDataset(element, "animationScope", lastAnimation.scope);
  setOptionalDataset(element, "animationPosition", lastAnimation.position);
  element.dataset.animationSoundResourceIds = lastAnimation.soundResourceIds.join(",");
  element.dataset.animationFlashTargets = lastAnimation.flashTargets.join(",");
  element.dataset.animationScreenShake = String(lastAnimation.screenShake);
  element.dataset.animationFrameCount = String(lastAnimation.frameCount);
  element.dataset.currentFrame = "0";
  element.setAttribute("aria-label", lastAnimation.name ?? lastAnimation.animationId);
  element.setAttribute("role", "img");

  const timers = new Set<number>();
  const url = resolveAssetResourceUrl(record?.resourceId, { project: store.getCurrent() });
  if (url && record?.sheet && record.frames && record.frames.length > 0) {
    element.dataset.renderedFrameCount = String(record.frames.length);
    element.append(animationSheet(record, url));
    setActiveAnimationFrame(element, record, 0, sceneRoot);
    startPlayback(element, record, timers, sceneRoot);
  }

  return {
    element,
    animationKey: `${lastAnimation.animationId}:${lastAnimation.targetId}`,
    destroy(): void {
      for (const timer of timers) window.clearInterval(timer);
      timers.clear();
      element.remove();
    },
  };
}

function positionAnimationOnTarget(element: HTMLElement, targetId: string): void {
  // 아군 노드 testid는 battle-actor-<id> 형식 — findBattlerNode로 통일 조회(오위치 버그 수정).
  const target = findBattlerNode(document, targetId);
  if (!target) return;
  element.style.setProperty("--battle-node-x", target.style.getPropertyValue("--battle-node-x"));
  element.style.setProperty("--battle-node-y", target.style.getPropertyValue("--battle-node-y"));
}

function setOptionalDataset(element: HTMLElement, key: string, value: string | undefined): void {
  if (value) element.dataset[key] = value;
}

function battleAnimationRecord(animationId: string): BattleAnimationRecord | undefined {
  return store.getCurrent().database.battleAnimations.find((record) => record.id === animationId);
}

function startPlayback(
  element: HTMLElement,
  record: BattleAnimationRecord,
  timers: Set<number>,
  sceneRoot: HTMLElement | null
): void {
  const frames = record.frames ?? [];
  if (frames.length <= 1) return;
  let index = 0;
  const timer = window.setInterval(() => {
    index += 1;
    if (index >= frames.length) {
      window.clearInterval(timer);
      timers.delete(timer);
      if (sceneRoot) {
        sceneRoot.classList.remove("battle-screen-shake", "battle-screen-flash");
      }
      return;
    }
    setActiveAnimationFrame(element, record, index, sceneRoot);
  }, BATTLE_ANIMATION_FRAME_MS);
  timers.add(timer);
}

function animationSheet(record: BattleAnimationRecord, url: string): HTMLElement {
  const sheet = document.createElement("div");
  sheet.className = "battle-animation-sheet";
  sheet.dataset.testid = "battle-animation-sheet";
  const frames = record.frames ?? [];
  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    const frame = frames[frameIndex];
    if (!frame) continue;
    sheet.append(animationFrame(record, frame.cells, frameIndex, url));
  }
  return sheet;
}

function animationFrame(
  record: BattleAnimationRecord,
  cells: NonNullable<BattleAnimationRecord["frames"]>[number]["cells"],
  frameIndex: number,
  url: string
): HTMLElement {
  const frameNode = document.createElement("div");
  frameNode.className = "battle-animation-frame";
  frameNode.dataset.testid = `battle-animation-frame-${frameIndex + 1}`;
  frameNode.dataset.frameIndex = String(frameIndex);
  for (const cell of cells) {
    if (!cell.visible || !record.sheet) continue;
    frameNode.append(animationCell(record, cell, url));
  }
  return frameNode;
}

function animationCell(
  record: BattleAnimationRecord,
  cell: NonNullable<BattleAnimationRecord["frames"]>[number]["cells"][number],
  url: string
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  if (!record.sheet) return canvas;
  canvas.className = "battle-animation-cell";
  canvas.dataset.testid = "battle-animation-cell";
  canvas.dataset.pattern = String(cell.pattern);
  canvas.width = record.sheet.frameWidth;
  canvas.height = record.sheet.frameHeight;
  // 시트 프레임 크기와 셀 좌표는 **자산 px**(320×240 화면 기준으로 저작된 RM 애니메이션 데이터)다.
  // 전투 씬의 논리 해상도는 640×480 이라 그대로 쓰면 화면에서 절반으로 보인다.
  const assetScale = BATTLE_ASSET_PIXEL_SCALE;
  canvas.style.width = `${record.sheet.frameWidth * assetScale}px`;
  canvas.style.height = `${record.sheet.frameHeight * assetScale}px`;
  canvas.style.left = `calc(50% + ${cell.x * assetScale}px)`;
  canvas.style.top = `calc(50% + ${cell.y * assetScale}px)`;
  canvas.style.opacity = String(Math.max(0, Math.min(255, cell.opacity)) / 255);
  canvas.style.transform = `translate(-50%, -50%) scale(${Math.max(1, cell.zoom) / 100})`;

  const column = cell.pattern % record.sheet.columns;
  const row = Math.floor(cell.pattern / record.sheet.columns);
  drawChromaKeyedCell(canvas, url, {
    x: column * record.sheet.frameWidth,
    y: row * record.sheet.frameHeight,
    width: record.sheet.frameWidth,
    height: record.sheet.frameHeight,
  });
  return canvas;
}

function setActiveAnimationFrame(
  element: HTMLElement,
  record: BattleAnimationRecord,
  frameIndex: number,
  sceneRoot: HTMLElement | null
): void {
  element.dataset.currentFrame = String(frameIndex);
  const frames = element.querySelectorAll<HTMLElement>(".battle-animation-frame");
  for (const frame of frames) {
    frame.hidden = frame.dataset.frameIndex !== String(frameIndex);
  }
  const timing = record.timings?.find((entry) => entry.frameIndex === frameIndex);
  element.dataset.activeSoundResourceId = timing?.soundResourceId ?? "";
  element.dataset.activeFlashTarget = timing?.flash?.target ?? "";
  element.dataset.activeScreenShake = String(Boolean(timing?.screenShake));
  element.classList.toggle("battle-animation-flash-active", Boolean(timing?.flash));
  element.classList.toggle("battle-animation-shake-active", Boolean(timing?.screenShake));
  if (sceneRoot) {
    sceneRoot.classList.toggle("battle-screen-shake", Boolean(timing?.screenShake));
    sceneRoot.classList.toggle("battle-screen-flash", Boolean(timing?.flash));
  }
  playTimingSound(timing?.soundResourceId);
}

function playTimingSound(soundResourceId: string | undefined): void {
  const url = resolveAssetResourceUrl(soundResourceId, { project: store.getCurrent() });
  if (!url) return;
  const audio = new Audio(url);
  audio.volume = 0.4;
  void audio.play().catch((error: unknown) => {
    if (error instanceof DOMException && error.name === "NotAllowedError") return;
    throw error;
  });
}

function drawChromaKeyedCell(canvas: HTMLCanvasElement, url: string, source: CellSourceRect): void {
  const image = new Image();
  image.addEventListener("load", () => {
    const context = canvas.getContext("2d");
    if (!context) return;
    const { x, y, width, height } = source;
    context.clearRect(0, 0, width, height);
    context.drawImage(image, x, y, width, height, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height);
    // 단일 색(마젠타/녹색/검은 등 어떤 단색 배경이든) 을 자동 감지해 키아웃한다.
    // 투명 PNG 는 테두리가 이미 alpha=0 이라 no-op 이다.
    applyAutoTransparencyKey(pixels.data, width, height);
    context.putImageData(pixels, 0, 0);
    canvas.dataset.rendered = "true";
  });
  image.src = url;
}