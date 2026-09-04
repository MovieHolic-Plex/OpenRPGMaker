import {
  CONCEPT_PLACE_COUNT_MAX,
  type ConceptBundleRecord,
  type ConceptFacilityRecord,
  type ConceptPlaceRecord,
  type ConceptPlaceRole,
  type ConceptPlaceSize,
  type ConceptPlaceZone,
} from "@/project/types/conceptBundle";
import type { ConceptLayoutRoom, ConceptRoomLayout } from "@/editor/conceptBundleResolve";

const ROOM_FOOTPRINT: Readonly<Record<ConceptPlaceSize, { readonly w: number; readonly h: number }>> = {
  s: { w: 5, h: 3 },
  m: { w: 7, h: 4 },
  l: { w: 9, h: 5 },
};
const WALKWAY_H = 3;
const ORIGIN_Y = 3;
const MARGIN_X = 2;
const V_GAP = 3;
const H_GAP = 1;
const MIN_BAND_W = 8;
const SOUTH_HINT = /주방|창고|부엌|저장|kitchen|storage|pantry|cellar/i;

type Instance = {
  readonly place: ConceptPlaceRecord;
  readonly role: ConceptPlaceRole;
  readonly id: string;
};

function placeRole(place: ConceptPlaceRecord): ConceptPlaceRole {
  if (place.role) return place.role;
  return /복도|통로|corridor/i.test(place.label) || place.id === "corridor" ? "walkway" : "room";
}

function placeSize(place: ConceptPlaceRecord): ConceptPlaceSize {
  return place.size ?? "m";
}

function placeCount(place: ConceptPlaceRecord): number {
  const count = place.count ?? 1;
  return Math.min(CONCEPT_PLACE_COUNT_MAX, Math.max(1, count));
}

function placeLevel(place: ConceptPlaceRecord): number {
  return place.level ?? 1;
}

function placeZone(place: ConceptPlaceRecord, role: ConceptPlaceRole): ConceptPlaceZone | undefined {
  if (place.zone) return place.zone;
  if (role !== "room") return undefined;
  return SOUTH_HINT.test(`${place.id}${place.label}`) ? "south" : "north";
}

function floorTileOf(place: ConceptPlaceRecord): number | undefined {
  if (place.floor === "stone") return 12;
  if (place.floor === "plank") return 102;
  if (place.floor === "mat") return 139;
  return undefined;
}

function themeOf(placeId: string, role: ConceptPlaceRole): string {
  if (role === "walkway") return "corridor";
  // row 도면기(roomTheme)와 같은 규약 — placeId 그대로, 방 종류 매칭은 파이프라인이 맡는다.
  return placeId;
}

function layoutRoom(instance: Instance, x: number, y: number, w: number, h: number): ConceptLayoutRoom {
  const floorTile = floorTileOf(instance.place);
  return {
    id: instance.id,
    placeId: instance.place.id,
    role: instance.role,
    x,
    y,
    w,
    h,
    theme: themeOf(instance.place.id, instance.role),
    ...(floorTile !== undefined ? { floorTile } : {}),
  };
}

function rowWidth(instances: readonly Instance[]): number {
  if (instances.length === 0) return 0;
  const boxes = instances.map((entry) => ROOM_FOOTPRINT[placeSize(entry.place)]);
  return boxes.reduce((sum, box) => sum + box.w, 0) + Math.max(0, boxes.length - 1) * H_GAP;
}

function rowHeight(instances: readonly Instance[]): number {
  if (instances.length === 0) return 0;
  return Math.max(...instances.map((entry) => ROOM_FOOTPRINT[placeSize(entry.place)].h));
}

function placeRow(instances: readonly Instance[], originX: number, y: number, h: number): ConceptLayoutRoom[] {
  const rooms: ConceptLayoutRoom[] = [];
  let x = originX;
  for (const instance of instances) {
    const box = ROOM_FOOTPRINT[placeSize(instance.place)];
    rooms.push(layoutRoom(instance, x, y, box.w, h));
    x += box.w + H_GAP;
  }
  return rooms;
}

