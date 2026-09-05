// easyrpg_chipset_interior(tex_easyrpg_chipset_interior) 타일 그림판의 AI 검색용 큐레이션 시맨틱 테이블.
// 2026-07-12 vision 업스케일(8~14x nearest-neighbor) 전수 감사로 480타일을 판독해 작성했다.
// tileSemanticsCombinedTown.ts와 동일한 계약: tileset.tileMeta[]와 별개로 관리되는 검색 전용 데이터
// (하네스 팩 tilesetHarness/themePacks.ts가 통행성/레이어 계약을 채우고, 여기는 타일별 정밀 라벨을 제공한다).
//
// 좌표 규약: 30타일/행, ID = 행×30 + 열. 분홍 배경 타일은 투명 소품(upper 레이어)이다.

import type { CombinedTownTileSemanticEntry } from "./tileSemanticsCombinedTown";
import { applyChipsetLabelCorrections } from "./chipsetLabelCorrections";

export type InteriorTileSemanticEntry = CombinedTownTileSemanticEntry;

function entries(
  indexes: readonly number[],
  label: string,
  role: string,
  passage: "passable" | "solid",
  tags: readonly string[]
): InteriorTileSemanticEntry[] {
  return indexes.map((index) => ({ index, label, role, passage, tags: [label, ...tags] }));
}

function one(index: number, label: string, role: string, passage: "passable" | "solid", tags: readonly string[]): InteriorTileSemanticEntry {
  return { index, label, role, passage, tags: [label, ...tags] };
}

