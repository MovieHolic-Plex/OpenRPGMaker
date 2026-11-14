// 버들항 마을의 빈 땅에 쓰임을 — 건물도 밭도 울타리도 없는 화면에 울타리 두른 밭 자리를 고른다.
//
// 왜(2026-11-14 오너의 참고 마을 · «화면마다 볼 것»): 참고 그림은 어느 화면을 잘라도 집·밭·울타리 가운데 하나가 걸린다. 우리 마을은 흙이 굽이쳐
// 떠난 자리와 길이 안 닿는 귀퉁이에 풀과 덤불만 있는 화면이 남았다(20×15 창 1,181개 가운데 그런 창 36 → 흙 몸을 깐 뒤 56).
//
// 바닥과 울타리로 되는 것만 한다(밭) — 기물은 놓지 않는다(생업 장면은 다른 파일의 몫이다). 순수 계산만 한다: 격자 사실을 받아 밭 자리 후보를 돌려주고,
// 시공기가 그 자리에 울타리 문에서 길까지 걸어갈 수 있는지 보고 깐다. 조수가 자리를 직접 준 마을에는 쓰지 않는다(코드가 빈 땅을 골라 채우지 않는다).

export interface LandUseInput {
  readonly W: number; readonly H: number; readonly seed: number;
  /** 화면에 «볼 것» 으로 세는 칸인가(건물 · 기물 · 밭 · 울타리 — 나무·덤불·풀꽃은 아니다). */
  readonly used: (cell: number) => boolean;
  /** 밭이 설 수 있는 빈 칸인가(빈 땅 · 계단 아님). */
  readonly free: (cell: number) => boolean;
  /** 창 크기와 걸음(기본 20×15, 다섯 칸). */
  readonly window?: { readonly w: number; readonly h: number; readonly step: number };
}
export interface LandPlot { readonly x: number; readonly y: number; readonly w: number; readonly h: number; /** 이 밭이 채우는 빈 창 수. */ readonly windows: number }

const hash = (x: number, y: number, seed: number): number => {
  let h = Math.imul(x * 73856093 ^ y * 19349663 ^ seed * 83492791, 0x27d4eb2d);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};

/** «볼 것» 이 하나도 없는 창의 왼쪽 위 칸들. */
export function emptyWindows(inp: Pick<LandUseInput, "W" | "H" | "used" | "window">): { x: number; y: number }[] {
  const { W, H } = inp; const { w, h, step } = inp.window ?? { w: 20, h: 15, step: 5 };
  // 누적 합으로 창마다 쓰인 칸 수를 센다
  const sum = new Int32Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) sum[(y + 1) * (W + 1) + x + 1] = (inp.used(y * W + x) ? 1 : 0) + sum[y * (W + 1) + x + 1]! + sum[(y + 1) * (W + 1) + x]! - sum[y * (W + 1) + x]!;
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y + h <= H; y += step) for (let x = 0; x + w <= W; x += step) {
    const n = sum[(y + h) * (W + 1) + x + w]! - sum[y * (W + 1) + x + w]! - sum[(y + h) * (W + 1) + x]! + sum[y * (W + 1) + x]!;
    if (!n) out.push({ x, y });
  }
  return out;
}

/**
 * 밭 자리 후보: 밭 네모와 둘레 한 칸(울타리)과 그 바깥 한 칸이 모두 빈 땅인 자리 가운데 빈 창을 가장 많이 채우는 것부터(같으면 자리 해시 순).
 * 빈 창이 없으면 빈 목록. 후보는 서로 다른 자리 스물넷까지 — 시공기가 울타리 문에서 길까지 걸어갈 수 있는 첫 자리에 깐다.
 */
export function planLandPlots(inp: LandUseInput): LandPlot[] {
  const { W, H, seed } = inp; const win = inp.window ?? { w: 20, h: 15, step: 5 };
  const empty = emptyWindows(inp);
  if (!empty.length) return [];
  const blocked = new Int32Array((W + 1) * (H + 1)); // 빈 땅이 아닌 칸의 누적 합
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) blocked[(y + 1) * (W + 1) + x + 1] = (inp.free(y * W + x) ? 0 : 1) + blocked[y * (W + 1) + x + 1]! + blocked[(y + 1) * (W + 1) + x]! - blocked[y * (W + 1) + x]!;
  const clear = (x0: number, y0: number, x1: number, y1: number) => x0 >= 0 && y0 >= 0 && x1 < W && y1 < H
    && blocked[(y1 + 1) * (W + 1) + x1 + 1]! - blocked[y0 * (W + 1) + x1 + 1]! - blocked[(y1 + 1) * (W + 1) + x0]! + blocked[y0 * (W + 1) + x0]! === 0;
  const out: (LandPlot & { r: number })[] = [];
  for (const [w, h] of [[8, 4], [7, 4], [6, 3], [5, 3]] as const) for (let y = 2; y + h + 2 <= H; y += 1) for (let x = 2; x + w + 2 <= W; x += 1) {
    if (!clear(x - 2, y - 2, x + w + 1, y + h + 1)) continue;
    // 울타리까지 든 네모가 걸치는 빈 창 수
    let n = 0; for (const e of empty) if (e.x <= x + w && e.x + win.w - 1 >= x - 1 && e.y <= y + h && e.y + win.h - 1 >= y - 1) n += 1;
    if (n) out.push({ x, y, w, h, windows: n, r: hash(x, y, seed + w) });
  }
  out.sort((a, b) => b.windows - a.windows || b.w * b.h - a.w * a.h || a.r - b.r);
  // 겹치는 자리는 하나만(가장 좋은 것) — 스물넷까지
  const picked: LandPlot[] = [];
  for (const p of out) {
    if (picked.length >= 24) break;
    if (picked.some((q) => p.x <= q.x + q.w + 1 && p.x + p.w + 1 >= q.x && p.y <= q.y + q.h + 1 && p.y + p.h + 1 >= q.y)) continue;
    picked.push({ x: p.x, y: p.y, w: p.w, h: p.h, windows: p.windows });
  }
  return picked;
}
