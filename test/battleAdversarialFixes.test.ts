import { describe, expect, it } from "vitest";
import { applySkillLike } from "@/battle/battleDamage";
import { resolveBattlerPose, hitFeelFromActionResult } from "@/battle/battlePose";
import { collectBattleRewards } from "@/battle/battleRewards";
import { applyStateEffects } from "@/battle/battleStates";
import { enemyBattlers, type MutableBattler } from "@/battle/battleBattlers";
import { simulateBattle } from "@/battle/simulate";
import { predictAttackDamage, predictSkillDamage } from "@/battle/battlePredict";
import { createBattleRuntime } from "@/battle/runtime";
import { createScarloxyPokemonDemoProject } from "@/project/defaults";
import { scarloxySpeciesId } from "@/project/defaults/scarloxyPokemonDemoGame";
import { startSession } from "@/project/session";
import { giveMonster } from "@/project/monsterCollection";
import type { EquipmentRuntimeEffects } from "@/battle/battleBattlers";
import { deserialize } from "@/project/io";
import type { Project, SkillId } from "@/project/types";
import type { BattleActionResultSnapshot, BattleBattlerSnapshot } from "@/battle/types";

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

// SC2 (H1): variance default must be 0. With rng=0.0 (min) and rng=1.0 (max),
// a ±15% variance would produce different amounts. If default is 0, both match.
describe("SC2 — variance default is 0 (H1)", () => {
  it("applySkillLike with no variance spec produces identical damage regardless of rng value", () => {
    const user = makeBattler({ attackPower: 40 });
    const target = makeBattler({ defense: 20, hp: 100 });
    const r1 = applySkillLike(user, target, { power: 10, statistic: "attack", effect: "damage", rng: () => 0.1 });
    target.hp = 100;
    const r2 = applySkillLike(user, target, { power: 10, statistic: "attack", effect: "damage", rng: () => 0.9 });
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
    const skill = project.database.skills.find((s) => s.elementId === element.id);
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
