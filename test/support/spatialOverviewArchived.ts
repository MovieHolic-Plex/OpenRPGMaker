import { requireRecord } from "../../src/project/io/guards";
import { validateProjectV4 } from "../../src/project/io/shape";
import { own, spatialId } from "../../src/project/spatial/domain";
import { validateSpatialAuthoring } from "../../src/project/spatial/guards";

/** Explicit reviewed proposal for the two retained task10 independent witnesses (43/271).
 * These are literal authored associations, not an importer, ID parser or provenance backfill.
 */
export function associateIndependentWitness(input: unknown) {
  const raw = requireRecord("project", input);
  const document = validateSpatialAuthoring(raw.spatialAuthoring);
  const ownerId = spatialId("Q:96f4|opaque");
  const connectionId = spatialId("connection:13:Q:96f4|opaque6:L:0b80");
  const root = own(document.occurrences, ownerId);
  const overviewEntries = [
    { target: { occurrenceId: spatialId("child:13:Q:96f4|opaque6:S:a09c:0"), portId: spatialId("port:32:child:13:Q:96f4|opaque6:S:a09c:06:P:8bb1") },
      x: 7, y: 6, eventId: "E:child:13:Q:96f4|opaque6:S:a09c:0", returnEventId: "R:child:13:Q:96f4|opaque6:S:a09c:0" },
    { target: { occurrenceId: spatialId("child:13:Q:96f4|opaque6:S:019d:0"), portId: spatialId("port:32:child:13:Q:96f4|opaque6:S:019d:06:P:8bb1") },
      x: 29, y: 19, eventId: "E:child:13:Q:96f4|opaque6:S:019d:0", returnEventId: "R:child:13:Q:96f4|opaque6:S:019d:0" },
  ];
  return validateProjectV4({ ...raw, spatialAuthoring: { ...document,
    connections: document.connections.map(link => link.id === connectionId ? { ...link,
      overviewRoute: { occurrenceId: ownerId, localConnectionId: spatialId("L:0b80") } } : link),
    occurrences: { ...document.occurrences, [ownerId]: { ...root, bindings: root.bindings.map(binding => ({ ...binding, overviewEntries })) } },
  } });
}
