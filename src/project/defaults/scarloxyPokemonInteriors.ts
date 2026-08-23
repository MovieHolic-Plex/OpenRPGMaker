// Scarloxy 포켓몬풍 데모 — 실내 맵 3종(연구소·주인공 집·회복 센터).
//
// 타일 그림판 선택 근거(2026-08-03 조사):
//   Scarloxy 팩의 scarloxy-chipset-indoor.png 는 **타일 정렬 아틀라스가 아니다**.
//   원본 vendor/scarloxy-mpwsp01/graphics/tilesets/indoor.png 는 문·창문·계단을
//   임의 픽셀 오프셋으로 배치한 샘플 합성본이라(문 프레임이 타일 경계를 가로지름)
//   벽/바닥 런으로 반복할 수 없다. 게다가 가구가 한 점도 없다.
//   따라서 실내 셸+가구는 이미 정밀 감사된 EasyRPG RTP Interior 타일 그림판을 쓴다
//   (통행/레이어 계약: tilesetHarness/themePacks.ts INTERIOR_HARNESS_GROUPS,
//    타일 어휘 정본: editor/interiorRoomPipeline.ts 의 VR / HOUSE_WALL_FACE).
//
// 타일 상수는 위 정본에서 복사해 왔다 — project/defaults 가 editor/ 를 import 하지
// 않도록(레이어 분리) 값만 옮기고 출처를 주석으로 남긴다.

import type { Command, GameEvent, GameMap } from "../types";
import { DEFAULT_TILE_SIZE } from "./constants";
import { charsetGraphic, event, page, PEOPLE1_CHARSET_ID, PEOPLE2_CHARSET_ID, talker, transferEvent } from "./scarloxyDemoGame";

export const INTERIOR_TILESET_ID = "easyrpg_chipset_interior";

export const LAB_MAP_ID = "map_pkmn_lab";
export const HOME_MAP_ID = "map_pkmn_home";
export const CENTER_MAP_ID = "map_pkmn_center";

const EMPTY = -1;

// --- RTP Interior 타일 어휘 (interiorRoomPipeline.ts VR / HOUSE_WALL_FACE 정본) ---
const T = {
  FLOOR: 72, // 나무 마루 몸통(73은 구멍 난 변형 — 바닥 채우기에 쓰지 않는다)
  FLOOR_PLANK: 102, // 나무 널 — 문턱 표시용 변주
  FLOOR_STONE: 42, // 회청색 돌바닥 — 연구소/센터 로비용(12는 자주빛이라 실내가 탁하다)
  WALL_UL: 74, // 북벽 윗줄 좌
  WALL_UM: 75, // 북벽 윗줄 몸통(반복)
  WALL_UR: 76, // 북벽 윗줄 우
  WALL_L: 104, // 북벽 아랫줄 좌(걸레받이)
  WALL_M: 105, // 북벽 아랫줄 몸통(반복)
  WALL_R: 106, // 북벽 아랫줄 우
  WALL_SOLO_L: 107, // 1칸 세로 칸막이 하단 — 좌우 측벽에 사용
  // 가구(전부 INTERIOR_TRANSPARENT_PROP_TILES 소속 → upper 레이어 배치가 계약)
  BED_HEAD: 324,
  BED_FOOT: 354,
  BOOK_TL: 147,
  BOOK_TM: 148,
  BOOK_TR: 149,
  BOOK_BL: 177,
  BOOK_BM: 178,
  BOOK_BR: 179,
  TABLE_L: 325,
  TABLE_M: 326,
  TABLE_R: 327,
  SQUARE_TABLE: 328,
  CHAIR_RIGHT: 297,
  CHAIR_LEFT: 298,
  CRYSTAL_BALL: 329,
  COUNTER_L: 408,
  COUNTER_M: 409,
  COUNTER_R: 410,
  DISPLAY_T: 263,
  DISPLAY_B: 293,
  MIRROR_T: 269,
  MIRROR_B: 299,
  CLOCK_T: 389,
  CLOCK_B: 419,
  BARREL: 205,
  KETTLE: 235,
  CRATE: 55,
  JARS: 350,
} as const;

