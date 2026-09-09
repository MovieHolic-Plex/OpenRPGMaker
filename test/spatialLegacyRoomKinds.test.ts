import { describe, expect, it } from "vitest";
import { deserialize, serialize, serializePretty } from "@/project/io";
import { validateSpatialAuthoring } from "@/project/spatial/guards";
import { inspectLegacySpatialConstraints } from "@/project/spatial/legacyConstraints";
import { emptySpatialDocument, spatialProject, spatialWire } from "./support/spatialSchemaFixture";

const original = { tilesetId: " removed atlas ", record: {
  id: " room ", label: "  label\n", requiredRoles: [" custom ", " custom ", ""],
  suggestedModifiers: ["", " mood ", " mood "], walkway: false,
} };
const variants = [
  [original, original], [],
  [{ tilesetId: "", record: { id: "", label: "", requiredRoles: [] } }],
  [{ tilesetId: " ", record: { id: " ", label: " ", requiredRoles: [], suggestedModifiers: [], walkway: true } }],
];

describe("historical typed room constraints", () => {
  it.each(variants.map(roomKinds => ({ roomKinds })))("preserves original records when $roomKinds roundtrip", ({ roomKinds }) => {
    // Given: qualifiers and duplicates are historical, never live keys.
    const { project } = spatialProject();
    const document = emptySpatialDocument();
    const input = { ...document, legacyImport: { ...document.legacyImport, roomKinds } };
    const before = JSON.stringify(input);
    // When
    const results = [serialize, serializePretty].map(write => deserialize(write(deserialize(spatialWire(project, input)))));
    // Then
    for (const result of results) expect(result.spatialAuthoring).toStrictEqual(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("retains omission when old version1 receipts have no roomKinds", () => {
    // Given
    const input = emptySpatialDocument();
    // When
    const parsed = validateSpatialAuthoring(input);
    // Then
    expect(Object.hasOwn(parsed.legacyImport, "roomKinds")).toBe(false);
  });

  it.each([undefined, ...variants].map(roomKinds => ({ roomKinds })))("exposes typed compatibility data when inspecting $roomKinds", ({ roomKinds }) => {
    // Given
    const document = emptySpatialDocument();
    const receipt = validateSpatialAuthoring({ ...document, legacyImport: {
      ...document.legacyImport, ...(roomKinds === undefined ? {} : { roomKinds }),
    } }).legacyImport;
    const before = JSON.stringify(receipt);
    // When
    const view = inspectLegacySpatialConstraints(receipt);
    // Then: the discriminator is a machine-facing routing value, not pinned prose.
    expect(view).toStrictEqual({ kind: "legacy-compatibility-constraints", ...(roomKinds === undefined ? {} : { roomKinds }) });
    expect(JSON.stringify(receipt)).toBe(before);
  });

  const invalid = [
    undefined, null, {}, [null], [{ record: original.record }], [{ ...original, tilesetId: 1 }],
    [{ ...original, extra: true }], [{ ...original, record: { ...original.record, extra: true } }],
    ...["id", "label", "requiredRoles"].map(key => [{ ...original, record: Object.fromEntries(Object.entries(original.record).filter(([field]) => field !== key)) }]),
    ...[null, "bed", [1]].map(requiredRoles => [{ ...original, record: { ...original.record, requiredRoles } }]),
    ...[undefined, null, "mood", [false]].map(suggestedModifiers => [{ ...original, record: { ...original.record, suggestedModifiers } }]),
    ...[undefined, null, "false", 0].map(walkway => [{ ...original, record: { ...original.record, walkway } }]),
  ];
  it.each(invalid.map(roomKinds => ({ roomKinds })))("rejects malformed shapes when roomKinds is $roomKinds", ({ roomKinds }) => {
    // Given
    const document = emptySpatialDocument();
    const input = { ...document, legacyImport: { ...document.legacyImport, roomKinds } };
    // When
    const parse = () => validateSpatialAuthoring(input);
    // Then
    expect(parse).toThrow("spatialAuthoring.legacyImport.roomKinds");
  });
});
