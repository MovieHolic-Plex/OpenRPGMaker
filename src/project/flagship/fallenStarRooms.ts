/**
 * 『폴른 스타』 천문대 세 방(별빛 천문대 · 네 화로의 방 · 옛 별지기의 방)을 손 도트 실내 v5 로 다시 짓는다.
 *
 * 2026-10-21 사용자: 「이 방들은 적대적 VQA 를 아예 안 거친 것 같다. 엉망이다.」 — 장 구성기가 지은 방 위에 패딩·소품 덧칠을
 * 겹친 예전 판은 방 전체가 판정된 적이 없었다(독립 Opus VQA r1: 4.0 / 4.0 / 3.5, major 22). 덧칠을 걷고
 * 세 방을 같은 칩셋(atlas_biome_interior)·같은 천장(dark)으로 평면부터 다시 짓고, 이벤트 자리를 여기서 정한다.
 * - 천문대: 관측 홀(큰 굴절 망원경 + 지붕까지 트인 관측 틈), 칸막이 아래 서고·현관 홀·천문대장 서재. 지하로 가는 길은 서고 바닥의 별 봉인 돌뚜껑(열쇠로 열면 돌계단).
 * - 네 화로의 방: 북벽 쇠창살 문(풀면 열린다), 가운데 돌 단의 화로 넷과 두 룬 비석, 남쪽 불씨 사당, 양옆 벽감(서 땔감·물통·기름, 동 천문대로 오르는 돌 계단·기록대·수호상).
 *   화로는 버들항 돌 화로를 두 칸 폭으로 키운 큰 돌 화로(great stone brazier, 꺼짐)로 시작하고 퍼즐 이벤트가 켜짐(great stone brazier lit, 불꽃 1줄 위)/꺼짐을 바꿔 낀다.
 * - 옛 별지기의 방: 북쪽 렌즈 성소(별 렌즈 · 발렌이 북서 돌 계단에서 걸어 나온다), 가운데 홀과 곁방, 남쪽 들어오는 곁방.
 * 좌표는 모두 지어진 맵 기준이다(평면 첫 줄 = 맵 0줄). fallen-audit·fallen-rooms 시나리오가 같은 좌표를 쓴다.
 */
import { markFallenRoomRebuilt } from "./fallenRoomOwnership";
import type { Command, EventPage, GameEvent, GameMap, Project } from "@/project/types";

type Exec = (project: Project, name: string, args: Record<string, unknown>) => void;
type Dir = "up" | "down" | "left" | "right";
type Cell = { x: number; y: number };
export type RoomSpec = {
  plan: string[];
  floor: string;
  wall: string;
  ceiling: string;
  zones?: Array<Record<string, unknown>>;
  objects: Array<{ id: string; x: number; y: number }>;
  lines?: Array<Record<string, unknown>>;
  daises?: Array<{ id: string; x: number; y: number; w: number; h: number }>;
  goods?: Array<{ id: string; x: number; y: number }>;
};

const TILESET = "atlas_biome_interior";
const KIT = (name: string): string => `kit:${TILESET}/hand-interior:${name}`;

/** 렌즈 발밑 왼쪽 위(4×2) 와 결전 자리. stageBossVictory 는 렌즈 칸에 별빛, 렌즈 아래 3칸(= 보스 자리)에 연기를 띄운다. */
export const FS_VAULT_LENS: Cell = { x: 15, y: 5 };
export const FS_VAULT_BOSS: Cell = { x: 15, y: 8 };
/** 발렌이 걸어 나오는 칸 — 성소 북서 별지기 책장 앞(VQA r21: 이어지지 않는 돌 계단은 출구로 읽혀 뺐다). */
export const FS_VALEN_START: Cell = { x: 3, y: 5 };
/** 푸른 별빛 결정(세이브 수정 킷 발밑) — fallen-audit save-crystal 단계와 같이 바꾼다. */
export const FS_VAULT_CRYSTAL: Cell = { x: 10, y: 16 };

/** 별빛 천문대(32×23) — 오프닝 op3 처럼 둥근 지붕 큰 방: 계단식으로 둥글린 벽 위 천장 띠 전체를 한 장짜리 둥근 지붕(dome vault, 30×8)이
 * 덮는다 — 돌 고리·곡선 처마 위로 돌 줄이 꼭대기로 어두워지며 솟고 갈빗대 넷이 모이며, 가운데 경선의 관측 틈이 북벽 dome slit tall 로 이어진다.
 * 그래서 북쪽에 막힌 줄 셋을 더 둔다(지붕 띠 높이). 막힌 줄만 있는 여백은 짓기 도구가 잘라 내므로 구역(zones) 하나가 y=1 을 붙잡는다.
 * 큰 망원경(5×6, 둥근 받침)이 관측 틈(x15~16)을 겨누고 접안경 옆에 관측 발판, 벽을 따라 서가·기기 선반, 서쪽 = 성도 제도대, 동쪽 = 관측 기록 책상.
 * 아치 틈 아래 칸막이 세 방: 서고(서, 봉인석 사이 별 봉인 돌뚜껑)·현관 홀(가운데, 접수대·흉상, 거리 문으로 좁아지는 입구)·천문대장 서재(동, 벽난로).
 * VQA r3: 30×17 은 테두리가 다 보여 허공 27% → 32×19. VQA r4: 네모 방 → 앱스. 조정자: op3 와 맞게 둥근 지붕 홀(32×22).
 * VQA r8: 갈빗대·천장 조각이 계단식 벽 위 말뚝으로 읽혀 지붕이 안 보였다 → 천장 띠 한 장 그림(32×25).
 * VQA r9: 빈 바닥이 많다 → 큰 방 남쪽 앞마당 줄·아래 세 방 맨 아랫줄을 걷어 32×23, 현관 열주·서재 탁자로 채움.
 * VQA r11: 접안경 앞 관측 의자, 빈 동쪽 가운데에 지구의, 제도대·기록대·서재·서고 깔개; 같은 망원경·책 더미 중복은 뺐다.
 * VQA r12: 홀 남쪽 가장자리도 북쪽처럼 계단식으로 둥글리고, 바닥 가운데 떠 있던 책상·도표대·모래시계는 깔개 위 책상 둘로 묶었다. */
