/** @vitest-environment happy-dom */
import { beforeAll, describe, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { FORK_ELSE_BRANCH_INDEX, FORK_THEN_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { PrimitiveError, SELECT_EVENT_PAGE, STALE_COMMAND_LIST } from "@/editor/smallTask/primitives/errors";
import { primitivesForTarget } from "@/editor/smallTask/primitives/registry";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/08-cmd-time-social";
import { mapTarget } from "@/editor/smallTask/target";
import { runTool } from "@/editor/tools/toolRunner";
import { setTimeWithMakers, transitionToNextDay } from "@/player/dayTransition";
import { createInterpreter } from "@/player/interpreter";
import { applyAdvanceTimeStep } from "@/player/playSceneTime";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { ensureSwitchVariableSlots } from "@/project/defaults/blankProject";
import { removeLegacySpriteReferences } from "@/project/defaults/defaultAssets";
import { eventCommandHash } from "@/project/eventCommands/singleCommandOps";
import { calendarDayKey } from "@/project/gameTime";
import { getFriendship, getTimer, getVariable, startSession } from "@/project/session";
import { store } from "@/project/store";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { createBlankProjectCopy, expectApplies, expectRefused, expectUndoRestores, loadFixture } from "./harness";

const eventId = "ev_time_social";
const pageId = "page_time_social";
const otherId = "page_other";
const characterId = "char_time_social";
const scheduleId = "schedule_time_social";
const variableId = "var_time_social";
const commonEventId = "common_time_social";
const activityId = "activity_study";
const greeting = { kind: "text", body: "기존 안내입니다." } as const;

type Fixture = "blank" | "built" | "maou";
const fixtures = new Map<Fixture, Project>();

function fixtureProject(fixture: Fixture): Project {
  let source = fixtures.get(fixture);
  if (!source) {
    source = loadFixture(fixture);
    if (fixture === "blank") {
      const { maps, startMapId, startPos, mapTree } = createBlankProjectCopy();
      source = { ...source, maps, startMapId, startPos, mapTree };
    }
    ensureSwitchVariableSlots(source);
    removeLegacySpriteReferences(source);
    fixtures.set(fixture, source);
  }
  return source;
}

function setup(fixture: Fixture, commands: Command[] = []) {
  const source = fixtureProject(fixture);
  const map = source.maps[source.startMapId]!;
  const page: EventPage = {
    id: pageId, name: "안내", commands, conditions: [], graphic: {}, trigger: { kind: "action" },
    priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 },
  };
  const otherPage = { ...page, id: otherId, name: "다른 페이지", commands: [greeting] };
  const event: GameEvent = {
    id: eventId, name: "미루", x: 2, y: 2, trigger: { kind: "action" }, characterId,
    pages: [page, otherPage], commands: [],
  };
  const project: Project = {
    ...source,
    system: { ...source.system, timeSystem: { enabled: true } },
    variables: [...source.variables, { id: variableId, name: "기록" }],
    session: { ...source.session, variables: { ...source.session.variables, [variableId]: 0 } },
    commonEvents: [...source.commonEvents, {
      id: commonEventId, name: "공부하기", trigger: "none",
      commands: [{ kind: "changeFriendship", npcKey: characterId, delta: 3 }],
    }],
    database: { ...source.database, schedules: [...source.database.schedules ?? [], {
      id: scheduleId, title: "주간 공부", slots: [{ label: "월요일" }, { label: "화요일" }],
      activities: [{ id: activityId, label: "공부", description: "책을 읽어요.", commonEventId }],
    }] },
    maps: { ...source.maps, [map.id]: { ...map, events: [...map.events, event] } },
  };
  const target = mapTarget(project, map.id, eventId, pageId)!;
  return { project, target, mapId: map.id };
}

function stored(project: Project, id = pageId): Command[] {
  return project.maps[project.startMapId]!.events.find(event => event.id === eventId)!
    .pages!.find(page => page.id === id)!.commands;
}

const examples: readonly {
  initial: Command; insert: Record<string, unknown>; patch: Record<string, unknown>;
  updated: Command; invalid: Record<string, unknown>;
}[] = [
  { initial: { kind: "timer", action: "start", timerId: "timer2", seconds: 60 },
    insert: { action: "start", timerId: "timer2", seconds: 60 }, patch: { seconds: 45 }, invalid: { seconds: -1 },
    updated: { kind: "timer", action: "start", timerId: "timer2", seconds: 45 } },
  { initial: { kind: "advanceTime", hours: 3 },
    insert: { hours: 3 }, patch: { days: 1 }, invalid: { minutes: -1 },
    updated: { kind: "advanceTime", hours: 3, days: 1 } },
  { initial: { kind: "advanceCropGrowth", days: 2 },
    insert: { days: 2 }, patch: { days: 4 }, invalid: { days: -2 },
    updated: { kind: "advanceCropGrowth", days: 4 } },
  { initial: { kind: "setTime", hour: 18, minute: 30 },
    insert: { hour: 18, minute: 30 }, patch: { minute: 45 }, invalid: { minute: 60 },
    updated: { kind: "setTime", hour: 18, minute: 45 } },
  { initial: { kind: "sleepUntilMorning" },
    insert: {}, patch: {}, invalid: { hour: 10 }, updated: { kind: "sleepUntilMorning" } },
  { initial: { kind: "planSchedule", scheduleId, slotCount: 2 },
    insert: { scheduleId, slotCount: 2 }, patch: { slotCount: 1 }, invalid: { scheduleId: "missing_schedule" },
    updated: { kind: "planSchedule", scheduleId, slotCount: 1 } },
  { initial: { kind: "runSchedule", scheduleId },
    insert: { scheduleId }, patch: { slotVariableId: variableId }, invalid: { slotVariableId: "missing_variable" },
    updated: { kind: "runSchedule", scheduleId, slotVariableId: variableId } },
  { initial: { kind: "changeFriendship", npcKey: "", delta: 10 },
    insert: { delta: 10 }, patch: { delta: -5 }, invalid: { delta: "다섯" },
    updated: { kind: "changeFriendship", npcKey: "", delta: -5 } },
  { initial: { kind: "setRelationship", npcKey: "", state: "dating" },
    insert: { state: "dating" }, patch: { state: "engaged" }, invalid: { state: "missing_state" },
    updated: { kind: "setRelationship", npcKey: "", state: "engaged" } },
  { initial: { kind: "changeFactionStance", a: "player", b: "enemy", op: "+=", value: 1 },
    insert: {}, patch: { op: "=", value: -2 }, invalid: { a: "missing_faction" },
    updated: { kind: "changeFactionStance", a: "player", b: "enemy", op: "=", value: -2 } },
  { initial: { kind: "getFriendship", npcKey: "", variableId },
    insert: { variableId }, patch: { npcKey: "*" }, invalid: { variableId: "missing_variable" },
    updated: { kind: "getFriendship", npcKey: "*", variableId } },
];

describe.each(["blank", "built", "maou"] as const)("%s 프로젝트", fixture => {
  beforeAll(() => { fixtureProject(fixture); }, 180_000);
  const runs = examples.flatMap(example => ([false, true].map(update => ({
    example, update, id: `cmd.${example.initial.kind}.${update ? "update" : "insert"}`,
  }))));
  it.each(runs)("$id 저장·미리보기·범위·되돌리기", async ({ example, update, id }) => {
    const { initial, insert, patch, updated, invalid } = example;
    const baseline = update ? [greeting, initial] : [greeting];
    const originalCommands = structuredClone(baseline);
    const { project, target, mapId } = setup(fixture, baseline);
    const args = { index: 1, ...(update ? { ...patch, expectedHash: eventCommandHash(initial) } : insert) };
    const { after, sentence } = expectApplies(project, target, id, args);
    expect(stored(after)).toEqual([greeting, update ? updated : initial]);
    expect(stored(project)).toEqual(originalCommands);
    expect(stored(after, otherId)).toEqual([greeting]);
    expect(sentence).toMatch(/[가-힣]/u);
    expect(sentence).not.toMatch(/[{}]|(?:char|page|schedule|var)_|\b(?:player|enemy|engaged|dating)\b/u);
    expect(sentence.length).toBeLessThanOrEqual(80);

    const primitive = PRIMITIVES.find(row => row.id === id)!;
    const hostScope = primitive.scope({ project, target }, args);
    expect(hostScope).toEqual({ kind: "eventPage", mapId, eventId, pageId });
    expectRefused(project, mapTarget(project, mapId)!, id, args);

    const illegal = {
      ...after, maps: {
        ...after.maps, [mapId]: {
          ...after.maps[mapId]!, events: after.maps[mapId]!.events.map(event => event.id !== eventId ? event : {
            ...event, pages: event.pages!.map(page => page.id === otherId ? { ...page, commands: [initial] } : page),
          }),
        },
      },
    };
    expect(checkSmallTaskScope(project, illegal, hostScope)).toMatchObject({ ok: false, reason: expect.stringContaining("범위 밖") });
    expect(() => runPrimitive(project, target, id, { ...args, ...invalid })).toThrow(PrimitiveError);
    await expectUndoRestores(project, after, target);
  });
});

function runCommands(commands: Command[], project: Project) {
  const session = startSession(project, 8);
  return { session, machine: createInterpreter(commands, session, project, { currentEventId: eventId }) };
}

it("둘째 타이머를 설정한 시간으로 시작하고 시각 명령을 그대로 전달한다", () => {
  const { project, target } = setup("blank");
  const timer = runPrimitive(project, target, "cmd.timer.insert", { action: "start", timerId: "timer2", seconds: 60 }).after;
  const clock = runPrimitive(timer, target, "cmd.setTime.insert", { hour: 18, minute: 30 }).after;
  const advance = runPrimitive(clock, target, "cmd.advanceTime.insert", { days: 1, hours: 2, minutes: 5 }).after;
  const bedtime = runPrimitive(advance, target, "cmd.sleepUntilMorning.insert", {}).after;
  const { session, machine } = runCommands(stored(bedtime), bedtime);
  expect(machine.start()).toMatchObject({ kind: "timer", action: "start", seconds: 60, timerId: "timer2" });
  expect(getTimer(session, "timer2")).toBe(60);
  expect(machine.skip()).toEqual({ kind: "setTime", hour: 18, minute: 30 });
  expect(machine.skip()).toEqual({ kind: "advanceTime", minutes: 125, days: 1 });
  expect(machine.skip()).toEqual({ kind: "sleepUntilMorning" });
});

it("고른 인물의 호감도를 올려 변수에 담고 관계 상태를 저장한다", () => {
  const { project, target } = setup("built");
  const gift = runPrimitive(project, target, "cmd.changeFriendship.insert", { delta: 12 }).after;
  const score = runPrimitive(gift, target, "cmd.getFriendship.insert", { variableId }).after;
  const relation = runPrimitive(score, target, "cmd.setRelationship.insert", { state: "engaged" }).after;
  const { session, machine } = runCommands(stored(relation), relation);
  expect(machine.start()).toEqual({ kind: "done" });
  expect(getFriendship(session, characterId)).toBe(12);
  expect(getVariable(session, variableId)).toBe(12);
  expect(session.relationships?.[characterId]).toBe("engaged");
});

it("일정에서 고른 활동을 실행하고 각 순번을 돌며 호감도를 올린다", () => {
  const { project, target } = setup("maou");
  const plan = runPrimitive(project, target, "cmd.planSchedule.insert", { scheduleId, slotCount: 2 }).after;
  const run = runPrimitive(plan, target, "cmd.runSchedule.insert", { scheduleId, slotVariableId: variableId }).after;
  const { session, machine } = runCommands(stored(run), run);
  expect(machine.start()).toMatchObject({ kind: "planSchedule", view: { slots: ["월요일", "화요일"] } });
  expect(machine.resume([activityId, activityId])).toEqual({ kind: "done" });
  expect(session.schedulePlans?.[scheduleId]).toEqual([activityId, activityId]);
  expect(session.scheduleUses?.[scheduleId]?.[activityId]).toBe(2);
  expect(getVariable(session, variableId)).toBe(2);
  expect(getFriendship(session, characterId)).toBe(6);
});

it("이벤트 읽기에서 받은 위치와 지문으로 선택한 분기의 한 줄만 고친다", () => {
  const original = { kind: "timer", action: "set", seconds: 30 } as const;
  const other = { ...original, seconds: 10 };
  const fork = { kind: "fork", condition: { kind: "gold", op: ">=", amount: 1 }, then: [original], else: [other] } satisfies Command;
  const { project, target, mapId } = setup("blank", [fork, greeting]);
  const read = runTool({ project }, "get_event", { mapId, eventId, includeCommandHashes: true });
  expect(read.ok).toBe(true);
  const data = read.data as { commandHashes: { pageId: string; commands: { index: number; branchPath: number[]; hash: string }[] }[] };
  const row = data.commandHashes.find(page => page.pageId === pageId)!.commands.find(command =>
    command.index === 0 && jsonEqual(command.branchPath, [0, FORK_THEN_BRANCH_INDEX]))!;
  const fields = { index: row.index, branchPath: row.branchPath, seconds: 45 };
  const args = { ...fields, expectedHash: row.hash };
  const { after } = runPrimitive(project, target, "cmd.timer.update", args);
  expect(stored(after)).toEqual([{ ...fork, then: [{ ...original, seconds: 45 }] }, greeting]);
  expect(() => runPrimitive(after, target, "cmd.timer.update", args)).toThrow(STALE_COMMAND_LIST);
  expectRefused(project, target, "cmd.timer.update", fields, /형식을 확인/u);
  expect(() => runPrimitive(project, target, "cmd.timer.update", {
    ...args, branchPath: [0, FORK_ELSE_BRANCH_INDEX],
  })).toThrow(STALE_COMMAND_LIST);
  expectRefused(project, target, "cmd.timer.update",
    { ...args, index: 1 }, /그 줄을 찾을 수 없어요/u);
  expectRefused(project, target, "cmd.timer.insert", { branchPath: [0] }, /분기 위치/u);
  expectRefused(project, target, "cmd.timer.insert", { branchPath: [0, -99] }, /분기/u);
  expect(jsonEqual(stored(project), [fork, greeting])).toBe(true);
});

it("다른 종류로 바뀐 줄은 오래된 지문을 먼저 거절한다", () => {
  const original = { kind: "timer", action: "set", seconds: 30 } as const;
  const replacement = { kind: "wait", ms: 100 } as const;
  const { project, target } = setup("blank", [replacement]);
  const args = { index: 0, seconds: 45, expectedHash: eventCommandHash(original) };
  expect(() => runPrimitive(project, target, "cmd.timer.update", args)).toThrow(STALE_COMMAND_LIST);
  expectRefused(project, target, "cmd.timer.update", { ...args, expectedHash: eventCommandHash(replacement) },
    /타이머.*명령이 아니에요/u);
});

it("시간 시스템이 꺼져 있으면 작동할 수 없는 시각·날짜 명령을 거절한다", () => {
  const { project, target } = setup("blank", [greeting]);
  const disabled = { ...project, system: { ...project.system, timeSystem: { enabled: false } } };
  expectRefused(disabled, target, "cmd.setTime.insert", { hour: 18 }, /시간 시스템이 꺼져 있어요/u);
  expectRefused(disabled, target, "cmd.advanceTime.insert", { days: 1 }, /시간 시스템이 꺼져 있어요/u);
  expectRefused(disabled, target, "cmd.sleepUntilMorning.insert", {}, /시간 시스템이 꺼져 있어요/u);
  expect(runPrimitive(disabled, target, "cmd.advanceCropGrowth.insert", { days: 1 }).after.system).toBe(disabled.system);
  expect(stored(disabled)).toEqual([greeting]);
});

it("시간만 진행할 때 기본 분 수를 더하지 않고 기존 타이머의 시작 시간을 지울 수 있다", () => {
  const { project, target } = setup("blank");
  const timer = runPrimitive(project, target, "cmd.timer.insert", { action: "start", seconds: 60 }).after;
  const existing = runPrimitive(timer, target, "cmd.timer.update", {
    index: 0, seconds: null, expectedHash: eventCommandHash(stored(timer)[0]!),
  }).after;
  const advance = runPrimitive(existing, target, "cmd.advanceTime.insert", { hours: 2 }).after;
  expect(stored(advance)).toEqual([{ kind: "timer", action: "start", timerId: "timer1" }, { kind: "advanceTime", hours: 2 }]);
  const { session, machine } = runCommands(stored(advance), advance);
  session.timers.timer1 = 20;
  expect(machine.start()).toMatchObject({ kind: "timer", action: "start", seconds: undefined, timerId: "timer1" });
  expect(getTimer(session, "timer1")).toBe(20);
  expect(machine.skip()).toMatchObject({ kind: "advanceTime", minutes: 120 });
});

it("시간표의 하루 길이로 일·시간·분을 합산하고 시각이 보정될 입력을 거절한다", () => {
  const { project, target } = setup("blank", [{ kind: "advanceTime", days: 395, hours: 1 }]);
  const system = { ...project.system, timeSystem: { enabled: true, dayStartHour: 6, dayEndHour: 7 } };
  const clock = { ...project, system };
  expectRefused(clock, target, "cmd.advanceTime.update", {
    index: 0, expectedHash: eventCommandHash(stored(clock)[0]!), minutes: 1,
  }, /396일/u);
  expectRefused(clock, target, "cmd.setTime.insert", { hour: 24 }, /23시까지/u);
  const lateNight = { ...clock, system: { ...system, timeSystem: { ...system.timeSystem, dayEndHour: 27 } } };
  const { after, sentence } = runPrimitive(lateNight, target, "cmd.setTime.insert", { hour: 27 });
  const inserted = stored(after)[1]!;
  expect(inserted).toEqual({ kind: "setTime", hour: 27, minute: 0 });
  const session = startSession(after, 8);
  expect(setTimeWithMakers(after, session, inserted as Extract<Command, { kind: "setTime" }>))
    .toMatchObject({ ok: true, time: { hour: 27, minute: 0 } });
  expect(sentence).toContain("27:00");
});

it.each([
  { days: -1000, withinLimit: 7920, overLimit: 7921 },
  { days: 395.9, withinLimit: 20, overLimit: 21 },
])("저장된 일 수 $days를 플레이어와 같은 방식으로 보정해 한도를 검사한다", ({ days, withinLimit, overLimit }) => {
  const original = { kind: "advanceTime", days } as const;
  const { project, target } = setup("blank", [original]);
  const timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26, forceSleep: false };
  const clock = { ...project, system: { ...project.system, timeSystem } };
  const args = { index: 0, expectedHash: eventCommandHash(original) };
  expectRefused(clock, target, "cmd.advanceTime.update", { ...args, hours: overLimit }, /396일/u);
  const { after } = expectApplies(clock, target, "cmd.advanceTime.update", { ...args, hours: withinLimit });
  expect(stored(after)).toEqual([{ ...original, hours: withinLimit }]);
});

