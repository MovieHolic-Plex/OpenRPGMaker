/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/27-quests";
import { mapTarget } from "@/editor/smallTask/target";
import { createBlankProject } from "@/project/defaults/blankProject";
import { startSession } from "@/project/session";
import { questFlagIds, type QuestDef, type QuestGraphDef } from "@/project/quest/questDef";
import type { GameEvent, Project } from "@/project/types";
import { buildQuestLog } from "@/player/questLog";
import { jsonEqual } from "@/util/structuralJson";
import { expectUndoRestores, loadFixture, runHeadless } from "./harness";

const RUMOR = "q_snow_rumor";
const PATROL = "q_ice_patrol";
const MARKET = "map_5eec6ba0-1ac1-48ab-9d7f-db5032670b4c";

function textHasNoIds(sentence: string) {
  expect(sentence).toMatch(/[가-힣]/u);
  expect(sentence).toMatch(/[가-힣]니다\.$/u);
  expect(sentence.length).toBeLessThanOrEqual(80);
  expect(sentence).not.toMatch(/[\[\]{}]|\b[a-z][\w]*_[\w.-]+|[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}/iu);
}

function stepQuest(project: Project, key: string): QuestDef {
  const quest = project.quests?.find(entry => "key" in entry && entry.key === key);
  if (!quest || !("steps" in quest)) throw new Error("단계형 퀘스트가 필요합니다.");
  return quest;
}

function built() {
  const before = loadFixture("built");
  const target = mapTarget(before, before.startMapId, "ev_supply_shop")!;
  return { before, target };
}

function blank() {
  const project = loadFixture("blank");
  const source = createBlankProject();
  const mapId = project.startMapId || source.startMapId;
  const map = project.maps[mapId] ?? source.maps[mapId];
  const flags = questFlagIds("quest_1", 2);
  const commands: GameEvent["commands"] = [
    { kind: "setSwitch", switchId: flags.started, value: true },
    { kind: "setSwitch", switchId: flags.stepSwitches[0], value: true },
    { kind: "changeGold", op: "+=", amount: 20 },
  ];
  const event: GameEvent = {
    id: "ev_mayor", name: "촌장", x: 1, y: 1, trigger: { kind: "action" }, commands: [],
    pages: [{
      id: "ev_mayor_page", name: "촌장", trigger: { kind: "action" }, commands,
      conditions: [], graphic: {}, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 },
    }],
  };
  const before: Project = {
    ...project,
    startMapId: mapId,
    startPos: { x: 0, y: 0 },
    mapTree: { mapId, children: [] },
    maps: { ...project.maps, [mapId]: { ...map, events: [event] } },
    switches: [...project.switches, ...[flags.started, flags.stepSwitches[0]].map(id => ({ id, name: "의뢰 진행" }))],
  };
  const target = mapTarget(before, mapId, event.id)!;
  const objective = { kind: "reach" as const, mapId, x: 2, y: 2, label: "우물에 도착" };
  const quest = {
    key: "quest_1", title: "촌장의 부탁", summary: "", order: "sequence" as const,
    giver: { mapId, eventId: event.id }, steps: [objective, { ...objective, x: 3, label: "문으로 가기" }],
    rewards: { gold: 20 },
  };
  return { before, target, objective, event, quest, flags };
}

