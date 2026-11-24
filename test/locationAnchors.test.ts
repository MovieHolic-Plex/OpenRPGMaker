import { afterAll, describe, expect, it } from "vitest";
import { Window } from "happy-dom";
import { startSession, type PlaySession } from "@/project/session";
import { assignFarmAnimalToBuilding, assignFarmAnimalToHousingPlacement, feedFarmAnimal, petFarmAnimal, advanceFarmAnimalProduction, collectFarmAnimalProduct } from "@/project/farmAnimals";
import { animalProject, feedItemId, productItemId } from "./fixtures/p1FarmAnimals";
import { normalizeFarmBuildingTypes } from "@/project/spatialPlacements";
import { resolveAnimalHome } from "@/project/animalHousing";
import { moveFarmBuilding, placeFarmBuilding, removeFarmBuilding, upgradeFarmBuilding } from "@/project/spatialPlacementTransactions";
import { collectLifeRecoveryClaim, reconcileLifeState } from "@/project/lifeRecovery";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveSlotKey, saveToSlot } from "@/player/saveSlots";
import { deserialize, serialize } from "@/project/io";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { applyMapDeletion } from "@/project/mapDeletion";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { locationCenter, resolveAnchorPoint, resolveLocationAnchorRect } from "@/project/locationAnchors";
import { createBlankProject } from "@/project/defaults";
import type { GameMap, Project } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";

