import { emptySpatialDocument, spatialHierarchyFixture } from "./spatialSchemaFixture";

/** Mutable wire fixtures: deliberately opaque identities, equal payloads, reordered ports/children. */
export function spatialAssociationsFixture() {
  const { project, document: base } = spatialHierarchyFixture();
  const empty = emptySpatialDocument().library;
  const deskDesign = base.library.objects.desk;
  const roomDesign = { ...base.library.spaces.room, objectSlots: [{
    id: "constructor", objectDesignId: "desk", quantity: 3, required: true, placement: { mode: "auto" },
  }], ports: [
    { id: "room-door", name: "Same", x: 0, y: 2 },
    { id: "terrainTemplates", name: "Same", x: 0, y: 2 },
  ] };
  const library = { ...base.library, spaces: { room: roomDesign } };
  const kits = base.occurrences["occ-a"].snapshot.kitCells;
  const common = { x: 0, y: 0, level: 1, seed: 7, generatorVersion: "1", bindings: [] };
  const worldSource = { kind: "world", id: "kingdom", revision: 1 };
  const world = { ...common, id: "opaque-world", kind: "world", parentId: null, parentSlot: null, source: worldSource,
    snapshot: { root: worldSource, library, kitCells: kits, ports: [
      { id: "opaque-world-port", localPortId: "world-door", name: "Door", x: 0, y: 2 },
    ] } };
  const regionSource = { kind: "region", id: "country", revision: 1 };
  const region = { ...common, id: "opaque-region", kind: "region", parentId: world.id,
    parentSlot: { slotId: "country-slot", index: 0 }, source: regionSource,
    snapshot: { root: regionSource, library: { ...library, worlds: {} }, kitCells: kits, ports: [
      { id: "opaque-region-port", localPortId: "country-door", name: "Door", x: 0, y: 2 },
    ] } };
  const placeSource = { kind: "place", id: "inn", revision: 1 };
  const place = { ...common, id: "opaque-place", kind: "place", parentId: region.id,
    parentSlot: { slotId: "inn-b", index: 0 }, source: placeSource,
    snapshot: { root: placeSource, library: { ...library, worlds: {}, regions: {} }, kitCells: kits, ports: [
      { id: "opaque-place-port", localPortId: "inn-door", name: "Door", x: 0, y: 2 },
    ] } };
  const roomSource = { kind: "space", id: "room", revision: 1 };
  const room = { ...common, id: "opaque-room", kind: "space", parentId: place.id,
    parentSlot: { slotId: "guest-b", index: 0 }, source: roomSource,
    snapshot: { root: roomSource, library: { ...empty, objects: { desk: deskDesign }, spaces: { room: roomDesign } }, kitCells: kits,
      ports: [
        { id: "opaque-port-B", localPortId: "terrainTemplates", name: "Same", x: 0, y: 2 },
        { id: "opaque-port-A", localPortId: "room-door", name: "Same", x: 0, y: 2 },
      ] } };
  const otherRoom = { ...structuredClone(room), id: "opaque-other-room", parentSlot: { slotId: "guest-a", index: 0 },
    snapshot: { ...structuredClone(room.snapshot), ports: [
      { id: "opaque-other-A", localPortId: "room-door", name: "Same", x: 0, y: 2 },
      { id: "opaque-other-B", localPortId: "terrainTemplates", name: "Same", x: 0, y: 2 },
    ] } };
  const deskSource = { kind: "object", id: "desk", revision: 1 };
  const desk = { ...common, id: "opaque-desk-C", kind: "object", parentId: room.id,
    parentSlot: { slotId: "constructor", index: 2 }, source: deskSource,
    snapshot: { root: deskSource, library: { ...empty, objects: { desk: deskDesign } }, kitCells: kits, ports: [
      { id: "opaque-anchor-C", localPortId: "desk-anchor", name: "Front", x: 0, y: 0 },
    ] } };
  const otherDesk = { ...structuredClone(desk), id: "opaque-desk-A", parentSlot: { slotId: "constructor", index: 0 },
    snapshot: { ...structuredClone(desk.snapshot), ports: [
      { id: "opaque-anchor-A", localPortId: "desk-anchor", name: "Front", x: 0, y: 0 },
    ] } };
  const document = { ...base, occurrences: {
    [desk.id]: desk, [otherRoom.id]: otherRoom, [region.id]: region, [room.id]: room,
    [world.id]: world, [otherDesk.id]: otherDesk, [place.id]: place,
  }, rootOccurrenceIds: [world.id], connections: [{ id: "opaque-link",
    from: { occurrenceId: room.id, portId: "opaque-port-B" },
    to: { occurrenceId: otherRoom.id, portId: "opaque-other-A" }, bidirectional: true,
  }] };
  for (const occurrence of Object.values(document.occurrences)) {
    Reflect.set(occurrence.snapshot, "library", structuredClone(occurrence.snapshot.library));
    Reflect.set(occurrence.snapshot, "kitCells", structuredClone(occurrence.snapshot.kitCells));
  }
  return { project, document, world, region, place, room, otherRoom, desk, otherDesk };
}

