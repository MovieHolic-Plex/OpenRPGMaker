// 캔버스 리사이즈(AI 패널 토글 · 에디터 모드 전환 등) 시 카메라 뷰포트 중심을 보존하는 순수 계산.
//
// Phaser Camera.centerOn(x, y) 는
//   scrollX = x - (width / 2) / zoom
//   scrollY = y - (height / 2) / zoom
// 이므로, 역으로 뷰포트 중심의 월드 좌표는
//   center.x = scrollX + width / (2 * zoom)
//   center.y = scrollY + height / (2 * zoom)
// 이다. ScaleManager RESIZE 이벤트는 previousWidth/previousHeight(리사이즈 전 크기)를 주고,
// CameraManager.onResize 가 먼저 카메라를 새 크기로 바꾼 뒤(scroll 은 불변) 우리 핸들러가 실행되므로,
// previousWidth/Height 로 리사이즈 전 중심을 복원해 centerOn 에 넘기면 새 뷰포트에서 같은 지점이 중심에 온다.

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

/** 뷰포트 중심의 월드 좌표를 반환한다. zoom<=0 이면 1 로 취급해 0 나눗셈을 막는다. */
export function viewportCenterWorld(view: CameraViewport): { x: number; y: number } {
  const zoom = view.zoom > 0 ? view.zoom : 1;
  return {
    x: view.scrollX + view.width / (2 * zoom),
    y: view.scrollY + view.height / (2 * zoom),
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
