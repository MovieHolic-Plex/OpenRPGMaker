// 실내 칩셋용 개념 꾸러미 초안 묶음. 시설마다 장소·가구 구성과 재질을 갖는다.
// 장소 id 는 가능하면 BUILTIN_INTERIOR_ROOM_KINDS 와, 물건 objectId 는 INTERIOR_OBJECT_CATALOG 와 맞춘다.
// 여기 값은 「초안」이다. 프로젝트에 시드된 뒤에는 tileset.scratchConceptBundles 가 정본이고,
// 사용자가 데이터베이스 「맵 → 타일셋 → 개념 꾸러미」에서 고친 나무를 place_concept 이 그대로 읽는다.
//
// 도면은 장소의 역할·크기·개수로만 결정된다(conceptBundleResolve.layoutConceptFacility):
//   방 줄(room) → 3행 파티션 → 복도(walkway) → 3행 파티션 → 홀(entrance, 정문 남쪽).
// 물건은 슬롯 구성(interiorConceptCompose)이 앉힌다 — 북벽 가구·벽걸이·키 큰 가구·바닥·구석·러그.
// 한 방의 북쪽 행은 정문/입구 통로 열을 빼고 s 4 · m 6 · l 8 칸이다. 초안은 그 안에서 짠다.
import type { ConceptBundleRecord } from "@/project/types/conceptBundle";
import { cloneConceptBundle, SCRATCH_INN_BUNDLE } from "./scratchInnBundle";
import { EXPANDED_CONCEPT_FACILITIES } from "./conceptFacilityExpansion";

export const SCRATCH_HOUSE_BUNDLE: ConceptBundleRecord = {
  id: "house",
  label: "민가",
  facilities: [{ id: "house", label: "민가", placeIds: ["bedroom", "kitchen", "living"] }],
  places: [
    { id: "bedroom", label: "침방", role: "room", size: "s" },
    { id: "kitchen", label: "부엌", role: "room", size: "s", floor: "plank" },
    { id: "living", label: "거실", role: "entrance", size: "l" },
  ],
  things: [
    { id: "bed_v", label: "침대(세로)", objectId: "bed_v", placeIds: ["bedroom"], chips: ["block", "event"], required: true },
    { id: "box", label: "잡화 상자", objectId: "box", placeIds: ["bedroom"], chips: ["block", "loot"] },
    { id: "window", label: "창문", objectId: "window", placeIds: ["bedroom", "kitchen", "living"], chips: ["wall"] },
    { id: "stove", label: "화덕", objectId: "stove", placeIds: ["kitchen"], chips: ["block", "event"], required: true },
    { id: "cauldron", label: "가마솥", objectId: "cauldron", placeIds: ["kitchen"], chips: ["block"] },
    { id: "shelf_jars", label: "항아리 선반", objectId: "shelf_jars", placeIds: ["kitchen"], chips: ["wall"] },
    { id: "bucket", label: "물통", objectId: "bucket", placeIds: ["kitchen"], chips: ["block"] },
    { id: "table_chairs", label: "식탁과 의자", objectId: "dining_table", placeIds: ["living"], chips: ["block", "event"], required: true },
    { id: "cabinet", label: "캐비닛", objectId: "cabinet", placeIds: ["living"], chips: ["block", "loot"] },
    { id: "picture", label: "그림", objectId: "picture", placeIds: ["living"], chips: ["wall"] },
    { id: "rug_mat", label: "짚 돗자리", objectId: "rug_mat", placeIds: ["living"], chips: ["pass", "floor"] },
    { id: "clock", label: "거실 괘종시계", objectId: "clock", placeIds: ["living"], chips: ["wall", "event"] },
    { id: "bedroom_rug", label: "침실 돗자리", objectId: "rug_mat", placeIds: ["bedroom"], chips: ["pass", "floor"] },
  ],
};

