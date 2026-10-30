// 추격 «닿으면 전투» 런타임 QA 픽스처 — 편집기 AI 도구(runTool)만으로 저작한다(레버 한 개만 손으로 넣는다).
// stdout: 직렬화한 프로젝트 JSON(최소 엔진 픽스처, 원격 저장 없음).
//  시작 맵: 시야 2칸 슬라임(smart)이 동쪽 4칸 — 서 있으면 못 알아채고, 걸으면 발소리(3칸)로 알아채 달려와 닿는다.
//  둘째 맵: 시야 2칸 슬라임이 서 있고 주인공을 대각 옆에 세운다 — 걷지 않아도 닿은 것으로 전투.
//  셋째 맵: 레버(조사하면 스위치)와 7칸 떨어진 슬라임 — 레버 소리를 듣고 와서 뒤지다 곁의 주인공에 닿는다.
import { createBlankProject } from "../../../src/project/defaults";
import { runTool } from "../../../src/editor/tools/toolRunner";
import { deserialize, serialize } from "../../../src/project/io";
import type { GameEvent } from "../../../src/project/types";

const ctx = { project: createBlankProject() };
const log = (...args: unknown[]) => process.stderr.write(args.map(String).join(" ") + "\n");
function call(name: string, args: Record<string, unknown>): ReturnType<typeof runTool> {
  const result = runTool(ctx, name, args);
  if (!result.ok) throw new Error(`${name} 실패: ${result.summary} ${JSON.stringify(result.issues ?? [])}`);
  return result;
}

call("set_project_settings", { title: "추격 접촉 QA", battle: { flow: "gauge", uiStyle: "retro2003", atbSpeed: 1, formationRoll: true } });
call("upsert_enemy", { enemy: { id: "enemy_cc_slime", name: "슬라임", monsterResourceId: "generated-enemy-slime-01",
  stats: { maxHp: 1, maxMp: 0, attack: 1, defense: 0, mind: 1, agility: 1 }, rewards: { exp: 1, gold: 1 } } });
call("upsert_troop", { troop: { id: "troop_cc_slime", name: "슬라임", enemyIds: ["enemy_cc_slime"], members: [{ enemyId: "enemy_cc_slime", x: 40, y: 60, hidden: false }] } });

const startId = ctx.project.startMapId;
const start = ctx.project.startPos;
const startMap = ctx.project.maps[startId]!;
log("start", startId, startMap.width, startMap.height, JSON.stringify(start));

const slime = (mapId: string, x: number, y: number, id: string) => {
  const result = call("place_field_enemy", { mapId, x, y, troopId: "troop_cc_slime", behavior: "chase", sightRange: 2, pace: "normal", brain: "smart", id });
  log(id, result.summary.slice(0, 140));
};
slime(startId, start.x + 4, start.y, "ev_cc_hear");

call("create_map", { id: "map_cc_diag", name: "대각 들판", width: 20, height: 15, tilesetId: startMap.tilesetId });
slime("map_cc_diag", 10, 7, "ev_cc_diag");

call("create_map", { id: "map_cc_lever", name: "레버 들판", width: 24, height: 15, tilesetId: startMap.tilesetId });
slime("map_cc_lever", 13, 7, "ev_cc_lever_slime");
const lever: GameEvent = {
  id: "ev_cc_lever", name: "레버", x: 6, y: 7, trigger: { kind: "action" }, commands: [],
  pages: [{ id: "ev_cc_lever_p1", name: "레버", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same", overlapForbidden: true,
    movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "setSwitch", switchId: "sw_cc_lever", value: true }] }],
};
ctx.project.maps["map_cc_lever"]!.events.push(lever);
ctx.project.switches.push({ id: "sw_cc_lever", name: "레버" });

const json = serialize(ctx.project);
const reloaded = deserialize(json);
for (const [mapId, id] of [[startId, "ev_cc_hear"], ["map_cc_diag", "ev_cc_diag"], ["map_cc_lever", "ev_cc_lever"]] as const) {
  if (!reloaded.maps[mapId]!.events.some((event) => event.id === id)) throw new Error(`${id} 가 재로드 뒤 사라졌다`);
}
process.stdout.write(json);
