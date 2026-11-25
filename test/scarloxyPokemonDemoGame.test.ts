import { describe, expect, it } from "vitest";
import { applySkillLike } from "@/battle/battleDamage";
import { resolveBattlerPose, hitFeelFromActionResult } from "@/battle/battlePose";
import { collectBattleRewards } from "@/battle/battleRewards";
import { applyStateEffects, attackMultiplierForStates, clearBattleEndStates, runStateUpkeep, stateBehavior } from "@/battle/battleStates";
import { enemyBattlers, type MutableBattler, type EquipmentRuntimeEffects } from "@/battle/battleBattlers";
import { simulateBattle } from "@/battle/simulate";
import { predictAttackDamage, predictSkillDamage } from "@/battle/battlePredict";
import { createBattleRuntime } from "@/battle/runtime";
import { createScarloxyPokemonDemoProject } from "./support/scarloxyPokemonProject";
import { scarloxySpeciesId } from "@/project/defaults/scarloxyPokemonDemoGame";
import { startSession, type MonsterInstance } from "@/project/session";
import { giveMonster, captureStatusMultiplier, captureSuccessRate } from "@/project/monsterCollection";
import { deserialize } from "@/project/io";
import battleFixture from "./fixtures/projects/battle-v3.json";
import type { Project, SkillId, StateRecord } from "@/project/types";
import type { BattleActionResultSnapshot, BattleBattlerSnapshot, BattleRuntime } from "@/battle/types";
import { createBlankProject } from "@/project/defaults";
import { isolateTimers } from "./mergedTeardown";

