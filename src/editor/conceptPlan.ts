import { isInteriorRoomShape } from "@/project/interiorRoomFootprint";
// LLM 이 설계한 시설 plan → 시공 입력(꾸러미 구조).
//
// 2026-09-03: 「AI 는 소비만」을 철회한다. DB 「맵 → 타일셋 → 개념 꾸러미」의 시설은 **템플릿(출발점)**이고,
// 모델은 요청(방 수·크기·분위기·층·내용물)에 맞게 장소·물건 목록을 고쳐 place_concept 에 plan 으로 넘긴다.
// 좌표·벽·문·이벤트는 여전히 코드(도면기·구성기)가 정한다 — 모델이 좌표를 찍던 옛 경로의 실패를 되풀이하지 않는다.
import type { InteriorObjectDef } from "@/editor/interiorObjectCatalog";
import type { InteriorRoomVocab } from "@/editor/interiorRoomVocab";
import {
  CONCEPT_CHIP_IDS,
  CONCEPT_CHIP_LABELS,
  CONCEPT_FLOOR_MATERIALS,
  CONCEPT_LAYOUT_KINDS,
  CONCEPT_PLACE_COUNT_MAX,
  CONCEPT_PLACE_LEVEL_MAX,
  CONCEPT_PLACE_ROLES,
  CONCEPT_PLACE_SIZES,
  CONCEPT_PLACE_ZONES,
  CONCEPT_WALL_MATERIALS,
  isConceptFloorMaterial,
  isConceptLayoutKind,
  isConceptPlaceLevel,
  isConceptPlaceRole,
  isConceptPlaceSize,
  isConceptPlaceZone,
  isConceptWallMaterial,
  validateConceptChipId,
  type ConceptBundleRecord,
  type ConceptChipId,
  type ConceptFacilityRecord,
  type ConceptPlaceRecord,
  type ConceptThingRecord,
} from "@/project/types/conceptBundle";

export class ConceptPlanError extends Error {
  readonly code = "invalid-plan" as const;
  constructor(message: string) {
    super(message);
    this.name = "ConceptPlanError";
  }
}

/** 모델이 쓸 수 있는 물건 한 줄 — get_concept_facility 가 돌려주고 plan.things[].objectId 가 가리킨다. */
export type ConceptVocabularyEntry = {
  readonly id: string;
  readonly label: string;
  readonly width: number;
  readonly height: number;
  readonly snap: InteriorObjectDef["snap"];
  readonly role: string | null;
  readonly themes: readonly string[];
  readonly description?: string;
  readonly tileIds: readonly number[];
};

/** 타일셋 가구 킷 + 코드 카탈로그 합집합. 같은 id 는 타일셋 것이 이긴다(파이프라인 resolveObject 와 같은 우선순위). */
export function conceptVocabulary(vocab: InteriorRoomVocab, catalog: readonly InteriorObjectDef[]): readonly ConceptVocabularyEntry[] {
  const byId = new Map<string, InteriorObjectDef>();
  for (const object of catalog) byId.set(object.id, object);
  for (const object of vocab.objectsById.values()) byId.set(object.id, object);
  return [...byId.values()].map((object) => ({
    id: object.id,
    label: object.label,
    width: object.width,
    height: object.height,
    snap: object.snap,
    role: object.role,
    themes: object.themes,
    ...(object.description ? { description: object.description } : {}),
    tileIds: [...new Set(object.cells.map(cell => cell.tile))],
  }));
}

/** plan 스키마 설명에 싣는 닫힌 집합 — 모델이 enum 을 추측하지 않게. */
export const CONCEPT_PLAN_ENUMS = {
  roles: CONCEPT_PLACE_ROLES,
  sizes: CONCEPT_PLACE_SIZES,
  floors: CONCEPT_FLOOR_MATERIALS,
  walls: CONCEPT_WALL_MATERIALS,
  chips: CONCEPT_CHIP_IDS,
  chipLabels: CONCEPT_CHIP_LABELS,
  layouts: CONCEPT_LAYOUT_KINDS,
  zones: CONCEPT_PLACE_ZONES,
  countMax: CONCEPT_PLACE_COUNT_MAX,
  levelMax: CONCEPT_PLACE_LEVEL_MAX,
} as const;

export type ParsedConceptPlan = {
  readonly bundle: ConceptBundleRecord;
  readonly facility: ConceptFacilityRecord;
};

