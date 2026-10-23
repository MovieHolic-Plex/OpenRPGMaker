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
  settlement: { w: 48, h: 36 }, "ruined-city": { w: 50, h: 38 }, shanty: { w: 38, h: 28 },
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

// r8: 곱셈 한 번 섞기는 낮은 비트가 약해 잔해 덧그림이 두 칸 간격 격자로 섰다 — murmur3 끝 섞기(fmix32)로.
function hash2(x: number, y: number, s: number): number {
  let h = (Math.imul(x | 0, 0x9e3779b1) ^ Math.imul(y | 0, 0x85ebca77) ^ Math.imul(s | 0, 0xc2b2ae3d)) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
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
    this.slab = new Array<boolean>(this.w * this.h).fill(false);
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

  /**
   * 이어 붙는 바닥 마당(4×4 = 64px 주기로 감기는 한 장, 키트 `wl-<id>`): 칸 (x,y) 은 그 키트의 (x mod 4, y mod 4) 칸이다 — 금·얼룩이 칸 경계를 넘어 이어진다.
   * 변형(ids 의 뒤쪽)은 같은 자리 칸끼리만 바꾼다(해시는 «어느 변형»만 고른다). 키트가 1×1 이면 예전처럼 그룹 칸을 해시로 고른다.
   */
  field(ids: readonly string[], x: number, y: number, weights?: readonly number[]): number {
    const base = this.kit(ids[0]!);
    if (!base || base.width <= 1) return this.ground(ids, x, y, weights);
    const total = ids.reduce((sum, _, k) => sum + (weights?.[k] ?? 1), 0);
    let r = hash2(x, y, this.seed + 101) * total, pickId = ids[0]!;
    for (let k = 0; k < ids.length; k++) { r -= weights?.[k] ?? 1; if (r < 0) { pickId = ids[k]!; break; } }
    const k = this.kit(pickId) ?? base;
    const row = k.rows[y % k.height]; const t = row?.tiles[x % k.width] ?? -1;
    return t >= 0 ? t : (base.rows[y % base.height]?.tiles[x % base.width] ?? -1);
  }

  /** 4방향 오토타일 그룹(이름에 key 가 든 `wl-` 그룹): mask 칸에 변형을 깐다. 맵 밖은 이어진 것으로 본다. 꽉 찬 칸은 속 변형을 해시로 섞는다. */
  /** 길 칸(autotile 로 깐 길) — 흩뿌리는 기물(나무·덤불·잔해)은 길 위에 서지 않는다. */
  road: readonly boolean[] = [];
  autotile(key: string, cells: readonly boolean[]): void {
    this.road = cells;
    this.paint(key, cells);
    // 안쪽 모서리 덧그림(asphalt-in-ne/nw/se/sw): 4방 마스크로는 T·十 자리의 오목한 귀를 못 그린다(r50·r51: «배관 같은 네모 귀»).
    // 길 칸의 두 이웃(예: 북·동)이 길인데 그 사이 대각(북동)이 흙이면 그 칸 위층에 귀 덧그림을 얹는다.
    const corner = { ne: this.cells(`${key}-in-ne`), nw: this.cells(`${key}-in-nw`), se: this.cells(`${key}-in-se`), sw: this.cells(`${key}-in-sw`) };
    if (!corner.ne.length) return;
    const on = (x: number, y: number) => !this.inb(x, y) || cells[this.idx(x, y)]!;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (!cells[this.idx(x, y)]) continue;
      const pick = (c: number[]) => c[Math.floor(hash2(x, y, this.seed + 307) * c.length)]!;
      // 한 칸에 귀가 둘 이상(T 줄기·十 가운데)이면 묶음 조각 asphalt-in-ne-nw 처럼 이름을 이어 찾는다(없으면 첫 귀 하나).
      const has = {
        ne: on(x, y - 1) && on(x + 1, y) && !on(x + 1, y - 1), nw: on(x, y - 1) && on(x - 1, y) && !on(x - 1, y - 1),
        se: on(x, y + 1) && on(x + 1, y) && !on(x + 1, y + 1), sw: on(x, y + 1) && on(x - 1, y) && !on(x - 1, y + 1),
      };
      const names = (["ne", "nw", "se", "sw"] as const).filter((k) => has[k]);
      if (!names.length) continue;
      const combo = names.length > 1 ? this.cells(`${key}-in-${names.join("-")}`) : [];
      const t = combo.length ? pick(combo) : pick(corner[names[0]!]);
      if (t >= 0) this.setDecal(x, y, t);
    }
  }
  /** 길 표시(road)는 그대로 두고 오토타일만 깐다 — 판잣집 촌 발길(track)처럼 «길 위에 기물 금지»가 아닌 바닥. */
  /** 판석 칸(fillSlab) — 맵을 다 짠 뒤 가장자리 오토타일을 덮는다. */
  slab: boolean[] = [];
  hasAutotile(key: string): boolean { return (this.ts.autotileGroups ?? []).some((group) => group.id.startsWith("wl") && group.id.includes(key)); }
  paint(key: string, cells: readonly boolean[], edgesOnly = false): void {
    const g = (this.ts.autotileGroups ?? []).find((group) => group.id.startsWith("wl") && group.id.includes(key));
    if (!g) return;
    const conn = (x: number, y: number) => !this.inb(x, y) || cells[this.idx(x, y)]!;
    const interior = (g as { interiorVariants?: number[][] }).interiorVariants?.flat() ?? [];
    // 가장자리 칸 변형(마스크마다 2~3장) — 곧은 길에서 같은 16px 가장자리가 되풀이되어 «애벌레 띠»로 읽혔다(아스팔트 r44).
    const maskVariants = (g as { maskVariants?: Record<string, number[]> }).maskVariants ?? {};
    // 위상 칸(phaseTiles): 마스크마다 P×P 칸(P = 4 → 64px 주기) — 칸 하나 안에 갇힌 얼룩·가장자리 혹이 칸마다 되풀이되어 «구슬 줄»로 읽혔다(아스팔트 r45~r47).
    // 한 장의 64px 결을 칸 자리(x mod P, y mod P)로 잘라 깔면 얼룩·가장자리가 칸 경계를 넘어 이어진다.
    const phase = (g as { phaseTiles?: Record<string, number[]>; phase?: number }).phaseTiles;
    const P = (g as { phase?: number }).phase ?? 4;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (!cells[this.idx(x, y)]) continue;
      const m = (conn(x, y - 1) ? N : 0) | (conn(x + 1, y) ? E : 0) | (conn(x, y + 1) ? S : 0) | (conn(x - 1, y) ? W : 0);
      if (edgesOnly && m === 15) continue;
      let t = g.variantMap[String(m)];
      const ph = phase?.[String(m)];
      if (ph?.length === P * P) { const pt = ph[(x % P) + (y % P) * P]; if (pt !== undefined && pt >= 0) { this.setLower(x, y, pt); continue; } }
      const mv = m !== 15 ? maskVariants[String(m)] : undefined;
      if (t !== undefined && mv?.length) { const pool = [t, ...mv]; t = pool[Math.floor(hash2(x * 3 + 1, y * 5 + 2, this.seed + 11) * pool.length)]; }
      if (m === 15 && interior.length && hash2(x, y, this.seed + 7) < 0.3) t = interior[Math.floor(hash2(y, x, this.seed) * interior.length)];
      if (t !== undefined) this.setLower(x, y, t);
    }
  }

  /** 맵 하나에 같은 큰 조각(차·잔해 더미)이 몇 번 찍혔나 — 같은 그림이 줄지어 되풀이되지 않게 상한을 둔다. */
  countOf(id: string): number { return this.placed.reduce((n, p) => n + (p.id === id ? 1 : 0), 0); }
  stamp(id: string, x: number, y: number): boolean {
    const k = this.kit(id);
    if (!k) { this.skipped++; return false; }
    const cap = CAPS[id];
    if (cap !== undefined && this.countOf(id) >= cap) return false;
    // 같은 큰 조각이 맞붙어(1칸 이내) 서지 않게 — r4: 같은 천막 둘·같은 판잣집 셋이 나란히 «도장»으로 읽혔다. 담·울·바리케이드 같은 이음 조각은 예외.
    // r5: 1칸 띄운 같은 천막 셋·같은 트럭 둘(꼬리 물기)도 도장으로 읽혔다 — 같은 조각 사이는 4칸, 탈것은 10칸 이상.
    if (!TWIN_OK.has(id)) for (const p of this.placed) {
      if (p.id !== id) continue;
      // r8: 같은 판잣집·컨테이너 집이 한 열에 위아래로 서 «복사»로 읽혔다 — 큰 조각끼리는 12칸 띄운다.
      const g = VEHICLES.has(id) ? 10 : k.width * k.height >= 4 ? 12 : 3;
      if (x < p.x + k.width + g && p.x < x + k.width + g && y < p.y + k.height + g && p.y < y + k.height + g) return false;
    }
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

// dirt-a 는 r3 검수에서 떨어져 굽지 않는다 — 같은 바탕을 쓰는 dirt-b 가 주 땅이다.
const DIRT = ["dirt-b", "dirt-c", "dirt-d"];
/** 맵 하나당 상한(같은 차·더미가 서너 번 찍혀 «도장»으로 읽히던 r2 지적). */
// r3: 같은 무너진 건물·같은 캠핑카가 한 맵에 서너 번 찍혀 «복사해 붙인 도시»로 읽혔다 — 큰 건물·차는 2·1 까지.
// r6: 같은 건물 껍데기 3~4채·같은 천막 5채·같은 표지판 둘이 «도장»으로 읽혔다 — 큰 조각은 맵당 2~3, 작은 소품도 상한을 둔다.
// r7: 같은 차 둘(한 길 위·한 공터 안)이 어디서든 «복사»로 읽혔다 — 탈것은 그림마다 맵당 하나. 판잣집 a·b·c·컨테이너 집도 둘(붉은 판잣집 다섯이 한 덩이로 읽혔다).
const CAPS: Record<string, number> = { "car-rust-h": 1, "car-rust-v": 1, "van-rust": 1, "scrap-heap": 2, "rubble-pile": 3, "water-tank": 2, "generator": 2, "solar-scrap": 3, "husk-tall": 1, "husk-a": 2, "husk-b": 2, "husk-c": 2, "husk-d": 2, "husk-e": 2, "husk-g": 1, "husk-h": 1, "rubble-pile-b": 3, "dead-tree": 3, "bush-wild": 4, "shack-a": 2, "shack-b": 2, "stall-a": 2, "stall-b": 2, "lean-to": 3, "tyres": 4, "shack-c": 2, "container-home": 2, "tent-tarp": 2, "sign-blank": 1, "hut-sheet": 2, "lean-doors": 2, "shack-2f": 1, "hut-stove": 2, "market-shelter": 1, "wash-line": 2, "crates-plastic": 2, "drums": 4, "crates": 4, "lamp-broken": 5,
  // r10: 같은 창 난 낮은 담 판이 한 맵에 너덧 번(좀비 도시·길가 방벽) — 담 판은 그림마다 둘, 바리케이드 셋.
  "wall-h": 2, "wall-h2": 2, "wall-h3": 2, "barricade-h": 3 };
const VEHICLES = new Set(["car-rust-h", "car-rust-v", "van-rust", "car-burnt"]);
const TWIN_OK = new Set(["wall-h", "wall-v", "wall-stub", "fence-h", "barricade-h", "jersey-barrier", "gate-scrap", "log-seat", "campfire"]);
const SLAB = ["slab-a", "slab-b", "slab-c"];
const RUBBLE = ["rubble-a", "rubble-b", "rubble-c"];
const ROAD_MARKS = ["road-crack-a", "road-crack-b", "road-crack-c", "pothole-a", "pothole-b"];
const WEEDS = ["weeds-a", "weeds-b", "weeds-c"];

/**
 * 판석 칸: r11·r12 에서 판석이 128px(8칸) 주기로 같은 줄눈을 되풀이해 «타일 시험판»으로 읽혔다.
 * 줄눈 짜임이 다른 판(slab-d·slab-e — 8칸 둘레 줄눈은 slab-a 와 같다)이 있으면 8×8 덩이마다 짜임 하나를 고르고,
 * slab-a 짜임 덩이 안에서만 칸마다 a·b·c 변형(같은 줄눈, 얼룩·풀만 다름)을 섞는다.
 */
function slabAt(b: Board, x: number, y: number): number {
  const alts = ["slab-d", "slab-e"].filter((id) => b.kit(id));
  if (alts.length) {
    const r = hash2(Math.floor(x / 8), Math.floor(y / 8), b.seed + 211);
    const k = Math.floor(r * (alts.length + 1));
    if (k > 0) { const kit = b.kit(alts[k - 1]!)!; const t = kit.rows[y % kit.height]?.tiles[x % kit.width] ?? -1; if (t >= 0) return t; }
  }
  return b.field(SLAB, x, y, alts.length ? [2, 4, 4] : [6, 2, 2]);
}
function fillDirt(b: Board): void {
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) b.setLower(x, y, b.field(DIRT, x, y, [4, 6, 6]));
}
function fillSlab(b: Board, x0: number, y0: number, w: number, h: number): void {
  // 판석 깨짐 덧칠(wl-…slab-break…)이 있으면 판은 곧은 네모로 깔고, 맵을 다 짠 뒤 finishSlab 이 둘레 칸 위층 덧칠로 흙에 먹힌 끝을 그린다
  // (r3: 이 빠진 판 끝이 계단·외딴 칸 구멍으로 읽혔다). 없으면 예전처럼 이 빠진 네모.
  const edged = b.hasAutotile("slab-break");
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    if (!b.inb(x, y)) continue;
    const edge = (x === x0 || x === x0 + w - 1 ? 1 : 0) + (y === y0 || y === y0 + h - 1 ? 1 : 0);
    // 깨짐 덧칠이 없으면 귀퉁이 칸만 떼어 둥글린다(변 칸 이 빠짐은 r3 에서 계단·외딴 구멍으로 읽혔다).
    if (!edged && edge === 2 && w > 2 && h > 2 && hash2(x, y, b.seed + 57) < 0.7) continue;
    b.setLower(x, y, slabAt(b, x, y));
    b.slab[b.idx(x, y)] = true;
  }
}

