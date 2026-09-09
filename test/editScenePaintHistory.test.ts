import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { paintTile } from "@/editor/actions";
import {
  getMapEditHistoryDebugEntries,
  resetMapEditHistory,
  undoMapEdit,
  redoMapEdit,
  getMapEditHistoryState,
} from "@/editor/mapEditHistory";
import { createBlankProject, TILE } from "@/project/defaults";
import { store } from "@/project/store";
import type { MapId } from "@/project/types";

type EditSceneHarness = {
  applyAtPointer(ptr: unknown): void;
  cameras: { main: object };
  isPainting: boolean;
  lastPaintKey: string;
};

const TILE_SIZE = 16;
let EditSceneCtor: { readonly prototype: object };

beforeAll(async () => {
  vi.stubGlobal("window", {
    Phaser: { Scene: class Scene {} },
    location: { search: "" },
  });
  vi.stubGlobal("document", { querySelector: () => null });
  vi.stubGlobal("MouseEvent", class MouseEvent {});
  vi.stubGlobal("PointerEvent", class PointerEvent {});

  const { EditScene } = await import("@/editor/EditScene");
  EditSceneCtor = EditScene;
}, 90_000);

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  store.replace(createBlankProject());
  resetMapEditHistory();
  editorState.set({
    activePaletteStamp: null,
    autoConnectMode: true,
    brushSize: 1,
    currentMapId: store.getCurrent().startMapId,
    layer: "lower",
    selectedTile: TILE.WATER,
    paintShape: "pen",
    tool: "paint",
  });
});

function createEditSceneHarness(): EditSceneHarness {
  return Object.assign(Object.create(EditSceneCtor.prototype), {
    cameras: { main: {} },
    isPainting: false,
    lastPaintKey: "",
  }) as EditSceneHarness;
}

function pointerAt(x: number, y: number): unknown {
  return {
    event: {},
    positionToCamera: () => ({
      x: x * TILE_SIZE + 1,
      y: y * TILE_SIZE + 1,
    }),
  };
}

function historyKinds(): readonly { readonly kind: string; readonly mapId: string | null }[] {
  return getMapEditHistoryDebugEntries().map((entry) => ({ kind: entry.kind, mapId: entry.mapId }));
}

