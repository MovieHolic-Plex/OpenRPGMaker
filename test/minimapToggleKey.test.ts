// M toggles the field minimap from a document keydown, outside Phaser's keyboard plugin.
// That listener used to accept every "m", including repeats, IME composition, modifier
// chords, text fields, and surfaces that already hide the minimap. A press the player
// cannot see then left minimapUserHidden set, so the map stayed gone after dialogue closed.
import { afterEach, describe, expect, it } from "vitest";

import { acceptsMinimapToggle, minimapToggleKeyHandler, type MinimapToggleKeyEvent } from "@/player/minimap";
import { FakeElement, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | null = null;

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
});

function key(partial: Partial<MinimapToggleKeyEvent> & Pick<MinimapToggleKeyEvent, "key">): MinimapToggleKeyEvent {
  return { repeat: false, isComposing: false, ctrlKey: false, metaKey: false, altKey: false, ...partial };
}

function openField(): FakeElement {
  restoreDom = installFakeDom();
  return new FakeElement("div");
}

describe("minimap M key", () => {
  it("accepts a plain M on an open field and ignores repeats, IME, and modifier chords", () => {
    const host = openField();
    expect(acceptsMinimapToggle(key({ key: "m" }), host as unknown as HTMLElement)).toBe(true);
    expect(acceptsMinimapToggle(key({ key: "M" }), host as unknown as HTMLElement)).toBe(true);
    expect(acceptsMinimapToggle(key({ key: "m", repeat: true }), host as unknown as HTMLElement)).toBe(false);
    expect(acceptsMinimapToggle(key({ key: "m", isComposing: true }), host as unknown as HTMLElement)).toBe(false);
    expect(acceptsMinimapToggle(key({ key: "m", keyCode: 229 }), host as unknown as HTMLElement)).toBe(false);
    expect(acceptsMinimapToggle(key({ key: "m", ctrlKey: true }), host as unknown as HTMLElement)).toBe(false);
    expect(acceptsMinimapToggle(key({ key: "m", metaKey: true }), host as unknown as HTMLElement)).toBe(false);
    expect(acceptsMinimapToggle(key({ key: "m", altKey: true }), host as unknown as HTMLElement)).toBe(false);
    expect(acceptsMinimapToggle(key({ key: "n" }), host as unknown as HTMLElement)).toBe(false);
  });

  it("does not toggle while a text field has the key, or while dialogue already hides the minimap", () => {
    const host = openField();
    const input = new FakeElement("input");
    const dialogue = new FakeElement("div");
    dialogue.dataset.testid = "dialogue-box";
    host.append(dialogue);
    expect(acceptsMinimapToggle(key({ key: "m", target: input }), new FakeElement("div") as unknown as HTMLElement)).toBe(false);
    expect(acceptsMinimapToggle(key({ key: "m" }), host as unknown as HTMLElement)).toBe(false);
  });

  it("the document handler skips the opening handoff and only toggles when the key is accepted", () => {
    const host = openField();
    let toggles = 0;
    const onKey = minimapToggleKeyHandler({
      presentationPending: () => false,
      host: () => host as unknown as HTMLElement,
      toggle: () => { toggles += 1; },
    });
    onKey(key({ key: "m" }));
    onKey(key({ key: "m", isComposing: true }));
    expect(toggles).toBe(1);

    const blocked = minimapToggleKeyHandler({
      presentationPending: () => true,
      host: () => host as unknown as HTMLElement,
      toggle: () => { toggles += 1; },
    });
    blocked(key({ key: "m" }));
    expect(toggles).toBe(1);
  });
});
