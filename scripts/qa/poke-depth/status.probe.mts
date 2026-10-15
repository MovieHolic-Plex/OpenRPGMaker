// poke-depth PR2 probe: 맹독(차례마다 커지는 독)·혼란(휘발 상태, 절반 자해)이 실제 gen1 전투 엔진에서 도는지 잰다.
//   bun scripts/qa/poke-depth/status.probe.mts
import { createBattleRuntime } from "../../../src/battle/runtime";
import { createScarloxyPokemonDemoProject } from "../../../test/support/scarloxyPokemonProject";
import { scarloxySpeciesId } from "../../../src/project/defaults/scarloxyPokemonDemoGame";
import { normalizeSkillRecord } from "../../../src/project/databaseRecordModel";

const prng = (seed: number) => { let sd = seed >>> 0; return () => { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return ((sd >>> 8) & 0xffff) / 65536; }; };
const SP = scarloxySpeciesId("sparchu");
const mon = (id: string, skillIds: string[]) => ({ instanceId: id, speciesId: SP, level: 50, exp: 0, skillIds, skillPp: Object.fromEntries(skillIds.map((s) => [s, 30])), friendship: 70, caughtAt: { mapId: "map_pkmn_town", x: 1, y: 1 } });
const addSkill = (p: any, s: any) => p.database.skills.push(normalizeSkillRecord({ id: s.id, name: s.name, scope: s.scope ?? "enemy", power: 0, animationId: "anim_magic", description: "x", type: "normal", mpCost: { flat: 0, percentMax: 0 }, successRate: 100, variance: 0, hitRate: 100, effect: { kind: "support" }, maxPp: 30, stateEffects: s.stateEffects } as any));
const BASE: any = createScarloxyPokemonDemoProject();
const stateOf = (id: string) => BASE.database.states.find((s: any) => s.id === id);
console.log("states:", ["state_toxic", "state_confusion"].map((id) => `${id}=${JSON.stringify({ m: stateOf(id)?.gen1MajorStatus, v: stateOf(id)?.volatileStatus })}`).join(" "));

function build(enemyTweak: (e: any) => void, seed: number, party = [mon("m1", ["pd_toxic", "pd_confuse", "pd_wait"])]) {
  const project: any = structuredClone(BASE);
  const enemy = project.database.enemies.find((r: any) => r.id === "enemy_pkmn_larvea");
  enemy.stats = { ...enemy.stats, maxHp: 400, attack: 40, defense: 40, mind: 40, agility: 1 };
  enemy.actions = [{ skillId: "skill_scarloxy_scratch", priority: 5, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }];
  const species = project.database.monsterSpecies.find((r: any) => r.id === enemy.speciesId);
  species.types = ["normal"]; // 독 타입이면 맹독이 막히므로 기본은 노말
  enemyTweak(enemy, species);
  addSkill(project, { id: "pd_toxic", name: "맹독", stateEffects: [{ stateId: "state_toxic", chance: 100, operation: "add" }] });
  addSkill(project, { id: "pd_confuse", name: "초음파", stateEffects: [{ stateId: "state_confusion", chance: 100, operation: "add" }] });
  addSkill(project, { id: "pd_wait", name: "지켜보기", scope: "self" });
  const rt: any = createBattleRuntime({ project, troopId: "troop_pkmn_grass_a", canEscape: true, canLose: true, battleFlow: "strict", partyMonsters: party, sessionState: { switches: {}, variables: {}, inventory: {} }, rng: prng(seed) } as any);
  return { project, rt };
}
const cast = (rt: any, skillId: string) => {
  const before = rt.snapshot().timeline.length;
  rt.performActorCommand({ kind: "skill", skillId, targetEnemyId: "enemy-1", ...(skillId === "pd_wait" ? { targetActorId: rt.snapshot().actors[0].recordId } : {}) } as any);
  return rt.snapshot().timeline.slice(before);
};

