// 기본 해상도(480×270·배율 1) QA 픽스처. stdout = 프로젝트 JSON.
//   RES_WHICH=ui     새 프로젝트 wide 씨앗(모험 JRPG 예제) + 시작 칸 오른쪽에 UI 순회 NPC(대화→선택지→상점→저장→전투)
//   RES_WHICH=fallen 『폴른 스타』 플래그십
//   RES_VIEW=480x270x1 처럼 주면 해상도·배율을 덮는다(전후 비교용). 생략하면 코드의 기본값 그대로.
//   RES_DIALOGUE=dual-fullbody-veil 처럼 주면 대화창 스타일을 덮는다(양쪽 전신 해상도 잠김 재현, 2026-10-21).
// 실행: npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/qa/runtime/res480-fixture.mts > .omo/runtime-qa/res/ui.json
import { serialize } from "../../../src/project/io";
import type { Command, Project } from "../../../src/project/types";

const which = process.env.RES_WHICH ?? "ui";
let project: Project;
if (which === "fallen") {
  const { createChronoBellFlagshipDemo } = await import("../../../src/project/flagship/chronoBell");
  project = createChronoBellFlagshipDemo().project;
} else {
  const { createProjectStartSeed } = await import("../../../src/editor/projectStartSeed");
  project = await createProjectStartSeed("adventure-jrpg" as never, "새 게임", "example", "wide");
  addUiTourNpc(project);
}

if (process.env.RES_DIALOGUE) project.system.dialogueStyle = process.env.RES_DIALOGUE as never;
const view = process.env.RES_VIEW;
if (view) {
  const [width, height, zoom] = view.split("x").map(Number);
  project.system.playResolution = { width, height };
  if (zoom && zoom !== 1) project.system.cameraZoom = zoom;
  else delete project.system.cameraZoom;
}
process.stdout.write(serialize(project));

function addUiTourNpc(target: Project): void {
  const map = target.maps[target.startMapId];
  const x = target.startPos.x + 1;
  const y = target.startPos.y;
  map.events = map.events.filter((event) => !(event.x === x && event.y === y));
  // 그림은 이 프로젝트에 실제로 있는 캐릭터 칩을 빌린다(sample_npc 같은 테스트 번들 id 는 없을 수 있다).
  const borrowed = Object.values(target.maps).flatMap((m) => m.events).flatMap((event) => event.pages ?? [])
    .map((page) => page.graphic).find((graphic) => graphic?.sprite);
  const ids = (table: unknown): string[] => Array.isArray(table) ? table.map((row: { id: string }) => row.id) : Object.keys(table as object);
  const itemIds = ids(target.database.items).slice(0, 4);
  const troopId = ids(target.database.troops)[0];
  const say = (body: string): Command => ({ kind: "text", speaker: "안내자", body });
  const commands: Command[] = [
    say("어서 오세요. 이 창이 한 화면에 다 들어오는지 확인하는 긴 문장입니다. 두 줄이 넘어가도 잘리면 안 됩니다."),
    {
      kind: "choices",
      prompt: "무엇을 할까요?",
      options: [
        { text: "가게를 둘러본다", branch: [say("좋아요, 가게로 갑시다.")] },
        { text: "그냥 지나간다", branch: [say("그래도 가게는 보고 가세요.")] },
        { text: "세 번째 선택지는 조금 길게", branch: [] },
      ],
      cancelBehavior: "disallow",
    } as Command,
    {
      kind: "shop", itemIds, allowSell: true, quantityMode: "single", shopType: "normal", shopUiPreset: "story",
      messageType: "welcome", merchantGold: 100, branchOnTransaction: false, transactionBranch: [],
      branchOnFailedTransaction: false, failedTransactionBranch: [],
    } as Command,
    { kind: "openSaveMenu" },
    ...(troopId ? [{ kind: "battleProcessing", troopId, canEscape: true, canLose: true } as Command] : []),
  ];
  map.events.push({
    id: "res480-ui-tour",
    name: "UI 순회",
    x,
    y,
    trigger: { kind: "action" },
    commands: [],
    pages: [{
      id: "res480-ui-tour-page",
      name: "기본",
      conditions: [],
      graphic: borrowed ? { ...borrowed } : {},
      trigger: { kind: "action" },
      priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands,
    }],
  } as never);
}
