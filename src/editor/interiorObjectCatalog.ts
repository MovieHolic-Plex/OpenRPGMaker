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
import { VR } from "@/project/tilesetHarness/interiorRoomGroups";

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
  /** Authored assembly/state guidance, preserved in the tileset and exposed to the AI. */
  readonly description?: string;
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

/** Extensible tabletop, with its opaque surface below props and transparent apron above the floor. */
export function interiorTableCells(width = 3, depth = 2, white = false): readonly InteriorObjectCell[] {
  if (!Number.isInteger(width) || width < 3 || !Number.isInteger(depth) || depth < 1) throw new Error("Table requires width >= 3 and depth >= 1");
  const cells: InteriorObjectCell[] = [];
  for (let y=0;y<depth;y++) for (let x=0;x<width;x++) {
    const column = x === 0 ? 0 : x === width-1 ? 2 : 1;
    cells.push({dx:x,dy:y,layer:"lower",tile:(white ? 159 : 156)+(y === 0 ? 0 : 30)+column});
  }
  for (let x=0;x<width;x++) cells.push({dx:x,dy:depth,layer:"upper",tile:(white ? 228 : 198)+(x===0?0:x===width-1?2:1)});
  return cells;
}
function tableSet(id:string,label:string,props:readonly number[],white=false): InteriorObjectDef {
  const table = interiorTableCells(3,2,white).map(cell=>({...cell,dx:cell.dx+1}));
  const cells: InteriorObjectCell[]=[...table,
    {dx:0,dy:1,layer:"upper",tile:VR.CHAIR_RIGHT}, {dx:4,dy:1,layer:"upper",tile:VR.CHAIR_LEFT},
    ...props.map((tile,i)=>({dx:1+i,dy:0,layer:"upper" as const,tile})),
  ];
  return def(id,label,Array.from({length:3},()=>Array(5).fill(null)),"lower",["study","dining","kitchen","tavern"],"floor","table",cells);
}

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
  // 학습 자리는 탁자 앞의 걸상까지 한 물건으로 배치해 좌석이 구석으로 흩어지지 않게 한다.
  def("study_desk", "학습 책상과 걸상", [
    [VR.SQUARE_TABLE],
    [VR.STOOL],
  ], "upper", ["study"], "floor", "table"),
  def("counter", "접수용 긴 탁자", [[VR.COUNTER_L, VR.COUNTER_M, VR.COUNTER_R]], "upper", ["tavern"], "wall-north", "counter"),
  def(
    "table_chairs",
    "사각 탁자+의자 짝",
    [[VR.CHAIR_RIGHT, VR.SQUARE_TABLE, VR.CHAIR_LEFT]],
    "upper",
    ["dining", "study", "kitchen", "tavern"],
    "floor",
    "table",
  ),
  def("piano", "피아노", [[VR.PIANO_L, VR.PIANO_M, VR.PIANO_R]], "upper", ["tavern", "dining"], "wall-north"),
  def("clock", "벽걸이 괘종시계", [[VR.CLOCK_T], [VR.CLOCK_B]], "upper", ["bedroom", "study", "dining"], "wall-any"),
  def("armor", "갑옷 전시대", [[VR.ARMOR_T], [VR.ARMOR_B]], "upper", ["corridor", "storage"], "wall-north"),
  def("bust", "흉상", [[VR.BUST_T], [VR.BUST_B]], "upper", ["corridor", "study"], "wall-north"),
  def("mirror", "대형 거울", [[VR.MIRROR_T], [VR.MIRROR_B]], "upper", ["bedroom", "dining"], "wall-north"),
  def("display", "검 진열 박스", [[VR.DISPLAY_T], [VR.DISPLAY_B]], "upper", ["tavern", "dining"], "wall-north"),
  def("cabinet", "캐비닛", [[VR.CABINET_U], [VR.CABINET_L]], "upper", ["bedroom", "dining"], "wall-north"),
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
  def("stairs", "붉은 카펫 대계단", [[VR.STAIRS_L, VR.STAIRS_M, VR.STAIRS_R]], "lower", ["corridor", "tavern"], "free"),
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
  // Keep the saved object id; tile 235 is a jar, not a kettle.
  def("kettle", "항아리", [[VR.KETTLE]], "upper", ["kitchen", "tavern"], "floor"),
  def("stool", "스툴", [[VR.STOOL]], "upper", ["tavern", "kitchen", "dining"], "floor"),
  def("rug_red", "붉은 카펫", RUG_RED_ROWS, "lower", ["dining", "tavern", "study", "corridor"], "floor"),
  def("rug_mat", "짚 돗자리", RUG_MAT_ROWS, "lower", ["bedroom", "kitchen", "storage", "dining"], "floor"),
  def("table_wood", "확장 목재 탁자", [[156,157,158],[186,187,188],[198,199,200]], "lower", ["dining","study","kitchen"], "floor", "table", interiorTableCells()),
  def("table_white", "흰색 탁자", [[159,160,161],[189,190,191],[228,229,230]], "lower", ["dining","study"], "floor", "table", interiorTableCells(3,2,true)),
  tableSet("tea_table", "차탁과 마주 보는 의자", [235,204]),
  tableSet("reading_table", "책·촛대와 독서 좌석", [145,204]),
  tableSet("dining_table", "식기·요리와 식사 좌석", [207,238,208]),
  tableSet("consultation_table", "기록·촛대와 상담 좌석", [145,204], true),
  def("altar_table", "흰 제단과 촛대", [[159,160,161],[189,190,191],[228,229,230]], "lower", ["study"], "floor", "table", [...interiorTableCells(3,2,true),{dx:0,dy:0,layer:"upper",tile:204},{dx:2,dy:0,layer:"upper",tile:204}]),
  def("work_table", "작업 탁자와 도구", [[156,157,158],[186,187,188],[198,199,200]], "lower", ["kitchen"], "wall-north", "table", [...interiorTableCells(),{dx:0,dy:0,layer:"upper",tile:261},{dx:2,dy:0,layer:"upper",tile:414}]),
  def("stairs_small", "한 칸 계단", [[444]], "lower", ["corridor"], "free"),
  def("stairs_horizontal", "벽 높이를 잇는 돌계단", [[141,111,171],[141,111,171],[141,111,171]], "lower", ["corridor"], "free"),
  def("stairs_down", "아래층 계단", [[474]], "upper", ["corridor"], "free"),
  def("flue", "난로 연통", [[209],[239]], "upper", ["kitchen","tavern"], "wall-north"),
  {
    ...def("stone_hearth_unlit", "석조 화로 (꺼짐, 3×3)", [[402,403,404],[432,433,434],[462,463,464]], "lower", ["kitchen","tavern","dining"], "wall-north"),
    description: "하나의 3×3 석조 화로: 402·403·404 / 432·433·434 / 462·463·464. 아래 가운데 463은 불이 꺼진 화구다. 벽·창살 낱장으로 조립하지 않는다. 켜진 화로는 stone_hearth_lit을 선택한다.",
  },
  {
    ...def("stone_hearth_lit", "석조 화로 (불 켜짐, 3×3)", [[402,403,404],[432,433,434],[462,124,464]], "lower", ["kitchen","tavern","dining"], "wall-north"),
    description: "꺼진 화로의 아래 가운데 (1,2)만 463 대신 124로 바꾼다. 불은 124→154→184→214, 초당 4프레임으로 반복 재생된다. 나머지 여덟 석재 셀은 동일하다. 꺼진 화로는 stone_hearth_unlit을 선택한다.",
  },
  def("care_bed", "병상과 간병 걸상", [[VR.BED_V_HEAD,null],[VR.BED_V_FOOT,VR.STOOL]], "upper", ["bedroom"], "wall-north", "bed"),
  def("teacher_desk", "교사용 책상과 펼친 책", [[156,157,158],[198,199,200]], "lower", ["study"], "wall-north", "table", [...interiorTableCells(3,1),{dx:1,dy:0,layer:"upper",tile:145}]),
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
