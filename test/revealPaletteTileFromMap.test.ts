import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { getEditorUiMode, setEditorUiMode } from "@/editor/editorUiMode";
import { revealPaletteTileFromMap } from "@/editor/panels/tilePalette";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installFakeDom } from "./fakeDom";

describe("revealPaletteTileFromMap (expert eyedropper → chipset)", () => {
  let restoreDom: (() => void) | null = null;
  let storage: Map<string, string>;

  beforeEach(() => {
    restoreDom = installFakeDom();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        requestAnimationFrame: (cb: (t: number) => void) => {
          cb(0);
          return 0;
        },
        setTimeout: (cb: () => void) => {
          cb();
          return 0;
        },
        clearTimeout: globalThis.clearTimeout.bind(globalThis),
        scrollTo: () => {},
        scrollX: 0,
        scrollY: 0,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      },
    });
    storage = new Map();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => {
          storage.set(k, v);
        },
        removeItem: (k: string) => {
          storage.delete(k);
        },
        clear: () => storage.clear(),
        key: () => null,
        length: 0,
      },
    });
    store.replace(createBlankProject());
    editorState.set({
      currentMapId: store.getCurrent().startMapId,
      layer: "lower",
      tool: "paint",
      selectedTile: 0,
    });
    setEditorUiMode("beginner");
    document.body.replaceChildren();
  });

  afterEach(() => {
    document.body.replaceChildren();
    setEditorUiMode("beginner");
    restoreDom?.();
    restoreDom = null;
  });

  it("does nothing visible in beginner mode", () => {
    setEditorUiMode("beginner");
    expect(() => revealPaletteTileFromMap(105)).not.toThrow();
    expect(getEditorUiMode()).toBe("beginner");
    expect(localStorage.getItem("rpg-zzu:palette-work-tab")).toBeNull();
  });

  it("in standard mode forces the paint tab and re-renders palette root", () => {
    setEditorUiMode("standard");
    const root = document.createElement("div");
    root.dataset.testid = "left-palette-root";
    document.body.append(root);
    editorState.set({ selectedTile: 105, layer: "lower" });
    revealPaletteTileFromMap(105);
    expect(localStorage.getItem("rpg-zzu:palette-work-tab")).toBe("paint");
    expect(root.childElementCount).toBeGreaterThan(0);
  });

  it("in expert mode forces the paint tab and re-renders palette root when present", () => {
    setEditorUiMode("expert");
    const root = document.createElement("div");
    root.dataset.testid = "left-palette-root";
    document.body.append(root);
    editorState.set({ selectedTile: 105, layer: "lower" });
    revealPaletteTileFromMap(105);
    expect(localStorage.getItem("rpg-zzu:palette-work-tab")).toBe("paint");
    expect(root.childElementCount).toBeGreaterThan(0);
  });
});
