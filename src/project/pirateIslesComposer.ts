// project/pirateIslesComposer.ts
// 열대 군도·해적 항구(pirate_isles) 맵 구성기 — 종류(kind)와 씨앗(seed)만 주면 규칙으로 맵 한 장을 짠다(sfStationComposer·jpCityStreetComposer 와 같은 생각).
// AI 는 어떤 장소인지만 고르고, 섬·해안·건물·소품 배치와 조화는 이 함수가 한다. 견본을 붙이지 않는다 — 해안선·섬 모양·건물 고르기·소품 무더기가 씨앗마다 바뀐다.
//
// 순서(모든 야외 종류 공통): ① 계획(구역 띠·건물 자리·길) → ② 땅 문자 격자(바다·얕은 물·모래·풀·길·방파제·부두·성벽) → ③ 땅 칸 칠하기(오토타일)
// → ④ 건물(문 앞 접근칸이 길에 닿게) → ⑤ 소품(맞는 땅 위·건물과 1칸 띄움·길/문 앞/부두 통로 금지·놓을 때마다 통행 검사).
// 종류
//   harbor  해적 항구 마을: 남쪽 바다 + 돌 방파제(가운데) + 양옆 모래 해변 + 판자 부두 2~3개(배 정박) + 북쪽 건물 줄·큰길·방파제 앞 창고 줄·시장 광장.
//   beach   열대 섬 해변 마을: 깊은 바다로 둘러싼 섬(모래 둘레 + 풀 안쪽) + 모래길 두 줄과 광장(모닥불·토템) + 오두막들 + 물 위 수상 가옥·부두·쪽배.
//   fort    해안 요새: 남쪽 바다·해변 위 돌 성벽(윗면 걷는 길 그림 + 앞면 두 줄) 사각 + 모퉁이 포대 + 남벽 문루(대문 안팎은 이동 이벤트로 잇는다 — 통행 검사는 portal 로 붙여 본다) + 안뜰(병영·망루·깃대·보급 마당·우물).
//   wreck   난파선과 보물 동굴 섬: 작은 섬 + 북쪽 바위 둔덕의 보물 동굴 입구 + 남쪽 해변에 박힌 난파선·흩어진 짐 + 흙길.
//   ship    배 안(실내): 뱃머리가 뾰족한 선체 — 위 줄 선장실·선원 선실·주방, 복도(위 갑판 계단), 아래 줄 선창·포 갑판(남쪽 뱃전 대포). 벽 천장 + 앞면 두 줄.
//   tavern  해적 술집 안(실내): 큰 홀(바 카운터·탁자·벽난로) + 부엌·창고.
//   hut     섬 오두막 안(실내): 작은 방 하나.
//   cave    보물 동굴 안(실내): 바위 벽 굴 + 안쪽 보물 방.
// 이 파일은 순수 함수다: GameMap·TilesetDef 를 받아 칸을 쓴다(도구 compose_pirate_isles_map 이 복제본에서 부른다).

import { setLayerTileAt, layerTileAt } from "@/project/mapLayers";
import { addMapLocation } from "@/project/mapNamedLocations";
import type { GameMap, StructureKitDef, TilesetDef } from "@/project/types";

export type PirateMapKind = "harbor" | "beach" | "fort" | "wreck" | "ship" | "tavern" | "hut" | "cave";
export const PIRATE_MAP_KINDS: readonly PirateMapKind[] = ["harbor", "beach", "fort", "wreck", "ship", "tavern", "hut", "cave"];
export const PIRATE_OUTDOOR_KINDS: readonly PirateMapKind[] = ["harbor", "beach", "fort", "wreck"];
export const PIRATE_MIN_SIZE: Readonly<Record<PirateMapKind, { w: number; h: number }>> = {
  harbor: { w: 44, h: 34 }, beach: { w: 40, h: 32 }, fort: { w: 40, h: 34 }, wreck: { w: 36, h: 30 },
  ship: { w: 30, h: 22 }, tavern: { w: 26, h: 20 }, hut: { w: 14, h: 12 }, cave: { w: 30, h: 24 },
};
export const PIRATE_DEFAULT_SIZE: Readonly<Record<PirateMapKind, { w: number; h: number }>> = {
  harbor: { w: 56, h: 40 }, beach: { w: 52, h: 40 }, fort: { w: 48, h: 40 }, wreck: { w: 46, h: 36 },
  ship: { w: 36, h: 26 }, tavern: { w: 32, h: 24 }, hut: { w: 16, h: 14 }, cave: { w: 36, h: 28 },
};

export interface PiratePlaced { readonly id: string; readonly x: number; readonly y: number }
export interface PirateArea { readonly name: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly tag: string; readonly door?: { x: number; y: number }; readonly access?: { x: number; y: number } }
export interface PirateComposeResult {
  readonly kind: PirateMapKind;
  readonly seed: number;
  readonly placed: readonly PiratePlaced[];
  readonly areas: readonly PirateArea[];
  readonly spawn: { x: number; y: number };
  readonly skipped: number;
  readonly unreachable: number;
  /** 이동 이벤트로 이을 두 칸(요새 대문 안팎) — 통행 검사가 붙여 본 쌍. */
  readonly portals: readonly (readonly [{ x: number; y: number }, { x: number; y: number }])[];
  readonly summary: string;
}

