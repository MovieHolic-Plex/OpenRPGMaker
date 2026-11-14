// 흐르는 강 모양 — 코드 지형(beodeulTerrainGen)의 강 가운데 줄에서 물 칸을 정한다.
//
// 왜(2026-11-14 오너 «내가 보낸 사진들처럼 유려한 마을이었음 좋겠군»): 강은 가운데 줄에서 한 칸 안쪽 칸 전부라 맵 끝에서 끝까지 폭이 같은 띠였고,
// 가운데 줄이 4이웃 칸 줄이라 비스듬히 흐르는 곳마다 한 칸씩 꺾이는 계단이었다. 참고 그림의 강은 굽이에서 소로 넓어지고 곧은 데서 좁아지며 둑이 둥글다.
//   1. 가운데 줄을 실수 곡선으로 편다(이동 평균 두 번 — 칸 계단이 사라진다).
//   2. 굽이(곡률이 큰 자리)마다 소: 반지름이 2.2~3칸까지 부풀고, 곧은 데는 1.15칸(폭 두세 칸)으로 좁아진다 — 건널 자리는 곧은 데서 나므로 좁은 목이 된다.
//   3. 칸 중심이 곡선에서 그 자리 반지름 안이면 물. 한 칸 혹·한 칸 틈은 다수결로 편다(물길은 끊지 않는다).
// 같은 가운데 줄·씨앗이면 늘 같은 모양이다.

function rng(seed: number): () => number {
  let s = (seed ^ 0x3b9ac9ff) >>> 0;
  return () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; s ^= s >>> 13; return (s >>> 0) / 4294967296; };
}

export interface RiverShape {
  /** 물 칸. */
  cells: Set<number>;
  /** 소(넓어진 자리)의 가운데 칸 — 수련·갈대 무리가 모일 자리. */
  pools: number[];
  /** 편 곡선을 다시 4이웃 칸 줄로 그은 가운데 줄(상류 → 하류) — 강바닥·건널 자리·단 내려가기는 이 줄을 읽는다. */
  line: number[];
}

