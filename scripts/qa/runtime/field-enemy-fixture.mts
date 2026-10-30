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
// 전투 그림(monsterResourceId)이 정본 — 필드 그림은 같은 종류로 자동 선택된다(slime→슬라임 칩, skeleton→해골 칩).
const enemy = (id: string, name: string, resource: string) => call("upsert_enemy", { enemy: {
  id, name, monsterResourceId: resource,
  stats: { maxHp: 1, maxMp: 0, attack: 1, defense: 0, mind: 1, agility: 1 }, rewards: { exp: 1, gold: 1 },
} });
enemy("enemy_field_slime", "슬라임", "generated-enemy-slime-01");
enemy("enemy_field_skeleton", "해골", "generated-enemy-skeleton-01");
enemy("enemy_field_bat", "박쥐", "generated-enemy-bat-01");
const troop = (id: string, name: string, enemyId: string) => call("upsert_troop", { troop: { id, name, enemyIds: [enemyId],
  members: [{ enemyId, x: 40, y: 60, hidden: false }] } });
troop("troop_field_slime", "슬라임", "enemy_field_slime");
troop("troop_field_skeleton", "해골", "enemy_field_skeleton");
troop("troop_field_bat", "박쥐", "enemy_field_bat");

const startId = project.startMapId;
const start = project.startPos;
const startMap = project.maps[startId]!;
log("start", startId, startMap.width, startMap.height, JSON.stringify(start));

if (process.env.FE_SKIP) { process.stdout.write(serialize(ctx.project)); process.exit(0); }
// 박쥐는 필드에 같은 종류의 그림이 없다 — 슬라임 칩으로 말없이 대체하지 않고 거절해야 한다.
const batTry = runTool(ctx, "place_field_enemy", { mapId: startId, x: start.x + 7, y: start.y + 2, troopId: "troop_field_bat", behavior: "stationary", id: "ev_field_bat_try" });
if (batTry.ok) throw new Error("박쥐 필드 적이 슬라임 그림으로 놓였다 — 전투와 필드 그림 불일치");
log("bat rejected:", batTry.summary.slice(0, 120));
// 그림을 슬라임으로 강제해도 전투 그림(해골)과 다르면 거절한다.
const mismatch = runTool(ctx, "place_field_enemy", { mapId: startId, x: start.x + 7, y: start.y + 2, troopId: "troop_field_skeleton", behavior: "stationary", graphic: { query: "슬라임" }, id: "ev_field_mismatch" });
if (mismatch.ok) throw new Error("해골 적에 슬라임 그림이 통과했다");
log("mismatch rejected:", mismatch.summary.slice(0, 120));

// 이 게이트는 «느낌표에서 멈췄다 쫓는» 옛 추격 계약을 본다 — 성격 classic 으로 고정한다(새 기본 성격은 멈추지 않는다, chase-contact 시나리오).
const chase = call("place_field_enemy", { mapId: startId, x: start.x + 7, y: start.y, troopId: "troop_field_slime", behavior: "chase", sightRange: 5, pace: "slow", brain: "classic", id: "ev_field_chaser" });
log("chase", chase.summary, JSON.stringify(chase.warnings ?? []));

// 둘째 맵 — 나갔다 들어와도 처치가 유지되는지 보는 재진입 확인용. 순찰·보초·순찰+추격도 한 마리씩 놓아 실제 도구가 통과하는지 본다.
call("create_map", { id: "map_field_two", name: "둘째 들판", width: 20, height: 15, tilesetId: startMap.tilesetId });
const patrol = call("place_field_enemy", { mapId: "map_field_two", x: 10, y: 8, troopId: "troop_field_skeleton", behavior: "patrol", patrol: { length: 3, axis: "horizontal" }, id: "ev_field_patrol" });
const guard = call("place_field_enemy", { mapId: "map_field_two", x: 15, y: 4, troopId: "troop_field_slime", behavior: "stationary", id: "ev_field_guard" });
const patchase = call("place_field_enemy", { mapId: "map_field_two", x: 5, y: 11, troopId: "troop_field_skeleton", behavior: "chase", patrol: { length: 2, axis: "horizontal" }, sightRange: 3, pace: "slow", brain: "classic", id: "ev_field_patchase" });
log("patrol", patrol.summary, JSON.stringify(patrol.warnings ?? []));
log("guard", guard.summary, JSON.stringify(guard.warnings ?? []));
log("patchase", patchase.summary, JSON.stringify(patchase.warnings ?? []));

const json = serialize(ctx.project);
const reloaded = deserialize(json);
if (!reloaded.maps[startId]!.events.some((event) => event.id === "ev_field_chaser")) throw new Error("필드 적이 재로드 뒤 사라졌다");
process.stdout.write(json);
