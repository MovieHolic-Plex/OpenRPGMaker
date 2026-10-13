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

export interface JpStreetBuilding { readonly role: string; readonly x: number; readonly foot: number; readonly w: number; /** 이 건물이 선 띠의 맨 윗줄(건물 위 뒷마당 채우기 한계) */ readonly top?: number; /** 일체형 정면 키트의 문 왼쪽 칸(절대 x) — 문 앞 접근칸 보호용 */ readonly doorX?: number }

function nodeEnvFlag(name: string): boolean {
  const value = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];
  return Boolean(value);
}

export interface JpStreetPlan {
  readonly steps: readonly JpStreetStep[];
  /** 계획한 건물(후보 `try:N` 의 N 번째). 실제로 지어진 것만 `runJpStreetPlan` 결과에 남는다. */
  readonly buildings: readonly JpStreetBuilding[];
  /** 놓기로 한 소품이 차지한 칸(겹침 정리 뒤) — 현관 소품이 피한다 */
  readonly propRects?: readonly { x: number; y: number; w: number; h: number }[];
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
  tower:     { grounds: ["gr.glass.sora", "gr.shutter.sora"], floorKinds: ["ribbon", "slide", "koushi", "curtain"], floors: [7, 13], walls: ["conc", "hodo", "shiro"], roofs: ROOFS_FLAT, heads: ["roofsign.aka"], width: [6, 9] },
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
  tower: ["lobby", "auto"], konbini: ["auto"], izakaya: ["noren", "lattice"], ramen: ["noren", "lattice", "cafe"], cafe: ["cafe", "lobby", "lattice"],
  shop: ["steel", "lobby", "lattice", "cafe"], office: ["lobby", "auto", "steel"], garage: ["rollup", "steel"], apartment: ["lobby", "steel", "auto", "house"],
  machiya: ["machiya", "lattice"], house: ["house", "lattice", "steel"], sento: ["lattice", "noren"], bento: ["cafe", "steel"],
};

/** 현관 앞 꾸밈: 문 양옆 보도 칸에 놓는 낮은 소품(종류별). id → [w,h]. 문 바로 앞 칸(접근칸)은 비운다. */
const ENTRANCE_PROPS: Readonly<Record<string, readonly (readonly [string, number, number])[]>> = {
  tower: [["jp-prop-planter", 2, 1], ["jp-prop-bollard", 1, 1]],
  house: [["jp-prop-pot", 1, 2], ["jp-prop-post-box", 1, 2], ["jp-pots", 2, 1], ["jp-prop-planter", 2, 1]],
  machiya: [["jp-prop-pot", 1, 2], ["jp-pots", 2, 1], ["jp-prop-stone-lantern", 1, 2]],
  apartment: [["jp-prop-post-box", 1, 2], ["jp-prop-bike-sora", 2, 2], ["jp-prop-bike-aka", 2, 2], ["jp-prop-planter", 2, 1]],
  office: [["jp-prop-planter", 2, 1], ["jp-prop-bollard", 1, 1], ["jp-prop-post-box", 1, 2]],
  konbini: [["jp-prop-bike-rack", 2, 1], ["jp-prop-vending-aka", 2, 2], ["jp-prop-a-frame", 1, 1]],
  cafe: [["jp-prop-a-frame", 1, 1], ["jp-prop-planter", 2, 1], ["jp-prop-pot", 1, 2]],
  izakaya: [["jp-prop-a-frame", 1, 1], ["jp-prop-pot", 1, 2], ["jp-prop-garbage-net", 2, 1]],
  ramen: [["jp-prop-a-frame", 1, 1], ["jp-prop-bike-rack", 2, 1], ["jp-prop-vending-sora", 2, 2]],
  shop: [["jp-prop-a-frame", 1, 1], ["jp-prop-planter", 2, 1], ["jp-prop-pot", 1, 2]],
  garage: [["jp-prop-cone", 1, 1], ["jp-prop-barricade3", 3, 1]],
  sento: [["jp-prop-pot", 1, 2], ["jp-prop-bench", 2, 1], ["jp-prop-stone-lantern", 1, 2]],
  bento: [["jp-prop-a-frame", 1, 1], ["jp-prop-bike-rack", 2, 1]],
};

/** 완성 큰 건물(문 위치를 몰라 이름표·실내 연결은 하지 않는다 — 풍경). 띠 높이에 맞는 것만 놓는다. */
const LANDMARKS: readonly { id: string; w: number; h: number }[] = [
  { id: "jp-bldg-mansion4", w: 11, h: 11 }, { id: "jp-bldg-zakkyo5", w: 7, h: 14 }, { id: "jp-bldg-office6", w: 9, h: 15 }, { id: "jp-bldg-mansion6-slim", w: 7, h: 15 }, { id: "jp-bldg-clinic", w: 9, h: 8 }, { id: "jp-bldg-post-office", w: 9, h: 8 }, { id: "jp-bldg-supermarket", w: 14, h: 6 }, { id: "jp-bldg-koban", w: 6, h: 6 },
];

