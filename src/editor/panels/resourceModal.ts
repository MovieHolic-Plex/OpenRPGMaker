import {
  disposeResourceManager, renderResourceManager, requestResourceManagerClose,
} from "@/editor/panels/resourceManager";
import { isTopModal, registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { handleHistoryHotkey, isHistoryHotkeyChord, isTextEditingElement } from "@/editor/hotkeys";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import type { ResourceKind } from "@/project/types";

let activeResourceModal: {
  readonly element: HTMLElement;
  readonly dispose: () => void;
} | null = null;

export function openResourceModal(initialKind?: ResourceKind): void {
  if (activeResourceModal?.element.isConnected && !initialKind) {
    activeResourceModal.element.querySelector<HTMLElement>('[data-testid="resource-modal-close"]')?.focus();
    return;
  }
  activeResourceModal?.dispose();
  const opener = document.activeElement;
  const identity = store.getProjectIdentity();

  const body = el("div", { class: "database-modal-body" });
  const closeButton = el("button", {
    class: "database-modal-close",
    text: "×",
    attrs: { type: "button", title: "닫기", "aria-label": "리소스 관리자 닫기" },
    dataset: { testid: "resource-modal-close" },
  });
  const backdrop = el("div", {
    class: "database-modal-backdrop",
    attrs: { role: "presentation" },
    dataset: { testid: "resource-modal" },
    children: [
      el("section", {
        class: "database-modal-window resource-modal-window",
        attrs: { role: "dialog", "aria-modal": "true", "aria-label": "리소스 관리자" },
        children: [
          el("header", {
            class: "database-modal-header",
            children: [el("h2", { text: "리소스 관리자" }), closeButton],
          }),
          body,
        ],
      }),
    ],
  });

  let closed = false;
  let unsubscribe = (): void => {};
  const dispose = (): void => {
    if (closed) return;
    closed = true;
    unsubscribe();
    disposeResourceManager(body);
    unregisterModal(backdrop);
    backdrop.remove();
    activeResourceModal = null;
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
  };
  const close = (): void => requestResourceManagerClose(body, dispose);
  const escape = (): void => {
    // modalStack removes the entry before invoking us. Re-arm before opening
    // a nested dirty prompt so cancel retains the resource layer's ownership.
    if (closed) return;
    registerModal(backdrop, escape);
    close();
  };
  closeButton.addEventListener("click", close);
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop && isTopModal(backdrop)) close();
  });
  backdrop.addEventListener("keydown", event => {
    if (!isTopModal(backdrop)) return;
    if (isHistoryHotkeyChord(event) && !isTextEditingElement(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      requestResourceManagerClose(body, () => { handleHistoryHotkey(event); });
      return;
    }
    if (event.key !== "Tab") return;
    const targets = [...backdrop.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([type="file"]):not([disabled]), textarea:not([disabled]), select:not([aria-hidden="true"]), audio[controls]',
    )].filter(node => !node.hidden && !node.closest("[hidden]"));
    const first = targets[0];
    const last = targets[targets.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  const footer = el("footer", {
    class: "resource-modal-footer",
    children: [
      el("span", { class: "resource-footer-status", text: "사용 중인 리소스는 삭제할 수 없습니다." }),
      el("div", {
        class: "resource-footer-actions",
        children: [
          el("button", { class: "resource-footer-button", text: "닫기", attrs: { type: "button" }, on: { click: close } }),
          el("button", {
            class: "resource-footer-button",
            text: "도움말",
            attrs: { type: "button" },
            on: { click: () => toast("리소스 종류를 선택하고 PNG 파일을 가져옵니다.", "ok") },
          }),
        ],
      }),
    ],
  });
  backdrop.querySelector(".resource-modal-window")?.append(footer);
  document.body.append(backdrop);
  // Escape 는 공용 모달 스택이 라우팅한다. 자체 document 리스너로 잡으면 도크 모드에서
  // 데이터베이스를 켠 채 이 창을 열었을 때 데이터베이스까지 함께 닫혔다.
  registerModal(backdrop, escape);
  renderResourceManager(body, initialKind);
  unsubscribe = store.subscribe((_project, change) => {
    const current = store.getProjectIdentity();
    if (change.projectSwitch || current.kind !== identity.kind || current.id !== identity.id) {
      dispose();
      return;
    }
    if (change.scope === "project" || change.scope === "assets") renderResourceManager(body, initialKind);
  });
  activeResourceModal = { element: backdrop, dispose };
  closeButton.focus();
}
