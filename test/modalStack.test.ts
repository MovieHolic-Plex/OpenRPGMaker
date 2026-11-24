import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleHistoryHotkey, historyHotkeyOwnedByPanel, shouldIgnoreEditorShortcut } from "@/editor/hotkeys";
import { registerModal, resetModalStackForTest, unregisterModal, modalStackDepthForTest } from "@/editor/ui/modalStack";
import { el } from "@/util/dom";
import { installFakeDom, FakeElement, findByTestId } from "./fakeDom";
import { renderCommitHistoryButton, renderIdentityTopbarControl } from "@/editor/teamWorkflowUi";
import { createBlankProject } from "@/project/defaults";
import { setOwnerLabel } from "@/project/editorIdentity";
import { store } from "@/project/store";
import { showAlert, showConfirm } from "@/editor/ui/modal";
import { isolateTimers } from "./mergedTeardown";

// 확인/경고 모달이 떠 있는데도 에디터 단축키가 그 뒤에서 발동했다.
//
// 회귀 배경: hotkeys.ts 의 가드가 알고 있는 모달 셀렉터는 .oprn-modal / .modal-backdrop
// 뿐이었고, 공용 confirm·alert·prompt 가 쓰는 .app-modal-overlay 는 목록에 없었다
// (modal.ts:61/179, aiGateModal.ts:65, persistenceRecoveryUi.ts:111 등이 이 클래스를 쓴다).
// 그래서 맵 삭제 확인창이 떠 있는 상태에서 도구 키(F키·숫자)·Delete 가 배경 편집기에
// 적용되고, Ctrl+Z 는 가드보다 먼저 처리되어(EditScene.handleKeyDown) 프로젝트를 바꿨다.
//
// 이 파일은 두 가드를 각각 잠근다:
//  1) shouldIgnoreEditorShortcut — .app-modal-overlay 소유권 인식
//  2) historyHotkeyOwnedByPanel  — 모달 계층이 살아 있으면 히스토리 키 소유권 양보
describe("editorShortcutModalGuard", () => {
  isolateTimers();
  let restoreDom: (() => void) | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
  });
  afterEach(() => {
    resetModalStackForTest();
    restoreDom?.();
    restoreDom = undefined;
  });
  function keyEvent(key: string, target: unknown, opts: { ctrl?: boolean } = {}): KeyboardEvent {
    return {
      key,
      ctrlKey: Boolean(opts.ctrl),
      metaKey: false,
      altKey: false,
      shiftKey: false,
      target,
      preventDefault: () => {},
    } as unknown as KeyboardEvent;
  }
  function overlayWithButton(): { overlay: HTMLElement; button: HTMLElement } {
    const overlay = el("div", { class: "app-modal-overlay" });
    const button = el("button", { text: "삭제" });
    overlay.append(button);
    document.body.append(overlay);
    return { overlay, button };
  }
  describe("에디터 단축키는 .app-modal-overlay 뒤에서 발동하지 않는다", () => {
    it("확인 모달 안의 버튼에 포커스가 있으면 도구 키를 무시한다", () => {
      const { button } = overlayWithButton();

      expect(shouldIgnoreEditorShortcut(keyEvent("F5", button))).toBe(true);
      expect(shouldIgnoreEditorShortcut(keyEvent("2", button))).toBe(true);
      expect(shouldIgnoreEditorShortcut(keyEvent("Delete", button))).toBe(true);
    });

    it("모달이 없으면 같은 키를 막지 않는다(과차단 방지)", () => {
      const plain = el("button", { text: "일반" });
      document.body.append(plain);

      expect(shouldIgnoreEditorShortcut(keyEvent("F5", plain))).toBe(false);
    });
  });
  describe("히스토리 단축키는 열린 모달 계층에 소유권을 양보한다", () => {
    it("모달이 등록되어 있으면 Ctrl+Z 를 에디터가 가져가지 않는다", () => {
      expect(historyHotkeyOwnedByPanel()).toBe(false);

      const { overlay } = overlayWithButton();
      const close = registerModal(overlay, () => {});

      expect(historyHotkeyOwnedByPanel()).toBe(true);
      expect(handleHistoryHotkey(keyEvent("z", overlay, { ctrl: true }))).toBe(false);

      close();
      unregisterModal(overlay);
      expect(historyHotkeyOwnedByPanel()).toBe(false);
    });
  });
  describe("공방 화면이 떠 있으면 에디터 단축키를 무시한다", () => {
    it("workshop-host 가 있으면 일반 키도 무시, 없으면 통과", () => {
      const plain = el("button", { text: "일반" });
      document.body.append(plain);
      expect(shouldIgnoreEditorShortcut(keyEvent("2", plain))).toBe(false);
      const host = el("div", { attrs: { "data-testid": "workshop-host" } });
      document.body.append(host);
      expect(shouldIgnoreEditorShortcut(keyEvent("2", plain))).toBe(true);
      expect(shouldIgnoreEditorShortcut(keyEvent("Delete", host))).toBe(true);
    });
  });
  it("leaves Space to the focused AI settings switch", () => {
    const settings = el("div", { dataset: { testid: "ai-settings-modal" } });
    const toggle = el("button", { attrs: { role: "switch" } });
    settings.append(toggle);
    document.body.append(settings);

    expect(shouldIgnoreEditorShortcut(keyEvent(" ", toggle))).toBe(true);
    settings.remove();
    expect(shouldIgnoreEditorShortcut(keyEvent(" ", document.body))).toBe(false);
  });
});

