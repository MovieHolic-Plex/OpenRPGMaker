// project/wastelandComposer.ts
// 폐허·황무지(wasteland_ruins) 맵 구성기 — 종류(kind)와 씨앗(seed)만 주면 규칙으로 한 장을 짠다(견본을 붙이지 않는다). sfStationComposer 와 같은 생각이다:
// AI 는 어떤 장소인지만 고르고, 배치·조화는 이 함수가 한다.
//
// 종류(마을 종류 표 post-apoc-kit 의 세 종류와 1:1)
//   settlement  포스트아포칼립스 생존자 정착지: 갈라진 큰길 두 줄(십자) · 북쪽 띠 = 무너진 건물 껍데기 줄 · 남서 = 바리케이드·고철 울로 두른 거주지
//               (안쪽 위 줄 판잣집 → 가운데 판석 광장(모닥불·통나무 의자·장터 노점) → 아래 줄 급수탑·발전기·태양판·드럼통, 모서리 망루, 큰길 쪽 문) ·
//               남동 = 폐차장·고사목·잡초. 큰길에는 녹슨 차와 바리케이드 검문.
//   ruined-city 좀비 폐허 도시: 바둑판 도로(가로 2·세로 2) · 블록마다 무너진 건물 2~3채와 판석 터 · 무너진 벽·잔해 더미·덩굴·덤불 · 도로에 녹슨 차·버스·
//               불탄 차·중앙 분리대·꺾인 가로등. 사람 사는 흔적(판잣집·모닥불·노점)은 없다.
//   shanty      황무지 판잣집 정착촌: 흙먼지 땅 · 북쪽에 끊긴 옛 도로 토막 · 가운데 고철 울로 둥글게 두른 판잣집 촌(골목 둘, 판잣집·차양 6~10채,
//               고철 더미·타이어·드럼통·급수탑·태양판·노점·모닥불) · 바깥은 고사목·잔해 더미·불탄 차.
// 놓을 때마다 출발 칸에서 모든 문 앞·출구에 걸어 닿는지 검사하고 막으면 되돌린다. 이 파일은 순수 함수다(도구 compose_wasteland_map 이 복제본에서 부른다).

import { setLayerTileAt, layerTileAt } from "@/project/mapLayers";
import { addMapLocation, COMPOSED_LAYOUT_TAG } from "@/project/mapNamedLocations";
import type { GameMap, StructureKitDef, TilesetDef } from "@/project/types";

export type WastelandKind = "settlement" | "ruined-city" | "shanty";
export const WASTELAND_KINDS: readonly WastelandKind[] = ["settlement", "ruined-city", "shanty"];
export const WASTELAND_MIN_SIZE: Readonly<Record<WastelandKind, { w: number; h: number }>> = {
  settlement: { w: 40, h: 30 }, "ruined-city": { w: 40, h: 30 }, shanty: { w: 36, h: 28 },
};
export const WASTELAND_DEFAULT_SIZE: Readonly<Record<WastelandKind, { w: number; h: number }>> = {
  settlement: { w: 48, h: 36 }, "ruined-city": { w: 50, h: 38 }, shanty: { w: 44, h: 34 },
};
export const WASTELAND_KIND_KO: Readonly<Record<WastelandKind, string>> = {
  settlement: "포스트아포칼립스 생존자 정착지", "ruined-city": "좀비 폐허 도시", shanty: "황무지 판잣집 정착촌",
};