type ResolveObject = (objectId: string) => InteriorObjectDef | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, field: string, where: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ConceptPlanError(`plan.${where}.${field} 는 비어 있지 않은 문자열이어야 한다`);
  }
  return value.trim();
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function parsePlace(raw: unknown, index: number): ConceptPlaceRecord {
  const where = `places[${index}]`;
  if (!isRecord(raw)) throw new ConceptPlanError(`plan.${where} 는 객체여야 한다`);
  const id = readString(raw.id, "id", where);
  const label = readOptionalString(raw.label) ?? id;
  const place: ConceptPlaceRecord = { id, label };
  if (raw.role !== undefined) {
    const role = readString(raw.role, "role", where);
    if (!isConceptPlaceRole(role)) throw new ConceptPlanError(`plan.${where}.role="${role}" — 허용: ${CONCEPT_PLACE_ROLES.join("|")}`);
    place.role = role;
  }
  if (raw.shape !== undefined) {
    if (!isInteriorRoomShape(raw.shape)) throw new ConceptPlanError(`plan.${where}.shape — 허용: rect|l|alcove`);
    place.shape = raw.shape;
  }
  if (raw.size !== undefined) {
    const size = readString(raw.size, "size", where);
    if (!isConceptPlaceSize(size)) throw new ConceptPlanError(`plan.${where}.size="${size}" — 허용: ${CONCEPT_PLACE_SIZES.join("|")}`);
    place.size = size;
  }
  if (raw.floor !== undefined) {
    const floor = readString(raw.floor, "floor", where);
    if (!isConceptFloorMaterial(floor)) throw new ConceptPlanError(`plan.${where}.floor="${floor}" — 허용: ${CONCEPT_FLOOR_MATERIALS.join("|")}`);
    place.floor = floor;
  }
  if (raw.count !== undefined) {
    const count = Number(raw.count);
    if (!Number.isInteger(count) || count < 1 || count > CONCEPT_PLACE_COUNT_MAX) {
      throw new ConceptPlanError(`plan.${where}.count=${String(raw.count)} — 1..${CONCEPT_PLACE_COUNT_MAX} 정수`);
    }
    place.count = count;
  }
  if (raw.level !== undefined) {
    const level = Number(raw.level);
    if (!isConceptPlaceLevel(level)) throw new ConceptPlanError(`plan.${where}.level=${String(raw.level)} — 1..${CONCEPT_PLACE_LEVEL_MAX} 정수`);
    place.level = level;
  }
  if (raw.zone !== undefined) {
    const zone = readString(raw.zone, "zone", where);
    if (!isConceptPlaceZone(zone)) throw new ConceptPlanError(`plan.${where}.zone="${zone}" — 허용: ${CONCEPT_PLACE_ZONES.join("|")}`);
    place.zone = zone;
  }
  return place;
}

function parseChips(raw: unknown, where: string): ConceptChipId[] {
  if (!Array.isArray(raw)) throw new ConceptPlanError(`plan.${where}.chips 는 배열이어야 한다 — 내장: ${CONCEPT_CHIP_IDS.join("|")} · 자유 칩(영문·숫자·-_·1~32자)도 된다`);
  const chips: ConceptChipId[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") {
      throw new ConceptPlanError(`plan.${where}.chips 는 빈 문자열 아닌 칩 id 배열이어야 한다`);
    }
    const validated = validateConceptChipId(entry);
    if (!validated.ok) throw new ConceptPlanError(`plan.${where}.chips: ${validated.error}`);
    if (!chips.includes(validated.value)) chips.push(validated.value);
  }
  return chips;
}

function parseThing(
  raw: unknown,
  index: number,
  placeIds: ReadonlySet<string>,
  usedIds: Set<string>,
  resolveObject: ResolveObject,
): ConceptThingRecord {
  const where = `things[${index}]`;
  if (!isRecord(raw)) throw new ConceptPlanError(`plan.${where} 는 객체여야 한다`);
  const objectId = readString(raw.objectId, "objectId", where);
  const object = resolveObject(objectId);
  if (!object) {
    throw new ConceptPlanError(`plan.${where}.objectId="${objectId}" 는 이 타일셋 물건 어휘에 없다 — get_concept_facility 의 vocabulary[].id 중에서 고르라`);
  }
  if (!Array.isArray(raw.placeIds) || raw.placeIds.length === 0) {
    throw new ConceptPlanError(`plan.${where}.placeIds 는 장소 id 배열(1개 이상)이어야 한다`);
  }
  const thingPlaceIds: string[] = [];
  for (const entry of raw.placeIds) {
    if (typeof entry !== "string" || !placeIds.has(entry)) {
      throw new ConceptPlanError(`plan.${where}.placeIds 의 "${String(entry)}" 는 plan.places 에 없는 장소다`);
    }
    if (!thingPlaceIds.includes(entry)) thingPlaceIds.push(entry);
  }
  const chips = parseChips(raw.chips ?? [], where);
  let id = readOptionalString(raw.id) ?? objectId;
  let ordinal = 2;
  while (usedIds.has(id)) id = `${objectId}_${ordinal++}`;
  usedIds.add(id);
  return {
    id,
    label: readOptionalString(raw.label) ?? object.label,
    objectId,
    placeIds: thingPlaceIds,
    chips,
    ...(raw.required === true ? { required: true } : {}),
  };
}

