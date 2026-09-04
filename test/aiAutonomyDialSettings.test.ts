import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AUTONOMY_LEVELS, resolveAutonomy, type AutonomyLevel } from "@/ai/autonomyLevels";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

// 인증 상태 조회는 모킹하지 않는다 — test/aiChatPanelSettings.test.ts 와 같은 방식이다.
// 모달이 마운트되면 동반 서비스 조회가 실패하고 연결 요약이 오류 문구로 떨어지지만,
// 다이얼·추론·작업모드 경로에는 영향을 주지 않으므로 그대로 둔다.

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

describe("자율성 다이얼", () => {
  it("동작 섹션 맨 위에 4단계 옵션(한국어 라벨)을 렌더한다", async () => {
    const modal = await openModal();
    const dial = findByTestId(modal, "ai-config-autonomy");
    expect(dial).not.toBeNull();

    const options = dial?.querySelectorAll("option") ?? [];
    expect(options.map((option) => option.getAttribute("value"))).toEqual([
      "confirm",
      "balanced",
      "autonomous",
      "max",
    ]);
    expect(options.map((option) => option.textContent)).toEqual(
      AUTONOMY_LEVELS.map((level) => level.label),
    );

    const behavior = findByTestId(modal, "ai-settings-section-behavior");
    if (!behavior) throw new Error("behavior section missing");
    const body = behavior.querySelector(".ai-settings-section-body");
    expect(body?.children[0]?.contains(dial)).toBe(true);
  });

  it("다이얼을 돌리면 추론·작업모드 select 가 resolveAutonomy 값으로 동기화된다", async () => {
    const modal = await openModal();
    const dial = findByTestId(modal, "ai-config-autonomy");
    const reasoning = findByTestId(modal, "ai-config-reasoning");
    const agentMode = findByTestId(modal, "ai-config-agentmode");
    if (!dial || !reasoning || !agentMode) throw new Error("autonomy controls missing");

    const levels: readonly AutonomyLevel[] = ["confirm", "balanced", "autonomous", "max"];
    for (const level of levels) {
      dial.value = level;
      dial.dispatchEvent(new Event("change"));
      const resolved = resolveAutonomy(level);
      expect(reasoning.value, level).toBe(resolved.reasoningEffort);
      expect(agentMode.value, level).toBe(resolved.agentMode);
    }
  });

  it("collect() 출력·저장 blob 에 autonomyLevel 을 싣는다(기본 balanced)", async () => {
    const modal = await openModal();
    const dial = findByTestId(modal, "ai-config-autonomy");
    if (!dial) throw new Error("autonomy select missing");
    // 저장 blob 이 없을 때 기본값은 balanced.
    expect(dial.value).toBe("balanced");

    dial.value = "max";
    dial.dispatchEvent(new Event("change"));

    const stored = JSON.parse(storage.get(AI_CONFIG_STORAGE_KEY) ?? "{}");
    expect(stored.autonomyLevel).toBe("max");
    expect(stored.reasoningEffort).toBe(resolveAutonomy("max").reasoningEffort);
    expect(stored.agentMode).toBe(resolveAutonomy("max").agentMode);

    // 저장된 레벨은 재렌더 시 다이얼에 다시 그려진다.
    const reopened = await openModal();
    expect(findByTestId(reopened, "ai-config-autonomy")?.value).toBe("max");
  });

  it("기존 추론·작업모드 select 를 그대로 둔다", async () => {
    storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig() }));
    const modal = await openModal();
    expect(findByTestId(modal, "ai-config-reasoning")).not.toBeNull();
    expect(findByTestId(modal, "ai-config-agentmode")).not.toBeNull();
  });
});
