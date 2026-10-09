import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
  it("shows the shared empty composer surface", () => {
    // Break: the panel remounts the start-screen empty kit or a private expert board.
    const panel = renderWithFakeDom(() => renderAiChatPanel()) as FakeElement;
    expect(findByTestId(panel, "ai-start-screen")).toBeNull();
    expect(findByTestId(panel, "ai-start-visual-gallery")).toBeNull();
    expect(findByTestId(panel, "ai-empty-cta")).toBeNull();
    expect(findByTestId(panel, "ai-expert-board")).toBeNull();
    expect(findByTestId(panel, "ai-composer-chips")).toBeNull();
    expect(findByTestId(panel, "ai-input")).toBeTruthy();
    expect(findByTestId(panel, "ai-chat-log")).toBeTruthy();
    expect(findByTestId(panel, "ai-send")).toBeTruthy();
    expect(panel.dataset.uiDensity).toBe("shared");
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

  it("대기 화면 선택은 더보기와 컴포저 메뉴 어디에도 없다", () => {
    const panel = renderWithFakeDom(() => renderAiChatPanel()) as FakeElement;

    const menu = findByTestId(panel, "ai-more-menu");
    if (menu) menu.hidden = true;
    findByTestId(panel, "ai-more-menu-toggle")?.click();
    expect(menu?.hidden).toBe(false);
    expect(findByTestId(panel, "ai-temperature-quiet-gold")).toBeNull();
    expect(findByTestId(panel, "ai-command-temperature-quiet-gold")).toBeNull();
    expect(panel.dataset.temperature).toBeUndefined();
  });
});
