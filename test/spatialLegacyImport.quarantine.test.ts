import { describe, expect, it } from "vitest";
import { CONCEPT_FLOOR_TILES, conceptFacilityLevels, layoutConceptFacility } from "@/editor/conceptBundleResolve";
import { CONCEPT_FACILITY_TEMPLATES } from "@/project/defaults/conceptFacilityTemplates";
import { INTERIOR_OBJECT_CATALOG } from "@/project/defaults/interiorObjectCatalog";
import { deserialize, ProjectFormatError, serialize, serializePretty } from "@/project/io";
import { createProjectPackage, readProjectPackage } from "@/project/package";
import { resolveSpatialGraphic } from "@/project/spatial/assets";
import { convertLegacySpatialSnapshot, legacySpatialId } from "@/project/spatial/legacyImport";
import type { ConceptBundleRecord } from "@/project/types";
import { customLegacyBundle, customLegacyKit, customLegacyRaw } from "./fixtures/spatial/legacyImportMatrix";
import { legacyRawFixture } from "./support/spatialLegacyImportFixture";
import { collisionBundle, legacyHouseKit, malformedKits, regressionRaw } from "./fixtures/spatial/legacyImportRegressions";
import { canonicalGraphicRaw, canonicalKitFaults, liveGraphicOwners, retiredGraphicRaw } from "./fixtures/spatial/legacyCanonicalReentry";

