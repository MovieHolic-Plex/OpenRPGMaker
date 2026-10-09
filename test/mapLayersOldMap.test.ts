// 옛 맵(2층·4층·그림자 칸 없음)은 편집해도 선택 층 키가 생기지 않는다 — 설계 §2 「옛 맵과 새 맵의 JSON 이 같다」.
import { beforeEach, describe, expect, it } from "vitest";
import { resizeMap } from "@/editor/actions";
import { editorState } from "@/editor/editorState";
import { clearSelectionRegion, copySelection, pasteClipboard, selectTileRegion } from "@/editor/mapClipboard";
import { shiftMapContent } from "@/editor/mapShiftActions";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { EXTRA_LAYER_KEYS, setLayerTileAt } from "@/project/mapLayers";
import { store } from "@/project/store";
import type { GameMap } from "@/project/types";

const id = () => store.getCurrent().startMapId;
const map = () => store.getCurrent().maps[id()];

function expectOldShape(m: GameMap): void {
  for (const key of EXTRA_LAYER_KEYS) expect(Object.keys(m)).not.toContain(key);
}

beforeEach(() => {
  store.replace(createBlankProject());
  editorState.set({ currentMapId: null, tool: "select", layer: "lower", selection: null, clipboard: null });
  expectOldShape(map());
});

describe("옛 맵 — 편집해도 선택 층이 생기지 않는다", () => {
  it("크기 바꾸기", () => {
    resizeMap(id(), map().width + 3, map().height + 2);
    expectOldShape(map());
    resizeMap(id(), 4, 4);
    expectOldShape(map());
  });
  it("밀기", () => {
    expect(shiftMapContent(id(), { dx: 1, dy: -1 })).toBe(true);
    expectOldShape(map());
  });
  it("옛 맵 복사본 붙여넣기", () => {
    selectTileRegion(id(), { mapId: id(), x: 0, y: 0, width: 2, height: 2 });
    expect(copySelection(id())).toBe(true);
    expect(pasteClipboard(id(), 3, 3)).toBe(true);
    expectOldShape(map());
  });
  it("영역 지우기", () => {
    selectTileRegion(id(), { mapId: id(), x: 1, y: 1, width: 2, height: 2 });
    expect(clearSelectionRegion(id())).toBe(true);
    expectOldShape(map());
  });
  it("updateMapTiles 로 1층·3층 칠하기", () => {
    store.updateMapTiles(id(), (m) => { setLayerTileAt(m, 1, 0, 3); setLayerTileAt(m, 3, 1, 4); });
    expectOldShape(map());
  });
  it("resize_map 도구", () => {
    const context: ToolContext = { project: createBlankProject() };
    expect(runTool(context, "create_map", { name: "옛 맵", width: 6, height: 5, id: "map_old_shape" }).ok).toBe(true);
    expect(runTool(context, "resize_map", { mapId: "map_old_shape", width: 9, height: 7 }).ok).toBe(true);
    expectOldShape(context.project.maps.map_old_shape);
  });
});
