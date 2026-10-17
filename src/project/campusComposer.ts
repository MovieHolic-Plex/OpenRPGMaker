// project/campusComposer.ts
// 현대 학교·캠퍼스(modern_campus) 야외 구성기 — 용도(학교 school | 대학 university)·씨앗·맵 크기만 주면 매번 다른 교정을 짠다.
//
// 왜: 옛 compose_campus_grounds 는 견본 한 장을 붙이는 «템플릿 구성기»라 씨앗이 들꽃만 바꿨다. jp_city 거리 구성기(jpCityStreetComposer.ts)처럼
//   계획(구역) → 건물(블록 조립 키트, 문 남향) → 길(문마다 접근칸에서 길망까지) → 소품(규칙·여백) 순서로 짠다. AI 는 용도·건물 목록을 고르고, 배치·조화는 이 함수가 한다.
// 조화 규칙(jp_city 적대 검수 교훈, ~/claude-viz/harmony-qa.html):
//   - 바닥은 한 재질(잔디) 위에 길·광장만 다른 재질로 낸다. 띠 전체를 한 칸으로 덮지 않는다 — 잔디 변주는 덩이 잡음(값 잡음 두 겹)으로 섞는다.
//   - 건물·소품은 발자국 + 여백 1칸을 예약하고 겹치지 않는다. 길 칸에는 소품을 두지 않는다. 문 앞 접근칸과 그 아래 한 칸은 비운다.
//   - 나무는 담 안쪽·운동장 가장자리·정원 덩이에만, 4칸 이상 띄운다. 가로등은 길 옆 5~6칸 간격.
// 순수 함수다(프로젝트를 모른다). 칸 번호는 호출자가 준 사전(palette)에서 얻는다 — 도구(campusTools.ts)는 번들 정의에서, QA 스크립트는 구운 JSON 에서.

import { plainFacadePatch } from "./campusDoors";

export type CampusStyle = "school" | "university";

export interface CampusKit {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly rows: readonly { readonly tiles: readonly number[]; readonly upperTiles?: readonly number[] }[];
  /** 출입구 부품(가로 문 칸) — 없으면 문 없는 소품. */
  readonly door?: { readonly dx: number; readonly w: number };
}

export interface CampusPalette {
  /** 한 칸 바닥 조각 id(mc-lawn …) → 칸 번호. 없으면 -1. */
  tile(piece: string): number;
  kit(id: string): CampusKit | undefined;
}

export interface CampusCell { readonly x: number; readonly y: number }
export interface CampusBuilding {
  readonly name: string; readonly kit: string; readonly rect: { x: number; y: number; w: number; h: number };
  /** 문 칸·접근칸 자리(문이 없는 건물도 «문이 있었을 자리»를 가진다 — 나중에 link_campus_interior 가 문을 낼 때 쓴다). */
  readonly doors: CampusCell[]; readonly access: CampusCell[];
  /** true 면 문 그림이 찍혔다 = 호출자가 접근칸에 실내 이동을 반드시 잇는다. false 면 문 없는 벽면(장식 문 금지). */
  readonly entrance: boolean;
}

export interface CampusSpec {
  readonly width: number;
  readonly height: number;
  readonly style: CampusStyle;
  readonly seed?: number;
  /** 건물 교체(키트 id 끝말, 예 school-12·library). 슬롯 순서는 MIN_SIZE 옆 설명. 비우면 씨앗이 고른다. */
  readonly buildings?: readonly string[];
  /**
   * 문을 낼 건물(키트 끝말 또는 "all"). 비우면 어느 건물에도 문이 없다 — 문 그림은 안으로 이어질 때만 찍는다(장식 문 금지).
   * 여기 적은 건물의 문은 호출자가 반드시 실내에 잇는다(도구는 같은 호출에서 잇거나, 못 이으면 맵을 바꾸지 않는다).
   */
  readonly entrances?: readonly string[];
}

export interface CampusResult {
  readonly lower: number[];
  readonly upper: number[];
  readonly buildings: CampusBuilding[];
  readonly start: CampusCell;
  readonly gate: CampusCell[];
  readonly props: { kit: string; x: number; y: number }[];
  readonly notes: string[];
}

/** 최소 크기. school 슬롯: [본관, 왼쪽 동, 오른쪽 동] · university 슬롯: [북쪽 가운데, 북쪽 왼쪽, 북쪽 오른쪽, 남쪽 왼쪽, 남쪽 오른쪽]. */
export const CAMPUS_MIN_SIZE: Readonly<Record<CampusStyle, { w: number; h: number }>> = { school: { w: 48, h: 36 }, university: { w: 52, h: 40 } };

