import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { addDatabaseRecord, bulkRenameSwitches, bulkRenameVariables, deleteDatabaseRecord, duplicateDatabaseRecord, updateDatabaseRecord, type DatabaseCollection } from "@/editor/databaseActions";
import { getMapEditHistoryState, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { createBlankProject, DEFAULT_ANIMATION_ID, DEFAULT_ENEMY_ID, DEFAULT_ITEM_ID, DEFAULT_SKILL_ID, DEFAULT_TROOP_ID } from "@/project/defaults";
import { normalizeEnemyRecord, normalizeSystemRecords, normalizeEquipmentRecord, normalizeSkillRecord, normalizeDatabaseRecords, normalizeItemRecord } from "@/project/databaseRecordModel";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import invalidReferenceProject from "./fixtures/projects/invalid-db-reference-v3.json";
import { dialogueLiftWorldPx, syncDialogueCameraLift } from "@/player/dialogueCameraLift";
import { createBattleRuntime } from "@/battle/runtime";
import type { EquipmentRecord, Project, SkillRecord, ProjectDatabaseRecords, GameEvent, EndingDef } from "@/project/types";
import { predictSkillDamageFor } from "@/battle/battlePredict";
import { createBattleSequencer, type DamageFeedback } from "@/player/battleSequencer";
import { actorCommandDirectorState, enemyActionDirectorState } from "@/player/battleDirectorDom";
import { createPresentationLedger } from "@/player/battlePresentation";
import * as advance from "@/battle/battleRuntimeAdvance";
import fixture from "./fixtures/projects/battle-strict-v3.json";
import { simulateBattle } from "@/battle/simulate";
import type { BattleRuntimeOptions } from "@/battle/types";
import { isolateTimers } from "./mergedTeardown";
import { syncBattleModelAttribute } from "@/app/mode";
import { installFakeDom } from "./fakeDom";
import { normalizeSkillWeather, weatherDamagePercent, weatherResidualDamage, weatherResidualLine } from "@/battle/weather";
import { captureConditionLabel, captureConditionLine, captureConditionMultiplier, normalizeCaptureCondition } from "@/battle/captureBalls";
import { getCharacterProfile, resolveBirthday, resolveGiftPrefs, resolveGiftResponses } from "@/project/characterProfiles";
import { giveGiftToNpc, isGiftableEvent } from "@/project/friendship";
import { startSession } from "@/project/session";
import { collectEndingWarnings } from "../src/project/endings";
import { _resetEventDraftVaultForTest, eventDraftVaultStorageKey, persistEventDraftVaultNow, rememberEventDraftVaultEntry, listEventDraftVaultEntries, forgetEventDraftVaultEntry, restoreEventDraftVaultEntries, syncEventDraftVaultFromProject } from "@/project/eventDraftVault";

describe("databaseActions", () => {
  isolateTimers();
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
});

describe("databaseRecordModel", () => {
  isolateTimers();
  describe("animationSchema", () => {
    isolateTimers();
    describe("RPG2003 animation schema", () => {
      it("ships effect animations with sheet frames cells timings and display flags", () => {
        // Given: the blank project owns the canonical starter animation database.
        const project = createBlankProject();

        // When: an effect animation is read by editor/runtime surfaces.
        const hit = project.database.battleAnimations.find((animation) => animation.id === "anim_hit");

        // Then: it is not a shallow id/name/resource record.
        // The starter hit uses the generated tackle-impact sheet since the scarloxy battle sheets left the starter records (public baseline 0d4f13e7c8).
        expect(hit).toMatchObject({
          id: "anim_hit",
          resourceId: "generated-battle-anim-tackle-impact",
          sheet: { frameWidth: 384, frameHeight: 384, columns: 8 },
          scope: "singleTarget",
          position: "center",
          large: false,
        });
        expect(hit?.frames?.[0]?.cells[0]).toMatchObject({
          pattern: 0,
          x: 0,
          y: -8,
          zoom: 100,
          opacity: 255,
          visible: true,
        });
        expect(hit?.timings?.[0]).toMatchObject({
          frameIndex: 3,
          flash: { target: "target", color: { red: 220, green: 232, blue: 245, gray: 0 }, durationFrames: 4 },
        });
      });

      it("normalizes legacy shallow battle animations into runtime-safe effect records", () => {
        // Given: an existing save only has legacy battle animation fields.
        const legacyDatabase: ProjectDatabaseRecords = {
          actors: [],
          classes: [],
          skills: [],
          items: [],
          equipment: [],
          enemies: [],
          troops: [],
          states: [],
          battleAnimations: [{ id: "anim_legacy", name: "Legacy", resourceId: "scarloxy-battle-anim-scratch" }],
        };

        // When: the database passes through runtime normalization.
        const normalized = normalizeDatabaseRecords(legacyDatabase);

        // Then: the effect animation gains safe playback fields.
        expect(normalized.battleAnimations[0]).toMatchObject({
          id: "anim_legacy",
          name: "Legacy",
          resourceId: "scarloxy-battle-anim-scratch",
          sheet: { frameWidth: 96, frameHeight: 96, columns: 5 },
          frames: [{ cells: [{ pattern: 0, visible: true }] }],
          timings: [],
        });
      });

      it("round-trips default effect animation records through project IO", () => {
        // Given: the starter project includes expanded animation records.
        const project = createBlankProject();

        // When: the project is serialized and deserialized through the real IO layer.
        const restored = deserialize(serialize(project));

        // Then: the animation collection survives validation.
        expect(restored.database.battleAnimations[0]?.frames?.length).toBeGreaterThan(0);
      });
    });
  });
  // test/battleModelSelector.test.ts
  // system.battleModel 선택자("rm2k3" | "gen1")의 스키마/마이그레이션/정규화/DOM 속성 검증.
  // 기본(rm2k3)은 기존 RM2k3 전투 동작을 100% 유지하며, gen1 만 별도 보존한다.
  describe("battleModelSelector", () => {
    isolateTimers();
    describe("system.battleModel — 기본값/마이그레이션", () => {
      it("새 프로젝트는 기본 rm2k3 이다(필드 생략)", () => {
        const project = createBlankProject();
        expect(project.system.battleModel).toBeUndefined();
        expect(project.system.battleModel ?? "rm2k3").toBe("rm2k3");
        // 기본 프로젝트 JSON 에는 battleModel 키가 없다(레거시와 동일한 바이트).
        expect(serialize(project)).not.toContain("battleModel");
      });

      it("레거시 프로젝트(battleModel 필드 없음)는 rm2k3 로 로드된다", () => {
        const project = createBlankProject();
        const raw = serialize(project);
        const restored = deserialize(raw);
        expect(restored.system.battleModel).toBeUndefined();
        expect(restored.system.battleModel ?? "rm2k3").toBe("rm2k3");
      });

      it("gen1 명시적으로 설정한 프로젝트에서 rm2k3 로 되돌리면 키가 생략된다", () => {
        const project = createBlankProject();
        project.system.battleModel = "gen1";
        const obj = JSON.parse(serialize(project));
        expect(obj.system.battleModel).toBe("gen1");
        // gen1 -> rm2k3 전환 후 직렬화하면 키가 사라진다(기본값 미저장 계약).
        obj.system.battleModel = "rm2k3";
        const restored = deserialize(JSON.stringify(obj));
        expect(restored.system.battleModel).toBeUndefined();
        expect(restored.system.battleModel ?? "rm2k3").toBe("rm2k3");
      });
    });
    describe("system.battleModel — 직렬화 왕복", () => {
      it("gen1 설정은 serialize/deserialize 왕복을 보존한다", () => {
        const project = createBlankProject();
        project.system.battleModel = "gen1";
        const wire = serialize(project);
        expect(wire).toContain('"battleModel":"gen1"');
        const restored = deserialize(wire);
        expect(restored.system.battleModel).toBe("gen1");
      });

      it("rm2k3(기본)은 왕복해도 JSON 에 키를 만들지 않는다", () => {
        const project = createBlankProject();
        project.system.battleModel = "rm2k3";
        const restored = deserialize(serialize(project));
        expect(restored.system.battleModel).toBeUndefined();
        expect(serialize(restored)).not.toContain("battleModel");
      });
    });
    describe("system.battleModel — 정규화", () => {
      it("gen1 은 normalizeSystemRecords 후 보존된다", () => {
        const base = createBlankProject();
        const out = normalizeSystemRecords({ ...base.system, battleModel: "gen1" });
        expect(out.battleModel).toBe("gen1");
      });

      it("rm2k3 은 normalizeSystemRecords 후 생략된다", () => {
        const base = createBlankProject();
        const out = normalizeSystemRecords({ ...base.system, battleModel: "rm2k3" });
        expect(out.battleModel).toBeUndefined();
      });

      it("무효값은 역직렬화 경로에서 rm2k3 로 정규화된다", () => {
        const project = createBlankProject();
        const obj = JSON.parse(serialize(project));
        obj.system.battleModel = "gen5"; // 무효값
        const restored = deserialize(JSON.stringify(obj));
        expect(restored.system.battleModel).toBeUndefined();
        expect(restored.system.battleModel ?? "rm2k3").toBe("rm2k3");
      });
    });
    describe("data-battle-model DOM 속성", () => {
      let restoreDom: () => void;

      beforeEach(() => {
        restoreDom = installFakeDom();
      });
      afterEach(() => {
        restoreDom();
      });

      it("기본 프로젝트는 data-battle-model=rm2k3", () => {
        syncBattleModelAttribute(createBlankProject());
        expect(document.body.getAttribute("data-battle-model")).toBe("rm2k3");
      });

      it("gen1 프로젝트는 data-battle-model=gen1", () => {
        const project = createBlankProject();
        project.system.battleModel = "gen1";
        syncBattleModelAttribute(project);
        expect(document.body.getAttribute("data-battle-model")).toBe("gen1");
      });

      it("전환 시 속성 값이 최신값으로 갱신된다", () => {
        const project = createBlankProject();
        syncBattleModelAttribute(project);
        expect(document.body.getAttribute("data-battle-model")).toBe("rm2k3");
        project.system.battleModel = "gen1";
        syncBattleModelAttribute(project);
        expect(document.body.getAttribute("data-battle-model")).toBe("gen1");
        project.system.battleModel = undefined;
        syncBattleModelAttribute(project);
        expect(document.body.getAttribute("data-battle-model")).toBe("rm2k3");
      });
    });
  });
  // poke-depth PR5: 날씨. 작성만 했고 실행하지 않았다(워크트리 규칙).
  describe("battleWeather", () => {
    isolateTimers();
    describe("normalizeSkillWeather", () => {
      it("drops unknown kinds and non-objects", () => {
        expect(normalizeSkillWeather(undefined)).toBeUndefined();
        expect(normalizeSkillWeather("rain")).toBeUndefined();
        expect(normalizeSkillWeather({ kind: "fog" })).toBeUndefined();
      });
      it("clamps turns to 3..8 and omits the default 5", () => {
        expect(normalizeSkillWeather({ kind: "rain" })).toEqual({ kind: "rain" });
        expect(normalizeSkillWeather({ kind: "rain", turns: 5 })).toEqual({ kind: "rain" });
        expect(normalizeSkillWeather({ kind: "hail", turns: 1 })).toEqual({ kind: "hail", turns: 3 });
        expect(normalizeSkillWeather({ kind: "sun", turns: 99 })).toEqual({ kind: "sun", turns: 8 });
      });
      it("is omitted from skill records that do not set it (unchanged bytes)", () => {
        expect("weather" in normalizeSkillRecord({ id: "s", name: "s" })).toBe(false);
        expect(normalizeSkillRecord({ id: "s", name: "s", weather: { kind: "sandstorm", turns: 3 } }).weather).toEqual({ kind: "sandstorm", turns: 3 });
      });
    });
    describe("weather effects", () => {
      it("sun and rain swap fire and water", () => {
        expect(weatherDamagePercent("sun", "fire")).toBe(150);
        expect(weatherDamagePercent("sun", "water")).toBe(50);
        expect(weatherDamagePercent("rain", "water")).toBe(150);
        expect(weatherDamagePercent("rain", "fire")).toBe(50);
        expect(weatherDamagePercent("rain", "grass")).toBe(100);
        expect(weatherDamagePercent("sandstorm", "fire")).toBe(100);
        expect(weatherDamagePercent(undefined, "fire")).toBe(100);
        expect(weatherDamagePercent("sun", undefined)).toBe(100);
      });
      it("sandstorm and hail deal 1/16 (min 1) except to immune types", () => {
        expect(weatherResidualDamage("sandstorm", 160, ["normal"])).toBe(10);
        expect(weatherResidualDamage("sandstorm", 5, ["normal"])).toBe(1);
        expect(weatherResidualDamage("sandstorm", 160, ["rock", "water"])).toBe(0);
        expect(weatherResidualDamage("sandstorm", 160, ["ground"])).toBe(0);
        expect(weatherResidualDamage("hail", 160, ["ice"])).toBe(0);
        expect(weatherResidualDamage("hail", 160, ["rock"])).toBe(10);
        expect(weatherResidualDamage("rain", 160, ["normal"])).toBe(0);
        expect(weatherResidualDamage(undefined, 160, ["normal"])).toBe(0);
      });
      it("uses the right josa in the residual line", () => {
        expect(weatherResidualLine("sandstorm", "파이린")).toBe("파이린은 모래바람에 휩싸였다!");
        expect(weatherResidualLine("hail", "피오르")).toBe("피오르는 싸라기눈에 맞았다!");
      });
    });
  });
  // poke-depth PR6: 조건부 볼. 작성만 했고 실행하지 않았다(워크트리 규칙).
  describe("captureBalls", () => {
    isolateTimers();
    const ctx = (over: Partial<{ turn: number; targetTypes: string[]; speciesCaught: boolean }> = {}) => ({ turn: 0, targetTypes: ["normal"], speciesCaught: false, ...over });
    describe("normalizeCaptureCondition", () => {
      it("drops unknown kinds and type conditions without types", () => {
        expect(normalizeCaptureCondition(undefined)).toBeUndefined();
        expect(normalizeCaptureCondition({ kind: "bogus", multiplier: 3 })).toBeUndefined();
        expect(normalizeCaptureCondition({ kind: "type", multiplier: 3 })).toBeUndefined();
        expect(normalizeCaptureCondition({ kind: "type", types: [], multiplier: 3 })).toBeUndefined();
      });
      it("clamps multipliers to 1.1..8 and fills per-kind defaults", () => {
        expect(normalizeCaptureCondition({ kind: "firstTurn" })).toEqual({ kind: "firstTurn", multiplier: 5 });
        expect(normalizeCaptureCondition({ kind: "repeat", multiplier: 99 })).toEqual({ kind: "repeat", multiplier: 8 });
        expect(normalizeCaptureCondition({ kind: "repeat", multiplier: 0.2 })).toEqual({ kind: "repeat", multiplier: 1.1 });
        expect(normalizeCaptureCondition({ kind: "type", types: ["water", "water", "bug"] })).toEqual({ kind: "type", types: ["water", "bug"], multiplier: 3.5 });
        expect(normalizeCaptureCondition({ kind: "turns", step: 99 })).toEqual({ kind: "turns", multiplier: 4, step: 2 });
      });
      it("is omitted from capture profiles that do not set it (unchanged bytes)", () => {
        expect("condition" in (normalizeItemRecord({ id: "b", name: "b", captureProfile: { multiplier: 1, ballClass: "poke" } }).captureProfile ?? {})).toBe(false);
        expect(normalizeItemRecord({ id: "b", name: "b", captureProfile: { multiplier: 1, condition: { kind: "firstTurn", multiplier: 5 } } }).captureProfile?.condition).toEqual({ kind: "firstTurn", multiplier: 5 });
      });
    });
    describe("captureConditionMultiplier", () => {
      it("type matches any listed type", () => {
        const net = normalizeCaptureCondition({ kind: "type", types: ["water", "bug"], multiplier: 3.5 });
        expect(captureConditionMultiplier(net, ctx({ targetTypes: ["normal", "bug"] }))).toBe(3.5);
        expect(captureConditionMultiplier(net, ctx({ targetTypes: ["fire"] }))).toBe(1);
      });
      it("firstTurn applies only before any round has finished", () => {
        const quick = normalizeCaptureCondition({ kind: "firstTurn", multiplier: 5 });
        expect(captureConditionMultiplier(quick, ctx({ turn: 0 }))).toBe(5);
        expect(captureConditionMultiplier(quick, ctx({ turn: 1 }))).toBe(1);
      });
      it("turns grows by step per round and caps at the multiplier", () => {
        const timer = normalizeCaptureCondition({ kind: "turns", multiplier: 4, step: 0.5 });
        expect(captureConditionMultiplier(timer, ctx({ turn: 0 }))).toBe(1);
        expect(captureConditionMultiplier(timer, ctx({ turn: 2 }))).toBe(2);
        expect(captureConditionMultiplier(timer, ctx({ turn: 50 }))).toBe(4);
      });
      it("repeat needs the species in the dex; no condition means 1", () => {
        const repeat = normalizeCaptureCondition({ kind: "repeat", multiplier: 3.5 });
        expect(captureConditionMultiplier(repeat, ctx({ speciesCaught: true }))).toBe(3.5);
        expect(captureConditionMultiplier(repeat, ctx({ speciesCaught: false }))).toBe(1);
        expect(captureConditionMultiplier(undefined, ctx())).toBe(1);
      });
    });
    describe("captureCondition text", () => {
      it("labels each kind and uses the right josa", () => {
        expect(captureConditionLabel({ kind: "firstTurn", multiplier: 5 })).toBe("첫 차례 ×5");
        expect(captureConditionLabel({ kind: "type", types: ["water", "bug"], multiplier: 3.5 }, (id) => ({ water: "물", bug: "벌레" } as Record<string, string>)[id] ?? id)).toBe("물·벌레 타입 ×3.5");
        expect(captureConditionLine({ kind: "firstTurn", multiplier: 5 }, "신속 구슬")).toBe("신속 구슬이 첫 차례라서 힘을 발휘한다!");
        expect(captureConditionLine({ kind: "repeat", multiplier: 3.5 }, "재회 볼")).toBe("재회 볼이 낯익은 종에게 잘 듣는 것 같다!");
      });
    });
  });
  describe("characterProfiles", () => {
    isolateTimers();
    describe("character profile helpers", () => {
      it("event giftPrefs/responses fully override profile defaults", () => {
        const project = profileProject();
        const event: GameEvent = {
          id: "ev_farmer",
          x: 1,
          y: 1,
          trigger: { kind: "action" },
          commands: [],
          characterId: "char_farmer",
          giftPrefs: { loved: ["item_event_loved"] },
          giftResponses: { loved: "이벤트 응답" },
        };

        expect(resolveGiftPrefs(project, event)).toEqual({ loved: ["item_event_loved"] });
        expect(resolveGiftResponses(project, event)).toEqual({ loved: "이벤트 응답" });
        expect(getCharacterProfile(project, "char_farmer")?.giftPrefs).toEqual({ loved: ["item_strawberry"] });
      });

      it("falls back to profile giftPrefs/responses when event fields are absent", () => {
        const project = profileProject();
        const event: GameEvent = {
          id: "ev_farmer",
          x: 1,
          y: 1,
          trigger: { kind: "action" },
          commands: [],
          characterId: "char_farmer",
        };

        expect(resolveGiftPrefs(project, event)).toEqual({ loved: ["item_strawberry"] });
        expect(resolveGiftResponses(project, event)).toEqual({ loved: "프로필 고마워!" });
        expect(isGiftableEvent(project, event)).toBe(true);
      });

      it("uses profile birthday when event has no socialCalendar", () => {
        const project = profileProject();
        const event: GameEvent = {
          id: "ev_farmer",
          x: 1,
          y: 1,
          trigger: { kind: "action" },
          commands: [],
          characterId: "char_farmer",
          giftPrefs: { loved: ["item_strawberry"] },
        };

        expect(resolveBirthday(project, event)).toEqual({ season: "summer", day: 14 });

        const session = startSession(project);
        session.gameTime = { minute: 0, hour: 9, day: 14, season: "summer", year: 1 };
        expect(giveGiftToNpc(project, session, event, "item_strawberry")).toMatchObject({
          ok: true,
          rank: "loved",
          delta: 160,
          friendship: 160,
        });
      });

      it("event socialCalendar.birthday overrides profile birthday", () => {
        const project = profileProject();
        const event: GameEvent = {
          id: "ev_farmer",
          x: 1,
          y: 1,
          trigger: { kind: "action" },
          commands: [],
          characterId: "char_farmer",
          giftPrefs: { loved: ["item_strawberry"] },
          socialCalendar: { birthday: { season: "winter", day: 3 } },
        };

        expect(resolveBirthday(project, event)).toEqual({ season: "winter", day: 3 });

        const profileDay = startSession(project);
        profileDay.gameTime = { minute: 0, hour: 9, day: 14, season: "summer", year: 1 };
        expect(giveGiftToNpc(project, profileDay, event, "item_strawberry")).toMatchObject({
          ok: true,
          delta: 80,
        });

        const eventDay = startSession(project);
        eventDay.gameTime = { minute: 0, hour: 9, day: 3, season: "winter", year: 1 };
        expect(giveGiftToNpc(project, eventDay, event, "item_strawberry")).toMatchObject({
          ok: true,
          delta: 160,
        });
      });

      it("load/save serializes project.characters", () => {
        const project = profileProject();
        const restored = deserialize(serialize(project));
        expect(restored.characters).toEqual(project.characters);
        expect(restored.characters?.char_farmer?.displayName).toBe("농부 민수");
        expect(restored.characters?.char_farmer?.birthday).toEqual({ season: "summer", day: 14 });
      });
    });
    function profileProject(): Project {
      const project = createBlankProject();
      project.system.giftSystem = true;
      project.system.timeSystem = { enabled: true, dayStartHour: 6 };
      project.database.items.push(
        normalizeItemRecord({ id: "item_strawberry", name: "딸기", scope: "none", price: 10 }),
        normalizeItemRecord({ id: "item_event_loved", name: "이벤트 선물", scope: "none", price: 10 })
      );
      project.session.inventory = {
        ...project.session.inventory,
        item_strawberry: 2,
        item_event_loved: 1,
      };
      project.characters = {
        char_farmer: {
          displayName: "농부 민수",
          birthday: { season: "summer", day: 14 },
          giftPrefs: { loved: ["item_strawberry"] },
          giftResponses: { loved: "프로필 고마워!" },
        },
      };
      return project;
    }
  });
});

describe("endingWarningsPriority", () => {
  isolateTimers();
  const ending = (id: string, priority: number): EndingDef => ({ id, name: id, conditions: [], priority } as EndingDef);
  describe("collectEndingWarnings — priority 는 조건으로 고르는 호출에서만 의미가 있다", () => {
    const endings = [ending("a", 10), ending("b", 5), ending("c", 5)];

    it("기본값은 예전처럼 같은 조건 집합의 priority 경고를 낸다", () => {
      const warnings = collectEndingWarnings(endings);
      expect(warnings.some((w) => w.includes("엔딩 도달 불능: b"))).toBe(true);
    });

    it("이름으로만 부르는 프로젝트(priorityMatters:false)에서는 소음 경고를 내지 않는다", () => {
      expect(collectEndingWarnings(endings, { priorityMatters: false })).toEqual([]);
    });

    it("priorityMatters:false 라도 불가능한 조건 충돌은 계속 알린다", () => {
      const impossible = { id: "x", name: "x", priority: 1, conditions: [
        { kind: "switch", switchId: "s", value: true }, { kind: "switch", switchId: "s", value: false },
      ] } as EndingDef;
      expect(collectEndingWarnings([impossible], { priorityMatters: false }).join("\n")).toContain("ON/OFF");
    });
  });
});

describe("eventDraftVaultPersistDebounce", () => {
  isolateTimers();
  const DRAFT: GameEvent = {
    id: "draft-event",
    x: 1,
    y: 1,
    trigger: { kind: "action" },
    commands: [],
    pages: [],
    draft: { kind: "new" },
  };
  function countingLocalStorage(): { writes: () => string[]; storage: Record<string, unknown> } {
    const writes: string[] = [];
    const values = new Map<string, string>();
    return {
      writes: () => [...writes],
      storage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => {
          writes.push(key);
          values.set(key, value);
        },
        removeItem: (key: string) => void values.delete(key),
      },
    };
  }
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  const PAST_VAULT_DEBOUNCE_MS = 420;
  describe("event draft vault persist debounce", () => {
    let counting: ReturnType<typeof countingLocalStorage>;

    beforeEach(() => {
      _resetEventDraftVaultForTest();
      counting = countingLocalStorage();
      vi.stubGlobal("localStorage", counting.storage);
    });

    afterEach(() => {
      _resetEventDraftVaultForTest();
      vi.unstubAllGlobals();
    });

    it("an explicit persist cancels the debounce it supersedes, so no duplicate write lands", async () => {
      const key = eventDraftVaultStorageKey();
      rememberEventDraftVaultEntry("map_blank_start", DRAFT);

      persistEventDraftVaultNow();
      expect(counting.writes().filter((entry) => entry === key)).toHaveLength(1);

      await wait(PAST_VAULT_DEBOUNCE_MS);

      expect(counting.writes().filter((entry) => entry === key)).toHaveLength(1);
    });

    it("a later remember still schedules its own persist after an explicit one", async () => {
      const key = eventDraftVaultStorageKey();
      persistEventDraftVaultNow();
      rememberEventDraftVaultEntry("map_blank_start", DRAFT);

      await wait(PAST_VAULT_DEBOUNCE_MS);

      expect(counting.writes().filter((entry) => entry === key).length).toBeGreaterThanOrEqual(1);
    });

    it("public copies cannot change a cached save and deletion/restore invalidate it", () => {
      const key = eventDraftVaultStorageKey();
      rememberEventDraftVaultEntry("map_blank_start", DRAFT);
      persistEventDraftVaultNow();
      const saved = listEventDraftVaultEntries();
      saved[0]!.event.x = 42;
      persistEventDraftVaultNow();
      const read = () => JSON.parse((counting.storage.getItem as (key: string) => string)(key));
      expect(read().entries[0].event.x).toBe(1);
      forgetEventDraftVaultEntry("map_blank_start", DRAFT.id);
      persistEventDraftVaultNow();
      expect((counting.storage.getItem as (key: string) => string | null)(key)).toBeNull();
      restoreEventDraftVaultEntries(saved);
      saved[0]!.event.x = 99;
      persistEventDraftVaultNow();
      expect(read().entries[0].event.x).toBe(42);
    });
    it("reuses immutable event lists but recovers forgotten drafts and new map keys", () => {
      let reads = 0;
      const events = new Proxy([DRAFT, ...Array.from({ length: 1000 }, (_, i) => ({ ...DRAFT, id: `normal-${i}`, draft: undefined }))], {
        get(target, key, receiver) { if (/^\d+$/.test(String(key))) reads++; return Reflect.get(target, key, receiver); },
      });
      const project = { maps: { a: { events } } } as unknown as Project;
      syncEventDraftVaultFromProject(project);
      expect(reads).toBeGreaterThan(1000);
      reads = 0;
      syncEventDraftVaultFromProject(project);
      expect(reads).toBe(0);
      forgetEventDraftVaultEntry("a", DRAFT.id);
      syncEventDraftVaultFromProject(project);
      syncEventDraftVaultFromProject({ maps: { b: { events } } } as unknown as Project);
      expect(listEventDraftVaultEntries().map(e => e.mapId).sort()).toEqual(["a", "b"]);
      expect(reads).toBe(0);
    });

  });
});
