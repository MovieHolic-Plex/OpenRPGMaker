// 커스텀 인앱 모달 T5 (2026-07-07 타일 시공 흐름 재설계 §2.4 — G5).
// - showConfirm: 확인=true / 취소·Esc·바깥 클릭=false 로 resolve.
// - showAlert: 확인으로 resolve.
// - 헤드리스(window/document 없음): 자동 통과(confirm→true) — 기존 window.confirm 부재 규약 승계.

import { afterEach, describe, expect, it } from "vitest";
import { showAlert, showConfirm } from "@/editor/ui/modal";
import { modalStackDepthForTest, registerModal, resetModalStackForTest } from "@/editor/ui/modalStack";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | null = null;
let restoreWindow: (() => void) | null = null;

function installBrowserLikeGlobals(): void {
  restoreDom = installFakeDom();
  const hadWindow = "window" in globalThis;
  const previous = (globalThis as { window?: unknown }).window;
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: {} });
  restoreWindow = () => {
    if (hadWindow) (globalThis as { window?: unknown }).window = previous;
    else Reflect.deleteProperty(globalThis, "window");
  };
}

afterEach(() => {
  resetModalStackForTest();
  restoreDom?.();
  restoreDom = null;
  restoreWindow?.();
  restoreWindow = null;
});

function body(): FakeElement {
  return document.body as unknown as FakeElement;
}

function requireByTestId(testId: string): FakeElement {
  const element = findByTestId(body(), testId);
  if (!element) throw new Error(`Expected ${testId} to be rendered`);
  return element;
}

function dispatchKey(target: EventTarget, key: string, shiftKey = false): Event {
  const event = new Event("keydown", { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    key: { configurable: true, value: key },
    shiftKey: { configurable: true, value: shiftKey },
  });
  target.dispatchEvent(event);
  return event;
}

describe("T5 — showConfirm", () => {
  it("헤드리스(window 없음)에서는 자동 통과한다", async () => {
    await expect(showConfirm({ message: "지울까요?" })).resolves.toBe(true);
    await expect(showAlert({ message: "알림" })).resolves.toBeUndefined();
  });

  it("확인 버튼 클릭 → true, 오버레이가 제거된다", async () => {
    installBrowserLikeGlobals();
    const promise = showConfirm({ title: "삭제", message: "정말 삭제할까요?", confirmLabel: "삭제", danger: true });
    const modal = findByTestId(body(), "app-confirm-modal");
    expect(modal).toBeTruthy();
    expect(modal!.textContent).toContain("정말 삭제할까요?");
    findByTestId(body(), "app-modal-confirm")!.click();
    await expect(promise).resolves.toBe(true);
    expect(findByTestId(body(), "app-confirm-modal")).toBeNull();
  });

  it("취소 버튼 → false, 오버레이(바깥) 클릭 → false", async () => {
    installBrowserLikeGlobals();
    const cancelled = showConfirm({ message: "계속할까요?" });
    findByTestId(body(), "app-modal-cancel")!.click();
    await expect(cancelled).resolves.toBe(false);

    const dismissed = showConfirm({ message: "바깥 클릭" });
    findByTestId(body(), "app-confirm-modal")!.click();
    await expect(dismissed).resolves.toBe(false);
    expect(findByTestId(body(), "app-confirm-modal")).toBeNull();
  });
});

describe("T5 — showAlert", () => {
  it("확인 버튼으로 resolve 되고 오버레이가 제거된다", async () => {
    installBrowserLikeGlobals();
    const promise = showAlert({ title: "알림", message: "시공이 완료됐습니다." });
    const modal = findByTestId(body(), "app-alert-modal");
    expect(modal).toBeTruthy();
    findByTestId(body(), "app-modal-confirm")!.click();
    await expect(promise).resolves.toBeUndefined();
    expect(findByTestId(body(), "app-alert-modal")).toBeNull();
  });
});

