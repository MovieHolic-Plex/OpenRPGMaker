import { CHARSET_ASSETS } from "@/assets/charsetCatalog";
import { applyCharsetFrameCrop, charsetFrameCropPosition } from "@/assets/charsetFrameCrop";
import {
  charsetFrameIndex,
  decodeCharsetFrameIndex,
  type CharsetFrameSelection,
  type EasyRpgCharsetAsset,
} from "@/assets/easyrpgRtp";
import { RESOURCE_SLICING } from "@/assets/resourceSlicing";
import { normalizeCharacterScale } from "@/project/footprint";
import type { AutonomousMovement, CharacterFootprint, EventPageGraphic } from "@/project/types";

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

const TILE_PX = RESOURCE_SLICING.chipset.cellWidth;
const CELL_PX = RESOURCE_SLICING.charset.cellWidth;
const CELL_PY = RESOURCE_SLICING.charset.cellHeight;
/** 미리보기 한 변의 상한(CSS px). 3x3 배율 3 이 패널을 넘지 않게 잡은 값. */
const FOOTPRINT_PREVIEW_MAX_PX = 132;
/** 1x1 배율 1 이 기존 `PREVIEW_SCALE` 과 같은 크기로 보이게 하는 상한. */
const FOOTPRINT_PREVIEW_MAX_ZOOM = PREVIEW_SCALE;
const FOOTPRINT_PREVIEW_MIN_ZOOM = 0.5;

export type PreviewBox = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/**
 * 몸 사각과 스프라이트가 **게임 픽셀**로 어디에 놓이는지. 배치 계산을 DOM 에서 떼어
 * 순수 함수로 두는 이유: 테스트가 "3x3 몸에 배율 3 스프라이트가 몸 위로 얼마나 삐져나오는가"
 * 를 렌더링 없이 단정할 수 있다. `zoom` 만 CSS 로 곱하면 된다.
 *
 * 원점은 몸 사각과 스프라이트의 합집합 좌상단이다 — 스프라이트가 몸보다 넓으면(배율이
 * 큰 경우) `body.x > 0` 이 되고, 몸이 더 넓으면 `sprite.x > 0` 이 된다.
 */
export type FootprintPreviewLayout = {
  readonly zoom: number;
  readonly canvas: { readonly width: number; readonly height: number };
  readonly body: PreviewBox;
  readonly sprite: PreviewBox;
  /** 몸 사각 안에서 앵커가 있는 열 — 짝수 폭은 중앙 왼쪽이다(발밑 규약). */
  readonly anchorColumn: number;
};

export function footprintPreviewLayout(input: {
  readonly footprint: CharacterFootprint;
  readonly scale?: number;
}): FootprintPreviewLayout {
  const scale = normalizeCharacterScale(input.scale);
  const { width, height } = input.footprint;
  const bodyW = width * TILE_PX;
  const bodyH = height * TILE_PX;
  const spriteW = CELL_PX * scale;
  const spriteH = CELL_PY * scale;
  // 발밑 규약: 앵커 칸은 몸 사각 하단 행이고, 짝수 폭에서는 중앙 왼쪽이다.
  const anchorColumn = Math.floor((width - 1) / 2);
  // 스프라이트 원점은 (0.5, 1) — 앵커 칸의 가로 중앙, 몸 사각 밑변에 발이 닿는다.
  const anchorCenterX = anchorColumn * TILE_PX + TILE_PX / 2;
  const rawSpriteX = anchorCenterX - spriteW / 2;
  const rawSpriteY = bodyH - spriteH;
  // 둘 중 더 왼쪽/위로 삐져나온 쪽이 0 이 되도록 각자를 밀어 넣는다. `Math.max` 를 거치므로
  // 값이 -0 으로 새지 않는다 — -0 은 `-0px` 문자열이 되어 CSS 와 테스트를 둘 다 지저분하게 한다.
  const bodyX = Math.max(0, -rawSpriteX);
  const bodyY = Math.max(0, -rawSpriteY);
  const spriteX = Math.max(0, rawSpriteX);
  const spriteY = Math.max(0, rawSpriteY);
  const canvasW = Math.max(bodyX + bodyW, spriteX + spriteW);
  const canvasH = Math.max(bodyY + bodyH, spriteY + spriteH);
  return {
    zoom: fitZoom(canvasW, canvasH),
    canvas: { width: canvasW, height: canvasH },
    body: { x: bodyX, y: bodyY, width: bodyW, height: bodyH },
    sprite: { x: spriteX, y: spriteY, width: spriteW, height: spriteH },
    anchorColumn,
  };
}

