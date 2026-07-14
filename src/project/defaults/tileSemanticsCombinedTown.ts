// combined_town(EasyRPG RTP) 칩셋의 AI 검색용 큐레이션 시맨틱 테이블.
// 핸드오프 0.4에서 헤드리스 플레이테스트로 검증된 통행성 사실 + 집 패턴 타일 + 장식 타일을 다룬다.
// tileset.tileMeta[]와는 별개로 관리되는 검색 전용 데이터다(일부 타일은 tilesetHarness/combinedTownGroups.ts에서
// 실제 tileMeta/통행성도 함께 채우지만, 나머지 다수는 여기에서만 라벨을 제공한다 — resourceSearch.ts 참고).

import { TILE } from "./constants";

export interface CombinedTownTileSemanticEntry {
  readonly index: number;
  readonly label: string;
  readonly role: string;
  readonly passage: "passable" | "solid";
  readonly tags: readonly string[];
}

function entries(
  indexes: readonly number[],
  label: string,
  role: string,
  passage: "passable" | "solid",
  tags: readonly string[]
): CombinedTownTileSemanticEntry[] {
  return indexes.map((index) => ({ index, label, role, passage, tags: [label, ...tags] }));
}

export const COMBINED_TOWN_TILE_SEMANTICS: readonly CombinedTownTileSemanticEntry[] = [
  // 검증된 통행 불가 타일(핸드오프 0.4) — 겉보기와 실제 통행성이 다른 함정 포함.
  ...entries([TILE.FLOOR, 343], "돌바닥", "floor", "solid", ["floor", "FLOOR", "통행불가", "함정"]),
  ...entries([TILE.STAIRS], "계단", "stairs", "solid", ["stairs", "STAIRS", "성벽"]),
  ...entries([TILE.WALL], "벽", "wall", "solid", ["wall", "WALL", "성벽"]),
  ...entries([TILE.TREE], "나무", "tree", "solid", ["tree", "TREE", "숲"]),
  ...entries([TILE.WATER], "물", "water", "solid", ["water", "WATER", "호수", "강"]),
  ...entries([329], "문 상단", "door", "solid", ["문", "입구", "door"]),
  ...entries([359], "문 하단", "door", "solid", ["문", "입구", "door"]),
  ...entries([426], "어두운 벽", "wall", "solid", ["dark wall", "동굴", "던전"]),

  // 검증된 통행 가능 지면(핸드오프 0.4).
  ...entries([TILE.GRASS, 270, 271, 272, 273, 300, 301, 302, 330, 331, 332, 333], "잔디", "terrain", "passable", ["grass", "GRASS", "풀밭"]),
  // 키큰 풀(포켓몬풍 인카운터 풀숲 상징) — DARK_GRASS(303) + 짙은 대역. 통행 가능(잔디와 동일).
  // 인카운터는 사냥터/조우표로 별도 배선하며 타일 자체엔 로직을 넣지 않는다.
  ...entries([TILE.DARK_GRASS, 304, 305, 334, 335, 243, 244, 245, 274, 275], "키큰 풀", "terrain", "passable", ["dark grass", "tall grass", "짙은 잔디", "키큰 풀", "풀숲", "인카운터", "encounter", "route", "루트", "숲", "풀밭", "pokemon"]),
  ...entries([TILE.PATH], "흙길 변형", "terrain", "passable", ["길", "path", "흙길", "자갈"]),
  ...entries([421], "흙길", "terrain", "passable", ["길", "흙길", "dirt road"]),
  ...entries([390, 391, 392, 420, 422, 450, 451, 452], "흙길 외곽", "terrain", "passable", ["길", "흙길", "dirt road", "edge"]),
  ...entries([TILE.SAND, 424], "모래", "terrain", "passable", ["sand", "SAND", "사막", "해변"]),
  ...entries([361, 362], "흙길 변형", "terrain", "passable", ["길", "흙길", "dirt road", "자갈"]),
  ...entries([363], "모래", "terrain", "passable", ["sand", "사막", "해변"]),
  ...entries([425, 453, 454], "모래 외곽", "terrain", "passable", ["sand", "사막", "edge"]),

  // 집 패턴 타일 — 지붕/벽/문/창문(핸드오프 0.4 최소 범위).
  ...entries([374, 375], "사선 지붕", "roof", "solid", ["지붕", "roof", "사선"]),
  ...entries([404, 405], "지붕-벽 경계", "wall", "solid", ["지붕", "벽", "경계"]),
  ...entries([102, 103, 104], "나무 집벽 상단", "wall", "solid", ["나무 집벽", "목조", "집벽", "wood wall"]),
  ...entries([132, 133, 134], "나무 집벽 중단", "wall", "solid", ["나무 집벽", "목조", "집벽", "wood wall"]),
  ...entries([162, 163, 164], "나무 집벽 하단", "wall", "solid", ["나무 집벽", "목조", "집벽", "wood wall"]),
  ...entries([15, 16, 17], "흰 집벽 상단", "wall", "solid", ["흰 집벽", "집벽", "white wall"]),
  ...entries([45, 46, 47], "흰 집벽 중단", "wall", "solid", ["흰 집벽", "집벽", "white wall"]),
  ...entries([87], "창문", "window", "solid", ["window", "집"]),
  ...entries([116], "나무 문 상단", "door", "solid", ["문", "입구", "door", "집", "wood door"]),
  ...entries([146], "나무 문 하단", "door", "solid", ["문", "입구", "door", "집", "wood door"]),

  // 장식·가구·마당·묘지(사용자 비전 강제 지정).
  ...entries([TILE.FLOWERS], "꽃", "decoration", "passable", ["flower", "자연", "장식"]),
  ...entries([327], "벤치 좌", "decoration", "passable", ["bench", "horizontal", "가구", "장식"]),
  ...entries([328], "벤치 우", "decoration", "passable", ["bench", "horizontal", "가구", "장식"]),
  ...entries([358], "세로 의자 상", "decoration", "passable", ["bench", "chair", "vertical", "가구"]),
  ...entries([388], "세로 의자 하", "decoration", "passable", ["bench", "chair", "vertical", "가구"]),
  ...entries([349], "장작 더미", "decoration", "passable", ["firewood", "house-yard", "집앞"]),
  ...entries([350], "우편함", "decoration", "passable", ["mailbox", "house-yard", "집앞"]),
  ...entries([351], "화분", "decoration", "passable", ["pot", "house-yard", "집앞"]),
  ...entries([352], "항아리", "decoration", "passable", ["jar", "house-yard", "집앞"]),
  ...entries([353], "묘비", "decoration", "passable", ["gravestone", "cemetery", "집멀리"]),
  ...entries([323], "묘지", "decoration", "passable", ["cemetery", "grave", "집멀리"]),
  ...entries([383], "해골", "decoration", "passable", ["skeleton", "cemetery", "집멀리"]),
  ...entries([322], "벽 사다리", "decoration", "passable", ["ladder", "wall", "통과"]),
  ...entries([175], "의자(아래 봄)", "decoration", "passable", ["chair", "탁자 위", "가구"]),
  ...entries([176], "의자(위 봄)", "decoration", "passable", ["chair", "탁자 아래", "가구"]),
  ...entries([205], "의자(오른쪽 봄)", "decoration", "passable", ["chair", "탁자 왼", "가구"]),
  ...entries([206], "의자(왼쪽 봄)", "decoration", "passable", ["chair", "탁자 오른", "가구"]),
  ...entries([147], "의자(등받이 없음)", "decoration", "passable", ["chair", "stool", "가구"]),
  ...entries([148], "의자(등받이 있음)", "decoration", "passable", ["chair", "backrest", "가구"]),
  ...entries([144], "세로 탁자 상", "decoration", "passable", ["table", "vertical", "가구"]),
  ...entries([174], "세로 탁자 중", "decoration", "passable", ["table", "vertical", "stretch", "가구"]),
  ...entries([204], "세로 탁자 하", "decoration", "passable", ["table", "vertical", "가구"]),
  ...entries([234], "가로 탁자 좌", "decoration", "passable", ["table", "horizontal", "가구"]),
  ...entries([235], "가로 탁자 중", "decoration", "passable", ["table", "horizontal", "stretch", "가구"]),
  ...entries([236], "가로 탁자 우", "decoration", "passable", ["table", "horizontal", "가구"]),
  ...entries([237], "나무 상자", "decoration", "passable", ["box", "crate", "장식"]),
  ...entries([202], "과일박스 좌", "decoration", "passable", ["fruit", "crate", "장식"]),
  ...entries([203], "과일박스 우", "decoration", "passable", ["fruit", "crate", "장식"]),
  ...entries([111], "돌계단 좌", "structure", "solid", ["stairs", "stone"]),
  ...entries([112], "돌계단 중", "structure", "solid", ["stairs", "stone", "stretch"]),
  ...entries([113], "돌계단 우", "structure", "solid", ["stairs", "stone"]),
  ...entries([28], "성 열린 창문", "window", "solid", ["window", "castle", "open"]),
  ...entries([58], "성 창문", "window", "solid", ["window", "castle"]),
  ...entries([88], "깨진 창문조각", "window", "solid", ["window", "broken"]),
  ...entries([231], "마법진", "decoration", "passable", ["magic", "ritual"]),
  ...entries([320], "표지판", "decoration", "passable", ["sign", "이정표", "마을", "장식"]),
  ...entries([378, 379, 380, 408, 409, 410, 438, 439], "울타리", "fence", "solid", ["fence", "barrier", "장식"]),
];