/** 겹침 검사용 소품 칸 크기(w,h) — 키트 색인 tiledata/jp-city/kit-index.json 의 값. 모르는 id 는 검사하지 않는다. */
const PROP_SIZE: Readonly<Record<string, readonly [number, number]>> = {
  "jp-bus-stop": [1, 3], "jp-hydrant-sign": [1, 3], "jp-pots": [2, 1], "jp-prop-a-frame": [1, 1], "jp-prop-barricade3": [3, 1], "jp-prop-bench": [2, 1],
  "jp-prop-bike-aka": [2, 2], "jp-prop-bike-midori": [2, 2], "jp-prop-bike-rack": [2, 1], "jp-prop-bike-sora": [2, 2], "jp-prop-bollard": [1, 1], "jp-prop-cone": [1, 1],
  "jp-prop-curve-mirror": [1, 3], "jp-prop-garbage-net": [2, 1], "jp-prop-lamp-post": [1, 4], "jp-prop-lantern-post": [1, 3], "jp-prop-planter": [2, 1], "jp-prop-post-box": [1, 2],
  "jp-prop-pot": [1, 2], "jp-prop-stone-lantern": [1, 2], "jp-prop-utility-pole2": [2, 5], "jp-prop-vending-aka": [2, 2], "jp-prop-vending-midori": [2, 2], "jp-prop-vending-sora": [2, 2],
  "jp-prop-blade-sign-0": [1, 3], "jp-prop-blade-sign-1": [1, 3], "jp-prop-street-flag": [1, 3], "jp-prop-bike-cluster": [3, 1], "jp-prop-cat-sit": [1, 1], "jp-prop-cat-loaf": [1, 1], "jp-prop-neon-stack-0": [2, 8], "jp-prop-neon-stack-1": [2, 10], "jp-prop-neon-stack-2": [2, 6], "jp-prop-led-tower-0": [3, 8], "jp-prop-smoking-area": [2, 2], "jp-prop-vend-pair": [3, 2],
  "jp-prop-nobori-aka": [1, 2], "jp-prop-nobori-sora": [1, 2], "jp-prop-nobori-midori": [1, 2],
};

const SHOPPING_MIX = ["konbini", "izakaya", "ramen", "cafe", "shop", "office", "shop", "izakaya", "apartment", "bento", "cafe", "garage"];
const RESIDENTIAL_MIX = ["house", "house", "machiya", "apartment", "house", "garage", "house", "machiya", "sento", "house"];

