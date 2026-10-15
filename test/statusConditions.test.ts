// poke-depth PR2: 맹독(차례마다 커지는 독)·혼란(휘발 상태). 작성만 했고 실행하지 않았다(워크트리 규칙).
import { describe, expect, it } from "vitest";
import {
  applyGen1MajorStatus,
  applyGen1PostActionResidual,
  gen1ConfusionSelfDamage,
  gen1ConfusionTurns,
  gen1MajorStatusBlockedByType,
  gen1NextToxicCounter,
  readGen1MajorStatus,
  stepGen1Confusion,
} from "@/battle/gen1/status";
import { normalizeStateRecord } from "@/project/databaseRecordModel";
import { createBattleRuntime } from "@/battle/runtime";
import { createScarloxyPokemonDemoProject } from "./support/scarloxyPokemonProject";
import { scarloxySpeciesId } from "@/project/defaults/scarloxyPokemonDemoGame";
import { normalizeSkillRecord } from "@/project/databaseRecordModel";

const records = [
  { id: "state_toxic", gen1MajorStatus: "toxic" as const },
  { id: "state_poison", gen1MajorStatus: "poison" as const },
  { id: "state_confusion", volatileStatus: "confusion" as const },
];

describe("toxic", () => {
  it("counter climbs by one each turn and stops at 15", () => {
    expect(gen1NextToxicCounter(undefined)).toBe(1);
    expect(gen1NextToxicCounter(0)).toBe(1);
    expect(gen1NextToxicCounter(7)).toBe(8);
    expect(gen1NextToxicCounter(15)).toBe(15);
  });
  it("residual damage is 1/16 times the counter, plain poison stays fixed", () => {
    expect(applyGen1PostActionResidual({ kind: "toxic", maxHp: 160, currentHp: 160, toxicCounter: 3 }).damage).toBe(30);
    expect(applyGen1PostActionResidual({ kind: "toxic", maxHp: 160, currentHp: 160 }).damage).toBe(10);
    expect(applyGen1PostActionResidual({ kind: "poison", maxHp: 160, currentHp: 160, toxicCounter: 9 }).damage).toBe(10);
  });
  it("is a major status: blocked by an existing one and by poison/steel types", () => {
    const applied = applyGen1MajorStatus({ stateIds: ["state_poison"], stateTurns: {}, stateRecords: records, incomingStateId: "state_toxic" }, () => 255);
    expect(applied.applied).toBe(false);
    expect(gen1MajorStatusBlockedByType("toxic", "normal", ["poison"], "status")).toBe(true);
    expect(gen1MajorStatusBlockedByType("toxic", "normal", ["steel"], "status")).toBe(true);
    expect(gen1MajorStatusBlockedByType("toxic", "normal", ["normal"], "status")).toBe(false);
  });
});

describe("confusion", () => {
  it("lasts 2-5 actions", () => {
    for (let byte = 0; byte < 256; byte++) {
      const turns = gen1ConfusionTurns(() => byte);
      expect(turns).toBeGreaterThanOrEqual(2);
      expect(turns).toBeLessThanOrEqual(5);
    }
  });
  it("snaps out when the counter reaches zero, otherwise half hit themselves", () => {
    expect(stepGen1Confusion(1, () => 0).outcome).toBe("snappedOut");
    expect(stepGen1Confusion(3, () => 10)).toMatchObject({ outcome: "selfHit", turnsLeft: 2 });
    expect(stepGen1Confusion(3, () => 200)).toMatchObject({ outcome: "acts", turnsLeft: 2 });
  });
  it("does not count as a major status", () => {
    expect(readGen1MajorStatus(["state_confusion"], {}, records)).toBeUndefined();
  });
  it("self damage is a typeless power-40 hit and at least 1", () => {
    expect(gen1ConfusionSelfDamage(50, 100, 100)).toBe(Math.floor(Math.floor(22 * 40 * 100 / 100) / 50) + 2);
    expect(gen1ConfusionSelfDamage(1, 1, 999)).toBeGreaterThanOrEqual(1);
  });
});

describe("state record normalization", () => {
  it("keeps the new enum fields and leaves records without them byte-identical", () => {
    expect(normalizeStateRecord({ id: "a", name: "a", volatileStatus: "confusion" }).volatileStatus).toBe("confusion");
    expect(normalizeStateRecord({ id: "a", name: "a", gen1MajorStatus: "toxic" }).gen1MajorStatus).toBe("toxic");
    expect("volatileStatus" in normalizeStateRecord({ id: "a", name: "a" })).toBe(false);
    expect("volatileStatus" in normalizeStateRecord({ id: "a", name: "a", volatileStatus: "bogus" as never })).toBe(false);
  });
});

describe("gen1 runtime", () => {
  const prng = (seed: number) => { let sd = seed >>> 0; return () => { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return ((sd >>> 8) & 0xffff) / 65536; }; };
  const SP = scarloxySpeciesId("sparchu");
  function build(seed: number) {
    const project: any = structuredClone(createScarloxyPokemonDemoProject());
    const enemy = project.database.enemies.find((r: any) => r.id === "enemy_pkmn_larvea");
    project.database.monsterSpecies.find((r: any) => r.id === enemy.speciesId).types = ["normal"];
    enemy.stats = { ...enemy.stats, maxHp: 400, attack: 40, defense: 40, mind: 40, agility: 1 };
    enemy.actions = [{ skillId: "skill_scarloxy_scratch", priority: 5, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }];
    const skill = (id: string, stateId: string, scope: "enemy" | "self" = "enemy") => normalizeSkillRecord({ id, name: id, scope, power: 0, animationId: "anim_magic", description: "x", type: "normal", mpCost: { flat: 0, percentMax: 0 }, successRate: 100, variance: 0, hitRate: 100, effect: { kind: "support" }, maxPp: 30, stateEffects: stateId ? [{ stateId, chance: 100, operation: "add" }] : [] } as any);
    project.database.skills.push(skill("pd_toxic", "state_toxic"), skill("pd_wait", "", "self"));
    const mon = { instanceId: "m1", speciesId: SP, level: 50, exp: 0, skillIds: ["pd_toxic", "pd_wait"], skillPp: { pd_toxic: 30, pd_wait: 30 }, friendship: 70, caughtAt: { mapId: "map_pkmn_town", x: 1, y: 1 } };
    return createBattleRuntime({ project, troopId: "troop_pkmn_grass_a", canEscape: true, canLose: true, battleFlow: "strict", partyMonsters: [mon], sessionState: { switches: {}, variables: {}, inventory: {} }, rng: prng(seed) } as any) as any;
  }
  it("toxic damage grows by 1/16 each turn", () => {
    const rt = build(7);
    const ticks: number[] = [];
    const take = (entries: any[]) => entries.filter((e) => e.kind === "stateUpkeep" && e.side === "enemy").forEach((e) => ticks.push(e.amount));
    const cast = (id: string) => { const n = rt.snapshot().timeline.length; rt.performActorCommand({ kind: "skill", skillId: id, targetEnemyId: "enemy-1", ...(id === "pd_wait" ? { targetActorId: "m1" } : {}) }); return rt.snapshot().timeline.slice(n); };
    take(cast("pd_toxic"));
    for (let i = 0; i < 3; i++) take(cast("pd_wait"));
    const unit = Math.floor(rt.snapshot().enemies[0].maxHp / 16);
    expect(ticks.slice(0, 4)).toEqual([unit, unit * 2, unit * 3, unit * 4]);
  });
});
