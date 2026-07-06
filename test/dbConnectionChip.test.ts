// DB 연동 칩 진입점 일관화(도그푸딩 결함 ⑫) 회귀 테스트.
// 어떤 상태에서든 칩 클릭 = DB 연결 설정 열기(기존: 자동저장 오류 상태에서 클릭이
// 재시도로 소비되어 설정 진입점이 사라졌다). 저장 재시도는 별도 버튼으로 분리.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderDbConnectionStatus } from "@/editor/panels/dbConnectionSettings";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";

let restoreDom: (() => void) | null = null;
let storage: Map<string, string>;

beforeEach(() => {
  restoreDom = installFakeDom();
  storage = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, String(value)),
      removeItem: (key: string) => void storage.delete(key),
      clear: () => storage.clear(),
    },
  });
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("DB 연동 상태 칩", () => {
  it("칩은 항상 버튼이고, 클릭하면 DB 연결 설정 모달이 열린다", () => {
    const chip = renderWithFakeDom(() =>
      renderDbConnectionStatus({ kind: "disabled", reason: "dev-showcase" }, () => undefined)
    );
    expect(chip.dataset.testid).toBe("db-connection-status");
    expect((chip as unknown as { tagName?: string }).tagName?.toLowerCase()).toBe("button");
    expect(chip.textContent).toContain("DB 연동");

    chip.click();
    const body = document.body as unknown as FakeElement;
    expect(findByTestId(body, "db-config-modal")).toBeTruthy();
  });
});
