import { describe, expect, it } from "vitest";
import { liveBundlesForTileset, listLiveConceptBundles, resolveConceptFacility } from "@/editor/conceptBundleResolve";
import { INTERIOR_OBJECT_CATALOG } from "@/editor/interiorObjectCatalog";
import { INTERIOR_ROOM_TILESET_ID } from "@/editor/interiorRoomPipeline";
import { resolveInteriorRoomVocab } from "@/editor/interiorRoomVocab";
import { runTool } from "@/editor/tools/toolRunner";
import { CONCEPT_FACILITY_TEMPLATES } from "@/project/defaults/conceptFacilityTemplates";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { deserialize, serialize } from "@/project/io";
import type { ConceptBundleRecord, SectionStructureKitDef } from "@/project/types";
import { preparedProject } from "./support/authorHouseFacadeFixture";

function authoredProject() {
  const project = preparedProject();
  const interior = project.tilesets[INTERIOR_ROOM_TILESET_ID];
  const outside = project.maps.m1;
  if (!interior || !outside) throw new Error("Required blank-project fixture assets missing");
  // Deliberately different from built-in house contents, materials and clock cells.
  const bundle: ConceptBundleRecord = {
    id: "house", label: "QA archive",
    facilities: [{ id: "house", label: "QA archive", placeIds: ["bedroom"], wall: "gold-brick" }],
    places: [{ id: "bedroom", label: "QA archive room", role: "entrance", size: "l", floor: "mat" }],
    things: [{ id: "archive_clock", label: "QA clock", objectId: "clock", placeIds: ["bedroom"], chips: ["block", "event", "qa-archive"], required: true }],
  };
  const kit: SectionStructureKitDef = {
    id: "clock", kind: "section", name: "QA custom graphic", width: 1, height: 1,
    rows: [{ tiles: [-1], upperTiles: [405] }], learnedFrom: "user-paint",
    ai: { snap: "floor", interiorRole: "decoration", description: "QA graphic", placementRules: "floor" },
  };
  interior.scratchConceptBundles = [bundle];
  interior.structureKits = [kit];
  interior.interiorRoomKinds = [{ id: "archive-room", label: "QA constraint", requiredRoles: ["decoration"], suggestedModifiers: ["qa-archive"] }];
  outside.lowerTiles[51] = 72;
  outside.events = [{ id: "unmanaged", name: "Unmanaged", x: 2, y: 2, trigger: { kind: "action" }, commands: [{ kind: "text", body: "Unmanaged fixture dialogue" }] }];
  project.world = { entities: [{ id: "w_lore-archive", type: "concept", name: "Independent lore", summary: "Fixture lore", origin: "user", locked: true }], relations: [] };
  return { project, interior, bundle, kit, outside };
}

