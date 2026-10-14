// project/snowNorthComposer.ts
// 북방 설원(snow_north) 구성기 — 용도(눈 마을 village | 얼어붙은 호수 낚시터 lake | 얼음 동굴 입구 cave | 북방 장터 market | 실내 다섯)·씨앗·맵 크기만 주면 한 장을 짠다.
//
// 왜: 사용자는 옛 시안의 «그림»만큼 «물건 배치»를 싫어했다(통째 흰 바닥, 아무 데나 흩은 소품, 겹친 물건, 막힌 문). 그래서 배치는 모델이 아니라 이 함수가 한다.
//   순서는 계획(땅 덩이: 숲·호수·툰드라·서리 풀) → 빈터(광장·장터·마당·야영지) → 건물 → 길(문 앞 접근칸부터) → 소품(규칙·여백·자기 바닥) → 빈 눈밭 깨기 이다.
// 바닥은 47 모양 오토타일(다진 눈·얼음·툰드라·서리 풀·진창·열린 물)이고 나머지는 눈밭이다. 칸마다 «땅 이름»을 두고 마지막에 이웃 8칸 비트로 모양 칸을 고른다
//   (번들 autotileGroups 와 같은 비트 — 얼음은 열린 물을 이어진 이웃으로 본다).
// 조화 규칙(jp_city·캠퍼스·스팀펑크·선사 적대 검수 교훈):
//   - 빈 땅마다 쓰임이 있다(광장·장터·마당·우리·물가·숲·야영지). 넓은 흰 눈밭은 눈더미·바위·덤불·가문비 덩이·툰드라 덩이로 깬다.
//   - 소품은 자기 바닥 위에만(낚시 자리·낚시 오두막은 얼음, 갈대는 얼음가 눈, 여물통·건초는 진창·툰드라 마당, 노점은 다진 눈 장터).
//   - 위층 칸은 한 칸에 하나뿐이다 — 키트끼리 겹치면 놓지 않는다. 발자국 + 여백을 예약한다.
//   - 문 칸은 막힘, 바로 아래 접근칸과 그 아래 한 칸은 비우고 다진 눈길로 잇는다. 소품을 놓을 때마다 시작 칸 BFS 로 «이미 닿던 칸이 끊기지 않는지» 보고, 끊으면 되돌린다.
// 순수 함수다(프로젝트를 모른다). 칸 번호·통행은 호출자가 준 사전(palette)에서 얻는다 — 도구(snowNorthTools.ts)는 번들 정의에서, QA 스크립트는 구운 JSON 에서.

export type SnowNorthOutdoorStyle = "village" | "lake" | "cave" | "market";
export type SnowNorthRoomStyle = "cabin" | "longhall" | "tavern" | "sauna" | "ice-cave";
export type SnowNorthStyle = SnowNorthOutdoorStyle | SnowNorthRoomStyle;
export const SNOW_NORTH_OUTDOOR_STYLES: readonly SnowNorthOutdoorStyle[] = ["village", "lake", "cave", "market"];
export const SNOW_NORTH_ROOM_STYLES: readonly SnowNorthRoomStyle[] = ["cabin", "longhall", "tavern", "sauna", "ice-cave"];

export interface SnowNorthKit {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly rows: readonly { readonly tiles: readonly number[]; readonly upperTiles?: readonly number[] }[];
  readonly door?: { readonly dx: number; readonly w: number };
}

export interface SnowNorthPalette {
  /** 한 칸 바닥 조각 이름(snow, pack, floor-plank, wall-log-u …) → 칸 번호. 없으면 -1. */
  tile(piece: string): number;
  /** 오토타일 그룹(pack·ice·tundra·frost·slush·water)의 이웃 비트 → 칸 번호. 없으면 -1. */
  autotile(group: string, mask: number): number;
  /** 오토타일 가득 찬 속 칸 변형(첫째 = 기본 속 칸). */
  bodies(group: string): readonly number[];
  kit(id: string): SnowNorthKit | undefined;
  /** 칸 통행(MZ 규칙): 위층이 있고 ★ 가 아니면 위층이, 아니면 아래층이 정한다. */
  walk(lower: number, upper: number): boolean;
}

export interface SnowNorthCell { readonly x: number; readonly y: number }
export interface SnowNorthBuilding { readonly name: string; readonly kit: string; readonly rect: { x: number; y: number; w: number; h: number }; readonly doors: SnowNorthCell[]; readonly access: SnowNorthCell[] }

export interface SnowNorthSpec {
  readonly width: number;
  readonly height: number;
  readonly style: SnowNorthStyle;
  readonly seed?: number;
}

export interface SnowNorthResult {
  readonly lower: number[];
  readonly upper: number[];
  readonly buildings: SnowNorthBuilding[];
  readonly start: SnowNorthCell;
  /** 맵 출입구(야외: 시작 칸 / 실내: 맨 아래 줄 출입구 틈). */
  readonly exits: SnowNorthCell[];
  readonly props: { kit: string; x: number; y: number }[];
  readonly zones: { name: string; use: string; rect: { x: number; y: number; w: number; h: number } }[];
  readonly notes: string[];
}

export const SNOW_NORTH_MIN_SIZE: Readonly<Record<SnowNorthStyle, { w: number; h: number }>> = {
  village: { w: 44, h: 34 }, lake: { w: 40, h: 30 }, cave: { w: 36, h: 28 }, market: { w: 40, h: 30 },
  cabin: { w: 12, h: 10 }, longhall: { w: 20, h: 12 }, tavern: { w: 16, h: 12 }, sauna: { w: 11, h: 9 }, "ice-cave": { w: 18, h: 12 },
};

const BUILDING_NAME: Readonly<Record<string, string>> = {
  "sn-cabin-s": "작은 통나무 오두막", "sn-cabin-m": "통나무 오두막", "sn-cabin-l": "큰 통나무 집", "sn-cabin-turf": "뗏장 지붕 오두막",
  "sn-longhouse": "씨족 긴 집", "sn-meadhall": "벌꿀술 회관", "sn-stave-church": "통널 교회", "sn-sauna": "사우나", "sn-smokehouse": "훈제막",
  "sn-fishing-hut": "얼음 낚시 오두막", "sn-ice-house": "얼음집", "sn-watchtower": "망루", "sn-storehouse": "다리 창고", "sn-mill": "물레방아간",
  "sn-barn": "헛간", "sn-smithy": "대장간", "sn-palisade-gate": "목책 문", "sn-ice-cave": "얼음 동굴", "sn-frozen-falls": "얼어붙은 폭포",
};
/** 굴뚝·연기 창 칸 x(건물 왼쪽 기준) — 연기(sn-smoke 1×2)는 건물 맨 윗줄 바로 위 두 칸에 놓는다. */
const SMOKE_X: Readonly<Record<string, number>> = {
  "sn-cabin-s": 2, "sn-cabin-m": 3, "sn-cabin-l": 0, "sn-cabin-turf": 0, "sn-longhouse": 3, "sn-meadhall": 5, "sn-sauna": 2, "sn-smokehouse": 1,
  "sn-fishing-hut": 1, "sn-mill": 1, "sn-smithy": 3,
};

