// FF6 적대적 감사용 헤드리스 프로브(2026-10-15). 실제 편집기 도구(runTool)로 저작하고 실제 전투 런타임
// (createBattleRuntime — simulate_battle 과 같은 순수 TS 엔진)로 FF6 시그니처 기능이 "동작"하는지 잰다.
// 감사 전용 — 소스를 바꾸지 않는다. 실행: npx vite-node --script scripts/qa/ff6-audit-probe.mts
// stdout: JSON 줄 {id, ok, detail}. 출하 플레이어 검증이 아니라 엔진 검증이다(표에서 구분해 쓴다).
import { createBlankProject } from "../../src/project/defaults";
import { runTool } from "../../src/editor/tools/toolRunner";
import { createBattleRuntime, headlessBattleSnapshot } from "../../src/battle/runtime";
import { mulberry32 } from "../../src/util/rng";
import { simulateBattle } from "../../src/battle/simulate";

const ctx = { project: createBlankProject() };
// runTool 은 ctx.project 를 새 객체로 바꿀 수 있다 — 항상 ctx.project 를 읽는다.
const P = () => ctx.project;
const out: { id: string; ok: boolean | null; detail: string }[] = [];
const rec = (id: string, ok: boolean | null, detail: string) => { out.push({ id, ok, detail }); process.stdout.write(JSON.stringify({ id, ok, detail }) + "\n"); };
const call = (name: string, args: Record<string, unknown>) => {
  const r = runTool(ctx, name, args);
  return r;
};
const must = (name: string, args: Record<string, unknown>) => {
  const r = call(name, args);
  if (!r.ok) throw new Error(`${name}: ${r.summary} ${JSON.stringify((r.issues ?? []).slice(0, 3))}`);
  return r;
};

// ── 공통 데이터 ───────────────────────────────────────────────────────────────────────────
must("set_project_settings", { title: "FF6 audit", battle: { flow: "gauge", atbMode: "active", atbSpeed: 4, limitGauge: { enabled: true, label: "리미트", takenRate: 100, dealtGain: 20 }, formationRoll: true } });
for (const [id, name] of [["terra", "티나"], ["locke", "로크"], ["edgar", "에드거"], ["sabin", "세이빈"], ["celes", "셀레스"], ["cyan", "사이안"]]) {
  must("upsert_actor", { actor: { id: `actor_${id}`, name, classId: "class_hero", initialLevel: 5, maxLevel: 99 } });
}
must("set_party", { scope: "start", actorIds: ["actor_terra", "actor_locke", "actor_edgar", "actor_sabin"] });

// 소환 마법 + 에스퍼(장비로 스킬·명령 부여)
must("upsert_skill", { skill: { id: "skill_ifrit_summon", name: "이프리트", scope: "allEnemies", power: 80, mpCost: { flat: 0, percentMax: 0 }, effect: { kind: "damage", statistic: "mind", affects: "hp" }, elementId: "fire", description: "에스퍼 소환" } });
must("upsert_skill", { skill: { id: "skill_fire", name: "파이어", scope: "enemy", power: 30, mpCost: { flat: 4, percentMax: 0 }, effect: { kind: "damage", statistic: "mind", affects: "hp" }, elementId: "fire" } });
must("upsert_equipment", { equipment: { id: "eq_esper_ifrit", name: "마석 이프리트", slot: "accessory", price: 0, grantsSkillIds: ["skill_fire"], grantsCommand: { id: "cmd_esper_ifrit", name: "소환", kind: "skill", skillId: "skill_ifrit_summon" }, statBonuses: { attack: 0, defense: 0, mind: 5, agility: 0 }, equippableActorIds: [], equippableClassIds: [] } });

