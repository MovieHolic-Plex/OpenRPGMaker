import { PRODUCT_BRAND } from "@/brand";
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
import { eventDraftDiffById, eventDraftHasUserChanges } from "@/project/eventDrafts";
import { showConfirm } from "@/editor/ui/modal";
import { validateEventDraft, type EventDraftValidation } from "@/editor/eventDraftValidator";
import { openSelectedEventTestModal } from "@/editor/panels/testPlayModal";
import { store, type AutoSaveState } from "@/project/store";
import type { MapId } from "@/project/types";
import { clearChildren, el } from "@/util/dom";
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { openEventEditorHelp } from "./eventEditorHelp";
import {
  navigateToEventDraftIssue,
  openActiveEventCommandPicker,
  renderEventEditorDynamic,
  renderEventEditorStable,
} from "./content";
import { clearCommandToolbarHistories } from "./commandToolbarHistory";
import { clearCommandInspector, setCommandInspectorHost } from "./commandInspector";
import { installEventEditorCustomSelects } from "./customSelect";
import { attachWindowDrag } from "./modalDrag";
import { attachWindowFullscreen } from "./modalFullscreen";
import { attachWindowResize, renderModalResizeHandle } from "./modalResize";
import { toast } from "@/util/toast";

const EVENT_EDITOR_MODAL_TEST_ID = "event-editor-modal";
const EVENT_EDITOR_CLOSE_EVENT = "oprn:event-editor-close";
const EVENT_EDITOR_CHECKPOINT_MS = 1500;

type OpenEventEditorRequest = {
  readonly mapId: MapId;
  readonly eventId: string;
};

export function openEventEditorModal(mapId: MapId, eventId: string): void {
  guardedCloseExistingEventEditorModal(() => {
    if (!beginExistingEventDraft(mapId, eventId)) return;
    openDraftEventEditorModal({ mapId, eventId });
  });
}

export function openNewEventEditorModal(mapId: MapId, x: number, y: number): string {
  // 기존 모달이 없을 때는 동기 규약 유지(반환 eventId). 편집 중 변경이 있으면
  // 확인 후 비동기로 이어지고 "" 를 반환한다(호출부는 반환값을 쓰지 않는다 — 2026-08-18 확인).
  let created = "";
  guardedCloseExistingEventEditorModal(() => {
    const eventId = createEventDraft(mapId, x, y);
    if (!eventId) return;
    created = eventId;
    openDraftEventEditorModal({ mapId, eventId });
  });
  return created;
}

/** 열린 에디터가 있으면 미적용 변경 여부를 확인하고 나서 next 를 실행한다. */
function guardedCloseExistingEventEditorModal(next: () => void): void {
  const existing = document.querySelector<HTMLElement>(`[data-testid='${EVENT_EDITOR_MODAL_TEST_ID}']`);
  if (!(existing instanceof HTMLElement)) {
    next();
    return;
  }
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
  void showConfirm({
    title: "편집 중인 이벤트",
    message: "먼저 열린 이벤트에 적용하지 않은 변경이 있어요.\n버리고 다른 이벤트를 열까요?",
    confirmLabel: "버리고 열기",
    cancelLabel: "계속 편집",
    danger: true,
  }).then((discard) => {
    if (!discard) return;
    closeExistingEventEditorModal();
    next();
  });
}