function rngOf(seed: number): () => number {
  let a = (seed * 2654435761 + 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 정수 격자 해시 → 0..1 (값 잡음용). */
function hash01(x: number, y: number, s: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** 부드러운 1차원 잡음(-1..1). */
function noise1(x: number, s: number, period = 7): number {
  const u = x / period, i = Math.floor(u), f = u - i, k = f * f * (3 - 2 * f);
  return (hash01(i, 0, s) * (1 - k) + hash01(i + 1, 0, s) * k) * 2 - 1;
}
/** 부드러운 2차원 잡음(-1..1). */
function noise2(x: number, y: number, s: number, period = 6): number {
  const u = x / period, v = y / period, i = Math.floor(u), j = Math.floor(v), fx = u - i, fy = v - j;
  const kx = fx * fx * (3 - 2 * fx), ky = fy * fy * (3 - 2 * fy);
  const a = hash01(i, j, s), b = hash01(i + 1, j, s), c = hash01(i, j + 1, s), d = hash01(i + 1, j + 1, s);
  return ((a * (1 - kx) + b * kx) * (1 - ky) + (c * (1 - kx) + d * kx) * ky) * 2 - 1;
}

// 땅 문자: ~ 깊은 바다 · w 얕은 물 · s 모래 · g 풀 · p 흙길 · v 모래길 · q 방파제 포석 · c 포석 · r 바위땅 · b 판자 부두 · F 성벽 윗면 · f 성벽 앞면
//          실내: 1 배 바닥 · 2 술집 마루 · 3 갈대 돗자리 · 4 동굴 바닥 · 5 보물 바닥 · S/T/H/C 벽 천장 · x 벽 앞면
const LAND = "sgpvqcrFfb";
/** 기물을 얹을 수 있는 땅(물·성벽·벽 천장·벽 앞면 제외). */
const GROUND_OK = "sgpvqcrbd12345";
const WATER = "~w";
const AUTO: Readonly<Record<string, { id: string; conn: string; eight: boolean }>> = {
  "~": { id: "at-deep", conn: "~", eight: true },
  s: { id: "at-beach", conn: LAND, eight: true },
  g: { id: "at-grass", conn: "gpvqcrFfb", eight: true },
  p: { id: "at-path", conn: "psvqc", eight: true },
  v: { id: "at-sandpath", conn: "vspqc", eight: true },
  q: { id: "at-quay", conn: "qcsgpvrFfb", eight: false },
  b: { id: "at-boardwalk", conn: "bqcsg", eight: false },
  F: { id: "at-fortwall", conn: "F", eight: false },
  S: { id: "at-wall-ship", conn: "S", eight: false },
  T: { id: "at-wall-tavern", conn: "T", eight: false },
  H: { id: "at-wall-hut", conn: "H", eight: false },
  C: { id: "at-wall-cave", conn: "C", eight: false },
};
const PLAIN: Readonly<Record<string, { id: string; col: number }>> = {
  w: { id: "water", col: -1 }, c: { id: "cobble", col: -1 }, r: { id: "rockfloor", col: -1 }, d: { id: "deck", col: -1 },
  "1": { id: "floor-ship", col: -1 }, "2": { id: "floor-tavern", col: -1 }, "3": { id: "floor-reed", col: 0 }, "4": { id: "floor-cave", col: 0 }, "5": { id: "floor-cave", col: 1 },
};
const FACE_OF: Readonly<Record<string, string>> = { F: "wall-face-fort", S: "wall-face-ship", T: "wall-face-tavern", H: "wall-face-hut", C: "wall-face-cave" };

/** 줄지어 되풀이해도 되는 조각(등불·계선주·대포·울타리·실내 줄 가구). */
const REPEATABLE = new Set(["lantern-post", "bollard", "pier-post", "cannon", "fence", "fence-bamboo", "palisade", "tiki-torch", "tavern-chair", "stool-int", "tavern-table-round", "tavern-table", "bunk-ship", "cargo-barrels", "bar-counter", "bar-shelf", "cannon-int", "hammock-int", "rock-pillar", "stalagmite", "torch-stand"]);
/** 물 위에만 두는 조각. */
const WATER_PIECES = new Set(["rowboat", "canoe", "fishing-boat", "galleon", "coral", "coral-purple", "rock-water", "sea-stack", "bamboo-raft", "pier-post"]);

const N = 1, E = 2, S = 4, W = 8, NE = 16, SE = 32, SW = 64, NW = 128;

type Pt = { x: number; y: number };

class Board {
  readonly w: number;
  readonly h: number;
  readonly grid: string[];
  private readonly kits = new Map<string, StructureKitDef>();
  readonly taken: boolean[];
  /** 건물 둘레 1칸(소품 금지) */
  readonly near: boolean[];
  /** 길·문 앞·부두 통로처럼 비워 둘 칸 */
  readonly clear: boolean[];
  private journal: { layer: 1 | 2 | 3; i: number; prev: number }[] | null = null;
  readonly placed: PiratePlaced[] = [];
  /** 이동 이벤트로 이어지는 두 칸(요새 대문 안팎 등) — 통행 검사에서 붙어 있다고 본다. */
  readonly portals: [Pt, Pt][] = [];
  /** 건물 키트를 고른 횟수(맵 전체) — 같은 건물이 되풀이되지 않게. */
  readonly usedBuild = new Map<string, number>();
  skipped = 0;
  readonly rng: () => number;

  constructor(readonly map: GameMap, readonly ts: TilesetDef, readonly seed: number) {
    this.w = map.width; this.h = map.height;
    for (const k of ts.structureKits ?? []) this.kits.set(k.id, k);
    this.grid = new Array<string>(this.w * this.h).fill("~");
    this.taken = new Array<boolean>(this.w * this.h).fill(false);
    this.near = new Array<boolean>(this.w * this.h).fill(false);
    this.clear = new Array<boolean>(this.w * this.h).fill(false);
    this.rng = rngOf(seed);
  }

  kit(id: string): StructureKitDef | undefined { return this.kits.get(`pi-${id}`); }
  has(id: string): boolean { return this.kits.has(`pi-${id}`); }
  idx(x: number, y: number): number { return y * this.w + x; }
  inb(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  pick<T>(xs: readonly T[]): T { return xs[Math.floor(this.rng() * xs.length)]!; }
  chance(p: number): boolean { return this.rng() < p; }
  int(lo: number, hi: number): number { return lo + Math.floor(this.rng() * (hi - lo + 1)); }
  shuffle<T>(xs: T[]): T[] { for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [xs[i], xs[j]] = [xs[j]!, xs[i]!]; } return xs; }
  kitSize(id: string): { w: number; h: number } | undefined { const k = this.kit(id); return k ? { w: k.width, h: k.height } : undefined; }

  g(x: number, y: number): string { return this.inb(x, y) ? this.grid[this.idx(x, y)]! : "~"; }
  set(x: number, y: number, c: string): void { if (this.inb(x, y)) this.grid[this.idx(x, y)] = c; }
  rect(x: number, y: number, w: number, h: number, c: string): void { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c); }

  private put(layer: 1 | 2 | 3, i: number, t: number): void {
    if (this.journal) this.journal.push({ layer, i, prev: layerTileAt(this.map, layer, i) });
    setLayerTileAt(this.map, layer, i, t);
  }
  setLower(x: number, y: number, t: number): void { if (this.inb(x, y) && t >= 0) this.put(1, this.idx(x, y), t); }

  private isFlat(t: number): boolean {
    const m = this.ts.tileMeta?.[t];
    return this.ts.priority[t] === "lower" && !!m?.locked && m.defaultLayer === "upper";
  }
  passableTile(t: number): boolean { return t < 0 || this.ts.passability[t]?.up !== false; }
  walkable(x: number, y: number): boolean {
    if (!this.inb(x, y)) return false;
    const i = this.idx(x, y);
    const lo = this.map.lowerTiles[i] ?? -1;
    if (lo < 0 || !this.passableTile(lo)) return false;
    return this.passableTile(layerTileAt(this.map, 2, i)) && this.passableTile(layerTileAt(this.map, 3, i));
  }

  /** 낱칸 바닥 키트(`pi-<id>`, 가로 변형) 칸 — col 이 없으면 0번을 주로, 가끔 다른 변형. */
  floor(id: string, col = -1): number {
    const k = this.kit(id);
    if (!k) return -1;
    const row = k.rows[0]!;
    const cells = row.tiles.map((t, c) => (t >= 0 ? t : row.upperTiles?.[c] ?? -1)).filter((t) => t >= 0);
    if (!cells.length) return -1;
    if (col >= 0) return cells[Math.min(col, cells.length - 1)]!;
    return this.chance(0.86) ? cells[0]! : this.pick(cells);
  }
  autoTile(groupId: string, mask: number): number {
    const g = (this.ts.autotileGroups ?? []).find((a) => a.id === `pi-${groupId}`);
    return g?.variantMap[String(mask)] ?? -1;
  }
  faceTile(id: string, row: number, col: number): number {
    const k = this.kit(id);
    return k?.rows[row]?.tiles[col] ?? -1;
  }

  /** 땅 문자 격자를 칸으로 칠한다(오토타일 이웃 계산 + 벽 앞면 두 줄). */
  paintGround(): void {
    const conn = (x: number, y: number, set: string) => !this.inb(x, y) || set.includes(this.g(x, y));
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const ch = this.g(x, y);
      const a = AUTO[ch];
      let t = -1;
      if (a) {
        const set = a.conn + ch;
        let m = (conn(x, y - 1, set) ? N : 0) | (conn(x + 1, y, set) ? E : 0) | (conn(x, y + 1, set) ? S : 0) | (conn(x - 1, y, set) ? W : 0);
        if (a.eight) m |= (conn(x + 1, y - 1, set) ? NE : 0) | (conn(x + 1, y + 1, set) ? SE : 0) | (conn(x - 1, y + 1, set) ? SW : 0) | (conn(x - 1, y - 1, set) ? NW : 0);
        t = this.autoTile(a.id, a.eight ? m : m & 15);
        if (m === 255 && ch === "s" && hash01(x, y, this.seed + 1) < 0.1) t = this.floor("sand", 1 + Math.floor(hash01(x, y, 2) * 2));
        if (m === 255 && ch === "g" && hash01(x, y, this.seed + 3) < 0.08) t = this.floor("grass", 1);
      } else if (PLAIN[ch]) {
        const p = PLAIN[ch]!;
        t = this.floor(p.id, p.col);
      } else if (ch === "f" || ch === "x") {
        continue;                                                    // 앞면은 아래에서
      } else t = this.floor("water", 0);
      this.setLower(x, y, t);
    }
    // 벽 천장 남쪽 가장자리 아래 두 줄 = 앞면
    for (let y = 0; y < this.h - 1; y++) for (let x = 0; x < this.w; x++) {
      const ch = this.g(x, y);
      const face = FACE_OF[ch];
      if (!face || this.g(x, y + 1) === ch) continue;
      const v = hash01(x, y, this.seed + 5) < 0.7 ? 0 : 1 + Math.floor(hash01(x, y, 6) * 3);
      for (let r = 0; r < 2; r++) if (y + 1 + r < this.h && "fx".includes(this.g(x, y + 1 + r))) this.setLower(x, y + 1 + r, this.faceTile(face, r, v));
    }
  }

  /**
   * 키트를 (x,y) 왼쪽 위에 찍는다. ground: land = 막힌 칸 밑이 걷는 땅, water = 그림 칸 밑이 모두 물, wall = 검사 없음(성벽 위·벽 앞면).
   * 위층 겹침·맵 밖이면 찍지 않는다.
   */
  stamp(id: string, x: number, y: number, ground: "land" | "water" | "wall" = "land"): boolean {
    const k = this.kit(id);
    if (!k) { this.skipped++; return false; }
    for (let r = 0; r < k.height; r++) for (let c = 0; c < k.width; c++) {
      const lo = k.rows[r]!.tiles[c] ?? -1, up = k.rows[r]!.upperTiles?.[c] ?? -1;
      if (lo < 0 && up < 0) continue;
      const X = x + c, Y = y + r;
      if (!this.inb(X, Y)) return false;
      const i = this.idx(X, Y);
      const flat = up >= 0 && this.isFlat(up);
      if (up >= 0 && this.taken[i]) return false;
      if (ground === "water" && !WATER.includes(this.g(X, Y))) return false;
      if (ground === "land") {
        if (!GROUND_OK.includes(this.g(X, Y))) return false;
        if (up >= 0 && !flat && !this.passableTile(up)) {
          const lower = this.map.lowerTiles[i] ?? -1;
          if (lower < 0 || !this.passableTile(lower)) return false;
        }
      }
    }
    for (let r = 0; r < k.height; r++) for (let c = 0; c < k.width; c++) {
      const lo = k.rows[r]!.tiles[c] ?? -1, up = k.rows[r]!.upperTiles?.[c] ?? -1;
      const i = this.idx(x + c, y + r);
      if (lo >= 0) this.put(1, i, lo);
      if (up >= 0) {
        if (this.isFlat(up)) this.put(2, i, up); else this.put(3, i, up);
        this.taken[i] = true;
      }
    }
    this.placed.push({ id, x, y });
    return true;
  }

  /** 찍은 뒤 must 칸들이 출발점에서 닿지 않으면 되돌린다. */
  stampSafe(id: string, x: number, y: number, start: Pt, must: readonly Pt[], ground: "land" | "water" | "wall" = "land"): boolean {
    const pocketsBefore = this.strandedCount(start);
    this.journal = [];
    const takenBefore = this.taken.slice();
    const ok = this.stamp(id, x, y, ground);
    const journal = this.journal;
    this.journal = null;
    if (!ok) return false;
    // 닿아야 할 칸이 모두 닿고, 새로 갇힌 걷는 칸(기물 사이 주머니)이 생기지 않아야 남긴다
    if (this.reachesAll(start, must) && this.strandedCount(start) <= pocketsBefore) return true;
    for (let j = journal.length - 1; j >= 0; j--) setLayerTileAt(this.map, journal[j]!.layer, journal[j]!.i, journal[j]!.prev);
    for (let i = 0; i < this.taken.length; i++) this.taken[i] = takenBefore[i]!;
    this.placed.pop();
    return false;
  }

  reach(start: Pt): Uint8Array {
    const seen = new Uint8Array(this.w * this.h);
    if (!this.walkable(start.x, start.y)) return seen;
    const stack = [this.idx(start.x, start.y)];
    seen[stack[0]!] = 1;
    while (stack.length) {
      const i = stack.pop()!; const x = i % this.w, y = (i - x) / this.w;
      for (const [a, c] of this.portals) for (const [p, q] of [[a, c], [c, a]] as const) {
        if (p.x !== x || p.y !== y || !this.inb(q.x, q.y)) continue;
        const j = this.idx(q.x, q.y);
        if (!seen[j] && this.walkable(q.x, q.y)) { seen[j] = 1; stack.push(j); }
      }
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        if (!this.inb(nx, ny)) continue;
        const j = this.idx(nx, ny);
        if (!seen[j] && this.walkable(nx, ny)) { seen[j] = 1; stack.push(j); }
      }
    }
    return seen;
  }
  /** 지금 닿는 칸만 남긴다 — 처음부터 막힌 칸(물가 등대 문 등)이 모든 소품 놓기를 되돌리지 않게. 닿지 않는 칸은 dropped 로. */
  prune(start: Pt, must: Pt[], dropped: Pt[] = []): Pt[] {
    const seen = this.reach(start);
    const keep: Pt[] = [];
    for (const p of must) (this.inb(p.x, p.y) && seen[this.idx(p.x, p.y)] === 1 ? keep : dropped).push(p);
    must.length = 0; must.push(...keep);
    return must;
  }
  /** 걷는 칸인데 출발점에서 닿지 않는 칸 수. */
  strandedCount(start: Pt): number {
    const seen = this.reach(start);
    let n = 0;
    for (let i = 0; i < seen.length; i++) if (!seen[i] && this.walkable(i % this.w, Math.floor(i / this.w))) n++;
    return n;
  }
  reachesAll(start: Pt, must: readonly Pt[]): boolean {
    const seen = this.reach(start);
    return must.every((p) => this.inb(p.x, p.y) && seen[this.idx(p.x, p.y)] === 1);
  }

  /** 건물 키트 둘레 1칸을 소품 금지로. */
  markNear(x: number, y: number, w: number, h: number, pad = 1): void {
    for (let yy = y - pad; yy < y + h + pad; yy++) for (let xx = x - pad; xx < x + w + pad; xx++) if (this.inb(xx, yy)) this.near[this.idx(xx, yy)] = true;
  }
  markClear(x: number, y: number, w = 1, h = 1): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (this.inb(xx, yy)) this.clear[this.idx(xx, yy)] = true;
  }
  /** 소품 자리로 쓸 수 있는가: 맞는 땅·건물 둘레 밖·비울 칸 밖·길 밖(+ 옵션 여백). */
  propFits(id: string, x: number, y: number, ground: string, pad = 0, dry = true): boolean {
    const s = this.kitSize(id); if (!s) return false;
    const outdoor = !/[12345]/.test(ground);
    if (outdoor && (x < 1 || y < 1 || x + s.w > this.w - 1 || y + s.h > this.h - 1)) return false;          // 맵 가장자리에 잘리지 않게
    // 땅 기물: 그림 칸과 그 둘레 1칸에 물이 없어야(물가에 발이 걸치지 않게). 물 기물은 반대로 둘레 1칸에 땅이 없어야.
    const wet = /[~w]/.test(ground) && !/[sg]/.test(ground);
    for (let yy = y - 1; yy <= y + s.h; yy++) for (let xx = x - 1; xx <= x + s.w; xx++) {
      if (!this.inb(xx, yy)) continue;
      const c = this.g(xx, yy);
      if (dry && outdoor && !wet && WATER.includes(c)) return false;
      if (wet && (c === "b" || GROUND_OK.includes(c))) return false;
    }
    // 같은 기물은 4칸 안에 또 두지 않는다(나란히 찍힌 쌍둥이 금지)
    for (const p of this.placed) if (p.id === id && Math.abs(p.x - x) <= 3 + s.w && Math.abs(p.y - y) <= 3 + s.h && !REPEATABLE.has(id)) return false;
    for (let yy = y - pad; yy < y + s.h + pad; yy++) for (let xx = x - pad; xx < x + s.w + pad; xx++) {
      const inside = xx >= x && xx < x + s.w && yy >= y && yy < y + s.h;
      if (!this.inb(xx, yy)) { if (inside) return false; continue; }
      const i = this.idx(xx, yy);
      if (inside) {
        if (!ground.includes(this.g(xx, yy))) return false;
        if (this.near[i] || this.clear[i] || this.taken[i]) return false;
      } else if (this.taken[i] && pad > 0) return false;
    }
    return true;
  }
}

/** 땅에서 거리 n(±잡음) 이하 물 칸을 얕은 물로 — 유클리드 거리 + 두 겹 잡음이라 띠가 계단·팔각형으로 굳지 않는다(깊은 바다 → 얕은 물 띠). */
function shallowRing(b: Board, n: number): void {
  const R = n + 3;
  const isLand = (x: number, y: number) => b.inb(x, y) && !WATER.includes(b.g(x, y)) && b.g(x, y) !== "b";
  const next = b.grid.slice();
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    if (!WATER.includes(b.g(x, y))) continue;
    let d = 99;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if (isLand(x + dx, y + dy)) d = Math.min(d, Math.hypot(dx, dy));
    const lim = n + noise2(x, y, b.seed + 21, 4) * 1.1 + noise2(x, y, b.seed + 22, 9) * 0.9;
    next[b.idx(x, y)] = d <= lim ? "w" : "~";
  }
  for (let i = 0; i < next.length; i++) b.grid[i] = next[i]!;
  // 깊은 바다 덩이 다듬기: 두께 1 깊은 물·외톨이는 얕은 물로(오토타일 덩이 모양 지키기)
  smooth(b, "~", "w", 2);
}

/** 해안 다듬기(야외 공통): 섬 안 고인 물 → 모래, 물로 튀어나온 한 칸 땅 혀 → 물, 풀 한 칸 혀 → 모래, 물에 닿은 풀 → 모래(해변 띠 보장). */
function tidyCoast(b: Board): void {
  // 바깥(맵 가장자리)과 이어지지 않은 물 = 섬 안 웅덩이 → 모래
  const seen = new Uint8Array(b.w * b.h); const st: number[] = [];
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if ((x === 0 || y === 0 || x === b.w - 1 || y === b.h - 1) && WATER.includes(b.g(x, y))) { seen[b.idx(x, y)] = 1; st.push(b.idx(x, y)); }
  while (st.length) { const i = st.pop()!; const x = i % b.w, y = (i - x) / b.w; for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) if (b.inb(nx, ny) && !seen[b.idx(nx, ny)] && WATER.includes(b.g(nx, ny))) { seen[b.idx(nx, ny)] = 1; st.push(b.idx(nx, ny)); } }
  for (let i = 0; i < b.grid.length; i++) if (WATER.includes(b.grid[i]!) && !seen[i]) b.grid[i] = "s";
  smooth(b, "sgpvqcrFf", "~", 2);                    // 물로 튀어나온 한 칸 땅(모래 혀·한 칸 섬)
  smooth(b, "g", "s", 2);                         // 모래로 튀어나온 풀 혀
  smooth(b, "s", "g", 1);                         // 풀 속 외톨이 모래
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    if (b.g(x, y) !== "g") continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (b.inb(x + dx, y + dy) && WATER.includes(b.g(x + dx, y + dy))) b.set(x, y, "s");
  }
}