describe("퀘스트 원시 기능", () => {
  it("선택한 이벤트에 첫 목표를 포함한 정의 한 건을 만들고 한 번에 되돌린다", async () => {
    const { before, target, objective, quest } = blank();
    const args = { title: "  새 퀘스트 ", summary: "촌장의 이야기를 듣고 우물로 간다.", objective };
    const { after, sentence } = runPrimitive(before, target, "quest.create", args);
    expect(after.quests).toEqual([{
      key: "quest_2", title: "새 퀘스트", summary: args.summary,
      giver: quest.giver, steps: [objective], order: "sequence",
    }]);
    expect(after.maps).toBe(before.maps);
    expect(after.switches).toBe(before.switches);
    expect(sentence).toBe("「새 퀘스트」 퀘스트 정의를 등록합니다.");
    textHasNoIds(sentence);
    await expectUndoRestores(before, after, target);
  });

  it("마왕 예제에서는 선택한 맵의 기존 이벤트에만 새 정의를 등록한다", async () => {
    const before = loadFixture("maou");
    const map = Object.values(before.maps).find(entry => entry.events.length > 0)!;
    const event = map.events[0];
    const target = mapTarget(before, map.id)!;
    const objective = { kind: "reach", mapId: map.id, x: 1, y: 1 };
    const { after, sentence } = runPrimitive(before, target, "quest.create", { title: "근처 살피기", giverEventId: event.id, objective });
    expect(after.quests?.at(-1)).toMatchObject({ title: "근처 살피기", giver: { mapId: map.id, eventId: event.id }, steps: [objective] });
    textHasNoIds(sentence);
    await expectUndoRestores(before, after, target);
  }, 180_000);

  it("제목만 바꾸고 요약에서 내부 표식과 괄호를 가린다", async () => {
    const { before, target } = built();
    const title = "겨울 소식 sw_test_private [추가]";
    const { after, sentence } = runPrimitive(before, target, "quest.rename", { questId: RUMOR, title });
    expect(stepQuest(after, RUMOR)).toEqual({ ...stepQuest(before, RUMOR), title });
    expect(sentence).toContain("겨울 소식 … 추가");
    textHasNoIds(sentence);
    expect(after.maps).toBe(before.maps);
    await expectUndoRestores(before, after, target);
  });

  it("현재 이름으로 의뢰를 찾고 대상에 한 건만 있으면 이름도 생략할 수 있다", () => {
    const { before, target } = built();
    const title = "겨울 소식";
    expect(() => runPrimitive(before, target, "quest.rename", { title })).toThrow(/여러 개/u);
    const named = runPrimitive(before, target, "quest.rename", { questId: "눈 속의 소문", title });
    expect(stepQuest(named.after, RUMOR).title).toBe(title);
    const single = { ...before, quests: [stepQuest(before, RUMOR)] };
    const unnamed = runPrimitive(single, target, "quest.rename", { title });
    expect(stepQuest(unnamed.after, RUMOR).title).toBe(title);
  });

  it("목표 한 개를 끝에 추가하고 사용자 정의 단계 순서를 맞춘다", async () => {
    const { before, target } = built();
    const old = stepQuest(before, PATROL);
    const objective = { kind: "reach", mapId: MARKET, x: 6, y: 7, label: "시장 도착" };
    const { after, sentence } = runPrimitive(before, target, "quest.objective.add", { questId: PATROL, objective });
    expect(stepQuest(after, PATROL)).toEqual({ ...old, steps: [...old.steps, objective], blueprint: ["reach", "reach", "reach"] });
    expect(sentence).toBe("「얼음길 살피기」 정의에 목표를 하나 추가합니다.");
    textHasNoIds(sentence);
    expect(after.maps).toBe(before.maps);
    await expectUndoRestores(before, after, target);
  });

  it("첫 목표 문구만 교체하고 같은 이벤트의 두 번째 목표와 다른 의뢰를 보존한다", async () => {
    const { before, target } = built();
    const old = stepQuest(before, RUMOR);
    const label = "토르와 소문 나누기";
    const { after, sentence } = runPrimitive(before, target, "quest.objective.update", { questId: RUMOR, step: 1, label });
    expect(stepQuest(after, RUMOR)).toEqual({ ...old, steps: [{ ...old.steps[0], label }, old.steps[1]] });
    expect(stepQuest(after, PATROL)).toBe(stepQuest(before, PATROL));
    expect(sentence).toBe("「눈 속의 소문」 정의의 1번 목표를 수정합니다.");
    textHasNoIds(sentence);
    await expectUndoRestores(before, after, target);
  });

  it("끝 목표를 지우고 나머지 순서와 퀘스트 틀을 보존한다", async () => {
    const { before, target } = built();
    const { after, sentence } = runPrimitive(before, target, "quest.objective.remove", { questId: PATROL, step: 2 });
    const old = stepQuest(before, PATROL);
    expect(stepQuest(after, PATROL)).toEqual({ ...old, steps: [old.steps[0]], blueprint: ["reach"] });
    expect(sentence).toBe("「얼음길 살피기」 정의의 2번 목표를 지웁니다.");
    textHasNoIds(sentence);
    await expectUndoRestores(before, after, target);
  });

  it("회복약 세 개를 보상 정의에 넣고 기존 골드 금액을 보존한다", async () => {
    const { before, target } = built();
    const items = [{ itemId: "item_potion", count: 3 }];
    const { after, sentence } = runPrimitive(before, target, "quest.reward.set", { questId: RUMOR, items });
    expect(stepQuest(after, RUMOR)).toEqual({ ...stepQuest(before, RUMOR), rewards: { gold: 20, items } });
    expect(stepQuest(after, RUMOR).rewards?.items).not.toBe(items);
    expect(sentence).toBe("「눈 속의 소문」 정의의 보상 내역을 바꿉니다.");
    textHasNoIds(sentence);
    expect(after.maps).toBe(before.maps);
    await expectUndoRestores(before, after, target);
  });

  it("등록 정의 한 건만 지우고 같은 의뢰인의 다른 퀘스트는 보존한다", async () => {
    const { before, target } = built();
    const { after, sentence } = runPrimitive(before, target, "quest.remove", { questId: RUMOR });
    expect(after.quests).toEqual(before.quests?.slice(1));
    expect(after.maps).toBe(before.maps);
    expect(sentence).toBe("「눈 속의 소문」 퀘스트 등록을 삭제합니다.");
    textHasNoIds(sentence);
    await expectUndoRestores(before, after, target);
  });

  it("의뢰인 재연결은 이벤트 수정까지 필요하므로 범위 밖으로 거절한다", () => {
    const { before } = built();
    const target = mapTarget(before, MARKET, "ev_chain_kehegd7_2")!;
    const primitive = PRIMITIVES.find(entry => entry.id === "quest.giver.link")!;
    const snapshot = structuredClone(before.quests);
    textHasNoIds(primitive.describe({ project: before, target }, { questId: RUMOR }));
    expect(() => runPrimitive(before, target, primitive.id, { questId: RUMOR }))
      .toThrow(/범위 밖.*퀘스트와 이벤트/u);
    expect(jsonEqual(before.quests, snapshot)).toBe(true);
  });

  it("모델이 지목한 다른 이벤트를 새 의뢰인으로 사용할 수 없다", () => {
    const { before, target } = built();
    expect(() => runPrimitive(before, target, "quest.create", {
      title: "선택 범위가 다른 의뢰", giverEventId: "ev_chain_kehegd7_2",
      objective: { kind: "reach", mapId: MARKET, x: 6, y: 7 },
    })).toThrow(/범위 밖/u);
  });

  it.each([
    ["quest.rename", { questId: RUMOR, title: "다른 맵에서 바꾸기" }],
    ["quest.objective.add", { questId: RUMOR, objective: { kind: "reach", mapId: MARKET, x: 6, y: 7 } }],
    ["quest.objective.update", { questId: RUMOR, step: 1, label: "다른 맵에서 수정" }],
    ["quest.objective.remove", { questId: RUMOR, step: 2 }],
    ["quest.reward.set", { questId: RUMOR, gold: 500 }],
    ["quest.remove", { questId: RUMOR }],
  ] as const)("%s가 다른 맵 의뢰를 바꾸려 하면 거절한다", (id, args) => {
    const { before } = built();
    const target = mapTarget(before, MARKET)!;
    expect(() => runPrimitive(before, target, id, args)).toThrow(/범위 밖/u);
  });

  it("호스트 범위에서는 다른 프로젝트 정보 변경과 선택하지 않은 의뢰 변경을 거절한다", () => {
    const { before, target } = built();
    const primitive = PRIMITIVES.find(entry => entry.id === "quest.rename")!;
    const scope = primitive.scope({ project: before, target }, { questId: "q_snow_rumor", title: "겨울 소식" });
    const changed = { ...before, meta: { ...before.meta, title: "다른 프로젝트 이름" } };
    expect(checkSmallTaskScope(before, changed, scope)).toMatchObject({ ok: false, reason: expect.stringContaining("범위 밖") });
    const otherTarget = mapTarget(before, MARKET, "ev_chain_kehegd7_2")!;
    const otherScope = primitive.scope({ project: before, target: otherTarget }, { questId: RUMOR, title: "겨울 소식" });
    const after = primitive.apply({ project: before, target }, { questId: RUMOR, title: "겨울 소식" });
    expect(checkSmallTaskScope(before, after, otherScope)).toMatchObject({ ok: false, reason: expect.stringContaining("범위 밖") });
  });

  it.each([
    ["quest.objective.add", { questId: RUMOR, objective: { kind: "kill", troopId: "troop_missing", at: { mapId: MARKET, x: 6, y: 7 } } }],
    ["quest.objective.update", { questId: RUMOR, step: 1, objective: { kind: "talk", target: { mapId: MARKET, eventId: "ev_missing" } } }],
    ["quest.reward.set", { questId: RUMOR, items: [{ itemId: "item_missing", count: 3 }] }],
    ["quest.reward.set", { questId: RUMOR, gold: -1 }],
    ["quest.objective.remove", { questId: RUMOR, step: 99 }],
  ] as const)("%s의 잘못된 참조나 수량을 거절한다", (id, args) => {
    const { before, target } = built();
    expect(() => runPrimitive(before, target, id, args)).toThrow(PrimitiveError);
  });

  it("진행 중인 뒤 목표의 번호가 바뀌는 삭제를 거절한다", () => {
    const { before, target } = built();
    expect(() => runPrimitive(before, target, "quest.objective.remove", { questId: RUMOR, step: 1 }))
      .toThrow(/범위 밖.*진행 스위치/u);
  });

  it("선행 의뢰로 쓰이는 정의의 등록 삭제를 거절한다", () => {
    const { before, target } = built();
    const quests = before.quests?.map(quest => "key" in quest && quest.key === PATROL
      ? { ...quest, requiresQuestKeys: [RUMOR] } : quest);
    expect(() => runPrimitive({ ...before, quests }, target, "quest.remove", { questId: RUMOR }))
      .toThrow(/범위 밖.*다른 퀘스트/u);
  });
});