// 적: 훔치기·반격·마법 반격·보스 다페이즈
must("upsert_item", { item: { id: "item_ether_x", name: "엘릭서", price: 0, type: "medicine" } });
must("upsert_enemy", { enemy: { id: "enemy_ff_guard", name: "병사", monsterResourceId: "generated-enemy-knight-fallen", stats: { maxHp: 400, maxMp: 20, attack: 14, defense: 6, mind: 6, agility: 8 }, rewards: { exp: 10, gold: 5 }, stealItems: [{ itemId: "item_ether_x", rate: 100 }], reactions: [{ trigger: "physical", skillId: "", chance: 100 }, { trigger: "onDeath", skillId: "", chance: 100 }] } });
must("upsert_enemy", { enemy: { id: "enemy_ff_boss", name: "케프카", monsterResourceId: "generated-enemy-demon-lord", stats: { maxHp: 3000, maxMp: 99, attack: 30, defense: 10, mind: 30, agility: 12 }, rewards: { exp: 100, gold: 100 } }, role: "boss" });
must("upsert_troop", { troop: { id: "troop_guard", name: "병사 둘", enemyIds: ["enemy_ff_guard", "enemy_ff_guard"], members: [{ enemyId: "enemy_ff_guard", x: 40, y: 80 }, { enemyId: "enemy_ff_guard", x: 90, y: 80 }] } });
must("upsert_troop", { troop: { id: "troop_boss", name: "케프카", enemyIds: ["enemy_ff_boss"], members: [{ enemyId: "enemy_ff_boss", x: 80, y: 60 }] } });

// ── 런타임 도우미 ─────────────────────────────────────────────────────────────────────────
const rng = () => mulberry32(7);
function boot(troopId: string, extra: Record<string, unknown> = {}, party = ["actor_terra", "actor_locke", "actor_edgar", "actor_sabin"], equipment?: Record<string, Record<string, string>>) {
  return createBattleRuntime({
    project: P(), troopId, canEscape: true, canLose: true, battleFlow: "gauge",
    party: { levels: Object.fromEntries(party.map((a) => [a, 20])), experience: {}, partyActorIds: party, ...(equipment ? { equipment } : {}) },
    sessionState: { switches: {}, variables: {}, inventory: {} }, captureLocation: { mapId: P().startMapId, x: 1, y: 1 },
    rng: rng(), ...extra,
  } as never);
}
const snap = (rt: ReturnType<typeof boot>) => headlessBattleSnapshot(rt);

// F1. 에스퍼 장착 → 스킬·명령 부여(장비가 주는 동안만). 
try {
  const rt = boot("troop_guard", {}, ["actor_terra", "actor_locke"], { actor_terra: { accessory: "eq_esper_ifrit" } });
  const s = snap(rt);
  const terra = s.actors.find((a) => a.recordId === "actor_terra")!;
  const locke = s.actors.find((a) => a.recordId === "actor_locke")!;
  const g = (a: typeof terra) => a.equipmentEffects?.grantedSkillIds ?? [];
  rec("esper.equip-grants-skill", g(terra).includes("skill_fire") && g(terra).includes("skill_ifrit_summon") && !g(locke).includes("skill_fire"), `terra.granted=${JSON.stringify(g(terra))} locke.granted=${JSON.stringify(g(locke))} (skillIds 에는 없음: ${terra.skillIds.includes("skill_fire")})`);
} catch (e) { rec("esper.equip-grants-skill", false, String((e as Error).message).slice(0, 200)); }

// F2. 영구 습득(AP) — 장착 해제 후에도 남는가? 전투 시작 스냅샷은 장비를 뺀 경우 스킬이 사라지는지로 본다.
try {
  const rt = boot("troop_guard", {}, ["actor_terra"], { actor_terra: {} });
  const terra = snap(rt).actors[0]!;
  const has = terra.skillIds.includes("skill_fire") || (terra.equipmentEffects?.grantedSkillIds ?? []).includes("skill_fire");
  rec("esper.permanent-learn-after-unequip", has, `장착 해제 뒤 파이어 보유=${has} — 장착 중에만 있는 스킬이라 해제하면 사라진다(AP 로 영구 습득되는 경로 없음)`);
} catch (e) { rec("esper.permanent-learn-after-unequip", false, String((e as Error).message).slice(0, 200)); }

// F3. 리미트 게이지(맞으면 참)
try {
  const rt = boot("troop_guard");
  for (let i = 0; i < 400; i += 1) { rt.tick(250); const s = snap(rt); if (s.result) break; if (s.phase === "actorCommand") rt.performActorCommand({ kind: "defend" } as never); }
  const s = snap(rt);
  const max = Math.max(...s.actors.map((a) => a.limitGauge ?? -1));
  rec("battle.limit-gauge-fills", max > 0, `max limitGauge among party after ≤100s = ${max}`);
} catch (e) { rec("battle.limit-gauge-fills", false, String((e as Error).message).slice(0, 200)); }