const BUILDING_NAME: Readonly<Record<string, string>> = {
  "mc-bld-school-12": "본관", "mc-bld-school-8": "본관", "mc-bld-school-annex": "별관", "mc-bld-school-6": "별관", "mc-bld-cafeteria": "급식동",
  "mc-bld-gym": "체육관", "mc-bld-gym-green": "강당", "mc-bld-hall-12": "대강의동", "mc-bld-hall-9": "강의동", "mc-bld-hall-7": "학과동", "mc-bld-hall-6": "학과동",
  "mc-bld-library": "도서관", "mc-bld-admin": "대학 본부", "mc-bld-union": "학생회관", "mc-bld-lab": "연구동", "mc-bld-dorm-7": "기숙사", "mc-bld-dorm-5": "기숙사", "mc-bld-dorm-flat": "기숙사",
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
/** 값 잡음(격자 g 칸, 쌍선형) — 잔디 덩이 변주. */
function vnoise(x: number, y: number, g: number, s: number): number {
  const gx = Math.floor(x / g), gy = Math.floor(y / g), fx = (x % g) / g, fy = (y % g) / g;
  const a = hash2(gx, gy, s), b = hash2(gx + 1, gy, s), c = hash2(gx, gy + 1, s), d = hash2(gx + 1, gy + 1, s);
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}

type Use = "lawn" | "path" | "plaza" | "road" | "walk" | "field" | "bld" | "prop" | "wall" | "bed";
interface Rect { x: number; y: number; w: number; h: number }

class Board {
  readonly lower: number[];
  readonly upper: number[];
  readonly use: Use[];
  readonly reserved: boolean[];
  readonly buildings: CampusBuilding[] = [];
  readonly props: { kit: string; x: number; y: number }[] = [];
  readonly notes: string[] = [];
  /** 문을 낼 키트 id 집합(비면 아무도 없음) · all 이면 전부. */
  entrances: ReadonlySet<string> = new Set();
  entranceAll = false;
  constructor(readonly W: number, readonly H: number, readonly pal: CampusPalette, ground: number) {
    this.lower = new Array(W * H).fill(ground);
    this.upper = new Array(W * H).fill(-1);
    this.use = new Array(W * H).fill("lawn");
    this.reserved = new Array(W * H).fill(false);
  }
  in(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
  t(piece: string): number {
    const id = this.pal.tile(piece);
    if (id < 0) throw new Error(`캠퍼스 칩셋에 바닥 조각 ${piece} 이 없다`);
    return id;
  }
  fill(piece: string, r: Rect, use: Use): void {
    const id = this.t(piece);
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      if (!this.in(x, y)) continue;
      const k = y * this.W + x;
      if (this.use[k] === "bld" || this.use[k] === "prop" || this.use[k] === "wall") continue;
      this.lower[k] = id; this.use[k] = use;
    }
  }
  free(r: Rect, margin: number, allow: readonly Use[] = ["lawn"]): boolean {
    for (let y = r.y - margin; y < r.y + r.h + margin; y++) for (let x = r.x - margin; x < r.x + r.w + margin; x++) {
      const inside = x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
      if (!this.in(x, y)) { if (inside) return false; continue; }
      const k = y * this.W + x;
      if (inside) { if (!allow.includes(this.use[k]!) || this.reserved[k]) return false; }
      else if (this.use[k] === "bld" || this.use[k] === "prop" || this.reserved[k]) return false;
    }
    return true;
  }
  reserve(r: Rect): void {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (this.in(x, y)) this.reserved[y * this.W + x] = true;
  }
  stamp(kitId: string, x: number, y: number, use: Use): CampusKit {
    const kit = this.pal.kit(kitId);
    if (!kit) throw new Error(`캠퍼스 칩셋에 키트 ${kitId} 가 없다`);
    kit.rows.forEach((row, r) => {
      for (let c = 0; c < kit.width; c++) {
        const X = x + c, Y = y + r;
        if (!this.in(X, Y)) continue;
        const k = Y * this.W + X, lo = row.tiles[c] ?? -1, up = row.upperTiles?.[c] ?? -1;
        if (lo < 0 && up < 0) continue;
        if (lo >= 0) this.lower[k] = lo;
        if (up >= 0) this.upper[k] = up;
        this.use[k] = use;
      }
    });
    return kit;
  }
  /** 소품 하나: 발자국(+여백)이 비었을 때만. */
  prop(kitId: string, x: number, y: number, margin = 1, allow: readonly Use[] = ["lawn"]): boolean {
    const kit = this.pal.kit(kitId);
    if (!kit) return false;
    const r = { x, y, w: kit.width, h: kit.height };
    if (!this.free(r, margin, allow)) return false;
    this.stamp(kitId, x, y, "prop"); this.props.push({ kit: kitId, x, y });
    return true;
  }
  building(kitId: string, x: number, y: number): CampusBuilding {
    const kit = this.stamp(kitId, x, y, "bld");
    const entrance = !!kit.door && (this.entranceAll || this.entrances.has(kitId));
    // 문을 내지 않는 건물은 문 칸을 옆 벽 타일로 덮는다 — 문 그림은 안으로 이어지는 건물에만 있다.
    if (!entrance) {
      for (const p of plainFacadePatch(kit)) {
        const X = x + p.col, Y = y + p.row;
        if (!this.in(X, Y)) continue;
        const k = Y * this.W + X;
        this.lower[k] = p.lower >= 0 ? p.lower : this.lower[k]!;
        this.upper[k] = p.upper;
      }
    }
    const d = kit.door ?? { dx: Math.floor(kit.width / 2) - 1, w: 2 };
    const doors = Array.from({ length: d.w }, (_, i) => ({ x: x + d.dx + i, y: y + kit.height - 1 }));
    const access = doors.map((c) => ({ x: c.x, y: c.y + 1 }));
    // 접근칸과 그 아래 한 칸은 비운다(소품·나무 금지)
    for (const a of access) { this.reserve({ x: a.x, y: a.y, w: 1, h: 2 }); }
    const b = { name: BUILDING_NAME[kitId] ?? kitId, kit: kitId, rect: { x, y, w: kit.width, h: kit.height }, doors, access, entrance };
    this.buildings.push(b);
    return b;
  }
  kitSize(id: string): { w: number; h: number } {
    const k = this.pal.kit(id);
    if (!k) throw new Error(`캠퍼스 칩셋에 키트 ${id} 가 없다`);
    return { w: k.width, h: k.height };
  }
  /** 문 접근칸에서 길(path·plaza·walk)까지 곧은 길(아래로 → 옆으로)을 낸다. */
  connect(b: CampusBuilding, piece = "pave-path"): void {
    if (!b.entrance) return; // 문 없는 벽면 앞에는 길을 내지 않는다(막다른 포석 금지)
    const isNet = (x: number, y: number) => this.in(x, y) && ["path", "plaza", "walk"].includes(this.use[y * this.W + x]!);
    const a0 = b.access[0]!, w = b.access.length;
    let y = a0.y;
    const done = () => b.access.some((a) => isNet(a.x, y));
    for (let guard = 0; guard < this.H && !done(); guard++) {
      this.fill(piece, { x: a0.x, y, w, h: 1 }, "path");
      if (b.access.some((a) => isNet(a.x, y + 1))) return;
      // 옆으로 가까운 길이 있으면 가로로 잇는다
      for (let dist = 1; dist < this.W; dist++) {
        for (const dir of [-1, 1]) {
          const x = dir < 0 ? a0.x - dist : a0.x + w - 1 + dist;
          if (!this.in(x, y)) continue;
          if (isNet(x, y)) {
            const x0 = Math.min(x, a0.x), x1 = Math.max(x, a0.x + w - 1);
            let blocked = false;
            for (let i = x0; i <= x1; i++) { const u = this.use[y * this.W + i]; if (u === "bld" || u === "prop" || u === "wall") blocked = true; }
            if (!blocked && dist <= 14) { this.fill(piece, { x: x0, y, w: x1 - x0 + 1, h: 1 }, "path"); return; }
          }
        }
      }
      y++;
    }
  }
  /** 바닥 변주: 남은 잔디 칸에 큰 덩이 잡음으로 짙은 잔디를, 드문 무리로만 들꽃을 섞는다(띠 통째·자잘한 점 금지 — QA D2).
   *  나무 밑 «그늘 잔디» 칸은 칸 경계가 딱딱한 네모로 보여 쓰지 않는다(QA D1). */
  groundVariety(seed: number): void {
    const lawn = this.t("lawn"), lawnB = this.pal.tile("lawn-b"), flower = this.pal.tile("lawn-flower");
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      const k = y * this.W + x;
      if (this.use[k] !== "lawn" || this.lower[k] !== lawn) continue;
      const n = vnoise(x + 1000, y + 1000, 7, seed) * 0.8 + vnoise(x + 1000, y + 1000, 3, seed + 7) * 0.2;
      const f = vnoise(x + 500, y + 500, 6, seed + 13);
      if (lawnB >= 0 && n > 0.64) this.lower[k] = lawnB;
      else if (flower >= 0 && f < 0.16 && hash2(x, y, seed + 3) < 0.45) this.lower[k] = flower;
    }
  }
  /** 큰 빈 잔디(7×7 이 통째로 빈 곳)에 작은 숲 덩이(나무 하나 + 관목 한두 포기)를 둔다 — 「텅 빈 잔디밭」 방지(QA D4).
   *  quality-b: 7×7 덩이는 넓은 수관의 큰 느티나무(mc-tree-zelkova-l, 3×4)를 먼저 쓰고, 남은 5×5 빈 잔디에는 작은 나무를 한 번 더 둔다. */
  groves(rng: () => number, max: number): number {
    let n = 0;
    const bush = () => pick(rng, ["mc-shrub", "mc-azalea", "mc-shrub"]);
    const hasBig = !!this.pal.kit("mc-tree-zelkova-l");
    for (let tries = 0; tries < 400 && n < max; tries++) {
      const big = hasBig && rng() < 0.75;
      const [fw, fh] = big ? [5, 6] : [7, 7];
      const x = 1 + Math.floor(rng() * (this.W - fw - 1)), y = 1 + Math.floor(rng() * (this.H - fh - 1));
      if (!this.free({ x, y, w: fw, h: fh }, 0)) continue;
      if (big) {
        if (!this.prop("mc-tree-zelkova-l", x + 1, y + 1, 0)) continue;
        n++;
        if (rng() < 0.6) this.prop(bush(), x + (rng() < 0.5 ? 0 : 4), y + 5, 0);
        continue;
      }
      const tree = pick(rng, ["mc-tree-zelkova", "mc-tree-ginkgo", "mc-tree-cherry", "mc-tree-pine"]);
      if (!this.prop(tree, x + 2 + Math.floor(rng() * 2), y + 1, 1)) continue;
      n++;
      this.prop(bush(), x + 1, y + 4, 0); if (rng() < 0.6) this.prop(bush(), x + 5, y + 4, 0); if (rng() < 0.4) this.prop(bush(), x + 4, y + 5, 0);
    }
    for (let tries = 0; tries < 300 && n < max * 2; tries++) {
      const x = 1 + Math.floor(rng() * (this.W - 6)), y = 1 + Math.floor(rng() * (this.H - 6));
      if (!this.free({ x, y, w: 5, h: 5 }, 0)) continue;
      if (!this.prop(pick(rng, ["mc-tree-zelkova", "mc-tree-zelkova", "mc-tree-pine", "mc-tree-cherry"]), x + 1 + Math.floor(rng() * 2), y + 1, 0)) continue;
      n++;
      if (rng() < 0.5) this.prop(bush(), x + (rng() < 0.5 ? 0 : 3), y + 4, 0);
    }
    return n;
  }
  /** 잔디 덩이 가장자리에 연석(길 쪽 변) — 잔디 칸 중 북/남/서/동이 포장(길·광장)인 칸. */
  curbs(): void {
    const paved = (x: number, y: number) => this.in(x, y) && ["path", "plaza"].includes(this.use[y * this.W + x]!);
    const name = (n: boolean, s: boolean, w: boolean, e: boolean): string | null => {
      if (n && w) return "curb-nw"; if (n && e) return "curb-ne"; if (s && w) return "curb-sw"; if (s && e) return "curb-se";
      if (n) return "curb-n"; if (s) return "curb-s"; if (w) return "curb-w"; if (e) return "curb-e";
      return null;
    };
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      const k = y * this.W + x;
      if (this.use[k] !== "lawn") continue;
      const nm = name(paved(x, y - 1), paved(x, y + 1), paved(x - 1, y), paved(x + 1, y));
      if (!nm) continue;
      const id = this.pal.tile(nm);
      if (id >= 0) { this.lower[k] = id; this.use[k] = "bed"; }
    }
  }
}

