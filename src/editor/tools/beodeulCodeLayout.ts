// 코드 지형 위 마을 배치(2026-10-30 사용자 「지형은 코드가, 마을 배치는 조수가」).
//
// 지형(beodeulTerrainGen)은 코드가 만들고, 그 위의 자리(모이는 곳·높은 곳 건물·큰 건물·일터·집·밭·나가는 길)는 모델이 고른다.
// 이 파일은 모델이 고른 자리를 「놓을 수 있는가」로만 다룬다:
//   - 길 찾기(routePath): 단은 계단으로만 건넌다 — 곧게 몇 칸 온 뒤에만 단을 건너고, 건넌 뒤에도 몇 칸 곧게 간다(계단 단면 계약).
//     두 단 넘게 차이 나는 이웃은 못 건넌다. 강은 곧게만 건넌다(널다리). 호수·바다는 못 건넌다.
//   - 자동 배치(autoLayout): 모델이 자리를 안 주었을 때만 쓰는 대체 — 가장 넓은 낮은 터에 모이는 곳, 가장 높은 터에 높은 곳 건물,
//     둘레에 집. 모델이 준 자리를 덮어쓰지 않는다.
import type { CodeTerrain } from "./beodeulTerrainGen";

export type LayoutEdge = "west" | "east" | "north" | "south";
export interface LayoutPoint { x: number; y: number }
export interface VillageLayout {
  /** 모이는 곳(광장·우물 자리). plaza false 면 판석 광장 없이 우물·좌판만. */
  gather?: LayoutPoint & { plaza?: boolean };
  /** 높은 곳 건물(망루 집·예배당·사원·사당) 자리 — 보통 높은 단. */
  landmark?: LayoutPoint;
  /** 큰 건물(여관·회관) — 보통 모이는 곳 곁. */
  anchor?: LayoutPoint;
  /** 일터(헛간·곳간 + 일터 소품). */
  work?: LayoutPoint;
  /** 살림집 자리(집 가운데). */
  houses?: LayoutPoint[];
  /** 밭 자리(밭 가운데). */
  fields?: LayoutPoint[];
  /** 마을 밖으로 나가는 큰길이 닿는 맵 가장자리(1~2개). */
  exits?: LayoutEdge[];
}

export const LAYOUT_EDGES: readonly LayoutEdge[] = ["west", "east", "north", "south"];

/** 모델이 준 배치 입력을 검사·정리한다(좌표는 맵 안으로 자르고, 숫자가 아닌 칸은 버린다). 문제는 notes 로 돌려준다. */
export function parseLayout(raw: unknown, W: number, H: number): { layout: VillageLayout; notes: string[] } {
  const notes: string[] = [];
  const out: VillageLayout = {};
  if (!raw || typeof raw !== "object") return { layout: out, notes };
  const r = raw as Record<string, unknown>;
  const pt = (v: unknown, name: string): LayoutPoint | null => {
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>; const x = Number(o.x), y = Number(o.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) { notes.push(`${name} 좌표가 숫자가 아니라 버렸다.`); return null; }
    const cx = Math.max(1, Math.min(W - 2, Math.round(x))), cy = Math.max(1, Math.min(H - 2, Math.round(y)));
    if (cx !== Math.round(x) || cy !== Math.round(y)) notes.push(`${name} (${x},${y}) 가 맵 밖이라 (${cx},${cy}) 로 당겼다.`);
    return { x: cx, y: cy };
  };
  const g = pt(r.gather, "gather"); if (g) out.gather = { ...g, plaza: (r.gather as Record<string, unknown>).plaza !== false };
  const lm = pt(r.landmark, "landmark"); if (lm) out.landmark = lm;
  const an = pt(r.anchor, "anchor"); if (an) out.anchor = an;
  const wk = pt(r.work, "work"); if (wk) out.work = wk;
  if (Array.isArray(r.houses)) out.houses = r.houses.map((h, i) => pt(h, `houses[${i}]`)).filter((p): p is LayoutPoint => !!p).slice(0, 24);
  if (Array.isArray(r.fields)) out.fields = r.fields.map((h, i) => pt(h, `fields[${i}]`)).filter((p): p is LayoutPoint => !!p).slice(0, 6);
  if (Array.isArray(r.exits)) out.exits = r.exits.filter((e): e is LayoutEdge => (LAYOUT_EDGES as readonly string[]).includes(String(e))).slice(0, 3);
  return { layout: out, notes };
}

