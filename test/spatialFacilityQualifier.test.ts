import { describe, expect, it } from "vitest";
import { canonicalConceptSource } from "@/editor/spatial/legacyConcepts";
import { runTool } from "@/editor/tools/toolRunner";
import { own, spatialId } from "@/project/spatial/domain";
import { convertLegacySpatialSnapshot, legacySpatialId } from "@/project/spatial/legacyImport";
import type { ConceptBundleRecord } from "@/project/types/conceptBundle";
import { preparedProject } from "./support/authorHouseFacadeFixture";

const localAtlas = "easyrpg_chipset_interior";
const foreignAtlas = "easyrpg_chipset_world";
const facilityId = (atlas: string) => legacySpatialId([atlas, "qualified-facility", "facility", "qualified-facility"]);

function legacyFixture() {
  const project = preparedProject();
  // Same custom bundles as independent/lookup-probes.mts, not a fabricated canonical document.
  const bundle: ConceptBundleRecord = { id: "qualified-facility", label: "Shared Facility",
    facilities: [{ id: "qualified-facility", label: "Shared Facility", placeIds: ["bedroom"], layout: "row" }],
    places: [{ id: "bedroom", label: "Shared Room", role: "room", floor: "wood", level: 1 }], things: [],
  };
  own(project.tilesets, localAtlas).scratchConceptBundles = [bundle];
  own(project.tilesets, foreignAtlas).scratchConceptBundles = [structuredClone(bundle)];
  return project;
}

function canonicalFixture() {
  const legacy = legacyFixture();
  const document = convertLegacySpatialSnapshot(JSON.stringify(legacy)).raw.spatialAuthoring;
  return { ...legacy, spatialAuthoring: document };
}

describe("atlas-qualified facility lookup", () => {
  it("keeps the registered qualified lookup when the actual legacy snapshot is converted", () => {
    // Given: prove the pre-conversion control selects the interior facility.
    const legacy = legacyFixture();
    const args = { query: "Shared Facility", tilesetId: localAtlas };
    const beforeLegacy = JSON.stringify(legacy);
    const control = runTool({ project: legacy }, "get_concept_facility", args);
    expect(control.ok, control.summary).toBe(true);
    expect(control.data).toMatchObject({ template: { facilityId: "qualified-facility", tilesetId: localAtlas } });
    expect(JSON.stringify(legacy)).toBe(beforeLegacy);
    const project = { ...legacy, spatialAuthoring: convertLegacySpatialSnapshot(beforeLegacy).raw.spatialAuthoring };
    const before = JSON.stringify(project);
    // When
    const result = runTool({ project }, "get_concept_facility", args);
    // Then
    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({ canonical: { kind: "place", design: { id: facilityId(localAtlas) } } });
    expect(JSON.stringify(project)).toBe(before);
  });

  it.each([
    ["Shared Facility", localAtlas], ["Shared Facility", foreignAtlas],
    ["shared-tag", localAtlas], ["shared-tag", foreignAtlas],
    ["qualified-facility", localAtlas], ["qualified-facility", foreignAtlas],
  ])("selects %s within %s when foreign sources occur first", (query, atlas) => {
    // Given
    const project = canonicalFixture();
    const document = project.spatialAuthoring;
    const places = Object.values(document.library.places)
      .sort((a, b) => Number(a.id === facilityId(atlas)) - Number(b.id === facilityId(atlas)))
      .map(place => ({ ...place, tags: ["shared-tag"] }));
    project.spatialAuthoring = { ...document, library: { ...document.library,
      places: Object.fromEntries(places.map(place => [place.id, place])),
    } };
    // When
    const source = canonicalConceptSource(project, query, atlas);
    // Then
    expect(source).toEqual({ kind: "place", id: facilityId(atlas) });
  });

  it.each(["Shared Facility", "shared-tag", "qualified-facility"])("rejects %s when two eligible facilities share the lookup", query => {
    // Given
    const project = canonicalFixture();
    const document = project.spatialAuthoring;
    const original = own(document.library.places, facilityId(localAtlas));
    const duplicate = { ...original, id: spatialId("another-interior-facility"), tags: ["shared-tag"] };
    project.spatialAuthoring = { ...document, library: { ...document.library, places: {
      ...document.library.places, [original.id]: { ...original, tags: ["shared-tag"] }, [duplicate.id]: duplicate,
    } }, legacyImport: { ...document.legacyImport, mapping: [...document.legacyImport.mapping, {
      sourceKey: spatialId(JSON.stringify([localAtlas, "another-bundle", "facility", "qualified-facility"])),
      target: { kind: "place", id: duplicate.id },
    }] } };
    const before = JSON.stringify(project);
    // When: the actual runner must reject, not guess by record order.
    const result = runTool({ project }, "get_concept_facility", { query, tilesetId: localAtlas });
    // Then
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "spatial-ambiguous" })]));
    expect(JSON.stringify(project)).toBe(before);
  });

  it("rejects discovery when no atlas disambiguates the shared label", () => {
    // Given
    const project = canonicalFixture();
    // When
    const result = runTool({ project }, "get_concept_facility", { query: "Shared Facility" });
    // Then
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "spatial-ambiguous" })]));
  });

  it("preserves exact opaque identity when the qualifier names another atlas", () => {
    // Given
    const project = canonicalFixture();
    const id = facilityId(foreignAtlas);
    // When
    const result = runTool({ project }, "get_concept_facility", { query: id, tilesetId: localAtlas });
    // Then
    expect(result.ok, result.summary).toBe(true);
    expect(result.data).toMatchObject({ canonical: { kind: "place", design: { id } } });
  });

  it.each(["Shared Facility", "qualified-facility"])("excludes %s when the requested atlas has no eligible facility", query => {
    // Given
    const project = canonicalFixture();
    // When
    const source = canonicalConceptSource(project, query, "unknown-atlas");
    // Then
    expect(source).toBeUndefined();
  });

  it.each(["Shared Facility", "qualified-facility"])("qualifies %s by receipt when imported facilities have no rooms", query => {
    // Given
    const project = canonicalFixture();
    const document = project.spatialAuthoring;
    const places = Object.fromEntries(Object.entries(document.library.places).map(([id, place]) => [id, { ...place, children: [] }]));
    project.spatialAuthoring = { ...document, library: { ...document.library, places } };
    // When
    const source = canonicalConceptSource(project, query, localAtlas);
    // Then
    expect(source).toEqual({ kind: "place", id: facilityId(localAtlas) });
  });

  it("uses current room atlases when an imported facility has moved beyond its receipt", () => {
    // Given
    const project = canonicalFixture();
    const document = project.spatialAuthoring;
    const spaces = Object.fromEntries(Object.entries(document.library.spaces).map(([id, space]) =>
      [id, { ...space, tilesetId: foreignAtlas }]));
    project.spatialAuthoring = { ...document, library: { ...document.library, spaces } };
    // When
    const source = canonicalConceptSource(project, "qualified-facility", localAtlas);
    // Then
    expect(source).toBeUndefined();
  });
});
