/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { resetMapEditHistory } from "../src/editor/mapEditHistory";
import { deserialize, serialize } from "../src/project/io";
import { store } from "../src/project/store";
import { own, requireOccurrenceAssociations, spatialId } from "../src/project/spatial/domain";
import { spatialPortLanding } from "../src/project/spatial/overview";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";
import { placeCompilerFixture, placeRoot, stairFloors, withStairConnections } from "./support/spatialPlaceCompilerFixture";
import { inspectNestedTraversal } from "./support/spatialPlaceTraversal";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  resetMapEditHistory();
});
afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });

function fixture(bidirectional = true) {
  const input = withStairConnections(placeCompilerFixture());
  const document = fixtureDocument(input);
  const original = document.connections[0];
  const upper = stairFloors(input)[2];
  if (!original || !upper) throw new TypeError("Missing fixture edge/floor");
  // Persisted IDs are opaque and ordinary links carry no local recipe provenance.
  const sourceId = spatialId("constructor");
  const sourcePortId = spatialId("opaque/source-port");
  const targetId = spatialId("opaque/third-room");
  const targetPortId = spatialId("opaque/arrival-port");
  const room = requireOccurrenceAssociations(own(document.occurrences, upper.roomId));
  const design = own(room.snapshot.library.spaces, room.source.id);
  const arrival = { id: spatialId("floor-arrival"), name: "Arrival", x: 12, y: 11 };
  const link = { ...original, id: spatialId("opaque/edge:constructor"), bidirectional,
    from: { occurrenceId: sourceId, portId: sourcePortId } };
  const target = { occurrenceId: targetId, portId: targetPortId };
  input.spatialAuthoring = { ...document, connections: [link, ...document.connections.slice(1)],
    occurrences: Object.fromEntries(Object.values(document.occurrences).map(requireOccurrenceAssociations).map(occurrence => {
      if (occurrence.id === original.from.occurrenceId) return [sourceId, { ...occurrence, id: sourceId,
        snapshot: { ...occurrence.snapshot, ports: occurrence.snapshot.ports.map(port => port.id === original.from.portId ? { ...port, id: sourcePortId } : port) } }];
      if (occurrence.id === room.id) return [targetId, { ...room, id: targetId, snapshot: { ...room.snapshot,
        ports: [...room.snapshot.ports, { ...arrival, id: targetPortId, localPortId: arrival.id }],
        library: { ...room.snapshot.library, spaces: { ...room.snapshot.library.spaces, [design.id]: { ...design, ports: [...design.ports, arrival] } } },
      } }];
      return [occurrence.id, occurrence.parentId === room.id ? { ...occurrence, parentId: targetId } : occurrence];
    })),
  };
  const project = compileSpatialOccurrence(input, { occurrenceId: placeRoot });
  const from = spatialPortLanding(fixtureDocument(project), link.from);
  if (!from) throw new TypeError("Missing opaque compiled source");
  own(project.maps, from.mapId).events.push({ id: "unrelated-manual", name: "Manual", x: 0, y: 0, trigger: { kind: "action" }, commands: [] });
  store.replace(deserialize(serialize(project)));
  resetMapEditHistory();
  const before = structuredClone(store.getCurrent());
  const controller = createSpatialAuthoringController();
  return { before, controller, link, target };
}

