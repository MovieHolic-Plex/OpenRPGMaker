import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { removeFarmBuilding, removeHomeDecoration } from "@/project/spatialPlacementTransactions";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveToSlot } from "@/player/saveSlots";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

function persistedSpatialProject() {
  const project = createBlankProject();
  const itemId = project.database.items[0]!.id;
  project.database.farmBuildingTypes = [{
    id: "shed",
    name: "Shed",
    levels: [{
      level: 1,
      footprint: { width: 2, height: 2 },
      capacity: 4,
      graphicResourceId: "easyrpg-picture-cloud",
    }],
  }];
  project.database.homeDecorationTypes = [{
    id: "table",
    name: "Table",
    placementItemId: itemId,
    footprint: { width: 1, height: 1 },
    blocksMovement: true,
    allowedOrientations: ["down", "left"],
    graphicResourceId: "easyrpg-picture-cloud",
  }];
  project.session.farmBuildingPlacements = [{
    instanceId: "shed_authored", typeId: "shed", level: 1,
    mapId: project.startMapId, x: 2, y: 2, orientation: "down",
  }];
  project.session.homeDecorationPlacements = [{
    instanceId: "table_authored", typeId: "table",
    mapId: project.startMapId, x: 5, y: 2, orientation: "down",
  }];
  return project;
}

describe("P2 spatial persistence", () => {
  it("round-trips records and preserves an explicitly emptied runtime collection", () => {
    // Break caught: applying an empty saved record falls back to authored placements and resurrects removed objects.
    const project = persistedSpatialProject();
    const session = startSession(project, 801);
    expect(removeFarmBuilding(session, "shed_authored").ok).toBe(true);
    expect(removeHomeDecoration(project, session, "table_authored").ok).toBe(true);
    const snapshot = createSaveSnapshot(project, session);
    expect(snapshot.session.farmBuildingPlacements).toEqual({});
    expect(snapshot.session.homeDecorationPlacements).toEqual({});

    const storage = new MemoryStorage();
    saveToSlot(storage, 1, snapshot);
    const read = readSaveSlot(storage, 1);
    expect(read.kind).toBe("present");
    if (read.kind !== "present") throw new Error("expected present save");
    const restored = applySaveSnapshot(project, read.snapshot);
    expect(restored.farmBuildingPlacements).toEqual({});
    expect(restored.homeDecorationPlacements).toEqual({});
  });

  it("keeps authored placements only when legacy saves omit the new fields", () => {
    // Break caught: adding the package turns old saves into an explicit empty layout.
    const project = persistedSpatialProject();
    const snapshot = createSaveSnapshot(project, startSession(project, 802));
    delete (snapshot.session as { farmBuildingPlacements?: unknown }).farmBuildingPlacements;
    delete (snapshot.session as { homeDecorationPlacements?: unknown }).homeDecorationPlacements;

    const restored = applySaveSnapshot(project, snapshot);
    expect(Object.keys(restored.farmBuildingPlacements ?? {})).toEqual(["shed_authored"]);
    expect(Object.keys(restored.homeDecorationPlacements ?? {})).toEqual(["table_authored"]);
  });

  it("drops unknown, unsafe, out-of-bounds, and overlapping saved placements", () => {
    // Break caught: wire parsing/direct apply trusts poisoned coordinates or lets two saved footprints occupy one tile.
    const project = persistedSpatialProject();
    const snapshot = createSaveSnapshot(project, startSession(project, 803));
    (snapshot.session as { farmBuildingPlacements?: unknown }).farmBuildingPlacements = {
      shed_valid: {
        instanceId: "shed_valid", typeId: "shed", level: 1,
        mapId: project.startMapId, x: 2, y: 2, orientation: "down",
      },
      shed_unknown: {
        instanceId: "shed_unknown", typeId: "missing", level: 1,
        mapId: project.startMapId, x: 8, y: 2, orientation: "down",
      },
      shed_unsafe: {
        instanceId: "shed_unsafe", typeId: "shed", level: 1,
        mapId: project.startMapId, x: Number.POSITIVE_INFINITY, y: 2, orientation: "down",
      },
      shed_oob: {
        instanceId: "shed_oob", typeId: "shed", level: 1,
        mapId: project.startMapId, x: -1, y: 2, orientation: "down",
      },
    };
    (snapshot.session as { homeDecorationPlacements?: unknown }).homeDecorationPlacements = {
      table_collision: {
        instanceId: "table_collision", typeId: "table",
        mapId: project.startMapId, x: 2, y: 2, orientation: "down",
      },
      table_invalid_orientation: {
        instanceId: "table_invalid_orientation", typeId: "table",
        mapId: project.startMapId, x: 8, y: 2, orientation: "up",
      },
    };

    const storage = new MemoryStorage();
    saveToSlot(storage, 1, snapshot);
    const read = readSaveSlot(storage, 1);
    expect(read.kind).toBe("present");
    if (read.kind !== "present") throw new Error("expected present save");
    const parsed = applySaveSnapshot(project, read.snapshot);
    // Non-JSON Infinity cannot be preserved losslessly on direct apply; reject the whole draft.
    expect(() => applySaveSnapshot(project, snapshot)).toThrow();
    expect(Object.values(parsed.lifeRecovery?.claims ?? {})).toHaveLength(5);
    for (const restored of [parsed]) {
      expect(restored.farmBuildingPlacements).toEqual({
        shed_valid: expect.objectContaining({ instanceId: "shed_valid", x: 2, y: 2 }),
      });
      expect(restored.homeDecorationPlacements).toEqual({});
    }
  });
});