function pick<T>(rng: () => number, xs: readonly T[]): T { return xs[Math.floor(rng() * xs.length)]!; }
function kitIdOf(name: string): string { return name.startsWith("mc-") ? name : name.startsWith("bld-") ? `mc-${name}` : `mc-bld-${name}`; }

/** 남쪽 도로·보도(맨 아래 4줄). */
function street(b: Board): { walkY: number } {
  const { W, H } = b;
  b.fill("asphalt", { x: 0, y: H - 3, w: W, h: 3 }, "road");
  b.fill("asphalt-dash", { x: 0, y: H - 2, w: W, h: 1 }, "road");
  for (let x = 1; x < W; x += 2) b.fill("asphalt", { x, y: H - 2, w: 1, h: 1 }, "road");
  b.fill("sidewalk", { x: 0, y: H - 4, w: W, h: 1 }, "walk");
  return { walkY: H - 4 };
}

/** 나무 줄: y0 줄(나무 발 줄)에 x 범위를 step 칸 간격으로. */
function treeRow(b: Board, rng: () => number, x0: number, x1: number, footY: number, kinds: readonly string[], step = 5, margin = 1): number {
  // 같은 간격·같은 나무가 늘어선 «도장 찍은 줄»을 피한다(QA D5): 간격을 흔들고, 네 번에 한 번은 관목 한 쌍으로 바꾼다.
  let n = 0;
  for (let x = x0; x <= x1 - 2; x += step + Math.floor(rng() * 3) - 1) {
    if (rng() < 0.25) { b.prop(pick(rng, ["mc-shrub", "mc-azalea"]), x, footY, 0); b.prop(pick(rng, ["mc-shrub", "mc-azalea"]), x + 1, footY, 0); continue; }
    const kit = pick(rng, kinds); const sz = b.kitSize(kit);
    if (b.prop(kit, x + Math.floor(rng() * 2), footY - sz.h + 1, margin)) n++;
  }
  return n;
}

