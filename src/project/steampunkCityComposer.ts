// project/steampunkCityComposer.ts
// 스팀펑크 도시(steampunk_city) 구성기 — 용도(거리 street | 공장·역 industrial | 운하 부두 dock | 실내 여섯 가지)·씨앗·맵 크기만 주면 매번 다른 한 장을 짠다.
//
// 왜: 사용자는 옛 시안의 «그림»뿐 아니라 «물건 배치»를 싫어했다(띠 통째 칠한 바닥, 아무 데나 흩은 소품, 막힌 문). 그래서 배치는 모델이 아니라 이 함수가 한다.
//   순서는 계획(구역 줄) → 블록(건물·선로·운하·광장) → 소품(규칙·여백) 이다. 조수는 용도·씨앗·건물만 고른다.
// 조화 규칙(jp_city·캠퍼스 적대 검수 교훈을 그대로 따른다):
//   - 빈 땅마다 쓰임이 있다: 석탄 마당·시장·측선·철 울타리 쌈지 공원·공방 마당·하역장·비행선 정박장. 띠 전체를 한 재질로 덮지 않는다 — 변주는 값 잡음 덩이.
//   - 소품은 자기 바닥 위에만(석탄은 석탄재 마당, 노점은 광장 포석, 벤치는 공원·승강장, 계선주는 둑) 놓는다. 발자국 + 여백을 예약하고 겹치지 않는다.
//   - 위층 칸은 한 칸에 하나뿐이다 — 키트끼리 위층이 겹치면 놓지 않는다(가스등 머리가 건물 앞면을 지우지 않게).
//   - 문 칸은 막힘, 바로 아래 접근칸과 그 아래 한 칸은 비운다. 소품 하나를 놓을 때마다 시작 칸 BFS 로 «이미 닿던 칸이 끊기지 않는지» 확인하고, 끊으면 되돌린다.
// 순수 함수다(프로젝트를 모른다). 칸 번호·통행은 호출자가 준 사전(palette)에서 얻는다 — 도구(steampunkCityTools.ts)는 번들 정의에서, QA 스크립트는 구운 JSON 에서.

export type SteampunkOutdoorStyle = "street" | "industrial" | "dock";
export type SteampunkRoomStyle = "boiler-room" | "engine-room" | "workshop" | "lab" | "inn" | "tavern";
export type SteampunkStyle = SteampunkOutdoorStyle | SteampunkRoomStyle;
export const STEAMPUNK_OUTDOOR_STYLES: readonly SteampunkOutdoorStyle[] = ["street", "industrial", "dock"];
export const STEAMPUNK_ROOM_STYLES: readonly SteampunkRoomStyle[] = ["boiler-room", "engine-room", "workshop", "lab", "inn", "tavern"];

export interface SteampunkKit {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly rows: readonly { readonly tiles: readonly number[]; readonly upperTiles?: readonly number[] }[];
  /** 출입구 부품(가로 문 칸) — 없으면 문 없는 소품. */
  readonly door?: { readonly dx: number; readonly w: number };
}

export interface SteampunkPalette {
  /** 한 칸 바닥 조각 이름(cobble, water …) → 칸 번호(애니메이션이면 첫 프레임). 없으면 -1. */
  tile(piece: string): number;
  /** 키트(sp-…) — 없으면 undefined(관문 미통과로 빠진 판). */
  kit(id: string): SteampunkKit | undefined;
  /** 칸이 걸을 수 있는가(번들 통행 표). */
  pass(tile: number): boolean;
}

export interface SteampunkCell { readonly x: number; readonly y: number }
export interface SteampunkBuilding { readonly name: string; readonly kit: string; readonly rect: { x: number; y: number; w: number; h: number }; readonly doors: SteampunkCell[]; readonly access: SteampunkCell[] }

export interface SteampunkSpec {
  readonly width: number;
  readonly height: number;
  readonly style: SteampunkStyle;
  readonly seed?: number;
  /** 북쪽 건물 줄을 바꾼다(키트 끝말, 예 inn·tavern·shop-gears). 비우면 씨앗이 고른다. 실내에는 쓰지 않는다. */
  readonly buildings?: readonly string[];
}

export interface SteampunkResult {
  readonly lower: number[];
  readonly upper: number[];
  readonly buildings: SteampunkBuilding[];
  readonly start: SteampunkCell;
  /** 맵 출입구(야외: 남쪽 가장자리 걸음 칸 / 실내: 맨 아래 줄 출입구 틈). */
  readonly exits: SteampunkCell[];
  readonly props: { kit: string; x: number; y: number }[];
  /** 구역(이름·용도·사각형) — 도구가 맵 장소로 남긴다. */
  readonly zones: { name: string; use: string; rect: { x: number; y: number; w: number; h: number } }[];
  readonly notes: string[];
}

/** 최소 크기. */
export const STEAMPUNK_MIN_SIZE: Readonly<Record<SteampunkStyle, { w: number; h: number }>> = {
  street: { w: 44, h: 34 }, industrial: { w: 48, h: 40 }, dock: { w: 46, h: 34 },
  "boiler-room": { w: 14, h: 11 }, "engine-room": { w: 16, h: 12 }, workshop: { w: 15, h: 11 }, lab: { w: 14, h: 11 }, inn: { w: 16, h: 12 }, tavern: { w: 16, h: 12 },
};

const BUILDING_NAME: Readonly<Record<string, string>> = {
  "sp-row-3": "연립주택", "sp-row-4": "연립주택", "sp-row-flush-3": "연립주택", "sp-row-soot-3": "노동자 주택", "sp-row-soot-4": "노동자 주택",
  "sp-shop-gears": "부품 가게", "sp-shop-apoth": "약방", "sp-shop-bakery": "빵집", "sp-inn": "여관", "sp-tavern": "선술집",
  "sp-factory": "공장", "sp-boiler-house": "보일러실", "sp-warehouse": "창고", "sp-station": "기차역", "sp-clock-tower": "시계탑",
  "sp-guild-hall": "조합 회관", "sp-workshop": "기계 공방", "sp-lab": "연구소", "sp-pump-house": "펌프장", "sp-dock-warehouse": "부두 창고",
};