/** 판석 둘레 칸(4방향 중 하나라도 판석 아님)에 깨짐 덧칠(위층 평면) — 아래층 판석 결은 끝까지 이어진다. 위에 기물이 선 칸은 건너뛴다. */
function finishSlab(b: Board): void {
  const g = (b.ts.autotileGroups ?? []).find((group) => group.id.startsWith("wl") && group.id.includes("slab-break"));
  if (!g) return;
  const slabTiles = new Set<number>();
  for (const id of [...SLAB, "slab-d", "slab-e"]) for (const r of b.kit(id)?.rows ?? []) for (const t of r.tiles) if (t >= 0) slabTiles.add(t);
  const on = (x: number, y: number) => b.inb(x, y) && b.slab[b.idx(x, y)]! && slabTiles.has(b.map.lowerTiles[b.idx(x, y)] ?? -1);
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    if (!on(x, y)) continue;
    const m = (on(x, y - 1) ? N : 0) | (on(x + 1, y) ? E : 0) | (on(x, y + 1) ? S : 0) | (on(x - 1, y) ? W : 0);
    if (m === 15) continue;
    const t = g.variantMap[String(m)];
    const i = b.idx(x, y);
    if (t === undefined || (layerTileAt(b.map, 2, i) ?? -1) >= 0) continue;
    setLayerTileAt(b.map, 2, i, t);
  }
}
/** 부드러운 값 잡음(0~1) — 덧그림을 덩이로 모으는 데 쓴다. */
function blobNoise(x: number, y: number, seed: number, scale: number): number {
  const fx = x / scale, fy = y / scale, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const v = (i: number, j: number) => hash2(x0 + i, y0 + j, seed);
  return (v(0, 0) * (1 - sx) + v(1, 0) * sx) * (1 - sy) + (v(0, 1) * (1 - sx) + v(1, 1) * sx) * sy;
}
/**
 * 빈 땅에 잔해·잡초·웅덩이 덧그림 — r4: 모든 칸에 같은 밀도로 흩어 «잡음»으로 읽혔다. 잡음 덩이(잡초 무리·잔해 무더기·물 고인 곳) 안에만 모으고,
 * 길 한가운데에는 두지 않는다(길 가장자리 칸에만 드물게 잡초·잔해 — r4: 길 위 덤불·웅덩이가 강의 갈대처럼 읽혔다).
 */
function scatterDecals(b: Board, density: number, road: readonly boolean[]): void {
  const rubble = RUBBLE.flatMap((id) => b.cells(id)), weeds = WEEDS.flatMap((id) => b.cells(id)), puddle = b.cells("puddle");
  // 웅덩이는 값 잡음 격자 꼭짓점마다 같은 타원이 서서 «격자»로 읽혔다(r5) — 맵에 2~4곳만, 아무 데나(길·기물 밖), 서로 6칸 이상.
  const wet = new Set<number>();
  if (puddle.length) for (let t = 0, want = b.int(2, 4); t < 200 && wet.size < want; t++) {
    const x = b.int(1, b.w - 2), y = b.int(1, b.h - 2), i = b.idx(x, y);
    if (road[i] || b.taken[i] || b.slab[i] || [...wet].some((j) => Math.abs(j % b.w - x) + Math.abs(Math.floor(j / b.w) - y) < 6)) continue;
    wet.add(i);
  }
  const roadEdge = (x: number, y: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => b.inb(x + dx!, y + dy!) && !road[b.idx(x + dx!, y + dy!)]);
  // 길 속 금·팬 자리(road-crack-*, pothole-*): 아스팔트 결에 구워 넣으면 128px 마다 같은 짝이 되풀이됐다(r50) — 길 속 칸(네 이웃이 다 길)에 해시로 드물게, 서로 3칸 이상.
  const roadMarks = ROAD_MARKS.flatMap((id) => b.cells(id));
  if (roadMarks.length) {
    const used: number[] = [];
    for (let y = 1; y < b.h - 1; y++) for (let x = 1; x < b.w - 1; x++) {
      const i = b.idx(x, y);
      if (!road[i] || roadEdge(x, y) || b.taken[i] || layerTileAt(b.map, 2, i) >= 0 || hash2(x * 7 + 3, y * 13 + 5, b.seed + 211) > 0.07) continue;
      if (used.some((j) => Math.abs(j % b.w - x) + Math.abs(Math.floor(j / b.w) - y) < 3)) continue;
      b.setDecal(x, y, roadMarks[Math.floor(hash2(y, x * 5, b.seed + 223) * roadMarks.length)]!); used.push(i);
    }
  }
  let rubN = 0; const rubCap = Math.round(b.w * b.h * density * 0.12);
  // r11: 값 잡음 덩이는 격자 축을 따라 가늘게 남아 잡초가 «한 칸 폭 곧은 기둥·ㄱ자»로 섰다 — 무작위 중심의 흔들린 타원 덩이로.
  const patches: { x: number; y: number; rx: number; ry: number }[] = [];
  for (let k = Math.max(3, Math.round(b.w * b.h * density * 0.03)); k > 0; k--) patches.push({ x: b.int(1, b.w - 2), y: b.int(1, b.h - 2), rx: 1.3 + b.int(0, 12) / 10, ry: 1 + b.int(0, 8) / 10 });
  const weedAt = (x: number, y: number) => patches.some((p) => { const d = Math.hypot((x - p.x) / p.rx, (y - p.y) / p.ry); return d < 1 + (hash2(x * 3 + 1, y * 5 + 2, b.seed + 97) - 0.5) * 0.7; });
  const nearTaken = (x: number, y: number) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (b.inb(x + dx, y + dy) && b.taken[b.idx(x + dx, y + dy)]) return true; return false; };
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    const i = b.idx(x, y);
    if (b.taken[i] || layerTileAt(b.map, 2, i) >= 0) continue;
    const onRoad = road[i];
    if (onRoad && !roadEdge(x, y)) continue;
    // r9: 덩이가 작고 고르게 퍼져 «고르게 뿌린 잔해»로 읽혔다 — 덩이를 키우고(잡초 7, 잔해 10) 드물게.
    const rubZ = blobNoise(x, y, b.seed + 83, 10);
    const r = hash2(x, y, b.seed + 31);
    let pool: readonly number[] = [];
    if (wet.has(i)) pool = puddle;
    // r8: 낱칸 잔해가 맵 전체에 고르게(때로 격자로) 뿌려져 «얼룩»으로 읽혔다 — 덩이 안에만, 덩이는 더 드물고 더 빽빽하게.
    // r10: 덩이 안에서도 낱칸이 띄엄띄엄(대각 바둑판·세로 줄)이라 «고르게 뿌린 잔해»였다 — 덩이 속만, 속에선 빽빽이(낱칸 대신 작은 무더기).
    else if (weedAt(x, y) && r < 0.7 * (onRoad ? 0.3 : 1)) pool = weeds;
    // 잔해 낱칸 그림은 두세 가지뿐이라 빽빽하면 «같은 돌 깔개»가 된다(r10 시험) — 덩이 한가운데만, 기물 둘레 1칸은 비우고, 맵당 상한.
    else if (rubZ > 0.9 && r < 0.35 && !onRoad && rubN < rubCap && !nearTaken(x, y)) { pool = rubble; rubN++; }
    if (pool.length) b.setDecal(x, y, pool[Math.floor(hash2(x + 3, y + 7, b.seed) * pool.length)]!);
  }
}

