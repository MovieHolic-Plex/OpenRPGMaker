/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { FORK_THEN_BRANCH_INDEX, LOOP_BODY_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { normalizeEventPage } from "@/editor/eventPages";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/30-common-events";
import { dbTarget, mapTarget } from "@/editor/smallTask/target";
import { createInterpreter } from "@/player/interpreter";
import { createBlankMap, singleNodeTree } from "@/project/defaults/defaultMaps";
import { getSwitch, getVariable, startSession } from "@/project/session";
import type { Command, CommonEvent, GameEvent, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { expectKoreanSentence, expectRefused, expectUndoRestores, loadFixture } from "./harness";

const eventId = "ce_test_bonus";
const switchId = "sw_0001";
const variableId = "var_0001";
const gold: Command = { kind: "changeGold", op: "+=", amount: 3 };
const setSwitch: Command = { kind: "setSwitch", switchId, value: true };
const count: Command = { kind: "setVariable", variableId, op: "+=", value: 1 };
const call: Command = { kind: "callCommonEvent", commonEventId: eventId };

function commonEvent(commands: Command[] = []): CommonEvent {
  return { id: eventId, name: "여관 혜택", trigger: "none", commands };
}

function startMapTarget(project: Project) {
  const target = mapTarget(project, project.startMapId);
  if (!target) throw new Error("시작 맵이 필요합니다.");
  return target;
}

function seed(commands: Command[] = [], fixture: "built" | "maou" = "built"): Project {
  const project = loadFixture(fixture);
  const map = project.maps[project.startMapId];
  const maps = { ...project.maps, [map.id]: { ...map } };
  return { ...project, maps, commonEvents: [...project.commonEvents, commonEvent(commands)] };
}

function runOn(project: Project, id: string, args: Record<string, unknown>) {
  return runPrimitive(project, startMapTarget(project), id, args);
}

const wait: Command = { kind: "wait", ms: 700 };
const stored = commonEvent([gold, wait]);
const fork: Command = { kind: "fork", condition: { kind: "switch", switchId, value: true }, then: [wait] };
const cases = [
  {
    id: "commonEvent.create", args: { name: "  여관 회복  " },
    expected: [stored, { id: "ce_1", name: "여관 회복", trigger: "none", commands: [] }],
    sentence: "「여관 회복」 이름으로 공용 이벤트를 만들어요.",
  },
  {
    id: "commonEvent.rename", args: { commonEventId: eventId, name: "숙박 혜택" },
    expected: [{ ...stored, name: "숙박 혜택" }],
    sentence: "「여관 혜택」에 새 이름 「숙박 혜택」을 붙여요.",
  },
  {
    id: "commonEvent.trigger.set", args: { commonEventId: eventId, trigger: "auto", conditionSwitchId: switchId },
    expected: [{ ...stored, trigger: "auto", conditionSwitchId: switchId }],
    sentence: "「여관 혜택」에 조건 스위치가 켜졌을 때 ‘자동 실행’을 적용해요.",
  },
  {
    id: "commonEvent.remove", args: { commonEventId: eventId }, expected: [],
    sentence: "「여관 혜택」 공용 이벤트를 지워요.",
  },
  {
    id: "commonEvent.command.insert", args: { commonEventId: eventId, index: 1, command: { kind: "text", body: "오늘의 혜택이에요." } },
    expected: [{ ...stored, commands: [gold, { kind: "text", speaker: "", body: "오늘의 혜택이에요." }, wait] }],
    sentence: "「여관 혜택」에 ‘문장 표시’ 명령을 넣어요.",
  },
  {
    id: "commonEvent.command.update", args: { commonEventId: eventId, index: 1, patch: { ms: 1000 } },
    expected: [{ ...stored, commands: [gold, { kind: "wait", ms: 1000 }] }],
    sentence: "「여관 혜택」에 있는 ‘대기’ 명령을 고쳐요.",
  },
  {
    id: "commonEvent.command.delete", args: { commonEventId: eventId, index: 0 },
    expected: [{ ...stored, commands: [wait] }],
    sentence: "「여관 혜택」에 있는 ‘소지금 변경’ 명령을 지워요.",
  },
];

describe("공용 이벤트", () => {
  it.each(cases)("$id 저장, 한 문장, 되돌리기", async ({ id, args, expected, sentence }) => {
    const project = seed(stored.commands, id === "commonEvent.rename" ? "maou" : "built");
    const original = structuredClone(project.commonEvents);
    const target = startMapTarget(project);
    const result = runPrimitive(project, target, id, args);
    expect(result.after.commonEvents).toEqual([...original.slice(0, -1), ...expected]);
    expect(result.after.maps).toBe(project.maps);
    expect(result.after.database).toBe(project.database);
    expect(jsonEqual(project.commonEvents, original)).toBe(true);
    expect(result.sentence).toBe(sentence);
    expectKoreanSentence(result.sentence);
    await expectUndoRestores(project, result.after, target);
  }, 150_000);

  it.each(cases)("$id 범위 밖의 변경 거부", ({ id, args }) => {
    const project = seed(stored.commands);
    const target = startMapTarget(project);
    const primitive = PRIMITIVES.find(row => row.id === id)!;
    const scope = primitive.scope({ project, target }, args);
    const { after } = runPrimitive(project, target, id, args);
    const changedTitle = { ...after, meta: { ...after.meta, title: "다른 프로젝트 제목" } };
    expect(checkSmallTaskScope(project, changedTitle, scope)).toMatchObject({
      ok: false, reason: expect.stringContaining("범위 밖"),
    });

    const other = dbTarget(project, "actors", project.database.actors[0]!.id)!;
    expectRefused(project, other, id, args);
  });

  it("새 행사 키가 이미 쓰였으면 다음 빈 자리를 택하고 기존 목록을 보존한다", () => {
    const project = seed();
    project.commonEvents = [...project.commonEvents, { ...stored, id: "ce_1" }];
    const { after } = runOn(project, "commonEvent.create", { name: "여관 회복" });
    expect(after.commonEvents.at(-1)).toEqual({ id: "ce_2", name: "여관 회복", trigger: "none", commands: [] });
    expect(after.commonEvents.slice(0, -1)).toEqual(project.commonEvents);
    expect(() => runOn(project, "commonEvent.create", { name: " " })).toThrow("이름을 입력해 주세요");
  });

  it("실행 방식만 바꾸면 스위치를 유지하고, 비우라는 요청은 조건을 지운다", () => {
    const project = seed();
    project.commonEvents.at(-1)!.conditionSwitchId = switchId;
    const args = { commonEventId: eventId, trigger: "parallel" };
    const { after } = runOn(project, "commonEvent.trigger.set", args);
    expect(after.commonEvents.at(-1)).toEqual({ ...commonEvent(), trigger: "parallel", conditionSwitchId: switchId });
    const cleared = runOn(after, "commonEvent.trigger.set", { ...args, trigger: "none", conditionSwitchId: null });
    expect(cleared.after.commonEvents.at(-1)).toEqual(commonEvent());
    expect(() => runOn(project, "commonEvent.trigger.set", { ...args, conditionSwitchId: "sw_missing" })).toThrow("스위치를 찾을 수 없습니다");
  });

  it("맵 페이지와 공용 이벤트, 전투 페이지의 중첩 호출자를 이름으로 알려 준다", () => {
    const project = seed();
    const map = project.maps[project.startMapId]!;
    map.events = [...map.events, {
      id: "ev_inn_entrance", name: "여관 입구", x: 0, y: 0, trigger: { kind: "action" }, commands: [],
      pages: [normalizeEventPage({ id: "page_inn", name: "안내", commands: [{ kind: "loop", body: [call] }] })],
    }];
    project.commonEvents = [...project.commonEvents, { ...commonEvent([call]), id: "ce_test_opening", name: "아침 알림" }];
    const troop = project.database.troops[0]!;
    project.database = {
      ...project.database,
      troops: [{
        ...troop, name: "동굴 경비대",
        battleEventPages: [{ id: "page_battle", name: "전투 준비", conditions: [], span: "battle", commands: [call] }],
      }, ...project.database.troops.slice(1)],
    };
    expect(() => runOn(project, "commonEvent.remove", { commonEventId: eventId }))
      .toThrow(/여관 입구.*안내.*아침 알림.*동굴 경비대.*전투 준비.*지울 수 없습니다/u);
  });

  it("편집 중인 맵 이벤트가 원본에 호출을 남겨 두면 공용 이벤트 삭제를 거부한다", () => {
    const project = seed();
    const original = { id: "ev_inn_gift", name: "여관 주인", x: 0, y: 0, commands: [call], trigger: { kind: "action" } } satisfies GameEvent;
    const map = project.maps[project.startMapId]!;
    map.events = [...map.events, { ...original, commands: [], draft: { kind: "edit", original } }];
    expect(() => runOn(project, "commonEvent.remove", { commonEventId: eventId })).toThrow(/여관 주인.*지울 수 없습니다/u);
  });

  it("자기 자신을 호출하는 공용 이벤트도 삭제할 수 없다", () => {
    expect(() => runOn(seed([call]), "commonEvent.remove", { commonEventId: eventId })).toThrow(/여관 혜택.*지울 수 없습니다/u);
  });

  it("중첩 위치에서 한 줄만 추가하고 수정하고 지운다", () => {
    const project = seed([fork, gold]);
    const args = { commonEventId: eventId, index: 0, branchPath: [0, FORK_THEN_BRANCH_INDEX] };
    const inserted = runOn(project, "commonEvent.command.insert", { ...args, command: { kind: "wait" } }).after;
    const updated = runOn(inserted, "commonEvent.command.update", { ...args, patch: { ms: 100 } }).after;
    expect(updated.commonEvents.at(-1)?.commands).toEqual([{ ...fork, then: [{ kind: "wait", ms: 100 }, wait] }, gold]);
    const deleted = runOn(updated, "commonEvent.command.delete", args).after;
    expect(jsonEqual(project, deleted)).toBe(true);
  });

  it("분기 자식의 일괄 추가·덮어쓰기·삭제를 모두 거부한다", () => {
    const project = seed([fork]);
    const args = { commonEventId: eventId, index: 0 };
    expect(() => runOn(project, "commonEvent.command.insert", { ...args, command: { kind: "loop", body: [gold] } })).toThrow("따로 넣어 주세요");
    expect(() => runOn(project, "commonEvent.command.update", { ...args, patch: { then: [] } })).toThrow("따로 고쳐야 합니다");
    expect(() => runOn(project, "commonEvent.command.delete", args)).toThrow("분기 안에 명령이 남아");
    expect(() => runOn(project, "commonEvent.command.insert", { ...args, branchPath: [0, LOOP_BODY_BRANCH_INDEX], command: gold }))
      .toThrow("명령 줄을 찾을 수 없습니다");
  });

  it.each([
    { kind: "setSwitch", switchId: "sw_missing", value: true },
    { kind: "changeItem", itemId: "item_missing", op: "+=", amount: 3 },
    { kind: "transfer", mapId: "map_missing", x: 0, y: 0 },
    { kind: "changeParty", actorId: "actor_missing", action: "add" },
    { kind: "callCommonEvent", commonEventId: "ce_missing" },
    { kind: "playAudio", channel: "se", resourceId: "sound_missing" },
  ])("삽입 전 없는 참조 거부 ($kind)", command => {
    const project = seed();
    expect(() => runOn(project, "commonEvent.command.insert", { commonEventId: eventId, command }))
      .toThrow(/찾을 수 없습니다/u);
    expect(project.commonEvents.at(-1)).toEqual(commonEvent());
  });

  it("고친 한 줄의 새 참조도 검사한다", () => {
    const args = { commonEventId: eventId, index: 0, patch: { switchId: "sw_missing" } };
    expect(() => runOn(seed([setSwitch]), "commonEvent.command.update", args)).toThrow("대상을 찾을 수 없습니다");
  });

  it("종류가 빠진 명령은 기본 대사로 바꾸지 않고 거부한다", () => {
    expect(() => runOn(seed(), "commonEvent.command.insert", { commonEventId: eventId, command: {} }))
      .toThrow(PrimitiveError);
  });

  it("길거나 식별자를 포함한 이름은 미리보기에서 안전하게 줄인다", () => {
    const map = { ...createBlankMap("빈 맵", 3, 3), id: "map_common_events" };
    const project: Project = {
      ...loadFixture("blank"),
      maps: { [map.id]: map },
      startMapId: map.id,
      mapTree: singleNodeTree(map.id),
    };
    const name = "ce_private 이름 ".repeat(15).trim();
    const { after, sentence } = runOn(project, "commonEvent.create", { name });
    expect(after.commonEvents).toEqual([{ id: "ce_1", name, trigger: "none", commands: [] }]);
    expectKoreanSentence(sentence);
    expect(sentence).not.toContain("ce_private");
  });
});

describe("공용 이벤트 호출 런타임", () => {
  function execute(project: Project) {
    const session = startSession(project, 1);
    const startingGold = session.gold;
    expect(createInterpreter([call], session, project).start()).toEqual({ kind: "done" });
    return { session, startingGold };
  }

  it("추가한 명령이 공용 이벤트를 부를 때 소지금을 세 개 늘린다", () => {
    const { after } = runOn(seed(), "commonEvent.command.insert", { commonEventId: eventId, command: gold });
    const { session, startingGold } = execute(after);
    expect(session.gold).toBe(startingGold + 3);
  });

  it("변수를 늘리는 수를 고치면 다음 호출이 바뀐 값으로 실행된다", () => {
    const { after } = runOn(seed([count]), "commonEvent.command.update", { commonEventId: eventId, index: 0, patch: { value: 5 } });
    const { session } = execute(after);
    expect(getVariable(session, variableId)).toBe(5);
  });

  it("스위치 줄을 지워도 다음 줄은 그대로 실행된다", () => {
    const { after } = runOn(seed([setSwitch, count]), "commonEvent.command.delete", { commonEventId: eventId, index: 0 });
    const { session } = execute(after);
    expect(getSwitch(session, switchId)).toBe(false);
    expect(getVariable(session, variableId)).toBe(1);
  });
});
