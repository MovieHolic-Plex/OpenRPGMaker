import { beforeEach, describe, expect, it } from "vitest";
import { addMap, moveMapInTree, paintTile, resizeMap, setMapTileset } from "@/editor/actions";
import { addEvent } from "@/editor/eventActions";
import { copySelection, pasteClipboard, selectTileRegion } from "@/editor/mapClipboard";
import { recordProjectSnapshot, redoMapEdit, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { shiftMapContent } from "@/editor/mapShiftActions";
import { setTerrainTag } from "@/editor/tilesetActions";
import { editorState } from "@/editor/editorState";
import { DIRT_ROAD_TILE } from "@/project/defaults/chipsetMapping";
import { LAKE_AUTOTILE_TILE } from "@/project/defaults/lakeAutotile";
import { paintRoadRect, shapeRoadEdges, type RoadRect } from "@/project/defaults/roadAutotile";
import { createBlankProject, DEFAULT_TILESET_ID, TILE } from "@/project/defaults";
import { store } from "@/project/store";
import { isHarnessStackableTile } from "@/project/tilesetHarness";

function resetEditorState(): void {
  editorState.set({
    currentMapId: null,
    tool: "paint",
    layer: "lower",
    selectedTile: TILE.GRASS,
    selectedEventId: null,
    selection: null,
    clipboard: null,
  });
}

beforeEach(() => {
  store.replace(createBlankProject());
  resetMapEditHistory();
  resetEditorState();
});

describe("map edit commands", () => {
  it("copies and pastes a selected lower-layer tile block", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    paintTile(mapId, "lower", 1, 1, TILE.WATER);
    editorState.set({ layer: "lower" });

    expect(selectTileRegion(mapId, { mapId, x: 1, y: 1, width: 1, height: 1 })).toBe(true);
    expect(copySelection(mapId)).toBe(true);
    expect(pasteClipboard(mapId, 2, 1)).toBe(true);

    const map = store.getCurrent().maps[mapId];
    expect(map.lowerTiles[1 * map.width + 2]).toBe(TILE.WATER);
  });

  it("restores and reapplies a tile edit through undo/redo", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    const index = 1 * map.width + 1;
    const before = map.lowerTiles[index];

    recordProjectSnapshot();
    paintTile(mapId, "lower", 1, 1, TILE.WATER);
    expect(store.getCurrent().maps[mapId].lowerTiles[index]).toBe(TILE.WATER);

    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().maps[mapId].lowerTiles[index]).toBe(before);

    expect(redoMapEdit()).toBe(true);
    expect(store.getCurrent().maps[mapId].lowerTiles[index]).toBe(TILE.WATER);
  });

  it("stores water autotile representative ids as ordinary lower-layer paint data", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;

    paintTile(mapId, "lower", 1, 1, LAKE_AUTOTILE_TILE.BODY);

    const map = store.getCurrent().maps[mapId];
    expect(map.lowerTiles[1 * map.width + 1]).toBe(LAKE_AUTOTILE_TILE.BODY);
  });

  it("routes transparent props to the upper layer even when lower is requested", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    // 투명 배경 소품(나무 263, 표지판 319)은 하위에 깔리면 검게 보이므로 상위 전용 —
    // 하위 요청도 상위로 라우팅되어 지면을 보존한다.
    const propPlacements = [
      { tile: 263, x: 1, y: 1 },
      { tile: 319, x: 4, y: 1 },
    ] as const;

    for (const placement of propPlacements) {
      const tileIndex = placement.y * map.width + placement.x;
      expect(isHarnessStackableTile(project.tilesets[map.tilesetId], placement.tile)).toBe(true);
      const groundBefore = store.getCurrent().maps[mapId].lowerTiles[tileIndex];
      paintTile(mapId, "lower", placement.x, placement.y, placement.tile);

      const updated = store.getCurrent().maps[mapId];
      expect(updated.upperTiles[tileIndex]).toBe(placement.tile);
      expect(updated.lowerTiles[tileIndex]).toBe(groundBefore);
      expect(updated.upperTileStacks?.[tileIndex]).toBeUndefined();
    }
  });

  it("replaces mixed transparent prop objects on the selected upper layer", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    const tileIndex = 2 * map.width + 2;

    paintTile(mapId, "upper", 2, 2, 263);
    paintTile(mapId, "upper", 2, 2, 319);

    const updated = store.getCurrent().maps[mapId];
    expect(updated.upperTiles[tileIndex]).toBe(319);
    expect(updated.upperTileStacks?.[tileIndex]).toBeUndefined();
  });

  it("keeps a single upper tile when painting transparent props repeatedly", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    const tileIndex = 2 * map.width + 2;
    const groundBefore = map.lowerTiles[tileIndex];

    // 263/319는 투명 소품이라 요청 레이어와 무관하게 상위 단일 슬롯에 남는다(스택 없음).
    paintTile(mapId, "upper", 2, 2, 263);
    paintTile(mapId, "upper", 2, 2, 263);
    paintTile(mapId, "lower", 2, 2, 319); // 하위 요청도 상위로 라우팅 — 마지막 붓이 이긴다.
    paintTile(mapId, "lower", 2, 2, 319);

    const updated = store.getCurrent().maps[mapId];
    expect(updated.upperTiles[tileIndex]).toBe(319);
    expect(updated.lowerTiles[tileIndex]).toBe(groundBefore);
    expect(updated.upperTileStacks?.[tileIndex]).toBeUndefined();
    expect(updated.lowerTileStacks?.[tileIndex]).toBeUndefined();
  });

  it("routes windows and fences to the upper layer so the lower ground is preserved", () => {
    // Phase 0-5 회귀: 창문/울타리(하네스가 lower로 고정하는 stackable 소품)를 잔디 위에 칠해도
    // 단일 슬롯 lowerTiles를 덮어써 지면을 지우면 안 된다. 상위 레이어로 라우팅해 지면을 보존한다.
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    const windowIndex = 2 * map.width + 2;
    const fenceIndex = 2 * map.width + 3;

    paintTile(mapId, "lower", 2, 2, TILE.GRASS);
    paintTile(mapId, "lower", 3, 2, TILE.GRASS);
    paintTile(mapId, "upper", 2, 2, 85);
    paintTile(mapId, "upper", 3, 2, 378);

    const updated = store.getCurrent().maps[mapId];
    // 지면(잔디)은 lower에 보존된다.
    expect(updated.lowerTiles[windowIndex]).toBe(TILE.GRASS);
    expect(updated.lowerTiles[fenceIndex]).toBe(TILE.GRASS);
    // 창문/울타리는 상위 레이어 오버레이로 올라간다.
    expect(updated.upperTiles[windowIndex]).toBe(85);
    expect(updated.upperTiles[fenceIndex]).toBe(378);
    expect(updated.lowerTileStacks?.[windowIndex]).toBeUndefined();
    expect(updated.lowerTileStacks?.[fenceIndex]).toBeUndefined();
  });

  it("shapes painted road tiles with the bundled road autotile tool", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const rect: RoadRect = { x: 1, y: 1, width: 3, height: 3 };
    const map = store.getCurrent().maps[mapId];
    const expected = structuredClone(map);
    paintRoadRect(expected, rect);
    shapeRoadEdges(expected, [rect]);

    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        paintTile(mapId, "lower", x, y, DIRT_ROAD_TILE.BODY);
      }
    }

    const actual = store.getCurrent().maps[mapId];
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        const index = y * actual.width + x;
        expect(actual.lowerTiles[index]).toBe(expected.lowerTiles[index]);
      }
    }
  });

  it("keeps events inside the map when resizing smaller", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const eventId = addEvent(mapId, 10, 8);
    paintTile(mapId, "lower", 1, 1, 263);
    paintTile(mapId, "upper", 2, 2, 85);
    paintTile(mapId, "upper", 5, 5, 85);

    resizeMap(mapId, 4, 4);

    const resized = store.getCurrent().maps[mapId];
    const event = resized.events.find((item) => item.id === eventId);
    expect(event?.x).toBe(3);
    expect(event?.y).toBe(3);
    // 263(나무)은 투명 소품이라 lower 요청도 upper로 라우팅된다.
    expect(resized.upperTiles[1 * resized.width + 1]).toBe(263);
    // 85(창문)는 stackable+lower 소품이라 upper로 라우팅된다(지면 보존).
    expect(resized.upperTiles[2 * resized.width + 2]).toBe(85);
    expect(resized.lowerTileStacks?.[1 * resized.width + 1]).toBeUndefined();
    expect(resized.lowerTileStacks?.[2 * resized.width + 2]).toBeUndefined();
    expect(resized.upperTileStacks?.[5 * resized.width + 5]).toBeUndefined();
  });

  it("shifts map tile content and events by a signed offset", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const eventId = addEvent(mapId, 1, 1);

    paintTile(mapId, "lower", 1, 1, TILE.WATER);
    // WALL(306)은 하위 홈 타일이라 엄격 분류에서 상위에 놓이지 않는다.
    // 상위 레이어 시프트 검증에는 상위로 라우팅되는 소품 85(창문)를 쓴다.
    paintTile(mapId, "upper", 1, 1, 85);

    expect(shiftMapContent(mapId, { dx: 1, dy: 1 })).toBe(true);

    const shifted = store.getCurrent().maps[mapId];
    const edgeIndex = 0;
    const newIndex = 2 * shifted.width + 2;
    const event = shifted.events.find((item) => item.id === eventId);
    expect(shifted.lowerTiles[edgeIndex]).toBe(TILE.GRASS);
    expect(shifted.upperTiles[edgeIndex]).toBe(TILE.EMPTY);
    expect(shifted.lowerTiles[newIndex]).toBe(TILE.WATER);
    expect(shifted.upperTiles[newIndex]).toBe(85);
    expect(event?.x).toBe(2);
    expect(event?.y).toBe(2);
  });

  it("edits terrain tags and map tree parentage through store actions", () => {
    const project = store.getCurrent();
    const rootMapId = project.startMapId;
    const childMapId = addMap("Interior");
    const grandChildMapId = addMap("Basement");

    moveMapInTree(grandChildMapId, childMapId);
    setTerrainTag(DEFAULT_TILESET_ID, TILE.WATER, 7);

    const current = store.getCurrent();
    expect(current.mapTree.children.some((node) => node.mapId === childMapId)).toBe(true);
    const childNode = current.mapTree.children.find((node) => node.mapId === childMapId);
    expect(childNode?.children.some((node) => node.mapId === grandChildMapId)).toBe(true);
    expect(current.mapTree.mapId).toBe(rootMapId);
    expect(current.tilesets[DEFAULT_TILESET_ID].terrain[TILE.WATER]).toBe(7);
  });

  it("keeps the selected tile inside the current map chipset when changing map tilesets", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const interiorTilesetId = "easyrpg_chipset_interior";
    const interiorTileset = project.tilesets[interiorTilesetId];
    if (!interiorTileset) throw new Error("expected bundled interior chipset");
    editorState.set({
      activePaletteStamp: {
        cells: [{ dx: 0, dy: 0, layer: "lower", tile: interiorTileset.count + 12 }],
        height: 1,
        source: { endTile: interiorTileset.count + 12, startTile: interiorTileset.count + 12 },
        width: 1,
      },
      currentMapId: mapId,
      selectedTile: interiorTileset.count + 12,
    });

    setMapTileset(mapId, interiorTilesetId);

    expect(store.getCurrent().maps[mapId].tilesetId).toBe(interiorTilesetId);
    expect(editorState.get().selectedTile).toBe(0);
    expect(editorState.get().activePaletteStamp).toBeNull();
  });
});
