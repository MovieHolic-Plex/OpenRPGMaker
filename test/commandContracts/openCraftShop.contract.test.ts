import { describe, expect, it } from "vitest";
import { createInterpreter, type StepResult } from "@/player/interpreter";
import { createBlankProject } from "@/project/defaults";
import { projectLint } from "@/project/lint/projectLint";
import type { Command, Project } from "@/project/types";
import { createContractSession, roundtripCommands } from "./harness";

function craftProject(): Project {
  const project = createBlankProject();
  project.database.items.push(
    { ...project.database.items[0]!, id: "ore", name: "광석" },
    { ...project.database.items[0]!, id: "ingot", name: "주괴" },
  );
  project.system.craftRecipes = [
    { id: "smelt", name: "제련", ingredients: [{ itemId: "ore", count: 2 }], outputItemId: "ingot", outputCount: 1, goldCost: 5 },
    { id: "big", name: "큰 제련", ingredients: [{ itemId: "ore", count: 9 }], outputItemId: "ingot", outputCount: 3 },
  ];
  return project;
}

const shop = (extra: Partial<Extract<Command, { kind: "openCraftShop" }>> = {}): Command => ({ kind: "openCraftShop", ...extra });

function asShop(step: StepResult): Extract<StepResult, { kind: "craftShop" }> {
  if (step.kind !== "craftShop") throw new Error(`expected craftShop, got ${step.kind}`);
  return step;
}

describe("openCraftShop interpreter contract", () => {
  it("lists every recipe with counts, disables the unaffordable one, crafts, reopens with a notice and leaves to the next command", () => {
    const project = craftProject();
    const session = createContractSession(project);
    session.inventory = { ore: 4 };
    session.gold = 7;
    const interp = createInterpreter([shop(), { kind: "setFlag", flag: "after", value: true }], session, project);

    const first = asShop(interp.start());
    expect(first.rows.map((row) => [row.recipeId, row.disabledReason ?? null])).toEqual([["smelt", null], ["big", "재료 부족: 광석 5"]]);
    expect(first.rows[0]!.ingredients).toEqual([{ itemId: "ore", name: "광석", need: 2, have: 4 }]);
    expect(first.notice).toBeUndefined();

    const second = asShop(interp.resume("smelt"));
    expect(session.inventory).toMatchObject({ ore: 2, ingot: 1 });
    expect(session.gold).toBe(2);
    expect(second.notice).toEqual({ ok: true, text: "「주괴」를 받았다." });
    expect(second.rows[0]!.disabledReason).toBe("3G 부족");

    const third = asShop(interp.resume("smelt"));
    expect(third.notice?.ok).toBe(false);
    expect(session.inventory).toMatchObject({ ore: 2, ingot: 1 });
    expect(session.flags.after).toBeUndefined();

    expect(interp.resume(undefined)).toEqual({ kind: "done" });
    expect(session.flags.after).toBe(true);
  });

  it("shows only the named recipes and refuses an id outside that list", () => {
    const project = craftProject();
    const session = createContractSession(project);
    session.inventory = { ore: 20 };
    const interp = createInterpreter([shop({ recipeIds: ["big"] })], session, project);
    expect(asShop(interp.start()).rows.map((row) => row.recipeId)).toEqual(["big"]);
    expect(asShop(interp.resume("smelt")).notice?.ok).toBe(false);
    expect(session.inventory.ore).toBe(20);
  });

  it("passes through without a window when no recipe can be shown", () => {
    const project = createBlankProject();
    const session = createContractSession(project);
    const interp = createInterpreter([shop(), { kind: "setFlag", flag: "after", value: true }], session, project);
    expect(interp.start()).toEqual({ kind: "done" });
    expect(session.flags.after).toBe(true);
  });

  it("survives project roundtrip", () => {
    const command = shop({ recipeIds: ["recipe_contract"], title: "공방", speaker: "니나" });
    expect(roundtripCommands([command])).toEqual([command]);
  });

  it("is an error in project lint when the list is empty or names a missing recipe", () => {
    const project = craftProject();
    const map = Object.values(project.maps)[0]!;
    map.events.push({ id: "ev_bad", name: "bad", x: 1, y: 1, trigger: { kind: "action" }, commands: [shop({ recipeIds: [] }), shop({ recipeIds: ["ghost"] })], pages: [] });
    const codes = projectLint(project, { skipRoundtrip: true }).filter((issue) => issue.code.startsWith("openCraftShop")).map((issue) => [issue.severity, issue.code]);
    expect(codes).toEqual([["error", "openCraftShop.empty"], ["error", "openCraftShop.unknown-recipe"], ["error", "openCraftShop.empty"]]);
  });
});
