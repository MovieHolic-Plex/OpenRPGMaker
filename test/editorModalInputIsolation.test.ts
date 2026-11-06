/** @vitest-environment happy-dom */
// 도구 목록·AI 내부 로그·마을 정보 창은 .database-modal-backdrop 을 써서 편집기 단축키 가드에 안 걸렸고,
// 자기 document 리스너로만 Esc 를 받아 같은 Esc 가 뒤의 맵까지 내려갔다(에디터 적대적 리뷰 F52·F53).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { shouldIgnoreEditorShortcut, historyHotkeyOwnedByPanel } from "@/editor/hotkeys";
import { openHarnessModal } from "@/editor/panels/aiHarnessModal";
import { openToolBrowserModal } from "@/editor/panels/toolBrowserModal";
import { hasOpenModalLayer, resetModalStackForTest } from "@/editor/ui/modalStack";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

function keyOnBody(key: string): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  Object.defineProperty(event, "target", { value: document.body });
  return event;
}

beforeEach(() => {
  resetModalStackForTest();
  store.replace(createBlankProject());
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
  resetModalStackForTest();
});

describe("도구 목록·AI 내부 로그 창은 편집기 입력을 막는다", () => {
  const openers: readonly [string, () => HTMLElement][] = [
    ["tool-browser-modal", () => openToolBrowserModal()],
    ["ai-harness-modal", () => openHarnessModal({ audit: [], statusTimeline: [], getSnapshot: () => null })],
  ];

  for (const [testid, open] of openers) {
    it(`${testid}: 열려 있으면 도구 키·Delete·Ctrl+Z 가 맵으로 가지 않는다`, () => {
      expect(shouldIgnoreEditorShortcut(keyOnBody("Delete"))).toBe(false);
      expect(historyHotkeyOwnedByPanel()).toBe(false);
      open();
      expect(shouldIgnoreEditorShortcut(keyOnBody("Delete"))).toBe(true);
      expect(shouldIgnoreEditorShortcut(keyOnBody("1"))).toBe(true);
      expect(historyHotkeyOwnedByPanel()).toBe(true);
    });

    it(`${testid}: Esc 한 번은 창만 닫고 맵까지 내려가지 않는다`, () => {
      open();
      let reachedBehind = false;
      const behind = (event: KeyboardEvent): void => { if (event.key === "Escape") reachedBehind = true; };
      window.addEventListener("keydown", behind);
      try {
        document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      } finally {
        window.removeEventListener("keydown", behind);
      }
      expect(document.querySelector(`[data-testid='${testid}']`)).toBeNull();
      expect(reachedBehind).toBe(false);
      expect(hasOpenModalLayer()).toBe(false);
      expect(shouldIgnoreEditorShortcut(keyOnBody("Delete"))).toBe(false);
    });
  }
});