export const SCRATCH_SHOP_BUNDLE: ConceptBundleRecord = {
  id: "shop",
  label: "상점",
  facilities: [{ id: "shop", label: "상점", placeIds: ["stock", "salesfloor"] }],
  places: [
    { id: "stock", label: "물품 창고", role: "room", size: "s" },
    { id: "salesfloor", label: "매장", role: "entrance", size: "l", floor: "plank" },
  ],
  things: [
    { id: "counter", label: "계산대", objectId: "counter", placeIds: ["salesfloor"], chips: ["block", "event"], required: true },
    { id: "display", label: "진열대", objectId: "display", placeIds: ["salesfloor"], chips: ["block", "event"] },
    { id: "fruit_shelf", label: "과일 선반", objectId: "fruit_shelf", placeIds: ["salesfloor"], chips: ["wall"] },
    { id: "shelf_jars", label: "항아리 선반", objectId: "shelf_jars", placeIds: ["salesfloor", "stock"], chips: ["wall"] },
    { id: "window", label: "창문", objectId: "window", placeIds: ["salesfloor"], chips: ["wall"] },
    { id: "barrel", label: "술통", objectId: "barrel", placeIds: ["salesfloor", "stock"], chips: ["block"] },
    { id: "box", label: "잡화 상자", objectId: "box", placeIds: ["salesfloor"], chips: ["block"] },
    { id: "sales_table", label: "상품 진열 탁자", objectId: "table_wood", placeIds: ["salesfloor"], chips: ["block", "event"], required: true },
    { id: "goods_jars", label: "판매용 항아리", objectId: "jars", placeIds: ["salesfloor"], chips: ["block"] },
    { id: "crate", label: "나무 상자", objectId: "crate", placeIds: ["stock"], chips: ["block", "loot"] },
    { id: "grain", label: "곡물 자루", objectId: "grain", placeIds: ["stock"], chips: ["block"] },
    { id: "ladder", label: "사다리", objectId: "ladder", placeIds: ["stock"], chips: ["wall"] },
  ],
};

export const SCRATCH_TAVERN_BUNDLE: ConceptBundleRecord = {
  id: "tavern",
  label: "술집",
  facilities: [{ id: "tavern", label: "술집", placeIds: ["kitchen", "guestroom", "hall"] }],
  places: [
    { id: "kitchen", label: "주방", role: "room", size: "s", floor: "plank" },
    { id: "guestroom", label: "객실", role: "room", size: "s" },
    { id: "hall", label: "홀", role: "entrance", size: "l" },
  ],
  things: [
    { id: "counter", label: "술 카운터", objectId: "counter", placeIds: ["hall"], chips: ["block", "event"], required: true },
    { id: "table_chairs", label: "탁자와 의자", objectId: "dining_table", placeIds: ["hall"], chips: ["block"] },
    { id: "hall_rug", label: "손님 좌석 돗자리", objectId: "rug_mat", placeIds: ["hall"], chips: ["pass", "floor"] },
    { id: "stool", label: "스툴", objectId: "stool", placeIds: ["hall"], chips: ["block"] },
    { id: "barrel", label: "술통", objectId: "barrel", placeIds: ["hall", "kitchen"], chips: ["block"] },
    { id: "tavern_sign", label: "간판", objectId: "tavern_sign", placeIds: ["hall"], chips: ["wall"] },
    { id: "piano", label: "피아노", objectId: "piano", placeIds: ["hall"], chips: ["block", "event"] },
    { id: "window", label: "창문", objectId: "window", placeIds: ["hall", "guestroom"], chips: ["wall"] },
    { id: "stove", label: "화덕", objectId: "stove", placeIds: ["kitchen"], chips: ["block", "event"], required: true },
    { id: "cauldron", label: "가마솥", objectId: "cauldron", placeIds: ["kitchen"], chips: ["block"] },
    { id: "kettle", label: "항아리", objectId: "kettle", placeIds: ["kitchen"], chips: ["block"] },
    { id: "shelf_jars", label: "항아리 선반", objectId: "shelf_jars", placeIds: ["kitchen"], chips: ["wall"] },
    { id: "bed_h", label: "침대(가로)", objectId: "bed_h", placeIds: ["guestroom"], chips: ["block", "event", "sleep"], required: true },
    { id: "box", label: "잡화 상자", objectId: "box", placeIds: ["guestroom"], chips: ["block", "loot"] },
    { id: "rug_mat", label: "짚 돗자리", objectId: "rug_mat", placeIds: ["guestroom"], chips: ["pass", "floor"] },
  ],
};