describe("linkedAnimalHousing", () => {
  isolateTimers();
  const window = new Window();
  afterAll(() => window.close());
  function housingProject() {
    const project = animalProject();
    project.session.gold = 1000;
    project.session.inventory[feedItemId(project)] = 100;
    project.session.farmAnimals = ["z", "a", "b", "c", "d", "e", "f"].map((instanceId) => ({ instanceId, speciesId: "chicken", name: instanceId }));
    project.session.farmAnimals.push({ instanceId: "cow", speciesId: "cow", name: "Cow" });
    project.database.farmBuildingTypes = [{ id: "shed", name: "Shed", animalHousing: { allowedSpeciesIds: ["chicken"] }, levels: [
      { level: 1, footprint: { width: 1, height: 1 }, capacity: 99, animalCapacity: 2, cost: { gold: 10, items: [{ itemId: feedItemId(project), count: 2 }] }, graphicResourceId: "easyrpg-picture-cloud" },
      { level: 2, footprint: { width: 2, height: 1 }, capacity: 99, animalCapacity: 5, cost: { gold: 20, items: [{ itemId: feedItemId(project), count: 3 }] }, graphicResourceId: "easyrpg-picture-cloud" },
    ] }];
    return project;
  }
  function build(project: ReturnType<typeof housingProject>, session: PlaySession, id = "home1", x = 5) {
    expect(placeFarmBuilding(project, session, { instanceId: id, typeId: "shed", mapId: project.startMapId, x, y: 5, orientation: "down" })).toEqual({ ok: true });
  }
  function roundtrip(project: ReturnType<typeof housingProject>, session: PlaySession) {
    const storage = window.localStorage;
    storage.clear();
    const before = structuredClone(session);
    const snapshot = createSaveSnapshot(project, session);
    expect(snapshot.schemaVersion).toBe(5);
    expect(saveToSlot(storage, 1, snapshot).ok).toBe(true);
    const read = readSaveSlot(storage, 1);
    if (read.kind !== "present") throw new Error(read.kind);
    expect(session).toEqual(before);
    return applySaveSnapshot(project, read.snapshot);
  }
  function care(project: ReturnType<typeof housingProject>, session: PlaySession, ids: string[]) {
    for (const day of ["1:spring:1", "1:spring:2"]) {
      for (const id of ids) {
        expect(feedFarmAnimal(project, session, id, day).ok).toBe(true);
        expect(petFarmAnimal(project, session, id, day).ok).toBe(true);
      }
      expect(advanceFarmAnimalProduction(project, session, day).ok).toBe(true);
    }
  }
  describe("linked animal housing", () => {
    it("retains explicit housing species and per-level animal capacity independently of generic capacity", () => {
      const types = [{ id: "shed", name: "Shed", animalHousing: { allowedSpeciesIds: ["chicken"] }, levels: [
        { level: 1, footprint: { width: 1, height: 1 }, capacity: 99, animalCapacity: 2, graphicResourceId: "easyrpg-picture-cloud" },
        { level: 2, footprint: { width: 1, height: 1 }, capacity: 99, animalCapacity: 5, graphicResourceId: "easyrpg-picture-cloud" },
      ] }];
      expect(normalizeFarmBuildingTypes(types)).toEqual(types);
    });
    it("characterizes legacy independent home care, reassignment receipts and production", () => {
      const project = animalProject();
      project.session.inventory[feedItemId(project)] = 4;
      const session = startSession(project, 11);
      expect(assignFarmAnimalToBuilding(project, session, "animal_2", "coop").ok).toBe(true);
      for (const day of ["1:spring:1", "1:spring:2"]) {
        expect(feedFarmAnimal(project, session, "animal_1", day).ok).toBe(true);
        expect(petFarmAnimal(project, session, "animal_1", day).ok).toBe(true);
        expect(assignFarmAnimalToBuilding(project, session, "animal_1", "coop").ok).toBe(true);
        const before = structuredClone(session);
        expect(feedFarmAnimal(project, session, "animal_1", day)).toMatchObject({ ok: false, reason: "already-fed" });
        expect(session).toEqual(before);
        expect(advanceFarmAnimalProduction(project, session, day).ok).toBe(true);
      }
      expect(collectFarmAnimalProduct(project, session, "animal_1").ok).toBe(true);
      expect(session.inventory[productItemId(project)]).toBe(2);
      expect(session.farmAnimals?.animal_1?.friendship).toBe(20);
    });

    it("keeps two instance capacities independent, upgrades 2 to 5 and moves the same home with its receipts", () => {
      const project = housingProject();
      const session = startSession(project, 11);
      build(project, session);
      build(project, session, "home2", 9);
      for (const id of ["z", "a"]) expect(assignFarmAnimalToHousingPlacement(project, session, id, "home1").ok).toBe(true);
      for (const id of ["e", "f"]) expect(assignFarmAnimalToHousingPlacement(project, session, id, "home2").ok).toBe(true);
      const full = structuredClone(session);
      expect(assignFarmAnimalToHousingPlacement(project, session, "b", "home1")).toEqual({ ok: false, reason: "building-full" });
      expect(session).toEqual(full);
      care(project, session, ["a", "z"]);
      expect(upgradeFarmBuilding(project, session, "home1").ok).toBe(true);
      for (const id of ["b", "c", "d"]) expect(assignFarmAnimalToHousingPlacement(project, session, id, "home1").ok).toBe(true);
      expect(session.farmBuildingPlacements?.home1?.paymentReceipt).toEqual({ gold: 30, items: [{ itemId: feedItemId(project), count: 5 }] });
      const animals = structuredClone(session.farmAnimals);
      const receipt = structuredClone(session.farmBuildingPlacements?.home1?.paymentReceipt);
      expect(moveFarmBuilding(project, session, "home1", project.startMapId, 5, 8).ok).toBe(true);
      expect(session.farmAnimals).toEqual(animals);
      expect(session.farmBuildingPlacements?.home1?.paymentReceipt).toEqual(receipt);
      expect(resolveAnimalHome(project, session, session.farmAnimals!.a!)).toMatchObject({ id: "home1", mapId: project.startMapId, x: 5, y: 8, level: 2, capacity: 5 });
      const restored = roundtrip(project, session);
      expect(restored.farmAnimals).toEqual(animals);
      expect(restored.farmBuildingPlacements).toEqual(session.farmBuildingPlacements);
      const before = structuredClone(restored);
      expect(feedFarmAnimal(project, restored, "a", "1:spring:2")).toMatchObject({ ok: false, reason: "already-advanced" });
      expect(restored).toEqual(before);
    });

    it("rejects species, missing, conflict, full and cost failures with entire-state equality", () => {
      const project = housingProject();
      const session = startSession(project, 12);
      build(project, session);
      build(project, session, "home2", 6);
      for (const action of [
        () => assignFarmAnimalToHousingPlacement(project, session, "cow", "home1"),
        () => assignFarmAnimalToHousingPlacement(project, session, "a", "shed"),
        () => moveFarmBuilding(project, session, "home1", project.startMapId, 6, 5),
        () => upgradeFarmBuilding(project, session, "home1"),
        () => placeFarmBuilding(project, session, { instanceId: "collision", typeId: "shed", mapId: project.startMapId, x: 5, y: 5, orientation: "down" }),
      ]) {
        const before = structuredClone(session);
        expect(action().ok).toBe(false);
        expect(session).toEqual(before);
      }
      session.gold = 0;
      const before = structuredClone(session);
      expect(upgradeFarmBuilding(project, session, "home2")).toEqual({ ok: false, reason: "insufficient" });
      expect(placeFarmBuilding(project, session, { instanceId: "poor", typeId: "shed", mapId: project.startMapId, x: 8, y: 8, orientation: "down" })).toEqual({ ok: false, reason: "insufficient" });
      expect(session).toEqual(before);
    });

    it.each(["shrink", "demolish", "type-deletion", "disabled", "species-change"] as const)("%s preserves all animals and earned products without auto relocation", (change) => {
      const project = housingProject();
      const session = startSession(project, 13);
      build(project, session);
      build(project, session, "empty-home", 9);
      expect(upgradeFarmBuilding(project, session, "home1").ok).toBe(true);
      for (const id of ["z", "d", "c", "b", "a"]) expect(assignFarmAnimalToHousingPlacement(project, session, id, "home1").ok).toBe(true);
      care(project, session, ["a", "b", "c", "d", "z"]);
      const animals = structuredClone(session.farmAnimals!);
      const inventory = structuredClone(session.inventory);
      const gold = session.gold;
      if (change === "demolish") expect(removeFarmBuilding(session, "home1").ok).toBe(true);
      if (change === "type-deletion") project.database.farmBuildingTypes = [];
      if (change === "disabled") project.database.farmBuildingTypes = project.database.farmBuildingTypes!.map(({ animalHousing: _removed, ...type }) => type);
      if (change === "species-change") project.database.farmBuildingTypes = project.database.farmBuildingTypes!.map((type) => ({ ...type, animalHousing: { allowedSpeciesIds: ["cow"] } }));
      if (change === "shrink") project.database.farmBuildingTypes = project.database.farmBuildingTypes!.map((type) => ({ ...type, levels: type.levels.map((level) => ({ ...level, animalCapacity: 2 })) }));
      const restored = roundtrip(project, session);
      expect(Object.keys(restored.farmAnimals!)).toEqual(Object.keys(animals));
      for (const [id, animal] of Object.entries(animals)) {
        const { housingPlacementId: _old, ...unassigned } = animal;
        expect(restored.farmAnimals![id]).toEqual(change === "shrink" && ["a", "b"].includes(id) ? animal : unassigned);
      }
      expect(restored.inventory).toEqual(inventory);
      expect(roundtrip(project, restored).farmAnimals).toEqual(restored.farmAnimals);
      const before = structuredClone(restored);
      expect(feedFarmAnimal(project, restored, "z", "1:spring:3")).toMatchObject({ ok: false, reason: "unassigned" });
      expect(restored).toEqual(before);
      expect(collectFarmAnimalProduct(project, restored, "z")).toMatchObject({ ok: true, count: 2 });
      expect(restored.inventory[productItemId(project)]).toBe(2);
      if (change === "demolish") {
        expect(restored.lifeRecovery).toBeUndefined();
        expect(restored.gold).toBe(gold);
      }
      if (change === "type-deletion") {
        const claims = Object.values(restored.lifeRecovery!.claims).filter((entry) => entry.sourceId === "home1");
        expect(claims).toHaveLength(2);
        expect(claims.find(claim => claim.items.length === 0)?.unresolved?.record).toMatchObject({ paymentReceipt: { gold: 30, items: [{ itemId: feedItemId(project), count: 5 }] } });
        expect(claims.flatMap(claim => claim.items)).toEqual([{ itemId: feedItemId(project), count: 5 }]);
      }
    });

    it("does not reset daily care when switching between linked and legacy homes", () => {
      const project = housingProject();
      const session = startSession(project, 14);
      build(project, session);
      expect(assignFarmAnimalToHousingPlacement(project, session, "a", "home1").ok).toBe(true);
      expect(feedFarmAnimal(project, session, "a", "1:spring:1").ok).toBe(true);
      expect(petFarmAnimal(project, session, "a", "1:spring:1").ok).toBe(true);
      expect(assignFarmAnimalToBuilding(project, session, "a", "coop").ok).toBe(true);
      expect(session.farmAnimals!.a!.housingPlacementId).toBeUndefined();
      expect(assignFarmAnimalToHousingPlacement(project, session, "a", "home1").ok).toBe(true);
      expect(session.farmAnimals!.a!.buildingId).toBeUndefined();
      const before = structuredClone(session);
      expect(feedFarmAnimal(project, session, "a", "1:spring:1")).toMatchObject({ ok: false, reason: "already-fed" });
      expect(petFarmAnimal(project, session, "a", "1:spring:1")).toMatchObject({ ok: false, reason: "already-petted" });
      expect(session).toEqual(before);
    });

    it("roundtrips authored Project4 homes and rejects dual references, missing capacity and unknown species", () => {
      const project = housingProject();
      project.session.farmBuildingPlacements = [{ instanceId: "authored", typeId: "shed", mapId: project.startMapId, x: 5, y: 5, orientation: "down", level: 1 }];
      project.session.farmAnimals = [{ instanceId: "a", speciesId: "chicken", name: "A", housingPlacementId: "authored" }];
      const restored = deserialize(serialize(project));
      expect(restored.version).toBe(4);
      expect(restored.session.farmAnimals).toEqual(project.session.farmAnimals);
      expect(restored.database.farmBuildingTypes).toEqual(project.database.farmBuildingTypes);
      expect(startSession(restored, 15).farmAnimals!.a!.housingPlacementId).toBe("authored");
      for (const mutation of [
        (p: typeof project) => { p.session.farmAnimals = [{ ...p.session.farmAnimals![0]!, buildingId: "coop" }]; },
        (p: typeof project) => { p.database.farmBuildingTypes = p.database.farmBuildingTypes!.map((type) => ({ ...type, levels: type.levels.map(({ animalCapacity: _removed, ...level }) => level) })); },
      ]) {
        const invalid = structuredClone(project);
        mutation(invalid);
        expect(() => deserialize(serialize(invalid))).toThrow();
      }
      const invalid = structuredClone(project);
      invalid.database.farmBuildingTypes![0]!.animalHousing!.allowedSpeciesIds.push("missing");
      expect(collectProjectReferenceIssues(invalid).some((issue) => issue.includes("animalHousing.allowedSpeciesIds"))).toBe(true);
      expect(() => deserialize(serialize(invalid))).toThrow();
      const dangling = structuredClone(project);
      dangling.session.farmBuildingPlacements = [];
      expect(() => deserialize(serialize(dangling))).toThrow();
      for (const value of [-1, 0.5, 10000, NaN]) {
        expect(() => normalizeFarmBuildingTypes([{ ...project.database.farmBuildingTypes![0]!, levels: [{ ...project.database.farmBuildingTypes![0]!.levels[0]!, animalCapacity: value }] }])).toThrow();
      }
      expect(normalizeFarmBuildingTypes([{ ...project.database.farmBuildingTypes![0]!, levels: [{ ...project.database.farmBuildingTypes![0]!.levels[0]!, animalCapacity: 0 }] }])![0]!.levels[0]!.animalCapacity).toBe(0);
    });

    it.each(["dual", "invalid-id", "invalid-payment"])("rejects %s raw Save5 without rewriting bytes or live state", (kind) => {
      const project = housingProject();
      const session = startSession(project, 16);
      build(project, session);
      expect(assignFarmAnimalToHousingPlacement(project, session, "a", "home1").ok).toBe(true);
      const snapshot = createSaveSnapshot(project, session);
      if (kind === "dual") Object.assign(snapshot.session.farmAnimals!.a!, { buildingId: "coop" });
      if (kind === "invalid-id") Object.assign(snapshot.session.farmAnimals!.a!, { housingPlacementId: 7 });
      if (kind === "invalid-payment") Object.assign(snapshot.session.farmBuildingPlacements!.home1!, { paymentReceipt: { gold: -1, items: [] } });
      const raw = JSON.stringify(snapshot);
      const storage = window.localStorage;
      storage.setItem(saveSlotKey(1), raw);
      const before = structuredClone(session);
      expect(readSaveSlot(storage, 1).kind).toBe("corrupt");
      expect(() => applySaveSnapshot(project, snapshot)).toThrow();
      expect(storage.getItem(saveSlotKey(1))).toBe(raw);
      expect(session).toEqual(before);
      Object.assign(session.farmAnimals!.a!, { buildingId: "coop" });
      const dual = structuredClone(session);
      expect(feedFarmAnimal(project, session, "a", "1:spring:1")).toMatchObject({ ok: false, reason: "invalid-state" });
      expect(() => createSaveSnapshot(project, session)).toThrow();
      expect(session).toEqual(dual);
    });

    it("restores persistent occupancy before housing and never falls back to a legacy authored start", () => {
      const project = housingProject();
      project.session.farmAnimals = [{ instanceId: "a", speciesId: "chicken", name: "A", buildingId: "coop" }];
      const session = startSession(project, 17);
      build(project, session);
      expect(assignFarmAnimalToHousingPlacement(project, session, "a", "home1").ok).toBe(true);
      const snapshot = createSaveSnapshot(project, session);
      Object.assign(snapshot.session, { farmPlots: { [project.startMapId]: { "5,5": { tilled: true, watered: false } } } });
      const restored = applySaveSnapshot(project, snapshot);
      expect(restored.farmBuildingPlacements).toEqual({});
      expect(restored.farmAnimals!.a!.buildingId).toBeUndefined();
      expect(restored.farmAnimals!.a!.housingPlacementId).toBeUndefined();
      expect(roundtrip(project, restored).farmAnimals).toEqual(restored.farmAnimals);
    });

    it("preserves paid costs in recovery exactly once and refuses collection overflow", () => {
      const project = housingProject();
      const session = startSession(project, 18);
      build(project, session);
      project.database.farmBuildingTypes = [];
      const restored = reconcileLifeState(project, session);
      expect(restored.farmBuildingPlacements).toEqual({});
      const claims = structuredClone(restored.lifeRecovery);
      expect(reconcileLifeState(project, restored).lifeRecovery).toEqual(claims);
      restored.inventory[feedItemId(project)] = ITEM_QUANTITY_MAX;
      const before = structuredClone(restored);
      expect(collectLifeRecoveryClaim(project, restored, "recovery:1")).toEqual({ ok: false, reason: "inventory-overflow" });
      expect(restored).toEqual(before);
    });

    it("clears only linked starts on a deleted housing map", () => {
      const project = housingProject();
      project.maps.other = { ...structuredClone(project.maps[project.startMapId]!), id: "other" };
      project.session.farmBuildingPlacements = [{ instanceId: "gone", typeId: "shed", level: 1, mapId: "other", x: 5, y: 5, orientation: "down" }];
      project.session.farmAnimals = [{ instanceId: "a", name: "A", speciesId: "chicken", housingPlacementId: "gone" }, { instanceId: "b", name: "B", speciesId: "chicken", buildingId: "coop" }];
      applyMapDeletion(project, "other");
      expect(project.session.farmAnimals).toEqual([{ instanceId: "a", name: "A", speciesId: "chicken" }, { instanceId: "b", name: "B", speciesId: "chicken", buildingId: "coop" }]);
    });

    it("selects shrink survivors by code point, not locale or UTF-16, and retains special record keys", () => {
      const project = housingProject();
      const ids = ["\u{10000}", "\uE000", "__proto__"];
      project.session.farmAnimals = ids.map((instanceId) => ({ instanceId, speciesId: "chicken", name: instanceId }));
      const session = startSession(project, 19);
      build(project, session);
      expect(upgradeFarmBuilding(project, session, "home1").ok).toBe(true);
      for (const id of ids) expect(assignFarmAnimalToHousingPlacement(project, session, id, "home1").ok).toBe(true);
      care(project, session, ids);
      project.database.farmBuildingTypes = project.database.farmBuildingTypes!.map((type) => ({ ...type, levels: type.levels.map((level) => ({ ...level, animalCapacity: 2 })) }));
      const restored = roundtrip(project, session);
      expect(restored.farmAnimals!["\u{10000}"]!.housingPlacementId).toBeUndefined();
      expect(restored.farmAnimals!["\uE000"]!.housingPlacementId).toBe("home1");
      expect(restored.farmAnimals!["__proto__"]!.housingPlacementId).toBe("home1");
      for (const id of ids) expect(restored.farmAnimals![id]).toMatchObject({ friendship: 20, readyProductCount: 2, lastAdvancedDayKey: "1:spring:2" });
    });

    it.each([0, 4096])("voluntary demolition at %i recovery claims preserves the whole herd and refunds nothing", (claimCount) => {
      // The former refusal assertion encoded the bug: voluntary demolition is not recovery.
      const project = housingProject();
      const session = startSession(project, 20);
      build(project, session);
      build(project, session, "home2", 9);
      expect(upgradeFarmBuilding(project, session, "home1").ok).toBe(true);
      for (const id of ["a", "b"]) expect(assignFarmAnimalToHousingPlacement(project, session, id, "home1").ok).toBe(true);
      expect(assignFarmAnimalToHousingPlacement(project, session, "c", "home2").ok).toBe(true);
      care(project, session, ["a", "b", "c"]);
      expect(session.farmAnimals!.a).toMatchObject({ friendship: 20, readyProductCount: 2,
        lastFedDayKey: "1:spring:2", lastPettedDayKey: "1:spring:2", lastAdvancedDayKey: "1:spring:2" });
      if (claimCount) session.lifeRecovery = { nextSequence: claimCount + 1, claims: Object.fromEntries(Array.from({ length: claimCount }, (_, i) => {
        const id = `recovery:${i + 1}`;
        return [id, { id, sourceKind: "shippingQueue", sourceId: "old", reason: "removed", items: [{ itemId: feedItemId(project), count: 1 }] }];
      })) };
      const before = structuredClone(session);
      const expected = structuredClone(before);
      delete expected.farmBuildingPlacements!.home1;
      for (const id of ["a", "b"]) {
        const { housingPlacementId: _removed, ...unassigned } = expected.farmAnimals![id]!;
        expected.farmAnimals![id] = unassigned;
      }
      expect(removeFarmBuilding(session, "home1")).toEqual({ ok: true });
      expect(session).toEqual(expected);
      expect(session.gold).toBe(before.gold);
      expect(session.inventory).toEqual(before.inventory);
      expect(session.lifeRecovery).toEqual(before.lifeRecovery);
      const restored = roundtrip(project, session);
      expect(restored.farmAnimals).toEqual(expected.farmAnimals);
      expect(restored.farmBuildingPlacements).toEqual(expected.farmBuildingPlacements);
      expect(restored.lifeRecovery).toEqual(before.lifeRecovery);
      expect(restored.gold).toBe(before.gold);
      expect(restored.inventory).toEqual(before.inventory);
    });
  });
});