function rng(seed: number): () => number {
  let s = (seed ^ 0x6a09e667) >>> 0;
  return () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; s ^= s >>> 13; return (s >>> 0) / 4294967296; };
}

/** 모델이 자리를 안 주었을 때의 대체 배치. 모이는 곳은 가장 넓은 낮은 터, 높은 곳 건물은 가장 높은 터, 집은 모이는 곳 둘레 고리. */
export function autoLayout(t: CodeTerrain, seed: number, houseCount: number): VillageLayout {
  const rand = rng(seed * 131 + 7);
  const { W, H } = t;
  const areas = t.areas.filter((a) => a.inner >= 20);
  const low = [...areas].sort((a, b) => a.level - b.level || b.inner - a.inner);
  const home = [...areas].sort((a, b) => b.inner - a.inner - (a.level - b.level) * 40)[0] ?? low[0];
  const g: LayoutPoint = home ? { x: home.cx, y: home.cy } : { x: Math.round(W / 2), y: Math.round(H / 2) };
  const top = [...areas].filter((a) => a.level > (home?.level ?? 0)).sort((a, b) => b.level - a.level || b.inner - a.inner)[0];
  const houses: LayoutPoint[] = [];
  const n = Math.max(3, houseCount);
  const ph = rand() * Math.PI * 2;
  for (let i = 0; i < n; i += 1) {
    const a = ph + (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.5;
    const r = 8 + (i % 3) * 4 + rand() * 3;
    houses.push({ x: Math.max(2, Math.min(W - 3, Math.round(g.x + Math.cos(a) * r * 1.3))), y: Math.max(2, Math.min(H - 3, Math.round(g.y + Math.sin(a) * r * 0.9))) });
  }
  const far = (k: number) => { const a = ph + Math.PI * (0.5 + k); return { x: Math.max(4, Math.min(W - 5, Math.round(g.x + Math.cos(a) * 18))), y: Math.max(4, Math.min(H - 5, Math.round(g.y + Math.sin(a) * 12))) }; };
  return {
    gather: { ...g, plaza: true },
    ...(top ? { landmark: { x: top.cx, y: top.cy } } : {}),
    anchor: { x: g.x + 1, y: g.y - 6 },
    work: far(0.3),
    houses,
    fields: [far(0.9), far(1.5)],
    exits: W >= H ? ["west", "east"] : ["north", "south"],
  };
}

export interface RouteGrid {
  W: number; H: number;
  lv: ArrayLike<number>;
  /** 길이 지날 수 없는 칸(건물 자리·호수·바다·맵 밖 연결 금지 칸). */
  blocked: (c: number) => boolean;
  /** 곧게만 건널 수 있는 물(강) 칸. */
  ford: (c: number) => boolean;
  /** 칸마다 덧붙는 값(절벽 끝·물가 가까움 등). */
  extra?: (c: number) => number;
}
export interface RouteOpts {
  /** 이웃 칸 단 차 최대(계단 한 번에 오르는 단 수). */
  maxStep: number;
  /** 단을 건너기 전에 곧게 온 걸음 수(계단 아랫 층계참+계단). */
  before: number;
  /** 단을 건넌 뒤 곧게 가야 하는 걸음 수. */
  after: number;
  turnCost: number;
  climbCost: number;
  fordCost: number;
  /** 단은 남북으로만 건넌다(동서로 오르는 계단 조각이 칩셋에 없다). */
  climbNS?: boolean;
  /** 폭 2 길: 진행 방향 오른쪽·아래 칸(쌍둥이 칸)도 같은 단·지날 수 있어야 한다. */
  wide?: boolean;
}
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];