it("작물 성장 미리보기에 일일 확인 횟수와 물주기 조건을 안내한다", () => {
  const { project, target } = setup("blank");
  const { sentence } = expectApplies(project, target, "cmd.advanceCropGrowth.insert", { days: 5 });
  expect(sentence).toBe("작물의 일일 성장 여부를 5번 확인하는 명령을 추가합니다.");
  const primitive = PRIMITIVES.find(row => row.id === "cmd.advanceCropGrowth.insert");
  expect(primitive?.args.properties?.days?.description).toContain("다시 물을 주어야");
});

it.each([
  { forceSleep: true, startMinute: 50, expectedTime: { day: 2, hour: 6, minute: 0 } },
  { forceSleep: true, startMinute: 30, expectedTime: { day: 1, hour: 25, minute: 50 } },
  { forceSleep: false, startMinute: 50, expectedTime: { day: 2, hour: 6, minute: 10 } },
])("강제 취침 $forceSleep 설정의 시간 진행 미리보기와 실제 시각을 확인한다 (25:$startMinute)", async ({ forceSleep, startMinute, expectedTime }) => {
  const { project, target } = setup("blank");
  const timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26, forceSleep };
  const configured = { ...project, system: { ...project.system, timeSystem } };
  const { after, sentence } = expectApplies(configured, target, "cmd.advanceTime.insert", { minutes: 20 });
  expect(sentence).toBe(forceSleep
    ? "시간을 20분 진행하는 명령을 추가합니다. 시·분 진행 중 하루가 끝나면 다음 날 아침에 멈춰요."
    : "시간을 20분 진행하는 명령을 추가합니다.");
  const { session, machine } = runCommands(stored(after), after);
  const start = { year: 1, season: "spring", day: 1, hour: 25, minute: startMinute } as const;
  session.gameTime = start;
  const step = machine.start();
  if (step.kind !== "advanceTime") throw new Error("시간 진행 명령이 필요합니다.");
  const scene: Pick<PlaySceneContext, "session" | "sleepUntilMorning" | "clearRuntimeOverlay" | "syncRuntimeState"> = {
    session,
    sleepUntilMorning: async () => transitionToNextDay(after, session, calendarDayKey(start)).ok,
    clearRuntimeOverlay() {},
    syncRuntimeState() {},
  };
  const previous = store.getCurrent();
  try {
    store.replaceProject(after);
    await applyAdvanceTimeStep(scene as PlaySceneContext, step);
    expect(session.gameTime).toMatchObject(expectedTime);
  } finally {
    store.replaceProject(previous);
  }
});

