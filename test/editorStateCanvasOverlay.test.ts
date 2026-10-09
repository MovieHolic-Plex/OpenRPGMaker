import { describe, expect, it } from "vitest";
import {
  editorState,
  editorStateChangedOnlyCanvasOverlay,
  editorStateChangedOnlySelectedTile,
  editorStateChangedOnlyToolPick,
  editorStateNeedsEventEditorRefresh,
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

  it("고른 타일만 바뀌면 팔레트 전체 재생성이 아니라 선택 동기화다", () => {
    const previous = snapshot({ selectedTile: 1, tool: "paint", layer: "lower", activePaletteStamp: null });
    const next = snapshot({ selectedTile: 8, tool: "paint", layer: "lower", activePaletteStamp: null });
    expect(editorStateChangedOnlySelectedTile(previous, next)).toBe(true);
    expect(editorStateNeedsPaletteRefresh(previous, next)).toBe(true);
    expect(editorStateNeedsMapTreeRefresh(previous, next)).toBe(false);
  });

  it("타일과 함께 레이어나 도구가 바뀌면 선택만의 변경이 아니다", () => {
    const previous = snapshot({ selectedTile: 1, tool: "paint", layer: "lower" });
    expect(editorStateChangedOnlySelectedTile(previous, snapshot({ selectedTile: 8, layer: "upper" }))).toBe(false);
    expect(editorStateChangedOnlySelectedTile(previous, snapshot({ selectedTile: 8, tool: "erase" }))).toBe(false);
  });

  it("줌만 바뀌면 팔레트도 맵 트리도 갱신하지 않는다", () => {
    const previous = snapshot({ zoom: 2 });
    const next = snapshot({ zoom: 1 });
    expect(editorStateNeedsMapTreeRefresh(previous, next)).toBe(false);
    expect(editorStateNeedsPaletteRefresh(previous, next)).toBe(false);
  });
});

describe("editorStateChangedOnlyToolPick", () => {
  it("도구·붓 모양·크기(선택 해제 포함)만 바뀌면 true", () => {
    const previous = snapshot({ layer: "lower", tool: "paint", paintShape: "pen", brushSize: 1 });
    expect(editorStateChangedOnlyToolPick(previous, snapshot({ layer: "lower", tool: "fill", paintShape: "pen", brushSize: 1 }))).toBe(true);
    expect(editorStateChangedOnlyToolPick(previous, snapshot({ layer: "lower", tool: "paint", paintShape: "rect", brushSize: 1 }))).toBe(true);
    expect(editorStateChangedOnlyToolPick(previous, snapshot({ layer: "lower", tool: "paint", paintShape: "pen", brushSize: 3 }))).toBe(true);
    expect(editorStateChangedOnlyToolPick(
      snapshot({ layer: "lower", tool: "select", selection: { mapId: "m", x: 0, y: 0, width: 1, height: 1 } }),
      snapshot({ layer: "lower", tool: "paint", selection: null }),
    )).toBe(true);
  });

  it("레이어·도장·타일이 같이 바뀌거나 이벤트 레이어면 false", () => {
    const previous = snapshot({ layer: "lower", tool: "paint", selectedTile: 1, activePaletteStamp: null });
    expect(editorStateChangedOnlyToolPick(previous, snapshot({ layer: "upper", tool: "fill", selectedTile: 1, activePaletteStamp: null }))).toBe(false);
    expect(editorStateChangedOnlyToolPick(previous, snapshot({ layer: "lower", tool: "fill", selectedTile: 2, activePaletteStamp: null }))).toBe(false);
    expect(editorStateChangedOnlyToolPick(previous, snapshot({
      layer: "lower", tool: "paint", selectedTile: 1,
      activePaletteStamp: { width: 1, height: 1, source: { startTile: 1, endTile: 1 }, cells: [] },
    }))).toBe(false);
    expect(editorStateChangedOnlyToolPick(snapshot({ layer: "event", tool: "event" }), snapshot({ layer: "event", tool: "paint" }))).toBe(false);
    // 선택 사각형만 바뀐 통지는 도구 변경이 아니다.
    expect(editorStateChangedOnlyToolPick(previous, snapshot({
      layer: "lower", tool: "paint", selectedTile: 1, activePaletteStamp: null,
      selection: { mapId: "m", x: 0, y: 0, width: 1, height: 1 },
    }))).toBe(false);
  });
});

describe("editorStateNeedsEventEditorRefresh", () => {
  it("줌·선택 사각형·붓 고르기만 바뀌면 이벤트 편집기 본문을 다시 짓지 않는다", () => {
    const previous = snapshot();
    const next = snapshot({
      zoom: previous.zoom === 1 ? 2 : 1,
      selection: { mapId: "map-1", x: 1, y: 2, width: 3, height: 4 },
      selectedTile: previous.selectedTile + 1,
      brushSize: previous.brushSize === 1 ? 2 : 1,
    });
    expect(editorStateNeedsEventEditorRefresh(previous, next)).toBe(false);
  });

  it("본문이 읽는 페이지·도구가 바뀌면 다시 짓는다", () => {
    const previous = snapshot();
    expect(editorStateNeedsEventEditorRefresh(previous, snapshot({ selectedEventPageId: "page-x" }))).toBe(true);
    expect(editorStateNeedsEventEditorRefresh(previous, snapshot({ tool: previous.tool === "event" ? "paint" : "event" }))).toBe(true);
  });
});
