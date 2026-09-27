import { describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { combinationPartnersOf, combinationRecipeFor, combineItems } from "@/project/craftRecipes";
import { evalCondition, startSession } from "@/project/session";
import { resolveEventPage } from "@/project/io";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { findFacedItemTarget } from "@/player/itemUseOnTarget";
import type { EventPage, GameEvent, Project } from "@/project/types";

function page(overrides: Partial<EventPage> = {}): EventPage {
  return {
    id: "page-talk",
    name: "대화",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [{ kind: "text", body: "문이 잠겨 있다." }],
    ...overrides,
  };
}

function lockedDoor(x: number, y: number): GameEvent {
  return {
    id: "ev_door",
    x,
    y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      page(),
      page({
        id: "page-key",
        name: "열쇠 사용",
        conditions: [{ kind: "itemUsed", itemId: "item_old_key" }],
        commands: [{ kind: "changeItem", itemId: "item_old_key", op: "-=", amount: 1 }, { kind: "text", body: "문이 열렸다." }],
      }),
    ],
  };
}

function combineProject(): Project {
  const project = createBlankProject();
  project.system.craftRecipes = [
    { id: "rc_hi", name: "혼합약", ingredients: [{ itemId: "item_potion", count: 1 }, { itemId: "item_ether", count: 1 }], outputItemId: "item_hi_potion" },
    { id: "rc_double", ingredients: [{ itemId: "item_antidote", count: 2 }], outputItemId: "item_wake_herb" },
    // 재료 셋은 조합이 아니다(제작 명령 전용).
    { id: "rc_three", ingredients: [{ itemId: "item_potion", count: 1 }, { itemId: "item_ether", count: 1 }, { itemId: "item_antidote", count: 1 }], outputItemId: "item_poison_dart" },
  ];
  const map = project.maps[project.startMapId]!;
  map.events.push(lockedDoor(project.startPos.x, project.startPos.y - 1));
  return project;
}

describe("inventory item combination (#12)", () => {
  it("finds two-item recipes in either order and ignores three-ingredient recipes", () => {
    const project = combineProject();
    expect(combinationRecipeFor(project, "item_ether", "item_potion")?.id).toBe("rc_hi");
    expect(combinationRecipeFor(project, "item_antidote", "item_antidote")?.id).toBe("rc_double");
    expect(combinationPartnersOf(project, "item_potion")).toEqual(["item_ether"]);
    expect(combinationRecipeFor(project, "item_potion", "item_antidote")).toBeUndefined();
  });

  it("combineItems consumes both ingredients and adds the output", () => {
    const project = combineProject();
    const session = startSession(project, 1);
    session.inventory = { item_potion: 1, item_ether: 2 };
    expect(combineItems(project, session, "item_potion", "item_ether")).toMatchObject({ ok: true, outputItemId: "item_hi_potion" });
    expect(session.inventory.item_potion ?? 0).toBe(0);
    expect(session.inventory).toMatchObject({ item_ether: 1, item_hi_potion: 1 });
    expect(combineItems(project, session, "item_potion", "item_ether")).toEqual({ ok: false, reason: "missing-ingredients" });
  });

  it("the item menu opens an action screen with a combine row that runs the combination", () => {
    const project = combineProject();
    const session = startSession(project, 1);
    session.inventory = { item_potion: 1, item_ether: 1 };
    const openActions = vi.fn();
    const combine = vi.fn((a: string, b: string) => combineItems(project, session, a, b));
    const list = createStatusMenuDetail({
      project, session, selectedCommand: "items", slots: [], waitModeEnabled: true,
      onOpenItemActions: openActions, onCombineItems: combine, onUseItem: vi.fn(), onSelectItemTarget: vi.fn(),
    });
    const potionRow = list.entries.find((entry) => entry.testId === "status-menu-item-item_potion")!;
    expect(potionRow.attributes?.itemActions).toBe("true");
    potionRow.onActivate!();
    expect(openActions).toHaveBeenCalledWith("item_potion");

    const actions = createStatusMenuDetail({
      project, session, selectedCommand: "items", slots: [], waitModeEnabled: true,
      itemActionId: "item_potion", onCombineItems: combine, onUseItem: vi.fn(), onSelectItemTarget: vi.fn(),
    });
    expect(actions.entries.map((entry) => entry.testId)).toEqual([
      "status-menu-item-use-item_potion",
      "status-menu-item-combine-item_potion-item_ether",
    ]);
    actions.entries[1]!.onActivate!();
    expect(session.inventory.item_hi_potion).toBe(1);
  });

  it("items without partners keep the legacy direct-use row", () => {
    const project = combineProject();
    const session = startSession(project, 1);
    session.inventory = { item_potion: 1 };
    const list = createStatusMenuDetail({
      project, session, selectedCommand: "items", slots: [], waitModeEnabled: true,
      onOpenItemActions: vi.fn(), onCombineItems: vi.fn(), onUseItem: vi.fn(), onSelectItemTarget: vi.fn(),
    });
    expect(list.entries.find((entry) => entry.testId === "status-menu-item-item_potion")!.attributes?.itemActions).toBeUndefined();
  });
});

