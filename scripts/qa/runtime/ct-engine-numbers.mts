// Chrono Trigger 전투 엔진 헤드리스 증거: 스톱·버서크·프로텍트/실드·상태 속성 덮어쓰기·행동 moveTo 를 숫자로 본다.
// ct-engine 픽스처 위에 runTool 로만 상태·스킬·적·트룹을 덧댄다. simulate_battle 로 전투 요약을 받고,
// 같은 createBattleRuntime 을 같은 시드로 몇 틱 굴려 첫 피해·게이지·좌표를 읽는다(상태 유무만 다른 대조 쌍).
// 사용: node node_modules/vite-node/vite-node.mjs --script scripts/qa/runtime/ct-engine-numbers.mts
import { execFileSync } from "node:child_process";
import { runTool } from "../../../src/editor/tools/toolRunner";
import { deserialize } from "../../../src/project/io";
import { createBattleRuntime } from "../../../src/battle/runtime";
import type { BattleSnapshot } from "../../../src/battle/types";
import { mulberry32 } from "../../../src/util/rng";

const json = execFileSync(process.execPath, ["node_modules/vite-node/vite-node.mjs", "--script", "scripts/qa/runtime/ct-engine-fixture.mts"], { maxBuffer: 80 * 1024 * 1024 }).toString();
const project = deserialize(json);
const ctx = { project };
function call(name: string, args: Record<string, unknown>) {
  const result = runTool(ctx, name, args);
  if (!result.ok) throw new Error(`${name} 실패: ${result.summary} ${JSON.stringify(result.issues ?? [])}`);
  return result;
}

const element = ctx.project.database.elements?.find((entry) => entry.damageMultipliers)?.id;
if (!element) throw new Error("피해 배율이 있는 속성이 없다");
const state = (id: string, name: string, runtimeEffects: Record<string, unknown>) =>
  call("upsert_state", { state: { id, name, runtimeEffects: { ...runtimeEffects, removeOnBattleEnd: true } } });
state("state_ct_stop", "스톱", { freezesGauge: true });
state("state_ct_berserk", "버서크", { forcedAction: "attackRandom" });
state("state_ct_protect", "프로텍트", { physicalDefenseMultiplier: 2.5 });
state("state_ct_shield", "실드", { magicDefenseMultiplier: 2.5 });
state("state_ct_weak", "약점 노출", { elementRates: { [element]: "A" } });

const skill = (id: string, name: string, statistic: "attack" | "mind", extra: Record<string, unknown> = {}) =>
  call("upsert_skill", { skill: { id, name, scope: "enemy", power: 60, variance: 0, criticalRate: 0, hitRate: 100, effect: { kind: "damage", statistic, affects: "hp" }, ...extra } });
skill("skill_ct_phys", "베기", "attack");
skill("skill_ct_magic", "마탄", "mind");
skill("skill_ct_elem", "속성탄", "mind", { elementId: element });

// 적 하나 = 고정 행동 하나. 빠른 민첩으로 항상 먼저 움직인다. 허수아비는 행동 전에 (120, 90) 으로 나선다.
function probe(id: string, skillId: string, moveTo?: { x: number; y: number }) {
  call("upsert_enemy", { enemy: {
    id: `enemy_${id}`, name: id, monsterResourceId: "generated-enemy-bat-01",
    stats: { maxHp: 9999, maxMp: 0, attack: 200, defense: 60, mind: 200, agility: 999 }, rewards: { exp: 1, gold: 1 },
    actions: [{ skillId, priority: 50, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false }, ...(moveTo ? { moveTo } : {}) }],
  } });
  call("upsert_troop", { troop: { id: `troop_${id}`, name: id, enemyIds: [`enemy_${id}`], members: [{ enemyId: `enemy_${id}`, x: 40, y: 60, hidden: false }] } });
}
probe("ct_phys", "skill_ct_phys", { x: 120, y: 90 });
probe("ct_magic", "skill_ct_magic");
probe("ct_elem", "skill_ct_elem");

const sim = call("simulate_battle", { troopId: "troop_ct_phys", heroLevel: 20, n: 3, seed: 7, battleFlow: "gauge" });

