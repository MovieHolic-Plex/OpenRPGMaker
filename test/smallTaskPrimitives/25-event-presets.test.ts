/** @vitest-environment happy-dom */
import { expect, it } from "vitest";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/25-event-presets";
import { mapTarget, type SmallTaskTarget } from "@/editor/smallTask/target";
import { createInterpreter } from "@/player/interpreter";
import { createBlankProject } from "@/project/defaults/blankProject";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { GOLD_MAX } from "@/project/economyValues";
import { resolveEventPage } from "@/project/io/pageResolution";
import { deserialize, serialize } from "@/project/io/serialize";
import { startSession } from "@/project/session";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { expectApplies, expectUndoRestores, loadFixture } from "./harness";

const selection = { rect: { x: 2, y: 2, w: 1, h: 1 } };
const invalidSelection = { rect: { ...selection.rect, w: 2 } };
const itemId = "item_potion";
const otherMapId = "map_preset_test_room";
const toRoom = { toMapId: otherMapId, toX: 3, toY: 3 };

function blankWithMap(): Project {
  const fixture = loadFixture("blank");
  const sample = createBlankProject();
  return {
    ...fixture,
    maps: sample.maps,
    mapTree: sample.mapTree,
    startMapId: sample.startMapId,
    startPos: sample.startPos,
    database: { ...fixture.database, items: sample.database.items },
  };
}

function withRoom(project: Project) {
  const map = createBlankMap("안쪽 방", 8, 8);
  project.maps[otherMapId] = { ...map, id: otherMapId };
  project.mapTree.children.push({ mapId: otherMapId, children: [] });
  return project;
}

function checked(project: Project, target: SmallTaskTarget, id: string, args: Record<string, unknown>) {
  const map = project.maps[project.startMapId];
  const snapshot = structuredClone(map.events);
  const result = expectApplies(project, target, id, args, selection);
  expect(result.sentence).toMatch(/[가-힣].*\.$/u);
  expect(result.sentence).not.toMatch(/[{}\[\]]|\b(?:item_|map_|ev_|sw_)/u);
  expect(result.sentence.length).toBeLessThanOrEqual(80);
  expect(jsonEqual(map.events, snapshot)).toBe(true);
  return result;
}

function eventAt(project: Project, mapId = project.startMapId): GameEvent {
  return project.maps[mapId].events.find(event => event.x === selection.rect.x && event.y === selection.rect.y)!;
}

function runEvent(project: Project, event: GameEvent, session = startSession(project)) {
  const page = resolveEventPage(event, session);
  return createInterpreter(page?.commands ?? event.commands, session, project, { currentEventId: event.id });
}

function stockScenario() {
  const project = loadFixture("built");
  const eq = project.database.equipment[0]!;
  const merchant: GameEvent = {
    id: "ev_preset_test_merchant", name: "약초상", x: 2, y: 2, trigger: { kind: "action" },
    commands: [
      { kind: "text", body: "어서 와요." },
      { kind: "shop", itemIds: [eq.id], stock: [{ itemId: eq.id, priceOverride: 37 }], allowSell: false },
    ],
  };
  project.maps[project.startMapId].events.push(merchant);
  return { project, merchant, eq, target: mapTarget(project, project.startMapId, merchant.id)! };
}

function doorScenario() {
  const project = withRoom(blankWithMap());
  const target = mapTarget(project, project.startMapId)!;
  const { after } = runPrimitive(project, target, "event.transfer.place", toRoom, selection);
  const door = eventAt(after);
  return { project: after, door, target: mapTarget(after, after.startMapId, door.id)! };
}

