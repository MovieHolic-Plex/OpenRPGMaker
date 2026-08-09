// skyStairMaps.ts — 《천공의 계단》 7개 층의 지형·NPC·퀘스트.
//
// 층마다 눈으로 구분되는 정체성을 준다(skyStairGame.ts 머리말의 다섯 항목).
// 여기서는 그중 ①지형 팔레트 ②defaultLighting ③날씨 ④battleBackground ⑤bgm 을 실제로 붙인다.
//
// NPC 30명 배치: 항구 12 · 밀밭 6 · 안개 숲 4 · 호수 신전 4 · 폐광 2 · 설산 2 = 30.
// (천공 제단은 사람이 없는 곳이다 — 마지막 층에 NPC 를 두지 않는 것도 연출이다.)
import { npcFaceGraphicFromEventGraphic } from "@/assets/charsetFaceMap";
import { queryNpcGraphics } from "@/assets/charsetQuery";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { stampRectHouseKit, type HouseKitId } from "@/editor/houseKit";
import type { Command, EventPage, GameEvent, GameMap, LightingState, Project, TilesetDef } from "@/project/types";
import { canMove, isPassable } from "@/project/collision";
import { FARMLAND_TILE } from "@/project/defaults/chipsetMapping";
import { DEFAULT_TILE_SIZE, DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { defaultTilesets } from "@/project/defaults/defaultAssets";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { paintSnowGateTerrain } from "@/project/defaults/snowGateTerrain";
import {
  SKY_BATTLE_BG,
  SKY_BGM,
  SKY_ITEM,
  SKY_MAP,
  SKY_SWITCH,
  SKY_TITLE,
  SKY_TROOP,
  SKY_VARIABLE,
} from "./skyStairGame";

// ── 페이지 순서 규약(꼭 지킬 것) ─────────────────────────────────────────────
// RM2003 페이지 해석은 **뒤에서부터 훑어 마지막으로 조건을 만족한 페이지가 이긴다**
// (pageResolution.ts). 따라서 페이지는 **일반적인 것 → 구체적인 것** 순서로 써야 한다.
// 처음에 반대로(구체적 → 일반적) 썼다가, 조건 없는 페이지가 늘 이겨서
// **스위치로 잠근 이동문 전부가 영구히 막혔다**(2026-07-27 완주 검증에서 잡음).
// 타입 검사도 projectLint 도 이걸 못 잡는다 — 완주 시나리오만 잡는다.
const PASSIVE = { type: "fixed", speed: 3, frequency: 3 } as const satisfies EventPage["movement"];
const WANDER = { type: "random", speed: 2, frequency: 3 } as const satisfies EventPage["movement"];

/**
 * **투명 그래픽. 화면에 아무것도 그리지 않는다.**
 *
 * 이 층들에는 그래픽이 전부 투명한 이벤트가 23개 있고, 그중 **19개는 투명이 맞다** —
 * 아래 세 부류다. 나머지 4개(목도리 단서 3 + 미믹 상자)는 원래 안 보이는 게 결함이었고
 * 이제 실제 그림을 준다.
 *
 *   ① 층 사이 이동문 15개(`gate`) — 길 위의 판정 칸이다. 문의 그림은 지형(성문·계단·
 *      암벽 틈)이 이미 그리고 있고, 여기에 캐릭터 스프라이트를 놓으면 길 가운데
 *      사람이나 상자가 서 있는 것으로 보인다. RM2003 의 이동문도 같은 이유로 투명이다.
 *   ② 진입 자동 이벤트 4개(`autoEvent`) — 안개·눈·날씨 해제를 걸는 트리거다.
 *      "보이는 것"이 아니라 "들어선 순간 일어나는 일"이므로 그릴 대상이 없다.
 *   ③ 등대 이벤트(`ev_sky_h_lighthouse`) — 등대 탑 자체는 타일(28..29, 2..9 의 TILE.WALL)이
 *      그린다. 이 이벤트는 탑 앞 문간의 조작 지점이라, 여기에 스프라이트를 두면
 *      탑 문 앞에 정체불명의 물건이 놓인다.
 *
 * 그 밖에 **다단 이벤트의 특정 페이지만** 투명한 경우가 있고, 이것도 의도다:
 *   · 봉인방 `_cleared` — 봉인석을 플레이어가 가져갔으니 자리가 비는 게 맞다.
 *   · 미믹 `_done`, 파수꾼 `_cleared`, 제단 `_done` — 쓰러뜨린 뒤 사라진 자리.
 *   · 잃은 아이 `ch_hidden` — 안개에 가려 아직 안 보인다는 것이 그 페이지의 내용이다.
 *   · 목도리 단서 `_idle`/`_found` — 퀘스트 전에는 볼 것이 없고, 챈 뒤에는 실이 사라진다.
 */
const NO_GRAPHIC = { transparent: true } as const satisfies EventPage["graphic"];

/** 통행 가능한 지면만 쓴다 — TILE.FLOOR(342)/STAIRS(246)는 통행 불가라 바닥으로 못 쓴다. */
const GROUND = {
  PLAZA: TILE.SAND,
  GRAVEL: 421,
} as const;

/**
 * 침엽수는 **세로 2칸이 한 원자**다 — 상단 260 이 하단 290 바로 위에 와야 한다
 * (combinedTownGroups 의 conifer-tree adjacency 규칙). 하단만 놓으면 화면에는
 * **줄기만 있는 나무**가 그려지고 projectLint 가 error 를 낸다(2026-07-27 실측 24건).
 * 그래서 나무는 반드시 이 헬퍼로 심는다.
 */
const CONIFER_TOP = 260;

/** 활엽수는 **2×2 원자**다(262·263 / 292·293). 한 조각만 놓으면 조각난 나무가 되고 lint 가 잡는다. */
const BROADLEAF = { topLeft: 262, topRight: 263, bottomLeft: 292, bottomRight: 293 } as const;
/** 덤불(단독 배치 가능). 통행 불가·상위 레이어. */
const BUSH_TILE = 289;

/**
 * 키큰 풀 11종(하네스 그룹 `키큰 풀`). **투명 픽셀 0/256 의 진짜 지면**이라 하위 레이어에 깔아도
 * 구멍이 없다. 예전에는 하층식생으로 타일 70(3×3 블록 몸통)을 썼는데 최빈색이 rgb(13,17,0) —
 * 휘도 15 의 사실상 검정이라 숲 바닥에 검은 사각형이 생겼다(실측 78칸).
 * 잔디 240 과 같은 초록 계열이므로 색이 아니라 **질감**이 늘어난다 — 과장하지 않는다.
 */
const TALL_GRASS = [303, 304, 305, 333, 334, 335, 243, 244, 245, 273, 275] as const;


/**
 * 던전 칩셋(easyrpg_chipset_dungeon) 전용 타일. **combined_town 과 같은 숫자가 전혀 다른 그림**이므로
 * 폐광 안에서는 이 상수만 쓴다. 값은 dungeonTerrainAutotiles.ts 의 블록 몸통 좌표에서 왔다.
 */
const DUNGEON_TILESET_ID = "easyrpg_chipset_dungeon";
const DUNGEON = {
  /** 붉은 카펫(금장 테두리) — 신전 참배로. 통행 가능. */
  CARPET: 169,
  /** 갈색 단상 — 신전 제단 바닥. 통행 가능. */
  DAIS: 166,
  /** 녹회색 암반 단상 — 천공 제단 부유 통로. 통행 가능. */
  PLATFORM: 436,
  /** 심연(푸른 테두리) — 천공 제단 바깥 허공. 통행 불가. */
  ABYSS: 397,
  /** 어둠(금장 테두리) — 제단 안쪽 성역 경계. 통행 불가. */
  PIT_GOLD: 310,
  /** 갈색 암벽. 통행 불가. */
  WALL: 226,
  /** 깊은 물 — 신전을 둘러싼 호수. 통행 불가.
   *  처음에 372(검푸른 급류)를 썼는데 화면에서 물이 아니라 **파란 수정 블록**으로 보였다 —
   *  칩셋 타일을 눈으로 확인하지 않고 그룹 이름("검푸른 급류")만 믿은 결과다. */
  DEEP: 121,
  /** 눈밭. 통행 가능. */
  SNOW: 67,
  /** 얼음판 — 눈 위 결빙. 통행 가능. */
  ICE: 70,
  /** 정본 대각 빙벽(좌/우 열) + 얼음 벽 조각. 통행 불가. */
  ICE_CLIFF_L: 286,
  ICE_CLIFF_R: 287,
  ICE_WALL: 285,
  /** 청록 가로 계단. 통행 가능. */
  STAIRS: 49,
  /** 나무 판자 다리. 통행 가능. */
  PLANK: 142,
  /** 미굴착 암반(심연/천장, 회암 테두리) — 방 바깥을 채워 파낸 벽면 경계를 그린다. 통행 불가. */
  UNDUG: 430,
  /** 회록 석재 바닥 — 채굴실. 통행 가능. */
  STONE: 187,
  /** 갈색 흙바닥 — 갱도 통로. 통행 가능. */
  DIRT: 421,
  /** 이끼 수풀 — 물이 스미는 자리. 통행 가능. */
  MOSS: 424,
  /** 석재 균열 구덩이. 통행 불가. */
  CHASM: 190,
  /** 용암. 통행 불가. */
  LAVA: 304,
} as const;

/**
 * 집은 **집 킷으로 전개한다** — 손으로 찍은 5×5 타일 패치를 쓰지 않는다.
 *
 * 처음엔 잿불의 유산의 5×5 HOUSE_PATTERN 을 그대로 베껴 썼는데, 그건 그냥 납작한
 * 텍스처 조각이라 (a) 지붕 상위 레이어 투명 캡(뒤로 잔디가 비치는 모서리)이 없고
 * (b) 창문이 없고 (c) 층수·지붕 높이를 못 바꾸고 (d) 문 위치도 안 나온다.
 * `stampRectHouseKit` 은 이 넷을 전부 해 주며 에디터 상태 의존이 없어
 * defaults 레이어에서 바로 부를 수 있다(같은 폴더의 dbExtractedHouseTemplate.ts 가 선례).
 *
 * 킷을 섞어 쓰는 것도 비주얼 결정이다 — 한 마을의 집이 전부 같은 색이면 배경처럼 보인다.
 */
type HousePlacement = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly stories: 1 | 2 | 3;
  readonly roofBodyRows: number;
  readonly kitId: HouseKitId;
  readonly lowWall?: boolean;
};

/** 나무 문 한 쌍(위/아래) — combined_town 의 woodDoorPairObjects. 문 없는 집은 집으로 안 보인다. */
const DOOR_TILE = { top: 116, bottom: 146 } as const;

/** 마을 생활 소품 — village/decor.ts 의 CLUSTER_PROP_TILES 와 같은 타일을 쓴다. */
const PROP = { woodBox: 237, barrel: 177, jar: 352, firewood: 349 } as const;

function buildHouses(map: GameMap, placements: readonly HousePlacement[]): void {
  for (const plan of placements) {
    const result = stampRectHouseKit(map, {
      x: plan.x,
      y: plan.y,
      width: plan.width,
      stories: plan.stories,
      roofBodyRows: plan.roofBodyRows,
      kitId: plan.kitId,
      lowWall: plan.lowWall,
      windows: { spacing: 2 },
    });
    // 조용히 실패하면 그 자리는 그냥 잔디로 남는다 — 그게 정확히 "저작했는데 화면에 없음"이다.
    if (!result.ok) throw new Error(`집 배치 실패 (${map.name} ${plan.x},${plan.y}): ${result.reason}`);
    // 킷이 알려 준 자리에 문을 박는다. 문이 없으면 평가기가 집으로 세지도 않고
    // (houseRegions=0 / doorPairs=0), 무엇보다 화면에서 벽만 있는 상자로 보인다.
    if (result.doorAt) {
      setLower(map, result.doorAt.x, result.doorAt.y - 1, DOOR_TILE.top);
      setLower(map, result.doorAt.x, result.doorAt.y, DOOR_TILE.bottom);
    }
  }
}

/**
 * 소품을 **무리로** 흩뿌린다 — village/decor.ts 의 규칙 그대로("소품은 점이 아니라 무리").
 * 상위 레이어에만 놓고 이미 뭔가 있는 칸은 건드리지 않으므로 지형·집을 망치지 않는다.
 */
function scatterProps(
  map: GameMap,
  spots: readonly (readonly [number, number, number])[],
): void {
  for (const [x, y, tile] of spots) {
    if (x < 1 || y < 1 || x >= map.width - 1 || y >= map.height - 1) continue;
    if (map.upperTiles[y * map.width + x] !== TILE.EMPTY) continue;
    // 통행 가능한 바닥 위에만 — 벽·물 위에 통이 뜨면 더 이상해 보인다.
    const ground = map.lowerTiles[y * map.width + x];
    if (ground !== TILE.GRASS && ground !== TILE.PATH && ground !== GROUND.PLAZA && ground !== GROUND.GRAVEL) continue;
    map.upperTiles[y * map.width + x] = tile;
  }
}

type Point = { readonly x: number; readonly y: number };

/**
 * 결정론적 의사난수. `Math.random` 을 쓰면 빌드마다 맵이 바뀌어 스냅샷·E2E 비교가 불가능해진다.
 * 시드는 호출부가 층마다 다르게 넘긴다.
 */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

/**
 * 값 노이즈 — 나무를 **덩어리와 빈터**로 뭉치게 한다. 균일 확률로 뿌리면 밀도가 아무리 높아도
 * 고르게 퍼져서 과수원으로 읽힌다(실측: 격자 배치 52% 점유가 여전히 과수원이었다).
 */
