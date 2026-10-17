// FF6 수정 A 헤드리스 프로브(성장): 마석 AP 영구 습득 · 레벨업 보너스 · 장비 부위 도구 · 전투당 1회.
// 실제 도구(runTool)로 저작하고 실제 전투 런타임(createBattleRuntime) + 실제 세션 정산(applyBattleRewardsToSession)을 돌린다.
// 실행: node node_modules/vite-node/dist/cli.mjs --script scripts/qa/ff6-fix-a-growth-probe.mts
import { createBlankProject } from "../../src/project/defaults";
import { runTool } from "../../src/editor/tools/toolRunner";
import { createBattleRuntime, headlessBattleSnapshot, type BattleResult } from "../../src/battle/runtime";
import { mulberry32 } from "../../src/util/rng";
import { startSession, type PlaySession } from "../../src/project/session";
import { applyBattleRewardsToSession } from "../../src/player/battleRewardsToSession";
import { applySaveSnapshot, createSaveSnapshot } from "../../src/player/saveSlots";
import { effectiveActorEquipment } from "../../src/project/equipmentRules";
import { normalizeActorRecord } from "../../src/project/actorModel";

const ctx = { project: createBlankProject() };
const P = () => ctx.project;
const rec = (id: string, ok: boolean | null, detail: string) => process.stdout.write(JSON.stringify({ id, ok, detail }) + "\n");
const call = (name: string, args: Record<string, unknown>) => runTool(ctx, name, args);
const must = (name: string, args: Record<string, unknown>) => {
  const r = call(name, args);
  if (!r.ok) throw new Error(`${name}: ${r.summary} ${JSON.stringify((r.issues ?? []).slice(0, 3))}`);
  return r;
};

must("set_project_settings", { title: "FF6 fix A growth", battle: { flow: "gauge", atbMode: "active", atbSpeed: 4 } });
must("upsert_actor", { actor: { id: "actor_terra", name: "티나", classId: "class_hero", initialLevel: 5, maxLevel: 99 } });
must("upsert_actor", { actor: { id: "actor_locke", name: "로크", classId: "class_hero", initialLevel: 5, maxLevel: 99 } });
must("set_party", { scope: "start", actorIds: ["actor_terra", "actor_locke"] });
must("upsert_skill", { skill: { id: "skill_fire", name: "파이어", scope: "enemy", power: 30, mpCost: { flat: 4, percentMax: 0 }, effect: { kind: "damage", statistic: "mind", affects: "hp" }, elementId: "fire" } });
must("upsert_skill", { skill: { id: "skill_ifrit_summon", name: "이프리트", scope: "allEnemies", power: 80, mpCost: { flat: 0, percentMax: 0 }, oncePerBattle: true, effect: { kind: "damage", statistic: "mind", affects: "hp" }, elementId: "fire" } });
// 마석: 장착 중 이프리트 소환·파이어 사용, AP 40 으로 파이어 영구 습득(습득률 150%), 레벨업마다 HP +10%·마력 +2.
must("upsert_equipment", { equipment: { id: "eq_esper_ifrit", name: "마석 이프리트", slot: "accessory", price: 0,
  grantsSkillIds: ["skill_ifrit_summon"], apGrants: [{ skillId: "skill_fire", ap: 40 }], apRate: 150,
  levelUpBonus: { maxHpPercent: 10, mind: 2 }, equippableActorIds: ["actor_terra"], equippableClassIds: ["class_hero"] } });
must("upsert_actor", { actor: { id: "actor_terra", initialEquipment: { accessory: "eq_esper_ifrit" } } });
must("upsert_enemy", { enemy: { id: "enemy_ff_weak", name: "병사", monsterResourceId: "generated-enemy-knight-fallen", stats: { maxHp: 5, maxMp: 0, attack: 1, defense: 0, mind: 1, agility: 1 }, rewards: { exp: 15000, gold: 1, ap: 20 } } });
must("upsert_troop", { troop: { id: "troop_weak", name: "병사", enemyIds: ["enemy_ff_weak"], members: [{ enemyId: "enemy_ff_weak", x: 60, y: 80 }] } });