type Fixture = ReturnType<typeof spatialAssociationsFixture>;
export const invalidAssociations: readonly {
  readonly name: string; readonly field: string; readonly change: (fixture: Fixture) => void;
}[] = [
  { name: "root slot", field: "opaque-world.parentSlot", change: f => { Reflect.set(f.world, "parentSlot", { slotId: "country-slot", index: 0 }); } },
  { name: "child null slot", field: "opaque-desk-C.parentSlot", change: f => { Reflect.set(f.desk, "parentSlot", null); } },
  { name: "absent slot id", field: "opaque-desk-C.parentSlot.slotId", change: f => { Reflect.deleteProperty(f.desk.parentSlot, "slotId"); } },
  { name: "blank slot id", field: "opaque-desk-C.parentSlot.slotId", change: f => { f.desk.parentSlot.slotId = " "; } },
  { name: "unknown slot", field: "opaque-desk-C.parentSlot.slotId", change: f => { f.desk.parentSlot.slotId = "toString"; } },
  { name: "extra slot field", field: "opaque-desk-C.parentSlot.extra", change: f => { Reflect.set(f.desk.parentSlot, "extra", 1); } },
  ...[-1, 0.5, Number.MAX_SAFE_INTEGER + 1, 3].map(index => ({
    name: `invalid repetition ${index}`, field: "opaque-desk-C.parentSlot.index", change: (f: Fixture) => { f.desk.parentSlot.index = index; },
  })),
  ...["region", "place", "room"].map(key => ({
    name: `nonobject repetition ${key}`, field: `opaque-${key}.parentSlot.index`, change: (f: Fixture) => {
      const child = key === "region" ? f.region : key === "place" ? f.place : f.room;
      child.parentSlot.index = 1;
    },
  })),
  { name: "duplicate repetition", field: "opaque-desk-A.parentSlot", change: f => { f.otherDesk.parentSlot.index = 2; } },
  { name: "duplicate child slot", field: "opaque-room.parentSlot", change: f => { f.otherRoom.parentSlot.slotId = "guest-b"; } },
  { name: "source id mismatch", field: "opaque-desk-C.parentSlot.slotId", change: f => {
    const object = { ...f.room.snapshot.library.objects.desk, id: "other-desk" };
    Reflect.set(f.room.snapshot.library.objects, object.id, object);
    Reflect.set(f.room.snapshot.kitCells, object.id, f.room.snapshot.kitCells.desk);
    f.room.snapshot.library.spaces.room.objectSlots.push({ ...f.room.snapshot.library.spaces.room.objectSlots[0],
      id: "other-slot", objectDesignId: object.id, quantity: 1, required: true, placement: { mode: "auto" },
    });
    f.desk.parentSlot.slotId = "other-slot";
    f.desk.parentSlot.index = 0;
  } },
  { name: "source kind mismatch", field: "opaque-room.parentSlot.slotId", change: f => {
    const terminal = { ...f.place.snapshot.library.places.inn, id: "terminal", children: [], connections: [], ports: [] };
    Reflect.set(f.place.snapshot.library.places, terminal.id, terminal);
    f.place.snapshot.library.places.inn.children.push({ id: "place-slot", source: { kind: "place", id: terminal.id }, x: 0, y: 0, level: 1 });
    f.room.parentSlot.slotId = "place-slot";
  } },
  { name: "missing local id", field: "opaque-room.snapshot.ports[0].localPortId", change: f => { Reflect.deleteProperty(f.room.snapshot.ports[0], "localPortId"); } },
  { name: "blank local id", field: "opaque-room.snapshot.ports[0].localPortId", change: f => { Reflect.set(f.room.snapshot.ports[0], "localPortId", ""); } },
  { name: "null local id", field: "opaque-room.snapshot.ports[0].localPortId", change: f => { Reflect.set(f.room.snapshot.ports[0], "localPortId", null); } },
  { name: "unknown local id", field: "opaque-room.snapshot.ports[0].localPortId", change: f => { Reflect.set(f.room.snapshot.ports[0], "localPortId", "toString"); } },
  { name: "foreign root port", field: "opaque-room.snapshot.ports[0].localPortId", change: f => { Reflect.set(f.room.snapshot.ports[0], "localPortId", "desk-anchor"); } },
  { name: "live-only port", field: "opaque-room.snapshot.ports[0].localPortId", change: f => {
    f.document.library.spaces.room.ports.push({ id: "live-only", name: "Door", x: 0, y: 2 });
    Reflect.set(f.room.snapshot.ports[0], "localPortId", "live-only");
  } },
  { name: "duplicate local id", field: "opaque-room.snapshot.ports[1].localPortId", change: f => { Reflect.set(f.room.snapshot.ports[1], "localPortId", "terrainTemplates"); } },
  { name: "missing named port coverage", field: "opaque-room.snapshot.ports", change: f => { f.room.snapshot.ports.splice(1, 1); } },
  { name: "local ids without parentSlot", field: "opaque-room.snapshot.ports[0].localPortId", change: f => { Reflect.deleteProperty(f.room, "parentSlot"); } },
  { name: "local metadata on design port", field: "library.spaces.room.ports[0].localPortId", change: f => { Reflect.set(f.document.library.spaces.room.ports[0], "localPortId", "room-door"); } },
];
