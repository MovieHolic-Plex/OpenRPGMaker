import { beforeEach, describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { charsetFamilyOf } from "@/project/charsetFamily";
import { createBlankProject as createBlankDefaultProject } from "@/project/defaults";
import { freshBlankProject as createBlankProject } from "./support/blankProject";
import { applyGenrePreset } from "@/project/genrePresets";
import { deserialize, serialize } from "@/project/io";
import { peopleChipLockAllows, peopleChipPromptNote } from "@/project/peopleChipLock";
import type { Project, Command } from "@/project/types";
import { battleCommandsForActor } from "@/battle/battleCommands";
import { createBattleRuntime } from "@/battle/runtime";
import { simulateBattle } from "@/battle/simulate";
import { normalizeClassRecord, normalizeEquipmentRecord, normalizeItemRecord, normalizeSkillRecord } from "@/project/databaseRecordModel";
import { createInterpreter } from "@/player/interpreter";
import { createSaveSnapshot, applySaveSnapshot, type SaveSnapshot } from "@/player/saveSlots";
import { applyBattleRewardsToSession } from "@/player/battleRewardsToSession";
import { canEquip } from "@/project/equipmentRules";
import { normalizeActorRecord, totalExpForLevel } from "@/project/actorModel";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { changeActorClass, effectiveActorClassId, promoteActor } from "@/project/sessionClass";
import { startSession, type PlaySession } from "@/project/session";
import { describeMapSeams, inspectWorldSeams } from "@/ai/piAgent/worldSeams";
import { startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";
import { isolateTimers } from "./mergedTeardown";

// 사람 칩 계열(2026-10-29) — 첫 사람 칩이 계열을 정한다. 2026-11-16(오너 「에셋을 자유롭게」): 저절로 정해진 계열은 벽이 아니라 기본값이다 —
// 검색어·기본 주민은 그 계열에서 나오고, 조수가 다른 계열 칩을 이름으로 고르면 그대로 쓰고 알린다. 사용자가 직접 고른 계열만 거부한다.
// 이 파일은 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(CI 가 돌린다). 같은 시나리오를 runTool 로 돌린 헤드리스 확인은 작성 세션에서 했다.
describe("peopleChipLock", () => {
  isolateTimers();
  beforeEach(() => resetMapEditHistory());
  const ctxOf = (project: Project, assistantRun = true): ToolContext => ({ project, currentMapId: project.startMapId, assistantRun });
  const npc = (ctx: ToolContext, x: number, name: string, graphic?: Record<string, unknown>) =>
    runTool(ctx, "place_npc", { mapId: ctx.project.startMapId, x, y: 3, name, ...(graphic ? { graphic } : {}), pages: [{ lines: ["안녕"] }] }, { dryRun: false });
  const REFMAP = { textureKey: "oprn-charset-refmap-doll1", characterIndex: 0 };
  const RTP = { textureKey: "easyrpg-charset-people1", characterIndex: 2 };
  describe("사람 칩 계열 잠금", () => {
    it("첫 사람 칩이 기본 계열을 정하고, 다른 계열 사람 칩을 이름으로 고르면 그대로 쓰고 알린다", () => {
      const ctx = ctxOf(createBlankProject());
      expect(npc(ctx, 3, "여관 주인", REFMAP).ok).toBe(true);
      expect(ctx.project.system.peopleChipLock).toEqual({ family: "refmap-doll", by: "auto" });
      const other = npc(ctx, 5, "상인", RTP);
      expect(other.ok).toBe(true);
      expect(JSON.stringify(other)).toContain("Kept as chosen");
      expect(ctx.project.maps[ctx.project.startMapId]!.events.map((event) => event.name)).toContain("상인");
      // 기본 계열은 바뀌지 않는다.
      expect(ctx.project.system.peopleChipLock).toEqual({ family: "refmap-doll", by: "auto" });
    });

    it("사용자가 직접 고른 계열은 다른 계열 사람 칩을 거부한다", () => {
      const project = createBlankProject();
      project.system.peopleChipLock = { family: "refmap-doll", by: "user" };
      const ctx = ctxOf(project);
      const rejected = npc(ctx, 5, "상인", RTP);
      expect(rejected.ok).toBe(false);
      expect(rejected.summary).toContain("사람 칩 잠금");
      expect(ctx.project.maps[ctx.project.startMapId]!.events.map((event) => event.name)).not.toContain("상인");
    });

    it("잠근 뒤 검색어·기본 주민도 잠금 계열 사람 칩으로 골라진다", () => {
      const ctx = ctxOf(createBlankProject());
      npc(ctx, 3, "여관 주인", REFMAP);
      expect(npc(ctx, 5, "늙은 상인", { query: "old merchant" }).ok).toBe(true);
      expect(npc(ctx, 7, "마을 사람").ok).toBe(true);
      for (const event of ctx.project.maps[ctx.project.startMapId]!.events) {
        const id = (event.pages[0]!.graphic as { sprite?: { id?: string } }).sprite?.id ?? "";
        expect(charsetFamilyOf(ctx.project, id)).toBe("refmap-doll");
      }
    });

    it("주인공 걷기 칩은 사용자가 고른 계열이면 그 계열만, 저절로 정해진 계열이면 이름으로 고른 것을 받는다", () => {
      const project = createBlankProject();
      project.system.peopleChipLock = { family: "refmap-doll", by: "user" };
      const locked = ctxOf(project);
      expect(runTool(locked, "upsert_actor", { actor: { id: "actor_hero", characterResourceId: "oprn-charset-heroes1", characterIndex: 0 } }, { dryRun: false }).ok).toBe(false);
      expect(runTool(locked, "upsert_actor", { actor: { id: "actor_hero", characterResourceId: "oprn-charset-refmap-doll5", characterIndex: 1 } }, { dryRun: false }).ok).toBe(true);
      const ctx = ctxOf(createBlankProject());
      npc(ctx, 3, "여관 주인", REFMAP);
      expect(runTool(ctx, "upsert_actor", { actor: { id: "actor_hero", characterResourceId: "oprn-charset-heroes1", characterIndex: 0 } }, { dryRun: false }).ok).toBe(true);
    });

    it("몬스터·동물 칩은 잠그지 않는다", () => {
      const ctx = ctxOf(createBlankProject());
      npc(ctx, 3, "여관 주인", REFMAP);
      expect(npc(ctx, 5, "슬라임", { query: "슬라임" }).ok).toBe(true);
      expect(peopleChipLockAllows(ctx.project, "easyrpg-charset-monster1")).toBe(true);
      expect(peopleChipLockAllows(ctx.project, "easyrpg-charset-people1")).toBe(false);
    });

    it("손 편집은 막지 않고 잠금도 걸지 않는다", () => {
      const ctx = ctxOf(createBlankProject(), false);
      expect(npc(ctx, 3, "여관 주인", REFMAP).ok).toBe(true);
      expect(ctx.project.system.peopleChipLock).toBeUndefined();
    });

    it("장르 잠금이 캐릭터 칩을 맡으면 쉰다", () => {
      const project = createBlankProject();
      applyGenrePreset(project, "monster-collect");
      expect(peopleChipPromptNote(project)).toBeNull();
      expect(peopleChipLockAllows(project, "easyrpg-charset-people1")).toBe(true);
    });

    it("저장·재로드에 남고 프롬프트에 기본 계열이 실린다", () => {
      const ctx = ctxOf(createBlankProject());
      npc(ctx, 3, "여관 주인", REFMAP);
      const again = deserialize(serialize(ctx.project));
      expect(again.system.peopleChipLock).toEqual({ family: "refmap-doll", by: "auto" });
      expect(buildSystemPrompt(again)).toContain("[사람 칩 기본 계열 — REFMAP 변형 인물 칩]");
      expect(buildSystemPrompt(createBlankProject())).toContain("처음 새로 놓는 사람 칩");
    });
  });
});

describe("phase8aGrowthRuntime", () => {
  isolateTimers();
  const HERO_ID = "actor_hero";
  /** #3234: 보상은 누적 경험치를 현재 레벨의 바닥으로 올린 뒤 더한다 — 그 바닥. */
  function heroExpFloor(project: Project, level: number): number {
    return totalExpForLevel(normalizeActorRecord(project.database.actors.find((actor) => actor.id === HERO_ID)!).expCurve, level);
  }
  const GUARDIAN_ID = "actor_guardian";
  const APPRENTICE_CLASS_ID = "class_apprentice_warrior";
  const WARRIOR_CLASS_ID = "class_warrior_phase8";
  const BADGE_ID = "item_warrior_badge";
  const DOUBLE_SWORD_ID = "equip_double_attack_sword";
  const FIRE_GUARD_ID = "equip_fire_guard";
  const STATE_GUARD_ID = "equip_state_guard";
  function flatCurve(value: number): number[] {
    return Array.from({ length: 99 }, () => value);
  }
  function curves(values: { maxHp: number; maxMp: number; attack: number; defense: number; mind: number; agility: number }) {
    return {
      maxHp: flatCurve(values.maxHp),
      maxMp: flatCurve(values.maxMp),
      attack: flatCurve(values.attack),
      defense: flatCurve(values.defense),
      mind: flatCurve(values.mind),
      agility: flatCurve(values.agility),
    };
  }
  function phase8aProject(): Project {
    const project = createBlankProject();
    project.session.partyActorIds = [HERO_ID];
    project.system.startActorIds = [HERO_ID];
    project.switches.push({ id: "sw_promotion", name: "승급 허가" });
    project.variables.push({ id: "var_reputation", name: "명성" });
    project.database.elements = [
      { id: "fire", name: "화염", kind: "magical", rateLabels: ["A", "B", "C", "D", "E"], damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 } },
    ];
    project.database.items.push(normalizeItemRecord({ id: BADGE_ID, name: "전사 증표", description: "승급 시험 통과 증표" }));
    project.database.skills.push(
      normalizeSkillRecord({ id: "skill_keep", name: "기존기", power: 1 }),
      normalizeSkillRecord({ id: "skill_warrior_slash", name: "전사 베기", power: 20 }),
      normalizeSkillRecord({
        id: "skill_fire_enemy",
        name: "화염탄",
        power: 80,
        mpCost: { flat: 0, percentMax: 0 },
        successRate: 100,
        hitRate: 100,
        variance: 0,
        elementId: "fire",
        effect: { kind: "damage", statistic: "attack", affects: "hp" },
      }),
      normalizeSkillRecord({
        id: "skill_sleep_enemy",
        name: "수면침",
        power: 20,
        mpCost: { flat: 0, percentMax: 0 },
        successRate: 100,
        hitRate: 100,
        variance: 0,
        stateEffects: [{ stateId: "state_poison", chance: 100, operation: "add" }],
        effect: { kind: "damage", statistic: "attack", affects: "hp" },
      })
    );
    const hero = project.database.actors.find((actor) => actor.id === HERO_ID);
    if (!hero) throw new Error("missing hero");
    hero.classId = APPRENTICE_CLASS_ID;
    hero.initialLevel = 5;
    hero.learnedSkills = [{ level: 1, skillId: "skill_keep" }];
    hero.elementRates = { ...hero.elementRates, fire: "C" };
    hero.parameterCurves = curves({ maxHp: 100, maxMp: 40, attack: 40, defense: 10, mind: 10, agility: 20 });
    project.database.classes.push(
      normalizeClassRecord({
        id: APPRENTICE_CLASS_ID,
        name: "견습전사",
        learnedSkills: [{ level: 1, skillId: "skill_keep" }],
        battleCommands: [{ id: "cmd_attack", name: "공격", kind: "attack" }],
        equipmentPermissions: { actorIds: [], classIds: [], equipmentIds: [] },
        parameterCurves: curves({ maxHp: 100, maxMp: 40, attack: 40, defense: 10, mind: 10, agility: 20 }),
        promotions: [{ toClassId: WARRIOR_CLASS_ID, requires: { level: 5, itemId: BADGE_ID } }],
      }),
      normalizeClassRecord({
        id: WARRIOR_CLASS_ID,
        name: "전사",
        learnedSkills: [{ level: 5, skillId: "skill_warrior_slash" }],
        battleCommands: [
          { id: "cmd_attack", name: "공격", kind: "attack" },
          { id: "cmd_skill", name: "전법", kind: "skill" },
          { id: "cmd_defend", name: "방어", kind: "defend" },
        ],
        equipmentPermissions: { actorIds: [], classIds: [], equipmentIds: [DOUBLE_SWORD_ID] },
        parameterCurves: curves({ maxHp: 60, maxMp: 10, attack: 55, defense: 20, mind: 8, agility: 18 }),
      })
    );
    project.database.equipment.push(
      normalizeEquipmentRecord({
        id: DOUBLE_SWORD_ID,
        name: "더블어택 검",
        slot: "weapon",
        description: "두 번 베는 승급 보상 검",
        statBonuses: { attack: 0, defense: 0, mind: 0, agility: 0 },
        equippableClassIds: [WARRIOR_CLASS_ID],
        effectFlags: {
          preemptive: false,
          doubleAttack: true,
          attackAll: false,
          ignoreDodge: false,
          preventCriticalHits: false,
          increasePhysicalDodge: false,
          halfMpCost: false,
          negateTerrainDamage: false,
          fixedEquipment: false,
        },
      }),
      normalizeEquipmentRecord({
        id: FIRE_GUARD_ID,
        name: "화염 방패",
        slot: "shield",
        statBonuses: { attack: 0, defense: 0, mind: 0, agility: 0 },
        equippableActorIds: [HERO_ID],
        elementalDefenseIds: ["fire"],
      }),
      normalizeEquipmentRecord({
        id: STATE_GUARD_ID,
        name: "수면 방울",
        slot: "accessory",
        statBonuses: { attack: 0, defense: 0, mind: 0, agility: 0 },
        equippableActorIds: [HERO_ID],
        stateDefenseIds: ["state_poison"],
        stateResistanceChance: 100,
      })
    );
    const enemy = project.database.enemies.find((record) => record.id === "enemy_slime");
    if (!enemy) throw new Error("missing slime");
    enemy.level = 1;
    enemy.stats = { maxHp: 999, maxMp: 999, attack: 60, defense: 1, mind: 20, agility: 10 };
    enemy.rewards = { exp: 100, gold: 0, dropItemId: undefined, dropRatePercent: 0 };
    return project;
  }
  function startPhase8aSession(project: Project): PlaySession {
    const session = startSession(project);
    session.actorLevels[HERO_ID] = 5;
    session.actorSkillIds[HERO_ID] = ["skill_keep"];
    session.actorVitals[HERO_ID] = { hp: 90, mp: 30, maxHp: 100, maxMp: 40 };
    return session;
  }
  function setEnemyAction(project: Project, skillId: string): void {
    const enemy = project.database.enemies.find((record) => record.id === "enemy_slime");
    if (!enemy) throw new Error("missing slime");
    enemy.skillIds = [skillId];
    enemy.actions = [{
      skillId,
      priority: 100,
      condition: { kind: "always" },
      switchOnAfterAction: { enabled: false },
      switchOffAfterAction: { enabled: false },
    }];
  }
  function strictDamageToHero(project: Project, equipment: Record<string, { weapon?: string; shield?: string; accessory?: string }>): number {
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      battleFlow: "strict",
      canEscape: false,
      canLose: true,
      party: { partyActorIds: [HERO_ID], levels: { [HERO_ID]: 5 }, experience: {}, equipment },
      rng: () => 0,
    });
    const before = runtime.snapshot().actors[0]?.hp ?? 0;
    runtime.performActorCommand({ kind: "defend" });
    return before - (runtime.snapshot().actors[0]?.hp ?? 0);
  }
  function strictAttackDamage(project: Project, weaponId: string | undefined): number {
    const runtime = createBattleRuntime({
      project,
      troopId: "troop_slime",
      battleFlow: "strict",
      canEscape: false,
      canLose: true,
      party: {
        partyActorIds: [HERO_ID],
        levels: { [HERO_ID]: 5 },
        experience: {},
        equipment: { [HERO_ID]: weaponId ? { weapon: weaponId } : {} },
      },
      rng: () => 0,
    });
    const before = runtime.snapshot().enemies[0]?.hp ?? 0;
    runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    return before - (runtime.snapshot().enemies[0]?.hp ?? 0);
  }
  describe("Phase 8a 런타임 직업 변경", () => {
    it("Change Actor Class가 classOverrides와 스탯/스킬/장비/커맨드 기준을 바꾼다", () => {
      const project = phase8aProject();
      const session = startPhase8aSession(project);
      const actor = project.database.actors.find((record) => record.id === HERO_ID)!;
      const sword = project.database.equipment.find((record) => record.id === DOUBLE_SWORD_ID)!;

      expect(canEquip(project, actor, sword)).toBe(false);
      const result = changeActorClass(session, project, HERO_ID, WARRIOR_CLASS_ID);

      expect(result.ok).toBe(true);
      expect(session.actorLevels[HERO_ID]).toBe(5);
      expect(session.classOverrides[HERO_ID]).toBe(WARRIOR_CLASS_ID);
      expect(session.actorVitals[HERO_ID]).toEqual({ hp: 60, mp: 10, maxHp: 60, maxMp: 10 });
      expect(session.actorSkillIds[HERO_ID]).toEqual(expect.arrayContaining(["skill_keep", "skill_warrior_slash"]));
      expect(canEquip(project, actor, sword, effectiveActorClassId(project, session, HERO_ID))).toBe(true);
      expect(battleCommandsForActor(project, HERO_ID, { classId: effectiveActorClassId(project, session, HERO_ID) }).map((command) => command.name))
        .toEqual(["공격", "전법", "방어"]);

      const status = createStatusMenuDetail({ project, session, selectedCommand: "status", slots: [], waitModeEnabled: false });
      expect(status.entries[0]?.value).toBe("전사 L5");
      session.inventory[DOUBLE_SWORD_ID] = 1;
      const equipment = createStatusMenuDetail({
        project,
        session,
        selectedCommand: "equipment",
        equipmentActorId: HERO_ID,
        equipmentSlotId: "weapon",
        slots: [],
        waitModeEnabled: false,
      });
      const entry = equipment.entries.find((item) => item.testId === `status-menu-equipment-item-${DOUBLE_SWORD_ID}`);
      expect(entry?.description).toContain("더블어택");
    });

    it("m2 Change Actor Class도 PlaySession override를 저장한다", () => {
      const project = phase8aProject();
      const session = startPhase8aSession(project);
      const command: Command = { kind: "m2Command", commandId: "m2-091-change-actor-class", fields: { target: HERO_ID, value: WARRIOR_CLASS_ID } };

      createInterpreter([command], session, project).start();

      expect(session.classOverrides[HERO_ID]).toBe(WARRIOR_CLASS_ID);
      expect(session.actorSkillIds[HERO_ID]).toContain("skill_warrior_slash");
    });

    it("세이브/로드 왕복은 override를 보존하고 구 세이브 누락은 빈 override로 로드한다", () => {
      const project = phase8aProject();
      const session = startPhase8aSession(project);
      changeActorClass(session, project, HERO_ID, WARRIOR_CLASS_ID);

      const snapshot = createSaveSnapshot(project, session);
      expect(applySaveSnapshot(project, snapshot).classOverrides[HERO_ID]).toBe(WARRIOR_CLASS_ID);

      const legacy = structuredClone(snapshot) as SaveSnapshot;
      delete (legacy.session as { classOverrides?: Record<string, string> }).classOverrides;
      expect(applySaveSnapshot(project, legacy).classOverrides).toEqual({});
    });
  });
  describe("Phase 8a 승급 트리", () => {
    it("승급 조건 4종과 자동 첫 후보 선택, 아이템 소모를 처리한다", () => {
      const project = phase8aProject();
      const source = project.database.classes.find((record) => record.id === APPRENTICE_CLASS_ID)!;
      for (const id of ["class_level", "class_switch", "class_item", "class_variable"]) {
        project.database.classes.push(normalizeClassRecord({ id, name: id, parameterCurves: curves({ maxHp: 70, maxMp: 10, attack: 30, defense: 10, mind: 10, agility: 10 }) }));
      }
      source.promotions = [
        { toClassId: "class_level", requires: { level: 5 } },
        { toClassId: "class_switch", requires: { switchId: "sw_promotion" } },
        { toClassId: "class_item", requires: { itemId: BADGE_ID } },
        { toClassId: "class_variable", requires: { variableId: "var_reputation", atLeast: 7 } },
      ];

      const lowLevel = startPhase8aSession(project);
      lowLevel.actorLevels[HERO_ID] = 4;
      expect(promoteActor(lowLevel, project, HERO_ID, "class_level").ok).toBe(false);

      const auto = startPhase8aSession(project);
      auto.inventory[BADGE_ID] = 1;
      expect(promoteActor(auto, project, HERO_ID).ok).toBe(true);
      expect(auto.classOverrides[HERO_ID]).toBe("class_level");

      const switchSession = startPhase8aSession(project);
      expect(promoteActor(switchSession, project, HERO_ID, "class_switch").ok).toBe(false);
      switchSession.switches.sw_promotion = true;
      expect(promoteActor(switchSession, project, HERO_ID, "class_switch").ok).toBe(true);

      const itemSession = startPhase8aSession(project);
      expect(promoteActor(itemSession, project, HERO_ID, "class_item").ok).toBe(false);
      itemSession.inventory[BADGE_ID] = 1;
      expect(promoteActor(itemSession, project, HERO_ID, "class_item").ok).toBe(true);
      expect(itemSession.inventory[BADGE_ID] ?? 0).toBe(0);

      const variableSession = startPhase8aSession(project);
      variableSession.variables.var_reputation = 6;
      expect(promoteActor(variableSession, project, HERO_ID, "class_variable").ok).toBe(false);
      variableSession.variables.var_reputation = 7;
      expect(promoteActor(variableSession, project, HERO_ID, "class_variable").ok).toBe(true);
    });

    it("승급 아이템의 마지막 충전된 복사본을 소모하면 커서를 지운다", () => {
      const project = phase8aProject();
      const badge = project.database.items.find((item) => item.id === BADGE_ID)!;
      badge.consumptionLimit = 3;
      const session = startPhase8aSession(project);
      session.inventory[BADGE_ID] = 1;
      session.itemUseCharges![BADGE_ID] = 2;

      expect(promoteActor(session, project, HERO_ID, WARRIOR_CLASS_ID).ok).toBe(true);
      expect(session.inventory[BADGE_ID]).toBeUndefined();
      expect(session.itemUseCharges?.[BADGE_ID]).toBeUndefined();
    });

    it("존재하지 않는 승급 대상은 아이템과 충전 커서를 변경하지 않는다", () => {
      const project = phase8aProject();
      const source = project.database.classes.find((record) => record.id === APPRENTICE_CLASS_ID)!;
      source.promotions = [{ toClassId: "class_missing", requires: { itemId: BADGE_ID } }];
      const session = startPhase8aSession(project);
      session.inventory[BADGE_ID] = 1;
      session.itemUseCharges![BADGE_ID] = 2;

      expect(promoteActor(session, project, HERO_ID, "class_missing")).toMatchObject({ ok: false, reason: "class-not-found" });
      expect(session.inventory[BADGE_ID]).toBe(1);
      expect(session.itemUseCharges?.[BADGE_ID]).toBe(2);
      expect(session.classOverrides[HERO_ID]).toBeUndefined();
    });

    it("promoteActor 커맨드는 성공/실패 분기로 진행한다", () => {
      const project = phase8aProject();
      const success = startPhase8aSession(project);
      success.inventory[BADGE_ID] = 1;
      const commands: Command[] = [{
        kind: "promoteActor",
        actorId: HERO_ID,
        toClassId: WARRIOR_CLASS_ID,
        successBranch: [{ kind: "setFlag", flag: "promotion_ok", value: true }],
        failureBranch: [{ kind: "setFlag", flag: "promotion_fail", value: true }],
      }];
      expect(createInterpreter(commands, success, project).start()).toEqual({ kind: "done" });
      expect(success.flags.promotion_ok).toBe(true);
      expect(success.flags.promotion_fail).toBeUndefined();
      expect(success.classOverrides[HERO_ID]).toBe(WARRIOR_CLASS_ID);

      const failure = startPhase8aSession(project);
      expect(createInterpreter(commands, failure, project).start()).toEqual({ kind: "done" });
      expect(failure.flags.promotion_fail).toBe(true);
      expect(failure.flags.promotion_ok).toBeUndefined();
      expect(failure.classOverrides[HERO_ID]).toBeUndefined();
    });

    it("define_promotion write tool이 ClassRecord 승급을 반영한다", () => {
      const ctx = { project: phase8aProject() };
      const result = runTool(ctx, "define_promotion", {
        classId: APPRENTICE_CLASS_ID,
        toClassId: WARRIOR_CLASS_ID,
        requires: { level: 5, itemId: BADGE_ID },
      }, { dryRun: false });

      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      expect(ctx.project.database.classes.find((record) => record.id === APPRENTICE_CLASS_ID)?.promotions).toContainEqual({
        toClassId: WARRIOR_CLASS_ID,
        requires: { level: 5, itemId: BADGE_ID, switchId: undefined, variableId: undefined, atLeast: undefined },
      });
    });
  });
  describe("Phase 8a 보상 정책", () => {
    it("기본값은 전원 EXP, participationOnly는 참전자만, levelGapPenalty는 5/10레벨 격차를 감산한다", () => {
      const project = createBlankProject();
      project.session.partyActorIds = [HERO_ID, GUARDIAN_ID];
      let session = startSession(project);
      applyBattleRewardsToSession(session, {
        result: "victory",
        rewards: { exp: 100, gold: 0, items: [], enemyLevel: 1 },
        participatingActorIds: [HERO_ID],
      }, project);
      expect(session.actorExperience[HERO_ID]).toBe(100);
      expect(session.actorExperience[GUARDIAN_ID]).toBe(100);

      project.system.rewardPolicy = { participationOnly: true };
      session = startSession(project);
      applyBattleRewardsToSession(session, {
        result: "victory",
        rewards: { exp: 100, gold: 0, items: [], enemyLevel: 1 },
        participatingActorIds: [HERO_ID],
      }, project);
      expect(session.actorExperience[HERO_ID]).toBe(100);
      expect(session.actorExperience[GUARDIAN_ID]).toBe(0);

      project.system.rewardPolicy = { participationOnly: true, levelGapPenalty: true };
      session = startSession(project);
      session.actorLevels[HERO_ID] = 6;
      applyBattleRewardsToSession(session, { result: "victory", rewards: { exp: 100, gold: 0, items: [], enemyLevel: 1 }, participatingActorIds: [HERO_ID] }, project);
      expect(session.actorExperience[HERO_ID]).toBe(heroExpFloor(project, 6) + 50);

      session = startSession(project);
      session.actorLevels[HERO_ID] = 11;
      applyBattleRewardsToSession(session, { result: "victory", rewards: { exp: 100, gold: 0, items: [], enemyLevel: 1 }, participatingActorIds: [HERO_ID] }, project);
      expect(session.actorExperience[HERO_ID]).toBe(heroExpFloor(project, 11) + 10);
    });

    it("simulate_battle 참전 기록으로 참전자만 EXP와 레벨차 페널티를 적용한다", () => {
      const project = createBlankProject();
      project.session.partyActorIds = [HERO_ID, GUARDIAN_ID];
      project.system.rewardPolicy = { participationOnly: true, levelGapPenalty: true };
      const hero = project.database.actors.find((actor) => actor.id === HERO_ID)!;
      hero.parameterCurves.attack = flatCurve(999);
      const enemy = project.database.enemies.find((record) => record.id === "enemy_slime")!;
      enemy.level = 1;
      enemy.stats = { ...enemy.stats, maxHp: 1, defense: 1 };

      const simulated = simulateBattle({
        project,
        troopId: "troop_slime",
        heroLevel: 11,
        partyActorIds: [HERO_ID, GUARDIAN_ID],
        battleFlow: "strict",
        activeSlots: 1,
        strictScript: [[{ actorId: HERO_ID, command: "attack", target: "enemy-1" }]],
        n: 1,
        seed: 8,
      });
      const session = startSession(project);
      session.actorLevels[HERO_ID] = 11;
      applyBattleRewardsToSession(session, {
        result: "victory",
        rewards: { exp: 100, gold: 0, items: [], enemyLevel: 1 },
        participatingActorIds: simulated.participatingActorIds,
      }, project);

      expect(simulated.participatingActorIds).toEqual([HERO_ID]);
      expect(session.actorExperience[HERO_ID]).toBe(heroExpFloor(project, 11) + 10);
      expect(session.actorExperience[GUARDIAN_ID]).toBe(0);
    });
  });
  describe("Phase 8a 장비 특수 효과", () => {
    it("속성 방어, 상태 방어, 더블어택을 전투에 반영하고 메뉴 상세에 표기한다", () => {
      const project = phase8aProject();
      const menuSession = startPhase8aSession(project);
      changeActorClass(menuSession, project, HERO_ID, WARRIOR_CLASS_ID);
      menuSession.inventory[DOUBLE_SWORD_ID] = 1;
      menuSession.inventory[FIRE_GUARD_ID] = 1;
      menuSession.inventory[STATE_GUARD_ID] = 1;
      const detail = createStatusMenuDetail({
        project,
        session: menuSession,
        selectedCommand: "equipment",
        equipmentActorId: HERO_ID,
        equipmentSlotId: "weapon",
        slots: [],
        waitModeEnabled: false,
      });
      expect(detail.entries.find((entry) => entry.testId === `status-menu-equipment-item-${DOUBLE_SWORD_ID}`)?.description).toContain("더블어택");

      const singleDamage = strictAttackDamage(project, undefined);
      const doubleDamage = strictAttackDamage(project, DOUBLE_SWORD_ID);
      expect(doubleDamage).toBe(singleDamage * 2);

      setEnemyAction(project, "skill_fire_enemy");
      const plainFire = strictDamageToHero(project, { [HERO_ID]: {} });
      const guardedFire = strictDamageToHero(project, { [HERO_ID]: { shield: FIRE_GUARD_ID } });
      expect(guardedFire).toBeGreaterThan(0);
      expect(guardedFire).toBeLessThan(plainFire);

      setEnemyAction(project, "skill_sleep_enemy");
      const noGuard = createBattleRuntime({
        project,
        troopId: "troop_slime",
        battleFlow: "strict",
        canEscape: false,
        canLose: true,
        party: { partyActorIds: [HERO_ID], levels: { [HERO_ID]: 5 }, experience: {}, equipment: { [HERO_ID]: {} } },
        rng: () => 0,
      });
      noGuard.performActorCommand({ kind: "defend" });
      expect(noGuard.snapshot().actors[0]?.stateIds).toContain("state_poison");

      const guarded = createBattleRuntime({
        project,
        troopId: "troop_slime",
        battleFlow: "strict",
        canEscape: false,
        canLose: true,
        party: { partyActorIds: [HERO_ID], levels: { [HERO_ID]: 5 }, experience: {}, equipment: { [HERO_ID]: { accessory: STATE_GUARD_ID } } },
        rng: () => 0,
      });
      guarded.performActorCommand({ kind: "defend" });
      expect(guarded.snapshot().actors[0]?.stateIds).not.toContain("state_poison");
    });
  });
});

