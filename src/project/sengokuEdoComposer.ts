// project/sengokuEdoComposer.ts
// 전국·에도 일본(sengoku_edo) 야외 구성기 — 용도(style)·씨앗·맵 크기만 주면 매번 다른 한 장을 짠다.
//
// 순서는 campusComposer·jpCityStreetComposer 와 같다: 계획(띠·구획) → 건물(키트, 문 남향, 접근칸 예약) → 길(문마다 접근칸에서 길망까지) → 소품(용도·여백) → 바닥 가장자리·변주.
// 조화 규칙(jp_city 적대 검수 교훈, ~/claude-viz/harmony-qa.html):
//   - 바닥은 구역마다 한 재질(풀밭 위에 흙길·돌길만 다른 재질). 띠 전체를 한 칸으로 덮지 않는다 — 덩이 잡음으로 변주.
//   - 건물·소품은 발자국 + 여백을 예약하고 겹치지 않는다. 문 칸은 막힘, 바로 아래 접근칸과 그 아래 한 칸은 비운다.
//   - 소품은 맞는 바닥 위에만(노점·등은 길, 석등·고마이누는 참배길 옆, 볏단·우물은 마당). 빈 땅은 쓰임(숲 덩이·밭·정원)을 준다.
// 순수 함수다(프로젝트를 모른다). 칸 번호는 호출자가 준 사전(palette)에서 얻는다 — 도구(sengokuEdoTools.ts)는 번들 정의에서, QA 스크립트는 구운 JSON 에서.

export type SengokuStyle = "castle_town" | "inn_street" | "samurai" | "castle" | "temple" | "village";
export const SENGOKU_STYLES: readonly SengokuStyle[] = ["castle_town", "inn_street", "samurai", "castle", "temple", "village"];

export interface SengokuKit {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly rows: readonly { readonly tiles: readonly number[]; readonly upperTiles?: readonly number[] }[];
  readonly door?: { readonly dx: number; readonly w: number };
}
export interface SengokuPalette {
  /** 한 칸 바닥 조각 이름(grass·road·water-n …) → 칸 번호. 없으면 -1. */
  tile(piece: string): number;
  kit(id: string): SengokuKit | undefined;
}
export interface SengokuCell { readonly x: number; readonly y: number }
export interface SengokuBuilding { readonly name: string; readonly kit: string; readonly rect: { x: number; y: number; w: number; h: number }; readonly doors: SengokuCell[]; readonly access: SengokuCell[] }
export interface SengokuSpec { readonly width: number; readonly height: number; readonly style: SengokuStyle; readonly seed?: number }
export interface SengokuResult {
  readonly lower: number[];
  readonly upper: number[];
  readonly buildings: SengokuBuilding[];
  readonly start: SengokuCell;
  readonly props: { kit: string; x: number; y: number }[];
  readonly notes: string[];
}

export const SENGOKU_MIN_SIZE: Readonly<Record<SengokuStyle, { w: number; h: number }>> = {
  castle_town: { w: 48, h: 48 }, inn_street: { w: 48, h: 40 }, samurai: { w: 48, h: 36 }, castle: { w: 40, h: 36 }, temple: { w: 50, h: 36 }, village: { w: 48, h: 40 },
};
export const SENGOKU_DEFAULT_SIZE: Readonly<Record<SengokuStyle, { w: number; h: number }>> = {
  castle_town: { w: 56, h: 48 }, inn_street: { w: 56, h: 40 }, samurai: { w: 52, h: 36 }, castle: { w: 44, h: 38 }, temple: { w: 54, h: 38 }, village: { w: 54, h: 42 },
};
export const SENGOKU_STYLE_KO: Readonly<Record<SengokuStyle, string>> = {
  castle_town: "성하마을(성 + 해자 + 마치야 거리)", inn_street: "여관 거리(가도 역참 마을)", samurai: "무가 저택 거리(담·문·정원·다실)",
  castle: "성(천수각·성벽·망루·해자)", temple: "신사·절 경내", village: "농촌 마을(논·초가·강·다리)",
};