describe("legacy spatial authoring characterization", () => {
  it("exposes all shipped qualified sources when the interior library is missing without seeding", () => {
    // Given
    const { project, interior } = authoredProject();
    delete interior.scratchConceptBundles;
    const before = structuredClone(project);
    // When
    const entries = listLiveConceptBundles(project);
    // Then
    const bundles = entries.find(entry => entry.tilesetId === INTERIOR_ROOM_TILESET_ID)?.bundles;
    expect(INTERIOR_OBJECT_CATALOG).toHaveLength(55);
    expect(bundles).toEqual(CONCEPT_FACILITY_TEMPLATES);
    expect(bundles).toHaveLength(19);
    expect(bundles?.flatMap(bundle => bundle.places.map(place => `${INTERIOR_ROOM_TILESET_ID}/${bundle.id}/${place.id}`))).toHaveLength(59);
    expect(project).toEqual(before);
  });

  it("retains authored chips, graphics and room constraints when the real serializer roundtrips", () => {
    // Given
    const { project, interior } = authoredProject();
    const expected = structuredClone(interior);
    // When
    const loaded = deserialize(serialize(project));
    // Then
    const actual = loaded.tilesets[INTERIOR_ROOM_TILESET_ID];
    expect(actual?.scratchConceptBundles).toEqual(expected.scratchConceptBundles);
    expect(actual?.structureKits).toEqual(expected.structureKits);
    expect(actual?.interiorRoomKinds).toEqual(expected.interiorRoomKinds);
    expect(loaded.world).toEqual(project.world);
  });

  it("resolves authored graphic cells instead of catalog cells when a kit overrides the same object id", () => {
    // Given
    const { interior } = authoredProject();
    expect(INTERIOR_OBJECT_CATALOG.find(object => object.id === "clock")?.cells).not.toEqual([{ dx: 0, dy: 0, layer: "upper", tile: 405 }]);
    // When
    const vocab = resolveInteriorRoomVocab(interior, INTERIOR_OBJECT_CATALOG, []);
    // Then
    expect(vocab.objectsById.get("clock")?.cells).toEqual([{ dx: 0, dy: 0, layer: "upper", tile: 405 }]);
    expect(vocab.kindsById.get("archive-room")?.requiredRoles).toEqual(["decoration"]);
  });

  it("keeps duplicate local identities distinct when resolving explicitly qualified tilesets after roundtrip", () => {
    // Given
    const { project, bundle } = authoredProject();
    const town = project.tilesets[DEFAULT_TILESET_ID];
    if (!town) throw new Error("Town fixture missing");
    const other = structuredClone(bundle);
    other.things = [{ id: "archive_clock", label: "Other clock", objectId: "piano", placeIds: ["bedroom"], chips: ["pass", "qa-outdoor"] }];
    town.scratchConceptBundles = [other];
    const loaded = deserialize(serialize(project));
    // When
    const results = [INTERIOR_ROOM_TILESET_ID, DEFAULT_TILESET_ID].map(tilesetId => resolveConceptFacility(loaded, "QA archive", tilesetId));
    // Then
    expect(results.map(result => ({ tilesetId: result?.tilesetId, things: result?.bundle.things }))).toEqual([
      { tilesetId: INTERIOR_ROOM_TILESET_ID, things: bundle.things },
      { tilesetId: DEFAULT_TILESET_ID, things: other.things },
    ]);
  });

  it.each(["missing", "empty"] as const)("preserves the %s library distinction through real roundtrip", state => {
    // Given
    const { project, interior } = authoredProject();
    switch (state) {
      case "missing": delete interior.scratchConceptBundles; break;
      case "empty": interior.scratchConceptBundles = []; break;
      default: state satisfies never;
    }
    // When
    const loaded = deserialize(serialize(project));
    // Then
    expect(loaded.tilesets[INTERIOR_ROOM_TILESET_ID]?.scratchConceptBundles).toEqual(state === "missing" ? undefined : []);
    expect(liveBundlesForTileset(loaded, INTERIOR_ROOM_TILESET_ID)).toHaveLength(state === "missing" ? 19 : 0);
  });

  it("builds authored graphics and interactions without touching unrelated maps or lore when real placement accepts", () => {
    // Given
    const { project, outside } = authoredProject();
    const originalMap = structuredClone(outside);
    const originalLore = structuredClone(project.world);
    const originalCatalog = structuredClone(project.tilesets[INTERIOR_ROOM_TILESET_ID]);
    const context = { project };
    // When
    const result = runTool(context, "place_concept", { query: "QA archive", mapId: "qa_archive", seed: 7 }, { dryRun: false });
    // Then
    expect(result.ok, result.summary).toBe(true);
    const built = context.project.maps.qa_archive;
    expect(built?.upperTiles).toContain(405);
    expect(built?.events.some(event => event.id.includes("archive_clock"))).toBe(true);
    expect(context.project.maps.m1).toEqual(originalMap);
    expect(context.project.world).toEqual(originalLore);
    const catalog = context.project.tilesets[INTERIOR_ROOM_TILESET_ID];
    expect(catalog?.scratchConceptBundles).toEqual(originalCatalog?.scratchConceptBundles);
    expect(catalog?.structureKits).toEqual(originalCatalog?.structureKits);
    expect(catalog?.interiorRoomKinds).toEqual(originalCatalog?.interiorRoomKinds);
  });

  it("rejects construction with no project mutation when an authored interior library is deliberately empty", () => {
    // Given
    const { project, interior } = authoredProject();
    interior.scratchConceptBundles = [];
    const context = { project };
    const before = structuredClone(project);
    // When
    const result = runTool(context, "place_concept", { query: "house", mapId: "must_not_exist", seed: 7 }, { dryRun: false });
    // Then
    expect(result.ok).toBe(false);
    expect(context.project).toEqual(before);
  });
});