function valueNoise(rand: () => number, scaleX: number, scaleY: number): (x: number, y: number) => number {
  const table = Array.from({ length: 64 }, () => rand());
  const at = (a: number, b: number): number => table[(((a * 7 + b * 13) % 64) + 64) % 64]!;
  const smooth = (t: number): number => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x / scaleX;
    const fy = y / scaleY;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const u = smooth(fx - ix);
    const v = smooth(fy - iy);
    return at(ix, iy) * (1 - u) * (1 - v) + at(ix + 1, iy) * u * (1 - v)
      + at(ix, iy + 1) * (1 - u) * v + at(ix + 1, iy + 1) * u * v;
  };
}

/** 지면에 키큰 풀을 노이즈 밀도로 섞는다. 나무를 심기 **전에** 부른다. */
function scatterUndergrowth(map: GameMap, seed: number, density: number): void {
  const rand = seededRandom(seed);
  const field = valueNoise(rand, 5.5, 4.5);
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (tileAt(map, x, y) !== TILE.GRASS) continue;
      if (field(x, y) <= 0.42) continue;
      if (rand() <= density) continue;
      setLower(map, x, y, TALL_GRASS[Math.floor(rand() * TALL_GRASS.length)]!);
    }
  }
}

type ForestOptions = {
  readonly seed: number;
  /** 원자를 던지는 시도 횟수. 겹침을 허용하므로 칸 수보다 크게 잡는다. */
  /** ① 대각 사슬의 출발점이 될 활엽수 씨앗 시도 횟수. */
  readonly seeds: number;
  /** ③ 사슬을 뻗은 뒤 남은 틈을 침엽수로 메우는 시도 횟수. */
  readonly attempts: number;
  /** 노이즈 임계값 — 낮추면 빈터가 줄고 숲이 두꺼워진다. */
  readonly threshold: number;
  /** 활엽수 비중(나머지는 침엽수, 일부 마른나무). */
  readonly broadShare: number;
  /** 맵 테두리에 세우는 나무 수 — "숲 안에 있다"는 인상을 만든다. */
  readonly wall: number;
  readonly bushes: number;
  /** 대각 겹침 사슬을 뻗을 라운드 수. 라운드마다 사슬이 한 칸 더 자란다. */
  readonly diagonalRounds: number;
  /** 각 앵커가 라운드마다 대각으로 뻗을 확률. 1 이면 전부 뻗어 대각선이 규칙적으로 보인다. */
  readonly diagonalChance: number;
};

/**
 * 나무를 덩어리로 뿌린다. 원자를 지터를 줘 던지고 겹침을 허용하므로 수관이 맞물린다.
 * 길·물 근처는 비운다 — 길이 보이지 않으면 숲이 아니라 벽이다.
 */
function scatterForest(map: GameMap, options: ForestOptions): void {
  const rand = seededRandom(options.seed);
  const field = valueNoise(rand, 5.5, 4.5);
  // 길·물 침범 방어는 canPlaceAtom 이 이미 한다(NATURAL_FLOOR 아닌 칸을 거부).
  // 예전에는 여기에 3×4 여유 검사를 한 겹 더 뒀는데, 그게 길 양옆에 **맨 잔디 띠**를 만들어
  // 숲이 길에서 물러나 보였다. 나무가 길가에 바로 붙는 게 숲답다.
  // 원자는 전부-또는-전무라 실패가 흔하다. 활엽수가 안 들어가면 침엽수로 한 번 더 시도해
  // 빈틈을 메운다 — 이게 인접 밀집을 만드는 실질적인 수단이다.
  // 대각 겹침으로 심은 원자의 좌상단 좌표. 여기서 다시 (+1,+1) 로 이어 붙여 **사슬**을 만든다.
  const anchors: { x: number; y: number }[] = [];
  const plant = (x: number, y: number): void => {
    const roll = rand();
    if (roll < options.broadShare) {
      if (broadleaf(map, x, y)) { anchors.push({ x, y }); return; }
    } else if (roll < options.broadShare + 0.05) {
      if (dryTree(map, x, y)) return;
    }
    tree(map, x, y);
  };
  /** 이미 놓인 활엽수에서 대각으로 사슬을 뻗는다 — 수관이 이어져 덩어리가 된다. */
  const growDiagonals = (rounds: number): number => {
    let grown = 0;
    for (let round = 0; round < rounds; round += 1) {
      const seeds = [...anchors];
      for (const seed of seeds) {
        if (rand() > options.diagonalChance) continue;
        if (!broadleafDiagonal(map, seed.x, seed.y)) continue;
        anchors.push({ x: seed.x + 1, y: seed.y + 1 });
        grown += 1;
      }
    }
    return grown;
  };
  // ── 순서가 결과를 바꾼다 ────────────────────────────────────────────────
  // 처음엔 침엽수까지 다 채운 **뒤에** 대각 사슬을 뻗었는데, 그때는 이미 60% 가 차 있어
  // 사슬이 뻗을 빈칸이 없었다(실측: 대각 성장 거의 0). 그래서 세 단계로 나눈다.
  //   ① 활엽수 씨앗만 성기게 뿌린다 → ② 대각 사슬을 뻗어 수관을 잇는다 → ③ 남은 틈을 침엽수로 메운다
  const edgeSpot = (): { x: number; y: number } => {
    const edge = Math.floor(rand() * 4);
    return {
      x: edge === 2 ? Math.floor(rand() * 2)
        : edge === 3 ? map.width - 2 - Math.floor(rand() * 2)
        : Math.floor(rand() * map.width),
      y: edge === 0 ? 1 + Math.floor(rand() * 2)
        : edge === 1 ? map.height - 1 - Math.floor(rand() * 2)
        : 1 + Math.floor(rand() * (map.height - 1)),
    };
  };
  // ① 활엽수 씨앗 — 테두리 먼저, 그다음 밀도장 안쪽
  for (let i = 0; i < options.wall; i += 1) {
    const spot = edgeSpot();
    if (broadleaf(map, spot.x, spot.y)) anchors.push(spot);
  }
  for (let i = 0; i < options.seeds; i += 1) {
    const x = Math.floor(rand() * map.width);
    const y = 1 + Math.floor(rand() * (map.height - 1));
    if (field(x, y) < options.threshold) continue;
    if (broadleaf(map, x, y)) anchors.push({ x, y });
  }
  // ② 대각 사슬
  growDiagonals(options.diagonalRounds);
  // ③ 남은 틈을 침엽수·마른나무로 — 여기서 밀도가 완성된다
  for (let i = 0; i < options.attempts; i += 1) {
    const x = Math.floor(rand() * map.width);
    const y = 1 + Math.floor(rand() * (map.height - 1));
    if (field(x, y) < options.threshold) continue;
    plant(x, y);
  }
  for (let i = 0; i < Math.floor(options.wall / 2); i += 1) {
    const spot = edgeSpot();
    plant(spot.x, spot.y);
  }
  // 덤불은 1칸 원자 — 상위가 빈 칸에만
  for (let i = 0; i < options.bushes; i += 1) {
    const x = Math.floor(rand() * map.width);
    const y = Math.floor(rand() * map.height);
    writeAtom(map, [[x, y, BUSH_TILE]]);
  }
}

/**
 * 밀집 배치는 필연적으로 **갇힌 주머니**를 만든다. 밑동이 통행 불가라서다.
 * anchor 에서 BFS 해서 닿지 않는 통행 가능 영역을 찾고, 그 경계의 밑동을 지워 이어 붙인다.
 * 이 패스가 없으면 reachability 테스트가 깨지고 NPC 가 도달 불가가 된다(실측: 폐광 39칸).
 *
 * `keepClear` 좌표(이벤트 자리)는 먼저 비운다 — NPC 가 줄기 안에 서 있으면 안 된다.
 */
function connectForest(
  map: GameMap,
  tileset: TilesetDef,
  anchor: Point,
  keepClear: readonly Point[],
): number {
  const project = { tilesets: { [map.tilesetId]: tileset } } as unknown as Project;
  for (const p of keepClear) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const x = p.x + dx;
        const y = p.y + dy;
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
        const upper = map.upperTiles[y * map.width + x] ?? TILE.EMPTY;
        if (upper !== TILE.EMPTY && !CANOPY_TILES.has(upper)) clearAtomAt(map, x, y);
      }
    }
  }
  const key = (x: number, y: number): number => y * map.width + x;
  const walkable = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < map.width && y < map.height && isPassable(project, map, x, y);
  const flood = (sx: number, sy: number, seen: Set<number>): number[] => {
    const cells: number[] = [];
    if (!walkable(sx, sy) || seen.has(key(sx, sy))) return cells;
    const queue: Point[] = [{ x: sx, y: sy }];
    seen.add(key(sx, sy));
    while (queue.length > 0) {
      const cur = queue.shift()!;
      cells.push(key(cur.x, cur.y));
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        if (!walkable(nx, ny) || seen.has(key(nx, ny))) continue;
        if (!canMove(project, map, cur.x, cur.y, nx, ny)) continue;
        seen.add(key(nx, ny));
        queue.push({ x: nx, y: ny });
      }
    }
    return cells;
  };
  let opened = 0;
  for (let pass = 0; pass < 12; pass += 1) {
    const seen = new Set<number>();
    const main = new Set(flood(anchor.x, anchor.y, seen));
    let repaired = false;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        if (!walkable(x, y) || main.has(key(x, y)) || seen.has(key(x, y))) continue;
        const island = flood(x, y, seen);
        if (island.length < 3) continue; // 1~2칸은 수관 아래 틈 — 의도된 시각 효과
        // 이 섬에서 본토로 통하는 막힌 칸을 지운다. **제거 비용이 싼 것부터** 고른다 —
        // 대각 사슬은 사슬째 지워야 하므로(clearAtomAt) 사슬을 고르면 숲에 큰 구멍이 난다.
        // 침엽수(2칸)가 있으면 그걸 먼저 걷어 낸다.
        let best: { x: number; y: number; d: number; cost: number } | null = null;
        for (const cell of island) {
          const cx = cell % map.width;
          const cy = Math.floor(cell / map.width);
          for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
            const upper = map.upperTiles[ny * map.width + nx] ?? TILE.EMPTY;
            if (upper === TILE.EMPTY || CANOPY_TILES.has(upper)) continue;
            const d = Math.abs(nx - anchor.x) + Math.abs(ny - anchor.y);
            const cost = removalCost(map, nx, ny);
            if (!best || cost < best.cost || (cost === best.cost && d < best.d)) {
              best = { x: nx, y: ny, d, cost };
            }
          }
        }
        if (!best) continue;
        clearAtomAt(map, best.x, best.y); // 원자(사슬이면 사슬째) — 조각만 지우면 lint 위반이 된다
        opened += 1;
        repaired = true;
      }
    }
    if (!repaired) break;
  }
  return opened;
}

export function skyStairMaps(): GameMap[] {
  return [harborMap(), wheatMap(), mistwoodMap(), shrineMap(), mineMap(), snowgateMap(), altarMap()];
}

