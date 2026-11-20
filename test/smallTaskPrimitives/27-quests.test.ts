/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/27-quests";
import { mapTarget } from "@/editor/smallTask/target";
import { createBlankProject, ensureSwitchVariableSlots } from "@/project/defaults/blankProject";
import { removeLegacySpriteReferences } from "@/project/defaults/defaultAssets";
import type { DialogueProposal } from "@/project/dialogueDesk";
import { startSession } from "@/project/session";
import { compileQuest } from "@/project/quest/questCompiler";
import { questFlagIds, type QuestDef, type QuestGraphDef, type QuestStep } from "@/project/quest/questDef";
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
  ensureSwitchVariableSlots(before);
  removeLegacySpriteReferences(before);
  const target = mapTarget(before, before.startMapId, "ev_supply_shop")!;
  return { before, target };
}

function blank() {
  const project = loadFixture("blank");
  const source = createBlankProject();
  const mapId = project.startMapId || source.startMapId;
  const map = project.maps[mapId] ?? source.maps[mapId];
  const flags = questFlagIds("quest_1", 2);
  const progressSwitchIds = [flags.started, flags.stepSwitches[0]];
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
    switches: [...project.switches, ...progressSwitchIds.map(id => ({ id, name: "의뢰 진행" }))],
    session: { ...project.session, switches: {
      ...project.session.switches, ...Object.fromEntries(progressSwitchIds.map(id => [id, false])),
    } },
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
    ensureSwitchVariableSlots(before);
    removeLegacySpriteReferences(before);
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
    const { before: base, target } = built();
    const old = { ...stepQuest(base, PATROL), key: "draft_patrol" };
    const before = { ...base, quests: [old] };
    const objective = { kind: "reach", mapId: MARKET, x: 6, y: 7, label: "시장 도착" };
    const { after, sentence } = runPrimitive(before, target, "quest.objective.add", { objective });
    expect(stepQuest(after, old.key)).toEqual({ ...old, steps: [...old.steps, objective], blueprint: ["reach", "reach", "reach"] });
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

  it("통로 목표를 보존하고 앞 목표가 지워지면 통로의 목표 번호도 당긴다", async () => {
    const { before: base, target, quest } = blank();
    const gate = { mapId: target.mapId, x: 4, y: 4, requiresStep: 1, lockedText: "먼저 문을 찾아라." };
    const old: QuestDef = { ...quest, key: "draft_patrol", gates: [gate] };
    const before = { ...base, quests: [old] };
    expect(() => runPrimitive(before, target, "quest.objective.remove", { step: 2 })).toThrow(/통로/u);
    const { after } = runPrimitive(before, target, "quest.objective.remove", { step: 1 });
    expect(after.quests).toEqual([{ ...old, steps: [old.steps[1]], gates: [{ ...gate, requiresStep: 0 }] }]);
    expect(after.maps).toBe(before.maps);
    await expectUndoRestores(before, after, target);
  });

  it("아직 이벤트에 연결되지 않은 목표를 수집·납품·선택·동행·제작으로 교체한다", async () => {
    const { before: base, target } = built();
    const source = stepQuest(base, RUMOR);
    const old: QuestDef = { ...source, key: "draft_errand", presetId: "custom", blueprint: source.steps.map(step => step.kind) };
    const itemId = "item_potion";
    const recipeId = "recipe_potion";
    const before = { ...base, quests: [old], system: { ...base.system, craftRecipes: [
      { id: recipeId, name: "회복약", outputItemId: itemId, outputCount: 1, ingredients: [] },
    ] } };
    const npc = { mapId: MARKET, eventId: "ev_chain_kehegd7_2" };
    const point = { mapId: MARKET, x: 6, y: 7 };
    const objectives: QuestStep[] = [
      { kind: "collect", itemId, count: 1, sources: [{ kind: "pickup", ...point }] },
      { kind: "deliver", target: npc, itemId, count: 1 },
      { kind: "choice", target: npc, prompt: "함께 갈까요?", options: [{ text: "간다" }, { text: "남는다", completes: false }] },
      { kind: "escort", target: npc, destination: point },
      { kind: "craft", at: point, recipeId },
    ];
    for (const objective of objectives) {
      const { after } = runPrimitive(before, target, "quest.objective.update", { step: 1, objective });
      const steps = [objective, ...old.steps.slice(1)];
      expect(after.quests).toEqual([{ ...old, steps, blueprint: steps.map(step => step.kind) }]);
      expect(after.maps).toBe(before.maps);
      await expectUndoRestores(before, after, target);
    }
  });

  it("회복약 세 개를 보상 정의에 넣고 기존 골드 금액을 보존한다", async () => {
    const { before: base, target } = built();
    const old = { ...stepQuest(base, RUMOR), key: "draft_rumor" };
    const before = { ...base, quests: [old] };
    const items = [{ itemId: "item_potion", count: 3 }];
    const { after, sentence } = runPrimitive(before, target, "quest.reward.set", { items });
    expect(stepQuest(after, old.key)).toEqual({ ...old, rewards: { gold: 20, items } });
    expect(stepQuest(after, old.key).rewards?.items).not.toBe(items);
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

  it("이름 변경 범위는 선택한 의뢰의 제목만 허용한다", () => {
    const { before, target } = built();
    const primitive = PRIMITIVES.find(entry => entry.id === "quest.rename")!;
    const args = { questId: RUMOR, title: "겨울 소식" };
    const scope = primitive.scope({ project: before, target }, args);
    expect(scope).toEqual({ kind: "projectArea", area: "quests", ids: [RUMOR], fields: ["title"] });
    const changed = { ...before, meta: { ...before.meta, title: "다른 프로젝트 이름" } };
    expect(checkSmallTaskScope(before, changed, scope)).toMatchObject({ ok: false, reason: expect.stringContaining("범위 밖") });
    const changedRewards = { ...before, quests: before.quests?.map(quest => "key" in quest && quest.key === RUMOR
      ? { ...quest, rewards: { gold: 500 } } : quest) };
    expect(checkSmallTaskScope(before, changedRewards, scope)).toMatchObject({ ok: false });
    const otherTarget = mapTarget(before, MARKET, "ev_chain_kehegd7_2")!;
    expect(() => primitive.scope({ project: before, target: otherTarget }, args)).toThrow(/범위 밖/u);
    expect(() => primitive.apply({ project: before, target: otherTarget }, args)).toThrow(/범위 밖/u);
    const after = primitive.apply({ project: before, target }, { questId: PATROL, title: "겨울 소식" });
    expect(checkSmallTaskScope(before, after, scope)).toMatchObject({ ok: false, reason: expect.stringContaining("범위 밖") });
  });

  it("여러 페이지의 의뢰 이벤트를 선택하거나 개별 페이지를 지정해도 퀘스트 정의만 바꾼다", () => {
    const { before, target, event, quest } = blank();
    const map = before.maps[target.mapId];
    const firstPage = event.pages![0];
    const secondPage = { ...firstPage, id: "ev_mayor_done", commands: [] };
    const project = {
      ...before, quests: [quest],
      maps: { ...before.maps, [map.id]: { ...map, events: [{ ...event, pages: [firstPage, secondPage] }] } },
    };
    const rename = { title: "새 이름" };
    const selectedPage = mapTarget(project, map.id, event.id, secondPage.id)!;
    const { after } = runPrimitive(project, target, "quest.rename", rename);
    expect(after.quests).toEqual([{ ...quest, title: rename.title }]);
    expect(after.maps).toBe(project.maps);
    expect(runPrimitive(project, selectedPage, "quest.rename", rename).after).toEqual(after);
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

  it("레거시 플래그에만 남은 단계 완료 상태를 다른 목표로 옮기거나 지우지 않는다", () => {
    const { before, target, quest } = blank();
    const draft = { ...quest, key: "draft_well" };
    const { started, stepSwitches } = questFlagIds(draft.key, 2);
    const project = { ...before, quests: [draft], flags: { ...before.flags, [started]: true, [stepSwitches[1]]: true } };
    expect(project.switches.some(entry => entry.id === stepSwitches[1])).toBe(false);
    expect(buildQuestLog(project, startSession(project, 1))[0].steps.map(step => step.done)).toEqual([false, true]);
    expect(() => runPrimitive(project, target, "quest.objective.remove", { step: 1 })).toThrow(/진행 스위치/u);
    expect(() => runPrimitive(project, target, "quest.remove", {})).toThrow(/진행 스위치/u);
    expect(project.quests).toEqual([draft]);
  });

  it.each([true, false])("세션에만 남은 단계 스위치가 켜져 있을 때만 퀘스트를 보호한다 (%s)", on => {
    const { before, target, quest } = blank();
    const draft = { ...quest, key: "draft_well" };
    const switchId = questFlagIds(draft.key, 2).stepSwitches[1];
    const project = { ...before, quests: [draft], session: { ...before.session, switches: { [switchId]: on } } };
    const remove = () => runPrimitive(project, target, "quest.remove", {});
    const removeFirst = () => runPrimitive(project, target, "quest.objective.remove", { step: 1 });
    if (on) {
      expect(remove).toThrow(/진행 스위치/u);
      expect(removeFirst).toThrow(/진행 스위치/u);
    } else {
      expect(remove().after.quests).toEqual([]);
      expect(removeFirst().after.quests).toEqual([{ ...draft, steps: [draft.steps[1]] }]);
    }
  });

  it("다른 이벤트의 열린 초안이 참조하는 퀘스트를 삭제하지 않는다", () => {
    const { before, target, event, quest } = blank();
    const draft = { ...quest, key: "draft_well" };
    const project = { ...before, quests: [draft] };
    const command: Command = { kind: "m2Command", commandId: "m2-208-quest-objective", fields: { questId: draft.key, objectiveId: "well", state: "start" } };
    const working: GameEvent = { ...event, id: "ev_draft", commands: [command], draft: { kind: "new" } };
    const live = { maps: { [target.mapId]: { events: [working] } } };
    expect(() => runPrimitive(project, target, "quest.remove", {}, undefined, live)).toThrow(/이벤트 명령/u);
    expect(runPrimitive(project, target, "quest.remove", {}).after.quests).toEqual([]);
    const switchId = questFlagIds(draft.key, 2).stepSwitches[1];
    const progress: Command = { kind: "fork", condition: { kind: "switch", switchId, value: true }, then: [] };
    const progressDraft = { maps: { [target.mapId]: { events: [{ ...working, commands: [progress] }] } } };
    expect(() => runPrimitive(project, target, "quest.remove", {}, undefined, progressDraft)).toThrow(/진행 스위치/u);
    expect(() => runPrimitive(project, target, "quest.objective.remove", { step: 2 }, undefined, progressDraft)).toThrow(/진행 스위치/u);
  });

  it("열린 이벤트 초안의 목표 명령에 등장하는 퀘스트 ID를 재사용하지 않는다", () => {
    const { before, target, event, objective } = blank();
    const command: Command = { kind: "m2Command", commandId: "m2-208-quest-objective", fields: { questId: "quest_2", objectiveId: "well" } };
    const draft: GameEvent = { ...event, id: "ev_draft", commands: [command], draft: { kind: "new" } };
    const live = { maps: { [target.mapId]: { events: [draft] } } };
    const { after } = runPrimitive(before, target, "quest.create", { title: "별개 의뢰", objective }, undefined, live);
    expect(after.quests).toMatchObject([{ key: "quest_3" }]);
    expect(after.maps).toBe(before.maps);
  });

  it("진행에 연결되지 않은 퀘스트도 아이템 보상의 상한을 검증한다", () => {
    const { before, target, quest } = blank();
    const item = createBlankProject().database.items.find(entry => entry.id === "item_potion")!;
    const project = { ...before, database: { ...before.database, items: [item] }, quests: [{ ...quest, key: "draft_well" }] };
    expect(() => runPrimitive(project, target, "quest.reward.set", { items: [{ itemId: item.id, count: 1_000_000 }] }))
      .toThrow(/수량/u);
    expect(runPrimitive(project, target, "quest.reward.set", { items: [{ itemId: item.id, count: 999_999 }] }).after.quests)
      .toMatchObject([{ rewards: { items: [{ itemId: item.id, count: 999_999 }] } }]);
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

  it("그래프 목표의 ID 할당과 삭제는 열린 초안의 목표 명령을 반영한다", () => {
    const { project, target, quest, otherFlag, other } = branched();
    const command = (objectiveId: string): Command => ({
      kind: "m2Command", commandId: "m2-208-quest-objective", fields: { questId: quest.id, objectiveId },
    });
    const draft: GameEvent = { ...other, id: "ev_draft", commands: [command("step_1"), command("middle")], draft: { kind: "new" } };
    const live = { maps: { [target.mapId]: { events: [draft] } } };
    expect(() => runPrimitive(project, target, "quest.objective.remove", { step: 2 }, undefined, live)).toThrow(/이벤트 명령/u);
    const { after } = runPrimitive(project, target, "quest.objective.add", { label: "보고", switchId: otherFlag }, undefined, live);
    expect(after.quests).toMatchObject([{ nodes: [...quest.nodes, { id: "step_2", description: "보고" }] }]);
    expect(after.maps).toBe(project.maps);
  });

  it("시작 스위치를 끄기만 하는 이벤트는 의뢰인으로 세지 않는다", () => {
    const { project, target, other } = branched();
    const map = project.maps[target.mapId];
    const withWriter = (value: boolean) => ({ ...project, maps: { ...project.maps, [map.id]: {
      ...map, events: map.events.map(event => event === other ? {
        ...event, commands: [...event.commands, { kind: "setSwitch" as const, switchId: "sw_quest_1_started", value }],
      } : event),
    } } });
    const args = { title: "새 이름" };
    expect(runPrimitive(withWriter(false), target, "quest.rename", args).after.quests).toMatchObject([{ title: args.title }]);
    expect(() => runPrimitive(withWriter(true), target, "quest.rename", args)).toThrow(/퀘스트를 찾을 수 없어요/u);
  });

  it("완료 스위치를 바꿔도 꺼짐 조건을 유지하고 여러 조건을 덮어쓰지 않는다", () => {
    const { project, target, quest, otherFlag, other } = branched();
    const map = project.maps[target.mapId];
    const off: Command = { kind: "setSwitch", switchId: otherFlag, value: false };
    const offProject = { ...project, maps: { ...project.maps, [map.id]: {
      ...map, events: map.events.map(event => event === other ? { ...event, commands: [off] } : event),
    } } };
    const condition = { kind: "switch" as const, switchId: "sw_quest_1_step0", value: false };
    const withCondition = (completesWhen: QuestGraphDef["nodes"][number]["completesWhen"]) => ({
      ...offProject, quests: [{ ...quest, nodes: [quest.nodes[0], { ...quest.nodes[1], completesWhen }, ...quest.nodes.slice(2)] }],
    });
    const args = { step: 2, switchId: otherFlag };
    const { after } = runPrimitive(withCondition(condition), target, "quest.objective.update", args);
    expect(after.quests?.[0]).toMatchObject({ nodes: [
      quest.nodes[0], { ...quest.nodes[1], completesWhen: { ...condition, switchId: otherFlag } }, ...quest.nodes.slice(2),
    ] });
    expect(() => runPrimitive(withCondition({ all: [condition, { ...condition, switchId: otherFlag, value: true }] }),
      target, "quest.objective.update", args)).toThrow(/여러 조건/u);
    expect(() => runPrimitive({ ...project, quests: withCondition(condition).quests },
      target, "quest.objective.update", args)).toThrow(/이벤트에서 값을 기록/u);
    expect(() => runPrimitive(offProject, target, "quest.objective.add", { label: "우물 확인", switchId: otherFlag }))
      .toThrow(/이벤트에서 값을 기록/u);
  });

  it("선택한 이벤트의 초안을 취소한 뒤에도 남는 완료 스위치 쓰기만 인정한다", () => {
    const { project, target } = branched();
    const map = project.maps[target.mapId];
    const selected = map.events[0]!;
    const switchId = "sw_draft_finish";
    const writer: Command = { kind: "setSwitch", switchId, value: true };
    const working = { ...selected, commands: [...selected.commands, writer] };
    const before = {
      ...project, switches: [...project.switches, { id: switchId, name: "초안 완료" }],
      maps: { ...project.maps, [map.id]: { ...map, events: [working, ...map.events.slice(1)] } },
    };
    const args = { label: "완료 확인", switchId };
    const live = (original: GameEvent) => ({ maps: { [map.id]: { events: [{ ...working, draft: { kind: "edit" as const, original } }] } } });
    expect(() => runPrimitive(before, target, "quest.objective.add", args, undefined, live(selected)))
      .toThrow(/이벤트에서 값을 기록/u);
    const withoutWriter = { ...before, maps: { ...before.maps, [map.id]: { ...map, events: [selected, ...map.events.slice(1)] } } };
    expect(() => runPrimitive(withoutWriter, target, "quest.objective.add", args, undefined, live(working)))
      .toThrow(/이벤트에서 값을 기록/u);
    expect(runPrimitive(before, target, "quest.objective.add", args, undefined, live(working)).after.quests)
      .toMatchObject([{ nodes: expect.arrayContaining([{ id: "step_1", description: args.label, completesWhen: { kind: "switch", switchId, value: true } }]) }]);
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

  it("복합 시작 조건 모두를 같은 이벤트가 작성해야 그래프를 편집할 수 있다", () => {
    const { project, target, quest, otherFlag } = branched();
    const first = quest.nodes[0];
    const compound = (secondSwitchId: string) => ({ ...project, quests: [{ ...quest, nodes: [{
      ...first, completesWhen: { all: [
        { kind: "switch" as const, switchId: "sw_quest_1_started", value: true },
        { kind: "switch" as const, switchId: secondSwitchId, value: true },
      ] },
    }, ...quest.nodes.slice(1)] }] });
    const args = { questId: quest.id, title: "우물 조사" };
    expect(() => runPrimitive(compound(otherFlag), target, "quest.rename", args)).toThrow(/범위 밖/u);
    expect(() => runPrimitive(compound(otherFlag), mapTarget(project, target.mapId)!, "quest.rename", args)).toThrow(/범위 밖/u);
    const { after } = runPrimitive(compound("sw_quest_1_step0"), target, "quest.rename", args);
    expect(after.quests?.[0].title).toBe(args.title);
  });

  it("등록됐지만 이벤트에서 값을 한 번도 쓰지 않는 스위치로 목표를 추가하거나 바꾸지 않는다", () => {
    const { project, target } = branched();
    const switchId = "sw_unused_objective";
    const before = { ...project, switches: [...project.switches, { id: switchId, name: "사용하지 않는 완료 스위치" }] };
    expect(() => runPrimitive(before, target, "quest.objective.add", { label: "우물 확인", switchId })).toThrow(/이벤트에서 값을 기록/u);
    expect(() => runPrimitive(before, target, "quest.objective.update", { step: 2, switchId })).toThrow(/이벤트에서 값을 기록/u);
  });

  it("첫 목표에서 갈라진 갈래를 끊는 삭제를 거절한다", () => {
    const { project, target, quest } = branched();
    const [start, middle, left, right] = quest.nodes;
    const before = { ...project, quests: [{ ...quest, edges: [
      { from: start.id, to: middle.id }, { from: start.id, to: right.id }, { from: middle.id, to: left.id },
    ] }] };
    expect(() => runPrimitive(before, target, "quest.objective.remove", { step: 1 })).toThrow(/일부 갈래로 진행/u);
  });
});

describe("이벤트 명령을 실행한 뒤 퀘스트 일지", () => {
  it("컴파일된 퀘스트의 목표 추가를 거절하고 보상 편집은 정의에만 적용한다", () => {
    const { before: seed, event, quest, objective } = blank();
    const item = createBlankProject().database.items.find(entry => entry.id === "item_potion")!;
    const map = seed.maps[seed.startMapId];
    const draft = {
      ...seed,
      database: { ...seed.database, items: [item] },
      maps: { ...seed.maps, [map.id]: { ...map, events: structuredClone(map.events) } },
      switches: [...seed.switches],
      variables: [...seed.variables],
      session: { ...seed.session, switches: { ...seed.session.switches }, variables: { ...seed.session.variables } },
    };
    const compiled = { ...quest, rewards: { gold: 20, items: [{ itemId: item.id, count: 1 }] } };
    const { flags } = compileQuest(draft, compiled);
    const before = { ...draft, session: { ...draft.session, switches: {
      ...draft.session.switches, [flags.started]: true, ...Object.fromEntries(flags.stepSwitches.map(id => [id, true])),
    } } };
    const giver = before.maps[map.id].events.find(entry => entry.id === event.id)!;
    const target = mapTarget(before, map.id, giver.id, giver.pages![0].id)!;
    expect(() => runPrimitive(before, target, "quest.objective.add", { objective: { ...objective, x: 5, y: 5 } }))
      .toThrow(/완료 이벤트/u);
    const rewards = { gold: 50, items: [{ itemId: item.id, count: 3 }] };
    const { after } = runPrimitive(before, target, "quest.reward.set", rewards);
    expect(before.quests).toEqual([compiled]);
    expect(after.quests).toEqual([{ ...compiled, rewards }]);
    expect(after.maps).toBe(before.maps);
    const initial = startSession(after, 1);
    const { session } = runHeadless(after, after.startMapId, event.id);
    expect(session.gold).toBe(initial.gold + compiled.rewards.gold);
    expect(session.inventory[item.id]).toBe(1);
    expect(buildQuestLog(after, session)[0]).toMatchObject({ state: "done", completedSteps: quest.steps.length });
  });

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
