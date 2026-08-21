import type { Command, EventPage, MoveRoute, Project } from "@/project/types";
import { defaultDatabase } from "@/project/defaults/defaultDatabase";

const PASSABLE = { up: true, down: true, left: true, right: true };

export type RuntimeEventState = {
  readonly x: number;
  readonly y: number;
  readonly pageId?: string;
  readonly priority: string;
  readonly trigger: string;
};

export type RuntimeState = {
  readonly inputEnabled: boolean;
  readonly player: { readonly x: number; readonly y: number };
  readonly switches: Record<string, boolean>;
  readonly variables: Record<string, number>;
  readonly inventory: Record<string, number>;
  readonly partyActorIds: readonly string[];
  readonly events: Record<string, RuntimeEventState>;
};

export type SpriteSample = {
  readonly frame: string;
  readonly textureKey: string;
  readonly x: number;
  readonly y: number;
  readonly depth: number;
};

type PageRecordConfig = {
  readonly id: string;
  readonly trigger: EventPage["trigger"];
  readonly priority: EventPage["priority"];
  readonly commands?: readonly Command[];
  readonly movement?: EventPage["movement"];
  readonly options?: Partial<Pick<EventPage, "animationType" | "conditions">>;
};

type EventRecordConfig = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly pages: readonly EventPage[];
};

export function eventPageRuntimePropsProject(): Project {
  const database = defaultDatabase();
  return {
    version: 3,
    meta: { title: "Event Page Runtime Props Cert", author: "e2e", terms: { gold: "G" } },
    assets: { sprites: {}, uploaded: {} },
    resourceProfiles: [],
    tilesets: {
      tiles_default: {
        id: "tiles_default",
        name: "Proof tileset",
        image: { type: "bundled", id: "tex_tiles_default" },
        tileSize: 16,
        tilesPerRow: 8,
        count: 8,
        passability: Array.from({ length: 8 }, () => PASSABLE),
        priority: ["lower", "lower", "lower", "lower", "lower", "lower", "upper", "lower"],
        terrain: Array.from({ length: 8 }, () => 0),
      },
    },
    switches: [
      { id: "sw_action", name: "Action" },
      { id: "sw_auto", name: "Auto" },
      { id: "sw_condition", name: "Condition" },
    ],
    variables: [
      { id: "var_condition", name: "Condition" },
      { id: "var_player_touch", name: "Player touch" },
      { id: "var_event_touch", name: "Event touch" },
      { id: "var_parallel", name: "Parallel" },
    ],
    commonEvents: [],
    database,
    system: { startActorIds: [] },
    session: { switches: {}, variables: {}, inventory: {}, partyActorIds: [] },
    maps: {
      map_proof: {
        id: "map_proof",
        name: "Proof",
        width: 12,
        height: 10,
        tilesetId: "tiles_default",
        tileSize: 16,
        lowerTiles: Array.from({ length: 120 }, () => 0),
        upperTiles: Array.from({ length: 120 }, () => -1),
        events: proofEvents(),
      },
    },
    mapTree: { mapId: "map_proof", children: [] },
    startMapId: "map_proof",
    startPos: { x: 1, y: 1 },
    flags: {},
  };
}

function pageRecord(config: PageRecordConfig): EventPage {
  const commands = config.commands ?? [];
  const movement = config.movement ?? { type: "fixed", speed: 3, frequency: 3 };
  const options = config.options ?? {};
  return {
    id: config.id,
    name: config.id,
    conditions: options.conditions ?? [],
    graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_actor1" } },
    trigger: config.trigger,
    priority: config.priority,
    movement,
    commands: [...commands],
    ...(options.animationType ? { animationType: options.animationType } : {}),
  };
}

function eventRecord(config: EventRecordConfig): Project["maps"][string]["events"][number] {
  return {
    id: config.id,
    x: config.x,
    y: config.y,
    trigger: config.pages[0]?.trigger ?? { kind: "action" },
    commands: [],
    pages: [...config.pages],
  };
}