const OBS_ROOM: RoomSpec = {
  plan: [
    "################################",
    "################################",
    "################################",
    "################################",
    "#############......#############",
    "##########............##########",
    "#######..................#######",
    "####........................####",
    "#..............................#",
    "#..............................#",
    "##............................##",
    "###..........................###",
    "######....................######",
    "##########............##########",
    "###############.################",
    "#........#............#........#",
    "#........#............#........#",
    "#........#............#........#",
    "#........#............#........#",
    "#..............................#",
    "#..............................#",
    "########.......................#",
    "###############.################",
  ],
  floor: "plank",
  wall: "stone",
  ceiling: "dark",
  zones: [
    {x0: 1, y0: 1, x1: 30, y1: 13, floor: "plank", wall: "stone"},
  ],
  objects: [
    {id: "great telescope", x: 10, y: 10},
    {id: "wall sconce", x: 13, y: 4},
    {id: "wall sconce", x: 18, y: 4},
    {id: "celestial chart", x: 20, y: 5},
    {id: "bookshelf 2w", x: 5, y: 9},
    {id: "bookshelf 2w", x: 8, y: 8},
    {id: "cabinet:book+bookb+bookg", x: 11, y: 7},
    {id: "map rolls", x: 20, y: 7},
    {id: "scroll rack", x: 22, y: 8},
    {id: "bookshelf 2w", x: 25, y: 9},
    {id: "wall sconce", x: 28, y: 8},
    {id: "wall sconce", x: 5, y: 7},
    {id: "wall sconce", x: 26, y: 7},
    {id: "chart table", x: 6, y: 11},
    {id: "orrery", x: 9, y: 11},
    {id: "chart table", x: 18, y: 10},
    {id: "globe", x: 21, y: 10},
    {id: "stool", x: 9, y: 10},
    {id: "chart table", x: 12, y: 13},
    {id: "orrery", x: 22, y: 10},
    {id: "desk 2x1", x: 24, y: 11},
    {id: "chair N", x: 25, y: 12},
    {id: "catalog drawers", x: 3, y: 17},
    {id: "scroll rack", x: 4, y: 17},
    {id: "bookshelf 3w", x: 5, y: 17},
    {id: "library ladder", x: 8, y: 17},
    {id: "bookshelf 2w", x: 1, y: 17},
    {id: "seal stone", x: 2, y: 19},
    {id: "star seal", x: 3, y: 19},
    {id: "seal stone", x: 5, y: 19},
    {id: "map case", x: 6, y: 20},
    {id: "notice board", x: 11, y: 15},
    {id: "round arch", x: 14, y: 15},
    {id: "star chart", x: 19, y: 15},
    {id: "potted fern", x: 10, y: 17},
    {id: "marble bust", x: 11, y: 17},
    {id: "marble bust", x: 20, y: 17},
    {id: "potted fern", x: 21, y: 17},
    {id: "inn reception", x: 18, y: 19},
    {id: "lectern", x: 12, y: 19},
    {id: "bench 3", x: 11, y: 21},
    {id: "bench 3", x: 18, y: 21},
    {id: "column marble", x: 13, y: 18},
    {id: "column marble", x: 17, y: 18},
    {id: "potted fern", x: 14, y: 21},
    {id: "potted fern", x: 16, y: 21},
    {id: "banner blue", x: 12, y: 15},
    {id: "banner blue", x: 18, y: 15},
    {id: "bookshelf 2w", x: 23, y: 17},
    {id: "cabinet:book+bookb+bookg", x: 25, y: 17},
    {id: "fireplace", x: 26, y: 17},
    {id: "map rolls", x: 28, y: 17},
    {id: "armchair", x: 23, y: 19},
    {id: "desk 3x2", x: 27, y: 19},
    {id: "chair N", x: 28, y: 21},
    {id: "globe", x: 29, y: 17},
  ],
  lines: [
    {id: "rug blue", rect: {"x0": 6, "y0": 11, "x1": 9, "y1": 12}},
    {id: "rug brown", rect: {"x0": 21, "y0": 10, "x1": 25, "y1": 12}},
    {id: "rug red", rect: {"x0": 16, "y0": 10, "x1": 19, "y1": 12}},
    {id: "rug red", rect: {"x0": 11, "y0": 13, "x1": 14, "y1": 13}},
    {id: "rug red", rect: {"x0": 23, "y0": 19, "x1": 25, "y1": 21}},
    {id: "rug blue", rect: {"x0": 15, "y0": 16, "x1": 15, "y1": 21}},
  ],
  goods: [
    {id: "papers", x: 18, y: 10},
    {id: "candlestick", x: 19, y: 10},
    {id: "papers", x: 24, y: 11},
    {id: "candlestick", x: 25, y: 11},
    {id: "papers", x: 27, y: 19},
    {id: "openbook", x: 28, y: 19},
    {id: "candlestick", x: 29, y: 19},
    {id: "quill", x: 27, y: 20},
    {id: "inkwell", x: 29, y: 20},
  ],
};

/** 네 화로의 방(32×18) — 본당: 북벽 쇠창살 문(풀면 열린다)과 그 앞 붉은 깔개·사자 수호상·열주, 가운데 네 모서리의 큰 돌 화로(great stone brazier, 2칸)와 가운데 룬 비석 둘·별 원.
 * 남쪽 칸막이 뒤 불씨 사당(좌우 대칭: 켜진 큰 돌 화로 둘 = 화로에 옮길 불, 봉인석 둘, 별 그림 둘, 횃불 둘).
 * VQA r11: 빈 바닥 35% → 가운데·남쪽 벽감 바깥 두 줄(x1~2·x29~30)과 맨 아랫줄을 벽으로 메워 십자형 평면을 좁히고 벽감마다 깔개.
 * VQA r12: 돌 의자가 건초 더미·방석으로 읽혔다 → 나무 의자, 사당 아래 허공 줄을 뺐다(32×18).
 * 서쪽 = 정결(달빛 못·성수반·물 항아리) · 별돌(돌 구·룬 비석) · 봉헌 감실, 동쪽 = 천문대로 가는 돌 계단과 의식 기록. VQA r6: 장작·통·자루(식료품 창고·선술집으로 읽힘)는 뺐다.
 * 양옆 벽감 셋씩: 서 = 땔감 광·불 끄는 물통·기름 광, 동 = 천문대로 오르는 돌 계단·의식 기록대·수호상. VQA r4: 화로가 작은 검은 삼각대, 빈 바닥 30%, 남쪽 띠 용도 없음. */
