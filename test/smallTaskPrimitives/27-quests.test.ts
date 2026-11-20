/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/27-quests";
import { mapTarget } from "@/editor/smallTask/target";
import { createBlankProject } from "@/project/defaults/blankProject";
import type { DialogueProposal } from "@/project/dialogueDesk";
import { startSession } from "@/project/session";
import { questFlagIds, type QuestDef, type QuestGraphDef } from "@/project/quest/questDef";
import type { Command, GameEvent, Project, TroopRecord } from "@/project/types";
import { buildQuestLog } from "@/player/questLog";
import { jsonEqual } from "@/util/structuralJson";
import { expectUndoRestores, loadFixture, runHeadless } from "./harness";

const RUMOR = "q_snow_rumor";
const PATROL = "q_ice_patrol";
const MARKET = "map_5eec6ba0-1ac1-48ab-9d7f-db5032670b4c";

function withProposal(project: Project, lineId: string): Project {
  const proposal: DialogueProposal = {
    id: "proposal", lineId, baseHash: "old", before: "원래 문구", after: "새 문구", source: "human", createdAt: "",
  };
  return { ...project, dialogueDesk: { voices: [], proposals: [proposal] } };
}

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
  if (target.kind !== "event") throw new Error("이벤트 대상이 필요합니다.");
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
    const { before: base, target, quest } = blank();
    const old: QuestDef = { ...quest, key: "draft_patrol", presetId: "custom", blueprint: ["reach", "reach"] };
    const before = { ...base, quests: [old] };
    const { after, sentence } = runPrimitive(before, target, "quest.objective.remove", { questId: old.key, step: 2 });
    expect(stepQuest(after, old.key)).toEqual({ ...old, steps: [old.steps[0]], blueprint: ["reach"] });
    expect(sentence).toBe("「촌장의 부탁」 정의의 2번 목표를 지웁니다.");
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
    const { before: base, target, quest } = blank();
    const draft = { ...quest, key: "draft_well" };
    const before = { ...base, quests: [draft, quest] };
    const { after, sentence } = runPrimitive(before, target, "quest.remove", { questId: draft.key });
    expect(after.quests).toEqual([quest]);
    expect(after.maps).toBe(before.maps);
    expect(sentence).toBe("「촌장의 부탁」 퀘스트 등록을 삭제합니다.");
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
    const args = { questId: RUMOR, title: "겨울 소식" };
    const scope = primitive.scope({ project: before, target }, args);
    expect(scope).toEqual({ kind: "projectArea", area: "quests", ids: [RUMOR] });
    const changed = { ...before, meta: { ...before.meta, title: "다른 프로젝트 이름" } };
    expect(checkSmallTaskScope(before, changed, scope)).toMatchObject({ ok: false, reason: expect.stringContaining("범위 밖") });
    const otherTarget = mapTarget(before, MARKET, "ev_chain_kehegd7_2")!;
    expect(() => primitive.scope({ project: before, target: otherTarget }, args)).toThrow(/범위 밖/u);
    expect(() => primitive.apply({ project: before, target: otherTarget }, args)).toThrow(/범위 밖/u);
    const after = primitive.apply({ project: before, target }, { questId: PATROL, title: "겨울 소식" });
    expect(checkSmallTaskScope(before, after, scope)).toMatchObject({ ok: false, reason: expect.stringContaining("범위 밖") });
  });

  it("빈 선택자나 사라진 페이지를 생략된 선택으로 처리하지 않는다", () => {
    const { before, target, quest } = blank();
    const project = { ...before, quests: [quest] };
    const rename = { title: "새 이름" };
    expect(() => runPrimitive(project, target, "quest.rename", { ...rename, questId: "  " })).toThrow(/이름/u);
    expect(() => runPrimitive(project, target, "quest.rename", { ...rename, questId: "missing" })).toThrow(/찾을 수/u);
    const stale = { ...target, pageId: "stale_page" };
    expect(() => runPrimitive(project, stale, "quest.rename", rename)).toThrow(/페이지/u);
  });

  it("중복 식별자가 있어도 선택한 이벤트 밖의 동명 식별자를 바꾸지 않는다", () => {
    const { before, target, quest } = blank();
    const other = { ...quest, giver: { ...quest.giver, eventId: "ev_other" } };
    expect(() => runPrimitive({ ...before, quests: [other, quest] }, target, "quest.rename", { questId: quest.key, title: "새 이름" }))
      .toThrow(/같은 식별자/u);
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

  it("마지막 목표에도 연결된 진행 스위치가 남으면 삭제나 교체를 거절한다", () => {
    const { before, target } = built();
    expect(() => runPrimitive(before, target, "quest.objective.remove", { questId: PATROL, step: 2 })).toThrow(/진행 스위치/u);
    expect(() => runPrimitive(before, target, "quest.objective.update", {
      questId: PATROL, step: 2, objective: { kind: "reach", mapId: MARKET, x: 6, y: 7 },
    })).toThrow(/플레이에 연결된 목표/u);
    expect(() => runPrimitive(before, target, "quest.remove", { questId: PATROL })).toThrow(/진행 스위치/u);
  });

  it("선행 의뢰로 쓰이는 정의의 등록 삭제를 거절한다", () => {
    const { before, target } = built();
    const quests = before.quests?.map(quest => "key" in quest && quest.key === PATROL
      ? { ...quest, requiresQuestKeys: [RUMOR] } : quest);
    expect(() => runPrimitive({ ...before, quests }, target, "quest.remove", { questId: RUMOR }))
      .toThrow(/범위 밖.*다른 퀘스트/u);
  });

  it.each(["map", "common", "troop", "afterBattle"] as const)("분기 안의 퀘스트 목표 명령을 놓치지 않는다 (%s)", source => {
    const { before, target, event, quest } = blank();
    const draft = { ...quest, key: "draft_well" };
    const command: Command = { kind: "m2Command", commandId: "m2-208-quest-objective", fields: { questId: draft.key, objectiveId: "well", state: "start" } };
    const commands: Command[] = [{
      kind: "fork", condition: { kind: "switch", switchId: "sw_quest_1_started", value: true }, then: [],
      else: [{ kind: "loop", body: [command] }],
    }];
    const project = { ...before, quests: [draft] };
    const map = project.maps[project.startMapId];
    if (source === "map") project.maps = { ...project.maps, [map.id]: { ...map, events: [{ ...event, commands }] } };
    if (source === "common") project.commonEvents = [{ id: "ce_quest", name: "진행", trigger: "none", commands }];
    if (source === "troop" || source === "afterBattle") {
      const troop: TroopRecord = {
        id: "troop_quest", name: "진행", enemyIds: [], autoAlign: true, battleEventPages: source === "troop"
          ? [{ id: "page_troop_quest", name: "진행", conditions: [], commands, span: "battle" }] : [],
        ...(source === "afterBattle" ? { afterBattle: { victory: commands } } : {}),
      };
      project.database = { ...project.database, troops: [troop] };
    }
    expect(() => runPrimitive(project, target, "quest.remove", { questId: draft.key })).toThrow(/이벤트 명령/u);
  });

  it("스위치 목록에 빠진 참조도 공용 이벤트의 조건에서 찾는다", () => {
    const { before, target, quest } = blank();
    const draft = { ...quest, key: "draft_well" };
    const switchId = questFlagIds(draft.key, 2).stepSwitches[1];
    const project: Project = {
      ...before, quests: [draft],
      commonEvents: [{
        id: "ce_gate", name: "통로", trigger: "none",
        commands: [{ kind: "fork", condition: { kind: "not", condition: { kind: "switch", switchId, value: true } }, then: [] }],
      }],
    };
    expect(() => runPrimitive(project, target, "quest.objective.remove", { questId: draft.key, step: 2 })).toThrow(/진행 스위치/u);
    expect(() => runPrimitive(project, target, "quest.remove", { questId: draft.key })).toThrow(/진행 스위치/u);
  });

  it("자료집 윤문 제안과 연결된 제목·목표·퀘스트의 변경을 거절한다", () => {
    const { before, target, quest } = blank();
    const draft = { ...quest, key: "draft_well" };
    const project = { ...before, quests: [draft] };
    const byTitle = withProposal(project, "qs/draft_well#title");
    const byStep = withProposal(project, "qs/draft_well#step1");
    expect(() => runPrimitive(byTitle, target, "quest.rename", { title: "새 이름" })).toThrow(/윤문 제안/u);
    expect(() => runPrimitive(byStep, target, "quest.objective.remove", { step: 1 })).toThrow(/윤문 제안/u);
    expect(() => runPrimitive(byStep, target, "quest.remove", {})).toThrow(/윤문 제안/u);
  });

  it("새 정의는 이벤트에 이미 쓰인 퀘스트 식별자를 재사용하지 않는다", () => {
    const { before, target, objective } = blank();
    const project: Project = {
      ...before,
      commonEvents: [{ id: "ce_quest", name: "진행", trigger: "none", commands: [
        { kind: "m2Command", commandId: "m2-208-quest-objective", fields: { questId: "quest_2", objectiveId: "well", state: "start" } },
      ] }],
    };
    const { after } = runPrimitive(project, target, "quest.create", { title: "별개 의뢰", objective });
    expect(after.quests?.at(-1)).toMatchObject({ key: "quest_3" });
  });
});

