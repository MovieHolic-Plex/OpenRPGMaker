// Phaser 3.90 scales around the viewport center: centerOn sets scroll = center - size/2.
// Zoom changes the visible span, not this inverse.

export interface CameraViewport {
  readonly scrollX: number;
  readonly scrollY: number;
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
}

export interface EditorCameraCenterInput {
  readonly mapWidthPx: number;
  readonly mapHeightPx: number;
  readonly previousCenter: { readonly x: number; readonly y: number } | null;
  /** 같은 맵에서 줌·크기만 바뀐 경우 true. 맵 전환이면 false 로 한가운데에 둔다. */
  readonly preserveLookAt: boolean;
  readonly devFocusWorld: { readonly x: number; readonly y: number } | null;
}

/** Inverse of Phaser Camera.centerOn, including before the next preRender. */
export function viewportCenterWorld(view: CameraViewport): { x: number; y: number } {
  return {
    x: view.scrollX + view.width / 2,
    y: view.scrollY + view.height / 2,
  };
}

/**
 * 편집 카메라를 다시 세울 때 바라볼 월드 점.
 * 줌만 바뀌면(조수가 fit 줌을 제안하거나 사용자가 +/- 를 누른 경우) 맵 한가운데로
 * 붙이지 않는다 — 그 스냅이 프로그램 팬의 출발점이 되어 "중앙으로 튕긴 뒤 슬라이드"가 된다.
 */
export function planEditorCameraCenter(input: EditorCameraCenterInput): { x: number; y: number } {
  if (input.devFocusWorld) return { x: input.devFocusWorld.x, y: input.devFocusWorld.y };
  if (input.preserveLookAt && input.previousCenter) {
    return { x: input.previousCenter.x, y: input.previousCenter.y };
  }
  return { x: input.mapWidthPx / 2, y: input.mapHeightPx / 2 };
}
