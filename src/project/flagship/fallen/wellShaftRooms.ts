/**
 * 『폴른 스타』 2막 B3 — 광장 우물 밑 「옛 상수도」(버들항 칩셋 beodeul_city, 지하 수도교 키트 · lay_dungeon_layout).
 *
 * 2026-11-09 오너: 「우물 갱도도 좀 ... 복잡하고 우물 밑에 사는 괴물 이런 중간보스도 좀 만들고」 →
 * 「우물 갱도라고 하기엔 컨셉이 안맞잖아」 → 「수로의 이미지가 전혀 아니잖아」. 그래서 물길이 방의 주인이다(바닥의 30%가 물):
 *   landing  첫 층계참 — 우물 사다리(올라가는 계단)가 내려선 자리, 낭떠러지 밑에 물이 고였다. 승강 장치(천문대 서고) — 이야기 길은 여기서 끝난다.
 *   cistern  첫 저수조 — 가운데 물(35%) 위 돌다리, 둘레 정비 발판. 남쪽 쇠살문은 west 의 고패로 연다.
 *   west     서쪽 배수 갱 — 세로 물길(27%)과 다리, 고패·물지기 석판.
 *   drain    배수로 회랑 — 가로 물길(23%)과 다리 둘. cistern·west·sluice·niche 를 잇는 고리.
 *   niche    정비 벽감 — 무너진 돌 더미 뒤(조사하면 치운다), 물지기 연장 궤짝.
 *   sluice   수문 앞방 — 쉼터 결정.
 *   oldest   가장 오래된 저수조 — 반 넘게 잠긴 물(63%) 가에 우물 밑 눈먼 영주(중간 보스).
 * 무덤·뼈 소품은 쓰지 않는다. 좌표는 지어진 맵 기준(이벤트는 wellBeast.ts · act2Opening.ts 가 같은 좌표에 둔다).
 */

type Cell = { x: number; y: number };

