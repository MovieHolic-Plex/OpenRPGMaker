import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { projectConversationContextKey, saveConversation } from "@/ai/conversationStore";
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

function expandPanel(panel: FakeElement): void {
  if (!panel.classList.contains("is-collapsed")) return;
  findByTestId(panel, "ai-collapsed-restore")?.click();
  expect(panel.classList.contains("is-collapsed")).toBe(false);
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

describe("슬래시와 시작 화면 배타", () => {
  it("float 부팅은 워크 로그·오버레이·시작 화면을 마운트하지 않는다", () => {
    // Break: float still mounts ai-rising-overlay / ai-start-screen under the panel.
    const panel = renderPanel();
    expandPanel(panel);
    expect(findByTestId(panel, "ai-command-bar")).toBeTruthy();
    expect(findByTestId(panel, "ai-rising-overlay")).toBeNull();
    expect(countUniqueByTestId(panel, "ai-start-screen")).toBe(0);
  });

  it("입력이 / 로 시작하면 슬래시 목록만 있고 시작 화면은 없다", () => {
    // Break: refreshSlash renders the slash list while startScreen is also mounted.
    const panel = renderPanel();
    expandPanel(panel);
    const input = findByTestId(panel, "ai-input");
    if (!input) throw new Error("input missing");

    input.value = "/";
    input.dispatchEvent(new Event("input"));

    expect(findByTestId(panel, "ai-slash-list")).toBeTruthy();
    expect(countUniqueByTestId(panel, "ai-start-screen")).toBe(0);
    expect(findByTestId(panel, "ai-rising-overlay")).toBeNull();
  });

  it("슬래시 토글도 시작 화면 없이 목록만 연다", () => {
    // Break: slash-toggle mounts start screen or the rising overlay.
    const panel = renderPanel();
    expandPanel(panel);
    const toggle = findByTestId(panel, "ai-skill-slash-toggle");
    if (!toggle) throw new Error("slash toggle missing");

    toggle.click();

    expect(findByTestId(panel, "ai-slash-list")).toBeTruthy();
    expect(countUniqueByTestId(panel, "ai-start-screen")).toBe(0);
    expect(findByTestId(panel, "ai-rising-overlay")).toBeNull();
  });

  it("빈 대화에서 슬래시를 닫아도 시작 화면과 오버레이를 붙이지 않는다", () => {
    // Break: refreshSlash remounts startScreen or the rising overlay when slash closes.
    const panel = renderPanel();
    expandPanel(panel);
    const input = findByTestId(panel, "ai-input");
    if (!input) throw new Error("input missing");
    input.value = "/";
    input.dispatchEvent(new Event("input"));
    expect(findByTestId(panel, "ai-slash-list")).toBeTruthy();

    input.value = "";
    input.dispatchEvent(new Event("input"));

    expect(findByTestId(panel, "ai-slash-list")).toBeNull();
    expect(countUniqueByTestId(panel, "ai-start-screen")).toBe(0);
    expect(findByTestId(panel, "ai-rising-overlay")).toBeNull();
  });

  it("대화 기록이 있어도 슬래시를 닫아도 시작 화면을 붙이지 않는다", () => {
    // Break: ensureStartScreen remounts whenever slash closes, even with conversation entries.
    saveConversation({
      id: "conv_slash_exclusive",
      title: "마을",
      model: "m",
      savedAt: 100,
      projectContextKey: projectConversationContextKey(store.getCurrent()),
      entries: [
        { kind: "user", text: "마을 만들어줘" },
        { kind: "assistant", text: "초안을 준비했습니다." },
      ],
    });
    const panel = renderPanel();
    expandPanel(panel);
    const input = findByTestId(panel, "ai-input");
    if (!input) throw new Error("input missing");
    expect(countUniqueByTestId(panel, "ai-start-screen")).toBe(0);

    input.value = "/";
    input.dispatchEvent(new Event("input"));
    input.value = "";
    input.dispatchEvent(new Event("input"));

    expect(countUniqueByTestId(panel, "ai-start-screen")).toBe(0);
    expect(findByTestId(panel, "ai-rising-overlay")).toBeNull();
  });
});
