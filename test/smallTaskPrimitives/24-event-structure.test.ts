/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/24-event-structure";
import { mapTarget } from "@/editor/smallTask/target";
import { createInterpreter } from "@/player/interpreter";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { runtimeEventView } from "@/project/runtimeEventState";
import { startSession } from "@/project/session";
import type { EventPage, GameEvent, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { expectKoreanSentence, expectUndoRestores, loadFixture } from "./harness";

const MAP = "map_event_test";
const EVENT = "ev_reward";
const sprite = { type: "bundled", id: "tex_easyrpg_charset_actor1" } as const;
const selection = (x: number, y: number) => ({ rect: { x, y, w: 1, h: 1 } });

let blankFixture: Project | undefined;
function blank(withEvent = true) {
  const project = blankFixture ??= loadFixture("blank");
  const map = { ...createBlankMap("시험 맵", 12, 12), id: MAP };
  const first: EventPage = {
    id: "page_first", name: "처음",
    graphic: { sprite, direction: "down", pattern: 1 },
    trigger: { kind: "action" }, priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    conditions: [], commands: [{ kind: "changeGold", op: "+=", amount: 3 }],
  };
  const second: EventPage = {
    ...first, id: "page_second", name: "다음",
    commands: [{ kind: "changeGold", op: "+=", amount: 7 }],
  };
  const event: GameEvent = {
    id: EVENT, name: "보상 상자", x: 2, y: 3,
    trigger: first.trigger, commands: [], pages: [first, second],
  };
  map.events = withEvent ? [event] : [];
  return {
    ...project, maps: { [MAP]: map },
    startMapId: MAP, startPos: { x: 8, y: 8 }, mapTree: { mapId: MAP, children: [] },
  };
}

function verifySentence(sentence: string) {
  expectKoreanSentence(sentence);
  expect(sentence).toMatch(/\.$/u);
}

function executeActivePage(project: Project, event: GameEvent) {
  const session = startSession(project, 42);
  const gold = session.gold;
  const view = runtimeEventView(event, session, {}, project);
  const interpreter = createInterpreter(view.page?.commands ?? event.commands, session, project, { currentEventId: event.id });
  expect(interpreter.start().kind).toBe("done");
  return { view, reward: session.gold - gold };
}

describe("이벤트 구조 조작", () => {
  it("선택한 빈 칸에 기본 페이지가 있는 이벤트를 만들고 한 번에 되돌린다", async () => {
    const before = blank(false);
    const target = mapTarget(before, MAP)!;
    const args = { name: "  빈 우물  ", x: 2, y: 3 };
    const { after, sentence } = runPrimitive(before, target, "event.tile.create", args, selection(2, 3));
    expect(after.maps[MAP].events).toEqual([{
      id: "ev_small_task_1", name: "빈 우물", x: 2, y: 3,
      trigger: { kind: "action" }, commands: [],
      pages: [{
        id: "ev_small_task_1_page_1", name: "페이지 1", conditions: [], graphic: {},
        trigger: { kind: "action" }, priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [],
      }],
    }]);
    expect(before.maps[MAP].events).toEqual([]);
    expect(sentence).toBe("선택한 칸에 ‘빈 우물’ 이름으로 이벤트를 만들어요.");
    verifySentence(sentence);
    await expectUndoRestores(before, after, target);
  });

  it("기존 페이지 설정을 물려받아 지정한 자리에 빈 페이지를 넣고 한 번에 되돌린다", async () => {
    const before = blank();
    const target = mapTarget(before, MAP, EVENT)!;
    const [first, second] = before.maps[MAP].events[0].pages!;
    const { after, sentence } = runPrimitive(before, target, "event.page.add", { name: "저녁", position: 2, copyFrom: 2 });
    expect(after.maps[MAP].events[0].pages).toEqual([
      first, { ...second, id: "ev_reward_page_3", name: "저녁", conditions: [], commands: [] }, second,
    ]);
    expect(before.maps[MAP].events[0].pages).toEqual([first, second]);
    verifySentence(sentence);
    await expectUndoRestores(before, after, target);
  });

  it("선택한 페이지의 그림·발동·우선순위·통과·방향을 고치고 기존 보상을 실행한다", async () => {
    const before = blank();
    const target = mapTarget(before, MAP, EVENT, "page_second")!;
    const [first, second] = before.maps[MAP].events[0].pages!;
    const { after, sentence } = runPrimitive(before, target, "event.page.patch", {
      graphic: { type: "bundled", id: "tex_easyrpg_charset_people1" }, pattern: 4,
      trigger: "playerTouch", priority: "below", through: true, direction: "up",
    });
    const [kept, patched] = after.maps[MAP].events[0].pages!;
    expect(kept).toBe(first);
    expect(patched).toEqual({
      ...second,
      graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" }, pattern: 4, transparent: false, direction: "up" },
      trigger: { kind: "playerTouch" }, priority: "below", overlapForbidden: false,
    });
    expect(second.graphic).toEqual({ sprite, direction: "down", pattern: 1 });
    const { view, reward } = executeActivePage(after, after.maps[MAP].events[0]);
    expect(view).toMatchObject({ trigger: { kind: "playerTouch" }, priority: "below", overlapForbidden: false, direction: "up" });
    expect(reward).toBe(7);
    verifySentence(sentence);
    await expectUndoRestores(before, after, target);
  });

  it("페이지를 삭제하면 남은 페이지의 보상이 실행되고 한 번에 되돌릴 수 있다", async () => {
    const before = blank();
    const target = mapTarget(before, MAP, EVENT)!;
    const [first] = before.maps[MAP].events[0].pages!;
    const { after, sentence } = runPrimitive(before, target, "event.page.remove", { page: 2 });
    expect(after.maps[MAP].events[0].pages).toEqual([first]);
    expect(before.maps[MAP].events[0].pages).toHaveLength(2);
    expect(executeActivePage(after, after.maps[MAP].events[0]).reward).toBe(3);
    verifySentence(sentence);
    await expectUndoRestores(before, after, target);
  });

  it("페이지 번호가 바뀌면 런타임의 활성 페이지와 보상도 바뀐다", async () => {
    const before = blank();
    const target = mapTarget(before, MAP, EVENT)!;
    const [first, second] = before.maps[MAP].events[0].pages!;
    const { after, sentence } = runPrimitive(before, target, "event.page.reorder", { page: 1, to: 2 });
    expect(after.maps[MAP].events[0].pages).toEqual([second, first]);
    expect(before.maps[MAP].events[0].pages).toEqual([first, second]);
    expect(executeActivePage(before, before.maps[MAP].events[0]).reward).toBe(7);
    expect(executeActivePage(after, after.maps[MAP].events[0]).reward).toBe(3);
    verifySentence(sentence);
    await expectUndoRestores(before, after, target);
  });

  it("원본과 셀프 스위치 상태를 보존하며 새 식별값으로 이벤트를 복제한다", async () => {
    const before = blank();
    before.session = { ...before.session, selfSwitches: { [EVENT]: { A: true } } };
    const target = mapTarget(before, MAP, EVENT)!;
    const original = before.maps[MAP].events[0];
    const { after, sentence } = runPrimitive(before, target, "event.tile.duplicate", { dx: 2 }, selection(4, 3));
    const [kept, copy] = after.maps[MAP].events;
    expect(kept).toBe(original);
    expect(copy).toEqual({
      ...original, id: "ev_small_task_1", x: 4,
      pages: original.pages?.map((page, index) => ({ ...page, id: `ev_small_task_1_page_${index + 1}` })),
    });
    expect(copy.pages?.[0].commands).not.toBe(original.pages?.[0].commands);
    expect(after.session.selfSwitches).toEqual({ [EVENT]: { A: true } });
    expect(executeActivePage(after, copy).reward).toBe(7);
    verifySentence(sentence);
    await expectUndoRestores(before, after, target);
  });

  it("선택한 이벤트와 그 셀프 스위치를 삭제하고 한 번에 되돌린다", async () => {
    const before = blank();
    before.session = { ...before.session, selfSwitches: { [EVENT]: { A: true }, ev_other: { B: true } } };
    const target = mapTarget(before, MAP, EVENT)!;
    const { after, sentence } = runPrimitive(before, target, "event.tile.remove", {});
    expect(after.maps[MAP].events).toEqual([]);
    expect(after.session.selfSwitches).toEqual({ ev_other: { B: true } });
    expect(before.maps[MAP].events).toHaveLength(1);
    verifySentence(sentence);
    await expectUndoRestores(before, after, target);
  });

  it("이동 사본의 좌표와 같은 자리를 따르는 시간표를 바꾸되 칸 가드가 적용을 거절한다", async () => {
    const before = blank();
    const original = before.maps[MAP].events[0];
    original.schedule = [{
      when: { timePhase: "morning" }, at: { mapId: MAP, x: 2, y: 3 },
    }, {
      when: { timePhase: "night" }, at: { mapId: MAP, x: 1, y: 1 },
    }];
    const target = mapTarget(before, MAP, EVENT)!;
    const ctx = { project: before, target, selection: selection(4, 3) };
    const move = PRIMITIVES.find(entry => entry.id === "event.tile.move")!;
    const args = { dx: 2 };
    const after = move.apply(ctx, args);
    expect(after.maps[MAP].events[0]).toEqual({
      ...original, x: 4, schedule: [
        { when: { timePhase: "morning" }, at: { mapId: MAP, x: 4, y: 3 } },
        { when: { timePhase: "night" }, at: { mapId: MAP, x: 1, y: 1 } },
      ],
    });
    expect(original.x).toBe(2);
    expect(original.schedule[0].at.x).toBe(2);
    expect(() => runPrimitive(before, target, move.id, args, ctx.selection)).toThrow(/범위 밖/u);
    verifySentence(move.describe(ctx, args));
    await expectUndoRestores(before, after, target);
  });

  it("편의점 계산대 이름만 바꾸고 기존 페이지와 다른 맵을 보존한다", async () => {
    const before = loadFixture("maou");
    const mapId = "map_mk_konbini";
    const eventId = "ev_mk_register";
    const target = mapTarget(before, mapId, eventId)!;
    const original = before.maps[mapId].events.find(event => event.id === eventId)!;
    const { after, sentence } = runPrimitive(before, target, "event.tile.rename", { name: "계산 창구" });
    expect(after.maps[mapId].events.find(event => event.id === eventId)).toEqual({ ...original, name: "계산 창구" });
    expect(original.name).toBe("계산대");
    expect(after.maps.map_mk_room).toBe(before.maps.map_mk_room);
    verifySentence(sentence);
    await expectUndoRestores(before, after, target);
  }, 120_000);

  it("완성 게임에서 특정 페이지의 방향만 바꾸고 옆 페이지와 명령을 보존한다", async () => {
    const before = loadFixture("built");
    const mapId = "map_5eec6ba0-1ac1-48ab-9d7f-db5032670b4c";
    const eventId = "ev_npc_fea822e3-ce0f-4cc3-95e7-56d06c28d2f8";
    const original = before.maps[mapId].events.find(event => event.id === eventId)!;
    const [first, second] = original.pages!;
    const target = mapTarget(before, mapId, eventId, second.id)!;
    const { after, sentence } = runPrimitive(before, target, "event.page.patch", { direction: "left" });
    const edited = after.maps[mapId].events.find(event => event.id === eventId)!;
    expect(edited.pages).toEqual([first, { ...second, graphic: { ...second.graphic, direction: "left" } }]);
    verifySentence(sentence);
    await expectUndoRestores(before, after, target);
  });
});

describe("선택 범위와 입력 검증", () => {
  it.each([
    ["event.page.add", {}], ["event.page.patch", { trigger: "auto" }],
    ["event.page.remove", { page: 2 }], ["event.page.reorder", { page: 2, to: 1 }],
    ["event.tile.duplicate", { dx: 2 }], ["event.tile.remove", {}],
    ["event.tile.move", { dx: 2 }], ["event.tile.rename", { name: "우물" }],
  ] as const)("%s에 오래된 선택을 넘기면 범위 밖으로 거절한다", (id, args) => {
    const before = blank();
    const target = mapTarget(before, MAP, EVENT)!;
    if (target.kind !== "event") throw new Error("이벤트를 선택할 수 없어요.");
    expect(() => runPrimitive(before, { ...target, x: 0 }, id, args, selection(4, 3))).toThrow(/범위 밖/u);
  });

  it("생성과 복제는 편집기가 선택한 목적지와 모델 좌표가 다르면 거절한다", () => {
    const before = blank();
    expect(() => runPrimitive(before, mapTarget(before, MAP)!, "event.tile.create", { x: 4, y: 3 }, selection(5, 3))).toThrow(/범위 밖/u);
    expect(() => runPrimitive(before, mapTarget(before, MAP, EVENT)!, "event.tile.duplicate", { dx: 2 }, selection(5, 3))).toThrow(/범위 밖/u);
  });

  it.each([
    ["event.page.patch", { page: 2, direction: "left" }],
    ["event.page.remove", { page: 2 }], ["event.page.reorder", { page: 2, to: 1 }],
  ] as const)("%s로 선택한 페이지 이외의 페이지를 바꾸지 못한다", (id, args) => {
    const before = blank();
    expect(() => runPrimitive(before, mapTarget(before, MAP, EVENT, "page_first")!, id, args)).toThrow(/범위 밖/u);
  });

  it("그림 참조와 페이지 번호의 오류는 한국어로 거절한다", () => {
    const before = blank();
    const target = mapTarget(before, MAP, EVENT)!;
    for (const [id, args, message] of [
      ["event.page.patch", { graphic: { type: "bundled", id: "missing_sprite" } }, "사용할 그림을 찾을 수 없어요."],
      ["event.page.patch", { pattern: -1 }, "동작에 필요한 값의 형식을 확인해 주세요."],
      ["event.page.add", { copyFrom: 3 }, "그 번호의 페이지를 찾을 수 없어요."],
      ["event.page.add", { position: 0 }, "동작에 필요한 값의 형식을 확인해 주세요."],
      ["event.page.reorder", { to: 3 }, "그 번호의 페이지를 찾을 수 없어요."],
      ["event.tile.rename", { name: "    " }, "이름을 한 글자 이상 적어 주세요."],
    ] as const) {
      expect(() => runPrimitive(before, target, id, args)).toThrow(new PrimitiveError(message));
    }
  });

  it("마지막 페이지를 삭제하지 않으며 예전 형식의 이벤트도 명령을 유지한 채 수정한다", () => {
    const before = blank();
    const event = before.maps[MAP].events[0];
    event.commands = [{ kind: "changeGold", op: "+=", amount: 5 }];
    delete event.pages;
    const target = mapTarget(before, MAP, EVENT)!;
    expect(() => runPrimitive(before, target, "event.page.remove", {})).toThrow("페이지를 한 장 이상 남겨야 해요.");
    const { after } = runPrimitive(before, target, "event.page.patch", { trigger: "auto" });
    expect(after.maps[MAP].events[0].pages?.[0].commands).toEqual(event.commands);
    expect(executeActivePage(after, after.maps[MAP].events[0]).reward).toBe(5);
    expect(event.pages).toBeUndefined();
  });

  it("다른 페이지가 기다리는 스위치의 유일한 실행 이벤트는 삭제를 거절한다", () => {
    const before = blank();
    const original = before.maps[MAP].events[0];
    const switchId = "sw_gate";
    before.switches = [{ id: switchId, name: "문 열림" }];
    for (const page of original.pages!) page.commands = [{ kind: "setSwitch", switchId, value: true }];
    before.maps[MAP].events.push({
      ...original, id: "ev_gate", x: 3, y: 5,
      pages: [{ ...original.pages![0], id: "page_gate", conditions: [{ kind: "switch", switchId, value: true }], commands: [] }],
    });
    expect(() => runPrimitive(before, mapTarget(before, MAP, EVENT)!, "event.tile.remove", {})).toThrow(/진행에 필요한 스위치/u);
  });

  it("선택한 이벤트 변경에 다른 맵 속성 변경을 덧붙이면 공용 가드가 거절한다", () => {
    const before = blank();
    const target = mapTarget(before, MAP, EVENT)!;
    const primitive = PRIMITIVES.find(entry => entry.id === "event.tile.rename")!;
    const ctx = { project: before, target };
    const args = { name: "이름" };
    const { after } = runPrimitive(before, target, primitive.id, args);
    const extra = { ...after, maps: { ...after.maps, [MAP]: { ...after.maps[MAP], name: "다른 이름" } } };
    const verdict = checkSmallTaskScope(before, extra, primitive.scope(ctx, args));
    expect(verdict).toMatchObject({ ok: false, reason: expect.stringContaining("범위 밖") });
    expect(jsonEqual(before.maps[MAP].events, after.maps[MAP].events)).toBe(false);
  });
});