function run(troopId: string, heroStates: string[] = [], ticks = 12): BattleSnapshot {
  const rt = createBattleRuntime({
    project: ctx.project, troopId, canEscape: false, canLose: true, battleFlow: "gauge", rng: mulberry32(11),
    party: { levels: { actor_hero: 20 }, partyActorIds: ["actor_hero"], stateIds: { actor_hero: heroStates } },
  });
  for (let i = 0; i < ticks; i += 1) {
    const snap = rt.snapshot();
    if (snap.result || snap.phase === "actorCommand") break;
    rt.tick(200);
  }
  return rt.snapshot();
}
/** 적이 주인공에게 준 첫 피해. */
function firstEnemyHit(snap: BattleSnapshot): number | undefined {
  return snap.timeline.find((entry) => entry.side === "enemy" && entry.kind === "damage" && entry.targetId === "actor_hero")?.amount;
}

// 1) 스톱: 같은 시간을 흘려도 게이지 0 · 명령 국면 없음 · 적은 계속 행동한다.
const stopped = run("troop_ct_magic", ["state_ct_stop"], 30);
const free = run("troop_ct_magic", [], 1);
const stop = {
  heroGaugeStopped: Math.round(stopped.actors[0]?.gauge ?? -1),
  phaseStopped: stopped.phase,
  enemyHitsWhileStopped: stopped.timeline.filter((entry) => entry.side === "enemy" && entry.kind === "damage").length,
  heroGaugeFreeAfter200ms: Math.round(free.actors[0]?.gauge ?? -1),
};

// 2) 버서크: 명령을 묻지 않고 스스로 통상 공격한다.
// 약한 픽스처 트룹(도발만 하는 반격병)에서 잰다 — 강한 탐침 적은 주인공 차례 전에 쓰러뜨린다.
const berserkSnap = run("troop_ct_guard", ["state_ct_berserk"], 30);
const berserk = {
  phase: berserkSnap.phase,
  heroSelfAttacks: berserkSnap.timeline.filter((entry) => entry.side === "actor" && entry.commandKind === "attack").length,
};

// 3) 프로텍트는 공격 계열만, 실드는 마력 계열만 줄인다.
const damage = {
  physical: { base: firstEnemyHit(run("troop_ct_phys")), protect: firstEnemyHit(run("troop_ct_phys", ["state_ct_protect"])), shield: firstEnemyHit(run("troop_ct_phys", ["state_ct_shield"])) },
  magic: { base: firstEnemyHit(run("troop_ct_magic")), protect: firstEnemyHit(run("troop_ct_magic", ["state_ct_protect"])), shield: firstEnemyHit(run("troop_ct_magic", ["state_ct_shield"])) },
  // 4) 상태의 elementRates 가 레코드 등급을 덮어쓴다(A = 약점).
  element: { base: firstEnemyHit(run("troop_ct_elem")), weakState: firstEnemyHit(run("troop_ct_elem", ["state_ct_weak"])) },
};

// 5) 행동 moveTo: 적이 행동하면 전투장 좌표가 바뀐다(위치 범위기가 읽는 battleX/battleY).
const moved = run("troop_ct_phys");
const move = { before: { x: 40, y: 60 }, after: { x: moved.enemies[0]?.battleX, y: moved.enemies[0]?.battleY }, moveEntries: moved.timeline.filter((entry) => entry.kind === "move").length };

const report = { simulate: sim.summary, element, stop, berserk, damage, move };
console.log(JSON.stringify(report, null, 1));
const n = (value: number | undefined) => value ?? Number.NaN;
const ok = stop.heroGaugeStopped === 0 && stop.phaseStopped !== "actorCommand" && stop.enemyHitsWhileStopped >= 2 && stop.heroGaugeFreeAfter200ms > 0
  && berserk.phase !== "actorCommand" && berserk.heroSelfAttacks >= 1
  && n(damage.physical.protect) < n(damage.physical.base) && damage.physical.shield === damage.physical.base
  && n(damage.magic.shield) < n(damage.magic.base) && damage.magic.protect === damage.magic.base
  && n(damage.element.weakState) > n(damage.element.base)
  && move.after.x === 120 && move.after.y === 90 && move.moveEntries >= 1;
console.log(ok ? "CT_ENGINE_NUMBERS_OK" : "CT_ENGINE_NUMBERS_FAIL");
process.exit(ok ? 0 : 1);
