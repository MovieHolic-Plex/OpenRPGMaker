// project/prehistoricComposer.ts
// 선사 시대 원시 세계(prehistoric) 구성기 — 용도(부족 마을 village | 늪지 swamp | 화산 골짜기 volcano | 화석 계곡 fossil | 실내 넷)·씨앗·맵 크기만 주면 한 장을 짠다.
//
// 왜: 사용자는 옛 시안의 «그림»만큼 «물건 배치»를 싫어했다(띠 통째 칠한 바닥, 아무 데나 흩은 소품, 막힌 문). 그래서 배치는 모델이 아니라 이 함수가 한다.
//   순서는 계획(땅 덩이: 숲·풀밭·늪·화산재·강) → 빈터(광장·작업터·발굴터) → 집·동굴 → 길 → 소품(규칙·여백) 이다. 조수는 용도·씨앗만 고른다.
// 바닥은 꼭짓점 격자 가장자리(Wang)다: 꼭짓점마다 (가족, 단)을 두고, 한 칸의 네 모서리로 가장자리 낱칸(w-<쌍>-<NW NE SW SE>)을 고른다.
//   가족: 풀(흙 → 풀 → 암반) · 고사리(흙 → 고사리) · 진흙(흙 → 진흙 → 늪 물) · 화산재(흙 → 재 → 굳은 용암 → 용암) · 물(흙 → 물).
//   settle() 이 «다른 가족끼리는 한 칸에 모이지 않는다 · 이웃 꼭짓점 단 차는 1 이하» 를 맞춘다 — 그래서 모든 칸이 그려진 낱칸 하나로 떨어진다.
// 조화 규칙(jp_city·캠퍼스·스팀펑크 적대 검수 교훈):
//   - 빈 땅마다 쓰임이 있다(광장·작업터·채집터·물가·발굴터·사냥 야영지). 띠 전체를 한 재질로 덮지 않는다 — 덩이는 값 잡음으로 일그러뜨린다.
//   - 소품은 자기 바닥 위에만(늪 나무는 진흙, 연잎은 늪 물, 고목·현무암은 화산재, 화석은 흙·자갈). 밑줄 발자국이 그 바닥이어야 놓는다.
//   - 위층 칸은 한 칸에 하나뿐이다 — 키트끼리 겹치면 놓지 않는다. 발자국 + 여백을 예약한다.
//   - 문 칸은 막힘, 바로 아래 접근칸과 그 아래 한 칸은 비우고 길로 잇는다. 소품을 놓을 때마다 시작 칸 BFS 로 «이미 닿던 칸이 끊기지 않는지» 보고, 끊으면 되돌린다.
// 순수 함수다(프로젝트를 모른다). 칸 번호·통행은 호출자가 준 사전(palette)에서 얻는다 — 도구(prehistoricTools.ts)는 번들 정의에서, QA 스크립트는 구운 JSON 에서.

export type PrehistoricOutdoorStyle = "village" | "swamp" | "volcano" | "fossil";
export type PrehistoricRoomStyle = "cave-dwelling" | "chieftain-hut" | "shaman-hut" | "cave-gallery";
export type PrehistoricStyle = PrehistoricOutdoorStyle | PrehistoricRoomStyle;
export const PREHISTORIC_OUTDOOR_STYLES: readonly PrehistoricOutdoorStyle[] = ["village", "swamp", "volcano", "fossil"];
export const PREHISTORIC_ROOM_STYLES: readonly PrehistoricRoomStyle[] = ["cave-dwelling", "chieftain-hut", "shaman-hut", "cave-gallery"];

export interface PrehistoricKit {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly rows: readonly { readonly tiles: readonly number[]; readonly upperTiles?: readonly number[] }[];
  readonly door?: { readonly dx: number; readonly w: number };
}

export interface PrehistoricPalette {
  /** 한 칸 바닥 조각 이름(dirt, w-grass-0011, wall-rock-u …) → 칸 번호. 없으면 -1. */
  tile(piece: string): number;
  kit(id: string): PrehistoricKit | undefined;
  /** 칸 통행(MZ 규칙): 위층이 있고 ★ 가 아니면 위층이, 아니면 아래층이 정한다. */
  walk(lower: number, upper: number): boolean;
}

export interface PrehistoricCell { readonly x: number; readonly y: number }
export interface PrehistoricBuilding { readonly name: string; readonly kit: string; readonly rect: { x: number; y: number; w: number; h: number }; readonly doors: PrehistoricCell[]; readonly access: PrehistoricCell[] }

export interface PrehistoricSpec {
  readonly width: number;
  readonly height: number;
  readonly style: PrehistoricStyle;
  readonly seed?: number;
}

export interface PrehistoricResult {
  readonly lower: number[];
  readonly upper: number[];
  readonly buildings: PrehistoricBuilding[];
  readonly start: PrehistoricCell;
  readonly exits: PrehistoricCell[];
  readonly props: { kit: string; x: number; y: number }[];
  readonly zones: { name: string; use: string; rect: { x: number; y: number; w: number; h: number } }[];
  readonly notes: string[];
}

export const PREHISTORIC_MIN_SIZE: Readonly<Record<PrehistoricStyle, { w: number; h: number }>> = {
  village: { w: 44, h: 34 }, swamp: { w: 40, h: 30 }, volcano: { w: 40, h: 32 }, fossil: { w: 42, h: 32 },
  "cave-dwelling": { w: 16, h: 12 }, "chieftain-hut": { w: 15, h: 12 }, "shaman-hut": { w: 12, h: 10 }, "cave-gallery": { w: 20, h: 11 },
};

