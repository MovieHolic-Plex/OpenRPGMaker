// 버들항 시골 마을의 가장자리 꾸밈 — 흙과 풀, 풀과 물이 만나는 줄은 맨 선으로 두지 않는다.
//
// 왜(2026-11-14 오너 «내가 보낸 사진들처럼 유려한 마을»): 참고 그림의 꽃·키 큰 풀·잔돌은 흙 가장자리와 물가를 따라 무더기(띠)로 번지고, 그 사이 풀밭은
// 정말로 비어 있다. 시공기는 낱 덤불·풀꽃을 빈 땅에 고른 간격으로 흩었다 — «잔디 위의 같은 간격 점» 으로 읽혔다.
// 무엇을: 흙·물에 맞닿은 풀 칸 가운데 «띠가 서는 구간» 만 골라(낮은 주파수 잡음 — 구간으로 서고 구간으로 빈다) 걸어 넘는 한 칸 풀꽃·고사리·잔돌을 놓는다.
// 한 띠는 한두 가지로만(큰 잡음이 고른다). 문 곁에는 통·상자·자루를 벽에 붙여 두셋 모은다. 순수 함수 — 찍기는 시공기가 한다.

export interface DriftInput {
  readonly W: number; readonly H: number; readonly seed: number;
  /** 풀꽃이 설 수 있는 빈 풀 칸. */
  readonly free: (cell: number) => boolean;
  /** 흙(길·마당) 칸. */
  readonly earth: (cell: number) => boolean;
  /** 물 칸. */
  readonly water: (cell: number) => boolean;
  readonly level: (cell: number) => number;
  /** 풀꽃·고사리·헤더·잔돌 킷 이름(있는 것만) — 띠마다 이 가운데 한두 가지. */
  readonly flowers: readonly string[]; readonly ferns: readonly string[]; readonly stones: readonly string[];
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

/** 흙 가장자리·물가의 풀꽃 띠 — 칸마다 놓을 킷. */
export function planEdgeDrifts(inp: DriftInput): { cell: number; kit: string }[] {
  const { W, H, seed } = inp;
  const out: { cell: number; kit: string }[] = [];
  const near = (c: number, test: (n: number) => boolean, d: number): boolean => {
    const x = c % W, y = (c - x) / W;
    for (let dy = -d; dy <= d; dy += 1) for (let dx = -d; dx <= d; dx += 1) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx; if (test(n) && inp.level(n) === inp.level(c)) return true;
    }
    return false;
  };
  for (let c = 0; c < W * H; c += 1) {
    if (!inp.free(c)) continue; const x = c % W, y = (c - x) / W;
    const byEarth = near(c, inp.earth, 1), byWater = !byEarth && near(c, inp.water, 2);
    const second = !byEarth && !byWater && near(c, inp.earth, 2);
    if (!byEarth && !byWater && !second) continue;
    // 띠가 서는 구간: 일곱 칸 잡음의 높은 쪽 절반 — 나머지 가장자리는 맨 풀로 둔다(풀이 흙에 그대로 닿는 자리도 있어야 띠가 띠로 읽힌다)
    const band = noise(x, y, 7, seed + 91);
    if (band < (byWater ? 0.46 : 0.5)) continue;
    const fill = byEarth ? 0.8 : byWater ? 0.55 : 0.42;
    if (hash(x, y, seed + 97) > fill) continue;
    const kind = noise(x, y, 13, seed + 101), mix = hash(x, y, seed + 103);
    const pool = byWater ? (mix < 0.6 ? inp.ferns : inp.stones) : kind < 0.42 ? (mix < 0.8 ? inp.flowers : inp.ferns) : kind < 0.7 ? (mix < 0.75 ? inp.ferns : inp.stones) : (mix < 0.7 ? inp.flowers : inp.stones);
    const from = pool.length ? pool : inp.flowers;
    if (!from.length) continue;
    out.push({ cell: c, kit: from[Math.floor(hash(x * 3 + 1, y * 5 + 2, seed + 107) * from.length)]! });
  }
  return out;
}

/**
 * 문 곁 살림 무더기: 집 옆벽 아랫줄에 붙여 두셋(통·상자·자루·항아리) — 한 칸은 벽에, 다음 칸은 그 바깥이나 한 줄 위.
 * 자리(집 왼쪽 위 x·y, 폭·높이) → 놓아 볼 칸 순서(시공기가 빈 칸인지 보고 놓는다).
 */
export function doorsideSpots(house: { x: number; y: number; w: number; h: number }, side: 1 | -1, count: number): { x: number; y: number }[] {
  const wall = side > 0 ? house.x + house.w : house.x - 1, bottom = house.y + house.h - 1;
  return [{ x: wall, y: bottom }, { x: wall + side, y: bottom }, { x: wall, y: bottom - 1 }].slice(0, count);
}
