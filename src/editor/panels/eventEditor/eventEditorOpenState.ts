/** Module-level open-state for event editor progressive disclosure.
 * Keys are `mapId:eventId:pageId`. Never written into EventPage schema.
 */

export type EventEditorOpenKey = string;

export const openEventConditions = new Set<EventEditorOpenKey>();
export const openEventMovement = new Set<EventEditorOpenKey>();
// `openEventAdvanced` 는 「고급 조건」 details 와 함께 삭제됐다 (2026-08-29). 조건은 이제
// 종류 구분 없이 한 목록에서 편집하므로 따로 펼쳐 둘 영역이 없다.

/**
 * 좌측 설정 레일에서 지금 펼쳐 둔 그룹 slug.
 *
 * 레일은 이제 "요약 목록 + 넓은 편집면"이라 한 번에 한 그룹만 열린다. 편집기는 값이 바뀔
 * 때마다 통째로 다시 그리므로, 이 값이 없으면 조건 하나를 건드릴 때마다 기본 그룹으로
 * 튕겨 돌아간다. 페이지 스키마에는 절대 쓰지 않는다(다른 open-state 와 같은 규칙).
 */
export const activeEventRailGroup = new Map<EventEditorOpenKey, string>();

export function activeRailGroupSlug(key: EventEditorOpenKey, fallback: string): string {
  return activeEventRailGroup.get(key) ?? fallback;
}

export function eventEditorOpenKey(mapId: string, eventId: string, pageId: string): EventEditorOpenKey {
  return `${mapId}:${eventId}:${pageId}`;
}

export function isEventSectionOpen(set: Set<EventEditorOpenKey>, key: EventEditorOpenKey): boolean {
  return set.has(key);
}

export function bindEventSectionOpenState(
  details: HTMLDetailsElement,
  set: Set<EventEditorOpenKey>,
  key: EventEditorOpenKey
): void {
  details.open = set.has(key);
  details.addEventListener("toggle", () => {
    if (details.open) set.add(key);
    else set.delete(key);
  });
}
