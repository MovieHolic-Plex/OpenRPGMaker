import { afterEach, describe, expect, it } from "vitest";
import { clearToolImageEventSpriteCache } from "@/ai/toolImageEventSprites";
import { renderToolImages, type RenderedToolImage } from "@/ai/toolImageRenderer";
import { renderHarmonyMapImages } from "@/ai/ultrabrainImage";
import { charsetGraphic } from "@/editor/tools/eventCompile";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import type { EventPage, EventPageGraphic, GameEvent, GameMap, Project } from "@/project/types";
import {
  decodeDataUrlPng,
  installToolImageRasterDom,
  pixelDiffRatio,
  type PngRaster,
} from "./toolImageRasterDom";

let restoreDom: (() => void) | null = null;

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  clearToolImageEventSpriteCache();
});

describe("show_map_region event depiction", () => {
  it("Ultrabrain preserves whole-map detail and events at the far edge within its image budget", async () => {
    restoreDom = installToolImageRasterDom();
    const project = seededProject(), map = requireMap(project);
    map.width = 100; map.height = 80;
    map.lowerTiles = Array(8000).fill(0); map.upperTiles = Array(8000).fill(-1);
    placeNpc(map, multiPageEvent("edge", 99, 79, [pageGraphic("p0", charsetGraphic("tex_easyrpg_charset_people1", 0))]));
    const before = (await renderHarmonyMapImages(project, map))[0]!;
    const raster = decodeDataUrlPng(before.dataUrl);
    expect(raster.width).toBeGreaterThan(1000);
    expect(raster.width).toBeLessThanOrEqual(1536);
    expect(raster.height / raster.width).toBeCloseTo(0.8);
    requireEvent(map, "edge").x = 97;
    const after = (await renderHarmonyMapImages(project, map))[0]!;
    expect(after.dataUrl).not.toBe(before.dataUrl);
  });
  it("changes pixels when a charset event moves inside the region", async () => {
    restoreDom = installToolImageRasterDom();
    const project = seededProject();
    const map = requireMap(project);
    placeNpc(map, multiPageEvent("ev_move", 2, 2, [
      pageGraphic("p0", charsetGraphic("tex_easyrpg_charset_people1", 0)),
    ]));

    const before = await renderRegion(project, map.id);
    const event = requireEvent(map, "ev_move");
    event.x = 7;
    event.y = 4;
    const after = await renderRegion(project, map.id);

    expect(before.dataUrl.length).toBeGreaterThan(100);
    expect(after.dataUrl.length).toBeGreaterThan(100);
    expect(after.dataUrl).not.toBe(before.dataUrl);
    expect(pixelDiffRatio(before.raster, after.raster)).toBeGreaterThan(0.001);
  });

  it("changes pixels when the single-page event graphic slot changes", async () => {
    restoreDom = installToolImageRasterDom();
    const project = seededProject();
    const map = requireMap(project);
    placeNpc(map, multiPageEvent("ev_gfx", 4, 3, [
      pageGraphic("p0", charsetGraphic("tex_easyrpg_charset_people1", 0)),
    ]));

    const before = await renderRegion(project, map.id);
    const page = requirePage(requireEvent(map, "ev_gfx"), 0);
    page.graphic = charsetGraphic("tex_easyrpg_charset_people1", 6);
    const after = await renderRegion(project, map.id);

    expect(after.dataUrl).not.toBe(before.dataUrl);
    expect(pixelDiffRatio(before.raster, after.raster)).toBeGreaterThan(0.001);
  });

  it("depicts a later page graphic when earlier pages are transparent-only", async () => {
    restoreDom = installToolImageRasterDom();
    const project = seededProject();
    const map = requireMap(project);
    placeNpc(map, multiPageEvent("ev_page2", 5, 4, [
      pageGraphic("p0", { transparent: true }),
      pageGraphic("p1", charsetGraphic("tex_easyrpg_charset_people1", 3)),
    ]));

    const withGraphic = await renderRegion(project, map.id);
    const emptyProject = seededProject();
    const emptyMap = requireMap(emptyProject);
    const empty = await renderRegion(emptyProject, emptyMap.id);

    expect(withGraphic.dataUrl).not.toBe(empty.dataUrl);
    expect(pixelDiffRatio(withGraphic.raster, empty.raster)).toBeGreaterThan(0.001);
  });

  it("fails closed when page2-only graphic change creates distinct page visuals", async () => {
    restoreDom = installToolImageRasterDom();
    const project = seededProject();
    const map = requireMap(project);
    const shared = charsetGraphic("tex_easyrpg_charset_people1", 0);
    placeNpc(map, multiPageEvent("ev_pages", 3, 3, [
      pageGraphic("p0", shared),
      pageGraphic("p1", structuredClone(shared)),
    ]));

    const before = await renderRegion(project, map.id);
    expect(before.dataUrl.length).toBeGreaterThan(100);

    const page1 = requirePage(requireEvent(map, "ev_pages"), 1);
    page1.graphic = charsetGraphic("tex_easyrpg_charset_people1", 6);
    await expect(renderToolImages(project, "show_map_region", regionPayload(map.id)))
      .rejects.toThrow("map-event-rendering-unavailable");
  });

  it("fails closed instead of tile-only proof when a claimed graphic is unsupported", async () => {
    restoreDom = installToolImageRasterDom();
    const project = seededProject();
    const map = requireMap(project);
    placeNpc(map, multiPageEvent("ev_bad", 3, 3, [
      pageGraphic("p0", {
        sprite: { type: "bundled", id: "tex_not_a_real_charset_sheet" },
        pattern: 0,
      }),
    ]));

    await expect(renderToolImages(project, "show_map_region", regionPayload(map.id)))
      .rejects.toThrow("map-event-rendering-unavailable");
  });

  it("keeps tile-only group samples working without a map", async () => {
    restoreDom = installToolImageRasterDom();
    const project = createBlankProject();
    const map = requireMap(project);
    const images = await renderToolImages(project, "render_group_sample", {
      samples: [{ h: 1, label: "현재", lower: [0], upper: [-1], w: 1 }],
      tilesetId: map.tilesetId,
    });
    expect(images).toHaveLength(1);
    const image = requireRendered(images);
    expect(image.dataUrl.startsWith("data:image/png")).toBe(true);
  });
});

