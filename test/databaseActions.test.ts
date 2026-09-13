import { beforeEach, describe, expect, it } from "vitest";
import {
  addDatabaseRecord,
  bulkRenameSwitches,
  bulkRenameVariables,
  deleteDatabaseRecord,
  duplicateDatabaseRecord,
  updateDatabaseRecord,
  type DatabaseCollection,
} from "@/editor/databaseActions";
import { getMapEditHistoryState, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { createBlankProject, DEFAULT_ANIMATION_ID, DEFAULT_ENEMY_ID, DEFAULT_ITEM_ID, DEFAULT_SKILL_ID, DEFAULT_TROOP_ID } from "@/project/defaults";
import { normalizeEnemyRecord } from "@/project/databaseRecordModel";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import invalidReferenceProject from "./fixtures/projects/invalid-db-reference-v3.json";

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
    if (!result.ok) expect(result.message).toContain("스킬을 사용 중입니다");
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
    expect(equipment?.statBonuses.defense).toBe(0);
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