const NAME: Readonly<Record<string, string>> = {
  "se-machiya-a": "마치야", "se-machiya-b": "마치야", "se-machiya-c": "마치야", "se-shop-rice": "쌀가게", "se-shop-sake": "술도가", "se-shop-cloth": "포목점",
  "se-chaya": "찻집", "se-chaya-thatch": "초가 찻집", "se-ryokan": "여관", "se-onsen": "온천", "se-smithy": "대장간", "se-dojo": "도장", "se-samurai-house": "무가 저택",
  "se-castle-keep": "천수각", "se-shrine": "신사 본전", "se-temple-hall": "절 본당", "se-minka": "농가", "se-minka-small": "작은 농가", "se-kura": "곳간", "se-chashitsu": "다실",
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

/** 칸 쓰임. 바닥 재질과 놓기 규칙을 같이 정한다. */
type Use = "grass" | "road" | "stone" | "gravel" | "moss" | "yard" | "water" | "paddy" | "field" | "bridge" | "bld" | "prop" | "wall";
const DIRT: readonly Use[] = ["road", "yard"];
const WALKWAY: readonly Use[] = ["road", "stone", "yard", "bridge"];
interface Rect { x: number; y: number; w: number; h: number }

const k = (id: string): string => (id.startsWith("se-") ? id : `se-${id}`);

class Board {
  readonly lower: number[];
  readonly upper: number[];
  readonly use: Use[];
  readonly reserved: boolean[];
  readonly buildings: SengokuBuilding[] = [];
  readonly props: { kit: string; x: number; y: number }[] = [];
  readonly notes: string[] = [];
  constructor(readonly W: number, readonly H: number, readonly pal: SengokuPalette, readonly rng: () => number) {
    const g = this.t("grass");
    this.lower = new Array(W * H).fill(g);
    this.upper = new Array(W * H).fill(-1);
    this.use = new Array(W * H).fill("grass");
    this.reserved = new Array(W * H).fill(false);
  }
  in(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
  u(x: number, y: number): Use | null { return this.in(x, y) ? this.use[y * this.W + x]! : null; }
  t(piece: string): number {
    const id = this.pal.tile(piece);
    if (id < 0) throw new Error(`전국·에도 칩셋에 바닥 조각 ${piece} 이 없다`);
    return id;
  }
  /** 바닥 칠하기. 건물·소품·담 칸은 건드리지 않는다. */
  fill(piece: string, r: Rect, use: Use): void {
    const id = this.t(piece);
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      if (!this.in(x, y)) continue;
      const i = y * this.W + x;
      if (this.use[i] === "bld" || this.use[i] === "prop" || this.use[i] === "wall" || this.use[i] === "bridge") continue;
      this.lower[i] = id; this.use[i] = use;
    }
  }
  free(r: Rect, margin: number, allow: readonly Use[] = ["grass"]): boolean {
    for (let y = r.y - margin; y < r.y + r.h + margin; y++) for (let x = r.x - margin; x < r.x + r.w + margin; x++) {
      const inside = x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
      if (!this.in(x, y)) { if (inside) return false; continue; }
      const i = y * this.W + x;
      if (inside) { if (!allow.includes(this.use[i]!) || this.reserved[i]) return false; }
      else if (this.use[i] === "bld" || this.use[i] === "prop" || this.use[i] === "wall" || this.reserved[i]) return false;
    }
    return true;
  }
  reserve(r: Rect): void {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (this.in(x, y)) this.reserved[y * this.W + x] = true;
  }
  size(id: string): { w: number; h: number } {
    const kit = this.pal.kit(k(id));
    if (!kit) throw new Error(`전국·에도 칩셋에 키트 ${k(id)} 가 없다`);
    return { w: kit.width, h: kit.height };
  }
  has(id: string): boolean { return !!this.pal.kit(k(id)); }
  stamp(id: string, x: number, y: number, use: Use): SengokuKit {
    const kit = this.pal.kit(k(id));
    if (!kit) throw new Error(`전국·에도 칩셋에 키트 ${k(id)} 가 없다`);
    kit.rows.forEach((row, r) => {
      for (let c = 0; c < kit.width; c++) {
        const X = x + c, Y = y + r;
        if (!this.in(X, Y)) continue;
        const i = Y * this.W + X, lo = row.tiles[c] ?? -1, up = row.upperTiles?.[c] ?? -1;
        if (lo < 0 && up < 0) continue;
        if (lo >= 0) this.lower[i] = lo;
        if (up >= 0) this.upper[i] = up;
        this.use[i] = use;
      }
    });
    return kit;
  }
  /** 소품 하나: 발자국(+여백)이 맞는 바닥이고 비었을 때만. */
  prop(id: string, x: number, y: number, margin = 1, allow: readonly Use[] = ["grass"]): boolean {
    if (!this.has(id)) return false;
    const s = this.size(id);
    if (!this.free({ x, y, w: s.w, h: s.h }, margin, allow)) return false;
    this.stamp(id, x, y, "prop"); this.props.push({ kit: k(id), x, y });
    this.reserve({ x, y, w: s.w, h: s.h });
    return true;
  }
  /** 다리처럼 물 위에 얹는 키트(쓰임 bridge — 밑 물 칸은 그대로). */
  overlay(id: string, x: number, y: number, use: Use): boolean {
    if (!this.has(id)) return false;
    this.stamp(id, x, y, use); this.props.push({ kit: k(id), x, y });
    return true;
  }
  /** 건물: 발자국 전체를 예약하고, 문 바로 아래 접근칸과 그 아래 한 칸을 비운다. */
  building(id: string, x: number, y: number): SengokuBuilding {
    const kit = this.stamp(id, x, y, "bld");
    this.reserve({ x, y, w: kit.width, h: kit.height });
    for (let yy = y; yy < y + kit.height; yy++) for (let xx = x; xx < x + kit.width; xx++) if (this.in(xx, yy)) { const i = yy * this.W + xx; if (this.use[i] === "grass") this.use[i] = "bld"; }
    const d = kit.door;
    const doors = d ? Array.from({ length: d.w }, (_, i) => ({ x: x + d.dx + i, y: y + kit.height - 1 })) : [];
    const access = doors.map((c) => ({ x: c.x, y: c.y + 1 }));
    for (const a of access) this.reserve({ x: a.x, y: a.y, w: 1, h: 2 });
    const b = { name: NAME[k(id)] ?? k(id), kit: k(id), rect: { x, y, w: kit.width, h: kit.height }, doors, access };
    if (doors.length) this.buildings.push(b);
    return b;
  }
  /** 접근칸에서 걷는 길망(road·stone·yard·bridge)까지 아래로 → 옆으로 곧은 길. */
  connect(b: SengokuBuilding, piece: string, use: Use): void {
    if (!b.access.length) return;
    const isNet = (x: number, y: number) => { const u = this.u(x, y); return u !== null && WALKWAY.includes(u); };
    const a0 = b.access[0]!, w = b.access.length;
    if (b.access.every((a) => isNet(a.x, a.y))) return;
    let y = a0.y;
    for (let guard = 0; guard < this.H; guard++) {
      this.fill(piece, { x: a0.x, y, w, h: 1 }, use);
      if (b.access.some((a) => isNet(a.x, y + 1))) return;
      for (let dist = 1; dist <= 16; dist++) {
        for (const dir of [-1, 1]) {
          const x = dir < 0 ? a0.x - dist : a0.x + w - 1 + dist;
          if (!isNet(x, y)) continue;
          const x0 = Math.min(x, a0.x), x1 = Math.max(x, a0.x + w - 1);
          let blocked = false;
          for (let i = x0; i <= x1; i++) { const u = this.u(i, y); if (u === "bld" || u === "prop" || u === "wall" || u === "water" || u === "paddy") blocked = true; }
          if (!blocked) { this.fill(piece, { x: x0, y, w: x1 - x0 + 1, h: 1 }, use); return; }
        }
      }
      const below = this.u(a0.x, y + 1);
      if (below === null || below === "bld" || below === "wall" || below === "water" || below === "paddy") { this.notes.push(`${b.name} 문 길을 잇지 못했다`); return; }
      y++;
    }
  }
  /** 물 사각형(해자·강·연못). 가장자리는 마감 단계(edges)가 축대로 바꾼다. */
  water(r: Rect): void { this.fill("water", r, "water"); }
  /** 논 한 배미: 둘레는 논두렁 칸, 안쪽은 물논. */
  paddy(r: Rect, inner: string): boolean {
    if (!this.free(r, 0, ["grass"])) return false;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      const n = y === r.y, s = y === r.y + r.h - 1, w = x === r.x, e = x === r.x + r.w - 1;
      const nm = n && w ? "paddy-nw" : n && e ? "paddy-ne" : s && w ? "paddy-sw" : s && e ? "paddy-se" : n ? "paddy-n" : s ? "paddy-s" : w ? "paddy-w" : e ? "paddy-e" : inner;
      this.fill(this.pal.tile(nm) >= 0 ? nm : inner, { x, y, w: 1, h: 1 }, "paddy");
    }
    return true;
  }
  /** 나무 덩이: 빈 풀밭 6×6 에 나무 하나 + 덤불·바위. */
  groves(max: number, trees: readonly string[], bushes: readonly string[]): number {
    let n = 0;
    for (let tries = 0; tries < 500 && n < max; tries++) {
      const x = 1 + Math.floor(this.rng() * (this.W - 7)), y = 1 + Math.floor(this.rng() * (this.H - 7));
      if (!this.free({ x, y, w: 6, h: 6 }, 0)) continue;
      if (!this.prop(pick(this.rng, trees), x + 1 + Math.floor(this.rng() * 2), y + 1, 0)) continue;
      n++;
      if (this.rng() < 0.7) this.prop(pick(this.rng, bushes), x + 4, y + 4, 0);
      if (this.rng() < 0.4) this.prop(pick(this.rng, bushes), x, y + 4, 0);
    }
    return n;
  }
  /** 마감: 풀밭↔흙길 가장자리, 물가 축대, 바닥 변주. */
  finish(seed: number): void {
    const { W, H } = this;
    const dirt = (x: number, y: number) => { const u = this.u(x, y); return u !== null && DIRT.includes(u); };
    const wet = (x: number, y: number) => { const u = this.u(x, y); return u === null || u === "water" || u === "bridge"; };
    const grass = this.t("grass");
    const gB = this.pal.tile("grass-b"), gF = this.pal.tile("grass-flower");
    const rB = this.pal.tile("road-b"), rC = this.pal.tile("road-c"), road = this.t("road");
    const cob = this.pal.tile("cobble"), cobM = this.pal.tile("cobble-moss");
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, u = this.use[i];
      if (u === "water" && this.lower[i] === this.t("water")) {
        const n = !wet(x, y - 1), s = !wet(x, y + 1), w = !wet(x - 1, y), e = !wet(x + 1, y);
        const nm = n && w ? "water-nw" : n && e ? "water-ne" : s && w ? "water-sw" : s && e ? "water-se" : n ? "water-n" : s ? "water-s" : w ? "water-w" : e ? "water-e" : null;
        if (nm && this.pal.tile(nm) >= 0) this.lower[i] = this.pal.tile(nm);
      } else if (u === "grass" && this.lower[i] === grass) {
        const n = dirt(x, y - 1), s = dirt(x, y + 1), w = dirt(x - 1, y), e = dirt(x + 1, y);
        const nm = n && w ? "grass-edge-nw" : n && e ? "grass-edge-ne" : s && w ? "grass-edge-sw" : s && e ? "grass-edge-se" : n ? "grass-edge-n" : s ? "grass-edge-s" : w ? "grass-edge-w" : e ? "grass-edge-e" : null;
        if (nm && this.pal.tile(nm) >= 0) { this.lower[i] = this.pal.tile(nm); continue; }
        const v = vnoise(x + 900, y + 900, 7, seed) * 0.8 + vnoise(x + 900, y + 900, 3, seed + 5) * 0.2;
        const f = vnoise(x + 300, y + 300, 6, seed + 11);
        if (gB >= 0 && v > 0.62) this.lower[i] = gB;
        else if (gF >= 0 && f < 0.15 && hash2(x, y, seed + 3) < 0.4) this.lower[i] = gF;
      } else if (u === "road" && this.lower[i] === road) {
        const v = vnoise(x + 50, y + 50, 5, seed + 17);
        if (rB >= 0 && v > 0.6) this.lower[i] = rB;
        else if (rC >= 0 && v < 0.2 && hash2(x, y, seed + 9) < 0.5) this.lower[i] = rC;
      } else if (u === "stone" && this.lower[i] === cob && cobM >= 0) {
        if (vnoise(x + 70, y + 70, 4, seed + 23) > 0.7) this.lower[i] = cobM;
      }
    }
  }
}

