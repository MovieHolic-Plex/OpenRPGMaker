// 버들항 읍의 포장 중심부와 광장 — 성벽 안(또는 광장 둘레 구획)은 돌바닥이고, 풀은 심은 자리(화단·나무 자리)로만 남는다.
//
// 왜(2026-11-14 오너의 참고 마을): 성벽 읍·장터 읍의 참고 그림은 길(짙은 포석)과 안뜰(옅은 판석) 두 가지 돌이 바닥을 다 덮고,
// 풀은 네모 화단·나무 자리에만 있다. 우리 성벽 마을은 성벽 안이 잔디밭이고 밭이 셋 들어앉아 «성벽을 두른 농촌» 으로 읽혔다.
// 광장은 «항상 같은 바닥이 무작위처럼 깔린» 둥근 얼룩이었다 — 참고 그림의 광장은 테를 두른 네모이고 길이 변 가운데로 들어온다.
// 시골 마을의 흙(beodeulCommons.ts)은 굽이치고, 읍의 돌은 반듯하다 — 두 말씨를 섞지 않는다. 여기는 반듯한 쪽이다.
//
// 순수 계산만 한다(격자 사실을 받아 칸 목록을 돌려준다). 시공기(beodeulVillage.ts)가 안뜰 칸을 광장 칸으로 잡아 판석을 깔고, 화단·등·화분을 세운다.

