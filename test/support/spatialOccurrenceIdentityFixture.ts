import assert from "node:assert/strict";
import { deserialize } from "../../src/project/io";
import { own, spatialId } from "../../src/project/spatial/domain";
import { spatialAssociationsFixture } from "./spatialAssociationsFixture";
import { spatialWire } from "./spatialSchemaFixture";

/** Independent task31 wire input: equal repetitions, equal port payloads, opaque/reordered IDs. */
export function opaqueOccurrenceFixture() {
  const raw = spatialAssociationsFixture();
  const project = deserialize(spatialWire(raw.project, raw.document));
  const document = project.spatialAuthoring;
  assert.ok(document);
  return { project, document, world: spatialId(raw.world.id), place: spatialId(raw.place.id),
    room: spatialId(raw.room.id), otherRoom: spatialId(raw.otherRoom.id),
    desk: spatialId(raw.desk.id), otherDesk: spatialId(raw.otherDesk.id) };
}

/** Remove only the discriminator and local associations, not any historical payload. */
export function legacyOccurrence(document: ReturnType<typeof opaqueOccurrenceFixture>["document"], id: string) {
  const original = own(document.occurrences, id);
  const { parentSlot: _parentSlot, snapshot, ...occurrence } = original;
  const ports = snapshot.ports.map(({ localPortId: _localPortId, ...port }) => port);
  return { ...occurrence, snapshot: { ...snapshot, ports } };
}
