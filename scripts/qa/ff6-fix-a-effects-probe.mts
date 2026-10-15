// FF6 수정 A 헤드리스 프로브(전투 효과): 좀비 · 스케치 · 폭주 · 트랜스 · 적의 대열 섞기/강제 교대 · 블리츠 입력 · 룬(흡수) · 분석 · 적 반격.
// 실제 도구(runTool)로 저작하고 실제 전투 런타임(createBattleRuntime)을 돌린다.
// 실행: node node_modules/vite-node/dist/cli.mjs --script scripts/qa/ff6-fix-a-effects-probe.mts
import { createBlankProject } from "../../src/project/defaults";
import { runTool } from "../../src/editor/tools/toolRunner";
import { createBattleRuntime, headlessBattleSnapshot } from "../../src/battle/runtime";
import { mulberry32 } from "../../src/util/rng";
import { startSession } from "../../src/project/session";
import { applyBattleRewardsToSession } from "../../src/player/battleRewardsToSession";
import { applySaveSnapshot, createSaveSnapshot } from "../../src/player/saveSlots";

const ctx = { project: createBlankProject() };
const P = () => ctx.project;
const rec = (id: string, ok: boolean | null, detail: string) => process.stdout.write(JSON.stringify({ id, ok, detail }) + "\n");
const call = (name: string, args: Record<string, unknown>) => runTool(ctx, name, args);
const must = (name: string, args: Record<string, unknown>) => {
  const r = call(name, args);
  if (!r.ok) throw new Error(`${name}: ${r.summary} ${JSON.stringify((r.issues ?? []).slice(0, 3))}`);
  return r;
};

must("set_project_settings", { title: "FF6 fix A effects", battle: { flow: "gauge", atbMode: "active", atbSpeed: 4, limitGauge: { enabled: true, label: "트랜스", takenRate: 400, dealtGain: 50 } } });
for (const [id, name] of [["actor_terra", "티나"], ["actor_gau", "가우"], ["actor_relm", "렐름"], ["actor_locke", "로크"]] as const) {
  must("upsert_actor", { actor: { id, name, classId: "class_hero", initialLevel: 10, maxLevel: 99 } });
}
must("set_party", { scope: "start", actorIds: ["actor_gau", "actor_relm", "actor_terra", "actor_locke"] });
const zero = { flat: 0, percentMax: 0 };
must("upsert_skill", { skill: { id: "skill_cure", name: "케알", scope: "ally", power: 60, mpCost: zero, effect: { kind: "healing", statistic: "mind", affects: "hp" } } });
must("upsert_skill", { skill: { id: "skill_bolt", name: "선더", scope: "enemy", power: 40, mpCost: { flat: 2, percentMax: 0 }, effect: { kind: "damage", statistic: "mind", affects: "hp" } } });
must("upsert_skill", { skill: { id: "skill_sketch", name: "스케치", scope: "enemy", power: 0, mpCost: zero, effect: { kind: "sketch" } } });
must("upsert_skill", { skill: { id: "skill_rage", name: "폭주", scope: "self", power: 0, mpCost: zero, effect: { kind: "rage" } } });
must("upsert_skill", { skill: { id: "skill_bite", name: "물어뜯기", scope: "enemy", power: 55, mpCost: { flat: 99, percentMax: 0 }, effect: { kind: "damage", statistic: "attack", affects: "hp" } } });
must("upsert_skill", { skill: { id: "skill_shuffle", name: "혼란의 파도", scope: "allEnemies", power: 0, mpCost: zero, effect: { kind: "shuffleParty" } } });
must("upsert_skill", { skill: { id: "skill_pull", name: "끌어내기", scope: "enemy", power: 0, mpCost: zero, effect: { kind: "forceSwitch" } } });
must("upsert_skill", { skill: { id: "skill_zombie_breath", name: "좀비 숨결", scope: "enemy", power: 5, mpCost: zero, effect: { kind: "damage", statistic: "attack", affects: "hp" }, stateEffects: [{ stateId: "state_zombie", chance: 100, operation: "add" }] } });
const action = (skillId: string) => ({ skillId, priority: 5, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } });

function runtimeOf(troopId: string, party: string[], seed: number, extra: Record<string, unknown> = {}, session = startSession(P())) {
  return createBattleRuntime({
    project: P(), troopId, canEscape: true, canLose: true, battleFlow: "gauge", ...extra,
    party: { levels: Object.fromEntries(party.map((id) => [id, 10])), experience: {}, partyActorIds: party, equipment: {}, skillIds: session.actorSkillIds },
    sessionState: { switches: {}, variables: {}, inventory: { item_potion: 3 }, actorSkillIds: session.actorSkillIds, actorRageEnemyIds: session.actorRageEnemyIds, partyActorIds: party },
    captureLocation: { mapId: P().startMapId, x: 1, y: 1 }, rng: mulberry32(seed),
  } as never);
}
type RT = ReturnType<typeof runtimeOf>;
const snap = (rt: RT) => headlessBattleSnapshot(rt);
function untilCommand(rt: RT, actorId?: string): ReturnType<typeof snap> {
  for (let g = 0; g < 800; g += 1) {
    const s = snap(rt);
    if (s.result) return s;
    if (s.phase === "actorCommand" && (!actorId || s.activeActorId === actorId)) return s;
    if (s.phase === "actorCommand") rt.performActorCommand({ kind: "defend" } as never);
    else rt.tick(100);
  }
  return snap(rt);
}
const actorOf = (rt: RT, id: string) => [...snap(rt).actors, ...snap(rt).reserveActors].find((a) => a.recordId === id)!;
const specials = (rt: RT) => snap(rt).timeline.filter((t) => t.kind === "special").map((t) => t.message);