it("타이머의 잘못된 초 입력을 거절하고 같은 값으로 수정하면 프로젝트를 그대로 돌려준다", () => {
  const initial: Command = { kind: "timer", action: "set", seconds: 30, timerId: "timer2" };
  const { project, target } = setup("blank", [initial]);
  const args = { index: 0, expectedHash: eventCommandHash(initial) };
  expectRefused(project, target, "cmd.timer.update", { ...args, seconds: null }, /몇 초인지 입력/u);
  expectRefused(project, target, "cmd.timer.update", { ...args, action: "stop", seconds: 30 }, /초를 지정할 수 없어요/u);
  const { after, sentence } = runPrimitive(project, target, "cmd.timer.update", { ...args, seconds: 30 });
  expect(after).toBe(project);
  expect(sentence).toMatch(/그대로 둡니다/u);
});

it.each(["start", "stop"] as const)("초 없는 %s 타이머를 설정으로 바꾸려면 초를 입력해야 한다", async action => {
  const initial = { kind: "timer", action } satisfies Command;
  const { project, target } = setup("blank", [initial]);
  const args = { index: 0, expectedHash: eventCommandHash(initial), action: "set" };
  expectRefused(project, target, "cmd.timer.update", args, /몇 초인지 입력/u);
  const { after } = runPrimitive(project, target, "cmd.timer.update", { ...args, seconds: 0 });
  expect(stored(after)).toEqual([{ kind: "timer", action: "set", seconds: 0 }]);
  await expectUndoRestores(project, after, target);
});