export interface WlPlaced { readonly id: string; readonly x: number; readonly y: number }
export interface WlArea { readonly name: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly tag: string; readonly door?: { x: number; y: number } }
export interface WlComposeResult {
  readonly kind: WastelandKind;
  readonly seed: number;
  readonly placed: readonly WlPlaced[];
  readonly areas: readonly WlArea[];
  readonly spawn: { x: number; y: number };
  readonly skipped: number;
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

function hash2(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const N = 1, E = 2, S = 4, W = 8;
type Pt = { x: number; y: number };

class Board {
  readonly w: number;
  readonly h: number;
  private readonly kits = new Map<string, StructureKitDef>();
  readonly taken: boolean[];
  /** 기물을 두지 않는 칸(길·문 앞·광장 통로). */
  readonly keep: boolean[];
  private journal: { layer: 1 | 2 | 3; i: number; prev: number }[] | null = null;
  readonly placed: WlPlaced[] = [];
  skipped = 0;
  readonly rng: () => number;

  constructor(readonly map: GameMap, readonly ts: TilesetDef, readonly seed: number) {
    this.w = map.width; this.h = map.height;
    for (const k of ts.structureKits ?? []) this.kits.set(k.id, k);
    this.taken = new Array<boolean>(this.w * this.h).fill(false);
    this.keep = new Array<boolean>(this.w * this.h).fill(false);
    this.rng = rngOf(seed);
  }

  kit(id: string): StructureKitDef | undefined { return this.kits.get(`wl-${id}`); }
  kitSize(id: string): { w: number; h: number } | undefined { const k = this.kit(id); return k ? { w: k.width, h: k.height } : undefined; }
  idx(x: number, y: number): number { return y * this.w + x; }
  inb(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  pick<T>(xs: readonly T[]): T { return xs[Math.floor(this.rng() * xs.length)]!; }
  chance(p: number): boolean { return this.rng() < p; }
  int(lo: number, hi: number): number { return lo + Math.floor(this.rng() * (hi - lo + 1)); }
  shuffle<T>(xs: readonly T[]): T[] { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; } return a; }

  private put(layer: 1 | 2 | 3, i: number, t: number): void {
    if (this.journal) this.journal.push({ layer, i, prev: layerTileAt(this.map, layer, i) });
    setLayerTileAt(this.map, layer, i, t);
  }
  setLower(x: number, y: number, t: number): void { if (this.inb(x, y) && t >= 0) this.put(1, this.idx(x, y), t); }
  setDecal(x: number, y: number, t: number): void { if (this.inb(x, y) && t >= 0) this.put(2, this.idx(x, y), t); }

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

  /** 낱칸 바닥·덧그림 조각의 칸들(그룹 `wl:floor:<id>` 또는 이름이 그 조각으로 끝나는 그룹, 없으면 키트 첫 칸). */
  cells(id: string): number[] {
    const groups = this.ts.tileGroups ?? [];
    const g = groups.find((group) => group.id === `wl:floor:${id}`) ?? groups.find((group) => new RegExp(`[:/]${id.replace(/[-]/g, "\\-")}$`).test(group.id));
    if (g?.tileIds.length) return [...g.tileIds];
    const k = this.kit(id);
    if (k) { const r = k.rows[0]!; const t = r.tiles[0] !== undefined && r.tiles[0]! >= 0 ? r.tiles[0]! : r.upperTiles?.[0] ?? -1; return t >= 0 ? [t] : []; }
    return [];
  }
  /** 바닥 조각 여럿 중 해시로 고른 칸(같은 칸이 바둑판으로 반복되지 않게). */
  ground(ids: readonly string[], x: number, y: number, weights?: readonly number[]): number {
    const pool: number[] = [];
    ids.forEach((id, k) => { const cs = this.cells(id); for (let r = 0; r < (weights?.[k] ?? 1); r++) pool.push(...cs); });
    if (!pool.length) return -1;
    return pool[Math.floor(hash2(x, y, this.seed) * pool.length)]!;
  }

  /** 4방향 오토타일 그룹(이름에 key 가 든 `wl-` 그룹): mask 칸에 변형을 깐다. 맵 밖은 이어진 것으로 본다. 꽉 찬 칸은 속 변형을 해시로 섞는다. */
  autotile(key: string, cells: readonly boolean[]): void {
    const g = (this.ts.autotileGroups ?? []).find((group) => group.id.startsWith("wl") && group.id.includes(key));
    if (!g) return;
    const conn = (x: number, y: number) => !this.inb(x, y) || cells[this.idx(x, y)]!;
    const interior = (g as { interiorVariants?: number[][] }).interiorVariants?.flat() ?? [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (!cells[this.idx(x, y)]) continue;
      const m = (conn(x, y - 1) ? N : 0) | (conn(x + 1, y) ? E : 0) | (conn(x, y + 1) ? S : 0) | (conn(x - 1, y) ? W : 0);
      let t = g.variantMap[String(m)];
      if (m === 15 && interior.length && hash2(x, y, this.seed + 7) < 0.3) t = interior[Math.floor(hash2(y, x, this.seed) * interior.length)];
      if (t !== undefined) this.setLower(x, y, t);
    }
  }

  stamp(id: string, x: number, y: number): boolean {
    const k = this.kit(id);
    if (!k) { this.skipped++; return false; }
    for (let r = 0; r < k.height; r++) for (let c = 0; c < k.width; c++) {
      const lo = k.rows[r]!.tiles[c] ?? -1, up = k.rows[r]!.upperTiles?.[c] ?? -1;
      if (lo < 0 && up < 0) continue;
      const X = x + c, Y = y + r;
      if (!this.inb(X, Y)) return false;
      const i = this.idx(X, Y);
      if (this.keep[i] && (lo >= 0 || (up >= 0 && !this.isFlat(up)))) return false;
      if (up >= 0 && !this.isFlat(up) && this.taken[i]) return false;
    }
    for (let r = 0; r < k.height; r++) for (let c = 0; c < k.width; c++) {
      const lo = k.rows[r]!.tiles[c] ?? -1, up = k.rows[r]!.upperTiles?.[c] ?? -1;
      const i = this.idx(x + c, y + r);
      if (lo >= 0) this.put(1, i, lo);
      if (up >= 0) {
        if (this.isFlat(up)) this.put(2, i, up);
        else { this.put(3, i, up); this.taken[i] = true; }
      }
    }
    this.placed.push({ id, x, y });
    return true;
  }

  stampSafe(id: string, x: number, y: number, start: Pt, must: readonly Pt[]): boolean {
    this.journal = [];
    const takenBefore = this.taken.slice();
    const ok = this.stamp(id, x, y);
    const journal = this.journal;
    this.journal = null;
    if (!ok) return false;
    if (this.reachesAll(start, must)) return true;
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
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        if (!this.inb(nx, ny)) continue;
        const j = this.idx(nx, ny);
        if (!seen[j] && this.walkable(nx, ny)) { seen[j] = 1; stack.push(j); }
      }
    }
    return seen;
  }
  reachesAll(start: Pt, must: readonly Pt[]): boolean {
    const seen = this.reach(start);
    return must.every((p) => this.inb(p.x, p.y) && seen[this.idx(p.x, p.y)] === 1);
  }

