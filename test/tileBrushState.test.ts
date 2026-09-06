/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { handleEditorKey } from "@/editor/hotkeys";
import { makeStructureKitShelf } from "@/editor/harnessSuggestion/structureKitShelf";
import { TilePaintEngine, type TilePaintEngineDeps } from "@/editor/TilePaintEngine";
import { DragOperationHandler } from "@/editor/DragOperationHandler";
import { renderHoverTilePreview } from "@/editor/editSceneHoverPreview";
import { createChipsetTileObject } from "@/editor/chipsetTileRender";
import { getMapEditHistoryState, recordProjectSnapshot, redoMapEdit, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { createBlankProject, TILE } from "@/project/defaults";
import { store } from "@/project/store";
import type { PaletteStamp } from "@/editor/tilePaletteStamp";

// Only graphics creation is replaced; real shelf clicks, drag routing, engine,
// tile mutation and editor state stay connected.
vi.mock("@/editor/chipsetTileRender", () => ({
  createChipsetTileObject: vi.fn(() => ({ setAlpha: vi.fn() })),
}));
vi.mock("@/editor/harnessSuggestion/kitRender", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/editor/harnessSuggestion/kitRender")>(),
  renderTileCellsToCanvas: () => document.createElement("canvas"),
}));

const stamp: PaletteStamp = {
  width: 1, height: 1,
  cells: [{ dx: 0, dy: 0, layer: "lower", tile: TILE.GRASS }],
  source: { startTile: TILE.GRASS, endTile: TILE.GRASS },
};

function harness() {
  const paintState = { isPainting: false, lastPaintKey: "" };
  const deps: TilePaintEngineDeps = {
    mapId: () => store.getCurrent().startMapId,
    pointerToTile: (ptr) => ({ x: ptr.x, y: ptr.y }),
    updatePointerStatus: () => {}, eventLayerClickCount: () => 1, pointerClickCount: () => 1,
    offerEventLayerSwitchAt: () => false, showEventLayerClickFeedback: () => {},
    openExistingEventAt: () => false, handleEventClick: () => {},
    tilesetForMap: (mapId) => {
      const project = store.getCurrent();
      return project.tilesets[project.maps[mapId].tilesetId];
    },
    setLastPointerTile: () => {}, getPaintState: () => paintState,
    setPaintState: (state) => Object.assign(paintState, state),
  };
  const engine = new TilePaintEngine(deps);
  const drag = new DragOperationHandler({} as never, {
    ...deps, hoverPreviewLayer: () => null, clearHoverPreview: () => {},
  });
  return { engine, drag };
}

beforeEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
  store.replace(createBlankProject());
  resetMapEditHistory();
  editorState.set({ tool: "paint", layer: "lower", paintShape: "pen", brushSize: 1,
    selectedTile: TILE.GRASS, activePaletteStamp: null, autoConnectMode: false });
});