const GATE_ROOM: RoomSpec = {
  plan: [
    "################################",
    "####.........................###",
    "####.........................###",
    "####.........................###",
    "####.........................###",
    "####.........................###",
    "####.........................###",
    "#########..............#########",
    "###............................#",
    "###............................#",
    "###............................#",
    "###............................#",
    "#########..............#########",
    "#.........#####..#####.........#",
    "#..............................#",
    "#..............................#",
    "#..............................#",
    "#########..............#########",
    "################################",
  ],
  floor: "flag",
  wall: "stone",
  ceiling: "dark",
  zones: [
    {x0: 9, y0: 1, x1: 22, y1: 17, floor: "grey"},
  ],
  // 밝은 돌 단(dais stone)은 뺐다 — 연한 바둑판 무늬가 투명 자리표시처럼 읽혔다(용의 전당·숲 사당 모자이크와 같은 지적).
  objects: [
    {id: "portcullis", x: 15, y: 1},
    {id: "wall torch", x: 13, y: 1},
    {id: "wall torch", x: 18, y: 1},
    {id: "star chart", x: 10, y: 1},
    {id: "star chart", x: 21, y: 1},
    {id: "lion statue", x: 13, y: 3},
    {id: "lion statue", x: 17, y: 3},
    {id: "column stone", x: 11, y: 4},
    {id: "column stone", x: 20, y: 4},
    {id: "paschal candle", x: 12, y: 5},
    {id: "paschal candle", x: 19, y: 5},
    {id: "column stone", x: 10, y: 8},
    {id: "column stone", x: 21, y: 8},
    {id: "column stone", x: 10, y: 11},
    {id: "column stone", x: 21, y: 11},
    {id: "great stone brazier", x: 12, y: 8},
    {id: "great stone brazier", x: 18, y: 8},
    {id: "great stone brazier", x: 12, y: 11},
    {id: "great stone brazier", x: 18, y: 11},
    {id: "rune stone", x: 15, y: 9},
    {id: "rune stone", x: 16, y: 9},
    {id: "paschal candle", x: 11, y: 9},
    {id: "paschal candle", x: 20, y: 9},
    {id: "great stone brazier lit", x: 11, y: 16},
    {id: "great stone brazier lit", x: 19, y: 16},
    {id: "seal stone", x: 13, y: 16},
    {id: "seal stone", x: 18, y: 16},
    {id: "wall torch", x: 14, y: 14},
    {id: "wall torch", x: 17, y: 14},
    {id: "wall torch", x: 5, y: 1},
    {id: "moon pool", x: 4, y: 5},
    {id: "bench 2", x: 7, y: 6},
    {id: "baptismal font", x: 8, y: 3},
    {id: "water jar", x: 4, y: 3},
    {id: "water jar", x: 5, y: 3},
    {id: "star chart", x: 4, y: 8},
    {id: "celestial chart", x: 6, y: 8},
    {id: "mana crystal", x: 3, y: 10},
    {id: "geode stand", x: 4, y: 10},
    {id: "plinth fossil", x: 5, y: 10},
    {id: "lectern", x: 7, y: 10},
    {id: "wall torch", x: 2, y: 13},
    {id: "celestial chart", x: 4, y: 13},
    {id: "seal stone", x: 2, y: 15},
    {id: "paschal candle", x: 3, y: 15},
    {id: "altar", x: 4, y: 15},
    {id: "paschal candle", x: 6, y: 15},
    {id: "seal stone", x: 7, y: 15},
    {id: "stairs up stone", x: 25, y: 3},
    {id: "wall torch", x: 22, y: 1},
    {id: "statue", x: 23, y: 3},
    {id: "statue", x: 28, y: 3},
    {id: "bench 2", x: 23, y: 6},
    {id: "bench 2", x: 27, y: 6},
    {id: "tapestry", x: 27, y: 8},
    {id: "cabinet:book+bookb+bookg", x: 23, y: 10},
    {id: "catalog drawers", x: 25, y: 10},
    {id: "scroll rack", x: 26, y: 10},
    {id: "lectern", x: 28, y: 10},
    {id: "bookshelf 2w", x: 29, y: 10},
    {id: "statue", x: 23, y: 15},
    {id: "plinth amphora", x: 24, y: 15},
    {id: "relic cabinet", x: 25, y: 15},
    {id: "plinth amphora", x: 26, y: 15},
    {id: "relic cabinet", x: 27, y: 15},
    {id: "plinth fossil", x: 28, y: 15},
    {id: "relic cabinet", x: 29, y: 15},
    {id: "statue", x: 30, y: 15},
  ],
  lines: [
    {id: "rug royal", rect: {"x0": 13, "y0": 4, "x1": 18, "y1": 6}},
    {id: "rug blue", rect: {"x0": 15, "y0": 13, "x1": 16, "y1": 17}},
    {id: "rug blue", rect: {"x0": 25, "y0": 4, "x1": 27, "y1": 5}},
    {id: "rug purple", rect: {"x0": 2, "y0": 16, "x1": 7, "y1": 16}},
  ],
  goods: [
    {id: "candlestick", x: 4, y: 15},
    {id: "candlestick", x: 5, y: 15},
  ],
};

/** 옛 별지기의 방(32×27) — VQA r11: 빈 바닥 33% → 성소 남쪽 줄·곁방 바깥 줄(x1·x30)·남쪽 곁방 맨 아랫줄을 벽으로 메우고 렌즈 앞 붉은 깔개, 회중석 대신 나무 의자.
 * VQA r12: 의자·촛대·결정 겹침을 풀고 식당은 긴 식탁 + 긴 의자.
 * 북: 렌즈 성소(룬 벽, 두 열주 사이 돌 단 위 별 렌즈, 북서 돌 계단으로 발렌이 내려온다, 서 = 별 비추는 못, 동 = 별 원), 가운데: 홀과 두 곁방(서 납골실·동 별지기 서고),
 * 남: 들어오는 곁방(서 = 렌즈 깎는 공방, 동 = 별지기 식당, 문 양옆 화로). 남쪽 가운데 문. VQA r4: 빈 바닥 35~40%, 같은 소품 좌우 복사 → 곁방마다 다른 용도. */
