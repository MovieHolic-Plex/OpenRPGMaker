import { describe, expect, it } from "vitest";
import { deserialize } from "@/project/io";
import { markRoundtripPassed, serializeForRoundtripCheck } from "@/project/io/sharedDictionaryJson";
import { cloneDetachedDraft } from "@/editor/detachedDraftMemory";
import { assertSpatialToolAcceptance, beginSpatialToolProposal, sealSpatialToolProposal } from "@/editor/tools/spatialToolState";
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

  it.each(["geometry", "interiorMetadata", "tileGrafts"])("still refuses post-issue %s tampering after warming the projection", field => {
    const { value, tilesetId } = accepted();
    serializeForRoundtripCheck(value);
    const proposal = cloneDetachedDraft(value);
    beginSpatialToolProposal(proposal, value);
    sealSpatialToolProposal(proposal);
    expect(() => assertSpatialToolAcceptance(proposal, value)).not.toThrow();
    const source = proposal.tilesets[tilesetId]!;
    proposal.tilesets[tilesetId] = field === "geometry"
      ? { ...source, structureKits: source.structureKits!.map(kit => ({ ...kit, width: 0 })) }
      : field === "tileGrafts"
        ? { ...source, tileGrafts: [{ targetTile: source.count, sourceTile: 0, sourceChipset: "source" }] }
        : { ...source, interiorMetadata: { broken: true } } as typeof source;
    // Lint's smaller JSON is never the authority fingerprint or proposal proof.
    expect(() => assertSpatialToolAcceptance(proposal, value)).toThrow();
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
    const kitDocs = { ...value, tilesets: { ...value.tilesets, [tilesetId]: { ...source,
      structureKits: source.structureKits!.map(kit => ({ ...kit,
        referenceDocuments: [{ id: "broken" }] as unknown as typeof kit.referenceDocuments })) } } };
    expect(() => deserialize(serializeForRoundtripCheck(kitDocs))).toThrow();
  });
});