it.each([false, true])("retargets an actual edge with bidirectional=%s through IO and one history step", bidirectional => {
  // Given: two independently compiled stair links and a new unused concrete landing.
  const { before, controller, link, target } = fixture();
  const document = fixtureDocument(before);
  const oldTarget = spatialPortLanding(document, link.to);
  const expectedTarget = spatialPortLanding(document, target);
  if (!oldTarget || !expectedTarget) throw new TypeError("Missing compiled landing");
  const unrelated = before.mapConnections?.filter(pair => pair.from.mapId !== spatialPortLanding(document, link.from)?.mapId &&
    !(pair.from.mapId === oldTarget.mapId && pair.from.x === oldTarget.x && pair.from.y === oldTarget.y));
  // When: replace exactly this edge, retaining its actual ID, then explicitly accept.
  const preview = authoringValue(controller.preview(authoringValue(controller.createDraft()), {
    operation: { kind: "edit-connection", request: { kind: "replace", connection: { ...link, to: target, bidirectional } } },
    compile: { occurrenceId: placeRoot },
  }));
  expect(store.getCurrent()).toEqual(before);
  authoringValue(controller.apply(preview));
  // Then: real generated pages execute only the new destinations, including after reload.
  const accepted = structuredClone(store.getCurrent());
  const traversal = inspectNestedTraversal(deserialize(serialize(accepted)));
  expect(traversal.routes.filter(route => route.to.mapId === expectedTarget.mapId && route.to.x === expectedTarget.x && route.to.y === expectedTarget.y)).toHaveLength(1);
  expect(traversal.routes.some(route => route.from.mapId === oldTarget.mapId && route.from.x === oldTarget.x && route.from.y === oldTarget.y)).toBe(false);
  expect(accepted.mapConnections).toHaveLength(bidirectional ? 4 : 3);
  for (const pair of unrelated ?? []) expect(accepted.mapConnections).toContainEqual(pair);
  expect(fixtureDocument(accepted).library).toEqual(document.library);
  expect(fixtureDocument(accepted).connections).toEqual([{ ...link, to: target, bidirectional }, ...document.connections.slice(1)]);
  expect(accepted.mapTree).toEqual(before.mapTree);
  for (const [id, map] of Object.entries(before.maps)) {
    expect(own(accepted.maps, id).lowerTiles).toEqual(map.lowerTiles);
    expect(own(accepted.maps, id).upperTiles).toEqual(map.upperTiles);
    for (const event of map.events.filter(event => !preview.impact.events.some(impact => impact.mapId === id && impact.eventId === event.id))) {
      expect(own(accepted.maps, id).events).toContainEqual(event);
    }
  }
  for (const occurrence of Object.values(document.occurrences)) expect(own(fixtureDocument(accepted).occurrences, occurrence.id).snapshot).toEqual(occurrence.snapshot);
  expect(controller.undo()).toBe(true);
  expect(store.getCurrent()).toEqual(before);
  expect(controller.undo()).toBe(false);
  expect(controller.redo()).toBe(true);
  expect(store.getCurrent()).toEqual(accepted);
  expect(controller.redo()).toBe(false);
});

it.each([false, true])("changes only direction to bidirectional=%s when endpoints stay identical", bidirectional => {
  // Given: the opposite direction mode on this exact compiled edge.
  const { before, controller, link } = fixture(!bidirectional);
  // When: accept a direction-only replacement at the original concrete endpoints.
  const preview = authoringValue(controller.preview(authoringValue(controller.createDraft()), {
    operation: { kind: "edit-connection", request: { kind: "replace", connection: { ...link, bidirectional } } }, compile: { occurrenceId: placeRoot },
  }));
  authoringValue(controller.apply(preview));
  // Then: the reverse page exists exactly when requested, and history restores the old mode.
  const accepted = structuredClone(store.getCurrent());
  expect(inspectNestedTraversal(accepted).routes).toHaveLength(bidirectional ? 4 : 3);
  expect(fixtureDocument(accepted).connections).toEqual([{ ...link, bidirectional }, ...fixtureDocument(before).connections.slice(1)]);
  expect(controller.undo()).toBe(true);
  expect(store.getCurrent()).toEqual(before);
  expect(controller.undo()).toBe(false);
  expect(controller.redo()).toBe(true);
  expect(store.getCurrent()).toEqual(accepted);
});

