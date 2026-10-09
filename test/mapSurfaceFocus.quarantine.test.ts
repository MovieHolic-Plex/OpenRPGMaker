import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { historyHotkeyOwnedByPanel, isHistoryHotkeyChord } from "@/editor/hotkeys";
import { bindMapSurfaceFocusHandoff, releaseTextEntryFocus } from "@/editor/mapSurfaceFocus";
import { FakeElement, installFakeDom } from "./fakeDom";

// Phaser 캔버스는 포커스를 받지 않으므로, 어시스턴트 입력창/타일 검색창에 한 번 포커스가
// 들어가면 맵을 칠해도 activeElement 가 그대로 남아 Ctrl+Z 가 맵이 아니라 그 텍스트를 되돌린다.
// (실측 2026-08-27: 프롬프트 "마을에 길 하나" → Ctrl+Z 후 "마을에 길 하", 맵은 그대로)
let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

function activeTag(): string | null {
  const active = (globalThis.document as unknown as { activeElement: FakeElement | null }).activeElement;
  return active ? active.tagName : null;
}

function keyEvent(key: string, modifiers: { ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean } = {}): KeyboardEvent {
  return {
    key,
    ctrlKey: modifiers.ctrl ?? false,
    shiftKey: modifiers.shift ?? false,
    altKey: modifiers.alt ?? false,
    metaKey: modifiers.meta ?? false,
    target: null,
    preventDefault: () => {},
  } as unknown as KeyboardEvent;
}

describe("releaseTextEntryFocus", () => {
  it("hands keyboard focus back from a text field so map hotkeys reach the editor", () => {
    const textarea = new FakeElement("textarea");
    globalThis.document.body.append(textarea);
    textarea.focus();
    expect(activeTag()).toBe("TEXTAREA");

    expect(releaseTextEntryFocus()).toBe(true);
    expect(activeTag()).toBe(null);
  });

  it("leaves non-text controls focused (checkbox keeps focus, hotkeys already work there)", () => {
    const checkbox = new FakeElement("input");
    checkbox.setAttribute("type", "checkbox");
    globalThis.document.body.append(checkbox);
    checkbox.focus();

    expect(releaseTextEntryFocus()).toBe(false);
    expect(activeTag()).toBe("INPUT");
  });

  it("is a no-op when nothing holds focus", () => {
    expect(releaseTextEntryFocus()).toBe(false);
  });
});

describe("bindMapSurfaceFocusHandoff", () => {
  it("releases a parked text focus when the map surface receives a pointer press", () => {
    const host = new FakeElement("div");
    const input = new FakeElement("input");
    globalThis.document.body.append(host, input);
    bindMapSurfaceFocusHandoff(host as unknown as HTMLElement);
    input.focus();
    expect(activeTag()).toBe("INPUT");

    host.dispatchEvent(new Event("pointerdown"));

    expect(activeTag()).toBe(null);
  });
});

describe("isHistoryHotkeyChord", () => {
  it("matches undo/redo chords only", () => {
    expect(isHistoryHotkeyChord(keyEvent("z", { ctrl: true }))).toBe(true);
    expect(isHistoryHotkeyChord(keyEvent("Z", { ctrl: true, shift: true }))).toBe(true);
    expect(isHistoryHotkeyChord(keyEvent("y", { meta: true }))).toBe(true);
    expect(isHistoryHotkeyChord(keyEvent("z"))).toBe(false);
    expect(isHistoryHotkeyChord(keyEvent("z", { ctrl: true, alt: true }))).toBe(false);
    expect(isHistoryHotkeyChord(keyEvent("s", { ctrl: true }))).toBe(false);
  });
});

describe("historyHotkeyOwnedByPanel", () => {
  it("is false on the plain map-edit surface", () => {
    expect(historyHotkeyOwnedByPanel()).toBe(false);
  });

  it("is true while a panel with its own history listener is mounted", () => {
    for (const testid of ["database-modal", "event-editor-modal"]) {
      const modal = new FakeElement("div");
      modal.setAttribute("data-testid", testid);
      globalThis.document.body.append(modal);
      expect(historyHotkeyOwnedByPanel()).toBe(true);
      modal.remove();
    }
  });
});
