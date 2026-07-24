// easyrpg_chipset_dungeon(tex_easyrpg_chipset_dungeon) 칩셋의 AI 검색용 큐레이션 시맨틱 테이블.
// 2026-07-13 vision 업스케일(8x nearest-neighbor) 전수 감사로 판독해 작성했다.
// tileSemanticsInterior.ts와 동일한 계약: tileset.tileMeta[]와 별개로 관리되는 검색 전용 데이터
// (하네스 팩 tilesetHarness/themePacks.ts가 통행성/레이어 계약을 채우고, 여기는 타일별 정밀 라벨을 제공한다).
//
// 좌표 규약: 30타일/행, ID = 행×30 + 열. 분홍 배경 타일은 투명 소품(upper 레이어)이다.
// 판독이 애매한 타일은 라벨에 단정 대신 형태 서술을 쓰고 "판독보류" 태그를 남겼다
// (실내 465~467 전례 — 용도 단정은 사용자 확정 전까지 보류).

import type { CombinedTownTileSemanticEntry } from "./tileSemanticsCombinedTown";

export type DungeonTileSemanticEntry = CombinedTownTileSemanticEntry;

function entries(
  indexes: readonly number[],
  label: string,
  role: string,
  passage: "passable" | "solid",
  tags: readonly string[]
): DungeonTileSemanticEntry[] {
  return indexes.map((index) => ({ index, label, role, passage, tags: [label, ...tags] }));
}

function one(index: number, label: string, role: string, passage: "passable" | "solid", tags: readonly string[]): DungeonTileSemanticEntry {
  return { index, label, role, passage, tags: [label, ...tags] };
}