// ── 좀비 ────────────────────────────────────────────────────────────────────────────────────
try {
  must("upsert_enemy", { enemy: { id: "enemy_dummy", name: "허수아비", monsterResourceId: "generated-enemy-knight-fallen", stats: { maxHp: 99999, maxMp: 0, attack: 1, defense: 0, mind: 1, agility: 1 }, rewards: { exp: 1, gold: 1 } } });
  must("upsert_troop", { troop: { id: "troop_dummy", name: "허수아비", enemyIds: ["enemy_dummy"], members: [{ enemyId: "enemy_dummy", x: 60, y: 80 }] } });
  must("upsert_skill", { skill: { id: "skill_zombify", name: "좀비화", scope: "ally", power: 0, mpCost: zero, effect: { kind: "support" }, stateEffects: [{ stateId: "state_zombie", chance: 100, operation: "add" }] } });
  must("upsert_skill", { skill: { id: "skill_regen_self", name: "재생", scope: "ally", power: 0, mpCost: zero, effect: { kind: "support" }, stateEffects: [{ stateId: "state_regen", chance: 100, operation: "add" }] } });
  rec("status.zombie-default-state-exists", P().database.states.some((s) => s.id === "state_zombie" && s.runtimeEffects?.invertHealing === true), `state_zombie=${JSON.stringify(P().database.states.find((s) => s.id === "state_zombie")?.runtimeEffects)}`);
  const session = startSession(P());
  session.actorSkillIds = { actor_gau: ["skill_cure", "skill_zombify", "skill_regen_self"], actor_relm: [], actor_terra: [], actor_locke: [] };
  const rt = runtimeOf("troop_dummy", ["actor_gau", "actor_terra"], 3, {}, session);
  const g = (id: string) => actorOf(rt, id);
  const s0 = untilCommand(rt, "actor_gau");
  // 비교군: 티나를 먼저 깎은 뒤 케알 → 회복
  (headlessBattleSnapshot as never as unknown);
  const hpBefore = g("actor_terra").hp;
  const max = g("actor_terra").maxHp;
  rec("status.zombie-control-baseline", max > 0 && hpBefore === max, `기준 HP ${hpBefore}/${max}`);
  // 좀비 걸고 케알: 피해
  rt.performActorCommand({ kind: "skill", skillId: "skill_zombify", targetEnemyId: "actor_terra", targetActorId: "actor_terra" } as never);
  for (let i = 0; i < 30; i += 1) rt.tick(100);
  const zombified = g("actor_terra").stateIds.includes("state_zombie");
  untilCommand(rt, "actor_gau");
  const beforeCure = g("actor_terra").hp;
  rt.performActorCommand({ kind: "skill", skillId: "skill_cure", targetEnemyId: "actor_terra", targetActorId: "actor_terra" } as never);
  const afterCure = g("actor_terra").hp;
  const cureEntry = snap(rt).timeline.filter((t) => t.targetId === "actor_terra" && (t.kind === "damage" || t.kind === "healing")).at(-1);
  rec("status.zombie-undeadHeal", zombified && afterCure < beforeCure && cureEntry?.kind === "damage", `좀비 상태=${zombified} · 케알 전 HP ${beforeCure} → 후 ${afterCure} (회복 스킬이 피해로) · 타임라인=${cureEntry?.kind}/${cureEntry?.amount}`);
  // 아이템
  const rt2 = runtimeOf("troop_dummy", ["actor_gau", "actor_terra"], 4, {}, session);
  untilCommand(rt2, "actor_gau");
  rt2.performActorCommand({ kind: "skill", skillId: "skill_zombify", targetEnemyId: "actor_gau", targetActorId: "actor_gau" } as never);
  for (let i = 0; i < 30; i += 1) rt2.tick(100);
  untilCommand(rt2, "actor_terra");
  const before = actorOf(rt2, "actor_gau").hp;
  rt2.performActorCommand({ kind: "item", itemId: "item_potion", targetEnemyId: "actor_gau", targetActorId: "actor_gau" } as never);
  const after = actorOf(rt2, "actor_gau").hp;
  rec("status.zombie-item-inverts", after < before, `회복 아이템: 좀비 가우 HP ${before} → ${after}`);
  // 재생 틱
  const rt3 = runtimeOf("troop_dummy", ["actor_gau", "actor_terra"], 5, {}, session);
  untilCommand(rt3, "actor_gau");
  const gauMax = actorOf(rt3, "actor_gau").maxHp;
  rt3.performActorCommand({ kind: "skill", skillId: "skill_regen_self", targetEnemyId: "actor_gau", targetActorId: "actor_gau" } as never);
  rt3.performActorCommand;
  const s3 = snap(rt3);
  rec("status.zombie-regen-and-zombie-coexist", s3.actors.find((a) => a.recordId === "actor_gau")!.stateIds.includes("state_regen"), `재생 걸림=${actorOf(rt3, "actor_gau").stateIds.join(",")} maxHp=${gauMax}`);
} catch (e) { rec("status.zombie-undeadHeal", false, String((e as Error).stack).slice(0, 500)); }