export interface TownCoreInput {
  readonly W: number; readonly H: number; readonly seed: number;
  /** 중심부 안인가(성벽 안 전부 · 성벽이 없으면 광장 둘레 구획). */
  readonly inside: (cell: number) => boolean;
  /** 안뜰 판석을 깔 수 있는 빈 칸인가(빈 땅 · 물가·절벽 끝·계단 아님). */
  readonly open: (cell: number) => boolean;
  /** 길(포석)·광장 칸. */
  readonly road: (cell: number) => boolean;
  /** 건물 칸. */
  readonly building: (cell: number) => boolean;
  /** 문 앞 칸. */
  readonly doors: readonly { readonly x: number; readonly y: number }[];
}
export interface TownBed { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
export interface TownCorePlan {
  /** 안뜰 판석을 깔 칸(화단 칸 제외). */
  readonly court: number[];
  /** 풀을 남기는 네모 화단(나무·꽃 자리) — 둘레 한 칸은 모두 안뜰이라 화단이 길을 막지 않는다. */
  readonly beds: TownBed[];
  /** 길가 등 자리(발 칸) — 길 옆 안뜰, 서로 일곱 칸 넘게 띄운다. */
  readonly lamps: { x: number; y: number }[];
  /** 벽 밑 화분·긴 의자 자리(건물 남쪽 벽 바로 아래 안뜰 칸). */
  readonly planters: { x: number; y: number }[];
  /** 안뜰 살림 자리(발 자리 왼쪽 아래 칸) — 좌판·수레·짐 더미가 선다. */
  readonly goods: { x: number; y: number }[];
}

const hash = (x: number, y: number, seed: number): number => {
  let h = Math.imul(x * 73856093 ^ y * 19349663 ^ seed * 83492791, 0x27d4eb2d);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};

export function planTownCore(inp: TownCoreInput): TownCorePlan {
  const { W, H, seed } = inp;
  const idx = (x: number, y: number) => y * W + x;
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  // 안뜰: 중심부 안의 빈 칸 가운데 길·광장에서 걸어 닿는 칸만(건물 뒤에 갇힌 조각은 풀로 남긴다)
  const cand = new Set<number>();
  for (let c = 0; c < W * H; c += 1) if (inp.inside(c) && inp.open(c)) cand.add(c);
  const court = new Set<number>(); const q: number[] = [];
  const near = (c: number): number[] => { const x = c % W; return [c - 1, c + 1, c - W, c + W].filter((n) => n >= 0 && n < W * H && Math.abs((n % W) - x) <= 1); };
  for (const c of cand) if (near(c).some((n) => inp.road(n))) { court.add(c); q.push(c); }
  for (let h = 0; h < q.length; h += 1) for (const n of near(q[h]!)) if (cand.has(n) && !court.has(n)) { court.add(n); q.push(n); }
  // 문 앞 길목(문 앞 칸과 그 아래 세 칸, 옆 한 칸씩)에는 아무것도 세우지 않는다
  const doorway = new Set<number>();
  for (const d of inp.doors) for (let dy = 0; dy <= 3; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if (inMap(d.x + dx, d.y + dy)) doorway.add(idx(d.x + dx, d.y + dy));
  const taken = new Set<number>();
  const clear = (x: number, y: number) => inMap(x, y) && court.has(idx(x, y)) && !doorway.has(idx(x, y)) && !taken.has(idx(x, y));

  // 1) 화단: 큰 자리부터(뜰 5×4 → 나무 자리 3×3 → 덤불 자리 2×2) 칸 해시 순으로 훑어, 네모와 둘레 한 칸이 모두 빈 안뜰인 자리에만 놓는다 —
  //    구획 안쪽(길·건물·문에서 한 칸 넘게)이고 화단끼리는 세 칸 넘게 떨어진다. 풀 몫은 안뜰의 여섯에 하나까지, 크기마다 몫을 나눈다.
  const beds: TownBed[] = [];
  let green = 0; const cap = court.size / 6;
  const order = [...court].sort((a, b) => hash(a % W, Math.floor(a / W), seed + 101) - hash(b % W, Math.floor(b / W), seed + 101));
  const sizes: readonly (readonly [number, number, number])[] = [[5, 4, 0.45], [4, 3, 0.7], [3, 3, 0.85], [3, 2, 0.95], [2, 2, 1]];
  for (const [w, h, share] of sizes) for (const c of order) {
    if (green + w * h > cap * share) break;
    const x = c % W, y = (c - x) / W;
    let ok = true;
    for (let j = -1; j <= h && ok; j += 1) for (let i = -1; i <= w && ok; i += 1) if (!clear(x + i, y + j)) ok = false;
    if (!ok) continue;
    beds.push({ x, y, w, h }); green += w * h;
    for (let j = -3; j <= h + 2; j += 1) for (let i = -3; i <= w + 2; i += 1) if (inMap(x + i, y + j)) taken.add(idx(x + i, y + j));
  }
  // 화단 둘레 띠(세 칸)는 화단끼리 띄우는 데만 썼다 — 등·화분 자리로는 다시 연다(화단과 그 둘레 한 칸만 잡아 둔다)
  taken.clear();
  for (const b of beds) for (let j = -1; j <= b.h; j += 1) for (let i = -1; i <= b.w; i += 1) taken.add(idx(b.x + i, b.y + j));
  for (const b of beds) for (let j = 0; j < b.h; j += 1) for (let i = 0; i < b.w; i += 1) court.delete(idx(b.x + i, b.y + j));

  // 2) 길가 등: 길 칸 바로 옆(동·서) 안뜰 칸 — 서로 일곱 칸 넘게 띄운다. 등은 세 칸 높이라 발 위 두 칸도 안뜰이어야 한다.
  const lamps: { x: number; y: number }[] = [];
  const far = (list: readonly { x: number; y: number }[], x: number, y: number, gap: number) => list.every((p) => Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) >= gap);
  for (let y = 2; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (!clear(x, y) || !clear(x, y - 1) || !clear(x, y - 2)) continue;
    const beside = [-1, 1].some((dx) => inMap(x + dx, y) && inp.road(idx(x + dx, y)));
    if (!beside || hash(x, y, seed + 113) < 0.35 || !far(lamps, x, y, 7)) continue;
    lamps.push({ x, y }); for (const dy of [0, 1, 2]) taken.add(idx(x, y - dy));
  }

  // 3) 벽 밑 화분·긴 의자: 건물 남쪽 벽 바로 아래 안뜰 칸 — 드문드문(세 칸 넘게 띄운다)
  const planters: { x: number; y: number }[] = [];
  for (let y = 1; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (!clear(x, y) || !inp.building(idx(x, y - 1)) || hash(x, y, seed + 127) < 0.45 || !far(planters, x, y, 3)) continue;
    planters.push({ x, y }); taken.add(idx(x, y));
  }
  // 4) 안뜰 살림(좌판·수레·짐 더미 자리): 길에서 두 칸 넘게 들어간 넓은 안뜰 — 발 자리 3×2 와 그 위 두 줄이 빈 안뜰, 서로 여덟 칸 넘게 띄운다
  const goods: { x: number; y: number }[] = [];
  for (const c of order) {
    const x = c % W, y = (c - x) / W;
    if (hash(x, y, seed + 131) < 0.5 || !far(goods, x, y, 8)) continue;
    let ok = true;
    for (let j = -3; j <= 1 && ok; j += 1) for (let i = -1; i <= 3 && ok; i += 1) if (!clear(x + i, y + j)) ok = false;
    if (!ok) continue;
    goods.push({ x, y }); for (let j = -2; j <= 0; j += 1) for (let i = 0; i <= 2; i += 1) taken.add(idx(x + i, y + j));
  }
  return { court: [...court], beds, lamps, planters, goods };
}

/**
 * 성벽 없는 읍의 포장 구획: 광장 둘레 두 칸 띠 + 광장 가까운 길(네모에서 열 칸 안)의 양옆 한 칸(길섶 판석) + 그 안 문 앞 3×2.
 * 네모를 통째로 덮지 않는다 — 강·둑에 잘린 조각이 제멋대로 생긴다. 길을 따라가는 반듯한 띠라 어디서 끊겨도 길섶으로 읽힌다.
 */
export function townPrecinct(W: number, H: number, box: SquareBox, square: Iterable<number>, road: (cell: number) => boolean, doors: readonly { readonly x: number; readonly y: number }[]): Set<number> {
  const out = new Set<number>();
  const put = (x: number, y: number) => { if (x >= 0 && y >= 0 && x < W && y < H) out.add(y * W + x); };
  const near = (x: number, y: number) => x >= box.x0 - 10 && x <= box.x1 + 10 && y >= box.y0 - 8 && y <= box.y1 + 8;
  for (const c of square) { const x = c % W, y = (c - x) / W; for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) put(x + dx, y + dy); }
  for (let c = 0; c < W * H; c += 1) { const x = c % W, y = (c - x) / W; if (road(c) && near(x, y)) for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) put(x + dx, y + dy); }
  for (const d of doors) if (near(d.x, d.y)) for (let dy = 0; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) put(d.x + dx, d.y + dy);
  return out;
}

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
 * 광장의 안이 한 덩이인가(여섯 칸 이상, 네 방향으로 이어진 하나). 물가에 깎여 계단 꼴이 된 포구 광장은 안이 조각난다 —
 * 그런 광장을 테와 안으로 나눠 깔면 조각마다 연석이 둘러져 바닥에 작은 네모 줄이 생긴다(2026-11-15 은행 lay-base-harbor «항구 마을»).
 * 한 덩이가 아니면 바닥은 통째로 길 포석으로 깐다(놓기 규칙의 테·안은 그대로다).
 */
export function squareInnerWhole(W: number, inner: readonly number[]): boolean {
  if (inner.length < 6) return false;
  const set = new Set(inner), seen = new Set<number>([inner[0]!]), queue = [inner[0]!];
  for (let k = 0; k < queue.length; k += 1) {
    const c = queue[k]!, x = c % W;
    for (const n of [c - W, c + W, x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1]) if (set.has(n) && !seen.has(n)) { seen.add(n); queue.push(n); }
  }
  return seen.size === set.size;
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