/** 한 줄에 놓을 건물 칸 폭을 뽑는다 — 가게 폭 범위 안에서, 남는 폭이 다음 건물 최소(3)보다 작으면 마지막 건물을 늘린다. */
function packRow(rng: () => number, width: number, roles: readonly string[], gaps: boolean): { role: string; x: number; w: number }[] {
  const out: { role: string; x: number; w: number }[] = [];
  let x = gaps ? 1 + Math.floor(rng() * 2) : 0;
  let i = 0;
  while (x < width - 3) {
    let role = roles[i % roles.length]!;
    if (out.length && out[out.length - 1]!.role === role) { i++; role = roles[i % roles.length]!; }   // 같은 종류 연속 금지(쌍둥이 방지)
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

/** 일체형 1층 가게 정면(문 + 1층을 한 장으로 그린 키트 jp-sf-<종류>-<폭>-<L|R>, scripts/content/jp-city/blocks/shopfront_art.py)이 있는 종류. 차고는 셔터 문이라 조립기 그림을 그대로 쓴다. */
const SF_ROLES: ReadonlySet<string> = new Set(["tower", "konbini", "izakaya", "ramen", "cafe", "shop", "bento", "office", "apartment", "house", "machiya", "sento"]);
const SF_MIN_W = 3, SF_MAX_W = 9;
/** 키트의 문 왼쪽 칸(shopfront_art.door_col 과 같다). */
export function sfDoorCol(w: number, side: "L" | "R"): number {
  if (w <= 3) return side === "L" ? 0 : 1;
  return side === "L" ? 1 : w - 3;
}
export function sfKitId(role: string, w: number, side: "L" | "R"): string | undefined {
  return SF_ROLES.has(role) && w >= SF_MIN_W && w <= SF_MAX_W ? `jp-sf-${role === "tower" ? "office" : role}-${w}-${side}` : undefined;
}

/** 건물 한 채의 조립 입력을 뽑는다. `attempt` 가 늘수록 단순한 조합(층 수 ↓, 간판 없음)으로 물러난다. */
export function randomBuildingArgs(rng: () => number, role: string, w: number, attempt: number, rowsAvail = 99, side: "L" | "R" = rng() < 0.5 ? "L" : "R"): Record<string, unknown> {
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
    let type = pick(rng, doorPool);
    if (sfKitId(role, w, "L")) {                                   // 일체형 정면이 문 자리를 정한다(문 2칸, 왼쪽 또는 오른쪽) — 조립기 문은 밑그림일 뿐 곧 덮인다
      if (type === "machiya") type = "lattice";
      args.door = { type, col: sfDoorCol(w, side) };
    } else {
      const dw = type === "machiya" ? 3 : 2;
      const spots = [...new Set([n0(0), Math.floor((w - dw) / 2), w - dw])].filter((c) => c >= 0 && c <= w - dw);
      args.door = { type, col: pick(rng, spots) };
    }
  }
  if (role === "tower" && attempt < 6 && w >= 7 && rng() < 0.5) args.setback = { upper: Math.max(2, floors - 3), ins: 1 };   // 윗부분이 안으로 들어간 계단식 고층
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
  // 하천 띠: 큰길 하나를 하천으로 바꾼다(건물 문은 강변 산책로를 향한다). 3줄 지도는 마지막 큰길 60%, 2줄 지도는 40%. 3/4 시점에서 둑의 정면 벽이 보이도록 하천은 가로로 흐른다.
  const riverGap = N >= 3 ? (rng() < 0.6 ? N - 2 : -1) : (W >= 40 && rng() < 0.4 ? 0 : -1);
  const riverW = 4 + Math.floor(rng() * 2);
  const roadWs = Array.from({ length: N - 1 }, (_, i) => (i === riverGap ? 0 : style === "residential" ? 3 : i === 0 && rng() < 0.7 ? 4 : rng() < 0.3 ? 4 : 3));
  const gapRows = roadWs.reduce<number>((a2, w2, i) => a2 + (i === riverGap ? 11 + riverW : w2 + 4), 0);
  const bandTotal = H - 2 - gapRows;                               // 건물 띠들이 쓸 줄 수(마지막 띠 발은 H-3, 아래 보도 2줄)
  const base = Math.floor(bandTotal / N);
  const heights = Array.from({ length: N }, () => base);
  heights[0] = Math.max(11, base + Math.floor(rng() * 4) - 1);
  const skyline = H >= 52 && style === "shopping" && rng() < 0.75;                // 고층 스카이라인: 맵이 높으면 뒷줄 띠를 높여 10층 안팎 빌딩이 서게 한다
  if (skyline) heights[0] = Math.max(heights[0]!, Math.floor(bandTotal * 0.62));
  if (riverGap >= 0) heights[0] = Math.max(9, Math.min(heights[0]!, bandTotal - (skyline ? 9 : 11) * (N - 1)));
  for (let i = 1; i < N; i++) heights[i] = Math.max(9, Math.floor((bandTotal - heights[0]!) / (N - 1)));
  interface Gap { sw1: number; road0: number; road1: number; sw2: number; roadW: number; river?: { rail: number; wall0: number; water0: number; water1: number; slope: number; mid: number; slope2: number; prom0: number }; end: number }
  interface Band { top: number; foot: number; gap?: Gap }
  const bands: Band[] = [];
  let cy = 0;
  for (let i = 0; i < N; i++) {
    const top = cy, foot = i === N - 1 ? H - 3 : top + heights[i]! - 1;
    const band: Band = { top, foot };
    if (i < N - 1) {
      if (i === riverGap) {
        const rv = { rail: foot + 3, wall0: foot + 4, water0: foot + 7, water1: foot + 6 + riverW, slope: foot + 7 + riverW, mid: foot + 8 + riverW, slope2: foot + 9 + riverW, prom0: foot + 10 + riverW };
        band.gap = { sw1: foot + 1, road0: foot + 3, road1: rv.water1, sw2: rv.prom0, roadW: 0, river: rv, end: rv.prom0 + 1 };
      } else {
        const roadW = roadWs[i]!;
        const road0 = foot + 3;
        band.gap = { sw1: foot + 1, road0, road1: road0 + roadW - 1, sw2: road0 + roadW, roadW, end: road0 + roadW + 1 };
      }
      cy = band.gap.end + 1;
    }
    bands.push(band);
  }
  // 하천 건너편 띠: 건물 키가 지붕 위를 다 못 채우므로 띠 윗부분은 강변 공원(잔디+판석 길)으로 쓰고 건물 띠는 낮춘다.
  let riverPark: { y0: number; y1: number } | undefined;
  if (riverGap >= 0 && bands[riverGap + 1]) {
    const sb = bands[riverGap + 1]!, rvp = bands[riverGap]!.gap!.river!;
    const newTop = Math.max(sb.top, sb.foot - 9);
    if (newTop - (rvp.prom0 + 2) >= 2) { riverPark = { y0: rvp.prom0 + 2, y1: newTop - 1 }; sb.top = newTop; }
  }
  const ground = style === "residential" ? "잔디" : "자갈 참배길";
  fill(0, 0, W, H, ground);
  for (const b of bands) if (b.gap) {
    const g = b.gap;
    if (g.river) {
      const rv = g.river;
      fill(0, g.sw1, W, 2, "판석 광장");                                 // 강변 산책로(위, 건물 문 앞)
      fill(0, rv.water0, W, riverW, "수로");                              // 물(둑 정면 벽 2줄 아래로 내려앉은 수면)
      fill(0, rv.slope, W, 3, "판석 광장");                                    // 건너편 풀 비탈
      fill(0, rv.prom0, W, 2, "판석 광장");                              // 건너편 산책로
      if (style !== "residential") {
        const nf = bands[bands.indexOf(b) + 1]?.foot ?? H - 3;
        fill(0, rv.prom0 + 2, W, Math.max(0, nf - rv.prom0 - 1), "판석 광장");
        if (riverPark) {                                       // 강변 공원: 잔디밭 + 산책로에서 건물 띠로 내려가는 판석 길
          fill(0, riverPark.y0, W, riverPark.y1 - riverPark.y0 + 1, "잔디");
          for (let px = 6 + Math.floor(rng() * 6); px < W - 3; px += 12 + Math.floor(rng() * 6)) fill(px, riverPark.y0, 2, riverPark.y1 - riverPark.y0 + 1, "판석 광장");
        }
      }   // 강변 남쪽 광장: 자갈 노이즈 대신 판석
    } else {
      fill(0, g.sw1, W, 2, "보도 연석");
      fill(0, g.road0, W, g.roadW, "생활도로");
      fill(0, g.road1 + 1, W, 2, "보도 연석");
    }
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
  // 하천을 건너는 세로 길이 하나는 있어야 한다(다리).
  if (riverGap >= 0 && !streets.some((s2) => s2.from <= riverGap && s2.to > riverGap)) {
    if (streets[0]) streets[0] = { ...streets[0]!, lane: 3, w: 5, from: 0, to: N - 1 };
    else { const lane = 3; streets.push({ x: 6 + Math.floor(rng() * Math.max(1, W - 14 - lane)), lane, w: lane + 2, from: 0, to: N - 1 }); }
  }
  const inStreet = (x: number, k?: number) => streets.some((s2) => x >= s2.x - 1 && x <= s2.x + s2.w && (k === undefined || (k >= s2.from && k <= s2.to)));
  for (const s2 of streets) {
    let segStart = s2.from === 0 ? 0 : bands[s2.from - 1]!.gap!.end - (bands[s2.from - 1]!.gap!.river ? 1 : 1);
    for (let k = s2.from; k <= s2.to; k++) {
      const crossRiver = k < s2.to && bands[k]!.gap!.river !== undefined;
      if (crossRiver) continue;                                      // 하천을 건너 다음 띠까지 한 번에 깐다(다리)
      const y1 = k === s2.to ? (k === N - 1 ? H - 1 : bands[k]!.gap!.road0 - 1) : bands[k]!.gap!.road0 - 1;
      fill(s2.x, segStart, 1, y1 - segStart + 1, "보도 연석", true);
      fill(s2.x + s2.w - 1, segStart, 1, y1 - segStart + 1, "보도 연석", true);
      fill(s2.x + 1, segStart, s2.lane, y1 - segStart + 1, "생활도로", true);
      for (let y = segStart; y <= y1; y += 2) {                      // 중앙 점선: 가로길·하천 구간은 비운다
        if (bands.some((bb) => bb.gap && y >= bb.gap.sw1 - 1 && y <= bb.gap.end)) continue;
        stamp(s2.lane % 2 === 0 ? "jp-mark-center-v-l" : "jp-mark-center-v", s2.x + 1 + Math.floor(s2.lane / 2), y, "road");
      }
      if (k < N - 1) segStart = bands[k]!.gap!.end - 1;
    }
  }
  const riverTrees: { band: number; x: number; y: number }[] = [];
  // 둑 정면 벽(물 위 2줄)과 다리 난간, 물가 계단·벚나무 — 길이 지나는 칸은 비운다(길 상판이 둑을 덮는다).
  bands.forEach((b) => {
    const g = b.gap;
    if (!g?.river) return;
    const rv = g.river;
    // 둑: 갓돌 + 돌 쌓기 정면 석축(1×4칸 키트, rail~wall0+2 줄) · 둑 밑 물 그늘 · 건너편 둑 가장자리 — 길이 지나는 칸은 비운다(상판이 둑을 덮는다).
    for (let x = 0; x < W; x++) {
      if (streets.some((s2) => x >= s2.x && x < s2.x + s2.w && s2.from <= bands.indexOf(b) && s2.to > bands.indexOf(b))) continue;   // 하천을 건너는 길만 둑을 비운다
      stamp("jp-river-wall", x, rv.rail, "bank");
      stamp("jp-water-shade", x, rv.water0, "bank");
      stamp("jp-water-rim-s", x, rv.water1, "bank");
      stamp("jp-bank-lip", x, rv.slope, "bank");
      stamp("jp-bank-mid", x, rv.mid, "bank");
      stamp("jp-bank-slope", x, rv.slope2, "bank");
    }
    // 다리: 거리 상판이 그대로 이어지고 양옆에 석재 난간(기둥머리), 상판 밑 양옆 물은 어둡게.
    for (const s2 of streets) if (s2.from <= bands.indexOf(b) && s2.to > bands.indexOf(b)) {
      for (let x = s2.x + 1; x < s2.x + s2.w - 1; x++) for (let y = rv.rail; y <= rv.slope2; y++) {
        if (y < rv.water0 || y >= rv.slope) continue;                 // 둑 벽면 구간은 아스팔트가 그대로 이어진다(벽을 널로 덮지 않음)
        stamp(y === rv.water0 ? "jp-bridge-lip" : y === rv.water1 ? "jp-bridge-pier" : "jp-bridge-plank", x, y, "bridge");
      }   // 목재 널 상판(거리 아스팔트와 구분)
      for (let y = rv.rail; y <= rv.slope2; y++) {
        const post = y === rv.rail || y === rv.slope2 || ((y - rv.rail) % 3 === 0 && rv.slope2 - y >= 2);
        stamp(post ? "jp-bridge-post" : "jp-bridge-rail-v", s2.x, y, "bridge");
        stamp(post ? "jp-bridge-post" : "jp-bridge-rail-v", s2.x + s2.w - 1, y, "bridge");
      }
      for (let cx = s2.x + 1; cx < s2.x + 1 + s2.lane; cx++) {          // 다리 어귀 횡단보도
        stamp("jp-crosswalk-v", cx, rv.rail - 2, "road");
        stamp("jp-crosswalk-v", cx, rv.prom0, "road");
      }
      for (let y = rv.water0 + 1; y < rv.water1; y++) {
        if (s2.x - 1 >= 0) stamp("jp-water-dark", s2.x - 1, y, "bridge");
        if (s2.x + s2.w < W) stamp("jp-water-dark-r", s2.x + s2.w, y, "bridge");
      }
    }
    for (let dx = 4 + Math.floor(rng() * 5); dx < W - 1; dx += 8 + Math.floor(rng() * 7)) {         // 둑 벽 배수구
      if (streets.some((s2) => dx >= s2.x - 1 && dx <= s2.x + s2.w)) continue;
      stamp("jp-wall-drain", dx, rv.wall0 + 1, "bank");
    }
    for (let gx = 2 + Math.floor(rng() * 4); gx < W - 1; gx += 2 + Math.floor(rng() * 3)) {   // 수면 반짝임(물무늬 반복 깨기)
      if (streets.some((s2) => gx >= s2.x - 1 && gx <= s2.x + s2.w)) continue;
      stamp(rng() < 0.5 ? "jp-water-streak" : "jp-water-glint", gx, rv.water0 + 1 + Math.floor(rng() * Math.max(1, riverW - 2)), "bank");
    }
    const free = (x: number, w: number) => !streets.some((s2) => x < s2.x + s2.w + 1 && x + w > s2.x - 1);
    for (let tx = 2 + Math.floor(rng() * 6); tx + 4 < W; tx += 11 + Math.floor(rng() * 5)) if (free(tx, 4)) riverTrees.push({ band: bands.indexOf(b), x: tx, y: rv.prom0 });   // 벚나무는 구획이 정해진 뒤 건물과 안 겹치는 것만 심는다
    // 강변 소품: 건너편 산책로의 벤치·가로등·자전거, 북쪽 산책로 둑가의 가로등. 다리 어귀(상판 양끝)에 가로등 쌍.
    for (let px = 3 + Math.floor(rng() * 4); px + 3 < W; px += 7 + Math.floor(rng() * 5)) {
      if (!free(px, 3) || riverTrees.some((t) => px + 3 > t.x - 1 && px < t.x + 5)) continue;
      stamp(pick(rng, ["jp-prop-bench", "jp-prop-bike-rack", "jp-prop-planter", "jp-prop-bench"]), px + 1, rv.prom0 + 1, "bank");
    }
    for (let px = 6 + Math.floor(rng() * 4); px + 2 < W; px += 12 + Math.floor(rng() * 4)) if (free(px, 2) && !riverTrees.some((t) => px + 2 > t.x - 1 && px < t.x + 5)) stamp("jp-prop-lamp-post", px, rv.prom0 + 1 - 1, "bank");
    for (let lx = 4 + Math.floor(rng() * 3); lx + 1 < W; lx += 6 + Math.floor(rng() * 3)) {
      if (!free(lx, 1) || riverTrees.some((t) => lx + 1 > t.x - 1 && lx < t.x + 5)) continue;
      stamp("jp-prop-stone-lantern", lx, rv.prom0 + 1 - 1, "bank");                  // 건너편 산책로 돌등롱
      if (rng() < 0.5) stamp("jp-prop-lantern-post", lx + 3, rv.rail - 2, "bank");   // 북쪽 산책로 초롱 기둥
    }
    for (const s2 of streets) if (s2.from <= bands.indexOf(b) && s2.to > bands.indexOf(b)) {
      stamp("jp-prop-lamp-post", s2.x - 1, rv.rail - 3, "bridge");
      stamp("jp-prop-lamp-post", s2.x + s2.w, rv.prom0 + 1 - 1, "bridge");
    }
  });
  const obstacles: { x: number; w: number }[] = streets.map((s2) => ({ x: s2.x, w: s2.w }));
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
  const placed: JpStreetBuilding[] = [];
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
    const segs = segmentsAround(W, [...streets.filter((s) => bi >= s.from && bi <= s.to), ...riverTrees.filter((t) => t.band + 1 === bi).map((t) => ({ x: t.x - 1, w: 6 }))]);
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
      let rolesHere = zone === "house" ? housePool : pool.slice(poolPtr).concat(pool.slice(0, poolPtr));
      if (zone === "shop" && b.foot - b.top + 1 >= 16 && style === "shopping") {            // 키 큰 띠: 고층 빌딩을 사이사이에 섞는다(셋 건너 하나 정도)
        rolesHere = rolesHere.flatMap((r, i) => (i % 3 === 0 ? ["tower", r] : [r]));
      }
      const packed = packRow(rng, packW, rolesHere, true).map((p2) => ({ ...p2, x: p2.x + lmEnd }));
      if (zone === "shop") poolPtr += packed.length;
      let cur = lmEnd;
      for (const bb of packed) { if (bb.x - cur >= 2) yard(sx + cur, bb.x - cur, b.foot, b.top); cur = bb.x + bb.w; }
      const endLimit = lmEnd ? w : packW;
      if (endLimit - cur >= 2) yard(sx + cur, endLimit - cur, b.foot, b.top);
      for (const bb of packed) {
        const side: "L" | "R" = rng() < 0.5 ? "L" : "R";
        const doorX = sfKitId(bb.role, bb.w, side) ? sx + bb.x + sfDoorCol(bb.w, side) : undefined;
        placed.push({ role: bb.role, x: sx + bb.x, foot: b.foot, w: bb.w, top: b.top, ...(doorX !== undefined ? { doorX } : {}) });
        for (let fx = 0; fx < bb.w; fx++) if (doorX === undefined || sx + bb.x + fx < doorX || sx + bb.x + fx > doorX + 1) stamp("jp-foot-shadow", sx + bb.x + fx, b.foot + 1, "ground");   // 접지 그림자(건물이 뜨지 않게)
        // 같은 건물에 대한 후보 입력 12개(점점 단순) — 첫 성공을 쓴다(buildJpCityBuilding 이 거절하면 다음)
        for (let attempt = 0; attempt < 12; attempt++) {
          buildSteps.push({
            tool: "build_jp_city_building",
            args: { mapId, x: sx + bb.x, y: b.foot, ...randomBuildingArgs(rng, bb.role, bb.w, attempt, b.foot - b.top + 1, side) },
            optional: true, note: `try:${placed.length - 1}`,
          });
        }
      }
    }
  });
  // 맨 위 가장자리 생울타리 — 첫 띠 뒤가 지도 끝까지 열려 보이지 않게(세로 길 어귀는 비운다)
  for (const [sx, ex] of segmentsAround(W, streets.filter((s) => s.from === 0))) fill(sx, 0, ex - sx, 1, "생울타리", true);
  steps.push(...yardSteps, ...buildSteps);

  // ── 3. 큰길 표식: 외측선(교차로·횡단보도 칸 제외), 보행 신호등
  const skipX = (x: number, road: number) => crossings.some((c) => c.road === road && x >= c.x && x < c.x + 6) || streets.some((s) => x >= s.x && x < s.x + s.w);
  bands.forEach((b, i) => {
    if (!b.gap || b.gap.river) return;
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
  const doorZone = (x: number, foot: number) => placed.some((b) => b.foot === foot && (b.doorX !== undefined ? x >= b.doorX - 1 && x <= b.doorX + 2 : x >= b.x + b.w - 3 && x <= b.x + b.w));
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
    if (!b.gap || b.gap.river) return;
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
  // 키 큰 소품(가로등·전봇대·입간판)은 건물 칸 위에 서면 외벽·문을 가린다 → 건물이 서지 않은 열(골목·빈터·세로 길 어귀)에만 둔다.
  const clearCols = (x: number, w: number, foot: number) => !placed.some((pb) => pb.foot === foot && x < pb.x + pb.w && x + w > pb.x);
  const inStreetAny = (x: number) => streets.some((s2) => x >= s2.x - 1 && x <= s2.x + s2.w);
  const poleXsByBand: number[][] = [];
  const wireSteps: JpStreetStep[] = [];
  bands.forEach((b, bi) => {
    let lx = 2 + Math.floor(rng() * 5);
    while (lx < W - 2) {
      let x = lx;
      while (x < W - 2 && (doorZone(x, b.foot) || inStreet(x, bi) || !clearCols(x, 2, b.foot))) x++;
      if (x < W - 2) stamp("jp-prop-lamp-post", x, b.foot + 2 - 3);
      lx = x + 8 + Math.floor(rng() * 3);
    }
    const poleXs: number[] = [];
    if (bi === 0 || rng() < 0.5) {
      let pxs = 3 + Math.floor(rng() * 5);
      while (pxs < W - 4) {
        let x = pxs;
        while (x < W - 4 && (doorZone(x, b.foot) || doorZone(x + 1, b.foot) || inStreet(x, bi) || inStreet(x + 1, bi) || !clearCols(x, 2, b.foot))) x++;
        if (x < W - 4) poleXs.push(x);
        pxs = x + 12 + Math.floor(rng() * 5);
      }
    }
    poleXs.forEach((x, i) => {
      stamp("jp-prop-utility-pole2", x, b.foot + 2 - 4);
      const nx = poleXs[i + 1];
      // 전선 키트는 아래층 칸을 비워 찍으므로 건물 위에 찍으면 1층 외벽을 지운다 → 건물보다 먼저(yardSteps 앞)에 찍고 건물이 아래층을 다시 덮게 한다.
      const covered = (() => { let n = 0; for (let q = x + 2; q < nx! ; q++) if (placed.some((pb) => pb.foot === b.foot && q >= pb.x && q < pb.x + pb.w)) n++; return nx === undefined ? 0 : n / Math.max(1, nx - x - 2); })();
      if (nx !== undefined && covered >= 0.9 && nx - (x + 2) >= 2 && nx - (x + 2) <= 17) wireSteps.push({ tool: "stamp_object", args: { objectId: `kit:jp_city/jp-wire-${nx - (x + 2) + 3}`, mapId, x: x + 2, y: b.foot + 2 - 4 }, optional: true, note: "prop" });
    });
    poleXsByBand.push(poleXs);
    for (const s of streets) if (bi >= s.from && bi <= s.to) stamp("jp-prop-curve-mirror", s.x + s.w, b.foot + 2 - 2);
    for (const id of bi === 0 ? ["jp-bus-stop", "jp-hydrant-sign"] : rng() < 0.4 ? ["jp-bus-stop"] : []) {
      for (let t = 0; t < 12; t++) {
        const x = 2 + Math.floor(rng() * (W - 4));
        if (doorZone(x, b.foot) || inStreet(x, bi) || !clearCols(x, 2, b.foot) || poleXs.some((q) => x >= q - 1 && x <= q + 2)) continue;
        stamp(id, x, b.foot + 2 - 2);
        break;
      }
    }
  });
  // 일본 거리 분위기 소품(2026-10-13): 간판·네온 기둥·자전거 떼·고양이·깃발. 건물 벽 바로 옆 빈 열(골목·빈터)에만 붙여 세우고(공중에 뜨지 않게), 나무·공원 칸과 겹치면 겹침 정리가 뺀다.
  const nearWall = (b: Band, w: number, fn: (x: number, side: "L" | "R") => void, n: number) => {
    const cands = placed.filter((pb) => pb.foot === b.foot && pb.role !== "landmark");
    for (let t = 0, k = 0; t < 30 && k < n && cands.length; t++) {
      const pb = cands[Math.floor(rng() * cands.length)]!;
      const side: "L" | "R" = rng() < 0.5 ? "L" : "R";
      const x = side === "L" ? pb.x - w : pb.x + pb.w;
      if (x < 1 || x + w > W - 1 || inStreetAny(x) || inStreetAny(x + w - 1) || !clearCols(x, w, b.foot) || riverTrees.some((tr) => x < tr.x + 5 && x + w > tr.x - 1)) continue;
      fn(x, side); k++;
    }
  };
  bands.forEach((b) => {
    const tall = b.foot - b.top + 1 >= 16;
    if (style === "shopping") {
      nearWall(b, 2, (x) => stamp(pick(rng, ["jp-prop-neon-stack-0", "jp-prop-neon-stack-1", "jp-prop-neon-stack-2"]), x, b.foot + 1 - 7), tall ? 2 : 1);
      nearWall(b, 1, (x) => stamp(pick(rng, ["jp-prop-blade-sign-0", "jp-prop-blade-sign-1", "jp-prop-street-flag"]), x, b.foot - 1), 2);
    }
    nearWall(b, 3, (x) => stamp("jp-prop-bike-cluster", x, b.foot + 1), 2);
    nearWall(b, 1, (x) => stamp(pick(rng, ["jp-prop-cat-sit", "jp-prop-cat-loaf"]), x, b.foot + 1), 1);
  });
  for (const b of placed) {
    if ((b.role === "izakaya" || b.role === "ramen") && rng() < 0.7) {
      const nx = [b.x - 1, b.x + b.w].find((cx) => cx >= 0 && cx < W - 1 && clearCols(cx, 1, b.foot) && !inStreetAny(cx));   // 문·외벽을 가리지 않게 건물 바로 옆 빈 열에
      if (nx !== undefined) stamp(`jp-prop-nobori-${pick(rng, ["aka", "sora", "midori"])}`, nx, b.foot + 2 - 2);
    }
  }

  steps.splice(wireAt, 0, ...wireSteps);
  for (const t of riverTrees) {                                   // 하천 건너편 벚나무: 아래 띠의 건물·큰 건물과 안 겹치는 자리에만
    const nb = bands[t.band + 1];
    if (!nb) continue;
    stamp(`jp-prop-tree-${rng() < 0.6 ? "sakura" : "zelkova"}`, t.x, t.y, "bank");
  }
  const propRectsOut: { x: number; y: number; w: number; h: number }[] = [];
  // 겹침 정리: 키 큰 소품·보도 소품이 건물 1층 칸(발 위 3줄) 위에 서거나 다른 소품과 같은 칸을 쓰면 뒤에 놓은 것을 뺀다 — 「건물과 가로등이 겹쳐 문·외벽을 가린다」 방지.
  {
    const rects = placed.map((pb) => {
      const lm = pb.role === "landmark" ? LANDMARKS.find((l) => l.w === pb.w) : undefined;
      return { x: pb.x, y: pb.foot - (lm ? lm.h - 1 : 2), w: pb.w, h: lm ? lm.h : 3 };
    });
    const hit = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    const claimed: { x: number; y: number; w: number; h: number }[] = [];
    for (let i = 0; i < steps.length; i++) {
      const st = steps[i]!;
      if (st.tool !== "stamp_object" || st.note !== "prop") continue;
      const id = String(st.args.objectId ?? "").replace("kit:jp_city/", "");
      const sz = PROP_SIZE[id];
      if (!sz) continue;
      const r = { x: Number(st.args.x), y: Number(st.args.y), w: sz[0], h: sz[1] };
      if (rects.some((b2) => hit(r, b2)) || claimed.some((b2) => hit(r, b2))) { steps.splice(i, 1); i--; continue; }
      claimed.push(r);
    }
    propRectsOut.push(...claimed);
  }
  const zoneNames: Record<JpBlockZone, string> = { shop: "상가", house: "주택", park: "공원", parking: "주차장" };
  return {
    steps,
    buildings: placed,
    propRects: propRectsOut,
    mapId, seed: opts.seed,
    walkRows: [...bands.flatMap((b) => (b.gap ? (b.gap.river ? [b.foot + 2, b.gap.sw2] : [b.foot + 2, b.gap.road0, b.gap.road0 + 1, b.gap.sw2]) : [])), H - 2],
    summary: `${style === "residential" ? "주택가" : "상가 거리"} ${W}×${H} — 띠 ${N}줄(발 ${bands.map((b) => `y${b.foot}`).join("·")}), 큰길 ${N - 1}(폭 ${roadWs.join("·")}), 세로 길 ${streets.length}${riverGap >= 0 ? ", 하천(가로)" : ""}, 구획 ${zones.map((z) => zoneNames[z.zone]).join("·")}, 건물 ${placed.length}채(${placed.map((p) => p.role).join("·")})`,
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
  // 일체형 1층: 조립기가 그린 1층 3줄(문 포함)을 비우고 문과 한 장으로 그린 가게 정면 키트를 찍는다.
  for (const b of buildings) {
    if (!b.rect || !b.doors.length) continue;
    const door = b.doors[0]!;
    const dc = door.x - b.rect.x0;
    const side: "L" | "R" | undefined = dc === sfDoorCol(b.rect.w, "L") ? "L" : dc === sfDoorCol(b.rect.w, "R") ? "R" : undefined;
    const kit = side ? sfKitId(b.role, b.rect.w, side) : undefined;
    if (!kit) continue;
    const foot = b.rect.y0 + b.rect.h - 1;
    const clear = Array.from({ length: 3 }, () => Array.from({ length: b.rect!.w }, () => -2));
    try {
      call("stamp_layer_block", { mapId: plan.mapId, x: b.rect.x0, y: foot - 2, layers: { "3": clear, "4": clear }, reshape: false });
      call("stamp_object", { objectId: `kit:jp_city/${kit}`, mapId: plan.mapId, x: b.rect.x0, y: foot - 2 });
      props++;
    } catch (e) { if (nodeEnvFlag("SFDBG")) console.error("sf fail", kit, String((e as Error).message).slice(0, 200)); }
  }
  // 뒷담: 건물이 띠 꼭대기까지 닿지 않으면 지붕 위 한 줄에 블록담을 둘러 뒤가 허공처럼 비어 보이지 않게 한다(건물 뒤는 블록 안쪽 뒷마당).
  for (const b of buildings) {
    if (!b.rect || b.top === undefined) continue;
    const wy = b.rect.y0 - 1;
    if (wy - b.top >= 2) { try { call("fill_region", { mapId: plan.mapId, rect: { x: b.rect.x0, y: wy, w: b.rect.w, h: 1 }, material: "블록담" }); } catch { /* 건너뜀 */ } }
  }
  // 현관 꾸밈: 실제로 지어진 문 양옆 보도 칸에 종류별 소품(화분·우편함·입간판·자전거…). 문 바로 앞 접근칸은 비운다.
  const taken: { x: number; y: number; w: number; h: number }[] = [...(plan.propRects ?? [])];
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
      const low = pool.filter((q) => q[2] === 1);                   // 건물 칸(발 줄)을 덮지 않게 보도 첫 줄(발 바로 아래)에 한 줄짜리만
      if (!low.length) continue;
      const [id, pw] = low[Math.floor(drng() * low.length)]!;
      const x = sx === left ? sx - pw + 1 : sx;
      if (x < b.rect.x0 || x + pw > b.rect.x0 + b.rect.w) continue;
      const r = { x, y: dy + 1, w: pw, h: 1 };
      if (taken.some((t) => r.x < t.x + t.w && r.x + r.w > t.x && r.y < t.y + t.h && r.y + r.h > t.y)) continue;
      try { call("stamp_object", { objectId: `kit:jp_city/${id}`, mapId: plan.mapId, x, y: dy + 1 }); props++; taken.push(r); } catch { /* 자리가 막히면 건너뜀 */ }
    }
  }
  return { built, skipped, props, buildings };
}

const ROLE_KO: Readonly<Record<string, string>> = { tower: "고층 빌딩", konbini: "편의점", izakaya: "이자카야", ramen: "라멘집", cafe: "카페", shop: "상점", office: "사무소", garage: "차고", apartment: "아파트", machiya: "마치야", house: "주택", sento: "센토(목욕탕)", bento: "도시락집" };

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
