import { assert } from "../io/guards";
import type * as S from "./types";

type Design = S.SpatialLibrary[keyof S.SpatialLibrary][string];

/** Associations address the frozen root, never equal payloads, array positions or live designs. */
export function validateOccurrencePorts(occurrence: S.SpatialOccurrence, namedPorts: readonly S.SpatialPort[]): void {
  if (occurrence.parentSlot === undefined) return;
  const path = `spatialAuthoring.occurrences.${occurrence.id}.snapshot.ports`;
  const expected = new Set(namedPorts.map(port => port.id));
  const seen = new Set<S.SpatialId>();
  occurrence.snapshot.ports.forEach((port, index) => {
    assert(expected.has(port.localPortId), `${path}[${index}].localPortId: missing frozen root port ${port.localPortId}`);
    assert(!seen.has(port.localPortId), `${path}[${index}].localPortId: duplicate local port ${port.localPortId}`);
    seen.add(port.localPortId);
  });
  assert(seen.size === expected.size, `${path}: incomplete frozen named-port coverage`);
}

/** The occupied set accumulates actual children only; absent repetitions are legitimate deletions. */
export function validateParentSlot(occurrence: S.SpatialAssociatedOccurrence, root: Design, occupied: Set<string>): void {
  if (occurrence.parentSlot === null) return;
  const path = `spatialAuthoring.occurrences.${occurrence.id}.parentSlot`;
  const association = occurrence.parentSlot;
  // Design records have distinct structural child collections (objects have none).
  const childSlots = "children" in root ? root.children : "places" in root ? root.places : "regions" in root ? root.regions : [];
  const objectSlot = "objectSlots" in root ? root.objectSlots.find(slot => slot.id === association.slotId) : undefined;
  const childSlot = childSlots.find(slot => slot.id === association.slotId);
  const source = objectSlot ? { kind: "object", id: objectSlot.objectDesignId } : childSlot?.source;
  assert(source !== undefined, `${path}.slotId: missing frozen parent slot ${association.slotId}`);
  assert(source.kind === occurrence.source.kind && source.id === occurrence.source.id, `${path}.slotId: occurrence source does not match frozen parent slot`);
  assert(association.index < (objectSlot?.quantity ?? 1), `${path}.index: outside frozen slot quantity`);
  const key = JSON.stringify([occurrence.parentId, association.slotId, association.index]);
  assert(!occupied.has(key), `${path}: duplicate parent slot index`);
  occupied.add(key);
}
