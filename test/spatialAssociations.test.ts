import { describe, expect, it } from "vitest";
import { deserialize, ProjectFormatError, serialize, serializePretty } from "@/project/io";
import { validateSpatialAuthoring } from "@/project/spatial/guards";
import { validateSpatialReferences } from "@/project/spatial/references";
import { invalidAssociations, spatialAssociationsFixture } from "./support/spatialAssociationsFixture";
import { emptySpatialDocument, spatialFixture, spatialWire } from "./support/spatialSchemaFixture";

const formats = [{ name: "compact", write: serialize }, { name: "pretty", write: serializePretty }];

describe("canonical occurrence associations", () => {
  it("retains precise opaque mappings when the schema validates frozen associations", () => {
    // Given
    const { project, document } = spatialAssociationsFixture();
    // When
    const parsed = validateSpatialAuthoring(document);
    validateSpatialReferences(parsed, project);
    // Then
    expect(parsed).toStrictEqual(document);
  });

  describe.each(formats)("$name IO", ({ write }) => {
    it("preserves exact associations and deleted indices when complete records roundtrip", () => {
      // Given
      const { project, document, room, desk } = spatialAssociationsFixture();
      const before = structuredClone(document);
      // When
      const loaded = deserialize(write({ ...project, spatialAuthoring: validateSpatialAuthoring(document) }));
      // Then
      expect(loaded.spatialAuthoring).toStrictEqual(before);
      expect(loaded.spatialAuthoring?.occurrences[desk.id]).toHaveProperty("parentSlot.index", 2);
      expect(Object.values(loaded.spatialAuthoring?.occurrences ?? {}).filter(child => child.parentId === room.id)).toHaveLength(2);
      expect(loaded.version).toBe(4);
      expect(document).toStrictEqual(before);
    });

    it("preserves absent metadata and archive bytes when old v1 records roundtrip", () => {
      // Given
      const { project, document } = spatialFixture();
      const input = deserialize(spatialWire(project, document));
      // When
      const wire = write(input);
      // Then
      expect(deserialize(wire).spatialAuthoring).toStrictEqual(document);
      expect(input.spatialAuthoring).toStrictEqual(document);
    });

    it("uses only frozen definitions when live sources and kits are deleted", () => {
      // Given
      const { project, document } = spatialAssociationsFixture();
      for (const tileset of Object.values(project.tilesets)) tileset.structureKits = [];
      const input = { ...document, library: emptySpatialDocument().library };
      // When
      const loaded = deserialize(write({ ...project, spatialAuthoring: validateSpatialAuthoring(input) }));
      // Then
      expect(loaded.spatialAuthoring).toStrictEqual(input);
    });

    it("accepts mixed completeness when a legacy parent still supplies its frozen slot", () => {
      // Given
      const { project, document, world } = spatialAssociationsFixture();
      Reflect.deleteProperty(world, "parentSlot");
      for (const port of world.snapshot.ports) Reflect.deleteProperty(port, "localPortId");
      // When
      const loaded = deserialize(write({ ...project, spatialAuthoring: validateSpatialAuthoring(document) }));
      // Then
      expect(loaded.spatialAuthoring).toStrictEqual(document);
    });
  });

  it.each(invalidAssociations)("rejects $name at its precise field when wire metadata is invalid", ({ change, field }) => {
    // Given
    const fixture = spatialAssociationsFixture();
    change(fixture);
    // When
    const load = () => deserialize(spatialWire(fixture.project, fixture.document));
    // Then
    expect(load).toThrow(ProjectFormatError);
    expect(load).toThrow(`spatialAuthoring.${field.startsWith("library.") ? "" : "occurrences."}${field}`);
  });

  it.each([undefined, Number.NaN, Infinity])("rejects %s when a present repetition is not a safe integer", index => {
    // Given: direct schema boundary keeps values JSON cannot represent.
    const { document, desk } = spatialAssociationsFixture();
    Reflect.set(desk.parentSlot, "index", index);
    // When
    const parse = () => validateSpatialAuthoring(document);
    // Then
    expect(parse).toThrow("spatialAuthoring.occurrences.opaque-desk-C.parentSlot.index");
  });

  it("rejects explicit undefined when the completeness discriminator is present", () => {
    // Given
    const { document, desk } = spatialAssociationsFixture();
    Reflect.set(desk, "parentSlot", undefined);
    // When
    const parse = () => validateSpatialAuthoring(document);
    // Then
    expect(parse).toThrow("spatialAuthoring.occurrences.opaque-desk-C.parentSlot");
  });
});
