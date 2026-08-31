import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setEditorUiMode } from "@/editor/editorUiMode";
import { DEFAULT_ASSISTANT_TEMPERATURE } from "@/editor/assistantTemperature";
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
  // 도크 축이 사라져 초기화할 것은 대기 화면(온도) 하나다.
  editorState.set({ assistantTemperature: DEFAULT_ASSISTANT_TEMPERATURE });
  restoreDom = installFakeDom();
  installFakeLocalStorage();
  document.body.className = "";
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
});

// 도크 축 삭제(float 단일) — "다음에 갈 도크" 라벨 계산과 「떼기」의 도크 이동 단언은
// 대상이 없어져 고정 라벨·무동작 계약으로 뒤집었다.
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

  it("도크 전환 진입점은 하나도 남지 않고, 붙은 곳은 dataset 으로만 읽는다", () => {
    // Break: 「입력줄」이라고만 적힌 채 눌러도 아무 일이 없는 도크 노드가 되살아났다.
    // 그런 노드는 없는 선택지를 광고하므로 «있으면» 회귀다.
    const panel = renderWithFakeDom(() => renderAiChatPanel()) as FakeElement;

    for (const dead of [
      "ai-dock-mode-btn",
      "ai-dock-mode-btn-header",
      "ai-chat-detach",
      "chat-dock-toggle",
    ]) {
      expect(findByTestId(panel, dead), dead).toBeNull();
    }

    // ☰ 두 표면 모두에서 「도크 전환」 항목이 빠졌다.
    findByTestId(panel, "ai-more-menu-toggle")?.click();
    expect(findByTestId(panel, "ai-more-dock")).toBeNull();
    findByTestId(panel, "ai-command-menu-toggle")?.click();
    expect(findByTestId(panel, "ai-command-menu-dock")).toBeNull();

    // 배치를 읽는 창구는 dataset 하나다 — 레이아웃 테스트가 여기만 본다.
    expect(panel.dataset.chatDock).toBe("float");
  });

  it("대기 화면 선택은 두 조수 메뉴 모두에서 닿는다", () => {
    editorState.set({ assistantTemperature: "quiet-gold" });
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
  });
});