function mulberry(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash2(x: number, y: number, s: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x: number, y: number, g: number, s: number): number {
  const gx = Math.floor(x / g), gy = Math.floor(y / g), fx = (x % g) / g, fy = (y % g) / g;
  const a = hash2(gx, gy, s), b = hash2(gx + 1, gy, s), c = hash2(gx, gy + 1, s), d = hash2(gx + 1, gy + 1, s);
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}
function pick<T>(rng: () => number, xs: readonly T[]): T { return xs[Math.floor(rng() * xs.length)]!; }
function shuffle<T>(rng: () => number, xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

/** 칸 용도 — 소품은 자기 용도 바닥에만 놓는다. */
type Use = "lane" | "walk" | "road" | "plaza" | "yard" | "park" | "rail" | "water" | "quay" | "deck" | "platform" | "pipe" | "bld" | "prop" | "fence" | "floor" | "wall" | "ceil";
interface Rect { x: number; y: number; w: number; h: number }

class Board {
  readonly lower: number[];
  readonly upper: number[];
  readonly use: Use[];
  readonly reserved: boolean[];
  readonly buildings: SteampunkBuilding[] = [];
  readonly props: { kit: string; x: number; y: number }[] = [];
  readonly zones: SteampunkResult["zones"] = [];
  readonly notes: string[] = [];
  /** 소품 단계 BFS 기준 칸(시작 칸). null 이면 연결 검사를 하지 않는다(구조 단계). */
  start: SteampunkCell | null = null;
  constructor(readonly W: number, readonly H: number, readonly pal: SteampunkPalette, ground: number, groundUse: Use) {
    this.lower = new Array(W * H).fill(ground);
    this.upper = new Array(W * H).fill(-1);
    this.use = new Array(W * H).fill(groundUse);
    this.reserved = new Array(W * H).fill(false);
  }
  in(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
  t(piece: string): number {
    const id = this.pal.tile(piece);
    if (id < 0) throw new Error(`스팀펑크 칩셋에 바닥 조각 ${piece} 이 없다`);
    return id;
  }
  has(kitId: string): boolean { return !!this.pal.kit(kitId); }
  walk(x: number, y: number): boolean {
    if (!this.in(x, y)) return false;
    const k = y * this.W + x, lo = this.lower[k]!, up = this.upper[k]!;
    return this.pal.pass(lo) && (up < 0 || this.pal.pass(up));
  }
  /** 바닥 칠: 건물·소품·담 칸은 건너뛴다. */
  fill(piece: string, r: Rect, use: Use): void {
    const id = this.t(piece);
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      if (!this.in(x, y)) continue;
      const k = y * this.W + x;
      if (this.use[k] === "bld" || this.use[k] === "prop" || this.use[k] === "fence") continue;
      this.lower[k] = id; this.use[k] = use;
    }
  }
  set(piece: string, x: number, y: number, use: Use, layer: "lower" | "upper" = "lower"): void {
    if (!this.in(x, y)) return;
    const k = y * this.W + x;
    if (layer === "lower") this.lower[k] = this.t(piece); else this.upper[k] = this.t(piece);
    this.use[k] = use;
  }
  zone(name: string, use: string, r: Rect): void { this.zones.push({ name, use, rect: { ...r } }); }
  /** topAllow 가 있으면 맨 윗줄은 그 용도(벽면 아랫줄에 등을 대는 키 큰 가구)여야 한다. */
  free(r: Rect, margin: number, allow: readonly Use[], topAllow?: readonly Use[]): boolean {
    for (let y = r.y - margin; y < r.y + r.h + margin; y++) for (let x = r.x - margin; x < r.x + r.w + margin; x++) {
      const inside = x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
      if (!this.in(x, y)) { if (inside) return false; continue; }
      const k = y * this.W + x;
      if (inside) { if (!(topAllow && y === r.y ? topAllow : allow).includes(this.use[k]!) || this.reserved[k] || this.upper[k]! >= 0) return false; }
      else if (this.use[k] === "bld" || this.use[k] === "prop" || this.reserved[k]) return false;
    }
    return true;
  }
  reserve(r: Rect): void {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (this.in(x, y)) this.reserved[y * this.W + x] = true;
  }
  kitSize(id: string): { w: number; h: number } {
    const k = this.pal.kit(id);
    if (!k) throw new Error(`스팀펑크 칩셋에 키트 ${id} 가 없다`);
    return { w: k.width, h: k.height };
  }
  stamp(kitId: string, x: number, y: number, use: Use): SteampunkKit {
    const kit = this.pal.kit(kitId);
    if (!kit) throw new Error(`스팀펑크 칩셋에 키트 ${kitId} 가 없다`);
    kit.rows.forEach((row, r) => {
      for (let c = 0; c < kit.width; c++) {
        const X = x + c, Y = y + r;
        if (!this.in(X, Y)) continue;
        const k = Y * this.W + X, lo = row.tiles[c] ?? -1, up = row.upperTiles?.[c] ?? -1;
        if (lo < 0 && up < 0) continue;
        if (lo >= 0) this.lower[k] = lo;
        if (up >= 0) this.upper[k] = up;
        // 소품의 별 칸(뒤로 지나가는 윗줄)은 바닥 용도를 그대로 둔다 — 막힌 칸·아래층 조각 칸만 «prop»
        if (use !== "prop" || lo >= 0 || !this.pal.pass(up)) this.use[k] = use;
      }
    });
    return kit;
  }
  private reach(): Set<number> {
    const s = this.start;
    const seen = new Set<number>();
    if (!s || !this.walk(s.x, s.y)) return seen;
    seen.add(s.y * this.W + s.x);
    const q: number[] = [s.y * this.W + s.x];
    while (q.length) {
      const k = q.pop()!, x = k % this.W, y = (k - x) / this.W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy, nk = ny * this.W + nx;
        if (!this.in(nx, ny) || seen.has(nk) || !this.walk(nx, ny)) continue;
        seen.add(nk); q.push(nk);
      }
    }
    return seen;
  }
  /**
   * 소품 하나: 발자국(+여백)이 비었고, 바닥 용도가 allow 안이고, 위층이 겹치지 않을 때만.
   * 시작 칸이 정해진 뒤(소품 단계)에는 놓은 뒤 BFS 로 «이미 닿던 칸 중 아직 걸을 수 있는 칸이 끊기지 않았는지» 보고, 끊으면 되돌린다.
   */
  prop(kitId: string, x: number, y: number, margin: number, allow: readonly Use[], topAllow?: readonly Use[]): boolean {
    const kit = this.pal.kit(kitId);
    if (!kit) return false;
    const r = { x, y, w: kit.width, h: kit.height };
    if (!this.free(r, margin, allow, topAllow)) return false;
    const before = this.start ? this.reach() : null;
    const saved: [number, number, number, Use][] = [];
    for (let yy = y; yy < y + kit.height; yy++) for (let xx = x; xx < x + kit.width; xx++) {
      if (!this.in(xx, yy)) continue;
      const k = yy * this.W + xx; saved.push([k, this.lower[k]!, this.upper[k]!, this.use[k]!]);
    }
    this.stamp(kitId, x, y, "prop");
    if (before) {
      const after = this.reach();
      let cut = false;
      for (const k of before) { if (!after.has(k) && this.walk(k % this.W, Math.floor(k / this.W))) { cut = true; break; } }
      if (cut) { for (const [k, lo, up, u] of saved) { this.lower[k] = lo; this.upper[k] = up; this.use[k] = u; } return false; }
    }
    this.props.push({ kit: kitId, x, y });
    return true;
  }
  /** 같은 소품을 범위 안 여러 자리에 시도해 하나를 놓는다. */
  propNear(kitId: string, spots: readonly [number, number][], margin: number, allow: readonly Use[]): boolean {
    for (const [x, y] of spots) if (this.prop(kitId, x, y, margin, allow)) return true;
    return false;
  }
  building(kitId: string, x: number, y: number): SteampunkBuilding {
    const kit = this.stamp(kitId, x, y, "bld");
    const d = kit.door ?? { dx: Math.floor(kit.width / 2) - 1, w: 2 };
    const doors = Array.from({ length: d.w }, (_, i) => ({ x: x + d.dx + i, y: y + kit.height - 1 }));
    const access = doors.map((c) => ({ x: c.x, y: c.y + 1 }));
    for (const a of access) this.reserve({ x: a.x, y: a.y, w: 1, h: 2 });
    const b = { name: BUILDING_NAME[kitId] ?? kitId, kit: kitId, rect: { x, y, w: kit.width, h: kit.height }, doors, access };
    this.buildings.push(b);
    return b;
  }
  /** 바닥 변주: 큰 덩이 값 잡음으로만(띠 통째·자잘한 점 금지). */
  variety(seed: number): void {
    // 판석 배수 홈(flag-b)은 덩이로 섞으면 점 네 개 상자가 줄지어 보인다(자체 검수) — 아래에서 드문 낱칸으로만 섞는다.
    const swaps: [string, string, number, number][] = [["cobble", "cobble-b", 0.66, 6], ["cinder", "cinder-b", 0.62, 6]];
    for (const [base, alt, cut, g] of swaps) {
      const a = this.pal.tile(base), b = this.pal.tile(alt);
      if (a < 0 || b < 0) continue;
      for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
        const k = y * this.W + x;
        if (this.lower[k] !== a) continue;
        const n = vnoise(x + 300, y + 300, g, seed + base.length) * 0.8 + vnoise(x + 300, y + 300, 2, seed + 9) * 0.2;
        if (n > cut) this.lower[k] = b;
      }
    }
    const fl = this.pal.tile("flag"), flb = this.pal.tile("flag-b");
    if (fl >= 0 && flb >= 0) for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      const k = y * this.W + x;
      if (this.lower[k] === fl && hash2(x, y, seed + 77) < 0.025) this.lower[k] = flb;
    }
    // 기름 밴 자갈: 공장 앞·선로 곁 자갈에 드문 덩이
    const cob = this.pal.tile("cobble"), oil = this.pal.tile("cobble-oil");
    if (cob >= 0 && oil >= 0) for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      const k = y * this.W + x;
      if (this.lower[k] === cob && vnoise(x + 50, y + 50, 4, seed + 31) > 0.8 && hash2(x, y, seed) < 0.7) this.lower[k] = oil;
    }
  }
}

function kitIdOf(name: string): string { return name.startsWith("sp-") ? name : `sp-${name}`; }

/** 가스 가로등: 보도 바깥 줄(y)을 따라 step 칸마다 — 문 접근칸·위층이 겹치면 옆 칸으로 한 칸 민다. */
function lampsAlong(b: Board, x0: number, x1: number, footY: number, step: number, allow: readonly Use[], kit = "sp-gas-lamp"): number {
  let n = 0;
  const h = b.has(kit) ? b.kitSize(kit).h : 3;
  for (let x = x0; x <= x1; x += step) {
    if (b.propNear(kit, [[x, footY - h + 1], [x + 1, footY - h + 1], [x - 1, footY - h + 1]], 0, allow)) n++;
  }
  return n;
}

/** 철 울타리 쌈지 공원: 사각형 둘레 철 울타리(동서 fence, 남북 fence-v), 북쪽 가운데 출입구 2칸, 안은 풀 + 플라타너스 + 벤치 + 화분. */
function pocketPark(b: Board, rng: () => number, r: Rect, gateSide: "n" | "s" = "n"): void {
  b.fill("grass", { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 }, "park");
  b.zone("쌈지 공원", "철 울타리 공원", r);
  const gx = r.x + Math.floor(r.w / 2) - 1;
  const gy = gateSide === "n" ? r.y : r.y + r.h - 1;
  for (let x = r.x; x < r.x + r.w; x++) {
    for (const y of [r.y, r.y + r.h - 1]) {
      if (y === gy && (x === gx || x === gx + 1)) { b.fill("flag", { x, y, w: 1, h: 1 }, "walk"); continue; }
      if (b.has("sp-fence")) b.stamp("sp-fence", x, y, "fence");
    }
  }
  for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (const x of [r.x, r.x + r.w - 1]) if (b.has("sp-fence-v")) b.stamp("sp-fence-v", x, y, "fence");
  // 출입구 안쪽 한 칸은 비운다
  b.reserve({ x: gx, y: gateSide === "n" ? r.y + 1 : r.y + r.h - 2, w: 2, h: 1 });
  const ix0 = r.x + 1, ix1 = r.x + r.w - 2, iy0 = r.y + 1, iy1 = r.y + r.h - 2;
  // 나무: 안쪽 북서·남동(또는 반대) 모퉁이에 — 출입구에서 비켜
  const left = rng() < 0.5;
  b.propNear("sp-plane-tree", [[left ? ix0 : ix1 - 1, iy0], [left ? ix0 + 1 : ix1 - 2, iy0]], 0, ["park"]);
  if (r.w >= 10) b.propNear("sp-plane-tree", [[left ? ix1 - 1 : ix0, iy1 - 2], [left ? ix1 - 2 : ix0 + 1, iy1 - 2]], 0, ["park"]);
  // 가운데 분수 또는 벤치 둘
  const cx = r.x + Math.floor(r.w / 2);
  if (r.w >= 9 && r.h >= 7 && rng() < 0.5) b.prop("sp-fountain", cx - 1, Math.floor((iy0 + iy1) / 2), 1, ["park"]);
  b.propNear("sp-bench", [[cx - 1, iy1], [cx - 3, iy1], [cx + 1, iy1]], 0, ["park"]);
  b.propNear("sp-bench", [[left ? ix1 - 1 : ix0, Math.floor((iy0 + iy1) / 2)], [left ? ix1 - 1 : ix0, iy1 - 1]], 0, ["park"]);
  b.propNear("sp-planter", [[left ? ix1 : ix0, iy0], [left ? ix1 : ix0, iy1]], 0, ["park"]);
}

