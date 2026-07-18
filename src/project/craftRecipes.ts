// Opt-in craft recipes on system.craftRecipes.
import { changeGold, changeItem, type PlaySession } from "@/project/session";
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
};

export type CraftResult =
  | { readonly ok: true; readonly recipeId: string; readonly outputItemId: ItemId; readonly outputCount: number }
  | { readonly ok: false; readonly reason: "disabled" | "missing-recipe" | "missing-ingredients" | "missing-gold" };

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
  if ((recipe.goldCost ?? 0) > 0 && session.gold < (recipe.goldCost ?? 0)) {
    return { ok: false, reason: "missing-gold" };
  }
  for (const ing of recipe.ingredients) {
    const need = Math.max(1, Math.trunc(ing.count || 1));
    if ((session.inventory[ing.itemId] ?? 0) < need) return { ok: false, reason: "missing-ingredients" };
  }
  return {
    ok: true,
    recipeId: recipe.id,
    outputItemId: recipe.outputItemId,
    outputCount: Math.max(1, Math.trunc(recipe.outputCount ?? 1)),
  };
}

export function craftRecipe(project: Project, session: PlaySession, recipeId: string): CraftResult {
  const check = canCraft(project, session, recipeId);
  if (!check.ok) return check;
  const recipe = craftRecipeById(project, recipeId)!;
  if ((recipe.goldCost ?? 0) > 0) changeGold(session, "-=", recipe.goldCost ?? 0);
  for (const ing of recipe.ingredients) {
    changeItem(session, ing.itemId, "-=", Math.max(1, Math.trunc(ing.count || 1)));
  }
  const out = Math.max(1, Math.trunc(recipe.outputCount ?? 1));
  changeItem(session, recipe.outputItemId, "+=", out);
  return { ok: true, recipeId: recipe.id, outputItemId: recipe.outputItemId, outputCount: out };
}
