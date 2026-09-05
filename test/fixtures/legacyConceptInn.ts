// 이전에 저작된 여관의 편집·칩·층 연결 호환성용 최소 fixture. 출하 기본 꾸러미가 아니다.
// 장소·물건 id 는 BUILTIN_INTERIOR_ROOM_KINDS / INTERIOR_OBJECT_CATALOG 와 맞춘다.
import type { ConceptBundleRecord } from "@/project/types/conceptBundle";

export const SCRATCH_INN_BUNDLE_ID = "inn";

export const SCRATCH_INN_BUNDLE: ConceptBundleRecord = {
  id: SCRATCH_INN_BUNDLE_ID,
  label: "여관",
  facilities: [
    { id: "inn", label: "여관", placeIds: ["bedroom", "corridor", "dining"] },
  ],
  // 도면: 객실 ×2(보통) → 복도 → 식당/홀(크게, 정문). 남쪽에서 들어와 홀 → 복도 → 객실.
  places: [
    { id: "bedroom", label: "침실", role: "room", size: "m", count: 2 },
    { id: "corridor", label: "복도", role: "walkway" },
    { id: "dining", label: "식당/홀", role: "entrance", size: "l", shape: "l" },
  ],
  things: [
    { id: "bed_h", label: "침대(가로)", objectId: "bed_h", placeIds: ["bedroom"], chips: ["block", "event", "sleep"], required: true },
    { id: "bed_v", label: "침대(세로)", objectId: "bed_v", placeIds: ["bedroom"], chips: ["block", "event", "sleep"] },
    { id: "rug", label: "러그", objectId: "rug", placeIds: ["bedroom"], chips: ["pass", "floor"] },
    { id: "clock", label: "괘종시계", objectId: "clock", placeIds: ["bedroom"], chips: ["wall", "event"] },
    { id: "cabinet", label: "캐비닛", objectId: "cabinet", placeIds: ["bedroom"], chips: ["block", "loot"] },
    { id: "window", label: "창문", objectId: "window", placeIds: ["bedroom", "corridor", "dining"], chips: ["wall"] },
    { id: "picture", label: "그림", objectId: "picture", placeIds: ["bedroom"], chips: ["wall"] },
    { id: "armor", label: "갑옷 전시대", objectId: "armor", placeIds: ["corridor"], chips: ["wall"] },
    { id: "plant", label: "화분", objectId: "plant", placeIds: ["corridor"], chips: ["block"] },
    { id: "table_long", label: "긴 탁자", objectId: "table_long", placeIds: ["dining"], chips: ["block"], required: true },
    { id: "table_chairs", label: "차탁과 마주 보는 의자", objectId: "tea_table", placeIds: ["dining"], chips: ["block"] },
    { id: "counter", label: "카운터 런", objectId: "counter", placeIds: ["dining"], chips: ["block", "event"] },
    { id: "piano", label: "피아노", objectId: "piano", placeIds: ["dining"], chips: ["block", "event"] },
    { id: "display", label: "진열대", objectId: "display", placeIds: ["dining"], chips: ["block", "loot"] },
  ],
};
