/** @vitest-environment happy-dom */
import { expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES, buildConditionAny, buildConditionNot } from "@/editor/smallTask/primitives/units/15-cond-state-party";
import { createInterpreter } from "@/player/interpreter";
import { findFacedItemTarget } from "@/player/itemUseOnTarget";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { resolveEventPage } from "@/project/io/pageResolution";
import { startSession } from "@/project/session";
import type { Condition, ConditionCompareOp, EventPage, GameEvent, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import corpus from "../../harness-data/small-task-corpus/15-cond-state-party.json";
import { eventTarget, expectKoreanSentence, expectRefused, expectUndoRestores, loadFixture } from "./harness";

const mapId = "map_condition_test";
const eventId = "ev_condition_test";
const pageId = "page_condition_test";
const keyId = "item_condition_key";
const rewardId = "item_condition_reward";
const switchId = "sw_condition_door";

function getEvent(project: Project, map: string, event: string): GameEvent {
  const found = project.maps[map].events.find(entry => entry.id === event);
  if (!found) throw new Error("테스트 이벤트를 찾을 수 없어요.");
  return found;
}

function getPage(event: GameEvent, id: string): EventPage {
  const page = event.pages?.find(entry => entry.id === id);
  if (!page) throw new Error("테스트 페이지를 찾을 수 없어요.");
  return page;
}

const sourceFixtures = {
  built: Promise.resolve().then(() => loadFixture("built")),
  maou: Promise.resolve().then(() => loadFixture("maou")),
};

it.each(PRIMITIVES)("저장값과 한 번 되돌리기 확인 · $id", async primitive => {
  const scenario = corpus.find(entry => entry.primitive === primitive.id && entry.expect);
  if (!scenario?.expect) throw new Error("성공 사례를 찾을 수 없어요.");
  const source = scenario.fixture as keyof typeof sourceFixtures;
  const before = await sourceFixtures[source];
  const { mapId, eventId, pageId } = scenario.target;
  const selection = eventTarget(before, mapId, eventId, pageId);
  const original = getEvent(before, mapId, eventId);
  const snapshot = structuredClone(original);

  const { after, sentence } = runPrimitive(before, selection, primitive.id, scenario.args);
  const edited = getEvent(after, mapId, eventId);
  const changedPage = getPage(edited, pageId);
  expect(changedPage.conditions).toEqual(scenario.expect[0].equals);
  expect(original).toEqual(snapshot);
  expect(edited).toEqual({
    ...snapshot,
    pages: snapshot.pages?.map(page => page.id === pageId ? { ...page, conditions: changedPage.conditions } : page),
  });
  expect(after.database).toBe(before.database);
  expectKoreanSentence(sentence, selection);
  expect(sentence).toMatch(/^[^.\n!?]+\.$/u);
  await expectUndoRestores(before, after, selection);
}, 20_000);

it.each(PRIMITIVES)("범위 밖 조작과 잘못된 입력 거절 · $id", async primitive => {
  const scenario = corpus.find(entry => entry.primitive === primitive.id && entry.expect);
  const invalid = corpus.find(entry => entry.primitive === primitive.id && entry.expectRefusal);
  if (!scenario || !invalid) throw new Error("실패 사례를 찾을 수 없어요.");
  const before = await sourceFixtures[scenario.fixture as keyof typeof sourceFixtures];
  const { mapId, eventId, pageId } = scenario.target;
  const selection = eventTarget(before, mapId, eventId, pageId);
  const escaped = {
    ...scenario.args,
    ...(primitive.id === "cond.all.page.set" || primitive.id === "cond.any.page.set"
      ? { conditionNumbers: [999] }
      : { conditionNumber: 999 }),
  };
  expectRefused(before, selection, primitive.id, escaped);
  const invalidBefore = await sourceFixtures[invalid.fixture as keyof typeof sourceFixtures];
  const invalidTarget = eventTarget(invalidBefore, invalid.target.mapId, invalid.target.eventId, invalid.target.pageId);
  expectRefused(invalidBefore, invalidTarget, primitive.id, invalid.args, /[가-힣]/u);
  expect(() => runPrimitive(before, selection, primitive.id, { ...scenario.args, mapId: "map_elsewhere" })).toThrow();

  const scope = primitive.scope({ project: before, target: selection }, scenario.args);
  const map = before.maps[mapId];
  const events = map.events.map(event => event.id !== eventId ? event : {
    ...event,
    pages: event.pages?.map(page => ({ ...page, name: "다른 페이지 속성 덮어쓰기" })),
  });
  const outOfScope = { ...before, maps: { ...before.maps, [mapId]: { ...map, events } } };
  expect(checkSmallTaskScope(before, outOfScope, scope)).toMatchObject({ ok: false, reason: expect.stringContaining("범위 밖") });
});

async function blankPage(conditions: Condition[] = [], trigger: EventPage["trigger"] = { kind: "action" }) {
  const seed = await loadFixture("blank");
  const map = { ...createBlankMap("조건 시험장", 8, 8), id: mapId };
  const page: EventPage = {
    id: pageId, name: "보상 페이지", conditions, trigger, graphic: {},
    priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [{ kind: "changeItem", itemId: rewardId, op: "+=", amount: 3 }],
  };
  const fallback: EventPage = { ...page, id: "fallback", name: "기본 페이지", conditions: [], commands: [] };
  const event: GameEvent = { id: eventId, name: "보상 상자", x: 3, y: 3, commands: [], trigger: { kind: "action" }, pages: [fallback, page] };
  const before: Project = {
    ...seed,
    maps: { ...seed.maps, [mapId]: { ...map, events: [event] } },
    startMapId: mapId,
    startPos: { x: 3, y: 4 },
    mapTree: { mapId, children: [] },
    switches: [...seed.switches, { id: switchId, name: "보상실 개방" }],
    database: {
      ...seed.database,
      items: [
        ...seed.database.items,
        normalizeItemRecord({ id: keyId, name: "보상실 열쇠" }),
        normalizeItemRecord({ id: rewardId, name: "보상 물약" }),
      ],
    },
  };
  return { before, selection: eventTarget(before, mapId, eventId, pageId) };
}

function givesReward(after: Project, state: Parameters<typeof resolveEventPage>[1], expected: boolean) {
  const event = getEvent(after, mapId, eventId);
  const session = Object.assign(startSession(after, 15), state);
  const page = resolveEventPage(event, session);
  expect(page?.id).toBe(expected ? pageId : "fallback");
  expect(createInterpreter(page!.commands, session, after, { currentEventId: eventId }).start()).toEqual({ kind: "done" });
  expect(session.inventory[rewardId] ?? 0).toBe(expected ? 3 : 0);
}

it("정확히 백 골드일 때는 닫히고 백한 골드면 물약 세 개를 받는다", async () => {
  const { before, selection } = await blankPage();
  const { after } = runPrimitive(before, selection, "cond.gold.page.set", { op: ">", amount: 100 });
  givesReward(after, { switches: {}, variables: {}, gold: 100 }, false);
  givesReward(after, { switches: {}, variables: {}, gold: 101 }, true);
});

it("낡은 열쇠를 보유했을 때와 상자에 직접 사용했을 때를 구별한다", async () => {
  const { before, selection } = await blankPage();
  const { after } = runPrimitive(before, selection, "cond.itemUsed.page.set", { itemId: keyId });
  givesReward(after, { switches: {}, variables: {}, inventory: { [keyId]: 1 } }, false);
  const session = startSession(after, 15);
  session.inventory[keyId] = 1;
  const useOnChest = (itemId: string) => findFacedItemTarget(after, after.maps[mapId], session, {}, { x: 3, y: 4, facing: "up" }, itemId);
  expect(useOnChest(rewardId)).toBeUndefined();
  const target = useOnChest(keyId);
  expect(target?.page.id).toBe(pageId);
  expect(session.itemUsedId).toBeUndefined();
  expect(createInterpreter(target!.page.commands, session, after, { currentEventId: eventId }).start()).toEqual({ kind: "done" });
  expect(session.inventory[rewardId]).toBe(3);
});

it.each(["auto", "parallel", "locationTransition"] as const)("메뉴에서 찾을 수 없는 시작 방식(%s)에 아이템 사용 조건을 걸지 않는다", async kind => {
  const trigger = kind === "locationTransition" ? { kind, locationId: "room", transition: "enter" } as const : { kind };
  const { before, selection } = await blankPage([], trigger);
  expectRefused(before, selection, "cond.itemUsed.page.set", { itemId: keyId }, /시작 방식/u);
});

it("두 조건 중 하나만 맞아도 보상을 받는 묶음으로 바꾼다", async () => {
  const { before, selection } = await blankPage([
    { kind: "item", itemId: keyId, present: true },
    { kind: "switch", switchId, value: true },
  ]);
  const { after } = runPrimitive(before, selection, "cond.any.page.set", { conditionNumbers: [2, 1] });
  givesReward(after, { switches: {}, variables: {}, inventory: {} }, false);
  givesReward(after, { switches: { [switchId]: true }, variables: {}, inventory: {} }, true);
  givesReward(after, { switches: {}, variables: {}, inventory: { [keyId]: 1 } }, true);
});

it("범위 안에서 같은 종류의 여러 조건 중 지정한 줄만 바꾼다", async () => {
  const first = { kind: "selfSwitch", key: "A", value: true } as const;
  const second = { kind: "selfSwitch", key: "B", value: false } as const;
  const { before, selection } = await blankPage([first, second]);
  const run = (args: Record<string, unknown>) => runPrimitive(before, selection, "cond.selfSwitch.page.set", args);
  expect(() => run({ key: "C" })).toThrow("여러 줄");
  expect(() => runPrimitive(before, selection, "cond.gold.page.set", { amount: 25, conditionNumber: 2 })).toThrow("조건 종류가 달라요");
  const { after } = run({ key: "C", value: true, conditionNumber: 2 });
  expect(getPage(getEvent(after, mapId, eventId), pageId).conditions).toEqual([
    first, { kind: "selfSwitch", key: "C", value: true },
  ]);
});

it("선택한 맵의 키와 레코드 ID가 달라지면 다른 맵의 페이지를 덮어쓰지 않는다", async () => {
  const { before, selection } = await blankPage();
  const otherMapId = "map_other";
  const map = before.maps[mapId];
  const inconsistent = { ...before, maps: {
    ...before.maps,
    [mapId]: { ...map, id: otherMapId },
    [otherMapId]: { ...map, id: otherMapId, events: structuredClone(map.events) },
  } };
  const primitive = PRIMITIVES.find(row => row.id === "cond.gold.page.set")!;
  const ctx = { project: inconsistent, target: selection };
  expect(primitive.scope(ctx, {})).toMatchObject({ mapId, eventId, pageId, field: "conditions" });
  expect(() => primitive.apply(ctx, { amount: 10 })).toThrow("선택한 맵을 다시 골라 주세요");
  expect(getPage(getEvent(inconsistent, otherMapId, eventId), pageId).conditions).toEqual([]);
});

it("페이지가 지정되지 않았거나 하나로 확인되지 않으면 같은 이벤트의 다른 페이지를 고치지 않는다", async () => {
  const { before, selection } = await blankPage();
  const event = getEvent(before, mapId, eventId);
  const page = getPage(event, pageId);
  expectRefused(before, { ...selection, pageId: undefined }, "cond.gold.page.set", { amount: 10 });
  expectRefused(before, { ...selection, pageId: "missing_page" }, "cond.gold.page.set", { amount: 10 });
  event.pages!.push({ ...page, name: "같은 ID의 다른 페이지" });
  const snapshot = structuredClone(event.pages);
  expectRefused(before, selection, "cond.gold.page.set", { amount: 10 });
  expect(event.pages).toEqual(snapshot);
});

it("페이지 조건을 제거해도 다른 페이지와 명령의 중첩 조건 분기를 보존한다", async () => {
  const condition: Condition = { kind: "item", itemId: keyId, present: true };
  const { before, selection } = await blankPage([condition]);
  const original = getEvent(before, mapId, eventId);
  const page = getPage(original, pageId);
  page.commands = [{ kind: "fork", condition, then: page.commands, else: [{ kind: "wait", ms: 1000 }] }];
  const snapshot = structuredClone(original);

  expect(() => runPrimitive(before, selection, "cond.page.remove", { conditionNumber: 1, branchPath: [0, 1] })).toThrow("형식");
  const { after } = runPrimitive(before, selection, "cond.page.remove", { conditionNumber: 1 });
  expect(original).toEqual(snapshot);
  expect(getEvent(after, mapId, eventId)).toEqual({ ...snapshot, pages: [snapshot.pages![0], { ...snapshot.pages![1], conditions: [] }] });
});

it.each<{ condition: Condition; reason: RegExp }>([
  { condition: { kind: "insideLocation", locationId: "missing_room", inside: true }, reason: /장소를 찾을 수 없어요/u },
  { condition: { kind: "pursuitActive", eventId: "missing_guard", value: true }, reason: /추격 조건.*이벤트를 찾을 수 없어요/u },
  { condition: { kind: "eventSeesPlayer", eventId: "missing_guard" }, reason: /시야 조건.*이벤트를 찾을 수 없어요/u },
  { condition: { kind: "eventSeesPlayer", eventId: "", watchers: { locationId: "missing_room" } }, reason: /시야 조건.*장소를 찾을 수 없어요/u },
  { condition: { kind: "eventSeesPlayer", eventId: "", watchers: {} }, reason: /주인공을 볼 이벤트를 골라 주세요/u },
  { condition: { kind: "gold", op: "invalid" as ConditionCompareOp, amount: 10 }, reason: /비교 방법을 다시 골라 주세요/u },
])("잘못된 $condition.kind 조건을 반대로 바꿔 페이지를 열 수 없다", async ({ condition, reason }) => {
  const { before, selection } = await blankPage([{ kind: "all", conditions: [condition] }]);
  expectRefused(before, selection, "cond.not.page.set", { conditionNumber: 1 }, reason);
  expect(() => runPrimitive(before, selection, "cond.page.remove", { conditionNumber: 1 })).not.toThrow();
});

it("다른 맵에서 올 수 있는 이벤트가 지정된 추격 조건은 묶을 수 있다", async () => {
  const guardId = "ev_condition_guard";
  const condition: Condition = { kind: "pursuitActive", eventId: guardId, value: true };
  const { before, selection } = await blankPage([condition]);
  const other = createBlankMap("경비 출발 지점", 8, 8);
  const guard: GameEvent = { id: guardId, x: 3, y: 3, commands: [], trigger: { kind: "action" } };
  const project = { ...before, maps: { ...before.maps, [other.id]: { ...other, events: [guard] } } };
  const { after } = runPrimitive(project, selection, "cond.not.page.set", { conditionNumber: 1 });
  expect(getPage(getEvent(after, mapId, eventId), pageId).conditions).toEqual([{ kind: "not", condition }]);
  expect(after.maps[other.id]).toBe(project.maps[other.id]);
});

it("중첩 명령에서 생성할 이벤트가 지정된 시야 조건은 묶을 수 있다", async () => {
  const condition: Condition = { kind: "eventSeesPlayer", eventId: "ev_condition_test_spawn" };
  const { before, selection } = await blankPage([condition]);
  const page = getPage(getEvent(before, mapId, eventId), pageId);
  page.commands.push({
    kind: "fork", condition: { kind: "switch", switchId, value: true },
    then: [{ kind: "m2Command", commandId: "m2-203-spawn-event", fields: { templateEventId: eventId, x: 2, y: 3 } }],
  });
  const { after } = runPrimitive(before, selection, "cond.not.page.set", { conditionNumber: 1 });
  expect(getPage(getEvent(after, mapId, eventId), pageId)).toEqual({ ...page, conditions: [{ kind: "not", condition }] });
});

it.each(["constructor", "__proto__", "toString"])("기본 속성 이름(%s)을 문자열 변수로 받지 않는다", async stringVariableId => {
  const { before, selection } = await blankPage();
  expectRefused(before, selection, "cond.stringVariable.page.set", { stringVariableId, op: "contains", value: "열쇠" }, /다른 이름/u);
});

it.each([["==", true, "비어 있음"], ["!=", false, "비어 있지 않음"]] as const)("빈 문자열 비교(%s)의 판정과 설명이 일치한다", async (op, matchesEmpty, detail) => {
  const { before, selection } = await blankPage();
  const { after, sentence } = runPrimitive(before, selection, "cond.stringVariable.page.set", { stringVariableId: "암호", op, value: "" });
  expect(sentence).toContain(`「암호」의 값이 ${detail}`);
  givesReward(after, { switches: {}, variables: {} }, matchesEmpty);
  const session = startSession(after, 15);
  session.stringVariables = { 암호: "열쇠" };
  givesReward(after, session, !matchesEmpty);
});

it("나중에 조건 분기에서도 쓸 묶음 빌더가 기존 조건 객체를 보존한다", () => {
  const children: Condition[] = [{ kind: "item", itemId: keyId, present: true }];
  const before = structuredClone(children);
  const group = buildConditionAny({ conditions: children });
  const inverted = buildConditionNot({ condition: group });
  group.conditions.splice(0);
  expect(jsonEqual(children, before)).toBe(true);
  expect(inverted).toEqual({ kind: "not", condition: { kind: "any", conditions: before } });
});
