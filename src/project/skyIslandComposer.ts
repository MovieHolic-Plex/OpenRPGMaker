// project/skyIslandComposer.ts
// 하늘섬(sky_island) 맵 구성기 — 용도(마을 village · 신전 shrine · 부두 dock · 섬 사슬 archipelago · 실내 방 넷)·씨앗·맵 크기만 주면 매번 다른 한 장을 짠다.
//
// 순서: 계획(섬 덩이·쓰임 구역) → 섬(풀 가장자리 13칸 + 남쪽 밑면 바위 기둥) → 땅(길·광장·밭·시내·폭포) → 건물(문 남향, 접근칸에서 길까지)
//       → 다리(밧줄·돌다리·잔교) → 소품(규칙·여백) → 빈 땅 쓰임(숲 덩이·쉼터) → 하늘 꾸밈(구름 덩이·뿌리·사슬) → 도달 검사(BFS).
// 조화 규칙(jp_city·캠퍼스 적대 검수 교훈, ~/claude-viz/harmony-qa.html):
//   - 물건은 맞는 땅 위에만 선다: 건물·나무·소품의 발 줄은 섬 안쪽 풀(가장자리 칸 아님), 작물은 밭, 말뚝은 잔교, 구름 덩이는 하늘. 아무것도 허공에 뜨지 않는다(비공정만 계류).
//   - 건물·소품은 발자국 + 여백을 예약하고 겹치지 않는다. 길·광장·다리 칸에 소품을 두지 않는다. 문 앞 접근칸과 그 아래 한 칸은 비운다.
//   - 문은 길로 잇는다(접근칸 → 길망). 다리 두 끝은 길 또는 풀에 닿는다.
//   - 띠 전체를 한 칸으로 덮지 않는다 — 풀 변주는 덩이 잡음(값 잡음 두 겹), 꽃은 드문 무리.
//   - 빈 풀이 크게 남으면(7×6 이 통째로 빔) 쓰임을 준다: 나무 덩이·쉼터(벤치+꽃)·수정 바위. 「텅 빈 섬」 방지.
// 순수 함수다(프로젝트를 모른다). 칸 번호는 호출자가 준 사전(palette)에서 얻는다 — 도구(skyIslandTools.ts)는 번들 정의에서, QA 스크립트는 구운 JSON 에서.

export type SkyIslandStyle = "village" | "shrine" | "dock" | "archipelago";
export type SkyRoomStyle = "cottage" | "shrine" | "cabin" | "observatory";
export type SkyComposeStyle = SkyIslandStyle | `room-${SkyRoomStyle}`;

export interface SkyKit {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly rows: readonly { readonly tiles: readonly number[]; readonly upperTiles?: readonly number[] }[];
  /** 출입구 부품(가로 문 칸) — 없으면 문 없는 소품. */
  readonly door?: { readonly dx: number; readonly w: number };
}

export interface SkyPalette {
  /** 한 칸 조각 id(grass·gs-n·path-1 …, `si-` 없이) → 칸 번호. 없으면 -1. */
  tile(piece: string): number;
  /** 키트(`si-` 붙은 id). */
  kit(id: string): SkyKit | undefined;
  /** 칸 번호의 통행: walk 걷는다 · block 막힘 · star ★(아래 층이 정한다). */
  pass(tile: number): "walk" | "block" | "star";
}

export interface SkyCell { readonly x: number; readonly y: number }
export interface SkyBuilding { readonly name: string; readonly kit: string; readonly rect: { x: number; y: number; w: number; h: number }; readonly doors: SkyCell[]; readonly access: SkyCell[] }
export interface SkyBridge { readonly kind: "rope" | "stone" | "rope-v" | "pier"; readonly from: SkyCell; readonly to: SkyCell }

export interface SkySpec {
  readonly width: number;
  readonly height: number;
  readonly style: SkyComposeStyle;
  readonly seed?: number;
}

export interface SkyResult {
  readonly lower: number[];
  readonly upper: number[];
  readonly buildings: SkyBuilding[];
  readonly bridges: SkyBridge[];
  readonly start: SkyCell;
  /** 실내 방: 나가는 문 칸(맨 아래 줄). 야외는 빈 배열. */
  readonly exits: SkyCell[];
  readonly props: { kit: string; x: number; y: number }[];
  readonly zones: { name: string; use: string; rect: { x: number; y: number; w: number; h: number } }[];
  readonly notes: string[];
}

/** 최소 크기. */
export const SKY_MIN_SIZE: Readonly<Record<SkyComposeStyle, { w: number; h: number }>> = {
  village: { w: 44, h: 32 }, shrine: { w: 44, h: 40 }, dock: { w: 50, h: 30 }, archipelago: { w: 48, h: 40 },
  "room-cottage": { w: 11, h: 11 }, "room-shrine": { w: 13, h: 14 }, "room-cabin": { w: 11, h: 10 }, "room-observatory": { w: 13, h: 12 },
};

