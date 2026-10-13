// project/desertEastComposer.ts
// 사막·동양풍(desert_east) 맵 구성기 — 용도(오아시스 마을·바자르 거리·궁전·피라미드 유적·대상 숙소)·씨앗·크기만 주면 매번 다른 한 장을 짠다.
//
// 순서: 계획(구역·용도) → 땅(꼭짓점 재질 격자: 모래·길·풀·물·사구·포석 → 모서리 왕 타일) → 건물(문은 남향, 접근칸은 길 위) → 소품(앵커 곁·여백).
// 조화 규칙(jp_city·캠퍼스 적대 검수 교훈, ~/claude-viz/harmony-qa.html):
//   - 땅은 «재질 하나 + 길·광장만 다른 재질». 재질 경계는 모서리 왕 타일로 부드럽게 잇는다(칸 경계에 딱딱한 네모가 생기지 않는다).
//   - 트인 모래는 한 칸 그림으로 띠째 덮지 않는다 — 잔잔한 모래 4변주를 덩이 잡음으로 섞고, 물결 모래·자갈 모래를 덩이로, 마을 밖에는 사구·바위·덤불·마른 풀로 평평함을 깬다.
//   - 건물·소품은 발자국 + 여백을 예약하고 겹치지 않는다. 길·광장·문 접근칸(그 아래 한 칸 포함)에는 소품을 두지 않는다.
//   - 물건은 맞는 땅 위에: 야자·갈대는 풀 위, 노점·분수·우물은 포석/길 위, 낙타·천막은 모래 위. 물에는 아무것도 두지 않는다.
//   - 모든 트인 구역은 용도를 갖는다(야자 숲·천막 야영지·폐허·사구 들판·밭…). «공간이 남으면 공간이 너무 큰 것» — 최소 크기를 지킨다.
// 순수 함수다(프로젝트를 모른다). 칸 번호는 호출자가 준 사전(palette)에서 얻는다 — 도구는 번들 정의에서, QA 스크립트는 구운 JSON 에서.

export type DesertKind = "oasis" | "bazaar" | "palace" | "pyramid" | "caravanserai";

export interface DesertKit {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly rows: readonly { readonly tiles: readonly number[]; readonly upperTiles?: readonly number[] }[];
  readonly door?: { readonly dx: number; readonly w: number };
}

export interface DesertPalette {
  /** 한 칸 바닥 조각 id(de-sand …) → 칸 번호. 없으면 -1. */
  tile(piece: string): number;
  /** 모서리 왕 타일: 벌(road·grass·water·dune·flag) × 번호(NW1+NE2+SW4+SE8) → 칸. */
  wang(set: string, idx: number): number;
  kit(id: string): DesertKit | undefined;
  /** 칸 번호가 걸을 수 있는가(아래층·위층 공통 판정). */
  passable(tile: number): boolean;
}

export interface DesertCell { readonly x: number; readonly y: number }
export interface DesertBuilding { readonly name: string; readonly kit: string; readonly rect: { x: number; y: number; w: number; h: number }; readonly doors: DesertCell[]; readonly access: DesertCell[] }
export interface DesertZone { readonly name: string; readonly use: string; readonly rect: { x: number; y: number; w: number; h: number } }

export interface DesertSpec {
  readonly width: number;
  readonly height: number;
  readonly kind: DesertKind;
  readonly seed?: number;
  /** QA 전용: 닿지 못한 문이 있어도 마지막 판을 돌려준다(notes 에 적는다). */
  readonly debugKeepUnreachable?: boolean;
}

export interface DesertResult {
  readonly lower: number[];
  readonly upper: number[];
  readonly buildings: DesertBuilding[];
  readonly zones: DesertZone[];
  readonly start: DesertCell;
  readonly props: { kit: string; x: number; y: number }[];
  readonly notes: string[];
}

export const DESERT_MIN_SIZE: Readonly<Record<DesertKind, { w: number; h: number }>> = {
  oasis: { w: 40, h: 32 }, bazaar: { w: 42, h: 30 }, palace: { w: 44, h: 36 }, pyramid: { w: 44, h: 34 }, caravanserai: { w: 36, h: 30 },
};
export const DESERT_KIND_LABEL: Readonly<Record<DesertKind, string>> = {
  oasis: "오아시스 마을", bazaar: "바자르 시장 거리", palace: "궁전과 궁정 마당", pyramid: "피라미드 유적", caravanserai: "대상 숙소(카라반사라이)",
};

const BUILDING_NAME: Readonly<Record<string, string>> = {
  "de-house-adobe-3": "흙집", "de-house-adobe-4": "흙집", "de-house-adobe-5": "큰 흙집", "de-house-stone-4": "사암 집", "de-house-plaster-4": "흰 집",
  "de-house-dome-4": "돔 집", "de-house-dome-white": "흰 돔 집", "de-house-2f": "2층 집", "de-house-shop": "가게", "de-house-windtower": "바람탑 집",
  "de-domed-hall": "회당", "de-palace": "궁전", "de-tent-bedouin": "유목 천막", "de-tent-pavilion": "정자 천막", "de-pyramid-door": "피라미드 입구", "de-ziggurat": "지구라트",
};

type Mat = "s" | "r" | "g" | "w" | "d" | "f";
type Use = "open" | "road" | "plaza" | "grass" | "water" | "bld" | "prop" | "wall" | "field";
interface Rect { x: number; y: number; w: number; h: number }

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
function pick<T>(rng: () => number, xs: readonly T[]): T { return xs[Math.floor(rng() * xs.length)]!; }
const WANG_SET: Readonly<Record<Exclude<Mat, "s">, string>> = { r: "road", g: "grass", w: "water", d: "dune", f: "flag" };

class Board {
  readonly lower: number[];
  readonly upper: number[];
  readonly use: Use[];
  readonly reserved: boolean[];
  readonly V: Mat[];
  readonly buildings: DesertBuilding[] = [];
  readonly zones: DesertZone[] = [];
  readonly props: { kit: string; x: number; y: number }[] = [];
  readonly notes: string[] = [];
  constructor(readonly W: number, readonly H: number, readonly pal: DesertPalette, readonly seed: number) {
    this.lower = new Array(W * H).fill(-1);
    this.upper = new Array(W * H).fill(-1);
    this.use = new Array(W * H).fill("open");
    this.reserved = new Array(W * H).fill(false);
    this.V = new Array((W + 1) * (H + 1)).fill("s");
  }
  in(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
  k(x: number, y: number): number { return y * this.W + x; }
  u(x: number, y: number): Use | undefined { return this.in(x, y) ? this.use[this.k(x, y)] : undefined; }
  /** 칸 사각형을 재질로(꼭짓점 전부). use 도 함께. */
  ground(r: Rect, m: Mat, use: Use): void {
    for (let y = r.y; y <= r.y + r.h; y++) for (let x = r.x; x <= r.x + r.w; x++) {
      if (x < 0 || y < 0 || x > this.W || y > this.H) continue;
      this.V[y * (this.W + 1) + x] = m;
    }
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      if (!this.in(x, y)) continue;
      const k = this.k(x, y);
      if (this.use[k] === "bld" || this.use[k] === "prop" || this.use[k] === "wall") continue;
      this.use[k] = use;
    }
  }
  vset(x: number, y: number, m: Mat): void { if (x >= 0 && y >= 0 && x <= this.W && y <= this.H) this.V[y * (this.W + 1) + x] = m; }
  vget(x: number, y: number): Mat { return this.V[Math.max(0, Math.min(this.H, y)) * (this.W + 1) + Math.max(0, Math.min(this.W, x))]!; }
  /** 칸이 모두 비었는가(+여백). allow = 안쪽에 허용하는 쓰임. */
  free(r: Rect, margin: number, allow: readonly Use[] = ["open"]): boolean {
    for (let y = r.y - margin; y < r.y + r.h + margin; y++) for (let x = r.x - margin; x < r.x + r.w + margin; x++) {
      const inside = x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
      if (!this.in(x, y)) { if (inside) return false; continue; }
      const k = this.k(x, y);
      if (inside) { if (!allow.includes(this.use[k]!) || this.reserved[k]) return false; }
      else if (this.use[k] === "bld" || this.use[k] === "prop" || this.use[k] === "wall" || this.reserved[k]) return false;
    }
    return true;
  }
  reserve(r: Rect): void { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (this.in(x, y)) this.reserved[this.k(x, y)] = true; }
  stamp(kitId: string, x: number, y: number, use: Use): DesertKit {
    const kit = this.pal.kit(kitId);
    if (!kit) throw new Error(`사막 칩셋에 키트 ${kitId} 가 없다`);
    kit.rows.forEach((row, r) => {
      for (let c = 0; c < kit.width; c++) {
        const X = x + c, Y = y + r;
        if (!this.in(X, Y)) continue;
        const k = this.k(X, Y), lo = row.tiles[c] ?? -1, up = row.upperTiles?.[c] ?? -1;
        // 빈 칸(키트 안 투명 칸)도 그 키트 자리다 — 다른 물건이 끼어들지 않게 쓰임만 잡는다(땅은 그대로 걸을 수 있다)
        if (lo < 0 && up < 0) { if (this.use[k] !== "road" && this.use[k] !== "plaza") this.use[k] = use; continue; }
        if (lo >= 0) this.lower[k] = lo;
        if (up >= 0) this.upper[k] = up;
        // 그림이 있는 통행 칸(성문 통로·차양 밑·아치 밑)은 쓰임을 길로 남기고 예약 — 소품이 막지 않게
        const pass = (lo < 0 || this.pal.passable(lo)) && (up < 0 || this.pal.passable(up));
        this.use[k] = pass && use !== "prop" ? "road" : use;
        if (pass) this.reserved[k] = true;
      }
    });
    return kit;
  }
  kitSize(id: string): { w: number; h: number } {
    const k = this.pal.kit(id);
    if (!k) throw new Error(`사막 칩셋에 키트 ${id} 가 없다`);
    return { w: k.width, h: k.height };
  }
  /** 소품 하나 — 발자국(+여백)이 비었고 발 밑 땅이 맞을 때만. */
  prop(kitId: string, x: number, y: number, margin = 1, allow: readonly Use[] = ["open"]): boolean {
    const kit = this.pal.kit(kitId);
    if (!kit) return false;
    const r = { x, y, w: kit.width, h: kit.height };
    if (!this.free(r, margin, allow)) return false;
    if (!this.feetOk(kitId, x, y + kit.height - 1, kit.width)) return false;
    this.stamp(kitId, x, y, "prop"); this.props.push({ kit: kitId, x, y });
    return true;
  }
  /** 발 밑(키트 맨 아랫줄 칸)의 네 꼭짓점이 모두 한 재질인가 — 재질 경계(길 가장자리·풀 끝)에 걸쳐 떠 보이지 않게.
   *  모래 소품(덤불·마른 풀·바위·낙타·천막류)은 모래(마른 풀은 사구도)에만, 야자·갈대·협죽도는 풀에만. 물에는 아무것도. */
  feetOk(kitId: string, x: number, y: number, w: number): boolean {
    const SAND_ONLY = /^de-(scrub|tuft|rock-small|aloe|boulder|outcrop|acacia|camel|camel-rest|tent-small)$/;
    const GRASS_ONLY = /^de-(palm-date|palm-young|palm-pair|reeds|oleander)$/;
    const want = GRASS_ONLY.test(kitId) ? "g" : SAND_ONLY.test(kitId) ? "s" : null;
    for (let i = 0; i < w; i++) {
      const c = [this.vget(x + i, y), this.vget(x + i + 1, y), this.vget(x + i, y + 1), this.vget(x + i + 1, y + 1)];
      if (want === "g" && kitId !== "de-reeds" && c.some((m) => m !== "g")) return false;
      if (kitId === "de-reeds" && !c.includes("g")) return false;
      if (want === "s" && c.some((m) => !(m === "s" || (kitId === "de-tuft" && m === "d")))) return false;
      if (!want && kitId !== "de-reeds" && c.every((m) => m === "w")) return false;
    }
    return true;
  }
  /** 건물 하나: 찍고, 문 칸·접근칸(문 바로 아래)을 기록, 접근칸과 그 아래 한 칸은 예약. */
  building(kitId: string, x: number, y: number): DesertBuilding {
    const kit = this.stamp(kitId, x, y, "bld");
    const d = kit.door;
    const doors = d ? Array.from({ length: d.w }, (_, i) => ({ x: x + d.dx + i, y: y + kit.height - 1 })) : [];
    const access = doors.map((c) => ({ x: c.x, y: c.y + 1 }));
    for (const a of access) this.reserve({ x: a.x, y: a.y, w: 1, h: 2 });
    const b = { name: BUILDING_NAME[kitId] ?? kitId.replace(/^de-/, ""), kit: kitId, rect: { x, y, w: kit.width, h: kit.height }, doors, access };
    this.buildings.push(b);
    return b;
  }
  zone(name: string, use: string, rect: Rect): void { this.zones.push({ name, use, rect }); }