/** 칸 모양 다듬기: 외톨이·한 칸 돌기(오토타일이 깨지는 모양)를 이웃 다수로. */
function smooth(b: Board, codes: string, into: string, passes = 2): void {
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
      const c = b.g(x, y); if (!codes.includes(c)) continue;
      const same = [[0, -1], [1, 0], [0, 1], [-1, 0]].filter(([dx, dy]) => codes.includes(b.g(x + dx!, y + dy!))).length;
      if (same <= 1) b.set(x, y, into);
      // 가로·세로 두께 1 띠(위아래가 모두 다르면) — 오토타일 덩이는 두께 2 이상
      else if (!codes.includes(b.g(x, y - 1)) && !codes.includes(b.g(x, y + 1))) b.set(x, y, into);
      else if (!codes.includes(b.g(x - 1, y)) && !codes.includes(b.g(x + 1, y))) b.set(x, y, into);
    }
  }
}

/** 두 점 사이 L자 길(폭 wd) 을 code 로 — 물·성벽·건물 자리는 건드리지 않는다. */
function lpath(b: Board, a: Pt, c: Pt, code: string, wd = 2, keep = "~wFfbq"): void {
  const put = (x: number, y: number) => { for (let k = 0; k < wd; k++) for (let j = 0; j < wd; j++) if (!keep.includes(b.g(x + k, y + j))) b.set(x + k, y + j, code); };
  const sx = Math.sign(c.x - a.x), sy = Math.sign(c.y - a.y);
  let x = a.x, y = a.y;
  put(x, y);
  while (y !== c.y) { y += sy; put(x, y); }
  while (x !== c.x) { x += sx; put(x, y); }
}

interface Plot { id: string; x: number; y: number; w: number; h: number; door: Pt | null; access: Pt | null; name: string; tag: string }

const NAME_KO: Readonly<Record<string, string>> = {
  tavern: "해적 술집", warehouse: "부두 창고", "harbor-office": "항만 사무소", boathouse: "배 창고", "fish-shack": "어부 오두막", smokehouse: "생선 훈제막",
  "captain-house": "선장의 집", "house-plaster": "회벽 집", cabin: "통나무 오두막", "hut-thatch": "짚 오두막", "hut-round": "둥근 오두막", "hut-palm": "야자잎 오두막",
  longhouse: "마을 긴 집", "stilt-hut": "수상 가옥", lighthouse: "등대", chapel: "바닷가 예배당", "fort-gate": "요새 문루", "fort-barracks": "요새 병영",
  "fort-bastion": "포대 탑", watchtower: "망루", "cave-entrance": "보물 동굴 입구", shipwreck: "난파선", "stall-fruit": "과일 노점", "stall-fish": "생선 노점", "stall-goods": "잡화 노점",
};

/** 건물 키트 정보(문·접근칸은 키트 parts/ai.access 에서). */
function plotOf(b: Board, id: string, x: number, y: number): Plot | null {
  const k = b.kit(id); if (!k) return null;
  const door = k.parts?.find((p) => p.kind === "entrance");
  const acc = (k.ai as { access?: { dx: number; dy: number }[] } | undefined)?.access?.[0];
  return {
    id, x, y, w: k.width, h: k.height, name: NAME_KO[id] ?? id, tag: id,
    door: door ? { x: x + door.dx, y: y + door.dy } : null,
    access: acc ? { x: x + acc.dx, y: y + acc.dy } : door ? { x: x + door.dx, y: y + door.dy + 1 } : null,
  };
}

/** 건물 줄: 발 줄(foot) 위에 왼쪽부터 늘어놓는다. 간격 1~2(나무·소품 자리). 문 앞 접근칸 목록을 돌려준다. */
function buildingRow(b: Board, ids: readonly string[], x0: number, x1: number, foot: number, topLimit: number, ground: string, plots: Plot[], gapLo = 1, gapHi = 2, skipCols: (x: number, w: number) => boolean = () => false, setback = 0): void {
  let x = x0;
  const used = b.usedBuild;
  while (x < x1) {
    const fits = ids.filter((id) => { const s = b.kitSize(id); return s && x + s.w <= x1 && foot - s.h + 1 >= topLimit && !skipCols(x, s.w); });
    if (!fits.length) { x++; continue; }
    fits.sort((a, c) => (used.get(a) ?? 0) - (used.get(c) ?? 0) || b.rng() - 0.5);
    const id = fits[0]!;
    const back = setback > 0 && foot - b.kitSize(id)!.h + 1 - setback >= topLimit ? b.int(0, setback) : 0;
    const p = plotOf(b, id, x, foot - back - b.kitSize(id)!.h + 1);
    if (!p) { x++; continue; }
    b.rect(p.x, p.y, p.w, p.h, ground);
    plots.push(p);
    used.set(id, (used.get(id) ?? 0) + 1);
    x += p.w + b.int(gapLo, gapHi);
  }
}

function stampPlots(b: Board, plots: Plot[], areas: PirateArea[], ground: "land" | "water" | "wall" = "land"): void {
  for (const p of plots) {
    if (!b.stamp(p.id, p.x, p.y, ground)) continue;
    b.markNear(p.x, p.y, p.w, p.h);
    if (p.access) b.markClear(p.access.x - 1, p.access.y, 3, 2);
    areas.push({ name: p.name, x: p.x, y: p.y, w: p.w, h: p.h, tag: p.tag, ...(p.door ? { door: p.door } : {}), ...(p.access ? { access: p.access } : {}) });
  }
}

/** 소품 무더기: 기준점 둘레에 ids 를 몇 개 모아 놓는다(흩뿌리지 않는다). */
function cluster(b: Board, ids: readonly string[], cx: number, cy: number, n: number, ground: string, start: Pt, must: Pt[], spread = 2): number {
  let k = 0;
  for (let t = 0; t < n * 10 && k < n; t++) {
    const id = ids[(k + t) % ids.length]!; const s = b.kitSize(id); if (!s) continue;
    const x = cx + b.int(-spread, spread), y = cy + b.int(-1, 1);
    if (!b.propFits(id, x, y, ground)) continue;
    if (b.stampSafe(id, x, y, start, must, WATER_PIECES.has(id) ? "water" : "land")) k++;
  }
  return k;
}

/** cluster 와 같되 기물끼리 pad 칸 띄운다(흩어진 짐·보물 표식처럼 하나하나 읽혀야 할 때). */
function clusterPad(b: Board, ids: readonly string[], cx: number, cy: number, n: number, ground: string, start: Pt, must: Pt[], spread = 2, pad = 1): number {
  let k = 0;
  for (let t = 0; t < n * 14 && k < n; t++) {
    const id = ids[(k + t) % ids.length]!; const s = b.kitSize(id); if (!s) continue;
    const x = cx + b.int(-spread, spread), y = cy + b.int(-1, 1);
    if (!b.propFits(id, x, y, ground, pad)) continue;
    if (b.stampSafe(id, x, y, start, must, WATER_PIECES.has(id) ? "water" : "land")) k++;
  }
  return k;
}

/** 나무 덩이: 기준점 둘레 반지름 3 안에 나무 n 그루(겹치지 않게, 같은 나무 연달아 금지 — REPEATABLE 아닌 것은 propFits 가 4칸 간격을 강제하므로 덩이 안에서는 직접 찍는다). */
function grove(b: Board, ids: readonly string[], cx: number, cy: number, n: number, ground: string, start: Pt, must: Pt[]): number {
  let k = 0;
  for (let t = 0; t < n * 12 && k < n; t++) {
    const id = ids[(k + t) % ids.length]!; const s = b.kitSize(id); if (!s) continue;
    const x = cx + b.int(-3, 3), y = cy + b.int(-1, 2);
    if (x < 1 || y < 0 || x + s.w > b.w - 1) continue;
    let ok = true;
    for (let yy = y; yy < y + s.h && ok; yy++) for (let xx = x; xx < x + s.w; xx++) { if (!b.inb(xx, yy)) continue; const i = b.idx(xx, yy); if (!ground.includes(b.g(xx, yy)) || b.taken[i] || b.near[i] || b.clear[i]) { ok = false; break; } }
    if (!ok) continue;
    if (b.placed.some((p) => p.id === id && Math.abs(p.x - x) < 3 && Math.abs(p.y - y) < 3)) continue;
    if (b.stampSafe(id, x, y, start, must)) k++;
  }
  return k;
}

/** 건물 옆(좌우 1칸 띄운 곳)에 소품 하나 — 자리 몇 곳을 차례로 시험. */
function beside(b: Board, a: { x: number; y: number; w: number; h: number }, ids: readonly string[], ground: string, start: Pt, must: Pt[]): boolean {
  const spots: Pt[] = [{ x: a.x + a.w + 1, y: a.y + a.h - 2 }, { x: a.x - 2, y: a.y + a.h - 2 }, { x: a.x + a.w + 1, y: a.y + a.h - 1 }, { x: a.x - 2, y: a.y + a.h - 1 }, { x: a.x + a.w + 1, y: a.y + 1 }, { x: a.x - 2, y: a.y + 1 }];
  for (const sp of b.shuffle(spots)) for (const id of b.shuffle([...ids])) {
    const s = b.kitSize(id); if (!s) continue;
    const x = sp.x < a.x ? a.x - 1 - s.w : sp.x;
    if (b.propFits(id, x, sp.y, ground) && b.stampSafe(id, x, sp.y, start, must)) return true;
  }
  return false;
}

/** 넓게 흩어 놓되 서로 pad 칸 띄운다(나무·바위·조개처럼 자연물만). */
function sprinkle(b: Board, ids: readonly string[], n: number, ground: string, area: { x: number; y: number; w: number; h: number }, start: Pt, must: Pt[], pad = 1): number {
  let k = 0;
  for (let t = 0; t < n * 14 && k < n; t++) {
    const id = b.pick(ids); const s = b.kitSize(id); if (!s) continue;
    const x = b.int(area.x, area.x + area.w - s.w), y = b.int(area.y, area.y + area.h - s.h);
    if (!b.propFits(id, x, y, ground, pad)) continue;
    if (b.stampSafe(id, x, y, start, must, WATER_PIECES.has(id) ? "water" : "land")) k++;
  }
  return k;
}

const LANDISH = "sgcrvp";

