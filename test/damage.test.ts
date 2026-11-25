import { describe, expect, it, vi } from "vitest";
import { actorBattlers, battlerSnapshot, enemyBattlers } from "@/battle/battleBattlers";
import { applySkillLike, computeGen1BaseDamage } from "@/battle/battleDamage";
import { combatConditionMet } from "@/battle/combatConditions";
import { collectBattleRewards } from "@/battle/battleRewards";
import { advanceBattleSkillCooldowns, battleSkillUseFailure, consumeBattleSkillResource } from "@/battle/battleSkillUse";
import { predictSkillDamageFor } from "@/battle/battlePredict";
import { resolveGen1DamagingMove, type Gen1MoveInput, accuracyByteFromPercent, applyGen1StabAndType, computeGen1BaseDamageResult, gen1CriticalThreshold, scaleGen1DamageStats, scaledGen1Accuracy } from "@/battle/gen1/damage";
import { deserialize } from "@/project/io";
import fixture from "./fixtures/projects/battle-v3.json";
import { createGen1ByteRng } from "@/battle/gen1/rng";
import { isolateTimers } from "./mergedTeardown";

describe("feature16CombatRules", () => {
  isolateTimers();
  const project = () => deserialize(JSON.stringify(fixture));
  describe('feature16 conditions, drops, resources and prediction', () => {
    it('evaluates inclusive HP/MP, status, living allies and switches without random draws', () => {
      const subject = { hp: 25, maxHp: 100, mp: 0, maxMp: 0, stateIds: ['poison'] };
      expect(combatConditionMet({ kind: 'hp', minPercent: 25, maxPercent: 25 }, subject, 3, 2)).toBe(true);
      expect(combatConditionMet({ kind: 'mp', minPercent: 0, maxPercent: 0 }, subject, 3, 2)).toBe(true);
      expect(combatConditionMet({ kind: 'status', stateId: 'poison', present: false }, subject, 3, 2)).toBe(false);
      expect(combatConditionMet({ kind: 'allies', min: 2, max: 3 }, subject, 3, 2)).toBe(true);
      expect(combatConditionMet({ kind: 'turn', start: 2, interval: 2 }, subject, 3, 2)).toBe(false);
      expect(combatConditionMet({ kind: 'switch', switchId: 'bonus', value: true }, subject, 3, 2, { bonus: true })).toBe(true);
    });
    it('rolls each eligible drop in order, repeats quantity, and honors legacy replacement', () => {
      const p = project();
      const enemies = enemyBattlers(p, p.database.troops[0]);
      const enemy = enemies[0]; enemy.hp = 0;
      const record = p.database.enemies.find(e => e.id === enemy.recordId)!;
      record.rewards = { exp: 1, gold: 2, dropItemId: 'legacy', dropRatePercent: 100, drops: [
        { itemId: 'bonus', ratePercent: 100, quantity: 2, condition: { kind: 'switch', switchId: 'bonus', value: true } },
        { itemId: 'never', ratePercent: 100, quantity: 1, condition: { kind: 'hp', minPercent: 1, maxPercent: 100 } },
        { itemId: 'common', ratePercent: 50, quantity: 1, condition: { kind: 'always' } },
      ] };
      const rng = vi.fn(() => 0.25);
      expect(collectBattleRewards(p, [enemy], rng, 2, { bonus: true }).items).toEqual(['bonus', 'bonus', 'common']);
      expect(rng).toHaveBeenCalledTimes(2);
      expect(collectBattleRewards(p, [enemy], () => 0.25, 2, {}).items).toEqual(['common']);
      record.rewards.drops = [];
      expect(collectBattleRewards(p, [enemy], rng).items).toEqual([]);
      delete record.rewards.drops;
      expect(collectBattleRewards(p, [enemy], rng).items).toEqual(['legacy']);
      enemy.captured = true;
      expect(collectBattleRewards(p, [enemy], rng).items).toEqual([]);
    });
    it('consumes resources once and blocks the configured full subsequent rounds', () => {
      const p = project(); const user = actorBattlers(p)[0]; const skill = p.database.skills[0];
      skill.mpCost = { flat: 3, percentMax: 0 }; skill.cooldownTurns = 2;
      user.skillIds = [skill.id]; user.mp = 20;
      consumeBattleSkillResource(p, user, skill.id);
      expect(user.mp).toBe(17);
      expect(battleSkillUseFailure(p, user, skill.id)).toBe('cooldown');
      advanceBattleSkillCooldowns([user]);
      expect(user.skillCooldowns?.[skill.id]).toBe(2);
      advanceBattleSkillCooldowns([user]);
      expect(battleSkillUseFailure(p, user, skill.id)).toBe('cooldown');
      advanceBattleSkillCooldowns([user]);
      expect(battleSkillUseFailure(p, user, skill.id)).toBeUndefined();
    });
    it('predicts formula sequences using current stats and stops after lethal damage', () => {
      const p = project(); const user = actorBattlers(p)[0]; const target = enemyBattlers(p, p.database.troops[0])[0];
      target.hp = target.maxHp = 60;
      const skill = { ...p.database.skills[0], power: 30, damageFormula: 'power', hitSequence: [1, 2, 3], criticalRate: 0, variance: 0 };
      const predicted = predictSkillDamageFor(p, battlerSnapshot(user), skill, battlerSnapshot(target));
      expect(predicted.amount).toBe(90);
      const amounts: number[] = [];
      for (const hitMultiplier of skill.hitSequence) {
        if (target.hp <= 0) break;
        amounts.push(applySkillLike(user, target, { power: skill.power, statistic: 'attack', effect: 'damage', damageFormula: skill.damageFormula, hitMultiplier, criticalRate: 0, variance: 0, rng: () => 0.5 }).amount);
      }
      expect(amounts).toEqual([30, 60]);
      expect(amounts.reduce((a, b) => a + b, 0)).toBe(predicted.amount);
    });
    it('matches formula MP targeting and effective state stats without damaging HP', () => {
      const p = project(); const user = actorBattlers(p)[0]; const target = enemyBattlers(p, p.database.troops[0])[0];
      p.database.states.push({ id: 'f16_atk', name: 'Boost', runtimeEffects: { attackMultiplier: 2 } }, { id: 'f16_def', name: 'Guard', runtimeEffects: { defenseMultiplier: 0.5 } });
      user.stateIds = ['f16_atk']; target.stateIds = ['f16_def'];
      user.attackPower = 20; target.defense = 20; target.hp = target.maxHp = 10; target.mp = target.maxMp = 100;
      const skill = { ...p.database.skills[0], damageFormula: 'a.atk - b.def', hitSequence: [1, 1, 1], criticalRate: 0, variance: 0, effect: { kind: 'damage' as const, statistic: 'attack' as const, affects: 'mp' as const } };
      const predicted = predictSkillDamageFor(p, battlerSnapshot(user), skill, battlerSnapshot(target));
      expect(predicted.amount).toBe(90);
      const result = applySkillLike(user, target, { power: skill.power, statistic: 'attack', effect: 'damage', affects: 'mp', damageFormula: skill.damageFormula, attackerStatMultiplier: 2, targetDefenseMultiplier: 0.5, variance: 0, criticalRate: 0, rng: () => 0.5 });
      expect(result.amount).toBe(30); expect(target.mp).toBe(70); expect(target.hp).toBe(10);
    });
    it('keeps exact Gen1 accuracy/type semantics with authored critical and base overrides', () => {
      const move: Gen1MoveInput = { level: 20, power: 40, damageClass: 'physical', baseSpeed: 60, criticalRate: 'normal', offense: { unmodified: 40, modified: 40 }, defense: { unmodified: 30, modified: 30 }, burned: false, stab: false, typeFactors: [10], baseAccuracyByte: 255 };
      const run = (input: Gen1MoveInput, accuracyByte = 0) => { const bytes = [0, 255, accuracyByte]; return resolveGen1DamagingMove(input, () => bytes.shift() ?? 255); };
      expect(run(move)).toEqual(run({ ...move, criticalChancePercent: undefined, criticalMultiplier: undefined, baseDamageOverride: undefined }));
      const overridden = { ...move, criticalChancePercent: 100, criticalMultiplier: 3, baseDamageOverride: 20 };
      expect(run(overridden)).toMatchObject({ hit: true, critical: true, damage: 60 });
      // Gen1 stat scaling retains its native minimum accuracy byte of 1.
      expect(run({ ...overridden, baseAccuracyByte: 0 }, 1).hit).toBe(false);
      expect(run({ ...overridden, typeFactors: [0] })).toMatchObject({ hit: false, damage: 0, missReason: 'type' });
    });
  });
});

