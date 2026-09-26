// Chrono Trigger 기술 3종(연계기·위치 범위기·기술 포인트) 런타임 QA 픽스처.
// 편집기 AI 도구(runTool)만으로 저작한다. stdout: 직렬화한 프로젝트 JSON.
// CT_TECHS_REPORT 경로가 있으면 호출별 결과를 쓴다. 최소 엔진 픽스처 — 출하·원격 저장 없음.
import { writeFileSync } from "node:fs";
import { createBlankProject } from "../../../src/project/defaults";
import { isPassable } from "../../../src/project/collision";
import { runTool } from "../../../src/editor/tools/toolRunner";
import { deserialize, serialize } from "../../../src/project/io";

const project = createBlankProject();
const ctx = { project };
const steps: { tool: string; ok: boolean; summary: string; issues?: string[] }[] = [];

function call(name: string, args: Record<string, unknown>): ReturnType<typeof runTool> {
  const result = runTool(ctx, name, args);
  steps.push({
    tool: name, ok: result.ok, summary: result.summary.slice(0, 300),
    ...(result.ok ? {} : { issues: (result.issues ?? []).map((issue) => `${issue.code}: ${issue.message}`.slice(0, 300)) }),
  });
  if (!result.ok) throw new Error(`${name} 실패: ${result.summary} ${JSON.stringify(result.issues ?? [])}`);
  return result;
}

call("set_project_settings", { title: "CT 기술 QA", battle: { flow: "strict" } });
// 기본 직업 습득표를 비워 기술 목록을 짧게 둔다(스크롤 밖으로 밀리면 클릭 검증이 흔들린다).
call("upsert_class", { class: { id: "class_hero", name: "용사", learnedSkills: [] } });
call("upsert_class", { class: { id: "class_mage", name: "마도사", learnedSkills: [] } });

call("upsert_skill", { skill: {
  id: "skill_ct_blast", name: "회오리참", scope: "enemy", power: 30, description: "주 대상 둘레를 함께 벤다",
  mpCost: { flat: 2, percentMax: 0 }, area: { shape: "circle", radius: 60 },
} });
call("upsert_skill", { skill: {
  id: "skill_x_strike", name: "X베기", scope: "enemy", power: 60, description: "두 사람이 교차해 벤다",
  mpCost: { flat: 3, percentMax: 0 }, comboActorIds: ["actor_hero", "actor_mage"],
} });
call("upsert_skill", { skill: { id: "skill_ct_tp_tech", name: "비검", scope: "enemy", power: 40, description: "기술 포인트로 익힌다" } });

call("upsert_actor", { actor: { id: "actor_hero", name: "크로", learnedSkills: [
  { level: 1, skillId: "skill_ct_blast" },
  { level: 1, skillId: "skill_ct_tp_tech", tp: 5 },
] } });
call("upsert_actor", { actor: { id: "actor_mage", name: "루카", learnedSkills: [] } });
call("set_party", { scope: "start", actorIds: ["actor_hero", "actor_mage"] });

// 단단하고 약한 적: 전투가 끝나지 않고 파티도 쓰러지지 않는다. TP 3 × 3마리.
call("upsert_enemy", { enemy: {
  id: "enemy_ct_block", name: "통나무", monsterResourceId: "generated-enemy-bat-01",
  stats: { maxHp: 3000, maxMp: 0, attack: 1, defense: 1, mind: 1, agility: 1 }, rewards: { exp: 5, gold: 5, tp: 3 },
} });
// 전투장 좌표(<=150 이라 재배치되지 않는다): 1·2 는 40px, 3 은 약 128px 떨어져 있다.
call("upsert_troop", { troop: { id: "troop_ct_logs", name: "통나무 셋", enemyIds: ["enemy_ct_block", "enemy_ct_block", "enemy_ct_block"],
  members: [
    { enemyId: "enemy_ct_block", x: 40, y: 100, hidden: false },
    { enemyId: "enemy_ct_block", x: 80, y: 100, hidden: false },
    { enemyId: "enemy_ct_block", x: 140, y: 20, hidden: false },
  ] } });

const mapId = project.startMapId;
const map = project.maps[mapId]!;
const blocker = call("place_battle_blocker", { mapId, x: project.startPos.x, y: project.startPos.y - 1, troopId: "troop_ct_logs", id: "ev_ct_logs", intro: ["통나무가 길을 막았다!"] });
const at = blocker.data as { x: number; y: number };
if (!isPassable(project, map, at.x, at.y + 1)) throw new Error(`블로커 남쪽 칸이 막혀 있다: (${at.x}, ${at.y + 1})`);
call("set_start_position", { mapId, x: at.x, y: at.y + 1 });

if (process.env.CT_TECHS_REPORT) writeFileSync(process.env.CT_TECHS_REPORT, JSON.stringify({ steps, start: project.startPos, blocker: at }, null, 1));
const json = serialize(ctx.project);
deserialize(json);
process.stdout.write(json);
