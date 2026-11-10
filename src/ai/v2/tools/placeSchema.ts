// 장소 짓기 동사(make_place·edit_place·review_layout)의 인자 스키마 — 방 설계·구역·힌트·칸 배치·칸 배치 고침.
import type { PlaceType } from "../types";
import { DUNGEON_LAYOUT_SCHEMA, VILLAGE_LAYOUT_SCHEMA, bboxPlacesOn } from "../builders/placeLayout";
import { DUNGEON_DESIGN_SCHEMA } from "../dungeonParts";

const PLACE_TYPES: PlaceType[] = ["interior", "village", "dungeon", "cave", "street", "house"];

export const SIZE = { type: "string", enum: ["small", "medium", "large"] };

// 모델이 쓰는 방 설계(손 도트 실내) — 2026-10-29 사용자 결정 「방을 짓는 건 조수여야만 한다」. 함수는 조화·검사만(designRoom.ts).
export const ROOM_DESIGN_SCHEMA = {
  type: "object",
  description: "(interior, when you design this room yourself) room shape, size, door and furniture groups. When given, the builder lays no sample and builds this design, fixing only name matching, overlap, chair facing, the aisle in front of the door and reachability, and returns what it fixed. See part ids with room_parts.",
  properties: {
    shape: { type: "string", description: "rect · L (cuts the corner) · U (cuts the middle of the north wall) · T (two south corners) · bay window bump (two north corners) · alcove (keeps only the north-wall nook on the corner side and lowers the rest of the north wall). Minimum floor per shape, examples and pictures in room_parts. A side room is not a shape but one more zone (each with its own design)" },
    w: { type: "integer", description: "floor width in cells (5–24)" },
    h: { type: "integer", description: "floor height in cells (wall-face rows excluded, 4–18)" },
    corner: { type: "string", description: "(nw·ne·sw·se) the corner L cuts" },
    door: { type: "string", description: "south exit spot — left·center·right" },
    floor: { type: "string", description: "floor material id (floors in room_parts)" },
    wall: { type: "string", description: "wall-face material id (walls in room_parts)" },
    areas: { type: "array", description: "(optional, 2–4 inside one big room) distinct zones of this room — each with its own use, focal part and a reason for the player to walk there. For several real rooms use one zone per room (x, y, connections) instead.", items: {
      type: "object",
      properties: {
        name: { type: "string", description: "zone name: hearth · counter · locked stacks · ritual spot" },
        purpose: { type: "string", description: "one line: what this zone is for" },
        focal: { type: "string", description: "the zone's focal part — one part id from groups (fireplace · summoning circle · counter 3x1 · iron gate · altar)" },
        visit: { type: "string", description: "why the player comes here — tied to this game (inspect point, clue, locked place, stairs, counter, a person)" },
      }, required: ["name", "purpose", "focal", "visit"] } },
    groups: { type: "array", description: "(up to 16) furniture groups — parts used together (desk+chair, two armchairs+round table+lamp, a row of bookshelves). This list is everything placed (the function adds nothing).", items: {
      type: "object",
      properties: {
        name: { type: "string", description: "group name: desk spot · reading nook · bookshelf wall" },
        area: { type: "string", description: "(optional) the areas[].name this group belongs to" },
        at: { type: "string", description: "(north·south·west·east·center·nw·ne·sw·se) where it goes (wall, corner, center). Bookshelves/display cases (wall furniture) and hangings (window, map, frame) stand only on north." },
        pos: { type: "number", description: "along that wall from 0 (west/north end) to 1 (east/south end). Default 0.5" },
        x: { type: "integer", description: "(optional) floor cell coordinate — the floor's top-left is 0,0. Takes precedence over at" },
        y: { type: "integer" },
        rug: { type: "string", description: "(optional) rug color under the group: red·royal·blue·green·purple·brown" },
        items: { type: "array", items: { type: "object", properties: {
          id: { type: "string", description: "chipset part id (room_parts) — e.g. bookshelf 3w · desk 3x1 · chair N (chair facing north) · armchair" },
          dx: { type: "integer", description: "relative cell inside the group (top-left 0,0). Omitted = next to the previous part (downward for west/east wall groups)" },
          dy: { type: "integer", description: "hangings use -2 (top row of the wall face)" },
          count: { type: "integer", description: "(1–8) how many of the same part in a row" },
        }, required: ["id"] } },
      },
      required: ["items"],
    } },
  },
};

