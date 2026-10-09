// Chrono Trigger 전투 엔진 런타임 QA 픽스처(Active ATB · 반격 · 자동 부활 · 적 이동 · 승리 포즈 · 필드 배경).
// 편집기 AI 도구(runTool)만으로 저작한다. stdout: 직렬화한 프로젝트 JSON.
// CT_ENGINE_REPORT 경로가 있으면 호출별 결과를 쓴다. 최소 엔진 픽스처 — 출하·원격 저장 없음.
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

// gauge + active ATB(최고 속도) + 필드 배경. chrono 스킨은 측면 전투라 적 이동이 좌표로 보인다.
call("set_project_settings", {
  title: "CT 엔진 QA",
  battle: { flow: "gauge", uiStyle: "retro2003", atbMode: "active", atbSpeed: 1, backdrop: "field" },
});
call("upsert_class", { class: { id: "class_hero", name: "용사", learnedSkills: [] } });

// 반격 스킬: 확실히 맞고 한 방이 크다(HP 1 로 깎인 주인공을 쓰러뜨린다).
call("upsert_skill", { skill: {
  id: "skill_ct_counter", name: "되받아치기", scope: "enemy", power: 40, description: "맞으면 되받아친다",
  effect: { kind: "damage", statistic: "attack", affects: "hp" }, hitRate: 100, variance: 0,
} });

// 적의 차례 행동: 피해 없는 자세 잡기(통상 공격은 하한 피해 1 로 HP 1 주인공을 먼저 쓰러뜨린다).
call("upsert_skill", { skill: {
  id: "skill_ct_taunt", name: "도발", scope: "self", power: 0, description: "피해 없이 자세를 잡는다",
  effect: { kind: "support" },
} });

// 자동 부활 장신구 — 전투당 1회, 최대 HP 50%.
call("upsert_equipment", { equipment: {
  id: "equip_ct_phoenix", name: "불사조 깃", slot: "accessory", description: "쓰러지면 한 번 일어난다",
  effectFlags: { autoRevive: 50 },
} });
call("upsert_actor", { actor: { id: "actor_hero", name: "크로", learnedSkills: [], initialEquipment: { accessory: "equip_ct_phoenix" } } });
call("set_party", { scope: "start", actorIds: ["actor_hero"] });

// 약하지만 빠른 적(메뉴가 열린 동안 행동) · 물리 반격. 행동 moveTo 는 헤드리스 스크립트(ct-engine-numbers)가 증명한다.
call("upsert_enemy", { enemy: {
  id: "enemy_ct_guard", name: "반격병", monsterResourceId: "generated-enemy-bat-01",
  stats: { maxHp: 150, maxMp: 0, attack: 1, defense: 1, mind: 1, agility: 30 },
  rewards: { exp: 5, gold: 5 },
  actions: [{ skillId: "skill_ct_taunt", priority: 50, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }],
  reactions: [{ trigger: "physical", skillId: "skill_ct_counter", chance: 100 }],
} });
call("upsert_troop", { troop: { id: "troop_ct_guard", name: "반격병", enemyIds: ["enemy_ct_guard"],
  members: [{ enemyId: "enemy_ct_guard", x: 40, y: 60, hidden: false }] } });
// 1라운드에 적을 뒤로 물린다(moveEnemy). 위치 범위기는 이 좌표를 본다.
call("upsert_troop_battle_page", { troopId: "troop_ct_guard", page: {
  id: "ct_move_back", name: "물러선다", span: "battle",
  conditions: [{ kind: "turn", start: 1, interval: 0 }],
  commands: [{ kind: "m2Command", commandId: "m2-218-move-enemy", fields: { target: "enemy-1", x: 30, y: 30, durationMs: 300 } }],
} });

const mapId = project.startMapId;
const map = project.maps[mapId]!;
const blocker = call("place_battle_blocker", { mapId, x: project.startPos.x, y: project.startPos.y - 1, troopId: "troop_ct_guard", id: "ev_ct_guard", intro: ["반격병이 길을 막았다!"] });
const at = blocker.data as { x: number; y: number };
if (!isPassable(project, map, at.x, at.y + 1)) throw new Error(`블로커 남쪽 칸이 막혀 있다: (${at.x}, ${at.y + 1})`);
call("set_start_position", { mapId, x: at.x, y: at.y + 1 });

if (process.env.CT_ENGINE_REPORT) writeFileSync(process.env.CT_ENGINE_REPORT, JSON.stringify({ steps, start: project.startPos, blocker: at }, null, 1));
const json = serialize(ctx.project);
deserialize(json);
process.stdout.write(json);