it("초가 생략된 이전 타이머 설정에서 타이머 번호를 바꿀 수 있다", () => {
  const initial = { kind: "timer", action: "set" } satisfies Command;
  const { project, target } = setup("blank", [initial]);
  const { after } = runPrimitive(project, target, "cmd.timer.update", {
    index: 0, expectedHash: eventCommandHash(initial), timerId: "timer2",
  });
  expect(stored(after)).toEqual([{ ...initial, timerId: "timer2" }]);
});

it("두 번째 페이지의 빈 선택지 분기에 삽입해도 첫 페이지와 형제 분기는 유지한다", () => {
  const { project, mapId } = setup("blank", [greeting]);
  const choice = { kind: "choices", prompt: "출발할까요?", options: [
    { text: "예", branch: [] }, { text: "아니요", branch: [greeting] },
  ] } satisfies Command;
  const map = project.maps[mapId]!;
  const withChoice = { ...project, maps: { ...project.maps, [mapId]: {
    ...map, events: map.events.map(event => event.id !== eventId ? event : {
      ...event, pages: event.pages!.map(page => page.id === otherId ? { ...page, commands: [choice] } : page),
    }),
  } } };
  const target = mapTarget(withChoice, mapId, eventId, otherId)!;
  const { after } = runPrimitive(withChoice, target, "cmd.sleepUntilMorning.insert", { branchPath: [0, 0] });
  expect(stored(after)).toEqual([greeting]);
  expect(stored(after, otherId)).toEqual([{
    ...choice, options: [{ ...choice.options[0], branch: [{ kind: "sleepUntilMorning" }] }, choice.options[1]],
  }]);
  expect(stored(withChoice, otherId)).toEqual([choice]);
  expectRefused(withChoice, target, "cmd.sleepUntilMorning.insert", { branchPath: [0, 0], pageId }, /형식을 확인/u);
});