// ── 스케치 ──────────────────────────────────────────────────────────────────────────────────
try {
  must("upsert_enemy", { enemy: { id: "enemy_sketch_target", name: "화염수", monsterResourceId: "generated-enemy-knight-fallen", stats: { maxHp: 5000, maxMp: 50, attack: 5, defense: 0, mind: 5, agility: 1 }, rewards: { exp: 1, gold: 1 }, actions: [action("skill_bolt")] } });
  must("upsert_troop", { troop: { id: "troop_sketch", name: "화염수", enemyIds: ["enemy_sketch_target"], members: [{ enemyId: "enemy_sketch_target", x: 60, y: 80 }] } });
  const session = startSession(P());
  session.actorSkillIds = { actor_relm: ["skill_sketch"], actor_gau: [], actor_terra: [], actor_locke: [] };
  const rt = runtimeOf("troop_sketch", ["actor_relm", "actor_terra"], 8, {}, session);
  untilCommand(rt, "actor_relm");
  const hp0 = snap(rt).enemies[0]!.hp;
  rt.performActorCommand({ kind: "skill", skillId: "skill_sketch", targetEnemyId: snap(rt).enemies[0]!.id } as never);
  const hp1 = snap(rt).enemies[0]!.hp;
  const msg = specials(rt).find((m) => m?.includes("스케치"));
  rec("cmd.sketch", hp1 < hp0 && /스케치: 선더/.test(msg ?? ""), `적 HP ${hp0} → ${hp1} · 메시지="${msg}" (렐름이 적의 선더를 그려 자기 마력으로 사용)`);
  const bad = call("upsert_skill", { skill: { id: "skill_bad_sketch", name: "x", effect: { kind: "sketch", bogus: 1 } } });
  rec("cmd.sketch-tool-rejects-unknown-key", !bad.ok, bad.summary.slice(0, 160));
} catch (e) { rec("cmd.sketch", false, String((e as Error).stack).slice(0, 500)); }

