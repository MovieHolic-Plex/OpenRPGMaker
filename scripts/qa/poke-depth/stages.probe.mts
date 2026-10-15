// poke-depth PR1 probe: 능력치 단계(−6~+6)가 실제 전투 엔진에서 피해·명중·속도·교체 초기화에 먹는지 잰다.
//   bun scripts/qa/poke-depth/stages.probe.mts
import { createBattleRuntime } from "../../../src/battle/runtime";
import { createScarloxyPokemonDemoProject } from "../../../test/support/scarloxyPokemonProject";
import { scarloxySpeciesId } from "../../../src/project/defaults/scarloxyPokemonDemoGame";
import { normalizeSkillRecord } from "../../../src/project/databaseRecordModel";

const prng = (seed: number) => { let sd = seed >>> 0; return () => { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return ((sd >>> 8) & 0xffff) / 65536; }; };
const SP = scarloxySpeciesId("sparchu");
const mon = (id: string, skillIds: string[]) => ({ instanceId: id, speciesId: SP, level: 50, exp: 0, skillIds, skillPp: Object.fromEntries(skillIds.map((s) => [s, 30])), friendship: 70, caughtAt: { mapId: "map_pkmn_town", x: 1, y: 1 } });
const addSkill = (p: any, s: any) => p.database.skills.push(normalizeSkillRecord({ id: s.id, name: s.name, scope: s.scope ?? "enemy", power: s.power ?? 0, animationId: "anim_magic", description: "x", type: "normal", mpCost: { flat: 0, percentMax: 0 }, successRate: 100, variance: 0, hitRate: s.hitRate ?? 100, effect: s.effect ?? { kind: "support" }, elementId: s.elementId, maxPp: 30, statStageEffects: s.statStageEffects } as any));

const BASE: any = createScarloxyPokemonDemoProject();
function build(model: "gen1" | "rm2k3", skills: string[], seed = 3) {
  const project: any = structuredClone(BASE);
  if (model === "rm2k3") delete project.system.battleModel;
  const enemy = project.database.enemies.find((r: any) => r.id === "enemy_pkmn_larvea");
  enemy.stats = { ...enemy.stats, maxHp: 9999, attack: 30, defense: 40, mind: 40, agility: 1 };
  enemy.actions = [{ skillId: "skill_scarloxy_scratch", priority: 5, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }];
  addSkill(project, { id: "pd_growl", name: "울음", scope: "enemy", statStageEffects: [{ stat: "attack", stages: -1 }] });
  addSkill(project, { id: "pd_swords", name: "칼춤", scope: "self", statStageEffects: [{ stat: "attack", stages: 2 }] });
  addSkill(project, { id: "pd_harden", name: "단단해지기", scope: "self", statStageEffects: [{ stat: "defense", stages: 6 }] });
  addSkill(project, { id: "pd_smoke", name: "연막", scope: "self", statStageEffects: [{ stat: "accuracy", stages: -6 }] });
  addSkill(project, { id: "pd_smoke_foe", name: "연막(적)", scope: "enemy", statStageEffects: [{ stat: "accuracy", stages: -6 }] });
  addSkill(project, { id: "pd_agility", name: "고속이동", scope: "self", statStageEffects: [{ stat: "speed", stages: 2 }] });
  addSkill(project, { id: "pd_cosmic", name: "신비한힘", scope: "self", statStageEffects: [{ stat: "spAttack", stages: 2 }] });
  const rt = createBattleRuntime({ project, troopId: "troop_pkmn_grass_a", canEscape: true, canLose: true, battleFlow: "strict", partyMonsters: [mon("m1", skills)], sessionState: { switches: {}, variables: {}, inventory: {} }, rng: prng(seed) } as any);
  return { project, rt };
}
const SELF = ["pd_swords", "pd_harden", "pd_agility", "pd_cosmic", "pd_smoke"];
const cast = (rt: any, skillId: string, target = "enemy-1") => {
  const before = rt.snapshot().timeline.length;
  rt.performActorCommand({ kind: "skill", skillId, targetEnemyId: target, ...(SELF.includes(skillId) ? { targetActorId: rt.snapshot().actors[0].recordId } : {}) } as any);
  return rt.snapshot().timeline.slice(before);
};
const dealt = (entries: any[]) => entries.filter((e) => e.side === "actor" && e.kind === "damage").map((e) => e.amount)[0] ?? 0;
const enemyDealt = (entries: any[]) => entries.filter((e) => e.side === "enemy" && e.kind === "damage").map((e) => e.amount)[0] ?? 0;
const QUICK = "skill_scarloxy_quick", SPARK = "skill_scarloxy_spark";

