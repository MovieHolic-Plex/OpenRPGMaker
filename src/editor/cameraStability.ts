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

/** 뷰포트 중심의 월드 좌표를 반환한다. zoom<=0 이면 1 로 취급해 0 나눗셈을 막는다. */
export function viewportCenterWorld(view: CameraViewport): { x: number; y: number } {
  const zoom = view.zoom > 0 ? view.zoom : 1;
  return {
    x: view.scrollX + view.width / (2 * zoom),
    y: view.scrollY + view.height / (2 * zoom),
  };
}