it("keeps remove then create in one acceptance when continuing issued connection previews", () => {
  // Given: a detached unlink preview, not an adopted graph or a manually copied handle.
  const { before, controller, link, target } = fixture();
  const removed = authoringValue(controller.preview(authoringValue(controller.createDraft()), {
    operation: { kind: "edit-connection", request: { kind: "remove", connectionId: link.id } }, compile: { occurrenceId: placeRoot },
  }));
  const draft = authoringValue(controller.continueDraft(removed));
  const connection = { ...link, to: target, bidirectional: false };
  // When: the next explicit request creates a new edge at the released ID and is accepted once.
  const created = authoringValue(controller.preview(draft, {
    operation: { kind: "edit-connection", request: { kind: "create", connection } }, compile: { occurrenceId: placeRoot },
  }));
  authoringValue(controller.apply(created));
  // Then: the original live state remains the sole undo baseline, with exact interpreter output.
  const accepted = structuredClone(store.getCurrent());
  expect(fixtureDocument(accepted).connections).toContainEqual(connection);
  expect(inspectNestedTraversal(accepted).routes).toHaveLength(3);
  expect(controller.undo()).toBe(true);
  expect(store.getCurrent()).toEqual(before);
  expect(controller.undo()).toBe(false);
  expect(controller.redo()).toBe(true);
  expect(store.getCurrent()).toEqual(accepted);
});

it("unlinks only the requested actual connection when compiled transfers exist", () => {
  // Given: a compiled two-way link alongside another two-way link.
  const { before, controller, link } = fixture();
  // When: explicitly remove the selected identity and compile its containing place.
  const preview = authoringValue(controller.preview(authoringValue(controller.createDraft()), {
    operation: { kind: "edit-connection", request: { kind: "remove", connectionId: link.id } }, compile: { occurrenceId: placeRoot },
  }));
  authoringValue(controller.apply(preview));
  // Then: no dangling binding IDs or old transfers survive IO; the unrelated edge still executes.
  const accepted = structuredClone(store.getCurrent());
  expect(fixtureDocument(deserialize(serialize(accepted))).connections).toEqual(fixtureDocument(before).connections.slice(1));
  expect(inspectNestedTraversal(accepted).routes).toHaveLength(2);
  expect(preview.impact.events).toHaveLength(2);
  expect(controller.undo()).toBe(true);
  expect(store.getCurrent()).toEqual(before);
  expect(controller.undo()).toBe(false);
  expect(controller.redo()).toBe(true);
  expect(store.getCurrent()).toEqual(accepted);
});

it("creates a concrete connection when the compiled place has no logical edge", () => {
  // Given: compiled floors without connections and a pair of actual ports.
  const input = withStairConnections(placeCompilerFixture());
  const link = fixtureDocument(input).connections[0];
  if (!link) throw new TypeError("Missing fixture edge");
  input.spatialAuthoring = { ...fixtureDocument(input), connections: [] };
  store.replace(compileSpatialOccurrence(input, { occurrenceId: placeRoot }));
  resetMapEditHistory();
  const before = structuredClone(store.getCurrent());
  const controller = createSpatialAuthoringController();
  // When: create this ordinary edge, with no invented localConnection association.
  const preview = authoringValue(controller.preview(authoringValue(controller.createDraft()), {
    operation: { kind: "edit-connection", request: { kind: "create", connection: link } }, compile: { occurrenceId: placeRoot },
  }));
  authoringValue(controller.apply(preview));
  // Then: the emitted pair really traverses and the whole change is one history entry.
  const accepted = structuredClone(store.getCurrent());
  expect(inspectNestedTraversal(accepted).routes).toHaveLength(2);
  expect(fixtureDocument(accepted).connections).toEqual([link]);
  expect(controller.undo()).toBe(true);
  expect(store.getCurrent()).toEqual(before);
  expect(controller.undo()).toBe(false);
  expect(controller.redo()).toBe(true);
  expect(store.getCurrent()).toEqual(accepted);
});