// ───────────────────────── 공통 조각 ─────────────────────────
/** 남향 집 줄: 밑변 baseY(문 줄), 접근칸 baseY+1 은 길. skip 에 걸리는 x 는 비운다. 집 사이 1칸 틈에는 대울타리·덤불. */
function houseRow(b: Board, x0: number, x1: number, baseY: number, kinds: readonly string[], skip: readonly [number, number][] = [], maxH = 6): SengokuBuilding[] {
  const out: SengokuBuilding[] = [];
  let x = x0;
  const blocked = (a: number, w: number) => skip.some(([s0, s1]) => a <= s1 && a + w - 1 >= s0);
  let guard = 0;
  while (x < x1 && guard++ < 80) {
    const choices = kinds.filter((id) => b.has(id) && b.size(id).h <= maxH && x + b.size(id).w - 1 <= x1);
    if (!choices.length) break;
    const id = pick(b.rng, choices); const s = b.size(id);
    if (blocked(x, s.w)) { x++; continue; }
    if (!b.free({ x, y: baseY - s.h + 1, w: s.w, h: s.h }, 0, ["grass", "yard"])) { x++; continue; }
    out.push(b.building(id, x, baseY - s.h + 1));
    x += s.w;
    // 틈 1칸: 대울타리(2줄) 또는 빈 골목(덤불)
    if (x <= x1 && !blocked(x, 1)) {
      if (b.rng() < 0.55) b.prop("fence-bamboo", x, baseY - 1, 0, ["grass", "yard"]);
      else b.prop(pick(b.rng, ["azalea", "rock-small", "bucket-stack"]), x, baseY, 0, ["grass", "yard"]);
    }
    x += 1;
  }
  return out;
}

/** 집 앞 길 가장자리 소품(접근칸·그 양옆은 비운다): 찻집 앞 걸상, 술도가 앞 술통, 가게 앞 노점, 집 사이 길등. */
function shopFronts(b: Board, bl: readonly SengokuBuilding[], frontY: number): void {
  for (const d of bl) {
    const ax = d.access.map((a) => a.x);
    const left = d.rect.x, right = d.rect.x + d.rect.w - 1;
    const spots = (w: number) => {
      const xs: number[] = [];
      for (let x = left; x + w - 1 <= right; x++) if (ax.every((a) => a < x - 1 || a > x + w)) xs.push(x);
      return xs;
    };
    const put = (id: string) => { if (!b.has(id)) return; const w = b.size(id).w; for (const x of spots(w)) if (b.prop(id, x, frontY, 0, ["road"])) return; };
    if (/chaya/.test(d.kit)) put("bench-red");
    else if (/sake/.test(d.kit)) put("sake-barrels");
    else if (/rice/.test(d.kit)) put("rice-bales");
    else if (/ryokan/.test(d.kit)) put("palanquin");
    else if (/smithy/.test(d.kit)) put("firewood");
    else if (/cloth|machiya/.test(d.kit) && b.rng() < 0.4) put("pots");
  }
}