it("페이지가 여러 개면 선택을 요구하고 선택한 페이지의 새 분기만 편집해 한 번에 되돌린다", async () => {
  const fork = { kind: "fork", condition: { kind: "gold", op: ">=", amount: 1 }, then: [greeting] } satisfies Command;
  const { project, target, mapId } = setup("blank", [fork]);
  const withoutPage = mapTarget(project, mapId, eventId)!;
  const branchPath = [0, FORK_ELSE_BRANCH_INDEX];
  const args = { branchPath, action: "stop" };
  expect(() => runPrimitive(project, withoutPage, "cmd.timer.insert", args)).toThrow(SELECT_EVENT_PAGE);
  expectRefused(project, target, "cmd.timer.insert", { branchPath, index: 1 }, /그 줄을 찾을 수 없어요/u);
  expectRefused(project, target, "cmd.timer.update", {
    branchPath, index: 0, expectedHash: eventCommandHash(greeting), seconds: 1,
  }, /분기를 찾을 수 없어요/u);
  const { after } = runPrimitive(project, target, "cmd.timer.insert", args);
  expect(stored(after)).toEqual([{ ...fork, else: [{ kind: "timer", action: "stop", timerId: "timer1" }] }]);
  expect(stored(project)).toEqual([fork]);
  expect(stored(after, otherId)).toEqual([greeting]);
  await expectUndoRestores(project, after, target);
});

