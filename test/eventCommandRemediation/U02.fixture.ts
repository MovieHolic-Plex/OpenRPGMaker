import { createBlankMap, createBlankProject, singleNodeTree, DEFAULT_EASYRPG_CHARSET_ID } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, Condition, Project } from "@/project/types";

export type Loop = Extract<Command, { kind: "loop" }>;
export type Fork = Extract<Command, { kind: "fork" }>;
export type Choices = Extract<Command, { kind: "choices" }>;
export type Timer = Extract<Command, { kind: "timer" }>;
export type InputNumber = Extract<Command, { kind: "inputNumber" }>;

export function seedRecords(project: Project): void {
  project.variables = ["first", "answer", "reward", "other"].map(id => ({ id, name: id }));
  project.switches = ["switch-a", "switch-b"].map(id => ({ id, name: id }));
}

export function seedProject(): Project {
  const project = createBlankProject();
  seedRecords(project);
  const actor = project.database.actors[0];
  if (!actor) throw new Error("Blank project must contain an actor fixture");
  project.database.actors = [
    { ...structuredClone(actor), id: "actor-a", name: "Actor A" },
    { ...structuredClone(actor), id: "actor-b", name: "Actor B" },
  ];
  store.replace(project);
  return project;
}

export function loopFixture(): Loop {
  return {
    kind: "loop",
    body: [
      { kind: "text", body: "Original", speaker: "NPC", emotion: "happy", autoAdvance: true },
      { kind: "loop", body: [{ kind: "breakLoop" }] },
    ],
  };
}

export function variableCondition(): Condition {
  return { kind: "variable", variableId: "reward", op: ">=", value: 10 };
}

export function forkFixture(condition: Condition = variableCondition()): Fork {
  return {
    kind: "fork", condition,
    then: [{ kind: "text", body: "THEN", speaker: "Then speaker", emotion: "happy" }],
    else: [{ kind: "text", body: "ELSE", speaker: "Else speaker", autoAdvance: true }],
  };
}

export function choicesFixture(): Choices {
  return {
    kind: "choices", prompt: "Choose", cancelBehavior: "choice2",
    options: ["A", "B", "C"].map(text => ({
      text, branch: [{ kind: "text", body: `MARKER_${text}`, speaker: text, autoAdvance: true }],
    })),
    cancelBranch: [{ kind: "text", body: "INACTIVE_CANCEL", emotion: "happy" }],
  };
}

export function inputFixture(variableId = ""): InputNumber {
  return { kind: "inputNumber", variableId, digits: 2, prompt: "Original", showPad: true };
}

export function node<T extends HTMLElement = HTMLElement>(root: ParentNode, testId: string): T {
  const found = root.querySelector<T>(`[data-testid="${testId}"]`);
  if (!found) throw new Error(`Missing existing control: ${testId}`);
  return found;
}

export function change(root: ParentNode, testId: string, value: string): void {
  const control = node<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(root, testId);
  control.value = value;
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

export function pick(root: ParentNode, testId: string, value: string): void {
  const picker = node(root, testId);
  const select = picker instanceof HTMLSelectElement ? picker : picker.querySelector("select");
  if (!select) throw new Error(`Missing existing picker select: ${testId}`);
  if (![...select.options].some(option => option.value === value)) {
    throw new Error(`Fixture record is not selectable: ${value}`);
  }
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

// Browser/CLI fixture is independent of Vitest and never mutates a shipped project.
export function buildFixture(): Project {
  const project = createBlankProject();
  seedRecords(project);
  const map = createBlankMap("U02", 8, 8);
  map.id = "map_intro";
  project.meta.title = "U02 nested command regression";
  project.maps = { [map.id]: map };
  project.mapTree = singleNodeTree(map.id);
  project.startMapId = map.id;
  project.startPos = { x: 2, y: 3 };
  if (project.system.titleScreen) project.system.titleScreen.musicResourceId = "";
  project.session.variables = { first: 91, answer: 92, reward: 25, other: 40 };
  const commands: Command[] = [
    // Input Number is added through the real picker: an empty saved reference is invalid.
    forkFixture(), choicesFixture(),
    { kind: "timer", action: "start", timerId: "timer1" },
    loopFixture(),
  ];
  map.events = [{ id: "host", x: 2, y: 2, trigger: { kind: "action" }, commands, pages: [{
    id: "host-page", name: "U02", conditions: [],
    graphic: { sprite: { type: "bundled", id: DEFAULT_EASYRPG_CHARSET_ID }, direction: "down", pattern: 0 },
    trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
  }] }];
  return project;
}