describe("이벤트 명령을 실행한 뒤 퀘스트 일지", () => {
  it("새 정의를 등록한 뒤 기존 이벤트의 골드 지급을 실행한다", () => {
    const { before, target, objective, event } = blank();
    const { after } = runPrimitive(before, target, "quest.create", { title: "우물 방문", objective });
    const gold = startSession(after, 1).gold;
    const { session, step } = runHeadless(after, after.startMapId, event.id);
    expect(step).toEqual({ kind: "done" });
    expect(session.gold).toBe(gold + 20);
    expect(buildQuestLog(after, session)[0]).toMatchObject({ title: "우물 방문", state: "not-started" });
  });

  it("목표 문구를 바꾼 뒤 이벤트의 스위치 명령이 그 목표를 완료한다", () => {
    const { before, target, event, quest } = blank();
    const { after } = runPrimitive({ ...before, quests: [quest] }, target, "quest.objective.update", {
      questId: quest.key, step: 1, label: "우물가 확인",
    });
    const { session, step } = runHeadless(after, after.startMapId, event.id);
    expect(step).toEqual({ kind: "done" });
    expect(buildQuestLog(after, session)[0]).toMatchObject({
      state: "active", completedSteps: 1,
      steps: [{ index: 0, label: "1. 우물가 확인", done: true }, { index: 1, label: "2. 문으로 가기", done: false }],
    });
  });

  it("그래프에 기존 진행 스위치를 연결하면 실제 이벤트 실행으로 새 목표가 완료된다", async () => {
    const { before, target, event, flags } = blank();
    const graph: QuestGraphDef = {
      kind: "graph", id: "graph_well", title: "우물 이야기",
      nodes: [{ id: "offer", description: "부탁 받기", completesWhen: { kind: "switch", switchId: flags.started, value: true } }],
      edges: [],
    };
    const project = { ...before, quests: [graph] };
    expect(() => runPrimitive(project, target, "quest.objective.add", {
      questId: graph.id, label: "우물 확인", switchId: "sw_missing",
    })).toThrow(PrimitiveError);
    const { after } = runPrimitive(project, target, "quest.objective.add", { questId: graph.id, label: "우물 확인", switchId: flags.stepSwitches[0] });
    expect(after.quests?.[0]).toEqual({
      ...graph,
      nodes: [...graph.nodes, { id: "step_1", description: "우물 확인", completesWhen: { kind: "switch", switchId: flags.stepSwitches[0], value: true } }],
      edges: [{ from: "offer", to: "step_1" }],
    });
    const { session, step } = runHeadless(after, after.startMapId, event.id);
    expect(step).toEqual({ kind: "done" });
    expect(buildQuestLog(after, session)[0]).toMatchObject({ state: "done", completedSteps: 2 });
    await expectUndoRestores(project, after, target);
  });
});