function fightToVictory(session: PlaySession) {
  const rt = createBattleRuntime({
    project: P(), troopId: "troop_weak", canEscape: true, canLose: true, battleFlow: "gauge",
    party: { levels: session.actorLevels, experience: session.actorExperience, partyActorIds: session.partyActorIds, equipment: session.actorEquipment, paramBonuses: session.actorParamBonuses, skillIds: session.actorSkillIds, vitals: session.actorVitals },
    sessionState: { switches: session.switches, variables: session.variables, inventory: session.inventory, actorLevels: session.actorLevels, actorExperience: session.actorExperience, actorSkillIds: session.actorSkillIds, actorEquipment: session.actorEquipment, actorApProgress: session.actorApProgress, learnedViaAp: session.learnedViaAp, partyActorIds: session.partyActorIds },
    captureLocation: { mapId: P().startMapId, x: 1, y: 1 }, rng: mulberry32(5),
  } as never);
  let guard = 0;
  while (guard++ < 600) {
    const s = headlessBattleSnapshot(rt);
    if (s.result) break;
    if (s.phase === "actorCommand") rt.performActorCommand({ kind: "attack", targetEnemyId: s.enemies.find((e) => e.hp > 0)!.id } as never);
    else if (s.phase === "targetSelect") rt.selectTarget?.(s.targetSelection!.targetIds[0]!);
    else rt.tick(100);
  }
  const s = headlessBattleSnapshot(rt);
  return { rt, s };
}
function settle(session: PlaySession) {
  const { s } = fightToVictory(session);
  const result = s.result as BattleResult;
  const levelUps = applyBattleRewardsToSession(session, { result, rewards: s.rewards, actors: s.actors, eventState: s.eventState, participatingActorIds: s.actors.map((a) => a.recordId) }, P());
  return { s, levelUps };
}

// ── G1/G2: 마석 AP 영구 습득, 장비 해제 후에도 유지 ──────────────────────────────────────────
try {
  const session = startSession(P());
  session.actorEquipment = { actor_terra: { accessory: "eq_esper_ifrit" } };
  session.actorLevels = { actor_terra: 5, actor_locke: 5 }; session.actorExperience = { actor_terra: 0, actor_locke: 0 };
  const first = settle(session);
  const afterOne = { ...(session.actorApProgress?.actor_terra ?? {}) };
  const learnedOne = session.actorSkillIds.actor_terra?.includes("skill_fire") ?? false;
  const preview = JSON.stringify(first.s.rewards.techLearned ?? []);
  session.actorLevels.actor_terra = 5; session.actorExperience.actor_terra = 0; // 레벨업이 따로 간섭하지 않게 되돌림
  const second = settle(session);
  const learned = session.actorSkillIds.actor_terra?.includes("skill_fire") ?? false;
  rec("esper.ap-accumulates", afterOne.skill_fire === 30 && !learnedOne, `1승 뒤 skill_fire AP=${afterOne.skill_fire}(적 AP 20×150%=30), 아직 미습득=${!learnedOne}, 미리보기 techLearned=${preview}`);
  rec("esper.ap-learns-at-threshold", learned && session.learnedViaAp?.actor_terra?.includes("skill_fire") === true && JSON.stringify(second.s.rewards.techLearned ?? []).includes("skill_fire"), `2승 뒤 AP=${session.actorApProgress?.actor_terra?.skill_fire} 습득=${learned} learnedViaAp=${JSON.stringify(session.learnedViaAp)} 결과미리보기=${JSON.stringify(second.s.rewards.techLearned ?? [])}`);
  // 해제 후 새 전투
  session.actorEquipment = { actor_terra: {} };
  const rt = createBattleRuntime({ project: P(), troopId: "troop_weak", canEscape: true, canLose: true, battleFlow: "gauge",
    party: { levels: session.actorLevels, experience: {}, partyActorIds: ["actor_terra"], equipment: session.actorEquipment, skillIds: session.actorSkillIds },
    sessionState: { switches: {}, variables: {}, inventory: {}, actorSkillIds: session.actorSkillIds, actorEquipment: session.actorEquipment },
    captureLocation: { mapId: P().startMapId, x: 1, y: 1 }, rng: mulberry32(1) } as never);
  const terra = headlessBattleSnapshot(rt).actors.find((a) => a.recordId === "actor_terra")!;
  rec("esper.permanent-learn-after-unequip", terra.skillIds.includes("skill_fire") && !(terra.equipmentEffects?.grantedSkillIds ?? []).includes("skill_ifrit_summon"), `장비 해제 뒤 파이어 보유=${terra.skillIds.includes("skill_fire")} 이프리트 소환(장착 전용) 보유=${(terra.equipmentEffects?.grantedSkillIds ?? []).includes("skill_ifrit_summon")}`);
  // 세이브 왕복
  const reloaded = applySaveSnapshot(P(), JSON.parse(JSON.stringify(createSaveSnapshot(P(), session))));
  rec("esper.save-roundtrip", reloaded.actorApProgress?.actor_terra?.skill_fire === session.actorApProgress?.actor_terra?.skill_fire && reloaded.learnedViaAp?.actor_terra?.includes("skill_fire") === true, `actorApProgress=${JSON.stringify(reloaded.actorApProgress)} learnedViaAp=${JSON.stringify(reloaded.learnedViaAp)}`);
} catch (e) { rec("esper.ap-learns-at-threshold", false, String((e as Error).stack).slice(0, 400)); }

