import { describe, expect, it } from "vitest";
import { bindInteriorConceptPlan } from "@/editor/interiorConceptPlan";
import type { InteriorRoomPlan } from "@/editor/interiorRoomPipeline";
import { checkedDocument, own, spatialId } from "@/project/spatial/domain";
import { convertLegacySpatialSnapshot, legacySpatialId } from "@/project/spatial/legacyImport";
import type { ConceptBundleRecord } from "@/project/types/conceptBundle";
import { preparedProject } from "./support/authorHouseFacadeFixture";

const localAtlas = "easyrpg_chipset_interior";
const foreignAtlas = "easyrpg_chipset_world";
const localRoomId = legacySpatialId([localAtlas, "qualified-facility", "place", "bedroom"]);
const foreignRoomId = legacySpatialId([foreignAtlas, "qualified-facility", "place", "bedroom"]);

// T17-AV-4: promote independent/lookup-probes.mts's actual converted two-atlas fixture.
function convertedRooms(foreignFirst: boolean, duplicateLocal = false) {
  const legacy = preparedProject();
  const bundle: ConceptBundleRecord = {
    id: "qualified-facility", label: "Shared Facility",
    facilities: [{ id: "qualified-facility", label: "Shared Facility", placeIds: ["bedroom"], layout: "row" }],
    places: [{ id: "bedroom", label: "Shared Room", role: "room", floor: "wood", level: 1 }], things: [],
  };
  own(legacy.tilesets, localAtlas).scratchConceptBundles = duplicateLocal
    ? [bundle, { ...structuredClone(bundle), id: "second-facility" }] : [bundle];
  own(legacy.tilesets, foreignAtlas).scratchConceptBundles = [structuredClone(bundle)];
  const converted = convertLegacySpatialSnapshot(JSON.stringify(legacy));
  const project = { ...legacy, spatialAuthoring: converted.raw.spatialAuthoring };
  const document = checkedDocument(project.spatialAuthoring, project);
  const spaces = Object.values(document.library.spaces).sort((a, b) =>
    (foreignFirst ? 1 : -1) * (Number(b.tilesetId === foreignAtlas) - Number(a.tilesetId === foreignAtlas)));
  const mapping = [...document.legacyImport.mapping].sort((a, b) =>
    (foreignFirst ? 1 : -1) * (Number(b.target.id === foreignRoomId) - Number(a.target.id === foreignRoomId)));
  project.spatialAuthoring = {
    ...document,
    library: { ...document.library, spaces: Object.fromEntries(spaces.map(space =>
      [space.id, { ...space, tags: ["shared-room-tag"] }])) },
    legacyImport: { ...document.legacyImport, mapping },
  };
  return project;
}

function roomPlan(theme: string): InteriorRoomPlan {
  return {
    mapId: "independent-qualified-room", name: "Room", seed: 59, width: 16, height: 14,
    theme, tilesetId: localAtlas, wings: [],
    rooms: [{ id: "room", theme, x: 3, y: 4, w: 9, h: 6 }], door: { x: 7, y: 9 },
  };
}