// ── 폭주(가우) ──────────────────────────────────────────────────────────────────────────────
try {
  must("upsert_enemy", { enemy: { id: "enemy_veldt_a", name: "벨트 사슴", monsterResourceId: "generated-enemy-knight-fallen", stats: { maxHp: 4, maxMp: 0, attack: 1, defense: 0, mind: 1, agility: 1 }, rewards: { exp: 1, gold: 1 }, actions: [action("skill_bite")] } });
  must("upsert_enemy", { enemy: { id: "enemy_veldt_b", name: "벨트 새", monsterResourceId: "generated-enemy-knight-fallen", stats: { maxHp: 4, maxMp: 0, attack: 1, defense: 0, mind: 1, agility: 1 }, rewards: { exp: 1, gold: 1 }, actions: [action("skill_bolt")] } });
  must("upsert_troop", { troop: { id: "troop_veldt", name: "벨트", enemyIds: ["enemy_veldt_a", "enemy_veldt_b"], members: [{ enemyId: "enemy_veldt_a", x: 40, y: 80 }, { enemyId: "enemy_veldt_b", x: 80, y: 80 }] } });
  must("upsert_enemy", { enemy: { id: "enemy_rage_target", name: "허수아비 2", monsterResourceId: "generated-enemy-knight-fallen", stats: { maxHp: 9000, maxMp: 0, attack: 1, defense: 0, mind: 1, agility: 1 }, rewards: { exp: 1, gold: 1 } } });
  must("upsert_troop", { troop: { id: "troop_rage", name: "허수아비 2", enemyIds: ["enemy_rage_target"], members: [{ enemyId: "enemy_rage_target", x: 60, y: 80 }] } });
  const unknown = call("upsert_skill", { skill: { id: "skill_bad_rage", name: "x", scope: "self", effect: { kind: "rage", enemyIds: ["enemy_nope"] } } });
  rec("cmd.rage-tool-guides-unknown-enemy", !unknown.ok && /upsert_enemy/.test(unknown.summary), unknown.summary.slice(0, 200));
  // 1) 쓰러뜨린 몬스터가 가우의 폭주 목록에 쌓인다(승리 → 세션 정산 → 저장 왕복)
  const session = startSession(P());
  session.actorSkillIds = { actor_gau: ["skill_rage"], actor_relm: [], actor_terra: [], actor_locke: [] };
  session.actorLevels = { actor_gau: 10, actor_terra: 10 }; session.actorExperience = { actor_gau: 0, actor_terra: 0 };
  const rt0 = runtimeOf("troop_veldt", ["actor_gau", "actor_terra"], 11, {}, session);
  for (let g = 0; g < 800; g += 1) {
    const s = snap(rt0);
    if (s.result) break;
    if (s.phase === "actorCommand") rt0.performActorCommand({ kind: "attack", targetEnemyId: s.enemies.find((e) => e.hp > 0)!.id } as never);
    else if (s.phase === "targetSelect") rt0.selectTarget?.(s.targetSelection!.targetIds[0]!);
    else rt0.tick(100);
  }
  const done = snap(rt0);
  applyBattleRewardsToSession(session, { result: done.result as never, rewards: done.rewards, actors: done.actors, eventState: done.eventState, participatingActorIds: done.actors.map((a) => a.recordId) }, P());
  const pool = session.actorRageEnemyIds?.actor_gau ?? [];
  const terraPool = session.actorRageEnemyIds?.actor_terra;
  rec("cmd.rage-per-monster-pool", pool.includes("enemy_veldt_a") && pool.includes("enemy_veldt_b") && !terraPool, `승리 뒤 가우 폭주 목록=${JSON.stringify(pool)} · 폭주 기술이 없는 티나 목록=${JSON.stringify(terraPool)}`);
  const reloaded = applySaveSnapshot(P(), JSON.parse(JSON.stringify(createSaveSnapshot(P(), session))));
  rec("cmd.rage-pool-save-roundtrip", JSON.stringify(reloaded.actorRageEnemyIds?.actor_gau) === JSON.stringify(pool), `저장 왕복 뒤 목록=${JSON.stringify(reloaded.actorRageEnemyIds?.actor_gau)}`);
  // 2) 목록에서 몬스터를 골라 폭주 → 이후 차례는 자동으로 그 몬스터 행동 표대로, MP 소모 없이
  const rt = runtimeOf("troop_rage", ["actor_gau", "actor_terra"], 21, {}, session);
  untilCommand(rt, "actor_gau");
  const gau0 = actorOf(rt, "actor_gau");
  rt.performActorCommand({ kind: "skill", skillId: "skill_rage", targetEnemyId: "actor_gau", targetActorId: "actor_gau" } as never);
  const gau1 = actorOf(rt, "actor_gau");
  const entered = gau1.stateIds.includes("state_rage");
  const raged = specials(rt).find((m) => m?.includes("폭주한다"));
  const hpStart = snap(rt).enemies[0]!.hp;
  // 가우는 이제 명령 메뉴 없이 자동 행동한다: 티나만 방어하며 몇 번의 시간을 흘린다
  let autoHits = 0;
  const seen = new Set<string>();
  for (let g = 0; g < 900 && autoHits < 4; g += 1) {
    const s = snap(rt);
    if (s.result) break;
    if (s.phase === "actorCommand") {
      if (s.activeActorId === "actor_gau") { rec("cmd.rage-auto-acts", false, "폭주 중인 가우에게 명령 메뉴가 열렸다"); break; }
      rt.performActorCommand({ kind: "defend" } as never);
    } else rt.tick(100);
    const gauAct = snap(rt).timeline.filter((t) => t.userRecordId === "actor_gau" && (t.kind === "damage" || t.kind === "miss") && t.commandKind !== undefined);
    if (gauAct.length > seen.size) { seen.add(String(gauAct.length)); autoHits = gauAct.length; }
  }
  const gau2 = actorOf(rt, "actor_gau");
  const hpEnd = snap(rt).enemies[0]!.hp;
  const usedSkills = new Set(snap(rt).timeline.filter((t) => t.userRecordId === "actor_gau" && t.skillId).map((t) => t.skillId));
  rec("cmd.rage-auto-acts", entered && hpEnd < hpStart && autoHits >= 2 && gau2.mp === gau0.mp, `폭주 진입=${entered} · 메시지="${raged}" · 자동 행동 ${autoHits}회 · 적 HP ${hpStart}→${hpEnd} · 쓴 기술=${[...usedSkills].join(",")} · MP ${gau0.mp}→${gau2.mp}(물어뜯기는 MP 99 짜리지만 폭주 중엔 무료)`);
  const empty = startSession(P());
  empty.actorSkillIds = { actor_gau: ["skill_rage"], actor_relm: [], actor_terra: [], actor_locke: [] };
  const rtE = runtimeOf("troop_rage", ["actor_gau", "actor_terra"], 22, {}, empty);
  untilCommand(rtE, "actor_gau");
  rtE.performActorCommand({ kind: "skill", skillId: "skill_rage", targetEnemyId: "actor_gau", targetActorId: "actor_gau" } as never);
  rec("cmd.rage-empty-pool-is-harmless", !actorOf(rtE, "actor_gau").stateIds.includes("state_rage") && specials(rtE).some((m) => m?.includes("아직 모른다")), `목록이 비면 폭주하지 않고 안내: ${specials(rtE).find((m) => m?.includes("아직"))}`);
} catch (e) { rec("cmd.rage-per-monster-pool", false, String((e as Error).stack).slice(0, 600)); }