describe("gen1DamageGolden", () => {
  isolateTimers();
  function bytes(values: readonly number[]): { readonly next: () => number; readonly consumed: () => number } {
    let index = 0;
    return {
      next: () => {
        const value = values[index];
        if (value === undefined) throw new Error(`unexpected RNG read at ${index}`);
        index += 1;
        return value;
      },
      consumed: () => index,
    };
  }
  const neutralMove = {
    level: 50,
    power: 40,
    damageClass: "physical" as const,
    baseSpeed: 100,
    criticalRate: "normal" as const,
    offense: { unmodified: 100, modified: 100 },
    defense: { unmodified: 100, modified: 100 },
    burned: false,
    stab: false,
    typeFactors: [] as readonly number[],
    baseAccuracyByte: 255,
  };
  describe("Gen1 byte RNG", () => {
    it("break: float RNG must map to the complete 0..255 byte domain", () => {
      const values = [0, 0.5, 0.999999999];
      const nextByte = createGen1ByteRng(() => values.shift() ?? 0);
      expect([nextByte(), nextByte(), nextByte()]).toEqual([0, 128, 255]);
    });
  });
  describe("Gen1 neutral damage arithmetic", () => {
    it("break: the nested-floor Lv50/P40/A100/D100 vector must remain 19", () => {
      expect(computeGen1BaseDamage({ level: 50, power: 40, attack: 100, defense: 100 })).toBe(19);
    });

    it("break: either stat above 255 must quarter both stats before division", () => {
      expect(scaleGen1DamageStats(256, 5)).toEqual({ attack: 64, defense: 1 });
      expect(computeGen1BaseDamage({ level: 50, power: 40, attack: 256, defense: 5 })).toBe(999);
    });

    it("break: a zero defense created by quarter-scaling must be reported, not silently changed to one", () => {
      expect(computeGen1BaseDamageResult({ level: 50, power: 40, attack: 256, defense: 3 })).toEqual({
        ok: false,
        reason: "divisionByZero",
        attack: 64,
        defense: 0,
      });
    });

    it("break: the neutral damage cap must be applied before STAB and type floors", () => {
      expect(applyGen1StabAndType(3, true, [20, 20])).toBe(16);
      expect(applyGen1StabAndType(999, true, [])).toBe(1498);
    });
  });
  describe("Gen1 critical, burn, random damage, and accuracy order", () => {
    it("break: normal and high critical classes must use base Speed thresholds", () => {
      expect(gen1CriticalThreshold(100, "normal", false)).toBe(50);
      expect(gen1CriticalThreshold(100, "high", false)).toBe(255);
      expect(gen1CriticalThreshold(100, "normal", true)).toBe(12);
    });

    it("break: burn must halve only a noncritical physical Attack", () => {
      const physicalRng = bytes([255, 255, 0]);
      const specialRng = bytes([255, 255, 0]);
      const physical = resolveGen1DamagingMove({ ...neutralMove, burned: true }, physicalRng.next);
      const special = resolveGen1DamagingMove(
        { ...neutralMove, damageClass: "special", burned: true },
        specialRng.next,
      );
      expect(physical.damage).toBe(10);
      expect(special.damage).toBe(19);
    });

    it("break: a critical must ignore burn and both battlers' modified stats", () => {
      // raw 38 rotated left three times is 49, below the normal threshold 50.
      const rng = bytes([38, 255, 0]);
      const result = resolveGen1DamagingMove({
        ...neutralMove,
        burned: true,
        offense: { unmodified: 100, modified: 200 },
        defense: { unmodified: 100, modified: 50 },
      }, rng.next);
      expect(result).toMatchObject({ hit: true, critical: true, damage: 35, neutralDamage: 35 });
    });

    it("break: damage randomness must reject rotated bytes below 217", () => {
      // raw 0 rotates to 0 and is rejected; raw 255 rotates to 255 and is accepted.
      const rng = bytes([255, 0, 255, 0]);
      const result = resolveGen1DamagingMove(neutralMove, rng.next);
      expect(result.damage).toBe(19);
      expect(result.trace.rejectedDamageBytes).toEqual([0]);
      expect(rng.consumed()).toBe(4);
    });

    it("break: raw 179 must rotate right to the minimum accepted damage roll 217", () => {
      const rng = bytes([255, 179, 0]);
      const result = resolveGen1DamagingMove(neutralMove, rng.next);
      expect(result.damage).toBe(16);
      expect(result.trace.damageByte).toBe(217);
    });

    it("break: nominal 100% accuracy must still miss on byte 255 after damage RNG is consumed", () => {
      const rng = bytes([255, 255, 255]);
      const result = resolveGen1DamagingMove(neutralMove, rng.next);
      expect(result).toMatchObject({ hit: false, damage: 0, missReason: "accuracy", scaledAccuracy: 255 });
      expect(result.trace).toMatchObject({ critByte: 255, damageByte: 255, accuracyByte: 255 });
      expect(rng.consumed()).toBe(3);
    });
  });
  describe("Gen1 accuracy stages", () => {
    it("break: authored percentages must use the cartridge's floor(percent*255/100) encoding", () => {
      expect(accuracyByteFromPercent(100)).toBe(255);
      expect(accuracyByteFromPercent(95)).toBe(242);
    });

    it("break: accuracy and reflected evasion ratios must floor sequentially", () => {
      expect(scaledGen1Accuracy(242, -1, 0)).toBe(159);
      expect(scaledGen1Accuracy(255, 0, 1)).toBe(168);
    });
  });
});