// 팀 초기 생성의 맵 사이 연결 계약. 담당에게 주는 이음새 목록과 finish 전 병합본 검사.
describe("piAgentWorldSeams", () => {
  isolateTimers();
  function world(): Project {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "build_world", {
      plan: {
        nodes: [
          { mapId: "map_town", role: "town", label: "마을", width: 20, height: 16 },
          { mapId: "map_field", role: "field", label: "들판", width: 20, height: 16 },
        ],
        edges: [{ from: { mapId: "map_town", exit: { side: "east" } }, to: { mapId: "map_field", entry: { side: "west" } } }],
      },
    });
    if (!result.ok) throw new Error(result.summary);
    ctx.project.startMapId = "map_town";
    return ctx.project;
  }
  describe("월드 이음새", () => {
    // 깨질 것: 담당이 자기 맵의 출입구·도착 칸을 모르면 소품이나 벽으로 덮는다 — 한쪽만 아는 정보다.
    it("맵 담당에게 그 맵의 출입구와 다른 맵에서 오는 도착 칸을 알려 준다", () => {
      const project = world();
      const town = describeMapSeams(project, "map_town").join("\n");
      expect(town).toMatch(/출입구 \(19,8\) → map_field「들판」/);
      expect(town).toMatch(/도착 칸 \(\d+,\d+\) ← map_field「들판」/);
      expect(describeMapSeams(createBlankProject(), createBlankProject().startMapId)).toEqual([]);
    });

    it("연결이 온전하면 이슈가 없고, 계약이 없는 프로젝트는 검사하지 않는다", () => {
      expect(inspectWorldSeams(world()).issues.filter((issue) => issue.severity === "error")).toEqual([]);
      expect(inspectWorldSeams(createBlankProject())).toEqual({ nodes: 0, edges: 0, issues: [] });
    });

    // 깨질 것: 담당이 출입구 이벤트를 지우면 lintWorldGraph 는 warning 만 내고, 플레이어는 들판에 못 간다.
    it("출입구가 사라져 시작 맵에서 닿지 않는 계획 맵은 error 다", () => {
      const project = world();
      project.maps.map_town!.events = project.maps.map_town!.events.filter((event) => !event.id.startsWith("ev_world_gate"));
      const errors = inspectWorldSeams(project).issues.filter((issue) => issue.severity === "error");
      expect(errors).toEqual([expect.objectContaining({ code: "world-node-unreachable", mapId: "map_field" })]);
    });
  });
});