const BUILDING_NAME: Readonly<Record<string, string>> = {
  "si-cottage-red": "빨간 지붕 오두막", "si-cottage-blue": "푸른 지붕 집", "si-tower-house": "돌탑 집", "si-windmill": "풍차",
  "si-lighthouse": "하늘 등대", "si-shrine": "하늘 신전", "si-observatory": "천문대", "si-dockhouse": "부두 관리소",
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
const ri = (rng: () => number, a: number, b: number): number => a + Math.floor(rng() * (b - a + 1));

type Use = "sky" | "grass" | "edge" | "under" | "path" | "plaza" | "field" | "cloud" | "water" | "bridge" | "bld" | "prop" | "deck" | "floor" | "wall" | "void";
interface Rect { x: number; y: number; w: number; h: number }
const WALKWAY: readonly Use[] = ["path", "plaza", "bridge", "deck"];

class Board {
  readonly lower: number[];
  readonly upper: number[];
  readonly use: Use[];
  readonly reserved: boolean[];
  readonly isle: number[];
  readonly buildings: SkyBuilding[] = [];
  readonly bridges: SkyBridge[] = [];
  readonly props: { kit: string; x: number; y: number }[] = [];
  readonly zones: { name: string; use: string; rect: Rect }[] = [];
  readonly notes: string[] = [];
  readonly targets: SkyCell[] = [];
  isles = 0;
  constructor(readonly W: number, readonly H: number, readonly pal: SkyPalette, readonly seed: number, ground: string, use: Use) {
    this.lower = new Array(W * H).fill(this.t(ground));
    this.upper = new Array(W * H).fill(-1);
    this.use = new Array(W * H).fill(use);
    this.reserved = new Array(W * H).fill(false);
    this.isle = new Array(W * H).fill(-1);
  }
  in(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
  k(x: number, y: number): number { return y * this.W + x; }
  u(x: number, y: number): Use | null { return this.in(x, y) ? this.use[this.k(x, y)]! : null; }
  t(piece: string): number {
    const id = this.pal.tile(piece);
    if (id < 0) throw new Error(`하늘섬 칩셋에 조각 ${piece} 이 없다`);
    return id;
  }
  setLower(x: number, y: number, piece: string, use?: Use): void {
    if (!this.in(x, y)) return;
    const k = this.k(x, y); this.lower[k] = this.t(piece); if (use) this.use[k] = use;
  }
  setUpper(x: number, y: number, piece: string, use?: Use): void {
    if (!this.in(x, y)) return;
    const k = this.k(x, y); this.upper[k] = this.t(piece); if (use) this.use[k] = use;
  }
  reserve(r: Rect): void { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (this.in(x, y)) this.reserved[this.k(x, y)] = true; }

  // ───────────── 섬 ─────────────
  /** 풀 섬(gs) 또는 구름 섬(cs) 하나를 깐다. 모양 = 직사각형들의 합(맨 아랫줄이 평평해야 한다 — 덧붙임은 위쪽으로만). 밑면은 바로 아래에. */
  island(rects: readonly Rect[], mat: "gs" | "cs", shallow: readonly number[] = []): Set<number> {
    const id = this.isles++;
    const cells = new Set<number>();
    for (const r of rects) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (this.in(x, y)) cells.add(this.k(x, y));
    const g = (x: number, y: number) => this.in(x, y) && cells.has(this.k(x, y));
    for (const k of cells) {
      const x = k % this.W, y = Math.floor(k / this.W);
      if (this.use[k] !== "sky") throw new Error(`섬이 다른 것과 겹친다 (${x},${y})`);
      const n = g(x, y - 1), s = g(x, y + 1), w = g(x - 1, y), e = g(x + 1, y);
      let kind: string | null = null;
      if (!n && !w) kind = "nw"; else if (!n && !e) kind = "ne"; else if (!s && !w) kind = "sw"; else if (!s && !e) kind = "se";
      else if (!n) kind = "n"; else if (!s) kind = "s"; else if (!w) kind = "w"; else if (!e) kind = "e";
      else if (!g(x - 1, y - 1)) kind = "inw"; else if (!g(x + 1, y - 1)) kind = "ine"; else if (!g(x - 1, y + 1)) kind = "isw"; else if (!g(x + 1, y + 1)) kind = "ise";
      this.isle[k] = id;
      if (kind) { this.lower[k] = this.t(`${mat}-${kind}`); this.use[k] = "edge"; }
      else { this.lower[k] = this.t(mat === "gs" ? "grass" : "cloud"); this.use[k] = mat === "gs" ? "grass" : "cloud"; }
    }
    // 밑면: 아랫줄 묶음마다 봉우리 하나(양 끝 2줄, 가운데 최대 6줄)
    const bottoms = [...cells].filter((k) => !cells.has(k + this.W)).map((k) => ({ x: k % this.W, y: Math.floor(k / this.W) })).sort((a, b) => a.y - b.y || a.x - b.x);
    const runs: SkyCell[][] = [];
    for (const c of bottoms) { const last = runs[runs.length - 1]; if (last && last[last.length - 1]!.y === c.y && last[last.length - 1]!.x === c.x - 1) last.push(c); else runs.push([c]); }
    for (const run of runs) {
      const Wd = run.length, y0 = run[0]!.y + 1;
      if (mat === "cs") {
        run.forEach((c, i) => this.underCell(c.x, y0, i === 0 ? "billow-l" : i === Wd - 1 ? "billow-r" : hash2(c.x, y0, this.seed) < 0.35 ? "billow-b" : "billow"));
        continue;
      }
      // 밑면 = 아래로 뾰족해지는 바위 덩이(QA D8: 평평한 판 → 봉우리). 봉우리 자리는 씨앗으로 흔들고, 넓은 섬은 봉우리 둘.
      const dmax = Math.min(8, 2 + Math.floor(Wd / 3.2));
      const peaks = Wd >= 16 && hash2(Wd, y0, this.seed + 5) < 0.5
        ? [0.3 + (hash2(1, y0, this.seed + 6) - 0.5) * 0.12, 0.68 + (hash2(2, y0, this.seed + 6) - 0.5) * 0.12]
        : [0.5 + (hash2(3, y0, this.seed + 6) - 0.5) * 0.3];
      const tgt = run.map((c, i) => {
        const u = (i + 0.5) / Wd;
        let v = 0;
        for (const pk of peaks) v = Math.max(v, Math.pow(Math.max(0, 1 - Math.abs(u - pk) / Math.max(pk, 1 - pk)), 1.5) * (pk === peaks[0] ? 1 : 0.8));
        const lim = shallow.some((sx) => Math.abs(sx - c.x) <= 1) ? 2 : 99;
        return Math.min(lim, 2 + (dmax - 2) * v + (hash2(i, y0, this.seed + 1) - 0.5) * 1.4);
      });
      const L = new Array(Wd).fill(2), Rr = new Array(Wd).fill(2);
      for (let i = 1; i < Wd; i++) L[i] = L[i - 1] + (tgt[i]! > L[i - 1] + 0.4 ? 1 : tgt[i]! < L[i - 1] - 0.6 ? -1 : 0);
      for (let i = Wd - 2; i >= 0; i--) Rr[i] = Rr[i + 1] + (tgt[i]! > Rr[i + 1] + 0.4 ? 1 : tgt[i]! < Rr[i + 1] - 0.6 ? -1 : 0);
      const d = L.map((v, i) => Math.max(2, Math.min(v, Rr[i], Math.ceil(tgt[i]! + 0.5))));
      run.forEach((c, i) => {
        const endL = i === 0, endR = i === Wd - 1;
        for (let r = 0; r < d[i]!; r++) {
          let id: string;
          if (r === 0) id = endL ? "face-top-l" : endR ? "face-top-r" : hash2(c.x, 5, this.seed) < 0.25 ? "face-top-b" : hash2(c.x, 6, this.seed) < 0.06 ? "face-top-crystal" : "face-top";
          else if (r < d[i]! - 1) id = hash2(c.x, r, this.seed) < 0.3 ? "face-mid-b" : "face-mid";
          else id = endL ? "tip-l" : endR ? "tip-r" : `tip-${"abcd"[Math.floor(hash2(c.x, y0, this.seed + 3) * 4)]}`;
          this.underCell(c.x, y0 + r, id);
        }
      });
    }
    return cells;
  }
  underCell(x: number, y: number, piece: string): void {
    if (!this.in(x, y)) return;
    const k = this.k(x, y);
    if (this.use[k] !== "sky") throw new Error(`섬 밑면이 다른 것과 겹친다 (${x},${y})`);
    this.lower[k] = this.t(piece); this.use[k] = "under";
  }
  /** 섬 안쪽 풀 칸(가장자리 아님)인가. */
  inner(x: number, y: number): boolean { const u = this.u(x, y); return u === "grass"; }

  // ───────────── 땅 ─────────────
  path(x: number, y: number): void {
    if (!this.in(x, y)) return;
    const k = this.k(x, y);
    if (this.use[k] !== "grass" && this.use[k] !== "path") return;
    this.lower[k] = this.t(`path-${1 + Math.floor(hash2(x, y, this.seed + 9) * 3)}`); this.use[k] = "path";
  }
  hpath(x0: number, x1: number, y: number): void { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.path(x, y); }
  vpath(x: number, y0: number, y1: number): void { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.path(x, y); }
  /** 테두리 있는 네모 땅(plaza·field). 안쪽 풀 칸에만 깐다. */
  patch(base: "plaza" | "field", r: Rect, use: Use, rim = true): boolean {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const u = this.u(x, y); if (u === "path") continue; if (u !== "grass" || this.reserved[this.k(x, y)]) return false; }   // 예약된 길 칸(문 앞 접근칸 아래)은 포석으로 덮어도 걷는다 — 소품은 예약이 그대로 막는다
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      const kk = !rim ? "" : (y === r.y ? "n" : y === r.y + r.h - 1 ? "s" : "") + (x === r.x ? "w" : x === r.x + r.w - 1 ? "e" : "");
      this.setLower(x, y, kk ? `${base}-${kk}` : base, use);
    }
    this.zones.push({ name: base === "plaza" ? "광장" : "밭", use: base, rect: r });
    return true;
  }

  // ───────────── 물건 ─────────────
  kitOf(id: string): SkyKit {
    const kit = this.pal.kit(id);
    if (!kit) throw new Error(`하늘섬 칩셋에 키트 ${id} 가 없다`);
    return kit;
  }
  /** 발 줄(맨 아랫줄)은 ground 쓰임 위, 나머지 줄은 섬 칸(풀·가장자리) 위 — 하늘로 삐져나가지 않는다. 여백 칸에는 다른 물건이 없어야 한다. */
  canPlace(kit: SkyKit, x: number, y: number, margin: number, ground: readonly Use[] = ["grass"], body: readonly Use[] = ["grass", "edge"]): boolean {
    for (let yy = y - margin; yy < y + kit.height + margin; yy++) for (let xx = x - margin; xx < x + kit.width + margin; xx++) {
      const inside = xx >= x && yy >= y && xx < x + kit.width && yy < y + kit.height;
      if (!this.in(xx, yy)) { if (inside) return false; continue; }
      const k = this.k(xx, yy), u = this.use[k]!;
      if (inside) {
        const foot = yy === y + kit.height - 1;
        if (this.reserved[k]) return false;
        if (foot ? !ground.includes(u) : !(body.includes(u) || ground.includes(u))) return false;
      } else if (u === "bld" || u === "prop") return false;
    }
    return true;
  }
  stamp(kit: SkyKit, x: number, y: number, use: Use): void {
    kit.rows.forEach((row, r) => {
      for (let c = 0; c < kit.width; c++) {
        const X = x + c, Y = y + r;
        if (!this.in(X, Y)) continue;
        const k = this.k(X, Y), lo = row.tiles[c] ?? -1, up = row.upperTiles?.[c] ?? -1;
        if (lo < 0 && up < 0) continue;
        if (lo >= 0) this.lower[k] = lo;
        if (up >= 0) this.upper[k] = up;
        this.use[k] = use;
      }
    });
  }
  prop(id: string, x: number, y: number, margin = 1, ground: readonly Use[] = ["grass"], body?: readonly Use[]): boolean {
    const kit = this.pal.kit(id);
    if (!kit || !this.canPlace(kit, x, y, margin, ground, body)) return false;
    // 걷는 깔개(깔개·방석·밧줄 뭉치)는 바닥 쓰임을 그대로 둔다 — 그 위에 탁자를 놓을 수 있다(탁자는 윗층 칸을 덮어쓴다).
    const decal = kit.rows.every((r) => [...r.tiles, ...(r.upperTiles ?? [])].every((t) => t < 0 || this.pal.pass(t) !== "block"));
    if (decal) {
      const before = kit.rows.map((_, r) => Array.from({ length: kit.width }, (_, c) => this.u(x + c, y + r)));
      this.stamp(kit, x, y, "prop");
      before.forEach((row, r) => row.forEach((u, c) => { if (u) this.use[this.k(x + c, y + r)] = u; }));
      this.reserve({ x, y, w: kit.width, h: kit.height });   // 같은 칸에 두 번 놓지 않는다(QA D25)
    } else this.stamp(kit, x, y, "prop");
    this.props.push({ kit: id, x, y });
    return true;
  }
  /** 건물: 문 칸 아래 접근칸 + 그 아래 한 칸을 비우고(예약), 접근칸을 길로 깐다. */
  building(id: string, x: number, y: number, margin = 1): SkyBuilding | null {
    const kit = this.pal.kit(id);
    if (!kit) { this.notes.push(`${id} 키트가 없어 뺐다`); return null; }
    if (!this.canPlace(kit, x, y, margin, ["grass"], ["grass", "edge", "sky", "under"])) return null;
    const d = kit.door;
    if (d) for (let i = 0; i < d.w; i++) { const ax = x + d.dx + i, ay = y + kit.height; if (!this.inner(ax, ay) && this.u(ax, ay) !== "path") return null; }
    this.stamp(kit, x, y, "bld");
    const doors = d ? Array.from({ length: d.w }, (_, i) => ({ x: x + d.dx + i, y: y + kit.height - 1 })) : [];
    const access = doors.map((c) => ({ x: c.x, y: c.y + 1 }));
    for (const a of access) { this.path(a.x, a.y); this.reserve({ x: a.x, y: a.y, w: 1, h: 2 }); this.targets.push(a); }
    // 벽에 붙은 소품 금지(QA D32): 서·동·남 둘레 한 칸을 예약한다(북쪽 = 지붕 뒤는 나무가 설 수 있다).
    this.reserve({ x: x - 1, y, w: 1, h: kit.height + 1 }); this.reserve({ x: x + kit.width, y, w: 1, h: kit.height + 1 }); this.reserve({ x: x - 1, y: y + kit.height, w: kit.width + 2, h: 1 });
    const b = { name: BUILDING_NAME[id] ?? id, kit: id, rect: { x, y, w: kit.width, h: kit.height }, doors, access };
    this.buildings.push(b);
    return b;
  }
  /** 문 접근칸에서 아래로 내려가 길망(path·plaza·bridge)에 닿을 때까지 길을 낸다. 막히면 옆 길로 꺾는다. */
  connect(b: SkyBuilding): void {
    const isNet = (x: number, y: number) => { const u = this.u(x, y); return u === "path" || u === "plaza" || u === "deck"; };
    for (const a of b.access) {
      let y = a.y + 1;
      if (isNet(a.x, y)) continue;
      for (let guard = 0; guard < this.H; guard++, y++) {
        const u = this.u(a.x, y);
        if (u !== "grass" && u !== "path") break;
        if (isNet(a.x, y)) break;
        this.path(a.x, y);
        if (isNet(a.x, y + 1) || isNet(a.x - 1, y) || isNet(a.x + 1, y)) break;
        // 옆으로 가까운 길(8칸 안)이 있으면 가로로 꺾는다
        let done = false;
        for (let dist = 2; dist <= 8 && !done; dist++) for (const dir of [-1, 1]) {
          const x = a.x + dir * dist;
          if (!isNet(x, y)) continue;
          let ok = true;
          for (let i = 1; i < dist; i++) { const uu = this.u(a.x + dir * i, y); if (uu !== "grass" && uu !== "path") ok = false; }
          if (ok) { for (let i = 1; i < dist; i++) this.path(a.x + dir * i, y); done = true; break; }
        }
        if (done) break;
      }
    }
  }

  // ───────────── 다리 ─────────────
  /** 밧줄 다리(동서): (x0,y) 서쪽 섬 동쪽 가장자리 → (x1,y) 동쪽 섬 서쪽 가장자리. 사이 칸은 하늘. */
  ropeH(x0: number, x1: number, y: number): void {
    this.setUpper(x0, y, "bridge-h-w", "bridge"); this.setUpper(x1, y, "bridge-h-e", "bridge");
    for (let x = x0 + 1; x < x1; x++) this.setUpper(x, y, "bridge-h", "bridge");
    this.bridges.push({ kind: "rope", from: { x: x0, y }, to: { x: x1, y } }); this.targets.push({ x: x1, y });
  }
  /** 밧줄 다리(남북): (x,y0) 북쪽 섬 남쪽 가장자리 → (x,y1) 남쪽 섬 북쪽 가장자리. 북쪽 섬 밑면 위를 지난다. */
  ropeV(x: number, y0: number, y1: number): void {
    this.setUpper(x, y0, "bridge-v-n", "bridge"); this.setUpper(x, y1, "bridge-v-s", "bridge");
    for (let y = y0 + 1; y < y1; y++) this.setUpper(x, y, "bridge-v", "bridge");
    this.bridges.push({ kind: "rope-v", from: { x, y: y0 }, to: { x, y: y1 } }); this.targets.push({ x, y: y1 });
  }
  /** 돌다리(동서): 상판 줄 y + 바로 아래 아치 줄. */
  stoneH(x0: number, x1: number, y: number): void {
    this.setUpper(x0, y, "sbridge-w", "bridge"); this.setUpper(x1, y, "sbridge-e", "bridge");
    for (let x = x0 + 1; x < x1; x++) this.setUpper(x, y, "sbridge", "bridge");
    if (x1 - x0 >= 3) {
      this.setUpper(x0 + 1, y + 1, "sbridge-arch-w"); this.setUpper(x1 - 1, y + 1, "sbridge-arch-e");
      for (let x = x0 + 2; x < x1 - 1; x++) this.setUpper(x, y + 1, "sbridge-arch");
    }
    this.bridges.push({ kind: "stone", from: { x: x0, y }, to: { x: x1, y } }); this.targets.push({ x: x1, y });
  }
  /** 잔교: 섬 맨 아랫줄 바로 아래(y0)부터 rows 줄, 폭 3(x0..x0+2) + 맨 끝 아래 버팀. */
  pier(x0: number, y0: number, rows: number): void {
    for (let r = 0; r < rows; r++) {
      const last = r === rows - 1;
      ["w", "c", "e"].forEach((p, i) => this.setUpper(x0 + i, y0 + r, `pier-${last ? (p === "c" ? "s" : `s${p}`) : p}`, "deck"));
    }
    ["w", "c", "e"].forEach((p, i) => this.setUpper(x0 + i, y0 + rows, `pier-struts-${p}`));
    this.bridges.push({ kind: "pier", from: { x: x0 + 1, y: y0 - 1 }, to: { x: x0 + 1, y: y0 + rows - 1 } }); this.targets.push({ x: x0 + 1, y: y0 + rows - 1 });
  }

  // ───────────── 물 ─────────────
  /** 시내: (x, y0) 부터 남쪽 섬 끝(맨 아랫줄)까지, 끝은 물턱 + 밑면 위 폭포 + 하늘 물줄기 + 물안개. 길 칸은 물 위 널다리로. */
  stream(x: number, y0: number): boolean {
    let y = y0;
    while (this.in(x, y + 1) && (this.u(x, y + 1) === "grass" || this.u(x, y + 1) === "path" || this.u(x, y + 1) === "edge")) y++;
    if (this.u(x, y) !== "edge") return false;
    for (let yy = y0; yy < y; yy++) {
      const wasPath = this.u(x, yy) === "path";
      this.setLower(x, yy, "stream", "water");
      if (wasPath) { this.setUpper(x, yy, "bridge-h", "bridge"); }
    }
    this.setLower(x, y, "stream-lip", "water");
    let yy = y + 1;
    while (this.in(x, yy) && this.u(x, yy) === "under") { this.setUpper(x, yy, "falls-face"); yy++; }
    for (let i = 0; i < 2 && this.in(x, yy) && this.u(x, yy) === "sky"; i++, yy++) { this.setUpper(x, yy, "falls-air"); this.use[this.k(x, yy)] = "water"; }
    if (this.in(x, yy) && this.u(x, yy) === "sky") { this.setUpper(x, yy, "falls-mist"); this.use[this.k(x, yy)] = "water"; }
    this.zones.push({ name: "시내·폭포", use: "water", rect: { x, y: y0, w: 1, h: yy - y0 + 1 } });
    return true;
  }

  // ───────────── 바닥 변주·빈 땅 쓰임·하늘 ─────────────
  groundVariety(): void {
    const grass = this.t("grass"), gb = this.pal.tile("grass-b"), gf = this.pal.tile("grass-flower"), gfb = this.pal.tile("grass-flower-b");
    const sky = this.t("sky"), glint = this.pal.tile("sky-glint");
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      const k = this.k(x, y);
      if (this.use[k] === "grass" && this.lower[k] === grass) {
        const n = vnoise(x + 1000, y + 1000, 6, this.seed) * 0.8 + vnoise(x + 1000, y + 1000, 3, this.seed + 7) * 0.2;
        const f = vnoise(x + 500, y + 500, 5, this.seed + 13);
        if (gb >= 0 && n > 0.62) this.lower[k] = gb;
        else if (gf >= 0 && f < 0.17 && hash2(x, y, this.seed + 3) < 0.5) this.lower[k] = hash2(x, y, this.seed + 4) < 0.5 || gfb < 0 ? gf : gfb;
      } else if (this.use[k] === "sky" && this.lower[k] === sky && glint >= 0 && hash2(x, y, this.seed + 21) < 0.025) this.lower[k] = glint;
    }
  }
  /** w×h 가 통째로 빈 풀이고 둘레 1칸에 건물·소품이 없는가. */
  emptyBlock(x: number, y: number, w: number, h: number): boolean {
    for (let yy = y - 1; yy <= y + h; yy++) for (let xx = x - 1; xx <= x + w; xx++) {
      if (!this.in(xx, yy)) return false;
      const k = this.k(xx, yy), u = this.use[k]!;
      const inside = xx >= x && yy >= y && xx < x + w && yy < y + h;
      if (inside ? (u !== "grass" || this.reserved[k]) : (u === "bld" || u === "prop")) return false;
    }
    return true;
  }
  /** 나무 덩이: (x,y) 둘레에 나무 n 그루를 엇갈려 심고 밑에 덤불·풀을 깐다(같은 간격 줄 금지 — QA D2·D6). 심은 수. */
  grove(rng: () => number, x: number, y: number, n: number, kinds: readonly string[] = ["si-tree-round", "si-tree-round", "si-tree-pine", "si-tree-blossom"]): number {
    const offs = [[0, 0], [2, 1], [-2, 1], [1, 2], [3, -1], [-1, -1], [4, 2], [-3, 0]];
    let planted = 0;
    for (const [dx, dy] of offs) {
      if (planted >= n) break;
      const id = pick(rng, kinds);
      if (this.prop(id, x + dx!, y + dy!, 0)) planted++;
    }
    for (const [dx, dy] of [[1, 3], [-1, 3], [3, 2], [2, 3], [-2, 2]]) if (rng() < 0.55) this.prop(pick(rng, ["si-bush", "si-bush-flower", "si-tallgrass", "si-tree-young"]), x + dx!, y + dy!, 0);
    return planted;
  }
  /** 남은 빈 풀 덩이에 쓰임을 준다 — 큰 덩이(6×5)는 나무숲·들꽃 풀밭·수정 바위, 작은 덩이(4×4)는 나무 두셋. 자리는 전부 훑되 순서는 씨앗으로 섞는다. */
  fillEmpty(rng: () => number, max: number, kinds: readonly ("grove" | "meadow" | "rocks" | "rest")[] = ["grove", "meadow", "grove", "rocks", "grove"]): number {
    const spots: SkyCell[] = [];
    for (let y = 1; y < this.H - 4; y++) for (let x = 1; x < this.W - 4; x++) spots.push({ x, y });
    for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [spots[i], spots[j]] = [spots[j]!, spots[i]!]; }
    let n = 0;
    for (const size of [[6, 5], [4, 4]] as const) for (const { x, y } of spots) {
      if (n >= max) break;
      if (!this.emptyBlock(x, y, size[0], size[1])) continue;
      const kind = size[0] === 4 ? "grove" : kinds[n % kinds.length]!;
      if (kind === "grove") {
        if (!this.grove(rng, x + 1, y, size[0] === 4 ? 2 : ri(rng, 3, 4))) continue;
        this.zones.push({ name: "나무숲", use: "grove", rect: { x, y, w: size[0], h: size[1] } });
      } else if (kind === "meadow") {
        let k = 0;
        for (let yy = y; yy < y + size[1]; yy++) for (let xx = x; xx < x + size[0]; xx++) if (vnoise(xx + 300, yy + 300, 2, this.seed + n) > 0.45 && this.prop(pick(rng, ["si-flowers-a", "si-flowers-b", "si-flowers-a", "si-tallgrass"]), xx, yy, 0)) k++;
        if (k < 3) continue;
        this.prop(pick(rng, ["si-tree-young", "si-beehive", "si-bush-flower"]), x + ri(rng, 1, size[0] - 2), y + ri(rng, 0, 1), 0);
        this.zones.push({ name: "들꽃 풀밭", use: "meadow", rect: { x, y, w: size[0], h: size[1] } });
      } else if (kind === "rest") {
        if (!this.prop("si-bench", x + 2, y + 3, 0)) continue;
        this.grove(rng, x + 2, y, 2, ["si-tree-round", "si-tree-blossom"]);
        this.prop("si-flowers-a", x + 1, y + 3, 0); this.prop("si-flowers-b", x + 4, y + 3, 0);
        this.zones.push({ name: "쉼터", use: "rest", rect: { x, y, w: size[0], h: size[1] } });
      } else {
        if (!this.prop("si-rock-big", x + 2, y + 1, 0)) continue;
        this.prop("si-crystal-cluster", x + 1, y + 1, 0); this.prop("si-crystal-small", x + 4, y + 2, 0); this.prop("si-tallgrass", x + 1, y + 3, 0); this.prop("si-rock-small", x + 4, y + 3, 0);
        this.zones.push({ name: "수정 바위", use: "rocks", rect: { x, y, w: size[0], h: size[1] } });
      }
      n++;
    }
    return n;
  }
  /** 남은 빈 풀 덩이 수(QA 지표 — 6×5 가 통째로 빈 곳). */
  emptyCount(): number {
    let n = 0;
    for (let y = 1; y < this.H - 5; y++) for (let x = 1; x < this.W - 6; x++) if (this.emptyBlock(x, y, 6, 5)) n++;
    return n;
  }
  /** 섬 가장자리 안쪽 한 줄 장식: 키 큰 풀·꽃·작은 바위 드문드문(가장자리 칸 자체엔 두지 않는다). */
  edgeAccents(rng: () => number): void {
    for (let y = 1; y < this.H - 1; y++) for (let x = 1; x < this.W - 1; x++) {
      if (this.use[this.k(x, y)] !== "grass" || this.reserved[this.k(x, y)]) continue;
      const nearEdge = ["edge"].includes(this.u(x, y + 1) ?? "") || this.u(x - 1, y) === "edge" || this.u(x + 1, y) === "edge";
      // 덩이로(값 잡음) — 가장자리를 따라 빗살처럼 늘어서지 않게(QA D6). 건물 옆은 비운다.
      if (!nearEdge || vnoise(x + 70, y + 70, 3, this.seed + 41) < 0.62 || hash2(x, y, this.seed + 42) < 0.35) continue;
      const k = rng();
      this.prop(k < 0.5 ? "si-tallgrass" : k < 0.8 ? pick(rng, ["si-flowers-a", "si-flowers-b"]) : "si-rock-small", x, y, 0);
    }
  }
  /** 하늘 꾸밈: 섬에서 2칸 이상 떨어진 빈 하늘에 구름 덩이, 섬 밑면에 늘어진 뿌리·사슬. */
  skyDecor(rng: () => number): void {
    const farFromLand = (r: Rect) => {
      for (let y = r.y - 2; y < r.y + r.h + 2; y++) for (let x = r.x - 2; x < r.x + r.w + 2; x++) { if (!this.in(x, y)) continue; if (this.use[this.k(x, y)] !== "sky") return false; }
      return true;
    };
    let placed = 0;
    for (let tries = 0; tries < 300 && placed < Math.max(2, Math.floor(this.W * this.H / 300)); tries++) {
      const id = pick(rng, ["si-cloud-puff-s", "si-cloud-puff-m", "si-cloud-puff-m", "si-cloud-puff-l"]);
      const kit = this.pal.kit(id); if (!kit) continue;
      const x = ri(rng, 0, this.W - kit.width), y = ri(rng, 0, this.H - kit.height);
      if (!farFromLand({ x, y, w: kit.width, h: kit.height })) continue;
      this.stamp(kit, x, y, "prop"); this.props.push({ kit: id, x, y }); placed++;
    }
    // 밑면 장식: face-top 칸 중 드물게
    const top = new Set([this.pal.tile("face-top"), this.pal.tile("face-top-b")]);
    for (let y = 0; y < this.H - 2; y++) for (let x = 0; x < this.W; x++) {
      const k = this.k(x, y);
      if (this.use[k] !== "under" || !top.has(this.lower[k]!) || this.upper[k]! >= 0) continue;
      const r = hash2(x, y, this.seed + 61);
      if (r < 0.05 && this.upper[this.k(x, y + 1)]! < 0 && (this.u(x, y + 1) === "under" || this.u(x, y + 1) === "sky")) { this.stamp(this.kitOf("si-roots-hang"), x, y, "under"); this.props.push({ kit: "si-roots-hang", x, y }); }
      // 사슬(si-chain-hang)은 바위에 붙은 상자처럼 읽혀(QA D17·D25) 하늘 꾸밈에서 뺐다.
    }
  }
  lamps(cells: readonly SkyCell[], every: number): void {
    cells.forEach((c, i) => { if (i % every === 0) this.prop("si-lamppost", c.x, c.y - 1, 0); });
  }
  /** 섬 둘레 안쪽 나무: 북쪽 가장자리 바로 안쪽 줄을 따라 띄엄띄엄(같은 간격 금지). */
  treeLine(rng: () => number, x0: number, x1: number, footY: number, kinds: readonly string[], step = 5, margin = 1): void {
    for (let x = x0; x <= x1 - 1; x += step + ri(rng, -1, 1)) {
      if (rng() < 0.25) { this.prop(pick(rng, ["si-bush", "si-bush-flower"]), x, footY, 0); continue; }
      const id = pick(rng, kinds); const kit = this.pal.kit(id); if (!kit) continue;
      if (!this.prop(id, x, footY - kit.height + 1, margin)) this.prop(pick(rng, ["si-bush", "si-tree-young"]), x, footY - (id === "si-tree-young" ? 0 : 0), 0);
    }
  }
  /** 샘: (x-1..x+1, y..y+1) 연못에서 시내가 남쪽 섬 끝까지 흘러 폭포로 떨어진다. 섬 끝에 가까운 자리부터(짧은 물길 — QA D21) yMin 까지 찾는다. */
  spring(x: number, yMin: number, yMax = this.H - 4): boolean {
    for (let yy = yMax; yy >= yMin; yy--) {
      const kit = this.pal.kit("si-pond"); if (!kit || !this.canPlace(kit, x - 1, yy, 0)) continue;
      let y = yy + 2, ok = false;
      while (this.in(x, y)) { const u = this.u(x, y); if (u === "edge") { ok = true; break; } if (u !== "grass" && u !== "path") break; y++; }
      if (!ok || y - (yy + 2) > 3) continue;
      this.prop("si-pond", x - 1, yy, 0);
      return this.stream(x, yy + 2);
    }
    return false;
  }
  /** 등불 하나를 (x,y) 가까이(옆·위 칸) 세운다 — 일정 간격 줄이 아니라 갈림길·다리 머리·문 옆에(QA D15). */
  lampNear(x: number, y: number): boolean {
    for (const [dx, dy] of [[1, -1], [-1, -1], [1, 0], [-1, 0], [2, -1], [-2, -1]] as const) if (this.prop("si-lamppost", x + dx, y + dy - 1, 0)) return true;
    return false;
  }
  /** 밭 둘레 울타리(밖 한 칸): 북쪽 gateX 칸은 문(비움). 모서리는 끝 말뚝. */
  fenceAround(r: Rect, gateX: number, gateSide: "n" | "s" = "n"): void {
    const top = r.y - 1, bot = r.y + r.h;
    for (let x = r.x - 1; x <= r.x + r.w; x++) {
      const id = x === r.x - 1 ? "si-fence-w" : x === r.x + r.w ? "si-fence-e" : "si-fence-h";
      if (!(x === gateX && gateSide === "n")) this.prop(id, x, top, 0, ["grass", "path", "edge"]);
      if (!(x === gateX && gateSide === "s")) this.prop(id, x, bot, 0, ["grass", "path", "edge"]);
    }
    for (let y = r.y; y < r.y + r.h; y++) { this.prop("si-fence-v", r.x - 1, y, 0, ["grass", "edge"]); this.prop("si-fence-v", r.x + r.w, y, 0, ["grass", "edge"]); }
  }

  // ───────────── 도달 ─────────────
  walk(x: number, y: number): boolean {
    if (!this.in(x, y)) return false;
    const k = this.k(x, y), up = this.upper[k]!;
    if (up >= 0) { const p = this.pal.pass(up); if (p !== "star") return p === "walk"; }
    return this.pal.pass(this.lower[k]!) === "walk";
  }
  reach(from: SkyCell): Set<number> {
    const seen = new Set<number>(); if (!this.walk(from.x, from.y)) return seen;
    seen.add(this.k(from.x, from.y)); const q: SkyCell[] = [from];
    while (q.length) {
      const c = q.pop()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = c.x + dx, ny = c.y + dy;
        if (!this.in(nx, ny) || seen.has(this.k(nx, ny)) || !this.walk(nx, ny)) continue;
        seen.add(this.k(nx, ny)); q.push({ x: nx, y: ny });
      }
    }
    return seen;
  }
}