const BUILDING_NAME: Readonly<Record<string, string>> = {
  "ph-hut-thatch-s": "이엉 움집", "ph-hut-thatch-l": "큰 이엉 움집", "ph-hut-log": "통나무 움집", "ph-tipi": "가죽 천막", "ph-shaman-tent": "무당 천막",
  "ph-bone-hut": "매머드 뼈 집", "ph-cave-mouth": "동굴", "ph-cave-mouth-l": "큰 동굴", "ph-cave-mouth-v": "현무암 동굴", "ph-chief-house": "족장 집", "ph-earth-lodge": "흙 움집",
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
function pick<T>(rng: () => number, xs: readonly T[]): T { return xs[Math.floor(rng() * xs.length)]!; }
function shuffle<T>(rng: () => number, xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

// ───────────────────────── 바닥 가족 ─────────────────────────
type Fam = "none" | "grass" | "fern" | "mud" | "ash" | "water";
/** 가족별 단 이름(0 = 흙). 가장자리 쌍 이름은 그 단의 조각 이름과 같다(w-<이름>-<열쇠>). */
const CHAIN: Readonly<Record<Exclude<Fam, "none">, readonly string[]>> = {
  grass: ["dirt", "grass", "stone"], fern: ["dirt", "fern"], mud: ["dirt", "mud", "swamp"], ash: ["dirt", "ash", "crust", "lava"], water: ["dirt", "water"],
};
/** 충돌하면 남는 쪽(큰 수가 이긴다). 물·늪·용암은 지형의 뼈대라 풀·고사리보다 앞선다. */
const FAM_RANK: Readonly<Record<Fam, number>> = { none: 0, fern: 1, grass: 2, ash: 3, mud: 4, water: 5 };
/** 걸을 수 없는 바닥 이름. */
const WET = new Set(["water", "swamp", "lava"]);

type Use = "open" | "path" | "plaza" | "yard" | "field" | "wild" | "water" | "bld" | "prop" | "fence" | "floor" | "wall" | "ceil";
interface Rect { x: number; y: number; w: number; h: number }

class Board {
  readonly lower: number[];
  readonly upper: number[];
  readonly use: Use[];
  readonly reserved: boolean[];
  /** 칸 바닥 이름: 'dirt' · 'grass' … 가득 찬 칸, 'edge:<쌍>' 가장자리 칸, 'path' · 'gravel' 같은 칸 덮어쓰기. settle 뒤에 채운다. */
  readonly ground: string[];
  /** 꼭짓점 (W+1)×(H+1). */
  readonly vf: Fam[];
  readonly vl: number[];
  readonly vlock: boolean[];
  /** 칸 덮어쓰기(길·자갈·실내 조각) — 꼭짓점 그림보다 앞선다. */
  readonly over: (string | null)[];
  readonly buildings: PrehistoricBuilding[] = [];
  readonly props: { kit: string; x: number; y: number }[] = [];
  readonly zones: PrehistoricResult["zones"] = [];
  readonly notes: string[] = [];
  start: PrehistoricCell | null = null;
  constructor(readonly W: number, readonly H: number, readonly pal: PrehistoricPalette, readonly seed: number) {
    const n = W * H, nv = (W + 1) * (H + 1);
    this.lower = new Array(n).fill(-1);
    this.upper = new Array(n).fill(-1);
    this.use = new Array(n).fill("open");
    this.reserved = new Array(n).fill(false);
    this.ground = new Array(n).fill("dirt");
    this.over = new Array(n).fill(null);
    this.vf = new Array(nv).fill("none");
    this.vl = new Array(nv).fill(0);
    this.vlock = new Array(nv).fill(false);
  }
  in(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
  vi(x: number, y: number): number { return y * (this.W + 1) + x; }
  t(piece: string): number {
    const id = this.pal.tile(piece);
    if (id < 0) throw new Error(`선사 칩셋에 바닥 조각 ${piece} 이 없다`);
    return id;
  }
  has(kitId: string): boolean { return !!this.pal.kit(kitId); }
  walk(x: number, y: number): boolean {
    if (!this.in(x, y)) return false;
    const k = y * this.W + x;
    return this.pal.walk(this.lower[k]!, this.upper[k]!);
  }
  zone(name: string, use: string, r: Rect): void { this.zones.push({ name, use, rect: { ...r } }); }

  // ── 꼭짓점 그림 ──
  /** 꼭짓점 (x,y) 를 가족 f 의 단 lv 로(이미 더 높으면 둔다; 다른 가족이면 force 일 때만 바꾼다). */
  vset(x: number, y: number, f: Exclude<Fam, "none">, lv: number, force = false): void {
    if (x < 0 || y < 0 || x > this.W || y > this.H) return;
    const i = this.vi(x, y);
    if (this.vlock[i]) return;
    if (this.vf[i] !== "none" && this.vf[i] !== f) { if (!force) return; this.vf[i] = f; this.vl[i] = lv; return; }
    this.vf[i] = f; this.vl[i] = Math.max(this.vl[i]!, lv);
  }
  /** 일그러진 타원 덩이(꼭짓점 좌표). wob = 가장자리 흔들림(0~0.4). */
  blob(f: Exclude<Fam, "none">, lv: number, cx: number, cy: number, rx: number, ry: number, wob = 0.3, force = false, salt = 0): void {
    for (let y = Math.floor(cy - ry - 2); y <= Math.ceil(cy + ry + 2); y++) for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      const n = (vnoise(x + 100, y + 100, 4, this.seed + salt + lv * 17) - 0.5) * 2 * wob;
      if (dx * dx + dy * dy <= 1 + n) this.vset(x, y, f, lv, force);
    }
  }
  /** 덩이를 흙으로 판다(잠그지 않는다 — 맨땅 빈터·마른 땅). */
  hole(cx: number, cy: number, rx: number, ry: number, wob = 0.35, salt = 0): void {
    for (let y = Math.floor(cy - ry - 2); y <= Math.ceil(cy + ry + 2); y++) for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x++) {
      if (x < 0 || y < 0 || x > this.W || y > this.H) continue;
      const dx = (x - cx) / rx, dy = (y - cy) / ry, n = (vnoise(x + 50, y + 50, 3, this.seed + salt) - 0.5) * 2 * wob;
      const i = this.vi(x, y);
      if (dx * dx + dy * dy <= 1 + n && !this.vlock[i]) { this.vf[i] = "none"; this.vl[i] = 0; }
    }
  }
  /** 사각형 꼭짓점 칠(경계 잡음 없음). */
  vrect(f: Exclude<Fam, "none">, lv: number, r: Rect, force = false): void {
    for (let y = r.y; y <= r.y + r.h; y++) for (let x = r.x; x <= r.x + r.w; x++) this.vset(x, y, f, lv, force);
  }
  /** 잡음 경계 띠: y 가 edge(x) 보다 작은(north=true) / 큰 쪽 전부. */
  band(f: Exclude<Fam, "none">, lv: number, edge: (x: number) => number, north: boolean, force = false): void {
    for (let x = 0; x <= this.W; x++) {
      const e = edge(x);
      for (let y = 0; y <= this.H; y++) if (north ? y <= e : y >= e) this.vset(x, y, f, lv, force);
    }
  }
  /** 칸들의 네 꼭짓점을 흙(0)으로 잠근다(길·집터·광장). */
  clearCells(cells: Iterable<PrehistoricCell>, lock = true): void {
    for (const c of cells) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
      const x = c.x + dx, y = c.y + dy;
      if (x < 0 || y < 0 || x > this.W || y > this.H) continue;
      const i = this.vi(x, y); this.vf[i] = "none"; this.vl[i] = 0; if (lock) this.vlock[i] = true;
    }
  }
  clearRect(r: Rect, lock = true): void {
    const cells: PrehistoricCell[] = [];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) cells.push({ x, y });
    this.clearCells(cells, lock);
  }
  /** 칸 네 모서리를 한 가족·단으로 잠근다(연못 가운데·발굴 구덩이). */
  fixCell(x: number, y: number, f: Exclude<Fam, "none">, lv: number): void {
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X > this.W || Y > this.H) continue;
      const i = this.vi(X, Y); this.vf[i] = f; this.vl[i] = lv; this.vlock[i] = true;
    }
  }

  /** 열기(침식 후 팽창): 가족 f 의 단 lv 이상 꼭짓점 중 한 칸 폭 실오라기·외톨이를 한 단 내린다(웅덩이 끝에 1칸 도랑이 매달리지 않게). */
  open(f: Exclude<Fam, "none">, lv: number): void {
    const W1 = this.W + 1, H1 = this.H + 1;
    const hi = (x: number, y: number) => x < 0 || y < 0 || x >= W1 || y >= H1 || (this.vf[y * W1 + x] === f && this.vl[y * W1 + x]! >= lv);
    const core = new Array<boolean>(W1 * H1).fill(false);
    for (let y = 0; y < H1; y++) for (let x = 0; x < W1; x++) {
      let ok = hi(x, y);
      for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1 && ok; dx++) if (!hi(x + dx, y + dy)) ok = false;
      core[y * W1 + x] = ok;
    }
    for (let y = 0; y < H1; y++) for (let x = 0; x < W1; x++) {
      const i = y * W1 + x;
      if (this.vlock[i] || this.vf[i] !== f || this.vl[i]! < lv) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) {
        const X = x + dx, Y = y + dy;
        if (X >= 0 && Y >= 0 && X < W1 && Y < H1 && core[Y * W1 + X]) near = true;
      }
      if (!near) { this.vl[i] = lv - 1; if (this.vl[i] === 0) this.vf[i] = "none"; }
    }
  }

  /** 꼭짓점을 그릴 수 있는 상태로 맞추고 칸 바닥을 고른다. */
  settle(): void {
    const W1 = this.W + 1, H1 = this.H + 1;
    const nb = (i: number): number[] => {
      const x = i % W1, y = (i - x) / W1, out: number[] = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const X = x + dx, Y = y + dy;
        if (X >= 0 && Y >= 0 && X < W1 && Y < H1) out.push(Y * W1 + X);
      }
      return out;
    };
    // ① 부모 올리기: 단 L 꼭짓점의 이웃은 같은 가족 L-1 이상
    for (let pass = 0; pass < 3; pass++) for (let i = 0; i < this.vf.length; i++) {
      const f = this.vf[i]!, L = this.vl[i]!;
      if (f === "none" || L < 2) continue;
      for (const j of nb(i)) {
        if (this.vlock[j]) continue;
        if (this.vf[j] === f && this.vl[j]! >= L - 1) continue;
        if (this.vf[j] === "none" || this.vf[j] === f) { this.vf[j] = f; this.vl[j] = Math.max(this.vl[j]!, L - 1); }
      }
    }
    // ② 가족 충돌: 이웃 꼭짓점이 다른 가족이면 낮은 쪽을 흙으로
    for (let i = 0; i < this.vf.length; i++) {
      const f = this.vf[i]!;
      if (f === "none") continue;
      for (const j of nb(i)) {
        const g = this.vf[j]!;
        if (g === "none" || g === f) continue;
        const lose = FAM_RANK[f] >= FAM_RANK[g] ? j : i;
        this.vf[lose] = "none"; this.vl[lose] = 0;
        if (lose === i) break;
      }
    }
    // ③ 조이기: 이웃과 단 차 1 이하가 될 때까지 높은 쪽을 낮춘다
    for (let changed = true, guard = 0; changed && guard < 8; guard++) {
      changed = false;
      for (let i = 0; i < this.vf.length; i++) {
        const f = this.vf[i]!, L = this.vl[i]!;
        if (f === "none") continue;
        let m = L;
        for (const j of nb(i)) m = Math.min(m, this.vf[j] === f ? this.vl[j]! : 0);
        if (L > m + 1) { this.vl[i] = m + 1; changed = true; }
        if (this.vl[i] === 0) { this.vf[i] = "none"; changed = true; }
      }
    }
    // ④ 칸 바닥
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      const k = y * this.W + x;
      const o = this.over[k];
      if (o) { this.lower[k] = this.t(o); this.ground[k] = o; continue; }
      const cs = [this.vi(x, y), this.vi(x + 1, y), this.vi(x, y + 1), this.vi(x + 1, y + 1)];
      const fam = cs.map((i) => this.vf[i]!).find((f) => f !== "none") ?? "none";
      const lv = cs.map((i) => (this.vf[i] === fam ? this.vl[i]! : 0));
      const mx = Math.max(...lv), mn = Math.min(...lv);
      if (fam === "none" || mx === 0) { this.ground[k] = "dirt"; this.lower[k] = this.t("dirt"); continue; }
      const chain = CHAIN[fam as Exclude<Fam, "none">];
      if (mx === mn) { const nm = chain[mx]!; this.ground[k] = nm; this.lower[k] = this.t(nm); continue; }
      const pair = chain[mx]!, key = lv.map((v) => (v === mx ? "1" : "0")).join("");
      this.ground[k] = `edge:${pair}`;
      this.lower[k] = this.t(`w-${pair}-${key}`);
    }
  }
  /** 바닥 변주: 큰 덩이 값 잡음으로만(띠 통째·자잘한 점 금지). */
  variety(): void {
    const swaps: [string, string, number, number][] = [["dirt", "dirt-b", 0.62, 5], ["grass", "grass-b", 0.6, 6], ["mud", "mud-b", 0.55, 5], ["ash", "ash-b", 0.55, 5], ["floor-cave", "floor-cave-b", 0.6, 4], ["stone", "stone-b", 0.5, 4], ["path", "path-b", 0.55, 3]];
    for (const [base, alt, cut, g] of swaps) {
      const a = this.pal.tile(base), b = this.pal.tile(alt);
      if (a < 0 || b < 0) continue;
      for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
        const k = y * this.W + x;
        if (this.lower[k] !== a) continue;
        const n = vnoise(x + 300, y + 300, g, this.seed + base.length) * 0.8 + vnoise(x + 300, y + 300, 2, this.seed + 9) * 0.2;
        if (n > cut) this.lower[k] = b;
      }
    }
  }

  /** 흙길 테(2판): 길 칸의 이어지지 않는 변을 손으로 흔든 테로 끝낸다(`lane-<N E S W>`, 1 = 이어짐). 시트에 없으면 그대로 둔다.
   *  이어짐 = 맵 밖 · 길 · 건물 칸(문으로 들어간다) · 다리 위층. */
  lanes(): void {
    if (this.pal.tile("lane-0000") < 0) return;
    const bridges = new Set(["bridge-h", "bridge-v"].map((n) => this.pal.tile(n)).filter((i) => i >= 0));
    const link = (x: number, y: number): boolean => {
      if (!this.in(x, y)) return true;
      const k = y * this.W + x;
      return this.ground[k] === "path" || this.use[k] === "bld" || bridges.has(this.upper[k]!);
    };
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      const k = y * this.W + x;
      if (this.ground[k] !== "path") continue;
      const key = [link(x, y - 1), link(x + 1, y), link(x, y + 1), link(x - 1, y)].map((v) => (v ? "1" : "0")).join("");
      if (key === "1111") continue;
      const id = this.pal.tile(`lane-${key}`);
      if (id >= 0) this.lower[k] = id;
    }
  }

  // ── 놓기 ──
  /** 칸 바닥이 grounds 중 하나인가('edge:*' 는 'edge' 로도 받는다, 'grass' 는 grass·grass-b). */
  groundIs(x: number, y: number, grounds: readonly string[]): boolean {
    if (!this.in(x, y)) return false;
    const g = this.ground[y * this.W + x]!;
    return grounds.includes(g) || (g.startsWith("edge:") && (grounds.includes("edge") || grounds.includes(g)));
  }
  free(r: Rect, margin: number, grounds: readonly string[], uses: readonly Use[]): boolean {
    for (let y = r.y - margin; y < r.y + r.h + margin; y++) for (let x = r.x - margin; x < r.x + r.w + margin; x++) {
      const inside = x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
      if (!this.in(x, y)) { if (inside) return false; continue; }
      const k = y * this.W + x;
      if (inside) {
        if (!uses.includes(this.use[k]!) || this.reserved[k] || this.upper[k]! >= 0) return false;
        // 밑줄(서 있는 줄)은 바닥이 맞아야 한다 — 윗줄(수관·지붕)은 다른 바닥 위로 드리워도 된다
        if (y === r.y + r.h - 1 && !this.groundIs(x, y, grounds)) return false;
        if (y < r.y + r.h - 1 && WET.has(this.ground[k]!) && !grounds.some((g) => WET.has(g))) return false;
      } else if (this.use[k] === "bld" || this.use[k] === "prop" || this.use[k] === "fence" || this.reserved[k]) return false;
    }
    return true;
  }
  reserve(r: Rect): void {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (this.in(x, y)) this.reserved[y * this.W + x] = true;
  }
  kitSize(id: string): { w: number; h: number } {
    const k = this.pal.kit(id);
    if (!k) throw new Error(`선사 칩셋에 키트 ${id} 가 없다`);
    return { w: k.width, h: k.height };
  }
  stamp(kitId: string, x: number, y: number, use: Use): PrehistoricKit {
    const kit = this.pal.kit(kitId);
    if (!kit) throw new Error(`선사 칩셋에 키트 ${kitId} 가 없다`);
    kit.rows.forEach((row, r) => {
      for (let c = 0; c < kit.width; c++) {
        const X = x + c, Y = y + r;
        if (!this.in(X, Y)) continue;
        const k = Y * this.W + X, lo = row.tiles[c] ?? -1, up = row.upperTiles?.[c] ?? -1;
        if (lo < 0 && up < 0) continue;
        if (lo >= 0) this.lower[k] = lo;
        if (up >= 0) this.upper[k] = up;
        if (!this.pal.walk(this.lower[k]!, this.upper[k]!) || use === "bld") this.use[k] = use;
      }
    });
    return kit;
  }
  reach(): Set<number> {
    const s = this.start, seen = new Set<number>();
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
  /** 소품 하나(발자국·여백·바닥·위층·연결 검사를 모두 통과할 때만). */
  prop(kitId: string, x: number, y: number, margin: number, grounds: readonly string[], uses: readonly Use[] = ["open", "yard", "field", "wild", "plaza"]): boolean {
    const kit = this.pal.kit(kitId);
    if (!kit) return false;
    const r = { x, y, w: kit.width, h: kit.height };
    if (!this.free(r, margin, grounds, uses)) return false;
    const before = this.start ? this.reach() : null;
    const saved: [number, number, number, Use][] = [];
    for (let yy = y; yy < y + kit.height; yy++) for (let xx = x; xx < x + kit.width; xx++) {
      if (!this.in(xx, yy)) continue;
      const k = yy * this.W + xx; saved.push([k, this.lower[k]!, this.upper[k]!, this.use[k]!]);
    }
    this.stamp(kitId, x, y, "prop");
    if (before) {
      const after = this.reach();
      for (const k of before) {
        if (!after.has(k) && this.walk(k % this.W, Math.floor(k / this.W))) {
          for (const [kk, lo, up, u] of saved) { this.lower[kk] = lo; this.upper[kk] = up; this.use[kk] = u; }
          return false;
        }
      }
    }
    this.props.push({ kit: kitId, x, y });
    return true;
  }
  propNear(kitId: string, spots: readonly [number, number][], margin: number, grounds: readonly string[], uses?: readonly Use[]): boolean {
    for (const [x, y] of spots) if (this.prop(kitId, x, y, margin, grounds, uses)) return true;
    return false;
  }
  /** 사각형 가운데에서 가까운 빈 자리부터 하나씩(흩뿌리지 않고 한 덩이로). */
  cluster(r: Rect, kits: readonly string[], grounds: readonly string[], margin = 0, uses?: readonly Use[]): number {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2; let n = 0;
    for (const kit of kits) {
      if (!this.has(kit)) continue;
      const s = this.kitSize(kit), spots: [number, number][] = [];
      for (let y = r.y; y + s.h <= r.y + r.h; y++) for (let x = r.x; x + s.w <= r.x + r.w; x++) spots.push([x, y]);
      spots.sort((a, c) => Math.hypot(a[0] + s.w / 2 - cx, a[1] + s.h - cy) - Math.hypot(c[0] + s.w / 2 - cx, c[1] + s.h - cy));
      if (this.propNear(kit, spots, margin, grounds, uses)) n++;
    }
    return n;
  }
  /** 덩이 소품 무리: 값 잡음이 높은 자리 순으로 count 개(나무 숲·바위 무리). 서로 gap 칸 띄운다. */
  scatter(r: Rect, kits: readonly string[], count: number, grounds: readonly string[], gap = 1, salt = 0, uses?: readonly Use[]): number {
    const spots: [number, number, number][] = [];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) spots.push([x, y, vnoise(x, y, 5, this.seed + salt) + hash2(x, y, this.seed + salt) * 0.35]);
    spots.sort((a, b) => b[2] - a[2]);
    let n = 0, i = 0;
    for (const [x, y] of spots) {
      if (n >= count) break;
      const kit = kits[i % kits.length]!;
      if (!this.has(kit)) { i++; continue; }
      const s = this.kitSize(kit);
      if (this.prop(kit, x, y - s.h + 1, gap, grounds, uses)) { n++; i++; }
    }
    return n;
  }
  /**
   * 빈 땅 메우기(마지막 단계): 소품·집·길·물에서 minR 칸 넘게 떨어진 «빈 땅 한가운데»마다 그 바닥에 맞는 무리를 하나 놓는다.
   * 맵을 크게 잡으면(조수가 64×40 처럼) 고정 배치 둘레가 텅 비던 것을 막는다(조수 실측 1차). 무리는 cluster 라 BFS 연결 검사를 그대로 받는다.
   */
  fillEmpty(themes: readonly { grounds: readonly string[]; kits: readonly string[]; zone: string }[], minR = 4, max = 8): number {
    const { W, H } = this;
    const skip = new Array<boolean>(W * H).fill(false);
    let placed = 0;
    for (let round = 0; round < max * 3 && placed < max; round++) {
      const dist = new Array<number>(W * H).fill(Infinity), q: number[] = [];
      for (let k = 0; k < W * H; k++) {
        const g = this.ground[k]!, u = this.use[k]!;
        const occ = this.reserved[k] || skip[k] || !["open", "wild", "field"].includes(u) || WET.has(g) || g === "edge:water" || g === "edge:swamp" || g === "edge:lava";
        if (occ) { dist[k] = 0; q.push(k); }
      }
      for (let i = 0; i < q.length; i++) {
        const k = q[i]!, x = k % W, y = (k - x) / W;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const X = x + dx, Y = y + dy;
          if (!this.in(X, Y)) continue;
          const nk = Y * W + X;
          if (dist[nk]! > dist[k]! + 1) { dist[nk] = dist[k]! + 1; q.push(nk); }
        }
      }
      let best = -1, bd = minR - 1;
      for (let k = 0; k < W * H; k++) {
        const x = k % W, y = (k - x) / W;
        const d = Math.min(dist[k]!, x + 2, y + 2, W - x + 1, H - y + 1);   // 가장자리는 빈 땅으로 덜 친다
        if (d > bd) { bd = d; best = k; }
      }
      if (best < 0) break;
      const bx = best % W, by = (best - bx) / W, g = this.ground[best]!;
      const th = themes.find((t) => t.grounds.includes(g) || (g.startsWith("edge:") && t.grounds.includes(g)));
      const r = { x: bx - 3, y: by - 3, w: 7, h: 6 };
      const n = th ? this.cluster(r, shuffle(mulberry(this.seed + best), th.kits), th.grounds, 0, ["open", "wild", "field"]) : 0;
      if (n > 0) { placed++; this.zone(th!.zone, "빈 땅을 메운 무리", r); }
      for (let y = by - 2; y <= by + 2; y++) for (let x = bx - 2; x <= bx + 2; x++) if (this.in(x, y)) skip[y * W + x] = true;
    }
    return placed;
  }
  building(kitId: string, x: number, y: number): PrehistoricBuilding {
    const kit = this.stamp(kitId, x, y, "bld");
    const d = kit.door ?? { dx: Math.floor(kit.width / 2), w: 1 };
    const doors = Array.from({ length: d.w }, (_, i) => ({ x: x + d.dx + i, y: y + kit.height - 1 }));
    const access = doors.map((c) => ({ x: c.x, y: c.y + 1 }));
    for (const a of access) this.reserve({ x: a.x, y: a.y, w: 1, h: 2 });
    const b = { name: BUILDING_NAME[kitId] ?? kitId, kit: kitId, rect: { x, y, w: kit.width, h: kit.height }, doors, access };
    this.buildings.push(b);
    return b;
  }
  /** 집 둘레 한 칸을 예약(소품이 벽에 붙지 않게) — 문 쪽은 이미 접근칸 예약. */
  ring(r: Rect, m = 1): void {
    for (let y = r.y - m; y < r.y + r.h + m; y++) for (let x = r.x - m; x < r.x + r.w + m; x++) {
      if (!this.in(x, y)) continue;
      const k = y * this.W + x;
      if (this.use[k] !== "bld") this.reserved[k] = true;
    }
  }
  /** 칸 덮어쓰기(길·자갈) + 용도. */
  paint(piece: string, cells: Iterable<PrehistoricCell>, use: Use): void {
    for (const c of cells) {
      if (!this.in(c.x, c.y)) continue;
      const k = c.y * this.W + c.x;
      if (this.use[k] === "bld" || this.use[k] === "prop") continue;
      this.over[k] = piece; this.use[k] = use;
    }
  }
  setUse(r: Rect, use: Use): void {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (this.in(x, y) && this.use[y * this.W + x] !== "bld") this.use[y * this.W + x] = use;
  }
}

