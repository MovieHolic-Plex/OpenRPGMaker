/**
 * 폴른 스타 · 속삭이는 숲 여섯 맵의 땅 모양 (2026-10-24 r2 — 숲은 왕도 북쪽, 굽은 숲길, B1 활엽 composer).
 *
 * 모든 갈래가 북쪽으로 오른다. 왕도 성문(남) → ① 어귀 → 북서 ③ 가시덤불 샛길 / 북동 ② 옛 수로 → 둘 다 북쪽 ④ 사당 터 → 북쪽 ⑤ 깊은 숲.
 * ② 옛 수로 동쪽 곁길 끝은 ⑥ 사냥꾼 쉼터(막다른 곳). 좌표는 칸(소수 = 두 칸 사이). 출구 = 두 칸 폭 문의 왼쪽/위쪽 칸.
 */
import type { WoodSpec } from "./woodland";

export const FS_FOREST_MAP_IDS = {
  edge: "fs_forest_edge",
  stream: "fs_forest_stream",
  thicket: "fs_forest_thicket",
  shrine: "fs_forest_shrine",
  glade: "fs_forest_glade",
} as const;
const M = FS_FOREST_MAP_IDS;

/** ① 숲 어귀 32×40 — 성문 길이 들풀 빈터로 열리고, 굽어 오르다 갈림목에서 북서·북동으로 갈린다. */
export const EDGE_SPEC: WoodSpec = {
  id: M.edge, name: "속삭이는 숲 · 어귀", width: 32, height: 40, seed: 41,
  paths: [
    { pts: [{ x: 15.5, y: 39 }, { x: 14.5, y: 35 }, { x: 16.5, y: 30 }, { x: 15, y: 25 }, { x: 16, y: 20 }], w: [2.4, 3.6] },
    { pts: [{ x: 16, y: 20 }, { x: 12, y: 16 }, { x: 9, y: 12 }, { x: 9.5, y: 6 }, { x: 7.5, y: 2 }, { x: 7.5, y: 0 }], w: [2, 3] },
    { pts: [{ x: 16, y: 20 }, { x: 20.5, y: 16 }, { x: 24, y: 11 }, { x: 23, y: 6 }, { x: 24.5, y: 2 }, { x: 24.5, y: 0 }], w: [2, 3] },
  ],
  exits: [{ x: 15, y: 39 }, { x: 7, y: 0 }, { x: 24, y: 0 }],
  clearings: [{ cx: 15.5, cy: 35, rx: 5.5, ry: 3.2 }, { cx: 16, cy: 20.5, rx: 4, ry: 3 }, { cx: 26.5, cy: 12.5, rx: 2.6, ry: 2.2 }],
  groves: [{ cx: 10.5, cy: 34.5, rx: 2, ry: 1.5 }],
  nooks: [{ from: { x: 11, y: 12 }, to: { x: 14, y: 11 } }],
};

/** ② 옛 수로 40×32 — 굽은 개울을 돌다리로 건넌다. 북쪽은 사당 터, 동쪽 곁길은 사냥꾼 쉼터. */
export const STREAM_SPEC: WoodSpec = {
  id: M.stream, name: "속삭이는 숲 · 옛 수로", width: 40, height: 32, seed: 91,
  paths: [
    { pts: [{ x: 7.5, y: 31 }, { x: 8, y: 26 }, { x: 11.5, y: 21 }, { x: 15, y: 15.5 }, { x: 19, y: 15.5 }], w: [2.2, 3.2] },
    { pts: [{ x: 25, y: 15.5 }, { x: 29, y: 14 }, { x: 31, y: 9 }, { x: 29.5, y: 4 }, { x: 28.5, y: 0 }], w: [2, 3] },
    { pts: [{ x: 29, y: 14 }, { x: 33, y: 17 }, { x: 36, y: 18.5 }, { x: 39, y: 18.5 }], w: [2, 2.8] },
  ],
  exits: [{ x: 7, y: 31 }, { x: 28, y: 0 }, { x: 39, y: 18 }],
  stream: { pts: [{ x: 16, y: -1 }, { x: 18.5, y: 5 }, { x: 21.5, y: 10 }, { x: 22, y: 16 }, { x: 22.5, y: 21 }, { x: 25.5, y: 26 }, { x: 28.5, y: 32 }], w: [3.6, 5.2], straight: { x: 20, y: 12, w: 5, h: 7 } },
  bridge: { x: 20, y: 14 },
  clearings: [{ cx: 14, cy: 12.5, rx: 3.2, ry: 2.4 }, { cx: 33, cy: 8, rx: 2.4, ry: 2 }],
  nooks: [{ from: { x: 10, y: 22 }, to: { x: 6, y: 19 } }],
};

