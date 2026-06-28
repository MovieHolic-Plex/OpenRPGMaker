import type { BattleSnapshot } from "@/battle/runtime";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { store } from "@/project/store";
import type { BattleAnimationRecord } from "@/project/types";

type CellSourceRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export interface BattleAnimationPlayback {
  readonly element: HTMLElement;
  destroy(): void;
}

export function mountBattleAnimationPlayback(snapshot: BattleSnapshot): BattleAnimationPlayback | undefined {
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
  element.textContent = lastAnimation.name ?? lastAnimation.animationId;

  const timers = new Set<number>();
  const url = resolveAssetResourceUrl(record?.resourceId, { project: store.getCurrent() });
  if (url && record?.sheet && record.frames && record.frames.length > 0) {
    element.dataset.renderedFrameCount = String(record.frames.length);
    element.replaceChildren(animationSheet(record, url));
    setActiveAnimationFrame(element, record, 0);
    startPlayback(element, record, timers);
  }

  return {
    element,
    destroy(): void {
      for (const timer of timers) window.clearInterval(timer);
      timers.clear();
    },
  };
}

function setOptionalDataset(element: HTMLElement, key: string, value: string | undefined): void {
  if (value) element.dataset[key] = value;
}

function battleAnimationRecord(animationId: string): BattleAnimationRecord | undefined {
  return store.getCurrent().database.battleAnimations.find((record) => record.id === animationId);
}

function startPlayback(element: HTMLElement, record: BattleAnimationRecord, timers: Set<number>): void {
  const frames = record.frames ?? [];
  if (frames.length <= 1) return;
  let index = 0;
  const timer = window.setInterval(() => {
    index += 1;
    if (index >= frames.length) {
      window.clearInterval(timer);
      timers.delete(timer);
      return;
    }
    setActiveAnimationFrame(element, record, index);
  }, 120);
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
  canvas.style.width = `${record.sheet.frameWidth}px`;
  canvas.style.height = `${record.sheet.frameHeight}px`;
  canvas.style.left = `calc(50% + ${cell.x}px)`;
  canvas.style.top = `calc(50% + ${cell.y}px)`;
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

function setActiveAnimationFrame(element: HTMLElement, record: BattleAnimationRecord, frameIndex: number): void {
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
    for (let index = 0; index < pixels.data.length; index += 4) {
      const red = pixels.data[index] ?? 0;
      const green = pixels.data[index + 1] ?? 0;
      const blue = pixels.data[index + 2] ?? 0;
      if (green > 90 && red < 40 && blue < 40) {
        pixels.data[index + 3] = 0;
      }
    }
    context.putImageData(pixels, 0, 0);
    canvas.dataset.rendered = "true";
  });
  image.src = url;
}