function openDraftEventEditorModal(request: OpenEventEditorRequest): void {
  clearCommandToolbarHistories(`${request.mapId}:${request.eventId}:`);
  clearCommandInspector();
  setCommandInspectorHost(undefined);
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
  // Layered Escape: topmost modal (command subdialog / picker) closes first.
  let closed = false;
  let closeGuardOpen = false;
  let disposeWindowFullscreen = (): void => {};
  let exitWindowFullscreen = (): boolean => false;
  const closeHandler = (saved = false): void => {
    if (closed) return;
    closed = true;
    clearCommandInspector();
    setCommandInspectorHost(undefined);
    unregisterModal(backdrop);
    backdrop.dispatchEvent(new CustomEvent(EVENT_EDITOR_CLOSE_EVENT, { detail: { saved: saved === true } }));
    backdrop.remove();
    if (typeof document !== "undefined" && !document.querySelector("[data-testid='event-editor-modal']")) {
      document.body.classList.remove("event-editor-modal-open");
    }
    disposeFocusTrap();
  };
  // ESC/X/닫기/백드롭 공용 닫기 요청. 닫기 "전에" 입력 중이던 필드를 blur로 플러시해야
  // 드래프트가 살아 있는 동안 change 가 커밋된다 — 폐기 후에 change 가 뒤늦게 도착하면
  // 편집이 드래프트 밖 스토어에 그대로 남는 유령 저장이 된다(2026-08-18 실측).
  const requestClose = (): void => {
    if (closed || closeGuardOpen) return;
    flushPendingModalField(backdrop);
    if (!eventDraftHasUserChanges(store.getCurrent(), request.mapId, request.eventId)) {
      closeHandler(false);
      return;
    }
    const isNew = store.getCurrent().maps[request.mapId]?.events
      .find((event) => event.id === request.eventId)?.draft?.kind === "new";
    closeGuardOpen = true;
    void showConfirm({
      title: "적용하지 않은 변경",
      message: isNew
        ? "만들던 새 이벤트가 아직 프로젝트에 반영되지 않았어요.\n버리고 닫을까요?"
        : "적용하지 않은 변경이 있어요. 버리고 닫을까요?\n반영하려면 [계속 편집]을 누른 뒤 [반영하고 계속] 또는 [반영하고 닫기]를 누르세요.",
      confirmLabel: "버리고 닫기",
      cancelLabel: "계속 편집",
      danger: true,
    }).then((discard) => {
      closeGuardOpen = false;
      if (discard) {
        closeHandler(false);
        return;
      }
      // ESC 경로는 modalStack 에서 이미 pop 됐으므로 계속 편집하려면 재등록해야 한다.
      unregisterModal(backdrop);
      registerModal(backdrop, requestModalEscape);
    });
  };
  const requestModalEscape = (): void => {
      if (exitWindowFullscreen()) {
        // modalStack removes an entry before invoking its Escape callback. Full view
        // handles that Escape without closing, so restore routing for the next Escape.
        unregisterModal(backdrop);
        registerModal(backdrop, requestModalEscape);
        return;
      }
      requestClose();
    };
  registerModal(backdrop, requestModalEscape);
  const header = renderModalHeader(request.mapId, request.eventId, requestClose);
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
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) requestClose();
  });
  let stableRendered = false;
  const refresh = () => {
    // Full dynamic re-render resets overflow; restore scroll so edits in the lower
    // page-prop grid (graphic / movement / living destinations) do not jump to top.
    const scrollSnapshots = captureEventEditorScroll(dynamicBody);
    const interactionSnapshot = captureEventEditorInteraction(dynamicBody);
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
    customSelects.refresh();
    restoreEventEditorScroll(dynamicBody, scrollSnapshots);
    restoreEventEditorInteraction(dynamicBody, interactionSnapshot);
    refreshModalFooterStatus(footer, request);
    refreshModalHeaderSaveState(header, footer);
    // Keep title in sync when draft meta changes after autosave reattach.
    const title = header.querySelector("h2");
    if (title) title.textContent = eventEditorTitle(request.mapId, request.eventId);
  };
  const unsubscribeStore = store.subscribe(refresh);
  const unsubscribeEditor = editorState.subscribe(refresh);
  const unsubscribeAutoSave = store.subscribeAutoSave(() => {
    refreshModalFooterStatus(footer, request);
    refreshModalHeaderSaveState(header, footer);
  });
  const checkpointTimer = globalThis.setInterval(() => {
    const diff = eventDraftDiffById(store.getCurrent(), request.mapId, request.eventId);
    if (diff && diff.changes.length > 0) checkpointEventDraft(request.mapId, request.eventId);
  }, EVENT_EDITOR_CHECKPOINT_MS);
  backdrop.addEventListener("keydown", (event) => handleModalKeyDown(event, request, closeHandler));
  backdrop.addEventListener(EVENT_EDITOR_CLOSE_EVENT, (event) => {
    const saved = event instanceof CustomEvent && event.detail?.saved === true;
    disposeWindowFullscreen();
    customSelects.dispose();
    globalThis.clearInterval(checkpointTimer);
    clearCommandToolbarHistories(`${request.mapId}:${request.eventId}:`);
    // Stop reactive paint before discarding the draft. discardEventDraft emits
    // synchronously, so a live subscriber can rerender a modal that is closing.
    unsubscribeStore();
    unsubscribeEditor();
    unsubscribeAutoSave();
    if (!saved) discardEventDraft(request.mapId, request.eventId);
  });
  // 맵에서 더블클릭으로 열면 그 더블클릭의 잔여 dblclick 이벤트가 방금 열린 모달의
  // 명령 줄에 떨어져 편집 다이얼로그가 저절로 열린다(2026-08-19 실측) — 오픈 직후 잠깐 삼킨다.
  // 실측 548ms 지연 사례(2026-08-19)가 있어 350ms 로는 부족했다. 열리고 800ms 안의
  // 첫 dblclick 은 잔여 입력으로 간주한다 — 사용자가 그 안에 조준해 더블클릭하기는 어렵다.
  const openedAt = performance.now();
  let openLeakSwallowed = false;
  backdrop.addEventListener(
    "dblclick",
    (event) => {
      if (openLeakSwallowed || performance.now() - openedAt >= 800) return;
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

function closeExistingEventEditorModal(): void {
  const existing = document.querySelector(`[data-testid='${EVENT_EDITOR_MODAL_TEST_ID}']`);
  if (existing instanceof HTMLElement) {
    unregisterModal(existing);
    existing.dispatchEvent(new CustomEvent(EVENT_EDITOR_CLOSE_EVENT));
    existing.remove();
  }
}

function renderModalHeader(mapId: MapId, eventId: string, close: () => void): HTMLElement {
  // P0 헤더 2행 분리: 타이틀행(엔진·에디터) + 아이덴티티행(ID·이름·좌표)을 시각적으로 분리한다.
  const { eyebrow, title } = eventEditorTitleParts(mapId, eventId);
  const mapName = store.getCurrent().maps[mapId]?.name?.trim() || "현재 맵";
  const eventName = title.replace(/\s*\([^)]*\)\s*$/, "").trim() || "이벤트";
  const clickControl = (testId: string): void => {
    document.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)?.click();
  };
  return el("div", {
    class: "event-editor-modal-header",
    dataset: { testid: "event-editor-titlebar" },
    children: [
      el("strong", { class: "event-editor-product-brand", text: PRODUCT_BRAND }),
      el("div", {
        class: "event-editor-breadcrumb",
        children: [
          el("span", { text: mapName }),
          el("span", { class: "event-editor-breadcrumb-separator", text: "/" }),
          el("span", { text: eventName }),
          el("span", { class: "event-editor-breadcrumb-separator", text: "/" }),
          el("span", { text: "이벤트 편집" }),
        ],
      }),
      el("div", {
        class: "event-editor-window-title",
        children: [
          el("div", { class: "event-editor-window-eyebrow", text: eyebrow, attrs: { "aria-hidden": "true" } }),
          el("h2", { text: title }),
        ],
      }),
      el("div", {
        class: "event-editor-header-save-state",
        text: "저장 상태 확인 중",
        dataset: { testid: "event-editor-header-save-state" },
      }),
      el("div", {
        class: "event-editor-window-controls",
        children: [
          el("button", {
            class: "event-editor-window-control event-editor-header-undo",
            text: "↶",
            attrs: { type: "button", title: "실행 취소", "aria-label": "실행 취소" },
            on: { click: () => clickControl("event-command-toolbar-undo") },
          }),
          el("button", {
            class: "event-editor-window-control event-editor-header-redo",
            text: "↷",
            attrs: { type: "button", title: "다시 실행", "aria-label": "다시 실행" },
            on: { click: () => clickControl("event-command-toolbar-redo") },
          }),
          el("button", {
            class: "btn event-editor-header-test",
            text: "이벤트 테스트",
            attrs: { type: "button" },
            on: { click: () => clickControl("event-editor-test") },
          }),
          el("button", {
            class: "btn primary event-editor-header-save",
            text: "저장",
            attrs: { type: "button" },
            on: { click: () => clickControl("event-editor-apply") },
          }),
          el("div", {
            class: "event-editor-header-more",
            children: (() => {
              const menu = el("div", {
                class: "event-editor-header-more-menu",
                attrs: { hidden: "" },
                children: [
                  footerButton("도움말", "event-editor-header-help", () => openEventEditorHelp()),
                  footerButton("이벤트 삭제", "event-editor-header-delete", () => {
                    if (requestEditorEventDeletion(mapId, eventId)) close();
                  }),
                ],
              });
              const toggle = el("button", {
                class: "event-editor-window-control",
                text: "⋮",
                attrs: {
                  type: "button",
                  title: "더보기",
                  "aria-label": "더보기",
                  "aria-expanded": "false",
                },
                dataset: { testid: "event-editor-header-more" },
                on: {
                  click: () => {
                    const nextHidden = !menu.hasAttribute("hidden");
                    if (nextHidden) menu.setAttribute("hidden", "");
                    else menu.removeAttribute("hidden");
                    toggle.setAttribute("aria-expanded", nextHidden ? "false" : "true");
                  },
                },
              });
              return [toggle, menu];
            })(),
          }),
          el("button", {
            class: "event-editor-window-control event-editor-window-fullscreen",
            text: "⛶",
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
            text: "×",
            attrs: { type: "button", title: "닫기", "aria-label": "닫기" },
            dataset: { testid: "event-editor-modal-close" },
            on: { click: () => close() },
          }),
        ],
      }),
    ],
  });
}