it("주민을 선택 칸에 세우고 대사를 실행한 뒤 한 번에 되돌린다", async () => {
  const project = blankWithMap();
  const target = mapTarget(project, project.startMapId)!;
  const nearby: GameEvent = {
    id: "ev_existing_merchant", name: "잡화점 주인", x: 3, y: 2, trigger: { kind: "action" }, commands: [],
  };
  project.maps[project.startMapId].events.push(nearby);
  const args = { name: "나루 상인", dialogue: "배는 정오에 떠나요." };
  const id = "event.npc.place";
  const { after, sentence } = checked(project, target, id, args);
  expect(sentence).toBe("선택한 칸에 주민 「나루 상인」을 놓아요.");
  expect(after.maps[after.startMapId].events[0]).toBe(nearby);
  const npc = eventAt(after);
  expect(npc).toMatchObject({ name: args.name, x: 2, y: 2, placementRole: "npc", pages: [{ movement: { type: "fixed" } }] });
  expect(npc.pages![0].graphic.sprite?.id).toBeTruthy();
  expect(npc.pages![0].commands).toContainEqual({ kind: "text", speaker: args.name, body: args.dialogue });
  expect(runEvent(after, npc).start()).toMatchObject({ kind: "text", body: args.dialogue });
  expect(() => runPrimitive(project, target, id, args, invalidSelection)).toThrow("범위 밖");
  await expectUndoRestores(project, after, target);
});

it("받침이 없는 주민 이름에는 '를'을 붙인다", () => {
  const project = blankWithMap();
  const target = mapTarget(project, project.startMapId)!;
  const npc = PRIMITIVES.find(primitive => primitive.id === "event.npc.place")!;
  expect(npc.describe({ project, target, selection }, { name: "루나" })).toBe("선택한 칸에 주민 「루나」를 놓아요.");
});

it("상자는 포션 세 개를 한 번만 지급하고 한 작업으로 되돌린다", async () => {
  const project = blankWithMap();
  const target = mapTarget(project, project.startMapId)!;
  const id = "event.chest.place";
  const args = { itemId, count: 3 };
  const { after, sentence } = checked(project, target, id, args);
  const chest = eventAt(after);
  expect(sentence).toContain("3개");
  expect(chest.pages!.map(page => page.conditions)).toEqual([
    [{ kind: "selfSwitch", key: "A", value: false }],
    [{ kind: "selfSwitch", key: "A", value: true }],
  ]);
  expect(chest.pages![0].commands).toContainEqual({ kind: "changeItem", itemId, op: "+=", amount: 3 });
  const session = startSession(after);
  const initialCount = session.inventory[itemId] ?? 0;
  const interpreter = runEvent(after, chest, session);
  let result = interpreter.start();
  for (let step = 0; result.kind !== "done" && step < 12; step++) result = interpreter.resume();
  expect(result.kind).toBe("done");
  expect(session.inventory[itemId]).toBe(initialCount + 3);
  expect(runEvent(after, chest, session).start()).toMatchObject({ kind: "text", body: "상자는 비어 있다." });
  expect(() => runPrimitive(project, target, id, args, invalidSelection)).toThrow("범위 밖");
  expect(() => runPrimitive(project, target, id, { itemId: "item_missing" }, selection)).toThrow("찾을 수 없어요");
  await expectUndoRestores(project, after, target);
});

it.each(["addStock", "removeStock"] as const)("상점 상품 %s는 나머지 설정을 보존하고 되돌릴 수 있다", async operation => {
  const { project, merchant, eq, target } = stockScenario();
  const adding = operation === "addStock";
  const id = `event.shop.${operation}`;
  const args = adding ? { itemId, price: 21 } : { itemId: eq.id };
  const { after, sentence } = checked(project, target, id, args);
  expect(sentence).toContain(adding ? "기본 판매가 21골드로 진열해요" : "빼요");
  const saved = after.maps[after.startMapId].events.find(event => event.id === merchant.id)!;
  const itemIds = adding ? [eq.id, itemId] : [];
  expect(saved.commands).toEqual([
    merchant.commands[0],
    {
      kind: "shop", itemIds, allowSell: false,
      stock: adding ? [{ itemId: eq.id, priceOverride: 37 }, { itemId, priceOverride: 21 }] : [],
    },
  ]);
  const interpreter = runEvent(after, saved);
  expect(interpreter.start()).toMatchObject({ kind: "text", body: "어서 와요." });
  expect(interpreter.resume()).toMatchObject({ kind: "shop", itemIds });
  expect(() => runPrimitive(project, { ...target, x: 3 }, id, args)).toThrow("범위 밖");
  await expectUndoRestores(project, after, target);
});

