// 버들항 자연 물 꾸밈 — 물가 둑·깊이 띠(2층 덧그림)·폭포·물 위 것 무리. 마을 시공기와 다른 야외 시공기가 같이 쓴다.
//
// 왜(2026-11-14 오너 «물 색깔이나 뭐 ... 그런 것들을 좀 더 고려해야할거같군», «내가 보낸 사진들처럼 유려한 마을이었음 좋겠군»):
// 자연 물은 몸통 칸 하나(오토타일 «버들항 강·운하 물» 의 꽉 찬 칸)를 깔고 둑 덧그림만 얹어, 물 화소의 3~6할이 한 가지 색인 평평한 판이었다.
//   · 1층 물 칸은 그대로 둔다(칸 번호·통행·«물인가» 검사·8프레임 물결) — 깊이는 2층 반투명 덧그림이라 물결이 비친다.
//   · 물가 칸(8이웃에 뭍이 있는 물 칸)은 둑 그림: 풀 입술 → 젖은 테 → 밝은 얕은 물 선 → 얕은 띠. 대각 계단은 그림이 둥글린다.
//   · 그 안쪽은 깊이 띠 셋(뭍에서 두 칸·네 칸·일곱 칸) — 좁은 강은 한 띠, 못·바다는 셋. 띠 끝은 낮은 주파수 잡음으로 흔든다.
// 그림은 assets/tilesetWater.ts(scripts/content/beodeul-water/bake.py). 물빛은 겉모습의 water 갈래가 고른다 — 여기서는 칸만 고른다.
import { tilesetWaterTableFor, waterOverlaySource } from "@/assets/tilesetWater";
import { BEODEUL_NATURE, BEODEUL_NATURE_TEXTURE } from "@/project/defaults/beodeulNature";
import { lookHash } from "@/project/kitLook";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import { translateTiles } from "@/project/objectStamp";
import type { GameMap, TilesetDef } from "@/project/types";

const N8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const;
/** 깊이 띠 문턱(뭍에서의 모따기 거리 ×3 — 한 칸 = 3, 대각 = 4). */
const BAND = [5, 12, 21] as const;

export interface WaterSurfaceInput {
  /** 물 칸인가(다리·잔교 밑도 물이다 — 둑이 그 밑에서 끊기지 않게). 맵 밖은 물로 친다. */
  wet(cell: number): boolean;
  /** 이 칸의 2층에 덧그림을 둘 수 있는가(1층이 자연 물 몸통이고 2층이 비어 있는 물 칸). */
  open(cell: number): boolean;
  seed: number;
  /** 물가 둑을 두지 않는 물(돌 둑 운하·항구 — 곧은 돌 가장자리 그대로). 깊이 띠는 둔다. */
  hardEdge?(cell: number): boolean;
}

export interface WaterSurfaceResult { shore: number; deep: number; bands: number[] }

/** 뭍에서의 모따기 거리(3·4) — 물이 아닌 칸은 0. 맵 가장자리는 물이 이어진다고 본다. */
export function waterDepth(W: number, H: number, wet: (cell: number) => boolean): Int16Array {
  const d = new Int16Array(W * H).fill(32000);
  for (let c = 0; c < W * H; c += 1) if (!wet(c)) d[c] = 0;
  const relax = (c: number, x: number, y: number, dx: number, dy: number, w: number) => {
    const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) return;
    const v = d[Y * W + X]! + w; if (v < d[c]!) d[c] = v;
  };
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) { const c = y * W + x; relax(c, x, y, -1, 0, 3); relax(c, x, y, 0, -1, 3); relax(c, x, y, -1, -1, 4); relax(c, x, y, 1, -1, 4); }
  for (let y = H - 1; y >= 0; y -= 1) for (let x = W - 1; x >= 0; x -= 1) { const c = y * W + x; relax(c, x, y, 1, 0, 3); relax(c, x, y, 0, 1, 3); relax(c, x, y, 1, 1, 4); relax(c, x, y, -1, 1, 4); }
  return d;
}

