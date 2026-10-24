/**
 * 『폴른 스타』 1막 지하 미궁 — 옛 별지기의 방(지하 2층) 아래 두 층의 평면(손 도트 실내 v5, atlas_biome_interior).
 *
 * 2026-10-24 사용자: 「지하 금고를 훨씬 복잡한 미궁으로 — 여러 층·갈림길·레버 퍼즐·보상 있는 막다른 길·광신도·보스 전 휴식처」.
 * 평면 규칙(handInterior/builder.analyseHandInteriorPlan): `#` 위 첫 두 바닥 줄은 벽면(못 걷는다) — 동서로 잇는 통로는 4줄 높이로 판다
 * (벽면 두 줄 + 걷는 두 줄). 남북 통로는 2칸 폭. 구역마다 쓰임이 하나다(빈 바닥을 메우지 않고 방 크기를 쓰임에 맞춘다).
 *
 * 지하 3층 「가라앉은 회랑」(44×34)
 *   R1 내려온 층계참(북) · R2 큰 회랑(가운데 갈림길) · R4 서쪽 「달의 방」 레버(동쪽 쇠살문을 연다) · R8 남서 막다른 납골실(상자·광신도 일지)
 *   R6 동쪽 홀(광신도 둘) · R9 북동 무너진 교단 굴(막다른 길·상자·초소 명령서) · R7 남동 「해와 달」 손잡이 방(순서 퍼즐)
 *   R5 남쪽 「달의 문」 너머 내려가는 계단.
 * 지하 4층 「달비늘의 자리」(40×34)
 *   RA 남쪽 쉼터(푸른 결정·샘·다친 광신도) → 북쪽 큰 홀(용) → 북벽 기계 감실(패널).
 * 좌표는 지어진 맵 기준(평면 첫 줄 = 맵 0줄). act1Finale.ts 가 이벤트를 같은 좌표에 둔다.
 */
import type { RoomSpec } from "../fallenStarRooms";

type Cell = { x: number; y: number };
type Rect = readonly [number, number, number, number];

/** 사각형(포함 좌표) 바닥을 판 평면. */
function carve(width: number, height: number, rects: readonly Rect[]): string[] {
  const rows = Array.from({ length: height }, () => new Array<string>(width).fill("#"));
  for (const [x0, y0, x1, y1] of rects) for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) rows[y]![x] = ".";
  return rows.map((r) => r.join(""));
}

// ── 지하 3층 ──────────────────────────────────────────────────────────

export const FS_B3_ID = "fs_vault_b3";
export const FS_B3_NAME = "천문대 지하 · 가라앉은 회랑";

export const B3 = {
  /** 위로 오르는 돌 계단(3×1 벽 가구) — 밟으면 옛 별지기의 방으로. */
  stairsUp: [{ x: 20, y: 3 }, { x: 21, y: 3 }, { x: 22, y: 3 }] as Cell[],
  arrive: { x: 21, y: 4 } as Cell,
  /** 동쪽 쇠살문(회랑 → 동쪽 홀) 두 칸 — 서쪽 달의 방 레버가 연다. */
  eastGate: [{ x: 34, y: 17 }, { x: 34, y: 18 }] as Cell[],
  /** 남쪽 「달의 문」 쇠살문 두 칸 — 해와 달 손잡이를 차례로 당기면 열린다. */
  moonGate: [{ x: 21, y: 21 }, { x: 22, y: 21 }] as Cell[],
  /** 벽 손잡이(벽면 윗줄에 걸린다) — 이벤트는 벽면 아랫줄, 플레이어는 그 아래 첫 바닥 줄에서 위를 보고 당긴다. */
  westLever: { x: 5, y: 8 } as Cell,
  sunLever: { x: 35, y: 25 } as Cell,
  moonLever: { x: 41, y: 25 } as Cell,
  /** 손잡이 방 석판. */
  leverTablet: { x: 37, y: 27 } as Cell,
  /** 회랑 북쪽 별지기 석판(층 안내). */
  hallTablet: { x: 16, y: 12 } as Cell,
  /** 막다른 길 상자 · 읽을거리. */
  chestSW: { x: 2, y: 28 } as Cell,
  diarySW: { x: 7, y: 27 } as Cell,
  chestNE: { x: 41, y: 4 } as Cell,
  ordersNE: { x: 35, y: 3 } as Cell,
  /** 광신도(필드 적) 자리. */
  foes: { gallery: { x: 26, y: 15 }, west: { x: 6, y: 14 }, east: { x: 39, y: 14 }, levers: { x: 38, y: 30 } } as Record<string, Cell>,
  /** 내려가는 계단통(3×2 바닥) 왼쪽 위 — 밟으면 지하 4층. */
  stairsDown: { x: 20, y: 28 } as Cell,
};