  /** 접근칸에서 가장 가까운 길·광장까지 곧은 샛길(아래 → 옆). */
  connect(b: DesertBuilding, mat: Mat = "r"): void {
    if (!b.access.length) return;
    const isNet = (x: number, y: number) => this.u(x, y) === "road" || this.u(x, y) === "plaza";
    const a0 = b.access[0]!, w = b.access.length;
    let y = a0.y;
    for (let guard = 0; guard < this.H; guard++) {
      if (b.access.some((a) => isNet(a.x, y))) return;
      this.ground({ x: a0.x, y, w, h: 1 }, mat, "road");
      if (b.access.some((a) => isNet(a.x, y + 1))) return;
      for (let dist = 1; dist < 16; dist++) {
        for (const dir of [-1, 1]) {
          const x = dir < 0 ? a0.x - dist : a0.x + w - 1 + dist;
          if (!this.in(x, y) || !isNet(x, y)) continue;
          const x0 = Math.min(x, a0.x), x1 = Math.max(x, a0.x + w - 1);
          let blocked = false;
          for (let i = x0; i <= x1; i++) { const u = this.use[this.k(i, y)]; if (u === "bld" || u === "prop" || u === "wall" || u === "water") blocked = true; }
          if (!blocked) { this.ground({ x: x0, y, w: x1 - x0 + 1, h: 1 }, mat, "road"); return; }
        }
      }
      y++;
      if (y >= this.H) return;
    }
  }

  /** 땅 칠하기: 꼭짓점 재질 → 칸마다 모서리 왕 타일 또는 순수 재질 변주. 이미 키트가 아래층을 쓴 칸은 건드리지 않는다. */
  paintGround(): void {
    const s = this.seed;
    const sandVars = ["de-sand", "de-sand-b", "de-sand-c", "de-sand-d"].map((t) => this.pal.tile(t)).filter((t) => t >= 0);
    const ripple = this.pal.tile("de-sand-ripple"), pebble = this.pal.tile("de-sand-pebble");
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      const k = this.k(x, y);
      if (this.lower[k] >= 0) continue;
      const c = [this.vget(x, y), this.vget(x + 1, y), this.vget(x, y + 1), this.vget(x + 1, y + 1)];
      const over = c.filter((m) => m !== "s");
      if (!over.length) {
        // 순수 모래: 잔잔한 4변주를 칸마다 섞고, 덩이 잡음으로 물결 모래·자갈 모래 덩이
        const n = vnoise(x, y, 6, s + 11), q = vnoise(x + 300, y + 300, 5, s + 23);
        if (ripple >= 0 && n > 0.66 && this.use[k] === "open") this.lower[k] = ripple;
        else if (pebble >= 0 && q > 0.74 && hash2(x, y, s + 5) < 0.5 && this.use[k] === "open") this.lower[k] = pebble;
        else this.lower[k] = sandVars[Math.floor(hash2(x, y, s + 3) * sandVars.length)] ?? sandVars[0]!;
        continue;
      }
      // 물이 끼면 물 벌(바탕 = 풀). 아니면 가장 많은 덧 재질 하나(나머지는 바탕 모래로 본다).
      let set: Exclude<Mat, "s">;
      if (over.includes("w")) set = "w";
      else {
        const cnt = new Map<Mat, number>(); for (const m of over) cnt.set(m, (cnt.get(m) ?? 0) + 1);
        set = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0]![0] as Exclude<Mat, "s">;
      }
      // 두 덧 재질이 만나는 칸(흙길↔포석, 풀↔포석)은 둘 다 많은 쪽으로 센다 — 사이에 모래 이(V자 틈)가 끼지 않게(적대 검수 2026-10-14).
      const idx = c.reduce((acc, m, i) => acc + ((set === "w" ? m === "w" : m !== "s") ? 1 << i : 0), 0);
      if (idx === 15) {
        const pure: Record<string, readonly string[]> = { r: ["de-road", "de-road-b"], f: ["de-flag", "de-flag-b"], g: ["de-grass", "de-grass-b", "de-grass-c"] };
        const vars = (pure[set] ?? []).map((t) => this.pal.tile(t)).filter((t) => t >= 0);
        if (vars.length) { this.lower[k] = vars[Math.floor(hash2(x, y, s + 7) * vars.length)]!; continue; }
      }
      const t = this.pal.wang(WANG_SET[set], idx);
      this.lower[k] = t >= 0 ? t : sandVars[0]!;
    }
  }

  /** 트인 모래에 사구 덩이(꼭짓점 재질 d) — 마을·길·건물에서 margin 칸 떨어진 곳만. */
  dunes(area: Rect, margin: number, density: number): number {
    const s = this.seed + 41;
    let n = 0;
    const near = (x: number, y: number) => {
      for (let j = -margin; j <= margin; j++) for (let i = -margin; i <= margin; i++) {
        const u = this.u(x + i, y + j);
        if (u && u !== "open") return true;
      }
      return false;
    };
    for (let y = area.y + 1; y < area.y + area.h; y++) for (let x = area.x + 1; x < area.x + area.w; x++) {
      if (x <= 0 || y <= 0 || x >= this.W || y >= this.H) continue;
      // 동서로 긴 사구 마루(가로로 늘인 잡음) — 덩이가 아니라 줄로 읽히게
      const v = vnoise(x * 0.45, y * 1.5, 4, s) * 0.8 + vnoise(x, y, 2, s + 9) * 0.2;
      if (v < 1 - density) continue;
      if (near(x - 1, y - 1) || near(x, y)) continue;
      this.vset(x, y, "d"); n++;
    }
    // 가로 3꼭짓점 미만 토막·가장자리 한 줄은 지운다 — 외톨이 꼭짓점은 마름모 무늬로 보인다
    for (let y = 0; y <= this.H; y++) {
      let x = 0;
      while (x <= this.W) {
        if (this.vget(x, y) !== "d") { x++; continue; }
        let e = x; while (e + 1 <= this.W && this.vget(e + 1, y) === "d") e++;
        const edge = x <= 1 || e >= this.W - 1;
        if (e - x + 1 < 3 || (edge && e - x + 1 < 5)) for (let i = x; i <= e; i++) { this.vset(i, y, "s"); n--; }
        x = e + 1;
      }
    }
    return n;
  }

  /** 트인 모래에 덤불·마른 풀·바위를 흩는다(최소 간격 3칸, 사구 위에는 마른 풀만). */
  scatter(area: Rect, count: number, kinds: readonly string[], rng: () => number, spacing = 3): number {
    let n = 0;
    for (let t = 0; t < count * 12 && n < count; t++) {
      const x = area.x + Math.floor(rng() * area.w), y = area.y + Math.floor(rng() * area.h);
      let id = pick(rng, kinds);
      if (!this.pal.kit(id)) continue;
      // 사구 위에는 마른 풀만(바위·덤불이 비탈에 떠 보이지 않게)
      const onDune = [this.vget(x, y), this.vget(x + 1, y), this.vget(x, y + 1), this.vget(x + 1, y + 1)].includes("d");
      if (onDune) { if (rng() < 0.6) continue; id = "de-tuft"; }
      if (!this.free({ x, y, w: this.kitSize(id).w, h: this.kitSize(id).h }, spacing - 1)) continue;
      if (this.prop(id, x, y, 1)) n++;
    }
    return n;
  }

  /** 엔진과 같은 통행 판정으로 칸 하나가 걸을 수 있는가. */
  walk(x: number, y: number): boolean {
    if (!this.in(x, y)) return false;
    const k = this.k(x, y), lo = this.lower[k]!, up = this.upper[k]!;
    return (lo < 0 || this.pal.passable(lo)) && (up < 0 || this.pal.passable(up));
  }
  reach(from: DesertCell): Set<number> {
    const seen = new Set<number>(); if (!this.walk(from.x, from.y)) return seen;
    seen.add(this.k(from.x, from.y)); const q = [from];
    while (q.length) {
      const c = q.pop()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const x = c.x + dx, y = c.y + dy;
        if (!this.walk(x, y) || seen.has(this.k(x, y))) continue;
        seen.add(this.k(x, y)); q.push({ x, y });
      }
    }
    return seen;
  }
}

// ───────────────────────── 공통 조각 ─────────────────────────
const HOUSES_3 = ["de-house-adobe-3", "de-house-dome-white"];
const HOUSES_4 = ["de-house-adobe-4", "de-house-stone-4", "de-house-plaster-4", "de-house-dome-4", "de-house-2f", "de-house-windtower", "de-house-shop"];
const HOUSES_5 = ["de-house-adobe-5"];
const STALLS = ["de-stall-pottery", "de-stall-spice", "de-stall-carpet", "de-stall-fruit", "de-stall-lantern"];
const PALMS = ["de-palm-date", "de-palm-young", "de-palm-pair"];
const DESERT_BITS = ["de-scrub", "de-tuft", "de-tuft", "de-rock-small", "de-aloe"];

/** 길(가로) 북쪽에 집 줄 — 집 아랫줄이 길 바로 위, 문 접근칸이 길. x0..x1 사이를 왼쪽부터 채운다. */
function houseRow(b: Board, rng: () => number, x0: number, x1: number, roadY: number, pool: readonly string[], gapMin = 1, allow: readonly Use[] = ["open", "field"], jitter = true): DesertBuilding[] {
  const out: DesertBuilding[] = [];
  let x = x0;
  while (x < x1) {
    const choices = pool.filter((id) => b.pal.kit(id) && x + b.kitSize(id).w <= x1);
    if (!choices.length) break;
    const id = pick(rng, choices);
    const { w, h } = b.kitSize(id);
    const y = roadY - h;
    if (y >= 1 && b.free({ x, y, w, h }, 0, allow)) {
      const d = b.building(id, x, y);
      out.push(d);
      x += w + gapMin + (jitter && rng() < 0.35 ? 1 : 0);
    } else x += 1;
  }
  return out;
}

/** 집 사이 틈·문 곁에 생활 소품(항아리·자루·궤짝) — 문 접근칸은 피한다. */
function doorDressing(b: Board, rng: () => number, houses: readonly DesertBuilding[], roadY: number): void {
  for (const h of houses) {
    if (rng() < 0.45) continue;
    const id = pick(rng, ["de-jar-big", "de-jars-group", "de-sacks", "de-crate", "de-basket-spice"]);
    const side = rng() < 0.5 ? h.rect.x - 1 : h.rect.x + h.rect.w;
    b.prop(id, side, roadY - 1, 0, ["open"]);
  }
}