function valueNoise(seed: number): (x: number, y: number) => number {
  const at = (ix: number, iy: number) => (lookHash(`wn|${seed}|${ix}|${iy}`) % 1024) / 1023;
  const cache = new Map<number, number>();
  const g = (ix: number, iy: number) => { const k = ix * 4096 + iy; let v = cache.get(k); if (v === undefined) { v = at(ix, iy); cache.set(k, v); } return v; };
  return (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    return (g(ix, iy) * (1 - sx) + g(ix + 1, iy) * sx) * (1 - sy) + (g(ix, iy + 1) * (1 - sx) + g(ix + 1, iy + 1) * sx) * sy;
  };
}

/**
 * 자연 물의 2층 덧그림을 깐다: 물가 칸에는 둑, 그 안쪽에는 깊이 띠. 1층·통행은 건드리지 않는다.
 * 이 타일셋에 물 그림판 표가 없으면(다른 칩셋) 아무것도 하지 않는다.
 */
export function layBeodeulWaterSurface(map: GameMap, tileset: TilesetDef, input: WaterSurfaceInput): WaterSurfaceResult {
  const table = tilesetWaterTableFor(tileset.id);
  const result: WaterSurfaceResult = { shore: 0, deep: 0, bands: [0, 0, 0] };
  if (!table) return result;
  const W = map.width, H = map.height;
  const wet = (x: number, y: number) => x < 0 || y < 0 || x >= W || y >= H || input.wet(y * W + x);
  const depth = waterDepth(W, H, input.wet);
  const noise = valueNoise(input.seed), tone = valueNoise(input.seed + 77);
  // 띠 묶음: A0 = 물가 칸이 아닌 물 칸 · A1·A2 = 더 먼 물(문턱을 잡음으로 ±3 흔든다). 안쪽 띠는 바깥 띠에서 한 칸 넘게 들어와야 한다(띠 그림의 바깥이 한 단 옅은 막이라).
  const level = new Int8Array(W * H).fill(-1);
  for (let c = 0; c < W * H; c += 1) {
    if (!input.wet(c)) continue;
    const x = c % W, y = (c - x) / W, d = depth[c]! + Math.round((noise(x / 4.5, y / 4.5) - 0.5) * 7);
    level[c] = depth[c]! < BAND[0] ? -1 : d >= BAND[2] ? 2 : d >= BAND[1] ? 1 : 0;
  }
  for (const k of [1, 2] as const) for (let c = 0; c < W * H; c += 1) {
    if (level[c]! < k) continue;
    const x = c % W, y = (c - x) / W;
    if (N8.some(([dx, dy]) => { const X = x + dx, Y = y + dy; return X >= 0 && Y >= 0 && X < W && Y < H && level[Y * W + X]! < k - 1; })) level[c] = k - 1;
  }
  const want = new Map<number, number>();
  for (let c = 0; c < W * H; c += 1) {
    if (!input.wet(c) || !input.open(c)) continue;
    const x = c % W, y = (c - x) / W;
    const k = level[c]!;
    if (k < 0) {
      if (input.hardEdge?.(c)) continue;
      let mask = 0; N8.forEach(([dx, dy], b) => { if (wet(x + dx, y + dy)) mask |= 1 << b; });
      const t = table.shore[mask] ?? -1;
      if (t >= 0) { want.set(c, t); result.shore += 1; }
      continue;
    }
    let mask = 0; N8.forEach(([dx, dy], b) => { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H || level[Y * W + X]! >= k) mask |= 1 << b; });
    const full = table.deepFull[k]!;
    const t = mask === 255 ? full[(Math.min(3, Math.floor(tone(x / 3.2, y / 3.2) * 4)) * 2 + (lookHash(`wv|${input.seed}|${x}|${y}`) & 1)) % full.length]! : table.deep[k]![mask] ?? -1;
    if (t >= 0) { want.set(c, t); result.deep += 1; result.bands[k]! += 1; }
  }
  if (!want.size) return result;
  const moved = translateTiles(waterOverlaySource(table), tileset, new Set(want.values()));
  for (const [c, t] of want) { const to = moved.map.get(t); if (to !== undefined && to >= 0) setLayerTileAt(map, 2, c, to); }
  return result;
}

