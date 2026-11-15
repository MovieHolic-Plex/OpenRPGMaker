// 버들항 마을의 흙 바닥 — 시골 마을은 흙이 마을의 바닥이다.
//
// 왜(2026-11-14 오너의 참고 마을 · «내가 보낸 사진들처럼 유려한 마을»): 참고 그림의 흙은 한 덩이로 이어진 몸이다 — 둥근 귀를 내밀며 마당으로 부풀고
// 집 사이에서 좁아지고, 가장자리가 구불거리며 풀이 혀처럼 파고든다. 시공기의 길은 폭 1~2 의 직각 띠였다.
// 무엇을: 길 뼈대(시공기가 낸 길 칸 — 통행·문 앞 도달은 이 뼈대가 지킨다) 둘레에 흙을 «모양» 으로 키운다. 순수 함수 — 칠하기는 시공기가 한다.
//   · 길 칸 줄을 눅여 굽은 줄로 만들고(직각 굽이가 둥글게 깎이고 곧은 구간은 옆으로 떠돈다) 그 줄을 따라 흙 원을 찍는다 — 반지름은 구간마다
//     넓어졌다 좁아지고 모이는 곳에서 부푼다. 흙이 떠난 길 칸은 풀로 돌려준다(흙 몸이 끊기지 않을 때만).
//   · 모이는 곳(우물)은 타원 마당 + 가까운 문 앞으로 뻗는 귀, 일터 앞은 작은 마당.
//   · 가장자리는 칸 잡음으로 들쭉날쭉, 넓은 마당 안에는 작은 풀 섬을 남긴다.
// 잡음은 칸 좌표·씨앗 해시뿐이다 — 시공기의 난수 줄을 쓰지 않는다(뒤따르는 밭·나무 자리의 난수가 밀리지 않는다).

export interface CommonsInput {
  readonly W: number; readonly H: number; readonly seed: number;
  /** 모이는 곳(우물 자리). */
  readonly g: { readonly x: number; readonly y: number };
  /** 흙이 될 수 있는 빈 칸인가(빈 땅 · 계단·절벽 끝·물가 아님). */
  readonly free: (cell: number) => boolean;
  /** 이미 길인 칸(뼈대). */
  readonly road: (cell: number) => boolean;
  /** 소품이 선 칸(우물·일터 소품) — 흙 안이면 그 밑도 흙으로 칠한다. */
  readonly prop: (cell: number) => boolean;
  readonly level: (cell: number) => number;
  /** 문 앞 칸. */
  readonly doors: readonly { readonly x: number; readonly y: number }[];
  /** 일터 마당 자리. */
  readonly work?: { readonly x: number; readonly y: number } | null;
  /** 살림집 수 — 마당 크기를 정한다. */
  readonly houses: number;
  /** 작은 마을(외딴 농가 몇 채)이면 흙 몸이 가늘고 마당이 작다. */
  readonly small?: boolean;
  /** 흙이 떠나면 안 되는 뼈대 칸(계단·다리 머리) — 그 둘레는 굽이치지 않는다. */
  readonly pinned?: (cell: number) => boolean;
  /** 풀로 돌려줘도 되는 길 칸인가(계단·다리가 아닌 맨 길 칸). 주지 않으면 길 칸은 모두 흙으로 남는다. */
  readonly freeRoad?: (cell: number) => boolean;
  /** 배치가 정한 마당 자리(칸 목록 또는 네모) — 주면 그 자리를 마당으로 칠하고 타원 마당·혀를 스스로 잡지 않는다. 문 앞 닳은 자리·일터 마당은 그대로 둔다. */
  readonly yard?: { readonly cells?: readonly number[]; readonly rect?: { readonly x: number; readonly y: number; readonly w: number; readonly h: number } } | null;
  /** 길마다 칸 줄(시작 → 끝)과 폭 — 주면 직각 굽이를 깎고 굽이치는 흙 몸을 그 줄을 따라 키운다. */
  readonly paths?: readonly { readonly cells: readonly number[]; readonly width: number }[];
}

