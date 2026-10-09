import { afterEach, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { contributeBundle } from "@/project/bundles";
import { craftRecipe } from "@/project/craftRecipes";
import { applyItemUpgrade } from "@/project/upgrades";
import { depositShipping, settleShipping } from "@/project/shipping";
import { resolveShopSellUnitPrice } from "@/project/shopPrice";
import { proposeHaggle, resolveHaggleReserve } from "@/project/haggle";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { GOLD_MAX, startSession } from "@/project/session";
import { store } from "@/project/store";
import { deserialize, serialize } from "@/project/io";
import { validateCommandArray } from "@/project/io/shapeCommandFields";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { switchVariableReferenceLocations } from "@/editor/databaseCommandReferences";
import { deleteVariable } from "@/editor/actions";
import { validateEventDraft } from "@/editor/eventDraftValidator";
import { simulatePageCommands } from "@/editor/panels/eventEditor/previewSimulation";
import { createInterpreter } from "@/player/interpreter";
import { handleShopTransaction } from "@/player/playSceneShop";
import { runSceneTest } from "@/testing/sceneTestRunner";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { Command, Project } from "@/project/types";

const previous = store.getCurrent();
afterEach(() => store.replaceProject(previous));

function economyProject() {
  const project = createBlankProject();
  project.database.items.push(...["economy_A", "economy_B", "economy_C"].map((id) =>
    normalizeItemRecord({ id, name: id, scope: "none", price: 100 })));
  project.variables.push({ id: "economy_result", name: "Result" }, { id: "economy_next", name: "Next" });
  project.session.variables = { economy_result: -1, economy_next: 0 };
  project.session.inventory = { economy_A: 1 };
  project.session.gold = 100;
  project.system.craftRecipes = [{ id: "recipe", ingredients: [{ itemId: "economy_A", count: 1 }], outputItemId: "economy_B", goldCost: 10 }];
  project.system.itemUpgrades = [{ id: "upgrade", fromItemId: "economy_A", toItemId: "economy_B", goldCost: 10 }];
  project.system.sellPrices = [{ itemId: "economy_A", price: 90 }];
  project.system.shipping = { enabled: true };
  return project;
}

function scene(session: ReturnType<typeof startSession>): PlaySceneContext {
  return { session, syncRuntimeState: () => undefined } as unknown as PlaySceneContext;
}

function command(kind: "craftRecipe" | "applyItemUpgrade", result = true): Command {
  const target = kind === "craftRecipe" ? { kind, recipeId: "recipe" } : { kind, upgradeId: "upgrade" };
  return { ...target, ...(result ? { resultVariableId: "economy_result" } : {}) };
}

function installEvent(project: Project, commands: Command[]) {
  project.maps[project.startMapId]!.events = [{
    id: "economy_event", x: 0, y: 0, trigger: { kind: "action" }, commands,
    pages: [{ id: "economy_page", name: "Economy", conditions: [], graphic: { transparent: true },
      trigger: { kind: "action" }, priority: "below", movement: { type: "fixed", speed: 3, frequency: 3 }, commands }],
  }];
}

describe("Task15 nonvisual economy consumers", () => {
  it.each([{ table: 90, expected: 90 }, { table: 100, expected: 99 }, { table: 0, expected: 0 }, { table: undefined, expected: 50 }])(
    "uses the canonical shop price for actual sale: $table -> $expected", ({ table, expected }) => {
      const project = economyProject();
      project.system.sellPrices = table === undefined ? [] : [{ itemId: "economy_A", price: table }];
      store.replaceProject(project);
      const session = startSession(project, 15);
      const item = project.database.items.find((entry) => entry.id === "economy_A")!;
      expect(resolveShopSellUnitPrice(project, item.id, 100)).toBe(expected);
      const result = handleShopTransaction(scene(session), item, "sell", 1, 100);
      expect(result).toMatchObject({ ok: true, merchantGold: 100 - expected });
      expect(session.gold).toBe(100 + expected);
      expect(session.inventory.economy_A).toBeUndefined();
      expect(session.shopTradeCounts?.economy_A).toEqual({ sold: 1, bought: 0 });
    },
  );

  it("uses sale90 as the nonvisual bargain reference and preserves shipping's unclamped price", () => {
    const project = economyProject();
    store.replaceProject(project);
    const reference = resolveShopSellUnitPrice(project, "economy_A", 100);
    expect(reference).toBe(90);
    const reserve = resolveHaggleReserve({ role: "playerSells", reference, buyPrice: 100, maxDiscount: 0.25,
      itemId: "economy_A", merchantKey: "merchant", dayKey: "1:spring:1", attemptIndex: 0 });
    const verdict = proposeHaggle({ role: "playerSells", reference, reserve, buyPrice: 100, patience: 3, insultRatio: 0.6 }, 90);
    expect(verdict).toEqual({ kind: "accept", price: 90 });
    const session = startSession(project, 15);
    expect(handleShopTransaction(scene(session), project.database.items.find((item) => item.id === "economy_A")!, "sell", 1, 100, 90).ok).toBe(true);
    expect(session.gold).toBe(190);
    project.system.sellPrices = [{ itemId: "economy_A", price: 100 }];
    const shipping = startSession(project, 15);
    expect(depositShipping(project, shipping, "economy_A", 1).ok).toBe(true);
    expect(settleShipping(project, shipping, "1:spring:1")).toMatchObject({ ok: true, total: 100, credited: 100 });
  });

  it.each(["merchant-gold", "wallet-cap", "quantity-cap"] as const)("rejects shop %s without any session mutation", (failure) => {
    const project = economyProject();
    if (failure === "wallet-cap") project.session.gold = GOLD_MAX;
    if (failure === "quantity-cap") project.session.inventory = { economy_A: ITEM_QUANTITY_MAX };
    store.replaceProject(project);
    const session = startSession(project, 15);
    const before = structuredClone(session);
    const result = handleShopTransaction(scene(session), project.database.items.find((item) => item.id === "economy_A")!,
      failure === "quantity-cap" ? "buy" : "sell", 1, failure === "merchant-gold" ? 89 : 100);
    expect(result.ok).toBe(false);
    expect(session).toEqual(before);
    expect("merchantGold" in result).toBe(false);
  });

  it("accepts undefined/all then the materialized B/C allow-list, not an empty list", () => {
    const project = economyProject();
    project.session.inventory = { economy_A: 2, economy_B: 2, economy_C: 2 };
    const all = startSession(project, 15);
    for (const id of ["economy_A", "economy_B", "economy_C"]) expect(depositShipping(project, all, id, 1).ok).toBe(true);
    expect(all.shippingQueue).toEqual({ economy_A: 1, economy_B: 1, economy_C: 1 });
    // The authoring consumer must materialize ALL current IDs before deleting A.
    project.system.shipping = { ...project.system.shipping!, allowedItemIds: project.database.items.map((item) => item.id).filter((id) => id !== "economy_A") };
    const restored = deserialize(serialize(project));
    const partial = startSession(restored, 15);
    const before = structuredClone(partial);
    expect(depositShipping(restored, partial, "economy_A", 1)).toMatchObject({ ok: false, reason: "item-not-allowed" });
    expect(partial).toEqual(before);
    for (const id of ["economy_B", "economy_C"]) expect(depositShipping(restored, partial, id, 1).ok).toBe(true);
    expect(settleShipping(restored, partial, "1:spring:1")).toMatchObject({ ok: true, total: 100 });
    project.system.shipping = { ...project.system.shipping!, allowedItemIds: [] };
    expect(depositShipping(project, all, "economy_B", 1)).toMatchObject({ ok: false, reason: "item-not-allowed" });
  });

  it.each([{ reward: 1, ok: true }, { reward: 2, ok: false }])("preflights donation1/reward$reward against net quantity at the actual cap", ({ reward, ok }) => {
    const project = economyProject();
    project.session.inventory = { economy_A: ITEM_QUANTITY_MAX };
    project.system.bundles = [{ id: "bundle", requirements: [{ itemId: "economy_A", count: 1 }],
      reward: { gold: 10, itemRewards: [{ itemId: "economy_A", count: reward }] } }];
    const session = startSession(project, 15);
    const before = structuredClone(session);
    const result = contributeBundle(project, session, "bundle", "economy_A", 1);
    expect(result.ok).toBe(ok);
    if (!ok) { expect(session).toEqual(before); return; }
    expect(result).toMatchObject({ completed: true, rewardApplied: true });
    expect(session.inventory.economy_A).toBe(ITEM_QUANTITY_MAX);
    expect(session.gold).toBe(110);
    const completed = structuredClone(session);
    expect(contributeBundle(project, session, "bundle", "economy_A", 1)).toMatchObject({ ok: false, reason: "already-complete" });
    expect(session).toEqual(completed);
  });
});

describe.each(["craftRecipe", "applyItemUpgrade"] as const)("Task15 %s result contract", (kind) => {
  it.each(["success", "material", "ingredient", "gold", "quantity-cap"] as const)("reports %s and executes the following command through interpreter, scene runner and preview", (outcome) => {
    const project = economyProject();
    if (outcome === "material") project.session.inventory = {};
    if (outcome === "ingredient") {
      project.system.craftRecipes![0] = { ...project.system.craftRecipes![0]!, ingredients: [{ itemId: "economy_A", count: 1 }, { itemId: "economy_C", count: 1 }] };
      project.system.itemUpgrades![0] = { ...project.system.itemUpgrades![0]!, ingredients: [{ itemId: "economy_C", count: 1 }] };
    }
    if (outcome === "gold") project.session.gold = 9;
    if (outcome === "quantity-cap") project.session.inventory = { economy_A: 1, economy_B: ITEM_QUANTITY_MAX };
    const expected = outcome === "success" ? 1 : 0;
    const commands: Command[] = [command(kind),
      { kind: "fork", condition: { kind: "variable", variableId: "economy_result", op: "==", value: 1 },
        then: [{ kind: "changeItem", itemId: "economy_C", op: "+=", amount: 1 }] },
      { kind: "setVariable", variableId: "economy_next", op: "=", value: 7 }];
    installEvent(project, commands);
    store.replaceProject(project);
    const session = startSession(project, 15);
    const before = structuredClone(session);
    expect(createInterpreter(commands, session, project).start()).toEqual({ kind: "done" });
    const transactionSession = startSession(project, 15);
    const transaction = kind === "craftRecipe" ? craftRecipe(project, transactionSession, "recipe") : applyItemUpgrade(project, transactionSession, "upgrade");
    expect(transaction.ok).toBe(expected === 1);
    if (!transaction.ok) {
      const reason = outcome === "gold" ? "missing-gold"
        : outcome === "quantity-cap" ? (kind === "craftRecipe" ? "inventory-overflow" : "invalid-state")
        : outcome === "material" && kind === "applyItemUpgrade" ? "missing-item" : "missing-ingredients";
      expect(transaction.reason).toBe(reason);
      expect(transactionSession).toEqual(before);
    }
    expect(session.variables.economy_result).toBe(expected);
    expect(session.variables.economy_next).toBe(7);
    if (expected) {
      expect(session.inventory).toEqual({ economy_B: 1, economy_C: 1 });
      expect(session.gold).toBe(90);
    } else {
      expect(session).toEqual({ ...before, variables: { ...before.variables, economy_result: 0, economy_next: 7 } });
    }
    const runner = runSceneTest(project, { mapId: project.startMapId, start: { x: 0, y: 0 }, steps: [
      { kind: "interact" }, { kind: "expect", variableEquals: { economy_result: expected, economy_next: 7 } },
    ] });
    expect(runner.ok, runner.failureReason).toBe(true);
    expect(runner.session.inventory).toEqual(session.inventory);
    expect(runner.session.gold).toBe(session.gold);
    const preview = simulatePageCommands(commands);
    expect(preview.finalState.inventory).toEqual(session.inventory);
    expect(preview.finalState.gold).toBe(session.gold);
    expect(preview.finalState.variables).toEqual(session.variables);
    expect(preview.steps.find((step) => step.command.kind === "fork")?.forkTaken).toBe(expected ? "then" : "else");
    expect(project.session.inventory).toEqual(before.inventory);
  });

  it.each([true, false])("omission creates no variable and preserves legacy outcome (success=%s)", (success) => {
    const project = economyProject();
    if (!success) project.session.inventory = {};
    const session = startSession(project, 15);
    const variables = structuredClone(session.variables);
    const commands = [command(kind, false)];
    expect(createInterpreter(commands, session, project).start()).toEqual({ kind: "done" });
    expect(session.variables).toEqual(variables);
    expect(session.inventory.economy_B ?? 0).toBe(success ? 1 : 0);
    store.replaceProject(project);
    const preview = simulatePageCommands(commands);
    expect(preview.finalState.variables).toEqual(variables);
    expect(preview.finalState.inventory).toEqual(session.inventory);
  });

  it("writes failure0 without a project and still continues", () => {
    const project = economyProject();
    const session = startSession(project, 15);
    const before = structuredClone(session);
    expect(createInterpreter([command(kind), { kind: "setVariable", variableId: "economy_next", op: "=", value: 7 }], session).start()).toEqual({ kind: "done" });
    expect(session).toEqual({ ...before, variables: { ...before.variables, economy_result: 0, economy_next: 7 } });
  });

  it("executes consecutive same-item net-zero operations at cap without corrupting preview snapshots", () => {
    const project = economyProject();
    project.session.inventory = { economy_A: ITEM_QUANTITY_MAX };
    project.system.craftRecipes![0] = { ...project.system.craftRecipes![0]!, outputItemId: "economy_A" };
    project.system.itemUpgrades![0] = { ...project.system.itemUpgrades![0]!, toItemId: "economy_A" };
    project.system.collections = { enabled: true };
    store.replaceProject(project);
    const session = startSession(project, 15);
    const commands = [command(kind), command(kind)];
    expect(createInterpreter(commands, session, project).start()).toEqual({ kind: "done" });
    const preview = simulatePageCommands(commands);
    expect(preview.finalState.inventory).toEqual(session.inventory);
    expect(preview.finalState.inventory.economy_A).toBe(ITEM_QUANTITY_MAX);
    expect(preview.finalState.gold).toBe(80);
    expect(preview.finalState.variables.economy_result).toBe(1);
    expect(preview.finalState.itemUseCharges).toEqual(session.itemUseCharges);
    expect(preview.finalState.collections).toEqual(session.collections);
    expect(preview.steps.map((step) => step.simState.gold)).toEqual([100, 90]);
    expect(preview.steps[0]!.simState.variables.economy_result).toBe(-1);
  });

  it("roundtrips the optional field and blocks deleting a referenced variable", () => {
    const project = economyProject();
    installEvent(project, [command(kind), command(kind, false)]);
    const restored = deserialize(serialize(project));
    expect(restored.maps[restored.startMapId]!.events[0]!.pages![0]!.commands).toEqual([command(kind), command(kind, false)]);
    expect(switchVariableReferenceLocations(restored, "variable", "economy_result")).toEqual([
      expect.objectContaining({ kind: "mapEvent", eventId: "economy_event" }),
    ]);
    store.replaceProject(restored);
    const before = serialize(store.getCurrent());
    expect(deleteVariable("economy_result").ok).toBe(false);
    expect(serialize(store.getCurrent())).toBe(before);
  });

  it("rejects unknown result references in ProjectIO and event draft validation", () => {
    const project = economyProject();
    installEvent(project, [command(kind)]);
    project.variables = project.variables.filter((entry) => entry.id !== "economy_result");
    expect(collectProjectReferenceIssues(project).some((issue) => issue.includes("economy_result"))).toBe(true);
    expect(() => deserialize(serialize(project))).toThrow();
    const draft = validateEventDraft(project, project.startMapId, "economy_event");
    expect(draft.issues).toContainEqual(expect.objectContaining({ code: "reference.variable.missing", commandPath: [0] }));
  });

  it.each([null, 0, {}, []])("rejects malformed result variable shape %j", (resultVariableId) => {
    expect(() => validateCommandArray("commands", [{ ...command(kind), resultVariableId }])).toThrow();
    expect(() => validateCommandArray("commands", [command(kind), command(kind, false)])).not.toThrow();
  });

  it.each(["shop-success", "shop-failure", "inn-failure", "battle-victory", "loop"] as const)("protects result variables inside %s branches", (branch) => {
    const project = economyProject();
    const children = [command(kind)];
    const container: Command = branch === "shop-success" ? { kind: "shop", itemIds: [], transactionBranch: children }
      : branch === "shop-failure" ? { kind: "shop", itemIds: [], failedTransactionBranch: children }
      : branch === "inn-failure" ? { kind: "inn", price: 10, notEnoughBranch: children }
      : branch === "loop" ? { kind: "loop", body: [...children, { kind: "breakLoop" }] }
      : { kind: "battleProcessing", troopId: project.database.troops[0]!.id, canEscape: false, canLose: false, victoryBranch: children };
    installEvent(project, [container]);
    expect(switchVariableReferenceLocations(project, "variable", "economy_result")).toHaveLength(1);
    project.variables = project.variables.filter((entry) => entry.id !== "economy_result");
    expect(collectProjectReferenceIssues(project).some((issue) => issue.includes("economy_result"))).toBe(true);
  });
});