// ═══════════════════════ 섬 모양 ═══════════════════════
/** 바닥이 평평한 섬: 몸통 + 위쪽 혹(lobe) 0~2. */
function isleRects(rng: () => number, x: number, y: number, w: number, h: number, lobes = 2): Rect[] {
  const rs: Rect[] = [{ x, y, w, h }];
  const n = ri(rng, 0, lobes);
  for (let i = 0; i < n; i++) {
    const lw = ri(rng, 3, Math.max(3, Math.floor(w / 2))), lx = ri(rng, x + 1, x + w - lw - 1), lh = ri(rng, 1, 2);
    if (y - lh >= 1) rs.push({ x: lx, y: y - lh, w: lw, h: lh });
  }
  // 옆 계단(바닥 줄은 같게): 한쪽 위 모서리를 깎는다
  if (rng() < 0.5 && h >= 8) rs[0] = { x, y, w, h }, rs.push();
  return rs;
}
/** 섬 위 모서리 깎기(바닥 줄은 그대로): 몸통을 두 사각형으로. */
function cutTop(r: Rect, side: "w" | "e", cw: number, ch: number): Rect[] {
  return side === "w"
    ? [{ x: r.x + cw, y: r.y, w: r.w - cw, h: r.h }, { x: r.x, y: r.y + ch, w: cw, h: r.h - ch }]
    : [{ x: r.x, y: r.y, w: r.w - cw, h: r.h }, { x: r.x + r.w - cw, y: r.y + ch, w: cw, h: r.h - ch }];
}