/** 오아시스 못 + 풀 띠: 꼭짓점 재질을 잡음 타원으로. 돌려주는 값 = 물 사각(대략)·풀 사각. */
function oasisPool(b: Board, cx: number, cy: number, rx: number, ry: number, ring: number): { water: Rect; grass: Rect } {
  const s = b.seed + 77;
  for (let y = 0; y <= b.H; y++) for (let x = 0; x <= b.W; x++) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    const wob = (vnoise(x, y, 3, s) - 0.5) * 0.45;
    const d = Math.sqrt(dx * dx + dy * dy) + wob;
    const dg = Math.sqrt((x - cx) ** 2 / (rx + ring) ** 2 + (y - cy) ** 2 / (ry + ring * 0.8) ** 2) + (vnoise(x + 50, y, 4, s + 3) - 0.5) * 0.35;
    if (d < 1) b.vset(x, y, "w");
    else if (dg < 1) b.vset(x, y, "g");
  }
  // 물 칸·풀 칸 쓰임: 꼭짓점 하나라도 물이면 물 칸(못 가장자리 칸은 막힌다), 네 꼭짓점 모두 풀이면 풀 칸
  for (let y = 0; y < b.H; y++) for (let x = 0; x < b.W; x++) {
    const c = [b.vget(x, y), b.vget(x + 1, y), b.vget(x, y + 1), b.vget(x + 1, y + 1)];
    const k = b.k(x, y);
    if (c.includes("w")) b.use[k] = "water";
    else if (c.every((m) => m === "g")) b.use[k] = "grass";
    else if (c.some((m) => m === "g")) b.use[k] = "grass";
  }
  return { water: { x: Math.round(cx - rx), y: Math.round(cy - ry), w: Math.round(rx * 2), h: Math.round(ry * 2) },
    grass: { x: Math.round(cx - rx - ring), y: Math.round(cy - ry - ring), w: Math.round((rx + ring) * 2), h: Math.round((ry + ring) * 2) } };
}

/** 풀 위에 야자·협죽도, 물가 풀 칸에 갈대. */
function oasisPlants(b: Board, rng: () => number, area: Rect, palms: number): void {
  let n = 0;
  for (let t = 0; t < 300 && n < palms; t++) {
    const x = area.x + Math.floor(rng() * area.w), y = area.y + Math.floor(rng() * area.h);
    const id = pick(rng, PALMS);
    const { w, h } = b.kitSize(id);
    // 발밑(아랫줄)이 풀이어야 한다 — 윗줄 잎은 물·모래 위로 걸쳐도 된다(★ 위층)
    let ok = true;
    for (let i = 0; i < w; i++) if (b.u(x + i, y + h - 1) !== "grass") ok = false;
    if (!ok) continue;
    if (b.prop(id, x, y, 1, ["grass", "open", "water"])) n++;
  }
  // 갈대: 물과 맞닿은 풀 칸(물 남·동·서)
  let r = 0;
  for (let y = area.y; y < area.y + area.h && r < 8; y++) for (let x = area.x; x < area.x + area.w && r < 8; x++) {
    if (b.u(x, y) !== "grass") continue;
    const wet = b.u(x, y - 1) === "water" || b.u(x - 1, y) === "water" || b.u(x + 1, y) === "water";
    if (!wet || hash2(x, y, b.seed + 91) > 0.4) continue;
    if (b.prop("de-reeds", x, y, 0, ["grass"])) r++;
  }
  for (let t = 0; t < 60; t++) {
    const x = area.x + Math.floor(rng() * area.w), y = area.y + Math.floor(rng() * area.h);
    if (b.u(x, y) === "grass" && b.prop("de-oleander", x, y, 1, ["grass"])) if (rng() < 0.5) break;
  }
}

/** 천막 야영지(12×7): 다진 흙 마당(8×4) 위 큰 천막·작은 천막·모닥불·깔개, 마당 곁 모래에 앉은 낙타·선 낙타. 적대 검수(2026-10-14): 천막·불·낙타가 한 무리로 묶여야 한다. */
function camp(b: Board, rng: () => number, area: Rect): boolean {
  for (let t = 0; t < 60; t++) {
    const x = area.x + Math.floor(rng() * Math.max(1, area.w - 12)), y = area.y + Math.floor(rng() * Math.max(1, area.h - 7));
    if (!b.free({ x, y, w: 12, h: 7 }, 0)) continue;
    b.ground({ x, y: y + 2, w: 8, h: 4 }, "r", "open");
    b.building("de-tent-bedouin", x + 1, y + 1);
    b.building("de-tent-small", x + 5, y + 1);
    b.prop("de-campfire", x + 4, y + 4, 0);
    b.prop("de-rug-red", x + 1, y + 4, 0);
    b.prop(rng() < 0.5 ? "de-sacks" : "de-jar-big", x + 7, y + 3, 0);
    b.prop("de-camel-rest", x + 9, y + 3, 0);
    b.prop("de-camel", x + 9, y, 0);
    b.prop("de-hitch-post", x + 11, y + 1, 0);
    b.zone("천막 야영지", "다진 흙 마당·천막 둘·모닥불·낙타", { x, y, w: 12, h: 7 });
    return true;
  }
  return false;
}

/** 작은 풀 화단(모서리 야자·협죽도) — 성벽 안 빈 귀퉁이를 메운다. */
function gardenBed(b: Board, rng: () => number, area: Rect, maxW = 8, maxH = 6, near?: DesertCell): boolean {
  for (let w = Math.min(maxW, area.w); w >= 4; w--) for (let h = Math.min(maxH, area.h); h >= 3; h--) {
    const r = findOpen(b, rng, w, h, 0, area, near);
    if (!r) continue;
    b.ground(r, "g", "grass");
    b.zone("화단", "풀·야자", r);
    b.prop(pick(rng, ["de-palm-young", "de-palm-date"]), r.x, r.y + r.h - 3 >= r.y ? r.y + Math.max(0, r.h - 3) : r.y, 0, ["grass"]);
    if (w >= 6) b.prop("de-palm-young", r.x + w - 2, r.y + Math.max(0, h - 2), 0, ["grass"]);
    for (let x = r.x + 2; x < r.x + w - 2; x += 2) b.prop("de-oleander", x, r.y + h - 1, 0, ["grass"]);
    return true;
  }
  return false;
}

function wildDesert(b: Board, rng: () => number, density: number): void {
  b.dunes({ x: 0, y: 0, w: b.W, h: b.H }, 2, density);
  b.scatter({ x: 0, y: 0, w: b.W, h: b.H }, Math.round(b.W * b.H / 45), DESERT_BITS, rng, 3);
  // 바위 덩이: 큰 바위·노두 + 곁 작은 바위·덤불
  for (let t = 0, n = 0; t < 60 && n < Math.max(1, Math.round(b.W * b.H / 500)); t++) {
    const x = Math.floor(rng() * (b.W - 4)), y = Math.floor(rng() * (b.H - 3));
    const id = rng() < 0.5 ? "de-boulder" : "de-outcrop";
    const sz = b.kitSize(id);
    let dune = false;
    for (let j = 0; j <= sz.h; j++) for (let i = 0; i <= sz.w; i++) if (b.vget(x + i, y + j) === "d") dune = true;
    if (dune || !b.prop(id, x, y, 2)) continue;
    n++;
    b.prop("de-rock-small", x + b.kitSize(id).w, y + b.kitSize(id).h - 1, 0);
    b.prop("de-scrub", x - 1, y + b.kitSize(id).h - 1, 0);
  }
}

/** 빈 사각 찾기: 크기 w×h(+여백 m)가 통째로 비어 있는 자리 — 왼위부터 성글게 훑어 무작위 하나. */
function findOpen(b: Board, rng: () => number, w: number, h: number, m: number, area?: Rect, near?: DesertCell): Rect | undefined {
  const A = area ?? { x: 1, y: 1, w: b.W - 2, h: b.H - 2 };
  const c: Rect[] = [];
  for (let y = A.y; y + h <= A.y + A.h; y += 2) for (let x = A.x; x + w <= A.x + A.w; x += 2) {
    const r = { x, y, w, h };
    if (b.free(r, m)) c.push(r);
  }
  if (near && c.length) return c.reduce((best, r) => (Math.abs(r.x + r.w / 2 - near.x) + Math.abs(r.y + r.h / 2 - near.y) < Math.abs(best.x + best.w / 2 - near.x) + Math.abs(best.y + best.h / 2 - near.y) ? r : best));
  return c.length ? c[Math.floor(rng() * c.length)] : undefined;
}

/** 대추야자 과수원: 풀 사각 + 야자 격자(3칸 간격) + 가장자리 마른 풀. */
function palmGrove(b: Board, rng: () => number, r: Rect): void {
  b.ground(r, "g", "grass");
  // 네 귀퉁이 꼭짓점을 깎아 둥글게(사각 풀밭 방지)
  for (const [x, y] of [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]] as const) b.vset(x, y, "s");
  b.zone("대추야자 과수원", "풀밭·야자 줄", r);
  let row = 0;
  for (let y = r.y; y + 3 <= r.y + r.h; y += 3, row++) for (let x = r.x + 1 + (row % 2 ? 1 : 0); x + 3 <= r.x + r.w; x += 3) {
    b.prop(rng() < 0.7 ? "de-palm-date" : "de-palm-young", x, y, 0, ["grass"]) || b.prop("de-palm-young", x, y + 1, 0, ["grass"]);
  }
  for (let x = r.x + 1; x < r.x + r.w - 1; x++) if (rng() < 0.3) b.prop(rng() < 0.2 ? "de-palm-stump" : "de-oleander", x, r.y + r.h - 1, 0, ["grass"]);
}

/** 무너진 신전 터(10×8): 포석 바닥(10×7) + 뒷줄 폐허 벽 + 기둥 줄(일부 빠짐·부러짐) + 판석 아랫단의 아치 + 쓰러진 돌.
 *  적대 검수(2026-10-14): 두 신전이 거울처럼 같았고 아치가 판석 밖에 떠 있었다 → 배치 셋 중 하나, 아치는 판석 위. */
function ruinedTemple(b: Board, rng: () => number, area: Rect): boolean {
  const r = findOpen(b, rng, 10, 8, 1, area);
  if (!r) return false;
  const fl = { x: r.x, y: r.y + 1, w: 10, h: 7 };
  b.ground(fl, "f", "plaza");
  for (let y = fl.y; y < fl.y + fl.h; y++) for (let x = fl.x; x < fl.x + fl.w; x++) b.use[b.k(x, y)] = "open";
  b.zone("무너진 신전 터", "포석 바닥·기둥 줄·폐허 벽", r);
  const v = Math.floor(rng() * 3);
  const A: readonly string[] = ["open", "plaza"];
  const backs: readonly (readonly [string, number])[][] = [
    [["de-ruin-wall", 0], ["de-stele", 4], ["de-ruin-wall", 6]],
    [["de-ruin-wall", 1], ["de-column-broken", 5], ["de-stele", 8]],
    [["de-stele", 0], ["de-ruin-wall", 3], ["de-column-broken", 8]],
  ];
  for (const [id, dx] of backs[v]!) { const h = b.kitSize(id).h; b.prop(id, fl.x + dx, fl.y + 1 - h, 0, A); }
  const cols = [1, 3, 6, 8].filter(() => rng() > 0.2);
  for (const dx of cols) {
    const broken = rng() < 0.45;
    const id = broken ? "de-column-broken" : "de-column";
    const h = broken ? 2 : 3;
    b.prop(id, fl.x + dx, fl.y + 4 - h, 0, A);
    if (broken && rng() < 0.6) b.prop("de-rubble", fl.x + dx + (rng() < 0.5 ? 1 : 0), fl.y + 4, 0, A);
  }
  const archX = [4, 1, 6][v]!;
  b.prop("de-ruin-arch", fl.x + archX, fl.y + 4, 0, A);
  for (const [dx, dy] of [[archX === 1 ? 7 : 1, 5], [archX === 6 ? 3 : 8, 6]] as const) b.prop("de-block-fallen", fl.x + dx, fl.y + dy, 0, A);
  return true;
}

function lanternLine(b: Board, x0: number, x1: number, y: number, step: number): void {
  for (let x = x0; x <= x1; x += step) b.prop("de-lantern-post", x, y - 1, 0, ["open"]);
}