// ══════════ 1층 · 항구 아셀 — 새벽빛, 사람이 가장 많은 층 ══════════
function harborMap(): GameMap {
  const map = makeMap(SKY_MAP.harbor, "항구 아셀", 32, 24);
  dress(map, {
    bgm: SKY_BGM.harbor,
    battleBackground: SKY_BATTLE_BG.harbor,
    // 새벽 항구 — 옅은 푸른 기만 남긴다. ambient 는 "밝기"가 아니라 **덮개의 불투명도**다.
    lighting: { ambient: 0.16, color: "#2a4a7a", sources: [] },
  });

  // 바다는 남쪽 전체. 부두가 바다로 뻗는다 — 항구라는 걸 한눈에 알리는 실루엣.
  rect(map, { x: 0, y: 19 }, { x: 31, y: 23 }, TILE.WATER);
  rect(map, { x: 14, y: 19 }, { x: 16, y: 22 }, GROUND.PLAZA);
  // 대로 — **꺾어서** 깐다. 30칸 직선은 사람이 만든 게 아니라 자로 그은 것처럼 보인다
  // (평가기 지적: longestStraightRoadRun=30). 광장을 피해 두 번 어긋나게 한다.
  rect(map, { x: 1, y: 17 }, { x: 9, y: 18 }, TILE.PATH);
  rect(map, { x: 9, y: 15 }, { x: 10, y: 18 }, TILE.PATH);
  rect(map, { x: 9, y: 15 }, { x: 21, y: 16 }, TILE.PATH);
  rect(map, { x: 20, y: 15 }, { x: 21, y: 18 }, TILE.PATH);
  rect(map, { x: 20, y: 17 }, { x: 30, y: 18 }, TILE.PATH);
  // 남북 골목도 한 번 어긋난다.
  rect(map, { x: 14, y: 10 }, { x: 15, y: 16 }, TILE.PATH);
  rect(map, { x: 15, y: 4 }, { x: 16, y: 11 }, TILE.PATH);
  rect(map, { x: 11, y: 12 }, { x: 20, y: 15 }, GROUND.PLAZA);
  // 집 6채 — 킷을 섞어 크기·층수·지붕 높이를 다르게. 항구는 사람이 가장 많은 층이라
  // 건물 실루엣이 겹치지 않아야 마을처럼 읽힌다.
  buildHouses(map, [
    { x: 2, y: 2, width: 6, stories: 2, roofBodyRows: 2, kitId: "blue-stone" },      // 여관   x2..7  y2..10
    { x: 9, y: 2, width: 5, stories: 1, roofBodyRows: 1, kitId: "bright-plaster" },  // 상점   x9..13 y2..7
    { x: 17, y: 2, width: 4, stories: 1, roofBodyRows: 1, kitId: "amber-wood" },     // 기록관 x17..20 y2..7
    { x: 22, y: 2, width: 6, stories: 2, roofBodyRows: 2, kitId: "timber-hall" },    // 조합   x22..27 y2..10
    { x: 2, y: 11, width: 4, stories: 1, roofBodyRows: 1, kitId: "slate-wood", lowWall: true },   // 어부집 x2..5  y11..15
    { x: 27, y: 11, width: 4, stories: 1, roofBodyRows: 1, kitId: "amber-wood", lowWall: true },  // 창고   x27..30 y11..15
  ]);
  // 등대 — 북동 모서리에 세로로 선 탑. 이 층의 시각적 주인공이다.
  rect(map, { x: 28, y: 2 }, { x: 29, y: 9 }, TILE.WALL);
  setUpper(map, 28, 1, TILE.FLOWERS);
  setUpper(map, 29, 1, TILE.FLOWERS);
  // 나무와 꽃으로 빈 잔디를 채운다.
  for (const p of [{ x: 2, y: 2 }, { x: 7, y: 2 }, { x: 20, y: 2 }, { x: 2, y: 14 }, { x: 8, y: 14 }, { x: 21, y: 10 }]) {
    tree(map, p.x, p.y);
  }
  for (const p of [{ x: 12, y: 11 }, { x: 19, y: 11 }, { x: 12, y: 16 }, { x: 19, y: 16 }, { x: 6, y: 8 }]) {
    setUpper(map, p.x, p.y, TILE.FLOWERS);
  }

  // 생활 소품 — 무리로 놓는다(평가기 지적: propTileKinds=1). 부두엔 통·상자, 집 앞엔 항아리.
  scatterProps(map, [
    [12, 18, PROP.barrel], [13, 18, PROP.barrel], [12, 19, PROP.woodBox],
    [24, 18, PROP.woodBox], [25, 18, PROP.barrel], [25, 19, PROP.jar],
    [9, 12, PROP.jar], [10, 12, PROP.firewood], [21, 12, PROP.barrel],
    [8, 14, PROP.woodBox], [22, 14, PROP.jar], [6, 19, PROP.firewood],
  ]);

  map.events.push(
    // ── Q1 「등대의 불씨」 ────────────────────────────────────────────────
    lightkeeperEvent(),
    oilMerchantEvent(),
    lighthouseEvent(),
    // ── 나머지 항구 주민 9명 ─────────────────────────────────────────────
    villager("ev_sky_h_innkeeper", 6, 12, "여관 주인 소하", "여관 주인", [
      "어서 와. 계단을 오르겠다고? 다들 처음엔 그렇게 말해.",
      "돌아오면 방은 비워 둘게. 이름은 안 물을 테니까 꼭 돌아와.",
    ]),
    villager("ev_sky_h_fisher_a", 6, 18, "늙은 어부 대성", "노학자", [
      "등대가 꺼진 뒤로 밤배가 세 척 사라졌어.",
      "바다가 화난 게 아니야. 길이 없어진 거지.",
    ]),
    villager("ev_sky_h_fisher_b", 22, 18, "어부 잔", "청년 남성", [
      "그물에 자꾸 하얀 깃털이 걸려. 새 것도 아니야, 이건.",
      "위에서 떨어진 거라고 생각해. 계단 위에서.",
    ]),
    villager("ev_sky_h_kid_a", 17, 13, "부두 아이 밤이", "남자아이", [
      "누나! 계단 봤어? 구름 속으로 쭉 올라간대!",
      "나도 크면 오를 거야. 그때까지 등대 켜 놔 줘.",
    ], WANDER),
    villager("ev_sky_h_kid_b", 13, 14, "부두 아이 솔", "여자아이", [
      "밤이는 허풍쟁이야. 계단은 그냥 절벽이라던데.",
      "...근데 어젯밤엔 위에서 종소리가 났어. 진짜야.",
    ], WANDER),
    villager("ev_sky_h_smith", 21, 11, "대장장이 무쇠", "대머리 이국 주민", [
      "무기는 못 만들어 줘. 쇠가 없어. 광산이 닫힌 지 오래야.",
      "폐광까지 올라가면 쇠를 좀 가져와. 그땐 이야기가 다르지.",
    ]),
    villager("ev_sky_h_scribe", 8, 12, "기록관 여울", "집사", [
      "계단을 오른 사람은 기록에 넷뿐이야. 내려온 사람은 하나.",
      "그 하나가 남긴 말은 딱 한 줄이었어 — 「위에는 아무도 없다」.",
    ]),
    villager("ev_sky_h_priest", 18, 9, "순례 사제 담", "승려", [
      "호수 신전의 세 봉인이 풀리지 않으면 계단은 열리지 않아.",
      "먼저 아래를 정리하렴. 밀밭에 사람이 다치고 있다더라.",
    ]),
    villager("ev_sky_h_guard", 15, 3, "문지기 벼리", "청년 병사", [
      "북문은 밀밭으로 이어져. 등대가 켜지면 열어 주지.",
      "규칙이 아니라 안전이야. 어두운 길에 사람을 내보낼 순 없어.",
    ]),
    villager("ev_sky_h_sailor", 28, 17, "선원 파랑", "청년 전사", [
      "배는 안 띄워. 등대 없이는 못 나가.",
      "대신 이거 알려 줄게 — 다수랑 붙을 땐 폭탄이 값을 해.",
    ]),
    // 북문 — 등대를 켜면 열린다.
    gate("ev_sky_h_gate_n", 15, 1, SKY_MAP.wheat, 15, 25, SKY_SWITCH.gateWheat, "등대가 아직 꺼져 있다. 벼리가 길을 막는다."),
    gate("ev_sky_h_gate_n2", 16, 1, SKY_MAP.wheat, 16, 25, SKY_SWITCH.gateWheat, "등대가 아직 꺼져 있다. 벼리가 길을 막는다."),
  );
  return map;
}

/** Q1 발주자 — 등대지기. 진행 단계마다 다른 페이지를 준다. */
function lightkeeperEvent(): GameEvent {
  const graphic = charsetByLabel("대머리 남성 주민");
  return event("ev_sky_h_lightkeeper", 26, 11, [
    page("lk_intro", "등대지기 마루", [], withFace(graphic, [
      say("마루", "등대가 꺼졌다. 기름이 바닥났어."),
      say("마루", "부두 상인 나루가 고래 기름을 갖고 있을 거야. 좀 받아다 줄 수 있겠나?"),
      { kind: "setSwitch", switchId: SKY_SWITCH.q1Started, value: true },
      say(undefined, "【퀘스트】 등대의 불씨 — 부두 상인에게 등대 기름을 받아오자."),
    ]), graphic),
    page("lk_waiting", "등대지기 마루", [switchOn(SKY_SWITCH.q1Started)], withFace(graphic, [
      say("마루", "나루는 부두 남쪽에 있어. 기름값은 내 이름을 대면 된다."),
    ]), graphic),
    page("lk_done", "등대지기 마루", [switchOn(SKY_SWITCH.q1Done)], withFace(graphic, [
      say("마루", "삼십 년 만에 제일 밝다. 고맙다, 정말로."),
      say("마루", "위로 갈 거면 하나만 기억해 — 계단은 오르는 게 아니라 견디는 거야."),
    ]), graphic),
    page("lk_has_oil", "등대지기 마루", [switchOn(SKY_SWITCH.q1Started), itemHeld(SKY_ITEM.lampOil)], withFace(graphic, [
      say("마루", "그거야! 어서 등대 위로. 심지에 부어라."),
      say(undefined, "등대 문이 열렸다."),
    ]), graphic),
  ]);
}

function oilMerchantEvent(): GameEvent {
  const graphic = charsetByLabel("중절모 신사");
  return event("ev_sky_h_oil", 15, 18, [
    page("oil_idle", "부두 상인 나루", [], withFace(graphic, [
      say("나루", "고래 기름? 있지. 근데 아무한테나 안 팔아."),
      say("나루", "등대지기 마루가 보냈다면 얘기가 다르지만."),
    ]), graphic),
    page("oil_give", "부두 상인 나루", [switchOn(SKY_SWITCH.q1Started)], withFace(graphic, [
      say("나루", "마루가 보냈구나. 기다렸지."),
      { kind: "changeItem", itemId: SKY_ITEM.lampOil, op: "+=", amount: 1 },
      say(undefined, "등대 기름을 받았다."),
      say("나루", "값은 등대 불로 받을게. 그거면 충분해."),
    ]), graphic),
  ]);
}

function lighthouseEvent(): GameEvent {
  return event("ev_sky_h_lighthouse", 28, 10, [
    page("lh_dark", "등대", [], [
      say(undefined, "등대는 차갑게 식어 있다. 기름이 없다."),
    ], NO_GRAPHIC, PASSIVE, "below"),
    page("lh_lit", "등대", [switchOn(SKY_SWITCH.q1Done)], [
      say(undefined, "등대가 환하게 돌고 있다. 바다 끝까지 빛이 닿는다."),
    ], NO_GRAPHIC, PASSIVE, "below"),
    page("lh_light", "등대", [itemHeld(SKY_ITEM.lampOil)], [
      say(undefined, "심지에 기름을 붓는다. 잠깐의 정적."),
      { kind: "changeItem", itemId: SKY_ITEM.lampOil, op: "-=", amount: 1 },
      { kind: "setSwitch", switchId: SKY_SWITCH.q1Done, value: true },
      { kind: "setSwitch", switchId: SKY_SWITCH.gateWheat, value: true },
      // 등대가 켜지는 순간 항구 음악을 다시 걸어 준다 — 화면과 소리가 같이 바뀌어야 사건이 된다.
      { kind: "playAudio", resourceId: "cc0-bgm-town", loop: true },
      say(undefined, "불이 붙었다. 항구 전체가 주황색으로 물든다."),
      say(undefined, "【완료】 등대의 불씨 — 북문이 열렸다."),
      { kind: "changeItem", itemId: SKY_ITEM.hiPotion, op: "+=", amount: 2 },
      say(undefined, "상급 회복약 2개를 받았다."),
    ], NO_GRAPHIC, PASSIVE, "below"),
  ]);
}

// ══════════ 2층 · 황금 밀밭 — 노을, 첫 전투대 ══════════
function wheatMap(): GameMap {
  const map = makeMap(SKY_MAP.wheat, "황금 밀밭", 32, 28);
  dress(map, {
    bgm: SKY_BGM.wheat,
    battleBackground: SKY_BATTLE_BG.wheat,
    // 해가 낮게 걸린 밀밭 — 따뜻한 주황 덮개를 얇게. 앞 층의 푸른 기와 정반대 색이다.
    lighting: { ambient: 0.2, color: "#c4671b", sources: [] },
    encounterRate: 22,
    troopIds: [SKY_TROOP.fieldPests],
  });

  // 밀밭은 모래(황금색) 띠를 격자로 깐다 — 경작지 무늬가 화면을 채운다.
  rect(map, { x: 0, y: 0 }, { x: 31, y: 27 }, TILE.GRASS);
  // 밭이랑은 **경작지 오토타일(187)**로 깐다. 처음엔 모래로 깔았는데, 모래는 흙길과 함께
  // "도로"로 분류돼(villageEvaluate 의 SAND/DIRT/STONE) 이랑과 길이 한 덩어리로 이어지고
  // 직선 구간이 30칸으로 잡혔다 — 화면에서도 밭이 아니라 포장된 광장으로 보였다.
  // 경작지는 밭고랑 무늬가 있고 도로 집합에 없다. 행마다 시작점을 어긋내 갈아 놓은 티를 낸다.
  for (let y = 3; y <= 24; y += 3) {
    const jog = (y / 3) % 2 === 0 ? 0 : 2;
    rect(map, { x: 2 + jog, y }, { x: 12 + jog, y: y + 1 }, FARMLAND_TILE.BODY);
    rect(map, { x: 18 - jog, y }, { x: 29, y: y + 1 }, FARMLAND_TILE.BODY);
  }
  // 남북 대로 + 동서 길.
  // 밭 사이 길도 곧으면 밭이 아니라 도면처럼 보인다 — 중간에서 두 번 어긋나게 한다.
  rect(map, { x: 14, y: 14 }, { x: 15, y: 26 }, TILE.PATH);
  rect(map, { x: 16, y: 1 }, { x: 17, y: 14 }, TILE.PATH);
  rect(map, { x: 14, y: 13 }, { x: 17, y: 14 }, TILE.PATH);
  // 동서 길은 한 행으로 관통하지 않게 남/북으로 나눠 붙인다(전에는 y=13 이 x1..30 이었다).
  rect(map, { x: 1, y: 15 }, { x: 14, y: 16 }, TILE.PATH);
  rect(map, { x: 13, y: 15 }, { x: 14, y: 16 }, TILE.PATH);
  rect(map, { x: 18, y: 11 }, { x: 30, y: 12 }, TILE.PATH);
  rect(map, { x: 17, y: 11 }, { x: 18, y: 12 }, TILE.PATH);
  // 농가 둘 + 헛간 하나(낮은 벽) — 밀밭은 건물이 드물어야 벌판으로 읽힌다.
  buildHouses(map, [
    { x: 4, y: 5, width: 6, stories: 2, roofBodyRows: 2, kitId: "aframe-stone" },
    { x: 23, y: 6, width: 5, stories: 1, roofBodyRows: 1, kitId: "amber-wood" },
    { x: 23, y: 19, width: 6, stories: 1, roofBodyRows: 1, kitId: "timber-hall", lowWall: true },
  ]);
  // 관개 수로 — 밀밭에 물길이 지나가면 단조로움이 깨진다.
  rect(map, { x: 1, y: 22 }, { x: 12, y: 22 }, TILE.WATER);
  for (const p of [{ x: 3, y: 2 }, { x: 28, y: 2 }, { x: 3, y: 25 }, { x: 28, y: 25 }]) tree(map, p.x, p.y);

  // 농기구와 수확물 — 밀밭은 사람이 일하는 곳이라는 표시.
  scatterProps(map, [
    [12, 15, PROP.woodBox], [13, 15, PROP.barrel], [12, 16, PROP.jar],
    [19, 15, PROP.firewood], [20, 15, PROP.woodBox], [20, 16, PROP.barrel],
    [11, 22, PROP.barrel], [12, 22, PROP.jar], [22, 11, PROP.firewood], [22, 12, PROP.woodBox],
  ]);

  map.events.push(
    farmerEvent(),
    scarecrowEvent(),
    villager("ev_sky_w_wife", 11, 10, "농부의 아내 단", "중년 여성 주민(흑인)", [
      "그 허수아비는 우리 아버지가 세운 거야. 삼십 년도 넘었지.",
      "그게 일어서 걸었다니... 무섭기보다 슬퍼.",
    ]),
    villager("ev_sky_w_hand_a", 20, 16, "일꾼 갈", "청년 남성", [
      "쥐가 밀을 다 먹어. 한 마리가 아니라 떼로 와.",
      "혼자 붙지 마. 여럿이 나오면 여럿이 상대해야지.",
    ], WANDER),
    villager("ev_sky_w_hand_b", 11, 17, "일꾼 무리", "노란 전통옷 남성", [
      "나방 가루가 눈에 들어가면 한참 못 봐. 조심해.",
      "해독초 있으면 하나 챙겨. 여기선 그게 목숨이야.",
    ], WANDER),
    villager("ev_sky_w_kid", 25, 11, "밀밭 아이 초록", "빵모자 아이", [
      "허수아비랑 눈이 마주쳤어. 진짜로 나를 봤어.",
      "아빠는 안 믿어. 어른들은 원래 안 믿잖아.",
    ]),
    villager("ev_sky_w_trader", 17, 24, "행상 벌", "머리 장식 이국 여성", [
      "안개 숲으로 갈 거야? 그럼 목도리 색 잘 봐 둬.",
      "숲에서는 색이 단서야. 안개가 다른 건 다 지워 버리니까.",
    ]),
    gate("ev_sky_w_gate_s", 15, 26, SKY_MAP.harbor, 15, 5, null, ""),
    gate("ev_sky_w_gate_n", 15, 1, SKY_MAP.mistwood, 15, 29, SKY_SWITCH.gateMist, "허수아비를 정리하지 않고는 북쪽 숲에 들 수 없다."),
    gate("ev_sky_w_gate_n2", 16, 1, SKY_MAP.mistwood, 16, 29, SKY_SWITCH.gateMist, "허수아비를 정리하지 않고는 북쪽 숲에 들 수 없다."),
  );
  return map;
}

