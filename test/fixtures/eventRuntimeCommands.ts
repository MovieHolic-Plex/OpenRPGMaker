/** Test-only contract fixture. Not a demo or a user project. */
import { createBlankProject, TILE } from "@/project/defaults";
import type { Command, EventPage, M2CommandFields } from "@/project/types";

export function eventRuntimeCommandsProject() {
  const p = createBlankProject();
  p.meta.title = "Event runtime contract";
  p.system.titleScreen = { ...p.system.titleScreen!, title: p.meta.title };
  p.system.defaultBgmResourceId = "";
  p.startPos = { x: 3, y: 6 };
  const map = p.maps[p.startMapId]!;
  map.lowerTiles.fill(TILE.GRASS); map.upperTiles.fill(-1); map.events = [];
  map.encounterRate = 0;
  p.switches.push(...["ready", "path_done", "menu_done", "load_done", "movie_done"].map(id => ({ id, name: id })));
  p.variables.push(...["terrain_result", "event_result"].map(id => ({ id, name: id })));
  const tileset = p.tilesets[map.tilesetId]!;
  tileset.tileMeta ??= {};
  tileset.tileMeta[TILE.GRASS] = { label: "grass", description: "test", terrainTag: 9 };
  const m2 = (commandId: string, fields: M2CommandFields = {}): Command => ({ kind: "m2Command", commandId, fields });
  const page = (id: string, commands: Command[], extra: Partial<EventPage> = {}): EventPage => ({
    id, name: id, conditions: [], graphic: {}, priority: "below", trigger: { kind: "action" },
    movement: { type: "fixed", speed: 3, frequency: 3 }, commands, ...extra,
  });
  map.events.push({ id: "blocker", x: 5, y: 6, trigger: { kind: "action" }, commands: [], pages: [page("blocker", [], {
    priority: "same", overlapForbidden: true, graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people2" }, direction: "down" },
  })] });
  map.events.push({ id: "producer", x: 0, y: 0, trigger: { kind: "parallel" }, commands: [], pages: [page("producer", [
    { kind: "wait", ms: 300 }, { kind: "setSwitch", switchId: "ready", value: true },
  ], { trigger: { kind: "parallel" }, conditions: [{ kind: "switch", switchId: "ready", value: false }] })] });
  map.events.push({ id: "contract", x: 1, y: 0, trigger: { kind: "auto" }, commands: [], pages: [page("contract", [
    m2("m2-206-wait-until", { condition: "switchOn", target: "ready", value: "", timeoutMs: 3000 }),
    { kind: "text", body: "CONDITION READY" },
    m2("m2-205-pathfind-move", { target: "player", x: 7, y: 6, speed: 5, wait: true }),
    m2("m2-042-get-terrain-id", { mapId: map.id, x: 7, y: 6, variableId: "terrain_result" }),
    m2("m2-043-get-event-id", { mapId: map.id, x: 5, y: 6, variableId: "event_result" }),
    { kind: "setSwitch", switchId: "path_done", value: true },
    { kind: "text", body: "PATH COMPLETE" },
    m2("m2-078-open-menu-screen"),
    { kind: "setSwitch", switchId: "menu_done", value: true },
    { kind: "text", body: "MENU CLOSED" },
    m2("m2-093-open-load-menu"),
    { kind: "setSwitch", switchId: "load_done", value: true },
    { kind: "text", body: "LOAD CLOSED" },
    m2("m2-066-play-movie", { resourceId: "qa-event-runtime.webm", wait: true, skippable: false }),
    { kind: "setSwitch", switchId: "movie_done", value: true },
    { kind: "text", body: "MOVIE ENDED" },
  ], { trigger: { kind: "auto" }, conditions: [{ kind: "switch", switchId: "movie_done", value: false }] })] });
  map.events.push({ id: "load_again", x: 7, y: 8, trigger: { kind: "action" }, commands: [], pages: [page("load again", [
    m2("m2-093-open-load-menu"),
    { kind: "text", body: "STALE EVENT MUST NOT RESUME" },
  ], { priority: "same", overlapForbidden: true })] });
  return p;
}
