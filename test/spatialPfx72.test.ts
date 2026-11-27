import { afterEach, expect, it, afterAll, describe } from "vitest";
import { getMapEditHistoryEntries, getMapEditHistoryState, undoMapEdit } from "../src/editor/mapEditHistory";
import { applyAuthoringPreview, bindSpatialAuthoringControllerFactory, editAuthoringDraft, previewAuthoringDraft } from "../src/editor/panels/spatialAuthoringAccess";
import { previewSpatialSourceBuild, spatialBuildProposal } from "../src/editor/panels/spatialBuildActions";
import { own, spatialId, assertNever, requireOccurrenceAssociations, findOccurrenceChildId } from "../src/project/spatial/domain";
import { store } from "../src/project/store";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { manualBuildFixture } from "./support/spatialManualBuildFixture";
import { fixtureDocument, spaceDesign, interiorAtlas, replaceOccurrence, spaceCompilerFixture, spaceRoot, reinstantiateSpace, outdoorCompilerFixture, objectStampFixture } from "./support/spatialSpaceCompilerFixture";
import { Window } from "happy-dom";
import { animalProject } from "./fixtures/p1FarmAnimals";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { deserialize, serialize, ProjectFormatError } from "@/project/io";
import { changeItemsAtomically, startSession, type PlaySession } from "@/project/session";
import { GOLD_MAX } from "@/project/economyValues";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import { SPATIAL_COST_ITEM_LIMIT, SPATIAL_LEVEL_LIMIT } from "@/project/spatialPlacements";
import { placeFarmBuilding, upgradeFarmBuilding } from "@/project/spatialPlacementTransactions";
import { collectLifeRecoveryClaim, isRecoveryItems, isSpatialPaymentReceipt, LifeReconciliationError, moveLifeRecoverySource, reconcileLifeState } from "@/project/lifeRecovery";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveSlotKey, saveToSlot } from "@/player/saveSlots";
import type { SpatialPlacementCost } from "@/project/types";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { refreshSpatialAuthoring } from "../src/editor/spatial/authoringRefresh";
import { spatialRasterDigest } from "../src/editor/spatial/compilerValidation";
import { isOwnedSpatialBinding } from "../src/project/spatial/bindings";
import { changeOwnedObjectSource, ownedObjectRefreshFixture, refreshCompile, refreshTarget, replacementKit, selectedObject, siblingObject } from "./support/spatialOwnedObjectRefreshFixture";
import { isPassableLanding } from "../src/project/collision";
import { placeChild, placeCompilerFixture, placeRoot, stairFloors, withStairConnections } from "./support/spatialPlaceCompilerFixture";
import { preparePlaceContainer } from "@/editor/panels/spatialPlaceContainer";
import { mixedFixture } from "./support/spatialMixedFixture";
import { composedPlaceFloorsFixture } from "./support/spatialComposedFloorsFixture";
import { instantiateSpatialDesign } from "@/project/spatial/instances";
import { isolateTimers } from "./mergedTeardown";
import { deleteSpatialOccurrence } from "../src/project/spatial/ownership";
import { emptySpatialLibrary } from "../src/project/spatial/resolve";
import { snapshotGraphic } from "../src/project/spatial/snapshotRaster";
import { interiorRoomRects } from "../src/project/interiorRoomFootprint";
import { CONCEPT_FLOOR_TILES } from "../src/editor/conceptBundleResolve";
import { resolveMaterialSlots } from "../src/editor/operators/materialSlots";
import { SpatialCompileError } from "../src/editor/spatial/compilerTypes";
import { inspectCompiledSpace } from "./support/spatialCompilerAssertions";

describe("spatialManualBuildContinuation", () => {
  isolateTimers();
  afterEach(() => bindSpatialAuthoringControllerFactory(null));
  it("builds the same allocated root when source correction follows a failed compile", () => {
    // Given
    manualBuildFixture();
    const input = { source: { kind: "space", id: spaceDesign }, rootId: spatialId("corrected-build"), seed: 19,
      destination: { kind: "new-maps" } } as const;
    authoringValue(editAuthoringDraft(project => {
      const doc = fixtureDocument(project);
      const source = own(doc.library.spaces, spaceDesign);
      return { ...project, spatialAuthoring: { ...doc, library: { ...doc.library,
        spaces: { ...doc.library.spaces, [spaceDesign]: { ...source, ports: [{ ...ownPort(source.ports), x: 255 }] } } } } };
    }));
    expect(previewSpatialSourceBuild(input).kind).toBe("error");
    authoringValue(editAuthoringDraft(project => {
      const doc = fixtureDocument(project);
      const source = own(doc.library.spaces, spaceDesign);
      return { ...project, spatialAuthoring: { ...doc, library: { ...doc.library,
        spaces: { ...doc.library.spaces, [spaceDesign]: { ...source, ports: [{ ...ownPort(source.ports), x: 8 }] } } } } };
    }));
    // When
    const preview = authoringValue(previewSpatialSourceBuild(input));
    // Then
    expect(fixtureDocument(preview.project).rootOccurrenceIds).toEqual([input.rootId]);
    expect(own(fixtureDocument(preview.project).occurrences, input.rootId).bindings.length).toBeGreaterThan(0);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
  });
  function ownPort<T>(ports: readonly T[]): T {
    const port = ports[0];
    if (!port) throw new TypeError("Missing fixture entry");
    return port;
  }
  it("freezes the issued request when a caller mutates its original entry input", () => {
    // Given
    const { target } = manualBuildFixture();
    const input = { source: { kind: "object", id: spatialId("hearth-design") }, rootId: spatialId("frozen-request"), seed: 19,
      destination: { kind: "map", currentMapId: target.mapId, selection: { mapId: target.mapId, ...target.rect }, entry: target.entry } } as const;
    const original = authoringValue(previewSpatialSourceBuild(input));
    target.entry.x = 999;
    // When
    const preview = authoringValue(previewAuthoringDraft());
    // Then
    expect(preview.project).toEqual(original.project);
    expect(spatialBuildProposal()?.input.destination).toMatchObject({ entry: { x: 1, y: 1 } });
  });
  it("clears redo when a new build is accepted after Undo", () => {
    // Given
    manualBuildFixture();
    const input = { source: { kind: "space", id: spaceDesign }, rootId: spatialId("undo-build"), seed: 19,
      destination: { kind: "new-maps" } } as const;
    authoringValue(previewSpatialSourceBuild(input));
    authoringValue(applyAuthoringPreview());
    expect(undoMapEdit()).toBe(true);
    authoringValue(previewSpatialSourceBuild({ ...input, rootId: spatialId("after-undo-build") }));
    // When
    authoringValue(applyAuthoringPreview());
    // Then
    expect(getMapEditHistoryState()).toEqual({ canUndo: true, canRedo: false });
    expect(fixtureDocument(store.getCurrent()).rootOccurrenceIds).toEqual(["after-undo-build"]);
  });
  it("retains the first frozen occurrence when a second root is explicitly built after a source edit", () => {
    // Given
    manualBuildFixture();
    const input = { source: { kind: "space", id: spaceDesign }, rootId: spatialId("first-frozen"), seed: 19,
      destination: { kind: "new-maps" } } as const;
    authoringValue(previewSpatialSourceBuild(input));
    authoringValue(applyAuthoringPreview());
    const first = own(fixtureDocument(store.getCurrent()).occurrences, input.rootId);
    authoringValue(editAuthoringDraft(project => {
      const doc = fixtureDocument(project);
      const source = own(doc.library.spaces, spaceDesign);
      return { ...project, spatialAuthoring: { ...doc, library: { ...doc.library,
        spaces: { ...doc.library.spaces, [spaceDesign]: { ...source, revision: 2, width: 18 } } } } };
    }));
    authoringValue(previewAuthoringDraft());
    authoringValue(applyAuthoringPreview());
    // When
    const preview = authoringValue(previewSpatialSourceBuild({ ...input, rootId: spatialId("second-frozen") }));
    // Then
    const doc = fixtureDocument(preview.project);
    expect(own(doc.occurrences, input.rootId)).toEqual(first);
    expect(own(doc.occurrences, "second-frozen").source.revision).toBe(2);
    expect(own(doc.occurrences, "second-frozen").bindings[0]?.mapId).not.toBe(first.bindings[0]?.mapId);
  });
});

