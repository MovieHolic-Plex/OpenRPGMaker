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
import { eventDraftDiffById } from "@/project/eventDrafts";
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
import { attachWindowDrag } from "./modalDrag";
import { attachWindowResize, renderModalResizeHandle } from "./modalResize";
import { toast } from "@/util/toast";

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
  clearCommandToolbarHistories(`${request.mapId}:${request.eventId}:`);
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
    if (!document.querySelector("[data-testid='event-editor-modal']")) {
      document.body.classList.remove("event-editor-modal-open");
    }
    disposeFocusTrap();
  };
  registerModal(backdrop, () => closeHandler(false));
  const header = renderModalHeader(request.mapId, request.eventId, () => closeHandler(false));
  attachWindowDrag(header, windowEl);
  const resizeHandle = renderModalResizeHandle();
  attachWindowResize(resizeHandle, windowEl);
  const footer = renderModalFooter(request, closeHandler);
  windowEl.append(header, body, footer, resizeHandle);
  backdrop.append(windowEl);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeHandler(false);
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
    restoreEventEditorScroll(dynamicBody, scrollSnapshots);
    restoreEventEditorInteraction(dynamicBody, interactionSnapshot);
    refreshModalFooterStatus(footer, request);
    // Keep title in sync when draft meta changes after autosave reattach.
    const title = header.querySelector("h2");
    if (title) title.textContent = eventEditorTitle(request.mapId, request.eventId);
  };
  const unsubscribeStore = store.subscribe(refresh);
  const unsubscribeEditor = editorState.subscribe(refresh);
  const unsubscribeAutoSave = store.subscribeAutoSave(() => refreshModalFooterStatus(footer, request));
  const checkpointTimer = globalThis.setInterval(() => {
    const diff = eventDraftDiffById(store.getCurrent(), request.mapId, request.eventId);
    if (diff && diff.changes.length > 0) checkpointEventDraft(request.mapId, request.eventId);
  }, EVENT_EDITOR_CHECKPOINT_MS);
  backdrop.addEventListener("keydown", (event) => handleModalKeyDown(event, request, closeHandler));
  backdrop.addEventListener(EVENT_EDITOR_CLOSE_EVENT, (event) => {
    const saved = event instanceof CustomEvent && event.detail?.saved === true;
    globalThis.clearInterval(checkpointTimer);
    clearCommandToolbarHistories(`${request.mapId}:${request.eventId}:`);
    if (!saved) discardEventDraft(request.mapId, request.eventId);
    unsubscribeStore();
    unsubscribeEditor();
    unsubscribeAutoSave();
  });
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
  return el("div", {
    class: "event-editor-modal-header",
    dataset: { testid: "event-editor-titlebar" },
    children: [
      el("div", {
        class: "event-editor-window-title",
        children: [
          el("div", { class: "event-editor-window-eyebrow", text: eyebrow, attrs: { "aria-hidden": "true" } }),
          el("h2", { text: title }),
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

function eventEditorTitleParts(mapId: MapId, eventId: string): { readonly eyebrow: string; readonly title: string } {
  return { eyebrow: "RPG ZZU ENGINE IDE  ·  이벤트 에디터", title: eventEditorTitle(mapId, eventId) };
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
    ? "취소하면 이 새 이벤트를 삭제합니다."
    : "취소하면 열기 전 상태로 되돌립니다.";
  const footer = el("div", {
    class: "event-editor-modal-footer",
    children: [
      el("div", {
        class: "event-editor-footer-leading",
        children: [
          el("div", {
            class: "event-editor-lifecycle-status",
            children: [
              el("span", {
                class: "event-editor-draft-status",
                text: cancelHint,
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
          // 목업과 동일 순서: 삭제도 확인 묶음 앞 액션 그룹에 둔다.
          footerButton("삭제", "event-delete", () => {
            if (requestEditorEventDeletion(request.mapId, request.eventId)) close(true);
          }),
          footerButton("이 이벤트 테스트", "event-editor-test", () => {
            const validation = validateForModalAction(request, "테스트");
            if (!validation.canCommit) return;
            void openSelectedEventTestModal(request.mapId, request.eventId);
          }),
          footerButton("취소", "event-editor-cancel", () => close()),
          footerButton("적용", "event-editor-apply", () => {
            if (!commitValidatedEventDraft(request, "적용")) return;
            footer.dataset.applied = "true";
            beginExistingEventDraft(request.mapId, request.eventId);
            refreshModalFooterStatus(footer, request);
          }),
          footerButton("확인", "event-editor-ok", () => {
            if (!commitValidatedEventDraft(request, "확인")) return;
            close(true);
          }, true),
          footerButton("도움말", "event-editor-help", () => openEventEditorHelp()),
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
  if (!local || !remote) return;
  const project = store.getCurrent();
  const event = project.maps[request.mapId]?.events.find((entry) => entry.id === request.eventId);
  const diff = eventDraftDiffById(project, request.mapId, request.eventId);
  const changed = Boolean(diff && diff.changes.length > 0);
  if (changed) {
    local.textContent = "편집 중 · 변경사항 있음 — 적용(Apply)으로 프로젝트에 반영하세요";
    local.dataset.state = "working";
  } else if (footer.dataset.applied === "true") {
    local.textContent = "적용됨 — 확인(OK)으로 닫거나 계속 편집하세요";
    local.dataset.state = "applied";
  } else if (event?.draft) {
    local.textContent = "편집 세션 · 변경 없음";
    local.dataset.state = "session";
  } else {
    local.textContent = "저장된 상태";
    local.dataset.state = "project";
  }
  const remoteStatus = remotePersistenceLabel(store.getAutoSaveState());
  remote.textContent = remoteStatus.text;
  remote.dataset.state = remoteStatus.state;
  // Apply vs Confirm 구분 힌트: 버튼 타이틀에 병기
  const applyBtn = footer.querySelector<HTMLElement>('[data-testid="event-editor-apply"]');
  const okBtn = footer.querySelector<HTMLElement>('[data-testid="event-editor-ok"]');
  if (applyBtn) applyBtn.title = "적용 — 저장하지 않고 편집을 유지하며 프로젝트에 반영";
  if (okBtn) okBtn.title = "확인 — 적용 후 에디터를 닫음";
}

function remotePersistenceLabel(autoSave: AutoSaveState): { readonly text: string; readonly state: string } {
  const db = store.getDbPersistenceStatus();
  if (db.kind === "not-configured") return { text: "저장소 · 미설정", state: "not-configured" };
  if (db.kind === "disabled") {
    return {
      text: db.reason === "dev-showcase" ? "저장소 · 임시 세션" : "저장소 · 오프라인",
      state: "disabled",
    };
  }
  switch (autoSave.kind) {
    case "pending": return { text: "저장 대기 중", state: "pending" };
    case "saving": return { text: "저장 중…", state: "saving" };
    case "saved": return { text: `저장됨 · ${new Date(autoSave.at).toLocaleTimeString()}`, state: "saved" };
    case "error": return { text: `저장 실패 · ${autoSave.message}`, state: "error" };
    case "idle": return { text: "저장 준비됨", state: "idle" };
  }
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
  const matchingFocusNodes = focusTestId
    ? Array.from(root.querySelectorAll<HTMLElement>(`[data-testid="${focusTestId}"]`))
    : [];
  const selection = active as (HTMLInputElement | HTMLTextAreaElement | null);
  return {
    ...(focusTestId ? { focusTestId, focusTestIdIndex: Math.max(0, matchingFocusNodes.indexOf(active!)) } : {}),
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
  if (snapshot.focusTestId) {
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

function displayEventNumber(mapId: MapId, eventId: string): string {
  const events = store.getCurrent().maps[mapId]?.events ?? [];
  const index = events.findIndex((event) => event.id === eventId);
  return String(index >= 0 ? index + 1 : 1).padStart(4, "0");
}