// ───────────────────────── 난수·잡음 ─────────────────────────
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
  const gx = Math.floor(x / g), gy = Math.floor(y / g), fx = (x - gx * g) / g, fy = (y - gy * g) / g;
  const a = hash2(gx, gy, s), b = hash2(gx + 1, gy, s), c = hash2(gx, gy + 1, s), d = hash2(gx + 1, gy + 1, s);
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}
function shuffle<T>(rng: () => number, xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
function pick<T>(rng: () => number, xs: readonly T[]): T { return xs[Math.floor(rng() * xs.length)]!; }

// ───────────────────────── 땅 ─────────────────────────
/** 오토타일 땅(47 모양). 나머지 땅 이름은 'snow' 이거나 낱칸 조각(tile:<조각>). */
const AUTOTILE_GROUND = new Set(["pack", "ice", "tundra", "frost", "slush", "water"]);
const DIRS = { N: 1, E: 2, S: 4, W: 8, NE: 16, SE: 32, SW: 64, NW: 128 } as const;

type Use = "open" | "wild" | "forest" | "path" | "plaza" | "market" | "yard" | "pen" | "shore" | "ice" | "water" | "camp" | "rock"
  | "bld" | "prop" | "fence" | "floor" | "wall" | "ceil";
interface Rect { x: number; y: number; w: number; h: number }
const SOLID_USES: readonly Use[] = ["bld", "prop", "fence", "wall", "ceil"];
/** 걸어 다니는 땅(소품이 기본으로 놓일 수 있는 곳). */
const OPEN_USES: readonly Use[] = ["open", "wild", "forest", "yard", "shore", "camp", "rock"];

class Board {
  readonly upper: number[];
  readonly lowerFix: number[];
  readonly ground: string[];
  readonly use: Use[];
  readonly reserved: boolean[];
  readonly buildings: SnowNorthBuilding[] = [];
  readonly props: { kit: string; x: number; y: number }[] = [];
  readonly zones: SnowNorthResult["zones"] = [];
  readonly notes: string[] = [];
  start: SnowNorthCell | null = null;
  private readonly rep = new Map<string, number>();
  constructor(readonly W: number, readonly H: number, readonly pal: SnowNorthPalette, readonly seed: number, ground: string, use: Use) {
    const n = W * H;
    this.upper = new Array(n).fill(-1);
    this.lowerFix = new Array(n).fill(-1);
    this.ground = new Array(n).fill(ground);
    this.use = new Array(n).fill(use);
    this.reserved = new Array(n).fill(false);
  }
  in(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
  k(x: number, y: number): number { return y * this.W + x; }
  /** 땅 이름의 대표 칸(통행 판정용). */
  repTile(g: string): number {
    let t = this.rep.get(g);
    if (t === undefined) {
      t = AUTOTILE_GROUND.has(g) ? this.pal.autotile(g, 255) : this.pal.tile(g.startsWith("tile:") ? g.slice(5) : g);
      if (t < 0) throw new Error(`설원 칩셋에 바닥 ${g} 이 없다`);
      this.rep.set(g, t);
    }
    return t;
  }
  lowerAt(k: number): number { return this.lowerFix[k]! >= 0 ? this.lowerFix[k]! : this.repTile(this.ground[k]!); }
  walk(x: number, y: number): boolean {
    if (!this.in(x, y)) return false;
    const k = this.k(x, y);
    return this.pal.walk(this.lowerAt(k), this.upper[k]!);
  }
  has(kitId: string): boolean { return !!this.pal.kit(kitId); }
  kitSize(id: string): { w: number; h: number } {
    const k = this.pal.kit(id);
    if (!k) throw new Error(`설원 칩셋에 키트 ${id} 가 없다`);
    return { w: k.width, h: k.height };
  }
  zone(name: string, use: string, r: Rect): void { this.zones.push({ name, use, rect: { ...r } }); }
  /** 땅 칠(건물·소품·담 칸은 건너뛴다). only 를 주면 그 용도 칸만. */
  paint(g: string, r: Rect, use: Use | null, only?: readonly Use[]): void {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) this.paintCell(g, x, y, use, only);
  }
  paintCell(g: string, x: number, y: number, use: Use | null, only?: readonly Use[]): void {
    if (!this.in(x, y)) return;
    const k = this.k(x, y);
    if (SOLID_USES.includes(this.use[k]!)) return;
    if (only && !only.includes(this.use[k]!)) return;
    this.ground[k] = g; if (use) this.use[k] = use;
  }
  /** 일그러진 타원 덩이. */
  blob(g: string, cx: number, cy: number, rx: number, ry: number, wob: number, use: Use | null, only?: readonly Use[], salt = 0): Set<number> {
    const out = new Set<number>();
    for (let y = Math.floor(cy - ry - 2); y <= Math.ceil(cy + ry + 2); y++) for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x++) {
      if (!this.in(x, y)) continue;
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      const n = (vnoise(x + 100, y + 100, 3, this.seed + salt) - 0.5) * 2 * wob;
      if (dx * dx + dy * dy <= 1 + n) {
        const k = this.k(x, y);
        if (SOLID_USES.includes(this.use[k]!) || (only && !only.includes(this.use[k]!))) continue;
        this.ground[k] = g; if (use) this.use[k] = use; out.add(k);
      }
    }
    return out;
  }
  reserve(r: Rect): void {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (this.in(x, y)) this.reserved[this.k(x, y)] = true;
  }
  /** 발자국 r 이 비었나: 안쪽은 allow 용도·예약 없음·위층 없음, 여백 고리에는 건물·소품·예약이 없어야 한다. grounds 를 주면 맨 아랫줄 땅이 그 안이어야 한다. */
  free(r: Rect, margin: number, allow: readonly Use[], grounds?: readonly string[], topAllow?: readonly Use[]): boolean {
    for (let y = r.y - margin; y < r.y + r.h + margin; y++) for (let x = r.x - margin; x < r.x + r.w + margin; x++) {
      const inside = x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
      if (!this.in(x, y)) { if (inside) return false; continue; }
      const k = this.k(x, y);
      if (inside) {
        if (!(topAllow && y === r.y ? topAllow : allow).includes(this.use[k]!) || this.reserved[k] || this.upper[k]! >= 0) return false;
        if (grounds && y === r.y + r.h - 1 && !grounds.includes(this.ground[k]!)) return false;
      } else if (this.use[k] === "bld" || this.use[k] === "prop" || this.reserved[k]) return false;
    }
    return true;
  }
  stamp(kitId: string, x: number, y: number, use: Use): SnowNorthKit {
    const kit = this.pal.kit(kitId);
    if (!kit) throw new Error(`설원 칩셋에 키트 ${kitId} 가 없다`);
    kit.rows.forEach((row, r) => {
      for (let c = 0; c < kit.width; c++) {
        const X = x + c, Y = y + r;
        if (!this.in(X, Y)) continue;
        const k = this.k(X, Y), lo = row.tiles[c] ?? -1, up = row.upperTiles?.[c] ?? -1;
        if (lo < 0 && up < 0) continue;
        if (lo >= 0) this.lowerFix[k] = lo;
        if (up >= 0) this.upper[k] = up;
        // ★ 칸(뒤로 지나가는 윗줄)은 땅 용도를 그대로 둔다 — 막힌 칸만 소품 용도
        if (use !== "prop" || lo >= 0 || !this.pal.walk(this.lowerAt(k), up)) this.use[k] = use;
      }
    });
    return kit;
  }
  private reach(): Set<number> {
    const s = this.start, seen = new Set<number>();
    if (!s || !this.walk(s.x, s.y)) return seen;
    seen.add(this.k(s.x, s.y));
    const q: number[] = [this.k(s.x, s.y)];
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
  /** 소품 하나: 발자국(+여백)이 비었고 바닥이 맞을 때만. 시작 칸이 정해진 뒤에는 BFS 로 «이미 닿던 칸이 끊기지 않는지» 보고 끊으면 되돌린다. */
  prop(kitId: string, x: number, y: number, margin: number, allow: readonly Use[], grounds?: readonly string[], topAllow?: readonly Use[]): boolean {
    const kit = this.pal.kit(kitId);
    if (!kit) return false;
    const r = { x, y, w: kit.width, h: kit.height };
    if (!this.free(r, margin, allow, grounds, topAllow)) return false;
    const before = this.start ? this.reach() : null;
    const saved: [number, number, number, Use][] = [];
    for (let yy = y; yy < y + kit.height; yy++) for (let xx = x; xx < x + kit.width; xx++) {
      if (!this.in(xx, yy)) continue;
      const k = this.k(xx, yy); saved.push([k, this.lowerFix[k]!, this.upper[k]!, this.use[k]!]);
    }
    this.stamp(kitId, x, y, "prop");
    if (before) {
      const after = this.reach();
      for (const k of before) {
        if (!after.has(k) && this.walk(k % this.W, Math.floor(k / this.W))) {
          for (const [kk, lo, up, u] of saved) { this.lowerFix[kk] = lo; this.upper[kk] = up; this.use[kk] = u; }
          return false;
        }
      }
    }
    this.props.push({ kit: kitId, x, y });
    return true;
  }
  propNear(kitId: string, spots: readonly [number, number][], margin: number, allow: readonly Use[], grounds?: readonly string[]): boolean {
    for (const [x, y] of spots) if (this.prop(kitId, x, y, margin, allow, grounds)) return true;
    return false;
  }
  /** 사각형 안 가운데에서 가까운 빈 자리부터 하나씩(한 덩이로). */
  cluster(r: Rect, kits: readonly string[], allow: readonly Use[], margin = 0, grounds?: readonly string[]): number {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2; let n = 0;
    for (const kit of kits) {
      if (!this.has(kit)) continue;
      const s = this.kitSize(kit), spots: [number, number][] = [];
      for (let y = r.y; y + s.h <= r.y + r.h; y++) for (let x = r.x; x + s.w <= r.x + r.w; x++) spots.push([x, y]);
      spots.sort((a, c) => Math.hypot(a[0] + s.w / 2 - cx, a[1] + s.h / 2 - cy) - Math.hypot(c[0] + s.w / 2 - cx, c[1] + s.h / 2 - cy));
      if (this.propNear(kit, spots, margin, allow, grounds)) n++;
    }
    return n;
  }
  /** 건물: 문 칸 = 맨 아랫줄 entrance, 접근칸 = 그 바로 아래(다진 눈 길로 칠하고 아래 두 칸 예약). */
  building(kitId: string, x: number, y: number, pathGround = "pack", under = "snow"): SnowNorthBuilding {
    const kit = this.pal.kit(kitId)!;
    // 건물 밑 땅은 눈밭(가장자리 모양 칸이 지붕 밑에 끼지 않게)
    for (let yy = y; yy < y + kit.height; yy++) for (let xx = x; xx < x + kit.width; xx++) if (this.in(xx, yy)) this.ground[this.k(xx, yy)] = under;
    this.stamp(kitId, x, y, "bld");
    const doors: SnowNorthCell[] = [], access: SnowNorthCell[] = [];
    if (kit.door) for (let i = 0; i < kit.door.w; i++) {
      const d = { x: x + kit.door.dx + i, y: y + kit.height - 1 };
      doors.push(d); access.push({ x: d.x, y: d.y + 1 });
    }
    for (const a of access) { this.paintCell(pathGround, a.x, a.y, "path"); this.reserve({ x: a.x, y: a.y, w: 1, h: 2 }); }
    const b = { name: BUILDING_NAME[kitId] ?? kitId, kit: kitId, rect: { x, y, w: kit.width, h: kit.height }, doors, access };
    this.buildings.push(b);
    // 굴뚝 연기(건물 위 두 칸) — 그 칸이 비었을 때만
    const sx = SMOKE_X[kitId];
    if (sx !== undefined && y >= 2 && this.has("sn-smoke")) {
      const r = { x: x + sx, y: y - 2, w: 1, h: 2 };
      if (this.free(r, 0, [...OPEN_USES, "path", "plaza", "market", "pen", "ice"])) { this.stamp("sn-smoke", r.x, r.y, "prop"); this.reserve(r); }
    }
    return b;
  }
  /** 건물을 놓을 수 있나(발자국 + 여백 1 + 문 앞 두 칸이 걷는 땅). */
  canBuild(kitId: string, x: number, y: number, allow: readonly Use[] = OPEN_USES): boolean {
    if (!this.has(kitId)) return false;
    const kit = this.pal.kit(kitId)!;
    if (!this.free({ x, y, w: kit.width, h: kit.height }, 1, allow)) return false;
    if (kit.door) for (let i = 0; i < kit.door.w; i++) for (const dy of [1, 2]) {
      const X = x + kit.door.dx + i, Y = y + kit.height - 1 + dy;
      if (!this.in(X, Y) || SOLID_USES.includes(this.use[this.k(X, Y)]!) || this.ground[this.k(X, Y)] === "water") return false;
    }
    return true;
  }
  /** 다진 눈 길: (x0,y0)→(x1,y1) 꺾인 선(가로 먼저 또는 세로 먼저 — 막히지 않는 쪽). 굵기 w. 건물·소품을 지나면 실패. */
  road(x0: number, y0: number, x1: number, y1: number, w = 1, g = "pack"): boolean {
    const tryPath = (hFirst: boolean): SnowNorthCell[] | null => {
      const cells: SnowNorthCell[] = [];
      const add = (x: number, y: number) => { for (let i = 0; i < w; i++) for (let j = 0; j < w; j++) cells.push({ x: x + i, y: y + j }); };
      if (hFirst) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) add(x, y0); for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) add(x1, y); }
      else { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) add(x0, y); for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) add(x, y1); }
      for (const c of cells) {
        if (!this.in(c.x, c.y)) return null;
        const k = this.k(c.x, c.y);
        if (SOLID_USES.includes(this.use[k]!) || this.ground[k] === "water") return null;
      }
      return cells;
    };
    const cells = tryPath(true) ?? tryPath(false);
    if (!cells) return false;
    for (const c of cells) { const k = this.k(c.x, c.y); if (this.use[k] !== "plaza" && this.use[k] !== "market") { this.ground[k] = g === "pack" && this.ground[k] === "ice" ? "ice" : g; this.use[k] = "path"; } }
    return true;
  }
  /** 두 칸 사이 걷는 땅 BFS 길(다진 눈 2칸 폭으로 넓힌다 — 넓힐 자리가 막히면 1칸). 얼음 위는 얼음 그대로. */
  roadTo(from: SnowNorthCell, to: SnowNorthCell, wide = true): boolean {
    const W = this.W, s = this.k(from.x, from.y), goal = this.k(to.x, to.y), prev = new Map<number, number>([[s, -1]]);
    const q = [s];
    for (let qi = 0; qi < q.length && !prev.has(goal); qi++) {
      const k = q[qi]!, x = k % W, y = (k - x) / W;
      const dirs = Math.abs(to.x - x) > Math.abs(to.y - y) ? [[Math.sign(to.x - x) || 1, 0], [0, Math.sign(to.y - y) || 1], [0, -(Math.sign(to.y - y) || 1)], [-(Math.sign(to.x - x) || 1), 0]] : [[0, Math.sign(to.y - y) || 1], [Math.sign(to.x - x) || 1, 0], [-(Math.sign(to.x - x) || 1), 0], [0, -(Math.sign(to.y - y) || 1)]];
      for (const [dx, dy] of dirs) {
        const nx = x + dx!, ny = y + dy!, nk = ny * W + nx;
        if (!this.in(nx, ny) || prev.has(nk) || SOLID_USES.includes(this.use[nk]!) || this.ground[nk] === "water" || this.upper[nk]! >= 0) continue;
        prev.set(nk, k); q.push(nk);
      }
    }
    if (!prev.has(goal)) return false;
    for (let k = goal; k >= 0; k = prev.get(k)!) {
      const x = k % W, y = (k - x) / W;
      for (const [dx, dy] of wide ? [[0, 0], [1, 0]] : [[0, 0]]) {
        const X = x + dx!, Y = y + dy!, kk = Y * W + X;
        if (!this.in(X, Y) || SOLID_USES.includes(this.use[kk]!) || this.upper[kk]! >= 0 || this.ground[kk] === "water") continue;
        if (this.ground[kk] !== "ice") this.ground[kk] = "pack";
        if (this.use[kk] !== "plaza" && this.use[kk] !== "market") this.use[kk] = "path";
      }
    }
    return true;
  }
  /** 문 접근칸 → 가장 가까운 길/광장 칸까지 BFS(걷는 땅만)로 길을 낸다. */
  connect(from: SnowNorthCell, targets: readonly Use[] = ["path", "plaza", "market"]): boolean {
    const W = this.W, prev = new Map<number, number>(), s = this.k(from.x, from.y);
    const q = [s]; prev.set(s, -1);
    let hit = -1;
    for (let qi = 0; qi < q.length; qi++) {
      const k = q[qi]!, x = k % W, y = (k - x) / W;
      if (k !== s && targets.includes(this.use[k]!)) { hit = k; break; }
      for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy, nk = ny * W + nx;
        if (!this.in(nx, ny) || prev.has(nk)) continue;
        if (SOLID_USES.includes(this.use[nk]!) || this.ground[nk] === "water" || (this.reserved[nk] && !targets.includes(this.use[nk]!) && this.use[nk] !== "path")) continue;
        prev.set(nk, k); q.push(nk);
      }
    }
    if (hit < 0) return false;
    for (let k = prev.get(hit)!; k >= 0 && k !== s; k = prev.get(k)!) { if (this.ground[k] !== "ice") this.ground[k] = "pack"; this.use[k] = "path"; }
    return true;
  }

  /** 덩이 다듬기: 오토타일 땅(다진 눈 길 제외)에서 같은 땅 이웃이 둘 미만인 칸(1칸 가시)은 걷어 내고, 같은 땅으로 셋 이상 둘러싸인 눈밭 칸(홈)은 메운다. */
  smooth(grounds: readonly string[] = ["tundra", "frost", "slush", "ice"], passes = 2): void {
    for (let p = 0; p < passes; p++) {
      const next = [...this.ground];
      for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
        const k = this.k(x, y), g = this.ground[k]!;
        if (SOLID_USES.includes(this.use[k]!) || this.use[k] === "path" || this.reserved[k] || this.upper[k]! >= 0) continue;
        const nb = (gg: string) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => { const X = x + dx!, Y = y + dy!; return this.in(X, Y) && (this.ground[this.k(X, Y)] === gg || (gg === "ice" && this.ground[this.k(X, Y)] === "water")); }).length;
        if (grounds.includes(g) && nb(g) < 2) { next[k] = "snow"; if (this.use[k] === "ice") this.use[k] = "shore"; }
        else if (g === "snow") for (const gg of grounds) if (nb(gg) >= 3) { next[k] = gg; if (gg === "ice") this.use[k] = "ice"; break; }
      }
      for (let i = 0; i < next.length; i++) this.ground[i] = next[i]!;
    }
  }

  // ── 마무리: 땅 → 칸 ──
  resolve(): number[] {
    const out = new Array<number>(this.W * this.H);
    const same = (g: string, x: number, y: number): boolean => {
      if (!this.in(x, y)) return true;                         // 맵 밖은 이어진 이웃(맵 가장자리에 둑을 만들지 않는다)
      const h = this.ground[this.k(x, y)]!;
      return h === g || (g === "ice" && h === "water");
    };
    const snowAlt = ["snow-b", "snow-c", "snow-d"].map((p) => this.pal.tile(p)).filter((t) => t >= 0);
    const snow = this.pal.tile("snow");
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      const k = this.k(x, y);
      if (this.lowerFix[k]! >= 0) { out[k] = this.lowerFix[k]!; continue; }
      const g = this.ground[k]!;
      if (AUTOTILE_GROUND.has(g)) {
        let m = 0;
        if (same(g, x, y - 1)) m |= DIRS.N;
        if (same(g, x + 1, y)) m |= DIRS.E;
        if (same(g, x, y + 1)) m |= DIRS.S;
        if (same(g, x - 1, y)) m |= DIRS.W;
        if (same(g, x + 1, y - 1)) m |= DIRS.NE;
        if (same(g, x + 1, y + 1)) m |= DIRS.SE;
        if (same(g, x - 1, y + 1)) m |= DIRS.SW;
        if (same(g, x - 1, y - 1)) m |= DIRS.NW;
        let t = this.pal.autotile(g, m);
        if (m === 255) {
          const bs = this.pal.bodies(g);
          if (bs.length > 1 && hash2(x, y, this.seed + 5) < 0.24) t = bs[1 + Math.floor(hash2(x, y, this.seed + 6) * (bs.length - 1))]!;
        }
        out[k] = t >= 0 ? t : snow;
      } else if (g === "snow") {
        // 눈밭 변주: 큰 덩이 잡음으로만(자잘한 점 금지). 그늘 눈(snow-shade)은 낱칸이라 네모가 드러나 쓰지 않는다(자체 검수).
        const n = vnoise(x + 7, y + 7, 5, this.seed + 17);
        // 변주는 덩이 안에서도 칸마다 섞는다 — 한 덩이를 한 변주로 채우면 같은 점박이 띠가 생겼다(적대 검수 V6).
        out[k] = n > 0.7 && snowAlt.length && hash2(x, y, this.seed + 29) < 0.55 ? snowAlt[Math.floor(hash2(x, y, this.seed + 31) * snowAlt.length) % snowAlt.length]! : snow;
      } else out[k] = this.repTile(g);
    }
    return out;
  }
}