function fitZoom(width: number, height: number): number {
  const fit = Math.min(FOOTPRINT_PREVIEW_MAX_PX / width, FOOTPRINT_PREVIEW_MAX_PX / height);
  return Math.max(FOOTPRINT_PREVIEW_MIN_ZOOM, Math.min(FOOTPRINT_PREVIEW_MAX_ZOOM, fit));
}

/**
 * 몸 사각 격자 위에 실제 배율의 스프라이트를 겹쳐 그린다. 통행 차단 행은 다른 음영이라
 * "3칸 높이인데 발밑 한 줄만 막힘" 이 편집창에서 눈으로 보인다.
 *
 * `renderEventGraphicPreview`(모습 필드셋)와 따로 두는 이유: 그쪽은 배율 무관하게
 * 프레임 한 칸을 고정 크기로 보여 주는 것이 목적이고, 다른 호출부 6곳이 그 크기에 기대고 있다.
 */
export function renderFootprintPreview(input: {
  readonly graphic: EventPageGraphic;
  readonly footprint: CharacterFootprint;
  readonly passRows: number;
}): HTMLElement {
  const layout = footprintPreviewLayout({ footprint: input.footprint, scale: input.graphic.scale });
  const { zoom } = layout;
  const host = document.createElement("div");
  host.className = "event-footprint-preview";
  host.dataset.testid = "event-page-footprint-preview";
  host.style.width = `${round(layout.canvas.width * zoom)}px`;
  host.style.height = `${round(layout.canvas.height * zoom)}px`;

  const grid = document.createElement("div");
  grid.className = "event-footprint-preview-grid";
  grid.dataset.testid = "event-page-footprint-preview-grid";
  grid.style.left = `${round(layout.body.x * zoom)}px`;
  grid.style.top = `${round(layout.body.y * zoom)}px`;
  grid.style.width = `${round(layout.body.width * zoom)}px`;
  grid.style.height = `${round(layout.body.height * zoom)}px`;
  grid.style.gridTemplateColumns = `repeat(${input.footprint.width}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${input.footprint.height}, 1fr)`;

  const firstPassRow = input.footprint.height - clampRows(input.passRows, input.footprint.height);
  for (let row = 0; row < input.footprint.height; row += 1) {
    for (let col = 0; col < input.footprint.width; col += 1) {
      const cell = document.createElement("i");
      cell.className = "event-footprint-preview-cell";
      if (row >= firstPassRow) cell.dataset.pass = "true";
      if (row === input.footprint.height - 1 && col === layout.anchorColumn) cell.dataset.anchor = "true";
      grid.append(cell);
    }
  }

  const sprite = renderEventGraphicElement(
    input.graphic,
    "event-footprint-preview-sprite",
    zoom * normalizeCharacterScale(input.graphic.scale),
    "fixed",
    "event-page-footprint-preview-sprite"
  );
  sprite.style.left = `${round(layout.sprite.x * zoom)}px`;
  sprite.style.top = `${round(layout.sprite.y * zoom)}px`;

  host.append(grid, sprite);
  return host;
}

function clampRows(rows: number, height: number): number {
  if (!Number.isFinite(rows) || rows < 1) return height;
  return Math.min(height, Math.floor(rows));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
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
  target.dataset.slot = String(selection.characterIndex);
  target.dataset.direction = selection.direction;
  target.dataset.pattern = String(frameIndex);
  target.dataset.walkPattern = String(selection.pattern);
  applyCharsetFrameCrop(target, asset.path, selection, scale);
  if (animate) setWalkingFrameProperties(target, selection, scale);
}

function setWalkingFrameProperties(target: HTMLElement, selection: CharsetFrameSelection, scale: number): void {
  setStyleVar(target, "--event-graphic-frame-a", backgroundPositionForFrame({ ...selection, pattern: 0 }, scale));
  setStyleVar(target, "--event-graphic-frame-b", backgroundPositionForFrame({ ...selection, pattern: 2 }, scale));
}

function backgroundPositionForFrame(selection: CharsetFrameSelection, scale: number): string {
  return charsetFrameCropPosition(selection, scale);
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
