// 버들항 포구의 돌 둑 — 물가를 곧게 편 포장 띠. 잔교는 이 둑에서 뻗고, 길은 둑 뒤로 들어온다.
//
// 왜(2026-11-14 오너의 참고 마을): 참고 그림의 항구는 물가가 돌 둑으로 곧고 그 위에 살림이 놓인다. 우리 포구는 풀밭이 들쭉날쭉한 물가까지
// 내려가고 잔교 하나가 풀에서 바로 뻗어 «바닷가 농촌» 으로 읽혔다.
//
// 뭍 쪽만 한다: 둑 띠(뭍 칸의 포장)와, 물가를 곧게 펴려고 메우는 물 칸(뭍을 넓히는 쪽으로만 — 물을 새로 파지 않는다).
// 물 칸의 그림·물가 테·물 위 기물·잔교 몸통은 건드리지 않는다. 순수 계산만 한다(격자 사실을 받아 칸 목록을 돌려준다).
// 남쪽이 바다인 물가만(잔교 그림이 남쪽으로만 뻗는다) — 동·서로 난 물가와 강가 어촌의 굽은 둑은 다루지 않는다.

export interface QuayInput {
  readonly W: number; readonly H: number;
  /** 둑이 설 자리의 기준(일터 · 모이는 곳) — 가장 가까운 물가에 둑을 낸다. */
  readonly near: { readonly x: number; readonly y: number };
  /** 바다 칸인가. */
  readonly sea: (cell: number) => boolean;
  /** 포장할 수 있는 빈 뭍 칸인가(건물·소품·길·계단이 아닌 빈 땅). */
  readonly land: (cell: number) => boolean;
  readonly level: (cell: number) => number;
}
export interface QuayPlan {
  /** 포장할 뭍 칸(물가 줄과 그 뒤 두 줄까지). */
  readonly cells: number[];
  /** 메워서 둑이 되는 물 칸(물가를 곧게 편다). */
  readonly fill: number[];
  /** 둑 앞줄(물에 닿는 줄)의 곧은 구간. */
  readonly front: { readonly x0: number; readonly x1: number; readonly y: number };
  /** 길망에 이을 자리 후보(둑 맨 뒷줄 바로 뒤 빈 땅 — 가운데부터). */
  readonly links: { x: number; y: number }[];
}

export function planQuay(inp: QuayInput): QuayPlan | null {
  const { W, H, near } = inp;
  const idx = (x: number, y: number) => y * W + x;
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const sea = (x: number, y: number) => inMap(x, y) && inp.sea(idx(x, y));
  // 기준에 가까운 물가 칸부터(뭍 칸 · 바로 아래가 같은 높이의 바다) — 들쭉날쭉해 둑이 안 서는 자리면 다음 자리를 본다
  const reach = Math.max(26, (W + H) / 3.5);
  const anchors: { x: number; y: number; d: number }[] = [];
  for (let y = 2; y < H - 3; y += 1) for (let x = 2; x < W - 2; x += 1) {
    const c = idx(x, y);
    if (!inp.land(c) || !sea(x, y + 1) || inp.level(c) !== inp.level(c + W)) continue;
    const d = Math.abs(x - near.x) + Math.abs(y - near.y) * 1.3;
    if (d <= reach) anchors.push({ x, y, d });
  }
  anchors.sort((a, b) => a.d - b.d);
  const tried: number[] = [];
  for (const a of anchors) {
    if (tried.length >= 14) break;
    if (tried.some((x) => Math.abs(x - a.x) < 4)) continue; // 네 칸 안의 이웃 자리는 같은 물가다
    tried.push(a.x);
    const plan = quayAt(inp, a.x, a.y);
    if (plan) return plan;
  }
  return null;
}

