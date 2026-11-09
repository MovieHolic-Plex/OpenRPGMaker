/**
 * 『폴른 스타』 2막 B3 — 광장 우물 밑 「서고 승강구」를 여러 방의 갱도로 넓힌 평면(손 도트 실내 v5, atlas_biome_interior).
 *
 * 2026-11-09 오너: 「우물 갱도도 좀 ... 복잡하고 우물 밑에 사는 괴물 이런 중간보스도 좀 만들고」.
 * 이야기 길(우물 사다리 → 승강 발판 → 천문대 하넬)은 R1 안에서 끝난다 — 나머지 방은 곁가지라 이야기를 막지 않는다.
 * 컨셉(오너 재지적 2026-11-09 「우물 갱도라고 하기엔 컨셉이 안맞잖아」): 왕도 아스텔의 옛 상수도 — 저수조 사슬·배수 갱·펌프 장치·쇠살문.
 * 무덤·뼈 소품은 쓰지 않는다. 불빛은 매단 기름등, 물가는 쇠 격자 정비 발판, 벽을 따라 관.
 *   R1 첫 층계참(옛 12×9 방 그대로 — 사다리·승강 발판·도착 칸 좌표 불변)
 *   R2 첫 저수조(동) — 가운데 물, 둘레 쇠 격자 발판, 밸브·수위 계기. 남쪽 쇠살문을 R5 의 고패로 연다.
 *   R5 서쪽 배수 갱(남서) — R1 서쪽 좁은 갱으로 내려간다. 고패(쇠살문)·물지기 석판.
 *   R3 배수로 회랑(가운데 남) — R2 쇠살문과 R5 동쪽 길이 만나는 고리(R1→R5→R3→R2→R1).
 *   R4 가장 오래된 저수조(동) — 관 사이에 우물 밑 눈먼 영주(중간 보스)가 자리 잡았다. 둘째 석판·쉼터 결정.
 *   R6 정비 벽감(남) — R3 남벽의 금 간 벽 뒤, 물지기 연장 창고(보상).
 * 평면 규칙: '#' 위 첫 두 바닥 줄은 벽면(못 걷는다) — 동서 통로는 4줄 높이, 남북 통로는 2칸 폭.
 */

type Cell = { x: number; y: number };
type Rect = readonly [number, number, number, number];

function carve(width: number, height: number, rects: readonly Rect[]): string[] {
  const rows = Array.from({ length: height }, () => new Array<string>(width).fill("#"));
  for (const [x0, y0, x1, y1] of rects) for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) rows[y]![x] = ".";
  return rows.map((r) => r.join(""));
}

export const WELL_SHAFT_PLAN = carve(42, 32, [
  [1, 1, 10, 7],    // R1 승강구(옛 방)
  [11, 4, 12, 7],   // R1 → R2 물길
  [13, 1, 27, 9],   // R2 잠긴 저수조
  [20, 10, 21, 13], // R2 → R3 (쇠살문)
  [13, 14, 29, 21], // R3 가라앉은 회랑
  [3, 8, 4, 13],    // R1 → R5 좁은 길
  [1, 14, 10, 21],  // R5 무너진 우물 밑동
  [11, 18, 12, 21], // R5 → R3
  [30, 18, 31, 21], // R3 → R4
  [32, 12, 40, 27], // R4 우물 밑 둥지
  [22, 22, 23, 23], // R3 → R6 (금 간 벽)
  [17, 24, 28, 30], // R6 숨은 보물방
])

export const WELL = {
  // R1 — 옛 방과 같은 좌표(act2Opening.ts SHAFT).
  ladder: { x: 2, y: 1 } as Cell, ladderUse: { x: 2, y: 3 } as Cell, arrive: { x: 2, y: 4 } as Cell, lift: { x: 6, y: 4 } as Cell,
  /** R2 → R3 쇠살문(1×1 바닥 문) — 문짝은 (x, y-1) 위층, 발밑은 (x, y). */
  gate: [{ x: 20, y: 12 }, { x: 21, y: 12 }] as Cell[],
  /** R5 고패(쇠살문을 감아 올린다) — 조사 칸. */
  winch: { x: 8, y: 17 } as Cell,
  /** 첫 비문(R5) · 둘째 비문(R4 입구) · 저수조 일지(R2). */
  tabletWell: { x: 2, y: 17 } as Cell,
  tabletNest: { x: 33, y: 16 } as Cell,
  ledger: { x: 25, y: 4 } as Cell,
  /** R3 남벽 금 간 벽(벽면 두 줄 R3 y20..21? — 남쪽 통로 입구 바닥 칸에서 조사). 통로 칸은 막아 두었다가 연다. */
  crack: [{ x: 22, y: 22 }, { x: 23, y: 22 }] as Cell[],
  /** 숨은 방 상자 둘. */
  chestHidden: { x: 19, y: 28 } as Cell,
  chestHidden2: { x: 27, y: 29 } as Cell,
  /** R5 막다른 구석 상자. */
  chestCorner: { x: 9, y: 20 } as Cell,
  /** 보스(3×2 몸) 아랫줄 가운데 · 깨우는 줄 · 쉼터 결정. */
  beast: { x: 37, y: 15 } as Cell,
  wakeLine: [{ x: 33, y: 20 }, { x: 33, y: 21 }] as Cell[],
  save: { x: 30, y: 20 } as Cell,
};

