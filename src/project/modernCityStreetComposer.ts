// project/modernCityStreetComposer.ts
// 도쿄풍 도시(modern_city) 거리 구성기 — 맵 크기·씨앗만 주면 매번 다른 거리 블록을 짠다(campusComposer·jpCityStreetComposer 와 같은 순서).
//
// 계획(가로 도로 1~2줄 · 세로 도로 1~2줄, 6칸 차도 + 양쪽 연석·보도 2줄 = 12줄 단면, 만나는 곳은 12×12 교차로 키트)
//   → 건물(띠마다 가로 도로 북쪽 보도를 «문 앞 접근칸 줄»로 삼아 건물 키트를 남향으로 세운다)
//   → 공원 블록 하나(잔디·벽돌 길·분수·벤치·공원 등·나무)
//   → 소품(남쪽 보도 = 가로수·가로등 번갈아, 북쪽 보도 = 문 앞을 피한 소화전·볼라드·쓰레기통, 세로 도로 보도 = 가로등, 교차로 모서리 = 신호등)
//   → 차(가로 도로 차선마다 정차 0~2대, 교차로 2칸 안 금지).
// 조화 규칙: 건물은 키트째(문 = 키트 맨 아랫줄의 access 칸 위), 문 앞 접근칸 줄(가로 도로 첫 보도 줄)은 문 기둥 ±1칸에 아무것도 두지 않는다.
//   소품·나무의 ★(통행 가능 윗줄) 칸도 건물·다른 소품 칸과 겹치지 않는다. 같은 건물 종류는 한 맵에 둘까지, 이웃끼리 같은 종류 금지.
// 순수 함수다(프로젝트를 모른다). 칸 번호는 호출자가 준 사전(palette)에서 — 도구는 번들 정의에서 만든다(modernCityPaletteFromTileset).

import type { MapTransit } from "./mapTransit";
import { autoTrafficRoutes, DEFAULT_MODERN_CAR_MIX, type RoadBand, type StopAnchor } from "./transitAuto";

export interface MCKit {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly rows: readonly { readonly tiles: readonly number[]; readonly upperTiles?: readonly number[] }[];
  /** 건물 문 앞 접근칸(키트 기준, dy = height). */
  readonly access?: readonly { readonly dx: number; readonly dy: number }[];
}
export interface MCPalette {
  /** 바닥 묶음(mc:sidewalk·mc:green·mc:plaza …)의 칸 번호들. 없으면 빈 배열. */
  group(id: string): readonly number[];
  kit(id: string): MCKit | undefined;
  /** 건물 키트 id 전체(mc-bld-*). */
  buildingKits(): readonly string[];
}

export interface MCCell { readonly x: number; readonly y: number }
export interface MCBuilding {
  readonly name: string;
  readonly kind: string;
  readonly kit: string;
  readonly rect: { x: number; y: number; w: number; h: number };
  /** 막힌 문 칸(키트 맨 아랫줄). */
  readonly doors: MCCell[];
  /** 문 바로 아래 접근칸(보도). */
  readonly access: MCCell[];
  /** 이 건물에 맞는 실내 방 구성(build_hand_interior_room layout.program) — 없으면 실내 예제 없음. */
  readonly program?: string;
}
export interface MCStreetSpec { readonly width: number; readonly height: number; readonly seed?: number; readonly shops?: readonly string[] }
export interface MCStreetResult {
  readonly lower: number[];
  readonly upper: number[];
  readonly upper2: number[];
  readonly buildings: MCBuilding[];
  readonly start: MCCell;
  readonly props: { kit: string; x: number; y: number }[];
  readonly roads: { horizontal: number[]; vertical: number[] };
  readonly park: { x: number; y: number; w: number; h: number } | null;
  readonly notes: string[];
  readonly transit: MapTransit;
}

export const MODERN_CITY_STREET_MIN = { w: 40, h: 30 } as const;
export const MODERN_CITY_STREET_MAX = { w: 120, h: 100 } as const;