function farmerEvent(): GameEvent {
  const graphic = charsetByLabel("중년 남성 주민(흑인)");
  return event("ev_sky_w_farmer", 15, 12, [
    page("fm_intro", "농부 들샘", [], withFace(graphic, [
      say("들샘", "북쪽 밀밭의 허수아비가... 일어섰어."),
      say("들샘", "쥐랑 사마귀를 몰고 다녀. 사람이 다쳤다. 저걸 멈춰 줘."),
      { kind: "setSwitch", switchId: SKY_SWITCH.q2Started, value: true },
      say(undefined, "【퀘스트】 밀밭의 허수아비 — 북쪽 밀밭의 허수아비를 멈추자."),
    ]), graphic),
    page("fm_waiting", "농부 들샘", [switchOn(SKY_SWITCH.q2Started)], withFace(graphic, [
      say("들샘", "북쪽이야. 혼자 가지 마 — 그놈은 절대 혼자 안 나와."),
    ]), graphic),
    page("fm_done", "농부 들샘", [switchOn(SKY_SWITCH.q2Done)], withFace(graphic, [
      say("들샘", "부적을 찾았다고? 그건 아버지가 허수아비에 넣은 거야."),
      say("들샘", "묶어 둔 게 아니라 지켜 준 거였구나... 북쪽 숲길을 열어 뒀어."),
    ]), graphic),
  ]);
}

function scarecrowEvent(): GameEvent {
  const graphic = charsetByLabel("해골");
  return event("ev_sky_w_scarecrow", 15, 4, [
    page("sc_still", "허수아비", [], [
      say(undefined, "낡은 허수아비가 밀밭을 내려다보고 있다. 아직은 움직이지 않는다."),
    ], graphic),
    page("sc_fight", "일어선 허수아비", [switchOn(SKY_SWITCH.q2Started)], [
      say(undefined, "밀 사이에서 팔이 하나 올라온다. 그리고 또 하나."),
      say(undefined, "허수아비가 사마귀 둘을 데리고 천천히 돌아섰다."),
      { kind: "battleProcessing", troopId: SKY_TROOP.scarecrow, canEscape: true, canLose: false },
      {
        kind: "fork",
        condition: { kind: "battleResult", result: "victory" },
        then: [
          { kind: "changeItem", itemId: SKY_ITEM.charm, op: "+=", amount: 1 },
          { kind: "setSwitch", switchId: SKY_SWITCH.q2Done, value: true },
          { kind: "setSwitch", switchId: SKY_SWITCH.gateMist, value: true },
          { kind: "m2Command", commandId: "m2-086-erase-event", fields: {} },
          say(undefined, "허수아비가 무너지고, 가슴에서 낡은 부적이 떨어졌다."),
          say(undefined, "【완료】 밀밭의 허수아비 — 북쪽 숲길이 열렸다."),
        ],
      },
    ], graphic),
  ]);
}

/**
 * 안개 숲 이벤트 자리 — connectForest 가 이 칸과 그 8이웃의 밑동을 먼저 비운다.
 * 이 목록이 실제 이벤트 좌표와 어긋나면 NPC 가 줄기 안에 서게 되고 reachability 테스트가 잡는다.
 * (아래 mistwoodMap 의 events 배열과 motherEvent/scarfClues/lostChildEvent 좌표를 그대로 옮긴 것)
 */
const MISTWOOD_EVENT_SPOTS: readonly Point[] = [
  { x: 15, y: 26 }, // 안개 트리거
  { x: 15, y: 24 }, // 어머니
  { x: 9, y: 18 }, { x: 21, y: 8 }, { x: 22, y: 13 }, // 붉은 실 3
  { x: 26, y: 26 }, // 잃은 아이
  { x: 10, y: 20 }, { x: 20, y: 10 }, { x: 25, y: 27 }, // NPC 3
  { x: 15, y: 30 }, { x: 15, y: 1 }, { x: 16, y: 1 }, // 관문 3
];

// ══════════ 3층 · 안개 숲 — 안개와 낮은 조명 ══════════
function mistwoodMap(): GameMap {
  const map = makeMap(SKY_MAP.mistwood, "안개 숲", 32, 32);
  dress(map, {
    bgm: SKY_BGM.mistwood,
    battleBackground: SKY_BATTLE_BG.mistwood,
    // 안개 숲 — 서늘한 회청 덮개를 두껍게. 앞 두 층보다 확실히 어둡고 차갑다.
    lighting: { ambient: 0.4, color: "#33505f", sources: [] },
    encounterRate: 30,
    troopIds: [SKY_TROOP.mistThicket],
  });

  rect(map, { x: 0, y: 0 }, { x: 31, y: 31 }, TILE.GRASS);
  // 구불구불한 길 — 직선을 피한다. 길을 **먼저** 내고 나무를 나중에 심는다:
  // 순서를 뒤집으면 길이 나무 상단(260)을 덮어 밑동만 남는다(실측 7건).
  rect(map, { x: 15, y: 25 }, { x: 16, y: 30 }, TILE.PATH);
  rect(map, { x: 8, y: 23 }, { x: 16, y: 24 }, TILE.PATH);
  rect(map, { x: 8, y: 14 }, { x: 9, y: 23 }, TILE.PATH);
  rect(map, { x: 9, y: 13 }, { x: 22, y: 14 }, TILE.PATH);
  rect(map, { x: 21, y: 5 }, { x: 22, y: 14 }, TILE.PATH);
  rect(map, { x: 15, y: 4 }, { x: 22, y: 5 }, TILE.PATH);
  rect(map, { x: 15, y: 1 }, { x: 16, y: 5 }, TILE.PATH);
  // 숲 속 못 — 안개 사이 물빛이 유일한 밝은 점이다.
  rect(map, { x: 24, y: 20 }, { x: 28, y: 24 }, TILE.WATER);
  // ── 숲 ──────────────────────────────────────────────────────────────────
  // 하층식생을 **먼저** 깐다. 잔디 한 종류만 깔린 숲은 나무를 아무리 심어도 평평하다.
  // 키큰 풀은 투명 픽셀 0/256 의 진짜 지면이라 하위 레이어에 안전하다.
  scatterUndergrowth(map, 0x51f7, 0.35);
  // 나무는 전부 **상위 레이어**로 간다(putProp). 원자를 지터를 줘 던지고 겹침을 허용하므로
  // 수관끼리 맞물려 덩어리가 된다 — 격자로 심으면 점유율 52% 여도 과수원으로 읽혔다(실측).
  // 밑동만 통행을 막고 수관은 통행 가능해서, 점유율이 높아도 걸어 다닐 공간이 남는다.
  scatterForest(map, {
    seed: 0x2026_07,
    seeds: 220,
    attempts: 2600,
    threshold: 0.24,
    broadShare: 0.35,
    wall: 90,
    bushes: 30,
    diagonalRounds: 5,
    diagonalChance: 0.7,
  });
  // 꽃은 나무를 심은 **뒤에** 놓으므로 원자 위에 떨어질 수 있다. setUpper 로 무조건 덮으면
  // 2×2 활엽수가 깨져 projectLint 가 error 를 낸다(실측 4건). 원자를 통째로 걷고 나서 놓는다.
  for (const p of [{ x: 10, y: 12 }, { x: 20, y: 16 }, { x: 12, y: 26 }]) {
    clearAtomAt(map, p.x, p.y);
    setUpper(map, p.x, p.y, TILE.FLOWERS);
  }
  // 밀집 배치는 갇힌 주머니를 만든다. 이벤트 자리를 비우고 고립 영역을 이어 붙인다.
  connectForest(map, defaultTilesets()[DEFAULT_TILESET_ID]!, { x: 15, y: 30 }, MISTWOOD_EVENT_SPOTS);

  map.events.push(
    // 진입하면 안개가 낀다 — 층에 들어선 순간 화면이 바뀐다.
    autoEvent("ev_sky_m_fog", 15, 26, [
      { kind: "setWeather", weather: "fog", intensity: 0.6, transitionMs: 1200 },
    ]),
    motherEvent(),
    ...scarfClues(),
    lostChildEvent(),
    villager("ev_sky_m_herbalist", 10, 20, "약초꾼 이내", "녹색 후드 여인", [
      "안개는 소리를 지워. 아이가 울어도 안 들려.",
      "색을 찾아. 목도리는 빨간색이야. 안개가 못 지우는 건 그것뿐이야.",
    ]),
    villager("ev_sky_m_hunter", 20, 10, "사냥꾼 솔개", "녹색 망토 레인저", [
      "식충화가 길을 막았어. 그놈은 꼭 거미를 옆에 붙여.",
      "셋이 한꺼번에 온다. 준비 없이 가면 안 돼.",
    ]),
    villager("ev_sky_m_woodcutter", 25, 27, "나무꾼 굴참", "대머리 이국 주민", [
      "이 숲은 서른 해째 그대로야. 근데 요즘은 나무가 자리를 바꿔.",
      "길을 외우지 마. 물빛을 보고 걸어.",
    ]),
    gate("ev_sky_m_gate_s", 15, 30, SKY_MAP.wheat, 15, 2, null, ""),
    gate("ev_sky_m_gate_n", 15, 1, SKY_MAP.shrine, 15, 21, SKY_SWITCH.gateShrine, "아이를 찾지 않고는 이 숲을 나갈 수 없다."),
    gate("ev_sky_m_gate_n2", 16, 1, SKY_MAP.shrine, 14, 21, SKY_SWITCH.gateShrine, "아이를 찾지 않고는 이 숲을 나갈 수 없다."),
  );
  return map;
}

function motherEvent(): GameEvent {
  const graphic = charsetByLabel("젊은 여성");
  return event("ev_sky_m_mother", 15, 24, [
    page("mo_intro", "어머니 물결", [], withFace(graphic, [
      say("물결", "우리 아이가 안개 속으로 들어갔어요. 벌써 이틀이에요."),
      say("물결", "빨간 목도리를 하고 있었어요. 그 색만 찾으면... 부탁이에요."),
      { kind: "setSwitch", switchId: SKY_SWITCH.q3Started, value: true },
      say(undefined, "【퀘스트】 안개 속의 아이 — 숲에서 붉은 목도리 흔적 3개를 찾자."),
    ]), graphic),
    page("mo_waiting", "어머니 물결", [switchOn(SKY_SWITCH.q3Started)], withFace(graphic, [
      say("물결", "흔적이라도 좋아요. 조금이라도 좋아요."),
    ]), graphic),
    page("mo_done", "어머니 물결", [switchOn(SKY_SWITCH.q3Done)], withFace(graphic, [
      say("물결", "고마워요... 정말 고마워요."),
      say("물결", "신전 길을 열어 뒀어요. 사제님이 기다리고 있을 거예요."),
    ]), graphic),
  ]);
}