/** 길등을 길 윗줄을 따라 every 칸마다(집 문 앞 피해서). */
function lanternsAlong(b: Board, x0: number, x1: number, y: number, every: number, allow: readonly Use[] = ["road", "grass"]): void {
  for (let x = x0; x <= x1; x += every) for (const dx of [0, 1, -1, 2]) if (b.prop("street-lantern", x + dx, y - 1, 0, allow)) break;
}

/** 성 덩이: 천수각 + 앞마당 + 성벽(돌 기단·흰 벽) + 망루 + 성문 + 해자(서·동·남) + 다리. 돌려주는 값: 다리 아래 첫 줄 y, 다리 칸 x. */
function castleBlock(b: Board, cx: number, y0: number): { below: number; bridgeX: number; x0: number; x1: number } {
  const ks = b.size("castle-keep"), gs = b.size("castle-gate");
  const kx = cx - 4, ky = y0 + ks.h - 1;                       // 천수각 밑변
  const wb = ky + 7;                                           // 성벽 밑변
  const x0 = cx - 12, x1 = cx + 13;                            // 성벽 서·동 끝 칸
  // 해자(서·동 3칸, 남 5칸)
  b.water({ x: x0 - 3, y: y0, w: 3, h: wb + 6 - y0 });
  b.water({ x: x1 + 1, y: y0, w: 3, h: wb + 6 - y0 });
  b.water({ x: x0 - 3, y: wb + 1, w: x1 - x0 + 7, h: 5 });
  // 성 안: 풀밭 + 돌길(천수각 문 → 성문)
  const keep = b.building("castle-keep", kx, y0);
  const gx = cx - 2;                                           // 성문 통로 = gx+2, gx+3 = cx, cx+1
  b.fill("cobble", { x: cx, y: ky + 1, w: 2, h: wb - ky - 4 }, "stone");
  b.fill("cobble", { x: cx - 3, y: ky + 1, w: 8, h: 2 }, "stone");
  // 성벽 남쪽 줄(망루 · 담 · 성문 · 담 · 망루)
  const ts = b.has("castle-turret") ? b.size("castle-turret") : null;
  if (ts) { b.building("castle-turret", x0, wb - ts.h + 1); b.building("castle-turret", x1 - ts.w + 1, wb - ts.h + 1); }
  const tw = ts ? ts.w : 0;
  for (let x = x0 + tw; x <= x1 - tw; x++) { if (x >= gx && x < gx + gs.w) continue; b.stamp("castle-wall", x, wb - 2, "wall"); b.reserve({ x, y: wb - 2, w: 1, h: 3 }); }
  b.stamp("castle-gate", gx, wb - gs.h + 1, "wall");
  b.reserve({ x: gx, y: wb - gs.h + 1, w: gs.w, h: gs.h });
  for (let y = wb - gs.h + 1; y <= wb; y++) for (const x of [cx, cx + 1]) { const i = y * b.W + x; b.use[i] = "stone"; b.lower[i] = b.t("cobble"); }
  // 서·동 성벽(세로)
  const sideTop = y0 + 1, sideBot = wb - (ts ? ts.h : 3);
  for (let y = sideTop; y <= sideBot; y++) for (const x of [x0, x1]) { b.stamp("castle-wall-v", x, y, "wall"); b.reserve({ x, y, w: 1, h: 1 }); }
  // 해자 다리(성문 통로 아래)
  const bridge = b.has("bridge-plain") ? "bridge-plain" : "bridge-arch";
  b.overlay(bridge, cx - 1, wb + 1, "bridge");
  // 성 안 소나무·석등(천수각 양옆 마당)
  for (const [tx, ty] of [[x0 + 2, y0 + 2], [x0 + 2, y0 + 7], [x1 - 4, y0 + 2], [x1 - 4, y0 + 7]] as const) b.prop("tree-pine", tx, ty, 0);
  b.prop("lantern-stone", cx - 3, ky + 3, 0, ["grass", "stone"]);
  b.prop("lantern-stone", cx + 4, ky + 3, 0, ["grass", "stone"]);
  b.connect(keep, "cobble", "stone");
  return { below: wb + 6, bridgeX: cx, x0: x0 - 3, x1: x1 + 3 };
}

// ───────────────────────── 성하마을 ─────────────────────────
function composeCastleTown(b: Board): SengokuCell {
  const { W, H, rng } = b;
  const cx = Math.floor(W / 2) - 1 + Math.floor(rng() * 3) - 1;
  const c = castleBlock(b, cx, 1);
  const roadA = c.below;                                       // 성 앞 큰길(3줄)
  b.fill("road", { x: 0, y: roadA, w: W, h: 3 }, "road");
  // 큰길 남쪽: 집 줄 둘(문은 각자 아래 길로)
  const msx0 = cx - 1, msx1 = cx + 2;                          // 남북 대로(4칸)
  b.fill("road", { x: msx0, y: roadA, w: 4, h: H - roadA }, "road");
  const shops = ["machiya-a", "machiya-b", "machiya-c", "shop-rice", "shop-sake", "shop-cloth", "chaya", "smithy"];
  const rows: { base: number; road: number }[] = [];
  let y = roadA + 3 + 1;                                       // 뒤 풀밭 1줄
  while (y + 5 + 3 <= H) { const base = y + 4; rows.push({ base, road: base + 1 }); y = base + 4 + 1; }
  if (!rows.length) b.notes.push("집 줄을 놓을 높이가 없다");
  const skip: [number, number][] = [[msx0 - 1, msx1 + 1]];
  rows.forEach((r, ri) => {
    b.fill("road", { x: 0, y: r.road, w: W, h: Math.min(3, H - r.road) }, "road");
    const left = houseRow(b, 1, msx0 - 2, r.base, shops, skip, 5);
    const right = houseRow(b, msx1 + 2, W - 2, r.base, ri === 0 ? ["ryokan", ...shops] : shops, skip, ri === 0 ? 6 : 5);
    shopFronts(b, [...left, ...right], r.road);
    lanternsAlong(b, 3, W - 3, r.road + 1, 9, ["road"]);
  });
  // 시장 터: 큰길 남북 대로 교차점 옆 노점 몇
  const my = roadA + 1;
  for (const [id, dx] of [["stall-food", -7], ["stall-veg", 5], ["stall-fish", 8]] as const) b.prop(id, cx + dx, my - 1, 0, ["road", "grass"]);
  b.prop("notice-board", cx - 4, roadA - 0, 0, ["road", "grass"]) || b.prop("notice-board", cx + 4, roadA, 0, ["road"]);
  // 해자 바깥 둑: 버드나무·벚나무, 해자에 배
  for (const tx of [c.x0 - 4, c.x1 + 2]) for (let ty = 2; ty < roadA - 4; ty += 6) b.prop(pick(rng, ["tree-willow", "tree-cherry", "tree-pine"]), tx, ty, 0);
  b.prop("boat", c.x0 + 4, roadA - 3, 0, ["water"]);
  // 성 밖 빈 띠(서·동 해자 바깥)에 숲 덩이
  b.groves(Math.floor(W * H / 400), ["tree-pine", "tree-cherry", "tree-maple", "bamboo"], ["azalea", "rock-small", "hedge"]);
  return { x: cx, y: H - 1 };
}

