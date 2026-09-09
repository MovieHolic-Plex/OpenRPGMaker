import { sha256HexTextSync } from "../../util/sha256";
import { CONCEPT_FACILITY_TEMPLATES } from "../defaults/conceptFacilityTemplates";
import { INTERIOR_OBJECT_CATALOG } from "../defaults/interiorObjectCatalog";
import { deserialize } from "../io";
import { assert, requireRecord } from "../io/guards";
import { INTERIOR_TILESET_ID } from "../mapCreateSpec";
import type { ConceptPlaceRecord } from "../types/conceptBundle";
import type { Project, StructureKitDef } from "../types";
import { resolveSpatialGraphic } from "./assets";
import { validateSpatialAuthoring } from "./guards";
import { inspectLegacySpatialConstraints, type LegacySpatialConstraintInspection } from "./legacyConstraints";
import { legacyFacilityFloors, legacyRoomRole, legacyRoomSize } from "./legacyImportLayout";
import { validateLegacyImportKits } from "./legacyImportValidation";
import { validateSpatialReferences } from "./references";
import type { LegacySpatialImportReceipt, ObjectDesign, PlaceDesign, SpaceDesign, SpatialAuthoringDocument, SpatialDesignBase, SpatialId, SpatialKind, SpatialObjectSlot } from "./types";

export type LegacySpatialConversion = {
  /** Activation transport: ordinary JSON only. Never serialize the normalized preview here. */
  readonly raw: Readonly<Record<string, unknown>> & { readonly spatialAuthoring: SpatialAuthoringDocument };
  readonly preview: Project;
  readonly inspection: LegacySpatialConstraintInspection;
};

/** JSON tuples are injective even for delimiters, quotes, Unicode and equal local IDs.
 * Context identities use their own kind namespace, never label/tag parsing.
 */
export function legacySpatialId(tuple: readonly string[]): SpatialId {
  const value = `legacy:${JSON.stringify(tuple)}`;
  const opaque = (id: string): id is SpatialId => id.length > 0;
  assert(opaque(value), "Legacy identity must be nonempty");
  return value;
}
function base(tuple: readonly string[], name: string): SpatialDesignBase {
  return { id: legacySpatialId(tuple), name, revision: 1, tags: [], provenance: { origin: "legacy", sourceId: JSON.stringify(tuple) } };
}
function furnitureKit(kit: StructureKitDef): boolean {
  switch (kit.kind) {
    case "section": return kit.learnedFrom === "interior-catalog" || ["wall-north", "wall-any", "floor", "free"].includes(kit.ai?.snap ?? "") || Boolean(kit.ai?.interiorRole?.trim());
    case "house": return false;
    default: return unreachable(kit);
  }
}
function unreachable(value: never): never { throw new TypeError(`Unknown legacy variant: ${String(value)}`); }

/** Explicit raw root-plus-map-overlay snapshot only. Parsing/repair happens on independent
 * copies; the submitted raw fields and opaque archive never pass through project serialization.
 * A canonical marker is authoritative, including deletions from its historical mapping.
 */