/** 목도리 단서 3개 — 변수를 세고, 3개가 모이면 아이가 나타난다. */
function scarfClues(): GameEvent[] {
  const spots: readonly Point[] = [
    { x: 9, y: 18 },
    { x: 21, y: 8 },
    { x: 22, y: 13 },
  ];
  return spots.map((spot, index) =>
    event(`ev_sky_m_clue_${index + 1}`, spot.x, spot.y, [
      // 순서 주의: 일반 → 구체. 채집(take) 뒤에 이미 채집(found)이 와야 재채집을 막는다.
      page(`clue_${index + 1}_idle`, "붉은 실", [], [
        say(undefined, "가지 사이로 안개가 흐른다."),
      ], NO_GRAPHIC, PASSIVE, "below"),
      // **이 페이지는 보여야 한다.** 예전에는 세 단서가 모두 투명이었고, 그래서 32×32 숲에서
      // 아무 표시도 없는 세 칸을 찾아 밟아야 했다 — 플레이어가 찾을 수 없는 퀘스트였다.
      // 실뭉치(밧줄 뭉치)를 놓으면 "안개 속의 붉은 것"이라는 퀘스트 문장이 화면에도 있게 된다.
      page(`clue_${index + 1}_take`, "붉은 실", [switchOn(SKY_SWITCH.q3Started)], [
        say(undefined, "가지에 붉은 실이 걸려 있다. 목도리에서 풀린 것이다."),
        { kind: "setVariable", variableId: SKY_VARIABLE.scarves, op: "+=", value: 1 },
        { kind: "setSelfSwitch", key: "A", value: true },
        say(undefined, `단서를 찾았다. (${index + 1}/3)`),
      ], charsetByLabel("밧줄 뭉치"), PASSIVE, "below"),
      page(`clue_${index + 1}_found`, "붉은 실", [selfSwitchOn("A")], [
        say(undefined, "이미 살펴본 자리다."),
      ], NO_GRAPHIC, PASSIVE, "below"),
    ])
  );
}

function lostChildEvent(): GameEvent {
  const childGraphic = charsetByLabel("남자아이");
  // 아이는 전투가 끝난 뒤에야 말한다 — 그 대사에만 얼굴을 붙인다.
  const CHILD_FACE = npcFaceGraphicFromEventGraphic(childGraphic);
  return event("ev_sky_m_child", 26, 26, [
    page("ch_hidden", "안개", [], [
      say(undefined, "안개가 너무 짙다. 아직 아무것도 보이지 않는다."),
    ], NO_GRAPHIC, PASSIVE, "below"),
    page("ch_rescue", "붉은 목도리", [{ kind: "variable", variableId: SKY_VARIABLE.scarves, op: ">=", value: 3 }], [
      say(undefined, "안개가 걷힌 자리에 아이가 웅크리고 있다. 그리고 그 앞에—"),
      say(undefined, "식충화가 거미 둘을 데리고 천천히 몸을 일으켰다."),
      { kind: "battleProcessing", troopId: SKY_TROOP.carnivore, canEscape: false, canLose: false },
      {
        kind: "fork",
        condition: { kind: "battleResult", result: "victory" },
        then: [
          { kind: "changeItem", itemId: SKY_ITEM.scarf, op: "+=", amount: 1 },
          { kind: "setSwitch", switchId: SKY_SWITCH.q3Done, value: true },
          { kind: "setSwitch", switchId: SKY_SWITCH.gateShrine, value: true },
          { kind: "recoverAll" },
          { kind: "setWeather", weather: "none", transitionMs: 1500 },
          ...(CHILD_FACE ? [{ kind: "changeFace" as const, ...CHILD_FACE }] : []),
          say("아이", "...엄마한테 데려다 줄 거예요?"),
          say(undefined, "안개가 걷혔다. 북쪽으로 신전 길이 보인다."),
          say(undefined, "【완료】 안개 속의 아이"),
          { kind: "m2Command", commandId: "m2-086-erase-event", fields: {} },
        ],
      },
    ], childGraphic),
  ]);
}

// ══════════ 4층 · 호수 신전 — 물과 하늘, 세 개의 방 ══════════
function shrineMap(): GameMap {
    // 던전 칩셋 — 석재·단상·카펫·급류가 여기 있다(마을 칩셋엔 신전 어휘가 없다).
  const map = makeMap(SKY_MAP.shrine, "호수 신전", 30, 24, DUNGEON_TILESET_ID);
  dress(map, {
    bgm: SKY_BGM.shrine,
    battleBackground: SKY_BATTLE_BG.shrine,
    // 물 위 신전 — 덮개를 거의 걷는다. 안개 숲 다음이라 이 밝기가 대비로 느껴진다.
    lighting: { ambient: 0.06, color: "#7fc9ff", sources: [] },
  });

  // **던전 칩셋**으로 짓는다. 마을 칩셋의 모래로는 아무리 다듬어도 "물 위 모래밭"이고,
  // 던전 칩셋에는 석재 바닥·갈색 단상·금장 붉은 카펫·검푸른 급류가 있어 신전 어휘가 다 있다.
  // 검푸른 급류를 바탕으로 깔고 그 위에 석재 다리와 단을 놓는다 — 물이 주인공이다.
  rect(map, { x: 0, y: 0 }, { x: 29, y: 23 }, DUNGEON.DEEP);
  // 남북 참배로 — 붉은 카펫. 참배로가 카펫이면 어디로 가야 하는지 한눈에 읽힌다.
  rect(map, { x: 14, y: 14 }, { x: 15, y: 22 }, DUNGEON.CARPET);
  rect(map, { x: 13, y: 13 }, { x: 14, y: 14 }, DUNGEON.STONE);
  // 동서 회랑 — 석재 다리 1칸 폭. 서쪽 끝(4,11)이 폐광 문이 놓이는 막다른 지점이다.
  rect(map, { x: 4, y: 11 }, { x: 13, y: 11 }, DUNGEON.STONE);
  rect(map, { x: 13, y: 10 }, { x: 16, y: 10 }, DUNGEON.STONE);
  rect(map, { x: 16, y: 11 }, { x: 24, y: 11 }, DUNGEON.STONE);
  rect(map, { x: 13, y: 10 }, { x: 13, y: 11 }, DUNGEON.STONE);
  rect(map, { x: 16, y: 10 }, { x: 16, y: 11 }, DUNGEON.STONE);
  rect(map, { x: 13, y: 11 }, { x: 13, y: 13 }, DUNGEON.STONE);
  // 세 개의 단 — 갈색 단상. 모서리를 깎아 팔각으로 만들면 오토타일이 둥글게 마감한다.
  platform(map, 4, 5, 5, 5, DUNGEON.DAIS, DUNGEON.DEEP);
  platform(map, 13, 3, 5, 6, DUNGEON.DAIS, DUNGEON.DEEP);
  platform(map, 22, 5, 5, 5, DUNGEON.DAIS, DUNGEON.DEEP);
  // 각 단 가운데에 카펫을 한 줄 깔아 봉인석 자리를 표시한다.
  rect(map, { x: 6, y: 6 }, { x: 6, y: 8 }, DUNGEON.CARPET);
  rect(map, { x: 15, y: 4 }, { x: 15, y: 7 }, DUNGEON.CARPET);
  rect(map, { x: 24, y: 6 }, { x: 24, y: 8 }, DUNGEON.CARPET);
  // 각 단을 회랑에 잇는 짧은 다리 — 나무 판자. 돌 위 나무는 임시 가교로 읽힌다.
  rect(map, { x: 6, y: 10 }, { x: 6, y: 11 }, DUNGEON.PLANK);
  rect(map, { x: 15, y: 9 }, { x: 15, y: 11 }, DUNGEON.PLANK);
  rect(map, { x: 24, y: 10 }, { x: 24, y: 11 }, DUNGEON.PLANK);
  // 기둥 — 단의 귀퉁이. 신전은 기둥이 있어야 신전으로 읽힌다.
  for (const p of [
    { x: 4, y: 4 }, { x: 8, y: 4 }, { x: 13, y: 2 }, { x: 17, y: 2 }, { x: 22, y: 4 }, { x: 26, y: 4 },
    { x: 12, y: 13 }, { x: 17, y: 13 }, { x: 12, y: 19 }, { x: 17, y: 19 },
  ]) setLower(map, p.x, p.y, DUNGEON.WALL);

  map.events.push(
    shrinePriestEvent(),
    // 세 방의 수호자는 **서로 다른 그림**이어야 한다. 예전에는 셋 다 monster2#2 한 칸을
    // 공유했고(그 칸은 카탈로그에 라벨조차 없었다 — 실물은 뱀파이어), 물·돌·바람이라는
    // 방 이름과 아무 관계가 없었다. 이제 방의 속성으로 고른다.
    sealRoomEvent("ev_sky_s_seal1", 6, 5, SKY_SWITCH.seal1, SKY_ITEM.seal1, SKY_TROOP.sealWater, "물의 방", "파도 소리가 방 안을 채운다.", "청룡"),
    sealRoomEvent("ev_sky_s_seal2", 24, 5, SKY_SWITCH.seal2, SKY_ITEM.seal2, SKY_TROOP.sealStone, "돌의 방", "발소리가 울리지 않는다. 돌이 소리를 먹는다.", "스톤 골렘"),
    sealRoomEvent("ev_sky_s_seal3", 15, 4, SKY_SWITCH.seal3, SKY_ITEM.seal3, SKY_TROOP.sealStorm, "바람의 방", "천장이 없다. 바람이 곧장 내려온다.", "하피"),
    villager("ev_sky_s_acolyte_a", 12, 11, "시자 물비늘", "여자 메이드", [
      "세 방의 수호자는 절대 혼자 오지 않아요. 그게 규칙이에요.",
      "셋을 한꺼번에 상대할 준비가 되면 문을 여세요.",
    ]),
    villager("ev_sky_s_acolyte_b", 19, 11, "시자 잔물", "승려", [
      "봉인석 셋이 맞물리면 천공의 열쇠가 됩니다.",
      "열쇠는 계단을 여는 게 아니에요. 계단이 당신을 알아보게 하는 거죠.",
    ]),
    villager("ev_sky_s_keeper", 15, 20, "신전 지기 고요", "파란 갑옷 기사", [
      "폐광을 지나야 설산에 닿습니다. 다른 길은 무너졌어요.",
      "쇠 냄새가 나는 곳이니, 대장장이에게 줄 것도 챙기시길.",
    ]),
    gate("ev_sky_s_gate_s", 15, 22, SKY_MAP.mistwood, 15, 2, null, ""),
    gate("ev_sky_s_gate_n", 4, 11, SKY_MAP.mine, 3, 16, SKY_SWITCH.gateMine, "세 봉인이 모두 풀리지 않았다."),
  );
  return map;
}

function shrinePriestEvent(): GameEvent {
  const graphic = charsetByLabel("사제");
  return event("ev_sky_s_priest", 15, 13, [
    page("pr_intro", "사제 무늬", [], withFace(graphic, [
      say("무늬", "계단은 세 봉인 위에 서 있습니다. 물, 돌, 바람."),
      say("무늬", "각 방에는 수호자가 있고, 그들은 결코 혼자 나오지 않습니다."),
      { kind: "setSwitch", switchId: SKY_SWITCH.q4Started, value: true },
      say(undefined, "【퀘스트】 세 개의 봉인 — 세 방의 수호자를 물리치고 봉인석 3개를 모으자."),
    ]), graphic),
    page("pr_waiting", "사제 무늬", [switchOn(SKY_SWITCH.q4Started)], withFace(graphic, [
      say("무늬", "좌우와 정면, 세 방입니다. 순서는 상관없습니다."),
    ]), graphic),
    page("pr_complete", "사제 무늬", [
      switchOn(SKY_SWITCH.seal1),
      switchOn(SKY_SWITCH.seal2),
      switchOn(SKY_SWITCH.seal3),
    ], withFace(graphic, [
      say("무늬", "셋 다 풀렸군요. 손을 내밀어 보세요."),
      { kind: "changeItem", itemId: SKY_ITEM.seal1, op: "-=", amount: 1 },
      { kind: "changeItem", itemId: SKY_ITEM.seal2, op: "-=", amount: 1 },
      { kind: "changeItem", itemId: SKY_ITEM.seal3, op: "-=", amount: 1 },
      { kind: "changeItem", itemId: SKY_ITEM.skyKey, op: "+=", amount: 1 },
      { kind: "setSwitch", switchId: SKY_SWITCH.q4Done, value: true },
      { kind: "setSwitch", switchId: SKY_SWITCH.gateMine, value: true },
      say(undefined, "세 봉인석이 맞물려 하나의 열쇠가 되었다."),
      say(undefined, "【완료】 세 개의 봉인 — 북쪽 폐광 길이 열렸다."),
      { kind: "changeItem", itemId: SKY_ITEM.feather, op: "+=", amount: 1 },
    ]), graphic),
  ]);
}

function sealRoomEvent(
  id: string,
  x: number,
  y: number,
  switchId: string,
  itemId: string,
  troopId: string,
  roomName: string,
  flavor: string,
  guardianLook: string
): GameEvent {
  const graphic = charsetByLabel(guardianLook);
  // 잠긴 동안에는 봉인석이 자리에 있다 — 세 방이 화면에서 표시가 나야 어디로 갈지 읽힌다.
  // 예전에는 이 페이지가 투명이라, 퀘스트를 받기 전에는 방에 아무것도 없었다.
  const sealStone = charsetByLabel("보석");
  return event(id, x, y, [
    // 순서 주의: 일반 → 구체. 잠김 → 전투 → 해제 순이어야 각 단계가 실제로 이긴다.
    page(`${id}_locked`, roomName, [], [
      say(undefined, "문이 잠겨 있다. 사제에게 먼저 이야기를 들어야 한다."),
    ], sealStone, PASSIVE, "below"),
    page(`${id}_fight`, roomName, [switchOn(SKY_SWITCH.q4Started)], [
      say(undefined, flavor),
      say(undefined, "수호자들이 셋으로 갈라져 길을 막는다."),
      { kind: "battleProcessing", troopId, canEscape: true, canLose: false },
      {
        kind: "fork",
        condition: { kind: "battleResult", result: "victory" },
        then: [
          { kind: "changeItem", itemId, op: "+=", amount: 1 },
          { kind: "setSwitch", switchId, value: true },
          { kind: "setVariable", variableId: SKY_VARIABLE.seals, op: "+=", value: 1 },
          say(undefined, `${roomName}의 봉인석을 얻었다.`),
        ],
      },
    ], graphic),
    page(`${id}_cleared`, roomName, [switchOn(switchId)], [
      say(undefined, `${roomName}은 조용하다. 봉인이 풀렸다.`),
    ], NO_GRAPHIC, PASSIVE, "below"),
  ]);
}

