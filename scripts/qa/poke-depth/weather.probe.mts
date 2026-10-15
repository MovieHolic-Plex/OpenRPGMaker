// poke-depth PR5 probe: 날씨(쾌청·비·모래바람·싸라기눈)가 실제 gen1 전투 엔진에서 먹는지 잰다.
//   bun scripts/qa/poke-depth/weather.probe.mts
import { createBattleRuntime } from "../../../src/battle/runtime";
import { createScarloxyPokemonDemoProject } from "../../../test/support/scarloxyPokemonProject";
import { scarloxySpeciesId } from "../../../src/project/defaults/scarloxyPokemonDemoGame";
import { normalizeSkillRecord } from "../../../src/project/databaseRecordModel";

const prng = (seed: number) => { let sd = seed >>> 0; return () => { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return ((sd >>> 8) & 0xffff) / 65536; }; };
const SP = scarloxySpeciesId("sparchu");
const BASE: any = createScarloxyPokemonDemoProject();
const EMBER = "skill_scarloxy_ember", SPLASH = "skill_scarloxy_splash", QUICK = "skill_scarloxy_quick";
const WEATHER_SKILLS: Record<string, any> = {
  sun: { id: "sk_sun", name: "쾌청 부름", scope: "self", power: 0, effect: { kind: "support" }, weather: { kind: "sun" }, maxPp: 10 },
  rain: { id: "sk_rain", name: "비 부름", scope: "self", power: 0, effect: { kind: "support" }, weather: { kind: "rain" }, maxPp: 10 },
  sand: { id: "sk_sand", name: "모래바람 부름", scope: "self", power: 0, effect: { kind: "support" }, weather: { kind: "sandstorm", turns: 3 }, maxPp: 10 },
  hail: { id: "sk_hail", name: "싸라기눈 부름", scope: "self", power: 0, effect: { kind: "support" }, weather: { kind: "hail", turns: 3 }, maxPp: 10 },
};
function build(opts: { weatherSkill?: string; enemyTypes?: string[]; playerTypes?: string[]; seed?: number }) {
  const project: any = structuredClone(BASE);
  for (const w of Object.values(WEATHER_SKILLS)) project.database.skills.push(normalizeSkillRecord(w));
  const enemy = project.database.enemies.find((r: any) => r.id === "enemy_pkmn_larvea");
  project.database.monsterSpecies.find((r: any) => r.id === enemy.speciesId).types = opts.enemyTypes ?? ["normal"];
  if (opts.playerTypes) project.database.monsterSpecies.find((r: any) => r.id === SP).types = opts.playerTypes;
  enemy.stats = { ...enemy.stats, maxHp: 600, attack: 1, defense: 40, mind: 40, agility: 1 };
  enemy.actions = [{ skillId: "skill_scarloxy_scratch", priority: 5, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }];
  // 기술은 네 칸까지 — 날씨 기술 하나만 싣는다(기본 쾌청).
  const skillIds = [EMBER, SPLASH, QUICK, opts.weatherSkill ?? "sk_sun"];
  const mon = { instanceId: "m1", speciesId: SP, level: 50, exp: 0, skillIds, skillPp: Object.fromEntries(skillIds.map((s) => [s, 30])), friendship: 70, caughtAt: { mapId: "map_pkmn_town", x: 1, y: 1 } };
  return createBattleRuntime({ project, troopId: "troop_pkmn_grass_a", canEscape: true, canLose: true, battleFlow: "strict", partyMonsters: [mon], sessionState: { switches: {}, variables: {}, inventory: {} }, rng: prng(opts.seed ?? 3) } as any) as any;
}
const cast = (rt: any, skillId: string, target = "enemy-1") => { const n = rt.snapshot().timeline.length; rt.performActorCommand({ kind: "skill", skillId, ...(skillId.startsWith("sk_") ? { targetActorId: "actor_hero" } : { targetEnemyId: target }) }); return rt.snapshot().timeline.slice(n); };
const dealt = (entries: any[]) => entries.find((e) => e.kind === "damage" && e.side === "actor")?.amount ?? 0;
const specials = (entries: any[]) => entries.filter((e) => e.kind === "special").map((e) => e.message);
const w = (rt: any) => rt.snapshot().weather ?? null;

const actorId = (rt: any) => rt.snapshot().actors[0].recordId;
{ const fire = dealt(cast(build({}), EMBER)), water = dealt(cast(build({}), SPLASH));
  const sunRt = build({ weatherSkill: "sk_sun" }); const startLines = specials(cast(sunRt, "sk_sun"));
  const fireSun = dealt(cast(sunRt, EMBER)), waterSun = dealt(cast(sunRt, SPLASH));
  console.log(`1 쾌청: weather ${JSON.stringify(w(sunRt))} 줄 ${JSON.stringify(startLines)} | 불 ${fire} → ${fireSun} (×1.5) | 물 ${water} → ${waterSun} (×0.5)`);
  const rainRt = build({ weatherSkill: "sk_rain" }); cast(rainRt, "sk_rain");
  console.log(`2 비: 불 ${fire} → ${dealt(cast(rainRt, EMBER))} (×0.5) | 물 ${water} → ${dealt(cast(rainRt, SPLASH))} (×1.5)`); }
{ const rt = build({ weatherSkill: "sk_sun" }); cast(rt, "sk_sun"); const again = specials(cast(rt, "sk_sun")); console.log("3 같은 날씨 다시:", JSON.stringify(again), "| 아직", JSON.stringify(w(rt))); }
{ // 모래바람: 노말 두 마리는 맞고(피해), 바위 적은 안 맞는다. 3차례 후 종료.
  const rt = build({ enemyTypes: ["normal"], weatherSkill: "sk_sand" }); cast(rt, "sk_sand");
  const trace: any[] = [];
  for (let i = 0; i < 4; i++) { const e = cast(rt, QUICK); const upkeep = e.filter((x: any) => x.kind === "stateUpkeep" && x.weatherKind); trace.push({ round: i + 1, weather: w(rt), 피해: upkeep.map((x: any) => `${x.side}:${x.amount}`), 줄: specials(e).filter((m: string) => /모래/.test(m)) }); }
  console.log("4 모래바람(턴 수 3):", JSON.stringify(trace)); }
{ const rt = build({ enemyTypes: ["rock"], playerTypes: ["ground"], weatherSkill: "sk_sand" }); cast(rt, "sk_sand"); const e = cast(rt, QUICK);
  console.log("5 면역(바위·땅):", JSON.stringify(e.filter((x: any) => x.kind === "stateUpkeep").map((x: any) => `${x.side}:${x.amount}`)), "(없어야 함)"); }
{ const rt = build({ enemyTypes: ["ice"], weatherSkill: "sk_hail" }); cast(rt, "sk_hail"); const e = cast(rt, QUICK);
  console.log("6 싸라기눈(적 얼음·아군 노말):", JSON.stringify(e.filter((x: any) => x.kind === "stateUpkeep").map((x: any) => `${x.side}:${x.amount}`)), "→ 아군만 피해") }
{ const rt = build({ weatherSkill: "sk_rain" }); cast(rt, "sk_rain"); rt.snapshot(); console.log("7 (비 후)", JSON.stringify(w(rt)));
  const rt2 = build({ weatherSkill: "sk_sun" }); cast(rt2, "sk_sun"); console.log("7 쾌청", JSON.stringify(w(rt2))); }
process.exit(0);
