import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { applyCareItem, previewCareItem } from "@/project/monsterCare";
import { giveMonster } from "@/project/monsterCollection";
import { isEvolutionStone, itemAllowsFieldMenu } from "@/project/monsterEvolutionItems";
import { startSession } from "@/project/session";
import { BAG_POCKETS, bagPocketCounts, bagPocketOf, stepBagPocket } from "@/player/playerBagPockets";
import { inventoryViewEntries } from "@/player/playerInventoryView";
import { previewEvolutionStoneTarget, useItemFromMenu } from "@/player/playerItemUse";
import { runTool } from "@/editor/tools/toolRunner";
import { createMonsterExpedition } from "@/project/examples/monsterExpedition";
import { EXPEDITION_STONE_IDS } from "@/project/examples/monsterExpedition/roster";
import type { ToolContext } from "@/editor/tools/types";
import type { Project } from "@/project/types";

/** 풀→불 두 단계 진화(레벨 5, 레벨 8)와 돌 진화 한 갈래를 가진 최소 몬스터 프로젝트. */
function fieldItemProject(): Project {
  const project = createBlankProject();
  project.system.monsterCollection = true;
  project.system.battleParty = "monsters";
  const base = project.database.monsterSpecies.find((entry) => entry.id === "species_wild_slime");
  if (!base) throw new Error("missing slime");
  const clone = (id: string, name: string) => ({ ...structuredClone(base), id, name, evolutions: [] as typeof base.evolutions });
  const first = { ...clone("species_first", "첫째"), evolutions: [{ toSpeciesId: "species_second", requires: { level: 5 } }, { toSpeciesId: "species_stone_form", requires: { itemId: "item_test_stone" } }] };
  const second = { ...clone("species_second", "둘째"), evolutions: [{ toSpeciesId: "species_third", requires: { level: 8 } }] };
  project.database.monsterSpecies.push(first, second, clone("species_third", "셋째"), clone("species_stone_form", "돌모습"));
  project.database.items.push(
    normalizeItemRecord({ id: "item_test_candy", name: "시험 사탕", scope: "none", price: 10, type: "special", occasion: "field", consumable: true, careProfile: { kind: "feed", friendshipDelta: 0, levelUp: 3 } }),
    normalizeItemRecord({ id: "item_test_stone", name: "시험 돌", scope: "none", price: 10, type: "normalGoods", occasion: "field", consumable: true }),
    normalizeItemRecord({ id: "item_test_ether", name: "시험 에테르", scope: "ally", price: 10, type: "medicine", occasion: "field", consumable: true, ppRecovery: { flat: 10, percentMax: 0 } }),
  );
  return project;
}

function giveFirst(project: Project, level: number) {
  const session = startSession(project, 1);
  const gift = giveMonster(project, session, { speciesId: "species_first", level });
  if (!gift.ok) throw new Error("give failed");
  return { session, id: gift.instance.instanceId };
}

describe("rare candy (careProfile.levelUp)", () => {
  it("previews the level range and the evolution chain without changing the session", () => {
    const project = fieldItemProject();
    const { session, id } = giveFirst(project, 4);
    session.inventory.item_test_candy = 1;
    const item = project.database.items.find((entry) => entry.id === "item_test_candy")!;
    const before = structuredClone(session.monsterInstances[id]);
    const preview = previewCareItem(project, session, item, id);
    expect(preview.reason).toBeUndefined();
    // previewCareItem (#2707) names the fields level / levelAfter / evolveToSpeciesIds; this test was written against a draft shape.
    expect(preview).toMatchObject({ level: 4, levelAfter: 7 });
    expect(preview.evolveToSpeciesIds).toEqual(["species_second"]);
    expect(session.monsterInstances[id]).toEqual(before);
    expect(session.inventory.item_test_candy).toBe(1);
  });

  it("raises levels and chains evolutions, consuming one candy", () => {
    const project = fieldItemProject();
    const { session, id } = giveFirst(project, 6);
    session.inventory.item_test_candy = 2;
    const result = applyCareItem(project, session, { itemId: "item_test_candy", instanceId: id });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.levelAfter).toBe(9);
    expect(result.evolutions.map((entry) => entry.toSpeciesId)).toEqual(["species_second", "species_third"]);
    expect(session.monsterInstances[id]?.speciesId).toBe("species_third");
    expect(session.inventory.item_test_candy).toBe(1);
  });

  it("is rejected at the level cap without consuming the item", () => {
    const project = fieldItemProject();
    const { session, id } = giveFirst(project, 99);
    session.inventory.item_test_candy = 1;
    const result = applyCareItem(project, session, { itemId: "item_test_candy", instanceId: id });
    expect(result).toMatchObject({ ok: false, reason: "maxLevel" });
    expect(session.inventory.item_test_candy).toBe(1);
  });
});

describe("evolution stone from the field menu", () => {
  it("is derived from evolutions[].requires.itemId, not from a flag", () => {
    const project = fieldItemProject();
    const stone = project.database.items.find((entry) => entry.id === "item_test_stone")!;
    const potion = project.database.items.find((entry) => entry.id === "item_potion")!;
    expect(isEvolutionStone(project, stone)).toBe(true);
    expect(itemAllowsFieldMenu(project, stone)).toBe(true);
    expect(isEvolutionStone(project, potion)).toBe(false);
  });

  it("evolves a compatible monster and keeps the stone when nothing happens", () => {
    const project = fieldItemProject();
    const { session, id } = giveFirst(project, 3);
    const other = giveMonster(project, session, { speciesId: "species_third", level: 3 });
    if (!other.ok) throw new Error("give failed");
    session.inventory.item_test_stone = 1;
    const stone = project.database.items.find((entry) => entry.id === "item_test_stone")!;

    expect(previewEvolutionStoneTarget(project, session, stone, id).toName).toBe("돌모습");
    expect(previewEvolutionStoneTarget(project, session, stone, other.instance.instanceId).reason).toBeTruthy();

    const none = useItemFromMenu(project, session, "item_test_stone", undefined, other.instance.instanceId);
    expect(none.kind).not.toBe("used");
    expect(session.inventory.item_test_stone).toBe(1);

    const used = useItemFromMenu(project, session, "item_test_stone", undefined, id);
    expect(used.kind).toBe("used");
    expect(session.monsterInstances[id]?.speciesId).toBe("species_stone_form");
    expect(session.inventory.item_test_stone ?? 0).toBe(0);
    if (used.kind === "used") expect(used.evolutions?.[0]?.toSpeciesId).toBe("species_stone_form");
  });
});

