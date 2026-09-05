import type { InteriorRoomShape } from "@/project/interiorRoomFootprint";
// 타일셋에 붙은 개념 꾸러미를 시공 입력으로 푼다.
// 정본은 프로젝트가 들고 있는 값이다. 사용자가 데이터베이스에서 고친 나무가 그대로 쓰인다.
//
// 소유권: 시설 구성(어떤 장소·물건)은 개념 꾸러미가 갖는다. 방 종류(interiorRoomKinds)의
// requiredRoles 로 시설을 합성하지 않는다 — 도면은 꾸러미의 role/size/count/floor/level/zone 만 읽는다.
// 그림의 정본은 구조물(structureKits)이다 — 꾸러미 물건은 objectId 로 그림을 빌려 쓴다.
//
// 도면(layoutConceptFacility)은 장소의 역할(entrance·walkway·room)·크기·개수만 읽는다.
// 남→북으로 홀(정문) → 복도 → 방들이 서고, 파티션은 파이프라인 벽 문법(가로 인접 1열·세로 인접 3행)을 따른다.
// 이 모듈은 interiorRoomPipeline 을 import 하지 않는다(순환). 실내 칩셋 id 는 문자열로 둔다.
import { layoutConceptFacilityDoubleRow } from "@/editor/conceptLayoutDoubleRow";
import { CONCEPT_FACILITY_TEMPLATES, cloneConceptFacilityTemplates } from "@/project/defaults/conceptFacilityTemplates";
import {
  CONCEPT_PLACE_COUNT_MAX,
  type ConceptBundleRecord,
  type ConceptChipId,
  type ConceptFacilityRecord,
  type ConceptFloorMaterial,
  type ConceptPlaceRecord,
  type ConceptPlaceRole,
  type ConceptPlaceSize,
  type ConceptThingRecord,
  type ConceptWallMaterial,
  isConceptPlaceLevel,
} from "@/project/types/conceptBundle";
import type { Project } from "@/project/types";

const INTERIOR_TILESET_ID = "easyrpg_chipset_interior";

export type ResolvedConceptFacility = {
  readonly tilesetId: string;
  readonly bundle: ConceptBundleRecord;
  readonly facility: ConceptFacilityRecord;
};

/** 도면의 방 한 칸(장소 인스턴스). 같은 장소가 여러 개면 id 에 번호가 붙는다. */
export type ConceptLayoutRoom = {
  readonly id: string;
  readonly placeId: string;
  readonly role: ConceptPlaceRole;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly theme: string;
  readonly shape?: InteriorRoomShape;
  /** 장소 바닥 재질의 하부 타일. 나무(기본)면 생략 — 파이프라인이 72 로 채운다. */
  readonly floorTile?: number;
};

export type ConceptRoomLayout = {
  readonly width: number;
  readonly height: number;
  readonly door: { readonly x: number; readonly y: number };
  readonly rooms: readonly ConceptLayoutRoom[];
  readonly innerDoors: readonly { readonly x: number; readonly y: number }[];
  /** 시설 벽면 재질. 크림(기본)이면 생략. */
  readonly wallMaterial?: ConceptWallMaterial;
  /** 이 도면의 층. 1층(기본)이면 생략. 2층 이상은 정문 자리가 「내려가는 계단」 착지가 된다. */
  readonly level?: number;
};

export type ConceptOverlayThing = {
  readonly thingId: string;
  readonly objectId: string;
  readonly label: string;
  readonly chips: readonly ConceptChipId[];
  readonly required: boolean;
};

export type ConceptOverlayRoom = {
  readonly placeId: string;
  readonly placeLabel: string;
  readonly role: ConceptPlaceRole;
  readonly things: readonly ConceptOverlayThing[];
};

/** 파이프라인에 넘기는 오버레이 — 도면의 방 id 마다 그 장소의 물건과 칩. */
export type ConceptOverlay = {
  readonly bundleId: string;
  readonly facilityId: string;
  readonly facilityLabel: string;
  readonly rooms: Readonly<Record<string, ConceptOverlayRoom>>;
};