function eventEditorTitleParts(mapId: MapId, eventId: string): { readonly eyebrow: string; readonly title: string } {
  return { eyebrow: `${PRODUCT_BRAND}  ·  이벤트 에디터`, title: eventEditorTitle(mapId, eventId) };
}

function eventEditorTitle(mapId: MapId, eventId: string): string {
  const event = store.getCurrent().maps[mapId]?.events.find((entry) => entry.id === eventId);
  if (!event) return "이벤트 에디터";
  const name = eventDisplayNameOf(event);
  const coord = `(${event.x},${event.y})`;
  if (event?.draft?.kind === "new") {
    return name ? `${name} ${coord}` : `새 이벤트 ${coord}`;
  }
  return name ? `${name} ${coord}` : `이벤트 ${coord}`;
}

function eventDisplayNameOf(event: { readonly pages?: readonly { readonly name: string }[] }): string {
  const pages = event.pages ?? [];
  for (let index = pages.length - 1; index >= 0; index -= 1) {
    const name = pages[index]?.name.trim();
    if (name) return name;
  }
  return "";
}

/** 모달 안에서 편집 중(포커스 유지)인 필드의 change 를 닫기 전에 강제로 커밋한다. */
function flushPendingModalField(backdrop: HTMLElement): void {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !backdrop.contains(active)) return;
  const tag = active.tagName;
  // fakeDom(단위 테스트)은 blur 를 구현하지 않는다 — 기능 감지로 방어.
  if ((tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") && typeof active.blur === "function") {
    active.blur();
  }
}

