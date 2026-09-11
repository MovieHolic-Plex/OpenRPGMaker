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

/**
 * 오버레이가 캔버스에 넘기는 「이벤트를 열어라」 요청 (2026-09-12).
 *
 * 왜 좌표가 아니라 id 인가: 판정(어느 이벤트가 이 칸을 덮는가)은 오버레이가 하고, 여는 일은
 * 이벤트 편집기를 아는 쪽이 한다. 좌표를 넘기면 그 사이에 맵이 바뀌었을 때 다른 이벤트를 연다.
 */
export type CanvasOpenEventRequest = {
  readonly mapId: string;
  readonly eventId: string;
};

export type CanvasPointerBridge = {
  /** 이 pointerdown 의 주인. null 이면 오버레이가 가져간다. */
  readonly claim: (point: CanvasPointerPoint) => CanvasGestureClaim | null;
  /**
   * 그 칸을 덮는 이벤트의 id. 로케이션 그리기와 이벤트가 겹칠 때 규칙을 정하는 입력이다.
   * 창구가 없으면(헤드리스·테스트) null — 좌표를 지어내지 않는다.
   */
  readonly eventIdAt: (point: CanvasPointerPoint) => string | null;
  /** 그 이벤트를 편집기로 연다. 로케이션 오버레이가 손을 떼고 이 경로로 넘긴다. */
  readonly openEvent: (request: CanvasOpenEventRequest) => void;
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

/** 그 칸을 덮는 이벤트 id. 창구가 없으면 null(겹침 없음으로 취급). */
export function eventIdAtPoint(point: CanvasPointerPoint): string | null {
  if (!bridge) return null;
  try {
    return bridge.eventIdAt(point);
  } catch {
    return null;
  }
}

/** 이벤트 편집기를 연다. 창구가 없으면 아무 일도 하지 않는다(테스트·헤드리스). */
export function openEventFromCanvas(request: CanvasOpenEventRequest): void {
  if (!bridge) return;
  try {
    bridge.openEvent(request);
  } catch {
    // 전환 중 실패는 삼킨다 — 이 경로는 «이벤트를 열어 준다» 는 부가 기능이고,
    // 실패해도 그리기 자체를 막아서는 안 된다.
  }
}
