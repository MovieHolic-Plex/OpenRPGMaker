// FF6 수정 A 런타임 QA 픽스처 — 마석 AP 습득 · 스케치 · 폭주 · 블리츠 입력. 편집기 AI 도구(runTool)만으로 저작한다.
// stdout: 직렬화한 프로젝트 JSON. 출하·원격 저장 없음.
import { createBlankProject } from "../../../src/project/defaults";
import { isPassable } from "../../../src/project/collision";
import { runTool } from "../../../src/editor/tools/toolRunner";
import { deserialize, serialize } from "../../../src/project/io";

const ctx = { project: createBlankProject() };
function call(name: string, args: Record<string, unknown>) {
  const result = runTool(ctx, name, args);
  if (!result.ok) throw new Error(`${name} 실패: ${result.summary} ${JSON.stringify(result.issues ?? [])}`);
  return result;
}
const zero = { flat: 0, percentMax: 0 };
call("set_project_settings", { title: "FF6 수정 A QA", battle: { flow: "gauge", atbMode: "wait", uiStyle: "retro2003" } });
call("upsert_skill", { skill: { id: "skill_ff_bolt", name: "선더", scope: "enemy", power: 40, mpCost: zero, effect: { kind: "damage", statistic: "mind", affects: "hp" } } });
call("upsert_skill", { skill: { id: "skill_ff_bite", name: "물어뜯기", scope: "enemy", power: 40, mpCost: { flat: 99, percentMax: 0 }, effect: { kind: "damage", statistic: "attack", affects: "hp" } } });
call("upsert_skill", { skill: { id: "skill_ff_fire", name: "파이어", scope: "enemy", power: 30, mpCost: { flat: 4, percentMax: 0 }, effect: { kind: "damage", statistic: "mind", affects: "hp" }, elementId: "fire" } });
call("upsert_skill", { skill: { id: "skill_ff_sketch", name: "스케치", scope: "enemy", power: 0, mpCost: zero, effect: { kind: "sketch" } } });
const act = (skillId: string) => ({ skillId, priority: 5, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } });
call("upsert_enemy", { enemy: { id: "enemy_ff_veldt", name: "벨트 사슴", monsterResourceId: "generated-enemy-bat-01", stats: { maxHp: 30, maxMp: 0, attack: 1, defense: 0, mind: 1, agility: 1 }, rewards: { exp: 1, gold: 1 }, actions: [act("skill_ff_bite")] } });
call("upsert_skill", { skill: { id: "skill_ff_rage", name: "폭주", scope: "self", power: 0, mpCost: zero, effect: { kind: "rage", enemyIds: ["enemy_ff_veldt"] } } });
call("upsert_skill", { skill: { id: "skill_ff_blitz", name: "오라 캐논", scope: "enemy", power: 50, mpCost: zero, inputSequence: { keys: ["down", "right", "left", "confirm"], timeLimitMs: 6000, successMultiplier: 2, failMultiplier: 0.5 }, effect: { kind: "damage", statistic: "attack", affects: "hp" } } });
for (const [cls, name, skillId] of [["class_ff_gau", "가우류", "skill_ff_rage"], ["class_ff_relm", "렐름류", "skill_ff_sketch"], ["class_ff_locke", "로크류", "skill_ff_blitz"], ["class_ff_terra", "티나류", ""]] as const) {
  call("upsert_class", { class: { id: cls, name, learnedSkills: skillId ? [{ level: 1, skillId }] : [] } });
}
call("upsert_equipment", { equipment: { id: "eq_ff_ifrit", name: "마석 이프리트", slot: "accessory", price: 0, apGrants: [{ skillId: "skill_ff_fire", ap: 60 }], apRate: 100, levelUpBonus: { mind: 2 }, equippableClassIds: ["class_ff_terra"] } });
call("upsert_actor", { actor: { id: "actor_ff_gau", name: "가우", classId: "class_ff_gau", initialLevel: 8 } });
call("upsert_actor", { actor: { id: "actor_ff_relm", name: "렐름", classId: "class_ff_relm", initialLevel: 8 } });
call("upsert_actor", { actor: { id: "actor_ff_locke", name: "로크", classId: "class_ff_locke", initialLevel: 8 } });
call("upsert_actor", { actor: { id: "actor_ff_terra", name: "티나", classId: "class_ff_terra", initialLevel: 8, initialEquipment: { accessory: "eq_ff_ifrit" } } });
call("set_party", { scope: "start", actorIds: ["actor_ff_gau", "actor_ff_relm", "actor_ff_locke", "actor_ff_terra"] });
call("upsert_enemy", { enemy: { id: "enemy_ff_guard", name: "제국 병사", monsterResourceId: "generated-enemy-bat-01", stats: { maxHp: 700, maxMp: 0, attack: 1, defense: 0, mind: 1, agility: 1 }, rewards: { exp: 20, gold: 5, ap: 70 }, actions: [act("skill_ff_bolt")] } });
call("upsert_troop", { troop: { id: "troop_ff_guard", name: "제국 병사", enemyIds: ["enemy_ff_guard"], members: [{ enemyId: "enemy_ff_guard", x: 50, y: 55, hidden: false }] } });

const mapId = ctx.project.startMapId;
const start = ctx.project.startPos;
call("upsert_event", { mapId, event: {
  id: "ev_ff_battle", x: start.x, y: start.y - 1, trigger: { kind: "action" }, commands: [],
  pages: [{ id: "ev_ff_battle_p1", name: "병사", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [{ kind: "battleProcessing", troopId: "troop_ff_guard", canEscape: true, canLose: true }] }],
} });
if (!isPassable(ctx.project, ctx.project.maps[mapId]!, start.x, start.y)) throw new Error("시작 칸이 막혀 있다");
const json = serialize(ctx.project);
const loaded = deserialize(json);
if (!loaded.database.equipment.some((e) => e.id === "eq_ff_ifrit" && e.apGrants?.length)) throw new Error("마석 apGrants 가 저장·로드에서 사라졌다");
process.stdout.write(json);