/** 줄(가로)에 조각들을 왼→오로 여백 두고 세운다. 반환 = 놓인 조각 [id,x,y]. */
function rowOf(b: Board, ids: readonly string[], x0: number, x1: number, footY: number, start: Pt, must: Pt[], gap: [number, number] = [1, 2], areas?: WlArea[], name?: (id: string) => string, jitter = 0): { id: string; x: number; y: number }[] {
  const out: { id: string; x: number; y: number }[] = [];
  let x = x0;
  for (const id of ids) {
    const s = b.kitSize(id); if (!s) continue;
    // r8: 놓을 수 없는 조각(상한·같은 그림 간격)이 x 를 줄 끝까지 밀어 뒤 조각이 하나도 못 섰다 — 지금 자리부터 몇 칸만 보고, 못 놓으면 x 를 그대로 둔다.
    // jitter(r11): 한 발 줄에 고르게 선 조각들이 «선반»으로 읽혔다 — 조각마다 발 줄을 ±jitter 흔든다.
    const dy = jitter ? b.int(-jitter, jitter) : 0;
    for (let xx = x; xx + s.w - 1 <= x1 && xx <= x + 3; xx++) {
      const y = footY + dy - s.h + 1;
      if (y < 0 || !b.free(xx, y, s.w, s.h)) continue;
      if (!b.stampSafe(id, xx, y, start, must)) continue;
      out.push({ id, x: xx, y });
      const d = b.door(id, xx, y);
      const label = areas && name ? name(id) : "";
      if (areas && label) areas.push({ name: label, x: xx, y, w: s.w, h: s.h, tag: id, door: d });
      x = xx + s.w + b.int(gap[0], gap[1]);
      break;
    }
    if (x > x1) break;
  }
  return out;
}

/** 섞은 줄에서 같은 조각이 바로 이웃하지 않게(나란한 같은 건물 두 채가 도장으로 읽혔다). */
function noRepeat(ids: string[]): string[] {
  for (let i = 1; i < ids.length; i++) if (ids[i] === ids[i - 1]) { const j = ids.findIndex((v, k) => k > i && v !== ids[i]); if (j > 0) [ids[i], ids[j]] = [ids[j]!, ids[i]!]; }
  return ids;
}

/**
 * 빈 땅(사각형 안)에 조각 n 개 — 서로 1칸 띄운다. r5: 사각형 전체에 고르게 흩으면 «체로 뿌린 잡동사니»로 읽혔다 —
 * 덩이 중심 n/3 곳을 먼저 잡고 그 둘레(가로 ±4·세로 ±3)에 모은다. 풀·고사목은 판석 위에 서지 않는다.
 */
const PLANTS = new Set(["dead-tree", "bush-wild"]);
/** 선 건물 껍데기 — r55 에서 c·d·e 가 더해졌다(그림이 번들에 없으면 b.kit 로 걸러진다). */
// r10: 여러 층 껍데기 husk-g(5층 골조 탑)·husk-h(3층 상가)를 더했다 — 좀비 도시가 «낮은 담만 남은 교외»로 읽혔다.
const HUSKS = ["husk-tall", "husk-g", "husk-h", "husk-a", "husk-b", "husk-c", "husk-d", "husk-e"];
function sprinkle(b: Board, ids: readonly string[], n: number, x0: number, y0: number, x1: number, y1: number, start: Pt, must: Pt[]): number {
  let k = 0;
  const centres = Array.from({ length: Math.max(1, Math.ceil(n / 3)) }, () => ({ x: b.int(x0, Math.max(x0, x1)), y: b.int(y0, Math.max(y0, y1)) }));
  for (let tries = 0; k < n && tries < n * 40; tries++) {
    const id = b.pick(ids); const s = b.kitSize(id); if (!s) continue;
    const c = centres[tries % centres.length]!;
    const x = Math.min(Math.max(x0, x1 - s.w + 1), Math.max(x0, c.x + b.int(-4, 4))), y = Math.min(Math.max(y0, y1 - s.h + 1), Math.max(y0, c.y + b.int(-3, 3)));
    if (!b.free(x - 1, y - 1, s.w + 2, s.h + 2)) continue;
    let onRoad = false; for (let dy = 0; dy < s.h && !onRoad; dy++) for (let dx = 0; dx < s.w; dx++) if (b.road[b.idx(x + dx, y + dy)] || (PLANTS.has(id) && b.slab[b.idx(x + dx, y + dy)])) { onRoad = true; break; }
    if (onRoad) continue;
    if (b.stampSafe(id, x, y, start, must)) k++;
  }
  return k;
}

/** 녹슨 차들을 길 칸에 — 차선 안에 비스듬히 두지 않고 가로 길엔 가로 차, 세로 길엔 세로 차. 통행은 남긴다(stampSafe). */
function wrecksOnRoad(b: Board, lanes: { x0: number; y0: number; x1: number; y1: number; horizontal: boolean }[], n: number, start: Pt, must: Pt[], ids: { h: string[]; v: string[] }): void {
  let k = 0;
  const used = new Map<string, number>();
  for (let tries = 0; k < n && tries < n * 50; tries++) {
    const lane = b.pick(lanes); const id = b.pick(lane.horizontal ? ids.h : ids.v); const s = b.kitSize(id); if (!s) continue;
    // 같은 차는 맵에 둘까지(같은 지프가 줄지어 서지 않게)
    if ((used.get(id) ?? 0) >= 2) continue;
    // 길 가운데가 아니라 갓길(차선 한쪽 끝)에 붙인다 — 버려진 차는 길을 막기보다 길가에 밀려 있다.
    const x = lane.horizontal ? b.int(lane.x0, Math.max(lane.x0, lane.x1 - s.w + 1)) : (b.int(0, 1) ? lane.x0 : Math.max(lane.x0, lane.x1 - s.w + 1));
    const y = lane.horizontal ? (b.int(0, 1) ? lane.y0 : Math.max(lane.y0, lane.y1 - s.h + 1)) : b.int(lane.y0, Math.max(lane.y0, lane.y1 - s.h + 1));
    let clash = false;
    for (let dy = -1; dy <= s.h; dy++) for (let dx = -1; dx <= s.w; dx++) if (b.inb(x + dx, y + dy) && b.taken[b.idx(x + dx, y + dy)]) clash = true;
    if (clash) continue;
    // 길 칸은 keep 이 아니다(차가 길 위에 선다) — 대신 통행 검사가 길을 끊지 않게 한다.
    if (b.stampSafe(id, x, y, start, must)) { k++; used.set(id, (used.get(id) ?? 0) + 1); }
  }
}

// ─────────────────────────────── settlement
/** 세로 울이 없을 때: 무너진 담(wall-v 1×3, 모자라면 wall-stub 1×2)을 이어 세운다. 틈은 일부러 남긴다. */
function wallRunV(b: Board, x: number, y0: number, y1: number, start: Pt, must: readonly Pt[]): void {
  let y = y0;
  while (y <= y1) {
    if (hash2(x, y, b.seed + 23) < 0.2) { y++; continue; }
    // r8: 같은 세로 담 판이 다섯 장 줄지어 «한 판 반복»으로 읽혔다 — 세 번에 한 번은 토막으로.
    if (y + 2 <= y1 && hash2(y, x, b.seed + 27) > 0.33 && b.stampSafe("wall-v", x, y, start, must)) { y += 3; continue; }
    if (y + 1 <= y1 && b.stampSafe("wall-stub", x, y, start, must)) { y += 2; continue; }
    y++;
  }
}

/**
 * 섞은 가로 방벽(발 줄 footY): 담 판(wall-h 계열)·바리케이드·고철 울 3칸·드럼통·타이어를 같은 것이 잇달지 않게 이어 세운다. gateX 둘레 2칸은 뒷문 틈.
 * r9: 같은 담 판이 셋씩 나란히 «같은 낮은 폐허 셋»으로 읽혔다 — 담 판은 줄마다 섞인 조각 중 하나일 뿐이다.
 */
function mixedWallH(b: Board, x0: number, x1: number, footY: number, gateX: number, start: Pt, must: readonly Pt[], ruin = false, fenceLine = false): void {
  const fence = b.cells("fence-h");
  const walls = ["wall-h", "wall-h2", "wall-h3"].filter((id) => b.kit(id));
  let x = x0, last = "";
  // r11: 한 줄에 같은 바리케이드·담 판이 셋씩 고른 차례로 섰다 — 울·틈 말고는 한 줄에 한 번(담 토막은 두 번).
  const usedN = new Map<string, number>();
  const room = (id: string) => id === "fence" || id === "gap" || (usedN.get(id) ?? 0) < (id === "wall-stub" ? 2 : 1);
  while (x <= x1) {
    if (Math.abs(x - gateX) <= 1 || hash2(x, footY, b.seed + 91) < 0.08) { x++; last = ""; continue; }
    // ruin: 무너진 건물 터의 남은 벽 — 울·바리케이드·드럼 대신 담 판·토막·잔해·빈 틈.
    // fenceLine(r10): 길가 방벽 위·아래가 같은 담 판·모래주머니 차례로 읽혔다 — 한 줄은 고철 울 위주(틈마다 드럼·바리케이드)로.
    const opts = b.shuffle(ruin ? [...walls, "wall-stub", "rubble-pile", "rubble-pile-b", "gap"].filter((id) => id === "gap" || b.kit(id))
      : fenceLine ? ["fence", "fence", "fence", "fence", "fence", "drums", "barricade-h", "wall-stub"] : [...walls, "barricade-h", "fence", "fence", "drums", "tyres", "wall-stub"]).filter((id) => id !== last && room(id) && !(fenceLine && id === "gap" && last === "gap"));
    let done = false;
    for (const id of opts) {
      if (id === "gap") { x += 1 + b.int(0, 1); last = id; done = true; break; }
      if (id === "fence") {
        if (!fence.length) continue;
        let n = 0; for (let k = 0, kn = fenceLine ? 3 + b.int(0, 4) : 3; k < kn && x + k <= x1 && Math.abs(x + k - gateX) > 1; k++) { const i = b.idx(x + k, footY); if (b.taken[i] || b.keep[i] || b.road[i]) break; n++; }
        if (n < 2) continue;
        for (let k = 0; k < n; k++) { const i = b.idx(x + k, footY); setLayerTileAt(b.map, 3, i, fence[(x + k) % fence.length]!); b.taken[i] = true; }
        x += n; last = id; done = true; break;
      }
      const z = b.kitSize(id); if (!z || x + z.w - 1 > x1) continue;
      if (b.stampSafe(id, x, footY - z.h + 1, start, must)) { x += z.w; last = id; usedN.set(id, (usedN.get(id) ?? 0) + 1); done = true; break; }
    }
    if (!done) x++;
  }
}

