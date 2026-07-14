import { buildEdgeCornerVariantMap } from "@/project/defaults/autotileEngine";
import {
  createDarkWallAutotileGroup,
  DARK_WALL_AUTOTILE_GROUP_ID,
} from "@/project/defaults/darkWallAutotile";
import { createInteriorTerrainAutotileGroups } from "@/project/defaults/interiorTerrainAutotiles";
import { createDungeonTerrainAutotileGroups } from "@/project/defaults/dungeonTerrainAutotiles";
import { INTERIOR_TILE_SEMANTICS } from "@/project/defaults/tileSemanticsInterior";
import { SCARLOXY_CHIPSET_ASSETS, scarloxyChipsetGroupSeeds } from "@/assets/scarloxyPack";
import type { AutotileGroup, PassFlag, TileAiMetadata, TileGroupMetadata, TilesetDef } from "@/project/types";

export const DUNGEON_METADATA_PACK_ID = "dungeon-v1";
export const DUNGEON_METADATA_PACK_VERSION = "3";
export const DUNGEON_TEXTURE_KEY = "tex_easyrpg_chipset_dungeon";
export const DUNGEON_HARNESS_PREFIX = "harness-dungeon-v1-";

export const INTERIOR_METADATA_PACK_ID = "interior-house-v1";
export const INTERIOR_METADATA_PACK_VERSION = "1";
export const INTERIOR_TEXTURE_KEY = "tex_easyrpg_chipset_interior";
export const INTERIOR_HARNESS_PREFIX = "harness-interior-house-v1-";

/** Built-in interior wall-frame autotile (outer ring + top trim/door alcove tiles). */
export const INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID = `${INTERIOR_HARNESS_PREFIX}wall-frame-autotile`;

/** Built-in dark-wall terrain autotile — brush tile 366, edges/corners auto-shape. */
export const INTERIOR_DARK_WALL_AUTOTILE_GROUP_ID = DARK_WALL_AUTOTILE_GROUP_ID;

/**
 * Wall-frame surface tiles for EasyRPG interior chipset villager-house frames.
 * Outer corners use labeled 233/258/456/458 (not render-only 368).
 * Floor is connect-only (not a member).
 */
export const INTERIOR_WALL_FRAME_TILES = {
  body: 105,
  edgeN: 457,
  edgeS: 397,
  edgeW: 428,
  edgeE: 426,
  /** Outer corner NW (캡+포스트 열) — user-labeled, not 368. */
  cornerNW: 233,
  cornerNE: 258,
  /** Outer corner SW/SE (남 프레임 연결) */
  cornerSW: 456,
  cornerSE: 458,
} as const;

/** Passable room floor used as connect neighbor so 1-tile wall rings get true N/S edges. */
export const INTERIOR_WALL_FRAME_FLOOR_TILE = 72;

const INTERIOR_WALL_FRAME_MEMBER_TILE_IDS: readonly number[] = [
  INTERIOR_WALL_FRAME_TILES.body,
  INTERIOR_WALL_FRAME_TILES.edgeN,
  INTERIOR_WALL_FRAME_TILES.edgeS,
  INTERIOR_WALL_FRAME_TILES.edgeW,
  INTERIOR_WALL_FRAME_TILES.edgeE,
  INTERIOR_WALL_FRAME_TILES.cornerNW,
  INTERIOR_WALL_FRAME_TILES.cornerNE,
  INTERIOR_WALL_FRAME_TILES.cornerSW,
  INTERIOR_WALL_FRAME_TILES.cornerSE,
  // Inner face trims + door-alcove companions painted with the wall ring.
  104,
  106,
  396,
  398,
  // Render-only quarter source still a member so composition can see corners.
  368,
];

export function createInteriorWallFrameAutotileGroup(): AutotileGroup {
  const memberTileIds = uniqueTileIds(INTERIOR_WALL_FRAME_MEMBER_TILE_IDS);
  return {
    id: INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID,
    name: "실내 벽 프레임",
    neighborhood: 4,
    memberTileIds,
    connectTileIds: uniqueTileIds([...memberTileIds, INTERIOR_WALL_FRAME_FLOOR_TILE]),
    variantMap: buildEdgeCornerVariantMap({ ...INTERIOR_WALL_FRAME_TILES }),
  };
}


// 분홍 투명 배경 소품 전수 목록 — 2026-07-12 vision 업스케일 감사로 재검증.
// 357(피아노 좌)·447/477(왕좌 좌열)은 RTP 결손을 미러 보완 작화(2026-07-12)로 채워 포함.
// 피아노 = 357|358|359 가로 3칸, 왕좌 = 447~449/477~479 3×2.
const INTERIOR_TRANSPARENT_PROP_TILES = [
  24, 25, 26, 27, 28, 29,
  54, 55, 56, 57, 58, 59,
  84, 85, 86, 87, 88, 89,
  114, 115, 117, 118, 119,
  144, 145, 147, 148, 149,
  174, 175, 176, 177, 178, 179,
  204, 205, 206, 207, 208, 209,
  234, 235, 236, 237, 238, 239,
  259, 260, 261, 262, 263, 265, 266, 267, 268, 269,
  288, 289, 290, 291, 292, 293, 294, 296, 297, 298, 299,
  318, 319, 320, 321, 322, 323, 324, 325, 326, 327, 328, 329,
  348, 349, 350, 351, 352, 353, 354, 355, 356, 357, 358, 359,
  378, 379, 380, 381, 382, 383, 384, 385, 386, 387, 388, 389,
  408, 409, 410, 411, 412, 413, 414, 415, 416, 417, 418, 419,
  438, 439, 440, 441, 442, 443, 444, 445, 446, 447, 448, 449,
  468, 469, 470, 471, 472, 473, 474, 475, 476, 477, 478, 479,
] as const;

type PackHarnessGroup = Omit<TileGroupMetadata, "tileIds"> & {
  readonly passage: NonNullable<TileAiMetadata["passage"]>;
  readonly repeatability: NonNullable<TileAiMetadata["repeatability"]>;
  readonly tileIds: readonly number[];
};