// ── G3: 마석 레벨업 보너스 ──────────────────────────────────────────────────────────────────
try {
  const session = startSession(P());
  session.actorEquipment = { actor_terra: { accessory: "eq_esper_ifrit" }, actor_locke: {} };
  session.actorLevels = { actor_terra: 5, actor_locke: 5 }; session.actorExperience = { actor_terra: 0, actor_locke: 0 };
  session.actorParamBonuses = {};
  const { levelUps } = settle(session);
  const t = levelUps.find((l) => l.actorId === "actor_terra");
  const l = levelUps.find((l) => l.actorId === "actor_locke");
  const bonuses = session.actorParamBonuses?.actor_terra;
  rec("esper.levelup-bonus", Boolean(t?.equipmentBonus?.maxHp && bonuses?.maxHp && bonuses.mind === ((t?.toLevel ?? 5) - (t?.fromLevel ?? 5)) * 2) && !session.actorParamBonuses?.actor_locke, `티나 Lv${t?.fromLevel}→${t?.toLevel} 보너스=${JSON.stringify(t?.equipmentBonus)} actorParamBonuses=${JSON.stringify(bonuses)} / 로크(마석 없음) 보너스=${JSON.stringify(l?.equipmentBonus)}`);
  const rt = createBattleRuntime({ project: P(), troopId: "troop_weak", canEscape: true, canLose: true, battleFlow: "gauge",
    party: { levels: session.actorLevels, experience: {}, partyActorIds: ["actor_terra"], equipment: { actor_terra: {} }, paramBonuses: session.actorParamBonuses },
    sessionState: { switches: {}, variables: {}, inventory: {} }, captureLocation: { mapId: P().startMapId, x: 1, y: 1 }, rng: mulberry32(1) } as never);
  const base = createBattleRuntime({ project: P(), troopId: "troop_weak", canEscape: true, canLose: true, battleFlow: "gauge",
    party: { levels: session.actorLevels, experience: {}, partyActorIds: ["actor_terra"], equipment: { actor_terra: {} } },
    sessionState: { switches: {}, variables: {}, inventory: {} }, captureLocation: { mapId: P().startMapId, x: 1, y: 1 }, rng: mulberry32(1) } as never);
  const a = headlessBattleSnapshot(rt).actors[0]!; const b = headlessBattleSnapshot(base).actors[0]!;
  rec("esper.levelup-bonus-persists-unequipped", a.maxHp > b.maxHp && (a.effectiveStats?.mind ?? 0) > (b.effectiveStats?.mind ?? 0), `장비 해제 뒤 maxHp ${b.maxHp}→${a.maxHp}, 마력 ${b.effectiveStats?.mind}→${a.effectiveStats?.mind}`);
} catch (e) { rec("esper.levelup-bonus", false, String((e as Error).stack).slice(0, 400)); }