/** 세로 고물 벽: 드럼통·타이어·세로 담·녹슨 차(세로)를 섞어 y0..y1 열을 메운다(같은 토막을 잇달아 두지 않는다). */
function junkColumn(b: Board, x: number, y0: number, y1: number, start: Pt, must: readonly Pt[]): void {
  let y = y0, last = "";
  const usedN = new Map<string, number>();   // r9: 같은 드럼·타이어 더미가 한 열에 서너 번 — 한 열에 같은 조각은 두 번까지
  while (y <= y1) {
    if (hash2(x, y, b.seed + 41) < 0.22) { y++; last = ""; continue; } // r5: 드럼통·타이어가 번갈아 선 기둥 줄이 규칙적이었다 — 틈을 섞는다
    const opts = b.shuffle(["drums", "tyres", "wall-v", "wall-stub", "crates", "scrap-heap", "barricade-v", "rubble-pile"]).filter((id) => id !== last && (usedN.get(id) ?? 0) < 2 && b.kit(id)); // 차는 담 줄에 끼우지 않는다(r3: 담 대신 지프)
    let done = false;
    for (const id of opts) {
      const z = b.kitSize(id); if (!z || y + z.h - 1 > y1) continue;
      const xx = z.w > 1 ? (x === 0 ? x : x - z.w + 1) : x;
      if (b.stampSafe(id, xx, y, start, must)) { y += z.h; last = id; usedN.set(id, (usedN.get(id) ?? 0) + 1); done = true; break; }
    }
    if (!done) y++;
  }
}

/**
 * 울 친 폐차장(r10): 들판에 차·고철 몇을 흩던 «폐차장»이 빈 흙에 낱개 잔해로 읽혀 거주지 옆 사분면이 텅 비었다 —
 * 사분면 안 무작위 자리에 12~16×9~11 터를 잡고 윗변 고철 울(입구 틈), 한 변 고물 기둥, 안에 고철·차·타이어 줄 둘.
 */
function scrapLot(b: Board, qx0: number, qy0: number, qx1: number, qy1: number, spawn: Pt, must: Pt[], areas: WlArea[]): void {
  const w = Math.min(qx1 - qx0 + 1, b.int(12, 16)), h = Math.min(qy1 - qy0 + 1, b.int(9, 11));
  if (w < 8 || h < 7) { sprinkle(b, ["car-rust-h", "scrap-heap", "tyres", "van-rust"], 3, qx0, qy0, qx1, qy1, spawn, must); return; }
  const lx = qx0 + b.int(0, Math.max(0, qx1 - qx0 + 1 - w)), ly = qy0 + b.int(0, Math.max(0, qy1 - qy0 + 1 - h));
  mixedWallH(b, lx, lx + w - 1, ly + 1, lx + b.int(2, w - 3), spawn, must, false, true);
  junkColumn(b, b.int(0, 1) ? lx : lx + w - 1, ly + 2, ly + h - 1, spawn, must);
  const junk = ["scrap-heap", "tyres", "car-rust-h", "generator", "scrap-heap", "solar-scrap", "rubble-pile", "van-rust", "crates", "car-rust-v"];
  rowOf(b, noRepeat(b.shuffle(junk.slice())), lx + 1 + b.int(0, 1), lx + w - 2, ly + 4 + b.int(0, 1), spawn, must, [0, 2]);
  if (h >= 9) rowOf(b, noRepeat(b.shuffle(junk.slice())), lx + 1 + b.int(0, 2), lx + w - 2, ly + h - 1, spawn, must, [0, 2]);
  areas.push({ name: "폐차장", x: lx, y: ly, w, h, tag: "junkyard" });
}

function composeSettlement(b: Board): { areas: WlArea[]; spawn: Pt; road: boolean[] } {
  const { w: Wd, h: Hd } = b;
  const areas: WlArea[] = [];
  fillDirt(b);
  const road = new Array<boolean>(Wd * Hd).fill(false);
  const ry = Math.max(9, Math.floor(Hd * (0.28 + b.int(0, 10) / 100)));   // 가로 큰길 윗줄(3줄)
  // 거주지를 큰길 서쪽(세로 길 동쪽 치우침) 또는 동쪽(세로 길 서쪽 치우침)에 — 같은 틀이 시드마다 되풀이되지 않게
  const east = (b.seed & 1) === 1 ? b.int(0, 3) > 0 : b.int(0, 3) === 0;
  const rx = east ? Math.floor(Wd * 0.34) + b.int(-2, 2) : Math.floor(Wd * 0.62) + b.int(-2, 2); // 세로 큰길 왼줄(3줄)
  for (let y = ry; y < ry + 3; y++) for (let x = 0; x < Wd; x++) road[b.idx(x, y)] = true;
  for (let y = 0; y < Hd; y++) for (let x = rx; x < rx + 3; x++) road[b.idx(x, y)] = true;
  b.autotile("asphalt", road);
  const spawn = { x: 1, y: ry + 1 };
  const must: Pt[] = [{ x: Wd - 2, y: ry + 1 }, { x: rx + 1, y: 1 }, { x: rx + 1, y: Hd - 2 }];
  // 북쪽 띠: 무너진 건물 껍데기 줄(발 = 큰길 위 2줄 — 앞에 1줄 보도 흙)
  const foot = ry - 2;
  b.markKeep(0, ry - 1, Wd, 1);
  // r7: 같은 2층 껍데기 둘이 윗줄에 «복사»로 읽혔다 — 껍데기는 이 틀에서 그림마다 한 번, 두 줄이 나눠 쓴다.
  const husks = b.shuffle(HUSKS.filter((id) => b.kit(id)));
  const ruinName = (id: string) => (id.startsWith("husk") ? "무너진 건물" : "무너진 벽");
  rowOf(b, b.shuffle([husks[0]!, husks[1]!, "wall-h", "rubble-pile", "wall-h"]), 1 + b.int(0, 3), rx - 2, foot, spawn, must, [1, 4], areas, ruinName);
  rowOf(b, b.shuffle([husks[2]!, "wall-h", "scrap-heap"]), rx + 4 + b.int(0, 3), Wd - 2, foot, spawn, must, [1, 4], areas, ruinName);
  // 남서 거주지: 바리케이드·고철 울 사각형, 북쪽 문(큰길에서 2줄 흙길)
  const cx0 = east ? Math.max(rx + 5, Wd - 2 - 26) : 2, cy0 = ry + 5 + b.int(0, 2), cx1 = east ? Wd - 3 : Math.min(rx - 3, 2 + 26), cy1 = Hd - 2;
  // r7: 문이 울 한가운데·남북 틈이 마주 보면서 거주지가 좌우 거울로 읽혔다 — 문을 30~70% 자리로.
  const gateX = cx0 + Math.floor((cx1 - cx0) * (0.28 + b.int(0, 40) / 100));
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
  const slabX0 = inner.x0 + 2, slabX1 = inner.x0 + 2 + (inner.x1 - inner.x0 - 3) - 1;
  fillSlab(b, slabX0, plazaY0, slabX1 - slabX0 + 1, plazaY1 - plazaY0 + 1);
  // 광장 가로 통로(문 → 광장): 문 열 2칸
  for (let y = inner.y0; y < plazaY0; y++) for (const dx of [0, 1]) b.markKeep(gateX + dx, y);
  // 판잣집 줄(안쪽 위) — 문은 아래(광장 쪽)
  // r7: 같은 간격 판잣집 줄 + 양옆 같은 판잣집이 거울로 읽혔다 — 줄 시작·간격을 흔들고 천막·차양·컨테이너 집을 섞는다.
  const shacks = rowOf(b, noRepeat(b.shuffle(["shack-a", "shack-b", "lean-to", "container-home", "tent-tarp", "shack-c"])), inner.x0 + 1 + b.int(0, 3), inner.x1 - 1, plazaY0 - 1, spawn, must, [1, 3], areas, () => "판잣집");
  for (const s of shacks) { const d = b.door(s.id, s.x, s.y); must.push({ x: d.x, y: d.y + 1 }); b.markKeep(d.x, d.y + 1); }
  // 광장: 모닥불 + 통나무 의자, 장터 노점 둘~셋
  const fx = Math.floor((inner.x0 + inner.x1) / 2) + b.int(-3, 3), fy = Math.floor((plazaY0 + plazaY1) / 2);
  if (b.stampSafe("campfire", fx, fy, spawn, must)) {
    areas.push({ name: "모닥불 광장", x: inner.x0 + 2, y: plazaY0, w: inner.x1 - inner.x0 - 3, h: plazaY1 - plazaY0 + 1, tag: "plaza" });
    b.stampSafe("log-seat", fx - 1, fy + 1, spawn, must) || b.stampSafe("log-seat", fx, fy + 1, spawn, must);
    b.stampSafe("log-seat", fx - 3, fy, spawn, must);
  }
  // 노점은 판석 안쪽에만(한 칸 띄워) — r3: 지붕이 판석 끝 밖으로 걸쳤다. 같은 노점 둘을 나란히 두지 않는다.
  const stalls = rowOf(b, b.shuffle(["stall-a", "stall-b"]), slabX0 + 1, slabX1 - 1, plazaY1, spawn, must, [3, 6]);
  if (stalls.length) areas.push({ name: "고물 장터", x: stalls[0]!.x, y: stalls[0]!.y, w: stalls[stalls.length - 1]!.x + 3 - stalls[0]!.x, h: 2, tag: "market" });
  // 아래 줄: 급수탑·발전기·태양판·드럼통·상자·고철 더미
  const util = rowOf(b, b.shuffle(["generator", "solar-scrap", "drums", "crates", "scrap-heap", "tyres", "lean-to"]), inner.x0 + 1 + b.int(0, 4), inner.x1 - 1, inner.y1, spawn, must, [1, 3]);
  if (util.length) areas.push({ name: "물·전기 마당", x: inner.x0 + 1, y: inner.y1 - 3, w: inner.x1 - inner.x0 - 1, h: 4, tag: "utility" });
  // 둘레: 북·남은 이어지는 고철 울(fence-h), 동·서는 드럼통·타이어·세로 담 토막을 섞어 쌓은 고물 벽, 북문은 고철 문짝(gate-scrap, 걸음).
  // (r2: 같은 콘크리트 담 토막을 일렬로 찍으면 «작은 벙커 줄»로 읽혔다 — 한 토막 반복 금지)
  const fenceH = b.cells("fence-h");
  const barricadeIds = ["barricade-h"];
  // r8: 남쪽 울도 문 자리(gateX)에서 끊겨 남북이 거울로 읽혔다 — 남쪽은 따로 무너진 틈 한 곳(2~4칸)만, 문과 다른 자리.
  const southGap = cx0 + 2 + b.int(0, Math.max(0, cx1 - cx0 - 6)), southGapW = b.int(2, 4);
  for (let x = cx0; x <= cx1; x++) for (const y of [cy0, cy1]) {
    if (y === cy0 && (x === gateX || x === gateX + 1)) continue;
    if (y === cy1 && x >= southGap && x < southGap + southGapW && Math.abs(x - gateX) > 3) continue;
    const i = b.idx(x, y); if (b.taken[i] || !fenceH.length) continue; setLayerTileAt(b.map, 3, i, fenceH[(x + y) % fenceH.length]!); b.taken[i] = true;
  }
  b.stamp("gate-scrap", gateX, cy0 - 1);
  // r7: 동·서 두 변이 같은 타이어·드럼 기둥으로 마주 보아 거울로 읽혔다 — 한 변은 고물 벽, 다른 변은 담 토막 줄.
  const junkLeft = b.int(0, 1) === 0;
  junkColumn(b, junkLeft ? cx0 : cx1, cy0, cy1, spawn, must);
  wallRunV(b, junkLeft ? cx1 : cx0, cy0 + 1, cy1 - 1, spawn, must);
  // 문 양옆 바리케이드(울 위에 덮어 찍지 않고 바깥 앞에 덧댄다)
  // r8: 문 양옆 같은 바리케이드 둘이 거울로 읽혔다 — 한쪽에만 바리케이드, 다른 쪽엔 드럼통 하나.
  { const s = b.kitSize(barricadeIds[0]!); const left = b.int(0, 1) === 0;
    if (s) b.stampSafe("barricade-h", left ? gateX - 4 : gateX + 2, cy0 - s.h, spawn, must);
    b.stampSafe("drums", left ? gateX + 3 : gateX - 2, cy0 - 1, spawn, must); }
  // 급수탑은 하나 — 문에서 먼 쪽 귀에.
  if (gateX - cx0 > cx1 - gateX) b.stampSafe("water-tank", cx0 + 1, cy0 + 1, spawn, must) || b.stampSafe("water-tank", cx1 - 3, cy0 + 1, spawn, must);
  else b.stampSafe("water-tank", cx1 - 3, cy0 + 1, spawn, must) || b.stampSafe("water-tank", cx0 + 1, cy0 + 1, spawn, must);
  areas.push({ name: "생존자 거주지", x: cx0, y: cy0, w: cx1 - cx0 + 1, h: cy1 - cy0 + 1, tag: "compound", door: { x: gateX, y: cy0 } });
  // 폐차장(울 친 터)을 길 위 폐차보다 먼저 — 차 그림은 맵마다 하나씩이라 폐차장이 먼저 쓴다.
  { const jx0 = east ? 2 : rx + 4, jx1 = east ? rx - 3 : Wd - 2; scrapLot(b, jx0, ry + 5, jx1, Hd - 2, spawn, must, areas); }
  // 큰길: 녹슨 차·검문(분리대)
  wrecksOnRoad(b, [{ x0: 2, y0: ry, x1: rx - 3, y1: ry + 2, horizontal: true }, { x0: rx + 4, y0: ry, x1: Wd - 3, y1: ry + 2, horizontal: true }, { x0: rx, y0: 1, x1: rx + 2, y1: ry - 3, horizontal: false }, { x0: rx, y0: ry + 4, x1: rx + 2, y1: Hd - 3, horizontal: false }],
    b.int(4, 6), spawn, must, { h: ["car-rust-h", "car-rust-h", "scrap-heap", "van-rust", "van-rust"], v: ["car-rust-v"] });
  b.stampSafe("jersey-barrier", gateX - 1, ry + 2, spawn, must);
  // 남동: 폐차장·고사목·덤불·잔해 더미
  // r8: 빈 들판에 꺾인 가로등이 홀로 서 있었다 — 가로등은 길가에만. 들판은 나무·덤불·잔해 덩이 몇.
  sprinkle(b, ["dead-tree", "bush-wild", "rubble-pile", "dead-tree", "sign-blank"], Math.floor(Wd / 9), 0, 0, Wd - 1, Hd - 1, spawn, must);
  return { areas, spawn, road };
}