/**
 * 계단 계약을 지키는 최소 비용 길(방향·곧게 온 걸음·남은 곧은 걸음을 상태로 둔 다익스트라).
 * starts 에서 시작해 isGoal 칸에 닿으면 그 길(시작 → 끝 칸 목록)을 돌려준다. 못 찾으면 null.
 */
export function routePath(g: RouteGrid, starts: number[], isGoal: (c: number) => boolean, o: RouteOpts): number[] | null {
  const { W, H, lv } = g;
  const RUN = Math.max(o.before, 1) + o.maxStep, LOCK = Math.max(o.after, 2) + o.maxStep;
  const S = W * H * 4 * RUN * LOCK;
  const dist = new Float64Array(S).fill(Infinity);
  const prev = new Int32Array(S).fill(-1);
  const key = (c: number, d: number, run: number, lock: number) => (((c * 4 + d) * RUN + run) * LOCK + lock);
  // 이진 힙
  const hk: number[] = [], hs: number[] = [];
  const push = (k: number, s: number) => { hk.push(k); hs.push(s); let i = hk.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (hk[p]! <= hk[i]!) break; [hk[p], hk[i]] = [hk[i]!, hk[p]!]; [hs[p], hs[i]] = [hs[i]!, hs[p]!]; i = p; } };
  const pop = (): number => { const top = hs[0]!; const lk = hk.pop()!, ls = hs.pop()!; if (hk.length) { hk[0] = lk; hs[0] = ls; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < hk.length && hk[l]! < hk[m]!) m = l; if (r < hk.length && hk[r]! < hk[m]!) m = r; if (m === i) break; [hk[m], hk[i]] = [hk[i]!, hk[m]!]; [hs[m], hs[i]] = [hs[i]!, hs[m]!]; i = m; } } return top; };
  const twin = (c: number, d: number): number => { const x = c % W, y = (c - x) / W; const tx = d % 2 === 0 ? x : x + 1, ty = d % 2 === 0 ? y + 1 : y; return tx < W && ty < H ? ty * W + tx : -1; };
  const cellOk = (c: number, d: number): boolean => {
    if (g.blocked(c)) return false;
    if (!o.wide) return true;
    const t = twin(c, d); if (t < 0 || g.blocked(t)) return false;
    return lv[t] === lv[c] && g.ford(t) === g.ford(c);
  };
  for (const c of starts) for (let d = 0; d < 4; d += 1) { if (!cellOk(c, d) && !(o.wide && !g.blocked(c))) continue; const k = key(c, d, 0, 0); dist[k] = 0; push(0, k); }
  while (hk.length) {
    const s = pop();
    const lock = s % LOCK, run = Math.floor(s / LOCK) % RUN, d = Math.floor(s / (LOCK * RUN)) % 4, c = Math.floor(s / (LOCK * RUN * 4));
    const base = dist[s]!;
    // 건넌 뒤 곧은 구간(lock)을 다 걷기 전에는 닿은 것으로 치지 않는다 — 계단 바로 끝이 다른 길에 붙으면 계단 단면(아랫 층계참)이 안 나온다(2026-10-30 늪 오름길)
    if (isGoal(c) && !starts.includes(c) && lock === 0) {
      const path: number[] = []; for (let k = s; k >= 0; k = prev[k]!) path.push(Math.floor(k / (LOCK * RUN * 4)));
      return path.reverse();
    }
    const x = c % W, y = (c - x) / W;
    for (let nd = 0; nd < 4; nd += 1) {
      if (nd === (d + 2) % 4) continue;
      if (nd !== d && lock > 0) continue;
      // 꺾은 뒤 한 칸 만에 또 꺾지 않는다 — 한 칸 비켜 되돌아오는 머리핀(곧은 걸음 수를 채우려는 U자)·톱니 길을 막는다(2026-10-30 장터 큰길)
      if (nd !== d && run === 1 && base > 0) continue;
      const nx = x + DX[nd]!, ny = y + DY[nd]!; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (!cellOk(n, nd)) continue;
      const step = (lv[n] as number) - (lv[c] as number);
      if (Math.abs(step) > o.maxStep) continue;
      const nrun = nd === d ? Math.min(RUN - 1, run + 1) : 1;
      let nlock = Math.max(0, lock - 1);
      let cost = 1 + (nd !== d ? o.turnCost : 0) + (g.extra?.(n) ?? 0);
      const onFord = g.ford(n);
      if (step !== 0 || (onFord && !g.ford(c))) {
        // 단(또는 강)을 건너는 칸: 곧게 온 걸음이 모자라거나 앞 건넘의 곧은 구간 안이면 못 건넌다
        // 두 단 계단은 한 칸 더 길다 — 앞뒤 곧은 구간도 단 차만큼 늘린다
        const need = step !== 0 ? Math.abs(step) - 1 : 0;
        if (nd !== d || run < o.before + need || lock > 0) continue;
        if (step !== 0 && o.climbNS && nd % 2 === 0) continue;
        // 물(널다리) 칸으로 들어가거나 나오면서 단을 바꾸지 않는다 — 계단이 널다리 위에 놓일 수 없다(2026-10-30 산촌 강둑)
        if (step !== 0 && (onFord || g.ford(c))) continue;
        nlock = Math.min(LOCK - 1, o.after + need);
        cost += step !== 0 ? o.climbCost * Math.abs(step) : 0;
      }
      if (onFord) { cost += o.fordCost; nlock = Math.max(nlock, 2); }
      const k = key(n, nd, nrun, nlock);
      if (base + cost < dist[k]!) { dist[k] = base + cost; prev[k] = s; push(base + cost, k); }
    }
  }
  return null;
}

