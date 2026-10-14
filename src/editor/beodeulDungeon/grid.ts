// 던전 시공기 격자 도구 — 바닥 마스크·액체·다리 위에서 도는 순수 함수(2026-10-14 던전 종류 확장).
//
// 바닥 마스크(floor)는 「열린 칸」이다: 걷는 바닥 + 액체(물·용암) + 다리. 액체와 다리는 별도 마스크가 가리킨다. 천장·벽 앞면은 열린 칸에서만 유도된다.
// 불변식(이 파일이 지킨다):
//  · 열린 칸 북쪽의 막힌 줄이 1~2줄이면 벽 앞면(최소 2줄 + 천장 1줄)이 설 수 없다 → 그 틈을 바닥으로 메운다(fixThickness).
//  · 걷는 칸(바닥·다리)은 한 덩어리여야 한다. 액체가 갈라놓으면 최단 액체 경로를 다리로 바꿔 잇고(bridgeComponents), 잇지 못하는 조각은 막는다.
//  · 위 둘은 서로를 깨뜨릴 수 있어 고정점까지 돌린다(settle).
export const WALL_ROWS = 3;

export function hash01(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 쌍선형 값 잡음 0..1. scale = 격자 한 변의 칸 수(클수록 부드럽다). */
export function vnoise(x: number, y: number, scale: number, seed: number): number {
  const fx = x / scale, fy = y / scale;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = hash01(x0, y0, seed), b = hash01(x0 + 1, y0, seed), c = hash01(x0, y0 + 1, seed), d = hash01(x0 + 1, y0 + 1, seed);
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
}

export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    s ^= s >>> 13;
    return (s >>> 0) / 4294967296;
  };
}

export interface Rect { x: number; y: number; w: number; h: number }

export class Grid {
  /** 열린 칸(걷는 바닥 + 액체 + 다리). */
  readonly floor: Uint8Array;
  /** 칸이 속한 방 번호(통로·방 밖은 -1). */
  readonly roomAt: Int16Array;
  /** 액체 칸(물·용암). 다리가 놓이면 0 이 되고 bridge 가 1 이 된다. */
  readonly liquid: Uint8Array;
  /** 액체 위 다리 칸(걷는다). */
  readonly bridge: Uint8Array;
  /** 문 앞 칸 — 액체·모따기·물건이 막지 않는다. */
  readonly protect: Uint8Array;
  constructor(readonly W: number, readonly H: number) {
    this.floor = new Uint8Array(W * H);
    this.roomAt = new Int16Array(W * H).fill(-1);
    this.liquid = new Uint8Array(W * H);
    this.bridge = new Uint8Array(W * H);
    this.protect = new Uint8Array(W * H);
  }
  idx(x: number, y: number): number { return y * this.W + x; }
  inb(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
  open(x: number, y: number): boolean { return this.inb(x, y) && this.floor[y * this.W + x] === 1; }
  /** 걸을 수 있는 칸(바닥 또는 다리 — 액체 아님). */
  walk(x: number, y: number): boolean { return this.open(x, y) && this.liquid[y * this.W + x] === 0; }
  fillRect(r: Rect, room: number, value = 1): void {
    for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) {
      if (!this.inb(x, y)) continue;
      const i = this.idx(x, y);
      this.floor[i] = value;
      if (value) { if (room >= 0 || this.roomAt[i] < 0) this.roomAt[i] = room >= 0 ? room : this.roomAt[i]; } else { this.roomAt[i] = -1; this.liquid[i] = 0; this.bridge[i] = 0; }
    }
  }
  count(): number { let n = 0; for (let i = 0; i < this.floor.length; i += 1) n += this.floor[i]!; return n; }
}