export const INTERIOR_TILE_SEMANTICS: readonly InteriorTileSemanticEntry[] = applyChipsetLabelCorrections("tex_easyrpg_chipset_interior", [
  // ── 물/애니메이션 지형 (좌상단 애니메이션 존, 열 0-5) ─────────────────────────
  ...entries([0, 1, 2], "연못(잔디 기슭)", "water", "solid", ["water", "pond", "물", "애니메이션"]),
  ...entries([3, 4, 5], "연못(모래 기슭)", "water", "solid", ["water", "pond", "물", "모래", "애니메이션"]),
  ...entries([30, 31, 32], "연못 세로 연결(잔디)", "water", "solid", ["water", "물", "연못"]),
  ...entries([33, 34, 35], "연못 세로 연결(모래)", "water", "solid", ["water", "물", "연못"]),
  ...entries([60, 61, 62], "물가 북쪽 기슭", "water", "solid", ["water", "shore", "물가"]),
  ...entries([63, 64, 65], "물가 흰 포말 기슭", "water", "solid", ["water", "foam", "포말", "물가"]),
  ...entries([90, 91, 92], "물가 기슭 변형", "water", "solid", ["water", "shore", "물가"]),
  ...entries([93, 94, 95], "폭포 상단", "water", "solid", ["waterfall", "폭포", "물"]),
  ...entries([120, 121, 122, 150, 151, 152, 180, 181, 182, 210, 211, 212], "깊은 물", "water", "solid", ["water", "deep", "바다", "물"]),
  ...entries([123, 153, 183, 213], "폭포", "water", "solid", ["waterfall", "폭포", "물", "애니메이션"]),
  ...entries([124, 154, 184, 214], "모닥불", "decoration", "solid", ["fire", "campfire", "불", "화톳불", "애니메이션"]),
  ...entries([125, 155, 185, 215], "푸른 마법 블록", "decoration", "solid", ["crystal", "magic", "마법", "크리스털", "애니메이션"]),
  one(232, "용암 바닥", "terrain", "solid", ["lava", "용암", "불"]),

  // ── 실외 지형(잔디/흙/모래/자갈) — 이 타일 그림판은 마을 외곽+실내 겸용 ────────────────
  ...entries([7, 127, 247, 361, 364, 240, 241, 242, 270, 271, 272, 300, 301, 302, 330, 331, 332], "잔디", "terrain", "passable", ["grass", "풀밭", "야외"]),
  ...entries([243, 244, 245, 273, 274, 275, 303, 304, 305, 333, 334, 335], "짙은 잔디 경계", "terrain", "passable", ["grass", "dark grass", "풀밭", "경계", "월드맵"]),
  ...entries([6, 8, 36, 37, 38, 66, 67, 68, 96, 97, 98], "흙땅", "terrain", "passable", ["dirt", "흙", "맨땅", "월드맵"]),
  ...entries([9, 39, 69, 99], "모래-잔디 경계", "terrain", "passable", ["sand", "모래", "경계"]),
  ...entries([10, 11, 40, 41, 70, 71, 100, 101], "모래밭", "terrain", "passable", ["sand", "모래", "사장", "월드맵"]),
  ...entries([246, 248, 276, 277, 278, 306, 307, 308, 336, 337, 338], "자갈 포장 바닥", "terrain", "passable", ["cobblestone", "포장", "자갈", "돌길"]),
  ...entries([252, 253], "이끼 낀 돌바닥", "terrain", "passable", ["moss", "이끼", "돌바닥"]),
  ...entries([132], "잡석 바닥", "terrain", "passable", ["rubble", "잡석", "자갈"]),
  ...entries([133], "꽃 자갈땅", "terrain", "passable", ["flower", "꽃", "자갈"]),
  ...entries([192, 193], "거친 흙바닥", "terrain", "passable", ["dirt", "흙", "거친 땅"]),
  ...entries([222, 223], "새싹 밭", "terrain", "passable", ["farm", "garden", "밭", "새싹", "텃밭"]),
  // 2026-07-12 사용자 정정: 이 시트는 월드맵과 공용 — 수풀 블롭은 '숲', 흙무더기는 '산' 표현.
  ...entries([360, 362, 390, 391, 392, 420, 421, 422, 450, 451, 452], "숲 수풀(월드맵 겸용)", "tree", "solid", ["forest", "숲", "수풀", "덤불", "월드맵"]),
  ...entries([363, 365, 393, 394, 395, 423, 424, 425, 453, 454, 455], "산 둔덕(월드맵 겸용)", "terrain", "solid", ["mountain", "산", "둔덕", "흙무더기", "월드맵"]),
  one(282, "바위 더미", "decoration", "solid", ["rock", "바위", "돌무더기"]),
  one(283, "절벽 바위(어둠)", "wall", "solid", ["rock", "cliff", "바위", "절벽"]),

  // ── 실내 바닥 ────────────────────────────────────────────────────────────────
  ...entries([12], "보랏빛 돌바닥", "floor", "passable", ["stone floor", "돌바닥", "실내"]),
  ...entries([13], "청록 돌바닥", "floor", "passable", ["stone floor", "돌바닥", "실내"]),
  ...entries([42], "청회색 자갈 바닥", "floor", "passable", ["stone floor", "자갈", "바닥", "실내"]),
  ...entries([43], "암녹색 돌바닥", "floor", "passable", ["stone floor", "돌바닥", "실내"]),
  ...entries([72], "나무 바닥", "floor", "passable", ["wood floor", "나무 바닥", "실내", "마루"]),
  ...entries([73], "나무 바닥 구멍", "floor", "passable", ["hole", "구멍", "잔해", "마루"]),
  ...entries([102, 103], "나무 널 바닥", "floor", "passable", ["wood floor", "널빤지", "마루", "실내"]),
  ...entries([108, 109, 110, 138, 139, 140, 168, 169, 170], "짚 돗자리", "floor", "passable", ["mat", "tatami", "돗자리", "멍석", "짚"]),
  ...entries([162], "금간 석재 바닥", "floor", "passable", ["cracked", "석재", "바닥", "유적"]),
  ...entries([163], "문양 석판", "floor", "passable", ["slab", "석판", "문양", "감압판"]),
  ...entries([82, 83, 112, 113], "방향 화살표 바닥", "floor", "passable", ["arrow", "화살표", "표지", "바닥"]),

  // ── 카펫 ────────────────────────────────────────────────────────────────────
  one(249, "청록 카펫(1칸)", "floor", "passable", ["carpet", "rug", "카펫", "깔개"]),
  one(251, "청록 카펫 몸통", "floor", "passable", ["carpet", "rug", "카펫", "깔개"]),
  ...entries([279, 280, 281, 309, 310, 311, 339, 340, 341], "청록 카펫", "floor", "passable", ["carpet", "rug", "카펫", "깔개", "테두리"]),
  ...entries([375, 376, 377, 405, 406, 407, 435, 436, 437], "붉은 카펫", "floor", "passable", ["carpet", "rug", "카펫", "레드카펫", "깔개"]),
  // 2026-07-13 사용자 재확정: 465~467은 일반 계단이 아니라 **붉은 카펫 대계단**(좌 465 · 몸통 466 반복 · 우 467).
  // 귀족 저택/성/대연회장 전용 — 서민 여관·민가에 함부로 쓰지 말 것. 일반 계단은 444/445(대각)·474/475(어둠 하강).
  one(465, "붉은 카펫 계단 좌측 끝(귀족 전용)", "stairs", "passable", ["stairs", "계단", "붉은 카펫", "귀족", "좌측"]),
  one(466, "붉은 카펫 계단 몸통(귀족 전용·반복)", "stairs", "passable", ["stairs", "계단", "붉은 카펫", "귀족", "반복"]),
  one(467, "붉은 카펫 계단 우측 끝(귀족 전용)", "stairs", "passable", ["stairs", "계단", "붉은 카펫", "귀족", "우측"]),

  // ── 벽 ──────────────────────────────────────────────────────────────────────
  ...entries([14, 15, 16, 44, 45, 46], "자주 벽돌 벽", "wall", "solid", ["brick wall", "벽돌", "벽", "실내"]),
  ...entries([17, 47], "자주 벽돌 벽 모서리", "wall", "solid", ["brick wall", "벽돌", "벽", "모서리"]),
  ...entries([134, 135, 136, 164, 165, 166], "밝은 벽돌 벽", "wall", "solid", ["brick wall", "벽돌", "벽", "크림"]),
  ...entries([137, 167], "밝은 벽돌 벽 모서리", "wall", "solid", ["brick wall", "벽돌", "벽", "모서리"]),
  ...entries([314, 315, 316, 317, 344, 345, 346, 347], "금장 벽돌 벽", "wall", "solid", ["brick wall", "벽돌", "벽", "금장", "장식"]),
  ...entries([194, 195, 196, 197, 224, 225, 226, 227], "어두운 돌벽", "wall", "solid", ["stone wall", "돌벽", "벽", "던전"]),
  ...entries([254, 255, 256, 284, 285, 286, 287], "동굴 암벽", "wall", "solid", ["cave wall", "암벽", "동굴", "벽"]),
  ...entries([74, 75, 76, 77], "크림 회벽 상단", "wall", "solid", ["cream wall", "회벽", "벽지", "벽", "실내"]),
  ...entries([104, 105, 106, 107], "크림 회벽 하단", "wall", "solid", ["cream wall", "회벽", "벽지", "벽", "실내", "트림"]),
  ...entries([402, 403, 404], "3×3 석조 화로 상단", "furniture", "solid", ["stone hearth", "화로", "화덕", "석조", "상단", "3x3"]),
  ...entries([432, 433, 434], "3×3 석조 화로 중단", "furniture", "solid", ["stone hearth", "화로", "화덕", "석조", "중단", "3x3"]),
  ...entries([462, 464], "3×3 석조 화로 하단 양옆", "furniture", "solid", ["stone hearth", "화로", "화덕", "석조", "하단", "3x3"]),
  one(463, "석조 화로 화구 (불 꺼짐)", "furniture", "solid", ["stone hearth", "unlit", "화로", "화구", "불 꺼짐", "켜짐은 124 불 애니메이션"]),
  one(129, "흰색 탁자 단독 상판", "furniture", "solid", ["table", "탁자", "흰색", "상판"]),
  one(141, "가로 돌계단 왼끝", "stairs", "passable", ["stone stairs", "돌계단", "가로", "왼끝"]),
  one(111, "가로 돌계단 반복부", "stairs", "passable", ["stone stairs", "돌계단", "가로", "반복"]),
  one(171, "가로 돌계단 오른끝", "stairs", "passable", ["stone stairs", "돌계단", "가로", "오른끝"]),
  one(81, "유리판", "wall", "solid", ["glass", "유리", "창"]),

  // ── 어두운 벽/암흑 존(오토타일 366 계열) ────────────────────────────────────────
  one(366, "어두운 벽(브러시)", "wall", "solid", ["dark wall", "어두운 벽", "벽", "오토타일", "366"]),
  ...entries([367, 396, 397, 398, 426, 427, 428, 456, 457, 458], "어두운 벽 모서리/트림", "wall", "solid", ["dark wall", "어두운 벽", "벽", "모서리"]),
  ...entries([368, 369, 399, 429, 459], "어두운 벽 코너", "wall", "solid", ["dark wall", "어두운 벽", "코너", "벽"]),
  ...entries([370, 371, 400, 401, 431, 460, 461], "동굴 암흑 테두리", "wall", "solid", ["cave", "darkness", "암흑", "동굴", "바위"]),
  one(430, "공허(void)", "wall", "solid", ["void", "공허", "암흑", "배경"]),
  one(116, "암흑 공허", "wall", "solid", ["void", "공허", "암흑", "검정"]),
  one(146, "암흑 흙더미", "wall", "solid", ["darkness", "흙더미", "암흑"]),
  // 2026-07-12 시트 원본 복원: 오토타일 작업이 덧그렸던 그림자 4타일(233/234/257/258)을 git 원본으로
  // 되돌렸다. 233/258은 빈칸이지만 벽 오토타일이 조인트 '라벨'로 맵에 저장한다 — 렌더는
  // interiorWallFrameQuarter의 라벨 규칙이 항상 전체 합성하므로 시트 픽셀은 쓰이지 않는다.
  ...entries([233, 258], "벽 조인트 라벨(시트 빈칸 — 렌더 합성)", "wall", "solid", ["shadow", "그림자", "어둠", "코너", "조인트"]),
  one(257, "돌벽 변형(벽 문기둥 조인트 라벨 겸용 — 렌더 합성)", "wall", "solid", ["stone wall", "돌벽", "그림자", "조인트"]),
  // 234 = 세로 긴 탁자의 상단 캡(2026-07-12 사용자 지적 → 경계 대조 diff 40 확정).
  // 오염 시트에서 전수 대조를 돌렸던 탓에 처음 놓쳤다 — 세트: 234(상단)+264(몸통 반복)+294(다리).
  one(234, "세로 긴 탁자 상단(캡)", "furniture", "solid", ["table", "탁자", "세로", "식탁", "상단"]),

  // ── 주방/구조물(불투명 lower) ─────────────────────────────────────────────────
  one(21, "화덕 오븐 상단", "building", "solid", ["stove", "oven", "화덕", "오븐", "주방", "부엌"]),
  one(51, "화덕 오븐 하단", "building", "solid", ["stove", "oven", "화덕", "오븐", "주방", "부엌"]),
  ...entries([22, 23], "조리대 상단(철판)", "building", "solid", ["kitchen counter", "조리대", "주방", "부엌", "개수대"]),
  ...entries([52, 53], "조리대 하단", "building", "solid", ["kitchen counter", "조리대", "주방", "부엌"]),
  one(373, "벽난로 아궁이", "building", "solid", ["fireplace", "hearth", "벽난로", "아궁이", "화로"]),
  ...entries([198, 199, 200], "목재 탁자 하단", "furniture", "solid", ["table", "탁자", "하단", "다리"]),
  one(201, "미확정 가구 부품(201)", "furniture", "solid", ["unconfirmed", "미확정", "부품"]),
  ...entries([228, 229, 230, 231], "흰 천 테이블", "building", "solid", ["tablecloth", "table", "테이블", "연회", "제단"]),
  ...entries([126, 128, 156, 157, 158, 186, 187, 188, 216, 217, 218], "확장 목재 탁자 상판", "furniture", "solid", ["table", "탁자", "상판", "확장"]),
  ...entries([159, 160, 161, 189, 190, 191, 219, 220, 221], "확장 흰색 탁자 상판", "furniture", "solid", ["table", "탁자", "흰색", "상판", "확장"]),
  ...entries([142, 143, 172, 173], "붉은 대형 커튼", "decoration", "solid", ["curtain", "커튼", "무대", "장막"]),
  ...entries([202, 203], "붉은 커튼 자락", "decoration", "solid", ["curtain", "커튼", "자락", "장막"]),
  one(312, "석재 기둥 상단", "building", "solid", ["pillar", "기둥", "석재"]),
  one(342, "보라 기둥 몸통", "building", "solid", ["pillar", "기둥", "보라"]),
  one(313, "둥근 기둥 상단", "building", "solid", ["pillar", "기둥", "석재"]),
  one(343, "자갈 기둥 몸통", "building", "solid", ["pillar", "기둥", "자갈"]),
  one(372, "보라 기둥 하단", "building", "solid", ["pillar", "기둥", "받침"]),
  one(374, "석판 제단", "building", "solid", ["slab", "altar", "석판", "제단"]),

  // ── 투명 소품(분홍 배경, upper 레이어) — 벽걸이 ─────────────────────────────────
  one(24, "벽 횃불", "decoration", "passable", ["torch", "횃불", "조명", "벽걸이"]),
  // 2026-07-12 사용자 판정(×24 vision 부합): 명패가 아니라 벽 스위치 — 금속판+함몰 슬롯+돌기.
  one(26, "벽 스위치(레버)", "decoration", "passable", ["switch", "lever", "스위치", "레버", "장치", "벽걸이"]),
  one(27, "무기점 간판", "sign", "passable", ["sign", "간판", "무기", "weapon shop", "상점"]),
  one(28, "방어구점 간판", "sign", "passable", ["sign", "간판", "방어구", "armor shop", "상점"]),
  one(29, "잡화점 간판", "sign", "passable", ["sign", "간판", "잡화", "item shop", "상점"]),
  one(57, "여관 간판", "sign", "passable", ["sign", "간판", "여관", "inn", "침대"]),
  one(58, "술집 간판", "sign", "passable", ["sign", "간판", "술집", "tavern", "pub", "맥주"]),
  one(54, "흰 창문", "window", "passable", ["window", "창문", "벽걸이"]),
  one(56, "커튼 창문", "window", "passable", ["window", "창문", "커튼", "벽걸이"]),
  one(59, "십자 장식", "decoration", "passable", ["cross", "십자", "종교", "교회", "벽걸이"]),
  ...entries([84], "풍경 액자", "decoration", "passable", ["picture", "액자", "그림", "벽걸이"]),
  ...entries([85], "불꽃 액자", "decoration", "passable", ["picture", "액자", "그림", "벽걸이"]),
  ...entries([86], "가구 액자", "decoration", "passable", ["picture", "액자", "그림", "벽걸이"]),
  one(114, "대형 그림 좌", "decoration", "passable", ["picture", "액자", "그림", "지도", "벽걸이"]),
  one(115, "대형 그림 우", "decoration", "passable", ["picture", "액자", "그림", "지도", "벽걸이"]),
  one(144, "스테인드글라스", "window", "passable", ["stained glass", "스테인드글라스", "교회", "창문"]),
  one(174, "격자 창(어두운)", "window", "passable", ["window", "창문", "격자", "지하"]),
  one(176, "하단 출입구 바닥 표식", "decoration", "passable", ["entrance", "threshold", "입구", "문턱", "하단"]),
  one(25, "과일 단지 선반", "furniture", "solid", ["shelf", "선반", "과일", "단지", "주방", "부엌"]),
  one(320, "단지 선반", "furniture", "passable", ["shelf", "선반", "단지", "항아리", "벽걸이"]),

  // ── 투명 소품 — 가구 ─────────────────────────────────────────────────────────
  one(55, "나무 궤짝", "furniture", "solid", ["crate", "궤짝", "상자", "창고"]),
  one(145, "펼친 책", "decoration", "passable", ["book", "책", "독서대"]),
  one(147, "책장 상단(책 있음)", "furniture", "solid", ["bookshelf", "책장", "책", "서재"]),
  one(177, "책장 하단(책 있음)", "furniture", "solid", ["bookshelf", "책장", "책", "서재"]),
  one(148, "선반장 상단", "furniture", "solid", ["cabinet", "선반장", "수납장"]),
  one(178, "선반장 하단", "furniture", "solid", ["cabinet", "선반장", "수납장"]),
  one(149, "양문 수납장 상단", "furniture", "passable", ["cabinet", "수납장", "장롱", "옷장"]),
  one(179, "양문 수납장 하단", "furniture", "passable", ["cabinet", "수납장", "장롱", "옷장"]),
  one(175, "붉은 책", "decoration", "passable", ["book", "책", "서재"]),
  one(204, "촛대", "decoration", "passable", ["candle", "촛대", "초", "조명"]),
  one(205, "대형 나무 통", "furniture", "solid", ["barrel", "통", "술통", "저장"]),
  one(206, "랜턴", "decoration", "passable", ["lantern", "랜턴", "등불", "조명"]),
  one(207, "고기 요리", "decoration", "passable", ["food", "음식", "고기", "요리", "식탁"]),
  one(208, "샐러드 접시", "decoration", "passable", ["food", "음식", "샐러드", "요리", "식탁"]),
  one(209, "난로 연통 상단", "furniture", "solid", ["flue", "stovepipe", "chimney", "연통", "굴뚝", "난로"]),
  one(239, "난로 연통 하단", "furniture", "solid", ["flue", "stovepipe", "chimney", "연통", "굴뚝", "난로"]),
  one(235, "항아리", "decoration", "solid", ["jar", "pottery", "항아리", "주방", "부엌"]),
  one(236, "원형 탁자", "furniture", "solid", ["table", "탁자", "원탁"]),
  one(237, "술병과 잔", "decoration", "passable", ["bottle", "술병", "잔", "술집"]),
  one(238, "식기 세트", "decoration", "passable", ["cutlery", "식기", "나이프", "포크", "식탁"]),
  one(259, "관목", "tree", "passable", ["bush", "관목", "덤불", "식물"]),
  one(260, "검(벽걸이)", "decoration", "passable", ["sword", "검", "무기", "벽걸이"]),
  one(261, "망치(벽걸이)", "decoration", "passable", ["hammer", "망치", "공구", "대장간"]),
  one(262, "방패(벽걸이)", "decoration", "passable", ["shield", "방패", "무기", "벽걸이"]),
  one(263, "검 진열 박스 상단", "furniture", "solid", ["sword", "검", "진열", "박스"]),
  // 264 위 변은 시트에서 절단 — 위로 이어지는 캡 타일이 없다(480타일 픽셀 경계 전수 대조).
  // 264는 자기 반복 몸통(위변=아래변 diff 0): 벽에 상단을 붙여 264×N + 294 로 늘인다.
  one(264, "세로 긴 탁자 몸통(세로 반복·상단은 벽에 붙임)", "furniture", "solid", ["table", "탁자", "세로", "식탁", "반복", "확장"]),
  one(294, "세로 긴 탁자 하단(다리)", "furniture", "solid", ["table", "탁자", "세로", "식탁", "다리"]),
  one(265, "나무 물통", "furniture", "solid", ["bucket", "물통", "양동이", "통"]),
  one(266, "원형 스툴", "furniture", "solid", ["stool", "스툴", "의자"]),
  one(267, "등받이 의자 우", "furniture", "solid", ["chair", "의자", "등받이"]),
  one(268, "등받이 의자 좌", "furniture", "solid", ["chair", "의자", "등받이"]),
  one(269, "대형 거울 상단", "furniture", "solid", ["mirror", "거울", "화장대"]),
  one(299, "대형 거울 하단", "furniture", "solid", ["mirror", "거울", "화장대"]),
  one(288, "화분", "decoration", "solid", ["flower pot", "화분", "꽃", "식물"]),
  one(289, "화분 나무", "decoration", "solid", ["potted tree", "화분", "나무", "식물"]),
  one(290, "갑옷(전시)", "decoration", "passable", ["armor", "갑옷", "전시", "무구"]),
  one(291, "가죽 투구", "decoration", "passable", ["helmet", "투구", "가죽", "무구"]),
  one(292, "가죽 갑옷", "decoration", "passable", ["leather armor", "가죽 갑옷", "무구"]),
  one(293, "검 진열 박스 하단", "furniture", "solid", ["sword", "검", "진열", "박스"]),
  one(295, "나무 상자", "furniture", "solid", ["box", "상자", "궤", "수납"]),
  one(296, "꽃병", "decoration", "solid", ["vase", "꽃병", "꽃", "장식"]),
  one(297, "의자(우향)", "furniture", "solid", ["chair", "의자", "측면"]),
  one(298, "의자(좌향)", "furniture", "solid", ["chair", "의자", "측면"]),
  one(87, "갑옷 전시대 상단", "decoration", "solid", ["armor", "갑옷", "전시", "동상"]),
  one(117, "갑옷 전시대 하단", "decoration", "solid", ["armor", "갑옷", "전시", "동상"]),
  one(88, "여자 흉상 상단", "decoration", "solid", ["bust", "여자 흉상", "조각상", "동상"]),
  one(118, "여자 흉상 받침", "decoration", "solid", ["bust", "여자 흉상", "조각상", "받침"]),
  one(89, "돌기둥 상단", "decoration", "solid", ["pillar", "돌기둥", "기둥"]),
  one(119, "돌기둥 하단", "decoration", "solid", ["pillar", "돌기둥", "기둥"]),
  one(318, "붉은 커튼 좌", "decoration", "passable", ["curtain", "커튼", "장막"]),
  one(319, "붉은 커튼 우", "decoration", "passable", ["curtain", "커튼", "장막"]),
  one(348, "붉은 커튼 자락 좌", "decoration", "passable", ["curtain", "커튼", "장막"]),
  one(349, "붉은 커튼 자락 우", "decoration", "passable", ["curtain", "커튼", "장막"]),
  one(321, "보석 목걸이", "decoration", "passable", ["jewelry", "보석", "목걸이", "보물"]),
  one(322, "흩어진 편지", "decoration", "passable", ["letter", "편지", "문서", "종이"]),
  one(323, "가마솥", "furniture", "solid", ["cauldron", "가마솥", "솥", "주방", "연금술"]),
  one(324, "세로 침대 머리", "furniture", "solid", ["bed", "침대", "세로", "침실"]),
  one(354, "세로 침대 하단", "furniture", "solid", ["bed", "침대", "세로", "침실"]),
  one(355, "가로 침대 좌", "furniture", "solid", ["bed", "침대", "가로", "침실"]),
  one(356, "가로 침대 우", "furniture", "solid", ["bed", "침대", "가로", "침실"]),
  // 긴 탁자는 3칸 세트(2026-07-12 사용자 지적 → vision 확정): 좌 325 · 몸통 326(가로 반복) · 우 327.
  one(325, "긴 탁자 좌", "furniture", "solid", ["table", "탁자", "식탁", "긴 탁자"]),
  one(326, "긴 탁자 몸통(가로 반복)", "furniture", "solid", ["table", "탁자", "식탁", "긴 탁자", "반복", "확장"]),
  one(327, "긴 탁자 우", "furniture", "solid", ["table", "탁자", "식탁", "긴 탁자"]),
  one(328, "사각 탁자", "furniture", "solid", ["table", "탁자", "사각"]),
  one(329, "수정구 점술대", "furniture", "solid", ["crystal ball", "수정구", "점술", "마법"]),
  one(350, "흰 단지 두 개", "decoration", "solid", ["jar", "단지", "항아리", "도자기"]),
  one(351, "둥근 덤불", "tree", "solid", ["bush", "덤불", "관목", "식물"]),
  one(352, "큰 깃털", "decoration", "passable", ["feather", "깃털", "펜"]),
  one(353, "가죽 장화 더미", "decoration", "passable", ["boots", "장화", "가죽", "신발"]),
  one(358, "피아노 좌", "furniture", "solid", ["piano", "organ", "피아노", "오르간", "악기"]),
  one(359, "피아노 우", "furniture", "solid", ["piano", "organ", "피아노", "오르간", "악기"]),
  ...entries([378, 379], "붉은 배너", "decoration", "passable", ["banner", "배너", "깃발", "현수막"]),
  one(380, "돌 항아리", "decoration", "passable", ["urn", "항아리", "석재", "단지"]),
  ...entries([381, 382, 383, 411, 412, 413, 441, 442, 443], "마법진", "decoration", "passable", ["magic circle", "마법진", "의식", "촛불"]),
  one(384, "쓰러진 의자", "decoration", "solid", ["chair", "의자", "쓰러진", "어지러운"]),
  one(385, "웅크린 흰 고양이", "decoration", "passable", ["cat", "고양이", "동물", "반죽"]),
  one(386, "세운 나무 판자", "decoration", "solid", ["plank", "판자", "도마", "목공"]),
  one(387, "판자 더미", "decoration", "solid", ["plank", "판자", "장작", "목공"]),
  // 2026-07-12 사용자 재판정: 바닥이 아니라 '벽'의 균열(벽면 위에 겹치는 세로 2칸 오버레이).
  one(388, "벽 균열 상단", "decoration", "passable", ["crack", "균열", "벽", "갈라짐", "던전", "폐허"]),
  one(418, "벽 균열 하단", "decoration", "passable", ["crack", "균열", "벽", "갈라짐", "던전", "폐허"]),
  one(389, "괘종시계 상단", "furniture", "solid", ["clock", "시계", "괘종시계"]),
  one(419, "괘종시계 하단", "furniture", "solid", ["clock", "시계", "괘종시계", "추"]),
  // 408~410은 사용자 검토에서 오분류로 제외됐다. 의미를 다시 확인하기 전에는 검색·자동 배치하지 않는다.
  ...entries([438, 439, 440], "카운터 경로 중간줄(세로 직선 438 반복·코너·직선)", "furniture", "solid", ["counter", "카운터", "바", "상점", "경로", "코너"]),
  ...entries([468, 469], "카운터 경로 아랫줄(코너·직선)", "furniture", "solid", ["counter", "카운터", "받침", "다리", "경로"]),
  one(414, "광석 바위", "decoration", "solid", ["ore", "광석", "바위", "광산"]),
  one(415, "둥근 바위 더미", "decoration", "solid", ["rock", "바위", "돌무더기"]),
  one(416, "부서진 벽돌 더미", "decoration", "solid", ["brick", "rubble", "벽돌", "잔해", "부서진", "폐허"]),
  one(417, "깨진 유리 조각", "decoration", "passable", ["broken glass", "깨진 유리", "파편", "잔해"]),
  // 2026-07-12 재확정(사용자 판정 + ×20 재판독): 진열장이 아니라 1칸짜리 계단 4종.
  // 절벽/단차/지하 입구에 한 칸씩 놓는 전형적인 탑다운 계단 타일.
  one(444, "대각 계단(오르막·우상향)", "stairs", "passable", ["stairs", "계단", "대각", "오르막", "단차"]),
  one(445, "대각 계단(내리막·우하향)", "stairs", "passable", ["stairs", "계단", "대각", "내리막", "단차"]),
  one(474, "독립 하강 계단 A (1×1)", "stairs", "passable", ["stairs", "single-tile", "계단", "지하", "하강", "내려가기"]),
  one(475, "독립 하강 계단 B (1×1)", "stairs", "passable", ["stairs", "single-tile", "계단", "지하", "하강", "내려가기"]),
  // 왕좌(478/479)와 붉은 의자(476)는 시트 마지막 행에서 하단이 절단돼 있다(원본 소스는 받침 행이
  // 더 있는 형태로 추정 — 2026-07-12 경계 검사: 478 아래변 배경 0/16). 소스 재로드 시 확장 후보.
  one(446, "붉은 의자 등받이", "furniture", "solid", ["throne", "의자", "왕좌", "등받이"]),
  one(476, "붉은 의자 좌석(하단 절단)", "furniture", "solid", ["throne", "의자", "왕좌", "좌석"]),
  // 2026-07-12 사용자 정정: 왕좌는 3×2 — 좌열(447/477)이 RTP에서 잘려 빈칸이었고(피아노와 같은
  // 오프셋 결손, 478 왼변 개방 0/16), 449/479 미러로 보완 작화해 완성했다.
  ...entries([447, 448, 449, 477, 478, 479], "대형 왕좌(3×2 — 좌열 보완 작화·하단 절단)", "furniture", "solid", ["throne", "왕좌", "옥좌", "왕"]),
  one(470, "해골 유골", "decoration", "passable", ["skull", "해골", "유골", "뼈"]),
  one(471, "곡물 자루", "decoration", "solid", ["grain", "곡물", "자루", "포대", "창고"]),
  one(472, "나무 사다리", "decoration", "passable", ["ladder", "사다리", "창고"]),
  one(473, "장대 사다리", "decoration", "passable", ["ladder", "사다리", "장대"]),
  // 357 = 피아노 왼쪽 측판. EasyRPG RTP 원본은 이 칸이 비고 358 왼변이 잘려 있었다(클론 오프셋 실수
  // 추정 — SHA-256으로 RTP 동일본 확인). 2026-07-12 보완 작화: 359 좌우 미러로 채움(이음새 diff 313).
  one(357, "피아노 좌(보완 작화)", "furniture", "solid", ["piano", "organ", "피아노", "오르간", "악기"]),

  // ── 2026-07-12 fable 감사: 잔여 미분류 18타일 등재(480/480 완료) ─────────────
  // 책장은 3×3 세트(좌 18/48/78 · 중 19/49/79 가로 반복 · 우 20/50/80).
  one(18, "책장 상단(좌)", "furniture", "solid", ["bookshelf", "책장", "상판", "서재"]),
  one(19, "책장 상단(중·가로 반복)", "furniture", "solid", ["bookshelf", "책장", "상판", "반복"]),
  one(20, "책장 상단(우)", "furniture", "solid", ["bookshelf", "책장", "상판", "서재"]),
  one(48, "책장 중단(좌·책 2단)", "furniture", "solid", ["bookshelf", "책장", "책", "서재"]),
  one(49, "책장 중단(중·가로 반복)", "furniture", "solid", ["bookshelf", "책장", "책", "반복"]),
  one(50, "책장 중단(우)", "furniture", "solid", ["bookshelf", "책장", "책", "서재"]),
  one(78, "책장 하단(좌·서랍)", "furniture", "solid", ["bookshelf", "책장", "서랍", "서재"]),
  one(79, "책장 하단(중·가로 반복)", "furniture", "solid", ["bookshelf", "책장", "서랍", "반복"]),
  one(80, "책장 하단(우)", "furniture", "solid", ["bookshelf", "책장", "서랍", "서재"]),
  // 연민트 벽면(가칭) 오토타일 3×4(9~11열×4~7행): 하단 테두리 없는 수직면(벽 방식) — 재질 명명 대기.
  one(130, "잔디(연민트 벽면 오토타일 배경 슬롯)", "floor", "passable", ["잔디", "오토타일", "배경 슬롯"]),
  one(131, "연민트 벽면(가칭) 오목 코너 소스", "wall", "solid", ["벽면", "오토타일", "오목 코너"]),
  one(250, "잔디(청록 카펫 오토타일 배경 슬롯 — 130과 동일)", "floor", "passable", ["잔디", "오토타일", "배경 슬롯"]),
]);
