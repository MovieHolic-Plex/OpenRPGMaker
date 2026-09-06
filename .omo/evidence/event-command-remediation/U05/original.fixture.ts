import { expect } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, GameEvent, Project } from "@/project/types";
import { createInterpreter } from "@/player/interpreter";
import { deserialize, serialize } from "@/project/io";
import { createContractSession } from "../commandContracts/harness";
import { openEventCommandEditDialog } from "@/editor/panels/eventEditor/commandEditDialog";
import { renderDatabaseCommandListEditor } from "@/editor/panels/databaseCommandListAdapter";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { editorState } from "@/editor/editorState";
import { createBattleRuntime } from "@/battle/runtime";
import { commandPanel } from "@/player/battleCommandDom";

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

export function control<T extends HTMLElement = HTMLElement>(id: string, root: ParentNode = document): T {
  const node = root.querySelector<T>(`[data-testid="${id}"]`);
  expect(node, `rendered control ${id}`).not.toBeNull();
  return node!;
}

export function change(id: string, value: string): void {
  const node = control<HTMLInputElement | HTMLSelectElement>(id);
  if (node instanceof HTMLSelectElement) {
    expect(Array.from(node.options, option => option.value), `option ${value} in ${id}`).toContain(value);
  }
  node.value = value;
  node.dispatchEvent(new Event("change", { bubbles: true }));
}

export function dialog(initial: Command) {
  const applied: Command[] = [];
  openEventCommandEditDialog({ initial, lockKind: true, onApply: command => applied.push(command) });
  control("event-command-edit-form");
  return {
    applied,
    confirm: () => control<HTMLButtonElement>("event-command-edit-ok").click(),
    saved: (): Command => {
      control<HTMLButtonElement>("event-command-edit-ok").click();
      expect(applied).toHaveLength(1);
      return applied[0]!;
    },
  };
}

export function asM2(command: Command): M2 {
  expect(command.kind).toBe("m2Command");
  if (command.kind !== "m2Command") throw new Error("Expected M2 command");
  return command;
}

export function roundtrip(command: Command): Command {
  const project = structuredClone(store.getCurrent());
  project.maps[project.startMapId]!.events = [eventWith(command)];
  const restored = deserialize(serialize(project));
  return restored.maps[restored.startMapId]!.events.find(event => event.id === EVENT)!.pages![0]!.commands[0]!;
}

export function execute(command: Command, reward = 25) {
  const project = store.getCurrent();
  const session = createContractSession(project);
  session.partyActorIds = [HERO, OTHER];
  session.variables = { [REWARD]: reward };
  session.actorBattleCommands = { [HERO]: ["cmd_attack"], [OTHER]: ["cmd_defend"] };
  session.actorExperience = { [HERO]: 80, [OTHER]: 40 };
  session.actorSkillIds = { [HERO]: [], [OTHER]: [project.database.skills[1]!.id] };
  session.actorStateIds = { [HERO]: [POISON], [OTHER]: [SLEEP] };
  session.actorNames = { [HERO]: "Hero before", [OTHER]: "Other before" };
  session.actorNicknames = { [HERO]: "Hero nick", [OTHER]: "Other nick" };
  session.actorCharacterResourceIds = { [HERO]: "hero_before", [OTHER]: "other_before" };
  session.actorFaceResourceIds = { [HERO]: "hero_face_before", [OTHER]: "other_face_before" };
  session.classOverrides = { [HERO]: "class_u05", [OTHER]: "class_u05" };
  session.actorParamBonuses = { [HERO]: { attack: 7 }, [OTHER]: { attack: 13 } };
  session.actorVitals = {
    [HERO]: { hp: 60, maxHp: 100, mp: 10, maxMp: 20 },
    [OTHER]: { hp: 45, maxHp: 90, mp: 8, maxMp: 18 },
  };
  const before = structuredClone(session);
  const interpreter = createInterpreter([command], session, project);
  expect(interpreter.start().kind).toBe("done");
  return { session, before };
}

export function nextBattleMenu(session: ReturnType<typeof execute>["session"]): HTMLElement {
  const project = store.getCurrent();
  const runtime = createBattleRuntime({
    project, troopId: project.database.troops[0]!.id, canEscape: true, canLose: true, battleFlow: "strict",
    party: {
      partyActorIds: session.partyActorIds, battleCommands: session.actorBattleCommands,
      levels: session.actorLevels ?? {}, experience: session.actorExperience ?? {},
    },
    sessionState: {
      switches: session.switches, variables: session.variables, inventory: session.inventory,
      actorBattleCommands: session.actorBattleCommands,
    },
    rng: () => 0.5,
  });
  return commandPanel(runtime.snapshot(), {
    runtime, submenu: null, setSubmenu: () => undefined, setDirectorState: () => undefined,
    render: () => undefined, runActorCommand: command => runtime.performActorCommand(command),
    beginTargetCommand: command => runtime.beginActorCommand(command),
    confirmTargetSelection: id => runtime.selectTargetEnemy(id),
  });
}

/** Real command-list entry and replacement path, not a mocked Confirm callback. */
export function authoringEntry(surface: "map" | "common" | "troop", initial: Command) {
  const host = document.createElement("div");
  document.body.append(host);
  let commands = [structuredClone(initial)];
  const project = store.getCurrent();
  const mapId = project.startMapId;
  let read = () => commands;
  if (surface === "map") {
    project.maps[mapId]!.events = [eventWith(initial)];
    store.replace(project);
    editorState.set({ currentMapId: mapId, selectedEventPageId: PAGE });
    renderEventEditorDynamic(host, mapId, EVENT);
    read = () => store.getCurrent().maps[mapId]!.events.find(event => event.id === EVENT)!.pages![0]!.commands;
  } else {
    renderDatabaseCommandListEditor(host, {
      commands, replaceCommands: next => { commands = next; }, pickerContext: surface,
    });
  }
  const head = host.querySelector<HTMLElement>(".cmd-item .cmd-head");
  expect(head, `${surface} command row`).not.toBeNull();
  head!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
  control("event-command-edit-form");
  return { read, confirm: () => control<HTMLButtonElement>("event-command-edit-ok").click() };
}
