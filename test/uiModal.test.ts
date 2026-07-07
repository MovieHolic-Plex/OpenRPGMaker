// 커스텀 인앱 모달 T5 (2026-07-07 타일 시공 흐름 재설계 §2.4 — G5).
// - showConfirm: 확인=true / 취소·Esc·바깥 클릭=false 로 resolve.
// - showAlert: 확인으로 resolve.
// - 헤드리스(window/document 없음): 자동 통과(confirm→true) — 기존 window.confirm 부재 규약 승계.

import { afterEach, describe, expect, it } from "vitest";
import { showAlert, showConfirm } from "@/editor/ui/modal";
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
  restoreDom?.();
  restoreDom = null;
  restoreWindow?.();
  restoreWindow = null;
});

function body(): FakeElement {
  return document.body as unknown as FakeElement;
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