/** 실내 칩셋에 꾸러미가 아직 없으면 시설 초안 묶음(여관·민가·상점…)을 얹는다. 빈 배열은 건드리지 않는다.
 * Phase 5: 다른 칩셋은 손대지 않는다(no-op) — liveBundlesForTileset이 미시드 실외를 []로 읽고,
 * 탭도 실외를 undefined(미시드)로 둔다. 읽기 도구의 빈 배열 쓰기는 실외 타일셋을 더럽힌다. */
export function ensureConceptBundles(project: Project, tilesetId = INTERIOR_TILESET_ID): void {
  const tileset = project.tilesets[tilesetId];
  if (!tileset) return;
  if (tileset.scratchConceptBundles !== undefined) return;
  if (tilesetId !== INTERIOR_TILESET_ID) return;
  tileset.scratchConceptBundles = cloneConceptFacilityTemplates();
}

export function listLiveConceptBundles(project: Project): readonly {
  tilesetId: string;
  tilesetName: string;
  bundles: readonly ConceptBundleRecord[];
}[] {
  return Object.values(project.tilesets)
    .map((tileset) => ({
      tilesetId: tileset.id,
      tilesetName: tileset.name,
      bundles: liveBundlesForTileset(project, tileset.id),
    }))
    .filter((entry) => entry.bundles.length > 0);
}

export function liveBundlesForTileset(project: Project, tilesetId: string): readonly ConceptBundleRecord[] {
  const tileset = project.tilesets[tilesetId];
  if (!tileset) return [];
  if (tileset.scratchConceptBundles !== undefined) return tileset.scratchConceptBundles;
  if (tilesetId === INTERIOR_TILESET_ID) return CONCEPT_FACILITY_TEMPLATES;
  return [];
}

/** 지금 프로젝트에서 부를 수 있는 시설명 — 툴 오류 문구·프롬프트용. */
export function listLiveConceptFacilityLabels(project: Project, tilesetId?: string): readonly string[] {
  const entries = tilesetId
    ? [{ bundles: liveBundlesForTileset(project, tilesetId) }]
    : listLiveConceptBundles(project);
  const labels: string[] = [];
  for (const entry of entries) {
    for (const bundle of entry.bundles) {
      for (const facility of bundle.facilities) if (!labels.includes(facility.label)) labels.push(facility.label);
    }
  }
  return labels;
}

export function resolveConceptFacility(
  project: Project,
  query: string,
  tilesetId?: string,
): ResolvedConceptFacility | undefined {
  const normalized = foldQuery(query);
  if (!normalized) return undefined;
  const tilesetIds = tilesetId
    ? [tilesetId]
    : [INTERIOR_TILESET_ID, ...Object.keys(project.tilesets).filter((id) => id !== INTERIOR_TILESET_ID)];
  for (const id of tilesetIds) {
    const tileset = project.tilesets[id];
    if (!tileset) continue;
    const bundles = liveBundlesForTileset(project, id);
    for (const bundle of bundles) {
      const facility = bundle.facilities.find((entry) => matchesQuery(entry.id, entry.label, normalized))
        ?? (matchesQuery(bundle.id, bundle.label, normalized) ? bundle.facilities[0] : undefined);
      if (facility) return { tilesetId: id, bundle, facility };
    }
  }
  return undefined;
}

export function thingsForPlace(bundle: ConceptBundleRecord, placeId: string): ConceptThingRecord[] {
  const listed = bundle.things.filter((thing) => thing.placeIds.includes(placeId));
  return [...listed].sort((a, b) => Number(Boolean(b.required)) - Number(Boolean(a.required)));
}

/** 장소 역할. 필드가 없으면 라벨(복도·통로·hall)로 복도를 알아보고 나머지는 방이다. */
export function conceptPlaceRole(place: ConceptPlaceRecord): ConceptPlaceRole {
  if (place.role) return place.role;
  return isWalkway(place) ? "walkway" : "room";
}

export function conceptPlaceSize(place: ConceptPlaceRecord): ConceptPlaceSize {
  return place.size ?? "m";
}

export function conceptPlaceCount(place: ConceptPlaceRecord): number {
  const raw = place.count ?? 1;
  if (!Number.isFinite(raw)) return 1;
  return Math.min(CONCEPT_PLACE_COUNT_MAX, Math.max(1, Math.floor(raw)));
}

