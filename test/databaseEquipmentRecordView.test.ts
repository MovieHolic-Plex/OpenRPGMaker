import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  equipmentActorComparison,
  equipmentEffectStory,
  equipmentEffectSummaryChips,
  renderEquipmentRecordForm,
} from "@/editor/panels/databaseEquipmentRecordView";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EquipmentRecord, ItemEquipmentEffectFlags } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;

function allFlagsFalse(): ItemEquipmentEffectFlags {
  return {
    preemptive: false,
    doubleAttack: false,
    attackAll: false,
    ignoreDodge: false,
    preventCriticalHits: false,
    increasePhysicalDodge: false,
    halfMpCost: false,
    negateTerrainDamage: false,
    fixedEquipment: false,
  };
}

function seedEquipment(patch: Partial<EquipmentRecord> = {}): EquipmentRecord {
  const record = normalizeEquipmentRecord({
    id: "equip_sword",
    name: "검",
    twoHanded: false,
    cursed: false,
    effectFlags: allFlagsFalse(),
    attackElementIds: [],
    elementalDefenseIds: [],
    stateInflictIds: [],
    stateDefenseIds: [],
    ...patch,
  });
  store.update((project) => {
    project.database.equipment = [record];
  });
  return store.getCurrent().database.equipment[0]!;
}

function renderForm(recordId = "equip_sword"): FakeElement {
  const form = document.createElement("section") as unknown as FakeElement;
  const record = store.getCurrent().database.equipment.find((entry) => entry.id === recordId);
  if (!record) throw new Error(`missing equipment ${recordId}`);
  const rerender = (): void => {
    form.replaceChildren();
    const current = store.getCurrent().database.equipment.find((entry) => entry.id === record.id) ?? record;
    renderEquipmentRecordForm(form as unknown as HTMLElement, current, rerender);
  };
  rerender();
  return form;
}

function chipTexts(host: FakeElement): string[] {
  const row = findByTestId(host, "db-equipment-summary-chips");
  if (!row) throw new Error("missing summary chip row");
  return row.childNodes
    .map((node) => ("textContent" in node ? String(node.textContent ?? "") : ""))
    .map((text) => text.trim())
    .filter(Boolean);
}