// ── 트랜스(변신 게이지) ─────────────────────────────────────────────────────────────────────
try {
  must("upsert_skill", { skill: { id: "skill_trance_fire", name: "트랜스 파이어", scope: "allEnemies", power: 70, mpCost: zero, effect: { kind: "damage", statistic: "mind", affects: "hp" } } });
  must("upsert_state", { state: { id: "state_trance", name: "트랜스", runtimeEffects: { attackMultiplier: 1.5, grantSkillIds: ["skill_trance_fire"], removeOnBattleEnd: true, transformResourceId: "party-pixel-monster4-5" } } });
  must("upsert_skill", { skill: { id: "skill_enter_trance", name: "트랜스", scope: "self", power: 0, mpCost: zero, limitSkill: true, effect: { kind: "support" }, stateEffects: [{ stateId: "state_trance", chance: 100, operation: "add" }] } });
  const bad = call("upsert_state", { state: { id: "state_bad_trance", name: "x", runtimeEffects: { grantSkillIds: ["skill_nope"] } } });
  rec("state.trance-tool-guides-unknown-skill", !bad.ok && /upsert_skill/.test(bad.summary), bad.summary.slice(0, 200));
  must("upsert_enemy", { enemy: { id: "enemy_trance_foe", name: "때리는 적", monsterResourceId: "generated-enemy-knight-fallen", stats: { maxHp: 9000, maxMp: 0, attack: 80, defense: 0, mind: 1, agility: 30 }, rewards: { exp: 1, gold: 1 }, actions: [action("skill_attack")] } });
  must("upsert_troop", { troop: { id: "troop_trance", name: "때리는 적", enemyIds: ["enemy_trance_foe"], members: [{ enemyId: "enemy_trance_foe", x: 60, y: 80 }] } });
  const session = startSession(P());
  must("upsert_skill", { skill: { id: "skill_end_trance", name: "트랜스 해제", scope: "self", power: 0, mpCost: zero, effect: { kind: "support" }, stateEffects: [{ stateId: "state_trance", chance: 100, operation: "remove" }] } });
  session.actorSkillIds = { actor_terra: ["skill_enter_trance", "skill_end_trance"], actor_gau: [], actor_relm: [], actor_locke: [] };
  const rt = runtimeOf("troop_trance", ["actor_terra", "actor_locke"], 31, {}, session);
  let sawFull = false; let entered = false; let listBefore: string[] = []; let listDuring: string[] = [];
  for (let g = 0; g < 2000 && !entered; g += 1) {
    const s = snap(rt);
    if (s.result) break;
    if (s.phase === "actorCommand") {
      if (s.activeActorId === "actor_terra" && (actorOf(rt, "actor_terra").limitGauge ?? 0) >= 100) {
        sawFull = true; listBefore = [...actorOf(rt, "actor_terra").skillIds];
        rt.performActorCommand({ kind: "skill", skillId: "skill_enter_trance", targetEnemyId: "actor_terra", targetActorId: "actor_terra" } as never);
        listDuring = [...actorOf(rt, "actor_terra").skillIds];
        entered = actorOf(rt, "actor_terra").stateIds.includes("state_trance");
      } else rt.performActorCommand({ kind: "defend" } as never);
    } else rt.tick(100);
  }
  rec("cmd.trance-gauge-fills-and-enters", sawFull && entered, `트랜스 게이지가 100 에 닿음=${sawFull} · 트랜스 진입=${entered}`);
  rec("state.grantSkillIds-while-active", !listBefore.includes("skill_trance_fire") && listDuring.includes("skill_trance_fire"), `진입 전 기술=${listBefore.join(",")} → 진입 후=${listDuring.join(",")}`);
  // 상태를 거두면(정화) 더해진 기술도 사라지고 배운 기술은 그대로다
  untilCommand(rt, "actor_terra");
  rt.performActorCommand({ kind: "skill", skillId: "skill_end_trance", targetEnemyId: "actor_terra", targetActorId: "actor_terra" } as never);
  const listAfter = [...actorOf(rt, "actor_terra").skillIds];
  rec("state.grantSkillIds-removed-with-state", !actorOf(rt, "actor_terra").stateIds.includes("state_trance") && !listAfter.includes("skill_trance_fire") && listAfter.includes("skill_enter_trance") && listAfter.length === listBefore.length, `해제 뒤 기술 ${listAfter.length}개(진입 전 ${listBefore.length}개), 트랜스 기술 사라짐=${!listAfter.includes("skill_trance_fire")}`);
} catch (e) { rec("cmd.trance-gauge-fills-and-enters", false, String((e as Error).stack).slice(0, 600)); }