export const SCRATCH_LIBRARY_BUNDLE: ConceptBundleRecord = {
  id: "library",
  label: "서재",
  facilities: [{ id: "library", label: "서재", placeIds: ["study", "reading"] }],
  places: [
    { id: "study", label: "개인 서재", role: "room", size: "m" },
    { id: "reading", label: "열람실", role: "entrance", size: "l", shape: "alcove", floor: "plank" },
  ],
  things: [
    { id: "bookshelf_west", label: "책장(서)", objectId: "bookshelf", placeIds: ["reading"], chips: ["block", "event"], required: true },
    { id: "bookshelf_east", label: "책장(동)", objectId: "bookshelf", placeIds: ["reading"], chips: ["block", "event"] },
    { id: "table_chairs", label: "열람 탁자", objectId: "reading_table", placeIds: ["reading"], chips: ["block"] },
    { id: "clock", label: "괘종시계", objectId: "clock", placeIds: ["reading"], chips: ["wall", "event"] },
    { id: "window", label: "창문", objectId: "window", placeIds: ["reading", "study"], chips: ["wall"] },
    { id: "bookshelf", label: "책장", objectId: "bookshelf", placeIds: ["study"], chips: ["block", "event"], required: true },
    { id: "crystal", label: "수정구", objectId: "crystal", placeIds: ["study"], chips: ["block", "event"] },
    { id: "picture", label: "그림", objectId: "picture", placeIds: ["study"], chips: ["wall"] },
    { id: "box", label: "잡화 상자", objectId: "box", placeIds: ["study"], chips: ["block"] },
    { id: "study_table", label: "집필 책상과 의자", objectId: "table_chairs", placeIds: ["study"], chips: ["block", "event"], required: true },
  ],
};

export const SCRATCH_SMITHY_BUNDLE: ConceptBundleRecord = {
  id: "smithy",
  label: "대장간",
  facilities: [{ id: "smithy", label: "대장간", placeIds: ["store", "workshop"], wall: "stone-brick" }],
  places: [
    { id: "store", label: "자재 창고", role: "room", size: "s" },
    { id: "workshop", label: "작업장", role: "entrance", size: "l", floor: "stone" },
  ],
  things: [
    { id: "stove", label: "화덕(단조로)", objectId: "stove", placeIds: ["workshop"], chips: ["block", "event"], required: true },
    { id: "counter", label: "단조 작업대와 도구", objectId: "work_table", placeIds: ["workshop"], chips: ["block", "event"] },
    { id: "armor", label: "갑옷 전시대", objectId: "armor", placeIds: ["workshop"], chips: ["block", "event"] },
    { id: "sword_rack", label: "검 거치대", objectId: "sword_rack", placeIds: ["workshop"], chips: ["wall"] },
    { id: "bucket", label: "물통", objectId: "bucket", placeIds: ["workshop"], chips: ["block"] },
    { id: "work_table", label: "금속 세공 작업대", objectId: "work_table", placeIds: ["workshop"], chips: ["block", "event"], required: true },
    { id: "work_stool", label: "작업 의자", objectId: "stool", placeIds: ["workshop"], chips: ["block"] },
    { id: "work_crate", label: "작업 중인 자재", objectId: "crate", placeIds: ["workshop"], chips: ["block"] },
    { id: "forge_pot", label: "단조로 작업 솥", objectId: "cauldron", placeIds: ["workshop"], chips: ["block"] },
    { id: "barrel", label: "술통", objectId: "barrel", placeIds: ["workshop", "store"], chips: ["block"] },
    { id: "crate", label: "나무 상자", objectId: "crate", placeIds: ["store"], chips: ["block"] },
    { id: "box", label: "잡화 상자", objectId: "box", placeIds: ["store"], chips: ["block", "loot"] },
    { id: "grain", label: "곡물 자루", objectId: "grain", placeIds: ["store"], chips: ["block"] },
    { id: "ladder", label: "사다리", objectId: "ladder", placeIds: ["store"], chips: ["wall"] },
  ],
};

