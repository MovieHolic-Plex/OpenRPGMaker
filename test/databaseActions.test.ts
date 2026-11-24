import { beforeEach, describe, expect, it, vi } from "vitest";
import { addDatabaseRecord, bulkRenameSwitches, bulkRenameVariables, deleteDatabaseRecord, duplicateDatabaseRecord, updateDatabaseRecord, type DatabaseCollection } from "@/editor/databaseActions";
import { getMapEditHistoryState, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { createBlankProject, DEFAULT_ANIMATION_ID, DEFAULT_ENEMY_ID, DEFAULT_ITEM_ID, DEFAULT_SKILL_ID, DEFAULT_TROOP_ID } from "@/project/defaults";
import { normalizeEnemyRecord, normalizeSystemRecords, normalizeEquipmentRecord, normalizeSkillRecord } from "@/project/databaseRecordModel";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import invalidReferenceProject from "./fixtures/projects/invalid-db-reference-v3.json";
import { dialogueLiftWorldPx, syncDialogueCameraLift } from "@/player/dialogueCameraLift";
import { createBattleRuntime } from "@/battle/runtime";
import type { EquipmentRecord, Project, SkillRecord } from "@/project/types";
import { predictSkillDamageFor } from "@/battle/battlePredict";
import { createBattleSequencer, type DamageFeedback } from "@/player/battleSequencer";
import { actorCommandDirectorState, enemyActionDirectorState } from "@/player/battleDirectorDom";
import { createPresentationLedger } from "@/player/battlePresentation";
import * as advance from "@/battle/battleRuntimeAdvance";
import fixture from "./fixtures/projects/battle-strict-v3.json";
import { simulateBattle } from "@/battle/simulate";
import type { BattleRuntimeOptions } from "@/battle/types";
import { isolateTimers } from "./mergedTeardown";

describe("databaseActions", () => {
  isolateTimers();
  const DATABASE_COLLECTIONS: readonly DatabaseCollection[] = [
    "actors",
    "classes",
    "skills",
    "items",
    "equipment",
    "enemies",
    "troops",
    "states",
    "battleAnimations",
  ];
  describe("Database actions", () => {
    beforeEach(() => {
      store.replace(createBlankProject());
    });

    it("blocks deleting a skill while actors, classes, enemies, items, or equipment reference it", () => {
      updateDatabaseRecord("skills", DEFAULT_SKILL_ID, {
        name: "Spark",
        scope: "enemy",
        power: 24,
      });

      const result = deleteDatabaseRecord("skills", DEFAULT_SKILL_ID);

      expect(result.ok).toBe(false);
      // 메시지는 이제 참조처를 하나씩 적는다(예: 「몬스터 종족 '리프링'이 이 스킬을 배웁니다. (외 9건)」).
      if (!result.ok) expect(result.message).toContain("이 스킬을");
      expect(store.getCurrent().database.skills.some((skill) => skill.id === DEFAULT_SKILL_ID)).toBe(true);
    });

    it("exports expanded actor data and blocks deleting learned skills", () => {
      const project = store.getCurrent();
      const actorId = project.database.actors[0]?.id ?? "";
      updateDatabaseRecord("actors", actorId, {
        nickname: "None",
        initialLevel: 0,
        maxLevel: 120,
        learnedSkills: [{ level: 7, skillId: DEFAULT_SKILL_ID }],
        options: { dualWield: true, autoBattle: false, fixedEquipment: false, mightyGuard: false },
      });

      const deleteResult = deleteDatabaseRecord("skills", DEFAULT_SKILL_ID);
      const restored = deserialize(serialize(store.getCurrent()));
      const actor = restored.database.actors.find((record) => record.id === actorId);

      expect(deleteResult.ok).toBe(false);
      expect(actor?.nickname).toBe("None");
      expect(actor?.initialLevel).toBe(1);
      expect(actor?.maxLevel).toBe(99);
      expect(actor?.learnedSkills).toEqual([{ level: 7, skillId: DEFAULT_SKILL_ID }]);
      expect(actor?.options.dualWield).toBe(true);
    });

    it("creates and normalizes RM2K3-style database records beyond actors", () => {
      const project = store.getCurrent();
      const classId = project.database.classes[0]?.id ?? "";
      const skillId = project.database.skills[0]?.id ?? "";
      const itemId = project.database.items[0]?.id ?? "";
      const equipmentId = project.database.equipment[0]?.id ?? "";
      const enemyId = project.database.enemies[0]?.id ?? "";
      const troopId = project.database.troops[0]?.id ?? "";

      updateDatabaseRecord("classes", classId, {
        battleCommands: [{ id: "cmd_skill", name: "Arts", kind: "skill" }],
        learnedSkills: [{ level: 150, skillId }],
        equipmentPermissions: { actorIds: [], classIds: [classId], equipmentIds: [equipmentId] },
        stateRates: { state_death: "C" },
        elementRates: { fire: "A" },
      });
      updateDatabaseRecord("skills", skillId, {
        description: "A precise spark.",
        mpCost: { flat: -5, percentMax: 150 },
        successRate: 120,
        variance: -4,
        hitRate: 101,
        effect: { kind: "damage", statistic: "mind", affects: "hp" },
      });
      updateDatabaseRecord("items", itemId, {
        description: "Battle-ready potion.",
        type: "medicine",
        occasion: "always",
        consumable: true,
        animationId: project.database.battleAnimations[0]?.id,
        stateEffects: [{ stateId: "state_death", chance: 150, operation: "remove" }],
      });
      updateDatabaseRecord("equipment", equipmentId, {
        description: "Cursed testing blade.",
        statBonuses: { attack: 999999, defense: -50, mind: 3, agility: 4 },
        equippableClassIds: [classId],
        equippableActorIds: [project.database.actors[0]?.id ?? ""],
        cursed: true,
        accuracy: 37,
        criticalRate: 14,
        usableAsItemSkillId: skillId,
      });
      updateDatabaseRecord("enemies", enemyId, {
        stats: { maxHp: 999999, maxMp: -5, attack: 12, defense: 13, mind: 14, agility: 15 },
        rewards: { exp: -10, gold: 9999999, dropItemId: itemId, dropRatePercent: 150 },
        actions: [{
          skillId,
          priority: 99,
          condition: { kind: "turn", start: 0, interval: 0 },
          switchOnAfterAction: { enabled: false },
          switchOffAfterAction: { enabled: false },
        }],
        stateRates: { state_death: "E" },
        elementRates: { fire: "B" },
      });
      updateDatabaseRecord("troops", troopId, {
        members: [{ enemyId, x: -50, y: 999, hidden: true }],
        autoAlign: false,
        previewBackgroundResourceId: "missing_allowed_until_resource_import",
      });

      const restored = deserialize(serialize(store.getCurrent()));
      const klass = restored.database.classes.find((record) => record.id === classId);
      const skill = restored.database.skills.find((record) => record.id === skillId);
      const item = restored.database.items.find((record) => record.id === itemId);
      const equipment = restored.database.equipment.find((record) => record.id === equipmentId);
      const enemy = restored.database.enemies.find((record) => record.id === enemyId);
      const troop = restored.database.troops.find((record) => record.id === troopId);

      expect(klass?.battleCommands[0]?.kind).toBe("skill");
      expect(klass?.learnedSkills).toEqual([{ level: 99, skillId }]);
      expect(klass?.stateRates.state_death).toBe("C");
      expect(skill?.mpCost).toEqual({ flat: 0, percentMax: 100 });
      expect(skill?.successRate).toBe(100);
      expect(skill?.variance).toBe(0);
      expect(item?.stateEffects).toEqual([{ stateId: "state_death", chance: 100, operation: "remove" }]);
      expect(equipment).toMatchObject({ accuracy: 37, criticalRate: 14 });
      expect(equipment?.statBonuses.attack).toBe(9999);
      // 음수 능력치는 무거운 장비의 감점이라 저장 왕복에 남는다(0으로 자르지 않는다). 상한만 ±9999.
      expect(equipment?.statBonuses.defense).toBe(-50);
      expect(enemy?.stats.maxHp).toBe(99999);
      expect(enemy?.stats.maxMp).toBe(0);
      expect(enemy?.rewards).toEqual({ exp: 0, gold: 999999, dropItemId: itemId, dropRatePercent: 100 });
      expect(enemy?.actions).toEqual([{
        skillId,
        priority: 99,
        condition: { kind: "turn", start: 1, interval: 1 },
        switchOnAfterAction: { enabled: false, switchId: undefined },
        switchOffAfterAction: { enabled: false, switchId: undefined },
      }]);
      expect(troop?.members).toEqual([{ enemyId, x: 0, y: 240, hidden: true }]);
      expect(troop?.autoAlign).toBe(false);
    });

    it("normalizes enemy compatibility aliases to one canonical value", () => {
      const enemy = normalizeEnemyRecord({
        id: "enemy_alias",
        name: "Alias Test",
        criticalHit: { enabled: false, oneIn: 30 },
        critical: { enabled: true, oneIn: 7 },
        attackOptions: { normalAttacksMiss: false },
        options: { normalAttacksMiss: true },
      } as Parameters<typeof normalizeEnemyRecord>[0] & {
        critical: { enabled: boolean; oneIn: number };
        options: { normalAttacksMiss: boolean };
      });

      expect(enemy.criticalHit).toEqual({ enabled: true, oneIn: 7 });
      expect(enemy.attackOptions).toEqual({ normalAttacksMiss: true });
      expect("critical" in enemy).toBe(false);
      expect("options" in enemy).toBe(false);
    });

    it("persists BM88 class options, animation, curves, rates, commands, and learned skills", () => {
      const project = store.getCurrent();
      const classId = project.database.classes[0]?.id ?? "";
      const skillId = project.database.skills[0]?.id ?? "";
      const animationId = project.database.battleAnimations[0]?.id;

      updateDatabaseRecord("classes", classId, {
        options: { dualWield: true, autoBattle: true, fixedEquipment: true, mightyGuard: true },
        animationId,
        battleCommands: [
          { id: "cmd_attack", name: "공격", kind: "attack" },
          { id: "cmd_skill", name: "기술", kind: "skill" },
          { id: "cmd_defend", name: "방어", kind: "defend" },
          { id: "cmd_item", name: "아이템", kind: "item" },
          { id: "cmd_escape", name: "도주", kind: "escape" },
          { id: "cmd_change", name: "교체", kind: "switch" },
        ],
        learnedSkills: [{ level: 12, skillId }],
        stateRates: { state_death: "A", state_poison: "E" },
        elementRates: { fire: "B", ice: "D" },
        expCurve: { base: 1, extra: 40, acceleration: 40 },
      });

      const restored = deserialize(serialize(store.getCurrent()));
      const klass = restored.database.classes.find((record) => record.id === classId);

      expect(klass?.options).toEqual({ dualWield: true, autoBattle: true, fixedEquipment: true, mightyGuard: true });
      expect(klass?.animationId).toBe(animationId);
      expect(klass?.battleCommands).toHaveLength(6);
      expect(klass?.battleCommands.at(-1)).toMatchObject({ id: "cmd_change", name: "교체", kind: "switch" });
      expect(klass?.learnedSkills).toEqual([{ level: 12, skillId }]);
      expect(klass?.stateRates).toMatchObject({ state_death: "A", state_poison: "E" });
      expect(klass?.elementRates).toMatchObject({ fire: "B", ice: "D" });
      expect(klass?.parameterCurves.maxHp).toHaveLength(99);
      expect(klass?.expCurve).toEqual({ base: 1, extra: 40, acceleration: 40 });
    });

    it("blocks deleting an enemy while a troop references it", () => {
      const result = deleteDatabaseRecord("enemies", DEFAULT_ENEMY_ID);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toContain("몬스터를 사용 중입니다");
      expect(store.getCurrent().database.enemies.some((enemy) => enemy.id === DEFAULT_ENEMY_ID)).toBe(true);
    });

    it("blocks deleting the initial troop while the system references it", () => {
      expect(store.getCurrent().system.initialTroopId).toBe(DEFAULT_TROOP_ID);

      const result = deleteDatabaseRecord("troops", DEFAULT_TROOP_ID);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toContain("적 그룹을 사용 중입니다");
      expect(store.getCurrent().database.troops.some((troop) => troop.id === DEFAULT_TROOP_ID)).toBe(true);
    });

    it("blocks deleting records referenced by expanded database and event command fields", () => {
      const project = store.getCurrent();
      const actorId = project.database.actors[0]?.id ?? "";
      const classId = project.database.classes[0]?.id ?? "";
      const equipmentId = project.database.equipment[0]?.id ?? "";
      const stateId = project.database.states[0]?.id ?? "";

      updateDatabaseRecord("classes", classId, {
        equipmentPermissions: { actorIds: [actorId], classIds: [classId], equipmentIds: [equipmentId] },
      });
      updateDatabaseRecord("equipment", equipmentId, {
        equippableClassIds: [classId],
        stateInflictIds: [stateId],
        usableAsItemSkillId: DEFAULT_SKILL_ID,
      });
      updateDatabaseRecord("items", DEFAULT_ITEM_ID, {
        animationId: DEFAULT_ANIMATION_ID,
        stateEffects: [{ stateId, chance: 100, operation: "remove" }],
      });
      updateDatabaseRecord("enemies", DEFAULT_ENEMY_ID, {
        rewards: { exp: 0, gold: 0, dropItemId: DEFAULT_ITEM_ID, dropRatePercent: 50 },
      });
      store.update((draft) => {
        draft.commonEvents[0]?.commands.push({ kind: "shop", itemIds: [DEFAULT_ITEM_ID] });
        draft.commonEvents[0]?.commands.push({ kind: "learnSkill", actorId, skillId: DEFAULT_SKILL_ID });
        draft.commonEvents[0]?.commands.push({ kind: "battleProcessing", troopId: DEFAULT_TROOP_ID, canEscape: false, canLose: false });
      });

      expect(deleteDatabaseRecord("items", DEFAULT_ITEM_ID)).toMatchObject({ ok: false });
      expect(deleteDatabaseRecord("states", stateId)).toMatchObject({ ok: false });
      expect(deleteDatabaseRecord("equipment", equipmentId)).toMatchObject({ ok: false });
      expect(deleteDatabaseRecord("battleAnimations", DEFAULT_ANIMATION_ID)).toMatchObject({ ok: false });
      expect(deleteDatabaseRecord("skills", DEFAULT_SKILL_ID)).toMatchObject({ ok: false });
      expect(deleteDatabaseRecord("troops", DEFAULT_TROOP_ID)).toMatchObject({ ok: false });
    });

    it("creates, edits, duplicates, deletes, and exports every database collection", () => {
      const createdRecords = DATABASE_COLLECTIONS.map((collection) => {
        const id = addDatabaseRecord(collection);
        const name = `Smoke ${collection}`;
        updateDatabaseRecord(collection, id, { name });
        const copyId = duplicateDatabaseRecord(collection, id);
        const deleteResult = deleteDatabaseRecord(collection, id);

        expect(deleteResult.ok).toBe(true);
        return { collection, id, copyId, name };
      });

      const restored = deserialize(serialize(store.getCurrent()));

      for (const record of createdRecords) {
        expect(restored.database[record.collection].some((entry) => entry.id === record.id)).toBe(false);
        expect(restored.database[record.collection].find((entry) => entry.id === record.copyId)?.name).toBe(
          `${record.name} 사본`,
        );
      }
    });

    it("renames switch and variable ranges without changing stable ids", () => {
      bulkRenameSwitches(1, 3, "Gate");
      bulkRenameVariables(1, 2, "Puzzle");

      const project = store.getCurrent();
      // 필요한 슬롯만 범위 끝까지 만들고 지정한 범위의 이름을 바꾼다.
      expect(project.switches.slice(0, 3).map((entry) => entry.name)).toEqual(["Gate 0001", "Gate 0002", "Gate 0003"]);
      expect(project.variables.slice(0, 2).map((entry) => entry.name)).toEqual(["Puzzle 0001", "Puzzle 0002"]);
      // 동적으로 만들어진 슬롯 전체의 id는 고유해야 한다.
      expect(new Set(project.switches.map((entry) => entry.id)).size).toBe(project.switches.length);
      expect(new Set(project.variables.map((entry) => entry.id)).size).toBe(project.variables.length);
    });

    // Break caught: treating 1,000 as a maximum leaves range authoring unable to
    // address the first slots beyond the old preallocated block.
    it("grows switch and variable ranges beyond the legacy 1000-slot boundary", () => {
      bulkRenameSwitches(1001, 1, "Late Switch");
      bulkRenameVariables(1001, 2, "Late Game");

      const project = store.getCurrent();
      const variables = project.variables;
      expect(project.switches).toHaveLength(1001);
      // 아이템 기동석 스위치가 이미 자리를 채우므로 "1001번째 슬롯" 의 id 는 sw_1001 이 아니다 —
      // 이 테스트가 보는 것은 범위 저작이 옛 1000 슬롯 경계를 넘어갔는가이다.
      const renamed = project.switches.find((entry) => entry.name === "Late Switch 1001");
      if (!renamed) throw new Error("expected a slot renamed to Late Switch 1001");
      expect(project.session.switches[renamed.id]).toBe(false);
      expect(variables).toHaveLength(1002);
      expect(variables[1000]).toEqual({ id: "var_1001", name: "Late Game 1001" });
      expect(variables[1001]).toEqual({ id: "var_1002", name: "Late Game 1002" });
      expect(project.session.variables.var_1002).toBe(0);

      const restored = deserialize(serialize(project));
      const renamedRestored = restored.switches.find((entry) => entry.name === "Late Switch 1001");
      expect(renamedRestored?.id).toBe(renamed.id);
      expect(restored.variables[1001]).toEqual({ id: "var_1002", name: "Late Game 1002" });
      expect(restored.session.variables.var_1002).toBe(0);
    });

    // fix(db): bulkRename이 개수만큼 루프를 돌며 renameSwitch/addSwitch(각각 자체
    // recordProjectSnapshot 호출)를 불러 "범위 적용" 1클릭이 Ctrl+Z 5회를 요구했다
    // (qa-system-report.md). 루프 전체를 감싸는 스냅샷 1개로 통합돼야 한다.
    it("bulk-renames a switch range with exactly one undo snapshot", () => {
      resetMapEditHistory();
      expect(getMapEditHistoryState().canUndo).toBe(false);

      bulkRenameSwitches(500, 5, "QARANGE");

      const project = store.getCurrent();
      expect(project.switches.filter((entry) => entry.name.startsWith("QARANGE ")).map((entry) => entry.name)).toEqual([
        "QARANGE 0500",
        "QARANGE 0501",
        "QARANGE 0502",
        "QARANGE 0503",
        "QARANGE 0504",
      ]);

      const undone = undoMapEdit();
      expect(undone).toBe(true);
      expect(getMapEditHistoryState().canUndo).toBe(false);
      const restoredSlots = store.getCurrent().switches.filter((entry) => /^sw_\d{4}$/u.test(entry.id));
      expect(restoredSlots).toHaveLength(20);
      expect(restoredSlots.every((entry) => entry.name === "")).toBe(true);
    });

    it("rejects malformed v3 database references with an actionable message", () => {
      expect(() => deserialize(JSON.stringify(invalidReferenceProject))).toThrow(/actor_invalid|classId/);
    });
  });
});

describe("dialogueCameraLift", () => {
  isolateTimers();
  describe("dialogue camera lift (system.dialogueKeepActorsVisible)", () => {
    it("moves the camera centre down so the hero sits in the clear band above the dialogue/choice windows", () => {
      // 선택지 창이 화면 40% 높이부터 덮는다(시타마치 캡처: 960x540 에서 약 210px) → 주인공을 22% 높이에.
      const lift = dialogueLiftWorldPx({ coverTopFraction: 0.4, worldViewHeight: 270 });
      expect(lift).toBeCloseTo((0.5 - 0.22) * 270);
      // 대사창만(68%) — 덜 내린다.
      expect(dialogueLiftWorldPx({ coverTopFraction: 0.68, worldViewHeight: 270 })).toBeLessThan(lift);
    });

    it("does nothing for tiny bottom bubbles or windows docked at the top", () => {
      expect(dialogueLiftWorldPx({ coverTopFraction: 0.9, worldViewHeight: 270 })).toBe(0);
      expect(dialogueLiftWorldPx({ coverTopFraction: 0.1, worldViewHeight: 270 })).toBe(0);
      expect(dialogueLiftWorldPx({ coverTopFraction: Number.NaN, worldViewHeight: 270 })).toBe(0);
    });

    it("only resets an offset it set itself, and never touches a camera that is not following the hero", () => {
      const calls: number[] = [];
      const player = {};
      const camera = { worldView: { height: 270 }, followOffset: { y: 0 }, _follow: player, setFollowOffset: (_x?: number, y?: number) => { calls.push(y ?? 0); } };
      const scene = { cameras: { main: camera }, player, game: { canvas: null } };
      expect(syncDialogueCameraLift(scene, undefined, true, false)).toBe(false);
      expect(calls).toEqual([]);
      expect(syncDialogueCameraLift(scene, undefined, true, true)).toBe(false);
      expect(calls).toEqual([0]);
    });

    it("survives system normalization, including an explicit false", () => {
      expect(normalizeSystemRecords({ startActorIds: [], dialogueKeepActorsVisible: true }).dialogueKeepActorsVisible).toBe(true);
      expect(normalizeSystemRecords({ startActorIds: [], dialogueKeepActorsVisible: false }).dialogueKeepActorsVisible).toBe(false);
      expect(normalizeSystemRecords({ startActorIds: [] }).dialogueKeepActorsVisible).toBeUndefined();
    });
  });
});

describe("equipmentCatalogRuntimeAxes", () => {
  isolateTimers();
  const HERO_ID = "actor_hero";
  const ENEMY_ID = "enemy_slime";
  const TROOP_ID = "troop_slime";
  function equipment(id: string, patch: Partial<EquipmentRecord>): EquipmentRecord {
    return normalizeEquipmentRecord({
      id,
      name: id,
      slot: "weapon",
      description: "런타임 장비 축 검증용 장비",
      statBonuses: { attack: 0, defense: 0, mind: 0, agility: 0 },
      equippableActorIds: [HERO_ID],
      ...patch,
    });
  }
  function runtimeProject(): Project {
    const project = createBlankProject();
    project.system.battleFlow = "strict";
    project.session.partyActorIds = [HERO_ID];
    project.system.startActorIds = [HERO_ID];
    const actor = project.database.actors.find((record) => record.id === HERO_ID)!;
    actor.critical = { enabled: false, chanceDenominator: 20 };
    actor.parameterCurves.attack = actor.parameterCurves.attack.map(() => 60);
    actor.parameterCurves.agility = actor.parameterCurves.agility.map(() => 20);
    actor.elementRates = { ...actor.elementRates, fire: "C" };
    const enemy = project.database.enemies.find((record) => record.id === ENEMY_ID)!;
    enemy.stats = { maxHp: 9999, maxMp: 999, attack: 40, defense: 10, mind: 10, agility: 20 };
    enemy.elementRates = { ...enemy.elementRates, fire: "C" };
    enemy.actions = [];
    return project;
  }
  function runActorAttack(project: Project, weapon: EquipmentRecord, rng: () => number) {
    project.database.equipment.push(weapon);
    const runtime = createBattleRuntime({
      project,
      troopId: TROOP_ID,
      battleFlow: "strict",
      canEscape: false,
      canLose: true,
      party: {
        partyActorIds: [HERO_ID],
        levels: { [HERO_ID]: 1 },
        experience: {},
        equipment: { [HERO_ID]: { weapon: weapon.id } },
      },
      rng,
    });
    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    const attack = runtime.snapshot().timeline.find(
      (entry) => entry.userRecordId === HERO_ID && entry.commandKind === "attack" && (entry.kind === "damage" || entry.kind === "miss"),
    );
    return { runtime, attack };
  }
  function enemySkillRuntime(project: Project, shield: EquipmentRecord | undefined, rng: () => number) {
    if (shield) project.database.equipment.push(shield);
    const enemy = project.database.enemies.find((record) => record.id === ENEMY_ID)!;
    enemy.actions = [{
      skillId: "skill_axis_enemy",
      priority: 100,
      condition: { kind: "always" },
      switchOnAfterAction: { enabled: false },
      switchOffAfterAction: { enabled: false },
    }];
    enemy.skillIds = ["skill_axis_enemy"];
    const runtime = createBattleRuntime({
      project,
      troopId: TROOP_ID,
      battleFlow: "strict",
      canEscape: false,
      canLose: true,
      party: {
        partyActorIds: [HERO_ID],
        levels: { [HERO_ID]: 1 },
        experience: {},
        equipment: { [HERO_ID]: shield ? { shield: shield.id } : {} },
      },
      rng,
    });
    runtime.performActorCommand({ kind: "defend" });
    return runtime.snapshot();
  }
  describe("기본 장비가 사용하는 전투 런타임 축", () => {
    it("장비 명중률 차이가 같은 난수에서 일반 공격의 적중 여부를 바꾼다", () => {
      const accurate = runActorAttack(runtimeProject(), equipment("equip_accuracy_high", { accuracy: 100 }), () => 0.9);
      const inaccurate = runActorAttack(runtimeProject(), equipment("equip_accuracy_low", { accuracy: 80 }), () => 0.9);

      expect(accurate.attack?.kind).toBe("damage");
      expect(inaccurate.attack?.kind).toBe("miss");
    });

    it("장비 치명타율 차이가 같은 난수에서 일반 공격 피해를 바꾼다", () => {
      const ordinary = runActorAttack(runtimeProject(), equipment("equip_critical_none", { criticalRate: 0 }), () => 0);
      const critical = runActorAttack(runtimeProject(), equipment("equip_critical_certain", { criticalRate: 100 }), () => 0);

      expect(ordinary.attack?.critical).toBe(false);
      expect(critical.attack?.critical).toBe(true);
      expect(critical.attack?.amount).toBeGreaterThan(ordinary.attack?.amount ?? 0);
    });

    it("장비 상태 부여가 적중한 일반 공격 뒤 실제 대상 상태가 된다", () => {
      const result = runActorAttack(runtimeProject(), equipment("equip_poison_weapon", {
        stateInflictIds: ["state_poison"],
        stateInflictionChance: 100,
      }), () => 0);

      expect(result.attack?.kind).toBe("damage");
      expect(result.runtime.snapshot().enemies[0]?.stateIds).toContain("state_poison");
    });

    it("장비 공격 속성이 대상의 일치 속성 등급으로 일반 공격 피해를 줄인다", () => {
      const neutralProject = runtimeProject();
      const resistantProject = runtimeProject();
      resistantProject.database.enemies.find((record) => record.id === ENEMY_ID)!.elementRates.fire = "D";
      const neutral = runActorAttack(neutralProject, equipment("equip_fire_neutral", { attackElementIds: ["fire"] }), () => 0.5);
      const resisted = runActorAttack(resistantProject, equipment("equip_fire_resisted", { attackElementIds: ["fire"] }), () => 0.5);

      expect(neutral.attack?.amount).toBeGreaterThan(resisted.attack?.amount ?? 0);
    });

    it("일치하는 장비 속성 방어가 실제 속성 피해를 줄인다", () => {
      const plainProject = runtimeProject();
      plainProject.database.skills.push(normalizeSkillRecord({
        id: "skill_axis_enemy",
        name: "화염 시험",
        power: 80,
        hitRate: 100,
        variance: 0,
        elementId: "fire",
        effect: { kind: "damage", statistic: "attack", affects: "hp" },
      }));
      const guardedProject = structuredClone(plainProject);
      const plain = enemySkillRuntime(plainProject, undefined, () => 0.5);
      const guarded = enemySkillRuntime(guardedProject, equipment("equip_fire_guard_test", {
        slot: "shield",
        elementalDefenseIds: ["fire"],
      }), () => 0.5);
      const plainDamage = plain.actors[0]!.maxHp - plain.actors[0]!.hp;
      const guardedDamage = guarded.actors[0]!.maxHp - guarded.actors[0]!.hp;

      expect(guardedDamage).toBeGreaterThan(0);
      expect(guardedDamage).toBeLessThan(plainDamage);
    });

    it("일치하는 장비 상태 방어가 실제 상태 부여를 저항한다", () => {
      const plainProject = runtimeProject();
      plainProject.database.skills.push(normalizeSkillRecord({
        id: "skill_axis_enemy",
        name: "독 시험",
        power: 0,
        hitRate: 100,
        variance: 0,
        stateEffects: [{ stateId: "state_poison", chance: 100, operation: "add" }],
        effect: { kind: "support" },
      }));
      const guardedProject = structuredClone(plainProject);
      const plain = enemySkillRuntime(plainProject, undefined, () => 0);
      const guarded = enemySkillRuntime(guardedProject, equipment("equip_poison_guard_test", {
        slot: "shield",
        stateDefenseIds: ["state_poison"],
        stateResistanceChance: 100,
      }), () => 0);

      expect(plain.actors[0]?.stateIds).toContain("state_poison");
      expect(guarded.actors[0]?.stateIds).not.toContain("state_poison");
    });
  });
});

describe("feature16CombatHardening", () => {
  isolateTimers();
  function setup(patch: Partial<SkillRecord> = {}, flow: 'strict' | 'gauge' = 'strict') {
    const project = deserialize(JSON.stringify(fixture));
    const skill = normalizeSkillRecord({ id: 'hardening', name: 'Hardening', power: 10, damageFormula: 'power', criticalRate: 0, variance: 0,
      mpCost: { flat: 3, percentMax: 0 }, hitSequence: [1, 1], ...patch });
    project.database.skills.push(skill);
    const actor = project.database.actors.find(a => a.id === 'actor_warrior')!;
    actor.learnedSkills = [{ level: 1, skillId: skill.id }];
    actor.parameterCurves.maxMp = Array(99).fill(100);
    actor.parameterCurves.maxHp = Array(99).fill(9999);
    actor.parameterCurves.agility = Array(99).fill(999);
    const enemy = project.database.enemies.find(e => e.id === 'enemy_training_slime')!;
    enemy.stats = { ...enemy.stats, maxHp: 1000, maxMp: 100, attack: 1, defense: 20, agility: 1 };
    enemy.actions = [{ skillId: '', priority: 50, condition: { kind: 'always' }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }];
    const troop = project.database.troops.find(t => t.id === 'troop_strict_training')!;
    troop.battleEventPages = [];
    const start = () => createBattleRuntime({ project, troopId: troop.id, canEscape: false, canLose: true, battleFlow: flow, rng: () => 0.5,
      party: { levels: {}, experience: {}, partyActorIds: [actor.id] } });
    return { project, skill, enemy, troop, start };
  }
  const cast = (runtime: ReturnType<typeof createBattleRuntime>) => runtime.performActorCommand({ kind: 'skill', skillId: 'hardening', targetEnemyId: 'enemy-1' });
  const actorHits = (runtime: ReturnType<typeof createBattleRuntime>) => runtime.snapshot().timeline.filter(e => e.userRecordId === 'actor_warrior' && e.kind === 'damage');
  function comparePrediction(patch: Partial<SkillRecord>, configure?: (fixture: ReturnType<typeof setup>) => void) {
    const fixture = setup(patch); configure?.(fixture);
    const runtime = fixture.start();
    const before = runtime.snapshot(); const original = JSON.stringify(before);
    const predicted = predictSkillDamageFor(fixture.project, before.actors[0], fixture.skill, before.enemies[0]);
    expect(JSON.stringify(before)).toBe(original);
    cast(runtime);
    const amounts = actorHits(runtime).map(e => e.amount!);
    expect(predicted.amount).toBe(amounts.reduce((sum, value) => sum + value, 0));
    return { runtime, amounts };
  }
  describe('feature16 combat hardening: production runtime and presentation', () => {
    it('subtracts one MP cost before evaluating a.mp on every hit', () => {
      const { amounts, runtime } = comparePrediction({ damageFormula: 'a.mp' });
      expect(amounts).toEqual([97, 97]);
      expect(runtime.snapshot().actors[0].mp).toBe(97);
    });
    it('recalculates a guaranteed defense state between formula hits', () => {
      const { amounts } = comparePrediction({ damageFormula: '100 - b.def', stateEffects: [{ stateId: 'hardening_weak', chance: 100, operation: 'add' }] }, ({ project, enemy }) => {
        project.database.states.push({ id: 'hardening_weak', name: 'Weak', runtimeEffects: { defenseMultiplier: 0.5 } });
        enemy.stateRates.hardening_weak = 'A';
      });
      expect(amounts).toEqual([80, 90]);
    });
    it('recalculates the ordinary formula after a guaranteed state change', () => {
      comparePrediction({ damageFormula: undefined, power: 100, stateEffects: [{ stateId: 'hardening_weak', chance: 100, operation: 'add' }] }, ({ project, enemy }) => {
        project.database.states.push({ id: 'hardening_weak', name: 'Weak', runtimeEffects: { defenseMultiplier: 0.5 } });
        enemy.stateRates.hardening_weak = 'A';
      });
    });
    it('updates MP rather than HP between MP formula hits', () => {
      const { amounts, runtime } = comparePrediction({ damageFormula: 'b.mp / 2', effect: { kind: 'damage', statistic: 'attack', affects: 'mp' } });
      expect(amounts).toEqual([50, 25]);
      expect(runtime.snapshot().enemies[0]).toMatchObject({ hp: 1000, mp: 25 });
    });
    it('rejects a queued extra cast after the first cast starts cooldown', () => {
      const { troop, start } = setup({ cooldownTurns: 2, hitSequence: [1] });
      troop.battleEventPages = [{ id: 'extra', span: 'battle', runOnce: true, conditions: [{ kind: 'turn', start: 1, interval: 0 }],
        commands: [{ kind: 'm2Command', commandId: 'm2-108-action-times', fields: { target: 'actor_warrior', value: 1 } }] }];
      const runtime = start(); cast(runtime);
      expect(runtime.snapshot().eventLogs.some(log => log.detail?.includes('actionTimes'))).toBe(true);
      expect(actorHits(runtime)).toHaveLength(1);
      expect(runtime.snapshot().actors[0].mp).toBe(97);
      expect(runtime.snapshot().actors[0].skillCooldowns?.hardening).toBe(2);
    });
    it('decrements gauge cooldown once per whole cycle rather than once per battler', () => {
      const { project, enemy, start } = setup({ cooldownTurns: 2, hitSequence: [1] }, 'gauge');
      project.database.actors.find(actor => actor.id === 'actor_warrior')!.parameterCurves.agility = Array(99).fill(20);
      enemy.stats.agility = 20;
      const runtime = start();
      const awaitActor = () => {
        for (let i = 0; i < 100 && runtime.snapshot().phase !== 'actorCommand'; i++) runtime.tick(1000);
        expect(runtime.snapshot().phase).toBe('actorCommand');
      };
      awaitActor(); cast(runtime); awaitActor();
      expect(runtime.snapshot().actors[0].skillCooldowns?.hardening).toBe(2);
      const before = runtime.snapshot().actors[0].mp; cast(runtime);
      expect(runtime.snapshot().actors[0].mp).toBe(before);
      runtime.performActorCommand({ kind: 'defend' }); awaitActor();
      expect(runtime.snapshot().actors[0].skillCooldowns?.hardening).toBe(1);
      runtime.performActorCommand({ kind: 'defend' }); awaitActor();
      expect(runtime.snapshot().actors[0].skillCooldowns?.hardening).toBeUndefined();
    });
    it.each(['strict', 'gauge'] as const)('evaluates %s drops in the killing turn before battle-end state cleanup', flow => {
      // #3370 부터 피해로 쓰러뜨린 그 타격은 상태를 걸지 않는다 — 첫 타(600)가 표식을 걸고 둘째 타가 쓰러뜨리게 나눠,
      // 「쓰러뜨린 턴의 드롭은 전투 종료 정리(removeOnBattleEnd) 전에 판정한다」는 이 검사의 뜻을 그대로 본다.
      const { project, enemy, start } = setup({ power: 600, hitSequence: [1, 1], stateEffects: [{ stateId: 'marked', chance: 100, operation: 'add' }] }, flow);
      project.database.states.push({ id: 'marked', name: 'Marked', runtimeEffects: { removeOnBattleEnd: true } });
      enemy.stateRates.marked = 'A';
      enemy.rewards.drops = [
        { itemId: 'mark_reward', ratePercent: 100, quantity: 1, condition: { kind: 'status', stateId: 'marked', present: true } },
        { itemId: 'wrong_absence', ratePercent: 100, quantity: 1, condition: { kind: 'status', stateId: 'marked', present: false } },
        { itemId: 'first_turn', ratePercent: 100, quantity: 1, condition: { kind: 'turn', start: 1, interval: 99 } },
        { itemId: 'wrong_turn', ratePercent: 100, quantity: 1, condition: { kind: 'turn', start: 2, interval: 99 } },
      ];
      const runtime = start();
      if (flow === 'gauge') for (let tick = 0; tick < 40 && runtime.snapshot().phase !== 'actorCommand'; tick++) runtime.tick(1000);
      expect(runtime.snapshot().phase).toBe('actorCommand'); cast(runtime);
      expect(runtime.snapshot().result).toBe('victory');
      expect(runtime.snapshot().rewards.items).toEqual(['mark_reward', 'first_turn']);
      expect(runtime.snapshot().enemies[0].stateIds).not.toContain('marked');
    });
    it('preserves MP damage through sequencer feedback without reducing displayed HP', () => {
      const { start } = setup({ effect: { kind: 'damage', statistic: 'attack', affects: 'mp' } });
      const runtime = start(); const before = runtime.snapshot(); const ledger = createPresentationLedger(before);
      cast(runtime); const after = runtime.snapshot();
      expect(actorCommandDirectorState({ kind: 'skill', skillId: 'hardening', targetEnemyId: 'enemy-1' }, before, after).lines.join(' ')).toContain('MP');
      expect(enemyActionDirectorState({ userRecordId: 'enemy_training_slime', targetId: before.actors[0].id, hit: true, amount: 10, critical: false }, after, { resource: 'mp', healing: false }).lines.join(' ')).toContain('MP');
      const queue: (() => void)[] = []; const feedback: DamageFeedback[] = [];
      const spy = vi.spyOn(advance, 'advanceBattleRuntime').mockImplementation(() => undefined);
      try {
        const sequencer = createBattleSequencer(runtime, {
          onDirectorState: () => undefined, onSyncView: () => undefined, onDamageFeedback: value => { if (value) { feedback.push(value); ledger.applyFeedback(value); } },
          onResultStage: () => undefined, onSequenceBusy: () => undefined,
        }, callback => { queue.push(callback); return queue.length; }, () => undefined);
        sequencer.runAfterActorCommand({ kind: 'skill', skillId: 'hardening', targetEnemyId: 'enemy-1' }, before, after);
        for (let i = 0; queue.length && i < 100; i++) queue.shift()!();
        const enemyFeedback = feedback.filter(value => value.targetId === 'enemy-1');
        expect(enemyFeedback).toHaveLength(2);
        expect(enemyFeedback.every(value => value.resource === 'mp' && !value.healing)).toBe(true);
        expect(ledger.vitalsFor('enemy-1')).toMatchObject({ hp: 1000, defeated: false });
      } finally { spy.mockRestore(); }
    });
    it('marks exact Gen1 MP damage with the MP timeline resource', () => {
      const { project, enemy } = setup({ hitRate: 100, damageFormula: '10', effect: { kind: 'damage', statistic: 'attack', affects: 'mp' } });
      project.system.battleModel = 'gen1';
      enemy.stats.maxHp = 999; // Stay within Gen1's stat clamp during end-of-turn status processing.
      // Keep enemy Struggle recoil out of this MP-only HP preservation assertion.
      const idleSkill = normalizeSkillRecord({ id: 'hardening_enemy_idle', name: '대기', scope: 'self', power: 20, effect: { kind: 'healing', statistic: 'mind', affects: 'mp' }, mpCost: { flat: 0, percentMax: 0 } });
      project.database.skills.push(idleSkill);
      enemy.actions = [{ ...enemy.actions[0], skillId: idleSkill.id, condition: { kind: 'always' } }];
      // Exact Gen1 damage sampling needs a byte accepted by its rejection sampler.
      let byteIndex = 0;
      const bytes = [0, 255, 0];
      const runtime = createBattleRuntime({ project, troopId: 'troop_strict_training', canEscape: false, canLose: true, battleFlow: 'strict', rng: () => bytes[byteIndex++ % bytes.length] / 256,
        party: { levels: {}, experience: {}, partyActorIds: ['actor_warrior'] } });
      const hpBefore = runtime.snapshot().enemies[0].hp;
      cast(runtime);
      expect(actorHits(runtime).length).toBeGreaterThan(0);
      expect(actorHits(runtime).every(hit => hit.resource === 'mp')).toBe(true);
      expect(runtime.snapshot().enemies[0].hp, JSON.stringify(runtime.snapshot().timeline)).toBe(hpBefore);
    });
  });
});

describe("feature16CombatRuntime", () => {
  isolateTimers();
  function setup(patch: Partial<SkillRecord> = {}, options: Partial<BattleRuntimeOptions> = {}) {
    const project = deserialize(JSON.stringify(fixture));
    const skill = normalizeSkillRecord({ id: 'feature16', name: '연격', power: 10, damageFormula: 'power', criticalRate: 0, variance: 0, mpCost: { flat: 3, percentMax: 0 }, hitSequence: [1, 2, 3], ...patch });
    project.database.skills.push(skill);
    const warrior = project.database.actors.find(a => a.id === 'actor_warrior')!;
    warrior.learnedSkills = [{ level: 1, skillId: skill.id }];
    warrior.parameterCurves.maxMp = Array(99).fill(100);
    warrior.parameterCurves.maxHp = Array(99).fill(9999);
    warrior.parameterCurves.agility = Array(99).fill(999);
    const enemy = project.database.enemies.find(e => e.id === 'enemy_training_slime')!;
    enemy.stats = { ...enemy.stats, maxHp: 1000, attack: 1, agility: 1 };
    enemy.actions = [{ skillId: '', priority: 50, condition: { kind: 'always' }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }];
    project.database.troops.find(t => t.id === 'troop_strict_training')!.battleEventPages = [];
    const runtimeOptions: BattleRuntimeOptions = { project, troopId: 'troop_strict_training', canEscape: false, canLose: true, battleFlow: 'strict', rng: () => 0.5,
      party: { levels: {}, experience: {}, partyActorIds: ['actor_warrior'] }, ...options };
    return { project, skill, enemy, runtimeOptions };
  }
  const cast = (runtime: ReturnType<typeof createBattleRuntime>) => runtime.performActorCommand({ kind: 'skill', skillId: 'feature16', targetEnemyId: 'enemy-1' });
  describe('feature16 shipping runtime integration', () => {
    it('records each hit, consumes MP once and uses authored multipliers', () => {
      const { runtimeOptions } = setup();
      const runtime = createBattleRuntime(runtimeOptions);
      const before = runtime.snapshot().actors[0].mp;
      cast(runtime);
      const snapshot = runtime.snapshot();
      const hits = snapshot.timeline.filter(entry => entry.userRecordId === 'actor_warrior' && entry.kind === 'damage');
      expect(hits.map(hit => hit.amount)).toEqual([10, 20, 30]);
      expect(snapshot.actors[0].mp).toBe(before - 3);
      expect(snapshot.enemies[0].hp).toBe(940);
    });
    it('stops the actual sequence immediately on lethal damage', () => {
      const { runtimeOptions, enemy } = setup(); enemy.stats.maxHp = 25;
      const runtime = createBattleRuntime(runtimeOptions); cast(runtime);
      expect(runtime.snapshot().timeline.filter(e => e.userRecordId === 'actor_warrior' && e.kind === 'damage').map(e => e.amount)).toEqual([10, 20]);
      expect(runtime.snapshot().enemies[0].hp).toBe(0);
    });
    it('rejects cooldown commands without consuming a round or MP, then unlocks after full rounds', () => {
      const { runtimeOptions } = setup({ cooldownTurns: 2 });
      const runtime = createBattleRuntime(runtimeOptions); cast(runtime);
      expect(runtime.snapshot().actors[0].skillCooldowns?.feature16).toBe(2);
      const before = runtime.snapshot(); cast(runtime);
      expect(runtime.snapshot().actors[0].mp).toBe(before.actors[0].mp);
      expect(runtime.snapshot().roundLogs.length).toBe(before.roundLogs.length);
      runtime.performActorCommand({ kind: 'defend' });
      expect(runtime.snapshot().actors[0].skillCooldowns?.feature16).toBe(1);
      runtime.performActorCommand({ kind: 'defend' });
      expect(runtime.snapshot().actors[0].skillCooldowns?.feature16).toBeUndefined();
      cast(runtime);
      expect(runtime.snapshot().actors[0].mp).toBe(before.actors[0].mp - 3);
    });
    it('allows a legacy single-hit revival to apply to an explicitly dead ally', () => {
      const { runtimeOptions } = setup({ hitSequence: undefined, damageFormula: undefined, scope: 'ally', effect: { kind: 'healing', statistic: 'mind', affects: 'hp' }, stateEffects: [{ stateId: 'state_death', chance: 100, operation: 'remove' }] }, {
        activeSlots: 2, party: { levels: {}, experience: {}, partyActorIds: ['actor_warrior', 'actor_mage'], vitals: { actor_mage: { hp: 0, mp: 10 } } },
      });
      const runtime = createBattleRuntime(runtimeOptions);
      expect(runtime.snapshot().actors.find(a => a.recordId === 'actor_mage')!.hp).toBe(0);
      runtime.performActorCommand({ kind: 'skill', skillId: 'feature16', targetActorId: 'actor_mage' });
      expect(runtime.snapshot().actors.find(a => a.recordId === 'actor_mage')!.hp).toBeGreaterThan(0);
      expect(runtime.snapshot().timeline.some(e => e.kind === 'healing' && e.userRecordId === 'actor_warrior')).toBe(true);
    });
    it('changes enemy action selection when its authored HP threshold is reached', () => {
      const { project, enemy, runtimeOptions } = setup({ power: 600, hitSequence: [1] });
      project.database.skills.push(normalizeSkillRecord({ id: 'rage', name: '분노', power: 1, criticalRate: 0, damageFormula: '1' }));
      enemy.actions = [{ ...enemy.actions[0], skillId: 'rage', priority: 100, condition: { kind: 'hp', minPercent: 0, maxPercent: 50 } }];
      const runtime = createBattleRuntime(runtimeOptions); cast(runtime);
      expect(runtime.snapshot().roundLogs[0].timeline.some(e => e.skillName === '분노')).toBe(false);
      runtime.performActorCommand({ kind: 'defend' });
      expect(runtime.snapshot().roundLogs[1].timeline.some(e => e.skillName === '분노')).toBe(true);
    });
    it('uses authored critical/hit rates and MP targeting through real commands', () => {
      const { runtimeOptions, enemy } = setup({ power: 10, criticalRate: 100, criticalMultiplier: 3, hitSequence: [1, 1], effect: { kind: 'damage', statistic: 'attack', affects: 'mp' } });
      enemy.stats.maxMp = 100;
      const runtime = createBattleRuntime(runtimeOptions); cast(runtime);
      const snapshot = runtime.snapshot();
      expect(snapshot.enemies[0].hp).toBe(1000);
      expect(snapshot.enemies[0].mp).toBe(40);
      expect(snapshot.timeline.filter(e => e.userRecordId === 'actor_warrior' && e.kind === 'damage').map(e => e.amount)).toEqual([30, 30]);
      const miss = setup({ hitRate: 0 }); const missed = createBattleRuntime(miss.runtimeOptions); cast(missed);
      expect(missed.snapshot().enemies[0].hp).toBe(1000);
      expect(missed.snapshot().timeline.filter(e => e.userRecordId === 'actor_warrior' && e.kind === 'miss')).toHaveLength(3);
    });
    it('evaluates victory drops against the battle session switches', () => {
      const { runtimeOptions, enemy } = setup({ power: 2000, hitSequence: [1] });
      enemy.rewards.drops = [{ itemId: 'bonus_item', ratePercent: 100, quantity: 2, condition: { kind: 'switch', switchId: 'bonus', value: true } }];
      const runtime = createBattleRuntime({ ...runtimeOptions, sessionState: { switches: { bonus: true }, variables: {}, inventory: {} } });
      cast(runtime);
      expect(runtime.snapshot().rewards.items).toEqual(['bonus_item', 'bonus_item']);
    });
    it('runs authored sequences in the production headless simulator with a fixed seed', () => {
      const { project } = setup({ power: 600, hitSequence: [1, 1] });
      const input = { project, troopId: 'troop_strict_training', heroLevel: 1, partyActorIds: ['actor_warrior'], battleFlow: 'strict' as const, n: 1, seed: 16, maxSteps: 10,
        strictScript: [[{ actorId: 'actor_warrior', command: 'skill' as const, skillId: 'feature16', target: 'enemy-1' }]] };
      const first = simulateBattle(input);
      const second = simulateBattle(input);
      expect(first).toEqual(second);
      expect(first.winRate).toBe(1);
    });
  });
});