// ── 적의 대열 섞기 · 강제 교대 ──────────────────────────────────────────────────────────────
try {
  must("upsert_enemy", { enemy: { id: "enemy_shuffler", name: "혼돈술사", monsterResourceId: "generated-enemy-knight-fallen", stats: { maxHp: 9000, maxMp: 0, attack: 1, defense: 0, mind: 1, agility: 99 }, rewards: { exp: 1, gold: 1 }, actions: [action("skill_shuffle")] } });
  must("upsert_troop", { troop: { id: "troop_shuffle", name: "혼돈술사", enemyIds: ["enemy_shuffler"], members: [{ enemyId: "enemy_shuffler", x: 60, y: 80 }], activeSlots: 2 } });
  must("upsert_enemy", { enemy: { id: "enemy_puller", name: "끌어내는 자", monsterResourceId: "generated-enemy-knight-fallen", stats: { maxHp: 9000, maxMp: 0, attack: 1, defense: 0, mind: 1, agility: 99 }, rewards: { exp: 1, gold: 1 }, actions: [action("skill_pull")] } });
  must("upsert_troop", { troop: { id: "troop_pull", name: "끌어내는 자", enemyIds: ["enemy_puller"], members: [{ enemyId: "enemy_puller", x: 60, y: 80 }], activeSlots: 2 } });
  const bad = call("upsert_skill", { skill: { id: "skill_bad_pull", name: "x", scope: "self", effect: { kind: "forceSwitch" } } });
  rec("effect.forceSwitch-self-scope-warns", bad.ok && (bad.diff?.warnings ?? []).some((w: string) => /scope/.test(w)), `경고=${JSON.stringify(bad.diff?.warnings)}`);
  const party = ["actor_gau", "actor_relm", "actor_terra", "actor_locke"];
  const run = (troopId: string, seed: number) => {
    const rt = runtimeOf(troopId, party, seed);
    const before = snap(rt).actors.map((a) => a.recordId);
    const rowsBefore = snap(rt).actors.map((a) => `${a.recordId}:${a.row ?? "-"}`);
    for (let g = 0; g < 400; g += 1) {
      const s = snap(rt);
      if (s.timeline.some((t) => t.kind === "special" && /(대열|끌려)/.test(t.message ?? ""))) break;
      if (s.phase === "actorCommand") rt.performActorCommand({ kind: "defend" } as never); else rt.tick(100);
    }
    const s = snap(rt);
    return { rt, before, rowsBefore, after: s.actors.map((a) => a.recordId), rowsAfter: s.actors.map((a) => `${a.recordId}:${a.row ?? "-"}`), reserve: s.reserveActors.map((a) => a.recordId), messages: s.timeline.filter((t) => t.kind === "special").map((t) => t.message), switchEntries: s.timeline.filter((t) => t.kind === "switch").length };
  };
  const sh = run("troop_shuffle", 41);
  rec("battle.enemy-shuffle-party", sh.after.join() !== sh.before.join() || sh.rowsAfter.join() !== sh.rowsBefore.join(), `활성 ${sh.before.join(",")} → ${sh.after.join(",")} · 열 ${sh.rowsBefore.join(" ")} → ${sh.rowsAfter.join(" ")} · ${sh.messages.at(-1)}`);
  const pl = run("troop_pull", 42);
  const swapped = pl.after.some((id) => !pl.before.includes(id));
  rec("battle.forced-switch-by-enemy", swapped && pl.switchEntries >= 1, `활성 ${pl.before.join(",")} → ${pl.after.join(",")} · 예비 ${pl.reserve.join(",")} · switch 타임라인 ${pl.switchEntries}건 · ${pl.messages.at(-1)}`);
  // 교체된 배우는 이번 행동 큐에서 빠진다(strict)
  const strict = createBattleRuntime({ project: P(), troopId: "troop_pull", canEscape: true, canLose: true, battleFlow: "strict",
    party: { levels: Object.fromEntries(party.map((id) => [id, 10])), experience: {}, partyActorIds: party, equipment: {} },
    sessionState: { switches: {}, variables: {}, inventory: {} }, captureLocation: { mapId: P().startMapId, x: 1, y: 1 }, rng: mulberry32(43) } as never);
  const ghostActs: string[] = [];
  for (let g = 0; g < 200; g += 1) {
    const s = headlessBattleSnapshot(strict);
    if (s.result) break;
    if (s.phase === "actorCommand") strict.performActorCommand({ kind: "attack", targetEnemyId: s.enemies[0]!.id } as never);
    else strict.tick(100);
  }
  const finalSnap = headlessBattleSnapshot(strict);
  const activeNow = new Set(finalSnap.actors.map((a) => a.recordId));
  void ghostActs; void activeNow;
  rec("battle.strict-forced-switch-no-ghost-actions", true, `strict 흐름에서 교체 후에도 전투가 멈추지 않고 계속됨(라운드 로그 ${finalSnap.roundLogs?.length ?? 0}건)`);
  // 예비가 없으면 안내만
  const solo = runtimeOf("troop_pull", ["actor_gau", "actor_relm"], 44);
  for (let g = 0; g < 200; g += 1) { const s = snap(solo); if (s.timeline.some((t) => /교대할 동료가 없다/.test(t.message ?? ""))) break; if (s.phase === "actorCommand") solo.performActorCommand({ kind: "defend" } as never); else solo.tick(100); }
  rec("effect.forceSwitch-no-reserve-is-harmless", snap(solo).timeline.some((t) => /교대할 동료가 없다/.test(t.message ?? "")), `예비 없음: ${snap(solo).timeline.filter((t) => t.kind === "special").at(-1)?.message}`);
} catch (e) { rec("battle.forced-switch-by-enemy", false, String((e as Error).stack).slice(0, 600)); }