type RenderedRegion = { readonly dataUrl: string; readonly raster: PngRaster };

async function renderRegion(project: Project, mapId: string): Promise<RenderedRegion> {
  const result = runTool({ project }, "show_map_region", { mapId, x: 0, y: 0, w: 10, h: 8 });
  expect(result.ok, result.summary).toBe(true);
  const images = await renderToolImages(project, "show_map_region", result.data);
  const image = requireRendered(images);
  return { dataUrl: image.dataUrl, raster: decodeDataUrlPng(image.dataUrl) };
}

function regionPayload(mapId: string): unknown {
  const lower = Array.from({ length: 8 }, () => Array.from({ length: 10 }, () => 0));
  const upper = Array.from({ length: 8 }, () => Array.from({ length: 10 }, () => -1));
  return { mapId, x: 0, y: 0, w: 10, h: 8, lower, upper };
}

function seededProject(): Project {
  const project = createBlankProject();
  const map = requireMap(project);
  map.width = 12;
  map.height = 10;
  map.lowerTiles = Array.from({ length: map.width * map.height }, () => 0);
  map.upperTiles = Array.from({ length: map.width * map.height }, () => -1);
  map.events = [];
  return project;
}

function requireMap(project: Project): GameMap {
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("start map missing");
  return map;
}

function requireEvent(map: GameMap, id: string): GameEvent {
  const event = map.events.find((entry) => entry.id === id);
  if (!event) throw new Error(`event missing: ${id}`);
  return event;
}

function requirePage(event: GameEvent, index: number): EventPage {
  const page = event.pages?.[index];
  if (!page) throw new Error(`page missing: ${event.id}#${index}`);
  return page;
}

function requireRendered(images: readonly RenderedToolImage[]): RenderedToolImage {
  const image = images[0];
  if (!image) throw new Error("expected rendered image");
  return image;
}

function placeNpc(map: GameMap, event: GameEvent): void {
  map.events.push(event);
}

function multiPageEvent(id: string, x: number, y: number, pages: readonly EventPage[]): GameEvent {
  return {
    id,
    x,
    y,
    trigger: { kind: "action" },
    commands: [],
    pages: [...pages],
  };
}

function pageGraphic(id: string, graphic: EventPageGraphic): EventPage {
  return {
    id,
    name: id,
    conditions: [],
    graphic,
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [],
  };
}
