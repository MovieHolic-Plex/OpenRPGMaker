/**
 * wing 도면 — **세로 복도**를 축으로 방이 동·서에 붙는 구조(여관·병영·기숙사형).
 *
 * 기존 두 문법(row / double-row)은 모두 "북쪽 방 줄 → 가로 복도 → 남쪽 홀" 로 **가로 밴드를 쌓는다**.
 * 그래서 어떤 시설을 지어도 실루엣이 같은 샌드위치가 된다(2026-09-11 사용자 지적: "집의 구조를 변주해야").
 * 이 문법은 축을 90° 돌린다: 방이 복도 좌우에 남북으로 늘어서고, 정문 홀은 맨 남쪽에 선다.
 *
 * 배치: [복도 끝 알코브] [서방들] [세로 복도 3열] [동방들] ... [홀(정문)]
 * 방은 자기 쪽 복도 열에 문 하나(innerDoors)를 낸다. 벽·천장 문법은 파이프라인이 바닥 마스크에서
 * 파생하므로(맞닿은 방 경계 = 파티션, innerDoors = 개구부) 이 도면도 그대로 성립한다.
 */
import {
  CONCEPT_PLACE_COUNT_MAX,
  type ConceptBundleRecord,
  type ConceptFacilityRecord,
  type ConceptPlaceRecord,
  type ConceptPlaceRole,
  type ConceptPlaceSize,
} from "@/project/types/conceptBundle";
import type { ConceptLayoutRoom, ConceptRoomLayout } from "@/editor/conceptBundleResolve";

const ROOM_FOOTPRINT: Readonly<Record<ConceptPlaceSize, { readonly w: number; readonly h: number }>> = {
  s: { w: 5, h: 3 },
  m: { w: 7, h: 4 },
  l: { w: 9, h: 5 },
};
/** 세로 복도 폭(열). 가로 문법의 WALKWAY_H=3 과 같은 통행 폭 계약. */
const CORRIDOR_W = 3;
const ORIGIN_Y = 3;
/**
 * 복도 끝 막다른 알코브(행) — 3×3 석조 화로가 서는 자리.
 * 3열 복도를 3칸 막으면 통행이 끊기므로, 방들이 서는 구간 **위**에 화로 자리를 미리 비워 둔다
 * (2026-09-11 사용자: "석조 난로는 거실이나 복도 끝에 있어야"). 화로가 없으면 넓은 복도 끝으로 남는다.
 */
const CORRIDOR_NOOK_H = 3;
const MARGIN_X = 2;
/** 세로로 붙는 방 사이 파티션(트림 + 벽면 2행). */
const V_GAP = 3;
/** 가로로 붙는 방·복도 사이 파티션(천장 1열). */
const H_GAP = 1;
const MIN_BAND_W = 8;

type Instance = {
  readonly place: ConceptPlaceRecord;
  readonly role: ConceptPlaceRole;
  readonly id: string;
};

function placeRole(place: ConceptPlaceRecord): ConceptPlaceRole {
  if (place.role) return place.role;
  return /복도|통로|corridor|hall/i.test(place.label) ? "walkway" : "room";
}

function placeBox(place: ConceptPlaceRecord): { w: number; h: number } {
  const box = ROOM_FOOTPRINT[place.size ?? "m"];
  return place.shape && place.shape !== "rect" ? { w: box.w + 2, h: box.h + 3 } : box;
}

function placeCount(place: ConceptPlaceRecord): number {
  const count = place.count ?? 1;
  return Math.min(CONCEPT_PLACE_COUNT_MAX, Math.max(1, count));
}

function floorTileOf(place: ConceptPlaceRecord): number | undefined {
  switch (place.floor) {
    case "stone": return 12;
    case "plank": return 102;
    case "mat": return 139;
    default: return undefined;
  }
}

function layoutRoom(instance: Instance, x: number, y: number, w: number, h: number): ConceptLayoutRoom {
  const floorTile = floorTileOf(instance.place);
  return {
    id: instance.id,
    ...(instance.place.shape ? { shape: instance.place.shape } : {}),
    placeId: instance.place.id,
    role: instance.role,
    x,
    y,
    w,
    h,
    theme: instance.role === "walkway" ? "corridor" : instance.place.id,
    ...(floorTile !== undefined ? { floorTile } : {}),
  };
}

/** 한 쪽(서/동) 방들을 위에서 아래로 쌓는다. 폭이 다른 방도 복도 쪽 열에 맞춘다. */
function stackSide(
  instances: readonly Instance[],
  side: "west" | "east",
  corridorX: number,
): { rooms: ConceptLayoutRoom[]; doors: { x: number; y: number }[]; bottom: number } {
  const rooms: ConceptLayoutRoom[] = [];
  const doors: { x: number; y: number }[] = [];
  let y = ORIGIN_Y + CORRIDOR_NOOK_H;
  for (const instance of instances) {
    const box = placeBox(instance.place);
    // 복도에 붙는 열이 문 자리다 — 서쪽은 오른쪽 끝, 동쪽은 왼쪽 끝을 복도에 맞춘다.
    const x = side === "west" ? corridorX - H_GAP - box.w : corridorX + CORRIDOR_W + H_GAP;
    rooms.push(layoutRoom(instance, x, y, box.w, box.h));
    doors.push({ x: side === "west" ? corridorX - H_GAP : corridorX + CORRIDOR_W, y: y + Math.floor(box.h / 2) });
    y += box.h + V_GAP;
  }
  return { rooms, doors, bottom: y - V_GAP };
}

