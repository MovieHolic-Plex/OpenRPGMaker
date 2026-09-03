// 패널 배선: 컴포저 모드 칩이 세션 sendUserMessage 옵션(composerMode)으로 실린다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { clearConversations } from "@/ai/conversationStore";
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

beforeEach(() => {
  vi.stubEnv("VITE_LLM_API_URL", "");
  vi.stubEnv("VITE_LLM_API_KEY", "");
  store.replace(createBlankProject());
  editorState.set({ currentMapId: null, selection: null });
  restoreDom = installFakeDom();
  installFakeLocalStorage();
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

describe("컴포저 모드 → 세션 옵션", () => {
  it.each([
    ["ask", "ai-composer-mode-ask"],
    ["plan", "ai-composer-mode-plan"],
  ] as const)("%s 칩을 고르고 전송하면 sendUserMessage 옵션에 composerMode 가 실린다", async (mode, testid) => {
    // Break: 옵션에 모드가 없으면 세션은 모드를 모른다 — 예전엔 [컨텍스트] 꼬리 한 줄이 전부였다.
    const spy = vi
      .spyOn(AssistantSession.prototype, "sendUserMessage")
      .mockResolvedValue({ assistantText: "", proposedCalls: [], stoppedReason: "final" });
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;

    (findByTestId(panel, testid) as unknown as FakeElement | null)?.click();
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "이 맵 크기가 얼마야?";
    findByTestId(panel, "ai-send")?.click();

    await vi.waitFor(() => expect(spy).toHaveBeenCalled(), { timeout: 2_000, interval: 5 });
    const options = spy.mock.calls[0]?.[3];
    expect(options?.composerMode).toBe(mode);
  });

  it("기본(지시) 모드는 composerMode:\"do\" 로 실린다", async () => {
    const spy = vi
      .spyOn(AssistantSession.prototype, "sendUserMessage")
      .mockResolvedValue({ assistantText: "", proposedCalls: [], stoppedReason: "final" });
    const panel = renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;

    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "타이틀 바꿔줘";
    findByTestId(panel, "ai-send")?.click();

    await vi.waitFor(() => expect(spy).toHaveBeenCalled(), { timeout: 2_000, interval: 5 });
    expect(spy.mock.calls[0]?.[3]?.composerMode).toBe("do");
  });
  it("계획 모드는 agentMode 가 chat 이어도 work_plan 이벤트로 계획 체크리스트를 그린다", async () => {
    // Break: 체크리스트가 자율 런(agentMode auto)에서만 열리면 계획 모드의 계획 카드가 아예 안 보인다(e2e 실측).
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

    (findByTestId(panel, "ai-composer-mode-plan") as unknown as FakeElement | null)?.click();
    const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
    input.value = "타이틀을 두 단계로";
    findByTestId(panel, "ai-send")?.click();

    await vi.waitFor(() => expect(findByTestId(panel, "ai-work-plan-checklist")).toBeTruthy(), { timeout: 2_000, interval: 5 });
    expect(findByTestId(panel, "ai-autonomous-budget")).toBeNull();
  });
});