describe("그래프 목표의 연결", () => {
  function branched() {
    const { before, target, event, flags } = blank();
    const otherFlag = "sw_other_offer";
    const other: GameEvent = {
      ...event, id: "ev_other", x: 3,
      pages: [], commands: [{ kind: "setSwitch", switchId: otherFlag, value: true }],
    };
    const node = (id: string, switchId: string) => ({
      id, description: id, completesWhen: { kind: "switch" as const, switchId, value: true },
    });
    const quest: QuestGraphDef = {
      kind: "graph", id: "graph_well", title: "우물 이야기",
      nodes: [node("start", flags.started), node("middle", flags.stepSwitches[0]), node("left", flags.stepSwitches[0]), node("right", otherFlag)],
      edges: [{ from: "start", to: "middle" }, { from: "middle", to: "left" }, { from: "middle", to: "right" }],
    };
    const map = before.maps[before.startMapId];
    const project = {
      ...before, quests: [quest],
      switches: [...before.switches, { id: otherFlag, name: "다른 시작" }],
      maps: { ...before.maps, [map.id]: { ...map, events: [event, other] } },
    };
    return { project, target, quest, otherFlag, other };
  }

  it("중간 목표를 지워도 양쪽 분기의 연결을 보존한다", () => {
    const { project, target, quest } = branched();
    const { after } = runPrimitive(project, target, "quest.objective.remove", { step: 2 });
    expect(after.quests).toEqual([{
      ...quest,
      nodes: [quest.nodes[0], ...quest.nodes.slice(2)],
      edges: [{ from: "start", to: "left" }, { from: "start", to: "right" }],
    }]);
    expect(after.maps).toBe(project.maps);
  });

  it("여러 갈래가 끝나는 지점 모두에 새 목표를 연결한다", () => {
    const { project, target, quest, otherFlag } = branched();
    const { after } = runPrimitive(project, target, "quest.objective.add", { label: "다시 보고하기", switchId: otherFlag });
    expect(after.quests?.[0]).toMatchObject({
      edges: [...quest.edges, { from: "left", to: "step_1" }, { from: "right", to: "step_1" }],
    });
  });

  it("완료 스위치를 바꿔도 꺼짐 조건을 유지하고 여러 조건을 덮어쓰지 않는다", () => {
    const { project, target, quest, otherFlag } = branched();
    const condition = { kind: "switch" as const, switchId: "sw_quest_1_step0", value: false };
    const withCondition = (completesWhen: QuestGraphDef["nodes"][number]["completesWhen"]) => ({
      ...project, quests: [{ ...quest, nodes: [quest.nodes[0], { ...quest.nodes[1], completesWhen }, ...quest.nodes.slice(2)] }],
    });
    const args = { step: 2, switchId: otherFlag };
    const { after } = runPrimitive(withCondition(condition), target, "quest.objective.update", args);
    expect(after.quests?.[0]).toMatchObject({ nodes: [
      quest.nodes[0], { ...quest.nodes[1], completesWhen: { ...condition, switchId: otherFlag } }, ...quest.nodes.slice(2),
    ] });
    expect(() => runPrimitive(withCondition({ all: [condition, { ...condition, switchId: otherFlag, value: true }] }),
      target, "quest.objective.update", args)).toThrow(/여러 조건/u);
  });

  it("첫 목표를 바꿔 다른 시작 이벤트를 연결하거나 시작 이벤트가 모호한 그래프를 고치지 않는다", () => {
    const { project, target, quest, otherFlag, other } = branched();
    expect(() => runPrimitive(project, target, "quest.objective.update", { step: 1, switchId: otherFlag })).toThrow(/시작하는 이벤트/u);
    const withOtherAsSecond = { ...project, quests: [{ ...quest, nodes: [quest.nodes[0], quest.nodes[3], ...quest.nodes.slice(1, 3)] }] };
    expect(() => runPrimitive(withOtherAsSecond, target, "quest.objective.remove", { step: 1 })).toThrow(/시작하는 이벤트/u);
    const map = project.maps[project.startMapId];
    const ambiguous = { ...project, maps: { ...project.maps, [map.id]: { ...map, events: [map.events[0], {
      ...other, commands: [{ kind: "setSwitch" as const, switchId: "sw_quest_1_started", value: true }],
    }] } } };
    expect(() => runPrimitive(ambiguous, target, "quest.rename", { questId: quest.id, title: "다른 이름" })).toThrow(/범위 밖/u);
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