// ═══════════════════════ 마을 ═══════════════════════
function composeVillage(b: Board, rng: () => number): SkyCell {
  const { W, H } = b;
  const flip = rng() < 0.5;                                // 작은 섬(망루 섬)이 동쪽(false) / 서쪽(true)
  const bw = 10, gap = 4;
  const ah = Math.min(H - 12, 16 + ri(rng, 0, 1));          // QA D1: 섬을 내용에 맞춘다(남쪽 빈 띠를 줄임)
  const aw = W - 4 - bw - gap;
  const ax = flip ? 2 + bw + gap : 2, ay = 3;
  const pr = ay + 8;                                       // 큰길 줄
  const body = cutTop({ x: ax, y: ay, w: aw, h: ah }, flip ? "e" : "w", ri(rng, 3, 5), ri(rng, 2, 3));
  b.island([...body, ...isleRects(rng, ax + 4, ay, aw - 8, ah, 2).slice(1)], "gs");
  const bx = flip ? 2 : ax + aw + gap, by = ay, bh = 12;
  b.island([{ x: bx, y: by, w: bw, h: bh }], "gs");
  const px0 = ax + 1, px1 = ax + aw - 2;
  b.hpath(px0, px1, pr);
  b.zones.push({ name: "큰길", use: "path", rect: { x: px0, y: pr, w: px1 - px0 + 1, h: 1 } });
  // 길 북쪽 집 줄 — 발 줄을 0~1칸 엇갈린다(QA D2: 한 줄 열병식 금지). 풍차는 밭 쪽 끝.
  const pool = ["si-cottage-red", "si-cottage-blue", "si-tower-house"];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j]!, pool[i]!]; }
  const order = flip ? ["si-windmill", pool[0]!, pool[1]!, pool[2]!] : [pool[0]!, pool[1]!, pool[2]!, "si-windmill"];
  let x = px0 + 1 + ri(rng, 0, 1);
  const placed: SkyBuilding[] = [];
  for (const id of order) {
    const kit = b.pal.kit(id); if (!kit) continue;
    let done = false;
    for (let dx = 0; dx < 4 && !done; dx++) for (const lift of rng() < 0.5 ? [1, 0] : [0, 1]) {
      const top = pr - 1 - lift - kit.height;
      if (top < ay || done) continue;
      const bb = b.building(id, x + dx, top, 1);
      if (bb) { placed.push(bb); x = x + dx + kit.width + ri(rng, 2, 3); done = true; }
    }
    if (!done) b.notes.push(`${BUILDING_NAME[id] ?? id} 자리가 없어 뺐다`);
    if (x > px1 - 3) break;
  }
  for (const bb of placed) b.connect(bb);
  // 집 뒤 나무숲 두 덩이(일정 간격 줄 대신)
  const backXs = [px0 + 2 + ri(rng, 0, 4), Math.floor((px0 + px1) / 2) + ri(rng, -3, 3), px1 - 6 + ri(rng, 0, 3)];
  for (const gx of backXs.slice(0, 2 + (rng() < 0.5 ? 1 : 0))) b.grove(rng, gx, ay, ri(rng, 2, 3), ["si-tree-round", "si-tree-pine", "si-tree-round", "si-tree-blossom"]);
  // 길 남쪽: 우물 광장(테두리 없는 포석 — QA D3) · 울타리 밭(문 하나 — QA D5)
  const mill = placed.find((p) => p.kit === "si-windmill");
  const southTop = pr + 2;
  const pw = 9, ph = 4;
  const fw = 7, fh = 3;
  const millX = mill ? mill.rect.x : (flip ? px0 + 2 : px1 - 9);
  const fieldX = Math.max(px0 + 2, Math.min(px1 - fw - 2, millX - 1));
  const plazaX = flip ? Math.min(px1 - pw - 1, fieldX + fw + 4) : Math.max(px0 + 1, fieldX - pw - 4);
  if (b.patch("plaza", { x: plazaX, y: southTop, w: pw, h: ph }, "plaza", false)) {
    const cxp = plazaX + Math.floor(pw / 2);
    b.vpath(cxp, pr + 1, southTop - 1);
    b.prop("si-well", cxp - 1, southTop + 1, 0, ["plaza"], ["plaza"]);
    const stallX = flip ? plazaX + pw - 3 : plazaX;
    b.prop("si-stall", stallX, southTop, 0, ["plaza"], ["plaza"]);
    b.prop("si-barrel", flip ? stallX - 1 : stallX + 3, southTop + 2, 0, ["plaza"], ["plaza"]);
    b.prop("si-crate", flip ? stallX - 1 : stallX + 3, southTop, 0, ["plaza"], ["plaza"]);
    b.prop("si-bench", flip ? plazaX : plazaX + pw - 2, southTop + ph - 1, 0, ["plaza"], ["plaza"]);
    b.lampNear(flip ? plazaX + pw : plazaX - 1, southTop + 1);
  } else b.notes.push("광장 자리가 없어 뺐다");
  const field = { x: fieldX, y: southTop + 1, w: fw, h: fh };
  if (b.patch("field", field, "field")) {
    const gateX = field.x + Math.floor(fw / 2);
    for (let yy = field.y; yy < field.y + fh; yy++) for (let xx = field.x; xx < field.x + fw; xx++) {
      if (xx === gateX && yy === field.y) continue;
      b.prop(["si-crop-wheat", "si-crop-cabbage", "si-crop-sprout"][(yy - field.y) % 3]!, xx, yy, 0, ["field"], ["field"]);
    }
    b.fenceAround(field, gateX);
    b.vpath(gateX, pr + 1, field.y - 1);
    b.prop("si-haybale", flip ? field.x - 3 : field.x + fw + 2, field.y + 1, 0) || b.prop("si-haybale", flip ? field.x - 2 : field.x + fw + 1, field.y + fh, 0);
    b.zones.push({ name: "밭", use: "field", rect: field });
  }
  // 샘 → 짧은 시내 → 섬 끝 폭포(광장과 밭 사이)
  const sx = Math.floor((plazaX + pw / 2 + fieldX + fw / 2) / 2);
  if (rng() < 0.8) b.spring(sx, southTop);
  // 망루 섬: 돌탑 집(북쪽 가장자리에서 한 줄 띄움) · 다리 머리 등불 · 남쪽 전망 벤치·나무
  const aEdgeX = flip ? ax : ax + aw - 1, bEdgeX = flip ? bx + bw - 1 : bx;
  b.ropeH(Math.min(aEdgeX, bEdgeX), Math.max(aEdgeX, bEdgeX), pr);
  b.hpath(bx + 1, bx + bw - 2, pr);
  const tower = b.kitOf("si-tower-house");
  const tx = bx + Math.floor((bw - tower.width) / 2);
  const tw = b.building("si-tower-house", tx, pr - 1 - tower.height, 1);
  if (tw) b.connect(tw); else b.notes.push("망루 섬 탑 자리가 없다");
  b.lampNear(flip ? bx + bw - 2 : bx + 1, pr);
  b.prop("si-bench", bx + Math.floor(bw / 2) - 1, pr + 2, 0);
  b.grove(rng, flip ? bx + 1 : bx + bw - 3, pr + 1, 1, ["si-tree-young", "si-tree-round"]);
  b.prop("si-signpost", flip ? ax + 1 : ax + aw - 2, pr - 2, 0);
  b.lampNear(flip ? ax + 1 : ax + aw - 3, pr);
  if (placed[0]) b.lampNear(placed[0].access[0]!.x, pr);
  b.fillEmpty(rng, 8);
  b.edgeAccents(rng);
  void H;
  return { x: px0 + 2, y: pr };
}

