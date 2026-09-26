// 필드 위 전투(system.battlePresentation "onField") 런타임 QA 픽스처 — 편집기 AI 도구(runTool)만으로 저작한다.
// stdout: 직렬화한 프로젝트 JSON. 최소 엔진 픽스처 — 출하·원격 저장 없음.
// 시작 맵: 주인공 + 동료 1명(fromParty). 주인공 북쪽 3칸에 전투 심볼(place_battle_blocker, 약한 적 1마리).
// 주인공이 두 칸 올라가 심볼 바로 아래에 서서 말을 걸면 전투가 필드 위에서 시작된다.
import { createBlankProject } from "../../../src/project/defaults";
import { isPassable } from "../../../src/project/collision";
import { runTool } from "../../../src/editor/tools/toolRunner";
import { deserialize, serialize } from "../../../src/project/io";

const project = createBlankProject();
const ctx = { project };

function call(name: string, args: Record<string, unknown>): ReturnType<typeof runTool> {
  const result = runTool(ctx, name, args);
  if (!result.ok) throw new Error(`${name} 실패: ${result.summary} ${JSON.stringify(result.issues ?? [])}`);
  return result;
}

call("set_project_settings", {
  title: "CT 필드 위 전투 QA",
  battle: { flow: "gauge", uiStyle: "chrono", atbSpeed: 1, presentation: "onField" },
});
call("set_party", { scope: "start", actorIds: ["actor_hero", "actor_guardian"] });
call("configure_companion_rules", { fromParty: true });
// 한 방에 쓰러지는 느린 적 — 전투를 짧게 끝내 복귀 좌표를 본다.
call("upsert_enemy", { enemy: {
  id: "enemy_onfield_slime", name: "들판 박쥐", monsterResourceId: "generated-enemy-bat-01",
  stats: { maxHp: 1, maxMp: 0, attack: 1, defense: 0, mind: 1, agility: 1 },
  rewards: { exp: 1, gold: 1 },
} });
call("upsert_troop", { troop: { id: "troop_onfield", name: "들판 박쥐", enemyIds: ["enemy_onfield_slime"],
  members: [{ enemyId: "enemy_onfield_slime", x: 40, y: 60, hidden: false }] } });

const mapId = project.startMapId;
const map = project.maps[mapId]!;
const start = project.startPos;
const blocker = call("place_battle_blocker", { mapId, x: start.x, y: start.y - 3, troopId: "troop_onfield", id: "ev_onfield_bat" });
const at = blocker.data as { x: number; y: number };
for (const dy of [1, 2, 3]) {
  if (!isPassable(project, map, at.x, at.y + dy)) throw new Error(`심볼 남쪽 ${dy}칸이 막혀 있다: (${at.x}, ${at.y + dy})`);
}
call("set_start_position", { mapId, x: at.x, y: at.y + 3 });

const json = serialize(ctx.project);
const reloaded = deserialize(json);
if (reloaded.system.battlePresentation !== "onField") throw new Error("battlePresentation did not survive reload");
process.stdout.write(json);