describe("EditScene reliable brush", () => {
  function seedTiles(lower: number): MapId {
    const mapId = store.getCurrent().startMapId;
    store.updateMap(mapId, (map) => {
      map.lowerTiles.fill(lower);
      map.upperTiles.fill(TILE.EMPTY);
    });
    editorState.set({ autoConnectMode: false });
    return mapId;
  }

  it.each([1, 2, 3, 4])("paints and erases exactly a negative-anchored size %i footprint", (size) => {
    const mapId = seedTiles(TILE.EMPTY);
    const scene = createEditSceneHarness();
    editorState.set({ brushSize: size, selectedTile: TILE.GRASS });
    scene.applyAtPointer(pointerAt(6, 6));
    const map = store.getCurrent().maps[mapId];
    const expected = new Set<number>();
    const start = 6 - Math.floor(size / 2);
    for (let y = start; y < start + size; y++) {
      for (let x = start; x < start + size; x++) expected.add(y * map.width + x);
    }
    expect(map.lowerTiles.flatMap((tile, index) => tile === TILE.GRASS ? [index] : [])).toEqual([...expected]);
    store.updateMap(mapId, (draft) => draft.lowerTiles.fill(TILE.GRASS));
    scene.lastPaintKey = "";
    editorState.set({ tool: "erase" });
    scene.applyAtPointer(pointerAt(6, 6));
    expect(store.getCurrent().maps[mapId].lowerTiles.flatMap((tile, index) => tile === TILE.EMPTY ? [index] : [])).toEqual([...expected]);
  });

  it.each([
    { start: [1, 3], end: [13, 3], count: 13 },
    { start: [13, 3], end: [1, 3], count: 13 },
    { start: [1, 1], end: [13, 13], count: 13 },
    { start: [13, 13], end: [1, 1], count: 13 },
    { start: [-3, 3], end: [13, 3], count: 14 },
    { start: [13, 3], end: [-3, 3], count: 14 },
    { start: [13, 13], end: [22, 22], count: 2 },
    { start: [22, 22], end: [13, 13], count: 2 },
  ])("rasterizes sparse paint/erase $start -> $end as one undo", ({ start, end, count }) => {
    const mapId = seedTiles(TILE.EMPTY);
    const scene = createEditSceneHarness();
    editorState.set({ selectedTile: TILE.GRASS });
    const before = [...store.getCurrent().maps[mapId].lowerTiles];
    scene.applyAtPointer(pointerAt(start[0], start[1]));
    scene.applyAtPointer(pointerAt(end[0], end[1]));
    const painted = store.getCurrent().maps[mapId].lowerTiles;
    expect(painted.filter((tile) => tile === TILE.GRASS)).toHaveLength(count);
    const map = store.getCurrent().maps[mapId];
    const expectedIndices = Array.from({ length: count }, (_, index) => {
      const x = Math.max(0, Math.min(start[0], end[0])) + index;
      const y = start[1] === end[1] ? start[1] : x;
      return y * map.width + x;
    });
    expect(painted.flatMap((tile, index) => tile === TILE.GRASS ? [index] : [])).toEqual(expectedIndices);
    expect(historyKinds()).toEqual([{ kind: "map", mapId }]);
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().maps[mapId].lowerTiles).toEqual(before);
    expect(redoMapEdit()).toBe(true);
    expect(store.getCurrent().maps[mapId].lowerTiles).toEqual(painted);
    scene.lastPaintKey = "";
    editorState.set({ tool: "erase" });
    scene.applyAtPointer(pointerAt(start[0], start[1]));
    scene.applyAtPointer(pointerAt(end[0], end[1]));
    expect(store.getCurrent().maps[mapId].lowerTiles).toEqual(before);
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().maps[mapId].lowerTiles).toEqual(painted);
  });

  it.each(["paint", "fill", "erase"] as const)("preserves redo and undo after no-op %s", (tool) => {
    const mapId = seedTiles(TILE.EMPTY);
    const scene = createEditSceneHarness();
    editorState.set({ selectedTile: TILE.GRASS });
    scene.applyAtPointer(pointerAt(2, 2));
    const edited = [...store.getCurrent().maps[mapId].lowerTiles];
    expect(undoMapEdit()).toBe(true);
    scene.lastPaintKey = "";
    editorState.set({ tool, layer: "upper", selectedTile: TILE.EMPTY });
    scene.applyAtPointer(pointerAt(4, 4));
    expect(getMapEditHistoryState()).toEqual({ canUndo: false, canRedo: true });
    expect(redoMapEdit()).toBe(true);
    expect(store.getCurrent().maps[mapId].lowerTiles).toEqual(edited);
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().maps[mapId].lowerTiles.every((tile) => tile === TILE.EMPTY)).toBe(true);
  });

  it.each(["paint", "fill"] as const)("preserves both stacks when %s repeats an existing nonempty lower tile", (tool) => {
    const mapId = seedTiles(TILE.GRASS);
    const scene = createEditSceneHarness();
    editorState.set({ selectedTile: TILE.WATER });
    scene.applyAtPointer(pointerAt(2, 2));
    const firstEdit = structuredClone(store.getCurrent().maps[mapId]);
    scene.lastPaintKey = "";
    scene.applyAtPointer(pointerAt(3, 3));
    const secondEdit = structuredClone(store.getCurrent().maps[mapId]);
    expect(undoMapEdit()).toBe(true);
    scene.lastPaintKey = "";
    editorState.set({ selectedTile: TILE.GRASS, tool });
    scene.applyAtPointer(pointerAt(8, 8));
    expect(getMapEditHistoryState()).toEqual({ canUndo: true, canRedo: true });
    expect(store.getCurrent().maps[mapId]).toEqual(firstEdit);
    expect(redoMapEdit()).toBe(true);
    expect(store.getCurrent().maps[mapId]).toEqual(secondEdit);
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().maps[mapId]).toEqual(firstEdit);
  });

  it("records a stroke whose first cell is a no-op at its first real mutation", () => {
    const mapId = seedTiles(TILE.GRASS);
    store.updateMap(mapId, (map) => { map.lowerTiles[3 * map.width + 5] = TILE.EMPTY; });
    const before = [...store.getCurrent().maps[mapId].lowerTiles];
    editorState.set({ selectedTile: TILE.GRASS });
    const scene = createEditSceneHarness();
    scene.applyAtPointer(pointerAt(1, 3));
    expect(historyKinds()).toEqual([]);
    scene.applyAtPointer(pointerAt(8, 3));
    expect(store.getCurrent().maps[mapId].lowerTiles.every((tile) => tile === TILE.GRASS)).toBe(true);
    expect(historyKinds()).toEqual([{ kind: "map", mapId }]);
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().maps[mapId].lowerTiles).toEqual(before);
  });

  it("does not interpolate collision or stamp gestures", () => {
    const mapId = seedTiles(TILE.GRASS);
    const tilesetId = store.getCurrent().maps[mapId].tilesetId;
    const before = structuredClone(store.getCurrent().tilesets[tilesetId].passability[TILE.GRASS]);
    const scene = createEditSceneHarness();
    editorState.set({ tool: "collision" });
    scene.applyAtPointer(pointerAt(1, 3));
    scene.applyAtPointer(pointerAt(13, 3));
    expect(store.getCurrent().tilesets[tilesetId].passability[TILE.GRASS]).toEqual(before);
    scene.lastPaintKey = "";
    editorState.set({ tool: "paint", activePaletteStamp: {
      width: 1, height: 1, cells: [{ dx: 0, dy: 0, layer: "upper", tile: TILE.FLOWERS }],
      source: { startTile: TILE.FLOWERS, endTile: TILE.FLOWERS },
    } });
    scene.applyAtPointer(pointerAt(1, 3));
    scene.applyAtPointer(pointerAt(13, 3));
    expect(store.getCurrent().maps[mapId].upperTiles.filter((tile) => tile === TILE.FLOWERS)).toHaveLength(2);
  });
});

