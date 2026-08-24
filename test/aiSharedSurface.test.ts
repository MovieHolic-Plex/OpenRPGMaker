import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setEditorUiMode } from "@/editor/editorUiMode";
import { editorState } from "@/editor/editorState";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

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

beforeEach(() => {
  store.replace(createBlankProject());
  editorState.set({ chatDock: "float" });
  restoreDom = installFakeDom();
  installFakeLocalStorage();
  document.body.className = "";
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("AI shared surface", () => {
  it("shows the same empty composer surface in beginner and expert body classes", () => {
    // Break: either mode remounts start-screen empty kit, or expert gets a private board.
    document.body.classList.add("editor-ui-beginner");
    const basicPanel = renderWithFakeDom(() => renderAiChatPanel()) as FakeElement;
    expect(findByTestId(basicPanel, "ai-start-screen")).toBeNull();
    expect(findByTestId(basicPanel, "ai-start-visual-gallery")).toBeNull();
    expect(findByTestId(basicPanel, "ai-empty-cta")).toBeNull();
    expect(findByTestId(basicPanel, "ai-expert-board")).toBeNull();
    expect(findByTestId(basicPanel, "ai-composer-chips")).toBeTruthy();
    expect(basicPanel.dataset.uiDensity).toBe("shared");

    document.body.classList.remove("editor-ui-beginner");
    document.body.classList.add("editor-ui-expert");
    setEditorUiMode("expert");
    const expertPanel = renderWithFakeDom(() => renderAiChatPanel()) as FakeElement;
    expect(findByTestId(expertPanel, "ai-start-screen")).toBeNull();
    expect(findByTestId(expertPanel, "ai-start-visual-gallery")).toBeNull();
    expect(findByTestId(expertPanel, "ai-empty-cta")).toBeNull();
    expect(findByTestId(expertPanel, "ai-expert-board")).toBeNull();
    expect(findByTestId(expertPanel, "ai-composer-chips")).toBeTruthy();
    expect(expertPanel.dataset.uiDensity).toBe("shared");
  });

  it("labels the dock toggle by its next action and updates menu copy", () => {
    const panel = renderWithFakeDom(() => renderAiChatPanel()) as FakeElement;
    const modeBtn = findByTestId(panel, "ai-dock-mode-btn");
    // 헤더 뱃지는 제거 — 커맨드 바 토글 + 더보기 메뉴만 유지.
    expect(findByTestId(panel, "ai-dock-mode-btn-header")).toBeNull();
    expect(modeBtn?.textContent).toBe("왼쪽 카드로 열기");
    expect(modeBtn?.dataset.dockMode).toBe("float");

    findByTestId(panel, "ai-more-menu-toggle")?.click();
    const moreDock = findByTestId(panel, "ai-more-dock");
    expect(moreDock?.textContent).toContain("왼쪽 카드로 열기");
  });

  it("keeps dock escape and idle-screen choices reachable from every assistant menu", () => {
    editorState.set({ chatDock: "side", assistantTemperature: "quiet-gold" });
    const panel = renderWithFakeDom(() => renderAiChatPanel()) as FakeElement;

    const menu = findByTestId(panel, "ai-more-menu");
    // FakeElement does not reflect the HTML hidden attribute onto .hidden automatically.
    if (menu) menu.hidden = true;
    findByTestId(panel, "ai-more-menu-toggle")?.click();
    expect(menu?.hidden).toBe(false);
    expect(menu?.classList.contains("is-viewport-anchored")).toBe(true);
    expect(findByTestId(panel, "ai-temperature-quiet-gold")).toBeTruthy();
    expect(findByTestId(panel, "ai-command-temperature-quiet-gold")).toBeTruthy();

    findByTestId(panel, "ai-temperature-ink-only")?.click();
    expect(editorState.get().assistantTemperature).toBe("ink-only");
    expect(panel.dataset.temperature).toBe("ink-only");

    findByTestId(panel, "ai-chat-detach")?.click();
    expect(editorState.get().chatDock).toBe("float");
  });
});