// ═══════════════════════ 신전 ═══════════════════════
function composeShrine(b: Board, rng: () => number): SkyCell {
  const { W, H } = b;
  // 신전 섬(위 가운데) + 남쪽 참배 섬(밧줄 다리) + 옆 정원 섬(돌 아치 다리, 광장 옆으로 바로 이어진다)
  const side: "w" | "e" = rng() < 0.5 ? "w" : "e";
  const sw = Math.min(W - 24, 22), sh = 17;
  const ow = 8, oh = 7, sgap = 4;
  const sx = side === "w" ? Math.max(1 + ow + sgap, Math.floor((W - sw) / 2)) : Math.min(W - 2 - ow - sgap - sw, Math.floor((W - sw) / 2));
  const sy = 2;
  const cx = sx + Math.floor(sw / 2);
  b.island(cutTop({ x: sx, y: sy, w: sw, h: sh }, side === "w" ? "e" : "w", 3, 2), "gs", [cx]);
  const gw = 11, gh = 6, gx = cx - Math.floor(gw / 2), gy = sy + sh + 9;
  if (gy + gh + 4 >= H) throw new Error("신전 맵이 낮다 — 높이를 늘린다");
  b.island([{ x: gx, y: gy, w: gw, h: gh }], "gs");
  // 신전(북쪽 가운데) → 앞 광장(테두리 포석) → 참배길
  const shrineKit = b.kitOf("si-shrine");
  const shrine = b.building("si-shrine", cx - Math.floor(shrineKit.width / 2), sy + 1, 1);
  if (!shrine) throw new Error("신전 자리가 없다");
  const a = shrine.access[0]!;
  const pw = 9, ph = 4;
  // 문 앞 접근칸 아래 한 칸은 예약(소품 금지)이지만 포석은 깔아도 된다 — 잠깐 풀었다가 다시 예약한다.
  const below = b.k(a.x, a.y + 1); b.reserved[below] = false;
  if (!b.patch("plaza", { x: a.x - 4, y: a.y + 1, w: pw, h: ph }, "plaza")) b.notes.push("신전 앞 광장 자리가 없다");
  b.reserved[below] = true;
  b.vpath(a.x, a.y + ph + 1, sy + sh - 2);
  b.zones.push({ name: "참배길", use: "path", rect: { x: a.x, y: a.y + ph + 1, w: 1, h: sy + sh - 2 - (a.y + ph) } });
  // 옆 정원 섬 + 돌다리(광장 가운데 줄로 바로 — QA D18)
  const by = a.y + 2;
  const oy = by - 3;
  const ox = side === "w" ? sx - sgap - ow : sx + sw + sgap;
  b.island([{ x: ox, y: oy, w: ow, h: oh }], "gs");
  b.stoneH(side === "w" ? ox + ow - 1 : sx + sw - 1, side === "w" ? sx : ox, by);
  b.hpath(side === "w" ? sx + 1 : a.x + 5, side === "w" ? a.x - 5 : sx + sw - 2, by);
  // 광장: 축을 비우고 짝으로 — 수정 기둥 둘(뒤), 석상 둘(앞)
  b.prop("si-crystal-pylon", a.x - 3, a.y + 1, 0, ["plaza"], ["plaza"]); b.prop("si-crystal-pylon", a.x + 3, a.y + 1, 0, ["plaza"], ["plaza"]);
  b.prop("si-statue", a.x - 3, a.y + 3, 0, ["plaza"], ["plaza"]); b.prop("si-statue", a.x + 3, a.y + 3, 0, ["plaza"], ["plaza"]);
  b.prop("si-banner", shrine.rect.x - 2, shrine.rect.y + shrine.rect.h - 3, 0); b.prop("si-banner", shrine.rect.x + shrine.rect.w + 1, shrine.rect.y + shrine.rect.h - 3, 0);
  // 참배길: 비석 한 쌍 → 등불 한 쌍
  const py = a.y + ph + 1;
  b.prop("si-stele", a.x - 1, py, 0); b.prop("si-stele", a.x + 1, py, 0);
  b.prop("si-lamppost", a.x - 1, py + 2, 0); b.prop("si-lamppost", a.x + 1, py + 2, 0);
  // 샘(정원 섬 반대쪽, 섬 끝 가까이)
  b.spring(side === "w" ? sx + sw - 4 : sx + 3, a.y + 5);
  // 꽃나무숲: 신전 뒤 두 덩이 + 참배길 옆 두 덩이(대칭 모서리 대신 엇갈림 — QA D22)
  b.grove(rng, side === "w" ? sx + 2 : sx + 3, sy + 1, 2, ["si-tree-blossom", "si-tree-blossom", "si-tree-round"]);
  b.grove(rng, side === "w" ? sx + sw - 6 : sx + sw - 5, sy + 2, 2, ["si-tree-blossom", "si-tree-round"]);
  b.grove(rng, a.x - 7 + ri(rng, 0, 1), py, ri(rng, 2, 3), ["si-tree-blossom", "si-tree-blossom", "si-tree-pine"]);
  b.grove(rng, a.x + 4 + ri(rng, 0, 1), py + 1, 2, ["si-tree-blossom", "si-tree-round"]);
  // 남북 밧줄 다리 → 참배 섬: 깃발 한 쌍이 다리 머리를 지키고, 길 양옆 꽃밭·등불(동서 막다른 길 없음 — QA D19)
  b.ropeV(a.x, sy + sh - 1, gy);
  b.vpath(a.x, gy + 1, gy + gh - 2);
  b.prop("si-banner", a.x - 1, gy + 1, 0); b.prop("si-banner", a.x + 1, gy + 1, 0);
  b.prop("si-lamppost", gx + 2, gy + 2, 0); b.prop("si-lamppost", gx + gw - 3, gy + 2, 0);
  for (const fx of [gx + 1, gx + 3, gx + gw - 4, gx + gw - 2]) b.prop(fx % 2 ? "si-flowers-a" : "si-flowers-b", fx, gy + 4, 0);
  b.prop("si-bush-flower", gx + 1, gy + 2, 0); b.prop("si-bush-flower", gx + gw - 2, gy + 2, 0);
  // 정원 섬: 가운데 새 물그릇을 꽃이 두르고, 길 끝에 수정, 전망 벤치
  const end = side === "w" ? ox + 1 : ox + ow - 2;
  b.hpath(side === "w" ? ox + 2 : ox + 1, side === "w" ? ox + ow - 2 : ox + ow - 3, by);
  b.prop("si-crystal-cluster", end, by, 0) || b.prop("si-crystal-small", end, by, 0);
  const bxx = ox + 3;
  b.prop("si-birdbath", bxx, by - 2, 0);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [-1, -1], [1, -1]] as const) b.prop((dx + dy) % 2 ? "si-flowers-a" : "si-flowers-b", bxx + dx, by - 2 + dy, 0);
  b.prop("si-bench", ox + 3, by + 2, 0); b.prop("si-tree-blossom", side === "w" ? ox + 5 : ox + 1, by + 1, 0) || b.prop("si-bush-flower", ox + 1, by + 2, 0);
  b.fillEmpty(rng, 4, ["grove", "meadow", "grove"]);
  b.edgeAccents(rng);
  return { x: a.x, y: gy + gh - 2 };
}

