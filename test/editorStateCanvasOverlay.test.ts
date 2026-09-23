import { describe, expect, it } from "vitest";
import {
  editorState,
  editorStateChangedOnlyCanvasOverlay,
  editorStateNeedsMapTreeRefresh,
  editorStateNeedsPaletteRefresh,
  type EditorState,
} from "@/editor/editorState";

function snapshot(patch: Partial<EditorState> = {}): EditorState {
  return { ...editorState.get(), ...patch };
}

describe("editorStateChangedOnlyCanvasOverlay", () => {
  it("선택만 바뀌면 true", () => {
    const previous = snapshot();
    const next = snapshot({
      selection: { mapId: "map-1", x: 1, y: 2, width: 3, height: 4 },
    });
    expect(editorStateChangedOnlyCanvasOverlay(previous, next)).toBe(true);
  });

  it("붙여넣기 미리보기만 바뀌면 true", () => {
    const previous = snapshot();
    const next = snapshot({ pastePreview: { x: 4, y: 5 } });
    expect(editorStateChangedOnlyCanvasOverlay(previous, next)).toBe(true);
  });

  it("도구가 같이 바뀌면 false", () => {
    const previous = snapshot();
    const next = snapshot({
      tool: "select",
      selection: { mapId: "map-1", x: 1, y: 1, width: 2, height: 2 },
    });
    expect(editorStateChangedOnlyCanvasOverlay(previous, next)).toBe(false);
  });

  it("레이어가 바뀌면 false", () => {
    const previous = snapshot({ layer: "lower" });
    const next = snapshot({ layer: "upper", pastePreview: { x: 1, y: 1 } });
    expect(editorStateChangedOnlyCanvasOverlay(previous, next)).toBe(false);
  });
});

describe("에디터 상태와 맵 트리 갱신", () => {
  it("선택 타일·도구·레이어는 맵 트리를 다시 짓지 않고 팔레트만 갱신한다", () => {
    const previous = snapshot({ layer: "lower", selectedTile: 1, tool: "paint" });
    const tile = snapshot({ layer: "lower", selectedTile: 8, tool: "paint" });
    const tool = snapshot({ layer: "lower", selectedTile: 1, tool: "erase" });
    const layer = snapshot({ layer: "upper", selectedTile: 1, tool: "paint" });
    for (const next of [tile, tool, layer]) {
      expect(editorStateNeedsMapTreeRefresh(previous, next)).toBe(false);
      expect(editorStateNeedsPaletteRefresh(previous, next)).toBe(true);
    }
  });

  it("현재 맵이 바뀌면 맵 트리를 다시 짓는다", () => {
    const previous = snapshot({ currentMapId: "map-a" });
    const next = snapshot({ currentMapId: "map-b" });
    expect(editorStateNeedsMapTreeRefresh(previous, next)).toBe(true);
  });

  it("줌만 바뀌면 팔레트도 맵 트리도 갱신하지 않는다", () => {
    const previous = snapshot({ zoom: 2 });
    const next = snapshot({ zoom: 1 });
    expect(editorStateNeedsMapTreeRefresh(previous, next)).toBe(false);
    expect(editorStateNeedsPaletteRefresh(previous, next)).toBe(false);
  });
});