// ───────────────────────── 여관 거리(역참) ─────────────────────────
function composeInnStreet(b: Board): SengokuCell {
  const { W, H, rng } = b;
  const base = 9;                                              // 북쪽 집 줄 밑변
  const road = base + 1;                                       // 가도(4줄)
  b.fill("road", { x: 0, y: road, w: W, h: 4 }, "road");
  const laneX = Math.floor(W * (0.55 + rng() * 0.2));          // 남쪽 샛길(2칸)
  const kinds = ["ryokan", "ryokan", "chaya", "chaya-thatch", "machiya-a", "machiya-c", "shop-sake", "shop-rice", "onsen"];
  const houses = houseRow(b, 1, W - 2, base, kinds, [], 6);
  shopFronts(b, houses, road);
  lanternsAlong(b, 4, W - 4, road + 1, 7, ["road"]);
  // 집 뒤(북쪽) 띠: 대숲·곳간
  for (let x = 1; x < W - 3; x += 5 + Math.floor(rng() * 3)) b.prop(pick(rng, ["bamboo", "tree-pine-small", "bamboo"]), x, 0, 0);
  // 가도 남쪽: 삼나무 가로수(샛길 자리 비움)
  const cedarFoot = road + 4 + 4;
  for (let x = 1; x < W - 2; x += 3 + Math.floor(rng() * 2)) {
    if (x + 1 >= laneX - 1 && x <= laneX + 2) continue;
    b.prop("tree-cedar", x, cedarFoot - 3, 0);
  }
  // 고찰(고사쓰)·지장보살: 샛길 입구
  b.prop("notice-board", laneX - 3, road + 4, 0);
  b.prop("jizo", laneX + 3, road + 5, 0);
  // 강(5줄) + 아치 다리
  const ry = cedarFoot + 3;
  if (ry + 5 < H - 4) {
    b.water({ x: 0, y: ry, w: W, h: 5 });
    b.fill("road", { x: laneX, y: road + 4, w: 2, h: ry - road - 4 }, "road");
    b.overlay("bridge-arch", laneX - 1, ry, "bridge");
    b.fill("road", { x: laneX, y: ry + 5, w: 2, h: H - ry - 5 }, "road");
    b.prop("boat-cargo", 3 + Math.floor(rng() * 6), ry + 1, 0, ["water"]);
    b.prop("boat", W - 9, ry + 3, 0, ["water"]);
    // 강 남쪽: 논·농가
    const sy = ry + 6;
    const fh = H - sy - 1;
    if (fh >= 5) {
      const mk = b.building("minka", laneX + 4, sy);
      b.fill("road-b", { x: mk.rect.x - 1, y: sy + mk.rect.h, w: mk.rect.w + 2, h: 1 }, "yard");
      b.connect(mk, "road", "road");
      if (!mk.access.length || !b.u(mk.access[0]!.x, mk.access[0]!.y)) b.notes.push("농가 문 길 확인 필요");
      // 샛길 서쪽 논
      for (let x = 1; x + 6 <= laneX - 1; x += 7) b.paddy({ x, y: sy, w: 6, h: Math.min(5, fh) }, pick(rng, ["paddy", "paddy-grown"]));
      for (let x = mk.rect.x + mk.rect.w + 2; x + 6 <= W - 1; x += 7) b.paddy({ x, y: sy, w: 6, h: Math.min(5, fh) }, pick(rng, ["paddy", "paddy-grown"]));
      b.prop("rice-rack", laneX + 2 - 0, H - 2, 0);
    }
  } else b.notes.push("강을 놓을 높이가 없다");
  // 가도 양 끝: 짐수레·초롱
  b.prop("cart", 2, road + 4, 0, ["grass"]);
  b.groves(Math.floor(W * H / 500), ["tree-pine", "tree-maple", "tree-cherry"], ["azalea", "rock-small"]);
  return { x: 0, y: road + 2 };
}

