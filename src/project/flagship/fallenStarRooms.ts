/**
 * 『폴른 스타』 천문대 세 방(별빛 천문대 · 네 화로의 방 · 옛 별지기의 방)을 손 도트 실내 v5 로 다시 짓는다.
 *
 * 2026-10-21 사용자: 「이 방들은 적대적 VQA 를 아예 안 거친 것 같다. 엉망이다.」 — 장 구성기가 지은 방 위에 패딩·소품 덧칠을
 * 겹친 예전 판은 방 전체가 판정된 적이 없었다(독립 Opus VQA r1: 4.0 / 4.0 / 3.5, major 22). 덧칠을 걷고
 * 세 방을 같은 칩셋(atlas_biome_interior)·같은 천장(dark)으로 평면부터 다시 짓고, 이벤트 자리를 여기서 정한다.
 * - 천문대: 관측 홀(큰 굴절 망원경 + 지붕까지 트인 관측 틈), 칸막이 아래 서고·현관 홀·천문대장 서재. 지하로 가는 길은 서고 바닥의 별 봉인 돌뚜껑(열쇠로 열면 돌계단).
 * - 네 화로의 방: 북벽 쇠창살 문(풀면 열린다), 가운데 돌 단의 화로 넷과 두 룬 비석, 남쪽 불씨 사당, 양옆 벽감(서 땔감·물통·기름, 동 천문대로 오르는 돌 계단·기록대·수호상).
 *   화로는 큰 꺼진 화로(great brazier, 2칸 폭)로 시작하고 퍼즐 이벤트가 켜짐(great brazier lit, 위 2줄)/꺼짐을 바꿔 낀다.
 * - 옛 별지기의 방: 북쪽 렌즈 성소(별 렌즈 · 발렌이 북서 돌 계단에서 걸어 나온다), 가운데 홀과 곁방, 남쪽 들어오는 곁방.
 * 좌표는 모두 지어진 맵 기준이다(평면 첫 줄 = 맵 0줄). fallen-audit·fallen-rooms 시나리오가 같은 좌표를 쓴다.
 */
import type { Command, EventPage, GameEvent, GameMap, Project } from "@/project/types";

