import { beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { selectPaletteTile } from "@/editor/panels/tilePalette";
import { createBlankProject, TILE } from "@/project/defaults";
import { store } from "@/project/store";

describe("tile palette selection", () => {
  beforeEach(() => {
    store.replace(createBlankProject());
    editorState.set({ layer: "upper", tool: "fill", selectedTile: TILE.GRASS });
  });

  it("keeps the current layer and tool when a tile is selected", () => {
    selectPaletteTile(TILE.WATER);

    expect(editorState.get().selectedTile).toBe(TILE.WATER);
    expect(editorState.get().layer).toBe("upper");
    expect(editorState.get().tool).toBe("fill");
  });

  it("does not leave the event layer when a tile is selected", () => {
    editorState.set({ layer: "event", tool: "event", selectedTile: TILE.GRASS });

    selectPaletteTile(TILE.FLOWERS);

    expect(editorState.get().selectedTile).toBe(TILE.FLOWERS);
    expect(editorState.get().layer).toBe("event");
    expect(editorState.get().tool).toBe("event");
  });
});
