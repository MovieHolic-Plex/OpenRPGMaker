import type { JsonSchema } from "./types";

const text = { type: "string" } as const;
const id = { type: "string", minLength: 1 } as const;
const integer = { type: "integer" } as const;
const size = { type: "integer", minimum: 1, maximum: 256 } as const;
const array = (items: JsonSchema): JsonSchema => ({ type: "array", items });
const object = (properties: Record<string, JsonSchema>, required = Object.keys(properties)): JsonSchema => ({ type: "object", properties, required, additionalProperties: false });
const choices = (values: readonly string[]): JsonSchema => ({ type: "string", enum: values });
export const SPATIAL_KIND_SCHEMA = { ...choices(["object", "place", "region", "world"]),
  description: "object: reusable prop or exterior; place: room, yard, building or settlement; region/world: geography." };
const point = object({ x: integer, y: integer });
const ports = array(object({ id, name: text, x: integer, y: integer }));
const graphic = object({ tilesetId: id, kitId: id });
const reference = (kinds: readonly string[]) => object({ kind: choices(kinds), id });
const child = (kinds: readonly string[]) => array(object({ id, source: reference(kinds), x: integer, y: integer, level: integer }));
const composition = object({ tilesetId: id, width: size, height: size,
  tiles: array(object({ x: integer, y: integer, layer: choices(["lower", "upper"]), tile: { type: "integer", minimum: -1 } })),
  members: child(["object", "place", "region"]),
});
// childId=null addresses the enclosing design. The domain parser owns null, not a provider type union.
const endpoint = object({ childId: { description: "Child slot id, or null for this design" }, portId: id });
const connection = { id, from: endpoint, to: endpoint, bidirectional: { type: "boolean" } } satisfies Record<string, JsonSchema>;
const areas = array(object({ kind: choices(["rect", "polygon"]), material: text, x: integer, y: integer, width: size, height: size, points: array(point) }, ["kind", "material"]));
const terrain = object({ tilesetId: id, width: size, height: size, floor: text, areas });
const base = { id, name: text, revision: { type: "integer", minimum: 1 }, tags: array(text),
  provenance: object({ origin: choices(["user", "builtin", "legacy", "ai"]), sourceId: text }, ["origin"]),
} satisfies Record<string, JsonSchema>;
const objects = object({ ...base, graphic, anchors: ports, chips: array(text) });
const spaces = object({ ...base, environment: choices(["interior", "outdoor"]), tilesetId: id,
  shape: choices(["rect", "l", "alcove", "l-right", "bay", "notch", "cross"]), width: size, height: size, floor: text, wall: text,
  role: choices(["entrance", "walkway", "room"]), floorAreas: areas, ports, composition,
  interiorLayout: { ...object({
    rooms: array(object({ id, name: text, x: integer, y: integer, width: size, height: size, shape: choices(["rect", "l", "alcove", "l-right", "bay", "notch", "cross"]), floor: text }, ["id", "name", "x", "y", "width", "height"])),
    doorways: array(point),
  }), description: "Optional interior-only rooms within a rectangular bounding envelope. Each room may set its own shape and floor material; their union defines the actual floor outline. Coordinates are floor-local. Adjacent room boxes reserve a shared partition on the west/north box's last column/row; doorways reopen it. Generates connected outer walls and partitions together; do not stamp partition walls as furniture." },
  zones: { ...array(object({ id, name: text, floor: choices(["wood", "stone", "plank", "mat"]), x: integer, y: integer, width: size, height: size })), description: "생활 영역: 하나의 외벽 안에서 바닥과 가구만 구분. 벽/문 생성 없음. 공간 바닥 기준 좌표, 서로 겹치지 않게 지정." },
  objectSlots: array(object({ id, objectDesignId: id, quantity: { type: "integer", minimum: 1 }, required: { type: "boolean" },
    placement: object({ mode: choices(["auto", "fixed"]), x: integer, y: integer, wallOverlap: { type: "integer", enum: [1, 2], description: "Interior fixed placement only: x/y locates the first floor row; lift the graphic by this many rows. Only upper-layer pieces may overlap actual cream wall faces, with a floor-supported base. Use 1 for a two-tile cabinet against the north wall." } }, ["mode"]), chipOverrides: array(text), zoneId: id,
  }, ["id", "objectDesignId", "quantity", "required", "placement"])),
}, [...Object.keys(base), "environment", "tilesetId", "shape", "width", "height", "floor", "wall", "ports", "objectSlots"]);
const groupedPlaces = object({ ...base, kind: choices(["facility", "settlement", "natural"]), children: child(["place"]),
  layout: choices(["row", "double-row", "manual"]), ports, composition, connections: array(object(connection)),
  exterior: { ...graphic, description: "Copy a saved ObjectDesign.graphic {tilesetId,kitId} only with painted passable port cells. Otherwise place the object via objectSlots in an outdoor yard place for ground/approach. No objectDesignId link or anchors/chips inheritance in this field. Appearance does not define interior floors, ports or connections." },
}, [...Object.keys(base), "kind", "children", "layout", "ports", "connections"]);
const places: JsonSchema = { ...object({ ...spaces.properties, ...groupedPlaces.properties }, Object.keys(base)),
  description: "One place: environment interior/outdoor selects a directly editable room/yard with dimensions, materials, ports and objectSlots. Otherwise kind facility/settlement/natural selects a grouping with children, layout, ports and connections. Child references always use kind place." };
