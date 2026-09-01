import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { openDatabaseModal } from "@/editor/panels/databaseModal";
import { openResourceModal } from "@/editor/panels/resourceModal";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installFakeDom } from "./fakeDom";

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
