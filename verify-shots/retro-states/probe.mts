// 새 상태 효과 7종 헤드리스 프로브: 회피·반격·도발·감싸기·리플렉·리레이즈·선고.
import { createBattleRuntime } from "@/battle/runtime";
import { createBlankProject } from "@/project/defaults/blankProject";
import { normalizeSkillRecord, normalizeStateRecord } from "@/project/databaseRecordModel";
import type { SkillRecord, StateRuntimeEffects } from "@/project/types";

function setup(effects: Record<string, StateRuntimeEffects>) {
  const project = createBlankProject();
  project.system.battleModel = "rm2k3";
  project.system.battleUiStyle = "retro2003";
  const base = project.database.actors[0]!;
  const second = structuredClone(base); second.id = "actor_probe_two" as any; second.name = "둘째";
  project.database.actors.push(second);
  const enemy = project.database.enemies[0]!;
  const troop = project.database.troops.find((r) => r.id === project.system.initialTroopId) ?? project.database.troops[0]!;
  troop.enemyIds = [enemy.id]; troop.members = [{ enemyId: enemy.id, x: 80, y: 80 }]; troop.battleEventPages = [];
  for (const actor of [base, second]) {
    actor.initialEquipment = {}; actor.learnedSkills = [];
    actor.parameterCurves.maxHp = Array(99).fill(500); actor.parameterCurves.maxMp = Array(99).fill(100);
    actor.parameterCurves.agility = Array(99).fill(999); actor.parameterCurves.attack = Array(99).fill(80);
  }
  for (const klass of project.database.classes) klass.learnedSkills = [];
  enemy.stats = { ...enemy.stats, maxHp: 9999, maxMp: 100, attack: 120, defense: 20, mind: 60, agility: 1 };
  for (const [id, runtimeEffects] of Object.entries(effects)) project.database.states.push(normalizeStateRecord({ id, name: id, runtimeEffects, recoverNaturallyChance: 0 }));
  const skill = (id: string, extra: Partial<SkillRecord>) => { const r = normalizeSkillRecord({ id, name: id, scope: "enemy", power: 30, mpCost: { flat: 0, percentMax: 0 }, variance: 0, hitRate: 100, successRate: 100, effect: { kind: "damage", statistic: "attack", affects: "hp" }, ...extra }); project.database.skills.push(r); return r; };
  const enemyUses = (skillId: string) => { enemy.actions = [{ skillId, priority: 50, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }] as any; };
  enemyUses("skill_attack");
  const start = (party: any = {}) => createBattleRuntime({ project, troopId: troop.id, canEscape: false, canLose: true, battleFlow: "strict", rng: Math.random,
    party: { levels: { [base.id]: 1, [second.id]: 1 }, experience: {}, partyActorIds: [base.id, second.id], ...party } });
  return { project, base, second, enemy, skill, enemyUses, start };
}
const line = (e: any) => `${e.kind}${e.message ? "「" + e.message + "」" : ""} ${e.userRecordId ?? ""}→${e.targetId ?? ""} ${e.amount ?? ""}`;
const enemyHits = (rt: any, id: string) => rt.snapshot().timeline.filter((e: any) => (e.kind === "damage" || e.kind === "miss") && e.side === "enemy" && e.targetId === id);
const rounds = (rt: any, n: number) => { for (let i = 0; i < n && !rt.snapshot().result; i++) rt.performActorCommand({ kind: "defend" }); };