const VAULT_ROOM: RoomSpec = {
  plan: [
    "################################",
    "######....................######",
    "#..............................#",
    "#..............................#",
    "#..............................#",
    "#..............................#",
    "#..............................#",
    "#..............................#",
    "#..............................#",
    "#..............................#",
    "###############..###############",
    "###############..###############",
    "#.......#..............#.......#",
    "#.......#..............#.......#",
    "#.......#..............#.......#",
    "#.......#..............#.......#",
    "#..............................#",
    "#..............................#",
    "#######...................######",
    "#############......#############",
    "#####......................#####",
    "#####......................#####",
    "#####......................#####",
    "#####......................#####",
    "#####......................#####",
    "#############......#############",
    "###############.################",
  ],
  floor: "flag",
  wall: "stone",
  ceiling: "dark",
  zones: [
    {x0: 1, y0: 1, x1: 30, y1: 10, floor: "grey", wall: "stone"},
  ],
  // 밝은 돌 단(dais stone)은 뺐다 — 연한 바둑판 무늬가 투명 자리표시처럼 읽혔다(용의 전당·숲 사당 모자이크와 같은 지적).
  objects: [
    {id: "bookshelf 2w", x: 2, y: 4},
    {id: "relic cabinet", x: 4, y: 4},
    {id: "wall torch", x: 5, y: 2},
    {id: "wall torch", x: 28, y: 2},
    {id: "celestial chart", x: 9, y: 1},
    {id: "star chart", x: 12, y: 1},
    {id: "star chart", x: 19, y: 1},
    {id: "celestial chart", x: 21, y: 1},
    {id: "star lens", x: 14, y: 5},
    {id: "paschal candle", x: 12, y: 6},
    {id: "paschal candle", x: 19, y: 6},
    {id: "column stone", x: 9, y: 4},
    {id: "column stone", x: 9, y: 7},
    {id: "column stone", x: 22, y: 4},
    {id: "column stone", x: 22, y: 7},
    {id: "paschal candle", x: 11, y: 3},
    {id: "paschal candle", x: 20, y: 3},
    {id: "relic cabinet", x: 6, y: 3},
    {id: "geode stand", x: 8, y: 3},
    {id: "case scroll", x: 6, y: 5},
    {id: "healing spring", x: 4, y: 8},
    {id: "lectern", x: 6, y: 8},
    {id: "paschal candle", x: 3, y: 8},
    {id: "relic cabinet", x: 23, y: 3},
    {id: "plinth amphora", x: 24, y: 5},
    {id: "plinth helmet", x: 25, y: 5},
    {id: "statue", x: 27, y: 4},
    {id: "relic cabinet", x: 29, y: 4},
    {id: "plinth fossil", x: 27, y: 6},
    {id: "paschal candle", x: 25, y: 7},
    {id: "paschal candle", x: 28, y: 7},
    {id: "wall torch", x: 12, y: 12},
    {id: "wall torch", x: 19, y: 12},
    {id: "banner blue", x: 10, y: 12},
    {id: "banner blue", x: 13, y: 12},
    {id: "banner blue", x: 18, y: 12},
    {id: "wall torch", x: 21, y: 12},
    {id: "stone brazier lit", x: 11, y: 14},
    {id: "stone brazier lit", x: 20, y: 14},
    {id: "save crystal", x: 10, y: 16},
    {id: "column stone", x: 12, y: 15},
    {id: "column stone", x: 12, y: 18},
    {id: "column stone", x: 19, y: 15},
    {id: "column stone", x: 19, y: 18},
    {id: "bench 2", x: 13, y: 15},
    {id: "bench 2", x: 17, y: 15},
    {id: "bench 2", x: 13, y: 17},
    {id: "bench 2", x: 17, y: 17},
    {id: "candle", x: 1, y: 14},
    {id: "sarcophagus", x: 2, y: 14},
    {id: "sarcophagus", x: 5, y: 14},
    {id: "candle", x: 4, y: 14},
    {id: "grave bouquet", x: 7, y: 14},
    {id: "sarcophagus", x: 2, y: 16},
    {id: "sarcophagus", x: 5, y: 16},
    {id: "candle", x: 7, y: 16},
    {id: "grave bouquet", x: 1, y: 16},
    {id: "star chart", x: 27, y: 12},
    {id: "relic cabinet", x: 24, y: 14},
    {id: "bookshelf 2w", x: 25, y: 14},
    {id: "bookshelf 2w", x: 27, y: 14},
    {id: "relic cabinet", x: 29, y: 14},
    {id: "scroll rack", x: 30, y: 14},
    {id: "case scroll", x: 24, y: 16},
    {id: "desk 3x1", x: 27, y: 16},
    {id: "chair N", x: 28, y: 17},
    {id: "tool wall", x: 6, y: 20},
    {id: "celestial chart", x: 9, y: 20},
    {id: "wall torch", x: 12, y: 20},
    {id: "apothecary drawers", x: 5, y: 22},
    {id: "alchemy table", x: 11, y: 22},
    {id: "lens bench", x: 7, y: 23},
    {id: "stool", x: 6, y: 24},
    {id: "grindstone", x: 11, y: 24},
    {id: "mana crystal", x: 12, y: 24},
    {id: "dish rack", x: 19, y: 20},
    {id: "wall torch", x: 21, y: 20},
    {id: "pot rack", x: 22, y: 20},
    {id: "cupboard", x: 19, y: 22},
    {id: "sideboard 2x1", x: 20, y: 22},
    {id: "bread oven", x: 25, y: 22},
    {id: "water jar", x: 26, y: 23},
    {id: "dining 3x1", x: 21, y: 23},
    {id: "chair E", x: 20, y: 23},
    {id: "barrel", x: 26, y: 24},
    {id: "rune stone", x: 13, y: 22},
    {id: "rune stone", x: 18, y: 22},
    {id: "stone brazier lit", x: 14, y: 25},
    {id: "stone brazier lit", x: 17, y: 25},
  ],
  lines: [
    {id: "rug royal", rect: {"x0": 11, "y0": 8, "x1": 20, "y1": 9}},
    {id: "rug blue", rect: {"x0": 15, "y0": 10, "x1": 16, "y1": 25}},
    {id: "rug purple", rect: {"x0": 3, "y0": 7, "x1": 7, "y1": 9}},
    // 별 봉인 2×2 (26,7) 은 깔개와 겹치면 stamp 가 거부한다. 봉인 칸만 맨바닥으로 남긴다.
    {id: "rug purple", rect: {"x0": 23, "y0": 7, "x1": 25, "y1": 8}},
    {id: "rug purple", rect: {"x0": 28, "y0": 7, "x1": 29, "y1": 8}},
  ],
  goods: [
    {id: "openbook", x: 27, y: 16},
    {id: "scroll", x: 28, y: 16},
    {id: "candlestick", x: 29, y: 16},
    {id: "plate", x: 21, y: 23},
    {id: "pitcher", x: 22, y: 23},
    {id: "cup", x: 23, y: 23},
  ],
};