describe("use item on faced target (#12)", () => {
  it("itemUsed is false during normal interaction and true only while the item is being used", () => {
    const project = combineProject();
    const session = startSession(project, 1);
    const door = project.maps[project.startMapId]!.events.find((event) => event.id === "ev_door")!;
    expect(resolveEventPage(door, session)?.id).toBe("page-talk");
    expect(evalCondition(session, { kind: "itemUsed", itemId: "item_old_key" })).toBe(false);
    session.itemUsedId = "item_old_key";
    expect(resolveEventPage(door, session)?.id).toBe("page-key");
    expect(evalCondition(session, { kind: "itemUsed", itemId: "item_old_key" })).toBe(true);
  });

  it("findFacedItemTarget returns the item page of the faced event and leaves the session unchanged", () => {
    const project = combineProject();
    const session = startSession(project, 1);
    const map = project.maps[project.startMapId]!;
    const player = { x: project.startPos.x, y: project.startPos.y, facing: "up" as const };
    const target = findFacedItemTarget(project, map, session, {}, player, "item_old_key");
    expect(target?.event.id).toBe("ev_door");
    expect(target?.page.id).toBe("page-key");
    expect(session.itemUsedId).toBeUndefined();
    // 다른 아이템·다른 방향은 받지 않는다.
    expect(findFacedItemTarget(project, map, session, {}, player, "item_potion")).toBeUndefined();
    expect(findFacedItemTarget(project, map, session, {}, { ...player, facing: "down" }, "item_old_key")).toBeUndefined();
  });

  it("the item action screen offers «바라보는 대상에 사용» only when the faced event accepts the item", () => {
    const project = combineProject();
    const session = startSession(project, 1);
    session.inventory = { item_old_key: 1 };
    const useOnTarget = vi.fn();
    const detail = (accepts: boolean) => createStatusMenuDetail({
      project, session, selectedCommand: "items", slots: [], waitModeEnabled: true,
      itemActionId: "item_old_key", canUseItemOnFacedTarget: () => accepts, onUseItemOnFacedTarget: useOnTarget,
    });
    const row = detail(true).entries.find((entry) => entry.testId === "status-menu-item-use-target-item_old_key");
    expect(row).toBeDefined();
    row!.onActivate!();
    expect(useOnTarget).toHaveBeenCalledWith("item_old_key");
    expect(detail(false).entries.some((entry) => entry.testId === "status-menu-item-use-target-item_old_key")).toBe(false);
  });

  it("keeps itemUsed pages through serialize/deserialize", () => {
    const project = combineProject();
    const reloaded = deserialize(serialize(project));
    const door = reloaded.maps[project.startMapId]!.events.find((event) => event.id === "ev_door")!;
    expect(door.pages?.[1]?.conditions).toEqual([{ kind: "itemUsed", itemId: "item_old_key" }]);
  });
});