/** 물가 칸 (ax, ay) 곁의 둑 — 양옆으로 물가를 따라가 앞줄이 곧은 가장 긴 구간을 고른다. 일곱 칸이 안 되면 null. */
function quayAt(inp: QuayInput, ax: number, ay: number): QuayPlan | null {
  const { W, H } = inp;
  const idx = (x: number, y: number) => y * W + x;
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const L0 = inp.level(idx(ax, ay)); // 둑은 한 단 위에만
  const land = (x: number, y: number) => inMap(x, y) && inp.land(idx(x, y)) && inp.level(idx(x, y)) === L0;
  const sea = (x: number, y: number) => inMap(x, y) && inp.sea(idx(x, y)) && inp.level(idx(x, y)) === L0;
  /** 그 열에서 want 줄에 가장 가까운 물가 줄(뭍 칸 · 바로 아래가 바다), 두 줄 안에서. */
  const shoreAt = (x: number, want: number): number | null => {
    for (let d = 0; d <= 2; d += 1) for (const y of d ? [want + d, want - d] : [want]) if (land(x, y) && sea(x, y + 1)) return y;
    return null;
  };
  // 양옆으로 물가를 따라간다(이웃 열과 두 줄 넘게 어긋나면 끝) — 한쪽 열두 칸까지
  const row = new Map<number, number>([[ax, ay]]);
  for (const step of [1, -1]) for (let x = ax + step, prev = ay, n = 0; n < 12 && x >= 2 && x < W - 2; x += step, n += 1) {
    const r = shoreAt(x, prev); if (r === null) break;
    row.set(x, r); prev = r;
  }
  // 한 열: 물가 줄 r 이 앞줄 Y 보다 두 줄까지 들어가 있으면 그 사이 물을 메운다. 앞줄보다 바다로 나온 뭍은 둑에 넣지 않는다(물을 파지 않으므로 앞줄이 곧지 않게 된다).
  const column = (x: number, Y: number): { cells: number[]; fill: number[] } | null => {
    const r = row.get(x); if (r === undefined || r > Y || Y - r > 2) return null;
    const cells: number[] = [], fill: number[] = [];
    for (let y = r + 1; y <= Y; y += 1) { if (!sea(x, y)) return null; fill.push(idx(x, y)); }
    if (!sea(x, Y + 1)) return null; // 둑 앞은 바다여야 한다
    cells.push(idx(x, r));
    // 뒤로 두 줄 더(세 줄 깊이) — 건물·소품·절벽이 있으면 거기까지만
    for (let y = r - 1; y >= Y - 2; y -= 1) { if (!land(x, y)) break; cells.push(idx(x, y)); }
    return { cells, fill };
  };
  // 앞줄 = 기준 열 곁에서 곧은 구간이 가장 길게 나오는 줄 — 메우는 물 칸은 점수에서 깎는다(한 줄을 통째로 메워 곧게 펴지 않는다). 같으면 바다 쪽.
  let bestRun: { Y: number; x0: number; x1: number; score: number } | null = null;
  for (const Y of [...new Set(row.values())].sort((a, b) => b - a)) {
    const start = [...row.keys()].sort((a, b) => Math.abs(a - ax) - Math.abs(b - ax)).find((x) => Math.abs(x - ax) <= 3 && column(x, Y));
    if (start === undefined) continue;
    let x0 = start, x1 = start;
    while (column(x1 + 1, Y)) x1 += 1;
    while (column(x0 - 1, Y)) x0 -= 1;
    let filled = 0; for (let x = x0; x <= x1; x += 1) filled += column(x, Y)!.fill.length;
    const score = x1 - x0 + 1 - filled * 0.6;
    if (x1 - x0 + 1 >= 7 && (!bestRun || score > bestRun.score)) bestRun = { Y, x0, x1, score };
  }
  if (!bestRun) return null;
  const { Y, x0, x1 } = bestRun;
  const cells: number[] = [], fill: number[] = [];
  for (let x = x0; x <= x1; x += 1) { const col = column(x, Y)!; cells.push(...col.cells); fill.push(...col.fill); }
  // 길망에 이을 자리: 둑 뒤 한 칸(뒷줄 바로 위) — 가운데 열부터 바깥으로
  const taken = new Set(cells); const links: { x: number; y: number }[] = [];
  const mid = Math.round((x0 + x1) / 2);
  for (let d = 0; d <= x1 - x0; d += 1) for (const x of d ? [mid + d, mid - d] : [mid]) {
    if (x < x0 || x > x1) continue;
    let top = row.get(x)!; while (taken.has(idx(x, top - 1))) top -= 1; // 그 열의 둑 맨 뒷줄
    if (land(x, top - 1)) links.push({ x, y: top - 1 });
  }
  return { cells, fill, front: { x0, x1, y: Y }, links };
}