// ─────────────────────────────── 항구 마을
function composeHarbor(b: Board): { areas: PirateArea[]; spawn: Pt } {
  const { w: Wd, h: Hd } = b;
  const areas: PirateArea[] = [];
  b.grid.fill("g");
  // 해안선: 위에서 shoreY 줄까지 땅, 아래는 물. 방파제 구간(가운데)은 곧고, 양옆 해변은 물결친다.
  const shore = Math.round(Hd * 0.64) + b.int(-1, 1);
  const qx0 = Math.round(Wd * 0.2) + b.int(-2, 2), qx1 = Math.round(Wd * 0.8) + b.int(-2, 2);
  const quayTop = shore - 3;
  for (let x = 0; x < Wd; x++) {
    const inQuay = x >= qx0 && x < qx1;
    const sy = inQuay ? shore : shore + Math.round(noise1(x, b.seed, 6) * 1.6) - 1;
    for (let y = sy; y < Hd; y++) b.set(x, y, "~");
    if (!inQuay) for (let y = Math.max(0, sy - 7); y < sy; y++) if (y >= sy - 3.6 + noise2(x, y, b.seed + 9, 4) * 1.4 + noise2(x, y, b.seed + 10, 9) * 0.8) b.set(x, y, "s");
  }
  b.rect(qx0, quayTop, qx1 - qx0, shore - quayTop, "q");
  // 숲 가장자리(위 3~4줄)
  // 건물 줄: 북쪽(큰길 위) / 남쪽(방파제 앞)
  const southFoot = quayTop - 1;
  const southTop = southFoot - 5;                          // 키 6 이하
  const street = southTop - 3;                             // 큰길 두 줄 = street, street+1 (그 아래 한 줄 여유)
  const northFoot = street - 2;                            // 문 앞 접근칸 = street-1
  const northTop = Math.max(2, northFoot - 5);
  // 큰길
  for (let x = 0; x < Wd; x++) { b.set(x, street, "v"); b.set(x, street + 1, "v"); }
  // 광장(시장): 방파제 가운데 위, 남쪽 건물 줄을 끊고 큰길까지 포석
  const plazaW = 10 + b.int(0, 2);
  const plazaX = Math.round((qx0 + qx1) / 2 - plazaW / 2) + b.int(-3, 3);
  const plazaRect = { x: plazaX, y: street + 2, w: plazaW, h: quayTop - street - 2 };
  b.rect(plazaRect.x, plazaRect.y, plazaRect.w, plazaRect.h, "c");
  const plots: Plot[] = [];
  // 북쪽 줄: 술집은 꼭 하나(광장 맞은편 근처) + 선장의 집·회벽 집·통나무집·예배당
  const tavernX = Math.max(1, Math.min(Wd - 7, plazaX + Math.floor(plazaW / 2) - 3 + b.int(-2, 2)));
  const tv = plotOf(b, "tavern", tavernX, northFoot - 5);
  const northIds = ["captain-house", "house-plaster", "cabin", "chapel", "house-plaster", "hut-thatch", "fish-shack"];
  if (tv) { b.rect(tv.x, tv.y, tv.w, tv.h, "g"); plots.push(tv); }
  buildingRow(b, northIds, 1 + b.int(0, 2), tavernX - 1, northFoot, northTop - 1, "g", plots, 1, 3, () => false, 1);
  buildingRow(b, northIds.slice().reverse(), tavernX + 7, Wd - 1, northFoot, northTop - 1, "g", plots, 1, 3, () => false, 1);
  // 남쪽 줄(방파제 앞, 문이 방파제로): 창고·항만 사무소·배 창고·생선 훈제막 — 광장 칸은 비운다
  const southIds = ["warehouse", "harbor-office", "warehouse", "fish-shack", "smokehouse", "boathouse"];
  buildingRow(b, southIds, qx0, qx1, southFoot, southTop, "g", plots, 1, 2, (x, w) => x + w > plazaRect.x - 1 && x < plazaRect.x + plazaRect.w + 1);
  // 문 앞 가지길(접근칸 → 큰길·방파제)
  for (const p of plots) {
    if (!p.access) continue;
    if (p.access.y < street) for (let y = p.access.y; y < street; y++) b.set(p.access.x, y, "v");
    else if (p.access.y >= quayTop) { /* 방파제 위 */ }
  }
  // 큰길 ↔ 방파제 골목(남쪽 건물 사이 빈 틈 중 두 곳) + 광장
  const southPlots = plots.filter((p) => p.y > street);
  const gaps: number[] = [];
  for (let i = 0; i + 1 < southPlots.length; i++) { const a = southPlots[i]!, c = southPlots[i + 1]!; if (c.x - (a.x + a.w) >= 2 && !(a.x + a.w >= plazaRect.x - 1 && a.x + a.w <= plazaRect.x + plazaRect.w)) gaps.push(a.x + a.w); }
  for (const gx of b.shuffle(gaps).slice(0, 2)) for (let y = street + 2; y < quayTop; y++) { b.set(gx, y, "v"); b.set(gx + 1, y, "v"); }
  // 해변 옆에서 큰길로 내려오는 모래 비탈은 이미 모래가 이어 준다. 숲 가장자리 위 줄은 풀
  // 부두(판자) 2~3개: 방파제 남쪽 가장자리에서 바다로
  const nPiers = Wd >= 52 ? 3 : 2;
  const piers: { x: number; len: number }[] = [];
  for (let k = 0; k < nPiers; k++) {
    const px = Math.round(qx0 + ((k + 1) * (qx1 - qx0)) / (nPiers + 1)) - 1 + b.int(-2, 2);
    const len = Math.min(Hd - shore - 3, 6 + b.int(0, 3) + (k === 1 ? 2 : 0));
    piers.push({ x: px, len });
    b.rect(px, shore, 2, len, "b");
    if (b.chance(0.6)) b.rect(px - 1, shore + len - 2, 4, 2, "b");      // 끝 넓은 판(T자)
  }
  tidyCoast(b);
  shallowRing(b, 3);
  // 방파제·부두 바로 옆은 깊은 물이어도 된다(배가 댄다) — 단, 얕은 물 띠가 해변을 감싼다
  b.paintGround();
  // 건물
  stampPlots(b, plots, areas);
  // 등대: 해변 오른쪽 끝(또는 왼쪽) 물가 모래
  const lhRight = b.chance(0.5);
  for (let t = 0; t < 30; t++) {
    const x = lhRight ? Wd - 3 - b.int(0, 4) : b.int(1, 4);
    const lhp = plotOf(b, "lighthouse", x, shore - 7 + b.int(-1, 1));
    if (!lhp) break;
    const accOk = !!lhp.access && "sgcv".includes(b.g(lhp.access.x, lhp.access.y)) && "sgcv".includes(b.g(lhp.access.x, lhp.access.y + 1));
    if (accOk && b.propFits("lighthouse", lhp.x, lhp.y, "sg", 0, false) && b.stamp("lighthouse", lhp.x, lhp.y)) { b.markNear(lhp.x, lhp.y, lhp.w, lhp.h); if (lhp.access) b.markClear(lhp.access.x, lhp.access.y, 1, 2); areas.push({ name: lhp.name, x: lhp.x, y: lhp.y, w: lhp.w, h: lhp.h, tag: "lighthouse", ...(lhp.door ? { door: lhp.door } : {}), ...(lhp.access ? { access: lhp.access } : {}) }); break; }
  }
  // 통로·문 앞 비우기
  for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) if ("vb".includes(b.g(x, y))) b.markClear(x, y);
  const spawn = { x: plazaRect.x + Math.floor(plazaRect.w / 2), y: street };
  const must: Pt[] = areas.filter((a) => a.access).map((a) => a.access!);
  for (const p of piers) must.push({ x: p.x, y: shore + p.len - 1 });
  must.push({ x: 1, y: street }, { x: Wd - 2, y: street });
  b.prune(spawn, must);
  // 배: 부두 옆에 정박(고깃배·노 젓는 배), 큰 부두 끝 깊은 물에 해적 범선
  // 해적 범선: 깊은 물(부두 끝 옆) — 자리를 여러 곳 시험
  const big = piers.reduce((a, c) => (c.len > a.len ? c : a));
  const gs = b.kitSize("galleon");
  if (gs) {
    const tries: Pt[] = [];
    for (let y = shore + 2; y + gs.h <= Hd; y++) for (let x = 1; x + gs.w < Wd; x++) tries.push({ x, y });
    const clearOf = (x: number, y: number) => { if (x < 1 || x + gs.w > Wd - 1 || y + gs.h > Hd - 1) return false; for (let yy = y - 1; yy <= y + gs.h; yy++) for (let xx = x - 1; xx <= x + gs.w; xx++) if (b.g(xx, yy) === "b" || GROUND_OK.includes(b.g(xx, yy))) return false; return true; };
    const near = (t: Pt) => Math.min(Math.abs(t.x - (big.x + 3)), Math.abs(t.x + gs.w + 1 - big.x)) + Math.abs(t.y - (shore + 3));
    for (const t of tries.sort((a, c) => near(a) - near(c))) if (clearOf(t.x, t.y) && b.stampSafe("galleon", t.x, t.y, spawn, must, "water")) { areas.push({ name: "해적 범선", x: t.x, y: t.y, w: gs.w, h: gs.h, tag: "galleon" }); break; }
  }
  // 부두마다 배 한 척(고깃배 하나는 꼭), 부두 옆 물 칸에 붙여 정박
  piers.forEach((p, k) => {
    const boat = k === 0 ? "fishing-boat" : b.pick(["fishing-boat", "rowboat", "rowboat", "canoe"]);
    const s = b.kitSize(boat); if (!s) return;
    for (let t = 0; t < 12; t++) {
      const side = (t + k) % 2 === 0 ? -1 : 1;
      if (b.stampSafe(boat, side < 0 ? p.x - s.w : p.x + 2, shore + 1 + b.int(0, Math.max(0, p.len - s.h - 1)), spawn, must, "water")) break;
    }
  });
  // 부두 끝 말뚝: 판 끝 양옆 물 칸(부두가 물 위에 선 것으로 읽힌다)
  for (const p of piers) {
    const ey = shore + p.len - 1;
    for (let x = p.x - 2; x <= p.x + 3; x++) {
      if (b.g(x, ey) === "b" || !WATER.includes(b.g(x, ey + 1))) continue;
      if (b.g(x - 1, ey + 1) === "b" || b.g(x + 1, ey + 1) === "b") continue;
      if (x === p.x - 2 || x === p.x + 3 || (b.g(x - 1, ey) !== "b" || b.g(x + 1, ey) !== "b")) b.stampSafe("pier-post", x, ey + 1, spawn, must, "water");
    }
  }
  // 방파제: 계선주(남쪽 가장자리 줄, 부두 사이), 기중기 하나, 짐 무더기(창고 문 옆)
  for (let x = qx0 + 1; x < qx1 - 1; x += b.int(4, 6)) if (!piers.some((p) => x >= p.x - 1 && x <= p.x + 2)) b.stampSafe("bollard", x, shore - 1, spawn, must);
  const craneX = b.int(qx0 + 2, qx1 - 4);
  if (!piers.some((p) => craneX + 1 >= p.x - 1 && craneX <= p.x + 2)) b.stampSafe("dock-crane", craneX, shore - 3, spawn, must);
  for (const a of areas) {
    if (!a.access || a.access.y !== quayTop) continue;
    const side = b.chance(0.5) ? a.x : a.x + a.w - 2;
    cluster(b, ["barrels", "crates", "barrel", "crate", "sacks", "keg-powder"], side, quayTop, b.int(1, 2), "q", spawn, must, 1);
  }
  // 광장: 가운데 우물(또는 깃대), 위 가장자리에 노점 줄, 노점 옆 짐, 아래 모서리 등불, 탁자는 술집 쪽
  const pcx = plazaRect.x + Math.floor(plazaRect.w / 2) - 1, pcy = plazaRect.y + Math.floor(plazaRect.h / 2) - 1;
  const centerId = b.has("well") && b.chance(0.7) ? "well" : "flagpole";
  b.stampSafe(centerId, pcx, pcy, spawn, must) || b.stampSafe(centerId, pcx, pcy - 1, spawn, must);
  const stalls = b.shuffle(["stall-fruit", "stall-fish", "stall-goods"]);
  const slots = [plazaRect.x + 1, plazaRect.x + plazaRect.w - 3, plazaRect.x + Math.floor(plazaRect.w / 2) - 1];
  stalls.forEach((id, k) => {
    const x = slots[k]!; if (x < plazaRect.x || x + 2 > plazaRect.x + plazaRect.w) return;
    if (k === 2 && Math.abs(x - pcx) < 3 && pcy - plazaRect.y < 4) return;
    if (b.stampSafe(id, x, plazaRect.y + 1, spawn, must)) {
      areas.push({ name: NAME_KO[id]!, x, y: plazaRect.y + 1, w: 2, h: 2, tag: id });
      b.markNear(x, plazaRect.y + 1, 2, 3, 0);
      cluster(b, ["crate", "barrel", "sacks"], x + (k === 0 ? -1 : 2), plazaRect.y + 2, 1, "c", spawn, must, 0);
    }
  });
  for (const x of [plazaRect.x, plazaRect.x + plazaRect.w - 1]) b.stampSafe("lantern-post", x, plazaRect.y + plazaRect.h - 3, spawn, must);
  cluster(b, ["table-stools", "bench"], pcx + (b.chance(0.5) ? -4 : 4), pcy + 2, 1, "c", spawn, must, 1);
  // 큰길: 등불 기둥 일정 간격(길 위쪽 가장자리 풀 칸), 푯말 하나
  // 등불은 건물 줄이 있는 구간의 길가에만(빈 풀밭 한가운데 두지 않는다)
  const builtX = (x: number) => plots.some((p) => x >= p.x - 1 && x <= p.x + p.w);
  for (let x = b.int(2, 5); x < Wd - 2; x += b.int(7, 9)) {
    if (!builtX(x)) continue;
    for (const y of [street - 2, street + 2]) if (b.propFits("lantern-post", x, y, "g")) { b.stampSafe("lantern-post", x, y, spawn, must); break; }
  }
  // 술집 앞: 탁자·통
  if (tv) cluster(b, ["barrel", "table-stools", "barrels"], tv.x + tv.w + 1, northFoot - 1, 2, "g", spawn, must, 1);
  // 북쪽 땅: 맨 위는 숲 띠(맵 끝 숲 — 나무 덩이 몇 개, 사이사이 빈틈), 집마다 뒤뜰(과일나무·바나나·꽃밭 텃밭) — 남은 풀밭을 고르게 흩뿌리지 않는다
  const northPlots = plots.filter((p) => p.y < street);
  for (let gx = b.int(1, 4); gx < Wd - 3; gx += b.int(7, 10)) grove(b, ["palm", "tree-broad", "palm-pair", "tree-broad", "palm"], gx, 1, b.int(2, 3), "g", spawn, must);
  for (const p of northPlots) {
    if (p.y - 3 < 1 || !b.chance(0.75)) continue;
    cluster(b, b.shuffle(["tree-fruit", "banana", "flowerbed", "bush-hibiscus"]), p.x + Math.floor(p.w / 2) - 1, p.y - 2, 2, "g", spawn, must, 2);
  }
  // 집 사이 틈: 덤불·꽃(틈 하나에 하나)
  for (let i = 0; i + 1 < northPlots.length; i++) {
    const a = northPlots[i]!, c = northPlots[i + 1]!;
    if (c.x - (a.x + a.w) >= 3) cluster(b, ["bush", "bush-hibiscus", "flowerbed"], a.x + a.w + 1, northFoot - 1, 1, "g", spawn, must, 0);
  }
  // 해변(양옆): 야자·그물·밧줄·쪽배(물가), 조개·해초
  for (const side of [{ x: 0, w: qx0 }, { x: qx1, w: Wd - qx1 }]) {
    if (side.w < 3) continue;
    const area = { x: side.x, y: shore - 6, w: side.w, h: 8 };
    sprinkle(b, ["palm-lean", "palm", "palm-young"], Math.max(1, Math.floor(side.w / 4)), "sg", { x: side.x, y: street + 2, w: side.w, h: shore - street }, spawn, must, 1);
    // 해변 어구 마당: 그물 시렁·생선 시렁 둘레에 그물·밧줄을 모은다(한 무더기) + 조개·게·물웅덩이 몇 개
    const yard = { x: side.x + Math.floor(side.w / 2) - 1, y: shore - 4 };
    cluster(b, ["net-rack", "fish-rack", "nets", "rope-coil", "lobster-traps"], yard.x, yard.y, 3, "s", spawn, must, 2);
    sprinkle(b, ["shells", "crab", "tide-pool", "driftwood", "coconuts"], Math.max(1, Math.floor(side.w / 5)), "s", area, spawn, must, 1);
    sprinkle(b, ["canoe", "rowboat"], 1, "w", { x: side.x, y: shore - 2, w: side.w, h: 5 }, spawn, must, 0);
  }
  // 얕은 물: 산호·물 바위(부두에서 떨어진 곳)
  // 산호·물 바위: 부두 구간 밖 양옆 얕은 물에 한 덩이씩
  for (const side of [{ x: 0, w: qx0 }, { x: qx1, w: Wd - qx1 }]) if (side.w >= 4) cluster(b, ["coral", "rock-water", "coral-purple"], side.x + Math.floor(side.w / 2), shore + 2, 2, "w", spawn, must, 2);
  sprinkle(b, ["sea-stack"], 1, "~w", { x: 0, y: Hd - 6, w: Wd, h: 6 }, spawn, must, 1);
  areas.push({ name: "방파제", x: qx0, y: quayTop, w: qx1 - qx0, h: shore - quayTop, tag: "quay" });
  areas.push({ name: "시장 광장", ...plazaRect, tag: "plaza" });
  piers.forEach((p, i) => areas.push({ name: `부두 ${i + 1}`, x: p.x, y: shore, w: 2, h: p.len, tag: "pier" }));
  return { areas, spawn };
}