/** 이 타일셋에 이식된 물가 둑 칸(풀 입술이 든 덧그림) — 풀이 사라지는 맵 변형(황무지)이 옛 풀 둑과 함께 걷어 낸다. */
export function waterShoreTiles(tileset: TilesetDef): Set<number> {
  const table = tilesetWaterTableFor(tileset.id), out = new Set<number>();
  if (!table) return out;
  const shore = new Set(table.shore.filter((t) => t >= 0));
  for (const graft of tileset.tileGrafts ?? []) if (graft.sourceChipset === table.texture && shore.has(graft.sourceTile)) out.add(graft.targetTile);
  return out;
}

/**
 * 이미 지은 맵의 자연 물(1층 = 물 몸통 칸, 2층 = 옛 풀 둑 덧그림이거나 빈 칸)을 새 둑·깊이 띠로 다시 깐다 — 물을 스스로 칠하는 다른 시공기(숲길 연못·숲 던전 못)가
 * 끝난 뒤 부른다. 옛 풀 둑(자연 덧그림 bankGrass 이식 칸)만 걷어 낸다: 다리·그림자 같은 다른 2층 그림이 있는 물 칸은 그대로 둔다.
 */
export function relayBeodeulWaterSurface(map: GameMap | undefined, tileset: TilesetDef | undefined, seed: number): WaterSurfaceResult | null {
  const table = tileset ? tilesetWaterTableFor(tileset.id) : undefined;
  const body = tileset?.autotileGroups?.find((g) => g.id === "beodeul_canal_lake_47")?.variantMap?.["255"];
  if (!map || !tileset || !table || body === undefined) return null;
  const bank = new Set(BEODEUL_NATURE.bankGrass.filter((t) => t >= 0));
  const old = new Set<number>();
  for (const graft of tileset.tileGrafts ?? []) if (graft.sourceChipset === BEODEUL_NATURE_TEXTURE && bank.has(graft.sourceTile)) old.add(graft.targetTile);
  const water = new Set<number>();
  for (let c = 0; c < map.lowerTiles.length; c += 1) if (map.lowerTiles[c] === body) water.add(c);
  if (!water.size) return null;
  for (const c of water) if (old.has(layerTileAt(map, 2, c))) setLayerTileAt(map, 2, c, -1);
  // 다리·널판처럼 물 위에 놓인 걷는 칸(1층이 물 몸통이 아닌 칸)은 물이 이어진 것으로 본다 — 둑이 그 밑에서 끊기지 않게: 양옆(또는 위아래)이 물인 칸
  const W = map.width, H = map.height;
  const span = (c: number) => { const x = c % W, y = (c - x) / W; return (x > 0 && x < W - 1 && water.has(c - 1) && water.has(c + 1)) || (y > 0 && y < H - 1 && water.has(c - W) && water.has(c + W)); };
  return layBeodeulWaterSurface(map, tileset, { seed, wet: (c) => water.has(c) || span(c), open: (c) => water.has(c) && layerTileAt(map, 2, c) < 0 });
}

/**
 * 폭포: 강 칸이 바로 남쪽 강 칸보다 높은 줄마다 절벽면(relief.wallDecor)에 폭포 그림을 걸고, 위 물 칸에 물마루·아래 물 칸에 용소 물보라(4층 — 물 위라 인물이 서지 않는다)를 얹는다.
 * 폭포 칸은 여덟 프레임 띠로 이식해 움직인다(tileset.animationStrips). 높이 지형이 없거나 그런 줄이 없으면 아무것도 하지 않는다. 돌려주는 값 = 폭포 수.
 */