// ───────────────────────── 공통 조각 ─────────────────────────
const TREE_GROUNDS = ["snow", "tundra", "frost"];
const XS = (a: number, b: number): number[] => { const o: number[] = []; for (let i = a; i <= b; i++) o.push(i); return o; };

/** 숲 덩이: 사각형 안을 가문비(크고 작은)·자작으로 빽빽하되 틈 있게 채운다. 겹치지 않고 여백 0. */
function grove(b: Board, rng: () => number, r: Rect, density = 0.55, birch = 0.15): number {
  let n = 0;
  const spots = shuffle(rng, XS(r.x, r.x + r.w - 1).flatMap((x) => XS(r.y, r.y + r.h - 1).map((y) => [x, y] as [number, number])));
  for (const [x, y] of spots) {
    if (rng() > density) continue;
    const roll = rng();
    const kit = roll < birch ? pick(rng, ["sn-birch", "sn-birch-s"]) : roll < 0.45 ? "sn-pine-l" : roll < 0.7 ? "sn-pine-m" : roll < 0.82 ? "sn-pine-pair" : "sn-pine-s";
    if (!b.has(kit)) continue;
    const s = b.kitSize(kit);
    if (y + s.h > r.y + r.h || x + s.w > r.x + r.w) continue;
    if (b.prop(kit, x, y, 0, ["forest", "wild", "open", "rock"], TREE_GROUNDS)) n++;
  }
  return n;
}
/** 빈 눈밭 깨기: 무작위 자리의 창(win×win)이 걷는 눈밭뿐이고 아무것도 없으면 그 자리에 작은 덩이 하나(가문비·자작·바위·덤불·눈더미 섞어서, 같은 짜임 반복 금지).
 *  격자로 훑으면 같은 덩이가 줄지어 보였다(자체 검수) — 자리는 무작위, 덩이끼리 win 칸 이상 띄운다. */
function breakEmpty(b: Board, rng: () => number, win = 6, allow: readonly Use[] = ["open", "wild", "forest"], cap = 99): number {
  const made: [number, number][] = [];
  const kinds: string[][] = [
    ["sn-pine-m", "sn-pine-s", "sn-bush"], ["sn-boulder-l", "sn-boulder-s", "sn-bush"], ["sn-drift", "sn-bush"], ["sn-birch", "sn-bush", "sn-boulder-s"],
    ["sn-pine-l", "sn-pine-s"], ["sn-drift", "sn-stump", "sn-boulder-s"], ["sn-birch-s", "sn-birch", "sn-bush"], ["sn-pine-pair", "sn-bush"],
  ];
  let last = -1;
  const spots = shuffle(rng, XS(1, b.H - win - 1).flatMap((y) => XS(1, b.W - win - 1).map((x) => [x, y] as [number, number])));
  for (const [x0, y0] of spots) {
    if (made.length >= cap) break;
    if (made.some(([mx, my]) => Math.abs(mx - x0) < win && Math.abs(my - y0) < win)) continue;
    let empty = true;
    for (let y = y0; y < y0 + win && empty; y++) for (let x = x0; x < x0 + win && empty; x++) {
      const k = b.k(x, y);
      if (!allow.includes(b.use[k]!) || b.upper[k]! >= 0 || b.reserved[k] || b.ground[k] !== "snow") empty = false;
    }
    if (!empty) continue;
    let kind = Math.floor(rng() * kinds.length); if (kind === last) kind = (kind + 1) % kinds.length; last = kind;
    const ox = Math.floor(rng() * 2), oy = Math.floor(rng() * 2);
    const r = { x: x0 + ox, y: y0 + oy, w: win - 2, h: win - 2 };
    if (rng() < 0.15) b.blob("frost", x0 + win / 2, y0 + win / 2, win / 2 - 1, win / 2 - 1.5, 0.25, null, allow, x0 * 7 + y0);
    b.cluster(r, kinds[kind]!, allow, 0, TREE_GROUNDS);
    made.push([x0, y0]);
  }
  return made.length;
}
/**
 * 빈 마당에 쓰임 주기: 무작위 자리의 7×5 창이 통째로 빈 눈밭이면 이야기 있는 작은 마당 하나를 짓는다(사냥꾼 가죽 말리는 터 · 나무꾼 터 · 짐 부리는 터 ·
 * 생선 말리는 터 · 돌무더기 고갯마루 · 자작 숲 · 가문비 숲). 덩이끼리는 창 크기만큼 띄우고, 구역 이름을 남긴다(빈 땅마다 쓰임 — 적대 검수 규칙).
 */