describe("shared modal accessibility lifecycle", () => {
  it("labels and describes the confirm alertdialog with stable element IDs", () => {
    installBrowserLikeGlobals();

    void showConfirm({ title: "삭제", message: "정말 삭제할까요?" });

    const card = body().querySelector(".app-modal-card");
    const title = body().querySelector(".app-modal-title");
    const message = body().querySelector(".app-modal-message");
    expect(card?.getAttribute("role")).toBe("alertdialog");
    expect(title?.getAttribute("id")).toMatch(/^app-modal-title-\d+$/u);
    expect(message?.getAttribute("id")).toMatch(/^app-modal-message-\d+$/u);
    expect(card?.getAttribute("aria-labelledby")).toBe(title?.getAttribute("id"));
    expect(card?.getAttribute("aria-describedby")).toBe(message?.getAttribute("id"));
  });

  it("focuses the first logical action and wraps Tab in both directions", () => {
    installBrowserLikeGlobals();

    void showConfirm({ message: "계속할까요?" });
    const cancel = requireByTestId("app-modal-cancel");
    const confirm = requireByTestId("app-modal-confirm");
    expect(document.activeElement).toBe(cancel);

    confirm.focus();
    const forward = dispatchKey(confirm, "Tab");
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(cancel);

    const backward = dispatchKey(cancel, "Tab", true);
    expect(backward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(confirm);
  });

  it("restores the opener after confirm, cancel, backdrop, and Escape close paths", async () => {
    installBrowserLikeGlobals();
    const opener = document.createElement("button");
    body().append(opener as unknown as FakeElement);

    const closePaths = [
      { close: () => requireByTestId("app-modal-confirm").click(), expected: true },
      { close: () => requireByTestId("app-modal-cancel").click(), expected: false },
      { close: () => requireByTestId("app-confirm-modal").click(), expected: false },
      { close: () => dispatchKey(document, "Escape"), expected: false },
    ];
    for (const closePath of closePaths) {
      opener.focus();
      const pending = showConfirm({ message: "계속할까요?" });
      closePath.close();
      await expect(pending).resolves.toBe(closePath.expected);
      expect(document.activeElement).toBe(opener);
    }
  });

  it("restores the opener after alert confirmation", async () => {
    installBrowserLikeGlobals();
    const opener = document.createElement("button");
    body().append(opener as unknown as FakeElement);
    opener.focus();

    const pending = showAlert({ message: "완료됐습니다." });
    requireByTestId("app-modal-confirm").click();

    await expect(pending).resolves.toBeUndefined();
    expect(document.activeElement).toBe(opener);
  });

  it("does not restore a detached opener", async () => {
    installBrowserLikeGlobals();
    const opener = document.createElement("button");
    body().append(opener as unknown as FakeElement);
    opener.focus();
    const pending = showConfirm({ message: "계속할까요?" });
    opener.remove();

    requireByTestId("app-modal-cancel").click();

    await expect(pending).resolves.toBe(false);
    expect(document.activeElement).not.toBe(opener);
  });

  it("closes only the top shared confirm on Escape over a registered modal", async () => {
    installBrowserLikeGlobals();
    const parentModal = document.createElement("div");
    body().append(parentModal as unknown as FakeElement);
    let parentCloseCount = 0;
    registerModal(parentModal, () => {
      parentCloseCount += 1;
      parentModal.remove();
    });

    const pending = showConfirm({ message: "계속할까요?" });
    expect(modalStackDepthForTest()).toBe(2);
    dispatchKey(document, "Escape");

    await expect(pending).resolves.toBe(false);
    expect(parentCloseCount).toBe(0);
    expect(modalStackDepthForTest()).toBe(1);
  });

  it("settles and unregisters exactly once when close events repeat", async () => {
    installBrowserLikeGlobals();
    let resolutions = 0;
    const pending = showConfirm({ message: "계속할까요?" }).then(() => {
      resolutions += 1;
    });
    const confirm = requireByTestId("app-modal-confirm");
    const overlay = requireByTestId("app-confirm-modal");

    confirm.click();
    overlay.click();
    dispatchKey(document, "Escape");

    await pending;
    expect(resolutions).toBe(1);
    expect(modalStackDepthForTest()).toBe(0);
  });

  it("uses dialog semantics for an acknowledgement action", () => {
    installBrowserLikeGlobals();

    void showAlert({ title: "알림", message: "저장됐습니다." });

    expect(body().querySelector(".app-modal-card")?.getAttribute("role")).toBe("dialog");
  });
});
