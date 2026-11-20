// @vitest-environment happy-dom
import { beforeAll, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { CHOICE_CANCEL_BRANCH_INDEX, FORK_THEN_BRANCH_INDEX, LOOP_BODY_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { createInterpreter } from "@/player/interpreter";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { eventCommandHash } from "@/project/eventCommands/singleCommandOps";
import { startSession } from "@/project/session";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { normalizeEventPage } from "@/editor/eventPages";
import { APPLY_SMALL_TASK_PRIMITIVE, runSmallTaskPrimitiveTool } from "@/editor/tools/smallTaskPrimitiveTools";
import { getTool } from "@/editor/tools/toolRegistry";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/01-cmd-dialogue";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { eventTarget, expectKoreanSentence, expectRefused, expectUndoRestores, loadFixture, mapTarget } from "./harness";
import seededCases from "./01-cmd-dialogue/seeded-cases.json";

type Fixture = "blank" | "built" | "maou";
type DialogueCase = {
  fixture: Fixture;
  original: Command;
  insert: Record<string, unknown>;
  inserted: Command;
  update: Record<string, unknown>;
  updated: Command;
};

const face = "easyrpg-faceset-actor1-00";
const variable = "var_0001";
const anotherVariable = "var_0002";
const actor = "actor_hero";
const potion = "item_potion";
const continuation = { kind: "text", speaker: "경비", body: "변경 뒤에도 이 줄은 남습니다." } satisfies Command;
const switchId = "sw_0001";
const choices: Extract<Command, { kind: "choices" }> = {
  kind: "choices",
  prompt: "어떻게 할까?",
  options: [
    { text: "예", branch: [continuation], showWhen: { kind: "switch", switchId, value: false } },
    { text: "아니요", branch: [{ kind: "wait", ms: 50 }], disabledText: "아직 이릅니다." },
  ],
  cancelBehavior: "branch",
  cancelBranch: [{ kind: "text", body: "다음에 오세요." }],
};
const presentItem: Extract<Command, { kind: "presentItem" }> = {
  kind: "presentItem",
  prompt: "무엇을 보여줄까?",
  itemIds: [potion, "item_ether"],
  options: [{ itemId: potion, branch: [continuation] }],
  otherwiseBranch: [{ kind: "text", body: "이 물건은 아니에요." }],
  cancelBranch: [{ kind: "wait", ms: 50 }],
};
const settings: Extract<Command, { kind: "displayTextSettings" }> = {
  kind: "displayTextSettings",
  format: "normal",
  position: "bottom",
  preventObscuringPlayer: true,
  allowEventMovementDuringWait: false,
};

function updatePosition(commands: readonly Command[], row: Command, index = 0) {
  return { index, expectedHash: eventCommandHash(row), expectedPageHashes: commands.map(eventCommandHash) };
}

const cases: DialogueCase[] = [
  {
    fixture: "blank",
    original: { kind: "text", body: "어서 오게.", speaker: "촌장", style: "classic", calling: true },
    insert: { body: "조심히 다녀오게.\n숲길을 따라가면 된단다.", speaker: "촌장", position: "top" },
    inserted: { kind: "text", body: "조심히 다녀오게.\n숲길을 따라가면 된단다.", speaker: "촌장", position: "top" },
    update: { body: "반갑네." },
    updated: { kind: "text", body: "반갑네.", speaker: "촌장", style: "classic", calling: true },
  },
  {
    fixture: "built",
    original: { kind: "changeFace", resourceId: face, position: "left", flipHorizontally: false },
    insert: { resourceId: face, position: "right", presentation: "bust" },
    inserted: { kind: "changeFace", resourceId: face, position: "right", flipHorizontally: false, presentation: "bust" },
    update: { flipHorizontally: true },
    updated: { kind: "changeFace", resourceId: face, position: "left", flipHorizontally: true },
  },
  {
    fixture: "blank",
    original: choices,
    insert: { prompt: "쉴까?", optionLabels: ["잠깐 쉰다"], cancelBehavior: "branch" },
    inserted: { kind: "choices", prompt: "쉴까?", options: [{ text: "잠깐 쉰다", branch: [] }], cancelBehavior: "branch", cancelBranch: [] },
    update: { optionLabels: ["좋아요", "괜찮아요"], appendOption: "나중에" },
    updated: {
      ...choices,
      options: [{ ...choices.options[0]!, text: "좋아요" }, { ...choices.options[1]!, text: "괜찮아요" }, { text: "나중에", branch: [] }],
    },
  },
  {
    fixture: "maou",
    original: presentItem,
    insert: { itemIds: [potion], correctItemIds: [potion], consume: true },
    inserted: { kind: "presentItem", prompt: "무엇을 보여줄까?", itemIds: [potion], options: [{ itemId: potion, branch: [] }], otherwiseBranch: [], cancelBranch: [], consume: true },
    update: { prompt: "증거를 보여 주세요.", consume: true },
    updated: { ...presentItem, prompt: "증거를 보여 주세요.", consume: true },
  },
  {
    fixture: "built",
    original: { kind: "inputWait", variableId: variable },
    insert: {},
    inserted: { kind: "inputWait", variableId: "" },
    update: { variableId: anotherVariable },
    updated: { kind: "inputWait", variableId: anotherVariable },
  },
  {
    fixture: "built",
    original: { kind: "inputNumber", variableId: variable, digits: 1, showPad: true },
    insert: { variableId: variable, digits: 3, prompt: "비밀번호를 입력하세요." },
    inserted: { kind: "inputNumber", variableId: variable, digits: 3, prompt: "비밀번호를 입력하세요." },
    update: { digits: 4 },
    updated: { kind: "inputNumber", variableId: variable, digits: 4, showPad: true },
  },
  {
    fixture: "built",
    original: { kind: "enterHeroName", actorId: actor, maxLength: 6, showInitialName: true },
    insert: { stringVariableId: variable, maxLength: 3, prompt: "별명을 입력하세요." },
    inserted: { kind: "enterHeroName", actorId: "", stringVariableId: variable, maxLength: 3, showInitialName: true, prompt: "별명을 입력하세요." },
    update: { maxLength: 8, showInitialName: false },
    updated: { kind: "enterHeroName", actorId: actor, maxLength: 8, showInitialName: false },
  },
  {
    fixture: "maou",
    original: settings,
    insert: { format: "transparent", position: "top" },
    inserted: { ...settings, format: "transparent", position: "top" },
    update: { position: "center", allowEventMovementDuringWait: true },
    updated: { ...settings, position: "center", allowEventMovementDuringWait: true },
  },
];

const eventId = "ev_dialogue_sample";
const pageId = "page_dialogue_sample";

const fixtures = new Map<Fixture, Project>();

beforeAll(() => {
  for (const fixture of ["blank", "built", "maou"] as const) {
    fixtures.set(fixture, loadFixture(fixture));
  }
}, 120_000);

function arrange(fixture: Fixture, commands: Command[]) {
  const base = fixtures.get(fixture)!;
  const map = base.maps[base.startMapId] ?? { ...createBlankMap("연습 맵", 20, 15), id: "map_dialogue_sample" };
  const mapId = map.id;
  const page = normalizeEventPage({ id: pageId, name: "대화 연습", commands });
  const siblingPage = normalizeEventPage({ id: "page_other", name: "다른 페이지", commands: [continuation] });
  const event: GameEvent = {
    id: eventId, name: "경비", x: 2, y: 2, trigger: { kind: "action" }, commands: [], pages: [page, siblingPage],
  };
  const project: Project = {
    ...base,
    maps: { ...base.maps, [mapId]: { ...map, events: [...map.events, event] } },
    startMapId: mapId,
    startPos: base.startMapId ? base.startPos : { x: 1, y: 1 },
    mapTree: base.startMapId ? base.mapTree : { mapId, children: [] },
  };
  const target = eventTarget(project, mapId, eventId, pageId);
  const readPage = (after: Project, index = 0): EventPage =>
    after.maps[mapId]!.events.find(entry => entry.id === eventId)!.pages![index]!;
  return { project, target, readPage, mapId, siblingPage };
}

it.each(cases.flatMap(shape => (["insert", "update"] as const).map(action => ({
  ...shape, action, id: `cmd.${shape.original.kind}.${action}`,
}))))("$id · 저장 결과, 문장, 범위와 되돌리기", async testCase => {
  const { action, fixture, id, original } = testCase;
  const { project, target, readPage, mapId, siblingPage } = arrange(fixture, [original, continuation]);
  const args = { ...testCase[action], ...(action === "update" ? updatePosition([original, continuation], original) : {}) };
  const primitive = PRIMITIVES.find(entry => entry.id === id)!;
  const { after, sentence } = runPrimitive(project, target, id, args);
  const expected = action === "insert" ? [original, continuation, testCase.inserted] : [testCase.updated, continuation];
  expect(readPage(after).commands).toStrictEqual(expected);
  expect(readPage(project).commands).toStrictEqual([original, continuation]);
  expect(readPage(after, 1)).toBe(siblingPage);
  expect(sentence).toBe(primitive.describe({ project, target }, args));
  expect(sentence).toMatch(/[가-힣].*합니다\.$/u);
  expectKoreanSentence(sentence, target);

  expectRefused(project, mapTarget(project, mapId), id, args);
  const scope = primitive.scope({ project, target }, { ...args, pageId: siblingPage.id });
  expect(scope).toEqual({ kind: "eventPage", mapId, eventId, pageId });
  const escaped: Project = {
    ...after,
    maps: {
      ...after.maps,
      [mapId]: {
        ...after.maps[mapId]!,
        events: after.maps[mapId]!.events.map(event => event.id !== eventId ? event : {
          ...event, pages: [readPage(after), { ...siblingPage, commands: [] }],
        }),
      },
    },
  };
  expect(checkSmallTaskScope(project, after, scope)).toEqual({ ok: true });
  expect(checkSmallTaskScope(project, escaped, scope)).toMatchObject({ ok: false, reason: expect.stringContaining("범위 밖") });
  await expectUndoRestores(project, after, target);
});

it.each([
  { id: "text", args: { body: " " }, message: "대사 문구" },
  { id: "changeFace", args: { resourceId: "face_missing" }, message: "얼굴 그림" },
  { id: "changeFace", args: { appearanceId: "appearance_missing" }, message: "인물 외형" },
  { id: "changeFace", args: { resourceId: face, appearanceId: "appearance_missing" }, message: "하나만 골라" },
  { id: "choices", args: { optionLabels: ["예"], cancelBehavior: "choice2" }, message: "고를 선택지" },
  { id: "choices", args: { optionLabels: ["  "] }, message: "선택지 문구" },
  { id: "presentItem", args: { correctItemIds: ["item_missing"] }, message: "아이템" },
  { id: "presentItem", args: { itemIds: ["item_ether"], correctItemIds: [potion] }, message: "제시할 목록에도" },
  { id: "inputWait", args: { variableId: "var_missing" }, message: "변수" },
  { id: "inputNumber", args: { variableId: "var_missing" }, message: "변수" },
  { id: "enterHeroName", args: { actorId: "actor_missing" }, message: "배우" },
  { id: "enterHeroName", args: { actorId: "  ", stringVariableId: variable }, message: "배우" },
])("$id 추가에서 잘못된 값을 거부한다", ({ id, args, message }) => {
  const { project, target, readPage } = arrange("built", [continuation]);
  const invoke = () => runPrimitive(project, target, `cmd.${id}.insert`, args);
  expect(invoke).toThrow(PrimitiveError);
  expect(invoke).toThrow(message);
  expect(readPage(project).commands).toStrictEqual([continuation]);
});

it("다른 페이지를 인자로 지정하거나 선택한 페이지 밖의 줄을 새로 만들 수 없다", () => {
  const { project, target, siblingPage } = arrange("blank", [continuation]);
  expect(() => runPrimitive(project, target, "cmd.text.insert", {
    body: "다른 페이지로 보냅니다.", pageId: siblingPage.id,
  })).toThrow(PrimitiveError);
  expect(() => runPrimitive(project, target, "cmd.text.update", {
    ...updatePosition([continuation], continuation, 1), body: "존재하지 않는 줄입니다.",
  })).toThrow("범위 밖");
  expect(() => runPrimitive(project, target, "cmd.text.insert", {
    branchPath: [0, 0], body: "대사에는 분기가 없습니다.",
  })).toThrow("범위 밖");
});

it("이벤트에서 읽은 위치로 분기 안의 대사를 변경하고 오래된 줄 확인값을 거부한다", async () => {
  const { project, target, readPage, mapId } = arrange("built", [choices]);
  const { data } = await getTool("get_event")!.run(project, { mapId, eventId, includeCommandHashes: true });
  const { commandHashes } = data as { commandHashes: { pageId: string; commands: { index: number; branchPath: number[]; hash: string }[] }[] };
  const selectedPage = commandHashes.find(entry => entry.pageId === pageId)!;
  const row = selectedPage.commands.find(entry => jsonEqual(entry.branchPath, [0, 0]))!;
  expect(row.hash).toBe(eventCommandHash(continuation));
  const expectedPageHashes = selectedPage.commands.filter(entry => entry.branchPath.length === 0).map(entry => entry.hash);
  const args = { branchPath: row.branchPath, index: row.index, expectedPageHashes, body: "분기 안의 새 대사입니다." };
  const context = { project, smallTaskTarget: target };
  const update = (expectedHash: string) => runSmallTaskPrimitiveTool(context, APPLY_SMALL_TASK_PRIMITIVE, {
    id: "cmd.text.update", args: { ...args, expectedHash },
  });
  await expect(update("stale")).rejects.toThrow("명령 줄이 바뀌었습니다");
  expect(context.project).toBe(project);
  await expect(update(row.hash)).resolves.toMatchObject({ ok: true });
  expect(readPage(context.project).commands).toStrictEqual([{
    ...choices, options: [{ ...choices.options[0], branch: [{ ...continuation, body: args.body }] }, choices.options[1]],
  }]);
  expect(jsonEqual(readPage(project).commands, [choices])).toBe(true);
});

it("같은 종류의 명령이 앞으로 끼어들면 확인값 없는 수정과 오래된 위치의 수정을 거부한다", () => {
  const preceding = { ...continuation, body: "새로 끼워 넣은 대사입니다." };
  const { project, target, readPage } = arrange("blank", [preceding, continuation]);
  const args = { index: 0, body: "두 번째 대사만 고칩니다." };
  expect(() => runPrimitive(project, target, "cmd.text.update", args)).toThrow(PrimitiveError);
  expect(() => runPrimitive(project, target, "cmd.text.update", { ...args, ...updatePosition([continuation], continuation) }))
    .toThrow("명령 줄이 바뀌었습니다");
  expect(readPage(project).commands).toStrictEqual([preceding, continuation]);
});

it("같은 내용의 줄이 끼어들면 줄 해시가 일치해도 수정과 위치 지정 삽입을 거부한다", () => {
  const duplicate = { ...continuation };
  const { project, target, readPage } = arrange("blank", [duplicate, continuation]);
  const oldPosition = updatePosition([continuation], continuation);
  const body = "조회한 줄 근처만 편집합니다.";
  expect(() => runPrimitive(project, target, "cmd.text.update", { ...oldPosition, body })).toThrow("명령 목록이 바뀌었습니다");
  expect(() => runPrimitive(project, target, "cmd.text.insert", {
    index: 0, expectedPageHashes: oldPosition.expectedPageHashes, body,
  })).toThrow("명령 목록이 바뀌었습니다");
  expect(() => runPrimitive(project, target, "cmd.text.insert", { index: 0, body })).toThrow("명령 위치를 확인할 수 없습니다");
  const { after } = runPrimitive(project, target, "cmd.text.insert", {
    index: 1, expectedPageHashes: [duplicate, continuation].map(eventCommandHash), body,
  });
  expect(readPage(after).commands).toStrictEqual([duplicate, { kind: "text", body, speaker: "" }, continuation]);
  expect(readPage(project).commands).toStrictEqual([duplicate, continuation]);
});

it("분기 순서가 바뀌면 같은 내용의 하위 줄을 수정하거나 분기 끝에 삽입할 수 없다", () => {
  const first = { text: "첫 분기", branch: [continuation] };
  const second = { text: "둘째 분기", branch: [{ ...continuation }] };
  const original = { ...choices, options: [first, second] };
  const reordered = { ...choices, options: [second, first] };
  const { project, target, readPage } = arrange("blank", [reordered]);
  const body = "조회한 분기만 편집합니다.";
  const position = updatePosition([original], continuation);
  expect(() => runPrimitive(project, target, "cmd.text.update", { ...position, branchPath: [0, 0], body }))
    .toThrow("명령 목록이 바뀌었습니다");
  expect(() => runPrimitive(project, target, "cmd.text.insert", {
    branchPath: [0, 0], expectedPageHashes: position.expectedPageHashes, body,
  })).toThrow("명령 목록이 바뀌었습니다");
  expect(readPage(project).commands).toStrictEqual([reordered]);
});

it("반복 안의 취소 분기에 삽입하고 잘못된 경로는 거부한다", () => {
  const loop: Command = { kind: "loop", body: [choices] };
  const { project, target, readPage } = arrange("blank", [loop, continuation]);
  const branchPath = [0, LOOP_BODY_BRANCH_INDEX, 0, CHOICE_CANCEL_BRANCH_INDEX];
  const body = "취소 분기의 끝에 대사를 추가합니다.";
  const { after } = runPrimitive(project, target, "cmd.text.insert", {
    branchPath, body, expectedPageHashes: [loop, continuation].map(eventCommandHash),
  });
  expect(readPage(after).commands).toStrictEqual([{
    ...loop, body: [{ ...choices, cancelBranch: [...choices.cancelBranch!, { kind: "text", body, speaker: "" }] }],
  }, continuation]);
  expect(() => runPrimitive(project, target, "cmd.text.insert", { branchPath: [...branchPath, 0], body })).toThrow("분기");
});

it("여러 분기가 같은 명령 목록을 공유하면 다른 분기까지 바뀌는 수정을 거부한다", () => {
  const shared = [continuation];
  const joined = { ...choices, options: choices.options.map(option => ({ ...option, branch: shared })) };
  const { project, target, readPage } = arrange("blank", [joined]);
  expect(() => runPrimitive(project, target, "cmd.text.update", {
    ...updatePosition([joined], continuation), branchPath: [0, 0], body: "첫 선택지만 바꿉니다.",
  })).toThrow("다른 명령이나 분기");
  expect(readPage(project).commands).toStrictEqual([joined]);
  expect(shared).toStrictEqual([continuation]);
});

it("배열이 없는 이전 취소 분기에 직접 삽입하고 실행 취소하면 원래 형식을 복원한다", async () => {
  const { cancelBranch: _cancelBranch, ...legacy } = choices;
  const { project, target, readPage } = arrange("blank", [legacy, continuation]);
  const body = "취소 분기에 삽입한 대사입니다.";
  const { after } = runPrimitive(project, target, "cmd.text.insert", {
    branchPath: [0, CHOICE_CANCEL_BRANCH_INDEX], expectedPageHashes: [legacy, continuation].map(eventCommandHash), body,
  });
  expect(readPage(after).commands).toStrictEqual([{ ...legacy, cancelBranch: [{ kind: "text", body, speaker: "" }] }, continuation]);
  expect(readPage(project).commands).toStrictEqual([legacy, continuation]);
  await expectUndoRestores(project, after, target);
});

it("취소 분기 배열이 없는 이전 선택지를 수정해도 기존 분기와 배열의 부재를 유지한다", () => {
  const { cancelBranch: _cancelBranch, ...legacy } = choices;
  const { project, target, readPage } = arrange("blank", [legacy, continuation]);
  const args = updatePosition([legacy, continuation], legacy);
  const relabelled = runPrimitive(project, target, "cmd.choices.update", { ...args, optionLabels: ["할래요", "안 할래요"] });
  expect(readPage(relabelled.after).commands).toStrictEqual([{
    ...legacy, options: [{ ...legacy.options[0], text: "할래요" }, { ...legacy.options[1], text: "안 할래요" }],
  }, continuation]);
  const disabled = runPrimitive(project, target, "cmd.choices.update", { ...args, cancelBehavior: "disallow" });
  expect(readPage(disabled.after).commands).toStrictEqual([{ ...legacy, cancelBehavior: "disallow" }, continuation]);
  const disabledCommands = readPage(disabled.after).commands;
  const enabled = runPrimitive(disabled.after, target, "cmd.choices.update", {
    ...updatePosition(disabledCommands, disabledCommands[0]!), cancelBehavior: "branch",
  });
  expect(readPage(enabled.after).commands).toStrictEqual([{ ...legacy, cancelBranch: [] }, continuation]);
});

it("아이템 제시 목록을 바꿀 때 기존 정답과 분기를 계속 사용할 수 있어야 한다", () => {
  const { project, target, readPage } = arrange("built", [presentItem]);
  const args = updatePosition([presentItem], presentItem);
  expect(() => runPrimitive(project, target, "cmd.presentItem.update", { ...args, itemIds: ["item_ether"] }))
    .toThrow("제시할 목록에도");
  const { after } = runPrimitive(project, target, "cmd.presentItem.update", { ...args, itemIds: [potion] });
  expect(readPage(after).commands).toStrictEqual([{ ...presentItem, itemIds: [potion] }]);
});

it.each([39, 200.5, 201])("전신 그림 배율 %s를 거부한다", fullScale => {
  const { project, target } = arrange("built", []);
  expect(() => runPrimitive(project, target, "cmd.changeFace.insert", { presentation: "full", fullScale })).toThrow(PrimitiveError);
});

it("표시할 수 없는 그림은 거부하고 외형에서 실제로 표시되는 초상을 요약한다", () => {
  const { project, target } = arrange("built", []);
  const appearanceId = "appearance_without_portrait";
  const brokenId = "appearance_with_sound";
  const guardId = "appearance_guard";
  const resourceId = "sound_without_portrait";
  const withAssets: Project = {
    ...project,
    database: { ...project.database, characterAppearances: [
      { id: appearanceId, name: "초상 없는 외형", description: "" },
      { id: brokenId, name: "초상이 잘못된 외형", description: "", face: { resourceId } },
      { id: guardId, name: "경비 외형", description: "", face: { resourceId: face } },
    ] },
    assets: { ...project.assets, uploaded: {
      ...project.assets.uploaded, [resourceId]: { id: resourceId, name: "경비 목소리", kind: "sound", meta: {} },
    } },
  };
  expect(() => runPrimitive(withAssets, target, "cmd.changeFace.insert", { appearanceId })).toThrow("표시할 초상");
  expect(() => runPrimitive(withAssets, target, "cmd.changeFace.insert", { resourceId })).toThrow("표시할 수 있는 얼굴 그림");
  expect(() => runPrimitive(withAssets, target, "cmd.changeFace.insert", { appearanceId: brokenId })).toThrow("표시할 수 있는 얼굴 그림");
  expect(() => runPrimitive(withAssets, target, "cmd.changeFace.insert", { resourceId: "easyrpg-picture-retired" }))
    .toThrow("표시할 수 있는 얼굴 그림");
  const { sentence } = runPrimitive(withAssets, target, "cmd.changeFace.insert", { appearanceId: guardId, presentation: "full" });
  expect(sentence).toBe("「왼쪽 얼굴」 명령을 추가합니다.");
});

it("긴 대사 요약에서 내부 식별자를 가린다", () => {
  const { project, target, readPage } = arrange("blank", []);
  const body = "{\"actorId\": \"actor_secret\"} " + "이 문구는 저장됩니다. ".repeat(10);
  const { after, sentence } = runPrimitive(project, target, "cmd.text.insert", { body });
  expect(sentence).toMatch(/이 문구는 저장됩니다/u);
  expect(sentence).not.toMatch(/actor|secret|[{}\[\]]/iu);
  expect(sentence.length).toBeLessThanOrEqual(80);
  expect(readPage(after).commands).toStrictEqual([{ kind: "text", body, speaker: "" }]);
});

it("한국어 동작 요약에서 저작한 영문 대사와 변수 이름을 읽을 수 있다", () => {
  const { project, target } = arrange("built", []);
  const { sentence: textSentence } = runPrimitive(project, target, "cmd.text.insert", { body: "Meet me by the gate." });
  expect(textSentence).toContain("Meet me by the gate");
  expectKoreanSentence(textSentence, target);

  const named = { ...project, variables: project.variables.map(entry => entry.id === variable ? { ...entry, name: "Gate code" } : entry) };
  const { sentence: numberSentence } = runPrimitive(named, target, "cmd.inputNumber.insert", { variableId: variable });
  expect(numberSentence).toContain("Gate code");
  expectKoreanSentence(numberSentence, target);
});

function runInGame(kind: string, args: Record<string, unknown>, prior: Command[] = []) {
  const { project, target, mapId, readPage } = arrange("built", prior);
  const { after } = runPrimitive(project, target, `cmd.${kind}.insert`, {
    index: 0, expectedPageHashes: prior.map(eventCommandHash), ...args,
  });
  const session = startSession(after, 42);
  session.currentMapId = mapId;
  return { session, runtime: createInterpreter(readPage(after).commands, session, after, { currentEventId: eventId }) };
}

it("대화창 설정 명령이 다음 대사에 적용된다", () => {
  const { runtime } = runInGame("displayTextSettings", { position: "top", format: "transparent" }, [continuation]);
  expect(runtime.start()).toMatchObject({
    kind: "text", body: continuation.body, settings: { position: "top", format: "transparent" },
  });
});

it("키 입력 대기는 누른 키를 지정한 변수에 기록한다", () => {
  const { session, runtime } = runInGame("inputWait", { variableId: variable });
  expect(runtime.start()).toMatchObject({ kind: "inputWait" });
  expect(runtime.resume(6)).toEqual({ kind: "done" });
  expect(session.variables[variable]).toBe(6);
});

it("숫자 입력은 자릿수와 안내 문구를 표시하고 입력한 수를 저장한다", () => {
  const { session, runtime } = runInGame("inputNumber", { variableId: variable, digits: 3, prompt: "몇 개 살까?" });
  expect(runtime.start()).toMatchObject({ kind: "inputNumber", digits: 3, prompt: "몇 개 살까?" });
  expect(runtime.resume(137)).toEqual({ kind: "done" });
  expect(session.variables[variable]).toBe(137);
});

it("숫자 입력을 취소하면 이전 변수 값을 보존하고 다음 줄을 실행하지 않는다", () => {
  const { session, runtime } = runInGame("inputNumber", { variableId: variable, digits: 3 }, [continuation]);
  session.variables[variable] = 137;
  expect(runtime.start()).toMatchObject({ kind: "inputNumber" });
  expect(runtime.resume(-1)).toEqual({ kind: "done" });
  expect(session.variables[variable]).toBe(137);
});

it("문자 입력은 입력한 글자를 제한 길이로 잘라 변수에 저장한다", () => {
  const { session, runtime } = runInGame("enterHeroName", { stringVariableId: variable, maxLength: 3 });
  expect(runtime.start()).toMatchObject({ kind: "enterHeroName", maxLength: 3 });
  expect(runtime.resume("바람노래")).toEqual({ kind: "done" });
  expect(session.stringVariables?.[variable]).toBe("바람노");
});

it("변수에 받던 이름 입력에 배우를 지정하면 플레이에서 배우 이름을 바꾼다", async () => {
  const original: Command = { kind: "enterHeroName", actorId: "", stringVariableId: variable, maxLength: 6, showInitialName: true };
  const { project, target, mapId, readPage } = arrange("built", [original]);
  const position = updatePosition([original], original);
  const { after } = runPrimitive(project, target, "cmd.enterHeroName.update", { ...position, actorId: actor });
  expect(readPage(after).commands[0]).toMatchObject({ actorId: actor, stringVariableId: undefined });
  const session = startSession(after, 42);
  session.currentMapId = mapId;
  session.stringVariables = { [variable]: "기존 글자" };
  const runtime = createInterpreter(readPage(after).commands, session, after, { currentEventId: eventId });
  expect(runtime.start()).toMatchObject({ kind: "enterHeroName", actorId: actor });
  expect(runtime.resume("새 이름")).toEqual({ kind: "done" });
  expect(session.actorNames?.[actor]).toBe("새 이름");
  expect(session.stringVariables[variable]).toBe("기존 글자");
  const explicitVariable = runPrimitive(project, target, "cmd.enterHeroName.update", {
    ...position, actorId: actor, stringVariableId: anotherVariable,
  });
  expect(readPage(explicitVariable.after).commands[0]).toMatchObject({ actorId: actor, stringVariableId: anotherVariable });
  await expectUndoRestores(project, after, target);
});

it("정답 아이템을 제시하면 소지품에서 한 개가 줄어든다", () => {
  const { session, runtime } = runInGame("presentItem", { itemIds: [potion], correctItemIds: [potion], consume: true });
  session.inventory[potion] = 3;
  expect(runtime.start()).toMatchObject({ kind: "presentItem", items: [{ itemId: potion, count: 3 }] });
  expect(runtime.resume(potion)).toEqual({ kind: "done" });
  expect(session.inventory[potion]).toBe(2);
});

it("아이템 제시를 수정한 뒤 오답과 닫기는 각 분기를 실행하고 아이템을 소모하지 않는다", () => {
  const authored = { ...presentItem, consume: true };
  const { project, target, readPage } = arrange("built", [authored, continuation]);
  const prompt = "증거를 보여 주세요.";
  const { after } = runPrimitive(project, target, "cmd.presentItem.update", {
    ...updatePosition([authored, continuation], authored), prompt,
  });
  const ether = "item_ether";
  for (const selection of [ether, undefined]) {
    const session = startSession(after, 42);
    session.inventory[potion] = 3;
    session.inventory[ether] = 2;
    const runtime = createInterpreter(readPage(after).commands, session, after, { currentEventId: eventId });
    expect(runtime.start()).toMatchObject({ kind: "presentItem", prompt });
    expect(runtime.resume(selection)).toMatchObject(selection
      ? { kind: "text", body: "이 물건은 아니에요." }
      : { kind: "wait", ms: 50 });
    expect(session.inventory[potion]).toBe(3);
    expect(session.inventory[ether]).toBe(2);
  }
});

it("중첩 선택지를 편집해도 숨김, 비활성, 취소를 플레이할 수 있고 실행 취소가 복원한다", async () => {
  const nestedChoice = {
    ...choices,
    options: [choices.options[0]!, {
      ...choices.options[1]!, enableWhen: { kind: "switch", switchId, value: false } as const,
    }],
  };
  const fork: Command = {
    kind: "fork", condition: { kind: "switch", switchId, value: true }, then: [nestedChoice], else: [continuation],
  };
  const commands = [fork, continuation];
  const { project, target, readPage } = arrange("built", commands);
  const { after } = runPrimitive(project, target, "cmd.choices.update", {
    ...updatePosition(commands, nestedChoice), branchPath: [0, FORK_THEN_BRANCH_INDEX],
    optionLabels: ["숨기는 줄", "고를 수 없는 줄"], appendOption: "다음으로",
  });
  expect(readPage(after).commands).toStrictEqual([{
    ...fork, then: [{
      ...nestedChoice,
      options: [
        { ...nestedChoice.options[0], text: "숨기는 줄" },
        { ...nestedChoice.options[1], text: "고를 수 없는 줄" },
        { text: "다음으로", branch: [] },
      ],
    }],
  }, continuation]);
  for (const option of [0, 1, -1]) {
    const session = startSession(after, 42);
    session.switches[switchId] = true;
    const runtime = createInterpreter(readPage(after).commands, session, after, { currentEventId: eventId });
    expect(runtime.start()).toMatchObject({
      kind: "choices", cancelBehavior: "branch",
      options: [{ text: "고를 수 없는 줄", disabled: true, disabledText: "아직 이릅니다." }, { text: "다음으로" }],
    });
    expect(runtime.resume(option)).toMatchObject({
      kind: "text", body: option === -1 ? "다음에 오세요." : continuation.body,
    });
  }
  await expectUndoRestores(project, after, target);
});

// The shared fixtures do not contain these rows. Seed the existing command,
// then execute the same typed update that the request maps to.
it.each(seededCases)("$request", async ({ primitive, args, fields }) => {
  const original = cases.find(entry => `cmd.${entry.original.kind}.update` === primitive)?.original;
  expect(original).toBeDefined();
  const { project, target, readPage } = arrange("built", [original!, continuation]);
  const { after, sentence } = runPrimitive(project, target, primitive, {
    ...args, ...updatePosition([original!, continuation], original!, args.index),
  });
  const expected = { ...original!, ...fields };
  if (primitive === "cmd.presentItem.update" && args.itemIds?.length === 0) Reflect.deleteProperty(expected, "itemIds");
  expect(jsonEqual(readPage(after).commands, [expected, continuation])).toBe(true);
  expectKoreanSentence(sentence, target);
  await expectUndoRestores(project, after, target);
});