/** 3×3 청록 카펫(오토타일 세트 테두리+몸통) — interiorRoomPipeline RUG_TEAL. */
const RUG_TEAL: readonly (readonly number[])[] = [
  [279, 280, 281],
  [309, 310, 311],
  [339, 340, 341],
];

type InteriorSpec = {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly floor: number;
  /** 출입구(남벽) x 좌표. 플레이어는 이 칸을 밟고 바깥으로 나간다. */
  readonly doorX: number;
};

/**
 * 실내 셸을 만든다 — 북벽 2단(크림 회벽) + 좌우/남 테두리 + 바닥.
 * 셸 타일은 전부 INTERIOR_HARNESS_GROUPS 의 wall-cream(solid) 소속이라 통행이 막힌다.
 * 남벽 doorX 한 칸만 바닥 타일로 뚫어 출구 이벤트를 올린다.
 */
function createInteriorShell(spec: InteriorSpec): GameMap {
  const { width, height, floor, doorX } = spec;
  const lowerTiles = new Array<number>(width * height).fill(floor);
  const upperTiles = new Array<number>(width * height).fill(EMPTY);
  const at = (x: number, y: number): number => y * width + x;

  for (let x = 0; x < width; x += 1) {
    // 북벽 2단.
    lowerTiles[at(x, 0)] = x === 0 ? T.WALL_UL : x === width - 1 ? T.WALL_UR : T.WALL_UM;
    lowerTiles[at(x, 1)] = x === 0 ? T.WALL_L : x === width - 1 ? T.WALL_R : T.WALL_M;
    // 남벽.
    lowerTiles[at(x, height - 1)] = T.WALL_M;
  }
  for (let y = 2; y < height - 1; y += 1) {
    lowerTiles[at(0, y)] = T.WALL_SOLO_L;
    lowerTiles[at(width - 1, y)] = T.WALL_SOLO_L;
  }
  // 남벽 출입구 — 크림 벽을 한 칸 뚫고 문턱을 다른 바닥재로 깔아 눈에 띄게 한다.
  // (RTP 문설주 396/398 은 어두운 벽 오토타일 계열이라 크림 셸과 붙이면 검게 튄다 —
  //  interiorRoomPipeline VR.EDGE_W/EDGE_E 주석 참조. 그래서 문설주 없이 개구부만 낸다.)
  const threshold = floor === T.FLOOR ? T.FLOOR_PLANK : T.FLOOR;
  lowerTiles[at(doorX, height - 1)] = threshold;
  lowerTiles[at(doorX, height - 2)] = threshold;

  return {
    id: spec.id,
    name: spec.name,
    width,
    height,
    tilesetId: INTERIOR_TILESET_ID,
    tileSize: DEFAULT_TILE_SIZE,
    lowerTiles,
    upperTiles,
    events: [],
  };
}

function put(map: GameMap, x: number, y: number, tile: number): void {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
  map.upperTiles[y * map.width + x] = tile;
}

function putRow(map: GameMap, x: number, y: number, tiles: readonly number[]): void {
  tiles.forEach((tile, index) => put(map, x + index, y, tile));
}

function putRug(map: GameMap, x: number, y: number): void {
  RUG_TEAL.forEach((row, dy) => {
    row.forEach((tile, dx) => {
      const tx = x + dx;
      const ty = y + dy;
      if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return;
      map.lowerTiles[ty * map.width + tx] = tile;
    });
  });
}

/** 실내 → 마을 복귀 이벤트. 남벽 출입구 칸에 놓는다. */
function exitEvent(id: string, x: number, y: number, townMapId: string, backX: number, backY: number): GameEvent {
  return transferEvent(id, x, y, townMapId, backX, backY, "밖으로");
}

// --- 1. 몬스터 연구소 (마을 병원 건물 내부) ----------------------------------

