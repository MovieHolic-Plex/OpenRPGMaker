// ct-ngplus.scenario.mjs 픽스처 — 강하게 다시 하기(New Game+)와 장 표시를 편집기 도구 호출로만 저작한다.
//
//   node node_modules/vite-node/vite-node.mjs --script scripts/qa/runtime/ct-ngplus-fixture.mts > /tmp/ct-ngplus.json
//
// 기준은 editor-authored-demo-v3(시작 map_lantern_village (14,18), 파티 4명 모두 Lv1).
// 시작 칸 바로 북쪽 NPC 가 주인공을 Lv7 로 올리고 장 변수를 2 로 올린 뒤 엔딩을 부른다.
// NG+ 는 레벨(7)을 들고 가지만 장 변수는 이야기 상태라 1 로 되돌아가야 한다.
// 엔진 계약용 최소 픽스처 — 데모 콘텐츠로 배포하거나 원격에 저장하지 않는다.
import { readFileSync } from "node:fs";
import { runTool } from "../../../src/editor/tools/toolRunner";
import { deserialize, serialize } from "../../../src/project/io";

export const CT_NGPLUS_NPC = { id: "ev_ct_ngplus_sage", x: 14, y: 17 } as const;
export const CT_NGPLUS_ENDING_ID = "ending_ct_first";
export const CT_NGPLUS_CHAPTER_VAR = "var_ct_chapter";
export const CT_NGPLUS_LEVEL = 7;

const project = deserialize(readFileSync("test/fixtures/projects/editor-authored-demo-v3.json", "utf8"));
project.meta.title = "CT New Game+ contract";
const ctx = { project };

const calls: { name: string; args: Record<string, unknown> }[] = [
  { name: "manage_flag_slot", args: { action: "add", kind: "variable", id: CT_NGPLUS_CHAPTER_VAR, name: "장", variableValue: 1 } },
  {
    name: "set_project_settings",
    args: {
      newGamePlus: { enabled: true, carry: ["levels", "skills", "equipment", "inventory", "gold"] },
      chapter: { variableId: CT_NGPLUS_CHAPTER_VAR, labels: { "1": "1장 · 서기 1000년", "2": "2장 · 종말의 날" } },
    },
  },
  {
    name: "define_ending",
    args: { id: CT_NGPLUS_ENDING_ID, name: "시간의 끝에서", conditions: [{ kind: "newGamePlus", value: false }] },
  },
  {
    name: "place_npc",
    args: {
      mapId: "map_lantern_village",
      id: CT_NGPLUS_NPC.id,
      x: CT_NGPLUS_NPC.x,
      y: CT_NGPLUS_NPC.y,
      name: "시간의 현자",
      movement: "fixed",
      pages: [{
        lines: ["시간의 끝을 보여 주마."],
        commands: [
          { kind: "changeLevel", actorId: "actor_hero", op: "=", amount: CT_NGPLUS_LEVEL },
          { kind: "setVariable", variableId: CT_NGPLUS_CHAPTER_VAR, op: "=", value: 2 },
          { kind: "triggerEnding", endingId: CT_NGPLUS_ENDING_ID },
        ],
      }],
    },
  },
];

for (const call of calls) {
  const result = runTool(ctx, call.name, call.args);
  if (!result.ok) {
    console.error(`${call.name}: ${result.summary}`);
    process.exit(1);
  }
}
const npc = ctx.project.maps.map_lantern_village?.events.find((event) => event.id === CT_NGPLUS_NPC.id);
if (!npc || npc.x !== CT_NGPLUS_NPC.x || npc.y !== CT_NGPLUS_NPC.y) {
  console.error(`NPC 가 요청 칸에 놓이지 않았다: ${JSON.stringify(npc && { x: npc.x, y: npc.y })}`);
  process.exit(1);
}

const json = serialize(ctx.project);
const reloaded = deserialize(json);
if (!reloaded.system.newGamePlus?.enabled || reloaded.system.chapter?.variableId !== CT_NGPLUS_CHAPTER_VAR) {
  console.error("newGamePlus/chapter 가 직렬화 왕복에서 사라졌다");
  process.exit(1);
}
process.stdout.write(json);
