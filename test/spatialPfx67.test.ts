// @vitest-environment happy-dom

import { afterEach, beforeEach, expect, it, vi, describe } from "vitest";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { getMapEditHistoryEntries, resetMapEditHistory } from "../src/editor/mapEditHistory";
import { store } from "../src/project/store";
import { own, spatialId, requireOccurrenceAssociations } from "../src/project/spatial/domain";
import { authoringFixture, authoringValue } from "./support/spatialAuthoringFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";
import { geographyFixture, geographyRoot } from "./support/spatialGeographyFixture";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { spatialRasterDigest } from "../src/editor/spatial/compilerValidation";
import { isOwnedSpatialBinding } from "../src/project/spatial/bindings";
import { placeCompilerFixture, placeRoot, stairFloors, withStairConnections } from "./support/spatialPlaceCompilerFixture";
import { isolateTimers } from "./mergedTeardown";
import { deserialize, serialize } from "../src/project/io";
import { spatialPortLanding } from "../src/project/spatial/overview";
import { inspectNestedTraversal } from "./support/spatialPlaceTraversal";

describe("spatialAuthoring", () => {
  isolateTimers();
  describe("spatialAuthoringBoundary", () => {
    isolateTimers();
    beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] }));
    afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });
    it("instantiates frozen content when an explicit source insertion is previewed", () => {
      // Given a source in the active library.
      const f = authoringFixture();
      // When the domain insertion request crosses the shared controller.
      const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "instantiate", request: {
        source: { kind: "object", id: spatialId("hearth-design") }, rootId: "fresh-object", x: 0, y: 0, level: 0,
        seed: 19, generatorVersion: "authoring-test",
      } } }));
      // Then a standalone frozen occurrence is authored without touching raster.
      const occurrence = own(fixtureDocument(preview.project).occurrences, "fresh-object");
      expect(occurrence.source.revision).toBe(1);
      expect(occurrence.parentId).toBeNull();
      expect(occurrence.bindings).toEqual([]);
      expect(preview.project.maps).toEqual(store.getCurrent().maps);
    });
    it("rejects deletion when a design still has strong references", () => {
      // Given a hearth source used by a space design.
      const f = authoringFixture();
      // When the shared delete operation is requested without rewriting its references.
      const result = f.controller.preview(f.draft, { operation: { kind: "delete-design", source: { kind: "object", id: spatialId("hearth-design") } } });
      // Then the actual domain strong-reference rule blocks the proposal.
      expect(result).toMatchObject({ kind: "error", error: { code: "invalid" } });
      expect(getMapEditHistoryEntries()).toHaveLength(0);
    });
    it("deletes a source while preserving historical snapshots when only historical references remain", () => {
      // Given the standalone object source no longer used by current space definitions.
      const f = authoringFixture();
      const doc = fixtureDocument(f.draft.project);
      f.draft.project.spatialAuthoring = { ...doc, library: { ...doc.library, spaces: {} } };
      // When deleting that source explicitly.
      const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "delete-design", source: { kind: "object", id: spatialId("hearth-design") } } }));
      // Then historical raster snapshots survive loss of the editable source.
      const next = fixtureDocument(preview.project);
      expect(next.library.objects["hearth-design"]).toBeUndefined();
      expect(next.occurrences).toEqual(doc.occurrences);
    });
    it("rejects foreign preview handles when a different controller issued them", () => {
      // Given an issued preview.
      const f = authoringFixture();
      const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" } }));
      // When another controller receives that handle.
      const result = createSpatialAuthoringController().apply(preview);
      // Then it cannot assume the issuer's baseline authority.
      expect(result).toMatchObject({ kind: "error", error: { code: "foreign-preview" } });
    });
    it("leaves history empty when a canonical no-op preview is accepted", () => {
      // Given canonical compiled input without edits.
      const f = authoringFixture(true);
      const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" } }));
      // When the unchanged proposal is accepted.
      const result = authoringValue(f.controller.apply(preview));
      // Then acceptance does not manufacture a history step.
      expect(result.changed).toBe(false);
      expect(getMapEditHistoryEntries()).toHaveLength(0);
    });
    it("rejects a clipped stamp without mutation when compile preflight fails", () => {
      // Given a detached stamp request smaller than the frozen raster.
      const f = authoringFixture();
      const before = structuredClone(store.getCurrent());
      // When actual compilation checks its footprint.
      const result = f.controller.preview(f.draft, { operation: { kind: "edit" }, compile: { ...f.compile,
        target: { ...f.target, rect: { ...f.target.rect, width: 1 } } } });
      // Then no partial map, metadata or history becomes live.
      expect(result).toMatchObject({ kind: "error", error: { code: "invalid" } });
      expect(store.getCurrent()).toEqual(before);
      expect(getMapEditHistoryEntries()).toHaveLength(0);
    });
    it("previews real geography when its compiler is integrated", () => {
      // Given typed geography routed to the integrated region compiler.
      authoringFixture();
      store.replace(geographyFixture("region", 109));
      const controller = createSpatialAuthoringController();
      // When geography compilation is explicitly requested.
      const result = controller.preview(authoringValue(controller.createDraft()), { operation: { kind: "edit" }, compile: { occurrenceId: geographyRoot } });
      // Then concrete overview ownership is present in the detached result, not an unsupported placeholder.
      const preview = authoringValue(result);
      const bindings = own(fixtureDocument(preview.project).occurrences, geographyRoot).bindings;
      expect(bindings).toHaveLength(1);
      for (const binding of bindings) expect(Object.hasOwn(preview.project.maps, binding.mapId)).toBe(true);
      expect(getMapEditHistoryEntries()).toHaveLength(0);
    });
  });
  describe("spatialAuthoringConnections", () => {
    isolateTimers();
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
      store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
      resetMapEditHistory();
    });
    afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });
    it("removes exact outside stair events when explicit deletion removes the middle floor", () => {
      // Given three compiled floors connected through real owned stair transfer events.
      const input = withStairConnections(placeCompilerFixture());
      const middle = stairFloors(input)[1];
      if (!middle) throw new TypeError("Missing middle floor");
      store.replace(compileSpatialOccurrence(input, { occurrenceId: placeRoot }));
      const before = structuredClone(store.getCurrent());
      const middleBinding = own(fixtureDocument(before).occurrences, middle.roomId).bindings.find(isOwnedSpatialBinding);
      if (!middleBinding) throw new TypeError("Missing floor owner");
      const incoming = before.mapConnections?.filter(link => link.to.mapId === middleBinding.mapId) ?? [];
      expect(incoming).toHaveLength(2);
      const controller = createSpatialAuthoringController();
      // When external connection removal is explicitly requested for that floor.
      const preview = authoringValue(controller.preview(authoringValue(controller.createDraft()), { operation: { kind: "delete-occurrence",
        request: { occurrenceId: middle.roomId, externalConnections: "remove" } } }));
      // Then only the removed stair pair events disappear from surviving floors; their terrain stays intact.
      for (const link of incoming) {
        const map = own(preview.project.maps, link.from.mapId);
        expect(map.events.some(event => event.id === link.id)).toBe(false);
        expect(map.lowerTiles).toEqual(own(before.maps, link.from.mapId).lowerTiles);
        expect(preview.project.mapConnections?.some(value => value.id === link.id)).toBe(false);
        const binding = Object.values(fixtureDocument(preview.project).occurrences).flatMap(value => value.bindings)
          .find(value => isOwnedSpatialBinding(value) && value.mapId === map.id);
        if (!binding || !isOwnedSpatialBinding(binding)) throw new TypeError("Missing surviving owner");
        expect(binding.contentDigest).toBe(spatialRasterDigest(map, binding));
      }
    });
  });
  describe("spatialAuthoringOperations", () => {
    isolateTimers();
    beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] }));
    afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });
    it("clones frozen occurrences without live source expansion when clone is requested", () => {
      // Given an independently frozen object occurrence.
      const f = authoringFixture(true);
      const before = structuredClone(store.getCurrent());
      // When duplication is previewed through the public operation.
      const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "clone-occurrence",
        request: { occurrenceId: f.occurrenceId, rootId: "clone-root", externalConnections: "omit" } } }));
      // Then only a detached fresh root is added, with released bindings and equal frozen raster.
      const copy = own(fixtureDocument(preview.project).occurrences, "clone-root");
      expect(copy.bindings).toEqual([]);
      expect(copy.snapshot.kitCells).toEqual(own(fixtureDocument(before).occurrences, f.occurrenceId).snapshot.kitCells);
      expect(store.getCurrent()).toEqual(before);
    });
    it("retains raster when explicit detach releases binding ownership", () => {
      // Given compiled object pixels and an event.
      const f = authoringFixture(true);
      const before = structuredClone(store.getCurrent().maps);
      // When explicit detach is previewed.
      const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "detach", occurrenceId: f.occurrenceId } }));
      // Then bookkeeping alone is released.
      expect(preview.project.maps).toEqual(before);
      expect(own(fixtureDocument(preview.project).occurrences, f.occurrenceId).bindings).toEqual([]);
    });
    it("removes only owned tiles and events when deleting a compiled occurrence", () => {
      // Given an owned stamp surrounded by human tiles and an unrelated event.
      const f = authoringFixture(true);
      const original = own(store.getCurrent().maps, f.target.mapId);
      const event = original.events[0];
      if (!event) throw new TypeError("Expected generated object event");
      store.updateMap(original.id, map => { map.events.push({ ...structuredClone(event), id: "human-event", x: 0, y: 0 }); });
      const draft = authoringValue(f.controller.createDraft());
      // When deletion is previewed.
      const preview = authoringValue(f.controller.preview(draft, { operation: { kind: "delete-occurrence",
        request: { occurrenceId: f.occurrenceId, externalConnections: "reject" } } }));
      // Then owned content is removed, not unrelated pixels/events.
      const map = own(preview.project.maps, original.id);
      expect(map.lowerTiles[0]).toBe(original.lowerTiles[0]);
      expect(map.lowerTiles[3 * map.width + 3]).toBe(-1);
      expect(map.events.map(value => value.id)).toEqual(["human-event"]);
      expect(preview.impact.events).toEqual([{ mapId: original.id, eventId: event.id }]);
      expect(fixtureDocument(preview.project).occurrences[f.occurrenceId]).toBeUndefined();
    });
    it("refreshes only on explicit request when an object source revision changes", () => {
      // Given source changes in the detached draft, with the live occurrence still frozen at revision one.
      const f = authoringFixture(true);
      const doc = fixtureDocument(f.draft.project);
      const source = own(doc.library.objects, "hearth-design");
      f.draft.project.spatialAuthoring = { ...doc, library: { ...doc.library, objects: { ...doc.library.objects,
        [source.id]: { ...source, revision: 2, chips: [] } } } };
      // When explicit refresh and compilation are previewed together.
      const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "refresh",
        request: { occurrenceId: f.occurrenceId, externalConnections: "reject" } }, compile: f.compile }));
      // Then identity survives but the frozen source and emitted chip event change only in the proposal.
      const occurrence = own(fixtureDocument(preview.project).occurrences, f.occurrenceId);
      expect(occurrence.source.revision).toBe(2);
      expect(own(preview.project.maps, f.target.mapId).events).toEqual([]);
      expect(own(fixtureDocument(store.getCurrent()).occurrences, f.occurrenceId).source.revision).toBe(1);
    });
    it("keeps snapshots frozen when editing only the library source", () => {
      // Given an authored source edit without refresh.
      const f = authoringFixture(true);
      const doc = fixtureDocument(f.draft.project);
      const source = own(doc.library.objects, "hearth-design");
      f.draft.project.spatialAuthoring = { ...doc, library: { ...doc.library, objects: { ...doc.library.objects,
        [source.id]: { ...source, revision: 2, chips: [] } } } };
      // When a plain edit preview is requested.
      const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" } }));
      // Then the existing instance remains at its original frozen revision.
      expect(own(fixtureDocument(preview.project).occurrences, f.occurrenceId).source.revision).toBe(1);
      expect(preview.project.maps).toEqual(store.getCurrent().maps);
    });
    it("clones a source under a fresh ID when a design clone is requested", () => {
      // Given a reusable source, without altering its historical instances.
      const f = authoringFixture();
      // When the controller clones the library record.
      const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "clone-design",
        source: { kind: "object", id: spatialId("hearth-design") }, id: spatialId("cloned-design"), name: "Clone" } }));
      // Then the new source is independent, and occurrence identity is untouched.
      expect(own(fixtureDocument(preview.project).library.objects, "cloned-design").id).toBe("cloned-design");
      expect(fixtureDocument(preview.project).occurrences).toEqual(fixtureDocument(store.getCurrent()).occurrences);
    });
  });
});

describe("spatialAuthoringConnectionEdit", () => {
  isolateTimers();
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
});
