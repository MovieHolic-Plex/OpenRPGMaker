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

/** 선택 AI 칩: 캔버스 우하단 고정 플로팅 버튼 (맵/선택 위를 가리지 않음). */
export function fixedSelectionChipsPosition(input: {
  readonly popupSize: OverlaySize;
  readonly canvasSize: OverlaySize;
  readonly padding?: number;
}): OverlayPoint {
  // 하단 상태바/줌 크롬과 겹치지 않게 하단 여백을 더 둔다.
  const edge = input.padding ?? 20;
  const bottom = Math.max(edge, 40);
  return {
    x: Math.max(edge, input.canvasSize.width - input.popupSize.width - edge),
    y: Math.max(edge, input.canvasSize.height - input.popupSize.height - bottom),
  };
}