// 잠금 누수 감사(2026-10-16) #8 준비 — 같은 걷기 칩이 한 맵에 세 번째로 놓이면 place_npc 가 알린다. 막지는 않는다.
// 이 파일은 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
describe("placeNpcSameChipWarning", () => {
  isolateTimers();
  beforeEach(() => resetMapEditHistory());
  describe("place_npc 같은 칩 3번째 경고", () => {
    it("같은 칩 두 명까지는 경고가 없고, 세 번째부터 경고가 붙는다", () => {
      const project = createBlankProject();
      const ctx = { project, currentMapId: project.startMapId, assistantRun: true } as ToolContext;
      const graphic = { textureKey: "tex_easyrpg_charset_people1", characterIndex: 2 };
      const results = [0, 1, 2].map((i) => runTool(ctx, "place_npc", { mapId: project.startMapId, name: `주민${i}`, x: 3 + i * 3, y: 6, graphic }, { dryRun: false }));
      expect(results.every((result) => result.ok)).toBe(true);
      const warned = (result: (typeof results)[number]) => (result.diff?.warnings ?? []).some((warning) => /같은 걷기 칩/u.test(warning));
      expect(warned(results[0]!)).toBe(false);
      expect(warned(results[1]!)).toBe(false);
      expect(warned(results[2]!)).toBe(true);
    });
  });
});

