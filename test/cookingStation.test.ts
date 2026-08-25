import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { canCraft, craftRecipe } from "@/project/craftRecipes";
import { deserialize, serialize } from "@/project/io";
import { startSession } from "@/project/session";
import type { Project } from "@/project/types";

const FRIED_EGG = {
  id: "recipe_fried_egg",
  name: "계란프라이",
  ingredients: [{ itemId: "item_egg", count: 2 }],
  outputItemId: "item_fried_egg",
  outputCount: 1,
  goldCost: 10,
};

function projectWithRecipe(): Project {
  const project = createBlankProject();
  const itemTemplate = project.database.items[0];
  if (!itemTemplate) throw new Error("blank project must include an item template");
  project.database.items.push(
    { ...itemTemplate, id: "item_egg", name: "달걀" },
    { ...itemTemplate, id: "item_fried_egg", name: "계란프라이" },
  );
  project.system.craftRecipes = [FRIED_EGG];
  return project;
}

describe("요리 레시피", () => {
  it("재료와 골드가 충분하면 제작되고 인벤토리가 정확히 갱신된다", () => {
    const project = projectWithRecipe();
    const session = startSession(project, 1);
    session.inventory.item_egg = 3;
    session.gold = 100;

    const result = craftRecipe(project, session, "recipe_fried_egg");
    expect(result.ok).toBe(true);
    expect(session.inventory.item_egg).toBe(1);
    expect(session.inventory.item_fried_egg).toBe(1);
    expect(session.gold).toBe(90);
  });

  it("재료가 모자라면 실패하고 인벤토리·골드가 변하지 않는다", () => {
    const project = projectWithRecipe();
    const session = startSession(project, 1);
    session.inventory.item_egg = 1;
    session.gold = 100;

    expect(craftRecipe(project, session, "recipe_fried_egg")).toEqual({ ok: false, reason: "missing-ingredients" });
    expect(session.inventory.item_egg).toBe(1);
    expect(session.inventory.item_fried_egg ?? 0).toBe(0);
    expect(session.gold).toBe(100);
  });

  it("골드가 모자라면 실패하고 재료가 소비되지 않는다", () => {
    const project = projectWithRecipe();
    const session = startSession(project, 1);
    session.inventory.item_egg = 3;
    session.gold = 5;

    expect(craftRecipe(project, session, "recipe_fried_egg")).toEqual({ ok: false, reason: "missing-gold" });
    expect(session.inventory.item_egg).toBe(3);
  });

  it("레시피가 없으면 시스템 자체가 비활성으로 보고된다(옵트인)", () => {
    const project = createBlankProject();
    const session = startSession(project, 1);
    expect(canCraft(project, session, "recipe_fried_egg")).toEqual({ ok: false, reason: "disabled" });
  });

  it("craftRecipes 가 저장/로드 왕복에서 보존된다", () => {
    const loaded = deserialize(serialize(projectWithRecipe()));
    expect(loaded.system.craftRecipes?.[0]).toMatchObject({ id: "recipe_fried_egg", outputItemId: "item_fried_egg" });
  });
});
