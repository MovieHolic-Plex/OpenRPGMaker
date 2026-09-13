import { describe, expect, it } from "vitest";
import { INTERIOR_OBJECT_CATALOG } from "@/editor/interiorObjectCatalog";
import { interiorVocabTiles } from "@/editor/interiorRoomPipeline";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { deserialize, serialize, serializePretty } from "@/project/io";
import { INTERIOR_TILESET_ID } from "@/project/mapCreateSpec";
import baseline from "./fixtures/spatial/interiorCatalogBaseline.json";
import { designBase, emptySpatialDocument, spatialWire } from "./support/spatialSchemaFixture";

describe("shared interior asset contract", () => {
  it("preserves exact shipped records and vocabulary when the catalog is read", () => {
    // Given: captured from the exact pre-relocation commit.
    const expected = baseline;
    // When
    const actual = { catalog: INTERIOR_OBJECT_CATALOG, vocabulary: interiorVocabTiles() };
    // Then: includes ordered mixed layers, metadata and every ID, not just tile sets.
    expect(actual).toStrictEqual(expected);
    expect(actual.catalog).toHaveLength(55);
  });

  it.each([serialize, serializePretty])("accepts all fallback graphic references when raw kits are empty via %s", write => {
    // Given
    const project = createBlankProject();
    const tileset = project.tilesets[INTERIOR_TILESET_ID];
    if (!tileset) throw new Error("Missing default interior atlas");
    tileset.structureKits = [];
    delete tileset.scratchConceptBundles;
    const before = JSON.stringify(project);
    const document = { ...emptySpatialDocument(), library: {
      ...emptySpatialDocument().library,
      objects: Object.fromEntries(baseline.catalog.map(entry => [entry.id, {
        ...designBase(entry.id), graphic: { tilesetId: tileset.id, kitId: entry.id }, anchors: [], chips: [],
      }])),
    } };
    // When
    const loaded = deserialize(write(deserialize(spatialWire(project, document))));
    // Then
    expect(loaded.spatialAuthoring).toStrictEqual(document);
    expect(loaded.tilesets[tileset.id]?.structureKits).toStrictEqual([]);
    expect(Object.hasOwn(loaded.tilesets[tileset.id] ?? {}, "scratchConceptBundles")).toBe(false);
    expect(JSON.stringify(project)).toBe(before);
  });
});
