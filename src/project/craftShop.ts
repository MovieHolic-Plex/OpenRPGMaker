// 제작 공방 명령(openCraftShop)의 목록 계산 — 인터프리터·헤드리스 러너·편집기 미리보기가 같은 표를 본다.
import { canCraft, craftRecipe, craftRecipesOf, type CraftResult } from "@/project/craftRecipes";
import type { PlaySession } from "@/project/session";
import { josa } from "@/util/josa";
import type { Command, Project } from "@/project/types";

export type OpenCraftShopCommand = Extract<Command, { kind: "openCraftShop" }>;

export type CraftShopIngredientView = {
  readonly itemId: string;
  readonly name: string;
  readonly need: number;
  readonly have: number;
};

export type CraftShopRow = {
  readonly recipeId: string;
  /** 「불씨 병 2개」처럼 산출물 이름과 개수. */
  readonly outputText: string;
  readonly outputItemId: string;
  readonly outputCount: number;
  readonly ingredients: readonly CraftShopIngredientView[];
  readonly goldCost: number;
  /** 고를 수 없으면 그 이유 한 줄. 고를 수 있으면 없다. */
  readonly disabledReason?: string;
};

/** 명령이 가리키는 제작법 id. recipeIds 를 생략하면 system.craftRecipes 전부(저작 순서). 없는 id 는 건너뛴다(편집기 lint 가 잡는다). */
export function craftShopRecipeIds(project: Project, command: OpenCraftShopCommand): string[] {
  const known = craftRecipesOf(project).map((recipe) => recipe.id);
  if (command.recipeIds === undefined) return known;
  return command.recipeIds.filter((id) => known.includes(id));
}

export function craftShopRows(project: Project, session: PlaySession, command: OpenCraftShopCommand): CraftShopRow[] {
  const items = new Map(project.database.items.map((item) => [item.id, item.name]));
  const name = (id: string): string => items.get(id) ?? id;
  return craftShopRecipeIds(project, command).flatMap((recipeId) => {
    const recipe = craftRecipesOf(project).find((entry) => entry.id === recipeId);
    if (!recipe) return [];
    const outputCount = recipe.outputCount ?? 1;
    const check = canCraft(project, session, recipeId);
    const ingredients = recipe.ingredients.map((ingredient) => ({
      itemId: ingredient.itemId,
      name: name(ingredient.itemId),
      need: ingredient.count,
      have: session.inventory[ingredient.itemId] ?? 0,
    }));
    const goldCost = recipe.goldCost ?? 0;
    const reason = check.ok ? undefined : craftShopReason(check, ingredients, goldCost, session.gold);
    return [{
      recipeId,
      outputText: `${name(recipe.outputItemId)}${outputCount > 1 ? ` ${outputCount}개` : ""}`,
      outputItemId: recipe.outputItemId,
      outputCount,
      ingredients,
      goldCost,
      ...(reason ? { disabledReason: reason } : {}),
    }];
  });
}

/**
 * 공방에서 고른 제작법을 한 번 만든다. 목록 밖 id 는 만들지 않는다(화면이 보여 준 것만 고를 수 있다).
 * 판정·차감은 craftRecipe 그대로다 — 가방 «조합»·제작 명령과 같은 규칙.
 */
export function craftShopOnce(project: Project, session: PlaySession, command: OpenCraftShopCommand, recipeId: string): { ok: boolean; text: string } {
  const row = craftShopRows(project, session, command).find((entry) => entry.recipeId === recipeId);
  if (!row) return { ok: false, text: "그 제작법은 여기서 만들 수 없다." };
  if (row.disabledReason) return { ok: false, text: row.disabledReason };
  const result = craftRecipe(project, session, recipeId);
  if (!result.ok) return { ok: false, text: craftShopReason(result, row.ingredients, row.goldCost, session.gold) };
  return { ok: true, text: `「${row.outputText}」${josa(row.outputText, "을/를")} 받았다.` };
}

function craftShopReason(
  result: Extract<CraftResult, { ok: false }>,
  ingredients: readonly CraftShopIngredientView[],
  goldCost: number,
  gold: number,
): string {
  switch (result.reason) {
    case "missing-ingredients": {
      const short = ingredients.filter((ingredient) => ingredient.have < ingredient.need)
        .map((ingredient) => `${ingredient.name} ${ingredient.need - ingredient.have}`);
      return `재료 부족: ${short.join("·")}`;
    }
    case "missing-gold":
      return `${goldCost - gold}G 부족`;
    case "locked":
      return "아직 배우지 않은 제작법";
    case "inventory-overflow":
      return "가방이 가득 찼다";
    case "disabled":
    case "missing-recipe":
    case "invalid-recipe":
    case "invalid-state":
      return "만들 수 없다";
  }
}
