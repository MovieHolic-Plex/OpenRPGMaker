/** @vitest-environment happy-dom */
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { FORK_THEN_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { readCheckPath, resolveTarget, type CorpusCase } from "@/editor/smallTask/primitives/corpusSchema";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { primitivesForTarget } from "@/editor/smallTask/primitives/registry";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/08-cmd-time-social";
import { mapTarget } from "@/editor/smallTask/target";
import { createInterpreter } from "@/player/interpreter";
import { createBlankProject } from "@/project/defaults/blankProject";
import { eventCommandHash } from "@/project/eventCommands/singleCommandOps";
import { getFriendship, getTimer, getVariable, startSession } from "@/project/session";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { expectApplies, expectRefused, expectUndoRestores, loadFixture } from "./harness";

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
      const { maps, startMapId, startPos, mapTree } = createBlankProject();
      source = { ...source, maps, startMapId, startPos, mapTree };
    }
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
    variables: [...source.variables, { id: variableId, name: "기록" }],
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
    const args = { index: 1, ...(update ? patch : insert) };
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

it("선택한 분기의 한 줄만 고치고 낡은 줄 지문을 거절한다", () => {
  const original = { kind: "timer", action: "set", seconds: 30 } as const;
  const fork = { kind: "fork", condition: { kind: "gold", op: ">=", amount: 1 }, then: [original], else: [greeting] } satisfies Command;
  const { project, target } = setup("blank", [fork, greeting]);
  const args = { index: 0, branchPath: [0, FORK_THEN_BRANCH_INDEX], seconds: 45, expectedHash: eventCommandHash(original) };
  const { after } = runPrimitive(project, target, "cmd.timer.update", args);
  expect(stored(after)).toEqual([{ ...fork, then: [{ ...original, seconds: 45 }] }, greeting]);
  expect(() => runPrimitive(after, target, "cmd.timer.update", args)).toThrow(/내용이 바뀌었어요/u);
  expect(jsonEqual(stored(project), [fork, greeting])).toBe(true);
});

it("시간만 진행할 때 기본 분 수를 더하지 않고 기존 타이머의 시작 시간을 지울 수 있다", () => {
  const { project, target } = setup("blank");
  const timer = runPrimitive(project, target, "cmd.timer.insert", { action: "start", seconds: 60 }).after;
  const existing = runPrimitive(timer, target, "cmd.timer.update", { index: 0, seconds: null }).after;
  const advance = runPrimitive(existing, target, "cmd.advanceTime.insert", { hours: 2 }).after;
  expect(stored(advance)).toEqual([{ kind: "timer", action: "start", timerId: "timer1" }, { kind: "advanceTime", hours: 2 }]);
  const { session, machine } = runCommands(stored(advance), advance);
  session.timers.timer1 = 20;
  expect(machine.start()).toMatchObject({ kind: "timer", action: "start", seconds: undefined, timerId: "timer1" });
  expect(getTimer(session, "timer1")).toBe(20);
  expect(machine.skip()).toMatchObject({ kind: "advanceTime", minutes: 120 });
});

it("진영 태도 변경은 등록하되 모델에 제시하는 목록에서 가린다", () => {
  const { target } = setup("blank");
  const faction = PRIMITIVES.filter(primitive => primitive.covers.commandKinds?.includes("changeFactionStance"));
  expect(faction).toHaveLength(2);
  expect(faction.every(primitive => primitive.hidden)).toBe(true);
  expect(primitivesForTarget(target).map(primitive => primitive.id)).not.toContain("cmd.changeFactionStance.insert");
  expect(primitivesForTarget(target).map(primitive => primitive.id)).toContain("cmd.timer.insert");
});

type SeededCase = CorpusCase & {
  setup: {
    events: GameEvent[];
    variables?: Project["variables"];
    database?: Partial<Project["database"]>;
  };
};
const corpus: SeededCase[] = JSON.parse(readFileSync(
  "harness-data/small-task-corpus/08-cmd-time-social.json", "utf8",
));

// 공용 코퍼스 실행기가 사례별 시드를 적용할 때 이 검수는 공용 실행기로 옮길 수 있다.
describe("시간·일정·관계 자연어 회귀 요청", () => {
  it.each(corpus)("$request", async entry => {
    const fixture = fixtureProject(entry.fixture);
    const map = fixture.maps[fixture.startMapId]!;
    const project: Project = {
      ...fixture,
      variables: [...fixture.variables, ...entry.setup.variables ?? []],
      database: { ...fixture.database, ...entry.setup.database },
      maps: { ...fixture.maps, [map.id]: { ...map, events: [...map.events, ...entry.setup.events] } },
    };
    const target = resolveTarget(project, entry.target);
    if (entry.expectRefusal) {
      expectRefused(project, target, entry.primitive, entry.args, /[가-힣]/u);
      return;
    }
    const { after } = expectApplies(project, target, entry.primitive, entry.args);
    expect(entry.expect?.length).toBeGreaterThan(0);
    for (const check of entry.expect ?? []) {
      expect(readCheckPath(after, check.at)).toEqual(check.equals);
    }
    await expectUndoRestores(project, after, target);
  });
});
