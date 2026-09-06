/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { clearCommandInspector } from "@/editor/panels/eventEditor/commandInspector";
import { validateEventDraftBody } from "@/editor/eventDraftValidator";
import {
  HERO, OTHER, REWARD, POISON, SLEEP, EVENT, PAGE, type M2,
  eventWith, fixtureProject, m2,
} from "./U05.fixture";
import { createInterpreter } from "@/player/interpreter";
import { deserialize, serialize } from "@/project/io";
import { createContractSession } from "../commandContracts/harness";
import { openEventCommandEditDialog } from "@/editor/panels/eventEditor/commandEditDialog";
import { renderDatabaseCommandListEditor } from "@/editor/panels/databaseCommandListAdapter";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { editorState } from "@/editor/editorState";
import { createBattleRuntime } from "@/battle/runtime";
import { commandPanel } from "@/player/battleCommandDom";

function control<T extends HTMLElement = HTMLElement>(id: string, root: ParentNode = document): T {
  const node = root.querySelector<T>(`[data-testid="${id}"]`);
  expect(node, `rendered control ${id}`).not.toBeNull();
  return node!;
}

function change(id: string, value: string): void {
  const node = control<HTMLInputElement | HTMLSelectElement>(id);
  if (node instanceof HTMLSelectElement) {
    expect(Array.from(node.options, option => option.value), `option ${value} in ${id}`).toContain(value);
  }
  node.value = value;
  node.dispatchEvent(new Event("change", { bubbles: true }));
}

