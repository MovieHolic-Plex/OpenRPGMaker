/** @vitest-environment happy-dom */
import { expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES, buildConditionAny, buildConditionNot } from "@/editor/smallTask/primitives/units/15-cond-state-party";
import { createInterpreter } from "@/player/interpreter";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { resolveEventPage } from "@/project/io/pageResolution";
import { startSession } from "@/project/session";
import type { Condition, EventPage, GameEvent, Project } from "@/project/types";
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
  expectRefused(before, selection, primitive.id, invalid.args, /[가-힣]/u);
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

async function blankPage(conditions: Condition[] = []) {
  const seed = await loadFixture("blank");
  const map = { ...createBlankMap("조건 시험장", 8, 8), id: mapId };
  const page: EventPage = {
    id: pageId, name: "보상 페이지", conditions, trigger: { kind: "action" }, graphic: {},
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
  givesReward(after, { switches: {}, variables: {}, itemUsedId: keyId }, true);
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
  const { after } = run({ key: "C", value: true, conditionNumber: 2 });
  expect(getPage(getEvent(after, mapId, eventId), pageId).conditions).toEqual([
    first, { kind: "selfSwitch", key: "C", value: true },
  ]);
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