// ───────────────────────── 북쪽 건물 줄 공통 ─────────────────────────
interface RowPlan { ids: string[]; gaps: number[] }
/** 왼쪽부터 건물을 밑변(baseY)에 맞춰 세운다. gap 0 은 어깨를 붙인 연립, 1~2 칸 틈은 골목(바닥 piece). */
function buildingRow(b: Board, plan: RowPlan, x0: number, baseY: number): SteampunkBuilding[] {
  const out: SteampunkBuilding[] = [];
  let x = x0;
  plan.ids.forEach((id, i) => {
    const sz = b.kitSize(id);
    out.push(b.building(id, x, baseY - sz.h + 1));
    x += sz.w + (plan.gaps[i] ?? 0);
  });
  return out;
}
function rowWidth(b: Board, plan: RowPlan): number { return plan.ids.reduce((s, id, i) => s + b.kitSize(id).w + (i < plan.ids.length - 1 ? plan.gaps[i] ?? 0 : 0), 0); }
/** 폭 W 안에 들어가게 뒤에서부터 뺀다. */
function fitRow(b: Board, plan: RowPlan, W: number): RowPlan {
  const p = { ids: [...plan.ids], gaps: [...plan.gaps] };
  while (p.ids.length > 1 && rowWidth(b, p) > W) { p.ids.pop(); p.gaps.pop(); }
  return p;
}
/** 남는 폭을 양끝 연립 주택으로 메운다 — 가운데 정렬로 생긴 양옆 빈 석탄재 공터(QA S1·D2). 앞·뒤 번갈아 골목 2칸을 두고 붙인다. */
function padRow(b: Board, rng: () => number, plan: RowPlan, W: number, fillers: readonly string[]): RowPlan {
  let p = { ids: [...plan.ids], gaps: [...plan.gaps.slice(0, Math.max(0, plan.ids.length - 1))] };
  const fs = fillers.map(kitIdOf).filter((id) => b.has(id));
  if (!fs.length) return plan;
  for (let i = 0, front = rng() < 0.5; i < 8; i++, front = !front) {
    const id = pick(rng, fs);
    const tryP = front ? { ids: [id, ...p.ids], gaps: [2, ...p.gaps] } : { ids: [...p.ids, id], gaps: [...p.gaps, 2] };
    if (rowWidth(b, tryP) <= W - 2) p = tryP;
  }
  return p;
}
/** 묶음 소품: 사각형 가운데에서 가까운 빈 자리부터 하나씩(흩뿌리지 않고 한 덩이로). */
function cluster(b: Board, r: Rect, kits: readonly string[], allow: readonly Use[], margin = 0): number {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2; let n = 0;
  for (const kit of kits) {
    if (!b.has(kit)) continue;
    const s = b.kitSize(kit), spots: [number, number][] = [];
    for (let y = r.y; y + s.h <= r.y + r.h; y++) for (let x = r.x; x + s.w <= r.x + r.w; x++) spots.push([x, y]);
    spots.sort((a, c) => Math.hypot(a[0] + s.w / 2 - cx, a[1] + s.h / 2 - cy) - Math.hypot(c[0] + s.w / 2 - cx, c[1] + s.h / 2 - cy));
    if (b.propNear(kit, spots, margin, allow)) n++;
  }
  return n;
}
/** 건물 줄 위(뒷마당) 빈 칸: 키 낮은 건물 위에 생긴 2줄 이상 틈에 뒷마당 소품 하나(통·상자·석탄). */
function backyards(b: Board, rng: () => number, blds: readonly SteampunkBuilding[]): void {
  // 건물 사이 골목 안쪽(건물 벽에 붙여)에만 통·상자 하나 — 지붕 위 빈 땅에 두면 «지붕 위 상자»로 읽혔다(자체 검수).
  for (let i = 0; i < blds.length - 1; i++) {
    const a = blds[i]!, c = blds[i + 1]!, gx = a.rect.x + a.rect.w, gw = c.rect.x - gx;
    if (gw < 2) continue;
    const kit = pick(rng, ["sp-barrel", "sp-barrel", "sp-crate-in"]);
    if (!b.has(kit)) continue;
    const sz = b.kitSize(kit), bottom = Math.min(a.rect.y + a.rect.h, c.rect.y + c.rect.h) - 2;
    b.propNear(kit, [[gx, bottom - sz.h + 1], [gx + gw - sz.w, bottom - sz.h + 1]], 0, ["lane", "yard"]);
  }
}

// ───────────────────────── 거리 ─────────────────────────
function composeStreet(b: Board, rng: () => number, want: readonly string[]): SteampunkCell {
  const { W, H } = b;
  // ① 북쪽 건물 줄: 연립 한 덩이(어깨 붙임) · 골목 · 가게 둘 · 골목 · 여관/조합 회관 · 골목 · 선술집
  const terrace = pick(rng, [["row-3", "row-flush-3", "row-4"], ["row-4", "row-flush-3", "row-3"], ["row-3", "row-4"]]);
  const shops = shuffle(rng, ["shop-gears", "shop-apoth", "shop-bakery"]).slice(0, 2);
  const big = pick(rng, ["inn", "guild-hall"]);
  let ids = want.length ? want.map(kitIdOf) : [...terrace, ...shops, big, "tavern"].map(kitIdOf);
  ids = ids.filter((id) => b.has(id));
  const gaps = want.length ? ids.map(() => 2) : ids.map((_, i) => i < terrace.length - 1 ? 0 : 2);
  let plan = fitRow(b, { ids, gaps }, W - 2);
  if (rowWidth(b, plan) < W - 14 && b.has("sp-clock-tower") && !plan.ids.includes("sp-clock-tower")) plan = { ids: [...plan.ids, "sp-clock-tower"], gaps: [...plan.gaps.slice(0, plan.ids.length - 1), 2, 0] };
  plan = fitRow(b, plan, W - 2);
  if (!want.length) plan = padRow(b, rng, plan, W, ["row-3", "row-4", "row-soot-3"]);
  const maxH = Math.max(...plan.ids.map((id) => b.kitSize(id).h));
  const baseY = maxH;                                     // 맨 윗줄(0)은 뒷골목
  const left = Math.max(1, Math.floor((W - rowWidth(b, plan)) / 2));
  b.fill("cinder", { x: 0, y: 0, w: W, h: baseY + 1 }, "lane");
  b.zone("뒷골목·뒷마당", "건물 뒤 석탄재 마당", { x: 0, y: 0, w: W, h: baseY });
  const blds = buildingRow(b, plan, left, baseY);
  // 골목: 건물 사이 틈을 자갈로(보도 → 뒷골목)
  for (let i = 0; i < blds.length - 1; i++) {
    const a = blds[i]!, c = blds[i + 1]!, gx = a.rect.x + a.rect.w, gw = c.rect.x - gx;
    if (gw > 0) b.fill("cobble", { x: gx, y: 0, w: gw, h: baseY + 1 }, "lane");
  }
  // ② 북쪽 보도 3줄 + 연석 · 차도 5줄(둘째·셋째 줄 노면 궤도) · 연석 · 남쪽 보도 — 6줄 차도는 빈 검은 띠였다(QA S2)
  const sw0 = baseY + 1;
  b.fill("flag", { x: 0, y: sw0, w: W, h: 3 }, "walk");
  b.fill("curb-s", { x: 0, y: sw0 + 3, w: W, h: 1 }, "walk");
  const r0 = sw0 + 4, RH = 5;
  b.fill("cobble", { x: 0, y: r0, w: W, h: RH }, "road");
  b.fill("tram-n", { x: 0, y: r0 + 1, w: W, h: 1 }, "road");
  b.fill("tram-s", { x: 0, y: r0 + 2, w: W, h: 1 }, "road");
  b.zone("큰길", "자갈 차도 + 노면 궤도", { x: 0, y: r0, w: W, h: RH });
  b.fill("curb-n", { x: 0, y: r0 + RH, w: W, h: 1 }, "walk");
  const sw1 = r0 + RH + 1;
  b.fill("flag", { x: 0, y: sw1, w: W, h: H - sw1 }, "walk");
  // ③ 남쪽: 판석 보도 위에 벽돌 시장 광장(판석 테 1칸 안쪽) + 쌈지 공원 — 벽돌 바닥은 광장에만
  const p0 = sw1 + 1, p1 = H - 2;
  const parkW = Math.min(12, Math.max(9, Math.floor(W / 4)));
  const parkEast = rng() < 0.5;
  const park: Rect = { x: parkEast ? W - parkW - 1 : 1, y: p0 + 1, w: parkW, h: Math.min(9, p1 - p0) };
  const mx0 = parkEast ? 1 : park.x + park.w + 1, mx1 = parkEast ? park.x - 2 : W - 2;
  b.fill("brickpave", { x: mx0 + 1, y: p0 + 1, w: mx1 - mx0 - 1, h: p1 - p0 }, "plaza");
  b.zone("시장 광장", "노점·기념비 광장", { x: mx0, y: p0, w: mx1 - mx0 + 1, h: p1 - p0 + 1 });
  const start = { x: Math.floor((mx0 + mx1) / 2), y: H - 1 };
  // 판석 건널목 두 곳: 광장 가운데 열 · 공원 출입구 열(궤도 두 줄은 그대로 지나간다). 전차 자리는 비켜 둔다.
  const tramX = Math.max(1, Math.min(W - 6, Math.floor(W * (0.25 + rng() * 0.5))));
  const crossXs = [start.x - 1, park.x + Math.floor(park.w / 2) - 1].filter((x) => x + 1 < tramX - 1 || x > tramX + 4);
  for (const x of crossXs) for (const y of [r0, r0 + 3, r0 + 4]) b.fill("flag", { x, y, w: 2, h: 1 }, "walk");
  for (const x of crossXs) b.zone("건널목", "판석 건널목", { x, y: r0, w: 2, h: RH });
  b.start = start;
  // ── 소품(이제부터 BFS 연결 검사) ──
  pocketPark(b, rng, park, "n");
  // 광장 가운데: 톱니 기념비(또는 분수) + 네 모퉁이 광장 가스등 + 벤치 둘
  const cx = Math.floor((mx0 + mx1) / 2) + Math.floor(rng() * 3) - 1, cy = p0 + Math.floor((p1 - p0) / 2) + 1;
  const mono = rng() < 0.6 && b.has("sp-gear-monument") ? "sp-gear-monument" : "sp-fountain";
  const ms = b.kitSize(mono);
  const mx = cx - Math.floor(ms.w / 2), my = cy - ms.h + 1;
  if (b.prop(mono, mx, my, 1, ["plaza"])) {
    // 광장 가스등은 대각 두 모퉁이에만(네 개를 붙이면 기둥 숲처럼 보였다 — 자체 검수)
    for (const [lx, ly] of [[mx - 2, my - 2], [mx + ms.w + 1, my + ms.h - 1]] as const) b.prop("sp-plaza-lamp", lx, ly, 0, ["plaza"]);
    b.propNear("sp-bench", [[mx, my + ms.h + 1], [mx - 1, my + ms.h + 1]], 0, ["plaza"]);
    b.propNear("sp-bench", [[mx + ms.w - 2, my - 2], [mx + ms.w - 1, my - 2]], 0, ["plaza"]);
  }
  // 노점 줄: 광장 북쪽(남쪽 보도 바로 밑)에 2~3개, 노점 사이 1칸, 앞 2칸 손님 자리
  const stalls = shuffle(rng, ["sp-stall-fruit", "sp-stall-parts", "sp-stall-fish"]);
  const stallSide = mx > (mx0 + mx1) / 2 ? "w" : "e";
  let sx = stallSide === "w" ? mx0 + 2 : mx1 - 4;
  for (const st of stalls) {
    if (b.prop(st, sx, p0 + 1, 0, ["plaza"])) b.reserve({ x: sx, y: p0 + 4, w: 3, h: 2 });
    sx += stallSide === "w" ? 4 : -4;
  }
  // 노점 무리 끝 한 곳에만 상자·통·손수레 묶음(노점마다 같은 자리에 하나씩 찍으면 일렬로 줄 섰다 — QA S3)
  const endX = stallSide === "w" ? sx : sx + 1;
  cluster(b, { x: endX - 1, y: p0 + 1, w: 4, h: 4 }, ["sp-crates", "sp-barrel", "sp-handcart"], ["plaza"]);
  // 광장 모퉁이: 가판대·광고탑·시계 기둥
  b.propNear("sp-kiosk", [[mx1 - 2, p1 - 2], [mx0 + 1, p1 - 2]], 1, ["plaza"]);
  b.propNear("sp-poster-column", [[mx0 + 1, p1 - 3], [mx1 - 1, p1 - 3]], 1, ["plaza"]);
  b.propNear("sp-clock-post", [[stallSide === "w" ? mx1 - 1 : mx0 + 1, p0 + 1]], 1, ["plaza"]);
  // ④ 거리 소품: 북쪽 보도 바깥 줄 가스등 6칸 간격, 우체통·소화전, 증기 구멍, 전차 정류장 + 전차
  lampsAlong(b, 2, W - 2, sw0 + 2, 6, ["walk"]);
  b.propNear("sp-tram-shelter", [[tramX, sw0 + 1], [tramX + 2, sw0 + 1], [tramX - 3, sw0 + 1]], 0, ["walk"]);
  b.prop("sp-steam-tram", tramX, r0, 0, ["road"]);
  b.propNear("sp-pillar-box", [[tramX + 5, sw0 + 1], [tramX + 7, sw0 + 1], [tramX - 4, sw0 + 1]], 0, ["walk"]);
  b.propNear("sp-hydrant", [[1, sw0 + 2], [W - 2, sw0 + 2]], 0, ["walk"]);
  for (const vx of [Math.floor(W * 0.2), Math.floor(W * 0.7)]) b.propNear("sp-steam-vent", [[vx, sw0 + 1], [vx + 1, sw0 + 1], [vx + 2, sw0 + 1]], 0, ["walk"]);
  // 가게 문 양옆 화분 한 쌍(문 칸·접근칸은 비운다), 선술집 문 옆 통
  for (const bd of blds) {
    const a = bd.access[0]!, z = bd.access[bd.access.length - 1]!;
    if (/shop|inn|guild/.test(bd.kit)) { b.prop("sp-planter", a.x - 1, a.y, 0, ["walk"]); b.prop("sp-planter", z.x + 1, z.y, 0, ["walk"]); }
    else if (/tavern/.test(bd.kit)) { b.propNear("sp-barrels", [[z.x + 1, a.y], [a.x - 2, a.y]], 0, ["walk"]); }
  }
  // 남쪽 보도(차도 쪽 줄) 가로수 — 북쪽 가스등과 엇갈리게 8칸 간격
  for (let x = 3; x < W - 3; x += 8) b.propNear("sp-plane-tree", [[x, sw1 - 1], [x + 1, sw1 - 1]], 0, ["walk"]);
  backyards(b, rng, blds);
  return start;
}