  /** 키트의 문 칸(parts entrance) — 없으면 맨 아랫줄 가운데. */
  door(id: string, x: number, y: number): Pt {
    const k = this.kit(id)!;
    const p = (k.parts ?? []).find((part) => part.kind === "entrance");
    return p ? { x: x + p.dx, y: y + p.dy } : { x: x + Math.floor(k.width / 2), y: y + k.height - 1 };
  }
  free(x: number, y: number, w: number, h: number): boolean {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
      if (!this.inb(x + dx, y + dy)) return false;
      const i = this.idx(x + dx, y + dy);
      if (this.keep[i] || this.taken[i]) return false;
    }
    return true;
  }
  markKeep(x: number, y: number, w = 1, h = 1): void { for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (this.inb(x + dx, y + dy)) this.keep[this.idx(x + dx, y + dy)] = true; }
}

const DIRT = ["dirt-a", "dirt-b", "dirt-c", "dirt-d"];
const SLAB = ["slab-a", "slab-b", "slab-c"];
const RUBBLE = ["rubble-a", "rubble-b", "rubble-c"];
const WEEDS = ["weeds-a", "weeds-b", "weeds-c"];

function fillDirt(b: Board): void {
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) b.setLower(x, y, b.ground(DIRT, x, y, [5, 2, 2, 1]));
}
function fillSlab(b: Board, x0: number, y0: number, w: number, h: number): void {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (b.inb(x, y)) b.setLower(x, y, b.ground(SLAB, x, y));
}
/** 길·광장이 아닌 빈 땅·길 가장자리에 잔해·잡초·웅덩이 덧그림을 흩는다. */
function scatterDecals(b: Board, density: number, road: readonly boolean[]): void {
  const rubble = RUBBLE.flatMap((id) => b.cells(id)), weeds = WEEDS.flatMap((id) => b.cells(id)), puddle = b.cells("puddle");
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    const i = b.idx(x, y);
    if (b.taken[i] || layerTileAt(b.map, 2, i) >= 0) continue;
    const r = hash2(x, y, b.seed + 31);
    if (r > density) continue;
    const onRoad = road[i];
    const k = hash2(y, x, b.seed + 5);
    const pool = onRoad ? (k < 0.55 ? weeds : k < 0.85 ? rubble : puddle) : (k < 0.5 ? weeds : k < 0.92 ? rubble : puddle);
    if (pool.length) b.setDecal(x, y, pool[Math.floor(hash2(x + 3, y + 7, b.seed) * pool.length)]!);
  }
}

/** 줄(가로)에 조각들을 왼→오로 여백 두고 세운다. 반환 = 놓인 조각 [id,x,y]. */
function rowOf(b: Board, ids: readonly string[], x0: number, x1: number, footY: number, start: Pt, must: Pt[], gap: [number, number] = [1, 2], areas?: WlArea[], name?: (id: string) => string): { id: string; x: number; y: number }[] {
  const out: { id: string; x: number; y: number }[] = [];
  let x = x0;
  for (const id of ids) {
    const s = b.kitSize(id); if (!s) continue;
    for (; x + s.w - 1 <= x1; x++) {
      const y = footY - s.h + 1;
      if (y < 0 || !b.free(x, y, s.w, s.h)) continue;
      if (!b.stampSafe(id, x, y, start, must)) continue;
      out.push({ id, x, y });
      const d = b.door(id, x, y);
      if (areas && name) areas.push({ name: name(id), x, y, w: s.w, h: s.h, tag: id, door: d });
      x += s.w + b.int(gap[0], gap[1]);
      break;
    }
  }
  return out;
}

/** 빈 땅(사각형 안) 아무 데나 조각 n 개 — 서로 1칸 띄운다. */
function sprinkle(b: Board, ids: readonly string[], n: number, x0: number, y0: number, x1: number, y1: number, start: Pt, must: Pt[]): number {
  let k = 0;
  for (let tries = 0; k < n && tries < n * 40; tries++) {
    const id = b.pick(ids); const s = b.kitSize(id); if (!s) continue;
    const x = b.int(x0, Math.max(x0, x1 - s.w + 1)), y = b.int(y0, Math.max(y0, y1 - s.h + 1));
    if (!b.free(x - 1, y - 1, s.w + 2, s.h + 2)) continue;
    if (b.stampSafe(id, x, y, start, must)) k++;
  }
  return k;
}

/** 녹슨 차들을 길 칸에 — 차선 안에 비스듬히 두지 않고 가로 길엔 가로 차, 세로 길엔 세로 차. 통행은 남긴다(stampSafe). */
function wrecksOnRoad(b: Board, lanes: { x0: number; y0: number; x1: number; y1: number; horizontal: boolean }[], n: number, start: Pt, must: Pt[], ids: { h: string[]; v: string[] }): void {
  let k = 0;
  for (let tries = 0; k < n && tries < n * 50; tries++) {
    const lane = b.pick(lanes); const id = b.pick(lane.horizontal ? ids.h : ids.v); const s = b.kitSize(id); if (!s) continue;
    const x = b.int(lane.x0, Math.max(lane.x0, lane.x1 - s.w + 1)), y = b.int(lane.y0, Math.max(lane.y0, lane.y1 - s.h + 1));
    let clash = false;
    for (let dy = -1; dy <= s.h; dy++) for (let dx = -1; dx <= s.w; dx++) if (b.inb(x + dx, y + dy) && b.taken[b.idx(x + dx, y + dy)]) clash = true;
    if (clash) continue;
    // 길 칸은 keep 이 아니다(차가 길 위에 선다) — 대신 통행 검사가 길을 끊지 않게 한다.
    if (b.stampSafe(id, x, y, start, must)) k++;
  }
}

