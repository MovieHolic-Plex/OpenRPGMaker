import { describe, expect, it } from "vitest";
import { createBlankProject, createFarmingDemoProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { advanceSeasonalForage } from "@/project/seasonalForage";
import { p2LifeProject } from "./fixtures/p2LifeSystems";
import * as occupancy from "@/project/spatialOccupancy";
import { footprintBounds, passageBounds } from "@/project/footprint";
import { placeFarmBuilding, placeHomeDecoration, moveFarmBuilding, moveHomeDecoration, rotateHomeDecoration, upgradeFarmBuilding } from "@/project/spatialPlacementTransactions";
import { restoreSpatialPlacementRecords } from "@/project/spatialPlacementRestore";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveToSlot } from "@/player/saveSlots";
import { advanceFarmPlotsForDay, interactWithFarmPlot } from "@/player/farming";

function fixture() {
  const project = createBlankProject();
  const itemId = project.database.items[0]!.id;
  project.database.farmBuildingTypes = [{ id: "shed", name: "Shed", levels: [
    { level: 1, footprint: { width: 1, height: 1 }, capacity: 1, cost: { gold: 10, items: [{ itemId, count: 1 }] }, graphicResourceId: "easyrpg-picture-cloud" },
    { level: 2, footprint: { width: 3, height: 2 }, capacity: 2, cost: { gold: 20 }, graphicResourceId: "easyrpg-picture-cloud" },
  ] }];
  project.database.homeDecorationTypes = [{ id: "rug", name: "Rug", placementItemId: itemId, footprint: { width: 2, height: 1 }, blocksMovement: false, allowedOrientations: ["up", "down", "left", "right"], graphicResourceId: "easyrpg-picture-cloud" }];
  const session = startSession(project, 1200);
  session.gold = 100;
  session.inventory[itemId] = 10;
  const mapId = project.startMapId;
  const input = (x: number, y: number, instanceId = "shed1") => ({ instanceId, typeId: "shed", mapId, x, y, orientation: "down" as const });
  const player = { mapId, x: 5, y: 5, footprint: { width: 3, height: 3 }, passRows: 1 };
  const context = () => ({ player, npcs: [] });
  return { project, session, mapId, input, player, context };
}

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

function roundtrip(project: ReturnType<typeof createBlankProject>, session: ReturnType<typeof startSession>) {
  const storage = new MemoryStorage();
  saveToSlot(storage, 1, createSaveSnapshot(project, session));
  const read = readSaveSlot(storage, 1);
  expect(read.kind).toBe("present");
  if (read.kind !== "present") throw new Error("save missing");
  return applySaveSnapshot(project, read.snapshot);
}

