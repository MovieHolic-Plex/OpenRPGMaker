// Opt-in craft recipes on system.craftRecipes.
import { changeGold, changeItemsAtomically, GOLD_MAX, type PlaySession } from "@/project/session";
import { isItemQuantity, isPositiveItemQuantity, resolveItemQuantity, type ItemQuantityOperation } from "@/project/itemQuantities";
import type { ItemId, Project } from "@/project/types";

export type CraftIngredient = {
  readonly itemId: ItemId;
  readonly count: number;
};

export type CraftRecipe = {
  readonly id: string;
  readonly name?: string;
  readonly ingredients: readonly CraftIngredient[];
  readonly outputItemId: ItemId;
  readonly outputCount?: number;
  readonly goldCost?: number;
  /** Omitted/false keeps legacy recipes immediately available. */
  readonly requiresUnlock?: boolean;
};

export type CraftResult =
  | { readonly ok: true; readonly recipeId: string; readonly outputItemId: ItemId; readonly outputCount: number }
  | { readonly ok: false; readonly reason: "disabled" | "missing-recipe" | "locked" | "missing-ingredients" | "missing-gold" | "invalid-recipe" | "invalid-state" | "inventory-overflow" };

export function craftRecipesOf(project: Project): readonly CraftRecipe[] {
  return project.system.craftRecipes ?? [];
}

export function craftRecipeById(project: Project, recipeId: string): CraftRecipe | undefined {
  return craftRecipesOf(project).find((recipe) => recipe.id === recipeId);
}

export function canCraft(project: Project, session: PlaySession, recipeId: string): CraftResult {
  const recipes = craftRecipesOf(project);
  if (recipes.length === 0) return { ok: false, reason: "disabled" };
  const recipe = craftRecipeById(project, recipeId);
  if (!recipe) return { ok: false, reason: "missing-recipe" };
  if (recipe.requiresUnlock === true && !(session.unlockedRecipeIds ?? []).includes(recipe.id)) {
    return { ok: false, reason: "locked" };
  }
  const goldCost = recipe.goldCost ?? 0;
  if (!Number.isSafeInteger(goldCost) || goldCost < 0 || goldCost > GOLD_MAX) return { ok: false, reason: "invalid-recipe" };
  if (!Number.isSafeInteger(session.gold) || session.gold < 0 || session.gold > GOLD_MAX) return { ok: false, reason: "invalid-state" };
  if (goldCost > 0 && session.gold < goldCost) {
    return { ok: false, reason: "missing-gold" };
  }
  const requirements = aggregateIngredients(recipe.ingredients);
  const outputCount = recipe.outputCount ?? 1;
  if (!requirements || !isPositiveItemQuantity(outputCount)) return { ok: false, reason: "invalid-recipe" };
  for (const [itemId, need] of requirements) {
    const current = session.inventory[itemId] ?? 0;
    if (!isItemQuantity(current)) return { ok: false, reason: "invalid-state" };
    if (current < need) return { ok: false, reason: "missing-ingredients" };
  }
  if (!operationsFit(session.inventory, craftItemOperations(requirements, recipe.outputItemId, outputCount))) {
    return { ok: false, reason: "inventory-overflow" };
  }
  return {
    ok: true,
    recipeId: recipe.id,
    outputItemId: recipe.outputItemId,
    outputCount,
  };
}

export function craftRecipe(project: Project, session: PlaySession, recipeId: string): CraftResult {
  const check = canCraft(project, session, recipeId);
  if (!check.ok) return check;
  const recipe = craftRecipeById(project, recipeId)!;
  const requirements = aggregateIngredients(recipe.ingredients)!;
  if (!changeItemsAtomically(session, craftItemOperations(requirements, recipe.outputItemId, check.outputCount))) {
    return { ok: false, reason: "inventory-overflow" };
  }
  if ((recipe.goldCost ?? 0) > 0) changeGold(session, "-=", recipe.goldCost ?? 0);
  return { ok: true, recipeId: recipe.id, outputItemId: recipe.outputItemId, outputCount: check.outputCount };
}

function aggregateIngredients(ingredients: readonly CraftIngredient[]): Map<ItemId, number> | undefined {
  const requirements = new Map<ItemId, number>();
  for (const ingredient of ingredients) {
    if (!ingredient.itemId.trim() || !isPositiveItemQuantity(ingredient.count)) return undefined;
    const total = resolveItemQuantity(requirements.get(ingredient.itemId) ?? 0, "+=", ingredient.count);
    if (total === undefined) return undefined;
    requirements.set(ingredient.itemId, total);
  }
  return requirements;
}

function craftItemOperations(
  requirements: ReadonlyMap<ItemId, number>,
  outputItemId: ItemId,
  outputCount: number,
): ItemQuantityOperation[] {
  return [
    ...[...requirements].map(([itemId, amount]) => ({ itemId, op: "-=" as const, amount })),
    { itemId: outputItemId, op: "+=", amount: outputCount },
  ];
}

function operationsFit(
  inventory: Readonly<Record<string, number>>,
  operations: readonly ItemQuantityOperation[],
): boolean {
  const projected = new Map<string, number>();
  for (const operation of operations) {
    const current = projected.get(operation.itemId) ?? inventory[operation.itemId] ?? 0;
    if (operation.op === "-=" && (!isItemQuantity(current) || current < operation.amount)) return false;
    const next = resolveItemQuantity(current, operation.op, operation.amount);
    if (next === undefined) return false;
    projected.set(operation.itemId, next);
  }
  return true;
}
