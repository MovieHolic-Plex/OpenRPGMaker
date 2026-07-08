import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { createBlankProject, TILE } from "@/project/defaults";
import type { Command, EventPage, GameEvent, GameMap, Project } from "@/project/types";

export const PHASE6A_MAP_ID = "map_phase6a_dark_corridor";
export const PHASE6A_CHASER_ID = "ev_phase6a_chaser";
export const PHASE6A_TRANSITION_EVENT_ID = "ev_phase6a_transition";
export const PHASE6A_REMOVE_LIGHTS_EVENT_ID = "ev_phase6a_remove_lights";
export const PHASE6A_FLASHLIGHT_ID = "phase6a_flashlight";

const PASSIVE: EventPage["movement"] = { type: "fixed", speed: 3, frequency: 3 };

export function createHorrorPhase6aFixture(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  map.id = PHASE6A_MAP_ID;
  map.name = "Phase 6a 암전 복도";
  map.width = 16;
  map.height = 7;
  map.lowerTiles = new Array(map.width * map.height).fill(TILE.GRASS);
  map.upperTiles = new Array(map.width * map.height).fill(TILE.EMPTY);
  map.defaultLighting = {
    ambient: 0.85,
    color: "#000000",
    sources: [
      { id: PHASE6A_FLASHLIGHT_ID, at: "player", radius: 3.5, intensity: 1 },
      { id: "phase6a_wall_lamp_west", at: { x: 5, y: 2 }, radius: 2.25, intensity: 0.75, color: "#f2b36a", flicker: true },
      { id: "phase6a_wall_lamp_east", at: { x: 11, y: 4 }, radius: 2.5, intensity: 0.65, color: "#f6c987" },
    ],
  };
  project.maps = { [PHASE6A_MAP_ID]: map };
  project.startMapId = PHASE6A_MAP_ID;
  project.startPos = { x: 1, y: 3 };
  project.mapTree = { mapId: PHASE6A_MAP_ID, children: [] };
  paintDarkCorridor(map);
  map.events = [
    checkpointEvent(map),
    transitionEvent(),
    removeLightsEvent(),
    chaserEvent(PHASE6A_CHASER_ID, 13, 3, [{ kind: "killPlayer", message: "어둠 속에서 붙잡혔다." }]),
  ];
  return project;
}

function paintDarkCorridor(map: GameMap): void {
  for (let x = 0; x < map.width; x += 1) {
    map.lowerTiles[x] = TILE.WATER;
    map.lowerTiles[(map.height - 1) * map.width + x] = TILE.WATER;
  }
  for (let y = 0; y < map.height; y += 1) {
    map.lowerTiles[y * map.width] = TILE.WATER;
    map.lowerTiles[y * map.width + map.width - 1] = TILE.WATER;
  }
  for (const point of [{ x: 7, y: 2 }, { x: 7, y: 4 }, { x: 8, y: 2 }, { x: 8, y: 4 }]) {
    map.lowerTiles[point.y * map.width + point.x] = TILE.WATER;
  }
}

function checkpointEvent(map: GameMap): GameEvent {
  const id = `${map.id}_checkpoint_auto`;
  return {
    id,
    x: 1,
    y: 1,
    trigger: { kind: "auto" },
    commands: [],
    pages: [
      {
        id: `${id}_page`,
        name: "진입 체크포인트",
        conditions: [{ kind: "selfSwitch", key: "A", value: false }],
        graphic: { transparent: true },
        trigger: { kind: "auto" },
        priority: "below",
        overlapForbidden: false,
        animationType: "fixedGraphic",
        movement: PASSIVE,
        commands: [
          { kind: "setSelfSwitch", key: "A", value: true },
          { kind: "checkpointSave", label: "phase6a-entry" },
        ],
      },
    ],
  };
}

function transitionEvent(): GameEvent {
  return lightingActionEvent(PHASE6A_TRANSITION_EVENT_ID, 1, 4, [
    { kind: "setLighting", ambient: 0.45, color: "#04080f", transitionMs: 96 },
  ]);
}

function removeLightsEvent(): GameEvent {
  return lightingActionEvent(PHASE6A_REMOVE_LIGHTS_EVENT_ID, 2, 4, [
    { kind: "removeLight", all: true },
  ]);
}

function lightingActionEvent(id: string, x: number, y: number, commands: Command[]): GameEvent {
  return {
    id,
    x,
    y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: `${id}_page`,
        name: "조명 테스트",
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "action" },
        priority: "below",
        overlapForbidden: false,
        animationType: "fixedGraphic",
        movement: PASSIVE,
        commands,
      },
    ],
  };
}

function chaserEvent(id: string, x: number, y: number, commands: Command[]): GameEvent {
  return {
    id,
    x,
    y,
    trigger: { kind: "eventTouch" },
    commands: [],
    pages: [
      {
        id: `${id}_page`,
        name: "암전 추격자",
        conditions: [],
        graphic: monsterGraphic(),
        trigger: { kind: "eventTouch" },
        priority: "same",
        overlapForbidden: true,
        animationType: "normal",
        movement: { type: "chase", speed: 7, frequency: 6, sightRange: 10, giveUpRange: 20, pathfind: true },
        commands,
      },
    ],
  };
}

function monsterGraphic(): EventPage["graphic"] {
  return {
    sprite: { type: "bundled", id: "tex_easyrpg_charset_monster1" },
    direction: "down",
    pattern: charsetFrameIndex({ characterIndex: 0, direction: "down", pattern: 1 }),
  };
}
