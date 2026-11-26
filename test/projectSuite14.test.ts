import { describe, expect, it, afterEach, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { advanceSeasonalForage, collectForageAt } from "@/project/seasonalForage";
import { p2LifeProject } from "./fixtures/p2LifeSystems";
import * as occupancy from "@/project/spatialOccupancy";
import { footprintBounds, passageBounds } from "@/project/footprint";
import { placeFarmBuilding, placeHomeDecoration, moveFarmBuilding, moveHomeDecoration, rotateHomeDecoration, upgradeFarmBuilding, removeFarmBuilding, removeHomeDecoration } from "@/project/spatialPlacementTransactions";
import { restoreSpatialPlacementRecords } from "@/project/spatialPlacementRestore";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveToSlot } from "@/player/saveSlots";
import { attemptFishingCatch } from "@/project/fishing";
import { donateMuseumItem } from "@/project/museum";
import type { Project } from "@/project/types";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { isolateTimers } from "./mergedTeardown";
import { createStandaloneHtmlExport } from "@/project/standaloneExport";
import { STANDALONE_ASSETS_NODE_ID, STANDALONE_PROJECT_NODE_ID } from "@/project/standaloneHtml";
import { terrainRecordAt } from "@/project/terrainAt";

describe("spatialPlacementTransactions", () => {
  isolateTimers();
  describe("lifePlacementSafety", () => {
    isolateTimers();
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
  });
  describe("p2HostileAudit", () => {
    isolateTimers();
    describe("P2 hostile fishing and collection boundaries", () => {
      it("fails closed when a fishing-enabled session has lost its collection authority", () => {
        // Break caught: deleting collections lets catches succeed without an exact caught receipt.
        const project = p2LifeProject();
        const session = startSession(project, 902);
        session.collections = undefined;
        const before = structuredClone(session);

        expect(attemptFishingCatch(project, session, fishingLocation(project))).toEqual({ ok: false, reason: "invalid-state" });
        expect(session).toEqual(before);
      });

      it("rejects a stale fish item reference without minting an unknown inventory row", () => {
        // Break caught: direct project mutation bypasses reference lint and a catch grants a deleted item id.
        const project = p2LifeProject();
        project.database.fishSpecies![0]!.itemId = "deleted_fish_item";
        const session = startSession(project, 911);
        const before = structuredClone(session);

        expect(attemptFishingCatch(project, session, fishingLocation(project))).toEqual({ ok: false, reason: "invalid-state" });
        expect(session).toEqual(before);
      });
    });
    describe("P2 hostile forage date, validation, and occupancy", () => {
      it("rejects a date beyond the authored season length without stamping the cursor", () => {
        // Break caught: spring day 29 aliases summer day 1 in a 28-day calendar and blocks a real future advance.
        const project = p2LifeProject();
        const session = startSession(project, 903);
        const before = structuredClone(session);

        expect(advanceSeasonalForage(project, session, {
          year: 1, season: "spring", day: 29, hour: 6, minute: 0,
        })).toEqual({ ok: false, reason: "invalid-date" });
        expect(session).toEqual(before);
      });

      it("rejects a malformed catch table without cleanup or cursor mutation", () => {
        // Break caught: an unsafe direct-authored weight is treated as a successful empty spawn and consumes the day.
        const project = p2LifeProject();
        project.system.seasonalForage!.areas[0]!.entries[0]!.weight = Number.POSITIVE_INFINITY;
        const session = startSession(project, 904);
        const before = structuredClone(session);

        expect(advanceSeasonalForage(project, session, {
          year: 1, season: "spring", day: 2, hour: 6, minute: 0,
        })).toEqual({ ok: false, reason: "invalid-state" });
        expect(session).toEqual(before);
      });

      it("does not spawn forage on tiles occupied by chests", () => {
        // Break caught: forage checks only placeables and materializes underneath another runtime occupancy authority.
        const project = p2LifeProject();
        const session = startSession(project, 905);
        session.chests = {};
        for (let y = 0; y < 4; y += 1) for (let x = 0; x < 4; x += 1) {
          const id = `chest_${x}_${y}`;
          session.chests[id] = { id, mapId: project.startMapId, x, y, inventory: {} };
        }

        expect(advanceSeasonalForage(project, session, {
          year: 1, season: "spring", day: 2, hour: 6, minute: 0,
        })).toMatchObject({ ok: true, spawned: 0 });
        expect(Object.values(session.placeables ?? {}).filter((entry) => entry.forageSpawn)).toEqual([]);
      });

      it("does not spawn forage inside a placed farm-building footprint", () => {
        // Break caught: forage and spatial placement authorities use asymmetric occupancy checks and overlap at runtime.
        const project = p2LifeProject();
        project.database.farmBuildingTypes = [{
          id: "forage_blocker",
          name: "Forage blocker",
          levels: [{
            level: 1,
            footprint: { width: 4, height: 4 },
            capacity: 1,
            graphicResourceId: "easyrpg-picture-cloud",
          }],
        }];
        const session = startSession(project, 912);
        expect(placeFarmBuilding(project, session, {
          instanceId: "building_1",
          typeId: "forage_blocker",
          mapId: project.startMapId,
          x: 0,
          y: 0,
          orientation: "down",
        })).toEqual({ ok: true });

        expect(advanceSeasonalForage(project, session, {
          year: 1, season: "spring", day: 2, hour: 6, minute: 0,
        })).toMatchObject({ ok: true, spawned: 0 });
        expect(Object.values(session.placeables ?? {}).filter((entry) => entry.forageSpawn)).toEqual([]);
      });
    });
    describe("P2 hostile museum exact-once state", () => {
      it("fails closed when a museum-enabled session has lost its collection authority", () => {
        // Break caught: absent collections makes the same museum item consumable as a donation more than once.
        const project = p2LifeProject();
        const session = startSession(project, 907);
        session.inventory.item_trout = 2;
        session.collections = undefined;
        const before = structuredClone(session);

        expect(donateMuseumItem(project, session, "item_trout")).toEqual({ ok: false, reason: "invalid-state" });
        expect(session).toEqual(before);
      });

      it("rejects duplicate reward ids before applying either reward", () => {
        // Break caught: direct project mutation grants duplicate-id rewards twice and writes a poisoned receipt list.
        const project = p2LifeProject();
        project.system.museum!.rewards = [
          { id: "duplicate_reward", minDonations: 1, reward: { gold: 5 } },
          { id: "duplicate_reward", minDonations: 1, reward: { gold: 5 } },
        ];
        const session = startSession(project, 908);
        session.inventory.item_trout = 1;
        const before = structuredClone(session);

        expect(donateMuseumItem(project, session, "item_trout")).toEqual({ ok: false, reason: "invalid-state" });
        expect(session).toEqual(before);
      });
    });
    describe("P2 hostile direct save application", () => {
      it("drops unknown collection rows so they cannot satisfy museum donation milestones", () => {
        // Break caught: a poisoned donated ghost item counts toward minDonations after direct save apply.
        const project = p2LifeProject();
        project.system.museum!.rewards = [{ id: "two_real_donations", minDonations: 2, reward: { gold: 50 } }];
        const snapshot = createSaveSnapshot(project, startSession(project, 909));
        snapshot.session.inventory = { ...snapshot.session.inventory, item_trout: 1 };
        snapshot.session.collections = {
          ...snapshot.session.collections,
          ghost_item: { discovered: true, shippedCount: 0, caughtCount: 0, donated: true },
        };

        const restored = applySaveSnapshot(project, snapshot);
        expect(restored.collections?.ghost_item).toBeUndefined();
        expect(donateMuseumItem(project, restored, "item_trout")).toMatchObject({ ok: true, appliedRewardIds: [] });
        expect(restored.gold).toBe(0);
      });

      it("drops forged forage whose saved item does not match its authored seasonal entry", () => {
        // Break caught: valid-looking provenance lets a save replace a berry with any database item and mint it on collect.
        const project = p2LifeProject();
        const snapshot = createSaveSnapshot(project, startSession(project, 910));
        const key = `${project.startMapId}:1,1`;
        snapshot.session.placeables = {
          [key]: {
            id: "forged_forage",
            mapId: project.startMapId,
            x: 1,
            y: 1,
            kind: "forage",
            itemId: "item_reward",
            forageSpawn: { areaId: "area_farm", entryId: "berry", spawnedDayKey: "1:spring:1" },
          },
        };

        const restored = applySaveSnapshot(project, snapshot);
        expect(restored.placeables?.[key]).toBeUndefined();
        expect(collectForageAt(project, restored, project.startMapId, 1, 1)).toEqual({ ok: false, reason: "missing" });
        expect(restored.inventory.item_reward).toBeUndefined();
      });
    });
    function fishingLocation(project: Project) {
      return { mapId: project.startMapId, x: 1, y: 1 };
    }
  });
  describe("p2SpatialPersistence", () => {
    isolateTimers();
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
        // #3474: 저장 JSON 은 수가 아닌 수(Infinity)를 0 으로 적는다(읽기 검사가 슬롯 전체를 버리지 않게) —
        // 그래서 저장 경로의 shed_unsafe 는 x=0 의 정상 배치로 돌아오고, 회수 기록은 나머지 넷이다.
        expect(Object.values(parsed.lifeRecovery?.claims ?? {}).map((claim) => claim.sourceId).sort()).toEqual([
          "shed_oob", "shed_unknown", "table_collision", "table_invalid_orientation",
        ]);
        for (const restored of [parsed]) {
          expect(restored.farmBuildingPlacements).toEqual({
            shed_valid: expect.objectContaining({ instanceId: "shed_valid", x: 2, y: 2 }),
            shed_unsafe: expect.objectContaining({ instanceId: "shed_unsafe", x: 0, y: 2 }),
          });
          expect(restored.homeDecorationPlacements).toEqual({});
        }
      });
    });
  });
  describe("p2SpatialTransactions", () => {
    isolateTimers();
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
  });
});