export function conceptPlaceFloor(place: ConceptPlaceRecord): ConceptFloorMaterial {
  return place.floor ?? "wood";
}

export function conceptPlaceLevel(place: ConceptPlaceRecord): number {
  const raw = place.level ?? 1;
  return isConceptPlaceLevel(raw) ? raw : 1;
}

/** 시설의 장소가 서는 층 목록(오름차순, 중복 없음). 장소가 없으면 [1]. */
export function conceptFacilityLevels(bundle: ConceptBundleRecord, facility: ConceptFacilityRecord): number[] {
  const levels = new Set<number>();
  for (const placeId of facility.placeIds) {
    const place = bundle.places.find((entry) => entry.id === placeId);
    if (place) levels.add(conceptPlaceLevel(place));
  }
  if (levels.size === 0) levels.add(1);
  return [...levels].sort((a, b) => a - b);
}

export function conceptFacilityWall(facility: ConceptFacilityRecord): ConceptWallMaterial {
  return facility.wall ?? "cream";
}

/**
 * 바닥 재질 → 실내 칩셋 하부 타일. 파이프라인 FLOOR_MATERIAL_TILES(돌 12 · 나무 72 · 널 102 · 짚 돗자리 139)와 같은 값.
 * 이 모듈은 파이프라인을 import 하지 않으므로 번호를 여기 둔다.
 */
export const CONCEPT_FLOOR_TILES: Readonly<Record<ConceptFloorMaterial, number>> = {
  wood: 72,
  stone: 12,
  plank: 102,
  mat: 139,
};

/** 장소의 바닥 타일. 나무(기본)는 undefined — 파이프라인 기본값과 같아 리틴트가 없다. */
export function conceptPlaceFloorTile(place: ConceptPlaceRecord): number | undefined {
  const material = conceptPlaceFloor(place);
  return material === "wood" ? undefined : CONCEPT_FLOOR_TILES[material];
}

export function conceptOverlayFor(
  bundle: ConceptBundleRecord,
  facility: ConceptFacilityRecord,
  layout: ConceptRoomLayout,
): ConceptOverlay {
  const rooms: Record<string, ConceptOverlayRoom> = {};
  for (const room of layout.rooms) {
    const place = bundle.places.find((entry) => entry.id === room.placeId);
    rooms[room.id] = {
      placeId: room.placeId,
      placeLabel: place?.label ?? room.placeId,
      role: room.role,
      things: thingsForPlace(bundle, room.placeId).map((thing) => ({
        thingId: thing.id,
        objectId: thing.objectId,
        label: thing.label,
        chips: [...thing.chips],
        required: Boolean(thing.required),
      })),
    };
  }
  return { bundleId: bundle.id, facilityId: facility.id, facilityLabel: facility.label, rooms };
}

// ── 도면 ─────────────────────────────────────────────────────────────────────

/** 바닥 크기(폭×높이). s 는 객실 한 칸, l 은 홀. */
const ROOM_FOOTPRINT: Readonly<Record<ConceptPlaceSize, { readonly w: number; readonly h: number }>> = {
  s: { w: 5, h: 3 },
  m: { w: 7, h: 4 },
  l: { w: 9, h: 5 },
};
const WALKWAY_H = 3;
/** 방 줄 시작 y — 천장 보더 1행 + 벽 문법 여유 1행. 방 바닥은 y=3부터도 천장·벽이 온전히 선다. */
const ORIGIN_Y = 3;
/** 좌우 마진 — 구조물 끝에서 벽+천장 보더 1열 + 여유 1열. */
const MARGIN_X = 2;
/** 세로 인접 방 사이 파티션(트림 + 벽면 2행). */
const V_GAP = 3;
/** 가로 인접 방 사이 파티션(천장 1열). */
const H_GAP = 1;
const MIN_BAND_W = 8;
/** 방 줄이 홀 바로 위일 때 홀을 좌우로 넓히는 열 수. */
const BAND_SPREAD = 1;

type PlaceInstance = { readonly place: ConceptPlaceRecord; readonly role: ConceptPlaceRole; readonly id: string };