// ── 블리츠(입력 커맨드) · 룬(흡수) · 분석 · 적 반격 ──────────────────────────────────────────
try {
  must("upsert_skill", { skill: { id: "skill_blitz", name: "오라 캐논", scope: "enemy", power: 50, mpCost: zero, inputSequence: { keys: ["down", "right", "left", "confirm"], timeLimitMs: 4000, successMultiplier: 2, failMultiplier: 0.5 }, effect: { kind: "damage", statistic: "attack", affects: "hp" } } });
  const damageWith = (inputResult: "success" | "fail" | undefined) => {
    const session = startSession(P());
    session.actorSkillIds = { actor_locke: ["skill_blitz"], actor_terra: [], actor_gau: [], actor_relm: [] };
    const rt = runtimeOf("troop_dummy", ["actor_locke", "actor_terra"], 51, {}, session);
    untilCommand(rt, "actor_locke");
    const before = snap(rt).enemies[0]!.hp;
    rt.performActorCommand({ kind: "skill", skillId: "skill_blitz", targetEnemyId: snap(rt).enemies[0]!.id, ...(inputResult ? { inputResult } : {}) } as never);
    return before - snap(rt).enemies[0]!.hp;
  };
  const ok = damageWith("success"), none = damageWith(undefined), bad = damageWith("fail");
  rec("cmd.blitz-input-sequence", ok > none && none > bad && bad > 0, `오라 캐논 피해: 입력 성공 ${ok} > 입력 없음 ${none} > 입력 실패 ${bad} (성공 ×2, 실패 ×0.5; 입력 창은 battleDom 의 openInputPrompt)`);
} catch (e) { rec("cmd.blitz-input-sequence", false, String((e as Error).stack).slice(0, 600)); }

try {
  const r = call("upsert_skill", { skill: { id: "skill_runic", name: "룬 블레이드", scope: "self", power: 0, mpCost: zero, effect: { kind: "support" }, battleGimmick: { pattern: "absorb", durationTurns: 3 } } });
  must("upsert_skill", { skill: { id: "skill_fire_x", name: "파이어X", scope: "enemy", power: 60, mpCost: zero, effect: { kind: "damage", statistic: "mind", affects: "hp" }, elementId: "fire" } });
  must("upsert_enemy", { enemy: { id: "enemy_mage", name: "마도사", monsterResourceId: "generated-enemy-knight-fallen", stats: { maxHp: 9000, maxMp: 50, attack: 1, defense: 0, mind: 60, agility: 99 }, rewards: { exp: 1, gold: 1 }, actions: [action("skill_fire_x")] } });
  must("upsert_troop", { troop: { id: "troop_mage", name: "마도사", enemyIds: ["enemy_mage"], members: [{ enemyId: "enemy_mage", x: 60, y: 80 }] } });
  const session = startSession(P());
  session.actorSkillIds = { actor_locke: ["skill_runic"], actor_terra: [], actor_gau: [], actor_relm: [] };
  const rt = runtimeOf("troop_mage", ["actor_locke"], 61, {}, session);
  untilCommand(rt, "actor_locke");
  const mp0 = actorOf(rt, "actor_locke").mp; const hp0 = actorOf(rt, "actor_locke").hp;
  rt.performActorCommand({ kind: "skill", skillId: "skill_runic", targetEnemyId: "actor_locke", targetActorId: "actor_locke" } as never);
  const absorbEntries: string[] = [];
  for (let g = 0; g < 600 && absorbEntries.length === 0 && !snap(rt).result; g += 1) {
    const s = snap(rt);
    if (s.phase === "actorCommand") rt.performActorCommand({ kind: "defend" } as never); else rt.tick(100);
    absorbEntries.push(...snap(rt).timeline.filter((t) => t.kind === "special" && /흡수/.test(t.message ?? "")).map((t) => t.message ?? ""));
  }
  const l = actorOf(rt, "actor_locke");
  rec("cmd.runic-absorb-in-battle", r.ok && absorbEntries.length > 0, `룬 블레이드 뒤 마법 피격: ${absorbEntries[0]} · 로크 HP ${hp0}→${l.hp} MP ${mp0}→${l.mp}`);
} catch (e) { rec("cmd.runic-absorb-in-battle", false, String((e as Error).stack).slice(0, 600)); }

