import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderMapList } from "@/editor/panels/mapList";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

describe("map tree panel", () => {
  let restoreDom: () => void;

  beforeEach(() => {
    restoreDom = installFakeDom();
    const project = createBlankProject();
    store.replace(project);
    editorState.set({ currentMapId: project.startMapId, selectedEventId: null, selectedEventPageId: null });
  });

  afterEach(() => {
    restoreDom();
  });

  it("renders compact map organization controls", () => {
    const panel = renderWithFakeDom(() => {
      const container = document.createElement("div");
      renderMapList(container);
      return container;
    });

    expect(findByTestId(panel, "map-add")).not.toBeNull();
    expect(findByTestId(panel, "map-add-category")?.textContent).toContain("분류");
    expect(findByTestId(panel, "map-set-start")).not.toBeNull();
    expect(findByTestId(panel, "map-toggle-all")).not.toBeNull();
  });

  it("creates a category under the selected map", () => {
    const startMapId = store.getCurrent().startMapId;
    const panel = renderWithFakeDom(() => {
      const container = document.createElement("div");
      renderMapList(container);
      return container;
    });
    const addCategory = findByTestId(panel, "map-add-category");
    if (!addCategory) throw new Error("Expected category button");

    addCategory.dispatchEvent(new Event("click"));

    const current = store.getCurrent();
    const startNode = current.mapTree.mapId === startMapId ? current.mapTree : null;
    const categoryId = startNode?.children.find((child) => current.maps[child.mapId]?.name === "새 카테고리")?.mapId;
    expect(categoryId).toBeDefined();
    expect(categoryId ? current.maps[categoryId]?.name : "").toBe("새 카테고리");
    expect(categoryId ? current.maps[categoryId]?.width : 0).toBe(8);
  });
});