function renderModalFooter(
  request: OpenEventEditorRequest,
  close: (saved?: boolean) => void,
  requestClose: () => void
): HTMLElement {
  const footer = el("div", {
    class: "event-editor-modal-footer",
    children: [
      el("div", {
        class: "event-editor-footer-leading",
        children: [
          el("div", {
            class: "event-editor-lifecycle-status",
            attrs: { role: "status", "aria-live": "polite", "aria-atomic": "true" },
            children: [
              el("span", {
                class: "event-editor-draft-status",
                text: "",
                dataset: { testid: "event-editor-draft-status" },
              }),
              el("span", {
                class: "event-editor-remote-status",
                dataset: { testid: "event-editor-remote-status" },
              }),
            ],
          }),
        ],
      }),
      el("div", {
        class: "event-editor-footer-actions",
        children: [
          el("details", {
            class: "event-editor-footer-more",
            children: [
              el("summary", { class: "btn event-editor-footer-more-summary", text: "더보기" }),
              el("div", {
                class: "event-editor-footer-more-menu",
                children: [
                  footerButton("도움말", "event-editor-help", () => openEventEditorHelp()),
                  footerButton("삭제", "event-delete", () => {
                    if (requestEditorEventDeletion(request.mapId, request.eventId)) close(true);
                  }),
                ],
              }),
          ]}),
          // "만들고 바로 눌러본다"가 초보 루프의 핵심 — 테스트는 오버플로 메뉴에 숨기지 않는다(적대 평가 I03).
          footerButton("테스트", "event-editor-test", () => {
            const validation = validateForModalAction(request, "테스트");
            if (!validation.canCommit) return;
            void openSelectedEventTestModal(request.mapId, request.eventId);
          }),
          footerButton("취소", "event-editor-cancel", () => requestClose()),
          footerButton("적용", "event-editor-apply", () => {
            if (!commitValidatedEventDraft(request, "적용")) return;
            footer.dataset.applied = "true";
            beginExistingEventDraft(request.mapId, request.eventId);
            refreshModalFooterStatus(footer, request);
          }),
          footerButton("저장하고 닫기", "event-editor-ok", () => {
            if (!commitValidatedEventDraft(request, "저장하고 닫기")) return;
            close(true);
            // 모달이 닫히면서 푸터 상태도 사라지므로, 반영 사실을 토스트로 남긴다(적대 평가 L01).
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
  if (!local || !remote || !cancel) return;
  const project = store.getCurrent();
  const event = project.maps[request.mapId]?.events.find((entry) => entry.id === request.eventId);
  const cancelDeletesNewEvent = event?.draft?.kind === "new";
  cancel.textContent = "취소";
  cancel.setAttribute("aria-label", cancelDeletesNewEvent ? "취소: 새 이벤트 삭제" : footerButtonAccessibleName("취소"));
  // created diff(새 드래프트는 항상 1건)가 아니라 "사용자가 실제로 손댔는가"로 판정 —
  // 갓 만든 이벤트가 손대기 전부터 "변경사항 있음"으로 시작하지 않게 한다.
  const changed = eventDraftHasUserChanges(project, request.mapId, request.eventId);
  if (changed) {
    local.textContent = "변경 있음";
    local.title = "프로젝트에 반영하고 편집 유지";
    local.dataset.state = "working";
  } else if (event?.draft?.kind === "new") {
    // 자동 저장은 드래프트 볼트(크래시 복구), 닫기 시 삭제는 새 이벤트의 close 계약이다.
    local.textContent = "새 이벤트 · 닫기 시 삭제 · 자동 저장";
    local.title = "편집 없이 닫으면 새 이벤트를 만들지 않습니다.";
    local.dataset.state = "new-pristine";
  } else if (footer.dataset.applied === "true") {
    local.textContent = "반영됨";
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
  const remoteStatus = remotePersistenceLabel(store.getAutoSaveState());
  remote.textContent = remoteStatus.text;
  remote.title = remoteStatus.text;
  remote.dataset.state = remoteStatus.state;
  // 반영 구분 힌트: 버튼 타이틀에 병기
  const applyBtn = footer.querySelector<HTMLElement>('[data-testid="event-editor-apply"]');
  const okBtn = footer.querySelector<HTMLElement>('[data-testid="event-editor-ok"]');
  if (applyBtn) applyBtn.title = "프로젝트에 반영하고 편집 유지";
  if (okBtn) okBtn.title = "남은 변경을 반영하고 닫음";
}

function remotePersistenceLabel(autoSave: AutoSaveState): { readonly text: string; readonly state: string } {
  const db = store.getDbPersistenceStatus();
  if (db.kind === "not-configured") return { text: "저장소 미설정", state: "not-configured" };
  if (db.kind === "disabled") {
    return {
      text: db.reason === "dev-showcase" ? "임시 세션" : "오프라인",
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
  if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k") {
    event.preventDefault();
    event.stopPropagation();
    openActiveEventCommandPicker(request.mapId, request.eventId);
    return;
  }
  // 이벤트 에디터 모달이 열려 있어도 Ctrl+Z/Y 로 undo/redo. store 구독으로 자동 재렌더된다.
  if (handleHistoryHotkey(event)) return;
  if (event.key !== "Delete" || event.ctrlKey || event.metaKey || event.altKey) return;
  if (isTextEditingTarget(event.target)) return;

  // 이 페이지가 하는 일(명령 리스트/툴바) 포커스 중 Delete 는 절대 이벤트 삭제로 가지 않는다.
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
    case "반영하고 닫기":
      return "반영하고 닫기";
    case "닫기":
      return "닫기";
    case "반영하고 계속":
      return "반영하고 계속";
    case "도움말":
      return "도움말 Help";
    case "테스트":
      return "이 이벤트 테스트";
    default:
      return text;
  }
}


function installFocusTrap(backdropEl: HTMLElement, windowEl: HTMLElement): () => void {
  const trap = (event: KeyboardEvent): void => {
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      windowEl.querySelectorAll<HTMLElement>(
        "button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
      ),
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey) {
      if (document.activeElement === first) { event.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  };
  backdropEl.addEventListener("keydown", trap);
  return () => backdropEl.removeEventListener("keydown", trap);
}
let disposeFocusTrap: () => void = () => {};
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

type EventEditorInteractionSnapshot = {
  readonly focusTestId?: string;
  readonly focusTestIdIndex?: number;
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
    ...(focusCustomSelectFor ? { focusCustomSelectFor } : {}),
    ...(active?.closest<HTMLElement>(".cmd-item")?.dataset.cmdPath
      ? { focusCommandPath: active.closest<HTMLElement>(".cmd-item")!.dataset.cmdPath }
      : {}),
    ...(typeof selection?.selectionStart === "number" ? { selectionStart: selection.selectionStart } : {}),
    ...(typeof selection?.selectionEnd === "number" ? { selectionEnd: selection.selectionEnd } : {}),
    ...(root.querySelector<HTMLElement>(".cmd-item.selected")?.dataset.cmdPath
      ? { selectedCommandPath: root.querySelector<HTMLElement>(".cmd-item.selected")!.dataset.cmdPath }
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
  if (snapshot.selectedCommandPath) selectRenderedCommand(root, snapshot.selectedCommandPath);

  let focusTarget: HTMLElement | null = null;
  if (snapshot.focusCustomSelectFor) {
    focusTarget = root.querySelector<HTMLElement>(`[data-custom-select-for="${snapshot.focusCustomSelectFor}"]`);
  }
  if (!focusTarget && snapshot.focusTestId) {
    focusTarget = Array.from(root.querySelectorAll<HTMLElement>(`[data-testid="${snapshot.focusTestId}"]`))[
      snapshot.focusTestIdIndex ?? 0
    ] ?? null;
  }
  if (!focusTarget && snapshot.focusCommandPath) {
    const row = findRenderedCommand(root, snapshot.focusCommandPath);
    focusTarget = row?.querySelector<HTMLElement>(".cmd-head") ?? row;
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

function selectRenderedCommand(root: HTMLElement, encodedPath: string): void {
  const row = findRenderedCommand(root, encodedPath);
  if (!row) return;
  root.querySelectorAll(".cmd-item.selected").forEach((node) => node.classList.remove("selected"));
  row.classList.add("selected");
}

function findRenderedCommand(root: HTMLElement, encodedPath: string): HTMLElement | null {
  return Array.from(root.querySelectorAll<HTMLElement>(".cmd-item"))
    .find((candidate) => candidate.dataset.cmdPath === encodedPath) ?? null;
}


