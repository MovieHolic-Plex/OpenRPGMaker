import { editorState } from "@/editor/editorState";
import { requestEditorEventDeletion } from "@/editor/eventDeletion";
import {
  beginExistingEventDraft,
  createEventDraft,
  discardEventDraft,
  saveEventDraft,
} from "@/editor/eventDraftActions";
import { store } from "@/project/store";
import type { MapId } from "@/project/types";
import { clearChildren, el } from "@/util/dom";
import { renderEventEditorDynamic, renderEventEditorStable } from "./content";
import { attachWindowDrag } from "./modalDrag";
import { attachWindowResize, renderModalResizeHandle } from "./modalResize";

const EVENT_EDITOR_MODAL_TEST_ID = "event-editor-modal";
const EVENT_EDITOR_CLOSE_EVENT = "rpgzzu:event-editor-close";

type OpenEventEditorRequest = {
  readonly mapId: MapId;
  readonly eventId: string;
};

export function openEventEditorModal(mapId: MapId, eventId: string): void {
  closeExistingEventEditorModal();
  if (!beginExistingEventDraft(mapId, eventId)) return;
  openDraftEventEditorModal({ mapId, eventId });
}

export function openNewEventEditorModal(mapId: MapId, x: number, y: number): string {
  closeExistingEventEditorModal();
  const eventId = createEventDraft(mapId, x, y);
  if (!eventId) return "";
  openDraftEventEditorModal({ mapId, eventId });
  return eventId;
}

function openDraftEventEditorModal(request: OpenEventEditorRequest): void {
  const backdrop = el("div", {
    class: "event-editor-modal-backdrop",
    dataset: { testid: EVENT_EDITOR_MODAL_TEST_ID, mapId: request.mapId, eventId: request.eventId },
  });
  const windowEl = el("section", {
    class: "event-editor-modal-window",
    attrs: { role: "dialog", "aria-modal": "true", "aria-label": "이벤트 에디터" },
  });
  const body = el("div", { class: "event-editor-modal-body" });
  const stableBody = el("div", { class: "event-editor-modal-stable" });
  const dynamicBody = el("div", { class: "event-editor-modal-dynamic" });
  body.append(dynamicBody, stableBody);
  const close = createCloseHandler(backdrop);
  const header = renderModalHeader(request.mapId, request.eventId, close);
  attachWindowDrag(header, windowEl);
  const resizeHandle = renderModalResizeHandle();
  attachWindowResize(resizeHandle, windowEl);
  windowEl.append(header, body, renderModalFooter(request, close), resizeHandle);
  backdrop.append(windowEl);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  let stableRendered = false;
  const refresh = () => {
    if (!stableRendered) {
      clearChildren(stableBody);
      renderEventEditorStable(stableBody, request.mapId, request.eventId);
      stableRendered = true;
    }
    clearChildren(dynamicBody);
    renderEventEditorDynamic(dynamicBody, request.mapId, request.eventId);
  };
  const unsubscribeStore = store.subscribe(refresh);
  const unsubscribeEditor = editorState.subscribe(refresh);
  backdrop.addEventListener("keydown", (event) => handleModalKeyDown(event, request, close));
  backdrop.addEventListener(EVENT_EDITOR_CLOSE_EVENT, (event) => {
    const saved = event instanceof CustomEvent && event.detail?.saved === true;
    if (!saved) discardEventDraft(request.mapId, request.eventId);
    unsubscribeStore();
    unsubscribeEditor();
  });
  document.body.append(backdrop);
  refresh();
  focusFirstDialogControl(backdrop);
}

export function isEventEditorModalOpenFor(mapId: MapId, eventId: string): boolean {
  const modal = document.querySelector(`[data-testid='${EVENT_EDITOR_MODAL_TEST_ID}']`);
  return modal instanceof HTMLElement && modal.dataset.mapId === mapId && modal.dataset.eventId === eventId;
}

function closeExistingEventEditorModal(): void {
  const existing = document.querySelector(`[data-testid='${EVENT_EDITOR_MODAL_TEST_ID}']`);
  if (existing instanceof HTMLElement) {
    existing.dispatchEvent(new CustomEvent(EVENT_EDITOR_CLOSE_EVENT));
    existing.remove();
  }
}

