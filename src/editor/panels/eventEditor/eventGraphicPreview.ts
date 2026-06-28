import {
  CHARSET_FRAME_HEIGHT,
  CHARSET_FRAME_WIDTH,
  CHARSET_SHEET_COLUMNS,
  CHARSET_SHEET_ROWS,
  EASYRPG_CHARSET_ASSETS,
  charsetFrameIndex,
  charsetFrameSource,
  decodeCharsetFrameIndex,
  type CharsetFrameSelection,
  type EasyRpgCharsetAsset,
} from "@/assets/easyrpgRtp";
import { applyTransparentColorKeyBackground } from "@/assets/transparentColorKeyBackground";
import type { EventPageGraphic } from "@/project/types";

const PREVIEW_SCALE = 3;
const DEFAULT_FRONT_FRAME = {
  characterIndex: 0,
  direction: "down",
  pattern: 1,
} as const satisfies CharsetFrameSelection;

export function renderEventGraphicPreview(graphic: EventPageGraphic): HTMLElement {
  const preview = document.createElement("div");
  preview.className = "event-graphic-preview";
  preview.dataset.testid = "event-page-graphic-preview";

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

  const frameIndex = graphic.pattern ?? charsetFrameIndex(DEFAULT_FRONT_FRAME);
  applyCharsetPreviewStyle(preview, asset, decodeCharsetFrameIndex(frameIndex), frameIndex);
  return preview;
}

function applyCharsetPreviewStyle(
  target: HTMLElement,
  asset: EasyRpgCharsetAsset,
  selection: CharsetFrameSelection,
  frameIndex: number
): void {
  const source = charsetFrameSource(selection);
  target.dataset.slot = String(selection.characterIndex);
  target.dataset.direction = selection.direction;
  target.dataset.pattern = String(frameIndex);
  target.dataset.walkPattern = String(selection.pattern);
  target.style.width = `${CHARSET_FRAME_WIDTH * PREVIEW_SCALE}px`;
  target.style.height = `${CHARSET_FRAME_HEIGHT * PREVIEW_SCALE}px`;
  applyTransparentColorKeyBackground(target, asset.path);
  target.style.backgroundSize = `${CHARSET_SHEET_COLUMNS * CHARSET_FRAME_WIDTH * PREVIEW_SCALE}px ${
    CHARSET_SHEET_ROWS * CHARSET_FRAME_HEIGHT * PREVIEW_SCALE
  }px`;
  target.style.backgroundPosition = `-${source.x * PREVIEW_SCALE}px -${source.y * PREVIEW_SCALE}px`;
}

function findCharsetAsset(textureKey: string): EasyRpgCharsetAsset | undefined {
  return EASYRPG_CHARSET_ASSETS.find((asset) => asset.textureKey === textureKey);
}