describe("brush selection routes", () => {
  it("preserves source variants when placing a multi-cell custom atlas stamp", () => {
    const project = store.getCurrent();
    const map = project.maps[project.startMapId];
    const tileset = project.tilesets[map.tilesetId];
    tileset.kind = "custom";
    for (const tile of [7, 8, 37, 38]) tileset.priority[tile] = "lower";
    editorState.set({ activePaletteStamp: {
      width: 2, height: 2, source: { startTile: 7, endTile: 38 },
      cells: [
        { dx: 0, dy: 0, layer: "lower", tile: 7 },
        { dx: 1, dy: 0, layer: "lower", tile: 8 },
        { dx: 0, dy: 1, layer: "lower", tile: 37 },
        { dx: 1, dy: 1, layer: "lower", tile: 38 },
      ],
    } });
    harness().engine.applyAtPointer({ x: 5, y: 5 } as never);
    const after = store.getCurrent().maps[map.id];
    expect([
      after.lowerTiles[5 * map.width + 5], after.lowerTiles[5 * map.width + 6],
      after.lowerTiles[6 * map.width + 5], after.lowerTiles[6 * map.width + 6],
    ]).toEqual([7, 8, 37, 38]);
  });

  it.each(["rect", "round"] as const)("preserves redo after a no-op shape %s click", (shape) => {
    const mapId = store.getCurrent().startMapId;
    recordProjectSnapshot(undefined, mapId, { kind: "map" });
    store.updateMap(mapId, (map) => { map.lowerTiles[0] = TILE.WATER; });
    const edited = structuredClone(store.getCurrent().maps[mapId]);
    expect(undoMapEdit()).toBe(true);
    editorState.set({ paintShape: shape, selectedTile: TILE.GRASS });
    const { drag } = harness();
    const pointer = { x: 5, y: 5 } as never;
    expect(drag.begin(pointer)).toBe(true);
    drag.finish(pointer);
    expect(getMapEditHistoryState()).toEqual({ canUndo: false, canRedo: true });
    expect(redoMapEdit()).toBe(true);
    expect(store.getCurrent().maps[mapId]).toEqual(edited);
  });

  it.each(["rect", "round"] as const)("selecting a kit after %s places the kit, not the previous tile", (shape) => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const tileset = project.tilesets[project.maps[mapId].tilesetId];
    tileset.structureKits = [{ id: "brush-kit", kind: "section", name: "Kit", width: 1, height: 2,
      rows: [{ tiles: [21] }, { tiles: [51] }], learnedFrom: "db-authored" }];
    editorState.set({ paintShape: shape });
    const shelf = makeStructureKitShelf({ tileset, activeKitId: null, rerender: () => {} });
    const button = shelf?.querySelector<HTMLButtonElement>("button");
    expect(button).toBeTruthy();
    button?.click();
    const { engine, drag } = harness();
    const pointer = { x: 5, y: 5 } as never;
    // This is the same shape-before-paint dispatch used by EditScene.pointerdown.
    if (drag.begin(pointer)) drag.finish(pointer);
    else engine.applyAtPointer(pointer);
    const map = store.getCurrent().maps[mapId];
    expect(map.lowerTiles[6 * map.width + 5]).toBe(51);
    expect(editorState.get().paintShape).toBe("pen");
  });

  it.each(["b", "B", "1"])("%s switches a stamp back to the plain pen brush", (key) => {
    editorState.set({ tool: "paint", paintShape: "round", activePaletteStamp: stamp });
    expect(handleEditorKey(new KeyboardEvent("keydown", { key }))).toBe(true);
    expect(editorState.get()).toMatchObject({ tool: "paint", paintShape: "pen", activePaletteStamp: null });
  });

  it.each([
    { layer: "lower", upper: TILE.FLOWERS, expectedTile: TILE.FLOWERS, expectedLayer: "upper" },
    { layer: "lower", upper: TILE.EMPTY, expectedTile: TILE.GRASS, expectedLayer: "lower" },
    { layer: "upper", upper: TILE.FLOWERS, expectedTile: TILE.FLOWERS, expectedLayer: "upper" },
    { layer: "upper", upper: TILE.EMPTY, expectedTile: TILE.EMPTY, expectedLayer: "upper" },
  ] as const)("toolbar and right-click share $layer sampling with upper $upper", ({ layer, upper, expectedTile, expectedLayer }) => {
    const project = store.getCurrent();
    const map = project.maps[project.startMapId];
    map.lowerTiles[0] = TILE.GRASS;
    map.upperTiles[0] = upper;
    for (const gesture of ["toolbar", "right-click"]) {
      editorState.set({ tool: "eyedropper", layer, paintShape: "rect", activePaletteStamp: stamp });
      const { engine } = harness();
      if (gesture === "toolbar") engine.applyAtPointer({ x: 0, y: 0 } as never);
      else engine.pickTileAtPointer({ x: 0, y: 0 } as never);
      expect(editorState.get()).toMatchObject({ selectedTile: expectedTile, layer: expectedLayer,
        tool: "paint", paintShape: "pen", activePaletteStamp: null });
    }
  });

  it("keeps explicit layer picking distinct from visible picking", () => {
    const project = store.getCurrent();
    const map = project.maps[project.startMapId];
    map.lowerTiles[0] = TILE.GRASS;
    map.upperTiles[0] = TILE.FLOWERS;
    harness().engine.pickTileAt({ mapId: map.id, x: 0, y: 0, layer: "lower" });
    expect(editorState.get()).toMatchObject({ selectedTile: TILE.GRASS, layer: "lower" });
  });
});

describe("brush hover footprints", () => {
  it.each([1, 2, 3, 4] as const)("previews exactly size %i for paint, erase and upper blank brushes, including clipped edges", (size) => {
    const project = store.getCurrent();
    for (const center of [6, 0]) {
      for (const tool of ["paint", "erase", "blank"] as const) {
        const rectangles: number[][] = [];
        editorState.set({ brushSize: size, tool: tool === "erase" ? "erase" : "paint",
          selectedTile: tool === "blank" ? TILE.EMPTY : TILE.GRASS, layer: tool === "blank" ? "upper" : "lower" });
        const scene = { add: { rectangle: (x: number, y: number) => {
          rectangles.push([x / 16, y / 16]);
          return { setOrigin: () => {}, setStrokeStyle: () => {} };
        } } };
        vi.mocked(createChipsetTileObject).mockClear();
        renderHoverTilePreview({ centerX: center, centerY: center, mapId: project.startMapId,
          scene: scene as never, layer: { removeAll: () => {}, add: () => {} } as never });
        const expected: number[][] = [];
        const start = center - Math.floor(size / 2);
        for (let y = Math.max(0, start); y < start + size; y++) {
          for (let x = Math.max(0, start); x < start + size; x++) expected.push([x, y]);
        }
        expect(rectangles).toEqual(expected);
        expect(createChipsetTileObject).toHaveBeenCalledTimes(tool === "paint" ? expected.length : 0);
      }
    }
  });
});