type Exec = (project: Project, name: string, args: Record<string, unknown>) => void;
type Dir = "up" | "down" | "left" | "right";
type Cell = { x: number; y: number };
type RoomSpec = {
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
/** 발렌이 걸어 나오는 칸 — 성소 북서 돌 계단(stairs up stone (2,4)) 발치. */
export const FS_VALEN_START: Cell = { x: 3, y: 5 };
/** 푸른 별빛 결정(세이브 수정 킷 발밑) — fallen-audit save-crystal 단계와 같이 바꾼다. */
export const FS_VAULT_CRYSTAL: Cell = { x: 10, y: 16 };

/** 별빛 천문대(32×19) — 위: 관측 홀(가운데 망원경 자리만 벽이 한 줄 더 깊은 앱스 — 대물렌즈가 지붕 관측 틈 바로 아래, 서쪽 칸 = 성도 제도대, 동쪽 칸 = 관측 기기대).
 * 아치 틈 아래 칸막이 세 방: 서고(서, 봉인석 사이 별 봉인 돌뚜껑)·현관 홀(가운데, 접수대·흉상, 거리 문으로 좁아지는 입구)·천문대장 서재(동, 벽난로).
 * VQA r3: 30×17 은 화면(30×16.9칸)에 테두리가 다 보여 허공 27% → 32×19. VQA r4: 모든 공간이 네모, 홀 양옆 소품이 빈 칸마다 흩어짐 → 앱스·좁은 입구, 용도별 묶음. */
const OBS_ROOM: RoomSpec = {
  plan: [
    "################################",
    "##########............##########",
    "#..............................#",
    "#..............................#",
    "#..............................#",
    "#..............................#",
    "#..............................#",
    "#..............................#",
    "#..............................#",
    "###############.################",
    "#........#............#........#",
    "#........#............#........#",
    "#........#............#........#",
    "#........#............#........#",
    "#........#............#........#",
    "#..............................#",
    "#..............................#",
    "#..........###....###..........#",
    "###############.################",
  ],
  floor: "plank",
  wall: "stone",
  ceiling: "dark",
  objects: [
    {id: "great telescope", x: 13, y: 6},
    {id: "star chart", x: 10, y: 1},
    {id: "celestial chart", x: 20, y: 1},
    {id: "bookshelf 3w", x: 1, y: 4},
    {id: "bookshelf 2w", x: 4, y: 4},
    {id: "cabinet:book+bookb+bookg", x: 6, y: 4},
    {id: "wall torch", x: 8, y: 2},
    {id: "war map table", x: 1, y: 6},
    {id: "chart table", x: 4, y: 6},
    {id: "chair N", x: 5, y: 8},
    {id: "map rolls", x: 7, y: 6},
    {id: "candelabra", x: 8, y: 8},
    {id: "wall torch", x: 23, y: 2},
    {id: "catalog drawers", x: 23, y: 4},
    {id: "specimen shelf", x: 24, y: 4},
    {id: "hourglass", x: 25, y: 4},
    {id: "bookshelf 2w", x: 27, y: 4},
    {id: "cabinet:book+bookb+bookg", x: 29, y: 4},
    {id: "lens bench", x: 23, y: 6},
    {id: "orrery", x: 26, y: 6},
    {id: "globe", x: 28, y: 6},
    {id: "telescope", x: 30, y: 7},
    {id: "catalog drawers", x: 3, y: 12},
    {id: "scroll rack", x: 4, y: 12},
    {id: "bookshelf 3w", x: 5, y: 12},
    {id: "library ladder", x: 8, y: 12},
    {id: "bookshelf 2w", x: 1, y: 12},
    {id: "seal stone", x: 2, y: 14},
    {id: "star seal", x: 3, y: 14},
    {id: "seal stone", x: 5, y: 14},
    {id: "map case", x: 7, y: 14},
    {id: "desk 2x1", x: 6, y: 16},
    {id: "lectern", x: 1, y: 16},
    {id: "notice board", x: 11, y: 10},
    {id: "round arch", x: 14, y: 10},
    {id: "star chart", x: 19, y: 10},
    {id: "potted fern", x: 10, y: 12},
    {id: "marble bust", x: 11, y: 12},
    {id: "marble bust", x: 20, y: 12},
    {id: "potted fern", x: 21, y: 12},
    {id: "inn reception", x: 18, y: 14},
    {id: "coat rack", x: 21, y: 14},
    {id: "bench 3", x: 11, y: 15},
    {id: "bookshelf 2w", x: 23, y: 12},
    {id: "cabinet:book+bookb+bookg", x: 25, y: 12},
    {id: "fireplace", x: 26, y: 12},
    {id: "map rolls", x: 28, y: 12},
    {id: "round rug", x: 26, y: 13},
    {id: "armchair", x: 28, y: 14},
    {id: "owl perch", x: 23, y: 14},
    {id: "desk 3x2", x: 27, y: 15},
    {id: "globe", x: 30, y: 14},
    {id: "telescope", x: 23, y: 16},
  ],
  lines: [
    {id: "rug blue", rect: {x0: 12, y0: 4, x1: 19, y1: 8}},
    {id: "rug blue", rect: {x0: 15, y0: 10, x1: 15, y1: 18}},
  ],
  goods: [
    {id: "papers", x: 27, y: 15},
    {id: "openbook", x: 28, y: 15},
    {id: "candlestick", x: 29, y: 15},
    {id: "quill", x: 27, y: 16},
    {id: "inkwell", x: 29, y: 16},
    {id: "openbook", x: 6, y: 16},
    {id: "candlestick", x: 7, y: 16},
  ],
};

/** 네 화로의 방(32×19) — 본당: 북벽 쇠창살 문(풀면 열린다)·사자 수호상, 밝은 돌 단 네 모서리의 큰 화로(great brazier)와 가운데 룬 비석 둘·별 원. 남쪽 칸막이 뒤 불씨 사당(꺼지지 않는 불 = 화로에 옮길 불).
 * 양옆 벽감 셋씩: 서 = 땔감 광·불 끄는 물통·기름 광, 동 = 천문대로 오르는 돌 계단·의식 기록대·수호상. VQA r4: 화로가 작은 검은 삼각대, 빈 바닥 30%, 남쪽 띠 용도 없음. */
const GATE_ROOM: RoomSpec = {
  plan: [
    "################################",
    "#..............................#",
    "#..............................#",
    "#..............................#",
    "#..............................#",
    "#..............................#",
    "#..............................#",
    "#########..............#########",
    "#..............................#",
    "#..............................#",
    "#..............................#",
    "#..............................#",
    "#########..............#########",
    "#.........#####..#####.........#",
    "#..............................#",
    "#..............................#",
    "#..............................#",
    "#..............................#",
    "################################",
  ],
  floor: "flag",
  wall: "stone",
  ceiling: "dark",
  zones: [
    {x0: 9, y0: 1, x1: 22, y1: 17, floor: "grey"},
  ],
  daises: [
    {id: "dais stone", x: 10, y: 7, w: 12, h: 6},
  ],
  objects: [
    {id: "portcullis", x: 15, y: 1},
    {id: "wall torch", x: 13, y: 1},
    {id: "wall torch", x: 18, y: 1},
    {id: "celestial chart", x: 10, y: 1},
    {id: "celestial chart", x: 20, y: 1},
    {id: "lion statue", x: 11, y: 6},
    {id: "lion statue", x: 19, y: 6},
    {id: "seal stone", x: 13, y: 4},
    {id: "seal stone", x: 18, y: 4},
    {id: "column stone", x: 9, y: 4},
    {id: "column stone", x: 22, y: 4},
    {id: "great brazier", x: 11, y: 8},
    {id: "great brazier", x: 19, y: 8},
    {id: "great brazier", x: 11, y: 11},
    {id: "great brazier", x: 19, y: 11},
    {id: "rune stone", x: 15, y: 9},
    {id: "rune stone", x: 16, y: 9},
    {id: "seal stone", x: 12, y: 16},
    {id: "seal stone", x: 13, y: 16},
    {id: "lava brazier", x: 11, y: 16},
    {id: "lava brazier", x: 14, y: 16},
    {id: "tapestry", x: 18, y: 14},
    {id: "paschal candle", x: 17, y: 16},
    {id: "paschal candle", x: 20, y: 16},
    {id: "wall torch", x: 12, y: 14},
    {id: "wall torch", x: 19, y: 14},
    {id: "celestial chart", x: 10, y: 14},
    {id: "star chart", x: 20, y: 14},
    {id: "wall torch", x: 4, y: 1},
    {id: "firewood rack 2w", x: 1, y: 3},
    {id: "firewood rack", x: 4, y: 3},
    {id: "firewood rack 2w", x: 5, y: 3},
    {id: "coal bin", x: 8, y: 3},
    {id: "coal bin", x: 1, y: 5},
    {id: "firewood bundle", x: 2, y: 5},
    {id: "crate stack", x: 4, y: 5},
    {id: "sack pile", x: 6, y: 5},
    {id: "firewood bundle", x: 8, y: 6},
    {id: "star chart", x: 4, y: 8},
    {id: "water trough", x: 1, y: 10},
    {id: "water bucket", x: 3, y: 10},
    {id: "quench barrel", x: 5, y: 10},
    {id: "water jar", x: 7, y: 10},
    {id: "quench barrel", x: 1, y: 11},
    {id: "wall torch", x: 3, y: 13},
    {id: "cask rack", x: 1, y: 15},
    {id: "shelf:jar+jarb+jarg", x: 4, y: 13},
    {id: "barrel stack", x: 6, y: 15},
    {id: "water jar", x: 1, y: 17},
    {id: "pot", x: 3, y: 17},
    {id: "crate", x: 6, y: 17},
    {id: "stairs up stone", x: 25, y: 3},
    {id: "wall torch", x: 29, y: 1},
    {id: "bookshelf 2w", x: 23, y: 3},
    {id: "scroll rack", x: 28, y: 3},
    {id: "statue", x: 30, y: 3},
    {id: "lectern", x: 23, y: 5},
    {id: "celestial chart", x: 27, y: 8},
    {id: "case scroll", x: 23, y: 10},
    {id: "catalog drawers", x: 25, y: 10},
    {id: "lectern", x: 26, y: 10},
    {id: "desk 2x1", x: 29, y: 10},
    {id: "celestial chart", x: 26, y: 13},
    {id: "statue", x: 24, y: 15},
    {id: "statue", x: 30, y: 15},
    {id: "plinth amphora", x: 27, y: 16},
  ],
  lines: [
    {id: "rug blue", rect: {x0: 15, y0: 3, x1: 16, y1: 6}},
  ],
};

/** 옛 별지기의 방(32×27) — 북: 렌즈 성소(룬 벽, 두 열주 사이 돌 단 위 별 렌즈, 북서 돌 계단으로 발렌이 내려온다, 서 = 별 비추는 못, 동 = 별 원), 가운데: 홀과 두 곁방(서 납골실·동 별지기 서고),
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
    "#..............................#",
    "##############....##############",
    "#.......#..............#.......#",
    "#.......#..............#.......#",
    "#.......#..............#.......#",
    "#.......#..............#.......#",
    "#..............................#",
    "#..............................#",
    "#..............................#",
    "#############......#############",
    "#..............................#",
    "#..............................#",
    "#..............................#",
    "#..............................#",
    "#..............................#",
    "#..............................#",
    "###############.################",
  ],
  floor: "flag",
  wall: "stone",
  ceiling: "dark",
  zones: [
    {x0: 1, y0: 1, x1: 30, y1: 10, floor: "grey", wall: "rune"},
  ],
  daises: [
    {id: "dais stone", x: 11, y: 3, w: 10, h: 6},
  ],
  objects: [
    {id: "stairs up stone", x: 2, y: 4},
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
    {id: "column stone", x: 9, y: 10},
    {id: "column stone", x: 22, y: 4},
    {id: "column stone", x: 22, y: 7},
    {id: "column stone", x: 22, y: 10},
    {id: "moon pool", x: 4, y: 8},
    {id: "statue", x: 7, y: 7},
    {id: "candelabra", x: 2, y: 9},
    {id: "lectern", x: 7, y: 10},
    {id: "plinth amphora", x: 1, y: 10},
    {id: "paschal candle", x: 25, y: 7},
    {id: "paschal candle", x: 28, y: 7},
    {id: "mana crystal", x: 29, y: 9},
    {id: "statue", x: 24, y: 10},
    {id: "spellbook stand", x: 29, y: 5},
    {id: "geode stand", x: 25, y: 10},
    {id: "star chart", x: 10, y: 12},
    {id: "wall torch", x: 12, y: 12},
    {id: "wall torch", x: 19, y: 12},
    {id: "wall sconce", x: 21, y: 12},
    {id: "brazier", x: 11, y: 14},
    {id: "brazier", x: 20, y: 14},
    {id: "save crystal", x: 10, y: 16},
    {id: "seal stone", x: 21, y: 16},
    {id: "painted sarcophagus", x: 1, y: 14},
    {id: "painted sarcophagus", x: 4, y: 14},
    {id: "candle", x: 7, y: 14},
    {id: "sarcophagus", x: 3, y: 17},
    {id: "star chart", x: 27, y: 12},
    {id: "relic cabinet", x: 24, y: 14},
    {id: "bookshelf 2w", x: 25, y: 14},
    {id: "relic cabinet", x: 27, y: 14},
    {id: "bookshelf 2w", x: 28, y: 14},
    {id: "relic cabinet", x: 30, y: 14},
    {id: "crystal ball", x: 30, y: 17},
    {id: "key pedestal", x: 26, y: 17},
    {id: "tool wall", x: 3, y: 20},
    {id: "shelf:vial+flask", x: 7, y: 20},
    {id: "lens bench", x: 1, y: 22},
    {id: "grindstone", x: 4, y: 22},
    {id: "work 3x2", x: 7, y: 23},
    {id: "crate stack", x: 1, y: 24},
    {id: "alembic", x: 11, y: 22},
    {id: "cupboard", x: 21, y: 22},
    {id: "dining 3x2", x: 24, y: 23},
    {id: "chair E", x: 23, y: 23},
    {id: "chair W", x: 27, y: 23},
    {id: "water jar", x: 30, y: 22},
    {id: "bench 3", x: 24, y: 25},
    {id: "wall torch", x: 22, y: 20},
    {id: "wall torch", x: 9, y: 20},
    {id: "rune stone", x: 13, y: 22},
    {id: "rune stone", x: 18, y: 22},
    {id: "brazier", x: 14, y: 25},
    {id: "brazier", x: 17, y: 25},
  ],
  lines: [
    {id: "rug blue", rect: {x0: 15, y0: 9, x1: 16, y1: 25}},
  ],
  goods: [
    {id: "crystal", x: 7, y: 23},
    {id: "tongs", x: 8, y: 23},
    {id: "flask", x: 9, y: 23},
    {id: "papers", x: 7, y: 24},
    {id: "smallflask", x: 9, y: 24},
    {id: "plate", x: 24, y: 23},
    {id: "cup", x: 25, y: 23},
    {id: "pitcher", x: 26, y: 23},
    {id: "bowl", x: 24, y: 24},
    {id: "candlestick", x: 26, y: 24},
  ],
};

/** 네 화로(퍼즐 프리셋 순서: 0 북서 · 1 북동 · 2 남서 · 3 남동)의 발밑 왼쪽 칸. 큰 화로는 2칸 폭 — 꺼짐은 발밑 + 위 1줄, 켜짐은 위 2줄(불꽃). */
const BRAZIERS: readonly Cell[] = [{ x: 11, y: 8 }, { x: 19, y: 8 }, { x: 11, y: 11 }, { x: 19, y: 11 }];
const PORTCULLIS: Cell = { x: 15, y: 1 };          // 2×2, 벽면 두 줄
const PORTCULLIS_OPEN = [7116, 7117, 7118, 7119];
const GATE_STAIRS: readonly Cell[] = [{ x: 25, y: 3 }, { x: 26, y: 3 }, { x: 27, y: 3 }];   // 돌 계단 밟는 줄(천문대로)
const OBS_STAIRS: readonly Cell[] = [{ x: 3, y: 14 }, { x: 4, y: 14 }, { x: 3, y: 15 }, { x: 4, y: 15 }];   // 별 봉인 돌뚜껑 2×2

function kitTile(project: Project, name: string, dx = 0, dy = 0): number {
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

function build(project: Project, exec: Exec, mapId: string, spec: RoomSpec): GameMap {
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
const LIGHTS: Record<string, { radius: number; dy: number; flicker?: boolean; color?: string }> = {
  "wall torch": { radius: 3.2, dy: 2, flicker: true },
  "brazier": { radius: 3.4, dy: 0, flicker: true },
  "lava brazier": { radius: 3.2, dy: 0, flicker: true },
  "fireplace": { radius: 3.6, dy: 1, flicker: true },
  "paschal candle": { radius: 1.8, dy: 0, flicker: true },
  "candle": { radius: 1.4, dy: 0, flicker: true },
};
function lightRoom(project: Project, exec: Exec, mapId: string, spec: RoomSpec, ambient: number, color: string, extra: Array<Cell & { radius: number; color: string }> = []): void {
  const sources: Array<Record<string, unknown>> = [];
  spec.objects.forEach((o, i) => {
    const l = LIGHTS[o.id];
    if (!l) return;
    sources.push({ id: `l${i}`, at: { x: o.x, y: o.y + l.dy }, radius: l.radius, intensity: 0.9, color: l.color ?? "#ffcf8a", ...(l.flicker ? { flicker: true } : {}) });
  });
  extra.forEach((e, i) => sources.push({ id: `x${i}`, at: { x: e.x, y: e.y }, radius: e.radius, intensity: 0.8, color: e.color }));
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
  // 큰 화로 2칸 폭 × 3줄(y-2·y-1·y). 꺼짐 킷은 2줄이라 맨 윗줄을 비운다.
  const cold = [0, 1].map((dy) => [0, 1].map((dx) => kitTile(project, "great brazier", dx, dy)));
  const lit = [0, 1, 2].map((dy) => [0, 1].map((dx) => kitTile(project, "great brazier lit", dx, dy)));
  const tile = (x: number, y: number, t: number): Command => ({ kind: "changeTile", mapId: gate.id, layer: "upper", x, y, tile: t } as unknown as Command);
  const litOrCold = (n: number, on: boolean): Command[] => {
    const b = BRAZIERS[n]!;
    const out: Command[] = [];
    for (let row = 0; row < 3; row += 1) for (let dx = 0; dx < 2; dx += 1) {
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
  for (const map of Object.values(project.maps)) for (const event of map.events) for (const rec of transfersIn(event)) {
    if (rooms.has(String(rec.mapId))) { rec.x = 1; rec.y = 1; }
  }
  build(project, exec, ids.observatory, OBS_ROOM);
  exec(project, "stamp_object", { objectId: KIT("dome slit tall"), mapId: ids.observatory, x: 17, y: 0 });
  build(project, exec, ids.gate, GATE_ROOM);
  exec(project, "stamp_object", { objectId: KIT("magic circle"), mapId: ids.gate, x: 15, y: 11 });   // 두 비석 앞 별 원
  build(project, exec, ids.vault, VAULT_ROOM);
  exec(project, "stamp_object", { objectId: KIT("magic circle"), mapId: ids.vault, x: 26, y: 7 });   // 성소 동쪽 별 원
  lightRoom(project, exec, ids.observatory, OBS_ROOM, 0.32, "#1c1830");
  lightRoom(project, exec, ids.gate, GATE_ROOM, 0.4, "#141420");
  lightRoom(project, exec, ids.vault, VAULT_ROOM, 0.45, "#141c40", [{ x: 15, y: 5, radius: 4.5, color: "#a8d8f0" }, { x: 10, y: 15, radius: 2.5, color: "#88b3ca" }, { x: 27, y: 8, radius: 2.2, color: "#c8a8f0" }]);

  // ── 천문대 ──
  const obs = M(ids.observatory);
  const hubDoor = obs.events.find((e) => transfersIn(e).some((t) => t.mapId === ids.hub));
  if (!hubDoor) throw new Error("[fallen-star] 천문대 → 광장 문을 찾지 못했다");
  hubDoor.x = 15; hubDoor.y = 18;
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
  place(obs, "ev_fs_hanel", { x: 24, y: 14 });   // 서재 벽난로 앞 깔개 서쪽(말 거는 자리 (24,15))
  const scope = place(obs, "ev_fs_scope", { x: 15, y: 7 });   // 망원경 발밑 앞줄 — (15,8)에서 위를 보고 말 건다
  for (const page of scope.pages ?? []) page.priority = "same";

  // ── 네 화로의 방 ──
  const gate = M(ids.gate);
  const tablet = place(gate, "ev_fs_braziers_hint_tablet", { x: 15, y: 9 });
  cloneAt(gate, tablet, "r", { x: 16, y: 9 });
  BRAZIERS.forEach((b, n) => place(gate, `ev_fs_braziers_brazier_${n}`, b));
  rewirePuzzleTiles(project, gate);
  // 큰 화로는 2칸 폭 — 오른쪽 발밑에서 말을 걸어도 같은 화로다(바꿔 끼기는 위에서 맞춘 명령 그대로).
  BRAZIERS.forEach((b, n) => cloneAt(gate, gate.events.find((e) => e.id === `ev_fs_braziers_brazier_${n}`)!, "r", { x: b.x + 1, y: b.y }));
  const solved = { kind: "switch", switchId: "sw_puzzle_fs_braziers_solved", value: true } as const;
  gate.events = gate.events.filter((e) => !String(e.id).startsWith("ev_fs_vault_gate_"));
  GATE_STAIRS.forEach((cell, i) => gate.events.push(touchDoor(`ev_fs_vault_gate_up${i}`, cell, { mapId: ids.observatory, x: 3, y: 16, direction: "down" })));
  for (let dx = 0; dx < 2; dx += 1) {
    const x = PORTCULLIS.x + dx;
    gate.events.push(touchDoor(`ev_fs_vault_gate_in${dx}`, { x, y: PORTCULLIS.y }, { mapId: ids.vault, x: 15, y: 25, direction: "up" }));
    gate.events.push({
      id: `ev_fs_vault_gate_bars${dx}`, name: "쇠창살 문", x, y: PORTCULLIS.y + 1, trigger: { kind: "action" }, commands: [],
      pages: [
        quietPage(`ev_fs_vault_gate_bars${dx}_shut`, "닫힘", [], "action", [
          { kind: "text", body: "굵은 쇠창살이 바닥까지 내려와 있다. 손으로는 꿈쩍도 하지 않는다." } as unknown as Command,
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
  for (const rec of transfersIn(exit)) if (rec.mapId === ids.observatory || rec.mapId === ids.gate) Object.assign(rec, { mapId: ids.gate, x: 15, y: 3, direction: "down" });
  const spots: Record<string, Cell> = {
    ev_fs_vault_foe1: { x: 18, y: 15 },   // 홀 융단 동쪽(좌우로 두 칸씩 돈다)
    ev_fs_vault_foe2: { x: 5, y: 17 },    // 서쪽 납골실 — 석관 앞 트인 칸(석관 뒤에 숨지 않게)
    ev_fs_vault_foe3: { x: 28, y: 16 },   // 동쪽 별지기 서고
    ev_fs_vault_chest1: { x: 2, y: 18 },
    ev_fs_vault_chest2: { x: 24, y: 17 },
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

  // 이 세 방 사이·광장에서 들어오는 이동 도착 칸(문 앞 첫 바닥, 문을 등진 방향).
  pointTransfers(M(ids.gate), ids.vault, { x: 15, y: 25, direction: "up" });
  pointTransfers(M(ids.vault), ids.gate, { x: 15, y: 3, direction: "down" });
  pointTransfers(M(ids.observatory), ids.gate, { x: 26, y: 4, direction: "down" });
  pointTransfers(M(ids.gate), ids.observatory, { x: 3, y: 16, direction: "down" });
}