export const DUNGEON_TILE_SEMANTICS: readonly DungeonTileSemanticEntry[] = [
  // ── 물/애니메이션 존 (열 0-5, 3프레임 가로 세트) ─────────────────────────────
  ...entries([0, 1, 2, 30, 31, 32], "동굴 물웅덩이(흙 기슭)", "water", "solid", ["water", "pond", "물", "동굴", "애니메이션"]),
  ...entries([60, 61, 62, 90, 91, 92], "물웅덩이 북쪽 기슭", "water", "solid", ["water", "shore", "물가", "애니메이션"]),
  ...entries([3, 4, 5, 33, 34, 35], "석조 수로(돌 테두리 물)", "water", "solid", ["water", "channel", "수로", "석조", "애니메이션"]),
  ...entries([63, 64, 65], "석조 수로 가로 구간", "water", "solid", ["water", "channel", "수로", "애니메이션"]),
  ...entries([93, 94, 95], "석조 수로 배수구 벽", "wall", "solid", ["drain", "수문", "배수구", "석조"]),
  ...entries([120, 121, 122, 150, 151, 152, 180, 181, 182, 210, 211, 212], "깊은 물", "water", "solid", ["water", "deep", "물", "지하수", "애니메이션"]),
  ...entries([123, 153, 183, 213], "폭포 급류", "water", "solid", ["waterfall", "폭포", "급류", "애니메이션"]),
  ...entries([124, 154, 184, 214], "폭포 포말/소용돌이", "water", "solid", ["waterfall", "foam", "포말", "소용돌이", "애니메이션"]),
  ...entries([125, 155, 185, 215], "푸른 마법 블록", "decoration", "solid", ["magic", "crystal", "마법", "봉인", "애니메이션"]),

  // ── 바닥 지형 ────────────────────────────────────────────────────────────────
  ...entries([6, 7, 8, 36, 37, 38, 66, 67, 68, 96, 97, 98], "빙판 바닥", "terrain", "passable", ["ice", "빙판", "얼음", "설원"]),
  ...entries([9, 39, 69, 99, 10, 11, 40, 41, 70, 71, 100, 101], "얼음 결정 지대(빙괴 블롭)", "terrain", "solid", ["ice", "빙괴", "얼음 덩어리", "결정"]),
  ...entries([126, 127, 128, 156, 157, 158, 186, 187, 188, 216, 217, 218], "동굴 돌바닥(청회색)", "terrain", "passable", ["cave", "동굴", "돌바닥", "석재"]),
  ...entries([240, 241, 242, 270, 271, 272, 300, 301, 302, 330, 331, 332], "용암 바위 바닥(적갈색)", "terrain", "passable", ["lava rock", "용암 동굴", "적갈", "바위 바닥"]),
  ...entries([360, 361, 362, 390, 391, 392, 420, 421, 422, 450, 451, 452], "흙 바위 바닥(갈색)", "terrain", "passable", ["dirt", "흙", "갈색", "동굴 바닥"]),
  ...entries([80, 110], "별무늬 모자이크 바닥(보라)", "terrain", "passable", ["mosaic", "모자이크", "신전", "보라"]),
  ...entries([81, 111], "별무늬 모자이크 바닥(청록)", "terrain", "passable", ["mosaic", "모자이크", "신전", "청록"]),
  ...entries([82, 83], "별무늬 모자이크 바닥(주황/자주)", "terrain", "passable", ["mosaic", "모자이크", "신전"]),
  ...entries([112, 113], "새싹 돋은 흙바닥", "terrain", "passable", ["sprout", "이끼", "새싹", "흙"]),
  ...entries([141, 142, 143, 171, 201, 231], "나무 판자 바닥(갱도 다리)", "terrain", "passable", ["plank", "판자", "다리", "갱도"]),
  ...entries([138, 139, 168, 169, 198, 199, 140, 170, 200], "붉은 카펫(금장 테두리 9-슬라이스)", "terrain", "passable", ["carpet", "카펫", "붉은", "왕좌"]),
  ...entries([172], "화살표 발판(위)", "terrain", "passable", ["arrow", "화살표", "발판", "장치"]),
  ...entries([173], "화살표 발판(아래)", "terrain", "passable", ["arrow", "화살표", "발판", "장치"]),
  ...entries([202], "화살표 발판(왼쪽)", "terrain", "passable", ["arrow", "화살표", "발판", "장치"]),
  ...entries([203], "화살표 발판(오른쪽)", "terrain", "passable", ["arrow", "화살표", "발판", "장치"]),

  // ── 단상/대지 (테두리 있는 융기 지형) ────────────────────────────────────────
  ...entries([12, 13, 14, 42, 44, 72, 73, 74], "용암 대지(적갈 융기 단상)", "terrain", "passable", ["plateau", "대지", "용암 동굴", "단상"]),
  one(43, "용암 균열(달궈진 바닥)", "terrain", "solid", ["lava", "균열", "용암", "위험"]),
  ...entries([135, 136, 137, 165, 167, 195, 196, 197, 225, 226, 227], "흙 단상(테두리 있는 융기 지형)", "terrain", "passable", ["plateau", "단상", "흙", "융기"]),
  one(166, "흙 단상 발자국 무늬", "terrain", "passable", ["paw", "발자국", "무늬", "판독보류"]),
  ...entries([405, 406, 407, 435, 437, 465, 466, 467], "이끼 낀 석재 단상", "terrain", "passable", ["platform", "단상", "이끼", "석재"]),
  one(436, "석재 단상 위 나무 그루터기", "decoration", "solid", ["stump", "그루터기", "나무"]),

  // ── 벽면 ─────────────────────────────────────────────────────────────────────
  ...entries([15, 45, 21, 22, 23, 51, 52, 53], "동굴 암벽(암갈색)", "wall", "solid", ["cave wall", "암벽", "동굴", "어두운 바위"]),
  ...entries([102, 103, 104, 132, 133, 134], "거친 바위벽(갈색)", "wall", "solid", ["rock wall", "바위벽", "갈색"]),
  ...entries([16, 17, 46, 47, 76, 77], "뿌리 얽힌 벽(비늘 무늬)", "wall", "solid", ["roots", "뿌리", "비늘", "벽"]),
  ...entries([162, 163, 192, 193, 222, 223], "뿌리 골짜기 벽(V자 홈)", "wall", "solid", ["roots", "뿌리", "골짜기", "벽"]),
  ...entries([164, 194], "어두운 흙벽", "wall", "solid", ["soil", "흙벽", "어둠"]),
  one(224, "흙벽 푸른 열매 덩굴", "decoration", "solid", ["berry", "열매", "덩굴", "파랑"]),
  ...entries([18, 19, 48, 49, 50], "동굴 벽면(청회 지층)", "wall", "solid", ["cave wall", "지층", "청회", "벽면"]),
  ...entries([252, 253, 254], "가로 지층 암벽", "wall", "solid", ["strata", "지층", "암벽"]),
  ...entries([105, 106, 107], "붉은 벽돌 벽", "wall", "solid", ["red brick", "벽돌", "붉은"]),
  ...entries([20, 75], "얼굴 조각 바위(석면상)", "wall", "solid", ["face", "석면상", "조각", "유적"]),
  one(78, "보석 박힌 회색 벽돌", "wall", "solid", ["gem", "보석", "벽돌", "광맥"]),
  one(79, "자수정 박힌 분홍 벽돌", "wall", "solid", ["amethyst", "자수정", "벽돌", "광맥"]),
  one(108, "흰 석벽돌 벽", "wall", "solid", ["white brick", "석벽돌", "흰"]),
  one(109, "장식 각석 블록", "wall", "solid", ["carved block", "각석", "장식"]),
  ...entries([255, 256, 257], "금맥 암반(황금빛 자갈)", "wall", "solid", ["gold vein", "금맥", "광산", "황금"]),
  ...entries([285, 315, 372, 373, 374, 402, 403, 404], "푸른 광석 암반", "wall", "solid", ["blue ore", "청광석", "광산", "암반"]),
  one(286, "대각 빙벽 왼쪽 캡", "wall", "solid", ["ice ridge", "left cap", "빙벽", "정본"]),
  one(287, "대각 빙벽 오른쪽 캡", "wall", "solid", ["ice ridge", "right cap", "빙벽", "정본"]),
  one(316, "대각 빙벽 왼쪽 몸통", "wall", "solid", ["ice ridge", "left body", "빙벽", "정본"]),
  one(317, "대각 빙벽 오른쪽 몸통", "wall", "solid", ["ice ridge", "right body", "빙벽", "정본"]),
  one(346, "대각 빙벽 왼쪽 바닥", "wall", "solid", ["ice ridge", "left base", "빙벽", "정본"]),
  one(347, "대각 빙벽 오른쪽 바닥", "wall", "solid", ["ice ridge", "right base", "빙벽", "정본"]),
  ...entries([375, 376, 377], "빙붕 선반(얼음 턱)", "wall", "solid", ["ice shelf", "빙붕", "선반", "얼음"]),
  ...entries([432, 433, 462, 463], "V자 크레바스 암벽", "wall", "solid", ["crevasse", "크레바스", "암벽"]),
  ...entries([434, 464], "검은 잡석 벽", "wall", "solid", ["rubble", "잡석", "어둠"]),

  // ── 블롭 지형(구덩이/못/심연 — 대부분 낙하/비통행 표현) ─────────────────────
  ...entries([129, 159, 189, 219, 130, 131, 160, 161, 190, 191, 220, 221], "동굴 구덩이(검은 낭떠러지)", "terrain", "solid", ["pit", "구덩이", "낭떠러지", "동굴"]),
  ...entries([243, 244, 245, 273, 274, 275, 303, 304, 305, 333, 334, 335], "용암 못(끓는 용암)", "water", "solid", ["lava", "용암", "마그마", "위험"]),
  ...entries([246, 247, 248, 276, 277, 278, 306, 307, 308, 336, 337, 338, 249, 279, 309, 339], "암흑 구덩이(갈색 바위 테)", "terrain", "solid", ["pit", "암흑", "구덩이", "심연"]),
  ...entries([250, 251, 280, 281, 310, 311, 340, 341], "암흑 구덩이(어두운 바위 테)", "terrain", "solid", ["pit", "암흑", "구덩이"]),
  ...entries([282, 283, 284, 312, 313, 314, 342, 343, 344], "눈밭(설원 블롭)", "terrain", "passable", ["snow", "눈밭", "설원"]),
  one(345, "눈사람", "decoration", "solid", ["snowman", "눈사람", "설원"]),
  ...entries([363, 364, 365, 393, 394, 395, 423, 424, 425, 453, 454, 455], "이끼 덤불 지대(반투명 디더)", "terrain", "passable", ["moss", "이끼", "덤불", "습지"]),
  ...entries([366, 367, 368, 396, 397, 398, 426, 427, 428, 456, 457, 458], "푸른 발광 심연", "terrain", "solid", ["abyss", "심연", "발광", "마법"]),
  ...entries([369, 399, 429, 459], "흰 바위 구멍(회백 테두리)", "terrain", "solid", ["pit", "구멍", "회백"]),
  ...entries([370, 371, 400, 401, 430, 431, 460, 461], "회색 바위 구멍(암흑 심부)", "terrain", "solid", ["pit", "구멍", "심연", "회색"]),

  // ── 광산 레일/구조물 ─────────────────────────────────────────────────────────
  ...entries([114, 144, 174], "광산 레일(세로)", "building", "passable", ["rail", "레일", "광산", "선로"]),
  ...entries([115, 116], "광산 레일(가로 침목)", "building", "passable", ["rail", "레일", "광산", "선로"]),
  ...entries([57, 58, 59, 87, 88, 89], "목조 레일 구조대(지지 골조)", "building", "solid", ["trestle", "골조", "광산", "레일"]),
  ...entries([54, 55, 56, 84, 85, 86], "대형 나무 수차(물레바퀴 3×2)", "building", "solid", ["waterwheel", "수차", "물레바퀴", "목조"]),
  ...entries([24, 25, 26], "석조 아치 관문 상단(3칸)", "building", "solid", ["arch", "아치", "관문", "석조"]),
  ...entries([27, 28, 29], "황금 아치 장식 상단(3칸)", "decoration", "solid", ["arch", "황금", "장식", "판독보류"]),
  ...entries([204, 205, 206, 234, 235, 236], "감옥 철창 문(포트컬리스 3×2)", "building", "solid", ["portcullis", "철창", "감옥", "창살", "jail"]),
  ...entries([228, 229, 230], "붉은 커튼(금술 장막)", "decoration", "solid", ["curtain", "커튼", "장막", "붉은"]),
  one(232, "빗금 무늬 판(대각 줄무늬)", "decoration", "solid", ["stripe", "빗금", "판독보류"]),

  // ── 투명 소품 (분홍 배경, upper 레이어) ──────────────────────────────────────
  ...entries([207, 208, 209], "화염(불길 애니메이션)", "decoration", "solid", ["fire", "불", "화염", "애니메이션"]),
  ...entries([237, 238, 239], "눈더미 자락(흰 드리프트)", "decoration", "passable", ["snowdrift", "눈더미", "설원"]),
  one(117, "푸른 수정(소형)", "decoration", "solid", ["crystal", "수정", "파랑", "광물"]),
  ...entries([119, 149], "푸른 수정 기둥(1×2)", "decoration", "solid", ["crystal", "수정", "기둥", "광물"]),
  ...entries([145, 175], "흰 석고 흉상(여신상 1×2)", "decoration", "solid", ["statue", "석상", "흉상", "여신"]),
  ...entries([146, 176], "가고일 석상(1×2)", "decoration", "solid", ["gargoyle", "가고일", "석상", "마물"]),
  one(147, "석관 문장 장식", "decoration", "solid", ["crest", "문장", "석관", "장식"]),
  one(148, "묘비(어두운 감실)", "decoration", "solid", ["tombstone", "묘비", "무덤"]),
  ...entries([177, 178, 179], "덩굴 가지(잎 달린 넝쿨)", "decoration", "solid", ["vine", "덩굴", "넝쿨", "잎"]),
  one(259, "바위 조각(갈색)", "decoration", "solid", ["rock", "바위", "돌덩이"]),
  one(260, "바위 조각(적갈색)", "decoration", "solid", ["rock", "바위", "돌덩이"]),
  one(288, "바위 첨탑(갈색 뾰족바위)", "decoration", "solid", ["spire", "첨탑", "바위"]),
  one(289, "푸른 수정 군집(소형)", "decoration", "solid", ["crystal", "수정", "군집", "광물"]),
  one(290, "둥근 회색 바위", "decoration", "solid", ["boulder", "바위", "둥근"]),
  ...entries([261, 291], "회색 바위 첨탑(1×2)", "decoration", "solid", ["spire", "첨탑", "바위"]),
  ...entries([262, 292], "푸른 수정 첨탑(1×2)", "decoration", "solid", ["crystal", "수정", "첨탑"]),
  ...entries([318, 319, 348, 349], "바위 무더기(2×2)", "decoration", "solid", ["rockpile", "바위 무더기", "돌무더기"]),
  ...entries([320, 321, 350, 351], "대형 수정 군집(2×2)", "decoration", "solid", ["crystal", "수정", "군집", "대형"]),
  ...entries([322, 323, 352, 353], "대형 바위 더미(2×2)", "decoration", "solid", ["rockpile", "바위", "더미", "대형"]),
  ...entries([382, 383, 412], "잔돌 무더기", "decoration", "solid", ["rocks", "잔돌", "무더기"]),
  one(413, "푸른 수정 쌍둥이 결정", "decoration", "solid", ["crystal", "수정", "결정"]),
  ...entries([263, 293], "횃불 화로대(삼각대 1×2)", "decoration", "solid", ["torch", "횃불", "화로", "불"]),
  one(264, "벽걸이 횃불", "decoration", "solid", ["torch", "횃불", "벽걸이", "불"]),
  one(265, "룬 석판(문자판)", "decoration", "solid", ["rune", "룬", "석판", "장치"]),
  one(266, "작은 액자/명판", "decoration", "solid", ["plaque", "명판", "액자"]),
  one(267, "박쥐 그림자", "decoration", "passable", ["bat", "박쥐", "그림자"]),
  ...entries([268, 269], "검은 거미줄(천장 자락)", "decoration", "passable", ["cobweb", "거미줄", "어둠"]),
  ...entries([294, 324, 354], "큰 나무 문(세로 1×3)", "building", "solid", ["door", "문", "나무", "대문"]),
  ...entries([295, 325], "어두운 통로 입구(1×2)", "building", "solid", ["passage", "통로", "입구", "어둠"]),
  one(296, "늘어진 밧줄", "decoration", "solid", ["rope", "밧줄"]),
  one(297, "나무 선반(가로대)", "decoration", "solid", ["rack", "선반", "나무"]),
  one(298, "룬 새김 나무 팻말", "decoration", "solid", ["signboard", "팻말", "룬"]),
  one(299, "해골과 뼈", "decoration", "passable", ["skull", "해골", "뼈", "유해"]),
  one(326, "둥근 나무 탁자", "decoration", "solid", ["table", "탁자", "원탁"]),
  ...entries([327, 328], "나무 의자(정면)", "decoration", "solid", ["chair", "의자", "나무"]),
  ...entries([357, 358], "나무 의자(측면 좌/우)", "decoration", "solid", ["chair", "의자", "측면"]),
  one(356, "나무 등받이 스툴", "decoration", "solid", ["stool", "스툴", "의자"]),
  ...entries([329, 359], "책장(1×2)", "decoration", "solid", ["bookshelf", "책장", "책"]),
  one(355, "흰 반투명 더미(거미줄 뭉치)", "decoration", "solid", ["web", "더미", "판독보류"]),
  ...entries([385, 386, 387, 388], "긴 나무 탁자(가로 연속)", "decoration", "solid", ["table", "긴 탁자", "나무"]),
  one(389, "서랍장 책상", "decoration", "solid", ["desk", "책상", "서랍장"]),
  ...entries([384, 414], "침대(세로 1×2)", "decoration", "solid", ["bed", "침대", "세로"]),
  ...entries([415, 416], "침대(가로 2×1)", "decoration", "solid", ["bed", "침대", "가로"]),
  one(417, "고리버들 통", "decoration", "solid", ["basket", "버들통", "바구니"]),
  one(418, "흰 항아리 가마", "decoration", "solid", ["kiln", "가마", "항아리"]),
  one(419, "나무 물동이", "decoration", "solid", ["bucket", "물동이", "나무"]),
  ...entries([378, 379], "갈색 천막 지붕(2×1)", "building", "solid", ["tent", "천막", "지붕", "야영"]),
  ...entries([380, 381], "짙은 천막 지붕(2×1)", "building", "solid", ["tent", "천막", "지붕", "야영"]),
  ...entries([410, 411], "회색 천막 지붕(2×1)", "building", "solid", ["tent", "천막", "지붕", "야영"]),
  ...entries([408, 409], "설산 봉우리(2×1)", "building", "solid", ["peak", "설산", "봉우리"]),
  ...entries([438, 439, 468, 469], "석조 원형 구조물(콜로세움 벽 2×2)", "building", "solid", ["coliseum", "석조", "원형", "구조물"]),
  ...entries([440, 470], "석탑 첨탑(1×2)", "building", "solid", ["tower", "석탑", "첨탑"]),
  ...entries([441, 442, 443, 471, 472, 473], "황금 새장(촛대 달린 대형 우리 3×2)", "decoration", "solid", ["cage", "새장", "황금", "우리", "감옥"]),
  ...entries([444, 445, 446, 474, 475, 476], "파이프 오르간(석조 3×2)", "decoration", "solid", ["organ", "오르간", "파이프", "악기"]),
  ...entries([447, 477], "석조 기둥(1×2)", "decoration", "solid", ["pillar", "기둥", "석주"]),
  ...entries([448, 449, 478, 479], "붉은 왕좌(금장 2×2)", "decoration", "solid", ["throne", "왕좌", "옥좌", "붉은", "금장"]),
  one(118, "빈 칸(투명)", "decoration", "passable", ["빈", "투명"]),
  one(233, "빈 칸(투명)", "decoration", "passable", ["빈", "투명"]),
  one(258, "빈 칸(투명)", "decoration", "passable", ["빈", "투명"]),
];