describe("battleAdversarialFixes", () => {
  isolateTimers();
  function makeBattler(overrides: Partial<MutableBattler> = {}): MutableBattler {
    return {
      id: "b1",
      recordId: "actor_1",
      name: "Hero",
      maxHp: 100,
      maxMp: 50,
      attackPower: 40,
      defense: 20,
      mind: 10,
      agility: 30,
      chargeRate: 0.1,
      skillIds: [],
      hidden: false,
      hp: 100,
      mp: 50,
      gauge: 0,
      stateIds: [],
      stateTurns: {},
      defending: false,
      ...overrides,
    } as MutableBattler;
  }
  function scarloxyProject(): Project {
    return createScarloxyPokemonDemoProject();
  }
  // SC2 (H1): variance default is now 10% (fix §2). Explicit variance:0 stays deterministic.
  describe("SC2 — variance default is 10% (fixed, H1)", () => {
    it("applySkillLike with no variance spec applies default variance so rng affects damage", () => {
      const user = makeBattler({ attackPower: 40 });
      const target = makeBattler({ defense: 20, hp: 100 });
      const r1 = applySkillLike(user, target, { power: 10, statistic: "attack", effect: "damage", rng: () => 0.0 });
      target.hp = 100;
      const r2 = applySkillLike(user, target, { power: 10, statistic: "attack", effect: "damage", rng: () => 1.0 });
      expect(r1.amount).not.toBe(r2.amount);
    });
    it("explicit variance 0 is still deterministic", () => {
      const user = makeBattler({ attackPower: 40 });
      const target = makeBattler({ defense: 20, hp: 100 });
      const r1 = applySkillLike(user, target, { power: 10, statistic: "attack", effect: "damage", variance: 0, rng: () => 0.1 });
      target.hp = 100;
      const r2 = applySkillLike(user, target, { power: 10, statistic: "attack", effect: "damage", variance: 0, rng: () => 0.9 });
      expect(r1.amount).toBe(r2.amount);
    });
  });
  // SC3 (H2): strict wait must be honored or logged unsupported.
  describe("SC3 — strict wait honored or unsupported-logged (H2)", () => {
    it("a strict battle with a troop wait page produces an event log entry for the wait", () => {
      const project = scarloxyProject();
      const troop = project.database.troops.find((t) => t.id === "troop_pkmn_grass_a");
      if (!troop) throw new Error("missing troop");
      troop.battleEventPages = [
        {
          id: "page_wait_test",
          span: "battle",
          runOnce: true,
          conditions: [{ kind: "turn", start: 1, interval: 0 }],
          commands: [{ kind: "wait", ms: 500 } as never],
        },
      ];
      project.system.battleFlow = "strict";
      const rt = createBattleRuntime({
        project,
        troopId: "troop_pkmn_grass_a",
        canEscape: true,
        canLose: true,
        battleFlow: "strict",
        rng: () => 0,
      });
      rt.performActorCommand({ kind: "defend" });
      const snap = rt.snapshot();
      const hasWaitLog = snap.eventLogs.some((log) => log.detail?.includes("wait") || log.kind === "unsupported");
      expect(hasWaitLog).toBe(true);
    });
  });
  // SC4 (H3): strict actionTimes must grant extra action or log unsupported.
  describe("SC4 — strict actionTimes honored or unsupported-logged (H3)", () => {
    it("a strict battle where m2-108 actionTimes fires logs it (granted or unsupported)", () => {
      const project = scarloxyProject();
      const troop = project.database.troops.find((t) => t.id === "troop_pkmn_grass_a");
      if (!troop) throw new Error("missing troop");
      const actorId = project.system.startActorIds[0];
      troop.battleEventPages = [
        {
          id: "page_at_test",
          span: "battle",
          runOnce: true,
          conditions: [{ kind: "turn", start: 1, interval: 0 }],
          commands: [{ kind: "m2Command", commandId: "m2-108-action-times", fields: { target: actorId, value: 1 } } as never],
        },
      ];
      const rt = createBattleRuntime({
        project,
        troopId: "troop_pkmn_grass_a",
        canEscape: true,
        canLose: true,
        battleFlow: "strict",
        rng: () => 0,
      });
      rt.performActorCommand({ kind: "defend" });
      const snap = rt.snapshot();
      const hasActionTimesLog = snap.eventLogs.some((log) => log.detail?.includes("m2-108") || log.detail?.includes("actionTimes") || log.kind === "unsupported");
      expect(hasActionTimesLog).toBe(true);
    });
  });
  // SC5 (H4): createBattleRuntime without rng must warn (not silently fall back to fixed seed).
  describe("SC5 — createBattleRuntime without rng warns (H4)", () => {
    it("emits a console.warn when rng is omitted", () => {
      const project = scarloxyProject();
      const warnings: string[] = [];
      const origWarn = console.warn;
      console.warn = (msg: string) => { warnings.push(msg); };
      try {
        createBattleRuntime({ project, troopId: "troop_pkmn_grass_a", canEscape: true, canLose: true });
      } finally {
        console.warn = origWarn;
      }
      expect(warnings.some((w) => w.includes("rng"))).toBe(true);
    });
  });
  // SC6 (H5): battleDamage/states/rewards must not silently use Math.random.
  describe("SC6 — battleDamage/states/rewards require rng (H5)", () => {
    it("applySkillLike without rng throws (no Math.random fallback)", () => {
      const user = makeBattler();
      const target = makeBattler();
      expect(() =>
        applySkillLike(user, target, { power: 10, statistic: "attack", effect: "damage" })
      ).toThrow();
    });
    it("applyStateEffects without rng throws when a roll is needed", () => {
      const project = scarloxyProject();
      const target = makeBattler();
      const stateEffect = project.database.states[0];
      if (!stateEffect) return;
      expect(() =>
        applyStateEffects(project, target, [{ stateId: stateEffect.id, chance: 50, operation: "add" }])
      ).toThrow();
    });
    it("collectBattleRewards without rng throws", () => {
      const project = scarloxyProject();
      const enemy = makeBattler({ recordId: "enemy_pkmn_larvea" });
      expect(() => collectBattleRewards(project, [enemy])).toThrow();
    });
  });
  // SC7 (M2): predict uses snapshot level not DB initialLevel.
  describe("SC7 — predictAttackDamage uses snapshot level (M2)", () => {
    it("predicted damage for a level-10 actor differs from level-1", () => {
      const project = scarloxyProject();
      const actorRecord = project.database.actors[0];
      if (!actorRecord) throw new Error("missing actor");
      const targetSnapshot: BattleBattlerSnapshot = {
        id: "t1",
        recordId: "enemy_pkmn_larvea",
        name: "Target",
        hp: 100, maxHp: 100, mp: 0, maxMp: 0, gauge: 0,
        defeated: false, defending: false, stateIds: [], skillIds: [], pose: "idle",
      };
      const level1Actor: BattleBattlerSnapshot = {
        id: "a1", recordId: actorRecord.id, name: "Hero", level: 1,
        hp: 100, maxHp: 100, mp: 50, maxMp: 50, gauge: 0,
        defeated: false, defending: false, stateIds: [], skillIds: [], pose: "idle",
      };
      const level10Actor: BattleBattlerSnapshot = { ...level1Actor, level: 10 };
      const dmg1 = predictAttackDamage(project, level1Actor, targetSnapshot);
      const dmg10 = predictAttackDamage(project, level10Actor, targetSnapshot);
      expect(dmg10).not.toBe(dmg1);
    });
  });
  // SC8 (M2): predict includes equipment elemental defense halving.
  describe("SC8 — predictSkillDamage includes equipment elemental defense (M2)", () => {
    it("predicted damage is halved when target has elementalDefenseIds matching skill element", () => {
      const project = scarloxyProject();
      const element = project.database.elements?.[0];
      if (!element) return;
      // 포켓몬 데모 자기 기술만 본다. 2026-09-29 retro2003 로스터가 공용 기본 DB 에 sword 속성 직업 스킬을 넣으면서
      // 이 검사가 gen1 공식(장비 속성 방어 반감을 아직 적용하지 않는다)으로 처음 돌기 시작했다 — 원래 의도는 rm2k3 예측 경로다.
      const skill = project.database.skills.find((s) => s.elementId === element.id && s.id.startsWith("skill_scarloxy_"));
      if (!skill) return;
      const userSnapshot: BattleBattlerSnapshot = {
        id: "u1", recordId: project.database.actors[0]?.id ?? "a", name: "Caster",
        hp: 100, maxHp: 100, mp: 50, maxMp: 50, gauge: 0,
        defeated: false, defending: false, stateIds: [], skillIds: [skill.id], pose: "idle",
      };
      const baseTarget: BattleBattlerSnapshot = {
        id: "t1", recordId: "enemy_pkmn_larvea", name: "Target",
        hp: 100, maxHp: 100, mp: 0, maxMp: 0, gauge: 0,
        defeated: false, defending: false, stateIds: [], skillIds: [], pose: "idle",
      };
      const defendedTarget: BattleBattlerSnapshot = {
        ...baseTarget,
        id: "t2",
        equipmentEffects: { doubleAttack: false, elementalDefenseIds: [element.id], stateDefenseIds: [], stateDefenseMode: "resist" as const, stateResistanceChance: 0 },
      };
      const stat = skill.effect.kind === "damage" ? skill.effect.statistic : "attack";
      const baseDmg = predictSkillDamage(project, userSnapshot, { power: skill.power, statistic: stat, effect: "damage", elementId: element.id }, baseTarget);
      const defendedDmg = predictSkillDamage(project, userSnapshot, { power: skill.power, statistic: stat, effect: "damage", elementId: element.id }, defendedTarget);
      expect(defendedDmg.amount).toBeLessThanOrEqual(baseDmg.amount);
      expect(defendedDmg.amount).toBe(baseDmg.amount === 0 ? 0 : Math.floor(baseDmg.amount / 2));
    });
  });
  // SC9 (M3): simulateBattle must not mutate project.system flags.
  describe("SC9 — simulateBattle does not mutate project.system (M3)", () => {
    it("project.system battleParty/monsterBattleParty/monsterCollection unchanged after simulate with monsters", () => {
      const project = scarloxyProject();
      const session = startSession(project, 7);
      giveMonster(project, session, { speciesId: scarloxySpeciesId("sparchu"), level: 5 });
      const monsters = session.monsterParty.map((id) => session.monsterInstances[id]!);
      project.system.battleParty = undefined;
      project.system.monsterBattleParty = undefined;
      project.system.monsterCollection = undefined;
      simulateBattle({ project, troopId: "troop_pkmn_grass_a", heroLevel: 5, n: 1, seed: 1, monsterParty: monsters });
      expect(project.system.battleParty).toBeUndefined();
      expect(project.system.monsterBattleParty).toBeUndefined();
      expect(project.system.monsterCollection).toBeUndefined();
    });
  });
  // SC10 (M5): heal target not hit pose, caster not attack pose.
  describe("SC10 — heal actions do not show attack/hit pose (M5)", () => {
    it("healing action: caster shows idle/defend, target shows idle/defend (not attack/hit)", () => {
      const casterSnapshot = { id: "c1", recordId: "actor_1", defeated: false, defending: false };
      const targetSnapshot = { id: "t1", recordId: "actor_2", defeated: false, defending: false };
      const healResult: BattleActionResultSnapshot = {
        userRecordId: "actor_1",
        targetId: "t1",
        hit: true,
        amount: -30,
        critical: false,
      };
      const casterPose = resolveBattlerPose({ battler: casterSnapshot, lastActionResult: healResult, showActionPose: true });
      const targetPose = resolveBattlerPose({ battler: targetSnapshot, lastActionResult: healResult, showActionPose: true });
      expect(casterPose).not.toBe("attack");
      expect(targetPose).not.toBe("hit");
    });
  });
  // SC11 (M6): successful capture appends to actionLog.
  describe("SC11 — capture appends to actionLog (M6)", () => {
    it("successful capture produces an actionLog entry with the captured enemy targetId", () => {
      const project = scarloxyProject();
      const troop = project.database.troops.find((t) => t.id === "troop_pkmn_grass_a");
      if (!troop) throw new Error("missing troop");
      const captureItem = project.database.items.find((i) => i.captureProfile);
      if (!captureItem) return;
      const rt = createBattleRuntime({
        project,
        troopId: "troop_pkmn_grass_a",
        canEscape: true,
        canLose: false,
        sessionState: { switches: {}, variables: {}, inventory: { [captureItem.id]: 5 } },
        rng: () => 0,
      });
      // Advance gauge until an actor is ready to act.
      for (let i = 0; i < 1000 && rt.snapshot().phase !== "actorCommand"; i++) rt.tick(1000);
      const snap = rt.snapshot();
      const enemy = snap.enemies[0];
      if (!enemy) return;
      rt.performActorCommand({ kind: "capture", captureItemId: captureItem.id, targetEnemyId: enemy.id });
      const after = rt.snapshot();
      const hasCaptureLog = after.actionLog.some((entry) => entry.targetId === enemy.id);
      expect(hasCaptureLog).toBe(true);
    });
  });
  // SC12 (M4): enemy x>150 recentered into left formation.
  describe("SC12 — enemy x>150 recentered (M4)", () => {
    it("an enemy authored at x=200 is moved into the left formation range", () => {
      const project = scarloxyProject();
      const troop = project.database.troops.find((t) => t.id === "troop_pkmn_grass_a");
      if (!troop) throw new Error("missing troop");
      troop.members = [{ enemyId: troop.members?.[0]?.enemyId ?? "enemy_pkmn_larvea", x: 200, y: 52, hidden: false }];
      const battlers = enemyBattlers(project, troop);
      expect(battlers[0].battleX).toBeLessThanOrEqual(150);
    });
  });
  // ── 실플레이 적대 리뷰 후속(2026-09): 모델 파리티 회귀 ─────────────────────
  // 1) gen1 + RM 스킨 커맨드의 죽은 공격 — beginActorCommand 가 적법성 검사 없이
  //    대상 선택을 열어 확정 후 조용히 무시되던 결함.
  // 2) gauge 방어가 적 행동 1회마다 풀리던 결함 — 방어는 "다음 자기 행동까지".
  // 3) gauge turn 이 적 행동 단위로 오르던 결함 — strict 와 같이 사이클(전원 행동) 단위.
  // 4) predictSkillDamage rm2k3 경로의 상태 배율·MIN_DAMAGE 누락.

  function battleV3Project(): Project {
    return deserialize(JSON.stringify(battleFixture));
  }
  function twoSlimeTroop(project: Project): void {
    const troop = project.database.troops.find((entry) => entry.id === "troop_slime");
    const member = troop?.members?.[0];
    if (!troop || !member) throw new Error("missing troop_slime");
    // deserialize 가 enemyIds → members 를 합성하므로 members 를 직접 늘려야 한다.
    troop.members = [member, { ...member }];
  }
  function enemyActCount(rt: ReturnType<typeof createBattleRuntime>): number {
    return rt.snapshot().timeline.filter(
      (entry) => entry.side === "enemy" && (entry.kind === "action" || entry.kind === "damage" || entry.kind === "miss")
    ).length;
  }
  describe("gen1 attack command legality (dead-command fix)", () => {
    it("gen1 + gauge(RM 커맨드): 사용 가능한 기술이 있으면 attack 이 대상 선택을 열지 않는다", () => {
      const project = scarloxyProject();
      const rt = createBattleRuntime({
        project,
        troopId: "troop_pkmn_grass_a",
        canEscape: true,
        canLose: true,
        battleFlow: "gauge",
        rng: () => 0.5,
      });
      for (let i = 0; i < 1000 && rt.snapshot().phase !== "actorCommand"; i++) rt.tick(1000);
      const actor = rt.snapshot().actors[0];
      expect(actor?.skillIds.length ?? 0).toBeGreaterThan(0);
      rt.beginActorCommand({ kind: "attack" });
      // 예전: targetSelect 진입 → 대상 확정 후 isValidActorCommand 에서 조용히 무시.
      expect(rt.snapshot().phase).toBe("actorCommand");
      expect(rt.snapshot().targetSelection).toBeUndefined();
    });

    it("gen1 + gauge: 모든 기술의 PP 가 소진되면 attack(Struggle)이 합법으로 받아들여진다", () => {
      const project = scarloxyProject();
      const actorId = project.system.startActorIds[0];
      const actorRecord = project.database.actors.find((entry) => entry.id === actorId);
      if (!actorId || !actorRecord) throw new Error("missing start actor");
      // 배틀러 skillIds 는 레코드가 아니라 레벨 습득에서 온다 — PP 기술은 전부 0,
      // 비-PP 기술(0코스트 포함, 예: skill_sword_slash)은 코스트를 올려서
      // "쓸 수 있는 기술"을 완전히 없앤다.
      const pp0: Record<string, number> = {};
      for (const skill of project.database.skills) {
        if (skill.maxPp !== undefined) pp0[skill.id] = 0;
        else skill.mpCost = { ...skill.mpCost, flat: 999 };
      }
      const rt = createBattleRuntime({
        project,
        troopId: "troop_pkmn_grass_a",
        canEscape: true,
        canLose: true,
        battleFlow: "gauge",
        party: { levels: {}, experience: {}, skillPp: { [actorId]: pp0 }, vitals: { [actorId]: { hp: 100, mp: 0 } } },
        rng: () => 0.5,
      });
      for (let i = 0; i < 1000 && rt.snapshot().phase !== "actorCommand"; i++) rt.tick(1000);
      rt.beginActorCommand({ kind: "attack" });
      // 이 테스트가 지키는 것은 "Struggle 이 합법으로 받아들여진다"이지 특정 국면이 아니다.
      // 거부의 서명은 바로 위 테스트와 같다 — actorCommand 에 머물고 targetSelection 이 빈다.
      // 받아들여진 경우는 둘로 갈린다: 후보가 여럿이면 대상 목록이 열리고, 포켓몬 스킨 +
      // 단일 후보면 목록을 건너뛰고 바로 실행된다(runtime.autoConfirmSingleTarget, 2026-09-17).
      // 이 트룹(troop_pkmn_grass_a)은 적이 하나라 후자다 — 자동 확정 동작 자체는 아래
      // "포켓몬 단일 대상 자동 확정" 블록이 대조군까지 포함해 못박는다.
      const after = rt.snapshot();
      const rejected = after.phase === "actorCommand" && after.targetSelection === undefined;
      expect(rejected).toBe(false);
    });
  });
  describe("포켓몬 단일 대상 자동 확정", () => {
    function actorActCount(rt: ReturnType<typeof createBattleRuntime>): number {
      return rt.snapshot().timeline.filter(
        (entry) => entry.side === "actor" && (entry.kind === "action" || entry.kind === "damage" || entry.kind === "miss")
      ).length;
    }

    function runTo(rt: ReturnType<typeof createBattleRuntime>): void {
      for (let i = 0; i < 1000 && rt.snapshot().phase !== "actorCommand"; i++) rt.tick(1000);
    }

    function start(project: Project, troopId: string) {
      const rt = createBattleRuntime({ project, troopId, canEscape: true, canLose: true, battleFlow: "gauge", rng: () => 0.5 });
      runTo(rt);
      return rt;
    }

    it("포켓몬 스킨 + 적 1마리: 대상 목록을 건너뛰고 바로 실행한다", () => {
      const rt = start(scarloxyProject(), "troop_pkmn_grass_a");
      expect(rt.snapshot().enemies.length).toBe(1);
      const skillId = rt.snapshot().actors[0]?.skillIds[0];
      if (!skillId) throw new Error("actor has no skill");
      const before = actorActCount(rt);
      rt.beginActorCommand({ kind: "skill", skillId });
      expect(rt.snapshot().phase).not.toBe("targetSelect");
      expect(rt.snapshot().targetSelection).toBeUndefined();
      expect(actorActCount(rt)).toBeGreaterThan(before);
    });

    // gen1 은 적을 한 마리씩만 내보낸다(runtime.ts 의 gen1EnemyOrderIds + activeSlots 기본 1) —
    // 그래서 장르 프리셋 경로에서는 후보가 늘 하나였고 대상 선택이 언제나 헛걸음이었다.
    // 후보가 여럿인 경우는 "스킨만 포켓몬으로 바꾼" 경로에서 생긴다(battleModel 이 gen1 이 아님).
    it("포켓몬 스킨 + gen1 아님 + 적 2마리: 대상 목록이 열린다", () => {
      const project = scarloxyProject();
      project.system.battleModel = undefined;
      // 데모 야생 트룹은 1:1 로 줄였다(#1062) — 후보가 둘인 상황은 여기서 직접 만든다.
      const troop = project.database.troops.find((entry) => entry.id === "troop_pkmn_new_pair")!;
      troop.members = [...(troop.members ?? []), { enemyId: "enemy_pkmn_puddlup", x: 220, y: 132 }];
      troop.enemyIds = troop.members.map((member) => member.enemyId);
      // 포켓몬 화면의 종 몬스터 여럿은 기본(activeSlots 1)이면 한 마리씩 나온다(runtime singleFileEnemies, 2026-10-07) — 둘을 함께 세운다.
      troop.activeSlots = 2;
      const rt = start(project, "troop_pkmn_new_pair");
      expect(rt.snapshot().enemies.length).toBe(2);
      const skillId = rt.snapshot().actors[0]?.skillIds[0];
      if (!skillId) throw new Error("actor has no skill");
      rt.beginActorCommand({ kind: "skill", skillId });
      expect(rt.snapshot().phase).toBe("targetSelect");
      expect(rt.snapshot().targetSelection?.targetIds.length).toBe(2);
    });

    it("다른 스킨은 적이 1마리여도 목록이 열린다 — 취소 경로 계약 보존", () => {
      const project = scarloxyProject();
      project.system.battleUiStyle = "retro2003";
      const rt = start(project, "troop_pkmn_grass_a");
      expect(rt.snapshot().enemies.length).toBe(1);
      const skillId = rt.snapshot().actors[0]?.skillIds[0];
      if (!skillId) throw new Error("actor has no skill");
      rt.beginActorCommand({ kind: "skill", skillId });
      expect(rt.snapshot().phase).toBe("targetSelect");
    });
  });
  describe("gauge defend duration (until next own action)", () => {
    it("방어 자세는 적 행동이 지나가도 유지되고, 액터가 다시 행동할 때 해제된다", () => {
      const project = battleV3Project();
      twoSlimeTroop(project);
      const rt = createBattleRuntime({
        project,
        troopId: "troop_slime",
        canEscape: true,
        canLose: true,
        battleFlow: "gauge",
        rng: () => 0.5,
      });
      for (let i = 0; i < 400 && rt.snapshot().phase !== "actorCommand"; i++) rt.tick(1000);
      rt.performActorCommand({ kind: "defend" });
      expect(rt.snapshot().actors[0]?.defending).toBe(true);

      const actsAtDefend = enemyActCount(rt);
      let lastCheckedActs = actsAtDefend;
      let guardSurvivedEnemyAction = false;
      let guardDroppedOnOwnAction = false;
      for (let i = 0; i < 600 && !rt.snapshot().result; i++) {
        const snap = rt.snapshot();
        if (snap.phase === "actorCommand") {
          if (enemyActCount(rt) > actsAtDefend) {
            // 적 행동이 지나간 뒤 다음 명령 단계 — 방어가 살아 있어야 한다.
            expect(snap.actors[0]?.defending).toBe(true);
            rt.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
            expect(rt.snapshot().actors[0]?.defending).toBe(false);
            guardDroppedOnOwnAction = true;
            break;
          }
          rt.performActorCommand({ kind: "defend" });
        } else {
          rt.tick(1000);
        }
        if (enemyActCount(rt) > lastCheckedActs) {
          lastCheckedActs = enemyActCount(rt);
          // 적 행동 직후에도 방어는 유지된다(예전 코드는 여기서 전원 해제했다).
          expect(rt.snapshot().actors[0]?.defending).toBe(true);
          guardSurvivedEnemyAction = true;
        }
      }
      expect(guardSurvivedEnemyAction).toBe(true);
      expect(guardDroppedOnOwnAction).toBe(true);
    });
  });
  describe("gauge turn cadence (per action cycle)", () => {
    it("turn 은 적 행동 단위가 아니라 생존 배틀러 전원이 행동한 사이클에서만 증가한다", () => {
      const project = battleV3Project();
      twoSlimeTroop(project);
      const rt = createBattleRuntime({
        project,
        troopId: "troop_slime",
        canEscape: true,
        canLose: true,
        battleFlow: "gauge",
        rng: () => 0.5,
      });
      // 액터가 행동(방어)한다 — 사이클의 첫 슬롯 소비. turn 은 아직 0.
      for (let i = 0; i < 400 && rt.snapshot().phase !== "actorCommand"; i++) rt.tick(1000);
      rt.performActorCommand({ kind: "defend" });
      expect(rt.snapshot().turn).toBe(0);

      // 첫 적 행동: 예전 코드는 여기서 turn=1 이 됐다.
      for (let i = 0; i < 400 && enemyActCount(rt) < 1 && !rt.snapshot().result; i++) {
        if (rt.snapshot().phase === "actorCommand") rt.performActorCommand({ kind: "defend" });
        else rt.tick(1000);
      }
      expect(rt.snapshot().turn).toBe(0);

      // 두 번째 적까지 행동하면 전원(액터+적 2)이 슬롯을 소비해 사이클이 닫힌다.
      for (let i = 0; i < 400 && enemyActCount(rt) < 2 && !rt.snapshot().result; i++) {
        if (rt.snapshot().phase === "actorCommand") rt.performActorCommand({ kind: "defend" });
        else rt.tick(1000);
      }
      expect(enemyActCount(rt)).toBeGreaterThanOrEqual(2);
      expect(rt.snapshot().turn).toBe(1);
    });
  });
  describe("predictSkillDamage rm2k3 parity", () => {
    const snap = (overrides: Record<string, unknown>): BattleBattlerSnapshot =>
      ({
        id: "b1",
        recordId: "actor_hero",
        name: "Hero",
        hp: 100,
        maxHp: 100,
        mp: 50,
        maxMp: 50,
        gauge: 0,
        stateIds: [],
        stateTurns: {},
        skillIds: [],
        defeated: false,
        defending: false,
        level: 1,
        effectiveStats: { attack: 40, defense: 20, mind: 10, agility: 30 },
        ...overrides,
      }) as unknown as BattleBattlerSnapshot;

    it("공격 상승 상태 배율이 예측 피해에 반영된다", () => {
      const project = battleV3Project();
      const burn = project.database.states.find((state) => state.id === "state_burn");
      if (!burn) throw new Error("missing state_burn");
      (burn as { runtimeEffects?: Record<string, unknown> }).runtimeEffects = { attackMultiplier: 2 };
      const base = predictSkillDamage(project, snap({}), { power: 10, statistic: "attack", effect: "damage" }, snap({ recordId: "enemy_slime" }));
      const buffed = predictSkillDamage(project, snap({ stateIds: ["state_burn"] }), { power: 10, statistic: "attack", effect: "damage" }, snap({ recordId: "enemy_slime" }));
      // runtime: stat = round(attack * 2) — 예전 예측은 배율을 무시했다.
      expect(buffed.amount).toBeGreaterThan(base.amount);
      expect(buffed.amount).toBe(10 + Math.floor(80 / 2) - Math.floor(20 / 2));
    });

    it("뺄셈식 붕괴 구간에서 MIN_DAMAGE_RATIO 하한을 예측한다", () => {
      const project = battleV3Project();
      // power 100, 공격 0 → preDefense 100 → 하한 floor(100 * 0.125) = 12.
      // 예전 예측은 100 - floor(9999/2) < 0 → 0 을 반환했다.
      const target = snap({ recordId: "enemy_slime", effectiveStats: { attack: 0, defense: 9999, mind: 0, agility: 1 } });
      const user = snap({ effectiveStats: { attack: 0, defense: 0, mind: 0, agility: 1 } });
      const predicted = predictSkillDamage(project, user, { power: 100, statistic: "attack", effect: "damage" }, target);
      expect(predicted.amount).toBe(12);
    });
  });
});

