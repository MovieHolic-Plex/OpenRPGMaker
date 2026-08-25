import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { openDatabaseModal, requestDatabaseModalClose } from "@/editor/panels/databaseModal";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

// DB 3파 M8 — 사이드 도킹.
// ① 토글 시 클래스/aria 전환(도크: role=complementary + aria-modal 제거, 복원: 원상).
// ② localStorage["oprn:db-dock-mode"] 저장/다음 오픈 시 복원.
// ③ 도크 모드에서 backdrop 클릭(바깥 클릭)이 close 를 트리거하지 않는다 — 맵 조작이 곧 바깥 클릭.

let restoreDom: (() => void) | undefined;
let previousWindow: typeof globalThis.window | undefined;
let fakeStorage: Storage;

beforeEach(() => {
  restoreDom = installFakeDom();
  previousWindow = globalThis.window;
  fakeStorage = createFakeLocalStorage();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      clearTimeout,
      localStorage: fakeStorage,
      setTimeout: (handler: TimerHandler): number => {
        if (typeof handler === "function") handler();
        return 0;
      },
    },
  });
  store.replace(createBlankProject());
  resetMapEditHistory();
});

afterEach(() => {
  requestDatabaseModalClose("battleTest");
  document.querySelector("[data-testid='database-modal']")?.remove();
  restoreDom?.();
  restoreDom = undefined;
  if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
  else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
});

function createFakeLocalStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
  } as Storage;
}

function modalParts(): { backdrop: FakeElement; windowEl: FakeElement; dockToggle: FakeElement } {
  const backdrop = document.querySelector("[data-testid='database-modal']");
  if (!(backdrop instanceof FakeElement)) throw new Error("database modal not open");
  const windowEl = backdrop.querySelector(".database-modal-window");
  const dockToggle = findByTestId(backdrop, "database-dock-toggle");
  if (!(windowEl instanceof FakeElement) || !dockToggle) throw new Error("missing modal window or dock toggle");
  return { backdrop, windowEl, dockToggle };
}

describe("database modal dock mode (M8)", () => {
  it("toggles classes and aria between dialog and side dock", () => {
    openDatabaseModal("actors");
    const { backdrop, windowEl, dockToggle } = modalParts();
    expect(windowEl.attrs.role).toBe("dialog");
    expect(windowEl.attrs["aria-modal"]).toBe("true");
    expect(dockToggle.attrs["aria-label"]).toBe("사이드 도크로 전환");

    dockToggle.click();
    expect(backdrop.classList.contains("is-docked")).toBe(true);
    expect(windowEl.attrs.role).toBe("complementary");
    expect(windowEl.getAttribute("aria-modal")).toBeNull();
    expect(dockToggle.attrs["aria-label"]).toBe("창 모드로 복원");

    dockToggle.click();
    expect(backdrop.classList.contains("is-docked")).toBe(false);
    expect(windowEl.attrs.role).toBe("dialog");
    expect(windowEl.attrs["aria-modal"]).toBe("true");
    expect(dockToggle.attrs["aria-label"]).toBe("사이드 도크로 전환");
  });

  it("disables maximize while docked and clears maximized state on dock", () => {
    openDatabaseModal("actors");
    const { backdrop, windowEl, dockToggle } = modalParts();
    const maximize = findByTestId(backdrop, "database-modal-maximize");
    if (!maximize) throw new Error("missing maximize button");

    maximize.click();
    expect(windowEl.classList.contains("maximized")).toBe(true);

    dockToggle.click();
    // 도크 전환은 최대화 상태를 정리하고, 도크 중 최대화는 무시된다.
    expect(windowEl.classList.contains("maximized")).toBe(false);
    maximize.click();
    expect(windowEl.classList.contains("maximized")).toBe(false);
  });

  it("persists dock mode and restores it on next open", () => {
    openDatabaseModal("actors");
    modalParts().dockToggle.click();
    expect(fakeStorage.getItem("oprn:db-dock-mode")).toBe("1");
    requestDatabaseModalClose("battleTest");

    openDatabaseModal("actors");
    const { backdrop, windowEl } = modalParts();
    expect(backdrop.classList.contains("is-docked")).toBe(true);
    expect(windowEl.attrs.role).toBe("complementary");

    // 창 모드로 복원하면 저장값도 0 으로 돌아간다.
    modalParts().dockToggle.click();
    expect(fakeStorage.getItem("oprn:db-dock-mode")).toBe("0");
  });

  it("does not close on backdrop click while docked, but still does in window mode", () => {
    openDatabaseModal("actors");
    const { backdrop, dockToggle } = modalParts();
    dockToggle.click();

    backdrop.dispatchEvent(new Event("mousedown"));
    expect(document.querySelector("[data-testid='database-modal']")).not.toBeNull();

    // 창 모드로 복원하면 바깥 클릭 닫기가 다시 동작한다(dirty 아님 → 즉시 close).
    dockToggle.click();
    backdrop.dispatchEvent(new Event("mousedown"));
    expect(document.querySelector("[data-testid='database-modal']")).toBeNull();
  });
});