export interface CommonsPlan {
  /** 길(흙)로 바꿀 빈 칸. */
  readonly earth: number[];
  /** 소품 밑 흙 칸(계획 칸은 소품 그대로). */
  readonly under: number[];
  /** 흙이 떠난 뼈대 칸 — 길 자리로 비워 두되 풀로 남긴다. */
  readonly bare: number[];
  /** 모이는 곳 마당의 칸 수. */
  readonly yard: number;
}

const hash = (x: number, y: number, seed: number): number => {
  let h = Math.imul(x * 73856093 ^ y * 19349663 ^ seed * 83492791, 0x27d4eb2d);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};
const noise = (x: number, y: number, grid: number, seed: number): number => {
  const fx = x / grid, fy = y / grid, x0 = Math.floor(fx), y0 = Math.floor(fy);
  let tx = fx - x0, ty = fy - y0; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
  return hash(x0, y0, seed) * (1 - tx) * (1 - ty) + hash(x0 + 1, y0, seed) * tx * (1 - ty) + hash(x0, y0 + 1, seed) * (1 - tx) * ty + hash(x0 + 1, y0 + 1, seed) * tx * ty;
};
const N4: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function planCommons(inp: CommonsInput): CommonsPlan {
  const { W, H, seed, g } = inp;
  const idx = (x: number, y: number) => y * W + x;
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const gl = inMap(g.x, g.y) ? inp.level(idx(g.x, g.y)) : 0;
  const cand = new Set<number>(), under = new Set<number>(), kept = new Set<number>();
  const doorAt = new Set(inp.doors.filter((d) => inMap(d.x, d.y)).map((d) => idx(d.x, d.y)));
  // 맵 가장자리 두 줄에는 흙을 새로 내지 않는다(뼈대 길만 가장자리에 닿는다) — 흙이 가장자리까지 부풀면 출구 없는 길 끝이 생겨 끝맺음이 «막힌 길» 표지를 세우고
  // 출구 폭이 넓어졌다(2026-11-15 명세 은행: «막힌 길» 이벤트 4 → 15, 가장자리에 닿은 다섯 칸 넘는 길 줄 11 → 29).
  const rim = (c: number) => { const x = c % W, y = (c - x) / W; return x <= 1 || y <= 1 || x >= W - 2 || y >= H - 2; };
  const canEarth = (c: number) => inp.free(c) && !rim(c);
  /** 흙 원 하나: 가운데·반지름(세로는 조금 납작하게 — 3/4 시점) · 그 단의 칸만 · 가장자리는 칸 잡음. 원 안의 길 칸은 흙으로 남는다(kept). */
  const disc = (cx: number, cy: number, rx: number, ry: number, level: number): void => {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y += 1) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x += 1) {
      if (!inMap(x, y)) continue; const c = idx(x, y);
      if (inp.level(c) !== level) continue;
      const r = 1 + 0.14 * (noise(x, y, 2.6, seed + 11) * 2 - 1);
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > r * r) continue;
      if (inp.road(c)) kept.add(c); else if (canEarth(c)) cand.add(c); else if (inp.prop(c)) under.add(c);
    }
  };
  const open = (x: number, y: number) => { const X = Math.round(x), Y = Math.round(y); return inMap(X, Y) && (inp.road(idx(X, Y)) || inp.free(idx(X, Y))); };

  // 1) 길 뼈대를 굽은 줄로: 길마다 칸 줄을 앞뒤 여섯 칸 평균으로 눅여 직각 굽이를 둥글게 깎고, 곧은 구간은 옆으로 두 칸까지 떠돌게 한다.
  //    붙들린 칸(길 끝·갈림목·문 앞·계단과 다리 곁·맵 끝)에서는 제자리 — 거기서 멀어질수록 많이 눅인다. 줄을 따라 흙 원을 찍는다.
  const paths = inp.paths?.length ? inp.paths : null;
  // 다른 길이 와 닿는 갈림목은 반쯤만 붙든다(두 칸 거리로 친다) — 갈림목마다 꼭 붙들면 골목이 여럿 닿는 큰길이 자로 그은 줄로 남는다
  const joint = new Set<number>();
  if (paths) for (const p of paths) { if (p.cells.length) { joint.add(p.cells[0]!); joint.add(p.cells[p.cells.length - 1]!); } }
  const isPin = (c: number) => { const x = c % W, y = (c - x) / W; return doorAt.has(c) || x <= 1 || y <= 1 || x >= W - 2 || y >= H - 2 || !!inp.pinned?.(c); };
  const bump = (x: number, y: number): number => { const dg = Math.hypot(x - g.x, (y - g.y) * 1.25); return dg < 8 ? (1 - dg / 8) * 1.1 : 0; };
  if (paths) paths.forEach((p, pi) => {
    const n = p.cells.length; if (!n) return;
    const xs = p.cells.map((c) => c % W), ys = p.cells.map((c) => Math.floor(c / W));
    const dp = new Array<number>(n).fill(99);
    for (let i = 0; i < n; i += 1) { const c = p.cells[i]!; if (isPin(c) || i === 0 || i === n - 1) dp[i] = 0; else { if (joint.has(c)) dp[i] = 2; if (i > 0) dp[i] = Math.min(dp[i]!, dp[i - 1]! + 1); } }
    for (let i = n - 2; i >= 0; i -= 1) dp[i] = Math.min(dp[i]!, dp[i + 1]! + 1);
    const sx = new Array<number>(n), sy = new Array<number>(n);
    for (let i = 0; i < n; i += 1) {
      const k = Math.min(8, dp[i]!, i, n - 1 - i); let ax = 0, ay = 0;
      for (let j = i - k; j <= i + k; j += 1) { ax += xs[j]!; ay += ys[j]!; }
      sx[i] = ax / (2 * k + 1); sy[i] = ay / (2 * k + 1);
    }
    const base = (p.width >= 2 ? 1.5 : 1.05) * (inp.small ? 0.9 : 1);
    for (let i = 0; i < n; i += 1) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
      let tx = sx[b]! - sx[a]!, ty = sy[b]! - sy[a]!; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      // 굽이: 아홉 칸 물결(잡음을 벌려 ±1 을 다 쓴다) — 붙들린 칸에서 다섯 칸 떨어지면 세 칸까지 옆으로 간다
      const wave = Math.max(-1, Math.min(1, (noise(i, pi * 31 + 7, 9, seed + 5) - 0.5) * 3.4));
      const amp = Math.min(1, Math.max(0, (dp[i]! - 1) / 4)) * 3.0 * wave;
      let cx = sx[i]!, cy = sy[i]!;
      // 굽은 줄이 건물·물 위로 지나면 원래 칸 쪽으로 반씩 당긴다
      for (const t of [1, 0.5, 0]) { cx = xs[i]! + (sx[i]! - ty * amp - xs[i]!) * t; cy = ys[i]! + (sy[i]! + tx * amp * 0.85 - ys[i]!) * t; if (open(cx, cy)) break; }
      const swell = Math.max(0, (noise(i, pi * 17 + 3, 7, seed + 3) - 0.42) * 2.6); // 구간마다 0 ~ 1.5칸 부푼다
      const r = base + swell + bump(xs[i]!, ys[i]!) + (dp[i] === 0 && !doorAt.has(p.cells[i]!) ? 0.3 : 0);
      disc(cx, cy, r, r * 0.86, inp.level(p.cells[i]!));
      // 귀: 열한 칸쯤마다 한쪽 옆으로 둥근 흙 자리 하나(수레 돌리는 자리·쉼터처럼)
      if (i % 11 === 5 + (pi % 5) && dp[i]! >= 2 && hash(i, pi, seed + 41) < 0.7) {
        const side = hash(pi, i, seed + 43) < 0.5 ? -1 : 1, lr = 2.1 + hash(i, pi, seed + 47) * 1.2;
        const lx = cx - ty * side * (r + lr * 0.45), ly = cy + tx * side * (r + lr * 0.45) * 0.85;
        if (open(lx, ly)) disc(lx, ly, lr, lr * 0.8, inp.level(p.cells[i]!));
      }
    }
  });
  else for (let c = 0; c < W * H; c += 1) {
    // 길 줄을 모르는 시공(띠 지형): 길 칸마다 원 — 구간마다 넓어졌다 좁아진다
    if (!inp.road(c)) continue; const x = c % W, y = (c - x) / W;
    const r = (0.95 + 1.15 * noise(x, y, 6, seed + 3) + bump(x, y)) * (inp.small ? 0.85 : 1);
    disc(x, y, r, r * 0.86, inp.level(c));
  }
  // 붙들린 길 칸은 흙으로 남는다
  for (let c = 0; c < W * H; c += 1) if (inp.road(c) && (!paths || isPin(c) || !inp.freeRoad?.(c))) kept.add(c);
  if (paths) for (const p of paths) { if (p.cells.length) { kept.add(p.cells[0]!); kept.add(p.cells[p.cells.length - 1]!); } }

  // 2) 모이는 곳 마당 + 가까운 문 앞으로 뻗는 귀 + 일터 마당 + 문 앞 닳은 자리
  const rx = inp.small ? 3.4 : 4.4 + Math.min(2.4, inp.houses * 0.4), ry = inp.small ? 2.5 : 3.0 + Math.min(1.4, inp.houses * 0.22);
  const before = cand.size;
  // 배치가 마당 자리를 주면(집이 그 둘레에 서 있다) 그 칸을 그대로 마당으로 — 네모는 모서리 한 칸을 깎고 가장자리를 칸 잡음으로 들쭉날쭉하게
  const given: number[] = [];
  if (inp.yard?.cells) given.push(...inp.yard.cells.filter((c) => c >= 0 && c < W * H));
  if (inp.yard?.rect) { const r = inp.yard.rect;
    for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) {
      if (!inMap(x, y)) continue;
      const edge = x === r.x || y === r.y || x === r.x + r.w - 1 || y === r.y + r.h - 1, corner = (x === r.x || x === r.x + r.w - 1) && (y === r.y || y === r.y + r.h - 1);
      if (corner || (edge && noise(x, y, 2.6, seed + 11) < 0.3)) continue;
      given.push(idx(x, y));
    } }
  for (const c of given) { if (inp.road(c)) kept.add(c); else if (canEarth(c)) cand.add(c); else if (inp.prop(c)) under.add(c); }
  if (!given.length) disc(g.x, g.y + 0.5, rx, ry, gl);
  // 마당이 집으로 뻗는다(집을 옮기지 않는다): 가까운 집 둘~넷의 문 앞을 씨앗으로, 모이는 곳에서 문 앞까지 혀를 내밀어 한 몸으로 키운다 —
  // 혀는 가는 줄이 아니라 폭이 서너 칸으로 부풀었다 줄었다 하고(잡음), 살짝 휘어 간다. 문 앞에서는 문 앞 닳은 자리와 합쳐진다. 먼 집은 흙길로 닿는다.
  const reach = rx + (inp.small ? 6 : 9);
  const near = given.length ? [] : inp.doors.map((d) => ({ d, r: Math.hypot(d.x - g.x, (d.y - g.y) * 1.25) })).filter((o) => o.r > 2 && o.r <= reach && inMap(o.d.x, o.d.y) && inp.level(idx(o.d.x, o.d.y)) === gl).sort((a, b) => a.r - b.r).slice(0, inp.small ? 2 : 4);
  near.forEach(({ d, r: dist }, k) => {
    const steps = Math.max(3, Math.ceil(dist / 1.4));
    const nx = -(d.y + 0.5 - g.y) / (dist || 1), ny = (d.x - g.x) / (dist || 1); // 혀의 옆 방향
    const bow = (hash(d.x, d.y, seed + 61) * 2 - 1) * Math.min(2.2, dist * 0.18);
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps, arc = Math.sin(t * Math.PI) * bow;
      const cx = g.x + (d.x - g.x) * t + nx * arc, cy = g.y + 0.5 + (d.y + 0.6 - g.y - 0.5) * t + ny * arc * 0.85;
      if (!open(cx, cy)) continue; // 건물·물 위는 건너뛴다 — 혀가 건물 뒤로 돌아가지 않는다
      const w = 1.75 + 1.1 * noise(i, k * 13 + 3, 2.7, seed + 67) - 0.35 * Math.abs(t - 0.5);
      disc(cx, cy, w, w * 0.8, gl);
    }
  });
  if (inp.work && inMap(inp.work.x, inp.work.y)) disc(inp.work.x, inp.work.y, 3.4, 2.3, inp.level(idx(inp.work.x, inp.work.y)));
  // 문 앞 마당: 집마다 제 문 앞에 닳은 흙 자리 — 크기·치우침이 집마다 다르다(자동 배치의 집은 모이는 곳에서 12~30칸 떨어져 서므로 마당 혀가 닿는 집은 셋에 하나뿐이다)
  for (const d of inp.doors) if (inMap(d.x, d.y)) {
    const h1 = hash(d.x, d.y, seed + 71), h2 = hash(d.y, d.x, seed + 73);
    disc(d.x + (h2 * 2 - 1) * 1.2, d.y + 0.9, 2.3 + h1 * 1.1, 1.5 + h1 * 0.6, inp.level(idx(d.x, d.y)));
  }
  const yard = cand.size - before;

  // 3) 넓은 흙 안의 작은 풀 섬: 흙 가장자리에서 두 칸 넘게 안쪽인 칸 가운데 잡음이 높은 자리
  {
    const inner = (c: number) => { const x = c % W, y = (c - x) / W; for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) { if (!inMap(x + dx, y + dy)) return false; const n = idx(x + dx, y + dy); if (!cand.has(n) && !kept.has(n)) return false; } return true; };
    const drop = [...cand].filter((c) => inner(c) && noise(c % W, Math.floor(c / W), 2.2, seed + 77) > 0.8);
    for (const c of drop) cand.delete(c);
  }

  // 4) 남는 길 칸에서 이어진 칸만 — 건물 뒤·단 너머로 떨어진 조각은 버린다
  const earth = new Set<number>();
  {
    const q: number[] = [...kept]; const seen = new Set(q);
    for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = c % W, y = (c - x) / W;
      for (const [dx, dy] of N4) { if (!inMap(x + dx, y + dy)) continue; const n = idx(x + dx, y + dy); if (cand.has(n) && !seen.has(n) && inp.level(n) === inp.level(c)) { seen.add(n); earth.add(n); q.push(n); } } }
  }
  const solid = (c: number) => earth.has(c) || kept.has(c);
  // 5) 다듬기: 세 면이 흙인 빈 칸은 메우고, 한 면만 닿은 흙 칸(혹)은 걷는다
  for (let pass = 0; pass < 3; pass += 1) {
    for (let c = 0; c < W * H; c += 1) {
      if (earth.has(c) || !canEarth(c)) continue; const x = c % W, y = (c - x) / W;
      if (N4.filter(([dx, dy]) => inMap(x + dx, y + dy) && solid(idx(x + dx, y + dy)) && inp.level(idx(x + dx, y + dy)) === inp.level(c)).length >= 3) earth.add(c);
    }
    for (const c of [...earth]) { const x = c % W, y = (c - x) / W;
      if (N4.filter(([dx, dy]) => inMap(x + dx, y + dy) && solid(idx(x + dx, y + dy))).length <= 1) earth.delete(c); }
  }
  // 6) 흙이 떠난 길 칸은 풀로 돌려준다 — 그 토막이 흙 몸의 두 덩이를 잇는 유일한 줄이면 흙으로 남긴다(걸어 닿는 길은 끊기지 않는다)
  const bare = new Set<number>(); for (let c = 0; c < W * H; c += 1) if (inp.road(c) && !kept.has(c)) bare.add(c);
  for (let round = 0; round < 40 && bare.size; round += 1) {
    const comp = new Map<number, number>(); let nComp = 0;
    for (const c0 of [...earth, ...kept]) {
      if (comp.has(c0)) continue; const q = [c0]; comp.set(c0, nComp);
      for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = c % W, y = (c - x) / W;
        for (const [dx, dy] of N4) { if (!inMap(x + dx, y + dy)) continue; const n = idx(x + dx, y + dy);
          // 단이 다른 이웃은 계단(붙들린 길 칸끼리)으로만 이어진다 — 절벽을 사이에 둔 흙은 이어진 것이 아니다
          if (solid(n) && !comp.has(n) && (inp.level(n) === inp.level(c) || (kept.has(n) && kept.has(c)))) { comp.set(n, nComp); q.push(n); } } }
      nComp += 1;
    }
    let restored = false; const seen = new Set<number>();
    for (const c0 of [...bare]) {
      if (seen.has(c0) || !bare.has(c0)) continue; const grp = [c0]; seen.add(c0); const touch = new Set<number>();
      for (let h = 0; h < grp.length; h += 1) { const c = grp[h]!, x = c % W, y = (c - x) / W;
        for (const [dx, dy] of N4) { if (!inMap(x + dx, y + dy)) continue; const n = idx(x + dx, y + dy); if (bare.has(n) && !seen.has(n)) { seen.add(n); grp.push(n); } else if (comp.has(n)) touch.add(comp.get(n)!); } }
      if (touch.size > 1) { for (const c of grp) { bare.delete(c); kept.add(c); } restored = true; break; }
    }
    if (!restored) break;
  }
  for (const c of [...earth]) { const x = c % W, y = (c - x) / W; if (N4.filter(([dx, dy]) => inMap(x + dx, y + dy) && solid(idx(x + dx, y + dy))).length <= 1) earth.delete(c); }
  for (const c of [...under]) { const x = c % W, y = (c - x) / W; if (!N4.some(([dx, dy]) => inMap(x + dx, y + dy) && solid(idx(x + dx, y + dy)))) under.delete(c); }
  return { earth: [...earth], under: [...under], bare: [...bare], yard };
}

