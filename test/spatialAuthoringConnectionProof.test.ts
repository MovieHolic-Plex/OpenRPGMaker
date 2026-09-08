import { expect, it } from "vitest";
import { inspectRemovedAuthoringTransfers } from "../src/editor/spatial/authoringConnections";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { spatialRasterDigest } from "../src/editor/spatial/compilerValidation";
import { isOwnedSpatialBinding } from "../src/project/spatial/bindings";
import { own } from "../src/project/spatial/domain";
import { spatialPortLanding } from "../src/project/spatial/overview";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";
import { placeCompilerFixture, placeRoot, withStairConnections } from "./support/spatialPlaceCompilerFixture";

it("rejects missing old event authority when one side of a compiled two-way edge is unmanaged", () => {
  // Given: the old pair exists, but only its reverse source still claims ownership.
  const project = compileSpatialOccurrence(withStairConnections(placeCompilerFixture()), { occurrenceId: placeRoot });
  const document = fixtureDocument(project);
  const link = document.connections[0];
  if (!link) throw new TypeError("Missing fixture link");
  const landing = spatialPortLanding(document, link.from);
  if (!landing) throw new TypeError("Missing fixture landing");
  const pair = project.mapConnections?.find(value => value.from.mapId === landing.mapId && value.from.x === landing.x && value.from.y === landing.y);
  if (!pair) throw new TypeError("Missing fixture transfer");
  const before = { ...document, occurrences: Object.fromEntries(Object.values(document.occurrences).map(occurrence => [occurrence.id, { ...occurrence,
    bindings: occurrence.bindings.map(binding => {
      if (!isOwnedSpatialBinding(binding) || !binding.eventIds.includes(pair.id)) return binding;
      const next = { ...binding, eventIds: binding.eventIds.filter(id => id !== pair.id), connectionIds: binding.connectionIds.filter(id => id !== link.id) };
      return { ...next, contentDigest: spatialRasterDigest(own(project.maps, binding.mapId), next) };
    }),
  }])) };
  const after = { ...before, connections: before.connections.filter(value => value.id !== link.id) };
  // When / Then: no owner is not evidence of an uncompiled connection; exact cleanup rejects.
  expect(() => inspectRemovedAuthoringTransfers(project, before, after)).toThrowError(expect.objectContaining({ code: "ownership" }));
});
