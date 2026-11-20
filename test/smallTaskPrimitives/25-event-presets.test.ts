/** @vitest-environment happy-dom */
import { expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/25-event-presets";
import { mapTarget, type SmallTaskTarget } from "@/editor/smallTask/target";
import { createInterpreter } from "@/player/interpreter";
import { createBlankProject } from "@/project/defaults/blankProject";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { resolveEventPage } from "@/project/io/pageResolution";
import { startSession } from "@/project/session";
import type { GameEvent, Project } from "@/project/types";
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
  expect(sentence).toContain(adding ? "21에 진열" : "빼요");
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
  expect(Object.values(project.maps).map(map => map.events.length)).toEqual(original);
  const { after: one } = runPrimitive(project, target, "event.transfer.place", toRoom, selection);
  const returnTarget = mapTarget(one, otherMapId)!;
  const { after: both } = runPrimitive(one, returnTarget, "event.transfer.place", {
    toMapId: project.startMapId, toX: 3, toY: 2,
  }, selection);
  const half = PRIMITIVES.find(primitive => primitive.id === "event.transfer.place")!;
  const scope = half.scope(ctx, toRoom);
  const paired = pair.apply(ctx, toRoom);
  expect(paired.maps[project.startMapId].events).toHaveLength(original[0] + 1);
  expect(paired.maps[otherMapId].events).toHaveLength(original[1] + 1);
  expect(checkSmallTaskScope(project, one, scope)).toEqual({ ok: true });
  expect(checkSmallTaskScope(project, paired, scope)).toMatchObject({ ok: false, reason: expect.stringContaining("범위 밖") });
  await expectUndoRestores(one, both, returnTarget);
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