/**
 * 정착지 둘째 틀(짝수 seed): 울 친 거주지 대신 «길가 장터 정착지» — 굽은 옛 국도 하나를 따라 판잣집·노점이 양쪽에 붙고,
 * 길 두 끝은 분리대·바리케이드 검문, 길 가운데 급수탑 마당. 무너진 건물은 길에서 떨어진 곳에 몇 채. (r2: 두 seed 가 같은 틀로 읽혔다)
 */
function composeRoadsideSettlement(b: Board): { areas: WlArea[]; spawn: Pt; road: boolean[] } {
  const { w: Wd, h: Hd } = b;
  const areas: WlArea[] = [];
  fillDirt(b);
  const road = new Array<boolean>(Wd * Hd).fill(false);
  // 옛 국도: 서→동 곧은 길, 가운데쯤 한 번 꺾여(2~4줄) 내려가거나 올라간다(폭 3). 사인 곡선은 계단만 잔뜩 남겼다.
  // r9: 꺾인 곳의 네모 계단과 아스팔트에 박힌 보도 한 칸이 «타일 오류»로 읽혔다 — 길은 곧게(높이만 seed 로 흔든다).
  const mid = Math.floor(Hd / 2) + b.int(-3, 2), off = 0, jog = Math.floor(Wd / 2) + b.int(-8, 8);
  const cy = (x: number) => (x < jog ? mid : mid + off);
  for (let x = 0; x < Wd; x++) { const c = cy(x); for (let y = c - 1; y <= c + 1; y++) if (b.inb(x, y)) road[b.idx(x, y)] = true; }
  for (let x = jog - 1; x <= jog + 1; x++) for (let y = Math.min(mid, mid + off) - 1; y <= Math.max(mid, mid + off) + 1; y++) if (b.inb(x, y)) road[b.idx(x, y)] = true;
  b.autotile("asphalt", road);
  const spawn = { x: 1, y: cy(1) };
  const must: Pt[] = [{ x: Wd - 2, y: cy(Wd - 2) }];
  // 길가 한 줄(위·아래)은 보도로 비운다
  for (let x = 0; x < Wd; x++) { let top = Hd, bot = -1; for (let y = 0; y < Hd; y++) if (road[b.idx(x, y)]) { top = Math.min(top, y); bot = Math.max(bot, y); }
    if (top > 0) b.markKeep(x, top - 1, 1, 1); if (bot < Hd - 1) b.markKeep(x, bot + 1, 1, 1); }
  // 길 북쪽: 판잣집·노점 줄(발 = 보도 위), 남쪽: 노점·판잣집 줄(머리 = 보도 아래) — 구간마다 따로 세워 굽은 길을 따른다
  const north = b.shuffle(["shack-a", "stall-a", "shack-b", "lean-to", "stall-b", "shack-a", "lean-to", "stall-a"]);
  const south = b.shuffle(["stall-b", "shack-b", "lean-to", "stall-a", "shack-a", "lean-to", "stall-b"]);
  let midX = Math.floor(Wd / 2) + b.int(-3, 3);
  if (Math.abs(midX - jog) < 6) midX = jog + (jog < Wd / 2 ? 8 : -8);
  let x = 4, k = 0;
  while (x < Wd - 5 && k < north.length) {
    const id = north[k]!; const z = b.kitSize(id); k++; if (!z) continue;
    if (Math.abs(x + z.w / 2 - midX) < 5) { x += 4; continue; }  // 가운데는 급수탑 마당
    let top = Hd; for (let xx = x; xx < x + z.w; xx++) for (let y = 0; y < Hd; y++) if (road[b.idx(xx, y)]) { top = Math.min(top, y); break; }
    const y = top - 2 - z.h + 1;
    if (y >= 1 && b.free(x, y, z.w, z.h) && b.stampSafe(id, x, y, spawn, must)) {
      const d = b.door(id, x, y); areas.push({ name: id.startsWith("stall") ? "길가 노점" : "판잣집", x, y, w: z.w, h: z.h, tag: id, door: d });
      if (b.inb(d.x, d.y + 1)) { must.push({ x: d.x, y: d.y + 1 }); b.markKeep(d.x, d.y + 1); }
    }
    x += z.w + b.int(1, 3);
  }
  x = 3 + b.int(0, 3); k = 0;
  while (x < Wd - 5 && k < south.length) {
    const id = south[k]!; const z = b.kitSize(id); k++; if (!z) continue;
    if (Math.abs(x + z.w / 2 - midX) < 5) { x += 4; continue; }
    let bot = -1; for (let xx = x; xx < x + z.w; xx++) for (let y = Hd - 1; y >= 0; y--) if (road[b.idx(xx, y)]) { bot = Math.max(bot, y); break; }
    const y = bot + 2;
    if (y + z.h < Hd - 1 && b.free(x, y, z.w, z.h) && b.stampSafe(id, x, y, spawn, must)) {
      const d = b.door(id, x, y); areas.push({ name: id.startsWith("stall") ? "길가 노점" : "판잣집", x, y, w: z.w, h: z.h, tag: id, door: d });
      if (b.inb(d.x, d.y + 1)) must.push({ x: d.x, y: d.y + 1 });
    }
    x += z.w + b.int(1, 3);
  }
  // 가운데 전기 마당: 판석 + 태양판·발전기·드럼통 — 급수탑 마당은 판잣집 촌 장터와 같은 묶음으로 읽혀(r6) 여기선 쓰지 않는다.
  const my = cy(midX) - 7;
  fillSlab(b, midX - 3, my, 7, 5);
  b.stampSafe("solar-scrap", midX - 2, my, spawn, must); b.stampSafe("generator", midX + 1, my, spawn, must);
  b.stampSafe("drums", midX - 2, my + 3, spawn, must); b.stampSafe("crates", midX + 2, my + 3, spawn, must);
  areas.push({ name: "발전 마당", x: midX - 3, y: my, w: 7, h: 5, tag: "utility" });
  // 검문: 길 양 끝에 분리대·바리케이드(통행은 남긴다)
  // 두 끝 검문은 서로 다르게(r9: 같은 검문 차림이 두 번) — 서쪽은 분리대+드럼통, 동쪽은 바리케이드+타이어(seed 로 맞바꿈).
  const westJersey = b.int(0, 1) === 0;
  for (const [ex, jersey] of [[3, westJersey], [Wd - 6, !westJersey]] as const) { const c = cy(ex);
    if (jersey) { b.stampSafe("jersey-barrier", ex, c - 1, spawn, must); b.stampSafe("drums", ex + 1, c - 3, spawn, must); }
    else { b.stampSafe("barricade-h", ex - 1, c - 3, spawn, must); b.stampSafe("tyres", ex + 1, c + 2, spawn, must); } }
  areas.push({ name: "길가 장터 정착지", x: 0, y: 0, w: Wd, h: Hd, tag: "settlement-road" });
  // 길가 줄 뒤: 뒷마당 헛간·창고·태양판 — 길가만 붙고 뒤가 텅 빈 벌판으로 읽혔다.
  const top = Math.min(mid, mid + off), bot = Math.max(mid, mid + off);
  // 요새 장터 거리(r4: 길가 정착지가 판잣집 촌과 구분되지 않았다): 길 양쪽 보도 한 줄을 판석으로, 가게 줄 뒤를 고철 울로 막는다(뒷문 틈 둘).
  const dirtTiles = new Set<number>(); for (const id of DIRT) for (const r of b.kit(id)?.rows ?? []) for (const t of r.tiles) if (t >= 0) dirtTiles.add(t);
  const fenceH = b.cells("fence-h");
  const gapsN = new Set([b.int(6, Wd / 2 - 2), b.int(Wd / 2 + 2, Wd - 7)].map(Math.round)), gapsS = new Set([b.int(6, Wd / 2 - 2), b.int(Wd / 2 + 2, Wd - 7)].map(Math.round));
  for (let x = 2; x < Wd - 2; x++) {
    let rt = Hd, rb = -1; for (let y = 0; y < Hd; y++) if (road[b.idx(x, y)]) { rt = Math.min(rt, y); rb = Math.max(rb, y); }
    if (rb < 0) continue;
    void rt; void rb;
    // r5: 가게 줄 뒤 긴 고철 울 두 줄이 아무것도 두르지 않고 벌판에 홀로 서 있었다 — 뺐다(대신 아래 뒷마당 울).
    void gapsN; void gapsS;
  }
  // 판잣집 뒷마당: 집 뒤에 고철 울(가로)과 담 토막 두 기둥으로 ㄷ자 마당을 두르고 안에 상자·드럼통 — 울은 늘 무엇을 두른다.
  if (fenceH.length) for (const a of areas) {
    if (!a.tag.startsWith("shack") || hash2(a.x, a.y, b.seed + 61) < 0.35) continue;
    const northSide = a.y + a.h <= Math.min(mid, mid + off);
    const fy = northSide ? a.y - 3 : a.y + a.h + 2, iy = northSide ? a.y - 2 : a.y + a.h;
    if (fy < 1 || fy > Hd - 2) continue;
    let clear = true; for (let x = a.x - 1; x <= a.x + a.w; x++) { if (!b.inb(x, fy)) { clear = false; break; } const i = b.idx(x, fy); if (b.taken[i] || b.keep[i] || road[i]) clear = false; }
    if (!clear) continue;
    for (let x = a.x - 1; x <= a.x + a.w; x++) { const i = b.idx(x, fy); setLayerTileAt(b.map, 3, i, fenceH[x % fenceH.length]!); b.taken[i] = true; }
    b.stampSafe("wall-stub", a.x - 1, Math.min(iy, fy + 1), spawn, must); b.stampSafe("wall-stub", a.x + a.w, Math.min(iy, fy + 1), spawn, must);
    b.stampSafe(b.pick(["crates", "drums", "solar-scrap", "tyres"]), a.x + b.int(0, Math.max(0, a.w - 2)), iy, spawn, must);
  }
  // 보도: 길 네 방향 둘레 한 줄을 판석으로(꺾인 곳까지 따라간다 — r6: 꺾인 길에 연석이 끊겼다)
  for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) {
    const i = b.idx(x, y); if (road[i] || b.taken[i] || !dirtTiles.has(b.map.lowerTiles[i] ?? -1)) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => b.inb(x + dx!, y + dy!) && road[b.idx(x + dx!, y + dy!)])) { b.setLower(x, y, slabAt(b, x, y)); b.slab[i] = true; }
  }
  // 둘째 줄 거처: 길가 줄 뒤(뒷마당 너머)에 판잣집·컨테이너 집·천막 한 줄씩 — 길에서 먼 땅이 텅 비었다(조수 시험·r6).
  const back = noRepeat(b.shuffle(["shack-c", "container-home", "tent-tarp", "lean-to", "shack-a", "shack-b", "container-home", "tent-tarp"]));
  const nFoot = top - 8;
  if (nFoot >= 5) rowOf(b, back, 2 + b.int(0, 4), Wd - 3, nFoot, spawn, must, [2, 4], areas, () => "뒷줄 거처");
  const sFoot = bot + 12;
  if (sFoot <= Hd - 2) rowOf(b, b.shuffle(back), 2 + b.int(0, 4), Wd - 3, sFoot, spawn, must, [2, 4], areas, () => "뒷줄 거처");
  // r9: 흩뿌린 판잣집까지 더해 같은 갈색 판잣집이 다섯 번 보였다 — 흩뿌리기엔 거처를 넣지 않는다.
  sprinkle(b, ["crates", "drums", "solar-scrap", "generator", "tyres"], 4, 2, 2, Wd - 3, Math.max(3, top - 9), spawn, must);
  sprinkle(b, ["crates", "drums", "solar-scrap", "tyres"], 3, 2, Math.min(Hd - 4, bot + 9), Wd - 3, Hd - 3, spawn, must);
  // 둘레 방벽(r9: 울·담이 없어 판잣집 촌과 같은 종류로 읽혔다): 뒷줄 거처 바깥 위·아래에 섞은 담 줄(담 판·바리케이드·고철 울·드럼),
  // 좌·우 끝은 길 위아래로 고물 벽 — 길이 지나는 두 끝이 문(검문)이다. 위·아래 담엔 뒷문 틈 하나씩.
  const ty = Math.max(1, nFoot - 4), by = Math.min(Hd - 2, sFoot + 2);
  // r11: 길 아래 띠 가운데가 빈 흙이었다 — 울 친 폐차장 하나.
  scrapLot(b, Math.floor(Wd * 0.25), bot + 4, Math.floor(Wd * 0.75), by - 2, spawn, must, areas);
  // r10: 위·아래 담이 같은 차례, 동·서 끝이 거울로 읽혔다 — 한 줄은 담 판 방벽, 다른 줄은 고철 울. 동·서는 한쪽 고물 벽·다른 쪽 세로 담 토막(길 위·아래 서로 바꿈).
  const wallTop = b.int(0, 1) === 0;
  mixedWallH(b, 1, Wd - 2, ty, b.int(6, Wd - 8), spawn, must, false, !wallTop);
  mixedWallH(b, 1, Wd - 2, by, b.int(6, Wd - 8), spawn, must, false, wallTop);
  // r11: 양 끝 세로 담이 같은 콘크리트 기둥 쌓기로 마주 서 «토템 거울»로 읽혔다 — 고물 벽은 한쪽 끝 한 토막만, 다른 끝은 트인 채 드럼·타이어 몇.
  const junkW = b.int(0, 1) === 0, upper = b.int(0, 1) === 0;
  junkColumn(b, junkW ? 1 : Wd - 2, upper ? ty + 2 : bot + 3, upper ? top - 3 : by - 2, spawn, must);
  sprinkle(b, ["drums", "tyres", "crates"], 2, junkW ? Wd - 5 : 1, ty + 2, junkW ? Wd - 2 : 4, by - 2, spawn, must);
  areas.push({ name: "정착지 방벽", x: 1, y: ty, w: Wd - 2, h: by - ty + 1, tag: "wall" });
  // 방벽 밖: 무너진 건물 한 채·고사목·폐차 몇
  sprinkle(b, ["husk-b", "dead-tree", "scrap-heap", "car-rust-h", "rubble-pile", "sign-blank"], Math.floor(Wd / 8), 1, 1, Wd - 2, Hd - 2, spawn, must);
  return { areas, spawn, road };
}