describe("bag pockets", () => {
  it("classifies from item fields with an optional override", () => {
    const project = fieldItemProject();
    const find = (id: string) => project.database.items.find((entry) => entry.id === id)!;
    expect(bagPocketOf(project, find("item_potion"))).toBe("items");
    expect(bagPocketOf(project, find("item_test_stone"))).toBe("items");
    const ball = normalizeItemRecord({ id: "item_ball", name: "볼", scope: "enemy", price: 1, type: "special", occasion: "battle", captureProfile: { multiplier: 1 } });
    expect(bagPocketOf(project, ball)).toBe("balls");
    const held = normalizeItemRecord({ id: "item_held", name: "지닐", scope: "none", price: 1, type: "normalGoods", heldEffect: { kind: "regen", percent: 6 } });
    expect(bagPocketOf(project, held)).toBe("held");
    expect(bagPocketOf(project, { ...find("item_potion"), pocket: "key" })).toBe("key");
  });

  it("steps through the pockets and wraps at both ends", () => {
    expect(BAG_POCKETS.map((pocket) => pocket.id)).toEqual(["items", "balls", "machines", "held", "key"]);
    expect(stepBagPocket("items", -1)).toBe("key");
    expect(stepBagPocket("key", 1)).toBe("items");
  });

  it("counts kinds per pocket and filters the list by pocket in monster games only", () => {
    const project = fieldItemProject();
    const session = startSession(project, 1);
    session.inventory = { item_potion: 2, item_test_stone: 1 };
    expect(bagPocketCounts(project, session.inventory)).toMatchObject({ items: 2, balls: 0 });
    const entries = ["item_potion", "item_test_stone"].map((id) => ({ label: id, value: "1개", testId: `status-menu-item-${id}` }));
    const items = inventoryViewEntries(entries, project, session, { filter: "all", sort: "default", pocket: "items" });
    expect(items.map((entry) => entry.testId)).toContain("status-menu-item-item_potion");
    const balls = inventoryViewEntries(entries, project, session, { filter: "all", sort: "default", pocket: "balls" });
    expect(balls.map((entry) => entry.testId)).toContain("inventory-pocket-empty");

    const other = createBlankProject();
    const otherSession = startSession(other, 1);
    otherSession.inventory = { item_potion: 1 };
    const rows = inventoryViewEntries([{ label: "포션", value: "1개", testId: "status-menu-item-item_potion" }], other, otherSession, { filter: "all", sort: "default", pocket: "balls" });
    expect(rows.map((entry) => entry.testId)).toContain("inventory-filter");
  });
});

describe("assistant upsert_item schema", () => {
  it("keeps careProfile.levelUp, ppRecovery and pocket, coercing the item type so they take effect", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const candy = runTool(ctx, "upsert_item", { item: { id: "item_q_candy", name: "사탕", careProfile: { kind: "feed", friendshipDelta: 0, levelUp: 1 }, pocket: "items" } }, { dryRun: false });
    expect(candy.ok, JSON.stringify(candy.issues)).toBe(true);
    const saved = ctx.project.database.items.find((entry) => entry.id === "item_q_candy")!;
    expect(saved.type).toBe("special");
    expect(saved.careProfile?.levelUp).toBe(1);
    expect(saved.pocket).toBe("items");

    const ether = runTool(ctx, "upsert_item", { item: { id: "item_q_ether", name: "에테르", ppRecovery: { flat: 10, percentMax: 0 } } }, { dryRun: false });
    expect(ether.ok, JSON.stringify(ether.issues)).toBe(true);
    const savedEther = ctx.project.database.items.find((entry) => entry.id === "item_q_ether")!;
    expect(savedEther.type).toBe("medicine");
    expect(savedEther.ppRecovery?.flat).toBe(10);
  });

  it("omits the optional pocket field from untouched records", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    runTool(ctx, "upsert_item", { item: { id: "item_potion", price: 120 } }, { dryRun: false });
    expect("pocket" in ctx.project.database.items.find((entry) => entry.id === "item_potion")!).toBe(false);
  });
});

describe("monster expedition field items", () => {
  it("ships revive, rare candy and stones with evolution paths and a start gift", () => {
    const { project } = createMonsterExpedition();
    const ids = new Set(project.database.items.map((item) => item.id));
    for (const id of ["mx_revive", "mx_candy", ...EXPEDITION_STONE_IDS]) expect(ids.has(id), id).toBe(true);
    const stoneTargets = project.database.monsterSpecies.flatMap((species) => species.evolutions ?? []).map((evolution) => evolution.requires?.itemId).filter(Boolean);
    for (const id of EXPEDITION_STONE_IDS) expect(stoneTargets).toContain(id);
    const revive = project.database.items.find((item) => item.id === "mx_revive")!;
    expect(revive.onlyEffectiveOnDeadActors).toBe(true);
  });
});
