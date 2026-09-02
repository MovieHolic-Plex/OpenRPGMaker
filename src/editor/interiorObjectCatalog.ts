/**
 * 실내 오브젝트 카탈로그 — 실내 가구/소품의 **형태(셀 행렬)** 를 선언형으로 담는 단일 정본.
 *
 * 기존 `INTERIOR_SEMANTIC_TILE_CATALOG`은 역할별 타일 id를 납작한 배열로만 갖고 있어
 * "어느 칸에 어느 타일이 오는가"를 알 수 없었다. 이 모듈의 `cells`는
 * `@/editor/harnessSuggestion/kitRender`의 `KitRenderCell`({dx,dy,layer,tile})과 구조가 같아
 * 에디터 '구조물' DB 탭이 그대로 래스터 미리보기를 그릴 수 있다.
 *
 * 이 모듈은 DOM·스토어 의존이 없다(노드 테스트 가능). 타일 번호는 절대 직접 쓰지 않고
 * `VR` 상수를 참조한다 — 예외는 반복 몸통(책장 가운데 열 19/49/79, 러그 오토타일 3×3)뿐이며,
 * 이들은 파이프라인에도 상수 이름이 없는 원본 세트다.
 */
import type { InteriorRoomTheme, InteriorSemanticTileRole } from "@/editor/interiorRoomPipeline";
import { interiorVocabTiles } from "@/editor/interiorRoomPipeline";

// 파이프라인과 서로 순환 초기화되므로 `VR` 상수를 직수입해 쓰면 TDZ에 걸린다.
// 호이십되는 생성자 함수를 통해 동일한 어휘 사전을 얻는다(값·타입 동일).
const VR = interiorVocabTiles();

/** 배치 스냅 규약 — 북벽 밀착 / 임의 벽면 / 바닥 / 자유. */
export type InteriorObjectSnap = "wall-north" | "wall-any" | "floor" | "free";

/** kitRender의 KitRenderCell과 구조 동일 — 오브젝트 원점 기준 상대 좌표 한 칸. */
export interface InteriorObjectCell {
  readonly dx: number;
  readonly dy: number;
  readonly layer: "lower" | "upper";
  readonly tile: number;
}

export interface InteriorObjectDef {
  readonly id: string;
  readonly label: string;
  /** 테마 문법의 필수 역할과 이어지는 의미 역할. 장식류는 null. */
  readonly role: string | null;
  readonly width: number;
  readonly height: number;
  /** 대표 레이어(역할 카탈로그의 layer와 일치). 칸별 레이어는 cells가 정본. */
  readonly layer: "lower" | "upper";
  readonly cells: readonly InteriorObjectCell[];
  readonly themes: readonly string[];
  readonly snap: InteriorObjectSnap;
}

/** 행렬(행=dy, 열=dx)을 셀 목록으로 펼친다. rows 안의 undefined 칸은 비운다. */
function cellsFromRows(
  rows: readonly (readonly (number | null)[])[],
  layer: "lower" | "upper",
): readonly InteriorObjectCell[] {
  const cells: InteriorObjectCell[] = [];
  rows.forEach((row, dy) => {
    row.forEach((tile, dx) => {
      if (tile === null) return;
      cells.push({ dx, dy, layer, tile });
    });
  });
  return cells;
}

function def(
  id: string,
  label: string,
  rows: readonly (readonly (number | null)[])[],
  layer: "lower" | "upper",
  themes: readonly InteriorRoomTheme[],
  snap: InteriorObjectSnap,
  role: InteriorSemanticTileRole | null = null,
  cells?: readonly InteriorObjectCell[],
): InteriorObjectDef {
  return {
    id,
    label,
    role,
    width: Math.max(...rows.map((row) => row.length)),
    height: rows.length,
    layer,
    cells: cells ?? cellsFromRows(rows, layer),
    themes,
    snap,
  };
}

const ALL_ROOM_THEMES: readonly InteriorRoomTheme[] = [
  "bedroom", "study", "dining", "kitchen", "storage", "tavern", "corridor",
] as const;

