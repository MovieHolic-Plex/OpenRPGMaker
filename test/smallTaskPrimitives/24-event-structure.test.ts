/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { PrimitiveError, SELECT_EVENT_PAGE } from "@/editor/smallTask/primitives/errors";
import { OWNERSHIP } from "@/editor/smallTask/primitives/ownership";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES, UNIT } from "@/editor/smallTask/primitives/units/24-event-structure";
import { mapTarget } from "@/editor/smallTask/target";
import en from "@/i18n/catalogs/en.json";
import ja from "@/i18n/catalogs/ja.json";
import zh from "@/i18n/catalogs/zh.json";
import { createTranslator } from "@/i18n/translator";
import { createInterpreter } from "@/player/interpreter";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { ensureSwitchVariableSlots } from "@/project/defaults/blankProject";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { runtimeEventView, runtimeEventViewById } from "@/project/runtimeEventState";
import { startSession } from "@/project/session";
import type { Command, Condition, EventPage, GameEvent, Project } from "@/project/types";
import * as ids from "@/util/id";
import { jsonEqual } from "@/util/structuralJson";
import { expectKoreanSentence, expectUndoRestores, loadFixture } from "./harness";

const MAP = "map_event_test";
const EVENT = "ev_reward";
const sprite = { type: "bundled", id: "tex_easyrpg_charset_actor1" } as const;
const selection = (x: number, y: number) => ({ rect: { x, y, w: 1, h: 1 } });