// ─────────────────────────────── 섬 모양(야외 섬 종류 공통)
/** 타원 + 잡음 섬. land = 땅, rx/ry 반지름. 해안선 둘레 모래 bw 칸, 안쪽 풀. */
function island(b: Board, cx: number, cy: number, rx: number, ry: number, bw: number, s: number): void {
  // 큰 타원 하나 + 작은 곶 둘(씨앗마다 방향이 다르다) — 합집합 거리
  const lobes = [{ x: cx, y: cy, rx, ry }];
  for (let k = 0; k < 2; k++) {
    const a = hash01(k, 3, s) * Math.PI * 2;
    lobes.push({ x: cx + Math.cos(a) * rx * 0.62, y: cy + Math.sin(a) * ry * 0.62, rx: rx * (0.38 + hash01(k, 4, s) * 0.12), ry: ry * (0.38 + hash01(k, 5, s) * 0.12) });
  }
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    let d = 9;
    for (const l of lobes) d = Math.min(d, Math.hypot((x + 0.5 - l.x) / l.rx, (y + 0.5 - l.y) / l.ry));
    d += noise2(x, y, s, 4) * 0.13 + noise2(x, y, s + 7, 7) * 0.14 + noise2(x, y, s + 9, 13) * 0.1;
    const inner = 1 - bw / Math.min(rx, ry) + noise2(x, y, s + 13, 4) * 0.08;
    if (d < 1) b.set(x, y, d < inner ? "g" : "s");
    else b.set(x, y, "~");
  }
  smooth(b, "sg", "~", 2);
  smooth(b, "g", "s", 2);
}

// ─────────────────────────────── 섬 해변 마을
function composeBeach(b: Board): { areas: PirateArea[]; spawn: Pt } {
  const { w: Wd, h: Hd } = b;
  const areas: PirateArea[] = [];
  const cx = Wd / 2 + b.int(-2, 2), cy = Hd / 2 - 2 + b.int(-1, 1);
  island(b, cx, cy, Wd * 0.4, Hd * 0.36, 3.2, b.seed);
  tidyCoast(b);
  // 마을 길: 위 길·아래 길(동서) + 가운데 남북 길(광장) + 남쪽 해변으로 내려가는 길
  const y1 = Math.round(cy - Hd * 0.1), y2 = Math.round(cy + Hd * 0.12);
  const rowSpan = (y: number) => { let lo = -1, hi = -1; for (let x = 0; x < Wd; x++) if (b.g(x, y) === "g" && b.g(x, y + 1) === "g") { if (lo < 0) lo = x; hi = x; } return { lo, hi }; };
  const r1 = rowSpan(y1), r2 = rowSpan(y2);
  const plots: Plot[] = [];
  const hutIds = ["hut-thatch", "hut-round", "hut-palm", "longhouse", "hut-thatch", "fish-shack", "hut-palm", "hut-round"];
  // 가운데 남북 길 + 광장을 먼저 판다(오두막이 광장을 덮지 않게)
  const px = Math.round(cx) - 3;
  for (let y = y1; y <= y2 + 1; y++) { b.set(px + 2, y, "v"); b.set(px + 3, y, "v"); }
  const plaza = { x: px - 1, y: y1 + 3, w: 8, h: Math.max(3, y2 - y1 - 4) };
  b.rect(plaza.x, plaza.y, plaza.w, plaza.h, "v");
  for (const [yy, r] of [[y1, r1], [y2, r2]] as const) {
    if (r.lo < 0) continue;
    for (let x = r.lo + 1; x < r.hi; x++) { b.set(x, yy, "v"); b.set(x, yy + 1, "v"); }
    // 길 위쪽에 오두막 줄(문 → 길). 자리(둘레 1칸 포함)가 모두 풀·모래일 때만 — 광장·남북 길을 덮지 않는다.
    buildingRow(b, hutIds, r.lo + 2, r.hi - 1, yy - 2, Math.max(1, yy - 8), "g", plots, 2, 3, (x, w) => {
      for (let k = x - 1; k < x + w + 1; k++) for (let j = yy - 6; j <= yy - 1; j++) if (b.g(k, j) !== "g" && b.g(k, j) !== "s") return true;
      for (let k = x - 3; k < x + w + 3; k++) for (let j = yy - 8; j <= yy + 1; j++) if (WATER.includes(b.g(k, j))) return true;   // 물가에서 2칸 이상 안쪽
      return false;
    });
  }
  for (const p of plots) if (p.access) b.set(p.access.x, p.access.y, "v");
  // 길은 집이 있는 구간까지만(양 끝이 빈 모래로 빠지지 않게) — 남북 길·광장은 그대로
  for (const [yy] of [[y1], [y2]] as const) {
    const row = plots.filter((p) => p.access && Math.abs(p.access.y - yy) <= 1);
    const lo = Math.min(px - 1, ...row.map((p) => p.x)), hi = Math.max(px + 4, ...row.map((p) => p.x + p.w - 1));
    for (let x = 0; x < Wd; x++) if ((x < lo || x > hi) && !(x >= px + 2 && x <= px + 3)) for (const y of [yy, yy + 1]) if (b.g(x, y) === "v") b.set(x, y, "g");
  }
  // 남쪽 해변으로: 아래 길에서 남쪽 모래까지
  let sy = y2 + 2; while (sy < Hd - 1 && b.g(px + 2, sy) === "g") { b.set(px + 2, sy, "v"); b.set(px + 3, sy, "v"); sy++; }
  // 부두: 남쪽 해변 끝에서 바다로, 끝에 수상 가옥
  let shoreY = sy; while (shoreY < Hd - 1 && !WATER.includes(b.g(px + 2, shoreY))) shoreY++;
  shallowRing(b, 3);
  const pierX = px + 2, pierLen = Math.min(Hd - shoreY - 3, 6 + b.int(0, 2));
  b.rect(pierX, shoreY - 1, 2, pierLen + 1, "b");
  // 수상 가옥 둘: 부두 끝 좌우로 가지 판(접근칸)
  const stilts: Plot[] = [];
  const endY = shoreY - 1 + pierLen;
  for (const side of [-1, 1]) {
    const hx = side < 0 ? pierX - 4 : pierX + 3;
    const p = plotOf(b, "stilt-hut", hx, endY - 5 + 1);
    if (!p || !p.access) continue;
    stilts.push(p);
    // 접근칸 ↔ 부두: 가지 판(가옥 계단 칸 바로 아래 줄에서 부두까지)
    const ay = p.access.y + 1;
    for (let x = Math.min(p.access.x, pierX); x <= Math.max(p.access.x, pierX + 1); x++) b.set(x, ay, "b");
    b.set(p.access.x, p.access.y, "b");
  }
  // 옆 해변(동쪽): 그물 말리는 곳 / 서쪽: 해먹
  smooth(b, "s", "w", 1);
  b.paintGround();
  stampPlots(b, plots, areas);
  for (const p of stilts) {
    if (!b.stamp(p.id, p.x, p.y, "wall")) continue;
    b.markNear(p.x, p.y, p.w, p.h);
    areas.push({ name: p.name, x: p.x, y: p.y, w: p.w, h: p.h, tag: p.tag, ...(p.door ? { door: p.door } : {}), ...(p.access ? { access: p.access } : {}) });
  }
  for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) if ("vb".includes(b.g(x, y))) b.markClear(x, y);
  // 광장 칸은 소품 자리(모닥불·토템)라 비우기 해제
  for (let y = plaza.y; y < plaza.y + plaza.h; y++) for (let x = plaza.x; x < plaza.x + plaza.w; x++) if (x < px + 2 || x > px + 3) b.clear[b.idx(x, y)] = false;
  const spawn = { x: px + 2, y: y2 };
  const must: Pt[] = areas.filter((a) => a.access).map((a) => a.access!);
  must.push({ x: pierX, y: endY });
  b.prune(spawn, must);
  // 광장: 모닥불 + 토템 + 횃불
  b.stampSafe("campfire", plaza.x + 1, plaza.y + Math.floor(plaza.h / 2), spawn, must);
  b.stampSafe("totem", plaza.x + plaza.w - 2, plaza.y, spawn, must);
  b.stampSafe("tiki-torch", plaza.x, plaza.y, spawn, must);
  b.stampSafe("tiki-torch", plaza.x + plaza.w - 1, plaza.y + plaza.h - 2, spawn, must);
  b.stampSafe("log-bench", plaza.x + 3, plaza.y + plaza.h - 1, spawn, must) || b.stampSafe("bench", plaza.x + 4, plaza.y + plaza.h - 1, spawn, must) || b.stampSafe("bench", plaza.x, plaza.y + plaza.h - 1, spawn, must);
  // 오두막 곁: 우물 하나·생선 시렁·바구니(통)
  for (const a of areas.filter((x) => x.tag.startsWith("hut") || x.tag === "longhouse" || x.tag === "fish-shack")) {
    if (b.chance(0.8)) beside(b, a, b.chance(0.5) ? ["barrel", "sacks", "crate", "barrels"] : ["fish-rack", "flowerbed", "oar-rack", "net-rack", "lobster-traps"], "gs", spawn, must);
  }
  const wellSpot = areas.find((a) => a.tag === "longhouse");
  if (wellSpot) cluster(b, ["well"], wellSpot.x - 3, wellSpot.y + wellSpot.h - 2, 1, "g", spawn, must, 1);
  // 숲: 섬 안쪽 풀(마을 둘레) 야자·활엽수·바나나·덤불
  const all = { x: 0, y: 0, w: Wd, h: Hd };
  // 숲: 마을 밖 풀밭에 나무 덩이(고르게 흩뿌리지 않는다) + 덩이 곁 덤불
  for (let t = 0, made = 0; t < 40 && made < Math.floor((Wd * Hd) / 260); t++) {
    const gx = b.int(2, Wd - 4), gy = b.int(1, Hd - 4);
    if (b.g(gx, gy) !== "g" || b.near[b.idx(gx, gy)] || b.clear[b.idx(gx, gy)]) continue;
    if (grove(b, ["palm", "tree-broad", "palm-pair", "banana", "tree-fruit", "palm"], gx, gy, b.int(2, 4), "g", spawn, must) > 0) { made++; cluster(b, ["bush", "fern", "bush-hibiscus", "palm-stump"], gx + b.pick([-3, 3]), gy + 2, 1, "g", spawn, must, 1); }
  }
  // 해변 둘레: 기운 야자(물가 쪽)·쪽배 끌어 올린 자리·조개·게
  sprinkle(b, ["palm-lean", "palm-lean", "palm"], Math.floor(Wd / 5), "s", all, spawn, must, 2);
  sprinkle(b, ["coconuts", "driftwood", "shells", "crab", "tide-pool"], Math.floor(Wd / 5), "s", all, spawn, must, 2);
  sprinkle(b, ["canoe", "bamboo-raft", "rowboat"], 2, "w", { x: 0, y: Math.floor(Hd / 2), w: Wd, h: Hd / 2 }, spawn, must, 1);
  for (let k = 0; k < 2; k++) cluster(b, ["coral", "rock-water", "coral-purple"], b.int(4, Wd - 6), b.pick([3, Hd - 5]), 2, "w", spawn, must, 2);
  sprinkle(b, ["sea-stack"], 2, "~", all, spawn, must, 1);
  areas.push({ name: "마을 광장", ...plaza, tag: "plaza" });
  areas.push({ name: "부두", x: pierX, y: shoreY - 1, w: 2, h: pierLen + 1, tag: "pier" });
  return { areas, spawn };
}

