/** @vitest-environment happy-dom */
import "./happyDomCanvas";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { GameMap } from "@/project/types";

const drawMapTileLayers = vi.fn();
vi.mock("@/editor/mapTileDraw", () => ({
  drawMapTileLayers,
  loadTilesetImage: () => Promise.resolve({ complete: true, naturalWidth: 16, naturalHeight: 16 }),
}));

const { createMapThumbnail } = await import("@/editor/panels/mapThumbnail");

const MAP_COUNT = 200;

async function settle(): Promise<void> {
  for (let round = 0; round < 3 * MAP_COUNT; round += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("map thumbnail cache", () => {
  beforeEach(() => {
    const project = createBlankProject();
    const template = project.maps[project.startMapId]!;
    const maps: Record<string, GameMap> = {};
    for (let index = 0; index < MAP_COUNT; index += 1) {
      const id = `thumb_map_${index}`;
      const lowerTiles = template.lowerTiles.slice();
      lowerTiles[0] = index;
      maps[id] = { ...template, id, name: id, lowerTiles };
    }
    store.replace({ ...project, maps });
    drawMapTileLayers.mockClear();
  });

  it("keeps every row thumbnail of a 200-map project, so a second map-list render redraws none", async () => {
    const ids = Object.keys(store.getCurrent().maps);
    for (const id of ids) createMapThumbnail(id);
    await settle();
    expect(drawMapTileLayers).toHaveBeenCalledTimes(MAP_COUNT);

    for (const id of ids) createMapThumbnail(id);
    await settle();
    expect(drawMapTileLayers).toHaveBeenCalledTimes(MAP_COUNT);
  });
});