const objects = [
  // R1 첫 층계참 — 옛 방 기물 그대로(우물 사다리·승강 장치·고패·계기).
  { id: "wall torch", x: 4, y: 1 }, { id: "wall torch", x: 10, y: 1 }, { id: "barrel", x: 10, y: 6 }, { id: "drip puddle", x: 3, y: 6 },
  { id: "gear wall", x: 6, y: 1 }, { id: "gauge panel", x: 8, y: 1 },
  { id: "gate winch", x: 8, y: 4 }, { id: "anchor chain", x: 5, y: 5 }, { id: "wall lever", x: 9, y: 1 },
  // R2 첫 저수조 — 가운데 물, 둘레는 쇠 격자 정비 발판. 북벽 관 · 수위 계기 · 밸브.
  { id: "moon pool", x: 17, y: 5 }, { id: "moon pool", x: 20, y: 5 }, { id: "moon pool", x: 23, y: 5 },
  { id: "hanging lantern", x: 16, y: 1 }, { id: "hanging lantern", x: 25, y: 1 }, { id: "gauge panel", x: 21, y: 1 },
  { id: "ship wheel", x: 15, y: 7 }, { id: "water bucket", x: 26, y: 3 }, { id: "rope coil", x: 27, y: 8 },
  { id: "drip puddle", x: 15, y: 8 }, { id: "drip puddle", x: 24, y: 8 },
  { id: "hint tablet", x: 25, y: 4 },
  // R2 → R3 쇠살문 둘.
  { id: "iron gate", x: 20, y: 12 }, { id: "iron gate", x: 21, y: 12 },
  // R5 서쪽 배수 갱 — 내려오는 줄사다리 밑, 쇠살문 고패, 물지기 석판, 물통·양동이.
  { id: "ship ladder", x: 6, y: 16 }, { id: "hanging lantern", x: 2, y: 14 }, { id: "hanging lantern", x: 9, y: 14 },
  { id: "gate winch", x: 8, y: 17 }, { id: "anchor chain", x: 7, y: 19 },
  { id: "hint tablet", x: 2, y: 17 }, { id: "water trough", x: 1, y: 20 }, { id: "drain grate", x: 5, y: 20 },
  { id: "barrel", x: 1, y: 18 }, { id: "broom and bucket", x: 10, y: 16 },
  // R3 배수로 회랑 — 가운데 배수 창살 줄, 아치 기둥, 매단 등.
  { id: "column stone", x: 17, y: 16 }, { id: "column stone", x: 27, y: 16 },
  { id: "hanging lantern", x: 18, y: 14 }, { id: "hanging lantern", x: 26, y: 14 },
  { id: "drain grate", x: 19, y: 19 }, { id: "drain grate", x: 22, y: 19 }, { id: "drain grate", x: 25, y: 19 },
  { id: "drip puddle", x: 15, y: 20 }, { id: "drip puddle", x: 28, y: 18 },
  { id: "barrel", x: 29, y: 16 }, { id: "crate", x: 13, y: 16 },
  // R4 가장 오래된 저수조 — 물 두 줄, 낡은 펌프 톱니·계기, 영주가 관 사이에 자리 잡았다.
  { id: "moon pool", x: 34, y: 23 }, { id: "moon pool", x: 37, y: 23 },
  { id: "gear wall", x: 33, y: 12 }, { id: "gauge panel", x: 39, y: 12 },
  { id: "hanging lantern", x: 35, y: 12 }, { id: "hanging lantern", x: 38, y: 12 },
  { id: "ship wheel", x: 40, y: 17 }, { id: "hint tablet", x: 33, y: 16 },
  { id: "drip puddle", x: 34, y: 20 }, { id: "drip puddle", x: 39, y: 21 }, { id: "drain grate", x: 37, y: 26 },
  // R6 정비 벽감 — 물지기 연장 걸이·사물함·밧줄·일지.
  { id: "hanging lantern", x: 19, y: 24 }, { id: "hanging lantern", x: 26, y: 24 },
  { id: "tool wall", x: 20, y: 24 }, { id: "pick rack", x: 25, y: 24 },
  { id: "guild lockers", x: 17, y: 26 }, { id: "rope coil", x: 28, y: 26 }, { id: "broom and bucket", x: 17, y: 30 },
  { id: "desk 2x1", x: 23, y: 28 }, { id: "map rolls", x: 21, y: 28 },
  // R3 → R6 통로를 막은 바위(금 간 벽) — 무너지면 칸을 비운다(wellBeast.ts).
  { id: "push boulder", x: 22, y: 22 }, { id: "push boulder", x: 23, y: 22 },
];