export function layoutConceptFacilityWing(
  bundle: ConceptBundleRecord,
  facility: ConceptFacilityRecord,
  options: { readonly level?: number; readonly minBandWidth?: number } = {},
): ConceptRoomLayout {
  const level = options.level;
  const places = facility.placeIds
    .map((id) => bundle.places.find((place) => place.id === id))
    .filter((place): place is ConceptPlaceRecord => Boolean(place))
    .filter((place) => level === undefined || (place.level ?? 1) === level);

  const instances: Instance[] = [];
  for (const place of places) {
    const count = placeCount(place);
    const role = placeRole(place);
    for (let n = 0; n < count; n += 1) {
      instances.push({ place, role, id: count === 1 ? place.id : `${place.id}_${n + 1}` });
    }
  }

  const wall = facility.wall ?? "cream";
  const wallPart = wall !== "cream" ? { wallMaterial: wall } : {};
  const levelPart = level !== undefined && level > 1 ? { level } : {};

  const entrance = instances.find((entry) => entry.role === "entrance") ?? null;
  // 설계가 복도 장소를 두면 그 장소가 복도의 정본이다(그 장소의 물건·바닥이 복도에 실린다).
  const corridorPlace = instances.find((entry) => entry.role === "walkway")?.place ?? null;
  const corridorInstance: Instance = corridorPlace
    ? { place: corridorPlace, role: "walkway", id: corridorPlace.id }
    : { place: { id: "_corridor", label: "복도", role: "walkway" }, role: "walkway", id: "_corridor" };
  const sideRooms = instances.filter((entry) => entry !== entrance && entry.role !== "walkway");
  // 정문이 없으면 마지막 방을 홀로 승격한다(방 하나짜리 wing = 문 달린 방).
  const promoted = !entrance && sideRooms.length > 0 ? sideRooms.pop() ?? null : null;
  const hall = entrance ?? promoted;

  if (sideRooms.length === 0) {
    // 방이 없으면(장소 0개 또는 홀 하나) 복도 없이 그 방이 곧 건물이다.
    const fallbackPlace: ConceptPlaceRecord = hall?.place ?? { id: facility.id, label: facility.label, role: "room" };
    const box = placeBox(fallbackPlace);
    const room = layoutRoom({ place: fallbackPlace, role: fallbackPlace.role ?? "room", id: hall?.id ?? facility.id }, MARGIN_X, ORIGIN_Y, box.w, box.h);
    const door = { x: room.x + Math.floor(room.w / 2), y: room.y + room.h - 1 };
    return { width: room.x + room.w + MARGIN_X - 1, height: door.y + 3, door, rooms: [room], innerDoors: [], ...wallPart, ...levelPart };
  }

  const west = sideRooms.filter((_, index) => index % 2 === 0);
  const east = sideRooms.filter((_, index) => index % 2 === 1);
  const westW = west.reduce((max, entry) => Math.max(max, placeBox(entry.place).w), 0);
  const eastW = east.reduce((max, entry) => Math.max(max, placeBox(entry.place).w), 0);
  const corridorX = MARGIN_X + (westW > 0 ? westW + H_GAP : 0);
  const bandW = Math.max(
    (westW > 0 ? westW + H_GAP : 0) + CORRIDOR_W + (eastW > 0 ? H_GAP + eastW : 0),
    MIN_BAND_W,
    options.minBandWidth ?? 0,
  );

  const westStack = stackSide(west, "west", corridorX);
  const eastStack = stackSide(east, "east", corridorX);
  const stacksBottom = Math.max(westStack.bottom, eastStack.bottom, ORIGIN_Y + CORRIDOR_NOOK_H);
  const rooms: ConceptLayoutRoom[] = [...westStack.rooms, ...eastStack.rooms];
  const innerDoors: { x: number; y: number }[] = [...westStack.doors, ...eastStack.doors];

  // 세로 복도 — 끝 알코브부터 방 구간을 지나 홀 앞까지 한 줄로 관통한다.
  rooms.push(layoutRoom(corridorInstance, corridorX, ORIGIN_Y, CORRIDOR_W, stacksBottom - ORIGIN_Y));

  let doorRoom: ConceptLayoutRoom | null = null;
  if (hall) {
    innerDoors.push({ x: corridorX + Math.floor(CORRIDOR_W / 2), y: stacksBottom });
    const box = placeBox(hall.place);
    doorRoom = layoutRoom(hall, MARGIN_X, stacksBottom + V_GAP, Math.max(bandW, box.w), box.h);
    rooms.push(doorRoom);
  } else {
    doorRoom = rooms[rooms.length - 1] ?? null;
  }
  if (!doorRoom) {
    const room = rooms[0];
    if (!room) throw new Error("wing layout: no rooms");
    doorRoom = room;
  }

  const door = { x: doorRoom.x + Math.floor(doorRoom.w / 2), y: doorRoom.y + doorRoom.h - 1 };
  const right = Math.max(...rooms.map((room) => room.x + room.w));
  return {
    width: right + MARGIN_X - 1,
    height: door.y + 3,
    door,
    rooms,
    innerDoors,
    ...wallPart,
    ...levelPart,
  };
}
