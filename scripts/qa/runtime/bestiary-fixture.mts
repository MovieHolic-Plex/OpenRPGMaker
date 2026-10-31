// 괴물 도감 런타임 QA 픽스처(2026-10-31). 편집기 AI 도구(runTool)만으로 저작한다 — define_bestiary_entry 경로도 함께 지난다.
// stdout: 직렬화한 프로젝트 JSON. 출하·원격 저장 없음.
//   적 「익사귀」는 물리에 약하다(damageTypeRates physical 200) — 평타 한 번이 「약점 발견」이고 도감 약점 칸이 열린다.
//   칸: 외형(만나면) · 약점(약점 발견) · 습성(단서 스위치) · 처치 기록(쓰러뜨리면).
// 실행: npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/qa/runtime/bestiary-fixture.mts > /tmp/hs/bestiary.json
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

call("set_project_settings", { title: "괴물 도감 QA" });
call("upsert_class", { class: { id: "class_hunter", name: "사냥꾼", learnedSkills: [] } });
call("upsert_actor", { actor: { id: "actor_hunter", name: "도르반", learnedSkills: [] } });
call("set_party", { scope: "start", actorIds: ["actor_hunter"] });

call("upsert_enemy", { enemy: {
  id: "enemy_drowner", name: "익사귀", monsterResourceId: "generated-enemy-bat-01",
  stats: { maxHp: 30, maxMp: 0, attack: 3, defense: 1, mind: 1, agility: 1 },
  rewards: { exp: 5, gold: 5 },
  damageTypeRates: { physical: 200 },
} });
call("upsert_troop", { troop: { id: "troop_drowner", name: "익사귀", enemyIds: ["enemy_drowner"],
  members: [{ enemyId: "enemy_drowner", x: 50, y: 55, hidden: false }] } });

const defined = call("define_bestiary_entry", {
  id: "bst_drowner",
  name: "익사귀",
  enemyIds: ["enemy_drowner"],
  sections: [
    { id: "look", title: "외형", text: "물에 불은 살, 입에서 늪물을 흘린다.", unlock: "seen" },
    { id: "weakness", title: "약점", text: "칼에 약하다. 은을 바르면 더 잘 든다.", unlock: "weakness" },
    { id: "habit", title: "습성", text: "밤에만 물에서 나온다. 낮에는 진흙 속에서 잔다.", unlockSwitchId: "sw_clue_drowner" },
    { id: "kill", title: "처치 기록", text: "늪 마을 사람들이 다시 물을 길으러 나온다.", unlock: "defeated" },
  ],
});
process.stderr.write(`${defined.summary}\n`);

const mapId = ctx.project.startMapId;
const map = ctx.project.maps[mapId]!;
const start = ctx.project.startPos;
call("upsert_event", { mapId, event: {
  id: "ev_drowner", x: start.x, y: start.y - 1, trigger: { kind: "action" }, commands: [],
  pages: [{ id: "ev_drowner_p1", name: "익사귀", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [{ kind: "battleProcessing", troopId: "troop_drowner", canEscape: true, canLose: true }] }],
} });
// 증인 — 말을 들으면 단서 스위치가 켜져 「습성」 칸이 열린다(이벤트로 칸 열기).
call("upsert_event", { mapId, event: {
  id: "ev_witness", x: start.x + 1, y: start.y, trigger: { kind: "action" }, commands: [],
  pages: [{ id: "ev_witness_p1", name: "증인", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [{ kind: "text", body: "밤에만 나와요. 낮에는 진흙 속에 숨어 있죠." }, { kind: "setSwitch", switchId: "sw_clue_drowner", value: true }] }],
} });
if (!isPassable(ctx.project, map, start.x, start.y)) throw new Error("시작 칸이 막혀 있다");
// 오프닝 연출 없이 바로 필드로(도구 호출이 기본 오프닝을 되살리므로 직렬화 직전에 뺀다).
delete (ctx.project.system as { opening?: unknown }).opening;
const json = serialize(ctx.project);
const back = deserialize(json);
if (back.system.bestiary?.entries[0]?.sections.length !== 4) throw new Error("도감이 저장/불러오기에서 사라졌다");
process.stdout.write(json);
