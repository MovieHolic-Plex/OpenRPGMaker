import { describe, expect, it } from "vitest";
import {
  editorState,
  editorStateChangedOnlyCanvasOverlay,
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