function dialog(initial: Command) {
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

function asM2(command: Command): M2 {
  expect(command.kind).toBe("m2Command");
  if (command.kind !== "m2Command") throw new Error("Expected M2 command");
  return command;
}

function roundtrip(command: Command): Command {
  const project = structuredClone(store.getCurrent());
  project.maps[project.startMapId]!.events = [eventWith(command)];
  const restored = deserialize(serialize(project));
  return restored.maps[restored.startMapId]!.events.find(event => event.id === EVENT)!.pages![0]!.commands[0]!;
}

function execute(command: Command, reward = 25) {
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

function nextBattleMenu(session: ReturnType<typeof execute>["session"]): HTMLElement {
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
function authoringEntry(surface: "map" | "common" | "troop", initial: Command) {
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

beforeEach(() => {
  resetEditorUiModeForTests("expert");
  clearCommandInspector();
  store.replace(fixtureProject());
});
afterEach(() => {
  // Close via the production Cancel path to dispose modal/custom-select listeners.
  document.querySelector<HTMLButtonElement>('[data-testid="event-command-edit-cancel"]')?.click();
  clearCommandInspector();
  resetEditorUiModeForTests("standard");
  document.body.replaceChildren();
});

const battle = (fields: Parameters<typeof m2>[1]) => m2("m2-092-change-battle-commands", fields);
const stateCommand = (value: string, operation = "add") =>
  m2("m2-019-change-state", { target: HERO, value, operation });

describe("U05 G2-F1 - 092 canonical actor target and scoped legacy adapter", () => {
  it("Confirms a real actor ID, retains inactive slots, mutates only hero, and exposes item in the next battle menu", () => {
    const edit = dialog(battle({ target: "party", operation: "add", value: "cmd_attack", slots: "cmd_attack,cmd_defend" }));
    change("change-battle-commands-target-mode", "actor");
    change("change-battle-commands-target-actor", HERO);
    change("change-battle-commands-command-select", "cmd_item");
    const saved = asM2(edit.saved());
    expect.soft(saved.fields.target).toBe(HERO);
    expect.soft(saved.fields.slots).toBe("cmd_attack,cmd_defend");
    const { session, before } = execute(saved);
    expect.soft(session.actorBattleCommands?.[HERO]).toEqual(["cmd_attack", "cmd_item"]);
    expect.soft(session.actorBattleCommands?.[OTHER]).toEqual(before.actorBattleCommands?.[OTHER]);
    expect.soft(session.actorBattleCommands).not.toHaveProperty("actor");
    const menu = nextBattleMenu(session);
    expect.soft(menu.querySelector('[data-testid="actor-command-item"]')).not.toBeNull();
  });

  it("adapts old target=actor+actorId only for 092 without creating an actor key", () => {
    const { session, before } = execute(battle({ target: "actor", actorId: HERO, operation: "add", value: "cmd_item" }));
    expect.soft(session.actorBattleCommands?.[HERO]).toEqual(["cmd_attack", "cmd_item"]);
    expect.soft(session.actorBattleCommands?.[OTHER]).toEqual(before.actorBattleCommands?.[OTHER]);
    expect.soft(session.actorBattleCommands).not.toHaveProperty("actor");
    expect.soft(session.m2Runtime?.actors).not.toHaveProperty("actor");
  });

  it("reopens an existing real actor target in individual mode with that actor selected", () => {
    dialog(battle({ target: HERO, operation: "add", value: "cmd_item" }));
    expect.soft(control<HTMLSelectElement>("change-battle-commands-target-mode").value).toBe("actor");
    expect.soft(control<HTMLSelectElement>("change-battle-commands-target-actor").value).toBe(HERO);
  });

  it("selecting an actor while party is displayed synchronizes mode and saved target", () => {
    const edit = dialog(battle({ target: "party", operation: "add", value: "cmd_item" }));
    change("change-battle-commands-target-actor", OTHER);
    expect.soft(control<HTMLSelectElement>("change-battle-commands-target-mode").value).toBe("actor");
    expect.soft(asM2(edit.saved()).fields.target).toBe(OTHER);
  });

  it("keeps deliberate party support and does not reinterpret actorId on another command", () => {
    const edit = dialog(battle({ target: "party", operation: "add", value: "cmd_item" }));
    const { session } = execute(edit.saved());
    expect(session.actorBattleCommands).toEqual({ [HERO]: ["cmd_attack", "cmd_item"], [OTHER]: ["cmd_defend", "cmd_item"] });
    const unrelated = execute(m2("m2-022-change-actor-name", { target: OTHER, actorId: HERO, value: "Selected" }));
    expect(unrelated.session.actorNames?.[HERO]).toBe(unrelated.before.actorNames?.[HERO]);
    expect(unrelated.session.actorNames?.[OTHER]).toBe("Selected");
  });
});

describe("U05 G2-F4 - EXP VariableOperand survives real form edits", () => {
  it("changes operation and actor, Confirms and parses without replacing the variable with zero", () => {
    const original: Command = { kind: "changeExp", actorId: HERO, op: "+=", amount: { kind: "var", id: REWARD } };
    const edit = dialog(original);
    change("change-exp-op-select", "-=");
    change("change-exp-actor-select", OTHER);
    const saved = roundtrip(edit.saved());
    expect.soft(saved).toMatchObject({ actorId: OTHER, op: "-=", amount: { kind: "var", id: REWARD } });
    const { session, before } = execute(saved);
    expect.soft(session.actorExperience?.[OTHER]).toBe(15);
    expect.soft(session.actorExperience?.[HERO]).toBe(before.actorExperience?.[HERO]);
    const reopened = dialog(saved);
    change("change-exp-actor-select", HERO);
    const resaved = reopened.saved();
    expect.soft(resaved).toMatchObject({ amount: { kind: "var", id: REWARD } });
    expect.soft(execute(resaved, 99).session.actorExperience?.[HERO]).toBe(0);
    expect(original).toMatchObject({ actorId: HERO, op: "+=", amount: { kind: "var", id: REWARD } });
  });

  it("renders an explicit numeric/variable source choice rather than only a zero numeric input", () => {
    dialog({ kind: "changeExp", actorId: HERO, op: "+=", amount: { kind: "var", id: REWARD } });
    const form = control("event-command-edit-form");
    control("change-exp-amount-input", form);
    const source = Array.from(form.querySelectorAll("select")).find(select =>
      Array.from(select.options).some(option => option.value === "variable") &&
      Array.from(select.options).some(option => option.value === "number"));
    expect(source, "rendered EXP form must expose operand source selection").toBeDefined();
  });

  it("Cancel leaves the caller's VariableOperand intact", () => {
    const original: Command = { kind: "changeExp", actorId: HERO, op: "+=", amount: { kind: "var", id: REWARD } };
    const edit = dialog(original);
    change("change-exp-op-select", "-=");
    control<HTMLButtonElement>("event-command-edit-cancel").click();
    expect(edit.applied).toEqual([]);
    expect(original).toEqual({ kind: "changeExp", actorId: HERO, op: "+=", amount: { kind: "var", id: REWARD } });
  });
});

const numericCases = [
  ["m2-014-change-parameters", "change-parameters"],
  ["m2-021-damage-processing", "damage-processing"],
] as const;
describe("U05 G2-F6 - explicit numeric source outranks inactive variable ID", () => {
  it.each(numericCases)("%s survives numeric switch, Confirm, reopen and another edit", (id, prefix) => {
    const edit = dialog(m2(id, { target: HERO, parameter: "attack", operation: "add", value: 3, valueSource: "variable", valueVariableId: REWARD }));
    change(`${prefix}-value-source`, "number");
    change(`${prefix}-value-input`, "10");
    const saved = asM2(edit.saved());
    expect(saved.fields).toMatchObject({ valueSource: "number", value: 10 });
    const reopened = dialog(saved);
    expect.soft(control<HTMLSelectElement>(`${prefix}-value-source`).value).toBe("number");
    change(`${prefix}-operation`, "remove");
    const resaved = asM2(reopened.saved());
    expect.soft(resaved.fields).toMatchObject({ valueSource: "number", value: 10 });
    const { session, before } = execute(resaved, 99);
    if (prefix === "change-parameters") {
      expect.soft(session.actorParamBonuses?.[HERO]?.attack).toBe(-3);
      expect.soft(session.actorParamBonuses?.[OTHER]).toEqual(before.actorParamBonuses?.[OTHER]);
    } else {
      expect.soft(session.actorVitals[HERO]?.hp).toBe(70);
      expect.soft(session.actorVitals[OTHER]).toEqual(before.actorVitals[OTHER]);
    }
  });

  it("damage preset reopens numeric even with a remembered variable ID", () => {
    const edit = dialog(m2("m2-021-damage-processing", { target: HERO, value: 3, valueSource: "variable", valueVariableId: REWARD, operation: "add" }));
    control<HTMLButtonElement>("damage-processing-preset-25").click();
    const saved = asM2(edit.saved());
    expect(saved.fields).toMatchObject({ valueSource: "number", value: 25 });
    const { session, before } = execute(saved, 99);
    expect(session.actorVitals[HERO]?.hp).toBe(35);
    expect(session.actorVitals[OTHER]).toEqual(before.actorVitals[OTHER]);
    dialog(saved);
    expect(control<HTMLSelectElement>("damage-processing-value-source").value).toBe("number");
  });
});

describe("U05 G2-F7 - no implicit state chip or operation replacement", () => {
  it.each(["", "missing_state"])("does not display or commit poison for unresolved state %j", value => {
    const original = stateCommand(value);
    const edit = dialog(original);
    expect.soft(control<HTMLSelectElement>("change-state-state-select").value).toBe(value);
    expect.soft(control(`change-state-chip-${POISON}`).classList.contains("is-active")).toBe(false);
    change("change-state-operation", "remove");
    edit.confirm();
    // Either reject the unresolved authoring draft, or preserve its ID; never invent poison.
    for (const saved of edit.applied) expect.soft(asM2(saved).fields.value).toBe(value);
    expect(original.fields.value).toBe(value);
  });

  it.each(["", "missing_state"])("Confirm rejects unresolved state %j without a chip selection", value => {
    const edit = dialog(stateCommand(value));
    control("change-state-command-body");
    edit.confirm();
    expect.soft(edit.applied).toEqual([]);
    expect.soft(document.querySelector('[data-testid="event-command-edit-dialog"]')).not.toBeNull();
  });

  it.each(["set", "toggle"])("keeps legacy %s representable and preserves it on explicit chip selection", operation => {
    const edit = dialog(stateCommand(POISON, operation));
    expect.soft(control<HTMLSelectElement>("change-state-operation").value).toBe(operation);
    control<HTMLButtonElement>(`change-state-chip-${SLEEP}`).click();
    const saved = asM2(edit.saved());
    expect.soft(saved.fields).toMatchObject({ value: SLEEP, operation });
    const { session, before } = execute(saved);
    expect.soft(session.actorStateIds?.[HERO]).toEqual(operation === "set" ? [SLEEP] : [POISON, SLEEP]);
    expect.soft(session.actorStateIds?.[OTHER]).toEqual(before.actorStateIds?.[OTHER]);
  });

  it("an explicit sleep chip applies only sleep to the selected actor", () => {
    const edit = dialog(stateCommand("missing_state"));
    control<HTMLButtonElement>(`change-state-chip-${SLEEP}`).click();
    const saved = asM2(edit.saved());
    expect(saved.fields.value).toBe(SLEEP);
    const { session, before } = execute(saved);
    expect(session.actorStateIds?.[HERO]).toEqual([POISON, SLEEP]);
    expect(session.actorStateIds?.[OTHER]).toEqual(before.actorStateIds?.[OTHER]);
  });
});

const identityCases = [
  ["m2-022-change-actor-name", "change-actor-name", "value-input"],
  ["m2-023-change-actor-nickname", "change-actor-nickname", "value-input"],
  ["m2-024-change-actor-graphic", "change-actor-graphic", "resource-select"],
  ["m2-025-change-actor-faceset", "change-actor-faceset", "resource-select"],
  ["m2-091-change-actor-class", "change-actor-class", "class-select"],
] as const;

function identityValue(prefix: string): string {
  const project = store.getCurrent();
  if (prefix.endsWith("class")) return project.database.classes[0]!.id;
  if (prefix.endsWith("graphic")) return project.database.actors[0]!.characterResourceId ?? "";
  if (prefix.endsWith("faceset")) return project.database.actors[0]!.faceResourceId ?? "";
  return "Authored value";
}

function identitySessionValue(result: ReturnType<typeof execute>["session"], prefix: string, actor: string) {
  if (prefix.endsWith("nickname")) return result.actorNicknames?.[actor];
  if (prefix.endsWith("name")) return result.actorNames?.[actor];
  if (prefix.endsWith("graphic")) return result.actorCharacterResourceIds?.[actor];
  if (prefix.endsWith("faceset")) return result.actorFaceResourceIds?.[actor];
  return result.classOverrides?.[actor];
}

describe("U05 G2-F8 - incomplete individual is not whole party", () => {
  for (const surface of ["map", "common", "troop"] as const) {
    describe(`${surface} real command-list Confirm`, () => {
      it.each(identityCases)("%s rejects a cleared individual actor after editing value", (id, prefix, suffix) => {
        const value = identityValue(prefix);
        const initial = m2(id, { target: HERO, value });
        const entry = authoringEntry(surface, initial);
        control(`${prefix}-command-body`);
        change(`${prefix}-actor-select`, "");
        change(`${prefix}-${suffix}`, value);
        entry.confirm();
        const authored = entry.read()[0]!;
        expect.soft(authored).toEqual(initial);
        expect.soft(document.querySelector('[data-testid="event-command-edit-dialog"]')).not.toBeNull();
        const { session, before } = execute(authored);
        expect.soft(identitySessionValue(session, prefix, OTHER)).toEqual(identitySessionValue(before, prefix, OTHER));
      });

      it("learnSkill individual-without-actor cannot Confirm into a party command", () => {
        const initial: Command = { kind: "learnSkill", actorId: "", skillId: store.getCurrent().database.skills[0]!.id, action: "learn" };
        const entry = authoringEntry(surface, initial);
        change("learn-skill-target-mode", "actor");
        expect(control<HTMLSelectElement>("learn-skill-actor-select").value).toBe("");
        // Change an independent field, so persistence cannot be hidden by a no-op replacement.
        change("learn-skill-action-select", "forget");
        entry.confirm();
        expect.soft(entry.read()[0]).toEqual(initial);
        expect.soft(document.querySelector('[data-testid="event-command-edit-dialog"]')).not.toBeNull();
      });

      it("EXP cleared individual cannot Confirm into whole-party EXP", () => {
        const initial: Command = { kind: "changeExp", actorId: HERO, op: "+=", amount: 10 };
        const entry = authoringEntry(surface, initial);
        change("change-exp-actor-select", "");
        change("change-exp-amount-input", "25");
        entry.confirm();
        expect.soft(entry.read()[0]).toEqual(initial);
        expect.soft(document.querySelector('[data-testid="event-command-edit-dialog"]')).not.toBeNull();
        const { session, before } = execute(entry.read()[0]!);
        expect.soft(session.actorExperience?.[OTHER]).toBe(before.actorExperience?.[OTHER]);
      });
    });
  }

  it.each(identityCases)("%s visibly exposes explicit party choice for old whole-party support", (id, prefix) => {
    dialog(m2(id, { target: "", value: identityValue(prefix) }));
    const form = control(`${prefix}-command-body`);
    const partyChoice = Array.from(form.querySelectorAll("select")).find(select =>
      Array.from(select.options).some(option => option.value === "party"));
    expect(partyChoice, "rendered actor form needs an explicit party choice, not an empty actor placeholder").toBeDefined();
  });

  it("EXP visibly exposes explicit party choice for legacy actorId empty", () => {
    dialog({ kind: "changeExp", actorId: "", op: "+=", amount: 25 });
    const form = control("event-command-edit-form");
    control("change-exp-actor-select", form);
    const partyChoice = Array.from(form.querySelectorAll("select")).find(select =>
      Array.from(select.options).some(option => option.value === "party"));
    expect(partyChoice, "rendered EXP form needs explicit party choice").toBeDefined();
  });

  it.each(identityCases)("%s with explicit hero changes only hero", (id, prefix, suffix) => {
    const value = identityValue(prefix);
    const edit = dialog(m2(id, { target: HERO, value }));
    change(`${prefix}-${suffix}`, value);
    const saved = asM2(edit.saved());
    expect(saved.fields.target).toBe(HERO);
    const { session, before } = execute(saved);
    expect(identitySessionValue(session, prefix, HERO)).toBe(value);
    expect(identitySessionValue(session, prefix, OTHER)).toEqual(identitySessionValue(before, prefix, OTHER));
  });

  it("learnSkill explicit hero preserves the untargeted actor's skills", () => {
    const skillId = store.getCurrent().database.skills[0]!.id;
    const edit = dialog({ kind: "learnSkill", actorId: "", skillId, action: "learn" });
    change("learn-skill-target-mode", "actor");
    change("learn-skill-actor-select", HERO);
    const saved = edit.saved();
    const { session, before } = execute(saved);
    expect(session.actorSkillIds?.[HERO]).toEqual([skillId]);
    expect(session.actorSkillIds?.[OTHER]).toEqual(before.actorSkillIds?.[OTHER]);
  });

  it.each(identityCases)("draft validator rejects missing actor target in %s", (id, prefix) => {
    const project = store.getCurrent();
    const validation = validateEventDraftBody(project, project.startMapId, eventWith(m2(id, { target: "missing_actor", value: identityValue(prefix) })));
    expect(validation.canCommit).toBe(false);
    expect(validation.issues.some(issue => issue.severity === "error" && issue.commandPath?.[0] === 0)).toBe(true);
  });
});

describe("U05 G2-F4 browser follow-through - mounted inactive EXP drafts", () => {
  it("keeps reward, numeric31 and the same input nodes across source switches", () => {
    dialog({ kind: "changeExp", actorId: HERO, op: "+=", amount: { kind: "var", id: REWARD } });
    const numeric = control<HTMLInputElement>("change-exp-amount-input");
    const source = control<HTMLSelectElement>("change-exp-amount-source");
    change("change-exp-amount-source", "number");
    expect.soft(control("change-exp-amount-input")).toBe(numeric);
    change("change-exp-amount-input", "31");
    change("change-exp-amount-source", "variable");
    expect.soft(control("change-exp-amount-source")).toBe(source);
    expect.soft(control("change-exp-amount-variable").querySelector<HTMLSelectElement>("select")!.value).toBe(REWARD);
    change("change-exp-amount-source", "number");
    expect.soft(control<HTMLInputElement>("change-exp-amount-input").value).toBe("31");
  });
});

describe("U05 G2-F7 empty state catalog", () => {
  it("preserves the unresolved ID and operation without inventing a chip or accepting Confirm", () => {
    const project = fixtureProject();
    project.database.states = [];
    store.replace(project);
    const initial = stateCommand(POISON, "set");
    const edit = dialog(initial);
    expect(control("change-state-grid").querySelector("button")).toBeNull();
    expect(control<HTMLSelectElement>("change-state-state-select").value).toBe(POISON);
    expect(control<HTMLSelectElement>("change-state-operation").value).toBe("set");
    change("change-state-operation", "toggle");
    edit.confirm();
    expect(edit.applied).toEqual([]);
    expect(control<HTMLSelectElement>("change-state-state-select").value).toBe(POISON);
    expect(control<HTMLSelectElement>("change-state-operation").value).toBe("toggle");
    expect(initial.fields).toEqual({ target: HERO, value: POISON, operation: "set" });
  });
});

describe("U05 EXP inline variable creation", () => {
  it("uses current records after the real picker appends a variable without remounting operand drafts", () => {
    // Exhaust reusable blank slots so creation must append a genuinely new ID.
    const project = structuredClone(store.getCurrent());
    for (const variable of project.variables) if (!variable.name.trim()) variable.name = `Existing ${variable.id}`;
    store.replace(project);
    const initial: Command = { kind: "changeExp", actorId: HERO, op: "+=", amount: { kind: "var", id: REWARD } };
    const edit = dialog(initial);
    change("change-exp-actor-select", OTHER);
    change("change-exp-op-select", "-=");
    change("change-exp-amount-source", "number");
    change("change-exp-amount-input", "31");
    change("change-exp-amount-source", "variable");
    const form = control("event-command-exp-form");
    const numeric = control("change-exp-amount-input");
    const captured = store.getCurrent();
    const name = "U05 newly authored reward";
    expect(captured.variables.some(variable => variable.name === name)).toBe(false);
    control<HTMLButtonElement>("event-variable-picker-open", control("change-exp-amount-variable")).click();
    const search = control<HTMLInputElement>("event-record-picker-search");
    search.value = name;
    search.dispatchEvent(new Event("input", { bubbles: true }));
    control<HTMLButtonElement>("event-record-picker-add").click();
    const created = store.getCurrent().variables.find(variable => variable.name === name)!;
    expect(created).toBeDefined();
    expect(store.getCurrent()).not.toBe(captured);
    expect(captured.variables.some(variable => variable.id === created.id)).toBe(false);
    search.value = name;
    search.dispatchEvent(new Event("input", { bubbles: true }));
    const rowIndex = store.getCurrent().variables.findIndex(variable => variable.id === created.id) + 1;
    control<HTMLButtonElement>(`event-record-picker-row-${rowIndex}`).click();
    control<HTMLButtonElement>("event-record-picker-ok").click();
    expect.soft(control("event-command-exp-form")).toBe(form);
    expect.soft(control("change-exp-amount-input")).toBe(numeric);
    expect.soft(control("change-exp-amount-variable").querySelector<HTMLSelectElement>("select")!.value).toBe(created.id);
    expect.soft(control<HTMLButtonElement>("event-variable-picker-open", control("change-exp-amount-variable")).textContent).toBe(created.name);
    expect.soft(control("change-exp-preview").textContent?.includes(created.name)).toBe(true);
    expect.soft(form.getAttribute("aria-invalid")).toBe("false");
    change("change-exp-amount-source", "number");
    expect.soft(control<HTMLInputElement>("change-exp-amount-input").value).toBe("31");
    change("change-exp-amount-source", "variable");
    edit.confirm();
    expect.soft(edit.applied).toEqual([{ kind: "changeExp", actorId: OTHER, op: "-=", amount: { kind: "var", id: created.id } }]);
    expect(initial).toEqual({ kind: "changeExp", actorId: HERO, op: "+=", amount: { kind: "var", id: REWARD } });
  });
});
