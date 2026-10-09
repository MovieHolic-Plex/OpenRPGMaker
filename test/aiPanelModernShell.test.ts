// 조수 패널 모던 셸 계약: 대화 상태는 유지하고 빈 입력창에 추천을 띄우지 않는다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderAiChatPanel, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import { editorState } from "@/editor/editorState";
import { saveConversation, conversationScopeKey } from "@/ai/conversationStore";
import { store } from "@/project/store";
import { createBlankProject } from "@/project/defaults";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

let restoreDom: (() => void) | null = null;
let storage: Map<string, string>;

function installFakeLocalStorage(): void {
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
}

function renderPanel(): FakeElement {
  return renderAiChatPanel({ clock: () => 37_000 }) as unknown as FakeElement;
}

beforeEach(() => {
  vi.stubEnv("VITE_LLM_API_URL", "");
  vi.stubEnv("VITE_LLM_API_KEY", "");
  store.replace(createBlankProject());
  editorState.set({ currentMapId: null, selection: null });
  restoreDom = installFakeDom();
  installFakeLocalStorage();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("조수 패널 모던 셸", () => {
  it("대화가 비어 있으면 패널이 empty 대화 상태를 노출한다", () => {
    const panel = renderPanel();

    // CSS 가 빈 로그 껍데기(.ai-glass-log/.ai-history-log-mount)를 접고 시작 블록을
    // 가운데로 올리는 유일한 훅이다. 클래스 목록이 아니라 상태 속성으로 읽는다.
    expect(panel.dataset.aiConversation).toBe("empty");
  });

  it("빈 입력창에 포커스해도 추천 없이 입력·로그·액션을 유지한다", () => {
    // Break: focusing the empty composer revives director chips or preset examples.
    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input");
    if (!input) throw new Error("input missing");
    input.dispatchEvent(new Event("focus"));
    const popover = findByTestId(panel, "ai-suggest-popover");

    expect(findByTestId(panel, "ai-authoring-examples")).toBeNull();
    expect(findByTestId(panel, "ai-composer-chips")).toBeNull();
    expect(popover?.hidden).toBe(true);
    expect(popover?.querySelectorAll("button")).toHaveLength(0);
    expect(findByTestId(panel, "ai-chat-log")).toBeTruthy();
    expect(findByTestId(panel, "ai-composer-actions")).toBeTruthy();
    expect(findByTestId(panel, "ai-send")).toBeTruthy();
    expect(input.value).toBe("");
  });

  it("복원된 대화가 있으면 active 다 — 턴 행 testid 가 없다고 로그를 수집하면 안 된다", async () => {
    await saveConversation({
      id: "conv_shell",
      title: "마을",
      model: "m",
      savedAt: 100,
      projectContextKey: conversationScopeKey(store.getProjectIdentity(), store.getCurrent()),
      entries: [
        { kind: "user", text: "마을 만들어줘" },
        { kind: "assistant", text: "초안을 준버했습니다." },
      ],
    });

    const panel = renderPanel();
    await whenAiChatPanelSettled();

    expect(panel.dataset.aiConversation).toBe("active");
  });
});