{ // 맹독: 적에게 걸고 여러 차례 — 틱이 1/16, 2/16, 3/16 … 로 커진다.
  const { rt } = build(() => {}, 7);
  const first = cast(rt, "pd_toxic");
  const ticks: number[] = [];
  const log = (entries: any[]) => entries.filter((e) => e.kind === "stateUpkeep" && e.side === "enemy").forEach((e) => ticks.push(e.amount));
  log(first);
  for (let i = 0; i < 5; i++) log(cast(rt, "pd_wait"));
  const maxHp = rt.snapshot().enemies[0].maxHp;
  console.log(`맹독 틱(최대HP ${maxHp}, 1/16=${Math.floor(maxHp / 16)}):`, ticks.join(", "));
}
{ // 보통 독과 비교는 같은 틱이 반복(고정 1/16): state_poison
  const project: any = structuredClone(BASE);
  const poison = project.database.states.find((s: any) => s.id === "state_poison");
  console.log("state_poison 종류:", poison.gen1MajorStatus);
}
{ // 독 타입에는 맹독이 안 걸린다.
  const { rt } = build((_e, sp) => { sp.types = ["poison"]; }, 7);
  const e = cast(rt, "pd_toxic");
  console.log("독 타입 대상 맹독:", e.some((x: any) => x.kind === "stateAdded") ? "걸림(문제)" : "막힘(정상)", "");
}
{ // 혼란: 적이 건다(첫 에피소드만 잰다) — 걸린 뒤 풀릴 때까지 플레이어 행동 수(2~5 안), 그 중 자해 비율(≈절반).
  const durations: Record<number, number> = {}; let confusedActions = 0, selfHits = 0, example = ""; const N = Number(process.env.N ?? 60);
  for (let i = 0; i < N; i++) {
    const project: any = structuredClone(BASE);
    const enemy = project.database.enemies.find((r: any) => r.id === "enemy_pkmn_larvea");
    project.database.monsterSpecies.find((r: any) => r.id === enemy.speciesId).types = ["normal"];
    enemy.stats = { ...enemy.stats, maxHp: 9999, attack: 1, defense: 40, mind: 40, agility: 255 };
    addSkill(project, { id: "pd_confuse_foe", name: "초음파", stateEffects: [{ stateId: "state_confusion", chance: 100, operation: "add" }] });
    addSkill(project, { id: "pd_wait", name: "지켜보기", scope: "self" });
    enemy.actions = [{ skillId: "pd_confuse_foe", priority: 5, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }];
    const rt: any = createBattleRuntime({ project, troopId: "troop_pkmn_grass_a", canEscape: true, canLose: true, battleFlow: "strict", partyMonsters: [mon("m1", ["skill_scarloxy_quick", "pd_wait"])], sessionState: { switches: {}, variables: {}, inventory: {} }, rng: prng(1000 + i) } as any);
    let addRound = -1, done = false;
    for (let t = 0; t < 14 && !done; t++) {
      const entries = cast(rt, "pd_wait"); // 플레이어는 매 라운드 제자리 — 혼란이 걸린 라운드 수를 센다
      if (addRound < 0 && entries.some((e: any) => e.kind === "stateAdded" && e.stateId === "state_confusion")) addRound = t;
      if (addRound >= 0) {
        const hit = entries.find((e: any) => e.kind === "stateUpkeep" && e.side === "actor" && e.message?.includes("혼란"));
        if (hit) { selfHits++; if (!example) example = `${hit.message} (피해 ${hit.amount})`; }
        if (addRound >= 0 && !entries.some((e: any) => e.kind === "stateRemoved" && e.stateId === "state_confusion")) confusedActions++;
        else if (addRound >= 0) { confusedActions++; const n = t - addRound + 1; durations[n] = (durations[n] ?? 0) + 1; done = true; }
      }
    }
  }
  console.log(`혼란: 풀릴 때까지 행동 수 분포 ${JSON.stringify(durations)} (2~5 기대) | 혼란 걸린 라운드 ${confusedActions}회 중 자해 ${selfHits}회 | 예: ${example}`);
}
process.exit(0);
