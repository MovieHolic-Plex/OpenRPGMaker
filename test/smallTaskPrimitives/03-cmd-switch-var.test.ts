/** @vitest-environment happy-dom */
import { expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { FORK_ELSE_BRANCH_INDEX, FORK_THEN_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/03-cmd-switch-var";
import { createInterpreter } from "@/player/interpreter";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { eventCommandHash } from "@/project/eventCommands/singleCommandOps";
import { startSession } from "@/project/session";
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
  map.events = [event, { ...event, id: "ev_state_neighbor", name: "옆 상자" }];
  const before: Project = {
    ...project, maps: { ...project.maps, [mapId]: map },
    startMapId: starter ? project.startMapId : mapId,
    startPos: starter ? project.startPos : { x: 2, y: 2 },
    mapTree: starter ? project.mapTree : { mapId, children: [] },
    switches: [...project.switches, { id: switchId, name: "문 잠금" }],
    variables: [...project.variables, { id: variableId, name: "획득 개수" }, { id: sourceId, name: "보상 개수" }],
  };
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

const cases: {
  id: string; fixture: Fixture; initial?: Command; args: Record<string, unknown>;
  stored: Command; sentence: string;
}[] = [
  { id: "cmd.setSwitch.insert", fixture: "blank", args: { switchId: " 문 잠금 ", index: 1 }, stored: switchOn, sentence: "『문 잠금』 스위치를 켭니다." },
  { id: "cmd.setSwitch.update", fixture: "built", initial: switchOn,
    args: { index: 1, value: "toggle", expectedHash: eventCommandHash(switchOn) },
    stored: { ...switchOn, value: "toggle" }, sentence: "『문 잠금』 스위치를 반전합니다." },
  { id: "cmd.setVariable.insert", fixture: "maou", args: { variableId: "획득 개수", index: 1 }, stored: variableSet,
    sentence: "『획득 개수』 변수에 0을 저장합니다." },
  { id: "cmd.setVariable.update", fixture: "built", initial: variableSet,
    args: { index: 1, op: "+=", operandVariableId: "보상 개수" },
    stored: { ...variableSet, op: "+=", value: { kind: "var", id: sourceId } },
    sentence: "『획득 개수』 변수 값에 『보상 개수』 값을 더합니다." },
  { id: "cmd.setSelfSwitch.insert", fixture: "blank", args: { index: 1 }, stored: selfOn,
    sentence: "이 이벤트의 셀프 스위치 A를 켭니다." },
  { id: "cmd.setSelfSwitch.update", fixture: "built", initial: selfOn, args: { index: 1, value: false },
    stored: { ...selfOn, value: false }, sentence: "이 이벤트의 셀프 스위치 A를 끕니다." },
  { id: "cmd.setFlag.insert", fixture: "blank", args: { index: 1, switchId, value: false },
    stored: { ...switchOn, value: false }, sentence: "『문 잠금』 스위치를 끕니다." },
  { id: "cmd.setFlag.update", fixture: "built", initial: flagOn, args: { index: 1, value: false },
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

it.each([
  { id: "cmd.setSwitch.insert", args: { switchId: "새 스위치" } },
  { id: "cmd.setVariable.insert", args: { variableId: "새 변수", value: 2 } },
  { id: "cmd.setSwitch.update", args: { index: 0, operandVariableId: "없는 원본 변수" } },
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
  expect(() => runPrimitive(before, target, "cmd.setSwitch.update", { index: 0, value: false, expectedHash: "outdated" })).toThrow(/내용이 바뀌었습니다/);
  expect(() => runPrimitive(before, target, "cmd.setSwitch.update", { index: 1, value: false })).toThrow(/같은 종류/);
  expect(() => runPrimitive(before, target, "cmd.setSwitch.update", { index: 0, value: false, operandVariableId: sourceId })).toThrow(/하나만/);
});

it("없는 변수 참조를 물려받는 부분 수정은 거절하고, 해당 참조를 고치는 요청은 적용한다", () => {
  const orphan: Command = { ...variableSet, value: { kind: "var", id: "var_gone" } };
  const { before, target } = setup("blank", [orphan]);
  expect(() => runPrimitive(before, target, "cmd.setVariable.update", { index: 0, op: "+=" })).toThrow(/자료집에서 찾을 수 없습니다/);
  const { after } = runPrimitive(before, target, "cmd.setVariable.update", { index: 0, value: 3 });
  expect(commandsOn(after)).toStrictEqual([{ ...orphan, value: 3 }]);
});

it("선택한 분기 안의 한 줄을 수정하고, 없는 분기는 거절한다", () => {
  const fork: Command = { kind: "fork", condition: { kind: "selfSwitch", key: "A", value: true }, then: [text, switchOn] };
  const { before, target } = setup("blank", [fork, wait]);
  const { after } = runPrimitive(before, target, "cmd.setSwitch.update", { branchPath: [0, FORK_THEN_BRANCH_INDEX], index: 1, value: false });
  expect(commandsOn(after)).toStrictEqual([{ ...fork, then: [text, { ...switchOn, value: false }] }, wait]);
  expect(jsonEqual(commandsOn(before), [fork, wait])).toBe(true);
  expect(() => runPrimitive(before, target, "cmd.setSelfSwitch.insert", { branchPath: [0, FORK_ELSE_BRANCH_INDEX] })).toThrow(/분기를 찾을 수 없어요/);
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
  const { after } = runPrimitive(before, target, "cmd.setVariable.update", { index: 0, op: "+=", value: 3 });
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
  const { after } = runPrimitive(before, target, "cmd.setFlag.update", { index: 0, value: false });
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
  const { before, target } = setup("blank", [text, { ...flagOn, value: valueBefore }, wait]);
  const { after, sentence } = runPrimitive(before, target, "cmd.setFlag.update", { index: 1, ...args });
  expect(commandsOn(after)).toStrictEqual([text, { kind: "setFlag", flag: name, value }, wait]);
  expectKoreanSentence(sentence, target);
  if (name !== flag) {
    expect(sentence).toBe(value === valueBefore
      ? "이전 방식의 기억 이름을 바꿉니다."
      : `이전 방식의 기억 이름을 바꾸고 ${value ? "켭니다." : "끕니다."}`);
  }
});

it("기존 기억 명령은 공용 한 줄 삭제로 제거하고 되돌릴 수 있다", async () => {
  const { before, target } = setup("blank", [text, flagOn, wait]);
  const { after } = runPrimitive(before, target, "cmd.delete", { index: 1, expectedHash: eventCommandHash(flagOn) });
  expect(commandsOn(after)).toStrictEqual([text, wait]);
  await expectUndoRestores(before, after, target);
});