const N4: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** 벽 앞면이 설 자리가 없는 얇은 막힘(북쪽 1~2줄)을 바닥으로 메운다. 맨 위 막힘이 4줄보다 얇으면 그 바닥을 지운다. 바뀐 칸 수. */
export function fixThickness(g: Grid): number {
  let changed = 0;
  for (let pass = 0; pass < 10; pass += 1) {
    let did = 0;
    for (let x = 0; x < g.W; x += 1) {
      let y = 0;
      while (y < g.H) {
        if (g.open(x, y)) { y += 1; continue; }
        const start = y;
        while (y < g.H && !g.open(x, y)) y += 1;
        const len = y - start;
        if (y >= g.H) break;            // 아래가 맵 끝 — 막힘 줄
        const below = y;                // 이 막힘 줄 바로 남쪽의 열린 칸
        if (start === 0) {
          if (len < WALL_ROWS + 1) { g.floor[g.idx(x, below)] = 0; g.liquid[g.idx(x, below)] = 0; g.bridge[g.idx(x, below)] = 0; g.roomAt[g.idx(x, below)] = -1; did += 1; }
        } else if (len <= 2) {
          const above = start - 1;
          const room = g.roomAt[g.idx(x, below)]! >= 0 ? g.roomAt[g.idx(x, below)]! : g.roomAt[g.idx(x, above)]!;
          for (let k = start; k < below; k += 1) { const i = g.idx(x, k); g.floor[i] = 1; g.roomAt[i] = room; did += 1; }
        }
      }
    }
    // 가로로 한 칸짜리 막힘(열린 칸 사이 틈)은 천장 띠가 실선처럼 얇다 — 메운다. 세로 한두 줄 틈은 위에서 이미 메웠다.
    for (let y = 0; y < g.H; y += 1) for (let x = 1; x < g.W - 1; x += 1) {
      if (g.open(x, y) || !g.open(x - 1, y) || !g.open(x + 1, y)) continue;
      const i = g.idx(x, y);
      g.floor[i] = 1; g.roomAt[i] = g.roomAt[g.idx(x - 1, y)]! >= 0 ? g.roomAt[g.idx(x - 1, y)]! : g.roomAt[g.idx(x + 1, y)]!; did += 1;
    }
    changed += did;
    if (!did) break;
  }
  return changed;
}

/** 걷는 칸의 연결 성분(4방). 번호 -1 = 걷는 칸 아님. */
export function walkComponents(g: Grid): { comp: Int32Array; count: number } {
  const comp = new Int32Array(g.W * g.H).fill(-1);
  let count = 0;
  const stack: number[] = [];
  for (let i = 0; i < comp.length; i += 1) {
    if (comp[i] !== -1 || !g.walk(i % g.W, (i / g.W) | 0)) continue;
    comp[i] = count; stack.push(i);
    while (stack.length) {
      const c = stack.pop()!; const cx = c % g.W, cy = (c / g.W) | 0;
      for (const [dx, dy] of N4) {
        const nx = cx + dx, ny = cy + dy;
        if (!g.walk(nx, ny)) continue;
        const ni = g.idx(nx, ny);
        if (comp[ni] !== -1) continue;
        comp[ni] = count; stack.push(ni);
      }
    }
    count += 1;
  }
  return { comp, count };
}

/**
 * 걷는 성분들을 액체를 가로지르는 최단 다리로 잇는다(주 성분 = start 가 속한 성분).
 * 한 번에 한 성분씩: 주 성분 바깥 경계에서 액체 칸만 지나 다른 성분에 닿는 가장 짧은 경로를 다리로 바꾼다. 반환 = 놓은 다리 칸 목록.
 */
export function bridgeComponents(g: Grid, start: number, rnd: () => number = Math.random): { x: number; y: number }[] {
  const placed: { x: number; y: number }[] = [];
  for (let guard = 0; guard < 40; guard += 1) {
    const { comp, count } = walkComponents(g);
    if (count <= 1) break;
    const main = comp[start]!;
    if (main < 0) break;
    // 주 성분 → 액체를 지나 다른 성분의 걷는 칸에 닿는 BFS
    const prev = new Int32Array(g.W * g.H).fill(-2);
    const queue: number[] = [];
    for (let i = 0; i < comp.length; i += 1) if (comp[i] === main) { prev[i] = -1; queue.push(i); }
    let hit = -1;
    for (let qi = 0; qi < queue.length && hit < 0; qi += 1) {
      const c = queue[qi]!; const cx = c % g.W, cy = (c / g.W) | 0;
      const dirs = N4.slice().sort(() => rnd() - 0.5);
      for (const [dx, dy] of dirs) {
        const nx = cx + dx, ny = cy + dy;
        if (!g.open(nx, ny)) continue;
        const ni = g.idx(nx, ny);
        if (prev[ni] !== -2) continue;
        if (g.liquid[ni]) { prev[ni] = c; queue.push(ni); continue; }
        if (comp[ni] !== -1 && comp[ni] !== main) { prev[ni] = c; hit = ni; break; }
      }
    }
    if (hit < 0) break;
    for (let c = prev[hit]!; c >= 0 && prev[c] !== -1; c = prev[c]!) {
      if (!g.liquid[c]) continue;
      g.liquid[c] = 0; g.bridge[c] = 1; placed.push({ x: c % g.W, y: (c / g.W) | 0 });
    }
  }
  return placed;
}

