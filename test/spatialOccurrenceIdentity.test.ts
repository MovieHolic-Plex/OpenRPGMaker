import { describe, expect, it } from "vitest";
import { deserialize, ProjectFormatError, serialize, serializePretty } from "@/project/io";
import { designNode, designSlots, nodePorts, occurrenceChildId, occurrencePortId, own, spatialId } from "@/project/spatial/domain";
import { instantiateSpatialDesign } from "@/project/spatial/instances";
import { duplicateSpatialOccurrence } from "@/project/spatial/duplicate";
import { deleteSpatialOccurrence, detachSpatialOccurrence, inspectSpatialOccurrenceDeletion, occurrenceSubtree } from "@/project/spatial/ownership";
import * as identity from "@/project/spatial/domain";
import { emptySpatialLibrary } from "@/project/spatial/resolve";
import { legacyOccurrence, opaqueOccurrenceFixture } from "./support/spatialOccurrenceIdentityFixture";
import { first, instancesFixture } from "./support/spatialInstancesFixture";
import { invalidAssociations, spatialAssociationsFixture } from "./support/spatialAssociationsFixture";

const repetition = { slotId: spatialId("constructor"), index: 2 };
const formats = [{ name: "compact", write: serialize }, { name: "pretty", write: serializePretty }];
describe.each(formats)("$name occurrence identity", ({ write }) => {
  it("persists complete associations when a new generated tree crosses project IO", () => {
    // Given
    const { project, document, request } = instancesFixture();
    // When
    const loaded = deserialize(write({ ...project, spatialAuthoring: instantiateSpatialDesign(document, project, request) })).spatialAuthoring;
    // Then
    expect(loaded).toBeDefined();
    for (const occurrence of Object.values(loaded?.occurrences ?? {})) {
      expect(occurrence.parentSlot).not.toBeUndefined();
      const node = designNode(occurrence.snapshot.library, occurrence.source);
      expect(occurrence.snapshot.ports.map(port => port.localPortId)).toEqual(nodePorts(node).map(port => port.id));
      if (occurrence.parentId === null) expect(occurrence.parentSlot).toBeNull();
    }
  });

  it("resolves authoritative opaque identities when dictionary and port ordering disagree", () => {
    // Given
    const { project, document, room, desk } = opaqueOccurrenceFixture();
    const reordered = { ...document, occurrences: Object.fromEntries(Object.entries(document.occurrences).reverse()) };
    // When
    const loaded = deserialize(write({ ...project, spatialAuthoring: reordered })).spatialAuthoring;
    // Then
    if (!loaded) throw new TypeError("Missing fixture document");
    expect(identity.findOccurrenceChildId(loaded, room, repetition)).toBe(desk);
    expect(identity.findOccurrenceChildId(loaded, room, { ...repetition, index: 1 })).toBeUndefined();
    expect(identity.resolveOccurrencePortId(own(loaded.occurrences, room), spatialId("room-door"))).toBe("opaque-port-A");
    expect(identity.resolveOccurrencePortId(own(loaded.occurrences, room), spatialId("terrainTemplates"))).toBe("opaque-port-B");
  });

  it("preserves only the surviving repetition when a nested copy is copied after source and kit removal", () => {
    // Given
    const { project, document, room, otherDesk, desk } = opaqueOccurrenceFixture();
    const deleted = deleteSpatialOccurrence(document, project, { occurrenceId: otherDesk, externalConnections: "remove" });
    const orphaned = { ...deleted, library: emptySpatialLibrary() };
    for (const tileset of Object.values(project.tilesets)) tileset.structureKits = [];
    const copy = duplicateSpatialOccurrence(orphaned, project, { occurrenceId: room, rootId: "copy", externalConnections: "omit" });
    // When
    const result = duplicateSpatialOccurrence(copy, project, { occurrenceId: spatialId("copy"), rootId: "again", externalConnections: "omit" });
    const loaded = deserialize(write({ ...project, spatialAuthoring: result })).spatialAuthoring;
    // Then
    if (!loaded) throw new TypeError("Missing fixture document");
    const root = own(loaded.occurrences, "again");
    const child = identity.findOccurrenceChildId(loaded, root.id, repetition);
    expect(occurrenceSubtree(loaded, root.id)).toHaveLength(2);
    expect(identity.findOccurrenceChildId(loaded, root.id, { ...repetition, index: 0 })).toBeUndefined();
    expect(identity.findOccurrenceChildId(loaded, root.id, { ...repetition, index: 1 })).toBeUndefined();
    expect(root.parentSlot).toBeNull();
    expect(root.bindings).toEqual([]);
    expect(child).toBe(occurrenceChildId(root.id, repetition.slotId, repetition.index));
    if (!child) throw new TypeError("Missing surviving child");
    expect(own(loaded.occurrences, child).snapshot.library).toEqual(own(document.occurrences, desk).snapshot.library);
    expect(own(loaded.occurrences, child).snapshot.kitCells).toEqual(own(document.occurrences, desk).snapshot.kitCells);
    expect(own(loaded.occurrences, child).parentSlot).toEqual(repetition);
    expect(root.snapshot.ports.map(port => port.localPortId)).toEqual(["terrainTemplates", "room-door"]);
  });

  it.each(["omit", "copy"] as const)("remaps the exact external endpoint when an opaque nested root uses %s", externalConnections => {
    // Given
    const { project, document, room, otherRoom } = opaqueOccurrenceFixture();
    // When
    const copied = duplicateSpatialOccurrence(document, project, { occurrenceId: room, rootId: "copy", externalConnections });
    const loaded = deserialize(write({ ...project, spatialAuthoring: copied })).spatialAuthoring;
    // Then
    if (!loaded) throw new TypeError("Missing fixture document");
    const links = loaded.connections.filter(link => link.from.occurrenceId === "copy");
    expect(links.map(link => ({ from: link.from, to: link.to }))).toEqual(externalConnections === "omit" ? [] : [{
      from: { occurrenceId: "copy", portId: identity.resolveOccurrencePortId(own(loaded.occurrences, "copy"), spatialId("terrainTemplates")) },
      to: { occurrenceId: otherRoom, portId: spatialId("opaque-other-A") },
    }]);
  });

  it("remaps opaque internal links when copying their common parent", () => {
    // Given
    const { project, document, place } = opaqueOccurrenceFixture();
    // When
    const copied = duplicateSpatialOccurrence(document, project, { occurrenceId: place, rootId: "copy", externalConnections: "omit" });
    // Then
    const root = spatialId("copy");
    const left = identity.findOccurrenceChildId(copied, root, { slotId: spatialId("guest-b"), index: 0 });
    const right = identity.findOccurrenceChildId(copied, root, { slotId: spatialId("guest-a"), index: 0 });
    if (!left || !right) throw new TypeError("Missing fixture children");
    expect(copied.connections.slice(document.connections.length).map(link => [link.from, link.to])).toEqual([[
      { occurrenceId: left, portId: identity.resolveOccurrencePortId(own(copied.occurrences, left), spatialId("terrainTemplates")) },
      { occurrenceId: right, portId: identity.resolveOccurrencePortId(own(copied.occurrences, right), spatialId("room-door")) },
    ]]);
  });

  it("retains generated slot and port addresses when a full tree is duplicated twice", () => {
    // Given
    const { project, document, request } = instancesFixture();
    const original = instantiateSpatialDesign(document, project, request);
    const copy = duplicateSpatialOccurrence(original, project, { occurrenceId: spatialId(request.rootId), rootId: "copy", externalConnections: "omit" });
    // When
    const result = duplicateSpatialOccurrence(copy, project, { occurrenceId: spatialId("copy"), rootId: "copy-again", externalConnections: "omit" });
    const loaded = deserialize(write({ ...project, spatialAuthoring: result })).spatialAuthoring;
    // Then
    if (!loaded) throw new TypeError("Missing fixture document");
    for (const id of occurrenceSubtree(loaded, spatialId("copy-again"))) {
      const occurrence = own(loaded.occurrences, id);
      const node = designNode(occurrence.snapshot.library, occurrence.source);
      for (const port of nodePorts(node)) expect(occurrence.snapshot.ports.find(value => value.id === occurrencePortId(id, port.id))?.localPortId).toBe(port.id);
      for (const slot of designSlots(node)) for (let index = 0; index < slot.quantity; index++) {
        expect(own(loaded.occurrences, occurrenceChildId(id, slot.id, index)).parentSlot).toEqual({ slotId: slot.id, index });
      }
    }
  });

  it.each(["root", "descendant"] as const)("requires associations only in the target when a %s is legacy", target => {
    // Given
    const { project, document, room, desk } = opaqueOccurrenceFixture();
    const id = target === "root" ? room : desk;
    const mixed = { ...document, occurrences: { ...document.occurrences, [id]: legacyOccurrence(document, id) } };
    const loaded = deserialize(write({ ...project, spatialAuthoring: mixed })).spatialAuthoring;
    if (!loaded) throw new TypeError("Missing fixture document");
    // When
    const action = () => duplicateSpatialOccurrence(loaded, project, { occurrenceId: room, rootId: "copy", externalConnections: "omit" });
    // Then
    expect(action).toThrow(new identity.SpatialOperationError("association-required", `occurrences.${id}`));
    expect(loaded).toEqual(mixed);
  });

  it.each(["parent", "child", "sibling"] as const)("rejects ambiguous slot lookup when its %s lacks associations", target => {
    // Given
    const { document, room, desk, otherDesk } = opaqueOccurrenceFixture();
    const id = target === "parent" ? room : target === "child" ? desk : otherDesk;
    const mixed = { ...document, occurrences: { ...document.occurrences, [id]: legacyOccurrence(document, id) } };
    // When
    const action = () => identity.findOccurrenceChildId(mixed, room, repetition);
    // Then
    expect(action).toThrow(new identity.SpatialOperationError("association-required", `occurrences.${id}`));
  });

  it("rejects local lookup with a typed error when its occurrence is legacy", () => {
    // Given
    const { document, room } = opaqueOccurrenceFixture();
    const legacy = legacyOccurrence(document, room);
    // When
    const action = () => identity.resolveOccurrencePortId(legacy, spatialId("room-door"));
    // Then
    expect(action).toThrow(new identity.SpatialOperationError("association-required", `occurrences.${room}`));
  });

  it("reports a missing local port instead of inventing an address when the target is complete", () => {
    // Given
    const { document, room } = opaqueOccurrenceFixture();
    // When
    const action = () => identity.resolveOccurrencePortId(own(document.occurrences, room), spatialId("absent"));
    // Then
    expect(action).toThrow(new identity.SpatialOperationError("missing", `occurrences.${room}.snapshot.ports.absent`));
  });

  it("allows new complete roots when an unrelated legacy root lacks metadata", () => {
    // Given
    const { project, document, request } = instancesFixture();
    const placed = instantiateSpatialDesign(document, project, request);
    const mixed = { ...placed, occurrences: { ...placed.occurrences, [request.rootId]: legacyOccurrence(placed, request.rootId) } };
    const result = instantiateSpatialDesign(mixed, project, { ...request, rootId: "complete" });
    // When
    const copied = duplicateSpatialOccurrence(result, project, { occurrenceId: spatialId("complete"), rootId: "copy", externalConnections: "omit" });
    // Then
    expect(deserialize(write({ ...project, spatialAuthoring: copied })).spatialAuthoring?.occurrences[request.rootId]).toEqual(mixed.occurrences[request.rootId]);
    expect(copied.occurrences.copy?.parentSlot).toBeNull();
  });

  it.each(invalidAssociations)("rejects $name at the schema boundary when duplicate receives contradictory metadata", ({ change, field }) => {
    // Given
    const fixture = spatialAssociationsFixture();
    change(fixture);
    const before = structuredClone(fixture.document);
    // When
    const action = () => duplicateSpatialOccurrence(fixture.document, fixture.project, { occurrenceId: spatialId(fixture.world.id), rootId: "copy", externalConnections: "omit" });
    // Then
    expect(action).toThrow(ProjectFormatError);
    expect(action).toThrow(`spatialAuthoring.${field.startsWith("library.") ? "" : "occurrences."}${field}`);
    expect(fixture.document).toEqual(before);
  });

  it("releases copied ownership without changing originals when root and descendant have bindings", () => {
    // Given
    const { project, document, request } = instancesFixture();
    const placed = instantiateSpatialDesign(document, project, request);
    const root = own(placed.occurrences, request.rootId);
    const child = first(Object.values(placed.occurrences).filter(value => value.kind === "object"));
    const binding = { mapId: project.startMapId, rect: { x: 1, y: 2, width: 3, height: 4 }, eventIds: ["owned-event"], connectionIds: [], ports: [], contentDigest: "b".repeat(64) };
    const bound = { ...placed, occurrences: { ...placed.occurrences, [root.id]: { ...root, bindings: [binding] },
      [child.id]: { ...child, bindings: [{ ...binding, rect: { x: 8, y: 8, width: 1, height: 1 }, eventIds: [] }] } } };
    // When
    const copied = duplicateSpatialOccurrence(bound, project, { occurrenceId: root.id, rootId: "copy", externalConnections: "omit" });
    // Then
    expect(occurrenceSubtree(copied, spatialId("copy")).flatMap(id => own(copied.occurrences, id).bindings)).toEqual([]);
    expect(copied.occurrences[root.id]).toEqual(bound.occurrences[root.id]);
    expect(copied.occurrences[child.id]).toEqual(bound.occurrences[child.id]);
  });

  it("keeps ownership inspection available when a target is legacy", () => {
    // Given
    const { project, document, room } = opaqueOccurrenceFixture();
    const mixed = { ...document, occurrences: { ...document.occurrences, [room]: legacyOccurrence(document, room) } };
    const before = structuredClone(project.maps);
    // When
    const impact = inspectSpatialOccurrenceDeletion(mixed, project, room);
    // Then
    expect(impact.occurrenceIds).toHaveLength(3);
    expect(project.maps).toEqual(before);
  });

  it.each(["detach", "delete"] as const)("keeps %s available when a target is legacy", operation => {
    // Given
    const { project, document, room } = opaqueOccurrenceFixture();
    const mixed = { ...document, occurrences: { ...document.occurrences, [room]: legacyOccurrence(document, room) } };
    const before = structuredClone(project.maps);
    // When
    const result = operation === "detach" ? detachSpatialOccurrence(mixed, project, room)
      : deleteSpatialOccurrence(mixed, project, { occurrenceId: room, externalConnections: "remove" });
    // Then
    expect(Object.keys(result.occurrences)).toHaveLength(operation === "detach" ? 7 : 4);
    expect(project.maps).toEqual(before);
  });
});