/** 두 칸 사이 길(격자 BFS — 건물·예약 칸을 피한다). 시작·끝 포함 칸 목록. 못 찾으면 []. */
function route(b: Board, from: PrehistoricCell, to: PrehistoricCell, avoid: (x: number, y: number) => boolean, bend = 0): PrehistoricCell[] {
  const W = b.W, H = b.H, prev = new Int32Array(W * H).fill(-2);
  const s = from.y * W + from.x, t = to.y * W + to.x;
  // 0-1 BFS 비슷하게: 같은 방향 유지를 조금 선호해 꺾임이 적은 길을 만든다(덱 두 개 대신 거리 + 꺾임 비용 Dijkstra 단순판)
  const dist = new Float64Array(W * H).fill(Infinity), dir = new Int8Array(W * H).fill(-1);
  dist[s] = 0; prev[s] = -1;
  const open: number[] = [s];
  const D = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (dist[open[i]!]! < dist[open[bi]!]!) bi = i;
    const k = open.splice(bi, 1)[0]!;
    if (k === t) break;
    const x = k % W, y = (k - x) / W;
    for (let d = 0; d < 4; d++) {
      const nx = x + D[d]![0], ny = y + D[d]![1];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const nk = ny * W + nx;
      if (nk !== t && avoid(nx, ny)) continue;
      const turn = dir[k] >= 0 && dir[k] !== d ? 0.6 : 0;
      const wob = bend ? hash2(nx, ny, b.seed + 5) * bend : 0;
      const nd = dist[k]! + 1 + turn + wob;
      if (nd < dist[nk]!) { dist[nk] = nd; prev[nk] = k; dir[nk] = d; open.push(nk); }
    }
  }
  if (prev[t] === -2) return [];
  const out: PrehistoricCell[] = [];
  for (let k = t; k >= 0; k = prev[k]!) out.push({ x: k % W, y: Math.floor(k / W) });
  return out.reverse();
}
/** 길 칸을 width 만큼 넓힌다(오른쪽·아래로). */
function widen(cells: readonly PrehistoricCell[], width: number): PrehistoricCell[] {
  if (width <= 1) return [...cells];
  const out = new Map<string, PrehistoricCell>();
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]!, n = cells[Math.min(i + 1, cells.length - 1)]!, p = cells[Math.max(i - 1, 0)]!;
    const vertical = n.x === c.x && p.x === c.x;
    for (let k = 0; k < width; k++) { const q = vertical ? { x: c.x + k, y: c.y } : { x: c.x, y: c.y + k }; out.set(`${q.x},${q.y}`, q); }
  }
  return [...out.values()];
}

// ───────────────────────── 공통 조각 ─────────────────────────
const LAND = ["dirt", "dirt-b", "grass", "grass-b", "edge:grass", "edge:fern", "edge:mud", "path"];
const GREEN = ["grass", "grass-b", "fern"];

/** 모닥불 둘레 의자: 불(2×2 화톳불이면 bw=2) 둘레 거리 2 링에 돌 의자·통나무 의자. */
function seatsAround(b: Board, fx: number, fy: number, bw: number, kinds: readonly string[], n: number, grounds: readonly string[]): void {
  const ring: [number, number][] = [];
  for (let y = fy - 2; y <= fy + bw + 1; y++) for (let x = fx - 2; x <= fx + bw + 1; x++) {
    const inner = x >= fx - 1 && x <= fx + bw && y >= fy - 1 && y <= fy + bw;
    if (!inner) ring.push([x, y]);
  }
  const cx = fx + bw / 2 - 0.5, cy = fy + bw / 2 - 0.5;
  ring.sort((a, c) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(c[1] - cy, c[0] - cx));
  const step = Math.max(1, Math.floor(ring.length / n));
  let k = 0;
  for (let i = 0; i < ring.length && k < n; i += step) {
    const kit = kinds[k % kinds.length]!;
    if (b.propNear(kit, [ring[i]!, ring[(i + 1) % ring.length]!], 0, grounds, ["plaza", "yard", "open"])) k++;
  }
}

/** 강·개울(남북): 꼭짓점 물 띠 + 가장자리 흔들림. 돌려주는 값: 행마다 물 꼭짓점 범위. */
function riverNS(b: Board, x0: number, width: number, salt: number): { at: (y: number) => [number, number] } {
  const at = (y: number): [number, number] => {
    const off = Math.round((vnoise(0, y, 9, b.seed + salt) - 0.5) * 6);
    const w = width + Math.round((vnoise(5, y, 5, b.seed + salt + 3) - 0.5) * 2);
    return [x0 + off, x0 + off + w];
  };
  for (let y = 0; y <= b.H; y++) { const [a, c] = at(y); for (let x = a; x <= c; x++) b.vset(x, y, "water", 1, true); }
  return { at };
}
/** 강 위 다리(동서): 행 y 의 물 칸들 위층에 bridge-h, 양 끝 땅에 다리 기둥. 돌려주는 값: 다리 칸 [x0, x1]. */
function bridgeEW(b: Board, y: number): [number, number] | null {
  let x0 = -1, x1 = -1;
  for (let x = 0; x < b.W; x++) { if (!b.walk(x, y) && b.ground[y * b.W + x] !== undefined && (b.ground[y * b.W + x] === "water" || b.ground[y * b.W + x] === "edge:water")) { if (x0 < 0) x0 = x; x1 = x; } }
  if (x0 < 0) return null;
  const bh = b.t("bridge-h");
  for (let x = x0; x <= x1; x++) { const k = y * b.W + x; b.upper[k] = bh; b.use[k] = "path"; }
  b.reserve({ x: x0 - 1, y, w: x1 - x0 + 3, h: 1 });
  for (const x of [x0 - 1, x1 + 1]) {
    if (b.has("ph-bridge-post")) {
      for (const yy of [y - 2, y + 1]) {
        const ok = [0, 1].every((j) => b.in(x, yy + j) && b.upper[(yy + j) * b.W + x] === -1 && b.use[(yy + j) * b.W + x] !== "bld" && !WET.has(b.ground[(yy + j) * b.W + x]!) && !b.ground[(yy + j) * b.W + x]!.startsWith("edge:water"));
        if (ok) { b.stamp("ph-bridge-post", x, yy, "prop"); b.props.push({ kit: "ph-bridge-post", x, y: yy }); }
      }
    }
  }
  return [x0, x1];
}
/** 물가 꾸밈: 물 가장자리 바깥 땅 칸에 갈대·속새 무리, 물 안 칸에 연잎. */
function shoreDressing(b: Board, r: Rect, pond: "water" | "swamp", reeds: number, lilies: number): void {
  const edge = `edge:${pond}`, spots: [number, number][] = [];
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
    if (!b.in(x, y) || b.ground[y * b.W + x] === pond || b.ground[y * b.W + x] === edge) continue;
    const nearWet = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => b.in(x + dx!, y + dy!) && (b.ground[(y + dy!) * b.W + x + dx!] === edge || b.ground[(y + dy!) * b.W + x + dx!] === pond));
    if (nearWet) spots.push([x, y]);
  }
  const ranked = spots.map(([x, y]) => [x, y, vnoise(x, y, 3, b.seed + 41)] as const).sort((a, c) => c[2] - a[2]);
  let n = 0;
  for (const [x, y] of ranked) {
    if (n >= reeds) break;
    const kit = (x + y) % 3 === 0 && b.has("ph-horsetail") ? "ph-horsetail" : "ph-reeds";
    const h = b.kitSize(kit).h;
    if (b.prop(kit, x, y - h + 1, 0, ["dirt", "mud", "grass", "edge:grass", "edge:mud", "edge:fern"], ["open", "wild", "field", "yard"])) n++;
  }
  const lily = b.pal.tile("lily");
  if (lily >= 0) {
    let m = 0;
    for (let y = r.y; y < r.y + r.h && m < lilies; y++) for (let x = r.x; x < r.x + r.w && m < lilies; x++) {
      if (!b.in(x, y)) continue;
      const k = y * b.W + x;
      if (b.ground[k] !== pond || b.upper[k] >= 0 || b.use[k] === "path") continue;
      if (vnoise(x, y, 3, b.seed + 77) > 0.68 && hash2(x, y, b.seed) < 0.55) { b.upper[k] = lily; m++; }
    }
  }
}