// ───────────────────────── 무가 저택 거리 ─────────────────────────
function compound(b: Board, x0: number, x1: number, top: number, wallY: number, withTea: boolean, main: string): void {
  const { rng } = b;
  const gs = b.size("samurai-gate");
  const hs = b.size(main);
  const hx = x0 + 1 + Math.floor(rng() * Math.max(1, x1 - x0 - hs.w - 1));
  const hy = top + 1;
  const house = b.building(main, Math.min(hx, x1 - hs.w), hy);
  // 대문: 담 줄 가운데쯤, 통로 2칸(문루 가운데)
  const gx = Math.max(x0 + 1, Math.min(x1 - gs.w, house.access[0] ? house.access[0].x - 1 : x0 + 2));
  b.stamp("samurai-gate", gx, wallY - gs.h + 1, "wall");
  b.reserve({ x: gx, y: wallY - gs.h + 1, w: gs.w, h: gs.h });
  for (let y = wallY - gs.h + 1; y <= wallY; y++) for (const x of [gx + 1, gx + 2]) { const i = y * b.W + x; b.use[i] = "stone"; b.lower[i] = b.t("cobble"); }
  // 앞담(대문 자리 빼고)
  for (let x = x0; x <= x1; x++) { if (x >= gx && x < gx + gs.w) continue; b.stamp("wall-plaster", x, wallY - 1, "wall"); b.reserve({ x, y: wallY - 1, w: 1, h: 2 }); }
  // 대문 → 저택 문: 돌길(2칸)
  const ax = house.access[0]!.x;
  const py0 = house.access[0]!.y, py1 = wallY - gs.h;
  b.fill("cobble", { x: gx + 1, y: Math.min(py0, py1), w: 2, h: Math.abs(py1 - py0) + 1 }, "stone");
  const xa = Math.min(ax, gx + 1), xb = Math.max(ax + house.access.length - 1, gx + 2);
  b.fill("cobble", { x: xa, y: py0, w: xb - xa + 1, h: 1 }, "stone");
  // 정원: 마른 산수(자갈 사각형 + 바위·이끼) · 연못 · 소나무 · 석등 · 쓰쿠바이 · 곳간
  const gy0 = hy + hs.h + 2, gy1 = wallY - gs.h - 1;
  const gardenLeft = gx - x0 > x1 - gx - gs.w;
  const zx0 = gardenLeft ? x0 + 1 : gx + gs.w + 1, zx1 = gardenLeft ? gx - 2 : x1 - 1;
  if (zx1 - zx0 >= 5 && gy1 - gy0 >= 4) {
    b.fill("gravel", { x: zx0, y: gy0, w: zx1 - zx0 + 1, h: gy1 - gy0 + 1 }, "gravel");
    b.fill("gravel-wave", { x: zx0 + 1, y: gy0 + 1, w: zx1 - zx0 - 1, h: 1 }, "gravel");
    b.prop("rock-big", zx0 + 1, gy0 + 2, 0, ["gravel"]);
    b.prop("rock-small", zx1 - 1, gy1 - 1, 0, ["gravel"]);
    b.prop("tree-pine-small", zx1 - 2, gy0 + 1, 0, ["gravel"]);
    b.prop("lantern-snow", zx0 + 4, gy1 - 1, 0, ["gravel"]);
  }
  // 다실: 반대쪽 정원 구석, 디딤돌로 저택 길과 잇는다
  const ox0 = gardenLeft ? gx + gs.w + 1 : x0 + 1, ox1 = gardenLeft ? x1 - 1 : gx - 2;
  if (withTea && b.has("chashitsu") && ox1 - ox0 >= 4) {
    const cs = b.size("chashitsu");
    const cxp = gardenLeft ? ox1 - cs.w : ox0;
    const cyp = gy0;
    if (b.free({ x: cxp, y: cyp, w: cs.w, h: cs.h + 1 }, 0, ["grass"])) {
      const tea = b.building("chashitsu", cxp, cyp);
      b.fill("moss", { x: Math.min(ox0, cxp - 1), y: cyp + cs.h, w: Math.min(ox1, cxp + cs.w) - Math.min(ox0, cxp - 1) + 1, h: Math.max(1, gy1 - cyp - cs.h) }, "moss");
      // 디딤돌: 다실 접근칸 → 돌길
      const a = tea.access[0]!;
      const stoneX = gx + 1;
      const yLink = Math.min(gy1, a.y + 1);
      for (let yy = a.y; yy <= yLink; yy++) b.fill("stepping-stones" in {} ? "moss" : "moss", { x: a.x, y: yy, w: 1, h: 1 }, "moss");
      for (let xx = Math.min(a.x, stoneX); xx <= Math.max(a.x, stoneX); xx++) b.fill("moss", { x: xx, y: yLink, w: 1, h: 1 }, "moss");
      for (let yy = a.y; yy <= yLink; yy++) b.prop("stepping-stones", a.x, yy, 0, ["moss"]);
      for (let xx = Math.min(a.x, stoneX) + 1; xx < Math.max(a.x, stoneX); xx++) b.prop("stepping-stones", xx, yLink, 0, ["moss"]);
      b.prop("tsukubai", a.x + (gardenLeft ? -2 : 2), a.y + 1, 0, ["moss", "grass"]);
      b.prop("tree-maple", gardenLeft ? cxp - 3 : cxp + cs.w, cyp, 0, ["grass", "moss"]);
    }
  } else if (ox1 - ox0 >= 4) {
    b.prop("kura", ox0 + 1, gy0, 0, ["grass"]);
    b.prop("well", ox1 - 2, gy0 + 1, 0, ["grass"]);
  }
  // 저택 양옆 소나무·곳간
  b.prop("tree-pine", x0 + 1, hy + hs.h - 2 >= top ? top + 1 : top, 0) || b.prop("tree-pine-small", x0 + 1, top + 1, 0);
  b.prop("kura", x1 - 3, top + 1, 0);
}

function composeSamurai(b: Board): SengokuCell {
  const { W, H, rng } = b;
  const road = H - 4;
  b.fill("road", { x: 0, y: road, w: W, h: 4 }, "road");
  const wallY = road - 1;
  // 북쪽 담(1·2줄), 그 위 소나무 끝
  for (let x = 0; x < W; x++) { b.stamp("wall-plaster", x, 1, "wall"); b.reserve({ x, y: 1, w: 1, h: 2 }); }
  const n = Math.max(2, Math.floor((W - 1) / 24));
  const cw = Math.floor((W - 1) / n);
  for (let i = 0; i < n; i++) {
    const x0 = i * cw + (i === 0 ? 0 : 1), x1 = i === n - 1 ? W - 1 : (i + 1) * cw - 1;
    if (i < n - 1) for (let y = 3; y <= wallY - 2; y++) { b.stamp("wall-plaster-v", x1 + 1, y, "wall"); b.reserve({ x: x1 + 1, y, w: 1, h: 1 }); }
    const main = i === 1 && b.has("dojo") ? "dojo" : "samurai-house";
    compound(b, x0 + (i === 0 ? 1 : 0), x1 - (i === n - 1 ? 1 : 0), 3, wallY, i !== 1 || n === 2, main);
  }
  // 바깥 길: 담 밑 도랑 대신 소나무 그림자 — 길등 드문드문
  lanternsAlong(b, 6, W - 6, road + 1, 12, ["road"]);
  b.prop("palanquin", Math.floor(W / 2) + Math.floor(rng() * 6), road + 2, 0, ["road"]);
  for (let x = 2; x < W - 3; x += 6 + Math.floor(rng() * 4)) b.prop(pick(rng, ["tree-pine-small", "bamboo"]), x, 0, 0, ["grass"]);
  return { x: 0, y: road + 2 };
}