/** 건물 종류(키트 id 의 mc-bld-<종류>-…) → 이름 · 실내 방 구성. */
export const MC_BUILDING_TYPES: Readonly<Record<string, { ko: string; program?: string; weight: number }>> = {
  conv: { ko: "편의점", program: "konbini", weight: 3 }, cafe: { ko: "카페", program: "cafe", weight: 2 }, bank: { ko: "은행", program: "bank", weight: 2 },
  hospital: { ko: "병원", program: "hospital-ward", weight: 2 }, office: { ko: "사무소", program: "office-floor", weight: 2 }, "office-wide": { ko: "대형 오피스", program: "office-floor", weight: 2 },
  mid4: { ko: "4층 사무·상가", program: "office-floor", weight: 2 }, mid6: { ko: "6층 빌딩", program: "lobby", weight: 2 }, tower10: { ko: "오피스 타워", program: "lobby", weight: 1 },
  hotel: { ko: "호텔", program: "lobby", weight: 1 }, dept: { ko: "백화점", program: "lobby", weight: 1 },
  apartment: { ko: "아파트", program: "apartment", weight: 2 }, "apt-balcony": { ko: "발코니 아파트", program: "apartment", weight: 1 }, tower10b: { ko: "주거 타워", program: "apartment", weight: 1 },
  "fire-escape": { ko: "비상계단 아파트", program: "apartment", weight: 1 }, balcony2: { ko: "발코니 아파트", program: "apartment", weight: 1 }, low3: { ko: "3층 상가주택", program: "apartment", weight: 2 },
  house: { ko: "단독주택", program: "apartment", weight: 1 }, "house-modern": { ko: "주택", program: "apartment", weight: 1 }, row: { ko: "연립주택", program: "apartment", weight: 1 },
  warehouse: { ko: "창고", program: "warehouse", weight: 1 },
  shop: { ko: "상점", weight: 2 }, izakaya: { ko: "이자카야", weight: 2 }, bakery: { ko: "빵집", weight: 1 }, slim: { ko: "슬림 빌딩", weight: 1 }, post: { ko: "우체국", weight: 1 },
  police: { ko: "경찰서", weight: 1 }, fire: { ko: "소방서", weight: 1 }, parking: { ko: "주차 건물", weight: 1 }, "parking-v2": { ko: "주차 건물", weight: 1 },
};
/** 거리마다 하나씩은 넣는 종류(씨앗이 순서를 섞는다) — 실내 예제가 있는 건물. */
const MUST: readonly string[][] = [["conv"], ["office", "office-wide", "mid4"], ["hospital"], ["cafe"], ["bank"], ["apartment", "apt-balcony", "balcony2", "low3"], ["mid6", "hotel", "dept"]];

function mulberry(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function pick<T>(r: () => number, xs: readonly T[]): T { return xs[Math.floor(r() * xs.length)]!; }
function shuffle<T>(r: () => number, xs: T[]): T[] { for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [xs[i], xs[j]] = [xs[j]!, xs[i]!]; } return xs; }
export function mcBuildingType(kitId: string): string { return kitId.replace(/^mc-bld-/, "").replace(/-roof$/, "").replace(/-[A-C]$/, ""); }

type Use = "ground" | "road" | "walk" | "front" | "bld" | "prop" | "park" | "veh";

