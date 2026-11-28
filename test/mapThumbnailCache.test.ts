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

  it("does not paint a late render for map A onto a same-testid canvas that now shows map B", async () => {
    const [a, b] = ["thumb_map_1", "thumb_map_2"];
    // B is already cached, so its canvas is painted synchronously.
    createMapThumbnail(b, { testId: "shared-stage" });
    await settle();

    // Give A content no earlier test cached, so its render is still pending when B takes over.
    const project = store.getCurrent();
    const lowerTiles = project.maps[a]!.lowerTiles.slice();
    lowerTiles[1] = 9999;
    store.replace({ ...project, maps: { ...project.maps, [a]: { ...project.maps[a]!, lowerTiles } } });

    const stale = createMapThumbnail(a, { testId: "shared-stage" });
    expect(stale.dataset.thumbState).toBe("fallback");
    document.body.append(stale);
    stale.remove();
    const current = createMapThumbnail(b, { testId: "shared-stage" }) as HTMLCanvasElement;
    document.body.append(current);
    const painted = vi.fn();
    const getContext = current.getContext.bind(current);
    current.getContext = ((...args: Parameters<HTMLCanvasElement["getContext"]>) => {
      painted();
      return getContext(...args);
    }) as HTMLCanvasElement["getContext"];
    await settle();

    expect(current.dataset.thumbKey?.startsWith(`${b}:`)).toBe(true);
    expect(painted).not.toHaveBeenCalled();
    current.remove();
  });
});
