import { editorState } from "@/editor/editorState";
import { requestEditorEventDeletion } from "@/editor/eventDeletion";
import { handleHistoryHotkey } from "@/editor/hotkeys";
import {
  beginExistingEventDraft,
  checkpointEventDraft,
  createEventDraft,
  discardEventDraft,
  saveEventDraft,
} from "@/editor/eventDraftActions";
import { store } from "@/project/store";
import type { MapId } from "@/project/types";
import { clearChildren, el } from "@/util/dom";
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { openEventEditorHelp } from "./eventEditorHelp";
import { renderEventEditorDynamic, renderEventEditorStable } from "./content";
import { attachWindowDrag } from "./modalDrag";
import { attachWindowResize, renderModalResizeHandle } from "./modalResize";

const EVENT_EDITOR_MODAL_TEST_ID = "event-editor-modal";
const EVENT_EDITOR_CLOSE_EVENT = "rpgzzu:event-editor-close";
const EVENT_EDITOR_CHECKPOINT_MS = 1500;

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
  // Layered Escape: topmost modal (command subdialog / picker) closes first.
  let closed = false;
  const closeHandler = (saved = false): void => {
    if (closed) return;
    closed = true;
    unregisterModal(backdrop);
    backdrop.dispatchEvent(new CustomEvent(EVENT_EDITOR_CLOSE_EVENT, { detail: { saved: saved === true } }));
    backdrop.remove();
  };
  registerModal(backdrop, () => closeHandler(false));
  const header = renderModalHeader(request.mapId, request.eventId, () => closeHandler(false));
  attachWindowDrag(header, windowEl);
  const resizeHandle = renderModalResizeHandle();
  attachWindowResize(resizeHandle, windowEl);
  windowEl.append(header, body, renderModalFooter(request, closeHandler), resizeHandle);
  backdrop.append(windowEl);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeHandler(false);
  });
  let stableRendered = false;
  const refresh = () => {
    // Full dynamic re-render resets overflow; restore scroll so edits in the lower
    // page-prop grid (graphic / movement / living destinations) do not jump to top.
    const scrollSnapshots = captureEventEditorScroll(dynamicBody);
    // If a store race dropped the event, reattach from vault before paint.
    const live = store.getCurrent().maps[request.mapId]?.events.some((event) => event.id === request.eventId);
    if (!live) store.restoreEventDraftFromVault(request.mapId, request.eventId);
    if (!stableRendered) {
      clearChildren(stableBody);
      renderEventEditorStable(stableBody, request.mapId, request.eventId);
      stableRendered = true;
    }
    clearChildren(dynamicBody);
    renderEventEditorDynamic(dynamicBody, request.mapId, request.eventId);
    restoreEventEditorScroll(dynamicBody, scrollSnapshots);
    // Keep title in sync when draft meta changes after autosave reattach.
    const title = header.querySelector("h2");
    if (title) title.textContent = eventEditorTitle(request.mapId, request.eventId);
  };
  const unsubscribeStore = store.subscribe(refresh);
  const unsubscribeEditor = editorState.subscribe(refresh);
  const checkpointTimer = globalThis.setInterval(() => {
    checkpointEventDraft(request.mapId, request.eventId);
  }, EVENT_EDITOR_CHECKPOINT_MS);
  backdrop.addEventListener("keydown", (event) => handleModalKeyDown(event, request, closeHandler));
  backdrop.addEventListener(EVENT_EDITOR_CLOSE_EVENT, (event) => {
    const saved = event instanceof CustomEvent && event.detail?.saved === true;
    globalThis.clearInterval(checkpointTimer);
    if (!saved) discardEventDraft(request.mapId, request.eventId);
    unsubscribeStore();
    unsubscribeEditor();
  });
  document.body.append(backdrop);
  // Immediate durable checkpoint so a crash right after open still recovers.
  checkpointEventDraft(request.mapId, request.eventId);
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
    unregisterModal(existing);
    existing.dispatchEvent(new CustomEvent(EVENT_EDITOR_CLOSE_EVENT));
    existing.remove();
  }
}

