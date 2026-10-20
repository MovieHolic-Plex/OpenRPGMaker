// 480×270 선택지 맞춤 QA 픽스처. stdout = 프로젝트 JSON.
//   CHOICE_STYLE=<DialogueStyleId> 로 대화창 스타일을 고른다(생략 = 프로젝트 기본).
//   시작 칸 오른쪽 NPC 가 차례로: (1) 48px 얼굴 대사 → 3지선다(질문 있음)
//   (2) 흉상 대사 → 4지선다(질문 있음) (3) 얼굴 없는 대사 → 3지선다(질문 없음) (4) 4지선다(긴 질문) (5) 위쪽 창 4지선다 (6) 5지선다(엔진 상한, 두 줄 선택지).
// 실행: npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/qa/runtime/choice-fit-480-fixture.mts > .omo/runtime-qa/choice-fit/glass.json
import { serialize } from "../../../src/project/io";
import type { Command, Project } from "../../../src/project/types";

const { createProjectStartSeed } = await import("../../../src/editor/projectStartSeed");
const project: Project = await createProjectStartSeed("adventure-jrpg" as never, "선택지 맞춤", "example", "wide");
project.system.playResolution = { width: 480, height: 270 };
delete (project.system as { cameraZoom?: number }).cameraZoom;
const style = process.env.CHOICE_STYLE;
if (style) (project.system as { dialogueStyle?: string }).dialogueStyle = style;

const map = project.maps[project.startMapId];
const x = project.startPos.x + 1;
const y = project.startPos.y;
map.events = map.events.filter((event) => !(event.x === x && event.y === y));
const borrowed = Object.values(project.maps).flatMap((m) => m.events).flatMap((event) => event.pages ?? [])
  .map((page) => page.graphic).find((graphic) => graphic?.sprite);
const face = (resourceId: string, presentation?: "face" | "bust"): Command =>
  ({ kind: "changeFace", resourceId, ...(presentation ? { presentation } : {}), position: "left", flipHorizontally: false } as Command);
const say = (body: string): Command => ({ kind: "text", speaker: "안내자", body });
const choices = (prompt: string | undefined, texts: string[]): Command => ({
  kind: "choices", ...(prompt ? { prompt } : {}), options: texts.map((text) => ({ text, branch: [] })), cancelBehavior: "disallow",
} as Command);
const commands: Command[] = [
  face("easyrpg-faceset-actor1-02", "face"),
  say("[1] 얼굴이 있는 대사 뒤에 세 갈래 선택지가 옵니다. 세 번째까지 다 보여야 합니다."),
  choices("어떻게 할까요?", ["가게를 둘러본다", "그냥 지나간다", "세 번째 선택지는 조금 길게 적어 본다"]),
  face("shared-modern-uni-girl-twintail-expressions-bust-base"),
  say("[2] 흉상이 있는 대사 뒤에 네 갈래 선택지가 옵니다."),
  choices("무엇을 고를까요?", ["검을 든다", "방패를 든다", "마법서를 편다", "아무것도 하지 않는다"]),
  face(""),
  say("[3] 얼굴 없이 세 갈래, 질문 줄도 없습니다."),
  choices(undefined, ["예", "아니오", "잘 모르겠다"]),
  choices("[4] 질문이 조금 긴 편입니다. 이 질문 줄이 한 줄을 넘어가도 네 번째 선택지까지 다 보여야 합니다.", ["첫째", "둘째", "셋째", "넷째 선택지"]),
  { kind: "displayTextSettings", format: "normal", position: "top", preventObscuringPlayer: false, allowEventMovementDuringWait: false } as Command,
  say("[5] 창이 위에 있을 때도 네 갈래가 다 보여야 합니다."),
  choices("위쪽 창의 질문", ["북쪽 길로 간다", "남쪽 길로 간다", "강을 건넌다", "여기서 기다린다"]),
  { kind: "displayTextSettings", format: "normal", position: "bottom", preventObscuringPlayer: false, allowEventMovementDuringWait: false } as Command,
  choices("[6] 다섯 갈래(엔진 상한 5): 마지막 선택지가 두 줄이어도 창이 자라서 다 보여야 한다.", ["하나", "둘", "셋", "넷", "다섯 번째 선택지는 아주 길게 써서 두 줄로 넘어가는지 본다. 화면 폭을 넘길 만큼 길게, 정말로 길게 써 본다. 더 길게 써 본다."]),
  say("[END] 끝."),
];
map.events.push({
  id: "choice-fit-480", name: "선택지 맞춤", x, y, trigger: { kind: "action" }, commands: [],
  pages: [{
    id: "choice-fit-480-page", name: "기본", conditions: [], graphic: borrowed ? { ...borrowed } : {},
    trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
  }],
} as never);
process.stdout.write(serialize(project));