export const WELL_SHAFT_TILESET = "beodeul_city";
export const WELL_SHAFT_LAYOUT = {"name": "우물 밑 · 옛 상수도", "theme": "catacomb", "map": {"w": 56, "h": 38}, "rooms": [{"id": "landing", "purpose": "entrance", "rects": [{"x": 2, "y": 4, "w": 12, "h": 8}], "landmark": {"id": "valve wheel", "x": 2, "y": 9}}, {"id": "cistern", "purpose": "puzzle", "rects": [{"x": 18, "y": 4, "w": 20, "h": 12}], "landmark": {"id": "valve wheel", "x": 35, "y": 4}}, {"id": "west", "purpose": "other", "rects": [{"x": 2, "y": 17, "w": 10, "h": 11}], "landmark": {"id": "lever up", "x": 9, "y": 16}}, {"id": "drain", "purpose": "guard", "rects": [{"x": 15, "y": 20, "w": 23, "h": 8}], "landmark": {"id": "manifold 3", "x": 16, "y": 20}}, {"id": "niche", "purpose": "treasure", "rects": [{"x": 22, "y": 32, "w": 8, "h": 5}], "landmark": {"id": "crate stack", "x": 22, "y": 32}}, {"id": "sluice", "purpose": "antechamber", "rects": [{"x": 41, "y": 20, "w": 8, "h": 8}], "landmark": {"id": "lantern post", "x": 41, "y": 20}}, {"id": "oldest", "purpose": "boss", "rects": [{"x": 41, "y": 4, "w": 13, "h": 12}], "landmark": {"id": "column sewer", "x": 41, "y": 4}}], "corridors": [{"id": "c_land_cist", "from": "landing", "to": "cistern", "width": 2, "path": [[14, 10], [17, 10]]}, {"id": "c_land_west", "from": "landing", "to": "west", "width": 2, "path": [[3, 12], [3, 16]]}, {"id": "c_west_drain", "from": "west", "to": "drain", "width": 2, "path": [[12, 25], [14, 25]]}, {"id": "c_cist_drain", "from": "cistern", "to": "drain", "width": 2, "path": [[26, 16], [26, 19]]}, {"id": "c_drain_niche", "from": "drain", "to": "niche", "width": 2, "path": [[25, 28], [25, 31]]}, {"id": "c_drain_sluice", "from": "drain", "to": "sluice", "width": 2, "path": [[38, 25], [40, 25]]}, {"id": "c_sluice_old", "from": "sluice", "to": "oldest", "width": 2, "path": [[42, 16], [42, 19]]}], "doors": [{"x": 14, "y": 10, "connects": ["c_land_cist", "landing"]}, {"x": 17, "y": 10, "connects": ["c_land_cist", "cistern"]}, {"x": 3, "y": 12, "connects": ["c_land_west", "landing"]}, {"x": 3, "y": 16, "connects": ["c_land_west", "west"]}, {"x": 12, "y": 25, "connects": ["c_west_drain", "west"]}, {"x": 14, "y": 25, "connects": ["c_west_drain", "drain"]}, {"x": 26, "y": 16, "connects": ["c_cist_drain", "cistern"]}, {"x": 26, "y": 19, "connects": ["c_cist_drain", "drain"], "locked": true}, {"x": 25, "y": 28, "connects": ["c_drain_niche", "drain"]}, {"x": 25, "y": 31, "connects": ["c_drain_niche", "niche"]}, {"x": 38, "y": 25, "connects": ["c_drain_sluice", "drain"]}, {"x": 40, "y": 25, "connects": ["c_drain_sluice", "sluice"]}, {"x": 42, "y": 16, "connects": ["c_sluice_old", "oldest"]}, {"x": 42, "y": 19, "connects": ["c_sluice_old", "sluice"]}], "hazards": [{"kind": "pit", "x": 9, "y": 4, "w": 4, "h": 2}, {"kind": "water", "x": 9, "y": 6, "w": 5, "h": 4}, {"kind": "water", "x": 5, "y": 17, "w": 4, "h": 11}, {"kind": "water", "x": 47, "y": 4, "w": 7, "h": 12}, {"kind": "water", "x": 44, "y": 11, "w": 3, "h": 5}, {"kind": "water", "x": 28, "y": 4, "w": 4, "h": 12}, {"kind": "water", "x": 19, "y": 6, "w": 6, "h": 4}, {"kind": "water", "x": 35, "y": 6, "w": 3, "h": 7}, {"kind": "water", "x": 29, "y": 20, "w": 4, "h": 8}, {"kind": "water", "x": 15, "y": 22, "w": 10, "h": 2}, {"kind": "water", "x": 36, "y": 20, "w": 2, "h": 3}], "bridges": [{"x": 28, "y": 9, "w": 4, "h": 2}, {"x": 5, "y": 21, "w": 4, "h": 2}, {"x": 29, "y": 23, "w": 4, "h": 2}], "objects": [{"id": "stairs up", "x": 4, "y": 2}, {"id": "torch wall", "x": 7, "y": 3}, {"id": "pipe copper", "x": 2, "y": 5}, {"id": "bucket", "x": 8, "y": 10}, {"id": "torch wall", "x": 19, "y": 3}, {"id": "arch water", "x": 24, "y": 2}, {"id": "arch water", "x": 33, "y": 2}, {"id": "torch wall", "x": 36, "y": 3}, {"id": "valve wheel", "x": 18, "y": 13}, {"id": "barrel", "x": 36, "y": 14}, {"id": "dock post", "x": 33, "y": 5}, {"id": "fish net", "x": 34, "y": 14}, {"id": "pipe copper", "x": 19, "y": 5}, {"id": "grate floor", "x": 24, "y": 13}, {"id": "torch wall", "x": 8, "y": 15}, {"id": "crate", "x": 10, "y": 26}, {"id": "bucket", "x": 2, "y": 26}, {"id": "pipe copper leak", "x": 10, "y": 18}, {"id": "torch wall", "x": 19, "y": 19}, {"id": "arch bars", "x": 22, "y": 18}, {"id": "torch wall", "x": 34, "y": 19}, {"id": "grate floor", "x": 23, "y": 26}, {"id": "barrel", "x": 36, "y": 26}, {"id": "valve wheel", "x": 20, "y": 26}, {"id": "pipe copper", "x": 15, "y": 26}, {"id": "bucket", "x": 28, "y": 35}, {"id": "barrel", "x": 29, "y": 35}, {"id": "torch wall", "x": 46, "y": 19}, {"id": "barrel", "x": 48, "y": 26}, {"id": "arch water", "x": 42, "y": 2}, {"id": "torch wall", "x": 44, "y": 3}, {"id": "pipe copper leak", "x": 43, "y": 14}, {"id": "valve wheel", "x": 46, "y": 5}, {"id": "waystone", "x": 2, "y": 17}, {"id": "lectern", "x": 34, "y": 4}, {"id": "waystone", "x": 47, "y": 20}, {"id": "grate floor", "x": 5, "y": 7}, {"id": "grate floor", "x": 6, "y": 7}, {"id": "grate floor", "x": 5, "y": 8}, {"id": "grate floor", "x": 6, "y": 8}], "chests": [{"x": 23, "y": 35}, {"x": 27, "y": 33}, {"x": 4, "y": 18}], "boss": {"x": 44, "y": 8}} as const;

