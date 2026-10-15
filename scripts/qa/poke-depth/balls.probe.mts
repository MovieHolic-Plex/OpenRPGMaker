// poke-depth PR6 probe: 조건부 볼(그물·퀵·타이머·리피트)이 실제 gen1 포획 계산에 먹는지 잰다.
//   bun scripts/qa/poke-depth/balls.probe.mts
import { createBattleRuntime } from "../../../src/battle/runtime";
import { createScarloxyPokemonDemoProject } from "../../../test/support/scarloxyPokemonProject";
import { scarloxySpeciesId } from "../../../src/project/defaults/scarloxyPokemonDemoGame";
import { normalizeItemRecord } from "../../../src/project/databaseRecordModel";

const prng = (seed: number) => { let sd = seed >>> 0; return () => { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return ((sd >>> 8) & 0xffff) / 65536; }; };
const SP = scarloxySpeciesId("sparchu");
const BASE: any = createScarloxyPokemonDemoProject();
const QUICK = "skill_scarloxy_quick";
const BALLS: Record<string, any> = {
  plain: { id: "b_plain", name: "기본 구슬", captureProfile: { multiplier: 1, ballClass: "poke" } },
  net: { id: "b_net", name: "그물 구슬", captureProfile: { multiplier: 1, ballClass: "poke", condition: { kind: "type", types: ["normal"], multiplier: 3.5 } } },
  netMiss: { id: "b_netmiss", name: "그물(불)", captureProfile: { multiplier: 1, ballClass: "poke", condition: { kind: "type", types: ["fire"], multiplier: 3.5 } } },
  quick: { id: "b_quick", name: "신속 구슬", captureProfile: { multiplier: 1, ballClass: "poke", condition: { kind: "firstTurn", multiplier: 5 } } },
  timer: { id: "b_timer", name: "경과 구슬", captureProfile: { multiplier: 1, ballClass: "poke", condition: { kind: "turns", multiplier: 4, step: 0.5 } } },
  repeat: { id: "b_repeat", name: "재회 구슬", captureProfile: { multiplier: 1, ballClass: "poke", condition: { kind: "repeat", multiplier: 3.5 } } },
};
function build(opts: { caught?: boolean; seed?: number }) {
  const project: any = structuredClone(BASE);
  for (const ball of Object.values(BALLS)) project.database.items.push(normalizeItemRecord({ ...ball, type: "special", scope: "enemy", occasion: "battle", occasionBattle: true, consumable: true }));
  const enemy = project.database.enemies.find((r: any) => r.id === "enemy_pkmn_larvea");
  const species = project.database.monsterSpecies.find((r: any) => r.id === enemy.speciesId);
  species.types = ["normal"]; species.captureRate = 0.2;
  enemy.stats = { ...enemy.stats, maxHp: 400, attack: 1, defense: 40, mind: 40, agility: 1 };
  enemy.actions = [{ skillId: "skill_scarloxy_scratch", priority: 5, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }];
  const mon = { instanceId: "m1", speciesId: SP, level: 50, exp: 0, skillIds: [QUICK], skillPp: { [QUICK]: 30 }, friendship: 70, caughtAt: { mapId: "map_pkmn_town", x: 1, y: 1 } };
  const inventory = Object.fromEntries(Object.values(BALLS).map((b) => [b.id, 9]));
  const switches = opts.caught ? { [`mx_caught_${species.id}`]: true } : {};
  return createBattleRuntime({ project, troopId: "troop_pkmn_grass_a", canEscape: true, canLose: true, battleFlow: "strict", partyMonsters: [mon], sessionState: { switches, variables: {}, inventory }, rng: prng(opts.seed ?? 3) } as any) as any;
}
const throwBall = (rt: any, id: string) => {
  const n = rt.snapshot().timeline.length;
  rt.performActorCommand({ kind: "capture", captureItemId: id, targetEnemyId: "enemy-1" });
  const snap = rt.snapshot();
  return { rate: snap.lastCaptureResult?.rate as number | undefined, lines: snap.timeline.slice(n).filter((e: any) => e.kind === "special").map((e: any) => e.message), turn: snap.turn };
};
const idle = (rt: any, times: number) => { for (let i = 0; i < times; i++) rt.performActorCommand({ kind: "defend" }); };
const pct = (x: number | undefined) => (x === undefined ? "?" : `${(x * 100).toFixed(1)}%`);

const base = throwBall(build({}), "b_plain").rate;
console.log("기준(기본 구슬) 포획률", pct(base));
{ const r = throwBall(build({}), "b_net"); console.log(`1 그물(대상 노말 ∈ types): ${pct(r.rate)} 줄 ${JSON.stringify(r.lines)}`);
  const m = throwBall(build({}), "b_netmiss"); console.log(`  그물(불 전용, 대상 노말): ${pct(m.rate)} 줄 ${JSON.stringify(m.lines)} (기준과 같아야 함)`); }
{ const first = throwBall(build({}), "b_quick"); console.log(`2 퀵 첫 차례(턴 ${first.turn}): ${pct(first.rate)} 줄 ${JSON.stringify(first.lines)}`);
  const rt = build({}); idle(rt, 1);
  const plainLater = throwBall(rt, "b_plain").rate;
  const rt2 = build({}); idle(rt2, 1); const later = throwBall(rt2, "b_quick");
  console.log(`  퀵 둘째 차례(턴 ${later.turn}): ${pct(later.rate)} 줄 ${JSON.stringify(later.lines)} | 같은 상태의 기본 구슬 ${pct(plainLater)} (같아야 함)`); }
{ const out: string[] = [];
  for (let i = 0; i < 4; i++) { const rt = build({}); idle(rt, i); const plain = throwBall(build({}), "b_plain").rate; void plain; const r = throwBall(rt, "b_timer"); out.push(`${i}턴 후 ${pct(r.rate)}`); }
  console.log("3 타이머(+0.5/턴, 최대 ×4):", out.join(" | ")); }
{ const a = throwBall(build({ caught: false }), "b_repeat"), b = throwBall(build({ caught: true }), "b_repeat");
  console.log(`4 리피트: 도감에 없음 ${pct(a.rate)} | 도감에 있음 ${pct(b.rate)} 줄 ${JSON.stringify(b.lines)}`); }
process.exit(0);
