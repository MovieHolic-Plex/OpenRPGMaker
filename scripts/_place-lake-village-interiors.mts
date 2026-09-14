/** One-off: place a few interiors behind lake-village doors, save, render PNGs. */
import fs from "node:fs";
import path from "node:path";
import { createHouseDoorEvent, createHouseDoorStepEvent } from "../src/editor/houseInteriors.ts";
import { INTERIOR_ROOM_TILESET_ID } from "../src/editor/interiorRoomPipeline.ts";
import { runTool } from "../src/editor/tools/toolRunner.ts";
import { appendToTree } from "../src/project/mapTree.ts";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import type { Command, GameEvent, GameMap, MapId, Project } from "../src/project/types.ts";
import { renderInteriorMapPng, writePng } from "./lib/renderInteriorMapPng.mts";

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

const DOOR_TILE = 146;
const KITS = ["amber-wood", "bright-plaster", "blue-stone", "slate-wood", "timber-hall"] as const;
const FACILITIES = [
  { query: "민가", mapId: "map_lake_house", name: "호숫가 민가" },
  { query: "상점", mapId: "map_lake_shop", name: "호숫가 상점" },
  { query: "술집", mapId: "map_lake_tavern", name: "호숫가 술집" },
  { query: "여관", mapId: "map_lake_inn", name: "호숫가 여관" },
  { query: "대장간", mapId: "map_lake_smithy", name: "호숫가 대장간" },
] as const;

const env = loadEnv();
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: env.VITE_SUPABASE_PROJECT_ID || "rpg-zzu-house-template-gallery",
};
const outDir = path.resolve("output/evidence/lake-village-interiors");
fs.mkdirSync(outDir, { recursive: true });

function walkCommands(commands: readonly Command[] | undefined, out: Command[]): void {
  for (const command of commands ?? []) {
    out.push(command);
    const nested = command as Command & { commands?: Command[]; then?: Command[]; else?: Command[] };
    walkCommands(nested.commands, out);
    walkCommands(nested.then, out);
    walkCommands(nested.else, out);
  }
}

function eventCommands(event: GameEvent): Command[] {
  const out: Command[] = [];
  walkCommands(event.commands, out);
  for (const page of event.pages ?? []) walkCommands(page.commands, out);
  return out;
}

function findEntrance(map: GameMap): GameEvent | undefined {
  return (map.events ?? []).find((event) => event.id === "ev_entrance_" + map.id)
    ?? (map.events ?? []).find((event) => (event.pages ?? []).some((page) => page.name === "입구"));
}

function rewriteTransfer(event: GameEvent, mapId: MapId, x: number, y: number): void {
  const rewrite = (commands: Command[]): void => {
    for (let i = 0; i < commands.length; i += 1) {
      const command = commands[i]!;
      if (command.kind === "transfer") {
        commands[i] = { ...command, mapId, x, y, fade: "black" };
      }
    }
  };
  if (event.commands?.length) rewrite(event.commands);
  for (const page of event.pages ?? []) rewrite(page.commands);
}

function upsertEvent(events: GameEvent[], next: GameEvent): void {
  const index = events.findIndex((event) => event.id === next.id);
  if (index >= 0) events[index] = next;
  else events.push(next);
}

const project = await loadProjectFromSupabase(config);
if (!project) throw new Error("failed to load project");
const village = project.maps.map_lake_village;
if (!village) throw new Error("missing map_lake_village");

const doors: Array<{ x: number; y: number }> = [];
for (let y = 0; y < village.height; y += 1) {
  for (let x = 0; x < village.width; x += 1) {
    if (village.lowerTiles[y * village.width + x] === DOOR_TILE) doors.push({ x, y });
  }
}

const doorReport = doors.map((door) => {
  const events = (village.events ?? []).filter((event) =>
    Math.abs(event.x - door.x) + Math.abs(event.y - door.y) <= 1
  );
  return {
    ...door,
    events: events.map((event) => ({
      id: event.id,
      x: event.x,
      y: event.y,
      names: (event.pages ?? []).map((page) => page.name),
      transfers: eventCommands(event).filter((command) => command.kind === "transfer"),
    })),
  };
});
console.log("project", config.projectId, project.meta.title);
console.log("existing maps", Object.keys(project.maps));
console.log("doors", JSON.stringify(doorReport, null, 2));

const context = { project };
const placed: Array<{
  query: string;
  mapId: string;
  name: string;
  door: { x: number; y: number };
  entry: { x: number; y: number };
  size: string;
  png: string;
  summary: string;
}> = [];

for (let i = 0; i < Math.min(FACILITIES.length, doors.length); i += 1) {
  const facility = FACILITIES[i]!;
  const door = doors[i]!;
  const kitId = KITS[i % KITS.length]!;
  const result = runTool(context, "place_concept", {
    query: facility.query,
    mapId: facility.mapId,
    seed: 11 + i * 17,
    replaceExisting: true,
  }, { dryRun: false });
  if (!result.ok) throw new Error(facility.query + ": " + result.summary);
  const map = context.project.maps[facility.mapId];
  const tileset = context.project.tilesets[INTERIOR_ROOM_TILESET_ID];
  if (!map || !tileset) throw new Error("missing map/tileset for " + facility.mapId);
  map.name = facility.name;
  const entrance = findEntrance(map);
  if (!entrance) throw new Error("no entrance on " + facility.mapId);
  const entry = { x: entrance.x, y: Math.max(0, entrance.y - 1) };
  const returnY = Math.min(village.height - 1, door.y + 1);
  rewriteTransfer(entrance, village.id as MapId, door.x, returnY);
  appendToTree(context.project.mapTree, facility.mapId as MapId, village.id as MapId);
  upsertEvent(village.events, createHouseDoorEvent({
    eventId: "ev_lake_door_" + facility.mapId,
    x: door.x,
    y: door.y,
    interiorMapId: facility.mapId as MapId,
    kitId,
    name: facility.name + " 문",
    entryX: entry.x,
    entryY: entry.y,
    seed: 11 + i * 17,
  }));
  if (door.y + 1 < village.height) {
    upsertEvent(village.events, createHouseDoorStepEvent({
      eventId: "ev_lake_door_" + facility.mapId + "_step",
      doorEventId: "ev_lake_door_" + facility.mapId,
      x: door.x,
      y: door.y + 1,
      interiorMapId: facility.mapId as MapId,
      name: facility.name + " 문",
      entryX: entry.x,
      entryY: entry.y,
    }));
  }
  const pngPath = path.join(outDir, facility.mapId + ".png");
  writePng(renderInteriorMapPng(map, tileset, { scale: 3 }), pngPath);
  placed.push({
    query: facility.query,
    mapId: facility.mapId,
    name: facility.name,
    door,
    entry,
    size: map.width + "x" + map.height,
    png: pngPath,
    summary: result.summary,
  });
  console.log("placed", facility.query, facility.mapId, map.width + "x" + map.height, "door", JSON.stringify(door), "entry", JSON.stringify(entry));
}

const next: Project = context.project;
const save = await saveProjectToSupabase(next, config);
if (save.kind !== "saved") {
  console.error(save);
  throw new Error("save failed: " + save.kind);
}
const reloaded = await loadProjectFromSupabase(config);
if (!reloaded) throw new Error("reload failed");
const reloadIds = Object.keys(reloaded.maps);
for (const item of placed) {
  if (!reloadIds.includes(item.mapId)) throw new Error("reload missing " + item.mapId);
}

const manifest = {
  projectId: config.projectId,
  title: next.meta.title,
  saved: save.kind,
  maps: reloadIds,
  doors: doorReport,
  placed,
};
fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