it("인물 정보가 없는 이벤트에서 최고 호감도는 조회하고 변경 요청은 거절한다", () => {
  const { project, target, mapId } = setup("blank");
  const map = project.maps[mapId]!;
  const noCharacter = { ...project, maps: { ...project.maps, [mapId]: {
    ...map, events: map.events.map(event => event.id === eventId ? { ...event, characterId: undefined } : event),
  } } };
  expectRefused(noCharacter, target, "cmd.getFriendship.insert", { variableId }, /연결된 인물/u);
  expectRefused(noCharacter, target, "cmd.changeFriendship.insert", { npcKey: "*" }, /별표/u);
  expectRefused(noCharacter, target, "cmd.setRelationship.insert", { npcKey: "*" }, /별표/u);
  expectRefused(noCharacter, target, "cmd.changeFriendship.insert", { npcKey: "constructor", delta: 5 }, /이 이름표는/u);
  const custom = runPrimitive(noCharacter, target, "cmd.changeFriendship.insert", { npcKey: "  여행자  ", delta: 5 }).after;
  const customRun = runCommands(stored(custom), custom);
  expect(customRun.machine.start()).toEqual({ kind: "done" });
  expect(getFriendship(customRun.session, "여행자")).toBe(5);
  const { after, sentence } = runPrimitive(noCharacter, target, "cmd.getFriendship.insert", { npcKey: "*", variableId });
  const { session, machine } = runCommands(stored(after), after);
  session.friendship = { one: 4, two: 9 };
  expect(machine.start()).toEqual({ kind: "done" });
  expect(getVariable(session, variableId)).toBe(9);
  expect(sentence).toBe("가장 높은 호감도를 ‘기록’에 저장하는 명령을 추가합니다.");
});

