import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderDbConnectionStatus } from "@/editor/panels/dbConnectionStatus";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

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
      clear: () => void storage.clear(),
    },
  });
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("저장 상태 칩", () => {
  it("연결이 준비되지 않아도 서버 주소나 접속 키를 사용자에게 요구하지 않는다", () => {
    const chip = renderWithFakeDom(() => renderDbConnectionStatus({
      kind: "not-configured",
      missing: ["url", "anonKey"],
      projectId: "deployment-default",
      source: "env",
    }, () => undefined));

    expect(chip.textContent).toContain("준비 안 됨");
    expect(chip.getAttribute("title") ?? "").not.toMatch(/서버 주소|접속 키|Anon|URL/ui);
  });

  it("저장 오류 원문을 숨기고 다시 저장을 별도 버튼으로 제공한다", () => {
    vi.spyOn(store, "getAutoSaveState").mockReturnValue({ kind: "error", message: "provider 401 secret detail" });
    const surface = renderWithFakeDom(() =>
      renderDbConnectionStatus({ kind: "ready", projectId: "work", source: "env", url: "https://storage.example" }, () => undefined)
    );
    const status = findByTestId(surface, "db-connection-status");
    const retry = findByTestId(surface, "db-autosave-retry");

    expect(status?.getAttribute("title") ?? "").not.toContain("provider 401 secret detail");
    expect(retry?.getAttribute("title") ?? "").not.toContain("provider 401 secret detail");
    expect(status?.parentElement).toBe(retry?.parentElement);
  });
});