// ───────────────────────── 공장 지대 + 철도역 ─────────────────────────
function pipePiece(n: boolean, e: boolean, s: boolean, w: boolean): string {
  const key = `${n ? "n" : ""}${e ? "e" : ""}${s ? "s" : ""}${w ? "w" : ""}`;
  const map: Record<string, string> = { ew: "pipe-ew", ns: "pipe-ns", ne: "pipe-ne", nw: "pipe-nw", es: "pipe-se", sw: "pipe-sw", new: "pipe-new", esw: "pipe-sew", nes: "pipe-nes", nsw: "pipe-nsw", e: "pipe-e", w: "pipe-w", n: "pipe-n", s: "pipe-s", nesw: "pipe-nes" };
  return map[key] ?? "pipe-ew";
}
/** 배관 도랑: cells(칸 집합) + into(북쪽 건물 벽으로 들어가는 칸). 이웃으로 모양을 고르고, crossing 칸은 덮개(걷는다). */
function pipes(b: Board, cells: readonly SteampunkCell[], into: ReadonlySet<string>, crossing: ReadonlySet<string>): void {
  const has = new Set(cells.map((c) => `${c.x},${c.y}`));
  for (const c of cells) {
    const n = has.has(`${c.x},${c.y - 1}`) || into.has(`${c.x},${c.y}`), s = has.has(`${c.x},${c.y + 1}`), e = has.has(`${c.x + 1},${c.y}`), w = has.has(`${c.x - 1},${c.y}`);
    let piece = pipePiece(n, e, s, w);
    if (crossing.has(`${c.x},${c.y}`)) piece = (e || w) && !(n || s) ? "pipe-grate-ew" : (n || s) && !(e || w) ? "pipe-grate-ns" : piece;
    if (b.pal.tile(piece) < 0) continue;
    b.set(piece, c.x, c.y, crossing.has(`${c.x},${c.y}`) ? "yard" : "pipe");
  }
}