export function createLabInteriorMap(townMapId: string, backX: number, backY: number): GameMap {
  const map = createInteriorShell({ id: LAB_MAP_ID, name: "몬스터 연구소", width: 15, height: 12, floor: T.FLOOR_STONE, doorX: 7 });

  // 북벽 연구 설비: 좌측 책장 3×2, 우측 진열대 + 괘종시계.
  putRow(map, 1, 2, [T.BOOK_TL, T.BOOK_TM, T.BOOK_TR]);
  putRow(map, 1, 3, [T.BOOK_BL, T.BOOK_BM, T.BOOK_BR]);
  put(map, 11, 2, T.DISPLAY_T);
  put(map, 11, 3, T.DISPLAY_B);
  put(map, 13, 2, T.CLOCK_T);
  put(map, 13, 3, T.CLOCK_B);

  // 중앙 연구대 — 긴 탁자 + 수정구(도감 단말 대용) + 의자.
  putRow(map, 5, 4, [T.TABLE_L, T.TABLE_M, T.TABLE_R]);
  put(map, 8, 4, T.CRYSTAL_BALL);
  put(map, 5, 5, T.CHAIR_RIGHT);
  put(map, 7, 5, T.CHAIR_LEFT);

  // 자재 구역.
  put(map, 2, 8, T.CRATE);
  put(map, 3, 8, T.BARREL);
  put(map, 12, 8, T.JARS);

  map.events.push(
    exitEvent("ev_pkmn_lab_exit", 7, 11, townMapId, backX, backY),
    talker("ev_pkmn_lab_aide", 9, 5, "조수", [
      "박사님은 앞마당에 계세요. 스타터를 아직 못 받았다면 먼저 말을 걸어보세요.",
      "이 수정구는 도감 단말이에요. 잡은 몬스터의 종·레벨·진화 조건이 여기 기록됩니다.",
    ], [], charsetGraphic(PEOPLE2_CHARSET_ID, 0)),
    talker("ev_pkmn_lab_bookshelf", 2, 4, "책장", [
      "진화 연구 자료다 — 스파르츄·핀스타·라르베아는 7레벨, 그 다음 단계는 12레벨에 진화한다고 적혀 있다.",
    ], [], { transparent: true }, { type: "fixed", speed: 3, frequency: 3 }),
    talker("ev_pkmn_lab_intern", 12, 6, "연구원", [
      "포획 구슬은 몬스터의 HP가 낮을수록 잘 붙어요. 종마다 포획률도 다르고요.",
      "전설급은 포획률이 아주 낮으니 구슬을 넉넉히 챙기세요.",
    ], [], charsetGraphic(PEOPLE1_CHARSET_ID, 4)),
  );
  return map;
}

// --- 2. 주인공 집 -------------------------------------------------------------

export function createHomeInteriorMap(townMapId: string, backX: number, backY: number): GameMap {
  const map = createInteriorShell({ id: HOME_MAP_ID, name: "우리 집", width: 11, height: 9, floor: T.FLOOR, doorX: 5 });

  putRug(map, 4, 4);

  // 침대(세로) + 거울.
  put(map, 1, 2, T.BED_HEAD);
  put(map, 1, 3, T.BED_FOOT);
  put(map, 3, 2, T.MIRROR_T);
  put(map, 3, 3, T.MIRROR_B);

  // 식탁 + 의자 한 쌍.
  put(map, 7, 3, T.SQUARE_TABLE);
  put(map, 6, 3, T.CHAIR_RIGHT);
  put(map, 8, 3, T.CHAIR_LEFT);

  // 살림살이.
  put(map, 9, 2, T.KETTLE);
  put(map, 2, 6, T.CRATE);

  map.events.push(
    exitEvent("ev_pkmn_home_exit", 5, 8, townMapId, backX, backY),
    talker("ev_pkmn_home_mom", 7, 5, "엄마", [
      "다녀왔니? 몬스터들이 지쳐 보이는구나 — 좀 쉬게 해주자.",
      "언제든 들러렴. 밥은 늘 차려둘 테니.",
    ], [{ kind: "recoverAll" }], charsetGraphic(PEOPLE1_CHARSET_ID, 2)),
    // 침대에서 자면 전회복 — 포켓몬풍 관례.
    event("ev_pkmn_home_bed", 1, 3, [
      page("ev_pkmn_home_bed_page", "침대", [
        { kind: "text", body: "포근한 침대다. 한숨 자고 갈까?" },
        {
          kind: "choices",
          prompt: "쉬어 갈까요?",
          options: [
            { text: "잔다", branch: [{ kind: "recoverAll" }, { kind: "text", body: "푹 자고 일어났다. 몬스터들도 기운을 되찾았다!" }] },
            { text: "그만둔다", branch: [] },
          ],
          // 취소 = 2번 선택지("그만둔다")로 흘려보낸다.
          cancelBehavior: "choice2",
        },
      ], { transparent: true }, { type: "fixed", speed: 3, frequency: 3 }),
    ]),
  );
  return map;
}

