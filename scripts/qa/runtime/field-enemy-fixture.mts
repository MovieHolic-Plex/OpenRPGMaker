// 필드 적(place_field_enemy) 런타임 QA 픽스처 — 편집기 AI 도구(runTool)만으로 저작한다.
// stdout: 직렬화한 프로젝트 JSON(최소 엔진 픽스처, 원격 저장 없음).
// 시작 맵에 시야 추격 박쥐 한 마리, 둘째 맵에 순찰·보초 박쥐. 둘째 맵과는 이동 이벤트로 잇는다.
import { createBlankProject } from "../../../src/project/defaults";
import { runTool } from "../../../src/editor/tools/toolRunner";
import { deserialize, serialize } from "../../../src/project/io";

const project = createBlankProject();
const ctx = { project };
const log = (...args: unknown[]) => process.stderr.write(args.map(String).join(" ") + "\n");

function call(name: string, args: Record<string, unknown>): ReturnType<typeof runTool> {
  const result = runTool(ctx, name, args);
  if (!result.ok) throw new Error(`${name} 실패: ${result.summary} ${JSON.stringify(result.issues ?? [])}`);
  return result;
}

call("set_project_settings", { title: "필드 적 QA", battle: { flow: "gauge", uiStyle: "retro2003", atbSpeed: 1, formationRoll: true } });
call("upsert_enemy", { enemy: {
  id: "enemy_field_bat", name: "박쥐", monsterResourceId: "generated-enemy-bat-01",
  stats: { maxHp: 1, maxMp: 0, attack: 1, defense: 0, mind: 1, agility: 1 }, rewards: { exp: 1, gold: 1 },
} });
call("upsert_troop", { troop: { id: "troop_field_bat", name: "박쥐", enemyIds: ["enemy_field_bat"],
  members: [{ enemyId: "enemy_field_bat", x: 40, y: 60, hidden: false }] } });

const startId = project.startMapId;
const start = project.startPos;
const startMap = project.maps[startId]!;
log("start", startId, startMap.width, startMap.height, JSON.stringify(start));

if (process.env.FE_SKIP) { process.stdout.write(serialize(ctx.project)); process.exit(0); }
const chase = call("place_field_enemy", { mapId: startId, x: start.x + 7, y: start.y, troopId: "troop_field_bat", behavior: "chase", sightRange: 5, pace: "slow", id: "ev_field_chaser" });
log("chase", chase.summary, JSON.stringify(chase.warnings ?? []));

// 둘째 맵 — 나갔다 들어와도 처치가 유지되는지 보는 재진입 확인용. 순찰·보초도 한 마리씩 놓아 실제 도구가 통과하는지 본다.
call("create_map", { id: "map_field_two", name: "둘째 들판", width: 20, height: 15, tilesetId: startMap.tilesetId });
const patrol = call("place_field_enemy", { mapId: "map_field_two", x: 10, y: 8, troopId: "troop_field_bat", behavior: "patrol", patrol: { length: 3, axis: "horizontal" }, id: "ev_field_patrol" });
const guard = call("place_field_enemy", { mapId: "map_field_two", x: 15, y: 4, troopId: "troop_field_bat", behavior: "stationary", id: "ev_field_guard" });
log("patrol", patrol.summary, JSON.stringify(patrol.warnings ?? []));
log("guard", guard.summary, JSON.stringify(guard.warnings ?? []));

const json = serialize(ctx.project);
const reloaded = deserialize(json);
if (!reloaded.maps[startId]!.events.some((event) => event.id === "ev_field_chaser")) throw new Error("필드 적이 재로드 뒤 사라졌다");
process.stdout.write(json);