describe("spatialPaymentReceipts", () => {
  isolateTimers();
  const window = new Window();
  const storage = window.localStorage;
  afterEach(() => storage.clear());
  afterAll(() => window.close());
  function fixture(costs: SpatialPlacementCost[]) {
    const project = animalProject();
    const ids = [...new Set(costs.flatMap(cost => cost.items?.map(item => item.itemId) ?? []))];
    project.database.items.push(...ids.map(id => normalizeItemRecord({ id, name: id, scope: "none" })));
    project.session.inventory = Object.fromEntries(ids.map(id => [id, ITEM_QUANTITY_MAX]));
    project.session.gold = GOLD_MAX;
    project.database.farmBuildingTypes = [{ id: "paid", name: "Paid", levels: costs.map((cost, i) => ({
      level: i + 1, footprint: { width: 1, height: 1 }, capacity: 1, cost, graphicResourceId: "easyrpg-picture-cloud",
    })) }];
    const authored = deserialize(serialize(project));
    expect(authored.version).toBe(4);
    expect(authored.database.farmBuildingTypes![0]!.levels.map(level => level.cost)).toEqual(costs);
    const session = startSession(authored, 11);
    return { project: authored, session };
  }
  const rows = (count: number, start = 0) => Array.from({ length: count }, (_, i) => ({ itemId: `paid-${start + i}`, count: 1 }));
  function build(project: ReturnType<typeof fixture>["project"], session: PlaySession) {
    expect(placeFarmBuilding(project, session, { instanceId: "home", typeId: "paid", mapId: project.startMapId, x: 5, y: 5, orientation: "down" })).toEqual({ ok: true });
  }
  function roundtrip(project: ReturnType<typeof fixture>["project"], session: PlaySession) {
    const before = structuredClone(session);
    const snapshot = createSaveSnapshot(project, session);
    expect(snapshot.schemaVersion).toBe(5);
    expect(saveToSlot(storage, 1, snapshot).ok).toBe(true);
    const raw = storage.getItem(saveSlotKey(1));
    const read = readSaveSlot(storage, 1);
    if (read.kind !== "present") throw new Error(read.kind);
    const restored = applySaveSnapshot(project, read.snapshot);
    expect(session).toEqual(before);
    expect(storage.getItem(saveSlotKey(1))).toBe(raw);
    expect(restored.farmBuildingPlacements).toEqual(session.farmBuildingPlacements);
    expect(restored.lifeRecovery).toEqual(session.lifeRecovery);
    expect(restored.inventory).toEqual(session.inventory);
    expect(restored.gold).toBe(session.gold);
    return restored;
  }
  // These are paid-history limits, not the bounds of one cost input or one claim.
  describe("cumulative spatial payment receipts", () => {
    it("H1 aggregates 64 historical rows plus a repeated upgrade item before any cost-input limit", () => {
      const { project, session } = fixture([{ items: rows(64) }, { items: rows(1) }]);
      build(project, session);
      expect(upgradeFarmBuilding(project, session, "home")).toEqual({ ok: true });
      expect(session.farmBuildingPlacements!.home!.paymentReceipt).toEqual({ gold: 0, items: [{ itemId: "paid-0", count: 2 }, ...rows(63, 1)] });
      expect(session.inventory["paid-0"]).toBe(ITEM_QUANTITY_MAX - 2);
      roundtrip(project, session);
    });

    it("H2 preserves 32+33 paid items through Save5 and content removal, split and collected exactly once", () => {
      const { project, session } = fixture([{ items: rows(32) }, { items: rows(33, 32) }]);
      build(project, session);
      expect(upgradeFarmBuilding(project, session, "home")).toEqual({ ok: true });
      expect(session.farmBuildingPlacements!.home!.paymentReceipt).toEqual({ gold: 0, items: rows(65) });
      const restored = roundtrip(project, session);
      const original = structuredClone(restored.farmBuildingPlacements!.home);
      project.database.farmBuildingTypes = [];
      const before = structuredClone(restored);
      const recovered = reconcileLifeState(project, restored);
      expect(restored).toEqual(before);
      expect(recovered.farmBuildingPlacements).toEqual({});
      expect(recovered.inventory).toEqual(before.inventory);
      const claims = Object.values(recovered.lifeRecovery!.claims);
      expect(claims.map(claim => claim.items.length)).toEqual([64, 1]);
      expect(claims.flatMap(claim => claim.items)).toEqual(rows(65));
      for (const claim of claims) {
        expect(isRecoveryItems(claim.items)).toBe(true);
        expect(claim.unresolved!.record).toEqual(original);
      }
      const resumed = roundtrip(project, recovered);
      expect(reconcileLifeState(project, resumed)).toEqual(resumed);
      const consumed = structuredClone(resumed);
      expect(moveLifeRecoverySource(project, resumed, { sourceKind: "farmBuildingPlacements", sourceId: "home", reason: "removed" })).toEqual({ ok: false, reason: "missing-source" });
      expect(resumed).toEqual(consumed);
      for (const claim of claims) {
        expect(collectLifeRecoveryClaim(project, resumed, claim.id).ok).toBe(true);
        const paid = structuredClone(resumed);
        expect(collectLifeRecoveryClaim(project, resumed, claim.id)).toEqual({ ok: false, reason: "missing-claim" });
        expect(resumed).toEqual(paid);
      }
      expect(resumed.inventory).toEqual(project.session.inventory);
      expect(resumed.gold).toBe(before.gold);
      expect(resumed.lifeRecovery).toEqual({ nextSequence: 3, claims: {} });
      roundtrip(project, resumed);
    });

    it("retains every one of 16 levels of 64 distinct accepted costs", () => {
      const costs = Array.from({ length: SPATIAL_LEVEL_LIMIT }, (_, i) => ({ items: rows(SPATIAL_COST_ITEM_LIMIT, i * SPATIAL_COST_ITEM_LIMIT) }));
      const { project, session } = fixture(costs);
      build(project, session);
      for (let level = 2; level <= SPATIAL_LEVEL_LIMIT; level++) expect(upgradeFarmBuilding(project, session, "home")).toEqual({ ok: true });
      expect(session.farmBuildingPlacements!.home!.paymentReceipt).toEqual({ gold: 0, items: rows(1024) });
      roundtrip(project, session);
      project.database.farmBuildingTypes = [];
      const recovered = reconcileLifeState(project, session);
      expect(Object.values(recovered.lifeRecovery!.claims).map(claim => claim.items.length)).toEqual(Array(16).fill(64));
      expect(Object.values(recovered.lifeRecovery!.claims).flatMap(claim => claim.items)).toEqual(rows(1024));
    });

    it("accumulates repeated full stacks and wallets across all levels without raising transaction or claim limits", () => {
      const cost = { gold: GOLD_MAX, items: [{ itemId: "paid-0", count: ITEM_QUANTITY_MAX }] };
      const { project, session } = fixture(Array.from({ length: SPATIAL_LEVEL_LIMIT }, () => structuredClone(cost)));
      build(project, session);
      for (let level = 2; level <= SPATIAL_LEVEL_LIMIT; level++) {
        expect(changeItemsAtomically(session, [{ itemId: "paid-0", op: "+=", amount: ITEM_QUANTITY_MAX }])).toBe(true);
        session.gold = GOLD_MAX; // New earnings fund each payment, never an over-cap wallet.
        expect(upgradeFarmBuilding(project, session, "home")).toEqual({ ok: true });
        expect(session.gold).toBe(0);
        expect(session.inventory["paid-0"] ?? 0).toBe(0);
        expect(session.farmBuildingPlacements!.home!.paymentReceipt).toEqual({ gold: level * GOLD_MAX, items: [{ itemId: "paid-0", count: level * ITEM_QUANTITY_MAX }] });
      }
      const restored = roundtrip(project, session);
      project.database.farmBuildingTypes = [];
      const recovered = reconcileLifeState(project, restored);
      const claims = Object.values(recovered.lifeRecovery!.claims).filter(claim => claim.items.length > 0);
      const unpaid = Object.values(recovered.lifeRecovery!.claims).filter(claim => claim.items.length === 0);
      expect(claims.map(claim => claim.items)).toEqual(Array.from({ length: 16 }, () => cost.items));
      expect(unpaid).toHaveLength(1);
      expect(unpaid[0]!.unresolved!.record).toEqual(restored.farmBuildingPlacements!.home);
      let collected = 0;
      for (const claim of claims) {
        expect(collectLifeRecoveryClaim(project, recovered, claim.id).ok).toBe(true);
        collected += recovered.inventory["paid-0"]!;
        const next = claims.find(candidate => Object.hasOwn(recovered.lifeRecovery!.claims, candidate.id));
        if (next) {
          const full = structuredClone(recovered);
          expect(collectLifeRecoveryClaim(project, recovered, next.id)).toEqual({ ok: false, reason: "inventory-overflow" });
          expect(recovered).toEqual(full);
        }
        expect(changeItemsAtomically(recovered, [{ itemId: "paid-0", op: "-=", amount: ITEM_QUANTITY_MAX }])).toBe(true);
      }
      expect(collected).toBe(16 * ITEM_QUANTITY_MAX);
      expect(recovered.gold).toBe(0); // Gold remains evidence only, never an invented payout.
      expect(recovered.lifeRecovery).toEqual({ nextSequence: 18, claims: { [unpaid[0]!.id]: unpaid[0] } });
      expect(unpaid[0]!.unresolved!.record).toMatchObject({ paymentReceipt: { gold: 16 * GOLD_MAX } });
      roundtrip(project, recovered);
    });

    it("refuses a two-claim conversion with only one slot free, preserving the entire source and previous save", () => {
      const { project, session } = fixture([{ items: rows(32) }, { items: rows(33, 32) }]);
      build(project, session);
      expect(upgradeFarmBuilding(project, session, "home").ok).toBe(true);
      session.lifeRecovery = { nextSequence: 4096, claims: Object.fromEntries(Array.from({ length: 4095 }, (_, i) => {
        const id = `recovery:${i + 1}`;
        return [id, { id, sourceKind: "shippingQueue", sourceId: "old", reason: "removed", items: rows(1) }];
      })) };
      const snapshot = createSaveSnapshot(project, session);
      expect(saveToSlot(storage, 1, snapshot).ok).toBe(true);
      const raw = storage.getItem(saveSlotKey(1));
      project.database.farmBuildingTypes = [];
      const before = structuredClone(session);
      expect(moveLifeRecoverySource(project, session, { sourceKind: "farmBuildingPlacements", sourceId: "home", reason: "removed" })).toEqual({ ok: false, reason: "capacity" });
      expect(() => createSaveSnapshot(project, session)).toThrow(LifeReconciliationError);
      expect(() => applySaveSnapshot(project, snapshot)).toThrow(LifeReconciliationError);
      expect(session).toEqual(before);
      expect(storage.getItem(saveSlotKey(1))).toBe(raw);
    });

    it.each(["rows", "stack", "gold", "wallet"] as const)("keeps the original per-transaction %s bound and failure atomicity", kind => {
      const { project, session } = fixture([{ items: rows(1) }, { items: rows(1) }]);
      build(project, session);
      const cost = kind === "rows" ? { items: Array.from({ length: 65 }, () => rows(1)[0]!) }
        : kind === "stack" ? { items: [{ itemId: "paid-0", count: ITEM_QUANTITY_MAX + 1 }] }
        : kind === "gold" ? { gold: GOLD_MAX + 1 } : { gold: 1 };
      project.database.farmBuildingTypes = project.database.farmBuildingTypes!.map(type => ({ ...type,
        levels: type.levels.map(level => level.level === 2 ? { ...level, cost } : level),
      }));
      if (kind === "wallet") session.gold = GOLD_MAX + 1;
      const before = structuredClone(session);
      expect(upgradeFarmBuilding(project, session, "home")).toEqual({ ok: false, reason: "invalid" });
      expect(session).toEqual(before);
    });

    it.each(["gold", "items"] as const)("rejects unsafe cumulative %s addition without spending anything", field => {
      const { project, session } = fixture([{ items: rows(1) }, { gold: 1, items: rows(1) }]);
      build(project, session);
      const receipt = { gold: field === "gold" ? Number.MAX_SAFE_INTEGER : 0, items: [{ itemId: "paid-0", count: field === "items" ? Number.MAX_SAFE_INTEGER : 1 }] };
      Object.assign(session.farmBuildingPlacements!.home!, { paymentReceipt: receipt });
      expect(isSpatialPaymentReceipt(receipt)).toBe(true);
      roundtrip(project, session);
      const before = structuredClone(session);
      expect(upgradeFarmBuilding(project, session, "home")).toEqual({ ok: false, reason: "invalid" });
      expect(session).toEqual(before);
    });

    it.each([
      { gold: -1, items: [] }, { gold: 0.5, items: [] }, { gold: Number.MAX_SAFE_INTEGER + 1, items: [] },
      ...[0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1].map(count => ({ gold: 0, items: [{ itemId: "paid-0", count }] })),
      { gold: 0, items: [rows(1)[0]!, rows(1)[0]!] }, { gold: 0, items: [{ itemId: "", count: 1 }] },
      { gold: 0, items: null },
    ])("rejects malformed receipt %# at writer/read/apply while preserving raw and live owners", receipt => {
      const { project, session } = fixture([{ items: rows(1) }]);
      build(project, session);
      const snapshot = createSaveSnapshot(project, session);
      Object.assign(snapshot.session.farmBuildingPlacements!.home!, { paymentReceipt: receipt });
      const raw = JSON.stringify(snapshot);
      storage.setItem(saveSlotKey(1), raw);
      storage.setItem("oprn:save-slot:1", "legacy-raw-preserved");
      const before = structuredClone(session);
      expect(readSaveSlot(storage, 1).kind).toBe("corrupt");
      expect(() => applySaveSnapshot(project, snapshot)).toThrow(LifeReconciliationError);
      expect(session).toEqual(before);
      Object.assign(session.farmBuildingPlacements!.home!, { paymentReceipt: receipt });
      const poisoned = structuredClone(session);
      expect(() => createSaveSnapshot(project, session)).toThrow(LifeReconciliationError);
      expect(session).toEqual(poisoned);
      expect(storage.getItem(saveSlotKey(1))).toBe(raw);
      expect(storage.getItem("oprn:save-slot:1")).toBe("legacy-raw-preserved");
    });
  });
});