/** 길 칸 목록 → 곧은 토막들(가로·세로). 한 칸짜리 비켜 가기는 앞뒤가 같은 방향이면 그 토막에 붙인다. */
export function pathRuns(path: number[], W: number): { horizontal: boolean; cells: number[] }[] {
  if (path.length < 2) return path.length ? [{ horizontal: true, cells: [...path] }] : [];
  const runs: { horizontal: boolean; cells: number[] }[] = [];
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1]!, b = path[i]!; const hz = Math.abs(a - b) === 1;
    const last = runs[runs.length - 1];
    if (last && last.horizontal === hz) last.cells.push(b); else runs.push({ horizontal: hz, cells: [a, b] });
  }
  // 한 걸음 비켜 가기(가로-세로1-가로) 는 가로 토막 하나로
  for (let i = 1; i + 1 < runs.length; i += 1) {
    const r = runs[i]!; if (r.cells.length !== 2 || runs[i - 1]!.horizontal !== runs[i + 1]!.horizontal || runs[i - 1]!.horizontal === r.horizontal) continue;
    // 같은 쪽으로 이어 가는 비켜 가기만 — 되돌아가는 U자는 합치지 않는다
    const pa = runs[i - 1]!.cells, na = runs[i + 1]!.cells;
    if (Math.sign(pa[pa.length - 1]! - pa[0]!) !== Math.sign(na[na.length - 1]! - na[0]!)) continue;
    const merged = { horizontal: runs[i - 1]!.horizontal, cells: [...runs[i - 1]!.cells, ...r.cells.slice(1), ...runs[i + 1]!.cells.slice(1)] };
    runs.splice(i - 1, 3, merged); i -= 1;
  }
  void W;
  return runs;
}
