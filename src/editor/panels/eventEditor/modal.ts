import "@/styles/event/index.css";
import { preloadRuntimeStyles } from "@/app/runtimeStyles";
import { warmEditorPickerAssets } from "@/assets/editorAssetWarmup";
import { editorState, editorStateNeedsEventEditorRefresh } from "@/editor/editorState";
import { selectEditorMap } from "@/editor/mapSelection";
import { requestEditorEventDeletion } from "@/editor/eventDeletion";
import { eventDisplayName } from "@/editor/eventMarkerUx";
import { eventNameFromPages } from "@/project/eventDisplayName";
import { announceEventEditorClosed } from "@/editor/eventEditorLifecycleEvents";
import { commitAfterPointerGesture } from "./commitAfterPointerGesture";
import {
  beginExistingEventDraft,
  checkpointEventDraft,
  createEventDraft,
  discardEventDraft,
  saveEventDraft,
} from "@/editor/eventDraftActions";
import { updateEvent } from "@/editor/eventActions";
import { eventDraftDiffById, eventDraftHasUserChanges } from "@/project/eventDrafts";
import { showConfirm, type ConfirmOptions } from "@/editor/ui/modal";
import { validateEventDraft, type EventDraftValidation } from "@/editor/eventDraftValidator";
import { openSelectedEventTestModal } from "@/editor/panels/testPlayModal";
import { isTileCellChange, store, type AutoSaveState } from "@/project/store";
import type { MapId } from "@/project/types";
import { clearChildren, el } from "@/util/dom";
import { renderEditorIcon } from "./editorIcons";
import { renderEventIdReadout } from "./eventIdReadout";
import { isTopModal, hasOpenModalLayer, registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { clearEventAiLiveDock, focusEventAiDockInOpenEditor } from "./aiAssist";
import { clearEventAiDockOpenRequest, requestEventAiDockOpen } from "./aiDockOpenRequest";
import {
  openActiveEventCommandPicker,
  renderEventEditorDynamic,
  renderEventEditorStable,
  undoActiveEventCommands,
  clearEventCommandNavigation,
} from "./content";
import {
  navigateToEventDraftIssue,
  refreshEventValidationBell,
  renderEventValidationBell,
} from "./validationBell";
import { clearCommandToolbarHistories } from "./commandToolbarHistory";
import { clearCommandInspector, setCommandInspectorHost, setCommandSelectionListener } from "./commandInspector";
import { resetEventViewSession } from "./storyboardView";
import { installEventEditorCustomSelects } from "./customSelect";
import { attachWindowDrag } from "./modalDrag";
import { attachWindowFullscreen } from "./modalFullscreen";
import { attachWindowResize, renderModalResizeHandle } from "./modalResize";
import { toast } from "@/util/toast";
import { openEventEditorHelp } from "./eventEditorHelp";

const EVENT_EDITOR_MODAL_TEST_ID = "event-editor-modal";
const EVENT_EDITOR_CLOSE_EVENT = "oprn:event-editor-close";
const EVENT_EDITOR_CHECKPOINT_MS = 1500;
const EVENT_EDITOR_RESTORE_EVENT = "oprn:event-editor-restore";

type OpenEventEditorRequest = {
  readonly mapId: MapId;
  readonly eventId: string;
  /** 열자마자 AI 명령 도크를 펼치고 입력창으로 초점을 준다(맵 우클릭 「AI 로 이벤트 …」). */
  readonly aiDock?: boolean;
};

export function openEventEditorModal(
  mapId: MapId,
  eventId: string,
  options?: { readonly aiDock?: boolean; readonly pageId?: string },
): void {
  if (isEventEditorModalOpenFor(mapId, eventId)) {
    if (options?.pageId) editorState.set({ selectedEventPageId: options.pageId });
    // 이미 그 이벤트를 편집 중이다 — 도크가 문서에 살아 있으므로 예약이 아니라 직접 펼친다.
    // (예약은 "태어날 때" 소비되므로 여기서 남기면 다음 재렌더까지 떠돌다 샌다.)
    const modal = document.querySelector(`[data-testid='${EVENT_EDITOR_MODAL_TEST_ID}']`);
    // 복원을 **먼저** 한다. 최소화된 편집기의 도크는 hidden 부모 아래 살아 있어서, 복원 전에
    // 펼치면 보이지 않는 곳에서 초점을 뺏고 사용자는 "눌렀는데 아무 일도 안 일어났다"를 본다.
    modal?.dispatchEvent(new CustomEvent(EVENT_EDITOR_RESTORE_EVENT));
    if (options?.aiDock) focusEventAiDockInOpenEditor();
    return;
  }
  guardedCloseExistingEventEditorModal(() => {
    if (options?.pageId) editorState.set({ selectedEventPageId: options.pageId });
    if (!beginExistingEventDraft(mapId, eventId)) return;
    openDraftEventEditorModal({ mapId, eventId, aiDock: options?.aiDock });
  });
}

export function openNewEventEditorModal(
  mapId: MapId,
  x: number,
  y: number,
  onOpened?: (eventId: string) => void,
  options?: { readonly aiDock?: boolean },
): string {
  let created = "";
  guardedCloseExistingEventEditorModal(() => {
    const eventId = createEventDraft(mapId, x, y);
    if (!eventId) return;
    created = eventId;
    openDraftEventEditorModal({ mapId, eventId, aiDock: options?.aiDock });
    onOpened?.(eventId);
  });
  return created;
}

function guardedCloseExistingEventEditorModal(next: () => void): void {
  const existing = document.querySelector<HTMLElement>(`[data-testid='${EVENT_EDITOR_MODAL_TEST_ID}']`);
  if (!(existing instanceof HTMLElement)) {
    next();
    return;
  }
  if (existing.dataset.switchGuard === "true") return;
  if (hasOpenModalLayer() && !isTopModal(existing)) return;
  existing.dispatchEvent(new CustomEvent(EVENT_EDITOR_RESTORE_EVENT));
  const prevMapId = existing.dataset.mapId as MapId | undefined;
  const prevEventId = existing.dataset.eventId;
  flushPendingModalField(existing);
  const changed = prevMapId && prevEventId
    ? eventDraftHasUserChanges(store.getCurrent(), prevMapId, prevEventId)
    : false;
  if (!changed) {
    closeExistingEventEditorModal();
    next();
    return;
  }
  existing.dataset.switchGuard = "true";
  void confirmEventEditor(existing, {
    title: "편집 중인 이벤트",
    message: "먼저 열린 이벤트에 적용하지 않은 변경이 있어요.\n버리고 다른 이벤트를 열까요?",
    confirmLabel: "버리고 열기",
    cancelLabel: "계속 편집",
    danger: true,
  }).then((discard) => {
    delete existing.dataset.switchGuard;
    if (!existing.isConnected || existing.dataset.closed === "true" || !discard) return;
    closeExistingEventEditorModal();
    next();
  });
}

/** A pending discard decision cannot outlive its editor or cross a project switch. */
function confirmEventEditor(parent: HTMLElement, options: ConfirmOptions): Promise<boolean> {
  const result = showConfirm(options);
  const dialog = document.querySelector('[data-testid="app-confirm-modal"]');
  const cancel = (): void => dialog?.querySelector<HTMLElement>('[data-testid="app-modal-cancel"]')?.click();
  parent.addEventListener(EVENT_EDITOR_CLOSE_EVENT, cancel);
  return result.finally(() => parent.removeEventListener(EVENT_EDITOR_CLOSE_EVENT, cancel));
}

function openDraftEventEditorModal(request: OpenEventEditorRequest): void {
  // 명령 미리보기(대사창·전투·화면 효과)가 런타임 시트의 클래스와 --runtime-* 토큰을 쓴다.
  void preloadRuntimeStyles();
  // 예약은 반드시 첫 렌더 **전에** 남긴다. 도크는 자기가 태어날 때 이 값을 한 번 소비한다.
  // (렌더 뒤에 켜면 초안 생성의 store 갱신이 본문을 다시 그리면서 그 DOM 을 버린다.)
  if (request.aiDock) requestEventAiDockOpen(request.mapId, request.eventId);
  // The switch guard restores the old draft's map. Only a successful open
  // takes ownership of the destination, keeping its newly selected event/page.
  selectEditorMap(request.mapId, { clearEventSelection: false });
  // 그래픽/얼굴 피커는 이 모달 안에서 열린다 — 여는 순간이 아니라 지금 받아 둔다.
  void warmEditorPickerAssets();
  clearCommandToolbarHistories(`${request.mapId}:${request.eventId}:`);
  // 리스너를 먼저 떼고 비운다 — 지난 렌더의 툴바를 다시 계산하려 들지 않게.
  setCommandSelectionListener(undefined);
  clearCommandInspector();
  setCommandInspectorHost(undefined);
  // 미리보기는 확인용 보기라서 다음 열기까지 남기지 않는다 — 검색어도 같이 비운다.
  resetEventViewSession();
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
  const customSelects = installEventEditorCustomSelects(backdrop);
  let closed = false;
  let minimized = false;
  let closeGuardOpen = false;
  let disposeFocusTrap = (): void => {};
  const projectIdentity = store.getProjectIdentity();
  const ownerDocument = document;
  const opener = ownerDocument.activeElement instanceof HTMLElement ? ownerDocument.activeElement : null;
  let editingFocus: HTMLElement | null = null;
  let editingSelection: { readonly start: number; readonly end: number } | null = null;
  let minimizedPageId: string | null = null;
  const restoreChip = el("button", {
    class: "event-editor-window-restore",
    attrs: { type: "button" },
    dataset: { testid: "event-editor-window-restore" },
    children: [renderEditorIcon("expand"), el("span", { text: "이벤트 편집 계속" })],
    on: { click: () => restoreWindow() },
  });
  backdrop.addEventListener("focusin", (event) => {
    if (event.target instanceof HTMLElement && !event.target.closest(".event-editor-window-controls")) {
      editingFocus = event.target;
    }
  });
  const restoreWindow = (): void => {
    if (closed || (hasOpenModalLayer() && !isTopModal(backdrop))) return;
    if (minimized) {
      // Keep refresh suspended while the canvas selection returns to this draft.
      editorState.set({ currentMapId: request.mapId, selectedEventId: request.eventId, selectedEventPageId: minimizedPageId });
      minimized = false;
      backdrop.hidden = false;
      restoreChip.remove();
      document.body.classList.add("event-editor-modal-open");
      registerModal(backdrop, requestModalEscape);
      disposeFocusTrap = installFocusTrap(backdrop, windowEl);
    }
    if (editingFocus?.isConnected) {
      editingFocus.focus({ preventScroll: true });
      if (editingSelection && (editingFocus instanceof HTMLInputElement || editingFocus instanceof HTMLTextAreaElement)) {
        editingFocus.setSelectionRange(editingSelection.start, editingSelection.end);
      }
    } else focusFirstDialogControl(backdrop);
  };
  const minimizeWindow = (): void => {
    if (closed || minimized || closeGuardOpen || !isTopModal(backdrop)) return;
    minimizedPageId = editorState.get().selectedEventPageId;
    editingSelection = null;
    if (editingFocus instanceof HTMLInputElement || editingFocus instanceof HTMLTextAreaElement) {
      const { selectionStart, selectionEnd } = editingFocus;
      editingSelection = selectionStart === null || selectionEnd === null ? null : { start: selectionStart, end: selectionEnd };
    }
    // Suspend before blur: native change handlers may emit a store refresh.
    minimized = true;
    flushPendingModalField(backdrop);
    checkpointEventDraft(request.mapId, request.eventId);
    const name = backdrop.querySelector<HTMLInputElement>('[data-testid="event-editor-name"]')?.value ?? request.eventId;
    const label = `이벤트 편집 계속: ${name}`;
    restoreChip.setAttribute("aria-label", label);
    restoreChip.title = label;
    const text = restoreChip.querySelector("span");
    if (text) text.textContent = label;
    backdrop.hidden = true;
    unregisterModal(backdrop);
    disposeFocusTrap();
    document.body.classList.remove("event-editor-modal-open");
    document.body.append(restoreChip);
    restoreChip.focus({ preventScroll: true });
  };
  backdrop.addEventListener(EVENT_EDITOR_RESTORE_EVENT, restoreWindow);
  let disposeWindowFullscreen = (): void => {};
  let exitWindowFullscreen = (): boolean => false;
  const closeHandler = (saved = false): void => {
    if (closed) return;
    backdrop.dispatchEvent(new CustomEvent(EVENT_EDITOR_CLOSE_EVENT, { detail: { saved: saved === true } }));
    backdrop.remove();
    // 「보고 있던 페이지」는 편집기 안의 상태다. 남겨 두면 맵 마커·툴팁·인스펙터가 닫힌 뒤에도
    // 그 페이지(예: 그래픽 없는 2페이지)를 따라간다 — 맵은 게임 시작 시 켜질 페이지를 그려야 한다.
    if (editorState.get().selectedEventPageId !== null) editorState.set({ selectedEventPageId: null });
    announceEventEditorClosed({ mapId: request.mapId, eventId: request.eventId, saved: saved === true });
  };
  const requestClose = (): void => {
    if (closed || closeGuardOpen || minimized || !isTopModal(backdrop)) return;
    flushPendingModalField(backdrop);
    if (!eventDraftHasUserChanges(store.getCurrent(), request.mapId, request.eventId)) {
      closeHandler(false);
      return;
    }
    const isNew = store.getCurrent().maps[request.mapId]?.events
      .find((event) => event.id === request.eventId)?.draft?.kind === "new";
    closeGuardOpen = true;
    void confirmEventEditor(backdrop, {
      title: "적용하지 않은 변경",
      message: isNew
        ? "만들던 새 이벤트가 아직 프로젝트에 반영되지 않았어요.\n버리고 닫을까요?"
        // 문구가 가리키는 버튼은 실제 푸터 버튼 이름과 같아야 한다 — 예전 문구는 존재하지 않는
        // [반영하고 계속]·[반영하고 닫기] 를 가리켰다(2026-09-03 실측, 제안서 §4).
        : "적용하지 않은 변경이 있어요. 버리고 닫을까요?\n반영하려면 [계속 편집]을 누른 뒤 아래 [적용] 또는 [저장하고 닫기]를 누르세요.",
      confirmLabel: "버리고 닫기",
      cancelLabel: "계속 편집",
      danger: true,
    }).then((discard) => {
      closeGuardOpen = false;
      if (closed) return;
      if (discard) {
        closeHandler(false);
        return;
      }
      unregisterModal(backdrop);
      registerModal(backdrop, requestModalEscape);
    });
  };
  const requestModalEscape = (): void => {
    if (closed || minimized) return;
    // modalStack removes its entry before calling us, even if closing is declined.
    unregisterModal(backdrop);
    registerModal(backdrop, requestModalEscape);
    if (exitWindowFullscreen()) {
      return;
    }
    requestClose();
  };
  registerModal(backdrop, requestModalEscape);
  const header = renderModalHeader(request.mapId, request.eventId, closeHandler, requestClose);
  header.querySelector('[data-testid="event-editor-window-minimize"]')?.addEventListener("click", minimizeWindow);
  // Pointer activation must not blur/rebuild the active command field before
  // minimize can retain it. Keyboard activation uses the remembered editing focus.
  header.querySelector(".event-editor-window-controls")?.addEventListener("pointerdown", (event) => event.preventDefault());
  attachWindowDrag(header, windowEl);
  const fullscreenButton = header.querySelector<HTMLButtonElement>("[data-testid='event-editor-window-fullscreen']");
  if (fullscreenButton) {
    const fullscreen = attachWindowFullscreen(fullscreenButton, header, backdrop, windowEl);
    disposeWindowFullscreen = fullscreen.dispose;
    exitWindowFullscreen = () => {
      if (!fullscreen.isFullscreen()) return false;
      fullscreen.toggle(false);
      return true;
    };
  }
  const resizeHandle = renderModalResizeHandle();
  attachWindowResize(resizeHandle, windowEl);
  const footer = renderModalFooter(request, closeHandler, requestClose);
  windowEl.append(header, body, footer, resizeHandle);
  backdrop.append(windowEl);
  // 맵 더블클릭으로 열면 pointerdown 은 캔버스에서 나고, 모달이 붙는 순간
  // 이어지는 click 이 백드롭(창 바깥)으로 떨어질 수 있다. 스튜디오 모니터는
  // 뷰포트 중앙이 아니라서 그 click 이 창이 아니라 어두운 면에 맞는다.
  // dblclick 유령만 막으면 click 이 requestClose 를 호출해 편집기가 즉시 닫힌다.
  let backdropPointerStarted = false;
  backdrop.addEventListener("pointerdown", (event) => {
    backdropPointerStarted = event.target === backdrop;
  });
  backdrop.addEventListener("click", (event) => {
    if (event.target !== backdrop) return;
    if (!backdropPointerStarted) return;
    requestClose();
  });
  let stableRendered = false;
  let tilePaintRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  let refreshing = false;
  let refreshPending = false;
  // Removing a focused inline field can dispatch change and synchronously emit again.
  // Finish attaching this surface before another render claims the shared inspector/AI hosts.
  const refresh = () => {
    if (refreshing) { refreshPending = true; return; }
    refreshing = true;
    try { renderSurface(); }
    finally {
      refreshing = false;
      if (refreshPending) {
        refreshPending = false;
        queueMicrotask(refresh);
      }
    }
  };
  const renderSurface = () => {
    if (closed || minimized) return;
    const scrollSnapshots = captureEventEditorScroll(dynamicBody);
    const interactionSnapshot = captureEventEditorInteraction(dynamicBody);
    try {
      const live = store.getCurrent().maps[request.mapId]?.events.some((event) => event.id === request.eventId);
      if (!live && !store.restoreEventDraftFromVault(request.mapId, request.eventId)) {
        closeHandler(true);
        return;
      }
      if (!stableRendered) {
        clearChildren(stableBody);
        renderEventEditorStable(stableBody, request.mapId, request.eventId);
        stableRendered = true;
      }
      // 새 본문을 별도 버퍼에 먼저 그린다. 렌더가 던져도 기존 화면은 살아남는다 —
      // 예전에는 clearChildren 뒤에 그려서 명령 하나가 터지면 이벤트 전체가 흰 화면이 됐다.
      const staged = document.createElement("div");
      renderEventEditorDynamic(staged, request.mapId, request.eventId);
      clearChildren(dynamicBody);
      dynamicBody.append(...Array.from(staged.childNodes));
    } catch (error) {
      // 스테이징이 터지면 기존 본문은 그대로 두고 배너만 얹는다. 읽기와 멀쩡한 부분의
      // 편집은 계속 된다 — "다시 그리기" 전에도 내용은 볼 수 있어야 한다.
      console.error("[event-editor] failed to render body", error);
      dynamicBody.prepend(renderEventEditorCrash(error, refresh));
      return;
    }
    try {
      customSelects.refresh();
      restoreEventEditorScroll(dynamicBody, scrollSnapshots);
      restoreEventEditorInteraction(dynamicBody, interactionSnapshot);
      refreshHeaderPageSegments(header, request);
      refreshEventValidationBell(header, validateEventDraft(store.getCurrent(), request.mapId, request.eventId));
      refreshModalFooterStatus(footer, request);
      refreshModalHeaderSaveState(header, footer);
    } catch (error) {
      console.error("[event-editor] failed to restore editor chrome", error);
    }
  };
  const unsubscribeStore = store.subscribe((_project, change) => {
    const identity = store.getProjectIdentity();
    if (change.projectSwitch || identity.kind !== projectIdentity.kind || identity.id !== projectIdentity.id) {
      closeHandler(true);
      return;
    }
    if (isTileCellChange(change)) {
      // Painting emits per pointer sample and never touches events. Other maps cannot
      // affect this body; on this map only the validation bell can, so settle first.
      if (change.mapId !== request.mapId) return;
      if (tilePaintRefreshTimer !== null) clearTimeout(tilePaintRefreshTimer);
      tilePaintRefreshTimer = setTimeout(() => { tilePaintRefreshTimer = null; refresh(); }, 500);
      return;
    }
    const live = store.getCurrent().maps[request.mapId]?.events.some(event => event.id === request.eventId);
    if (!live && !store.restoreEventDraftFromVault(request.mapId, request.eventId)) {
      closeHandler(true);
      return;
    }
    refresh();
  });
  let lastEditorState = editorState.get();
  const unsubscribeEditor = editorState.subscribe((next) => {
    const previous = lastEditorState;
    lastEditorState = next;
    if (editorStateNeedsEventEditorRefresh(previous, next)) refresh();
  });
  const unsubscribeAutoSave = store.subscribeAutoSave(() => {
    refreshModalFooterStatus(footer, request);
    refreshModalHeaderSaveState(header, footer);
  });
  const checkpointTimer = globalThis.setInterval(() => {
    const diff = eventDraftDiffById(store.getCurrent(), request.mapId, request.eventId);
    if (diff && diff.changes.length > 0) checkpointEventDraft(request.mapId, request.eventId);
  }, EVENT_EDITOR_CHECKPOINT_MS);
  backdrop.addEventListener("keydown", (event) => {
    if (!closed && !minimized && isTopModal(backdrop)) handleModalKeyDown(event, request);
  });
  const detachObserver = typeof MutationObserver === "undefined" ? null : new MutationObserver(() => {
    if (!backdrop.isConnected) closeHandler(false);
  });
  detachObserver?.observe(document.body, { childList: true });
  backdrop.addEventListener(EVENT_EDITOR_CLOSE_EVENT, (event) => {
    if (closed) return;
    closed = true;
    backdrop.dataset.closed = "true";
    detachObserver?.disconnect();
    setCommandSelectionListener(undefined);
    clearCommandInspector();
    setCommandInspectorHost(undefined);
    unregisterModal(backdrop);
    disposeFocusTrap();
    restoreChip.remove();
    // A discard decision can settle after its document was detached or replaced.
    ownerDocument.body.classList.remove("event-editor-modal-open");
    clearEventCommandNavigation();
    const saved = event instanceof CustomEvent && event.detail?.saved === true;
    disposeWindowFullscreen();
    customSelects.dispose();
    globalThis.clearInterval(checkpointTimer);
    clearCommandToolbarHistories(`${request.mapId}:${request.eventId}:`);
    clearEventAiLiveDock();
    // 예약은 "태어날 때 한 번" 소비된다. 도크가 그려지기 전에 편집기가 닫혔다면(본문 렌더가
    // 던졌거나 즉시 닫힘) 예약이 남아, 훗날 같은 이벤트를 열 때 도크가 저절로 펼쳐진다.
    // 닫는 자리에서 이 이벤트의 예약을 확실히 버린다.
    clearEventAiDockOpenRequest(request.mapId, request.eventId);
    unsubscribeStore();
    if (tilePaintRefreshTimer !== null) clearTimeout(tilePaintRefreshTimer);
    unsubscribeEditor();
    unsubscribeAutoSave();
    if (!saved) discardEventDraft(request.mapId, request.eventId);
    // Let all child cleanup listeners run while the parent remains attached.
    queueMicrotask(() => backdrop.remove());
    if (typeof document !== "undefined" && document === ownerDocument && opener?.isConnected && !hasOpenModalLayer()) {
      opener.focus({ preventScroll: true });
    }
  });
  const openedAt = performance.now();
  let openLeakSwallowed = false;
  backdrop.addEventListener(
    "dblclick",
    (event) => {
      // Only swallow the opening canvas double-click, never titlebar controls.
      if (event.target !== backdrop || openLeakSwallowed || performance.now() - openedAt >= 800) return;
      openLeakSwallowed = true;
      event.stopPropagation();
      event.preventDefault();
    },
    { capture: true },
  );
  document.body.classList.add("event-editor-modal-open");
  document.body.append(backdrop);
  checkpointEventDraft(request.mapId, request.eventId);
  refresh();
  focusFirstDialogControl(backdrop);
  disposeFocusTrap = installFocusTrap(backdrop, windowEl);
}

export function isEventEditorModalOpenFor(mapId: MapId, eventId: string): boolean {
  const modal = document.querySelector(`[data-testid='${EVENT_EDITOR_MODAL_TEST_ID}']`);
  return modal instanceof HTMLElement && modal.dataset.mapId === mapId && modal.dataset.eventId === eventId;
}

function renderEventEditorCrash(error: unknown, retry: () => void): HTMLElement {
  const detail = error instanceof Error ? error.message : String(error);
  return el("div", {
    class: "event-editor-render-error",
    dataset: { testid: "event-editor-render-error" },
    children: [
      el("p", {
        class: "event-editor-render-error-title",
        text: "이벤트 편집 화면을 그리지 못했습니다.",
      }),
      el("p", {
        class: "event-editor-render-error-detail",
        text: detail.trim() || "알 수 없는 오류",
      }),
      el("button", {
        class: "btn",
        text: "다시 그리기",
        attrs: { type: "button" },
        dataset: { testid: "event-editor-render-retry" },
        on: { click: () => retry() },
      }),
    ],
  });
}

function closeExistingEventEditorModal(): void {
  const existing = document.querySelector(`[data-testid='${EVENT_EDITOR_MODAL_TEST_ID}']`);
  if (existing instanceof HTMLElement) {
    unregisterModal(existing);
    existing.dispatchEvent(new CustomEvent(EVENT_EDITOR_CLOSE_EVENT));
    existing.remove();
  }
}

function renderModalHeader(
  mapId: MapId,
  eventId: string,
  close: (saved?: boolean) => void,
  requestClose: () => void
): HTMLElement {
  const map = store.getCurrent().maps[mapId];
  const ev = map?.events.find((entry) => entry.id === eventId);
  const coordStr = `${ev?.x ?? 0}, ${ev?.y ?? 0}`;
  const characterId = ev?.characterId?.trim();
  const profileName = characterId
    ? store.getCurrent().characters?.[characterId]?.displayName?.trim() || characterId
    : null;
  const mapName = map?.name?.trim() || "";

  // 이 상자는 **이벤트 이름**(`GameEvent.name`)을 고친다. 페이지 이름은 탭(더블클릭·우클릭 → 이름
  // 바꾸기)과 설정 패널의 「페이지 이름」에서 고친다.
  //
  // 왜(2026-09-17 적대적 리뷰 P0-1): 이 자리는 원래 활성 페이지 이름이었고 라벨만 「페이지 이름」으로
  // 고쳐 둔 상태였다. 이벤트 이름은 「마지막으로 이름 붙은 페이지」에서 뽑았기 때문에 2페이지를
  // 자동 이름 그대로 두고 저장하면 NPC 가 맵 툴팁·목록·인스펙터에서 전부 「페이지 2」로 불렸다.
  // 편집기 어디에도 이벤트 이름을 짓는 자리가 없었다. 모델에는 `name` 이 이미 있었다(place_npc 가 씀).
  const authoredName = ev?.name?.trim() ?? "";
  const borrowedName = ev ? eventNameFromPages(ev) : "";
  const eventIdentity = ev ? eventDisplayName(ev) : "";

  const nameInput = el("input", {
    class: "event-name",
    value: authoredName,
    attrs: {
      type: "text",
      // 이름을 아직 짓지 않은 옛 저작물은 빌려 쓰는 페이지 이름을 placeholder 로 보인다 — 맵이 부르는 이름이
      // 상자에 있어야 「이 상자가 그 이름을 정한다」가 읽힌다. 새 이벤트는 예시로 용도를 말한다.
      placeholder: borrowedName || (ev?.draft?.kind === "new" ? "이벤트 이름 (예: 촌장 할아버지)" : "이벤트 이름"),
      "aria-label": "이벤트 이름",
      title: borrowedName && !authoredName
        ? `이벤트 이름입니다. 아직 짓지 않아 페이지 이름 "${borrowedName}" 을 빌려 쓰고 있습니다.`
        : "이벤트 이름입니다. 맵 툴팁·이벤트 목록·인스펙터가 이 이름으로 부릅니다.",
    },
    dataset: { testid: "event-editor-name" },
    on: {
      change: () => {
        // 다른 곳을 누르며 blur 된 change 면 그 클릭이 끝난 뒤 커밋한다(commitAfterPointerGesture 주석).
        const next = nameInput.value;
        commitAfterPointerGesture(() => updateEvent(mapId, eventId, { name: next }));
      },
    },
  });

  const saveAction = () => {
    if (!commitValidatedEventDraft({ mapId, eventId }, "저장하고 닫기")) return;
    close(true);
    toast("이벤트 변경을 프로젝트에 반영했습니다.", "ok");
  };

  const header = el("header", {
    class: "event-editor-modal-header",
    dataset: { testid: "event-editor-titlebar" },
    children: [
      nameInput,
      el("div", {
        class: "meta",
        children: [
          // 이벤트 정체성은 «이름 + 좌표» 다(DESIGN.md §5). 예전엔 여기에 `0007` 이 있었는데
          // 그건 ID 가 아니라 **맵 events 배열의 순번**(findIndex+1)이었다 — 앞 이벤트를 지우면
          // 번호가 밀린다. 4자리 제로패딩이 "안정적인 식별자"라고 약속하고 지키지 않았다.
          //
          // 이름을 아직 짓지 않은 이벤트는 페이지 이름을 빌려 표시된다 — 그 사실을 상자 옆에서
          // 말한다(`name` 필드가 없던 시절의 저작물). 지은 이름이 있으면 상자 값이 곧 표시 이름이라
          // 같은 문자열을 두 번 보여주지 않는다.
          ...(!authoredName && borrowedName
            ? [
                el("span", {
                  class: "event-editor-identity",
                  text: `표시 이름: ${eventIdentity} (페이지 이름에서)`,
                  dataset: { testid: "event-editor-identity" },
                }),
                el("span", { class: "dot-sep" }),
              ]
            : []),
          // 좌표만으로는 어느 맵인지 알 수 없다 — 맵 이름을 좌표 앞에 둔다(2026-09-03 제안서 §6).
          ...(mapName
            ? [el("span", { class: "event-editor-map-name", text: mapName, dataset: { testid: "event-editor-map-name" } }), el("span", { class: "dot-sep" })]
            : []),
          el("span", { text: coordStr, dataset: { testid: "event-editor-coords" } }),
          // NPC 칩은 연결됐을 때만 — 「NPC 없음」이라는 부정 상태를 제목 줄에서 반복하지 않는다.
          ...(profileName
            ? [
                el("span", { class: "dot-sep" }),
                el("span", {
                  class: "npc",
                  dataset: { testid: "event-editor-npc-chip" },
                  children: [
                    el("span", { class: "face" }),
                    el("span", { text: profileName, dataset: { testid: "event-editor-npc-name" } }),
                  ],
                }),
              ]
            : []),
          // 위 주석이 말한 `0007` 의 **올바른 대체물**. 저장된 `event.id` 를 읽기 전용으로
          // 세운다 — 순번이 아니라 정본이라 앞 이벤트를 지워도 변하지 않는다(OPRN-OUT-014).
          // 줄 끝에 두는 이유: 값 길이가 가변(레거시 `EV003` ~ `ev_`+UUID 39자)이라
          // 남는 폭을 흡수하는 자리에 있어야 앞의 이름·맵·좌표가 밀리지 않는다.
          ...(ev
            ? [
                el("span", { class: "dot-sep" }),
                renderEventIdReadout(ev.id, { scope: "event-editor", variant: "chip" }),
              ]
            : []),
        ],
      }),
      el("div", {
        class: "event-editor-header-save-state",
        attrs: { style: "display: none;" },
        dataset: { testid: "event-editor-header-save-state" },
      }),
      el("div", {
        class: "header-actions",
        children: [
          renderEventValidationBell(),
          el("button", {
            class: "btn ghost event-editor-header-test",
            text: "테스트",
            attrs: { type: "button" },
            dataset: { testid: "event-editor-test" },
            on: { click: () => {
              const validation = validateForModalAction({ mapId, eventId }, "테스트");
              if (!validation.canCommit) return;
              void openSelectedEventTestModal(mapId, eventId);
            }},
          }),
          el("button", {
            attrs: { type: "button", style: "display: none;" },
            dataset: { testid: "event-editor-ok" },
            on: { click: saveAction },
          }),
          el("div", {
            class: "event-editor-window-controls",
            attrs: { role: "group", "aria-label": "이벤트 편집 창" },
            children: [
              el("button", {
                class: "event-editor-window-control",
                children: [renderEditorIcon("minimize")],
                attrs: { type: "button", title: "최소화", "aria-label": "이벤트 편집 창 최소화" },
                dataset: { testid: "event-editor-window-minimize" },
              }),
              el("button", {
                class: "event-editor-window-control event-editor-window-fullscreen",
                children: [renderEditorIcon("expand")],
                attrs: {
                  type: "button",
                  title: "전체 보기 (Alt+Enter)",
                  "aria-label": "전체 보기",
                  "aria-keyshortcuts": "Alt+Enter",
                  "aria-pressed": "false",
                },
                dataset: { testid: "event-editor-window-fullscreen" },
              }),
              el("button", {
                class: "event-editor-window-control event-editor-modal-close",
                children: [renderEditorIcon("close")],
                attrs: { type: "button", title: "닫기", "aria-label": "닫기" },
                dataset: { testid: "event-editor-modal-close" },
                on: { click: () => requestClose() },
              }),
            ],
          }),
        ],
      }),
    ],
  });
  return header;
}

/** 모달 안에서 편집 중(포커스 유지)인 필드의 change 를 닫기 전에 강제로 커밋한다. */
function flushPendingModalField(backdrop: HTMLElement): void {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !backdrop.contains(active)) return;
  const tag = active.tagName;
  if ((tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") && typeof active.blur === "function") {
    active.blur();
  }
}

function renderModalFooter(
  request: OpenEventEditorRequest,
  close: (saved?: boolean) => void,
  requestClose: () => void
): HTMLElement {
  const footer = el("footer", {
    class: "event-editor-modal-footer",
    children: [
      // 파괴적 동작은 저장 버튼 군에서 **물리적으로 떼어 놓는다**.
      //
      // 예전 배치: `삭제 · 취소 · 적용 · 저장하고 닫기` 가 오른쪽에 한 덩어리였다. 이벤트를
      // 통째로 지우는 버튼이 «저장하고 닫기» 에서 두 칸 거리였고, 라벨이 그냥 `삭제` 라
      // 우상단 페이지 툴바의 `삭제`(=페이지 1개)와 글자까지 같았다. 둘은 폭발 반경이 다르다.
      // 이제 이벤트 삭제는 푸터 왼쪽 끝, 저장 군은 오른쪽 끝이고 라벨이 대상을 말한다.
      el("div", {
        class: "event-editor-footer-leading",
        children: [
          footerButton("이벤트 삭제", "event-delete", () => {
            if (requestEditorEventDeletion(request.mapId, request.eventId)) close(true);
          }, false, "ghost"),
          el("span", {
            class: "event-editor-remote-status",
            attrs: { role: "status", "aria-live": "polite", "aria-atomic": "true" },
            dataset: { testid: "event-editor-remote-status" },
          }),
        ],
      }),
      el("div", {
        class: "actions event-editor-footer-actions",
        children: [
          // 「변경 있음/없음」은 판단이고 「적용」은 실행이다. 예전엔 이 둘이 푸터 양 끝으로
          // 갈라져 넓은 화면에서 2,000px 넘게 떨어졌다 — 상태 표시가 사실상 안 읽혔다.
          el("span", {
            class: "issue event-editor-draft-status",
            attrs: { role: "status", "aria-live": "polite", "aria-atomic": "true" },
            dataset: { testid: "event-editor-draft-status" },
          }),
          footerButton("도움말", "event-editor-help", () => openEventEditorHelp(), false, "ghost"),
          footerButton("취소", "event-editor-cancel", () => requestClose(), false, "ghost"),
          footerButton("적용", "event-editor-apply", () => {
            if (!commitValidatedEventDraft(request, "적용")) return;
            footer.dataset.applied = "true";
            beginExistingEventDraft(request.mapId, request.eventId);
            refreshModalFooterStatus(footer, request);
          }),
          footerButton("저장하고 닫기", "event-editor-save", () => {
            if (!commitValidatedEventDraft(request, "저장하고 닫기")) return;
            close(true);
            toast("이벤트 변경을 프로젝트에 반영했습니다.", "ok");
          }, true),
        ],
      }),
    ],
  });
  refreshModalFooterStatus(footer, request);
  return footer;
}

function validateForModalAction(request: OpenEventEditorRequest, actionLabel: string): EventDraftValidation {
  const validation = validateEventDraft(store.getCurrent(), request.mapId, request.eventId);
  if (!validation.canCommit) {
    toast(`${actionLabel}할 수 없습니다. 오류 ${validation.errorCount}개를 먼저 해결하세요.`, "error");
    const firstError = validation.issues.find((issue) => issue.severity === "error");
    if (firstError) navigateToEventDraftIssue(firstError);
    return validation;
  }
  if (validation.warningCount > 0) {
    toast(`경고 ${validation.warningCount}개를 확인하세요. ${actionLabel}은 계속 진행합니다.`, "info");
  }
  return validation;
}

function commitValidatedEventDraft(request: OpenEventEditorRequest, actionLabel: string): boolean {
  const validation = validateForModalAction(request, actionLabel);
  if (!validation.canCommit) return false;
  saveEventDraft(request.mapId, request.eventId);
  return true;
}

function refreshModalFooterStatus(footer: HTMLElement, request: OpenEventEditorRequest): void {
  const local = footer.querySelector<HTMLElement>('[data-testid="event-editor-draft-status"]');
  const remote = footer.querySelector<HTMLElement>('[data-testid="event-editor-remote-status"]');
  const cancel = footer.querySelector<HTMLButtonElement>('[data-testid="event-editor-cancel"]');
  if (!local || !cancel) return;
  const project = store.getCurrent();
  const event = project.maps[request.mapId]?.events.find((entry) => entry.id === request.eventId);
  const cancelDeletesNewEvent = event?.draft?.kind === "new";
  cancel.textContent = cancelDeletesNewEvent ? "취소(삭제)" : "취소";
  cancel.setAttribute("aria-label", cancelDeletesNewEvent ? "취소: 새 이벤트 삭제" : footerButtonAccessibleName("취소"));

  const changed = eventDraftHasUserChanges(project, request.mapId, request.eventId);
  const conflict = event?.draft?.conflict;
  if (conflict) {
    local.textContent = conflict.kind === "remote-delete"
      ? "외부에서 삭제됨 · 내 초안 유지"
      : "외부 변경 있음 · 내 초안 유지";
    local.title = "다른 저장본과 충돌했습니다. 이 초안을 검토한 뒤 적용하세요.";
    local.dataset.state = "conflict";
  } else if (changed) {
    local.textContent = "변경 있음";
    local.title = "프로젝트에 반영하고 편집 유지";
    local.dataset.state = "working";
  } else if (event?.draft?.kind === "new") {
    local.textContent = "새 이벤트 · 취소 시 삭제 · 임시 보관";
    local.title = "적용 전 본문은 로컬 복구본으로 임시 보관됩니다.";
    local.dataset.state = "new-pristine";
  } else if (footer.dataset.applied === "true") {
    local.textContent = "적용됨";
    local.title = "남은 변경을 반영하고 닫음";
    local.dataset.state = "applied";
  } else if (event?.draft) {
    local.textContent = "변경 없음";
    local.title = "현재 이벤트에 미적용 변경이 없습니다.";
    local.dataset.state = "session";
  } else {
    local.textContent = "저장됨";
    local.title = "프로젝트에 저장된 상태입니다.";
    local.dataset.state = "project";
  }
  if (remote) {
    const remoteStatus = remotePersistenceLabel(store.getAutoSaveState());
    remote.textContent = remoteStatus.text;
    remote.title = remoteStatus.text;
    remote.dataset.state = remoteStatus.state;
  }
}

function remotePersistenceLabel(autoSave: AutoSaveState): { readonly text: string; readonly state: string } {
  const db = store.getDbPersistenceStatus();
  if (db.kind === "not-configured") return { text: "저장소 미설정", state: "not-configured" };
  if (db.kind === "disabled") {
    return {
      text: db.reason === "dev-showcase" ? "임시 세션" : db.reason === "shared-demo" ? "공용 예제" : "오프라인",
      state: "disabled",
    };
  }
  switch (autoSave.kind) {
    case "pending": return { text: "저장 대기", state: "pending" };
    case "saving": return { text: "저장 중…", state: "saving" };
    case "saved": return { text: `저장됨 ${new Date(autoSave.at).toLocaleTimeString()}`, state: "saved" };
    case "error": return { text: `저장 실패: ${autoSave.message}`, state: "error" };
    case "idle": return { text: "저장 준비", state: "idle" };
  }
}

function refreshHeaderPageSegments(header: HTMLElement, request: OpenEventEditorRequest): void {
  const map = store.getCurrent().maps[request.mapId];
  const ev = map?.events.find((entry) => entry.id === request.eventId);
  // 「페이지 N/M」 카운터는 바로 아래 탭 줄과 같은 정보라 없앴다(2026-09-03).
  if (!ev) return;
  const nameInput = header.querySelector<HTMLInputElement>('[data-testid="event-editor-name"]');
  if (!nameInput) return;
  // 이 상자는 이벤트 이름이다. 페이지를 바꿔도 값이 달라질 이유가 없고, 사용자가 타이핑 중인
  // 값을 store 갱신이 뺏으면 안 된다 — 포커스가 없을 때만 모델을 따라간다(place_npc 등 외부 변경).
  const authored = ev.name?.trim() ?? "";
  if (document.activeElement !== nameInput && nameInput.value !== authored) nameInput.value = authored;
  const identity = header.querySelector<HTMLElement>('[data-testid="event-editor-identity"]');
  if (identity) {
    const borrowed = eventNameFromPages(ev);
    identity.hidden = Boolean(authored) || !borrowed;
    if (!identity.hidden) identity.textContent = `표시 이름: ${eventDisplayName(ev)} (페이지 이름에서)`;
  }
}

function refreshModalHeaderSaveState(header: HTMLElement, footer: HTMLElement): void {
  const headerState = header.querySelector<HTMLElement>('[data-testid="event-editor-header-save-state"]');
  const local = footer.querySelector<HTMLElement>('[data-testid="event-editor-draft-status"]');
  const remote = footer.querySelector<HTMLElement>('[data-testid="event-editor-remote-status"]');
  if (!headerState || !local || !remote) return;
  const durable = remote.dataset.state === "saved";
  const applied = local.dataset.state === "project" || local.dataset.state === "applied";
  headerState.textContent = durable && applied ? `✓ ${remote.textContent}` : `${local.textContent} · ${remote.textContent}`;
  headerState.dataset.localState = local.dataset.state ?? "unknown";
  headerState.dataset.remoteState = remote.dataset.state ?? "unknown";
  headerState.title = `${local.title}\n${remote.title}`;
}

function footerButton(text: string, testId: string, onClick?: () => void, primary = false, extraClass = ""): HTMLButtonElement {
  const classes = ["btn", "event-editor-footer-button", primary ? "primary" : "", extraClass].filter(Boolean).join(" ");
  const props = {
    class: classes,
    text,
    attrs: { type: "button", "aria-label": footerButtonAccessibleName(text) },
    dataset: { testid: testId },
    on: onClick ? { click: onClick } : undefined,
  };
  return el("button", props) as HTMLButtonElement;
}

function handleModalKeyDown(event: KeyboardEvent, request: OpenEventEditorRequest): void {
  if (event.key === "Escape") return;
  if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k") {
    event.preventDefault();
    event.stopPropagation();
    openActiveEventCommandPicker(request.mapId, request.eventId);
    return;
  }
  if ((event.ctrlKey || event.metaKey) && !event.altKey && ["z", "y"].includes(event.key.toLowerCase())) {
    // Text fields retain native undo. Even an empty page history owns this key:
    // it must never fall through to the global map stack beneath the draft.
    event.stopPropagation();
    if (isTextEditingTarget(event.target)) return;
    event.preventDefault();
    undoActiveEventCommands(request.mapId, request.eventId, event.key.toLowerCase() === "y" || event.shiftKey);
    return;
  }
  if (event.key !== "Delete" || event.ctrlKey || event.metaKey || event.altKey) return;
  if (isTextEditingTarget(event.target)) return;

  // 맨 Delete 로는 이벤트를 지우지 않는다.
  //
  // 예전엔 가드가 «텍스트 입력»과 «명령 리스트» 둘뿐이고 **나머지 모달 전체**에서 Delete 가
  // 이벤트를 통째로 지웠다 — 설정 레일, 그래픽 패널, 페이지 탭, 빈 여백까지 전부 그 영역이다.
  // 페이지 탭을 클릭해 포커스가 거기 있는 상태에서 「명령 하나 지우려고」 Delete 를 누르면
  // 이벤트가 사라졌다. 파괴 반경이 큰 동작일수록 우연히 닿는 표면이 넓으면 안 된다.
  //
  // 이벤트 삭제의 입구는 라벨이 붙은 푸터 버튼 하나다. 명령 삭제는 명령 줄이 자기 키다운에서
  // 처리하고 stopPropagation 하므로(commandListContextMenu.ts) 여기까지 오지 않는다.
  // 여기 닿은 Delete 는 삼킨다 — 흘려보내면 브라우저 기본 동작이나 상위 리스너에 닿는다.
  event.preventDefault();
  event.stopPropagation();
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}


