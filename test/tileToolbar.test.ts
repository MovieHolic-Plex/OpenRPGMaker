import { beforeEach, describe, expect, it } from "vitest";
import {
  selectEyedropperTool,
  selectTileTool,
  setTileBrushSize,
} from "@/editor/panels/tileToolbar";
import { editorState } from "@/editor/editorState";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

describe("RPG Maker tile toolbar actions", () => {
  beforeEach(() => {
    const project = createBlankProject();
    store.replace(project);
    editorState.set({
      activePaletteStamp: null,
      currentMapId: project.startMapId,
      layer: "lower",
      paintShape: "pen",
      selection: null,
      tool: "paint",
    });
  });

  it("switches between pen, rectangle, round, fill, and erase painting modes", () => {
    selectTileTool("rect");
    expect(editorState.get().tool).toBe("paint");
    expect(editorState.get().paintShape).toBe("rect");

    selectTileTool("round");
    expect(editorState.get().tool).toBe("paint");
    expect(editorState.get().paintShape).toBe("round");

    selectTileTool("pen");
    expect(editorState.get().tool).toBe("paint");
    expect(editorState.get().paintShape).toBe("pen");

    selectTileTool("fill");
    expect(editorState.get().tool).toBe("fill");
    expect(editorState.get().paintShape).toBe("pen");

    selectTileTool("erase");
    expect(editorState.get().tool).toBe("erase");
    expect(editorState.get().paintShape).toBe("pen");
  });

  it("moves tile tools off the event layer", () => {
    editorState.set({
      layer: "event",
      tool: "event",
    });

    selectTileTool("rect");

    const state = editorState.get();
    expect(state.layer).toBe("lower");
    expect(state.tool).toBe("paint");
    expect(state.paintShape).toBe("rect");
  });

  it("keeps an existing region only while the select tool is active", () => {
    const project = store.getCurrent();
    const selection = { mapId: project.startMapId, x: 2, y: 3, width: 4, height: 5 };
    editorState.set({ selection });

    selectTileTool("select");
    expect(editorState.get().tool).toBe("select");
    expect(editorState.get().selection).toEqual(selection);

    selectTileTool("pen");
    expect(editorState.get().selection).toBeNull();
  });

  it("moves brush size into toolbar state", () => {
    setTileBrushSize(3);

    expect(editorState.get().brushSize).toBe(3);
  });

  it("selects eyedropper from the folded inspector options", () => {
    editorState.set({
      layer: "event",
      tool: "event",
    });

    selectEyedropperTool();

    const state = editorState.get();
    expect(state.layer).toBe("lower");
    expect(state.paintShape).toBe("pen");
    expect(state.selection).toBeNull();
    expect(state.tool).toBe("eyedropper");
  });
});