describe("placePropsZeroPlacement", () => {
  isolateTimers();
  // 합본 마을 타일 번호·재료(돌벽=12, 팻말, 침엽수)를 겨냥한 시험 — 2026-10-07 저작권 정리 뒤 새 프로젝트 시작 맵은 버들항이라 옛 저장본처럼 합본 마을 위에서 시작한다.
  const createBlankProject = () => startOnRetiredCombinedTown(createBlankDefaultProject());
  // 라이브 QA 사고: fill_region 이 '키큰 풀'로 덮은 영역에 place_props 로 침엽수를 220개 요청하면
  // 0그루가 놓이는데도 ok=true 로 끝나, 나무 한 그루 없는 "빽빽한 숲"이 완성으로 보고됐다.

  function preparedProject(): { readonly ctx: { project: Project }; readonly mapId: string } {
    const project = createBlankProject();
    const ctx = { project };
    const mapId = project.startMapId;
    expect(runTool(ctx, "resize_map", { mapId, width: 100, height: 100 }).ok).toBe(true);
    return { ctx, mapId };
  }
  const FOREST = { x: 65, y: 5, w: 30, h: 30 };
  describe("place_props zero placement", () => {
    it("fails with an actionable message when the region and its expansion ring leave no room", () => {
      const { ctx, mapId } = preparedProject();
      // 2026-09-18 부터 0배치는 영역을 2칸씩 최대 3번 넓혀 재시도한다 — 넓힌 뒤에도 자리가 없어야 실패가 남는다.
      expect(runTool(ctx, "fill_region", { mapId, rect: { x: 55, y: 0, w: 45, h: 45 }, material: "키큰 풀" }).ok).toBe(true);

      const before = structuredClone(ctx.project);
      const result = runTool(ctx, "place_props", {
        mapId,
        area: FOREST,
        material: "침엽수",
        count: 220,
        packing: "dense",
        minGap: 0,
        seed: 5,
      });

      expect(result.ok).toBe(false);
      expect(result.issues?.[0]?.code).toBe("placement-zero");
      // The real fill writes lower vegetation, not occupied upper tiles. The old
      // prose assertion required ineffective upper erase. Pin measured fields.
      const record = result.issues![0]!.message.split("\n").find((line) => line.startsWith("placement_diagnostics: "));
      expect(record).toBeDefined();
      expect(JSON.parse(record!.slice("placement_diagnostics: ".length))).toEqual({
        unit: "candidate-origin", scope: "area-candidate-origins", footprint: { w: 1, h: 2 },
        candidateOrigins: 870, rejectedOrigins: 870, eligibleOrigins: 0,
        rejectedBy: { lowerIncompatible: 870 }, upperErase: { recommended: false, upperOnlyOrigins: 0 },
      });
      expect(ctx.project).toEqual(before);
    });

    it("still succeeds on an open region and reports partial placement as success", () => {
      const { ctx, mapId } = preparedProject();

      const result = runTool(ctx, "place_props", {
        mapId,
        area: FOREST,
        material: "침엽수",
        count: 220,
        packing: "dense",
        minGap: 0,
        seed: 5,
      });

      expect(result.ok, `${result.summary} ${JSON.stringify(result.issues ?? [])}`).toBe(true);
      const data = result.data as { readonly placed: number };
      expect(data.placed).toBeGreaterThan(0);
    });

    it("expands the area when the requested region is full but its surroundings are not", () => {
      const { ctx, mapId } = preparedProject();
      expect(runTool(ctx, "fill_region", { mapId, rect: FOREST, material: "키큰 풀" }).ok).toBe(true);
      const result = runTool(ctx, "place_props", { mapId, area: FOREST, material: "침엽수", count: 12, packing: "dense", minGap: 0, seed: 5 });
      expect(result.ok, result.summary).toBe(true);
      expect(result.summary).toContain("넓힘");
      expect((result.diff?.warnings ?? []).some((w) => w.includes("넓혀 배치"))).toBe(true);
    });
  });
});