/**
 * 푸터 버튼의 접근성 이름.
 *
 * 예전 이 스위치는 `반영하고 닫기` / `닫기` / `반영하고 계속` 세 라벨만 알고 있었다. 그런데
 * 출하 라벨은 `삭제` / `취소` / `적용` / `저장하고 닫기` 라 **모든 호출이 default 로 떨어지는
 * 죽은 스위치**였다 — DESIGN.md 의 푸터 계약이 코드에서 되돌려졌는데 이 함수만 남은 흔적이다.
 * 이제 실제 라벨을 받아, 특히 파괴적 동작은 «무엇을» 지우는지까지 읽어준다.
 */
function footerButtonAccessibleName(text: string): string {
  switch (text) {
    case "이벤트 삭제":
      return "이벤트 삭제: 이 이벤트와 모든 페이지를 지웁니다";
    case "취소":
      return "취소: 변경을 버리고 닫기";
    case "적용":
      return "적용: 프로젝트에 반영하고 계속 편집";
    case "저장하고 닫기":
      return "저장하고 닫기: 반영하고 편집기를 닫습니다";
    case "테스트":
      return "이 이벤트 테스트";
    default:
      return text;
  }
}

function installFocusTrap(backdropEl: HTMLElement, windowEl: HTMLElement): () => void {
  const trap = (event: KeyboardEvent): void => {
    if (event.key !== "Tab" || !isTopModal(backdropEl)) return;
    const focusable = Array.from(
      windowEl.querySelectorAll<HTMLElement>(
        "button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
      ),
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (!windowEl.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus({ preventScroll: true });
      return;
    }
    if (event.shiftKey) {
      if (document.activeElement === first) { event.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  };
  document.addEventListener("keydown", trap, true);
  return () => document.removeEventListener("keydown", trap, true);
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

const EVENT_EDITOR_SCROLL_SELECTORS = [
  ".event-editor-settings-main",
  ".event-page-props",
  ".event-page-number-tabs",
  ".cmd-list",
  ".story",
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

type EventEditorInteractionSnapshot = {
  readonly focusTestId?: string;
  readonly focusTestIdIndex?: number;
  readonly focusPageId?: string;
  readonly focusCustomSelectFor?: string;
  readonly focusCommandPath?: string;
  readonly selectionEnd?: number;
  readonly selectionStart?: number;
  readonly selectedCommandPath?: string;
  readonly openDetailsTestIds: readonly string[];
};

function captureEventEditorInteraction(root: HTMLElement): EventEditorInteractionSnapshot {
  const active = document.activeElement instanceof HTMLElement && root.contains(document.activeElement)
    ? document.activeElement
    : null;
  const focusTestId = active?.dataset.testid;
  const focusCustomSelectFor = active?.dataset.customSelectFor;
  const matchingFocusNodes = focusTestId
    ? Array.from(root.querySelectorAll<HTMLElement>(`[data-testid="${focusTestId}"]`))
    : [];
  const selection = active as (HTMLInputElement | HTMLTextAreaElement | null);
  return {
    ...(focusTestId ? { focusTestId, focusTestIdIndex: Math.max(0, matchingFocusNodes.indexOf(active!)) } : {}),
    ...(active?.dataset.pageId ? { focusPageId: active.dataset.pageId } : {}),
    ...(focusCustomSelectFor ? { focusCustomSelectFor } : {}),
    ...(active?.closest<HTMLElement>(".cmd-item, .row, .leaf")?.dataset.cmdPath
      ? { focusCommandPath: active.closest<HTMLElement>(".cmd-item, .row, .leaf")!.dataset.cmdPath }
      : {}),
    ...(typeof selection?.selectionStart === "number" ? { selectionStart: selection.selectionStart } : {}),
    ...(typeof selection?.selectionEnd === "number" ? { selectionEnd: selection.selectionEnd } : {}),
    ...(root.querySelector<HTMLElement>(".cmd-item.selected, .row.selected, .leaf.selected")?.dataset.cmdPath
      ? { selectedCommandPath: root.querySelector<HTMLElement>(".cmd-item.selected, .row.selected, .leaf.selected")!.dataset.cmdPath }
      : {}),
    openDetailsTestIds: Array.from(root.querySelectorAll<HTMLDetailsElement>("details"))
      .filter((details) => details.open && Boolean(details.dataset.testid))
      .map((details) => details.dataset.testid!),
  };
}

function restoreEventEditorInteraction(root: HTMLElement, snapshot: EventEditorInteractionSnapshot): void {
  for (const testId of snapshot.openDetailsTestIds) {
    const details = root.querySelector<HTMLDetailsElement>(`[data-testid="${testId}"]`);
    if (details) details.open = true;
  }

  let focusTarget: HTMLElement | null = null;
  if (snapshot.focusPageId) {
    focusTarget = Array.from(root.querySelectorAll<HTMLElement>(".evt-page-segment[data-page-id]"))
      .find((candidate) => candidate.dataset.pageId === snapshot.focusPageId) ?? null;
  }
  if (!focusTarget && snapshot.focusCustomSelectFor) {
    focusTarget = root.querySelector<HTMLElement>(`[data-custom-select-for="${snapshot.focusCustomSelectFor}"]`);
  }
  if (!focusTarget && snapshot.focusTestId) {
    focusTarget = Array.from(root.querySelectorAll<HTMLElement>(`[data-testid="${snapshot.focusTestId}"]`))[
      snapshot.focusTestIdIndex ?? 0
    ] ?? null;
  }
  if (!focusTarget && snapshot.focusCommandPath) {
    const row = findRenderedCommand(root, snapshot.focusCommandPath);
    focusTarget = row?.querySelector<HTMLElement>(".cmd-head, .line") ?? row;
  }
  if (!focusTarget) return;
  focusTarget.focus({ preventScroll: true });
  if (
    snapshot.selectionStart !== undefined
    && snapshot.selectionEnd !== undefined
    && "setSelectionRange" in focusTarget
    && typeof focusTarget.setSelectionRange === "function"
  ) {
    focusTarget.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
  }
}

function findRenderedCommand(root: HTMLElement, encodedPath: string): HTMLElement | null {
  return Array.from(root.querySelectorAll<HTMLElement>(".cmd-item, .row, .leaf"))
    .find((candidate) => candidate.dataset.cmdPath === encodedPath) ?? null;
}
