import { beforeEach, describe, expect, it } from "vitest";

import { editorState } from "@/editor/editorState";
import { paintTile } from "@/editor/tileActions";
import { TilePaintEngine, type TilePaintEngineDeps } from "@/editor/TilePaintEngine";
import { createBlankProject, TILE } from "@/project/defaults";
import { store } from "@/project/store";
import type { GameMap, MapId, TilesetDef } from "@/project/types";

function currentMap(mapId: MapId): GameMap {
  return store.getCurrent().maps[mapId]!;
}

function tileAt(map: GameMap, layer: "lower" | "upper", x: number, y: number): number {
  const index = y * map.width + x;
  return (layer === "upper" ? map.upperTiles[index] : map.lowerTiles[index])!;
}

function createPaintEngine(mapId: MapId, tileset: TilesetDef): TilePaintEngine {
  const paintState = { isPainting: false, lastPaintKey: "" };
  const deps: TilePaintEngineDeps = {
    mapId: () => mapId,
    pointerToTile: (ptr) => ptr as unknown as { x: number; y: number },
    updatePointerStatus: () => {},
    eventLayerClickCount: () => 1,
    pointerClickCount: () => 1,
    offerEventLayerSwitchAt: () => false,
    showEventLayerClickFeedback: () => {},
    openExistingEventAt: () => false,
    handleEventClick: () => {},
    tilesetForMap: () => tileset,
    setLastPointerTile: () => {},
    getPaintState: () => ({ isPainting: paintState.isPainting, lastPaintKey: paintState.lastPaintKey }),
    setPaintState: (state) => {
      if (state.isPainting !== undefined) paintState.isPainting = state.isPainting;
      if (state.lastPaintKey !== undefined) paintState.lastPaintKey = state.lastPaintKey;
    },
  };
  return new TilePaintEngine(deps);
}

beforeEach(() => {
  store.replace(createBlankProject());
  editorState.set({
    activePaletteStamp: null,
    brushSize: 1,
    layer: "upper",
    selectedTile: TILE.PATH,
    tool: "paint",
  });
});

describe("덧그림 공백 스포이트", () => {
  it("덧그림 빈 칸을 우클릭하면 공백을 집어 레이어를 유지한다", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const map = currentMap(mapId);
    map.lowerTiles[0] = TILE.GRASS;
    map.upperTiles[0] = TILE.EMPTY;
    const engine = createPaintEngine(mapId, project.tilesets[map.tilesetId]!);

    engine.pickVisibleTileAt(mapId, 0, 0);

    expect(editorState.get().selectedTile).toBe(TILE.EMPTY);
    expect(editorState.get().layer).toBe("upper");
    expect(editorState.get().tool).toBe("paint");
  });

  it("바닥 레이어 우클릭은 보이는 타일(빈 덧그림이면 바닥)을 집는다", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const map = currentMap(mapId);
    map.lowerTiles[0] = TILE.GRASS;
    map.upperTiles[0] = TILE.EMPTY;
    editorState.set({ layer: "lower", selectedTile: TILE.PATH });
    const engine = createPaintEngine(mapId, project.tilesets[map.tilesetId]!);

    engine.pickVisibleTileAt(mapId, 0, 0);

    expect(editorState.get().selectedTile).toBe(TILE.GRASS);
    expect(editorState.get().layer).toBe("lower");
  });

  it("집은 공백으로 칠하면 덧그림을 지우고 바닥은 남긴다", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const map = currentMap(mapId);
    const tileset = project.tilesets[map.tilesetId]!;
    paintTile(mapId, "lower", 2, 2, TILE.WATER);
    paintTile(mapId, "upper", 2, 2, TILE.FLOWERS);
    editorState.set({
      activePaletteStamp: null,
      brushSize: 1,
      currentMapId: mapId,
      layer: "upper",
      selectedTile: TILE.EMPTY,
      tool: "paint",
    });
    const engine = createPaintEngine(mapId, tileset);

    engine.applyAtPointer({ x: 2, y: 2 } as never);

    expect(tileAt(currentMap(mapId), "upper", 2, 2)).toBe(TILE.EMPTY);
    expect(tileAt(currentMap(mapId), "lower", 2, 2)).toBe(TILE.WATER);
  });

  it("집기 도구로 덧그림 빈 칸을 찍어도 공백을 집는다", () => {
    const project = store.getCurrent();
    const mapId = project.startMapId;
    const map = currentMap(mapId);
    map.lowerTiles[1] = TILE.GRASS;
    map.upperTiles[1] = TILE.EMPTY;
    editorState.set({ layer: "upper", tool: "eyedropper", selectedTile: TILE.FLOWERS });
    const engine = createPaintEngine(mapId, project.tilesets[map.tilesetId]!);

    engine.applyAtPointer({ x: 1, y: 0 } as never);

    expect(editorState.get().selectedTile).toBe(TILE.EMPTY);
    expect(editorState.get().layer).toBe("upper");
    expect(editorState.get().tool).toBe("paint");
  });
});