/** 네 화로(퍼즐 프리셋 순서: 0 북서 · 1 북동 · 2 남서 · 3 남동)의 발밑 왼쪽 칸. 큰 돌 화로는 2칸 폭 — 꺼짐은 발밑 + 위 1줄, 켜짐은 위 2줄(불꽃).
 * 방 VQA r8~r11: 1칸 버들항 돌 화로는 1배에서 사발 속이 2~3px 라 꺼졌을 때 검은 말뚝으로 읽혔다. 이벤트는 오른쪽 칸에도 복제한다(어느 칸에서 말 걸어도 켠다). */
/** 세 방 평면(코딩 에이전트 28바퀴 합격 판) — 조수 실내 빈 바닥 측정의 보정 기준으로도 읽는다(scripts/qa/interior-bare-floor-calibrate.mts). */
export const FALLEN_ROOM_SPECS: Readonly<Record<"observatory" | "gate" | "vault", Readonly<RoomSpec>>> = { observatory: OBS_ROOM, gate: GATE_ROOM, vault: VAULT_ROOM };

const BRAZIERS: readonly Cell[] = [{ x: 12, y: 8 }, { x: 18, y: 8 }, { x: 12, y: 11 }, { x: 18, y: 11 }];
const BRAZIER_W = 2;
const PORTCULLIS: Cell = { x: 15, y: 1 };          // 2×2, 벽면 두 줄
const PORTCULLIS_OPEN = [7116, 7117, 7118, 7119];
const GATE_STAIRS: readonly Cell[] = [{ x: 25, y: 3 }, { x: 26, y: 3 }, { x: 27, y: 3 }];   // 돌 계단 밟는 줄(천문대로)
const OBS_STAIRS: readonly Cell[] = [{ x: 3, y: 19 }, { x: 4, y: 19 }, { x: 3, y: 20 }, { x: 4, y: 20 }];   // 별 봉인 돌뚜껑 2×2

export function kitTile(project: Project, name: string, dx = 0, dy = 0): number {
  const kit = project.tilesets[TILESET]?.structureKits?.find((k) => k.id === `hand-interior:${name}`);
  const row = kit?.rows?.[dy] as { upperTiles?: number[] } | undefined;
  const tile = row?.upperTiles?.[dx];
  if (typeof tile !== "number" || tile < 0) throw new Error(`[fallen-star] 킷 ${name} 이 시트에 없다 — interior-plus fallen 조각을 굽는다(bake.py)`);
  return tile;
}

/** 이벤트 명령 나무 안의 모든 명령 배열(선택지·분기 안쪽까지). */
function commandLists(node: unknown, out: Command[][] = []): Command[][] {
  if (Array.isArray(node)) {
    if (node.length && node.every((c) => c && typeof c === "object" && typeof (c as { kind?: unknown }).kind === "string")) out.push(node as Command[]);
    for (const item of node) commandLists(item, out);
  } else if (node && typeof node === "object") {
    for (const value of Object.values(node)) if (value && typeof value === "object") commandLists(value, out);
  }
  return out;
}

const transfersIn = (event: GameEvent): Array<Record<string, unknown>> =>
  commandLists([event.commands, event.pages]).flat().filter((c) => c.kind === "transfer") as unknown as Array<Record<string, unknown>>;

function pointTransfers(map: GameMap, toMapId: string, to: Cell & { direction: Dir }): void {
  for (const event of map.events) for (const rec of transfersIn(event)) {
    if (rec.mapId === toMapId) Object.assign(rec, { x: to.x, y: to.y, direction: to.direction });
  }
}

const quietPage = (id: string, name: string, conditions: EventPage["conditions"], trigger: "action" | "playerTouch", commands: Command[], priority: "below" | "same" = "below"): EventPage => ({
  id, name, conditions, graphic: { transparent: true }, trigger: { kind: trigger }, priority, overlapForbidden: false,
  movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
} as unknown as EventPage);

function touchDoor(id: string, at: Cell, to: { mapId: string } & Cell & { direction: Dir }, conditions: EventPage["conditions"] = []): GameEvent {
  return {
    id, name: "출입구", x: at.x, y: at.y, trigger: { kind: "playerTouch" }, commands: [],
    pages: [quietPage(`${id}_p`, "출입구", conditions, "playerTouch", [{ kind: "transfer", ...to, fade: "black" } as unknown as Command])],
  } as unknown as GameEvent;
}

export function build(project: Project, exec: Exec, mapId: string, spec: RoomSpec): GameMap {
  const before = project.maps[mapId];
  if (!before) throw new Error(`[fallen-star] 맵 ${mapId} 이 없다`);
  // 옛 지하 묘소는 버들항 칩셋이었다 — 같은 실내 칩셋으로 바꿔 다시 짓는다(도구는 같은 칩셋 맵만 replace 한다).
  before.tilesetId = TILESET;
  exec(project, "build_hand_interior_room", { ...spec, plan: [...spec.plan], mapId, name: before.name, tileset: TILESET, replace: true });
  const map = project.maps[mapId]!;
  // 장 구성기가 남긴 먼지 입자는 방 바깥 허공을 별밭처럼 보이게 했다(VQA r1). 옛 평면의 구역 이름표·밝기도 걷는다.
  delete (map as Partial<GameMap>).atmosphereEffects;
  delete (map as Partial<GameMap>).locations;
  delete (map as { defaultLighting?: unknown }).defaultLighting;
  return map;
}