export function flowingRiverCells(path: readonly number[], W: number, H: number, seed: number): RiverShape {
  const n = path.length;
  if (n < 6) return { cells: new Set(path), pools: [], line: [...path] };
  let xs = path.map((c) => (c % W) + 0.5), ys = path.map((c) => Math.floor(c / W) + 0.5);
  // 1. 이동 평균(창 9) 두 번 — 양 끝은 창을 줄여 가장자리 어귀가 제자리에 남는다
  for (let pass = 0; pass < 2; pass += 1) {
    const ax = xs.slice(), ay = ys.slice();
    for (let i = 0; i < n; i += 1) {
      const k = Math.min(4, i, n - 1 - i); let sx = 0, sy = 0;
      for (let j = i - k; j <= i + k; j += 1) { sx += xs[j]!; sy += ys[j]!; }
      ax[i] = sx / (2 * k + 1); ay[i] = sy / (2 * k + 1);
    }
    xs = ax; ys = ay;
  }
  // 2. 곡률(앞뒤 다섯 걸음의 방향 차) → 굽이 자리
  const turn = new Float32Array(n);
  for (let i = 5; i < n - 5; i += 1) {
    const ax = xs[i]! - xs[i - 5]!, ay = ys[i]! - ys[i - 5]!, bx = xs[i + 5]! - xs[i]!, by = ys[i + 5]! - ys[i]!;
    const la = Math.hypot(ax, ay) || 1, lb = Math.hypot(bx, by) || 1;
    turn[i] = Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb))));
  }
  const rand = rng(seed * 131 + n);
  const order = [...turn.keys()].filter((i) => i >= 7 && i < n - 7).sort((a, b) => turn[b]! - turn[a]!);
  const bends: { i: number; r: number; half: number }[] = [];
  const want = Math.max(1, Math.round(n / 16));
  for (const i of order) {
    if (bends.length >= want) break;
    if (turn[i]! < 0.25 && bends.length >= 1) break;                       // 곧은 강: 소 하나만
    if (bends.some((b) => Math.abs(b.i - i) < 11)) continue;
    bends.push({ i, r: (0.9 + rand() * 0.9), half: 2.6 + rand() * 1.6 });
  }
  // 반지름: 바탕 1.15(폭 두세 칸) + 느린 물결 ±0.2 + 굽이의 종 모양 부풂. 가장자리 어귀 네 걸음은 바탕 그대로(맵 끝에서 폭이 튀지 않게).
  const ph = rand() * Math.PI * 2;
  const radius = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    let r = 1.15 + 0.2 * Math.sin(i / 5.5 + ph);
    for (const b of bends) { const t = (i - b.i) / b.half; r += b.r * Math.exp(-t * t); }
    const end = Math.min(i, n - 1 - i);
    radius[i] = end < 4 ? 1.15 + (r - 1.15) * (end / 4) : r;
  }
  // 3. 칸 중심이 곡선에서 반지름 안이면 물(소는 굽이 안쪽으로 조금 밀어 한쪽 둑이 둥글게 불룩해진다)
  const water = new Uint8Array(W * H);
  for (let i = 0; i < n; i += 1) {
    const r = radius[i]!, cx = xs[i]!, cy = ys[i]!;
    for (let y = Math.max(0, Math.floor(cy - r - 1)); y <= Math.min(H - 1, Math.ceil(cy + r + 1)); y += 1) for (let x = Math.max(0, Math.floor(cx - r - 1)); x <= Math.min(W - 1, Math.ceil(cx + r + 1)); x += 1) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r * r) water[y * W + x] = 1;
    }
  }
  // 편 곡선을 4이웃 칸 줄로 다시 긋는다(대각 걸음은 한 칸 끼우고, 되돌아 겹친 고리는 걷는다) — 가운데 줄은 늘 물
  const line: number[] = [], at = new Map<number, number>();
  const push = (c: number) => { const j = at.get(c); if (j !== undefined) { for (const d of line.splice(j + 1)) at.delete(d); return; } at.set(c, line.length); line.push(c); };
  for (let i = 0; i < n; i += 1) {
    const x = Math.max(0, Math.min(W - 1, Math.floor(xs[i]!))), y = Math.max(0, Math.min(H - 1, Math.floor(ys[i]!))), c = y * W + x, p = line[line.length - 1];
    if (p === c) continue;
    if (p !== undefined) {
      let px = p % W, py = (p - px) / W;
      while (Math.abs(px - x) + Math.abs(py - y) > 1) { if (Math.abs(px - x) >= Math.abs(py - y)) px += Math.sign(x - px); else py += Math.sign(y - py); push(py * W + px); }
    }
    push(c);
  }
  for (const c of line) water[c] = 1;
  const N8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const;
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && water[y * W + x] === 1;
  const core = new Set(line);
  for (let pass = 0; pass < 2; pass += 1) {
    const out = Uint8Array.from(water);
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      const c = y * W + x; let k = 0;
      for (const [dx, dy] of N8) if (on(x + dx, y + dy)) k += 1;
      if (!water[c] && k >= 5) out[c] = 1;                                   // 한 칸 만(뭍이 물에 파고든 혹)은 메운다
      else if (water[c] && k <= 2 && !core.has(c)) out[c] = 0;               // 한 칸 물 가시는 걷는다
    }
    water.set(out);
  }
  // 대각으로만 닿는 물 두 칸 사이는 한 칸 채운다(물길이 끊겨 보이지 않게)
  for (let y = 0; y + 1 < H; y += 1) for (let x = 0; x + 1 < W; x += 1) {
    const a = y * W + x, b = a + 1, c2 = a + W, d = c2 + 1;
    if (water[a] && water[d] && !water[b] && !water[c2]) water[b] = 1;
    else if (water[b] && water[c2] && !water[a] && !water[d]) water[a] = 1;
  }
  const cells = new Set<number>();
  for (let c = 0; c < W * H; c += 1) if (water[c]) cells.add(c);
  return { cells, pools: bends.map((b) => Math.floor(ys[b.i]!) * W + Math.floor(xs[b.i]!)), line };
}

export interface RiverFall { /** 폭포 물줄기의 왼쪽·오른쪽 열과 떨어지기 직전 물 줄(위 단). */ x0: number; x1: number; y: number; /** 떨어지는 단 수(절벽면 줄 수). */ drop: number }

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const N8R = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const;

