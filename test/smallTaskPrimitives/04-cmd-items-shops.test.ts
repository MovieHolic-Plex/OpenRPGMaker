/** @vitest-environment happy-dom */
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import {
  INN_NOT_ENOUGH_BRANCH_INDEX, LOOP_BODY_BRANCH_INDEX, SHOP_FAILED_TRANSACTION_BRANCH_INDEX, SHOP_TRANSACTION_BRANCH_INDEX,
} from "@/editor/eventCommandPaths";
import { readCheckPath, resolveTarget, type CorpusCase } from "@/editor/smallTask/primitives/corpusSchema";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/04-cmd-items-shops";
import { createInterpreter } from "@/player/interpreter";
import { defaultItemRecords } from "@/project/defaults/defaultDatabaseItemRecords";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { GOLD_MAX } from "@/project/economyValues";
import { eventCommandHash } from "@/project/eventCommands/singleCommandOps";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { startSession } from "@/project/session";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { eventTarget, expectApplies, expectRefused, expectUndoRestores, loadFixture, mapTarget } from "./harness";

const potion = "item_potion";
const ether = "item_ether";
const hoe = "item_hoe";
const highPotion = "item_hi_potion";
const recipe = "recipe_test_tonic";
const upgrade = "upgrade_test_potion";
const variable = "var_test_amount";
const lock = "sw_test_chest";
const eventId = "ev_test_merchant";
const pageId = "page_test_purchase";
const opening: Command = { kind: "wait", ms: 10 };
const closing: Command = { kind: "text", body: "또 오세요." };

const cases = [
  {
    kind: "changeGold", insert: { amount: 100 }, initial: { kind: "changeGold", op: "+=", amount: 100 },
    update: { op: "-=", amountVariableId: variable }, next: { kind: "changeGold", op: "-=", amount: { kind: "var", id: variable } },
    invalid: { amountVariableId: "var_missing" }, message: /변수/,
  },
  {
    kind: "changeItem", insert: { itemId: potion, amount: 3 }, initial: { kind: "changeItem", itemId: potion, op: "+=", amount: 3 },
    update: { itemId: highPotion, amount: 1 }, next: { kind: "changeItem", itemId: highPotion, op: "+=", amount: 1 },
    invalid: { itemId: "item_missing" }, message: /물건/,
  },
  {
    kind: "craftRecipe", insert: { recipeId: recipe }, initial: { kind: "craftRecipe", recipeId: recipe },
    update: { resultVariableId: variable }, next: { kind: "craftRecipe", recipeId: recipe, resultVariableId: variable },
    invalid: { recipeId: "recipe_missing" }, message: /제작법/,
  },
  {
    kind: "applyItemUpgrade", insert: { upgradeId: upgrade }, initial: { kind: "applyItemUpgrade", upgradeId: upgrade },
    update: { resultVariableId: variable }, next: { kind: "applyItemUpgrade", upgradeId: upgrade, resultVariableId: variable },
    invalid: { upgradeId: "upgrade_missing" }, message: /강화 규칙/,
  },
  {
    kind: "equipTool", insert: { itemId: hoe }, initial: { kind: "equipTool", itemId: hoe },
    update: { itemId: "" }, next: { kind: "equipTool", itemId: "" },
    invalid: { itemId: "item_missing" }, message: /도구/,
  },
  {
    kind: "openCraftShop", insert: { title: "대장간", recipeIds: [recipe] }, initial: { kind: "openCraftShop", title: "대장간", recipeIds: [recipe] },
    update: { speaker: "대장장이", recipeIds: null }, next: { kind: "openCraftShop", title: "대장간", speaker: "대장장이" },
    invalid: { recipeIds: ["recipe_missing"] }, message: /제작법/,
  },
  {
    kind: "openChest", insert: { displayName: "농장 상자" }, initial: { kind: "openChest", chestId: "", template: "farm", displayName: "농장 상자" },
    update: { lockSwitchId: lock, capacity: 12 },
    next: { kind: "openChest", chestId: "", template: "farm", displayName: "농장 상자", lockSwitchId: lock, capacity: 12 },
    invalid: { lockSwitchId: "sw_missing" }, message: /스위치/,
  },
  {
    kind: "shop", insert: { itemIds: [potion], title: "약방" },
    initial: {
      kind: "shop", itemIds: [potion], title: "약방", allowSell: true, quantityMode: "single", shopType: "normal",
      messageType: "welcome", merchantGold: 100, branchOnTransaction: false, transactionBranch: [],
      branchOnFailedTransaction: false, failedTransactionBranch: [],
    },
    update: { addItemId: highPotion },
    next: {
      kind: "shop", itemIds: [potion, highPotion], title: "약방", allowSell: true, quantityMode: "single", shopType: "normal",
      messageType: "welcome", merchantGold: 100, branchOnTransaction: false, transactionBranch: [],
      branchOnFailedTransaction: false, failedTransactionBranch: [],
    },
    invalid: { itemIds: ["item_missing"] }, message: /물건/,
  },
  {
    kind: "inn", insert: { price: 50 }, initial: { kind: "inn", price: 50 },
    update: { priceVariableId: variable, recoverMp: false, advanceToMorning: true },
    next: { kind: "inn", price: { kind: "var", id: variable }, recoverMp: false, advanceToMorning: true },
    invalid: { priceVariableId: "var_missing" }, message: /변수/,
  },
] as const;

