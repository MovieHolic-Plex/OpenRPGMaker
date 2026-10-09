/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import {
  dismissLocationDrawModeForLayer,
  dismissLocationDrawModeForTool,
  isLocationDrawMode,
} from "@/editor/locationDrawMode";
import { locationLayerState, setLocationLayerEnabled } from "@/editor/mapLocationLayerState";
import { isLocationDrawClick } from "@/project/mapNamedLocations";
import { selectMapModeTool, selectTileTool } from "@/editor/panels/tileToolbarActions";

describe("location draw mode", () => {
  afterEach(() => {
    setLocationLayerEnabled(false);
    editorState.set({ tool: "paint", layer: "lower" });
    delete document.body.dataset.locationDraw;
  });

  it("isLocationDrawClick is only true on the same tile", () => {
    expect(isLocationDrawClick({ x: 3, y: 4 }, { x: 3, y: 4 })).toBe(true);
    expect(isLocationDrawClick({ x: 3, y: 4 }, { x: 4, y: 4 })).toBe(false);
  });

  it("keeps pan and dismisses paint/event tools", () => {
    setLocationLayerEnabled(true);
    expect(isLocationDrawMode()).toBe(true);
    dismissLocationDrawModeForTool("pan");
    expect(locationLayerState().enabled).toBe(true);
    dismissLocationDrawModeForTool("paint");
    expect(locationLayerState().enabled).toBe(false);
  });

  it("event layer dismisses draw mode", () => {
    setLocationLayerEnabled(true);
    dismissLocationDrawModeForLayer("lower");
    expect(locationLayerState().enabled).toBe(true);
    dismissLocationDrawModeForLayer("event");
    expect(locationLayerState().enabled).toBe(false);
  });

  it("selecting a tile tool turns the location layer off even if paint was already selected", () => {
    editorState.set({ tool: "paint", layer: "lower" });
    setLocationLayerEnabled(true);
    expect(document.body.dataset.locationDraw).toBe("1");
    selectTileTool("pen");
    expect(locationLayerState().enabled).toBe(false);
    expect(document.body.dataset.locationDraw).toBeUndefined();
  });

  it("selecting the event tool turns the location layer off", () => {
    setLocationLayerEnabled(true);
    selectMapModeTool("event");
    expect(locationLayerState().enabled).toBe(false);
    expect(editorState.get().tool).toBe("event");
  });
});