function lampsAlong(b: Board, cells: readonly CampusCell[], every: number): void {
  cells.forEach((c, i) => { if (i % every === 0) b.prop("mc-lamp-post", c.x, c.y - 1, 0); });
}

// ───────────────────────── 학교 ─────────────────────────
function composeSchool(b: Board, rng: () => number, want: readonly string[]): { start: CampusCell; gate: CampusCell[] } {
  const { W, H, pal } = b;
  const { walkY } = street(b);
  const wallY = H - 6;                                   // 남쪽 담(2줄: wallY, wallY+1)
  const inBottom = wallY - 1;
  const playEast = rng() < 0.5;
  // 북쪽 담
  for (let x = 0; x < W; x++) { b.stamp("mc-wall-brick", x, 0, "wall"); }
  // 건물 북쪽 줄: [옆동][본관][체육관] 밑변 맞춤
  const mainId = kitIdOf(want[0] ?? (W >= 52 ? "school-12" : "school-8"));
  const sideId = kitIdOf(want[1] ?? pick(rng, ["school-annex", "school-6", "cafeteria"]));
  const gymId = kitIdOf(want[2] ?? pick(rng, ["gym", "gym-green"]));
  const m = b.kitSize(mainId), s = b.kitSize(sideId), g = b.kitSize(gymId);
  const gap = 3;
  const total = s.w + gap + m.w + gap + g.w;
  const left = Math.max(2, Math.floor((W - total) / 2) + Math.floor(rng() * 3) - 1);
  const baseY = 2 + m.h - 1;                            // 북쪽 줄 밑변
  const order = playEast ? [[sideId, s], [mainId, m], [gymId, g]] as const : [[gymId, g], [mainId, m], [sideId, s]] as const;
  let x = left;
  const blds: CampusBuilding[] = [];
  for (const [id, sz] of order) { blds.push(b.building(id, x, baseY - sz.h + 1)); x += sz.w + gap; }
  const main = blds[1]!;
  // 앞 광장(3줄) — 세 건물 문 앞을 잇는다
  const plazaY = baseY + 1;
  const px0 = left - 1, px1 = x - gap + 1;
  b.fill("pave-brick", { x: px0, y: plazaY, w: px1 - px0, h: 3 }, "plaza");
  // 교문·주 통로: 운동장 반대쪽 반의 가운데
  const halfW = Math.floor(W / 2);
  const gx = playEast ? Math.max(4, Math.floor(halfW / 2) - 1) : Math.min(W - 8, halfW + Math.floor(halfW / 2) - 1);
  const gw = 4;
  b.fill("pave-path", { x: gx, y: plazaY + 3, w: gw, h: wallY - plazaY - 3 }, "path");
  b.fill("pave-granite", { x: gx, y: wallY, w: gw, h: 2 }, "plaza");
  b.fill("crosswalk", { x: gx, y: H - 3, w: gw, h: 3 }, "road");
  for (let xx = 0; xx < W; xx++) {
    if (xx >= gx - 1 && xx <= gx + gw) continue;
    if (xx >= gx + gw + 1 && xx <= gx + gw + 3) continue;
    b.stamp("mc-wall-brick", xx, wallY, "wall");
  }
  // 교문 기둥·미닫이문 — 칩셋에 없으면(관문 미통과로 빠진 판) 담 조각으로 메운다
  for (const px of [gx - 1, gx + gw]) {
    if (pal.kit("mc-gate-pillar")) b.stamp("mc-gate-pillar", px, wallY + 2 - b.kitSize("mc-gate-pillar").h, "wall"); else b.stamp("mc-wall-brick", px, wallY, "wall");
  }
  if (pal.kit("mc-gate-slide")) b.stamp("mc-gate-slide", gx + gw + 1, wallY + 2 - b.kitSize("mc-gate-slide").h, "wall");
  else for (let xx = gx + gw + 1; xx <= gx + gw + 3; xx++) b.stamp("mc-wall-brick", xx, wallY, "wall");
  const gate = Array.from({ length: gw }, (_, i) => ({ x: gx + i, y: wallY + 1 }));
  // 운동장(흙 + 흰 선 테)
  // 운동장은 주 통로 옆 스탠드 띠(5칸)를 뺀 쪽 전체를 쓴다 — 반으로 자르면 48×36 에서 운동장이 빠졌다(QA D3).
  const fx0 = playEast ? gx + gw + 6 : 2, fx1 = playEast ? W - 3 : gx - 7;
  const fy0 = plazaY + 5, fy1 = inBottom - 4;
  if (fx1 - fx0 >= 10 && fy1 - fy0 >= 6) {
    b.fill("dirt", { x: fx0, y: fy0, w: fx1 - fx0 + 1, h: fy1 - fy0 + 1 }, "field");
    b.fill("dirt-line", { x: fx0 + 1, y: fy0 + 1, w: fx1 - fx0 - 1, h: 1 }, "field");
    b.fill("dirt-line", { x: fx0 + 1, y: fy1 - 1, w: fx1 - fx0 - 1, h: 1 }, "field");
    b.fill("dirt-line", { x: fx0 + 1, y: Math.floor((fy0 + fy1) / 2), w: fx1 - fx0 - 1, h: 1 }, "field");
    const cx = Math.floor((fx0 + fx1) / 2) - 1;
    b.prop("mc-soccer-goal", cx, fy0 + 1, 0, ["field"]);
    b.prop("mc-soccer-goal", cx, fy1 - 2, 0, ["field"]);
    // 스탠드: 운동장과 통로 사이 잔디 띠
    const standX = playEast ? fx0 - 5 : fx1 + 1;
    for (let yy = fy0 + 1; yy + 2 <= fy1; yy += 4) b.prop("mc-bleachers", standX, yy, 0);
    // 운동장 바깥 가장자리: 철봉·농구대·점수판
    const outX = playEast ? W - 3 : 0;
    b.prop("mc-scoreboard", Math.floor((fx0 + fx1) / 2) - 1, fy0 - 4, 0);
    b.prop("mc-pullup-bars", playEast ? fx1 - 3 : fx0, fy1 + 1, 0);
    b.prop("mc-basket-hoop", outX, fy0 + 1, 0);
  } else b.notes.push("운동장을 놓을 자리가 좁아 뺐다");
  // 광장 꾸밈: 본관 문 양옆 화분, 국기 게양대, 학교 돌, 자판기
  const md = main.doors[0]!;
  b.prop("mc-planter", md.x - 4, plazaY, 0, ["plaza"]);
  b.prop("mc-planter", md.x + main.doors.length + 2, plazaY, 0, ["plaza"]);
  b.prop("mc-flagpole", md.x - 2, plazaY + 3, 0);
  b.prop("mc-school-stone", playEast ? gx - 4 : gx + gw + 2, wallY - 3, 0);
  b.prop("mc-guard-booth", playEast ? gx + gw + 1 : gx - 3, wallY - 3, 0);
  for (const bb of blds) {
    if (bb === main) continue;
    const a = bb.access[bb.access.length - 1]!;
    if (/gym/.test(bb.kit)) { b.prop("mc-vending", a.x + 2, a.y - 1, 0, ["plaza"]); b.prop("mc-recycle-bins", a.x + 4, a.y, 0, ["plaza"]); }
    else { b.prop("mc-bike-rack", a.x + 2, a.y + 1, 0, ["plaza"]); b.prop("mc-trash-bin", a.x - 3, a.y, 0, ["plaza"]); }
  }
  // 정원(운동장 반대쪽): 퍼걸러·벤치·화단 덩이
  const gardenX0 = playEast ? 2 : halfW + 1, gardenX1 = playEast ? gx - 2 : W - 3;
  const gy0 = plazaY + 4;
  if (gardenX1 - gardenX0 >= 6) {
    b.prop("mc-pergola", gardenX0 + 1 + Math.floor(rng() * 2), gy0 + 1, 1);
    for (let yy = gy0 + 1; yy < inBottom - 3; yy += 4) b.prop("mc-bench", playEast ? gx - 3 : gx + gw + 1, yy, 0);
    for (let k = 0; k < 6; k++) b.prop(pick(rng, ["mc-azalea", "mc-shrub", "mc-planter-round"]), gardenX0 + Math.floor(rng() * (gardenX1 - gardenX0)), gy0 + 4 + Math.floor(rng() * Math.max(1, inBottom - gy0 - 8)), 1);
  }
  // 가로등: 주 통로 양옆
  const pathCells: CampusCell[] = [];
  for (let yy = plazaY + 4; yy < wallY - 1; yy++) pathCells.push({ x: (yy % 2 ? gx - 1 : gx + gw), y: yy });
  lampsAlong(b, pathCells, 5);
  // 나무: 남쪽 담 안쪽 줄 · 북쪽 담 안쪽(건물 사이) · 정원
  treeRow(b, rng, 1, W - 2, inBottom, ["mc-tree-cherry", "mc-tree-zelkova", "mc-tree-ginkgo"], 5);
  treeRow(b, rng, 1, W - 2, plazaY - 1, ["mc-tree-pine", "mc-tree-zelkova"], 4);
  if (gardenX1 - gardenX0 >= 6) treeRow(b, rng, gardenX0, gardenX1, inBottom - 5, ["mc-tree-cherry", "mc-tree-ginkgo"], 5);
  for (const bb of blds) b.connect(bb);
  b.groves(rng, Math.floor(W * H / 260));
  return { start: { x: gx + 1, y: walkY }, gate };
}