type Fixture = "blank" | "built" | "maou";
const fixtures: readonly Fixture[] = ["blank", "built", "maou"];
const fixtureCache = new Map<Fixture, Project>();

function fixtureFor(name: Fixture): Project {
  const fixture = fixtureCache.get(name) ?? loadFixture(name);
  fixtureCache.set(name, fixture);
  return fixture;
}

// 큰 프로젝트의 초기 저작은 각 명령의 적용·되돌리기 시간과 분리한다.
for (const fixture of fixtures) beforeAll(() => { fixtureFor(fixture); });

function page(id: string, commands: Command[]): EventPage {
  return {
    id, name: "거래", graphic: {}, conditions: [], trigger: { kind: "action" }, priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
  };
}

function setup(fixture: Fixture, commands: readonly unknown[] = [], otherCommands: readonly unknown[] = [closing]) {
  const base = fixtureFor(fixture);
  const project = { ...base };
  project.database = { ...base.database, items: [...base.database.items] };
  for (const [id, name] of [[potion, "회복약"], [ether, "마력약"], [highPotion, "상급 회복약"], [hoe, "괭이"]]) {
    if (!project.database.items.some(row => row.id === id)) {
      project.database.items.push({ ...defaultItemRecords()[0]!, id, name, price: 10 });
    }
  }
  project.variables = [...base.variables, { id: variable, name: "정한 수량" }];
  project.switches = [...base.switches, { id: lock, name: "창고 열기" }];
  project.session = {
    ...base.session, variables: { ...base.session.variables, [variable]: 0 }, switches: { ...base.session.switches, [lock]: false },
  };
  project.system = {
    ...base.system,
    craftRecipes: [{ id: recipe, name: "회복약 조합", ingredients: [{ itemId: ether, count: 1 }], outputItemId: potion, outputCount: 3 }],
    itemUpgrades: [{ id: upgrade, fromItemId: potion, toItemId: highPotion, goldCost: 5 }],
  };
  const mapId = base.startMapId || "map_test_merchant";
  const map = base.maps[mapId] ?? { ...createBlankMap("거래소", 10, 10, Object.keys(base.tilesets)[0]!), id: mapId };
  const event: GameEvent = {
    id: eventId, name: "시험 상인", x: 2, y: 2, trigger: { kind: "action" }, commands: [],
    pages: [page(pageId, structuredClone(commands) as Command[]), page("page_test_after", structuredClone(otherCommands) as Command[])],
  };
  project.maps = { ...base.maps, [mapId]: { ...map, events: [...map.events, event] } };
  project.startMapId = mapId;
  if (!base.startMapId) project.mapTree = { mapId, children: [] };
  const target = eventTarget(project, mapId, eventId, pageId);
  const commandsOf = (p: Project) => p.maps[mapId].events.find(row => row.id === eventId)!.pages![0].commands;
  return { project, target, mapId, commandsOf, event };
}

function checkSentence(sentence: string, verb: string) {
  expect(sentence).toMatch(/[가-힣]/u);
  expect(sentence).not.toMatch(/[{}\[\]\r\n]|\b[a-z]+_[a-z\d_]+\b/iu);
  expect(sentence).toMatch(new RegExp(`${verb}합니다\\.$`, "u"));
  expect(sentence.length).toBeLessThanOrEqual(80);
}

