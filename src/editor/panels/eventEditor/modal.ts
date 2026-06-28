import { editorState } from "@/editor/editorState";
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

const EVENT_EDITOR_MODAL_TEST_ID = "event-editor-modal";

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
  windowEl.append(header, body, renderModalFooter(request, close));
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
  backdrop.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
  backdrop.addEventListener("rpgzzu:event-editor-close", (event) => {
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
    existing.dispatchEvent(new CustomEvent("rpgzzu:event-editor-close"));
    existing.remove();
  }
}

function renderModalHeader(mapId: MapId, eventId: string, close: () => void): HTMLElement {
  return el("div", {
    class: "event-editor-modal-header",
    dataset: { testid: "event-editor-titlebar" },
    children: [
      el("div", { children: [el("h2", { text: `이벤트 에디터 - ID:${displayEventNumber(mapId, eventId)}` })] }),
      el("button", {
        class: "btn event-editor-modal-close",
        text: "X",
        attrs: { type: "button", title: "닫기" },
        dataset: { testid: "event-editor-modal-close" },
        on: { click: close },
      }),
    ],
  });
}

type DragState = {
  readonly pointerId: number;
  readonly startPointerX: number;
  readonly startPointerY: number;
  readonly startX: number;
  readonly startY: number;
  readonly startTranslateX: number;
  readonly startTranslateY: number;
};

function attachWindowDrag(handle: HTMLElement, windowEl: HTMLElement): void {
  let translateX = 0;
  let translateY = 0;
  let drag: DragState | null = null;

  handle.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("button, input, select, textarea, a")) return;
    const rect = windowEl.getBoundingClientRect();
    drag = {
      pointerId: event.pointerId,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startX: rect.left,
      startY: rect.top,
      startTranslateX: translateX,
      startTranslateY: translateY,
    };
    windowEl.classList.add("dragging");
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  handle.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const rect = windowEl.getBoundingClientRect();
    const nextX = clamp(drag.startX + event.clientX - drag.startPointerX, 0, window.innerWidth - Math.min(rect.width, 160));
    const nextY = clamp(drag.startY + event.clientY - drag.startPointerY, 0, window.innerHeight - handle.offsetHeight);
    translateX = drag.startTranslateX + nextX - drag.startX;
    translateY = drag.startTranslateY + nextY - drag.startY;
    windowEl.style.transform = `translate(${Math.round(translateX)}px, ${Math.round(translateY)}px)`;
  });

  const stopDrag = (event: PointerEvent): void => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag = null;
    windowEl.classList.remove("dragging");
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
  };

  handle.addEventListener("pointerup", stopDrag);
  handle.addEventListener("pointercancel", stopDrag);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function renderModalFooter(request: OpenEventEditorRequest, close: (saved?: boolean) => void): HTMLElement {
  return el("div", {
    class: "event-editor-modal-footer",
    children: [
      footerButton("OK", "event-editor-ok", () => {
        saveEventDraft(request.mapId, request.eventId);
        close(true);
      }),
      footerButton("Cancel", "event-editor-cancel", close),
      footerButton("Apply", "event-editor-apply", () => {
        saveEventDraft(request.mapId, request.eventId);
        beginExistingEventDraft(request.mapId, request.eventId);
      }),
      footerButton("Help", "event-editor-help"),
    ],
  });
}

function footerButton(text: string, testId: string, onClick?: () => void): HTMLButtonElement {
  const props = {
    class: "btn event-editor-footer-button",
    text,
    attrs: { type: "button" },
    dataset: { testid: testId },
    on: onClick ? { click: onClick } : undefined,
  };
  return el("button", props) as HTMLButtonElement;
}

function createCloseHandler(backdrop: HTMLElement): (saved?: boolean) => void {
  return (saved = false) => {
    backdrop.dispatchEvent(new CustomEvent("rpgzzu:event-editor-close", { detail: { saved } }));
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