// ══════════ 5층 · 잊힌 폐광 — 어둠과 등불 ══════════
function mineMap(): GameMap {
  // **이 층만 던전 칩셋을 쓴다.** 처음엔 7층 전부를 combined_town 하나로 지었는데, 그러면
  // 동굴을 마을 자갈(421)과 마을 벽(306)으로 흉내 내게 되어 "갈색 흙이 깔린 마을"로 보인다.
  // easyrpg_chipset_dungeon 에는 암벽·대각절벽·천장어둠·용암·구덩이·뿌리커튼 같은 동굴 전용
  // 어휘가 30종 넘게 있고, 오토타일 그룹도 13종이 이미 배선돼 있다(themePacks.ts:321).
  // 주의: 타일 id 는 **타일셋 상대 좌표**라 같은 숫자가 칩셋마다 다른 그림이다 —
  // 그래서 이 함수 안에서는 TILE.* / GROUND.* / PROP.* 를 쓰지 않고 DUNGEON.* 만 쓴다.
  const map = makeMap(SKY_MAP.mine, "잊힌 폐광", 34, 22, DUNGEON_TILESET_ID);
  dress(map, {
    bgm: SKY_BGM.mine,
    battleBackground: SKY_BATTLE_BG.mine,
    // 이 층만 실제로 어둡다 — 등불 세 개가 유일한 광원이다. 조명이 곧 연출이다.
    lighting: {
      // 이 층만 덮개를 두껍게 씌운다 — 등불 셋이 그 덮개에 구멍을 뚫는 것이 연출이다.
      ambient: 0.82,
      color: "#0d0a12",
      sources: [
        { id: "lamp-8-16", at: { x: 8, y: 16 }, radius: 5, intensity: 0.9, color: "#ffb95e", flicker: true },
        { id: "lamp-18-10", at: { x: 18, y: 10 }, radius: 5, intensity: 0.9, color: "#ffb95e", flicker: true },
        { id: "lamp-28-5", at: { x: 28, y: 5 }, radius: 5, intensity: 0.9, color: "#ffb95e", flicker: true },
      ],
    },
    encounterRate: 34,
    troopIds: [SKY_TROOP.mineCrew],
    disableEscape: false,
  });

  // 갱도 — **미굴착 암반(천장 어둠)으로 다 채우고 통로만 파낸다.** 앞 층들과 정반대의
  // 만드는 법이고, 던전 칩셋의 abyss 블록은 바닥과 닿는 경계에 테두리를 그려 주므로
  // 오토타일이 알아서 "파낸 벽면"처럼 마감한다.
  rect(map, { x: 0, y: 0 }, { x: 33, y: 21 }, DUNGEON.UNDUG);
  // 통로는 흙바닥, 방은 석재 바닥 — 통로와 방이 다른 재질이면 갱도 구조가 읽힌다.
  rect(map, { x: 2, y: 15 }, { x: 12, y: 17 }, DUNGEON.DIRT);
  rect(map, { x: 10, y: 9 }, { x: 12, y: 17 }, DUNGEON.DIRT);
  rect(map, { x: 10, y: 9 }, { x: 22, y: 11 }, DUNGEON.DIRT);
  rect(map, { x: 20, y: 4 }, { x: 22, y: 11 }, DUNGEON.DIRT);
  rect(map, { x: 20, y: 4 }, { x: 31, y: 6 }, DUNGEON.DIRT);
  // 갱도 곁방 둘 — 석재 바닥을 깐 채굴실.
  rect(map, { x: 5, y: 8 }, { x: 8, y: 12 }, DUNGEON.STONE);
  rect(map, { x: 25, y: 9 }, { x: 29, y: 13 }, DUNGEON.STONE);
  // **곁방을 본 갱도에 잇는 목.** 처음엔 이 두 줄이 없어서 곁방 39칸이 통째로 고립됐고,
  // 하필 미믹(25,10)이 동쪽 곁방 안이라 **영원히 도달 불가한 콘텐츠**였다(2026-07-27 도달성 실측).
  // 완주 시나리오는 이벤트를 id 로 호출하므로 이 결함을 잡지 못한다 — 도달성 검사가 따로 필요하다.
  rect(map, { x: 7, y: 12 }, { x: 7, y: 15 }, DUNGEON.DIRT); // 서쪽 곁방 ↔ 아래 갱도(세로로 이어 행 관통을 피한다)
  rect(map, { x: 27, y: 7 }, { x: 27, y: 9 }, DUNGEON.DIRT); // 동쪽 곁방 ↔ 상단 갱도
  // 이끼 — 물이 스미는 자리. **상위 레이어**에 얹는다.
  // 하네스 그룹 `이끼 수풀` 은 defaultLayer 가 "lower" 라고 선언돼 있지만 실제 아트는
  // 12칸 중 11칸이 투명 픽셀 46~79/256 인 **오버레이**다(몸통 364 만 불투명).
  // 하위에 깔면 그 투명 부분이 캔버스 배경 #000 으로 새서 검은 점이 된다(실측 12칸).
  // 12칸 전부 통행 가능이라 상위로 올려도 통행 판정은 그대로다.
  for (const [x0, y0, x1, y1] of [[3, 16, 5, 17], [26, 12, 28, 13]] as const) {
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) setUpper(map, x, y, DUNGEON.MOSS);
  }
  // 무너진 구덩이와 용암 틈 — "버려진 광산"을 지형으로 말한다(소품 대신 지형으로).
  // combined_town 의 상자·통(PROP.*)은 이 칩셋에서 전혀 다른 그림이라 쓰지 않는다.
  rect(map, { x: 15, y: 10 }, { x: 17, y: 10 }, DUNGEON.CHASM);
  // 용암은 갱도 3행(y4~6) 중 아래 한 행만 막는다 — 통로를 끊지 않고, 설산에서 내려오는
  // 도착 칸(30,5)도 비켜 둔다(처음에 여기에 깔아 transfer-impassable 이 났다).
  rect(map, { x: 24, y: 6 }, { x: 25, y: 6 }, DUNGEON.LAVA);
  setLower(map, 11, 16, DUNGEON.CHASM);

  map.events.push(
    autoEvent("ev_sky_mine_enter", 3, 16, [
      { kind: "setWeather", weather: "none", transitionMs: 400 },
    ]),
    minerEvent(),
    mimicEvent(),
    villager("ev_sky_mine_engineer", 21, 10, "갱도 기사 쇠비", "청년 기사", [
      "이 아래는 무너진 게 아니야. 누가 막은 거야, 안쪽에서.",
      "잔당이 넷씩 몰려다녀. 등불에서 멀어지지 마.",
    ]),
    gate("ev_sky_mine_gate_s", 2, 16, SKY_MAP.shrine, 6, 11, null, ""),
    gate("ev_sky_mine_gate_n", 31, 5, SKY_MAP.snowgate, 15, 19, SKY_SWITCH.gateSnow, "설산 통행증이 없다. 광부에게 물어보자."),
  );
  return map;
}

function minerEvent(): GameEvent {
  const graphic = charsetByLabel("대머리 남성 주민");
  return event("ev_sky_mine_miner", 11, 16, [
    page("mn_idle", "늙은 광부 검댕", [], withFace(graphic, [
      say("검댕", "쇠는 다 파냈어. 남은 건 어둠뿐이야."),
    ]), graphic),
    page("mn_pass", "늙은 광부 검댕", [switchOn(SKY_SWITCH.q4Done)], withFace(graphic, [
      say("검댕", "위로 갈 셈이군. 관문 지기는 통행증 없인 안 보내."),
      say("검댕", "내가 삼십 년 전에 받은 게 있어. 이젠 내가 오를 일도 없고."),
      { kind: "changeItem", itemId: SKY_ITEM.snowPass, op: "+=", amount: 1 },
      { kind: "setSwitch", switchId: SKY_SWITCH.q5Started, value: true },
      { kind: "setSwitch", switchId: SKY_SWITCH.gateSnow, value: true },
      say(undefined, "설산 통행증을 받았다."),
      say(undefined, "【퀘스트】 천공의 계단 — 설산 관문을 지나 천공 제단에 오르자."),
    ]), graphic),
  ]);
}

/** 미믹 — 보물처럼 보이는 함정. 폐광에서 유일한 선택적 전투다. */
function mimicEvent(): GameEvent {
  const graphic = charsetByLabel("보물 상자");
  return event("ev_sky_mine_mimic", 25, 10, [
    page("mim_fight", "낡은 보물상자", [], [
      say(undefined, "물웅덩이 옆에 상자가 하나. 자물쇠가 없다."),
      say(undefined, "손을 대자 상자가 이빨을 드러냈다!"),
      { kind: "battleProcessing", troopId: SKY_TROOP.mineCrew, canEscape: true, canLose: false },
      {
        kind: "fork",
        condition: { kind: "battleResult", result: "victory" },
        then: [
          { kind: "setSelfSwitch", key: "A", value: true },
          { kind: "changeItem", itemId: SKY_ITEM.bomb, op: "+=", amount: 3 },
          { kind: "changeItem", itemId: SKY_ITEM.hiPotion, op: "+=", amount: 2 },
          say(undefined, "상자 안에 폭탄 3개와 상급 회복약 2개가 남아 있었다."),
        ],
      },
    ], graphic),
    page("mim_done", "빈 상자", [selfSwitchOn("A")], [
      say(undefined, "부서진 상자가 널려 있다."),
    ], NO_GRAPHIC, PASSIVE, "below"),
  ]);
}

// ══════════ 6층 · 설산 관문 — 눈과 밤 ══════════
function snowgateMap(): GameMap {
    // 던전 칩셋 — 눈밭·얼음판·정본 대각 빙벽이 여기 있다. 마을 칩셋의 눈(67)만으론 능선을 못 만든다.
  const map = makeMap(SKY_MAP.snowgate, "설산 관문", 30, 22, DUNGEON_TILESET_ID);
  dress(map, {
    bgm: SKY_BGM.snowgate,
    battleBackground: SKY_BATTLE_BG.snowgate,
    // 밤 설산 — 폐광보다는 얇게. 눈이 빛을 되쏘아 어둡지만 앞이 보인다.
    lighting: { ambient: 0.44, color: "#1b3358", sources: [] },
    encounterRate: 30,
    troopIds: [SKY_TROOP.snowPack],
  });

  /**
   * 지형은 `snowGateTerrain.ts` 가 짓는다 — 2026-07-27 감독 결정 시트의 답을 구현한 모듈이다.
   *
   * 예전 구현(손으로 찍은 5단 `rect`)을 버린 이유:
   *  · 정본 캡 286/287 을 몸통·밑동 없이 낱개로 찍어 정본 문법을 어겼다.
   *  · 흙바닥 421 로 길을 냈다 — 설산에 **갈색 흙길**이 났고, 갈색 암벽 226 으로 관문을 좁혔다.
   *  · 상위 레이어가 비어 소품이 0개, 어휘가 6종이었다.
   *  · 무엇보다 고도가 없었다. 이제 저수지 → 크레바스 단 → 수정 단 → 정상 네 단이고
   *    능선 셋이 실제로 길을 가른다(통로를 막으면 출구에 못 닿는 것을 테스트가 증명한다).
   */
  paintSnowGateTerrain(map);

  map.events.push(
    autoEvent("ev_sky_sn_snow", 15, 20, [
      { kind: "setWeather", weather: "snow", intensity: 0.7, transitionMs: 1500 },
    ]),
    gatekeeperEvent(),
    // 은자는 정상 통로(x21~23) 입구에 세운다 — 위에 다녀온 사람이 그 문 앞에 있어야 말이 된다.
    villager("ev_sky_sn_hermit", 22, 7, "은자 서리", "파란 로브 현자", [
      "위에는 아무도 없어. 나도 그렇게 들었고, 올라가 봤지.",
      "...아무도 없는 건 사실이야. 근데 무언가는 있어.",
    ]),
    gate("ev_sky_sn_gate_s", 15, 20, SKY_MAP.mine, 30, 5, null, ""),
    gate("ev_sky_sn_gate_n", 15, 1, SKY_MAP.altar, 12, 17, SKY_SWITCH.gateAltar, "관문 지기가 길을 막고 있다."),
  );
  return map;
}

function gatekeeperEvent(): GameEvent {
  const graphic = charsetByLabel("황금 갑옷 전사");
  // 관문 지기는 능선 A 의 통로 입구(x14~16)에 선다 — 저수지에서 올라오면 정면으로 마주친다.
  // 예전 자리 (15,10) 은 새 지형에서 능선 B 봉우리의 몸통(통행 불가)이라 이벤트가 벽에 박혔다.
  return event("ev_sky_sn_gatekeeper", 15, 18, [
    page("gk_block", "관문 지기 눈발", [], withFace(graphic, [
      say("눈발", "통행증 없이는 못 지나간다. 규칙이 아니라 시체를 안 보고 싶어서다."),
    ]), graphic),
    page("gk_pass", "관문 지기 눈발", [itemHeld(SKY_ITEM.snowPass)], withFace(graphic, [
      say("눈발", "...검댕의 목패군. 삼십 년 만에 보네."),
      say("눈발", "올라가라. 다만 하나만 말해 두지 — 제단에는 파수꾼이 셋이다."),
      { kind: "setSwitch", switchId: SKY_SWITCH.gateAltar, value: true },
      { kind: "changeItem", itemId: SKY_ITEM.hiPotion, op: "+=", amount: 3 },
      say(undefined, "관문이 열렸다. 상급 회복약 3개를 받았다."),
    ]), graphic),
  ]);
}

