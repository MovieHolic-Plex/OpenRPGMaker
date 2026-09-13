import { assert } from "../io/guards";
import type * as S from "./types";
import { boolean, choice, concreteEndpoint, coordinate, dictionary, digest, id, ids, integer, list, nullableId,
  overviewEntries, overviewRoute, point, positive, record, rect, size, text, texts, vertex, type Parser } from "./guardValues";

const kind = choice(["object", "space", "place", "region", "world"] as const);
const port: Parser<S.SpatialPort> = (v, p) => {
  const r = record(v, p, "id name x y");
  return { ...point(r, p), id: id(r.id, `${p}.id`), name: text(r.name, `${p}.name`) };
};
const occurrencePort: Parser<S.SpatialOccurrencePort> = (v, p) => {
  const r = record(v, p, "id name x y localPortId");
  return { ...port({ id: r.id, name: r.name, x: r.x, y: r.y }, p), localPortId: id(r.localPortId, `${p}.localPortId`) };
};
const ports: Parser<readonly S.SpatialPort[]> = (v, p) => list(v, p, port);
const graphic: Parser<S.SpatialGraphic> = (v, p) => {
  const r = record(v, p, "tilesetId kitId");
  return { tilesetId: id(r.tilesetId, `${p}.tilesetId`), kitId: id(r.kitId, `${p}.kitId`) };
};
const provenance: Parser<S.SpatialProvenance> = (v, p) => {
  const r = record(v, p, "origin sourceId");
  return { origin: choice(["user", "builtin", "legacy", "ai"] as const)(r.origin, `${p}.origin`), ...(r.sourceId === undefined ? {} : { sourceId: text(r.sourceId, `${p}.sourceId`) }) };
};
const base: Parser<S.SpatialDesignBase> = (v, p) => {
  const r = record(v, p);
  return { id: id(r.id, `${p}.id`), name: text(r.name, `${p}.name`), revision: positive(r.revision, `${p}.revision`), tags: texts(r.tags, `${p}.tags`), provenance: provenance(r.provenance, `${p}.provenance`) };
};
const baseFields = "id name revision tags provenance";
const object: Parser<S.ObjectDesign> = (v, p) => {
  const r = record(v, p, `${baseFields} graphic anchors chips exteriorStories`);
  return { ...base(r, p), ...(r.exteriorStories === undefined ? {} : { exteriorStories: choice([1, 2, 3, 4] as const)(r.exteriorStories, `${p}.exteriorStories`) }), graphic: graphic(r.graphic, `${p}.graphic`), anchors: ports(r.anchors, `${p}.anchors`), chips: texts(r.chips, `${p}.chips`) };
};
const placement: Parser<S.SpatialObjectSlot["placement"]> = (v, p) => {
  const r = record(v, p);
  const mode = choice(["auto", "fixed"] as const)(r.mode, `${p}.mode`);
  switch (mode) {
    case "auto": record(r, p, "mode"); return { mode };
    case "fixed": record(r, p, "mode x y wallOverlap"); return { mode, ...point(r, p), ...(r.wallOverlap === undefined ? {} : { wallOverlap: choice([1, 2] as const)(r.wallOverlap, `${p}.wallOverlap`) }) };
    default: return assertNever(mode);
  }
};
const objectSlot: Parser<S.SpatialObjectSlot> = (v, p) => {
  const r = record(v, p, "id objectDesignId quantity required placement chipOverrides");
  return { id: id(r.id, `${p}.id`), objectDesignId: id(r.objectDesignId, `${p}.objectDesignId`), quantity: positive(r.quantity, `${p}.quantity`), required: boolean(r.required, `${p}.required`), placement: placement(r.placement, `${p}.placement`), ...(r.chipOverrides === undefined ? {} : { chipOverrides: texts(r.chipOverrides, `${p}.chipOverrides`) }) };
};
const area: Parser<S.SpatialFloorArea> = (v, p) => {
  const r = record(v, p);
  const areaKind = choice(["rect", "polygon"] as const)(r.kind, `${p}.kind`);
  const material = text(r.material, `${p}.material`);
  switch (areaKind) {
    case "rect": record(r, p, "kind material x y width height"); return { kind: areaKind, material, ...rect({ x: r.x, y: r.y, width: r.width, height: r.height }, p) };
    case "polygon": {
      record(r, p, "kind material points");
      const points = list(r.points, `${p}.points`, vertex);
      assert(points.length >= 3, `${p}.points: polygon needs at least three points`);
      return { kind: areaKind, material, points };
    }
    default: return assertNever(areaKind);
  }
};
const composition: Parser<S.SpatialComposition> = (v, p) => {
  const r = record(v, p, "tilesetId width height tiles members");
  return { tilesetId: id(r.tilesetId, `${p}.tilesetId`), width: size(r.width, `${p}.width`), height: size(r.height, `${p}.height`),
    tiles: list(r.tiles, `${p}.tiles`, (v, p) => {
      const cell = record(v, p, "x y layer tile");
      return { ...point(cell, p), layer: choice(["lower", "upper"] as const)(cell.layer, `${p}.layer`), tile: integer([-1, Number.MAX_SAFE_INTEGER])(cell.tile, `${p}.tile`) };
    }), members: list(r.members, `${p}.members`, (v, p) => child(kind)(v, p)) };
};
const composable = (r: Record<string, unknown>, p: string): S.SpatialComposable => r.composition === undefined ? {} : { composition: composition(r.composition, `${p}.composition`) };
const interiorLayout: Parser<S.SpatialInteriorLayout> = (v, p) => {
  const r = record(v, p, "rooms doorways");
  const rooms = list(r.rooms, `${p}.rooms`, (v, p) => {
    const r = record(v, p, "id name x y width height");
    return { ...rect({ x: r.x, y: r.y, width: r.width, height: r.height }, p), id: id(r.id, `${p}.id`), name: text(r.name, `${p}.name`) };
  });
  assert(rooms.length >= 2, `${p}.rooms: at least two rooms required`);
  assert(new Set(rooms.map(room => room.id)).size === rooms.length, `${p}.rooms: duplicate id`);
  return { rooms, doorways: list(r.doorways, `${p}.doorways`, (v, p) => point(record(v, p, "x y"), p)) };
};
const space: Parser<S.SpaceDesign> = (v, p) => {
  const r = record(v, p);
  const environment = choice(["interior", "outdoor"] as const)(r.environment, `${p}.environment`);
  const common = { ...base(r, p), ...composable(r, p), tilesetId: id(r.tilesetId, `${p}.tilesetId`), shape: choice(["rect", "l", "alcove"] as const)(r.shape, `${p}.shape`), width: size(r.width, `${p}.width`), height: size(r.height, `${p}.height`), floor: text(r.floor, `${p}.floor`), wall: text(r.wall, `${p}.wall`), objectSlots: list(r.objectSlots, `${p}.objectSlots`, objectSlot), ports: ports(r.ports, `${p}.ports`) };
  const fields = `${baseFields} environment tilesetId shape width height floor wall objectSlots ports composition`;
  switch (environment) {
    case "interior": {
      record(r, p, `${fields} role interiorLayout`);
      const layout = r.interiorLayout === undefined ? undefined : interiorLayout(r.interiorLayout, `${p}.interiorLayout`);
      if (layout) {
        assert(common.shape === "rect", `${p}.interiorLayout: rectangular envelope required`);
        for (const room of layout.rooms) assert(room.x >= 0 && room.y >= 0 && room.x + room.width <= common.width && room.y + room.height <= common.height, `${p}.interiorLayout: room outside floor`);
        for (const door of layout.doorways) assert(door.x >= 0 && door.y >= 0 && door.x < common.width && door.y < common.height, `${p}.interiorLayout: doorway outside floor`);
      }
      return { ...common, environment, role: choice(["entrance", "walkway", "room"] as const)(r.role, `${p}.role`), ...(layout ? { interiorLayout: layout } : {}) };
    }
    case "outdoor": record(r, p, `${fields} floorAreas`); return { ...common, environment, floorAreas: list(r.floorAreas, `${p}.floorAreas`, area) };
    default: return assertNever(environment);
  }
};
const reference = <K extends S.SpatialKind>(parseKind: Parser<K>): Parser<S.SpatialDesignReference<K>> => (v, p) => {
  const r = record(v, p, "kind id");
  return { kind: parseKind(r.kind, `${p}.kind`), id: id(r.id, `${p}.id`) };
};
const source = <K extends S.SpatialKind>(parseKind: Parser<K>): Parser<S.SpatialSource<K>> => (v, p) => {
  const r = record(v, p, "kind id revision");
  return { kind: parseKind(r.kind, `${p}.kind`), id: id(r.id, `${p}.id`), revision: positive(r.revision, `${p}.revision`) };
};
const child = <K extends S.SpatialKind>(parseKind: Parser<K>): Parser<S.SpatialChildSlot<K>> => (v, p) => {
  const r = record(v, p, "id source x y level");
  return { ...point(r, p), id: id(r.id, `${p}.id`), source: reference(parseKind)(r.source, `${p}.source`), level: coordinate(r.level, `${p}.level`) };
};
const endpoint: Parser<S.SpatialLocalEndpoint> = (v, p) => {
  const r = record(v, p, "childId portId");
  return { childId: nullableId(r.childId, `${p}.childId`), portId: id(r.portId, `${p}.portId`) };
};
const localConnection: Parser<S.SpatialLocalConnection> = (v, p) => {
  const r = record(v, p, "id from to bidirectional");
  return { id: id(r.id, `${p}.id`), from: endpoint(r.from, `${p}.from`), to: endpoint(r.to, `${p}.to`), bidirectional: boolean(r.bidirectional, `${p}.bidirectional`) };
};
const place: Parser<S.PlaceDesign> = (v, p) => {
  const r = record(v, p, `${baseFields} kind children layout ports connections exterior composition`);
  return { ...base(r, p), ...composable(r, p), kind: choice(["facility", "settlement", "natural"] as const)(r.kind, `${p}.kind`), children: list(r.children, `${p}.children`, child(choice(["space", "place"] as const))), layout: choice(["row", "double-row", "manual"] as const)(r.layout, `${p}.layout`), ports: ports(r.ports, `${p}.ports`), connections: list(r.connections, `${p}.connections`, localConnection), ...(r.exterior === undefined ? {} : { exterior: graphic(r.exterior, `${p}.exterior`) }) };
};
const terrain: Parser<S.SpatialTerrain> = (v, p) => {
  const r = record(v, p, "tilesetId width height floor areas");
  return { tilesetId: id(r.tilesetId, `${p}.tilesetId`), width: size(r.width, `${p}.width`), height: size(r.height, `${p}.height`), floor: text(r.floor, `${p}.floor`), areas: list(r.areas, `${p}.areas`, area) };
};
const route: Parser<S.SpatialRoute> = (v, p) => {
  const r = record(v, p, "id from to bidirectional points");
  const points = list(r.points, `${p}.points`, vertex);
  assert(points.length >= 2, `${p}.points: route needs at least two points`);
  return { ...localConnection({ id: r.id, from: r.from, to: r.to, bidirectional: r.bidirectional }, p), points };
};
const settlement: Parser<S.RegionSettlement> = (v, p) => {
  const r = record(v, p, "presetId seed");
  return { presetId: text(r.presetId, `${p}.presetId`), seed: integer([0, Number.MAX_SAFE_INTEGER])(r.seed, `${p}.seed`) };
};
const region: Parser<S.RegionDesign> = (v, p) => {
  const r = record(v, p, `${baseFields} terrain places ports routes settlement composition`);
  return { ...base(r, p), ...composable(r, p), terrain: terrain(r.terrain, `${p}.terrain`), places: list(r.places, `${p}.places`, child(choice(["place"] as const))), ports: ports(r.ports, `${p}.ports`), routes: list(r.routes, `${p}.routes`, route),
    ...(r.settlement === undefined ? {} : { settlement: settlement(r.settlement, `${p}.settlement`) }) };
};
const world: Parser<S.WorldDesign> = (v, p) => {
  const r = record(v, p, `${baseFields} terrain regions ports connections entryPort composition`);
  return { ...base(r, p), ...composable(r, p), terrain: terrain(r.terrain, `${p}.terrain`), regions: list(r.regions, `${p}.regions`, child(choice(["region"] as const))), ports: ports(r.ports, `${p}.ports`), connections: list(r.connections, `${p}.connections`, localConnection), entryPort: endpoint(r.entryPort, `${p}.entryPort`) };
};
const library: Parser<S.SpatialLibrary> = (v, p) => {
  const r = record(v, p, "objects spaces places regions worlds");
  return { objects: dictionary(r.objects, `${p}.objects`, object), spaces: dictionary(r.spaces, `${p}.spaces`, space), places: dictionary(r.places, `${p}.places`, place), regions: dictionary(r.regions, `${p}.regions`, region), worlds: dictionary(r.worlds, `${p}.worlds`, world) };
};
const interiorKit: Parser<NonNullable<S.SpatialKitSnapshot["interior"]>> = (v, p) => {
  const r = record(v, p, "id snap role");
  return { id: text(r.id, `${p}.id`), snap: choice(["wall-north", "wall-any", "floor", "free"] as const)(r.snap, `${p}.snap`), role: text(r.role, `${p}.role`) };
};
const kit: Parser<S.SpatialKitSnapshot> = (v, p) => {
  const r = record(v, p, "tilesetId kitId width height cells interior");
  const cells = list(r.cells, `${p}.cells`, (c, cp) => {
    const cell = record(c, cp, "x y layer tile");
    return { ...point(cell, cp), layer: choice(["lower", "upper"] as const)(cell.layer, `${cp}.layer`), tile: integer([-1, Number.MAX_SAFE_INTEGER])(cell.tile, `${cp}.tile`) };
  });
  return { ...graphic({ tilesetId: r.tilesetId, kitId: r.kitId }, p), width: size(r.width, `${p}.width`), height: size(r.height, `${p}.height`), cells,
    ...(r.interior === undefined ? {} : { interior: interiorKit(r.interior, `${p}.interior`) }) };
};
const snapshot = <P extends S.SpatialPort>(parsePort: Parser<P>): Parser<S.SpatialCompositionSnapshot<P>> => (v, p) => {
  const r = record(v, p, "root library kitCells ports");
  return { root: source(kind)(r.root, `${p}.root`), library: library(r.library, `${p}.library`), kitCells: dictionary(r.kitCells, `${p}.kitCells`, kit), ports: list(r.ports, `${p}.ports`, parsePort) };
};
const binding: Parser<S.SpatialCompiledBinding> = (v, p) => {
  const r = record(v, p);
  const bindingKind = Object.hasOwn(r, "kind") ? choice(["projection"] as const)(r.kind, `${p}.kind`) : undefined;
  const boundPorts = list(r.ports, `${p}.ports`, (v, p) => { const r = record(v, p, "portId x y"); return { ...point(r, p), portId: id(r.portId, `${p}.portId`) }; });
  const extent = { mapId: id(r.mapId, `${p}.mapId`), rect: rect(r.rect, `${p}.rect`), ports: boundPorts };
  switch (bindingKind) {
    case "projection": record(r, p, "kind mapId rect ports"); return { kind: bindingKind, ...extent };
    case undefined:
      record(r, p, "mapId rect eventIds connectionIds ports contentDigest overviewEntries");
      return { mapId: extent.mapId, rect: extent.rect, eventIds: texts(r.eventIds, `${p}.eventIds`), connectionIds: ids(r.connectionIds, `${p}.connectionIds`), ports: boundPorts, contentDigest: digest(r.contentDigest, `${p}.contentDigest`),
        ...(Object.hasOwn(r, "overviewEntries") ? { overviewEntries: overviewEntries(r.overviewEntries, `${p}.overviewEntries`) } : {}) };
    default: return assertNever(bindingKind);
  }
};
const occurrence: Parser<S.SpatialOccurrence> = (v, p) => {
  const r = record(v, p, "id kind parentId parentSlot source x y level seed snapshot generatorVersion bindings");
  const common = { ...point(r, p), id: id(r.id, `${p}.id`), level: coordinate(r.level, `${p}.level`), seed: coordinate(r.seed, `${p}.seed`), generatorVersion: id(r.generatorVersion, `${p}.generatorVersion`), bindings: list(r.bindings, `${p}.bindings`, binding) };
  const parentId = nullableId(r.parentId, `${p}.parentId`);
  const occurrenceKind = kind(r.kind, `${p}.kind`);
  const typed = <K extends S.SpatialKind>(k: K) => {
    const base = { ...common, kind: k, source: source(choice([k]))(r.source, `${p}.source`) };
    if (!Object.hasOwn(r, "parentSlot")) return { ...base, parentId, snapshot: snapshot(port)(r.snapshot, `${p}.snapshot`) };
    if (parentId === null) {
      assert(r.parentSlot === null, `${p}.parentSlot: root requires null`);
      return { ...base, parentId, parentSlot: null, snapshot: snapshot(occurrencePort)(r.snapshot, `${p}.snapshot`) };
    }
    const slot = record(r.parentSlot, `${p}.parentSlot`, "slotId index");
    const parentSlot = { slotId: id(slot.slotId, `${p}.parentSlot.slotId`), index: integer([0, Number.MAX_SAFE_INTEGER])(slot.index, `${p}.parentSlot.index`) };
    return { ...base, parentId, parentSlot, snapshot: snapshot(occurrencePort)(r.snapshot, `${p}.snapshot`) };
  };
  switch (occurrenceKind) {
    case "object": return typed("object"); case "space": return typed("space"); case "place": return typed("place");
    case "region": return typed("region"); case "world": return typed("world"); default: return assertNever(occurrenceKind);
  }
};
const connection: Parser<S.SpatialConnection> = (v, p) => {
  const r = record(v, p, "id from to bidirectional overviewRoute");
  return { id: id(r.id, `${p}.id`), from: concreteEndpoint(r.from, `${p}.from`), to: concreteEndpoint(r.to, `${p}.to`), bidirectional: boolean(r.bidirectional, `${p}.bidirectional`),
    ...(Object.hasOwn(r, "overviewRoute") ? { overviewRoute: overviewRoute(r.overviewRoute, `${p}.overviewRoute`) } : {}) };
};
const roomKind: Parser<NonNullable<S.LegacySpatialImportReceipt["roomKinds"]>[number]> = (v, p) => {
  const r = record(v, p, "tilesetId record");
  const path = `${p}.record`;
  const original = record(r.record, path, "id label requiredRoles suggestedModifiers walkway");
  return { tilesetId: text(r.tilesetId, `${p}.tilesetId`), record: {
    id: text(original.id, `${path}.id`), label: text(original.label, `${path}.label`),
    requiredRoles: [...texts(original.requiredRoles, `${path}.requiredRoles`)],
    ...(Object.hasOwn(original, "suggestedModifiers") ? { suggestedModifiers: [...texts(original.suggestedModifiers, `${path}.suggestedModifiers`)] } : {}),
    ...(Object.hasOwn(original, "walkway") ? { walkway: boolean(original.walkway, `${path}.walkway`) } : {}),
  } };
};
export function validateSpatialAuthoring(value: unknown): S.SpatialAuthoringDocument {
  const p = "spatialAuthoring";
  const r = record(value, p);
  const version = choice([1] as const)(r.version, `${p}.version`);
  record(r, p, "version library occurrences rootOccurrenceIds connections legacyImport");
  const receipt = record(r.legacyImport, `${p}.legacyImport`, "version sourceHash mapping backup roomKinds");
  const backup = record(receipt.backup, `${p}.legacyImport.backup`, "encoding json sha256");
  const mapping = list(receipt.mapping, `${p}.legacyImport.mapping`, (v, p) => { const r = record(v, p, "sourceKey target"); return { sourceKey: id(r.sourceKey, `${p}.sourceKey`), target: reference(kind)(r.target, `${p}.target`) }; });
  return { version, library: library(r.library, `${p}.library`), occurrences: dictionary(r.occurrences, `${p}.occurrences`, occurrence), rootOccurrenceIds: ids(r.rootOccurrenceIds, `${p}.rootOccurrenceIds`), connections: list(r.connections, `${p}.connections`, connection), legacyImport: {
    version: choice([1] as const)(receipt.version, `${p}.legacyImport.version`), sourceHash: digest(receipt.sourceHash, `${p}.legacyImport.sourceHash`), mapping,
    ...(Object.hasOwn(receipt, "roomKinds") ? { roomKinds: list(receipt.roomKinds, `${p}.legacyImport.roomKinds`, roomKind) } : {}),
    backup: { encoding: choice(["raw-json"] as const)(backup.encoding, `${p}.legacyImport.backup.encoding`), json: text(backup.json, `${p}.legacyImport.backup.json`), sha256: digest(backup.sha256, `${p}.legacyImport.backup.sha256`) },
  } };
}
function assertNever(value: never): never { throw new TypeError(`Unreachable spatial variant: ${String(value)}`); }