function renderModalHeader(mapId: MapId, eventId: string, close: () => void): HTMLElement {
  // [낮음-1] 타이틀에 이벤트 이름과 좌표까지 표기 — 어느 이벤트를 편집 중인지 즉시 식별.
  // [낮음-2] 동작이 없던 최소화/최대화 장식 버튼 제거.
  return el("div", {
    class: "event-editor-modal-header",
    dataset: { testid: "event-editor-titlebar" },
    children: [
      el("div", {
        class: "event-editor-window-title",
        children: [el("h2", { text: eventEditorTitle(mapId, eventId) })],
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

function eventEditorTitle(mapId: MapId, eventId: string): string {
  const event = store.getCurrent().maps[mapId]?.events.find((entry) => entry.id === eventId);
  const base = event?.draft?.kind === "new"
    ? `새 이벤트 (저장 전) · ID:${displayEventNumber(mapId, eventId)}`
    : `이벤트 에디터 · ID:${displayEventNumber(mapId, eventId)}`;
  if (!event) return base;
  const name = eventDisplayNameOf(event);
  return name ? `${base} · ${name} (${event.x},${event.y})` : `${base} (${event.x},${event.y})`;
}

function eventDisplayNameOf(event: { readonly pages?: readonly { readonly name: string }[] }): string {
  const pages = event.pages ?? [];
  for (let index = pages.length - 1; index >= 0; index -= 1) {
    const name = pages[index]?.name.trim();
    if (name) return name;
  }
  return "";
}

function renderModalFooter(request: OpenEventEditorRequest, close: (saved?: boolean) => void): HTMLElement {
  const draftKind = store.getCurrent().maps[request.mapId]?.events.find((event) => event.id === request.eventId)?.draft?.kind;
  const cancelHint = draftKind === "new"
    ? "편집 중 내용은 자동 저장됩니다. 취소하면 이 새 이벤트를 삭제합니다."
    : "편집 중 내용은 자동 저장됩니다. 취소하면 열기 전 상태로 되돌립니다.";
  return el("div", {
    class: "event-editor-modal-footer",
    children: [
      el("div", {
        class: "event-editor-footer-leading",
        children: [
          // 파괴적 동작은 확인 묶음과 분리해 좌측에 둔다.
          el("div", {
            class: "event-editor-footer-danger",
            children: [
              footerButton("삭제", "event-delete", () => {
                if (requestEditorEventDeletion(request.mapId, request.eventId)) close(true);
              }),
            ],
          }),
          el("span", {
            class: "event-editor-draft-status",
            text: cancelHint,
            dataset: { testid: "event-editor-draft-status" },
          }),
        ],
      }),
      el("div", {
        class: "event-editor-footer-actions",
        children: [
          footerButton("취소", "event-editor-cancel", () => close()),
          footerButton("적용", "event-editor-apply", () => {
            saveEventDraft(request.mapId, request.eventId);
            beginExistingEventDraft(request.mapId, request.eventId);
          }),
          footerButton("확인", "event-editor-ok", () => {
            saveEventDraft(request.mapId, request.eventId);
            close(true);
          }, true),
          footerButton("도움말", "event-editor-help", () => openEventEditorHelp()),
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
  // Escape is owned by the document-level modal stack (topmost first).
  if (event.key === "Escape") return;
  // 이벤트 에디터 모달이 열려 있어도 Ctrl+Z/Y 로 undo/redo. store 구독으로 자동 재렌더된다.
  if (handleHistoryHotkey(event)) return;
  if (event.key !== "Delete" || event.ctrlKey || event.metaKey || event.altKey) return;
  if (isTextEditingTarget(event.target)) return;

  // 실행 내용(명령 리스트/툴바) 포커스 중 Delete 는 절대 이벤트 삭제로 가지 않는다.
  // 명령 줄 자체 keydown 이 명령 삭제를 처리하고 stopPropagation 한다.
  // 여기로 오는 경우는 툴바/빈 영역 포커스 — 무시.
  if (isCommandListSurface(event.target)) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  event.preventDefault();
  if (requestEditorEventDeletion(request.mapId, request.eventId)) close(true);
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function isCommandListSurface(target: EventTarget | null): boolean {
  // fakeDom 의 matchesSelector 는 콤마 선택자를 못 파싱한다 — 개별 루트로 검사.
  if (!target || typeof (target as Element).closest !== "function") return false;
  const el = target as Element;
  return Boolean(
    el.closest(".cmd-list")
    || el.closest(".event-editor-command-toolbar")
    || el.closest(".event-editor-commands-column")
    || el.closest(".event-contents")
    || el.closest("[data-testid='event-command-context-menu']")
  );
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

/** Scroll hosts that reappear after every store/editor re-render of the dynamic body. */
const EVENT_EDITOR_SCROLL_SELECTORS = [
  ".event-editor-settings-main",
  ".event-page-props",
  ".event-page-number-tabs",
  ".cmd-list",
  ".event-editor-commands-column",
] as const;

type EventEditorScrollSnapshot = {
  readonly selector: (typeof EVENT_EDITOR_SCROLL_SELECTORS)[number];
  readonly left: number;
  readonly top: number;
};

function captureEventEditorScroll(root: HTMLElement): readonly EventEditorScrollSnapshot[] {
  return EVENT_EDITOR_SCROLL_SELECTORS.flatMap((selector) => {
    const element = root.querySelector(selector);
    if (!(element instanceof HTMLElement)) return [];
    return [{
      selector,
      left: readScrollNumber(element, "scrollLeft"),
      top: readScrollNumber(element, "scrollTop"),
    }];
  });
}

function restoreEventEditorScroll(root: HTMLElement, snapshots: readonly EventEditorScrollSnapshot[]): void {
  applyEventEditorScroll(root, snapshots);
  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") return;
  // Layout can settle after paint (images / grid); re-apply once so the jump does not return.
  window.requestAnimationFrame(() => applyEventEditorScroll(root, snapshots));
}

function applyEventEditorScroll(root: HTMLElement, snapshots: readonly EventEditorScrollSnapshot[]): void {
  for (const snapshot of snapshots) {
    if (snapshot.left === 0 && snapshot.top === 0) continue;
    const element = root.querySelector(snapshot.selector);
    if (!(element instanceof HTMLElement)) continue;
    element.scrollLeft = snapshot.left;
    element.scrollTop = snapshot.top;
  }
}

function readScrollNumber(node: HTMLElement, key: "scrollLeft" | "scrollTop"): number {
  const value = (node as unknown as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function displayEventNumber(mapId: MapId, eventId: string): string {
  const events = store.getCurrent().maps[mapId]?.events ?? [];
  const index = events.findIndex((event) => event.id === eventId);
  return String(index >= 0 ? index + 1 : 1).padStart(4, "0");
}
