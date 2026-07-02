import { beforeEach, describe, expect, it } from "vitest";
import {
  selectRpgMakerEyedropperTool,
  selectRpgMakerStructureStamp,
  selectRpgMakerTileTool,
  setRpgMakerBrushSize,
  toggleRpgMakerTileStamp,
} from "@/editor/panels/rpgMakerTileToolbar";
import { editorState } from "@/editor/editorState";
import { createBlankProject, DEFAULT_TILESET_ID } from "@/project/defaults";
import { DIRT_ROAD_TILE } from "@/project/defaults/chipsetMapping";
import { store } from "@/project/store";

describe("RPG Maker tile toolbar actions", () => {
  beforeEach(() => {
    const project = createBlankProject();
    store.replace(project);
    editorState.set({
      activePaletteStamp: null,
      activeStampId: null,
      activeStructureStampId: null,
      currentMapId: project.startMapId,
      layer: "lower",
      paintShape: "pen",
      selection: null,
      tool: "paint",
    });
  });

  it("switches between pen, rectangle, round, fill, and erase painting modes", () => {
    selectRpgMakerTileTool("rect");
    expect(editorState.get().tool).toBe("paint");
    expect(editorState.get().paintShape).toBe("rect");

    selectRpgMakerTileTool("round");
    expect(editorState.get().tool).toBe("paint");
    expect(editorState.get().paintShape).toBe("round");

    selectRpgMakerTileTool("pen");
    expect(editorState.get().tool).toBe("paint");
    expect(editorState.get().paintShape).toBe("pen");

    selectRpgMakerTileTool("fill");
    expect(editorState.get().tool).toBe("fill");
    expect(editorState.get().paintShape).toBe("pen");

    selectRpgMakerTileTool("erase");
    expect(editorState.get().tool).toBe("erase");
    expect(editorState.get().paintShape).toBe("pen");
  });

  it("moves tile tools off the event layer and clears stamp modes", () => {
    editorState.set({
      activeStampId: "road-plus",
      activeStructureStampId: "house-template",
      layer: "event",
      tool: "event",
    });

    selectRpgMakerTileTool("rect");

    const state = editorState.get();
    expect(state.layer).toBe("lower");
    expect(state.tool).toBe("paint");
    expect(state.paintShape).toBe("rect");
    expect(state.activeStampId).toBeNull();
    expect(state.activeStructureStampId).toBeNull();
  });

  it("keeps an existing region only while the select tool is active", () => {
    const project = store.getCurrent();
    const selection = { mapId: project.startMapId, x: 2, y: 3, width: 4, height: 5 };
    editorState.set({ selection });

    selectRpgMakerTileTool("select");
    expect(editorState.get().tool).toBe("select");
    expect(editorState.get().selection).toEqual(selection);

    selectRpgMakerTileTool("pen");
    expect(editorState.get().selection).toBeNull();
  });

  it("selects a structure template from the toolbar menu", () => {
    const project = store.getCurrent();
    const selection = { mapId: project.startMapId, x: 2, y: 3, width: 4, height: 5 };
    editorState.set({
      activeStampId: "road-plus",
      activeStructureStampId: null,
      layer: "event",
      selection,
      tool: "event",
    });

    selectRpgMakerStructureStamp("house-wide");

    const state = editorState.get();
    expect(state.activeStampId).toBeNull();
    expect(state.activeStructureStampId).toBe("house-wide");
    expect(state.layer).toBe("lower");
    expect(state.paintShape).toBe("pen");
    expect(state.selection).toBeNull();
    expect(state.tool).toBe("paint");

    selectRpgMakerStructureStamp("house-wide");
    expect(editorState.get().activeStructureStampId).toBeNull();
  });

  it("moves brush size into toolbar state", () => {
    setRpgMakerBrushSize(3);

    expect(editorState.get().brushSize).toBe(3);
  });

  it("selects eyedropper from the folded inspector options", () => {
    editorState.set({
      activeStampId: "road-plus",
      activeStructureStampId: "house-template",
      layer: "event",
      tool: "event",
    });

    selectRpgMakerEyedropperTool();

    const state = editorState.get();
    expect(state.activeStampId).toBeNull();
    expect(state.activeStructureStampId).toBeNull();
    expect(state.layer).toBe("lower");
    expect(state.paintShape).toBe("pen");
    expect(state.selection).toBeNull();
    expect(state.tool).toBe("eyedropper");
  });

  it("toggles a tile stamp from the folded inspector options", () => {
    const tileset = store.getCurrent().tilesets[DEFAULT_TILESET_ID];
    if (!tileset) throw new Error("missing default tileset");

    toggleRpgMakerTileStamp(DIRT_ROAD_TILE.BODY, tileset);
    expect(editorState.get().activeStampId).toBe("road-plus");
    expect(editorState.get().tool).toBe("paint");

    toggleRpgMakerTileStamp(DIRT_ROAD_TILE.BODY, tileset);
    expect(editorState.get().activeStampId).toBeNull();
  });
});
