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

  it("writes transparent prop objects as a single lower-layer tile from lower mode", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    const propPlacements = [
      { tile: 263, x: 1, y: 1 },
      { tile: 378, x: 2, y: 1 },
      { tile: 85, x: 3, y: 1 },
      { tile: 319, x: 4, y: 1 },
    ] as const;

    for (const placement of propPlacements) {
      const tileIndex = placement.y * map.width + placement.x;
      expect(isHarnessStackableTile(project.tilesets[map.tilesetId], placement.tile)).toBe(true);
      paintTile(mapId, "lower", placement.x, placement.y, placement.tile);

      const updated = store.getCurrent().maps[mapId];
      expect(updated.lowerTiles[tileIndex]).toBe(placement.tile);
      expect(updated.upperTiles[tileIndex]).toBe(TILE.EMPTY);
      expect(updated.lowerTileStacks?.[tileIndex]).toBeUndefined();
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

  it("keeps one tile per layer when painting the same transparent tile repeatedly", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    const tileIndex = 2 * map.width + 2;

    paintTile(mapId, "upper", 2, 2, 263);
    paintTile(mapId, "upper", 2, 2, 263);
    paintTile(mapId, "lower", 2, 2, 85);
    paintTile(mapId, "lower", 2, 2, 85);

    const updated = store.getCurrent().maps[mapId];
    expect(updated.upperTiles[tileIndex]).toBe(263);
    expect(updated.lowerTiles[tileIndex]).toBe(85);
    expect(updated.upperTileStacks?.[tileIndex]).toBeUndefined();
    expect(updated.lowerTileStacks?.[tileIndex]).toBeUndefined();
  });

  it("forces windows and fences onto the lower harness layer even from upper mode", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    const windowIndex = 2 * map.width + 2;
    const fenceIndex = 2 * map.width + 3;

    paintTile(mapId, "upper", 2, 2, 85);
    paintTile(mapId, "upper", 3, 2, 378);

    const updated = store.getCurrent().maps[mapId];
    expect(updated.upperTiles[windowIndex]).toBe(TILE.EMPTY);
    expect(updated.upperTiles[fenceIndex]).toBe(TILE.EMPTY);
    expect(updated.lowerTiles[windowIndex]).toBe(85);
    expect(updated.lowerTiles[fenceIndex]).toBe(378);
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
    expect(resized.lowerTiles[1 * resized.width + 1]).toBe(263);
    expect(resized.lowerTiles[2 * resized.width + 2]).toBe(85);
    expect(resized.lowerTileStacks?.[1 * resized.width + 1]).toBeUndefined();
    expect(resized.lowerTileStacks?.[2 * resized.width + 2]).toBeUndefined();
    expect(resized.upperTileStacks?.[5 * resized.width + 5]).toBeUndefined();
  });

  it("shifts map tile content and events by a signed offset", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const eventId = addEvent(mapId, 1, 1);

    paintTile(mapId, "lower", 1, 1, TILE.WATER);
    paintTile(mapId, "upper", 1, 1, TILE.WALL);

    expect(shiftMapContent(mapId, { dx: 1, dy: 1 })).toBe(true);

    const shifted = store.getCurrent().maps[mapId];
    const edgeIndex = 0;
    const newIndex = 2 * shifted.width + 2;
    const event = shifted.events.find((item) => item.id === eventId);
    expect(shifted.lowerTiles[edgeIndex]).toBe(TILE.GRASS);
    expect(shifted.upperTiles[edgeIndex]).toBe(TILE.EMPTY);
    expect(shifted.lowerTiles[newIndex]).toBe(TILE.WATER);
    expect(shifted.upperTiles[newIndex]).toBe(TILE.WALL);
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
      activeStampId: "road-block",
      currentMapId: mapId,
      selectedTile: interiorTileset.count + 12,
    });

    setMapTileset(mapId, interiorTilesetId);

    expect(store.getCurrent().maps[mapId].tilesetId).toBe(interiorTilesetId);
    expect(editorState.get().selectedTile).toBe(0);
    expect(editorState.get().activeStampId).toBeNull();
    expect(editorState.get().activePaletteStamp).toBeNull();
  });
});
