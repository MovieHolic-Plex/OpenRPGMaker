// @vitest-environment happy-dom
import { beforeAll, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { createInterpreter } from "@/player/interpreter";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { eventCommandHash } from "@/project/eventCommands/singleCommandOps";
import { startSession } from "@/project/session";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { normalizeEventPage } from "@/editor/eventPages";
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
  const args = { ...testCase[action], ...(action === "update" ? { index: 0 } : {}) };
  const primitive = PRIMITIVES.find(entry => entry.id === id)!;
  const { after, sentence } = runPrimitive(project, target, id, args);
  const expected = action === "insert" ? [original, continuation, testCase.inserted] : [testCase.updated, continuation];
  expect(readPage(after).commands).toStrictEqual(expected);
  expect(readPage(project).commands).toStrictEqual([original, continuation]);
  expect(readPage(after, 1)).toBe(siblingPage);
  expect(sentence).toBe(primitive.describe({ project, target }, args));
  expect(sentence).toMatch(/[가-힣].*합니다\.$/u);
  expect(sentence).not.toMatch(/[a-z{}\[\]]/iu);
  expect(sentence.length).toBeLessThanOrEqual(80);

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
  { id: "choices", args: { optionLabels: ["예"], cancelBehavior: "choice2" }, message: "고를 선택지" },
  { id: "presentItem", args: { correctItemIds: ["item_missing"] }, message: "아이템" },
  { id: "inputWait", args: { variableId: "var_missing" }, message: "변수" },
  { id: "inputNumber", args: { variableId: "var_missing" }, message: "변수" },
  { id: "enterHeroName", args: { actorId: "actor_missing" }, message: "배우" },
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
    index: 1, body: "존재하지 않는 줄입니다.",
  })).toThrow("범위 밖");
  expect(() => runPrimitive(project, target, "cmd.text.insert", {
    branchPath: [0, 0], body: "대사에는 분기가 없습니다.",
  })).toThrow("범위 밖");
});

it("분기 안의 대사를 변경하고 오래된 줄 확인값을 거부한다", () => {
  const { project, target, readPage } = arrange("built", [choices]);
  const args = { branchPath: [0, 0], index: 0, body: "분기 안의 새 대사입니다." };
  const conflict = () => runPrimitive(project, target, "cmd.text.update", { ...args, expectedHash: "stale" });
  expect(conflict).toThrow("명령 줄이 바뀌었습니다");
  const { after } = runPrimitive(project, target, "cmd.text.update", { ...args, expectedHash: eventCommandHash(continuation) });
  expect(readPage(after).commands).toStrictEqual([{
    ...choices, options: [{ ...choices.options[0], branch: [{ ...continuation, body: args.body }] }, choices.options[1]],
  }]);
  expect(jsonEqual(readPage(project).commands, [choices])).toBe(true);
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

function runInGame(kind: string, args: Record<string, unknown>, prior: Command[] = []) {
  const { project, target, mapId, readPage } = arrange("built", prior);
  const { after } = runPrimitive(project, target, `cmd.${kind}.insert`, { index: 0, ...args });
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

it("문자 입력은 입력한 글자를 제한 길이로 잘라 변수에 저장한다", () => {
  const { session, runtime } = runInGame("enterHeroName", { stringVariableId: variable, maxLength: 3 });
  expect(runtime.start()).toMatchObject({ kind: "enterHeroName", maxLength: 3 });
  expect(runtime.resume("바람노래")).toEqual({ kind: "done" });
  expect(session.stringVariables?.[variable]).toBe("바람노");
});

it("정답 아이템을 제시하면 소지품에서 한 개가 줄어든다", () => {
  const { session, runtime } = runInGame("presentItem", { itemIds: [potion], correctItemIds: [potion], consume: true });
  session.inventory[potion] = 3;
  expect(runtime.start()).toMatchObject({ kind: "presentItem", items: [{ itemId: potion, count: 3 }] });
  expect(runtime.resume(potion)).toEqual({ kind: "done" });
  expect(session.inventory[potion]).toBe(2);
});

// The shared fixtures do not contain these rows. Seed the existing command,
// then execute the same typed update that the request maps to.
it.each(seededCases)("$request", async ({ primitive, args, fields }) => {
  const original = cases.find(entry => `cmd.${entry.original.kind}.update` === primitive)?.original;
  expect(original).toBeDefined();
  const { project, target, readPage } = arrange("built", [original!, continuation]);
  const { after, sentence } = runPrimitive(project, target, primitive, args);
  const expected = { ...original!, ...fields };
  if (primitive === "cmd.presentItem.update" && args.itemIds?.length === 0) Reflect.deleteProperty(expected, "itemIds");
  expect(jsonEqual(readPage(after).commands, [expected, continuation])).toBe(true);
  expectKoreanSentence(sentence, target);
  await expectUndoRestores(project, after, target);
});