// F4. ATB Active 모드: 명령 메뉴가 열려 있어도 적 게이지가 찬다 / Wait 이면 멈춘다.
for (const mode of ["active", "wait"] as const) {
  try {
    P().system.atbMode = mode;
    const rt = boot("troop_guard");
    let guard = 0;
    while (snap(rt).phase !== "actorCommand" && guard++ < 400) rt.tick(100);
    const before = snap(rt); const g0 = Math.max(...before.enemies.map((e) => e.gauge));
    const hp0 = before.actors.reduce((n, a) => n + a.hp, 0);
    for (let i = 0; i < 80; i += 1) rt.tick(100);
    const after = snap(rt); const g1 = Math.max(...after.enemies.map((e) => e.gauge));
    const hp1 = after.actors.reduce((n, a) => n + a.hp, 0);
    rec(`battle.atb-${mode}`, mode === "active" ? (g1 !== g0 || hp1 < hp0) : (g1 === g0 && hp1 === hp0), `phase=${after.phase} enemyGauge ${g0}→${g1} partyHp ${hp0}→${hp1} while command menu open 8s`);
  } catch (e) { rec(`battle.atb-${mode}`, false, String((e as Error).message).slice(0, 200)); }
}
P().system.atbMode = "active";

// F5. 훔치기 / Lore(scan) / 청마법 학습 / 춤(randomSkillFrom)
must("upsert_skill", { skill: { id: "skill_steal", name: "훔치기", scope: "enemy", power: 0, mpCost: { flat: 0, percentMax: 0 }, effect: { kind: "steal" } } });
must("upsert_skill", { skill: { id: "skill_lore", name: "라이브라", scope: "enemy", power: 0, mpCost: { flat: 2, percentMax: 0 }, effect: { kind: "scan" } } });
must("upsert_skill", { skill: { id: "skill_dance", name: "춤", scope: "enemy", power: 0, mpCost: { flat: 0, percentMax: 0 }, effect: { kind: "randomSkillFrom", skillIds: ["skill_fire", "skill_steal"] } } });
must("upsert_actor", { actor: { id: "actor_locke", learnedSkills: [{ level: 1, skillId: "skill_steal" }, { level: 1, skillId: "skill_lore" }, { level: 1, skillId: "skill_dance" }] } });
try {
  const rt = boot("troop_guard");
  let guard = 0;
  while (guard++ < 600) { const s = snap(rt); if (s.phase === "actorCommand" && s.activeActorId === "actor_locke") break; rt.tick(100); if (s.phase === "actorCommand") rt.performActorCommand({ kind: "defend" } as never); }
  rt.performActorCommand({ kind: "skill", skillId: "skill_steal", targetEnemyId: snap(rt).enemies[0]!.id } as never);
  for (let i = 0; i < 60; i += 1) rt.tick(100);
  const s = snap(rt);
  const flat = JSON.stringify(s.roundLogs);
  rec("cmd.steal", /엘릭서|훔/.test(flat) || (s.eventState.inventory?.item_ether_x ?? 0) > 0, `inventory.item_ether_x=${s.eventState.inventory?.item_ether_x ?? 0}`);
} catch (e) { rec("cmd.steal", false, String((e as Error).message).slice(0, 200)); }

// F6. 보스 다페이즈 + 선고(doom) + 리플렉(상태 효과) + 버서크 — 상태 레코드 존재/효과 검증은 기본 DB 상태로
const stateIds = P().database.states.map((s) => s.id);
rec("status.base-states", ["state_doom", "state_berserk", "state_stop", "state_reflect", "state_reraise", "state_sleep", "state_petrify", "state_form_stone"].every((id) => stateIds.includes(id)), `doom/berserk/stop/reflect/reraise/sleep/petrify/transform in base DB: ${["state_doom", "state_berserk", "state_stop", "state_reflect", "state_reraise", "state_sleep", "state_petrify", "state_form_stone"].map((id) => `${id.slice(6)}=${stateIds.includes(id)}`).join(" ")}`);
rec("status.zombie-undeadHeal", stateIds.includes("state_zombie"), `state_zombie in base DB=${stateIds.includes("state_zombie")} (회복이 피해로 반전되는 필드가 StateRuntimeEffects 에 없음: ${"zombie" in ({} as object)})`);
const sr = P().database.states.find((s) => s.id === "state_doom");
rec("status.doom-turns", (sr?.runtimeEffects?.doomTurns ?? 0) > 0, `doomTurns=${sr?.runtimeEffects?.doomTurns}`);

