import { describe, expect, it } from "vitest";
import { deserialize, serialize, serializePretty } from "@/project/io";
import { spatialOpaqueIdFixtures, spatialProject, spatialWire } from "./support/spatialSchemaFixture";

describe.each([serialize, serializePretty])("opaque spatial serialization with %s", write => {
  it.each(spatialOpaqueIdFixtures())("preserves complete authored data when $scenario roundtrips", ({ project, document }) => {
    // Given: the boundary accepts each opaque ID before the save under test.
    const input = deserialize(spatialWire(project, document));
    expect(input.spatialAuthoring).toStrictEqual(document);
    const before = structuredClone(input);
    // When
    const wire = write(input);
    // Then: wire data, reload and caller state retain every field, including raw archive bytes.
    expect(JSON.parse(wire).spatialAuthoring).toStrictEqual(document);
    expect(JSON.parse(wire)).toStrictEqual(JSON.parse(JSON.stringify(before)));
    expect(deserialize(wire)).toStrictEqual(before);
    expect(input).toStrictEqual(before);
  });

  it("preserves distinct resource metadata when retired owner fields are omitted", () => {
    // Given
    const { project, tilesetId } = spatialProject();
    const tileset = project.tilesets[tilesetId];
    if (!tileset) throw new Error("Fixture tileset missing");
    const audioDescriptions = { music: { terrainTemplates: "music payload" }, sound: { terrainTemplates: "sound payload" } };
    const monsterMetadata = { terrainTemplates: { name: "Monster payload", tags: ["custom"], description: "monster detail" } };
    const source = {
      ...project, audioDescriptions, monsterMetadata, terrainTemplates: [{ id: "retired-root" }],
      tilesets: { ...project.tilesets, [tilesetId]: { ...tileset, terrainTemplates: [{ id: "retired-tileset" }] } },
    };
    const before = structuredClone(source);
    const expected = { ...project, audioDescriptions, monsterMetadata };
    // When
    const wire = write(source);
    // Then
    expect(JSON.parse(wire)).toStrictEqual(JSON.parse(JSON.stringify(expected)));
    expect(deserialize(wire)).toStrictEqual(deserialize(JSON.stringify(expected)));
    expect(source).toStrictEqual(before);
  });

  it("preserves accepted non-owner data when it aliases a retired tileset owner", () => {
    // Given: the current loader accepts and preserves this extension, but retires the tileset field.
    const { project, tilesetId } = spatialProject();
    const tileset = project.tilesets[tilesetId];
    if (!tileset) throw new Error("Fixture tileset missing");
    const legacyTileset = { ...tileset, terrainTemplates: [{ id: "mirror-payload", cells: [17, 23] }] };
    const source = { ...project, tilesets: { ...project.tilesets, [tilesetId]: legacyTileset }, ownerMirror: legacyTileset };
    const accepted = deserialize(JSON.stringify(source));
    expect(Reflect.get(accepted, "ownerMirror")).toStrictEqual(JSON.parse(JSON.stringify(legacyTileset)));
    expect(Object.hasOwn(accepted.tilesets[tilesetId] ?? {}, "terrainTemplates")).toBe(false);
    const before = structuredClone(source);
    // When
    const wire = write(source);
    // Then: structural location, not object identity, determines retirement.
    expect(JSON.parse(wire).ownerMirror.terrainTemplates).toStrictEqual(legacyTileset.terrainTemplates);
    expect(JSON.parse(wire)).toStrictEqual(JSON.parse(JSON.stringify({ ...project, ownerMirror: legacyTileset })));
    expect(deserialize(wire)).toStrictEqual(accepted);
    expect(source).toStrictEqual(before);
  });
});
