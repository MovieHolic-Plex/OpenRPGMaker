import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { renderEquipmentRecordForm, equipmentActorComparison, equipmentEffectStory, equipmentEffectSummaryChips } from "@/editor/panels/databaseEquipmentRecordView";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EquipmentRecord, ItemEquipmentEffectFlags, Command, EventPage, Project, ProjectFactions } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom, documentListenerCount } from "./fakeDom";
import { authoredFactionStance, defaultFactionStance, deleteFaction, duplicateFaction, factionMatrixCell, renameFaction, setPlayerKillReputation, setSparseFactionStance } from "@/editor/panels/databaseFactionModel";
import { setEffectiveFactionStance } from "@/project/factionRuntime";
import { deserialize, serialize } from "@/project/io";
import { resolveFactionTable } from "@/project/factions";
import { isolateTimers } from "./mergedTeardown";
import { renderFactionsTab } from "@/editor/panels/databaseFactionView";
import { Window } from "happy-dom";
import { restoreFocusAfterRerender } from "@/editor/panels/databaseWorkspace";
import { recordListThumbnail } from "@/editor/panels/databaseRecordThumbnails";
import { renderLifeCraftingTab } from "@/editor/panels/databaseLifeCraftingView";
import { redoMapEdit, resetMapEditHistory, undoMapEdit, getMapEditHistoryState } from "@/editor/mapEditHistory";
import { toolActionRulesOf } from "@/project/toolActions";
import { computeRowWindow, createVirtualList, DEFAULT_ROW_HEIGHT, VIRTUALIZATION_THRESHOLD } from "@/editor/panels/databaseListVirtualizer";
import { el } from "@/util/dom";
import { openDatabaseModal, requestDatabaseModalClose } from "@/editor/panels/databaseModal";
import { DATABASE_FOOTER_ACTION_TEST_IDS } from "@/editor/panels/databaseWorkbench";
import { avatarChipRow, segmentedControl, sliderStepperField, toggleSwitch, type AvatarChipActor } from "@/editor/panels/databaseControls";
import { renderTroopBattleEventPanel } from "@/editor/panels/databaseTroopBattleEventPanel";
import { captureDifficulty } from "@/editor/panels/databaseCapturePreview";
import { setMonsterSpeciesSection } from "@/editor/panels/databaseMonsterSpeciesSections";
import { renderMonsterSpeciesTab } from "@/editor/panels/databaseMonsterSpeciesView";
import { openResourceModal } from "@/editor/panels/resourceModal";
import { resetModalStackForTest } from "@/editor/ui/modalStack";

describe("editorPanelsSuite18", () => {
  isolateTimers();
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
});

