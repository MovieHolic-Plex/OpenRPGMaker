import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  retainEventLayerClickFeedback,
  shouldClearAiHighlightSelection,
} from "@/editor/transientEditorChrome";
import type { EventLayerClickFeedback } from "@/editor/editSceneEventMarkers";

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const FEEDBACK: EventLayerClickFeedback = {
  mapId: "map_1",
  x: 11,
  y: 8,
  mode: "edit",
};

describe("retainEventLayerClickFeedback", () => {
  it("keeps the last-click badge after a human map edit", () => {
    expect(
      retainEventLayerClickFeedback({
        feedback: FEEDBACK,
        currentMapId: "map_1",
        changeOrigin: "human",
      }),
    ).toEqual(FEEDBACK);
  });

  it("drops the badge when an AI apply redraws the map", () => {
    expect(
      retainEventLayerClickFeedback({
        feedback: FEEDBACK,
        currentMapId: "map_1",
        changeOrigin: "ai",
      }),
    ).toBeNull();
  });

  it("drops the badge when the editor switches maps", () => {
    expect(
      retainEventLayerClickFeedback({
        feedback: FEEDBACK,
        currentMapId: "map_2",
        mapChanged: true,
      }),
    ).toBeNull();
  });

  it("drops a badge that belongs to a different map even without mapChanged", () => {
    expect(
      retainEventLayerClickFeedback({
        feedback: FEEDBACK,
        currentMapId: "map_2",
      }),
    ).toBeNull();
  });

  it("does nothing when there is no badge", () => {
    expect(
      retainEventLayerClickFeedback({
        feedback: null,
        currentMapId: "map_1",
        changeOrigin: "ai",
      }),
    ).toBeNull();
  });
});

describe("shouldClearAiHighlightSelection", () => {
  it("clears highlight_map_region selection at turn end", () => {
    expect(shouldClearAiHighlightSelection(true)).toBe(true);
  });

  it("leaves the user's own selection alone when the turn never highlighted", () => {
    expect(shouldClearAiHighlightSelection(false)).toBe(false);
  });
});

describe("wiring", () => {
  it("EditScene drops the click badge on AI store changes and map switches", () => {
    const scene = read("src/editor/EditScene.ts");
    expect(scene).toContain("retainEventLayerClickFeedback");
    expect(scene).toContain("changeOrigin: change.origin");
    expect(scene).toContain("this.clearEventLayerClickFeedback()");
  });

  it("the chat turn runner clears highlight_map_region selection when it still owns the turn", () => {
    const runner = read("src/editor/panels/aiTurnRunner.ts");
    expect(runner).toContain("highlightedRegionThisTurn = true");
    expect(runner).toContain("shouldClearAiHighlightSelection(highlightedRegionThisTurn)");
    expect(runner).toContain("editorState.set({ selection: null })");
  });
});