describe("EditScene paint undo history", () => {
  it.each([
    { tool: "paint", setup: (_mapId: MapId) => {} },
    { tool: "fill", setup: (_mapId: MapId) => {} },
    {
      tool: "erase",
      setup: (mapId: MapId) => {
        paintTile(mapId, "lower", 2, 2, TILE.WATER);
        resetMapEditHistory();
      },
    },
    {
      tool: "collision",
      setup: (mapId: MapId) => {
        paintTile(mapId, "lower", 2, 2, TILE.GRASS);
        resetMapEditHistory();
      },
    },
  ] as const)("records $tool canvas edits as map-kind snapshots", async ({ tool, setup }) => {
    const mapId = store.getCurrent().startMapId;
    setup(mapId);
    editorState.set({ currentMapId: mapId, tool });
    const scene = createEditSceneHarness();

    scene.applyAtPointer(pointerAt(2, 2));

    expect(historyKinds()).toEqual([{ kind: "map", mapId }]);
  });

  it("restores a brush stroke through map-kind undo", async () => {
    const mapId = store.getCurrent().startMapId;
    const scene = createEditSceneHarness();
    const before = [...store.getCurrent().maps[mapId].lowerTiles];

    scene.applyAtPointer(pointerAt(2, 2));
    expect(historyKinds()).toEqual([{ kind: "map", mapId }]);

    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().maps[mapId].lowerTiles).toEqual(before);
  });

  it("restores collision paint through map-kind undo", async () => {
    const mapId = store.getCurrent().startMapId;
    paintTile(mapId, "lower", 2, 2, TILE.GRASS);
    resetMapEditHistory();
    editorState.set({ currentMapId: mapId, tool: "collision" });
    const scene = createEditSceneHarness();
    const tilesetId = store.getCurrent().maps[mapId].tilesetId;
    const before = { ...store.getCurrent().tilesets[tilesetId].passability[TILE.GRASS] };

    scene.applyAtPointer(pointerAt(2, 2));
    expect(historyKinds()).toEqual([{ kind: "map", mapId }]);
    expect(store.getCurrent().tilesets[tilesetId].passability[TILE.GRASS]).not.toEqual(before);

    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().tilesets[tilesetId].passability[TILE.GRASS]).toEqual(before);
  });
});