describe.each(cases)("돈·아이템·상점 명령 $kind", ({ kind, insert, initial, update, next, invalid, message }) => {
  const fixture = fixtures[cases.findIndex(row => row.kind === kind) % fixtures.length];

  it("같은 페이지의 지정한 줄에만 추가하고 한 번에 되돌린다", async () => {
    const { project, target, commandsOf } = setup(fixture, [opening, closing]);
    const before = commandsOf(project).slice();
    const result = runPrimitive(project, target, `cmd.${kind}.insert`, { ...insert, index: 1 });
    expect(commandsOf(result.after)).toEqual([opening, initial, closing]);
    expect(commandsOf(project)).toEqual(before);
    checkSentence(result.sentence, "추가");
    await expectUndoRestores(project, result.after, target);
  });

  it("같은 종류의 한 줄만 수정하고 한 번에 되돌린다", async () => {
    const { project, target, commandsOf } = setup(fixture, [opening, initial, closing]);
    const expectedHash = eventCommandHash(commandsOf(project)[1]);
    const result = runPrimitive(project, target, `cmd.${kind}.update`, { ...update, index: 1, expectedHash });
    expect(commandsOf(result.after)).toEqual([opening, next, closing]);
    expect(commandsOf(project)).toEqual([opening, initial, closing]);
    checkSentence(result.sentence, "수정");
    await expectUndoRestores(project, result.after, target);
  });

  it("삽입과 수정에서 없는 참조를 한국어로 거절한다", () => {
    const { project, target, commandsOf } = setup(fixture, [initial]);
    const expectedHash = eventCommandHash(commandsOf(project)[0]);
    const invalidInsert = kind === "inn" || kind === "changeGold" ? invalid : { ...insert, ...invalid };
    for (const [mode, args] of [["insert", invalidInsert], ["update", { index: 0, expectedHash, ...invalid }]] as const) {
      const apply = () => runPrimitive(project, target, `cmd.${kind}.${mode}`, args);
      expect(apply).toThrow(PrimitiveError);
      expect(apply).toThrow(message);
    }
  });

  it("다른 페이지를 바꾸려는 시도를 선택한 페이지 범위로 막는다", () => {
    const { project, target, event, mapId } = setup(fixture, [initial], [initial]);
    const map = project.maps[mapId];
    for (const mode of ["insert", "update"] as const) {
      const primitive = PRIMITIVES.find(row => row.id === `cmd.${kind}.${mode}`)!;
      const args = mode === "insert" ? insert : { ...update, index: 0, expectedHash: eventCommandHash(event.pages![0].commands[0]) };
      const scope = primitive.scope({ project, target }, args);
      expect(scope).toEqual({ kind: "eventPage", mapId, eventId, pageId });
      const foreignTarget = eventTarget(project, mapId, eventId, event.pages![1].id);
      const foreignChange = primitive.apply({ project, target: foreignTarget }, args);
      expect(checkSmallTaskScope(project, foreignChange, scope)).toMatchObject({ ok: false, reason: expect.stringContaining("범위 밖") });
      expectRefused(project, mapTarget(project, mapId), primitive.id, args);
      expect(() => runPrimitive(project, target, primitive.id, { ...args, mapId: "map_other" })).toThrow(PrimitiveError);
    }
    expect(project.maps[mapId]).toBe(map);
  });
});

function execute(project: Project, commandsOf: (p: Project) => Command[], mapId: string) {
  const session = startSession(project, 42);
  session.currentMapId = mapId;
  session.gold = 20;
  session.inventory = { [ether]: 1, [potion]: 1 };
  session.variables[variable] = 7;
  const interpreter = createInterpreter(commandsOf(project), session, project, { currentEventId: eventId });
  return { step: interpreter.start(), session, interpreter };
}

it("골드와 아이템 명령을 실행하면 소지금과 가방이 바뀐다", () => {
  const { project, target, mapId, commandsOf } = setup("blank");
  const { after: funded } = runPrimitive(project, target, "cmd.changeGold.insert", { amount: 100 });
  const { after } = runPrimitive(funded, target, "cmd.changeItem.insert", { itemId: potion, amount: 3 });
  const { step, session } = execute(after, commandsOf, mapId);
  expect(step.kind).toBe("done");
  expect(session.gold).toBe(120);
  expect(session.inventory[potion]).toBe(4);
});

