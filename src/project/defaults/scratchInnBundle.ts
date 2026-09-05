// 실내 칩셋용 여관 꾸러미 초안.
// 장소·물건 id 는 BUILTIN_INTERIOR_ROOM_KINDS / INTERIOR_OBJECT_CATALOG 와 맞춘다.
import type { ConceptBundleRecord } from "@/project/types/conceptBundle";

export const SCRATCH_INN_BUNDLE_ID = "inn";

export const SCRATCH_INN_BUNDLE: ConceptBundleRecord = {
  id: SCRATCH_INN_BUNDLE_ID,
  label: "여관",
  facilities: [
    { id: "inn", label: "여관", layout: "double-row", placeIds: ["kitchen", "pantry", "dining", "reception", "dorm", "merchant", "corridor", "single", "landing", "suite", "attic"] },
  ],
  // 1층 영업 → 2층 서로 다른 숙박객 → 3층 다락. 반복 객실 대신 장소별 구성을 고른다.
  places: [
    { id: "kitchen", label: "식당 뒤 여관 주방", role: "room", size: "l", zone: "north", floor: "stone" },
    { id: "pantry", label: "계단 밑 짐 보관방", role: "room", size: "s", zone: "north", floor: "plank" },
    { id: "dining", label: "공용 식당", role: "room", size: "l", shape: "alcove", zone: "south", floor: "wood" },
    { id: "reception", label: "난로가 있는 접수 홀", role: "entrance", size: "l", floor: "plank" },
    { id: "dorm", label: "길손의 다인실", role: "room", size: "m", zone: "north", floor: "mat", level: 2 },
    { id: "merchant", label: "상인의 꺾인 모퉁이방", role: "room", size: "s", shape: "l", zone: "north", floor: "wood", level: 2 },
    { id: "corridor", label: "다락으로 이어지는 복도", role: "walkway", floor: "plank", level: 2 },
    { id: "single", label: "계단 옆 작은 독실", role: "room", size: "s", zone: "south", floor: "plank", level: 2 },
    { id: "landing", label: "창가 의자가 있는 계단참", role: "entrance", size: "m", floor: "wood", level: 2 },
    { id: "suite", label: "햇살이 드는 알코브 객실", role: "room", size: "m", shape: "alcove", zone: "south", floor: "wood", level: 2 },
    { id: "attic", label: "옛 간판과 여행 기록의 다락", role: "entrance", size: "m", shape: "l", floor: "plank", level: 3 },
  ],
  things: [
    { id: "dorm_bed_a", label: "먼 길을 걸어온 길손의 침대", objectId: "bed_v", placeIds: ["dorm"], chips: ["block", "event"], required: true },
    { id: "dorm_bed_b", label: "아직 주인이 돌아오지 않은 침대", objectId: "bed_v", placeIds: ["dorm"], chips: ["block", "event"], required: true },
    { id: "dorm_bag", label: "비에 젖은 여행 가방", objectId: "box", placeIds: ["dorm"], chips: ["block", "event"] },
    { id: "merchant_bed", label: "상인의 가로 침대", objectId: "bed_h", placeIds: ["merchant"], chips: ["block", "event"], required: true },
    { id: "merchant_ledger", label: "호수 건너 거래를 적은 장부", objectId: "teacher_desk", placeIds: ["merchant"], chips: ["block", "event"], required: true },
    { id: "merchant_crate", label: "목적지가 서로 다른 운송 상자", objectId: "crate", placeIds: ["merchant"], chips: ["block", "event"] },
    { id: "single_bed", label: "해진 이불의 작은 침대", objectId: "bed_v", placeIds: ["single"], chips: ["block", "event"], required: true },
    { id: "single_box", label: "편지 한 장을 남겨 둔 머리맡 상자", objectId: "box", placeIds: ["single"], chips: ["block", "event"] },
    { id: "suite_bed", label: "햇볕에 말린 이불의 침대", objectId: "bed_h", placeIds: ["suite"], chips: ["block", "event"], required: true },
    { id: "suite_tea", label: "창가에서 차를 마시는 자리", objectId: "tea_table", placeIds: ["suite"], chips: ["block", "event"], required: true },
    { id: "suite_storage", label: "손님의 옷을 넣는 옷장", objectId: "cabinet", placeIds: ["suite"], chips: ["block", "event"] },
    { id: "guest_window", label: "마을을 내다보는 객실 창문", objectId: "window", placeIds: ["dorm", "merchant", "single", "suite", "landing"], chips: ["wall"], required: true },
    { id: "hall_clock", label: "공용 시계", objectId: "clock", placeIds: ["corridor"], chips: ["wall"] },
    { id: "upper_stair", label: "다락으로 올라가는 벽 계단", objectId: "stairs_horizontal", placeIds: ["corridor"], chips: ["pass", "transfer"], required: true },
    { id: "down_stair", label: "아래층으로 이어지는 계단실", objectId: "stairs_down", placeIds: ["landing", "attic"], chips: ["pass", "event"], required: true },
    { id: "landing_seat", label: "아래층 소리를 들으며 쉬는 의자", objectId: "stool", placeIds: ["landing"], chips: ["block", "event"] },
    { id: "landing_plant", label: "창가에서 키우는 화분", objectId: "plant", placeIds: ["landing"], chips: ["block"] },
    { id: "front_desk", label: "숙박 접수대와 장부", objectId: "teacher_desk", placeIds: ["reception"], chips: ["block", "sleep"], required: true },
    { id: "main_stair", label: "객실 층으로 올라가는 돌계단", objectId: "stairs_horizontal", placeIds: ["reception"], chips: ["pass", "transfer"], required: true },
    { id: "hearth", label: "길손의 젖은 옷을 말리는 난로", objectId: "stove", placeIds: ["reception"], chips: ["block", "event"], required: true },
    { id: "waiting_seats", label: "접수대 앞 작은 대기석", objectId: "table_chairs", placeIds: ["reception"], chips: ["block"], required: true },
    { id: "lobby_plant", label: "입구 화분", objectId: "plant", placeIds: ["reception"], chips: ["block"] },
    { id: "dining_seats", label: "식기와 식사가 놓인 공용 식탁", objectId: "dining_table", placeIds: ["dining"], chips: ["block", "event"], required: true },
    { id: "extra_dining_seats", label: "추가 식사 자리", objectId: "table_chairs", placeIds: ["dining"], chips: ["block"], required: true },
    { id: "dining_window", label: "식당 창문", objectId: "window", placeIds: ["dining"], chips: ["wall"] },
    { id: "dishes", label: "그릇 보관장", objectId: "cabinet", placeIds: ["dining"], chips: ["block", "event"] },
    { id: "cooking_stove", label: "손님 식사를 만드는 화덕", objectId: "stove", placeIds: ["kitchen"], chips: ["block", "event"], required: true },
    { id: "kitchen_counter", label: "주방 작업대", objectId: "counter", placeIds: ["kitchen"], chips: ["block"], required: true },
    { id: "prep_table", label: "식재료 손질용 흰 작업대", objectId: "table_white", placeIds: ["kitchen"], chips: ["block"], required: true },
    { id: "kitchen_shelf", label: "주방 항아리 선반", objectId: "shelf_jars", placeIds: ["kitchen"], chips: ["wall"] },
    { id: "food_sack", label: "식재료 곡물 자루", objectId: "grain", placeIds: ["kitchen"], chips: ["block"] },
    { id: "water", label: "취사용 물통", objectId: "bucket", placeIds: ["kitchen"], chips: ["block"] },
    { id: "stored_luggage", label: "이름표를 매단 맡긴 짐", objectId: "crate", placeIds: ["pantry"], chips: ["block", "event"], required: true },
    { id: "spare_linen", label: "손님을 위해 개어 둔 여분 침구", objectId: "cabinet", placeIds: ["attic"], chips: ["block", "event"], required: true },
    { id: "old_sign", label: "여관의 예전 이름이 적힌 간판", objectId: "tavern_sign", placeIds: ["attic"], chips: ["wall", "event"], required: true },
    { id: "travel_records", label: "주인이 젊을 때 모은 여행 기록", objectId: "bookshelf", placeIds: ["attic"], chips: ["block", "event"], required: true },
    { id: "attic_window", label: "지붕 가까이 난 작은 창", objectId: "window", placeIds: ["attic"], chips: ["wall"] },
  ],
};

export function cloneConceptBundle(bundle: ConceptBundleRecord): ConceptBundleRecord {
  return {
    id: bundle.id,
    label: bundle.label,
    facilities: bundle.facilities.map((facility) => ({
      id: facility.id,
      label: facility.label,
      placeIds: [...facility.placeIds],
      ...(facility.wall ? { wall: facility.wall } : {}),
      ...(facility.layout ? { layout: facility.layout } : {}),
    })),
    places: bundle.places.map((place) => ({
      id: place.id,
      label: place.label,
      ...(place.role ? { role: place.role } : {}),
      ...(place.size ? { size: place.size } : {}),
      ...(place.shape ? { shape: place.shape } : {}),
      ...(place.count !== undefined ? { count: place.count } : {}),
      ...(place.floor ? { floor: place.floor } : {}),
      ...(place.level !== undefined ? { level: place.level } : {}),
      ...(place.zone ? { zone: place.zone } : {}),
    })),
    things: bundle.things.map((thing) => ({
      id: thing.id,
      label: thing.label,
      objectId: thing.objectId,
      placeIds: [...thing.placeIds],
      chips: [...thing.chips],
      ...(thing.required ? { required: true } : {}),
    })),
  };
}