/** 불빛 가구마다 빛 웅덩이(VQA r2: 불은 켜져 있는데 방이 고르게 밝다). 벽 횃불·걸이 등은 한 칸 아래 바닥을 비춘다. */
// 벽 횃불은 작고 흐리게 — 크게 겹친 웅덩이가 지하에서 햇살 줄기처럼 읽혔다(VQA r7).
const LIGHTS: Record<string, { radius: number; dy: number; w?: number; flicker?: boolean; color?: string; intensity?: number }> = {
  "wall torch": { radius: 1.8, dy: 1, flicker: true, intensity: 0.55 },   // VQA r16: 겹친 웅덩이가 모난 빛 덩이로 읽혔다
  "brazier": { radius: 2.8, dy: 0, flicker: true },
  "lava brazier": { radius: 2.6, dy: 0, flicker: true },
  "stone brazier lit": { radius: 2.8, dy: 0, flicker: true },
  "great stone brazier lit": { radius: 3.8, dy: 0, w: 2, flicker: true, intensity: 1.2 },   // 2칸 폭 — 칸마다 빛 하나(조명 좌표는 정수 칸, VQA r15: 사당 불빛이 약했다)
  "wall sconce": { radius: 1.6, dy: 1, flicker: true },
  "votive stand": { radius: 1.3, dy: 0, flicker: true },
  "fireplace": { radius: 3.2, dy: 1, flicker: true },
  "paschal candle": { radius: 1.8, dy: 0, flicker: true },
  "candle": { radius: 1.4, dy: 0, flicker: true },
};
export function lightRoom(project: Project, exec: Exec, mapId: string, spec: RoomSpec, ambient: number, color: string, extra: Array<Cell & { radius: number; color: string; intensity?: number }> = []): void {
  const sources: Array<Record<string, unknown>> = [];
  spec.objects.forEach((o, i) => {
    const l = LIGHTS[o.id];
    if (!l) return;
    for (let dx = 0; dx < (l.w ?? 1); dx += 1) {
      sources.push({ id: `l${i}${dx ? `_${dx}` : ""}`, at: { x: o.x + dx, y: o.y + l.dy }, radius: l.radius, intensity: l.intensity ?? 0.9, color: l.color ?? "#ffcf8a", ...(l.flicker ? { flicker: true } : {}) });
    }
  });
  extra.forEach((e, i) => sources.push({ id: `x${i}`, at: { x: e.x, y: e.y }, radius: e.radius, intensity: e.intensity ?? 0.8, color: e.color }));
  exec(project, "set_lighting_volume", { mapId, ambient, color, sources, applyMode: "map" });
}

function place(map: GameMap, id: string, at: Cell): GameEvent {
  const event = map.events.find((e) => e.id === id);
  if (!event) throw new Error(`[fallen-star] ${map.id} 에 이벤트 ${id} 가 없다`);
  event.x = at.x; event.y = at.y;
  return event;
}

/** 이벤트를 다른 칸에 복제한다(넓은 계단·두 비석처럼 칸이 여럿인 것). */
function cloneAt(map: GameMap, source: GameEvent, suffix: string, at: Cell): void {
  const copy = JSON.parse(JSON.stringify(source)) as GameEvent;
  copy.id = `${source.id}_${suffix}`;
  for (const page of copy.pages ?? []) page.id = `${page.id}_${suffix}`;
  copy.x = at.x; copy.y = at.y;
  map.events = map.events.filter((e) => e.id !== copy.id);
  map.events.push(copy);
}

/**
 * 퍼즐 프리셋의 changeTile 을 새 방 그림에 맞춘다. 프리셋은 화로 칸 한 칸의 네 층을 바꾸고 「불 꺼짐」 갈래는 다른 좌표를 가리켰다
 * (예전 판: 패딩이 두 번 더해져 방 밖 허공을 칠함). 화로 스위치를 켜고 끄는 명령 바로 뒤의 changeTile 줄을 그 화로의 켜짐/꺼짐 두 칸으로
 * 바꾸고, 그 밖의 changeTile(풀었을 때 바닥이 열리는 줄)은 쇠창살 문 열림으로 바꾼다.
 */
function rewirePuzzleTiles(project: Project, gate: GameMap): void {
  // 큰 돌 화로 2칸 폭 × 3줄(y-2·y-1·y). 꺼짐 킷은 2줄이라 맨 윗줄(불꽃 줄)을 비운다.
  const cold = [0, 1].map((dy) => [0, 1].map((dx) => kitTile(project, "great stone brazier", dx, dy)));
  const lit = [0, 1, 2].map((dy) => [0, 1].map((dx) => kitTile(project, "great stone brazier lit", dx, dy)));
  const tile = (x: number, y: number, t: number): Command => ({ kind: "changeTile", mapId: gate.id, layer: "upper", x, y, tile: t } as unknown as Command);
  const litOrCold = (n: number, on: boolean): Command[] => {
    const b = BRAZIERS[n]!;
    const out: Command[] = [];
    for (let row = 0; row < 3; row += 1) for (let dx = 0; dx < BRAZIER_W; dx += 1) {
      out.push(tile(b.x + dx, b.y - 2 + row, on ? lit[row]![dx]! : row === 0 ? -1 : cold[row - 1]![dx]!));
    }
    return out;
  };
  const openGate = (): Command[] => {
    const floor = gate.lowerTiles[(PORTCULLIS.y + 2) * gate.width + PORTCULLIS.x]!;
    const out: Command[] = [];
    for (let dy = 0; dy < 2; dy += 1) for (let dx = 0; dx < 2; dx += 1) {
      const x = PORTCULLIS.x + dx, y = PORTCULLIS.y + dy;
      // 벽면 칸을 바닥으로 바꿔야 걸어 들어간다(통행은 아래 층이 정한다). 그림은 열린 창살이 덮는다.
      out.push({ kind: "changeTile", mapId: gate.id, layer: "lower", x, y, tile: floor } as unknown as Command);
      out.push(tile(x, y, PORTCULLIS_OPEN[dy * 2 + dx]!));
    }
    return out;
  };
  let opened = 0;
  for (const event of gate.events) for (const list of commandLists([event.commands, event.pages])) {
    let brazier = -1, lit = false, openedHere = false;
    for (let i = 0; i < list.length; i += 1) {
      const c = list[i] as unknown as Record<string, unknown>;
      const sw = c.kind === "setSwitch" ? /^sw_fs_braziers_brazier_(\d)_lit$/u.exec(String(c.switchId)) : null;
      if (sw) { brazier = Number(sw[1]); lit = c.value === true; continue; }
      if (c.kind === "changeTile") {
        let end = i; while ((list[end + 1] as { kind?: string } | undefined)?.kind === "changeTile") end += 1;
        const replacement = brazier >= 0 ? litOrCold(brazier, lit) : openedHere ? [] : openGate();
        if (brazier < 0) { openedHere = true; opened += 1; }
        list.splice(i, end - i + 1, ...replacement);
        i += replacement.length - 1;
        continue;
      }
      if (c.kind === "m2Command" && brazier >= 0) {
        const f = c.fields as Record<string, unknown> | undefined;
        if (f && typeof f.x === "number" && typeof f.y === "number") { f.x = BRAZIERS[brazier]!.x; f.y = BRAZIERS[brazier]!.y - 1; }
      }
      if (c.kind !== "playAudio" && c.kind !== "m2Command") brazier = -1;
    }
  }
  if (!opened) throw new Error("[fallen-star] 화로 퍼즐의 「풀림」 changeTile 을 찾지 못했다");
}

