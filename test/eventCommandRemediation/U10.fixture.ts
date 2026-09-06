import { createBlankMap, createBlankProject, DEFAULT_EASYRPG_CHARSET_ID } from "@/project/defaults";
import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import { startSession } from "@/project/session";
import { initialRuntimeEventPositions, runtimeEventViewsForMap } from "@/project/runtimeEventState";
import type { Command, EventPage, GameEvent, M2CommandFields, Project } from "@/project/types";
import type { PlaySceneContext } from "@/player/playSceneTypes";

export const HOME = "map_intro";
export const AWAY = "map_12";
export const LIBRARY = "map_templates";
export const HOST = "host";
export const SELECTED = "selectedOther";
export const OTHER = "otherMapEvent";
export const TEMPLATE = "templateA";
export const SPAWN = "spawnA";
export const UNKNOWN = "unknownEvent";
export const COMMON = "u10_common";
export const PAGE = "host_page";
export type M2Command = Extract<Command, { kind: "m2Command" }>;

export function m2(title: "Erase Event" | "Spawn Event" | "Remove Event", fields: M2CommandFields = {}): M2Command {
  const entry = M2_COMMAND_CATALOG.find(entry => entry.title === title);
  if (!entry) throw new Error(`Missing catalog entry: ${title}`);
  return { kind: "m2Command", commandId: entry.id, fields };
}

function event(id: string, x: number, y: number, commands: Command[] = []): GameEvent {
  const page: EventPage = {
    id: `${id}_page`, name: id, conditions: [],
    graphic: { sprite: { type: "bundled", id: DEFAULT_EASYRPG_CHARSET_ID }, direction: "down", pattern: 0 },
    trigger: { kind: "action" }, priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
  };
  return { id, x, y, trigger: { kind: "action" }, commands: [], pages: [page] };
}

export function buildFixture(): Project {
  const project = createBlankProject();
  const home = { ...createBlankMap("Home", 12, 10), id: HOME };
  const away = { ...createBlankMap("Away", 12, 10), id: AWAY };
  const library = { ...createBlankMap("Templates", 12, 10), id: LIBRARY };
  home.events = [event(HOST, 2, 2, [m2("Erase Event")]), event(SELECTED, 4, 2)];
  away.events = [event(OTHER, 7, 5)];
  library.events = [event(TEMPLATE, 1, 1, [{ kind: "setSwitch", switchId: "spawnTriggered", value: true }])];
  project.maps = { [HOME]: home, [AWAY]: away, [LIBRARY]: library };
  project.mapTree = { mapId: HOME, children: [{ mapId: AWAY, children: [] }, { mapId: LIBRARY, children: [] }] };
  project.startMapId = HOME;
  project.startPos = { x: 0, y: 0 };
  project.switches = [{ id: "spawnTriggered", name: "Spawn triggered" }];
  project.commonEvents = [{ id: COMMON, name: "U10 common", trigger: "none", commands: [] }];
  return project;
}

export function spawn(eventId = SPAWN, mapId = HOME, x = 4, y = 3): M2Command {
  return m2("Spawn Event", { prefabId: TEMPLATE, templateMapId: LIBRARY, eventId, mapId, x, y });
}

export function storedCommand(project: Project): M2Command {
  const command = project.maps[HOME]!.events.find(event => event.id === HOST)!.pages![0]!.commands[0];
  if (command?.kind !== "m2Command") throw new Error("Missing U10 stored command");
  return command;
}

/** Only graphical/UI boundaries are stubs. runCommands owns erase/sprite-map mutation;
 * the interpreter owns spawn/remove session mutation, and views are production code.
 * No real Phaser renderer, pixel assertion, browser, server, or database is involved.
 */
export function runtimeFixture(project: Project) {
  const session = startSession(project, 10);
  const positions = initialRuntimeEventPositions(project.maps[HOME]!.events);
  const destroyed = new Set<string>();
  const sprites = new Map([HOST, SELECTED].map(id => [id, { destroy: () => { destroyed.add(id); } }]));
  const scene = {
    session, map: project.maps[HOME], eventPositions: positions,
    running: false, inputEnabled: true, lastActionTargetKey: "",
    autonomousNPCs: new Map(), commandMoveRouteEventIds: new Set(), pageMoveRouteEventIds: new Set(),
    eventSprites: sprites,
    game: { registry: { get: (key: string) => key === "dialogue" ? {
      showText: async () => undefined, showChoices: async () => 0, showNumberInput: async () => 0,
      hide: () => undefined, close: () => undefined,
    } : undefined } },
    setInputEnabled: () => undefined,
    refreshRuntimeSurfaces: () => undefined,
    syncRuntimeState: () => undefined,
    showRuntimeOverlay: () => undefined,
    clearRuntimeOverlay: () => undefined,
  } as unknown as PlaySceneContext;
  return {
    session, scene, positions, destroyed, sprites,
    views: (mapId = HOME) => runtimeEventViewsForMap(project, project.maps[mapId]!, session, positions),
  };
}