// ─────────────────────────────── settlement
/** 세로 울이 없을 때: 무너진 담(wall-v 1×3, 모자라면 wall-stub 1×2)을 이어 세운다. 틈은 일부러 남긴다. */
function wallRunV(b: Board, x: number, y0: number, y1: number, start: Pt, must: readonly Pt[]): void {
  let y = y0;
  while (y <= y1) {
    if (hash2(x, y, b.seed + 23) < 0.12) { y++; continue; }
    if (y + 2 <= y1 && b.stampSafe("wall-v", x, y, start, must)) { y += 3; continue; }
    if (y + 1 <= y1 && b.stampSafe("wall-stub", x, y, start, must)) { y += 2; continue; }
    y++;
  }
}

function composeSettlement(b: Board): { areas: WlArea[]; spawn: Pt; road: boolean[] } {
  const { w: Wd, h: Hd } = b;
  const areas: WlArea[] = [];
  fillDirt(b);
  const road = new Array<boolean>(Wd * Hd).fill(false);
  const ry = Math.max(9, Math.floor(Hd * 0.32) + b.int(-1, 1));            // 가로 큰길 윗줄(3줄)
  const rx = Math.floor(Wd * 0.62) + b.int(-2, 2);                        // 세로 큰길 왼줄(3줄)
  for (let y = ry; y < ry + 3; y++) for (let x = 0; x < Wd; x++) road[b.idx(x, y)] = true;
  for (let y = 0; y < Hd; y++) for (let x = rx; x < rx + 3; x++) road[b.idx(x, y)] = true;
  b.autotile("asphalt", road);
  const spawn = { x: 1, y: ry + 1 };
  const must: Pt[] = [{ x: Wd - 2, y: ry + 1 }, { x: rx + 1, y: 1 }, { x: rx + 1, y: Hd - 2 }];
  // 북쪽 띠: 무너진 건물 껍데기 줄(발 = 큰길 위 2줄 — 앞에 1줄 보도 흙)
  const foot = ry - 2;
  b.markKeep(0, ry - 1, Wd, 1);
  const ruinIds = b.shuffle(["husk-tall", "husk-a", "husk-b", "husk-a", "wall-h", "husk-b", "husk-tall"]);
  rowOf(b, ruinIds.filter((_, k) => k % 2 === 0).concat(ruinIds.filter((_, k) => k % 2 === 1)), 1, rx - 2, foot, spawn, must, [1, 3], areas, (id) => (id.startsWith("husk") ? "무너진 건물" : "무너진 벽"));
  rowOf(b, b.shuffle(["husk-a", "husk-b", "wall-h"]), rx + 4, Wd - 2, foot, spawn, must, [1, 2], areas, (id) => (id.startsWith("husk") ? "무너진 건물" : "무너진 벽"));
  // 남서 거주지: 바리케이드·고철 울 사각형, 북쪽 문(큰길에서 2줄 흙길)
  const cx0 = 2, cy0 = ry + 5, cx1 = Math.min(rx - 3, cx0 + 26), cy1 = Hd - 2;
  const gateX = Math.floor((cx0 + cx1) / 2) - 1;
  const ring: Pt[] = [];
  for (let x = cx0; x <= cx1; x++) { ring.push({ x, y: cy0 }); ring.push({ x, y: cy1 }); }
  for (let y = cy0 + 1; y < cy1; y++) { ring.push({ x: cx0, y }); ring.push({ x: cx1, y }); }
  // 문 길: 큰길 아래부터 문까지
  for (let y = ry + 3; y <= cy0 + 1; y++) for (const dx of [0, 1]) b.markKeep(gateX + dx, y);
  const inner = { x0: cx0 + 1, y0: cy0 + 1, x1: cx1 - 1, y1: cy1 - 1 };
  const gateFront = { x: gateX, y: cy0 + 1 };
  must.push(gateFront, { x: gateX, y: cy0 - 1 });
  // 광장(판석) — 안쪽 가운데 줄
  const plazaY0 = inner.y0 + 5, plazaY1 = Math.min(inner.y1 - 4, plazaY0 + 4);
  fillSlab(b, inner.x0 + 2, plazaY0, inner.x1 - inner.x0 - 3, plazaY1 - plazaY0 + 1);
  // 광장 가로 통로(문 → 광장): 문 열 2칸
  for (let y = inner.y0; y < plazaY0; y++) for (const dx of [0, 1]) b.markKeep(gateX + dx, y);
  // 판잣집 줄(안쪽 위) — 문은 아래(광장 쪽)
  const shacks = rowOf(b, b.shuffle(["shack-a", "shack-b", "lean-to", "shack-a", "shack-b"]), inner.x0 + 1, inner.x1 - 1, plazaY0 - 1, spawn, must, [1, 1], areas, () => "판잣집");
  for (const s of shacks) { const d = b.door(s.id, s.x, s.y); must.push({ x: d.x, y: d.y + 1 }); b.markKeep(d.x, d.y + 1); }
  // 광장: 모닥불 + 통나무 의자, 장터 노점 둘~셋
  const fx = Math.floor((inner.x0 + inner.x1) / 2) + b.int(-3, 3), fy = Math.floor((plazaY0 + plazaY1) / 2);
  if (b.stampSafe("campfire", fx, fy, spawn, must)) {
    areas.push({ name: "모닥불 광장", x: inner.x0 + 2, y: plazaY0, w: inner.x1 - inner.x0 - 3, h: plazaY1 - plazaY0 + 1, tag: "plaza" });
    b.stampSafe("log-seat", fx - 1, fy + 1, spawn, must) || b.stampSafe("log-seat", fx, fy + 1, spawn, must);
    b.stampSafe("log-seat", fx - 3, fy, spawn, must);
  }
  const stalls = rowOf(b, b.shuffle(["stall-a", "stall-b", "stall-a"]), inner.x0 + 2, inner.x1 - 2, plazaY1, spawn, must, [3, 5]);
  if (stalls.length) areas.push({ name: "고물 장터", x: stalls[0]!.x, y: stalls[0]!.y, w: stalls[stalls.length - 1]!.x + 3 - stalls[0]!.x, h: 2, tag: "market" });
  // 아래 줄: 급수탑·발전기·태양판·드럼통·상자·고철 더미
  const util = rowOf(b, b.shuffle(["water-tank", "generator", "solar-scrap", "drums", "crates", "scrap-heap", "tyres", "solar-scrap"]), inner.x0 + 1, inner.x1 - 1, inner.y1, spawn, must, [1, 2]);
  if (util.length) areas.push({ name: "물·전기 마당", x: inner.x0 + 1, y: inner.y1 - 3, w: inner.x1 - inner.x0 - 1, h: 4, tag: "utility" });
  // 울타리(바리케이드 칸 + 고철 울) — 문 두 칸 비움, 모서리에 망루
  const fenceH = b.cells("fence-h"), fenceV = b.cells("fence-v");
  const barricadeIds = ["barricade-h"];
  // 북쪽 변: 문 양옆은 바리케이드 덩이, 나머지는 고철 울
  for (let x = cx0; x <= cx1; x++) {
    if (x === gateX || x === gateX + 1) continue;
    for (const y of [cy0, cy1]) {
      const i = b.idx(x, y); if (b.taken[i]) continue;
      if (fenceH.length) { setLayerTileAt(b.map, 3, i, fenceH[(x + y) % fenceH.length]!); b.taken[i] = true; }
    }
  }
  if (fenceV.length) {
    for (let y = cy0 + 1; y < cy1; y++) for (const x of [cx0, cx1]) {
      const i = b.idx(x, y); if (b.taken[i]) continue;
      setLayerTileAt(b.map, 3, i, fenceV[(x + y) % fenceV.length]!); b.taken[i] = true;
    }
  } else for (const x of [cx0, cx1]) wallRunV(b, x, cy0 + 1, cy1 - 1, spawn, must);
  // 문 양옆 바리케이드(울 위에 덮어 찍지 않고 바깥 앞에 덧댄다)
  for (const bx of [gateX - 4, gateX + 2]) {
    const s = b.kitSize(barricadeIds[0]!); if (!s) break;
    b.stampSafe("barricade-h", bx, cy0 - s.h, spawn, must);
  }
  b.stampSafe("water-tank", cx1 - 3, cy0 + 1, spawn, must) || b.stampSafe("water-tank", cx0 + 1, cy0 + 1, spawn, must);
  areas.push({ name: "생존자 거주지", x: cx0, y: cy0, w: cx1 - cx0 + 1, h: cy1 - cy0 + 1, tag: "compound", door: { x: gateX, y: cy0 } });
  // 큰길: 녹슨 차·검문(분리대)
  wrecksOnRoad(b, [{ x0: 2, y0: ry, x1: rx - 3, y1: ry + 2, horizontal: true }, { x0: rx + 4, y0: ry, x1: Wd - 3, y1: ry + 2, horizontal: true }, { x0: rx, y0: 1, x1: rx + 2, y1: ry - 3, horizontal: false }, { x0: rx, y0: ry + 4, x1: rx + 2, y1: Hd - 3, horizontal: false }],
    b.int(4, 6), spawn, must, { h: ["car-rust-h", "car-rust-h", "scrap-heap", "van-rust", "van-rust"], v: ["car-rust-v"] });
  b.stampSafe("jersey-barrier", gateX - 1, ry + 2, spawn, must);
  // 남동: 폐차장·고사목·덤불·잔해 더미
  sprinkle(b, ["car-rust-h", "scrap-heap", "car-rust-v", "scrap-heap", "tyres", "drums"], 5, rx + 4, ry + 5, Wd - 2, Hd - 2, spawn, must);
  areas.push({ name: "폐차장", x: rx + 4, y: ry + 5, w: Wd - rx - 6, h: Hd - ry - 7, tag: "junkyard" });
  sprinkle(b, ["dead-tree", "bush-wild", "rubble-pile", "dead-tree", "lamp-broken", "sign-blank"], Math.floor(Wd / 6), 0, 0, Wd - 1, Hd - 1, spawn, must);
  return { areas, spawn, road };
}

