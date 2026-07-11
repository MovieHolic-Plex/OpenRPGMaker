import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chromeForMode, setEditorUiMode } from "@/editor/editorUiMode";
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
  editorState.set({ chatDock: "side" });
  restoreDom = installFakeDom();
  installFakeLocalStorage();
  document.body.className = "";
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("AI shared surface (basic/expert)", () => {
  it("does not expose expert-only AI density in either chrome mode", () => {
    expect(chromeForMode("basic").aiDenseSections).toBe(false);
    expect(chromeForMode("expert").aiDenseSections).toBe(false);
  });

  it("shows the same start discovery cards in basic and expert body classes", () => {
    document.body.classList.add("editor-ui-basic");
    const basicPanel = renderWithFakeDom(() => renderAiChatPanel()) as FakeElement;
    expect(findByTestId(basicPanel, "ai-start-try-region")).toBeTruthy();
    expect(findByTestId(basicPanel, "ai-expert-board")).toBeNull();
    expect(basicPanel.dataset.uiDensity).toBe("shared");

    document.body.classList.remove("editor-ui-basic");
    document.body.classList.add("editor-ui-expert");
    setEditorUiMode("expert");
    const expertPanel = renderWithFakeDom(() => renderAiChatPanel()) as FakeElement;
    expect(findByTestId(expertPanel, "ai-start-try-region")).toBeTruthy();
    expect(findByTestId(expertPanel, "ai-expert-board")).toBeNull();
    expect(expertPanel.dataset.uiDensity).toBe("shared");
  });

  it("labels dock mode as 사이드/플로팅 and updates menu copy", () => {
    const panel = renderWithFakeDom(() => renderAiChatPanel()) as FakeElement;
    const modeBtn = findByTestId(panel, "ai-dock-mode-btn");
    const headerBtn = findByTestId(panel, "ai-dock-mode-btn-header");
    expect(modeBtn?.textContent).toBe("사이드");
    expect(headerBtn?.textContent).toBe("사이드");
    expect(modeBtn?.dataset.dockMode).toBe("side");

    findByTestId(panel, "ai-more-menu-toggle")?.click();
    const moreDock = findByTestId(panel, "ai-more-dock");
    expect(moreDock?.textContent).toContain("플로팅");
  });
});