// ───────────────────────── 부족 마을 ─────────────────────────
function composeVillage(b: Board, rng: () => number): PrehistoricCell {
  const { W, H } = b;
  // ① 땅 계획: 풀밭이 바탕(흙은 쓰는 곳에만 드러난다) · 북쪽 고사리 숲 띠 · 동쪽 강 · 맨땅 빈터 몇 · 풀밭 속 암반 하나
  b.vrect("grass", 1, { x: 0, y: 0, w: W, h: H });
  const forestEdge = (x: number) => 6 + Math.round((vnoise(x, 0, 6, b.seed + 1) - 0.5) * 4);
  b.band("fern", 1, forestEdge, true, true);
  const riverX = W - 9 - Math.floor(rng() * 3);
  const river = riverNS(b, riverX, 2, 11);
  for (let i = 0; i < 5; i++) b.hole(3 + rng() * (W - 14), 10 + rng() * (H - 14), 1.6 + rng() * 2, 1.2 + rng() * 1.2, 0.4, i * 7);
  b.blob("grass", 2, 4, H * 0.62, 2.2, 1.6, 0.2);
  // ② 빈터: 광장(타원) · 서쪽 작업터 · 집터
  const pcx = Math.floor(W * 0.42) + Math.floor(rng() * 3) - 1, pcy = Math.floor(H * 0.52);
  const plaza: Rect = { x: pcx - 6, y: pcy - 4, w: 13, h: 9 };
  const plazaCells: PrehistoricCell[] = [];
  for (let y = plaza.y; y < plaza.y + plaza.h; y++) for (let x = plaza.x; x < plaza.x + plaza.w; x++) {
    const dx = (x + 0.5 - pcx - 0.5) / 6.6, dy = (y + 0.5 - pcy - 0.5) / 4.6;
    if (dx * dx + dy * dy <= 1) plazaCells.push({ x, y });
  }
  b.clearCells(plazaCells);
  for (const c of plazaCells) b.use[c.y * W + c.x] = "plaza";
  b.zone("마을 광장", "화톳불·북·토템 광장", plaza);
  // ③ 북쪽: 동굴(숲 띠 앞, 광장 북쪽) — 동굴 앞 빈터 흙
  const caveKit = b.has("ph-cave-mouth-l") && W >= 48 ? "ph-cave-mouth-l" : "ph-cave-mouth";
  const cs = b.kitSize(caveKit);
  const cvx = Math.max(2, Math.min(W - cs.w - 12, pcx - Math.floor(cs.w / 2) + (rng() < 0.5 ? -9 : 9)));
  const cvy = 2;
  b.clearRect({ x: cvx - 1, y: cvy + cs.h - 2, w: cs.w + 2, h: 4 });
  // ④ 집 줄: 광장 북쪽 족장 집, 광장 서·동쪽 움집 — 접근칸이 광장 가장자리나 짧은 샛길에 닿게
  const chief = b.has("ph-chief-house") ? "ph-chief-house" : "ph-hut-thatch-l";
  const chs = b.kitSize(chief);
  const chx = pcx - Math.floor(chs.w / 2), chy = plaza.y - chs.h + 1;
  const hutsW = shuffle(rng, ["ph-hut-thatch-s", "ph-hut-log", "ph-tipi", "ph-earth-lodge"]).filter((k) => b.has(k));
  const hutsE = shuffle(rng, ["ph-hut-thatch-l", "ph-bone-hut", "ph-hut-thatch-s", "ph-tipi"]).filter((k) => b.has(k));
  const sites: { kit: string; x: number; y: number }[] = [{ kit: chief, x: chx, y: chy }];
  // 서쪽 두 채(광장 서쪽 옆, 위·아래)
  let wx = plaza.x - 2;
  for (const [i, k] of hutsW.slice(0, 2).entries()) {
    const s = b.kitSize(k);
    sites.push({ kit: k, x: wx - s.w + 1 - (i === 1 ? 3 : 0), y: (i === 0 ? pcy - 6 : pcy + 2) - s.h + 4 });
  }
  // 동쪽 두 채(광장과 강 사이)
  const ex0 = plaza.x + plaza.w + 1;
  for (const [i, k] of hutsE.slice(0, 2).entries()) {
    const s = b.kitSize(k);
    const x = Math.min(ex0 + (i === 1 ? 2 : 0), river.at(pcy)[0] - s.w - 3);
    sites.push({ kit: k, x, y: (i === 0 ? pcy - 6 : pcy + 2) - s.h + 4 });
  }
  // 무당 천막: 광장 북서 숲가(동굴 반대쪽)
  if (b.has("ph-shaman-tent")) {
    const s = b.kitSize("ph-shaman-tent");
    const sx = cvx < pcx ? Math.min(W - s.w - 14, chx + chs.w + 3) : Math.max(2, chx - s.w - 3);
    sites.push({ kit: "ph-shaman-tent", x: sx, y: chy + chs.h - s.h - 1 });
  }
  // 겹침 없는 자리만 세운다(집 둘레 1칸 띄움)
  const taken: Rect[] = [{ x: cvx - 1, y: cvy - 1, w: cs.w + 2, h: cs.h + 3 }, { ...plaza }];
  const overlaps = (r: Rect) => taken.some((t) => r.x < t.x + t.w && t.x < r.x + r.w && r.y < t.y + t.h && t.y < r.y + r.h);
  for (const st of sites) {
    const s = b.kitSize(st.kit);
    const r = { x: st.x - 1, y: st.y - 1, w: s.w + 2, h: s.h + 3 };
    if (st.kit !== chief && overlaps(r)) continue;
    if (st.x < 1 || st.y < 1 || st.x + s.w > W - 1 || st.y + s.h > H - 3) continue;
    b.clearRect({ x: st.x, y: st.y + s.h - 2, w: s.w, h: 4 }, false);
    taken.push(r);
    (st as { placed?: boolean }).placed = true;
  }
  // ⑤ 길 계획: 남쪽 출구 → 광장 · 동굴 → 광장 · 각 집 접근칸 → 광장 · 광장 → 다리 → 강 건너 채집터
  const start = { x: pcx, y: H - 1 };
  b.settle();
  b.start = null;
  const blds = sites.filter((s) => (s as { placed?: boolean }).placed).map((s) => b.building(s.kit, s.x, s.y));
  const cave = b.building(caveKit, cvx, cvy);
  for (const d of [...blds, cave]) b.ring(d.rect);
  const avoid = (x: number, y: number) => b.use[y * W + x] === "bld" || b.ground[y * W + x] === "stone" || (b.reserved[y * W + x] && b.use[y * W + x] !== "plaza" && !isAccess(x, y));
  const accessSet = new Set([...blds, cave].flatMap((d) => d.access.map((c) => `${c.x},${c.y}`)));
  function isAccess(x: number, y: number) { return accessSet.has(`${x},${y}`) || accessSet.has(`${x},${y - 1}`); }
  const plazaEdge = (from: PrehistoricCell): PrehistoricCell => {
    let best = plazaCells[0]!, bd = Infinity;
    for (const c of plazaCells) { const d = Math.abs(c.x - from.x) + Math.abs(c.y - from.y); if (d < bd) { bd = d; best = c; } }
    return best;
  };
  const roads: PrehistoricCell[] = [];
  const southRoad = widen(route(b, start, plazaEdge(start), avoid, 0.8), 2);
  roads.push(...southRoad);
  roads.push(...route(b, cave.access[0]!, plazaEdge(cave.access[0]!), avoid, 0.6));
  for (const d of blds) {
    const a = d.access[0]!;
    if (b.use[a.y * W + a.x] === "plaza") continue;
    roads.push(...route(b, a, plazaEdge(a), avoid, 0.3));
  }
  // 동쪽 다리 길: 광장 동쪽 끝 → 강 서쪽 둑(물을 피해) → 다리 줄(곧게) → 건너편 둑
  const by = Math.min(H - 6, pcy + 1 + Math.floor(rng() * 3));
  const [ra, rb] = river.at(by);
  const isWet = (x: number, y: number) => b.ground[y * W + x] === "water" || b.ground[y * W + x] === "edge:water";
  const eastRoad = route(b, plazaEdge({ x: W - 1, y: by }), { x: ra - 2, y: by }, (x, y) => b.use[y * W + x] === "bld" || isWet(x, y), 0);
  for (let x = ra - 2; x <= Math.min(W - 1, rb + 4); x++) eastRoad.push({ x, y: by });
  const roadSet = new Map<string, PrehistoricCell>();
  for (const c of [...roads, ...eastRoad]) if (b.use[c.y * W + c.x] !== "plaza" && b.use[c.y * W + c.x] !== "bld") roadSet.set(`${c.x},${c.y}`, c);
  // 물 칸은 다리(위층)라 바닥 칠은 땅 칸만 — 다리 줄의 물·물가 칸은 꼭짓점을 건드리지 않는다
  const land = [...roadSet.values()].filter((c) => !(c.y === by && c.x >= ra - 1 && c.x <= rb + 1) && !isWet(c.x, c.y));
  b.clearCells(land);
  b.paint("path", land, "path");
  // 다시 그려 길 둘레 가장자리를 맞춘다
  b.settle();
  bridgeEW(b, by);
  b.zone("강·다리", "개울과 밧줄 다리", { x: ra, y: 0, w: rb - ra + 1, h: H });
  // ⑥ 소품(이제부터 BFS 연결 검사)
  b.start = start;
  // 광장: 화톳불 + 의자 링 + 북 + 토템 둘(광장 북쪽 모퉁이) + 큰 선돌(남쪽 입구 옆)
  const fireSpots: [number, number][] = [[pcx - 1, pcy], [pcx, pcy], [pcx - 1, pcy + 1], [pcx, pcy + 1], [pcx - 2, pcy], [pcx + 1, pcy]];
  if (b.propNear("ph-bonfire", fireSpots, 1, ["dirt", "dirt-b"], ["plaza"])) {
    const { x: fx, y: fy } = b.props[b.props.length - 1]!;
    seatsAround(b, fx, fy, 2, ["ph-stone-seat", "ph-log-seat", "ph-stone-seat"], 5, ["dirt"]);
    b.propNear("ph-drum", [[fx + 3, fy + 2], [fx - 2, fy + 2], [fx + 3, fy - 1]], 0, ["dirt"], ["plaza"]);
  }
  for (const [tx, ty, k] of [[plaza.x + 2, plaza.y, "ph-totem"], [plaza.x + plaza.w - 3, plaza.y, "ph-totem-b"]] as const) b.propNear(k, [[tx, ty], [tx + 1, ty], [tx - 1, ty]], 0, ["dirt", "path"], ["plaza", "open"]);
  const gateY = Math.min(H - 4, plaza.y + plaza.h + 2);
  const sr = southRoad.filter((c) => c.y === gateY).map((c) => c.x);
  if (sr.length) {
    const gx0 = Math.min(...sr), gx1 = Math.max(...sr);
    b.propNear("ph-menhir-tall", [[gx0 - 2, gateY - 2], [gx0 - 3, gateY - 2]], 0, LAND);
    b.propNear("ph-skull-pole", [[gx1 + 2, gateY - 1], [gx1 + 3, gateY - 1]], 0, LAND);
    b.propNear("ph-torch", [[gx0 - 1, gateY + 1], [gx1 + 1, gateY + 1]], 0, LAND);
    // 남쪽 통나무 울타리: 문 양옆 6칸씩
    for (let x = 1; x <= ra - 3; x++) {
      if (x >= gx0 - 1 && x <= gx1 + 1) continue;
      b.prop("ph-palisade", x, gateY + 2, 0, LAND, ["open", "field", "wild", "yard"]);
    }
    b.zone("마을 문", "울타리 문·선돌·머리뼈 장대", { x: gx0 - 3, y: gateY - 2, w: gx1 - gx0 + 7, h: 5 });
  }
  // 동굴 앞: 횃불 한 쌍 + 큰 바위
  const cd = cave.doors;
  b.propNear("ph-torch", [[cd[0]!.x - 2, cave.rect.y + cave.rect.h - 1], [cd[0]!.x - 3, cave.rect.y + cave.rect.h - 1]], 0, LAND);
  b.propNear("ph-torch", [[cd[cd.length - 1]!.x + 2, cave.rect.y + cave.rect.h - 1], [cd[cd.length - 1]!.x + 3, cave.rect.y + cave.rect.h - 1]], 0, LAND);
  b.zone("동굴 앞", "동굴 입구와 횃불", { x: cave.rect.x, y: cave.rect.y, w: cave.rect.w, h: cave.rect.h + 2 });
  // 서쪽 작업터: 서쪽 집들 남쪽 흙 마당 — 건조대·가죽 틀·장작·맷돌·꼬치 굽기 + 모닥불
  const yard: Rect = { x: 2, y: pcy + 4, w: Math.max(10, plaza.x - 4), h: Math.min(8, H - pcy - 9) };
  b.zone("작업터", "가죽·고기 손질 마당", yard);
  b.clearRect({ x: yard.x + 1, y: yard.y + 1, w: yard.w - 2, h: yard.h - 2 }, false);
  b.settle();
  const fpx = yard.x + Math.floor(yard.w / 2), fpy = yard.y + Math.floor(yard.h / 2);
  if (b.prop("ph-firepit", fpx, fpy, 1, ["dirt", "dirt-b"])) {
    b.propNear("ph-spit-roast", [[fpx - 1, fpy - 2], [fpx, fpy - 2]], 0, ["dirt", "dirt-b"]);
    seatsAround(b, fpx, fpy, 1, ["ph-log-seat", "ph-stone-seat"], 2, ["dirt", "dirt-b"]);
  }
  b.cluster({ x: yard.x, y: yard.y, w: Math.floor(yard.w / 2), h: yard.h }, ["ph-drying-rack", "ph-hide-frame"], ["dirt", "dirt-b", "edge:grass"], 1);
  b.cluster({ x: yard.x + Math.floor(yard.w / 2), y: yard.y, w: Math.ceil(yard.w / 2), h: yard.h }, ["ph-woodpile", "ph-quern", "ph-basket", "ph-pots"], ["dirt", "dirt-b", "edge:grass"], 0);
  // 집 곁 살림(문 옆 한 칸 띄워): 항아리·바구니 하나씩, 큰 집 옆 장작
  for (const d of blds) {
    const a = d.access[0]!, z = d.access[d.access.length - 1]!;
    const k = /chief/.test(d.kit) ? "ph-spear-rack" : pick(rng, ["ph-pots", "ph-basket", "ph-pots"]);
    const ks = b.kitSize(k);
    b.propNear(k, [[z.x + 2, a.y - 1], [a.x - 1 - ks.w, a.y - 1], [d.rect.x + d.rect.w + 1, a.y - ks.h]], 0, LAND);
  }
  const gran = blds.find((d) => /hut|lodge/.test(d.kit));
  if (gran && b.has("ph-granary")) b.propNear("ph-granary", [[gran.rect.x - 3, gran.rect.y + gran.rect.h - 3], [gran.rect.x + gran.rect.w + 1, gran.rect.y + gran.rect.h - 3]], 0, LAND);
  const shaman = blds.find((d) => d.kit === "ph-shaman-tent");
  if (shaman) {
    b.propNear("ph-skull-pole", [[shaman.doors[0]!.x - 2, shaman.rect.y + shaman.rect.h - 1], [shaman.doors[0]!.x + 2, shaman.rect.y + shaman.rect.h - 1]], 0, LAND);
    b.propNear("ph-bone-pile", [[shaman.rect.x + shaman.rect.w + 1, shaman.rect.y + shaman.rect.h], [shaman.rect.x - 2, shaman.rect.y + shaman.rect.h]], 0, LAND);
  }
  // 물가: 생선 건조대 + 통나무배(둑) + 갈대·속새·연잎
  b.propNear("ph-fish-rack", [[ra - 4, by - 4], [ra - 4, by + 2], [ra - 5, by - 5]], 1, LAND);
  b.propNear("ph-canoe", [[ra - 3, by + 3], [ra - 4, by + 4], [ra - 3, by - 3]], 0, ["dirt", "grass", "edge:water", "edge:grass"]);
  shoreDressing(b, { x: ra - 3, y: 0, w: rb - ra + 7, h: H }, "water", 9, 4);
  // 강 건너 채집터: 열매 덤불·덤불·버섯
  b.zone("강 건너 채집터", "열매 덤불 채집", { x: rb + 2, y: 6, w: W - rb - 3, h: H - 10 });
  b.scatter({ x: rb + 2, y: 7, w: W - rb - 3, h: H - 12 }, ["ph-berry-bush", "ph-bush", "ph-berry-bush", "ph-mushrooms"], 7, [...GREEN, "dirt", "edge:grass"], 1, 23, ["open", "wild", "field"]);
  // 숲: 북쪽 고사리 띠에 정글 나무·아라우카리아·나무고사리·소철, 큰 고사리 포기로 밑을 채운다
  b.zone("북쪽 숲", "고사리 숲 띠", { x: 0, y: 0, w: W, h: 7 });
  b.scatter({ x: 0, y: 0, w: W, h: 9 }, ["ph-jungle-tree", "ph-araucaria", "ph-tree-fern", "ph-jungle-tree", "ph-cycad"], Math.floor(W / 4), ["fern", "edge:fern"], 0, 31, ["open", "wild"]);
  b.scatter({ x: 0, y: 0, w: W, h: 9 }, ["ph-fern-giant", "ph-fern-s", "ph-fern-giant"], Math.floor(W / 4), ["fern", "edge:fern"], 0, 37, ["open", "wild"]);
  // 서쪽 풀밭 가장자리 나무 덩이 · 남쪽 모퉁이 덤불 · 바위 몇 개
  b.scatter({ x: 0, y: 8, w: 6, h: H - 12 }, ["ph-cycad", "ph-tree-fern", "ph-bush"], 4, [...GREEN, "edge:grass"], 1, 43);
  b.scatter({ x: 0, y: H - 6, w: W, h: 6 }, ["ph-bush", "ph-rock-s", "ph-fern-s", "ph-rock-l"], 6, [...GREEN, "dirt", "edge:grass"], 1, 47);
  // 울타리 밖 남쪽 들: 나무 덩이 두셋(숲가 나무·소철·열매 덤불) — 빈 풀밭 띠로 남지 않게(QA 1차)
  const outY = Math.min(H - 2, gateY + 4);
  for (const [i, gx] of [Math.floor(W * 0.08), Math.floor(W * 0.28), Math.floor(W * 0.62)].entries()) {
    const r = { x: gx, y: outY, w: Math.floor(W * 0.16), h: H - outY };
    if (b.cluster(r, ["ph-jungle-tree", "ph-cycad", "ph-berry-bush", "ph-araucaria", "ph-bush", "ph-fern-giant"], [...GREEN, "edge:grass"], 0, ["open", "wild", "field"]) >= 2) b.zone(`남쪽 들 ${i + 1}`, "울타리 밖 나무 덩이·열매 덤불", r);
  }
  // 풀밭 속 암반 언덕: 바위 무더기를 얹어 «바위 언덕»으로 읽히게(맨 포장 바닥처럼 보였다, QA 1차)
  b.cluster({ x: 0, y: Math.floor(H * 0.62) - 4, w: 10, h: 8 }, ["ph-rock-outcrop", "ph-rock-mossy", "ph-rock-l", "ph-rock-s"], ["stone", "edge:stone"], 0, ["open", "wild"]);
  // 들꽃(풀밭 위 덧그림, 드문드문)
  const fl = b.pal.tile("flowers");
  if (fl >= 0) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x;
    if ((b.ground[k] === "grass") && b.upper[k] < 0 && b.use[k] === "open" && !b.reserved[k] && vnoise(x, y, 4, b.seed + 61) > 0.72 && hash2(x, y, b.seed + 3) < 0.4) b.upper[k] = fl;
  }
  b.fillEmpty([{ grounds: ["grass", "grass-b", "edge:grass"], kits: ["ph-jungle-tree", "ph-araucaria", "ph-cycad", "ph-berry-bush", "ph-bush", "ph-rock-l"], zone: "풀밭 나무 덩이" },
    { grounds: ["fern", "edge:fern"], kits: ["ph-tree-fern", "ph-jungle-tree", "ph-fern-giant", "ph-fern-s"], zone: "고사리 숲 덩이" },
    { grounds: ["dirt", "dirt-b"], kits: ["ph-rock-l", "ph-bush", "ph-rock-s"], zone: "맨땅 바위" },
    { grounds: ["stone", "edge:stone"], kits: ["ph-rock-outcrop", "ph-rock-mossy", "ph-rock-l"], zone: "바위 언덕" }]);
  return start;
}