beforeEach(() => {
  restoreDom = installFakeDom();
  store.replace(createBlankProject());
  seedEquipment();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

describe("equipmentEffectSummaryChips (pure)", () => {
  it("maps doubleAttack to 2회 공격", () => {
    const summary = equipmentEffectSummaryChips(
      normalizeEquipmentRecord({
        id: "equip_test",
        name: "테스트",
        effectFlags: { ...allFlagsFalse(), doubleAttack: true },
      }),
    );
    expect(summary.flags).toContain("2회 공격");
  });

  it("returns empty collections when all flags/badges/counts are off", () => {
    const summary = equipmentEffectSummaryChips(
      normalizeEquipmentRecord({ id: "equip_empty", name: "빈 장비", effectFlags: allFlagsFalse() }),
    );
    expect(summary.flags).toEqual([]);
    expect(summary.badges).toEqual([]);
    expect(summary.counts).toEqual([]);
  });

  it("includes twoHanded and cursed badges", () => {
    const summary = equipmentEffectSummaryChips(
      normalizeEquipmentRecord({
        id: "equip_badge",
        name: "배지",
        twoHanded: true,
        cursed: true,
        effectFlags: allFlagsFalse(),
      }),
    );
    expect(summary.badges).toEqual(["양손 장비", "저주"]);
  });
});

describe("equipmentEffectStory and actor comparison (pure)", () => {
  // Break caught: effect chips that only report counts hide which live element/state/skill
  // an equipment record actually contributes.
  it("turns named runtime effects into a concise equipment story", () => {
    const project = store.getCurrent();
    const element = project.database.elements[0];
    const state = project.database.states[0];
    const skill = project.database.skills[0];
    if (!element || !state || !skill) throw new Error("fixture needs element, state, and skill records");
    const equipment = normalizeEquipmentRecord({
      id: "equip_story",
      name: "별빛 검",
      statBonuses: { attack: 12, defense: 0, mind: 3, agility: 0 },
      attackElementIds: [element.id],
      stateDefenseIds: [state.id],
      stateDefenseMode: "resist",
      stateResistanceChance: 60,
      usableAsItemSkillId: skill.id,
      effectFlags: { ...allFlagsFalse(), doubleAttack: true },
    });

    const story = equipmentEffectStory(project, equipment);

    expect(story.statChanges).toEqual(["공격력 +12", "정신력 +3"]);
    expect(story.effects).toContain("2회 공격");
    expect(story.effects).toContain(`공격 속성: ${element.name}`);
    expect(story.effects).toContain(`상태 저항 60%: ${state.name}`);
    expect(story.effects).toContain(`사용 시 스킬: ${skill.name}`);
  });

  // Break caught: hand-written editor math can disagree with runtime two-handed replacement.
  // The comparison must use the runtime transition/derived-stat authorities and include the
  // shield that a two-handed candidate removes.
  it("compares a two-handed candidate against an actor's initial loadout", () => {
    const project = store.getCurrent();
    const actor = project.database.actors[0]!;
    const currentWeapon = normalizeEquipmentRecord({
      id: "equip_current_weapon",
      name: "현재 검",
      slot: "weapon",
      statBonuses: { attack: 8, defense: 0, mind: 0, agility: 0 },
      equippableActorIds: [actor.id],
    });
    const currentShield = normalizeEquipmentRecord({
      id: "equip_current_shield",
      name: "현재 방패",
      slot: "shield",
      statBonuses: { attack: 0, defense: 5, mind: 0, agility: 0 },
      equippableActorIds: [actor.id],
    });
    const candidate = normalizeEquipmentRecord({
      id: "equip_candidate",
      name: "대검",
      slot: "weapon",
      twoHanded: true,
      statBonuses: { attack: 20, defense: 0, mind: 0, agility: 0 },
      equippableActorIds: [actor.id],
    });
    actor.initialEquipment = { weapon: currentWeapon.id, shield: currentShield.id };
    project.database.equipment = [currentWeapon, currentShield, candidate];

    const comparison = equipmentActorComparison(project, candidate, actor.id);

    expect(comparison?.eligible).toBe(true);
    expect(comparison?.level).toBe(actor.initialLevel);
    expect(comparison?.replacedEquipmentNames).toEqual(["현재 검", "현재 방패"]);
    expect(comparison?.deltas).toEqual({ attack: 12, defense: -5, mind: 0, agility: 0 });
  });

  // Break caught: a stat preview must not imply that a disallowed actor can equip the item.
  it("reports the runtime not-equippable reason without invented deltas", () => {
    const project = store.getCurrent();
    const actor = project.database.actors[0]!;
    const otherActor = project.database.actors[1]!;
    const actorClass = project.database.classes.find((entry) => entry.id === actor.classId);
    if (!actorClass) throw new Error("fixture needs the actor class");
    actorClass.equipmentPermissions = { actorIds: [], classIds: [], equipmentIds: [] };
    const candidate = normalizeEquipmentRecord({
      id: "equip_denied",
      name: "전용 검",
      slot: "weapon",
      statBonuses: { attack: 99, defense: 0, mind: 0, agility: 0 },
      equippableActorIds: [otherActor.id],
      equippableClassIds: [],
    });
    project.database.equipment = [candidate];
    actor.initialEquipment = {};

    const comparison = equipmentActorComparison(project, candidate, actor.id);

    expect(comparison?.eligible).toBe(false);
    expect(comparison?.reason).toBe("notEquippable");
    expect(comparison?.deltas).toBeUndefined();
  });
});

describe("equipment detail-form summary chips (G004)", () => {
  it("shows 2회 공격 chip when doubleAttack is true", () => {
    seedEquipment({ effectFlags: { ...allFlagsFalse(), doubleAttack: true } });
    const host = renderForm();
    expect(chipTexts(host)).toContain("2회 공격");
    expect(findByTestId(host, "db-equipment-summary-empty")).toBeNull();
  });

  it("shows muted 효과 없음 when every effect flag/badge/count is empty", () => {
    seedEquipment();
    const host = renderForm();
    const empty = findByTestId(host, "db-equipment-summary-empty");
    expect(empty).not.toBeNull();
    expect(empty?.textContent).toBe("효과 없음");
    expect(chipTexts(host)).toEqual(["효과 없음"]);
  });

  it("shows twoHanded and cursed badges when set", () => {
    seedEquipment({ twoHanded: true, cursed: true });
    const host = renderForm();
    const texts = chipTexts(host);
    expect(texts).toContain("양손 장비");
    expect(texts).toContain("저주");
    expect(findByTestId(host, "db-equipment-summary-empty")).toBeNull();
  });

  it("rebuilds chips from currentEquipment after doubleAttack toggle (no stale empty)", () => {
    seedEquipment();
    const host = renderForm();
    expect(findByTestId(host, "db-equipment-summary-empty")?.textContent).toBe("효과 없음");

    const double = findByTestId(host, "db-field-equipment-effect-double");
    if (!double) throw new Error("missing doubleAttack control");
    double.checked = true;
    double.dispatchEvent(new Event("change"));

    expect(store.getCurrent().database.equipment[0]?.effectFlags.doubleAttack).toBe(true);
    const texts = chipTexts(host);
    expect(texts).toContain("2회 공격");
    expect(findByTestId(host, "db-equipment-summary-empty")).toBeNull();

    // Flip off again — chip row must track currentEquipment, not the initial snapshot.
    double.checked = false;
    double.dispatchEvent(new Event("change"));
    expect(store.getCurrent().database.equipment[0]?.effectFlags.doubleAttack).toBe(false);
    expect(findByTestId(host, "db-equipment-summary-empty")?.textContent).toBe("효과 없음");
    expect(chipTexts(host)).toEqual(["효과 없음"]);
  });
});
