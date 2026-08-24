import { describe, expect, it } from "vitest";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { GOLD_MAX, startSession } from "@/project/session";
import { depositShipping, settleShipping, withdrawShipping } from "@/project/shipping";

function projectWithShipping(historyLimit = 2) {
  const project = createBlankProject();
  for (const [id, price] of [["item_turnip", 20], ["item_milk", 40]] as const) {
    const record = normalizeItemRecord({ id, name: id, scope: "none", price });
    const index = project.database.items.findIndex((item) => item.id === id);
    if (index >= 0) project.database.items[index] = record;
    else project.database.items.push(record);
  }
  project.system.shipping = { enabled: true, historyLimit };
  project.system.sellPrices = [
    { itemId: "item_turnip", price: 10 },
    { itemId: "item_milk", price: 25 },
  ];
  return project;
}

describe("P0 shipping rules", () => {
  it("deposits and withdraws inventory atomically", () => {
    // Break caught: queue changes without the inverse inventory movement.
    const project = projectWithShipping();
    const session = startSession(project, 1);
    session.inventory = { item_turnip: 5 };

    expect(depositShipping(project, session, "item_turnip", 3)).toEqual({
      ok: true,
      itemId: "item_turnip",
      queued: 3,
    });
    expect(session.inventory.item_turnip).toBe(2);
    expect(session.shippingQueue?.item_turnip).toBe(3);

    expect(withdrawShipping(project, session, "item_turnip", 2)).toEqual({
      ok: true,
      itemId: "item_turnip",
      queued: 1,
    });
    expect(session.inventory.item_turnip).toBe(4);
    expect(session.shippingQueue?.item_turnip).toBe(1);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5])(
    "rejects malformed deposit count %s without mutation",
    (count) => {
      // Break caught: invalid counts remove or mint inventory entries.
      const project = projectWithShipping();
      const session = startSession(project, 2);
      session.inventory = { item_turnip: 5 };
      expect(depositShipping(project, session, "item_turnip", count)).toMatchObject({ ok: false, reason: "invalid-count" });
      expect(session.inventory).toEqual({ item_turnip: 5 });
      expect(session.shippingQueue).toEqual({});
    },
  );

  it("rejects unknown, disallowed, insufficient, and over-withdraw operations without partial mutation", () => {
    // Break caught: an error branch mutates one side of the inventory/queue transaction.
    const project = projectWithShipping();
    project.system.shipping = { enabled: true, allowedItemIds: ["item_turnip"] };
    const session = startSession(project, 3);
    session.inventory = { item_turnip: 1, item_milk: 2 };

    expect(depositShipping(project, session, "item_missing", 1)).toMatchObject({ ok: false, reason: "unknown-item" });
    project.system.sellPrices!.push({ itemId: "item_missing", price: 99 });
    session.inventory.item_missing = 1;
    expect(depositShipping(project, session, "item_missing", 1)).toMatchObject({ ok: false, reason: "unknown-item" });
    delete session.inventory.item_missing;
    expect(depositShipping(project, session, "item_milk", 1)).toMatchObject({ ok: false, reason: "item-not-allowed" });
    expect(depositShipping(project, session, "item_turnip", 2)).toMatchObject({ ok: false, reason: "insufficient-inventory" });
    expect(session.inventory).toEqual({ item_turnip: 1, item_milk: 2 });
    expect(session.shippingQueue).toEqual({});

    session.shippingQueue = { item_turnip: 1 };
    expect(withdrawShipping(project, session, "item_turnip", 2)).toMatchObject({ ok: false, reason: "insufficient-queue" });
    expect(session.shippingQueue).toEqual({ item_turnip: 1 });
    expect(session.inventory).toEqual({ item_turnip: 1, item_milk: 2 });

    session.shippingQueue = { item_missing: 1 };
    const staleQueue = structuredClone(session);
    expect(withdrawShipping(project, session, "item_missing", 1)).toMatchObject({ ok: false, reason: "unknown-item" });
    expect(session).toEqual(staleQueue);
  });

  it("settles one day exactly once, caps gold, and bounds immutable history", () => {
    // Break caught: replaying a day-end credits gold twice or grows history without bound.
    const project = projectWithShipping(2);
    const session = startSession(project, 4);
    session.gold = GOLD_MAX - 6;
    session.shippingQueue = { item_turnip: 2 };

    const first = settleShipping(project, session, "1:spring:1");
    expect(first).toMatchObject({ ok: true, total: 20, credited: 6 });
    expect(session.gold).toBe(GOLD_MAX);
    expect(session.shippingQueue).toEqual({});
    expect(session.shippingLastSettledDayKey).toBe("1:spring:1");
    expect(session.shippingHistory?.[0]).toMatchObject({ dayKey: "1:spring:1", total: 20, credited: 6 });

    const frozen = structuredClone(session);
    expect(settleShipping(project, session, "1:spring:1")).toMatchObject({ ok: false, reason: "already-settled" });
    expect(session).toEqual(frozen);

    session.shippingQueue = { item_milk: 1 };
    expect(settleShipping(project, session, "1:spring:2").ok).toBe(true);
    session.shippingQueue = {};
    expect(settleShipping(project, session, "1:spring:3").ok).toBe(true);
    const afterEmptySettlement = structuredClone(session);
    expect(settleShipping(project, session, "1:spring:3")).toMatchObject({ ok: false, reason: "already-settled" });
    expect(session).toEqual(afterEmptySettlement);
    expect(session.shippingHistory?.map((entry) => entry.dayKey)).toEqual(["1:spring:2", "1:spring:3"]);
  });

  it("does not settle a malformed queue or blank day key", () => {
    // Break caught: settlement clears valid rows before discovering an invalid row.
    const project = projectWithShipping();
    const session = startSession(project, 5);
    session.shippingQueue = { item_turnip: 1, item_missing: 1 };
    const before = structuredClone(session);
    expect(settleShipping(project, session, "1:spring:4")).toMatchObject({ ok: false, reason: "unknown-item" });
    expect(session).toEqual(before);
    expect(settleShipping(project, session, "   ")).toMatchObject({ ok: false, reason: "invalid-day-key" });
    expect(session).toEqual(before);
  });
});