// ───────────────────────── 늪지 ─────────────────────────
function composeSwamp(b: Board, rng: () => number): PrehistoricCell {
  const { W, H } = b;
  // ① 땅: 거의 전부 진흙(단 1) + 늪 물 웅덩이(단 2) 여럿, 북쪽 고사리 숲가, 섬(흙) 둘·셋
  b.band("fern", 1, (x) => 4 + Math.round((vnoise(x, 0, 5, b.seed + 2) - 0.5) * 3), true);
  b.band("mud", 1, (x) => 7 + Math.round((vnoise(x, 0, 6, b.seed + 3) - 0.5) * 3), false, true);
  const pools: [number, number, number, number][] = [];
  for (let i = 0; i < 7; i++) {
    const cx = 4 + rng() * (W - 8), cy = 10 + rng() * (H - 16), rx = 2.5 + rng() * 4, ry = 2 + rng() * 2.5;
    pools.push([cx, cy, rx, ry]);
    b.blob("mud", 2, cx, cy, rx, ry, 0.35, false, i * 13);
  }
  // 진흙 벌 변주: 마른 땅 몇 · 고사리 섬 몇(띠 통째 진흙이 되지 않게)
  for (let i = 0; i < 5; i++) b.hole(3 + rng() * (W - 6), 10 + rng() * (H - 14), 1.4 + rng() * 1.6, 1 + rng(), 0.4, 300 + i);
  for (let i = 0; i < 3; i++) {
    const cx = 3 + rng() * (W - 6), cy = 12 + rng() * (H - 16), rx = 1.8 + rng();
    b.hole(cx, cy, rx + 1.6, 2.9, 0.1, 400 + i);        // 진흙 ↔ 고사리 사이 흙 띠(다른 가족은 한 칸에 모이지 않는다)
    b.blob("fern", 1, cx, cy, rx, 1.3, 0.2, true, 400 + i);
  }
  b.open("mud", 2);   // 웅덩이에 매달린 한 칸 폭 도랑·외톨이 물 칸을 진흙으로(QA 1차)
  // 섬: 흙 덩이(집터) — 웅덩이를 지운다
  const islands: [number, number][] = [[Math.floor(W * 0.25), Math.floor(H * 0.42)], [Math.floor(W * 0.68), Math.floor(H * 0.35)], [Math.floor(W * 0.5), Math.floor(H * 0.72)]];
  const isleCells: PrehistoricCell[][] = islands.map(([cx, cy]) => {
    const out: PrehistoricCell[] = [];
    for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 6; x <= cx + 6; x++) {
      const dx = (x - cx) / 6.2, dy = (y - cy) / 4.3, n = (vnoise(x, y, 3, b.seed + 71) - 0.5) * 0.5;
      if (dx * dx + dy * dy <= 1 + n && b.in(x, y)) out.push({ x, y });
    }
    return out;
  });
  for (const cells of isleCells) b.clearCells(cells);
  // 남쪽 흙 들머리(출구)
  const start = { x: Math.floor(W / 2) + Math.floor(rng() * 5) - 2, y: H - 1 };
  b.clearRect({ x: start.x - 3, y: H - 3, w: 7, h: 3 });
  b.settle();
  islands.forEach(([cx, cy], i) => b.zone(`섬 ${i + 1}`, "늪 속 흙 섬(집터)", { x: cx - 6, y: cy - 4, w: 13, h: 9 }));
  b.zone("늪", "진흙과 늪 웅덩이", { x: 0, y: 7, w: W, h: H - 7 });
  // ② 집: 섬마다 하나(통나무 움집·차양·이엉 움집)
  const kits = shuffle(rng, ["ph-hut-log", "ph-hut-thatch-s", "ph-lean-to"]).filter((k) => b.has(k));
  const blds: PrehistoricBuilding[] = [];
  islands.forEach(([cx, cy], i) => {
    const k = kits[i % kits.length]!, s = b.kitSize(k);
    const x = cx - Math.floor(s.w / 2), y = cy - s.h + 1;
    if (k === "ph-lean-to") { if (b.prop(k, x, y + 1, 0, ["dirt", "dirt-b", "edge:mud"])) b.reserve({ x, y: y + 3, w: s.w, h: 1 }); return; }
    blds.push(b.building(k, x, y));
  });
  for (const d of blds) b.ring(d.rect);
  // ③ 둑길: 들머리 → 섬 → 섬. 웅덩이를 지나면 진흙 둑을 돋운다(늪 물 꼭짓점을 진흙으로), 큰 물은 밧줄 다리
  const avoid = (x: number, y: number) => b.use[y * W + x] === "bld" || (b.reserved[y * W + x] && !accessNear(x, y));
  const acc = new Set(blds.flatMap((d) => d.access.map((c) => `${c.x},${c.y}`)));
  function accessNear(x: number, y: number) { return acc.has(`${x},${y}`) || acc.has(`${x},${y - 1}`); }
  const targets = [...blds.map((d) => d.access[0]!), ...islands.map(([cx, cy]) => ({ x: cx, y: cy + 3 }))];
  const way: PrehistoricCell[] = [];
  let from: PrehistoricCell = start;
  const order = targets.slice(0, islands.length).sort((a, c) => c.y - a.y);
  for (const t of order) { way.push(...route(b, from, t, avoid, 1.2)); from = t; }
  for (const d of blds) way.push(...route(b, d.access[0]!, order[0]!, avoid, 0.5));
  const wayLand = way.filter((c) => b.use[c.y * W + c.x] !== "bld");
  // 둑: 길 칸의 꼭짓점을 진흙 단 1 로 잠근다(웅덩이를 가르는 진흙 둑) — 섬 위는 흙 그대로
  for (const c of wayLand) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
    const i = b.vi(c.x + dx, c.y + dy);
    if (b.vf[i] === "mud" && b.vl[i]! >= 2) { b.vl[i] = 1; b.vlock[i] = true; }
  }
  for (const c of wayLand) b.use[c.y * W + c.x] = "path";
  b.settle();
  b.zone("둑길", "웅덩이를 가르는 진흙 둑", { x: 0, y: 8, w: W, h: H - 8 });
  b.start = start;
  // ④ 소품: 늪 나무(진흙), 나무고사리(숲가), 갈대·속새(웅덩이 가), 연잎, 타르 웅덩이, 이끼 바위, 버섯, 섬 살림
  const MUD = ["mud", "edge:mud"];
  b.scatter({ x: 0, y: 7, w: W, h: H - 9 }, ["ph-swamp-tree", "ph-swamp-tree", "ph-tree-fern"], Math.floor(W * H / 110), MUD, 1, 17, ["open", "wild"]);
  b.scatter({ x: 0, y: 0, w: W, h: 8 }, ["ph-tree-fern", "ph-jungle-tree", "ph-fern-giant", "ph-cycad"], Math.floor(W / 4), ["fern", "edge:fern"], 0, 19, ["open", "wild"]);
  b.scatter({ x: 0, y: 0, w: W, h: 9 }, ["ph-fern-s", "ph-fern-giant"], Math.floor(W / 5), ["fern", "edge:fern"], 0, 29, ["open", "wild"]);
  for (const [cx, cy, rx, ry] of pools) shoreDressing(b, { x: Math.floor(cx - rx - 2), y: Math.floor(cy - ry - 2), w: Math.ceil(rx * 2 + 4), h: Math.ceil(ry * 2 + 4) }, "swamp", 3, 3);
  b.propNear("ph-tarpit", shuffle(rng, Array.from({ length: 40 }, (_, i) => [3 + (i * 7) % (W - 8), 9 + ((i * 5) % (H - 14))] as [number, number])), 1, ["mud"]);
  b.scatter({ x: 0, y: 8, w: W, h: H - 10 }, ["ph-rock-mossy", "ph-mushrooms", "ph-rock-s"], 5, ["mud", "edge:mud", "dirt"], 1, 59);
  for (const [i, [cx, cy]] of islands.entries()) {
    const r = { x: cx - 5, y: cy - 3, w: 11, h: 7 };
    const kitsI = i === 0 ? ["ph-firepit", "ph-fish-rack", "ph-pots"] : i === 1 ? ["ph-drying-rack", "ph-basket", "ph-woodpile"] : ["ph-firepit", "ph-log-seat", "ph-basket"];
    b.cluster({ x: r.x, y: r.y + 3, w: r.w, h: r.h - 2 }, kitsI, ["dirt", "dirt-b"], 0);
  }
  // 통나무배: 섬 가 웅덩이 둑
  b.propNear("ph-canoe", shuffle(rng, islands.flatMap(([cx, cy]) => [[cx + 6, cy + 1], [cx - 8, cy + 1], [cx - 1, cy + 5]] as [number, number][])), 0, ["edge:swamp"]);
  b.fillEmpty([{ grounds: ["mud", "edge:mud"], kits: ["ph-swamp-tree", "ph-horsetail", "ph-rock-mossy", "ph-mushrooms"], zone: "늪 나무 덩이" },
    { grounds: ["fern", "edge:fern"], kits: ["ph-tree-fern", "ph-fern-giant", "ph-fern-s"], zone: "고사리 덩이" },
    { grounds: ["dirt", "dirt-b"], kits: ["ph-bush", "ph-rock-s", "ph-berry-bush"], zone: "마른 땅 덤불" }]);
  return start;
}