// 3×3 청록 카펫 오토타일(파이프라인 RUG_TEAL과 동일 세트) — 반복 몸통이라 VR 상수가 없다.
const RUG_TEAL_ROWS: readonly (readonly number[])[] = [
  [279, 280, 281],
  [309, 310, 311],
  [339, 340, 341],
];
// 3×3 붉은 카펫(파이프라인 RUG_RED) — 귀족 저택·예배당용.
const RUG_RED_ROWS: readonly (readonly number[])[] = [
  [375, 376, 377],
  [405, 406, 407],
  [435, 436, 437],
];
// 3×3 짚 돗자리(파이프라인 RUG_MAT) — 서민 식당·침상용.
const RUG_MAT_ROWS: readonly (readonly number[])[] = [
  [108, 109, 110],
  [138, 139, 140],
  [168, 169, 170],
];

export const INTERIOR_OBJECT_CATALOG: readonly InteriorObjectDef[] = [
  def("bed_h", "침대(가로)", [[VR.BED_L, VR.BED_R]], "upper", ["bedroom"], "wall-north", "bed"),
  def("bed_v", "침대(세로)", [[VR.BED_V_HEAD], [VR.BED_V_FOOT]], "upper", ["bedroom"], "wall-north", "bed"),
  // 책장은 3×3(좌 18/48/78 · 가운데 19/49/79 가로 반복 몸통 · 우 20/50/80).
  def(
    "bookshelf",
    "책장",
    [
      [VR.BOOK_TL, 19, VR.BOOK_TR],
      [VR.BOOK_ML, 49, VR.BOOK_MR],
      [VR.BOOK_BL, 79, VR.BOOK_BR],
    ],
    "lower",
    ["study"],
    "wall-north",
    "bookshelf",
  ),
  // 화덕은 세로 hard 쌍 — 상단(21)은 크림 벽면 행에 겹치는 upper, 하단(51)은 바닥 행 lower(통행 차단).
  def(
    "stove",
    "화덕",
    [[VR.STOVE_TOP], [VR.STOVE_BOT]],
    "lower",
    ["kitchen"],
    "wall-north",
    "stove",
    [
      { dx: 0, dy: 0, layer: "upper", tile: VR.STOVE_TOP },
      { dx: 0, dy: 1, layer: "lower", tile: VR.STOVE_BOT },
    ],
  ),
  def("table_long", "긴 탁자", [[VR.TABLE_L, VR.TABLE_R, VR.TABLE_R3]], "upper", ["dining", "tavern"], "floor", "table"),
  def("counter", "카운터 런", [[VR.COUNTER_L, VR.COUNTER_M, VR.COUNTER_R]], "upper", ["tavern"], "wall-north", "counter"),
  def(
    "table_chairs",
    "사각 탁자+의자 짝",
    [[VR.CHAIR_LEFT, VR.SQUARE_TABLE, VR.CHAIR_RIGHT]],
    "upper",
    ["dining", "study", "kitchen", "tavern"],
    "floor",
    "table",
  ),
  def("piano", "피아노", [[VR.PIANO_L, VR.PIANO_M, VR.PIANO_R]], "upper", ["tavern", "dining"], "wall-north"),
  def("clock", "괘종시계", [[VR.CLOCK_T], [VR.CLOCK_B]], "upper", ["bedroom", "study", "dining"], "wall-north"),
  def("armor", "갑옷 전시대", [[VR.ARMOR_T], [VR.ARMOR_B]], "upper", ["corridor", "storage"], "wall-north"),
  def("bust", "흉상", [[VR.BUST_T], [VR.BUST_B]], "upper", ["corridor", "study"], "wall-north"),
  def("mirror", "대형 거울", [[VR.MIRROR_T], [VR.MIRROR_B]], "upper", ["bedroom", "dining"], "wall-north"),
  def("display", "진열대", [[VR.DISPLAY_T], [VR.DISPLAY_B]], "upper", ["tavern", "dining"], "wall-north"),
  def("cabinet", "캐비닛", [[VR.CABINET_U], [VR.CABINET_L]], "lower", ["bedroom", "dining"], "wall-north"),
  def("rug", "러그", RUG_TEAL_ROWS, "lower", ["bedroom", "dining", "study"], "floor"),
  def("hearth", "벽난로 아궁이", [[VR.HEARTH]], "lower", ["kitchen", "tavern"], "wall-any"),
  def("cauldron", "가마솥", [[VR.CAULDRON]], "upper", ["kitchen"], "floor"),
  def("barrel", "술통", [[VR.BARREL]], "upper", ["storage", "tavern", "kitchen"], "floor"),
  def("crate", "나무 상자", [[VR.CRATE]], "lower", ["storage", "tavern", "kitchen"], "floor"),
  def("jars", "항아리", [[VR.JARS]], "upper", ["kitchen", "storage", "bedroom"], "floor"),
  def("plant", "화분", [[VR.PLANT]], "upper", ["corridor", "dining"], "floor"),
  def("window", "창문", [[VR.WINDOW]], "lower", ALL_ROOM_THEMES, "wall-any"),
  def("picture", "그림", [[VR.PICTURE_L, VR.PICTURE_R]], "lower", ["bedroom", "study", "dining", "corridor"], "wall-any"),
  def("sword_rack", "검 거치대", [[VR.SWORD_RACK]], "upper", ["tavern", "corridor"], "wall-any"),
  def("crystal", "수정구 점술대", [[VR.CRYSTAL_BALL]], "upper", ["study"], "floor"),
  def("stairs", "가로 계단", [[VR.STAIRS_L, VR.STAIRS_M, VR.STAIRS_R]], "lower", ["corridor", "tavern"], "free"),
  def("tavern_sign", "선술집 간판", [[VR.TAVERN_SIGN]], "lower", ["tavern"], "wall-any"),
  def("ladder", "사다리", [[VR.LADDER]], "lower", ["storage"], "wall-any"),
  // 2026-09-02 개념 꾸러미 시설 다양화 — 파이프라인 어휘(wallFace·corner·openFloor)에 이미 있던 소품을 오브젝트로 올린다.
  // 벽걸이는 벽면 윗줄에 상위 레이어로 얹히고(placeWallMount 정본), 1×1 바닥 소품은 구석·둘레에 선다.
  def("religious", "성상", [[VR.RELIGIOUS]], "upper", ["study", "dining", "bedroom", "corridor"], "wall-any"),
  def("fruit_shelf", "과일 선반", [[VR.FRUIT_SHELF]], "upper", ["kitchen", "dining", "tavern"], "wall-any"),
  def("shelf_jars", "항아리 선반", [[VR.SHELF_JARS]], "upper", ["kitchen", "storage", "tavern"], "wall-any"),
  def("grain", "곡물 자루", [[VR.GRAIN]], "upper", ["storage", "kitchen"], "floor"),
  def("box", "잡화 상자", [[VR.BOX]], "upper", ["storage", "bedroom", "study", "dining"], "floor"),
  def("bucket", "물통", [[VR.BUCKET]], "upper", ["kitchen", "storage"], "floor"),
  def("kettle", "주전자", [[VR.KETTLE]], "upper", ["kitchen", "tavern"], "floor"),
  def("stool", "스툴", [[VR.STOOL]], "upper", ["tavern", "kitchen", "dining"], "floor"),
  def("rug_red", "붉은 카펫", RUG_RED_ROWS, "lower", ["dining", "tavern", "study", "corridor"], "floor"),
  def("rug_mat", "짚 돗자리", RUG_MAT_ROWS, "lower", ["bedroom", "kitchen", "storage", "dining"], "floor"),
] as const;

const BY_ID = new Map<string, InteriorObjectDef>(INTERIOR_OBJECT_CATALOG.map((entry) => [entry.id, entry]));

/** 해당 테마에서 쓸 수 있는 오브젝트 목록(선언 순서 유지). */
export function interiorObjectsForTheme(theme: string): readonly InteriorObjectDef[] {
  return INTERIOR_OBJECT_CATALOG.filter((entry) => entry.themes.includes(theme));
}

/** id로 오브젝트 정의를 찾는다. 없으면 undefined. */
export function interiorObjectById(id: string): InteriorObjectDef | undefined {
  return BY_ID.get(id);
}