const settlement = object({ presetId: id, seed: { type: "integer", minimum: 0 } });
const regions = object({ ...base, composition, terrain, places: child(["place"]), ports, routes: array(object({ ...connection, points: array(point) })), settlement },
  [...Object.keys(base), "terrain", "places", "ports", "routes"]);
const worlds = object({ ...base, composition, terrain, regions: child(["region"]), ports, connections: array(object(connection)), entryPort: endpoint }, [...Object.keys(base), "terrain", "regions", "ports", "connections", "entryPort"]);

export const SPATIAL_DESIGN_SCHEMAS = { object: objects, space: spaces, place: places, region: regions, world: worlds } as const;
// Kind-specific named bodies avoid an untyped catch-all design object on native providers.
export const SPATIAL_UPSERT_SCHEMA = object({ kind: SPATIAL_KIND_SCHEMA,
  expectedRevision: { type: "integer", minimum: 0, description: "0 creates a fresh id; updates require the exact current revision and next revision in the design." },
  object: objects, place: places, region: regions, world: worlds,
}, ["kind", "expectedRevision"]);
export const SPATIAL_BUILD_SCHEMA = object({ kind: SPATIAL_KIND_SCHEMA, id, occurrenceId: id, seed: integer,
  target: object({ mapId: id, rect: object({ x: integer, y: integer, width: size, height: size }), entry: point }),
}, ["kind", "id", "occurrenceId", "seed"]);
export const SPATIAL_GET_SCHEMA = object({ kind: SPATIAL_KIND_SCHEMA, id,
  resolved: { type: "boolean", description: "default true — resolved transitive source closure. false returns only the design body (enough for an upsert revision round-trip when the full payload is truncated)." } }, ["kind", "id"]);
export const SPATIAL_LIST_SCHEMA = object({ kind: SPATIAL_KIND_SCHEMA,
  query: { ...text, description: "Case-insensitive substring of saved id, name or tags. For exteriors try kind:object and query:건물 외형, then the authored name/tag; for complete houses use kind:place. Omit query to list all designs of the kind." },
  limit: { type: "integer", minimum: 1, maximum: 200, description: "Shared rows per page (default 40)." },
  offset: { type: "integer", minimum: 0, description: "Skip this many shared rows (data.shared.nextOffset)." } }, []);
export const SPATIAL_APPLY_SCHEMA = object({ previewId: id });
// Occurrence endpoints use occurrenceId (concrete frozen id), not design childId slots.
const occurrenceEndpoint = object({ occurrenceId: id, portId: id });
export const SPATIAL_OCCURRENCE_SCHEMA = object({
  operation: choices(["move", "delete", "refresh", "detach", "clone", "link", "unlink"]),
  occurrenceId: id,
  x: integer, y: integer, level: integer,
  externalConnections: choices(["reject", "remove", "omit", "copy"]),
  newOccurrenceId: id,
  connection: object({ id, from: occurrenceEndpoint, to: occurrenceEndpoint, bidirectional: { type: "boolean" } }),
  connectionId: id,
}, ["operation"]);
