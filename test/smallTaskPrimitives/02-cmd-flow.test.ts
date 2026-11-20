/** @vitest-environment happy-dom */
import { beforeAll, describe, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { FORK_ELSE_BRANCH_INDEX, LOOP_BODY_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/02-cmd-flow";
import { mapTarget } from "@/editor/smallTask/target";
import { createInterpreter } from "@/player/interpreter";
import { preloadScriptEngine } from "@/player/script/engine";
import { createBlankProject } from "@/project/defaults/blankProject";
import { eventCommandHash } from "@/project/eventCommands/singleCommandOps";
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
let maouFixture: Project;

function setup(commands: Command[], name: FixtureName = "blank") {
  const fixture = name === "maou" ? maouFixture : loadFixture(name);
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
  beforeAll(() => {
    maouFixture = loadFixture("maou");
  }, 120_000);

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
  });

  it.each([
    ["fork.insert", { condition: { kind: "all", conditions: [{ kind: "item", itemId: "missing", present: true }] } }, /아이템/u],
    ["fork.insert", { condition: { kind: "not", condition: { kind: "switch", switchId: "missing", value: true } } }, /스위치/u],
    ["fork.insert", { condition: { kind: "switch", switchId: "flow-sw" } }, /형식/u],
    ["wait.insert", { variableId: "missing" }, /변수/u],
    ["callCommonEvent.insert", { commonEventId: "missing" }, /공용 이벤트/u],
    ["callMapEvent.insert", { eventId: "missing" }, /맵의 이벤트/u],
    ["gotoLabel.insert", { name: "없는 위치" }, /위치 표시가 없습니다/u],
    ["breakLoop.insert", {}, /반복 안/u],
    ["script.insert", { source: "const x = ;" }, /문법/u],
    ["script.insert", { source: 'game.hasItem("missing");' }, /연결할 대상/u],
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

  it("위치 이동이 사이 명령을 건너뛴다", () => {
    const { project, target } = setup([wait, label, { kind: "wait", ms: 200 }]);
    const { after } = runPrimitive(project, target, "cmd.gotoLabel.insert", { index: 0, name: "출발" });
    expect(createInterpreter(stored(after), startSession(after), after).start()).toEqual({ kind: "wait", ms: 200 });
  });
});
