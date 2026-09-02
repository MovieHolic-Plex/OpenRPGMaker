// 타일셋에 붙는 개념 꾸러미 — 시설 → 장소 → 물건 → 능력 칩.
// 데이터베이스 「임시」 그룹에서만 저작한다. 시공 파이프는 아직 이 필드를 읽지 않는다.

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

/** 장소 — 침실·복도처럼 시설이 품는 방. */
export interface ConceptPlaceRecord {
  id: string;
  label: string;
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