describe("requested-atlas canonical room binding", () => {
  describe.each([true, false])("foreign-first=%s", foreignFirst => {
    it.each(["Shared Room", "shared-room-tag", "bedroom", "qualified-facility/bedroom"])("binds the requested atlas when the query is %s", query => {
      // Given: distinct atlas sources with identical label/tag/receipt aliases.
      const project = convertedRooms(foreignFirst);
      const plan = roomPlan(query);
      const before = JSON.stringify(project);
      // When: use the actual public binding entry, not just the resolver.
      const bound = bindInteriorConceptPlan(plan, project);
      // Then: qualified identity and caller geometry survive without source mutation.
      expect(bound.concept?.rooms.room?.placeId).toBe(localRoomId);
      expect(bound.rooms).toMatchObject(plan.rooms ?? []);
      expect(JSON.stringify(project)).toBe(before);
    });

    it("binds an exact interior ID when same-atlas aliases are ambiguous", () => {
      // Given: exact-ID control from the probe, strengthened with a same-atlas collision.
      const project = convertedRooms(foreignFirst, true);
      // When
      const bound = bindInteriorConceptPlan(roomPlan(localRoomId), project);
      // Then
      expect(bound.concept?.rooms.room?.placeId).toBe(localRoomId);
    });
  });

  it.each(["Shared Room", "shared-room-tag", "bedroom"])("rejects same-atlas ambiguity when the query is %s", query => {
    // Given
    const project = convertedRooms(true, true);
    // When
    const bind = () => bindInteriorConceptPlan(roomPlan(query), project);
    // Then: machine-consumed error code, not error prose.
    expect(bind).toThrowError(expect.objectContaining({ code: "spatial-ambiguous" }));
  });

  it("preserves the atlas error when an exact foreign ID is requested", () => {
    // Given
    const project = convertedRooms(true);
    // When
    const bind = () => bindInteriorConceptPlan(roomPlan(foreignRoomId), project);
    // Then: explicit IDs must not silently fall back to a compatible alias.
    expect(bind).toThrowError(expect.objectContaining({ code: "spatial-atlas" }));
  });

  describe.each(["user", "ai", "builtin"] as const)("native origin=%s", origin => {
    it.each(["Shared Room", "shared-room-tag", "bedroom"])("rejects native-plus-mapped ambiguity when the query is %s", query => {
      // Given: the native name/tag also collides with the original's receipt alias for bedroom.
      const project = convertedRooms(false);
      const document = project.spatialAuthoring;
      const native = { ...own(document.library.spaces, localRoomId), id: spatialId("native-room"),
        name: query, tags: [query], provenance: { origin } };
      project.spatialAuthoring = { ...document, library: { ...document.library,
        spaces: { ...document.library.spaces, [native.id]: native } } };
      // When
      const bind = () => bindInteriorConceptPlan(roomPlan(query), project);
      // Then
      expect(bind).toThrowError(expect.objectContaining({ code: "spatial-ambiguous" }));
    });

    it("binds a native source when its alias is unique", () => {
      // Given
      const project = convertedRooms(false);
      const document = project.spatialAuthoring;
      const native = { ...own(document.library.spaces, localRoomId), id: spatialId("native-room"),
        name: "Native Only", tags: [], provenance: { origin } };
      project.spatialAuthoring = { ...document, library: { ...document.library,
        spaces: { ...document.library.spaces, [native.id]: native } } };
      // When
      const bound = bindInteriorConceptPlan(roomPlan("Native Only"), project);
      // Then
      expect(bound.concept?.rooms.room?.placeId).toBe(native.id);
    });
  });

  it("binds a layout-context room when its exact ID is requested", () => {
    // Given: an exact conversion identity derived from the fixture input, never parsed for discovery.
    const project = convertedRooms(true);
    const contextId = legacySpatialId([localAtlas, "qualified-facility", "place-context", JSON.stringify(["qualified-facility", 1, 0])]);
    // When
    const bound = bindInteriorConceptPlan(roomPlan(contextId), project);
    // Then
    expect(bound.concept?.rooms.room?.placeId).toBe(contextId);
  });

  it.each(["Shared Room", "shared-room-tag", "bedroom"])("does not revive a deleted original when the query is %s", query => {
    // Given: its unmapped layout-context copy and historical receipt still exist.
    const project = convertedRooms(false);
    const document = project.spatialAuthoring;
    project.spatialAuthoring = { ...document, library: { ...document.library,
      spaces: Object.fromEntries(Object.entries(document.library.spaces).filter(([id]) => id !== localRoomId)) } };
    // When
    const bind = () => bindInteriorConceptPlan(roomPlan(query), project);
    // Then
    expect(bind).toThrowError(expect.objectContaining({ code: "concept-place-not-found" }));
  });

  it("uses the existing house shorthand when default bedroom receipts are reversed", () => {
    // Given: house and farmhouse share bedroom; existing PLACE_ALIASES chooses house.
    const legacy = preparedProject();
    const document = convertLegacySpatialSnapshot(JSON.stringify(legacy)).raw.spatialAuthoring;
    const project = { ...legacy, spatialAuthoring: { ...document,
      library: { ...document.library, spaces: Object.fromEntries(Object.entries(document.library.spaces).reverse()) },
      legacyImport: { ...document.legacyImport, mapping: [...document.legacyImport.mapping].reverse() } } };
    // When
    const bound = bindInteriorConceptPlan(roomPlan("bedroom"), project);
    // Then
    expect(bound.concept?.rooms.room?.placeId).toBe(legacySpatialId([localAtlas, "house", "place", "bedroom"]));
  });

  it("deduplicates an original when its name, tag and receipt alias all match", () => {
    // Given
    const project = convertedRooms(false);
    const document = project.spatialAuthoring;
    const original = own(document.library.spaces, localRoomId);
    project.spatialAuthoring = { ...document, library: { ...document.library,
      spaces: { ...document.library.spaces, [localRoomId]: { ...original, name: "bedroom", tags: ["bedroom"] } } } };
    // When
    const bound = bindInteriorConceptPlan(roomPlan("bedroom"), project);
    // Then
    expect(bound.concept?.rooms.room?.placeId).toBe(localRoomId);
  });

  it("honors an exact ID when an earlier native label has the same spelling", () => {
    // Given
    const project = convertedRooms(false);
    const document = project.spatialAuthoring;
    const native = { ...own(document.library.spaces, localRoomId), id: spatialId("native-room"),
      name: localRoomId, provenance: { origin: "user" as const } };
    project.spatialAuthoring = { ...document, library: { ...document.library,
      spaces: { [native.id]: native, ...document.library.spaces } } };
    // When
    const bound = bindInteriorConceptPlan(roomPlan(localRoomId), project);
    // Then
    expect(bound.concept?.rooms.room?.placeId).toBe(localRoomId);
  });

  it("uses the default atlas when binding wings by plan theme", () => {
    // Given
    const project = convertedRooms(true);
    const plan: InteriorRoomPlan = {
      mapId: "wing-room", name: "Room", seed: 59, width: 16, height: 14, theme: "Shared Room",
      wings: [{ x: 3, y: 4, w: 9, h: 6 }], door: { x: 7, y: 9 },
    };
    // When
    const bound = bindInteriorConceptPlan(plan, project);
    // Then
    expect(bound.concept?.rooms.room_1?.placeId).toBe(localRoomId);
  });
});