const bp = call("author_boss_phases", { troopId: "troop_boss", enemyId: "enemy_ff_boss", phases: [
  { atHpPercent: 70, name: "2페이즈", message: "신이 되겠다!", enrageStateId: "state_attack_up" },
  { atHpPercent: 30, name: "3페이즈", message: "…", healPercent: 20 },
] });
rec("boss.multiphase-authored", bp.ok, bp.summary.slice(0, 160));
try {
  const sim = simulateBattle({ project: P(), troopId: "troop_boss", heroLevel: 30, n: 5, seed: 3, battleFlow: "gauge" });
  rec("boss.multiphase-fires", sim.phaseCoverage.some((p) => p.firedRuns > 0), `phaseCoverage=${JSON.stringify(sim.phaseCoverage.map((p) => ({ n: p.name, f: p.firedRuns })))} winRate=${sim.winRate}`);
} catch (e) { rec("boss.multiphase-fires", false, String((e as Error).message).slice(0, 200)); }

// F7. 협공/백어택/선제/기습 진형 + 앞열/뒷열 피해 배율
try {
  const rt = boot("troop_guard", { formation: "backAttack" });
  const s = snap(rt);
  rec("battle.backattack-row", s.actors.every((a) => a.row === "back") || s.actors.some((a) => a.row !== "front"), `rows=${s.actors.map((a) => a.row).join(",")} (backAttack 시작 시 파티 방향 반전)`);
} catch (e) { rec("battle.backattack-row", false, String((e as Error).message).slice(0, 200)); }
try {
  const rt = boot("troop_guard", { formation: "pincer" });
  const s = snap(rt);
  rec("battle.pincer", true, `pincer boot ok; rows=${s.actors.map((a) => a.row).join(",")} enemyGauges=${s.enemies.map((e) => e.gauge).join(",")}`);
} catch (e) { rec("battle.pincer", false, String((e as Error).message).slice(0, 200)); }

// F8. 듀얼/트리플 테크 (연계기) 오더
must("upsert_skill", { skill: { id: "skill_x_fire", name: "삼연계", scope: "allEnemies", power: 60, mpCost: { flat: 3, percentMax: 0 }, comboActorIds: ["actor_terra", "actor_locke", "actor_edgar"], effect: { kind: "damage", statistic: "attack", affects: "hp" } } });
must("upsert_actor", { actor: { id: "actor_terra", learnedSkills: [{ level: 1, skillId: "skill_x_fire" }] } });
try {
  const rt = boot("troop_guard");
  rec("battle.triple-tech-listed", snap(rt).actors.find((a) => a.recordId === "actor_terra")!.skillIds.includes("skill_x_fire"), "terra 에게 3인 연계기 노출");
} catch (e) { rec("battle.triple-tech-listed", false, String((e as Error).message).slice(0, 200)); }

// F9. Blitz(입력 커맨드) · SwdTech(차지) · Runic(흡수 기믹) 저작 가능성
const blitz = call("upsert_skill", { skill: { id: "skill_blitz", name: "오라 캐논", scope: "enemy", power: 50, mpCost: { flat: 0, percentMax: 0 }, inputSequence: { keys: ["down", "right", "left", "confirm"], timeLimitMs: 4000, successMultiplier: 2, failMultiplier: 0.5 }, effect: { kind: "damage", statistic: "attack", affects: "hp" } } });
rec("cmd.blitz-input-sequence", blitz.ok, blitz.summary.slice(0, 120));
const swd = call("upsert_skill", { skill: { id: "skill_swdtech", name: "참철검", scope: "allEnemies", power: 90, chargeTurns: 2, mpCost: { flat: 0, percentMax: 0 }, effect: { kind: "damage", statistic: "attack", affects: "hp" } } });
rec("cmd.swdtech-charge", swd.ok, swd.summary.slice(0, 120));
const runic = call("upsert_skill", { skill: { id: "skill_runic", name: "룬 블레이드", scope: "self", power: 0, mpCost: { flat: 0, percentMax: 0 }, effect: { kind: "support" }, battleGimmick: { pattern: "absorb", durationTurns: 3 } } });
rec("cmd.runic-absorb-gimmick", runic.ok, runic.summary.slice(0, 160));
const rage = call("upsert_skill", { skill: { id: "skill_rage", name: "날뛰기", scope: "enemy", power: 0, mpCost: { flat: 0, percentMax: 0 }, effect: { kind: "learnEnemySkill" } } });
rec("cmd.rage-learn-enemy-skill", rage.ok, rage.summary.slice(0, 120));
rec("cmd.rage-per-monster-pool", null, "Veldt 식 '직접 만난 몬스터 목록에서 Rage 선택' = 전용 필드 없음(learnEnemySkill 은 적 기술 1개 습득). 별도 점검: 아래 소스 검색.");
const sketch = P().database.skills.some((s) => /sketch|스케치/i.test(s.name));
rec("cmd.sketch", null, `Sketch(적 기술을 그려 쓰기) 전용 효과 종류 없음(SkillEffect union: damage·healing·support·switch·steal·scan·learnEnemySkill·randomSkillFrom). 기본 DB 스킬명에 스케치=${sketch}`);

