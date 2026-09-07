import fs from "node:fs";
import path from "node:path";
import { clearToolImageEventSpriteCache } from "../src/ai/toolImageEventSprites";
import { renderToolImages, type RenderedToolImage } from "../src/ai/toolImageRenderer";
import { charsetGraphic } from "../src/editor/tools/eventCompile";
import { runTool } from "../src/editor/tools/toolRunner";
import { createBlankProject } from "../src/project/defaults";
import type { EventPage, EventPageGraphic, GameEvent, GameMap, Project } from "../src/project/types";
import {
  decodeDataUrlPng,
  installToolImageRasterDom,
  pixelDiffRatio,
  saveDataUrlPng,
} from "../test/toolImageRasterDom";

const outDir = path.resolve(".omo/evidence/ai-full-context-event-visual");
fs.mkdirSync(outDir, { recursive: true });
const restore = installToolImageRasterDom();
clearToolImageEventSpriteCache();

try {
  const project = seededProject();
  const map = requireMap(project);
  placeNpc(map, multiPageEvent("ev_move", 2, 2, [
    pageGraphic("p0", charsetGraphic("tex_easyrpg_charset_people1", 0)),
  ]));

  const before = await renderRegion(project, map.id);
  saveDataUrlPng(before.dataUrl, path.join(outDir, "move-before-2-2.png"));
  const mover = requireEvent(map, "ev_move");
  mover.x = 7;
  mover.y = 4;
  const after = await renderRegion(project, map.id);
  saveDataUrlPng(after.dataUrl, path.join(outDir, "move-after-7-4.png"));
  const moveDiff = pixelDiffRatio(before.raster, after.raster);

  mover.x = 4;
  mover.y = 3;
  const page0 = requirePage(mover, 0);
  page0.graphic = charsetGraphic("tex_easyrpg_charset_people1", 0);
  const graphic0 = await renderRegion(project, map.id);
  saveDataUrlPng(graphic0.dataUrl, path.join(outDir, "graphic-index-0.png"));
  page0.graphic = charsetGraphic("tex_easyrpg_charset_people1", 6);
  const graphic6 = await renderRegion(project, map.id);
  saveDataUrlPng(graphic6.dataUrl, path.join(outDir, "graphic-index-6.png"));
  const graphicDiff = pixelDiffRatio(graphic0.raster, graphic6.raster);

  // Multi-page distinct variants must fail closed (no tile-only receipt).
  placeNpc(map, multiPageEvent("ev_pages", 6, 5, [
    pageGraphic("p0", charsetGraphic("tex_easyrpg_charset_people1", 0)),
    pageGraphic("p1", charsetGraphic("tex_easyrpg_charset_people1", 6)),
  ]));
  let multiCount = 0;
  try {
    const multi = await renderToolImages(project, "show_map_region", runTool({ project }, "show_map_region", {
      mapId: map.id, x: 0, y: 0, w: 10, h: 8,
    }).data);
    multiCount = multi.length;
  } catch (cause) {
    if (!(cause instanceof Error) || !cause.message.includes("map-event-rendering-unavailable")) throw cause;
    multiCount = 0;
  }

  // page2-only graphic while page0 transparent — must still depict page1.
  const page2Project = seededProject();
  const page2Map = requireMap(page2Project);
  placeNpc(page2Map, multiPageEvent("ev_later", 3, 3, [
    pageGraphic("p0", { transparent: true }),
    pageGraphic("p1", charsetGraphic("tex_easyrpg_charset_people1", 2)),
  ]));
  const later = await renderRegion(page2Project, page2Map.id);
  saveDataUrlPng(later.dataUrl, path.join(outDir, "page2-only-graphic.png"));
  const emptyProject = seededProject();
  const empty = await renderRegion(emptyProject, requireMap(emptyProject).id);
  saveDataUrlPng(empty.dataUrl, path.join(outDir, "empty-region.png"));
  const laterDiff = pixelDiffRatio(later.raster, empty.raster);

  const summary = {
    moveDiffRatio: moveDiff,
    graphicDiffRatio: graphicDiff,
    multiPageDistinctImageCount: multiCount,
    page2OnlyDiffRatio: laterDiff,
    byteIdenticalMoveBugFixed: moveDiff > 0.001,
    graphicChangeVisible: graphicDiff > 0.001,
    multiPageDistinctFailClosed: multiCount === 0,
    page2OnlyDepicted: laterDiff > 0.001,
  };
  fs.writeFileSync(path.join(outDir, "proof-summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
} finally {
  restore();
  clearToolImageEventSpriteCache();
}

async function renderRegion(project: Project, mapId: string): Promise<{ dataUrl: string; raster: ReturnType<typeof decodeDataUrlPng> }> {
  const result = runTool({ project }, "show_map_region", { mapId, x: 0, y: 0, w: 10, h: 8 });
  if (!result.ok) throw new Error(result.summary);
  const images = await renderToolImages(project, "show_map_region", result.data);
  const image = requireRendered(images);
  return { dataUrl: image.dataUrl, raster: decodeDataUrlPng(image.dataUrl) };
}

function requireRendered(images: readonly RenderedToolImage[]): RenderedToolImage {
  const image = images[0];
  if (!image) throw new Error("expected rendered image");
  return image;
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

function placeNpc(map: GameMap, event: GameEvent): void {
  map.events.push(event);
}

function multiPageEvent(id: string, x: number, y: number, pages: readonly EventPage[]): GameEvent {
  return { id, x, y, trigger: { kind: "action" }, commands: [], pages: [...pages] };
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