export const ZONE_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", description: "zone kind word (a word from the card)" },
    purpose: { type: "string", description: "one line: what the place is for" },
    anchors: { type: "array", items: { type: "string" }, description: "hero-object words for this zone" },
    vignettes: { type: "array", items: { type: "string" }, description: "(interior, optional) furniture groups for this room — main part ids (bookshelf 2w · forge · counter 3x1). The function picks the spots. Omitted = chosen by room kind" },
    size: SIZE,
    design: ROOM_DESIGN_SCHEMA,
    floor: { type: "number", description: "which floor (default 1)" },
    id: { type: "string", description: "zone id — the room id in a room graph (connections, entrance)" },
    x: { type: "integer", description: "(interior room graph) rough top-left cell of this room (x right, y down; the plan origin is free). The function snaps neighbours to a one-cell wall; it never chooses the arrangement for you" },
    y: { type: "integer", description: "(interior room graph) see x" },
    landmark: { type: "string", description: "(interior room graph) the one part this room is built around — a part id that is also in design.groups. Big multi-cell parts are welcome (great telescope · summoning circle · pulpit · long hearth 6 · fireplace · counter 3x1)" },
    stairs: { type: "string", enum: ["none", "up", "down"], description: "(interior room graph) none (default) or this room has stairs up/down — then put a stairs part (stairs up wood · stairs up stone · stairs down · stairwell down) in design.groups" },
    role: { type: "string", description: "(interior room graph) main · side (side room) · corridor · stairs" },
  },
  required: ["kind"],
};

export const CONNECTIONS_SCHEMA = { type: "array", description: "(interior room graph) which rooms join — a and b are zones[].id; type door (a door in a one-cell wall) or open (no wall between them). With connections, the function does not pick the floor plan: it only snaps your rough positions, carves the doors and checks reachability, and rejects impossible geometry with a fixed call.", items: { type: "object", properties: { a: { type: "string" }, b: { type: "string" }, type: { type: "string", enum: ["door", "open"] } }, required: ["a", "b"] } };

export const HINTS_SCHEMA = {
  type: "object",
  description: "only builder knobs the card told you about. Leave out anything you do not know.",
  properties: {
    variant: { type: "number", description: "another layout of the same spec (0,1,2…)" },
    dressing: { type: "number", description: "amount of dressing 0 normal · 1 more · 2 packed (cozy)" },
    houseCount: { type: "number" },
    roofs: { type: "string" },
    water: { type: "string", description: "(village) water in the land design — river: a river flowing east-west in the south (crossed by plank bridges) · none: no water. Always set it for grassland villages" },
    woods: { type: "string" },
    form: { type: "string" },
    terrain: { type: "string" },
    landform: { type: "string", enum: ["terraces", "hill", "slope", "plateau", "flat"], description: "(village) terrain design — the land shape. The village grows to fit this land" },
    settle: { type: "string", enum: ["middle", "low"], description: "(village) the tier the village sits on — low: the lowest waterside tier (riverside and swamp villages; the river runs in front of the village) · middle: the middle tier (lower road and barns on the low southern tier)" },
    tiers: { type: "number", description: "(village) number of high tiers above the village tier, 1–4" },
    high: { type: "string", enum: ["north", "center", "west", "east"], description: "(village) where the high ground is" },
    forestType: { type: "string" },
    walls: { type: "boolean" },
    wallGate: { type: "string" },
    width: { type: "number" },
    height: { type: "number" },
    length: { type: "string", description: "street length short|medium|long (only for builders the card mentions)" },
    plaza: { type: "string" },
    landmark: { type: "string" },
    shops: { type: "string", description: "short shop names, comma-separated, left to right" },
    mirror: { type: "boolean" },
    floorShapes: { type: "string", description: "shape per floor, comma-separated (bottom floor first)" },
    floorGimmicks: { type: "string", description: "device per floor, comma-separated (bottom floor first, none if none)" },
    townSize: { type: "string" },
    streets: { type: "string" },
    pond: { type: "boolean" },
    terrainSeed: { type: "number", description: "(village) code terrain seed — change only if you dislike the preview land" },
    layout: { type: "object", description: "(village) spots chosen by land-picture coordinates (x right, y down, in cells). The function moves them to the nearest buildable spot and links roads", properties: {
      gather: { type: "object", properties: { x: { type: "number" }, y: { type: "number" }, plaza: { type: "boolean" } }, required: ["x", "y"], description: "gathering place (square, well)" },
      landmark: { ...{ type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] }, description: "high-ground building (watchtower, chapel, temple) — usually on the high tier" },
      anchor: { ...{ type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] }, description: "big building (inn, hall) — usually beside the gathering place" },
      work: { ...{ type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] }, description: "workplace (barn, storehouse)" },
      houses: { type: "array", items: { type: "object", properties: { x: { type: "number" }, y: { type: "number" }, kind: { type: "string", enum: ["small", "medium", "large"], description: "house size — mix them so the same house does not repeat" } }, required: ["x", "y"] }, description: "house spots (house center) 3–12" },
      fields: { type: "array", items: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] }, description: "field spots" },
      orchards: { type: "array", items: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] }, description: "orchard (rows of trees, about 14×9) spots" },
      pastures: { type: "array", items: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] }, description: "fenced pasture (sheep, haystacks) spots" },
      forests: { type: "array", items: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] }, description: "forest clump spots" },
      props: { type: "array", items: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] }, description: "roadside prop piles (cart, crates, hay, firewood, signpost, bench) — placed beside the nearest road" },
      exits: { type: "array", items: { type: "string", enum: ["west", "east", "north", "south"] }, description: "map edges where the main road leaves the village, 1–2" },
    } },
  },
};