/**
 * 강이 단을 따라 내려오게 한다(2026-11-14 — 전에는 강 전체가 닿은 땅 중 가장 낮은 단이라 윗단을 골짜기로 가르고 평평하게 흘렀다).
 * 가운데 줄을 따라 둑의 단을 읽어 하류로 갈수록 낮아지는 단을 주고, 단이 내려가는 자리는 «남쪽으로 한 칸 흐르는 곳» 으로 옮긴다 —
 * 3/4 시점에서 보이는 절벽면은 남향뿐이라 폭포는 남쪽으로 떨어질 때만 그릴 수 있다. 단이 내려가는 자리에서 상류로 거슬러 가장 가까운 «남쪽 한 걸음» 에 폭포를 세운다
 * (폭포가 윗단 안으로 물러나 그 아래는 낮은 골짜기가 된다). 상류 어디에도 남쪽 걸음이 없으면(북쪽·옆으로만 흐르는 강) 그 위 강을 낮은 단으로 내린다(옛 골짜기).
 * 폭포 자리는 물을 네 줄 높이의 곧은 네모로 다듬고(위 두 줄·아래 두 줄), 물 곁 한 칸 둑은 물의 단으로 낮춘다(폭포 줄 옆 절벽은 그대로 둔다).
 * water(1 = 강)·lv 를 고친다.
 */