describe("standaloneExport", () => {
  isolateTimers();
  const encoder = new TextEncoder();
  /** 디스크·네트워크 대신 쓰는 재료 공급자. 번들은 표식만, 에셋은 1바이트만 준다. */
  function stubFetchBytes(options: { readonly missing?: (path: string) => boolean } = {}) {
    const asked: string[] = [];
    const fetchBytes = async (path: string): Promise<Uint8Array> => {
      asked.push(path);
      if (path.endsWith("standalone.js")) return encoder.encode("/*BUNDLE*/");
      if (path.endsWith("standalone.css")) return encoder.encode("body{background:url(/assets/fonts/x.woff2)}");
      if (options.missing?.(path) === true) throw new Error("없음");
      return new Uint8Array([1]);
    };
    return { asked, fetchBytes };
  }
  describe("standalone html export", () => {
    it("에셋을 data URL 로 문서에 싣고 파일명을 제목에서 만든다", async () => {
      // Given
      const project = createBlankProject();
      project.meta.title = "모험 하나";
      const { fetchBytes } = stubFetchBytes();

      // When
      const result = await createStandaloneHtmlExport(project, { fetchBytes });
      const html = await result.blob.text();

      // Then
      expect(result.fileName).toBe("모험-하나.html");
      expect(result.summary.assetCount).toBeGreaterThan(100);
      expect(result.summary.missingAssets).toEqual([]);
      expect(html).toContain("/*BUNDLE*/");
      expect(html).toContain(`id="${STANDALONE_PROJECT_NODE_ID}"`);
      expect(html).toContain(`id="${STANDALONE_ASSETS_NODE_ID}"`);
      expect(html).toContain("data:image/png;base64,");
      // Korean in the project makes UTF-16 length smaller than the downloaded file.
      expect(result.summary.htmlBytes).toBe(result.blob.size);
      expect(result.summary.htmlBytes).toBeGreaterThan(html.length);
    });

    afterEach(() => vi.unstubAllGlobals());

    it.each([".png", ".woff2"])("rejects missing required %s instead of returning a download", async (extension) => {
      const { fetchBytes } = stubFetchBytes({ missing: (path) => path.endsWith(extension) });
      await expect(createStandaloneHtmlExport(createBlankProject(), { fetchBytes }))
        .rejects.toThrow(extension);
    });

    it.each(["standalone.js", "standalone.css", ".png", ".woff2"])(
      "rejects editor HTML returned with status 200 for %s", async (suffix) => {
        const { fetchBytes } = stubFetchBytes();
        vi.stubGlobal("fetch", async (path: string) => new Response(
          path.endsWith(suffix) ? "<!doctype html><html><body>editor</body></html>" : await fetchBytes(path),
          { status: 200, headers: { "Content-Type": "application/octet-stream" } },
        ));
        await expect(createStandaloneHtmlExport(createBlankProject())).rejects.toThrow(suffix);
      },
    );

    it("rejects a text/html response even without an HTML opening tag", async () => {
      const { fetchBytes } = stubFetchBytes();
      vi.stubGlobal("fetch", async (path: string) => new Response(await fetchBytes(path), {
        headers: { "Content-Type": path.endsWith("standalone.js") ? "text/html; charset=utf-8" : "application/octet-stream" },
      }));
      await expect(createStandaloneHtmlExport(createBlankProject())).rejects.toThrow("standalone.js");
    });

    it.each(["standalone.js", "standalone.css", ".png"])("rejects empty %s", async (suffix) => {
      const { fetchBytes } = stubFetchBytes();
      await expect(createStandaloneHtmlExport(createBlankProject(), {
        fetchBytes: (path) => path.endsWith(suffix) ? Promise.resolve(new Uint8Array()) : fetchBytes(path),
      })).rejects.toThrow(suffix);
    });

    it("CSS 가 요구하는 폰트를 에셋 클로저 밖에서도 채운다", async () => {
      // Given
      const project = createBlankProject();
      const { asked, fetchBytes } = stubFetchBytes();

      // When
      const result = await createStandaloneHtmlExport(project, { fetchBytes });
      const html = await result.blob.text();

      // Then
      expect(asked).toContain("/assets/fonts/x.woff2");
      expect(html).toContain('url("data:font/woff2;base64,');
    });

    it("번들 재료를 못 받으면 실패를 숨기지 않는다", async () => {
      // Given
      const project = createBlankProject();
      const fetchBytes = async (path: string): Promise<Uint8Array> => {
        if (path.endsWith("standalone.js")) throw new Error("번들 없음");
        return new Uint8Array([1]);
      };

      // When
      const attempt = createStandaloneHtmlExport(project, { fetchBytes });

      // Then
      await expect(attempt).rejects.toThrow("번들 없음");
    });
  });
});