// ───────────────────────── 오아시스 마을 ─────────────────────────
function composeOasis(b: Board, rng: () => number): DesertCell {
  const { W, H } = b;
  const cx = Math.round(W * (0.42 + rng() * 0.16)), cy = Math.round(H * 0.36);
  const rx = 5 + Math.floor(rng() * 2), ry = 3.4;
  const pool = oasisPool(b, cx, cy, rx, ry, 2.6);
  b.zone("오아시스 못", "물·야자 숲", pool.grass);
  // 남쪽 큰길(가로) + 남쪽 입구(세로)
  const mainY = Math.min(H - 8, Math.round(cy + ry + 6));
  const entryX = Math.round(W * (0.3 + rng() * 0.4));
  b.ground({ x: 2, y: mainY, w: W - 4, h: 2 }, "r", "road");
  b.ground({ x: entryX, y: mainY, w: 2, h: H - mainY }, "r", "road");
  // 광장(못 남쪽, 큰길 북쪽): 포석 + 우물 + 노점
  const plaza = { x: cx - 4, y: Math.round(cy + ry + 1.5), w: 9, h: mainY - Math.round(cy + ry + 1.5) };
  if (plaza.h >= 3) {
    b.ground(plaza, "f", "plaza");
    b.zone("마을 광장", "우물·노점", plaza);
    const wx = plaza.x + Math.floor((plaza.w - 2) / 2), wy = plaza.y + Math.max(0, Math.floor((plaza.h - 2) / 2));
    b.prop("de-well", wx, wy, 0, ["plaza"]);
    b.prop("de-bench-stone", wx - 3, wy + 1, 0, ["plaza"]); b.prop("de-bench-stone", wx + 3, wy + 1, 0, ["plaza"]);
    b.prop("de-jars-rack", wx + 3, wy - 1, 0, ["plaza"]) || b.prop("de-jars-rack", wx - 3, wy - 1, 0, ["plaza"]);
  }
  // 큰길 북쪽 집 줄(광장·못 풀 띠를 피한다)
  const north = [...houseRow(b, rng, 3, plaza.x - 1, mainY, [...HOUSES_4, ...HOUSES_3]), ...houseRow(b, rng, plaza.x + plaza.w + 1, W - 3, mainY, [...HOUSES_4, ...HOUSES_3])];
  doorDressing(b, rng, north, mainY);
  // 큰길 남쪽: 집 줄 하나 더(남쪽 골목에서 들어간다)
  const laneY = H - 3;
  b.ground({ x: 3, y: laneY, w: W - 6, h: 1 }, "r", "road");
  const south = [...houseRow(b, rng, 3, entryX - 1, laneY, [...HOUSES_4, ...HOUSES_3, ...HOUSES_5]), ...houseRow(b, rng, entryX + 3, W - 3, laneY, [...HOUSES_4, ...HOUSES_3, ...HOUSES_5])];
  doorDressing(b, rng, south, laneY);
  // 못 북쪽 언덕: 집 몇 채 + 북쪽 오솔길(못가로 내려온다)
  const backY = Math.max(6, Math.round(cy - ry - 3));
  if (backY >= 6) {
    b.ground({ x: cx - rx - 6, y: backY, w: rx * 2 + 12, h: 1 }, "r", "road");
    const nh = houseRow(b, rng, cx - rx - 6, cx + rx + 6, backY, [...HOUSES_3, ...HOUSES_4]);
    for (const h of nh) b.connect(h);
    // 오솔길을 큰길과 잇는다(못 서쪽으로 돌아 내려오는 길)
    const sx = Math.max(2, cx - rx - 6);
    b.ground({ x: sx, y: backY, w: 1, h: mainY - backY }, "r", "road");
  }
  oasisPlants(b, rng, pool.grass, 7 + Math.floor(rng() * 3));
  // 낙타 쉼터: 큰길 남쪽 모래(앉은 낙타·선 낙타·물통·말뚝) — 정해 둔 자리가 막히면 빈 땅에서 찾는다
  const rest = [entryX + 3, entryX - 7, entryX + 7, entryX - 11].map((x) => ({ x, y: mainY + 2, w: 5, h: 3 })).find((r) => b.free(r, 0))
    ?? findOpen(b, rng, 5, 3, 1, { x: 1, y: mainY + 2, w: W - 2, h: H - mainY - 3 });
  if (rest) {
    b.prop("de-camel-rest", rest.x, rest.y + 1, 0); b.prop("de-camel", rest.x + 2, rest.y, 0); b.prop("de-trough", rest.x + 2, rest.y + 2, 0); b.prop("de-hitch-post", rest.x + 4, rest.y + 1, 0);
    b.zone("낙타 쉼터", "물통·말뚝·낙타", rest);
  }
  // 두레박(샤두프): 못가 풀 위 — 물과 맞닿은 자리 하나
  shaduf: for (let y = pool.grass.y; y < pool.grass.y + pool.grass.h; y++) for (let x = pool.grass.x; x < pool.grass.x + pool.grass.w; x++) {
    const wet = b.u(x - 1, y + 2) === "water" || b.u(x + 2, y + 2) === "water";
    if (wet && b.prop("de-shaduf", x, y, 0, ["grass"])) break shaduf;
  }
  // 마을 밖 야영지: 네 귀퉁이 중 빈 곳
  for (const area of [{ x: 1, y: 1, w: Math.round(W * 0.4), h: Math.round(H * 0.35) }, { x: W - Math.round(W * 0.4) - 1, y: 1, w: Math.round(W * 0.4), h: Math.round(H * 0.35) }]) if (camp(b, rng, area)) break;
  lanternLine(b, 4, W - 5, mainY, 8);
  // 남은 빈 땅에 용도: 대추야자 과수원 1~2
  for (let i = 0; i < 2; i++) { const g = findOpen(b, rng, 9, 7, 1) ?? findOpen(b, rng, 8, 6, 1) ?? findOpen(b, rng, 7, 6, 0); if (g) palmGrove(b, rng, g); }
  wildDesert(b, rng, 0.42);
  return { x: entryX, y: H - 1 };
}

// ───────────────────────── 바자르 거리 ─────────────────────────
function composeBazaar(b: Board, rng: () => number): DesertCell {
  const { W, H } = b;
  const sy = Math.round(H * 0.42);              // 바자르 큰길(포석 3줄) 윗줄
  b.ground({ x: 0, y: sy, w: W, h: 3 }, "f", "plaza");
  b.zone("바자르 큰길", "노점·가게가 마주 보는 포석 거리", { x: 0, y: sy, w: W, h: 3 });
  // 가운데 광장(북쪽으로 넓힘): 분수 + 회당 + 첨탑
  const px = Math.round(W / 2) - 5;
  const hall = b.pal.kit("de-domed-hall") ? "de-domed-hall" : null;
  const plaza = { x: px, y: sy - 5, w: 11, h: 5 };
  b.ground(plaza, "f", "plaza");
  b.zone("분수 광장", "분수·회당 정문", plaza);
  if (hall) {
    const hy = plaza.y - b.kitSize(hall).h;
    if (hy >= 1) { b.building(hall, px + 2, hy); if (b.pal.kit("de-minaret")) b.prop("de-minaret", px + 9, hy - 1, 0, ["open"]); }
  }
  b.prop("de-fountain", px + 4, sy - 3, 0, ["plaza"]);
  b.prop("de-bench-stone", px, sy - 2, 0, ["plaza"]);
  b.prop("de-bench-stone", px + 9, sy - 2, 0, ["plaza"]);
  // 큰길 북쪽: 노점·가게 줄(광장 양옆)
  const rowN = (x0: number, x1: number) => {
    let x = x0;
    while (x < x1) {
      const shop = rng() < 0.35;
      const id = shop ? "de-house-shop" : pick(rng, STALLS);
      const { w, h } = b.kitSize(id);
      if (x + w > x1) break;
      if (b.free({ x, y: sy - h, w, h }, 0)) {
        if (shop) b.building(id, x, sy - h); else { b.stamp(id, x, sy - h, "prop"); b.props.push({ kit: id, x, y: sy - h }); }
        x += w + (rng() < 0.3 ? 1 : 0);
      } else x++;
    }
  };
  rowN(1, px - 1); rowN(px + 12, W - 1);
  // 노점 줄 뒤(북쪽): 집 줄 + 뒷골목
  const backY = sy - 6;
  if (backY > 6) {
    b.ground({ x: 1, y: backY, w: px - 2, h: 1 }, "r", "road"); b.ground({ x: px + 12, y: backY, w: W - px - 13, h: 1 }, "r", "road");
    const hs = [...houseRow(b, rng, 1, px - 1, backY, [...HOUSES_4, ...HOUSES_3]), ...houseRow(b, rng, px + 12, W - 1, backY, [...HOUSES_4, ...HOUSES_3])];
    doorDressing(b, rng, hs, backY);
    // 뒷골목을 큰길과 잇는 샛길(광장 옆)
    b.ground({ x: px - 1, y: backY, w: 1, h: sy - backY }, "r", "road");
    b.ground({ x: px + 11, y: backY, w: 1, h: sy - backY }, "r", "road");
  }
  // 큰길 남쪽: 바닥 장터(다진 흙 마당) — 좌판 묶음을 두 줄 격자로(묶음 사이 1칸, 줄 사이 통로 1줄). 큰길 바로 아래 한 줄은 비워 둔다.
  const my = sy + 4, mh = 6;
  const entryX = Math.round(W * 0.5);
  b.ground({ x: 1, y: my - 1, w: W - 2, h: mh + 1 }, "r", "road");
  b.ground({ x: 1, y: my - 1, w: W - 2, h: mh + 1 }, "r", "open");
  b.zone("바닥 장터", "깔개 좌판·그늘막·염색 건조대(두 줄 격자)", { x: 1, y: my, w: W - 2, h: mh });
  // 적대 검수(2026-10-14): 깔개 위 항아리처럼 떠 보이는 묶음을 뺐다. 앞줄 = 노점(통로 my+2 를 향해), 뒷줄 = 장인 묶음(같은 묶음이 이웃하지 않게).
  const MODS_B: readonly (readonly [string, number, number][])[] = [
    [["de-parasol-reed", 0, 0], ["de-sacks", 2, 1]],
    [["de-carpet-rack", 0, 0]],
    [["de-dye-rack", 0, 0]],
    [["de-kiln", 0, 0], ["de-jar-big", 2, 1]],
    [["de-jars-rack", 0, 1], ["de-sacks", 2, 1]],
    [["de-crates-stack", 0, 0], ["de-handcart", 2, 1]],
    [["de-incense-burner", 0, 1], ["de-basket-spice", 1, 1]],
  ];
  const skipEntry = (x: number) => x <= entryX + 2 && x + 3 >= entryX;
  {
    let x = 2, prev = "";
    while (x < W - 3) {
      if (skipEntry(x)) { x = entryX + 3; continue; }
      const id = pick(rng, STALLS.filter((s) => s !== prev && b.pal.kit(s)));
      if (x + 2 > W - 2) break;
      if (b.prop(id, x, my, 0)) prev = id;
      x += 3;
    }
  }
  {
    let x = 2, prev = -1;
    while (x < W - 4) {
      if (skipEntry(x)) { x = entryX + 3; continue; }
      let mi = Math.floor(rng() * MODS_B.length); if (mi === prev) mi = (mi + 1) % MODS_B.length;
      const mod = MODS_B[mi]!;
      const mw = Math.max(...mod.map(([id, dx]) => dx + (b.pal.kit(id)?.width ?? 1)));
      if (x + mw > W - 2) break;
      let ok = true;
      for (const [id, dx, dy] of mod) { const k = b.pal.kit(id); if (!k || !b.free({ x: x + dx, y: my + 3 + dy, w: k.width, h: k.height }, 0)) ok = false; }
      if (ok) { for (const [id, dx, dy] of mod) b.prop(id, x + dx, my + 3 + dy, 0); prev = mi; }
      x += mw + 1;
    }
  }
  for (let y = my - 1; y < my + mh; y++) for (let x = 1; x < W - 1; x++) if (b.use[b.k(x, y)] === "open") b.use[b.k(x, y)] = "road";
  // 남쪽 집 줄(남쪽 골목에서 들어간다) + 남쪽 입구
  const laneY = H - 3;
  b.ground({ x: 1, y: laneY, w: W - 2, h: 1 }, "r", "road");
  b.ground({ x: entryX, y: sy + 3, w: 2, h: H - sy - 3 }, "r", "road");
  const hs2 = [...houseRow(b, rng, 1, entryX - 1, laneY, [...HOUSES_4, ...HOUSES_3, ...HOUSES_5]), ...houseRow(b, rng, entryX + 3, W - 1, laneY, [...HOUSES_4, ...HOUSES_3, ...HOUSES_5])];
  doorDressing(b, rng, hs2, laneY);
  // 동쪽 끝: 대상 도착(낙타·짐수레)
  b.prop("de-cart-camel", W - 6, sy + 4, 0) || b.prop("de-cart-camel", W - 7, my, 0);
  b.prop("de-camel", W - 3, sy - 3, 0);
  lanternLine(b, 3, W - 4, sy, 7);
  wildDesert(b, rng, 0.3);
  return { x: entryX, y: H - 1 };
}