it("상점 가격 상한은 저장 형식과 맞고, 초과하면 원본을 보존한다", () => {
  const { project, merchant, eq, target } = stockScenario();
  const id = "event.shop.addStock";
  const max = 999_999;
  const args = { itemId, price: max };
  const original = structuredClone(merchant.commands);
  expect(() => runPrimitive(project, target, id, { ...args, price: max + 1 })).toThrow(PrimitiveError);
  expect(merchant.commands).toEqual(original);

  const { after } = runPrimitive(project, target, id, args);
  const reloaded = deserialize(serialize(after));
  const saved = reloaded.maps[reloaded.startMapId].events.find(event => event.id === merchant.id)!;
  const interpreter = runEvent(reloaded, saved);
  interpreter.start();
  expect(interpreter.resume()).toMatchObject({ kind: "shop", items: [
    { itemId: eq.id }, { itemId, price: max },
  ] });
});

it("마지막 진열 상품을 빼면 저장 후 다른 상품이 되살아나는 경우 거절한다", () => {
  const { project, merchant, eq, target } = stockScenario();
  const shop = merchant.commands[1] as Extract<Command, { kind: "shop" }>;
  shop.itemIds.push(itemId);
  const page: EventPage = {
    id: "p_preset_stock", name: "상점", conditions: [], graphic: { transparent: true },
    trigger: merchant.trigger, priority: "same", commands: merchant.commands,
  };
  merchant.pages = [page];
  merchant.commands = [];
  const original = structuredClone(page.commands);
  const interpreter = runEvent(project, merchant);
  interpreter.start();
  expect(interpreter.resume()).toMatchObject({ kind: "shop", items: [{ itemId: eq.id }] });
  expect(() => runPrimitive(project, target, "event.shop.removeStock", { itemId: eq.id }))
    .toThrow("상품 목록과 진열 설정이 서로 달라요");
  expect(page.commands).toEqual(original);
});

it("선택한 상점 페이지의 여러 분기를 편집하고 기존 가격·계절·다른 페이지를 보존한다", async () => {
  const { project, merchant, eq } = stockScenario();
  const offer = { itemId, priceOverride: 5, priceBySeason: { winter: 12 }, seasons: ["winter"] as const, displayTileId: 0 };
  const firstShop: Command = { kind: "shop", itemIds: [itemId, eq.id], stock: [offer, { itemId: eq.id }], allowSell: false };
  const nestedShop: Command = { kind: "shop", itemIds: [eq.id], title: "밤 상점" };
  const inn: Command = { kind: "inn", price: 3, branchOnNotEnoughGold: true, notEnoughBranch: [nestedShop] };
  const choice: Command = {
    kind: "choices", options: [
      { text: "상점", branch: [firstShop] },
      { text: "숙박", branch: [inn] },
    ],
    cancelBehavior: "branch", cancelBranch: [{ kind: "text", body: "다음에 오세요." }],
  };
  const page: EventPage = {
    id: "p_selected_shop", name: "상점", conditions: [], graphic: { transparent: true },
    trigger: { kind: "action" }, priority: "below", commands: [choice],
  };
  const sibling = { ...page, id: "p_other_shop", commands: [{ kind: "shop", itemIds: [eq.id] }] } satisfies EventPage;
  merchant.pages = [page, sibling];
  const target = mapTarget(project, project.startMapId, merchant.id, page.id)!;
  const id = "event.shop.addStock";
  const { after } = checked(project, target, id, { itemId, price: 0 });
  const saved = after.maps[after.startMapId].events.find(event => event.id === merchant.id)!;
  expect(saved.pages![0]!.commands).toEqual([{ ...choice, options: [
    { text: "상점", branch: [{ ...firstShop, stock: [{ ...offer, priceOverride: 0 }, { itemId: eq.id }] }] },
    { text: "숙박", branch: [{ ...inn, notEnoughBranch: [{ ...nestedShop, itemIds: [eq.id, itemId], stock: [{ itemId: eq.id }, { itemId, priceOverride: 0 }] }] }] },
  ] }]);
  expect(saved.pages![1]).toBe(sibling);
  expect(saved.commands).toBe(merchant.commands);
  expect(() => runPrimitive(project, target, id, { itemId, price: GOLD_MAX + 1 })).toThrow(PrimitiveError);
  expect(() => runPrimitive(project, target, id, { itemId, pageId: sibling.id })).toThrow(PrimitiveError);
  await expectUndoRestores(project, after, target);

  const addedPage = saved.pages![0]!;
  const removed = runPrimitive(after, target, "event.shop.removeStock", { itemId }).after;
  const edited = removed.maps[removed.startMapId].events.find(event => event.id === merchant.id)!;
  expect(edited.pages![0]!.commands).toEqual([{ ...addedPage.commands[0], options: [
    { text: "상점", branch: [{ ...firstShop, itemIds: [eq.id], stock: [{ itemId: eq.id }] }] },
    { text: "숙박", branch: [{ ...inn, notEnoughBranch: [{ ...nestedShop, stock: [{ itemId: eq.id }] }] }] },
  ] }]);
  expect(edited.pages![1]).toBe(sibling);
});

