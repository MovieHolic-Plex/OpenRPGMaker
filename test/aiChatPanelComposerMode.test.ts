// 패널 배선: 자율성 다이얼 하나가 세션 sendUserMessage 옵션(composerMode)을 유도한다.
// 예전의 모드 3칩(지시/질문/계획)은 없다 — 「질문」은 다이얼 readonly, 「계획」은 confirm(planOnly).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { clearConversations } from "@/ai/conversationStore";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { editorState } from "@/editor/editorState";
import { renderAiChatPanel, teardownAiChatPanel } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

let restoreDom: (() => void) | null = null;

function installFakeLocalStorage(): void {
  const storage = new Map<string, string>();
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
}

/** 다이얼을 고른다 — 패널이 저장·세션 반영까지 하는 실제 경로를 그대로 탄다. */
function selectAutonomy(panel: FakeElement, level: string): void {
  const dial = findByTestId(panel, "ai-composer-autonomy");
  if (!dial) throw new Error("ai-composer-autonomy missing");
  dial.value = level;
  dial.dispatchEvent(new Event("change"));
}

beforeEach(() => {
  vi.stubEnv("VITE_LLM_API_URL", "");
  vi.stubEnv("VITE_LLM_API_KEY", "");
  store.replace(createBlankProject());
  editorState.set({ currentMapId: null, selection: null });
  restoreDom = installFakeDom();
  installFakeLocalStorage();
  localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(defaultAiConfig()));
});

afterEach(async () => {
  teardownAiChatPanel();
  await clearConversations();
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("자율성 다이얼 → 세션 composerMode", () => {
  it("모드 3칩은 더 이상 존재하지 않는다", () => {
    // Break: 칩이 남아 있으면 같은 노브를 두 컨트롤이 만지고, 둘이 어긋날 때 어느 쪽이
    // 이기는지 사용자가 알 수 없다.
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    expect(findByTestId(panel, "ai-composer-mode")).toBeNull();
    for (const key of ["do", "ask", "plan"]) {
      expect(findByTestId(panel, `ai-composer-mode-${key}`)).toBeNull();
    }
  });

  it("추론 강도 셀렉트도 없다 — 자율성 레벨이 추론을 정한다", () => {
    // Break: 수동 추론 override 가 남아 있으면 다이얼이 저장한 프리셋 값과 갈라진다.
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
    expect(findByTestId(panel, "ai-composer-reasoning")).toBeNull();
  });

  it("읽기 전용 레벨은 composerMode:\"ask\" 로 실린다", async () => {
    // Break: 유도가 없으면 세션은 쓰기 툴을 노출한다 — 사용자가 읽기 전용을 골랐는데도
    // 프로젝트가 바뀔 수 있다. ask 레일(스키마 미노출·호출 거부·초안 불변)의 유일한 수동 트리거다.
    const spy = vi
      .spyOn(AssistantSession.prototype, "sendUserMessage")
      .mockResolvedValue({ assistantText: "", proposedCalls: [], stoppedReason: "final" });
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;

    selectAutonomy(panel, "readonly");
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "이 맵 크기가 얼마야?";
    findByTestId(panel, "ai-send")?.click();

    await vi.waitFor(() => expect(spy).toHaveBeenCalled(), { timeout: 2_000, interval: 5 });
    expect(spy.mock.calls[0]?.[3]?.composerMode).toBe("ask");
  });

  it.each(["confirm", "balanced", "autonomous", "max"] as const)(
    "쓰기 레벨 %s 은 composerMode:\"do\" 로 실린다",
    async (level) => {
      // Break: 쓰기 레벨이 ask 로 유도되면 조수가 아무것도 만들지 못한다.
      const spy = vi
        .spyOn(AssistantSession.prototype, "sendUserMessage")
        .mockResolvedValue({ assistantText: "", proposedCalls: [], stoppedReason: "final" });
      const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;

      selectAutonomy(panel, level);
      const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
      input.value = "타이틀 바꿔줘";
      findByTestId(panel, "ai-send")?.click();

      await vi.waitFor(() => expect(spy).toHaveBeenCalled(), { timeout: 2_000, interval: 5 });
      expect(spy.mock.calls[0]?.[3]?.composerMode).toBe("do");
    },
  );

  it("확인(planOnly) 레벨은 자율 예산 없이 계획 체크리스트를 그린다", async () => {
    // Break: 체크리스트가 자율 런(agentMode auto)에서만 열리면 확인 레벨의 계획 카드가
    // 아예 안 보인다(예전 계획 칩 e2e 실측).
    const plan = {
      goal: "타이틀 2단계",
      createdAt: new Date().toISOString(),
      currentItemId: "i1",
      layers: [{ id: "l1", title: "타이틀", items: [
        { id: "i1", title: "1차", instruction: "set_title_screen", status: "pending" },
        { id: "i2", title: "2차", instruction: "set_title_screen", status: "pending" },
      ] }],
    };
    vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockImplementation(async (_text, onEvent) => {
      onEvent?.({ type: "work_plan", plan } as unknown as SessionEvent);
      return { assistantText: "계획을 세워두었습니다.", proposedCalls: [], stoppedReason: "final" };
    });
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;

    selectAutonomy(panel, "confirm");
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "타이틀을 두 단계로";
    findByTestId(panel, "ai-send")?.click();

    await vi.waitFor(() => expect(findByTestId(panel, "ai-work-plan-checklist")).toBeTruthy(), { timeout: 2_000, interval: 5 });
    expect(findByTestId(panel, "ai-autonomous-budget")).toBeNull();
  });

  it("「계속」은 읽기 전용 설정을 해제하지 않는다", async () => {
    // Break: 예전 코드는 userResume 에서 composerMode 를 "do" 로 리셋했다. 모드가 턴 단위일
    // 때는 무해했지만 다이얼은 지속 설정이다 — 「계속」이 사용자의 읽기 전용을 몰래 풀면
    // 다음 턴부터 쓰기 툴이 붙는다.
    const spy = vi
      .spyOn(AssistantSession.prototype, "sendUserMessage")
      .mockResolvedValue({ assistantText: "", proposedCalls: [], stoppedReason: "final" });
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;

    selectAutonomy(panel, "readonly");
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "이 맵 뭐가 있어?";
    findByTestId(panel, "ai-send")?.click();
    await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(1), { timeout: 2_000, interval: 5 });

    input.value = "계속";
    findByTestId(panel, "ai-send")?.click();
    await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(2), { timeout: 2_000, interval: 5 });

    expect(spy.mock.calls[1]?.[3]?.composerMode).toBe("ask");
  });
});