describe("terrainRecordAt", () => {
  isolateTimers();
  function tagTile(project: ReturnType<typeof createBlankProject>, tag: number): { mapId: string; x: number; y: number } {
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    if (!map) throw new Error("missing start map");
    const tileset = project.tilesets[map.tilesetId];
    if (!tileset) throw new Error("missing tileset");
    const x = project.startPos.x;
    const y = project.startPos.y;
    const tile = map.lowerTiles[y * map.width + x] ?? 0;
    if (!Array.isArray(tileset.terrain)) (tileset as { terrain: number[] }).terrain = [];
    while (tileset.terrain.length <= tile) tileset.terrain.push(0);
    tileset.terrain[tile] = tag;
    const meta = [...(tileset.tileMeta ?? [])];
    while (meta.length <= tile) meta.push({ label: "", description: "" });
    meta[tile] = { ...(meta[tile] ?? { label: "", description: "" }), terrainTag: tag };
    tileset.tileMeta = meta;
    return { mapId, x, y };
  }
  describe("terrainRecordAt", () => {
    it("resolves tag N to the Nth authored terrain record", () => {
      const project = createBlankProject();
      const loc = tagTile(project, 2);
      project.database.terrains = [
        { id: "t1", name: "평지", damage: 0, encounterRatePercent: 100, characterDisplay: "normal", vehiclePassage: { boat: false, ship: false, airshipLand: true } },
        { id: "t2", name: "독늪", damage: 10, encounterRatePercent: 50, characterDisplay: "normal", vehiclePassage: { boat: false, ship: false, airshipLand: true } },
      ];
      const found = terrainRecordAt(project, loc);
      expect(found?.record.id).toBe("t2");
      expect(found?.tag).toBe(2);
    });

    it("returns undefined when the tile has no tag", () => {
      const project = createBlankProject();
      const loc = tagTile(project, 0);
      expect(terrainRecordAt(project, loc)).toBeUndefined();
    });

    it("falls back to tileMeta.terrainTag over tileset.terrain", () => {
      const project = createBlankProject();
      const loc = tagTile(project, 0);
      const map = project.maps[loc.mapId];
      if (!map) throw new Error("missing map");
      const tileset = project.tilesets[map.tilesetId];
      if (!tileset) throw new Error("missing tileset");
      const tile = map.lowerTiles[loc.y * map.width + loc.x] ?? 0;
      const meta = [...(tileset.tileMeta ?? [])];
      while (meta.length <= tile) meta.push({ label: "", description: "" });
      meta[tile] = { ...(meta[tile] ?? { label: "", description: "" }), terrainTag: 3 };
      tileset.tileMeta = meta;
      project.database.terrains = [
        { id: "t1", name: "평지", damage: 0, encounterRatePercent: 100, characterDisplay: "normal", vehiclePassage: { boat: false, ship: false, airshipLand: true } },
        { id: "t2", name: "둘", damage: 0, encounterRatePercent: 100, characterDisplay: "normal", vehiclePassage: { boat: false, ship: false, airshipLand: true } },
        { id: "t3", name: "셋", damage: 7, encounterRatePercent: 10, characterDisplay: "transparent", vehiclePassage: { boat: true, ship: false, airshipLand: false } },
      ];
      const found = terrainRecordAt(project, loc);
      expect(found?.tag).toBe(3);
      expect(found?.record.id).toBe("t3");
    });
  });
});
