// 선택지 줄 조건(showWhen·enableWhen) QA 픽스처. stdout = 프로젝트 JSON.
//   시작 칸 오른쪽 게시판 NPC:
//     1) 「늪의 계약을 뗀다」     — showWhen: 스위치 sw_heard_rumor ON (처음엔 숨음)
//     2) 「하수도 계약을 뗀다」   — enableWhen: 은화 50 이상, disabledText 「보증금 은화 50」 (처음엔 흐림)
//     3) 「소문을 묻는다」        — 스위치를 켜고 은화 60 을 준다
//     4) 「그냥 간다」
//   다시 말 걸면 1 이 보이고 2 가 고를 수 있게 된다.
// 실행: npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/qa/runtime/choice-conditions-fixture.mts > /tmp/hs/choice-conditions.json
import { serialize } from "../../../src/project/io";
import type { Command, Project } from "../../../src/project/types";

const { createProjectStartSeed } = await import("../../../src/editor/projectStartSeed");
const project: Project = await createProjectStartSeed("adventure-jrpg" as never, "선택지 조건", "example", "wide");
project.system.playResolution = { width: 480, height: 270 };
delete (project.system as { cameraZoom?: number }).cameraZoom;
project.switches.push({ id: "sw_heard_rumor", name: "소문을 들었다" } as never);
project.session.gold = 0;

const map = project.maps[project.startMapId];
const x = project.startPos.x + 1;
const y = project.startPos.y;
map.events = map.events.filter((event) => !(event.x === x && event.y === y));
const borrowed = Object.values(project.maps).flatMap((m) => m.events).flatMap((event) => event.pages ?? [])
  .map((page) => page.graphic).find((graphic) => graphic?.sprite);
const say = (body: string): Command => ({ kind: "text", speaker: "게시판지기", body });
const commands: Command[] = [
  say("떼어 갈 계약이 있으면 골라."),
  {
    kind: "choices",
    prompt: "어느 쪽지를 뗄까?",
    cancelBehavior: "branch",
    cancelBranch: [],
    options: [
      { text: "늪의 계약을 뗀다", showWhen: { kind: "switch", switchId: "sw_heard_rumor", value: true }, branch: [say("늪 쪽 일은 셋째 날 밤에 가.")] },
      { text: "하수도 계약을 뗀다", enableWhen: { kind: "gold", op: ">=", amount: 50 }, disabledText: "보증금 은화 50", branch: [say("보증금은 받았다. 하수도는 냄새부터 견뎌.")] },
      {
        text: "소문을 묻는다",
        branch: [
          say("늪에서 시체가 올라온다더군. 계약서는 이제 붙여 두지. 이건 지난번 삯이야."),
          { kind: "setSwitch", switchId: "sw_heard_rumor", value: true },
          { kind: "changeGold", op: "+=", amount: 60 },
        ],
      },
      { text: "그냥 간다", branch: [] },
    ],
  } as Command,
];
map.events.push({
  id: "choice-conditions-board", name: "게시판지기", x, y, trigger: { kind: "action" }, commands: [],
  pages: [{
    id: "choice-conditions-page", name: "기본", conditions: [], graphic: borrowed ? { ...borrowed } : {},
    trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
  }],
} as never);
process.stdout.write(serialize(project));
