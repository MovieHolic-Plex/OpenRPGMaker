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
  village: { w: 44, h: 32 }, shrine: { w: 44, h: 40 }, dock: { w: 48, h: 30 }, archipelago: { w: 48, h: 40 },
  "room-cottage": { w: 13, h: 13 }, "room-shrine": { w: 13, h: 14 }, "room-cabin": { w: 12, h: 11 }, "room-observatory": { w: 13, h: 13 },
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
  island(rects: readonly Rect[], mat: "gs" | "cs"): Set<number> {
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
      const dmax = Math.min(6, 2 + Math.floor(Wd / 3));
      const tgt = run.map((_, i) => 2 + (dmax - 2) * Math.pow(Math.sin(Math.PI * (i + 0.5) / Wd), 0.8) + (hash2(i, y0, this.seed + 1) - 0.5) * 1.2);
      const L = new Array(Wd).fill(2), Rr = new Array(Wd).fill(2);
      for (let i = 1; i < Wd; i++) L[i] = L[i - 1] + (tgt[i]! > L[i - 1] + 0.4 ? 1 : 0);
      for (let i = Wd - 2; i >= 0; i--) Rr[i] = Rr[i + 1] + (tgt[i]! > Rr[i + 1] + 0.4 ? 1 : 0);
      const d = L.map((v, i) => Math.min(v, Rr[i]));
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
  patch(base: "plaza" | "field", r: Rect, use: Use): boolean {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { const u = this.u(x, y); if (u !== "grass" && u !== "path") return false; }
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      const kk = (y === r.y ? "n" : y === r.y + r.h - 1 ? "s" : "") + (x === r.x ? "w" : x === r.x + r.w - 1 ? "e" : "");
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
  /** 남은 빈 풀 덩이(5×4 + 둘레 1칸)에 쓰임을 준다 — 나무 덩이, 쉼터(벤치 + 꽃), 수정 바위. 자리는 전부 훑되 순서는 씨앗으로 섞는다. */
  fillEmpty(rng: () => number, max: number, kinds: readonly ("grove" | "rest" | "rocks")[] = ["grove", "grove", "rest", "grove", "rocks"]): number {
    const spots: SkyCell[] = [];
    for (let y = 1; y < this.H - 4; y++) for (let x = 1; x < this.W - 5; x++) spots.push({ x, y });
    for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [spots[i], spots[j]] = [spots[j]!, spots[i]!]; }
    let n = 0;
    for (const { x, y } of spots) {
      if (n >= max) break;
      if (!this.emptyBlock(x, y, 5, 4)) continue;
      const kind = kinds[n % kinds.length]!;
      if (kind === "grove") {
        if (!this.prop(pick(rng, ["si-tree-round", "si-tree-round", "si-tree-pine", "si-tree-blossom"]), x + 1, y, 0)) continue;
        this.prop(pick(rng, ["si-bush", "si-bush-flower"]), x + 3, y + 2, 0) || this.prop("si-tree-young", x + 3, y + 1, 0);
        if (rng() < 0.7) this.prop("si-tallgrass", x, y + 3, 0);
        if (rng() < 0.5) this.prop(pick(rng, ["si-tree-young", "si-flowers-a"]), x + 4, y + 3, 0);
        this.zones.push({ name: "나무 덩이", use: "grove", rect: { x, y, w: 5, h: 4 } });
      } else if (kind === "rest") {
        if (!this.prop("si-bench", x + 1, y + 2, 0)) continue;
        this.prop("si-tree-young", x + 1, y, 0) || this.prop("si-bush-flower", x + 1, y + 1, 0);
        this.prop("si-flowers-a", x, y + 3, 0); this.prop("si-flowers-b", x + 3, y + 3, 0); this.prop("si-lamppost", x + 4, y + 1, 0);
        this.zones.push({ name: "쉼터", use: "rest", rect: { x, y, w: 5, h: 4 } });
      } else {
        if (!this.prop("si-rock-big", x + 1, y + 1, 0)) continue;
        this.prop("si-crystal-small", x + 3, y + 2, 0); this.prop("si-crystal-cluster", x, y, 0); this.prop("si-tallgrass", x + 4, y + 3, 0);
        this.zones.push({ name: "수정 바위", use: "rocks", rect: { x, y, w: 5, h: 4 } });
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
      if (!nearEdge || hash2(x, y, this.seed + 41) > 0.12) continue;
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
      else if (r > 0.985 && this.pal.kit("si-chain-hang")) {
        let ok = true; for (let j = 1; j < 3; j++) { const u = this.u(x, y + j); if ((u !== "under" && u !== "sky") || this.upper[this.k(x, y + j)]! >= 0) ok = false; }
        if (ok) { this.stamp(this.kitOf("si-chain-hang"), x, y, "under"); this.props.push({ kit: "si-chain-hang", x, y }); }
      }
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
  /** 샘: (x-1..x+1, y..y+1) 연못에서 시내가 남쪽 섬 끝까지 흘러 폭포로 떨어진다. 연못 자리가 없으면 아래로 내려가며 찾는다. */
  spring(x: number, y: number): boolean {
    for (let yy = y; yy < this.H - 4; yy++) {
      if (!this.prop("si-pond", x - 1, yy, 0)) continue;
      if (this.stream(x, yy + 2)) return true;
      this.notes.push("시내가 섬 끝에 닿지 못했다");
      return false;
    }
    return false;
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
  const flip = rng() < 0.5;                                // 작은 섬이 동쪽(false) / 서쪽(true)
  const bw = 9, gap = 4;
  const ah = Math.min(H - 12, 19 + ri(rng, 0, 2));
  const aw = W - 4 - bw - gap;
  const ax = flip ? 2 + bw + gap : 2, ay = 3;
  const body = cutTop({ x: ax, y: ay, w: aw, h: ah }, flip ? "e" : "w", ri(rng, 3, 5), ri(rng, 2, 3));
  b.island([...body, ...isleRects(rng, ax + 4, ay, aw - 8, ah, 2).slice(1)], "gs");
  const bx = flip ? 2 : ax + aw + gap, by = ay + 4 + ri(rng, 0, 2), bh = Math.min(9, ah - 6);
  b.island([{ x: bx, y: by, w: bw, h: bh }], "gs");
  // 큰길(동서) — 섬 높이 45% 줄. 집 줄 뒤(북쪽)에 나무 한 줄 들어갈 3줄을 남긴다.
  const pr = ay + 9;
  const px0 = ax + 1, px1 = ax + aw - 2;
  b.hpath(px0, px1, pr);
  b.zones.push({ name: "큰길", use: "path", rect: { x: px0, y: pr, w: px1 - px0 + 1, h: 1 } });
  // 길 북쪽 집 줄: 발 줄 = pr-2 (접근칸 pr-1 → 큰길)
  const pool = ["si-cottage-red", "si-cottage-blue", "si-tower-house"];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j]!, pool[i]!]; }
  const houses = [pool[0]!, "si-windmill", pool[1]!, pool[2]!];
  // 풍차는 밭 쪽 끝(작은 섬 반대쪽)
  const order = flip ? [houses[1]!, houses[0]!, houses[2]!, houses[3]!] : [houses[3]!, houses[0]!, houses[2]!, houses[1]!];
  let x = px0 + 1;
  const placed: SkyBuilding[] = [];
  for (const id of order) {
    const kit = b.pal.kit(id); if (!kit) continue;
    let done = false;
    for (let dx = 0; dx < 4 && !done; dx++) {
      const bb = b.building(id, x + dx, pr - 1 - kit.height, 1);
      if (bb) { placed.push(bb); x = x + dx + kit.width + ri(rng, 2, 3); done = true; }
    }
    if (!done) b.notes.push(`${BUILDING_NAME[id] ?? id} 자리가 없어 뺐다`);
    if (x > px1 - 3) break;
  }
  for (const bb of placed) b.connect(bb);
  // 길 남쪽: 광장(우물·노점) · 밭(작물·울타리·건초) — 풍차 쪽에 밭
  const mill = placed.find((p) => p.kit === "si-windmill");
  const southTop = pr + 2, southH = ay + ah - 1 - southTop - 1;   // 가장자리 줄 위까지
  const pw = 7, ph = Math.min(5, southH);
  const fw = 7, fh = Math.min(4, southH - 1);
  const millX = mill ? mill.rect.x : (flip ? px0 + 2 : px1 - 9);
  const fieldX = Math.max(px0 + 1, Math.min(px1 - fw - 1, millX - 1));
  const plazaX = flip ? Math.min(px1 - pw - 2, fieldX + fw + 4) : Math.max(px0 + 2, fieldX - pw - 4);
  if (b.patch("plaza", { x: plazaX, y: southTop, w: pw, h: ph }, "plaza")) {
    b.vpath(plazaX + 3, pr + 1, southTop - 1);
    b.prop("si-well", plazaX + 2, southTop + 1, 0, ["plaza"], ["plaza"]);
    b.prop("si-stall", plazaX + pw + 1, southTop, 1);
    b.prop("si-bench", plazaX + 1, southTop + ph, 0) || b.prop("si-bench", plazaX + 4, southTop + ph, 0);
    b.prop("si-barrel", plazaX + pw - 1, southTop + 1, 0, ["plaza"], ["plaza"]);
  } else b.notes.push("광장 자리가 없어 뺐다");
  if (fh >= 3 && b.patch("field", { x: fieldX, y: southTop + 1, w: fw, h: fh }, "field")) {
    for (let yy = southTop + 2; yy < southTop + fh; yy++) for (let xx = fieldX + 1; xx < fieldX + fw - 1; xx++) b.prop(yy === southTop + 2 ? "si-crop-wheat" : "si-crop-cabbage", xx, yy, 0, ["field"], ["field"]);
    for (let xx = fieldX; xx < fieldX + fw; xx++) b.prop("si-fence-h", xx, southTop + fh + 1, 0);
    b.prop("si-haybale", flip ? fieldX - 2 : fieldX + fw + 1, southTop + 1, 0);
    b.vpath(fieldX + Math.floor(fw / 2), pr + 1, southTop);
  }
  // 시내 + 폭포: 광장과 밭 사이 빈 줄 하나(씨앗이 반이면)
  const sx = Math.floor((plazaX + pw / 2 + fieldX + fw / 2) / 2);
  if (rng() < 0.75) b.spring(sx, pr + 2);
  // 등불: 큰길 남쪽 줄 6칸마다
  const lampCells: SkyCell[] = [];
  for (let xx = px0 + 2; xx < px1; xx++) lampCells.push({ x: xx, y: pr + 2 });
  b.lamps(lampCells, 7);
  // 나무: 북쪽 가장자리 안쪽 · 남쪽 가장자리 안쪽
  b.treeLine(rng, ax + 1, ax + aw - 3, ay + 2, ["si-tree-round", "si-tree-pine", "si-tree-round"], 4, 0);
  // 작은 섬: 다리 + 등대·천문대·돌탑 집 중 하나 + 쉼터
  const bridgeY = pr;
  const aEdgeX = flip ? ax : ax + aw - 1, bEdgeX = flip ? bx + bw - 1 : bx;
  if (bridgeY > by && bridgeY < by + bh - 1) {
    b.ropeH(Math.min(aEdgeX, bEdgeX), Math.max(aEdgeX, bEdgeX), bridgeY);
    const bp0 = flip ? bx + 1 : bx + 1, bp1 = flip ? bx + bw - 2 : bx + bw - 2;
    b.hpath(bp0, bp1, bridgeY);
    const id = pick(rng, ["si-lighthouse", "si-observatory", "si-tower-house"]);
    const kit = b.pal.kit(id);
    if (kit) {
      const kx = bx + Math.floor((bw - kit.width) / 2);
      const bb = b.building(id, kx, bridgeY - 1 - kit.height, 0) ?? b.building(id, kx, bridgeY - kit.height, 0);
      if (bb) b.connect(bb); else b.notes.push("작은 섬 건물 자리가 없다");
    }
    b.prop("si-bench", bx + 1, bridgeY + 2, 0); b.prop("si-tree-young", bx + bw - 3, bridgeY + 1, 0); b.prop("si-flowers-b", bx + 4, bridgeY + 2, 0);
    b.prop("si-signpost", flip ? ax + 1 : ax + aw - 2, bridgeY - 2, 0);
  } else b.notes.push("다리 줄이 작은 섬과 맞지 않아 다리를 뺐다");
  b.prop("si-flowerpot", (placed[0]?.access[0]?.x ?? px0) + 1, pr - 1, 0);
  b.fillEmpty(rng, 6);
  b.edgeAccents(rng);
  return { x: px0 + 2, y: pr };
}

// ═══════════════════════ 신전 ═══════════════════════
function composeShrine(b: Board, rng: () => number): SkyCell {
  const { W, H } = b;
  // 신전 섬(위 가운데) + 남쪽 문 섬(밧줄 다리) + 옆 정원 섬(돌다리)
  const side: "w" | "e" = rng() < 0.5 ? "w" : "e";          // 옆 정원 섬 쪽
  const sw = Math.min(W - 22, 22), sh = 17;
  const ow = 6, oh = 7, sgap = 4;
  const sx = side === "w" ? Math.max(1 + ow + sgap, Math.floor((W - sw) / 2)) : Math.min(W - 2 - ow - sgap - sw, Math.floor((W - sw) / 2));
  const sy = 2;
  b.island(cutTop({ x: sx, y: sy, w: sw, h: sh }, side === "w" ? "e" : "w", 3, 2), "gs");
  const gw = 12, gh = 6, gx = sx + Math.floor((sw - gw) / 2), gy = sy + sh + 8;
  if (gy + gh + 4 >= H) throw new Error("신전 맵이 낮다 — 높이를 늘린다");
  b.island([{ x: gx, y: gy, w: gw, h: gh }], "gs");
  const ox = side === "w" ? sx - sgap - ow : sx + sw + sgap, oy = sy + 5;
  b.island([{ x: ox, y: oy, w: ow, h: oh }], "gs");
  const cx = sx + Math.floor(sw / 2);
  // 신전(북쪽 가운데) → 앞 광장 → 참배길(남쪽 끝까지)
  const shrineKit = b.kitOf("si-shrine");
  const shrine = b.building("si-shrine", cx - Math.floor(shrineKit.width / 2), sy + 1, 1);
  if (!shrine) throw new Error("신전 자리가 없다");
  const a = shrine.access[0]!;
  const pw = 9, ph = 4;
  b.patch("plaza", { x: a.x - 4, y: a.y + 1, w: pw, h: ph }, "plaza");
  b.vpath(a.x, a.y + ph + 1, sy + sh - 2);
  b.zones.push({ name: "참배길", use: "path", rect: { x: a.x, y: a.y + ph + 1, w: 1, h: sy + sh - 2 - (a.y + ph) } });
  // 샘: 정원 섬 반대쪽 — 연못에서 시내가 남쪽 끝으로 흘러 폭포
  const springX = side === "w" ? sx + sw - 5 : sx + 4;
  b.spring(springX, a.y + 2);
  // 광장: 수정 기둥 한 쌍(광장 안), 석상 한 쌍(광장 옆), 깃발 한 쌍(신전 옆)
  b.prop("si-crystal-pylon", a.x - 2, a.y + 1, 0, ["plaza"], ["plaza"]); b.prop("si-crystal-pylon", a.x + 2, a.y + 1, 0, ["plaza"], ["plaza"]);
  b.prop("si-statue", a.x - 6, a.y + 2, 0); b.prop("si-statue", a.x + 6, a.y + 2, 0);
  b.prop("si-banner", shrine.rect.x - 2, shrine.rect.y + shrine.rect.h - 3, 0); b.prop("si-banner", shrine.rect.x + shrine.rect.w + 1, shrine.rect.y + shrine.rect.h - 3, 0);
  // 참배길 양옆: 비석·등불·꽃 줄
  const py = a.y + ph + 1;
  b.prop("si-stele", a.x - 2, py, 0); b.prop("si-lamppost", a.x + 2, py, 0);
  for (let y = py + 2; y < sy + sh - 1; y++) { b.prop(y % 2 ? "si-flowers-a" : "si-flowers-b", a.x - 1, y, 0); b.prop(y % 2 ? "si-flowers-b" : "si-flowers-a", a.x + 1, y, 0); }
  // 꽃나무 뜰: 신전 뒤 양옆 + 광장 뒤 양옆
  for (const [tx, ty] of [[sx + 2, sy + 2], [sx + sw - 4, sy + 2], [sx + 1, a.y], [sx + sw - 3, a.y]] as const) b.prop("si-tree-blossom", tx, ty, 0) || b.prop("si-bush-flower", tx, ty + 2, 0);
  // 남북 밧줄 다리 → 문 섬: 깃발 둘·등불·꽃
  b.ropeV(a.x, sy + sh - 1, gy);
  b.vpath(a.x, gy + 1, gy + gh - 2);
  b.hpath(gx + 2, gx + gw - 3, gy + gh - 2);
  b.prop("si-banner", a.x - 2, gy + 1, 0); b.prop("si-banner", a.x + 2, gy + 1, 0);
  b.prop("si-lamppost", gx + 1, gy + 1, 0); b.prop("si-lamppost", gx + gw - 2, gy + 1, 0);
  b.prop("si-flowers-a", gx + 3, gy + 3, 0); b.prop("si-flowers-b", gx + gw - 4, gy + 3, 0);
  // 옆 정원 섬: 돌다리 + 수정 바위 + 새 물그릇
  const by = oy + 3;
  b.stoneH(side === "w" ? ox + ow - 1 : sx + sw - 1, side === "w" ? sx : ox, by);
  b.hpath(side === "w" ? sx + 1 : sx + sw - 4, side === "w" ? sx + 3 : sx + sw - 2, by);
  b.hpath(ox + 1, ox + ow - 2, by);
  b.prop("si-crystal-cluster", ox + 1, oy + 1, 0); b.prop("si-crystal-small", ox + 4, oy + 1, 0);
  b.prop("si-birdbath", ox + 2, oy + 1, 0); b.prop("si-rock-small", ox + ow - 2, oy + 5, 0); b.prop("si-flowers-a", ox + 1, oy + 5, 0);
  b.fillEmpty(rng, 4, ["grove", "rest", "grove", "rocks"]);
  b.edgeAccents(rng);
  return { x: a.x, y: gy + gh - 2 };
}

// ═══════════════════════ 부두 ═══════════════════════
function composeDock(b: Board, rng: () => number): SkyCell {
  const { W, H } = b;
  const east = rng() < 0.5;                                  // 잔교·비공정이 동쪽(true) / 서쪽(false). 창고 섬은 반대쪽.
  const ship = b.kitOf("si-airship");
  const ww = 8, wh = 8, gap = 4;
  const aw = W - 1 - ww - gap - (ship.width + 3), ah = Math.min(H - 14, 13);
  const ax = east ? 1 + ww + gap : ship.width + 3, ay = 3;
  const wx = east ? 1 : ax + aw + gap, wy = ay + 2;
  b.island([...cutTop({ x: ax, y: ay, w: aw, h: ah }, east ? "w" : "e", 4, 2)], "gs");
  // 부두 길·관리소·등대
  const pr = ay + 7;
  b.hpath(ax + 1, ax + aw - 2, pr);
  b.zones.push({ name: "부두 길", use: "path", rect: { x: ax + 1, y: pr, w: aw - 2, h: 1 } });
  const dh = b.kitOf("si-dockhouse");
  const dhx = east ? ax + aw - dh.width - 5 : ax + 4;
  const dock = b.building("si-dockhouse", dhx, pr - 1 - dh.height, 1);
  const lh = b.kitOf("si-lighthouse");
  const lhx = east ? ax + aw - lh.width - 1 : ax + 1;
  const light = b.building("si-lighthouse", lhx, pr - 1 - lh.height, 0) ?? b.building("si-lighthouse", lhx, Math.max(1, pr - lh.height), 0);
  for (const bb of [dock, light]) if (bb) b.connect(bb);
  // 잔교: 섬 끝 세 칸(밑면이 얕은 쪽) 아래로 — 잔교가 바위 앞을 지나 하늘로 나간다
  const bottomY = ay + ah - 1;
  const pierX = east ? ax + aw - 3 : ax;
  b.vpath(pierX + 1, pr + 1, bottomY - 1);
  b.pier(pierX, bottomY + 1, 4);
  b.prop("si-bollard", pierX + (east ? 2 : 0), bottomY + 2, 0, ["deck"], ["deck"]);
  b.prop("si-bollard", pierX + (east ? 2 : 0), bottomY + 4, 0, ["deck"], ["deck"]);
  b.prop("si-ropecoil", pierX + (east ? 0 : 2), bottomY + 3, 0, ["deck"], ["deck"]);
  // 비공정: 잔교 바깥 하늘 — 갑판 줄이 잔교 끝 줄과 맞게
  const shipX = east ? pierX + 3 : pierX - ship.width;
  const shipY = bottomY + 1 + 4 - ship.height + 1;
  let shipOk = shipX >= 0 && shipX + ship.width <= W;
  for (let yy = shipY; yy < shipY + ship.height && shipOk; yy++) for (let xx = shipX; xx < shipX + ship.width; xx++) { const u = b.u(xx, yy); if (u !== "sky" && u !== "under") shipOk = false; }
  if (shipOk) { b.stamp(ship, shipX, shipY, "prop"); b.props.push({ kit: "si-airship", x: shipX, y: shipY }); b.zones.push({ name: "비공정 정박", use: "airship", rect: { x: shipX, y: shipY, w: ship.width, h: ship.height } }); }
  else b.notes.push("비공정 자리가 섬과 겹쳐 뺐다");
  // 짐 마당: 잔교 머리 옆(섬 안쪽)
  const yard = east ? pierX - 5 : pierX + 4;
  b.prop("si-crates", yard, pr + 2, 0);
  b.prop("si-barrel", yard + 3, pr + 2, 0); b.prop("si-barrel", yard + 3, pr + 4, 0) || b.prop("si-crate", yard, pr + 4, 0);
  b.prop("si-crate", yard + 1, pr + 4, 0);
  b.prop("si-cart", dock ? dock.rect.x + (east ? -3 : dock.rect.w + 1) : ax + 8, pr + 2, 0);
  b.prop("si-windsock", east ? ax + aw - 2 : ax + 1, pr + 2, 0) || b.prop("si-windsock", east ? ax + aw - 2 : ax + 1, pr + 3, 0);
  b.prop("si-wind-turbine", east ? ax + 2 : ax + aw - 4, ay + 1, 1);
  const lampCells: SkyCell[] = []; for (let xx = ax + 2; xx < ax + aw - 2; xx++) lampCells.push({ x: xx, y: pr + 2 });
  b.lamps(lampCells, 6);
  // 창고 섬: 밧줄 다리 + 집 + 통
  b.island([{ x: wx, y: wy, w: ww, h: wh }], "gs");
  b.ropeH(east ? wx + ww - 1 : ax + aw - 1, east ? ax : wx, pr);
  b.hpath(wx + 1, wx + ww - 2, pr);
  const house = b.building(pick(rng, ["si-cottage-blue", "si-cottage-red"]), wx + 1, pr - 6, 0) ?? b.building("si-tower-house", wx + 2, pr - 7, 0);
  if (house) b.connect(house); else b.notes.push("창고 섬 집 자리가 없다");
  b.prop("si-barrel", wx + 1, pr + 2, 0); b.prop("si-crate", wx + 3, pr + 2, 0); b.prop("si-tree-young", wx + ww - 3, pr + 2, 0);
  b.treeLine(rng, ax + 1, ax + aw - 3, ay + 2, ["si-tree-pine", "si-tree-round"], 5, 0);
  b.fillEmpty(rng, 4);
  b.edgeAccents(rng);
  void H;
  return { x: ax + Math.floor(aw / 2), y: pr };
}

// ═══════════════════════ 섬 사슬 ═══════════════════════
function composeArchipelago(b: Board, rng: () => number): SkyCell {
  const { W, H } = b;
  // 2×2 섬: 북서(집 둘) · 북동(풍차·밭) · 남서(우물 쉼터) · 남동(천문대·수정)
  const cw = Math.floor((W - 10) / 2), ch = 11;
  const g = 6;
  const A = { x: 2, y: 2, w: cw - 1, h: ch };
  const B = { x: 2 + cw + g - 1, y: 3 + ri(rng, 0, 1), w: W - (2 + cw + g - 1) - 2, h: ch - 1 };
  const C = { x: 3 + ri(rng, 0, 2), y: A.y + A.h + 8, w: cw - 4, h: 9 };
  const D = { x: B.x + 1, y: B.y + B.h + 8, w: B.w - 2, h: 9 };
  if (C.y + C.h + 6 > H || D.y + D.h + 6 > H) throw new Error("섬 사슬 맵이 낮다 — 높이를 늘린다");
  b.island(cutTop(A, "w", 3, 2), "gs"); b.island(cutTop(B, "e", 3, 2), "gs"); b.island([C], "gs"); b.island(cutTop(D, "e", 2, 1), "gs");
  // A: 집 둘 + 길
  const ar = A.y + 7;
  b.hpath(A.x + 1, A.x + A.w - 1, ar);
  const h1 = b.building(pick(rng, ["si-cottage-red", "si-cottage-blue"]), A.x + 2, ar - 6, 1);
  const h2 = b.building("si-tower-house", A.x + A.w - 5, ar - 7, 1);
  for (const h of [h1, h2]) if (h) b.connect(h);
  // B: 풍차 + 밭
  const br = B.y + 7;
  b.hpath(B.x, B.x + B.w - 2, br);
  const mill = b.building("si-windmill", B.x + 2, br - 8, 1);
  if (mill) b.connect(mill);
  if (b.patch("field", { x: B.x + 8, y: B.y + 2, w: Math.min(7, B.w - 10), h: 4 }, "field")) {
    for (let yy = B.y + 3; yy < B.y + 5; yy++) for (let xx = B.x + 9; xx < B.x + 8 + Math.min(7, B.w - 10) - 1; xx++) b.prop("si-crop-wheat", xx, yy, 0, ["field"], ["field"]);
  }
  b.prop("si-haybale", B.x + B.w - 3, br + 1, 0);
  // 동서 밧줄 다리 A↔B (A 길 줄)
  if (ar > B.y && ar < B.y + B.h - 1) b.ropeH(A.x + A.w - 1, B.x, ar);
  else b.ropeH(A.x + A.w - 1, B.x, br);
  // C: 우물 쉼터 + 길
  const cr = C.y + 4;
  b.hpath(C.x + 1, C.x + C.w - 1, cr);
  if (b.patch("plaza", { x: C.x + 2, y: C.y + 1, w: 5, h: 3 }, "plaza")) b.prop("si-well", C.x + 3, C.y + 1, 0, ["plaza"], ["plaza"]) || b.prop("si-birdbath", C.x + 4, C.y + 2, 0, ["plaza"], ["plaza"]);
  b.prop("si-bench", C.x + 2, cr + 2, 0); b.prop("si-tree-round", C.x + C.w - 4, C.y + 1, 0); b.prop("si-flowers-a", C.x + 5, cr + 2, 0);
  // D: 천문대 + 수정
  const dr = D.y + D.h - 3;
  b.hpath(D.x - 0, D.x + D.w - 2, dr);
  const obs = b.building("si-observatory", D.x + Math.floor((D.w - 5) / 2), dr - 7, 0);
  if (obs) b.connect(obs);
  b.prop("si-crystal-cluster", D.x + 1, D.y + 1, 0); b.prop("si-crystal-pylon", D.x + D.w - 3, D.y + 2, 0);
  // 남북 다리 A↔C, B↔D · 돌다리 C↔D
  const vac = Math.min(A.x + A.w - 3, Math.max(A.x + 2, C.x + 2 + ri(rng, 0, 2)));
  b.vpath(vac, ar + 1, A.y + A.h - 1); b.ropeV(vac, A.y + A.h - 1, C.y); b.vpath(vac, C.y + 1, cr);
  const vbd = Math.max(D.x + 2, Math.min(B.x + B.w - 3, D.x + D.w - 4));
  b.vpath(vbd, br + 1, B.y + B.h - 1); b.ropeV(vbd, B.y + B.h - 1, D.y); b.vpath(vbd, D.y + 1, dr);
  b.stoneH(C.x + C.w - 1, D.x, cr);
  b.hpath(D.x + 1, D.x + 3, cr); b.vpath(D.x + 3, cr, dr);
  b.fillEmpty(rng, 4);
  b.edgeAccents(rng);
  return { x: A.x + 3, y: ar };
}

// ═══════════════════════ 실내 방 ═══════════════════════
const ROOM: Readonly<Record<SkyRoomStyle, { w: number; h: number; floor: string; wall: string; win: [string, string | null][]; furn: (b: Board, x0: number, y0: number, w: number, h: number, rng: () => number) => void }>> = {
  cottage: {
    w: 11, h: 9, floor: "floor-wood", wall: "plaster", win: [["wall-plaster-win", "wall-plaster-low-win"], ["wall-plaster-win", "wall-plaster-low-win"]],
    furn: (b, x0, y0, w, h, rng) => {
      // 벽 따라: 침대(서쪽 위) · 난로(북벽 가운데) · 옷장·괘종(동쪽 위) · 가운데 깔개+탁자+의자 · 구석 등·화분·세숫대
      b.prop("si-bed", x0, y0, 0, ["floor"], ["floor", "wall"]);
      b.prop("si-hearth", x0 + Math.floor(w / 2) - 1, y0, 0, ["floor"], ["floor", "wall"]);
      b.prop("si-wardrobe", x0 + w - 2, y0 - 1, 0, ["floor"], ["floor", "wall"]) || b.prop("si-cupboard", x0 + w - 1, y0 - 1, 0, ["floor"], ["floor", "wall"]);
      b.prop("si-clock", x0 + w - 3, y0 - 1, 0, ["floor"], ["floor", "wall"]);
      b.prop("si-rug", x0 + Math.floor(w / 2) - 1, y0 + 2, 0, ["floor"], ["floor"]);
      const tx = x0 + 2 + (rng() < 0.5 ? 0 : 4), ty = y0 + 5;
      b.prop("si-table", tx, ty, 0, ["floor"], ["floor"]);
      b.prop("si-chair", tx - 1, ty, 0, ["floor"]); b.prop("si-chair", tx + 2, ty, 0, ["floor"]);
      b.prop("si-lamp", x0, y0 + 3, 0, ["floor"], ["floor"]); b.prop("si-basin", x0, y0 + h - 1, 0, ["floor"]);
      b.prop("si-plant", x0 + w - 1, y0 + h - 1, 0, ["floor"]); b.prop("si-chest", x0 + w - 1, y0 + 3, 0, ["floor"]);
      void rng;
    },
  },
  shrine: {
    w: 11, h: 10, floor: "floor-stone", wall: "stone", win: [["wall-stone-arch", null], ["banner-wall", null], ["wall-stone-arch", null]],
    furn: (b, x0, y0, w, h) => {
      const cx = x0 + Math.floor(w / 2);
      b.prop("si-altar", cx - 1, y0 - 1, 0, ["floor"], ["floor", "wall"]);
      for (let y = y0 + 3; y < y0 + h; y += 2) b.prop("si-rug-long", cx, y, 0, ["floor", "deck"], ["floor", "deck"]);
      b.prop("si-offering", cx, y0 + 2, 0, ["floor", "deck"]) ;
      b.prop("si-cushion", cx - 2, y0 + 2, 0, ["floor"]); b.prop("si-cushion", cx + 2, y0 + 2, 0, ["floor"]);
      b.prop("si-incense", cx - 3, y0, 0, ["floor"]); b.prop("si-incense", cx + 3, y0, 0, ["floor"]);
      for (const y of [y0 + 3, y0 + 6]) { b.prop("si-lantern-floor", cx - 3, y, 0, ["floor"], ["floor"]); b.prop("si-lantern-floor", cx + 3, y, 0, ["floor"], ["floor"]); }
      b.prop("si-plant", x0, y0 + h - 1, 0, ["floor"]); b.prop("si-plant", x0 + w - 1, y0 + h - 1, 0, ["floor"]);
      b.prop("si-statue", x0, y0, 0, ["floor"], ["floor", "wall"]); b.prop("si-statue", x0 + w - 1, y0, 0, ["floor"], ["floor", "wall"]);
    },
  },
  cabin: {
    w: 10, h: 7, floor: "floor-deck", wall: "wood", win: [["wall-wood-port", null], ["wall-wood", null], ["wall-wood-port", null]],
    furn: (b, x0, y0, w, h) => {
      const cx = x0 + Math.floor(w / 2);
      b.prop("si-helm", cx - 1, y0, 0, ["floor"], ["floor", "wall"]);
      b.prop("si-chart-table", cx - 1, y0 + 2, 0, ["floor"]);
      b.prop("si-hammock", x0, y0 + h - 2, 0, ["floor"]); b.prop("si-chest", x0 + w - 1, y0 + h - 1, 0, ["floor"]);
      b.prop("si-chest", x0 + w - 1, y0, 0, ["floor"]); b.prop("si-lamp", x0, y0, 0, ["floor"], ["floor", "wall"]);
      b.prop("si-barrel", x0 + w - 2, y0 + h - 1, 0, ["floor"]) ; b.prop("si-crate", x0 + w - 1, y0 + h - 2, 0, ["floor"]);
    },
  },
  observatory: {
    w: 11, h: 9, floor: "floor-mosaic", wall: "star", win: [["wall-star-sky", null], ["wall-star-sky", null]],
    furn: (b, x0, y0, w, h) => {
      const cx = x0 + Math.floor(w / 2);
      b.prop("si-telescope", cx - 1, y0 - 1, 0, ["floor"], ["floor", "wall"]);
      b.prop("si-bookshelf", x0, y0 - 1, 0, ["floor"], ["floor", "wall"]); b.prop("si-bookshelf", x0 + 1, y0 - 1, 0, ["floor"], ["floor", "wall"]);
      b.prop("si-orrery", x0 + w - 2, y0 - 1, 0, ["floor"], ["floor", "wall"]); b.prop("si-ladder", x0 + w - 1, y0 - 1, 0, ["floor"], ["floor", "wall"]);
      b.prop("si-desk", x0 + w - 3, y0 + 4, 0, ["floor"]); b.prop("si-chair", x0 + w - 2, y0 + 5, 0, ["floor"]);
      b.prop("si-globe", x0 + 1, y0 + 4, 0, ["floor"]); b.prop("si-rug", cx - 1, y0 + 4, 0, ["floor"], ["floor"]);
      b.prop("si-lamp", x0, y0 + h - 2, 0, ["floor"], ["floor"]); b.prop("si-plant", x0 + w - 1, y0 + h - 1, 0, ["floor"]);
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
