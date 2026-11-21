/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { formatPiToolSuccess } from "@/ai/piAgent/toolAdapter";
import { checkSmallTaskScope, type SmallTaskScope } from "@/ai/smallTaskScope";
import { collectDialogueLines, dialogueTextHash } from "@/editor/dialogue/dialogueIndex";
import { CHOICE_CANCEL_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PrimitiveError, SELECT_EVENT_PAGE, STALE_COMMAND_LIST } from "@/editor/smallTask/primitives/errors";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/26-npc-dialogue";
import { runToolAsync } from "@/editor/tools/asyncToolRunner";
import { createInterpreter } from "@/player/interpreter";
import { objectiveTargetViews } from "@/player/objectiveTarget";
import { affectionVariableOwner } from "@/project/affectionVariables";
import { ensureSwitchVariableSlots } from "@/project/defaults/blankProject";
import { removeLegacySpriteReferences } from "@/project/defaults/defaultAssets";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { eventCommandHash, eventCommandListHash } from "@/project/eventCommands/singleCommandOps";
import { projectWithEventRevision } from "@/project/projectClone";
import { runtimeEventViewsForMap } from "@/project/runtimeEventState";
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
    id: eventId, name: "찻집 주인", x: 2, y: 2, trigger: { kind: "action" }, commands: [],
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
  const event = project.maps[mapId]!.events[eventIndex]!;
  return withPageCommands(project, mapId, event, pageIndex, commands => [
    { ...greeting, body: "범위 밖 대사" }, ...commands.slice(1),
  ]);
}

function withPageCommands(project: Project, mapId: string, event: GameEvent, pageIndex: number, edit: (list: Command[]) => Command[]) {
  const pages = event.pages!.map((page, index) => index === pageIndex
    ? { ...page, commands: edit(page.commands) }
    : page);
  return projectWithEventRevision(project, mapId, event.id, { ...event, pages });
}

const fixed = { ...greeting, body: "어서 오세요." };
const inserted = { kind: "text", speaker: "", body: "따뜻한 차도 있어요." } as const;
const newChoice = { ...choices, options: [{ ...choices.options[0]!, text: "물론이지" }, choices.options[1]!] };
const tone = { ...choices, options: [{ ...choices.options[0]!, branch: [reward, { ...second, body: "편하게 둘러보세요." }] }, choices.options[1]!] };
const once = {
  kind: "fork", condition: { kind: "selfSwitch", key: "A", value: false },
  then: [greeting, { kind: "setSelfSwitch", key: "A", value: true, skipDuringFastForward: true }],
} satisfies Command;

