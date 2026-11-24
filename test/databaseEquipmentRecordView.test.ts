import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { renderEquipmentRecordForm, equipmentActorComparison, equipmentEffectStory, equipmentEffectSummaryChips } from "@/editor/panels/databaseEquipmentRecordView";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EquipmentRecord, ItemEquipmentEffectFlags } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import { renderClassRecordForm } from "@/editor/panels/databaseClassRecordView";
import { renderStateRecordForm } from "@/editor/panels/databaseStateRecordView";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { el } from "@/util/dom";
import { isolateTimers } from "./mergedTeardown";

describe("databaseEquipmentInspector", () => {
  isolateTimers();
  let restoreDom: (() => void) | undefined;
  function seedEquipment(patch: Partial<EquipmentRecord> = {}): EquipmentRecord {
    const record = normalizeEquipmentRecord({
      id: "equip_sword",
      name: "검",
      twoHanded: false,
      cursed: false,
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
    renderEquipmentRecordForm(form as unknown as HTMLElement, record);
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
  function byTestId(root: FakeElement, testid: string): FakeElement {
    const element = findByTestId(root, testid);
    if (!element) throw new Error(`missing test id ${testid}`);
    return element;
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
  describe("equipment inspector header", () => {
    // Break caught: an author needs an actor-selectable live preview, not only a record-wide
    // permission checklist and isolated bonus numbers.
    it("switches the actor comparison between eligible and ineligible actors", () => {
      const project = store.getCurrent();
      const equipment = project.database.equipment[0]!;
      const firstActor = project.database.actors[0]!;
      const secondActor = project.database.actors[1]!;
      equipment.equippableActorIds = [firstActor.id];
      equipment.equippableClassIds = [];
      firstActor.initialEquipment = {};
      secondActor.initialEquipment = {};

      const form = renderForm();
      const resultHost = byTestId(form, "db-equipment-comparison-result");
      expect(resultHost.dataset.state).toBe("eligible");
      expect(resultHost.textContent).toContain(`Lv.${firstActor.initialLevel}`);

      const actorSelect = byTestId(form, "db-equipment-comparison-actor");
      actorSelect.value = secondActor.id;
      actorSelect.dispatchEvent(new Event("change"));

      expect(findByTestId(form, "db-equipment-comparison-result")).toBe(resultHost);
      expect(resultHost.dataset.state).toBe("ineligible");
      expect(resultHost.textContent).toContain("장착 불가");
    });

    // Break caught: editing the candidate's stats must update the comparison in place; a stale
    // delta is more misleading than having no preview at all.
    it("refreshes actor stat deltas in place when an equipment bonus changes", () => {
      const project = store.getCurrent();
      const equipment = project.database.equipment[0]!;
      const actor = project.database.actors[0]!;
      equipment.equippableActorIds = [actor.id];
      equipment.equippableClassIds = [];
      equipment.statBonuses.attack = 8;
      actor.initialEquipment = {};

      const form = renderForm();
      const resultHost = byTestId(form, "db-equipment-comparison-result");
      expect(resultHost.textContent).toContain("빈 부위에 장착");
      expect(byTestId(form, "db-equipment-comparison-delta-attack").textContent).toContain("+8");

      const attack = byTestId(form, "db-field-equipment-attack");
      attack.value = "20";
      attack.dispatchEvent(new Event("input"));

      expect(findByTestId(form, "db-equipment-comparison-result")).toBe(resultHost);
      expect(byTestId(form, "db-equipment-comparison-delta-attack").textContent).toContain("+20");
    });

    // Break caught: an already-equipped candidate must not reuse the empty-slot fallback copy.
    it("labels an already-equipped candidate instead of claiming the slot is empty", () => {
      const project = store.getCurrent();
      const equipment = project.database.equipment[0]!;
      const actor = project.database.actors[0]!;
      equipment.equippableActorIds = [actor.id];
      equipment.equippableClassIds = [];
      actor.initialEquipment = { weapon: equipment.id };

      const resultHost = byTestId(renderForm(), "db-equipment-comparison-result");

      expect(resultHost.textContent).toContain("이미 착용 중");
      expect(resultHost.textContent).not.toContain("빈 부위에 장착");
    });

    it("renders a named effect story beside the existing summary chips", () => {
      const form = renderForm();
      expect(byTestId(form, "db-equipment-effect-story")).toBeTruthy();
      expect(byTestId(form, "db-equipment-story-stats")).toBeTruthy();
    });

    it("renders icon, name edit, catalog slot select, and the summary chips host", () => {
      const form = renderForm();
      expect(findByTestId(form, "db-equipment-inspector-header")).not.toBeNull();
      expect(form.querySelector(".db-equipment-inspector-icon")).toBeTruthy();

      const nameInput = byTestId(form, "db-field-name");
      expect(nameInput.value).toBe("검");
      nameInput.value = "강철검";
      nameInput.dispatchEvent(new Event("input"));
      expect(store.getCurrent().database.equipment[0]?.name).toBe("강철검");

      const slotSelect = byTestId(form, "db-field-equipment-slot");
      expect(slotSelect.querySelectorAll("option").map((option) => option.attrs.value))
        .toEqual(["weapon", "shield", "helmet", "armor", "accessory"]);
      expect(slotSelect.value).toBe("weapon");

      const chipsHost = findByTestId(form, "db-equipment-summary-chips");
      expect(chipsHost).not.toBeNull();
      expect(chipsHost?.className).toContain("db-equipment-summary-chips");
      // 헤더 안에 승격되어 있다(직접 자식이 아니라 헤더 하위).
      expect(form.querySelector(".db-equipment-inspector-header")?.querySelector(".db-equipment-summary-chips")).toBeTruthy();
    });

    it("slot selection rewrites slot and refreshes chips without a full form rebuild", () => {
      const form = renderForm();
      const chipsHost = byTestId(form, "db-equipment-summary-chips");
      const firstChip = chipsHost.childNodes[0];

      // 센티널: 칩 호스트와 무관한 노드(설명 필드/헤더)에 마커를 남긴다 — 부분 갱신이면
      // 살아남고, 전체 재렌더면 사라진다.
      const description = byTestId(form, "db-field-equipment-description");
      description.dataset.sentinel = "alive";
      const header = byTestId(form, "db-equipment-inspector-header");
      header.dataset.sentinel = "header-alive";

      const slotSelect = byTestId(form, "db-field-equipment-slot");
      slotSelect.value = "shield";
      slotSelect.dispatchEvent(new Event("change", { bubbles: true }));

      expect(store.getCurrent().database.equipment[0]?.slot).toBe("shield");
      // 칩 호스트는 같은 노드, 자식만 교체(부분 갱신 경로).
      expect(findByTestId(form, "db-equipment-summary-chips")).toBe(chipsHost);
      expect(chipsHost.childNodes[0]).not.toBe(firstChip);
      // 무관한 노드는 그대로 — 전체 재렌더가 아니다.
      expect(findByTestId(form, "db-field-equipment-description")?.dataset.sentinel).toBe("alive");
      expect(findByTestId(form, "db-equipment-inspector-header")?.dataset.sentinel).toBe("header-alive");
    });

    it("name edit rewrites the name field and keeps the header intact", () => {
      const form = renderForm();
      const nameInput = byTestId(form, "db-field-name");
      nameInput.value = "전설의 검";
      nameInput.dispatchEvent(new Event("input"));
      expect(store.getCurrent().database.equipment[0]?.name).toBe("전설의 검");
      expect(byTestId(form, "db-field-name").value).toBe("전설의 검");
    });
  });
  describe("summary chips partial refresh (refreshSummaryChips closure)", () => {
    it("toggle twoHanded switch adds the 양손 장비 chip without a rebuild", () => {
      const form = renderForm();
      expect(chipTexts(form)).toEqual(["명중률 100%", "치명타율 +0%p"]);
      expect(findByTestId(form, "db-equipment-summary-empty")).toBeNull();

      const twoHanded = byTestId(form, "db-field-equipment-two-handed");
      expect(twoHanded.attrs.type).toBe("checkbox");
      expect(twoHanded.attrs.role).toBe("switch");
      twoHanded.checked = true;
      twoHanded.dispatchEvent(new Event("change", { bubbles: true }));

      expect(store.getCurrent().database.equipment[0]?.twoHanded).toBe(true);
      const texts = chipTexts(form);
      expect(texts).toContain("양손 장비");
      expect(findByTestId(form, "db-equipment-summary-empty")).toBeNull();

      // 되돌리면 칩도 다시 빠진다 — 초기 스냅샷이 아닌 currentEquipment 추적.
      twoHanded.checked = false;
      twoHanded.dispatchEvent(new Event("change", { bubbles: true }));
      expect(store.getCurrent().database.equipment[0]?.twoHanded).toBe(false);
      expect(chipTexts(form)).toEqual(["명중률 100%", "치명타율 +0%p"]);
    });

    it("effect flag toggleSwitch writes effectFlags and refreshes the chip row", () => {
      const form = renderForm();
      const double = byTestId(form, "db-field-equipment-effect-double");
      expect(double.attrs.type).toBe("checkbox");
      double.checked = true;
      double.dispatchEvent(new Event("change", { bubbles: true }));
      expect(store.getCurrent().database.equipment[0]?.effectFlags.doubleAttack).toBe(true);
      expect(chipTexts(form)).toContain("2회 공격");

      double.checked = false;
      double.dispatchEvent(new Event("change", { bubbles: true }));
      expect(store.getCurrent().database.equipment[0]?.effectFlags.doubleAttack).toBe(false);
      expect(chipTexts(form)).toEqual(["명중률 100%", "치명타율 +0%p"]);
    });
  });
  describe("state percent sliders (0-100%)", () => {
    it("clamps out-of-range input with display write-back (150 → 100)", () => {
      const form = renderForm();
      const slider = byTestId(form, "db-field-equipment-state-resistance-slider");
      expect(slider.attrs.type).toBe("range");
      expect(slider.attrs.min).toBe("0");
      expect(slider.attrs.max).toBe("100");
      expect(slider.attrs.step).toBe("1");

      slider.value = "150";
      slider.dispatchEvent(new Event("input"));
      expect(store.getCurrent().database.equipment[0]?.stateResistanceChance).toBe(100);
      expect(slider.value).toBe("100");

      // 레거시 클램프 계약(databaseWave2BatchC): base testid 는 클램프+쓰기-백 입력이다.
      const base = byTestId(form, "db-field-equipment-state-resistance");
      expect(base.attrs.type).toBe("number");
      base.value = "250";
      base.dispatchEvent(new Event("input"));
      expect(base.value).toBe("100");
      expect(store.getCurrent().database.equipment[0]?.stateResistanceChance).toBe(100);
    });

    it("state infliction chance uses the same slider/stepper pair contract", () => {
      const form = renderForm();
      const inflictSlider = byTestId(form, "db-field-equipment-state-infliction-slider");
      inflictSlider.value = "101";
      inflictSlider.dispatchEvent(new Event("input"));
      expect(store.getCurrent().database.equipment[0]?.stateInflictionChance).toBe(100);
      expect(inflictSlider.value).toBe("100");
      // base testid 는 숫자 입력(stepper)에 남는다 — numberField 시절 클램프 계약.
      const base = byTestId(form, "db-field-equipment-state-infliction");
      expect(base.attrs.type).toBe("number");
    });
  });
  describe("state defense mode + effect flags (modern controls)", () => {
    it("offers only an explicit repair for legacy inflict defense settings", () => {
      updateDatabaseRecord("equipment", store.getCurrent().database.equipment[0]!.id, { stateDefenseMode: "inflict" });
      const form = renderForm();
      expect(findByTestId(form, "db-field-equipment-state-defense-mode")).toBeNull();
      byTestId(form, "db-equipment-enable-state-resistance").click();
      expect(store.getCurrent().database.equipment[0]?.stateDefenseMode).toBe("resist");
    });

    it("keeps actor/class permission checkbox testids (e2e contract)", () => {
      const form = renderForm();
      const actorId = store.getCurrent().database.actors[0]?.id;
      if (!actorId) throw new Error("fixture needs an actor");
      const actorCheck = byTestId(form, `db-field-equipment-actor-${actorId}`);
      expect(actorCheck.attrs.type).toBe("checkbox");
      actorCheck.checked = true;
      actorCheck.dispatchEvent(new Event("change"));
      expect(store.getCurrent().database.equipment[0]?.equippableActorIds).toContain(actorId);

      const klassId = store.getCurrent().database.classes[0]?.id;
      if (klassId) {
        const classCheck = byTestId(form, `db-field-equipment-class-${klassId}`);
        expect(classCheck.attrs.type).toBe("checkbox");
        classCheck.checked = true;
        classCheck.dispatchEvent(new Event("change"));
        expect(store.getCurrent().database.equipment[0]?.equippableClassIds).toContain(klassId);
      }
    });
  });
});

describe("databaseEquipmentRecordView", () => {
  isolateTimers();
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

    it("returns no optional flags or badges when all optional effects are off", () => {
      const summary = equipmentEffectSummaryChips(
        normalizeEquipmentRecord({ id: "equip_empty", name: "빈 장비", effectFlags: allFlagsFalse() }),
      );
      expect(summary.flags).toEqual([]);
      expect(summary.badges).toEqual([]);
      expect(summary.counts).toEqual(["명중률 100%", "치명타율 +0%p"]);
    });

    it("distinguishes otherwise identical equipment by accuracy and critical rate", () => {
      const first = normalizeEquipmentRecord({ id: "equip_axes_a", name: "비교 A", accuracy: 100, criticalRate: 3 });
      const second = normalizeEquipmentRecord({ id: "equip_axes_b", name: "비교 B", accuracy: 80, criticalRate: 15 });

      expect(equipmentEffectSummaryChips(first).counts).toEqual(["명중률 100%", "치명타율 +3%p"]);
      expect(equipmentEffectSummaryChips(second).counts).toEqual(["명중률 80%", "치명타율 +15%p"]);
      expect(equipmentEffectStory(store.getCurrent(), first).effects).toContain("명중률 100%");
      expect(equipmentEffectStory(store.getCurrent(), second).effects).toContain("치명타율 +15%p");
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

    // Break caught: no removed equipment does not imply an empty slot when the candidate is
    // already present in the actor's effective initial loadout.
    it("marks a candidate already equipped in the actor's effective initial loadout", () => {
      const project = store.getCurrent();
      const actor = project.database.actors[0]!;
      const candidate = normalizeEquipmentRecord({
        id: "equip_already_worn",
        name: "착용 중인 검",
        slot: "weapon",
        statBonuses: { attack: 9, defense: 0, mind: 0, agility: 0 },
        equippableActorIds: [actor.id],
      });
      actor.initialEquipment = { weapon: candidate.id };
      project.database.equipment = [candidate];

      const comparison = equipmentActorComparison(project, candidate, actor.id);

      expect(comparison?.alreadyEquipped).toBe(true);
      expect(comparison?.replacedEquipmentNames).toEqual([]);
      expect(comparison?.deltas).toEqual({ attack: 0, defense: 0, mind: 0, agility: 0 });
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
    it("edits accuracy and critical rate within 0-100 and refreshes the inspector", () => {
      seedEquipment({ accuracy: 100, criticalRate: 0 });
      const host = renderForm();
      const accuracy = findByTestId(host, "db-field-equipment-accuracy");
      const criticalRate = findByTestId(host, "db-field-equipment-critical-rate");
      if (!accuracy || !criticalRate) throw new Error("missing combat axis controls");

      expect(accuracy.attrs.min).toBe("0");
      expect(accuracy.attrs.max).toBe("100");
      expect(criticalRate.attrs.min).toBe("0");
      expect(criticalRate.attrs.max).toBe("100");
      accuracy.value = "82";
      accuracy.dispatchEvent(new Event("input"));
      criticalRate.value = "16";
      criticalRate.dispatchEvent(new Event("input"));

      expect(store.getCurrent().database.equipment[0]).toMatchObject({ accuracy: 82, criticalRate: 16 });
      expect(chipTexts(host)).toEqual(expect.arrayContaining(["명중률 82%", "치명타율 +16%p"]));
      expect(findByTestId(host, "db-equipment-effect-story")?.textContent).toContain("명중률 82%");
    });

    it("shows 2회 공격 chip when doubleAttack is true", () => {
      seedEquipment({ effectFlags: { ...allFlagsFalse(), doubleAttack: true } });
      const host = renderForm();
      expect(chipTexts(host)).toContain("2회 공격");
      expect(findByTestId(host, "db-equipment-summary-empty")).toBeNull();
    });

    it("shows combat axes instead of muted 효과 없음 when every optional effect is empty", () => {
      seedEquipment();
      const host = renderForm();
      expect(findByTestId(host, "db-equipment-summary-empty")).toBeNull();
      expect(chipTexts(host)).toEqual(["명중률 100%", "치명타율 +0%p"]);
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
      expect(findByTestId(host, "db-equipment-summary-empty")).toBeNull();

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
      expect(findByTestId(host, "db-equipment-summary-empty")).toBeNull();
      expect(chipTexts(host)).toEqual(["명중률 100%", "치명타율 +0%p"]);
    });
  });
});

describe("databaseWave2BatchC", () => {
  isolateTimers();
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
});
