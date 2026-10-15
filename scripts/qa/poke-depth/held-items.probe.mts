// poke-depth PR4 probe: 지닌 도구 다섯 효과가 실제 gen1 전투 엔진에서 먹는지 잰다.
//   bun scripts/qa/poke-depth/held-items.probe.mts
import { createBattleRuntime } from "../../../src/battle/runtime";
import { createScarloxyPokemonDemoProject } from "../../../test/support/scarloxyPokemonProject";
import { scarloxySpeciesId } from "../../../src/project/defaults/scarloxyPokemonDemoGame";
import { normalizeItemRecord } from "../../../src/project/databaseRecordModel";

const prng = (seed: number) => { let sd = seed >>> 0; return () => { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return ((sd >>> 8) & 0xffff) / 65536; }; };
const SP = scarloxySpeciesId("sparchu");
const BASE: any = createScarloxyPokemonDemoProject();
const QUICK = "skill_scarloxy_quick", SPARK = "skill_scarloxy_spark";
const skill = (id: string) => BASE.database.skills.find((s: any) => s.id === id);
const ITEMS: Record<string, any> = {
  berry: { id: "h_berry", name: "회복 열매", heldEffect: { kind: "healBelow", thresholdPercent: 50, healPercent: 50 } },
  cure: { id: "h_cure", name: "해독 열매", heldEffect: { kind: "cureStatus", status: "poison" } },
  boost: { id: "h_boost", name: "강화 부적", heldEffect: { kind: "boostType", type: skill(QUICK).elementId, percent: 150 } },
  sash: { id: "h_sash", name: "끈기 띠", heldEffect: { kind: "endureOnce" } },
  leftovers: { id: "h_left", name: "남은 먹이", heldEffect: { kind: "regen", percent: 10 } },
};
function build(opts: { player?: string; enemy?: string; enemyHp?: number; enemyAttack?: number; playerHp?: number; level?: number; tweak?: (p: any) => void; seed?: number }) {
  const project: any = structuredClone(BASE);
  for (const item of Object.values(ITEMS)) project.database.items.push(normalizeItemRecord({ ...item, type: "normalGoods", occasion: "field", scope: "none" }));
  const enemy = project.database.enemies.find((r: any) => r.id === "enemy_pkmn_larvea");
  project.database.monsterSpecies.find((r: any) => r.id === enemy.speciesId).types = ["normal"];
  enemy.stats = { ...enemy.stats, maxHp: opts.enemyHp ?? 400, attack: opts.enemyAttack ?? 40, defense: 40, mind: 40, agility: 1 };
  enemy.actions = [{ skillId: "skill_scarloxy_scratch", priority: 5, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }];
  if (opts.enemy) enemy.heldItemId = opts.enemy; // (적은 지니지 않는다 — 무시되는지 확인)
  opts.tweak?.(project);
  const mon = { instanceId: "m1", speciesId: SP, level: opts.level ?? 50, exp: 0, skillIds: [QUICK, SPARK], skillPp: { [QUICK]: 30, [SPARK]: 30 }, friendship: 70, caughtAt: { mapId: "map_pkmn_town", x: 1, y: 1 }, ...(opts.player ? { heldItemId: opts.player } : {}), ...(opts.playerHp ? { hp: opts.playerHp } : {}) };
  return createBattleRuntime({ project, troopId: "troop_pkmn_grass_a", canEscape: true, canLose: true, battleFlow: "strict", partyMonsters: [mon], sessionState: { switches: {}, variables: {}, inventory: {} }, rng: prng(opts.seed ?? 3) } as any) as any;
}
const cast = (rt: any, skillId: string) => { const n = rt.snapshot().timeline.length; rt.performActorCommand({ kind: "skill", skillId, targetEnemyId: "enemy-1" }); return rt.snapshot().timeline.slice(n); };
const dealt = (entries: any[]) => entries.find((e) => e.kind === "damage" && e.side === "actor")?.amount ?? 0;
const specials = (entries: any[]) => entries.filter((e) => e.kind === "special").map((e) => e.message);
const me = (rt: any) => rt.snapshot().actors[0];

{ const a = dealt(cast(build({}), QUICK)), b = dealt(cast(build({ player: "h_boost" }), QUICK)), c = dealt(cast(build({ player: "h_boost" }), SPARK)), d = dealt(cast(build({}), SPARK));
  console.log(`1 boostType(${skill(QUICK).elementId} 150%): 같은 타입 ${a} → ${b} | 다른 타입 ${d} → ${c}`); }
{ const rt = build({ player: "h_berry", enemyAttack: 160, seed: 5 }); const hp0 = me(rt).maxHp; const out: any[] = [];
  for (let i = 0; i < 4 && me(rt).hp > 0; i++) { const e = cast(rt, QUICK); out.push({ hp: me(rt).hp, held: me(rt).heldItemId ?? null, lines: specials(e).filter((x: string) => /열매|먹/.test(x)) }); }
  console.log(`2 healBelow: 최대 HP ${hp0}`, JSON.stringify(out)); }
{ const rt = build({ player: "h_cure", tweak: (p) => { const sc = p.database.skills.find((s: any) => s.id === "skill_scarloxy_scratch"); sc.stateEffects = [{ stateId: "state_poison", chance: 100, operation: "add" }]; } });
  const out: any[] = []; for (let i = 0; i < 3 && me(rt).hp > 0; i++) { const e = cast(rt, QUICK); out.push({ states: me(rt).stateIds, held: me(rt).heldItemId ?? null, lines: specials(e).filter((x: string) => /열매|나았/.test(x)) }); }
  console.log("3 cureStatus(독):", JSON.stringify(out)); }
const frail = (p: any) => { p.database.monsterSpecies.find((r: any) => r.id === SP).baseStats.maxHp = 10; };
{ const noSash = build({ enemyAttack: 255, level: 5, tweak: frail }); cast(noSash, QUICK);
  const rt = build({ player: "h_sash", enemyAttack: 255, level: 5, tweak: frail }); const out: any[] = [];
  for (let i = 0; i < 3 && me(rt).hp > 0; i++) { const e = cast(rt, QUICK); out.push({ hp: me(rt).hp, held: me(rt).heldItemId ?? null, lines: specials(e).filter((x: string) => /버텼/.test(x)) }); }
  console.log(`4 endureOnce: (없음) 1타 후 HP ${me(noSash).hp}/${me(noSash).maxHp}`, "| (끈기 띠)", JSON.stringify(out)); }
{ const rt = build({ player: "h_left", enemyAttack: 70 }); const out: number[] = [];
  for (let i = 0; i < 4 && me(rt).hp > 0; i++) { cast(rt, QUICK); out.push(me(rt).hp); }
  const base = build({ enemyAttack: 70 }); const ob: number[] = []; for (let i = 0; i < 4 && me(base).hp > 0; i++) { cast(base, QUICK); ob.push(me(base).hp); }
  console.log("5 regen 10%: HP 추이(먹이)", out.join(","), "| (없음)", ob.join(",")); }
{ const rt = build({ enemy: "h_boost" }); console.log("6 적 heldItemId 무시:", dealt(cast(rt, QUICK)) > 0); }
process.exit(0);
