// 다다미 깔기 — 다다미 바닥은 바닥 무늬(4x4 벽지)가 아니라 통짜 돗자리(1x2 칸)로 깐다.
//
// 왜(2026-10-31, agent/bbox-chipsets-2 scripts/experiments/bbox-chipsets/floors.mts): 바닥 무늬는 맵 원점부터 깔려 벽마다 돗자리가
// 잘렸다(반쪽 돗자리). 칸 배치 3판에서 방마다 통짜로 깔자 판정자가 바닥이 깔끔해졌다고 했다(다다미 12장 · 문턱 · 바닥 섬 0).
// 규칙: 돗자리는 벽에 나란히, 네 돗자리 모서리가 한 점에서 만나지 않는다(祝儀敷き). 깔 수 없으면 null — 호출자가 무늬 그대로 둔다.

export interface TatamiMat { readonly a: number; readonly b: number; readonly dir: "h" | "v" }

/** 칸 집합(y*W+x)을 돗자리로 덮는다. 결정적 되짚기: 행 우선 첫 빈 칸, 짝수 줄은 가로 먼저·홀수 줄은 세로 먼저(엇갈린 모양). */
export function tatamiTiling(cells: ReadonlySet<number>, W: number, budget = 400000): TatamiMat[] | null {
  const order = [...cells].sort((a, b) => a - b);
  if (order.length % 2) return null;
  const owner = new Map<number, number>();
  const mats: TatamiMat[] = [];
  let nodes = 0;
  // 격자 점 (x,y) = 칸 (x-1,y-1),(x,y-1),(x-1,y),(x,y) 이 만나는 점 — 네 칸이 모두 다른 돗자리면 안 된다
  const cornerBad = (x: number, y: number) => {
    if (x < 1 || y < 1 || x >= W) return false;
    const c = [(y - 1) * W + x - 1, (y - 1) * W + x, y * W + x - 1, y * W + x];
    if (!c.every((i) => owner.has(i))) return false;
    return new Set(c.map((i) => owner.get(i))).size === 4;
  };
  const cornersOf = (i: number) => { const x = i % W, y = Math.floor(i / W); return [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]] as const; };
  const go = (k: number): boolean => {
    if (++nodes > budget) return false;
    while (k < order.length && owner.has(order[k]!)) k++;
    if (k >= order.length) return true;
    const i = order[k]!, x = i % W, y = Math.floor(i / W);
    const tries: ["h" | "v", number][] = y % 2 ? [["v", i + W], ["h", i + 1]] : [["h", i + 1], ["v", i + W]];
    for (const [dir, j] of tries) {
      if (!cells.has(j) || owner.has(j) || (dir === "h" && j % W !== x + 1)) continue;
      const id = mats.length; owner.set(i, id); owner.set(j, id); mats.push({ a: i, b: j, dir });
      const bad = [...cornersOf(i), ...cornersOf(j)].some(([cx, cy]) => cornerBad(cx, cy));
      if (!bad && go(k + 1)) return true;
      owner.delete(i); owner.delete(j); mats.pop();
    }
    return false;
  };
  return go(0) ? mats : null;
}

/** 돗자리 n 장(2n 칸)을 담는 바닥 크기 목록 — 고칠 말에 쓴다. */
export function tatamiSizes(cells: number): string {
  const out: string[] = [];
  for (let w = 2; w <= 12; w++) for (let h = 2; h <= 12; h++) if (w * h === cells && w <= h) out.push(`${w}x${h}`);
  return out.join(" / ");
}

/** 다다미로 깔 바닥 정의인가 — 무늬가 4열(가로 돗자리 두 칸 + 세로 돗자리 한 칸 + 여분)이고 이름이 tatami. */
export const isTatamiFloor = (id: string, fd: { readonly cols: number; readonly rows: number } | undefined): boolean => id === "tatami" && !!fd && fd.cols === 4 && fd.rows >= 2;

/**
 * 1층 타일에 통짜 돗자리를 다시 깐다. floorOf(i) = 그 칸이 다다미 바닥 칸이면 true(벽면 줄 제외). sh(i) = 그 칸의 그림자 변형(0..3).
 * 무늬의 (0,0)|(1,0) = 가로 돗자리, (2,0)/(2,1) = 세로 돗자리. 깔 수 없는 덩이는 그대로 둔다. 깐 돗자리 수를 돌려준다.
 */
export function layTatami(lower: number[], W: number, tiles: readonly number[], floorOf: (i: number) => boolean, sh: (i: number) => number): { mats: number; failed: number } {
  const seen = new Set<number>();
  let mats = 0, failed = 0;
  for (let i = 0; i < lower.length; i++) if (floorOf(i) && !seen.has(i)) {
    const comp = new Set<number>(), q = [i]; seen.add(i);
    while (q.length) {
      const c = q.pop()!; comp.add(c);
      for (const n of [c - 1, c + 1, c - W, c + W]) if (n >= 0 && n < lower.length && Math.abs((n % W) - (c % W)) <= 1 && floorOf(n) && !seen.has(n)) { seen.add(n); q.push(n); }
    }
    const m = tatamiTiling(comp, W);
    if (!m) { failed++; continue; }
    const put = (c: number, k: number) => { const t = tiles[k * 4 + sh(c)]; if (t !== undefined) lower[c] = t; };
    for (const t of m) { if (t.dir === "h") { put(t.a, 0); put(t.b, 1); } else { put(t.a, 2); put(t.b, 6); } }
    mats += m.length;
  }
  return { mats, failed };
}
