import { editorState } from "@/editor/editorState";
import { createDefaultGameEvent } from "@/editor/eventActions";
import { describeEventDiff, eventDiffFields } from "@/editor/eventDiffLabel";
import { eventDisplayName } from "@/editor/eventMarkerUx";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import {
  beginEventEditDraft,
  commitEventDraft,
  discardEventDraft as discardProjectEventDraft,
  eventDraftDiffById,
  eventWithoutDraft,
  type EventDiff,
} from "@/project/eventDrafts";
import {
  forgetEventDraftVaultEntry,
  persistEventDraftVaultNow,
  rememberEventDraftVaultEntry,
} from "@/project/eventDraftVault";
import { store } from "@/project/store";
import type { GameEvent, MapId, Trigger } from "@/project/types";

export function createEventDraft(
  mapId: MapId,
  x: number,
  y: number,
  trigger: Trigger = { kind: "action" }
): string {
  let newId = "";
  let selectedPageId: string | null = null;
  store.update(
    (project) => {
      const map = project.maps[mapId];
      if (!map || x < 0 || y < 0 || x >= map.width || y >= map.height) return;
      const event = createDefaultGameEvent(x, y, trigger);
      // original = 생성 직후 스냅샷: "손댔는가" 판정 기준(eventDraftHasUserChanges).
      event.draft = { kind: "new", original: eventWithoutDraft(event) };
      map.events.push(event);
      newId = event.id;
      selectedPageId = event.pages?.[event.pages.length - 1]?.id ?? null;
      rememberEventDraftVaultEntry(mapId, event);
    },
    { scope: "map", mapId, label: `이벤트 생성 (${x},${y})` },
  );
  if (newId) {
    editorState.set({ selectedEventId: newId, selectedEventPageId: selectedPageId });
    persistEventDraftVaultNow();
  }
  return newId;
}

export function beginExistingEventDraft(mapId: MapId, eventId: string): boolean {
  const event = store.getCurrent().maps[mapId]?.events.find((item) => item.id === eventId);
  if (!event || event.draft?.kind === "new") return false;
  if (event.draft?.kind === "edit") {
    rememberEventDraftVaultEntry(mapId, event);
    selectEventPage(mapId, eventId, editorState.get().selectedEventPageId);
    return true;
  }
  let opened = false;
  store.update(
    (project) => {
      opened = beginEventEditDraft(project, mapId, eventId);
      if (opened) {
        const draftEvent = project.maps[mapId]?.events.find((item) => item.id === eventId);
        if (draftEvent) rememberEventDraftVaultEntry(mapId, draftEvent);
      }
    },
    { scope: "map", mapId, label: `이벤트 편집 시작: ${eventDisplayName(event)}`, origin: "system", eventId },
  );
  if (opened) {
    selectEventPage(mapId, eventId, editorState.get().selectedEventPageId);
    persistEventDraftVaultNow();
  }
  return opened;
}

export function saveEventDraft(mapId: MapId, eventId: string): EventDiff | null {
  const event = store.getCurrent().maps[mapId]?.events.find((item) => item.id === eventId);
  if (!event?.draft) return null;
  const preferredPageId = editorState.get().selectedEventPageId;
  // diff 를 **커밋 전에** 읽는다. commitEventDraft 는 draft 를 지우므로 그 뒤에는 계산할 수 없고,
  // recordProjectSnapshot 은 이 시점에 라벨을 확정해야 한다(전에는 상수 "이벤트 편집" 이었다).
  const preview = eventDraftDiffById(store.getCurrent(), mapId, eventId);
  const label = describeEventDiff(preview, eventDisplayName(event));
  const fields = eventDiffFields(preview);
  recordProjectSnapshot(label, mapId, { kind: "map" });
  let diff: EventDiff | null = null;
  store.update(
    (project) => {
      diff = commitEventDraft(project, mapId, eventId);
    },
    { scope: "map", mapId, label, eventId, ...(fields.length > 0 ? { fields } : {}) },
  );
  forgetEventDraftVaultEntry(mapId, eventId);
  persistEventDraftVaultNow();
  selectEventPage(mapId, eventId, preferredPageId);
  return diff;
}

export function discardEventDraft(mapId: MapId, eventId: string): boolean {
  const draftKind = store.getCurrent().maps[mapId]?.events.find((event) => event.id === eventId)?.draft?.kind;
  if (!draftKind) {
    forgetEventDraftVaultEntry(mapId, eventId);
    persistEventDraftVaultNow();
    return false;
  }
  // Forget vault first so store.update's vault sync cannot resurrect a discarded draft.
  forgetEventDraftVaultEntry(mapId, eventId);
  let discarded = false;
  store.update(
    (project) => {
      discarded = discardProjectEventDraft(project, mapId, eventId);
    },
    {
      scope: "map",
      mapId,
      // 폐기는 "아무 일도 없었다" 가 아니다 — 사용자가 편집을 버렸다는 사실 자체가
      // "내가 고친 게 왜 없지?" 를 추적할 때 필요한 정보다.
      label: draftKind === "new" ? "이벤트 생성 취소" : "이벤트 편집 취소",
      eventId,
    },
  );
  persistEventDraftVaultNow();
  if (draftKind === "new") {
    editorState.set({ selectedEventId: null, selectedEventPageId: null });
    return discarded;
  }
  selectEventPage(mapId, eventId, editorState.get().selectedEventPageId);
  return discarded;
}

/**
 * Checkpoint open draft into the durable vault (localStorage).
 * The working body lives only in the editor session/vault until Apply; canonical
 * autosave/export keeps the pre-edit project body. This refreshes crash recovery
 * without thrashing store listeners.
 */
export function checkpointEventDraft(mapId: MapId, eventId: string): boolean {
  const event = store.getCurrent().maps[mapId]?.events.find((item) => item.id === eventId);
  if (!event?.draft) return false;
  rememberEventDraftVaultEntry(mapId, event);
  persistEventDraftVaultNow();
  return true;
}

function selectEventPage(mapId: MapId, eventId: string, preferredPageId: string | null): void {
  const event = store.getCurrent().maps[mapId]?.events.find((item) => item.id === eventId);
  const pageId = event ? selectedPageId(event, preferredPageId) : null;
  editorState.set({
    selectedEventId: event ? eventId : null,
    selectedEventPageId: pageId,
  });
}

function selectedPageId(event: GameEvent, preferredPageId: string | null): string | null {
  const pages = event.pages ?? [];
  if (preferredPageId && pages.some((page) => page.id === preferredPageId)) return preferredPageId;
  return pages[0]?.id ?? null;
}
