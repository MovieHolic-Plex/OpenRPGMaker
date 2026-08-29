import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { conversationScopeKey, saveConversation } from "@/ai/conversationStore";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

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
  store.replace(createBlankProject());
  restoreDom = installFakeDom();
  installFakeLocalStorage();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
});

function renderPanel(): FakeElement {
  return renderWithFakeDom(() => renderAiChatPanel());
}

function countUniqueByTestId(root: FakeElement, testId: string): number {
  const seen = new Set<FakeElement>();
  const walk = (node: FakeElement): void => {
    if (node.dataset.testid === testId) seen.add(node);
    for (const child of node.childNodes) {
      if (child instanceof FakeElement) walk(child);
    }
  };
  walk(root);
  return seen.size;
}

// 조수 스킬(슬래시 목록)이 제거된 뒤에도 지켜야 할 것: 입력값이 무엇이든 시작 화면·라이징
// 오버레이를 되붙이지 않고, 선행 "/" 는 팝오버 없는 일반 텍스트다.
describe("컴포저 입력과 시작 화면 배타", () => {
  it("부팅은 휘발 존에 로그를 마운트하고 시작 화면은 마운트하지 않는다", () => {
    // 구 단언은 `logSlot === "glass"` 와 「오버레이 없음」이었다. 유리 마운트는 유리 도크와
    // 함께 사라졌고(슬롯은 volatile · history 둘), 오버레이는 반대로 띠에 **상주**한다 —
    // 사이드 도크 전용이던 조건이 도크와 함께 없어졌다.
    const panel = renderPanel();
    expect(findByTestId(panel, "ai-command-bar")).toBeTruthy();
    expect(findByTestId(panel, "ai-chat-log")).toBeTruthy();
    expect(findByTestId(panel, "ai-quick-replies")).toBeTruthy();
    expect(panel.dataset.logSlot).toBe("volatile");
    expect(countUniqueByTestId(panel, "ai-start-screen")).toBe(0);
  });

  it("입력이 / 로 시작해도 팝오버·시작 화면이 없다", () => {
    // Break: a leading "/" opens a popover again instead of staying plain text.
    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input");
    if (!input) throw new Error("input missing");

    input.value = "/";
    input.dispatchEvent(new Event("input"));

    expect(findByTestId(panel, "ai-slash-list")).toBeNull();
    expect(findByTestId(panel, "ai-slash-host")).toBeNull();
    expect(input.value).toBe("/");
    expect(countUniqueByTestId(panel, "ai-start-screen")).toBe(0);
  });

  it("입력을 지워도 시작 화면과 오버레이를 붙이지 않는다", () => {
    // Break: clearing the input remounts startScreen or the rising overlay.
    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input");
    if (!input) throw new Error("input missing");
    input.value = "/";
    input.dispatchEvent(new Event("input"));

    input.value = "";
    input.dispatchEvent(new Event("input"));

    expect(countUniqueByTestId(panel, "ai-start-screen")).toBe(0);
  });

  it("대화 기록이 있어도 입력을 지우면 시작 화면을 붙이지 않는다", () => {
    // Break: ensureStartScreen remounts whenever the input clears, even with conversation entries.
    saveConversation({
      id: "conv_slash_exclusive",
      title: "마을",
      model: "m",
      savedAt: 100,
      projectContextKey: conversationScopeKey(store.getProjectIdentity(), store.getCurrent()),
      entries: [
        { kind: "user", text: "마을 만들어줘" },
        { kind: "assistant", text: "초안을 준비했습니다." },
      ],
    });
    const panel = renderPanel();
    const input = findByTestId(panel, "ai-input");
    if (!input) throw new Error("input missing");
    expect(countUniqueByTestId(panel, "ai-start-screen")).toBe(0);

    input.value = "/";
    input.dispatchEvent(new Event("input"));
    input.value = "";
    input.dispatchEvent(new Event("input"));

    expect(countUniqueByTestId(panel, "ai-start-screen")).toBe(0);
  });
});
