// DB 연동 칩 진입점 일관화(도그푸딩 결함 ⑫) 회귀 테스트.
// 어떤 상태에서든 칩 클릭 = DB 연결 설정 열기(기존: 자동저장 오류 상태에서 클릭이
// 재시도로 소비되어 설정 진입점이 사라졌다). 저장 재시도는 별도 버튼으로 분리.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDbConnectionSettings, renderDbConnectionStatus } from "@/editor/panels/dbConnectionSettings";
import { store } from "@/project/store";
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
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("온라인 저장 상태 칩", () => {
  it("칩은 항상 버튼이고, 클릭하면 작업 선택 모달이 열린다", () => {
    // Given: 원격 저장을 사용할 수 없는 편집기 상태.
    const chip = renderWithFakeDom(() =>
      renderDbConnectionStatus({ kind: "disabled", reason: "dev-showcase" }, () => undefined)
    );

    // When: 사용자가 상태 칩을 확인하고 연다.
    expect(chip.dataset.testid).toBe("db-connection-status");
    expect((chip as unknown as { tagName?: string }).tagName?.toLowerCase()).toBe("button");
    chip.click();

    // Then: 기술 용어 대신 온라인 저장으로 안내하고 설정 화면을 연다.
    expect(chip.textContent).toContain("온라인 저장");
    const body = document.body as unknown as FakeElement;
    expect(findByTestId(body, "db-config-modal")).toBeTruthy();
  });

  it("첫 진입에서는 작업 선택과 새 작업만 보여주고 연결 자격 증명 입력은 만들지 않는다", () => {
    // Given: 프로젝트를 열기 위해 반드시 온보딩을 거쳐야 하는 상태.
    const body = document.body as unknown as FakeElement;

    // When: 필수 작업 선택 화면을 연다.
    openDbConnectionSettings(() => undefined, { required: true });

    // Then: 작업 선택과 새 작업만 있고 URL·키·project ID 입력은 DOM에도 만들지 않는다.
    const title = findByTestId(body, "db-config-title");
    expect(title).toBeTruthy();
    expect(title?.textContent ?? "").toContain("작업");
    expect(findByTestId(body, "db-config-project-picker")).toBeTruthy();
    expect(findByTestId(body, "db-config-create-project")).toBeTruthy();
    expect(findByTestId(body, "db-config-advanced")).toBeNull();
    expect(findByTestId(body, "db-config-url")).toBeNull();
    expect(findByTestId(body, "db-config-anon-key")).toBeNull();
    expect(findByTestId(body, "db-config-project-id")).toBeNull();
  });

  it("새 작업은 원격 저장까지 성공해야 열린 것으로 처리한다", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://deployment.example");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "deployment-key");
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "deployment-default");
    const create = vi.spyOn(store, "loadNewRemoteProject").mockResolvedValue({ projectId: "new-project" });
    const flush = vi.spyOn(store, "flush").mockResolvedValue({ kind: "not-configured" });
    const body = document.body as unknown as FakeElement;

    openDbConnectionSettings(() => undefined, { autoLoadProjects: false, required: true });
    findByTestId(body, "db-config-create-project")?.click();

    await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(flush).toHaveBeenCalledTimes(1));
    expect(findByTestId(body, "db-config-modal")).toBeTruthy();
    expect(findByTestId(body, "db-config-status-line")?.textContent ?? "").toContain("저장하지 못했습니다");
  });

  it("온라인 저장이 준비되지 않아도 서버 주소나 접속 키를 사용자에게 요구하지 않는다", () => {
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