// ───────────────────────── 대학 ─────────────────────────
function composeUniversity(b: Board, rng: () => number, want: readonly string[]): { start: CampusCell; gate: CampusCell[] } {
  const { W, H } = b;
  const { walkY } = street(b);
  const hedgeY = H - 5, frontY = H - 6;
  // 남쪽 줄(본부·학생회관) — 문은 앞길(frontY)로
  const cx = Math.floor(W / 2) + Math.floor(rng() * 3) - 1;
  const bw = 3;                                          // 가로수길 폭
  const southL = kitIdOf(want[3] ?? pick(rng, ["admin", "hall-9"]));
  const southR = kitIdOf(want[4] ?? pick(rng, ["union", "lab", "hall-7"]));
  const sl = b.kitSize(southL), sr = b.kitSize(southR);
  b.fill("pave-brick", { x: 1, y: frontY, w: W - 2, h: 1 }, "walk");
  const slx = cx - Math.floor(bw / 2) - 3 - sl.w, srx = cx + Math.ceil(bw / 2) + 3;
  const southTop = frontY - Math.max(sl.h, sr.h);
  const bS: CampusBuilding[] = [];
  if (slx >= 1) bS.push(b.building(southL, slx, frontY - sl.h)); else b.notes.push("남쪽 왼쪽 건물을 놓을 폭이 없다");
  if (srx + sr.w <= W - 1) bS.push(b.building(southR, srx, frontY - sr.h)); else b.notes.push("남쪽 오른쪽 건물을 놓을 폭이 없다");
  // 울타리(생울타리)·교문
  const gx = cx - Math.floor(bw / 2) - 1, gw = bw + 2;
  for (let x = 0; x + 2 <= W; x += 2) { if (x + 1 >= gx && x <= gx + gw - 1) continue; b.stamp("mc-hedge", x, hedgeY, "wall"); }
  b.fill("pave-granite", { x: gx, y: hedgeY, w: gw, h: 2 }, "plaza");
  b.fill("crosswalk", { x: gx, y: H - 3, w: gw, h: 3 }, "road");
  b.prop("mc-bollard", gx - 1, hedgeY, 0, ["lawn", "walk", "plaza"]);
  b.prop("mc-bollard", gx + gw, hedgeY, 0, ["lawn", "walk", "plaza"]);
  const gate = Array.from({ length: gw }, (_, i) => ({ x: gx + i, y: hedgeY }));
  // 쿼드: 북쪽 줄 밑과 남쪽 줄 위 사이
  // 같은 키트를 두 번 고르지 않는다(QA D6: 도서관 둘이 나란히 섰다)
  const used = new Set<string>([southL, southR]);
  const take = (w: string | undefined, xs: readonly string[]): string => { const id = kitIdOf(w ?? pick(rng, xs.filter((x) => !used.has(kitIdOf(x))))); used.add(id); return id; };
  const northC = take(want[0], ["hall-12", "library"]);
  const northL = take(want[1], ["hall-9", "hall-7", "lab"]);
  const northR = take(want[2], ["library", "dorm-7", "hall-6", "dorm-5"]);
  const nc = b.kitSize(northC), nl = b.kitSize(northL), nr = b.kitSize(northR);
  const nH = Math.max(nc.h, nl.h, nr.h);
  const nBase = 1 + nH;                                  // 북쪽 줄 밑변 y
  const ringTop = nBase + 1, ringBot = southTop - 3;     // 둘레 길(2줄) 위·아래 첫 줄
  const qx0 = 4, qx1 = W - 5;
  // 건물 앞 길(북쪽)은 벽돌 포석, 남쪽 길은 판석 — 양옆 다리는 두지 않는다(QA D7: 둘레 회색 테가 화면을 덮었다).
  b.fill("pave-brick", { x: qx0 - 2, y: ringTop, w: qx1 - qx0 + 5, h: 2 }, "path");
  b.fill("pave-path", { x: qx0, y: ringBot, w: qx1 - qx0 + 1, h: 2 }, "path");
  // 십자 길 + 가운데 분수 광장
  const qmy = Math.floor((ringTop + 2 + ringBot - 1) / 2);
  b.fill("pave-path", { x: cx - 1, y: ringTop + 2, w: 2, h: ringBot - ringTop - 2 }, "path");
  b.fill("pave-path", { x: qx0, y: qmy, w: qx1 - qx0 + 1, h: 2 }, "path");
  b.fill("pave-granite", { x: cx - 3, y: qmy - 2, w: 6, h: 6 }, "plaza");
  b.prop("mc-fountain-anim", cx - 2, qmy - 1, 0, ["plaza"]) || b.prop("mc-fountain", cx - 2, qmy - 1, 0, ["plaza"]);
  // 시계탑은 나무·가로등보다 먼저 쿼드 북동 잔디 판 가운데에(QA D8: 나중에 놓다가 자리를 잃었다)
  const ct = b.kitSize("mc-clock-tower");
  // 쿼드 반쪽이 6줄보다 낮으면 그 자리에 못 선다 — 북동·북서·남동·남서 잔디 판을 차례로 본다(여백 1 → 0).
  const ctSpots: [number, number][] = [];
  for (const qxMid of [Math.floor((cx + 2 + qx1) / 2) - 1, Math.floor((qx0 + cx - 2) / 2) - 1]) {
    for (let y = qmy - ct.h - 1; y >= ringTop + 2; y--) ctSpots.push([qxMid, y]);
    for (let y = qmy + 3; y + ct.h <= ringBot - 1; y++) ctSpots.push([qxMid, y]);
  }
  // 마지막: 교문 가로수길 동쪽, 남쪽 두 동 사이 잔디 띠(정문 들어서며 보이는 자리)
  for (const tx of [cx + 3, cx + 2]) for (let ty = frontY - ct.h; ty >= frontY - ct.h - 2; ty--) ctSpots.push([tx, ty]);
  let ctOk = false;
  for (const margin of [1, 0]) { for (const [tx, ty] of ctSpots) if (!ctOk && b.prop("mc-clock-tower", tx, ty, margin)) ctOk = true; }
  if (!ctOk) b.notes.push("쿼드가 낮아 시계탑을 뺐다(맵을 더 높게 하면 선다)");
  // 분수 광장 네 모서리 화단(꽃)
  for (const [fx, fy] of [[cx - 4, qmy - 3], [cx + 3, qmy - 3], [cx - 4, qmy + 4], [cx + 3, qmy + 4]] as const) b.prop("mc-azalea", fx, fy, 0);
  // 가로수길: 교문 → 둘레 길 아래
  b.fill("pave-brick", { x: cx - Math.floor(bw / 2), y: ringBot + 2, w: bw, h: hedgeY - ringBot - 2 }, "path");
  // 북쪽 줄 건물
  const nTotal = nl.w + 3 + nc.w + 3 + nr.w;
  let x = Math.max(1, cx - Math.floor(nc.w / 2) - 3 - nl.w);
  if (x + nTotal > W - 1) x = Math.max(1, W - 1 - nTotal);
  const bN: CampusBuilding[] = [];
  for (const [id, sz] of [[northL, nl], [northC, nc], [northR, nr]] as const) {
    if (x + sz.w <= W - 1) bN.push(b.building(id, x, nBase - sz.h + 1)); else b.notes.push(`${id} 를 놓을 폭이 없다`);
    x += sz.w + 3;
  }
  // 쿼드 둘레 나무(모서리 넷 + 긴 변), 벤치는 십자 길 옆 잔디
  treeRow(b, rng, qx0 + 1, cx - 5, ringTop + 2 + 3 - 1, ["mc-tree-zelkova", "mc-tree-ginkgo", "mc-tree-cherry"], 6);
  treeRow(b, rng, cx + 3, qx1 - 4, ringBot - 1, ["mc-tree-zelkova", "mc-tree-ginkgo", "mc-tree-cherry"], 6);
  treeRow(b, rng, qx0 + 1, cx - 5, ringBot - 1, ["mc-tree-cherry", "mc-tree-ginkgo"], 7);
  for (const bx of [cx - 9, cx + 6]) { b.prop("mc-bench", bx, qmy - 1, 0); b.prop("mc-bench", bx, qmy + 2, 0); }
  // 가로등: 십자 길 끝·둘레 길 모서리 잔디
  for (const [lx, ly] of [[qx0, ringTop + 2], [qx1 - 1, ringTop + 2], [qx0, ringBot - 2], [qx1 - 1, ringBot - 2], [cx - 3, ringTop + 3], [cx + 2, ringBot - 3]] as const) b.prop("mc-lamp-post", lx, ly, 0);
  // 가로수길 양옆 가로등·나무
  for (let yy = ringBot + 3; yy < hedgeY - 1; yy += 3) { b.prop("mc-lamp-post", cx - Math.floor(bw / 2) - 1, yy, 0); }
  // 건물 앞 꾸밈
  for (const bb of [...bN, ...bS]) {
    const a = bb.access[0]!, z = bb.access[bb.access.length - 1]!;
    if (/library/.test(bb.kit)) { b.prop("mc-bike-rack", z.x + 2, a.y + 1, 0, ["path", "lawn", "walk"]); b.prop("mc-bench", a.x - 4, a.y + 2, 0); }
    else if (/union/.test(bb.kit)) { b.prop("mc-parasol-table", z.x + 2, a.y - 1, 0, ["walk", "lawn"]); b.prop("mc-notice-board", a.x - 4, a.y - 1, 0, ["walk", "lawn"]); }
    // 앞길은 한 줄이라 그 위에 화분을 두면 길이 끊긴다(엔진 통행 검사로 찾음) — 화분은 건물 양 끝 잔디에.
    else if (/admin/.test(bb.kit)) { b.prop("mc-planter", bb.rect.x - 3, a.y - 1, 0); b.prop("mc-planter", bb.rect.x + bb.rect.w + 1, a.y - 1, 0); }
    else if (/dorm/.test(bb.kit)) { b.prop("mc-bike-rack", z.x + 2, a.y + 1, 0, ["path", "lawn"]); }
    else { b.prop("mc-trash-bin", z.x + 2, a.y, 0, ["path", "walk"]); }
  }
  b.prop("mc-campus-map", gx + gw + 1, frontY - 2, 0);
  b.prop("mc-school-stone", gx - 3, frontY - 2, 0);
  // 바깥 띠(북쪽 건물 뒤·양 끝) 나무
  treeRow(b, rng, 1, W - 2, southTop - 1, ["mc-tree-pine", "mc-tree-zelkova"], 5);
  for (const bb of [...bN, ...bS]) b.connect(bb);
  b.groves(rng, Math.floor(W * H / 220));
  return { start: { x: cx, y: walkY }, gate };
}