// ───────────────────────── 화산 골짜기 ─────────────────────────
function composeVolcano(b: Board, rng: () => number): PrehistoricCell {
  const { W, H } = b;
  // ① 땅: 북쪽 2/3 화산재(단 1), 용암 웅덩이 둘(단 3) 둘레 굳은 용암(단 2), 남쪽 흙 들머리 + 사냥 야영지
  b.band("ash", 1, (x) => H - 9 + Math.round((vnoise(x, 0, 7, b.seed + 4) - 0.5) * 5), true);
  const vx = Math.floor(W / 2) - 2 + Math.floor(rng() * 5) - 2;
  const lavaA: [number, number] = [Math.floor(W * 0.24) + Math.floor(rng() * 4), Math.floor(H * 0.42)];
  const lavaB: [number, number] = [Math.floor(W * 0.74) - Math.floor(rng() * 4), Math.floor(H * 0.55)];
  for (const [i, [cx, cy]] of [lavaA, lavaB].entries()) {
    b.blob("ash", 2, cx, cy, 5.5, 3.6, 0.35, false, i * 7);
    b.blob("ash", 3, cx, cy, 3.4, 2.1, 0.3, false, i * 7 + 3);
  }
  // 재 벌판 변주: 굳은 용암 판 조각 · 맨땅 구멍(띠 통째 재가 되지 않게)
  for (let i = 0; i < 7; i++) b.blob("ash", 2, 3 + rng() * (W - 6), 6 + rng() * (H - 18), 1.1 + rng() * 0.8, 0.9 + rng() * 0.6, 0.3, false, 100 + i);
  // (맨땅 구멍은 뺐다 — 쓰임 없는 흙 네모가 재 벌판에 흩어져 보였다, QA 1차. 재 벌판 변주는 굳은 용암 판 조각 + ash-b 덩이로 충분하다.)
  for (let i = 0; i < 5; i++) rng();
  b.open("ash", 3);   // 용암 웅덩이 끝 실오라기 정리(줄기는 이 뒤에 그린다)
  // 화산 언덕 아래 흐르는 용암 줄기(언덕 밑 → 웅덩이 A 쪽)
  for (let y = 7; y < lavaA[1]; y++) {
    const t = (y - 7) / Math.max(1, lavaA[1] - 7), x = Math.round(vx + 2 + (lavaA[0] - vx - 2) * t + (vnoise(0, y, 4, b.seed + 9) - 0.5) * 2);
    b.vset(x, y, "ash", 3); b.vset(x + 1, y, "ash", 3);
  }
  for (let i = 0; i < 3; i++) b.blob("grass", 1, 4 + rng() * (W - 8), H - 2 - rng() * 2, 3 + rng() * 3, 1.6, 0.4, false, 700 + i);   // 들머리 풀 덩이
  const start = { x: Math.floor(W / 2) + Math.floor(rng() * 5) - 2, y: H - 1 };
  // 길: 남쪽 들머리 → 화산 동굴(동/서 가장자리)
  const caveKit = b.has("ph-cave-mouth-v") ? "ph-cave-mouth-v" : "ph-cave-mouth";
  const cs = b.kitSize(caveKit);
  const caveLeft = lavaA[0] > W / 2;
  const cvx = caveLeft ? 2 : W - cs.w - 2, cvy = Math.floor(H * 0.18);
  b.clearRect({ x: cvx - 1, y: cvy + cs.h - 2, w: cs.w + 2, h: 3 });
  b.settle();
  const cave = b.building(caveKit, cvx, cvy);
  b.ring(cave.rect);
  b.zone("화산 동굴", "현무암 동굴 입구", cave.rect);
  // 작은 화산 언덕(북쪽 가운데)
  if (b.has("ph-volcano-s")) b.propNear("ph-volcano-s", [[vx, 1], [vx, 0], [vx - 1, 1], [vx + 1, 1]], 0, ["ash", "edge:ash", "dirt", "crust", "edge:crust", "edge:lava"], ["open", "wild"]);
  b.zone("화산", "빛나는 분화구 언덕", { x: vx, y: 1, w: 5, h: 4 });
  const avoid = (x: number, y: number) => b.use[y * W + x] === "bld" || b.use[y * W + x] === "prop" || WET.has(b.ground[y * W + x]!) || b.ground[y * W + x] === "edge:lava" || (b.reserved[y * W + x] && !(x === cave.access[0]!.x && (y === cave.access[0]!.y || y === cave.access[0]!.y + 1)));
  const trail = route(b, start, cave.access[0]!, avoid, 3);
  b.clearCells(trail.filter((c) => b.use[c.y * W + c.x] !== "bld"));
  b.paint("path", trail.filter((c) => b.use[c.y * W + c.x] !== "bld" && b.ground[c.y * W + c.x] !== "edge:crust"), "path");
  b.settle();
  b.start = start;
  // ② 사냥 야영지(남쪽 흙): 차양 + 모닥불 + 돌 의자 + 건조대 + 뼈 더미
  const campX = start.x < W / 2 ? start.x + 4 : start.x - 14, campY = H - 8;
  const camp: Rect = { x: Math.max(1, campX), y: campY, w: 11, h: 6 };
  b.zone("사냥 야영지", "차양·모닥불·건조대", camp);
  b.cluster({ x: camp.x, y: camp.y, w: camp.w, h: 3 }, ["ph-lean-to"], ["dirt", "dirt-b", "edge:ash"], 1);
  const fpx = camp.x + 5, fpy = camp.y + 4;
  if (b.prop("ph-firepit", fpx, fpy, 1, ["dirt", "dirt-b", "edge:ash"])) seatsAround(b, fpx, fpy, 1, ["ph-stone-seat", "ph-log-seat"], 3, ["dirt", "dirt-b", "edge:ash"]);
  b.cluster({ x: camp.x, y: camp.y + 2, w: camp.w, h: 4 }, ["ph-drying-rack", "ph-bone-pile", "ph-spear-rack"], ["dirt", "dirt-b", "edge:ash"], 0);
  // ③ 화산 소품: 현무암 기둥(용암 웅덩이 둘레), 용암 첨탑, 흑요석, 증기 구멍, 고목 무리, 뼈 더미
  const ASH = ["ash", "edge:ash", "crust", "edge:crust"];
  for (const [cx, cy] of [lavaA, lavaB]) {
    b.cluster({ x: cx - 9, y: cy - 6, w: 18, h: 12 }, ["ph-basalt-columns", "ph-lava-spire", "ph-obsidian", "ph-vent", "ph-obsidian"], ASH, 1, ["open", "wild"]);
  }
  b.scatter({ x: 0, y: 2, w: W, h: H - 10 }, ["ph-dead-tree", "ph-dead-tree", "ph-lava-spire"], 6, ["ash", "edge:ash"], 1, 67, ["open", "wild"]);
  b.scatter({ x: 0, y: 2, w: W, h: H - 10 }, ["ph-vent", "ph-obsidian", "ph-bone-pile"], 6, ["ash", "crust"], 1, 71, ["open", "wild"]);
  b.scatter({ x: 0, y: 0, w: W, h: 6 }, ["ph-basalt-columns", "ph-rock-l"], 4, ["ash", "edge:ash"], 1, 73, ["open", "wild"]);
  // 죽은 숲 두 덩이(재에 묻힌 고목 무리 + 바위 + 뼈) — 넓은 재 벌판이 비어 보이지 않게, 흩뿌리지 않고 무리로(QA 1차)
  const groveSpots: [number, number][] = shuffle(rng, [[2, 4], [W - 12, 4], [2, H - 18], [W - 12, H - 18], [Math.floor(W / 2) - 4, Math.floor(H / 2) - 2], [Math.floor(W * 0.3), 3], [Math.floor(W * 0.6), H - 18]]);
  let groves = 0;
  for (const [gx, gy] of groveSpots) {
    if (groves >= 2) break;
    const r = { x: gx, y: gy, w: 10, h: 7 };
    if (b.cluster(r, ["ph-dead-tree", "ph-dead-tree", "ph-rock-l", "ph-dead-tree", "ph-bone-pile", "ph-rock-s"], ["ash", "edge:ash"], 0, ["open", "wild"]) >= 3) { b.zone("죽은 숲", "재에 묻힌 고목 무리", r); groves++; }
  }
  // 남쪽 들머리 가장자리 바위·덤불
  b.scatter({ x: 0, y: H - 7, w: W, h: 7 }, ["ph-rock-s", "ph-bush", "ph-rock-l"], 5, ["dirt", "dirt-b", "edge:ash"], 1, 79);
  b.fillEmpty([{ grounds: ["ash", "edge:ash", "crust", "edge:crust"], kits: ["ph-dead-tree", "ph-rock-l", "ph-basalt-columns", "ph-dead-tree", "ph-bone-pile", "ph-obsidian"], zone: "죽은 숲" },
    { grounds: ["dirt", "dirt-b"], kits: ["ph-rock-l", "ph-bush", "ph-rock-s"], zone: "바위 덤불" },
    { grounds: ["grass", "grass-b", "edge:grass"], kits: ["ph-bush", "ph-cycad", "ph-rock-s"], zone: "풀 덤불" }]);
  return start;
}

