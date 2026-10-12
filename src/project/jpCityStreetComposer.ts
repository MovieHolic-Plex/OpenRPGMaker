// project/jpCityStreetComposer.ts
// 일본 도시(jp_city) 거리 구성기 — 씨앗과 용도만 주면 매번 다른 거리를 짠다.
//
// 왜 (2026-10-12 사용자 「견본을 많이 만든다고 해결될 게 아니다. 미리 다양한 배치·오브젝트로 똑똑하게」):
//   완성 장소를 붙이면 같은 컨셉 틀이 같은 거리로 나온다. 구성기는 부품 사전(1층 11종·층 띠 9종·벽 4·지붕 13·간판·문 9)과
//   거리 칸(도로·보도·판석·잔디)과 소품(자판기·자전거·가로등·화분·벤치·노보리…)을 규칙으로 엮어 거리를 만든다.
//   AI 는 용도(가게 목록·분위기)를 고르고, 배치·조화는 이 함수가 한다(AI 창의성 vs 함수 재현성 실험의 결론).
//
// 짜임(위→아래): [뒷줄 건물] [보도 2] [도로 3~4] [보도 2] [앞줄 건물] [맨 아래 보도 2]. 두 줄 모두 문이 남쪽(도로 쪽·아래 보도 쪽)이다.
// 건물은 부품 사전에서 무작위로 조립하되 조립기(buildJpCityBuilding)가 거절하면(층 쌍·간판 충돌·문 막힘…) 다른 조합으로 다시 시도한다.
// 순수 계획 → 도구 호출 목록으로 만든다: 호출 쪽(뼈대 · compose_jp_city_street 도구)이 실제로 실행한다.

import { addMapLocation } from "@/project/mapNamedLocations";
import type { GameMap } from "@/project/types";

export type JpStreetStyle = "shopping" | "residential";

export interface JpStreetShop {
  /** 가게 종류. konbini · izakaya · ramen · cafe · shop · office · garage · machiya · apartment · house · sento · bento */
  readonly role: string;
}

export interface JpStreetStep { readonly tool: string; readonly args: Record<string, unknown>; readonly optional?: boolean; readonly note?: string }

export interface JpStreetBuilding { readonly role: string; readonly x: number; readonly foot: number; readonly w: number; /** 이 건물이 선 띠의 맨 윗줄(건물 위 뒷마당 채우기 한계) */ readonly top?: number }

export interface JpStreetPlan {
  readonly steps: readonly JpStreetStep[];
  /** 계획한 건물(후보 `try:N` 의 N 번째). 실제로 지어진 것만 `runJpStreetPlan` 결과에 남는다. */
  readonly buildings: readonly JpStreetBuilding[];
  /** 걸어 다니는 큰길 줄(보도 둘 사이) — 시작 칸·문 후보를 고르는 기준. */
  readonly walkRows: readonly number[];
  readonly summary: string;
  readonly mapId: string;
  readonly seed: number;
}

