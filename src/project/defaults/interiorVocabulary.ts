import { DARK_WALL_TILE } from "./darkWallAutotile";

export type InteriorRoomTheme = "bedroom" | "study" | "dining" | "kitchen" | "storage" | "tavern" | "corridor";
export type InteriorSemanticTileRole = "bed" | "bookshelf" | "stove" | "table" | "counter";

export function interiorVocabTiles() {
  return {
    VOID: 430,
    FLOOR: 72,
    FLOOR_HOLE: 73,
    /** Dark wall body / brush (autotile). */
    BODY: DARK_WALL_TILE.BODY,
    INNER_L: 104,
    INNER_R: 106,
    /** @deprecated legacy dark-wall store variants — render quarters only under Option B */
    EDGE_W: 396,
    EDGE_E: 398,
    EDGE_N: 367,
    EDGE_S: 427,
    CORNER_NW: 368,
    CORNER_NE: 369,
    BEAM_SW: 426,
    BEAM_SE: 428,
    ALCOVE_L: 396,
    ALCOVE_R: 398,
    // 책장은 3×3 세트(좌 18/48/78 · 중 19/49/79 가로 반복 · 우 20/50/80) — 2026-07-12 fable 감사 확정.
    // 2×3 조립은 좌+우 열을 쓴다. (구버그: 하단을 78+79(좌+중)로 조립해 우측 프레임이 사라졌었음)
    BOOK_TL: 18,
    BOOK_TR: 20,
    BOOK_ML: 48,
    BOOK_MR: 50,
    BOOK_BL: 78,
    BOOK_BR: 80,
    WINDOW: 56,
    RELIGIOUS: 59,
    PICTURE_L: 114,
    PICTURE_R: 115,
    CABINET_U: 148,
    CABINET_L: 178,
    SWORD_RACK: 260,
    PLANT: 289,
    TABLE_TOP: 264,
    TABLE_BOT: 294,
    BOX: 295,
    CHAIR_RIGHT: 297,
    CHAIR_LEFT: 298,
    BED_L: 355,
    BED_R: 356,
    BROKEN_GLASS: 417,
    GRAIN: 471,
    STAIRS_DOWN: 475,
    // 2026-07-12 vision 감사로 추가된 가구 — kitchen/storage/tavern 테마용.
    /** 화덕 오븐 상단(21)+하단(51) — 불투명 lower 세로쌍, 북벽에 붙여 배치. */
    STOVE_TOP: 21,
    STOVE_BOT: 51,
    /** 벽난로 아궁이(373) — 벽면 매립 화구. 실내 바닥 모닥불(124) 대체(2026-07-20). */
    HEARTH: 373,
    CAULDRON: 323,
    KETTLE: 235,
    BUCKET: 265,
    JARS: 350,
    FRUIT_SHELF: 25,
    SHELF_JARS: 320,
    CRATE: 55,
    BARREL: 205,
    TAVERN_SIGN: 58,
    LADDER: 472,
    /** 가로 긴 탁자 좌(325)|우(326) — 침대와 같은 hard 좌우쌍. */
    TABLE_L: 325,
    TABLE_R: 326,
    STOOL: 266,
    // 2026-07-12 감사 어휘 확장 — "소재 부족" 리뷰 해소. 전부 tileSemanticsInterior 정본 대조 완료.
    TABLE_R3: 327, //        긴 탁자 오른끝(325|326*|327 3칸 세트)
    PIANO_L: 357, //         보완 작화된 왼쪽 측판
    PIANO_M: 358,
    PIANO_R: 359,
    MIRROR_T: 269, //        대형 거울(세로 2칸, 벽 걸침)
    MIRROR_B: 299,
    CLOCK_T: 389, //         괘종시계(세로 2칸, 벽 걸침)
    CLOCK_B: 419,
    BUST_T: 88, //           흉상(석상, 세로 2칸)
    BUST_B: 118,
    ARMOR_T: 87, //          갑옷 전시대(세로 2칸)
    ARMOR_B: 117,
    DISPLAY_T: 263, //       물약·검 진열대(세로 2칸)
    DISPLAY_B: 293,
    SQUARE_TABLE: 328, //    사각 탁자(1칸) — 의자 짝 규칙의 기준 가구
    CRYSTAL_BALL: 329, //    수정구 점술대
    STAIRS_L: 465, //        가로 계단(좌·몸통 반복·우)
    STAIRS_M: 466,
    STAIRS_R: 467,
    BED_V_HEAD: 324, //      세로 침대(머리 북쪽) — 침대 방향 변주
    BED_V_FOOT: 354,
    COUNTER_L: 325, // 접수용 긴 탁자. 오분류된 408~410은 자동 배치하지 않는다.
    COUNTER_M: 326,
    COUNTER_R: 327,
  } as const;
}

export const VR = interiorVocabTiles();
