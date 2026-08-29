import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setEditorUiMode } from "@/editor/editorUiMode";
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

  // 삭제한 두 테스트: 「labels the dock toggle by its next action」 와
  // 「keeps dock escape and idle-screen choices reachable from every assistant menu」.
  //
  // 둘이 재던 것 셋 다 조수 띠에서 없어졌다:
  //   ai-dock-mode-btn / ai-chat-detach   도크가 하나뿐이라 전환할 대상이 없다(스펙 §1).
  //   ai-more-menu(-toggle)               숨은 툴바 안에 살아 열 방법이 없던 두 번째 ☰.
  //                                       ☰ 는 이제 컴포저 액션 행의 것 하나다.
  //   ai-temperature-*                    대기화면 3종과 함께 삭제된 색 온도 선택.
  //
  // 남은 ☰ 항목 도달성은 aiChatPanelUxRepairs.test.ts 가 `ai-command-menu-*` 로 잰다 —
  // 여기서 또 재면 같은 계약을 두 곳이 들게 된다.
});