export function layoutConceptFacilityDoubleRow(
  bundle: ConceptBundleRecord,
  facility: ConceptFacilityRecord,
  options: { readonly level?: number; readonly minBandWidth?: number } = {},
): ConceptRoomLayout {
  const level = options.level;
  const places = facility.placeIds
    .map((id) => bundle.places.find((place) => place.id === id))
    .filter((place): place is ConceptPlaceRecord => Boolean(place))
    .filter((place) => level === undefined || placeLevel(place) === level);

  const instances: Instance[] = [];
  for (const place of places) {
    const count = placeCount(place);
    const role = placeRole(place);
    for (let n = 0; n < count; n += 1) {
      instances.push({ place, role, id: count === 1 ? place.id : `${place.id}_${n + 1}` });
    }
  }

  const entrance = instances.find((entry) => entry.role === "entrance") ?? null;
  const walkway = instances.find((entry) => entry.role === "walkway") ?? null;
  const rooms = instances.filter((entry) => entry !== entrance && entry !== walkway);
  const north = rooms.filter((entry) => placeZone(entry.place, entry.role) !== "south");
  const south = rooms.filter((entry) => placeZone(entry.place, entry.role) === "south");
  const doorHost = entrance ?? walkway ?? rooms[rooms.length - 1] ?? null;
  const hall = entrance ?? (doorHost?.role === "walkway" ? null : doorHost);
  const hallInstance = hall;
  const leftSouth = south.slice(0, Math.ceil(south.length / 2));
  const rightSouth = south.slice(Math.ceil(south.length / 2));
  const southBand = hallInstance ? [...leftSouth, hallInstance, ...rightSouth] : south;
  const northW = rowWidth(north);
  const southW = rowWidth(southBand);
  const bandW = Math.max(northW, southW, MIN_BAND_W, options.minBandWidth ?? 0);
  const northH = rowHeight(north);
  const southH = Math.max(rowHeight(southBand), hallInstance ? ROOM_FOOTPRINT[placeSize(hallInstance.place)].h : 0);

  const laid: ConceptLayoutRoom[] = [];
  const innerDoors: { x: number; y: number }[] = [];
  let cursorY = ORIGIN_Y;

  if (north.length > 0) {
    const x = MARGIN_X + Math.floor((bandW - northW) / 2);
    const northRooms = placeRow(north, x, cursorY, northH);
    laid.push(...northRooms);
    cursorY += northH;
    for (const room of northRooms) innerDoors.push({ x: room.x + Math.floor(room.w / 2), y: cursorY });
    cursorY += V_GAP;
  }

  const walkwayInstance: Instance = walkway ?? {
    place: { id: "_walkway", label: "복도", role: "walkway" },
    role: "walkway",
    id: "_walkway",
  };
  const walkwayRoom = layoutRoom(walkwayInstance, MARGIN_X, cursorY, bandW, WALKWAY_H);
  laid.push(walkwayRoom);
  cursorY += WALKWAY_H;

  if (southBand.length > 0) {
    const x = MARGIN_X + Math.floor((bandW - southW) / 2);
    const southRooms = placeRow(southBand, x, cursorY + V_GAP, southH);
    for (const room of southRooms) innerDoors.push({ x: room.x + Math.floor(room.w / 2), y: cursorY });
    cursorY += V_GAP;
    laid.push(...placeRow(southBand, x, cursorY, southH));
    cursorY += southH;
  } else if (hallInstance) {
    const box = ROOM_FOOTPRINT[placeSize(hallInstance.place)];
    innerDoors.push({ x: MARGIN_X + Math.floor(bandW / 2), y: cursorY });
    cursorY += V_GAP;
    laid.push(layoutRoom(hallInstance, MARGIN_X, cursorY, bandW, box.h));
    cursorY += box.h;
  }

  const doorRoom = laid.find((room) => room.id === hallInstance?.id)
    ?? laid.find((room) => room.role === "entrance")
    ?? laid[laid.length - 1];
  if (!doorRoom) {
    const box = ROOM_FOOTPRINT.m;
    const fallback: ConceptLayoutRoom = {
      id: facility.id,
      placeId: facility.id,
      role: "room",
      x: MARGIN_X,
      y: ORIGIN_Y,
      w: box.w,
      h: box.h,
      theme: "storage",
    };
    laid.push(fallback);
    const door = { x: fallback.x + Math.floor(fallback.w / 2), y: fallback.y + fallback.h - 1 };
    return { width: fallback.x + fallback.w + MARGIN_X - 1, height: door.y + 3, door, rooms: laid, innerDoors };
  }
  const door = { x: doorRoom.x + Math.floor(doorRoom.w / 2), y: doorRoom.y + doorRoom.h - 1 };
  const right = Math.max(...laid.map((room) => room.x + room.w));
  return {
    width: right + MARGIN_X - 1,
    height: door.y + 3,
    door,
    rooms: laid,
    innerDoors,
    ...(facility.wall && facility.wall !== "cream" ? { wallMaterial: facility.wall } : {}),
    ...(level !== undefined && level > 1 ? { level } : {}),
  };
}