describe("editorPanelsSuite19", () => {
  isolateTimers();
  describe("databaseFactionView", () => {
    isolateTimers();
    let cleanupDom: (() => void) | undefined;
    let previousWindow: typeof globalThis.window | undefined;
    beforeEach(() => {
      cleanupDom = installFakeDom();
      previousWindow = globalThis.window;
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: { setTimeout: (callback: TimerHandler): number => { if (typeof callback === "function") callback(); return 0; }, clearTimeout },
      });
      store.replace(createBlankProject());
    });
    afterEach(() => {
      cleanupDom?.();
      cleanupDom = undefined;
      if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
      else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
    });
    function renderView(): FakeElement {
      const host = document.createElement("div") as unknown as FakeElement;
      const rerender = (): void => {
        host.replaceChildren();
        renderFactionsTab(host as unknown as HTMLElement, rerender);
      };
      rerender();
      return host;
    }
    describe("database faction authoring view", () => {
      it("uses the canonical workspace builders and renders accessible reserved-faction matrix cells", () => {
        const host = renderView();
        expect(host.querySelectorAll(".db-record-workspace")).toHaveLength(1);
        expect(host.querySelectorAll(".db-list-pane")).toHaveLength(1);
        expect(findByTestId(host, "db-faction-search")?.getAttribute("type")).toBe("search");

        const relation = findByTestId(host, "db-faction-relation-enemy");
        // 관계는 말로 보이고(숫자 -1 은 전문가 모드 전용 칸), 결과는 한 줄로 합쳐 보인다.
        expect(relation?.textContent).toContain("적대");
        expect(relation?.textContent).toContain("서로 먼저 공격");
        expect(findByTestId(host, "db-faction-pick-enemy--1")?.getAttribute("aria-pressed")).toBe("true");

        const cell = findByTestId(host, "db-faction-stance-player-enemy");
        expect(cell?.tagName).toBe("BUTTON");
        expect(cell?.textContent).toContain("-1");
        expect(cell?.textContent).toContain("적대");
        expect(cell?.textContent).toContain("기본");
        expect(cell?.getAttribute("aria-label")).toContain("기본");
      });

      it("creates factions and disables deletion for reserved ids", () => {
        const host = renderView();
        expect(findByTestId(host, "db-faction-delete")?.getAttribute("disabled")).toBe("true");

        findByTestId(host, "db-faction-create")?.click();
        expect(store.getCurrent().factions?.defs).toEqual([{ id: "faction_1", name: "새 진영" }]);
        expect(findByTestId(host, "db-faction-delete")?.getAttribute("disabled")).toBeNull();
        expect(findByTestId(host, "db-faction-stance-faction_1-player")?.textContent).toContain("중립");
      });

      it("changes a relation from the per-faction list and marks only the non-default value", () => {
        const project = createBlankProject();
        project.factions = { defs: [{ id: "guard", name: "경비병" }], relations: [] };
        store.replace(project);
        const host = renderView();

        const pick = findByTestId(host, "db-faction-pick-guard-1");
        expect(pick?.getAttribute("aria-pressed")).toBe("false");
        expect(findByTestId(host, "db-faction-relation-label-guard")?.textContent).toContain("기본");
        pick?.click();

        expect(store.getCurrent().factions?.relations).toEqual([{ a: "player", b: "guard", stance: 1 }]);
        expect(findByTestId(host, "db-faction-pick-guard-1")?.getAttribute("aria-pressed")).toBe("true");
        expect(findByTestId(host, "db-faction-relation-label-guard")?.textContent).toContain("바꿈");

        findByTestId(host, "db-faction-pick-guard-0")?.click();
        expect(store.getCurrent().factions?.relations).toEqual([]);
        expect(findByTestId(host, "db-faction-relation-label-guard")?.textContent).toContain("기본");
      });

      it("cycles a matrix cell and marks only the non-default value as authored", () => {
        const project = createBlankProject();
        project.factions = { defs: [{ id: "guard", name: "경비병" }], relations: [] };
        store.replace(project);
        const host = renderView();

        const cell = findByTestId(host, "db-faction-stance-player-guard");
        expect(cell?.dataset.authored).toBe("false");
        cell?.click();

        expect(store.getCurrent().factions?.relations).toEqual([{ a: "player", b: "guard", stance: 1 }]);
        expect(findByTestId(host, "db-faction-stance-player-guard")?.dataset.authored).toBe("true");
      });
      it("previews kill reputation without changing authored data", () => {
        store.update((project) => { project.factions = { defs: [{ id: "guard", name: "경비병" }], relations: [{ a: "guard", b: "enemy", stance: -1 }], playerKillReputation: { weight: 0.25 } }; });
        const before = JSON.stringify(store.getCurrent());
        const host = renderView();
        const count = findByTestId(host, "db-faction-preview-count")!;
        count.value = "4"; count.dispatchEvent(new Event("input"));
        expect(findByTestId(host, "db-faction-reputation-preview-result")?.textContent).toContain("경비병: 0 → 1");
        expect(JSON.stringify(store.getCurrent())).toBe(before);
        findByTestId(host, "db-faction-row-enemy")!.click();
        expect(findByTestId(host, `db-faction-use-enemy-${store.getCurrent().database.enemies[0]!.id}`)).toBeTruthy();
      });

      it("keeps project-wide rules and the matrix out of the per-faction view until switched", () => {
        const host = renderView();
        const paneOf = (testid: string): FakeElement | null | undefined => {
          let node = findByTestId(host, testid) as FakeElement | null | undefined;
          while (node && node.dataset?.factionView === undefined) node = node.parentElement as FakeElement | null | undefined;
          return node;
        };
        expect(paneOf("db-faction-relations")?.getAttribute("hidden")).toBeNull();
        expect(paneOf("db-faction-reputation")?.getAttribute("hidden")).not.toBeNull();
        expect(paneOf("db-faction-matrix-card")?.getAttribute("hidden")).not.toBeNull();
        // 예전 숫자 요약 띠 대신 제목줄에 소속·쓰는 곳 요약이 있다.
        expect(findByTestId(host, "db-faction-usage-toggle")?.textContent).toContain("소속 몬스터");

        findByTestId(host, "db-faction-view-rules")?.click();
        expect(paneOf("db-faction-reputation")?.getAttribute("hidden")).toBeNull();
        expect(paneOf("db-faction-relations")?.getAttribute("hidden")).not.toBeNull();
        findByTestId(host, "db-faction-view-faction")?.click();
        expect(paneOf("db-faction-relations")?.getAttribute("hidden")).toBeNull();
      });

      it("labels aggression options once, without repeating the label in the description", () => {
        const host = renderView();
        const options = findByTestId(host, "db-faction-aggression")?.querySelectorAll("option") ?? [];
        const texts = Array.from(options, (option) => (option as FakeElement).textContent ?? "");
        expect(texts).toHaveLength(4);
        for (const text of texts) expect(text).not.toContain("—");
      });
    });
  });
  describe("databaseFocusRestoration", () => {
    isolateTimers();
    let frames: FrameRequestCallback[];
    beforeEach(() => {
      const window = new Window();
      vi.stubGlobal("document", window.document);
      frames = [];
      vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
        frames.push(callback);
        return frames.length;
      });
    });
    afterEach(() => vi.unstubAllGlobals());
    function button(id: string): HTMLButtonElement {
      const node = document.createElement("button");
      node.dataset.testid = id;
      document.body.append(node);
      return node;
    }
    function frame(): void {
      const callback = frames.shift();
      if (!callback) throw new Error("missing scheduled frame");
      callback(0);
    }
    it("does not steal focus after the author moves to a CSS input", () => {
      const target = button("placed");
      const input = document.createElement("textarea");
      document.body.append(input);
      restoreFocusAfterRerender("placed", 2);
      frame();
      expect(document.activeElement).toBe(target);
      input.focus();
      frame();
      expect(document.activeElement).toBe(input);
    });
    it("allows the latest requested restoration to supersede older queued frames", () => {
      button("old");
      const latest = button("latest");
      restoreFocusAfterRerender("old", 2);
      frame();
      restoreFocusAfterRerender("latest", 2);
      frame();
      frame();
      expect(document.activeElement).toBe(latest);
      frame();
      expect(document.activeElement).toBe(latest);
      while (frames.length) frame();
      expect(document.activeElement).toBe(latest);
    });
    it("still restores focus after a second DOM replacement", () => {
      const first = button("same");
      restoreFocusAfterRerender("same", 2);
      frame();
      expect(document.activeElement).toBe(first);
      first.remove();
      const replacement = button("same");
      frame();
      expect(document.activeElement).toBe(replacement);
    });
  });
  describe("databaseImageFailurePlaceholder", () => {
    isolateTimers();
    let restoreDom: (() => void) | undefined;
    beforeEach(() => {
      restoreDom = installFakeDom();
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = undefined;
    });
    describe("Database image failure placeholders", () => {
      it("renders an unresolved shared thumbnail as a labeled non-zero placeholder", () => {
        const project = createBlankProject();
        const item = {
          ...project.database.items[0],
          name: "없는 회복약",
          iconResourceId: "missing-database-image-resource",
          imageResourceId: undefined,
        };
        const thumbnail = recordListThumbnail("items", item, project);

        expect(thumbnail).toBeInstanceOf(FakeElement);
        if (!(thumbnail instanceof FakeElement)) throw new Error("expected Database thumbnail element");

        expect(thumbnail.classList.contains("db-image-load-failed")).toBe(true);
        expect(thumbnail.classList.contains("db-image-placeholder")).toBe(true);
        expect(thumbnail.getAttribute("aria-label")).toContain("없는 회복약");
        expect(Number.parseFloat(thumbnail.style.minWidth)).toBeGreaterThan(0);
        expect(Number.parseFloat(thumbnail.style.minHeight)).toBeGreaterThan(0);
      });
    });
  });
  describe("databaseLifeCraftingView", () => {
    isolateTimers();
    function renderTab(): FakeElement {
      const host = document.createElement("div") as unknown as FakeElement;
      const rerender = (): void => {
        host.replaceChildren();
        renderLifeCraftingTab(host as unknown as HTMLElement, rerender);
      };
      rerender();
      return host;
    }
    function setValue(host: FakeElement, testid: string, value: string): void {
      const control = findByTestId(host, testid);
      if (!control) throw new Error(`missing ${testid}`);
      control.value = value;
      control.dispatchEvent(new Event("change"));
    }
    function setChecked(host: FakeElement, testid: string, checked: boolean): void {
      const control = findByTestId(host, testid);
      if (!control) throw new Error(`missing ${testid}`);
      control.checked = checked;
      control.dispatchEvent(new Event("change"));
    }
    describe("database life skill and crafting view", () => {
      let cleanupDom: (() => void) | undefined;

      beforeEach(() => {
        cleanupDom = installFakeDom();
        store.replace(createBlankProject());
        resetMapEditHistory();
      });

      afterEach(() => cleanupDom?.());

      it("materializes real defaults only on first custom-table creation, as one undoable edit", () => {
        const defaults = structuredClone(toolActionRulesOf(store.getCurrent()));
        const host = renderTab();
        findByTestId(host, "db-life-section-tool-actions")?.click();
        expect(store.getCurrent().system.toolActions).toBeUndefined();
        findByTestId(host, "db-life-add")?.click();
        expect(store.getCurrent().system.toolActions).toHaveLength(5);
        expect(store.getCurrent().system.toolActions?.slice(1)).toEqual(defaults);
        expect(store.getCurrent().system.toolActions?.[0]?.itemId).toBeUndefined();
        expect(undoMapEdit()).toBe(true);
        expect(store.getCurrent().system.toolActions).toBeUndefined();
        expect(redoMapEdit()).toBe(true);
        expect(store.getCurrent().system.toolActions?.slice(1)).toEqual(defaults);
      });

      it("appends to existing tables without merging and preserves false through editing and load", () => {
        store.update((project) => { project.system.toolActions = [{ id: "existing", action: "till", farmTool: "hoe" }]; });
        const host = renderTab();
        findByTestId(host, "db-life-section-tool-actions")?.click();
        findByTestId(host, "db-life-row-existing")?.click();
        expect(findByTestId(host, "db-life-tool-requires-farmable")?.checked).toBe(true);
        setChecked(host, "db-life-tool-requires-farmable", false);
        expect(store.getCurrent().system.toolActions?.[0]?.requiresFarmable).toBe(false);
        expect(deserialize(serialize(store.getCurrent())).system.toolActions?.[0]?.requiresFarmable).toBe(false);
        findByTestId(host, "db-life-add")?.click();
        expect(store.getCurrent().system.toolActions).toHaveLength(2);
        expect(store.getCurrent().system.toolActions?.[0]?.id).toBe("existing");
      });

      // Break caught: life skill records have no list/detail editor or reward controls.
      it("authors a life skill and level reward, then undo restores the prior record", () => {
        const host = renderTab();
        findByTestId(host, "db-life-section-skills")?.click();
        findByTestId(host, "db-life-add")?.click();
        setValue(host, "db-life-skill-name", "농사");
        setValue(host, "db-life-skill-type", "farming");
        setValue(host, "db-life-skill-max-level", "10");
        findByTestId(host, "db-life-skill-reward-add")?.click();
        setValue(host, "db-life-skill-reward-level-0", "5");
        setValue(host, "db-life-skill-reward-switch-0", store.getCurrent().switches[0]?.id ?? "");

        expect(store.getCurrent().database.lifeSkills?.[0]).toMatchObject({
          name: "농사",
          skillType: "farming",
          maxLevel: 10,
          levelUpRewards: [{ level: 5 }],
        });
        expect(undoMapEdit()).toBe(true);
      });

      // Break caught: recipe ingredients and output only appear as a count in System.
      it("authors a recipe with ingredient and output item references", () => {
        const host = renderTab();
        findByTestId(host, "db-life-section-recipes")?.click();
        findByTestId(host, "db-life-add")?.click();
        const itemId = store.getCurrent().database.items[0]?.id ?? "";
        setValue(host, "db-life-recipe-name", "간식 만들기");
        setValue(host, "db-life-recipe-output-item", itemId);
        setValue(host, "db-life-recipe-output-count", "2");
        findByTestId(host, "db-life-recipe-ingredient-add")?.click();
        setValue(host, "db-life-recipe-ingredient-item-0", itemId);
        setValue(host, "db-life-recipe-ingredient-count-0", "3");

        expect(store.getCurrent().system.craftRecipes?.[0]).toMatchObject({
          name: "간식 만들기",
          outputItemId: itemId,
          outputCount: 2,
          ingredients: [{ itemId, count: 3 }],
        });
      });

      // Break caught: upgrades, prices, and tool actions have no structured record editor.
      it("authors upgrade, sell-price, and tool-action records through their detail forms", () => {
        const host = renderTab();
        const itemId = store.getCurrent().database.items[0]?.id ?? "";

        findByTestId(host, "db-life-section-upgrades")?.click();
        findByTestId(host, "db-life-add")?.click();
        setValue(host, "db-life-upgrade-from-item", itemId);
        setValue(host, "db-life-upgrade-to-item", itemId);
        setValue(host, "db-life-upgrade-gold-cost", "250");

        findByTestId(host, "db-life-section-sell-prices")?.click();
        findByTestId(host, "db-life-add")?.click();
        setValue(host, "db-life-sell-item", itemId);
        setValue(host, "db-life-sell-price", "80");

        findByTestId(host, "db-life-section-tool-actions")?.click();
        findByTestId(host, "db-life-add")?.click();
        setValue(host, "db-life-tool-item", itemId);
        setValue(host, "db-life-tool-farm-tool", "hoe");
        setValue(host, "db-life-tool-action", "till");

        expect(store.getCurrent().system.itemUpgrades?.[0]).toMatchObject({ fromItemId: itemId, toItemId: itemId, goldCost: 250 });
        expect(store.getCurrent().system.sellPrices?.[0]).toEqual({ itemId, price: 80 });
        expect(store.getCurrent().system.toolActions?.[0]).toMatchObject({ itemId, farmTool: "hoe", action: "till" });

        const restored = deserialize(serialize(store.getCurrent()));
        expect(restored.system.itemUpgrades?.[0]).toMatchObject({ fromItemId: itemId, toItemId: itemId, goldCost: 250 });
        expect(restored.system.sellPrices?.[0]).toEqual({ itemId, price: 80 });
        expect(restored.system.toolActions?.[0]).toMatchObject({ itemId, farmTool: "hoe", action: "till" });
      });

      // Break caught: editing an id or adding another sell row can create ambiguous duplicate keys.
      it("rejects duplicate record ids and chooses an unused sell-price item", () => {
        const host = renderTab();
        for (const section of ["skills", "recipes", "upgrades", "tool-actions"] as const) {
          findByTestId(host, `db-life-section-${section}`)?.click();
          findByTestId(host, "db-life-add")?.click();
          findByTestId(host, "db-life-add")?.click();
          const records = section === "skills"
            ? store.getCurrent().database.lifeSkills ?? []
            : section === "recipes"
              ? store.getCurrent().system.craftRecipes ?? []
              : section === "upgrades"
                ? store.getCurrent().system.itemUpgrades ?? []
                : store.getCurrent().system.toolActions ?? [];
          const firstId = records[0]?.id;
          const secondId = records.at(-1)?.id;
          if (!firstId || !secondId) throw new Error(`missing ${section} ids`);
          const prefix = section === "skills" ? "skill" : section === "recipes" ? "recipe" : section === "upgrades" ? "upgrade" : "tool";
          setValue(host, `db-life-${prefix}-id`, firstId);
          const after = section === "skills"
            ? store.getCurrent().database.lifeSkills ?? []
            : section === "recipes"
              ? store.getCurrent().system.craftRecipes ?? []
              : section === "upgrades"
                ? store.getCurrent().system.itemUpgrades ?? []
                : store.getCurrent().system.toolActions ?? [];
          expect(after.at(-1)?.id).toBe(secondId);
        }

        findByTestId(host, "db-life-section-sell-prices")?.click();
        findByTestId(host, "db-life-add")?.click();
        findByTestId(host, "db-life-add")?.click();
        const prices = store.getCurrent().system.sellPrices ?? [];
        expect(prices).toHaveLength(2);
        expect(prices[0]?.itemId).not.toBe(prices[1]?.itemId);
      });

      // Break caught: deleting records leaves craftRecipe/applyItemUpgrade/changeLifeSkillExp commands dangling.
      it("blocks deletion while event commands reference the selected life records", () => {
        const project = createBlankProject();
        const itemId = project.database.items[0]?.id ?? "";
        project.database.lifeSkills = [{ id: "life_ref", name: "농사", skillType: "farming", maxLevel: 10, levelUpRewards: [] }];
        project.system.craftRecipes = [{ id: "recipe_ref", ingredients: [], outputItemId: itemId }];
        project.system.itemUpgrades = [{ id: "upgrade_ref", fromItemId: itemId, toItemId: itemId }];
        project.maps[project.startMapId]?.events.push({
          id: "life_commands",
          x: 0,
          y: 0,
          trigger: { kind: "action" },
          commands: [
            { kind: "changeLifeSkillExp", skillId: "life_ref", op: "+=", amount: 1 },
            { kind: "craftRecipe", recipeId: "recipe_ref" },
            { kind: "applyItemUpgrade", upgradeId: "upgrade_ref" },
          ],
        });
        store.replace(project);
        const host = renderTab();

        for (const section of ["skills", "recipes", "upgrades"] as const) {
          findByTestId(host, `db-life-section-${section}`)?.click();
          findByTestId(host, "db-life-delete")?.click();
        }

        expect(store.getCurrent().database.lifeSkills).toHaveLength(1);
        expect(store.getCurrent().system.craftRecipes).toHaveLength(1);
        expect(store.getCurrent().system.itemUpgrades).toHaveLength(1);
      });

      // Break caught: the runtime understands locked recipes and upgraded tool reach,
      // but the structured editor drops those fields because it has no controls for them.
      it("authors recipe unlock requirements and tool capability fields", () => {
        const host = renderTab();

        findByTestId(host, "db-life-section-recipes")?.click();
        findByTestId(host, "db-life-add")?.click();
        setChecked(host, "db-life-recipe-requires-unlock", true);

        findByTestId(host, "db-life-section-upgrades")?.click();
        findByTestId(host, "db-life-add")?.click();
        setChecked(host, "db-life-upgrade-capability-enabled", true);
        setValue(host, "db-life-upgrade-area-width", "3");
        setValue(host, "db-life-upgrade-area-height", "2");
        setValue(host, "db-life-upgrade-energy-multiplier", "0.75");

        expect(store.getCurrent().system.craftRecipes?.[0]?.requiresUnlock).toBe(true);
        expect(store.getCurrent().system.itemUpgrades?.[0]?.capability).toEqual({
          areaWidth: 3,
          areaHeight: 2,
          energyMultiplier: 0.75,
        });
        const restored = deserialize(serialize(store.getCurrent()));
        expect(restored.system.craftRecipes?.[0]?.requiresUnlock).toBe(true);
        expect(restored.system.itemUpgrades?.[0]?.capability?.areaWidth).toBe(3);
      });

      it("clamps authored tool capability axes to the runtime-safe 9x9 limit", () => {
        const host = renderTab();
        findByTestId(host, "db-life-section-upgrades")?.click();
        findByTestId(host, "db-life-add")?.click();
        setChecked(host, "db-life-upgrade-capability-enabled", true);

        setValue(host, "db-life-upgrade-area-width", "99");
        setValue(host, "db-life-upgrade-area-height", "999999");

        expect(store.getCurrent().system.itemUpgrades?.[0]?.capability).toMatchObject({ areaWidth: 9, areaHeight: 9 });
      });

      // Break caught: energy and shipping are schema-only packages and shipping's
      // enabled toggle must not erase history/item policy while it is off.
      it("creates energy and shipping settings and preserves disabled shipping values", () => {
        const host = renderTab();

        findByTestId(host, "db-life-section-energy")?.click();
        expect(findByTestId(host, "db-life-package-create")).not.toBeNull();
        findByTestId(host, "db-life-package-create")?.click();
        setValue(host, "db-life-energy-max", "180");
        setValue(host, "db-life-energy-initial", "120");
        setValue(host, "db-life-energy-restore", "90");

        findByTestId(host, "db-life-section-shipping")?.click();
        findByTestId(host, "db-life-package-create")?.click();
        setValue(host, "db-life-shipping-history-limit", "14");
        const itemId = store.getCurrent().database.items[0]?.id;
        if (!itemId) throw new Error("missing default item");
        setChecked(host, "db-life-shipping-all-items", false);
        setChecked(host, `db-life-shipping-item-${itemId}`, true);
        setChecked(host, "db-life-shipping-enabled", false);

        expect(store.hasUnsavedChanges()).toBe(true);
        expect(store.getCurrent().system.energy).toEqual({ max: 180, initial: 120, restorePerDay: 90 });
        expect(store.getCurrent().system.shipping).toEqual({
          enabled: false,
          historyLimit: 14,
          allowedItemIds: [itemId],
        });
        expect(findByTestId(host, "db-life-shipping-history-limit")?.value).toBe("14");
      });

      // Break caught (2026-09-09 native editor QA v13): unchecking a single item
      // materializes allowedItemIds (undefined -> array) but the per-item handler did
      // not rerender, so "판매 가능한 모든 아이템" stayed checked while one item was
      // excluded. That control writes `checked ? undefined : []` from its NEW checked
      // state, so one click on the stale-checked box wiped the whole shipping list.
      it("clears the all-items checkbox once a single item is excluded, so one click cannot wipe the list", () => {
        const host = renderTab();
        findByTestId(host, "db-life-section-shipping")?.click();
        findByTestId(host, "db-life-package-create")?.click();

        const allItemIds = store.getCurrent().database.items.map((item) => item.id);
        const excluded = allItemIds[0];
        if (!excluded || allItemIds.length < 2) throw new Error("need at least two default items");

        // Starts as "all allowed": undefined, and the header renders checked.
        expect(store.getCurrent().system.shipping?.allowedItemIds).toBeUndefined();
        expect(findByTestId(host, "db-life-shipping-all-items")?.checked).toBe(true);

        setChecked(host, `db-life-shipping-item-${excluded}`, false);

        // The project now holds every id except the excluded one...
        expect(store.getCurrent().system.shipping?.allowedItemIds).toEqual(
          allItemIds.filter((id) => id !== excluded),
        );
        // ...and the header must no longer claim every item is shippable.
        expect(findByTestId(host, "db-life-shipping-all-items")?.checked).toBe(false);

        // Therefore the next click on it means "select all", not "clear everything".
        setChecked(host, "db-life-shipping-all-items", true);
        expect(store.getCurrent().system.shipping?.allowedItemIds).toBeUndefined();
      });

      // Break caught: world unlock, bundle, and maker records have no discoverable
      // add/detail/duplicate/delete workflow even though they are persisted by ProjectIO.
      it("authors world unlock, bundle rewards, and maker processing without raw JSON", () => {
        const project = createBlankProject();
        project.switches.push({ id: "sw_unlock", name: "해금" });
        store.replace(project);
        const host = renderTab();
        const itemId = store.getCurrent().database.items[0]?.id;
        if (!itemId) throw new Error("missing default item");

        findByTestId(host, "db-life-section-world-unlocks")?.click();
        findByTestId(host, "db-life-empty-add")?.click();
        setValue(host, "db-life-world-unlock-id", "unlock_bridge");
        setValue(host, "db-life-world-unlock-name", "다리 수리");
        setValue(host, "db-life-world-unlock-switch", "sw_unlock");
        findByTestId(host, "db-life-duplicate")?.click();
        expect(store.getCurrent().system.worldUnlocks).toHaveLength(2);
        expect(store.getCurrent().system.worldUnlocks?.[1]?.id).not.toBe("unlock_bridge");

        findByTestId(host, "db-life-section-recipes")?.click();
        findByTestId(host, "db-life-add")?.click();
        const recipeId = store.getCurrent().system.craftRecipes?.[0]?.id;
        if (!recipeId) throw new Error("missing recipe");

        findByTestId(host, "db-life-section-bundles")?.click();
        findByTestId(host, "db-life-empty-add")?.click();
        setValue(host, "db-life-bundle-name", "봄 채집 꾸러미");
        findByTestId(host, "db-life-bundle-requirement-add")?.click();
        setValue(host, "db-life-bundle-requirement-item-0", itemId);
        setValue(host, "db-life-bundle-requirement-count-0", "5");
        setValue(host, "db-life-bundle-reward-gold", "500");
        findByTestId(host, "db-life-bundle-reward-item-add")?.click();
        setValue(host, "db-life-bundle-reward-item-item-0", itemId);
        setValue(host, "db-life-bundle-reward-item-count-0", "2");
        setValue(host, "db-life-bundle-reward-switch", "sw_unlock");
        setChecked(host, "db-life-bundle-unlock-unlock_bridge", true);
        setChecked(host, `db-life-bundle-recipe-${recipeId}`, true);

        findByTestId(host, "db-life-section-makers")?.click();
        findByTestId(host, "db-life-empty-add")?.click();
        setValue(host, "db-life-maker-name", "치즈 프레스");
        setValue(host, "db-life-maker-duration", "120");
        findByTestId(host, "db-life-maker-input-add")?.click();
        setValue(host, "db-life-maker-input-item-0", itemId);
        setValue(host, "db-life-maker-input-count-0", "1");
        findByTestId(host, "db-life-maker-output-add")?.click();
        setValue(host, "db-life-maker-output-item-0", itemId);
        setValue(host, "db-life-maker-output-count-0", "1");

        expect(store.getCurrent().system.bundles?.[0]).toMatchObject({
          name: "봄 채집 꾸러미",
          requirements: [{ itemId, count: 5 }],
          reward: {
            gold: 500,
            itemRewards: [{ itemId, count: 2 }],
            switchId: "sw_unlock",
            worldUnlockIds: ["unlock_bridge"],
            recipeIds: [recipeId],
          },
        });
        expect(store.getCurrent().system.makers?.[0]).toMatchObject({
          name: "치즈 프레스",
          durationMinutes: 120,
          inputs: [{ itemId, count: 1 }],
          outputs: [{ itemId, count: 1 }],
        });
        expect(deserialize(serialize(store.getCurrent())).system.bundles?.[0]?.reward?.recipeIds).toEqual([recipeId]);
      });

      // Break caught: duplicate ids and deleting a reward target can make package
      // references ambiguous or dangling; undo must also cover collection actions.
      it("rejects duplicate package ids, guards reward targets, and records undo", () => {
        const project = createBlankProject();
        const itemId = project.database.items[0]?.id ?? "";
        project.system.worldUnlocks = [{ id: "unlock_mine", name: "광산" }];
        project.system.craftRecipes = [{ id: "recipe_gate", ingredients: [], outputItemId: itemId }];
        project.system.bundles = [{
          id: "bundle_gate",
          requirements: [{ itemId, count: 1 }],
          reward: { worldUnlockIds: ["unlock_mine"], recipeIds: ["recipe_gate"] },
        }];
        store.replace(project);
        const host = renderTab();

        findByTestId(host, "db-life-section-world-unlocks")?.click();
        findByTestId(host, "db-life-add")?.click();
        const secondId = store.getCurrent().system.worldUnlocks?.[1]?.id;
        if (!secondId) throw new Error("missing second unlock");
        setValue(host, "db-life-world-unlock-id", "unlock_mine");
        expect(store.getCurrent().system.worldUnlocks?.[1]?.id).toBe(secondId);

        findByTestId(host, "db-life-delete")?.click();
        expect(store.getCurrent().system.worldUnlocks).toHaveLength(1);
        expect(undoMapEdit()).toBe(true);
        expect(store.getCurrent().system.worldUnlocks).toHaveLength(2);

        findByTestId(host, "db-life-section-world-unlocks")?.click();
        findByTestId(host, "db-life-row-unlock_mine")?.click();
        findByTestId(host, "db-life-delete")?.click();
        expect(store.getCurrent().system.worldUnlocks?.some((entry) => entry.id === "unlock_mine")).toBe(true);

        findByTestId(host, "db-life-section-recipes")?.click();
        findByTestId(host, "db-life-row-recipe_gate")?.click();
        findByTestId(host, "db-life-delete")?.click();
        expect(store.getCurrent().system.craftRecipes).toHaveLength(1);
      });

      it("blocks renaming referenced skill, recipe, upgrade, and world-unlock ids", () => {
        // Break caught: delete guards protect references, but editing the same ID
        // field immediately leaves event and bundle references dangling.
        const project = createBlankProject();
        const itemId = project.database.items[0]?.id ?? "";
        project.database.lifeSkills = [{ id: "life_ref", name: "농사", skillType: "farming", maxLevel: 5, levelUpRewards: [] }];
        project.system.craftRecipes = [{ id: "recipe_ref", ingredients: [], outputItemId: itemId }];
        project.system.itemUpgrades = [{ id: "upgrade_ref", fromItemId: itemId, toItemId: itemId }];
        project.system.worldUnlocks = [{ id: "unlock_ref", name: "다리" }];
        project.system.bundles = [{
          id: "bundle_ref",
          requirements: [{ itemId, count: 1 }],
          reward: { recipeIds: ["recipe_ref"], worldUnlockIds: ["unlock_ref"] },
        }];
        project.maps[project.startMapId]?.events.push({
          id: "rename_refs",
          x: 0,
          y: 0,
          trigger: { kind: "action" },
          commands: [
            { kind: "changeLifeSkillExp", skillId: "life_ref", op: "+=", amount: 1 },
            { kind: "craftRecipe", recipeId: "recipe_ref" },
            { kind: "applyItemUpgrade", upgradeId: "upgrade_ref" },
          ],
        });
        store.replace(project);
        const host = renderTab();

        for (const [section, row, field, original] of [
          ["skills", "life_ref", "skill", "life_ref"],
          ["recipes", "recipe_ref", "recipe", "recipe_ref"],
          ["upgrades", "upgrade_ref", "upgrade", "upgrade_ref"],
          ["world-unlocks", "unlock_ref", "world-unlock", "unlock_ref"],
        ] as const) {
          findByTestId(host, `db-life-section-${section}`)?.click();
          findByTestId(host, `db-life-row-${row}`)?.click();
          setValue(host, `db-life-${field}-id`, `${original}_renamed`);
        }

        expect(store.getCurrent().database.lifeSkills?.[0]?.id).toBe("life_ref");
        expect(store.getCurrent().system.craftRecipes?.[0]?.id).toBe("recipe_ref");
        expect(store.getCurrent().system.itemUpgrades?.[0]?.id).toBe("upgrade_ref");
        expect(store.getCurrent().system.worldUnlocks?.[0]?.id).toBe("unlock_ref");
      });

      it("keeps section switching in a tab strip and does not dump every section into the empty detail", () => {
        const host = renderTab();
        findByTestId(host, "db-life-section-skills")?.click();
        const header = findByTestId(host, "db-life-crafting-header");
        expect(header).not.toBeNull();
        expect(header?.querySelector("h2")).toBeNull();
        expect(findByTestId(host, "db-life-section-makers")).not.toBeNull();
        expect(findByTestId(host, "db-life-empty-add")).not.toBeNull();
        expect(findByTestId(host, "db-life-board-makers")).toBeNull();
        expect(findByTestId(host, "db-life-stats")).toBeNull();
        expect(findByTestId(host, "db-life-list-pane-skills")).not.toBeNull();

        findByTestId(host, "db-life-section-energy")?.click();
        expect(findByTestId(host, "db-life-list-pane-energy")).not.toBeNull();
        expect(findByTestId(host, "db-life-package-create")).not.toBeNull();
        expect(findByTestId(host, "db-life-board-skills")).toBeNull();
      });
    });
  });
  describe("databaseListVirtualizer", () => {
    isolateTimers();
    describe("computeRowWindow", () => {
      it("renders everything when the total is at or below the threshold", () => {
        expect(computeRowWindow({ total: 40, scrollTop: 999, viewportHeight: 300, threshold: 80 })).toEqual({
          start: 0,
          end: 40,
        });
      });

      it("renders everything when the viewport height is unknown (0)", () => {
        expect(computeRowWindow({ total: 500, scrollTop: 4000, viewportHeight: 0 })).toEqual({ start: 0, end: 500 });
      });

      it("windows a large list around the scroll position with overscan", () => {
        const window = computeRowWindow({
          total: 1000,
          scrollTop: 100 * DEFAULT_ROW_HEIGHT,
          viewportHeight: 10 * DEFAULT_ROW_HEIGHT,
          overscan: 5,
          threshold: 80,
        });
        // firstVisible = 100, visibleCount = 10, overscan = 5 -> [95, 115)
        expect(window).toEqual({ start: 95, end: 115 });
        expect(window.end - window.start).toBeLessThan(1000);
      });

      it("clamps the window to the list bounds", () => {
        const window = computeRowWindow({
          total: 200,
          scrollTop: 500 * DEFAULT_ROW_HEIGHT,
          viewportHeight: 8 * DEFAULT_ROW_HEIGHT,
          overscan: 4,
          threshold: 80,
        });
        expect(window.start).toBeGreaterThanOrEqual(0);
        expect(window.end).toBe(200);
        expect(window.start).toBeLessThanOrEqual(200);
      });

      it("returns an empty window for an empty list", () => {
        expect(computeRowWindow({ total: 0, scrollTop: 0, viewportHeight: 300 })).toEqual({ start: 0, end: 0 });
      });

      it("exposes a sensible default threshold", () => {
        expect(VIRTUALIZATION_THRESHOLD).toBeGreaterThan(0);
      });

      it("windows by full rows when columns > 1 (grid math)", () => {
        // 133 items ÷ 4 columns = 34 rows. viewport 400px / rowHeight 120px = 4 visible rows.
        const window = computeRowWindow({
          total: 133,
          scrollTop: 0,
          viewportHeight: 400,
          rowHeight: 120,
          columns: 4,
          overscan: 0,
          threshold: 80,
        });
        // endRow = min(34, 0 + 4 + 0) = 4 → items [0, 16). start 는 항상 columns 의 배수다.
        expect(window).toEqual({ start: 0, end: 16 });
        expect(window.start % 4).toBe(0);
        expect(window.end - window.start).toBeLessThan(133);
      });

      it("keeps the window row-aligned at depth (start is a multiple of columns)", () => {
        const window = computeRowWindow({
          total: 200,
          scrollTop: 10 * 120,
          viewportHeight: 400,
          rowHeight: 120,
          columns: 3,
          overscan: 2,
          threshold: 80,
        });
        expect(window.start % 3).toBe(0);
        expect(window.start).toBeGreaterThanOrEqual(0);
        expect(window.end).toBeLessThanOrEqual(200);
        expect(window.start).toBeLessThan(window.end);
      });

      it("clamps the last row to the item count when the total is not divisible", () => {
        // 10 items ÷ 3 columns = 4 rows (last row holds 1 item).
        const window = computeRowWindow({
          total: 10,
          scrollTop: 0,
          viewportHeight: 400,
          rowHeight: 120,
          columns: 3,
          overscan: 0,
          threshold: 80,
        });
        // total(10) <= threshold(80) → 전부 렌더. end 가 항목 수로 클램프된다.
        expect(window).toEqual({ start: 0, end: 10 });
      });

      it("applies the threshold to the item count, not the row count", () => {
        // 100 items ÷ 4 columns = 25 rows — 행 수는 임계값(80) 이하여도 항목 수가 넘으면 윈도잉.
        const window = computeRowWindow({
          total: 100,
          scrollTop: 0,
          viewportHeight: 400,
          rowHeight: 120,
          columns: 4,
          overscan: 0,
          threshold: 80,
        });
        expect(window.end - window.start).toBeLessThan(100);
      });

      it("guards columns > total and degenerate columns values without crashing", () => {
        // columns(1000) > total(500): rows=1 → 전체가 한 행으로 렌더된다 (0 나눗셈 없음).
        const wide = computeRowWindow({
          total: 500,
          scrollTop: 0,
          viewportHeight: 400,
          rowHeight: 120,
          columns: 1000,
          overscan: 0,
          threshold: 0,
        });
        expect(wide).toEqual({ start: 0, end: 500 });

        // columns 0 / 음수 / NaN 은 기본 1 로 폴백 — columns 미지정과 동일한 결과.
        const baseline = computeRowWindow({ total: 500, scrollTop: 0, viewportHeight: 400, rowHeight: 120, overscan: 0, threshold: 0 });
        for (const broken of [0, -3, Number.NaN]) {
          expect(computeRowWindow({ total: 500, scrollTop: 0, viewportHeight: 400, rowHeight: 120, columns: broken, overscan: 0, threshold: 0 })).toEqual(baseline);
        }
      });

      it("columns=1 produces identical math to the default (single column)", () => {
        const withDefault = computeRowWindow({ total: 1000, scrollTop: 100 * DEFAULT_ROW_HEIGHT, viewportHeight: 10 * DEFAULT_ROW_HEIGHT, overscan: 5, threshold: 80 });
        const withOne = computeRowWindow({ total: 1000, scrollTop: 100 * DEFAULT_ROW_HEIGHT, viewportHeight: 10 * DEFAULT_ROW_HEIGHT, columns: 1, overscan: 5, threshold: 80 });
        expect(withOne).toEqual(withDefault);
      });
    });
    describe("createVirtualList", () => {
      it("renders all rows when geometry is unavailable (fake DOM) and re-renders windowed slices", () => {
        const restore = installFakeDom();
        try {
          const items = Array.from({ length: 300 }, (_, index) => index);
          const list = createVirtualList<number>({
            items,
            rowHeight: DEFAULT_ROW_HEIGHT,
            renderRow: (value) => el("button", { dataset: { row: String(value) }, text: String(value) }),
          });
          const container = list.element;
          if (!(container instanceof FakeElement)) throw new Error("expected fake element");
          const rowsHost = container.querySelector(".db-virtual-rows");
          // 높이를 측정할 수 없으면 전부 렌더된다.
          expect(rowsHost?.childNodes.length).toBe(300);

          // 뷰포트/스크롤을 부여하면 보이는 슬라이스만 렌더한다.
          (container as unknown as { clientHeight: number }).clientHeight = 10 * DEFAULT_ROW_HEIGHT;
          (container as unknown as { scrollTop: number }).scrollTop = 100 * DEFAULT_ROW_HEIGHT;
          list.render();
          const windowedCount = container.querySelector(".db-virtual-rows")?.childNodes.length ?? 0;
          expect(windowedCount).toBeGreaterThan(0);
          expect(windowedCount).toBeLessThan(300);
        } finally {
          restore();
        }
      });

      it("renders grid rows with columns: spacers cover full rows and the CSS var is set", () => {
        const restore = installFakeDom();
        try {
          const items = Array.from({ length: 133 }, (_, index) => index);
          const list = createVirtualList<number>({
            items,
            rowHeight: 120,
            columns: 4,
            renderRow: (value) => el("button", { dataset: { card: String(value) }, text: String(value) }),
          });
          const container = list.element;
          if (!(container instanceof FakeElement)) throw new Error("expected fake element");

          // 뷰포트/스크롤을 부여하면 행 단위로 윈도잉된다 (rows=34, visible 4행 + overscan).
          (container as unknown as { clientHeight: number }).clientHeight = 400;
          (container as unknown as { scrollTop: number }).scrollTop = 0;
          list.render();
          const rowsHost = container.querySelector(".db-virtual-rows");
          const renderedCount = rowsHost?.childNodes.length ?? 0;
          expect(renderedCount).toBeGreaterThan(0);
          expect(renderedCount).toBeLessThan(133);
          expect(renderedCount % 4).toBe(0);

          // 스페이서는 '행' 단위 — 상단 0행, 하단 (34 - endRow)행.
          const topSpacer = container.querySelector(".db-virtual-spacer-top");
          const bottomSpacer = container.querySelector(".db-virtual-spacer-bottom");
          expect(topSpacer?.style.height).toBe("0px");
          const endRow = Math.ceil(renderedCount / 4);
          expect(bottomSpacer?.style.height).toBe(`${(34 - endRow) * 120}px`);

          // CSS 그리드용 커스텀 프로퍼티가 컨테이너에 심긴다.
          expect(container.style.getPropertyValue("--db-gallery-columns")).toBe("4");
        } finally {
          restore();
        }
      });

      it("supports a columns resolver function called with the container (width-responsive)", () => {
        const restore = installFakeDom();
        try {
          const items = Array.from({ length: 133 }, (_, index) => index);
          const resolver = vi.fn(() => 3);
          const list = createVirtualList<number>({
            items,
            columns: resolver,
            renderRow: (value) => el("button", { dataset: { card: String(value) }, text: String(value) }),
          });
          expect(resolver.mock.calls.length).toBeGreaterThan(0);
          expect(resolver.mock.calls[0]?.[0]).toBe(list.element);
          expect(list.element.style.getPropertyValue("--db-gallery-columns")).toBe("3");
        } finally {
          restore();
        }
      });
    });
  });
  describe("databaseModalFooter", () => {
    isolateTimers();
    let restoreDom: (() => void) | undefined;
    beforeEach(() => {
      restoreDom = installFakeDom();
      store.replace(createBlankProject());
      resetMapEditHistory();
    });
    afterEach(() => {
      document.querySelector("[data-testid='database-modal']")?.remove();
      restoreDom?.();
      restoreDom = undefined;
    });
    function footerButtons(): HTMLElement[] {
      // 레코드 목록 바닥의 "최대 개수" 버튼도 같은 클래스를 재사용하므로, 모달 footer 노드 자체에서
      // 검색해 (fakeDom 셀렉터 엔진은 콤비네이터를 지원하지 않으므로) 스코프를 좁힌다.
      const footer = document.querySelector<HTMLElement>(".database-modal-footer");
      if (!footer) throw new Error("Expected database modal footer");
      return Array.from(footer.querySelectorAll<HTMLElement>(".database-footer-button"));
    }
    describe("database modal footer — honest auto-save UI", () => {
      it("states that edits auto-save and does not mention the nonexistent OK button", () => {
        openDatabaseModal("actors");

        const status = document.querySelector<HTMLElement>("[data-testid='db-footer-status']");
        expect(status?.textContent).toContain("자동 저장");
        expect(status?.textContent).not.toContain("OK");
      });

      // 도움말·되돌리기(Ctrl+Z)는 머리줄 ⋯ 안으로 옮겼다(impl-database PR-D) — 발 줄에는 저장 결정만 남는다.
      it("keeps dismissal in the header, rare actions behind the header ⋯, and only saving in the footer", () => {
        openDatabaseModal("actors");

        const labels = footerButtons().map((button) => button.textContent);
        expect(labels).toEqual(["지금 저장"]);
        const menu = document.querySelector<HTMLElement>("[data-testid='database-modal-more-menu']");
        expect(menu?.hidden).toBe(true);
        document.querySelector<HTMLElement>("[data-testid='database-modal-more']")?.click();
        expect(menu?.hidden).toBe(false);
        expect(["database-dock-toggle", "database-modal-maximize", "database-footer-help", "database-footer-undo"]
          .every((testid) => menu?.querySelector(`[data-testid='${testid}']`))).toBe(true);
        // 메뉴 밖(본문)을 누르면 닫힌다 — 열린 채로 남아 오른쪽 칸을 가리던 결함.
        document.querySelector<HTMLElement>(".database-modal-body")?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
        expect(menu?.hidden).toBe(true);
        expect(document.querySelector("[data-testid='database-footer-cancel']")).toBeNull();

        const applyButton = document.querySelector<HTMLElement>(`[data-testid='${DATABASE_FOOTER_ACTION_TEST_IDS.apply}']`);
        expect(applyButton?.textContent).toBe("지금 저장");
      });

      // 「지금 저장」은 자동 저장과 같은 일이라 평소에는 숨고, 저장이 실패하면 다시 보인다(btn-trim-r2).
      it("hides 「지금 저장」 and the empty footer while auto-save works", () => {
        openDatabaseModal("actors");
        const applyButton = document.querySelector<HTMLElement>(`[data-testid='${DATABASE_FOOTER_ACTION_TEST_IDS.apply}']`);
        const footer = document.querySelector<HTMLElement>(".database-modal-footer");
        expect(applyButton?.hidden).toBe(true);
        expect(footer?.hidden).toBe(true);
      });

      it("closes and keeps store edits from the header X", () => {
        openDatabaseModal("actors");
        const actorId = store.getCurrent().database.actors[0]?.id ?? "";
        updateDatabaseRecord("actors", actorId, { name: "Dirty Actor" });

        document.querySelector<HTMLElement>("[data-testid='database-modal-close']")?.click();

        expect(document.querySelector("[data-testid='database-modal']")).toBeNull();
        expect(store.getCurrent().database.actors.find((actor) => actor.id === actorId)?.name).toBe("Dirty Actor");
      });

      // 1255da55cc: 레코드 편집은 자동 저장이 이어받으므로 Escape 도 X·「닫기」처럼 바로 닫고 편집을 남긴다.
      // 닫기를 붙잡는 것은 스토어 밖의 설정집 카드 초안뿐이다.
      it("Escape closes like 닫기 and keeps store edits without a restore prompt", () => {
        openDatabaseModal("actors");
        const actorId = store.getCurrent().database.actors[0]?.id ?? "";
        updateDatabaseRecord("actors", actorId, { name: "Dirty Actor" });

        document.dispatchEvent(Object.assign(new Event("keydown"), { key: "Escape" }));

        expect(document.querySelector("[data-testid='database-dirty-prompt']")).toBeNull();
        expect(document.querySelector("[data-testid='database-modal']")).toBeNull();
        expect(store.getCurrent().database.actors.find((actor) => actor.id === actorId)?.name).toBe("Dirty Actor");
      });
    });
  });
});