const interiorId = "easyrpg_chipset_interior";
describe("explicit legacy spatial conversion", () => {
  it("converts every selected default source when the legacy bundle field is missing", () => {
    // Given
    const raw = legacyRawFixture();
    // When
    const result = convertLegacySpatialSnapshot(raw.json);
    // Then
    const { library, legacyImport } = result.raw.spatialAuthoring;
    const keys = legacyImport.mapping.map(entry => JSON.parse(entry.sourceKey));
    expect(keys.filter(tuple => tuple[2] === "object")).toHaveLength(55);
    expect(keys.filter(tuple => tuple[2] === "facility")).toHaveLength(19);
    expect(keys.filter(tuple => tuple[2] === "place")).toHaveLength(59);
    for (const source of INTERIOR_OBJECT_CATALOG) {
      const object = library.objects[legacySpatialId([interiorId, "", "object", source.id])];
      expect(object?.name).toBe(source.label);
      expect(object && resolveSpatialGraphic(result.preview, object.graphic)).toEqual({ source: "builtin", object: source });
    }
    expect(legacyImport.backup).toEqual({ encoding: "raw-json", json: raw.json, sha256: raw.sha256 });
    const { spatialAuthoring: _canonical, ...preserved } = result.raw;
    expect(preserved).toEqual(raw.baseline);
    expect(result.preview.maps[raw.overlay.id]?.events).not.toEqual(raw.overlay.events);
    expect(result.inspection.roomKinds).toEqual([{ tilesetId: interiorId, record: raw.baseline.tilesets[interiorId].interiorRoomKinds[0] }]);
  });

  it("keeps authored labels chips memberships and graphic precedence when qualified IDs collide across tilesets", () => {
    // Given
    const raw = customLegacyRaw();
    const before = structuredClone(raw);
    // When
    const result = convertLegacySpatialSnapshot(JSON.stringify(raw));
    // Then
    const { library, legacyImport } = result.raw.spatialAuthoring;
    for (const tilesetId of [interiorId, "alias/\"same"]) {
      const thingId = legacySpatialId([tilesetId, customLegacyBundle.id, "thing", "clock"]);
      const eastId = legacySpatialId([tilesetId, customLegacyBundle.id, "thing", "clock-east"]);
      const west = library.objects[thingId];
      expect(west?.name).toBe(customLegacyBundle.things[0]?.label);
      expect(library.objects[eastId]?.name).toBe(customLegacyBundle.things[1]?.label);
      expect(west?.graphic).toEqual(library.objects[eastId]?.graphic);
      expect(west && resolveSpatialGraphic(result.preview, west.graphic)).toEqual({ source: "authored", kit: customLegacyKit });
      expect(west?.chips).toEqual(["event", "qa-archive", "event"]);
      const space = library.spaces[legacySpatialId([tilesetId, customLegacyBundle.id, "place", "room"])];
      expect(space?.objectSlots.map(slot => [slot.objectDesignId, slot.quantity, slot.required, slot.chipOverrides])).toEqual([
        [thingId, 1, true, ["event", "qa-archive", "event"]], [eastId, 1, false, []],
      ]);
      const attic = library.spaces[legacySpatialId([tilesetId, customLegacyBundle.id, "place", "attic"])];
      expect(attic?.objectSlots.map(slot => slot.objectDesignId)).toEqual([thingId]);
    }
    expect(new Set(legacyImport.mapping.map(entry => entry.target.id)).size).toBe(legacyImport.mapping.length);
    expect(result.inspection.roomKinds).toEqual(Object.entries(raw.tilesets).flatMap(([tilesetId, tileset]) => (tileset.interiorRoomKinds ?? []).map(record => ({ tilesetId, record }))));
    expect(legacyImport.mapping.filter(entry => JSON.parse(entry.sourceKey)[2] === "object")).toHaveLength(2);
    expect(raw).toEqual(before);
  });

  it.each([...CONCEPT_FACILITY_TEMPLATES, customLegacyBundle])("retains compiled legacy geometry when converting bundle $id", (bundle: ConceptBundleRecord) => {
    // Given: the existing editor layout is the independent behavioral oracle.
    const raw = legacyRawFixture();
    const tileset = { ...raw.baseline.tilesets[interiorId], scratchConceptBundles: [bundle] };
    const input = { ...raw.baseline, tilesets: { ...raw.baseline.tilesets, [interiorId]: tileset } };
    const expected = bundle.facilities.map(facility => {
      const levels = conceptFacilityLevels(bundle, facility);
      const multi = levels.length > 1;
      const minBandWidth = multi ? Math.max(...levels.map(level => Math.max(0, ...layoutConceptFacility(bundle, facility, { level }).rooms.filter(room => room.role !== "room").map(room => room.w)))) : 0;
      return { facility, rooms: levels.flatMap(level => layoutConceptFacility(bundle, facility, multi ? { level, minBandWidth } : {}).rooms.map(room => ({ level, x: room.x, y: room.y, width: room.w, height: room.h, role: room.role, shape: room.shape ?? "rect", floorTile: room.floorTile ?? CONCEPT_FLOOR_TILES.wood, wall: facility.wall ?? "cream" }))) };
    });
    // When
    const { library } = convertLegacySpatialSnapshot(JSON.stringify(input)).raw.spatialAuthoring;
    // Then
    for (const { facility, rooms } of expected) {
      const converted = library.places[legacySpatialId([interiorId, bundle.id, "facility", facility.id])];
      expect(converted?.layout).toBe(facility.layout ?? "row");
      expect(converted?.children.map(child => {
        const space = library.spaces[child.source.id];
        return { level: child.level, x: child.x, y: child.y, width: space?.width, height: space?.height, role: space?.environment === "interior" ? space.role : undefined, shape: space?.shape, floorTile: space && CONCEPT_FLOOR_TILES[space.floor], wall: space?.wall };
      })).toEqual(rooms);
    }
  });

  it("keeps synthetic fallback independent when an unselected room has the same ID", () => {
    // Given: the old layout's actual tile is the oracle, not a same-ID source lookup.
    const input = regressionRaw({ scratchConceptBundles: [collisionBundle] });
    const json = JSON.stringify(input);
    const facility = collisionBundle.facilities[0];
    if (!facility) throw new TypeError("Missing collision facility");
    const expected = layoutConceptFacility(collisionBundle, facility).rooms[0];
    // When
    const { library } = convertLegacySpatialSnapshot(json).raw.spatialAuthoring;
    // Then
    const converted = library.places[legacySpatialId([interiorId, collisionBundle.id, "facility", facility.id])];
    const child = converted?.children[0];
    const fallback = child && library.spaces[child.source.id];
    const original = library.spaces[legacySpatialId([interiorId, collisionBundle.id, "place", "room"])];
    expect(fallback && CONCEPT_FLOOR_TILES[fallback.floor]).toBe(expected?.floorTile ?? CONCEPT_FLOOR_TILES.wood);
    expect(fallback?.id).not.toBe(original?.id);
    expect(fallback?.name).toBe(facility.label);
    expect(fallback?.objectSlots).toEqual([]);
    expect(original?.floor).toBe("mat");
    expect(original?.name).toBe(collisionBundle.places[0]?.label);
    expect(original?.objectSlots).toHaveLength(1);
    expect(JSON.stringify(input)).toBe(json);
  });

  it.each(malformedKits)("rejects qualified malformed authored graphics when $fault", ({ kit, field }) => {
    // Given: clock has an eligible builtin, which must never hide a bad authored kit.
    const input = regressionRaw({ structureKits: [kit] });
    const json = JSON.stringify(input);
    // When / Then: rejection returns no canonical payload.
    expect(() => convertLegacySpatialSnapshot(json)).toThrowError(expect.objectContaining({
      name: "ProjectFormatError", message: expect.stringContaining(`${JSON.stringify([interiorId, "", "object", "clock"])}.${field}`),
    }));
    expect(JSON.stringify(input)).toBe(json);
  });

  describe.each(liveGraphicOwners)("canonical live %s boundary", owner => {
    it.each(canonicalKitFaults)("rejects $fault when an authoritative live kit changes after import", ({ kit, field }) => {
      // Given: the live owner is a canonical edit, not a historical mapping target.
      const input = canonicalGraphicRaw(owner, kit);
      const json = JSON.stringify(input);
      // When / Then: no returned payload and no builtin fallback for an invalid override.
      expect(() => convertLegacySpatialSnapshot(json)).toThrowError(expect.objectContaining({
        name: "ProjectFormatError", message: expect.stringContaining(`${JSON.stringify([interiorId, "", "object", "clock"])}.${field}`),
      }));
      expect(JSON.stringify(input)).toBe(json);
    });

    it("preserves edited owners when live geometry is valid and unrelated authored data is malformed", () => {
      // Given: only the first matching authored kit is authoritative, not its duplicate.
      const input = canonicalGraphicRaw(owner, customLegacyKit);
      input.tilesets[interiorId].structureKits.push({ ...customLegacyKit, width: -1 }, { ...customLegacyKit, id: "retired", width: -1 });
      const json = JSON.stringify(input);
      // When
      const result = convertLegacySpatialSnapshot(json);
      // Then
      expect(result.raw).toEqual(JSON.parse(json));
      expect(convertLegacySpatialSnapshot(JSON.stringify(result.raw)).raw).toEqual(result.raw);
      expect(JSON.stringify(input)).toBe(json);
    });
  });

  it("preserves frozen cells and opaque archives when their live definitions have been deleted", () => {
    // Given: the retired clock is malformed, but the occurrence owns valid frozen cells.
    const input = retiredGraphicRaw();
    const json = JSON.stringify(input);
    // When
    const result = convertLegacySpatialSnapshot(json);
    // Then
    expect(result.raw).toEqual(JSON.parse(json));
    expect(convertLegacySpatialSnapshot(serialize(result.preview)).raw.spatialAuthoring).toEqual(input.spatialAuthoring);
    expect(JSON.stringify(input)).toBe(json);
  });

  it.each([customLegacyKit, { ...customLegacyKit, rows: [{ tiles: [-1], upperTiles: [-1] }] }, legacyHouseKit])("preserves authored kit records (inert legacy included) when converting kit %j", kit => {
    // Given
    const input = regressionRaw({ structureKits: [kit] });
    // When
    const result = convertLegacySpatialSnapshot(JSON.stringify(input));
    // Then
    expect(resolveSpatialGraphic(result.preview, { tilesetId: interiorId, kitId: kit.id })).toEqual({ source: "authored", kit });
  });

  it("rejects with a qualified layout diagnostic when the raw facility layout is unknown", () => {
    // Given
    const facility = { id: "room", label: "Empty facility", placeIds: [], layout: "spiral" };
    const input = regressionRaw({ scratchConceptBundles: [{ ...collisionBundle, facilities: [facility] }] });
    const json = JSON.stringify(input);
    // When / Then
    expect(() => convertLegacySpatialSnapshot(json)).toThrowError(expect.objectContaining({
      name: "ProjectFormatError", message: expect.stringContaining(`${JSON.stringify([interiorId, collisionBundle.id, "facility", facility.id])}.layout`),
    }));
    expect(JSON.stringify(input)).toBe(json);
  });

  it("keeps an explicitly empty library empty when conversion runs", () => {
    // Given
    const raw = legacyRawFixture();
    const input = { ...raw.baseline, tilesets: { ...raw.baseline.tilesets, [interiorId]: { ...raw.baseline.tilesets[interiorId], scratchConceptBundles: [], interiorRoomKinds: [] } } };
    // When
    const result = convertLegacySpatialSnapshot(JSON.stringify(input));
    // Then
    expect(result.raw.spatialAuthoring.library.places).toEqual({});
    expect(result.raw.spatialAuthoring.library.spaces).toEqual({});
    expect(result.inspection.roomKinds).toEqual([]);
    expect(result.raw.tilesets).toEqual(input.tilesets);
  });

  it.each([serialize, serializePretty])("preserves canonical content and raw archive when %s roundtrips", serializer => {
    // Given
    const raw = legacyRawFixture();
    const converted = convertLegacySpatialSnapshot(raw.json);
    // When
    const loaded = deserialize(serializer(converted.preview));
    // Then
    expect(loaded.spatialAuthoring).toEqual(converted.raw.spatialAuthoring);
    expect(convertLegacySpatialSnapshot(serializer(loaded)).raw.spatialAuthoring).toEqual(converted.raw.spatialAuthoring);
    expect(JSON.parse(loaded.spatialAuthoring?.legacyImport.backup.json ?? "null")).toEqual(raw.baseline);
  });

  it("preserves the archive through the actual project package export when converted", async () => {
    // Given
    const converted = convertLegacySpatialSnapshot(legacyRawFixture().json);
    // When
    const loaded = await readProjectPackage(createProjectPackage(converted.preview));
    // Then
    expect(loaded.spatialAuthoring).toEqual(converted.raw.spatialAuthoring);
  });

  it("never restores deleted definitions when a canonical snapshot is converted again", () => {
    // Given
    const converted = convertLegacySpatialSnapshot(legacyRawFixture().json);
    const canonical = { ...converted.raw, spatialAuthoring: { ...converted.raw.spatialAuthoring, library: { objects: {}, spaces: {}, places: {}, regions: {}, worlds: {} } } };
    // When
    const repeated = convertLegacySpatialSnapshot(JSON.stringify(canonical));
    // Then
    expect(repeated.raw).toEqual(canonical);
    expect(convertLegacySpatialSnapshot(JSON.stringify(converted.raw)).raw).toEqual(converted.raw);
  });

  it.each(["unknown-graphic", "wrong-atlas", "unknown-membership", "unknown-facility-place"] as const)("rejects without mutation when input has %s", fault => {
    // Given
    const raw = customLegacyRaw();
    const tileset = raw.tilesets[interiorId];
    const bundle = tileset.scratchConceptBundles[0];
    if (!bundle || !bundle.things[0] || !bundle.facilities[0]) throw new TypeError("Fixture is missing its authored tree");
    switch (fault) {
      case "unknown-graphic": bundle.things[0].objectId = "missing-graphic"; break;
      case "wrong-atlas": tileset.structureKits = []; tileset.image = { type: "bundled", id: "chipset/FSM_ChipSet_01.png" }; break;
      case "unknown-membership": bundle.things[0].placeIds = ["missing-place"]; break;
      case "unknown-facility-place": bundle.facilities[0].placeIds = ["missing-place"]; break;
      default: fault satisfies never;
    }
    const json = JSON.stringify(raw);
    // When / Then
    expect(() => convertLegacySpatialSnapshot(json)).toThrow(ProjectFormatError);
    expect(() => convertLegacySpatialSnapshot(json)).toThrow(/unavailable graphic|unknown place/);
    expect(JSON.stringify(raw)).toBe(json);
  });
});