function proofEvents(): Project["maps"][string]["events"] {
  return [
    eventRecord({ id: "ev_action", x: 0, y: 1, pages: [pageRecord({ id: "action", trigger: { kind: "action" }, priority: "same", commands: [{ kind: "setSwitch", switchId: "sw_action", value: true }] })] }),
    eventRecord({ id: "ev_player_touch", x: 2, y: 1, pages: [pageRecord({ id: "playerTouch", trigger: { kind: "playerTouch" }, priority: "same", commands: [{ kind: "setVariable", variableId: "var_player_touch", op: "+=", value: 1 }] })] }),
    eventRecord({ id: "ev_condition", x: 1, y: 2, pages: conditionPages() }),
    eventRecord({ id: "ev_auto", x: 5, y: 1, pages: [pageRecord({ id: "auto", trigger: { kind: "auto" }, priority: "below", commands: [{ kind: "setSwitch", switchId: "sw_auto", value: true }] })] }),
    eventRecord({ id: "ev_parallel", x: 6, y: 1, pages: [pageRecord({ id: "parallel", trigger: { kind: "parallel" }, priority: "below", commands: [{ kind: "setVariable", variableId: "var_parallel", op: "+=", value: 1 }] })] }),
    eventRecord({ id: "ev_event_touch", x: 4, y: 1, pages: [pageRecord({ id: "eventTouch", trigger: { kind: "eventTouch" }, priority: "same", commands: [{ kind: "setVariable", variableId: "var_event_touch", op: "+=", value: 1 }], movement: { type: "approach", speed: 6, frequency: 6 } })] }),
    eventRecord({ id: "move_fixed", x: 4, y: 4, pages: [pageRecord({ id: "move_fixed", trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 6, frequency: 6 } })] }),
    eventRecord({ id: "move_custom", x: 6, y: 4, pages: [pageRecord({ id: "move_custom", trigger: { kind: "action" }, priority: "same", movement: routeMovement("custom") })] }),
    eventRecord({ id: "move_random", x: 8, y: 4, pages: [pageRecord({ id: "move_random", trigger: { kind: "action" }, priority: "same", movement: { type: "random", speed: 6, frequency: 6 } })] }),
    eventRecord({ id: "move_approach", x: 10, y: 4, pages: [pageRecord({ id: "move_approach", trigger: { kind: "action" }, priority: "same", movement: { type: "approach", speed: 6, frequency: 6 } })] }),
    eventRecord({ id: "anim_normal", x: 4, y: 7, pages: [pageRecord({ id: "anim_normal", trigger: { kind: "action" }, priority: "same", movement: routeMovement("customLoop"), options: { animationType: "normal" } })] }),
    eventRecord({ id: "anim_fixed", x: 7, y: 7, pages: [pageRecord({ id: "anim_fixed", trigger: { kind: "action" }, priority: "same", movement: routeMovement("customLoop"), options: { animationType: "fixedGraphic" } })] }),
    eventRecord({ id: "depth_below", x: 9, y: 7, pages: [pageRecord({ id: "depth_below", trigger: { kind: "action" }, priority: "below" })] }),
    eventRecord({ id: "depth_above", x: 10, y: 7, pages: [pageRecord({ id: "depth_above", trigger: { kind: "action" }, priority: "above" })] }),
  ];
}

function conditionPages(): readonly EventPage[] {
  return [
    pageRecord({
      id: "condition_base",
      trigger: { kind: "action" },
      priority: "same",
      commands: [
        { kind: "setSwitch", switchId: "sw_condition", value: true },
        { kind: "setVariable", variableId: "var_condition", op: "=", value: 7 },
        { kind: "changeItem", itemId: "item_potion", op: "+=", amount: 1 },
        { kind: "changeParty", actorId: "actor_hero", action: "add" },
      ],
    }),
    pageRecord({
      id: "condition_met",
      trigger: { kind: "action" },
      priority: "same",
      options: {
        conditions: [
          { kind: "switch", switchId: "sw_condition", value: true },
          { kind: "variable", variableId: "var_condition", op: ">=", value: 7 },
          { kind: "item", itemId: "item_potion", present: true },
          { kind: "actor", actorId: "actor_hero", present: true },
        ],
      },
    }),
  ];
}

function routeMovement(type: "custom" | "customLoop"): EventPage["movement"] {
  const route: MoveRoute = type === "custom"
    ? { moves: [{ kind: "move", dir: "right" }], repeat: false }
    : { moves: [{ kind: "move", dir: "right" }, { kind: "move", dir: "left" }], repeat: true };
  return { type: "custom", speed: 6, frequency: 6, route };
}
