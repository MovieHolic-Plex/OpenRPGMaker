import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { giveGiftToNpc, giftRankForItem } from "@/project/friendship";
import { resolveShopStock } from "@/project/shopStock";
import { changeFriendship, evalCondition, getFriendship, startSession } from "@/project/session";
import type { Command, GameEvent, Project } from "@/project/types";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { createNpcScheduleDemoProject } from "./fixtures/npcScheduleDemo";

describe("friendship runtime", () => {
  it("changes, clamps, and round-trips friendship through save/load", () => {
    const project = createBlankProject();
    const session = startSession(project);

    expect(changeFriendship(session, "ev_farmer", 1200)).toBe(1000);
    expect(changeFriendship(session, "ev_farmer", -1400)).toBe(0);
    expect(changeFriendship(session, "ev_farmer", 80)).toBe(80);

    const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
    expect(restored.friendship).toEqual({ ev_farmer: 80 });
    expect(getFriendship(restored, "ev_farmer")).toBe(80);
  });

  it("evaluates friendshipAtLeast with self-event fallback", () => {
    const project = createBlankProject();
    const session = startSession(project);
    changeFriendship(session, "ev_farmer", 120);

    expect(evalCondition(session, { kind: "friendshipAtLeast", value: 100 }, "ev_farmer")).toBe(true);
    expect(evalCondition(session, { kind: "friendshipAtLeast", npcKey: "ev_farmer", value: 140 })).toBe(false);
  });
});

describe("gift runtime", () => {
  it("applies deterministic preference deltas and daily gift reset", () => {
    const project = giftProject();
    const session = startSession(project);
    const event = giftEvent("ev_farmer");

    expect(giftRankForItem(event.giftPrefs, "item_strawberry")).toBe("loved");
    expect(giveGiftToNpc(project, session, event, "item_strawberry")).toMatchObject({ ok: true, rank: "loved", delta: 80, friendship: 80 });
    expect(giveGiftToNpc(project, session, event, "item_neutral")).toMatchObject({ ok: false, reason: "already-gifted" });
    expect(session.inventory.item_neutral).toBe(1);
    expect(getFriendship(session, "ev_farmer")).toBe(80);

    session.gameTime = { minute: 0, hour: 6, day: 2, season: "spring", year: 1 };
    expect(giveGiftToNpc(project, session, event, "item_liked")).toMatchObject({ ok: true, rank: "liked", delta: 45, friendship: 125 });

    const dislikedSession = startSession(project);
    expect(giveGiftToNpc(project, dislikedSession, giftEvent("ev_miner"), "item_disliked")).toMatchObject({
      ok: true,
      rank: "disliked",
      delta: -20,
      friendship: 0,
    });
  });

  it("does not expose gift behavior when giftSystem is off", () => {
    const project = giftProject();
    project.system.giftSystem = false;
    const session = startSession(project);

    expect(giveGiftToNpc(project, session, giftEvent("ev_farmer"), "item_strawberry")).toMatchObject({ ok: false, reason: "system-disabled" });
    expect(session.inventory.item_strawberry).toBe(2);
    expect(getFriendship(session, "ev_farmer")).toBe(0);
  });
});

describe("seasonal shop stock", () => {
  it("filters stock by current season and applies seasonal prices", () => {
    const project = giftProject();
    const session = startSession(project);
    const command: Extract<Command, { kind: "shop" }> = {
      kind: "shop",
      itemIds: ["item_strawberry"],
      stock: [
        { itemId: "item_spring_seed", seasons: ["spring"], priceOverride: 30, priceBySeason: { spring: 18 } },
        { itemId: "item_winter_firewood", seasons: ["winter"], priceOverride: 40, priceBySeason: { winter: 28 } },
      ],
    };

    expect(resolveShopStock(project, session, command)).toEqual([{ itemId: "item_spring_seed", price: 18 }]);
    session.gameTime = { minute: 0, hour: 9, day: 1, season: "winter", year: 1 };
    expect(resolveShopStock(project, session, command)).toEqual([{ itemId: "item_winter_firewood", price: 28 }]);
  });

  it("keeps legacy shops and timeSystem-off projects unchanged", () => {
    const project = giftProject();
    const session = startSession(project);
    const legacy: Extract<Command, { kind: "shop" }> = { kind: "shop", itemIds: ["item_strawberry", "item_liked"] };
    expect(resolveShopStock(project, session, legacy)).toEqual([{ itemId: "item_strawberry" }, { itemId: "item_liked" }]);

    project.system.timeSystem = undefined;
    const seasonal: Extract<Command, { kind: "shop" }> = {
      kind: "shop",
      itemIds: [],
      stock: [
        { itemId: "item_spring_seed", seasons: ["spring"], priceBySeason: { spring: 18 } },
        { itemId: "item_winter_firewood", seasons: ["winter"], priceBySeason: { winter: 28 } },
      ],
    };
    expect(resolveShopStock(project, session, seasonal).map((entry) => entry.itemId)).toEqual(["item_spring_seed", "item_winter_firewood"]);
  });
});