describe("task12 nonvisual placement safety", () => {
  it("rejects every full 3x3 body cell despite one passage row, without spending", () => {
    const { project, session, input, context, player } = fixture();
    expect(passageBounds(5, 5, player.footprint, 1).top).toBe(5);
    expect(footprintBounds(5, 5, player.footprint).top).toBe(3);
    for (let y = 3; y <= 5; y++) for (let x = 4; x <= 6; x++) {
      const before = structuredClone(session);
      expect(placeFarmBuilding(project, session, input(x, y), context)).toEqual({ ok: false, reason: "blocked" });
      expect(session).toEqual(before);
    }
  });

  it("targets outside the full body using the complete oriented footprint", () => {
    const { player } = fixture();
    const fp = { width: 3, height: 2 };
    for (const [direction, x, y] of [["up", 4, 0], ["down", 4, 6], ["left", 2, 3], ["right", 7, 3]] as const) {
      expect(occupancy.adjacentSpatialPosition(player, direction, fp, "left")).toEqual({ mapId: player.mapId, x, y, orientation: "left" });
    }
  });

  it("reads moved NPC bodies anew on apply, not the successful preview", () => {
    const { project, session, input, player, mapId } = fixture();
    const npc = { mapId, x: 12, y: 8, footprint: { width: 3, height: 3 }, passRows: 1 };
    const live = () => ({ player, npcs: [npc] });
    expect(occupancy.canPlaceSpatialFootprint(project, session, input(9, 6), { width: 1, height: 1 }, live)).toBe(true);
    npc.x = 9;
    const before = structuredClone(session);
    expect(placeFarmBuilding(project, session, input(9, 6), live)).toEqual({ ok: false, reason: "blocked" });
    expect(session).toEqual(before);
  });

  it("checks move, rotation and upgrade expansion before any state or costs change", () => {
    const { project, session, input, context, mapId } = fixture();
    expect(placeFarmBuilding(project, session, input(2, 3), context).ok).toBe(true);
    expect(placeHomeDecoration(project, session, { ...input(6, 1, "rug1"), typeId: "rug" }, context).ok).toBe(true);
    const before = structuredClone(session);
    for (const action of [
      () => moveFarmBuilding(project, session, "shed1", mapId, 4, 3, context),
      () => upgradeFarmBuilding(project, session, "shed1", context),
      () => moveHomeDecoration(project, session, "rug1", mapId, 3, 3, context),
      () => rotateHomeDecoration(project, session, "rug1", "left", () => ({ player: { ...context().player, y: 4 }, npcs: [] })),
    ]) {
      expect(action()).toEqual({ ok: false, reason: "blocked" });
      expect(session).toEqual(before);
    }
  });

  it("checks rotated map boundaries and does not globally reject actor overhang", () => {
    const { project, session, input, player, mapId } = fixture();
    player.x = 0; player.y = 0;
    const context = () => ({ player, npcs: [{ ...player, x: -1 }] });
    expect(placeFarmBuilding(project, session, input(10, 10), context).ok).toBe(true);
    const before = structuredClone(session);
    expect(placeHomeDecoration(project, session, { ...input(10, project.maps[mapId]!.height - 1, "rug1"), typeId: "rug", orientation: "left" }, context).ok).toBe(false);
    expect(session).toEqual(before);
  });

  it("refuses closure of the last local walkable neighbor atomically", () => {
    const { project, session, input, mapId } = fixture();
    const player = { mapId, x: 5, y: 5, footprint: { width: 1, height: 1 } };
    for (const [x, y] of [[4, 5], [5, 4], [5, 6]]) expect(placeFarmBuilding(project, session, input(x!, y!, `${x},${y}`)).ok).toBe(true);
    const before = structuredClone(session);
    expect(placeFarmBuilding(project, session, input(6, 5), () => ({ player, npcs: [] }))).toEqual({ ok: false, reason: "blocked" });
    expect(session).toEqual(before);
    expect(roundtrip(project, session).farmBuildingPlacements).toEqual(before.farmBuildingPlacements);
  });

  it("respects actual plots but farming can water and harvest its own plot", () => {
    const project = createFarmingDemoProject();
    const session = startSession(project, 1201);
    const map = project.maps[project.startMapId]!;
    expect(interactWithFarmPlot(project, session, map, 4, 5).kind).toBe("tilled");
    expect(occupancy.canOccupySpatialFootprint(project, session, { mapId: map.id, x: 4, y: 5, orientation: "down" }, { width: 1, height: 1 })).toBe(false);
    expect(interactWithFarmPlot(project, session, map, 4, 5).kind).toBe("planted");
    expect(interactWithFarmPlot(project, session, map, 4, 5).kind).toBe("watered");
    advanceFarmPlotsForDay(project, session, 1, "spring");
    expect(interactWithFarmPlot(project, session, map, 4, 5).kind).toBe("watered");
    advanceFarmPlotsForDay(project, session, 1, "spring");
    expect(interactWithFarmPlot(project, session, map, 4, 5).kind).toBe("harvested");
    expect(session.inventory.item_potato).toBe(1);
  });

  it("restores a rug and building under transient actors and roundtrips without context", () => {
    const { project, session, input, context, player } = fixture();
    expect(placeFarmBuilding(project, session, input(8, 5), context).ok).toBe(true);
    expect(placeHomeDecoration(project, session, { ...input(4, 7, "rug1"), typeId: "rug" }, context).ok).toBe(true);
    player.x = 8;
    session.x = 8; session.y = 5;
    const restored = restoreSpatialPlacementRecords(project, session, session);
    expect(restored.farmBuildingPlacements).toEqual(session.farmBuildingPlacements);
    expect(restored.homeDecorationPlacements).toEqual(session.homeDecorationPlacements);
    const saved = roundtrip(project, session);
    expect(saved.farmBuildingPlacements).toEqual(session.farmBuildingPlacements);
    expect(saved.homeDecorationPlacements).toEqual(session.homeDecorationPlacements);
    expect(saved.lifeRecovery).toEqual(session.lifeRecovery);
    expect(JSON.stringify(createSaveSnapshot(project, session))).not.toContain('"npcs"');
    expect(JSON.stringify(createSaveSnapshot(project, session))).not.toContain('"passRows"');
    session.x = 4; session.y = 7;
    expect(roundtrip(project, session).homeDecorationPlacements).toEqual(session.homeDecorationPlacements);
  });

  it("does not spread structurally extra live context into either placement record", () => {
    const { project, session, input, context } = fixture();
    const extra = { ...input(10, 8), ...context(), readLive: context };
    expect(placeFarmBuilding(project, session, extra, context).ok).toBe(true);
    expect(placeHomeDecoration(project, session, { ...extra, instanceId: "rug1", typeId: "rug", y: 10 }, context).ok).toBe(true);
    for (const record of [session.farmBuildingPlacements!.shed1!, session.homeDecorationPlacements!.rug1!]) {
      expect(record).not.toHaveProperty("player");
      expect(record).not.toHaveProperty("npcs");
      expect(record).not.toHaveProperty("readLive");
    }
    expect(roundtrip(project, session).farmBuildingPlacements).toEqual(session.farmBuildingPlacements);
  });

  it("forage reserves plots while unoccupied farmable terrain remains available", () => {
    const project = p2LifeProject();
    const session = startSession(project, 1202);
    const area = project.system.seasonalForage!.areas[0]!;
    project.system.seasonalForage = { ...project.system.seasonalForage!, areas: [{ ...area, area: { x: 4, y: 4, w: 2, h: 1 }, dailySpawnCount: 2, maxActive: 2 }] };
    session.farmPlots = { [area.mapId]: { "4,4": { tilled: true, watered: false } } };
    expect(advanceSeasonalForage(project, session, { year: 1, season: "spring", day: 2, hour: 6, minute: 0 })).toMatchObject({ ok: true, spawned: 1 });
    expect(Object.values(session.placeables ?? {}).filter((entry) => entry.forageSpawn).map(({ x, y }) => [x, y])).toEqual([[5, 4]]);
  });

  it("persistent plot incompatibility still recovers proved building payment exactly once", () => {
    const { project, session, input } = fixture();
    expect(placeFarmBuilding(project, session, input(8, 5)).ok).toBe(true);
    const receipt = structuredClone(session.farmBuildingPlacements!.shed1!.paymentReceipt);
    session.farmPlots = { [project.startMapId]: { "8,5": { tilled: true, watered: false } } };
    const before = structuredClone(session);
    const restored = roundtrip(project, session);
    expect(session).toEqual(before);
    expect(restored.farmBuildingPlacements).toEqual({});
    const claims = Object.values(restored.lifeRecovery!.claims);
    expect(claims).toHaveLength(2);
    expect(claims.filter(claim => claim.items.length > 0).flatMap(claim => claim.items)).toEqual(receipt!.items);
    expect(claims.find(claim => claim.items.length === 0)?.unresolved?.record).toEqual(before.farmBuildingPlacements!.shed1);
    expect(claims.find(claim => claim.items.length === 0)?.unresolved?.record).toMatchObject({ paymentReceipt: { gold: 10 } });
    expect(roundtrip(project, restored).lifeRecovery).toEqual(restored.lifeRecovery);
  });
});
