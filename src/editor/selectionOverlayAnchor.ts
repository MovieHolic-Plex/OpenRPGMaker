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

/** 선택 액션 칩: 드래그 놓은 점(포인터) 근처에 띄운다 — context-menu 처럼.
 *  포인터가 없거나 화면 밖이면 선택 rect 우측(자리 없으면 좌) 세로 중앙으로 flip.
 *  어느 쪽도 캔버스 안에 안 들어가면 패딩 안쪽으로 clamp. */
export function anchoredSelectionChipsPosition(input: {
  readonly selectionRect: OverlayRect;
  readonly popupSize: OverlaySize;
  readonly canvasSize: OverlaySize;
  /** 우클릭 드래그 놓은 점(캔버스 내 좌표). 없으면 rect 기준. */
  readonly pointer?: OverlayPoint;
  readonly gap?: number;
  readonly padding?: number;
}): OverlayPoint {
  const gap = input.gap ?? SELECTION_OVERLAY_GAP_PX;
  const padding = input.padding ?? SELECTION_OVERLAY_PADDING_PX;
  const maxX = Math.max(padding, input.canvasSize.width - input.popupSize.width - padding);
  const maxY = Math.max(padding, input.canvasSize.height - input.popupSize.height - padding);

  const px = input.pointer?.x;
  const py = input.pointer?.y;
  const hasPointer = typeof px === "number" && typeof py === "number";

  // 1) 포인터 기준: 놓은 점 바로 아래/위, 가로는 점 중심.
  if (hasPointer) {
    const belowY = py + gap * 2;
    const aboveY = py - input.popupSize.height - gap * 2;
    const preferBelow = belowY + input.popupSize.height + padding <= input.canvasSize.height;
    const preferY = preferBelow ? belowY : aboveY;
    const centeredX = px - input.popupSize.width / 2;
    return {
      x: clampNumber(centeredX, padding, maxX),
      y: clampNumber(preferY, padding, maxY),
    };
  }

  // 2) rect 기준 flip: 우측, 자리 없으면 좌측. 세로는 rect 중앙.
  const rightX = input.selectionRect.x + input.selectionRect.width + gap;
  const leftX = input.selectionRect.x - input.popupSize.width - gap;
  const preferRight = rightX + input.popupSize.width + padding <= input.canvasSize.width;
  const preferredX = preferRight ? rightX : leftX;
  const centeredY = input.selectionRect.y + input.selectionRect.height / 2 - input.popupSize.height / 2;
  return {
    x: clampNumber(preferredX, padding, maxX),
    y: clampNumber(centeredY, padding, maxY),
  };
}

