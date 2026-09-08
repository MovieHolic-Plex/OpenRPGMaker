import assert from "node:assert/strict";
import { compileSpatialOccurrence } from "../../src/editor/spatial/compileSpatialOccurrence";
import { spatialRasterDigest } from "../../src/editor/spatial/compilerValidation";
import { deserialize, serialize } from "../../src/project/io";
import { isOwnedSpatialBinding } from "../../src/project/spatial/bindings";
import { own, requireOccurrenceAssociations, resolveOccurrencePortId, spatialId } from "../../src/project/spatial/domain";
import { duplicateSpatialOccurrence } from "../../src/project/spatial/duplicate";
import type { SpatialConnection } from "../../src/project/spatial/types";
import type { Project } from "../../src/project/types";
import { fixtureDocument } from "./spatialSpaceCompilerFixture";
import { placeChild, placeCompilerFixture, placeRoot, stairFloors } from "./spatialPlaceCompilerFixture";

/** Two disjoint raster owners share an outdoor map; each edge uses a distinct pair of ports. */
export function sharedFixture(selectedIncluded = true) {
  const input = placeCompilerFixture(19);
  const squareId = placeChild(input, placeRoot, "square");
  const secondId = spatialId("opaque/second-square");
  const document = duplicateSpatialOccurrence(fixtureDocument(input), input, { occurrenceId: squareId, rootId: secondId, externalConnections: "omit" });
  const root = requireOccurrenceAssociations(own(document.occurrences, placeRoot));
  const second = requireOccurrenceAssociations(own(document.occurrences, secondId));
  const design = own(root.snapshot.library.places, root.source.id);
  const slot = design.children.find(child => child.id === "square");
  assert.ok(slot);
  const newSlot = { ...slot, id: spatialId("opaque/shared-slot"), x: 45, y: 3 };
  input.spatialAuthoring = { ...document, rootOccurrenceIds: document.rootOccurrenceIds.filter(id => id !== secondId), occurrences: {
    ...document.occurrences,
    [secondId]: { ...second, parentId: placeRoot, parentSlot: { slotId: newSlot.id, index: 0 }, x: newSlot.x, y: newSlot.y },
    [root.id]: { ...root, snapshot: { ...root.snapshot, library: { ...root.snapshot.library,
      places: { ...root.snapshot.library.places, [design.id]: { ...design, children: [...design.children, newSlot] } } } } },
  } };
  const first = own(fixtureDocument(input).occurrences, squareId);
  const edge = (local: string, id: string): SpatialConnection => ({ id: spatialId(id), bidirectional: true,
    from: { occurrenceId: squareId, portId: resolveOccurrencePortId(first, spatialId(local)) },
    to: { occurrenceId: secondId, portId: resolveOccurrencePortId(second, spatialId(local)) } });
  const selected = edge("entry", "constructor");
  const parallel = edge("exit", "__proto__");
  input.spatialAuthoring = { ...fixtureDocument(input), connections: selectedIncluded ? [parallel, selected] : [parallel] };
  return { project: compileSpatialOccurrence(input, { occurrenceId: placeRoot }), selected, parallel };
}

/** Two parallel floor edges have the same two raster owners but independent projected object endpoints. */
export function parallelFixture() {
  const input = placeCompilerFixture(19);
  const [lower, upper] = stairFloors(input);
  assert.ok(lower && upper);
  const selected: SpatialConnection = { id: spatialId("opaque/selected"), bidirectional: true,
    from: { occurrenceId: lower.upId, portId: lower.upPortId }, to: { occurrenceId: upper.stairId, portId: upper.portId } };
  const parallel: SpatialConnection = { id: spatialId("opaque/retained"), bidirectional: true,
    from: { occurrenceId: lower.stairId, portId: lower.portId }, to: { occurrenceId: upper.upId, portId: upper.upPortId } };
  input.spatialAuthoring = { ...fixtureDocument(input), connections: [parallel, selected] };
  return { project: compileSpatialOccurrence(input, { occurrenceId: placeRoot }), selected, parallel };
}

/** Rename persisted event identities consistently, preserving commands and actual ownership proofs. */
export function renameEvents(project: Project, eventIds: readonly string[]): Project {
  const aliases = new Map(eventIds.map((id, index) => [id, `opaque-preserved/event-${index}`]));
  const maps = Object.fromEntries(Object.entries(project.maps).map(([id, map]) => [id, { ...map,
    events: map.events.map(event => ({ ...event, id: aliases.get(event.id) ?? event.id })),
  }]));
  const document = fixtureDocument(project);
  return deserialize(serialize({ ...project, maps, mapConnections: project.mapConnections?.map(pair => ({ ...pair, id: aliases.get(pair.id) ?? pair.id })),
    spatialAuthoring: { ...document, occurrences: Object.fromEntries(Object.values(document.occurrences).reverse().map(occurrence => [occurrence.id, { ...occurrence,
      bindings: occurrence.bindings.map(binding => {
        if (!isOwnedSpatialBinding(binding)) return binding;
        const next = { ...binding, eventIds: binding.eventIds.map(id => aliases.get(id) ?? id) };
        return { ...next, contentDigest: spatialRasterDigest(own(maps, binding.mapId), next) };
      }),
    }])) },
  }));
}
