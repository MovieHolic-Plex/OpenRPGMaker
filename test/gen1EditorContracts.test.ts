import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { itemFields } from "@/editor/panels/databaseBasicRecordFields";
import { renderSkillRecordForm } from "@/editor/panels/databaseSkillRecordView";
import { renderStateRecordForm } from "@/editor/panels/databaseStateRecordView";
import { renderTroopRecordForm } from "@/editor/panels/databaseTroopRecordView";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  store.replace(createBlankProject());
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

describe("Gen1 editor contracts", () => {
  it("edits and normalizes move max PP and critical class", () => {
    const skill = store.getCurrent().database.skills[0];
    if (!skill) throw new Error("missing default skill");
    const form = document.createElement("section") as unknown as FakeElement;
    renderSkillRecordForm(form as unknown as HTMLElement, skill);

    input(form, "db-field-skill-max-pp", "150");
    change(form, "db-field-skill-gen1-critical", "high");

    const current = store.getCurrent().database.skills.find((record) => record.id === skill.id);
    expect(current?.maxPp).toBe(99);
    expect(current?.gen1CriticalRate).toBe("high");

    input(form, "db-field-skill-max-pp", "0");
    change(form, "db-field-skill-gen1-critical", "normal");
    const reset = store.getCurrent().database.skills.find((record) => record.id === skill.id);
    expect(reset?.maxPp).toBeUndefined();
    expect(reset?.gen1CriticalRate).toBeUndefined();
  });

  it("edits Gen1 major status and trainer-battle semantics", () => {
    const state = store.getCurrent().database.states[0];
    const troop = store.getCurrent().database.troops[0];
    if (!state || !troop) throw new Error("missing default records");
    const stateForm = document.createElement("section") as unknown as FakeElement;
    const troopForm = document.createElement("section") as unknown as FakeElement;
    renderStateRecordForm(stateForm as unknown as HTMLElement, state);
    renderTroopRecordForm(troopForm as unknown as HTMLElement, troop, () => undefined);

    change(stateForm, "db-state-gen1-major-status", "paralysis");
    const trainer = byTestId(troopForm, "db-field-troop-trainer-battle");
    trainer.checked = true;
    trainer.dispatchEvent(new Event("change"));

    expect(store.getCurrent().database.states.find((record) => record.id === state.id)?.gen1MajorStatus).toBe("paralysis");
    expect(store.getCurrent().database.troops.find((record) => record.id === troop.id)?.trainerBattle).toBe(true);
  });

  it("edits ball class without losing the compatibility multiplier", () => {
    const item = store.getCurrent().database.items.find((record) => record.id === "item_capture_orb");
    if (!item) throw new Error("missing capture item");
    updateDatabaseRecord("items", item.id, { captureProfile: { multiplier: 1.5, ballClass: "great" } });
    const form = document.createElement("section") as unknown as FakeElement;
    itemFields(form as unknown as HTMLElement, item.id);

    input(form, "db-field-item-capture-multiplier", "2");
    expect(store.getCurrent().database.items.find((record) => record.id === item.id)?.captureProfile).toEqual({ multiplier: 2, ballClass: "great" });

    change(form, "db-field-item-ball-class", "ultra");
    expect(store.getCurrent().database.items.find((record) => record.id === item.id)?.captureProfile).toEqual({ multiplier: 2, ballClass: "ultra" });
  });

  it("accepts every Gen1 field through the AI DB tool schemas and normalizers", () => {
    const context: ToolContext = { project: createBlankProject() };
    const skillId = context.project.database.skills[0]?.id ?? "";
    const stateId = context.project.database.states[0]?.id ?? "";
    const troopId = context.project.database.troops[0]?.id ?? "";

    expect(runTool(context, "upsert_skill", { skill: { id: skillId, maxPp: 150, gen1CriticalRate: "high" } }, { dryRun: false }).ok).toBe(true);
    expect(runTool(context, "upsert_state", { state: { id: stateId, gen1MajorStatus: "sleep" } }, { dryRun: false }).ok).toBe(true);
    expect(runTool(context, "upsert_troop", { troop: { id: troopId, trainerBattle: true } }, { dryRun: false }).ok).toBe(true);
    expect(runTool(context, "upsert_item", {
      item: { id: "item_capture_orb", captureProfile: { multiplier: 2, ballClass: "ultra" } },
    }, { dryRun: false }).ok).toBe(true);
    expect(runTool(context, "upsert_item", {
      item: { id: "item_capture_orb", captureProfile: { ballClass: "great" } },
    }, { dryRun: false }).ok).toBe(true);

    expect(context.project.database.skills.find((record) => record.id === skillId)).toMatchObject({ maxPp: 99, gen1CriticalRate: "high" });
    expect(context.project.database.states.find((record) => record.id === stateId)?.gen1MajorStatus).toBe("sleep");
    expect(context.project.database.troops.find((record) => record.id === troopId)?.trainerBattle).toBe(true);
    expect(context.project.database.items.find((record) => record.id === "item_capture_orb")?.captureProfile).toEqual({ multiplier: 2, ballClass: "great" });
  });
});

function byTestId(root: FakeElement, testid: string): FakeElement {
  const found = findByTestId(root, testid);
  if (!found) throw new Error(`missing test id ${testid}`);
  return found;
}

function input(root: FakeElement, testid: string, value: string): void {
  const node = byTestId(root, testid);
  node.value = value;
  node.dispatchEvent(new Event("input"));
}

function change(root: FakeElement, testid: string, value: string): void {
  const node = byTestId(root, testid);
  node.value = value;
  node.dispatchEvent(new Event("change"));
}