export const SCRATCH_CHURCH_BUNDLE: ConceptBundleRecord = {
  id: "church",
  label: "교회",
  facilities: [{ id: "church", label: "교회", placeIds: ["vestry", "chapel"] }],
  places: [
    { id: "vestry", label: "사제실", role: "room", size: "s" },
    { id: "chapel", label: "예배당", role: "entrance", size: "l", shape: "alcove", floor: "stone" },
  ],
  things: [
    { id: "religious", label: "성상", objectId: "religious", placeIds: ["chapel", "vestry"], chips: ["wall", "event"], required: true },
    { id: "altar", label: "제단과 촛대", objectId: "altar_table", placeIds: ["chapel"], chips: ["block", "event"] },
    { id: "bust_west", label: "흉상(서)", objectId: "bust", placeIds: ["chapel"], chips: ["block", "event"] },
    { id: "bust_east", label: "흉상(동)", objectId: "bust", placeIds: ["chapel"], chips: ["block"] },
    { id: "rug_red", label: "붉은 카펫", objectId: "rug_red", placeIds: ["chapel"], chips: ["pass", "floor"] },
    { id: "picture", label: "그림", objectId: "picture", placeIds: ["chapel", "vestry"], chips: ["wall"] },
    { id: "plant", label: "화분", objectId: "plant", placeIds: ["chapel"], chips: ["block"] },
    { id: "pew_west", label: "서쪽 예배 좌석", objectId: "table_chairs", placeIds: ["chapel"], chips: ["block"] },
    { id: "pew_east", label: "동쪽 예배 좌석", objectId: "table_chairs", placeIds: ["chapel"], chips: ["block"] },
    { id: "bed_v", label: "침대(세로)", objectId: "bed_v", placeIds: ["vestry"], chips: ["block", "event"] },
    { id: "cabinet", label: "캐비닛", objectId: "cabinet", placeIds: ["vestry"], chips: ["block", "loot"] },
    { id: "box", label: "잡화 상자", objectId: "box", placeIds: ["vestry"], chips: ["block"] },
  ],
};

export const SCRATCH_WAREHOUSE_BUNDLE: ConceptBundleRecord = {
  id: "warehouse",
  label: "창고",
  facilities: [{ id: "warehouse", label: "창고", placeIds: ["hall"] }],
  places: [
    { id: "hall", label: "보관실", role: "entrance", size: "l", floor: "plank" },
  ],
  things: [
    { id: "crate_a", label: "나무 상자", objectId: "crate", placeIds: ["hall"], chips: ["block", "loot"], required: true },
    { id: "crate_b", label: "나무 상자(둘째)", objectId: "crate", placeIds: ["hall"], chips: ["block"] },
    { id: "crate_c", label: "보관 상자 셋째", objectId: "crate", placeIds: ["hall"], chips: ["block"] },
    { id: "crate_d", label: "보관 상자 넷째", objectId: "crate", placeIds: ["hall"], chips: ["block"] },
    { id: "crate_e", label: "보관 상자 다섯째", objectId: "crate", placeIds: ["hall"], chips: ["block"] },
    { id: "crate_f", label: "보관 상자 여섯째", objectId: "crate", placeIds: ["hall"], chips: ["block"] },
    { id: "barrel_a", label: "술통", objectId: "barrel", placeIds: ["hall"], chips: ["block", "loot"] },
    { id: "barrel_b", label: "술통(둘째)", objectId: "barrel", placeIds: ["hall"], chips: ["block"] },
    { id: "barrel_c", label: "보관 술통 셋째", objectId: "barrel", placeIds: ["hall"], chips: ["block"] },
    { id: "barrel_d", label: "보관 술통 넷째", objectId: "barrel", placeIds: ["hall"], chips: ["block"] },
    { id: "grain", label: "곡물 자루", objectId: "grain", placeIds: ["hall"], chips: ["block"] },
    { id: "box", label: "잡화 상자", objectId: "box", placeIds: ["hall"], chips: ["block", "loot"] },
    { id: "ladder", label: "사다리", objectId: "ladder", placeIds: ["hall"], chips: ["wall"] },
    { id: "shelf_jars", label: "항아리 선반", objectId: "shelf_jars", placeIds: ["hall"], chips: ["wall"] },
    { id: "window", label: "창문", objectId: "window", placeIds: ["hall"], chips: ["wall"] },
  ],
};