// ── G4: 장비 부위 도구(유물 2칸) ────────────────────────────────────────────────────────────
try {
  const err = call("upsert_equipment", { equipment: { id: "eq_relic_a", name: "영웅의 반지", slot: "relic", price: 0, equippableActorIds: ["actor_terra"], equippableClassIds: ["class_hero"] } });
  rec("equip.unknown-slot-guides-to-tool", !err.ok && /upsert_equipment_slot/.test(err.summary), err.summary.slice(0, 240));
  must("upsert_equipment_slot", { slots: [{ id: "relic", label: "유물" }, { id: "relic_2", label: "유물 2", equipsAs: "relic" }] });
  must("upsert_equipment", { equipment: { id: "eq_relic_a", name: "영웅의 반지", slot: "relic", price: 0, statBonuses: { attack: 3 }, equippableActorIds: ["actor_terra"], equippableClassIds: ["class_hero"] } });
  must("upsert_equipment", { equipment: { id: "eq_relic_b", name: "방어의 반지", slot: "relic", price: 0, statBonuses: { defense: 3 }, equippableActorIds: ["actor_terra"], equippableClassIds: ["class_hero"] } });
  must("upsert_actor", { actor: { id: "actor_terra", initialEquipment: { accessory: "eq_esper_ifrit", relic: "eq_relic_a", relic_2: "eq_relic_b" } } });
  const actor = P().database.actors.find((a) => a.id === "actor_terra")!;
  const eq = effectiveActorEquipment(P(), normalizeActorRecord(actor), actor.initialEquipment, actor.classId);
  rec("equip.custom-slot-via-tool", eq.relic === "eq_relic_a" && eq.relic_2 === "eq_relic_b", `effective equipment=${JSON.stringify(eq)} slots=${JSON.stringify(P().database.equipmentSlots)}`);
  const bad = call("upsert_equipment_slot", { slots: [{ id: "weapon", label: "무기", equipsAs: "relic" }] });
  rec("equip.slot-tool-rejects-builtin-equipsAs", !bad.ok, bad.summary.slice(0, 200));
  const unknownKey = call("upsert_equipment_slot", { slots: [{ id: "x1", label: "x", bogus: 1 }] });
  rec("equip.slot-tool-rejects-unknown-key", !unknownKey.ok, unknownKey.summary.slice(0, 200));
  const rm = call("upsert_equipment_slot", { removeIds: ["relic"] });
  rec("equip.slot-tool-blocks-removal-of-used-slot", !rm.ok, rm.summary.slice(0, 200));
  const badAp = call("upsert_equipment", { equipment: { id: "eq_esper_ifrit", apGrants: [{ skillId: "skill_nope", ap: 10 }] } });
  rec("equip.apgrants-unknown-skill-guides", !badAp.ok && /upsert_skill/.test(badAp.summary), badAp.summary.slice(0, 200));
  const badKey = call("upsert_equipment", { equipment: { id: "eq_esper_ifrit", apPoints: 5 } });
  rec("equip.unknown-key-rejected", !badKey.ok, badKey.summary.slice(0, 200));
} catch (e) { rec("equip.custom-slot-via-tool", false, String((e as Error).stack).slice(0, 400)); }

// ── G5: 전투당 1회 ──────────────────────────────────────────────────────────────────────────
try {
  must("upsert_enemy", { enemy: { id: "enemy_ff_tank", name: "철벽", monsterResourceId: "generated-enemy-knight-fallen", stats: { maxHp: 9000, maxMp: 0, attack: 1, defense: 0, mind: 1, agility: 1 }, rewards: { exp: 1, gold: 1 } } });
  must("upsert_troop", { troop: { id: "troop_tank", name: "철벽", enemyIds: ["enemy_ff_tank"], members: [{ enemyId: "enemy_ff_tank", x: 60, y: 80 }] } });
  const rt = createBattleRuntime({ project: P(), troopId: "troop_tank", canEscape: true, canLose: true, battleFlow: "gauge",
    party: { levels: { actor_terra: 20 }, experience: {}, partyActorIds: ["actor_terra"], equipment: { actor_terra: { accessory: "eq_esper_ifrit" } } },
    sessionState: { switches: {}, variables: {}, inventory: {} }, captureLocation: { mapId: P().startMapId, x: 1, y: 1 }, rng: mulberry32(2) } as never);
  const cast = (): void => {
    let g = 0;
    while (g++ < 600 && headlessBattleSnapshot(rt).phase !== "actorCommand") rt.tick(100);
    rt.performActorCommand({ kind: "skill", skillId: "skill_ifrit_summon", targetEnemyId: headlessBattleSnapshot(rt).enemies[0]!.id } as never);
    for (let i = 0; i < 40; i += 1) rt.tick(100);
  };
  cast();
  const hpAfterFirst = headlessBattleSnapshot(rt).enemies[0]!.hp;
  let g = 0;
  while (g++ < 800) { const s = headlessBattleSnapshot(rt); if (s.phase === "actorCommand") rt.performActorCommand({ kind: "defend" } as never); else rt.tick(100); if (g > 700) break; }
  const s2 = headlessBattleSnapshot(rt);
  const lock = s2.actors[0]!.skillCooldowns?.skill_ifrit_summon ?? 0;
  let rejected = false;
  try { rt.performActorCommand({ kind: "skill", skillId: "skill_ifrit_summon", targetEnemyId: s2.enemies[0]!.id } as never); } catch { rejected = true; }
  const hp2 = headlessBattleSnapshot(rt).enemies[0]!.hp;
  rec("esper.once-per-battle-enforced", hpAfterFirst < 9000 && lock > 0 && (rejected || hp2 >= s2.enemies[0]!.hp), `첫 소환 후 적 HP=${hpAfterFirst} · ${g}틱 뒤 잠금=${lock > 1000 ? "영구" : lock} · 두 번째 시전 ${rejected ? "거부됨" : "피해 없음"}`);
} catch (e) { rec("esper.once-per-battle-enforced", false, String((e as Error).stack).slice(0, 400)); }
process.stdout.write("DONE\n");