// ───────────────────────── 성벽 둘레(궁전·대상 숙소) ─────────────────────────
/** 사각 성벽: 바깥 사각 r(칸). 북·남 벽 = wall-h(3줄), 동·서 = wall-v(폭 2), 모서리 = wall-tower(2×4), 남쪽 가운데 = gateKit. 안쪽 사각을 돌려준다. */
function wallRing(b: Board, r: Rect, gateKit: "de-wall-gate" | "de-caravanserai-gate", rng: () => number): { inner: Rect; gate: DesertCell[] } {
  const tw = 2, th = 4;
  // 모서리 탑 아랫줄을 벽 아랫줄과 맞춘다(탑이 한 줄 높다)
  const topY = r.y, botY = r.y + r.h - 3;            // 북·남 벽 윗줄(벽 3줄)
  const xL = r.x, xR = r.x + r.w - tw;
  for (let x = xL + tw; x < xR; x++) { b.stamp(x % 4 === 1 ? "de-wall-h-slit" : "de-wall-h", x, topY, "wall"); }
  const g = b.kitSize(gateKit);
  const gx = r.x + Math.floor((r.w - g.w) / 2);
  for (let x = xL + tw; x < xR; x++) { if (x >= gx && x < gx + g.w) continue; b.stamp("de-wall-h", x, botY, "wall"); }
  for (let y = topY + 3; y < botY; y++) { b.stamp("de-wall-v", xL, y, "wall"); b.stamp("de-wall-v", xR, y, "wall"); }
  b.stamp("de-wall-tower", xL, topY - 1, "wall"); b.stamp("de-wall-tower", xR, topY - 1, "wall");
  b.stamp("de-wall-tower", xL, botY - 1, "wall"); b.stamp("de-wall-tower", xR, botY - 1, "wall");
  const gy = botY + 3 - g.h;
  b.stamp(gateKit, gx, gy, "wall");
  // 통로 칸(키트가 걸을 수 있게 둔 칸) = 성문 길
  const gate: DesertCell[] = [];
  for (let y = gy; y < gy + g.h; y++) for (let x = gx; x < gx + g.w; x++) if (b.walk(x, y) && b.u(x, y) === "road") gate.push({ x, y });
  const gxs = [...new Set(gate.map((c) => c.x))];
  b.ground({ x: Math.min(...gxs), y: gy, w: gxs.length, h: g.h }, "r", "road");
  void rng;
  return { inner: { x: xL + tw, y: topY + 3, w: xR - xL - tw, h: botY - topY - 3 }, gate: gxs.map((x) => ({ x, y: botY + 2 })) };
}

// ───────────────────────── 궁전 ─────────────────────────
// 성벽 사각은 궁전 크기에 맞춘다(너무 크면 빈 포석 마당이 남는다). 마당 = 모래 바탕 + 축선 포석 길 + 궁전 앞 단 + 사분 정원(풀·물길·야자).
// 궁전 양옆에 회당·흰 집(신하 처소)이 마당으로 문을 낸다. 성 밖 남쪽은 진입로 + 오벨리스크 짝 + 작은 마을 줄.
function composePalace(b: Board, rng: () => number): DesertCell {
  const { W, H } = b;
  const rw = Math.min(W - 6, 38), rh = Math.min(H - 10, 30);
  const ring = { x: Math.floor((W - rw) / 2), y: 2, w: rw, h: rh };
  const { inner, gate } = wallRing(b, ring, "de-wall-gate", rng);
  b.zone("궁정 마당", "축선 포석 길·정원·분수", inner);
  const pk = b.kitSize("de-palace");
  const pxx = inner.x + Math.floor((inner.w - pk.w) / 2), pyy = inner.y;
  // 궁전 앞 단(포석, 궁전 폭 + 2) 3줄
  const ay = pyy + pk.h;
  b.ground({ x: inner.x, y: ay, w: inner.w, h: 3 }, "f", "plaza");   // 앞 단은 마당 폭 끝까지(적대 검수: 단이 허공에 끊겼다)
  const pal = b.building("de-palace", pxx, pyy);
  const dx0 = pal.access[0]!.x;
  // 축선 길: 궁전 문 → 성문(폭 = 성문 통로 폭)
  const g0 = gate[0]!;
  b.ground({ x: g0.x - 1, y: ay + 3, w: gate.length + 2, h: inner.y + inner.h - ay - 3 }, "f", "plaza");
  // 축선 가운데 분수: 길을 5칸으로 넓힌 원형 마당
  const midY = Math.round((ay + 3 + inner.y + inner.h) / 2) - 2;
  const fx = g0.x - 1 + Math.floor((gate.length + 2 - 3) / 2);
  b.ground({ x: fx - 2, y: midY - 1, w: 7, h: 5 }, "f", "plaza");
  b.prop("de-fountain", fx, midY, 0, ["plaza"]);
  b.prop("de-lion-statue", pxx - 2, ay, 0, ["plaza"]); b.prop("de-lion-statue", pxx + pk.w, ay, 0, ["plaza"]);
  b.prop("de-brazier", dx0 - 2, ay + 1, 0, ["plaza"]); b.prop("de-brazier", dx0 + 3, ay + 1, 0, ["plaza"]);
  // 궁전 양옆: 신하 처소(문은 앞 단 높이 줄로)
  const sideL = { x0: inner.x + 1, x1: pxx - 3 }, sideR = { x0: pxx + pk.w + 3, x1: inner.x + inner.w - 1 };
  for (const sd of [sideL, sideR]) {
    if (sd.x1 - sd.x0 < 3) continue;
    const pool = sd.x1 - sd.x0 >= 6 ? ["de-domed-hall", "de-house-plaster-4", "de-house-dome-white"] : ["de-house-dome-white", "de-house-plaster-4"];
    for (const id of pool) {
      const { w, h } = b.kitSize(id);
      if (sd.x1 - sd.x0 < w) continue;
      const x = sd === sideL ? sd.x0 : sd.x1 - w;
      const y = ay - h + 1 + 0;
      if (y < inner.y || !b.free({ x, y, w, h }, 0)) continue;
      const bd = b.building(id, x, y);
      b.ground({ x: Math.min(bd.access[0]!.x, sd === sideL ? sd.x1 : sd.x0), y: ay + 1, w: Math.abs((sd === sideL ? pxx - 2 : sd.x0) - bd.access[0]!.x) + bd.access.length + 1, h: 1 }, "f", "plaza");
      b.connect(bd, "f");
      break;
    }
  }
  // 북쪽 귀퉁이(궁전 옆 처소 위·옆 빈 모래): 화단으로 메운다
  gardenBed(b, rng, { x: inner.x, y: inner.y, w: pxx - 1 - inner.x, h: ay - inner.y - 1 }, 9, 6, { x: inner.x, y: inner.y });
  gardenBed(b, rng, { x: pxx + pk.w + 1, y: inner.y, w: inner.x + inner.w - pxx - pk.w - 1, h: ay - inner.y - 1 }, 9, 6, { x: inner.x + inner.w, y: inner.y });
  // 좌우 정원: 앞 단 바로 아래에서 성벽 안쪽 끝까지 — 풀 + 가운데 물길(물) + 모서리 야자, 남쪽 끝 협죽도
  const axL = g0.x - 1, axR = g0.x + gate.length + 1;          // 축선 포석 길 양 끝(바깥 칸)
  const qx = [inner.x, axR], qw = [axL - inner.x, inner.x + inner.w - axR];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 1; j++) {
    const r = { x: qx[i]!, y: ay + 3, w: qw[i]!, h: inner.y + inner.h - (ay + 3) };
    if (r.w < 4 || r.h < 3) continue;
    b.ground(r, "g", "grass");
    b.zone(`${i ? "동" : "서"}쪽 정원`, "풀·물길·야자", r);
    if (r.w >= 7 && r.h >= 5) {                    // 가운데 긴 물길(물은 풀 안에만)
      const wy = r.y + Math.floor(r.h / 2), wx = r.x + 2;
      for (let x = wx; x <= r.x + r.w - 2; x++) { b.vset(x, wy, "w"); b.vset(x, wy + 1, "w"); }
      for (let y = wy - 1; y <= wy + 1; y++) for (let x = wx - 1; x <= r.x + r.w - 2; x++) if (b.in(x, y)) b.use[b.k(x, y)] = "water";
    }
    // 정원 모서리 야자(발밑 풀), 남쪽 끝 협죽도 줄
    for (const [px, py] of [[r.x, r.y], [r.x + r.w - 2, r.y]] as const) {
      const id = pick(rng, ["de-palm-date", "de-palm-young"]);
      const { w, h } = b.kitSize(id);
      if (h > r.h) continue;
      b.prop(id, px, py, 0, ["grass"]); void w;
    }
    for (let x = r.x + 1; x < r.x + r.w - 1; x += 3) b.prop("de-oleander", x, r.y + r.h - 1, 0, ["grass"]);
  }
  // 분수 마당은 정원 위로 다시 깐다(정원이 축선까지 붙었다)
  b.ground({ x: fx - 2, y: midY - 1, w: 7, h: 5 }, "f", "plaza");
  // 성문 안쪽 양옆 깃대
  b.prop("de-banner-pole", g0.x - 3, inner.y + inner.h - 2, 0, ["open", "plaza", "grass"]); b.prop("de-banner-pole", g0.x + gate.length + 2, inner.y + inner.h - 2, 0, ["open", "plaza", "grass"]);
  // 성 밖: 진입로(포석) + 오벨리스크 짝 + 양옆 집 줄(가로 길)
  const ex = g0.x;
  const outY = ring.y + ring.h;
  b.ground({ x: ex, y: outY, w: gate.length, h: H - outY }, "f", "plaza");
  b.prop("de-obelisk", ex - 2, outY + 1, 0); b.prop("de-obelisk", ex + gate.length + 1, outY + 1, 0);
  if (H - outY >= 8) {
    const roadY = H - 3;
    b.ground({ x: 2, y: roadY, w: W - 4, h: 1 }, "r", "road");
    const hs = [...houseRow(b, rng, 2, ex - 3, roadY, [...HOUSES_3, ...HOUSES_4]), ...houseRow(b, rng, ex + gate.length + 3, W - 2, roadY, [...HOUSES_3, ...HOUSES_4])];
    doorDressing(b, rng, hs, roadY);
  }
  wildDesert(b, rng, 0.35);
  return { x: ex, y: H - 1 };
}