const RECT_PROPS = { x: { type: "integer" }, y: { type: "integer" }, w: { type: "integer" }, h: { type: "integer" } };

const LAYOUT_OBJECT = { type: "object", properties: { id: { type: "string", description: "exact catalog id" }, x: { type: "integer" }, y: { type: "integer" },
  repeat: { type: "object", properties: { count: { type: "integer" }, dx: { type: "integer" }, dy: { type: "integer" } } }, purpose: { type: "string" } }, required: ["id", "x", "y"] };

/** (실내) 칸 배치 — 모델이 모든 칸을 쓴다. 코드는 그대로 깔고 검증만 한다(interiorLayout.ts). */
export const LAYOUT_SCHEMA = {
  type: "object",
  description: "(interior, hand-pixel chipset) your exact cell layout — code lays it as written and only checks it. Ids from the [Interior catalog] card. Leave it out for other place types.",
  properties: {
    map: { type: "object", properties: { w: { type: "integer" }, h: { type: "integer" } }, required: ["w", "h"] },
    landmark: { type: "object", description: "the one big piece the place is built around (placed first; may repeat in objects/wall_items at the same x,y)", properties: { ...LAYOUT_OBJECT.properties, wall: { type: "string", description: "only for a wall piece: the wall it hangs on / stands against" } }, required: ["id", "x", "y"] },
    outer_wall: { type: "object", description: "closed ring of wall around the building: corner points, straight segments", properties: { material: { type: "string" }, path: { type: "array", items: { type: "array", items: { type: "integer" } } } }, required: ["material", "path"] },
    walls: { type: "array", description: "partition walls, each running wall to wall", items: { type: "object", properties: { id: { type: "string" }, material: { type: "string" }, thickness: { type: "integer" }, stub: { type: "boolean" }, path: { type: "array", items: { type: "array", items: { type: "integer" } } }, purpose: { type: "string" } }, required: ["id", "material", "path"] } },
    doors: { type: "array", description: "openings on partition walls (vertical wall: 3 tall, x,y = bottom cell)", items: { type: "object", properties: { wall: { type: "string" }, x: { type: "integer" }, y: { type: "integer" }, width: { type: "integer" }, piece: { type: "string" }, purpose: { type: "string" } }, required: ["wall", "x", "y"] } },
    rooms: { type: "array", description: "one label per space closed by walls", items: { type: "object", properties: { id: { type: "string" }, at: { type: "array", items: { type: "integer" } }, floor: { type: "string" }, purpose: { type: "string" }, role: { type: "string" }, landmark: { type: "string" }, stairs: { type: "string", enum: ["none", "up", "down"] }, repeat: { type: "boolean", description: "a truly repeated room (guest room, cell)" }, jo: { type: "integer", description: "tatami rooms only: number of 1x2 mats" } }, required: ["id", "at", "floor"] } },
    wall_items: { type: "array", description: "wall-mounted (h) and against-wall (w) pieces, each with its wall", items: { type: "object", properties: { ...LAYOUT_OBJECT.properties, wall: { type: "string" } }, required: ["id", "x", "y", "wall"] } },
    rails: { type: "array", items: { type: "object", properties: { id: { type: "string" }, path: { type: "array", items: { type: "array", items: { type: "integer" } } } }, required: ["id", "path"] } },
    regions: { type: "array", description: "older rectangle form (use outer_wall/walls/doors/rooms instead): rooms/areas as rectangles (top two rows of each are its north wall face)", items: { type: "object", properties: { id: { type: "string" }, ...RECT_PROPS,
      floor: { type: "string" }, wall: { type: "string" }, purpose: { type: "string" }, role: { type: "string", description: "main · side · corridor · stairs" }, landmark: { type: "string", description: "optional: the catalog id this region is built around (an object you place inside it)" },
      stairs: { type: "string", enum: ["none", "up", "down"] } }, required: ["id", "x", "y", "w", "h", "floor", "wall"] } },
    openings: { type: "array", description: "cells carved through solid walls between regions (1 cell in a horizontal wall, 3 tall in a vertical wall)", items: { type: "object", properties: { ...RECT_PROPS, purpose: { type: "string" } }, required: ["x", "y"] } },
    entrance: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" } }, required: ["x", "y"], description: "one cell on the bottom map row, under a region" },
    carpets: { type: "array", items: { type: "object", properties: { id: { type: "string" }, ...RECT_PROPS }, required: ["id", "x", "y", "w", "h"] } },
    daises: { type: "array", description: "raised walkable platforms (dais ids)", items: { type: "object", properties: { id: { type: "string" }, ...RECT_PROPS }, required: ["id", "x", "y", "w", "h"] } },
    floor_zones: { type: "array", description: "a second floor inside one room (entry, kitchen tiles, wet area)", items: { type: "object", properties: { floor: { type: "string" }, ...RECT_PROPS, purpose: { type: "string" } }, required: ["floor", "x", "y", "w", "h"] } },
    objects: { type: "array", items: LAYOUT_OBJECT },
    required: { type: "array", description: "each thing the request names and the ids you placed for it (standing pieces), or why nothing fits", items: { type: "object", properties: { ask: { type: "string" }, ids: { type: "array", items: { type: "string" } }, missing: { type: "string" } }, required: ["ask"] } },
  },
};

