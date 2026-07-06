import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { paintTile } from "@/editor/actions";
import {
  getMapEditHistoryDebugEntries,
  resetMapEditHistory,
  undoMapEdit,
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
}, 30_000);

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  store.replace(createBlankProject());
  resetMapEditHistory();
  editorState.set({
    activePaletteStamp: null,
    activeStampId: null,
    activeStructureStampId: null,
    autoConnectMode: true,
    brushSize: 1,
    currentMapId: store.getCurrent().startMapId,
    layer: "lower",
    selectedTile: TILE.WATER,
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
