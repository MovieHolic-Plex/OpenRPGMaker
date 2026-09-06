import { createBlankMap, createBlankProject, singleNodeTree, DEFAULT_EASYRPG_CHARSET_ID } from "@/project/defaults";
import type { Command, GameEvent, Project } from "@/project/types";

export type M2 = Extract<Command, { kind: "m2Command" }>;
export const HERO = "hero";
export const OTHER = "other";
export const REWARD = "reward";
export const POISON = "state_poison_u05";
export const SLEEP = "state_sleep_u05";
export const EVENT = "ev_u05";
export const PAGE = "page_u05";

export function m2(commandId: string, fields: M2["fields"]): M2 {
  return { kind: "m2Command", commandId, fields };
}

export function fixtureProject(): Project {
  const project = createBlankProject();
  const actor = project.database.actors[0]!;
  const klass = project.database.classes[0]!;
  const state = project.database.states[0]!;
  // Retain the blank project's referenced records; add distinct test records instead
  // of invalidating unrelated initial-party, class, or state references.
  project.database.classes.push({ ...structuredClone(klass), id: "class_u05", battleCommands: [
    { id: "cmd_attack", name: "Attack", kind: "attack" },
    { id: "cmd_defend", name: "Defend", kind: "defend" },
    { id: "cmd_item", name: "Item", kind: "item" },
  ] });
  project.database.actors.push(
    { ...structuredClone(actor), id: HERO, name: "Hero", classId: "class_u05" },
    { ...structuredClone(actor), id: OTHER, name: "Other", classId: "class_u05" },
  );
  project.database.states.unshift(
    { ...structuredClone(state), id: POISON, name: "Poison" },
    { ...structuredClone(state), id: SLEEP, name: "Sleep" },
  );
  project.variables.push({ id: REWARD, name: "Reward" });
  project.system.monsterCollection = false;
  return project;
}

export function eventWith(command: Command): GameEvent {
  return {
    id: EVENT, x: 2, y: 3, trigger: { kind: "action" }, commands: [command],
    pages: [{
      id: PAGE, name: "U05", conditions: [], graphic: {}, trigger: { kind: "action" },
      priority: "below", overlapForbidden: true,
      movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [command],
    }],
  };
}

export const MAP = "map_u05";
export const COMMON = "common_u05";
export const TROOP = "troop_u05";

/** Pure CLI/browser fixture. Unit input construction above is unchanged from captured RED. */
export function buildFixture(): Project {
  const project = fixtureProject();
  const map = { ...createBlankMap("U05", 8, 8), id: MAP };
  const commands: Command[] = [
    m2("m2-092-change-battle-commands", { target: "party", operation: "add", value: "cmd_attack", slots: "cmd_attack,cmd_defend" }),
    { kind: "changeExp", actorId: HERO, op: "+=", amount: { kind: "var", id: REWARD } },
    m2("m2-014-change-parameters", { target: HERO, parameter: "attack", operation: "add", value: 3, valueSource: "variable", valueVariableId: REWARD }),
    m2("m2-021-damage-processing", { target: HERO, operation: "add", value: 3, valueSource: "variable", valueVariableId: REWARD }),
    m2("m2-019-change-state", { target: HERO, operation: "toggle", value: POISON }),
    m2("m2-022-change-actor-name", { target: HERO, value: "Hero" }),
    m2("m2-023-change-actor-nickname", { target: HERO, value: "Hero nick" }),
    m2("m2-024-change-actor-graphic", { target: HERO, value: project.database.actors[0]!.characterResourceId ?? "" }),
    m2("m2-025-change-actor-faceset", { target: HERO, value: project.database.actors[0]!.faceResourceId ?? "" }),
    m2("m2-091-change-actor-class", { target: HERO, value: "class_u05" }),
    { kind: "learnSkill", actorId: HERO, skillId: project.database.skills[0]!.id, action: "learn" },
  ];
  const host = eventWith(commands[0]!);
  host.x = 2; host.y = 2;
  host.commands = structuredClone(commands);
  host.pages![0]!.commands = structuredClone(commands);
  host.pages![0]!.priority = "same";
  host.pages![0]!.graphic = { sprite: { type: "bundled", id: DEFAULT_EASYRPG_CHARSET_ID }, direction: "down", pattern: 0 };
  map.events = [host];
  project.maps = { [MAP]: map };
  project.mapTree = singleNodeTree(MAP);
  project.startMapId = MAP;
  project.startPos = { x: 2, y: 3 };
  project.meta.title = "U05 actor command remediation";
  project.session.partyActorIds = [HERO, OTHER];
  project.session.variables = { [REWARD]: 25 };
  project.commonEvents = [{ id: COMMON, name: "U05 common", trigger: "none", commands: structuredClone(commands) }];
  project.database.troops.push({ ...structuredClone(project.database.troops[0]!), id: TROOP, name: "U05 troop",
    battleEventPages: [{ id: "troop_page_u05", name: "U05", span: "battle", conditions: [], commands: structuredClone(commands) }],
  });
  if (project.system.titleScreen) project.system.titleScreen.musicResourceId = "";
  return project;
}
