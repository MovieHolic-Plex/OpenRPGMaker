/** Module-level open-state for event editor progressive disclosure.
 * Keys are `mapId:eventId:pageId`. Never written into EventPage schema.
 */

export type EventEditorOpenKey = string;

export const openEventConditions = new Set<EventEditorOpenKey>();
export const openEventMovement = new Set<EventEditorOpenKey>();
export const openEventAdvanced = new Set<EventEditorOpenKey>();

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
