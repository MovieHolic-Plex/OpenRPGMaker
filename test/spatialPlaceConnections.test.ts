import { describe, expect, it } from "vitest";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { own, requireOccurrenceAssociations, spatialId } from "../src/project/spatial/domain";
import { fixtureDocument, replaceOccurrence } from "./support/spatialSpaceCompilerFixture";
import { placeChild, placeCompilerFixture, placeRoot, withStairConnections } from "./support/spatialConnectionSceneFixture";

const request = { occurrenceId: placeRoot };

describe("nested explicit transfer ownership", () => {
  it("compiles authored transfer chips when persisted endpoint associations supply their destination", () => {
    // Given: actual stair objects use transfer chips instead of a pass-only fixture chip.
    const input = withStairConnections(placeCompilerFixture());
    const document = fixtureDocument(input);
    const endpoints = new Set(document.connections.flatMap(link => [link.from.occurrenceId, link.to.occurrenceId]));
    input.spatialAuthoring = { ...document, occurrences: Object.fromEntries(Object.values(document.occurrences).map(requireOccurrenceAssociations).map(occurrence => {
      if (!endpoints.has(occurrence.id)) return [occurrence.id, occurrence];
      const design = own(occurrence.snapshot.library.objects, occurrence.source.id);
      return [occurrence.id, { ...occurrence, snapshot: { ...occurrence.snapshot, library: { ...occurrence.snapshot.library,
        objects: { ...occurrence.snapshot.library.objects, [design.id]: { ...design, chips: ["transfer"] } } } } }];
    })) };
    // When: the connection compiler resolves these exact associated objects.
    const output = compileSpatialOccurrence(input, request);
    // Then: one real event per requested direction, not a fake self-transfer plus a link.
    expect(output.mapConnections).toHaveLength(4);
  });

  it("retains a facility port when its exact landing projects onto the enclosing square", () => {
    // Given: a facility without an exterior owns a named approach on the square's map.
    const fixture = placeCompilerFixture();
    const innId = placeChild(fixture, placeRoot, "inn");
    const inn = requireOccurrenceAssociations(own(fixtureDocument(fixture).occurrences, innId));
    const design = own(inn.snapshot.library.places, inn.source.id);
    const local = { id: spatialId("approach"), name: "Approach", x: -12, y: 9 };
    const portId = spatialId("facility-approach");
    const input = replaceOccurrence(fixture, { ...inn, snapshot: { ...inn.snapshot,
      library: { ...inn.snapshot.library, places: { ...inn.snapshot.library.places, [design.id]: { ...design, ports: [local] } } },
      ports: [{ ...local, id: portId, localPortId: local.id }] } });
    // When: compile its exact local port without declaring a portal.
    const output = compileSpatialOccurrence(input, request);
    // Then: projection survives even though the facility does not own the square raster.
    expect(own(fixtureDocument(output).occurrences, innId).bindings.flatMap(binding => binding.ports))
      .toContainEqual({ portId, x: 12, y: 17 });
    expect(output.mapConnections).toEqual([]);
  });

  it("rejects removed owned connection records when their transfer events still exist", () => {
    // Given: a manual deletion of generated mapConnections, while owned events remain.
    const input = compileSpatialOccurrence(withStairConnections(placeCompilerFixture()), request);
    input.mapConnections = [];
    const before = JSON.stringify(input);
    // When / Then: missing owned projection output is a conflict, not permission to silently recreate it.
    expect(() => compileSpatialOccurrence(input, request)).toThrowError(expect.objectContaining({ code: "ownership" }));
    expect(JSON.stringify(input)).toBe(before);
  });

  it("rejects unmanaged raster replacement when only overlapping projections reference the generated map", () => {
    // Given: all raster owners were explicitly detached to non-owning projections.
    const input = compileSpatialOccurrence(placeCompilerFixture(), request);
    const document = fixtureDocument(input);
    input.spatialAuthoring = { ...document, occurrences: Object.fromEntries(Object.values(document.occurrences).map(occurrence =>
      [occurrence.id, { ...occurrence, bindings: occurrence.bindings.map(binding => ({ kind: "projection", mapId: binding.mapId,
        rect: binding.rect, ports: binding.ports })) }])) };
    const before = JSON.stringify(input);
    // When / Then: projections never authorize pixel/event erasure.
    expect(() => compileSpatialOccurrence(input, request)).toThrowError(expect.objectContaining({ code: "ownership" }));
    expect(JSON.stringify(input)).toBe(before);
  });
});