function vignettes(b: Board, rng: () => number, allow: readonly Use[], cap: number, region?: Rect): number {
  // 일터 마당(work)은 밟힌 땅(다진 눈·진창)을 깔고 가까운 길에 잇는다 — 맨 눈밭 위 상자 무더기는 «흩어진 쓰레기»로 읽혔다(적대 검수 V2·C6).
  const V: { name: string; use: string; kits: string[]; trees?: boolean; patch?: string; work?: boolean }[] = [
    { name: "가죽 말리는 터", use: "사냥꾼 작업터", kits: ["sn-hide-rack", "sn-chopping-block", "sn-logs", "sn-stump"], patch: "pack", work: true },
    { name: "나무꾼 터", use: "장작 패기", kits: ["sn-woodpile", "sn-chopping-block", "sn-sled-wood", "sn-stump", "sn-logs"], patch: "pack", work: true },
    { name: "짐 부리는 터", use: "썰매 짐·상자", kits: ["sn-sled", "sn-crates", "sn-barrels", "sn-sacks"], patch: "pack", work: true },
    { name: "생선 말리는 터", use: "덕장·통", kits: ["sn-fish-rack", "sn-barrel", "sn-barrel", "sn-sacks"], patch: "pack", work: true },
    { name: "돌무더기 고갯마루", use: "이정 돌·새김 돌", kits: ["sn-rune-stone", "sn-cairn", "sn-boulder-l", "sn-boulder-s", "sn-bush"], patch: "frost" },
    { name: "자작 숲", use: "잎 진 자작 덩이", kits: ["sn-birch", "sn-birch-s", "sn-birch", "sn-bush", "sn-boulder-s"], trees: true },
    { name: "가문비 숲", use: "가문비 덩이", kits: ["sn-pine-l", "sn-pine-m", "sn-pine-s", "sn-pine-m", "sn-bush"], trees: true },
    { name: "눈 덮인 바위밭", use: "바위·눈더미", kits: ["sn-boulder-l", "sn-drift", "sn-boulder-s", "sn-bush"], patch: "tundra" },
  ];
  const R = region ?? { x: 1, y: 1, w: b.W - 2, h: b.H - 2 };
  const ww = 6, hh = 4, made: Rect[] = [];
  const order = shuffle(rng, V.map((_, i) => i));
  let vi = 0;
  for (const [x0, y0] of shuffle(rng, XS(R.x, R.x + R.w - ww).flatMap((x) => XS(R.y, R.y + R.h - hh).map((y) => [x, y] as [number, number])))) {
    if (made.length >= cap) break;
    if (made.some((m) => Math.abs(m.x - x0) < ww + 1 && Math.abs(m.y - y0) < hh + 1)) continue;
    let empty = true;
    for (let y = y0 - 1; y < y0 + hh + 1 && empty; y++) for (let x = x0 - 1; x < x0 + ww + 1 && empty; x++) {
      if (!b.in(x, y)) { empty = false; break; }
      const k = b.k(x, y);
      if (!allow.includes(b.use[k]!) || b.upper[k]! >= 0 || b.reserved[k] || (b.ground[k] !== "snow" && b.ground[k] !== "frost")) empty = false;
    }
    if (!empty) continue;
    const v = V[order[vi % order.length]!]!; vi++;
    const r = { x: x0, y: y0, w: ww, h: hh };
    if (v.patch) b.blob(v.patch, x0 + ww / 2, y0 + hh / 2, ww / 2 - 0.3, hh / 2 - 0.3, 0.25, v.work ? "yard" : null, allow, x0 * 13 + y0);
    const n = b.cluster(r, v.kits, v.work ? [...allow, "yard"] : allow, 0, v.trees ? TREE_GROUNDS : undefined);
    if (n >= 2) {
      b.zone(v.name, v.use, r); made.push(r);
      if (v.work) { const ex = x0 + Math.floor(ww / 2), ey = y0 + hh; if (b.in(ex, ey) && b.walk(ex, ey)) b.connect({ x: ex, y: ey }); }
    }
  }
  return made.length;
}

/** 툰드라·서리 풀 덩이를 들판(wild) 여기저기 — 넓은 흰 판을 깬다. */
function wildPatches(b: Board, rng: () => number, n: number, r: Rect, allowTundra = true): void {
  // 마을·장터 안의 툰드라(갈색) 덩이는 «파헤친 무덤·밭»으로 읽혔다(적대 검수 V3·M2) — 숲가·들판에만 둔다.
  for (let i = 0; i < n; i++) {
    const cx = r.x + 2 + rng() * (r.w - 4), cy = r.y + 2 + rng() * (r.h - 4);
    const tundra = allowTundra && rng() < 0.3;
    b.blob(tundra ? "tundra" : "frost", cx, cy, (tundra ? 1.6 : 2.2) + rng() * 1.6, 1.4 + rng() * 1.1, 0.25, null, ["wild", "open", "forest"], i * 31);
  }
}
/** 얼음 호수: 얼음 덩이 + 열린 물 구멍(2×2 이상) + 물가 용도. 반환: 얼음 칸 집합. */
function lake(b: Board, cx: number, cy: number, rx: number, ry: number, holes: number, rng: () => number, salt = 0): Set<number> {
  const ice = b.blob("ice", cx, cy, rx, ry, rx < 6 ? 0.4 : 0.22, "ice", ["open", "wild", "forest", "shore"], salt);
  // 열린 물: 얼음 속(가장자리에서 2칸 이상 안쪽)에 2×2~3×2 구멍
  const deep = [...ice].filter((k) => { const x = k % b.W, y = (k - x) / b.W; for (let dy = -2; dy <= 4; dy++) for (let dx = -2; dx <= 4; dx++) if (!ice.has(b.k(x + dx, y + dy))) return false; return true; });
  for (let i = 0, tries = 0; i < holes && tries < 40 && deep.length; tries++) {
    // 구멍은 2×2 — 1칸·2×1 구멍은 둑 모양이 안 서서 얼음 위 검은 네모 틈으로 읽혔다(적대 검수 L1).
    const k = pick(rng, deep), x = k % b.W, y = (k - x) / b.W, w = 2;
    let ok = true;
    for (let dy = -3; dy <= 4 && ok; dy++) for (let dx = -3; dx <= w + 2 && ok; dx++) if (b.ground[b.k(x + dx, y + dy)] === "water") ok = false;
    if (!ok) continue;
    b.paint("water", { x, y, w, h: 2 }, "water"); i++;
  }
  // 물가: 얼음 둘레 한 칸 눈밭
  for (const k of ice) {
    const x = k % b.W, y = (k - x) / b.W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const X = x + dx, Y = y + dy;
      if (b.in(X, Y) && b.ground[b.k(X, Y)] === "snow" && OPEN_USES.includes(b.use[b.k(X, Y)]!)) b.use[b.k(X, Y)] = "shore";
    }
  }
  return ice;
}
/** 물가 소품: 갈대(얼음가 눈) 덩이·자작 몇·바위. */
function shoreline(b: Board, rng: () => number, n: number): void {
  const shore: [number, number][] = [];
  for (let y = 0; y < b.H; y++) for (let x = 0; x < b.W; x++) if (b.use[b.k(x, y)] === "shore") shore.push([x, y]);
  let reeds = 0;
  for (const [x, y] of shuffle(rng, shore)) {
    if (reeds >= n) break;
    // 갈대는 덩이로 — 옆 칸에 나란히 두면 물가를 따라 줄지어 «울타리»처럼 보였다(적대 검수 V1·L5).
    if (shore.length && reeds && rng() < 0.4) continue;
    if (b.prop("sn-reeds", x, y, 0, ["shore"])) { reeds++; if (rng() < 0.5) b.propNear("sn-reeds", shuffle(rng, [[x + 1, y + 1], [x - 1, y + 1], [x, y + 1]] as [number, number][]), 0, ["shore"]); }
  }
  let k = 0;
  for (const [x, y] of shuffle(rng, shore)) { if (k >= Math.ceil(n / 3)) break; if (b.prop(pick(rng, ["sn-birch-s", "sn-boulder-s", "sn-bush"]), x, y - 2 < 0 ? y : y, 0, ["shore", "wild", "open"], TREE_GROUNDS)) k++; }
}
/** 오두막 곁 살림: 옆벽에 장작더미, 문 옆에 스키 통·통, 뒤뜰에 썰매. */
function homestead(b: Board, rng: () => number, h: SnowNorthBuilding): void {
  const { x, y, w, h: hh } = h.rect;
  const left = rng() < 0.5;
  const side: [number, number][] = left ? [[x - 3, y + hh - 2], [x - 3, y + hh - 3]] : [[x + w + 1, y + hh - 2], [x + w + 1, y + hh - 3]];
  b.propNear("sn-woodpile", side, 0, OPEN_USES);
  const door = h.doors[0];
  if (door) {
    const nx = rng() < 0.5 ? -1 : 1;
    const by = y + hh;      // 문 줄 바로 아래(접근칸 줄)
    b.propNear(pick(rng, ["sn-barrel", "sn-logs", "sn-chopping-block", "sn-water-barrel"]), [[door.x + nx * 2, by], [door.x - nx * 2, by]], 0, [...OPEN_USES, "path"]);
  }
  if (rng() < 0.5) b.propNear(pick(rng, ["sn-sled", "sn-sled-wood"]), left ? [[x + w + 1, y + hh], [x + w + 1, y + hh + 1]] : [[x - 3, y + hh], [x - 3, y + hh + 1]], 0, OPEN_USES);
}