describe("friendship and shop tools", () => {
  it("set_shop_stock writes seasonal stock onto an existing event", () => {
    const ctx = { project: giftProject() };
    const map = ctx.project.maps[ctx.project.startMapId];
    map.events.push({ ...giftEvent("ev_merchant"), pages: [eventPage("ev_merchant_page", [])] });

    const result = runTool(ctx, "set_shop_stock", {
      mapId: map.id,
      eventId: "ev_merchant",
      stock: [{ itemId: "item_spring_seed", seasons: ["spring"], priceBySeason: { spring: 18 } }],
    });

    expect(result.ok, result.summary).toBe(true);
    const shop = ctx.project.maps[map.id].events.find((event) => event.id === "ev_merchant")?.pages?.[0]?.commands[0];
    expect(shop).toMatchObject({ kind: "shop", itemIds: ["item_spring_seed"], stock: [{ itemId: "item_spring_seed" }] });
  });

  it("make_villager accepts gift preferences and shopkeeper stock", () => {
    const ctx = { project: giftProject() };
    const map = ctx.project.maps[ctx.project.startMapId];

    const result = runTool(ctx, "make_villager", {
      mapId: map.id,
      id: "ev_seed_seller",
      name: "씨앗 상인",
      home: { x: 1, y: 1 },
      dialogue: [{ text: "씨앗이 필요해?" }],
      giftPrefs: { liked: ["item_strawberry"] },
      shop: { stock: [{ itemId: "item_spring_seed", seasons: ["spring"], priceOverride: 22 }] },
    });

    expect(result.ok, result.summary).toBe(true);
    const event = ctx.project.maps[map.id].events.find((entry) => entry.id === "ev_seed_seller");
    expect(event?.giftPrefs).toEqual({ liked: ["item_strawberry"] });
    expect(event?.pages?.[0]?.commands.some((command) => command.kind === "shop")).toBe(true);
  });
});

describe("Phase 11b run_scene_test integration", () => {
  it("gifts a loved item, branches on friendship, and changes shop stock by season", () => {
    const { project, ids } = createNpcScheduleDemoProject();
    const result = runSceneTest(project, {
      mapId: ids.townMapId,
      start: { x: 8, y: 1 },
      steps: [
        { kind: "gift", eventId: ids.farmerEventId, itemId: ids.strawberryItemId },
        { kind: "expect", friendshipAtLeast: { npcKey: ids.farmerEventId, value: 80 }, inventoryCount: { [ids.strawberryItemId]: 0 } },
        { kind: "interact" },
        { kind: "expect", variableEquals: { [ids.farmerFieldVariableId]: 2, [ids.farmerFriendshipVariableId]: 80 } },
        { kind: "wait", ticks: 188 },
        { kind: "expect", eventOnMap: { eventId: ids.merchantEventId, mapId: ids.shopMapId } },
        { kind: "expect", shopStock: { eventId: ids.merchantEventId, mapId: ids.shopMapId, itemIds: [ids.springSeedItemId], prices: { [ids.springSeedItemId]: 18 } } },
        { kind: "advanceDays", days: 84 },
        { kind: "wait", ticks: 188 },
        { kind: "expect", shopStock: { eventId: ids.merchantEventId, mapId: ids.shopMapId, itemIds: [ids.winterFirewoodItemId], prices: { [ids.winterFirewoodItemId]: 28 } } },
      ],
    });

    expect(result.ok, result.failureReason).toBe(true);
    expect(result.log).toContain(`gift ${ids.farmerEventId} ${ids.strawberryItemId}: loved 80 => 80`);
  });
});

function giftProject(): Project {
  const project = createBlankProject();
  project.system.giftSystem = true;
  project.system.timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26 };
  project.database.items.push(
    normalizeItemRecord({ id: "item_strawberry", name: "딸기", scope: "none", price: 12 }),
    normalizeItemRecord({ id: "item_liked", name: "좋은 선물", scope: "none", price: 8 }),
    normalizeItemRecord({ id: "item_disliked", name: "싫은 선물", scope: "none", price: 4 }),
    normalizeItemRecord({ id: "item_neutral", name: "평범한 선물", scope: "none", price: 2 }),
    normalizeItemRecord({ id: "item_spring_seed", name: "봄 씨앗", scope: "none", price: 30 }),
    normalizeItemRecord({ id: "item_winter_firewood", name: "겨울 장작", scope: "none", price: 50 })
  );
  project.session.inventory = {
    item_strawberry: 2,
    item_liked: 1,
    item_disliked: 1,
    item_neutral: 1,
  };
  return project;
}

function giftEvent(id: string): GameEvent {
  return {
    id,
    x: 1,
    y: 1,
    trigger: { kind: "action" },
    commands: [],
    giftPrefs: {
      loved: ["item_strawberry"],
      liked: ["item_liked"],
      disliked: ["item_disliked"],
    },
    pages: [eventPage(`${id}_page`, [])],
  };
}

function eventPage(id: string, commands: Command[]) {
  return {
    id,
    name: id,
    conditions: [],
    graphic: {},
    trigger: { kind: "action" as const },
    priority: "same" as const,
    overlapForbidden: true,
    movement: { type: "fixed" as const, speed: 3, frequency: 3 },
    commands,
  };
}