/** 칸 배치 고침(review_layout·edit_place.layoutPatch) — 지금 배치에 그대로 적용하고, 짓기가 다시 검증한다. */
export const LAYOUT_PATCH_SCHEMA = { type: "object", description: "applied to your current layout exactly, then validated with the same rules", properties: {
  remove_objects: { type: "array", description: "entries of objects by exact id and x,y (an entry with repeat is removed whole); to move a piece remove it and add it", items: { type: "object", properties: { id: { type: "string" }, x: { type: "integer" }, y: { type: "integer" } }, required: ["id", "x", "y"] } },
  add_objects: { type: "array", items: LAYOUT_OBJECT },
  remove_wall_items: { type: "array", items: { type: "object", properties: { id: { type: "string" }, x: { type: "integer" }, y: { type: "integer" } }, required: ["id", "x", "y"] } },
  add_wall_items: { type: "array", items: { type: "object", properties: { ...LAYOUT_OBJECT.properties, wall: { type: "string" } }, required: ["id", "x", "y", "wall"] } },
  replace: { type: "object", description: "each key replaces that whole field of the layout (the complete new value): map, landmark, outer_wall, walls, doors, entrance, rooms, wall_items, objects, carpets, rails, daises, floor_zones, required", properties: {
    map: LAYOUT_SCHEMA.properties.map, landmark: LAYOUT_SCHEMA.properties.landmark, outer_wall: LAYOUT_SCHEMA.properties.outer_wall, walls: LAYOUT_SCHEMA.properties.walls, doors: LAYOUT_SCHEMA.properties.doors,
    entrance: LAYOUT_SCHEMA.properties.entrance, rooms: LAYOUT_SCHEMA.properties.rooms, wall_items: LAYOUT_SCHEMA.properties.wall_items, objects: LAYOUT_SCHEMA.properties.objects, carpets: LAYOUT_SCHEMA.properties.carpets, rails: LAYOUT_SCHEMA.properties.rails, daises: LAYOUT_SCHEMA.properties.daises, floor_zones: LAYOUT_SCHEMA.properties.floor_zones, required: LAYOUT_SCHEMA.properties.required } },
} };

export const PLACE_SPEC_SCHEMA = {
  type: "object",
  properties: {
    type: { type: "string", enum: PLACE_TYPES },
    name: { type: "string" },
    style: { type: "string" },
    theme: { type: "string" },
    size: SIZE,
    zones: { type: "array", items: ZONE_SCHEMA },
    features: { type: "array", items: { type: "string" } },
    floors: { type: "number" },
    layout: LAYOUT_SCHEMA,
    connections: CONNECTIONS_SCHEMA,
    entrance: { type: "string", description: "(interior room graph) zones[].id of the room with the south exit — it must be the southernmost room" },
    exits: { type: "array", items: { type: "string", enum: ["south", "north", "east", "west"] } },
    mapId: { type: "string", description: "only to rebuild an existing map in place" },
    hints: HINTS_SCHEMA,
    dungeonDesign: DUNGEON_DESIGN_SCHEMA,
    floorDesigns: { type: "array", items: DUNGEON_DESIGN_SCHEMA, description: "(multi-floor dungeon) a design per floor (bottom floor first)" },
    ...(bboxPlacesOn() ? { dungeonLayout: DUNGEON_LAYOUT_SCHEMA, villageLayout: VILLAGE_LAYOUT_SCHEMA } : {}),
  },
  required: ["type", "name"],
};

export const POINT = { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] };