it("없는 진열품과 상점 명령이 없는 페이지는 이유를 알려 주고 원본을 보존한다", () => {
  const { project, merchant, target } = stockScenario();
  expect(() => runPrimitive(project, target, "event.shop.removeStock", { itemId })).toThrow("팔고 있는 상품이 아니에요");
  const page: EventPage = {
    id: "p_quest", name: "의뢰", conditions: [], graphic: { transparent: true },
    trigger: { kind: "action" }, priority: "below", commands: [{ kind: "text", body: "길을 찾아 주세요." }],
  };
  merchant.pages = [page, { ...page, id: "p_shop", commands: merchant.commands }];
  const pageTarget = mapTarget(project, project.startMapId, merchant.id, page.id)!;
  const original = structuredClone(merchant);
  expect(() => runPrimitive(project, pageTarget, "event.shop.addStock", { itemId })).toThrow("상점을 찾을 수 없어요");
  expect(() => runPrimitive(project, { ...pageTarget, pageId: "p_old" }, "event.shop.addStock", { itemId })).toThrow("페이지를 다시 선택");
  expect(merchant).toEqual(original);
});

it("표지판은 그림과 안내 한 줄을 저장하고 원래 칸을 복원한다", async () => {
  const project = blankWithMap();
  const target = mapTarget(project, project.startMapId)!;
  const id = "event.sign.place";
  const args = { text: "환영합니다. 북쪽은 시장입니다." };
  const { after, sentence } = checked(project, target, id, args);
  const sign = eventAt(after);
  expect(sentence).toContain("북쪽은 시장입니다.");
  expect(sign).toMatchObject({ name: "표지판", x: 2, y: 2, pages: [{ trigger: { kind: "action" }, commands: [{ kind: "text", body: args.text }] }] });
  expect(sign.pages![0].graphic.sprite?.id).toBeTruthy();
  expect(runEvent(after, sign).start()).toMatchObject({ kind: "text", body: args.text });
  expect(() => runPrimitive(project, target, id, args, invalidSelection)).toThrow("범위 밖");
  await expectUndoRestores(project, after, target);
});

it("편도 출입구는 출발 칸만 쓰고 지정한 칸에 도착하며 한 번에 되돌린다", async () => {
  const project = withRoom(blankWithMap());
  const target = mapTarget(project, project.startMapId)!;
  const id = "event.transfer.place";
  const { after, sentence } = checked(project, target, id, toRoom);
  expect(sentence).toBe("「안쪽 방」으로 가는 출입구를 놓아요.");
  const gate = eventAt(after);
  const expected = { kind: "transfer", mapId: otherMapId, x: 3, y: 3, direction: "retain", fade: "black" };
  expect(gate.pages![0].commands).toEqual([expected]);
  expect(after.maps[otherMapId]).toBe(project.maps[otherMapId]);
  expect(runEvent(after, gate).start()).toMatchObject(expected);
  expect(() => runPrimitive(project, target, id, toRoom, invalidSelection)).toThrow("범위 밖");
  expect(() => runPrimitive(project, target, id, { ...toRoom, toMapId: "map_missing" }, selection)).toThrow("찾을 수 없어요");
  await expectUndoRestores(project, after, target);
});