// 로케이션 앵커 (2026-09-12): 좌표 대신 이름으로 목적지를 가리킨다.
describe("locationAnchors", () => {
  isolateTimers();
  function mapWith(id: string, locations: GameMap["locations"]): GameMap {
    return {
      id,
      name: id,
      width: 20,
      height: 20,
      tilesetId: "easyrpg_chipset_combined_town",
      tileSize: 16,
      lowerTiles: new Array(400).fill(0),
      upperTiles: new Array(400).fill(0),
      events: [],
      locations,
    };
  }
  function projectWith(): Project {
    const project = createBlankProject();
    project.maps = {
      map_a: mapWith("map_a", [{ id: "loc1", name: "광장", x: 4, y: 6, w: 5, h: 3 }]),
      map_b: mapWith("map_b", [{ id: "loc1", name: "다른 광장", x: 40, y: 40, w: 2, h: 2 }]),
    };
    project.startMapId = "map_a";
    return project;
  }
  describe("location anchors", () => {
    it("중심 칸은 홀수 크기에서 정확히 가운데다", () => {
      expect(locationCenter({ x: 4, y: 6, w: 5, h: 3 })).toEqual({ x: 6, y: 7 });
      expect(locationCenter({ x: 0, y: 0, w: 1, h: 1 })).toEqual({ x: 0, y: 0 });
    });

    it("앵커는 그 맵의 구역 사각형을 푼다", () => {
      const project = projectWith();
      expect(resolveLocationAnchorRect(project, "map_a", { locationId: "loc1" })).toEqual({ x: 4, y: 6, w: 5, h: 3 });
    });

    it("맵을 안 주면 풀지 않는다 — loc1 은 맵마다 다른 장소다", () => {
      const project = projectWith();
      expect(resolveLocationAnchorRect(project, undefined, { locationId: "loc1" })).toBeNull();
      expect(resolveLocationAnchorRect(project, "map_b", { locationId: "loc1" })).toEqual({ x: 40, y: 40, w: 2, h: 2 });
    });

    it("끊긴 참조는 폴백 좌표로 돌려주고 fromLocation=false 로 말한다", () => {
      const project = projectWith();
      const point = resolveAnchorPoint(project, "map_a", { locationId: "loc_missing" }, { x: 1, y: 2 });
      expect(point).toEqual({ x: 1, y: 2, fromLocation: false });
    });

    it("앵커가 있으면 좌표를 무시하고 구역 중심을 쓴다", () => {
      const project = projectWith();
      const point = resolveAnchorPoint(project, "map_a", { locationId: "loc1" }, { x: 1, y: 2 });
      expect(point).toEqual({ x: 6, y: 7, fromLocation: true });
    });

    it("앵커가 없으면 좌표 그대로다 — 옛 정의가 그대로 돈다", () => {
      const project = projectWith();
      expect(resolveAnchorPoint(project, "map_a", {}, { x: 3, y: 4 })).toEqual({ x: 3, y: 4, fromLocation: false });
    });

    it("구역을 옮기면 해석 결과도 따라간다 — 복사본이 아니다", () => {
      const project = projectWith();
      project.maps.map_a.locations = [{ id: "loc1", name: "광장", x: 10, y: 10, w: 5, h: 3 }];
      expect(resolveLocationAnchorRect(project, "map_a", { locationId: "loc1" })).toEqual({ x: 10, y: 10, w: 5, h: 3 });
    });

    it("끊긴 필드 스폰 앵커를 참조 검증이 올린다", () => {
      const project = projectWith();
      project.maps.map_a.fieldSpawns = [
        { id: "spawn_1", troopId: Object.values(project.database.troops)[0]?.id ?? "troop_1", area: { x: 1, y: 1, w: 2, h: 2 }, locationId: "loc_missing" },
      ];
      const issues = collectProjectReferenceIssues(project);
      expect(issues.some((issue) => issue.includes("fieldSpawns[0].locationId does not exist"))).toBe(true);
    });

    it("살아 있는 앵커는 조용하다", () => {
      const project = projectWith();
      const troopId = Object.values(project.database.troops)[0]?.id ?? "troop_1";
      project.maps.map_a.fieldSpawns = [
        { id: "spawn_1", troopId, area: { x: 1, y: 1, w: 2, h: 2 }, locationId: "loc1" },
      ];
      const issues = collectProjectReferenceIssues(project);
      expect(issues.some((issue) => issue.includes("locationId does not exist"))).toBe(false);
    });
  });
});