describe("modalStack", () => {
  isolateTimers();
  function dispatchEscape(): void {
    const event = new Event("keydown", { bubbles: true, cancelable: true }) as Event & { key: string };
    Object.defineProperty(event, "key", { configurable: true, value: "Escape" });
    document.dispatchEvent(event);
  }
  describe("modal stack Escape layering", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom();
      resetModalStackForTest();
    });

    afterEach(() => {
      resetModalStackForTest();
      restoreDom?.();
    });

    it("closes only the topmost modal on Escape", () => {
      const bottom = document.createElement("div");
      const top = document.createElement("div");
      document.body.append(bottom, top);
      let bottomClosed = 0;
      let topClosed = 0;
      registerModal(bottom, () => {
        bottomClosed += 1;
        bottom.remove();
      });
      registerModal(top, () => {
        topClosed += 1;
        top.remove();
      });
      expect(modalStackDepthForTest()).toBe(2);

      dispatchEscape();
      expect(topClosed).toBe(1);
      expect(bottomClosed).toBe(0);
      expect(modalStackDepthForTest()).toBe(1);

      dispatchEscape();
      expect(topClosed).toBe(1);
      expect(bottomClosed).toBe(1);
      expect(modalStackDepthForTest()).toBe(0);
    });

    it("unregisterModal drops a layer without calling closeUi", () => {
      const el = document.createElement("div");
      document.body.append(el);
      let closed = 0;
      registerModal(el, () => {
        closed += 1;
      });
      unregisterModal(el);
      expect(modalStackDepthForTest()).toBe(0);
      dispatchEscape();
      expect(closed).toBe(0);
    });
  });
});

describe("topbarPopoverEscapeLayer", () => {
  isolateTimers();
  // 데이터베이스 모달의 도크 모드 백드롭은 pointer-events: none 이라, 데이터베이스를
  // 켜 둔 채로 톱바의 신원 메뉴·커밋 히스토리를 열 수 있다. 이 팝오버들이 공용 Escape
  // 계층을 점유하지 않으면 Escape 가 그대로 흘러 아래 데이터베이스가 대신 닫힌다.
  //
  // teamWorkflowUi.test.ts 는 document.addEventListener 를 vi.fn() 으로 덮어써서 Escape
  // 라우팅을 볼 수 없다 — 그래서 계층 검증은 이 파일에서 따로 한다.

  class MemoryStorage implements Storage {
    private readonly values = new Map<string, string>();

    get length(): number {
      return this.values.size;
    }

    clear(): void {
      this.values.clear();
    }

    getItem(key: string): string | null {
      return this.values.get(key) ?? null;
    }

    key(index: number): string | null {
      return Array.from(this.values.keys())[index] ?? null;
    }

    removeItem(key: string): void {
      this.values.delete(key);
    }

    setItem(key: string, value: string): void {
      this.values.set(key, value);
    }
  }
  let restoreDom: (() => void) | null = null;
  beforeEach(() => {
    restoreDom = installFakeDom();
    resetModalStackForTest();
    const storage = new MemoryStorage();
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: storage,
        setTimeout: (handler: TimerHandler) => {
          if (typeof handler === "function") handler();
          return 0;
        },
      },
    });
    store.replace(createBlankProject());
  });
  afterEach(() => {
    resetModalStackForTest();
    restoreDom?.();
    restoreDom = null;
    Reflect.deleteProperty(globalThis, "localStorage");
    Reflect.deleteProperty(globalThis, "window");
    vi.restoreAllMocks();
  });
  function fakeBody(): FakeElement {
    if (document.body instanceof FakeElement) return document.body;
    throw new Error("Expected fake body");
  }
  function fakeElement(node: HTMLElement): FakeElement {
    if (node instanceof FakeElement) return node;
    throw new Error("Expected fake element");
  }
  function dispatchEscape(): void {
    const event = new Event("keydown", { bubbles: true, cancelable: true }) as Event & { key: string };
    Object.defineProperty(event, "key", { configurable: true, value: "Escape" });
    document.dispatchEvent(event);
  }
  describe("톱바 팝오버의 Escape 계층", () => {
    it("커밋 히스토리 패널은 계층을 점유하고 Escape 로 자기만 닫는다", async () => {
      const button = renderCommitHistoryButton();
      document.body.append(button);

      button.click();
      await Promise.resolve();
      expect(findByTestId(fakeBody(), "commit-history-panel")).not.toBeNull();
      expect(modalStackDepthForTest()).toBe(1);

      dispatchEscape();

      expect(findByTestId(fakeBody(), "commit-history-panel")).toBeNull();
      expect(modalStackDepthForTest()).toBe(0);
    });

    it("신원 메뉴도 계층을 점유하고 Escape 로 자기만 닫는다", () => {
      setOwnerLabel("기존 사용자");
      const identity = renderIdentityTopbarControl(() => undefined);
      document.body.append(identity);

      findByTestId(fakeElement(identity), "topbar-identity")?.click();
      expect(findByTestId(fakeBody(), "identity-label-input")).not.toBeNull();
      expect(modalStackDepthForTest()).toBe(1);

      dispatchEscape();

      expect(findByTestId(fakeBody(), "identity-label-input")).toBeNull();
      expect(modalStackDepthForTest()).toBe(0);
    });
  });
});

// 커스텀 인앱 모달 T5 (2026-07-07 타일 시공 흐름 재설계 §2.4 — G5).
// - showConfirm: 확인=true / 취소·Esc·바깥 클릭=false 로 resolve.
// - showAlert: 확인으로 resolve.
// - 헤드리스(window/document 없음): 자동 통과(confirm→true) — 기존 window.confirm 부재 규약 승계.
describe("uiModal", () => {
  isolateTimers();
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
});
