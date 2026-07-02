import {
  defaultDatabase,
  defaultResourceProfiles,
  defaultSession,
  defaultSystem,
} from "../defaults";
import { SCHEMA_VERSION } from "../types";
import type {
  AssetRef,
  AssetSet,
  Command,
  Condition,
  GameEvent,
  GameEventV1,
  GameMap,
  MapId,
  MapTreeNode,
  PassFlag,
  Project,
  ProjectV1,
  ProjectV2,
  TilesetDef,
} from "../types";
import { deepClone, sanitize } from "./guards";
import { validateProjectV3 } from "./shape";

export function migrateV1toV2(project: ProjectV1): ProjectV2 {
  const flagToSwitch = new Map<string, string>();
  const switches = Object.keys(project.flags).map((flag) => {
    const id = `sw_${sanitize(flag)}`;
    flagToSwitch.set(flag, id);
    return { id, name: flag };
  });

  const assets: AssetSet = {
    sprites: Object.fromEntries(Object.entries(project.assets.sprites).map(([id, sprite]) => [id, { ...sprite }])),
    uploaded: {},
  };

  const tilesets: Record<string, TilesetDef> = {};
  for (const [id, tileset] of Object.entries(project.assets.tilesets)) {
    const passability: PassFlag[] = [];
    const priority: ("lower" | "upper")[] = [];
    const terrain: number[] = [];
    for (let index = 0; index < tileset.count; index++) {
      passability.push({ up: true, down: true, left: true, right: true });
      priority.push("lower");
      terrain.push(0);
    }
    tilesets[id] = {
      id,
      name: id,
      image: tileset.image,
      tileSize: tileset.tileSize,
      tilesPerRow: tileset.tilesPerRow,
      count: tileset.count,
      passability,
      priority,
      terrain,
    };
  }

  const maps: Record<MapId, GameMap> = {};
  for (const [id, map] of Object.entries(project.maps)) {
    maps[id] = {
      id: map.id,
      name: map.name,
      width: map.width,
      height: map.height,
      tilesetId: findTilesetId(project.assets.tilesets, map.tileset),
      tileSize: map.tileSize,
      lowerTiles: [...map.tiles],
      upperTiles: new Array<number>(map.width * map.height).fill(-1),
      events: map.events.map((event) => migrateEventV1(event, flagToSwitch)),
    };
  }

  return {
    version: 2,
    meta: { title: project.meta.title, author: project.meta.author, terms: { gold: "G" } },
    assets,
    tilesets,
    switches,
    variables: [],
    commonEvents: [],
    maps,
    mapTree: createMapTree(project.startMapId, Object.keys(maps)),
    startMapId: project.startMapId,
    startPos: { ...project.startPos },
    flags: { ...project.flags },
  };
}

export function migrateV2toV3(project: ProjectV2): Project {
  return validateProjectV3({
    version: SCHEMA_VERSION,
    meta: {
      title: project.meta.title,
      author: project.meta.author,
      terms: project.meta.terms,
    },
    assets: deepClone(project.assets),
    resourceProfiles: defaultResourceProfiles(),
    tilesets: deepClone(project.tilesets),
    switches: deepClone(project.switches),
    variables: deepClone(project.variables),
    commonEvents: deepClone(project.commonEvents),
    database: defaultDatabase(),
    system: defaultSystem(),
    session: defaultSession(),
    maps: Object.fromEntries(
      Object.entries(project.maps).map(([id, map]) => [
        id,
        {
          ...deepClone(map),
          events: map.events.map((event) => migrateEventV2(event)),
        },
      ])
    ),
    mapConnections: [],
    mapTree: deepClone(project.mapTree),
    startMapId: project.startMapId,
    startPos: { ...project.startPos },
    flags: { ...project.flags },
  });
}

export function migrateV1toV3(project: ProjectV1): Project {
  return migrateV2toV3(migrateV1toV2(project));
}

function migrateEventV1(event: GameEventV1, flagToSwitch: Map<string, string>): GameEvent {
  const condition = migrateConditionV1(event.condition, flagToSwitch);
  const commands = event.commands.map((command) => migrateCommandV1(command, flagToSwitch));
  return migrateEventV2({
    id: event.id,
    x: event.x,
    y: event.y,
    sprite: event.sprite,
    trigger: event.trigger,
    condition,
    commands,
  });
}

function migrateEventV2(event: GameEvent): GameEvent {
  if (event.pages && event.pages.length > 0) return deepClone(event);
  return {
    ...deepClone(event),
    pages: [
      {
        id: `${event.id}_page_1`,
        name: "Page 1",
        conditions: event.condition ? [event.condition] : [],
        graphic: event.sprite ? { sprite: event.sprite } : {},
        trigger: event.trigger,
        priority: "same",
        movement: {
          type: event.moveRoute ? "custom" : "fixed",
          speed: 3,
          frequency: 3,
          route: event.moveRoute,
        },
        commands: deepClone(event.commands),
      },
    ],
  };
}

function migrateConditionV1(
  condition: ProjectV1["maps"][string]["events"][number]["condition"],
  flagToSwitch: Map<string, string>
): Condition | undefined {
  if (!condition) return undefined;
  return {
    kind: "switch",
    switchId: flagToSwitch.get(condition.flag) ?? `sw_${sanitize(condition.flag)}`,
    value: condition.value,
  };
}

function migrateCommandV1(
  command: ProjectV1["maps"][string]["events"][number]["commands"][number],
  flagToSwitch: Map<string, string>
): Command {
  switch (command.kind) {
    case "text":
      return { kind: "text", speaker: command.speaker, body: command.body };
    case "choices":
      return {
        kind: "choices",
        prompt: command.prompt,
        options: command.options.map((option) => ({
          text: option.text,
          branch: option.branch.map((branchCommand) => migrateCommandV1(branchCommand, flagToSwitch)),
        })),
      };
    case "setFlag":
      return {
        kind: "setSwitch",
        switchId: flagToSwitch.get(command.flag) ?? `sw_${sanitize(command.flag)}`,
        value: command.value,
      };
    case "transfer":
      return { kind: "transfer", mapId: command.mapId, x: command.x, y: command.y };
    case "wait":
      return { kind: "wait", ms: command.ms };
  }
}

function findTilesetId(tilesets: ProjectV1["assets"]["tilesets"], image: AssetRef): string {
  for (const [id, tileset] of Object.entries(tilesets)) {
    if (tileset.image.id === image.id) return id;
  }
  return Object.keys(tilesets)[0] ?? "tiles_default";
}

function createMapTree(startMapId: MapId, mapIds: readonly string[]): MapTreeNode {
  return {
    mapId: startMapId,
    children: mapIds.filter((mapId) => mapId !== startMapId).map((mapId) => ({ mapId, children: [] })),
  };
}
