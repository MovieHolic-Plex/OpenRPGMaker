// 버들항 읍의 광장 — 테를 두른 네모, 길은 변 가운데로, 안은 게임마다 한 가지 돌.
//
// 왜(2026-11-14 오너 «광장의 바닥 타일도 항상 같은게 맘에 안들고 무작위처럼 깔린 것도 맘에 안 들어» · «그래 광장이 이렇게 깔끔해야 맞지»):
// 광장은 같은 판석 한 칸이 둥근 얼룩으로 깔려 있었다. 참고 그림의 광장은 테를 두른 네모이고 길이 변 가운데로 들어온다.
// 시골 마을의 흙(beodeulCommons.ts)은 굽이치고, 읍의 돌은 반듯하다 — 두 말씨를 섞지 않는다. 여기는 반듯한 쪽이다.
//
// 순수 계산만 한다(격자 사실을 받아 칸 목록을 돌려준다).

export interface SquareBox { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number }
/** 광장 칸의 네모 둘레. */
export function squareBox(W: number, cells: readonly number[]): SquareBox | null {
  if (!cells.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (const c of cells) { const x = c % W, y = (c - x) / W; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1 };
}

/** 광장의 테(바깥 한 칸 줄)와 안 — 테는 길 포석으로 깔아 연석이 되고, 안은 그 게임의 광장 돌 한 가지다. */
export function squareRing(W: number, H: number, cells: Iterable<number>): { ring: number[]; inner: number[] } {
  const set = new Set(cells); const ring: number[] = [], inner: number[] = [];
  for (const c of set) {
    const x = c % W, y = (c - x) / W; let edge = false;
    for (let dy = -1; dy <= 1 && !edge; dy += 1) for (let dx = -1; dx <= 1 && !edge; dx += 1) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || !set.has(ny * W + nx)) edge = true;
    }
    (edge ? ring : inner).push(c);
  }
  return { ring, inner };
}

/**
 * 광장의 변 가운데로 들어오는 길: 남쪽 변 가운데에서 곧게 내려가(세 칸 폭, 안 되면 한 칸) · 동·서 변 가운데에서 곧게 나가(두 칸 폭)
 * 열네 칸 안에 길을 만나면 그 사이 빈 칸을 길로 낸다. 건물·소품·물에 막히면 그 변은 내지 않는다(북쪽 변은 큰길이 지난다).
 */
export function squareApproaches(W: number, H: number, box: SquareBox, open: (cell: number) => boolean, road: (cell: number) => boolean): number[] {
  const out: number[] = [];
  const mx = Math.round((box.x0 + box.x1) / 2), my = Math.round((box.y0 + box.y1) / 2);
  const run = (lines: readonly number[], vertical: boolean, from: number, step: 1 | -1): number[] | null => {
    const cells: number[] = [];
    for (let k = 0; k < 14; k += 1) {
      const t = from + k * step;
      if (t < 1 || t >= (vertical ? H : W) - 1) return null;
      const row = lines.map((l) => (vertical ? t * W + l : l * W + t));
      if (row.some((c) => road(c))) return cells.length ? cells : null;
      if (!row.every((c) => open(c))) return null;
      cells.push(...row);
    }
    return null;
  };
  out.push(...(run([mx - 1, mx, mx + 1], true, box.y1 + 1, 1) ?? run([mx], true, box.y1 + 1, 1) ?? []));
  out.push(...(run([my, my + 1], false, box.x0 - 1, -1) ?? []));
  out.push(...(run([my, my + 1], false, box.x1 + 1, 1) ?? []));
  return out;
}

/**
 * 광장 안 돌(게임마다 한 가지 — 이음이 반듯한 것만). 게임 열쇠로 고른다(요청 낱말을 보지 않는다).
 * 강자갈 마당(«버들항 마당 · 자갈»)은 쓰지 않는다(2026-11-14 오너 «"강자갈 마당" 은 너무 어색하군»).
 */
export const SQUARE_FLOORS: readonly { readonly id: string; readonly label: string; readonly kit?: string }[] = [
  { id: "slate", label: "청회색 판석", kit: "bd-pick-snowfield-ground-plaza" },
  { id: "court", label: "안뜰과 같은 판석(짙은 테만)" },
];