// ─────────────────────────────── 해안 요새
function composeFort(b: Board): { areas: PirateArea[]; spawn: Pt } {
  const { w: Wd, h: Hd } = b;
  const areas: PirateArea[] = [];
  b.grid.fill("g");
  const shore = Hd - 9 + b.int(-1, 1);
  for (let x = 0; x < Wd; x++) {
    const sy = shore + Math.round(noise1(x, b.seed, 6) * 1.5);
    for (let y = sy; y < Hd; y++) b.set(x, y, "~");
    for (let y = sy - 7; y < sy; y++) if (y >= sy - 3.6 + noise2(x, y, b.seed + 3, 4) * 1.4 + noise2(x, y, b.seed + 4, 9) * 0.8) b.set(x, y, "s");
  }
  tidyCoast(b);
  // 요새 사각: 성벽 두께 2(윗면) + 남쪽 바깥 앞면 2. 안뜰 위쪽 벽의 앞면 2줄은 안뜰 안. 안뜰은 쓸 만큼만(빈 포석 마당이 남지 않게).
  const fw = Math.min(Wd - 10, 22 + b.int(0, 3)), fh = Math.min(shore - 8, 15 + b.int(0, 1));
  const fx = Math.floor((Wd - fw) / 2) + b.int(-2, 2), fy = 3;
  b.rect(fx, fy, fw, fh, "F");
  b.rect(fx + 2, fy + 2, fw - 4, fh - 4, "c");                        // 안뜰 포석
  for (let x = fx + 2; x < fx + fw - 2; x++) { b.set(x, fy + 2, "f"); b.set(x, fy + 3, "f"); }
  for (let x = fx; x < fx + fw; x++) { b.set(x, fy + fh, "f"); b.set(x, fy + fh + 1, "f"); }
  // 문루: 남벽 가운데(문 = 잠긴 대문, 이동 이벤트로 안뜰과 잇는다). 문 앞에서 해변까지 곧은 흙길(모래에 닿으면 멈춘다)
  const gateX = fx + Math.floor(fw / 2) - 2;
  for (let y = fy + fh + 2; y < Hd && b.g(gateX + 1, y) === "g"; y++) { b.set(gateX + 1, y, "p"); if (b.g(gateX + 2, y) === "g") b.set(gateX + 2, y, "p"); }
  shallowRing(b, 3);
  b.paintGround();
  const spawn = { x: gateX + 1, y: fy + fh + 3 };
  const must: Pt[] = [];
  for (const [x, y] of [[fx - 1, fy - 1], [fx + fw - 2, fy - 1], [fx - 1, fy + fh - 3], [fx + fw - 2, fy + fh - 3]] as const) {
    if (b.stamp("fort-bastion", x, y, "wall")) areas.push({ name: NAME_KO["fort-bastion"]!, x, y, w: 3, h: 4, tag: "fort-bastion" });
  }
  const gate = plotOf(b, "fort-gate", gateX, fy + fh + 1 - 4);
  let inner: Pt = { x: gateX + 1, y: fy + fh - 5 };
  if (gate && b.stamp("fort-gate", gate.x, gate.y, "wall")) {
    areas.push({ name: gate.name, x: gate.x, y: gate.y, w: gate.w, h: gate.h, tag: "fort-gate", ...(gate.door ? { door: gate.door } : {}), ...(gate.access ? { access: gate.access } : {}) });
    if (gate.door) inner = { x: gate.door.x, y: gate.y - 1 };
    if (gate.access) { must.push(gate.access); b.markClear(gate.access.x - 1, gate.access.y, 4, 2); b.portals.push([gate.access, inner]); }
  }
  must.push(inner);
  b.markClear(inner.x - 2, inner.y - 1, 5, 2);                          // 문루 안쪽 마당
  // 성벽 위 대포(남벽, 문루 양옆 — 포구가 바다 쪽 남쪽)
  for (const dx of [4, fw - 6]) b.stamp("cannon", fx + dx, fy + fh - 2, "wall");
  // 안뜰 둘레 1칸(벽 앞면 밑·옆벽 안쪽)은 비워 둔다 — 건물·기물이 벽에 붙지 않게
  const cx0 = fx + 2, cy0 = fy + 4, cw = fw - 4, ch = fh - 6;
  for (let x = cx0; x < cx0 + cw; x++) { b.near[b.idx(x, cy0)] = true; b.near[b.idx(x, cy0 + ch - 1)] = true; }
  for (let y = cy0; y < cy0 + ch; y++) { b.near[b.idx(cx0, y)] = true; b.near[b.idx(cx0 + cw - 1, y)] = true; }
  // 병영(북쪽, 앞면에서 한 줄 띄움) — 옆에 보급 마당(상자·자루·통)
  const bar = plotOf(b, "fort-barracks", cx0 + 2, cy0 + 1);
  if (bar && b.stamp("fort-barracks", bar.x, bar.y)) {
    b.markNear(bar.x, bar.y, bar.w, bar.h);
    if (bar.access) { must.push(bar.access); b.markClear(bar.access.x - 1, bar.access.y, 3, 2); }
    areas.push({ name: bar.name, x: bar.x, y: bar.y, w: bar.w, h: bar.h, tag: "fort-barracks", ...(bar.door ? { door: bar.door } : {}), ...(bar.access ? { access: bar.access } : {}) });
  }
  b.prune(spawn, must);
  // 망루(동쪽 위, 벽에서 두 칸) + 깃대(가운데 위)
  const wt = { x: cx0 + cw - 4, y: cy0 + 1 };
  if (b.stampSafe("watchtower", wt.x, wt.y, spawn, must)) { b.markNear(wt.x, wt.y, 2, 5); areas.push({ name: NAME_KO.watchtower!, x: wt.x, y: wt.y, w: 2, h: 5, tag: "watchtower" }); }
  const flagX = bar ? bar.x + bar.w + 2 : cx0 + Math.floor(cw / 2);
  if (flagX + 1 < wt.x - 1) b.stampSafe("flagpole", flagX, cy0 + 1, spawn, must);
  // 포대 보급: 남벽 대포 안쪽 아래(벽 바로 위 줄 피해서)에 포탄·화약 / 보급 마당: 병영 아래 / 우물: 가운데
  const sy = cy0 + ch - 3;
  cluster(b, ["cannonballs", "keg-powder", "cannonballs"], fx + 4, sy, 2, "c", spawn, must, 1);
  cluster(b, ["cannonballs", "keg-powder", "barrels"], fx + fw - 6, sy, 2, "c", spawn, must, 1);
  if (bar) cluster(b, ["crates", "sacks", "barrel", "crate"], bar.x + 1, bar.y + bar.h + 2, 3, "c", spawn, must, 2);
  cluster(b, ["well"], cx0 + Math.floor(cw / 2) + 2, cy0 + Math.floor(ch / 2), 1, "c", spawn, must, 1);
  // 바깥: 해변 야자·바위·쪽배, 풀숲 나무 덩이(요새 둘레 2칸 비움)
  b.markNear(fx - 1, fy - 1, fw + 2, fh + 3, 1);
  for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) if (b.g(x, y) === "p") b.markClear(x, y);
  for (const gx of [b.int(1, Math.max(2, fx - 6)), b.int(Math.min(Wd - 6, fx + fw + 2), Wd - 5)]) for (const gy of [b.int(1, 6), b.int(10, shore - 9)]) grove(b, ["palm", "tree-broad", "palm-pair", "banana", "tree-fruit"], gx, gy, b.int(2, 3), "g", spawn, must);
  sprinkle(b, ["bush", "fern", "rock-small", "bush-hibiscus"], Math.floor(Wd / 6), "g", { x: 0, y: 0, w: Wd, h: Hd }, spawn, must, 2);
  sprinkle(b, ["palm-lean", "rock-large", "palm"], Math.floor(Wd / 9), "s", { x: 0, y: 0, w: Wd, h: Hd }, spawn, must, 2);
  sprinkle(b, ["driftwood", "shells", "anchor", "crab", "tide-pool"], Math.floor(Wd / 8), "s", { x: 0, y: 0, w: Wd, h: Hd }, spawn, must, 2);
  sprinkle(b, ["rowboat", "canoe"], 1, "w", { x: 0, y: 0, w: Wd, h: Hd }, spawn, must, 1);
  cluster(b, ["rock-water", "sea-stack", "coral"], b.int(4, Wd - 6), Hd - 4, 2, "w~", spawn, must, 3);
  areas.push({ name: "요새 안뜰", x: cx0, y: cy0, w: cw, h: ch, tag: "courtyard", access: inner });
  return { areas, spawn };
}

// ─────────────────────────────── 난파선·보물 동굴 섬
/** 굽은 길: a → c 를 한 칸씩, 가로·세로 중 남은 거리가 큰 쪽으로 가되 잡음으로 흔든다(폭 2). 모래 칸은 모래길, 풀 칸은 흙길. */
function wpath(b: Board, a: Pt, c: Pt, keep = "~wb"): void {
  let x = a.x, y = a.y, guard = 0;
  const put = () => { for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) { const ch = b.g(x + k, y + j); if (!keep.includes(ch) && b.inb(x + k, y + j)) b.set(x + k, y + j, ch === "s" || ch === "v" ? "v" : "p"); } };
  put();
  while ((x !== c.x || y !== c.y) && guard++ < 400) {
    const dx = c.x - x, dy = c.y - y;
    const horiz = Math.abs(dx) > 0 && (Math.abs(dy) === 0 || Math.abs(dx) + noise1(x + y * 3, b.seed + 41, 4) * 3 > Math.abs(dy));
    if (horiz) x += Math.sign(dx); else y += Math.sign(dy);
    put();
  }
}

function composeWreck(b: Board): { areas: PirateArea[]; spawn: Pt } {
  const { w: Wd, h: Hd } = b;
  const areas: PirateArea[] = [];
  const cx = Wd / 2 + b.int(-3, 3), cy = Hd / 2 - 1;
  island(b, cx, cy, Wd * 0.38, Hd * 0.36, 3.2, b.seed + 11);
  tidyCoast(b);
  // 북쪽 풀숲 가운데 동굴 자리(동굴 그림이 바위 둔덕을 품는다)
  const rx = Math.round(cx) + b.int(-5, 5), ry = Math.round(cy - Hd * 0.2);
  const caveX = rx - 1, caveY = ry - 1;
  b.rect(caveX - 1, caveY - 1, 5, 5, "g");
  // 난파선 자리(땅 격자로 먼저 고른다): 배 밑 두 줄이 모래, 그 아래가 물 — 남쪽 반에서
  // 후보: 배 밑 줄 바로 아래가 거의 물(배 뒤에 갇힌 모래 주머니가 남지 않게) — 물에 많이 닿은 자리부터
  const cands: { x: number; y: number; wet: number }[] = [];
  for (let y = Math.round(cy); y < Hd - 4; y++) for (let x = 2; x < Wd - 7; x++) {
    let ok = true; for (let k = 0; k < 5; k++) { if (b.g(x + k, y + 2) !== "s") ok = false; if (b.g(x + k, y + 1) !== "s" && b.g(x + k, y + 1) !== "g") ok = false; }
    if (!ok) continue;
    let wet = 0; for (let k = -1; k <= 5; k++) if (WATER.includes(b.g(x + k, y + 3))) wet++;
    if (wet >= 4) cands.push({ x, y, wet: wet + hash01(x, y, b.seed) });
  }
  cands.sort((a, c) => c.wet - a.wet);
  let wreck: Pt | null = cands[0] ?? null;
  const cave = plotOf(b, "cave-entrance", caveX, caveY);
  const caveAcc = cave?.access ?? { x: caveX + 1, y: caveY + 3 };
  // 동굴 앞 → 난파선 옆 모래까지 굽은 길(흙길 → 모래길)
  const wreckSide: Pt = wreck ? { x: wreck.x + 2, y: wreck.y - 2 } : { x: Math.round(cx), y: Math.round(cy) + 4 };
  wpath(b, { x: caveAcc.x, y: caveAcc.y }, wreckSide);
  shallowRing(b, 3);
  b.paintGround();
  const spawn = { x: wreckSide.x, y: wreckSide.y };
  const must: Pt[] = [];
  if (cave && b.stamp("cave-entrance", cave.x, cave.y)) {
    b.markNear(cave.x, cave.y, cave.w, cave.h);
    if (cave.access) { must.push(cave.access); b.markClear(cave.access.x - 1, cave.access.y, 3, 2); }
    areas.push({ name: cave.name, x: cave.x, y: cave.y, w: cave.w, h: cave.h, tag: "cave-entrance", ...(cave.door ? { door: cave.door } : {}), ...(cave.access ? { access: cave.access } : {}) });
  }
  b.prune(spawn, must);
  for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) if ("pv".includes(b.g(x, y))) b.markClear(x, y);
  if (wreck && !b.stampSafe("shipwreck", wreck.x, wreck.y, spawn, must)) wreck = cands.slice(1, 40).find((c) => b.stampSafe("shipwreck", c.x, c.y, spawn, must)) ?? null;
  if (wreck) {
    b.markNear(wreck.x, wreck.y, 5, 3);
    areas.push({ name: NAME_KO.shipwreck!, x: wreck.x, y: wreck.y, w: 5, h: 3, tag: "shipwreck" });
    // 떠밀려 온 짐: 난파선 한쪽 모래에 한 무더기(서로 한 칸씩 띄움) + 부서진 쪽배
    const side = b.chance(0.5) ? -1 : 1;
    clusterPad(b, ["barrel", "crate", "rope-coil", "keg-powder"], side < 0 ? wreck.x - 4 : wreck.x + 6, wreck.y, 3, "s", spawn, must, 2);
    clusterPad(b, ["broken-rowboat", "anchor", "driftwood"], side < 0 ? wreck.x + 6 : wreck.x - 4, wreck.y + 1, 2, "s", spawn, must, 2);
  }
  // 동굴 앞 표식: 양옆 횃불, 해골 바위(옆 풀숲), 길가 푯말, 보물 표시(X)와 상자는 한 칸씩 띄워서
  if (cave) {
    b.stampSafe("tiki-torch", cave.x - 1, cave.y + cave.h - 2, spawn, must);
    b.stampSafe("tiki-torch", cave.x + cave.w, cave.y + cave.h - 2, spawn, must);
    clusterPad(b, ["skull-rock"], cave.x - 4, cave.y + 1, 1, "g", spawn, must, 1);
    clusterPad(b, ["signpost"], caveAcc.x + 3, caveAcc.y + 1, 1, "gs", spawn, must, 1);
    clusterPad(b, ["treasure-x", "chest-closed", "gold-pile"], cave.x + cave.w + 2, cave.y + cave.h + 1, 2, "gs", spawn, must, 2);
  }
  // 동굴 둘레 바위
  sprinkle(b, ["rock-large", "rock-small", "fern"], 5, "g", { x: rx - 7, y: ry - 4, w: 15, h: 8 }, spawn, must, 1);
  // 숲 덩이
  for (let t = 0, made = 0; t < 40 && made < Math.floor((Wd * Hd) / 300); t++) {
    const gx = b.int(2, Wd - 4), gy = b.int(1, Hd - 4);
    if (b.g(gx, gy) !== "g" || b.near[b.idx(gx, gy)] || b.clear[b.idx(gx, gy)]) continue;
    if (grove(b, ["palm", "tree-broad", "palm-pair", "banana", "palm"], gx, gy, b.int(2, 3), "g", spawn, must) > 0) { made++; clusterPad(b, ["bush", "fern", "palm-stump", "bush-hibiscus"], gx + b.pick([-3, 3]), gy + 2, 1, "g", spawn, must, 1); }
  }
  const all = { x: 0, y: 0, w: Wd, h: Hd };
  sprinkle(b, ["palm-lean", "palm"], Math.floor(Wd / 7), "s", all, spawn, must, 2);
  sprinkle(b, ["shells", "crab", "tide-pool", "coconuts", "driftwood"], Math.floor(Wd / 6), "s", all, spawn, must, 2);
  sprinkle(b, ["rowboat", "bamboo-raft"], 1, "w", { x: 0, y: Math.floor(Hd / 2), w: Wd, h: Hd / 2 }, spawn, must, 1);
  for (let k = 0; k < 2; k++) cluster(b, ["coral", "rock-water", "coral-purple"], b.int(4, Wd - 6), b.pick([3, Hd - 5]), 2, "w", spawn, must, 2);
  sprinkle(b, ["sea-stack"], 2, "~", all, spawn, must, 2);
  return { areas, spawn };
}

