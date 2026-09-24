import { beforeEach, describe, expect, it } from "vitest";
import { resizeMap } from "@/editor/actions";
import { editorState } from "@/editor/editorState";
import { clearSelectionRegion, copySelection, pasteClipboard, selectTileRegion } from "@/editor/mapClipboard";
import { shiftMapContent } from "@/editor/mapShiftActions";
import { createBlankProject } from "@/project/defaults";
import { layerTileAt, setLayerTileAt, setShadowAt, shadowAt } from "@/project/mapLayers";
import { store } from "@/project/store";

const id = () => store.getCurrent().startMapId;
const map = () => store.getCurrent().maps[id()];
const at = (x: number, y: number) => y * map().width + x;

beforeEach(() => {
  store.replace(createBlankProject());
  editorState.set({ currentMapId: null, tool: "select", layer: "lower", selection: null, clipboard: null });
  store.updateMapTiles(id(), (m) => {
    setLayerTileAt(m, 2, 1 * m.width + 1, 5);
    setLayerTileAt(m, 4, 1 * m.width + 1, 6);
    setShadowAt(m, 1 * m.width + 1, 9);
  });
});

describe("새 층 — 편집 동작", () => {
  it("크기 바꾸기는 남는 칸의 2·4층·그림자를 지킨다", () => {
    resizeMap(id(), 4, 4);
    expect(layerTileAt(map(), 2, at(1, 1))).toBe(5);
    expect(layerTileAt(map(), 4, at(1, 1))).toBe(6);
    expect(shadowAt(map(), at(1, 1))).toBe(9);
    expect(map().lowerOverlayTiles?.length).toBe(16);
  });
  it("밀기는 새 칸도 함께 민다", () => {
    expect(shiftMapContent(id(), { dx: 1, dy: 0 })).toBe(true);
    expect(layerTileAt(map(), 2, at(2, 1))).toBe(5);
    expect(shadowAt(map(), at(2, 1))).toBe(9);
    expect(layerTileAt(map(), 2, at(1, 1))).toBe(-1);
  });
  it("복사·붙여넣기는 2·4층·그림자를 옮긴다", () => {
    selectTileRegion(id(), { mapId: id(), x: 1, y: 1, width: 1, height: 1 });
    expect(copySelection(id())).toBe(true);
    expect(pasteClipboard(id(), 5, 5)).toBe(true);
    expect(layerTileAt(map(), 2, at(5, 5))).toBe(5);
    expect(layerTileAt(map(), 4, at(5, 5))).toBe(6);
    expect(shadowAt(map(), at(5, 5))).toBe(9);
  });
  it("영역 지우기는 새 칸도 비운다", () => {
    selectTileRegion(id(), { mapId: id(), x: 1, y: 1, width: 1, height: 1 });
    expect(clearSelectionRegion(id())).toBe(true);
    expect(layerTileAt(map(), 2, at(1, 1))).toBe(-1);
    expect(shadowAt(map(), at(1, 1))).toBe(0);
  });
});