/**
 * plan → 합성 꾸러미. 시설 id/라벨은 템플릿(있으면)을 물려받아 결과 데이터(`facilityId`)가 종전과 같은 모양을 유지한다.
 * 검증 실패는 ConceptPlanError 로 던진다 — 모델이 바로 고쳐 재시도할 수 있게 어긋난 필드와 허용값을 문장에 담는다.
 */
export function parseConceptPlan(
  raw: unknown,
  options: {
    readonly facilityId: string;
    readonly facilityLabel: string;
    readonly bundleId: string;
    readonly resolveObject: ResolveObject;
  },
): ParsedConceptPlan {
  if (!isRecord(raw)) throw new ConceptPlanError("plan 은 { places: [...], things: [...] } 객체여야 한다");
  if (!Array.isArray(raw.places) || raw.places.length === 0) {
    throw new ConceptPlanError("plan.places 는 장소 1개 이상의 배열이어야 한다 — 정문을 품는 장소(role=entrance) 하나를 포함하라");
  }
  const places = raw.places.map((entry, index) => parsePlace(entry, index));
  const placeIds = new Set<string>();
  for (const place of places) {
    if (placeIds.has(place.id)) throw new ConceptPlanError(`plan.places 에 장소 id "${place.id}" 가 중복된다`);
    placeIds.add(place.id);
  }
  const thingsRaw = raw.things ?? [];
  if (!Array.isArray(thingsRaw)) throw new ConceptPlanError("plan.things 는 배열이어야 한다");
  const usedIds = new Set<string>();
  const things = thingsRaw.map((entry, index) => parseThing(entry, index, placeIds, usedIds, options.resolveObject));

  const facility: ConceptFacilityRecord = {
    id: options.facilityId,
    label: options.facilityLabel,
    placeIds: places.map((place) => place.id),
  };
  if (raw.wall !== undefined) {
    const wall = readString(raw.wall, "wall", "facility");
    if (!isConceptWallMaterial(wall)) throw new ConceptPlanError(`plan.wall="${wall}" — 허용: ${CONCEPT_WALL_MATERIALS.join("|")}`);
    facility.wall = wall;
  }
  if (raw.layout !== undefined) {
    const layout = readString(raw.layout, "layout", "facility");
    if (!isConceptLayoutKind(layout)) throw new ConceptPlanError(`plan.layout="${layout}" — 허용: ${CONCEPT_LAYOUT_KINDS.join("|")}`);
    facility.layout = layout;
  }
  const bundle: ConceptBundleRecord = {
    id: options.bundleId,
    label: options.facilityLabel,
    facilities: [facility],
    places,
    things,
  };
  return { bundle, facility };
}

/** 템플릿이 필수로 박은 물건 중 설계에서 빠진 것 — 경고 문장. 거부하지 않는다(모델의 재량이되 숨기지 않는다). */
export function missingRequiredFromTemplate(template: ConceptBundleRecord, templateFacility: ConceptFacilityRecord, plan: ConceptBundleRecord): string[] {
  const planned = new Set(plan.things.map((thing) => thing.objectId));
  return template.things
    .filter((thing) => thing.required && thing.placeIds.some((placeId) => templateFacility.placeIds.includes(placeId)))
    .filter((thing) => !planned.has(thing.objectId))
    .map((thing) => `concept: 템플릿 필수 물건 「${thing.label}」(${thing.objectId})이 설계에서 빠졌다 — 의도가 아니면 plan.things 에 넣어라`);
}

/** 템플릿 시설을 plan 과 같은 모양으로 — get_concept_facility 응답. 모델이 이걸 고쳐 그대로 되돌려 보낸다. */
export function facilityAsPlan(bundle: ConceptBundleRecord, facility: ConceptFacilityRecord): {
  readonly wall: ConceptFacilityRecord["wall"];
  readonly layout: ConceptFacilityRecord["layout"];
  readonly places: readonly ConceptPlaceRecord[];
  readonly things: readonly ConceptThingRecord[];
} {
  const places = facility.placeIds
    .map((placeId) => bundle.places.find((place) => place.id === placeId))
    .filter((place): place is ConceptPlaceRecord => place !== undefined);
  const placeIds = new Set(places.map((place) => place.id));
  const things = bundle.things
    .filter((thing) => thing.placeIds.some((placeId) => placeIds.has(placeId)))
    .map((thing) => ({ ...thing, placeIds: thing.placeIds.filter((placeId) => placeIds.has(placeId)) }));
  return { wall: facility.wall, layout: facility.layout, places, things };
}
