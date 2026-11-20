/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { checkSmallTaskScope, type SmallTaskScope } from "@/ai/smallTaskScope";
import { dialogueTextHash } from "@/editor/dialogue/dialogueIndex";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/26-npc-dialogue";
import { createInterpreter } from "@/player/interpreter";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { eventCommandHash } from "@/project/eventCommands/singleCommandOps";
import { startSession } from "@/project/session";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { eventTarget, expectKoreanSentence, expectUndoRestores, loadFixture } from "./harness";

const eventId = "ev_dialogue_test";
const pageId = "page_dialogue_test";
const greeting = { kind: "text", body: "어서 오시오.", speaker: "점원", emotion: "happy" } as const;
const second = { kind: "text", body: "천천히 둘러보게.", speaker: "점원" } as const;
const reward = { kind: "changeGold", op: "+=", amount: 3 } as const;
const choices = {
  kind: "choices",
  prompt: "살펴보시겠어요?",
  options: [
    { text: "좋아", showWhen: { kind: "gold", op: ">=", amount: 0 }, branch: [reward, second] },
    { text: "나중에", branch: [] },
  ],
  cancelBehavior: "branch",
  cancelBranch: [{ kind: "text", body: "안녕히 가세요." }],
} satisfies Command;
const commands: Command[] = [greeting, choices, second];

function blank(list = commands) {
  const fixture = loadFixture("blank");
  const project = { ...fixture, session: { ...fixture.session } };
  const map = { ...createBlankMap("작은 마을", 7, 7), id: "map_dialogue_test" };
  const page: EventPage = {
    id: pageId, name: "인사", conditions: [], graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" } },
    trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: structuredClone(list),
  };
  const event: GameEvent = {
    id: eventId, name: "점원", x: 2, y: 2, trigger: { kind: "action" }, commands: [],
    pages: [page, { ...page, id: "page_dialogue_second", name: "다시 만남", commands: [{ kind: "text", body: "다시 왔군." }] }],
  };
  map.events = [event, { ...event, id: "ev_other", name: "다른 점원", x: 3, pages: structuredClone(event.pages) }];
  project.maps = { [map.id]: map };
  project.startMapId = map.id;
  project.startPos = { x: 1, y: 1 };
  project.mapTree = { mapId: map.id, children: [] };
  return { project, map, event, target: eventTarget(project, map.id, event.id, pageId) };
}

function withOtherSpeech(project: Project, mapId: string, eventIndex: number, pageIndex: number): Project {
  const map = project.maps[mapId]!;
  const events = map.events.slice();
  const event = events[eventIndex]!;
  const pages = event.pages!.slice();
  const page = pages[pageIndex]!;
  pages[pageIndex] = { ...page, commands: [{ ...greeting, body: "범위 밖 대사" }, ...page.commands.slice(1)] };
  events[eventIndex] = { ...event, pages };
  return { ...project, maps: { ...project.maps, [mapId]: { ...map, events } } };
}

const fixed = { ...greeting, body: "어서 오세요." };
const inserted = { kind: "text", speaker: "", body: "따뜻한 차도 있어요." } as const;
const newChoice = { ...choices, options: [{ ...choices.options[0]!, text: "물론이지" }, choices.options[1]!] };
const tone = { ...choices, options: [{ ...choices.options[0]!, branch: [reward, { ...second, body: "편하게 둘러보세요." }] }, choices.options[1]!] };
const once = {
  kind: "fork", condition: { kind: "selfSwitch", key: "A", value: false },
  then: [{ kind: "setSelfSwitch", key: "A", value: true }, greeting],
} satisfies Command;

const CASES = [
  { id: "dialogue.line.rewrite", args: { path: [0], text: fixed.body, hash: dialogueTextHash(greeting.body) }, result: [fixed, choices, second], refusal: { path: [9], text: "새 문구" } },
  { id: "dialogue.line.insert", args: { path: [1], text: inserted.body }, result: [greeting, inserted, choices, second], refusal: { path: [1, 9, 0], text: "새 문구" } },
  { id: "dialogue.line.remove", args: { path: [2] }, result: [greeting, choices], refusal: { path: [9] } },
  { id: "dialogue.choiceLabel.rewrite", args: { path: [1], option: 0, text: "물론이지", hash: eventCommandHash(choices) }, result: [greeting, newChoice, second], refusal: { path: [1], option: 9, text: "새 문구" } },
  { id: "dialogue.tone.rewrite", args: { edits: [{ path: [0], text: fixed.body }, { path: [1, 0, 1], text: "편하게 둘러보세요." }] }, result: [fixed, tone, second], refusal: { edits: [{ path: [0], text: "변경" }, { path: [1, 9, 0], text: "범위 밖" }] } },
  { id: "dialogue.firstTimeOnly", args: { path: [0] }, result: [once, choices, second], refusal: { path: [9] } },
  { id: "npc.rename", args: { name: "한스" }, result: commands, name: "한스" },
  { id: "dialogue.speaker.set", args: { path: [0], speaker: "한스" }, result: [{ ...greeting, speaker: "한스" }, choices, second], refusal: { path: [9], speaker: "한스" } },
];