// ══════════ 7층 · 천공 제단 — 사람이 없는 곳 ══════════
function altarMap(): GameMap {
    // 던전 칩셋 — 심연(허공)·금장 어둠·녹회암 단상·카펫으로 구름 위 성역을 만든다.
  const map = makeMap(SKY_MAP.altar, "천공 제단", 24, 20, DUNGEON_TILESET_ID);
  dress(map, {
    bgm: SKY_BGM.altar,
    battleBackground: SKY_BATTLE_BG.altar,
    // 구름 위 — 덮개를 완전히 걷는다(ambient 0 = 오버레이 없음). 여섯 층을 어둡게
    // 올라온 끝이라 이 민낯의 밝기가 보상이 된다.
    lighting: { ambient: 0, color: "#ffffff", sources: [] },
    disableSave: false,
  });

  // 허공 위에 뜬 층이다. createBlankMap 은 잔디로 채우므로 **먼저 통째로 비워야** 한다 —
  // 안 그러면 구름 위 제단이 그냥 잔디밭으로 보인다(2026-07-27 스크린샷으로 발견).
  // 바깥은 **심연**(푸른 테두리) — 구름 위라는 걸 지형으로 말한다.
  rect(map, { x: 0, y: 0 }, { x: 23, y: 19 }, DUNGEON.ABYSS);
  // 좁은 부유 통로 — 녹회색 암반 단상.
  rect(map, { x: 12, y: 13 }, { x: 13, y: 18 }, DUNGEON.PLATFORM);
  rect(map, { x: 10, y: 12 }, { x: 12, y: 13 }, DUNGEON.PLATFORM);
  rect(map, { x: 10, y: 11 }, { x: 10, y: 12 }, DUNGEON.PLATFORM);
  // 제단 본체 — 암반 위에 금장 어둠 테두리를 두르고 가운데 카펫을 깐다.
  rect(map, { x: 6, y: 4 }, { x: 17, y: 10 }, DUNGEON.PLATFORM);
  rect(map, { x: 9, y: 5 }, { x: 14, y: 9 }, DUNGEON.DAIS);
  rect(map, { x: 11, y: 5 }, { x: 12, y: 9 }, DUNGEON.CARPET);
  // 제단 테두리 — 벽으로 원을 흉내 낸다.
  // 성역 경계 — 금장 테두리 어둠. 제단을 둘러 "여기부터는 다른 곳"을 그린다.
  for (const p of [
    { x: 6, y: 3 }, { x: 7, y: 2 }, { x: 16, y: 3 }, { x: 15, y: 2 },
    { x: 5, y: 5 }, { x: 5, y: 8 }, { x: 18, y: 5 }, { x: 18, y: 8 },
    { x: 11, y: 3 }, { x: 12, y: 3 },
  ]) setLower(map, p.x, p.y, DUNGEON.PIT_GOLD);

  map.events.push(
    autoEvent("ev_sky_al_clear", 12, 17, [
      { kind: "setWeather", weather: "none", transitionMs: 2000 },
    ]),
    wardenEvent(),
    demonLordEvent(),
    gate("ev_sky_al_gate_s", 12, 18, SKY_MAP.snowgate, 15, 2, null, ""),
  );
  return map;
}

/** 제단 파수꾼 — 3인 다수전. 보스 앞의 마지막 관문이다. */
function wardenEvent(): GameEvent {
  const graphic = charsetByLabel("마족 장군");
  return event("ev_sky_al_warden", 12, 10, [
    page("wd_fight", "제단의 파수꾼", [], [
      say(undefined, "통로 끝에 셋이 서 있다. 그리핀, 기사, 그리고 와이번."),
      say("타락한 기사", "여기서부터는 계단이 아니다. 돌아가라."),
      { kind: "battleProcessing", troopId: SKY_TROOP.skyWardens, canEscape: false, canLose: false },
      {
        kind: "fork",
        condition: { kind: "battleResult", result: "victory" },
        then: [
          { kind: "setSelfSwitch", key: "A", value: true },
          { kind: "recoverAll" },
          say(undefined, "셋이 모두 흩어졌다. 제단이 열렸다."),
        ],
      },
    ], graphic),
    page("wd_cleared", "부서진 파수꾼", [switchOn(SKY_SWITCH.q5Started), selfSwitchOn("A")], [
      say(undefined, "파수꾼들이 무너진 자리. 위로 가는 길이 비어 있다."),
    ], NO_GRAPHIC, PASSIVE, "below"),
  ]);
}

function demonLordEvent(): GameEvent {
  const graphic = charsetByLabel("마왕");
  return event("ev_sky_al_demon", 11, 5, [
    page("dl_locked", "잠긴 제단", [], [
      say(undefined, "제단 문에 세 개의 홈이 파여 있다. 천공의 열쇠가 필요하다."),
    ], graphic),
    page("dl_fight", "계단의 주인", [itemHeld(SKY_ITEM.skyKey)], [
      say(undefined, "제단 가운데, 무언가가 등을 보이고 앉아 있다."),
      say("계단의 주인", "올라온 건 넷째다. 앞의 셋은 여기서 그만두었지."),
      say("계단의 주인", "너희가 켠 등대 말이다 — 그건 나를 위한 불이었나?"),
      { kind: "battleProcessing", troopId: SKY_TROOP.demonLord, canEscape: false, canLose: false },
      { kind: "setSwitch", switchId: SKY_SWITCH.q5Done, value: true },
      { kind: "changeItem", itemId: SKY_ITEM.starShard, op: "+=", amount: 1 },
      { kind: "recoverAll" },
      say(undefined, "주인이 흩어지며, 손바닥에 빛 한 조각이 남았다."),
      say(undefined, "【완료】 천공의 계단"),
      {
        kind: "ending",
        title: SKY_TITLE,
        message:
          "별빛 조각은 아셀의 등대로 내려갔고, 그 불은 다시 꺼지지 않았다. " +
          "계단을 오른 넷째는 내려온 둘째가 되었다.",
      },
    ], graphic),
    page("dl_done", "빈 제단", [switchOn(SKY_SWITCH.q5Done)], [
      say(undefined, "제단은 비어 있다. 아래로 항구의 등대 불빛이 보인다."),
    ], NO_GRAPHIC, PASSIVE, "below"),
  ]);
}

// ── 공통 헬퍼 ────────────────────────────────────────────────────────────────
type Dressing = {
  readonly bgm: string;
  readonly battleBackground: string;
  readonly lighting: LightingState;
  readonly encounterRate?: number;
  readonly troopIds?: readonly string[];
  readonly disableSave?: boolean;
  readonly disableEscape?: boolean;
};

/** 층의 시각·청각 정체성을 한 곳에서 붙인다 — 빠뜨리면 층이 서로 같아 보인다. */
function dress(map: GameMap, spec: Dressing): void {
  map.bgm = { mode: "custom", resourceId: spec.bgm, fadeInMs: 900 };
  map.battleBackground = spec.battleBackground;
  map.defaultLighting = spec.lighting;
  if (spec.encounterRate !== undefined) map.encounterRate = spec.encounterRate;
  if (spec.troopIds) map.troopIds = [...spec.troopIds];
  if (spec.disableSave !== undefined) map.disableSave = spec.disableSave;
  if (spec.disableEscape !== undefined) map.disableEscape = spec.disableEscape;
}

/**
 * 대사만 있는 주민. 30명 중 대부분이 이것이다 — 각자 두 줄씩 다른 이야기를 한다.
 * `look` 은 **카탈로그 라벨**이다(charsetByLabel 참조) — 시트 이름과 숫자를 쓰지 않는다.
 */
function villager(
  id: string,
  x: number,
  y: number,
  name: string,
  look: string,
  lines: readonly string[],
  movement: EventPage["movement"] = PASSIVE
): GameEvent {
  const speaker = name.split(" ").slice(-1)[0] ?? name;
  const graphic = charsetByLabel(look);
  return event(id, x, y, [
    page(
      `${id}_talk`,
      name,
      [],
      withFace(graphic, lines.map((body) => say(speaker, body))),
      graphic,
      movement
    ),
  ]);
}

/** 층 사이 이동문. 스위치가 없으면 막고 이유를 말한다 — 조용히 안 움직이는 문을 만들지 않는다. */
function gate(
  id: string,
  x: number,
  y: number,
  mapId: string,
  destX: number,
  destY: number,
  requiredSwitchId: string | null,
  blockedMessage: string
): GameEvent {
  const open: Command[] = [{ kind: "transfer", mapId, x: destX, y: destY, fade: "black" }];
  if (!requiredSwitchId) {
    return event(id, x, y, [page(`${id}_open`, "길", [], open, NO_GRAPHIC, PASSIVE, "below")], "touch");
  }
  // 막힌 쪽을 **먼저**, 열린 쪽을 나중에 — 마지막 매칭이 이기므로 순서를 뒤집으면 영구 차단이다.
  return event(
    id,
    x,
    y,
    [
      page(`${id}_blocked`, "막힌 길", [], [say(undefined, blockedMessage)], NO_GRAPHIC, PASSIVE, "below"),
      page(`${id}_open`, "열린 길", [switchOn(requiredSwitchId)], open, NO_GRAPHIC, PASSIVE, "below"),
    ],
    "touch"
  );
}

/** 자동 실행 1회 이벤트 — 날씨처럼 "들어선 순간" 화면을 바꾸는 데 쓴다. */
function autoEvent(id: string, x: number, y: number, commands: readonly Command[]): GameEvent {
  return event(
    id,
    x,
    y,
    [
      page(`${id}_done`, "완료", [selfSwitchOn("A")], [], NO_GRAPHIC, PASSIVE, "below"),
      page(
        `${id}_run`,
        "자동",
        [],
        [...commands, { kind: "setSelfSwitch", key: "A", value: true }],
        NO_GRAPHIC,
        PASSIVE,
        "below"
      ),
    ],
    "auto"
  );
}

function say(speaker: string | undefined, body: string): Command {
  return speaker === undefined ? { kind: "text", body } : { kind: "text", speaker, body };
}

function switchOn(switchId: string): EventPage["conditions"][number] {
  return { kind: "switch", switchId, value: true };
}

function selfSwitchOn(key: "A" | "B" | "C" | "D"): EventPage["conditions"][number] {
  return { kind: "selfSwitch", key, value: true };
}

function itemHeld(itemId: string): EventPage["conditions"][number] {
  return { kind: "item", itemId, present: true };
}

function event(
  id: string,
  x: number,
  y: number,
  pages: readonly EventPage[],
  trigger: GameEvent["trigger"]["kind"] = "action"
): GameEvent {
  return {
    id,
    x,
    y,
    trigger: { kind: trigger },
    commands: [],
    pages: pages.map((entry) => ({ ...entry, trigger: { kind: trigger } })),
  };
}

function page(
  id: string,
  name: string,
  conditions: EventPage["conditions"],
  commands: readonly Command[],
  graphic: EventPage["graphic"],
  movement: EventPage["movement"] = PASSIVE,
  priority: EventPage["priority"] = "same"
): EventPage {
  return {
    id,
    name,
    conditions,
    graphic,
    trigger: { kind: "action" },
    priority,
    overlapForbidden: priority === "same",
    movement,
    commands: [...commands],
  };
}

/**
 * **차셋 칸을 의미로 고른다. 숫자 인덱스는 카탈로그가 정한다.**
 *
 * 왜 이렇게 바꿨나: 예전에는 `charset(PEOPLE_3, 0)` 처럼 생 숫자를 적었다. 인덱스가
 * 무슨 그림인지는 코드에 안 적혀 있으므로, 카탈로그(charsetSemantics)의 라벨이 정정되면
 * 그림이 **조용히** 어긋난다. 2026-07-27 전수 조사에서 실제로 이렇게 어긋나 있었다:
 *   · 길 잃은 아이            ← people3#0 = "왕"
 *   · 농부의 아내 단          ← people1#4 = "중년 남성 주민(흑인)"
 *   · 부두 상인 나루          ← people2#1 = "수녀"
 *   · 늙은 광부 검댕          ← people2#5 = "토끼 귀 여성"
 *   · 호수 신전 봉인 3개      ← 전부 monster2#2 = "뱀파이어" 한 칸을 공유
 *
 * 그래서 인자는 **카탈로그 라벨**이다. `queryNpcGraphics`(charsetQuery)로 풀고, 풀린
 * 칸의 라벨이 요청한 라벨과 다르면 **던진다** — 카탈로그가 바뀌면 조용히 어긋나는 대신
 * 프로젝트 생성이 즉시 실패한다. 라벨이 없는 칸("검증되지 않은 칸")은 질의로 나올 수
 * 없으므로 쓰는 것 자체가 불가능하다.
 */
function charsetByLabel(label: string): EventPage["graphic"] {
  const match = queryNpcGraphics(label, 24).find((candidate) => candidate.entry.label === label);
  if (!match) {
    throw new Error(
      `skyStairMaps: 차셋 카탈로그에 "${label}" 라벨이 없다 — `
      + "src/assets/charsetSemantics.ts 의 라벨과 정확히 일치해야 한다.",
    );
  }
  const { textureKey, characterIndex } = match.entry;
  return {
    sprite: { type: "bundled", id: textureKey },
    direction: "down",
    pattern: charsetFrameIndex({ characterIndex, direction: "down", pattern: 1 }),
  };
}

/**
 * 사람 NPC 의 대사 앞에 `changeFace` 를 붙인다. 얼굴은 charsetFaceMap 이 정한다 —
 * **짝이 검증된 시트**(CharSet/People1↔FaceSet/People1, CharSet/People3↔FaceSet/People2,
 * Actor1/2)는 인덱스를 그대로 쓰고, 짝이 없는 시트(People2·People4·People5·Actor3·Actor4)는
 * 성별·나이·특징으로 FaceSet/People1 에서 고른다. 몬스터·사물에는 얼굴을 붙이지 않는다.
 */
function withFace(graphic: EventPage["graphic"], commands: readonly Command[]): Command[] {
  const face = npcFaceGraphicFromEventGraphic(graphic);
  if (!face) return [...commands];
  return [{ kind: "changeFace", ...face }, ...commands];
}

