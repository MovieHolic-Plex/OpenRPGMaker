import { describe, expect, it } from "vitest";
import { transitionToNextDay } from "@/player/dayTransition";
import { startSession } from "@/project/session";
import { p2LifeProject } from "./fixtures/p2LifeSystems";

describe("P2 forage day-transition integration", () => {
  it("settles the source day then spawns destination-day forage through the one transition authority", () => {
    // Break caught: forage runs against the source season or outside the atomic day-transition draft.
    const project = p2LifeProject();
    const session = startSession(project, 501);
    session.shippingQueue = { item_trout: 1 };
    session.energy = 1;

    const result = transitionToNextDay(project, session, "1:spring:1");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.receipt.stages).toEqual([
      "recovery", "shipping", "calendar", "dailyWeather", "rainWatering", "farm", "forage", "energy", "makers", "animals",
    ]);
    expect(result.receipt.forage).toMatchObject({ ok: true, dayKey: "1:spring:2", spawned: 2 });
    expect(session.shippingLastSettledDayKey).toBe("1:spring:1");
    expect(session.collections?.item_trout?.shippedCount).toBe(1);
    expect(session.forageLastAdvancedDayKey).toBe("1:spring:2");
    expect(session.energy).toBe(6);
  });

  it("rolls back shipping, calendar, forage, and energy when forage validation fails", () => {
    // Break caught: a mid-transition forage failure leaves prior stages committed.
    const project = p2LifeProject();
    project.system.seasonalForage!.areas[0]!.area.w = 0;
    const session = startSession(project, 502);
    session.shippingQueue = { item_trout: 1 };
    const before = structuredClone(session);

    expect(transitionToNextDay(project, session, "1:spring:1")).toEqual({ ok: false, reason: "forage", stage: "forage" });
    expect(session).toEqual(before);
  });
});