export function settleRiverLevels(lv: Uint8Array, water: Uint8Array, W: number, H: number, path: readonly number[]): { falls: number; gorges: number } {
  const n = path.length, done = { falls: 0, gorges: 0 };
  if (n < 6) return done;
  const X = (c: number) => c % W, Y = (c: number) => Math.floor(c / W);
  const nearest = (): Int32Array => {
    const near = new Int32Array(W * H).fill(-1); const q: number[] = [];
    path.forEach((c, i) => { if (near[c] < 0) { near[c] = i; q.push(c); } });
    for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = X(c), y = Y(c);
      // 4이웃으로 번진다 — 8이웃이면 폭포 밑 용소의 옆 칸이 폭포 위 가운데 줄과 같은 거리가 되어 윗단에 붙고, 다시 앉힐 때 그 폭포가 지워진다
      for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const m = ny * W + nx; if (water[m] === 1 && near[m]! < 0) { near[m] = near[c]!; q.push(m); } } }
    return near;
  };
  let near = nearest();
  const prof = new Float64Array(n).fill(Infinity);
  for (let c = 0; c < W * H; c += 1) {
    const i = near[c]!; if (i < 0) continue; const x = X(c), y = Y(c);
    for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const m = ny * W + nx; if (!water[m]) prof[i] = Math.min(prof[i]!, lv[m]!); }
  }
  for (let i = 1; i < n; i += 1) if (!Number.isFinite(prof[i]!)) prof[i] = prof[i - 1]!;
  for (let i = n - 2; i >= 0; i -= 1) if (!Number.isFinite(prof[i]!)) prof[i] = prof[i + 1]!;
  if (!Number.isFinite(prof[0]!)) return done;
  for (let i = 1; i < n; i += 1) prof[i] = Math.min(prof[i]!, prof[i - 1]!);
  const run = (x: number, y: number): [number, number] => { let a = x, b = x; while (a > 0 && water[y * W + a - 1] === 1) a -= 1; while (b < W - 1 && water[y * W + b + 1] === 1) b += 1; return [a, b]; };
  const falls: { k: number; y: number; x0: number; x1: number; hi: number; lo: number }[] = [];
  const onPath = new Set(path);
  for (let i = n - 1; i >= 1; i -= 1) {
    if (prof[i - 1]! <= prof[i]!) continue;
    let made = false;
    for (let k = i; k >= 3 && !made; k -= 1) {
      const a = path[k - 1]!, b = path[k]!;
      if (X(a) !== X(b) || Y(b) !== Y(a) + 1) continue;
      const yd = Y(b), x = X(b);
      if (yd < 3 || yd > H - 4) continue;
      const [a0, a1] = run(x, yd - 1), [b0, b1] = run(x, yd);
      let x0 = Math.max(Math.min(a0, b0), x - 2), x1 = Math.min(Math.max(a1, b1), x + 2);              // 폭포는 좁다(세 칸~다섯 칸)
      for (let t = 0; x1 - x0 < 2 && t < 4; t += 1) { if (t % 2 === 0 && x1 < W - 3) x1 += 1; else if (x0 > 2) x0 -= 1; }   // 두 칸 폭 강도 폭포에서는 세 칸으로 넓어진다
      if (x0 < 2 || x1 > W - 3) continue;
      // 이미 선 (하류) 폭포와 여섯 줄은 떨어진다 — 붙으면 위 폭포의 용소가 아래 폭포의 물마루를 덮어 두 폭포의 단이 뒤섞였다
      if (falls.some((f) => Math.abs(f.y - yd) < 6 && x1 + 3 >= f.x0 && x0 - 3 <= f.x1)) continue;
      // 그 자리에서 강이 되돌아 오르지 않아야 한다(위 줄의 물은 모두 상류, 아래 줄의 물은 모두 하류)
      let clean = true;
      for (let j = Math.max(0, k - 6); j < k && clean; j += 1) if (Y(path[j]!) >= yd && Math.abs(X(path[j]!) - x) <= 5) clean = false;
      for (let j = k; j < Math.min(n, k + 6) && clean; j += 1) if (Y(path[j]!) < yd && Math.abs(X(path[j]!) - x) <= 5) clean = false;
      if (!clean) continue;
      // 넓은 소 한가운데면 폭포 목을 좁힌다: 위 두 줄·아래 두 줄에서 물줄기 밖의 물을 뭍으로 되돌린다(가운데 줄이 그 칸을 지나면 이 자리는 버린다).
      // 소는 폭포 위아래에 그대로 남아 «넓은 못이 좁은 목으로 모여 떨어지는» 모양이 된다.
      const cut: number[] = [];
      for (let yy = yd - 2; yy <= yd + 1 && clean; yy += 1) {
        const keep = yy === yd + 1 ? 1 : 0;
        for (const step of [-1, 1]) for (let xx = (step < 0 ? x0 - keep : x1 + keep) + step; xx >= 0 && xx < W && water[yy * W + xx] === 1; xx += step) {
          if (onPath.has(yy * W + xx) || xx < 1 || xx > W - 2) { clean = false; break; }
          cut.push(yy * W + xx);
        }
      }
      if (!clean) continue;
      const hi = prof[Math.min(k, i) - 1]!;
      for (const c of cut) { water[c] = 0; lv[c] = Y(c) < yd ? hi : prof[i]!; }
      for (let j = k; j < i; j += 1) prof[j] = prof[i]!;
      for (let j = i; j < k; j += 1) prof[j] = hi;
      for (let yy = yd - 2; yy <= yd + 1; yy += 1) for (let xx = x0; xx <= x1; xx += 1) water[yy * W + xx] = 1;
      // 용소: 폭포 밑 둘째·셋째 줄은 양옆으로 한 칸 넓어진다(떨어진 물이 고이는 못)
      for (const yy of [yd + 1, yd + 2]) if (yy < H - 1) for (let xx = x0 - 1; xx <= x1 + 1; xx += 1) water[yy * W + xx] = 1;
      falls.push({ k, y: yd, x0, x1, hi, lo: prof[i]! });
      made = true; done.falls += 1;
      i = k;                                                                  // 방금 세운 폭포 자리를 다시 «내려가는 단» 으로 읽지 않는다
    }
    // 맵 가장자리 어귀 네 걸음 안에서 내려가는 단은 폭포도 골짜기도 아니다 — 강이 그 단 아래에서 들어온 것으로 본다(윗단 강이 보일 자리가 없다).
    if (!made) { if (i > 4) done.gorges += 1; for (let j = 0; j < i; j += 1) prof[j] = Math.min(prof[j]!, prof[i]!); }
  }
  near = nearest();
  for (let c = 0; c < W * H; c += 1) {
    if (water[c] !== 1) continue;
    const i = near[c]!; if (i < 0) continue;
    let level = prof[i]!;
    const x = X(c), y = Y(c);
    let best = 9;
    for (const f of falls) if (Math.abs(i - f.k) <= 6 && x >= f.x0 - 1 && x <= f.x1 + 1 && Math.abs(y - f.y) <= 3 && Math.abs(y - f.y) < best) { best = Math.abs(y - f.y); level = y < f.y ? f.hi : f.lo; }
    lv[c] = level;
  }
  for (let c = 0; c < W * H; c += 1) {
    if (water[c] !== 1) continue; const x = X(c), y = Y(c);
    for (const [dx, dy] of N8R) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const m = ny * W + nx;
      if (water[m] || lv[m]! <= lv[c]!) continue;
      if (dy < 0 && falls.some((f) => y === f.y && nx >= f.x0 - 2 && nx <= f.x1 + 2)) continue;       // 폭포 줄 옆의 절벽
      lv[m] = lv[c]!;
    }
  }
  return done;
}