// ─────────────────────────────── ruined-city
function composeRuinedCity(b: Board): { areas: WlArea[]; spawn: Pt; road: boolean[] } {
  const { w: Wd, h: Hd } = b;
  const areas: WlArea[] = [];
  fillDirt(b);
  const road = new Array<boolean>(Wd * Hd).fill(false);
  const ys = [Math.floor(Hd * 0.3) + b.int(-1, 1), Math.floor(Hd * 0.72) + b.int(-1, 1)];
  const xs = [Math.floor(Wd * 0.28) + b.int(-1, 1), Math.floor(Wd * 0.7) + b.int(-1, 1)];
  for (const y0 of ys) for (let y = y0; y < y0 + 3; y++) for (let x = 0; x < Wd; x++) road[b.idx(x, y)] = true;
  for (const x0 of xs) for (let y = 0; y < Hd; y++) for (let x = x0; x < x0 + 3; x++) road[b.idx(x, y)] = true;
  b.autotile("asphalt", road);
  const spawn = { x: 1, y: ys[0]! + 1 };
  const must: Pt[] = [{ x: Wd - 2, y: ys[0]! + 1 }, { x: Wd - 2, y: ys[1]! + 1 }, { x: xs[0]! + 1, y: 1 }, { x: xs[1]! + 1, y: Hd - 2 }];
  // 보도 흙 1줄(길 둘레)은 비운다
  for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) {
    if (road[b.idx(x, y)]) continue;
    if ((b.inb(x, y + 1) && road[b.idx(x, y + 1)]) || (b.inb(x, y - 1) && road[b.idx(x, y - 1)])) b.keep[b.idx(x, y)] = true;
  }
  // 블록: 도로로 나뉜 사각형들
  const bandsY = [[0, ys[0]! - 2], [ys[0]! + 4, ys[1]! - 2], [ys[1]! + 4, Hd - 1]] as const;
  const bandsX = [[0, xs[0]! - 1], [xs[0]! + 3, xs[1]! - 1], [xs[1]! + 3, Wd - 1]] as const;
  let block = 0;
  // 블록마다 쓰임을 다르게: 빈 건물 줄·무너진 잔해 벌판·풀숲에 묻힌 터·생존자 야영·폐차장. 같은 블록이 바둑판으로 되풀이되지 않게.
  const themes = b.shuffle(["buildings", "buildings", "buildings", "collapsed", "overgrown", "camp", "lot", "buildings", "collapsed"] as const);
  for (const [y0, y1] of bandsY) for (const [x0, x1] of bandsX) {
    if (y1 - y0 < 3 || x1 - x0 < 4) continue;
    const theme = themes[block % themes.length]!;
    block++;
    const bw = x1 - x0, bh = y1 - y0;
    if (theme === "buildings") {
      // 건물 터 판석은 건물 줄 뒤쪽 일부만(블록 전체를 판석으로 덮으면 바둑판처럼 보인다)
      if (bh >= 5) fillSlab(b, x0 + 1 + b.int(0, 2), Math.max(y0 + 1, y1 - 6), bw - 2 - b.int(0, 3), Math.min(bh - 1, 6));
      const ids = b.shuffle(["husk-tall", "husk-a", "husk-b", "husk-a", "husk-tall", "wall-h"]).slice(0, b.int(2, 3));
      const placed = rowOf(b, ids, x0 + 1 + b.int(0, 2), x1 - 1, y1, spawn, must, [1, 3], areas, () => `무너진 건물 ${block}`);
      for (const p of placed) { const d = b.door(p.id, p.x, p.y); if (b.inb(d.x, d.y + 1)) b.markKeep(d.x, d.y + 1); }
      sprinkle(b, ["wall-stub", "rubble-pile", "vine-wall", "bush-wild", "dead-tree", "scrap-heap"], Math.max(2, Math.floor(bw * bh / 50)), x0, y0, x1, y1 - 5, spawn, must);
    } else if (theme === "collapsed") {
      for (let k = 0; k < 3; k++) fillSlab(b, x0 + b.int(1, Math.max(1, bw - 6)), y0 + b.int(1, Math.max(1, bh - 4)), b.int(3, 6), b.int(2, 4));
      const one = rowOf(b, ["husk-b"], x0 + b.int(1, Math.max(1, bw - 7)), x1 - 1, y1, spawn, must, [1, 2], areas, () => `무너진 건물 ${block}`);
      for (const p of one) { const d = b.door(p.id, p.x, p.y); if (b.inb(d.x, d.y + 1)) b.markKeep(d.x, d.y + 1); }
      sprinkle(b, ["rubble-pile", "rubble-pile", "scrap-heap", "wall-stub", "wall-h", "wall-v", "tyres"], Math.max(4, Math.floor(bw * bh / 22)), x0, y0, x1, y1, spawn, must);
      areas.push({ name: `잔해 벌판 ${block}`, x: x0, y: y0, w: bw, h: bh, tag: "rubble" });
    } else if (theme === "overgrown") {
      const one = rowOf(b, ["husk-a"], x0 + b.int(1, Math.max(1, bw - 7)), x1 - 1, y1, spawn, must, [1, 2], areas, () => `풀숲 속 건물 ${block}`);
      for (const p of one) { const d = b.door(p.id, p.x, p.y); if (b.inb(d.x, d.y + 1)) b.markKeep(d.x, d.y + 1); }
      sprinkle(b, ["dead-tree", "bush-wild", "bush-wild", "vine-wall", "dead-tree", "bush-wild"], Math.max(5, Math.floor(bw * bh / 16)), x0, y0, x1, y1, spawn, must);
      areas.push({ name: `풀숲에 묻힌 터 ${block}`, x: x0, y: y0, w: bw, h: bh, tag: "overgrown" });
    } else if (theme === "camp") {
      const cx = x0 + Math.floor(bw / 2), cy = y0 + Math.floor(bh / 2);
      b.stampSafe("campfire", cx, cy, spawn, must);
      b.stampSafe("log-seat", cx - 2, cy + 1, spawn, must); b.stampSafe("log-seat", cx + 1, cy + 1, spawn, must);
      rowOf(b, b.shuffle(["shack-a", "lean-to", "shack-b"]).slice(0, 2), x0 + 1, x1 - 1, Math.max(y0 + 4, cy - 2), spawn, must, [1, 3], areas, () => `폐허 속 야영 ${block}`);
      sprinkle(b, ["drums", "crates", "tyres", "barricade-h", "jersey-barrier"], Math.max(3, Math.floor(bw * bh / 35)), x0, y0, x1, y1, spawn, must);
      areas.push({ name: `생존자 야영지 ${block}`, x: x0, y: y0, w: bw, h: bh, tag: "camp", door: { x: cx, y: cy + 2 } });
    } else {
      fillSlab(b, x0 + 1, y0 + 1, bw - 1, bh - 1);
      sprinkle(b, ["car-rust-h", "car-rust-h", "car-rust-v", "van-rust", "tyres", "scrap-heap"], Math.max(3, Math.floor(bw * bh / 20)), x0 + 1, y0 + 1, x1, y1, spawn, must);
      areas.push({ name: `폐차장 ${block}`, x: x0, y: y0, w: bw, h: bh, tag: "junkyard" });
    }
  }
  areas.push({ name: "폐허 시가", x: 0, y: 0, w: Wd, h: Hd, tag: "ruined-city" });
  const lanes = [
    ...ys.map((y0) => ({ x0: 1, y0, x1: Wd - 2, y1: y0 + 2, horizontal: true })),
    ...xs.map((x0) => ({ x0, y0: 1, x1: x0 + 2, y1: Hd - 2, horizontal: false })),
  ];
  wrecksOnRoad(b, lanes, b.int(8, 11), spawn, must, { h: ["car-rust-h", "car-rust-h", "scrap-heap", "van-rust", "van-rust", "jersey-barrier"], v: ["car-rust-v", "car-rust-v"] });
  // 꺾인 가로등 — 가로 길 윗 보도 줄
  for (const y0 of ys) for (let x = 2; x < Wd - 2; x += b.int(7, 11)) {
    const s = b.kitSize("lamp-broken"); if (!s) break;
    const y = y0 - s.h; if (y < 0) continue;
    const save = b.keep[b.idx(x, y0 - 1)]; b.keep[b.idx(x, y0 - 1)] = false;
    if (!b.stampSafe("lamp-broken", x, y, spawn, must)) b.keep[b.idx(x, y0 - 1)] = save;
  }
  return { areas, spawn, road };
}