export const WELL_SHAFT_ROOM = {
  plan: WELL_SHAFT_PLAN,
  floor: "wetstone",
  wall: "dungeonw",
  ceiling: "dark",
  zones: [
    { x0: 13, y0: 1, x1: 27, y1: 9, floor: "wetstone", wall: "stone" },
    { x0: 13, y0: 3, x1: 27, y1: 4, floor: "grate", wall: "stone" },
    { x0: 13, y0: 8, x1: 27, y1: 9, floor: "grate", wall: "stone" },
    { x0: 1, y0: 14, x1: 10, y1: 21, floor: "cobble", wall: "stone" },
    { x0: 13, y0: 14, x1: 29, y1: 21, floor: "flag", wall: "stone" },
    { x0: 32, y0: 12, x1: 40, y1: 27, floor: "wetstone", wall: "mine" },
    { x0: 32, y0: 14, x1: 40, y1: 16, floor: "grate", wall: "mine" },
    { x0: 17, y0: 24, x1: 28, y1: 30, floor: "plank", wall: "stone" },
  ],
  objects,
  lines: [
    // 관은 벽을 따라서만 — 방 어귀 칸(R1→R2 x13, R3→R4 x32 y18~21)은 비운다(관 선은 지나갈 수 없다).
    { id: "pipe", cells: [{ x: 27, y: 4 }, { x: 27, y: 5 }, { x: 27, y: 6 }] },
    { id: "pipe", cells: [{ x: 32, y: 23 }, { x: 32, y: 24 }, { x: 32, y: 25 }, { x: 32, y: 26 }, { x: 32, y: 27 }, { x: 33, y: 27 }] },
    { id: "pipe", cells: [{ x: 40, y: 19 }, { x: 40, y: 20 }, { x: 40, y: 21 }, { x: 40, y: 22 }, { x: 40, y: 23 }, { x: 40, y: 24 }, { x: 40, y: 25 }] },
  ],
};

/** 방마다 불빛 — 어둡지만 길은 보이게(R1 의 두 횃불·승강 발판 빛은 act2Opening.ts 가 따로 둔다). */
export const WELL_SHAFT_LIGHTS = [
  { id: "r2a", at: { x: 17, y: 2 }, radius: 4, intensity: 0.7, color: "#9fd0ff", flicker: true },
  { id: "r2b", at: { x: 25, y: 2 }, radius: 4, intensity: 0.7, color: "#9fd0ff", flicker: true },
  { id: "r2pool", at: { x: 22, y: 6 }, radius: 3, intensity: 0.45, color: "#6fb8ff" },
  { id: "r5a", at: { x: 2, y: 15 }, radius: 4, intensity: 0.8, color: "#ffb860", flicker: true },
  { id: "r5b", at: { x: 9, y: 15 }, radius: 4, intensity: 0.8, color: "#ffb860", flicker: true },
  { id: "r3a", at: { x: 18, y: 15 }, radius: 4, intensity: 0.8, color: "#ffb860", flicker: true },
  { id: "r3b", at: { x: 26, y: 15 }, radius: 4, intensity: 0.8, color: "#ffb860", flicker: true },
  { id: "r4a", at: { x: 35, y: 13 }, radius: 4, intensity: 0.8, color: "#ffb860", flicker: true },
  { id: "r4b", at: { x: 38, y: 13 }, radius: 4, intensity: 0.8, color: "#ffb860", flicker: true },
  { id: "r4pool", at: { x: 37, y: 23 }, radius: 3, intensity: 0.45, color: "#6fb8ff" },
  { id: "r6a", at: { x: 19, y: 25 }, radius: 4, intensity: 0.8, color: "#ffc070", flicker: true },
  { id: "r6b", at: { x: 26, y: 25 }, radius: 4, intensity: 0.8, color: "#ffc070", flicker: true },
];
