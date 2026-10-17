// poke-depth PR3 probe: 특성(ability) 일곱 종류가 실제 gen1 전투 엔진에서 먹는지 잰다.
//   bun scripts/qa/poke-depth/abilities.probe.mts
import { createBattleRuntime } from "../../../src/battle/runtime";
import { createScarloxyPokemonDemoProject } from "../../../test/support/scarloxyPokemonProject";
import { scarloxySpeciesId } from "../../../src/project/defaults/scarloxyPokemonDemoGame";

const prng = (seed: number) => { let sd = seed >>> 0; return () => { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return ((sd >>> 8) & 0xffff) / 65536; }; };
const SP = scarloxySpeciesId("sparchu");
const mon = (id: string, skillIds: string[], hp?: number) => ({ instanceId: id, speciesId: SP, level: 50, exp: 0, skillIds, skillPp: Object.fromEntries(skillIds.map((s) => [s, 30])), friendship: 70, caughtAt: { mapId: "map_pkmn_town", x: 1, y: 1 }, ...(hp ? { hp } : {}) });
const BASE: any = createScarloxyPokemonDemoProject();
const QUICK = "skill_scarloxy_quick", SPARK = "skill_scarloxy_spark";
const skill = (id: string) => BASE.database.skills.find((s: any) => s.id === id);
console.log("QUICK element", skill(QUICK).elementId, "stat", skill(QUICK).effect.statistic, "| SPARK element", skill(SPARK).elementId, "stat", skill(SPARK).effect.statistic);

type Setup = { enemyAbility?: any; playerAbility?: any; enemyHp?: number; enemyTypes?: string[]; skills?: string[]; seed?: number; tweak?: (p: any) => void };
function build(s: Setup) {
  const project: any = structuredClone(BASE);
  const enemy = project.database.enemies.find((r: any) => r.id === "enemy_pkmn_larvea");
  const enemySpecies = project.database.monsterSpecies.find((r: any) => r.id === enemy.speciesId);
  enemySpecies.types = s.enemyTypes ?? ["normal"];
  if (s.enemyAbility) enemySpecies.ability = s.enemyAbility;
  if (s.playerAbility) project.database.monsterSpecies.find((r: any) => r.id === SP).ability = s.playerAbility;
  enemy.stats = { ...enemy.stats, maxHp: s.enemyHp ?? 400, attack: 40, defense: 40, mind: 40, agility: 1 };
  enemy.actions = [{ skillId: "skill_scarloxy_scratch", priority: 5, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }];
  s.tweak?.(project);
  const rt: any = createBattleRuntime({ project, troopId: "troop_pkmn_grass_a", canEscape: true, canLose: true, battleFlow: "strict", partyMonsters: [mon("m1", s.skills ?? [QUICK, SPARK])], sessionState: { switches: {}, variables: {}, inventory: {} }, rng: prng(s.seed ?? 3) } as any);
  return rt;
}
const cast = (rt: any, skillId: string) => { const n = rt.snapshot().timeline.length; rt.performActorCommand({ kind: "skill", skillId, targetEnemyId: "enemy-1" }); return rt.snapshot().timeline.slice(n); };
const dealt = (entries: any[]) => entries.find((e) => e.kind === "damage" && e.side === "actor")?.amount ?? 0;
const specials = (entries: any[]) => entries.filter((e) => e.kind === "special").map((e) => e.message);
const moveType = skill(QUICK).elementId;