export function layoutConceptFacility(
  bundle: ConceptBundleRecord,
  facility: ConceptFacilityRecord,
  options: { readonly level?: number; readonly minBandWidth?: number } = {},
): ConceptRoomLayout {
  if (facility.layout === "double-row") return layoutConceptFacilityDoubleRow(bundle, facility, options);
  // 층을 지정하면 그 층의 장소만 도면에 든다. 지정이 없으면 전부(한 층 시설의 종전 동작).
  // 위층엔 보통 정문 역할이 없다 — 그러면 마지막 방이 문 밴드로 승격되고(아래 promoted), 그 문 자리가
  // 「내려가는 계단」 착지가 된다(placeConceptTool 이 정문 이벤트를 바꾼다).
  const level = options.level;
  const places = facility.placeIds
    .map((id) => bundle.places.find((place) => place.id === id))
    .filter((place): place is ConceptPlaceRecord => Boolean(place))
    .filter((place) => level === undefined || conceptPlaceLevel(place) === level);

  const instances: PlaceInstance[] = [];
  for (const place of places) {
    const count = conceptPlaceCount(place);
    const role = conceptPlaceRole(place);
    for (let n = 0; n < count; n += 1) {
      instances.push({ place, role, id: count === 1 ? place.id : `${place.id}_${n + 1}` });
    }
  }

  // 정문을 품는 밴드 하나, 복도 밴드 하나. 나머지는 전부 방 줄이다(역할이 겹쳐도 첫 하나만 밴드).
  const entrance = instances.find((entry) => entry.role === "entrance") ?? null;
  const walkway = instances.find((entry) => entry.role === "walkway") ?? null;
  const rowInstances = instances.filter((entry) => entry !== entrance && entry !== walkway);
  // 정문·복도가 모두 없으면 마지막 방을 정문 밴드로 쓴다(방 하나짜리 시설 = 문 달린 방).
  const promoted = !entrance && !walkway && rowInstances.length > 0 ? rowInstances.pop() ?? null : null;
  const host = entrance ?? walkway ?? promoted;
  const doorBand = entrance ?? promoted;

  const rowBoxes = rowInstances.map((entry) => {
    const box = ROOM_FOOTPRINT[conceptPlaceSize(entry.place)];
    return entry.place.shape && entry.place.shape !== "rect" ? { w: box.w + 2, h: box.h + 3 } : box;
  });
  const rowH = rowBoxes.length > 0 ? Math.max(...rowBoxes.map((box) => box.h)) : 0;
  const rowW = rowBoxes.reduce((sum, box) => sum + box.w, 0) + Math.max(0, rowBoxes.length - 1) * H_GAP;
  const bandOwnW = doorBand ? ROOM_FOOTPRINT[conceptPlaceSize(doorBand.place)].w + (doorBand.place.shape && doorBand.place.shape !== "rect" ? 4 : 0) : 0;
  // 복도 없이 방 둘 이상이 홀 바로 위에 서면 홀을 양쪽 1열씩 넓힌다 — 방문 착지 열이 홀 북벽을 2칸 조각으로 쪼개
  // 카운터·피아노 같은 3칸 가구가 설 자리가 없어진다(2026-09-02 술집·민가 초안 실측).
  const spread = !walkway && doorBand && rowInstances.length >= 2 ? BAND_SPREAD : 0;
  // 층이 둘 이상인 시설은 층마다 건물 외곽(밴드 폭)을 맞춘다 — 홀만 남은 1층이 자기 발자국 폭으로 좁아지면
  // 계단·카운터·피아노가 북벽 한 줄을 나눠 쓸 자리가 없다(2026-09-03 2층 여관 실측: 「카운터 런 자리 없음」).
  const bandW = Math.max(rowW + spread * 2, bandOwnW, rowBoxes.length > 0 || host ? MIN_BAND_W : 0, options.minBandWidth ?? 0);

  const rooms: ConceptLayoutRoom[] = [];
  const innerDoors: { x: number; y: number }[] = [];
  let cursorY = ORIGIN_Y;

  if (rowInstances.length > 0) {
    // 방 줄: 폭이 밴드보다 좁으면 가운데 정렬.
    let x = MARGIN_X + Math.floor((bandW - rowW) / 2);
    rowInstances.forEach((entry, index) => {
      const box = rowBoxes[index]!;
      const floorTile = conceptPlaceFloorTile(entry.place);
      rooms.push({
        id: entry.id,
        placeId: entry.place.id,
        role: entry.role,
        x,
        y: cursorY + rowH - box.h,
        w: box.w,
        h: box.h,
        ...(entry.place.shape ? { shape: entry.place.shape } : {}),
        theme: roomTheme(entry.place.id, entry.role),
        ...(floorTile !== undefined ? { floorTile } : {}),
      });
      x += box.w + H_GAP;
    });
    cursorY += rowH;
  }

  const pushBand = (entry: PlaceInstance, h: number): ConceptLayoutRoom => {
    const previous = rooms.length > 0;
    if (previous) {
      // 위 줄의 방마다 아래 밴드로 내려가는 문 하나(파티션 트림 행).
      const above = rooms.filter((room) => room.y + room.h === cursorY);
      for (const room of above) innerDoors.push({ x: room.x + Math.floor(room.w / 2), y: cursorY });
      cursorY += V_GAP;
    }
    const floorTile = conceptPlaceFloorTile(entry.place);
    const band: ConceptLayoutRoom = {
      id: entry.id,
      placeId: entry.place.id,
      role: entry.role,
      x: MARGIN_X,
      y: cursorY,
      w: bandW,
      h: h + (entry.place.shape && entry.place.shape !== "rect" ? 3 : 0),
      ...(entry.place.shape ? { shape: entry.place.shape } : {}),
      theme: roomTheme(entry.place.id, entry.role),
      ...(floorTile !== undefined ? { floorTile } : {}),
    };
    rooms.push(band);
    cursorY += band.h;
    return band;
  };

  if (walkway) pushBand(walkway, WALKWAY_H);
  let doorRoom: ConceptLayoutRoom | null = null;
  if (doorBand) doorRoom = pushBand(doorBand, ROOM_FOOTPRINT[conceptPlaceSize(doorBand.place)].h);
  if (!doorRoom) doorRoom = rooms.find((room) => room.id === host?.id) ?? rooms[rooms.length - 1] ?? null;

  if (!doorRoom) {
    // 장소가 하나도 없는 시설 — 빈 방 하나로 세운다. 시공은 되되 물건이 없다.
    const box = ROOM_FOOTPRINT.m;
    doorRoom = { id: facility.id, placeId: facility.id, role: "room", x: MARGIN_X, y: ORIGIN_Y, w: box.w, h: box.h, theme: "storage" };
    rooms.push(doorRoom);
  }

  const door = { x: doorRoom.x + Math.floor(doorRoom.w / 2), y: doorRoom.y + doorRoom.h - 1 };
  const right = Math.max(...rooms.map((room) => room.x + room.w));
  const width = right + MARGIN_X - 1;
  const height = door.y + 3;
  const wallMaterial = conceptFacilityWall(facility);
  return {
    width,
    height,
    door,
    rooms,
    innerDoors,
    ...(wallMaterial !== "cream" ? { wallMaterial } : {}),
    ...(level !== undefined && level > 1 ? { level } : {}),
  };
}

function isWalkway(place: ConceptPlaceRecord): boolean {
  // role 이 없는데 도면이 복도로 판정해야 하는 낡은 장소 — id 하위호환 + 라벨 추측만 쓴다.
  // 방 종류 테이블(BUILTIN/저작값)은 보지 않는다: 이 모듈은 bundle+facility 만 받는 순수 도면기다.
  if (place.id === "corridor") return true;
  return /복도|통로|corridor|hall/i.test(place.label);
}

function roomTheme(placeId: string, role: ConceptPlaceRole): string {
  if (role === "walkway") return "corridor";
  // placeId 그대로 — 저작된 방 종류 매칭은 파이프라인(resolveInteriorRoomVocab)이 맡는다.
  return placeId;
}

function foldQuery(query: string): string {
  return query.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, "");
}

function matchesQuery(id: string, label: string, normalized: string): boolean {
  const idFold = foldQuery(id);
  const labelFold = foldQuery(label);
  return idFold === normalized
    || labelFold === normalized
    || labelFold.includes(normalized)
    || normalized.includes(labelFold);
}