/** 교정 한 장을 짠다. 칸이 모자라면 Error(호출자가 ToolError 로 바꾼다). */
export function composeCampus(spec: CampusSpec, pal: CampusPalette): CampusResult {
  const min = CAMPUS_MIN_SIZE[spec.style];
  if (spec.width < min.w || spec.height < min.h) throw new Error(`맵이 작다(${spec.width}×${spec.height}) — ${spec.style} 는 ${min.w}×${min.h} 이상이어야 한다`);
  const seed = (spec.seed ?? 0) >>> 0;
  const rng = mulberry(seed * 7919 + (spec.style === "school" ? 11 : 23));
  const b = new Board(spec.width, spec.height, pal, pal.tile("lawn"));
  const want = spec.buildings ?? [];
  const asked = (spec.entrances ?? []).map((e) => e.trim()).filter(Boolean);
  b.entranceAll = asked.includes("all");
  b.entrances = new Set(asked.filter((e) => e !== "all").map(kitIdOf));
  const r = spec.style === "school" ? composeSchool(b, rng, want) : composeUniversity(b, rng, want);
  b.curbs();
  b.groundVariety(seed);
  return { lower: b.lower, upper: b.upper, buildings: b.buildings, start: r.start, gate: r.gate, props: b.props, notes: b.notes };
}

/** 번들 정의(TilesetDef 모양)에서 사전을 만든다: 한 칸 바닥은 그룹 `mc:<조각 id>`, 키트는 structureKits(출입구 부품). */
export function campusPaletteFromTileset(def: {
  readonly tileGroups?: readonly { readonly id: string; readonly tileIds: readonly number[] }[];
  readonly structureKits?: readonly unknown[];
}): CampusPalette {
  const groups = new Map((def.tileGroups ?? []).map((g) => [g.id, g.tileIds] as const));
  const kits = new Map<string, CampusKit>();
  for (const raw of def.structureKits ?? []) {
    const k = raw as { id: string; width: number; height: number; rows: CampusKit["rows"]; parts?: { kind: string; dx: number; w: number }[] };
    if (!k?.id || !Array.isArray(k.rows)) continue;
    const part = k.parts?.find((p) => p.kind === "entrance");
    kits.set(k.id, { id: k.id, width: k.width, height: k.height, rows: k.rows, door: part ? { dx: part.dx, w: part.w } : undefined });
  }
  return {
    tile: (piece) => groups.get(`mc:mc-${piece.replace(/^mc-/, "")}`)?.[0] ?? -1,
    kit: (id) => kits.get(id),
  };
}