export function hangBeodeulWaterfalls(map: GameMap, tileset: TilesetDef, wet: (cell: number) => boolean): number {
  const table = tilesetWaterTableFor(tileset.id), relief = map.relief;
  if (!table || !relief) return 0;
  const W = map.width, H = map.height, lv = relief.levels;
  const runs: { x0: number; x1: number; y: number; drop: number }[] = [];
  for (let y = 0; y < H - 1; y += 1) {
    let x0 = -1, drop = 0;
    for (let x = 0; x <= W; x += 1) {
      const c = y * W + x;
      const d = x < W && wet(c) && wet(c + W) ? (lv[c] ?? 0) - (lv[c + W] ?? 0) : 0;
      if (d > 0 && x0 >= 0 && d === drop) continue;
      if (x0 >= 0) { runs.push({ x0, x1: x - 1, y, drop }); x0 = -1; }
      if (d > 0) { x0 = x; drop = d; }
    }
  }
  if (!runs.length) return 0;
  const source = waterOverlaySource(table), { frames, fps } = table.fall;
  const strip = (first: number): number => {
    const moved = translateTiles(source, tileset, Array.from({ length: frames }, (_, f) => first + f));
    const base = moved.map.get(first)!;
    // 프레임은 이어진 칸 번호여야 한다 — 한 번에 옮기면 이어 붙는다. 아니면(옛 사본이 일부만 가졌을 때) 첫 장만 서 있는 그림으로 둔다.
    const run = Array.from({ length: frames }, (_, f) => moved.map.get(first + f)).every((to, f) => to === base + f);
    if (run && !(tileset.animationStrips ?? []).some((s) => s.baseTile === base)) tileset.animationStrips = [...(tileset.animationStrips ?? []), { baseTile: base, frames, fps }];
    return base;
  };
  const decor = [...(relief.wallDecor ?? [])];
  for (const r of runs) for (let x = r.x0; x <= r.x1; x += 1) {
    const pos = r.x0 === r.x1 ? 3 : x === r.x0 ? 0 : x === r.x1 ? 2 : 1;
    for (let row = 1; row <= r.drop; row += 1) {
      const part = row === r.drop ? table.fall.foot : row === 1 ? table.fall.top : table.fall.body;
      const at = decor.findIndex((d) => d.x === x && d.y === r.y && d.row === row);
      const tile = { x, y: r.y, row, tile: strip(part[pos]!) };
      if (at >= 0) decor[at] = tile; else decor.push(tile);
    }
    const c = r.y * W + x;
    const lace = translateTiles(source, tileset, [table.crest[pos]!, table.plunge[pos]!]);
    if (layerTileAt(map, 4, c) < 0 && layerTileAt(map, 3, c) < 0) setLayerTileAt(map, 4, c, lace.map.get(table.crest[pos]!)!);
    if (layerTileAt(map, 4, c + W) < 0 && layerTileAt(map, 3, c + W) < 0) setLayerTileAt(map, 4, c + W, lace.map.get(table.plunge[pos]!)!);
  }
  relief.wallDecor = decor;
  return runs.length;
}

/** 물 위·물가의 것 — 있는 킷만 쓴다(없는 사본에서는 그 종류를 건너뛴다). 새 기물(bd-obj-*)이 구워져 있으면 그것을 먼저 쓴다. */
const LILY_WIDE = ["bd-obj-water-lilies"] as const;
const LILY_ONE = ["bd-pick-dungeon-theme-lily-pads", "bd-pick-dungeon-theme-lily-pads-2"] as const;
const REEDS = ["bd-obj-bulrush", "bd-pick-desert-oasis-reed"] as const;
const STEP_STONES = ["bd-obj-step-stone-a", "bd-obj-step-stone-b"] as const;

export interface WaterLifeKit { readonly id: string; readonly w: number; readonly h: number }
export interface WaterLifeHost {
  readonly W: number; readonly H: number; readonly seed: number;
  /** 고인 물 자리(강 굽이의 소·못 가운데) — 없으면 가장 깊은 자리에서 찾는다. */
  readonly pools: readonly number[];
  wet(x: number, y: number): boolean;
  /** 길이 물을 건너는 칸(다리·나루·잔교) — 그 둘레 두 칸에는 아무것도 띄우지 않는다. */
  crossing(x: number, y: number): boolean;
  taken(x: number, y: number): boolean;
  kit(id: string): WaterLifeKit | undefined;
  placeWater(kit: WaterLifeKit, x: number, y: number): void;
  /** 뭍 자리 검사·놓기는 시공기의 규칙 그대로(빈 땅·한 단·길 곁/문 앞). */
  fitsLand(kit: WaterLifeKit, x: number, y: number): boolean;
  placeLand(kit: WaterLifeKit, x: number, y: number): void;
}