function mulberry(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

interface ShopLook {
  readonly grounds: readonly string[];
  readonly floorKinds: readonly string[];
  readonly floors: readonly [number, number];
  readonly walls: readonly string[];
  readonly roofs: readonly string[];
  readonly heads?: readonly string[];
  readonly width: readonly [number, number];
}

const ROOFS_FLAT = ["roof.plain.plain", "roof.plain.tank", "roof.ac.plain", "roof.ac.tank", "roof.ac.cyl", "roof.stair.plain", "roof.stair.tank"];
const ROOFS_TILE = ["roof.tile", "roof.slate", "roof.hip", "roof.hip.slate"];

/** 가게 종류 → 외형 범위. 범위 안에서 씨앗이 고른다(범위 밖은 조립기가 어색하다고 거절하는 조합). */
const LOOKS: Readonly<Record<string, ShopLook>> = {
  konbini:   { grounds: ["gr.konbini.0", "gr.konbini.1"], floorKinds: ["curtain", "ribbon", "pairs"], floors: [2, 3], walls: ["kinari", "hodo", "shiro"], roofs: ROOFS_FLAT, width: [6, 8] },
  izakaya:   { grounds: ["gr.izakaya"], floorKinds: ["pairs", "koushi", "curtain", "balcony"], floors: [2, 4], walls: ["kinari", "conc", "hodo"], roofs: ROOFS_FLAT, heads: ["roofsign.aka", "roofsign.sora", "roofsign.kii"], width: [5, 7] },
  ramen:     { grounds: ["gr.izakaya", "gr.glass.aka"], floorKinds: ["pairs", "ribbon"], floors: [1, 3], walls: ["kinari", "shiro"], roofs: ROOFS_FLAT, heads: ["roofsign.aka"], width: [4, 6] },
  cafe:      { grounds: ["gr.glass.kii", "gr.glass.sora", "gr.glass.aka"], floorKinds: ["veranda", "pairs", "slide"], floors: [1, 3], walls: ["shiro", "kinari"], roofs: ROOFS_FLAT, width: [5, 7] },
  shop:      { grounds: ["gr.shutter.aka", "gr.shutter.sora", "gr.shutter.kii", "gr.glass.sora"], floorKinds: ["slide", "pairs", "ribbon"], floors: [1, 3], walls: ["kinari", "shiro", "conc"], roofs: ROOFS_FLAT, width: [4, 7] },
  office:    { grounds: ["gr.glass.sora", "gr.shutter.sora"], floorKinds: ["slide", "ribbon", "koushi"], floors: [3, 4], walls: ["conc", "hodo", "shiro"], roofs: ROOFS_FLAT, width: [5, 8] },
  garage:    { grounds: ["gr.garage"], floorKinds: ["veranda", "balcony", "pairs"], floors: [2, 4], walls: ["kinari", "shiro", "conc"], roofs: ROOFS_FLAT, width: [5, 7] },
  apartment: { grounds: ["gr.shutter.kii", "gr.shutter.sora", "gr.garage"], floorKinds: ["veranda", "balcony", "slide"], floors: [3, 4], walls: ["shiro", "kinari", "hodo"], roofs: ROOFS_FLAT, width: [5, 8] },
  machiya:   { grounds: ["gr.machiya"], floorKinds: ["tile", "koushi"], floors: [1, 2], walls: ["kinari", "hodo"], roofs: ROOFS_TILE, width: [5, 7] },
  house:     { grounds: ["gr.machiya"], floorKinds: ["tile", "pairs"], floors: [1, 2], walls: ["kinari", "shiro", "hodo"], roofs: ROOFS_TILE, width: [4, 6] },
  sento:     { grounds: ["gr.machiya"], floorKinds: ["tile"], floors: [1, 2], walls: ["hodo", "conc"], roofs: ROOFS_TILE, width: [6, 8] },
  bento:     { grounds: ["gr.glass.aka", "gr.shutter.kii"], floorKinds: ["pairs", "slide"], floors: [1, 2], walls: ["kinari", "shiro"], roofs: ROOFS_FLAT, width: [4, 5] },
};

/** 가게 종류 → 위층 세로 간판 부착물. */
const ROLE_SIGNS: Readonly<Record<string, string>> = { izakaya: "vsign.izakaya", ramen: "vsign.ramen", cafe: "vsign.kissa", sento: "vsign.sento", bento: "plate.bento", shop: "vsign.mark.aka" };

/** 가게 종류 → 어울리는 문 종류(전부 조립기 문 사전). 첫 항목이 그 층 그림의 기본문. 문마다 모양이 달라 「죄다 같은 문」이 되지 않는다. */
const ROLE_DOORS: Readonly<Record<string, readonly string[]>> = {
  konbini: ["auto"], izakaya: ["noren", "lattice"], ramen: ["noren", "lattice", "cafe"], cafe: ["cafe", "lobby", "lattice"],
  shop: ["steel", "lobby", "lattice", "cafe"], office: ["lobby", "auto", "steel"], garage: ["rollup", "steel"], apartment: ["lobby", "steel", "auto", "house"],
  machiya: ["machiya", "lattice"], house: ["house", "lattice", "steel"], sento: ["lattice", "noren"], bento: ["cafe", "steel"],
};

/** 현관 앞 꾸밈: 문 양옆 보도 칸에 놓는 낮은 소품(종류별). id → [w,h]. 문 바로 앞 칸(접근칸)은 비운다. */
const ENTRANCE_PROPS: Readonly<Record<string, readonly (readonly [string, number, number])[]>> = {
  house: [["jp-prop-pot", 1, 2], ["jp-prop-post-box", 1, 2], ["jp-pots", 2, 1], ["jp-prop-planter", 2, 1]],
  machiya: [["jp-prop-pot", 1, 2], ["jp-pots", 2, 1], ["jp-prop-lantern-post", 1, 3]],
  apartment: [["jp-prop-post-box", 1, 2], ["jp-prop-bike-sora", 2, 2], ["jp-prop-bike-aka", 2, 2], ["jp-prop-planter", 2, 1]],
  office: [["jp-prop-planter", 2, 1], ["jp-prop-bollard", 1, 1], ["jp-prop-post-box", 1, 2]],
  konbini: [["jp-prop-bike-rack", 2, 1], ["jp-prop-vending-aka", 2, 2], ["jp-prop-a-frame", 1, 1]],
  cafe: [["jp-prop-a-frame", 1, 1], ["jp-prop-planter", 2, 1], ["jp-prop-pot", 1, 2]],
  izakaya: [["jp-prop-a-frame", 1, 1], ["jp-prop-pot", 1, 2], ["jp-prop-garbage-net", 2, 1]],
  ramen: [["jp-prop-a-frame", 1, 1], ["jp-prop-bike-rack", 2, 1], ["jp-prop-vending-sora", 2, 2]],
  shop: [["jp-prop-a-frame", 1, 1], ["jp-prop-planter", 2, 1], ["jp-prop-pot", 1, 2]],
  garage: [["jp-prop-cone", 1, 1], ["jp-prop-barricade3", 3, 1]],
  sento: [["jp-prop-pot", 1, 2], ["jp-prop-bench", 2, 1], ["jp-prop-lantern-post", 1, 3]],
  bento: [["jp-prop-a-frame", 1, 1], ["jp-prop-bike-rack", 2, 1]],
};

/** 완성 큰 건물(문 위치를 몰라 이름표·실내 연결은 하지 않는다 — 풍경). 띠 높이에 맞는 것만 놓는다. */
const LANDMARKS: readonly { id: string; w: number; h: number }[] = [
  { id: "jp-bldg-mansion4", w: 11, h: 11 }, { id: "jp-bldg-zakkyo5", w: 7, h: 14 }, { id: "jp-bldg-office6", w: 9, h: 15 }, { id: "jp-bldg-mansion6-slim", w: 7, h: 15 }, { id: "jp-bldg-clinic", w: 9, h: 8 }, { id: "jp-bldg-post-office", w: 9, h: 8 }, { id: "jp-bldg-supermarket", w: 14, h: 6 }, { id: "jp-bldg-koban", w: 6, h: 6 },
];

const SHOPPING_MIX = ["konbini", "izakaya", "ramen", "cafe", "shop", "office", "shop", "izakaya", "apartment", "bento", "cafe", "garage"];
const RESIDENTIAL_MIX = ["house", "house", "machiya", "apartment", "house", "garage", "house", "machiya", "sento", "house"];

/** 한 줄에 놓을 건물 칸 폭을 뽑는다 — 가게 폭 범위 안에서, 남는 폭이 다음 건물 최소(3)보다 작으면 마지막 건물을 늘린다. */
function packRow(rng: () => number, width: number, roles: readonly string[], gaps: boolean): { role: string; x: number; w: number }[] {
  const out: { role: string; x: number; w: number }[] = [];
  let x = gaps ? 1 + Math.floor(rng() * 2) : 0;
  let i = 0;
  while (x < width - 3) {
    const role = roles[i % roles.length]!;
    const look = LOOKS[role]!;
    let w = look.width[0] + Math.floor(rng() * (look.width[1] - look.width[0] + 1));
    if (x + w > width) w = width - x;
    if (width - (x + w) < 3 && width - (x + w) > 0) w = width - x;                     // 자투리 1~2칸은 이 건물이 먹는다
    if (w < 3) break;
    out.push({ role, x, w });
    x += w;
    i++;
    // 틈: 대부분 붙이고, 가끔 골목(2~3칸) 또는 한두 칸 빈터
    const r = rng();
    if (r < 0.22) x += 2 + Math.floor(rng() * 2);
    else if (r < 0.35) x += 1;
  }
  return out;
}

const n0 = (v: number) => v;

function shuffle<T>(rng: () => number, list: readonly T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

const pick = <T>(rng: () => number, list: readonly T[]): T => list[Math.floor(rng() * list.length)]!;

/** 건물 한 채의 조립 입력을 뽑는다. `attempt` 가 늘수록 단순한 조합(층 수 ↓, 간판 없음)으로 물러난다. */
export function randomBuildingArgs(rng: () => number, role: string, w: number, attempt: number, rowsAvail = 99): Record<string, unknown> {
  const look = LOOKS[role] ?? LOOKS.shop!;
  // 1층(3줄)+지붕(2~3줄)을 빼고 남는 줄을 층(2줄)으로 — 건물이 앞 보도·도로를 덮지 않게
  const cap = Math.max(1, Math.floor((rowsAvail - 5) / 2));
  const lo = Math.min(look.floors[0], cap), hi = Math.max(lo, Math.min(cap, look.floors[1] - (attempt > 6 ? 1 : 0)));
  const floors = lo + Math.floor(rng() * (hi - lo + 1));
  const args: Record<string, unknown> = {
    w,
    floors,
    floorKind: pick(rng, look.floorKinds),
    wall: pick(rng, look.walls),
    ground: pick(rng, look.grounds),
    roof: pick(rng, look.roofs),
  };
  // 문: 종류와 자리를 바꾼다(기본은 오른쪽 끝 · 기본문). 막히면(DOOR_BLOCKED·DECO_CLASH) 뒤 후보가 기본으로 물러난다.
  if (attempt < 8) {
    const doorPool = ROLE_DOORS[role] ?? ROLE_DOORS.shop!;
    const type = pick(rng, doorPool);
    const dw = type === "machiya" ? 3 : 2;
    const spots = [...new Set([n0(0), Math.floor((w - dw) / 2), w - dw])].filter((c) => c >= 0 && c <= w - dw);
    args.door = { type, col: pick(rng, spots) };
  }
  if (look.heads && attempt < 4 && rng() < 0.45) { args.head = pick(rng, look.heads); delete args.roof; }
  // 외벽 부착물: 가게 종류의 간판·배관·실외기·비상계단. 충돌하면 조립기가 거절하고(DECO_CLASH) 뒤 후보는 부착물을 뺀다.
  if (attempt < 6) {
    const decos: Record<string, unknown>[] = [];
    const lastCol = Math.max(0, w - 1);
    const sign = ROLE_SIGNS[role];
    if (sign && rng() < 0.75) decos.push({ deco: sign, col: rng() < 0.5 ? 0 : lastCol, floor: "0" });
    if ((role === "apartment" || role === "office" || role === "garage") && floors >= 2) {
      const r = rng();
      if (r < 0.35) decos.push({ deco: "fe", col: Math.min(lastCol, 1 + Math.floor(rng() * Math.max(1, w - 3))), floor: "0" });
      else if (r < 0.7) decos.push({ deco: pick(rng, ["ac.0", "ac.1"]), col: Math.floor(rng() * w), floor: String(Math.max(0, floors - 1)) });
    }
    if (role !== "house" && role !== "machiya" && rng() < 0.3) decos.push({ deco: "pipe", col: rng() < 0.5 ? 0 : lastCol, floor: "ground", row: 0 });
    if (decos.length) args.decos = decos;
  }
  return args;
}

export interface ComposeOptions {
  readonly mapId: string;
  readonly width: number;
  readonly height: number;
  readonly seed: number;
  readonly style?: JpStreetStyle;
  /** 거리에 꼭 넣을 가게(순서대로 건물에 배정). 나머지는 style 의 기본 구성이 채운다. */
  readonly shops?: readonly string[];
}

export type JpBlockZone = "shop" | "house" | "park" | "parking";

/** 거리 계획 — 도로망(가로 큰길 + 세로 골목) → 블록 구획 → 구획 용도(상가·주택·공원·주차장) → 대지(건물·빈터) → 소품 순서의 도구 호출 목록. */
export function planJpCityStreet(opts: ComposeOptions): JpStreetPlan {
  const { mapId, width: W, height: H } = opts;
  const rng = mulberry((opts.seed ^ 0x9e3779b1) >>> 0);
  const style: JpStreetStyle = opts.style ?? "shopping";
  const steps: JpStreetStep[] = [];
  const fill = (x: number, y: number, w: number, h: number, material: string, optional = false) => {
    if (w > 0 && h > 0) steps.push({ tool: "fill_region", args: { mapId, rect: { x, y, w, h }, material }, optional });
  };
  const stamp = (id: string, x: number, y: number, note = "prop") => steps.push({ tool: "stamp_object", args: { objectId: `kit:jp_city/${id}`, mapId, x, y }, optional: true, note });

  // ── 1. 도로망: 가로 큰길(N-1 줄) 사이에 건물 띠(N 줄). 건물 문은 모두 남쪽이라 띠마다 아래에 길이 있다.
  const N = H >= 46 ? 3 : 2;
  const roadWs = Array.from({ length: N - 1 }, (_, i) => (style === "residential" ? 3 : i === 0 && rng() < 0.7 ? 4 : rng() < 0.3 ? 4 : 3));
  const gapRows = roadWs.reduce((a, w) => a + w + 4, 0);
  const bandTotal = H - 2 - gapRows;                               // 건물 띠들이 쓸 줄 수(마지막 띠 발은 H-3, 아래 보도 2줄)
  const base = Math.floor(bandTotal / N);
  const heights = Array.from({ length: N }, () => base);
  heights[0] = Math.max(11, base + Math.floor(rng() * 4) - 1);
  for (let i = 1; i < N; i++) heights[i] = Math.max(9, Math.floor((bandTotal - heights[0]!) / (N - 1)));
  interface Band { top: number; foot: number; gap?: { sw1: number; road0: number; road1: number; sw2: number; roadW: number } }
  const bands: Band[] = [];
  let cy = 0;
  for (let i = 0; i < N; i++) {
    const top = cy, foot = i === N - 1 ? H - 3 : top + heights[i]! - 1;
    const band: Band = { top, foot };
    if (i < N - 1) {
      const roadW = roadWs[i]!;
      const road0 = foot + 3;
      band.gap = { sw1: foot + 1, road0, road1: road0 + roadW - 1, sw2: road0 + roadW, roadW };
      cy = band.gap.sw2 + 2;
    }
    bands.push(band);
  }
  const ground = style === "residential" ? "잔디" : "자갈 참배길";
  fill(0, 0, W, H, ground);
  for (const b of bands) if (b.gap) {
    fill(0, b.gap.sw1, W, 2, "보도 연석");
    fill(0, b.gap.road0, W, b.gap.roadW, "생활도로");
    fill(0, b.gap.road1 + 1, W, 2, "보도 연석");
  }
  fill(0, H - 2, W, 2, "보도 연석");

  // 세로 길: 0~2 개. 폭 2~3 + 양옆 보도 1칸. 전 구간을 지나거나(사거리) 일부 띠에서만 큰길에 붙는다(T자). 서로 14칸 이상 떨어뜨린다.
  interface VStreet { x: number; lane: number; w: number; from: number; to: number }
  const streets: VStreet[] = [];
  const want = W < 40 ? (rng() < 0.7 ? 1 : 0) : rng() < 0.08 ? 0 : rng() < 0.45 ? 1 : 2;
  for (let t = 0; t < want * 6 && streets.length < want; t++) {
    const lane = 2 + Math.floor(rng() * 2);
    const x = 4 + Math.floor(rng() * Math.max(1, W - 8 - lane));
    if (streets.some((s) => Math.abs(s.x - x) < 14)) continue;
    const r = rng();
    const from = r < 0.5 || N === 2 && r < 0.75 ? 0 : 1 + Math.floor(rng() * (N - 1));
    const to = from === 0 && r >= 0.5 ? Math.floor(rng() * N) : N - 1;
    streets.push({ x, lane, w: lane + 2, from: Math.min(from, to), to: Math.max(from, to) });
  }
  const BANK = 4;                                                // 하천 양옆 둔치: 산책로 3 + 비탈 1
  let river: { x: number; w: number } | undefined;
  const inStreet = (x: number, k?: number) => streets.some((s) => x >= s.x - 1 && x <= s.x + s.w && (k === undefined || (k >= s.from && k <= s.to))) || (river !== undefined && x >= river.x - BANK - 1 && x <= river.x + river.w + BANK);
  for (const s of streets) {
    for (let k = s.from; k <= s.to; k++) {
      const y0 = k === s.from ? (k === 0 ? 0 : bands[k - 1]!.gap!.road1 + 1) : bands[k - 1]!.gap!.road1 + 1;
      const y1 = k === s.to ? (k === N - 1 ? H - 1 : bands[k]!.gap!.road0 - 1) : bands[k]!.gap!.road0 - 1;
      fill(s.x, y0, 1, y1 - y0 + 1, "보도 연석", true);
      fill(s.x + s.w - 1, y0, 1, y1 - y0 + 1, "보도 연석", true);
      fill(s.x + 1, y0, s.lane, y1 - y0 + 1, "생활도로", true);
    }
  }
  // 하천: 세로로 지도를 가로지르는 물길(45%). 큰길은 다리(보도·도로를 물 위에 다시 깔고 양옆 가드레일)로 건넌다. 건물·소품·세로 길은 물을 피한다.
  if (W >= 50 && rng() < 0.45) {
    const rw = 4 + Math.floor(rng() * 2);
    for (let t = 0; t < 12 && !river; t++) {
      const x = 12 + Math.floor(rng() * Math.max(1, W - 24 - rw));
      if (streets.some((s2) => x < s2.x + s2.w + 6 + BANK && x + rw > s2.x - 6 - BANK)) continue;
      river = { x, w: rw };
    }
  }
  if (river) {
    const r = river, x0 = r.x - BANK, x1 = r.x + r.w + BANK;
    fill(x0, 0, x1 - x0, H, "판석 광장");                             // 산책로(둔치)
    fill(r.x - 1, 0, 1, H, "잔디");                                   // 물가 풀 비탈 — 산책로보다 한 단 낮게 내려가는 둑
    fill(r.x + r.w, 0, 1, H, "잔디");
    fill(r.x, 0, r.w, H, "수로");
    for (const b of bands) if (b.gap) {                              // 큰길은 다리로 건넌다: 산책로 칸은 길이 이어지고, 물·비탈 칸에는 난간 달린 다리 상판
      const g = b.gap;
      fill(x0, g.sw1, x1 - x0, 2, "보도 연석");
      fill(x0, g.road0, x1 - x0, g.roadW, "생활도로");
      fill(x0, g.road1 + 1, x1 - x0, 2, "보도 연석");
      for (let x = r.x - 1; x <= r.x + r.w; x++) {
        const edge = x === r.x - 1 ? "l" : x === r.x + r.w ? "r" : null;
        stamp(edge ? `jp-bwall-end-${edge}` : "jp-bwall-plain", x, g.sw1, "bridge");                       // 위쪽 난간(윗면)
        stamp(edge ? `jp-bwallf-end-${edge}` : "jp-bwallf-plain", x, g.road1 + 2, "bridge");            // 아래쪽 난간(정면 2줄 — 다리 옆구리)
      }
      stamp("jp-prop-lamp-post", r.x - 1, g.sw1 + 1 - 2, "bridge");
      stamp("jp-prop-lamp-post", r.x + r.w, g.sw1 + 1 - 2, "bridge");
    }
    // 둔치 소품: 띠마다 양쪽 산책로에 벚나무·벤치·가로등. 큰길 보도 줄(다리 어귀)은 피한다.
    for (const b of bands) {
      for (let y = b.top + 1, k = 0; y + 5 <= b.foot; y += 8, k++) {
        stamp(`jp-prop-tree-${k % 2 === 0 ? "sakura" : pick(rng, ["zelkova", "ginkgo"])}`, k % 2 === 0 ? x0 : r.x + r.w, y, "bank");
      }
      for (let y = b.top + 4; y + 1 < b.foot; y += 9) { stamp("jp-prop-bench", x0, y, "bank"); stamp("jp-prop-lamp-post", r.x + r.w + 1, y - 2, "bank"); }
    }
  }
  const obstacles: { x: number; w: number }[] = [...streets.map((s2) => ({ x: s2.x, w: s2.w })), ...(river ? [{ x: river.x - BANK, w: river.w + 2 * BANK }] : [])];
  // 횡단보도: 폭 4 큰길마다 하나(키트 6×4) — 세로 길 어귀는 피한다.
  const crossings: { x: number; road: number }[] = [];
  bands.forEach((b, i) => {
    if (!b.gap || b.gap.roadW !== 4) return;
    for (let t = 0; t < 8; t++) {
      const x = 3 + Math.floor(rng() * Math.max(1, W - 12));
      if (obstacles.some((s) => x < s.x + s.w + 1 && x + 6 > s.x - 1)) continue;
      crossings.push({ x, road: i });
      stamp("jp-road-lane-crosswalk-h", x, b.gap.road0, "road");
      break;
    }
  });

  // ── 2. 블록과 구획 용도: 띠 × (세로 길 사이 구간). 상가가 기본이고 가끔 주택·공원·주차장.
  const mix = style === "residential" ? RESIDENTIAL_MIX : SHOPPING_MIX;
  const wanted = [...(opts.shops ?? [])].filter((r) => LOOKS[r]);
  const pool = [...wanted, ...shuffle(rng, mix), ...shuffle(rng, mix)];
  let poolPtr = 0;
  const housePool = shuffle(rng, RESIDENTIAL_MIX);
  const zones: { band: number; sx: number; ex: number; zone: JpBlockZone }[] = [];
  const placed: { role: string; x: number; foot: number; w: number; top?: number }[] = [];
  const buildSteps: JpStreetStep[] = [];
  const yardSteps: JpStreetStep[] = [];
  const carsYard = ["jp-prop-car-white", "jp-prop-car-silver", "jp-prop-car-black", "jp-prop-car-blue", "jp-prop-car-red"];
  const yard = (gx: number, gw: number, foot: number, top: number) => {
    // 건물 사이 빈터: 넓으면 주차장(아스팔트 3줄+블록담+차 한 대), 아니면 생울타리 두른 앞마당(+넓으면 가로수)
    const f = (x: number, y: number, w: number, h: number, material: string) => { if (w > 0 && h > 0) yardSteps.push({ tool: "fill_region", args: { mapId, rect: { x, y, w, h }, material }, optional: true }); };
    if (gw >= 6 && rng() < 0.55) {
      f(gx, foot - 2, gw, 3, "생활도로");
      f(gx, foot - 3, gw, 1, "블록담");
      yardSteps.push({ tool: "stamp_object", args: { objectId: `kit:jp_city/${pick(rng, carsYard)}`, mapId, x: gx + Math.floor((gw - 5) / 2), y: foot - 2 }, optional: true, note: "prop" });
    } else {
      f(gx, Math.max(top, foot - 4), gw, Math.min(4, foot - top), "잔디");
      f(gx, foot, gw, 1, "생울타리");
      if (gw >= 4 && foot - 6 >= top) yardSteps.push({ tool: "stamp_object", args: { objectId: `kit:jp_city/jp-prop-tree-${pick(rng, ["zelkova", "ginkgo", "sakura"])}`, mapId, x: gx + Math.floor((gw - 4) / 2), y: foot - 5 }, optional: true, note: "prop" });
    }
  };
  const nonShopFill = (sx: number, ex: number, b: Band, zone: JpBlockZone) => {
    const w = ex - sx, h = b.foot - b.top + 1;
    if (zone === "park") {
      fill(sx, b.top, w, h, "잔디", true);
      const px = sx + Math.floor(w / 2) - 1;
      fill(px, b.top + Math.floor(h / 2), 2, h - Math.floor(h / 2), "판석 광장", true);            // 입구 길(남쪽 보도로 이어짐)
      fill(sx, b.foot, px - sx, 1, "생울타리", true);
      fill(px + 2, b.foot, sx + w - px - 2, 1, "생울타리", true);
      if (w >= 12 && rng() < 0.6) fill(sx + 1 + Math.floor(rng() * 2), b.top + 2, 5, 3, "연못", true);
      const nTrees = 2 + Math.floor(rng() * 2);
      for (let t = 0; t < nTrees; t++) {
        const tx = sx + 1 + Math.floor(rng() * Math.max(1, w - 5));
        if (tx + 4 > px && tx < px + 2 + 1 && b.top + 1 + 6 > b.top + Math.floor(h / 2)) continue;
        stamp(`jp-prop-tree-${pick(rng, ["zelkova", "ginkgo", "sakura"])}`, tx, b.top + 1 + Math.floor(rng() * Math.max(1, h - 9)));
      }
      stamp("jp-prop-bench", px - 3, b.foot - 1);
      stamp("jp-prop-bench", px + 3, b.foot - 1);
    } else {
      const lotH = Math.min(h, 7);
      fill(sx, b.foot - lotH + 1, w, lotH, "생활도로", true);
      fill(sx, b.foot - lotH, w, 1, "블록담", true);
      let cx = sx + 1, first = true;
      while (cx + 5 <= sx + w) {
        if (first || rng() < 0.7) stamp(pick(rng, carsYard) + (rng() < 0.5 ? "-r" : ""), cx, b.foot - 2);
        first = false;
        cx += 6;
      }
    }
  };
  const wireAt = steps.length;                                  // 전선은 큰 건물·공원 칠 같은 구획 단계보다 먼저 찍는다
  bands.forEach((b, bi) => {
    const segs = segmentsAround(W, [...streets.filter((s) => bi >= s.from && bi <= s.to), ...(river ? [{ x: river.x - BANK, w: river.w + 2 * BANK }] : [])]);
    for (const [sx, ex] of segs) {
      const w = ex - sx;
      const r = rng();
      let zone: JpBlockZone = "shop";
      if (style === "residential") zone = r < 0.65 ? "house" : r < 0.85 && w >= 9 && w <= 26 ? "park" : "shop";
      else zone = r < 0.14 && w >= 7 ? "house" : r < 0.24 && w >= 9 && w <= 26 ? "park" : r < 0.32 && w >= 9 && w <= 22 ? "parking" : "shop";
      if (b.foot - b.top < 9 && zone === "park") zone = "shop";
      zones.push({ band: bi, sx, ex, zone });
      if (zone === "park" || zone === "parking") { nonShopFill(sx, ex, b, zone); continue; }
      if (zone === "house") fill(sx, b.top, w, b.foot - b.top + 1, "잔디", true);
      let packW = w, lmEnd = 0;
      if (zone === "shop" && w >= 18 && rng() < 0.4) {
        const hAvail = b.foot - b.top + 1;
        const fits = LANDMARKS.filter((l) => l.h <= hAvail && l.w + 8 <= w);
        const lm = fits.length ? pick(rng, fits) : undefined;
        if (lm) {
          const lx = rng() < 0.5 ? sx : ex - lm.w;
          stamp(lm.id, lx, b.foot - lm.h + 1);
          placed.push({ role: "landmark", x: lx, foot: b.foot, w: lm.w, top: b.top });
          packW = w - lm.w - 1; lmEnd = lx === sx ? lm.w + 1 : 0;
        }
      }
      const rolesHere = zone === "house" ? housePool : pool.slice(poolPtr).concat(pool.slice(0, poolPtr));
      const packed = packRow(rng, packW, rolesHere, true).map((p2) => ({ ...p2, x: p2.x + lmEnd }));
      if (zone === "shop") poolPtr += packed.length;
      let cur = lmEnd;
      for (const bb of packed) { if (bb.x - cur >= 2) yard(sx + cur, bb.x - cur, b.foot, b.top); cur = bb.x + bb.w; }
      const endLimit = lmEnd ? w : packW;
      if (endLimit - cur >= 2) yard(sx + cur, endLimit - cur, b.foot, b.top);
      for (const bb of packed) {
        placed.push({ role: bb.role, x: sx + bb.x, foot: b.foot, w: bb.w, top: b.top });
        // 같은 건물에 대한 후보 입력 12개(점점 단순) — 첫 성공을 쓴다(buildJpCityBuilding 이 거절하면 다음)
        for (let attempt = 0; attempt < 12; attempt++) {
          buildSteps.push({
            tool: "build_jp_city_building",
            args: { mapId, x: sx + bb.x, y: b.foot, ...randomBuildingArgs(rng, bb.role, bb.w, attempt, b.foot - b.top + 1) },
            optional: true, note: `try:${placed.length - 1}`,
          });
        }
      }
    }
  });
  // 맨 위 가장자리 생울타리 — 첫 띠 뒤가 지도 끝까지 열려 보이지 않게(세로 길 어귀는 비운다)
  for (const [sx, ex] of segmentsAround(W, [...streets.filter((s) => s.from === 0), ...(river ? [{ x: river.x - BANK, w: river.w + 2 * BANK }] : [])])) fill(sx, 0, ex - sx, 1, "생울타리", true);
  steps.push(...yardSteps, ...buildSteps);

  // ── 3. 큰길 표식: 외측선(교차로·횡단보도 칸 제외), 보행 신호등
  const skipX = (x: number, road: number) => crossings.some((c) => c.road === road && x >= c.x && x < c.x + 6) || streets.some((s) => x >= s.x && x < s.x + s.w);
  bands.forEach((b, i) => {
    if (!b.gap) return;
    for (let x = 0; x < W; x++) {
      if (skipX(x, i)) continue;
      stamp("jp-mark-edge-n", x, b.gap.road0, "road");
      stamp("jp-mark-edge-s", x, b.gap.road1, "road");
    }
  });
  for (const c of crossings) {
    const g = bands[c.road]!.gap!;
    stamp("jp-road-signal-ped", c.x - 1, g.road0 - 2);
    stamp("jp-road-signal-ped-green", c.x + 6, g.road1 + 1);
  }

  // ── 4. 보도 소품: 띠 아래 보도 바깥줄에 낮은 소품. 문 앞 접근칸(건물 발 바로 아래 줄)은 비운다.
  const props = ["jp-prop-vending-aka", "jp-prop-vending-sora", "jp-prop-vending-midori", "jp-prop-bike-sora", "jp-prop-bike-aka", "jp-prop-bike-midori", "jp-prop-planter", "jp-prop-pot", "jp-prop-bench", "jp-prop-post-box", "jp-prop-bike-rack", "jp-prop-a-frame", "jp-prop-garbage-net", "jp-prop-bollard"];
  const propH: Record<string, number> = { "jp-prop-vending-aka": 2, "jp-prop-vending-sora": 2, "jp-prop-vending-midori": 2, "jp-prop-bike-sora": 2, "jp-prop-bike-aka": 2, "jp-prop-bike-midori": 2, "jp-prop-planter": 1, "jp-prop-pot": 2, "jp-prop-bench": 1, "jp-prop-post-box": 2, "jp-prop-bike-rack": 1, "jp-prop-a-frame": 1, "jp-prop-garbage-net": 1, "jp-prop-bollard": 1 };
  const propW: Record<string, number> = { "jp-prop-vending-aka": 2, "jp-prop-vending-sora": 2, "jp-prop-vending-midori": 2, "jp-prop-bike-sora": 2, "jp-prop-bike-aka": 2, "jp-prop-bike-midori": 2, "jp-prop-planter": 2, "jp-prop-pot": 1, "jp-prop-bench": 2, "jp-prop-post-box": 1, "jp-prop-bike-rack": 2, "jp-prop-a-frame": 1, "jp-prop-garbage-net": 2, "jp-prop-bollard": 1 };
  const doorZone = (x: number, foot: number) => placed.some((b) => b.foot === foot && x >= b.x + b.w - 3 && x <= b.x + b.w);
  bands.forEach((b, bi) => {
    const rowY = b.foot + 2;
    let px = 1 + Math.floor(rng() * 3);
    while (px < W - 3) {
      const id = pick(rng, props);
      const w = propW[id] ?? 1, h = propH[id] ?? 1;
      if (!inStreet(px + w - 1, bi) && !inStreet(px, bi)) stamp(id, px, rowY - h + 1);
      px += w + 2 + Math.floor(rng() * 5);
    }
  });

  // ── 5. 차·노면: 큰길마다 일방통행 한 줄(중앙선 없음), 길 위 「30」 표시.
  const cars = ["jp-prop-car-white", "jp-prop-car-silver", "jp-prop-car-black", "jp-prop-car-red", "jp-prop-car-blue", "jp-prop-car-taxi", "jp-prop-car-green", "jp-prop-car-navy"];
  bands.forEach((b, bi) => {
    if (!b.gap) return;
    const eastbound = rng() < 0.5;
    const laneY = b.gap.road0 + (b.gap.roadW >= 4 ? 1 : 0);
    const spans: [number, number][] = crossings.filter((c) => c.road === bi).map((c) => [c.x - 1, c.x + 7] as [number, number]);
    for (const s of streets) spans.push([s.x - 1, s.x + s.w + 4]);
    const markX = 2 + Math.floor(rng() * Math.max(1, W - 12));
    if (!spans.some(([a, e]) => markX < e && markX + 4 > a)) {
      spans.push([markX - 1, markX + 5]);
      stamp(`jp-mark-30-${eastbound ? "e" : "w"}`, markX, laneY, "road");
    }
    const nCars = 1 + Math.floor(rng() * 3);
    for (let c = 0; c < nCars; c++) {
      const cx = 1 + Math.floor(rng() * Math.max(1, W - 7));
      if (spans.some(([a, e]) => cx < e && cx + 5 > a)) continue;
      spans.push([cx, cx + 5]);
      stamp(`${pick(rng, cars)}${eastbound ? "" : "-r"}`, cx, laneY);
    }
  });

  // ── 6. 가로등·전봇대/전선·곡면거울·정류장: 띠마다. 문 자리와 세로 길 어귀는 피한다.
  const poleXsByBand: number[][] = [];
  const wireSteps: JpStreetStep[] = [];
  bands.forEach((b, bi) => {
    let lx = 2 + Math.floor(rng() * 5);
    while (lx < W - 2) {
      let x = lx;
      while (x < W - 2 && (doorZone(x, b.foot) || inStreet(x, bi))) x++;
      if (x < W - 2) stamp("jp-prop-lamp-post", x, b.foot + 2 - 3);
      lx = x + 8 + Math.floor(rng() * 3);
    }
    const poleXs: number[] = [];
    if (bi === 0 || rng() < 0.5) {
      let pxs = 3 + Math.floor(rng() * 5);
      while (pxs < W - 4) {
        let x = pxs;
        while (x < W - 4 && (doorZone(x, b.foot) || doorZone(x + 1, b.foot) || inStreet(x, bi) || inStreet(x + 1, bi))) x++;
        if (x < W - 4) poleXs.push(x);
        pxs = x + 12 + Math.floor(rng() * 5);
      }
    }
    poleXs.forEach((x, i) => {
      stamp("jp-prop-utility-pole2", x, b.foot + 2 - 4);
      const nx = poleXs[i + 1];
      // 전선 키트는 아래층 칸을 비워 찍으므로 건물 위에 찍으면 1층 외벽을 지운다 → 건물보다 먼저(yardSteps 앞)에 찍고 건물이 아래층을 다시 덮게 한다.
      if (nx !== undefined && nx - (x + 2) >= 2 && nx - (x + 2) <= 17) wireSteps.push({ tool: "stamp_object", args: { objectId: `kit:jp_city/jp-wire-${nx - (x + 2) + 3}`, mapId, x: x + 2, y: b.foot + 2 - 4 }, optional: true, note: "prop" });
    });
    poleXsByBand.push(poleXs);
    for (const s of streets) if (bi >= s.from && bi <= s.to) stamp("jp-prop-curve-mirror", s.x + s.w, b.foot + 2 - 2);
    for (const id of bi === 0 ? ["jp-bus-stop", "jp-hydrant-sign"] : rng() < 0.4 ? ["jp-bus-stop"] : []) {
      for (let t = 0; t < 12; t++) {
        const x = 2 + Math.floor(rng() * (W - 4));
        if (doorZone(x, b.foot) || inStreet(x, bi) || poleXs.some((q) => x >= q - 1 && x <= q + 2)) continue;
        stamp(id, x, b.foot + 2 - 2);
        break;
      }
    }
  });
  for (const b of placed) {
    if ((b.role === "izakaya" || b.role === "ramen") && rng() < 0.7) stamp(`jp-prop-nobori-${pick(rng, ["aka", "sora", "midori"])}`, b.x + 1, b.foot + 2 - 2);
  }

  steps.splice(wireAt, 0, ...wireSteps);
  const zoneNames: Record<JpBlockZone, string> = { shop: "상가", house: "주택", park: "공원", parking: "주차장" };
  return {
    steps,
    buildings: placed,
    mapId, seed: opts.seed,
    walkRows: [...bands.flatMap((b) => (b.gap ? [b.foot + 2, b.gap.road0, b.gap.road0 + 1, b.gap.sw2] : [])), H - 2],
    summary: `${style === "residential" ? "주택가" : "상가 거리"} ${W}×${H} — 띠 ${N}줄(발 ${bands.map((b) => `y${b.foot}`).join("·")}), 큰길 ${N - 1}(폭 ${roadWs.join("·")}), 세로 길 ${streets.length}${river ? `, 하천 x${river.x}~${river.x + river.w - 1}` : ""}, 구획 ${zones.map((z) => zoneNames[z.zone]).join("·")}, 건물 ${placed.length}채(${placed.map((p) => p.role).join("·")})`,
  };
}

function segmentsAround(width: number, alleys: readonly { x: number; w: number }[]): [number, number][] {
  const segs: [number, number][] = [];
  let x = 0;
  for (const a of [...alleys].sort((p, q) => p.x - q.x)) { if (a.x - x >= 4) segs.push([x, a.x]); x = a.x + a.w; }
  if (width - x >= 4) segs.push([x, width]);
  return segs.length ? segs : [[0, width]];
}

/**
 * 계획을 실행한다. `call` 은 도구 하나를 부르고 실패하면 던진다(headless 는 runTool, 도구 안에서는 getTool().run).
 * build_jp_city_building 은 같은 건물의 후보(note try:N)를 순서대로 시도해 첫 성공에서 멈춘다. 선택 단계의 실패는 건너뛴다.
 */
export interface JpStreetBuiltBuilding extends JpStreetBuilding { readonly rect?: { x0: number; y0: number; w: number; h: number }; readonly doors: readonly { x: number; y: number }[] }

export function runJpStreetPlan(plan: JpStreetPlan, call: (tool: string, args: Record<string, unknown>) => { rect?: { x0: number; y0: number; w: number; h: number }; doors?: readonly { x: number; y: number }[] } | void): { built: number; skipped: number; props: number; buildings: JpStreetBuiltBuilding[] } {
  let built = 0, skipped = 0, props = 0;
  const buildings: JpStreetBuiltBuilding[] = [];
  const done = new Set<string>();
  for (const step of plan.steps) {
    const tryKey = step.note?.startsWith("try:") ? step.note : undefined;
    if (tryKey && done.has(tryKey)) continue;
    try {
      const result = call(step.tool, step.args);
      if (tryKey) {
        done.add(tryKey); built++;
        const b = plan.buildings[Number(tryKey.slice(4))];
        if (b) buildings.push({ ...b, ...(result?.rect ? { rect: result.rect } : {}), doors: result?.doors ?? [] });
      }
      else if (step.note === "prop") props++;
    } catch (error) {
      if (!step.optional) throw error;
      if (tryKey && !plan.steps.some((s2) => s2.note === tryKey && plan.steps.indexOf(s2) > plan.steps.indexOf(step))) skipped++;
    }
  }
  // 뒷담: 건물이 띠 꼭대기까지 닿지 않으면 지붕 위 한 줄에 블록담을 둘러 뒤가 허공처럼 비어 보이지 않게 한다(건물 뒤는 블록 안쪽 뒷마당).
  for (const b of buildings) {
    if (!b.rect || b.top === undefined) continue;
    const wy = b.rect.y0 - 1;
    if (wy - b.top >= 2) { try { call("fill_region", { mapId: plan.mapId, rect: { x: b.rect.x0, y: wy, w: b.rect.w, h: 1 }, material: "블록담" }); } catch { /* 건너뜀 */ } }
  }
  // 현관 꾸밈: 실제로 지어진 문 양옆 보도 칸에 종류별 소품(화분·우편함·입간판·자전거…). 문 바로 앞 접근칸은 비운다.
  const drng = mulberry((plan.seed ^ 0x51ed270b) >>> 0);
  for (const b of buildings) {
    if (!b.rect || !b.doors.length) continue;
    const pool = ENTRANCE_PROPS[b.role];
    if (!pool) continue;
    const xs = b.doors.map((d) => d.x), dy = b.doors[0]!.y;
    const left = Math.min(...xs) - 1, right = Math.max(...xs) + 1;
    const sides = [left, right].filter((x) => x >= b.rect!.x0 && x < b.rect!.x0 + b.rect!.w);
    for (const sx of sides) {
      if (drng() < 0.35) continue;
      const [id, pw, ph] = pool[Math.floor(drng() * pool.length)]!;
      const x = sx === left ? sx - pw + 1 : sx;
      if (x < b.rect.x0 || x + pw > b.rect.x0 + b.rect.w) continue;
      try { call("stamp_object", { objectId: `kit:jp_city/${id}`, mapId: plan.mapId, x, y: dy + 1 - ph + 1 }); props++; } catch { /* 자리가 막히면 건너뜀 */ }
    }
  }
  return { built, skipped, props, buildings };
}

const ROLE_KO: Readonly<Record<string, string>> = { konbini: "편의점", izakaya: "이자카야", ramen: "라멘집", cafe: "카페", shop: "상점", office: "사무소", garage: "차고", apartment: "아파트", machiya: "마치야", house: "주택", sento: "센토(목욕탕)", bento: "도시락집" };

/** 지어진 건물마다 이름 붙은 위치(로케이션)를 남긴다 — 어느 문이 어느 가게인지 조수(list_map_locations)가 읽고 실내를 맞게 잇는다. */
export function labelStreetBuildings(map: GameMap, buildings: readonly JpStreetBuiltBuilding[]): string[] {
  const lines: string[] = [];
  for (const b of buildings) {
    if (!b.rect) continue;
    const door = b.doors[0];
    const label = ROLE_KO[b.role] ?? b.role;
    const note = door ? `종류 ${b.role} · 문 (${door.x},${door.y}) · 문 앞 접근칸 (${door.x},${door.y + 1}) — 이 문에 ${label} 실내를 link_jp_city_interior 로 잇는다` : `종류 ${b.role}`;
    const added = addMapLocation(map, { name: `${label} 건물`, x: b.rect.x0, y: b.rect.y0, w: b.rect.w, h: b.rect.h, note, tags: ["jp-building", b.role] });
    if (added.ok) lines.push(`${label} 문 (${door ? `${door.x},${door.y}` : "?"})`);
  }
  return lines;
}

/** 기획 글에서 가게 낱말을 뽑아 거리에 꼭 넣을 가게 목록으로 — 한 번 나온 순서대로, 중복 없이. */
const SHOP_WORDS: readonly (readonly [string, RegExp])[] = [
  ["konbini", /편의점|コンビニ|convenience/iu], ["izakaya", /이자카야|술집|포장마차|선술|izakaya|bar\b/iu], ["ramen", /라멘|라면집|국수|ramen|noodle/iu],
  ["cafe", /카페|찻집|커피|킷사|다방|cafe|coffee|tea/iu], ["bento", /도시락|bento/iu], ["office", /사무|회사|오피스|office/iu],
  ["apartment", /아파트|맨션|apartment|mansion/iu], ["house", /주택|단독|집\b|house/iu], ["sento", /목욕|센토|sento/iu], ["garage", /주차|차고|garage/iu],
  ["shop", /서점|약국|꽃집|빵집|가게|상점|shop|store|bookstore|pharmacy|bakery/iu],
];
export function shopsFromText(text: string): string[] {
  return SHOP_WORDS.filter(([, re]) => re.test(text)).map(([role]) => role);
}
export function streetStyleFromText(text: string): JpStreetStyle {
  return /주택가|주택|골목집|동네 집|residential|suburb/iu.test(text) && !/상가|번화|shopping|arcade/iu.test(text) ? "residential" : "shopping";
}
