/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { CHOICE_CANCEL_BRANCH_INDEX, FORK_ELSE_BRANCH_INDEX, FORK_THEN_BRANCH_INDEX, LOOP_BODY_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { runSmallTaskPrimitiveTool } from "@/editor/tools/smallTaskPrimitiveTools";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/02-cmd-flow";
import { mapTarget } from "@/editor/smallTask/target";
import { createInterpreter } from "@/player/interpreter";
import { CUTSCENE_END_LABEL, isCutsceneInputLocked, isCutsceneSkippable } from "@/player/cutsceneControl";
import { fastForwardAction } from "@/player/cutsceneFastForward";
import { preloadScriptEngine } from "@/player/script/engine";
import { createBlankProject } from "@/project/defaults/blankProject";
import { eventCommandHash } from "@/project/eventCommands/singleCommandOps";
import { endRoguelikeRun, startRoguelikeRun } from "@/project/roguelikeRun";
import { scriptSourceHash } from "@/project/script/types";
import { startSession } from "@/project/session";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { expectKoreanSentence, expectUndoRestores, loadFixture } from "./harness";

type FixtureName = "blank" | "built" | "maou";
type Args = Record<string, unknown>;

const fixtureMap = "flow-map";
const fixtureEvent = "flow-event";
const fixturePage = "flow-page";
const neighborPage = "neighbor-page";
const branchPath = [0, LOOP_BODY_BRANCH_INDEX];
function setup(commands: Command[], name: FixtureName = "blank") {
  const fixture = loadFixture(name);
  const sourceMap = fixture.maps[fixture.startMapId] ?? createBlankProject().maps.map_blank_start!;
  const page: EventPage = {
    id: fixturePage, name: "흐름", conditions: [], trigger: { kind: "action" }, priority: "same",
    graphic: {}, movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
  };
  const event: GameEvent = {
    id: fixtureEvent, name: "이야기", x: 2, y: 2, trigger: page.trigger, commands: [],
    pages: [page, { ...page, id: neighborPage, name: "이웃 페이지", commands: [] }],
  };
  const map = {
    ...sourceMap, id: fixtureMap, events: [
      event,
      { ...event, id: "callee-1", name: "문지기", pages: undefined, commands: [{ kind: "changeGold", op: "+=", amount: 3 } as const] },
      { ...event, id: "callee-2", name: "상인", pages: undefined, commands: [] },
    ],
  };
  const project = {
    ...fixture, maps: { ...fixture.maps, [map.id]: map }, startMapId: map.id,
    switches: [...fixture.switches, { id: "flow-sw", name: "문 잠금" }],
    variables: [...fixture.variables, { id: "flow-var", name: "기다릴 시간" }],
    commonEvents: [
      ...fixture.commonEvents,
      { id: "common-1", name: "여관 회복", trigger: "none" as const, commands: [{ kind: "changeGold", op: "+=", amount: 5 } as const] },
      { id: "common-2", name: "아침 준비", trigger: "none" as const, commands: [] },
    ],
  };
  const target = mapTarget(project, map.id, event.id, page.id)!;
  return { project, target };
}

function stored(project: Project): Command[] {
  return project.maps[fixtureMap]!.events[0]!.pages![0]!.commands;
}

const branch: Command = { kind: "fork", condition: { kind: "switch", switchId: "flow-sw", value: true }, then: [], else: [] };
const wait: Command = { kind: "wait", ms: 500 };
const label: Command = { kind: "label", name: "출발" };
const jump: Command = { kind: "gotoLabel", name: "출발" };
const loop: Command = { kind: "loop", body: [] };
const exit: Command = { kind: "breakLoop" };
const common: Command = { kind: "callCommonEvent", commonEventId: "common-1" };
const call: Command = { kind: "callMapEvent", eventId: "callee-1" };
const cutscene: Command = { kind: "cutsceneControl", mode: "begin", skippable: false };
const source = "const steps: number = 3;\ngame.addGold(steps);";

type Case = {
  id: string;
  fixture?: FixtureName;
  initial?: Command[];
  args: Args;
  expected: Command[];
};

const preserve = { ...branch, then: [{ kind: "text", body: "문이 잠겼다" } as const] };
const evening = { kind: "timePhase", phase: "evening" } as const;
const script: Command = { kind: "script", source, compiled: "기존 저장본", name: "걸음 수" };
const compiled: Command = {
  kind: "script", source, compiled: "const steps = 3;\ngame.addGold(steps);\n",
  sourceHash: scriptSourceHash(source), apiVersion: 1, name: "세 걸음",
  effects: { reads: [], writes: [], calls: [], dynamic: [] }, summary: "돈",
};

const cases: Case[] = [
  { id: "fork.insert", fixture: "built", args: { condition: branch.condition }, expected: [branch] },
  { id: "fork.update", initial: [preserve], args: { condition: evening }, expected: [{ ...preserve, condition: evening }] },
  { id: "wait.insert", args: {}, expected: [wait] },
  { id: "wait.update", fixture: "maou", initial: [{ ...wait, variableId: "flow-var" }], args: { ms: 1234 }, expected: [{ kind: "wait", ms: 1234 }] },
  { id: "label.insert", args: { name: "출발" }, expected: [label] },
  { id: "label.update", initial: [label], args: { name: "도착" }, expected: [{ ...label, name: "도착" }] },
  { id: "gotoLabel.insert", initial: [label], args: { name: "출발" }, expected: [jump, label] },
  { id: "gotoLabel.update", initial: [jump, label, { ...label, name: "도착" }], args: { name: "도착" },
    expected: [{ ...jump, name: "도착" }, label, { ...label, name: "도착" }] },
  { id: "loop.insert", args: {}, expected: [loop] },
  { id: "loop.update", initial: [{ ...loop, body: [exit] }], args: {}, expected: [{ ...loop, body: [exit] }] },
  { id: "breakLoop.insert", initial: [loop], args: { branchPath }, expected: [{ ...loop, body: [exit] }] },
  { id: "breakLoop.update", initial: [{ ...loop, body: [exit] }], args: { branchPath }, expected: [{ ...loop, body: [exit] }] },
  { id: "callCommonEvent.insert", args: { commonEventId: "common-1" }, expected: [common] },
  { id: "callCommonEvent.update", initial: [common], args: { commonEventId: "common-2" }, expected: [{ ...common, commonEventId: "common-2" }] },
  { id: "callMapEvent.insert", args: { eventId: "callee-1" }, expected: [call] },
  { id: "callMapEvent.update", initial: [call], args: { eventId: "callee-2" }, expected: [{ ...call, eventId: "callee-2" }] },
  { id: "cutsceneControl.insert", args: {}, expected: [cutscene] },
  { id: "cutsceneControl.update", initial: [{ ...cutscene, skippable: true }], args: { mode: "end" }, expected: [{ kind: "cutsceneControl", mode: "end" }] },
  { id: "script.insert", args: { source, name: "세 걸음" }, expected: [compiled] },
  { id: "script.update", initial: [script], args: { name: "세 걸음" }, expected: [{ ...script, name: "세 걸음" }] },
];

describe("흐름 제어 명령", () => {
  it.each(cases)("$id 저장·범위·요약·되돌리기", async ({ id, initial = [], args, expected, fixture }) => {
    const { project, target } = setup(initial, fixture);
    const primitive = PRIMITIVES.find(row => row.id === `cmd.${id}`)!;
    const coreArgs: Args = { index: 0, ...args };
    if (id.endsWith(".update")) {
      const row = args.branchPath ? exit : initial[0]!;
      coreArgs.expectedHash = eventCommandHash(row);
    }
    const result = runPrimitive(project, target, primitive.id, coreArgs);
    expect(jsonEqual(stored(result.after), expected)).toBe(true);
    expect(stored(project)).toEqual(initial);
    expectKoreanSentence(result.sentence, target);
    expect(result.sentence).toMatch(/\.$/u);
    expect(result.sentence).not.toMatch(/[{}]|cmd\.|flow-|callee-|common-/u);
    const scope = primitive.scope({ project, target }, { ...coreArgs, pageId: neighborPage });
    const map = result.after.maps[fixtureMap]!;
    const [event, ...otherEvents] = map.events;
    const [selected, neighbor] = event!.pages!;
    const events = [{ ...event!, pages: [selected!, { ...neighbor!, commands: [wait] }] }, ...otherEvents];
    const outside = { ...result.after, maps: { ...result.after.maps, [map.id]: { ...map, events } } };
    expect(checkSmallTaskScope(project, outside, scope)).toMatchObject({ ok: false, reason: expect.stringContaining("범위 밖") });
    expect(() => runPrimitive(project, target, primitive.id, { ...coreArgs, branchPath: [999, LOOP_BODY_BRANCH_INDEX] })).toThrow(/범위 밖/u);
    if (jsonEqual(project, result.after)) {
      expect(id).toMatch(/^(?:loop|breakLoop)\.update$/u);
    }
    await expectUndoRestores(project, result.after, target);
  }, 300_000); // Building the Maou fixture can be slow on a shared runner.

  it.each([
    ["fork.insert", { condition: { kind: "all", conditions: [{ kind: "item", itemId: "missing", present: true }] } }, /아이템/u],
    ["fork.insert", { condition: { kind: "not", condition: { kind: "switch", switchId: "missing", value: true } } }, /스위치/u],
    ["fork.insert", { condition: { kind: "switch", switchId: "flow-sw" } }, /형식/u],
    ["fork.insert", { condition: { kind: "eventSeesPlayer", eventId: "", watchers: { name: " " } } }, /지켜볼 이벤트/u],
    ["fork.insert", { condition: { kind: "eventSeesPlayer", eventId: "", watchers: { characterId: "missing" } } }, /연결된 이벤트/u],
    ["fork.insert", { condition: { kind: "eventSeesPlayer", eventId: "callee-1", range: -1 } }, /0칸 이상/u],
    ["fork.insert", { condition: { kind: "eventSeesPlayer", eventId: "callee-1", darkness: { darkAmbient: 1.1 } } }, /0부터 1/u],
    ["fork.insert", { condition: { kind: "stringVariable", stringVariableId: " ", op: "==", value: "" } }, /문자열 변수/u],
    ["fork.insert", { condition: { kind: "weekday", weekdays: [] } }, /요일을 하나 이상/u],
    ["fork.insert", { condition: { kind: "npcActivity", activity: " " } }, /활동 이름/u],
    ["fork.insert", { condition: { kind: "run", query: "flag", flag: " ", value: true } }, /진행 표시/u],
    ["fork.insert", { condition: { kind: "run", query: "floor", op: ">=", value: 10_000 } }, /비교할 층/u],
    ["fork.insert", { condition: { kind: "run", query: "result", result: "victory" } }, /형식/u],
    ["fork.insert", { condition: { kind: "battleResult", result: "completed" } }, /형식/u],
    ["fork.insert", { condition: { kind: "gold", op: "contains", amount: 2 } }, /비교 방법/u],
    ["fork.insert", { condition: { kind: "gold", op: ">=", amount: -1 } }, /비교할 소지금/u],
    ["fork.insert", { condition: { kind: "not", condition: { kind: "timer", timerId: "timer1", seconds: -1 } } }, /비교할 타이머 시간/u],
    ["fork.insert", { condition: { kind: "friendshipAtLeast", value: 1001 } }, /비교할 호감도/u],
    ["wait.insert", { variableId: "missing" }, /변수/u],
    ["wait.insert", { ms: 2 ** 31 }, /형식/u],
    ["wait.insert", { ms: -1 }, /형식/u],
    ["callCommonEvent.insert", { commonEventId: "missing" }, /공용 이벤트/u],
    ["callMapEvent.insert", { eventId: "missing" }, /맵의 이벤트/u],
    ["gotoLabel.insert", { name: "없는 위치" }, /위치 표시가 없습니다/u],
    ["breakLoop.insert", {}, /반복 안/u],
    ["script.insert", { source: "const x = ;" }, /문법/u],
    ["script.insert", { source: 'game.hasItem("missing");' }, /연결할 대상/u],
    ["script.insert", { source: 'await game.playSe("missing");' }, /소리 자료/u],
    ["script.insert", { source: 'export { reward } from "@lib/missing";' }, /라이브러리/u],
    ["script.insert", { source: 'await import("@lib/missing");' }, /라이브러리/u],
    ["script.insert", { source: 'game.adGold(3);' }, /게임 기능/u],
    ["script.insert", { source: 'game["adGold"](3);' }, /게임 기능/u],
    ["script.insert", { source: 'globalThis["game"]["hasItem"]("missing");' }, /연결할 대상/u],
    ["script.insert", { source: 'await game.callCommonEvent();' }, /항목을 지정/u],
    ["script.insert", { source: 'await game.callCommonEvent(123);' }, /1번째 인자 형식/u],
    ["script.insert", { source: 'globalThis["game"]["addGold"]("3");' }, /1번째 인자 형식/u],
    ["script.insert", { source: 'game.setSwitch("flow-sw", 1);' }, /2번째 인자 형식/u],
  ] as const)("%s 잘못된 값 거절", (id, args, message) => {
    const { project, target } = setup([]);
    expect(() => runPrimitive(project, target, `cmd.${id}`, { index: 0, ...args })).toThrow(message);
    expect(stored(project)).toEqual([]);
  });

  it("기존 이동 목적지를 없애는 위치 표시 변경을 거절한다", () => {
    const { project, target } = setup([jump, label]);
    expect(() => runPrimitive(project, target, "cmd.label.update", {
      index: 1, expectedHash: eventCommandHash(label), name: "도착",
    })).toThrow(/이동하는 명령이 남아/u);
  });

  it("가리키던 위치 표시를 바꾸면 같은 이름의 레거시 줄이 남아 있어도 거절한다", () => {
    const { project, target } = setup([jump, label, wait, label]);
    expect(() => runPrimitive(project, target, "cmd.label.update", {
      index: 1, expectedHash: eventCommandHash(label), name: "도착",
    })).toThrow(/이동하는 명령/u);
  });

  it("분기 안에 새 위치 표시를 만들어 상위 목록으로 가던 이동을 가로채지 않는다", () => {
    const { project, target } = setup([label, { ...branch, then: [jump] }]);
    expect(() => runPrimitive(project, target, "cmd.label.insert", {
      index: 0, branchPath: [1, FORK_THEN_BRANCH_INDEX], name: label.name,
    })).toThrow(/목적지가 바뀝니다/u);
  });

  it("호출된 페이지에 위치 표시를 추가해 호출자 쪽의 기존 이동을 가로채지 않는다", () => {
    const { project, target } = setup([jump]);
    project.maps[fixtureMap]!.events[0]!.pages![1]!.conditions = [branch.condition];
    const caller = project.maps[fixtureMap]!.events[1]!;
    caller.commands = [{ ...call, eventId: fixtureEvent }, wait, label, { ...wait, ms: 200 }];
    expect(createInterpreter(caller.commands, startSession(project), project).start()).toEqual({ kind: "wait", ms: 200 });
    expect(() => runPrimitive(project, target, "cmd.label.insert", { index: 1, name: label.name })).toThrow(/목적지가 바뀝니다/u);
    expect(stored(project)).toEqual([jump]);
  });

  it("호출 관계가 없는 이벤트의 같은 이름으로 끊긴 이동을 복구할 수 있다", () => {
    const { project, target } = setup([jump]);
    project.maps[fixtureMap]!.events[1]!.commands = [label];
    const { after } = runPrimitive(project, target, "cmd.label.insert", { index: 1, name: label.name });
    expect(stored(after)).toEqual([jump, label]);
  });

  it("호출 뒤에 나오는 맵 이동은 그 호출에 대한 목적지 근거가 되지 않는다", () => {
    const { project, target } = setup([jump]);
    const map = project.maps[fixtureMap]!;
    map.events[0]!.pages![1]!.conditions = [branch.condition];
    const caller: Command[] = [
      { kind: "callMapEvent", eventId: fixtureEvent }, { kind: "transfer", mapId: fixtureMap, x: 2, y: 2 }, label,
    ];
    project.maps.other = { ...map, id: "other", events: [{ ...map.events[1]!, commands: caller }] };
    project.commonEvents.find(event => event.id === "common-2")!.commands = [call];
    expect(() => runPrimitive(project, target, "cmd.gotoLabel.update", {
      index: 0, expectedHash: eventCommandHash(jump), name: label.name,
    })).toThrow(/위치 표시가 없습니다/u);
  });

  it("같은 목록에 중복을 만들지 않고 컷신의 건너뛰기 목적지를 보존한다", () => {
    const end: Command = { kind: "label", name: CUTSCENE_END_LABEL };
    const { project, target } = setup([{ ...cutscene, skippable: true }, label, end]);
    expect(() => runPrimitive(project, target, "cmd.label.insert", { index: 0, name: " 출발 " })).toThrow(/같은 이름/u);
    expect(() => runPrimitive(project, target, "cmd.label.update", {
      index: 2, expectedHash: eventCommandHash(end), name: "도착",
    })).toThrow(/컷신을 건너뛸 때/u);
  });

  it("호출된 맵 이벤트와 공용 이벤트가 호출자의 위치 표시로 이동하는 경우 이름 변경을 거절한다", () => {
    const { project, target } = setup([call, wait, label, { ...wait, ms: 200 }]);
    project.maps[fixtureMap]!.events[1]!.commands = [common];
    project.commonEvents.find(event => event.id === "common-1")!.commands = [jump];
    expect(createInterpreter(stored(project), startSession(project), project).start()).toEqual({ kind: "wait", ms: 200 });
    expect(() => runPrimitive(project, target, "cmd.label.update", {
      index: 2, expectedHash: eventCommandHash(label), name: "도착",
    })).toThrow(/이동하는 명령/u);
  });

  it("자식이 맵을 옮긴 뒤 새 맵의 이벤트가 사용하는 위치 표시를 보존한다", () => {
    const initial: Command[] = [common, call, wait, label, { ...wait, ms: 200 }];
    const { project, target } = setup(initial);
    const destinationMap = "destination";
    const origin = project.maps[fixtureMap]!;
    project.maps[destinationMap] = {
      ...origin, id: destinationMap, events: [{ ...origin.events[1]!, commands: [jump] }],
    };
    const mover = project.commonEvents.find(event => event.id === "common-1")!;
    mover.commands = [{ kind: "transfer", mapId: destinationMap, x: 2, y: 2 }];
    const entry: Command = { kind: "callMapEvent", eventId: fixtureEvent };
    project.commonEvents.find(event => event.id === "common-2")!.commands = [entry];
    origin.events[0]!.pages![1]!.conditions = [branch.condition];
    const session = startSession(project);
    const player = createInterpreter([entry], session, project, { continueAfterTransfer: true });
    expect(player.start()).toMatchObject({ kind: "transfer", mapId: destinationMap });
    session.currentMapId = destinationMap;
    expect(player.resume(undefined)).toEqual({ kind: "wait", ms: 200 });
    expect(() => runPrimitive(project, target, "cmd.label.update", {
      index: 3, expectedHash: eventCommandHash(label), name: "도착",
    })).toThrow(/이동하는 명령/u);
    expect(stored(project)).toEqual(initial);
  });

  it("다른 맵에서 이어진 호출의 위치 표시로 기존 이동 줄을 고칠 수 있다", async () => {
    const { project, target } = setup([jump]);
    const destination: Command = { kind: "label", name: "도착" };
    const caller: Command[] = [
      { kind: "transfer", mapId: fixtureMap, x: 2, y: 2 },
      { kind: "callMapEvent", eventId: fixtureEvent }, wait, label, { ...wait, ms: 200 }, destination, { ...wait, ms: 300 },
    ];
    const map = project.maps[fixtureMap]!;
    map.events[0]!.pages![1]!.conditions = [branch.condition];
    const otherMap = {
      ...map, id: "caller-map", events: [{ ...map.events[1]!, commands: caller }],
    };
    project.maps[otherMap.id] = otherMap;
    const entry: Command[] = [{ kind: "callMapEvent", eventId: otherMap.events[0]!.id }];
    project.commonEvents.find(event => event.id === "common-2")!.commands = entry;
    expect(() => runPrimitive(project, target, "cmd.label.insert", { index: 1, name: label.name }))
      .toThrow(/목적지가 바뀝니다/u);
    const args = { index: 0, expectedHash: eventCommandHash(jump), name: destination.name };
    const { after } = runPrimitive(project, target, "cmd.gotoLabel.update", args);
    const session = startSession(after);
    session.currentMapId = otherMap.id;
    const player = createInterpreter(entry, session, after, { continueAfterTransfer: true });
    expect(player.start()).toMatchObject({ kind: "transfer", mapId: fixtureMap });
    session.currentMapId = fixtureMap;
    expect(player.resume(undefined)).toEqual({ kind: "wait", ms: 300 });
    expect(stored(project)).toEqual([jump]);
    expect(after.maps[otherMap.id]).toBe(otherMap);
    await expectUndoRestores(project, after, target);
  });

  it("맵 이동 없이 다른 맵에서 같은 이벤트 ID를 부르는 명령은 호출자로 취급하지 않는다", () => {
    const { project, target } = setup([jump]);
    const map = project.maps[fixtureMap]!;
    map.events[0]!.pages![1]!.conditions = [branch.condition];
    const lookalike = { ...map.events[0]!, pages: undefined, commands: [wait] };
    const caller = { ...map.events[1]!, commands: [{ kind: "callMapEvent", eventId: fixtureEvent }, label] as Command[] };
    project.maps.other = { ...map, id: "other", events: [lookalike, caller] };
    expect(() => runPrimitive(project, target, "cmd.gotoLabel.update", {
      index: 0, expectedHash: eventCommandHash(jump), name: label.name,
    })).toThrow(/위치 표시가 없습니다/u);
    const { after } = runPrimitive(project, target, "cmd.label.insert", { index: 1, name: label.name });
    expect(stored(after)).toEqual([jump, label]);
  });

  it("호출된 이벤트에 자체 목적지가 있거나 참조가 다른 페이지에만 있으면 이름을 바꿀 수 있다", () => {
    const { project, target } = setup([common, label]);
    project.commonEvents.find(event => event.id === "common-1")!.commands = [call, label, jump];
    project.maps[fixtureMap]!.events[1]!.commands = [jump];
    const event = project.maps[fixtureMap]!.events[0]!;
    event.pages![1]!.commands = [jump];
    const { after } = runPrimitive(project, target, "cmd.label.update", {
      index: 1, expectedHash: eventCommandHash(label), name: "도착",
    });
    expect(stored(after)).toEqual([common, { ...label, name: "도착" }]);
    expect(after.commonEvents).toBe(project.commonEvents);
    expect(after.maps[fixtureMap]!.events[0]!.pages![1]).toBe(event.pages![1]);
  });

  it("자료집 일정에서 실행되는 공용 이벤트의 이동 목적지를 보존한다", () => {
    const { project, target } = setup([{ kind: "runSchedule", scheduleId: "flow-schedule" }, label]);
    project.database = { ...project.database, schedules: [{
      id: "flow-schedule", title: "일과", slots: [{ label: "아침" }],
      activities: [{ id: "training", label: "훈련", description: "", commonEventId: "common-1" }],
    }] };
    project.commonEvents.find(event => event.id === "common-1")!.commands = [jump];
    expect(() => runPrimitive(project, target, "cmd.label.update", {
      index: 1, expectedHash: eventCommandHash(label), name: "도착",
    })).toThrow(/이동하는 명령/u);
  });

  it.each(['game.cmd', 'globalThis["game"]["cmd"]'])("재귀 호출과 %s가 실행하는 이동의 목적지를 보존한다", api => {
    const dispatch = `await ${api}({ kind: "gotoLabel", name: "출발" });`;
    const { project, target } = setup([common, { kind: "script", source: dispatch, compiled: dispatch }, label]);
    project.commonEvents.find(event => event.id === "common-1")!.commands = [common];
    expect(() => runPrimitive(project, target, "cmd.label.update", {
      index: 2, expectedHash: eventCommandHash(label), name: "도착",
    })).toThrow(/스크립트가 이 위치/u);
  });

  it("탐험 결과 조건을 저장하고 해당 결과에서만 실행한다", () => {
    const { project, target } = setup([{ ...branch, then: [wait] }]);
    const condition = { kind: "run", query: "result", result: "completed" } as const;
    const { after } = runPrimitive(project, target, "cmd.fork.update", {
      index: 0, expectedHash: eventCommandHash(stored(project)[0]!), condition,
    });
    expect(stored(after)).toEqual([{ ...branch, then: [wait], condition }]);
    const session = startSession(after);
    startRoguelikeRun(session, { seed: 123 });
    expect(createInterpreter(stored(after), session, after).start()).toEqual({ kind: "done" });
    expect(endRoguelikeRun(session, "completed")).toBe(true);
    expect(createInterpreter(stored(after), session, after).start()).toEqual({ kind: "wait", ms: 500 });
  });

  it("작은 일 도구가 중첩된 명령의 오래된 해시, 잘못된 갈래와 다른 페이지 지정 인수를 거절한다", async () => {
    const initial: Command[] = [{ ...loop, body: [{ ...branch, then: [wait], else: [{ ...wait, ms: 250 }] }] }];
    const { project, target } = setup(initial);
    const ctx = { project, smallTaskTarget: target } as Parameters<typeof runSmallTaskPrimitiveTool>[0];
    const args = { index: 0, branchPath: [0, LOOP_BODY_BRANCH_INDEX, 0, FORK_THEN_BRANCH_INDEX], ms: 900 };
    const apply = (fields: Args) => runSmallTaskPrimitiveTool(ctx, "apply_small_task_primitive", {
      id: "cmd.wait.update", args: { ...args, ...fields },
    });
    const expectedHash = eventCommandHash(wait);
    await expect(apply({ expectedHash: "오래된 해시" })).rejects.toThrow(/다시 읽은 뒤/u);
    await expect(apply({ expectedHash, branchPath: [...args.branchPath.slice(0, -1), FORK_ELSE_BRANCH_INDEX] })).rejects.toThrow(/다시 읽은 뒤/u);
    await expect(apply({ expectedHash, branchPath: [0, LOOP_BODY_BRANCH_INDEX, 0] })).rejects.toThrow(/분기 위치/u);
    await expect(apply({ expectedHash, index: 1 })).rejects.toThrow(/줄 위치/u);
    await expect(apply({ expectedHash, pageId: neighborPage })).rejects.toThrow(/형식/u);
    expect(ctx.project).toBe(project);
    await expect(apply({ expectedHash })).resolves.toMatchObject({ ok: true });
    expect(stored(ctx.project)).toEqual([{ ...loop, body: [{ ...branch, then: [{ ...wait, ms: 900 }], else: [{ ...wait, ms: 250 }] }] }]);
  });

  it.each(["contains", "empty"] as const)("문자열 비교 %s를 바깥 조건으로도 저장하고 실행한다", op => {
    const { project, target } = setup([{ ...branch, then: [wait] }]);
    const condition = { kind: "stringVariable", stringVariableId: "password", op, value: "달" } as const;
    const { after } = runPrimitive(project, target, "cmd.fork.update", {
      index: 0, expectedHash: eventCommandHash(stored(project)[0]!), condition,
    });
    expect(stored(after)).toEqual([{ ...branch, then: [wait], condition }]);
    const session = startSession(after);
    session.stringVariables = { password: op === "empty" ? "" : "달빛" };
    expect(createInterpreter(stored(after), session, after).start()).toEqual({ kind: "wait", ms: 500 });
  });

  it("다른 분기에 숨은 위치 표시로 이동할 수 없다", () => {
    const { project, target } = setup([{ ...branch, then: [label] }]);
    expect(() => runPrimitive(project, target, "cmd.gotoLabel.insert", {
      index: 0, branchPath: [0, FORK_ELSE_BRANCH_INDEX], name: label.name,
    })).toThrow(/위치 표시가 없습니다/u);
  });

  it("분기 안에서 시간을 읽고 기다린다", () => {
    const { project, target } = setup([{ ...branch, then: [{ kind: "text", body: "열렸어요." }] }]);
    const { after } = runPrimitive(project, target, "cmd.wait.insert", {
      index: 0, branchPath: [0, FORK_ELSE_BRANCH_INDEX], variableId: "flow-var",
    });
    const session = startSession(after);
    session.variables["flow-var"] = 750;
    session.switches["flow-sw"] = false;
    const player = createInterpreter(stored(after), session, after);
    expect(player.start()).toEqual({ kind: "wait", ms: 750 });
    expect(player.resume()).toEqual({ kind: "done" });
  });

  it.each([
    { command: { kind: "fork", condition: branch.condition, then: [] }, slot: FORK_ELSE_BRANCH_INDEX, field: "else" },
    { command: { kind: "choices", options: [{ text: "계속", branch: [] }], cancelBehavior: "branch" }, slot: CHOICE_CANCEL_BRANCH_INDEX, field: "cancelBranch" },
  ] as const)("미생성 $field 분기의 첫 줄을 넣고 되돌린다", async ({ command, slot, field }) => {
    const initial = structuredClone(command) as Command;
    const { project, target } = setup([initial]);
    const args = { index: 0, branchPath: [0, slot], ms: 750 };
    expect(() => runPrimitive(project, target, "cmd.wait.insert", { ...args, index: 1 })).toThrow(/줄 위치/u);
    expect(() => runPrimitive(project, target, "cmd.wait.update", { ...args, expectedHash: eventCommandHash(wait) })).toThrow(/분기/u);
    const { after } = runPrimitive(project, target, "cmd.wait.insert", args);
    expect(stored(after)).toEqual([{ ...initial, [field]: [{ ...wait, ms: 750 }] }]);
    expect(stored(project)[0]).not.toHaveProperty(field);
    const session = startSession(after);
    const player = createInterpreter(stored(after), session, after);
    const first = player.start();
    expect(initial.kind === "choices" ? player.resume(-1) : first).toEqual({ kind: "wait", ms: 750 });
    await expectUndoRestores(project, after, target);
  });

  it("변수 대기를 고정 대기로 바꿀 때 저장돼 있던 범위 밖 시간을 쓰지 않는다", () => {
    const legacy: Command = { kind: "wait", ms: 2 ** 31, variableId: "flow-var" };
    const { project, target } = setup([legacy]);
    const args = { index: 0, expectedHash: eventCommandHash(legacy), variableId: null };
    expect(() => runPrimitive(project, target, "cmd.wait.update", args)).toThrow(/대기 시간이 너무 깁니다/u);
    const { after } = runPrimitive(project, target, "cmd.wait.update", { ...args, ms: 2 ** 31 - 1 });
    expect(stored(after)[0]).toEqual({ kind: "wait", ms: 2 ** 31 - 1 });
  });

  it("반복을 한 번 실행한 뒤 새 탈출 줄을 지나 다음 명령을 실행한다", () => {
    const { project, target } = setup([{ ...loop, body: [{ kind: "changeGold", op: "+=", amount: 3 }] }, wait]);
    const { after } = runPrimitive(project, target, "cmd.breakLoop.insert", { index: 1, branchPath });
    const session = startSession(after);
    const beforeGold = session.gold;
    expect(createInterpreter(stored(after), session, after).start()).toEqual({ kind: "wait", ms: 500 });
    expect(session.gold - beforeGold).toBe(3);
  });

  it("공용 이벤트와 현재 맵 이벤트가 이어서 실행된다", () => {
    const { project, target } = setup([]);
    const first = runPrimitive(project, target, "cmd.callCommonEvent.insert", { index: 0, commonEventId: "common-1" }).after;
    const second = runPrimitive(first, target, "cmd.callMapEvent.insert", { index: 1, eventId: "callee-1" }).after;
    const session = startSession(second);
    const beforeGold = session.gold;
    expect(createInterpreter(stored(second), session, second).start()).toEqual({ kind: "done" });
    expect(session.gold - beforeGold).toBe(8);
  });

  it("삽입한 게임 스크립트가 샌드박스에서 돈을 더한다", async () => {
    await preloadScriptEngine();
    const { project, target } = setup([]);
    const { after } = runPrimitive(project, target, "cmd.script.insert", { index: 0, source });
    const session = startSession(after);
    const beforeGold = session.gold;
    expect(createInterpreter(stored(after), session, after).start()).toEqual({ kind: "done" });
    expect(session.gold - beforeGold).toBe(3);
  });

  it("대괄호로 호출한 게임 기능의 실제 참조를 저장하고 재생한다", async () => {
    await preloadScriptEngine();
    const { project, target } = setup([]);
    const { after } = runPrimitive(project, target, "cmd.script.insert", {
      index: 0, source: 'await game["callCommonEvent"]("common-1");',
    });
    expect(stored(after)[0]).toMatchObject({ effects: { calls: [{ kind: "commonEvent", id: "common-1" }] } });
    const session = startSession(after);
    const beforeGold = session.gold;
    expect(createInterpreter(stored(after), session, after).start()).toEqual({ kind: "done" });
    expect(session.gold - beforeGold).toBe(5);
  });

  it("스크립트가 프로젝트 라이브러리의 함수를 가져와 재생한다", async () => {
    await preloadScriptEngine();
    const { project, target } = setup([]);
    project.scriptLibrary = [{
      id: "reward", source: "export const coins = () => 7;", compiled: "exports.coins = () => 7;",
    }];
    const { after } = runPrimitive(project, target, "cmd.script.insert", {
      index: 0, source: 'import { coins } from "@lib/reward";\ngame.addGold(coins());',
    });
    expect(stored(after)[0]).toMatchObject({ effects: { calls: [{ kind: "library", id: "reward" }] } });
    const session = startSession(after);
    const beforeGold = session.gold;
    expect(createInterpreter(stored(after), session, after).start()).toEqual({ kind: "done" });
    expect(session.gold - beforeGold).toBe(7);
  });

  it("새 컷신 명령이 빨리 감기 중 정산을 실행하고 종료 위치 표시에서 멈춘다", () => {
    const { project, target } = setup([wait, { kind: "changeGold", op: "+=", amount: 3 }, { ...wait, ms: 200 }]);
    const opened = runPrimitive(project, target, "cmd.cutsceneControl.insert", { index: 0, skippable: true }).after;
    const marked = runPrimitive(opened, target, "cmd.label.insert", { index: 3, name: CUTSCENE_END_LABEL }).after;
    const { after } = runPrimitive(marked, target, "cmd.cutsceneControl.insert", { index: 4, mode: "end" });
    const session = startSession(after);
    const beforeGold = session.gold;
    const player = createInterpreter(stored(after), session, after);
    const first = player.start();
    expect(first).toEqual({ kind: "wait", ms: 500 });
    expect(isCutsceneSkippable(session)).toBe(true);
    expect(player.beginFastForward(CUTSCENE_END_LABEL)).toBe(true);
    expect(first.kind !== "done" && fastForwardAction(first)).toBe("skip");
    expect(player.skip()).toEqual({ kind: "wait", ms: 200 });
    expect(player.isFastForwarding()).toBe(false);
    expect(isCutsceneInputLocked(session)).toBe(false);
    expect(session.gold - beforeGold).toBe(3);
  });

  it("위치 이동이 사이 명령을 건너뛴다", () => {
    const { project, target } = setup([wait, label, { kind: "wait", ms: 200 }]);
    const { after } = runPrimitive(project, target, "cmd.gotoLabel.insert", { index: 0, name: "출발" });
    expect(createInterpreter(stored(after), startSession(after), after).start()).toEqual({ kind: "wait", ms: 200 });
  });
});