export const B3_ROOM: RoomSpec = {
  plan: carve(44, 34, [
    [17, 1, 26, 7],    // R1 층계참
    [21, 8, 22, 9],    // R1 → R2
    [12, 10, 31, 18],  // R2 큰 회랑
    [6, 15, 11, 18],   // R2 → R4
    [1, 8, 9, 18],     // R4 달의 방(서)
    [3, 19, 4, 23],    // R4 → R8
    [1, 24, 9, 31],    // R8 납골실(남서 막다른 길)
    [32, 15, 36, 18],  // R2 → R6 (쇠살문)
    [37, 8, 42, 22],   // R6 동쪽 홀
    [39, 6, 40, 7],    // R6 → R9
    [33, 1, 42, 5],    // R9 무너진 교단 굴(북동 막다른 길)
    [39, 23, 40, 24],  // R6 → R7
    [33, 25, 42, 32],  // R7 해와 달 손잡이 방
    [21, 19, 22, 23],  // R2 → R5 (달의 문)
    [16, 24, 27, 31],  // R5 내려가는 계단
  ]),
  floor: "flag",
  wall: "stone",
  ceiling: "dark",
  zones: [
    { x0: 12, y0: 10, x1: 31, y1: 18, floor: "grey", wall: "stone" },
    { x0: 1, y0: 8, x1: 9, y1: 18, floor: "flag", wall: "rune" },
    { x0: 1, y0: 24, x1: 9, y1: 31, floor: "wetstone", wall: "dungeonw" },
    { x0: 33, y0: 1, x1: 42, y1: 7, floor: "cave", wall: "rubble" },
    { x0: 33, y0: 25, x1: 42, y1: 32, floor: "flag", wall: "rune" },
    { x0: 16, y0: 24, x1: 27, y1: 31, floor: "grey", wall: "rune" },
  ],
  objects: [
    // R1 층계참 — 위로 오르는 돌 계단, 양옆 횃불.
    { id: "stairs up stone", x: 20, y: 3 },
    { id: "wall torch", x: 18, y: 1 },
    { id: "wall torch", x: 25, y: 1 },
    { id: "rune stone", x: 17, y: 6 },
    { id: "rune stone", x: 26, y: 6 },
    // R2 큰 회랑 — 옛 별지기들의 줄기둥과 무너진 천구의, 광신도들이 쌓아 둔 짐.
    { id: "star chart", x: 14, y: 10 },
    { id: "celestial chart", x: 18, y: 10 },
    { id: "banner blue", x: 24, y: 10 },
    { id: "celestial chart", x: 26, y: 10 },
    { id: "star chart", x: 29, y: 10 },
    { id: "wall torch", x: 13, y: 10 },
    { id: "wall torch", x: 30, y: 10 },
    { id: "column stone", x: 14, y: 14 },
    { id: "column stone", x: 18, y: 14 },
    { id: "column stone", x: 25, y: 14 },
    { id: "column stone", x: 29, y: 14 },
    { id: "hint tablet", x: 16, y: 12 },
    { id: "orrery", x: 27, y: 12 },
    { id: "book pile", x: 13, y: 17 },
    { id: "scroll pile", x: 15, y: 18 },
    { id: "loot sacks", x: 30, y: 17 },
    { id: "crate", x: 31, y: 18 },
    { id: "candle stubs", x: 20, y: 12 },
    { id: "candle stubs", x: 23, y: 12 },
    // R4 달의 방(서) — 벽 손잡이, 달 그림 성소, 설교자가 지킨다.
    { id: "wall lever", x: 5, y: 8 },
    { id: "wall torch", x: 2, y: 8 },
    { id: "wall torch", x: 8, y: 8 },
    { id: "chained bookcase", x: 1, y: 10 },
    { id: "lectern", x: 3, y: 12 },
    { id: "statue", x: 8, y: 11 },
    { id: "candle", x: 7, y: 11 },
    { id: "candle", x: 9, y: 11 },
    { id: "stone bench", x: 2, y: 16 },
    { id: "drip puddle", x: 7, y: 17 },
    // R8 납골실(남서 막다른 길) — 석관·뼈·쓰러진 광신도의 짐(일지)·상자.
    { id: "sarcophagus", x: 1, y: 26 },
    { id: "sarcophagus", x: 7, y: 30 },
    { id: "candle", x: 6, y: 26 },
    { id: "skull pile", x: 8, y: 27 },
    { id: "bone pillar", x: 1, y: 30 },
    { id: "loot sacks", x: 6, y: 27 },
    { id: "cobweb", x: 1, y: 24 },
    { id: "cobweb", x: 9, y: 24 },
    { id: "drip puddle", x: 4, y: 29 },
    // R6 동쪽 홀 — 교단이 세운 초소: 무기 상자·창 걸이·지도 탁자.
    { id: "weapon rack", x: 37, y: 8 },
    { id: "shield wall", x: 41, y: 8 },
    { id: "wall torch", x: 38, y: 8 },
    { id: "war map table", x: 37, y: 11 },
    { id: "weapon crate", x: 42, y: 12 },
    { id: "spear rack", x: 42, y: 16 },
    { id: "barrel", x: 37, y: 20 },
    { id: "crate", x: 42, y: 21 },
    { id: "brazier", x: 41, y: 18 },
    // R9 무너진 교단 굴(북동 막다른 길) — 흙벽·버팀목·곡괭이·광차, 무너진 굴 끝.
    { id: "timber prop", x: 33, y: 3 },
    { id: "timber prop", x: 38, y: 3 },
    { id: "pick rack", x: 36, y: 1 },
    { id: "mine cart", x: 36, y: 4 },
    { id: "ore pile", x: 33, y: 4 },
    { id: "rope coil", x: 39, y: 5 },
    { id: "cracked wall", x: 42, y: 1 },
    { id: "hanging lantern", x: 40, y: 1 },
    // R7 해와 달 손잡이 방 — 두 손잡이 사이 석판, 바닥의 해·달 원.
    { id: "wall lever", x: 35, y: 25 },
    { id: "wall lever", x: 41, y: 25 },
    { id: "wall torch", x: 33, y: 25 },
    { id: "wall torch", x: 42, y: 25 },
    { id: "hint tablet", x: 37, y: 27 },
    { id: "rune stone", x: 33, y: 30 },
    { id: "rune stone", x: 42, y: 30 },
    { id: "magic circle", x: 37, y: 30 },
    // R5 달의 문 너머 — 내려가는 계단통과 문지기 석상 둘.
    { id: "stairwell down", x: 20, y: 28 },
    { id: "statue", x: 18, y: 27 },
    { id: "statue", x: 24, y: 27 },
    { id: "wall torch", x: 19, y: 24 },
    { id: "wall torch", x: 24, y: 24 },
    { id: "banner blue", x: 17, y: 24 },
    { id: "banner blue", x: 26, y: 24 },
    { id: "stone brazier lit", x: 16, y: 29 },
    { id: "stone brazier lit", x: 27, y: 29 },
    // 쇠살문(바닥 1×1 문) — 닫힌 그림. 열면 act1Finale.ts 가 iron gate open 으로 바꿔 낀다.
    { id: "iron gate", x: 34, y: 17 },
    { id: "iron gate", x: 34, y: 18 },
    { id: "iron gate", x: 21, y: 21 },
    { id: "iron gate", x: 22, y: 21 },
  ],
  lines: [
    { id: "rug blue", rect: { x0: 21, y0: 12, x1: 22, y1: 18 } },
    { id: "rug purple", rect: { x0: 18, y0: 30, x1: 25, y1: 31 } },
  ],
};