// ─────────────────────────────── 실내
interface Room { name: string; tag: string; x: number; y: number; w: number; h: number; floor: string }

/** 실내 방 묶음: 벽(천장 문자) 바탕에 방을 판다. 방 맨 위 두 줄은 앞면(x). 방끼리 남북 문 통로 폭 2. jitter = 동굴처럼 가장자리를 들쭉날쭉하게. */
function interiorShell(b: Board, wall: string, rooms: Room[], doors: Pt[], jitter = false, extraFloor: Pt[] = [], hull = false): void {
  b.grid.fill(wall);
  const nearDoor = (x: number, y: number) => doors.some((d) => x >= d.x - 2 && x <= d.x + 3 && Math.abs(y - d.y) <= 3) || extraFloor.some((d) => Math.abs(d.x - x) <= 2 && Math.abs(d.y - y) <= 2);
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
    if (jitter && !nearDoor(x, y)) {
      const d = Math.min(x - r.x, r.x + r.w - 1 - x, y - r.y, r.y + r.h - 1 - y);
      const n = noise2(x, y, b.seed + 31, 3);
      if ((d === 0 && n > -0.25) || (d === 1 && n > 0.3) || (d === 2 && n > 0.7)) continue;
    }
    b.set(x, y, r.floor);
  }
  for (const d of doors) for (let dy = -1; dy <= 1; dy++) for (const dx of [0, 1]) if (dy === 0 || b.g(d.x + dx, d.y + dy) === wall) b.set(d.x + dx, d.y + dy, rooms[0]!.floor);
  for (const d of extraFloor) b.set(d.x, d.y, rooms[0]!.floor);
  if (hull) {                                                           // 배 모양: 오른쪽 뱃머리로 뾰족, 왼쪽 고물 모서리 둥글게
    const mid = (b.h - 1) / 2, bow = Math.max(6, Math.round(b.w * 0.22));
    for (let y = 0; y < b.h; y++) {
      const u = Math.min(1, Math.abs(y - mid) / mid);
      const right = b.w - 2 - Math.round(bow * Math.pow(u, 1.7));
      const left = 1 + Math.round(2.2 * Math.pow(u, 4));
      for (let x = 0; x < b.w; x++) if ((x > right || x < left) && !extraFloor.some((d) => d.x === x && d.y === y)) b.set(x, y, wall);
    }
  }
  if (jitter) {                                                         // 외톨이 바닥·한 칸 홈 다듬기
    for (let pass = 0; pass < 2; pass++) for (let y = 1; y < b.h - 1; y++) for (let x = 1; x < b.w - 1; x++) {
      if (b.g(x, y) === wall || nearDoor(x, y)) continue;
      const n4 = [[0, -1], [1, 0], [0, 1], [-1, 0]].filter(([dx, dy]) => b.g(x + dx!, y + dy!) !== wall).length;
      if (n4 <= 1) b.set(x, y, wall);
    }
  }
  // 앞면: 위가 벽인 바닥 칸 → x 두 줄
  for (let y = 1; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    if (b.g(x, y) === wall || b.g(x, y) === "x") continue;
    if (b.g(x, y - 1) !== wall) continue;
    if (extraFloor.some((d) => d.x === x && d.y === y)) continue;
    b.set(x, y, "x"); if (y + 1 < b.h && b.g(x, y + 1) !== wall) b.set(x, y + 1, "x");
  }
}

/** 벽 앞면 아래 첫 바닥 줄을 따라 키 큰 가구를 왼쪽부터. 문 통로 열은 비운다. */
function alongBack(b: Board, r: Room, ids: readonly string[], start: Pt, must: Pt[], gap = 1, blocked: (x: number, w: number) => boolean = () => false): void {
  // 방 폭에 맞게 간격을 넓혀 한쪽에 몰리지 않게
  const total = ids.reduce((a, id) => a + (b.kitSize(id)?.w ?? 0), 0);
  if (ids.length > 1) gap = Math.max(gap, Math.min(4, Math.floor((r.w - 2 - total) / ids.length)));
  let x = r.x + 1;
  for (const id of ids) {
    const s = b.kitSize(id); if (!s) continue;
    while (x + s.w <= r.x + r.w - 1 && blocked(x, s.w)) x++;
    if (x + s.w > r.x + r.w - 1) break;
    if (b.stampSafe(id, x, r.y + 2, start, must)) x += s.w + gap; else x++;
  }
}
/** 앞면 아래 줄(벽 부착물). */
function onFace(b: Board, r: Room, ids: readonly string[], step: number, start: Pt, must: Pt[], blocked: (x: number, w: number) => boolean = () => false): void {
  for (let x = r.x + 1 + b.int(0, 2), k = 0; x < r.x + r.w - 1; x += step, k++) {
    const id = ids[k % ids.length]!; const s = b.kitSize(id); if (!s) continue;
    if (x + s.w > r.x + r.w - 1 || blocked(x, s.w)) continue;
    const y0 = r.y + 1 - (s.h - 1);
    let onWall = true;                                                   // 벽 앞면(x) 칸 위에만 — 배 뱃머리처럼 앞면이 잘린 곳에 떠 있지 않게
    for (let yy = Math.max(r.y, y0); yy < y0 + s.h; yy++) for (let xx = x; xx < x + s.w; xx++) if (b.g(xx, yy) !== "x") onWall = false;
    if (onWall) b.stampSafe(id, x, y0, start, must, "wall");
  }
}
function scatterIn(b: Board, r: Room, ids: readonly string[], n: number, start: Pt, must: Pt[], rowFrom = 2): void {
  let k = 0;
  for (let t = 0; t < n * 16 && k < n; t++) {
    const id = ids[(k + t) % ids.length]!; const s = b.kitSize(id); if (!s) continue;
    const x = b.int(r.x + 1, r.x + r.w - 1 - s.w), y = b.int(r.y + 2 + rowFrom, r.y + r.h - 1 - s.h);
    if (y < r.y + 2) continue;
    if (!b.propFits(id, x, y, "12345", 1)) continue;
    if (b.stampSafe(id, x, y, start, must)) k++;
  }
}

interface RoomSpec { name: string; tag: string; w: [number, number]; floor?: string }
const INTERIOR_LAYOUT: Readonly<Record<"ship" | "tavern" | "cave", { top: RoomSpec[]; bottom: RoomSpec[]; corridor: boolean; topShare: number }>> = {
  ship: { top: [{ name: "선장실", tag: "captain", w: [12, 14] }, { name: "선원 선실", tag: "crew", w: [9, 11] }, { name: "주방", tag: "galley", w: [99, 99] }], corridor: true, topShare: 0.5,
    bottom: [{ name: "선창", tag: "hold", w: [10, 12] }, { name: "포 갑판", tag: "gundeck", w: [99, 99] }] },
  tavern: { top: [{ name: "부엌", tag: "kitchen", w: [8, 10] }, { name: "창고", tag: "cellar", w: [7, 9] }, { name: "뒷방", tag: "backroom", w: [99, 99] }], corridor: false, topShare: 0.4,
    bottom: [{ name: "술집 홀", tag: "hall", w: [99, 99] }] },
  cave: { top: [{ name: "굴 입구 방", tag: "cave-hall", w: [99, 99] }], corridor: false, topShare: 0.5,
    bottom: [{ name: "보물 방", tag: "treasure", w: [12, 16], floor: "5" }, { name: "굴 안쪽", tag: "deep", w: [99, 99] }] },
};

/** 띠 하나를 방 여럿으로 나눈다(사이 벽 1칸, 마지막 방이 남은 폭). */
function splitBand(b: Board, specs: readonly RoomSpec[], y: number, h: number, fl: string): Room[] {
  const out: Room[] = [];
  let x = 1;
  specs.forEach((sp, i) => {
    const last = i === specs.length - 1;
    let rw = last ? b.w - 1 - x : b.int(sp.w[0], sp.w[1]);
    if (!last && x + rw > b.w - 8) rw = Math.max(6, b.w - 8 - x);
    if (rw < 5) return;
    out.push({ name: sp.name, tag: sp.tag, x, y, w: rw, h, floor: sp.floor ?? fl });
    x += rw + 1;
  });
  return out;
}

function composeInterior(b: Board, kind: "ship" | "tavern" | "hut" | "cave", plan: InteriorPlan): { areas: PirateArea[]; spawn: Pt } {
  const { w: Wd, h: Hd } = b;
  const areas: PirateArea[] = [];
  const wall = kind === "ship" ? "S" : kind === "tavern" ? "T" : kind === "hut" ? "H" : "C";
  const fl = kind === "ship" ? "1" : kind === "tavern" ? "2" : kind === "hut" ? "3" : "4";
  let rooms: Room[] = [];
  const doors: Pt[] = [];
  const extra: Pt[] = [];
  let exit: Pt;
  let corr: Room | null = null;
  if (kind === "hut") {
    rooms.push({ name: "오두막 방", tag: "hut-room", x: 1, y: 1, w: Wd - 2, h: Hd - 2, floor: fl });
    const cx = Math.floor(Wd / 2) - 1;
    extra.push({ x: cx, y: Hd - 1 }, { x: cx + 1, y: Hd - 1 });
    exit = { x: cx, y: Hd - 1 };
  } else {
    const L = INTERIOR_LAYOUT[kind];
    const inner = Hd - 2 - (L.corridor ? 5 : 0) - 1;
    const topH = Math.max(8, Math.round(inner * L.topShare));
    const top = splitBand(b, L.top, 1, topH, fl);
    let y = 1 + topH + 1;
    if (L.corridor) { corr = { name: "복도", tag: "corridor", x: 1, y, w: Wd - 2, h: 4, floor: fl }; y += 5; }
    const bottom = splitBand(b, L.bottom, y, Hd - 1 - y, fl);
    rooms = [...top, ...(corr ? [corr] : []), ...bottom];
    const doorIn = (r: Room, wy: number) => doors.push({ x: r.x + Math.max(1, Math.min(r.w - 3, Math.floor(r.w / 2) - 1 + b.int(-2, 2))), y: wy });
    if (corr) { for (const r of top) doorIn(r, corr.y - 1); for (const r of bottom) doorIn(r, corr.y + corr.h); }
    else if (top.length === 1) for (const r of bottom) doorIn(r, r.y - 1);
    else for (const r of top) doorIn(r, r.y + r.h);
    if (kind === "tavern") { const h = bottom[0]!; const cx = h.x + Math.floor(h.w / 2) - 1; extra.push({ x: cx, y: Hd - 1 }, { x: cx + 1, y: Hd - 1 }); exit = { x: cx, y: Hd - 1 }; }
    else if (kind === "cave") { const t = top[0]!; extra.push({ x: 0, y: t.y + 3 }, { x: 0, y: t.y + 4 }); exit = { x: 0, y: t.y + 3 }; }
    else exit = { x: corr!.x + 2, y: corr!.y + 2 };
  }
  interiorShell(b, wall, rooms, doors, kind === "cave", extra, kind === "ship");
  b.paintGround();
  const spawn = kind === "cave" ? { x: 1, y: exit.y } : kind === "ship" ? { x: exit.x, y: exit.y + 1 } : { x: exit.x, y: exit.y - 1 };
  const must: Pt[] = [exit];
  for (const d of doors) must.push({ x: d.x, y: d.y }, { x: d.x, y: d.y + 1 }, { x: d.x, y: d.y - 1 });
  for (const r of rooms) { const c = { x: r.x + Math.floor(r.w / 2), y: r.y + 2 + Math.floor((r.h - 2) / 2) }; while (c.x > r.x && !"12345".includes(b.g(c.x, c.y))) c.x--; must.push(c); }
  b.prune(spawn, must);
  const doorCols = (r: Room) => doors.filter((d) => (d.y === r.y - 1 || d.y === r.y + r.h) && d.x + 1 >= r.x && d.x < r.x + r.w).flatMap((d) => [d.x - 1, d.x, d.x + 1, d.x + 2]);
  const blockedIn = (r: Room) => (x: number, w: number) => doorCols(r).some((c) => c >= x && c < x + w) || (corr === r && x <= exit.x + 2 && x + w > exit.x - 1);
  for (const d of doors) b.markClear(d.x - 1, d.y - 2, 4, 5);
  b.markClear(exit.x - 1, exit.y - 2, 4, 4);
  // 배: 복도 뒷벽에 위 갑판으로 오르는 계단(나가는 곳)
  if (kind === "ship" && corr) b.stamp("stairs-up", exit.x, corr.y, "wall");
  for (const r of rooms) {
    const blk = blockedIn(r);
    const pl = plan[r.tag];
    if (r.tag === "hall") furnishHall(b, r, spawn, must, blk);
    if (r.tag === "gundeck") furnishGundeck(b, r, spawn, must, blk);
    if (!pl) continue;
    if (pl.face) onFace(b, r, pl.face, b.int(3, 5), spawn, must, blk);
    if (pl.back) alongBack(b, r, pl.back, spawn, must, 1, blk);
    if (pl.center) {
      const ids = pl.center.ids;
      const w0 = ids.reduce((acc, id) => acc + (b.kitSize(id)?.w ?? 0) + 3, 0) - 3;
      for (let k = 0, x = r.x + Math.max(2, Math.floor((r.w - Math.min(w0, r.w - 4)) / 2)); k < pl.center.count && x < r.x + r.w - 3; k++) {
        const id = ids[k % ids.length]!; const s = b.kitSize(id); if (!s) continue;
        const y = r.y + 2 + Math.max(2, Math.floor((r.h - 2) / 2) - Math.floor(s.h / 2));
        if (!blk(x, s.w) && b.propFits(id, x, y, "12345")) b.stampSafe(id, x, y, spawn, must);
        x += s.w + 3;
      }
    }
    if (pl.scatter) scatterIn(b, r, pl.scatter.ids, pl.scatter.count, spawn, must, 2);
  }
  for (const r of rooms) areas.push({ name: r.name, x: r.x, y: r.y, w: r.w, h: r.h, tag: r.tag });
  areas.push({ name: kind === "ship" ? "위 갑판 계단(이동 이벤트)" : "바깥 문 자리(이동 이벤트)", x: exit.x, y: exit.y, w: 1, h: 1, tag: "exit", access: exit });
  return { areas, spawn };
}

