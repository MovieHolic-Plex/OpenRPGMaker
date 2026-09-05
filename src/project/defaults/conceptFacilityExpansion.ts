// 시설을 늘리는 재료는 장소별 가구 구성이다. 저장 시에는 기존 꾸러미 스키마로 펼친다.
// 모든 그림은 실내 카탈로그를 참조한다. 시설 간 복제된 배열은 공유하지 않는다.
import type {
  ConceptBundleRecord, ConceptPlaceRecord, ConceptThingRecord, ConceptWallMaterial,
} from "@/project/types/conceptBundle";

type Furnishing = Omit<ConceptThingRecord, "id" | "placeIds">;
type PlaceRecipe = ConceptPlaceRecord & { furnishings: readonly Furnishing[] };

function item(objectId: string, label: string, chips: string[] = ["block"], required = false): Furnishing {
  return { objectId, label, chips, ...(required ? { required: true } : {}) };
}

function facility(id: string, label: string, recipes: readonly PlaceRecipe[], wall?: ConceptWallMaterial): ConceptBundleRecord {
  return {
    id, label,
    facilities: [{ id, label, placeIds: recipes.map((place) => place.id), ...(wall ? { wall } : {}) }],
    places: recipes.map(({ furnishings: _, ...place }) => ({ ...place })),
    things: recipes.flatMap((place) => place.furnishings.map((thing, index) => ({
      ...thing, id: `${place.id}_${thing.objectId}_${index + 1}`,
      placeIds: [place.id], chips: [...thing.chips],
    }))),
  };
}

// 같은 접수 공간은 진료소·관청에 쓰되, 각 시설의 저장 데이터는 독립적이다.
const reception: PlaceRecipe = {
  id: "reception", label: "접수·대기실", role: "entrance", size: "l", floor: "plank",
  furnishings: [
    item("counter", "접수대", ["block", "event"], true),
    item("consultation_table", "대기·상담 자리"), item("plant", "대기실 화분"),
    item("clock", "접수실 시계", ["wall"]), item("window", "창문", ["wall"]),
  ],
};

const records: PlaceRecipe = {
  id: "records", label: "기록 보관실", role: "room", size: "m",
  furnishings: [
    item("bookshelf", "기록 책장", ["block", "event"], true),
    item("cabinet", "문서 보관장", ["block", "event"]),
    item("box", "문서 상자"), item("window", "창문", ["wall"]),
  ],
};

