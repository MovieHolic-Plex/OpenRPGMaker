import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { depositToChest, ensureChest } from "@/project/placeables";
import {
  chestAcceptsNewStack,
  resolveStorageChest,
  storageChestLockState,
  storageChestTabOf,
  transferChestGold,
} from "@/project/storageChest";

describe("resolveStorageChest", () => {
  it("keeps unlimited capacity and center layout for legacy commands without template", () => {
    const resolved = resolveStorageChest({ chestId: "old_box" });
    expect(resolved.template).toBeUndefined();
    expect(resolved.capacity).toBeUndefined();
    expect(resolved.layout).toBe("center");
    expect(resolved.displayName).toBe("보관 상자");
    expect(resolved.showIcons).toBe(true);
  });

  it("fills farm / warehouse / vault template defaults", () => {
    expect(resolveStorageChest({ template: "farm" })).toMatchObject({
      displayName: "농장 상자",
      layout: "center",
      capacity: 24,
      allowBulk: true,
      goldVault: false,
    });
    expect(resolveStorageChest({ template: "warehouse" })).toMatchObject({
      displayName: "공동 창고",
      layout: "wide",
      capacity: 80,
      showCategories: true,
    });
    expect(resolveStorageChest({ template: "vault" })).toMatchObject({
      displayName: "금고",
      capacity: 16,
      allowBulk: false,
      goldVault: true,
    });
  });

  it("lets authored fields override the template", () => {
    const resolved = resolveStorageChest({
      template: "farm",
      displayName: "뒷마당",
      layout: "bottom",
      capacity: 4,
      allowedItemTypes: ["seed", "not-a-type"],
    });
    expect(resolved.displayName).toBe("뒷마당");
    expect(resolved.layout).toBe("bottom");
    expect(resolved.capacity).toBe(4);
    expect(resolved.allowedItemTypes).toEqual(["seed"]);
  });
});

describe("storage chest lock and gold", () => {
  it("locks on switch off or missing key item", () => {
    const session = startSession(createBlankProject());
    expect(storageChestLockState(session, resolveStorageChest({ lockSwitchId: "sw_key" })).locked).toBe(true);
    session.switches.sw_key = true;
    expect(storageChestLockState(session, resolveStorageChest({ lockSwitchId: "sw_key" })).locked).toBe(false);
    expect(storageChestLockState(session, resolveStorageChest({ lockItemId: "item_key" })).reason).toBe("열쇠가 필요합니다.");
    session.inventory.item_key = 1;
    expect(storageChestLockState(session, resolveStorageChest({ lockItemId: "item_key" })).locked).toBe(false);
  });

  it("moves gold into and out of the chest", () => {
    const session = startSession(createBlankProject());
    session.gold = 40;
    const chest = ensureChest(session, { id: "vault", mapId: "m1", x: 0, y: 0 });
    expect(transferChestGold(session, chest, "deposit", 15)).toBe(true);
    expect(session.gold).toBe(25);
    expect(chest.gold).toBe(15);
    expect(transferChestGold(session, chest, "withdraw", 5)).toBe(true);
    expect(session.gold).toBe(30);
    expect(chest.gold).toBe(10);
    expect(transferChestGold(session, chest, "withdraw", 99)).toBe(false);
  });
});

describe("storage chest capacity and types", () => {
  it("counts distinct stacks and rejects a new stack when full", () => {
    expect(chestAcceptsNewStack({ a: 1, b: 2 }, "c", 2)).toBe(false);
    expect(chestAcceptsNewStack({ a: 1, b: 2 }, "a", 2)).toBe(true);
    expect(chestAcceptsNewStack({ a: 1 }, "c", undefined)).toBe(true);
  });

  it("depositToChest honors capacity and allowedItemTypes", () => {
    const session = startSession(createBlankProject());
    session.inventory = { herb: 2, ore: 2 };
    ensureChest(session, { id: "box", mapId: "m1", x: 1, y: 1 });
    expect(depositToChest(session, "box", "herb", 1, { capacity: 1, allowedItemTypes: ["medicine"], itemType: "medicine" })).toBe(true);
    expect(depositToChest(session, "box", "ore", 1, { capacity: 1, allowedItemTypes: ["medicine"], itemType: "normalGoods" })).toBe(false);
    expect(depositToChest(session, "box", "ore", 1, { capacity: 1, itemType: "normalGoods" })).toBe(false);
  });

  it("maps item types onto category tabs", () => {
    expect(storageChestTabOf("medicine")).toBe("medicine");
    expect(storageChestTabOf("weapon")).toBe("gear");
    expect(storageChestTabOf("switch")).toBe("key");
    expect(storageChestTabOf("seed")).toBe("material");
  });
});
