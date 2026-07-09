import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { createBlankProject, TILE } from "@/project/defaults";
import type { Command, EventPage, GameEvent, GameMap, Project } from "@/project/types";

export const PHASE5_MAP_ID = "map_phase5_chase_demo";
export const PHASE5_CHASER_ID = "ev_phase5_chaser";
export const PHASE5_SAFE_CHASER_ID = "ev_phase5_safe_chaser";
export const PHASE5_FOLLOWER_EVENT_ID = "ev_phase5_add_follower";

const PASSIVE: EventPage["movement"] = { type: "fixed", speed: 3, frequency: 3 };

export function createHorrorPhase5Fixture(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  map.id = PHASE5_MAP_ID;
  map.name = "추격자 복도 데모";
  map.width = 12;
  map.height = 8;
  map.lowerTiles = new Array(map.width * map.height).fill(TILE.GRASS);
  map.upperTiles = new Array(map.width * map.height).fill(TILE.EMPTY);
  map.safeZones = [{ x: 1, y: 1, w: 3, h: 2 }];
  project.maps = { [PHASE5_MAP_ID]: map };
  project.startMapId = PHASE5_MAP_ID;
  project.startPos = { x: 1, y: 4 };
  project.mapTree = { mapId: PHASE5_MAP_ID, children: [] };
  paintChasePillars(map);
  map.events = [
    checkpointEvent(map),
    chaserEvent(PHASE5_CHASER_ID, 9, 4, [{ kind: "killPlayer", message: "붙잡혔다." }]),
    chaserEvent(PHASE5_SAFE_CHASER_ID, 5, 1, [{ kind: "killPlayer", message: "안전지대 밖에서 대기" }], 8),
    addFollowerEvent(),
  ];
  return project;
}

function paintChasePillars(map: GameMap): void {
  for (const point of [
    { x: 5, y: 3 },
    { x: 5, y: 4 },
    { x: 5, y: 5 },
    { x: 7, y: 2 },
    { x: 7, y: 3 },
    { x: 7, y: 4 },
  ]) {
    map.lowerTiles[point.y * map.width + point.x] = TILE.WATER;
  }
}

function chaserEvent(id: string, x: number, y: number, commands: Command[], sightRange = 20): GameEvent {
  return {
    id,
    x,
    y,
    trigger: { kind: "eventTouch" },
    commands: [],
    pages: [
      {
        id: `${id}_page`,
        name: "추격자",
        conditions: [],
        graphic: monsterGraphic(),
        trigger: { kind: "eventTouch" },
        priority: "same",
        overlapForbidden: true,
        animationType: "normal",
        movement: { type: "chase", speed: 8, frequency: 8, sightRange, giveUpRange: 30, pathfind: true },
        commands,
      },
    ],
  };
}

function checkpointEvent(map: GameMap): GameEvent {
  const id = `${map.id}_checkpoint_auto`;
  return {
    id,
    x: 0,
    y: 0,
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
          { kind: "checkpointSave", label: "phase5-entry" },
        ],
      },
    ],
  };
}

function addFollowerEvent(): GameEvent {
  return {
    id: PHASE5_FOLLOWER_EVENT_ID,
    x: 1,
    y: 3,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: `${PHASE5_FOLLOWER_EVENT_ID}_page`,
        name: "동행자 추가",
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "action" },
        priority: "below",
        overlapForbidden: false,
        animationType: "fixedGraphic",
        movement: PASSIVE,
        commands: [{ kind: "addFollower", actorId: "actor_hero", name: "가리" }],
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