describe("선택한 인물의 대사 편집", () => {
  it.each(CASES)("$id 저장 결과와 되돌리기", async ({ id, args, result, name }) => {
    const { project, map, event, target } = blank();
    const original = structuredClone(event);
    const { after, sentence } = runPrimitive(project, target, id, args);
    expectKoreanSentence(sentence, target);
    expect(sentence).toMatch(/\.$/u);
    expect(sentence.length).toBeLessThanOrEqual(80);
    expect(after.maps[map.id]!.events).toEqual([
      { ...original, name: name ?? original.name, pages: [{ ...original.pages![0]!, commands: result }, original.pages![1]!] },
      map.events[1],
    ]);
    expect(jsonEqual(event, original)).toBe(true);
    expect(after.session).toBe(project.session);
    await expectUndoRestores(project, after, target);
  });

  it.each(CASES)("$id 다른 페이지나 인물로 범위를 넓히지 않는다", ({ id, args, refusal }) => {
    const { project, map, event, target } = blank();
    const primitive = PRIMITIVES.find(entry => entry.id === id)!;
    const scope = primitive.scope({ project, target }, args);
    const { after } = runPrimitive(project, target, id, args);
    const outside = withOtherSpeech(after, map.id, 1, 0);
    expect(checkSmallTaskScope(project, outside, scope)).toMatchObject({ ok: false, reason: expect.stringContaining("범위 밖") });
    if (scope.kind !== "tileEvent") {
      const anotherPage = withOtherSpeech(after, map.id, 0, 1);
      expect(checkSmallTaskScope(project, anotherPage, scope)).toMatchObject({ ok: false, reason: expect.stringContaining("범위 밖") });
    }
    if (refusal) {
      expect(() => runPrimitive(project, target, id, refusal)).toThrow(/범위 밖/u);
    } else {
      const sign = { ...target, isNpc: false } as typeof target;
      expect(() => runPrimitive(project, sign, id, args)).toThrow(/범위 밖/u);
    }
    expect(project.maps[map.id]!.events[0]).toBe(event);
    expect(event.pages![0]!.commands).toEqual(commands);
  });

  it.each(["dialogue.firstTimeOnly", "dialogue.speaker.set", "npc.rename"])("%s 대사 문구 범위에서는 거절한다", id => {
    const { project, map, target } = blank();
    const args = CASES.find(entry => entry.id === id)!.args;
    const { after } = runPrimitive(project, target, id, args);
    const dialogue: SmallTaskScope = { kind: "dialogue", mapId: map.id, eventId, pageId };
    expect(checkSmallTaskScope(project, after, dialogue)).toMatchObject({
      ok: false, reason: expect.stringContaining("범위 밖"),
    });
  });

  it("오래된 원문 확인값과 사라진 제어 코드를 거절한다", () => {
    const line = { ...greeting, body: "\\C[1]어서 오시오." };
    const { project, target } = blank([line]);
    expect(() => runPrimitive(project, target, "dialogue.line.rewrite", {
      path: [0], hash: dialogueTextHash(greeting.body), text: line.body,
    })).toThrow(/원문이 바뀌었습니다/u);
    expect(() => runPrimitive(project, target, "dialogue.line.rewrite", {
      path: [0], text: "어서 오세요.",
    })).toThrow(/제어 코드/u);
  });

  it("빈 이름과 같은 위치의 중복 말투 수정을 거절한다", () => {
    const { project, target } = blank();
    expect(() => runPrimitive(project, target, "npc.rename", { name: " " })).toThrow(PrimitiveError);
    expect(() => runPrimitive(project, target, "dialogue.tone.rewrite", {
      edits: [{ path: [0], text: "어서 오세요." }, { path: [0], text: "또 뵙네요." }],
    })).toThrow(/두 번/u);
  });

  it("이름 미리보기의 식별자와 긴 문구를 가린다", () => {
    const { project, target } = blank();
    const { sentence } = runPrimitive(project, target, "npc.rename", { name: "ev_hidden " + "가".repeat(100) });
    expectKoreanSentence(sentence, target);
    expect(sentence).not.toContain("ev_hidden");
    expect(sentence.length).toBeLessThanOrEqual(80);
  });

  it("선택한 페이지가 없는 오래된 이벤트에 페이지 편집을 시도하면 거절한다", () => {
    const { project, event, map } = blank();
    event.commands = [greeting];
    delete event.pages;
    const target = eventTarget(project, map.id, eventId);
    expect(() => runPrimitive(project, target, "dialogue.line.remove", { path: [0] })).toThrow(/페이지를 찾을 수 없어요/u);
  });
});