// ═══════════════════════ 부두 ═══════════════════════
function composeDock(b: Board, rng: () => number): SkyCell {
  const { W, H } = b;
  const east = rng() < 0.5;                                  // 잔교·비공정이 동쪽(true) / 서쪽(false). 가게 섬은 반대쪽.
  const ship = b.kitOf("si-airship");
  const ww = 11, wh = 11, gap = 4;
  const aw = Math.min(28, W - 2 - ww - gap - (ship.width + 4)), ah = 15;   // QA D14: 섬을 부두 거리 크기로
  if (ah + 14 > H) throw new Error("부두 맵이 낮다 — 높이를 늘린다");
  const ax = east ? 1 + ww + gap : 1 + ship.width + 3, ay = 3;
  const wx = east ? 1 : ax + aw + gap, wy = ay + 2;
  b.island([...cutTop({ x: ax, y: ay, w: aw, h: ah }, east ? "w" : "e", 4, 2)], "gs");
  const pr = ay + 9;
  const bottomY = ay + ah - 1;
  b.hpath(ax + 1, ax + aw - 2, pr);
  b.zones.push({ name: "부두 길", use: "path", rect: { x: ax + 1, y: pr, w: aw - 2, h: 1 } });
  // 등대는 잔교 쪽 섬 끝, 관리소는 등대에서 두 칸 띄워(QA D16)
  const lh = b.kitOf("si-lighthouse"), dh = b.kitOf("si-dockhouse");
  const lhx = east ? ax + aw - lh.width - 1 : ax + 1;
  const light = b.building("si-lighthouse", lhx, pr - 1 - lh.height, 1);
  const dhx = east ? lhx - 3 - dh.width : lhx + lh.width + 3;
  const dock = b.building("si-dockhouse", dhx, pr - 1 - dh.height, 1);
  for (const bb of [dock, light]) if (bb) b.connect(bb);
  if (!light || !dock) b.notes.push("등대·관리소 자리가 모자라다");
  // 잔교: 섬 끝 세 칸, 풀 가장자리 줄부터(길과 같은 높이로 이어진다 — QA D11)
  const pierX = east ? ax + aw - 3 : ax;
  const rows = 6;
  b.vpath(pierX + 1, pr + 1, bottomY - 1);
  b.pier(pierX, bottomY, rows);
  // 비공정: 잔교 옆 하늘, 갑판 줄(키트 4번째 줄)에 건널판 한 칸(QA D12)
  const deckRow = bottomY + 3;
  const shipX = east ? pierX + 4 : pierX - 1 - ship.width;
  const shipY = deckRow - 3;
  const plankX = east ? pierX + 3 : pierX - 1;
  let shipOk = shipX >= 0 && shipX + ship.width <= W && shipY + ship.height <= H;
  for (let yy = shipY; yy < shipY + ship.height && shipOk; yy++) for (let xx = shipX; xx < shipX + ship.width; xx++) if (b.u(xx, yy) !== "sky") shipOk = false;
  if (shipOk && b.u(plankX, deckRow) === "sky") {
    b.stamp(ship, shipX, shipY, "prop"); b.props.push({ kit: "si-airship", x: shipX, y: shipY });
    b.setUpper(plankX, deckRow, "bridge-h", "bridge"); b.targets.push({ x: plankX, y: deckRow });
    b.zones.push({ name: "비공정 정박(건널판)", use: "airship", rect: { x: Math.min(shipX, plankX), y: shipY, w: ship.width + 1, h: ship.height } });
  } else b.notes.push("비공정 자리가 섬과 겹쳐 뺐다");
  b.prop("si-bollard", east ? pierX + 2 : pierX, deckRow - 1, 0, ["deck"], ["deck"]);
  b.prop("si-bollard", east ? pierX + 2 : pierX, deckRow + 1, 0, ["deck"], ["deck"]);
  b.prop("si-ropecoil", east ? pierX : pierX + 2, bottomY + 1, 0, ["deck"], ["deck"]);
  b.prop("si-windsock", east ? pierX - 1 : pierX + 3, bottomY - 2, 0) || b.prop("si-windsock", east ? pierX - 1 : pierX + 3, bottomY - 3, 0);
  b.lampNear(pierX + 1, bottomY);
  // 짐 마당: 잔교 머리 옆 포석 마당(테두리 없음), 짐은 마당 가장자리에 무더기로(QA D13)
  const yw = 7, yx = east ? pierX - 1 - yw : pierX + 4, yy = pr + 2;
  if (b.patch("plaza", { x: yx, y: yy, w: yw, h: 3 }, "plaza", false)) {
    b.zones.push({ name: "짐 마당", use: "yard", rect: { x: yx, y: yy, w: yw, h: 3 } });
    b.vpath(yx + Math.floor(yw / 2), pr + 1, yy - 1);
    b.hpath(east ? yx + yw : pierX + 2, east ? pierX : yx - 1, yy + 2);
    const far = east ? yx : yx + yw - 2;
    b.prop("si-crates", far, yy, 0, ["plaza"], ["plaza"]);
    b.prop("si-crate", east ? far + 2 : far - 1, yy, 0, ["plaza"], ["plaza"]);
    b.prop("si-barrel", east ? yx + yw - 1 : yx, yy, 0, ["plaza"], ["plaza"]);
    b.prop("si-barrel", east ? yx + yw - 2 : yx + 1, yy, 0, ["plaza"], ["plaza"]);
    b.prop("si-cart", east ? yx - 3 : yx + yw + 1, yy, 0) || b.prop("si-cart", east ? yx - 3 : yx + yw + 1, yy + 1, 0);
  }
  b.prop("si-wind-turbine", east ? ax + 2 : ax + aw - 4, ay + 1, 1);
  // 가게 섬: 밧줄 다리 + 집 + 노점(가게 간판 대신 노점 차양) + 짐, 길은 문에서 끝난다(QA D17)
  b.island([{ x: wx, y: wy, w: ww, h: wh }], "gs");
  const landing = east ? wx + ww - 1 : wx;
  b.ropeH(east ? landing : ax + aw - 1, east ? ax : landing, pr);
  const house = b.building(pick(rng, ["si-cottage-blue", "si-cottage-red"]), east ? wx + 1 : wx + ww - 6, pr - 6, 0);
  if (house) {
    const door = house.access[0]!;
    b.hpath(Math.min(door.x, east ? landing - 1 : landing + 1), Math.max(door.x, east ? landing - 1 : landing + 1), pr);
    b.connect(house);
    b.prop("si-stall", east ? wx + 7 : wx + 1, pr - 4, 0);
    b.prop("si-barrel", east ? wx + 7 : wx + 3, pr + 1, 0); b.prop("si-crate", east ? wx + 8 : wx + 2, pr + 1, 0);
  } else b.notes.push("가게 섬 집 자리가 없다");
  b.lampNear(east ? landing - 1 : landing + 1, pr);
  b.lampNear(east ? ax + 1 : ax + aw - 2, pr);
  b.grove(rng, east ? wx + 2 : wx + ww - 4, pr + 2, 1, ["si-tree-young", "si-tree-round"]);
  b.grove(rng, ax + Math.floor(aw / 2) - 2 + ri(rng, -2, 2), ay, 2, ["si-tree-pine", "si-tree-round"]);
  b.fillEmpty(rng, 5, ["grove", "meadow", "rocks"]);
  b.edgeAccents(rng);
  return { x: ax + Math.floor(aw / 2), y: pr };
}