/**
 * 강이 남쪽 높은 땅에 가려지지 않게 한다. 3/4 시점에서 한 단 높은 땅은 두 칸 위로 올라가 그려져, 강 바로 남쪽이 높으면 물 줄이 그 땅 밑에 숨는다
 * (강이 군데군데 끊긴 웅덩이로 보였다 — 언덕 발치를 따라 동서로 흐르는 강). 강 칸에서 남쪽으로 k 번째 땅 칸은 강보다 ⌈k/2⌉−1 단까지만 높을 수 있다:
 * 둑 두 줄은 강과 같은 단, 그다음 두 줄은 한 단 위 … 로 물러난다. lv 는 단 번호(두 배 하기 전)다. 고친 칸 수를 돌려준다.
 */
export function clearRiverView(lv: Uint8Array, water: ArrayLike<number>, W: number, H: number): number {
  let n = 0;
  for (let c = 0; c < W * H; c += 1) {
    if (water[c] !== 1) continue;
    for (let k = 1; k <= 6; k += 1) {
      const m = c + k * W; if (m >= W * H) break;
      if (water[m]) break;
      const top = lv[c]! + Math.ceil(k / 2) - 1;
      if (lv[m]! > top) { lv[m] = top; n += 1; }
    }
  }
  return n;
}

/** 지금 단·물에서 폭포 자리를 읽는다: 강 칸이 바로 남쪽 강 칸보다 높은 가로 줄. */
export function riverFalls(lv: ArrayLike<number>, water: ArrayLike<number>, W: number, H: number): RiverFall[] {
  const out: RiverFall[] = [];
  for (let y = 1; y < H - 2; y += 1) {
    let x0 = -1, drop = 0;
    for (let x = 0; x <= W; x += 1) {
      const c = y * W + x;
      const d = x < W && water[c] === 1 && water[c + W] === 1 ? (lv[c] as number) - (lv[c + W] as number) : 0;
      if (d > 0 && x0 >= 0 && d === drop) continue;
      if (x0 >= 0) { out.push({ x0, x1: x - 1, y, drop }); x0 = -1; }
      if (d > 0) { x0 = x; drop = d; }
    }
  }
  return out;
}

/**
 * 평지 요청의 북쪽 띠(한 단)를 강이 남쪽으로 넘어가는 자리 — 띠 아래 경계를 그 둘레에서 곧게 편 새 경계와 폭포 줄을 돌려준다.
 * 강이 띠를 한 번만, 남쪽으로 넘고, 띠 위쪽 강이 스무 열 안에 있을 때만(아니면 null — 옛 방식대로 띠를 끊는다).
 */
export function bandFallPlan(path: readonly number[], water: ArrayLike<number>, band: Int16Array, W: number, H: number): { band: Int16Array; x0: number; x1: number; y: number } | null {
  const X = (c: number) => c % W, Y = (c: number) => Math.floor(c / W);
  const first = path.findIndex((c) => Y(c) >= band[X(c)]!);
  if (first < 3) return null;
  const yd = band[X(path[first]!)]!;
  if (yd < 5 || yd > H - 6) return null;
  const k = path.findIndex((c) => Y(c) >= yd);
  if (k < 3 || path.slice(k).some((c) => Y(c) < yd)) return null;
  let x0 = W, x1 = -1;
  for (let y = 0; y < yd; y += 1) for (let x = 0; x < W; x += 1) if (water[y * W + x] === 1) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  if (x1 < 0 || x1 - x0 > 20 || x0 < 2 || x1 > W - 3) return null;
  const out = Int16Array.from(band);
  for (let x = Math.max(0, x0 - 3); x <= Math.min(W - 1, x1 + 3); x += 1) out[x] = yd;
  for (let x = x1 + 4; x < W; x += 1) out[x] = Math.max(out[x - 1]! - 1, Math.min(out[x - 1]! + 1, out[x]!));
  for (let x = x0 - 4; x >= 0; x -= 1) out[x] = Math.max(out[x + 1]! - 1, Math.min(out[x + 1]! + 1, out[x]!));
  return { band: out, x0, x1, y: yd };
}