// --- 3. 몬스터 회복 센터 ------------------------------------------------------

export function createCenterInteriorMap(townMapId: string, backX: number, backY: number): GameMap {
  const map = createInteriorShell({ id: CENTER_MAP_ID, name: "몬스터 회복 센터", width: 13, height: 10, floor: T.FLOOR_STONE, doorX: 6 });

  // 접수 카운터(북벽 앞 가로 런).
  putRow(map, 4, 3, [T.COUNTER_L, T.COUNTER_M, T.COUNTER_M, T.COUNTER_M, T.COUNTER_R]);
  put(map, 2, 2, T.BOOK_TL);
  put(map, 2, 3, T.BOOK_BL);
  put(map, 10, 2, T.DISPLAY_T);
  put(map, 10, 3, T.DISPLAY_B);

  // 대기 구역 — 긴 탁자와 의자. 출입 동선(x=6)을 비우려 왼쪽으로 한 칸 당겼다.
  putRow(map, 2, 7, [T.TABLE_L, T.TABLE_M, T.TABLE_R]);
  put(map, 1, 7, T.CHAIR_RIGHT);
  put(map, 5, 7, T.CHAIR_LEFT);
  put(map, 10, 6, T.BARREL);

  map.events.push(
    exitEvent("ev_pkmn_center_exit", 6, 9, townMapId, backX, backY),
    talker("ev_pkmn_center_nurse", 6, 2, "접수원", [
      "몬스터 회복 센터에 오신 걸 환영합니다.",
      "파티 몬스터를 전부 회복시켜 드릴게요. 잠시만요…",
      "다 됐습니다. 좋은 여행 되세요!",
    ], [{ kind: "recoverAll" }], charsetGraphic(PEOPLE1_CHARSET_ID, 3), { type: "fixed", speed: 3, frequency: 3 }),
    talker("ev_pkmn_center_visitor", 3, 8, "대기 중인 트레이너", [
      "1번 길 남쪽 끝에서 엄청난 열기가 느껴진대. 전설급이 나온다는 소문이야.",
      "덤비기 전에 여기서 꼭 회복하고 가.",
    ], [], charsetGraphic(PEOPLE1_CHARSET_ID, 5)),
  );
  return map;
}

/** 마을 맵에 놓을 건물 입구 이벤트 3종(문 앞 칸을 밟으면 실내로 전이). */
export function createTownDoorEvents(entries: {
  readonly lab: { x: number; y: number };
  readonly home: { x: number; y: number };
  readonly center: { x: number; y: number };
}): readonly GameEvent[] {
  return [
    transferEvent("ev_pkmn_door_lab", entries.lab.x, entries.lab.y, LAB_MAP_ID, 7, 10, "연구소로"),
    transferEvent("ev_pkmn_door_home", entries.home.x, entries.home.y, HOME_MAP_ID, 5, 7, "우리 집으로"),
    transferEvent("ev_pkmn_door_center", entries.center.x, entries.center.y, CENTER_MAP_ID, 6, 8, "회복 센터로"),
  ];
}

/** 문 앞 안내 표지 — 어느 건물인지 밖에서 알 수 있게. */
export function createTownDoorSigns(entries: {
  readonly lab: { x: number; y: number };
  readonly home: { x: number; y: number };
  readonly center: { x: number; y: number };
}): readonly GameEvent[] {
  const sign = (id: string, x: number, y: number, lines: readonly string[]): GameEvent =>
    talker(id, x, y, "안내판", lines, [] as readonly Command[], { transparent: true }, { type: "fixed", speed: 3, frequency: 3 });
  return [
    sign("ev_pkmn_sign_lab", entries.lab.x + 1, entries.lab.y, ["몬스터 연구소 — 스타터 지급 및 도감 관리."]),
    sign("ev_pkmn_sign_home", entries.home.x - 1, entries.home.y, ["우리 집 — 침대에서 쉬면 몬스터가 회복된다."]),
    sign("ev_pkmn_sign_center", entries.center.x + 1, entries.center.y, ["몬스터 회복 센터 — 접수원이 파티를 무료로 회복해 준다."]),
  ];
}

