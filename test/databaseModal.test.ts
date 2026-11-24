import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { openDatabaseModal, requestDatabaseModalClose } from "@/editor/panels/databaseModal";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { documentListenerCount, installFakeDom } from "./fakeDom";
import { openResourceModal } from "@/editor/panels/resourceModal";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { isolateTimers } from "./mergedTeardown";

describe("databaseModalReopenLeak", () => {
  isolateTimers();
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
    it("restores the attached opener after close without stealing focus on cross-tab reuse", () => {
      const opener = document.createElement("button");
      document.body.append(opener);
      opener.focus();
      openDatabaseModal("actors");
      openDatabaseModal("troops");
      expect(document.activeElement).not.toBe(opener);
      requestDatabaseModalClose("battleTest");
      expect(document.activeElement).toBe(opener);
    });

    it("restores the logical opener after a topbar replacement", () => {
      const opener = document.createElement("button");
      opener.dataset.testid = "toolbar-database";
      document.body.append(opener);
      opener.focus();
      openDatabaseModal("actors");
      opener.remove();
      const replacement = document.createElement("button");
      replacement.dataset.testid = "toolbar-database";
      document.body.append(replacement);
      requestDatabaseModalClose("battleTest");
      expect(document.activeElement).toBe(replacement);
    });

    it("does not focus a disconnected opener without a replacement", () => {
      const opener = document.createElement("button");
      document.body.append(opener);
      opener.focus();
      openDatabaseModal("actors");
      opener.remove();
      requestDatabaseModalClose("battleTest");
      expect(document.activeElement).not.toBe(opener);
    });

    // 3 = 모달 인스턴스의 2개(dirty-close Escape + undo/redo 히스토리)
    //   + modalStack 의 공유 캡처 리스너 1개.
    // 공유 리스너는 document 당 한 번만 붙고(ensureListening) 모달을 닫아도 남는다 —
    // 그래서 재오픈해도 총량이 늘지 않는다는 이 테스트의 취지는 그대로다.
    // (2026-09-19: DB 모달이 창 모드에서 modalStack 에 등록되면서 2 → 3 이 됐다. 등록은
    //  포커스 트랩·Escape 층 소유권을 위한 것이다 — 리뷰 P0-2.)
    it("keeps exactly 3 document keydown listeners after repeated reopen", () => {
      openDatabaseModal("actors");
      expect(documentListenerCount("keydown")).toBe(3);

      openDatabaseModal("actors");
      // 재오픈이 정식 close() 를 경유하지 않으면 여기서 5가 된다.
      expect(documentListenerCount("keydown")).toBe(3);

      openDatabaseModal("troops");
      expect(documentListenerCount("keydown")).toBe(3);
      expect(document.querySelectorAll("[data-testid='database-modal']").length).toBe(1);
    });
  });
});

describe("databaseNestedModalEscape", () => {
  isolateTimers();
  // DB 모달은 자기 document keydown 리스너로 Escape 를 잡아 통째로 닫는다. 그 안에서
  // 연 중첩 다이얼로그가 모달 스택에 등록되지 않으면 Escape 가 그대로 흘러내려
  // "나중에 연 중첩창"이 아니라 "먼저 연 데이터베이스"가 닫힌다.
  let restoreDom: (() => void) | undefined;
  let previousWindow: typeof globalThis.window | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
    resetModalStackForTest();
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
    document.querySelector("[data-testid='resource-modal']")?.remove();
    resetModalStackForTest();
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
  function dispatchEscape(): void {
    const event = new Event("keydown", { bubbles: true, cancelable: true }) as Event & { key: string };
    Object.defineProperty(event, "key", { configurable: true, value: "Escape" });
    document.dispatchEvent(event);
  }
  function clickTestId(testid: string): void {
    const target = document.querySelector(`[data-testid='${testid}']`);
    expect(target, `${testid} 를 찾지 못했다`).toBeTruthy();
    (target as unknown as { click: () => void }).click();
  }
  function exists(testid: string): boolean {
    return document.querySelector(`[data-testid='${testid}']`) !== null;
  }
  describe("데이터베이스 중첩 다이얼로그의 Escape 계층", () => {
    it("직업 능력치 곡선 다이얼로그를 열면 Escape 가 그 다이얼로그만 닫는다", () => {
      openDatabaseModal("classes");
      clickTestId("db-class-curve-edit-maxHp");
      expect(exists("db-class-parameter-dialog")).toBe(true);

      dispatchEscape();

      // 버그일 때: 중첩창은 그대로 남고 데이터베이스가 닫힌다.
      expect({ nested: exists("db-class-parameter-dialog"), database: exists("database-modal") }).toEqual({
        nested: false,
        database: true,
      });

      // 계층이 하나씩 벗겨진다 — 중첩창이 사라진 뒤의 Escape 는 데이터베이스 몫이다.
      dispatchEscape();
      expect(exists("database-modal")).toBe(false);
    });

    // 배우 탭에도 같은 이름의 곡선 편집기가 따로 있다(actorRecordCurveEditors.ts).
    // 직업 탭만 고치고 여기를 빠뜨려 사용자가 같은 버그를 다시 만났다.
    it("배우 능력치 곡선 다이얼로그도 Escape 로 자기만 닫는다", () => {
      openDatabaseModal("actors");
      clickTestId("db-actor-curve-edit-maxHp");
      expect(exists("db-actor-parameter-dialog")).toBe(true);

      dispatchEscape();

      expect({ nested: exists("db-actor-parameter-dialog"), database: exists("database-modal") }).toEqual({
        nested: false,
        database: true,
      });
    });

    it("배우 경험치 곡선 다이얼로그도 Escape 로 자기만 닫는다", () => {
      openDatabaseModal("actors");
      clickTestId("db-actor-exp-edit");
      expect(exists("db-actor-exp-dialog")).toBe(true);

      dispatchEscape();

      expect({ nested: exists("db-actor-exp-dialog"), database: exists("database-modal") }).toEqual({
        nested: false,
        database: true,
      });
    });

    // 도크 모드 백드롭은 pointer-events: none 이라 데이터베이스를 켠 채로 툴바의
    // 리소스 관리자를 열 수 있다. 그때도 Escape 는 위층 창 몫이다.
    it("리소스 관리자를 데이터베이스 위에 열어도 Escape 는 리소스 관리자만 닫는다", () => {
      openDatabaseModal("actors");
      openResourceModal();
      expect(exists("resource-modal")).toBe(true);

      dispatchEscape();

      expect({ nested: exists("resource-modal"), database: exists("database-modal") }).toEqual({
        nested: false,
        database: true,
      });
    });

    it("속성 최대 개수 다이얼로그도 같은 계층 규칙을 따른다", () => {
      openDatabaseModal("elements");
      clickTestId("db-elements-maximum-number");
      expect(exists("db-elements-max-dialog")).toBe(true);

      dispatchEscape();

      expect({ nested: exists("db-elements-max-dialog"), database: exists("database-modal") }).toEqual({
        nested: false,
        database: true,
      });
    });
  });
});
