// project/modernCityBoard.ts
// modern_city 거리 구성기들이 같이 쓰는 판(Board)·사전 타입·씨앗 도구 — 도쿄풍 구성기와 한국 지구 구성기가 같은 규칙으로 찍는다.

export interface MCKit {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly rows: readonly { readonly tiles: readonly number[]; readonly upperTiles?: readonly number[] }[];
  /** 건물 문 앞 접근칸(키트 기준, dy = height). */
  readonly access?: readonly { readonly dx: number; readonly dy: number }[];
  /** 킷 이름·태그(급 tier:* · 나라 country:* · 실내 program:* …) — 한국 지구 구성기가 읽는다. */
  readonly name?: string;
  readonly tags?: readonly string[];
  /** 칸 종류 줄(키트 줄마다 한 문자열): S 막힘 · * 솟은 칸(걷는다, 사람 위) · . 바닥 그림(걷는다, 사람 밑) · 빈칸 없음. 사전이 통행 표를 알 때만 있다. */
  readonly cells?: readonly string[];
  /** 지붕 면(키트 원점 기준 칸 사각형) — empty 면 구성기가 옥상 기물(mc-roof-kr-*)을 얹는다. 한국 건물 키트의 ai.roofFace. */
  readonly roof?: { readonly dx: number; readonly dy: number; readonly w: number; readonly h: number; readonly empty: boolean };
}
export interface MCPalette {
  /** 바닥 묶음(mc:sidewalk·mc:green·mc:plaza …)의 칸 번호들. 없으면 빈 배열. */
  group(id: string): readonly number[];
  kit(id: string): MCKit | undefined;
  /** 건물 키트 id 전체(mc-bld-*). */
  buildingKits(): readonly string[];
  /** 키트 id 전체 — 한국 지구 구성기가 태그로 고른다(없는 사전이면 건물 키트만 본다). */
  kitIds?(): readonly string[];
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

export function mulberry(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function pick<T>(r: () => number, xs: readonly T[]): T { return xs[Math.floor(r() * xs.length)]!; }
export function shuffle<T>(r: () => number, xs: T[]): T[] { for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [xs[i], xs[j]] = [xs[j]!, xs[i]!]; } return xs; }
export function mcBuildingType(kitId: string): string { return kitId.replace(/^mc-bld-/, "").replace(/-roof$/, "").replace(/-[A-C]$/, ""); }

export type Use = "ground" | "road" | "walk" | "front" | "bld" | "prop" | "park" | "veh" | "yard";

/** 칸 해시 0..1(씨앗 무관 — 같은 칸은 같은 잔디). */
export function cellHash(x: number, y: number, k = 0): number { let h = Math.imul(x * 374761393 + y * 668265263 + k * 2147483647, 1274126177); h ^= h >>> 13; h = Math.imul(h, 1103515245); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
/** 잔디 칸: mc:lawn(2026-10-14, 바탕 4 · 풀 덩이 2 · 꽃 2)이 있으면 섞어 칠하고, 옛 정의면 mc:green 두 칸. */
export function lawnTile(pal: MCPalette, x: number, y: number): number {
  const lawn = pal.group("mc:lawn");
  if (lawn.length >= 8) {
    const j = cellHash(x, y);
    return lawn[j < 0.9 ? Math.floor(cellHash(x, y, 1) * 4) : j < 0.97 ? 4 + Math.floor(cellHash(x, y, 2) * 2) : 6 + Math.floor(cellHash(x, y, 3) * 2)]!;
  }
  const green = pal.group("mc:green");
  return green[(x * 7 + y * 3) % Math.min(2, green.length)]!;
}
/** 큰 가로수(잎 덩이 수관 3×4) — 없으면 옛 2×3 가로수. */
export const BIG_STREET_TREES = ["mc-prop-keyaki-a", "mc-prop-keyaki-b", "mc-prop-ginkgo-big-a"] as const;

export class Board {
  readonly lower: number[]; readonly upper: number[]; readonly upper2: number[]; readonly use: Use[]; readonly keep: boolean[];
  readonly buildings: MCBuilding[] = []; readonly props: { kit: string; x: number; y: number }[] = []; readonly notes: string[] = [];
  /** 한국 지구 구성기: 이 지구가 쓰는 기물 묶음(set:<이름> 태그)과 자리별 기물 목록 캐시. */
  krSets?: readonly string[]; readonly krCache = new Map<string, string[]>(); readonly krCount = new Map<string, number>();
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
  /** 키트 칸 종류(S·*·.) — 사전에 없으면 맨 아랫줄만 막힌 것으로 본다. */
  cellKind(kit: MCKit, c: number, r: number): string {
    const up = kit.rows[r]?.upperTiles?.[c] ?? -1, lo = kit.rows[r]?.tiles[c] ?? -1;
    if (up < 0 && lo < 0) return " ";
    if (up < 0) return ".";
    return kit.cells?.[r]?.[c] ?? (r === kit.height - 1 ? "S" : "*");
  }
  /**
   * 건물 앞·담 앞에 서는 기물: 막힌 칸은 빈 땅(allow) 위에만, 솟은 칸(*)은 건물·다른 기물 위로 겹쳐도 된다(넷째 층에 그린다).
   * 바닥 그림(.)은 빈 땅의 위층(또는 아래층 칸)에 깔고 그 칸을 막지 않는다. 한국 지구 구성기가 쓴다 — 건물이 벽을 맞대면 간판을 세울 빈 열이 없다.
   */
  fitsOver(id: string, x: number, y: number, allow: readonly Use[]): boolean {
    const kit = this.pal.kit(id); if (!kit) return false;
    for (let r = 0; r < kit.height; r++) for (let c = 0; c < kit.width; c++) {
      const kind = this.cellKind(kit, c, r); if (kind === " ") continue;
      const X = x + c, Y = y + r; if (!this.in(X, Y)) return false;
      const i = this.k(X, Y);
      // 건물 칸 위: 넷째 층이 비어 있으면 겹친다(자판기 윗칸·전봇대·간판이 벽 앞에 선다). 맨 아랫줄은 빈 땅이어야 한다.
      if (this.use[i] === "bld") { if (r === kit.height - 1 || this.upper2[i] >= 0) return false; continue; }
      if (kind === "*") { if (this.upper[i] >= 0 && this.upper2[i] >= 0) return false; continue; }
      if (this.upper[i] >= 0 || !allow.includes(this.use[i]!)) return false;
      if (kind === "S" && this.keep[i]) return false;
    }
    return true;
  }
  propOver(id: string, x: number, y: number, allow: readonly Use[]): boolean {
    if (!this.fitsOver(id, x, y, allow)) return false;
    const kit = this.kit(id);
    for (let r = 0; r < kit.height; r++) for (let c = 0; c < kit.width; c++) {
      const kind = this.cellKind(kit, c, r); if (kind === " ") continue;
      const i = this.k(x + c, y + r), lo = kit.rows[r]!.tiles[c] ?? -1, up = kit.rows[r]!.upperTiles?.[c] ?? -1;
      if (lo >= 0) this.lower[i] = lo;
      if (up >= 0) { if (this.upper[i] >= 0) this.upper2[i] = up; else this.upper[i] = up; }
      if (kind === "S" && this.use[i] !== "bld") this.use[i] = "prop";
    }
    this.props.push({ kit: id, x, y }); return true;
  }
  prop(id: string, x: number, y: number, allow: readonly Use[] = ["walk", "ground"], margin = 0): boolean {
    if (!this.fits(id, x, y, allow, margin)) return false;
    this.stamp(id, x, y, "prop"); this.props.push({ kit: id, x, y }); return true;
  }
}