// ───────────────────────── 눈 마을 ─────────────────────────
function composeVillage(b: Board, rng: () => number): SnowNorthCell {
  const { W, H } = b;
  // 1) 북쪽 숲 띠(가장자리 흔들림) + 동서 숲 가장자리
  const fh = 5 + Math.floor(rng() * 2);
  for (let x = 0; x < W; x++) { const e = fh + Math.round((vnoise(x, 0, 5, b.seed + 3) - 0.5) * 3); for (let y = 0; y <= e; y++) b.use[b.k(x, y)] = "forest"; }
  b.zone("북쪽 가문비 숲", "마을을 감싸는 숲(땔감·사냥)", { x: 0, y: 0, w: W, h: fh + 1 });
  // 2) 목책: 남쪽 줄(가운데 문) + 동서 세로 줄 — 숲 끝에서 남쪽 줄까지
  const py = H - 5, gx = Math.floor(W / 2) - 2;
  const px0 = 2, px1 = W - 3;
  for (let y = fh + 2; y < py; y++) for (const x of [px0, px1]) if (b.has("sn-palisade-v")) { b.stamp("sn-palisade-v", x, y, "fence"); }
  for (let x = px0; x <= px1; x++) {
    if (x >= gx && x < gx + 4) continue;
    if (b.has("sn-palisade")) b.stamp("sn-palisade", x, py - 1, "fence");
  }
  b.building("sn-palisade-gate", gx, py - 3);
  // 목책 문 칸: 가운데 두 칸은 지나간다 — 길로 칠한다
  for (let y = py - 3; y <= py; y++) for (const x of [gx + 1, gx + 2]) { b.ground[b.k(x, y)] = "pack"; if (b.use[b.k(x, y)] !== "bld") b.use[b.k(x, y)] = "path"; }
  // 3) 광장(다진 눈) — 마을 가운데보다 조금 북쪽
  const ix0 = px0 + 2, ix1 = px1 - 2, iy0 = fh + 2, iy1 = py - 2;
  const pw = 12 + Math.floor(rng() * 3), ph = 6;
  const plaza = { x: Math.floor(W / 2) - Math.floor(pw / 2), y: Math.floor((iy0 + iy1) / 2) - 1, w: pw, h: ph };
  b.paint("pack", plaza, "plaza");
  b.zone("마을 광장", "모닥불·우물 둘레 모임터", plaza);
  // 큰 길: 광장 아래 → 목책 문(2칸 폭) → 맵 남쪽 끝
  b.paint("pack", { x: gx + 1, y: plaza.y + plaza.h, w: 2, h: H - plaza.y - plaza.h }, "path");
  b.zone("마을 큰길", "목책 문에서 광장까지", { x: gx + 1, y: plaza.y + plaza.h, w: 2, h: H - plaza.y - plaza.h });
  // 4) 회관(광장 북쪽, 문이 광장으로)
  const hall = pick(rng, ["sn-meadhall", "sn-longhouse"]);
  const hs = b.kitSize(hall);
  const hx = Math.floor(W / 2) - Math.floor(hs.w / 2), hy = plaza.y - hs.h;
  if (hy >= iy0 - 1 && b.canBuild(hall, hx, hy, [...OPEN_USES, "forest"])) b.building(hall, hx, hy);
  // 5) 집: 광장 서쪽·동쪽 줄 + 남쪽 마당 줄
  const homes = shuffle(rng, ["sn-cabin-s", "sn-cabin-m", "sn-cabin-l", "sn-cabin-turf", "sn-cabin-m", "sn-cabin-s"]);
  const specials = shuffle(rng, ["sn-smithy", "sn-storehouse", "sn-sauna", "sn-smokehouse"]);
  const placed: SnowNorthBuilding[] = [];
  const tryBuild = (id: string, xs: readonly number[], ys: readonly number[]): SnowNorthBuilding | null => {
    for (const y of ys) for (const x of xs) if (b.canBuild(id, x, y)) return b.building(id, x, y);
    return null;
  };
  // 서쪽·동쪽 북줄(회관 양옆 숲 아래)
  for (const side of [-1, 1]) {
    const id = homes.pop()!; const s = b.kitSize(id);
    const xs = side < 0 ? XS(ix0, plaza.x - s.w - 2).reverse() : XS(plaza.x + plaza.w + 2, ix1 - s.w + 1);
    const r = tryBuild(id, xs, [iy0, iy0 + 1]); if (r) placed.push(r);
  }
  // 서쪽·동쪽 남줄(광장 높이 아래)
  for (const side of [-1, 1]) for (let i = 0; i < 2; i++) {
    const id = i === 0 ? homes.pop()! : specials.pop()!; if (!id) continue;
    const s = b.kitSize(id);
    const xs = side < 0 ? XS(ix0, gx - s.w - 2) : XS(gx + 6, ix1 - s.w + 1).reverse();
    const ys = XS(plaza.y + 1, py - s.h - 3);
    const r = tryBuild(id, i === 0 ? xs : [...xs].reverse(), ys); if (r) placed.push(r);
  }
  // 6) 문 → 길 잇기
  for (const bl of b.buildings) for (const a of bl.access) b.connect(a);
  // 7) 연못(남은 사분면 하나) + 헛간 우리(다른 쪽)
  const start = { x: gx + 1, y: H - 1 };
  // 빈자리 찾기: 사분면마다 열린 칸 수
  const quads: Rect[] = [{ x: ix0, y: plaza.y + plaza.h + 1, w: gx - ix0 - 1, h: py - plaza.y - plaza.h - 3 }, { x: gx + 4, y: plaza.y + plaza.h + 1, w: ix1 - gx - 3, h: py - plaza.y - plaza.h - 3 }];
  const freeIn = (r: Rect) => { let n = 0; for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (b.in(x, y) && OPEN_USES.includes(b.use[b.k(x, y)]!) && !b.reserved[b.k(x, y)]) n++; return n; };
  quads.sort((p, q) => freeIn(q) - freeIn(p));
  const pondQ = quads[0]!;
  if (pondQ.w >= 6 && pondQ.h >= 5) {
    const cx = pondQ.x + pondQ.w / 2, cy = pondQ.y + pondQ.h / 2;
    lake(b, cx, cy, Math.min(5, pondQ.w / 2 - 1), Math.min(3, pondQ.h / 2 - 0.5), 1, rng, 5);
    b.zone("얼어붙은 연못", "얼음 낚시·물 긷기", { x: Math.floor(cx - 5), y: Math.floor(cy - 3), w: 10, h: 6 });
  }
  // 헛간과 울타리 친 우리(남은 사분면): 우리 안은 진창·툰드라 마당, 여물통·건초
  if (b.has("sn-barn")) {
    const bs = b.kitSize("sn-barn"), pw = 6, ph = 5;
    let barn: SnowNorthBuilding | null = null;
    // 헛간 + 옆 우리(6×5)가 함께 들어갈 자리 — 광장에서 먼 곳부터
    const cands: [number, number, boolean][] = [];
    for (let y = iy0; y <= iy1 - bs.h - 2; y++) for (let x = ix0; x <= ix1 - bs.w; x++) for (const left of [true, false]) cands.push([x, y, left]);
    cands.sort((p, q) => Math.hypot(q[0] - W / 2, q[1] - plaza.y) - Math.hypot(p[0] - W / 2, p[1] - plaza.y));
    let left = true;
    for (const [x, y, l] of cands) {
      const pr = { x: l ? x - pw - 1 : x + bs.w + 1, y: y + bs.h - ph, w: pw, h: ph };
      if (pr.x < ix0 - 1 || pr.x + pw > ix1 + 2) continue;
      if (b.canBuild("sn-barn", x, y) && b.free(pr, 0, OPEN_USES)) { barn = b.building("sn-barn", x, y); left = l; break; }
    }
    if (barn) {
      for (const a of barn.access) b.connect(a);
      // 우리: 헛간 옆 사각 울타리
      const pr = { x: left ? barn.rect.x - pw - 1 : barn.rect.x + barn.rect.w + 1, y: barn.rect.y + barn.rect.h - ph, w: pw, h: ph };
      if (b.free(pr, 0, OPEN_USES)) {
        b.blob("slush", pr.x + pw / 2, pr.y + ph / 2, 2, 1.4, 0.2, "pen", OPEN_USES, 13);
        for (let y = pr.y + 1; y < pr.y + ph - 1; y++) for (let x = pr.x + 1; x < pr.x + pw - 1; x++) if (b.use[b.k(x, y)] !== "pen") b.use[b.k(x, y)] = "pen";
        const gateX = pr.x + Math.floor(pw / 2);
        for (let x = pr.x; x < pr.x + pw; x++) { b.stamp("sn-fence", x, pr.y, "fence"); if (x !== gateX) b.stamp("sn-fence", x, pr.y + ph - 1, "fence"); }
        for (let y = pr.y + 1; y < pr.y + ph - 1; y++) for (const x of [pr.x, pr.x + pw - 1]) b.stamp("sn-fence-v", x, y, "fence");
        b.paintCell("pack", gateX, pr.y + ph - 1, "path"); b.reserve({ x: gateX, y: pr.y + ph - 2, w: 1, h: 3 });
        b.zone("가축 우리", "헛간 곁 울타리 마당(여물통·건초)", pr);
        b.connect({ x: gateX, y: pr.y + ph - 1 });
      }
    }
  }
  b.start = start;
  // 8) 광장 소품: 가운데 모닥불 또는 우물, 모퉁이 불바구니 기둥, 장작 의자
  const pcx = plaza.x + Math.floor(plaza.w / 2) - 1, pcy = plaza.y + 3;
  const centre = rng() < 0.5 ? "sn-bonfire" : "sn-well";
  // 가운데(회관 문 앞 두 칸은 비운다) — 막히면 왼쪽·오른쪽으로 비켜 선다
  b.propNear(centre, [[pcx, pcy], [pcx - 3, pcy], [pcx + 3, pcy], [pcx - 4, pcy - 1], [pcx + 4, pcy - 1]], 1, ["plaza"]);
  if (centre === "sn-bonfire") b.propNear("sn-well", [[plaza.x + 2, plaza.y + 1], [plaza.x + plaza.w - 4, plaza.y + 1]], 1, ["plaza"]);
  for (const [x, y] of [[plaza.x, plaza.y], [plaza.x + plaza.w - 1, plaza.y]] as [number, number][]) b.propNear("sn-lamp-post", [[x, y], [x, y + 1]], 0, ["plaza"]);
  b.propNear("sn-brazier", [[plaza.x + 1, plaza.y + plaza.h - 2], [plaza.x + 2, plaza.y + plaza.h - 2]], 1, ["plaza"]);
  b.propNear("sn-brazier", [[plaza.x + plaza.w - 2, plaza.y + plaza.h - 2], [plaza.x + plaza.w - 3, plaza.y + plaza.h - 2]], 1, ["plaza"]);
  const fire = b.props.find((p) => p.kit === "sn-bonfire");
  if (fire) for (const [x, y] of [[fire.x - 2, fire.y + 1], [fire.x + 3, fire.y + 1]] as [number, number][]) b.propNear("sn-logs", [[x, y], [x, y - 1]], 0, ["plaza"]);
  b.propNear("sn-signpost", [[gx - 1, plaza.y + plaza.h + 1], [gx + 3, plaza.y + plaza.h + 1]], 0, OPEN_USES);
  // 9) 집 살림·특수 건물 소품
  for (const h of b.buildings) {
    if (/cabin/.test(h.kit)) homestead(b, rng, h);
    if (h.kit === "sn-smithy") { b.propNear("sn-anvil", [[h.rect.x + h.rect.w + 1, h.rect.y + h.rect.h - 1], [h.rect.x - 2, h.rect.y + h.rect.h - 1]], 0, OPEN_USES); b.propNear("sn-water-barrel", [[h.rect.x - 2, h.rect.y + h.rect.h], [h.rect.x + h.rect.w + 1, h.rect.y + h.rect.h]], 0, OPEN_USES); }
    if (h.kit === "sn-storehouse") b.cluster({ x: h.rect.x - 3, y: h.rect.y + h.rect.h - 2, w: 3, h: 3 }, ["sn-crates", "sn-sacks", "sn-barrel"], OPEN_USES);
    if (h.kit === "sn-smokehouse") b.propNear("sn-fish-rack", [[h.rect.x + h.rect.w + 1, h.rect.y + 1], [h.rect.x - 3, h.rect.y + 1]], 0, OPEN_USES);
    if (h.kit === "sn-sauna") b.propNear("sn-water-barrel", [[h.rect.x + h.rect.w, h.rect.y + h.rect.h], [h.rect.x - 1, h.rect.y + h.rect.h]], 0, OPEN_USES);
  }
  // 10) 연못 소품: 낚시 자리(얼음) · 갈대 물가
  b.cluster({ x: 0, y: 0, w: W, h: H }, ["sn-fishing-spot"], ["ice"], 1, ["ice"]);
  shoreline(b, rng, 4);
  b.cluster({ x: 0, y: 0, w: W, h: H }, ["sn-trough", "sn-hay", "sn-hay"], ["pen"], 0);
  // 11) 숲·빈 땅
  wildPatches(b, rng, 2, { x: ix0, y: iy0, w: ix1 - ix0, h: iy1 - iy0 }, false);
  grove(b, rng, { x: 0, y: 0, w: W, h: fh + 1 }, 0.6, 0.1);
  // 목책 밖 남쪽 띠: 눈더미·덤불·어린 가문비(길은 비운다)
  // 목책 밖 남쪽 띠는 숲 덩이로 — 덤불 몇 개만 두면 빈 띠로 남았다(적대 검수 V7).
  grove(b, rng, { x: 0, y: py + 1, w: gx - 1, h: H - py - 1 }, 0.35, 0.2);
  grove(b, rng, { x: gx + 5, y: py + 1, w: W - gx - 5, h: H - py - 1 }, 0.35, 0.2);
  // 목책 안 동서 가장자리 띠(목책과 집 사이)
  vignettes(b, rng, OPEN_USES, 6);
  breakEmpty(b, rng, 5);
  b.zone("집 마당", "오두막 둘레 장작·썰매·스키", { x: ix0, y: iy0, w: ix1 - ix0, h: iy1 - iy0 });
  return start;
}