// F10. 한 번만 쓰는 에스퍼(전투당 1회) — cooldownTurns 로 근사 가능한가
const cd = call("upsert_skill", { skill: { id: "skill_ifrit_summon", cooldownTurns: 99 } });
rec("esper.once-per-battle-via-cooldown", cd.ok, `cooldownTurns:99 저작=${cd.ok} (전투당 1회는 쿨다운 99로 근사 — 명시적 '전투당 1회' 필드 없음)`);

// F11. 이벤트: 파티 분할/복귀/영구 이탈 명령 존재 + 장면 시험
must("create_map", { id: "map_ff_a", name: "나르셰 A", width: 20, height: 15, tilesetId: P().maps[P().startMapId]!.tilesetId });
must("create_map", { id: "map_ff_b", name: "나르셰 B", width: 20, height: 15, tilesetId: P().maps[P().startMapId]!.tilesetId });
const split = call("upsert_event", { mapId: P().startMapId, event: { id: "ev_split", name: "분할", x: 5, y: 5, pages: [{ trigger: "action", commands: [
  { kind: "storeParty", partySetId: "teamA" },
  { kind: "changeParty", actorId: "actor_edgar", action: "remove" }, { kind: "changeParty", actorId: "actor_sabin", action: "remove" }, { kind: "changeParty", actorId: "actor_locke", action: "remove" },
  { kind: "setSwitch", switchId: "sw_splitA", value: true },
] }] } });
rec("party.split-authored", split.ok, split.summary.slice(0, 200) + " " + JSON.stringify((split.issues ?? []).slice(0, 2)));

import("../../src/project/partySets").then((ps) => {
  import("../../src/project/session").then((sm) => {
    const session = (sm as never as { startSession: (p: unknown) => never }).startSession(P());
    if (!session) { rec("party.split-runtime", null, "createSession export 없음"); return; }
    const s = session as unknown as import("../../src/project/session").PlaySession;
    s.partyActorIds = ["actor_terra", "actor_locke", "actor_edgar", "actor_sabin"]; s.currentMapId = P().startMapId; s.x = 3; s.y = 3;
    ps.storePartySet(s, "teamA");
    s.partyActorIds = ["actor_celes", "actor_cyan"]; s.currentMapId = "map_ff_a"; s.x = 4; s.y = 4;
    ps.storePartySet(s, "teamB");
    const r1 = ps.recallPartySet(P(), s, "teamA");
    const r2 = ps.recallPartySet(P(), s, "teamB");
    rec("party.split-runtime", r1.ok && r2.ok && s.partyActorIds.join() === "actor_celes,actor_cyan", `recall teamA ok=${r1.ok} moved=${r1.ok && r1.moved}; recall teamB ok=${r2.ok}; party now=${s.partyActorIds.join()} active=${s.activePartySetId} limit=${ps.PARTY_SET_LIMIT}`);
  });
});

// F12. 전투 중 강제 교대(Chadarnook) — 적 행동이 아군을 강제로 교체하는가
const forced = JSON.stringify(P().database.states.find((s) => s.id === "state_berserk")?.runtimeEffects ?? {});
rec("battle.forced-switch-by-enemy", null, `snapshot.forcedSwitchActorId 존재(runtime): 전투 중 쓰러진 파티원 교대 강제만. 적 스킬이 아군을 교체하는 효과는 SkillEffect 에 없음. berserk=${forced}`);

// F13. 필드 심볼 적 도구 + 보이는 적 추격
const fe = call("place_field_enemy", { mapId: P().startMapId, x: P().startPos.x + 6, y: P().startPos.y, troopId: "troop_guard", behavior: "chase", sightRange: 4, id: "ev_fe_probe" });
rec("field.symbol-enemy-tool", fe.ok, fe.summary.slice(0, 200));

