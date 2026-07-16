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
  ...entries([TILE.GRASS, 270, 271, 272, 300, 301, 302, 330, 331, 332], "잔디", "terrain", "passable", ["grass", "GRASS", "풀밭"]),
  // 키큰 풀(포켓몬풍 인카운터 풀숲 상징) — DARK_GRASS(303) + 짙은 대역. 통행 가능(잔디와 동일).
  // 인카운터는 사냥터/조우표로 별도 배선하며 타일 자체엔 로직을 넣지 않는다.
  // 273/333은 243 템플릿 블록의 NW/SW 모서리 — 잔디 오분류를 교정 (2026-07-17).
  ...entries([TILE.DARK_GRASS, 304, 305, 334, 335, 243, 244, 245, 273, 274, 275, 333], "키큰 풀", "terrain", "passable", ["dark grass", "tall grass", "짙은 잔디", "키큰 풀", "풀숲", "인카운터", "encounter", "route", "루트", "숲", "풀밭", "pokemon"]),
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
  // 320은 벽에 붙은 벽보(공지문) — 자립 팻말은 440. (2026-07-16 사용자 교정)
  ...entries([320], "벽보", "decoration", "passable", ["notice", "벽 전용", "퀘스트", "공지"]),
  ...entries([378, 379, 380, 408, 409, 410, 438, 439], "울타리", "fence", "solid", ["fence", "barrier", "장식"]),

  // 2026-07-16 칩셋 재조사 + 사용자 교정 확정본.
  ...entries([177], "술통", "decoration", "solid", ["barrel", "나무통", "마당", "장터", "장식"]),
  ...entries([207], "오크통", "decoration", "solid", ["keg", "barrel", "통", "장식"]),
  ...entries([266], "석상 상단", "decoration", "solid", ["statue", "석상", "광장", "세로2칸"]),
  ...entries([296], "석상 하단", "decoration", "solid", ["statue", "석상", "광장", "세로2칸"]),
  ...entries([267], "돌기둥 상단", "decoration", "solid", ["pillar", "column", "돌기둥", "세로2칸"]),
  ...entries([297], "돌기둥 하단", "decoration", "solid", ["pillar", "column", "돌기둥", "세로2칸"]),
  ...entries([382], "우물", "decoration", "solid", ["well", "물", "마을", "광장"]),
  ...entries([318], "벽 횃불", "decoration", "solid", ["torch", "조명", "벽 전용", "장식"]),
  ...entries([381], "모닥불", "decoration", "solid", ["campfire", "불", "야영", "장식"]),
  ...entries([348], "꽃잎", "decoration", "passable", ["petal", "꽃", "꽃밭", "장식"]),
  ...entries([441, 442], "바위", "decoration", "solid", ["rock", "돌", "자연"]),
  ...entries([411, 412, 413, 443], "용도 미확정(사용 금지)", "terrain", "solid", ["banned", "사용 금지"]),
  // 포석(129 블록)·경작지(126 블록) — RM2003식 3×4 오토타일 (2026-07-16 정본).
  ...entries([190], "포석", "terrain", "passable", ["cobble", "돌길", "오토타일 몸통"]),
  ...entries([129, 131, 159, 160, 161, 189, 191, 219, 220, 221], "포석 변형", "terrain", "passable", ["cobble", "돌길", "오토타일"]),
  ...entries([187], "경작지", "terrain", "passable", ["farmland", "밭", "새싹", "오토타일 몸통"]),
  ...entries([126, 128, 156, 157, 158, 186, 188, 216, 217, 218], "경작지 변형", "terrain", "passable", ["farmland", "밭", "오토타일"]),
  ...entries([472], "방패 간판", "decoration", "solid", ["shop sign", "간판", "대장간", "무기점", "벽 전용"]),
  ...entries([473], "물약 간판", "decoration", "solid", ["shop sign", "간판", "잡화점", "포션", "벽 전용"]),
  ...entries([440], "팻말", "decoration", "solid", ["signpost", "이정표", "갈림길"]),
  ...entries([208, 209], "화려한 깃발", "decoration", "solid", ["banner", "깃발", "장터", "입구", "벽 전용"]),
  ...entries([298], "지하 계단(좌)", "structure", "solid", ["stairs", "지하", "던전 입구", "내려가기"]),
  ...entries([299], "지하 계단(우)", "structure", "solid", ["stairs", "지하", "던전 입구", "내려가기"]),
  ...entries([295], "대각 덩굴", "decoration", "passable", ["vine", "덩굴", "벽 전용", "사선"]),
  ...entries([265], "V자 덩굴", "decoration", "passable", ["vine", "덩굴", "벽 전용"]),
  ...entries([326], "지붕 장식", "decoration", "solid", ["roof ornament", "굴뚝", "우측 사선 지붕용"]),
  ...entries([29], "대형 화강암", "decoration", "solid", ["granite", "바위", "매우 드묾"]),
  ...entries([59], "깨진 돌", "decoration", "passable", ["broken stone", "돌조각", "강가", "길가", "드묾"]),
  ...entries([288], "꽃 덤불", "decoration", "solid", ["flower bush", "꽃밭", "장식"]),
  ...entries([289], "덤불", "decoration", "solid", ["bush", "꽃밭", "자연"]),

  // 2026-07-17 지형 템플릿 앵커 격자 정본화 — 신규 오토타일 7종 + 석축 수로.
  // 석축 수로 = 호수와 같은 물 시스템의 "석축 스킨"(2026-07-17 정본): 볼록 3, 세로 변 33,
  // 가로 변 63, 오목 93 — 호수 스킨 0/30/60/90과 평행, 내부 몸통은 120 공용. 물이라 통행 불가.
  ...entries([3, 4, 5], "수로 볼록 코너", "water", "solid", ["canal", "수로", "관개", "물", "석축", "애니메이션"]),
  ...entries([33, 34, 35], "수로 세로 변", "water", "solid", ["canal", "수로", "관개", "물", "석축", "애니메이션"]),
  ...entries([63, 64, 65], "수로 가로 변", "water", "solid", ["canal", "수로", "관개", "물", "석축", "애니메이션"]),
  ...entries([93, 94, 95], "수로 오목 코너", "water", "solid", ["canal", "수로", "관개", "물", "석축", "애니메이션", "inner"]),
  // 눈(6 블록) — 몸통 67, 나머지는 변형.
  ...entries([67], "눈", "terrain", "passable", ["snow", "눈", "설원", "오토타일 몸통"]),
  ...entries([6, 8, 36, 37, 38, 66, 68, 96, 97, 98], "눈 변형", "terrain", "passable", ["snow", "눈", "설원", "오토타일"]),
  // 짙은 수풀(9 블록) — 몸통 70.
  ...entries([70], "짙은 수풀", "terrain", "passable", ["undergrowth", "수풀", "덤불숲", "오토타일 몸통"]),
  ...entries([9, 11, 39, 40, 41, 69, 71, 99, 100, 101], "짙은 수풀 변형", "terrain", "passable", ["undergrowth", "수풀", "덤불숲", "오토타일"]),
  // 석축 단(246/249 블록) — 성벽 상단·축대 느낌의 테두리형 바닥. 통행 불가(stoneWall 분류 유지).
  ...entries([246, 248, 276, 277, 278, 306, 307, 308, 336, 337, 338], "석축 단(석판)", "structure", "solid", ["stone platform", "석축", "축대", "성벽 상단", "오토타일"]),
  ...entries([249, 251, 279, 280, 281, 309, 310, 311, 339, 340, 341], "석축 단(자갈)", "structure", "solid", ["stone platform", "석축", "축대", "성벽 상단", "오토타일"]),
  // 어둠(366/369 블록) — 심연/동굴 어둠 바닥. 통행 불가(darkWallBody 분류 유지). 426은 기존 "어두운 벽" 라벨 유지.
  ...entries([366, 368, 396, 397, 398, 427, 428, 456, 457, 458], "어둠(석축 테)", "terrain", "solid", ["darkness", "어둠", "심연", "동굴", "오토타일"]),
  ...entries([369, 371, 399, 400, 401, 429, 430, 431, 459, 460, 461], "어둠(짙은 테)", "terrain", "solid", ["darkness", "어둠", "심연", "동굴", "오토타일"]),
];
