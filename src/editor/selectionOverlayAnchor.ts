// 선택 영역 오버레이(건축 팔레트 / AI 칩) 화면 좌표. Phaser 비의존 순수 함수.

export type OverlayRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type OverlaySize = {
  readonly width: number;
  readonly height: number;
};

export type OverlayPoint = {
  readonly x: number;
  readonly y: number;
};

export const SELECTION_OVERLAY_GAP_PX = 8;
export const SELECTION_OVERLAY_PADDING_PX = 8;

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 건축 팔레트: 선택 우측(자리 없으면 좌), 세로 중앙. */
export function anchoredBuildPalettePosition(input: {
  readonly selectionRect: OverlayRect;
  readonly popupSize: OverlaySize;
  readonly canvasSize: OverlaySize;
  readonly gap?: number;
  readonly padding?: number;
}): OverlayPoint {
  const gap = input.gap ?? SELECTION_OVERLAY_GAP_PX;
  const padding = input.padding ?? SELECTION_OVERLAY_PADDING_PX;
  const maxX = Math.max(padding, input.canvasSize.width - input.popupSize.width - padding);
  const maxY = Math.max(padding, input.canvasSize.height - input.popupSize.height - padding);
  const rightX = input.selectionRect.x + input.selectionRect.width + gap;
  const leftX = input.selectionRect.x - input.popupSize.width - gap;
  const preferredX = rightX + input.popupSize.width + padding <= input.canvasSize.width ? rightX : leftX;
  const centeredY = input.selectionRect.y + input.selectionRect.height / 2 - input.popupSize.height / 2;
  return {
    x: clampNumber(preferredX, padding, maxX),
    y: clampNumber(centeredY, padding, maxY),
  };
}

/** 선택 칩 바: 선택 영역 아래(공간 없으면 위), 가로 중앙. 맵을 덜 가린다. */
export function anchoredSelectionChipsPosition(input: {
  readonly selectionRect: OverlayRect;
  readonly popupSize: OverlaySize;
  readonly canvasSize: OverlaySize;
  readonly gap?: number;
  readonly padding?: number;
}): OverlayPoint {
  const gap = input.gap ?? SELECTION_OVERLAY_GAP_PX;
  const padding = input.padding ?? SELECTION_OVERLAY_PADDING_PX;
  const maxX = Math.max(padding, input.canvasSize.width - input.popupSize.width - padding);
  const maxY = Math.max(padding, input.canvasSize.height - input.popupSize.height - padding);
  const belowY = input.selectionRect.y + input.selectionRect.height + gap;
  const aboveY = input.selectionRect.y - input.popupSize.height - gap;
  const preferredY =
    belowY + input.popupSize.height + padding <= input.canvasSize.height ? belowY : aboveY;
  const centeredX =
    input.selectionRect.x + input.selectionRect.width / 2 - input.popupSize.width / 2;
  return {
    x: clampNumber(centeredX, padding, maxX),
    y: clampNumber(preferredY, padding, maxY),
  };
}