type ThemeMetadataPack = {
  readonly id: string;
  readonly version: string;
  readonly textureKey: string;
  readonly prefix: string;
  readonly groups: readonly PackHarnessGroup[];
};

const passable: PassFlag = { up: true, down: true, left: true, right: true };
const solid: PassFlag = { up: false, down: false, left: false, right: false };

// 2026-07-13 vision 업스케일 감사 기준으로 재작성 — 이전 던전 4개 그룹은 옛 칩셋 이미지 기준이라
// 현재 PNG와 어긋났다(예: 옛 "던전 석벽" 1~3/31~33은 현재 연못 물 테두리, 옛 "입구/장식" 91/92는 물).
// 지형 12블록(3×4 표준 배치)의 자동 연결은 dungeonTerrainAutotiles.ts 오토타일 그룹이 담당한다.
// 정본: fix/pokemon-core 1d8e9ee (host↔overlay connectsTo + red-carpet nineSlice).
export const DUNGEON_HARNESS_GROUPS: readonly PackHarnessGroup[] = [
  packGroup(DUNGEON_HARNESS_PREFIX, "floor-stone", "회록 석재 바닥", "terrain", "lower", [126, 127, 128, 130, 156, 157, 158, 186, 187, 188, 216, 217, 218], "passable", "repeat", "방과 복도를 채우는 통행 가능한 회록색 석재 바닥입니다(RM 3×4 블록)."),
  packGroup(DUNGEON_HARNESS_PREFIX, "floor-redrock", "적암 바닥", "terrain", "lower", [240, 241, 242, 244, 270, 271, 272, 300, 301, 302, 330, 331, 332], "passable", "repeat", "용암 지대와 어울리는 통행 가능한 검붉은 암반 바닥입니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "floor-dirt", "흙바닥", "terrain", "lower", [360, 361, 362, 390, 391, 392, 420, 421, 422, 450, 451, 452], "passable", "repeat", "동굴 통로용 통행 가능한 갈색 흙바닥입니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "floor-snow", "눈밭", "terrain", "lower", [6, 7, 8, 36, 37, 38, 66, 67, 68, 96, 97, 98], "passable", "repeat", "설원 던전용 통행 가능한 눈 바닥입니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "floor-ice", "얼음판", "terrain", "lower", [9, 10, 11, 39, 40, 41, 69, 70, 71, 99, 100, 101], "passable", "repeat", "눈밭 위에 얼어붙은 통행 가능한 얼음판입니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "floor-moss", "이끼 수풀", "terrain", "lower", [363, 364, 365, 393, 394, 395, 423, 424, 425, 453, 454, 455], "passable", "repeat", "흙바닥 위에 깔린 통행 가능한 이끼/덤불 지대입니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "plateau-red", "적암 대지/자갈", "terrain", "lower", [12, 13, 14, 42, 43, 44, 72, 73, 74, 102, 103, 104], "passable", "repeat", "테두리가 있는 적암 대지 9-슬라이스(43은 용암 균열 장식)와 잿빛 자갈 바닥입니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "floor-variant", "석재 바닥 변형", "terrain", "lower", [78, 79, 80, 81, 82, 83, 108, 109, 110, 111, 112, 113, 224], "passable", "repeat", "보라/녹색/황토 석재 포장과 새싹 돋은 흙, 꽃 장식 바닥 등 통행 가능한 바닥 변형 모음입니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "dais-brown", "갈색 단상", "terrain", "lower", [135, 136, 137, 165, 166, 167, 195, 196, 197], "passable", "repeat", "테두리가 있는 갈색 단상 9-슬라이스입니다(166은 뼈 무더기 장식)."),
  packGroup(DUNGEON_HARNESS_PREFIX, "planks", "나무 판자 바닥/다리", "terrain", "lower", [141, 142, 143, 171, 201, 231, 252, 253, 254], "passable", "repeat", "구덩이 위에 걸치는 나무 판자 바닥과 다리입니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "carpet-red", "붉은 카펫", "terrain", "lower", [138, 139, 140, 168, 169, 170, 198, 199, 200], "passable", "repeat", "금장 테두리 붉은 카펫 9-슬라이스입니다(고립 배치는 몸통 169)."),
  packGroup(DUNGEON_HARNESS_PREFIX, "ice-floe", "부빙(빙판)", "terrain", "lower", [282, 283, 284, 312, 313, 314, 342, 343, 344], "passable", "repeat", "급류 위에 뜬 통행 가능한 부빙 9-슬라이스입니다(313은 얼음 구멍 장식)."),
  packGroup(DUNGEON_HARNESS_PREFIX, "platform-mossy", "녹회색 암반 단상", "terrain", "lower", [405, 406, 407, 435, 436, 437, 465, 466, 467], "passable", "repeat", "바위 테두리가 있는 녹회색 암반 단상 9-슬라이스입니다(436은 바위 장식)."),
  packGroup(DUNGEON_HARNESS_PREFIX, "arrow-plate", "화살표 바닥판", "terrain", "lower", [172, 173, 202, 203], "passable", "fixed", "방향 안내용 화살표 금속 바닥판입니다(상/하/좌/우)."),
  packGroup(DUNGEON_HARNESS_PREFIX, "water", "물/폭포", "water", "lower", [0, 1, 2, 3, 4, 5, 30, 31, 32, 33, 34, 35, 60, 61, 62, 63, 64, 65, 90, 91, 92, 93, 94, 95, 120, 121, 122, 123, 124, 150, 151, 152, 153, 154, 180, 181, 182, 183, 184, 210, 211, 212, 213, 214], "solid", "repeat", "연못·수로·폭포 애니메이션 타일입니다. 통행 불가."),
  packGroup(DUNGEON_HARNESS_PREFIX, "rapids", "검푸른 급류", "water", "lower", [372, 373, 374, 402, 403, 404], "solid", "repeat", "부빙 주변의 어두운 급류/깊은 물입니다. 통행 불가."),
  packGroup(DUNGEON_HARNESS_PREFIX, "lava", "용암", "water", "lower", [243, 245, 273, 274, 275, 303, 304, 305, 333, 334, 335], "solid", "repeat", "적암 바닥을 녹이며 흐르는 용암입니다. 통행 불가."),
  packGroup(DUNGEON_HARNESS_PREFIX, "chasm", "석재 균열 구덩이", "water", "lower", [129, 131, 159, 160, 161, 189, 190, 191, 219, 220, 221], "solid", "repeat", "석재 바닥이 꺼진 검은 구덩이입니다. 통행 불가."),
  packGroup(DUNGEON_HARNESS_PREFIX, "wall-brown", "갈색 암벽", "wall", "lower", [21, 22, 23, 51, 52, 53, 225, 226, 227, 255, 256, 257], "solid", "repeat", "방 외곽과 복도 경계를 막는 갈색 동굴 암벽입니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "wall-green", "청록 석벽(뿌리 전이)", "wall", "lower", [18, 19, 20], "solid", "repeat", "갈색 암벽 아래에 붙이는 청록 석벽 전이 행입니다 — 18/19 교차 반복, 20은 얼굴 부조 변형."),
  packGroup(DUNGEON_HARNESS_PREFIX, "stairs-green", "청록 계단", "building", "lower", [48, 49, 50], "passable", "repeat", "청록 석재 가로 계단입니다 — 좌 캡 48 · 몸통 49(반복) · 우 캡 50. 검은 노치 캡은 어둠과 맞닿는 끝에 씁니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "cliff-red", "적암 대각 절벽", "wall", "lower", [15, 16, 17, 45, 46, 47, 75, 76, 77], "solid", "repeat", "용암/적암 지대의 대각 절벽 벽면 — 좌열(15/45/75)은 좌하향 사면, 우측 2열(16/17 등)은 V자 능선입니다. 75는 얼굴 부조. 발치에는 적암 계단(105~107). 15는 중간 반복용이 아니라 좌측 끝단입니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "stairs-redrock", "적암 계단", "building", "lower", [105, 106, 107], "passable", "repeat", "적암 가로 계단입니다 — 105~107 몸통 반복. 신전 벽/단상 아래로 내려가는 발치에 깝니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "wall-root", "뿌리 커튼 벽", "wall", "lower", [132, 133, 134, 162, 163, 164, 192, 193, 194, 222, 223], "solid", "repeat", "천장에서 늘어진 나무뿌리 커튼 벽면입니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "cliff-stone", "석재 대각 절벽", "wall", "lower", [432, 433, 434, 462, 463, 464], "solid", "repeat", "석재/동굴 지대의 대각 절벽 벽면 — 상단(432/433/434)이 청록 V자 능선, 하단(462~464)이 사면입니다. 통행 불가."),
  packGroup(DUNGEON_HARNESS_PREFIX, "ice-drape", "얼음 폭포 휘장", "wall", "lower", [286, 287, 316, 317, 346, 347], "solid", "repeat", "설벽에서 흘러내리는 푸른 얼음 폭포 휘장(2×3)입니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "ice-wall", "얼음 벽", "wall", "lower", [285], "solid", "fixed", "1×2로 세로로 쌓는 빙벽 조각(285)입니다. 설원 벽면에 씁니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "pit-pale", "천장 어둠(담색 테두리)", "wall", "lower", [246, 247, 248, 276, 277, 278, 306, 307, 308, 336, 337, 338], "solid", "repeat", "심연과 같은 천장(미굴착 어둠) 덩어리입니다 — 방 바깥을 채우고 테두리가 바닥과의 경계를 그립니다. 바닥 구덩이로 쓰지 마세요."),
  packGroup(DUNGEON_HARNESS_PREFIX, "pit-gold", "천장 어둠(금장 테두리)", "wall", "lower", [249, 250, 251, 279, 280, 281, 309, 310, 311, 339, 340, 341], "solid", "repeat", "심연과 같은 천장(미굴착 어둠) 덩어리입니다 — 금장 징 테두리가 바닥과의 경계를 그립니다. 바닥 구덩이로 쓰지 마세요."),
  packGroup(DUNGEON_HARNESS_PREFIX, "abyss-blue", "심연/천장(푸른 테두리)", "wall", "lower", [366, 367, 368, 396, 397, 398, 426, 427, 428, 456, 457, 458], "solid", "repeat", "푸른 빛 테두리의 칠흑 천장(미굴착 어둠)입니다. 방 바깥을 채우는 경계로 씁니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "abyss-gray", "심연/천장(회암 테두리)", "wall", "lower", [369, 370, 371, 399, 400, 401, 429, 430, 431, 459, 460, 461], "solid", "repeat", "회암 테두리의 칠흑 천장(미굴착 어둠)입니다. 방 바깥을 채우는 경계로 씁니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "stairs-red", "카펫 계단", "building", "lower", [228, 229, 230], "passable", "repeat", "붉은 카펫과 이어지는 가로 계단입니다 — 좌 228 · 몸통 229(반복) · 우 230."),
  packGroup(DUNGEON_HARNESS_PREFIX, "passage", "어둠 출입구", "building", "lower", [295, 325], "solid", "fixed", "벽면에 뚫린 어두운 출입구 세로쌍(295 상단 + 325 하단, 문지방 흙더미) — 벽 밴드 위 상위 레이어에 얹어 동굴 입구를 표현합니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "stairs-single", "1×1 계단", "building", "upper", [444, 445, 474, 475], "passable", "fixed", "각각 독립된 1×1 계단 4종 — 444 우측 오름 · 445 좌측 오름 · 474 좌측 내림 · 475 우측 내림. 투명 배경이라 바닥 위 레이어에 얹어야 합니다(하위에 깔면 배경이 검게 나옴)."),
  packGroup(DUNGEON_HARNESS_PREFIX, "cage", "감옥 창살", "building", "lower", [204, 205, 206, 234, 235, 236], "solid", "fixed", "3×2 감옥 창살(감방 벽)입니다. 통행 불가."),
  packGroup(DUNGEON_HARNESS_PREFIX, "statue", "석상/비석", "building", "lower", [145, 146, 147, 148, 175, 176], "solid", "fixed", "여신상(145+175)·가고일(146+176)·왕관 비석·아궁이 비석입니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "dome", "석조 돔/화덕", "building", "lower", [438, 439, 440, 468, 469, 470, 24, 25, 26], "solid", "fixed", "3×3 대형 석조 돔(용광로) — 윗줄 438~440 · 중간 468~470 · 받침 24~26. 마법진처럼 팔레트 세로 순서가 파일 행(14→15→0)과 다르니 주의. 통행 불가."),
  packGroup(DUNGEON_HARNESS_PREFIX, "pillar", "석주", "building", "lower", [446, 476], "solid", "fixed", "석재 기둥 상·하단 세로쌍입니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "ice-magic", "얼음 마법 블록", "building", "lower", [125, 155, 185, 215], "solid", "fixed", "빛나는 얼음 마법 블록 애니메이션입니다. 통행 불가."),
  packGroup(DUNGEON_HARNESS_PREFIX, "ice-rail", "얼음 난간", "building", "lower", [375, 376, 377], "solid", "repeat", "가로로 늘릴 수 있는 얼음 난간/다리 턱입니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "throne", "왕좌", "building", "lower", [447, 448, 449, 477, 478, 479], "solid", "fixed", "금장 붉은 왕좌 3×2 — 윗줄 447·448·449, 아랫줄 477·478·479. 447/477(왼팔걸이)을 빼면 왼쪽이 잘립니다. 통행 불가."),
  packGroup(DUNGEON_HARNESS_PREFIX, "rail", "광차 철로", "prop", "upper", [54, 55, 56, 57, 58, 59, 84, 85, 86, 87, 88, 89, 114, 115, 116, 117, 144, 174], "passable", "repeat", "광차 철로 세트 — 세로 114/144/174 · 가로 115~117 · 곡선 코너 54(남↔동)/55(남↔서)/84(북↔동)/85(북↔서) · 판자 위 곡선·분기 56~59/86~89(세로쌍, 방향 잠정). 4곡선을 2×2로 모으면 원형 루프가 됩니다. 바닥 위 레이어에 깔며 통행 가능합니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "prop-rock", "바위/수정 소품", "prop", "upper", [259, 260, 261, 262, 288, 289, 290, 291, 292, 315, 318, 319, 320, 321, 322, 323, 345, 348, 349, 350, 351, 352, 353, 382, 383, 412, 413], "passable", "fixed", "투명 배경 자연 소품 — 가로 2폭 쌍: 바위 아치 259+260 · 잔해 318+319 · 바위 322+323 · 잔해 348+349 · 암반 352+353. 단일: 석순 261/288/291, 수정 262/289/292/321/413, 수정 파편 320, 얼음 수정 대 350·소 351, 광석 383, 둥근 바위 290, 바위 412, 눈밭 눈뭉치 315, 눈사람 345. 바닥 위 레이어에 배치합니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "prop-fire", "횃불/모닥불", "prop", "upper", [207, 208, 209, 263, 264, 293], "passable", "fixed", "불꽃 애니메이션(207~209) · 벽 횃불 263/264 · 삼각 횃불 받침대 293(불꽃 208을 위에 겹쳐 씀)."),
  packGroup(DUNGEON_HARNESS_PREFIX, "prop-furniture", "가구/집기", "prop", "upper", [265, 266, 294, 296, 297, 298, 299, 324, 326, 327, 328, 329, 354, 355, 356, 357, 358, 359, 384, 385, 386, 387, 388, 389, 414, 415, 416, 417, 418, 419], "passable", "fixed", "투명 배경 집기 — 세로 책상 294(상단)+324(중단 반복)+354(하단 다리), 긴 탁자 385~387, 세로 침대 384+414, 가로 침대 415+416, 책장 329+359, 소탁자 388, 서랍장 389, 나무 사다리 297, 게시판 298, 밧줄 296, 스툴 356, 채광 입구 355(바깥에서 빛이 드는 하단 입구 — 주변을 유사 바닥으로 맞춰야 자연스러움), 의자 327/328/357/358, 표지판 265/266, 해골 299, 통·항아리 417~419. 바닥 위 레이어에 배치합니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "wall-crack", "벽 갈라진 틈", "prop", "upper", [267, 268, 269], "passable", "fixed", "벽면 균열 오버레이 — 1칸 틈(267)과 가로 2칸 큰 틈(268+269). 암벽 위에 얹습니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "prop-magic-circle", "마법진", "prop", "upper", [27, 28, 29, 441, 442, 443, 471, 472, 473], "passable", "fixed", "촛불 4개가 둘린 3×3 대형 마법진입니다. 팔레트 세로 순서가 파일 행과 다르니 주의 — 윗줄 441~443 · 중간 471~473 · 아랫줄 27~29 순으로 붙여야 원이 이어집니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "snow-drape", "벽 위 쌓인 눈", "prop", "upper", [237, 238, 239], "passable", "fixed", "벽·바위 윗면에 걸쳐 쌓인 눈 3연속(237~239)입니다. 벽 밴드 상단에 얹습니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "ice-block", "얼음 블록", "prop", "upper", [232], "passable", "fixed", "반투명 빙괴(232)입니다 — 얼음/눈 위에 얹으면 바닥이 비칩니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "prop-peak", "봉우리/지붕 꼭대기", "prop", "upper", [378, 379, 380, 381, 408, 409, 410, 411], "passable", "fixed", "가로 2폭 꼭대기 쌍 — 적갈 378+379 · 갈색 380+381 · 설산 408+409 · 청록 410+411. 세로로 쌓는 조각이 아닙니다."),
  packGroup(DUNGEON_HARNESS_PREFIX, "prop-crystal-vine", "수정/덩굴 소품", "prop", "upper", [118, 119, 149, 177, 178, 179], "passable", "fixed", "푸른 수정 조각과 잎 돋은 덩굴 가지입니다."),
];

// 2026-07-12 vision 업스케일 감사 기준으로 재작성 — 이전 그룹은 옛 칩셋 이미지 기준이라
// 현재 PNG와 어긋났다(예: 옛 "실내 바닥" 270/271/300/301은 현재 잔디, 옛 "실내 벽" 1~3/31~33은 연못 물).
// 타일별 정밀 라벨은 tileSemanticsInterior.ts(검색 전용)가 제공하고, 여기는 통행성/레이어 계약을 시드한다.
export const INTERIOR_HARNESS_GROUPS: readonly PackHarnessGroup[] = [
  packGroup(INTERIOR_HARNESS_PREFIX, "floor", "실내 나무 바닥", "terrain", "lower", [72, 73, 102, 103], "passable", "repeat", "실내 방을 채우는 통행 가능한 나무 바닥입니다(73은 구멍 난 변형)."),
  packGroup(INTERIOR_HARNESS_PREFIX, "floor-stone", "실내 돌바닥", "terrain", "lower", [12, 13, 42, 43, 162, 163], "passable", "repeat", "던전·지하실·석조 실내용 통행 가능한 돌바닥입니다."),
  packGroup(INTERIOR_HARNESS_PREFIX, "floor-mat", "짚 돗자리", "terrain", "lower", [108, 109, 110, 138, 139, 140, 168, 169, 170], "passable", "repeat", "3×3 짚 돗자리(멍석) 바닥입니다. 블록 단위로 깔아야 테두리가 이어집니다."),
  packGroup(INTERIOR_HARNESS_PREFIX, "carpet-red", "붉은 카펫", "terrain", "lower", [375, 376, 377, 405, 406, 407, 435, 436, 437], "passable", "repeat", "금장 테두리 붉은 카펫 9-슬라이스입니다(고립 배치는 몸통 406)."),
  packGroup(INTERIOR_HARNESS_PREFIX, "stairs-horizontal", "가로 계단", "building", "lower", [465, 466, 467], "passable", "repeat", "가로로 늘릴 수 있는 계단입니다 — 좌 465 · 몸통 466(반복) · 우 467. (2026-07-12 사용자 확정: 카펫 술이 아니라 계단)"),
  packGroup(INTERIOR_HARNESS_PREFIX, "carpet-teal", "청록 카펫", "terrain", "lower", [249, 251, 279, 280, 281, 309, 310, 311, 339, 340, 341], "passable", "repeat", "청록 카펫 3×3 테두리 세트와 1칸(249)/몸통(251) 변형입니다."),
  packGroup(INTERIOR_HARNESS_PREFIX, "deck", "나무 단상", "terrain", "lower", [126, 128, 156, 157, 158, 186, 187, 188, 216, 217, 218], "passable", "repeat", "테두리가 있는 나무 단상(무대/데크) 바닥입니다."),
  packGroup(INTERIOR_HARNESS_PREFIX, "arrow-plate", "화살표 바닥판", "terrain", "lower", [82, 83, 112, 113], "passable", "fixed", "방향 안내용 화살표 금속 바닥판입니다(상/하/좌/우)."),
  packGroup(INTERIOR_HARNESS_PREFIX, "grass", "야외 잔디", "terrain", "lower", [240, 241, 242, 270, 271, 272, 300, 301, 302, 330, 331, 332, 7, 127, 247, 361, 364, 243, 244, 245, 273, 274, 275, 303, 304, 305, 333, 334, 335], "passable", "repeat", "마을 외곽 야외용 잔디입니다(짙은 잔디 경계 포함). 실내 바닥으로 쓰지 마세요."),
  packGroup(INTERIOR_HARNESS_PREFIX, "outdoor-ground", "야외 지면(흙/모래/자갈)", "terrain", "lower", [6, 8, 36, 37, 38, 66, 67, 68, 96, 97, 98, 9, 10, 11, 39, 40, 41, 69, 70, 71, 99, 100, 101, 246, 248, 276, 277, 278, 306, 307, 308, 336, 337, 338, 132, 133, 192, 193, 222, 223, 252, 253], "passable", "repeat", "야외 흙땅·모래밭·자갈 포장 등 통행 가능한 실외 지면입니다."),
  packGroup(INTERIOR_HARNESS_PREFIX, "water", "연못/물", "water", "lower", [0, 1, 2, 3, 4, 5, 30, 31, 32, 33, 34, 35, 60, 61, 62, 63, 64, 65, 90, 91, 92, 93, 94, 95, 120, 121, 122, 123, 150, 151, 152, 153, 180, 181, 182, 183, 210, 211, 212, 213], "solid", "repeat", "연못·깊은 물·폭포 애니메이션 타일입니다. 통행 불가."),
  packGroup(INTERIOR_HARNESS_PREFIX, "wall-cream", "크림 회벽", "wall", "lower", [74, 75, 76, 77, 104, 105, 106, 107], "solid", "repeat", "주민 집 실내의 크림색 회벽 면입니다(105 브러시가 벽 프레임 오토타일)."),
  packGroup(INTERIOR_HARNESS_PREFIX, "wall-brick", "벽돌 벽", "wall", "lower", [14, 15, 16, 17, 44, 45, 46, 47, 134, 135, 136, 137, 164, 165, 166, 167, 314, 315, 316, 317, 344, 345, 346, 347], "solid", "repeat", "자주/밝은/금장 벽돌 벽면입니다. 방 외곽을 막습니다."),
  packGroup(INTERIOR_HARNESS_PREFIX, "wall-stone", "돌/동굴 벽", "wall", "lower", [194, 195, 196, 197, 224, 225, 226, 227, 254, 255, 256, 284, 285, 286, 287, 283, 282], "solid", "repeat", "어두운 돌벽과 동굴 암벽입니다."),
  packGroup(INTERIOR_HARNESS_PREFIX, "wall-panel", "석벽/판자 벽", "wall", "lower", [402, 403, 404, 432, 433, 434, 462, 463, 464, 111, 141, 171, 81, 129, 159, 189, 219], "solid", "repeat", "흰 석벽·선반턱·격자 창살·판자 슬랫 등 기타 벽면입니다."),
  // 234(반투명 그림자 오버레이)는 transparent-props 소속 — 두 그룹에 겹치면 재적용 시 tileMeta가 진동해 idempotency가 깨진다.
  packGroup(INTERIOR_HARNESS_PREFIX, "dark-zone", "암흑/어두운 벽", "wall", "lower", [366, 367, 368, 369, 370, 371, 396, 397, 398, 399, 400, 401, 426, 427, 428, 429, 430, 431, 456, 457, 458, 459, 460, 461, 116, 146, 233, 257, 258], "solid", "repeat", "어두운 벽(366 브러시) 오토타일 계열과 동굴 암흑·공허(430/116) 타일입니다."),
  packGroup(INTERIOR_HARNESS_PREFIX, "kitchen", "주방 설비", "building", "lower", [21, 51, 22, 23, 52, 53, 373], "solid", "fixed", "화덕 오븐(21+51 세로쌍)·조리대(22/23+52/53)·벽난로 아궁이(373)입니다. 통행 불가."),
  packGroup(INTERIOR_HARNESS_PREFIX, "counter", "카운터/천 테이블", "building", "lower", [198, 199, 200, 201, 228, 229, 230, 231], "solid", "fixed", "점토·나무 카운터와 흰 천 테이블(전면 뷰)입니다. 통행 불가."),
  packGroup(INTERIOR_HARNESS_PREFIX, "curtain", "붉은 대형 커튼", "building", "lower", [142, 143, 172, 173, 202, 203], "solid", "fixed", "무대용 대형 붉은 커튼(2×3)입니다. 벽면에 배치합니다."),
  packGroup(INTERIOR_HARNESS_PREFIX, "pillar", "기둥/제단", "building", "lower", [312, 313, 342, 343, 372, 374], "solid", "fixed", "석재 기둥 상·하단과 석판 제단입니다."),
  packGroup(INTERIOR_HARNESS_PREFIX, "hedge", "숲/산(월드맵 겸용)", "building", "lower", [360, 362, 390, 391, 392, 420, 421, 422, 450, 451, 452, 363, 365, 393, 394, 395, 423, 424, 425, 453, 454, 455], "solid", "repeat", "숲 수풀 블롭과 산 둔덕 군집입니다 — 월드맵과 공용 표현. 통행 불가."),
  packGroup(INTERIOR_HARNESS_PREFIX, "fire-magic", "모닥불/마법 블록/용암", "building", "lower", [124, 154, 184, 214, 125, 155, 185, 215, 232], "solid", "fixed", "모닥불·푸른 마법 블록 애니메이션과 용암 바닥입니다. 통행 불가."),
  packGroup(INTERIOR_HARNESS_PREFIX, "transparent-props", "실내 투명 배경 소품", "prop", "upper", INTERIOR_TRANSPARENT_PROP_TILES, "passable", "fixed", "분홍 투명 배경을 가진 실내 가구와 장식입니다. 바닥 위 레이어에 배치해야 배경색이 드러나지 않습니다."),
];

// Scarloxy MPWSP01 칩셋 3종 — 그룹 시드는 scripts/import-scarloxy-pack.py 가 기록한
// scarloxyPackManifest.json 블록 배치에서 파생된다(scarloxyPack.ts 참조).
function createScarloxyThemePacks(): readonly ThemeMetadataPack[] {
  return SCARLOXY_CHIPSET_ASSETS.map((asset) => {
    const key = asset.textureKey.replace("tex_scarloxy_chipset_", "");
    const prefix = `harness-scarloxy-${key}-v1-`;
    return {
      id: `scarloxy-${key}-v1`,
      version: "1",
      textureKey: asset.textureKey,
      prefix,
      groups: scarloxyChipsetGroupSeeds(asset.textureKey).map((seed) =>
        packGroup(prefix, seed.key, seed.name, seed.role, seed.defaultLayer, seed.tileIds, seed.passage, seed.repeatability, seed.description)
      ),
    };
  });
}

const THEME_PACKS: readonly ThemeMetadataPack[] = [
  { id: DUNGEON_METADATA_PACK_ID, version: DUNGEON_METADATA_PACK_VERSION, textureKey: DUNGEON_TEXTURE_KEY, prefix: DUNGEON_HARNESS_PREFIX, groups: DUNGEON_HARNESS_GROUPS },
  { id: INTERIOR_METADATA_PACK_ID, version: INTERIOR_METADATA_PACK_VERSION, textureKey: INTERIOR_TEXTURE_KEY, prefix: INTERIOR_HARNESS_PREFIX, groups: INTERIOR_HARNESS_GROUPS },
  ...createScarloxyThemePacks(),
];

// 큐레이션 시맨틱(타일별 정밀 라벨·태그) — 실내 팩 tileMeta 시드의 라벨 정본.
// 2026-07-12 라벨 이중 소스 통일: 검색 전용이던 테이블을 시드 원천으로 승격(combined_town의 labelForTile 대응물).
const INTERIOR_SEMANTIC_BY_INDEX = new Map(INTERIOR_TILE_SEMANTICS.map((entry) => [entry.index, entry]));

function isInteriorPackTileset(tileset: Pick<TilesetDef, "image">): boolean {
  return tileset.image.type === "bundled" && tileset.image.id === INTERIOR_TEXTURE_KEY;
}

export function applyEasyRpgThemeMetadataPacks(tileset: TilesetDef): boolean {
  const pack = themePackForTileset(tileset);
  if (!pack) return false;
  let changed = applyThemeMetadataPack(tileset, pack);
  if (pack.textureKey === INTERIOR_TEXTURE_KEY) {
    // 그룹 밖 타일 시드 + 옛 팩 개정의 잔존 라벨 청소(그룹 순회는 group.tileIds만 돌기 때문).
    changed = seedInteriorUngroupedTileMeta(tileset) || changed;
    // Cream wall-frame (105 brush) + dark wall terrain (366 brush).
    // Painting 366 with auto-connect must reshape edges/corners without hand-picking variants.
    changed = seedInteriorWallFrameAutotileGroup(tileset) || changed;
    changed = seedInteriorDarkWallAutotileGroup(tileset) || changed;
    // 지형/카펫 RM2k3 블록 6종(산울타리·흙무더기·흙땅·데크·자갈·청록 카펫) — vision 감사(2026-07-12)로 확정.
    for (const group of createInteriorTerrainAutotileGroups()) {
      changed = upsertAutotileGroupKeepingCurrent(tileset, group) || changed;
    }
  }
  if (pack.textureKey === DUNGEON_TEXTURE_KEY) {
    // 지형 12블록 + 붉은 카펫 9-슬라이스 — vision 감사 정본(1d8e9ee). host↔overlay connectsTo 포함.
    // 브러시(각 블록 몸통)를 칠하면 shapeAutotileGroupAround가 테두리/코너를 자동 성형한다.
    for (const group of createDungeonTerrainAutotileGroups()) {
      changed = upsertAutotileGroupKeepingCurrent(tileset, group) || changed;
    }
  }
  return changed;
}

// 코드 정의가 갱신되면 기존 시드를 교체하고, 같으면 손대지 않는다(idempotent 재적용 계약).
function upsertAutotileGroupKeepingCurrent(tileset: TilesetDef, desired: AutotileGroup): boolean {
  const existing = tileset.autotileGroups ?? [];
  const idx = existing.findIndex((group) => group.id === desired.id);
  if (idx < 0) {
    tileset.autotileGroups = [...existing, desired];
    return true;
  }
  if (JSON.stringify(existing[idx]!.variantMap) === JSON.stringify(desired.variantMap)
    && JSON.stringify(existing[idx]!.memberTileIds) === JSON.stringify(desired.memberTileIds)
    && JSON.stringify(existing[idx]!.connectTileIds) === JSON.stringify(desired.connectTileIds)
    && JSON.stringify(existing[idx]!.triggerTileIds) === JSON.stringify(desired.triggerTileIds)) {
    return false;
  }
  const next = [...existing];
  next[idx] = desired;
  tileset.autotileGroups = next;
  return true;
}

export function isThemePackTileset(tileset: Pick<TilesetDef, "image">): boolean {
  return tileset.image.type === "bundled" && THEME_PACKS.some((pack) => pack.textureKey === tileset.image.id);
}

function themePackForTileset(tileset: Pick<TilesetDef, "image">): ThemeMetadataPack | null {
  if (tileset.image.type !== "bundled") return null;
  return THEME_PACKS.find((pack) => pack.textureKey === tileset.image.id) ?? null;
}

function applyThemeMetadataPack(tileset: TilesetDef, pack: ThemeMetadataPack): boolean {
  let changed = false;
  ensureTileMetaLength(tileset);
  for (const group of pack.groups) {
    for (const tile of group.tileIds) changed = applyTileContract(tileset, group, tile) || changed;
  }

  const groups = pack.groups.map(({ passage: _passage, repeatability: _repeatability, ...group }) => ({
    ...group,
    tileIds: [...group.tileIds],
    patternGrammar: clonePattern(group.patternGrammar),
  }));
  const current = tileset.tileGroups ?? [];
  const usedGroupIds = new Set(groups.map((group) => group.id));
  const preserved: TileGroupMetadata[] = [];
  for (const group of current.filter((candidate) => !isPackOwnedGroup(candidate, pack))) {
    const preservedGroup = preserveUserPrefixCollision(group, pack, usedGroupIds);
    usedGroupIds.add(preservedGroup.id);
    preserved.push(preservedGroup);
  }
  const next = [...preserved, ...groups];
  if (JSON.stringify(current) !== JSON.stringify(next)) {
    tileset.tileGroups = next;
    changed = true;
  }
  return changed;
}

function isPackOwnedGroup(group: TileGroupMetadata, pack: ThemeMetadataPack): boolean {
  return group.id.startsWith(pack.prefix) && group.source === "bundled-default";
}

function preserveUserPrefixCollision(
  group: TileGroupMetadata,
  pack: ThemeMetadataPack,
  usedGroupIds: ReadonlySet<string>
): TileGroupMetadata {
  if (!group.id.startsWith(pack.prefix) || !usedGroupIds.has(group.id)) return group;
  let suffix = 1;
  let id = `${group.id}-user-preserved`;
  while (usedGroupIds.has(id)) {
    suffix += 1;
    id = `${group.id}-user-preserved-${suffix}`;
  }
  return { ...group, id };
}

function applyTileContract(tileset: TilesetDef, group: PackHarnessGroup, tile: number): boolean {
  if (tile < 0 || tile >= tileset.count) return false;
  const meta = tileset.tileMeta?.[tile];
  if (meta?.userLocked === true || meta?.source === "user") return setTileRuntimeContract(tileset, tile, group, meta);
  // 실내 팩: 라벨·태그·통행성은 타일별 큐레이션 정본에서, 나머지 계약(레이어/설명)은 그룹에서.
  // 통행성 per-타일 오버라이드(2026-07-13): 가구는 solid, 바닥 장식은 passable — 그룹 일괄값의 한계 해소.
  const semantic = isInteriorPackTileset(tileset) ? INTERIOR_SEMANTIC_BY_INDEX.get(tile) : undefined;
  const passage = semantic?.passage ?? group.passage;
  const nextMeta: TileAiMetadata = {
    label: semantic ? semantic.label : `${group.name} ${tile}`,
    description: group.description,
    tags: semantic ? [...semantic.tags] : undefined,
    role: group.role,
    repeatability: group.repeatability,
    defaultLayer: group.defaultLayer,
    terrainTag: group.role === "terrain" ? 0 : undefined,
    passage,
    confidence: "high",
    source: "bundled-default",
  };
  let changed = false;
  if (JSON.stringify(meta) !== JSON.stringify(nextMeta)) {
    tileset.tileMeta![tile] = nextMeta;
    changed = true;
  }
  const effectiveGroup = passage === group.passage ? group : { ...group, passage };
  return setTileRuntimeContract(tileset, tile, effectiveGroup, tileset.tileMeta?.[tile]) || changed;
}

// 하네스 그룹에 속하지 않은 실내 타일도 큐레이션 라벨로 시드한다. 큐레이션에도 없는 타일은
// 빈 메타로 리셋해 옛 팩 버전의 잔존 라벨을 청소한다. 사용자 수기(source="user"/userLocked)는 불변.
function seedInteriorUngroupedTileMeta(tileset: TilesetDef): boolean {
  ensureTileMetaLength(tileset);
  const covered = new Set<number>();
  for (const group of INTERIOR_HARNESS_GROUPS) {
    for (const tile of group.tileIds) covered.add(tile);
  }
  let changed = false;
  for (let tile = 0; tile < tileset.count; tile += 1) {
    if (covered.has(tile)) continue;
    const meta = tileset.tileMeta?.[tile];
    if (meta?.userLocked === true || meta?.source === "user") continue;
    const semantic = INTERIOR_SEMANTIC_BY_INDEX.get(tile);
    const nextMeta: TileAiMetadata = semantic
      ? {
          label: semantic.label,
          description: "",
          tags: [...semantic.tags],
          role: semantic.role,
          passage: semantic.passage,
          confidence: "high",
          source: "bundled-default",
        }
      : { label: "", description: "", source: "unknown" };
    if (JSON.stringify(meta) !== JSON.stringify(nextMeta)) {
      tileset.tileMeta![tile] = nextMeta;
      changed = true;
    }
    // 런타임 통행성도 기록 — 그룹 밖 타일(책장 3×3 등)이 충돌 배열에서 빠지지 않게 한다.
    if (semantic) {
      const passability = semantic.passage === "solid" ? solid : passable;
      if (JSON.stringify(tileset.passability[tile]) !== JSON.stringify(passability)) {
        tileset.passability[tile] = { ...passability };
        changed = true;
      }
    }
  }
  return changed;
}

function setTileRuntimeContract(
  tileset: TilesetDef,
  tile: number,
  group: PackHarnessGroup,
  meta?: TileAiMetadata
): boolean {
  let changed = false;
  const hasUserRuntime = isUserRuntimeMeta(meta);
  const priority = hasUserRuntime && (meta?.defaultLayer === "lower" || meta?.defaultLayer === "upper")
    ? meta.defaultLayer
    : group.defaultLayer === "upper" ? "upper" : "lower";
  if (tileset.priority[tile] !== priority) {
    tileset.priority[tile] = priority;
    changed = true;
  }
  const passage = hasUserRuntime && meta?.passage ? meta.passage : group.passage;
  const passability = passage === "solid" ? solid : passable;
  if (JSON.stringify(tileset.passability[tile]) !== JSON.stringify(passability)) {
    tileset.passability[tile] = { ...passability };
    changed = true;
  }
  const terrain = hasUserRuntime && typeof meta?.terrainTag === "number"
    ? meta.terrainTag
    : group.role === "terrain" ? 0 : tileset.terrain[tile] ?? 0;
  if (tileset.terrain[tile] !== terrain) {
    tileset.terrain[tile] = terrain;
    changed = true;
  }
  return changed;
}

function isUserRuntimeMeta(meta: TileAiMetadata | undefined): boolean {
  return meta?.source === "user" || meta?.userLocked === true;
}

function ensureTileMetaLength(tileset: TilesetDef): void {
  tileset.tileMeta ??= [];
  while (tileset.tileMeta.length < tileset.count) tileset.tileMeta.push({ label: "", description: "", source: "unknown" });
}


function seedInteriorWallFrameAutotileGroup(tileset: TilesetDef): boolean {
  const existing = tileset.autotileGroups ?? [];
  if (existing.some((group) => group.id === INTERIOR_WALL_FRAME_AUTOTILE_GROUP_ID)) return false;
  tileset.autotileGroups = [...existing, createInteriorWallFrameAutotileGroup()];
  return true;
}

function seedInteriorDarkWallAutotileGroup(tileset: TilesetDef): boolean {
  const desired = createDarkWallAutotileGroup();
  const existing = tileset.autotileGroups ?? [];
  const idx = existing.findIndex((group) => group.id === INTERIOR_DARK_WALL_AUTOTILE_GROUP_ID);
  if (idx < 0) {
    tileset.autotileGroups = [...existing, desired];
    return true;
  }
  // Keep variantMap / members current when the 366 brush contract is updated in code.
  if (JSON.stringify(existing[idx]!.variantMap) === JSON.stringify(desired.variantMap)
    && JSON.stringify(existing[idx]!.memberTileIds) === JSON.stringify(desired.memberTileIds)
    && JSON.stringify(existing[idx]!.connectTileIds) === JSON.stringify(desired.connectTileIds)
    && JSON.stringify(existing[idx]!.triggerTileIds) === JSON.stringify(desired.triggerTileIds)) {
    return false;
  }
  const next = [...existing];
  next[idx] = desired;
  tileset.autotileGroups = next;
  return true;
}

function uniqueTileIds(tileIds: readonly number[]): number[] {
  return [...new Set(tileIds)];
}

function packGroup(
  prefix: string,
  id: string,
  name: string,
  role: TileGroupMetadata["role"],
  defaultLayer: TileGroupMetadata["defaultLayer"],
  tileIds: readonly number[],
  passage: PackHarnessGroup["passage"],
  repeatability: PackHarnessGroup["repeatability"],
  description: string
): PackHarnessGroup {
  return {
    id: `${prefix}${id}`,
    name,
    role,
    defaultLayer,
    tileIds,
    description,
    placementRules: description,
    confidence: "high",
    source: "bundled-default",
    passage,
    repeatability,
  };
}

function clonePattern(patternGrammar: PackHarnessGroup["patternGrammar"]): PackHarnessGroup["patternGrammar"] {
  return patternGrammar ? { ...patternGrammar, parts: patternGrammar.parts.map((part) => ({ role: part.role, tileIds: [...part.tileIds] })) } : undefined;
}