export function rebuildFallenRooms(project: Project, exec: Exec, ids: { hub: string; observatory: string; gate: string; vault: string }): void {
  const M = (id: string): GameMap => project.maps[id]!;

  // ── 짓기 ──
  // 세 방은 예전보다 작아진다 — 들어오는 이동이 옛 좌표(맵 밖)를 가리키면 도구 커밋이 무결성 오류로 거부한다.
  // 짓기 전에 모두 (1,1) 로 접어 두고, 아래에서 문 앞 칸으로 다시 정한다(광장 → 천문대는 chronoBell 의 land()).
  const rooms = new Set([ids.observatory, ids.gate, ids.vault]);
  // 마을 쪽 마감 패스(chronoBell: 둘레 덧대기·어둠·상인방·홀 꾸미기·바닥 통일·묘소 바위)가 다시 지은 세 방을 건너뛰게 표시한다.
  for (const id of rooms) markFallenRoomRebuilt(project, M(id).id);
  for (const map of Object.values(project.maps)) for (const event of map.events) for (const rec of transfersIn(event)) {
    if (rooms.has(String(rec.mapId))) { rec.x = 1; rec.y = 1; }
  }
  build(project, exec, ids.observatory, OBS_ROOM);
  exec(project, "stamp_object", { objectId: KIT("dome slit tall"), mapId: ids.observatory, x: 15, y: 3 });
  exec(project, "stamp_object", { objectId: KIT("dome vault"), mapId: ids.observatory, x: 1, y: 0 });
  build(project, exec, ids.gate, GATE_ROOM);
  exec(project, "stamp_object", { objectId: KIT("magic circle"), mapId: ids.gate, x: 15, y: 10 });   // 두 비석 앞 별 원
  build(project, exec, ids.vault, VAULT_ROOM);
  exec(project, "stamp_object", { objectId: KIT("star seal"), mapId: ids.vault, x: 26, y: 7 });   // 성소 동쪽 별 봉인(렌즈 빛이 열면 아래층 미궁으로)
  // 단(dais stone)과 그 앞 턱·계단(dais riser/steps stone)은 뺐다 — 바둑판 단이 투명 자리표시처럼 읽혔다.
  lightRoom(project, exec, ids.observatory, OBS_ROOM, 0.45, "#1c1830");
  // VQA r10: 0.55 는 꺼진 화로가 검은 기둥으로 묻혔다. VQA r16: 꺼진 화로가 빈 검은 항아리로 읽혔다 → 가운데 별 원의 옅은 빛이 장작을 비춘다.
  lightRoom(project, exec, ids.gate, GATE_ROOM, 0.72, "#141420", [{ x: 15, y: 9, radius: 4.2, color: "#c8d4ff", intensity: 0.5 }]);
  lightRoom(project, exec, ids.vault, VAULT_ROOM, 0.62, "#141c40", [{ x: 15, y: 5, radius: 4.5, color: "#a8d8f0" }, { x: 10, y: 15, radius: 2.5, color: "#88b3ca" }, { x: 27, y: 8, radius: 2.2, color: "#c8a8f0" }]);

  // ── 천문대 ──
  const obs = M(ids.observatory);
  const hubDoor = obs.events.find((e) => transfersIn(e).some((t) => t.mapId === ids.hub));
  if (!hubDoor) throw new Error("[fallen-star] 천문대 → 광장 문을 찾지 못했다");
  hubDoor.x = 15; hubDoor.y = 22;   // VQA r21: 남쪽 통로를 길게 빼면 아래층을 볼 때 화면 아래가 검은 허공이 됐다 — 한 칸 틈으로 둔다
  // 지하로 가는 길(장 구성기는 지하 묘소로 바로 이었다) → 네 화로의 방 북벽 돌 계단 앞으로.
  const hatch = obs.events.find((e) => transfersIn(e).some((t) => t.mapId === ids.vault || t.mapId === ids.gate));
  if (!hatch) throw new Error("[fallen-star] 천문대 지하 입구를 찾지 못했다");
  for (const rec of transfersIn(hatch)) if (rec.mapId === ids.vault || rec.mapId === ids.gate) Object.assign(rec, { mapId: ids.gate, x: 26, y: 4, direction: "down" });
  // 별빛 열쇠로 여는 갈래 끝에 돌뚜껑(star seal) → 열린 돌계단(star seal open) 바꿔 끼기를 붙인다(세션 덮어쓰기라 다시 들어와도 열려 있다).
  const sealOpen = [kitTile(project, "star seal open", 0, 0), kitTile(project, "star seal open", 1, 0), kitTile(project, "star seal open", 0, 1), kitTile(project, "star seal open", 1, 1)];
  let swapped = 0;
  for (const page of hatch.pages ?? []) for (const list of commandLists(page.commands)) for (const c of list) {
    const fork = c as unknown as { kind: string; condition?: { kind?: string }; then?: Command[] };
    if (fork.kind !== "fork" || fork.condition?.kind !== "item" || !Array.isArray(fork.then)) continue;
    OBS_STAIRS.forEach((cell, i) => fork.then!.push({ kind: "changeTile", mapId: obs.id, layer: "upper", x: cell.x, y: cell.y, tile: sealOpen[i]! } as unknown as Command));
    swapped += 1;
  }
  if (!swapped) throw new Error("[fallen-star] 별빛 열쇠 갈래(fork item)를 찾지 못했다 — 돌뚜껑을 열 수 없다");
  const [first, ...rest] = OBS_STAIRS;
  hatch.x = first!.x; hatch.y = first!.y;
  rest.forEach((cell, i) => cloneAt(obs, hatch, `s${i + 1}`, cell));
  place(obs, "ev_fs_hanel", { x: 24, y: 20 });   // 서재 벽난로 앞 깔개 서쪽(말 거는 자리 (24,21))
  const scope = place(obs, "ev_fs_scope", { x: 13, y: 11 });   // 망원경 받침 앞줄 가운데 — (13,12)에서 위를 보고 말 건다
  for (const page of scope.pages ?? []) page.priority = "same";

  // ── 네 화로의 방 ──
  const gate = M(ids.gate);
  const tablet = place(gate, "ev_fs_braziers_hint_tablet", { x: 15, y: 9 });
  cloneAt(gate, tablet, "r", { x: 16, y: 9 });
  BRAZIERS.forEach((b, n) => place(gate, `ev_fs_braziers_brazier_${n}`, b));
  rewirePuzzleTiles(project, gate);
  // 2칸 폭 화로 — 오른쪽 칸에도 같은 이벤트(전역 스위치·변수만 쓰므로 복제해도 상태가 하나다). 그림 바꾸기는 위에서 이미 2칸을 다룬다.
  BRAZIERS.forEach((b, n) => {
    const source = gate.events.find((e) => e.id === `ev_fs_braziers_brazier_${n}`)!;
    for (let dx = 1; dx < BRAZIER_W; dx += 1) cloneAt(gate, source, `r${dx}`, { x: b.x + dx, y: b.y });
  });
  const solved = { kind: "switch", switchId: "sw_puzzle_fs_braziers_solved", value: true } as const;
  gate.events = gate.events.filter((e) => !String(e.id).startsWith("ev_fs_vault_gate_"));
  GATE_STAIRS.forEach((cell, i) => gate.events.push(touchDoor(`ev_fs_vault_gate_up${i}`, cell, { mapId: ids.observatory, x: 3, y: 21, direction: "down" })));
  for (let dx = 0; dx < 2; dx += 1) {
    const x = PORTCULLIS.x + dx;
    gate.events.push(touchDoor(`ev_fs_vault_gate_in${dx}`, { x, y: PORTCULLIS.y }, { mapId: ids.vault, x: 15, y: 25, direction: "up" }));
    gate.events.push({
      id: `ev_fs_vault_gate_bars${dx}`, name: "쇠창살 문", x, y: PORTCULLIS.y + 1, trigger: { kind: "action" }, commands: [],
      pages: [
        quietPage(`ev_fs_vault_gate_bars${dx}_shut`, "닫힘", [], "action", [
          { kind: "text", body: "굵은 쇠창살이 바닥까지 내려와 있다.\n손으로는 꿈쩍도 하지 않는다." } as unknown as Command,
        ], "same"),
        quietPage(`ev_fs_vault_gate_bars${dx}_open`, "열림", [solved], "action", []),
      ],
    } as unknown as GameEvent);
  }

  // ── 옛 별지기의 방 ──
  const vault = M(ids.vault);
  const exit = vault.events.find((e) => transfersIn(e).some((t) => t.mapId === ids.observatory || t.mapId === ids.gate));
  if (!exit) throw new Error("[fallen-star] 옛 별지기의 방 출구를 찾지 못했다");
  exit.x = 15; exit.y = 26;
  // 착지는 쇠창살 문(15,1) 바로 앞 칸 — 한 칸 더 아래(15,3)면 돌아오는 문에서 두 칸 떨어져 내렸다(scene-transfer-pair). 퍼즐을 풀어야
  // 이 방에 오므로 (15,2) 창살 칸은 늘 열림 페이지(아래 층)다.
  for (const rec of transfersIn(exit)) if (rec.mapId === ids.observatory || rec.mapId === ids.gate) Object.assign(rec, { mapId: ids.gate, x: 15, y: 2, direction: "down" });
  const spots: Record<string, Cell> = {
    ev_fs_vault_foe1: { x: 23, y: 24 },   // 남쪽 곁방 식당 — 식탁 남쪽 줄(좌우로 두 칸씩 돈다). VQA r14: 홀 한가운데 늑대는 곁방 밖을 돌았다 · VQA r23: 빵 화덕 앞(27,23)은 화덕·물독과 겹쳐 보였다
    ev_fs_vault_foe2: { x: 5, y: 17 },    // 서쪽 납골실 — 석관 앞 트인 칸(석관 뒤에 숨지 않게). VQA r25: 18줄은 벽(남벽 계단)이라 허공에 떠 보였다
    ev_fs_vault_foe3: { x: 25, y: 18 },   // 동쪽 별지기 서고 — 책상 앞 줄(좌우로 두 칸씩 돈다). VQA r19: 책상 의자 칸에 겹쳐 서쪽으로 옮겼다
    ev_fs_vault_chest1: { x: 2, y: 17 },
    ev_fs_vault_chest2: { x: 29, y: 17 },
  };
  for (const [id, at] of Object.entries(spots)) if (vault.events.some((e) => e.id === id)) place(vault, id, at);
  const crystal = vault.events.find((e) => e.name === "푸른 별빛 결정");
  if (crystal) {
    crystal.x = FS_VAULT_CRYSTAL.x; crystal.y = FS_VAULT_CRYSTAL.y;
    // 그림은 세이브 수정 킷이 그린다 — 칩 그림을 겹치면 두 수정이 섰다.
    for (const page of crystal.pages ?? []) { page.graphic = { transparent: true } as EventPage["graphic"]; page.priority = "same"; }
  }
  vault.events = vault.events.filter((e) => e.id !== "ev_fs_vault_crystal_plate");
  const boss = vault.events.find((e) => (e.pages ?? []).some((p) => JSON.stringify(p.commands).includes("battleProcessing")) && e.id.includes("kill"));
  if (boss) { boss.x = FS_VAULT_BOSS.x; boss.y = FS_VAULT_BOSS.y; }

  // 별자리표(1×3) 맨 아래 칸은 액자 아랫테 한 줄뿐인데, 벽면이 두 줄이라 그 칸이 바닥에 놓여 액자가 바닥에 선 깃발처럼 읽혔다
  // (scene-hang-on-floor). 바닥 칸에 떨어진 아랫테 칸만 걷는다 — 액자 몸통 두 칸은 벽면에 그대로 남는다.
  {
    const chartFoot = kitTile(project, "star chart", 0, 2);
    const meta = (project.tilesets[TILESET] as unknown as { tileMeta?: ({ label?: string } | null)[] }).tileMeta ?? [];
    for (const id of rooms) {
      const map = M(id);
      for (const layer of [map.upperTiles, map.upperOverlayTiles]) {
        if (!layer) continue;
        for (let i = 0; i < layer.length; i += 1) if (layer[i] === chartFoot && (meta[map.lowerTiles[i]!]?.label ?? "").startsWith("바닥")) layer[i] = -1;
      }
    }
  }

  // 이 세 방 사이·광장에서 들어오는 이동 도착 칸(문 앞 첫 바닥, 문을 등진 방향).
  pointTransfers(M(ids.gate), ids.vault, { x: 15, y: 25, direction: "up" });
  pointTransfers(M(ids.vault), ids.gate, { x: 15, y: 2, direction: "down" });
  pointTransfers(M(ids.observatory), ids.gate, { x: 26, y: 4, direction: "down" });
  pointTransfers(M(ids.gate), ids.observatory, { x: 3, y: 21, direction: "down" });
}