/** 칸 해시 0..1(씨앗 무관 — 같은 칸은 같은 잔디). */
function cellHash(x: number, y: number, k = 0): number { let h = Math.imul(x * 374761393 + y * 668265263 + k * 2147483647, 1274126177); h ^= h >>> 13; h = Math.imul(h, 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
/** 잔디 칸: mc:lawn(2026-10-14, 바탕 4 · 풀 덩이 2 · 꽃 2)이 있으면 섞어 칠하고, 옛 정의면 mc:green 두 칸. */
function lawnTile(pal: MCPalette, x: number, y: number): number {
  const lawn = pal.group("mc:lawn");
  if (lawn.length >= 8) {
    const j = cellHash(x, y);
    return lawn[j < 0.9 ? Math.floor(cellHash(x, y, 1) * 4) : j < 0.97 ? 4 + Math.floor(cellHash(x, y, 2) * 2) : 6 + Math.floor(cellHash(x, y, 3) * 2)]!;
  }
  const green = pal.group("mc:green");
  return green[(x * 7 + y * 3) % Math.min(2, green.length)]!;
}
/** 큰 가로수(잎 덩이 수관 3×4) — 없으면 옛 2×3 가로수. */
const BIG_STREET_TREES = ["mc-prop-keyaki-a", "mc-prop-keyaki-b", "mc-prop-ginkgo-big-a"] as const;

class Board {
  readonly lower: number[]; readonly upper: number[]; readonly upper2: number[]; readonly use: Use[]; readonly keep: boolean[];
  readonly buildings: MCBuilding[] = []; readonly props: { kit: string; x: number; y: number }[] = []; readonly notes: string[] = [];
  constructor(readonly W: number, readonly H: number, readonly pal: MCPalette) {
    const walk = pal.group("mc:sidewalk")[0];
    if (walk === undefined) throw new Error("modern_city 칩셋에 보도(mc:sidewalk) 칸이 없다");
    this.lower = new Array(W * H).fill(walk); this.upper = new Array(W * H).fill(-1); this.upper2 = new Array(W * H).fill(-1);
    this.use = new Array(W * H).fill("ground"); this.keep = new Array(W * H).fill(false);
  }
  in(x: number, y: number) { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
  k(x: number, y: number) { return y * this.W + x; }
  kit(id: string): MCKit { const k = this.pal.kit(id); if (!k) throw new Error(`modern_city 칩셋에 키트 ${id} 가 없다`); return k; }
  /** 땅 키트(도로 단면·교차로) — 아래층만. */
  ground(id: string, x: number, y: number, use: Use) {
    const kit = this.kit(id);
    kit.rows.forEach((row, r) => row.tiles.forEach((t, c) => {
      const X = x + c, Y = y + r; if (!this.in(X, Y) || t < 0) return;
      const i = this.k(X, Y); this.lower[i] = t; if (this.use[i] === "ground" || this.use[i] === "walk" || this.use[i] === "road") this.use[i] = this.useOfGround(t, use);
    }));
  }
  useOfGround(t: number, fallback: Use): Use { return this.pal.group("mc:sidewalk").includes(t) ? "walk" : fallback; }
  /** 위층 키트가 놓일 수 있나 — 그림 칸(아래·위층 어느 쪽이든)이 전부 맵 안 · 건물/소품/차/예약 칸 아님 · 발밑 칸은 allow 용도. */
  fits(id: string, x: number, y: number, allow: readonly Use[], margin = 0): boolean {
    const kit = this.pal.kit(id); if (!kit) return false;
    for (let r = 0; r < kit.height; r++) for (let c = 0; c < kit.width; c++) {
      const up = kit.rows[r]?.upperTiles?.[c] ?? -1, lo = kit.rows[r]?.tiles[c] ?? -1;
      if (up < 0 && lo < 0) continue;
      const X = x + c, Y = y + r; if (!this.in(X, Y)) return false;
      const i = this.k(X, Y);
      if (this.upper[i] >= 0 || this.keep[i] || ["bld", "prop", "veh"].includes(this.use[i]!)) return false;
      if (!allow.includes(this.use[i]!)) return false;
    }
    if (margin > 0) for (let Y = y - margin; Y < y + kit.height + margin; Y++) for (let X = x - margin; X < x + kit.width + margin; X++) {
      if (!this.in(X, Y) || (X >= x && X < x + kit.width && Y >= y && Y < y + kit.height)) continue;
      const u = this.use[this.k(X, Y)]; if (u === "prop" || u === "veh") return false;
    }
    return true;
  }
  stamp(id: string, x: number, y: number, use: Use) {
    const kit = this.kit(id);
    kit.rows.forEach((row, r) => {
      for (let c = 0; c < kit.width; c++) {
        const X = x + c, Y = y + r; if (!this.in(X, Y)) continue;
        const i = this.k(X, Y), lo = row.tiles[c] ?? -1, up = row.upperTiles?.[c] ?? -1;
        if (lo >= 0) this.lower[i] = lo;
        if (up >= 0) { if (this.upper[i] >= 0) this.upper2[i] = up; else this.upper[i] = up; this.use[i] = use; }
      }
    });
    return kit;
  }
  prop(id: string, x: number, y: number, allow: readonly Use[] = ["walk", "ground"], margin = 0): boolean {
    if (!this.fits(id, x, y, allow, margin)) return false;
    this.stamp(id, x, y, "prop"); this.props.push({ kit: id, x, y }); return true;
  }
}

/** 띠 한 칸(가로 도로 북쪽) 정면 건물 줄. */
function frontage(b: Board, r: () => number, x0: number, x1: number, accessY: number, maxH: number, counts: Map<string, number>, queue: string[][], wishes: string[]) {
  const all = b.pal.buildingKits();
  const byType = new Map<string, string[]>();
  for (const id of all) { const t = mcBuildingType(id); if (!MC_BUILDING_TYPES[t]) continue; (byType.get(t) ?? byType.set(t, []).get(t)!).push(id); }
  let x = x0 + (r() < 0.5 ? 0 : 1), prev = "";
  const fitsKit = (id: string, at: number) => { const k = b.kit(id); return k.height <= maxH && at + k.width - 1 <= x1 && b.fits(id, at, accessY - k.height, ["walk", "ground"]); };
  while (x <= x1 - 3) {
    const room = x1 - x + 1;
    const candTypes = (types: readonly string[]) => types.filter((t) => t !== prev && (counts.get(t) ?? 0) < 2 && (byType.get(t) ?? []).some((id) => fitsKit(id, x)));
    let type: string | undefined;
    // 사용자가 고른 가게 → 반드시 넣을 종류 → 무게 뽑기
    for (let i = 0; i < wishes.length && !type; i++) { const c = candTypes([wishes[i]!]); if (c.length) { type = c[0]; wishes.splice(i, 1); } }
    for (let i = 0; i < queue.length && !type; i++) { const c = candTypes(queue[i]!); if (c.length) { type = pick(r, c); queue.splice(i, 1); } }
    if (!type) {
      const c = candTypes([...byType.keys()]);
      if (!c.length) { if (room >= 4) b.notes.push(`(${x}..${x1},${accessY - 1}) 에 맞는 건물이 없어 비웠다`); break; }
      // 띠 높이에 가까운 건물을 더 자주(건물 뒤 빈 잔디 띠가 넓어지지 않게 — 거리 QA C1)
      const hOf = (t: string) => Math.max(...(byType.get(t) ?? []).filter((id) => fitsKit(id, x)).map((id) => b.kit(id).height));
      const wt = (t: string) => MC_BUILDING_TYPES[t]!.weight * (0.25 + 1.5 * (hOf(t) / maxH) ** 2);
      const total = c.reduce((s, t) => s + wt(t), 0); let w = r() * total;
      type = c.find((t) => (w -= wt(t)) < 0) ?? c[0]!;
    }
    const ids = (byType.get(type) ?? []).filter((id) => fitsKit(id, x));
    const tallest = Math.max(...ids.map((i) => b.kit(i).height));
    const id = pick(r, ids.filter((i) => b.kit(i).height === tallest)); const kit = b.kit(id);
    const y = accessY - kit.height;
    b.stamp(id, x, y, "bld");
    const acc = (kit.access?.length ? kit.access : [{ dx: Math.floor(kit.width / 2), dy: kit.height }]).filter((a, i, all) => all.findIndex((o) => o.dx === a.dx) === i);
    const access = acc.map((a) => ({ x: x + a.dx, y: y + a.dy }));
    const doors = access.map((a) => ({ x: a.x, y: a.y - 1 }));
    for (const a of access) for (const dx of [-1, 0, 1]) for (const dy of [0, 1]) if (b.in(a.x + dx, a.y + dy)) b.keep[b.k(a.x + dx, a.y + dy)] = true;
    const info = MC_BUILDING_TYPES[type]!;
    b.buildings.push({ name: info.ko, kind: type, kit: id, rect: { x, y, w: kit.width, h: kit.height }, doors, access, ...(info.program ? { program: info.program } : {}) });
    counts.set(type, (counts.get(type) ?? 0) + 1); prev = type;
    x += kit.width + (r() < 0.45 ? 0 : r() < 0.7 ? 1 : 2);
  }
  // 건물 뒤(북쪽) 빈 띠 — 잔디 + 관목·침엽수 덩이(빈 포석 마당 방지)
  const green = b.pal.group("mc:green");
  for (let X = x0; X <= x1; X++) {
    let top = accessY - 1; while (top >= 0 && b.use[b.k(X, top)] === "bld") top--;
    for (let Y = top; Y >= accessY - maxH && Y >= 0; Y--) { const i = b.k(X, Y); if (b.use[i] !== "ground" && b.use[i] !== "walk") break; if (Y < accessY - 1 && green.length) { b.lower[i] = lawnTile(b.pal, X, Y); b.use[i] = "park"; } }
  }
  // 잎 덩이 큰 나무(있으면)는 한 열에 위아래 둘까지 — 건물 뒤 녹지가 빈 잔디 판으로 남지 않게(버들항처럼 나무 덩이로 채운다).
  const bigOk = !!b.pal.kit("mc-prop-keyaki-a");
  for (let X = x0; X <= x1 - 1; X += (bigOk ? 2 : 3) + Math.floor(r() * 3)) {
    let placed = 0;
    for (let Y = accessY - 2; Y >= Math.max(1, accessY - maxH) && placed < (bigOk ? 2 : 1); Y--) {
      let id = r() < (bigOk ? 0.6 : 0.5) ? pick(r, bigOk ? ["mc-prop-keyaki-a", "mc-prop-keyaki-b", "mc-prop-keyaki-a", "mc-prop-conifer-a", "mc-prop-ginkgo-big-a"] : ["mc-prop-conifer-a", "mc-prop-conifer-b", "mc-prop-street-tree-a"]) : pick(r, ["mc-prop-azalea-a", "mc-prop-azalea-b", "mc-prop-shrub-a", "mc-prop-hedge-a"]);
      if (!b.pal.kit(id)) id = "mc-prop-shrub-a";
      const k = b.pal.kit(id); if (!k) continue;
      if (b.prop(id, X, Y - k.height + 1, ["park"], 0)) { placed++; Y -= k.height; }
    }
  }
}

function park(b: Board, r: () => number, x0: number, y0: number, x1: number, y1: number) {
  const green = b.pal.group("mc:green"), plaza = b.pal.group("mc:plaza");
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = b.k(x, y); b.lower[i] = green.length ? lawnTile(b.pal, x, y) : b.lower[i]!; b.use[i] = "park"; }
  const cx = x0 + Math.floor(w / 2), cy = y0 + Math.floor(h / 2);
  // 벽돌 길: 남쪽 보도에서 가운데로, 가운데 가로 길
  for (let y = cy - 2; y <= y1; y++) for (const x of [cx - 1, cx]) { const i = b.k(x, y); b.lower[i] = plaza[0]!; b.use[i] = "walk"; }
  for (let x = x0 + 1; x <= x1 - 1; x++) { const i = b.k(x, cy + 2); b.lower[i] = plaza[(x % 2)]!; b.use[i] = "walk"; }
  for (let y = cy - 2; y <= cy + 1; y++) for (let x = cx - 3; x <= cx + 2; x++) { const i = b.k(x, y); b.lower[i] = plaza[1] ?? plaza[0]!; b.use[i] = "walk"; }
  b.prop("mc-prop-fountain-a", cx - 2, cy - 2, ["walk"]);
  for (const [x, y] of [[cx - 4, cy + 3], [cx + 2, cy + 3]] as const) b.prop(pick(r, ["mc-prop-bench-a", "mc-prop-bench-b"]), x, y, ["park"]);
  for (const [x, y] of [[cx - 4, cy - 2], [cx + 3, cy - 2]] as const) b.prop(pick(r, ["mc-prop-park-lamp-a", "mc-prop-park-lamp-b"]), x, y, ["park"]);
  // 큰 공원 나무(4×5) 먼저 하나, 그다음 잎 덩이 큰 나무(3×4)와 옛 꽃나무를 섞는다.
  const big = b.pal.kit("mc-prop-park-tree-a");
  if (big) for (let tries = 0; tries < 40; tries++) {
    const x = x0 + Math.floor(r() * Math.max(1, w - 4)), y = y0 + Math.floor(r() * Math.max(1, h - 5));
    if (b.prop("mc-prop-park-tree-a", x, y, ["park"], 1)) break;
  }
  const trees = b.pal.kit("mc-prop-keyaki-a")
    ? ["mc-prop-keyaki-a", "mc-prop-keyaki-b", "mc-prop-ginkgo-big-a", "mc-prop-blossom-a", "mc-prop-blossom-b", "mc-prop-conifer-a"]
    : ["mc-prop-blossom-a", "mc-prop-blossom-b", "mc-prop-ginkgo-a", "mc-prop-ginkgo-b", "mc-prop-street-tree-a", "mc-prop-conifer-a"];
  let n = 0;
  for (let tries = 0; tries < 80 && n < Math.max(4, Math.floor(w * h / 28)); tries++) {
    const x = x0 + Math.floor(r() * (w - 1)), y = y0 + 2 + Math.floor(r() * Math.max(1, h - 3));
    const id = pick(r, trees);
    if (b.prop(id, x, y - (b.kit(id).height - 1), ["park"], 1)) n++;
  }
  const shrubs = b.pal.kit("mc-prop-azalea-a") ? ["mc-prop-azalea-a", "mc-prop-azalea-b"] : ["mc-prop-shrub-a", "mc-prop-shrub-b"];
  for (let tries = 0, m = 0; tries < 40 && m < 2; tries++) { const x = x0 + Math.floor(r() * w), y = y0 + Math.floor(r() * h); if (b.prop(pick(r, shrubs), x, y - 1, ["park"], 1)) m++; }
}

export function composeModernCityStreet(spec: MCStreetSpec, pal: MCPalette): MCStreetResult {
  const W = spec.width, H = spec.height, seed = spec.seed ?? 0;
  if (W < MODERN_CITY_STREET_MIN.w || H < MODERN_CITY_STREET_MIN.h) throw new Error(`맵이 작다(${W}×${H}) — ${MODERN_CITY_STREET_MIN.w}×${MODERN_CITY_STREET_MIN.h} 이상`);
  const r = mulberry(seed * 7919 + W * 31 + H);
  const b = new Board(W, H, pal);
  // 계획: 가로 도로(12줄 단면) — 북쪽 띠(건물) 높이 9~13
  const hz: number[] = [];
  const nH = Math.max(1, Math.min(3, Math.floor(H / 22)));
  const band = Math.min(11, Math.floor((H - 12 * nH) / nH));
  if (band < 6) throw new Error(`맵 높이 ${H} 로는 건물 띠를 세울 수 없다`);
  const spare = H - nH * (12 + band);
  // 남는 줄: 7줄 이상이면 맨 아래에 남향 띠(맨 아래 보도 2줄이 접근칸 줄), 1~2줄이면 첫 띠를 키운다, 3~6줄이면 맨 아래 광장
  const topExtra = spare <= 2 ? spare : 0;
  let y = band + topExtra;
  for (let i = 0; i < nH; i++) { hz.push(y); y += 12 + band; }
  // 세로 도로 — 블록 폭 ≥ 16
  const vt: number[] = [];
  const nV = W >= 84 ? 2 : 1;
  if (nV === 1) vt.push(Math.max(16, Math.min(W - 28, Math.floor(W * (0.3 + r() * 0.25)))));
  else { const a = Math.floor((W - 24) / 3); vt.push(a - 2 + Math.floor(r() * 5)); vt.push(Math.min(W - 16 - 12, vt[0]! + 12 + a - 2 + Math.floor(r() * 5))); }
  for (const yy of hz) for (let x = 0; x < W; x++) b.ground("mc-street-ew-section", x, yy, "road");
  for (const xx of vt) for (let yy = 0; yy < H; yy++) b.ground("mc-street-ns-section", xx, yy, "road");
  for (const yy of hz) for (const xx of vt) b.ground("mc-intersection-12x12", xx, yy, "road");
  // 길 칸 표시: 단면의 보도 줄은 walk, 차도는 road(ground() 가 보도 칸을 walk 로 둔다). 교차로·단면 안 연석·차도는 road.
  const inV = (x: number) => vt.some((v) => x >= v && x < v + 12);
  // 띠: 가로 도로마다 북쪽(그 도로 첫 보도 줄이 접근칸 줄)
  const counts = new Map<string, number>();
  const queue = shuffle(r, MUST.map((m) => [...m]));
  const wishes = [...(spec.shops ?? [])].map((s) => s.replace(/^mc-bld-/, ""));
  const blocks: { x0: number; x1: number; y0: number; y1: number; accessY: number }[] = [];
  hz.forEach((yy, i) => {
    const top = i === 0 ? 0 : hz[i - 1]! + 12;
    const edges = [-1, ...vt.flatMap((v) => [v, v + 11]), W].sort((a, c) => a - c);
    for (let j = 0; j + 1 < edges.length; j += 2) {
      const x0 = edges[j]! + 1, x1 = edges[j + 1]! - 1;
      if (x1 - x0 + 1 >= 6) blocks.push({ x0, x1, y0: top, y1: yy - 1, accessY: yy });
    }
  });
  // 공원 블록: 위에 도로가 있는(둘째 띠 이후) 블록 중 하나, 없으면 마지막 블록(블록이 셋 이상일 때만)
  const parkable = blocks.filter((k) => k.y0 > 0 && k.x1 - k.x0 >= 13 && k.y1 - k.y0 >= 8);
  const parkBlock = blocks.length >= 3 ? (parkable.length ? pick(r, parkable) : null) : null;
  for (const k of blocks) {
    if (k === parkBlock) { park(b, r, k.x0, k.y0, k.x1, k.y1); continue; }
    frontage(b, r, k.x0, k.x1, k.accessY, k.y1 - k.y0 + 1, counts, queue, wishes);
  }
  // 마지막 도로 아래 남는 띠 — 7줄 이상이면 남향 건물 줄(맨 아래 보도 2줄이 접근칸 줄), 아니면 벽돌 광장 + 나무·벤치
  const lastBottom = hz.length ? hz[hz.length - 1]! + 12 : 0;
  if (H - lastBottom >= 7) {
    const edges = [-1, ...vt.flatMap((v) => [v, v + 11]), W].sort((a, c) => a - c);
    for (let j = 0; j + 1 < edges.length; j += 2) {
      const x0 = edges[j]! + 1, x1 = edges[j + 1]! - 1;
      if (x1 - x0 + 1 >= 6) frontage(b, r, x0, x1, H - 2, H - 2 - lastBottom, counts, queue, wishes);
    }
    for (let x = 0; x < W; x++) for (const yy of [H - 2, H - 1]) { const i = b.k(x, yy); if (b.use[i] === "ground") b.use[i] = "walk"; }
  } else if (lastBottom < H) {
    const plaza = pal.group("mc:plaza");
    for (let yy = lastBottom; yy < H; yy++) for (let x = 0; x < W; x++) { const i = b.k(x, yy); if (b.use[i] === "ground") { b.lower[i] = plaza[(x + yy) % plaza.length]!; b.use[i] = "walk"; } }
    for (let x = 1; x < W - 2; x += 5 + Math.floor(r() * 3)) if (!inV(x) && !inV(x + 1)) b.prop(pick(r, ["mc-prop-street-tree-a", "mc-prop-ginkgo-a", "mc-prop-blossom-a", "mc-prop-bench-a"]), x, Math.max(lastBottom, H - 3), ["walk"], 1);
  }
  // 소품: 가로 도로
  const nearCross = (x: number, pad: number) => vt.some((v) => x >= v - pad && x < v + 12 + pad);
  const trees = ["mc-prop-street-tree-a", "mc-prop-street-tree-b", "mc-prop-ginkgo-a", "mc-prop-tree-a"];
  const busStops: Array<{ x: number; y: number; at?: StopAnchor; name?: string; waitSec?: number }> = [];
  for (const yy of hz) {
    // 남쪽 보도: 가로수·가로등 번갈아(발밑 = 맨 아래 보도 줄 yy+11, ★ 윗줄은 연석·보도 위)
    let alt = r() < 0.5;
    for (let x = 1 + Math.floor(r() * 3); x < W - 2; x += 5 + Math.floor(r() * 3)) {
      if (nearCross(x, 1) || nearCross(x + 1, 1)) continue;
      // 큰 가로수(3×4): 줄기는 맨 아래 보도 줄(yy+11) 가운데 칸, 수관은 연석·차도 위로 걸친다. 없거나 안 맞으면 옛 2×3.
      if (alt) { const big = BIG_STREET_TREES.filter((id) => b.pal.kit(id)); if (!(big.length && !nearCross(x + 2, 1) && b.prop(pick(r, big), x, yy + 8, ["walk", "road"]))) b.prop(pick(r, trees), x, yy + 9, ["walk", "road"]); }
      else b.prop("mc-prop-lamp-a", x, yy + 9, ["walk", "road"]);
      alt = !alt;
    }
    // 버스 정류장 하나(남쪽 보도): 표지 + 벤치, 서행 차선(yy+7)에 버스 정차점 연결
    for (let tries = 0; tries < 12; tries++) {
      const x = 2 + Math.floor(r() * (W - 6)); if (nearCross(x, 2) || nearCross(x + 3, 2)) continue;
      if (b.fits("mc-prop-busstop-a", x, yy + 9, ["walk", "road"]) && b.fits("mc-prop-bench2-a", x + 1, yy + 11, ["walk"])) {
        b.prop("mc-prop-busstop-a", x, yy + 9, ["walk", "road"]);
        b.prop("mc-prop-bench2-a", x + 1, yy + 11, ["walk"]);
        busStops.push({ x: x + 1, y: yy + 7, at: "center", name: "버스 정류장", waitSec: 4 });
        break;
      }
    }
    // 북쪽 보도 둘째 줄: 문 앞(keep) 피한 작은 소품
    for (let x = 2 + Math.floor(r() * 3); x < W - 1; x += 4 + Math.floor(r() * 4)) {
      if (nearCross(x, 0)) continue;
      b.prop(pick(r, ["mc-prop-hydrant-a", "mc-prop-bollard-a", "mc-prop-trash-a", "mc-prop-planter-a", "mc-prop-planter-b", "mc-prop-bollard-a"]), x, yy + 1, ["walk"]);
    }
  }
  // 세로 도로 보도: 가로등(서쪽 보도 안쪽 열·동쪽 보도 안쪽 열)
  for (const xx of vt) for (let yy = 3; yy < H; yy += 7 + Math.floor(r() * 3)) {
    if (hz.some((h) => yy >= h - 1 && yy < h + 13)) continue;
    b.prop("mc-prop-lamp-a", xx + 1, yy - 2, ["walk"]);
    const big = BIG_STREET_TREES.filter((id) => b.pal.kit(id));
    if (!(big.length && b.prop(pick(r, big), xx + 9, yy - 3, ["walk", "road"]))) b.prop(pick(r, trees), xx + 10, yy - 2, ["walk"]);
  }
  // 교차로 모서리 신호등(남쪽 두 모서리 발밑 = 교차로 맨 아래 보도 줄)
  for (const yy of hz) for (const xx of vt) { b.prop("mc-prop-signal-a", xx + 1, yy + 9, ["walk", "road"]); b.prop("mc-prop-ped-signal-g-a", xx + 10, yy + 9, ["walk", "road"]); }
  // 지하철 입구 하나 — 남는 띠·공원 가장자리·건물 사이 넓은 틈 중 3×3 이 비는 곳
  for (let tries = 0; tries < 200; tries++) {
    const x = Math.floor(r() * (W - 3)), yy = Math.floor(r() * (H - 3));
    if (b.fits("mc-prop-subway-a", x, yy, ["walk", "park"], 1) && b.in(x + 1, yy + 3) && b.use[b.k(x + 1, yy + 3)] === "walk") { b.prop("mc-prop-subway-a", x, yy, ["walk", "park"], 1); b.notes.push(`지하철 입구 (${x},${yy}) — 대합실 실내(program concourse)를 잇는다면 그 아래 칸 (${x + 1},${yy + 3})`); break; }
  }
  // 시작 칸: 마지막 가로 도로 남쪽 보도(또는 그 아래 띠) 가운데에서 가장 가까운 걸을 칸
  const sy = Math.min(H - 1, (hz.length ? hz[hz.length - 1]! + 10 : H - 2));
  let start = { x: Math.floor(W / 2), y: sy };
  for (let d = 0; d < W; d++) {
    const c = [{ x: Math.floor(W / 2) + d, y: sy }, { x: Math.floor(W / 2) - d, y: sy }, { x: Math.floor(W / 2) + d, y: sy + 1 }].find((p) => b.in(p.x, p.y) && b.use[b.k(p.x, p.y)] === "walk" && b.upper[b.k(p.x, p.y)] < 0);
    if (c) { start = c; break; }
  }
  if (b.buildings.length < 2) throw new Error(`건물을 ${b.buildings.length}채밖에 못 세웠다 — 맵을 키운다`);
  // 같은 종류 두 채(편의점·은행 …)는 이름에 번호를 붙인다 — 장소 이름으로 찾을 때 앞 건물만 잡히지 않게(2026-10-14 실조수 경고).
  const named = new Map<string, number>();
  const buildings = b.buildings.map((d) => { const k = (named.get(d.name) ?? 0) + 1; named.set(d.name, k); return k > 1 ? { ...d, name: `${d.name} ${k}` } : d; });
  const roadBands: RoadBand[] = [
    ...hz.map((yy): RoadBand => ({ axis: "ew", edge: yy + 3, width: 6, from: 0, to: W - 1, edgeToEdge: true })),
    ...vt.map((xx): RoadBand => ({ axis: "ns", edge: xx + 3, width: 6, from: 0, to: H - 1, edgeToEdge: true })),
  ];
  const rotatedMix = DEFAULT_MODERN_CAR_MIX.map((_, i) => DEFAULT_MODERN_CAR_MIX[(i + Math.abs(seed)) % DEFAULT_MODERN_CAR_MIX.length]!);
  const transit = {
    routes: autoTrafficRoutes(roadBands, { width: W, height: H }, {
      vehicles: rotatedMix,
      busVehicle: "mc-veh-bus-a",
      headwaySec: 6,
      busHeadwaySec: 28,
      includeTurns: true,
      busStops,
    }).routes,
  };
  return { lower: b.lower, upper: b.upper, upper2: b.upper2, buildings, start, props: b.props, roads: { horizontal: hz, vertical: vt }, park: parkBlock ? { x: parkBlock.x0, y: parkBlock.y0, w: parkBlock.x1 - parkBlock.x0 + 1, h: parkBlock.y1 - parkBlock.y0 + 1 } : null, notes: b.notes, transit };
}

/** 번들 정의(또는 그 사본)에서 사전을 만든다. */
export function modernCityPaletteFromTileset(def: {
  readonly tileGroups?: readonly { readonly id: string; readonly tileIds: readonly number[] }[];
  readonly structureKits?: readonly unknown[];
}): MCPalette {
  const groups = new Map((def.tileGroups ?? []).map((g) => [g.id, g.tileIds] as const));
  const kits = new Map<string, MCKit>();
  for (const raw of def.structureKits ?? []) {
    const k = raw as { id: string; width: number; height: number; rows: MCKit["rows"]; ai?: { access?: { dx: number; dy: number }[] } };
    if (!k?.id || !Array.isArray(k.rows)) continue;
    kits.set(k.id, { id: k.id, width: k.width, height: k.height, rows: k.rows, ...(k.ai?.access ? { access: k.ai.access } : {}) });
  }
  const bld = [...kits.keys()].filter((id) => id.startsWith("mc-bld-"));
  return { group: (id) => groups.get(id) ?? [], kit: (id) => kits.get(id), buildingKits: () => bld };
}
