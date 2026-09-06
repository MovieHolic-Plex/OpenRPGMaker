// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { historyHotkeyOwnedByPanel, isTextEditingFocus, shouldIgnoreEditorShortcut } from "@/editor/hotkeys";

const navigationKeys = ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "PageDown", "PageUp", "Home", "End", " "];

function keyAt(target: HTMLElement, key: string, modifiers: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, code: key === " " ? "Space" : key, bubbles: true, cancelable: true, ...modifiers });
  target.dispatchEvent(event);
  return event;
}

describe("conversation navigation ownership", () => {
  let conversation: HTMLDivElement;
  beforeEach(() => {
    conversation = document.createElement("div");
    conversation.tabIndex = 0;
    conversation.dataset.editorNavigationOwner = "true";
    document.body.append(conversation);
  });
  afterEach(() => document.body.replaceChildren());

  it.each(navigationKeys)("leaves native %s on the conversation region", (key) => {
    conversation.focus();
    const event = keyAt(conversation, key);
    expect(shouldIgnoreEditorShortcut(event)).toBe(true);
    expect(event.defaultPrevented).toBe(false);
  });

  it.each(["button", "a", "summary", "span"])("also yields navigation from a %s descendant", (tag) => {
    const wrapper = document.createElement("div");
    const child = document.createElement(tag);
    wrapper.append(child);
    conversation.append(wrapper);
    for (const key of navigationKeys) expect(shouldIgnoreEditorShortcut(keyAt(child, key))).toBe(true);
  });

  it("retains modified navigation, including fast arrows and document endpoints", () => {
    for (const modifiers of [{ shiftKey: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
      for (const key of navigationKeys) expect(shouldIgnoreEditorShortcut(keyAt(conversation, key, modifiers))).toBe(true);
    }
  });

  it("does not disable unrelated editor commands or take history ownership", () => {
    for (const key of ["1", "F6", "+", "Delete", "Escape", "s", "z", "y"]) {
      expect(shouldIgnoreEditorShortcut(keyAt(conversation, key))).toBe(false);
      expect(shouldIgnoreEditorShortcut(keyAt(conversation, key, { ctrlKey: true }))).toBe(false);
    }
    expect(historyHotkeyOwnedByPanel()).toBe(false);
    expect(isTextEditingFocus(keyAt(conversation, "z", { ctrlKey: true }))).toBe(false);
  });

  it("leaves canvas and unrelated regions navigable even while the conversation is mounted", () => {
    const canvas = document.createElement("canvas");
    const region = document.createElement("div");
    region.setAttribute("role", "region");
    document.body.append(canvas, region);
    for (const key of navigationKeys) {
      expect(shouldIgnoreEditorShortcut(keyAt(canvas, key))).toBe(false);
      expect(shouldIgnoreEditorShortcut(keyAt(region, key))).toBe(false);
    }
    conversation.dataset.editorNavigationOwner = "false";
    expect(shouldIgnoreEditorShortcut(keyAt(conversation, "ArrowDown"))).toBe(false);
  });

  it.each(["input", "textarea", "select"])("preserves %s shortcut and native text-history guards", (tag) => {
    const field = document.createElement(tag);
    conversation.append(field);
    for (const key of ["ArrowDown", "1", "s", "z", "y"]) {
      const event = keyAt(field, key, { ctrlKey: true });
      expect(shouldIgnoreEditorShortcut(event)).toBe(true);
      expect(isTextEditingFocus(event)).toBe(true);
    }
  });
});