// ───────────────────────── 성 ─────────────────────────
function composeCastle(b: Board): SengokuCell {
  const { W, H, rng } = b;
  const cx = Math.floor(W / 2) - 1;
  const c = castleBlock(b, cx, 1);
  // 해자 앞 광장(돌길) → 남쪽 길
  const roadY = H - 3;
  b.fill("road", { x: 0, y: roadY, w: W, h: 3 }, "road");
  b.fill("cobble", { x: cx - 1, y: c.below, w: 4, h: roadY - c.below }, "stone");
  // 광장 옆 벚나무 줄·석등
  for (let x = 2; x < W - 3; x += 5 + Math.floor(rng() * 2)) {
    if (x + 2 >= cx - 2 && x <= cx + 3) continue;
    b.prop(pick(rng, ["tree-cherry", "tree-pine"]), x, c.below + 1, 0);
  }
  for (let y = c.below + 1; y < roadY - 1; y += 3) { b.prop("lantern-stone", cx - 3, y, 0); b.prop("lantern-stone", cx + 4, y, 0); }
  b.prop("notice-board", cx + 6, roadY - 2, 0);
  b.groves(Math.floor(W * H / 450), ["tree-pine", "tree-cedar", "tree-maple"], ["azalea", "rock-small"]);
  return { x: cx, y: H - 1 };
}

// ───────────────────────── 신사·절 ─────────────────────────
function composeTemple(b: Board): SengokuCell {
  const { W, H, rng } = b;
  const roadY = H - 3;
  b.fill("road", { x: 0, y: roadY, w: W, h: 3 }, "road");
  const split = Math.floor(W * 0.42);
  // ── 신사(서쪽) ──
  const ss = b.size("shrine");
  const sx = Math.floor(split / 2) - 3, sy = 4;
  const shrine = b.building("shrine", sx, sy);
  const ax = shrine.access[0]!.x;                              // 참배길 2칸 = ax, ax+1
  const ts = b.size("torii");
  const tY = roadY - ts.h;
  b.fill("cobble", { x: ax, y: sy + ss.h, w: 2, h: roadY - sy - ss.h }, "stone");
  b.fill("cobble", { x: ax - 2, y: sy + ss.h, w: 6, h: 2 }, "stone");
  b.stamp("torii", ax - 1, tY, "wall");
  b.reserve({ x: ax - 1, y: tY, w: ts.w, h: ts.h });
  for (let y = tY; y < tY + ts.h; y++) for (const x of [ax, ax + 1]) { const i = y * b.W + x; b.use[i] = "stone"; }
  // 고마이누 한 쌍(본전 앞마당 끝), 석등 줄, 손 씻는 곳, 에마 걸이, 작은 사당
  b.prop("komainu", ax - 2, sy + ss.h + 2, 0, ["grass"]);
  b.prop("komainu-l", ax + 3, sy + ss.h + 2, 0, ["grass"]);
  for (let y = sy + ss.h + 5; y < tY - 1; y += 4) { b.prop("lantern-stone", ax - 2, y, 0); b.prop("lantern-stone", ax + 3, y, 0); }
  b.prop("chozuya", ax - 6, sy + ss.h + 3, 0);
  b.prop("ema-rack", ax + 5, sy + ss.h, 0);
  b.prop("hokora", sx + ss.w + 2, sy + 1, 0);
  b.prop("offering-box", ax + 5, sy + ss.h + 4, 0);
  // 신목(삼나무) · 숲
  b.prop("tree-cedar", sx - 3, sy, 0);
  b.prop("tree-cedar", sx + ss.w + 4, sy + 3, 0);
  // ── 절(동쪽) ──
  const hs = b.size("temple-hall"), gs = b.size("temple-gate");
  const hx = split + Math.floor((W - split - hs.w) / 2), hy = 3;
  const hall = b.building("temple-hall", hx, hy);
  const tx = hall.access[0]!.x;                                // 참배길 tx-? : 문루 통로 gx+2,gx+3
  const gx = tx - 2;
  b.fill("cobble", { x: tx, y: hy + hs.h, w: 2, h: roadY - hy - hs.h }, "stone");
  b.stamp("temple-gate", gx, roadY - gs.h, "wall");
  b.reserve({ x: gx, y: roadY - gs.h, w: gs.w, h: gs.h });
  for (let y = roadY - gs.h; y < roadY; y++) for (const x of [tx, tx + 1]) { const i = y * b.W + x; b.use[i] = "stone"; b.lower[i] = b.t("cobble"); }
  b.prop("incense", tx + 3, hy + hs.h + 1, 0);
  b.prop("pagoda", hx + hs.w + 2, hy - 1 >= 0 ? hy - 1 : 0, 0) || b.prop("pagoda", W - 6, 1, 0);
  b.prop("bell-tower", hx - 6, hy + 2, 0);
  // 마른 산수 정원(참배길 서쪽, 문루 위)
  const gy0 = hy + hs.h + 3, gy1 = roadY - gs.h - 2;
  if (gy1 - gy0 >= 3) {
    const zx0 = split + 2, zx1 = tx - 3;
    if (zx1 - zx0 >= 4) {
      b.fill("gravel", { x: zx0, y: gy0, w: zx1 - zx0 + 1, h: gy1 - gy0 + 1 }, "gravel");
      b.fill("gravel-wave", { x: zx0, y: gy0 + 1, w: zx1 - zx0 + 1, h: 1 }, "gravel");
      b.prop("rock-big", zx0 + 1, gy0 + 2, 0, ["gravel"]);
      b.prop("rock-small", zx1 - 1, gy0, 0, ["gravel"]);
    }
    b.prop("tree-maple", tx + 4, gy0, 0);
    b.prop("jizo", tx + 3, gy1, 0);
    b.prop("jizo", tx + 5, gy1, 0);
  }
  // 경계: 두 경내 사이 대숲
  for (let y = 2; y < roadY - 4; y += 4) b.prop("bamboo", split - 1, y, 0);
  b.groves(Math.floor(W * H / 380), ["tree-cedar", "tree-maple", "tree-pine", "tree-cherry"], ["azalea", "rock-small", "hedge"]);
  return { x: ax, y: H - 1 };
}