// ───────────────────────── 얼어붙은 호수 낚시터 ─────────────────────────
function composeLake(b: Board, rng: () => number): SnowNorthCell {
  const { W, H } = b;
  // 숲 테두리(북·동·서) — 남쪽은 들어오는 눈길
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = Math.min(x, W - 1 - x, y) + (vnoise(x, y, 4, b.seed + 9) - 0.5) * 3;
    if (d < 3) b.use[b.k(x, y)] = "forest";
  }
  // 호수: 가운데에서 약간 북쪽, 큰 덩이 + 물 구멍
  const cx = W / 2 + (rng() - 0.5) * 4, cy = H * 0.4, rx = W * 0.25, ry = H * 0.23;
  lake(b, cx, cy, rx, ry, 3, rng, 1);
  b.zone("얼어붙은 호수", "얼음 낚시터(구멍·낚시 오두막)", { x: Math.floor(cx - rx), y: Math.floor(cy - ry), w: Math.ceil(rx * 2), h: Math.ceil(ry * 2) });
  // 들어오는 길: 남쪽 끝 → 호숫가
  const sx = Math.floor(W / 2) + Math.floor((rng() - 0.5) * 6);
  const start = { x: sx, y: H - 1 };
  // 호숫가 남쪽 가장 가까운 얼음 칸
  let shoreY = H - 1;
  for (let y = H - 1; y > 0; y--) if (b.ground[b.k(sx, y)] === "ice") { shoreY = y + 1; break; }
  b.paint("pack", { x: sx, y: shoreY, w: 2, h: H - shoreY }, "path");
  // 물가 마을: 길 서쪽에 오두막, 동쪽에 훈제막 + 덕장, 길 끝에 배
  const yy = Math.min(H - 6, shoreY + 2);
  const lots: [string, number[]][] = [["sn-cabin-m", XS(3, sx - 6).reverse()], ["sn-smokehouse", XS(sx + 4, W - 6)], ["sn-cabin-s", XS(sx + 8, W - 6)]];
  for (const [id, xs] of lots) {
    if (!b.has(id)) continue;
    const s = b.kitSize(id);
    let ok = false;
    for (const y of XS(yy - 1, H - s.h - 3)) { for (const x of xs) if (b.canBuild(id, x, y)) { b.building(id, x, y); ok = true; break; } if (ok) break; }
  }
  // 낚시 오두막(얼음 위) 둘 — 문 앞도 얼음
  const iceCells: [number, number][] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (b.ground[b.k(x, y)] === "ice") iceCells.push([x, y]);
  let huts = 0;
  for (const [x, y] of shuffle(rng, iceCells)) {
    if (huts >= 2) break;
    if (!b.has("sn-fishing-hut")) break;
    const ok = (() => { for (let dy = 0; dy < 5; dy++) for (let dx = -1; dx < 3; dx++) { const X = x + dx, Y = y + dy; if (!b.in(X, Y) || b.ground[b.k(X, Y)] !== "ice") return false; } return true; })();
    if (!ok || !b.canBuild("sn-fishing-hut", x, y, ["ice"])) continue;
    const h = b.building("sn-fishing-hut", x, y, "ice", "ice");
    for (const a of h.access) b.use[b.k(a.x, a.y)] = "ice";
    huts++;
  }
  b.start = start;
  for (const bl of b.buildings) for (const a of bl.access) if (b.ground[b.k(a.x, a.y)] !== "ice") b.connect(a);
  // 얼음 위 낚시 자리 3~5(서로 2칸 이상), 물 구멍 곁
  // 낚시 자리는 물 구멍 바로 곁에만 — 아무 얼음에 흩으면 같은 소품이 격자처럼 늘어섰다(적대 검수 L2).
  let spots = 0;
  const holes: [number, number][] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (b.ground[b.k(x, y)] === "water" && b.ground[b.k(x - 1, y)] !== "water" && b.ground[b.k(x, y - 1)] !== "water") holes.push([x, y]);
  for (const [hx, hy] of shuffle(rng, holes)) { if (spots >= 3) break; if (b.propNear("sn-fishing-spot", shuffle(rng, [[hx - 2, hy + 1], [hx + 2, hy + 1], [hx, hy + 2], [hx, hy - 1]] as [number, number][]), 1, ["ice"], ["ice"])) spots++; }
  b.zone("낚시 자리", "얼음 구멍 낚시", { x: Math.floor(cx - rx * 0.7), y: Math.floor(cy - ry * 0.7), w: Math.ceil(rx * 1.4), h: Math.ceil(ry * 1.4) });
  // 물가: 배(눈밭, 물가와 평행), 썰매, 장작, 덕장
  for (const bl of b.buildings) {
    if (bl.kit === "sn-smokehouse") b.propNear("sn-fish-rack", [[bl.rect.x + bl.rect.w + 1, bl.rect.y + 1], [bl.rect.x - 3, bl.rect.y + 1]], 0, OPEN_USES);
    if (/cabin/.test(bl.kit)) homestead(b, rng, bl);
  }
  const shore: [number, number][] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (b.use[b.k(x, y)] === "shore") shore.push([x, y]);
  for (const [x, y] of shuffle(rng, shore)) if (b.prop("sn-boat", x, y, 0, ["shore", "open", "wild"])) break;
  b.cluster({ x: sx - 4, y: shoreY, w: 3, h: 3 }, ["sn-sled", "sn-barrel"], OPEN_USES);
  shoreline(b, rng, 7);
  wildPatches(b, rng, 4, { x: 2, y: 2, w: W - 4, h: H - 4 });
  grove(b, rng, { x: 0, y: 0, w: W, h: H }, 0.5, 0.25);
  vignettes(b, rng, OPEN_USES, 6);
  breakEmpty(b, rng, 5);
  b.zone("물가 마을", "어부 오두막·훈제막·덕장", { x: 2, y: shoreY, w: W - 4, h: H - shoreY });
  return start;
}

// ───────────────────────── 얼음 동굴 입구 ─────────────────────────
function composeCave(b: Board, rng: () => number): SnowNorthCell {
  const { W, H } = b;
  // 북쪽 바위 능선: 큰 바위·가문비로 막힌 띠(동굴·폭포가 그 속에 박힌다)
  const ridge = 7;
  for (let y = 0; y < ridge + 2; y++) for (let x = 0; x < W; x++) b.use[b.k(x, y)] = "rock";
  const cs = b.kitSize("sn-ice-cave"), cx = Math.floor(W / 2) - Math.floor(cs.w / 2) + Math.floor((rng() - 0.5) * 6);
  const cy = ridge - cs.h + 2;
  b.building("sn-ice-cave", cx, cy);
  b.zone("얼음 동굴 입구", "동굴로 들어가는 문(안은 실내 style ice-cave)", { x: cx, y: cy, w: cs.w, h: cs.h });
  // 얼어붙은 폭포(동굴 옆) + 그 밑에서 남쪽으로 흐르는 언 개울
  let fallX = -1;
  if (b.has("sn-frozen-falls")) {
    const fs = b.kitSize("sn-frozen-falls");
    for (const x of shuffle(rng, [cx - fs.w - 3, cx + cs.w + 3])) if (x >= 1 && x + fs.w < W - 1 && b.free({ x, y: ridge + 1 - fs.h, w: fs.w, h: fs.h }, 1, ["rock"])) { b.stamp("sn-frozen-falls", x, ridge + 1 - fs.h, "bld"); fallX = x; break; }
  }
  if (fallX >= 0) {
    // 개울: 폭포 밑에서 남서/남동으로 구불구불
    let x = fallX + 1;
    for (let y = ridge + 1; y < H - 3; y++) {
      if (y > ridge + 2) x += Math.round((vnoise(0, y, 4, b.seed + 77) - 0.5) * 2);
      x = Math.max(2, Math.min(W - 4, x));
      b.paint("ice", { x, y, w: 2 + (y > H / 2 ? 1 : 0), h: 1 }, "ice", ["open", "wild", "forest", "rock"]);
    }
    b.blob("ice", x + 1, H - 4, 4, 2.2, 0.2, "ice", ["open", "wild", "forest"], 3);
    b.paint("water", { x: x + 1, y: H - 4, w: 1, h: 1 }, "water");
    b.zone("언 개울", "폭포에서 흘러내린 얼음 개울과 웅덩이", { x: x - 3, y: ridge + 2, w: 8, h: H - ridge - 3 });
  }
  // 능선 채우기: 큰 바위·가문비(동굴·폭포 둘레)
  for (let x = 0; x < W; x += 2) {
    const kit = rng() < 0.45 ? "sn-boulder-l" : rng() < 0.7 ? "sn-pine-l" : "sn-pine-pair";
    const s = b.has(kit) ? b.kitSize(kit) : { w: 2, h: 2 };
    b.propNear(kit, [[x, ridge + 2 - s.h], [x, ridge + 1 - s.h], [x, ridge - s.h]], 0, ["rock"], TREE_GROUNDS);
  }
  grove(b, rng, { x: 0, y: 0, w: W, h: ridge }, 0.8, 0.05);
  // 동굴 앞 길 → 남쪽 야영지 → 맵 남쪽 끝
  const cave = b.buildings[0]!;
  const ax = cave.access[0]!.x;
  const sx = Math.max(2, Math.min(W - 4, ax + Math.floor((rng() - 0.5) * 8)));
  const start = { x: sx, y: H - 1 };
  if (!b.roadTo(cave.access[0]!, start)) b.notes.push("동굴 앞 길을 다 잇지 못했다");
  b.zone("동굴 앞 길", "야영지에서 동굴까지", { x: Math.min(ax, sx), y: ridge + 1, w: Math.abs(ax - sx) + 2, h: H - ridge - 1 });
  // 야영지: 길 옆 천막·모닥불·썰매·장작·가마솥
  // 야영지: 길 바로 옆(개울 반대쪽) — 길과 떨어진 야영지는 «외딴 덩이»로 읽혔다(자체 검수)
  const cyRow = Math.floor(H * 0.55);
  let roadX = sx;
  for (let x = 0; x < W; x++) if (b.use[b.k(x, cyRow)] === "path") { roadX = x; break; }
  const iceLeft = fallX >= 0 && fallX < roadX;
  const camp = { x: iceLeft ? roadX + 3 : Math.max(2, roadX - 12), y: cyRow - 2, w: 10, h: 7 };
  b.blob("slush", camp.x + 5, camp.y + 4, 2.2, 1.2, 0.2, "camp", ["open", "wild"], 9);
  for (let y = camp.y; y < camp.y + camp.h; y++) for (let x = camp.x; x < camp.x + camp.w; x++) if (b.in(x, y) && OPEN_USES.includes(b.use[b.k(x, y)]!) && b.use[b.k(x, y)] !== "rock") b.use[b.k(x, y)] = "camp";
  b.zone("사냥꾼 야영지", "천막·모닥불·썰매", camp);
  b.start = start;
  if (b.has("sn-tent") && b.canBuild("sn-tent", camp.x + 1, camp.y, ["camp"])) b.building("sn-tent", camp.x + 1, camp.y);
  else if (b.has("sn-tent")) for (const x of XS(camp.x, camp.x + camp.w - 2)) if (b.canBuild("sn-tent", x, camp.y + 1, ["camp"])) { b.building("sn-tent", x, camp.y + 1); break; }
  for (const bl of b.buildings) for (const a of bl.access) b.connect(a);
  b.cluster({ x: camp.x + 4, y: camp.y + 2, w: 5, h: 4 }, ["sn-bonfire"], ["camp", "path"], 1);
  b.cluster({ x: camp.x, y: camp.y + 3, w: camp.w, h: 4 }, ["sn-sled-wood", "sn-woodpile", "sn-cauldron", "sn-hide-rack"], ["camp"], 0);
  b.cluster({ x: 0, y: 0, w: W, h: H }, ["sn-fishing-spot"], ["ice"], 1, ["ice"]);
  shoreline(b, rng, 5);
  wildPatches(b, rng, 2, { x: 2, y: ridge + 2, w: W - 4, h: H - ridge - 4 });
  // 남쪽 들: 가문비 덩이 몇 + 바위
  grove(b, rng, { x: 0, y: H - 6, w: Math.max(4, sx - 3), h: 6 }, 0.45, 0.25);
  grove(b, rng, { x: sx + 4, y: H - 6, w: W - sx - 4, h: 6 }, 0.45, 0.25);
  vignettes(b, rng, OPEN_USES, 6);
  breakEmpty(b, rng, 5);
  return start;
}

