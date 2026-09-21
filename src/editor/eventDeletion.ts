import { deleteEvent } from "@/editor/eventActions";
import { editorState } from "@/editor/editorState";
import { recordProjectSnapshot, undoMapEdit } from "@/editor/mapEditHistory";
import { forgetEventDraftVaultEntry, persistEventDraftVaultNow } from "@/project/eventDraftVault";
import { eventDraftHasUserChanges } from "@/project/eventDrafts";
import { store } from "@/project/store";
import type { MapId } from "@/project/types";
import { toast } from "@/util/toast";

const EVENT_DELETE_CONFIRMATION_MESSAGE = "이 이벤트를 삭제할까요?\n삭제 후 토스트의 「복구」 또는 Ctrl+Z로 되돌릴 수 있습니다.";

export function deleteEditorEvent(mapId: MapId, eventId: string, options: { readonly silent?: boolean } = {}): boolean {
  const map = store.getCurrent().maps[mapId];
  const event = map?.events.find((entry) => entry.id === eventId);
  if (!map || !event) return false;

  const label = eventLabel(event);
  // 삭제 전 스냅샷 — Ctrl+Z / 복구 토스트가 이벤트를 살린다.
  recordProjectSnapshot(`이벤트 삭제: ${label}`, mapId, { kind: "map", includeEventDrafts: true });

  // Drop vault first so preserve-on-replace cannot resurrect a deleted event.
  forgetEventDraftVaultEntry(mapId, eventId);
  persistEventDraftVaultNow();
  deleteEvent(mapId, eventId);
  if (editorState.get().selectedEventId === eventId) {
    editorState.set({ selectedEventId: null, selectedEventPageId: null });
  }

  if (!options.silent) {
    toast(`이벤트 「${label}」을(를) 삭제했습니다.`, {
      kind: "ok",
      durationMs: 7000,
      action: {
        label: "복구",
        testid: "toast-event-delete-restore",
        onClick: () => {
          if (undoMapEdit()) {
            toast("이벤트를 복구했습니다.", "ok");
          } else {
            toast("복구할 기록이 없습니다.", "error");
          }
        },
      },
    });
  }
  return true;
}

export function requestEditorEventDeletion(mapId: MapId, eventId: string): boolean {
  const map = store.getCurrent().maps[mapId];
  if (!map?.events.some((event) => event.id === eventId)) return false;
  if (!confirmEventDeletion(mapId, eventId)) return false;
  return deleteEditorEvent(mapId, eventId);
}

export function deleteSelectedEditorEvent(): boolean {
  const state = editorState.get();
  const eventId = state.selectedEventId;
  if (!eventId) return false;
  const mapId = state.currentMapId ?? store.getCurrent().startMapId;
  return requestEditorEventDeletion(mapId, eventId);
}

function confirmEventDeletion(mapId: MapId, eventId: string): boolean {
  if (typeof globalThis.confirm !== "function") return false;
  const map = store.getCurrent().maps[mapId];
  const event = map?.events.find((entry) => entry.id === eventId);
  const label = event ? eventLabel(event) : eventId;
  const hasDraftChanges = eventDraftHasUserChanges(store.getCurrent(), mapId, eventId);
  const draftWarning = hasDraftChanges ? "\n저장하지 않은 편집 내용도 함께 삭제됩니다." : "";
  return globalThis.confirm(`「${label}」 이벤트를 삭제할까요?${draftWarning}\n삭제 후 토스트의 「복구」 또는 Ctrl+Z로 되돌릴 수 있습니다.`);
}

function eventLabel(event: { readonly id: string; readonly pages?: readonly { readonly name?: string }[] }): string {
  const pageName = event.pages?.[0]?.name?.trim();
  if (pageName) return pageName;
  return event.id;
}

// re-export message for tests/docs
export const EVENT_DELETE_CONFIRM_HINT = EVENT_DELETE_CONFIRMATION_MESSAGE;
