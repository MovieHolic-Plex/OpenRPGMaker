import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderAiChatPanel } from "@/editor/panels/aiChatPanel";
import { openAiSettingsModal } from "@/editor/panels/aiSettingsModal";
import {
  FREQUENT_TOOL_NAMES,
  frequentTools,
  openToolBrowserModal,
  shouldShowFrequentFirst,
} from "@/editor/panels/toolBrowserModal";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";

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
  editorState.set({ currentMapId: null, selection: null });
  restoreDom = installFakeDom();
  installFakeLocalStorage();
});

afterEach(() => {
  try {
    if (typeof document !== "undefined") {
      document.querySelector("[data-testid='ai-settings-modal']")?.remove();
      document.querySelector("[data-testid='tool-browser-modal']")?.remove();
    }
  } catch {
    // fakeDom already torn down
  }
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("AI assistant UX P0–P2", () => {
  // 삭제: "defaults chatDock preference to glass" — 도크 축(glass/side/float)이 2026-08-31 에
  // 사라졌다. 고를 도크가 하나(입력줄 캡슐)뿐이라 기본값이라는 개념 자체가 없다.
  it("keeps routine AI settings out of the assistant panel chrome", () => {
    // Break: a header or command-bar settings button is duplicated inside the assistant panel.
    const panel = renderWithFakeDom(() => renderAiChatPanel()) as FakeElement;
    const barSettings = findByTestId(panel, "ai-settings-command-bar");
    const headerSettings = findByTestId(panel, "ai-settings-toggle");
    const newChat = findByTestId(panel, "ai-new-session");
    const more = findByTestId(panel, "ai-more-menu-toggle");
    expect(barSettings).toBeNull();
    expect(headerSettings).toBeNull();
    expect(newChat?.getAttribute("aria-label")).toContain("새 대화");
    expect(more?.tagName.toLowerCase()).toBe("button");
    expect(more?.getAttribute("aria-label")?.trim()).toBeTruthy();
    expect(more?.getAttribute("aria-haspopup")).toBe("menu");
    expect(more?.getAttribute("aria-expanded")).toBe("false");
    const icon = more?.querySelector("svg");
    expect(icon?.getAttribute("data-icon")).toBe("more");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    // FakeElement does not reflect the hidden attribute into the native property.
    const moreMenu = findByTestId(panel, "ai-more-menu");
    expect(moreMenu?.getAttribute("hidden")).not.toBeNull();
    moreMenu!.hidden = true;
    // Export and settings remain in the existing disclosure, not duplicate chrome buttons.
    more?.click();
    expect(more?.getAttribute("aria-expanded")).toBe("true");
    expect(moreMenu!.hidden).toBe(false);
    const fold = findByTestId(moreMenu!, "ai-more-actions");
    expect(fold).not.toBeNull();
    expect(findByTestId(fold!, "ai-more-export")).not.toBeNull();
    expect(findByTestId(fold!, "ai-more-dock")).toBeNull();
    const settings = findByTestId(fold!, "ai-more-settings");
    expect(settings?.getAttribute("aria-label")?.trim()).toBeTruthy();
    settings?.click();
    expect(findByTestId(document.body as unknown as FakeElement, "ai-settings-modal")).not.toBeNull();
  });

  it("opens a dedicated settings modal with config fields", () => {
    const panel = renderWithFakeDom(() => renderAiChatPanel()) as FakeElement;
    openAiSettingsModal();
    const modal = findByTestId(document.body as unknown as FakeElement, "ai-settings-modal");
    expect(modal).not.toBeNull();
    expect(findByTestId(modal!, "ai-config-model")).not.toBeNull();
    // 브라우저 보관 키·엔드포인트 입력은 제거됐다(자격은 동반 서비스가 보관한다).
    expect(findByTestId(modal!, "ai-config-baseurl")).toBeNull();
    expect(findByTestId(modal!, "ai-config-apikey")).toBeNull();
    // 채팅 본문에 인라인 설정 폼이 기본 렌더되지 않음
    expect(findByTestId(panel, "ai-config")).toBeNull();
  });

  it("tool browser first view is frequent subset plus search gate", () => {
    expect(shouldShowFrequentFirst("", false)).toBe(true);
    expect(shouldShowFrequentFirst("npc", false)).toBe(false);
    expect(shouldShowFrequentFirst("", true)).toBe(false);
    expect(frequentTools().length).toBeGreaterThan(0);
    expect(frequentTools().length).toBeLessThanOrEqual(FREQUENT_TOOL_NAMES.length);

    const modal = openToolBrowserModal() as unknown as FakeElement;
    expect(findByTestId(modal, "tool-browser-search")).not.toBeNull();
    expect(findByTestId(modal, "tool-browser-frequent")).not.toBeNull();
    expect(findByTestId(modal, "tool-browser-show-all")).not.toBeNull();
  });
});