// ── 지하 4층 ──────────────────────────────────────────────────────────

export const FS_B4_ID = "fs_vault_b4";
export const FS_B4_NAME = "천문대 지하 · 달비늘의 자리";

export const B4 = {
  /** 남쪽 끝 통로 — 밟으면 지하 3층으로 오른다. */
  upExit: [{ x: 14, y: 33 }] as Cell[],
  arrive: { x: 14, y: 31 } as Cell,
  crystal: { x: 10, y: 27 } as Cell,
  spring: { x: 18, y: 27 } as Cell,
  /** 다친 광신도(쉼터 벽 곁에 기대 앉았다). */
  wounded: { x: 20, y: 30 } as Cell,
  /** 홀에 들어서면 용이 깨어나는 줄(남쪽 통로 북끝). */
  wakeLine: [{ x: 14, y: 19 }, { x: 15, y: 19 }] as Cell[],
  /** 용(3×2 몸) 아랫줄 가운데 칸. */
  dragon: { x: 15, y: 11 } as Cell,
  /** 기계 패널(감실 북벽 콘솔 2×1) 앞 — 이벤트는 콘솔 칸. */
  panel: [{ x: 14, y: 3 }, { x: 15, y: 3 }] as Cell[],
};

export const B4_ROOM: RoomSpec = {
  plan: carve(30, 34, [
    [10, 1, 19, 3],    // 기계 감실(북)
    [1, 4, 28, 19],    // 달비늘의 홀
    [14, 20, 15, 23],  // 홀 ↔ 쉼터
    [8, 24, 21, 31],  // 쉼터
    [14, 32, 14, 33],  // 지하 3층으로 오르는 통로(마지막 줄 틈은 1칸)
  ]).map((row, y) => {
    // 홀 네 귀를 깎아 둥근 동굴 홀로(직사각 상자 방으로 읽히지 않게).
    const cut = (r: string, xs: number[]): string => r.split("").map((c, x) => (xs.includes(x) ? "#" : c)).join("");
    if (y === 4 || y === 5) return cut(row, [1, 2, 3, 26, 27, 28]);
    if (y === 6) return cut(row, [1, 2, 27, 28]);
    if (y === 18) return cut(row, [1, 28]);
    if (y === 19) return cut(row, [1, 2, 27, 28]);
    return row;
  }),
  floor: "wetstone",
  wall: "rock",
  ceiling: "dark",
  zones: [
    { x0: 9, y0: 1, x1: 20, y1: 6, floor: "grate", wall: "riveted" },
    { x0: 8, y0: 24, x1: 21, y1: 31, floor: "flag", wall: "stone" },
  ],
  // 용 자리 단상(dais stone)은 뺐다 — 연한 바둑판 무늬가 투명 자리표시처럼 읽혔다(숲 사당 모자이크와 같은 지적).
  objects: [
    // 기계 감실 — 옛 하늘 배의 중계 장치: 콘솔(패널)·눈금판·톱니벽·기관 둘.
    { id: "control console", x: 14, y: 3 },
    { id: "gauge panel", x: 12, y: 1 },
    { id: "gauge panel", x: 17, y: 1 },
    { id: "gear wall", x: 10, y: 1 },
    { id: "gear wall", x: 18, y: 1 },
    { id: "magitek engine", x: 9, y: 6 },
    { id: "magitek engine", x: 18, y: 6 },
    { id: "mana crystal", x: 11, y: 3 },
    { id: "mana crystal", x: 18, y: 3 },
    // 홀 — 기둥 두 줄, 용의 둥지(보물 더미·동전), 입구 쪽엔 먼저 내려온 광신도들의 뼈와 부서진 무기.
    { id: "column stone", x: 5, y: 8 },
    { id: "column stone", x: 5, y: 14 },
    { id: "column stone", x: 24, y: 8 },
    { id: "column stone", x: 24, y: 14 },
    { id: "treasure pile", x: 8, y: 11 },
    { id: "treasure pile", x: 20, y: 11 },
    { id: "coin pile", x: 10, y: 13 },
    { id: "coin pile", x: 19, y: 13 },
    { id: "skull pile", x: 11, y: 17 },
    { id: "skull pile", x: 18, y: 16 },
    { id: "weapon crate", x: 8, y: 17 },
    { id: "bone pillar", x: 3, y: 11 },
    { id: "bone pillar", x: 26, y: 11 },
    { id: "lava brazier", x: 7, y: 7 },
    { id: "lava brazier", x: 22, y: 7 },
    { id: "drip puddle", x: 4, y: 16 },
    { id: "drip puddle", x: 25, y: 17 },
    // 쉼터 — 푸른 결정·치유의 샘·돌 의자, 다친 광신도가 기댄 벽.
    { id: "save crystal", x: 10, y: 27 },
    { id: "healing spring", x: 18, y: 27 },
    { id: "wall torch", x: 9, y: 24 },
    { id: "wall torch", x: 20, y: 24 },
    { id: "stone bench", x: 9, y: 30 },
    { id: "rune stone", x: 12, y: 26 },
    { id: "rune stone", x: 17, y: 26 },
    { id: "straw pile", x: 20, y: 31 },
    { id: "loot sacks", x: 21, y: 29 },
  ],
  lines: [
    { id: "rug royal", rect: { x0: 14, y0: 24, x1: 15, y1: 31 } },
  ],
};
