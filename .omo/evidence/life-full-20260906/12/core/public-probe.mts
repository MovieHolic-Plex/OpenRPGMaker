import assert from "node:assert/strict";
import { createBlankProject, createFarmingDemoProject } from "../../../../../src/project/defaults";
import { startSession } from "../../../../../src/project/session";
import { adjacentSpatialPosition, canPlaceSpatialFootprint } from "../../../../../src/project/spatialOccupancy";
import { placeFarmBuilding, placeHomeDecoration } from "../../../../../src/project/spatialPlacementTransactions";
import { restoreSpatialPlacementRecords } from "../../../../../src/project/spatialPlacementRestore";
import { interactWithFarmPlot, advanceFarmPlotsForDay } from "../../../../../src/player/farming";
import { applySaveSnapshot, createSaveSnapshot, saveToSlot, readSaveSlot } from "../../../../../src/player/saveSlots";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
const project = createBlankProject();
const mapId = project.startMapId;
const itemId = project.database.items[0]!.id;
project.database.farmBuildingTypes = [{ id: "probe-shed", name: "Probe shed", levels: [{ level: 1, capacity: 1, footprint: { width: 1, height: 1 }, cost: { gold: 1 }, graphicResourceId: "easyrpg-picture-cloud" }] }];
project.database.homeDecorationTypes = [{ id: "probe-rug", name: "Probe rug", footprint: { width: 1, height: 1 }, blocksMovement: false, allowedOrientations: ["down"], placementItemId: itemId, graphicResourceId: "easyrpg-picture-cloud" }];
const session = startSession(project, 1212);
session.gold = 10;
session.inventory[itemId] = 1;
const player = { mapId, x: 7, y: 7, footprint: { width: 3, height: 3 }, passRows: 1 };
const npc = { mapId, x: 12, y: 7, footprint: { width: 3, height: 3 }, passRows: 1 };
const live = () => ({ player, npcs: [npc] });
const target = adjacentSpatialPosition(player, "left", { width: 1, height: 1 }, "down");
assert.deepEqual(target, { mapId, x: 5, y: 5, orientation: "down" });
const input = { ...target, instanceId: "probe-shed-1", typeId: "probe-shed" };
assert.equal(canPlaceSpatialFootprint(project, session, input, { width: 1, height: 1 }, live), true);
npc.x = 5;
const before = structuredClone(session);
assert.deepEqual(placeFarmBuilding(project, session, input, live), { ok: false, reason: "blocked" });
assert.deepEqual(session, before);
npc.x = 12;
assert.equal(placeFarmBuilding(project, session, input, live).ok, true);
assert.equal(placeHomeDecoration(project, session, { ...input, x: 5, y: 6, instanceId: "probe-rug-1", typeId: "probe-rug" }, live).ok, true);
player.x = 5;
session.x = 5; session.y = 5;
assert.deepEqual(restoreSpatialPlacementRecords(project, session, session).farmBuildingPlacements, session.farmBuildingPlacements);
const farmProject = createFarmingDemoProject();
const farmSession = startSession(farmProject, 1213);
const map = farmProject.maps[farmProject.startMapId]!;
const farm: string[] = [];
for (let i = 0; i < 3; i++) farm.push(interactWithFarmPlot(farmProject, farmSession, map, 4, 5).kind);
advanceFarmPlotsForDay(farmProject, farmSession, 1, "spring");
farm.push(interactWithFarmPlot(farmProject, farmSession, map, 4, 5).kind);
advanceFarmPlotsForDay(farmProject, farmSession, 1, "spring");
farm.push(interactWithFarmPlot(farmProject, farmSession, map, 4, 5).kind);
assert.deepEqual(farm, ["tilled", "planted", "watered", "watered", "harvested"]);
const storage = new MemoryStorage();
const snapshot = createSaveSnapshot(project, session);
saveToSlot(storage, 1, snapshot);
const parsed = readSaveSlot(storage, 1);
assert.equal(parsed.kind, "present");
if (parsed.kind !== "present") throw new Error("missing slot");
const restored = applySaveSnapshot(project, parsed.snapshot);
assert.deepEqual(restored.farmBuildingPlacements, session.farmBuildingPlacements);
assert.deepEqual(restored.homeDecorationPlacements, session.homeDecorationPlacements);
assert.equal(JSON.stringify(parsed.snapshot).includes('"npcs"'), false);
const key = storage.key(0)!;
const raw = storage.getItem(key);
const invalid = structuredClone(snapshot);
invalid.session.farmBuildingPlacements!["probe-shed-1"] = { ...invalid.session.farmBuildingPlacements!["probe-shed-1"]!, x: Number.NaN };
assert.throws(() => applySaveSnapshot(project, invalid));
assert.equal(storage.getItem(key), raw);
assert.deepEqual(session.farmBuildingPlacements, restored.farmBuildingPlacements);
console.log(JSON.stringify({ surface: "nonvisual public library (vite-node); no scene/browser", target, movedNpcRejectedWithoutMutation: true, farm, saveSchemaVersion: snapshot.schemaVersion, restoredBuildings: Object.keys(restored.farmBuildingPlacements!), restoredRugs: Object.keys(restored.homeDecorationPlacements!), rejectedInvalidApplyPreservedRaw: true, liveContextAbsentFromSave: true }, null, 2));