/**
 * 맵을 만든다. **테두리에 벽을 두르지 않는다.**
 *
 * 왜: `canMove` 가 첫 줄에서 `if (!inBounds(map, toX, toY)) return false` 로 맵 밖을 이미
 * 막는다(collision.ts:70). 즉 테두리 벽은 통행 측면에서 **아무 일도 하지 않는 죽은 타일**이고,
 * 화면에는 모든 맵에 회색 돌 액자를 한 겹 그리는 부작용만 남긴다(설산·신전 스크린샷에서
 * 아래쪽 회색 띠로 보였다). 처음엔 잿불의 유산의 makeMap 을 그대로 베껴 벽을 둘렀다.
 *
 * 대신 각 층이 **자기 지형으로 가장자리까지** 채운다 — 바다·허공·암반이 경계를 그리는 게
 * 훨씬 자연스럽고, 오토타일도 가장자리까지 마감해 준다.
 */
function makeMap(
  id: string,
  name: string,
  width: number,
  height: number,
  tilesetId: string = DEFAULT_TILESET_ID,
): GameMap {
  const map = createBlankMap(name, width, height, tilesetId, DEFAULT_TILE_SIZE);
  map.id = id;
  return map;
}

/**
 * 모서리를 깎은 단(팔각형). 직사각형으로 깔면 오토타일이 직각으로 마감해 "블록"처럼 보이는데,
 * 네 귀퉁이를 비우면 같은 오토타일이 둥근 모서리 변형을 골라 준다 — 타일을 더 쓰는 게 아니라
 * **덜 쓰는 쪽**이 더 부드럽게 보이는 지점이다.
 */
function platform(
  map: GameMap,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number = GROUND.PLAZA,
  corner: number = TILE.WATER,
): void {
  rect(map, { x, y }, { x: x + w - 1, y: y + h - 1 }, fill);
  for (const [cx, cy] of [
    [x, y],
    [x + w - 1, y],
    [x, y + h - 1],
    [x + w - 1, y + h - 1],
  ] as const) {
    setLower(map, cx, cy, corner);
  }
}

function rect(map: GameMap, from: Point, to: Point, tile: number): void {
  for (let y = from.y; y <= to.y; y += 1) {
    for (let x = from.x; x <= to.x; x += 1) setLower(map, x, y, tile);
  }
}

function setLower(map: GameMap, x: number, y: number, tile: number): void {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
  map.lowerTiles[y * map.width + x] = tile;
  map.upperTiles[y * map.width + x] = TILE.EMPTY;
}

/**
 * 나무·덤불은 **하위 레이어에 쓰면 안 된다.** 실측(2026-07-27):
 *   290 침엽수 하단 투명 129/256 · 260 상단 64/256 · 292/293 활엽수 하단 125·143/256 · 289 덤불 130/256
 * 하위 레이어는 지면이라 그 아래에 아무것도 없고, 플레이 캔버스는 `#000`
 * (createPlayGame.ts:26 `backgroundColor`)이다. 그래서 예전 구현처럼 setLower 로 심으면
 * 나무마다 **검은 상자**가 생겼다 — 안개 숲 165칸, 화면의 6.5%가 순수 검정이었다.
 *
 * 타일 데이터가 이미 정답을 말하고 있었다:
 *   수관 260/261/262/263 → 통행 **가능** · priority=upper  (캐릭터가 뒤로 지나간다)
 *   밑동 290/291/292/293 → 통행 **불가** · priority=lower  (줄기가 길을 막는다)
 * 즉 잔디를 하위에 남기고 나무 전체를 **상위 레이어**에 올리면 구멍도 없고
 * 통행 판정도 저절로 맞는다(collision.ts:35 tilePassability — 상위가 하위를 덮어쓴다).
 */
const DRY_TREE = { top: 261, bottom: 291 } as const;
/** 통행 **가능**한 수관 조각 — 캐릭터가 뒤로 지나간다. 길을 막는 건 밑동뿐이다. */
const CANOPY_TILES = new Set<number>([CONIFER_TOP, DRY_TREE.top, BROADLEAF.topLeft, BROADLEAF.topRight]);
/** 나무를 세울 수 있는 바닥 — 길·물·집 위에는 세우지 않는다. */
const NATURAL_FLOOR = new Set<number>([TILE.GRASS, ...TALL_GRASS]);

/**
 * 나무 원자는 **전부 놓거나 하나도 놓지 않는다.** 조각 겹침은 허용할 수 없다 —
 * combinedTownGroups.ts:704 의 hardPairRule 4개가 활엽수 2×2 의 네 관계를 모두 강제하고
 * (262↔292 위아래, 263↔293 위아래, 262↔263 좌우, 292↔293 좌우), 침엽수도 260 이 290 바로 위여야 한다.
 * 원자를 겹쳐 깨면 projectLint 가 error 를 낸다(실측: 겹침 허용 버전에서 활엽수 위반 다수).
 *
 * 밀집은 겹침이 아니라 **인접**으로 만든다 — 수관 그림이 칸보다 넓고 여백이 투명해서,
 * 원자를 맞붙여 놓으면 수관끼리 이어져 하나의 덩어리로 읽힌다.
 */
function canPlaceAtom(map: GameMap, cells: readonly (readonly [number, number])[]): boolean {
  return cells.every(([x, y]) => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
    if (!NATURAL_FLOOR.has(tileAt(map, x, y))) return false;
    return (map.upperTiles[y * map.width + x] ?? TILE.EMPTY) === TILE.EMPTY;
  });
}

function writeAtom(map: GameMap, cells: readonly (readonly [number, number, number])[]): boolean {
  if (!canPlaceAtom(map, cells.map(([x, y]) => [x, y] as const))) return false;
  for (const [x, y, tile] of cells) map.upperTiles[y * map.width + x] = tile;
  return true;
}

/** 침엽수 한 그루 = 밑동(290) + 그 위 수관(260). y 는 밑동 좌표. 둘 다 상위 레이어. */
function tree(map: GameMap, x: number, y: number): boolean {
  return writeAtom(map, [[x, y - 1, CONIFER_TOP], [x, y, TILE.TREE]]);
}

/** 마른나무 한 그루 = 밑동(291) + 상단(261). 초록 덩어리에 색을 깨는 점을 준다. */
function dryTree(map: GameMap, x: number, y: number): boolean {
  return writeAtom(map, [[x, y - 1, DRY_TREE.top], [x, y, DRY_TREE.bottom]]);
}

/** 활엽수 한 그루 = 2×2. x,y 는 좌상단(수관 행). 네 칸 모두 상위 레이어. */
function broadleaf(map: GameMap, x: number, y: number): boolean {
  return writeAtom(map, [
    [x, y, BROADLEAF.topLeft], [x + 1, y, BROADLEAF.topRight],
    [x, y + 1, BROADLEAF.bottomLeft], [x + 1, y + 1, BROADLEAF.bottomRight],
  ]);
}

/**
 * **대각 겹침** — 활엽수 수관을 맞물리게 하는 유일한 합법 수단이다.
 *
 * 앞 원자의 우하(293) 자리에 다음 원자의 좌상(262)을 앉힌다. 즉 (+1,+1) 로 밀어 놓는다.
 * 하네스 규칙이 이를 `bAlt: [262]` 로 허용한다(combinedTownGroups.ts 의 활엽수 규칙 주석 참조) —
 * 262 는 자기 규칙(오른쪽 263, 아래 292)을 그대로 지켜야 하므로 **겹침은 다음 원자가
 * 온전할 때만** 성립하고, 조각난 나무는 여전히 lint error 다.
 *
 * 레이어는 두 장뿐이고 타일 스택 API 는 비활성 스텁(mapOverlayTiles.ts)이라
 * 한 칸에 두 수관을 쌓는 진짜 알파 겹침은 불가능하다. 이 대각 배치가 그 대체물이다.
 *
 * @param anchorX,anchorY 이미 놓인 원자의 **좌상단** 좌표. 그 우하 칸을 새 원자의 좌상으로 쓴다.
 */
function broadleafDiagonal(map: GameMap, anchorX: number, anchorY: number): boolean {
  const x = anchorX + 1;
  const y = anchorY + 1;
  // 겹치는 칸은 앵커의 우하(293)여야 한다. 그 외의 것을 덮으면 남의 나무를 깨뜨린다.
  if (upperAt(map, x, y) !== BROADLEAF.bottomRight) return false;
  // 새 원자의 나머지 세 칸은 비어 있고 통행 가능한 자연 지면이어야 한다.
  const rest = [[x + 1, y], [x, y + 1], [x + 1, y + 1]] as const;
  if (!canPlaceAtom(map, rest)) return false;
  map.upperTiles[y * map.width + x] = BROADLEAF.topLeft; // 293 → 262 로 교체
  map.upperTiles[y * map.width + (x + 1)] = BROADLEAF.topRight;
  map.upperTiles[(y + 1) * map.width + x] = BROADLEAF.bottomLeft;
  map.upperTiles[(y + 1) * map.width + (x + 1)] = BROADLEAF.bottomRight;
  return true;
}

function upperAt(map: GameMap, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return TILE.EMPTY;
  return map.upperTiles[y * map.width + x] ?? TILE.EMPTY;
}

/**
 * 상위 레이어에서 원자를 **통째로** 지운다. 한 조각만 지우면 남은 조각이 lint 위반이 된다
 * (예: 292 만 지우면 그 위 262 가 짝을 잃는다). connectForest 가 길을 뚫을 때 쓴다.
 */
function clearAtomAt(map: GameMap, x: number, y: number): void {
  const at = (cx: number, cy: number): number =>
    (cx < 0 || cy < 0 || cx >= map.width || cy >= map.height) ? TILE.EMPTY : (map.upperTiles[cy * map.width + cx] ?? TILE.EMPTY);
  const clear = (cx: number, cy: number): void => {
    if (cx < 0 || cy < 0 || cx >= map.width || cy >= map.height) return;
    map.upperTiles[cy * map.width + cx] = TILE.EMPTY;
  };
  const tile = at(x, y);
  if (tile === TILE.EMPTY) return;
  if (tile === CONIFER_TOP || tile === TILE.TREE) {
    const bottomY = tile === CONIFER_TOP ? y + 1 : y;
    clear(x, bottomY); clear(x, bottomY - 1);
    return;
  }
  if (tile === DRY_TREE.top || tile === DRY_TREE.bottom) {
    const bottomY = tile === DRY_TREE.top ? y + 1 : y;
    clear(x, bottomY); clear(x, bottomY - 1);
    return;
  }
  if (tile === BROADLEAF.topLeft || tile === BROADLEAF.topRight
    || tile === BROADLEAF.bottomLeft || tile === BROADLEAF.bottomRight) {
    // 대각 사슬은 **사슬째** 지워야 한다. 가운데 원자만 지우면 위쪽 원자가 겹침 대체 타일(262)을
    // 잃어 조각난 나무가 되고 lint error 가 난다(실측 18건).
    for (const origin of broadleafChain(map, x, y)) {
      for (let dy = 0; dy < 2; dy += 1) for (let dx = 0; dx < 2; dx += 1) clear(origin.x + dx, origin.y + dy);
    }
    return;
  }
  clear(x, y); // 덤불·꽃 등 1칸 소품
}

/** (x,y) 의 활엽수 조각이 속한 원자의 좌상단. */
function broadleafOrigin(x: number, y: number, tile: number): Point {
  const left = (tile === BROADLEAF.topRight || tile === BROADLEAF.bottomRight) ? x - 1 : x;
  const top = (tile === BROADLEAF.bottomLeft || tile === BROADLEAF.bottomRight) ? y - 1 : y;
  return { x: left, y: top };
}

/**
 * (x,y) 를 포함하는 **대각 사슬 전체**의 원자 좌상단 목록. 위·아래 양방향으로 따라간다.
 * 사슬 연결의 표식은 "다음 원자의 좌상(262)이 앞 원자의 우하 자리에 앉아 있다"는 것이다.
 */
function broadleafChain(map: GameMap, x: number, y: number): Point[] {
  const tile = upperAt(map, x, y);
  const start = broadleafOrigin(x, y, tile);
  const origins: Point[] = [start];
  // 위로: 내 좌상 칸의 대각 위(-1,-1)가 262 면 그게 앞 원자의 좌상이다
  let cur = start;
  for (let guard = 0; guard < 32; guard += 1) {
    const prev = { x: cur.x - 1, y: cur.y - 1 };
    if (upperAt(map, prev.x, prev.y) !== BROADLEAF.topLeft) break;
    origins.unshift(prev);
    cur = prev;
  }
  // 아래로: 내 우하 칸이 262 면 그게 다음 원자의 좌상이다
  cur = start;
  for (let guard = 0; guard < 32; guard += 1) {
    const next = { x: cur.x + 1, y: cur.y + 1 };
    if (upperAt(map, next.x, next.y) !== BROADLEAF.topLeft) break;
    origins.push(next);
    cur = next;
  }
  return origins;
}

/** 이 칸을 지우면 상위 레이어에서 몇 칸이 사라지는가 — connectForest 가 싼 제거를 고르는 데 쓴다. */
function removalCost(map: GameMap, x: number, y: number): number {
  const tile = upperAt(map, x, y);
  if (tile === TILE.EMPTY) return 0;
  if (tile === TILE.TREE || tile === CONIFER_TOP || tile === DRY_TREE.top || tile === DRY_TREE.bottom) return 2;
  if (tile === BROADLEAF.topLeft || tile === BROADLEAF.topRight
    || tile === BROADLEAF.bottomLeft || tile === BROADLEAF.bottomRight) {
    return broadleafChain(map, x, y).length * 3 + 1; // 사슬 길이에 비례
  }
  return 1; // 덤불
}

function tileAt(map: GameMap, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return -1;
  return map.lowerTiles[y * map.width + x] ?? -1;
}

function setUpper(map: GameMap, x: number, y: number, tile: number): void {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
  map.upperTiles[y * map.width + x] = tile;
}