it("제작과 강화를 실행하면 재료·골드·결과 변수가 바뀐다", () => {
  const { project, target, mapId, commandsOf } = setup("built");
  const { after: crafted } = runPrimitive(project, target, "cmd.craftRecipe.insert", { recipeId: recipe });
  const { after } = runPrimitive(crafted, target, "cmd.applyItemUpgrade.insert", { upgradeId: upgrade, resultVariableId: variable });
  const { step, session } = execute(after, commandsOf, mapId);
  expect(step.kind).toBe("done");
  expect(session.gold).toBe(15);
  expect(session.inventory[ether] ?? 0).toBe(0);
  expect(session.inventory[potion]).toBe(3);
  expect(session.inventory[highPotion]).toBe(1);
  expect(session.variables[variable]).toBe(1);
});

it("재고가 있는 상점에 상품을 넣어도 계절 가격과 거래 분기를 유지한다", () => {
  const stock = [
    { itemId: potion, priceOverride: 400, seasons: ["spring"] },
    { itemId: ether, priceOverride: 600 },
    { itemId: potion, priceOverride: 450, seasons: ["winter"] },
  ];
  const branch: Command[] = [{ kind: "text", body: "거래했어요." }];
  const { project, target, mapId, commandsOf } = setup("maou", [{
    kind: "shop", itemIds: [potion], stock, branchOnTransaction: true, transactionBranch: branch,
  }]);
  project.system.timeSystem = { enabled: true };
  const before = commandsOf(project)[0];
  expectRefused(project, target, "cmd.shop.update", {
    index: 0, expectedHash: eventCommandHash(before), addItemId: ether,
  }, /이미 진열된 상품/u);
  expect(commandsOf(project)[0]).toBe(before);
  const { after } = runPrimitive(project, target, "cmd.shop.update", {
    index: 0, expectedHash: eventCommandHash(before), addItemId: highPotion, allowSell: false,
  });
  const command = commandsOf(after)[0];
  expect(command).toMatchObject({
    itemIds: [potion, ether, highPotion], stock: [...stock, { itemId: highPotion }], transactionBranch: branch,
    shopType: "buyOnly", allowSell: false,
  });
  expect(execute(after, commandsOf, mapId).step).toMatchObject({
    kind: "shop", shopType: "buyOnly",
    items: [{ itemId: potion, price: 400 }, { itemId: ether, price: 600 }, { itemId: highPotion, price: expect.any(Number) }],
  });
  const { after: removed } = runPrimitive(after, target, "cmd.shop.update", {
    index: 0, expectedHash: eventCommandHash(command), removeItemId: potion,
  });
  expect(commandsOf(removed)[0]).toMatchObject({
    itemIds: [ether, highPotion], stock: [stock[1], { itemId: highPotion }], transactionBranch: branch,
  });
  expectRefused(removed, target, "cmd.shop.update", {
    index: 0, expectedHash: eventCommandHash(commandsOf(removed)[0]), removeItemId: potion,
  }, /진열된 물건만/u);
});

it("숙박 요금에 연결한 변수와 회복 옵션이 게임에 전달된다", () => {
  const { project, target, mapId, commandsOf } = setup("built");
  const { after } = runPrimitive(project, target, "cmd.inn.insert", { priceVariableId: variable, recoverMp: false });
  expect(execute(after, commandsOf, mapId).step).toMatchObject({ kind: "inn", price: 7, recoverMp: false });
});

it("선택한 칸의 금고를 열 때 잠금과 용량을 게임에 전달하고 이름표를 화면에 숨긴다", () => {
  const { project, target, mapId, commandsOf } = setup("blank");
  const { after, sentence } = runPrimitive(project, target, "cmd.openChest.insert", {
    chestId: "vault_secret", template: "vault", capacity: 8, lockItemId: potion,
  });
  expect(execute(after, commandsOf, mapId).step).toMatchObject({
    kind: "openChest", chestId: "vault_secret", template: "vault", capacity: 8, lockItemId: potion,
  });
  expect(sentence).toContain("금고");
  expect(sentence).not.toContain("vault_secret");
});