/**
 * 곧고 폭이 한결같은 길 토막 — 일곱 칸 넘게 같은 줄 범위로 이어진 흙·길(가로는 열마다 같은 [위,아래], 세로는 줄마다 같은 [왼,오른]).
 * 시골 마을에 이런 토막이 남으면 «자로 그은 길» 로 읽힌다 — 탐침이 전후를 센다.
 */
export function straightEarthRuns(W: number, H: number, earth: (cell: number) => boolean, minLen = 7): { runs: number; cells: number; longest: number } {
  let runs = 0, cells = 0, longest = 0;
  const scan = (outer: number, inner: number, at: (o: number, i: number) => boolean) => {
    let open = new Map<string, number>();
    for (let o = 0; o <= outer; o += 1) {
      const now = new Map<string, number>();
      if (o < outer) for (let i = 0; i < inner; i += 1) {
        if (!at(o, i)) continue; let j = i; while (j + 1 < inner && at(o, j + 1)) j += 1;
        if (j - i < 4) { const k = `${i}-${j}`; now.set(k, (open.get(k) ?? 0) + 1); } // 폭 다섯 넘는 덩이는 마당이다
        i = j;
      }
      for (const [k, len] of open) if (!now.has(k) && len >= minLen) { runs += 1; cells += len; longest = Math.max(longest, len); }
      open = now;
    }
  };
  scan(W, H, (x, y) => earth(y * W + x));
  scan(H, W, (y, x) => earth(y * W + x));
  return { runs, cells, longest };
}
