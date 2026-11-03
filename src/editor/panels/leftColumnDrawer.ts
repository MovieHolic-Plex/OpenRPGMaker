// src/editor/panels/leftColumnDrawer.ts
/**
 * 왼쪽 한 칸(aiSidebarWorkspace)을 밖에서 움직이는 신호. 명령 레지스트리가 사이드바 모듈 전체를
 * 끌어오지 않도록 신호만 따로 둔다. 서랍은 맵·타일 자리를 잠시 덮는 패널 하나다.
 */
export const LEFT_DRAWER_EVENT = "oprn:left-drawer";
export const LEFT_COLUMN_TOGGLE_EVENT = "oprn:left-column-toggle";
export const LEFT_INSPECT_EVENT = "oprn:left-inspect";

export const LEFT_DRAWERS = ["props", "progress", "links", "workshop", "store"] as const;
export type LeftDrawerId = (typeof LEFT_DRAWERS)[number];

export function isLeftDrawerId(value: unknown): value is LeftDrawerId {
  return typeof value === "string" && (LEFT_DRAWERS as readonly string[]).includes(value);
}

export function openLeftDrawer(id: LeftDrawerId): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(LEFT_DRAWER_EVENT, { detail: id }));
}

export function toggleLeftColumn(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(LEFT_COLUMN_TOGGLE_EVENT));
}

/** 왼쪽 열이 있으면 열이 검사를 연다(이벤트·지형 모드에서 타일로 돌리고 접힘을 푼다). 없으면 false. */
export function openLeftInspection(): boolean {
  if (typeof document === "undefined" || !document.querySelector('[data-testid="editor-ai-sidebar"]')) return false;
  window.dispatchEvent(new Event(LEFT_INSPECT_EVENT));
  return true;
}