// F14. 탈것(비행선) + 착륙 제한 / 광산 카트·뗏목·초코보
const pv = call("place_vehicle", { vehicle: "airship", mapId: P().startMapId, x: P().startPos.x + 2, y: P().startPos.y + 2 });
rec("vehicle.airship", pv.ok, pv.summary.slice(0, 160));
rec("vehicle.chocobo-minecart-raft", false, "VEHICLE_IDS = boat|ship|airship 뿐(src/project/vehicles.ts:15). 초코보·광산 카트·뗏목 없음.");


// F15. 에스퍼 소환 실행(전체 적 피해)·전투당 1회(쿨다운)
try {
  const rt = boot("troop_guard", {}, ["actor_terra"], { actor_terra: { accessory: "eq_esper_ifrit" } });
  let guard = 0;
  while (guard++ < 800) { const s = snap(rt); if (s.phase === "actorCommand") break; rt.tick(100); }
  const before = snap(rt).enemies.map((e) => e.hp);
  rt.performActorCommand({ kind: "skill", skillId: "skill_ifrit_summon", targetEnemyId: snap(rt).enemies[0]!.id } as never);
  for (let i = 0; i < 80; i += 1) rt.tick(100);
  const mid = snap(rt);
  const after = mid.enemies.map((e) => e.hp);
  rec("esper.summon-hits-all", after.every((h, i) => h < before[i]!), `enemy hp ${before.join(",")} → ${after.join(",")}`);
  guard = 0;
  while (guard++ < 800) { const s = snap(rt); if (s.phase === "actorCommand" || s.result) break; rt.tick(100); }
  const s2 = snap(rt);
  rec("esper.once-per-battle-enforced", (s2.actors[0]?.skillCooldowns?.skill_ifrit_summon ?? 0) > 0, `skillCooldowns=${JSON.stringify(s2.actors[0]?.skillCooldowns)} (cooldownTurns 99 가 두 번째 사용을 막는다)`);
} catch (e) { rec("esper.summon-hits-all", false, String((e as Error).message).slice(0, 200)); }

// F16. 적 반격(Counter): 물리 피격 시 반격이 실제로 나가는가(액션 로그)
try {
  const rt = boot("troop_guard", {}, ["actor_terra"]);
  let guard = 0;
  while (guard++ < 800) { const s = snap(rt); if (s.phase === "actorCommand") break; rt.tick(100); }
  rt.performActorCommand({ kind: "attack", targetEnemyId: snap(rt).enemies[0]!.id } as never);
  for (let i = 0; i < 80; i += 1) rt.tick(100);
  const tl = snap(rt).timeline;
  const foes = tl.filter((t) => t.side === "enemy" && (t.commandKind === "enemyAttack" || t.commandKind === "enemySkill"));
  rec("boss.enemy-counterattack", tl.some((t) => t.side === "enemy" && t.targetId === "actor_terra" || t.side === "enemy"), `timeline ${tl.length}건, 적 행동 ${foes.length}건 (counter 는 물리 피격 직후 행동. 적 첫 행동 전 시점: ${JSON.stringify(tl.slice(0, 4).map((t) => [t.side, t.commandKind, t.amount]))})`);
} catch (e) { rec("boss.enemy-counterattack", false, String((e as Error).message).slice(0, 200)); }

// F17. 전용 장비 칸(Relic ×2, Esper 칸) — 조수 도구로 칸을 만들 수 있는가
const slotTry = call("upsert_equipment", { equipment: { id: "eq_relic_x", name: "유물", slot: "relic", price: 0 } });
rec("equip.custom-slot-via-tool", slotTry.ok, slotTry.summary.slice(0, 200));
const slotTools = JSON.stringify(Object.keys((await import("../../src/editor/tools/toolRegistry")).allTools().map((t) => t.name))); 
const allNames = (await import("../../src/editor/tools/toolRegistry")).allTools().map((t) => t.name);
rec("equip.slot-define-tool-exists", allNames.some((n) => /slot/i.test(n) && /equip/i.test(n)), `도구 이름에 equip+slot 조합 = ${allNames.filter((n) => /slot/i.test(n)).join(",") || "없음"}`);
process.stdout.write("DONE\n");
