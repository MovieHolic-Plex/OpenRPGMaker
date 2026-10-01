// 선고가 ATB(기본 흐름)·적 셋에서 적을 쓰러뜨린 뒤 그 적이 다시 행동하지 않는가.
import { createBattleRuntime } from "@/battle/runtime";
import { advanceBattleRuntime } from "@/battle/battleRuntimeAdvance";
import { createBlankProject } from "@/project/defaults/blankProject";
import { normalizeSkillRecord, normalizeStateRecord } from "@/project/databaseRecordModel";

const project = createBlankProject();
project.system.battleModel = "rm2k3";
project.system.battleUiStyle = "retro2003";
const hero = project.database.actors[0]!;
hero.initialEquipment = {};
hero.parameterCurves.maxHp = Array(99).fill(999); hero.parameterCurves.agility = Array(99).fill(50);
for (const klass of project.database.classes) klass.learnedSkills = [];
const enemy = project.database.enemies[0]!;
enemy.stats = { ...enemy.stats, maxHp: 99999, attack: 1, agility: 30 };
enemy.actions = [{ skillId: "skill_attack", priority: 5, condition: { kind: "always" } }] as any;
const troop = project.database.troops.find((r) => r.id === project.system.initialTroopId) ?? project.database.troops[0]!;
troop.enemyIds = [enemy.id, enemy.id, enemy.id]; troop.members = [0, 1, 2].map((i) => ({ enemyId: enemy.id, x: 60 + i * 40, y: 80 })); troop.battleEventPages = [];
project.database.states.push(normalizeStateRecord({ id: "doom", name: "선고", runtimeEffects: { doomTurns: 3 }, recoverNaturallyChance: 0 }));
const curse = normalizeSkillRecord({ id: "probe_doom", name: "저주", scope: "enemy", mpCost: { flat: 0, percentMax: 0 }, hitRate: 100, successRate: 100, effect: { kind: "support", statistic: "mind", affects: "hp" } as any, stateEffects: [{ stateId: "doom", operation: "add", chance: 100 }] as any });
project.database.skills.push(curse);
hero.learnedSkills = [{ level: 1, skillId: curse.id }] as any;
const rt = createBattleRuntime({ project, troopId: troop.id, canEscape: false, canLose: true, rng: () => 0.5,
  party: { levels: { [hero.id]: 1 }, experience: {}, partyActorIds: [hero.id] } });
let cursed = false;
for (let i = 0; i < 80 && !rt.snapshot().result; i++) {
  advanceBattleRuntime(rt);
  const s = rt.snapshot();
  if (s.phase !== "actorCommand") continue;
  if (!cursed) { rt.performActorCommand({ kind: "skill", skillId: curse.id, targetEnemyId: s.enemies[0].id } as any); cursed = true; }
  else rt.performActorCommand({ kind: "defend" });
}
const s = rt.snapshot();
console.log("흐름", s.battleFlow ?? "?", "결과", s.result ?? "진행 중");
const tl = s.timeline;
const doomAt = tl.findIndex((e: any) => e.kind === "stateUpkeep" && e.message);
console.log("선고 엔트리", doomAt, tl[doomAt]?.message, tl[doomAt]?.targetId);
console.log("선고 뒤 enemy-1 행동:", tl.slice(doomAt + 1).filter((e: any) => e.userId === "enemy-1" || (e.side === "enemy" && e.kind === "action" && e.userId === "enemy-1")).map((e: any) => e.kind).join(",") || "없음");
console.log("enemy-1 HP", s.enemies[0].hp, s.enemies[0].stateIds);
console.log("선고 뒤 엔트리:", tl.slice(doomAt, doomAt + 12).map((e: any) => `${e.kind}:${e.userId ?? e.userRecordId ?? ""}→${e.targetId ?? ""}`).join(" | "));