describe("spatialPlaceCompiler", () => {
  isolateTimers();
  describe("spatialOwnedObjectCompile", () => {
    isolateTimers();
    it("paints the changed frozen raster when old owned graphic authorization is supplied", () => {
      // Given a refreshed object and its actual previously compiled occurrence.
      const project = ownedObjectRefreshFixture();
      const previous = own(fixtureDocument(project).occurrences, selectedObject);
      changeOwnedObjectSource(project);
      refreshSpatialAuthoring(project, { occurrenceId: selectedObject, externalConnections: "reject" });
      const before = structuredClone(project);
      // When the real compiler replaces its owned graphic.
      const result = compileSpatialOccurrence(project, refreshCompile, previous);
      // Then the removed lower layer is empty and the new upper cell is present, without mutating input.
      const map = own(result.maps, refreshTarget.mapId);
      expect([map.lowerTiles[53], map.upperTiles[53], map.lowerTiles[51], map.upperTiles[85]]).toEqual([-1, 404, 403, 462]);
      const beforeMap = own(before.maps, refreshTarget.mapId);
      const writes = new Set(["lower:51", "lower:52", "lower:53", "upper:53", "lower:67", "upper:68", "lower:69", "upper:83", "upper:84", "upper:85"]);
      for (let i = 0; i < map.width * map.height; i++) {
        if (!writes.has(`lower:${i}`)) expect(map.lowerTiles[i]).toBe(beforeMap.lowerTiles[i]);
        if (!writes.has(`upper:${i}`)) expect(map.upperTiles[i]).toBe(beforeMap.upperTiles[i]);
      }
      expect(map.lowerTileStacks).toEqual(beforeMap.lowerTileStacks);
      expect(map.upperTileStacks).toEqual(beforeMap.upperTileStacks);
      const ownedIds = new Set(previous.bindings.filter(isOwnedSpatialBinding).flatMap(binding => binding.eventIds));
      expect(map.events.filter(event => !ownedIds.has(event.id))).toEqual(beforeMap.events.filter(event => !ownedIds.has(event.id)));
      expect(map.events.filter(event => ownedIds.has(event.id))).toEqual(beforeMap.events.filter(event => ownedIds.has(event.id)));
      expect(own(fixtureDocument(result).occurrences, siblingObject)).toEqual(own(fixtureDocument(before).occurrences, siblingObject));
      expect(own(fixtureDocument(result).occurrences, selectedObject).snapshot.ports).toEqual(previous.snapshot.ports);
      expect(project).toEqual(before);
    });
    it("removes vacated graphic cells without enlarging ownership when a replacement shrinks", () => {
      // Given a two-by-two new source after two three-by-three objects were compiled.
      const project = ownedObjectRefreshFixture();
      const previous = own(fixtureDocument(project).occurrences, selectedObject);
      changeOwnedObjectSource(project, { ...replacementKit, width: 2, height: 2, rows: [
        { tiles: [403, 402] }, { tiles: [434, -1], upperTiles: [-1, 124] },
      ] });
      refreshSpatialAuthoring(project, { occurrenceId: selectedObject, externalConnections: "reject" });
      // When the selected graphic is compiled using its prior footprint.
      const result = compileSpatialOccurrence(project, refreshCompile, previous);
      // Then all vacated cells are empty, the reservation stays fixed, and the emitted event follows the new anchor.
      const map = own(result.maps, refreshTarget.mapId);
      expect([map.lowerTiles[53], map.lowerTiles[69], map.upperTiles[83], map.upperTiles[84], map.upperTiles[85]]).toEqual([-1, -1, -1, -1, -1]);
      const binding = own(fixtureDocument(result).occurrences, selectedObject).bindings.find(isOwnedSpatialBinding);
      if (!binding) throw new TypeError("Expected owned refreshed binding");
      expect(binding.rect).toEqual(refreshTarget.rect);
      expect(map.events.filter(event => binding.eventIds.includes(event.id)).map(event => [event.x, event.y])).toEqual([[4, 4]]);
    });
    it("retains old graphics when only the live source changes without explicit refresh", () => {
      // Given two frozen objects and a later kit edit.
      const project = ownedObjectRefreshFixture();
      const before = structuredClone(project);
      const previous = own(fixtureDocument(project).occurrences, selectedObject);
      changeOwnedObjectSource(project);
      // When the selected frozen occurrence is recompiled without refreshing its snapshot.
      const result = compileSpatialOccurrence(project, refreshCompile, previous);
      // Then neither occurrence nor either graphic adopts the edited live source.
      expect(fixtureDocument(result).occurrences).toEqual(fixtureDocument(before).occurrences);
      expect(own(result.maps, refreshTarget.mapId).lowerTiles).toEqual(own(before.maps, refreshTarget.mapId).lowerTiles);
      expect(own(result.maps, refreshTarget.mapId).upperTiles).toEqual(own(before.maps, refreshTarget.mapId).upperTiles);
    });
    it.each([
      ["old-digest", "ownership"], ["adopted-digest", "ownership"], ["target", "ownership"], ["oversized", "clipped"],
      ["atlas", "atlas"], ["new-event", "blocked"], ["old-event", "blocked"],
      ["new-stack", "blocked"], ["blocked-floor", "blocked"], ["port", "port"],
    ] as const)("rejects without mutation when replacement encounters %s", (failure, code) => {
      // Given an independently varied invalid replacement and the authentic old occurrence.
      const project = ownedObjectRefreshFixture();
      const previous = own(fixtureDocument(project).occurrences, selectedObject);
      const map = own(project.maps, refreshTarget.mapId);
      let target = refreshTarget;
      changeOwnedObjectSource(project);
      switch (failure) {
        case "old-digest": map.lowerTiles[51] = 124; break;
        case "adopted-digest": {
          map.lowerTiles[51] = 124;
          const document = fixtureDocument(project);
          project.spatialAuthoring = { ...document, occurrences: { ...document.occurrences, [selectedObject]: { ...previous,
            bindings: previous.bindings.map(binding => isOwnedSpatialBinding(binding)
              ? { ...binding, contentDigest: spatialRasterDigest(map, binding) } : binding),
          } } };
          break;
        }
        case "target": target = { ...target, rect: { ...target.rect, width: 5 } }; break;
        case "oversized": changeOwnedObjectSource(project, { ...replacementKit, width: 5,
          rows: replacementKit.rows.map(row => ({ tiles: [...row.tiles, -1, 124],
            upperTiles: [...(row.upperTiles ?? [-1, -1, -1]), -1, -1] })) }); break;
        case "atlas": {
          const document = fixtureDocument(project);
          const source = own(document.library.objects, "hearth-design");
          const atlas = own(project.tilesets, "easyrpg_chipset_combined_town");
          atlas.structureKits = [...(atlas.structureKits ?? []), replacementKit];
          project.spatialAuthoring = { ...document, library: { ...document.library, objects: { ...document.library.objects,
            [source.id]: { ...source, graphic: { ...source.graphic, tilesetId: atlas.id } } } } };
          break;
        }
        case "new-event": case "old-event": {
          const event = map.events[0];
          if (!event) throw new TypeError("Expected compiled event");
          map.events.push({ ...structuredClone(event), id: "blocking-unmanaged-event", x: failure === "old-event" ? 3 : 6, y: 3 });
          if (failure === "new-event") changeOwnedObjectSource(project, { ...replacementKit, width: 4,
            rows: replacementKit.rows.map(row => ({ tiles: [...row.tiles, 124], upperTiles: [...(row.upperTiles ?? [-1, -1, -1]), -1] })) });
          break;
        }
        case "new-stack": {
          // The new cell at (6,5) contains only pre-existing stacks, not an event or upper tile.
          changeOwnedObjectSource(project, { ...replacementKit, width: 4,
            rows: replacementKit.rows.map((row, y) => ({ tiles: [...row.tiles, y === 2 ? 124 : -1],
              upperTiles: [...(row.upperTiles ?? [-1, -1, -1]), -1] })) });
          break;
        }
        case "blocked-floor": {
          // The new cell at (6,3) has no stack, upper tile or event. Only its live passage blocks stamping.
          changeOwnedObjectSource(project, { ...replacementKit, width: 4,
            rows: replacementKit.rows.map((row, y) => ({ tiles: [...row.tiles, y === 0 ? 124 : -1],
              upperTiles: [...(row.upperTiles ?? [-1, -1, -1]), -1] })) });
          const atlas = own(project.tilesets, interiorAtlas);
          const floor = map.lowerTiles[54];
          atlas.passability[floor] = { up: false, down: false, left: false, right: false };
          break;
        }
        case "port": {
          const document = fixtureDocument(project);
          const source = own(document.library.objects, "hearth-design");
          project.spatialAuthoring = { ...document, library: { ...document.library, objects: { ...document.library.objects,
            [source.id]: { ...source, anchors: [{ id: spatialId("approach"), name: "Approach", x: 0, y: 0 }] } } } };
          break;
        }
        default: assertNever(failure);
      }
      refreshSpatialAuthoring(project, { occurrenceId: selectedObject, externalConnections: "reject" });
      const before = structuredClone(project);
      // When the compiler attempts the replacement.
      const compile = () => compileSpatialOccurrence(project, { ...refreshCompile, target }, previous);
      // Then it reports the precise guard without changing any input.
      expect(compile).toThrowError(expect.objectContaining({ code }));
      expect(project).toEqual(before);
    });
  });
  describe("spatialPlaceCompiler", () => {
    isolateTimers();
    describe("nested place compiler", () => {
      it("materializes the actual square and nested rooms when a village contains an inn", () => {
        // Given: authored square coordinates and three actual interior children.
        const input = placeCompilerFixture();
        const squareId = placeChild(input, placeRoot, "square");
        const children = [squareId, ...stairFloors(input).map(floor => floor.roomId)];
        // When: the existing pure compiler seam receives the parent occurrence.
        const proposal = compileSpatialOccurrence(input, { occurrenceId: placeRoot });
        // Then: every actual space has real nonempty raster output from its own atlas.
        for (const id of children) {
          const occurrence = own(fixtureDocument(proposal).occurrences, id);
          const binding = occurrence.bindings[0];
          expect(binding).toBeDefined();
          if (!binding) throw new TypeError("Missing compiled child binding");
          const map = own(proposal.maps, binding.mapId);
          expect(map.tilesetId).toBe(own(occurrence.snapshot.library.spaces, occurrence.source.id).tilesetId);
          expect(map.lowerTiles.some(tile => tile >= 0)).toBe(true);
        }
      });

      it("preserves declared stair roundtrips when actual children occupy all three floors", () => {
        // Given: explicit concrete object-port links, not containment-derived portals.
        const input = withStairConnections(placeCompilerFixture());
        // When: compile the nested settlement.
        const proposal = compileSpatialOccurrence(input, { occurrenceId: placeRoot });
        // Then: both directions have real transfer commands to the associated passable port.
        const document = fixtureDocument(proposal);
        for (const link of document.connections) for (const [source, target] of [[link.from, link.to], [link.to, link.from]] as const) {
          const from = own(document.occurrences, source.occurrenceId).bindings.find(binding => binding.ports.some(port => port.portId === source.portId));
          const to = own(document.occurrences, target.occurrenceId).bindings.find(binding => binding.ports.some(port => port.portId === target.portId));
          if (!from || !to) throw new TypeError("Missing compiled stair endpoint");
          const port = to.ports.find(port => port.portId === target.portId);
          if (!port) throw new TypeError("Missing compiled stair port");
          expect(isPassableLanding(proposal, own(proposal.maps, to.mapId), port.x, port.y)).toBe(true);
          const commands = own(proposal.maps, from.mapId).events.flatMap(event => [...event.commands, ...(event.pages ?? []).flatMap(page => page.commands)]);
          expect(commands).toContainEqual(expect.objectContaining({ kind: "transfer", mapId: to.mapId, x: port.x, y: port.y }));
        }
      });

      it("rejects the concrete invalid landing when a declared stair port lands on a blocked hearth", () => {
        // Given: a persisted named stair landing translated onto the frozen hearth.
        const fixture = withStairConnections(placeCompilerFixture());
        const floor = stairFloors(fixture)[0];
        if (!floor) throw new TypeError("Missing fixture floor");
        const stair = requireOccurrenceAssociations(own(fixtureDocument(fixture).occurrences, floor.stairId));
        const input = replaceOccurrence(fixture, { ...stair, snapshot: { ...stair.snapshot,
          ports: stair.snapshot.ports.map(port => ({ ...port, x: -7, y: -7 })) } });
        // When / Then: fail for the landing itself, not unsupported place compilation.
        expect(() => compileSpatialOccurrence(input, { occurrenceId: placeRoot })).toThrowError(expect.objectContaining({ code: "port" }));
      });

      it("creates no transfer when containment has no declared connection", () => {
        // Given: nested floors with stairs as frozen passable raster only.
        const input = placeCompilerFixture();
        // When: compile without any navigation link.
        const proposal = compileSpatialOccurrence(input, { occurrenceId: placeRoot });
        // Then: compilation does not invent transfer commands between contained records.
        const commands = Object.values(proposal.maps).filter(map => !Object.hasOwn(input.maps, map.id))
          .flatMap(map => map.events.flatMap(event => [...event.commands, ...(event.pages ?? []).flatMap(page => page.commands)]));
        expect(commands.filter(command => command.kind === "transfer")).toEqual([]);
      });
    });
  });
  describe("spatialPlaceComposedFloors", () => {
    isolateTimers();
    it("keeps a painted room, nested projections and two-way floor transfers on separate maps", () => {
      const { compiled, first, second } = composedPlaceFloorsFixture();
      const occurrences = Object.values(compiled.spatialAuthoring!.occurrences);
      const room = occurrences.find(o => o.parentId === "painted-floors" && o.source.id === first.id)!;
      const upstairs = occurrences.find(o => o.parentId === "painted-floors" && o.source.id === second.id)!;
      expect(room.bindings[0].mapId).not.toBe(upstairs.bindings[0].mapId);
      const map = compiled.maps[room.bindings[0].mapId];
      expect(map.lowerTiles[5 * map.width + 3]).toBe(240);
      const bed = occurrences.find(o => o.parentId === room.id && o.source.id === "bed-design")!;
      expect(bed.bindings[0]).toMatchObject({ kind: "projection", mapId: map.id, rect: { x: 5, y: 6 } });
      const links = compiled.mapConnections!.filter(link => [room.bindings[0].mapId, upstairs.bindings[0].mapId].includes(link.from.mapId));
      expect(links).toHaveLength(2);
      expect(links.map(link => link.to.mapId).sort()).toEqual([room.bindings[0].mapId, upstairs.bindings[0].mapId].sort());
      const read = deserialize(serialize(compiled));
      expect(compileSpatialOccurrence(read, { occurrenceId: "painted-floors" }).maps).toEqual(read.maps);
      read.maps[map.id].lowerTiles[5 * map.width + 3] = 0;
      expect(() => compileSpatialOccurrence(read, { occurrenceId: "painted-floors" })).toThrow("ownership");
    }, 60_000);
    it("wraps a directly painted place without changing its original design", () => {
      const project = mixedFixture();
      const before = serialize(project);
      const wrapped = preparePlaceContainer(project, { kind: "place", id: spatialId("inn") });
      expect(serialize(project)).toBe(before);
      expect(wrapped.project.spatialAuthoring!.library.places.inn).toEqual(project.spatialAuthoring!.library.places.inn);
      expect(wrapped.project.spatialAuthoring!.library.places[wrapped.source.id].children[0]).toMatchObject({ source: { kind: "place", id: "inn" }, level: 1 });
      const document = instantiateSpatialDesign(wrapped.project.spatialAuthoring, wrapped.project, { source: wrapped.source, rootId: "wrapped-painted-place", x: 0, y: 0, level: 0, seed: 7, generatorVersion: "wrapped-place-v1" });
      const compiled = compileSpatialOccurrence({ ...wrapped.project, spatialAuthoring: document }, { occurrenceId: "wrapped-painted-place" });
      const child = Object.values(compiled.spatialAuthoring!.occurrences).find(o => o.parentId === "wrapped-painted-place")!;
      expect(compiled.maps[child.bindings[0].mapId]).toMatchObject({ width: 40, height: 30 });
      expect(compileSpatialOccurrence(deserialize(serialize(compiled)), { occurrenceId: "wrapped-painted-place" }).maps).toEqual(compiled.maps);
    }, 60_000);
  });
});