function composeIndustrial(b: Board, rng: () => number, want: readonly string[]): SteampunkCell {
  const { W, H } = b;
  // ① 공장 줄(북쪽): 공장 · 보일러실 · (창고|공방) — 공장과 보일러실 사이 2칸 틈에 독립 굴뚝
  const third = pick(rng, ["warehouse", "workshop"]);
  let ids = (want.length ? want : (rng() < 0.5 ? ["factory", "boiler-house", third] : [third, "boiler-house", "factory"])).map(kitIdOf).filter((id) => b.has(id));
  let plan = fitRow(b, { ids, gaps: ids.map(() => 2) }, W - (b.has("sp-gasometer") ? 7 : 2));
  ids = plan.ids;
  // 남는 폭(가스 저장탑 자리 7칸 제외)은 노동자 주택 줄로 메운다 — 빈 석탄재 마당이 넓게 남았다(자체 검수)
  for (const extra of ["row-soot-4", "row-soot-3", "row-soot-3"].map(kitIdOf)) {
    if (!b.has(extra)) continue;
    const tryPlan = { ids: [...plan.ids, extra], gaps: [...plan.gaps.slice(0, plan.ids.length - 1), 2, 0] };
    if (rowWidth(b, tryPlan) <= W - 9) plan = tryPlan;
  }
  ids = plan.ids;
  const maxH = Math.max(...ids.map((id) => b.kitSize(id).h));
  const baseY = maxH;
  b.fill("cinder", { x: 0, y: 0, w: W, h: H }, "yard");
  const left = 1 + Math.floor(rng() * 2);
  const blds = buildingRow(b, plan, left, baseY);
  const rowEnd = blds.length ? blds[blds.length - 1]!.rect.x + blds[blds.length - 1]!.rect.w : left;
  // ② 공장 마당(7줄) · 철 울타리(출입구 3칸) · 자갈 길(3줄)
  const y0 = baseY + 1, fenceY = baseY + 8, road = fenceY + 1;
  b.zone("공장 마당", "석탄재 마당·석탄·배관", { x: 0, y: y0, w: W, h: 7 });
  const gateX = Math.max(2, Math.min(W - 5, Math.floor(W / 2) + Math.floor(rng() * 7) - 3));
  b.fill("cobble", { x: 0, y: road, w: W, h: 3 }, "road");
  b.zone("공장 앞길", "자갈 길", { x: 0, y: road, w: W, h: 3 });
  // ③ 역 앞 판석 광장 · 역 · 승강장 2줄 · 승강장 끝 · 본선 · 석탄재 · 측선 · 석탄재
  const st = b.has("sp-station") ? b.kitSize("sp-station") : { w: 8, h: 8 };
  const stY0 = road + 3, stBase = stY0 + st.h - 1;
  const pl0 = stBase + 1, edge = pl0 + 2, main = edge + 1, siding = main + 3;
  if (siding + 4 >= H) throw new Error(`맵이 낮다(${H}) — 공장 줄·역·선로 두 가닥이 들어가려면 ${siding + 3} 줄 이상이어야 한다`);
  const stX = Math.max(1, Math.min(W - st.w - 1, gateX - Math.floor(st.w / 2) + (rng() < 0.5 ? -6 : 6)));
  const platX0 = Math.max(0, stX - 6), platX1 = Math.min(W - 1, stX + st.w + 6);
  b.fill("flag", { x: 0, y: stY0, w: W, h: st.h }, "walk");
  b.zone("역 앞 광장", "판석 광장", { x: 0, y: stY0, w: W, h: st.h });
  b.fill("platform", { x: platX0, y: pl0, w: platX1 - platX0 + 1, h: 2 }, "platform");
  b.fill("platform-edge", { x: platX0, y: edge, w: platX1 - platX0 + 1, h: 1 }, "quay");
  b.zone("승강장", "승강장", { x: platX0, y: pl0, w: platX1 - platX0 + 1, h: 3 });
  b.fill("rail-n", { x: 0, y: main, w: W, h: 1 }, "rail"); b.fill("rail-s", { x: 0, y: main + 1, w: W, h: 1 }, "rail");
  b.fill("rail-n", { x: 0, y: siding, w: W, h: 1 }, "rail"); b.fill("rail-s", { x: 0, y: siding + 1, w: W, h: 1 }, "rail");
  b.zone("본선", "선로", { x: 0, y: main, w: W, h: 2 });
  b.zone("화물 측선", "측선·하역장", { x: 0, y: siding - 1, w: W, h: H - siding + 1 });
  const station = b.has("sp-station") ? b.building("sp-station", stX, stY0) : null;
  // 역 양옆: 측선 쪽 화물 창고 + 반대쪽 철도원 연립 — 판석 광장이 맵 폭 전체라 역 양옆이 넓게 비었다(QA F2). 광장은 역 앞으로 좁아진다.
  const sideRow = (x0: number, x1: number, kits: readonly string[], gap: number): void => {
    let x = x0;
    for (const id of kits.map(kitIdOf)) {
      if (!b.has(id)) continue;
      const s = b.kitSize(id);
      if (s.h > st.h || x + s.w - 1 > x1) continue;
      b.building(id, x, stBase - s.h + 1); x += s.w + gap;
    }
  };
  const towerRoom = 7;   // 급수탑 자리(승강장 서쪽 끝 밖)
  sideRow(stX + st.w + 4, W - 2, ["warehouse", "row-soot-3", "row-soot-3"], 2);
  sideRow(1, Math.max(0, platX0 - towerRoom), ["row-soot-3", "row-soot-3", "row-soot-3", "workshop"], 0);
  // 공장 마당 석탄재와 역 광장 사이 철 울타리
  for (let x = 0; x < W; x++) { if (x >= gateX && x < gateX + 3) continue; if (b.has("sp-fence")) b.stamp("sp-fence", x, fenceY, "fence"); }
  b.fill("cobble", { x: gateX, y: fenceY, w: 3, h: 1 }, "road");
  // 배관: 보일러실 → 공장(또는 옆 건물) — 앞 3줄째 E-W, 문 접근 열·출입구 열을 지나는 칸은 덮개
  const boiler = blds.find((d) => d.kit === "sp-boiler-house");
  const pipeY = y0 + 2;
  const crossing = new Set<string>();
  for (const d of blds) for (const a of d.access) crossing.add(`${a.x},${pipeY}`);
  for (let x = gateX; x < gateX + 3; x++) crossing.add(`${x},${pipeY}`);
  if (boiler) {
    const others = blds.filter((d) => d !== boiler && /factory|warehouse|workshop/.test(d.kit));   // 배관은 공장 건물로만(주택에는 들이지 않는다)
    const cells: SteampunkCell[] = []; const into = new Set<string>();
    const bx = boiler.rect.x + (boiler.doors[0]!.x - boiler.rect.x > 1 ? 1 : boiler.rect.w - 2);
    for (const o of others) {
      const ox = o.rect.x + (o.rect.x < boiler.rect.x ? o.rect.w - 2 : 1);
      if (blds.some((d) => d.access.some((a) => a.x === ox))) continue;
      for (const [x, top] of [[bx, true], [ox, true]] as const) { for (let y = y0; y < pipeY; y++) cells.push({ x, y }); if (top) into.add(`${x},${y0}`); }
      for (let x = Math.min(bx, ox); x <= Math.max(bx, ox); x++) cells.push({ x, y: pipeY });
    }
    // 배관이 지나는 북쪽 세로 토막이 문 접근칸을 막지 않게, 세로 토막은 접근 열을 피했다. 마당 출입구 쪽으로 증기 구멍 하나.
    const uniq = new Map(cells.map((c) => [`${c.x},${c.y}`, c] as const));
    pipes(b, [...uniq.values()], into, crossing);
    b.zone("배관 도랑", "보일러실 → 공장 증기 배관", { x: Math.min(...[...uniq.values()].map((c) => c.x)), y: y0, w: Math.max(1, Math.max(...[...uniq.values()].map((c) => c.x)) - Math.min(...[...uniq.values()].map((c) => c.x)) + 1), h: pipeY - y0 + 1 });
  }
  const start = { x: gateX + 1, y: road + 1 };
  b.start = start;
  // ── 소품 ──
  // 굴뚝 + 연기: 공장 줄 건물 사이 2칸 틈, 없으면 줄 끝
  const gapsX: number[] = [];
  for (let i = 0; i < blds.length - 1; i++) { const a = blds[i]!, c = blds[i + 1]!; if (c.rect.x - (a.rect.x + a.rect.w) >= 2) gapsX.push(a.rect.x + a.rect.w); }
  const chimneyX = gapsX.length ? gapsX[0]! : Math.min(W - 3, rowEnd + 1);
  if (b.has("sp-chimney")) {
    const ch = b.kitSize("sp-chimney");
    const cy = baseY - ch.h + 1;
    if (b.prop("sp-chimney", chimneyX, cy, 0, ["yard"]) && b.has("sp-stack-smoke")) {
      const sm = b.kitSize("sp-stack-smoke");
      // 연기 조각은 굴뚝 머리 칸 위에 겹쳐 찍는다(머리 칸 = 연기 왼쪽 아래 칸) — 굴뚝 머리 위층을 연기 그림으로 바꾼다.
      if (cy - sm.h + 1 >= 0) { b.stamp("sp-stack-smoke", chimneyX, cy - sm.h + 1, "prop"); b.props.push({ kit: "sp-stack-smoke", x: chimneyX, y: cy - sm.h + 1 }); }
    }
  }
  // 가스 저장탑: 줄 끝 뒤편
  if (b.has("sp-gasometer") && b.propNear("sp-gasometer", [[W - 5, baseY - 3], [rowEnd + 2, baseY - 3]], 0, ["yard"])) {
    const g = b.props[b.props.length - 1]!;
    b.propNear("sp-steam-vent", [[g.x - 2, g.y + 4], [g.x + 1, g.y + 5]], 0, ["yard"]);
    b.propNear("sp-barrels", [[g.x, g.y + 5], [g.x + 2, g.y + 5]], 0, ["yard"]);
  }
  // 석탄 마당: 보일러실 앞 옆쪽에 석탄 상자 + 석탄 더미 + 광차 줄
  if (boiler) {
    const bx0 = boiler.rect.x, bx1 = boiler.rect.x + boiler.rect.w;
    b.propNear("sp-coal-bunker", [[bx0, y0 + 3], [bx1 - 2, y0 + 3], [bx0 - 3, y0 + 3]], 0, ["yard"]);
    b.propNear("sp-coal-heap", [[bx0 - 3, y0 + 5], [bx1, y0 + 5], [bx0, y0 + 5]], 0, ["yard"]);
    for (let k = 0; k < 3; k++) b.propNear("sp-minecart", [[bx1 + 1 + k, y0 + 4], [bx0 - 2 - k, y0 + 4]], 0, ["yard"]);
  }
  for (const d of blds) {
    if (/warehouse|workshop/.test(d.kit)) {
      const z = d.access[d.access.length - 1]!;
      b.propNear("sp-crates", [[z.x + 2, y0 + 3], [d.access[0]!.x - 3, y0 + 3]], 0, ["yard"]);
      b.propNear("sp-handcart", [[z.x + 2, y0 + 5], [d.access[0]!.x - 3, y0 + 5]], 0, ["yard"]);
    }
    if (/factory/.test(d.kit)) b.propNear("sp-scrap-heap", [[d.rect.x, y0 + 5], [d.rect.x + d.rect.w - 2, y0 + 5]], 0, ["yard"]);
  }
  b.propNear("sp-steam-vent", [[gateX - 2, y0 + 4], [gateX + 4, y0 + 4]], 0, ["yard"]);
  // 노동자 주택 앞: 문 옆 통·화분 · 가장 넓은 빈 마당 구간은 석탄 야적장 — 마당 동쪽 절반이 쓰임 없이 비었다(QA F1)
  for (const d of blds) if (/row-soot/.test(d.kit)) { const a = d.access[0]!; b.propNear(pick(rng, ["sp-barrel", "sp-planter"]), [[a.x + 1, a.y], [a.x - 1, a.y]], 0, ["yard"]); }
  {
    const works = blds.filter((d) => /factory|boiler|warehouse|workshop/.test(d.kit));
    const wx1 = works.length ? Math.max(...works.map((d) => d.rect.x + d.rect.w)) : 0;
    const yx0 = Math.max(wx1 + 1, 1), yx1 = W - 2;
    if (yx1 - yx0 >= 8) {
      const r = { x: yx0 + 1, y: y0 + 3, w: Math.min(12, yx1 - yx0 - 1), h: 4 };
      b.zone("석탄 야적장", "석탄 더미·광차·고철", r);
      cluster(b, r, ["sp-coal-heap", "sp-coal-heap", "sp-coal-bunker", "sp-minecart", "sp-minecart", "sp-scrap-heap", "sp-coal-heap"], ["yard"]);
    }
  }
  // 역 앞 광장: 가판대·시계 기둥·광고탑·가로수·벤치, 길 쪽 가스등
  if (station) {
    const sa = station.access[0]!;
    b.propNear("sp-kiosk", [[stX - 4, stY0 + 1], [stX + st.w + 2, stY0 + 1]], 1, ["walk"]);
    b.propNear("sp-clock-post", [[stX - 2, stY0 + st.h - 3], [stX + st.w + 1, stY0 + st.h - 3]], 1, ["walk"]);
    b.propNear("sp-poster-column", [[stX + st.w + 3, stY0 + 4], [stX - 5, stY0 + 4]], 1, ["walk"]);
    for (let tx = 2; tx < W - 3; tx += 7) if (tx + 2 < stX - 1 || tx > stX + st.w) b.propNear("sp-plane-tree", [[tx, stY0], [tx + 1, stY0]], 1, ["walk"]);
    for (const tx of [stX - 3, stX + st.w + 2]) b.propNear("sp-planter", [[tx, stBase], [tx, stBase - 1]], 0, ["walk"]);
    b.propNear("sp-bench", [[stX + st.w + 6, stY0 + 5], [stX - 9, stY0 + 5]], 0, ["walk"]);
    lampsAlong(b, 3, W - 3, stY0 + 2, 9, ["walk"], "sp-gas-lamp");
    // 승강장: 벤치·광장 가스등·시계 기둥(문 앞은 비운다)
    b.propNear("sp-bench", [[sa.x - 4, pl0], [sa.x + 4, pl0]], 0, ["platform"]);
    b.propNear("sp-bench", [[sa.x + 5, pl0], [sa.x - 6, pl0]], 0, ["platform"]);
    // 열차: 승강장 옆 본선 — 동쪽이 앞(기관차) + 탄수차 + 객차 둘
    const train = ["sp-coach", "sp-coach", "sp-tender", "sp-locomotive"].filter((k) => b.has(k));
    const tw = train.reduce((s, k) => s + b.kitSize(k).w, 0);
    let tx = Math.max(0, Math.min(W - tw, Math.floor((platX0 + platX1 - tw) / 2)));
    for (const k of train) { b.stamp(k, tx, main - 1, "prop"); b.props.push({ kit: k, x: tx, y: main - 1 }); tx += b.kitSize(k).w; }
    // 신호등: 승강장 끝 바로 밖(선로 북쪽 줄), 급수탑: 승강장 반대 끝 밖
    b.propNear("sp-rail-signal", [[platX1 + 1, edge - 2], [platX1 + 2, edge - 2]], 0, ["yard", "walk"]);
    b.propNear("sp-water-tower", [[platX0 - 4, edge - 4], [platX0 - 5, edge - 4]], 0, ["yard", "walk"]);
  }
  // 측선: 서쪽 끝 차막이, 화물칸 줄, 동쪽 하역장에 문형 기중기 + 상자
  b.prop("sp-buffer-stop", 0, siding, 0, ["rail"]);
  const wagons = shuffle(rng, ["sp-wagon-coal", "sp-wagon-box", "sp-wagon-coal"]).filter((k) => b.has(k));
  let wx = 2;
  for (const k of wagons) { b.stamp(k, wx, siding - 1, "prop"); b.props.push({ kit: k, x: wx, y: siding - 1 }); wx += b.kitSize(k).w; }
  if (b.has("sp-gantry-crane")) {
    const gc = b.kitSize("sp-gantry-crane");
    b.propNear("sp-gantry-crane", [[W - gc.w - 4, siding + 2 - gc.h + 1 + 1], [W - gc.w - 8, siding + 2 - gc.h + 1 + 1]], 0, ["yard", "rail"]);
  }
  b.propNear("sp-crates", [[W - 3, siding + 2], [W - 12, siding + 2]], 0, ["yard"]);
  b.propNear("sp-coal-heap", [[wx + 2, siding + 2], [wx + 5, siding + 2]], 0, ["yard"]);
  return start;
}

