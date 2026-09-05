import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { renderClassRecordForm } from "@/editor/panels/databaseClassRecordView";
import { renderEquipmentRecordForm } from "@/editor/panels/databaseEquipmentRecordView";
import { renderStateRecordForm } from "@/editor/panels/databaseStateRecordView";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

// 2파 배치 C(P10) 회귀 스펙:
//  - 상태 참조 패널이 switch 스킬 대신 실제 stateEffects 참조를 보여준다
//  - 상태 수치 필드가 뷰 레벨에서 클램프된다
//  - 장비 효과 필드군(effectFlags/속성/상태 방어)이 UI에 노출되고 store 에 반영된다
//  - 장착 허용 패널이 배우/직업 구분 헤더를 가진다
//  - 직업 허용 장비가 다중 체크박스로 배열을 보존한다(6→1 파괴 회귀 방지)
let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  const project = createBlankProject();
  project.database.states = [
    { id: "state_poison", name: "독" },
    { id: "state_sleep", name: "수면" },
  ];
  project.database.elements = [
    { id: "element_fire", name: "화염", kind: "magical", rateLabels: ["A", "B", "C", "D", "E"], damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 } },
  ];
  const baseSkill = project.database.skills[0];
  if (!baseSkill) throw new Error("expected default skill in blank project");
  // 상태와 무관한 스위치 스킬(과거 오탐 대상) + 상태를 실제 참조하는 스킬.
  project.database.skills = [
    { ...baseSkill, id: "skill_switch", name: "스위치 스킬", effect: { kind: "switch", switchId: "sw_0001" }, stateEffects: [] },
    { ...baseSkill, id: "skill_poison", name: "독침", effect: { kind: "damage", statistic: "attack", affects: "hp" }, stateEffects: [{ stateId: "state_poison", chance: 50, operation: "add" }] },
  ];
  project.database.equipment = [
    normalizeEquipmentRecord({ id: "equip_sword", name: "검" }),
    normalizeEquipmentRecord({ id: "equip_shield", name: "방패" }),
    normalizeEquipmentRecord({ id: "equip_armor", name: "갑옷" }),
  ];
  store.replace(project);
  resetMapEditHistory();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

function renderStateForm(stateId: string): FakeElement {
  const state = store.getCurrent().database.states.find((entry) => entry.id === stateId);
  if (!state) throw new Error("missing state");
  const form = el("div") as unknown as FakeElement;
  renderStateRecordForm(form as unknown as HTMLElement, state);
  return form;
}

describe("state reference panel shows actual stateEffects references (P10)", () => {
  it("lists skills whose stateEffects target this state, not switch-kind skills", () => {
    const form = renderStateForm("state_poison");
    const references = findByTestId(form, "db-state-references");
    if (!references) throw new Error("missing reference panel");
    const text = references.textContent;
    expect(text).toContain("독침");
    expect(text).not.toContain("스위치 스킬");
  });

  it("shows the empty hint for a state no skill references", () => {
    const form = renderStateForm("state_sleep");
    const references = findByTestId(form, "db-state-references");
    if (!references) throw new Error("missing reference panel");
    expect(references.textContent).toContain("(참조하는 스킬 없음)");
  });
});

describe("state numeric fields clamp at the view level (P10)", () => {
  it("clamps 회복 확률 999 → 100 and 명중률 보정 -50 → 0 with display write-back", () => {
    const form = renderStateForm("state_poison");
    const recover = findByTestId(form, "db-state-recover-chance");
    const accuracy = findByTestId(form, "db-state-accuracy");
    if (!recover || !accuracy) throw new Error("missing state numeric fields");

    recover.value = "999";
    recover.dispatchEvent(new Event("input"));
    expect(recover.value).toBe("100");
    accuracy.value = "-50";
    accuracy.dispatchEvent(new Event("input"));
    expect(accuracy.value).toBe("0");

    const state = store.getCurrent().database.states.find((entry) => entry.id === "state_poison");
    expect(state?.recoverNaturallyChance).toBe(100);
    expect(state?.accuracyModifier).toBe(0);
  });
});

