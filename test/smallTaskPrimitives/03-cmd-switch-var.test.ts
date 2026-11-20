/** @vitest-environment happy-dom */
import { expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { FORK_ELSE_BRANCH_INDEX, FORK_THEN_BRANCH_INDEX, LOOP_BODY_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { smallTaskBase } from "@/editor/smallTask/history";
import { PrimitiveError, SELECT_EVENT_PAGE, STALE_COMMAND_LIST } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/03-cmd-switch-var";
import { APPLY_SMALL_TASK_PRIMITIVE, LIST_SMALL_TASK_PRIMITIVES, runSmallTaskPrimitiveTool } from "@/editor/tools/smallTaskPrimitiveTools";
import { getTool } from "@/editor/tools/toolRegistry";
import { createInterpreter } from "@/player/interpreter";
import { ensureSwitchVariableSlots } from "@/project/defaults/blankProject";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { eventCommandHash } from "@/project/eventCommands/singleCommandOps";
import { resolveEventPage } from "@/project/io/pageResolution";
import { openingStageEventId, openingStageFlag } from "@/project/openingStage";
import { startSession, VARIABLE_MAX, VARIABLE_MIN } from "@/project/session";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { eventTarget, expectKoreanSentence, expectRefused, expectUndoRestores, loadFixture, mapTarget } from "./harness";

type Fixture = Parameters<typeof loadFixture>[0];

const mapId = "map_state_test";
const eventId = "ev_state_test";
const pageId = "page_state_test";
const otherPageId = "page_state_other";
const switchId = "sw_state_test";
const variableId = "var_state_test";
const sourceId = "var_state_source";
const flag = "legacy_state_test";
const text: Command = { kind: "text", body: "그대로 둘 대사" };
const wait: Command = { kind: "wait", ms: 40 };

function setup(fixture: Fixture, commands: Command[], selection = pageId) {
  const project = loadFixture(fixture);
  const starter = project.maps[project.startMapId];
  const map = createBlankMap("상태 연습실", 5, 5, starter?.tilesetId);
  const page: EventPage = {
    id: pageId, name: "선택한 페이지", trigger: { kind: "action" }, priority: "same",
    graphic: {}, movement: { type: "fixed", speed: 3, frequency: 3 }, conditions: [], commands,
  };
  const event: GameEvent = {
    id: eventId, name: "연습 상자", x: 1, y: 1, trigger: page.trigger, commands: [],
    pages: [page, { ...page, id: otherPageId, name: "옆 페이지", commands: [wait] }],
  };
  map.id = mapId;
  map.events = [event, { ...event, id: "ev_state_neighbor", name: "옆 상자", pages: [{ ...page, commands: [wait] }] }];
  const before: Project = {
    ...project, maps: { ...project.maps, [mapId]: map },
    startMapId: starter ? project.startMapId : mapId,
    startPos: starter ? project.startPos : { x: 2, y: 2 },
    mapTree: starter ? project.mapTree : { mapId, children: [] },
    switches: [...project.switches, { id: switchId, name: "문 잠금" }],
    variables: [...project.variables, { id: variableId, name: "획득 개수" }, { id: sourceId, name: "보상 개수" }],
    session: {
      ...project.session,
      switches: { ...project.session.switches },
      variables: { ...project.session.variables },
    },
  };
  ensureSwitchVariableSlots(before);
  const target = eventTarget(before, mapId, eventId, selection);
  return { before, target };
}

function commandsOn(project: Project): Command[] {
  return project.maps[mapId]!.events[0]!.pages![0]!.commands;
}

const switchOn: Command = { kind: "setSwitch", switchId, value: true };
const variableSet: Command = { kind: "setVariable", variableId, op: "=", value: 0 };
const selfOn: Command = { kind: "setSelfSwitch", key: "A", value: true };
const flagOn: Command = { kind: "setFlag", flag, value: true };

function checkedUpdate(command: Command, args: Record<string, unknown>) {
  return { expectedHash: eventCommandHash(command), ...args };
}

const cases: {
  id: string; fixture: Fixture; initial?: Command; args: Record<string, unknown>;
  stored: Command; sentence: string;
}[] = [
  { id: "cmd.setSwitch.insert", fixture: "blank", args: { switchId: " 문 잠금 ", index: 1 }, stored: switchOn, sentence: "『문 잠금』 스위치를 켭니다." },
  { id: "cmd.setSwitch.update", fixture: "built", initial: switchOn,
    args: checkedUpdate(switchOn, { index: 1, value: "toggle" }),
    stored: { ...switchOn, value: "toggle" }, sentence: "『문 잠금』 스위치를 현재 상태와 반대로 바꿉니다." },
  { id: "cmd.setVariable.insert", fixture: "maou", args: { variableId: "획득 개수", index: 1 }, stored: variableSet,
    sentence: "『획득 개수』 변수에 0을 저장합니다." },
  { id: "cmd.setVariable.update", fixture: "built", initial: variableSet,
    args: checkedUpdate(variableSet, { index: 1, op: "+=", operandVariableId: "보상 개수" }),
    stored: { ...variableSet, op: "+=", value: { kind: "var", id: sourceId } },
    sentence: "『획득 개수』 변수 값에 『보상 개수』 값을 더합니다." },
  { id: "cmd.setSelfSwitch.insert", fixture: "blank", args: { index: 1 }, stored: selfOn,
    sentence: "이 이벤트의 셀프 스위치 A를 켭니다." },
  { id: "cmd.setSelfSwitch.update", fixture: "built", initial: selfOn, args: checkedUpdate(selfOn, { index: 1, value: false }),
    stored: { ...selfOn, value: false }, sentence: "이 이벤트의 셀프 스위치 A를 끕니다." },
  { id: "cmd.setFlag.insert", fixture: "blank", args: { index: 1, switchId, value: false },
    stored: { ...switchOn, value: false }, sentence: "『문 잠금』 스위치를 끕니다." },
  { id: "cmd.setFlag.update", fixture: "built", initial: flagOn, args: checkedUpdate(flagOn, { index: 1, value: false }),
    stored: { ...flagOn, value: false }, sentence: "이전 방식의 기억을 끕니다." },
];

it.each(cases)("$id 저장 결과, 미리보기, 선택 범위와 되돌리기", async ({ id, fixture, initial, args, stored, sentence }) => {
  const original = initial ? [text, initial, wait] : [text, wait];
  const { before, target } = setup(fixture, original);
  const result = runPrimitive(before, target, id, args);
  expect(commandsOn(result.after)).toStrictEqual([text, stored, wait]);
  expect(commandsOn(before)).toStrictEqual(original);
  expect(result.sentence).toBe(sentence);
  expectKoreanSentence(result.sentence);
  expect(result.after.switches).toBe(before.switches);
  expect(result.after.variables).toBe(before.variables);
  const oldEvents = before.maps[mapId]!.events;
  const nextEvents = result.after.maps[mapId]!.events;
  expect(nextEvents[0]!.pages![1]).toBe(oldEvents[0]!.pages![1]);
  expect(nextEvents[1]).toBe(oldEvents[1]);

  const primitive = PRIMITIVES.find(candidate => candidate.id === id)!;
  const scope = primitive.scope({ project: before, target }, { ...args, pageId: otherPageId });
  expect(scope).toEqual({ kind: "eventPage", mapId, eventId, pageId });
  const outside = runPrimitive(before, eventTarget(before, mapId, eventId, otherPageId), "cmd.setSelfSwitch.insert", {}).after;
  const rejected = checkSmallTaskScope(before, outside, scope);
  expect(rejected).toMatchObject({ ok: false, reason: expect.stringContaining("범위 밖") });
  expect(() => runPrimitive(before, target, id, { ...args, pageId: otherPageId })).toThrow(PrimitiveError);
  expectRefused(before, mapTarget(before, mapId), id, args);

  await expectUndoRestores(before, result.after, target);
}, 180_000); // 마왕 픽스처의 전체 게임 조립 시간도 포함한다.

it("작은 일 도구에서 옛 기억 추가 별칭을 읽고 같은 스위치로 저장한다", async () => {
  const { before, target } = setup("blank", []);
  const ctx = { project: before, smallTaskTarget: target };
  const list = await runSmallTaskPrimitiveTool(ctx, LIST_SMALL_TASK_PRIMITIVES, {});
  const canonical = list.data?.find(row => row.id === "cmd.setSwitch.insert");
  const alias = list.data?.find(row => row.id === "cmd.setFlag.insert");
  expect(canonical).toBeDefined();
  expect(alias).toMatchObject({ title: "기억 추가 (스위치 사용)", args: canonical?.args });
  await expect(runSmallTaskPrimitiveTool(ctx, APPLY_SMALL_TASK_PRIMITIVE, {
    id: "cmd.setFlag.insert", args: { switchId, value: false },
  })).resolves.toMatchObject({ ok: true });
  expect(commandsOn(ctx.project)).toStrictEqual([{ ...switchOn, value: false }]);
  expect(commandsOn(before)).toStrictEqual([]);
  await expectUndoRestores(before, ctx.project, target);
});

it("get_event에서 읽은 해시로만 작은 일 도구의 변수 수정을 적용한다", async () => {
  const { before, target } = setup("blank", [variableSet]);
  const ctx = { project: before, smallTaskTarget: target };
  const result = await getTool("get_event")!.run(before, { mapId, eventId, includeCommandHashes: true });
  const data = result.data as { commandHashes: { pageId: string; commands: { index: number; hash: string }[] }[] };
  const row = data.commandHashes.find(page => page.pageId === pageId)?.commands[0];
  expect(row).toMatchObject({ index: 0, hash: eventCommandHash(variableSet) });
  const apply = (expectedHash?: string) => runSmallTaskPrimitiveTool(ctx, APPLY_SMALL_TASK_PRIMITIVE, {
    id: "cmd.setVariable.update",
    args: { index: 0, value: 3, ...(expectedHash === undefined ? {} : { expectedHash }) },
  });
  await expect(apply()).rejects.toThrow(PrimitiveError);
  expect(ctx.project).toBe(before);
  await expect(apply(row?.hash)).resolves.toMatchObject({ ok: true });
  expect(commandsOn(ctx.project)).toStrictEqual([{ ...variableSet, value: 3 }]);
  await expectUndoRestores(before, ctx.project, target);
});

it.each([
  { id: "cmd.setSwitch.insert", args: { switchId: "새 스위치" } },
  { id: "cmd.setVariable.insert", args: { variableId: "새 변수", value: 2 } },
  { id: "cmd.setSwitch.update", args: checkedUpdate(switchOn, { index: 0, operandVariableId: "없는 원본 변수" }) },
])("$id 명령 밖에서 정의가 필요한 요청을 거절한다", ({ id, args }) => {
  const { before, target } = setup("blank", [switchOn]);
  expectRefused(before, target, id, args);
  expect(before.switches.some(record => record.name === "새 스위치")).toBe(false);
  expect(before.variables.some(record => record.name === "새 변수")).toBe(false);
});

it("동명 정의, 이미 바뀐 줄, 맞지 않는 명령 종류와 두 값 출처를 거절한다", () => {
  const { before, target } = setup("blank", [switchOn, text]);
  const ambiguous = { ...before, switches: [...before.switches, { id: "sw_another", name: "문 잠금" }] };
  expect(() => runPrimitive(ambiguous, target, "cmd.setSwitch.insert", { switchId: "문 잠금" })).toThrow(/여럿/);
  expect(() => runPrimitive(before, target, "cmd.setSwitch.update", { index: 0, value: false, expectedHash: "outdated" })).toThrow(STALE_COMMAND_LIST);
  expectRefused(before, target, "cmd.setSwitch.update", checkedUpdate(text, { index: 1, value: false }), /같은 종류/);
  expectRefused(before, target, "cmd.setSwitch.update", checkedUpdate(switchOn, { index: 0, value: false, operandVariableId: sourceId }), /하나만/);
});

it("같은 종류의 줄이 들어선 이전 위치와 확인값을 생략한 수정을 모두 거절한다", () => {
  const otherSwitch = { ...switchOn, value: "toggle" } satisfies Command;
  const { before, target } = setup("blank", [otherSwitch, switchOn]);
  expectRefused(before, target, "cmd.setSwitch.update", { index: 0, value: false }, /값의 형식/);
  expect(() => runPrimitive(before, target, "cmd.setSwitch.update", checkedUpdate(switchOn, { index: 0, value: false }))).toThrow(STALE_COMMAND_LIST);
});

it("페이지가 여러 개면 대상에서 페이지를 지정한 뒤 상태 명령을 수정한다", () => {
  const { before, target } = setup("blank", [switchOn]);
  const eventOnly = eventTarget(before, mapId, eventId);
  const args = checkedUpdate(switchOn, { index: 0, value: false });
  expect(() => runPrimitive(before, eventOnly, "cmd.setSwitch.update", args)).toThrow(SELECT_EVENT_PAGE);
  const { after } = runPrimitive(before, target, "cmd.setSwitch.update", args);
  expect(commandsOn(after)).toStrictEqual([{ ...switchOn, value: false }]);
  expect(commandsOn(before)).toStrictEqual([switchOn]);
});

it("같은 식별자를 쓰는 페이지와 이벤트를 각각 거절한다", () => {
  const { before, target } = setup("blank", [switchOn]);
  const map = before.maps[mapId]!;
  const event = map.events[0]!;
  const duplicatePage = { ...event, pages: [...event.pages!, { ...event.pages![0]!, name: "다른 페이지" }] };
  for (const events of [[duplicatePage], [event, event]]) {
    const project = { ...before, maps: { ...before.maps, [mapId]: { ...map, events } } };
    expectRefused(project, target, "cmd.setSelfSwitch.insert", {}, /식별자가 겹쳐/);
    expect(commandsOn(project)).toStrictEqual([switchOn]);
  }
});

it("선택한 지도와 저장 키가 다르면 다른 지도를 덮어쓰지 않는다", () => {
  const { before, target } = setup("blank", [switchOn]);
  const map = before.maps[mapId]!;
  const wrongId = "map_state_other";
  const other = { ...map, id: wrongId, events: [] };
  const project = { ...before, maps: { ...before.maps, [mapId]: { ...map, id: wrongId }, [wrongId]: other } };
  expectRefused(project, target, "cmd.setSwitch.insert", { switchId }, /지도 정보를 확인/);
  expect(project.maps[wrongId]).toBe(other);
});

it("자료집에서 식별자가 중복된 변수는 새 쓰기나 값의 출처로 선택할 수 없다", () => {
  const { before, target } = setup("blank", [variableSet]);
  const project = { ...before, variables: [...before.variables, { id: variableId, name: "중복 변수" }] };
  expectRefused(project, target, "cmd.setVariable.insert", { variableId }, /식별자가 겹치지 않는지/);
  expectRefused(project, target, "cmd.setSwitch.insert", { switchId, operandVariableId: "중복 변수" }, /식별자가 겹치지 않는지/);
  expectRefused(project, target, "cmd.setVariable.update", checkedUpdate(variableSet, { index: 0, value: 2 }), /식별자가 겹치지 않는지/);
});

it("없는 변수 참조를 물려받는 부분 수정은 거절하고, 해당 참조를 고치는 요청은 적용한다", () => {
  const orphan: Command = { ...variableSet, value: { kind: "var", id: "var_gone" } };
  const { before, target } = setup("blank", [orphan]);
  expectRefused(before, target, "cmd.setVariable.update", checkedUpdate(orphan, { index: 0, op: "+=" }), /자료집에서 찾을 수 없습니다/);
  const { after } = runPrimitive(before, target, "cmd.setVariable.update", checkedUpdate(orphan, { index: 0, value: 3 }));
  expect(commandsOn(after)).toStrictEqual([{ ...orphan, value: 3 }]);
});

it("공용 이벤트가 확인하는 스위치의 마지막 쓰기 명령을 다른 스위치로 돌리지 않는다", () => {
  const { before, target } = setup("blank", [switchOn]);
  const nextSwitchId = "sw_state_next";
  const common = { id: "common_gate", name: "잠금 감시", trigger: "parallel" as const, conditionSwitchId: switchId, commands: [wait] };
  const project = {
    ...before,
    switches: [...before.switches, { id: nextSwitchId, name: "새 잠금" }],
    commonEvents: [...before.commonEvents, common],
  };
  const args = checkedUpdate(switchOn, { index: 0, switchId: nextSwitchId });
  const map = project.maps[mapId]!;
  const neighbor = map.events[1]!;
  const events = [map.events[0]!, { ...neighbor, pages: [{ ...neighbor.pages![0]!, commands: [text] }] }];
  const loneWriter = { ...project, maps: { ...project.maps, [mapId]: { ...map, events } } };
  expectRefused(loneWriter, target, "cmd.setSwitch.update", args, /기존 스위치를 확인/);
  const anotherWriter = { ...neighbor, pages: [{ ...neighbor.pages![0]!, commands: [switchOn] }] };
  const sharedWriter = { ...project, maps: { ...project.maps, [mapId]: { ...map, events: [map.events[0]!, anotherWriter] } } };
  const { after } = runPrimitive(sharedWriter, target, "cmd.setSwitch.update", args);
  expect(commandsOn(after)).toStrictEqual([{ ...switchOn, switchId: nextSwitchId }]);
});

it.each(["auto", "parallel"] as const)("%s 공용 이벤트는 시작 스위치가 켜져야 대체 쓰기를 공급한다", trigger => {
  const { before, target } = setup("blank", [switchOn]);
  const nextSwitchId = "sw_state_next";
  const map = before.maps[mapId]!;
  const event = map.events[0]!;
  const common = { id: "common_gate_writer", name: "잠금 설정", trigger, conditionSwitchId: switchId, commands: [switchOn] };
  const project = {
    ...before,
    maps: { ...before.maps, [mapId]: { ...map, events: [{ ...event, pages: [event.pages![0]!] }] } },
    switches: [...before.switches, { id: nextSwitchId, name: "새 잠금" }],
    commonEvents: [...before.commonEvents, common],
  };
  const args = checkedUpdate(switchOn, { index: 0, switchId: nextSwitchId });
  expectRefused(project, target, "cmd.setSwitch.update", args, /기존 스위치를 확인/);

  const unlocked = { ...project, session: { ...project.session, switches: { ...project.session.switches, [switchId]: true } } };
  expect(commandsOn(runPrimitive(unlocked, target, "cmd.setSwitch.update", args).after))
    .toStrictEqual([{ ...switchOn, switchId: nextSwitchId }]);
});

it("높은 페이지가 선택되는 동안 가려진 페이지는 대체 쓰기를 공급하지 않는다", () => {
  const { before, target } = setup("blank", [switchOn]);
  const nextSwitchId = "sw_state_next";
  const map = before.maps[mapId]!;
  const [event, neighbor] = map.events;
  const common = { id: "common_gate_reader", name: "잠금 감시", trigger: "parallel" as const, conditionSwitchId: switchId, commands: [wait] };
  const writer = { ...neighbor!.pages![0]!, commands: [switchOn] };
  const higher = { ...writer, id: "page_state_higher", commands: [wait] };
  const withPages = (pages: EventPage[]): Project => ({
    ...before,
    maps: { ...before.maps, [mapId]: { ...map, events: [
      { ...event!, pages: [event!.pages![0]!] }, { ...neighbor!, pages },
    ] } },
    switches: [...before.switches, { id: nextSwitchId, name: "새 잠금" }],
    commonEvents: [...before.commonEvents, common],
  });
  const args = checkedUpdate(switchOn, { index: 0, switchId: nextSwitchId });
  const gate = { kind: "switch", switchId, value: true } as const;
  const sharedCondition = [{ kind: "switch", switchId: nextSwitchId, value: true }] as const;
  for (const project of [
    withPages([writer, higher]),
    withPages([writer, { ...higher, conditions: [{ ...gate, value: false }] }]),
    withPages([{ ...writer, conditions: [...sharedCondition] }, { ...higher, conditions: [...sharedCondition] }]),
  ]) {
    expectRefused(project, target, "cmd.setSwitch.update", args, /기존 스위치를 확인/);
  }

  const available = withPages([writer, { ...higher, conditions: [gate] }]);
  expect(commandsOn(runPrimitive(available, target, "cmd.setSwitch.update", args).after))
    .toStrictEqual([{ ...switchOn, switchId: nextSwitchId }]);
});

it.each([
  { kind: "setSwitch", writer: switchOn, destination: { switchId: "sw_state_other" },
    condition: { kind: "switch", switchId, value: true } },
  { kind: "setVariable", writer: variableSet, destination: { variableId: sourceId },
    condition: { kind: "variable", variableId, op: "==", value: 0 } },
] as const)("$kind 재지정은 활성 페이지가 가린 최상위 쓰기를 대체로 세지 않는다", ({ kind, writer, destination, condition }) => {
  const { before, target } = setup("blank", [writer]);
  const map = before.maps[mapId]!;
  const [event, neighbor] = map.events;
  const [page, nextPage] = event!.pages!;
  const selected = { ...event!, pages: [page!, { ...nextPage!, conditions: [condition] }] };
  const legacy = { ...neighbor!, commands: [writer] };
  const project = {
    ...before,
    maps: { ...before.maps, [mapId]: { ...map, events: [selected, legacy] } },
    switches: [
      ...before.switches,
      { id: "sw_state_other", name: "다른 스위치" },
      { id: "sw_legacy_page", name: "호출 대상의 활성 페이지" },
    ],
  };
  const id = `cmd.${kind}.update`;
  const args = checkedUpdate(writer, { index: 0, ...destination });
  expectRefused(project, target, id, args, /값을 바꾸는 명령이 이 줄뿐/);

  // 조건에 맞는 페이지가 없으면 맵 호출에서 최상위 명령을 실행할 수 있다.
  const fallback = { ...legacy, pages: [{ ...legacy.pages![0]!, conditions: [{ kind: "switch", switchId: "sw_legacy_page", value: true }] }] } satisfies GameEvent;
  const callingPage = { ...page!, commands: [writer, { kind: "callMapEvent", eventId: fallback.id }] } satisfies EventPage;
  const callable = { ...project, maps: { ...project.maps, [mapId]: { ...map, events: [
    { ...selected, pages: [callingPage, { ...nextPage!, conditions: [condition] }] },
    fallback,
  ] } } };
  const { after } = runPrimitive(callable, target, id, args);
  expect(commandsOn(after)[0]).toStrictEqual({ ...writer, ...destination });
  const session = play(after, state => { state.variables[variableId] = 5; });
  if (kind === "setSwitch") expect(session.switches[switchId]).toBe(true);
  else expect(session.variables[variableId]).toBe(0);
});

it.each([
  { kind: "setSwitch", writer: switchOn, destination: { switchId: "sw_state_other" },
    condition: { kind: "switch", switchId, value: true }, initial: { switches: { [switchId]: true } } },
  { kind: "setVariable", writer: { ...variableSet, value: 3 }, destination: { variableId: sourceId },
    condition: { kind: "variable", variableId, op: ">=", value: 3 }, initial: { variables: { [variableId]: 3 } } },
] as const)("$kind 재지정은 기존 값이 있어야 열리는 페이지의 쓰기를 대체로 세지 않는다", ({ kind, writer, destination, condition, initial }) => {
  const { before, target } = setup("blank", [writer]);
  const map = before.maps[mapId]!;
  const [event, neighbor] = map.events;
  const selected = { ...event!, pages: [event!.pages![0]!] };
  const page = { ...neighbor!.pages![0]!, conditions: [condition], commands: [writer] };
  const project = {
    ...before,
    maps: { ...before.maps, [mapId]: { ...map, events: [selected, { ...neighbor!, pages: [page] }] } },
    switches: [...before.switches, { id: "sw_state_other", name: "다른 스위치" }],
  };
  const primitive = `cmd.${kind}.update`;
  const args = checkedUpdate(writer, { index: 0, ...destination });
  expectRefused(project, target, primitive, args, /값을 바꾸는 명령이 이 줄뿐/);

  const unlocked = { ...project, session: { ...project.session, ...initial } };
  expect(commandsOn(runPrimitive(unlocked, target, primitive, args).after)[0]).toStrictEqual({ ...writer, ...destination });

  const troop = loadFixture("built").database.troops[0]!;
  const battlePage = {
    id: "battle_state_gate", name: "진행 조건", conditions: [condition], span: "battle", commands: [writer],
  } satisfies (typeof troop.battleEventPages)[number];
  const battle = { ...project, database: { ...project.database, troops: [{ ...troop, battleEventPages: [battlePage] }] },
    maps: { ...before.maps, [mapId]: { ...map, events: [selected] } } };
  expectRefused(battle, target, primitive, args, /값을 바꾸는 명령이 이 줄뿐/);
});

it("엔딩 조건이나 맵 인카운터가 읽는 스위치의 마지막 쓰기를 보호한다", () => {
  const { before, target } = setup("blank", [switchOn]);
  const nextSwitchId = "sw_state_next";
  const map = before.maps[mapId]!;
  const project = {
    ...before,
    maps: { ...before.maps, [mapId]: { ...map, events: [map.events[0]!] } },
    switches: [...before.switches, { id: nextSwitchId, name: "다른 스위치" }],
  };
  const args = checkedUpdate(switchOn, { index: 0, switchId: nextSwitchId });
  const endings: Project["endings"] = [{ id: "end_state", name: "도착", priority: 1, conditions: [{ kind: "switch", switchId, value: true }] }];
  expectRefused({ ...project, endings }, target, "cmd.setSwitch.update", args, /기존 스위치를 확인/);
  const encounterTable = [{ troopId: "troop_state", weight: 1, conditions: { switchId } }];
  expectRefused({ ...project, maps: { ...project.maps, [mapId]: { ...project.maps[mapId]!, encounterTable } } }, target,
    "cmd.setSwitch.update", args, /기존 스위치를 확인/);
});

it("자료집 성장 보너스와 부대의 변수 읽기를 보호한다", () => {
  const { before, target } = setup("blank", [variableSet]);
  const map = before.maps[mapId]!;
  const project = { ...before, maps: { ...before.maps, [mapId]: { ...map, events: [map.events[0]!] } } };
  const args = checkedUpdate(variableSet, { index: 0, variableId: sourceId });
  const growth = { initialPoints: 0, pointsPerLevel: 1, bonusVariableId: variableId, classPositions: {}, skillTrees: [] };
  expectRefused({ ...project, growth }, target, "cmd.setVariable.update", args, /기존 변수 값을 읽/);
  const troop = loadFixture("built").database.troops[0]!;
  const afterBattle = { victory: [{ kind: "wait", variableId, ms: 0 }] satisfies Command[] };
  expectRefused({ ...project, database: { ...project.database, troops: [{ ...troop, afterBattle }] } }, target,
    "cmd.setVariable.update", args, /기존 변수 값을 읽/);
  expect(commandsOn(runPrimitive(project, target, "cmd.setVariable.update", args).after)).toStrictEqual([{ ...variableSet, variableId: sourceId }]);
});

it("셀프 스위치 A로 열리는 다음 페이지나 중첩 조건의 마지막 쓰기 명령을 보호한다", () => {
  const { before, target } = setup("blank", [selfOn]);
  const map = before.maps[mapId]!;
  const event = map.events[0]!;
  const [first, second] = event.pages!;
  const fork: Command = { kind: "fork", condition: { kind: "not", condition: { kind: "selfSwitch", key: "A", value: true } }, then: [text] };
  for (const page of [
    { ...second!, conditions: [{ kind: "selfSwitch", key: "A", value: true }] } satisfies EventPage,
    { ...second!, commands: [fork] },
  ]) {
    const project = { ...before, maps: { ...before.maps, [mapId]: { ...map, events: [{ ...event, pages: [first!, page] }] } } };
    expectRefused(project, target, "cmd.setSelfSwitch.update", checkedUpdate(selfOn, { index: 0, key: "B" }), /셀프 스위치 A를 조건으로/);
    expectRefused(project, target, "cmd.setSelfSwitch.update", checkedUpdate(selfOn, { index: 0, value: false }), /셀프 스위치 A를 조건으로/);
  }
  const { after } = runPrimitive(before, target, "cmd.setSelfSwitch.update", checkedUpdate(selfOn, { index: 0, key: "B" }));
  expect(commandsOn(after)).toStrictEqual([{ ...selfOn, key: "B" }]);
});

it("A로 열리는 페이지 안의 같은 쓰기는 A를 처음 켤 수 없다", () => {
  const { before, target } = setup("blank", [selfOn]);
  const map = before.maps[mapId]!;
  const event = map.events[0]!;
  const [first, second] = event.pages!;
  const gate = { kind: "selfSwitch", key: "A", value: true } as const;
  const locked: EventPage = { ...second!, conditions: [{ kind: "all", conditions: [{ kind: "any", conditions: [gate] }] }], commands: [selfOn] };
  const selected = { ...event, pages: [first!, locked] };
  const project = { ...before, maps: { ...before.maps, [mapId]: { ...map, events: [selected] } } };
  expect(resolveEventPage(selected, startSession(project, 42))?.id).toBe(first!.id);
  expect(resolveEventPage(selected, play(project))?.id).toBe(locked.id);
  const args = checkedUpdate(selfOn, { index: 0, key: "B" });
  expectRefused(project, target, "cmd.setSelfSwitch.update", args, /셀프 스위치 A를 조건으로/);

  const withReplacement = { ...project, maps: { ...project.maps, [mapId]: { ...map, events: [
    { ...selected, pages: [{ ...first!, commands: [selfOn, selfOn] }, locked] },
  ] } } };
  const { after } = runPrimitive(withReplacement, target, "cmd.setSelfSwitch.update", args);
  expect(commandsOn(after)).toStrictEqual([{ ...selfOn, key: "B" }, selfOn]);
  expect(resolveEventPage(after.maps[mapId]!.events[0]!, play(after))?.id).toBe(locked.id);
});

it("A로 잠겼거나 실행이 꺼진 분기의 쓰기는 A를 처음 켤 수 없다", () => {
  const condition = { kind: "selfSwitch", key: "A", value: true } as const;
  const branches: Command[] = [
    { kind: "fork", condition, then: [selfOn] },
    { kind: "fork", condition: { kind: "not", condition }, then: [], else: [selfOn] },
    { kind: "battleProcessing", troopId: "troop_state", canEscape: true, canLose: true, branchOnResult: false, victoryBranch: [selfOn] },
  ];
  for (const command of branches) {
    const gate: Command = { kind: "fork", condition, then: [text] };
    const { before, target } = setup("blank", [selfOn, command, gate]);
    const map = before.maps[mapId]!;
    const event = map.events[0]!;
    const project = { ...before, maps: { ...before.maps, [mapId]: { ...map, events: [{ ...event, pages: [event.pages![0]!] }] } } };
    expectRefused(project, target, "cmd.setSelfSwitch.update", checkedUpdate(selfOn, { index: 0, key: "B" }), /셀프 스위치 A를 조건으로/);
  }
});

it("앞 줄에서 B를 끄면 B가 켜졌을 때만 실행되는 분기는 A를 처음 켤 수 없다", () => {
  const turnOffB: Command = { kind: "setSelfSwitch", key: "B", value: false };
  const branch: Command = { kind: "fork", condition: { kind: "selfSwitch", key: "B", value: true }, then: [selfOn] };
  const commands = [selfOn, turnOffB, branch];
  const { before, target } = setup("blank", commands);
  const map = before.maps[mapId]!;
  const event = map.events[0]!;
  const [first, second] = event.pages!;
  const locked: EventPage = { ...second!, conditions: [{ kind: "selfSwitch", key: "A", value: true }] };
  const withCommands = (list: Command[]) => ({ ...before, maps: { ...before.maps, [mapId]: { ...map, events: [
    { ...event, pages: [{ ...first!, commands: list }, locked] },
  ] } } });
  const args = checkedUpdate(selfOn, { index: 0, key: "C" });
  expectRefused(withCommands(commands), target, "cmd.setSelfSwitch.update", args, /셀프 스위치 A를 조건으로/);

  const { after } = runPrimitive(withCommands([...commands, selfOn]), target, "cmd.setSelfSwitch.update", args);
  expect(commandsOn(after)).toStrictEqual([{ ...selfOn, key: "C" }, turnOffB, branch, selfOn]);
  expect(resolveEventPage(after.maps[mapId]!.events[0]!, play(after))?.id).toBe(locked.id);
});

it("페이지 진입 조건에서 B가 켜져야 하면 B가 꺼진 분기를 대체 쓰기로 세지 않는다", () => {
  const gate = { kind: "selfSwitch", key: "B", value: true } as const;
  const branch: Command = { kind: "fork", condition: { ...gate, value: false }, then: [selfOn] };
  const commands = [selfOn, branch];
  const { before, target } = setup("blank", commands);
  const map = before.maps[mapId]!;
  const event = map.events[0]!;
  const [first, second] = event.pages!;
  const locked: EventPage = { ...second!, conditions: [{ kind: "selfSwitch", key: "A", value: true }] };
  const withPage = (conditions: EventPage["conditions"], list: Command[]) => ({
    ...before, maps: { ...before.maps, [mapId]: { ...map, events: [
      { ...event, pages: [{ ...first!, conditions, commands: list }, locked] },
    ] } },
  });
  const args = checkedUpdate(selfOn, { index: 0, key: "C" });
  expectRefused(withPage([gate], commands), target, "cmd.setSelfSwitch.update", args, /셀프 스위치 A를 조건으로/);

  const replacement = runPrimitive(withPage([gate], [...commands, selfOn]), target, "cmd.setSelfSwitch.update", args).after;
  const session = play(replacement, state => { state.selfSwitches[eventId] = { B: true }; });
  expect(resolveEventPage(replacement.maps[mapId]!.events[0]!, session)?.id).toBe(locked.id);

  const eitherValue: EventPage["conditions"] = [{ kind: "any", conditions: [gate, { ...gate, value: false }] }];
  const unlocked = runPrimitive(withPage(eitherValue, commands), target, "cmd.setSelfSwitch.update", args).after;
  expect(resolveEventPage(unlocked.maps[mapId]!.events[0]!, play(unlocked))?.id).toBe(locked.id);
});

it.each(["showWhen", "enableWhen"] as const)("선택지 %s에서 확인하는 셀프 스위치를 보호한다", field => {
  const condition = { kind: "selfSwitch", key: "A", value: true } as const;
  const choices: Command = { kind: "choices", options: [{ text: "상자 열기", branch: [selfOn], [field]: condition }] };
  const { before, target } = setup("blank", [selfOn, choices]);
  const map = before.maps[mapId]!;
  const event = map.events[0]!;
  const project = { ...before, maps: { ...before.maps, [mapId]: { ...map, events: [{ ...event, pages: [event.pages![0]!] }] } } };
  expectRefused(project, target, "cmd.setSelfSwitch.update", checkedUpdate(selfOn, { index: 0, key: "B" }), /셀프 스위치 A를 조건으로/);
});

it("연달아 호출한 공용 이벤트에서 읽는 셀프 스위치를 보호한다", () => {
  const call: Command = { kind: "callCommonEvent", commonEventId: "common_read_self" };
  const { before, target } = setup("blank", [selfOn, call]);
  const commonEvents: Project["commonEvents"] = [
    { id: "common_read_self", name: "알림", trigger: "none", commands: [{ ...call, commonEventId: "common_nested_self" }] },
    { id: "common_nested_self", name: "상자 확인", trigger: "none", commands: [
      call, { kind: "fork", condition: { kind: "selfSwitch", key: "A", value: true }, then: [text] },
    ] },
  ];
  expectRefused({ ...before, commonEvents }, target, "cmd.setSelfSwitch.update", checkedUpdate(selfOn, { index: 0, key: "B" }), /셀프 스위치 A를 조건으로/);
});

it("호출한 맵 이벤트의 활성 페이지가 읽는 호출자 셀프 스위치를 보호한다", () => {
  const calledId = "ev_state_neighbor";
  const call: Command = { kind: "callMapEvent", eventId: calledId };
  const { before, target } = setup("blank", [selfOn, call]);
  const map = before.maps[mapId]!;
  const [event, called] = map.events;
  const check: Command = { kind: "fork", condition: { kind: "selfSwitch", key: "A", value: true }, then: [switchOn] };
  const project = { ...before, maps: { ...before.maps, [mapId]: { ...map, events: [
    event!, { ...called!, pages: [{ ...called!.pages![0]!, commands: [check] }] },
  ] } } };
  const session = play(project);
  expect(session.switches[switchId]).toBe(true);
  expect(session.selfSwitches[calledId]).toBeUndefined();
  expectRefused(project, target, "cmd.setSelfSwitch.update", checkedUpdate(selfOn, { index: 0, key: "B" }), /셀프 스위치 A를 조건으로/);
});

it("전투를 시작한 이벤트의 셀프 스위치를 부대 조건이 읽으면 기존 쓰기를 보호한다", () => {
  const troop = loadFixture("built").database.troops[0]!;
  const battle: Command = { kind: "battleProcessing", troopId: troop.id, canEscape: true, canLose: true };
  const { before, target } = setup("blank", [selfOn, battle]);
  const gate = { id: "battle_state_gate", name: "상자 확인", conditions: [{ kind: "selfSwitch", key: "A", value: true }],
    span: "battle", commands: [text] } satisfies (typeof troop.battleEventPages)[number];
  const unrelated = { ...troop, id: "troop_unrelated", battleEventPages: [gate] };
  const project = { ...before, database: { ...before.database, troops: [{ ...troop, battleEventPages: [gate] }, unrelated] } };
  const args = checkedUpdate(selfOn, { index: 0, key: "B" });
  expectRefused(project, target, "cmd.setSelfSwitch.update", args, /셀프 스위치 A를 조건으로/);
  const otherBattle = { ...project, database: { ...project.database, troops: [{ ...troop, battleEventPages: [] }, unrelated] } };
  expect(commandsOn(runPrimitive(otherBattle, target, "cmd.setSelfSwitch.update", args).after)[0]).toStrictEqual({ ...selfOn, key: "B" });

  const variableBattle: Command = { ...battle, troopSource: "variable", troopVariableId: variableId };
  const { before: dynamic, target: dynamicTarget } = setup("blank", [selfOn, variableSet, variableBattle]);
  const dynamicProject = { ...dynamic, database: { ...dynamic.database, troops: otherBattle.database.troops } };
  expectRefused(dynamicProject, dynamicTarget, "cmd.setSelfSwitch.update", args, /셀프 스위치 A를 조건으로/);
  expectRefused(dynamicProject, dynamicTarget, "cmd.setVariable.update",
    checkedUpdate(variableSet, { index: 1, variableId: sourceId }), /기존 변수 값을 읽/);
});

it("다른 맵의 같은 식별자가 셀프 스위치 상태를 공유하면 쓰기를 막는다", () => {
  const { before, target } = setup("blank", [selfOn]);
  const map = before.maps[mapId]!;
  const other = { ...map, id: "map_other_state" };
  const project = { ...before, maps: { ...before.maps, [other.id]: other } };
  expectRefused(project, target, "cmd.setSelfSwitch.insert", { key: "A" }, /두 이벤트의 셀프 스위치가 함께 바뀝니다/);
  expectRefused(project, target, "cmd.setSelfSwitch.update", checkedUpdate(selfOn, { index: 0, value: false }), /두 이벤트의 셀프 스위치가 함께 바뀝니다/);
  expect(commandsOn(runPrimitive(project, target, "cmd.setSwitch.insert", { switchId }).after)).toStrictEqual([selfOn, switchOn]);
});

it("중첩 분기 안의 한 줄을 수정하고 다른 분기와 원본은 보존한다", () => {
  const loop: Command = { kind: "loop", body: [text, switchOn] };
  const fork: Command = { kind: "fork", condition: { kind: "selfSwitch", key: "A", value: true }, then: [loop], else: [switchOn] };
  const { before, target } = setup("blank", [fork, wait]);
  const branchPath = [0, FORK_THEN_BRANCH_INDEX, 0, LOOP_BODY_BRANCH_INDEX];
  const { after } = runPrimitive(before, target, "cmd.setSwitch.update", checkedUpdate(switchOn, { branchPath, index: 1, value: false }));
  expect(commandsOn(after)).toStrictEqual([{ ...fork, then: [{ ...loop, body: [text, { ...switchOn, value: false }] }] }, wait]);
  expect(jsonEqual(commandsOn(before), [fork, wait])).toBe(true);
  expectRefused(before, target, "cmd.setSelfSwitch.insert", { branchPath: [0, FORK_THEN_BRANCH_INDEX, 0, FORK_ELSE_BRANCH_INDEX] }, /분기를 찾을 수 없어요/);
  expectRefused(before, target, "cmd.setSelfSwitch.insert", { branchPath: [...branchPath, 0] }, /분기 위치/);
  expectRefused(before, target, "cmd.setSelfSwitch.insert", { branchPath, index: 3 }, /명령 줄을 찾을 수 없습니다/);
  expect(() => runPrimitive(before, target, "cmd.setSwitch.update", checkedUpdate(switchOn, { branchPath, index: 2, value: false }))).toThrow(STALE_COMMAND_LIST);
});

it("두 분기가 명령 배열 하나를 공유하면 추가와 수정을 거절한다", () => {
  const shared = [switchOn];
  const fork: Command = { kind: "fork", condition: { kind: "selfSwitch", key: "A", value: true }, then: shared, else: shared };
  const { before, target } = setup("blank", [fork, wait]);
  expectRefused(before, target, "cmd.setSelfSwitch.insert", { branchPath: [0, FORK_THEN_BRANCH_INDEX] }, /같은 명령 목록/);
  expectRefused(before, target, "cmd.setSwitch.update", checkedUpdate(switchOn, { branchPath: [0, FORK_ELSE_BRANCH_INDEX], index: 0, value: false }), /같은 명령 목록/);
  expect(shared).toStrictEqual([switchOn]);
});

it("빈 이름, 범위 밖 숫자, 0으로 나누기를 거절하고 경계값은 보존한다", () => {
  const { before, target } = setup("blank", [variableSet]);
  expectRefused(before, target, "cmd.setSwitch.insert", { switchId: "  " }, /이름을 입력/);
  expectRefused(before, target, "cmd.setVariable.insert", { variableId, operandVariableId: "  " }, /이름을 입력/);
  const invalidRecord = { ...before, variables: [...before.variables, { id: "", name: "빈 주소" }] };
  expectRefused(invalidRecord, target, "cmd.setVariable.insert", { variableId: "빈 주소" }, /등록된 변수 항목/);
  for (const value of [VARIABLE_MIN - 1, VARIABLE_MAX + 1]) {
    expectRefused(before, target, "cmd.setVariable.insert", { variableId, value }, /9,999,999까지/);
  }
  for (const value of [NaN, Infinity]) {
    expectRefused(before, target, "cmd.setVariable.insert", { variableId, value }, /값의 형식/);
  }
  for (const value of [VARIABLE_MIN, VARIABLE_MAX, 0.5]) {
    const { after } = runPrimitive(before, target, "cmd.setVariable.insert", { variableId, value });
    expect(commandsOn(after).at(-1)).toEqual({ ...variableSet, value });
  }
  expectRefused(before, target, "cmd.setVariable.insert", { variableId, op: "/=", value: 0 }, /0으로 나눌 수 없습니다/);
  expectRefused(before, target, "cmd.setVariable.update", checkedUpdate(variableSet, { index: 0, op: "/=" }), /0으로 나눌 수 없습니다/);
  const { sentence } = runPrimitive(before, target, "cmd.setVariable.insert", { variableId, op: "/=", value: 3 });
  expect(sentence).toBe("『획득 개수』 변수 값을 3으로 나눕니다.");
});

it("기존에 저장된 큰 피연산자는 다른 필드만 고칠 때 보존한다", () => {
  const initial = { ...variableSet, op: "+=", value: VARIABLE_MAX + 1 } satisfies Command;
  const { before, target } = setup("blank", [initial]);
  const { after } = runPrimitive(before, target, "cmd.setVariable.update", checkedUpdate(initial, { index: 0, op: "-=" }));
  expect(commandsOn(after)).toStrictEqual([{ ...initial, op: "-=" }]);
});

it("미리보기에서 원래 이름에 포함된 식별자와 긴 변수 이름을 줄인다", () => {
  const { before, target } = setup("blank", []);
  const project = {
    ...before,
    variables: before.variables.map(record => record.id === variableId
      ? { ...record, name: "var_hidden_reference " + "긴 변수 이름 ".repeat(20) }
      : record.id === sourceId ? { ...record, name: "원본 변수 이름 ".repeat(20) } : record),
  };
  const { sentence } = runPrimitive(project, target, "cmd.setVariable.insert", { variableId, operandVariableId: sourceId });
  expectKoreanSentence(sentence);
  expect(sentence).not.toContain("var_hidden_reference");
  expect(sentence).toContain("…");
});

function play(project: Project, initialize?: (session: ReturnType<typeof startSession>) => void) {
  const session = startSession(project, 42);
  session.currentMapId = mapId;
  initialize?.(session);
  const interpreter = createInterpreter(commandsOn(project), session, project, { currentEventId: eventId });
  expect(interpreter.start()).toEqual({ kind: "done" });
  return session;
}

it("실행 시 원본 변수의 0과 0이 아닌 값에 따라 스위치를 끄고 켠다", () => {
  const { before, target } = setup("blank", []);
  const { after } = runPrimitive(before, target, "cmd.setSwitch.insert", { switchId, operandVariableId: sourceId });
  expect(play(after, session => { session.switches[switchId] = true; session.variables[sourceId] = 0; }).switches[switchId]).toBe(false);
  expect(play(after, session => { session.variables[sourceId] = -3; }).switches[switchId]).toBe(true);
});

it("실행 시 현재 변수 값에 세 개를 더한다", () => {
  const { before, target } = setup("blank", [variableSet]);
  const { after } = runPrimitive(before, target, "cmd.setVariable.update", checkedUpdate(variableSet, { index: 0, op: "+=", value: 3 }));
  expect(play(after, session => { session.variables[variableId] = 4; }).variables[variableId]).toBe(7);
});

it("실행 시 선택한 이벤트의 셀프 스위치만 바뀐다", () => {
  const { before, target } = setup("blank", []);
  const { after } = runPrimitive(before, target, "cmd.setSelfSwitch.insert", { key: "D" });
  const session = play(after, state => { state.selfSwitches.ev_state_neighbor = { D: false }; });
  expect(session.selfSwitches[eventId]).toEqual({ D: true });
  expect(session.selfSwitches.ev_state_neighbor).toEqual({ D: false });
});

it("기존 기억을 고치면 실행 시 스위치가 아닌 기억 상태에 반영한다", () => {
  const { before, target } = setup("blank", [flagOn]);
  const { after } = runPrimitive(before, target, "cmd.setFlag.update", checkedUpdate(flagOn, { index: 0, value: false }));
  const session = play(after, state => { state.flags[flag] = true; });
  expect(session.flags[flag]).toBe(false);
  expect(session.switches).not.toHaveProperty(flag);
});

const legacyRequests = [
  { request: "둘째 줄에 있는 옛날 기억을 꺼 줘.", before: true, args: { value: false }, value: false, name: flag },
  { request: "옛 기억을 끄는 둘째 줄에서 다시 켜도록 수정해 주세요.", before: false, args: { value: true }, value: true, name: flag },
  { request: "둘째 줄 기억 이름만 ‘상자 확인’으로 고쳐줘.", before: true, args: { flag: "상자 확인" }, value: true, name: "상자 확인" },
  { request: "예전 방식의 기억 이름을 ‘잠금 해제’로 바꾼 뒤 켜 주세요.", before: false, args: { flag: "잠금 해제", value: true }, value: true, name: "잠금 해제" },
  { request: "둘째줄 기억을 ‘구역 통과’로 바꾸고 꺼.", before: true, args: { flag: "구역 통과", value: false }, value: false, name: "구역 통과" },
  { request: "꺼진 옛기억 이름만 ‘탐색 완료’로 바꿔 주세요.", before: false, args: { flag: "탐색 완료" }, value: false, name: "탐색 완료" },
];

it.each(legacyRequests)("$request", ({ before: valueBefore, args, value, name }) => {
  const initial = { ...flagOn, value: valueBefore };
  const { before, target } = setup("blank", [text, initial, wait]);
  const { after, sentence } = runPrimitive(before, target, "cmd.setFlag.update", checkedUpdate(initial, { index: 1, ...args }));
  expect(commandsOn(after)).toStrictEqual([text, { kind: "setFlag", flag: name, value }, wait]);
  expectKoreanSentence(sentence, target);
  if (name !== flag) {
    expect(sentence).toBe(value === valueBefore
      ? "이전 방식의 기억 이름을 바꿉니다."
      : `이전 방식의 기억 이름을 바꾸고 ${value ? "켭니다." : "끕니다."}`);
  }
});

it("오프닝 종료에 연결된 기억의 이름 변경을 거절하고 기존 명령으로 무대를 끝낸다", () => {
  const stageFlag = openingStageFlag(mapId, eventId);
  const stageEnd = { ...flagOn, flag: stageFlag, value: false };
  const { before, target } = setup("blank", [stageEnd]);
  expectRefused(before, target, "cmd.setFlag.update", checkedUpdate(stageEnd, { index: 0, flag: "무대 끝" }), /게임이 사용하는 기억 이름/);
  expectRefused(before, target, "cmd.setFlag.update", checkedUpdate(stageEnd, { index: 0, value: true }), /게임이 제어하는 기억의 켜짐 상태/);
  expect(commandsOn(before)).toStrictEqual([stageEnd]);
  expect(commandsOn(runPrimitive(before, target, "cmd.setFlag.update", checkedUpdate(stageEnd, { index: 0, value: false })).after))
    .toStrictEqual([stageEnd]);
  const session = play(before, state => { state.flags[stageFlag] = true; });
  expect(openingStageEventId(session.flags, mapId)).toBeUndefined();
});

it("시작 상태나 공용 이벤트·부대에서 쓰는 기억 이름을 떼거나 가져오기를 거절한다", () => {
  const { before, target } = setup("blank", [flagOn]);
  const troop = loadFixture("built").database.troops[0]!;
  const common = { id: "common_memory", name: "공용 기억", trigger: "none" as const, commands: [{ ...flagOn }] };
  const sharedInCommon = { ...before, commonEvents: [...before.commonEvents, common] };
  const sharedInTroop = { ...before, database: { ...before.database, troops: [{ ...troop, afterBattle: { victory: [{ ...flagOn, flag: "부대 기억" }] } }] } };
  expectRefused({ ...before, flags: { ...before.flags, [flag]: false } }, target, "cmd.setFlag.update", checkedUpdate(flagOn, { index: 0, flag: "새 이름" }), /게임이 사용하는 기억 이름/);
  expectRefused(sharedInCommon, target, "cmd.setFlag.update", checkedUpdate(flagOn, { index: 0, flag: "새 이름" }), /다른 명령에서도/);
  expectRefused(sharedInTroop, target, "cmd.setFlag.update", checkedUpdate(flagOn, { index: 0, flag: "부대 기억" }), /다른 명령에서도/);
  expectRefused(before, target, "cmd.setFlag.update", checkedUpdate(flagOn, { index: 0, flag: "ngplus" }), /게임이 사용하는 기억 이름/);
  expectRefused(before, target, "cmd.setFlag.update", checkedUpdate(flagOn, { index: 0, flag: "  " }), /기억 이름을 입력/);
});

it("열린 초안과 그 저장본에서 옛 기억 이름의 충돌을 각각 검사한다", () => {
  const { before, target } = setup("blank", [flagOn]);
  const map = before.maps[mapId]!;
  const [event, neighbor] = map.events;
  const nextFlag = "renamed_memory";
  const args = checkedUpdate(flagOn, { index: 0, flag: nextFlag });
  const withCommands = (commands: Command[]): GameEvent => ({
    ...neighbor!, pages: [{ ...neighbor!.pages![0]!, commands }],
  });
  for (const [saved, working] of [[[], [flagOn]], [[{ ...flagOn, flag: nextFlag }], []]]) {
    const original = withCommands(saved!);
    const draft = { ...withCommands(working!), draft: { kind: "edit" as const, original } };
    const project = { ...before, maps: { ...before.maps, [mapId]: { ...map, events: [event!, original] } } };
    const live = { maps: { [mapId]: { events: [event!, draft] } } };
    expect(() => runPrimitive(project, target, "cmd.setFlag.update", args, undefined, live)).toThrow(/다른 명령에서도/);
  }
  const { after } = runPrimitive(before, target, "cmd.setFlag.update", args);
  expect(commandsOn(after)).toStrictEqual([{ ...flagOn, flag: nextFlag }]);
});

it("분기 안에서 고른 초안의 기억 이름을 저장본 이름으로 되돌릴 수 있다", () => {
  const draftFlag = { ...flagOn, flag: "draft_memory" };
  const loop: Command = { kind: "loop", body: [text, draftFlag] };
  const { before: live, target } = setup("blank", [loop, wait]);
  const [event, neighbor] = live.maps[mapId]!.events;
  const [page, otherPage] = event!.pages!;
  const savedLoop = { ...loop, body: [text, flagOn] };
  const original = { ...event!, pages: [{ ...page!, commands: [savedLoop, wait] }, otherPage!] };
  const draft = { ...event!, draft: { kind: "edit" as const, original } };
  live.maps[mapId]!.events = [draft, neighbor!];
  const args = checkedUpdate(draftFlag, { branchPath: [0, LOOP_BODY_BRANCH_INDEX], index: 1, flag });

  for (const project of [live, smallTaskBase(live, target)]) {
    const { after } = runPrimitive(project, target, "cmd.setFlag.update", args, undefined, live);
    expect(commandsOn(after)).toStrictEqual([savedLoop, wait]);
  }
  expect(commandsOn(live)).toStrictEqual([loop, wait]);
});

it.each([flag, "draft_memory"])("선택한 초안의 저장본에서 다른 줄이 쓰는 기억 %s는 거절한다", name => {
  const draftFlag = { ...flagOn, flag: "draft_memory" };
  const { before: live, target } = setup("blank", [draftFlag]);
  const [event, neighbor] = live.maps[mapId]!.events;
  const [page, otherPage] = event!.pages!;
  const original = { ...event!, pages: [
    { ...page!, commands: [flagOn] }, { ...otherPage!, commands: [{ ...flagOn, flag: name }] },
  ] };
  live.maps[mapId]!.events = [{ ...event!, draft: { kind: "edit", original } }, neighbor!];
  const project = smallTaskBase(live, target);
  const args = checkedUpdate(draftFlag, { index: 0, flag });
  expect(() => runPrimitive(project, target, "cmd.setFlag.update", args, undefined, live)).toThrow(/다른 명령에서도/);
});

it("기존 기억 명령은 공용 한 줄 삭제로 제거하고 되돌릴 수 있다", async () => {
  const { before, target } = setup("blank", [text, flagOn, wait]);
  expect(() => runPrimitive(before, target, "cmd.delete", { index: 1, expectedHash: eventCommandHash(wait) })).toThrow(STALE_COMMAND_LIST);
  const { after } = runPrimitive(before, target, "cmd.delete", { index: 1, expectedHash: eventCommandHash(flagOn) });
  expect(commandsOn(after)).toStrictEqual([text, wait]);
  await expectUndoRestores(before, after, target);
});