// ─────────────────────────────── shanty
function composeShanty(b: Board): { areas: WlArea[]; spawn: Pt; road: boolean[] } {
  const { w: Wd, h: Hd } = b;
  const areas: WlArea[] = [];
  fillDirt(b);
  const road = new Array<boolean>(Wd * Hd).fill(false);
  // 북쪽 끊긴 옛 도로 토막(3줄) — 토막 사이는 흙
  const ry = 3 + b.int(0, 2);
  let x = 0;
  while (x < Wd) {
    const len = b.int(7, 14), gapLen = b.int(2, 4);
    for (let xx = x; xx < Math.min(Wd, x + len); xx++) for (let y = ry; y < ry + 3; y++) road[b.idx(xx, y)] = true;
    x += len + gapLen;
  }
  b.autotile("asphalt", road);
  const spawn = { x: 1, y: ry + 1 };
  // 판잣집 촌: 가운데 둥근 사각 울
  const cx0 = 3 + b.int(0, 2), cx1 = Wd - 4 - b.int(0, 2), cy0 = ry + 6, cy1 = Hd - 3;
  const gx = Math.floor((cx0 + cx1) / 2) + b.int(-3, 3);
  const must: Pt[] = [{ x: Wd - 2, y: ry + 1 }, { x: gx, y: cy0 - 1 }, { x: gx, y: cy0 + 1 }];
  for (let y = ry + 3; y <= cy0 + 1; y++) for (const dx of [0, 1]) b.markKeep(gx + dx, y);
  const fenceH = b.cells("fence-h"), fenceV = b.cells("fence-v");
  const corner = 2;
  const ringCell = (xx: number, yy: number, v: boolean) => {
    const i = b.idx(xx, yy); if (b.taken[i] || b.keep[i]) return;
    const pool = v ? fenceV : fenceH; if (!pool.length) return;
    // 울 틈(고철이 빠진 자리) 몇 군데
    if (hash2(xx, yy, b.seed + 11) < 0.07) return;
    setLayerTileAt(b.map, 3, i, pool[(xx * 3 + yy) % pool.length]!); b.taken[i] = true;
  };
  for (let xx = cx0 + corner; xx <= cx1 - corner; xx++) { if (xx !== gx && xx !== gx + 1) ringCell(xx, cy0, false); ringCell(xx, cy1, false); }
  if (fenceV.length) { for (let yy = cy0 + corner; yy <= cy1 - corner; yy++) { ringCell(cx0, yy, true); ringCell(cx1, yy, true); } }
  else for (const xx of [cx0, cx1]) wallRunV(b, xx, cy0 + corner, cy1 - corner, spawn, must);
  // 모서리를 깎아 둥글게: 대각 계단
  for (let k = 1; k < corner; k++) { ringCell(cx0 + k, cy0 + corner - k, false); ringCell(cx1 - k, cy0 + corner - k, false); ringCell(cx0 + k, cy1 - corner + k, false); ringCell(cx1 - k, cy1 - corner + k, false); }
  areas.push({ name: "판잣집 촌", x: cx0, y: cy0, w: cx1 - cx0 + 1, h: cy1 - cy0 + 1, tag: "shanty", door: { x: gx, y: cy0 } });
  // 골목 둘(가로) — 판잣집 줄 사이
  const inner = { x0: cx0 + 2, x1: cx1 - 2, y0: cy0 + 2, y1: cy1 - 2 };
  const rows = Math.max(2, Math.floor((inner.y1 - inner.y0 + 1) / 6));
  const shackIds = ["shack-a", "shack-b", "lean-to", "shack-a", "lean-to", "shack-b"];
  for (let r = 0; r < rows; r++) {
    const foot = inner.y0 + (r + 1) * Math.floor((inner.y1 - inner.y0 + 1) / rows) - 3;
    // 골목 = 이 줄 발 아래 2줄
    for (let xx = inner.x0; xx <= inner.x1; xx++) for (const dy of [1, 2]) if (b.inb(xx, foot + dy)) b.keep[b.idx(xx, foot + dy)] = true;
    for (let yy = inner.y0; yy <= inner.y1; yy++) for (const dx of [0, 1]) b.keep[b.idx(gx + dx, yy)] = true;
    const left = rowOf(b, b.shuffle(shackIds), inner.x0, gx - 2, foot, spawn, must, [1, 2], areas, () => "판잣집");
    const right = rowOf(b, b.shuffle(shackIds), gx + 3, inner.x1, foot, spawn, must, [1, 2], areas, () => "판잣집");
    for (const s of [...left, ...right]) { const d = b.door(s.id, s.x, s.y); must.push({ x: d.x, y: d.y + 1 }); }
    for (let yy = inner.y0; yy <= inner.y1; yy++) for (const dx of [0, 1]) b.keep[b.idx(gx + dx, yy)] = false;
  }
  // 촌 안 빈자리: 급수탑·태양판·고철 더미·드럼통·타이어·노점·모닥불
  sprinkle(b, ["water-tank", "solar-scrap", "scrap-heap", "drums", "tyres", "stall-a", "crates", "generator"], 7, inner.x0, inner.y0, inner.x1, inner.y1, spawn, must);
  const fx = gx + b.int(-1, 2), fy = cy0 + 3;
  if (b.stampSafe("campfire", fx, fy, spawn, must)) b.stampSafe("log-seat", fx + 1, fy + 1, spawn, must);
  // 바깥: 고사목·잔해 더미·불탄 차·덤불
  sprinkle(b, ["dead-tree", "rubble-pile", "scrap-heap", "dead-tree", "bush-wild", "tyres", "sign-blank"], Math.floor(Wd / 4), 0, ry + 3, Wd - 1, Hd - 1, spawn, must);
  wrecksOnRoad(b, [{ x0: 1, y0: ry, x1: Wd - 2, y1: ry + 2, horizontal: true }], 2, spawn, must, { h: ["scrap-heap", "car-rust-h"], v: [] });
  return { areas, spawn, road };
}

