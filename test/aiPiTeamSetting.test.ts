// 설정 모달의 「Pi 팀 실행」 — 팀은 경로가 아니라 Pi 루프의 실행 모드다(executionRoute.ts 머리말).
//
// 여기서 고정하는 것 셋: 경로 셀렉트가 사라졌다, 팀 비트가 저장·복원된다, 컴포저 토글과 같은 값을 읽는다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadAiConfig } from "@/ai/llmClient";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

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
  it("경로 셀렉트 대신 팀 셀렉트가 있다", async () => {
    // Break: 경로 셀렉트가 남으면 «조수» 라는 두 번째 루프가 설정에 살아 있는 것처럼 보인다
    // (세션 deprecated — 컴포저도 같은 셀렉트를 걷어냈다).
    const modal = await openModal();
    expect(findByTestId(modal, "ai-config-route")).toBeNull();
    const team = findByTestId(modal, "ai-config-pi-team");
    expect(team?.querySelectorAll("option").map((option) => option.getAttribute("value"))).toEqual(["single", "team"]);
    expect(team?.value).toBe("single");
  });

  it("고른 팀 비트가 저장되고 다시 열어도 남는다", async () => {
    const modal = await openModal();
    const team = findByTestId(modal, "ai-config-pi-team");
    if (!team) throw new Error("ai-config-pi-team missing");
    team.value = "team";
    team.dispatchEvent(new Event("change"));

    expect(loadAiConfig().piTeam).toBe(true);
    const reopened = await openModal();
    expect(findByTestId(reopened, "ai-config-pi-team")?.value).toBe("team");
  });
});