it("일정표 변경으로 기존 칸 수가 맞지 않으면 거절하고 순번 변수 오류를 따로 안내한다", () => {
  const initial: Command = { kind: "planSchedule", scheduleId, slotCount: 2 };
  const { project, target } = setup("blank", [initial]);
  const shorter = "schedule_short";
  const database = { ...project.database, schedules: [
    ...project.database.schedules!, { id: shorter, title: "쉬기", slots: [{ label: "오늘" }], activities: [] },
  ] };
  const withSchedule = { ...project, database };
  const args = { index: 0, expectedHash: eventCommandHash(initial), scheduleId: shorter };
  expectRefused(withSchedule, target, "cmd.planSchedule.update", args, /1칸이 있어요/u);
  expectRefused(withSchedule, target, "cmd.runSchedule.insert", { scheduleId, slotVariableId: "missing" }, /순번을 저장할 변수/u);
  const withoutActivityEvent = { ...withSchedule, commonEvents: withSchedule.commonEvents.filter(row => row.id !== commonEventId) };
  expectRefused(withoutActivityEvent, target, "cmd.runSchedule.insert", { scheduleId }, /공용 이벤트를 찾을 수 없어요/u);
  expectRefused(withoutActivityEvent, target, "cmd.planSchedule.insert", { scheduleId }, /공용 이벤트를 찾을 수 없어요/u);
  const { after } = runPrimitive(withSchedule, target, "cmd.planSchedule.update", { ...args, slotCount: null });
  expect(stored(after)).toEqual([{ kind: "planSchedule", scheduleId: shorter }]);
  expect(after.database).toBe(database);
  expect(after.commonEvents).toBe(project.commonEvents);
});

it("진영 태도 변경은 등록하되 모델에 제시하는 목록에서 가린다", () => {
  const { target } = setup("blank");
  const faction = PRIMITIVES.filter(primitive => primitive.covers.commandKinds?.includes("changeFactionStance"));
  expect(faction).toHaveLength(2);
  expect(faction.every(primitive => primitive.hidden)).toBe(true);
  expect(primitivesForTarget(target).map(primitive => primitive.id)).not.toContain("cmd.changeFactionStance.insert");
  expect(primitivesForTarget(target).map(primitive => primitive.id)).toContain("cmd.timer.insert");
});
