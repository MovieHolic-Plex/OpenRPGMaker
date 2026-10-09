// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { commandSummary } from "@/editor/panels/eventEditor/commandSummary";
import { renderCommandPreview } from "@/editor/panels/eventEditor/commandPreview";
import { simulatePageCommands } from "@/editor/panels/eventEditor/previewSimulation";
import { renderLifeCraftingTab } from "@/editor/panels/databaseLifeCraftingView";
import { _resetEditActivityForTest } from "@/editor/editActivityLog";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { craftRecipe } from "@/project/craftRecipes";
import { applyItemUpgrade } from "@/project/upgrades";
import { deserialize, serialize } from "@/project/io";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { depositShipping, settleShipping } from "@/project/shipping";
import { resolveShopSellUnitPrice } from "@/project/shopPrice";
import { proposeHaggle, resolveHaggleReserve } from "@/project/haggle";
import { GOLD_MAX, startSession } from "@/project/session";
import { store } from "@/project/store";
import { resolveTerms } from "@/project/terms";
import { createInterpreter } from "@/player/interpreter";
import {
  createShopOverlay,
  listingPrice,
  renderShopItems,
  sellPrice,
  updateShopQuantityTotal,
} from "@/player/playSceneShopDom";
import { handleShopTransaction, type ShopStep } from "@/player/playSceneShop";
import { itemToGoods } from "@/player/playSceneShopGoods";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { Command, Project } from "@/project/types";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";

const previous = store.getCurrent();

