import { editorState } from "@/editor/editorState";
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
  const request: OpenEventEditorRequest = { mapId, eventId };
  const backdrop = el("div", {
    class: "event-editor-modal-backdrop",
    dataset: { testid: EVENT_EDITOR_MODAL_TEST_ID, mapId, eventId },
  });
  const windowEl = el("section", {
    class: "event-editor-modal-window",
    attrs: { role: "dialog", "aria-modal": "true", "aria-label": "Event Editor" },
  });
  // body를 두 영역으로 분리:
  //  - stableBody: 카탈로그(명령 추가 버튼) 등 클릭 연속성이 중요한 정적 UI.
  //    store 변경 시에도 재생성하지 않아 빠른 연타 클릭이 detach되지 않는다.
  //  - dynamicBody: 페이지 탭/명령 리스트 등 상태 반영이 필요한 영역.
  const body = el("div", { class: "event-editor-modal-body" });
  const stableBody = el("div", { class: "event-editor-modal-stable" });
  const dynamicBody = el("div", { class: "event-editor-modal-dynamic" });
  body.append(stableBody, dynamicBody);
  const close = createCloseHandler(backdrop);
  windowEl.append(renderModalHeader(request, close), body);
  backdrop.append(windowEl);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  let stableRendered = false;
  const refresh = () => {
    // 정적 영역은 최초 1회만 렌더링. store 변경에도 카탈로그 버튼을 보존하여
    // 연속 클릭(명령 연타) 중 버튼이 detach되는 것을 막는다.
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
  backdrop.addEventListener("rpgzzu:event-editor-close", () => {
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

function renderModalHeader(request: OpenEventEditorRequest, close: () => void): HTMLElement {
  const project = store.getCurrent();
  const map = project.maps[request.mapId];
  const eventName = map?.events.find((event) => event.id === request.eventId)?.id ?? request.eventId;
  const header = el("div", { class: "event-editor-modal-header" });
  header.append(
    el("div", {
      children: [
        el("h2", { text: "Event Editor" }),
        el("p", { text: `${map?.name ?? request.mapId} / ${eventName}` }),
      ],
    }),
    el("button", {
      class: "btn event-editor-modal-close",
      text: "x",
      attrs: { type: "button", title: "Close" },
      dataset: { testid: "event-editor-modal-close" },
      on: { click: close },
    })
  );
  return header;
}

function createCloseHandler(backdrop: HTMLElement): () => void {
  return () => {
    backdrop.dispatchEvent(new CustomEvent("rpgzzu:event-editor-close"));
    backdrop.remove();
  };
}

function focusFirstDialogControl(root: HTMLElement): void {
  const first = root.querySelector("button, input, select, textarea");
  if (first instanceof HTMLElement) first.focus();
}
