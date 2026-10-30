// 선택지 Enter 연타 QA 픽스처. stdout = 프로젝트 JSON.
//   시작 칸 오른쪽 NPC: 세 쪽 대사 → 2지선다(0번 = 오답, 1번 = 정답) → 고른 쪽을 대사로 알린다.
//   대사를 넘기려고 연타한 Enter 가 선택지 0번(오답)을 저절로 고르면 안 된다(회귀 벤치 ebfe-sl 방탈출·추리 A8).
// 실행: npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/qa/runtime/choice-mash-fixture.mts > .omo/runtime-qa/choice-mash/project.json
import { serialize } from "../../../src/project/io";
import type { Command, Project } from "../../../src/project/types";

const { createProjectStartSeed } = await import("../../../src/editor/projectStartSeed");
const project: Project = await createProjectStartSeed("adventure-jrpg" as never, "선택지 연타", "example", "wide");
const map = project.maps[project.startMapId];
const x = project.startPos.x + 1;
const y = project.startPos.y;
map.events = map.events.filter((event) => !(event.x === x && event.y === y));
const borrowed = Object.values(project.maps).flatMap((m) => m.events).flatMap((event) => event.pages ?? [])
  .map((page) => page.graphic).find((graphic) => graphic?.sprite);
const say = (body: string): Command => ({ kind: "text", speaker: "자물쇠", body });
const commands: Command[] = [
  say("상자의 자물쇠에 네 자리 숫자를 맞춘다."),
  say("기록에서 본 숫자가 떠오른다."),
  say("어느 숫자로 맞출까?"),
  {
    kind: "choices", prompt: "번호를 고른다", cancelBehavior: "disallow",
    options: [
      { text: "0247 (오답)", branch: [say("[오답] 0247 — 자물쇠가 열리지 않는다.")] },
      { text: "0742 (정답)", branch: [say("[정답] 0742 — 찰칵, 자물쇠가 열렸다.")] },
    ],
  } as Command,
];
map.events.push({
  id: "choice-mash", name: "자물쇠 상자", x, y, trigger: { kind: "action" }, commands: [],
  pages: [{
    id: "choice-mash-page", name: "기본", conditions: [], graphic: borrowed ? { ...borrowed } : {},
    trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
  }],
} as never);
process.stdout.write(serialize(project));