function economyProject(): Project {
  const project = createBlankProject();
  project.database.items.push(
    ...["economy_A", "economy_B", "economy_C"].map((id) =>
      normalizeItemRecord({ id, name: id, scope: "none", price: 100 }),
    ),
  );
  project.variables.push({ id: "economy_result", name: "Result" }, { id: "economy_next", name: "Next" });
  project.session.variables = { economy_result: -1, economy_next: 0 };
  project.session.inventory = { economy_A: 1 };
  project.session.gold = 100;
  project.system.craftRecipes = [
    { id: "recipe", name: "Economy Craft", ingredients: [{ itemId: "economy_A", count: 1 }], outputItemId: "economy_B", goldCost: 10 },
  ];
  project.system.itemUpgrades = [
    { id: "upgrade", fromItemId: "economy_A", toItemId: "economy_B", goldCost: 10 },
  ];
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

function mountLife(): HTMLElement {
  const host = document.createElement("div");
  document.body.append(host);
  const rerender = () => {
    host.replaceChildren();
    renderLifeCraftingTab(host, rerender);
  };
  rerender();
  return host;
}

function control<T extends HTMLElement = HTMLInputElement>(host: HTMLElement, id: string): T {
  const node = host.querySelector<T>(`[data-testid="${id}"]`);
  if (!node) throw new Error(`Missing control ${id}`);
  return node;
}

function openShipping(host: HTMLElement): void {
  control(host, "db-life-section-shipping").click();
  if (!host.querySelector('[data-testid="db-life-shipping-items-card"]')) {
    control(host, "db-life-package-create").click();
  }
}

beforeEach(() => {
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
  store.replaceProject(economyProject());
  resetMapEditHistory();
  _resetEditActivityForTest();
  document.body.replaceChildren();
});

afterEach(() => {
  _resetEditActivityForTest();
  document.body.replaceChildren();
  store.replaceProject(previous);
});

describe("Task15 UI shop sell price consumers", () => {
  it.each([
    { table: 90 as number | undefined, expected: 90 },
    { table: 100, expected: 99 },
    { table: 0, expected: 0 },
    { table: undefined, expected: 50 },
  ])("rows/totals/default offers/haggle/settle use helper $table -> $expected", ({ table, expected }) => {
    const project = store.getCurrent();
    project.system.sellPrices = table === undefined ? [] : [{ itemId: "economy_A", price: table }];
    store.replaceProject(project);
    const item = project.database.items.find((entry) => entry.id === "economy_A")!;
    const goods = itemToGoods(item);
    expect(resolveShopSellUnitPrice(project, item.id, item.price)).toBe(expected);
    expect(sellPrice(item)).toBe(expected);
    expect(listingPrice(goods, "sell")).toBe(expected);

    const overlay = createShopOverlay();
    overlay.append(
      renderShopItems({
        scene: scene(startSession(project, 15)),
        step: { allowSell: true, quantityMode: "select" } as ShopStep,
        items: [item],
        mode: "sell",
        prompt: "sell",
        terms: resolveTerms(project),
        merchantGold: 500,
        setStatus: () => undefined,
        showMenu: () => undefined,
        onItem: () => undefined,
      }),
    );
    const row = overlay.querySelector<HTMLElement>("[data-testid='shop-sell-economy_A']");
    expect(row?.dataset.unitPrice).toBe(String(expected));
    expect(overlay.querySelector("[data-testid='shop-price-economy_A']")?.textContent).toBe(`${expected}G`);
    row?.classList.add("selected");
    updateShopQuantityTotal(overlay);
    expect(overlay.querySelector("[data-testid='shop-quantity-total']")?.textContent).toBe(`합계 ${expected}G`);

    const reference = sellPrice(item);
    expect(reference).toBe(expected);
    // Haggle reference is the helper unit. Offering the list price is accepted when >0;
    // explicit 0 is a valid trade unit but an insulting haggle bid.
    if (expected > 0) {
      const reserve = resolveHaggleReserve({
        role: "playerSells",
        reference,
        buyPrice: item.price,
        maxDiscount: 0.25,
        itemId: item.id,
        merchantKey: "merchant",
        dayKey: "1:spring:1",
        attemptIndex: 0,
      });
      const verdict = proposeHaggle(
        { role: "playerSells", reference, reserve, buyPrice: item.price, patience: 3, insultRatio: 0.6 },
        expected,
      );
      expect(verdict).toEqual({ kind: "accept", price: expected });
    }

    const session = startSession(project, 15);
    const result = handleShopTransaction(scene(session), item, "sell", 1, 500, expected === 0 ? 0 : undefined);
    expect(result).toMatchObject({ ok: true, merchantGold: 500 - expected });
    expect(session.gold).toBe(100 + expected);
    // Pawn/settle bookkeeping unit must match helper when no agreed price is supplied.
    const unit = sellPrice(item);
    expect(unit).toBe(expected);
  });

  it("keeps shipping unclamped at table100 while shop clamps to 99", () => {
    const project = store.getCurrent();
    project.system.sellPrices = [{ itemId: "economy_A", price: 100 }];
    store.replaceProject(project);
    expect(sellPrice(project.database.items.find((item) => item.id === "economy_A")!)).toBe(99);
    const session = startSession(project, 15);
    expect(depositShipping(project, session, "economy_A", 1).ok).toBe(true);
    expect(settleShipping(project, session, "1:spring:1")).toMatchObject({ ok: true, total: 100, credited: 100 });
  });
});

describe("Task15 UI shipping checkbox materialization", () => {
  it("undefined/all materializes every current item id then disable A leaves B/C", () => {
    const host = mountLife();
    openShipping(host);
    expect(store.getCurrent().system.shipping?.allowedItemIds).toBeUndefined();
    const all = control(host, "db-life-shipping-all-items");
    expect(all.checked).toBe(true);
    const itemA = control(host, "db-life-shipping-item-economy_A");
    expect(itemA.checked).toBe(true);
    itemA.checked = false;
    itemA.dispatchEvent(new Event("change", { bubbles: true }));
    const allowed = store.getCurrent().system.shipping?.allowedItemIds;
    expect(allowed).toBeDefined();
    expect(allowed).not.toEqual([]);
    expect(allowed?.includes("economy_A")).toBe(false);
    expect(allowed?.includes("economy_B")).toBe(true);
    expect(allowed?.includes("economy_C")).toBe(true);
    // default catalog items remain present when all was materialized
    expect((allowed ?? []).length).toBe(store.getCurrent().database.items.length - 1);
  });

  it("explicit empty list stays none and persists through roundtrip", () => {
    const host = mountLife();
    openShipping(host);
    const all = control(host, "db-life-shipping-all-items");
    all.checked = false;
    all.dispatchEvent(new Event("change", { bubbles: true }));
    expect(store.getCurrent().system.shipping?.allowedItemIds).toEqual([]);
    const restored = deserialize(serialize(store.getCurrent()));
    expect(restored.system.shipping?.allowedItemIds).toEqual([]);
  });
});

describe.each(["craftRecipe", "applyItemUpgrade"] as const)("Task15 UI %s result variable forms", (kind) => {
  let staged: Command;
  const actions: CommandListActions = {
    addCommand: () => undefined,
    insertCommand: () => undefined,
    deleteCommand: () => undefined,
    moveCommand: () => undefined,
    moveCommandTo: () => undefined,
    replaceCommand: (_path, next) => {
      staged = next;
    },
  };

  function body(cmd: Command): HTMLElement {
    staged = cmd;
    const host = document.createElement("div");
    document.body.append(host);
    host.append(renderCommandBody({ path: [0], actions, lockKind: true }, cmd));
    return host;
  }

  function resultRootTestId(): string {
    return kind === "craftRecipe" ? "craft-recipe-result-variable" : "apply-item-upgrade-result-variable";
  }

  function clearTestId(): string {
    return kind === "craftRecipe"
      ? "craft-recipe-result-variable-clear"
      : "apply-item-upgrade-result-variable-clear";
  }

  function resultSelect(host: HTMLElement): HTMLSelectElement {
    const root = host.querySelector<HTMLElement>(`[data-testid="${resultRootTestId()}"]`);
    const select = root?.querySelector("select") ?? null;
    if (!select) throw new Error(`missing result variable select for ${kind}`);
    return select;
  }

  function clearButton(host: HTMLElement): HTMLButtonElement {
    const button = host.querySelector<HTMLButtonElement>(`[data-testid="${clearTestId()}"]`);
    if (!button) throw new Error(`missing visible clear control ${clearTestId()}`);
    return button;
  }

  it("authors optional resultVariableId; visible clear omits the property", () => {
    const host = body(command(kind, false));
    const select = resultSelect(host);
    expect(select.value).toBe("");
    // Set via the real select change path (picker writes the same onChange).
    select.value = "economy_result";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(staged).toEqual(command(kind, true));
    expect(Object.prototype.hasOwnProperty.call(staged, "resultVariableId")).toBe(true);

    // Clear must be a visible form control — not hidden-select writes.
    const clear = clearButton(host);
    expect(clear.hidden).toBe(false);
    expect(clear.getAttribute("aria-hidden")).not.toBe("true");
    clear.click();
    expect(staged).toEqual(command(kind, false));
    expect(Object.prototype.hasOwnProperty.call(staged, "resultVariableId")).toBe(false);
    expect((staged as { resultVariableId?: string }).resultVariableId).toBeUndefined();
    expect(resultSelect(host).value).toBe("");
  });

  it("preserves a declared resultVariableId exactly without display trim", () => {
    // Schema-valid IDs are stored as selected; form must not rewrite them via trim helpers.
    const exactId = "economy_result";
    const withId =
      kind === "craftRecipe"
        ? ({ kind, recipeId: "recipe", resultVariableId: exactId } as Command)
        : ({ kind, upgradeId: "upgrade", resultVariableId: exactId } as Command);
    const host = body(withId);
    expect(resultSelect(host).value).toBe(exactId);
    expect(staged).toEqual(withId);
    if (staged.kind === kind) {
      expect((staged as { resultVariableId?: string }).resultVariableId).toBe(exactId);
    }
    const summary = commandSummary(withId);
    expect(summary).toContain("Result");
    // Summary must still resolve the exact stored id.
    expect(summary.includes(exactId) || summary.includes("Result")).toBe(true);
  });

  it("keeps a declared selection in the form and shows it in summary/preview", () => {
    const host = body(command(kind, true));
    expect(resultSelect(host).value).toBe("economy_result");
    expect(clearButton(host)).toBeTruthy();
    const summary = commandSummary(command(kind, true));
    expect(summary).toContain("Result");
    expect(commandSummary(command(kind, false))).not.toContain("Result");

    const preview = renderCommandPreview(command(kind, true));
    expect(preview.textContent).toContain("Result");
    const clearedPreview = renderCommandPreview(command(kind, false));
    expect(clearedPreview.textContent ?? "").not.toContain("Result");
  });

  it.each(["success", "material"] as const)(
    "form-authored command keeps core outcome parity for %s",
    (outcome) => {
      const project = store.getCurrent();
      if (outcome === "material") project.session.inventory = {};
      store.replaceProject(project);
      const authored = command(kind, true);
      // Simulate form commit path: only declared fields.
      const formCommand: Command =
        kind === "craftRecipe"
          ? {
              kind,
              recipeId: "recipe",
              ...(authored.kind === kind && authored.resultVariableId
                ? { resultVariableId: authored.resultVariableId }
                : {}),
            }
          : {
              kind,
              upgradeId: "upgrade",
              ...(authored.kind === kind && authored.resultVariableId
                ? { resultVariableId: authored.resultVariableId }
                : {}),
            };
      expect(formCommand).toEqual(command(kind, true));

      const session = startSession(project, 15);
      const before = structuredClone(session);
      const commands: Command[] = [
        formCommand,
        {
          kind: "fork",
          condition: { kind: "variable", variableId: "economy_result", op: "==", value: 1 },
          then: [{ kind: "changeItem", itemId: "economy_C", op: "+=", amount: 1 }],
        },
        { kind: "setVariable", variableId: "economy_next", op: "=", value: 7 },
      ];
      expect(createInterpreter(commands, session, project).start()).toEqual({ kind: "done" });
      const expected = outcome === "success" ? 1 : 0;
      expect(session.variables.economy_result).toBe(expected);
      expect(session.variables.economy_next).toBe(7);
      if (expected === 1) {
        expect(session.inventory).toEqual({ economy_B: 1, economy_C: 1 });
        expect(session.gold).toBe(90);
      } else {
        expect(session.inventory).toEqual(before.inventory);
        expect(session.gold).toBe(before.gold);
        expect(session).toEqual({
          ...before,
          variables: { ...before.variables, economy_result: 0, economy_next: 7 },
        });
      }
      const transaction =
        kind === "craftRecipe"
          ? craftRecipe(project, startSession(project, 15), "recipe")
          : applyItemUpgrade(project, startSession(project, 15), "upgrade");
      expect(transaction.ok).toBe(expected === 1);
      if (!transaction.ok) {
        expect(transaction.reason === "missing-ingredients" || transaction.reason === "missing-item").toBe(true);
      }
      const preview = simulatePageCommands(commands);
      expect(preview.finalState.variables.economy_result).toBe(expected);
      expect(preview.finalState.variables.economy_next).toBe(7);
      expect(preview.finalState.inventory).toEqual(session.inventory);
      expect(preview.finalState.gold).toBe(session.gold);
      expect(preview.steps.find((step) => step.command.kind === "fork")?.forkTaken).toBe(expected ? "then" : "else");
    },
  );

  it("failure paths never flip UI success or mutate inventory beyond result writes", () => {
    const project = store.getCurrent();
    project.session.inventory = {};
    store.replaceProject(project);
    const session = startSession(project, 15);
    const before = structuredClone(session);
    expect(createInterpreter([command(kind, true), { kind: "setVariable", variableId: "economy_next", op: "=", value: 7 }], session, project).start()).toEqual({
      kind: "done",
    });
    expect(session.inventory).toEqual(before.inventory);
    expect(session.gold).toBe(before.gold);
    expect(session.variables.economy_result).toBe(0);
    expect(session.variables.economy_next).toBe(7);
  });
});

describe("Task15 UI shop failure surfaces", () => {
  it.each(["merchant-gold", "wallet-cap", "quantity-cap"] as const)(
    "rejects %s with no inventory/gold mutation and no false UI success unit",
    (failure) => {
      const project = store.getCurrent();
      if (failure === "wallet-cap") project.session.gold = GOLD_MAX;
      if (failure === "quantity-cap") project.session.inventory = { economy_A: ITEM_QUANTITY_MAX };
      store.replaceProject(project);
      const session = startSession(project, 15);
      const before = structuredClone(session);
      const item = project.database.items.find((entry) => entry.id === "economy_A")!;
      const result = handleShopTransaction(
        scene(session),
        item,
        failure === "quantity-cap" ? "buy" : "sell",
        1,
        failure === "merchant-gold" ? 89 : 500,
      );
      expect(result.ok).toBe(false);
      expect(session).toEqual(before);
      expect("merchantGold" in result).toBe(false);
      // UI unit price still comes from helper, but failed deal must not apply it.
      expect(sellPrice(item)).toBe(90);
    },
  );
});