// ═══════════════════════ 섬 사슬 ═══════════════════════
function composeArchipelago(b: Board, rng: () => number): SkyCell {
  const { W, H } = b;
  // 섬 넷, 크기·높이를 엇갈린다(QA D26): 북서 집 섬 · 북동 풍차 밭 섬 · 남서 장터 섬 · 남동 천문대 정원 섬.
  const A = { x: 2, y: 2, w: 19 + ri(rng, 0, 3), h: 12 };
  const Bx = A.x + A.w + 5 + ri(rng, 0, 1);
  const B = { x: Bx, y: 3, w: W - 2 - Bx, h: 11 };
  const C = { x: 3 + ri(rng, 0, 2), y: A.y + A.h + 8, w: 17, h: 11 };
  const Dx = C.x + C.w + 6;
  const D = { x: Dx, y: B.y + B.h + 8 + ri(rng, 0, 1), w: W - 2 - Dx, h: 11 };
  if (B.w < 16 || D.w < 14) throw new Error("섬 사슬 맵이 좁다 — 폭을 늘린다");
  if (D.y + D.h + 6 > H || C.y + C.h + 5 > H) throw new Error("섬 사슬 맵이 낮다 — 높이를 늘린다");
  const rab = A.y + 9;                                       // 북쪽 두 섬의 큰길 = 동서 다리 줄
  const cr = D.y + 8;                                        // 남쪽 두 섬의 큰길 = 돌다리 줄
  if (cr < C.y + 2 || cr > C.y + C.h - 2) throw new Error("섬 사슬 남쪽 길 줄이 맞지 않는다");
  const xac = Math.max(A.x + 3, Math.min(A.x + A.w - 4, C.x + 3 + ri(rng, 0, 4)));
  const xbd = Math.max(Math.max(B.x, D.x) + 3, Math.min(Math.min(B.x + B.w, D.x + D.w) - 4, D.x + D.w - 6 - ri(rng, 0, 3)));
  b.island(cutTop(A, "w", 3, 2), "gs", [xac]); b.island(cutTop(B, "e", 3, 2), "gs", [xbd]); b.island([C], "gs"); b.island(cutTop(D, "e", 2, 1), "gs");
  // 길망(먼저 깔아 다리 머리·접근을 예약한다 — QA D27·D28)
  b.hpath(A.x + 1, A.x + A.w - 1, rab); b.hpath(B.x, B.x + B.w - 2, rab);
  b.ropeH(A.x + A.w - 1, B.x, rab);
  b.vpath(xac, rab + 1, A.y + A.h - 2); b.ropeV(xac, A.y + A.h - 1, C.y); b.vpath(xac, C.y + 1, cr);
  b.vpath(xbd, rab + 1, B.y + B.h - 2); b.ropeV(xbd, B.y + B.h - 1, D.y); b.vpath(xbd, D.y + 1, cr);
  b.hpath(C.x + 1, C.x + C.w - 1, cr); b.hpath(D.x, D.x + D.w - 2, cr);
  b.stoneH(C.x + C.w - 1, D.x, cr);
  for (const [x, y] of [[xac, C.y + 1], [xac, C.y + 2], [xbd, D.y + 1], [xbd, D.y + 2], [A.x + A.w - 2, rab], [B.x + 1, rab]] as const) b.reserve({ x, y, w: 1, h: 1 });
  // A: 집 둘(엇갈린 발 줄)
  const homes = [pick(rng, ["si-cottage-red", "si-cottage-blue"]), "si-tower-house"];
  let hx = A.x + 2;
  for (const id of homes) {
    const kit = b.kitOf(id);
    for (let dx = 0; dx < 6; dx++) { if (Math.abs(hx + dx + 1 - xac) <= 1) continue; const bb = b.building(id, hx + dx, rab - 1 - (rng() < 0.4 ? 1 : 0) - kit.height, 1) ?? b.building(id, hx + dx, rab - 1 - kit.height, 1); if (bb) { b.connect(bb); hx = hx + dx + kit.width + 3; break; } }
  }
  b.lampNear(A.x + A.w - 3, rab);
  // B: 풍차 + 울타리 밭(문은 남쪽, 길에서 바로)
  const mill = b.building("si-windmill", B.x + 2, rab - 1 - 7, 1);
  if (mill) b.connect(mill);
  const fw = Math.min(7, B.w - 12), field = { x: B.x + 9, y: B.y + 3, w: fw, h: 3 };
  if (fw >= 4 && b.patch("field", field, "field")) {
    const gateX = field.x + Math.floor(fw / 2);
    for (let yy = field.y; yy < field.y + field.h; yy++) for (let xx = field.x; xx < field.x + fw; xx++) b.prop(yy === field.y + 1 ? "si-crop-cabbage" : "si-crop-wheat", xx, yy, 0, ["field"], ["field"]);
    b.fenceAround(field, gateX, "s");
    const fy = field.y + field.h;
    b.vpath(gateX, fy, rab - 1);
    b.prop("si-haybale", field.x + fw + 1, fy, 0) || b.prop("si-haybale", field.x - 2, fy, 0);
    b.zones.push({ name: "밭", use: "field", rect: field });
  }
  b.lampNear(B.x + 1, rab);
  // C: 장터(포석 + 우물 + 노점) + 집 하나
  const left = xac > C.x + C.w / 2;
  const mx = left ? C.x + 1 : C.x + C.w - 8;
  if (b.patch("plaza", { x: mx, y: cr - 4, w: 7, h: 3 }, "plaza", false)) {
    b.vpath(mx + 3, cr - 1, cr - 1);
    b.prop("si-well", left ? mx + 1 : mx + 4, cr - 4, 0, ["plaza"], ["plaza"]);
    b.prop("si-stall", left ? mx + 4 : mx, cr - 4, 0, ["plaza"], ["plaza"]) || b.prop("si-barrel", mx + 5, cr - 4, 0, ["plaza"], ["plaza"]);
    b.zones.push({ name: "장터", use: "market", rect: { x: mx, y: cr - 4, w: 7, h: 3 } });
  }
  b.prop("si-bench", left ? C.x + C.w - 5 : C.x + 2, cr + 1, 0);
  b.lampNear(C.x + C.w - 2, cr);
  // D: 천문대 + 수정 정원(다리 쪽 반대편)
  const obsX = xbd < D.x + D.w / 2 ? D.x + D.w - 8 : D.x + 2;
  const obs = b.building("si-observatory", obsX, cr - 7, 1);
  if (obs) b.connect(obs);
  b.prop("si-crystal-pylon", obs ? (obsX > D.x + 3 ? obsX - 2 : obsX + 6) : D.x + 2, cr - 3, 0);
  b.prop("si-crystal-cluster", D.x + 1, cr - 2, 0) || b.prop("si-crystal-small", D.x + 2, cr + 1, 0);
  b.lampNear(D.x + 1, cr);
  b.fillEmpty(rng, 8, ["grove", "meadow", "grove", "rocks"]);
  b.edgeAccents(rng);
  return { x: A.x + 3, y: rab };
}

// ═══════════════════════ 실내 방 ═══════════════════════
type Furn = (b: Board, x0: number, y0: number, w: number, h: number, rng: () => number) => void;
const F: readonly Use[] = ["floor"], FW: readonly Use[] = ["floor", "wall"];
const ROOM: Readonly<Record<SkyRoomStyle, { w: number; h: number; floor: string; wall: string; win: [string, string | null][]; furn: Furn }>> = {
  cottage: {
    // QA D33·D34: 난로는 벽에 붙이고(벽 아랫줄과 겹침), 방을 줄여 부엌·식탁 구역을 둔다.
    w: 9, h: 7, floor: "floor-wood", wall: "plaster", win: [["wall-plaster-win", "wall-plaster-low-win"], ["wall-plaster-win", "wall-plaster-low-win"]],
    furn: (b, x0, y0, w, h, rng) => {
      const cx = x0 + Math.floor(w / 2);
      b.prop("si-hearth", cx - 1, y0 - 1, 0, F, FW);
      b.prop("si-rug", cx - 1, y0 + 1, 0, F, F);
      b.prop("si-bed", x0, y0 - 1, 0, F, FW) || b.prop("si-bed", x0, y0, 0, F, FW);
      b.prop("si-cupboard", x0 + 1, y0 - 1, 0, F, FW);
      b.prop("si-wardrobe", x0 + w - 2, y0 - 1, 0, F, FW);
      const east = rng() < 0.5;
      b.prop("si-table", east ? x0 + w - 3 : x0 + 1, y0 + 3, 0, F, F);
      b.prop("si-chair", east ? x0 + w - 4 : x0 + 3, y0 + 3, 0, F); b.prop("si-chair", east ? x0 + w - 1 : x0, y0 + 3, 0, F);
      b.prop("si-basin", east ? x0 : x0 + w - 1, y0 + h - 2, 0, F); b.prop("si-chest", east ? x0 : x0 + w - 1, y0 + 2, 0, F);
      b.prop("si-plant", east ? x0 + w - 1 : x0, y0 + h - 1, 0, F);
    },
  },
  shrine: {
    w: 11, h: 10, floor: "floor-stone", wall: "stone", win: [["wall-stone-arch", null], ["banner-wall", null], ["wall-stone-arch", null]],
    furn: (b, x0, y0, w, h) => {
      const cx = x0 + Math.floor(w / 2);
      b.prop("si-altar", cx - 1, y0 - 1, 0, F, FW);
      for (let y = y0 + 3; y < y0 + h; y += 2) b.prop("si-rug-long", cx, y, 0, ["floor", "deck"], ["floor", "deck"]);
      b.prop("si-offering", cx, y0 + 1, 0, ["floor", "deck"]);
      b.prop("si-cushion", cx - 2, y0 + 2, 0, F); b.prop("si-cushion", cx + 2, y0 + 2, 0, F);
      b.prop("si-incense", cx - 3, y0, 0, F); b.prop("si-incense", cx + 3, y0, 0, F);
      for (const y of [y0 + 3, y0 + 6]) { b.prop("si-lantern-floor", cx - 3, y, 0, F, F); b.prop("si-lantern-floor", cx + 3, y, 0, F, F); }
      b.prop("si-plant", x0, y0 + h - 1, 0, F); b.prop("si-plant", x0 + w - 1, y0 + h - 1, 0, F);
      b.prop("si-statue", x0, y0 - 1, 0, F, FW); b.prop("si-statue", x0 + w - 1, y0 - 1, 0, F, FW);
      b.prop("si-bookshelf", x0 + 1, y0 - 1, 0, F, FW); b.prop("si-chest", x0 + w - 2, y0, 0, F);
    },
  },
  cabin: {
    // QA D35·D36: 타륜은 앞벽 창 아래, 해도 탁자는 옆, 해먹 대신 벽 침상, 짐은 구석에 무더기.
    w: 9, h: 6, floor: "floor-deck", wall: "wood", win: [["wall-wood-port", null], ["wall-wood-port", null], ["wall-wood-port", null]],
    furn: (b, x0, y0, w, h) => {
      const cx = x0 + Math.floor(w / 2);
      b.prop("si-helm", cx, y0 - 1, 0, F, FW);
      b.prop("si-chart-table", cx + 2, y0 + 1, 0, F);
      b.prop("si-bed", x0, y0 - 1, 0, F, FW); b.prop("si-bed", x0, y0 + 2, 0, F);
      b.prop("si-lamp", x0 + 1, y0 - 1, 0, F, FW);
      b.prop("si-chest", x0 + w - 1, y0, 0, F);
      b.prop("si-barrel", x0 + w - 1, y0 + h - 1, 0, F); b.prop("si-crate", x0 + w - 2, y0 + h - 1, 0, F); b.prop("si-barrel", x0 + w - 1, y0 + h - 2, 0, F);
      b.prop("si-stool", cx + 1, y0 + 2, 0, F);
    },
  },
  observatory: {
    // QA D37·D38: 바닥은 별 벽과 다른 나무, 망원경은 가운데 앞벽, 책상·지구본은 벽 쪽.
    w: 11, h: 8, floor: "floor-wood", wall: "star", win: [["wall-star-sky", null], ["wall-star-sky", null]],
    furn: (b, x0, y0, w, h) => {
      const cx = x0 + Math.floor(w / 2);
      b.prop("si-telescope", cx - 1, y0 - 1, 0, F, FW);
      b.prop("si-bookshelf", x0, y0 - 1, 0, F, FW); b.prop("si-bookshelf", x0 + 1, y0 - 1, 0, F, FW);
      b.prop("si-globe", x0 + 2, y0, 0, F);
      b.prop("si-orrery", x0 + w - 2, y0 - 1, 0, F, FW); b.prop("si-ladder", x0 + w - 1, y0 - 1, 0, F, FW);
      b.prop("si-desk", x0 + w - 2, y0 + 3, 0, F); b.prop("si-chair", x0 + w - 3, y0 + 3, 0, F);
      b.prop("si-rug", cx - 1, y0 + 3, 0, F, F);
      b.prop("si-lamp", x0, y0 + 3, 0, F, F); b.prop("si-chest", x0, y0 + h - 1, 0, F); b.prop("si-plant", x0 + w - 1, y0 + h - 1, 0, F);
    },
  },
};