let blankFixture: Project | undefined;
function blank(withEvent = true): Project {
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

function withEvents(project: Project, events: GameEvent[]): Project {
  return { ...project, maps: { ...project.maps, [MAP]: { ...project.maps[MAP], events } } };
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
    const [{ id }] = after.maps[MAP].events;
    expect(id).toMatch(/^ev_small_task_[\da-f-]{36}$/u);
    expect(after.maps[MAP].events).toEqual([{
      id, name: "빈 우물", x: 2, y: 3,
      trigger: { kind: "action" }, commands: [],
      pages: [{
        id: `${id}_page_1`, name: "페이지 1", conditions: [], graphic: {},
        trigger: { kind: "action" }, priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [],
      }],
    }]);
    expect(before.maps[MAP].events).toEqual([]);
    expect(sentence).toBe("선택한 칸에 ‘빈 우물’ 이벤트를 만들어요.");
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

  it("자리 지정 없이 빈 페이지를 추가해도 기존 활성 페이지의 보상이 유지된다", () => {
    const before = blank();
    const target = mapTarget(before, MAP, EVENT)!;
    const [first, second] = before.maps[MAP].events[0].pages!;
    const { after } = runPrimitive(before, target, "event.page.add", {});
    const edited = after.maps[MAP].events[0];
    expect(edited.pages).toEqual([expect.objectContaining({ commands: [], conditions: [] }), first, second]);
    expect(executeActivePage(after, edited).reward).toBe(7);
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
    expect(copy.id).not.toBe(original.id);
    expect(copy).toEqual({
      ...original, id: copy.id, x: 4,
      pages: original.pages?.map((page, index) => ({ ...page, id: `${copy.id}_page_${index + 1}` })),
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

  it("다른 칸으로 옮기려는 요청은 이동 사본 없이 거절하고 같은 칸은 그대로 둔다", () => {
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
    expect(() => move.apply(ctx, { dx: 2 })).toThrow(/범위 밖/u);
    expect(() => runPrimitive(before, target, move.id, { dx: 2 }, ctx.selection)).toThrow(/다른 칸/u);
    expect(runPrimitive(before, target, move.id, {}, selection(2, 3))).toMatchObject({
      after: before, sentence: "이벤트가 이미 선택한 칸에 있어요.",
    });
    expect(original.x).toBe(2);
    expect(original.schedule[0].at.x).toBe(2);
  });

  it("다른 칸으로 옮기는 요청의 거절 안내를 영어·일본어·중국어에서 찾을 수 있다", () => {
    const before = blank();
    const target = mapTarget(before, MAP, EVENT)!;
    const move = () => runPrimitive(before, target, "event.tile.move", { dx: 2 }, selection(4, 3));
    const message = "범위 밖: 작은 일에서는 이벤트를 다른 칸으로 옮길 수 없어요. 맵에서 이벤트를 직접 옮겨 주세요.";
    expect(move).toThrow(new PrimitiveError(message));
    for (const catalog of [en, ja, zh]) {
      const translation = createTranslator(catalog).translate(message);
      expect(translation).toBeTruthy();
      expect(translation).not.toMatch(/[가-힣]/u);
    }
  });

  it.each(["event.tile.create", "event.tile.duplicate"])("%s의 새 이벤트에 삭제된 이벤트의 플레이 저장이 적용되지 않는다", primitive => {
    const before = blank();
    const [source] = before.maps[MAP].events;
    const retired: GameEvent = { ...source, id: "ev_small_task_1", x: 4, y: 3 };
    before.maps[MAP].events.push(retired);
    const played = startSession(before);
    played.selfSwitches[retired.id] = { A: true };
    played.eventLocations[retired.id] = { mapId: MAP, x: 10, y: 10 };
    played.erasedEventIds.push(retired.id);
    const snapshot = createSaveSnapshot(before, played);
    const { after: deleted } = runPrimitive(before, mapTarget(before, MAP, retired.id)!, "event.tile.remove", {});
    const target = mapTarget(deleted, MAP, primitive === "event.tile.duplicate" ? EVENT : undefined)!;
    const { after } = runPrimitive(deleted, target, primitive, {}, selection(4, 3));
    const fresh = after.maps[MAP].events[1];
    const reloaded = applySaveSnapshot(after, snapshot);

    expect(fresh.id).not.toBe(retired.id);
    expect(reloaded.selfSwitches[retired.id]).toEqual({ A: true });
    expect(reloaded.eventLocations[retired.id]).toMatchObject({ x: 10, y: 10 });
    expect(reloaded.erasedEventIds).toContain(retired.id);
    expect(reloaded.selfSwitches[fresh.id]).toBeUndefined();
    expect(runtimeEventViewById(after, after.maps[MAP], reloaded, {}, fresh.id)).toMatchObject({ x: 4, y: 3 });
  });

  it("편의점 계산대 이름만 바꾸고 기존 페이지와 다른 맵을 보존한다", async () => {
    const before = loadFixture("maou");
    ensureSwitchVariableSlots(before);
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

  it("복제본의 다음 상태가 맵 밖을 덮으면 빈 칸을 선택했어도 거절한다", () => {
    const before = blank();
    before.maps[MAP].events[0].pages![1].footprint = { width: 1, height: 2 };
    const target = mapTarget(before, MAP, EVENT)!;
    expect(() => runPrimitive(before, target, "event.tile.duplicate", {}, selection(5, 0))).toThrow(/이벤트를 놓을 수 없어요/u);
    expect(before.maps[MAP].events).toHaveLength(1);
  });

  it("기존 이벤트의 두 번째 페이지가 덮는 칸에는 생성·복제하지 않는다", () => {
    const before = blank();
    const map = before.maps[MAP];
    const [source] = map.events;
    const [first, second] = source.pages!;
    map.events.push({ ...source, id: "ev_wide", x: 4, y: 4, pages: [first, { ...second, footprint: { width: 1, height: 2 } }] });
    const covered = selection(4, 3);
    const mapSelection = mapTarget(before, MAP)!;
    const eventSelection = mapTarget(before, MAP, EVENT)!;
    expect(() => runPrimitive(before, mapSelection, "event.tile.create", {}, covered)).toThrow(/이미 사용 중인 칸/u);
    expect(() => runPrimitive(before, eventSelection, "event.tile.duplicate", {}, covered)).toThrow(/이벤트를 놓을 수 없어요/u);
    expect(runPrimitive(before, eventSelection, "event.tile.duplicate", {}, selection(5, 3)).after.maps[MAP].events).toHaveLength(3);
    expect(map.events).toHaveLength(2);
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
    const target = mapTarget(before, MAP, EVENT, "page_first")!;
    for (const [id, args, message] of [
      ["event.page.patch", { graphic: { type: "bundled", id: "missing_sprite" } }, "사용할 그림을 찾을 수 없어요."],
      ["event.page.patch", { graphic: { type: "bundled", id: "constructor" } }, "사용할 그림을 찾을 수 없어요."],
      ["event.page.patch", { pattern: -1 }, "동작에 필요한 값의 형식을 확인해 주세요."],
      ["event.page.patch", { pattern: 96 }, "그림에 있는 칸 번호를 골라 주세요. 첫 칸은 0이에요."],
      ["event.page.patch", { graphic: { type: "bundled", id: "tex_easyrpg_charset_actor1" }, pattern: 999 }, "그림에 있는 칸 번호를 골라 주세요. 첫 칸은 0이에요."],
      ["event.page.add", { copyFrom: 3 }, "그 번호의 페이지를 찾을 수 없어요."],
      ["event.page.add", { position: 0 }, "동작에 필요한 값의 형식을 확인해 주세요."],
      ["event.page.reorder", { to: 3 }, "그 번호의 페이지를 찾을 수 없어요."],
      ["event.tile.rename", { name: "    " }, "이름을 한 글자 이상 적어 주세요."],
    ] as const) {
      expect(() => runPrimitive(before, target, id, args)).toThrow(new PrimitiveError(message));
    }
  });

  it("이벤트 그림으로 쓸 수 없는 오디오와 업로드 그림의 마지막 칸을 넘는 번호를 거절한다", () => {
    const before = blank();
    const id = "test_sprite";
    before.assets = { ...before.assets, uploaded: { ...before.assets.uploaded, [id]: {
      id, name: "두 칸 그림", kind: "sprite", meta: { width: 32, height: 16, frameWidth: 16, frameHeight: 16, frames: 2 },
    } } };
    const target = mapTarget(before, MAP, EVENT, "page_second")!;
    const graphic = { type: "uploaded", id };
    expect(() => runPrimitive(before, target, "event.page.patch", { graphic, pattern: 2 })).toThrow(/그림에 있는 칸/u);
    expect(runPrimitive(before, target, "event.page.patch", { graphic, pattern: 1 }).after.maps[MAP].events[0].pages?.[1].graphic.pattern).toBe(1);
    expect(() => runPrimitive(before, target, "event.page.patch", { graphic: { type: "bundled", id: "cc0-sound-ui-confirm" } })).toThrow(/사용할 그림/u);
  });

  it("같은 맵에 이벤트 ID가 중복되거나 선택한 페이지가 사라지면 구조를 바꾸지 않는다", () => {
    const before = blank();
    const event = before.maps[MAP].events[0];
    const target = mapTarget(before, MAP, EVENT, "page_second")!;
    event.pages!.pop();
    expect(() => runPrimitive(before, target, "event.page.add", {})).toThrow(/페이지를 다시 선택/u);
    const duplicated = withEvents(before, [event, { ...event, x: 5 }]);
    expect(() => runPrimitive(duplicated, mapTarget(duplicated, MAP, EVENT)!, "event.tile.rename", { name: "우물" })).toThrow(/범위 밖/u);
    expect(duplicated.maps[MAP].events.map(entry => entry.name)).toEqual(["보상 상자", "보상 상자"]);
  });

  it("다른 이벤트가 기다리는 ID를 새 이벤트에 재사용하지 않는다", () => {
    const before = blank();
    const reserved = "ev_small_task_97ab6adc-d0dd-4c46-9b2f-c94448dd1219";
    const available = "ev_small_task_9e78a4ac-4e24-4d76-90bc-01e82c070313";
    before.maps[MAP].events[0].pages![0].commands.push({ kind: "callMapEvent", eventId: reserved });
    const target = mapTarget(before, MAP)!;
    const generator = vi.spyOn(ids, "genId").mockReturnValueOnce(reserved).mockReturnValueOnce(available);
    try {
      const { after } = runPrimitive(before, target, "event.tile.create", {}, selection(4, 3));
      expect(after.maps[MAP].events.map(event => event.id)).toEqual([EVENT, available]);
    } finally {
      generator.mockRestore();
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

  it("스위치가 켜진 뒤에만 도달하는 페이지는 대체 작성자가 될 수 없다", () => {
    const before = blank();
    const map = before.maps[MAP];
    const [source] = map.events;
    const [first, second] = source.pages!;
    const switchId = "sw_gate";
    const on = { kind: "switch", switchId, value: true } as const;
    const gated: Condition = { kind: "any", conditions: [on, { kind: "not", condition: { ...on, value: false } }] };
    const write = [{ kind: "setSwitch", switchId, value: true }] satisfies Command[];
    before.switches = [{ id: switchId, name: "문 열림" }];
    second.commands = write;
    const gate: GameEvent = { ...source, id: "ev_gate", x: 4, pages: [
      { ...first, commands: [] }, { ...second, conditions: [gated] },
    ] };
    map.events.push(gate);
    const target = mapTarget(before, MAP, EVENT)!;
    expect(runtimeEventView(gate, startSession(before), {}).pageId).toBe(first.id);
    expect(() => runPrimitive(before, target, "event.tile.remove", {})).toThrow(/진행에 필요한 스위치/u);
    expect(() => runPrimitive(before, target, "event.page.remove", { page: 2 })).toThrow(/기다리는 스위치/u);

    const reachable = { ...gate, pages: [{ ...first, commands: write }, gate.pages![1]] };
    const { after } = runPrimitive(withEvents(before, [source, reachable]), target, "event.tile.remove", {});
    const session = startSession(after);
    const commands = runtimeEventView(reachable, session, {}).page!.commands;
    expect(createInterpreter(commands, session, after).start().kind).toBe("done");
    expect(session.switches[switchId]).toBe(true);
  });

  it("부정 조건에서 켜져야 하는 스위치는 지키고 꺼진 상태를 요구하는 조건은 그대로 둔다", () => {
    const before = blank();
    const [source] = before.maps[MAP].events;
    const [first, second] = source.pages!;
    const switchId = "sw_gate";
    const off = { kind: "switch", switchId, value: false } as const;
    const write = [{ kind: "setSwitch", switchId, value: true }] satisfies Command[];
    before.switches = [{ id: switchId, name: "문 열림" }];
    first.commands = write;
    const reader = { ...source, id: "ev_gate", x: 4, pages: [{ ...second, commands: [], conditions: [off] }] };
    const direct = withEvents(before, [source, reader]);
    const target = mapTarget(direct, MAP, EVENT)!;
    expect(runPrimitive(direct, target, "event.tile.remove", {}).after.maps[MAP].events).toEqual([reader]);

    const requiresOn = { ...reader, pages: [{ ...reader.pages[0], conditions: [{ kind: "not", condition: off }] }] } satisfies GameEvent;
    const guarded = withEvents(before, [source, requiresOn]);
    expect(() => runPrimitive(guarded, target, "event.tile.remove", {})).toThrow(/진행에 필요한 스위치/u);
  });

  it("조건을 충족하는 페이지가 없는 이벤트의 옛 명령은 스위치를 대신 켤 수 없다", () => {
    const before = blank();
    const [source] = before.maps[MAP].events;
    const switchId = "sw_gate";
    const on = { kind: "switch", switchId, value: true } as const;
    const write = [{ kind: "setSwitch", switchId, value: true }] satisfies Command[];
    before.switches = [{ id: switchId, name: "문 열림" }];
    source.pages![0].commands = write;
    const dormant: GameEvent = { ...source, id: "ev_gate", x: 4, commands: write,
      pages: [{ ...source.pages![0], conditions: [on], commands: [] }] };
    const guarded = withEvents(before, [source, dormant]);
    const target = mapTarget(guarded, MAP, EVENT)!;
    expect(runtimeEventView(dormant, startSession(guarded), {}).pageId).toBeUndefined();
    expect(() => runPrimitive(guarded, target, "event.tile.remove", {})).toThrow(/진행에 필요한 스위치/u);
  });

  it.each([
    { kind: "switch", storyFlagId: "gate-open" }, { kind: "storyFlag", flagId: "gate-open" },
  ] as const)("퀘스트 그래프의 스토리 플래그가 기다리는 스위치의 마지막 작성자를 지우지 않는다 (%o)", completesWhen => {
    const before = blank();
    const switchId = "sw_gate";
    before.switches = [{ id: switchId, name: "문 열림" }];
    before.storyFlags = [{ id: "gate-open", kind: "switch", targetId: switchId, description: "문 열림" }];
    before.quests = [{ kind: "graph", id: "quest_gate", title: "문 열기", edges: [], nodes: [
      { id: "gate", description: "문을 연다", completesWhen },
    ] }];
    before.maps[MAP].events[0].pages![1].commands = [{ kind: "setSwitch", switchId, value: true }];
    const target = mapTarget(before, MAP, EVENT)!;
    expect(() => runPrimitive(before, target, "event.tile.remove", {})).toThrow(/진행에 필요한 스위치/u);
    expect(() => runPrimitive(before, target, "event.page.remove", { page: 2 })).toThrow(/기다리는 스위치/u);
  });

  it("레거시 명령이나 삭제할 페이지의 분기에서만 켜는 스위치도 보호한다", () => {
    const before = blank();
    const event = before.maps[MAP].events[0];
    const switchId = "sw_gate";
    const setter: Command = { kind: "loop", body: [{ kind: "setSwitch", switchId, value: true }] };
    before.switches = [{ id: switchId, name: "문 열림" }];
    event.pages![1].commands = [setter];
    before.commonEvents = [{ id: "ce_gate", name: "문 열기", trigger: "auto", conditionSwitchId: switchId, commands: [setter] }];
    expect(() => runPrimitive(before, mapTarget(before, MAP, EVENT)!, "event.page.remove", { page: 2 })).toThrow(/스위치/u);
    const legacy = withEvents(before, [{ ...event, pages: undefined, commands: [setter] }]);
    expect(() => runPrimitive(legacy, mapTarget(legacy, MAP, EVENT)!, "event.tile.remove", {})).toThrow(/스위치/u);
  });

  it("남는 페이지가 기다리는 셀프 스위치를 유일하게 켜는 페이지는 삭제하지 않는다", () => {
    const before = blank();
    const [first, second] = before.maps[MAP].events[0].pages!;
    first.commands = [{ kind: "setSelfSwitch", key: "A", value: true }];
    second.conditions = [{ kind: "selfSwitch", key: "A", value: true }];
    second.commands = [...first.commands];
    expect(() => runPrimitive(before, mapTarget(before, MAP, EVENT)!, "event.page.remove", { page: 1 })).toThrow(/셀프 스위치를 켤 수 없어요/u);
  });

  it("기본 페이지가 실행을 가리면 옛 이벤트 명령을 스위치의 대체 작성자로 보지 않는다", () => {
    const before = blank();
    const event = before.maps[MAP].events[0];
    const [first, second] = event.pages!;
    const switchId = "sw_gate";
    before.switches = [{ id: switchId, name: "문 열림" }];
    event.commands = [{ kind: "setSwitch", switchId, value: true }, { kind: "setSelfSwitch", key: "A", value: true }];
    first.commands = [...event.commands];
    second.conditions = [{ kind: "selfSwitch", key: "A", value: true }];
    event.pages!.unshift({ ...first, id: "fallback", commands: [], conditions: [] });
    const target = mapTarget(before, MAP, EVENT)!;
    expect(() => runPrimitive(before, target, "event.page.remove", { page: 2 })).toThrow(/셀프 스위치를 켤 수 없어요/u);
    const gated: EventPage = { ...second, conditions: [{ kind: "switch", switchId, value: true }] };
    const withGlobalSwitch = withEvents(before, [{ ...event, pages: [...event.pages!.slice(0, 2), gated] }]);
    expect(() => runPrimitive(withGlobalSwitch, target, "event.page.remove", { page: 2 })).toThrow(/다른 곳에서 기다리는 스위치/u);
  });

  it("엔딩 조건이 기다리는 스위치의 마지막 작성자를 지우지 않는다", () => {
    const before = blank();
    const switchId = "sw_ending";
    before.switches = [{ id: switchId, name: "엔딩 잠금 해제" }];
    before.endings = [{ id: "end_test", name: "시험 엔딩", priority: 1, conditions: [{ kind: "switch", switchId, value: true }] }];
    before.maps[MAP].events[0].pages![1].commands = [{ kind: "setSwitch", switchId, value: true }];
    const target = mapTarget(before, MAP, EVENT)!;
    expect(() => runPrimitive(before, target, "event.page.remove", { page: 2 })).toThrow(/스위치/u);
    expect(() => runPrimitive(before, target, "event.tile.remove", {})).toThrow(/스위치/u);
  });

  it.each(["이벤트 명령", "페이지 조건", "공용 이벤트", "부대", "퀘스트", "맵 조명"] as const)("%s에서 가리키는 이벤트는 삭제를 거절한다", source => {
    const before = blank();
    const map = before.maps[MAP];
    const [event] = map.events;
    const reference: Command = { kind: "callMapEvent", eventId: EVENT };
    switch (source) {
      case "이벤트 명령":
        map.events.push({ ...event, id: "ev_other", x: 1, pages: undefined, commands: [
          { kind: "choices", options: [{ text: "실행", branch: [{ kind: "loop", body: [reference] }] }] },
        ] });
        break;
      case "페이지 조건":
        map.events.push({ ...event, id: "ev_other", x: 1, pages: [{
          ...event.pages![0], conditions: [{ kind: "not", condition: { kind: "pursuitActive", eventId: EVENT, value: true } }],
        }] });
        break;
      case "공용 이벤트":
        before.commonEvents = [{ id: "ce_test", name: "공용 실행", trigger: "none", commands: [reference] }];
        break;
      case "부대":
        before.database = { ...before.database, troops: [{
          id: "troop_ref", name: "참조 시험", enemyIds: [], autoAlign: true,
          battleEventPages: [{ id: "battle_ref", name: "시험", conditions: [], span: "battle", commands: [reference] }],
        }] };
        break;
      case "퀘스트":
        before.quests = [{ key: "quest_ref", title: "시험", summary: "시험 의뢰", giver: { mapId: MAP, eventId: EVENT }, steps: [] }];
        break;
      case "맵 조명":
        map.defaultLighting = { ambient: 1, sources: [{ id: "light_ref", at: { eventId: EVENT }, radius: 3, intensity: 1 }] };
        break;
    }
    expect(() => runPrimitive(before, mapTarget(before, MAP, EVENT)!, "event.tile.remove", {})).toThrow(/다른 곳에서 이 이벤트/u);
    expect(map.events[0]).toBe(event);
  });

  it("이름으로 찾는 목표가 끊기면 거절하고 ID로 지정된 목표는 이름을 바꿔도 유지한다", () => {
    const withObjective = (eventId?: string) => {
      const project = blank();
      const objective: Command = { kind: "m2Command", commandId: "m2-214-ui-command", fields: {
        surface: "objectiveChip", message: "보상 상자를 확인하세요.",
        ...(eventId ? { targetMapId: MAP, targetEventId: eventId } : {}),
      } };
      project.commonEvents = [{ id: "ce_goal", name: "목표", trigger: "none", commands: [objective] }];
      return project;
    };
    const named = withObjective();
    const target = mapTarget(named, MAP, EVENT)!;
    const rename = (project: Project) => runPrimitive(project, target, "event.tile.rename", { name: "나무 궤짝" });
    expect(() => rename(named)).toThrow(/목표가 이 이벤트를 이름으로/u);
    expect(() => runPrimitive(named, target, "event.tile.remove", {})).toThrow(/다른 곳에서 이 이벤트/u);
    expect(() => rename(withObjective("missing_event"))).toThrow(/목표가 이 이벤트를 이름으로/u);
    const linked = withObjective(EVENT);
    const { after } = rename(linked);
    expect(after.maps[MAP].events[0]).toMatchObject({ id: EVENT, name: "나무 궤짝" });
    expect(after.commonEvents).toBe(linked.commonEvents);
    expect(() => runPrimitive(linked, target, "event.tile.remove", {})).toThrow(/다른 곳에서 이 이벤트/u);
    const fallback = withObjective(EVENT);
    fallback.maps[MAP].events[0].pages![1].commands = [];
    expect(() => rename(fallback)).toThrow(/목표가 이 이벤트를 이름으로/u);
  });

  it.each<Command>([
    { kind: "text", speakerActor: EVENT, body: "왔어요." },
    { kind: "text", addressee: EVENT, body: "들어 보세요." },
    { kind: "m2Command", commandId: "m2-201-camera-control", fields: { mode: "follow", target: `event:${EVENT}` } },
    { kind: "moveEvent", eventId: "@player", route: { moves: [{ kind: "turnToward", target: EVENT }], repeat: false } },
  ])("중첩한 연출 명령의 이벤트 참조를 삭제 전에 검사한다 (%o)", command => {
    const before = blank();
    before.commonEvents = [{ id: "ce_stage", name: "연출", trigger: "none", commands: [
      { kind: "choices", options: [{ text: "실행", branch: [] }], cancelBranch: [command] },
    ] }];
    expect(() => runPrimitive(before, mapTarget(before, MAP, EVENT)!, "event.tile.remove", {})).toThrow(/다른 곳에서 이 이벤트/u);
  });

  it.each<Command>([
    { kind: "text", speaker: "보상 상자", body: "왔어요." },
    { kind: "fork", condition: { kind: "eventSeesPlayer", eventId: "", watchers: { name: "보상 상자" } }, then: [] },
  ])("대사나 조건이 이벤트를 이름으로 찾으면 삭제와 이름 변경을 거절한다 (%o)", command => {
    const before = blank();
    const map = before.maps[MAP];
    map.events.push({ id: "ev_stage", name: "연출", x: 4, y: 4, trigger: { kind: "auto" }, commands: [command] });
    const target = mapTarget(before, MAP, EVENT)!;
    expect(() => runPrimitive(before, target, "event.tile.remove", {})).toThrow(/다른 곳에서 이 이벤트/u);
    expect(() => runPrimitive(before, target, "event.tile.rename", { name: "나무 궤짝" })).toThrow(/이벤트를 이름으로/u);
    expect(runPrimitive(before, target, "event.tile.rename", { name: "낡은 보상 상자" }).after.maps[MAP].events[0].name).toBe("낡은 보상 상자");
  });

  it("같은 이름으로 바꾸어 대사의 화자가 선택한 이벤트로 바뀌면 거절한다", () => {
    const before = blank();
    const [speaking] = before.maps[MAP].events;
    speaking.name = "점원";
    speaking.pages![0].commands = [{ kind: "text", speaker: "문지기", body: "문을 열게요." }];
    before.maps[MAP].events.push({ id: "ev_gatekeeper", name: "문지기", x: 4, y: 4, sprite,
      trigger: { kind: "action" }, commands: [] });
    const target = mapTarget(before, MAP, EVENT)!;
    expect(() => runPrimitive(before, target, "event.tile.rename", { name: "문지기" })).toThrow(/이벤트를 이름으로/u);
    expect(runPrimitive(before, target, "event.tile.rename", { name: "상인" }).after.maps[MAP].events[0].name).toBe("상인");
  });

  it("페이지가 여러 장이면 선택한 페이지나 명시한 페이지 번호를 사용한다", () => {
    const before = blank();
    const target = mapTarget(before, MAP, EVENT)!;
    expect(() => runPrimitive(before, target, "event.page.patch", { direction: "left" })).toThrow(SELECT_EVENT_PAGE);
    const { after } = runPrimitive(before, target, "event.page.patch", { page: 2, direction: "left" });
    expect(after.maps[MAP].events[0].pages?.[1].graphic.direction).toBe("left");
  });

  it("유닛 24의 동작은 소유권 표의 이 유닛 도구만 다룬다", () => {
    const fields = ["commandKinds", "m2Ids", "conditionKinds", "collections", "tools"] as const;
    const coverage = PRIMITIVES.flatMap(primitive => fields.flatMap(field =>
      (primitive.covers[field] ?? []).map(key => `${field}:${key}`)));
    expect(new Set(coverage)).toEqual(new Set(OWNERSHIP[UNIT].tools.map(key => `tools:${key}`)));
  });

  it("다른 이벤트의 기존 일정 오류가 배열 위치만 바뀌면 삭제를 허용한다", () => {
    const before = blank();
    const map = before.maps[MAP];
    const other: GameEvent = { id: "ev_other", x: 5, y: 5, trigger: { kind: "action" }, commands: [],
      schedule: [{ when: {}, at: { mapId: "removed_map", x: 10, y: 10 } }],
    };
    map.events.push(other);
    const { after } = runPrimitive(before, mapTarget(before, MAP, EVENT)!, "event.tile.remove", {});
    expect(after.maps[MAP].events).toEqual([other]);
    expect(after.maps[MAP].events[0]).toBe(other);
  });

  it("다른 맵의 동명 ID를 가리키는 목표와 그 맵 이벤트를 보존한다", () => {
    const before = blank();
    const other = { ...createBlankMap("다른 맵", 12, 12), id: "map_other" };
    other.events = [{ ...before.maps[MAP].events[0] }];
    before.maps[other.id] = other;
    before.commonEvents = [{ id: "ce_goal", name: "목표", trigger: "none", commands: [
      { kind: "m2Command", commandId: "m2-214-ui-command", fields: { surface: "objectiveChip", message: "다른 맵을 확인하세요.", targetMapId: other.id, targetEventId: EVENT } },
    ] }];
    const { after } = runPrimitive(before, mapTarget(before, MAP, EVENT)!, "event.tile.remove", {});
    expect(after.maps[MAP].events).toEqual([]);
    expect(after.maps[other.id]).toBe(other);
    expect(after.commonEvents).toBe(before.commonEvents);
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