// ───────────────────────── 대상 숙소 ─────────────────────────
function composeCaravanserai(b: Board, rng: () => number): DesertCell {
  const { W, H } = b;
  const rw = Math.min(W - 6, 34), rh = Math.min(H - 8, 22);
  const ring = { x: Math.floor((W - rw) / 2), y: 3, w: rw, h: rh };
  const { inner, gate } = wallRing(b, ring, "de-caravanserai-gate", rng);
  b.zone("숙소 마당", "가운데 우물 단·낙타 줄·짐 구석", inner);
  // 북쪽 벽 안쪽 방 줄(마당으로 문) + 방 앞 회랑 길
  const roomY = inner.y + 4;
  b.ground({ x: inner.x, y: roomY, w: inner.w, h: 1 }, "r", "road");
  // 방 줄은 같은 방을 틈 없이(대상 숙소 회랑은 한 건물이다 — 적대 검수: 집 모음처럼 보였다)
  houseRow(b, rng, inner.x, inner.x + inner.w, roomY, ["de-house-adobe-3"], 0, ["road", "open"], false);
  const g0 = gate[0]!;
  const cx = g0.x + Math.floor(gate.length / 2);
  // 성문 → 가운데 단 → 방 회랑 길(다진 흙)
  b.ground({ x: g0.x, y: roomY, w: gate.length, h: inner.y + inner.h - roomY }, "r", "road");
  // 가운데 우물 단(포석 7×5) + 우물 단에서 성문까지 포석 길(적대 검수: 단이 마당 가운데 떠 있었다)
  const cy = roomY + 2 + Math.max(0, Math.floor((inner.y + inner.h - roomY - 2 - 5) / 2));
  b.ground({ x: cx - 3, y: cy, w: 7, h: 5 }, "f", "plaza");
  b.ground({ x: g0.x, y: cy + 5, w: gate.length, h: inner.y + inner.h - cy - 5 }, "f", "plaza");
  b.prop("de-well", cx - 1, cy + 1, 0, ["plaza"]);
  b.prop("de-bench-stone", cx - 3, cy + 4, 0, ["plaza"]); b.prop("de-bench-stone", cx + 2, cy + 4, 0, ["plaza"]);
  b.prop("de-lantern-post", cx - 3, cy, 0, ["plaza"]); b.prop("de-lantern-post", cx + 3, cy, 0, ["plaza"]);
  // 서쪽: 낙타 줄(말뚝·물통·낙타 셋)
  const wx = inner.x + 1, wy = roomY + 2;
  b.zone("낙타 줄", "말뚝·물통·낙타", { x: wx, y: wy, w: 8, h: inner.y + inner.h - wy });
  for (let i = 0, y = wy; i < 3 && y + 2 < inner.y + inner.h; i++, y += 3) {
    b.prop("de-hitch-post", wx, y + 1, 0); b.prop(i === 1 ? "de-camel-rest" : "de-camel", wx + 1, y, 0);
    if (i % 2 === 0) b.prop("de-trough", wx + 4, y + 1, 0); else b.prop("de-sacks", wx + 4, y + 1, 0);
  }
  // 동쪽: 짐 구석(수레·궤짝·자루·항아리) + 정자 천막
  const ex = inner.x + inner.w - 9, ey = roomY + 2;
  b.zone("짐 구석", "대상 수레·궤짝·자루", { x: ex, y: ey, w: 8, h: inner.y + inner.h - ey });
  b.prop("de-tent-pavilion", ex + 4, ey, 0);
  b.prop("de-cart-camel", ex, ey + 1, 0);
  b.prop("de-crates-stack", ex, ey + 4, 0); b.prop("de-sacks", ex + 2, ey + 5, 0); b.prop("de-jars-group", ex + 4, ey + 5, 0); b.prop("de-carpet-rolls", ex + 6, ey + 5, 0);
  b.prop("de-handcart", ex + 5, ey + 4, 0);
  // 마당 바닥: 모서리 길이 아닌 곳은 모래 + 드문 마른 풀(평평한 단색 마당 방지)
  // 남쪽 귀퉁이(성문 양옆) 화단
  gardenBed(b, rng, { x: inner.x, y: inner.y + inner.h - 5, w: g0.x - 2 - inner.x, h: 5 }, 6, 4, { x: inner.x, y: inner.y + inner.h });
  gardenBed(b, rng, { x: g0.x + gate.length + 2, y: inner.y + inner.h - 5, w: inner.x + inner.w - g0.x - gate.length - 2, h: 5 }, 6, 4, { x: inner.x + inner.w, y: inner.y + inner.h });
  b.scatter(inner, 5, ["de-tuft", "de-rock-small"], rng, 3);
  // 성 밖: 성문 → 남쪽 끝 길 + 대상 행렬 대기(낙타·수레)
  b.ground({ x: g0.x, y: ring.y + ring.h, w: gate.length, h: H - ring.y - ring.h }, "r", "road");
  b.prop("de-camel", g0.x + gate.length + 2, ring.y + ring.h + 1, 0); b.prop("de-signpost", g0.x - 2, ring.y + ring.h + 1, 0);
  wildDesert(b, rng, 0.4);
  return { x: g0.x, y: H - 1 };
}

// ───────────────────────── 피라미드 유적 ─────────────────────────
function composePyramid(b: Board, rng: () => number): DesertCell {
  const { W, H } = b;
  // 대피라미드(14×9, 오른쪽 2칸은 땅 그림자 — 밑변 폭 12칸) — 적대 검수(2026-10-14): 8칸 피라미드는 장면 중심으로 작았다
  const big = b.pal.kit("de-pyramid-great") ? "de-pyramid-great" : "de-pyramid";
  const pk = b.kitSize(big);
  const base = big === "de-pyramid-great" ? 12 : 7;
  const px = Math.round((W - pk.w) / 2) + Math.round((rng() - 0.5) * 6), py = 2;
  b.stamp(big, px, py, "bld");
  b.zone("대피라미드", "유적 중심 · 남쪽 입구로 내부", { x: px, y: py, w: pk.w, h: pk.h });
  const dk = b.kitSize("de-pyramid-door");
  const dx = px + Math.floor((base - dk.w) / 2), dy = py + pk.h - dk.h + 1;
  const door = b.building("de-pyramid-door", dx, dy);
  // 참배 길: 입구 → 남쪽 끝(포석 2줄), 끝에 탑문(성문 키트), 양옆 석상 짝(4칸 간격)
  const ax = door.access[0]!.x;
  b.ground({ x: ax, y: dy + dk.h, w: 2, h: H - dy - dk.h }, "f", "plaza");
  b.zone("참배 길", "포석 길 · 양옆 석상 줄 · 남쪽 탑문", { x: ax - 3, y: dy + dk.h, w: 8, h: H - dy - dk.h });
  const pyl = b.kitSize("de-wall-gate");
  const pylY = H - 1 - pyl.h;
  if (b.free({ x: ax - 1, y: pylY, w: pyl.w, h: pyl.h }, 0, ["open", "plaza"])) {
    b.stamp("de-wall-gate", ax - 1, pylY, "wall");
    b.zone("탑문", "참배 길 남쪽 끝 문", { x: ax - 1, y: pylY, w: pyl.w, h: pyl.h });
  }
  const pairs = ["de-lion-statue", "de-obelisk", "de-column", "de-obelisk"];
  let k = 0;
  for (let y = dy + dk.h + 1; y < pylY - 1; y += 4, k++) {
    const id = pairs[k % pairs.length]!;
    const { w, h } = b.kitSize(id);
    const yy = Math.max(dy + dk.h, y + 2 - h);
    if (yy + h > pylY - 1) break;
    b.prop(id, ax - 1 - w, yy, 0); b.prop(id, ax + 3, yy, 0);
  }
  // 곁 피라미드: 서쪽 중간 크기, 동쪽 작은 것(어긋나게)
  const mk = b.kitSize("de-pyramid"), sk = b.kitSize("de-pyramid-small");
  if (big !== "de-pyramid" && px - mk.w - 1 >= 1 && b.free({ x: px - mk.w - 1, y: py + 2, w: mk.w, h: mk.h }, 0)) {
    b.stamp("de-pyramid", px - mk.w - 1, py + 2, "bld"); b.zone("왕비 피라미드", "곁 무덤", { x: px - mk.w - 1, y: py + 2, w: mk.w, h: mk.h });
  }
  const rx = px + pk.w + 1;
  if (rx + sk.w < W - 1 && b.free({ x: rx, y: py + 4, w: sk.w, h: sk.h }, 0)) { b.stamp("de-pyramid-small", rx, py + 4, "bld"); b.zone("작은 피라미드", "곁 무덤", { x: rx, y: py + 4, w: sk.w, h: sk.h }); }
  // 무너진 신전 터 둘(참배 길 양옆 아래) — 배치는 신전마다 다르다
  ruinedTemple(b, rng, { x: 1, y: py + pk.h, w: ax - 4, h: H - py - pk.h - 1 });
  ruinedTemple(b, rng, { x: ax + 5, y: py + pk.h, w: W - ax - 6, h: H - py - pk.h - 1 });
  for (let i = 0; i < 4; i++) { const r = findOpen(b, rng, 2, 3, 1); if (r) b.prop(pick(rng, ["de-column-broken", "de-block-fallen", "de-stele"]), r.x, r.y, 0); }
  camp(b, rng, { x: 1, y: Math.round(H * 0.4), w: b.W - 2, h: H - Math.round(H * 0.4) - 1 });
  wildDesert(b, rng, 0.32);
  return { x: ax, y: H - 1 };
}

const COMPOSERS: Readonly<Record<DesertKind, (b: Board, rng: () => number) => DesertCell>> = {
  oasis: composeOasis, bazaar: composeBazaar, palace: composePalace, pyramid: composePyramid, caravanserai: composeCaravanserai,
};

/** 한 장 짜기. 시작 칸에서 모든 문 접근칸에 닿지 못하면 씨앗을 바꿔 다시(최대 6번) — 그래도 안 되면 던진다. */
export function composeDesertEast(spec: DesertSpec, pal: DesertPalette): DesertResult {
  const min = DESERT_MIN_SIZE[spec.kind];
  if (spec.width < min.w || spec.height < min.h) throw new Error(`${DESERT_KIND_LABEL[spec.kind]} 는 ${min.w}×${min.h} 이상이어야 한다(지금 ${spec.width}×${spec.height})`);
  const base = spec.seed ?? 0;
  let last = "";
  for (let attempt = 0; attempt < 6; attempt++) {
    const seed = base * 7919 + attempt * 104729 + 17;
    const rng = mulberry(seed);
    const b = new Board(spec.width, spec.height, pal, seed);
    let start: DesertCell;
    try { start = COMPOSERS[spec.kind](b, rng); } catch (e) { last = (e as Error).message; continue; }
    b.paintGround();
    // 남쪽 끝 시작 칸이 걸을 수 없으면 가까운 길 칸
    if (!b.walk(start.x, start.y)) {
      for (let d = 1; d < 6 && !b.walk(start.x, start.y); d++) for (const dx of [-d, d]) if (b.walk(start.x + dx, start.y)) { start = { x: start.x + dx, y: start.y }; break; }
    }
    const seen = b.reach(start);
    const miss = b.buildings.flatMap((d) => d.access.filter((a) => !seen.has(b.k(a.x, a.y))).map((a) => `${d.name}(${a.x},${a.y})`));
    if (!miss.length) {
      if (attempt) b.notes.push(`씨앗 ${attempt}번 다시 짬(앞 판은 ${last})`);
      return { lower: b.lower, upper: b.upper, buildings: b.buildings, zones: b.zones, start, props: b.props, notes: b.notes };
    }
    last = `닿지 못한 문 ${miss.slice(0, 3).join(", ")}`;
    if (spec.debugKeepUnreachable && attempt === 5) { b.notes.push(last); return { lower: b.lower, upper: b.upper, buildings: b.buildings, zones: b.zones, start, props: b.props, notes: b.notes }; }
  }
  throw new Error(`배치를 짜지 못했다 — ${last}`);
}

/** 번들 정의(+ 구성기 사전 desertEastPieces.json)로 사전을 만든다. */
export function desertPaletteFromTileset(def: {
  readonly passability: readonly { readonly up: boolean }[];
  readonly structureKits?: readonly unknown[];
}, pieces: { readonly tiles: Readonly<Record<string, number>>; readonly wang: Readonly<Record<string, readonly number[]>> }): DesertPalette {
  const kits = new Map<string, DesertKit>();
  for (const raw of def.structureKits ?? []) {
    const k = raw as { id: string; width: number; height: number; rows: DesertKit["rows"]; parts?: { kind: string; dx: number; w: number }[] };
    if (!k?.id || !Array.isArray(k.rows)) continue;
    const part = k.parts?.find((p) => p.kind === "entrance");
    kits.set(k.id, { id: k.id, width: k.width, height: k.height, rows: k.rows, door: part ? { dx: part.dx, w: part.w } : undefined });
  }
  return {
    tile: (piece) => pieces.tiles[piece] ?? -1,
    wang: (set, idx) => pieces.wang[set]?.[idx] ?? -1,
    kit: (id) => kits.get(id),
    passable: (t) => !!def.passability[t]?.up,
  };
}

