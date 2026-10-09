import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { startSession } from "@/project/session";
import {
  moveFarmBuilding,
  moveHomeDecoration,
  placeFarmBuilding,
  placeHomeDecoration,
  removeFarmBuilding,
  removeHomeDecoration,
  rotateHomeDecoration,
  upgradeFarmBuilding,
} from "@/project/spatialPlacementTransactions";

function spatialProject() {
  const project = createBlankProject();
  const itemId = project.database.items[0]!.id;
  project.database.farmBuildingTypes = [{
    id: "shed",
    name: "Shed",
    levels: [
      {
        level: 1,
        footprint: { width: 2, height: 2 },
        capacity: 4,
        cost: { gold: 100, items: [{ itemId, count: 2 }, { itemId, count: 1 }] },
        graphicResourceId: "easyrpg-picture-cloud",
      },
      {
        level: 2,
        footprint: { width: 3, height: 2 },
        capacity: 8,
        cost: { gold: 200, items: [{ itemId, count: 2 }] },
        graphicResourceId: "easyrpg-picture-cloud",
      },
    ],
  }];
  project.database.homeDecorationTypes = [{
    id: "table",
    name: "Table",
    placementItemId: itemId,
    footprint: { width: 2, height: 1 },
    blocksMovement: true,
    allowedOrientations: ["down", "left", "right", "up"],
    graphicResourceId: "easyrpg-picture-cloud",
  }];
  return { project, itemId };
}

describe("P2 spatial atomic transactions", () => {
  it("builds, moves, upgrades, and removes a general structure without touching P1 homes", () => {
    // Break caught: building costs and placement are not committed as one independent transaction.
    const { project, itemId } = spatialProject();
    const session = startSession(project, 701);
    session.gold = 500;
    session.inventory[itemId] = 7;

    expect(placeFarmBuilding(project, session, {
      instanceId: "shed_1", typeId: "shed", mapId: project.startMapId, x: 2, y: 2, orientation: "down",
    })).toEqual({ ok: true });
    expect(session.gold).toBe(400);
    expect(session.inventory[itemId]).toBe(4);
    expect(session.farmBuildingPlacements?.shed_1).toMatchObject({ level: 1, x: 2, y: 2 });
    expect(project.system.farmAnimalBuildings).toBeUndefined();

    expect(moveFarmBuilding(project, session, "shed_1", project.startMapId, 5, 3)).toEqual({ ok: true });
    expect(upgradeFarmBuilding(project, session, "shed_1")).toEqual({ ok: true });
    expect(session.farmBuildingPlacements?.shed_1).toMatchObject({ level: 2, x: 5, y: 3 });
    expect(session.gold).toBe(200);
    expect(session.inventory[itemId]).toBe(2);
    expect(removeFarmBuilding(session, "shed_1")).toEqual({ ok: true });
    expect(session.farmBuildingPlacements).toEqual({});
    expect(session.inventory[itemId]).toBe(2);
  });

  it("places, rotates, moves, and removes decor while conserving its inventory item", () => {
    // Break caught: decor removal can mint/lose an item or rotation ignores the swapped footprint.
    const { project, itemId } = spatialProject();
    const session = startSession(project, 702);
    session.inventory[itemId] = 2;

    expect(placeHomeDecoration(project, session, {
      instanceId: "table_1", typeId: "table", mapId: project.startMapId, x: 3, y: 3, orientation: "down",
    })).toEqual({ ok: true });
    expect(session.inventory[itemId]).toBe(1);
    expect(rotateHomeDecoration(project, session, "table_1", "left")).toEqual({ ok: true });
    expect(moveHomeDecoration(project, session, "table_1", project.startMapId, 6, 3)).toEqual({ ok: true });
    expect(session.homeDecorationPlacements?.table_1).toMatchObject({ orientation: "left", x: 6, y: 3 });
    expect(removeHomeDecoration(project, session, "table_1")).toEqual({ ok: true });
    expect(session.inventory[itemId]).toBe(2);
    expect(session.homeDecorationPlacements).toEqual({});
  });

  it("rejects collision, stale, poisoned, and overflow attempts with zero mutation", () => {
    // Break caught: failed footprint/economy preflight partially debits or overwrites a placement.
    const { project, itemId } = spatialProject();
    const session = startSession(project, 703);
    session.gold = 500;
    session.inventory[itemId] = 9;
    expect(placeFarmBuilding(project, session, {
      instanceId: "shed_1", typeId: "shed", mapId: project.startMapId, x: 2, y: 2, orientation: "down",
    }).ok).toBe(true);

    for (const action of [
      () => placeHomeDecoration(project, session, {
        instanceId: "table_collision", typeId: "table", mapId: project.startMapId, x: 2, y: 2, orientation: "down",
      }),
      () => moveFarmBuilding(project, session, "shed_1", project.startMapId, -1, 2),
      () => upgradeFarmBuilding(project, session, "missing"),
    ]) {
      const before = structuredClone(session);
      expect(action().ok).toBe(false);
      expect(session).toEqual(before);
    }

    session.inventory[itemId] = Number.POSITIVE_INFINITY;
    const poisoned = structuredClone(session);
    expect(placeHomeDecoration(project, session, {
      instanceId: "table_poison", typeId: "table", mapId: project.startMapId, x: 8, y: 2, orientation: "down",
    }).ok).toBe(false);
    expect(session).toEqual(poisoned);

    session.inventory[itemId] = ITEM_QUANTITY_MAX;
    session.homeDecorationPlacements = {
      table_existing: {
        instanceId: "table_existing", typeId: "table", mapId: project.startMapId, x: 8, y: 2, orientation: "down",
      },
    };
    const full = structuredClone(session);
    expect(removeHomeDecoration(project, session, "table_existing")).toEqual({ ok: false, reason: "overflow" });
    expect(session).toEqual(full);
  });
});