function renderModalHeader(mapId: MapId, eventId: string, close: () => void): HTMLElement {
  return el("div", {
    class: "event-editor-modal-header",
    dataset: { testid: "event-editor-titlebar" },
    children: [
      el("div", {
        class: "event-editor-window-title",
        children: [el("h2", { text: `이벤트 에디터 · ID:${displayEventNumber(mapId, eventId)}` })],
      }),
      el("div", {
        class: "event-editor-window-controls",
        attrs: { "aria-hidden": "true" },
        children: [
          el("button", { class: "event-editor-window-control", text: "−", attrs: { type: "button", tabindex: "-1", title: "최소화" } }),
          el("button", { class: "event-editor-window-control", text: "□", attrs: { type: "button", tabindex: "-1", title: "최대화" } }),
        ],
      }),
      el("button", {
        class: "event-editor-window-control event-editor-modal-close",
        text: "×",
        attrs: { type: "button", title: "닫기" },
        dataset: { testid: "event-editor-modal-close" },
        on: { click: () => close() },
      }),
    ],
  });
}

function renderModalFooter(request: OpenEventEditorRequest, close: (saved?: boolean) => void): HTMLElement {
  return el("div", {
    class: "event-editor-modal-footer",
    children: [
      el("button", {
        class: "event-editor-footer-settings",
        text: "⚙",
        attrs: { type: "button", title: "설정", "aria-label": "설정" },
      }),
      el("div", {
        class: "event-editor-footer-actions",
        children: [
          footerButton("삭제", "event-delete", () => {
            if (requestEditorEventDeletion(request.mapId, request.eventId)) close(true);
          }),
          footerButton("확인", "event-editor-ok", () => {
            saveEventDraft(request.mapId, request.eventId);
            close(true);
          }, true),
          footerButton("취소", "event-editor-cancel", () => close()),
          footerButton("적용", "event-editor-apply", () => {
            saveEventDraft(request.mapId, request.eventId);
            beginExistingEventDraft(request.mapId, request.eventId);
          }),
          footerButton("도움말", "event-editor-help"),
        ],
      }),
    ],
  });
}

function footerButton(text: string, testId: string, onClick?: () => void, primary = false): HTMLButtonElement {
  const props = {
    class: "btn event-editor-footer-button" + (primary ? " primary" : ""),
    text,
    attrs: { type: "button", "aria-label": footerButtonAccessibleName(text) },
    dataset: { testid: testId },
    on: onClick ? { click: onClick } : undefined,
  };
  return el("button", props) as HTMLButtonElement;
}

function handleModalKeyDown(
  event: KeyboardEvent,
  request: OpenEventEditorRequest,
  close: (saved?: boolean) => void
): void {
  if (event.key === "Escape") {
    close();
    return;
  }
  if (event.key !== "Delete" || event.ctrlKey || event.metaKey || event.altKey) return;
  if (isTextEditingTarget(event.target)) return;
  event.preventDefault();
  if (requestEditorEventDeletion(request.mapId, request.eventId)) close(true);
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function footerButtonAccessibleName(text: string): string {
  switch (text) {
    case "확인":
      return "확인 OK";
    case "취소":
      return "취소 Cancel";
    case "적용":
      return "적용 Apply";
    case "도움말":
      return "도움말 Help";
    default:
      return text;
  }
}

function createCloseHandler(backdrop: HTMLElement): (saved?: boolean) => void {
  let closed = false;
  return (saved = false) => {
    if (closed) return;
    closed = true;
    backdrop.dispatchEvent(new CustomEvent(EVENT_EDITOR_CLOSE_EVENT, { detail: { saved: saved === true } }));
    backdrop.remove();
  };
}

function focusFirstDialogControl(root: HTMLElement): void {
  const first = root.querySelector<HTMLElement>(
    ".event-editor-modal-body input:not(:disabled), " +
      ".event-editor-modal-body select:not(:disabled), " +
      ".event-editor-modal-body textarea:not(:disabled), " +
      ".event-editor-modal-body button:not(:disabled), " +
      "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)"
  );
  if (first instanceof HTMLElement) first.focus({ preventScroll: true });
  root.scrollTo({ left: 0, top: 0 });
}

function displayEventNumber(mapId: MapId, eventId: string): string {
  const events = store.getCurrent().maps[mapId]?.events ?? [];
  const index = events.findIndex((event) => event.id === eventId);
  return String(index >= 0 ? index + 1 : 1).padStart(4, "0");
}