// ═════════════════════════ 실내 방 ═════════════════════════
// 방 한 칸 구조(손 도트 실내 v5 와 같은 문법): 맨 윗줄 = 천장, 그 아래 두 줄 = 벽면(1×2 키트), 서·동 가장자리 = 천장 테(ceil-*-w/e),
// 맨 아랫줄 = 천장 테(ceil-*-s) + 문 틈(바닥 칸, 나가는 이벤트 자리), 아래 모서리 = ceil-*-sw/se.
// 무덤은 남쪽 문에서 좁은 통로(폭 3)가 북쪽 묘실로 이어진다 — 통로 양옆은 천장으로 막는다(ㅁ자 방 금지·천장 밑 벽 규칙을 지킨다).
// 가구는 벽 앞 줄(벽 바로 아래)·가운데 무리·모서리로 나눠 놓고, 문 → 방 가운데 통로 한 줄은 비운다. 모든 빈 바닥이 문에서 닿아야 한다.

export type DesertRoomKind = "teahouse" | "shop" | "palace_hall" | "tomb" | "hammam" | "inn";
export const DESERT_ROOM_LABEL: Readonly<Record<DesertRoomKind, string>> = {
  teahouse: "찻집", shop: "바자르 가게", palace_hall: "궁전 알현실", tomb: "피라미드 묘실(통로 포함)", hammam: "목욕탕(함맘)", inn: "여관 방",
};
export const DESERT_ROOM_MIN: Readonly<Record<DesertRoomKind, { w: number; h: number }>> = {
  teahouse: { w: 12, h: 9 }, shop: { w: 10, h: 8 }, palace_hall: { w: 16, h: 13 }, tomb: { w: 13, h: 16 }, hammam: { w: 12, h: 10 }, inn: { w: 12, h: 9 },
};
export const DESERT_ROOM_MAX = { w: 24, h: 20 } as const;

interface RoomStyle { ceil: "warm" | "tomb"; walls: readonly string[]; accentWall?: string; accentEvery?: number; floor: readonly string[]; floorAlt?: string }
const ROOM_STYLE: Readonly<Record<DesertRoomKind, RoomStyle>> = {
  teahouse: { ceil: "warm", walls: ["de-wall-plaster"], accentWall: "de-wall-window-plaster", accentEvery: 4, floor: ["de-floor-zellige"], floorAlt: "de-floor-zellige-b" },
  shop: { ceil: "warm", walls: ["de-wall-stone"], accentWall: "de-wall-niche-stone", accentEvery: 4, floor: ["de-floor-flag"], floorAlt: "de-floor-flag-b" },
  palace_hall: { ceil: "warm", walls: ["de-wall-palace"], floor: ["de-floor-marble"], floorAlt: "de-floor-marble-b" },
  tomb: { ceil: "tomb", walls: ["de-wall-tomb"], floor: ["de-floor-tomb"], floorAlt: "de-floor-tomb-b" },
  hammam: { ceil: "warm", walls: ["de-wall-hammam"], floor: ["de-floor-marble"], floorAlt: "de-floor-marble-b" },
  inn: { ceil: "warm", walls: ["de-wall-plaster"], accentWall: "de-wall-window-plaster", accentEvery: 5, floor: ["de-floor-wood"], floorAlt: "de-floor-wood-b" },
};

export interface DesertRoomSpec { readonly width: number; readonly height: number; readonly kind: DesertRoomKind; readonly seed?: number }
export interface DesertRoomResult {
  readonly lower: number[]; readonly upper: number[];
  /** 문 틈(아랫줄 바닥 칸) — 나가는 이동 이벤트를 여기에. */
  readonly doors: DesertCell[];
  readonly start: DesertCell;
  readonly props: { kit: string; x: number; y: number }[];
  readonly notes: string[];
}

type RUse = "ceil" | "wall" | "floor" | "aisle" | "prop";

class Room {
  readonly lower: number[]; readonly upper: number[]; readonly use: RUse[];
  readonly props: { kit: string; x: number; y: number }[] = [];
  /** 강조 벽(창·벽감) 칸 x — 벽등을 그 위에 걸지 않는다. */
  readonly accent = new Set<number>();
  constructor(readonly W: number, readonly H: number, readonly pal: DesertPalette, readonly seed: number) {
    this.lower = new Array(W * H).fill(-1); this.upper = new Array(W * H).fill(-1); this.use = new Array(W * H).fill("ceil");
  }
  k(x: number, y: number) { return y * this.W + x; }
  u(x: number, y: number): RUse | undefined { return x >= 0 && y >= 0 && x < this.W && y < this.H ? this.use[this.k(x, y)] : undefined; }
  t(piece: string): number { const t = this.pal.tile(piece); if (t < 0) throw new Error(`사막 칩셋에 ${piece} 칸이 없다`); return t; }
  setLower(x: number, y: number, piece: string, use: RUse) { const k = this.k(x, y); this.lower[k] = this.t(piece); this.use[k] = use; }
  /** 가구: 발자국이 모두 바닥(aisle 제외)이고 margin 둘레에 다른 가구가 없을 때만. */
  put(id: string, x: number, y: number, margin = 0, allowAisle = false): boolean {
    const kit = this.pal.kit(id);
    if (!kit) return false;
    for (let j = -margin; j < kit.height + margin; j++) for (let i = -margin; i < kit.width + margin; i++) {
      const inside = i >= 0 && j >= 0 && i < kit.width && j < kit.height;
      const u = this.u(x + i, y + j);
      if (inside) { if (u !== "floor" && !(allowAisle && u === "aisle")) return false; }
      else if (u === "prop") return false;
    }
    kit.rows.forEach((row, j) => row.tiles.forEach((lo, i) => {
      const k = this.k(x + i, y + j), up = row.upperTiles?.[i] ?? -1;
      if (lo >= 0) this.lower[k] = lo;
      if (up >= 0) this.upper[k] = up;
      this.use[k] = "prop";
    }));
    this.props.push({ kit: id, x, y });
    return true;
  }
  /** put 하되, 그 때문에 문에서 닿지 않는 바닥이 생기면 되돌린다. */
  putSafe(id: string, x: number, y: number, door: DesertCell): boolean {
    const lo = this.lower.slice(), up = this.upper.slice(), us = this.use.slice(), n = this.props.length;
    if (!this.put(id, x, y)) return false;
    if (!roomCut(this, door).length) return true;
    this.lower.splice(0, lo.length, ...lo); this.upper.splice(0, up.length, ...up); this.use.splice(0, us.length, ...us); this.props.length = n;
    return false;
  }
  /** 벽걸이(등)는 벽 아랫줄 칸 위층에 겹친다. */
  hang(id: string, x: number, y: number): boolean {
    const kit = this.pal.kit(id);
    if (!kit || this.u(x, y) !== "wall") return false;
    const up = kit.rows[0]?.upperTiles?.[0] ?? -1, lo = kit.rows[0]?.tiles[0] ?? -1;
    const t = up >= 0 ? up : lo;
    if (t < 0) return false;
    this.upper[this.k(x, y)] = t; this.props.push({ kit: id, x, y });
    return true;
  }
  walk(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return false;
    const k = this.k(x, y), lo = this.lower[k]!, up = this.upper[k]!;
    return lo >= 0 && this.pal.passable(lo) && (up < 0 || this.pal.passable(up));
  }
}

/** 방 뼈대: 천장·벽·바닥·문 틈. 무덤은 통로(폭 3) + 묘실. 돌려주는 값 = 바닥 사각(묘실/방)·문 칸들. */
function roomShell(r: Room, style: RoomStyle, kind: DesertRoomKind, rng: () => number): { room: Rect; doors: DesertCell[]; corridor?: Rect } {
  const { W, H } = r;
  const c = style.ceil;
  const doorW = kind === "palace_hall" ? 2 : kind === "tomb" ? 1 : 2;
  const dx0 = Math.floor((W - doorW) / 2);
  // 무덤: 묘실 아래 경계 hb(천장 테 줄), 통로 x = cx-1..cx+1
  const tomb = kind === "tomb";
  const hb = tomb ? Math.max(10, H - 7) : H - 1;
  const cx = Math.floor(W / 2);
  const corridor = tomb ? { x: cx - 1, y: hb, w: 3, h: H - 1 - hb } : undefined;
  const floorCell = (x: number, y: number) => {
    if (y >= 3 && y < hb && x >= 1 && x < W - 1) return true;               // 방/묘실 바닥
    if (corridor && y >= hb && y < H - 1 && x >= corridor.x && x < corridor.x + corridor.w) return true;
    return false;
  };
  const fpick = (x: number, y: number) => {
    const alt = style.floorAlt && hash2(x, y, r.seed + 3) < (tomb ? 0.0 : 0.16);
    return alt ? style.floorAlt! : style.floor[Math.floor(hash2(x, y, r.seed + 5) * style.floor.length)]!;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (floorCell(x, y)) { r.setLower(x, y, fpick(x, y), "floor"); continue; }
    if (y === 1 || y === 2) if (x >= 1 && x < W - 1) continue;              // 벽(아래에서)
    // 천장: 이웃 바닥 방향으로 테
    const fN = floorCell(x, y - 1) || ((y - 1 === 1 || y - 1 === 2) && x >= 1 && x < W - 1 && false);
    const fE = floorCell(x + 1, y) || ((y === 1 || y === 2) && x === 0);
    const fW = floorCell(x - 1, y) || ((y === 1 || y === 2) && x === W - 1);
    const isDoor = y === H - 1 && x >= (tomb ? cx : dx0) && x < (tomb ? cx + 1 : dx0 + doorW);
    if (isDoor) { r.setLower(x, y, fpick(x, y), "aisle"); continue; }
    let piece = `de-ceil-${c}`;
    if (fN && fE) piece = `de-ceil-${c}-sw`;
    else if (fN && fW) piece = `de-ceil-${c}-se`;
    else if (fN) piece = `de-ceil-${c}-s`;
    else if (fE) piece = `de-ceil-${c}-w`;
    else if (fW) piece = `de-ceil-${c}-e`;
    r.setLower(x, y, piece, "ceil");
  }
  // 벽면(1×2 키트): 가끔 강조 벽(창·벽감), 서로 붙지 않게
  let last = -9;
  for (let x = 1; x < W - 1; x++) {
    let id = style.walls[Math.floor(hash2(x, 1, r.seed) * style.walls.length)]!;
    if (style.accentWall && style.accentEvery && x - last >= style.accentEvery && x > 1 && x < W - 2 && rng() < 0.55) { id = style.accentWall; last = x; r.accent.add(x); }
    const kit = r.pal.kit(id) ?? r.pal.kit(style.walls[0]!);
    if (!kit) throw new Error(`사막 칩셋에 벽 ${id} 가 없다`);
    kit.rows.forEach((row, j) => { const k = r.k(x, 1 + j); r.lower[k] = row.tiles[0] ?? -1; if ((row.upperTiles?.[0] ?? -1) >= 0) r.upper[k] = row.upperTiles![0]!; r.use[k] = "wall"; });
  }
  const doors: DesertCell[] = [];
  for (let x = 0; x < W; x++) if (r.u(x, H - 1) === "aisle") doors.push({ x, y: H - 1 });
  // 문 → 방 가운데 통로 한 줄(폭 = 문 폭)은 비워 둔다
  const ax0 = doors[0]!.x, aw = doors.length;
  for (let y = Math.round((3 + hb) / 2); y < H - 1; y++) for (let x = ax0; x < ax0 + aw; x++) if (r.u(x, y) === "floor") r.use[r.k(x, y)] = "aisle";
  return { room: { x: 1, y: 3, w: W - 2, h: hb - 3 }, doors, corridor };
}

