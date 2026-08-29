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
  // 「defaults chatDock preference to glass」는 `DEFAULT_CHAT_DOCK` 과 함께 사라졌다 —
  // 배치가 하나뿐이면 기본값도 없다(스펙 §1).

  it("keeps routine AI settings out of the assistant panel chrome", () => {
    // Break: a header or command-bar settings button is duplicated inside the assistant panel.
    const panel = renderWithFakeDom(() => renderAiChatPanel()) as FakeElement;
    const barSettings = findByTestId(panel, "ai-settings-command-bar");
    const headerSettings = findByTestId(panel, "ai-settings-toggle");
    const newChat = findByTestId(panel, "ai-new-session");
    // 헤더 ☰(`ai-more-menu-toggle`)는 숨은 툴바 안에 살아 열 방법이 없었다 — 남은 ☰ 는
    // 컴포저 액션 행의 것 하나뿐이다.
    const more = findByTestId(panel, "ai-command-menu-toggle");
    expect(barSettings).toBeNull();
    expect(headerSettings).toBeNull();
    expect(findByTestId(panel, "ai-more-menu-toggle")).toBeNull();
    expect(newChat?.getAttribute("aria-label")).toContain("새 대화");
    expect(more?.textContent).toContain("☰");
    // 내보내기는 그 ☰ 안에 남는다. 도크 항목은 전환할 대상이 없어져 사라졌다.
    more?.click();
    expect(findByTestId(panel, "ai-command-menu-export")).not.toBeNull();
    expect(findByTestId(panel, "ai-more-dock")).toBeNull();
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