// ───────────────────────── 운하 부두 ─────────────────────────
function composeDock(b: Board, rng: () => number, want: readonly string[]): SteampunkCell {
  const { W, H } = b;
  const ids0 = want.length ? want : shuffle(rng, ["dock-warehouse", "warehouse", "tavern"]).concat(rng() < 0.5 ? ["pump-house"] : ["lab"]);
  let plan = fitRow(b, { ids: ids0.map(kitIdOf).filter((id) => b.has(id)), gaps: ids0.map(() => 3) }, W - 2);
  if (!want.length) plan = padRow(b, rng, plan, W, ["row-soot-3", "row-soot-4"]);
  const maxH = Math.max(...plan.ids.map((id) => b.kitSize(id).h));
  const baseY = maxH;
  b.fill("cinder", { x: 0, y: 0, w: W, h: baseY + 1 }, "lane");
  const left = Math.max(1, Math.floor((W - rowWidth(b, plan)) / 2));
  const blds = buildingRow(b, plan, left, baseY);
  // 둑길 4줄(자갈) · 석축 · 물 4줄 · 갓돌 · 남쪽 산책로 2줄 · 정박장/시장 · 맨 아래 보도
  const q0 = baseY + 1, quay = q0 + 4, w0 = quay + 1, lip = w0 + 4, s0 = lip + 1;
  b.fill("cobble", { x: 0, y: q0, w: W, h: 4 }, "road");
  b.zone("둑길·하역장", "자갈 둑길", { x: 0, y: q0, w: W, h: 4 });
  b.fill("quay", { x: 0, y: quay, w: W, h: 1 }, "quay");
  b.fill("water", { x: 0, y: w0, w: W, h: 4 }, "water");
  b.fill("quay-lip", { x: 0, y: lip, w: W, h: 1 }, "walk");
  b.zone("운하", "물", { x: 0, y: quay, w: W, h: 6 });
  b.fill("flag", { x: 0, y: s0, w: W, h: 2 }, "walk");
  b.fill("flag", { x: 0, y: s0 + 2, w: W, h: H - s0 - 2 }, "walk");
  // 돌다리(남북): 4칸 폭, 운하 전체(석축~갓돌)를 덮는다
  const bx = Math.max(2, Math.min(W - 6, Math.floor(W * (0.35 + rng() * 0.3))));
  for (let y = quay; y <= lip; y++) { b.set("bridge-w", bx, y, "walk"); b.set("bridge-m", bx + 1, y, "walk"); b.set("bridge-m", bx + 2, y, "walk"); b.set("bridge-e", bx + 3, y, "walk"); }
  b.zone("돌다리", "운하를 건너는 다리", { x: bx, y: quay, w: 4, h: lip - quay + 1 });
  // 나무 잔교: 북쪽 둑에서 물로 2줄 + 끝(물 위)
  const pierLeft = bx > W / 2;
  const px = pierLeft ? Math.max(1, bx - 12) : Math.min(W - 5, bx + 10);
  for (let y = quay; y < w0 + 2; y++) b.fill("deck", { x: px, y, w: 3, h: 1 }, "deck");
  b.fill("deck-edge", { x: px, y: w0 + 2, w: 3, h: 1 }, "quay");
  b.zone("잔교", "나무 부두", { x: px, y: quay, w: 3, h: w0 + 3 - quay });
  // 비행선 정박장: 남쪽 광장 한쪽에 판자 마당(계류탑 + 비행선)
  const air = b.has("sp-airship-docked") && b.has("sp-mooring-mast");
  const aw = air ? b.kitSize("sp-mooring-mast").w + b.kitSize("sp-airship-docked").w + 2 : 0;
  const ah = air ? Math.max(b.kitSize("sp-airship-docked").h, b.kitSize("sp-mooring-mast").h) + 1 : 0;
  const ax = pierLeft ? W - aw - 1 : 1, ay = s0 + 2;
  const airFits = air && ay + ah <= H - 1;
  if (airFits) { b.fill("deck", { x: ax, y: ay, w: aw, h: ah }, "deck"); b.zone("비행선 정박장", "판자 정박장·계류탑", { x: ax, y: ay, w: aw, h: ah }); }
  else if (air) b.notes.push("맵이 낮아 비행선 정박장을 뺐다(남쪽 광장이 6줄 이상이어야 한다)");
  const start = { x: bx + 1, y: H - 1 };
  b.start = start;
  // ── 소품 ──
  // 둑 줄(석축 바로 위 줄): 계선주 5칸 간격, 밧줄 사리, 증기 기중기, 하역 상자
  const qe = quay - 1;
  for (let x = 1; x < W - 1; x += 5) { if (x >= bx - 1 && x <= bx + 4) continue; if (x >= px - 1 && x <= px + 3) continue; b.prop("sp-bollard", x, qe, 0, ["road"]); }
  if (b.has("sp-jib-crane")) {
    const jc = b.kitSize("sp-jib-crane");
    const dw = blds.find((d) => /dock-warehouse|warehouse/.test(d.kit));
    const jx = dw ? dw.rect.x + dw.rect.w - jc.w : W - jc.w - 2;
    b.propNear("sp-jib-crane", [[jx, qe - jc.h + 1], [jx - 3, qe - jc.h + 1], [jx + 3, qe - jc.h + 1]], 0, ["road"]);
  }
  for (const d of blds) {
    const a = d.access[0]!, z = d.access[d.access.length - 1]!;
    if (/warehouse/.test(d.kit)) { b.propNear("sp-crates", [[z.x + 2, q0 + 1], [a.x - 3, q0 + 1]], 0, ["road"]); b.propNear("sp-handcart", [[a.x - 3, q0 + 2], [z.x + 2, q0 + 2]], 0, ["road"]); }
    if (/tavern/.test(d.kit)) b.propNear("sp-barrels", [[z.x + 1, a.y], [a.x - 2, a.y]], 0, ["road"]);
    if (/pump-house/.test(d.kit) && b.has("sp-water-tower")) b.propNear("sp-water-tower", [[d.rect.x + d.rect.w + 1, baseY - 4], [d.rect.x - 4, baseY - 4]], 0, ["lane", "road"]);
  }
  lampsAlong(b, 3, W - 3, q0 + 1, 8, ["road"]);
  // 물 위: 바지선(다리·잔교를 피해) · 나룻배(잔교 옆)
  if (b.has("sp-barge")) {
    const bw = b.kitSize("sp-barge").w;
    const spots: [number, number][] = [];
    for (let x = 1; x + bw < W; x += 2) if (x + bw < bx - 1 || x > bx + 4) if (x + bw < px - 1 || x > px + 3) spots.push([x, w0 + 1]);
    b.propNear("sp-barge", shuffle(rng, spots).slice(0, 12), 0, ["water"]);
  }
  b.propNear("sp-rowboat", [[px + 3, w0 + 1], [px - 2, w0 + 1], [px + 3, w0]], 0, ["water"]);
  // 잔교 위 밧줄 사리(평면 덧그림)
  if (b.pal.tile("rope-coil") >= 0) b.set("rope-coil", px + 1, w0, "deck", "upper");
  // 남쪽: 정박장(계류탑 서쪽 + 비행선), 곤돌라 앞 1칸 비움, 상자·밧줄
  if (airFits) {
    const mm = b.kitSize("sp-mooring-mast"), ad = b.kitSize("sp-airship-docked");
    b.prop("sp-mooring-mast", ax + 1, ay + ah - 1 - mm.h + 1, 0, ["deck"]);
    const shipX = ax + 1 + mm.w, shipY = ay + ah - 1 - ad.h;
    if (b.prop("sp-airship-docked", shipX, shipY, 0, ["deck"])) b.reserve({ x: shipX + Math.floor(ad.w / 2) - 1, y: shipY + ad.h, w: 2, h: 1 });
    b.propNear("sp-crates", [[ax + aw - 2, ay], [ax + aw - 2, ay + 2]], 0, ["deck"]);
  }
  // 생선 시장: 정박장 반대쪽 광장에 노점 둘 + 벤치 + 가로수
  const mx0 = pierLeft ? 1 : (airFits ? ax + aw + 1 : 1), mx1 = pierLeft ? (airFits ? ax - 2 : W - 2) : W - 2;
  // 시장은 아래 보도 한 줄 위까지 내린다(아래쪽 빈 판석 — QA D1)
  const mkt = { x: mx0, y: s0 + 2, w: Math.min(14, Math.max(1, mx1 - mx0 + 1)), h: Math.max(1, H - s0 - 3) };
  b.fill("brickpave", mkt, "plaza");
  b.zone("생선 시장", "노점 광장", mkt);
  let sx = mx0 + 1;
  for (const st of ["sp-stall-fish", pick(rng, ["sp-stall-fruit", "sp-stall-parts"])]) { if (b.prop(st, sx, s0 + 2, 0, ["plaza"])) b.reserve({ x: sx, y: s0 + 5, w: 3, h: 1 }); sx += 4; }
  b.propNear("sp-barrels", [[sx, s0 + 3], [sx + 1, s0 + 3]], 0, ["plaza"]);
  b.propNear("sp-handcart", [[mx0 + 1, s0 + 6], [mx0 + 5, s0 + 6]], 0, ["plaza"]);
  // 시장 안 아래쪽: 광고탑·가판대·벤치 — 노점 줄 밑이 빈 포석이었다
  cluster(b, { x: mkt.x + 1, y: s0 + 6, w: mkt.w - 2, h: Math.max(1, mkt.h - 5) }, ["sp-poster-column", "sp-bench", "sp-kiosk", "sp-crates"], ["plaza"], 1);
  lampsAlong(b, 2, W - 2, s0 + 1, 11, ["walk"]);
  // 산책로: 운하를 보는 벤치(가스등 사이) — 남쪽 산책로가 비었다(QA D1)
  for (let x = 7; x < W - 3; x += 11) if (x + 1 < bx - 1 || x > bx + 4) b.propNear("sp-bench", [[x, s0], [x + 1, s0], [x - 1, s0]], 0, ["walk"]);
  // 시장 옆 남은 광장: 철 울타리 쌈지 공원 — 시장 끝부터 정박장(또는 맵 끝)까지 남김없이(가운데 빈 판석 — QA D1)
  const parkX0 = Math.min(mx1 - 9, mkt.x + mkt.w + 1), parkW = mx1 - parkX0;
  if (parkW >= 8 && H - s0 - 4 >= 6) pocketPark(b, rng, { x: parkX0, y: s0 + 3, w: Math.min(parkW, 18), h: H - s0 - 4 }, "n");
  backyards(b, rng, blds);
  return start;
}