// ───────────────────────── 북방 장터 ─────────────────────────
function composeMarket(b: Board, rng: () => number): SnowNorthCell {
  const { W, H } = b;
  const fh = 4;
  for (let x = 0; x < W; x++) { const e = fh + Math.round((vnoise(x, 0, 5, b.seed + 3) - 0.5) * 2); for (let y = 0; y <= e; y++) b.use[b.k(x, y)] = "forest"; }
  // 북쪽 건물 줄: 회관 가운데 + 창고·대장간·선술집 대신 큰 집
  const row = ["sn-storehouse", "sn-meadhall", "sn-smithy"];
  const mid = Math.floor(W / 2);
  const hs = b.kitSize("sn-meadhall");
  const by = fh + 2;
  const mx = mid - Math.floor(hs.w / 2);
  b.building("sn-meadhall", mx, by);
  const baseY = by + hs.h - 1;
  for (const [id, side] of [[row[0]!, -1], [row[2]!, 1]] as [string, number][]) {
    const s = b.kitSize(id); const y = baseY - s.h + 1;
    const xs = side < 0 ? XS(2, mx - s.w - 2).reverse() : XS(mx + hs.w + 2, W - s.w - 2);
    for (const x of xs) if (b.canBuild(id, x, y, [...OPEN_USES, "forest"])) { b.building(id, x, y); break; }
  }
  // 장터 마당(다진 눈) — 건물 줄 아래 넓게
  const mk = { x: 4, y: baseY + 2, w: W - 8, h: Math.min(12, H - baseY - 7) };
  b.paint("pack", mk, "market");
  b.zone("장터", "노점 줄·우물·모닥불", mk);
  // 장터 → 남쪽 길
  const gx = mid - 1;
  b.paint("pack", { x: gx, y: mk.y + mk.h, w: 2, h: H - mk.y - mk.h }, "path");
  const start = { x: gx, y: H - 1 };
  for (const bl of b.buildings) for (const a of bl.access) b.connect(a, ["market", "path"]);
  b.start = start;
  // 노점 두 줄(서·동), 노점 앞 1칸 손님 자리, 뒤에 통·상자
  const stalls = shuffle(rng, ["sn-stall-fish", "sn-stall-fur", "sn-stall-wares", "sn-stall-fish", "sn-stall-wares", "sn-stall-fur"]);
  const rowsY = [mk.y + 2, mk.y + mk.h - 4];
  let si = 0;
  // 줄을 엇갈린다: 칸마다 한두 칸 띄움·위아래 한 칸 흔들림·가끔 빈 자리 — 좌우 거울 격자는 «주차장»처럼 읽혔다(적대 검수 M1).
  for (const y of rowsY) {
    for (let x = mk.x + 1 + Math.floor(rng() * 2); x + 3 <= mk.x + mk.w - 1; x += 4 + (rng() < 0.4 ? 1 : 0)) {
      if (x <= gx + 2 && x + 3 >= gx - 1) continue;           // 가운데 길 비움
      if (rng() < 0.2) continue;
      const id = stalls[si % stalls.length]!;
      const yy = y + (rng() < 0.5 ? 0 : y === rowsY[0] ? 1 : -1);
      if (b.prop(id, x, yy, 0, ["market"])) { si++; b.reserve({ x, y: yy + 2, w: 3, h: 1 }); }
    }
  }
  // 가운데: 우물 + 모닥불, 모퉁이 불바구니 기둥
  b.propNear("sn-well", [[gx - 4, mk.y + Math.floor(mk.h / 2) - 1], [gx + 4, mk.y + Math.floor(mk.h / 2) - 1]], 1, ["market"]);
  b.propNear("sn-bonfire", [[gx + 4, mk.y + Math.floor(mk.h / 2) - 1], [gx - 5, mk.y + Math.floor(mk.h / 2) - 1]], 1, ["market"]);
  for (const [x, y] of [[mk.x, mk.y], [mk.x + mk.w - 1, mk.y], [mk.x, mk.y + mk.h - 2], [mk.x + mk.w - 1, mk.y + mk.h - 2]] as [number, number][]) b.propNear("sn-lamp-post", [[x, y]], 0, ["market"]);
  b.cluster({ x: mk.x, y: mk.y + 4, w: 4, h: mk.h - 6 }, ["sn-barrels", "sn-crates", "sn-sacks"], ["market"], 0);
  b.cluster({ x: mk.x + mk.w - 4, y: mk.y + 4, w: 4, h: mk.h - 6 }, ["sn-sled", "sn-barrel", "sn-sacks", "sn-cauldron"], ["market"], 0);
  for (const bl of b.buildings) {
    if (bl.kit === "sn-smithy") b.propNear("sn-anvil", [[bl.rect.x - 2, bl.rect.y + bl.rect.h - 1], [bl.rect.x + bl.rect.w + 1, bl.rect.y + bl.rect.h - 1]], 0, OPEN_USES);
    if (bl.kit === "sn-storehouse") b.cluster({ x: bl.rect.x + bl.rect.w + 1, y: bl.rect.y + bl.rect.h - 3, w: 2, h: 3 }, ["sn-crates", "sn-barrel"], OPEN_USES);
  }
  // 남쪽 들: 오두막 둘 + 썰매 길가
  for (const [id, xs] of [["sn-cabin-s", XS(2, gx - 6).reverse()], ["sn-cabin-m", XS(gx + 4, W - 7)]] as [string, number[]][]) {
    const s = b.kitSize(id);
    let done = false;
    for (const y of XS(mk.y + mk.h + 1, H - s.h - 3)) { for (const x of xs) if (b.canBuild(id, x, y)) { const h = b.building(id, x, y); b.connect(h.access[0]!, ["path", "market"]); homestead(b, rng, h); done = true; break; } if (done) break; }
  }
  grove(b, rng, { x: 0, y: 0, w: W, h: fh + 1 }, 0.6, 0.15);
  wildPatches(b, rng, 1, { x: 2, y: mk.y + mk.h, w: W - 4, h: H - mk.y - mk.h - 1 }, false);
  vignettes(b, rng, OPEN_USES, 6);
  breakEmpty(b, rng, 5);
  return start;
}

// ───────────────────────── 실내 ─────────────────────────
interface RoomLook { floor: string; wall: "log" | "plank" | "ice"; ceil: string; windows: boolean }
const ROOM_LOOK: Readonly<Record<SnowNorthRoomStyle, RoomLook>> = {
  cabin: { floor: "floor-plank", wall: "log", ceil: "ceiling", windows: true },
  longhall: { floor: "floor-plank", wall: "log", ceil: "ceiling", windows: false },
  tavern: { floor: "floor-plank", wall: "plank", ceil: "ceiling", windows: false },
  sauna: { floor: "floor-sauna", wall: "plank", ceil: "ceiling", windows: false },
  "ice-cave": { floor: "floor-ice", wall: "ice", ceil: "ceiling-ice", windows: false },
};
const ROOM_NAME: Readonly<Record<SnowNorthRoomStyle, string>> = { cabin: "통나무 오두막 안", longhall: "긴 회관 안", tavern: "선술집", sauna: "사우나 안", "ice-cave": "얼음 동굴 안" };
const TALL = /hearth|bunk-bed|keg-rack/;