// ───────────────────────── 화석 계곡 ─────────────────────────
function composeFossil(b: Board, rng: () => number): PrehistoricCell {
  const { W, H } = b;
  // ① 땅: 동·서 풀 언덕(단 1) 위 암반 능선(단 2), 가운데 흙 골짜기, 진흙 웅덩이(발자국 길), 북쪽 동굴
  const west = (y: number) => 7 + Math.round((vnoise(0, y, 6, b.seed + 5) - 0.5) * 5);
  const east = (y: number) => W - 8 + Math.round((vnoise(9, y, 6, b.seed + 6) - 0.5) * 5);
  for (let y = 0; y <= H; y++) {
    for (let x = 0; x <= west(y); x++) b.vset(x, y, "grass", x <= west(y) - 3 ? 2 : 1);
    for (let x = east(y); x <= W; x++) b.vset(x, y, "grass", x >= east(y) + 3 ? 2 : 1);
  }
  // 골짜기 바닥에 풀 덩이 조금(띠 통째 흙이 되지 않게)
  b.blob("grass", 1, W * 0.5, H - 4, 5, 3, 0.4, false, 3);
  for (let i = 0; i < 4; i++) b.blob("grass", 1, 12 + rng() * (W - 24), 6 + rng() * (H - 14), 1.6 + rng() * 1.6, 1.2 + rng(), 0.4, false, 500 + i);
  for (let i = 0; i < 4; i++) b.hole(rng() < 0.5 ? 2 + rng() * 4 : W - 6 + rng() * 4, 4 + rng() * (H - 8), 1.2 + rng(), 1, 0.4, 600 + i);
  b.blob("mud", 1, W * 0.62, H * 0.62, 5, 2.6, 0.3, false, 5);
  const start = { x: Math.floor(W / 2) - 4 + Math.floor(rng() * 4), y: H - 1 };
  const caveKit = b.has("ph-cave-mouth") ? "ph-cave-mouth" : "ph-cave-mouth-l";
  const cs = b.kitSize(caveKit);
  const cvx = Math.floor(W / 2) - Math.floor(cs.w / 2) + (rng() < 0.5 ? -6 : 6), cvy = 1;
  b.clearRect({ x: cvx - 1, y: cvy + cs.h - 2, w: cs.w + 2, h: 4 });
  // 발굴터(자갈 바닥) — 긴 목 뼈대 둘레
  const dig: Rect = { x: Math.floor(W / 2) - 6, y: Math.floor(H * 0.32), w: 12, h: 7 };
  b.clearRect(dig);
  b.settle();
  const cave = b.building(caveKit, cvx, cvy);
  b.ring(cave.rect);
  b.zone("뼈 동굴", "계곡 북쪽 동굴", cave.rect);
  const digCells: PrehistoricCell[] = [];
  for (let y = dig.y + 1; y < dig.y + dig.h - 1; y++) for (let x = dig.x + 1; x < dig.x + dig.w - 1; x++) {
    const dx = (x + 0.5 - dig.x - dig.w / 2) / (dig.w / 2 - 0.6), dy = (y + 0.5 - dig.y - dig.h / 2) / (dig.h / 2 - 0.6);
    if (dx * dx + dy * dy <= 1.05) digCells.push({ x, y });
  }
  b.paint("gravel", digCells, "yard");
  b.zone("발굴터", "긴 목 공룡 뼈대 발굴 자갈 바닥", dig);
  // 길: 들머리 → 동굴, 발굴터 곁으로
  const avoid = (x: number, y: number) => b.use[y * W + x] === "bld" || b.ground[y * W + x] === "stone" || b.ground[y * W + x] === "edge:stone" || (b.reserved[y * W + x] && !(x === cave.access[0]!.x && y >= cave.access[0]!.y && y <= cave.access[0]!.y + 1));
  const trail = route(b, start, cave.access[0]!, (x, y) => avoid(x, y) || (x >= dig.x && x < dig.x + dig.w && y >= dig.y && y < dig.y + dig.h), 1.0);
  const tr = trail.filter((c) => b.use[c.y * W + c.x] !== "bld");
  b.clearCells(tr);
  b.paint("path", tr, "path");
  b.settle();
  b.start = start;
  // ② 화석: 긴 목 뼈대(발굴터 가운데), 갈비뼈(서쪽 언덕 밑), 공룡 머리뼈, 화석 바위(능선 밑), 뼈 더미 무리
  b.propNear("ph-longneck", [[dig.x + 3, dig.y + 2], [dig.x + 2, dig.y + 2], [dig.x + 3, dig.y + 1]], 0, ["gravel"], ["yard"]);
  b.cluster({ x: dig.x, y: dig.y, w: dig.w, h: dig.h }, ["ph-bone-pile", "ph-basket", "ph-bone-pile-l"], ["gravel"], 0, ["yard"]);
  const valley = (x: number, y: number) => x > west(y) + 1 && x < east(y) - 1;
  const midW = { x: 8, y: Math.floor(H * 0.55), w: Math.floor(W / 2) - 10, h: Math.floor(H * 0.3) };
  b.cluster(midW, ["ph-ribcage"], ["dirt", "dirt-b", "edge:grass"], 1);
  b.cluster({ x: Math.floor(W / 2) + 2, y: Math.floor(H * 0.2), w: Math.floor(W / 2) - 10, h: 8 }, ["ph-dino-skull", "ph-bone-pile"], ["dirt", "dirt-b", "edge:grass"], 1);
  b.scatter({ x: 0, y: 2, w: W, h: H - 4 }, ["ph-fossil-rock", "ph-rock-outcrop", "ph-rock-l", "ph-fossil-rock"], 8, ["stone", "edge:stone", "grass", "edge:grass"], 1, 83, ["open", "wild"]);
  // 발자국 길: 진흙 웅덩이 위로 두세 개씩 비스듬히
  const fp = b.pal.tile("footprints");
  if (fp >= 0) {
    const fx0 = Math.floor(W * 0.62) - 5, fy0 = Math.floor(H * 0.62);
    for (let i = 0; i < 6; i++) {
      const x = fx0 + i * 2, y = fy0 + (i % 2);
      if (!b.in(x, y)) continue;
      const k = y * W + x;
      if ((b.ground[k] === "mud" || b.ground[k] === "dirt") && b.upper[k] < 0 && b.use[k] !== "path" && !b.reserved[k]) b.upper[k] = fp;
    }
    b.zone("발자국 진흙", "큰 짐승 발자국이 찍힌 진흙", { x: Math.floor(W * 0.62) - 6, y: Math.floor(H * 0.62) - 3, w: 12, h: 6 });
  }
  // 타르 웅덩이(빠진 뼈) — 골짜기 동쪽
  b.cluster({ x: Math.floor(W * 0.6), y: Math.floor(H * 0.38), w: 10, h: 6 }, ["ph-tarpit"], ["dirt", "dirt-b", "mud"], 1);
  // 발굴 야영지(남서): 가죽 천막(문) + 모닥불 + 건조대 + 창 걸이
  const tipiS = b.has("ph-tipi") ? b.kitSize("ph-tipi") : { w: 3, h: 4 };
  const tx = Math.max(west(H - 8) + 3, 9), ty = H - 6 - tipiS.h + 1;
  let tipi: PrehistoricBuilding | null = null;
  if (b.has("ph-tipi") && b.free({ x: tx, y: ty, w: tipiS.w, h: tipiS.h }, 1, ["dirt", "dirt-b", "grass", "edge:grass", "path"], ["open", "wild", "field", "path"])) {
    b.start = null;
    tipi = b.building("ph-tipi", tx, ty); b.ring(tipi.rect);
    const t2 = route(b, tipi.access[0]!, start, (x, y) => b.use[y * W + x] === "bld" || b.ground[y * W + x] === "stone", 0.4);
    b.clearCells(t2); b.paint("path", t2, "path"); b.settle();
    b.start = start;
  }
  const camp = { x: tx - 2, y: H - 7, w: 12, h: 6 };
  b.zone("발굴 야영지", "천막·모닥불·건조대", camp);
  const fpx = tx + tipiS.w + 2, fpy = H - 5;
  if (b.prop("ph-firepit", fpx, fpy, 1, ["dirt", "dirt-b", "grass", "edge:grass"])) seatsAround(b, fpx, fpy, 1, ["ph-log-seat", "ph-stone-seat"], 2, ["dirt", "dirt-b", "grass", "edge:grass"]);
  b.cluster(camp, ["ph-drying-rack", "ph-spear-rack", "ph-pots"], ["dirt", "dirt-b", "grass", "edge:grass"], 0);
  // 의식: 고인돌 · 선돌 줄(동쪽 언덕 밑 길가)
  b.cluster({ x: Math.floor(W * 0.7), y: H - 10, w: 10, h: 7 }, ["ph-dolmen", "ph-menhir", "ph-menhir"], ["dirt", "dirt-b", "grass", "edge:grass"], 1);
  // 언덕 나무: 아라우카리아·소철·나무고사리(풀 위)
  b.scatter({ x: 0, y: 0, w: W, h: H - 2 }, ["ph-araucaria", "ph-cycad", "ph-tree-fern", "ph-araucaria"], 9, ["grass", "edge:grass"], 1, 89, ["open", "wild"]);
  b.scatter({ x: 0, y: 0, w: W, h: H }, ["ph-bush", "ph-fern-s", "ph-rock-s"], 8, ["grass", "edge:grass", "dirt"], 1, 97, ["open", "wild"]);
  // 골짜기 바닥: 흩어진 뼈·화석 조각 무리 두 곳(발굴터에서 쓸려 내려온 뼈) — 넓은 흙 골짜기가 비지 않게(QA 1차)
  for (const [i, r] of [{ x: Math.floor(W / 2) + 3, y: Math.floor(H * 0.5), w: 9, h: 6 }, { x: Math.floor(W * 0.22), y: Math.floor(H * 0.18), w: 9, h: 6 }].entries()) {
    if (b.cluster(r, ["ph-bone-pile-l", "ph-bone-pile", "ph-rock-s", "ph-fern-s", "ph-bone-pile"], ["dirt", "dirt-b", "edge:grass", "edge:mud"], 0, ["open", "wild"]) >= 2) b.zone(`뼈 무더기 ${i + 1}`, "쓸려 내려온 뼈·화석 조각", r);
  }
  void valley;
  if (!tipi) b.notes.push("발굴 야영지 천막 자리가 없어 천막 없이 지었다");
  b.fillEmpty([{ grounds: ["dirt", "dirt-b", "edge:mud", "mud"], kits: ["ph-bone-pile-l", "ph-rock-l", "ph-fern-s", "ph-bone-pile", "ph-bush"], zone: "뼈 무더기" },
    { grounds: ["grass", "grass-b", "edge:grass"], kits: ["ph-araucaria", "ph-cycad", "ph-bush", "ph-tree-fern"], zone: "언덕 나무" },
    { grounds: ["stone", "stone-b", "edge:stone"], kits: ["ph-rock-outcrop", "ph-fossil-rock", "ph-rock-l"], zone: "바위 능선" }]);
  return start;
}

// ───────────────────────── 실내 ─────────────────────────
interface RoomLook { readonly floor: string; readonly wall: "rock" | "wattle" | "hide"; readonly cave: boolean }
const ROOM_LOOK: Readonly<Record<PrehistoricRoomStyle, RoomLook>> = {
  "cave-dwelling": { floor: "floor-cave", wall: "rock", cave: true },
  "cave-gallery": { floor: "floor-cave", wall: "rock", cave: true },
  "chieftain-hut": { floor: "floor-hut", wall: "wattle", cave: false },
  "shaman-hut": { floor: "floor-hut", wall: "hide", cave: false },
};
const ROOM_NAME: Readonly<Record<PrehistoricRoomStyle, string>> = { "cave-dwelling": "동굴 거처", "cave-gallery": "동굴 벽화 회랑", "chieftain-hut": "족장 집 안", "shaman-hut": "무당 천막 안" };

/**
 * 방: 바깥은 천장 바위, 바닥 덩이(동굴은 열마다 윗변이 오르내리는 불규칙 모양), 바닥 윗변 위 두 줄은 벽면(위 u · 아래 d, 끝 칸 -l·-r),
 * 맨 아래 줄 가운데 출입구 틈(2칸). 벽화·벽걸이는 벽면에만, 가구는 바닥에만.
 */