/** 물길 셋을 동서로 건너는 아치 돌다리(bd-wellboss-bridge-ew, 8×4, 가운데 두 줄이 걷는 칸) — 배치의 bridges 칸 위에 찍는다. 오너 위임 허용 2026-11-10(Discord 1569386677355552961). */
export const WELL_SHAFT_BRIDGES: readonly Cell[] = [{ x: 26, y: 8 }, { x: 3, y: 20 }, { x: 27, y: 22 }];

export const WELL = {
  /** 우물에서 내려오는 사다리 = 입구 「올라가는 계단」 조각(4,2)-(4,3). 조사 칸은 그 아랫칸, 도착 칸은 그 앞. */
  ladder: { x: 4, y: 2 } as Cell, ladderUse: { x: 4, y: 3 } as Cell, arrive: { x: 4, y: 4 } as Cell,
  /** 천문대로 오르는 승강 발판(2×2 왼쪽 위). */
  lift: { x: 5, y: 7 } as Cell,
  /** cistern → drain 쇠살문(잠긴 문 칸). */
  gate: [{ x: 26, y: 19 }, { x: 27, y: 19 }] as Cell[],
  /** west 고패 — 벽 손잡이(9,16) 바로 아래 바닥 칸에서 조사. */
  winch: { x: 9, y: 17 } as Cell,
  tabletWell: { x: 2, y: 18 } as Cell,
  ledger: { x: 31, y: 5 } as Cell,
  tabletNest: { x: 47, y: 21 } as Cell,
  /** drain → niche 통로를 막은 돌 더미(두 칸). */
  crack: [{ x: 25, y: 29 }, { x: 26, y: 29 }] as Cell[],
  chestHidden: { x: 23, y: 35 } as Cell,
  chestHidden2: { x: 27, y: 33 } as Cell,
  chestCorner: { x: 4, y: 18 } as Cell,
  beast: { x: 44, y: 8 } as Cell,
  wakeLine: [{ x: 42, y: 17 }, { x: 43, y: 17 }] as Cell[],
  save: { x: 46, y: 22 } as Cell,
};

/** 방마다 불빛 — 어둡지만 물가와 길은 보이게. 물 위에는 푸른 반사광. */
export const WELL_SHAFT_LIGHTS = [
  { id: "l1", at: { x: 7, y: 4 }, radius: 4, intensity: 0.8, color: "#ffb860", flicker: true },
  // 우물 계단 — 벽 속으로 오르는 단이 위로 갈수록 어두워지는 게 보이려면 계단 자체에 빛이 있어야 한다(ambient 0.55 만으로는 검은 판).
  // 문 아치 옆 벽 횃불(그림 속 횃불 자리)과 아래 착지를 비추는 낮은 불빛 둘.
  // 위가 밝으면 오르는 계단이 아니라 패인 벽으로 읽힌다(리드 실측) — 횃불은 문 아치 옆에서 작게, 빛은 아래 단부터 착지로 세게.
  { id: "st_top", at: { x: 3, y: 1 }, radius: 1.2, intensity: 0.45, color: "#ffb860", flicker: true },
  { id: "st_foot", at: { x: 4, y: 4 }, radius: 3.2, intensity: 0.95, color: "#ffd9a8" },
  { id: "c1", at: { x: 19, y: 4 }, radius: 4, intensity: 0.75, color: "#ffb860", flicker: true },
  { id: "c2", at: { x: 36, y: 4 }, radius: 4, intensity: 0.75, color: "#ffb860", flicker: true },
  { id: "cw", at: { x: 28, y: 9 }, radius: 4, intensity: 0.45, color: "#6fc8d8" },
  { id: "w1", at: { x: 8, y: 17 }, radius: 4, intensity: 0.75, color: "#ffb860", flicker: true },
  { id: "ww", at: { x: 6, y: 23 }, radius: 3, intensity: 0.4, color: "#6fc8d8" },
  { id: "d1", at: { x: 19, y: 20 }, radius: 4, intensity: 0.75, color: "#ffb860", flicker: true },
  { id: "d2", at: { x: 35, y: 20 }, radius: 4, intensity: 0.75, color: "#ffb860", flicker: true },
  { id: "dw", at: { x: 27, y: 24 }, radius: 4, intensity: 0.4, color: "#6fc8d8" },
  { id: "n1", at: { x: 25, y: 33 }, radius: 4, intensity: 0.75, color: "#ffc070", flicker: true },
  { id: "s1", at: { x: 41, y: 21 }, radius: 4, intensity: 0.85, color: "#ffd080", flicker: true },
  { id: "o1", at: { x: 44, y: 4 }, radius: 4, intensity: 0.75, color: "#ffb860", flicker: true },
  { id: "ow", at: { x: 50, y: 10 }, radius: 5, intensity: 0.45, color: "#6fc8d8" },
];