// sleep 칩은 현재 유료 여관 동작이다. 병상·주거·병영 침대에는 조사(event)만 붙인다.
export const EXPANDED_CONCEPT_FACILITIES: readonly ConceptBundleRecord[] = [
  facility("clinic", "진료소", [
    { id: "ward", label: "병실", role: "room", size: "m", count: 2, furnishings: [
      item("care_bed", "병상과 간병 자리", ["block", "event"], true),
      item("cabinet", "침구장"), item("bucket", "세면 물통"),
      item("window", "창문", ["wall"]),
    ] },
    { id: "dispensary", label: "조제실", role: "room", size: "m", floor: "stone", furnishings: [
      item("counter", "조제 작업대", ["block", "event"], true),
      item("shelf_jars", "약재 항아리 선반", ["wall"]), item("jars", "약재 항아리"),
      item("kettle", "약재 항아리"), item("box", "약재 상자"),
    ] },
    reception,
  ]),
  facility("barracks", "병영", [
    { id: "dormitory", label: "공동 침실", role: "room", size: "m", count: 2, furnishings: [
      item("bed_v", "병사 침대", ["block", "event"], true),
      item("bed_v", "병사 침대 둘째", ["block", "event"]),
      item("box", "개인 물품함"), item("rug_mat", "짚 돗자리", ["pass", "floor"]),
    ] },
    { id: "armory", label: "무기고", role: "room", size: "m", floor: "stone", furnishings: [
      item("armor", "보관 갑옷", ["block", "event"], true),
      item("sword_rack", "검 거치대", ["wall"]), item("crate", "장비 상자"),
      item("barrel", "보급 통"),
    ] },
    { id: "mess", label: "병사 식당", role: "entrance", size: "l", furnishings: [
      item("table_long", "배식 탁자", ["block", "event"], true),
      item("dining_table", "병사 식사 자리"), item("stove", "취사 화덕"),
      item("grain", "식량 자루"), item("window", "창문", ["wall"]),
    ] },
  ], "stone-brick"),
  facility("school", "학교", [
    { id: "classroom", label: "교실", role: "room", size: "l", count: 2, furnishings: [
      item("clock", "교실 시계", ["wall"]),
      item("teacher_desk", "교사 책상과 교재", ["block", "event"], true),
      item("study_desk", "학습 책상과 걸상", ["block", "event"], true),
      item("study_desk", "학습 책상과 걸상 둘째"),
      item("window", "교실 창문", ["wall"]),
    ] },
    { ...records, label: "교무 자료실" },
    { id: "assembly", label: "학교 모임홀", role: "entrance", size: "l", furnishings: [
      item("counter", "안내대", ["block", "event"], true),
      item("clock", "학교 시계", ["wall"]), item("plant", "화분"),
      item("consultation_table", "상담 탁자"),
    ] },
  ]),
  facility("townhall", "관청", [
    { id: "office", label: "집무실", role: "room", size: "m", furnishings: [
      item("counter", "집무 책상", ["block", "event"], true),
      item("table_chairs", "면담 탁자"), item("picture", "집무실 그림", ["wall"]),
      item("box", "서류 상자"),
    ] },
    records, reception,
  ]),
  facility("alchemist", "연금술 공방", [
    { id: "laboratory", label: "실험실", role: "room", size: "l", shape: "l", floor: "stone", furnishings: [
      item("counter", "실험대", ["block", "event"], true),
      item("cauldron", "연금 가마솥", ["block", "event"], true),
      item("crystal", "연구 수정구", ["block", "event"]),
      item("shelf_jars", "시약 선반", ["wall"]), item("bucket", "세척 물통"),
    ] },
    { id: "ingredients", label: "재료 보관실", role: "room", size: "s", furnishings: [
      item("jars", "시약 항아리", ["block", "event"], true),
      item("box", "광물 상자"), item("shelf_jars", "재료 선반", ["wall"]),
    ] },
    { id: "consultation", label: "의뢰 상담실", role: "entrance", size: "l", furnishings: [
      item("bookshelf", "연금술 서적", ["block", "event"], true),
      item("consultation_table", "상담 탁자"),
      item("window", "창문", ["wall"]),
    ] },
  ], "stone-brick"),
  facility("bakery", "빵집", [
    { id: "bakehouse", label: "제빵실", role: "room", size: "m", floor: "stone", furnishings: [
      item("stove", "빵 굽는 화덕", ["block", "event"], true),
      item("counter", "반죽 작업대", ["block", "event"], true),
      item("grain", "밀가루 자루"), item("bucket", "반죽 물통"),
    ] },
    { id: "pantry", label: "식재료 저장실", role: "room", size: "s", furnishings: [
      item("grain", "곡물 자루", ["block", "event"], true),
      item("crate", "식재료 상자"), item("jars", "저장 항아리"),
    ] },
    { id: "tearoom", label: "판매·찻자리", role: "entrance", size: "l", floor: "plank", furnishings: [
      item("table_white", "판매용 흰 작업대", ["block", "event"], true),
      item("tea_table", "차 마시는 자리와 항아리"),
      item("window", "창문", ["wall"]),
    ] },
  ]),
  facility("farmhouse", "농가", [
    { id: "bedroom", label: "소박한 침실", role: "room", size: "s", floor: "mat", furnishings: [
      item("bed_v", "가족 침대", ["block", "event"], true),
      item("box", "생활용품 상자"), item("rug_mat", "짚 돗자리", ["pass", "floor"]),
    ] },
    { id: "harvest", label: "수확물 보관실", role: "room", size: "m", floor: "plank", furnishings: [
      item("grain", "수확 곡물", ["block", "event"], true),
      item("crate", "수확물 상자"), item("barrel", "저장 통"),
      item("ladder", "작업 사다리", ["wall"]),
    ] },
    { id: "hearthroom", label: "취사 겸 거실", role: "entrance", size: "l", shape: "l", furnishings: [
      item("stove", "가족 화덕", ["block", "event"], true),
      item("dining_table", "가족 식탁"), item("cauldron", "취사 솥"),
      item("fruit_shelf", "과일 선반", ["wall"]), item("bucket", "물통"),
    ] },
  ]),
  facility("manor", "귀족 저택", [
    { id: "suite", label: "주인 침실", role: "room", size: "l", shape: "alcove", furnishings: [
      item("bed_h", "주인 침대", ["block", "event"], true),
      item("mirror", "침실 거울"), item("cabinet", "옷장"),
      item("rug_red", "침실 카펫", ["pass", "floor"]), item("picture", "초상화", ["wall"]),
    ] },
    { id: "study", label: "개인 서재", role: "room", size: "m", furnishings: [
      item("bookshelf", "장서 책장", ["block", "event"], true),
      item("table_chairs", "독서 탁자"), item("clock", "서재 시계", ["wall"]),
    ] },
    { id: "salon", label: "응접실", role: "entrance", size: "l", furnishings: [
      item("piano", "응접실 피아노", ["block", "event"]),
      item("bust", "장식 흉상"), item("tea_table", "손님 차탁", ["block", "event"], true),
      item("picture", "벽 그림", ["wall"]),
    ] },
  ], "gold-brick"),
  facility("hunter", "사냥꾼 오두막", [
    { id: "bunk", label: "사냥꾼 침실", role: "room", size: "s", furnishings: [
      item("bed_v", "소박한 침대", ["block", "event"], true),
      item("box", "개인 상자"), item("rug_mat", "짚 돗자리", ["pass", "floor"]),
    ] },
    { id: "gear", label: "장비 보관실", role: "room", size: "s", furnishings: [
      item("sword_rack", "사냥칼 거치대", ["wall", "event"], true),
      item("crate", "사냥 장비 상자"), item("barrel", "보급 통"),
    ] },
    { id: "lodge", label: "화롯가 쉼터", role: "entrance", size: "l", shape: "alcove", furnishings: [
      item("stove", "쉼터 화덕", ["block", "event"], true),
      item("tea_table", "휴식 탁자와 항아리"),
      item("window", "창문", ["wall"]),
    ] },
  ]),
  facility("bank", "은행", [
    { id: "vault", label: "귀중품 보관실", role: "room", size: "m", floor: "stone", furnishings: [
      item("cabinet", "목제 보관장", ["block", "event"], true),
      item("box", "귀중품 상자", ["block", "event"]),
      item("crate", "보관 상자"),
    ] },
    { ...records, label: "장부 보관실" },
    { id: "reception", label: "거래 창구", role: "entrance", size: "m", floor: "plank", furnishings: [
      item("counter", "은행 창구", ["block", "event"], true),
      item("bookshelf", "거래 장부 책장", ["block", "event"]),
      item("box", "서류 상자"), item("window", "창문", ["wall"]),
    ] },
  ], "stone-brick"),
];