function composeRoom(b: Board, style: SkyRoomStyle, rng: () => number): { start: SkyCell; exits: SkyCell[] } {
  const R = ROOM[style];
  const w = R.w, h = R.h;
  // 방 바닥 사각형(x0..x0+w-1, y0..y0+h-1), 북벽 두 줄 y0-2·y0-1, 남벽 윗면 y0+h, 옆 테 x0-1·x0+w
  const x0 = Math.floor((b.W - w) / 2), y0 = Math.max(3, Math.floor((b.H - h - 3) / 2) + 2);
  const wallUp = `wall-${R.wall}`, wallLo = `wall-${R.wall}-low`;
  const winX = R.win.length === 2 ? [x0 + 2, x0 + w - 3] : [x0 + 2, x0 + Math.floor(w / 2), x0 + w - 3];
  for (let x = x0; x < x0 + w; x++) {
    const wi = winX.indexOf(x);
    const [up, lo] = wi >= 0 ? R.win[wi]! : [wallUp, null];
    const upIsWall = up.startsWith("wall-");
    b.setLower(x, y0 - 2, upIsWall ? up : wallUp, "wall");
    if (!upIsWall) { const kit = b.pal.kit(`si-${up}`); if (kit) b.stamp(kit, x, y0 - 2, "wall"); }
    b.setLower(x, y0 - 1, lo ?? wallLo, "wall");
    for (let y = y0; y < y0 + h; y++) b.setLower(x, y, R.floor, "floor");
    b.setLower(x, y0 + h, "void-s", "void");
  }
  for (let y = y0 - 2; y < y0 + h; y++) { b.setLower(x0 - 1, y, "void-w", "void"); b.setLower(x0 + w, y, "void-e", "void"); }
  b.setLower(x0 - 1, y0 + h, "void-sw", "void"); b.setLower(x0 + w, y0 + h, "void-se", "void");
  const ex = x0 + Math.floor(w / 2);
  b.setLower(ex, y0 + h, "exit-mat", "floor");
  // 나가는 길(문 깔개에서 북쪽 두 칸)은 비운다
  b.reserve({ x: ex, y: y0 + h - 2, w: 1, h: 3 });
  R.furn(b, x0, y0, w, h, rng);
  b.zones.push({ name: `${style} 방`, use: "room", rect: { x: x0, y: y0, w, h } });
  b.targets.push({ x: ex, y: y0 + h });
  return { start: { x: ex, y: y0 + h - 1 }, exits: [{ x: ex, y: y0 + h }] };
}

/** 한 장을 짠다. 칸이 모자라면 Error(호출자가 ToolError 로 바꾼다). */
export function composeSkyIsland(spec: SkySpec, pal: SkyPalette): SkyResult {
  const min = SKY_MIN_SIZE[spec.style];
  if (!min) throw new Error(`모르는 style ${spec.style}`);
  if (spec.width < min.w || spec.height < min.h) throw new Error(`맵이 작다(${spec.width}×${spec.height}) — ${spec.style} 는 ${min.w}×${min.h} 이상이어야 한다`);
  const seed = (spec.seed ?? 0) >>> 0;
  const room = spec.style.startsWith("room-") ? spec.style.slice(5) as SkyRoomStyle : null;
  const rng = mulberry(seed * 7919 + spec.style.length * 131 + 17);
  const b = new Board(spec.width, spec.height, pal, seed, room ? "void" : "sky", room ? "void" : "sky");
  let start: SkyCell, exits: SkyCell[] = [];
  if (room) { const r = composeRoom(b, room, rng); start = r.start; exits = r.exits; }
  else {
    start = spec.style === "village" ? composeVillage(b, rng) : spec.style === "shrine" ? composeShrine(b, rng) : spec.style === "dock" ? composeDock(b, rng) : composeArchipelago(b, rng);
    b.skyDecor(rng);
    b.groundVariety();
  }
  // 도달 검사: 시작 칸에서 모든 문 접근칸·다리 끝·출구에 닿아야 한다
  const seen = b.reach(start);
  if (!seen.size) throw new Error(`시작 칸 (${start.x},${start.y}) 이 막혔다`);
  const miss = b.targets.filter((c) => !seen.has(b.k(c.x, c.y)));
  if (miss.length) throw new Error(`닿지 못한 칸 ${miss.slice(0, 4).map((c) => `(${c.x},${c.y})`).join(" ")} — seed 를 바꾼다`);
  // 걸을 수 있는데 닿지 못하는 바닥(가구·소품에 갇힌 칸) — 실내는 0 이어야 하고, 야외는 노트로 남긴다.
  let pocket = 0;
  for (let y = 0; y < b.H; y++) for (let x = 0; x < b.W; x++) if (b.walk(x, y) && !seen.has(b.k(x, y))) pocket++;
  if (pocket && room) throw new Error(`방 바닥 ${pocket}칸이 출구에서 닿지 않는다 — 가구 배치를 바꾼다`);
  if (pocket) b.notes.push(`닿지 않는 걷는 칸 ${pocket}`);
  return { lower: b.lower, upper: b.upper, buildings: b.buildings, bridges: b.bridges, start, exits, props: b.props, zones: b.zones.map((z) => ({ ...z, rect: { ...z.rect } })), notes: b.notes };
}

/** 번들 정의(TilesetDef 모양)에서 사전을 만든다: 한 칸 조각은 그룹 `si:si-<조각 id>`, 키트는 structureKits(출입구 부품). */
export function skyPaletteFromTileset(def: {
  readonly tileGroups?: readonly { readonly id: string; readonly tileIds: readonly number[] }[];
  readonly structureKits?: readonly unknown[];
  readonly passability?: readonly { readonly up?: boolean; readonly down?: boolean; readonly left?: boolean; readonly right?: boolean }[];
  readonly tileMeta?: readonly ({ readonly passage?: string } | null | undefined)[];
}): SkyPalette {
  const groups = new Map((def.tileGroups ?? []).map((g) => [g.id, g.tileIds] as const));
  const kits = new Map<string, SkyKit>();
  for (const raw of def.structureKits ?? []) {
    const k = raw as { id: string; width: number; height: number; rows: SkyKit["rows"]; parts?: { kind: string; dx: number; w: number }[] };
    if (!k?.id || !Array.isArray(k.rows)) continue;
    const part = k.parts?.find((p) => p.kind === "entrance");
    kits.set(k.id, { id: k.id, width: k.width, height: k.height, rows: k.rows, door: part ? { dx: part.dx, w: part.w } : undefined });
  }
  // 한 칸 소품(꽃·방석·밧줄 뭉치…)은 키트가 아니라 그룹이다 — 1×1 키트로 감싼다(층은 칸 정의의 defaultLayer).
  const single = (id: string): SkyKit | undefined => {
    const t = groups.get(`si:${id}`)?.[0];
    if (t === undefined) return undefined;
    const upper = (def.tileMeta?.[t] as { defaultLayer?: string } | null | undefined)?.defaultLayer === "upper";
    return { id, width: 1, height: 1, rows: [upper ? { tiles: [-1], upperTiles: [t] } : { tiles: [t] }] };
  };
  return {
    tile: (piece) => groups.get(`si:si-${piece.replace(/^si-/, "")}`)?.[0] ?? -1,
    kit: (id) => { const k = id.startsWith("si-") ? id : `si-${id}`; return kits.get(k) ?? single(k); },
    pass: (t) => {
      if (def.tileMeta?.[t]?.passage === "star") return "star";
      const p = def.passability?.[t];
      return p && (p.up || p.down || p.left || p.right) ? "walk" : "block";
    },
  };
}
