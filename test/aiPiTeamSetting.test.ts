// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTONOMY_LEVELS, resolveAutonomy, type AutonomyLevel } from "@/ai/autonomyLevels";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig, loadAiConfig } from "@/ai/llmClient";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";
import { isolateTimers } from "./mergedTeardown";

vi.mock("@/editor/panels/aiRoleMatrixSettings", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/editor/panels/aiRoleMatrixSettings")>()), fetchConnectedRoutes: () => new Promise<never>(() => undefined), }));
vi.mock("@/editor/panels/aiToolUsagePanel", () => ({ renderAiToolUsagePanel: () => document.createElement("div"), }));

describe("aiAutonomyDialSettings", () => {
  isolateTimers();
  // 인증 상태 조회는 모킹하지 않는다 — test/aiChatPanelSettings.test.ts 와 같은 방식이다.
  // 모달이 마운트되면 동반 서비스 조회가 실패하고 연결 요약이 오류 문구로 떨어지지만,
  // 다이얼·추론·작업모드 경로에는 영향을 주지 않으므로 그대로 둔다.

  let restoreDom: (() => void) | null = null;
  let storage: Map<string, string>;
  // 설정 모달의 import 그래프는 크다(CI 4코어 러너에서 첫 import 만 ~19초). 그 한 번의 비용이 첫 테스트의 15초 제한에 얹히지 않도록
  // 훅(hookTimeout 90초)에서 미리 불러 둔다 — test/aiSettingsModalLayout.test.ts 와 같은 방식이다.
  beforeAll(async () => { await import("@/editor/panels/aiSettingsModal"); });
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
    findByTestId(modal, "ai-settings-tab-work")?.click();
    return modal;
  }
  describe("자율성 다이얼", () => {
    it("고급 작업 방식 맨 위에 전체 레벨 옵션(한국어 라벨)을 렌더한다", async () => {
      const modal = await openModal();
      const dial = findByTestId(modal, "ai-config-autonomy");
      expect(dial).not.toBeNull();

      const options = dial?.querySelectorAll("option") ?? [];
      // Break: 읽기 전용이 빠지면 설정 모달에서 ask 레일을 고를 수단이 사라진다
      // (지시줄 「질문」 칩이 없어진 뒤 이 다이얼이 유일한 트리거다).
      expect(options.map((option) => option.getAttribute("value"))).toEqual([
        "readonly",
        "confirm",
        "balanced",
        "autonomous",
        "max",
      ]);
      expect(options.map((option) => option.textContent)).toEqual(
        AUTONOMY_LEVELS.map((level) => level.label),
      );

      const behavior = findByTestId(modal, "ai-settings-section-work");
      if (!behavior) throw new Error("advanced work section missing");
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
      // 다이얼 핸들러는 프로그래밍 대입 뒤 커스텀 셀렉트 라벨 동기화용 input 을 쏜다
      // (customSelect.ts: input → 라벨 동기화. change 를 쏘면 persist 가 한 번 더 돈다).
      const fired: Record<string, string[]> = { reasoning: [], agentMode: [] };
      const wrapDispatch = (select: FakeElement, bucket: string): void => {
        const native = select.dispatchEvent.bind(select);
        select.dispatchEvent = ((event: Event): boolean => {
          fired[bucket]?.push(event.type);
          return native(event);
        }) as typeof select.dispatchEvent;
      };
      wrapDispatch(reasoning as unknown as FakeElement, "reasoning");
      wrapDispatch(agentMode as unknown as FakeElement, "agentMode");
      for (const level of levels) {
        fired.reasoning = [];
        fired.agentMode = [];
        dial.value = level;
        dial.dispatchEvent(new Event("change"));
        const resolved = resolveAutonomy(level);
        expect(reasoning.value, level).toBe(resolved.reasoningEffort);
        expect(agentMode.value, level).toBe(resolved.agentMode);
        expect(fired.reasoning, `input fired reasoning ${level}`).toContain("input");
        expect(fired.agentMode, `input fired agentMode ${level}`).toContain("input");
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
});

describe("aiPiTeamSetting", () => {
  isolateTimers();
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
    it("고급 작업 방식에서 기존 팀 비트만 전환한다", async () => {
      storage.set("oprn:ai-config", JSON.stringify({ piTeam: true }));
      const modal = await openModal();
      expect(findByTestId(modal, "ai-config-route")).toBeNull();
      expect(findByTestId(findByTestId(modal, "ai-settings-pane-account")!, "ai-config-pi-team")).toBeNull();
      findByTestId(modal, "ai-settings-tab-work")?.click();
      const team = findByTestId(findByTestId(modal, "ai-settings-pane-work")!, "ai-config-pi-team");
      expect(team?.getAttribute("role")).toBe("switch");
      expect(team?.getAttribute("aria-checked")).toBe("true");
      team?.click();
      expect(loadAiConfig().piTeam).toBe(false);
    });

    it("기존 팀 비트는 실행 호환성을 위해 읽을 수 있다", () => {
      storage.set("oprn:ai-config", JSON.stringify({ piTeam: true }));
      expect(loadAiConfig().piTeam).toBe(true);
    });
  });
});
