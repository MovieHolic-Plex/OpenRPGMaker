// 명작 공백 전투 규칙 런타임 QA 픽스처(2026-09-27) — 선제 공격 배너(#3) · 리미트·기력 게이지(#9 #21) ·
// 파티 공용 게이지(#16). 편집기 AI 도구(runTool)만으로 저작한다. stdout: 직렬화한 프로젝트 JSON. 출하·원격 저장 없음.
import { createBlankProject } from "../../../src/project/defaults";
import { isPassable } from "../../../src/project/collision";
import { runTool } from "../../../src/editor/tools/toolRunner";
import { deserialize, serialize } from "../../../src/project/io";

const project = createBlankProject();
const ctx = { project };
function call(name: string, args: Record<string, unknown>) {
  const result = runTool(ctx, name, args);
  if (!result.ok) throw new Error(`${name} 실패: ${result.summary} ${JSON.stringify(result.issues ?? [])}`);
  return result;
}

call("set_project_settings", {
  title: "명작 공백 전투 QA",
  battle: {
    limitGauge: { enabled: true, label: "리미트", takenRate: 100, dealtGain: 20 },
    resource2: { enabled: true, label: "기력", max: 50, start: 10, dealtGain: 10, takenGain: 10 },
    partyGauge: { enabled: true, label: "연계", max: 100, gainPerHit: 25 },
  },
});
call("upsert_class", { class: { id: "class_hero", name: "용사", learnedSkills: [] } });
call("upsert_actor", { actor: { id: "actor_hero", name: "렌", learnedSkills: [] } });
call("upsert_actor", { actor: { id: "actor_mage", name: "시아", learnedSkills: [] } });
call("set_party", { scope: "start", actorIds: ["actor_hero", "actor_mage"] });

call("upsert_enemy", { enemy: {
  id: "enemy_mg_slime", name: "단단한 슬라임", monsterResourceId: "generated-enemy-bat-01",
  stats: { maxHp: 400, maxMp: 0, attack: 4, defense: 1, mind: 1, agility: 1 },
  rewards: { exp: 5, gold: 5 },
} });
call("upsert_troop", { troop: { id: "troop_mg_slime", name: "슬라임", enemyIds: ["enemy_mg_slime"],
  members: [{ enemyId: "enemy_mg_slime", x: 50, y: 55, hidden: false }] } });

const mapId = ctx.project.startMapId;
const map = ctx.project.maps[mapId]!;
const start = ctx.project.startPos;
// 선제 공격을 강제하는 전투 처리(battleProcessing.formation). 굴림 없이 배너·게이지를 결정적으로 본다.
call("upsert_event", { mapId, event: {
  id: "ev_mg_slime", x: start.x, y: start.y - 1, trigger: { kind: "action" }, commands: [],
  pages: [{ id: "ev_mg_slime_p1", name: "슬라임", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [{ kind: "battleProcessing", troopId: "troop_mg_slime", canEscape: true, canLose: true, formation: "preemptive" }] }],
} });
if (!isPassable(ctx.project, map, start.x, start.y)) throw new Error("시작 칸이 막혀 있다");
const json = serialize(ctx.project);
deserialize(json);
process.stdout.write(json);
