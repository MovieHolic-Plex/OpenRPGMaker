import { beforeEach, describe, expect, it } from "vitest";
import { resizeMap } from "@/editor/actions";
import { editorState } from "@/editor/editorState";
import { clearSelectionRegion, copySelection, pasteClipboard, selectTileRegion } from "@/editor/mapClipboard";
import { shiftMapContent } from "@/editor/mapShiftActions";
import { createBlankProject } from "@/project/defaults";
import { EXTRA_LAYER_KEYS, layerTileAt, setLayerTileAt, setShadowAt, shadowAt } from "@/project/mapLayers";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { deserialize, serialize } from "@/project/io";
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
    expect(layerTileAt(map(), 4, at(2, 1))).toBe(6);
    expect(shadowAt(map(), at(2, 1))).toBe(9);
    expect(layerTileAt(map(), 2, at(1, 1))).toBe(-1);
    expect(layerTileAt(map(), 4, at(1, 1))).toBe(-1);
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
    expect(layerTileAt(map(), 4, at(1, 1))).toBe(-1);
    expect(shadowAt(map(), at(1, 1))).toBe(0);
  });
  it("마지막 새 칸을 지우면 선택 층 키가 사라진다(옛 맵 모양으로 돌아간다)", () => {
    selectTileRegion(id(), { mapId: id(), x: 1, y: 1, width: 1, height: 1 });
    expect(clearSelectionRegion(id())).toBe(true);
    for (const key of EXTRA_LAYER_KEYS) expect(key in map()).toBe(false);
  });
  it("빈 칸을 붙여 마지막 새 칸을 덮어도 키가 사라진다", () => {
    selectTileRegion(id(), { mapId: id(), x: 3, y: 3, width: 1, height: 1 });
    expect(copySelection(id())).toBe(true);
    expect(pasteClipboard(id(), 1, 1)).toBe(true);
    for (const key of EXTRA_LAYER_KEYS) expect(key in map()).toBe(false);
  });
});

describe("새 층 — resize_map 도구", () => {
  function layeredToolContext(): { context: ToolContext; mapId: string } {
    const context: ToolContext = { project: createBlankProject() };
    expect(runTool(context, "create_map", { name: "층 크기", width: 6, height: 5, id: "map_layers_resize" }).ok).toBe(true);
    const m = context.project.maps.map_layers_resize;
    setLayerTileAt(m, 2, 1 * 6 + 1, 5);
    setLayerTileAt(m, 4, 4 * 6 + 5, 6);
    setShadowAt(m, 2 * 6 + 3, 9);
    return { context, mapId: "map_layers_resize" };
  }

  it("넓히면 칸이 같은 좌표에 남고 길이가 새 크기다", () => {
    const { context, mapId } = layeredToolContext();
    expect(runTool(context, "resize_map", { mapId, width: 9, height: 7 }).ok).toBe(true);
    const m = context.project.maps[mapId];
    for (const key of EXTRA_LAYER_KEYS) expect(m[key]).toHaveLength(9 * 7);
    expect(layerTileAt(m, 2, 1 * 9 + 1)).toBe(5);
    expect(layerTileAt(m, 4, 4 * 9 + 5)).toBe(6);
    expect(shadowAt(m, 2 * 9 + 3)).toBe(9);
    expect(layerTileAt(m, 2, 1 * 9 + 7)).toBe(-1);
    expect(() => deserialize(serialize(context.project))).not.toThrow();
  });

  it("줄이면 밖으로 나간 칸은 버리고, 모두 비면 키를 뺀다", () => {
    const { context, mapId } = layeredToolContext();
    expect(runTool(context, "resize_map", { mapId, width: 4, height: 3 }).ok).toBe(true);
    const m = context.project.maps[mapId];
    expect(m.lowerOverlayTiles).toHaveLength(12);
    expect(layerTileAt(m, 2, 1 * 4 + 1)).toBe(5);
    expect(m.shadowBits).toHaveLength(12);
    expect(shadowAt(m, 2 * 4 + 3)).toBe(9);
    expect("upperOverlayTiles" in m).toBe(false);
  });
});