function composeRoom(b: Board, rng: () => number, style: PrehistoricRoomStyle): PrehistoricCell {
  const { W, H } = b;
  const look = ROOM_LOOK[style];
  // ① 바닥 모양: 열마다 윗변 top[x] (3 이상), 아랫변 bot[x], 좌우 끝 열 x0..x1
  const x0 = 1, x1 = W - 2;
  const top: number[] = [], bot: number[] = [];
  for (let x = 0; x < W; x++) {
    if (!look.cave) { top.push(3); bot.push(H - 2); continue; }
    // 동굴: 2~3 칸 너비 계단으로 오르내린다(낱칸 들쭉날쭉 금지 — 벽면 끝 조각이 어지럽다)
    const seg = Math.floor(x / 3);
    top.push(3 + Math.round(vnoise(seg * 3, 0, 6, b.seed + 21) * 2));
    bot.push(H - 2 - Math.round(vnoise(seg * 3, 9, 5, b.seed + 23) * 1.4));
  }
  const ex = Math.floor(W / 2) - 1;
  const isFloor = (x: number, y: number) => x >= x0 && x <= x1 && y >= top[x]! && (y <= bot[x]! || (y === H - 1 && (x === ex || x === ex + 1)) || (y >= bot[x]! && (x === ex || x === ex + 1)));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x;
    if (isFloor(x, y)) { b.over[k] = look.floor; b.use[k] = "floor"; }
    else if (x >= x0 && x <= x1 && (y === top[x]! - 1 || y === top[x]! - 2)) {
      const part = y === top[x]! - 2 ? "u" : "d";
      const lEnd = x === x0 || top[x - 1]! !== top[x]!, rEnd = x === x1 || top[x + 1]! !== top[x]!;
      b.over[k] = `wall-${look.wall}-${part}${lEnd && !rEnd ? "-l" : rEnd && !lEnd ? "-r" : ""}`;
      b.use[k] = "wall";
    } else { b.over[k] = "ceil"; b.use[k] = "ceil"; }
  }
  // 천장 가장자리 조각: 이웃(북·동·서)에 바닥·벽면이 있으면 그쪽 테
  const open = (x: number, y: number) => b.in(x, y) && (b.use[y * W + x] === "floor" || b.use[y * W + x] === "wall");
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x;
    if (b.use[k] !== "ceil") continue;
    const key = (open(x, y - 1) ? "n" : "") + (open(x + 1, y) ? "e" : "") + (open(x - 1, y) ? "w" : "");
    if (key) b.over[k] = b.pal.tile(`ceil-${key}`) >= 0 ? `ceil-${key}` : "ceil";
  }
  b.settle();
  b.variety();
  const fy0 = Math.min(...top.slice(x0, x1 + 1)), fy1 = Math.max(...bot.slice(x0, x1 + 1));
  b.zone(ROOM_NAME[style], style, { x: x0, y: fy0, w: x1 - x0 + 1, h: fy1 - fy0 + 1 });
  const start = { x: ex, y: H - 1 };
  b.reserve({ x: ex, y: H - 2, w: 2, h: 2 });
  b.start = start;
  const FLOOR = [look.floor, `${look.floor}-b`, "floor-straw"];
  const xs = (a: number, c: number) => { const o: number[] = []; for (let x = a; x <= c; x++) o.push(x); return o; };
  /** 벽면 두 줄 위 장식: 벽화(rock)·벽걸이 — 벽면 아랫줄(d)에 건다(1×2 는 u·d 두 줄). */
  const wallHang = (kit: string, cands: readonly number[]) => {
    if (!b.has(kit)) return false;
    const s = b.kitSize(kit);
    for (const x of cands) {
      if (x < x0 || x + s.w - 1 > x1) continue;
      const ty = top[x]!, y = ty - s.h;
      let ok = true;
      for (let i = 0; i < s.w; i++) for (let j = 0; j < s.h; j++) { const k = (y + j) * W + x + i; if (top[x + i] !== ty || b.use[k] !== "wall" || b.upper[k] >= 0 || String(b.over[k]).startsWith("paint-") || /-(l|r)$/.test(String(b.over[k]))) ok = false; }
      if (!ok) continue;
      b.stamp(kit, x, y, "wall"); b.props.push({ kit, x, y });
      return true;
    }
    return false;
  };
  /** 벽화: 벽면 두 줄을 그림 조각으로 바꾼다(rock 벽만). 두 칸 폭은 같은 높이 두 열. */
  const mural = (art: string, wide: boolean, cands: readonly number[]) => {
    for (const x of cands) {
      const cols = wide ? [x, x + 1] : [x];
      if (cols.some((c) => c < x0 || c > x1 || top[c] !== top[x] || b.upper[(top[c]! - 1) * W + c]! >= 0 || b.upper[(top[c]! - 2) * W + c]! >= 0)) continue;
      if (cols.some((c) => !String(b.over[(top[c]! - 1) * W + c]).startsWith(`wall-rock-d`) || /-(l|r)$/.test(String(b.over[(top[c]! - 1) * W + c])))) continue;
      cols.forEach((c, i) => {
        const nm = wide ? `paint-${art}-${i}` : `paint-${art}`;
        b.lower[(top[c]! - 2) * W + c] = b.t(`${nm}-u`); b.lower[(top[c]! - 1) * W + c] = b.t(`${nm}-d`);
        b.over[(top[c]! - 2) * W + c] = `${nm}-u`; b.over[(top[c]! - 1) * W + c] = `${nm}-d`;
      });
      return x;
    }
    return -1;
  };
  /** 북쪽 벽에 등을 대는 가구(그 열 바닥 윗줄에). */
  const backWall = (kit: string, cands: readonly number[], margin = 0) => {
    if (!b.has(kit)) return null;
    const s = b.kitSize(kit);
    for (const x of cands) {
      if (x < x0 || x + s.w - 1 > x1) continue;
      const y = Math.max(...xs(x, x + s.w - 1).map((c) => top[c]!));
      if (b.prop(kit, x, y, margin, FLOOR, ["floor"])) return { x, y };
    }
    return null;
  };
  const anywhere = (kit: string, n: number, margin = 1) => {
    if (!b.has(kit)) return 0;
    const s = b.kitSize(kit); let k = 0;
    const spots = shuffle(rng, xs(x0, x1 - s.w + 1).flatMap((x) => xs(fy0 + 1, fy1 - s.h + 1).map((y) => [x, y] as [number, number])));
    for (const [x, y] of spots) { if (k >= n) break; if (b.prop(kit, x, y, margin, FLOOR, ["floor"])) k++; }
    return k;
  };
  const corner = (kit: string, side?: "l" | "r") => {
    if (!b.has(kit)) return false;
    const s = b.kitSize(kit);
    const L: [number, number][] = xs(x0, x0 + 2).flatMap((x) => [bot[x]! - s.h + 1, top[x]!].map((y) => [x, y] as [number, number]));
    const R: [number, number][] = xs(x1 - s.w - 1, x1 - s.w + 1).flatMap((x) => [bot[x + s.w - 1]! - s.h + 1, top[x]!].map((y) => [x, y] as [number, number]));
    return b.propNear(kit, side === "l" ? L : side === "r" ? R : shuffle(rng, [...L, ...R]), 0, FLOOR, ["floor"]);
  };
  const cx = Math.floor((x0 + x1) / 2), midY = Math.floor((fy0 + fy1) / 2);
  const left = rng() < 0.5;
  switch (style) {
    case "cave-dwelling": {
      // 화덕은 방 가운데(출입구 동선 비켜 한쪽), 앞에 털 깔개, 둘레 걸상. 잠자리는 북쪽 벽 앞 한쪽, 살림은 반대쪽 벽가.
      const hx = cx + (left ? -3 : 2), hy = midY;
      if (b.prop("ph-hearth", hx, hy, 1, FLOOR, ["floor"])) {
        b.propNear("ph-rug-fur", [[hx, hy + 2], [hx - 1, hy + 2], [hx + 1, hy + 2], [hx, hy + 3]], 0, FLOOR, ["floor"]);
        for (const [sx, sy] of [[hx - 2, hy + 1], [hx + 3, hy + 1], [hx + 3, hy]] as const) b.prop("ph-stump-stool", sx, sy, 0, FLOOR, ["floor"]);
      }
      backWall("ph-fur-bed", left ? xs(x1 - 5, x1 - 1).reverse() : xs(x0 + 1, x0 + 5));
      backWall("ph-fur-bed", left ? xs(x1 - 8, x1 - 4).reverse() : xs(x0 + 3, x0 + 8));
      backWall("ph-knap-bench", left ? xs(x0, cx - 2) : xs(cx + 1, x1 - 1).reverse());
      // 화덕 위 바위 벽에 짐승 벽화 한 폭(사는 동굴이라는 표시 — 벽걸이보다 먼저 자리를 잡는다)
      mural(pick(rng, ["deer", "bison", "mammoth"]), true, shuffle(rng, xs(x0 + 1, x1 - 2)));
      wallHang("ph-antler-wall", left ? xs(x0, cx) : xs(cx, x1).reverse());
      wallHang("ph-herbs-wall", left ? xs(cx, x1).reverse() : xs(x0, cx));
      if (b.has("ph-paint-hands-u")) mural("hands", false, shuffle(rng, xs(x0 + 1, x1 - 1)));
      b.cluster({ x: left ? x0 : x1 - 3, y: fy1 - 3, w: 4, h: 4 }, ["ph-pots", "ph-basket", "ph-woodpile"], FLOOR, 0, ["floor"]);
      // 반대쪽 절반: 가죽 펴는 틀·건조대(작업 자리) + 갈대 자리 — 방 한쪽이 통째로 비었다(자체 검수)
      b.cluster({ x: left ? cx + 2 : x0 + 1, y: midY - 1, w: Math.max(4, x1 - cx - 3), h: 5 }, ["ph-hide-frame", "ph-mat-reed", "ph-drying-rack"], FLOOR, 1, ["floor"]);
      corner("ph-stalagmite", left ? "r" : "l"); corner("ph-lamp"); corner("ph-stalagmite");
      break;
    }
    case "cave-gallery": {
      // 긴 동굴 벽에 벽화 줄(두 칸 그림 셋 + 한 칸 그림 사이사이), 그림 앞마다 등잔, 물감 그릇, 깊은 끝에 제단, 석순 무리
      const order = shuffle(rng, ["mammoth", "deer", "bison"]);
      let x = x0 + 1 + Math.floor(rng() * 2);
      const smalls = shuffle(rng, ["hands", "spiral", "dots"]);
      let si = 0;
      const placed: number[] = [];
      for (const art of order) {
        const at = mural(art, true, xs(x, x1 - 1));
        if (at < 0) break;
        placed.push(at);
        const sm = mural(smalls[si++ % smalls.length]!, false, xs(at + 3, at + 4));
        x = (sm >= 0 ? sm : at + 1) + 2;
      }
      for (const at of placed) b.propNear("ph-lamp", [[at, top[at]!], [at + 1, top[at + 1]!]], 0, FLOOR, ["floor"]);
      b.propNear("ph-pigment-pots", placed.length ? [[placed[0]! + 2, top[placed[0]! + 2]!], [placed[0]! - 1, top[placed[0]! - 1] ?? fy0]] : [], 0, FLOOR, ["floor"]);
      const endX = left ? x1 - 2 : x0 + 1;
      b.propNear("ph-altar", [[endX, midY + 1], [endX, midY], [endX, midY + 2]], 1, FLOOR, ["floor"]);
      b.propNear("ph-skull-shelf", [[left ? x1 - 1 : x0, top[left ? x1 - 1 : x0]!]], 0, FLOOR, ["floor"]);
      corner("ph-stalagmite"); corner("ph-stalagmite"); anywhere("ph-bone-pile", 1, 1);
      // 남쪽 벽가 석순 무리 · 깔고 앉는 털 깔개(벽화 보는 자리) — 긴 바닥이 텅 비었다(자체 검수)
      b.cluster({ x: x0, y: fy1 - 1, w: Math.floor((x1 - x0) / 2) - 2, h: 2 }, ["ph-stalagmite", "ph-rock-s", "ph-stalagmite"], FLOOR, 0, ["floor"]);
      b.cluster({ x: cx + 2, y: fy1 - 1, w: Math.floor((x1 - x0) / 2) - 2, h: 2 }, ["ph-rock-s", "ph-stalagmite", "ph-bone-pile"], FLOOR, 0, ["floor"]);
      if (placed.length > 1) b.propNear("ph-rug-fur", [[placed[1]!, midY], [placed[1]! - 1, midY], [placed[1]!, midY + 1]], 1, FLOOR, ["floor"]);
      break;
    }
    case "chieftain-hut": {
      // 족장 자리: 북쪽 벽 가운데 · 앞에 털 깔개 · 그 앞 화덕(방 가운데) · 벽에 탈·사슴뿔 · 한쪽 벽가 잠자리 · 돌 탁자 + 걸상
      const seat = backWall("ph-chief-seat", [cx - 1, cx, cx - 2]);
      if (seat) {
        b.propNear("ph-rug-fur", [[seat.x, seat.y + 2], [seat.x, seat.y + 3]], 0, FLOOR, ["floor"]);
        wallHang("ph-mask-wall", [seat.x - 1, seat.x - 2]); wallHang("ph-mask-wall", [seat.x + 2, seat.x + 3]);
      }
      const hearthY = Math.min(fy1 - 3, (seat?.y ?? fy0) + 5);
      b.propNear("ph-hearth", [[cx - 1, hearthY], [cx - 2, hearthY], [cx, hearthY], [cx - 1, hearthY - 1], [cx + 1, hearthY]], 1, FLOOR, ["floor"]);
      wallHang("ph-antler-wall", left ? xs(x0, cx - 3) : xs(cx + 3, x1).reverse());
      wallHang("ph-herbs-wall", left ? xs(cx + 3, x1).reverse() : xs(x0, cx - 3));
      backWall("ph-fur-bed", left ? xs(x1 - 2, x1 - 1).reverse() : [x0, x0 + 1]);
      backWall("ph-spear-rack", left ? xs(x0, x0 + 2) : xs(x1 - 3, x1 - 1).reverse());
      if (b.propNear("ph-stone-table", left ? [[x0 + 1, fy1 - 2], [x0 + 1, fy1 - 3]] : [[x1 - 2, fy1 - 2], [x1 - 2, fy1 - 3]], 0, FLOOR, ["floor"])) {
        const t = b.props[b.props.length - 1]!;
        b.propNear("ph-stump-stool", [[t.x, t.y - 1], [t.x + 1, t.y - 1], [t.x + 2, t.y]], 0, FLOOR, ["floor"]);
      }
      corner("ph-pots"); corner("ph-basket");
      break;
    }
    case "shaman-hut": {
      // 무당 제단: 북쪽 벽 가운데 · 해골 선반은 한쪽 벽 · 벽에 약초·탈·칠한 가죽 · 가운데 작은 모닥불 + 갈대 자리 · 북 · 물감 그릇 · 짚 잠자리
      const alt = backWall("ph-shaman-altar", [cx - 1, cx, cx - 2]);
      if (alt) b.reserve({ x: alt.x, y: alt.y + 1, w: 2, h: 1 });
      backWall("ph-skull-shelf", left ? xs(x0, x0 + 2) : xs(x1 - 3, x1 - 1).reverse());
      wallHang("ph-hide-wall", left ? xs(x1 - 3, x1 - 1).reverse() : xs(x0, x0 + 2));
      wallHang("ph-herbs-wall", xs(x0, x1)); wallHang("ph-mask-wall", xs(x0, x1).reverse());
      if (b.propNear("ph-firepit", [[cx, midY], [cx - 1, midY], [cx, midY - 1], [cx + 1, midY], [cx, midY + 1]], 1, FLOOR, ["floor"])) {
        const f = b.props[b.props.length - 1]!;
        b.propNear("ph-mat-reed", [[f.x - 3, f.y], [f.x + 2, f.y]], 0, FLOOR, ["floor"]);
        b.propNear("ph-drum", [[f.x + 2, f.y + 1], [f.x - 2, f.y + 1]], 0, FLOOR, ["floor"]);
      }
      b.propNear("ph-pigment-pots", alt ? [[alt.x + 2, alt.y + 1], [alt.x - 1, alt.y + 1]] : [], 0, FLOOR, ["floor"]);
      corner("ph-straw-bed", left ? "r" : "l"); corner("ph-lamp"); corner("ph-pots");
      break;
    }
  }
  return start;
}

/** 한 장을 짠다. 칸이 모자라면 Error(호출자가 ToolError 로 바꾼다). */
export function composePrehistoric(spec: PrehistoricSpec, pal: PrehistoricPalette): PrehistoricResult {
  const min = PREHISTORIC_MIN_SIZE[spec.style];
  if (!min) throw new Error(`알 수 없는 style ${spec.style}`);
  if (spec.width < min.w || spec.height < min.h) throw new Error(`맵이 작다(${spec.width}×${spec.height}) — ${spec.style} 는 ${min.w}×${min.h} 이상이어야 한다`);
  const seed = (spec.seed ?? 0) >>> 0;
  const rng = mulberry(seed * 7919 + spec.style.length * 131);
  const indoor = (PREHISTORIC_ROOM_STYLES as readonly string[]).includes(spec.style);
  const b = new Board(spec.width, spec.height, pal, seed);
  let start: PrehistoricCell;
  if (spec.style === "village") start = composeVillage(b, rng);
  else if (spec.style === "swamp") start = composeSwamp(b, rng);
  else if (spec.style === "volcano") start = composeVolcano(b, rng);
  else if (spec.style === "fossil") start = composeFossil(b, rng);
  else start = composeRoom(b, rng, spec.style as PrehistoricRoomStyle);
  if (!indoor) { b.variety(); b.lanes(); }
  const exits: PrehistoricCell[] = [];
  if (indoor) { for (let x = 0; x < b.W; x++) if (b.walk(x, b.H - 1)) exits.push({ x, y: b.H - 1 }); }
  else exits.push(start);
  return { lower: b.lower, upper: b.upper, buildings: b.buildings, start, exits, props: b.props, zones: b.zones, notes: b.notes };
}

/** 번들 정의(TilesetDef 모양)에서 사전을 만든다: 한 칸 바닥은 그룹 `ph:ph-<조각>`, 키트는 structureKits(출입구 부품), 통행은 passability + ★ 표시. */
export function prehistoricPaletteFromTileset(def: {
  readonly tileGroups?: readonly { readonly id: string; readonly tileIds: readonly number[] }[];
  readonly structureKits?: readonly unknown[];
  readonly passability?: readonly { readonly up?: boolean }[];
  readonly tileMeta?: readonly ({ readonly passage?: string } | null | undefined)[];
}): PrehistoricPalette {
  const groups = new Map((def.tileGroups ?? []).map((g) => [g.id, g.tileIds] as const));
  const kits = new Map<string, PrehistoricKit>();
  for (const raw of def.structureKits ?? []) {
    const k = raw as { id: string; width: number; height: number; rows: PrehistoricKit["rows"]; parts?: { kind: string; dx: number; w: number }[] };
    if (!k?.id || !Array.isArray(k.rows)) continue;
    const part = k.parts?.find((p) => p.kind === "entrance");
    kits.set(k.id, { id: k.id, width: k.width, height: k.height, rows: k.rows, door: part ? { dx: part.dx, w: part.w } : undefined });
  }
  const pass = def.passability ?? [], meta = def.tileMeta ?? [];
  const ok = (t: number) => t >= 0 && !!pass[t]?.up;
  return {
    tile: (piece) => groups.get(`ph:ph-${piece.replace(/^ph-/, "")}`)?.[0] ?? -1,
    kit: (id) => kits.get(id),
    walk: (lo, up) => (up >= 0 && meta[up]?.passage !== "star" ? ok(up) : ok(lo)),
  };
}