// ───────────────────────── 실내 ─────────────────────────
interface RoomLook { floor: string; wall: "brick" | "panel" | "iron"; windows: boolean }
const ROOM_LOOK: Readonly<Record<SteampunkRoomStyle, RoomLook>> = {
  "boiler-room": { floor: "floor-stone", wall: "brick", windows: false },
  "engine-room": { floor: "floor-iron", wall: "iron", windows: false },
  workshop: { floor: "floor-plank", wall: "brick", windows: true },
  lab: { floor: "floor-checker", wall: "panel", windows: true },
  inn: { floor: "floor-herring", wall: "panel", windows: true },
  tavern: { floor: "floor-plank", wall: "panel", windows: false },
};
const ROOM_NAME: Readonly<Record<SteampunkRoomStyle, string>> = { "boiler-room": "보일러실", "engine-room": "기관실", workshop: "기계 공방", lab: "연구실", inn: "여관 응접실", tavern: "선술집" };

/**
 * 방 한 칸: 바깥 테두리 천장, 맨 윗줄 안쪽 두 줄 벽면(위·아래), 바닥, 맨 아래 줄 가운데 출입구 틈(2칸).
 * 벽 장식은 벽면 두 줄에만, 가구는 바닥에만 놓는다.
 */
function composeRoom(b: Board, rng: () => number, style: SteampunkRoomStyle): SteampunkCell {
  const { W, H } = b;
  const look = ROOM_LOOK[style];
  b.fill("ceiling", { x: 0, y: 0, w: W, h: H }, "ceil");
  const fx0 = 1, fx1 = W - 2, fy0 = 3, fy1 = H - 2;
  b.fill(look.floor, { x: fx0, y: fy0, w: fx1 - fx0 + 1, h: fy1 - fy0 + 1 }, "floor");
  for (let x = fx0; x <= fx1; x++) { b.set(`wall-${look.wall}-u`, x, 1, "wall"); b.set(`wall-${look.wall}-d`, x, 2, "wall"); }
  if (look.windows && look.wall === "brick") for (let x = fx0 + 2; x < fx1 - 1; x += 5) { b.set("wall-window-u", x, 1, "wall"); b.set("wall-window-d", x, 2, "wall"); }
  const ex = Math.floor(W / 2) - 1;
  b.fill(look.floor, { x: ex, y: H - 1, w: 2, h: 1 }, "floor");
  b.reserve({ x: ex, y: H - 3, w: 2, h: 3 });                         // 출입구와 그 안쪽 두 줄은 비운다
  b.zone(ROOM_NAME[style], style, { x: fx0, y: fy0, w: fx1 - fx0 + 1, h: fy1 - fy0 + 1 });
  const start = { x: ex, y: H - 1 };
  b.start = start;
  const wallDeco = (kit: string, xs: readonly number[]) => { for (const x of xs) if (b.has(kit)) { const s = b.kitSize(kit); if (b.free({ x, y: 3 - s.h, w: s.w, h: s.h }, 0, ["wall"])) { b.stamp(kit, x, 3 - s.h, "wall"); b.props.push({ kit, x, y: 3 - s.h }); return true; } } return false; };
  const deco2 = (kit: string, xs: readonly number[]) => { for (const x of xs) if (b.has(kit)) { const s = b.kitSize(kit); if (b.free({ x, y: 1, w: s.w, h: s.h }, 0, ["wall"])) { b.stamp(kit, x, 1, "wall"); b.props.push({ kit, x, y: 1 }); return true; } } return false; };
  /** 북쪽 벽에 등을 대는 가구(키 큰 가구는 윗줄이 벽면 아랫줄에 겹친다). */
  const backWall = (kit: string, xs: readonly number[], margin = 0) => {
    if (!b.has(kit)) return false;
    const tall = /bookshelf|curio|wardrobe|dresser|fireplace|drill|tesla|boiler|engine|pipe-wall/.test(kit);
    const y = tall ? fy0 - 1 : fy0;
    // 키 큰 가구의 윗줄은 벽면(아랫줄) 위에 겹친다 — 그 벽 칸에 장식이 없어야 한다
    for (const x of xs) if (b.prop(kit, x, y, margin, ["floor"], tall ? ["wall"] : undefined)) return true;
    return false;
  };
  const xs = (from: number, to: number) => { const out: number[] = []; for (let x = from; x <= to; x++) out.push(x); return out; };
  const leftFirst = rng() < 0.5;
  const sideXs = (w: number) => leftFirst ? xs(fx0, fx1 - w + 1) : xs(fx0, fx1 - w + 1).reverse();
  const anywhere = (kit: string, n: number, margin = 1) => {
    if (!b.has(kit)) return 0;
    const s = b.kitSize(kit); let k = 0;
    const spots = shuffle(rng, xs(fx0, fx1 - s.w + 1).flatMap((x) => xs(fy0 + 1, fy1 - s.h + 1).map((y) => [x, y] as [number, number])));
    for (const [x, y] of spots) { if (k >= n) break; if (b.prop(kit, x, y, margin, ["floor"])) k++; }
    return k;
  };
  const corner = (kit: string) => {
    if (!b.has(kit)) return false;
    const s = b.kitSize(kit);
    return b.propNear(kit, shuffle(rng, [[fx0, fy1 - s.h + 1], [fx1 - s.w + 1, fy1 - s.h + 1]] as [number, number][]), 0, ["floor"]);
  };
  const cx = Math.floor((fx0 + fx1) / 2);
  switch (style) {
    case "boiler-room": {
      // 보일러는 북쪽 벽 앞 가운데에서 한쪽으로, 옆에 석탄 통, 반대쪽 벽 앞 화덕, 벽에는 배관·압력계·밸브, 화실 문 앞 2칸 비움
      const bw = b.has("sp-boiler") ? b.kitSize("sp-boiler").w : 3;
      const bxs = leftFirst ? [cx - bw - 1, cx - bw, cx - bw - 2] : [cx + 1, cx + 2, cx];
      if (backWall("sp-boiler", bxs)) {
        const p = b.props[b.props.length - 1]!; b.reserve({ x: p.x, y: p.y + 3, w: bw, h: 2 });
        // 석탄 통 → 바로 아래 석탄 더미 → 옆 광차: 화실까지 한 줄 연료 동선(더미가 방 가운데 떠 있었다 — QA B1)
        if (b.propNear("sp-coal-bin", [[p.x + bw + 1, fy0 + 2], [p.x - 3, fy0 + 2]], 0, ["floor"])) {
          const c = b.props[b.props.length - 1]!;
          b.propNear("sp-coal-heap", [[c.x, c.y + 1], [c.x, c.y + 2]], 0, ["floor"]);
          b.propNear("sp-minecart", [[c.x + 2, c.y + 1], [c.x - 1, c.y + 1], [c.x + 2, c.y]], 0, ["floor"]);
        }
      }
      backWall("sp-furnace", leftFirst ? xs(cx + 2, fx1 - 1) : xs(fx0, cx - 3).reverse(), 0);
      // 벽 배관은 두세 토막(양쪽 벽 끝과 가운데), 그 사이에 압력계·밸브 — 보일러실 벽은 배관이 주인공이다
      for (const x of leftFirst ? [fx1, fx1 - 2, cx] : [fx0, fx0 + 2, cx]) deco2("sp-pipe-wall", [x, x + 1, x - 1]);
      deco2("sp-gauge-wall", xs(fx0, fx1)); wallDeco("sp-valve-wheel", xs(fx0, fx1).reverse()); wallDeco("sp-valve-wheel", xs(fx0, fx1));
      // 모퉁이 창고(상자·자루를 한 덩이로) + 반대 모퉁이 화부 작업대·걸상 — 아랫쪽 절반이 비었다(QA B1)
      const storeLeft = !leftFirst;
      cluster(b, { x: storeLeft ? fx0 : fx1 - 2, y: fy1 - 1, w: 3, h: 2 }, ["sp-crate-in", "sp-sack", "sp-sack", "sp-crate-in"], ["floor"]);
      if (b.propNear("sp-workbench", storeLeft ? [[fx1 - 2, fy1 - 1], [fx1 - 3, fy1 - 1]] : [[fx0, fy1 - 1], [fx0 + 1, fy1 - 1]], 0, ["floor"])) {
        const w = b.props[b.props.length - 1]!;
        b.propNear("sp-stool", [[storeLeft ? w.x - 1 : w.x + 3, w.y + 1], [w.x + 1, w.y - 1]], 0, ["floor"]);
      }
      break;
    }
    case "engine-room": {
      const ew = b.has("sp-engine") ? b.kitSize("sp-engine").w : 4;
      if (b.has("sp-engine")) b.propNear("sp-engine", [[cx - Math.floor(ew / 2), fy0 + 2], [cx - Math.floor(ew / 2) - 1, fy0 + 2], [cx - Math.floor(ew / 2) + 1, fy0 + 3]], 1, ["floor"]);
      backWall("sp-dynamo", sideXs(2));
      wallDeco("sp-tool-rack", leftFirst ? xs(fx1 - 3, fx1 - 1) : xs(fx0, fx0 + 2));
      deco2("sp-pipe-wall", xs(fx0, fx1)); deco2("sp-gauge-wall", xs(fx0 + 2, fx1)); wallDeco("sp-valve-wheel", xs(fx0, fx1).reverse());
      corner("sp-crate-in"); corner("sp-coal-bin");
      break;
    }
    case "workshop": {
      backWall("sp-workbench", sideXs(3));
      backWall("sp-lathe", leftFirst ? xs(cx, fx1 - 2) : xs(fx0, cx - 3).reverse());
      backWall("sp-drill-press", xs(fx0, fx1));
      wallDeco("sp-tool-rack", xs(fx0, fx1 - 1)); deco2("sp-wall-clock-gear", xs(fx0, fx1).reverse());
      if (backWall("sp-furnace", leftFirst ? xs(fx0, fx1).reverse() : xs(fx0, fx1))) { const p = b.props[b.props.length - 1]!; b.propNear("sp-anvil", [[p.x, p.y + 3], [p.x + 1, p.y + 3]], 0, ["floor"]); }
      corner("sp-crates"); anywhere("sp-crate-in", 2); anywhere("sp-handcart", 1);
      break;
    }
    case "lab": {
      if (b.has("sp-lab-bench")) b.propNear("sp-lab-bench", [[cx - 1, fy0 + 3], [cx - 2, fy0 + 3], [cx, fy0 + 4]], 1, ["floor"]);
      backWall("sp-curio-cabinet", sideXs(2)); backWall("sp-bookshelf", sideXs(2)); backWall("sp-drafting-table", sideXs(2));
      deco2("sp-shelf-wall", xs(fx0, fx1 - 1)); deco2("sp-wall-clock-gear", xs(fx0, fx1).reverse());
      if (b.has("sp-tesla-coil")) { const s = b.kitSize("sp-tesla-coil"); b.propNear("sp-tesla-coil", [[leftFirst ? fx1 - 1 : fx0 + 1, fy1 - s.h], [leftFirst ? fx0 + 1 : fx1 - 1, fy1 - s.h]], 1, ["floor"]); }
      anywhere("sp-chair", 2, 0); anywhere("sp-crate-in", 1);
      break;
    }
    case "inn": {
      // 접수대: 북쪽 벽에서 한 칸 띄워(뒤 1칸 통로), 앞 2칸 비움
      for (const x of [cx - 1, cx - 2, cx]) if (b.prop("sp-inn-counter", x, fy0 + 1, 0, ["floor"])) { b.reserve({ x, y: fy0, w: 3, h: 1 }); b.reserve({ x, y: fy0 + 3, w: 3, h: 2 }); break; }
      backWall("sp-fireplace", leftFirst ? xs(fx0, cx - 4) : xs(cx + 3, fx1 - 2).reverse());
      backWall("sp-stairs-up", leftFirst ? xs(cx + 3, fx1 - 1).reverse() : xs(fx0, cx - 3));
      backWall("sp-bookshelf", xs(fx0, fx1));
      deco2("sp-wall-clock-gear", xs(fx0, fx1)); deco2("sp-shelf-wall", xs(fx0, fx1 - 1).reverse());
      if (b.has("sp-rug")) b.propNear("sp-rug", [[cx - 1, fy1 - 4], [cx - 2, fy1 - 4]], 0, ["floor"]);
      const t = anywhere("sp-tavern-table", 2, 1);
      if (t) for (const p of b.props.filter((q) => q.kit === "sp-tavern-table")) { b.propNear("sp-chair", [[p.x, p.y - 1], [p.x + 1, p.y - 1]], 0, ["floor"]); b.propNear("sp-stool", [[p.x + 2, p.y + 1], [p.x - 1, p.y + 1]], 0, ["floor"]); }
      corner("sp-planter");
      break;
    }
    case "tavern": {
      // 바: 북쪽 벽에서 한 칸 띄워 동서로(뒤 1칸 바텐더 통로), 바 앞 걸상 줄, 벽엔 술통 받침대
      if (b.has("sp-bar-counter")) {
        const bw = b.kitSize("sp-bar-counter").w;
        for (const x of [cx - Math.floor(bw / 2), cx - Math.floor(bw / 2) - 2, cx - Math.floor(bw / 2) + 2]) {
          if (b.prop("sp-bar-counter", x, fy0 + 1, 0, ["floor"])) { b.reserve({ x, y: fy0, w: bw, h: 1 }); for (let i = 0; i < bw; i += 2) b.prop("sp-stool", x + i, fy0 + 3, 0, ["floor"]); break; }
        }
      }
      backWall("sp-barrel-rack", sideXs(2));
      backWall("sp-fireplace", leftFirst ? xs(fx0, fx1).reverse() : xs(fx0, fx1));
      deco2("sp-shelf-wall", xs(fx0, fx1 - 1)); deco2("sp-wall-clock-gear", xs(fx0, fx1).reverse());
      const n = anywhere("sp-tavern-table", Math.max(2, Math.floor((W * H) / 70)), 1);
      if (n) for (const p of b.props.filter((q) => q.kit === "sp-tavern-table")) { b.propNear("sp-stool", [[p.x - 1, p.y + 1], [p.x + 2, p.y]], 0, ["floor"]); b.propNear("sp-chair", [[p.x, p.y - 1], [p.x + 1, p.y - 1]], 0, ["floor"]); }
      corner("sp-barrels"); corner("sp-barrel");
      break;
    }
  }
  return start;
}