/**
 * 고인 물에 수련 무리(두세 장 + 꽃)와 그 곁 둑의 갈대를 놓는다. 고르게 흩지 않는다 — 소·못마다 한 무리, 무리 사이는 물을 비운다.
 * 수련은 둑 그림에 걸치지 않는 물 칸(8이웃이 모두 물)에만, 건널 자리 둘레 두 칸 밖에만 뜬다. 돌려주는 값 = 무리 수·수련 수·갈대 수.
 */
export function dressBeodeulWaterLife(host: WaterLifeHost): { clusters: number; lilies: number; reeds: number } {
  const { W, H } = host, out = { clusters: 0, lilies: 0, reeds: 0 };
  const have = (ids: readonly string[]) => ids.map((id) => host.kit(id)).filter((k): k is WaterLifeKit => !!k);
  const wide = have(LILY_WIDE), one = have(LILY_ONE), reeds = have(REEDS);
  if (!wide.length && !one.length) return out;
  let s = lookHash(`waterlife|${host.seed}|${W}|${H}`) || 1;
  const rand = () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; s ^= s >>> 13; return (s >>> 0) / 4294967296; };
  const inner = (x: number, y: number) => x > 0 && y > 0 && x < W - 1 && y < H - 1 && host.wet(x, y) && N8.every(([dx, dy]) => host.wet(x + dx, y + dy));
  const calm = (x: number, y: number) => { for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) if (host.crossing(x + dx, y + dy)) return false; return true; };
  const free = (k: WaterLifeKit, x: number, y: number) => { for (let i = 0; i < k.w; i += 1) for (let j = 0; j < k.h; j += 1) if (!inner(x + i, y + j) || host.taken(x + i, y + j) || !calm(x + i, y + j)) return false; return true; };
  const depth = waterDepth(W, H, (c) => host.wet(c % W, Math.floor(c / W)));
  // 무리 자리: 소·못 가운데에서 가까운, 둑 바로 안쪽 물 칸(뭍에서 두 칸 안) — 수련은 물가에 붙어 뜬다
  const anchors: number[] = [];
  const far = (c: number) => anchors.every((a) => Math.abs((a % W) - (c % W)) + Math.abs(Math.floor(a / W) - Math.floor(c / W)) >= 9);
  const near = (p: number): number => {
    const px = p % W, py = Math.floor(p / W); let best = -1, bs = Infinity;
    for (let dy = -4; dy <= 4; dy += 1) for (let dx = -4; dx <= 4; dx += 1) {
      const x = px + dx, y = py + dy; if (!inner(x, y) || !calm(x, y) || host.taken(x, y)) continue;
      const sc = Math.abs(depth[y * W + x]! - 6) * 2 + Math.hypot(dx, dy) + rand() * 1.5;
      if (sc < bs) { bs = sc; best = y * W + x; }
    }
    return best;
  };
  for (const p of host.pools) { const a = near(p); if (a >= 0 && far(a)) anchors.push(a); }
  if (!anchors.length) {
    // 소를 모르는 물(옛 띠 지형의 강·바닷가 못): 가장 깊은 자리 둘레에서
    let deep = -1; for (let c = 0; c < W * H; c += 1) if (depth[c]! < 32000 && depth[c]! >= 6 && (deep < 0 || depth[c]! > depth[deep]!)) deep = c;
    const a = deep >= 0 ? near(deep) : -1; if (a >= 0) anchors.push(a);
  }
  for (const a of anchors.slice(0, 4)) {
    const ax = a % W, ay = Math.floor(a / W); let n = 0;
    const spots = [[0, 0], [1, 1], [-1, 1], [2, -1], [-2, 0], [1, -1], [0, 2], [-1, -1]].map(([dx, dy]) => [ax + dx!, ay + dy!] as const);
    const goal = 2 + (rand() < 0.5 ? 1 : 0);
    for (const [x, y] of spots) {
      if (n >= goal) break;
      const k = n === 0 && wide.length && free(wide[0]!, x, y) ? wide[0]! : one.length ? one[(n + out.clusters) % one.length]! : undefined;
      if (!k || !free(k, x, y)) continue;
      // 무리 안에서도 붙여 깔지 않는다 — 앞서 놓은 것과 한 칸은 띄운다(대각은 닿아도 된다)
      host.placeWater(k, x, y); n += 1; out.lilies += 1;
    }
    if (!n) continue;
    out.clusters += 1;
    // 갈대: 무리에서 가장 가까운 둑 두 자리(물에 닿은 뭍 칸, 발이 그 칸)
    let put = 0;
    const shore: { x: number; y: number; d: number }[] = [];
    for (let dy = -4; dy <= 4; dy += 1) for (let dx = -4; dx <= 4; dx += 1) {
      const x = ax + dx, y = ay + dy; if (x < 1 || y < 2 || x >= W - 1 || y >= H - 1 || host.wet(x, y) || host.crossing(x, y)) continue;
      if (!(host.wet(x + 1, y) || host.wet(x - 1, y) || host.wet(x, y + 1) || host.wet(x, y - 1))) continue;
      shore.push({ x, y, d: Math.hypot(dx, dy) + rand() });
    }
    shore.sort((p, q) => p.d - q.d);
    for (const p of shore) {
      if (put >= 2 || !reeds.length) break;
      const k = reeds[(put + out.clusters) % reeds.length]!, x = p.x, y = p.y - k.h + 1;
      if (!host.fitsLand(k, x, y)) continue;
      host.placeLand(k, x, y); put += 1; out.reeds += 1;
    }
  }
  return out;
}

