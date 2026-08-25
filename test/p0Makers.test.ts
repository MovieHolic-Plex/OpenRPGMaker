import { describe, expect, it } from "vitest";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { absoluteGameMinutes, advanceMakers, collectMaker, startMaker } from "@/project/makers";
import { startSession } from "@/project/session";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";

function makerProject() {
  const project = createBlankProject();
  for (const id of ["item_milk", "item_cheese"]) {
    const record = normalizeItemRecord({ id, name: id, scope: "none", price: 20 });
    const index = project.database.items.findIndex((item) => item.id === id);
    if (index >= 0) project.database.items[index] = record;
    else project.database.items.push(record);
  }
  project.system.timeSystem = {
    enabled: true,
    dayStartHour: 6,
    dayEndHour: 26,
    daysPerSeason: 28,
  };
  project.system.makers = [{
    id: "maker_cheese",
    inputs: [{ itemId: "item_milk", count: 1 }],
    outputs: [{ itemId: "item_cheese", count: 2 }],
    durationMinutes: 30,
  }];
  return project;
}

describe("P0 timed makers", () => {
  it("uses a monotonic absolute game-minute clock across a season/day boundary", () => {
    // Break caught: spring 28 late-night → summer 1 morning makes the timer move backwards.
    const project = makerProject();
    const before = absoluteGameMinutes(
      { year: 1, season: "spring", day: 28, hour: 25, minute: 30 },
      project.system.timeSystem,
    );
    const after = absoluteGameMinutes(
      { year: 1, season: "summer", day: 1, hour: 6, minute: 0 },
      project.system.timeSystem,
    );
    expect(after - before).toBe(30);

    const session = startSession(project, 1);
    session.inventory = { item_milk: 1 };
    expect(startMaker(project, session, "farm:4,5", "maker_cheese", before)).toMatchObject({
      ok: true,
      readyAtMinute: after,
    });
    expect(session.inventory.item_milk).toBeUndefined();
    expect(advanceMakers(project, session, after - 1)).toEqual({ ok: true, readyInstanceIds: [] });
    expect(session.makerInstances?.["farm:4,5"]?.status).toBe("processing");
    expect(advanceMakers(project, session, after)).toEqual({ ok: true, readyInstanceIds: ["farm:4,5"] });
    expect(session.makerInstances?.["farm:4,5"]?.status).toBe("ready");
  });

  it("preserves a processing timer through the shared save snapshot path", () => {
    // Break caught: a save/load recreates a processing maker as idle or shifts its deadline.
    const project = makerProject();
    const session = startSession(project, 2);
    session.inventory = { item_milk: 1 };
    expect(startMaker(project, session, "farm:1,1", "maker_cheese", 1_000).ok).toBe(true);

    const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
    expect(restored.makerInstances).toEqual(session.makerInstances);
    expect(advanceMakers(project, restored, 1_030)).toEqual({ ok: true, readyInstanceIds: ["farm:1,1"] });
    expect(collectMaker(project, restored, "farm:1,1")).toMatchObject({
      ok: true,
      outputs: [{ itemId: "item_cheese", count: 2 }],
    });
    expect(restored.inventory.item_cheese).toBe(2);
    expect(restored.makerInstances?.["farm:1,1"]).toEqual({
      instanceId: "farm:1,1",
      makerId: "maker_cheese",
      status: "idle",
    });
    const frozen = structuredClone(restored);
    expect(collectMaker(project, restored, "farm:1,1")).toMatchObject({ ok: false, reason: "not-ready" });
    expect(restored).toEqual(frozen);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid absolute minute %s before consuming inputs",
    (minute) => {
      // Break caught: invalid/overflow deadlines consume inputs and leave an unusable instance.
      const project = makerProject();
      const session = startSession(project, 3);
      session.inventory = { item_milk: 1 };
      expect(startMaker(project, session, "farm:2,2", "maker_cheese", minute)).toMatchObject({ ok: false, reason: "invalid-time" });
      expect(session.inventory).toEqual({ item_milk: 1 });
      expect(session.makerInstances).toEqual({});
    },
  );

  it("rejects missing inventory, busy instances, and invalid definitions atomically", () => {
    // Break caught: maker input is consumed before busy/definition validation completes.
    const project = makerProject();
    const session = startSession(project, 4);
    session.inventory = {};
    expect(startMaker(project, session, "farm:3,3", "maker_cheese", 100)).toMatchObject({ ok: false, reason: "insufficient-input" });
    expect(session.makerInstances).toEqual({});

    session.inventory = { item_milk: 2 };
    expect(startMaker(project, session, "farm:3,3", "maker_cheese", 100).ok).toBe(true);
    const busy = structuredClone(session);
    expect(startMaker(project, session, "farm:3,3", "maker_cheese", 110)).toMatchObject({ ok: false, reason: "busy" });
    expect(session).toEqual(busy);

    const broken = makerProject();
    broken.system.makers![0] = {
      ...broken.system.makers![0]!,
      outputs: [{ itemId: "item_missing", count: 1 }],
    };
    const brokenSession = startSession(broken, 5);
    brokenSession.inventory = { item_milk: 1 };
    const before = structuredClone(brokenSession);
    expect(startMaker(broken, brokenSession, "farm:4,4", "maker_cheese", 100)).toMatchObject({ ok: false, reason: "invalid-definition" });
    expect(brokenSession).toEqual(before);
  });
});