for (const model of (process.env.MODELS ?? "gen1,rm2k3").split(",") as ("gen1" | "rm2k3")[]) {
  console.log(`\n=== ${model} ===`);
  { const a = build(model, [QUICK]); const base = dealt(cast(a.rt, QUICK));
    const b = build(model, [QUICK, "pd_swords"]); const e = cast(b.rt, "pd_swords"); const after = dealt(cast(b.rt, QUICK));
    console.log("attack+2 → 물리 피해", base, "→", after, "| 문장:", e.find((x: any) => x.statStage)?.message, "| snapshot:", JSON.stringify(b.rt.snapshot().actors[0].statStages)); }
  { const a = build(model, [SPARK]); const base = dealt(cast(a.rt, SPARK));
    const b = build(model, [SPARK, "pd_cosmic"]); cast(b.rt, "pd_cosmic"); const after = dealt(cast(b.rt, SPARK));
    console.log("spAttack+2 → 특수 피해", base, "→", after); }
  { const a = build(model, [QUICK], 11); const first = enemyDealt(cast(a.rt, QUICK));
    const b = build(model, [QUICK, "pd_growl"], 11); cast(b.rt, "pd_growl"); const second = enemyDealt(cast(b.rt, QUICK));
    console.log("울음(적 attack −1) → 적이 주는 피해", first, "→", second, "| 적 stages:", JSON.stringify(b.rt.snapshot().enemies[0].statStages)); }
  { const b = build(model, ["pd_harden"]); cast(b.rt, "pd_harden"); const e = cast(b.rt, "pd_harden");
    console.log("방어 +6 뒤 한 번 더:", e.find((x: any) => x.statStage)?.message, "| stages:", JSON.stringify(b.rt.snapshot().actors[0].statStages)); }
  { let hits = 0; const N = Number(process.env.N ?? 80);
    for (let i = 0; i < N; i++) {
      const b = build(model, [SPARK, "pd_smoke"], 100 + i);
      cast(b.rt, "pd_smoke");
      if (cast(b.rt, SPARK).some((e: any) => e.side === "actor" && e.kind === "damage")) hits++;
    }
    console.log(`명중 −6 → SPARK 적중 ${(hits / N * 100).toFixed(0)}% (단계 0 이면 100%)`); }
  { // 교체 초기화: 파티 2마리, 칼춤 뒤 교체
    const project: any = structuredClone(BASE); if (model === "rm2k3") delete project.system.battleModel;
    addSkill(project, { id: "pd_swords", name: "칼춤", scope: "self", statStageEffects: [{ stat: "attack", stages: 2 }] });
    const rt: any = createBattleRuntime({ project, troopId: "troop_pkmn_grass_a", canEscape: true, canLose: true, battleFlow: "strict", partyMonsters: [mon("m1", ["pd_swords"]), mon("m2", [QUICK])], sessionState: { switches: {}, variables: {}, inventory: {} }, rng: prng(5) } as any);
    rt.performActorCommand({ kind: "skill", skillId: "pd_swords", targetEnemyId: "enemy-1", targetActorId: "m1" });
    const before = JSON.stringify(rt.snapshot().actors[0].statStages);
    try { rt.performActorCommand({ kind: "switch", targetActorId: "m2" }); } catch (e: any) { console.log("switch err", e.message); }
    const snap = rt.snapshot();
    console.log("교체 전 m1 stages", before, "→ 교체 후", snap.actors.map((a: any) => `${a.recordId}:${JSON.stringify(a.statStages)}`).join(" "));
  }
}
process.exit(0);