describe("spatialSpaceCompiler", () => {
  isolateTimers();
  describe("spatial space compiler", () => {
    it("paints the frozen mixed-layer assembly when a space is compiled", () => {
      // Given
      const input = spaceCompilerFixture();
      // When
      const proposal = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
      // Then
      const binding = own(fixtureDocument(proposal).occurrences, spaceRoot).bindings[0];
      expect(binding).toBeDefined();
      if (!binding) throw new TypeError("Compiler returned no raster binding");
      const map = own(proposal.maps, binding.mapId);
      expect(map.lowerTiles[8 * map.width + 3]).toBe(402);
      expect(map.upperTiles[10 * map.width + 4]).toBe(124);
    });

    it.each(["rect", "l", "alcove"] as const)("preserves the %s footprint and two independent beds when composed", shape => {
      // Given
      const input = spaceCompilerFixture(19, shape);
      // When
      const proposal = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
      // Then
      const receipt = inspectCompiledSpace(input, proposal);
      const beds = receipt.objects.filter(object => object.occurrenceId.includes("beds"));
      expect(beds).toHaveLength(2);
      expect(beds[0]?.rect).not.toEqual(beds[1]?.rect);
      const map = own(proposal.maps, receipt.mapId);
      const footprint = interiorRoomRects({ x: 2, y: 4, w: 16, h: 12, shape });
      for (let y = 4; y < 6; y++) for (let x = 2; x < 18; x++) {
        const inside = footprint.some(rect => x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h);
        // North-snapped beds legitimately occupy floor cells; inspect the structural underlay.
        expect(map.lowerTiles[y * map.width + x] === CONCEPT_FLOOR_TILES.wood).toBe(inside);
      }
    });

    it("co-locates named child and space ports without duplicate ownership when a fixed stair is the entry", () => {
      // Given
      const input = spaceCompilerFixture();
      // When
      const proposal = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
      // Then
      const receipt = inspectCompiledSpace(input, proposal);
      expect(receipt.ports.map(port => [port.x, port.y])).toEqual([[10, 15], [10, 15]]);
      expect(new Set(receipt.ports.map(port => port.portId)).size).toBe(2);
      expect(receipt.requiredObjects).toBe(4);
    });

    it("uses the stored fixed coordinates when an occurrence has moved independently of its source slot", () => {
      // Given
      const base = spaceCompilerFixture();
      const hearth = Object.values(fixtureDocument(base).occurrences).find(child => child.source.id === "hearth-design");
      if (!hearth) throw new TypeError("Missing hearth");
      const input = replaceOccurrence(base, { ...hearth, x: 2, y: 5 });
      // When
      const proposal = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
      // Then
      expect(own(fixtureDocument(proposal).occurrences, hearth.id).bindings[0]?.rect).toMatchObject({ x: 4, y: 9 });
    });

    it("keeps the missing repetition absent when the first bed occurrence was deleted", () => {
      // Given
      const input = spaceCompilerFixture();
      const document = fixtureDocument(input);
      const deleted = findOccurrenceChildId(document, spaceRoot, { slotId: spatialId("beds"), index: 0 });
      if (!deleted) throw new TypeError("Missing repeated bed");
      input.spatialAuthoring = deleteSpatialOccurrence(document, input, { occurrenceId: deleted, externalConnections: "reject" });
      // When
      const proposal = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
      // Then
      const receipt = inspectCompiledSpace(input, proposal);
      expect(receipt.objects).toHaveLength(3);
      expect(fixtureDocument(proposal).occurrences[deleted]).toBeUndefined();
      expect(receipt.eventIds.some(id => id.includes(deleted))).toBe(false);
    });

    it("preserves an opaque stored identity when the legacy adapter trims ordinary strings", () => {
      // Given
      const input = spaceCompilerFixture();
      const document = fixtureDocument(input);
      const oldId = findOccurrenceChildId(document, spaceRoot, { slotId: spatialId("beds"), index: 0 });
      const id = spatialId(" stored / bed : [7] ");
      input.spatialAuthoring = { ...document, occurrences: Object.fromEntries(Object.values(document.occurrences).map(child =>
        child.id === oldId ? [id, { ...child, id }] : [child.id, child])) };
      // When
      const proposal = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
      // Then
      expect(own(fixtureDocument(proposal).occurrences, id).bindings).toHaveLength(1);
      expect(own(proposal.maps, `spatial:${spaceRoot}`).events.some(event => event.id.includes(id))).toBe(true);
    });

    it("includes an outside-footprint anchor without moving the fixed raster when its local coordinate is negative", () => {
      // Given
      const base = spaceCompilerFixture();
      const document = fixtureDocument(base);
      const object = own(document.library.objects, "hearth-design");
      base.spatialAuthoring = { ...document, library: { ...document.library, objects: { ...document.library.objects,
        [object.id]: { ...object, anchors: [{ id: spatialId("left-access"), name: "Left access", x: -1, y: 1 }] } } } };
      const input = reinstantiateSpace(base, space => space);
      // When
      const proposal = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
      // Then
      const child = Object.values(fixtureDocument(proposal).occurrences).find(child => child.source.id === object.id);
      expect(child?.bindings[0]?.rect).toEqual({ x: 2, y: 8, width: 4, height: 3 });
      expect(child?.bindings[0]?.ports[0]).toMatchObject({ x: 2, y: 9 });
      expect(own(proposal.maps, `spatial:${spaceRoot}`).lowerTiles[8 * 20 + 3]).toBe(402);
    });

    it("preserves per-occurrence bed selections when one frozen child uses a horizontal bed", () => {
      // Given
      const base = spaceCompilerFixture();
      const id = findOccurrenceChildId(fixtureDocument(base), spaceRoot, { slotId: spatialId("beds"), index: 1 });
      if (!id) throw new TypeError("Missing bed");
      const child = requireOccurrenceAssociations(own(fixtureDocument(base).occurrences, id));
      const design = own(child.snapshot.library.objects, child.source.id);
      const graphic = { tilesetId: interiorAtlas, kitId: "bed_h" };
      const input = replaceOccurrence(base, { ...child, snapshot: { ...child.snapshot,
        library: { ...child.snapshot.library, objects: { [design.id]: { ...design, graphic } } },
        kitCells: { [design.id]: snapshotGraphic(base, graphic) } } });
      // When
      const proposal = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
      // Then
      const receipt = inspectCompiledSpace(input, proposal);
      expect(receipt.objects.filter(object => object.occurrenceId.includes("beds")).map(object => [object.rect.width, object.rect.height])).toEqual([[1, 2], [2, 1]]);
    });

    it("keeps frozen cells when source designs are removed and the live kit is replaced", () => {
      // Given
      const input = spaceCompilerFixture();
      const before = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
      input.spatialAuthoring = { ...fixtureDocument(input), library: emptySpatialLibrary() };
      const tileset = own(input.tilesets, interiorAtlas);
      tileset.structureKits = [];
      const callerBefore = JSON.stringify(input);
      // When
      const proposal = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
      // Then
      expect(own(proposal.maps, `spatial:${spaceRoot}`)).toEqual(own(before.maps, `spatial:${spaceRoot}`));
      expect(JSON.stringify(input)).toBe(callerBefore);
    });

    it("returns identical IDs, cells and events when compiled again after project IO", () => {
      // Given
      const input = spaceCompilerFixture(31);
      const first = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
      const reloaded = deserialize(serialize(first));
      const before = JSON.stringify(reloaded);
      // When
      const proposal = compileSpatialOccurrence(reloaded, { occurrenceId: spaceRoot });
      // Then
      expect(proposal).toEqual(first);
      expect(JSON.stringify(reloaded)).toBe(before);
      expect(new Set(own(proposal.maps, `spatial:${spaceRoot}`).events.map(event => event.id)).size).toBe(3);
    });

    it.each(["port", "atlas", "required", "material", "entry", "blocked", "connection"] as const)("rejects atomically when %s is invalid", failure => {
      // Given
      const base = spaceCompilerFixture();
      const input = reinstantiateSpace(base, space => {
        switch (failure) {
          case "port": return { ...space, ports: [...space.ports, { id: spatialId("blocked-port"), name: "Blocked", x: 1, y: 4 }] };
          case "atlas": return { ...space, tilesetId: "easyrpg_chipset_combined_town" };
          case "required": return { ...space, objectSlots: space.objectSlots.map(slot => slot.id === "beds" ? { ...slot, quantity: 80 } : slot) };
          case "material": return { ...space, floor: "unmapped-material" };
          case "entry": return { ...space, shape: "l", ports: [{ id: spatialId("entry"), name: "Entry", x: 15, y: 0 }] };
          case "blocked": return { ...space, objectSlots: space.objectSlots.map(slot => slot.id === "stairs" ? { ...slot, placement: { mode: "fixed", x: 1, y: 4 } } : slot) };
          case "connection": return { ...space, objectSlots: space.objectSlots.map(slot => slot.id === "hearth" ? { ...slot, chipOverrides: ["transfer"] } : slot) };
        }
      });
      const before = JSON.stringify(input);
      // When
      let rejection: unknown;
      try { compileSpatialOccurrence(input, { occurrenceId: spaceRoot }); }
      catch (error) { if (!(error instanceof SpatialCompileError)) throw error; rejection = error; }
      // Then
      expect(rejection).toBeInstanceOf(SpatialCompileError);
      expect(rejection).toMatchObject({ code: failure });
      expect(JSON.stringify(input)).toBe(before);
    });

    it("omits optional repetitions when the room is full without changing required placement", () => {
      // Given
      const input = reinstantiateSpace(spaceCompilerFixture(), space => ({ ...space, objectSlots: space.objectSlots.map(slot =>
        slot.id === "beds" ? { ...slot, quantity: 80, required: false } : slot) }));
      // When
      const proposal = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
      // Then
      const children = Object.values(fixtureDocument(proposal).occurrences);
      expect(children.filter(child => child.parentSlot?.slotId === "beds" && child.bindings.length === 0).length).toBeGreaterThan(0);
      expect(children.find(child => child.parentSlot?.slotId === "hearth")?.bindings).toHaveLength(1);
    });

    it("rejects ownership when generated pixels have been edited", () => {
      // Given
      const input = compileSpatialOccurrence(spaceCompilerFixture(), { occurrenceId: spaceRoot });
      own(input.maps, `spatial:${spaceRoot}`).lowerTiles[0] = CONCEPT_FLOOR_TILES.stone;
      const before = JSON.stringify(input);
      // When / Then
      expect(() => compileSpatialOccurrence(input, { occurrenceId: spaceRoot })).toThrowError(SpatialCompileError);
      expect(JSON.stringify(input)).toBe(before);
    });

    it.each(["stone", "plank", "mat"] as const)("uses the backend %s floor without legacy filler when no objects remain", material => {
      // Given
      const input = reinstantiateSpace(spaceCompilerFixture(), space => ({ ...space, floor: material, objectSlots: [] }));
      // When
      const proposal = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
      // Then
      const map = own(proposal.maps, `spatial:${spaceRoot}`);
      expect(map.lowerTiles[8 * map.width + 8]).toBe(CONCEPT_FLOOR_TILES[material]);
      expect(map.upperTiles.every(tile => tile === -1)).toBe(true);
      expect(map.events).toHaveLength(0);
    });

    it("rejects shared raster authority when a child projection is changed to an owned binding", () => {
      // Given
      const proposal = compileSpatialOccurrence(spaceCompilerFixture(), { occurrenceId: spaceRoot });
      const child = Object.values(fixtureDocument(proposal).occurrences).find(child => child.parentSlot?.slotId === "stairs");
      if (!child || !child.bindings[0]) throw new TypeError("Missing projected stair");
      const projection = child.bindings[0];
      const invalid = replaceOccurrence(proposal, { ...child, bindings: [{ mapId: projection.mapId, rect: projection.rect,
        ports: projection.ports, eventIds: [], connectionIds: [], contentDigest: "0".repeat(64) }] });
      // When / Then
      expect(() => deserialize(JSON.stringify(invalid))).toThrowError(ProjectFormatError);
    });

    it("honors frozen chip overrides when the source still has an inspect chip", () => {
      // Given
      const input = reinstantiateSpace(spaceCompilerFixture(), space => ({ ...space, objectSlots: space.objectSlots.map(slot =>
        slot.id === "hearth" ? { ...slot, chipOverrides: ["sleep"] } : slot) }));
      // When
      const proposal = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
      // Then
      const events = own(proposal.maps, `spatial:${spaceRoot}`).events;
      expect(events.flatMap(event => event.pages?.flatMap(page => page.commands) ?? []).filter(command => command.kind === "inn")).toHaveLength(1);
    });

    it("paints explicit rectangle and polygon materials when an outdoor space is compiled", () => {
      // Given
      const input = outdoorCompilerFixture();
      // When
      const proposal = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
      // Then
      const receipt = inspectCompiledSpace(input, proposal);
      const map = own(proposal.maps, receipt.mapId);
      const slots = resolveMaterialSlots(own(input.tilesets, map.tilesetId));
      expect(slots.path?.tiles).toContain(map.lowerTiles[13 * map.width + 5]);
      expect(slots.shore?.tiles).toContain(map.lowerTiles[4 * map.width + 15]);
      expect(slots.ground?.tiles).toContain(map.lowerTiles[3 * map.width + 10]);
      expect(receipt.objects).toHaveLength(3);
    });

    it("stamps exact cells into the explicit compatible rectangle when an object is standalone", () => {
      // Given
      const { project, ...request } = objectStampFixture();
      const before = JSON.stringify(project);
      // When
      const proposal = compileSpatialOccurrence(project, request);
      // Then
      const map = own(proposal.maps, request.target.mapId);
      expect(map.lowerTiles[3 * map.width + 3]).toBe(402);
      expect(map.upperTiles[5 * map.width + 4]).toBe(124);
      expect(map.lowerTiles[0]).toBe(CONCEPT_FLOOR_TILES.wood);
      expect(JSON.stringify(project)).toBe(before);
    });

    it("keeps object event IDs stable when the same standalone stamp is compiled after reload", () => {
      // Given
      const { project, ...request } = objectStampFixture();
      const first = compileSpatialOccurrence(project, request);
      const input = deserialize(serialize(first));
      // When
      const proposal = compileSpatialOccurrence(input, request);
      // Then
      expect(proposal).toEqual(first);
      expect(own(proposal.maps, request.target.mapId).events).toHaveLength(1);
    });

    it.each(["atlas", "clipped", "blocked", "target"] as const)("rejects a standalone stamp atomically when %s fails", failure => {
      // Given
      const { project, ...request } = objectStampFixture();
      const map = own(project.maps, request.target.mapId);
      if (failure === "atlas") map.tilesetId = "easyrpg_chipset_combined_town";
      if (failure === "blocked") map.upperTiles[3 * map.width + 3] = 402;
      const target = failure === "clipped" ? { ...request.target, rect: { ...request.target.rect, width: 2 } } : request.target;
      const before = JSON.stringify(project);
      // When
      let rejection: unknown;
      try { compileSpatialOccurrence(project, failure === "target" ? { occurrenceId: request.occurrenceId } : { ...request, target }); }
      catch (error) { if (!(error instanceof SpatialCompileError)) throw error; rejection = error; }
      // Then
      expect(rejection).toMatchObject({ code: failure });
      expect(JSON.stringify(project)).toBe(before);
    });
  });
});