{ // 1 회피
  const s = setup({ evade: { evasionChance: 95 } });
  const rt = s.start({ stateIds: { [s.base.id]: ["evade"], [s.second.id]: ["evade"] } });
  rounds(rt, 10);
  const hits = rt.snapshot().timeline.filter((e: any) => e.side === "enemy" && (e.kind === "damage" || e.kind === "miss"));
  console.log("1 회피 95%: 적 공격", hits.length, "중 빗나감", hits.filter((e: any) => e.kind === "miss").length);
}
{ // 2 반격
  const s = setup({ counter: { counterChance: 100 } });
  const rt = s.start({ stateIds: { [s.base.id]: ["counter"], [s.second.id]: ["counter"] } });
  rounds(rt, 3);
  const tl = rt.snapshot().timeline;
  console.log("2 반격 100%: counter 엔트리", tl.filter((e: any) => e.kind === "counter").length, "· 반격 타격", tl.filter((e: any) => e.side === "actor" && e.commandKind === "attack" && e.kind === "damage").length, "· 적 HP", rt.snapshot().enemies[0].hp);
}
{ // 3 도발
  const s = setup({ taunt: { taunt: true } });
  const rt = s.start({ stateIds: { [s.second.id]: ["taunt"] } });
  rounds(rt, 6);
  const targets = rt.snapshot().timeline.filter((e: any) => e.side === "enemy" && (e.kind === "damage" || e.kind === "miss")).map((e: any) => e.targetId);
  console.log("3 도발(둘째): 적이 노린 대상", JSON.stringify(targets));
}
{ // 4 감싸기
  const s = setup({ cover: { cover: true } });
  const rt = s.start({ stateIds: { [s.second.id]: ["cover"] }, vitals: { [s.base.id]: { hp: 60, mp: 100 } } });
  rounds(rt, 4);
  const tl = rt.snapshot().timeline.filter((e: any) => e.kind === "special" || (e.side === "enemy" && e.kind === "damage"));
  console.log("4 감싸기:", tl.map(line).join(" | "));
}
{ // 5 리플렉
  const s = setup({ reflect: { reflect: true } });
  const fire = s.skill("probe_fire", { power: 50, effect: { kind: "damage", statistic: "mind", affects: "hp" } });
  s.enemyUses(fire.id);
  const rt = s.start({ stateIds: { [s.base.id]: ["reflect"], [s.second.id]: ["reflect"] } });
  rounds(rt, 4);
  const tl = rt.snapshot().timeline.filter((e: any) => e.kind === "special" || e.kind === "damage");
  console.log("5 리플렉:", tl.map(line).join(" | "));
}
{ // 6 리레이즈
  const s = setup({ reraise: { reraisePercent: 30 } });
  const smash = s.skill("probe_smash", { damageFormula: "9999" });
  s.enemyUses(smash.id);
  const rt = s.start({ stateIds: { [s.base.id]: ["reraise"] } });
  rounds(rt, 4);
  const snap = rt.snapshot();
  console.log("6 리레이즈:", snap.timeline.filter((e: any) => e.kind === "revive" || (e.kind === "stateRemoved" && e.stateId === "reraise")).map(line).join(" | "), "· HP", snap.actors.map((a: any) => a.hp).join("/"), "· 상태", JSON.stringify(snap.actors[0].stateIds));
}
{ // 7 선고
  const s = setup({ doom: { doomTurns: 2 } });
  const rt = s.start({ stateIds: { [s.base.id]: ["doom"] } });
  rounds(rt, 3);
  const snap = rt.snapshot();
  console.log("7 선고 2턴:", snap.timeline.filter((e: any) => e.kind === "special" || (e.kind === "stateUpkeep")).map(line).join(" | "), "· HP", snap.actors.map((a: any) => a.hp).join("/"));
}
{ // 8 적에게 선고 — 적이 자기 턴 2번 뒤 쓰러지고 전투가 끝나는가
  const s = setup({ doom: { doomTurns: 2 } });
  const curse = s.skill("probe_doom", { scope: "enemy", effect: { kind: "support", statistic: "mind", affects: "hp" } as any, stateEffects: [{ stateId: "doom", operation: "add", chance: 100 }] as any });
  s.base.learnedSkills = [{ level: 1, skillId: curse.id }] as any;
  const rt = s.start();
  const snap0 = rt.snapshot();
  rt.performActorCommand({ kind: "skill", skillId: curse.id, targetEnemyId: snap0.enemies[0].id } as any);
  rounds(rt, 8);
  const snap = rt.snapshot();
  console.log("8 타임라인:", snap.timeline.slice(0, 12).map((e: any) => e.kind + (e.stateId ? ":" + e.stateId : "") + (e.message ? "「" + e.message + "」" : "")).join(", "));
  console.log("8 적 선고:", snap.timeline.filter((e: any) => e.kind === "special" || (e.kind === "stateAdded" && e.stateId === "doom")).map(line).join(" | "), "· 적 HP", snap.enemies[0].hp, "· 결과", snap.result?.kind ?? snap.result ?? "진행 중");
}
{ // 9 선고 + 리레이즈 — 선고로 쓰러져도 리레이즈가 일으키는가
  const s = setup({ doom: { doomTurns: 1 }, reraise: { reraisePercent: 40 } });
  const rt = s.start({ stateIds: { [s.base.id]: ["doom", "reraise"] } });
  rounds(rt, 3);
  const snap = rt.snapshot();
  console.log("9 선고+리레이즈:", snap.timeline.filter((e: any) => e.kind === "special" || e.kind === "revive").map(line).join(" | "), "· HP", snap.actors.map((a: any) => a.hp).join("/"));
}
