// editor/canvasPointerBridge.ts
// 캔버스 포인터 브리지 — 캔버스 위 DOM 오버레이가 **가져오지 말아야 할** 제스처를 캔버스/카메라에 넘긴다.
//
// 왜 필요한가: 로케이션 오버레이는 DOM 트리상 캔버스를 덮고 있어 포인터 이벤트의 표적이 된다.
// 그래서 캔버스는 네이티브 pointerdown 을 받지 못해 카메라 팬뿐 아니라 우클릭 영역 제스처(AI 영역 채우기),
// 스포이트, 맵 밖 드래그 팬 등이 모두 동작하지 않게 된다.
//
// 오버레이는 Phaser 를 모른다. 카메라와 장면 제스처를 관리하는 EditScene 이 창구를 꽂고,
// 오버레이는 claimCanvasPointer() 로 제스처를 캔버스에 위임한다.
// 등록이 없으면(테스트·헤드리스) 항상 null 이며, 좌표를 지어내지 않는다.

import type { CanvasGestureOwner } from "@/editor/canvasPointerOwnership";

export type CanvasPointerPoint = {
  readonly button: number;
  readonly buttons: number;
  readonly clientX: number;
  readonly clientY: number;
};

export type CanvasGestureClaim = {
  readonly kind: CanvasGestureOwner;
  /** 이미 지나간 화면 좌표에서 그 제스처를 시작한다(장면이 아는 방법으로). */
  readonly start: () => void;
};

export type CanvasPointerBridge = {
  /** 이 pointerdown 의 주인. null 이면 오버레이가 가져간다. */
  readonly claim: (point: CanvasPointerPoint) => CanvasGestureClaim | null;
};

let bridge: CanvasPointerBridge | null = null;

export function setCanvasPointerBridge(next: CanvasPointerBridge | null): void {
  bridge = next;
}

/** 창구가 없거나(헤드리스·테스트) claim 중 예외가 발생하면 null — 좌표를 지어내지 않는다. */
export function claimCanvasPointer(point: CanvasPointerPoint): CanvasGestureClaim | null {
  if (!bridge) return null;
  try {
    return bridge.claim(point);
  } catch {
    // 씬이 파괴되거나 전환 중일 때 오버레이가 살아 있어도 에러 없이 null 로 안전하게 처리
    return null;
  }
}