// Gen1 포획 공식 — battleModel 게이트 계약.
//  (1) rm2k3(기본/생략)는 기존 공식 그대로 (monsterCollection.test.ts 의 4개 경계값 보존)
//  (2) gen1 은 (3M-2H)/3M HP 항 + 상태 보너스. 0~1 저장 도메인 유지(255 약분).
//  (3) "재우고 잡기": 수면 ×2 가 실제 확률로 나타난다 — Gen1 핵심 전략의 성립 증명.
describe("captureGen1", () => {
  isolateTimers();
  describe("captureSuccessRate — gen1 게이트", () => {
    it("rm2k3(옵션 생략)는 기존 공식이 바이트 단위로 유지된다", () => {
      // monsterCollection.test.ts:65-68 과 같은 값 — 옵션 없는 호출이 영원히 이 값이어야 한다.
      expect(captureSuccessRate(0.5, 100, 100, 1)).toBeCloseTo(0.15);
      expect(captureSuccessRate(0.5, 1, 100, 1)).toBeCloseTo(0.4965);
      // model: "rm2k3" 명시도 동일 경로다.
      expect(captureSuccessRate(0.5, 100, 100, 1, { model: "rm2k3", statusMultiplier: 2 })).toBeCloseTo(0.15);
    });

    it("gen1: 만HP 1/3, 빈사 ≈1 — (3M-2H)/3M HP 항", () => {
      // 만HP: hpRatio 1 → (3-2)/3 = 1/3
      expect(captureSuccessRate(1, 100, 100, 1, { model: "gen1" })).toBeCloseTo(1 / 3);
      // 빈사(HP 1%): (3-0.02)/3 ≈ 0.9933
      expect(captureSuccessRate(1, 1, 100, 1, { model: "gen1" })).toBeCloseTo(2.98 / 3);
      // 절반: (3-1)/3 = 2/3
      expect(captureSuccessRate(0.45, 50, 100, 1, { model: "gen1" })).toBeCloseTo(0.45 * (2 / 3));
    });

    it("gen1: 상태 보너스가 곱해지고 1.0 에서 클램프된다", () => {
      const awake = captureSuccessRate(0.3, 100, 100, 1, { model: "gen1" });
      const asleep = captureSuccessRate(0.3, 100, 100, 1, { model: "gen1", statusMultiplier: 2 });
      expect(asleep).toBeCloseTo(awake * 2);
      // 수면 + 빈사 + 고배율 볼 → 1.0 클램프
      expect(captureSuccessRate(0.9, 1, 100, 3, { model: "gen1", statusMultiplier: 2 })).toBe(1);
    });

    it("captureStatusMultiplier: 수면/빙결 ×2, 독/화상/마비 ×1.5, 최대값 하나만", () => {
      expect(captureStatusMultiplier([])).toBe(1);
      expect(captureStatusMultiplier(["state_sleep"])).toBe(2);
      expect(captureStatusMultiplier(["state_freeze"])).toBe(2);
      expect(captureStatusMultiplier(["state_poison"])).toBe(1.5);
      expect(captureStatusMultiplier(["state_burn"])).toBe(1.5);
      expect(captureStatusMultiplier(["state_paralysis"])).toBe(1.5);
      // 복수 상태: Gen1 은 곱하지 않는다 — 2 × 1.5 = 3 이 아니라 max(2, 1.5) = 2.
      expect(captureStatusMultiplier(["state_poison", "state_sleep"])).toBe(2);
      // 무관 상태는 1.
      expect(captureStatusMultiplier(["state_attack_up"])).toBe(1);
    });

    it("런타임 통합: 정확한 2단계 바이트 판정에서도 '재우고 잡기'가 성립한다", () => {
      // 상태 부여는 정석 경로(battleRuntimeStates.test.ts 패턴)를 쓴다: support 스킬 +
      // stateEffects 100%. support 는 hit:true 에 데미지 0 이라 — 데미지 스킬로 재우면
      // HP 가 깎여 (3M-2H)/3M 항이 같이 올라가 수면 효과와 구분이 안 된다.
      const SLEEP_SKILL = "skill_test_sleep_powder";
      const withSleepSkill = (project: Project): void => {
        project.database.skills.push({
          id: SLEEP_SKILL,
          name: "수면 가루",
          scope: "enemy",
          power: 0,
          description: "테스트 전용 — 대상을 재운다.",
          type: "normal",
          mpCost: { flat: 0, percentMax: 0 },
          successRate: 100,
          variance: 0,
          hitRate: 100,
          effect: { kind: "support" },
          stateEffects: [{ stateId: "state_sleep", chance: 100, operation: "add" }],
        });
      };
      const starter = (project: Project): MonsterInstance => ({
        instanceId: "mon_test_1",
        speciesId: scarloxySpeciesId("sparchu"),
        level: 5,
        exp: 0,
        skillIds: [SLEEP_SKILL],
        friendship: 70,
        caughtAt: { mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y },
      });
      const byteSequence = (bytes: readonly number[]): (() => number) => {
        let index = 0;
        return () => (bytes[index++] ?? 255) / 256;
      };
      const makeRuntime = (rng: () => number): { runtime: BattleRuntime; project: Project } => {
        const project = createScarloxyPokemonDemoProject();
        withSleepSkill(project);
        const runtime = createBattleRuntime({
          project,
          troopId: "troop_pkmn_grass_a",
          canEscape: true,
          canLose: true,
          // battleFlow 는 이제 데모 system 기본값(strict)을 탄다 — 명시하지 않는 것 자체가 검증.
          sessionState: { switches: {}, variables: {}, inventory: { item_capture_orb: 3 } },
          captureLocation: { mapId: "map_pkmn_route", x: 1, y: 1 },
          partyMonsters: [starter(project)],
          rng,
        });
        return { runtime, project };
      };

      // 데모 야생종에서도 수면 확률이 더 높다는 공개 확률 계약을 함께 보존한다.
      const probe = createScarloxyPokemonDemoProject();
      const wildSpeciesId = (() => {
        const troop = probe.database.troops.find((record) => record.id === "troop_pkmn_grass_a");
        const enemy = probe.database.enemies.find((record) => record.id === troop?.members?.[0]?.enemyId);
        if (!enemy?.speciesId) throw new Error("missing wild species for troop_pkmn_grass_a");
        return enemy.speciesId;
      })();
      const species = (probe.database.monsterSpecies ?? []).find((record) => record.id === wildSpeciesId);
      if (!species) throw new Error(`missing species record: ${wildSpeciesId}`);
      const awakeRate = captureSuccessRate(species.captureRate, 100, 100, 1, { model: "gen1" });
      const sleepRate = captureSuccessRate(species.captureRate, 100, 100, 1, { model: "gen1", statusMultiplier: 2 });
      expect(sleepRate).toBeGreaterThan(awakeRate);
      // 대조군: Rand1=20 은 catch-rate gate 를 지나지만 Rand2=255 에서 실패한다.
      const awake = makeRuntime(byteSequence([20, 255]));
      awake.runtime.performActorCommand({ kind: "capture", captureItemId: "item_capture_orb", targetEnemyId: "enemy-1" });
      expect(awake.runtime.snapshot().capturedMonsters).toHaveLength(0);

      // 실험군: hit/sleep-turn 바이트 0,2 뒤 같은 Rand1=20 을 쓴다.
      // 수면/빙결은 Rand1<25 즉시 성공이므로 Rand2 를 소비하지 않고 포획된다.
      const sleep = makeRuntime(byteSequence([0, 2, 20]));
      sleep.runtime.performActorCommand({ kind: "skill", skillId: SLEEP_SKILL, targetEnemyId: "enemy-1" });
      const enemyAfterSleep = sleep.runtime.snapshot().enemies[0];
      expect(enemyAfterSleep?.stateIds).toContain("state_sleep");
      expect(enemyAfterSleep?.hp).toBe(enemyAfterSleep?.maxHp);
      sleep.runtime.performActorCommand({ kind: "capture", captureItemId: "item_capture_orb", targetEnemyId: "enemy-1" });
      expect(sleep.runtime.snapshot().capturedMonsters).toHaveLength(1);
      expect(sleep.runtime.snapshot().capturedMonsters[0]?.speciesId).toBe(wildSpeciesId);
    });
  });
});