it("양쪽 출입구를 쓰는 왕복 요청은 선택한 한 칸의 범위 가드가 거절한다", async () => {
  const project = withRoom(blankWithMap());
  const target = mapTarget(project, project.startMapId)!;
  const id = "event.transfer.placePair";
  const original = Object.values(project.maps).map(map => map.events.length);
  const pair = PRIMITIVES.find(primitive => primitive.id === id)!;
  const ctx = { project, target, selection };
  expect(pair.describe(ctx, toRoom)).toBe("「안쪽 방」과 오가는 출입구를 놓아요.");
  expect(() => runPrimitive(project, target, id, toRoom, selection)).toThrow(/범위 밖.*두 곳을 고치는 일/u);
  expect(() => pair.apply(ctx, toRoom)).toThrow(/범위 밖.*두 곳을 고치는 일/u);
  expect(Object.values(project.maps).map(map => map.events.length)).toEqual(original);
  const { after: one } = runPrimitive(project, target, "event.transfer.place", toRoom, selection);
  const returnTarget = mapTarget(one, otherMapId)!;
  const { after: both } = runPrimitive(one, returnTarget, "event.transfer.place", {
    toMapId: project.startMapId, toX: 3, toY: 2,
  }, selection);
  expect(both.maps[project.startMapId].events).toHaveLength(original[0] + 1);
  expect(both.maps[otherMapId].events).toHaveLength(original[1] + 1);
  await expectUndoRestores(one, both, returnTarget);
});

it("나중 페이지의 발자국까지 확인해 배치와 출입구 도착을 거절한다", () => {
  const { project, door } = doorScenario();
  const room = project.maps[otherMapId];
  const original = door.pages![0]!;
  room.events.push({ ...door, id: "ev_wide_prop", x: 3, y: 4, pages: [
    { ...original, id: "p_small", commands: [] },
    { ...original, id: "p_wide", footprint: { width: 3, height: 2 }, commands: [] },
  ] });
  const destinationTarget = mapTarget(project, otherMapId)!;
  const cell = { rect: { x: 3, y: 3, w: 1, h: 1 } };
  expect(() => runPrimitive(project, destinationTarget, "event.chest.place", { gold: 10 }, cell)).toThrow("이미 이벤트가 있어요");
  expect(() => runPrimitive(project, mapTarget(project, project.startMapId)!, "event.transfer.place", toRoom, {
    rect: { ...selection.rect, x: 5 },
  })).toThrow("도착할 수 있는 빈 칸");
  expect(room.events).toHaveLength(1);
});

it("막힌 선택 칸에 놓는 상자와 출입구는 주변 칸으로 옮기지 않고 거절한다", () => {
  const project = withRoom(blankWithMap());
  const map = project.maps[project.startMapId];
  const floor = map.lowerTiles[0]!;
  map.lowerTiles.fill(-1);
  map.lowerTiles[5 * map.width + 5] = floor;
  const target = mapTarget(project, map.id)!;
  expect(() => runPrimitive(project, target, "event.chest.place", { gold: 50 }, selection)).toThrow(PrimitiveError);
  expect(() => runPrimitive(project, target, "event.transfer.place", toRoom, selection)).toThrow(PrimitiveError);
  expect(map.events).toEqual([]);
});

it.each([
  ["event.npc.place", { name: "   " }],
  ["event.chest.place", { count: 100, itemId }],
  ["event.chest.place", { gold: GOLD_MAX + 1 }],
  ["event.sign.place", { text: " \n " }],
  ["event.transfer.place", { ...toRoom, toX: 8 }],
  ["event.transfer.place", { ...toRoom, toX: 2.5 }],
] as const)("잘못된 %s 입력에는 한국어 거절을 반환한다", (id, args) => {
  const project = withRoom(blankWithMap());
  expect(() => runPrimitive(project, mapTarget(project, project.startMapId)!, id, args, selection)).toThrow(PrimitiveError);
  expect(project.maps[project.startMapId].events).toEqual([]);
});

