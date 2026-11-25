import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { equipmentActorComparison, equipmentEffectStory, equipmentEffectSummaryChips, renderEquipmentRecordForm } from "@/editor/panels/databaseEquipmentRecordView";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EquipmentRecord, ItemEquipmentEffectFlags, Command, EventPage, Project, ProjectFactions } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom, documentListenerCount } from "./fakeDom";
import { authoredFactionStance, defaultFactionStance, deleteFaction, duplicateFaction, factionMatrixCell, renameFaction, setPlayerKillReputation, setSparseFactionStance } from "@/editor/panels/databaseFactionModel";
import { setEffectiveFactionStance } from "@/project/factionRuntime";
import { deserialize, serialize } from "@/project/io";
import { resolveFactionTable } from "@/project/factions";
import { renderFactionsTab } from "@/editor/panels/databaseFactionView";
import { Window } from "happy-dom";
import { restoreFocusAfterRerender } from "@/editor/panels/databaseWorkspace";
import { recordListThumbnail } from "@/editor/panels/databaseRecordThumbnails";
import { computeRowWindow, createVirtualList, DEFAULT_ROW_HEIGHT, VIRTUALIZATION_THRESHOLD } from "@/editor/panels/databaseListVirtualizer";
import { el } from "@/util/dom";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { openDatabaseModal, requestDatabaseModalClose } from "@/editor/panels/databaseModal";
import { avatarChipRow, segmentedControl, sliderStepperField, toggleSwitch, type AvatarChipActor } from "@/editor/panels/databaseControls";
import { isolateTimers } from "./mergedTeardown";

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