const CASES = [
  { id: "dialogue.line.rewrite", args: { path: [0], text: fixed.body, hash: dialogueTextHash(greeting.body) }, result: [fixed, choices, second], refusal: { path: [9], text: "새 문구" } },
  { id: "dialogue.line.insert", args: { path: [1], text: inserted.body }, result: [greeting, inserted, choices, second], refusal: { path: [1, 9, 0], text: "새 문구" } },
  { id: "dialogue.line.remove", args: { path: [2], pageHash: eventCommandListHash(commands) }, result: [greeting, choices], refusal: { path: [9], pageHash: eventCommandListHash(commands) } },
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
    expect(() => runPrimitive(project, target, "dialogue.line.remove", { path: [0], pageHash: eventCommandListHash(event.commands) })).toThrow(/페이지를 찾을 수 없어요/u);
  });

  it.each(CASES.filter(({ id }) => id !== "npc.rename"))("$id 여러 페이지가 있으면 선택한 페이지가 필요하다", ({ id, args }) => {
    const { project, map } = blank();
    const target = eventTarget(project, map.id, eventId);
    expect(() => runPrimitive(project, target, id, args)).toThrow(SELECT_EVENT_PAGE);
  });

  it("페이지가 하나뿐이면 대상을 그대로 사용하고, 이름 변경은 이벤트 전체에 적용한다", () => {
    const { project, map, event } = blank();
    const target = eventTarget(project, map.id, eventId);
    const renamed = runPrimitive(project, target, "npc.rename", { name: "한스" }).after;
    expect(renamed.maps[map.id]!.events[0]).toEqual({ ...event, name: "한스" });

    const singlePage = projectWithEventRevision(project, map.id, eventId, { ...event, pages: event.pages!.slice(0, 1) });
    const { after } = runPrimitive(singlePage, target, "dialogue.line.rewrite", { path: [0], text: fixed.body });
    expect(after.maps[map.id]!.events[0]!.pages![0]!.commands[0]).toEqual(fixed);
  });

  it("선택한 뒤 이벤트가 옮겨지거나 사라졌으면 대사를 건드리지 않는다", () => {
    const { project, target, event, map } = blank();
    const apply = (current: Project) => runPrimitive(current, target, "dialogue.line.rewrite", { path: [0], text: fixed.body });
    const moved = projectWithEventRevision(project, map.id, eventId, { ...event, x: event.x + 1 });
    expect(() => apply(moved)).toThrow(/선택한 칸의 이벤트를 다시 고르세요/u);
    const removed = projectWithEventRevision(moved, map.id, eventId, null);
    expect(() => apply(removed)).toThrow(/선택한 칸의 이벤트를 다시 고르세요/u);
    expect(event.pages![0]!.commands).toEqual(commands);
  });

  it("선택 이후 인물 그림을 지운 이벤트는 이전 선택으로 이름을 바꿀 수 없다", () => {
    const { project, target, event } = blank();
    event.pages![0]!.graphic = {};
    expect(() => runPrimitive(project, target, "npc.rename", { name: "한스" })).toThrow(/인물을 다시 골라/u);
  });

  it("공유하던 선택지 두 갈래 중 고른 갈래 한 줄만 고친다", () => {
    const { project, target, event, map } = blank([choices]);
    const choice = event.pages![0]!.commands[0] as typeof choices;
    choice.options[1]!.branch = choice.options[0]!.branch;
    const { after } = runPrimitive(project, target, "dialogue.line.rewrite", { path: [0, 0, 1], text: fixed.body });
    expect(after.maps[map.id]!.events[0]!.pages![0]!.commands[0]).toMatchObject({
      options: [{ branch: [reward, { ...second, body: fixed.body }] }, { branch: [reward, second] }],
    });
    expect(choice.options[0]!.branch).toEqual([reward, second]);
  });

  it("취소 분기만 고치고 없는 분기는 만들지 않는다", () => {
    const { project, target, event, map } = blank([choices]);
    const { after } = runPrimitive(project, target, "dialogue.line.rewrite", {
      path: [0, CHOICE_CANCEL_BRANCH_INDEX, 0], text: fixed.body,
    });
    expect(after.maps[map.id]!.events[0]!.pages![0]!.commands).toEqual([
      { ...choices, cancelBranch: [{ kind: "text", body: fixed.body }] },
    ]);
    expect(() => runPrimitive(project, target, "dialogue.line.insert", { path: [0, -2, 0], text: fixed.body })).toThrow(PrimitiveError);
    expect(event.pages![0]!.commands).toEqual([choices]);
  });

  it("줄바꿈으로만 된 대사와 대사가 없는 위치를 거절한다", () => {
    const { project, target } = blank();
    expect(() => runPrimitive(project, target, "dialogue.line.insert", { text: "\\n" })).toThrow(/새 문구를 입력/u);
    expect(() => runPrimitive(project, target, "dialogue.line.remove", { path: Array(1), pageHash: eventCommandListHash(commands) })).toThrow(/위치/u);
    expect(() => runPrimitive(project, target, "dialogue.line.rewrite", { path: [-1], text: fixed.body })).toThrow(/위치/u);
    expect(() => runPrimitive(project, target, "dialogue.line.remove", { path: [0] })).toThrow(/형식/u);
  });

  it("같은 명령이 반복돼도 끼워 넣기 전 읽은 위치로 다른 대사를 삭제하지 않는다", async () => {
    const { project, target, event, map } = blank([greeting, greeting, second]);
    const readPageHash = async (current: Project) => {
      const read = await runToolAsync({ project: current, assistantRun: true }, "get_event", {
        mapId: map.id, eventId: event.id, includeCommandHashes: true,
      });
      expect(read.ok).toBe(true);
      const currentEvent = current.maps[map.id]!.events[0]!;
      expect(read.data).toMatchObject({
        event: currentEvent,
        commandHashes: currentEvent.pages!.map(page => ({
          pageId: page.id,
          commands: page.commands.map((command, index) => ({
            index, branchPath: [], hash: eventCommandHash(command),
          })),
        })),
      });
      const hashes = (read.data as { pageHashes: { pageId: string; pageHash: string }[] }).pageHashes;
      const pageHash = hashes.find(entry => entry.pageId === pageId)!.pageHash;
      expect(JSON.parse(formatPiToolSuccess(read, 200))).toMatchObject({
        dataTruncated: true, dataPreview: expect.stringContaining(pageHash),
      });
      return pageHash;
    };
    const pageHash = await readPageHash(project);
    const inserted = runPrimitive(project, target, "dialogue.line.insert", { path: [0], text: "새 인사" }).after;
    const currentPage = inserted.maps[map.id]!.events[0]!.pages![0]!;
    expect(eventCommandHash(currentPage.commands[1]!)).toBe(eventCommandHash(greeting));
    expect(() => runPrimitive(inserted, target, "dialogue.line.remove", { path: [1], pageHash })).toThrow(STALE_COMMAND_LIST);
    expect(currentPage.commands).toHaveLength(4);

    const { after } = runPrimitive(inserted, target, "dialogue.line.remove", { path: [2], pageHash: await readPageHash(inserted) });
    expect(after.maps[map.id]!.events[0]!.pages![0]!.commands).toEqual([currentPage.commands[0], greeting, second]);
    await expectUndoRestores(inserted, after, target);
  });

  it("끼워 넣는 기준 명령이 바뀌었으면 해당 위치를 다시 읽어야 한다", () => {
    const { project, target, map } = blank();
    const insert = (hash: string) => runPrimitive(project, target, "dialogue.line.insert", {
      path: [1], text: inserted.body, hash,
    }).after;
    expect(() => insert(eventCommandHash(greeting))).toThrow(/기준 명령이 바뀌었습니다/u);
    expect(insert(eventCommandHash(choices)).maps[map.id]!.events[0]!.pages![0]!.commands).toEqual([
      greeting, inserted, choices, second,
    ]);
  });

  it("같은 문구가 있어도 자료집 대사 제안이 다른 명령으로 옮겨 가지 않는다", () => {
    const { project, target, event, map } = blank([greeting, greeting, choices]);
    const line = collectDialogueLines(project).find(item => item.eventId === eventId && item.pageId === pageId &&
      item.path.join(".") === "1")!;
    project.dialogueDesk = { voices: [], proposals: [{
      id: "proposal_fixture", lineId: line.id, baseHash: line.hash, before: line.text, after: fixed.body,
      source: "human", createdAt: "",
    }] };
    const run = (id: string, args: Record<string, unknown>) => runPrimitive(project, target, id, args);
    expect(() => run("dialogue.line.insert", { path: [0], text: inserted.body })).toThrow(/제안 위치가 바뀌어요/u);
    const pageHash = eventCommandListHash(event.pages![0]!.commands);
    expect(() => run("dialogue.line.remove", { path: [0], pageHash })).toThrow(/제안 위치가 바뀌어요/u);
    expect(() => run("dialogue.firstTimeOnly", { path: [1] })).toThrow(/제안 위치가 바뀌어요/u);
    const { after } = run("dialogue.line.remove", { path: [2, 0, 1], pageHash });
    expect(after.dialogueDesk).toBe(project.dialogueDesk);
    expect(after.maps[map.id]!.events[0]!.pages![0]!.commands[2]).toMatchObject({ options: [{ branch: [reward] }, { branch: [] }] });
    expect(event.pages![0]!.commands).toEqual([greeting, greeting, choices]);
  });

  it.each([
    { primitive: "dialogue.line.remove", args: { path: [0] } },
    { primitive: "dialogue.firstTimeOnly", args: { path: [0] } },
    { primitive: "dialogue.line.insert", args: { path: [1], text: "새 인사" } },
  ])("$primitive 선택지의 질문으로 쓰는 대사를 떼어 내지 않는다", ({ primitive, args }) => {
    const promptless = { ...choices, prompt: undefined };
    const { project, target, event } = blank([greeting, promptless]);
    const run = createInterpreter(event.pages![0]!.commands, startSession(project, 1), project);
    expect(run.start()).toMatchObject({ kind: "text", body: greeting.body, beforeChoices: true });
    const input = primitive === "dialogue.line.remove" ? { ...args, pageHash: eventCommandListHash(event.pages![0]!.commands) } : args;
    expect(() => runPrimitive(project, target, primitive, input)).toThrow(/다음 선택지의 질문/u);
    expect(event.pages![0]!.commands).toEqual([greeting, promptless]);
  });

  it("공용 이벤트의 대사가 이전 이름을 화자로 쓰면 이름 변경을 거절한다", () => {
    const { project, target, event } = blank();
    project.commonEvents = [{
      id: "common_name", name: "마을 소식", trigger: "none",
      commands: [{ ...greeting, speaker: event.name }],
    }];
    expect(() => runPrimitive(project, target, "npc.rename", { name: "한스" })).toThrow(/화자로 쓰는 대사/u);
    expect(event.name).toBe("찻집 주인");
  });

  it("자료집의 이름 기반 호감 변수가 인물과 끊어지는 이름 변경은 거절한다", () => {
    const { project, target, event } = blank();
    event.characterId = "tea_owner";
    project.variables = [{ id: "var_tea_affection", name: "찻집 주인 호감도" }];
    expect(affectionVariableOwner(project, "var_tea_affection")).toBe(event.characterId);
    expect(() => runPrimitive(project, target, "npc.rename", { name: "한스" })).toThrow(/호감 변수가 가리키는 인물/u);
    expect(event.name).toBe("찻집 주인");
  });

  it("목표가 인물을 이름으로 가리키면 거절하고, ID로 가리키면 이름만 바꾼다", () => {
    const { project, target, event, map } = blank();
    const other = map.events[1]!;
    const objective: Command = { kind: "m2Command", commandId: "m2-214-ui-command", fields: {
      surface: "objectiveChip", message: "「찻집 주인」과 대화하기",
    } };
    const renameWithObjective = (fields: typeof objective.fields, current = project) => {
      const scenario = withPageCommands(current, map.id, other, 0, list => [...list, { ...objective, fields }]);
      return runPrimitive(scenario, target, "npc.rename", { name: "한스" });
    };
    expect(() => renameWithObjective(objective.fields)).toThrow(/이 이름으로 인물을 찾는 목표/u);
    const directed = { ...objective.fields, targetMapId: map.id };
    expect(() => renameWithObjective({ ...directed, targetEventId: other.id })).toThrow(/이 이름으로 인물을 찾는 목표/u);
    const { after } = renameWithObjective({ ...directed, targetEventId: event.id });
    expect(after.maps[map.id]!.events[0]).toEqual({ ...event, name: "한스" });
    expect(after.maps[map.id]!.events[1]!.pages![0]!.commands).toEqual([
      ...other.pages![0]!.commands, { ...objective, fields: { ...directed, targetEventId: event.id } },
    ]);
    const shortName = projectWithEventRevision(project, map.id, event.id, { ...event, name: "봄" });
    expect(() => renameWithObjective({ ...directed, message: "이야기하기 (봄: 찻집 앞)" }, shortName))
      .toThrow(/이 이름으로 인물을 찾는 목표/u);
  });

  it("새 이름이 다른 인물을 가리키는 목표와 같으면 이름 변경을 거절한다", () => {
    const { project, target, event, map } = blank();
    const other = map.events[1]!;
    other.name = "이르마";
    const message = "「이르마」와 대화하기";
    other.pages![0]!.commands.push({ kind: "m2Command", commandId: "m2-214-ui-command", fields: { surface: "objectiveChip", message } });
    const session = startSession(project, 1);
    const ids = (current: typeof map) => objectiveTargetViews(project, current, runtimeEventViewsForMap(project, current, session, {}), message)
      .map(view => view.event.id);
    expect(ids(map)).toEqual([other.id]);
    expect(ids({ ...map, events: [{ ...event, name: "이르마" }, other] })).toEqual([event.id, other.id]);
    expect(() => runPrimitive(project, target, "npc.rename", { name: "이르마" })).toThrow(/이 이름으로 인물을 찾는 목표/u);
  });

  it("ID 대상의 빈 페이지가 열리면 이름으로 찾는 목표를 보호한다", () => {
    const { project, target, event, map } = blank();
    const message = "「찻집 주인」과 대화하기";
    const aimed = { mapId: map.id, eventId: event.id };
    map.events[1]!.pages![0]!.commands.push({ kind: "m2Command", commandId: "m2-214-ui-command", fields: {
      surface: "objectiveChip", message, targetMapId: map.id, targetEventId: event.id,
    } });
    event.pages![1]!.commands = [];
    event.pages![1]!.conditions = [{ kind: "selfSwitch", key: "A", value: true }];
    const session = startSession(project, 1);
    session.selfSwitches = { [event.id]: { A: true } };
    const ids = (current: typeof map) => objectiveTargetViews(project, current, runtimeEventViewsForMap(project, current, session, {}), message, { target: aimed })
      .map(view => view.event.id);
    expect(ids(map)).toEqual([event.id]);
    expect(ids({ ...map, events: [{ ...event, name: "한스" }, map.events[1]!] })).toEqual([]);
    expect(() => runPrimitive(project, target, "npc.rename", { name: "한스" })).toThrow(/이 이름으로 인물을 찾는 목표/u);
  });

  it("안정된 ID 대상도 이름 바꾸기로 현재 맵의 목표 문구가 달라지면 보호한다", () => {
    const { project, target, event, map } = blank();
    const name = `${map.name} 입구`;
    map.events[1]!.pages![0]!.commands.push({ kind: "m2Command", commandId: "m2-214-ui-command", fields: {
      surface: "objectiveChip", message: `차 사기 (${name}: 찻집 앞)`, targetMapId: map.id, targetEventId: event.id,
    } });
    expect(() => runPrimitive(project, target, "npc.rename", { name })).toThrow(/이 이름으로 인물을 찾는 목표/u);
  });

  it("새 이름이 기존 대사의 화자 추론을 바꾸면 이름 변경을 거절한다", () => {
    const { project, target, map, event } = blank();
    const other = map.events[1]!;
    other.name = "이르마";
    const line = { ...greeting, speaker: "이르마" };
    const rename = (current: Project) => runPrimitive(current, target, "npc.rename", { name: "이르마" });
    const withSpeaker = (command: Command) => withPageCommands(project, map.id, other, 0, list => [...list, command]);
    expect(() => rename(withSpeaker(line))).toThrow(/화자로 쓰는 대사/u);

    const linkedSpeaker = withSpeaker({ ...line, speakerActor: other.id });
    const { after } = rename(linkedSpeaker);
    expect(after.maps[map.id]!.events[0]).toEqual({ ...event, name: "이르마" });
    expect(after.maps[map.id]!.events[1]).toBe(linkedSpeaker.maps[map.id]!.events[1]);

    const advanced = withSpeaker({ kind: "m2Command", commandId: "m2-209-advanced-dialogue", fields: { speaker: line.speaker, body: line.body } });
    expect(() => rename(advanced)).toThrow(/화자로 쓰는 대사/u);
  });

  it.each(["이벤트", "공용 이벤트"])("%s의 호출에서 다른 인물의 첫 대화 기록을 쓰지 않는다", owner => {
    const { project, target, map, event } = blank();
    event.pages!.pop();
    const call: Command = { kind: "callMapEvent", eventId };
    if (owner === "이벤트") map.events[1]!.pages![0]!.commands = [call];
    else project.commonEvents = [{ id: "common_calls_npc", name: "대사 호출", trigger: "none", commands: [call] }];
    expect(() => runPrimitive(project, target, "dialogue.firstTimeOnly", { path: [0] })).toThrow(/다른 곳에서 이 이벤트를 호출/u);
    expect(event.pages![0]!.commands).toEqual(commands);
  });

  it("변수로 고르는 적 그룹이 쓰는 셀프 스위치도 건너뛴다", () => {
    const battle: Command = {
      kind: "battleProcessing", troopId: "troop_fixed", troopSource: "variable", troopVariableId: "var_troop",
      canEscape: false, canLose: false,
    };
    const { project, target, map } = blank([greeting, battle]);
    project.database = { ...project.database, troops: [{
      id: "troop_dynamic", name: "동굴의 적", enemyIds: [], autoAlign: true,
      battleEventPages: [{
        id: "battle_page", name: "전투 상태", conditions: [], span: "battle",
        commands: [{ kind: "setSelfSwitch", key: "A", value: false }],
      }],
    }] };
    const { after } = runPrimitive(project, target, "dialogue.firstTimeOnly", { path: [0] });
    expect(after.maps[map.id]!.events[0]!.pages![0]!.commands[0]).toMatchObject({ condition: { key: "B" } });
  });

  it("일정표 활동의 공용 이벤트가 쓰는 셀프 스위치를 건너뛴다", () => {
    const { project, target, map } = blank([greeting, { kind: "runSchedule", scheduleId: "schedule_tea" }]);
    project.commonEvents = [{
      id: "common_serve_tea", name: "차 내기", trigger: "none",
      commands: [{ kind: "setSelfSwitch", key: "A", value: false }],
    }];
    project.database = { ...project.database, schedules: [{
      id: "schedule_tea", title: "찻집 일정", slots: [{ label: "오전" }],
      activities: [{ id: "serve_tea", label: "차 내기", description: "", commonEventId: "common_serve_tea" }],
    }] };
    const { after } = runPrimitive(project, target, "dialogue.firstTimeOnly", { path: [0] });
    const session = startSession(after, 1);
    session.schedulePlans = { schedule_tea: ["serve_tea"] };
    const edited = after.maps[map.id]!.events[0]!.pages![0]!.commands;
    const talk = () => createInterpreter(edited, session, after, { currentEventId: eventId });
    const first = talk();
    expect(first.start()).toMatchObject({ kind: "text", body: greeting.body });
    expect(first.resume(undefined)).toEqual({ kind: "done" });
    expect(talk().start()).toEqual({ kind: "done" });
    expect(session.selfSwitches[eventId]).toEqual({ A: false, B: true });
  });

  it("다른 이벤트의 스크립트가 계산한 ID로 셀프 스위치를 바꿀 수 있으면 거절한다", () => {
    const { project, target, map } = blank();
    const source = `game.setSelfSwitch("A", false, "ev_" + "dialogue_test");`;
    map.events[1]!.pages![0]!.commands = [{
      kind: "script", source, compiled: source, effects: { reads: [], writes: [], calls: [], dynamic: [] },
    }];
    expect(() => runPrimitive(project, target, "dialogue.firstTimeOnly", { path: [0] })).toThrow(/스크립트.*셀프 스위치/u);
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
    const occupied = withPageCommands(project, map.id, event, 1, list => [...list, { kind: "setSelfSwitch", key: "D", value: false }]);
    expect(() => runPrimitive(occupied, target, "dialogue.firstTimeOnly", { path: [0] })).toThrow(/비어 있는 셀프 스위치/u);
  });

  it("대사를 건너뛰는 병렬 실행 페이지에는 첫 대화 기록을 만들지 않는다", () => {
    const { project, target, event } = blank([greeting]);
    event.pages![0]!.trigger = { kind: "parallel" };
    expect(() => runPrimitive(project, target, "dialogue.firstTimeOnly", { path: [0] })).toThrow(/병렬 실행 페이지/u);
    expect(event.pages![0]!.commands).toEqual([greeting]);
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
    // The editor normalizes loaded projects before the primitive freezes its baseline.
    ensureSwitchVariableSlots(project);
    removeLegacySpriteReferences(project);
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
