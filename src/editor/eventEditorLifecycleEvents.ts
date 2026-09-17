// editor/eventEditorLifecycleEvents.ts
// 이벤트 편집기 모달의 수명 이벤트(window 수준). 맵 씬(EditScene)처럼 모달 DOM 을 모르는 쪽이
// 「편집기가 닫혔다」를 알아야 할 때 쓴다.
//
// 왜(2026-09-17 적대적 리뷰 P0-4): 2페이지를 보다가 편집기를 닫으면 맵이 2페이지 그래픽을 그대로
// 그렸고(NPC 가 빈 칸으로 보임), 「편집 위치 46,41」 배너도 닫힌 뒤 남았다. 둘 다 편집 중 크롬이다.

export const EVENT_EDITOR_CLOSED_WINDOW_EVENT = "oprn:event-editor-closed";

export interface EventEditorClosedDetail {
  readonly mapId: string;
  readonly eventId: string;
  readonly saved: boolean;
}

export function announceEventEditorClosed(detail: EventEditorClosedDetail): void {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  window.dispatchEvent(new CustomEvent<EventEditorClosedDetail>(EVENT_EDITOR_CLOSED_WINDOW_EVENT, { detail }));
}