/** ③ 가시덤불 샛길 30×40 — 덤불 사이로 갈지자로 오르는 좁은 길. 서쪽 곁길 끝 작은 빈터에 상자. */
export const THICKET_SPEC: WoodSpec = {
  id: M.thicket, name: "속삭이는 숲 · 가시덤불 샛길", width: 30, height: 40, seed: 53,
  paths: [
    { pts: [{ x: 17.5, y: 39 }, { x: 19, y: 34 }, { x: 14, y: 30 }, { x: 8.5, y: 26 }, { x: 11, y: 21.5 }, { x: 18, y: 19.5 }, { x: 23, y: 15 }, { x: 19, y: 10 }, { x: 13.5, y: 6 }, { x: 12.5, y: 2 }, { x: 12.5, y: 0 }], w: [2, 3] },
    { pts: [{ x: 8.5, y: 26 }, { x: 5, y: 22 }, { x: 4, y: 17 }, { x: 4.5, y: 13.5 }], w: [2, 2.6] },
  ],
  exits: [{ x: 17, y: 39 }, { x: 12, y: 0 }],
  undergrowth: 2.6,
  clearings: [{ cx: 4.5, cy: 12.5, rx: 2.8, ry: 2.3 }, { cx: 23, cy: 15, rx: 3, ry: 2.4 }],
};

/** ④ 별지기 사당 터 40×30 — 남쪽 두 길(샛길·수로)이 숲속 공터에서 만나고, 북쪽 길이 깊은 숲으로 오른다. 짐승이 들지 않는 쉼터. */
export const SHRINE_SPEC: WoodSpec = {
  id: M.shrine, name: "속삭이는 숲 · 별지기 사당 터", width: 40, height: 30, seed: 67,
  paths: [
    { pts: [{ x: 7.5, y: 29 }, { x: 9, y: 24 }, { x: 13.5, y: 19 }, { x: 18, y: 15.5 }], w: [2, 3] },
    { pts: [{ x: 30.5, y: 29 }, { x: 29.5, y: 24 }, { x: 26, y: 19 }, { x: 22, y: 15.5 }], w: [2, 3] },
    { pts: [{ x: 20, y: 15 }, { x: 19, y: 10 }, { x: 21, y: 5 }, { x: 20.5, y: 0 }], w: [2.2, 3] },
  ],
  exits: [{ x: 7, y: 29 }, { x: 30, y: 29 }, { x: 20, y: 0 }],
  clearings: [{ cx: 20, cy: 14, rx: 8.5, ry: 6 }],
};

/** ⑥ 사냥꾼 쉼터 32×28 — 옛 수로 동쪽 곁길 끝 막다른 빈터. 모닥불·사냥 표지·상자. */
export const GLADE_SPEC: WoodSpec = {
  id: M.glade, name: "속삭이는 숲 · 사냥꾼 쉼터", width: 32, height: 28, seed: 79,
  paths: [{ pts: [{ x: 0, y: 13.5 }, { x: 6, y: 15 }, { x: 11, y: 12 }, { x: 17, y: 13.5 }], w: [2, 3] }],
  exits: [{ x: 0, y: 13 }],
  clearings: [{ cx: 22, cy: 13, rx: 6, ry: 5 }],
  groves: [{ cx: 26.5, cy: 17.5, rx: 1.8, ry: 1.5 }],
};

/** ⑤ 깊은 숲(원래 숲 맵 fs_forest) — 30×36 으로 늘리고 추락지(DEEP_KEEP) 밖을 다시 칠한다. */
export const DEEP_SIZE = { width: 30, height: 36 } as const;
/** 추락지 둑·관·불씨·마른 고목 — 바닥·장식을 그대로 둔다(수관만 걷어 composer 나무로 바꾼다). */
export const DEEP_KEEP = { x: 7, y: 0, w: 18, h: 9 } as const;
export const DEEP_SPEC = (id: string, name: string): WoodSpec => ({
  id, name, width: DEEP_SIZE.width, height: DEEP_SIZE.height, seed: 23,
  paths: [{ pts: [{ x: 14.5, y: 35 }, { x: 12, y: 30.5 }, { x: 15, y: 26 }, { x: 13.5, y: 21 }, { x: 16, y: 15.5 }, { x: 15.5, y: 9 }], w: [2, 3] }],
  exits: [{ x: 14, y: 35 }],
  clearings: [{ cx: 14.5, cy: 19.5, rx: 3.6, ry: 2.6 }],
  nooks: [{ from: { x: 17, y: 27 }, to: { x: 21, y: 28 } }],
});

export const FOREST_SPECS: readonly WoodSpec[] = [EDGE_SPEC, STREAM_SPEC, THICKET_SPEC, SHRINE_SPEC, GLADE_SPEC];