{ const base = dealt(cast(build({}), QUICK));
  const rt = build({ enemyAbility: { name: "부양", kind: "immuneType", type: moveType } }); const e = cast(rt, QUICK);
  console.log(`1 immuneType(${moveType}): 피해 ${base} → ${dealt(e)} | miss=${e.some((x: any) => x.kind === "miss")} | 줄:`, JSON.stringify(specials(e))); }
{ // 흡수: 전기 기술을 흡수해 회복한다. 먼저 노말 기술로 깎고 → 전기 기술(SPARK)을 맞힌다.
  const rt = build({ enemyAbility: { name: "축전", kind: "immuneType", type: skill(SPARK).elementId, healPercent: 25 }, enemyHp: 100 });
  cast(rt, QUICK); const hurt = rt.snapshot().enemies[0].hp;
  const e = cast(rt, SPARK); const after = rt.snapshot().enemies[0].hp;
  console.log(`2 흡수(전기 25%): 적 HP ${hurt} → ${after} | 줄:`, JSON.stringify(specials(e)), "| heal 엔트리:", JSON.stringify(e.filter((x: any) => x.aside === "drain").map((x: any) => ({ k: x.kind, a: x.amount, t: x.targetId })))); }
{ const base = dealt(cast(build({}), QUICK));
  const half = dealt(cast(build({ enemyAbility: { name: "두꺼운지방", kind: "resistType", type: moveType, percent: 50 } }), QUICK));
  console.log(`3 resistType 50%: 피해 ${base} → ${half} (≈${(half / base * 100).toFixed(0)}%)`); }
{ const base = dealt(cast(build({}), QUICK));
  // 플레이어 HP 를 1/3 이하로 만들려면 적이 먼저 때려야 한다 — 적 공격력을 키워 플레이어를 깎은 뒤 비교한다.
  const hurt = build({ playerAbility: { name: "기세", kind: "boostLowHp", type: moveType, percent: 150 }, tweak: (p) => { const e = p.database.enemies.find((r: any) => r.id === "enemy_pkmn_larvea"); e.stats.attack = 160; e.stats.agility = 255; } });
  const first = cast(hurt, "skill_scarloxy_scratch" in {} ? QUICK : QUICK);
  const snap = hurt.snapshot().actors[0];
  const nobuff = build({ tweak: (p) => { const e = p.database.enemies.find((r: any) => r.id === "enemy_pkmn_larvea"); e.stats.attack = 160; e.stats.agility = 255; } });
  cast(nobuff, QUICK);
  console.log(`4 boostLowHp: 플레이어 HP ${snap.hp}/${snap.maxHp} 에서 피해 ${dealt(first)} (특성 없음 기준 같은 상황은 아래)`);
  const a: number[] = [], b: number[] = [];
  for (let i = 0; i < 6; i++) { a.push(dealt(cast(hurt, QUICK))); b.push(dealt(cast(nobuff, QUICK))); if (hurt.snapshot().actors[0].hp <= 0 || nobuff.snapshot().actors[0].hp <= 0) break; }
  console.log("   저HP 라운드별 피해(특성) ", a.join(","), "| (없음)", b.join(",")); }
{ const rt = build({ enemyAbility: { name: "활력", kind: "immuneStatus", status: "paralysis" }, tweak: (p) => { const sp = p.database.skills.find((s: any) => s.id === SPARK); sp.stateEffects = [{ stateId: "state_paralysis", chance: 100, operation: "add" }]; } });
  const e = cast(rt, SPARK);
  console.log("5 immuneStatus(마비): 적 stateIds", JSON.stringify(rt.snapshot().enemies[0].stateIds), "| 줄:", JSON.stringify(specials(e))); }
{ const rt = build({ playerAbility: { name: "정전기", kind: "contactStatus", status: "paralysis", percent: 100 }, tweak: (p) => { const e = p.database.enemies.find((r: any) => r.id === "enemy_pkmn_larvea"); e.stats.agility = 255; } });
  const e = cast(rt, QUICK);
  console.log("6 contactStatus(마비 100%): 공격한 적 stateIds", JSON.stringify(rt.snapshot().enemies[0].stateIds), "| 줄:", JSON.stringify(specials(e)), "| scratch 요소:", skill("skill_scarloxy_scratch").elementId); }
{ const base = dealt(cast(build({}), QUICK));
  const big = dealt(cast(build({ playerAbility: { name: "천하장사", kind: "statMultiplier", stat: "attack", percent: 200 } }), QUICK));
  const tough = dealt(cast(build({ enemyAbility: { name: "단단한몸", kind: "statMultiplier", stat: "defense", percent: 200 } }), QUICK));
  console.log(`7 statMultiplier: 공격 ×2 → 피해 ${base} → ${big} | 상대 방어 ×2 → ${tough}`); }
{ const rt = build({ enemyAbility: { name: "근성", kind: "endure" }, enemyHp: 3 });
  const e = cast(rt, QUICK); const s = rt.snapshot().enemies[0];
  console.log(`8 endure: 적 최대 HP 3 이 한 방에 → 남은 HP ${s.hp} | 줄:`, JSON.stringify(specials(e)), "| 두 번째 타격 후 HP:", (() => { cast(rt, QUICK); return rt.snapshot().enemies[0].hp; })()); }
process.exit(0);
