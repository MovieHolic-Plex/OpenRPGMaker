// M toggles the field minimap from a document keydown, outside Phaser's keyboard plugin.
// That listener used to accept every "m", including repeats, IME composition, modifier
// chords, text fields, and surfaces that already hide the minimap. A press the player
// cannot see then left minimapUserHidden set, so the map stayed gone after dialogue closed.
import { afterEach, describe, expect, it } from "vitest";

import { acceptsMinimapToggle, minimapToggleKeyHandler, syncMinimapPosition, syncMinimapVisibility, type MinimapRuntimeState, type MinimapToggleKeyEvent } from "@/player/minimap";
import type { GameMap } from "@/project/types";
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

  it("hides the map for a shop mounted outside the dialogue host", () => {
    const host = openField();
    const shop = new FakeElement("div");
    shop.dataset.testid = "shop-scene";
    document.body.append(shop as unknown as Node);
    expect(acceptsMinimapToggle(key({ key: "m" }), host as unknown as HTMLElement)).toBe(false);
  });

  it("looks up suppressing overlays once per check", () => {
    const host = openField();
    let hostScans = 0;
    let documentScans = 0;
    const hostQuery = host.querySelector.bind(host);
    host.querySelector = ((selector: string) => {
      hostScans += 1;
      return hostQuery(selector);
    }) as typeof host.querySelector;
    const doc = document as Document & { querySelector: (selector: string) => Element | null };
    const documentQuery = doc.querySelector.bind(document);
    doc.querySelector = ((selector: string) => {
      documentScans += 1;
      return documentQuery(selector);
    }) as typeof doc.querySelector;
    expect(acceptsMinimapToggle(key({ key: "m" }), host as unknown as HTMLElement)).toBe(true);
    expect(hostScans).toBe(1);
    expect(documentScans).toBe(1);
  });
});

describe("minimap frame writes", () => {
  function state(dot: FakeElement, root: FakeElement): MinimapRuntimeState {
    return {
      mapId: "field",
      setting: { enabled: true },
      scale: 1,
      canvas: new FakeElement("canvas") as unknown as HTMLCanvasElement,
      dot: dot as unknown as HTMLElement,
      root: root as unknown as HTMLElement,
      hidden: false,
    };
  }

  it("writes the player dot only when the tile changes", () => {
    restoreDom = installFakeDom();
    const dot = new FakeElement("div");
    const writes: string[] = [];
    for (const prop of ["left", "top"] as const) {
      let value = "";
      Object.defineProperty(dot.style, prop, {
        configurable: true,
        get: () => value,
        set: (next: string) => {
          writes.push(`${prop}=${next}`);
          value = next;
        },
      });
    }
    const map = { tileSize: 16 } as GameMap;
    const minimap = state(dot, new FakeElement("div"));
    syncMinimapPosition(minimap, 2, 3, map);
    syncMinimapPosition(minimap, 2, 3, map);
    syncMinimapPosition(minimap, 3, 3, map);
    expect(writes).toEqual(["left=29.5px", "top=45.5px", "left=45.5px", "top=45.5px"]);
  });

  it("writes minimap visibility only when the hidden flag changes", () => {
    const host = openField();
    const root = new FakeElement("div");
    const writes: string[] = [];
    let display = "";
    Object.defineProperty(root.style, "display", {
      configurable: true,
      get: () => display,
      set: (next: string) => {
        writes.push(next);
        display = next;
      },
    });
    const minimap = state(new FakeElement("div"), root);
    expect(syncMinimapVisibility(minimap, host as unknown as HTMLElement, false)).toBe(false);
    expect(syncMinimapVisibility(minimap, host as unknown as HTMLElement, false)).toBe(false);
    expect(syncMinimapVisibility(minimap, host as unknown as HTMLElement, true)).toBe(true);
    expect(syncMinimapVisibility(minimap, host as unknown as HTMLElement, true)).toBe(true);
    expect(writes).toEqual(["none"]);
    expect(minimap.hidden).toBe(true);
    expect(root.hidden).toBe(true);
  });
});
