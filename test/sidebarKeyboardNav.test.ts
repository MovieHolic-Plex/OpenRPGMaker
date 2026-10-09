import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderTilePalette } from "@/editor/panels/tilePalette";
import { editorState } from "@/editor/editorState";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

describe("Sidebar Keyboard Navigation & Focus Survival Integration", () => {
  let restore: () => void;
  let container: HTMLElement;

  beforeEach(() => {
    restore = installFakeDom();
    store.replace(createBlankProject());
    container = document.createElement("div");
    document.body.append(container);
  });

  afterEach(() => {
    restore();
  });

  describe("tile palette (renderTilePalette)", () => {
    beforeEach(() => {
      editorState.set({ tool: "paint", layer: "lower", currentMapId: store.getCurrent().startMapId });
      renderTilePalette(container);
    });

    it("maintains focus on the same tool button across re-renders when activated", () => {
      const fillBtn = findByTestId(container as unknown as FakeElement, "tool-fill");
      expect(fillBtn).not.toBeNull();
      fillBtn!.focus();
      expect(document.activeElement).toBe(fillBtn);

      // Simulate activation (which updates editorState and triggers re-render)
      fillBtn!.click();
      renderTilePalette(container);

      const newFillBtn = findByTestId(container as unknown as FakeElement, "tool-fill");
      expect(newFillBtn).not.toBeNull();
      expect(document.activeElement).toBe(newFillBtn);
    });

    it("has roving tabindex (1 tab stop in toolbar) and moves focus via arrow keys", () => {
      const selectBtn = findByTestId(container as unknown as FakeElement, "tool-select");
      const paintBtn = findByTestId(container as unknown as FakeElement, "tool-paint");
      expect(selectBtn).not.toBeNull();
      expect(paintBtn).not.toBeNull();

      // Toolbars have exactly one tabindex=0 button (the active tool)
      const toolbar = findByTestId(container as unknown as FakeElement, "oprn-tile-toolbar");
      expect(toolbar).not.toBeNull();
      const allToolbarButtons = (toolbar as any).querySelectorAll("button");
      const tabStops = Array.from(allToolbarButtons).filter((b) => (b as any).getAttribute("tabindex") === "0");
      expect(tabStops.length).toBe(1);

      // Focus on paint and press ArrowRight
      paintBtn!.focus();
      let stopped = false;
      let prevented = false;
      const rightEvent = new Event("keydown", { bubbles: true, cancelable: true }) as any;
      rightEvent.key = "ArrowRight";
      rightEvent.stopPropagation = () => { stopped = true; };
      rightEvent.preventDefault = () => { prevented = true; };

      paintBtn!.dispatchEvent(rightEvent);
      expect(stopped).toBe(true);
      expect(prevented).toBe(true);
      // Next enabled button in toolbar
      const eraseBtn = findByTestId(container as unknown as FakeElement, "tool-erase");
      expect(document.activeElement).toBe(eraseBtn);
    });
  });
});