function furnish(r: Room, kind: DesertRoomKind, room: Rect, rng: () => number, corridor?: Rect): void {
  const x0 = room.x, x1 = room.x + room.w - 1, y0 = room.y, y1 = room.y + room.h - 1;
  const cx = Math.floor((x0 + x1) / 2);
  const wallRow = (ids: readonly string[], from: number, to: number, gap = 0) => {
    let x = from;
    for (const id of ids) {
      const w = r.pal.kit(id)?.width ?? 1;
      while (x + w - 1 <= to && !r.put(id, x, y0)) x++;
      x += w + gap;
    }
  };
  const lanterns = (every: number, id = "de-lantern-wall") => {
    for (let x = x0 + 2; x <= x1 - 1; x += every) {
      const xx = [x, x + 1, x - 1].find((c) => c > x0 && c < x1 && !r.accent.has(c));   // 창·벽감 위에는 걸지 않는다
      if (xx !== undefined) r.hang(id, xx, 2);
    }
  };
  switch (kind) {
    case "teahouse": {
      wallRow(["de-divan", "de-divan"], x0, cx - 2);
      r.put("de-tea-counter", cx + 1, y0) || r.put("de-tea-counter", cx, y0);
      r.put("de-jar-tall", x1, y0); r.put("de-hookah", x1 - 1, y0);
      r.put("de-tea-table", x0, y0 + 1); r.put("de-tea-table", x0 + 2, y0 + 1);
      // 가운데 양탄자 무리: 양탄자(3×2) 위 찻상, 둘레 방석
      const rx = x1 - 4, ry = y0 + 3;
      if (r.put("de-rug-medallion", rx, ry, 0)) {
        // 양탄자 칸은 prop 이 됐다 — 그 위 찻상·방석은 위층에 덧놓는다(바닥에 깐 것이라 겹쳐도 된다)
        overlay(r, "de-tea-table", rx, ry); overlay(r, "de-cushion", rx + 2, ry); overlay(r, "de-cushion", rx, ry + 1); overlay(r, "de-cushion", rx + 1, ry + 1);
      }
      r.put("de-cushion", x0, y0 + 2); r.put("de-cushion", x0 + 3, y0 + 2); r.put("de-hookah", x0 + 4, y0 + 1);
      r.put("de-jar-tall", x0, y1); r.put("de-jar-tall", x1, y1);
      r.put("de-tea-table", x1 - 3, y1 - 1, 0) && (r.put("de-cushion", x1 - 3, y1), r.put("de-cushion", x1 - 2, y1), r.put("de-hookah", x1 - 1, y1 - 1));
      if (room.h >= 7) { r.put("de-tea-table", x0 + 1, y1 - 2, 1); r.put("de-cushion", x0 + 1, y1 - 1); r.put("de-cushion", x0 + 2, y1 - 1); }
      lanterns(5);
      break;
    }
    case "shop": {
      wallRow(["de-shelf-pottery", "de-shelf-pottery", "de-shelf-pottery"], x0, x1 - 3, 1);
      r.put("de-carpet-stack", x1 - 1, y0) || r.put("de-carpet-stack", x1 - 2, y0);
      // 계산대: 선반 앞 두 줄 아래, 통로를 피해 가로로(앞 1칸 손님 자리는 비운다)
      let placed = false;
      for (const yy of [y0 + 3, y0 + 2]) for (let xx = cx + 1; xx <= x1 - 2 && !placed; xx++) if (r.put("de-shop-counter", xx, yy, 0)) { placed = true; r.put("de-chest-brass", xx + 2, yy); }
      for (const yy of [y0 + 3, y0 + 2]) for (let xx = cx - 3; xx >= x0 && !placed; xx--) if (r.put("de-shop-counter", xx, yy, 0)) placed = true;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, -1]] as const) r.put("de-sacks-spice", x0 + dx, y1 + dy);
      r.put("de-jar-tall", x1, y1); r.put("de-jar-tall", x1 - 1, y1);
      if (room.w >= 10) r.put("de-rug-medallion", x0, y0 + 3) || r.put("de-carpet-stack", x0, y0 + 3);
      lanterns(4, "de-lantern-wall");
      break;
    }
    case "palace_hall": {
      r.put("de-throne", cx, y0) || r.put("de-throne", cx - 1, y0);
      r.put("de-brazier-stand", cx - 2, y0); r.put("de-brazier-stand", cx + 3, y0);
      r.put("de-vase-tall", x0, y0); r.put("de-vase-tall", x1, y0);
      wallRow(["de-divan-royal"], x0 + 1, cx - 3); wallRow(["de-divan-royal"], cx + 4, x1 - 1);
      // 옥좌 앞 양탄자(통로 위에 깔아도 된다 — 걸을 수 있다)
      r.put("de-rug-medallion", cx - 1, y0 + 2, 0, true);
      // 기둥 두 줄(벽에서 1칸, 3칸 간격, 바닥 끝까지)
      for (let y = y0 + 2; y + 1 <= y1 - 1; y += 3) { r.put("de-column-palace", x0 + 1, y); r.put("de-column-palace", x1 - 1, y); }
      // 축 위 분수(둘레 1칸 비움) — 문에서 옥좌로 가는 길은 분수 양옆으로 돈다
      if (room.h >= 8) r.put("de-fountain-indoor", cx, y0 + 5 + Math.floor((room.h - 8) / 2), 1, true) || r.put("de-fountain-indoor", cx - 1, y0 + 5, 1, true);
      // 기둥 사이 꽃병, 문 안쪽 양옆 화로대
      r.put("de-brazier-stand", cx - 3, y1 - 1); r.put("de-brazier-stand", cx + 4, y1 - 1);
      // 문 → 분수 → 옥좌 축 위 양탄자 길(걸을 수 있는 바닥 깔개)
      // (한 칸 바닥 깔개 — 키트가 아니라 바닥 칸을 갈아 끼운다. 분수·가구를 만나면 멈춘다)
      if (r.pal.tile("de-rug-runner") >= 0) for (let y = y1; y >= y0 + 2; y--) {
        const u = r.u(cx, y);
        if (u !== "aisle" && u !== "floor") break;
        r.lower[r.k(cx, y)] = r.t("de-rug-runner");
      }
      break;
    }
    case "tomb": {
      r.put("de-sarcophagus", cx, y0 + 2) || r.put("de-sarcophagus", cx - 1, y0 + 2);
      r.put("de-canopic-jars", cx - 1, y0 + 2) || r.put("de-canopic-jars", cx - 2, y0 + 2);
      r.put("de-canopic-jars", cx + 2, y0 + 2) || r.put("de-canopic-jars", cx + 1, y0 + 2);
      r.put("de-guardian-statue", x0, y0); r.put("de-guardian-statue", x1, y0);
      r.put("de-offering-table", cx, y0 + 4) || r.put("de-offering-table", cx - 1, y0 + 4);
      // 북벽 앞 줄: 보물 궤·항아리
      for (const x of [x0 + 2, x0 + 3, x1 - 3, x1 - 2]) r.put(x === x0 + 2 || x === x1 - 2 ? "de-treasure-chest" : "de-jar-tall", x, y0);
      r.put("de-torch-stand", x0 + 1, y0 + 3); r.put("de-torch-stand", x1 - 1, y0 + 3);
      r.put("de-torch-stand", x0 + 1, y1 - 1); r.put("de-torch-stand", x1 - 1, y1 - 1);
      // 묘실 양옆 벽 앞: 부장품 줄(항아리·카노푸스 단지·보물 궤) — 통로는 비운다(적대 검수: 통로 모래 더미가 길을 막아 보였다)
      const door = { x: Math.floor((x0 + x1) / 2), y: r.H - 2 };
      for (let y = y0 + 2; y <= y1 - 2; y += 2) {
        r.putSafe(pick(rng, ["de-jar-tall", "de-canopic-jars", "de-vase-tall"]), x0, y, door);
        r.putSafe(pick(rng, ["de-jar-tall", "de-canopic-jars", "de-treasure-chest"]), x1, y, door);
      }
      r.put("de-sand-pile", x0, y1); r.put("de-sand-pile", x1, y1);
      void corridor;
      break;
    }
    case "hammam": {
      for (let x = x0 + 1; x <= x1 - 1; x += 3) r.put("de-basin-tap", x, y0);
      const px = cx - 1, py = y0 + 2 + Math.max(0, Math.floor((room.h - 6) / 2));
      r.put("de-plunge-pool", px, py, 1);
      r.put("de-marble-bench", x0, py + 1) ; r.put("de-marble-bench", x1 - 1, py + 1);
      r.put("de-towel-rack", x0, y1); r.put("de-towel-rack", x1, y1);
      r.put("de-marble-bench", x0 + 1, y1) ; r.put("de-marble-bench", x1 - 2, y1);
      r.put("de-vase-tall", x0, y0 + 2); r.put("de-vase-tall", x1, y0 + 2);
      r.put("de-column-palace", x0, y1 - 2); r.put("de-column-palace", x1, y1 - 2);
      break;
    }
    case "inn": {
      // 침상 줄(벽 앞, 2칸 간격) + 발치 궤짝
      let n = 0;
      for (let x = x0; x <= x1 && n < 4; x += 2) {
        if (x === cx || x === cx - 1) continue;
        if (r.put("de-bed-mat", x, y0)) { n++; if (rng() < 0.6) r.put("de-chest-brass", x, y0 + 2); }
      }
      r.put("de-shelf-inn", x1, y0);
      r.put("de-tannur-oven", x0, y1, 0); r.put("de-jar-tall", x0 + 1, y1);
      r.put("de-divan", x1 - 2, y1); r.put("de-tea-table", x1 - 2, y1 - 1, 0);
      r.put("de-rug-medallion", x0 + 1, y0 + 3) && overlay(r, "de-cushion", x0 + 2, y0 + 3);
      lanterns(5);
      break;
    }
  }
}

/** 문 안쪽 칸에서 닿지 않는 빈 바닥 칸 목록. */
function roomCut(r: Room, start: DesertCell): string[] {
  const seen = new Set<number>([r.k(start.x, start.y)]); const q = [start];
  while (q.length) { const c = q.pop()!; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const x = c.x + dx, y = c.y + dy; if (!r.walk(x, y) || seen.has(r.k(x, y))) continue; seen.add(r.k(x, y)); q.push({ x, y }); } }
  const cut: string[] = [];
  for (let y = 0; y < r.H; y++) for (let x = 0; x < r.W; x++) if ((r.u(x, y) === "floor" || r.u(x, y) === "aisle") && r.walk(x, y) && !seen.has(r.k(x, y))) cut.push(`(${x},${y})`);
  return cut;
}

/** 바닥에 깐 양탄자(prop) 위에 다른 가구를 겹친다(아래층은 양탄자, 위층은 가구 그림). */
function overlay(r: Room, id: string, x: number, y: number): void {
  const kit = r.pal.kit(id);
  if (!kit) return;
  kit.rows.forEach((row, j) => row.tiles.forEach((lo, i) => {
    const k = r.k(x + i, y + j), up = row.upperTiles?.[i] ?? -1;
    const t = up >= 0 ? up : lo;
    if (t >= 0) r.upper[k] = t;
  }));
  r.props.push({ kit: id, x, y });
}

export function composeDesertRoom(spec: DesertRoomSpec, pal: DesertPalette): DesertRoomResult {
  const min = DESERT_ROOM_MIN[spec.kind];
  if (spec.width < min.w || spec.height < min.h) throw new Error(`${DESERT_ROOM_LABEL[spec.kind]} 는 ${min.w}×${min.h} 이상이어야 한다`);
  if (spec.width > DESERT_ROOM_MAX.w || spec.height > DESERT_ROOM_MAX.h) throw new Error(`방은 ${DESERT_ROOM_MAX.w}×${DESERT_ROOM_MAX.h} 이하로 — 큰 방은 빈 바닥이 남는다`);
  let last = "";
  for (let attempt = 0; attempt < 6; attempt++) {
    const seed = (spec.seed ?? 0) * 7919 + attempt * 104729 + 29;
    const rng = mulberry(seed);
    const r = new Room(spec.width, spec.height, pal, seed);
    const style = ROOM_STYLE[spec.kind];
    const { room, doors, corridor } = roomShell(r, style, spec.kind, rng);
    furnish(r, spec.kind, room, rng, corridor);
    // 모든 빈 바닥이 문에서 닿는가
    const start = { x: doors[0]!.x, y: doors[0]!.y - 1 };
    const cut = roomCut(r, start);
    if (!cut.length) return { lower: r.lower, upper: r.upper, doors, start, props: r.props, notes: attempt ? [`씨앗 ${attempt}번 다시`] : [] };
    last = `문에서 닿지 않는 바닥 ${cut.slice(0, 4).join(" ")}`;
  }
  throw new Error(`방을 짜지 못했다 — ${last}`);
}