it("분기 안 한 줄을 수정하며 이전 확인값으로 다시 쓰는 것을 막는다", () => {
  const old = { kind: "changeGold", amount: 10, op: "+=" } as const;
  const { project, target, commandsOf } = setup("built", [{ kind: "loop", body: [old, { kind: "breakLoop" }] }, closing]);
  const args = { branchPath: [0, LOOP_BODY_BRANCH_INDEX], index: 0, amount: 30, expectedHash: eventCommandHash(old) };
  const { after } = runPrimitive(project, target, "cmd.changeGold.update", args);
  expect(commandsOf(after)).toEqual([{ kind: "loop", body: [{ ...old, amount: 30 }, { kind: "breakLoop" }] }, closing]);
  expect(() => runPrimitive(after, target, "cmd.changeGold.update", { ...args, amount: 40 })).toThrow(/줄의 내용이 바뀌었습니다/);
  expect(jsonEqual(commandsOf(project), [{ kind: "loop", body: [old, { kind: "breakLoop" }] }, closing])).toBe(true);
});

it("해시 누락, 같은 종류의 다른 줄, 다른 종류의 줄, 잘못된 위치를 거절한다", () => {
  const gold: Command = { kind: "changeGold", amount: 10, op: "+=" };
  const { project, target, commandsOf } = setup("blank", [gold, { ...gold, amount: 50 }, closing]);
  const expectedHash = eventCommandHash(gold);
  expectRefused(project, target, "cmd.changeGold.update", { index: 0, amount: 30 }, /형식/u);
  expectRefused(project, target, "cmd.changeGold.update", { index: 0, amount: 30, expectedHash: "" }, /형식/u);
  expectRefused(project, target, "cmd.changeGold.update", { index: 1, amount: 30, expectedHash }, /줄의 내용이 바뀌었습니다/u);
  expectRefused(project, target, "cmd.changeGold.update", { index: 2, amount: 30, expectedHash }, /명령을 찾을 수 없습니다/u);
  expectRefused(project, target, "cmd.changeGold.update", { index: 3, amount: 30, expectedHash }, /명령을 찾을 수 없습니다/u);
  expectRefused(project, target, "cmd.changeGold.insert", { index: 4, amount: 30 }, /줄 위치/u);
  expectRefused(project, target, "cmd.changeGold.update", { index: 0, expectedHash }, /고칠 내용/u);
  expect(commandsOf(project)).toEqual([gold, { ...gold, amount: 50 }, closing]);
});

it("상점과 여관의 분기를 정확히 골라 추가하고 게임에서 그 분기만 실행한다", () => {
  const shop: Command = {
    kind: "shop", itemIds: [potion], branchOnTransaction: true, transactionBranch: [],
    branchOnFailedTransaction: true, failedTransactionBranch: [closing],
  };
  const inn: Command = { kind: "inn", price: 40, branchOnNotEnoughGold: true, notEnoughBranch: [] };
  const { project, target, commandsOf, mapId } = setup("blank", [shop, inn]);
  const gold: Command = { kind: "changeGold", amount: 7, op: "+=" };
  const { after: traded } = runPrimitive(project, target, "cmd.changeGold.insert", {
    branchPath: [0, SHOP_TRANSACTION_BRANCH_INDEX], amount: 7,
  });
  const { after } = runPrimitive(traded, target, "cmd.changeGold.insert", {
    branchPath: [1, INN_NOT_ENOUGH_BRANCH_INDEX], amount: 7,
  });
  expect(commandsOf(after)).toEqual([{ ...shop, transactionBranch: [gold] }, { ...inn, notEnoughBranch: [gold] }]);
  expect(commandsOf(project)).toEqual([shop, inn]);
  const failedTrade = execute(after, commandsOf, mapId);
  expect(failedTrade.interpreter.resume("failed").kind).toBe("text");
  expect(failedTrade.session.gold).toBe(20);
  const trade = execute(after, commandsOf, mapId);
  expect(trade.step.kind).toBe("shop");
  expect(trade.interpreter.resume(true).kind).toBe("inn");
  expect(trade.session.gold).toBe(27);
  expect(trade.interpreter.resume("notEnough").kind).toBe("done");
  expect(trade.session.gold).toBe(34);
  expectRefused(after, target, "cmd.changeGold.insert", { branchPath: [1], amount: 5 }, /분기 위치/u);
  expectRefused(after, target, "cmd.changeGold.insert", {
    branchPath: [1, SHOP_FAILED_TRANSACTION_BRANCH_INDEX], amount: 5,
  }, /분기를 찾을 수 없어요/u);
});