/** 방 한 칸: 바깥 테두리 천장, 맨 윗줄 안쪽 두 줄 벽면(위·아래), 바닥, 맨 아래 줄 가운데 출입구 틈(2칸). 벽 장식은 벽면 두 줄에만, 가구는 바닥에만. */
function composeRoom(b: Board, rng: () => number, style: SnowNorthRoomStyle): SnowNorthCell {
  const { W, H } = b;
  const look = ROOM_LOOK[style];
  // 바깥 테두리는 전부 천장(막힘). paint 는 막힌 용도 칸을 건너뛰므로 직접 쓴다.
  for (let k = 0; k < W * H; k++) { b.ground[k] = `tile:${look.ceil}`; b.use[k] = "ceil"; }
  const fx0 = 1, fx1 = W - 2, fy0 = 3, fy1 = H - 2;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const k = b.k(x, y); b.use[k] = y <= 2 ? "wall" : "floor"; b.ground[k] = y === 1 ? `tile:wall-${look.wall}-u` : y === 2 ? `tile:wall-${look.wall}-d` : `tile:${look.floor}`; }
  if (look.windows) for (let x = fx0 + 2; x < fx1 - 1; x += 5) { b.ground[b.k(x, 1)] = "tile:wall-window-u"; b.ground[b.k(x, 2)] = "tile:wall-window-d"; }
  const ex = Math.floor(W / 2) - 1;
  for (const x of [ex, ex + 1]) { b.ground[b.k(x, H - 1)] = `tile:${look.floor}`; b.use[b.k(x, H - 1)] = "floor"; }
  b.reserve({ x: ex, y: H - 3, w: 2, h: 3 });
  b.zone(ROOM_NAME[style], style, { x: fx0, y: fy0, w: fx1 - fx0 + 1, h: fy1 - fy0 + 1 });
  const start = { x: ex, y: H - 1 };
  b.start = start;
  const wall = (kit: string, xs: readonly number[], row: "both" | "u" | "d" = "both") => {
    if (!b.has(kit)) return false;
    const s = b.kitSize(kit), y = s.h >= 2 ? 1 : row === "d" ? 2 : 1;
    for (const x of xs) {
      if (x < fx0 || x + s.w - 1 > fx1) continue;
      let ok = true;
      for (let yy = y; yy < y + s.h && ok; yy++) for (let xx = x; xx < x + s.w && ok; xx++) { const k = b.k(xx, yy); if (b.use[k] !== "wall" || b.upper[k]! >= 0 || /window/.test(b.ground[k]!)) ok = false; }
      if (ok) { b.stamp(kit, x, y, "wall"); b.props.push({ kit, x, y }); return true; }
    }
    return false;
  };
  const backWall = (kit: string, xs: readonly number[], margin = 0) => {
    if (!b.has(kit)) return false;
    const tall = TALL.test(kit), y = tall ? fy0 - 1 : fy0;
    for (const x of xs) if (b.prop(kit, x, y, margin, ["floor"], undefined, tall ? ["wall"] : undefined)) return true;
    return false;
  };
  const anywhere = (kit: string, n: number, margin = 1) => {
    if (!b.has(kit)) return 0;
    const s = b.kitSize(kit); let k = 0;
    for (const [x, y] of shuffle(rng, XS(fx0, fx1 - s.w + 1).flatMap((x) => XS(fy0 + 1, fy1 - s.h + 1).map((y) => [x, y] as [number, number])))) { if (k >= n) break; if (b.prop(kit, x, y, margin, ["floor"])) k++; }
    return k;
  };
  const corner = (kit: string) => { if (!b.has(kit)) return false; const s = b.kitSize(kit); return b.propNear(kit, shuffle(rng, [[fx0, fy1 - s.h + 1], [fx1 - s.w + 1, fy1 - s.h + 1]] as [number, number][]), 0, ["floor"]); };
  const leftFirst = rng() < 0.5;
  const sideXs = (w: number) => leftFirst ? XS(fx0, fx1 - w + 1) : XS(fx0, fx1 - w + 1).reverse();
  const cx = Math.floor((fx0 + fx1) / 2);
  switch (style) {
    case "cabin": {
      // 벽난로는 북쪽 벽 한쪽, 침대·이층 침대는 반대쪽 벽, 가운데 깔개 + 걸상, 궤짝은 모퉁이, 벽에 선반·사슴뿔·등
      backWall("sn-hearth", leftFirst ? XS(fx0 + 1, cx - 1) : XS(cx, fx1 - 2).reverse());
      backWall(pick(rng, ["sn-bunk-bed", "sn-bed-fur"]), leftFirst ? XS(cx + 1, fx1 - 1).reverse() : XS(fx0, cx - 2));
      // 식탁 + 걸상 — 탁자 없이 걸상만 벽에 붙은 방은 쓰임이 없어 보였다(적대 검수 K2). 깔개는 벽난로 앞.
      if (b.propNear("sn-long-table", [[cx - 1, fy0 + 3], [cx - 2, fy0 + 3], [cx, fy0 + 3], [cx - 1, fy0 + 2]], 0, ["floor"])) {
        const t = b.props[b.props.length - 1]!;
        b.propNear("sn-stool", [[t.x - 1, t.y + 1], [t.x - 1, t.y]], 0, ["floor"]);
        b.propNear("sn-stool", [[t.x + 3, t.y + 1], [t.x + 3, t.y]], 0, ["floor"]);
      } else anywhere("sn-stool", 2, 0);
      const hearth = b.props.find((p) => p.kit === "sn-hearth");
      if (hearth) b.propNear("sn-rug-fur", [[hearth.x, hearth.y + 2], [hearth.x + 1, hearth.y + 2]], 0, ["floor"]);
      corner("sn-chest");
      wall("sn-shelf", XS(fx0, fx1)); wall("sn-antler-mount", XS(fx0, fx1).reverse(), "u"); wall("sn-lantern", XS(fx0 + 1, fx1 - 1), "d");
      wall("sn-drying-herbs", XS(fx0, fx1).reverse());
      break;
    }
    case "longhall": {
      // 가운데 화덕 + 양옆 긴 상·긴 의자, 북벽 끝 이층 침대·궤짝, 벽에 방패·무기·오로라 깃발·등
      const mid = { x: cx - 1, y: Math.floor((fy0 + fy1) / 2) - 1 };
      b.propNear("sn-firepit", [[mid.x, mid.y], [mid.x, mid.y + 1]], 1, ["floor"]);
      const fp = b.props.find((p) => p.kit === "sn-firepit");
      for (const side of [-1, 1]) {
        const tx = fp ? (side < 0 ? fp.x - 5 : fp.x + 4) : cx + side * 4;
        if (b.propNear("sn-long-table", [[tx, (fp?.y ?? mid.y)], [tx, (fp?.y ?? mid.y) - 1]], 0, ["floor"])) {
          const t = b.props[b.props.length - 1]!;
          b.propNear("sn-bench", [[t.x, t.y - 1], [t.x + 1, t.y - 1]], 0, ["floor"]);
          b.propNear("sn-bench", [[t.x, t.y + 2], [t.x + 1, t.y + 2]], 0, ["floor"]);
        }
      }
      backWall("sn-hearth", [cx - 1, cx, cx - 2]);
      backWall("sn-bunk-bed", leftFirst ? XS(fx0, fx0 + 2) : XS(fx1 - 2, fx1 - 1).reverse());
      backWall("sn-keg-rack", leftFirst ? XS(fx1 - 2, fx1 - 1).reverse() : XS(fx0, fx0 + 2));
      wall("sn-weapon-rack", XS(fx0 + 3, cx - 3)); wall("sn-weapon-rack", XS(cx + 2, fx1 - 4).reverse());
      wall("sn-banner-aurora", XS(fx0 + 2, fx1)); wall("sn-banner-aurora-b", XS(fx0, fx1 - 2).reverse());
      wall("sn-lantern", XS(fx0, fx1), "d"); wall("sn-lantern", XS(fx0, fx1).reverse(), "d");
      corner("sn-chest");
      break;
    }
    case "tavern": {
      // 바: 북쪽 벽에서 한 칸 띄워(뒤 바텐더 통로), 앞 걸상 줄, 벽엔 술통 받침·선반, 한쪽 벽난로, 손님 상 둘
      if (b.has("sn-bar-counter")) {
        const bw = b.kitSize("sn-bar-counter").w;
        for (const x of [cx - Math.floor(bw / 2), cx - Math.floor(bw / 2) - 2, cx - Math.floor(bw / 2) + 2]) {
          if (b.prop("sn-bar-counter", x, fy0 + 1, 0, ["floor"])) { b.reserve({ x, y: fy0, w: bw, h: 1 }); for (let i = 0; i < bw; i += 2) b.prop("sn-stool", x + i, fy0 + 3, 0, ["floor"]); break; }
        }
      }
      backWall("sn-keg-rack", sideXs(2));
      backWall("sn-hearth", leftFirst ? XS(fx0, fx1).reverse() : XS(fx0, fx1));
      wall("sn-shelf", XS(fx0, fx1 - 1)); wall("sn-antler-mount", XS(fx0, fx1).reverse(), "u"); wall("sn-lantern", XS(fx0 + 2, fx1), "d");
      const n = anywhere("sn-long-table", Math.max(1, Math.floor((W * H) / 110)), 1);
      if (n) for (const p of b.props.filter((q) => q.kit === "sn-long-table")) { b.propNear("sn-bench", [[p.x, p.y + 2], [p.x + 1, p.y + 2]], 0, ["floor"]); b.propNear("sn-stool", [[p.x - 1, p.y + 1], [p.x + 3, p.y]], 0, ["floor"]); }
      corner("sn-chest");
      break;
    }
    case "sauna": {
      // 난로는 북벽 모퉁이, 두 단 의자는 반대쪽 북벽, 물동이 난로 곁, 벽에 약초 다발·등
      backWall("sn-sauna-stove", leftFirst ? XS(fx0, fx0 + 1) : XS(fx1 - 1, fx1).reverse().map((x) => x - 1));
      backWall("sn-sauna-bench", leftFirst ? XS(cx, fx1 - 2).reverse() : XS(fx0, cx - 2));
      const st = b.props.find((p) => p.kit === "sn-sauna-stove");
      if (st) b.propNear("sn-water-bucket", [[st.x + 2, st.y + 1], [st.x - 1, st.y + 1], [st.x, st.y + 2]], 0, ["floor"]);
      wall("sn-drying-herbs", XS(fx0, fx1)); wall("sn-lantern", XS(fx0, fx1).reverse(), "d");
      anywhere("sn-stool", 1, 1);
      break;
    }
    case "ice-cave": {
      // 얼음 기둥 줄(방을 둘로 나누지 않게 띄엄띄엄), 결정 무리·석순은 벽가, 얼어붙은 궤짝 하나는 안쪽 모퉁이
      const cols = Math.max(2, Math.floor((fx1 - fx0) / 6));
      for (let i = 0; i < cols; i++) { const x = fx0 + 3 + Math.floor(i * (fx1 - fx0 - 5) / Math.max(1, cols - 1)); b.propNear("sn-ice-pillar", [[x, fy0 + 2], [x + 1, fy0 + 2], [x, fy0 + 3]], 1, ["floor"]); }
      for (let i = 0; i < 4; i++) backWall(pick(rng, ["sn-ice-crystal", "sn-stalagmite-ice"]), shuffle(rng, XS(fx0, fx1)));
      for (let i = 0; i < 3; i++) b.propNear(pick(rng, ["sn-stalagmite-ice", "sn-ice-crystal"]), shuffle(rng, [[fx0, fy0 + 3 + i], [fx1, fy0 + 3 + i], [fx0, fy1 - i], [fx1, fy1 - i]] as [number, number][]), 0, ["floor"]);
      b.propNear("sn-frozen-chest", leftFirst ? [[fx1 - 1, fy0], [fx1, fy0]] : [[fx0, fy0], [fx0 + 1, fy0]], 0, ["floor"]);
      break;
    }
  }
  return start;
}

/** 한 장을 짠다. 칸이 모자라면 Error(호출자가 ToolError 로 바꾼다). */
export function composeSnowNorth(spec: SnowNorthSpec, pal: SnowNorthPalette): SnowNorthResult {
  const min = SNOW_NORTH_MIN_SIZE[spec.style];
  if (!min) throw new Error(`알 수 없는 style ${spec.style}`);
  if (spec.width < min.w || spec.height < min.h) throw new Error(`맵이 작다(${spec.width}×${spec.height}) — ${spec.style} 는 ${min.w}×${min.h} 이상이어야 한다`);
  const seed = (spec.seed ?? 0) >>> 0;
  const rng = mulberry(seed * 7919 + spec.style.length * 131);
  const indoor = (SNOW_NORTH_ROOM_STYLES as readonly string[]).includes(spec.style);
  const b = new Board(spec.width, spec.height, pal, seed, "snow", indoor ? "ceil" : "open");
  let start: SnowNorthCell;
  if (spec.style === "village") start = composeVillage(b, rng);
  else if (spec.style === "lake") start = composeLake(b, rng);
  else if (spec.style === "cave") start = composeCave(b, rng);
  else if (spec.style === "market") start = composeMarket(b, rng);
  else start = composeRoom(b, rng, spec.style as SnowNorthRoomStyle);
  if (!indoor) b.smooth();
  const lower = b.resolve();
  const exits: SnowNorthCell[] = [];
  if (indoor) { for (let x = 0; x < b.W; x++) if (b.walk(x, b.H - 1)) exits.push({ x, y: b.H - 1 }); }
  else exits.push(start);
  return { lower, upper: b.upper, buildings: b.buildings, start, exits, props: b.props, zones: b.zones, notes: b.notes };
}

/** 번들 정의(TilesetDef 모양)에서 사전을 만든다: 한 칸 바닥은 그룹 `sn:sn-<조각>`, 오토타일은 autotileGroups `sn-at-<그룹>`, 키트는 structureKits. */
export function snowNorthPaletteFromTileset(def: {
  readonly tileGroups?: readonly { readonly id: string; readonly tileIds: readonly number[] }[];
  readonly autotileGroups?: readonly { readonly id: string; readonly variantMap: Readonly<Record<string, number>>; readonly interiorVariants?: readonly (readonly number[])[] }[];
  readonly structureKits?: readonly unknown[];
  readonly passability?: readonly { readonly up?: boolean }[];
  readonly tileMeta?: readonly ({ readonly passage?: string } | null | undefined)[];
}): SnowNorthPalette {
  const groups = new Map((def.tileGroups ?? []).map((g) => [g.id, g.tileIds] as const));
  const autos = new Map((def.autotileGroups ?? []).map((g) => [g.id, g] as const));
  const kits = new Map<string, SnowNorthKit>();
  for (const raw of def.structureKits ?? []) {
    const k = raw as { id: string; width: number; height: number; rows: SnowNorthKit["rows"]; parts?: { kind: string; dx: number; w: number }[] };
    if (!k?.id || !Array.isArray(k.rows)) continue;
    const part = k.parts?.find((p) => p.kind === "entrance");
    kits.set(k.id, { id: k.id, width: k.width, height: k.height, rows: k.rows, door: part ? { dx: part.dx, w: part.w } : undefined });
  }
  const pass = def.passability ?? [], meta = def.tileMeta ?? [];
  const ok = (t: number) => t >= 0 && !!pass[t]?.up;
  return {
    tile: (piece) => groups.get(`sn:sn-${piece.replace(/^sn-/, "")}`)?.[0] ?? -1,
    autotile: (g, mask) => autos.get(`sn-at-${g}`)?.variantMap[String(mask)] ?? -1,
    bodies: (g) => autos.get(`sn-at-${g}`)?.interiorVariants?.[0] ?? [],
    kit: (id) => kits.get(id),
    walk: (lo, up) => (up >= 0 && meta[up]?.passage !== "star" ? ok(up) : ok(lo)),
  };
}
