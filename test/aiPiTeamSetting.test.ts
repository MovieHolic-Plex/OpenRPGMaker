/** @vitest-environment happy-dom */
// 설정 모달의 「Pi 팀 실행」은 당분간 사용자 UI에서 숨긴다. 저장된 값과 실행 경로는 호환성을 위해 유지한다.
//
// 여기서 고정하는 것 둘: 팀 선택 컨트롤이 보이지 않고, 기존 설정의 팀 비트는 읽을 수 있다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadAiConfig } from "@/ai/llmClient";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

// 역할 배정 표는 모달을 열 때 연결된 경로를 비동기로 가져와 다시 그린다. 오프라인에서도 그 약속은 테스트가 끝난 뒤에
// 풀려 복원된 happy-dom document 로 옵션을 만들고 가짜 select 에 붙이다 미처리 오류를 낸다 — 이 파일은 경로 조회를 보지 않는다.
vi.mock("@/editor/panels/aiRoleMatrixSettings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/editor/panels/aiRoleMatrixSettings")>()),
  fetchConnectedRoutes: () => new Promise<never>(() => undefined),
}));

let restoreDom: (() => void) | null = null;
let storage: Map<string, string>;

beforeEach(() => {
  restoreDom = installFakeDom();
  resetModalStackForTest();
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

afterEach(async () => {
  const { closeAiSettingsModal } = await import("@/editor/panels/aiSettingsModal");
  closeAiSettingsModal();
  resetModalStackForTest();
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
});

async function openModal(): Promise<FakeElement> {
  const { openAiSettingsModal } = await import("@/editor/panels/aiSettingsModal");
  openAiSettingsModal();
  const modal = findByTestId(document.body as unknown as FakeElement, "ai-settings-modal");
  if (!modal) throw new Error("ai-settings-modal missing");
  return modal;
}

describe("Pi 팀 실행 설정", () => {
  it("팀 선택 컨트롤을 사용자 설정에서 숨긴다", async () => {
    const modal = await openModal();
    expect(findByTestId(modal, "ai-config-route")).toBeNull();
    expect(findByTestId(modal, "ai-config-pi-team")).toBeNull();
  });

  it("기존 팀 비트는 실행 호환성을 위해 읽을 수 있다", () => {
    storage.set("oprn:ai-config", JSON.stringify({ piTeam: true }));
    expect(loadAiConfig().piTeam).toBe(true);
  });
});