it("기존 저장본에 배열이 없는 여관 분기에도 추가하고 실행하며 되돌린다", async () => {
  const inn: Command = { kind: "inn", price: 30, branchOnNotEnoughGold: true };
  const { project, target, commandsOf, mapId } = setup("blank", [{ kind: "loop", body: [inn, { kind: "breakLoop" }] }]);
  const branchPath = [0, LOOP_BODY_BRANCH_INDEX, 0, INN_NOT_ENOUGH_BRANCH_INDEX];
  expectRefused(project, target, "cmd.changeGold.insert", { branchPath, index: 1, amount: 7 }, /줄 위치/u);
  expectRefused(project, target, "cmd.changeGold.insert", {
    branchPath: [...branchPath, 0, INN_NOT_ENOUGH_BRANCH_INDEX], amount: 7,
  }, /분기를 찾을 수 없어요/u);
  const { after } = runPrimitive(project, target, "cmd.changeGold.insert", { branchPath, amount: 7 });
  expect(commandsOf(after)).toEqual([{
    kind: "loop", body: [{ ...inn, notEnoughBranch: [{ kind: "changeGold", op: "+=", amount: 7 }] }, { kind: "breakLoop" }],
  }]);
  const play = execute(after, commandsOf, mapId);
  expect(play.step.kind).toBe("inn");
  expect(play.interpreter.resume("notEnough").kind).toBe("done");
  expect(play.session.gold).toBe(27);
  expect(commandsOf(project)).toEqual([{ kind: "loop", body: [inn, { kind: "breakLoop" }] }]);
  await expectUndoRestores(project, after, target);
});

it("제작법 없는 공방은 거절하고 모든 제작법으로 바꾼 공방은 실제로 연다", () => {
  const { project, target, commandsOf, mapId } = setup("blank", [{ kind: "openCraftShop", recipeIds: [recipe] }]);
  const noRecipes = { ...project, system: { ...project.system, craftRecipes: [] } };
  expectRefused(noRecipes, target, "cmd.openCraftShop.insert", { title: "대장간" }, /제작법이 하나 이상/u);
  const position = { index: 0, expectedHash: eventCommandHash(commandsOf(project)[0]) };
  expectRefused(project, target, "cmd.openCraftShop.update", { ...position, recipeIds: [] }, /제작법이 하나 이상/u);
  const secondRecipe = { ...project.system.craftRecipes![0], id: "recipe_second", outputItemId: ether };
  const withRecipes = { ...project, system: { ...project.system, craftRecipes: [project.system.craftRecipes![0], secondRecipe] } };
  const { after } = runPrimitive(withRecipes, target, "cmd.openCraftShop.update", { ...position, recipeIds: null });
  expect(commandsOf(after)[0]).toEqual({ kind: "openCraftShop" });
  const { step } = execute(after, commandsOf, mapId);
  expect(step.kind).toBe("craftShop");
  if (step.kind === "craftShop") expect(step.rows.map(row => row.recipeId)).toEqual([recipe, secondRecipe.id]);
});

it("공유 보관함 연결과 물건을 유지하면서 표시 이름만 고친다", () => {
  const chest: Command = { kind: "openChest", chestId: "shared_chest", displayName: "창고" };
  const { project, target, event, mapId, commandsOf } = setup("blank", [chest], [chest]);
  project.session.chests = { shared_chest: { id: "shared_chest", mapId, x: 2, y: 2, inventory: { [potion]: 3 } } };
  const position = { index: 0, expectedHash: eventCommandHash(chest) };
  for (const chestId of ["new_chest", ""]) {
    expectRefused(project, target, "cmd.openChest.update", { ...position, chestId }, /연결된 보관함을 유지/u);
  }
  const { after } = runPrimitive(project, target, "cmd.openChest.update", { ...position, displayName: "마을 창고" });
  expect(execute(after, commandsOf, mapId).step).toMatchObject({ kind: "openChest", chestId: "shared_chest", displayName: "마을 창고" });
  expect(after.session.chests).toBe(project.session.chests);
  expect(after.maps[mapId].events.find(row => row.id === eventId)?.pages?.[1]).toBe(event.pages?.[1]);
});