/** 술집 홀: 왼쪽 바(선반 → 카운터 → 걸상 줄), 뒤 오른쪽 벽난로 + 깔개, 나머지는 둥근 탁자·의자 격자. */
function furnishHall(b: Board, r: Room, start: Pt, must: Pt[], blk: (x: number, w: number) => boolean): void {
  const fy = r.y + 2;
  const barW = 8;
  let x = r.x + 1;
  for (const id of ["bar-shelf", "bar-shelf", "keg-stand"]) { const s = b.kitSize(id); if (s && !blk(x, s.w) && b.stampSafe(id, x, fy, start, must)) x += s.w; }
  const cy = fy + 3;
  if (b.stampSafe("bar-counter", r.x + 1, cy, start, must)) {
    b.stampSafe("bar-counter", r.x + 4, cy, start, must);
    for (let sx = r.x + 1; sx < r.x + barW - 1; sx += 2) b.stampSafe("stool-int", sx, cy + 3, start, must);
  }
  onFace(b, r, ["wall-trophy", "lantern-wall", "cutlass-rack", "dartboard", "lantern-wall", "wall-map"], b.int(3, 4), start, must, blk);
  const fx = r.x + r.w - 4;
  if (!blk(fx, 2) && b.stampSafe("fireplace", fx, fy, start, must)) b.stampSafe("rug-tavern", fx, fy + 3, start, must);
  b.stampSafe("bar-shelf", fx - 3, fy, start, must);
  for (let ty = fy + 3; ty + 2 <= r.y + r.h - 1; ty += 4) {
    for (let tx = r.x + barW + 2 + (((ty - fy) / 4) % 2 ? 2 : 0); tx + 2 <= r.x + r.w - 2; tx += 5) {
      const id = b.chance(0.3) ? "tavern-table" : "tavern-table-round"; const s = b.kitSize(id); if (!s) continue;
      if (tx + s.w > r.x + r.w - 2 || blk(tx, s.w)) continue;
      if (!b.propFits(id, tx, ty + 1, "12345") || !b.stampSafe(id, tx, ty + 1, start, must)) continue;
      for (let k = 0; k < s.w; k += 1) if (k === 0 || k === s.w - 1) b.stampSafe("tavern-chair", tx + k, ty, start, must);
    }
  }
}

/** 포 갑판: 남쪽 뱃전(맨 아래 줄)에 대포를 남쪽으로 겨눠 줄 세우고 사이에 화약·포탄, 가운데 돛대 밑동, 뒷벽 짐 선반. */
function furnishGundeck(b: Board, r: Room, start: Pt, must: Pt[], blk: (x: number, w: number) => boolean): void {
  const cy = r.y + r.h - 2;
  for (let x = r.x + 2; x + 2 <= r.x + r.w - 1; x += 5) {
    if (blk(x, 2) || !"12345".includes(b.g(x, cy + 1)) || !"12345".includes(b.g(x + 1, cy + 1))) continue;
    if (b.stampSafe("cannon-int", x, cy, start, must)) b.stampSafe(b.pick(["keg-powder", "cannonballs"]), x + 3, cy + 1, start, must);
  }
  b.stampSafe("mast-base", r.x + Math.floor(r.w / 2) - 1, r.y + 2 + Math.floor((r.h - 2) / 2) - 1, start, must);
  onFace(b, r, ["lantern-wall", "cutlass-rack", "lantern-wall", "porthole"], 5, start, must, blk);
  let x = r.x + 1;
  for (const id of ["cargo-barrels", "crates"]) { const s = b.kitSize(id); if (s && !blk(x, s.w) && b.stampSafe(id, x, r.y + 2, start, must)) x += s.w + 3; else x++; }
}

/** 방 종류 → 가구 계획(실내 가구 id 는 interior 묶음). 없는 id 는 건너뛴다. */
interface RoomPlan { back?: readonly string[]; face?: readonly string[]; center?: { ids: readonly string[]; count: number }; scatter?: { ids: readonly string[]; count: number } }
type InteriorPlan = Readonly<Record<string, RoomPlan>>;

export const PIRATE_INTERIOR_PLANS: Readonly<Record<"ship" | "tavern" | "hut" | "cave", InteriorPlan>> = {
  ship: {
    captain: { back: ["captain-bed", "bookshelf-ship", "wardrobe-ship", "globe", "bookshelf-ship"], face: ["ship-window", "wall-map", "lantern-wall", "cutlass-rack", "porthole"], center: { ids: ["map-table", "captain-desk"], count: 2 }, scatter: { ids: ["chest-big", "chair-ship", "sea-chest", "globe"], count: 3 } },
    crew: { back: ["bunk-ship", "bunk-ship", "bunk-ship", "sea-chest", "bunk-ship"], face: ["porthole", "lantern-wall", "dartboard"], scatter: { ids: ["hammock-int", "sea-chest", "stool-int", "rope-coil", "hammock-int"], count: 4 } },
    galley: { back: ["galley-stove", "galley-shelf", "water-barrel", "galley-shelf"], face: ["pot-rack", "hanging-herbs", "porthole"], center: { ids: ["galley-table"], count: 1 }, scatter: { ids: ["sacks", "barrel", "stool-int", "water-barrel"], count: 3 } },
    hold: { back: ["cargo-barrels", "crates", "cargo-barrels"], face: ["lantern-wall", "porthole"], scatter: { ids: ["crates", "barrel", "sacks", "keg-powder", "rope-coil", "water-barrel"], count: 6 } },
  },
  tavern: {
    hall: {},                                                     // furnishHall 이 짓는다
    kitchen: { back: ["galley-stove", "galley-shelf", "water-barrel"], face: ["pot-rack", "hanging-herbs"], center: { ids: ["galley-table"], count: 1 }, scatter: { ids: ["sacks", "barrel"], count: 2 } },
    cellar: { back: ["cargo-barrels", "keg-stand", "cargo-barrels"], face: ["lantern-wall"], scatter: { ids: ["barrel", "sacks", "crates", "keg-powder"], count: 4 } },
    backroom: { back: ["captain-bed", "sea-chest", "wardrobe-ship"], face: ["lantern-wall", "wall-map"], scatter: { ids: ["tavern-table-round", "tavern-chair", "rug-tavern"], count: 2 } },
  },
  hut: {
    "hut-room": { back: ["bed-straw", "shelf-hut", "water-jar", "basket"], face: ["lantern-wall", "hanging-herbs", "wall-trophy"], center: { ids: ["fire-pit"], count: 1 }, scatter: { ids: ["mat-hut", "basket", "low-table-hut", "hammock-int"], count: 3 } },
  },
  cave: {
    "cave-hall": { back: ["rock-pillar", "torch-stand", "rock-pillar", "candelabra"], scatter: { ids: ["stalagmite", "bones", "torch-stand", "barrel", "stalagmite"], count: 6 } },
    treasure: { back: ["treasure-heap", "idol-pedestal", "treasure-heap", "candelabra"], center: { ids: ["chest-big", "treasure-heap", "chest-open"], count: 2 }, scatter: { ids: ["gold-pile", "treasure-urn", "chest-closed", "chest-open", "bones", "stalagmite"], count: 7 } },
    deep: { back: ["rock-pillar", "torch-stand", "rock-pillar"], scatter: { ids: ["stalagmite", "bones", "torch-stand", "stalagmite"], count: 5 } },
  },
};

/**
 * 맵 한 장을 짠다. map 의 땅·2층·3층을 덮어쓴다(이벤트·이름표는 건드리지 않는다 — 이름표는 labelPirateAreas).
 * tileset 은 번들 pirate_isles 사본이어야 한다(키트 `pi-…`·오토타일 `pi-at-…`).
 */
export function composePirateIslesMap(map: GameMap, tileset: TilesetDef, kind: PirateMapKind, seed: number, plans: typeof PIRATE_INTERIOR_PLANS = PIRATE_INTERIOR_PLANS): PirateComposeResult {
  const salt = PIRATE_MAP_KINDS.indexOf(kind) * 7919;
  const b = new Board(map, tileset, seed + salt);
  for (let i = 0; i < map.width * map.height; i++) { setLayerTileAt(map, 2, i, -1); setLayerTileAt(map, 3, i, -1); setLayerTileAt(map, 4, i, -1); }
  const out = kind === "harbor" ? composeHarbor(b) : kind === "beach" ? composeBeach(b) : kind === "fort" ? composeFort(b) : kind === "wreck" ? composeWreck(b)
    : composeInterior(b, kind, plans[kind]);
  // 마지막 통행 검사: 출발점에서 문 앞 접근칸에 닿지 않는 곳을 센다(보고용)
  const seen = b.reach(out.spawn);
  const unreachable = out.areas.filter((a) => a.access && !seen[b.idx(a.access.x, a.access.y)]).length;
  const counts = new Map<string, number>();
  for (const p of b.placed) counts.set(p.id, (counts.get(p.id) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, c) => c[1] - a[1]).slice(0, 8).map(([id, n]) => `${id}×${n}`).join(", ");
  const kindKo: Record<PirateMapKind, string> = { harbor: "해적 항구 마을", beach: "열대 섬 해변 마을", fort: "해안 요새", wreck: "난파선·보물 동굴 섬", ship: "배 안", tavern: "해적 술집 안", hut: "섬 오두막 안", cave: "보물 동굴 안" };
  return {
    kind, seed, placed: b.placed, areas: out.areas, spawn: out.spawn, skipped: b.skipped, unreachable, portals: b.portals,
    summary: `${kindKo[kind]} ${map.width}×${map.height} (seed ${seed}) — 구역·건물 ${out.areas.length}곳 · 기물 ${b.placed.length}개(${top})${unreachable ? ` · 닿지 않는 문 ${unreachable}` : ""}`,
  };
}

/** 구역·건물을 맵 이름표로 남긴다(옛 pirate-area 이름표는 지운다). */
export function labelPirateAreas(map: GameMap, areas: readonly PirateArea[]): string[] {
  map.locations = (map.locations ?? []).filter((l) => !(l.tags ?? []).includes("pirate-area"));
  const lines: string[] = [];
  for (const a of areas) {
    const note = a.door && a.access ? `문 (${a.door.x},${a.door.y}) · 문 앞 접근칸 (${a.access.x},${a.access.y})` : a.access ? `접근칸 (${a.access.x},${a.access.y})` : "구역";
    const added = addMapLocation(map, { name: a.name, x: a.x, y: a.y, w: a.w, h: a.h, note, tags: ["pirate-area", a.tag] });
    if (added.ok) lines.push(a.access ? `${a.name} 접근칸 (${a.access.x},${a.access.y})` : a.name);
  }
  return lines;
}

/** 요청 글 → 맵 종류 추정. */
export function pirateKindFromText(text: string): PirateMapKind {
  if (/선실|선창|배\s*안|배\s*내부|갑판\s*아래|선장실|ship\s*(?:interior|cabin)|cabin|hold/iu.test(text)) return "ship";
  if (/술집\s*안|술집\s*내부|주점\s*안|tavern\s*interior|inside\s*the\s*tavern/iu.test(text)) return "tavern";
  if (/동굴\s*안|동굴\s*내부|보물\s*방|treasure\s*room|inside\s*the\s*cave/iu.test(text)) return "cave";
  if (/오두막\s*안|오두막\s*내부|hut\s*interior/iu.test(text)) return "hut";
  if (/요새|성채|포대|fort/iu.test(text)) return "fort";
  if (/난파|보물\s*(?:동굴|섬)|shipwreck|treasure\s*(?:cave|island)/iu.test(text)) return "wreck";
  if (/항구|부두|선착장|harbo|port|dock/iu.test(text)) return "harbor";
  return "beach";
}