it("문 잠금은 기존 조건과 이동을 보존하며 열쇠가 있을 때 통과시킨다", async () => {
  const { project, door, target } = doorScenario();
  const switchId = "sw_preset_test_story";
  project.switches.push({ id: switchId, name: "이야기 진행" });
  const opening = door.pages![0];
  opening.conditions = [{ kind: "switch", switchId, value: true }];
  const id = "event.door.setLock";
  const args = { itemId, text: "열쇠가 필요하다." };
  const { after, sentence } = checked(project, target, id, args);
  const locked = eventAt(after);
  expect(sentence).toContain("있어야 문이 열리게");
  expect(locked.pages![0]).toEqual(opening);
  expect(locked.pages![1].conditions).toEqual([
    ...opening.conditions, { kind: "not", condition: { kind: "item", itemId, present: true } },
  ]);
  expect(locked.pages![1].conditions[0]).not.toBe(opening.conditions[0]);
  const session = startSession(after);
  session.inventory[itemId] = 0;
  expect(resolveEventPage(locked, session)).toBeUndefined();
  session.switches[switchId] = true;
  expect(runEvent(after, locked, session).start()).toMatchObject({ kind: "text", body: args.text });
  session.inventory[itemId] = 1;
  expect(runEvent(after, locked, session).start()).toMatchObject({ kind: "transfer", mapId: otherMapId });
  const again = runPrimitive(after, target, id, args);
  expect(again.after.maps[after.startMapId].events).toEqual(after.maps[after.startMapId].events);
  expect(() => runPrimitive(project, { ...target, x: 4 }, id, args)).toThrow("범위 밖");
  expect(() => runPrimitive(project, target, id, { switchId: "sw_missing" })).toThrow("스위치를 찾을 수 없어요");
  await expectUndoRestores(project, after, target);
});

it("문을 다시 잠글 때 앞뒤 페이지와 기존 명령을 보존하고 잠금만 갱신한다", () => {
  const { project, door } = doorScenario();
  const original = door.pages![0]!;
  const switchId = "sw_preset_test_repair";
  project.switches.push({ id: switchId, name: "수리 완료" });
  const later: EventPage = {
    ...original, id: "p_later", conditions: [{ kind: "switch", switchId, value: true }],
    commands: [{ kind: "text", body: "수리 중에는 다른 문을 써 주세요." }],
  };
  door.pages!.push(later);
  const id = "event.door.setLock";
  const target = mapTarget(project, project.startMapId, door.id)!;
  const after = runPrimitive(project, target, id, { itemId }).after;
  const replaced = runPrimitive(after, target, id, { switchId, text: "문이 굳게 닫혔어요." }).after;
  const pages = eventAt(replaced).pages!;
  expect(pages).toHaveLength(3);
  expect(pages[0]).toBe(original);
  expect(pages[1]).toMatchObject({ conditions: [{ kind: "not", condition: { kind: "switch", switchId, value: true } }] });
  expect(pages[2]).toBe(later);
  const session = startSession(replaced);
  expect(runEvent(replaced, eventAt(replaced), session).start()).toMatchObject({ kind: "text", body: "문이 굳게 닫혔어요." });
  session.switches[switchId] = true;
  expect(resolveEventPage(eventAt(replaced), session)).toBe(later);
});

it("기존 잠금 페이지와 식별자가 겹치거나 분기에서 이동하면 원본을 보존하며 거절한다", () => {
  const { project, door, target } = doorScenario();
  const original = door.pages![0]!;
  const custom: EventPage = {
    ...original, id: `${original.id}_preset_locked`, commands: [{ kind: "text", body: "별도로 만든 안내입니다." }],
  };
  door.pages!.push(custom);
  const id = "event.door.setLock";
  expect(() => runPrimitive(project, target, id, { itemId })).toThrow("잠금 페이지를 구분할 수 없어요");
  expect(door.pages).toEqual([original, custom]);

  const branched: EventPage = {
    ...original, id: "p_branch", commands: [{ kind: "choices", options: [{ text: "나가기", branch: original.commands }], cancelBehavior: "disallow" }],
  };
  door.pages = [original, branched];
  expect(() => runPrimitive(project, target, id, { itemId })).toThrow("분기, 다른 이벤트 호출, 페이지 밖 명령");
  expect(door.pages).toEqual([original, branched]);
});

