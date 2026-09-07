import { assert } from "../io/guards";
import { resolveSpatialGraphic } from "./assets";
import { validateOccurrencePorts, validateParentSlot } from "./associations";
import { isOwnedSpatialBinding } from "./bindings";
import type * as S from "./types";

type Design = S.ObjectDesign | S.SpaceDesign | S.PlaceDesign | S.RegionDesign | S.WorldDesign;
type Edge = { readonly id: S.SpatialId; readonly path: string };
type LibraryContext = { readonly assets: S.SpatialAssetContext; readonly frozen: boolean; readonly path: string };
function own<T>(records: Readonly<Record<string, T>>, id: string, path: string): T {
  const value = Object.hasOwn(records, id) ? records[id] : undefined;
  assert(value !== undefined, `${path}: missing reference ${id}`);
  return value;
}
function unique(ids: readonly string[], path: string): void {
  const seen = new Set<string>();
  ids.forEach((id, i) => { assert(!seen.has(id), `${path}[${i}]: duplicate ID ${id}`); seen.add(id); });
}
function contains(rect: S.SpatialRect, point: S.SpatialPoint): boolean {
  return point.x >= rect.x && point.y >= rect.y && point.x < rect.x + rect.width && point.y < rect.y + rect.height;
}
function bounds(points: readonly S.SpatialPoint[], size: { readonly width: number; readonly height: number }, path: string): void {
  points.forEach((point, i) => assert(contains({ ...size, x: 0, y: 0 }, point), `${path}[${i}]: outside bounds`));
}
function areas(entries: readonly S.SpatialFloorArea[], size: { readonly width: number; readonly height: number }, path: string): void {
  for (const [i, area] of entries.entries()) {
    switch (area.kind) {
      case "rect": bounds([area, { x: area.x + area.width - 1, y: area.y + area.height - 1 }], size, `${path}[${i}]`); break;
      case "polygon": bounds(area.points, size, `${path}[${i}].points`); break;
      default: assertNever(area);
    }
  }
}
function design(library: S.SpatialLibrary, ref: S.SpatialDesignReference, path: string): Design {
  const collections = { object: library.objects, space: library.spaces, place: library.places, region: library.regions, world: library.worlds };
  return own<Design>(collections[ref.kind], ref.id, path);
}
function designPorts(value: Design): readonly S.SpatialPort[] { return "anchors" in value ? value.anchors : value.ports; }
function graphic(ref: S.SpatialGraphic, context: LibraryContext, path: string): void {
  own(context.assets.tilesets, ref.tilesetId, `${path}.tilesetId`);
  if (!context.frozen) assert(resolveSpatialGraphic(context.assets, ref) !== undefined, `${path}.kitId: missing reference ${ref.kitId}`);
}
/** Iterative design-DAG check: repeated references are edges, not cycles or additional parents. */
function acyclic(edges: ReadonlyMap<S.SpatialId, readonly Edge[]>): void {
  const incoming = new Map<S.SpatialId, number>([...edges.keys()].map(id => [id, 0]));
  for (const children of edges.values()) for (const child of children) incoming.set(child.id, (incoming.get(child.id) ?? 0) + 1);
  const queue = [...incoming].filter(([, count]) => count === 0).map(([id]) => id);
  for (const id of queue) {
    for (const child of edges.get(id) ?? []) {
      const count = (incoming.get(child.id) ?? 0) - 1;
      incoming.set(child.id, count);
      if (count === 0) queue.push(child.id);
    }
  }
  for (const children of edges.values()) for (const child of children) assert(incoming.get(child.id) === 0, `${child.path}: containment cycle`);
}
function validateLibrary(library: S.SpatialLibrary, context: LibraryContext): ReadonlyMap<S.SpatialId, readonly Edge[]> {
  const edges = new Map<S.SpatialId, readonly Edge[]>();
  for (const [collection, records] of Object.entries(library)) for (const [key, value] of Object.entries<Design>(records)) {
    const path = `${context.path}.${collection}.${key}`;
    assert(key === value.id, `${path}.id: collection key mismatch`);
    assert(!edges.has(value.id), `${path}: duplicate design ID`);
    edges.set(value.id, []);
    unique(designPorts(value).map(port => port.id), `${path}.ports`);
  }
  const children = (parent: Design, slots: readonly S.SpatialChildSlot<S.SpatialKind>[], path: string) => {
    unique(slots.map(slot => slot.id), path);
    edges.set(parent.id, slots.map((slot, i) => { design(library, slot.source, `${path}[${i}].source`); return { id: slot.source.id, path: `${path}[${i}].source` }; }));
  };
  const local = (parent: Design, slots: readonly S.SpatialChildSlot<S.SpatialKind>[]) => (endpoint: S.SpatialLocalEndpoint, path: string) => {
    const slot = slots.find(slot => slot.id === endpoint.childId);
    assert(endpoint.childId === null || slot !== undefined, `${path}.childId: missing owned child`);
    const target = slot ? design(library, slot.source, path) : parent;
    assert(designPorts(target).some(port => port.id === endpoint.portId), `${path}.portId: missing owned port`);
  };
  for (const object of Object.values(library.objects)) graphic(object.graphic, context, `${context.path}.objects.${object.id}.graphic`);
  for (const space of Object.values(library.spaces)) {
    const path = `${context.path}.spaces.${space.id}`;
    own(context.assets.tilesets, space.tilesetId, `${path}.tilesetId`);
    unique(space.objectSlots.map(slot => slot.id), `${path}.objectSlots`);
    edges.set(space.id, space.objectSlots.map((slot, i) => {
      own(library.objects, slot.objectDesignId, `${path}.objectSlots[${i}].objectDesignId`);
      switch (slot.placement.mode) {
        case "fixed": bounds([slot.placement], space, `${path}.objectSlots[${i}].placement`); break;
        case "auto": break;
        default: assertNever(slot.placement);
      }
      return { id: slot.objectDesignId, path: `${path}.objectSlots[${i}].objectDesignId` };
    }));
    bounds(space.ports, space, `${path}.ports`);
    switch (space.environment) {
      case "outdoor": assert(space.floorAreas.length > 0, `${path}.floorAreas: outdoor floor required`); areas(space.floorAreas, space, `${path}.floorAreas`); break;
      case "interior": break;
      default: assertNever(space);
    }
  }
  for (const place of Object.values(library.places)) {
    const path = `${context.path}.places.${place.id}`;
    children(place, place.children, `${path}.children`);
    switch (place.kind) {
      case "facility": place.children.forEach((slot, i) => assert(slot.level >= 1 && slot.level <= 3, `${path}.children[${i}].level: facility supports floors 1..3`)); break;
      case "settlement": case "natural": break;
      default: assertNever(place.kind);
    }
    unique(place.connections.map(connection => connection.id), `${path}.connections`);
    place.connections.forEach((connection, i) => { local(place, place.children)(connection.from, `${path}.connections[${i}].from`); local(place, place.children)(connection.to, `${path}.connections[${i}].to`); });
    if (place.exterior) graphic(place.exterior, context, `${path}.exterior`);
  }
  const overviews: readonly (S.RegionDesign | S.WorldDesign)[] = [...Object.values(library.regions), ...Object.values(library.worlds)];
  for (const value of overviews) {
    const path = `${context.path}.${"places" in value ? "regions" : "worlds"}.${value.id}`;
    const slots = "places" in value ? value.places : value.regions;
    const links = "routes" in value ? value.routes : value.connections;
    const slotField = "places" in value ? "places" : "regions";
    const linkField = "routes" in value ? "routes" : "connections";
    children(value, slots, `${path}.${slotField}`);
    own(context.assets.tilesets, value.terrain.tilesetId, `${path}.terrain.tilesetId`);
    bounds(slots, value.terrain, `${path}.${slotField}`);
    bounds(value.ports, value.terrain, `${path}.ports`);
    areas(value.terrain.areas, value.terrain, `${path}.terrain.areas`);
    unique(links.map(link => link.id), `${path}.${linkField}`);
    links.forEach((link, i) => { local(value, slots)(link.from, `${path}.${linkField}[${i}].from`); local(value, slots)(link.to, `${path}.${linkField}[${i}].to`); });
    if ("routes" in value) value.routes.forEach((route, i) => bounds(route.points, value.terrain, `${path}.routes[${i}].points`));
    if ("entryPort" in value) local(value, slots)(value.entryPort, `${path}.entryPort`);
  }
  acyclic(edges);
  return edges;
}
function validateSnapshot(occurrence: S.SpatialOccurrence, assets: S.SpatialAssetContext, path: string): void {
  const snapshot = occurrence.snapshot;
  const edges = validateLibrary(snapshot.library, { assets, frozen: true, path: `${path}.library` });
  const root = design(snapshot.library, snapshot.root, `${path}.root`);
  validateOccurrencePorts(occurrence, designPorts(root));
  assert(root.revision === snapshot.root.revision, `${path}.root.revision: snapshot revision mismatch`);
  assert(snapshot.root.kind === occurrence.source.kind && snapshot.root.id === occurrence.source.id && snapshot.root.revision === occurrence.source.revision, `${path}.root: occurrence source mismatch`);
  const reachable = new Set<S.SpatialId>([root.id]);
  for (const id of reachable) for (const child of edges.get(id) ?? []) reachable.add(child.id);
  assert(reachable.size === edges.size, `${path}.library: snapshot contains unrelated designs`);
  const graphics = new Map<string, S.SpatialGraphic>(Object.values(snapshot.library.objects).map(object => [object.id, object.graphic]));
  for (const place of Object.values(snapshot.library.places)) if (place.exterior) graphics.set(place.id, place.exterior);
  for (const [id, kit] of Object.entries(snapshot.kitCells)) {
    const graphic = graphics.get(id);
    assert(graphic !== undefined, `${path}.kitCells.${id}: missing graphic owner`);
    assert(graphic.tilesetId === kit.tilesetId && graphic.kitId === kit.kitId, `${path}.kitCells.${id}: graphic mismatch`);
    const tileset = own(assets.tilesets, kit.tilesetId, `${path}.kitCells.${id}.tilesetId`);
    bounds(kit.cells, kit, `${path}.kitCells.${id}.cells`);
    kit.cells.forEach((cell, i) => assert(cell.tile < tileset.count, `${path}.kitCells.${id}.cells[${i}].tile: outside atlas`));
  }
  for (const id of graphics.keys()) own(snapshot.kitCells, id, `${path}.kitCells.${id}`);
}
const allowedChildren: Readonly<Record<S.SpatialKind, readonly S.SpatialKind[]>> = { object: [], space: ["object"], place: ["space", "place"], region: ["place"], world: ["region"] };
export function validateSpatialReferences(document: S.SpatialAuthoringDocument, assets: S.SpatialAssetContext): void {
  const p = "spatialAuthoring";
  const libraryEdges = validateLibrary(document.library, { assets, frozen: false, path: `${p}.library` });
  const ids = new Set<string>(libraryEdges.keys());
  const register = (id: string, path: string) => { assert(!ids.has(id), `${path}: duplicate global ID ${id}`); ids.add(id); };
  const containment = new Map<S.SpatialId, readonly Edge[]>();
  unique(document.rootOccurrenceIds, `${p}.rootOccurrenceIds`);
  for (const id of document.rootOccurrenceIds) assert(own(document.occurrences, id, `${p}.rootOccurrenceIds`).parentId === null, `${p}.rootOccurrenceIds: root is also contained`);
  for (const [key, occurrence] of Object.entries(document.occurrences)) {
    const path = `${p}.occurrences.${key}`;
    assert(key === occurrence.id, `${path}.id: collection key mismatch`);
    register(occurrence.id, `${path}.id`);
    assert((occurrence.parentId === null) === document.rootOccurrenceIds.includes(occurrence.id), `${p}.rootOccurrenceIds: root membership mismatch at ${path}`);
    if (occurrence.parentId !== null) {
      const parent = own(document.occurrences, occurrence.parentId, `${path}.parentId`);
      assert(allowedChildren[parent.kind].includes(occurrence.kind), `${path}.parentId: illegal containment kind`);
    }
    containment.set(occurrence.id, occurrence.parentId === null ? [] : [{ id: occurrence.parentId, path: `${path}.parentId` }]);
    validateSnapshot(occurrence, assets, `${path}.snapshot`);
    for (const port of occurrence.snapshot.ports) register(port.id, `${path}.snapshot.ports`);
  }
  acyclic(containment);
  const occupied = new Set<string>();
  for (const occurrence of Object.values(document.occurrences)) {
    if (occurrence.parentSlot === undefined || occurrence.parentId === null) continue;
    const path = `${p}.occurrences.${occurrence.id}.parentSlot`;
    const parent = own(document.occurrences, occurrence.parentId, path);
    validateParentSlot(occurrence, design(parent.snapshot.library, parent.snapshot.root, path), occupied);
  }
  document.connections.forEach((connection, i) => {
    const path = `${p}.connections[${i}]`;
    register(connection.id, `${path}.id`);
    for (const side of ["from", "to"] as const) {
      const endpoint = connection[side];
      const occurrence = own(document.occurrences, endpoint.occurrenceId, `${path}.${side}.occurrenceId`);
      assert(occurrence.snapshot.ports.some(port => port.id === endpoint.portId), `${path}.${side}.portId: missing owned port`);
    }
  });
  const ownedRects = new Map<string, S.SpatialRect[]>();
  const ownedEvents = new Map<string, Set<string>>();
  for (const occurrence of Object.values(document.occurrences)) {
    const boundPorts = new Set<string>();
    occurrence.bindings.forEach((binding, i) => {
      const path = `${p}.occurrences.${occurrence.id}.bindings[${i}]`;
      const map = own(assets.maps, binding.mapId, `${path}.mapId`);
      bounds([binding.rect, { x: binding.rect.x + binding.rect.width - 1, y: binding.rect.y + binding.rect.height - 1 }], map, `${path}.rect`);
      for (const port of binding.ports) {
        assert(occurrence.snapshot.ports.some(owned => owned.id === port.portId) && contains(binding.rect, port), `${path}.ports: missing or out-of-bounds owned port`);
        assert(!boundPorts.has(port.portId), `${path}.ports: duplicate port binding`); boundPorts.add(port.portId);
      }
      if (!isOwnedSpatialBinding(binding)) return;
      const rects = ownedRects.get(map.id) ?? [];
      for (const rect of rects) assert(binding.rect.x + binding.rect.width <= rect.x || rect.x + rect.width <= binding.rect.x || binding.rect.y + binding.rect.height <= rect.y || rect.y + rect.height <= binding.rect.y, `${path}.rect: overlapping ownership`);
      ownedRects.set(map.id, [...rects, binding.rect]);
      const events = ownedEvents.get(map.id) ?? new Set<string>();
      for (const id of binding.eventIds) {
        const event = map.events.find(event => event.id === id);
        assert(event !== undefined && contains(binding.rect, event), `${path}.eventIds: missing owned event ${id}`);
        assert(!events.has(id), `${path}.eventIds: duplicate event ownership ${id}`); events.add(id);
      }
      ownedEvents.set(map.id, events);
      unique(binding.connectionIds, `${path}.connectionIds`);
      for (const id of binding.connectionIds) assert(document.connections.some(connection => connection.id === id && (connection.from.occurrenceId === occurrence.id || connection.to.occurrenceId === occurrence.id)), `${path}.connectionIds: missing owned connection ${id}`);
    });
  }
  unique(document.legacyImport.mapping.map(entry => entry.sourceKey), `${p}.legacyImport.mapping`);
}
function assertNever(value: never): never { throw new TypeError(`Unreachable spatial variant: ${String(value)}`); }
