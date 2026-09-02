// 타일셋에 붙는 개념 꾸러미 — 시설 → 장소 → 물건 → 능력 칩.
// 데이터베이스 「임시」 그룹에서 저작하고, place_concept 이 그 나무를 읽어 시공한다.

/** 엔진이 집행할 닫힌 칩. 산문 배치 규칙과 섞지 않는다. */
export const CONCEPT_CHIP_IDS = [
  "pass",
  "block",
  "event",
  "transfer",
  "loot",
  "sleep",
  "floor",
  "wall",
] as const;

export type ConceptChipId = (typeof CONCEPT_CHIP_IDS)[number];

export const CONCEPT_CHIP_LABELS: Record<ConceptChipId, string> = {
  pass: "통행 가능",
  block: "통행 불가",
  event: "이벤트 가능",
  transfer: "맵 연결",
  loot: "노획",
  sleep: "수면",
  floor: "바닥",
  wall: "벽",
};

export function isConceptChipId(value: string): value is ConceptChipId {
  return (CONCEPT_CHIP_IDS as readonly string[]).includes(value);
}

/** 중개념 — 장소에 올 수 있는 물건. 여러 장소에 속할 수 있다. */
export interface ConceptThingRecord {
  id: string;
  label: string;
  /** 같은 타일셋의 구조물/실내 카탈로그 id. 그림의 정본. */
  objectId: string;
  placeIds: string[];
  chips: ConceptChipId[];
  required?: boolean;
}

/** 장소의 도면 역할 — 정문을 품는 홀 / 방을 잇는 복도 / 일반 방. 생략 시 room. */
export const CONCEPT_PLACE_ROLES = ["entrance", "walkway", "room"] as const;
export type ConceptPlaceRole = (typeof CONCEPT_PLACE_ROLES)[number];
export const CONCEPT_PLACE_ROLE_LABELS: Record<ConceptPlaceRole, string> = {
  entrance: "홀(정문)",
  walkway: "복도",
  room: "방",
};
export function isConceptPlaceRole(value: string): value is ConceptPlaceRole {
  return (CONCEPT_PLACE_ROLES as readonly string[]).includes(value);
}

/** 장소의 바닥 크기 힌트. 생략 시 m. */
export const CONCEPT_PLACE_SIZES = ["s", "m", "l"] as const;
export type ConceptPlaceSize = (typeof CONCEPT_PLACE_SIZES)[number];
export const CONCEPT_PLACE_SIZE_LABELS: Record<ConceptPlaceSize, string> = {
  s: "작게",
  m: "보통",
  l: "크게",
};
export function isConceptPlaceSize(value: string): value is ConceptPlaceSize {
  return (CONCEPT_PLACE_SIZES as readonly string[]).includes(value);
}

/** 같은 장소를 몇 개 짓나(객실 ×2). 1..4. */
export const CONCEPT_PLACE_COUNT_MAX = 4;

/** 장소 — 침실·복도처럼 시설이 품는 방. */
export interface ConceptPlaceRecord {
  id: string;
  label: string;
  /** 도면 역할. 생략 시 room. 옛 나무는 라벨(복도·통로)로 복도를 알아본다. */
  role?: ConceptPlaceRole;
  /** 바닥 크기 힌트. 생략 시 m. */
  size?: ConceptPlaceSize;
  /** 같은 장소 개수. 생략 시 1. */
  count?: number;
}

/** 시설 — 여관처럼 꺼내는 꾸러미의 뿌리. */
export interface ConceptFacilityRecord {
  id: string;
  label: string;
  placeIds: string[];
}

/** 한 타일셋의 개념 꾸러미 하나. */
export interface ConceptBundleRecord {
  id: string;
  label: string;
  facilities: ConceptFacilityRecord[];
  places: ConceptPlaceRecord[];
  things: ConceptThingRecord[];
}