export const SCRATCH_GUILD_BUNDLE: ConceptBundleRecord = {
  id: "guild",
  label: "길드",
  facilities: [{ id: "guild", label: "길드", placeIds: ["meeting", "records", "front"], wall: "gold-brick" }],
  places: [
    { id: "meeting", label: "회의실", role: "room", size: "l" },
    { id: "records", label: "의뢰 기록실", role: "room", size: "m" },
    { id: "front", label: "접수홀", role: "entrance", size: "l", floor: "plank" },
  ],
  things: [
    { id: "counter", label: "접수 카운터", objectId: "counter", placeIds: ["front"], chips: ["block", "event"], required: true },
    { id: "display", label: "의뢰 진열대", objectId: "display", placeIds: ["front"], chips: ["block", "event"] },
    { id: "armor", label: "갑옷 전시대", objectId: "armor", placeIds: ["front"], chips: ["block", "event"] },
    { id: "sword_rack", label: "검 거치대", objectId: "sword_rack", placeIds: ["front"], chips: ["wall"] },
    { id: "table_chairs", label: "대기 탁자", objectId: "table_chairs", placeIds: ["front"], chips: ["block"] },
    { id: "plant", label: "화분", objectId: "plant", placeIds: ["front"], chips: ["block"] },
    { id: "window", label: "창문", objectId: "window", placeIds: ["front", "meeting"], chips: ["wall"] },
    { id: "bust", label: "흉상", objectId: "bust", placeIds: ["front"], chips: ["block", "event"] },
    { id: "table_long", label: "회의 탁자와 좌석", objectId: "table_chairs", placeIds: ["meeting"], chips: ["block"], required: true },
    { id: "bookshelf", label: "서류 책장", objectId: "bookshelf", placeIds: ["records"], chips: ["block", "event"] },
    { id: "records_table", label: "의뢰 기록 책상", objectId: "table_chairs", placeIds: ["records"], chips: ["block", "event"] },
    { id: "clock", label: "괘종시계", objectId: "clock", placeIds: ["meeting"], chips: ["wall", "event"] },
    { id: "picture", label: "그림", objectId: "picture", placeIds: ["meeting"], chips: ["wall"] },
    { id: "rug_red", label: "붉은 카펫", objectId: "rug_red", placeIds: ["meeting"], chips: ["pass", "floor"] },
  ],
};

/** 실내 칩셋에 시드되는 초안 순서. 여관이 첫째다(옛 시드·e2e 와 같은 자리). */
export const CONCEPT_FACILITY_TEMPLATES: readonly ConceptBundleRecord[] = [
  SCRATCH_INN_BUNDLE,
  SCRATCH_HOUSE_BUNDLE,
  SCRATCH_SHOP_BUNDLE,
  SCRATCH_TAVERN_BUNDLE,
  SCRATCH_LIBRARY_BUNDLE,
  SCRATCH_SMITHY_BUNDLE,
  SCRATCH_CHURCH_BUNDLE,
  SCRATCH_WAREHOUSE_BUNDLE,
  SCRATCH_GUILD_BUNDLE,
  ...EXPANDED_CONCEPT_FACILITIES,
];

export function conceptFacilityTemplateById(id: string): ConceptBundleRecord | undefined {
  return CONCEPT_FACILITY_TEMPLATES.find((bundle) => bundle.id === id);
}

/** 초안 전부의 깊은 복사 — 시드 값으로 쓴다. */
export function cloneConceptFacilityTemplates(): ConceptBundleRecord[] {
  return CONCEPT_FACILITY_TEMPLATES.map(cloneConceptBundle);
}

/** 초안 시설명(여관·민가·상점…). 툴 설명·프롬프트 검사가 참조한다. */
export function conceptFacilityTemplateLabels(): readonly string[] {
  return CONCEPT_FACILITY_TEMPLATES.flatMap((bundle) => bundle.facilities.map((facility) => facility.label));
}
