import { describe, expect, it } from "vitest";
import { deserialize, serialize, serializePretty } from "@/project/io";
import { validateSpatialAuthoring } from "@/project/spatial/guards";
import { inspectLegacySpatialConstraints } from "@/project/spatial/legacyConstraints";
import { emptySpatialDocument, spatialProject, spatialWire, designBase } from "./support/spatialSchemaFixture";
import { linkedRegionMapId } from "@/project/spatial/regionMapLinks";
import { instantiateSpatialDesign } from "@/project/spatial/instances";
import { spatialId } from "@/project/spatial/domain";
import { isolateTimers } from "./mergedTeardown";

describe("spatialLegacyRoomKinds", () => {
  isolateTimers();
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
});

describe("spatialRegionMapLinks", () => {
  isolateTimers();
  function fixture() {
    const { project } = spatialProject();
    const map = project.maps[project.startMapId];
    const doc = emptySpatialDocument();
    project.spatialAuthoring = validateSpatialAuthoring({ ...doc, library: { ...doc.library, regions: {
      region: { ...designBase('region'), terrain: { tilesetId: map.tilesetId, width: map.width, height: map.height, floor: 'grass', areas: [] }, places: [], routes: [], ports: [] },
    } } });
    project.spatialAuthoring = structuredClone(instantiateSpatialDesign(project.spatialAuthoring, project, {
      source: { kind: 'region', id: spatialId('region') }, rootId: 'occurrence', x: 0, y: 0, level: 0, seed: 1, generatorVersion: 'test',
    }));
    const occurrence = project.spatialAuthoring.occurrences.occurrence;
    project.spatialAuthoring = { ...project.spatialAuthoring, occurrences: { occurrence: { ...occurrence,
      bindings: [{ kind: 'projection', mapId: map.id, rect: { x: 0, y: 0, width: map.width, height: map.height }, ports: [] }],
    } } };
    return { project, map };
  }
  describe('whole-map region associations', () => {
    it('survives full project IO without rewriting the map', () => {
      const { project, map } = fixture();
      const loaded = deserialize(serialize(project));
      expect(linkedRegionMapId(loaded, 'region')).toBe(map.id);
      expect(linkedRegionMapId(loaded, 'region', 'occurrence')).toBe(map.id);
      expect(loaded.maps).toEqual(project.maps);
    });
    it('does not guess a library destination when there are two occurrences', () => {
      const { project } = fixture();
      const doc = project.spatialAuthoring!;
      project.spatialAuthoring = { ...doc, occurrences: { ...doc.occurrences, second: { ...doc.occurrences.occurrence, id: spatialId('second') } } };
      expect(linkedRegionMapId(project, 'region')).toBeUndefined();
      expect(linkedRegionMapId(project, 'region', 'occurrence')).toBeDefined();
    });
    it('leaves stale library revisions on the design editor', () => {
      const { project } = fixture();
      const doc = project.spatialAuthoring!;
      project.spatialAuthoring = { ...doc, library: { ...doc.library, regions: { region: { ...doc.library.regions.region, revision: 2 } } } };
      expect(linkedRegionMapId(project, 'region')).toBeUndefined();
      expect(linkedRegionMapId(project, 'region', 'occurrence')).toBeDefined();
    });
    it('rejects missing maps and partial-map projections', () => {
      const { project, map } = fixture();
      map.width += 1;
      expect(linkedRegionMapId(project, 'region')).toBeUndefined();
      delete project.maps[map.id];
      expect(linkedRegionMapId(project, 'region')).toBeUndefined();
    });
  });
});