/**
 * 한 칸 폭 나루(들길이 강을 건너는 널판 줄)를 물 징검돌로 바꾼다 — 1층은 물 그대로(물결·깊이 띠가 돌 사이로 보인다), 3층에 징검돌(걷는 칸).
 * 폭 2 길의 널다리·잔교는 그대로 둔다. 징검돌 킷이 없는 사본에서는 아무것도 하지 않는다. 돌려주는 값 = 바꾼 칸 수.
 */
export function stoneBeodeulFords(map: GameMap, tileset: TilesetDef, input: { fords: readonly number[]; water: number; wet(cell: number): boolean; seed: number }): number {
  const kits = STEP_STONES.map((id) => tileset.structureKits?.find((k) => k.id === id)).filter((k) => !!k);
  const stones = kits.map((k) => k!.rows[0]?.upperTiles?.[0] ?? -1).filter((t) => t >= 0);
  if (!stones.length || input.water < 0 || !input.fords.length) return 0;
  const W = map.width, set = new Set(input.fords), seen = new Set<number>();
  const turned: number[] = [];
  for (const start of input.fords) {
    if (seen.has(start)) continue;
    const comp = [start]; seen.add(start);
    for (let i = 0; i < comp.length; i += 1) { const c = comp[i]!, x = c % W;
      for (const n of [c - W, c + W, x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1]) if (n >= 0 && set.has(n) && !seen.has(n)) { seen.add(n); comp.push(n); } }
    const xs = comp.map((c) => c % W), ys = comp.map((c) => Math.floor(c / W));
    const w = Math.max(...xs) - Math.min(...xs) + 1, h = Math.max(...ys) - Math.min(...ys) + 1;
    if (Math.min(w, h) !== 1 || comp.length > 6) continue;                // 한 칸 폭·짧은 줄만
    if (comp.some((c) => layerTileAt(map, 3, c) >= 0 || layerTileAt(map, 4, c) >= 0)) continue;
    comp.sort((p, q) => p - q);
    comp.forEach((c, i) => { map.lowerTiles[c] = input.water; setLayerTileAt(map, 3, c, stones[(i + (input.seed & 1)) % stones.length]!); turned.push(c); });
  }
  if (turned.length) { const back = new Set(turned); layBeodeulWaterSurface(map, tileset, { seed: input.seed, wet: input.wet, open: (c) => back.has(c) && layerTileAt(map, 2, c) < 0 }); }
  return turned.length;
}

