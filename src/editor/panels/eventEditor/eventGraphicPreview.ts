import { CHARSET_ASSETS } from "@/assets/charsetCatalog";
import {
  CHARSET_FRAME_HEIGHT,
  CHARSET_FRAME_WIDTH,
  CHARSET_SHEET_COLUMNS,
  CHARSET_SHEET_ROWS,
  charsetFrameIndex,
  charsetFrameSource,
  decodeCharsetFrameIndex,
  type CharsetFrameSelection,
  type EasyRpgCharsetAsset,
} from "@/assets/easyrpgRtp";
import { applyTransparentColorKeyBackground } from "@/assets/transparentColorKeyBackground";
import type { AutonomousMovement, EventPageGraphic } from "@/project/types";

const PREVIEW_SCALE = 2;
/** Compact icons for event list / world cards (~16.5×22). */
const ICON_PREVIEW_SCALE = 0.6875;
/**
 * Page-tab thumbnails: 36×48 charset cell (scale 1.5) so the side-strip tab
 * (72px tall with number overlay padding) shows the same full frame as the
 * graphic panel without CSS max-size squashing the crop.
 */
export const PAGE_TAB_ICON_PREVIEW_SCALE = 1.5;
const DEFAULT_FRONT_FRAME = {
  characterIndex: 0,
  direction: "down",
  pattern: 1,
} as const satisfies CharsetFrameSelection;

export function renderEventGraphicPreview(graphic: EventPageGraphic, movementType: AutonomousMovement = "fixed"): HTMLElement {
  return renderEventGraphicElement(graphic, "event-graphic-preview", PREVIEW_SCALE, movementType, "event-page-graphic-preview");
}

export function renderEventGraphicIcon(
  graphic: EventPageGraphic,
  options?: { readonly scale?: number }
): HTMLElement {
  return renderEventGraphicElement(
    graphic,
    "event-graphic-preview event-graphic-icon-preview",
    options?.scale ?? ICON_PREVIEW_SCALE,
    "fixed",
    "event-page-graphic-icon-preview"
  );
}

function renderEventGraphicElement(
  graphic: EventPageGraphic,
  className: string,
  scale: number,
  movementType: AutonomousMovement,
  testId: string
): HTMLElement {
  const preview = document.createElement("div");
  preview.className = className;
  preview.dataset.testid = testId;

  const spriteId = graphic.sprite?.id;
  if (!spriteId) {
    preview.dataset.empty = "true";
    return preview;
  }

  preview.dataset.spriteId = spriteId;
  const asset = findCharsetAsset(spriteId);
  if (!asset) {
    preview.dataset.unsupported = "true";
    preview.title = spriteId;
    return preview;
  }

  const animate = isMovingMovement(movementType);
  if (animate) markMovingPreview(preview, movementType);
  const frameIndex = graphic.pattern ?? charsetFrameIndex(DEFAULT_FRONT_FRAME);
  applyCharsetPreviewStyle({
    target: preview,
    asset,
    selection: decodeCharsetFrameIndex(frameIndex),
    frameIndex,
    scale,
    animate,
  });
  return preview;
}

type CharsetPreviewStyle = {
  readonly target: HTMLElement;
  readonly asset: EasyRpgCharsetAsset;
  readonly selection: CharsetFrameSelection;
  readonly frameIndex: number;
  readonly scale: number;
  readonly animate: boolean;
};

function applyCharsetPreviewStyle(style: CharsetPreviewStyle): void {
  const { target, asset, selection, frameIndex, scale, animate } = style;
  const source = charsetFrameSource(selection);
  target.dataset.slot = String(selection.characterIndex);
  target.dataset.direction = selection.direction;
  target.dataset.pattern = String(frameIndex);
  target.dataset.walkPattern = String(selection.pattern);
  target.style.width = `${CHARSET_FRAME_WIDTH * scale}px`;
  target.style.height = `${CHARSET_FRAME_HEIGHT * scale}px`;
  applyTransparentColorKeyBackground(target, asset.path);
  target.style.backgroundSize = `${CHARSET_SHEET_COLUMNS * CHARSET_FRAME_WIDTH * scale}px ${
    CHARSET_SHEET_ROWS * CHARSET_FRAME_HEIGHT * scale
  }px`;
  target.style.backgroundPosition = `-${source.x * scale}px -${source.y * scale}px`;
  if (animate) setWalkingFrameProperties(target, selection, scale);
}

function setWalkingFrameProperties(target: HTMLElement, selection: CharsetFrameSelection, scale: number): void {
  setStyleVar(target, "--event-graphic-frame-a", backgroundPositionForFrame({ ...selection, pattern: 0 }, scale));
  setStyleVar(target, "--event-graphic-frame-b", backgroundPositionForFrame({ ...selection, pattern: 2 }, scale));
}

function backgroundPositionForFrame(selection: CharsetFrameSelection, scale: number): string {
  const source = charsetFrameSource(selection);
  return `-${source.x * scale}px -${source.y * scale}px`;
}

function setStyleVar(target: HTMLElement, name: string, value: string): void {
  target.style.setProperty(name, value);
}

function isMovingMovement(movementType: AutonomousMovement): boolean {
  return movementType !== "fixed";
}

function markMovingPreview(preview: HTMLElement, movementType: AutonomousMovement): void {
  preview.classList.add("moving");
  preview.dataset.movementType = movementType;
  preview.title = movementTitle(movementType);
}

function movementTitle(movementType: AutonomousMovement): string {
  switch (movementType) {
    case "random":
      return "랜덤 이동 미리보기";
    case "approach":
      return "접근 이동 미리보기";
    case "chase":
      return "추격 이동 미리보기";
    case "custom":
      return "사용자 지정 이동 미리보기";
    case "living":
      return "생활 이동 미리보기";
    case "fixed":
      return "";
  }
  return "";
}

function findCharsetAsset(textureKey: string): EasyRpgCharsetAsset | undefined {
  return CHARSET_ASSETS.find((asset) => asset.textureKey === textureKey);
}
