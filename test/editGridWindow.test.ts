import { describe, expect, it } from "vitest";
import type Phaser from "phaser";
import { EDIT_TILE_CHUNK_TILES, editGridTileWindow } from "@/editor/editSceneRender";
import { repaintEditGrid } from "@/editor/editSceneViewChrome";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

type Segment = { x0: number; y0: number; x1: number; y1: number };

function recordingGraphics() {
  const segments: Segment[] = [];
  let from: { x: number; y: number } | null = null;
  let clears = 0;
  const graphics = {
    clear: () => { clears += 1; segments.length = 0; return graphics; },
    lineStyle: () => graphics,
    moveTo: (x: number, y: number) => { from = { x, y }; return graphics; },
    lineTo: (x: number, y: number) => {
      if (from) segments.push({ x0: from.x, y0: from.y, x1: x, y1: y });
      return graphics;
    },
    strokePath: () => graphics,
  };
  return { graphics: graphics as unknown as Phaser.GameObjects.Graphics, segments, clears: () => clears };
}

function largeMap() {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  map.width = 128;
  map.height = 96;
  map.lowerTiles = new Array<number>(128 * 96).fill(-1);
  map.upperTiles = new Array<number>(128 * 96).fill(-1);
  store.replace(project);
  return store.getCurrent().maps[project.startMapId];
}

function sceneWithView(view: { x: number; y: number; width: number; height: number }): Phaser.Scene {
  return { cameras: { main: { worldView: view } } } as unknown as Phaser.Scene;
}

describe("edit grid window", () => {
  it("draws the whole map without a window", () => {
    const map = largeMap();
    const { graphics, segments } = recordingGraphics();
    repaintEditGrid(graphics, map, "lower", true);
    expect(segments).toHaveLength(map.width + 1 + map.height + 1);
  });

  it("clips lines to the chunk-aligned camera window", () => {
    const map = largeMap();
    const tileSize = map.tileSize;
    const view = { x: tileSize * 40, y: tileSize * 30, width: tileSize * 20, height: tileSize * 15 };
    const window = editGridTileWindow(sceneWithView(view), map);
    expect(window.minX % EDIT_TILE_CHUNK_TILES).toBe(0);
    expect(window.minY % EDIT_TILE_CHUNK_TILES).toBe(0);
    expect(window.minX).toBeLessThanOrEqual(40 - 2);
    expect(window.maxX).toBeGreaterThanOrEqual(60 + 2);
    expect(window.maxX).toBeLessThan(map.width - 1);

    const { graphics, segments } = recordingGraphics();
    repaintEditGrid(graphics, map, "lower", true, window);
    expect(segments.length).toBeLessThan(map.width + map.height);
    const vertical = segments.filter((segment) => segment.x0 === segment.x1);
    expect(vertical).toHaveLength(window.maxX - window.minX + 2);
    for (const segment of vertical) {
      expect(segment.y0).toBe(window.minY * tileSize);
      expect(segment.y1).toBe((window.maxY + 1) * tileSize);
    }
  });

  it("stays put while the camera pans within a chunk", () => {
    const map = largeMap();
    const tileSize = map.tileSize;
    const view = { x: tileSize * 40, y: tileSize * 30, width: tileSize * 20, height: tileSize * 15 };
    const scene = sceneWithView(view);
    const before = editGridTileWindow(scene, map);
    view.x += tileSize;
    expect(editGridTileWindow(scene, map)).toEqual(before);
  });

  it("falls back to the whole map when the camera is unknown", () => {
    const map = largeMap();
    expect(editGridTileWindow({} as Phaser.Scene, map)).toEqual({ minX: 0, minY: 0, maxX: map.width - 1, maxY: map.height - 1 });
  });

  it("clears without drawing when the grid is hidden", () => {
    const map = largeMap();
    const { graphics, segments, clears } = recordingGraphics();
    repaintEditGrid(graphics, map, "lower", false, { minX: 0, minY: 0, maxX: 10, maxY: 10 });
    expect(clears()).toBe(1);
    expect(segments).toHaveLength(0);
  });
});
