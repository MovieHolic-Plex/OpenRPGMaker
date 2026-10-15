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
const act = (skillId: string) => ({ skillId, priority: 5, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } });
call("upsert_actor", { actor: { id: "actor_ff_gau", name: "가우", classId: "class_hero", initialLevel: 8 } });
call("upsert_actor", { actor: { id: "actor_ff_relm", name: "렐름", classId: "class_hero", initialLevel: 8 } });
call("upsert_actor", { actor: { id: "actor_ff_locke", name: "로크", classId: "class_hero", initialLevel: 8 } });
call("upsert_actor", { actor: { id: "actor_ff_terra", name: "티나", classId: "class_hero", initialLevel: 8 } });
call("set_party", { scope: "start", actorIds: ["actor_ff_gau", "actor_ff_relm", "actor_ff_locke", "actor_ff_terra"] });
call("upsert_enemy", { enemy: { id: "enemy_ff_guard", name: "제국 병사", monsterResourceId: "generated-enemy-bat-01", stats: { maxHp: 700, maxMp: 0, attack: 1, defense: 0, mind: 1, agility: 1 }, rewards: { exp: 20, gold: 5 }, actions: [act("skill_ff_bolt")] } });
call("set_project_settings", { battle: { teams: [{ id: "team_a", name: "가우 팀", actorIds: ["actor_ff_gau", "actor_ff_relm"] }, { id: "team_b", name: "로크 팀", actorIds: ["actor_ff_locke", "actor_ff_terra"] }] } });
call("upsert_troop", { troop: { id: "troop_ff_guard", teamSwapCost: "gauge", name: "제국 병사", enemyIds: ["enemy_ff_guard"], members: [{ enemyId: "enemy_ff_guard", x: 50, y: 55, hidden: false }] } });

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
process.stdout.write(json);
