// 벽면 대 바닥 대비 - 2026-10-20 R20 사용자 「벽면이 바닥과 구분이 안 된다(진료소 연녹 벽 + 연녹 바닥, 시청 크림 벽 + 크림 타일)」.
// modern_city 칩셋(modern-city-chipset.png)의 바닥 9종·벽면 8종 타일 평균색(CIE Lab, 불투명 화소)이다. 벽면 두 줄과 바닥이 한 방에서 만나므로
// 한 방의 (바닥, 벽면) 쌍이 아래 문턱을 못 넘으면 같은 칩셋의 기존 바닥·벽면 중 원래 재질에서 가장 덜 바뀌는 쌍으로 바꾼다 - 새 그림은 없다.
export type Lab = readonly [number, number, number];

export const FLOOR_LAB: Readonly<Record<string, Lab>> = {
  "mci-carpet-office": [43.4, -5.4, -6.0], "mci-stone-lobby": [74.2, 1.0, 14.9], "mci-vinyl-store": [81.3, 0.3, -4.1], "mci-wood-oak": [54.5, 8.9, 36.8],
  "mci-wood-dark": [33.1, 18.5, 10.1], "mci-vinyl-hospital": [69.4, -11.3, 7.4], "mci-tile-concourse": [60.7, -0.1, -3.3], "mci-concrete": [64.6, 1.2, -5.4], "mci-tile-small": [79.9, 0.2, -3.8],
};
export const WALL_LAB: Readonly<Record<string, Lab>> = {
  "mci-wall-office": [76.7, 0.3, -4.1], "mci-wall-lobby": [69.2, 1.2, 14.7], "mci-wall-store": [78.2, 3.9, 0.5], "mci-wall-home": [70.9, 0.1, 15.7],
  "mci-wall-hospital": [75.9, -4.3, 1.1], "mci-wall-brick": [37.8, 13.9, 15.2], "mci-wall-tile": [70.7, -1.8, -4.8], "mci-wall-metal": [55.5, 1.4, -6.2],
};

/** 벽면·바닥이 갈리는 최소 대비: 평균 Lab 색차 ΔE 이상(명도차만으로 모자라면 색상차가 메운다). */
export const MIN_WALL_FLOOR_DELTA_E = 20;

const dE = (a: Lab, b: Lab): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** 한 방의 벽면·바닥 평균색 차이(ΔE). 모르는 재질이면 undefined. */
export function wallFloorDelta(floor: string | undefined, wall: string | undefined): number | undefined {
  const f = floor ? FLOOR_LAB[floor] : undefined, w = wall ? WALL_LAB[wall] : undefined;
  return f && w ? dE(f, w) : undefined;
}

/** 문턱을 못 넘는 (바닥, 벽면) 쌍을 바닥 하나 또는 벽면 하나만 바꿔 넘긴다 - 원래 재질과 평균색이 가장 가까운 대체를 고른다. 넘으면 그대로. */
export function contrastPair(floor: string | undefined, wall: string | undefined): { floor: string | undefined; wall: string | undefined; changed: boolean } {
  const d = wallFloorDelta(floor, wall);
  if (d === undefined || d >= MIN_WALL_FLOOR_DELTA_E) return { floor, wall, changed: false };
  const f0 = FLOOR_LAB[floor!]!, w0 = WALL_LAB[wall!]!;
  let best: { floor: string; wall: string; cost: number } | undefined;
  for (const [f, fl] of Object.entries(FLOOR_LAB)) {
    if (f !== floor && dE(fl, w0) >= MIN_WALL_FLOOR_DELTA_E) { const cost = dE(fl, f0); if (!best || cost < best.cost) best = { floor: f, wall: wall!, cost }; }
  }
  for (const [w, wl] of Object.entries(WALL_LAB)) {
    if (w !== wall && dE(f0, wl) >= MIN_WALL_FLOOR_DELTA_E) { const cost = dE(wl, w0); if (!best || cost < best.cost) best = { floor: floor!, wall: w, cost }; }
  }
  return best ? { floor: best.floor, wall: best.wall, changed: true } : { floor, wall, changed: false };
}