describe("equipment effect field group ported from the item tab (P10)", () => {
  function renderEquipmentForm(id: string): FakeElement {
    const record = store.getCurrent().database.equipment.find((entry) => entry.id === id);
    if (!record) throw new Error("missing equipment");
    const form = el("div") as unknown as FakeElement;
    renderEquipmentRecordForm(form as unknown as HTMLElement, record);
    return form;
  }

  it("renders the three supported effect flags and commits toggles to the store", () => {
    const form = renderEquipmentForm("equip_sword");
    for (const testid of [
      "db-field-equipment-effect-double",
      "db-field-equipment-effect-all",
      "db-field-equipment-effect-fixed",
    ]) {
      expect(findByTestId(form, testid), testid).not.toBeNull();
    }
    const double = findByTestId(form, "db-field-equipment-effect-double");
    if (!double) throw new Error("missing doubleAttack flag");
    double.checked = true;
    double.dispatchEvent(new Event("change"));
    expect(store.getCurrent().database.equipment[0]?.effectFlags.doubleAttack).toBe(true);
  });

  it("renders attack/defense element choices and state defense fields", () => {
    const form = renderEquipmentForm("equip_sword");
    const attackElement = findByTestId(form, "db-field-equipment-attack-element");
    if (!attackElement) throw new Error("missing attack element select");
    attackElement.value = "element_fire";
    attackElement.dispatchEvent(new Event("change"));
    expect(store.getCurrent().database.equipment[0]?.attackElementIds).toEqual(["element_fire"]);

    const stateDefense = findByTestId(form, "db-field-equipment-state-defense-state_poison");
    if (!stateDefense) throw new Error("missing state defense checkbox");
    stateDefense.checked = true;
    stateDefense.dispatchEvent(new Event("change"));
    expect(store.getCurrent().database.equipment[0]?.stateDefenseIds).toEqual(["state_poison"]);

    expect(findByTestId(form, "db-field-equipment-state-defense-mode")).toBeNull();
    const resistance = findByTestId(form, "db-field-equipment-state-resistance");
    if (!resistance) throw new Error("missing state resistance field");
    resistance.value = "250";
    resistance.dispatchEvent(new Event("input"));
    expect(resistance.value).toBe("100");
    expect(store.getCurrent().database.equipment[0]?.stateResistanceChance).toBe(100);
  });

  it("separates equippable actors and classes with group headings", () => {
    const form = renderEquipmentForm("equip_sword");
    const actorGroup = findByTestId(form, "db-equipment-actor-permission-group");
    const classGroup = findByTestId(form, "db-equipment-class-permission-group");
    if (!actorGroup || !classGroup) throw new Error("missing permission groups");
    expect(actorGroup.textContent).toContain("주인공별 허용");
    expect(classGroup.textContent).toContain("직업별 허용");
  });
});

describe("class equipment permissions keep the array intact (P10 Critical)", () => {
  function renderClassForm(id: string): FakeElement {
    const record = store.getCurrent().database.classes.find((entry) => entry.id === id);
    if (!record) throw new Error("missing class");
    const form = el("div") as unknown as FakeElement;
    renderClassRecordForm(form as unknown as HTMLElement, record);
    return form;
  }

  it("renders one checkbox per equipment and toggling one preserves the others", () => {
    const klass = store.getCurrent().database.classes[0];
    if (!klass) throw new Error("expected default class in blank project");
    updateDatabaseRecord("classes", klass.id, {
      equipmentPermissions: { ...klass.equipmentPermissions, equipmentIds: ["equip_sword", "equip_shield", "equip_armor"] },
    });

    const form = renderClassForm(klass.id);
    const checklist = findByTestId(form, "db-class-equipment-checklist");
    if (!checklist) throw new Error("missing equipment checklist");

    const shield = findByTestId(form, "db-field-class-equipment-equip_shield");
    if (!shield) throw new Error("missing shield checkbox");
    expect(shield.checked).toBe(true);
    shield.checked = false;
    shield.dispatchEvent(new Event("change"));

    const after = store.getCurrent().database.classes.find((entry) => entry.id === klass.id);
    expect(after?.equipmentPermissions.equipmentIds).toEqual(["equip_sword", "equip_armor"]);

    shield.checked = true;
    shield.dispatchEvent(new Event("change"));
    const restored = store.getCurrent().database.classes.find((entry) => entry.id === klass.id);
    expect(restored?.equipmentPermissions.equipmentIds).toEqual(["equip_sword", "equip_armor", "equip_shield"]);
  });
});