/** 맵 한 장을 짠다. 땅·2층·3층을 덮어쓴다(이벤트는 건드리지 않는다). tileset 은 번들 wasteland_ruins 사본. */
export function composeWastelandMap(map: GameMap, tileset: TilesetDef, kind: WastelandKind, seed: number): WlComposeResult {
  const b = new Board(map, tileset, seed + (kind === "settlement" ? 0 : kind === "ruined-city" ? 7919 : 15887));
  for (let i = 0; i < map.width * map.height; i++) { setLayerTileAt(map, 2, i, -1); setLayerTileAt(map, 3, i, -1); setLayerTileAt(map, 4, i, -1); }
  const out = kind === "settlement" ? composeSettlement(b) : kind === "ruined-city" ? composeRuinedCity(b) : composeShanty(b);
  scatterDecals(b, kind === "ruined-city" ? 0.11 : kind === "settlement" ? 0.07 : 0.06, out.road);
  const counts = new Map<string, number>();
  for (const p of b.placed) counts.set(p.id, (counts.get(p.id) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, c) => c[1] - a[1]).slice(0, 8).map(([id, n]) => `${id}×${n}`).join(", ");
  return {
    kind, seed, placed: b.placed, areas: out.areas, spawn: out.spawn, skipped: b.skipped,
    summary: `${WASTELAND_KIND_KO[kind]} ${map.width}×${map.height} (seed ${seed}) — 구역 ${out.areas.length}곳 · 기물 ${b.placed.length}개(${top})`,
  };
}

