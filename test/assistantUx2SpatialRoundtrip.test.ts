import { describe, expect, it } from "vitest";
import { deserialize } from "@/project/io";
import { markRoundtripPassed, serializeForRoundtripCheck } from "@/project/io/sharedDictionaryJson";
import { spatialFixture, spatialWire } from "./support/spatialSchemaFixture";

function accepted() {
  const { project, document, tilesetId } = spatialFixture();
  const value = deserialize(spatialWire(project, document));
  markRoundtripPassed(value);
  return { value, tilesetId };
}

describe("spatial checkpoint roundtrip reuse", () => {
  it("retains all cross-entry tileset fields after warming, including authored kit geometry and rules", () => {
    const { value, tilesetId } = accepted();
    const wire = serializeForRoundtripCheck(value);
    const projected = JSON.parse(wire).tilesets[tilesetId];
    const { referenceDocuments: _docs, structureKits, ...expected } = value.tilesets[tilesetId]!;
    expect(projected).toMatchObject(expected);
    expect(projected.structureKits).toEqual(structureKits?.map(({ referenceDocuments: _kitDocs, ...kit }) => kit));
    expect(deserialize(wire).spatialAuthoring).toEqual(value.spatialAuthoring);
  });

  it("does not reuse a passed kit when its replacement removes a referenced kit", () => {
    const { value, tilesetId } = accepted();
    const candidate = { ...value, tilesets: { ...value.tilesets,
      [tilesetId]: { ...value.tilesets[tilesetId]!, structureKits: [] } } };
    expect(() => deserialize(serializeForRoundtripCheck(candidate))).toThrow(/kitId/);
  });

  it("rechecks changed spatial references even when every tileset has already passed", () => {
    const { value } = accepted();
    value.spatialAuthoring!.library.objects.desk!.graphic.kitId = "missing-kit";
    expect(() => deserialize(serializeForRoundtripCheck(value))).toThrow(/kitId/);
  });

  it("validates replacement grafts and reference documents instead of caching the old entry's pass", () => {
    const { value, tilesetId } = accepted();
    const source = value.tilesets[tilesetId]!;
    const graftCandidate = { ...value, tilesets: { ...value.tilesets, [tilesetId]: { ...source,
      tileGrafts: [{ targetTile: source.count, sourceTile: 0, sourceChipset: "source" }] } } };
    expect(() => deserialize(serializeForRoundtripCheck(graftCandidate))).toThrow(/targetTile/);
    const docsCandidate = { ...value, tilesets: { ...value.tilesets, [tilesetId]: { ...source,
      referenceDocuments: [{ id: "broken" }] as unknown as typeof source.referenceDocuments } } };
    expect(() => deserialize(serializeForRoundtripCheck(docsCandidate))).toThrow();
  });
});
