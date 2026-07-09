import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderItemRecordForm } from "@/editor/panels/databaseItemRecordView";
import { renderSkillRecordForm } from "@/editor/panels/databaseSkillRecordView";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  const project = createBlankProject();
  project.database.elements = [
    { id: "element_fire", name: "화염", kind: "magical", rateLabels: ["A", "B", "C", "D", "E"], damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 } },
  ];
  project.database.states = [
    { id: "state_poison", name: "독" },
    { id: "state_sleep", name: "수면" },
  ];
  project.switches[0] = { id: "sw_0001", name: "문 열림" };
  project.switches[1] = { id: "sw_0002", name: "" };
  project.database.battleAnimations = [
    {
      id: "anim_skill_test",
      name: "화염 스파크",
      resourceId: "sample_title",
      sheet: { frameWidth: 96, frameHeight: 96, columns: 5 },
    },
  ];
  const skill = project.database.skills[0];
  if (!skill) throw new Error("expected default skill");
  skill.effect = { kind: "damage", statistic: "attack", affects: "hp" };
  skill.elementId = undefined;
  skill.stateEffects = [];
  skill.animationId = "anim_skill_test";
  store.replace(project);
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

describe("database skill and item forms", () => {
  it("renders skill element, switch effect, state effects, and animation preview controls", () => {
    const skill = store.getCurrent().database.skills[0];
    if (!skill) throw new Error("expected default skill");
    const form = renderSkillForm(skill.id);

    const element = byTestId(form, "db-field-skill-element");
    element.value = "element_fire";
    element.dispatchEvent(new Event("change"));
    expect(currentSkill(skill.id)?.elementId).toBe("element_fire");

    const effectKind = byTestId(form, "db-field-skill-effect-kind");
    effectKind.value = "switch";
    effectKind.dispatchEvent(new Event("change"));

    expect(byTestId(form, "db-field-skill-effect-switch").textContent).toContain("0002:");
    expect(findByTestId(form, "db-field-skill-effect-statistic")).toBeNull();
    expect(findByTestId(form, "db-field-skill-effect-affects")).toBeNull();

    const switchPicker = byTestId(form, "db-field-skill-effect-switch");
    switchPicker.value = "sw_0002";
    switchPicker.dispatchEvent(new Event("change"));
    expect(currentSkill(skill.id)?.effect).toEqual({ kind: "switch", switchId: "sw_0002" });

    const addState = byTestId(form, "db-skill-state-effect-add");
    addState.click();
    expect(findByTestId(form, "db-skill-state-effect-row-0")).not.toBeNull();

    const statePicker = byTestId(form, "db-field-skill-state-effect-state-0");
    statePicker.value = "state_sleep";
    statePicker.dispatchEvent(new Event("change"));
    const chance = byTestId(form, "db-field-skill-state-effect-chance-0");
    chance.value = "35";
    chance.dispatchEvent(new Event("input"));
    const operation = byTestId(form, "db-field-skill-state-effect-op-0");
    operation.value = "remove";
    operation.dispatchEvent(new Event("change"));

    expect(currentSkill(skill.id)?.stateEffects).toEqual([{ stateId: "state_sleep", chance: 35, operation: "remove" }]);

    byTestId(form, "db-skill-state-effect-delete-0").click();
    expect(currentSkill(skill.id)?.stateEffects).toEqual([]);
    expect(findByTestId(form, "db-skill-state-effect-row-0")).toBeNull();

    const preview = byTestId(form, "db-skill-animation-preview");
    expect(preview.textContent).toContain("화염 스파크");
    expect(preview.querySelector(".db-skill-animation-preview-frame")).not.toBeNull();
  });

  it("renders item image and icon resource fields with previews", () => {
    const item = store.getCurrent().database.items[0];
    if (!item) throw new Error("expected default item");
    const form = document.createElement("section") as unknown as FakeElement;

    renderItemRecordForm(form as unknown as HTMLElement, item, () => undefined);

    const image = byTestId(form, "db-field-item-image-resource");
    image.value = "cc0-jetrel-ether-blue";
    image.dispatchEvent(new Event("input"));
    const icon = byTestId(form, "db-field-item-icon-resource");
    icon.value = "cc0-jetrel-potion-red";
    icon.dispatchEvent(new Event("input"));

    const current = store.getCurrent().database.items.find((entry) => entry.id === item.id);
    expect(current?.imageResourceId).toBe("cc0-jetrel-ether-blue");
    expect(current?.iconResourceId).toBe("cc0-jetrel-potion-red");
    expect(form.querySelectorAll(".db-resource-picker-control").length).toBeGreaterThanOrEqual(2);
  });
});

function renderSkillForm(skillId: string): FakeElement {
  const skill = currentSkill(skillId);
  if (!skill) throw new Error(`missing skill ${skillId}`);
  const form = document.createElement("section") as unknown as FakeElement;
  renderSkillRecordForm(form as unknown as HTMLElement, skill);
  return form;
}

function byTestId(root: FakeElement, testid: string): FakeElement {
  const element = findByTestId(root, testid);
  if (!element) throw new Error(`missing test id ${testid}`);
  return element;
}

function currentSkill(skillId: string) {
  return store.getCurrent().database.skills.find((entry) => entry.id === skillId);
}