/**
 * 폭포 곁의 다리(참고 그림의 «폭포 곁 널다리»): 폭포 위 넷째~여섯째 줄(윗단)이나 아래 넷째~일곱째 줄(용소 바로 밑)에서 강을 동서로 건너는 널판 칸.
 * 양쪽 둑이 빈 땅이고 강과 같은 단일 때만, 강 폭이 2~6칸일 때만 놓는다. 이미 건널 자리가 여섯 칸 안에 있으면 놓지 않는다. 돌려주는 값 = 널판을 깔 물 칸.
 */
export function fallBridgeCells(input: { W: number; H: number; falls: readonly { x0: number; x1: number; y: number }[]; wet(cell: number): boolean; free(cell: number): boolean; level(cell: number): number; crossing(cell: number): boolean }): number[] {
  const { W, H } = input, out: number[] = [], taken = new Set<number>();
  for (const f of input.falls) {
    const mid = Math.round((f.x0 + f.x1) / 2);
    const rowsAt = (y: number): number[] | null => {
      if (y < 2 || y + 1 > H - 3 || !input.wet(y * W + mid)) return null;
      const cells: number[] = []; let lo = W, hi = -1;
      for (const yy of [y, y + 1]) {
        let a = mid, b = mid;
        while (a > 1 && input.wet(yy * W + a - 1)) a -= 1;
        while (b < W - 2 && input.wet(yy * W + b + 1)) b += 1;
        if (!input.wet(yy * W + mid) || b - a + 1 < 2 || b - a + 1 > 6) return null;
        const l = yy * W + a - 1, r = yy * W + b + 1, lv = input.level(yy * W + mid);
        if (!input.free(l) || !input.free(r) || input.level(l) !== lv || input.level(r) !== lv) return null;
        if (hi >= 0 && (a !== lo || b !== hi)) return null;                    // 두 줄의 폭이 같아야 한다(다르면 널판이 T자로 놓였다)
        for (let x = a; x <= b; x += 1) cells.push(yy * W + x);
        lo = Math.min(lo, a); hi = Math.max(hi, b);
      }
      for (let yy = y - 6; yy <= y + 7; yy += 1) for (let x = lo - 1; x <= hi + 1; x += 1) if (yy >= 0 && yy < H && input.crossing(yy * W + x)) return null;
      // 두 칸 폭 강은 한 줄만 놓는다 — 2×2 널판은 시공기의 «널다리 끝 잇기» 가 남북 다리로 읽어 강을 따라 길게 늘였다(가로가 세로보다 길어야 동서 다리다)
      return hi - lo + 1 <= 2 ? cells.slice(0, hi - lo + 1) : cells;
    };
    // 강이 윗단을 둘로 가르는데 길(경사로)은 한쪽으로만 오르므로, 폭포 위 다리가 없으면 건너편 윗단이 못 가는 땅으로 남는다. 아랫단도 마찬가지다.
    // 그래서 위·아래를 따로 본다: 위(윗단)에 하나, 아래(용소 밑)에 하나 — 길이 이미 그 곁에서 건너는 쪽은 놓지 않는다.
    for (const cells of [rowsAt(f.y - 4) ?? rowsAt(f.y - 5) ?? rowsAt(f.y - 6), rowsAt(f.y + 3) ?? rowsAt(f.y + 4) ?? rowsAt(f.y + 5) ?? rowsAt(f.y + 6)]) {
      if (cells && !cells.some((c) => taken.has(c))) { out.push(...cells); for (const c of cells) for (let dy = -3; dy <= 3; dy += 1) taken.add(c + dy * W); }   // 이웃 폭포의 다리와 세 줄은 띄운다
    }
  }
  return out;
}
