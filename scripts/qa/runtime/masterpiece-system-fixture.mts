// 명작 공백 시스템·연출 런타임 QA 픽스처(2026-09-27) — 난이도 선택(#19) · 흑백 화면 필터(#37) ·
// 롤링 HP·움직이는 전투 배경(#15) · 라이브라(#20 #10). 편집기 AI 도구(runTool)만으로 저작한다.
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

call("set_project_settings", { title: "명작 공백 시스템 QA", battle: { rollingHp: true, rollingHpPerSecond: 20 } });
// 난이도 두 줄 — 새 게임이 고르게 한다. 어려움은 적 HP 2배.
ctx.project.system.difficulties = [
  { id: "easy", name: "쉬움", enemyHpRate: 0.5 },
  { id: "hard", name: "어려움", enemyHpRate: 2 },
];
ctx.project.system.defaultDifficultyId = "easy";

call("upsert_class", { class: { id: "class_hero", name: "용사", learnedSkills: [] } });
call("upsert_skill", { skill: {
  id: "skill_libra", name: "라이브라", scope: "enemy", power: 0, description: "적의 HP·약점을 본다",
  effect: { kind: "scan" }, hitRate: 100, mpCost: { flat: 0, percentMax: 0 },
} });
call("upsert_actor", { actor: { id: "actor_hero", name: "렌", learnedSkills: ["skill_libra"] } });
call("set_party", { scope: "start", actorIds: ["actor_hero"] });
call("upsert_enemy", { enemy: {
  id: "enemy_mg_ghost", name: "유령", monsterResourceId: "generated-enemy-bat-01",
  stats: { maxHp: 100, maxMp: 0, attack: 30, defense: 1, mind: 1, agility: 1 },
  rewards: { exp: 1, gold: 1 },
} });
call("upsert_troop", { troop: {
  id: "troop_mg_ghost", name: "유령", enemyIds: ["enemy_mg_ghost"],
  members: [{ enemyId: "enemy_mg_ghost", x: 50, y: 55, hidden: false }],
  backdropAnimation: { scrollX: 30, waveAmplitude: 6, waveFrequency: 1, paletteCycleSeconds: 8 },
} });

const mapId = ctx.project.startMapId;
const start = ctx.project.startPos;
// 위: 흑백 필터(회상 연출) → 전투. 조사 한 번으로 둘 다 본다.
call("upsert_event", { mapId, event: {
  id: "ev_mg_memory", x: start.x, y: start.y - 1, trigger: { kind: "action" }, commands: [],
  pages: [{ id: "ev_mg_memory_p1", name: "기억", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [
      { kind: "m2Command", commandId: "m2-046-tint-screen", fields: { color: "neutral", value: "", durationMs: 0, saturation: 0, grayscale: 100, sepia: 0 } },
      { kind: "text", body: "빛바랜 기억이다." },
      { kind: "battleProcessing", troopId: "troop_mg_ghost", canEscape: true, canLose: true },
    ] }],
} });
if (!isPassable(ctx.project, ctx.project.maps[mapId]!, start.x, start.y)) throw new Error("시작 칸이 막혀 있다");
const json = serialize(ctx.project);
const loaded = deserialize(json);
if (loaded.system.difficulties?.length !== 2) throw new Error("난이도가 저장·로드에서 사라졌다");
process.stdout.write(json);
