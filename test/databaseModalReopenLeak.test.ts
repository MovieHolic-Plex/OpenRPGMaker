import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { openDatabaseModal } from "@/editor/panels/databaseModal";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { documentListenerCount, installFakeDom } from "./fakeDom";

// P10(1파 리뷰 이관): openDatabaseModal 이 재오픈 시 이전 인스턴스의 DOM 만
// querySelector(...).remove() 로 뜯어내면 document keydown 리스너 2개(dirty-close
// Escape 핸들러 + undo/redo 히스토리 핸들러)가 인스턴스마다 누적된다.
// 기존 인스턴스의 정식 close() 를 경유해야 한다.
let restoreDom: (() => void) | undefined;
let previousWindow: typeof globalThis.window | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      clearTimeout,
      localStorage: createFakeLocalStorage(),
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

describe("database modal reopen path closes the previous instance (P10)", () => {
  it("keeps exactly 2 document keydown listeners after repeated reopen", () => {
    openDatabaseModal("actors");
    expect(documentListenerCount("keydown")).toBe(2);

    openDatabaseModal("actors");
    // 재오픈이 정식 close() 를 경유하지 않으면 여기서 4가 된다.
    expect(documentListenerCount("keydown")).toBe(2);

    openDatabaseModal("troops");
    expect(documentListenerCount("keydown")).toBe(2);
    expect(document.querySelectorAll("[data-testid='database-modal']").length).toBe(1);
  });
});