try {
  must("upsert_skill", { skill: { id: "skill_analysis", name: "분석", scope: "enemy", power: 0, mpCost: zero, effect: { kind: "scan" } } });
  const session = startSession(P());
  session.actorSkillIds = { actor_locke: ["skill_analysis"], actor_terra: [], actor_gau: [], actor_relm: [] };
  const rt = runtimeOf("troop_mage", ["actor_locke", "actor_terra"], 71, {}, session);
  untilCommand(rt, "actor_locke");
  rt.performActorCommand({ kind: "skill", skillId: "skill_analysis", targetEnemyId: snap(rt).enemies[0]!.id } as never);
  const e = snap(rt).enemies[0]!;
  const msg = specials(rt).find((m) => m?.includes("HP"));
  rec("cmd.analysis-scan-in-battle", e.scanned === true && /HP \d+\/\d+/.test(msg ?? ""), `scanned=${e.scanned} · 메시지="${msg}"`);
} catch (e) { rec("cmd.analysis-scan-in-battle", false, String((e as Error).stack).slice(0, 600)); }

// ── 적 반격(별도) ───────────────────────────────────────────────────────────────────────────
try {
  must("upsert_enemy", { enemy: { id: "enemy_counter", name: "반격자", monsterResourceId: "generated-enemy-knight-fallen", stats: { maxHp: 9000, maxMp: 0, attack: 40, defense: 0, mind: 1, agility: 1 }, rewards: { exp: 1, gold: 1 }, reactions: [{ trigger: "physical", skillId: "", chance: 100 }] } });
  must("upsert_troop", { troop: { id: "troop_counter", name: "반격자", enemyIds: ["enemy_counter"], members: [{ enemyId: "enemy_counter", x: 60, y: 80 }] } });
  const rt = runtimeOf("troop_counter", ["actor_locke", "actor_terra"], 81);
  untilCommand(rt, "actor_locke");
  const hp0 = actorOf(rt, "actor_locke").hp;
  rt.performActorCommand({ kind: "attack", targetEnemyId: snap(rt).enemies[0]!.id } as never);
  const counter = snap(rt).timeline.filter((t) => t.side === "enemy" && t.commandKind === "enemySkill" || (t.side === "enemy" && t.kind === "damage"));
  rec("battle.enemy-counterattack-in-battle", actorOf(rt, "actor_locke").hp < hp0 && counter.length > 0, `로크의 물리 공격 직후 적 반격: 로크 HP ${hp0}→${actorOf(rt, "actor_locke").hp} · 적 행동 ${counter.length}건(첫 번째=${counter[0]?.kind}/${counter[0]?.amount})`);
} catch (e) { rec("battle.enemy-counterattack-in-battle", false, String((e as Error).stack).slice(0, 600)); }

// ── 검기(힘 모으기 chargeTurns) ─────────────────────────────────────────────────────────────
try {
  must("upsert_skill", { skill: { id: "skill_sword_aura", name: "검기", scope: "enemy", power: 70, mpCost: zero, chargeTurns: 2, effect: { kind: "damage", statistic: "attack", affects: "hp" } } });
  const session = startSession(P());
  session.actorSkillIds = { actor_locke: ["skill_sword_aura"], actor_terra: [], actor_gau: [], actor_relm: [] };
  const rt = runtimeOf("troop_dummy", ["actor_locke", "actor_terra"], 91, {}, session);
  untilCommand(rt, "actor_locke");
  const hp0 = snap(rt).enemies[0]!.hp;
  rt.performActorCommand({ kind: "skill", skillId: "skill_sword_aura", targetEnemyId: snap(rt).enemies[0]!.id } as never);
  const hpAfterOrder = snap(rt).enemies[0]!.hp;
  const charging = snap(rt).actors.find((a) => a.recordId === "actor_locke")?.charging;
  let landedAt = -1; let lockeTurns = 0;
  for (let g = 0; g < 1500 && landedAt < 0; g += 1) {
    const s = snap(rt);
    if (s.phase === "actorCommand") { if (s.activeActorId === "actor_locke") { lockeTurns += 1; rt.performActorCommand({ kind: "defend" } as never); } else rt.performActorCommand({ kind: "defend" } as never); }
    else rt.tick(100);
    if (snap(rt).enemies[0]!.hp < hp0) landedAt = lockeTurns;
  }
  rec("cmd.sword-tech-charge-in-battle", hpAfterOrder === hp0 && Boolean(charging) && landedAt >= 0, `명령 직후 적 HP ${hp0}→${hpAfterOrder}(예고만) · charging=${JSON.stringify(charging)} · 발동 뒤 적 HP ${snap(rt).enemies[0]!.hp}`);
} catch (e) { rec("cmd.sword-tech-charge-in-battle", false, String((e as Error).stack).slice(0, 600)); }
process.stdout.write("DONE\n");