// ---------------------------------------------------------------------------
// 기존 프로젝트 업그레이드
// ---------------------------------------------------------------------------
// 맵은 코드가 아니라 DB(rpg_zzu.maps)에 산다. createScarloxyPokemonDemoProject()
// 는 **새로 만들 때만** 실행되므로, 이미 DB에 저장된 포켓몬풍 데모(마을+1번 길
// 2장)는 코드를 고쳐도 실내가 생기지 않는다. store.normalizeCurrentProject()
// 가 로드 직후 돌리는 ensure* 계열과 같은 방식으로 결손을 메운다.

/** 이 프로젝트가 Scarloxy 포켓몬풍 데모인가 — 제목 대신 구조로 판별한다(제목은 사용자가 바꿀 수 있다). */
function isScarloxyPokemonDemo(project: {
  readonly maps: Record<string, GameMap>;
  readonly system?: { readonly monsterCollection?: boolean };
}): boolean {
  const town = project.maps[SCARLOXY_TOWN_MAP_ID];
  if (!town) return false;
  // 마을 맵이 존재하고 스타터 지급 이벤트가 살아 있으면 이 데모로 본다.
  return town.events.some((event) => event.id === "ev_pkmn_professor");
}

export const SCARLOXY_TOWN_MAP_ID = "map_pkmn_town";

/** 마을 건물 문 앞 칸 — scarloxyPokemonDemoGame.ts 의 TOWN_DOORS 와 같은 값이어야 한다. */
const TOWN_DOOR_CELLS = {
  lab: { x: 12, y: 7 },
  home: { x: 3, y: 8 },
  center: { x: 20, y: 8 },
} as const;

/**
 * 이미 저장된 포켓몬풍 데모에 실내 맵 3종과 출입 동선을 채워 넣는다.
 * 이미 다 있으면 아무것도 하지 않고 false 를 돌려준다(멱등).
 *
 * 사용자가 일부러 지운 실내를 되살리지 않도록, **셋 다 없을 때만** 일괄 추가한다.
 */
export function ensureScarloxyPokemonInteriors(project: {
  maps: Record<string, GameMap>;
  readonly system?: { readonly monsterCollection?: boolean };
}): boolean {
  if (!isScarloxyPokemonDemo(project)) return false;
  const present = [LAB_MAP_ID, HOME_MAP_ID, CENTER_MAP_ID].filter((id) => project.maps[id]);
  if (present.length > 0) return false; // 하나라도 있으면 사용자 편집으로 보고 손대지 않는다.

  project.maps[LAB_MAP_ID] = createLabInteriorMap(SCARLOXY_TOWN_MAP_ID, TOWN_DOOR_CELLS.lab.x, TOWN_DOOR_CELLS.lab.y + 1);
  project.maps[HOME_MAP_ID] = createHomeInteriorMap(SCARLOXY_TOWN_MAP_ID, TOWN_DOOR_CELLS.home.x, TOWN_DOOR_CELLS.home.y + 1);
  project.maps[CENTER_MAP_ID] = createCenterInteriorMap(SCARLOXY_TOWN_MAP_ID, TOWN_DOOR_CELLS.center.x, TOWN_DOOR_CELLS.center.y + 1);

  // 마을 쪽 출입구/안내판 — 같은 id 가 이미 있으면 건너뛴다.
  const town = project.maps[SCARLOXY_TOWN_MAP_ID]!;
  const existingIds = new Set(town.events.map((event) => event.id));
  for (const event of [...createTownDoorEvents(TOWN_DOOR_CELLS), ...createTownDoorSigns(TOWN_DOOR_CELLS)]) {
    if (existingIds.has(event.id)) continue;
    town.events.push(event);
  }
  // mapTree 편입은 store 의 repairMapTreeOrphans 가 맡는다(고아 맵을 루트에 붙인다).
  return true;
}