it("보관함 잠금에 쓸 식별자를 게임과 같은 값으로 확인하고 빈 입력으로 해제한다", () => {
  const oldChest: Command = { kind: "openChest", lockSwitchId: ` ${lock} `, lockItemId: ` ${potion} ` };
  const { project, target, commandsOf, mapId } = setup("blank", [oldChest]);
  const { after: renamed } = runPrimitive(project, target, "cmd.openChest.update", {
    index: 0, expectedHash: eventCommandHash(oldChest), displayName: "공동 창고",
  });
  expect(commandsOf(renamed)[0]).toEqual({ ...oldChest, displayName: "공동 창고" });
  const { after } = runPrimitive(project, target, "cmd.openChest.insert", {
    index: 0, lockSwitchId: ` ${lock} `, lockItemId: ` ${potion} `,
  });
  expect(execute(after, commandsOf, mapId).step).toMatchObject({ kind: "openChest", lockSwitchId: lock, lockItemId: potion });
  const { after: unlocked } = runPrimitive(after, target, "cmd.openChest.update", {
    index: 0, expectedHash: eventCommandHash(commandsOf(after)[0]), lockSwitchId: " ", lockItemId: "",
  });
  expect(execute(unlocked, commandsOf, mapId).step).not.toHaveProperty("lockSwitchId");
  expect(execute(unlocked, commandsOf, mapId).step).not.toHaveProperty("lockItemId");
});

it.each([
  ["changeGold", { amount: GOLD_MAX + 1 }, /형식/u],
  ["changeGold", { amount: 1, amountVariableId: variable }, /하나만 지정/u],
  ["changeItem", { itemId: potion, amount: ITEM_QUANTITY_MAX + 1 }, /형식/u],
  ["changeItem", { itemId: "" }, /물건/u],
  ["craftRecipe", { recipeId: "" }, /제작법/u],
  ["applyItemUpgrade", { upgradeId: "" }, /강화 규칙/u],
  ["inn", { price: 0, priceVariableId: variable }, /하나만 지정/u],
  ["inn", { restDurationMs: 10001 }, /형식/u],
  ["openChest", { capacity: 0 }, /형식/u],
  ["openChest", { allowedItemTypes: ["회복약"] }, /아이템 분류/u],
  ["openChest", { chestId: "constructor" }, /보관함에 쓸 수 없는 이름/u],
  ["shop", { itemIds: [""] }, /형식/u],
] as const)("잘못된 %s 명령 입력을 거절한다", (kind, args, reason) => {
  const { project, target } = setup("blank");
  expectRefused(project, target, `cmd.${kind}.insert`, args, reason);
});

type PreparedCase = CorpusCase & {
  setup: {
    commands?: Command[];
    system?: Partial<Pick<Project["system"], "craftRecipes" | "itemUpgrades">>;
  };
};

const corpus: Array<CorpusCase | PreparedCase> = JSON.parse(readFileSync(
  "harness-data/small-task-corpus/04-cmd-items-shops.json", "utf8",
));
const preparedCases = corpus.filter((row): row is PreparedCase => "setup" in row);

describe("기존 줄이나 제작 규칙을 준비한 코퍼스", () => {
  it.each(preparedCases)("$request", entry => {
    // 공용 코퍼스 실행기는 원본 픽스처를 그대로 열기 때문에 준비된 사례는 여기서도 실행한다.
    const base = fixtureFor(entry.fixture);
    const target = resolveTarget(base, entry.target);
    if (target.kind !== "event") throw new Error("이벤트 페이지를 골라 주세요.");
    const map = base.maps[target.mapId];
    const events = map.events.map(event => event.id !== target.eventId ? event : {
      ...event,
      pages: event.pages?.map(page => page.id !== target.pageId || !entry.setup.commands ? page : {
        ...page, commands: structuredClone(entry.setup.commands),
      }),
    });
    const before = {
      ...base,
      system: { ...base.system, ...entry.setup.system },
      maps: { ...base.maps, [map.id]: { ...map, events } },
    };
    if (!entry.expect) {
      expectRefused(before, target, entry.primitive, entry.args, /제작법|강화 규칙|변수|도구|아이템/u);
      return;
    }
    const result = expectApplies(before, target, entry.primitive, entry.args);
    for (const check of entry.expect) {
      expect(readCheckPath(result.after, check.at), check.at).toEqual(check.equals);
    }
    return expectUndoRestores(before, result.after, target);
  });
});
