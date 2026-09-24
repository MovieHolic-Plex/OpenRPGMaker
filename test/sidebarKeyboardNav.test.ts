import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderBasicLeftRail, resetBasicLeftRailForTests } from "@/editor/panels/basicLeftRail";
import { renderTilePalette } from "@/editor/panels/tilePalette";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
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
    resetBasicLeftRailForTests();
    restore();
  });

  describe("Standard mode (renderTilePalette)", () => {
    beforeEach(() => {
      resetEditorUiModeForTests("standard");
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

  describe("Beginner mode (renderBasicLeftRail)", () => {
    beforeEach(() => {
      resetEditorUiModeForTests("beginner");
      editorState.set({ tool: "paint", layer: "lower", currentMapId: store.getCurrent().startMapId });
      renderBasicLeftRail(container);
    });

    it("maintains focus on the same tool button across re-renders in basic rail", () => {
      const fillBtn = findByTestId(container as unknown as FakeElement, "tool-fill");
      expect(fillBtn).not.toBeNull();
      fillBtn!.focus();
      expect(document.activeElement).toBe(fillBtn);

      fillBtn!.click();
      renderBasicLeftRail(container);

      const newFillBtn = findByTestId(container as unknown as FakeElement, "tool-fill");
      expect(newFillBtn).not.toBeNull();
      expect(document.activeElement).toBe(newFillBtn);
    });

    it("keeps one tab stop per tool/brush group and navigates brush sizes", () => {
      const groupIds = ["basic-tool-list", "tile-brush-controls"] as const;
      for (const id of groupIds) {
        const group = findByTestId(container as unknown as FakeElement, id);
        expect(group, id).not.toBeNull();
        const stops = group!.querySelectorAll("button").filter((b) => b.getAttribute("tabindex") === "0");
        expect(stops.length, id).toBe(1);
      }
      const railStops = (container as unknown as FakeElement)
        .querySelectorAll("button")
        .filter((b) => b.getAttribute("tabindex") === "0");
      // 도구 그룹 · 붓 크기 그룹 · 타일 시트 — 되돌리기는 roving 그룹이 아닌 단추라 tabindex 를 달지 않는다.
      expect(railStops.length).toBe(3);
      const grid = findByTestId(container as unknown as FakeElement, "basic-tile-grid");
      expect(grid?.querySelectorAll("button").filter(b => b.getAttribute("tabindex") === "0")).toHaveLength(1);

      const first = findByTestId(container as unknown as FakeElement, "brush-size-1");
      const second = findByTestId(container as unknown as FakeElement, "brush-size-2");
      if (!first || !second) throw new Error("Missing brush size controls");
      first.focus();
      const right = new Event("keydown", { bubbles: true, cancelable: true });
      Object.defineProperty(right, "key", { value: "ArrowRight" });
      first.dispatchEvent(right);
      expect(right.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(second);
      expect(first.getAttribute("tabindex")).toBe("-1");
      expect(second.getAttribute("tabindex")).toBe("0");
      second.click();
      expect(editorState.get().brushSize).toBe(2);
      expect(document.activeElement).toBe(findByTestId(container as unknown as FakeElement, "brush-size-2"));
    });

    it("도구 그룹은 라벨 있는 가로 role=toolbar 다", () => {
      const tools = findByTestId(container as unknown as FakeElement, "basic-tool-list");
      expect(tools?.getAttribute("role")).toBe("toolbar");
      expect(tools?.getAttribute("aria-orientation")).toBe("horizontal");
      expect(tools?.getAttribute("aria-label")).toBeTruthy();
    });

    it("도구 그룹에서 ArrowDown 은 다음 도구로 포커스를 이동한다", () => {
      const paintBtn = findByTestId(container as unknown as FakeElement, "tool-paint");
      expect(paintBtn).not.toBeNull();
      paintBtn!.focus();

      let prevented = false;
      const downEvent = new Event("keydown", { bubbles: true, cancelable: true }) as any;
      downEvent.key = "ArrowDown";
      downEvent.preventDefault = () => { prevented = true; };
      paintBtn!.dispatchEvent(downEvent);

      expect(prevented).toBe(true);
      expect(document.activeElement).toBe(findByTestId(container as unknown as FakeElement, "tool-erase"));
    });
  });
});
