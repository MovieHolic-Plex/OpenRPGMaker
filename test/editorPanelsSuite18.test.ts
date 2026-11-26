import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { renderEquipmentRecordForm, equipmentActorComparison, equipmentEffectStory, equipmentEffectSummaryChips } from "@/editor/panels/databaseEquipmentRecordView";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EquipmentRecord, ItemEquipmentEffectFlags, Command, EventPage, Project, ProjectFactions } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import { authoredFactionStance, defaultFactionStance, deleteFaction, duplicateFaction, factionMatrixCell, renameFaction, setPlayerKillReputation, setSparseFactionStance } from "@/editor/panels/databaseFactionModel";
import { setEffectiveFactionStance } from "@/project/factionRuntime";
import { deserialize, serialize } from "@/project/io";
import { resolveFactionTable } from "@/project/factions";
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

describe("databaseFactionModel", () => {
  isolateTimers();
  const FACTIONS: ProjectFactions = {
    defs: [
      { id: "guard", name: "경비병" },
      { id: "bandit", name: "산적" },
    ],
    relations: [],
  };
  function projectWithFactions(factions: ProjectFactions): Project {
    const project = createBlankProject();
    project.factions = factions;
    return project;
  }
  describe("database faction editor model", () => {
    it("shows runtime defaults while preserving whether a cell was actually authored", () => {
      const table = resolveFactionTable(FACTIONS);
      expect(factionMatrixCell(table, FACTIONS, "guard", "guard")).toEqual({ stance: 2, authored: false });
      expect(factionMatrixCell(table, FACTIONS, "guard", "bandit")).toEqual({ stance: 0, authored: false });
      expect(factionMatrixCell(table, FACTIONS, "player", "enemy")).toEqual({ stance: -1, authored: false });

      const authored = setSparseFactionStance(FACTIONS, "guard", "bandit", -1)!;
      expect(factionMatrixCell(resolveFactionTable(authored), authored, "bandit", "guard")).toEqual({ stance: -1, authored: true });
    });

    it("writes only non-default relations and removes reverse-order duplicates", () => {
      const hostile = setSparseFactionStance(FACTIONS, "guard", "bandit", -1)!;
      expect(hostile.relations).toEqual([{ a: "guard", b: "bandit", stance: -1 }]);

      const defaulted = setSparseFactionStance(hostile, "bandit", "guard", 0)!;
      expect(defaulted.relations).toEqual([]);
      expect(defaultFactionStance(defaulted, "guard", "guard")).toBe(2);
      expect(defaultFactionStance(defaulted, "player", "enemy")).toBe(-1);
    });

    it("uses the runtime more-hostile-wins resolution for imported asymmetric data", () => {
      const table = resolveFactionTable(FACTIONS);
      const guard = table.ids.indexOf("guard");
      const bandit = table.ids.indexOf("bandit");
      table.stances[guard * table.size + bandit] = 2;
      table.stances[bandit * table.size + guard] = -2;

      expect(authoredFactionStance(table, "guard", "bandit")).toBe(-2);
      expect(authoredFactionStance(table, "bandit", "guard")).toBe(-2);
    });

    it("never displays a fractional runtime overlay in the authoring matrix", () => {
      const table = resolveFactionTable(FACTIONS);
      const overrides = setEffectiveFactionStance(table, {}, "guard", "player", 0.25);
      expect(overrides).not.toEqual({});
      expect(factionMatrixCell(table, FACTIONS, "guard", "player")).toEqual({ stance: 0, authored: false });
    });

    it("rewrites every relation endpoint when a faction id changes", () => {
      const source: ProjectFactions = {
        ...FACTIONS,
        relations: [
          { a: "guard", b: "player", stance: 2 },
          { a: "bandit", b: "guard", stance: -1 },
        ],
      };
      const result = renameFaction(projectWithFactions(source), "guard", "watch");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.project.factions?.defs.map((def) => def.id)).toEqual(["watch", "bandit"]);
      expect(result.project.factions?.relations).toEqual([
        { a: "watch", b: "player", stance: 2 },
        { a: "bandit", b: "watch", stance: -1 },
      ]);
    });

    it("preserves and edits the project-wide kill reputation option across faction mutations", () => {
      const source: ProjectFactions = {
        ...FACTIONS,
        playerKillReputation: { weight: 0.75 },
        relations: [{ a: "guard", b: "bandit", stance: -1 }],
      };
      const changed = setSparseFactionStance(source, "guard", "bandit", 0)!;
      expect(changed.playerKillReputation).toEqual({ weight: 0.75 });

      const renamed = renameFaction(projectWithFactions(changed), "guard", "watch");
      expect(renamed.ok).toBe(true);
      if (!renamed.ok) return;
      expect(renamed.project.factions?.playerKillReputation).toEqual({ weight: 0.75 });

      expect(setPlayerKillReputation(renamed.project.factions, true, 0.4)?.playerKillReputation).toEqual({ weight: 0.4 });
      expect(setPlayerKillReputation(renamed.project.factions, false)?.playerKillReputation).toBeUndefined();
    });

    it("duplicates authored identity without inheriting world-lore provenance", () => {
      const source = { id: "w_iron", name: "철의 손", worldEntityId: "w_iron", aggression: 2 as const };

      const duplicated = duplicateFaction({ defs: [source], relations: [] }, source, "w_iron_1");

      expect(duplicated.defs).toEqual([
        source,
        { id: "w_iron_1", name: "철의 손 복사본", aggression: 2 },
      ]);
    });

    it("removes dangling relations on delete and refuses reserved ids", () => {
      const source: ProjectFactions = {
        ...FACTIONS,
        relations: [
          { a: "guard", b: "player", stance: 1 },
          { a: "bandit", b: "guard", stance: -1 },
          { a: "bandit", b: "enemy", stance: -2 },
        ],
      };
      const project = projectWithFactions(source);
      const result = deleteFaction(project, "guard");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.project.factions?.defs.map((def) => def.id)).toEqual(["bandit"]);
      expect(result.project.factions?.relations).toEqual([{ a: "bandit", b: "enemy", stance: -2 }]);

      expect(deleteFaction(project, "player")).toEqual({ ok: false, reason: "player와 enemy 진영은 삭제할 수 없습니다." });
      expect(renameFaction(project, "enemy", "foe")).toEqual({ ok: false, reason: "예약 진영의 ID는 바꿀 수 없습니다." });
    });

    it("rewrites all durable command operands and blocks deletion with actionable owners", () => {
      const project = projectWithFactions(FACTIONS);
      const enemy = project.database.enemies[0]!;
      project.database.enemies[0] = {
        ...enemy,
        name: "성문 경비",
        factionId: "guard",
      };
      const map = project.maps[project.startMapId]!;
      map.fieldSpawns = [{
        id: "spawn_guard",
        troopId: project.database.troops[0]!.id,
        area: { x: 0, y: 0, w: 1, h: 1 },
        factionId: "guard",
      }];
      const stanceCommand = (): Command => (
        { kind: "changeFactionStance", a: "guard", b: "player", op: "+=", value: 0.25 }
      );
      const eventPage: EventPage = {
        id: "page_guard",
        name: "경비대 평판",
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [stanceCommand()],
      };
      map.events.push({
        id: "event_guard",
        x: 1,
        y: 1,
        trigger: { kind: "action" },
        commands: [{ kind: "loop", body: [stanceCommand()] }],
        pages: [eventPage],
      });
      project.commonEvents.push({
        id: "common_guard",
        name: "경비대 공통 평판",
        trigger: "none",
        commands: [{
          kind: "fork",
          condition: { kind: "selfSwitch", key: "A", value: true },
          then: [stanceCommand()],
        }],
      });
      const troop = project.database.troops[0]!;
      troop.battleEventPages.push({
        id: "troop_guard_page",
        name: "경비대 전투 평판",
        conditions: [],
        span: "battle",
        commands: [{
          kind: "battleProcessing",
          troopId: troop.id,
          canEscape: true,
          canLose: false,
          victoryBranch: [stanceCommand()],
        }],
      });

      const blocked = deleteFaction(project, "guard");
      expect(blocked.ok).toBe(false);
      if (blocked.ok) return;
      expect(blocked.reason).toContain(`몬스터 '성문 경비' (${enemy.id})`);
      expect(blocked.reason).toContain(`맵 '${map.name}'의 필드 스폰 'spawn_guard'`);
      expect(blocked.reason).toContain(`맵 '${map.name}'의 이벤트 'event_guard'`);
      expect(blocked.reason).toContain("페이지 '경비대 평판'");
      expect(blocked.reason).toContain("커먼 이벤트 '경비대 공통 평판' (common_guard)");
      expect(blocked.reason).toContain("전투 이벤트 페이지 '경비대 전투 평판'");

      const renamed = renameFaction(project, "guard", "watch");
      expect(renamed.ok).toBe(true);
      if (!renamed.ok) return;
      expect(renamed.project.database.enemies[0]?.factionId).toBe("watch");
      expect(renamed.project.maps[project.startMapId]?.fieldSpawns?.[0]?.factionId).toBe("watch");
      expect(serialize(renamed.project)).not.toContain('"guard"');
      expect(() => deserialize(serialize(renamed.project))).not.toThrow();

      const renamedBlocked = deleteFaction(renamed.project, "watch");
      expect(renamedBlocked.ok).toBe(false);
      if (!renamedBlocked.ok) expect(renamedBlocked.reason).toContain("common_guard");
    });

    it("rewrites monster and field-spawn faction references on rename and blocks referenced deletion", () => {
      const project = projectWithFactions(FACTIONS);
      project.database.enemies[0] = { ...project.database.enemies[0]!, id: "enemy_guard", name: "성문 경비", factionId: "guard" };
      const map = project.maps[project.startMapId]!;
      map.fieldSpawns = [{
        id: "spawn_guard",
        troopId: project.database.troops[0]!.id,
        area: { x: 0, y: 0, w: 1, h: 1 },
        factionId: "guard",
      }];

      const blocked = deleteFaction(project, "guard");
      expect(blocked).toEqual({
        ok: false,
        reason: `이 진영을 사용 중이라 삭제할 수 없습니다: 몬스터 '성문 경비' (enemy_guard), 맵 '${map.name}'의 필드 스폰 'spawn_guard'`,
      });

      const renamed = renameFaction(project, "guard", "watch");
      expect(renamed.ok).toBe(true);
      if (!renamed.ok) return;
      expect(renamed.project.database.enemies[0]?.factionId).toBe("watch");
      expect(renamed.project.maps[project.startMapId]?.fieldSpawns?.[0]?.factionId).toBe("watch");
    });
  });
});