describe("대사 재생", () => {
  it("편집한 인사와 새 대사가 순서대로 대화창에 뜬다", () => {
    const { project, map, target } = blank([greeting]);
    const fixedProject = runPrimitive(project, target, "dialogue.line.rewrite", { path: [0], text: fixed.body }).after;
    const { after } = runPrimitive(fixedProject, target, "dialogue.line.insert", { text: inserted.body });
    const run = createInterpreter(after.maps[map.id]!.events[0]!.pages![0]!.commands, startSession(after, 1), after);
    expect(run.start()).toMatchObject({ kind: "text", body: fixed.body, speaker: "점원" });
    expect(run.resume(undefined)).toMatchObject({ kind: "text", body: inserted.body });
    expect(run.resume(undefined)).toEqual({ kind: "done" });
  });

  it("새 선택지 문구를 누르면 기존 분기의 보상과 답이 나온다", () => {
    const { project, map, target } = blank([choices]);
    const { after } = runPrimitive(project, target, "dialogue.choiceLabel.rewrite", { path: [0], option: 0, text: "물론이지" });
    const session = startSession(after, 1);
    const gold = session.gold;
    const run = createInterpreter(after.maps[map.id]!.events[0]!.pages![0]!.commands, session, after);
    expect(run.start()).toMatchObject({ kind: "choices", options: [{ text: "물론이지" }, { text: "나중에" }] });
    expect(run.resume(0)).toMatchObject({ kind: "text", body: second.body });
    expect(session.gold).toBe(gold + 3);
  });

  it("처음에만 인사를 보여 주고 이후에도 보상과 나머지 대사는 실행한다", () => {
    const { project, event, map, target } = blank([greeting, reward, second]);
    event.pages![1]!.conditions = [{ kind: "not", condition: { kind: "selfSwitch", key: "A", value: false } }];
    project.session.selfSwitches = { [eventId]: { B: false } };
    project.commonEvents = [{ id: "common_fixture", name: "점원 공용", trigger: "none", commands: [{ kind: "setSelfSwitch", key: "C", value: true }] }];
    event.pages![1]!.commands.push({ kind: "callCommonEvent", commonEventId: "common_fixture" });
    const { after } = runPrimitive(project, target, "dialogue.firstTimeOnly", { path: [0] });
    const edited = after.maps[map.id]!.events[0]!.pages![0]!.commands;
    expect(edited[0]).toMatchObject({ condition: { key: "D", value: false } });
    const session = startSession(after, 1);
    const gold = session.gold;
    const talk = () => createInterpreter(edited, session, after, { currentEventId: eventId });
    const first = talk();
    expect(first.start()).toMatchObject({ kind: "text", body: greeting.body });
    expect(first.resume(undefined)).toMatchObject({ kind: "text", body: second.body });
    expect(first.resume(undefined)).toEqual({ kind: "done" });
    const next = talk();
    expect(next.start()).toMatchObject({ kind: "text", body: second.body });
    expect(next.resume(undefined)).toEqual({ kind: "done" });
    expect(session.selfSwitches?.[eventId]).toMatchObject({ D: true });
    expect(session.gold).toBe(gold + 6);
    event.pages![1]!.commands.push({ kind: "setSelfSwitch", key: "D", value: false });
    expect(() => runPrimitive(project, target, "dialogue.firstTimeOnly", { path: [0] })).toThrow(/비어 있는 셀프 스위치/u);
  });

  it("완성된 게임의 선택지 갈래 대사만 고친다", async () => {
    const project = loadFixture("built");
    const map = project.maps[project.startMapId]!;
    const event = map.events.find(entry => entry.id === "ev_supply_shop")!;
    const target = eventTarget(project, map.id, event.id, "ev_supply_shop_offer");
    const { after, sentence } = runPrimitive(project, target, "dialogue.line.rewrite", { path: [5, 1, 0], text: "다음에 다시 오세요." });
    const edited = after.maps[map.id]!.events.find(entry => entry.id === event.id)!;
    const selection = edited.pages![0]!.commands[5];
    expect(selection).toMatchObject({ kind: "choices", options: [
      { text: "수락한다" }, { text: "다음에", branch: [{ body: "다음에 다시 오세요.", speaker: "의뢰인" }] },
    ] });
    expect(edited.pages!.slice(1)).toEqual(event.pages!.slice(1));
    expectKoreanSentence(sentence, target);
    await expectUndoRestores(project, after, target);
  }, 120_000);

  it("편의점 게임에서는 고른 근무 장면의 화자만 바뀐다", async () => {
    const project = loadFixture("maou");
    const map = project.maps.map_mk_konbini!;
    const event = map.events.find(entry => entry.id === "ev_mk_hina")!;
    const page = event.pages!.find(entry => entry.id === "ev_mk_hina_p3")!;
    const index = page.commands.findIndex(command => command.kind === "text");
    expect(index).toBeGreaterThanOrEqual(0);
    const target = eventTarget(project, map.id, event.id, page.id);
    const { after, sentence } = runPrimitive(project, target, "dialogue.speaker.set", { path: [index], speaker: "선배 알바" });
    const edited = after.maps[map.id]!.events.find(entry => entry.id === event.id)!;
    expect(edited.pages).toEqual(event.pages!.map(entry => entry !== page ? entry : {
      ...page, commands: page.commands.map((command, i) => i === index ? { ...command, speaker: "선배 알바" } : command),
    }));
    expect(edited.name).toBe("히나");
    expectKoreanSentence(sentence, target);
    await expectUndoRestores(project, after, target);
  }, 180_000);
});