/** 열린 칸 수를 잰 뒤, 시작에서 닿지 않는 걷는 칸(다리로도 못 잇는 것)을 막는다. 막은 칸 수. */
export function pruneUnreachable(g: Grid, start: number): number {
  const { comp } = walkComponents(g);
  const main = comp[start]!;
  if (main < 0) return 0;
  let n = 0;
  for (let i = 0; i < comp.length; i += 1) {
    if (comp[i] === -1 || comp[i] === main) continue;
    g.floor[i] = 0; g.roomAt[i] = -1; g.liquid[i] = 0; g.bridge[i] = 0; n += 1;
  }
  // 걷는 칸을 잃고 남은 액체 조각(고립 웅덩이)은 그대로 두어도 어색하지 않다 — 열린 칸 그대로 유지
  return n;
}

/**
 * 두께 규칙 + 연결을 고정점까지: fixThickness → (다리 연결) → 못 잇는 조각 제거 → 반복.
 * 반환 = 놓은 다리 칸 수.
 */
export function settle(g: Grid, start: number, rnd: () => number): { bridges: number; removed: number; filled: number } {
  let bridges = 0, removed = 0, filled = 0;
  for (let pass = 0; pass < 8; pass += 1) {
    const f = fixThickness(g); filled += f;
    bridges += bridgeComponents(g, start, rnd).length;
    const r = pruneUnreachable(g, start); removed += r;
    if (!f && !r) break;
  }
  return { bridges, removed, filled };
}

/** 열린 칸이 아닌 칸과의 체비셰프 거리(열린 칸만; 0 = 가장자리). 깊은 칸 찾기·물가 여유에 쓴다. */
export function edgeDistance(g: Grid, cap = 8): Uint8Array {
  const d = new Uint8Array(g.W * g.H);
  for (let y = 0; y < g.H; y += 1) for (let x = 0; x < g.W; x += 1) {
    if (!g.open(x, y)) continue;
    let k = 0;
    for (; k < cap; k += 1) {
      const r = k + 1;
      let hit = false;
      for (let dy = -r; dy <= r && !hit; dy += 1) for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (!g.open(x + dx, y + dy)) { hit = true; break; }
      }
      if (hit) break;
    }
    d[g.idx(x, y)] = k;
  }
  return d;
}

/** 셀룰러 오토마타 매끈하게(동굴 모양): 이웃 열린 칸이 많으면 열고 적으면 닫는다. lock 칸은 바꾸지 않는다. */
export function smooth(g: Grid, passes: number, lock: (x: number, y: number) => boolean): void {
  for (let p = 0; p < passes; p += 1) {
    const next = g.floor.slice();
    const roomNext = g.roomAt.slice();
    for (let y = 1; y < g.H - 1; y += 1) for (let x = 1; x < g.W - 1; x += 1) {
      if (lock(x, y)) continue;
      let n = 0, room = -1;
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        if (!dx && !dy) continue;
        if (g.floor[g.idx(x + dx, y + dy)]) { n += 1; const r = g.roomAt[g.idx(x + dx, y + dy)]!; if (r >= 0) room = r; }
      }
      const i = g.idx(x, y);
      const open = g.floor[i] === 1;
      const want = open ? n >= 3 : n >= 6;
      if (want === open) continue;
      next[i] = want ? 1 : 0;
      if (want) roomNext[i] = room; else roomNext[i] = -1;
    }
    g.floor.set(next);
    g.roomAt.set(roomNext);
  }
}

export function carveDisc(g: Grid, cx: number, cy: number, r: number, room: number, force = false): void {
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy += 1) for (let dx = -R; dx <= R; dx += 1) {
    if (dx * dx + dy * dy > r * r) continue;
    const x = Math.round(cx) + dx, y = Math.round(cy) + dy;
    if (!g.inb(x, y)) continue;
    const i = g.idx(x, y);
    g.floor[i] = 1;
    if (force || g.roomAt[i]! < 0) g.roomAt[i] = room;
  }
}