it("페이지 하나를 골랐을 때는 다른 페이지를 추가하거나 이미 있는 잠금을 바꾸지 않는다", () => {
  const { project, door, target: eventTarget } = doorScenario();
  const first = door.pages![0]!;
  const target = mapTarget(project, project.startMapId, door.id, first.id)!;
  const id = "event.door.setLock";
  expect(() => runPrimitive(project, target, id, { itemId })).toThrow("맵에서 문 이벤트 전체를 골라 주세요");
  expect(door.pages).toEqual([first]);

  const { after } = runPrimitive(project, eventTarget, id, { itemId });
  const pages = structuredClone(eventAt(after).pages);
  expect(() => runPrimitive(after, target, id, { itemId, text: "새 잠금 안내" })).toThrow("범위 밖");
  expect(eventAt(after).pages).toEqual(pages);
});

it("다른 페이지가 공용 이벤트와 맵 이벤트를 거쳐서 이동하면 잠금을 거절한다", () => {
  const { project, door, target } = doorScenario();
  const open = door.pages![0]!;
  const relayId = "ev_preset_relay";
  const commonId = "ce_preset_relay";
  const relay: GameEvent = {
    id: relayId, name: "이동 중계", x: 6, y: 6, trigger: { kind: "action" }, commands: [...open.commands],
  };
  project.maps[project.startMapId].events.push(relay);
  project.commonEvents.push({
    id: commonId, name: "문 이동", trigger: "none",
    commands: [{ kind: "callMapEvent", eventId: relayId }, { kind: "callCommonEvent", commonEventId: commonId }],
  });
  const later: EventPage = {
    ...open, id: "p_preset_indirect_transfer", commands: [{ kind: "callCommonEvent", commonEventId: commonId }],
  };
  door.pages!.push(later);
  const original = structuredClone(project.maps[project.startMapId].events);
  expect(() => runPrimitive(project, target, "event.door.setLock", { itemId })).toThrow("다른 이벤트 호출");
  expect(project.maps[project.startMapId].events).toEqual(original);
});

it("다른 페이지에서 저장한 위치로도 이동할 수 있으면 잠금을 거절한다", () => {
  const { project, door, target } = doorScenario();
  door.pages!.push({ ...door.pages![0]!, id: "p_return", commands: [{ kind: "recallParty", partySetId: "return" }] });
  expect(() => runPrimitive(project, target, "event.door.setLock", { itemId })).toThrow("이동할 수 있어요");
});

it.each(["auto", "parallel"] as const)("자동 이동(%s)은 잠금 안내가 반복될 수 있어 거절한다", kind => {
  const { project, door, target } = doorScenario();
  door.pages![0]!.trigger = { kind };
  const pages = structuredClone(door.pages);
  expect(() => runPrimitive(project, target, "event.door.setLock", { itemId })).toThrow("잠금 안내가 반복될 수 있으니");
  expect(door.pages).toEqual(pages);
});

it("마왕 프로젝트의 여러 칸짜리 출구 잠금은 다른 이벤트까지 바꾸므로 거절한다", () => {
  const project = loadFixture("maou");
  const map = Object.values(project.maps).find(candidate =>
    candidate.events.some(event => event.id.startsWith("ev_mk_pk_exit_")))!;
  const door = map.events.find(event => event.id.startsWith("ev_mk_pk_exit_"))!;
  const target = mapTarget(project, map.id, door.id)!;
  const before = structuredClone(map.events);
  expect(() => runPrimitive(project, target, "event.door.setLock", {
    switchId: project.switches[0].id,
  })).toThrow("범위 밖");
  expect(map.events).toEqual(before);
}, 120_000);