describe("editorPanelsSuite20", () => {
  isolateTimers();
  describe("databaseModalReopenLeak", () => {
    isolateTimers();
    // P10(1파 리뷰 이관): openDatabaseModal 이 재오픈 시 이전 인스턴스의 DOM 만
    // querySelector(...).remove() 로 뜯어내면 document keydown 리스너 2개(dirty-close
    // Escape 핸들러 + undo/redo 히스토리 핸들러)가 인스턴스마다 누적된다.
    // 기존 인스턴스의 정식 close() 를 경유해야 한다.
    let restoreDom: (() => void) | undefined;
    let previousWindow: typeof globalThis.window | undefined;
    beforeEach(() => {
      restoreDom = installFakeDom();
      previousWindow = globalThis.window;
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          clearTimeout,
          localStorage: createFakeLocalStorage(),
          setTimeout: (handler: TimerHandler): number => {
            if (typeof handler === "function") handler();
            return 0;
          },
        },
      });
      store.replace(createBlankProject());
      resetMapEditHistory();
    });
    afterEach(() => {
      document.querySelector("[data-testid='database-modal']")?.remove();
      restoreDom?.();
      restoreDom = undefined;
      if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
      else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
    });
    function createFakeLocalStorage(): Storage {
      const values = new Map<string, string>();
      return {
        get length() {
          return values.size;
        },
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        key: (index: number) => Array.from(values.keys())[index] ?? null,
        removeItem: (key: string) => void values.delete(key),
        setItem: (key: string, value: string) => void values.set(key, value),
      } as Storage;
    }
    describe("database modal reopen path closes the previous instance (P10)", () => {
      it("restores the attached opener after close without stealing focus on cross-tab reuse", () => {
        const opener = document.createElement("button");
        document.body.append(opener);
        opener.focus();
        openDatabaseModal("actors");
        openDatabaseModal("troops");
        expect(document.activeElement).not.toBe(opener);
        requestDatabaseModalClose("battleTest");
        expect(document.activeElement).toBe(opener);
      });

      it("restores the logical opener after a topbar replacement", () => {
        const opener = document.createElement("button");
        opener.dataset.testid = "toolbar-database";
        document.body.append(opener);
        opener.focus();
        openDatabaseModal("actors");
        opener.remove();
        const replacement = document.createElement("button");
        replacement.dataset.testid = "toolbar-database";
        document.body.append(replacement);
        requestDatabaseModalClose("battleTest");
        expect(document.activeElement).toBe(replacement);
      });

      it("does not focus a disconnected opener without a replacement", () => {
        const opener = document.createElement("button");
        document.body.append(opener);
        opener.focus();
        openDatabaseModal("actors");
        opener.remove();
        requestDatabaseModalClose("battleTest");
        expect(document.activeElement).not.toBe(opener);
      });

      // 3 = 모달 인스턴스의 2개(dirty-close Escape + undo/redo 히스토리)
      //   + modalStack 의 공유 캡처 리스너 1개.
      // 공유 리스너는 document 당 한 번만 붙고(ensureListening) 모달을 닫아도 남는다 —
      // 그래서 재오픈해도 총량이 늘지 않는다는 이 테스트의 취지는 그대로다.
      // (2026-09-19: DB 모달이 창 모드에서 modalStack 에 등록되면서 2 → 3 이 됐다. 등록은
      //  포커스 트랩·Escape 층 소유권을 위한 것이다 — 리뷰 P0-2.)
      it("keeps exactly 3 document keydown listeners after repeated reopen", () => {
        openDatabaseModal("actors");
        expect(documentListenerCount("keydown")).toBe(3);

        openDatabaseModal("actors");
        // 재오픈이 정식 close() 를 경유하지 않으면 여기서 5가 된다.
        expect(documentListenerCount("keydown")).toBe(3);

        openDatabaseModal("troops");
        expect(documentListenerCount("keydown")).toBe(3);
        expect(document.querySelectorAll("[data-testid='database-modal']").length).toBe(1);
      });
    });
  });
  // DB UI 현대화 W4 — 모던 컨트롤 프리미티브 4종 계약 검증(fakeDom).
  //
  // databaseControls.ts 신규 프리미티브의 불변식:
  //   1. sliderStepperField — range/number 쌍이 클램프·스텝 정규화된 값으로 양방향 동기화.
  //   2. segmentedControl — 네이티브 radio 그룹(방향키 내비게이션 = 브라우저 기본 동작,
  //      컨트롤은 keydown 리스너를 하나도 달지 않는다). change 는 선택된 옵션 id 로 발화.
  //   3. toggleSwitch — checkbox 원형(checked 자체가 상태).
  //   4. avatarChipRow — faceset 칩 버튼(aria-pressed/dimmed), 클릭 토글.
  //   5. 모든 컨트롤은 Escape 를 삼키지 않는다 — 모달 최상층 dirty-close 라우팅은
  //      document 레벨 keydown 리스너(버블 도착)로 동작하므로, 컨트롤이 preventDefault/
  //      stopPropagation 하면 닫기 가드가 깨진다. 여기선 버블이 document 까지 도달하는지로 검증한다.
  describe("databaseModernControls", () => {
    isolateTimers();
    const ACTORS: AvatarChipActor[] = [
      { id: "actor-1", name: "알렉스", faceResourceId: "easyrpg-faceset-actor1-00" },
      { id: "actor-2", name: "브라이언", faceResourceId: "easyrpg-faceset-actor1-01" },
      { id: "actor-3", name: "캐럴", faceResourceId: undefined },
    ];
    let restoreDom: (() => void) | undefined;
    beforeEach(() => {
      restoreDom = installFakeDom();
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = undefined;
    });
    function keydown(key: string): Event {
      const event = new Event("keydown", { bubbles: true, cancelable: true });
      Object.defineProperty(event, "key", { configurable: true, value: key });
      return event;
    }
    type DocumentTarget = {
      readonly addEventListener: (type: string, listener: EventListener) => void;
      readonly removeEventListener: (type: string, listener: EventListener) => void;
    };
    /** document 레벨 keydown 리스너(모달 dirty-close 라우팅)가 이벤트를 여전히 받는지. */
    function escapeStillReachesDocumentLayer(control: FakeElement): boolean {
      const doc = globalThis.document as unknown as DocumentTarget;
      let reached = false;
      const listener = (): void => {
        reached = true;
      };
      doc.addEventListener("keydown", listener);
      try {
        control.dispatchEvent(keydown("Escape"));
      } finally {
        doc.removeEventListener("keydown", listener);
      }
      return reached;
    }
    describe("sliderStepperField", () => {
      function render(value = 50, bounds = { min: 0, max: 100, step: 1 }) {
        const committed: number[] = [];
        const node = sliderStepperField("HP 회복", "db-field-item-heal-percent", value, (next) => committed.push(next), bounds);
        const fieldNode = node as unknown as FakeElement;
        const range = findByTestId(fieldNode, "db-field-item-heal-percent-slider");
        const stepper = findByTestId(fieldNode, "db-field-item-heal-percent-stepper");
        if (!range || !stepper) throw new Error("sliderStepperField 가 range/number 쌍을 렌더하지 않음");
        return { fieldNode, range, stepper, committed };
      }

      it("renders a range + number pair in a field with testids", () => {
        const { fieldNode, range, stepper } = render();
        expect(fieldNode.tagName).toBe("DIV");
        expect(fieldNode.className).toContain("db-field");
        expect(range.attrs.type).toBe("range");
        expect(stepper.attrs.type).toBe("number");
        expect(range.attrs.min).toBe("0");
        expect(range.attrs.max).toBe("100");
        expect(range.attrs.step).toBe("1");
        expect(range.value).toBe("50");
        expect(stepper.value).toBe("50");
      });

      it("moving the slider clamps to max and syncs the stepper (101 → 100)", () => {
        const { range, stepper, committed } = render();
        range.value = "101";
        range.dispatchEvent(new Event("input"));
        expect(committed.at(-1)).toBe(100);
        expect(stepper.value).toBe("100");
        expect(range.value).toBe("100");
      });

      it("typing below min in the stepper clamps and syncs the slider (-1 → 0)", () => {
        const { range, stepper, committed } = render();
        stepper.value = "-1";
        stepper.dispatchEvent(new Event("input"));
        expect(committed.at(-1)).toBe(0);
        expect(range.value).toBe("0");
        expect(stepper.value).toBe("0");
      });

      it("typing above max clamps and rewrites the visible value", () => {
        const { range, stepper, committed } = render();
        stepper.value = "500000";
        stepper.dispatchEvent(new Event("input"));
        expect(committed.at(-1)).toBe(100);
        expect(range.value).toBe("100");
        expect(stepper.value).toBe("100");
      });

      it("normalizes the display on blur(change) — cleared stepper shows the floor", () => {
        const { range, stepper, committed } = render(20, { min: 5, max: 95, step: 1 });
        stepper.value = "";
        stepper.dispatchEvent(new Event("input"));
        stepper.dispatchEvent(new Event("change"));
        expect(stepper.value).toBe("5");
        expect(range.value).toBe("5");
        expect(committed.at(-1)).toBe(5);
      });

      it("quantizes to the step (37 → 35 with step 5)", () => {
        const { range, stepper, committed } = render(30, { min: 0, max: 100, step: 5 });
        stepper.value = "37";
        stepper.dispatchEvent(new Event("input"));
        expect(committed.at(-1)).toBe(35);
        expect(range.value).toBe("35");
        expect(stepper.value).toBe("35");
      });

      it("clamps the initial value to bounds", () => {
        const { range, stepper } = render(140);
        expect(range.value).toBe("100");
        expect(stepper.value).toBe("100");
      });

      it("keeps a leading minus until the signed number is complete", () => {
        const { range, stepper, committed } = render(0, { min: -400, max: 400, step: 5 });
        stepper.value = "-";
        stepper.dispatchEvent(new Event("input"));
        expect(committed).toEqual([]);
        expect(stepper.value).toBe("-");
        expect(range.value).toBe("0");
        stepper.value = "-20";
        stepper.dispatchEvent(new Event("input"));
        expect(committed.at(-1)).toBe(-20);
        expect(stepper.value).toBe("-20");
        expect(range.value).toBe("-20");
      });
    });
    describe("segmentedControl (native radio group)", () => {
      const OPTIONS = [
        { id: "singleTarget", name: "단일 대상" },
        { id: "allTargets", name: "전체 대상" },
      ];

      function render(value = "singleTarget") {
        const committed: string[] = [];
        const node = segmentedControl("대상", "db-field-item-scope", value, OPTIONS, (next) => committed.push(next));
        const fieldNode = node as unknown as FakeElement;
        const radios = fieldNode.querySelectorAll("input").filter((input) => input.attrs.type === "radio");
        if (radios.length !== 2) throw new Error("segmentedControl 이 radio 그룹을 렌더하지 않음");
        return { fieldNode, radios, committed };
      }

      it("renders one native radio group with a shared name and pill labels", () => {
        const { fieldNode, radios } = render();
        expect(fieldNode.className).toContain("db-field");
        expect(findByTestId(fieldNode, "db-field-item-scope")).toBeTruthy();
        expect(radios[0].attrs.name).toBe(radios[1].attrs.name);
        const pills = fieldNode.querySelectorAll(".db-segmented-pill");
        expect(pills).toHaveLength(2);
        expect(pills[0].textContent).toContain("단일 대상");
        expect(pills[1].textContent).toContain("전체 대상");
      });

      it("checks the option matching the value", () => {
        const { radios } = render("allTargets");
        expect(radios[0].checked).toBe(false);
        expect(radios[1].checked).toBe(true);
      });

      it("arrow-key navigation changes selection and fires onInput with the option id", () => {
        const { radios, committed } = render();
        // 브라우저 기본 동작 흉내: 방향키는 다음 radio 를 체크하고 change 를 발화한다.
        // 컨트롤 자체는 keydown 리스너가 없다(포커스 트랩 금지) — 네이티브 그룹 동작에 의존.
        radios[0].focus();
        radios[1].dispatchEvent(keydown("ArrowDown"));
        radios[1].checked = true;
        radios[1].dispatchEvent(new Event("change", { bubbles: true }));
        expect(committed).toEqual(["allTargets"]);
      });

      it("Escape keydown on a radio bubbles to the document layer unswallowed", () => {
        const { radios } = render();
        expect(escapeStillReachesDocumentLayer(radios[0])).toBe(true);
      });
    });
    describe("toggleSwitch", () => {
      function render(checked = false) {
        const committed: boolean[] = [];
        const node = toggleSwitch("전투 중 사용", "db-field-item-battle-usable", checked, (next) => committed.push(next));
        const fieldNode = node as unknown as FakeElement;
        const input = findByTestId(fieldNode, "db-field-item-battle-usable");
        if (!input) throw new Error("toggleSwitch 가 checkbox 를 렌더하지 않음");
        return { fieldNode, input, committed };
      }

      it("renders a checkbox styled as a switch under the label", () => {
        const { fieldNode, input } = render();
        expect(fieldNode.className).toContain("db-field");
        expect(input.attrs.type).toBe("checkbox");
        expect(input.attrs.role).toBe("switch");
        expect(input.checked).toBe(false);
        expect(fieldNode.querySelectorAll(".db-toggle-switch")).toHaveLength(1);
      });

      it("reflects the initial checked state", () => {
        const { input } = render(true);
        expect(input.checked).toBe(true);
      });

      it("Space toggles the checked boolean (native activation → change)", () => {
        const { input, committed } = render();
        input.focus();
        input.dispatchEvent(keydown(" "));
        // 합성 keydown 은 네이티브 체크박스 활성화를 일으키지 않는다(브라우저가 쏠 클릭 모사).
        input.checked = !input.checked;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        expect(committed.at(-1)).toBe(true);
      });

      it("Escape keydown on the switch bubbles to the document layer unswallowed", () => {
        const { input } = render();
        expect(escapeStillReachesDocumentLayer(input)).toBe(true);
      });
    });
    describe("avatarChipRow", () => {
      function render(selectedIds: string[] = ["actor-1"]) {
        const toggles: Array<[string, boolean]> = [];
        const node = avatarChipRow("사용 가능 배우", "db-field-item-usable-actors", ACTORS, selectedIds, (actorId, nextSelected) => {
          toggles.push([actorId, nextSelected]);
        });
        const fieldNode = node as unknown as FakeElement;
        const chips = fieldNode.querySelectorAll(".db-avatar-chip");
        if (chips.length !== ACTORS.length) throw new Error("avatarChipRow 가 칩 버튼을 렌더하지 않음");
        return { fieldNode, chips, toggles };
      }

      it("renders one button chip per actor with faceset crops and names", () => {
        const { fieldNode, chips } = render();
        expect(findByTestId(fieldNode, "db-field-item-usable-actors")).toBeTruthy();
        for (const [index, chip] of chips.entries()) {
          expect(chip.tagName).toBe("BUTTON");
          expect(chip.attrs.type).toBe("button");
          expect(chip.dataset.actorId).toBe(ACTORS[index].id);
          expect(chip.textContent).toContain(ACTORS[index].name);
          expect(chip.querySelectorAll(".db-avatar-chip-face")).toHaveLength(1);
        }
      });

      it("selected chip has aria-pressed=true and no dimmed class; unselected are dimmed", () => {
        const { chips } = render(["actor-1"]);
        expect(chips[0].getAttribute("aria-pressed")).toBe("true");
        expect(chips[0].classList.contains("dimmed")).toBe(false);
        expect(chips[1].getAttribute("aria-pressed")).toBe("false");
        expect(chips[1].classList.contains("dimmed")).toBe(true);
        expect(chips[2].classList.contains("dimmed")).toBe(true);
      });

      it("click toggles the actor id in/out of selectedIds and mirrors state on the chip", () => {
        const { chips, toggles } = render(["actor-1"]);
        chips[1].click();
        expect(toggles.at(-1)).toEqual(["actor-2", true]);
        expect(chips[1].getAttribute("aria-pressed")).toBe("true");
        expect(chips[1].classList.contains("dimmed")).toBe(false);
        chips[0].click();
        expect(toggles.at(-1)).toEqual(["actor-1", false]);
        expect(chips[0].getAttribute("aria-pressed")).toBe("false");
        expect(chips[0].classList.contains("dimmed")).toBe(true);
      });

      it("actor without a faceset resource renders a faceless chip without crashing", () => {
        const { chips } = render(["actor-3"]);
        const face = chips[2].querySelector(".db-avatar-chip-face");
        expect(face).toBeTruthy();
        expect(face.style.backgroundImage ?? "").toBe("");
        expect(chips[2].getAttribute("aria-pressed")).toBe("true");
      });

      it("empty actors array renders an empty row without crashing", () => {
        const node = avatarChipRow("사용 가능 배우", "db-field-item-usable-actors", [], [], () => {});
        const fieldNode = node as unknown as FakeElement;
        const row = findByTestId(fieldNode, "db-field-item-usable-actors");
        expect(row).toBeTruthy();
        expect(row.querySelectorAll(".db-avatar-chip")).toHaveLength(0);
      });

      it("Escape keydown on a chip bubbles to the document layer unswallowed", () => {
        const { chips } = render();
        expect(escapeStillReachesDocumentLayer(chips[0])).toBe(true);
      });
    });
    describe("Escape passthrough inside the modal surface", () => {
      it("Escape on every control inside .database-modal-backdrop reaches the document layer", () => {
        const slider = sliderStepperField("HP 회복", "db-field-item-heal-percent", 50, () => {}, { min: 0, max: 100, step: 1 });
        const segmented = segmentedControl("대상", "db-field-item-scope", "singleTarget", OPTIONS_FOR_ESCAPE, () => {});
        const toggle = toggleSwitch("전투 중 사용", "db-field-item-battle-usable", false, () => {});
        const chips = avatarChipRow("사용 가능 배우", "db-field-item-usable-actors", ACTORS_FOR_ESCAPE, [], () => {});
        const body = document.body as unknown as FakeElement;
        const backdrop = document.createElement("div") as FakeElement;
        backdrop.className = "database-modal-backdrop";
        const windowLayer = document.createElement("div") as FakeElement;
        windowLayer.className = "database-modal-window";
        windowLayer.append(slider, segmented, toggle, chips);
        backdrop.append(windowLayer);
        body.append(backdrop);

        const doc = globalThis.document as unknown as DocumentTarget;
        let reached = 0;
        const listener = (): void => {
          reached += 1;
        };
        doc.addEventListener("keydown", listener);
        try {
          const controls = [...windowLayer.querySelectorAll("input"), ...windowLayer.querySelectorAll("button")];
          expect(controls).toHaveLength(6); // range + stepper + radio×2 + checkbox + chip button
          for (const control of controls) control.dispatchEvent(keydown("Escape"));
        } finally {
          doc.removeEventListener("keydown", listener);
        }
        // 모든 컨트롤에서 Escape 가 document 레벨(모달 dirty-close 라우팅)까지 도달한다.
        expect(reached).toBe(6);
      });
    });
    const OPTIONS_FOR_ESCAPE = [
      { id: "singleTarget", name: "단일" },
      { id: "allTargets", name: "전체" },
    ];
    const ACTORS_FOR_ESCAPE: AvatarChipActor[] = [{ id: "actor-1", name: "알렉스" }];
  });
  describe("databaseMonsterEventEditing", () => {
    isolateTimers();
    let cleanup: () => void;
    let oldWindow: typeof window;
    beforeEach(() => {
      cleanup = installFakeDom(); oldWindow = globalThis.window;
      Object.defineProperty(globalThis, "window", { configurable: true, value: { setTimeout: () => 0, clearTimeout } });
      const project = createBlankProject();
      project.database.troops[0]!.battleEventPages = [];
      store.replace(project);
    });
    afterEach(() => {
      cleanup();
      if (oldWindow === undefined) Reflect.deleteProperty(globalThis, "window");
      else Object.defineProperty(globalThis, "window", { configurable: true, value: oldWindow });
    });
    const troop = () => store.getCurrent().database.troops[0]!;
    function render() {
      const host = document.createElement("div") as unknown as FakeElement;
      const rerender = () => { host.replaceChildren(renderTroopBattleEventPanel(troop(), rerender) as unknown as FakeElement); };
      rerender(); return host;
    }
    function change(host: FakeElement, id: string, value: string) {
      const control = findByTestId(host, id)!;
      expect(control, id).toBeTruthy();
      control.value = value; control.dispatchEvent(new Event("change"));
    }
    describe("troop event editor", () => {
      it("adds unique page IDs after deleting a middle page and preserves explicit runOnce=false", () => {
        const host = render();
        const add = () => findByTestId(host, "db-troop-event-add-page")!.click();
        add(); add(); add();
        const kept = [troop().battleEventPages[0]!.id, troop().battleEventPages[2]!.id];
        findByTestId(host, "db-troop-event-page-tab-2")!.click();
        findByTestId(host, "db-troop-event-delete-page")!.click();
        add();
        const ids = troop().battleEventPages.map((p) => p.id);
        expect(new Set(ids).size).toBe(3);
        expect(ids.slice(0, 2)).toEqual(kept);
        const once = findByTestId(host, "db-field-troop-event-run-once")!;
        once.checked = false; once.dispatchEvent(new Event("change"));
        expect(troop().battleEventPages[2]!.runOnce).toBe(false);
        expect(findByTestId(host, "db-field-troop-event-run-once")!.checked).toBe(false);
      });
      it("edits switch polarity and variable operators without dropping additional conditions", () => {
        store.update((project) => {
          project.switches = [{ id: "actual_switch", name: "Gate" }];
          project.variables = [{ id: "actual_variable", name: "Score" }];
          project.database.troops[0]!.battleEventPages = [{ id: "condition-test", conditions: [{ kind: "switch", switchId: "actual_switch", value: true }, { kind: "onRound", round: 2 }], span: "turn", commands: [] }];
        });
        const host = render();
        change(host, "db-field-troop-event-condition-switch-value", "false");
        expect(troop().battleEventPages[0]!.conditions[0]).toEqual({ kind: "switch", switchId: "actual_switch", value: false });
        change(host, "db-field-troop-event-condition-kind", "variable");
        change(host, "db-field-troop-event-condition-variable-op", "<=");
        expect(troop().battleEventPages[0]!.conditions).toEqual([{ kind: "variable", variableId: "actual_variable", op: "<=", value: 0 }, { kind: "onRound", round: 2 }]);
      });
      it("keeps both displayed HP limits consistent with the saved range", () => {
        const host = render();
        findByTestId(host, "db-troop-event-add-page")!.click();
        change(host, "db-field-troop-event-condition-kind", "enemyHp");
        const setNumber = (suffix: string, value: string) => {
          const input = findByTestId(host, `db-field-troop-event-condition-enemy-hp-${suffix}`)!;
          input.value = value; input.dispatchEvent(new Event("input"));
        };
        setNumber("max", "30");
        setNumber("min", "60");
        expect(findByTestId(host, "db-field-troop-event-condition-enemy-hp-max")!.value).toBe("60");
        setNumber("max", "20");
        expect(findByTestId(host, "db-field-troop-event-condition-enemy-hp-min")!.value).toBe("20");
        expect(troop().battleEventPages[0]!.conditions[0]).toMatchObject({ minPercent: 20, maxPercent: 20 });
        setNumber("min", "100");
        expect(findByTestId(host, "db-field-troop-event-condition-enemy-hp-max-inc")!.disabled).toBe(true);
        setNumber("max", "90");
        const minIncrement = findByTestId(host, "db-field-troop-event-condition-enemy-hp-min-inc")!;
        expect(minIncrement.disabled).toBe(false);
        minIncrement.click();
        expect(troop().battleEventPages[0]!.conditions[0]).toMatchObject({ minPercent: 91, maxPercent: 91 });
      });

    });
  });
  describe("databaseMonsterSpeciesView", () => {
    isolateTimers();
    let previousWindow: typeof globalThis.window | undefined;
    function stubWindowTimers(): void {
      previousWindow = globalThis.window;
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
          setTimeout: (handler: TimerHandler): number => {
            if (typeof handler === "function") handler();
            return 0;
          },
          clearTimeout,
          dispatchEvent: () => true,
        },
      });
    }
    function restoreWindow(): void {
      if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
      else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
    }
    function renderUtility(render: (host: HTMLElement, rerender: () => void) => void): FakeElement {
      const host = document.createElement("div") as unknown as FakeElement;
      const rerender = (): void => {
        host.replaceChildren();
        render(host as unknown as HTMLElement, rerender);
      };
      rerender();
      return host;
    }
    describe("database monster species view", () => {
      let cleanupDom: (() => void) | undefined;

      beforeEach(() => {
        cleanupDom = installFakeDom();
        stubWindowTimers();
        store.replace(createBlankProject());
        resetMapEditHistory();
        setMonsterSpeciesSection("basic");
      });

      afterEach(() => {
        cleanupDom?.();
        cleanupDom = undefined;
        restoreWindow();
      });

      // fix(db): statFields/hue/resourcePicker 콜백이 렌더 시점 record를 클로저로 캡처한 채
      // baseStats를 스프레드해, rerender 없이 연속 편집하면 직전 편집이 스테일 스냅샷 위에
      // 덮여 사라졌다(HP→MP→공격 순서 입력 시 마지막 필드만 저장 — qa-enemies-report.md).
      it("preserves every stat field when edited sequentially without an intervening rerender", () => {
        const host = renderUtility(renderMonsterSpeciesTab);
        findByTestId(host, "db-monster-species-add")?.click();
        const id = store.getCurrent().database.monsterSpecies?.at(-1)?.id;
        if (!id) throw new Error("missing species id");

        const setNumber = (testid: string, value: string): void => {
          const input = findByTestId(host, testid);
          if (!input) throw new Error(`missing field ${testid}`);
          input.value = value;
          input.dispatchEvent(new Event("input"));
        };

        setNumber("db-monster-species-hp", "64");
        setNumber("db-monster-species-mp", "30");
        setNumber("db-monster-species-atk", "21");
        setNumber("db-monster-species-def", "22");
        setNumber("db-monster-species-mind", "23");
        setNumber("db-monster-species-agi", "24");

        const record = store.getCurrent().database.monsterSpecies?.find((entry) => entry.id === id);
        expect(record?.baseStats).toEqual({ maxHp: 64, maxMp: 30, attack: 21, defense: 22, mind: 23, agility: 24 });
        // 색조 칸은 2026-10-02 지웠다(전투가 읽지 않는다).
        expect(findByTestId(host, "db-monster-species-hue")).toBeNull();
      });

      it("duplicates with a 사본 suffix and blocks delete while an enemy references the species", () => {
        const host = renderUtility(renderMonsterSpeciesTab);
        const before = (store.getCurrent().database.monsterSpecies ?? []).length;
        findByTestId(host, "db-monster-species-add")?.click();
        const id = store.getCurrent().database.monsterSpecies?.at(-1)?.id;
        if (!id) throw new Error("missing species id");

        findByTestId(host, "db-monster-species-duplicate")?.click();
        const species = store.getCurrent().database.monsterSpecies ?? [];
        expect(species).toHaveLength(before + 2);
        const duplicatedId = species.at(-1)?.id;
        expect(species.at(-1)?.name).toBe("새 species 사본");
        if (!duplicatedId) throw new Error("missing duplicated species id");

        // duplicate is auto-selected — reference it (not the original) so the delete
        // button below targets the referenced record and the guard actually engages.
        const enemyId = store.getCurrent().database.enemies[0]?.id;
        if (!enemyId) throw new Error("missing default enemy");
        store.update((project) => {
          const enemy = project.database.enemies.find((entry) => entry.id === enemyId);
          if (enemy) enemy.speciesId = duplicatedId;
        });

        const deleteButton = findByTestId(host, "db-monster-species-delete");
        if (!deleteButton) throw new Error("missing delete button");
        deleteButton.click();
        expect(deleteButton.textContent).toBe("삭제"); // blocked — never arms
        expect(store.getCurrent().database.monsterSpecies).toHaveLength(before + 2);
      });

      it("requires a second click before deleting an unreferenced species, and undo restores it", () => {
        const host = renderUtility(renderMonsterSpeciesTab);
        findByTestId(host, "db-monster-species-add")?.click();
        const before = (store.getCurrent().database.monsterSpecies ?? []).length;

        const deleteButton = findByTestId(host, "db-monster-species-delete");
        if (!deleteButton) throw new Error("missing delete button");
        deleteButton.click();
        expect(deleteButton.textContent).toBe("정말 삭제?");
        expect(store.getCurrent().database.monsterSpecies).toHaveLength(before);

        deleteButton.click();
        expect(store.getCurrent().database.monsterSpecies).toHaveLength(before - 1);

        expect(getMapEditHistoryState().canUndo).toBe(true);
        const undone = undoMapEdit();
        expect(undone).toBe(true);
        expect(store.getCurrent().database.monsterSpecies).toHaveLength(before);
      });

      it("uses type-chart chips: two stick, third does not, and outlier types warn", () => {
        store.update((project) => {
          project.system.typeChart = {
            types: ["fire", "water", "grass"],
            multipliers: {
              fire: { fire: 1, water: 0.5, grass: 2 },
              water: { fire: 2, water: 1, grass: 0.5 },
              grass: { fire: 0.5, water: 2, grass: 1 },
            },
          };
        });

        const host = renderUtility(renderMonsterSpeciesTab);
        findByTestId(host, "db-monster-species-add")?.click();
        const id = store.getCurrent().database.monsterSpecies?.at(-1)?.id;
        if (!id) throw new Error("missing species id");

        const toggleType = (type: string, checked: boolean): FakeElement => {
          const chip = findByTestId(host, `db-monster-species-type-${type}`);
          if (!chip) throw new Error(`missing type chip ${type}`);
          chip.checked = checked;
          chip.dispatchEvent(new Event("change"));
          return chip;
        };

        toggleType("fire", true);
        toggleType("water", true);
        expect(store.getCurrent().database.monsterSpecies?.find((entry) => entry.id === id)?.types).toEqual([
          "fire",
          "water",
        ]);

        const grass = toggleType("grass", true);
        expect(grass.checked).toBe(false);
        expect(store.getCurrent().database.monsterSpecies?.find((entry) => entry.id === id)?.types).toEqual([
          "fire",
          "water",
        ]);
        expect(store.getCurrent().system.typeChart?.types).toEqual(["fire", "water", "grass"]);

        // Outlier warn: store a type outside the chart without clearing chart types.
        store.update((project) => {
          const record = project.database.monsterSpecies?.find((entry) => entry.id === id);
          if (!record) throw new Error("missing species");
          record.types = ["fire", "ghost"];
        });
        const refreshed = renderUtility(renderMonsterSpeciesTab);
        const warn = findByTestId(refreshed, "db-monster-species-type-warn");
        expect(warn?.textContent).toContain("타입 상성표에 없는 타입");
        expect(warn?.textContent).toContain("ghost");
        expect(findByTestId(refreshed, "db-monster-species-type-fire")?.checked).toBe(true);
        expect(findByTestId(refreshed, "db-monster-species-type-water")?.checked).toBe(false);
        const orphan = findByTestId(refreshed, "db-monster-species-type-ghost")!;
        orphan.checked = false;
        orphan.dispatchEvent(new Event("change"));
        expect(store.getCurrent().database.monsterSpecies?.find((row) => row.id === id)?.types).toEqual(["fire"]);
      });

      it("falls back to free-text types when the type chart is empty", () => {
        store.update((project) => {
          delete project.system.typeChart;
        });

        const host = renderUtility(renderMonsterSpeciesTab);
        findByTestId(host, "db-monster-species-add")?.click();
        const id = store.getCurrent().database.monsterSpecies?.at(-1)?.id;
        if (!id) throw new Error("missing species id");

        expect(findByTestId(host, "db-monster-species-types-hint")).not.toBeNull();
        expect(findByTestId(host, "db-monster-species-type-fire")).toBeNull();

        const input = findByTestId(host, "db-monster-species-types");
        if (!input) throw new Error("missing free-text types field");
        input.value = "불, 물, 바람";
        input.dispatchEvent(new Event("input"));

        expect(store.getCurrent().database.monsterSpecies?.find((entry) => entry.id === id)?.types).toEqual([
          "불",
          "물",
        ]);
        expect(store.getCurrent().system.typeChart).toBeUndefined();
      });

      // Break caught: species fields do not show whether enemies, field spawns, and drops form a playable pipeline.
      it("shows the monster pipeline summary and direct navigation actions", () => {
        const host = renderUtility(renderMonsterSpeciesTab);
        expect(findByTestId(host, "db-monster-pipeline")).toBeTruthy();
        expect(findByTestId(host, "db-monster-pipeline-links")?.dataset.state).toBe("ready");
        expect(findByTestId(host, "db-monster-pipeline-spawns")?.dataset.state).toBe("needs-setup");
        // 기본 DB 는 이제 모든 적에 드롭 아이템을 생산한다(해골 궁수 = item_bone).
        // 이 칩이 다른 상태도 보고한다는 적은 위의 spawns(needs-setup) 가 직얰한다.
        expect(findByTestId(host, "db-monster-pipeline-drops")?.dataset.state).toBe("ready");
        expect(findByTestId(host, "db-monster-pipeline-links-action")).toBeTruthy();
        expect(findByTestId(host, "db-monster-pipeline-spawns-action")).toBeTruthy();
        expect(findByTestId(host, "db-monster-pipeline-drops-action")).toBeTruthy();
      });
      it("keeps skill row identity through sorting, blur, a later skill edit and deletion", () => {
        const initial = renderUtility(renderMonsterSpeciesTab);
        findByTestId(initial, "db-monster-species-add")!.click();
        const id = store.getCurrent().database.monsterSpecies!.at(-1)!.id;
        const [a, b, c] = store.getCurrent().database.skills;
        store.update((project) => {
          project.database.monsterSpecies!.find((row) => row.id === id)!.skillsByLevel = [
            { level: 1, skillId: a!.id }, { level: 10, skillId: b!.id },
          ];
        });
        const host = renderUtility(renderMonsterSpeciesTab);
        const first = findByTestId(host, "db-monster-species-skill-level-0")!;
        first.value = "20";
        first.dispatchEvent(new Event("input"));
        first.dispatchEvent(new Event("change"));
        const saved = () => store.getCurrent().database.monsterSpecies!.find((row) => row.id === id)!.skillsByLevel;
        expect(saved()).toEqual([{ level: 10, skillId: b!.id }, { level: 20, skillId: a!.id }]);
        const skill = findByTestId(host, "db-monster-species-skill-0")!;
        skill.value = c!.id;
        skill.dispatchEvent(new Event("change"));
        expect(saved()).toEqual([{ level: 10, skillId: b!.id }, { level: 20, skillId: c!.id }]);
        findByTestId(host, "db-monster-species-skill-delete-0")!.click();
        expect(saved()).toEqual([{ level: 10, skillId: b!.id }]);
      });

      it("does not overwrite externally changed skill rows", () => {
        const initial = renderUtility(renderMonsterSpeciesTab);
        findByTestId(initial, "db-monster-species-add")!.click();
        findByTestId(initial, "db-monster-species-skill-add")!.click();
        const id = store.getCurrent().database.monsterSpecies!.at(-1)!.id;
        const input = findByTestId(initial, "db-monster-species-skill-level-0")!;
        store.update((project) => { project.database.monsterSpecies!.find((row) => row.id === id)!.skillsByLevel[0]!.level = 30; });
        input.value = "20";
        input.dispatchEvent(new Event("input"));
        expect(store.getCurrent().database.monsterSpecies!.find((row) => row.id === id)!.skillsByLevel[0]!.level).toBe(30);
      });


      // Break caught: all nine cards were stacked at once (1372px) so beginners could not tell where to start.
      it("splits the detail into five section tabs that keep every field mounted", () => {
        const host = renderUtility(renderMonsterSpeciesTab);
        const tabs = ["basic", "capture", "growth", "evolution", "links"].map((id) => findByTestId(host, `db-monster-species-section-tab-${id}`)!);
        expect(tabs.map((tab) => tab.getAttribute("role"))).toEqual(["tab", "tab", "tab", "tab", "tab"]);
        expect(tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual(["true", "false", "false", "false", "false"]);
        // Hidden panels still own their fields — tests and saved paths reach them without a tab click.
        for (const testid of ["db-monster-species-name", "db-monster-species-capture-rate", "db-monster-species-hp", "db-monster-species-evo-add", "db-monster-species-linked-enemies"]) {
          expect(findByTestId(host, testid), testid).toBeTruthy();
        }
        expect(findByTestId(host, "db-monster-species-section-basic")?.hidden).toBe(false);
        expect(findByTestId(host, "db-monster-species-section-growth")?.hidden).toBe(true);

        tabs[2]!.click();
        expect(findByTestId(host, "db-monster-species-section-growth")?.hidden).toBe(false);
        expect(findByTestId(host, "db-monster-species-section-basic")?.hidden).toBe(true);
        // The chosen section survives a rerender (edits that rebuild the tab must not jump back to 기본).
        const rerendered = renderUtility(renderMonsterSpeciesTab);
        expect(findByTestId(rerendered, "db-monster-species-section-tab-growth")?.getAttribute("aria-selected")).toBe("true");
        expect(findByTestId(rerendered, "db-monster-species-section-growth")?.hidden).toBe(false);

        const growthTab = findByTestId(rerendered, "db-monster-species-section-tab-growth")!;
        growthTab.dispatchEvent(Object.assign(new Event("keydown"), { key: "ArrowRight" }));
        expect(findByTestId(rerendered, "db-monster-species-section-tab-evolution")?.getAttribute("aria-selected")).toBe("true");
      });

      // Break caught: 「기본 포획 계수 0.45」 said nothing about how hard the monster is to catch.
      it("names capture difficulty and lets a difficulty step set the representative rate", () => {
        expect(captureDifficulty(1).label).toBe("매우 쉬움");
        expect(captureDifficulty(0.7).label).toBe("쉬움");
        expect(captureDifficulty(0.3).label).toBe("보통");
        expect(captureDifficulty(0.45).label).toBe("보통");
        expect(captureDifficulty(0.15).label).toBe("어려움");
        expect(captureDifficulty(0.02).label).toBe("전설");

        const host = renderUtility(renderMonsterSpeciesTab);
        findByTestId(host, "db-monster-species-add")!.click();
        const id = store.getCurrent().database.monsterSpecies!.at(-1)!.id;
        expect(findByTestId(host, "db-monster-species-capture-difficulty")?.textContent).toBe("보통");
        findByTestId(host, "db-monster-species-capture-step-hard")!.click();
        expect(store.getCurrent().database.monsterSpecies!.find((row) => row.id === id)!.captureRate).toBe(0.15);
        expect(findByTestId(host, "db-monster-species-capture-difficulty")?.textContent).toBe("어려움");
        expect(findByTestId(host, "db-monster-species-capture-step-hard")?.getAttribute("aria-pressed")).toBe("true");
        expect(findByTestId(host, "db-monster-species-section-tab-capture")?.textContent).toContain("어려움");
        expect(findByTestId(host, "db-monster-species-summary")?.textContent).toContain("잡기 어려움");
        expect(findByTestId(host, "db-monster-species-check-capture")?.dataset.done).toBe("true");
      });

      it("shows Korean type labels while storing raw type ids", () => {
        store.update((project) => {
          project.system.typeChart = {
            types: ["fire", "water", "shadow"],
            multipliers: { fire: {}, water: {}, shadow: {} },
          } as never;
        });
        const host = renderUtility(renderMonsterSpeciesTab);
        findByTestId(host, "db-monster-species-add")!.click();
        const id = store.getCurrent().database.monsterSpecies!.at(-1)!.id;
        const fire = findByTestId(host, "db-monster-species-type-fire")!;
        expect(fire.closest("label")?.textContent).toContain("불");
        expect(findByTestId(host, "db-monster-species-type-shadow")!.closest("label")?.textContent).toContain("shadow");
        fire.checked = true;
        fire.dispatchEvent(new Event("change"));
        expect(store.getCurrent().database.monsterSpecies!.find((row) => row.id === id)!.types).toEqual(["fire"]);
        expect(findByTestId(host, "db-monster-species-hero-types")?.textContent).toBe("불");
      });

      it("keeps the project-wide readiness collapsed into a counted pill", () => {
        const host = renderUtility(renderMonsterSpeciesTab);
        const details = findByTestId(host, "db-monster-pipeline-details")!;
        expect(details.tagName).toBe("DETAILS");
        expect((details as unknown as { open?: boolean }).open).toBe(false);
        expect(findByTestId(host, "db-monster-pipeline-toggle")?.textContent).toMatch(/프로젝트 준비\s*\d\/4/u);
        expect(details.contains(findByTestId(host, "db-monster-pipeline"))).toBe(true);
      });

      it("marks the fill-order checklist from real data and jumps to the item's section", () => {
        const host = renderUtility(renderMonsterSpeciesTab);
        findByTestId(host, "db-monster-species-add")!.click();
        expect(findByTestId(host, "db-monster-species-checklist")).not.toBeNull();
        expect(findByTestId(host, "db-monster-species-check-identity")?.dataset.done).toBe("false");
        expect(findByTestId(host, "db-monster-species-check-graphic")?.dataset.done).toBe("false");
        expect(findByTestId(host, "db-monster-species-check-capture")?.dataset.done).toBe("false");
        findByTestId(host, "db-monster-species-check-evolution")!.click();
        expect(findByTestId(host, "db-monster-species-section-evolution")?.hidden).toBe(false);
      });
    });
  });
  describe("databaseNestedModalEscape", () => {
    isolateTimers();
    // DB 모달은 자기 document keydown 리스너로 Escape 를 잡아 통째로 닫는다. 그 안에서
    // 연 중첩 다이얼로그가 모달 스택에 등록되지 않으면 Escape 가 그대로 흘러내려
    // "나중에 연 중첩창"이 아니라 "먼저 연 데이터베이스"가 닫힌다.
    let restoreDom: (() => void) | undefined;
    let previousWindow: typeof globalThis.window | undefined;
    beforeEach(() => {
      restoreDom = installFakeDom();
      resetModalStackForTest();
      previousWindow = globalThis.window;
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          clearTimeout,
          localStorage: createFakeLocalStorage(),
          setTimeout: (handler: TimerHandler): number => {
            if (typeof handler === "function") handler();
            return 0;
          },
        },
      });
      store.replace(createBlankProject());
      resetMapEditHistory();
    });
    afterEach(() => {
      document.querySelector("[data-testid='database-modal']")?.remove();
      document.querySelector("[data-testid='resource-modal']")?.remove();
      resetModalStackForTest();
      restoreDom?.();
      restoreDom = undefined;
      if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
      else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
    });
    function createFakeLocalStorage(): Storage {
      const values = new Map<string, string>();
      return {
        get length() {
          return values.size;
        },
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        key: (index: number) => Array.from(values.keys())[index] ?? null,
        removeItem: (key: string) => void values.delete(key),
        setItem: (key: string, value: string) => void values.set(key, value),
      } as Storage;
    }
    function dispatchEscape(): void {
      const event = new Event("keydown", { bubbles: true, cancelable: true }) as Event & { key: string };
      Object.defineProperty(event, "key", { configurable: true, value: "Escape" });
      document.dispatchEvent(event);
    }
    function clickTestId(testid: string): void {
      const target = document.querySelector(`[data-testid='${testid}']`);
      expect(target, `${testid} 를 찾지 못했다`).toBeTruthy();
      (target as unknown as { click: () => void }).click();
    }
    function exists(testid: string): boolean {
      return document.querySelector(`[data-testid='${testid}']`) !== null;
    }
    describe("데이터베이스 중첩 다이얼로그의 Escape 계층", () => {
      it("직업 능력치 곡선 다이얼로그를 열면 Escape 가 그 다이얼로그만 닫는다", () => {
        openDatabaseModal("classes");
        clickTestId("db-class-curve-edit-maxHp");
        expect(exists("db-class-parameter-dialog")).toBe(true);

        dispatchEscape();

        // 버그일 때: 중첩창은 그대로 남고 데이터베이스가 닫힌다.
        expect({ nested: exists("db-class-parameter-dialog"), database: exists("database-modal") }).toEqual({
          nested: false,
          database: true,
        });

        // 계층이 하나씩 벗겨진다 — 중첩창이 사라진 뒤의 Escape 는 데이터베이스 몫이다.
        dispatchEscape();
        expect(exists("database-modal")).toBe(false);
      });

      // 배우 탭에도 같은 이름의 곡선 편집기가 따로 있다(actorRecordCurveEditors.ts).
      // 직업 탭만 고치고 여기를 빠뜨려 사용자가 같은 버그를 다시 만났다.
      it("배우 능력치 곡선 다이얼로그도 Escape 로 자기만 닫는다", () => {
        openDatabaseModal("actors");
        clickTestId("db-actor-curve-edit-maxHp");
        expect(exists("db-actor-parameter-dialog")).toBe(true);

        dispatchEscape();

        expect({ nested: exists("db-actor-parameter-dialog"), database: exists("database-modal") }).toEqual({
          nested: false,
          database: true,
        });
      });

      it("배우 경험치 곡선 다이얼로그도 Escape 로 자기만 닫는다", () => {
        openDatabaseModal("actors");
        clickTestId("db-actor-exp-edit");
        expect(exists("db-actor-exp-dialog")).toBe(true);

        dispatchEscape();

        expect({ nested: exists("db-actor-exp-dialog"), database: exists("database-modal") }).toEqual({
          nested: false,
          database: true,
        });
      });

      // 도크 모드 백드롭은 pointer-events: none 이라 데이터베이스를 켠 채로 툴바의
      // 리소스 관리자를 열 수 있다. 그때도 Escape 는 위층 창 몫이다.
      it("리소스 관리자를 데이터베이스 위에 열어도 Escape 는 리소스 관리자만 닫는다", () => {
        openDatabaseModal("actors");
        openResourceModal();
        expect(exists("resource-modal")).toBe(true);

        dispatchEscape();

        expect({ nested: exists("resource-modal"), database: exists("database-modal") }).toEqual({
          nested: false,
          database: true,
        });
      });

      it("속성 최대 개수 다이얼로그도 같은 계층 규칙을 따른다", () => {
        openDatabaseModal("elements");
        clickTestId("db-elements-maximum-number");
        expect(exists("db-elements-max-dialog")).toBe(true);

        dispatchEscape();

        expect({ nested: exists("db-elements-max-dialog"), database: exists("database-modal") }).toEqual({
          nested: false,
          database: true,
        });
      });
    });
  });
});