export function convertLegacySpatialSnapshot(json: string): LegacySpatialConversion {
  const source = deserialize(json);
  const raw = requireRecord("legacy snapshot", JSON.parse(json));
  if (source.spatialAuthoring !== undefined) {
    // Canonical owners select live graphics, not the receipt or frozen occurrence libraries.
    const library = source.spatialAuthoring.library;
    const graphics = [...Object.values(library.objects).map(object => object.graphic), ...Object.values(library.places).flatMap(place => place.exterior ? [place.exterior] : [])];
    for (const graphic of graphics) {
      const resolved = resolveSpatialGraphic(source, graphic);
      assert(resolved !== undefined, `${JSON.stringify([graphic.tilesetId, "", "object", graphic.kitId])}.graphic: unavailable graphic ${graphic.kitId}`);
      switch (resolved.source) {
        case "authored":
          validateLegacyImportKits(graphic.tilesetId, { count: source.tilesets[graphic.tilesetId].count, structureKits: [resolved.kit] });
          break;
        case "builtin": break;
        default: unreachable(resolved);
      }
    }
    return { raw: { ...raw, spatialAuthoring: source.spatialAuthoring }, preview: source, inspection: inspectLegacySpatialConstraints(source.spatialAuthoring.legacyImport) };
  }
  // Local accumulators own all mutation. Source assets and records are read-only inputs.
  const objects: Record<string, ObjectDesign> = {};
  const spaces: Record<string, Extract<SpaceDesign, { readonly environment: "interior" }>> = {};
  const places: Record<string, PlaceDesign> = {};
  const mapping: LegacySpatialImportReceipt["mapping"][number][] = [];
  const sourceKeys = new Set<string>();
  const register = (tuple: readonly string[], kind: SpatialKind) => {
    const sourceKey = JSON.stringify(tuple);
    assert(!sourceKeys.has(sourceKey), `${sourceKey}: duplicate qualified legacy identity`);
    sourceKeys.add(sourceKey);
    mapping.push({ sourceKey, target: { kind, id: legacySpatialId(tuple) } });
  };
  for (const [tilesetId, tileset] of Object.entries(source.tilesets)) {
    validateLegacyImportKits(tilesetId, tileset);
    const kits = tileset.structureKits ?? [];
    const fallback = tilesetId === INTERIOR_TILESET_ID && !kits.some(furnitureKit) ? INTERIOR_OBJECT_CATALOG : [];
    const catalog = new Map(fallback.map(object => [object.id, object.label]));
    for (const kit of kits) catalog.set(kit.id, kit.name ?? kit.id);
    for (const [kitId, name] of catalog) {
      const tuple = [tilesetId, "", "object", kitId];
      const graphic = { tilesetId, kitId };
      assert(resolveSpatialGraphic(source, graphic) !== undefined, `${JSON.stringify(tuple)}.graphic: unavailable graphic ${kitId}`);
      register(tuple, "object");
      const object = { ...base(tuple, name), graphic, anchors: [], chips: [] };
      objects[object.id] = object;
    }
    const bundles = tileset.scratchConceptBundles ?? (tilesetId === INTERIOR_TILESET_ID ? CONCEPT_FACILITY_TEMPLATES : []);
    for (const bundle of bundles) {
      const qualified = (kind: string, localId: string) => [tilesetId, bundle.id, kind, localId];
      for (const thing of bundle.things) {
        const tuple = qualified("thing", thing.id);
        const graphic = { tilesetId, kitId: thing.objectId };
        assert(resolveSpatialGraphic(source, graphic) !== undefined, `${JSON.stringify(tuple)}.objectId: unavailable graphic ${thing.objectId}`);
        for (const placeId of thing.placeIds) assert(bundle.places.some(place => place.id === placeId), `${JSON.stringify(tuple)}.placeIds: unknown place ${placeId}`);
        register(tuple, "object");
        const object: ObjectDesign = { ...base(tuple, thing.label), graphic, anchors: [], chips: [...thing.chips] };
        objects[object.id] = object;
      }
      const slots = (place: ConceptPlaceRecord): readonly SpatialObjectSlot[] => bundle.things
        .filter(thing => thing.placeIds.includes(place.id))
        .sort((a, b) => Number(Boolean(b.required)) - Number(Boolean(a.required)))
        .map(thing => ({ id: legacySpatialId(qualified("slot", JSON.stringify([place.id, thing.id]))), objectDesignId: legacySpatialId(qualified("thing", thing.id)), quantity: 1, required: Boolean(thing.required), placement: { mode: "auto" }, chipOverrides: [...thing.chips] }));
      for (const place of bundle.places) {
        assert(place.zone === undefined || place.zone === "north" || place.zone === "south", `${JSON.stringify(qualified("place", place.id))}.zone: unknown zone ${String(place.zone)}`);
        const tuple = qualified("place", place.id);
        register(tuple, "space");
        const space: SpaceDesign = { ...base(tuple, place.label), environment: "interior", tilesetId, role: legacyRoomRole(place), shape: place.shape ?? "rect", ...legacyRoomSize(place), floor: place.floor ?? "wood", wall: "cream", objectSlots: slots(place), ports: [] };
        spaces[space.id] = space;
      }
      for (const facility of bundle.facilities) {
        const tuple = qualified("facility", facility.id);
        assert(facility.layout === undefined || facility.layout === "row" || facility.layout === "double-row", `${JSON.stringify(tuple)}.layout: unknown layout ${String(facility.layout)}`);
        register(tuple, "place");
        const children = legacyFacilityFloors(bundle, facility).flatMap(floor => floor.rooms.map((room, index) => {
          // Layout preserves authored record identity; synthetic rooms are new records,
          // even when their local ID collides with an unselected authored place.
          const original = bundle.places.includes(room.place) ? spaces[legacySpatialId(qualified("place", room.place.id))] : undefined;
          const context = qualified("place-context", JSON.stringify([facility.id, floor.level, index]));
          const space: SpaceDesign = { ...base(context, room.place.label), environment: "interior", tilesetId, role: room.role, shape: room.place.shape ?? "rect", width: room.width, height: room.height, floor: room.place.floor ?? "wood", wall: facility.wall ?? "cream", objectSlots: original ? slots(room.place) : [], ports: [] };
          // Only layout dimensions, role and facility wall can differ for that same source record.
          const same = original && original.width === space.width && original.height === space.height && original.wall === space.wall && original.role === space.role;
          const id = same ? original.id : space.id;
          if (!same) spaces[id] = space;
          return { id: legacySpatialId(qualified("child", JSON.stringify([facility.id, floor.level, index]))), source: { kind: "space" as const, id }, x: room.x, y: room.y, level: floor.level };
        }));
        const place: PlaceDesign = { ...base(tuple, facility.label), kind: "facility", children, layout: facility.layout ?? "row", ports: [], connections: [] };
        places[place.id] = place;
      }
    }
  }
  const sha256 = sha256HexTextSync(json);
  const roomKinds = Object.entries(source.tilesets).flatMap(([tilesetId, tileset]) => (tileset.interiorRoomKinds ?? []).map(record => ({ tilesetId, record })));
  const document = validateSpatialAuthoring({ version: 1, library: { objects, spaces, places, regions: {}, worlds: {} }, occurrences: {}, rootOccurrenceIds: [], connections: [], legacyImport: {
    version: 1, sourceHash: sha256, mapping, roomKinds, backup: { encoding: "raw-json", json, sha256 },
  } });
  validateSpatialReferences(document, source);
  const converted = { ...raw, spatialAuthoring: document };
  return { raw: converted, preview: deserialize(JSON.stringify(converted)), inspection: inspectLegacySpatialConstraints(document.legacyImport) };
}