// ─────────────────────────────── ruined-city
function composeRuinedCity(b: Board): { areas: WlArea[]; spawn: Pt; road: boolean[] } {
  const { w: Wd, h: Hd } = b;
  const areas: WlArea[] = [];
  fillDirt(b);
  const road = new Array<boolean>(Wd * Hd).fill(false);
  // 길 짜임도 맵마다 다르게(r2: 두 맵이 같은 3×3 바둑판) — 가로 길 둘 위치를 크게 흔들고, 세로 길은 둘 또는 셋.
  const ys = [Math.floor(Hd * 0.3) + b.int(-3, 2), Math.floor(Hd * 0.7) + b.int(-2, 3)];
  const xs = b.int(0, 1) === 0
    ? [Math.floor(Wd * 0.2) + b.int(-1, 1), Math.floor(Wd * 0.5) + b.int(-1, 1), Math.floor(Wd * 0.8) + b.int(-1, 1)]
    : [Math.floor(Wd * 0.26) + b.int(-4, 3), Math.floor(Wd * 0.7) + b.int(-3, 4)];
  for (const y0 of ys) for (let y = y0; y < y0 + 3; y++) for (let x = 0; x < Wd; x++) road[b.idx(x, y)] = true;
  for (const x0 of xs) for (let y = 0; y < Hd; y++) for (let x = x0; x < x0 + 3; x++) road[b.idx(x, y)] = true;
  b.autotile("asphalt", road);
  const spawn = { x: 1, y: ys[0]! + 1 };
  const must: Pt[] = [{ x: Wd - 2, y: ys[0]! + 1 }, { x: Wd - 2, y: ys[1]! + 1 }, { x: xs[0]! + 1, y: 1 }, { x: xs[xs.length - 1]! + 1, y: Hd - 2 }];
  // 보도 1줄(길 네 방향 둘레)은 판석 보도로 깔고 비운다 — r5: 보도 없는 흙 블록이 «밭 구획»으로 읽혔다.
  for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) {
    if (road[b.idx(x, y)]) continue;
    const by = (b.inb(x, y + 1) && road[b.idx(x, y + 1)]) || (b.inb(x, y - 1) && road[b.idx(x, y - 1)]);
    const bx = (b.inb(x + 1, y) && road[b.idx(x + 1, y)]) || (b.inb(x - 1, y) && road[b.idx(x - 1, y)]);
    if (!by && !bx) continue;
    b.keep[b.idx(x, y)] = true;
    b.setLower(x, y, slabAt(b, x, y)); b.slab[b.idx(x, y)] = true;
  }
  // 블록: 도로로 나뉜 사각형들
  const bandsY = [[0, ys[0]! - 2], [ys[0]! + 4, ys[1]! - 2], [ys[1]! + 4, Hd - 1]] as const;
  const bandsX = [[0, xs[0]! - 1] as const, ...xs.slice(1).map((x, i) => [xs[i]! + 3, x - 1] as const), [xs[xs.length - 1]! + 3, Wd - 1] as const];
  let block = 0;
  // 블록마다 쓰임을 다르게: 빈 건물 줄·무너진 잔해 벌판·풀숲에 묻힌 터·생존자 야영·폐차장. 같은 블록이 바둑판으로 되풀이되지 않게.
  // r11: 아직 «흙 필지 격자 + 낮은 담»으로 읽혔다 — 건물 블록 비중을 올린다.
  const themes = b.shuffle(["buildings", "buildings", "collapsed", "buildings", "camp", "buildings", "overgrown", "buildings", "collapsed", "lot"] as const);
  for (const [y0, y1] of bandsY) for (const [x0, x1] of bandsX) {
    if (y1 - y0 < 3 || x1 - x0 < 4) continue;
    const theme = themes[block % themes.length]!;
    block++;
    const bw = x1 - x0, bh = y1 - y0;
    if (theme === "buildings" || theme === "collapsed") {
      // r8: 블록마다 작은 건물 한두 채 + 빈 흙이라 «도시»가 아니라 «빈 교외»로 읽혔고, 같은 껍데기가 블록마다 되풀이됐다.
      // 블록을 필지(가로 4~8 × 세로 3~5, 사이 1칸 골목)로 나눠 거의 다 채운다: 길가 필지 몇은 선 껍데기(그림마다 상한), 나머지는 무너진 건물 터
      // (판석 바닥 + 두세 변에 끊긴 담 + 안에 잔해). 무너진 블록은 선 건물 없이 터만.
      const lots: { x: number; y: number; w: number; h: number }[] = [];
      const split = (x: number, y: number, w: number, h: number, depth: number): void => {
        if (w < 4 || h < 3) return;
        const cutW = w >= 10 && (w >= h * 1.4 || h < 7), cutH = h >= 8;
        if (depth < 4 && (cutW || cutH) && b.int(0, 5) > 0) {
          // r11: 필지 사이 한 칸 흙 골목이 판석을 빗·ㄷ자로 잘라 «타일 시험판»으로 읽혔다 — 필지는 맞붙이고 경계는 담 줄이 가른다.
          if (cutW && (!cutH || b.int(0, 1) === 0)) { const k = b.int(4, w - 4); split(x, y, k, h, depth + 1); split(x + k, y, w - k, h, depth + 1); }
          else { const k = b.int(3, h - 3); split(x, y, w, k, depth + 1); split(x, y + k, w, h - k, depth + 1); }
          return;
        }
        lots.push({ x, y, w, h });
      };
      // r10: 필지(세로 3~5)에는 여러 층 껍데기(6~8줄)가 들어가지 못해 «낮은 담만 남은 교외»였다 — 건물 블록은 먼저 길가(아랫변)에
      // 선 껍데기 줄을 세우고(그림마다 상한), 그 뒤 남은 땅만 필지로 나눈다.
      let lotY1 = y1 - 1;
      if (theme === "buildings") {
        const ids = b.shuffle(HUSKS.slice()).filter((id) => b.kit(id) && b.countOf(id) < (CAPS[id] ?? 9));
        const tallFirst = [...ids.filter((id) => (b.kitSize(id)?.h ?? 0) >= 6), ...ids.filter((id) => (b.kitSize(id)?.h ?? 0) < 6)];
        const row = rowOf(b, tallFirst.slice(0, 3), x0 + 1 + b.int(0, 1), x1 - 1, y1 - 1, spawn, must, [1, 2], areas, () => `무너진 건물 ${block}`);
        for (const p of row) { const d = b.door(p.id, p.x, p.y); if (b.inb(d.x, d.y + 1)) b.markKeep(d.x, d.y + 1); }
        if (row.length) lotY1 = Math.min(...row.map((p) => p.y)) - 2;
      }
      if (lotY1 - y0 >= 3) split(x0 + 1, y0 + 1, bw - 1, lotY1 - y0, 0);
      let standing = theme === "buildings" ? 99 : 0;
      for (const lot of b.shuffle(lots)) {
        const front = lot.y + lot.h >= y1 - 1;
        if (theme === "buildings" && front && standing < HUSKS.filter((id) => b.kit(id)).length - 1) {
          const ids = b.shuffle(HUSKS.slice()).filter((id) => b.kit(id) && b.countOf(id) < (CAPS[id] ?? 9));
          const got = rowOf(b, ids.slice(0, 1), lot.x, lot.x + lot.w - 1, lot.y + lot.h - 1, spawn, must, [0, 1], areas, () => `무너진 건물 ${block}`);
          for (const p of got) { const d = b.door(p.id, p.x, p.y); if (b.inb(d.x, d.y + 1)) b.markKeep(d.x, d.y + 1); }
          if (got.length) { standing++; continue; }
        }
        if (b.int(0, 6) === 0) { sprinkle(b, ["rubble-pile", "scrap-heap", "bush-wild"], 2, lot.x, lot.y, lot.x + lot.w - 1, lot.y + lot.h - 1, spawn, must); continue; }
        if (!b.free(lot.x, lot.y, lot.w, lot.h)) continue;
        fillSlab(b, lot.x, lot.y, lot.w, lot.h);
        // 남은 담: 윗변은 가로 담(틈 하나), 좌·우 중 한 변은 세로 담 — 변마다 끊김이 달라 같은 터가 되풀이되지 않는다.
        mixedWallH(b, lot.x, lot.x + lot.w - 1, lot.y + 1, lot.x + b.int(1, Math.max(1, lot.w - 2)), spawn, must, true);
        if (lot.h >= 4 && b.int(0, 2) > 0) wallRunV(b, b.int(0, 1) ? lot.x : lot.x + lot.w - 1, lot.y + 2, lot.y + lot.h - 1, spawn, must);
        if (b.int(0, 1)) sprinkle(b, ["rubble-pile", "scrap-heap", "tyres"], 1, lot.x + 1, lot.y + 2, lot.x + lot.w - 2, lot.y + lot.h - 1, spawn, must);
      }
      areas.push({ name: theme === "buildings" ? `무너진 시가 ${block}` : `잔해 벌판 ${block}`, x: x0, y: y0, w: bw, h: bh, tag: theme === "buildings" ? "ruins" : "rubble" });
      // 담쟁이는 선 건물 옆구리에만
      for (const a of areas.filter((a) => a.name === `무너진 건물 ${block}`)) { const v = b.kitSize("vine-wall"); if (!v || b.int(0, 2) === 0) continue;
        b.stampSafe("vine-wall", b.int(0, 1) ? a.x - 1 : a.x + a.w, a.y + a.h - v.h, spawn, must); }
    } else if (theme === "overgrown") {
      const one = rowOf(b, ["husk-a"], x0 + b.int(1, Math.max(1, bw - 7)), x1 - 1, y1, spawn, must, [1, 2], areas, () => `풀숲 속 건물 ${block}`);
      for (const p of one) { const d = b.door(p.id, p.x, p.y); if (b.inb(d.x, d.y + 1)) b.markKeep(d.x, d.y + 1); }
      for (const p of one) { const z = b.kitSize(p.id); if (z) { b.stampSafe("vine-wall", p.x - 1, p.y + z.h - 2, spawn, must); b.stampSafe("vine-wall", p.x + z.w, p.y + z.h - 2, spawn, must); } }
      sprinkle(b, ["dead-tree", "bush-wild", "bush-wild", "dead-tree", "bush-wild"], Math.max(5, Math.floor(bw * bh / 16)), x0, y0, x1, y1, spawn, must);
      areas.push({ name: `풀숲에 묻힌 터 ${block}`, x: x0, y: y0, w: bw, h: bh, tag: "overgrown" });
    } else if (theme === "camp") {
      const cx = x0 + Math.floor(bw / 2), cy = y0 + Math.floor(bh / 2);
      b.stampSafe("campfire", cx, cy, spawn, must);
      b.stampSafe("log-seat", cx - 2, cy + 1, spawn, must); b.stampSafe("log-seat", cx + 1, cy + 1, spawn, must);
      rowOf(b, b.shuffle(["shack-a", "lean-to", "shack-b"]).slice(0, 2), x0 + 1, x1 - 1, Math.max(y0 + 4, cy - 2), spawn, must, [1, 3], areas, () => `폐허 속 야영 ${block}`);
      sprinkle(b, ["drums", "crates", "tyres", "barricade-h", "jersey-barrier"], Math.max(3, Math.floor(bw * bh / 35)), x0, y0, x1, y1, spawn, must);
      areas.push({ name: `생존자 야영지 ${block}`, x: x0, y: y0, w: bw, h: bh, tag: "camp", door: { x: cx, y: cy + 2 } });
    } else {
      // r11: 블록 전체 판석 위 폐차는 «주차장 판»과 32px 되풀이 줄눈으로 읽혔다 — 울 친 폐차장(흙 바닥)으로.
      scrapLot(b, x0 + 1, y0 + 1, x1 - 1, y1 - 1, spawn, must, areas);
    }
  }
  areas.push({ name: "폐허 시가", x: 0, y: 0, w: Wd, h: Hd, tag: "ruined-city" });
  const lanes = [
    ...ys.map((y0) => ({ x0: 1, y0, x1: Wd - 2, y1: y0 + 2, horizontal: true })),
    ...xs.map((x0) => ({ x0, y0: 1, x1: x0 + 2, y1: Hd - 2, horizontal: false })),
  ];
  wrecksOnRoad(b, lanes, b.int(8, 11), spawn, must, { h: ["car-rust-h", "car-rust-h", "scrap-heap", "van-rust", "van-rust", "jersey-barrier"], v: ["car-rust-v", "car-rust-v"] });
  // 교차로 한두 곳에 차 더미(차·고철·잔해가 엉킨 사고 자리) — r5: 길이 깨끗해 «좀비 도시»로 안 읽혔다. 통행은 stampSafe 가 남긴다.
  for (const [ix, iy] of b.shuffle(xs.flatMap((x0) => ys.map((y0) => [x0, y0] as const))).slice(0, b.int(1, 2))) {
    for (const [id, dx, dy] of b.shuffle([["car-rust-h", -3, -1], ["scrap-heap", 2, 0], ["rubble-pile", 0, 2], ["tyres", 3, 2], ["van-rust", -4, 1]] as const)) b.stampSafe(id, ix + dx, iy + dy, spawn, must);
    areas.push({ name: "사고 난 교차로", x: ix - 4, y: iy - 1, w: 9, h: 5, tag: "wreck-pileup" });
  }
  // 좀비 도시 표지(r3: «좀비 도시라고 말해 주는 것이 없다»): 세로 길 한두 곳을 바리케이드·분리대로 막은 생존자 저지선(한 칸은 비워 지나간다).
  for (const x0 of b.shuffle(xs).slice(0, b.int(1, 2))) {
    const segs = [[2, ys[0]! - 3], [ys[0]! + 4, ys[1]! - 3], [ys[1]! + 4, Hd - 3]].filter(([a, c]) => c! - a! >= 3);
    if (!segs.length) continue;
    let done = false;
    for (let t = 0; t < 12 && !done; t++) {
      const [a, c] = segs[b.int(0, segs.length - 1)]!;
      const y = a! + b.int(0, Math.max(0, c! - a! - 2));
      for (const bx of b.shuffle([x0 - 1, x0 + 1])) {
        if (!b.stampSafe("barricade-h", bx, y, spawn, must)) continue;
        b.stampSafe("jersey-barrier", bx === x0 - 1 ? x0 - 2 : x0 + 2, y + 2, spawn, must) || b.stampSafe("drums", bx === x0 - 1 ? x0 - 2 : x0 + 4, y, spawn, must);
        areas.push({ name: "생존자 저지선", x: bx, y, w: 3, h: 2, tag: "barricade" }); done = true; break;
      }
    }
  }
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
  // 옛 도로는 맵 한쪽 가장자리(북·남 번갈아) — 판잣집 촌은 도로에서 떨어진 빈 땅에 덩이로 모여 산다(정착지의 길가 장터와 다르게, r4).
  const north = b.int(0, 1) === 0;
  const ry = north ? 1 + b.int(0, 1) : Hd - 4 - b.int(0, 1);
  for (let xx = 0; xx < Wd; xx++) for (let y = ry; y < ry + 3; y++) road[b.idx(xx, y)] = true;
  b.autotile("asphalt", road);
  const spawn = { x: 1, y: ry + 1 };
  const must: Pt[] = [{ x: Wd - 2, y: ry + 1 }];
  b.markKeep(0, north ? ry + 3 : ry - 1, Wd, 1);
  const top = north ? ry + 5 : 2, bot = north ? Hd - 2 : ry - 3;
  // 덩이(빽빽한 판잣집 무리) 4~6 개: 덩이마다 앞줄·뒷줄 두 줄을 0~1칸 사이로 붙여 세우고, 두 줄 사이 1칸 골목, 덩이 마당엔 드럼통·모닥불.
  // 덩이 사이는 2~3칸 흙길(비움). 새 거처(shack-c·container-home·tent-tarp)가 있으면 섞인다.
  // r12: 판잣집 여섯 종만 돌려 써 두 맵이 같은 집 묶음으로 읽혔다 — 함석 오두막·문 짝 차양·2층 판잣집·난로 오두막을 더한다(장터 차양은 장터에).
  const shelters = ["shack-a", "shack-b", "lean-to", "shack-c", "container-home", "tent-tarp", "hut-sheet", "lean-doors", "shack-2f", "hut-stove"].filter((id) => b.kit(id));
  const cols = Wd < 44 ? (b.int(0, 2) === 0 ? 3 : 2) : 3, rows = 2, nC = cols * rows;
  const cw = Math.floor((Wd - 4) / cols), ch = Math.floor((bot - top + 1) / rows);
  // 장터 자리: 덩이 격자 한 칸을 비워 장터로
  const marketCell = b.int(0, nC - 1);
  let market: Pt | null = null;
  for (let c = 0; c < nC; c++) {
    const gx = c % cols, gy = Math.floor(c / cols);
    const x0 = 2 + gx * cw + b.int(0, 1), x1 = 2 + (gx + 1) * cw - 2 - b.int(0, 1);
    const y0 = top + gy * ch, y1 = top + (gy + 1) * ch - 2;
    if (x1 - x0 < 5 || y1 - y0 < 5) continue;
    if (c === marketCell) { market = { x: Math.floor((x0 + x1) / 2) - 3, y: Math.floor((y0 + y1) / 2) - 2 }; continue; }
    // r8: 덩이 안 무작위 채움이 «빈 흙에 흩어진 집»으로 읽혔다(골목·덩이가 없다) — 덩이마다 뒷줄·앞줄 두 줄을 0~1칸 사이로 붙여 세우고
    // 두 줄 사이 1~2칸이 골목이 되게 한다. 덩이마다 주된 거처 둘을 정해 그쪽을 많이 쓴다(같은 그림은 12칸 안에 다시 못 선다).
    const lead = b.shuffle(shelters.slice()).slice(0, 2);
    // 거처 사이사이에 살림 더미(드럼·상자·타이어·고철·태양판·노점)를 끼워 줄이 빽빽한 판자촌 골목으로 읽히게 한다 — 거처 그림은 맵당 몇 장뿐이라(상한·12칸 간격) 거처만으로는 줄이 성겼다.
    const FILL = ["drums", "crates", "tyres", "scrap-heap", "solar-scrap", "stall-a", "stall-b", "lean-to", "generator", "wash-line", "crates-plastic"];
    // r9: 같은 상자 넷이 한 줄에 고른 간격으로 섰다 — 줄마다 살림 더미는 섞은 목록을 돌려 쓰고(같은 것 연달아 금지) 줄당 같은 것 한 번.
    const pickRow = () => { const dw = noRepeat(Array.from({ length: 4 }, () => (b.int(0, 3) > 0 ? b.pick(lead) : b.pick(shelters))).concat(b.shuffle(shelters.slice())));
      const fill = b.shuffle(FILL.slice()); let f = 0;
      const out: string[] = []; for (const d of dw) { out.push(d); if (f < fill.length) out.push(fill[f++]!); if (b.int(0, 2) === 0 && f < fill.length) out.push(fill[f++]!); } return out; };
    const backFootY = Math.min(y1 - 4, y0 + 3), frontFootY = Math.min(y1, backFootY + 4 + b.int(0, 1));
    const dwell = (id: string) => (shelters.includes(id) ? "판잣집" : "");
    // r11: 줄이 «선반»처럼 한 발 줄에 서서 정착지 길가 줄과 같았다 — 발 줄을 ±1 흔들고 사이 0칸으로 붙여 빽빽한 덩이로.
    const rows = [rowOf(b, pickRow(), x0 + b.int(0, 1), x1, backFootY, spawn, must, [0, 1], areas, dwell, 1),
      rowOf(b, pickRow(), x0 + b.int(0, 2), x1, frontFootY, spawn, must, [0, 1], areas, dwell, 1)];
    for (const p of rows.flat().filter((p) => shelters.includes(p.id))) { const d = b.door(p.id, p.x, p.y); if (b.inb(d.x, d.y + 1)) { b.markKeep(d.x, d.y + 1); must.push({ x: d.x, y: d.y + 1 }); } }
    // r9: 줄 둘만으로는 «빈 흙에 늘어선 집»이었다 — 덩이 뒤를 고철 울·담으로 막고 좌우 끝에 고물 기둥을 세워 골목 하나가 열린 «울 친 판자 덩이»로.
    // r11: 덩이 뒤 담 판·벙커 줄과 고물 기둥이 정착지 방벽과 같은 조각이라 두 종류가 하나로 읽혔다 — 판자촌은 담을 치지 않는다.
    // 대신 덩이 뒤에 방수포 천막·차양·판잣집 셋째 줄을 한 줄 더 반쯤 붙여 덩이를 더 두껍게(골목 하나).
    if (rows.flat().length >= 3 && backFootY - 4 >= top + 1)
      rowOf(b, noRepeat(b.shuffle(["tent-tarp", "lean-to", "shack-c", "crates", "drums", "hut-sheet", "hut-stove", "wash-line"].filter((id) => b.kit(id)))), x0 + b.int(1, 3), x1 - b.int(0, 3), backFootY - 4, spawn, must, [0, 1], areas, dwell, 1);
    const backFoot = backFootY;
    // 덩이 살림: 골목 끝 드럼통·상자, 덩이 앞 모닥불이나 발전기
    sprinkle(b, b.shuffle(["drums", "crates", "tyres", "solar-scrap", "generator", "scrap-heap", "lean-to"]).slice(0, 4), b.int(3, 5), x0, y0, x1, y1, spawn, must);
    if (b.int(0, 2) === 0) b.stampSafe("campfire", Math.floor((x0 + x1) / 2), backFoot + 1, spawn, must);
    areas.push({ name: "판잣집 덩이", x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, tag: "shanty-cluster" });
    // (r6: 덩이 뒤 고철 울 토막은 아무것도 두르지 않은 외톨이 울로 읽혀 뺐다)
  }
  if (market) {
    // r7: 두 seed 의 장터가 급수탑·노점·모닥불 한 도장이었다 — 판 크기·차림을 셋 중 하나로.
    const mw = b.int(6, 8), mh = b.int(4, 6), mx = market.x + b.int(-1, 1), my = market.y + b.int(-1, 0);
    fillSlab(b, mx, my, mw, mh);
    const style = (b.seed + b.int(0, 2)) % 3;
    const at = (id: string, dx: number, dy: number) => b.stampSafe(id, mx + dx, my + dy, spawn, must);
    let name = "고물 장터";
    if (style === 0) { at("water-tank", 0, 0) || at("water-tank", mw - 3, 0); at("market-shelter", mw - 3, mh - 2) || at("stall-a", mw - 3, mh - 2) || at("stall-a", 3, 1); at("campfire", 1, mh - 2); at("log-seat", 2, mh - 1); }
    else if (style === 1) { name = "발전 마당"; at("solar-scrap", 0, 0); at("generator", 3, 0) || at("generator", mw - 2, 1); at("drums", mw - 1, mh - 2); at("stall-b", 1, mh - 2) || at("stall-b", 2, 2); }
    else { name = "고철 거래터"; at("market-shelter", 0, 1) || at("stall-a", 0, 1) || at("stall-a", 1, 2); at("crates", mw - 2, 0); at("tyres", mw - 1, mh - 2); at("scrap-heap", 3, mh - 2) || at("scrap-heap", 4, 0); at("campfire", mw - 3, 2); }
    areas.push({ name, x: mx, y: my, w: mw, h: mh, tag: "market", door: { x: mx + Math.floor(mw / 2), y: my + mh } });
    must.push({ x: mx + Math.floor(mw / 2), y: my + mh });
  }
  areas.push({ name: "판잣집 촌", x: 1, y: top, w: Wd - 2, h: bot - top + 1, tag: "shanty" });
  // 덩이 사이 빈 땅: 고철 더미·타이어·고사목 몇(길은 비운 채)
  sprinkle(b, ["scrap-heap", "rubble-pile", "car-rust-h", "dead-tree", "bush-wild", "sign-blank"], Math.floor(Wd / 7), 0, top, Wd - 1, bot, spawn, must);
  wrecksOnRoad(b, [{ x0: 1, y0: ry, x1: Wd - 2, y1: ry + 2, horizontal: true }], b.int(1, 3), spawn, must, { h: b.shuffle(["van-rust", "car-rust-h", "scrap-heap", "tyres", "drums"]).slice(0, 3), v: [] });
  return { areas, spawn, road };
}

/** 맵 한 장을 짠다. 땅·2층·3층을 덮어쓴다(이벤트는 건드리지 않는다). tileset 은 번들 wasteland_ruins 사본. */
export function composeWastelandMap(map: GameMap, tileset: TilesetDef, kind: WastelandKind, seed: number): WlComposeResult {
  const b = new Board(map, tileset, seed + (kind === "settlement" ? 0 : kind === "ruined-city" ? 7919 : 15887));
  for (let i = 0; i < map.width * map.height; i++) { setLayerTileAt(map, 2, i, -1); setLayerTileAt(map, 3, i, -1); setLayerTileAt(map, 4, i, -1); }
  const out = kind === "settlement" ? ((seed & 1) === 0 ? composeRoadsideSettlement(b) : composeSettlement(b)) : kind === "ruined-city" ? composeRuinedCity(b) : composeShanty(b);
  finishSlab(b);
  scatterDecals(b, kind === "ruined-city" ? 0.09 : kind === "settlement" ? 0.045 : 0.045, out.road);
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