/** 구역·건물을 맵 이름표로 남긴다(옛 wl-area 이름표는 지운다). */
export function labelWastelandAreas(map: GameMap, areas: readonly WlArea[]): string[] {
  map.locations = (map.locations ?? []).filter((l) => !(l.tags ?? []).includes("wl-area"));
  const lines: string[] = [];
  const seen = new Map<string, number>();
  for (const a of areas) {
    const n = (seen.get(a.name) ?? 0) + 1; seen.set(a.name, n);
    const name = n > 1 ? `${a.name} ${n}` : a.name;
    const note = a.door ? `문 (${a.door.x},${a.door.y}) · 문 앞 접근칸 (${a.door.x},${a.door.y + 1})` : "구역";
    const added = addMapLocation(map, { name, x: a.x, y: a.y, w: a.w, h: a.h, note, tags: ["wl-area", COMPOSED_LAYOUT_TAG, a.tag] });
    if (added.ok) lines.push(a.door ? `${name} 문 (${a.door.x},${a.door.y})` : name);
  }
  return lines;
}

/** 요청 글 → 종류 추정. */
export function wastelandKindFromText(text: string): WastelandKind {
  if (/좀비|폐허\s*(?:도시|거리)|버려진\s*도시|ruined\s*city|zombie/iu.test(text)) return "ruined-city";
  if (/황무지|판잣집|고철\s*마을|wasteland|shanty/iu.test(text)) return "shanty";
  return "settlement";
}