/** 한 장을 짠다. 칸이 모자라면 Error(호출자가 ToolError 로 바꾼다). */
export function composeSteampunkCity(spec: SteampunkSpec, pal: SteampunkPalette): SteampunkResult {
  const min = STEAMPUNK_MIN_SIZE[spec.style];
  if (!min) throw new Error(`알 수 없는 style ${spec.style}`);
  if (spec.width < min.w || spec.height < min.h) throw new Error(`맵이 작다(${spec.width}×${spec.height}) — ${spec.style} 는 ${min.w}×${min.h} 이상이어야 한다`);
  const seed = (spec.seed ?? 0) >>> 0;
  const rng = mulberry(seed * 7919 + spec.style.length * 131);
  const indoor = (STEAMPUNK_ROOM_STYLES as readonly string[]).includes(spec.style);
  const b = new Board(spec.width, spec.height, pal, pal.tile(indoor ? "ceiling" : "cobble"), indoor ? "ceil" : "road");
  const want = spec.buildings ?? [];
  let start: SteampunkCell;
  if (spec.style === "street") start = composeStreet(b, rng, want);
  else if (spec.style === "industrial") start = composeIndustrial(b, rng, want);
  else if (spec.style === "dock") start = composeDock(b, rng, want);
  else start = composeRoom(b, rng, spec.style as SteampunkRoomStyle);
  if (!indoor) b.variety(seed);
  const exits: SteampunkCell[] = [];
  if (indoor) { for (let x = 0; x < b.W; x++) if (b.walk(x, b.H - 1)) exits.push({ x, y: b.H - 1 }); }
  else exits.push(start);
  return { lower: b.lower, upper: b.upper, buildings: b.buildings, start, exits, props: b.props, zones: b.zones, notes: b.notes };
}

/** 번들 정의(TilesetDef 모양)에서 사전을 만든다: 한 칸 바닥은 그룹 `sp:sp-<조각>`, 키트는 structureKits(출입구 부품), 통행은 passability. */
export function steampunkPaletteFromTileset(def: {
  readonly tileGroups?: readonly { readonly id: string; readonly tileIds: readonly number[] }[];
  readonly structureKits?: readonly unknown[];
  readonly passability?: readonly { readonly up?: boolean }[];
}): SteampunkPalette {
  const groups = new Map((def.tileGroups ?? []).map((g) => [g.id, g.tileIds] as const));
  const kits = new Map<string, SteampunkKit>();
  for (const raw of def.structureKits ?? []) {
    const k = raw as { id: string; width: number; height: number; rows: SteampunkKit["rows"]; parts?: { kind: string; dx: number; w: number }[] };
    if (!k?.id || !Array.isArray(k.rows)) continue;
    const part = k.parts?.find((p) => p.kind === "entrance");
    kits.set(k.id, { id: k.id, width: k.width, height: k.height, rows: k.rows, door: part ? { dx: part.dx, w: part.w } : undefined });
  }
  const pass = def.passability ?? [];
  return {
    tile: (piece) => groups.get(`sp:sp-${piece.replace(/^sp-/, "")}`)?.[0] ?? -1,
    kit: (id) => kits.get(id),
    pass: (t) => t >= 0 && !!pass[t]?.up,
  };
}