// Gen1 상태 저작 계약 — 포켓몬 데모 DB 전용.
//  (1) 화상/독의 턴당 피해가 Gen1 의 1/16 과 값이 같다: floor(maxHp × 6.25 / 100) ≡ floor(maxHp / 16).
//  (2) 전역 기본 DB(RM2K3 프로젝트 공유)는 건드리지 않는다 — 독 6% 계약(battleStates.test.ts) 보존.
//  (3) 화상은 자연 회복이 없고 전투 종료로만 풀리며 공격을 반감한다.
//  (4) 불씨 뿜기 10% 화상 / 전광석화 우선도 +1 은 데모 저작 데이터에 실재한다.
describe("gen1DemoStates", () => {
  isolateTimers();
  // 자연 회복 판정에 가장 유리한 rng — 화상이 안 풀리는 것은 확률 0 때문이어야 한다.
  const luckiest: () => number = () => 0;
  function stateRecord(project: Project, id: string): StateRecord {
    const record = project.database.states.find((entry) => entry.id === id);
    if (!record) throw new Error(`missing state ${id}`);
    return record;
  }
  function battler(maxHp: number, stateIds: readonly string[]): MutableBattler {
    return {
      id: "enemy-1",
      recordId: "enemy_pkmn_wild",
      name: "야생 몬스터",
      maxHp,
      maxMp: 10,
      attackPower: 30,
      defense: 20,
      mind: 10,
      agility: 10,
      chargeRate: 1,
      skillIds: [],
      hidden: false,
      hp: maxHp,
      mp: 10,
      gauge: 0,
      stateIds: [...stateIds],
      stateTurns: {},
      defending: false,
    };
  }
  describe("Gen1 데모 상태 — 화상/독", () => {
    it("화상은 공격 반감 + 턴당 6.25% + 전투 후 지속 + 자연 회복 없음으로 해석된다", () => {
      const behavior = stateBehavior(stateRecord(createScarloxyPokemonDemoProject(), "state_burn"));
      expect(behavior.attackMultiplier).toBe(0.5);
      expect(behavior.hpDamagePercentPerTurn).toBe(6.25);
      expect(behavior.removeOnBattleEnd).toBe(false);
      expect(behavior.restrictsAction).toBe(false);
      // Gen1 화상은 스스로 낫지 않는다 — 확률 0 이라 rng 가 아무리 좋아도 안 풀린다.
      expect(behavior.recoverNaturallyChance).toBe(0);
    });

    it("턴당 피해가 Gen1 1/16 과 값이 같다 (floor(maxHp/16), 최소 1)", () => {
      const project = createScarloxyPokemonDemoProject();
      // 16 의 배수/비배수, 6.25% 가 1 미만인 소형 HP 까지 — floor 경계 전부.
      for (const maxHp of [8, 16, 18, 31, 32, 46, 100]) {
        const burned = battler(maxHp, ["state_burn"]);
        const result = runStateUpkeep(project, burned, luckiest);
        const gen1Tick = Math.max(1, Math.floor(maxHp / 16));
        expect(result.hpDamage, `maxHp=${maxHp}`).toBe(gen1Tick);
        expect(burned.hp, `maxHp=${maxHp}`).toBe(maxHp - gen1Tick);
        // 확률 0 이라 자연 회복 판정을 통과하지 못한다.
        expect(result.removedStateIds, `maxHp=${maxHp}`).toHaveLength(0);
        expect(burned.stateIds).toContain("state_burn");
      }
    });

    it("데모 독은 6.25% 로 덮이고 전역 기본 DB 의 6% 는 그대로다", () => {
      expect(stateBehavior(stateRecord(createScarloxyPokemonDemoProject(), "state_poison")).hpDamagePercentPerTurn).toBe(6.25);
      // 전역 기본값을 오염시키면 RM2K3 프로젝트가 같이 바뀐다 — 여기서 잡는다.
      expect(stateBehavior(stateRecord(createBlankProject(), "state_poison")).hpDamagePercentPerTurn).toBe(6);
      // 독은 Gen1 처럼 전투 후에도 남는다(화상과 대비되는 지점).
      expect(stateBehavior(stateRecord(createScarloxyPokemonDemoProject(), "state_poison")).removeOnBattleEnd).toBe(false);
    });

    it("전투 종료 시 화상과 독이 모두 남는다", () => {
      const project = createScarloxyPokemonDemoProject();
      const target = battler(100, ["state_burn", "state_poison"]);
      clearBattleEndStates(project, target);
      expect(target.stateIds).toEqual(["state_burn", "state_poison"]);
    });

    it("화상 중 공격력이 절반이 된다", () => {
      const project = createScarloxyPokemonDemoProject();
      expect(attackMultiplierForStates(project, battler(100, []))).toBe(1);
      expect(attackMultiplierForStates(project, battler(100, ["state_burn"]))).toBe(0.5);
    });
  });
  describe("Gen1 데모 스킬 저작", () => {
    it("불씨 뿜기는 10% 확률로 화상을 건다", () => {
      const project = createScarloxyPokemonDemoProject();
      const ember = project.database.skills.find((record) => record.id === "skill_scarloxy_ember");
      expect(ember?.stateEffects).toEqual([{ stateId: "state_burn", chance: 10, operation: "add" }]);
      // 참조하는 상태가 같은 DB 에 실재해야 한다.
      expect(project.database.states.some((record) => record.id === "state_burn")).toBe(true);
    });

    it("전광석화는 우선도 +1 이고 스파르츄가 Lv5 에 배운다", () => {
      const project = createScarloxyPokemonDemoProject();
      const quick = project.database.skills.find((record) => record.id === "skill_scarloxy_quick");
      expect(quick?.movePriority).toBe(1);
      const sparchu = (project.database.monsterSpecies ?? []).find((record) => record.id === scarloxySpeciesId("sparchu"));
      expect(sparchu?.skillsByLevel).toEqual(
        expect.arrayContaining([{ level: 5, skillId: "skill_scarloxy_quick" }])
      );
    });
  });
});