// ───────────────────────── 농촌 ─────────────────────────
function composeVillage(b: Board): SengokuCell {
  const { W, H, rng } = b;
  const lx = Math.floor(W * (0.35 + rng() * 0.25));            // 남북 길(2칸 = lx, lx+1)
  const roadY = 12;                                            // 동서 마을길(2줄)
  const ry = Math.max(roadY + 12, H - 13);                     // 강(5줄)
  b.fill("road", { x: 0, y: roadY, w: W, h: 2 }, "road");
  b.fill("road", { x: lx, y: 0, w: 2, h: ry }, "road");
  b.water({ x: 0, y: ry, w: W, h: 5 });
  b.overlay("bridge-arch", lx - 1, ry, "bridge");
  b.fill("road", { x: lx, y: ry + 5, w: 2, h: H - ry - 5 }, "road");
  // 마을길 북쪽: 농가 줄(마당 흙 + 우물·장작·볏짚)
  const base = roadY - 1;
  const houses = houseRow(b, 1, W - 2, base, ["minka", "minka-small", "minka", "kura", "barn"], [[lx - 1, lx + 2]], 5);
  for (const h of houses) {
    const yx = h.rect.x, yw = h.rect.w;
    if (b.rng() < 0.6) b.prop(pick(rng, ["firewood", "pots", "haystack"]), yx + (b.rng() < 0.5 ? 0 : yw - 2), h.rect.y - 2 >= 0 ? h.rect.y + h.rect.h - 1 + 0 : 0, 0, ["grass"]);
  }
  // 우물 하나(길가 풀밭)
  b.prop("well", lx + 3, roadY + 2, 0) || b.prop("well", lx - 4, roadY + 2, 0);
  // 집 뒤 대숲·밭
  for (let x = 1; x < W - 3; x += 4 + Math.floor(rng() * 3)) b.prop(pick(rng, ["bamboo", "tree-pine-small", "bamboo", "tree-cedar"]), x, 0, 0);
  // 마을길 ~ 강 사이: 논(논두렁 길 1칸) + 채소밭
  const py0 = roadY + 3, py1 = ry - 2;
  for (const [x0, x1] of [[1, lx - 2], [lx + 3, W - 2]] as const) {
    let y = py0;
    while (y + 4 <= py1) {
      const h = Math.min(5, py1 - y + 1);
      let x = x0;
      while (x + 5 <= x1) {
        const w = Math.min(7, x1 - x + 1);
        if (b.rng() < 0.18) { b.fill(pick(rng, ["field", "field-bare"]), { x, y, w: Math.min(4, w), h: Math.min(3, h) }, "field"); }
        else b.paddy({ x, y, w, h }, pick(rng, ["paddy", "paddy-grown", "paddy-ripe"]));
        x += w + 1;
      }
      y += h + 1;
    }
  }
  // 논두렁 사이 볏덕·허수아비 대신 볏짚
  for (let i = 0; i < 4; i++) b.prop(pick(rng, ["rice-rack", "haystack"]), 1 + Math.floor(rng() * (W - 5)), py0 + Math.floor(rng() * Math.max(1, py1 - py0)), 0);
  // 강가: 물레방아(북쪽 둑), 버드나무, 배, 지장보살
  b.prop("water-wheel", lx + 5, ry - 2, 0, ["grass", "water"]);
  b.prop("tree-willow", lx - 6, ry - 3, 0);
  b.prop("boat", W - 8, ry + 2, 0, ["water"]);
  b.prop("jizo", lx + 3, ry + 6, 0);
  // 강 남쪽: 작은 농가 + 논
  const sy = ry + 6;
  if (H - sy >= 5) {
    const mk = b.building("minka-small", lx + 5, sy);
    b.connect(mk, "road-b", "yard");
    for (let x = 1; x + 6 <= lx - 1; x += 7) b.paddy({ x, y: sy, w: 6, h: Math.min(4, H - sy - 1) }, pick(rng, ["paddy-grown", "paddy-ripe"]));
    b.prop("cart", lx + 11, sy + 1, 0);
  }
  b.groves(Math.floor(W * H / 600), ["tree-pine", "tree-cherry", "tree-maple"], ["azalea", "rock-small"]);
  return { x: lx, y: H - 1 };
}

/** 한 장을 짠다. 칸이 모자라면 Error(호출자가 ToolError 로 바꾼다). */
export function composeSengokuEdo(spec: SengokuSpec, pal: SengokuPalette): SengokuResult {
  const min = SENGOKU_MIN_SIZE[spec.style];
  if (!min) throw new Error(`모르는 style ${spec.style} — ${SENGOKU_STYLES.join("|")}`);
  if (spec.width < min.w || spec.height < min.h) throw new Error(`맵이 작다(${spec.width}×${spec.height}) — ${spec.style} 는 ${min.w}×${min.h} 이상이어야 한다`);
  const seed = (spec.seed ?? 0) >>> 0;
  const rng = mulberry(seed * 7919 + SENGOKU_STYLES.indexOf(spec.style) * 131 + 7);
  const b = new Board(spec.width, spec.height, pal, rng);
  const start = spec.style === "castle_town" ? composeCastleTown(b) : spec.style === "inn_street" ? composeInnStreet(b) : spec.style === "samurai" ? composeSamurai(b)
    : spec.style === "castle" ? composeCastle(b) : spec.style === "temple" ? composeTemple(b) : composeVillage(b);
  for (const d of b.buildings) b.connect(d, "road-b", "yard");
  b.finish(seed);
  return { lower: b.lower, upper: b.upper, buildings: b.buildings, start, props: b.props, notes: b.notes };
}

/** 번들 정의(TilesetDef 모양)에서 사전을 만든다: 한 칸 바닥은 그룹 `se:se-<조각>`, 키트는 structureKits(출입구 부품). */
export function sengokuPaletteFromTileset(def: {
  readonly tileGroups?: readonly { readonly id: string; readonly tileIds: readonly number[] }[];
  readonly structureKits?: readonly unknown[];
}): SengokuPalette {
  const groups = new Map((def.tileGroups ?? []).map((g) => [g.id, g.tileIds] as const));
  const kits = new Map<string, SengokuKit>();
  for (const raw of def.structureKits ?? []) {
    const q = raw as { id: string; width: number; height: number; rows: SengokuKit["rows"]; parts?: { kind: string; dx: number; w: number }[] };
    if (!q?.id || !Array.isArray(q.rows)) continue;
    const part = q.parts?.find((p) => p.kind === "entrance");
    kits.set(q.id, { id: q.id, width: q.width, height: q.height, rows: q.rows, door: part ? { dx: part.dx, w: part.w } : undefined });
  }
  return {
    tile: (piece) => groups.get(`se:se-${piece.replace(/^se-/, "")}`)?.[0] ?? -1,
    kit: (id) => kits.get(id),
  };
}
