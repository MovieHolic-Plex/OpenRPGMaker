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

import { addMapLocation, COMPOSED_LAYOUT_TAG } from "@/project/mapNamedLocations";
import type { GameMap } from "@/project/types";
import { EDGE_MATERIAL_AUTOTILE, fillLotUses, stampEdgeRect, type LotUsePlaced, type LotUseView } from "@/project/jpCityLotUse";
import { arcadeGateKit, arcadeRoofKit, FLAVOR_ARCADE, FLAVOR_BUS_STOP, FLAVOR_HOKORA, FLAVOR_KITS, FLAVOR_KO, FLAVOR_POLE, FLAVOR_POSTBOX, FLAVOR_ROAD, FLAVOR_ROOF_ROWS, FLAVOR_ROOFS, FLAVOR_SIDEWALK, flavorFromText, flavorRoofKit, GND, type JpStreetFlavor } from "@/project/jpShitamachiStreet";

/** shopping·residential = 기본 상가·주택가. shitamachi·shotengai = 상가 거리 위에 시타마치 골목·쇼텐가이 키트와 따뜻한 바닥을 얹은 변형. */
export type JpStreetStyle = "shopping" | "residential" | JpStreetFlavor;

export interface JpStreetShop {
  /** 가게 종류. konbini · izakaya · ramen · cafe · shop · office · garage · machiya · apartment · house · sento · bento */
  readonly role: string;
}

export interface JpStreetStep { readonly tool: string; readonly args: Record<string, unknown>; readonly optional?: boolean; readonly note?: string }

export interface JpStreetBuilding { readonly role: string; readonly x: number; readonly foot: number; readonly w: number; /** 이 건물이 선 띠의 맨 윗줄(건물 위 뒷마당 채우기 한계) */ readonly top?: number; /** 완성 큰 건물(landmark)의 칸 높이 — 겹침 정리가 정확한 발자국으로 쓴다 */ readonly h?: number; /** 일체형 정면 키트의 문 왼쪽 칸(절대 x) — 문 앞 접근칸 보호용 */ readonly doorX?: number }

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
  /** 공원 구획 사각형(잔디·판석 입구·연못·나무) — 조수 도구가 그 뒤쪽 잔디에 공원 숲(paintJpForestArea grove)을 칠한다. */
  readonly parks?: readonly { x: number; y: number; w: number; h: number }[];
  readonly summary: string;
  readonly mapId: string;
  readonly seed: number;
  readonly style?: JpStreetStyle;
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

// roof.stair.plain 은 조립 건물 3/4 관문 불합격(2026-10-13, 판정자 4/4 정면 입면도) → 쓰지 않는다
const ROOFS_FLAT = ["roof.plain.plain", "roof.plain.tank", "roof.ac.plain", "roof.ac.tank", "roof.ac.cyl", "roof.stair.tank"];
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

/** 변형 거리 건물 띠(위→아래): 뒷줄 건물(높이 5+2×층) · 뒷골목 1~2줄 · 앞줄 가게(띠 14줄+ 은 7줄 = 변형 키트 h≤6 + 1층 가게, 가끔 9줄 2층 가게).
 *  뒷줄 발은 앞줄 꼭대기 바로 위 골목 위다 — 둘 사이에 빈 판이 생기지 않게 앞줄 높이를 정하고 뒷줄 층 수를 남는 줄에 맞춘다(2026-10-18 적대 QA: 6~7줄 빈 판). */
const REAR_ALLEY_ROWS = 2;
const FRONT_ROWS = 7;
const REAR_ROW_MIN_BAND = 5 + 1 + 5;
/** 뒷줄 건물 종류 — 이웃끼리 겹치지 않게 돌린다(같은 집 정면이 줄줄이 찍히던 문제, 2026-10-18 적대 QA). */
const REAR_ROLES = ["house", "izakaya", "machiya", "shop", "cafe", "apartment", "bento", "sento", "ramen", "garage", "konbini", "office"] as const;

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
  { id: "jp-bldg-mansion4", w: 11, h: 11 }, { id: "jp-bldg-zakkyo5", w: 7, h: 14 }, { id: "jp-bldg-office6", w: 9, h: 15 }, { id: "jp-bldg-mansion6-slim", w: 7, h: 15 }, { id: "jp-bldg-clinic", w: 9, h: 8 }, { id: "jp-bldg-post-office", w: 9, h: 8 }, { id: "jp-bldg-supermarket", w: 14, h: 6 }, { id: "jp-bldg-koban", w: 6, h: 7 },
];

/** 겹침 검사용 소품 칸 크기(w,h) — 키트 색인 tiledata/jp-city/kit-index.json 의 값. 모르는 id 는 검사하지 않는다. */
const PROP_SIZE: Readonly<Record<string, readonly [number, number]>> = {
  "jp-bus-stop": [1, 3], "jp-hydrant-sign": [1, 3], "jp-pots": [2, 1], "jp-prop-a-frame": [1, 1], "jp-prop-barricade3": [3, 1], "jp-prop-bench": [2, 1],
  "jp-prop-bike-aka": [2, 2], "jp-prop-bike-midori": [2, 2], "jp-prop-bike-rack": [2, 1], "jp-prop-bike-sora": [2, 2], "jp-prop-bollard": [1, 1], "jp-prop-cone": [1, 1],
  "jp-prop-curve-mirror": [1, 3], "jp-prop-garbage-net": [2, 1], "jp-prop-lamp-post": [1, 4], "jp-prop-lantern-post": [1, 3], "jp-prop-planter": [2, 1], "jp-prop-post-box": [1, 2],
  "jp-prop-pot": [1, 2], "jp-prop-stone-lantern": [1, 2], "jp-prop-utility-pole2": [2, 5], "jp-prop-vending-aka": [2, 2], "jp-prop-vending-midori": [2, 2], "jp-prop-vending-sora": [2, 2],
  "jp-prop-blade-sign-0": [1, 3], "jp-prop-blade-sign-1": [1, 3], "jp-prop-street-flag": [1, 3], "jp-prop-bike-cluster": [3, 1], "jp-prop-cat-sit": [1, 1], "jp-prop-cat-loaf": [1, 1], "jp-prop-neon-stack-0": [2, 8], "jp-prop-neon-stack-1": [2, 10], "jp-prop-neon-stack-2": [2, 6], "jp-prop-led-tower-0": [3, 8], "jp-prop-smoking-area": [2, 2], "jp-prop-vend-pair": [3, 2],
  "jp-prop-nobori-aka": [1, 2], "jp-prop-nobori-sora": [1, 2], "jp-prop-nobori-midori": [1, 2], "jp-hokora-jizo": [2, 2],
  "jp-prop-tree-zelkova": [4, 6], "jp-prop-tree-ginkgo": [4, 6], "jp-prop-tree-sakura": [4, 6], "jp-road-signal-ped": [1, 2], "jp-road-signal-ped-green": [1, 2],
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
export function randomBuildingArgs(rng: () => number, role: string, w: number, attempt: number, rowsAvail = 99, side: "L" | "R" = rng() < 0.5 ? "L" : "R", allowHead = true): Record<string, unknown> {
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
  // 옥상 간판 띠: 키 큰(3층+)·폭 6칸+ 건물에만, 블록당 하나(allowHead) — 낮은 지붕 위 빈 판이 허공에 뜬 차양처럼 보이던 문제(2026-10-13 조화 QA). 노랑 판은 글자 대비가 약해 쓰지 않는다.
  // (난수는 예전과 같은 횟수만 쓴다 — 조건이 안 맞아도 굴려서, 같은 씨앗의 거리 배치가 바뀌지 않게)
  const headsOk = (look.heads ?? []).filter((h) => h !== "roofsign.kii");
  if (look.heads && attempt < 4 && rng() < 0.45) {
    const head = pick(rng, look.heads);
    if (allowHead && floors >= 3 && w >= 6 && headsOk.length) { args.head = head === "roofsign.kii" ? headsOk[0]! : head; delete args.roof; }
  }
  // 외벽 부착물: 가게 종류의 간판·배관·실외기·비상계단. 충돌하면 조립기가 거절하고(DECO_CLASH) 뒤 후보는 부착물을 뺀다.
  if (attempt < 6) {
    const decos: Record<string, unknown>[] = [];
    const lastCol = Math.max(0, w - 1);
    if (args.head) {                                               // 옥상 간판 띠에는 글자를 얹는다 — 빈 판이 아니라 간판으로 읽히게
      const word = args.head === "roofsign.aka" && role === "izakaya" ? ["izakaya", 3] as const : role === "ramen" ? ["ramen", 4] as const : w % 2 ? ["karaoke", 4] as const : ["pachinko", 4] as const;
      decos.push({ deco: `rtext.${word[0]}`, col: Math.max(1, Math.floor((w - word[1]) / 2)), floor: "head" });
    }
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
  /** 동서 큰길 횡단보도 덧그림 칸(흰 줄이 동서로 나란한 투명 칸). 주면 변형 골목 횡단보도를 2층에 이것으로 칠한다 — 없으면 옛 세로 줄 jp-gnd-zebra. */
  readonly crosswalkTile?: number;
}

export type JpBlockZone = "shop" | "house" | "park" | "parking";

/** 거리 계획 — 도로망(가로 큰길 + 세로 골목) → 블록 구획 → 구획 용도(상가·주택·공원·주차장) → 대지(건물·빈터) → 소품 순서의 도구 호출 목록. */
export function planJpCityStreet(opts: ComposeOptions): JpStreetPlan {
  const { mapId, width: W, height: H } = opts;
  const rng = mulberry((opts.seed ^ 0x9e3779b1) >>> 0);
  const rng2 = mulberry((opts.seed ^ 0x2545f491) >>> 0);          // 새로 더한 꾸밈(뒷마당 나무·반대편 보도 소품)은 별도 난수 — 같은 씨앗에서 기존 배치가 밀리지 않게
  const flavor: JpStreetFlavor | undefined = opts.style === "shitamachi" || opts.style === "shotengai" ? opts.style : undefined;
  const style: "shopping" | "residential" = opts.style === "residential" ? "residential" : "shopping";   // 변형은 상가 거리 짜임을 그대로 쓴다
  const rng3 = mulberry((opts.seed ^ 0x7f4a7c15) >>> 0);          // 변형 전용 난수 — 기본 거리의 난수 순서를 건드리지 않는다
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
  // 변형: 맨 뒷줄 띠를 「뒷줄 집 + 뒷골목 + 앞줄 가게」가 들어갈 만큼 키운다(아래 띠는 단층·2층 가게 9줄+ 만 남긴다).
  // (2026-10-18 사용자 반려: 건물 뒤 빈 땅을 지붕 조각 더미로 덮은 「지붕 바다」는 컨테이너 더미처럼 읽혔다 — 뒤는 진짜 집 한 줄과 골목이어야 한다.)
  if (flavor && riverGap < 0 && !skyline) {
    // 아래 띠는 1층 가게·변형 키트(h 5~6)가 꽉 채우는 7줄로 줄이고(9줄이면 키트 위 3~4줄이 빈 판), 남는 줄은 맨 뒷줄 띠의 뒷줄 건물 층으로 간다.
    heights[0] = Math.max(heights[0]!, Math.min(9 + REAR_ALLEY_ROWS + FRONT_ROWS + 2, bandTotal - 7 * (N - 1)));
    for (let i = 1; i < N; i++) heights[i] = Math.max(7, Math.floor((bandTotal - heights[0]!) / (N - 1)));
  }
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
  // 한 지도에 대지 바닥은 하나(조화 QA 2026-10-13): 잔디를 띠 전체에 깔면 채도 높은 초록 한 판이 보라 회색 팔레트와 싸우고 구획마다 바닥이 바뀐다. 잔디는 담·생울타리로 둘러싼 앞마당 줄에만.
  const ground = "자갈 참배길";
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
        if (riverPark && !flavor) {                            // 강변 공원: 잔디밭 + 산책로에서 건물 띠로 내려가는 판석 길(변형 거리는 판석 그대로 — 초록 띠 금지)
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
  // 변형 바닥: 기본 재료를 깐 뒤 그 위를 콘크리트 판석 보도·따뜻한 아스팔트로 다시 깐다(optional — 굽지 않은 칩셋이면 기본 바닥이 남는다).
  if (flavor) {
    for (const b of bands) if (b.gap && !b.gap.river) {
      fill(0, b.gap.sw1, W, 2, FLAVOR_SIDEWALK, true);
      fill(0, b.gap.road0, W, b.gap.roadW, FLAVOR_ROAD, true);
      fill(0, b.gap.road1 + 1, W, 2, FLAVOR_SIDEWALK, true);
    }
    fill(0, H - 2, W, 2, FLAVOR_SIDEWALK, true);
  }

  // 세로 길: 0~2 개. 폭 2~3 + 양옆 보도 1칸. 전 구간을 지나거나(사거리) 일부 띠에서만 큰길에 붙는다(T자). 서로 14칸 이상 떨어뜨린다.
  /** arcade: 쇼텐가이 보행자 시장 길(차로 대신 비 가림 아케이드 지붕 + 어귀 간판 아치). 하천을 건너는 길은 다리가 필요해 그대로 둔다. */
  interface VStreet { x: number; lane: number; w: number; from: number; to: number; arcade?: boolean }
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
  // 2026-10-18 사용자 반려 「대문통 이거 맞냐? 손님들 비 맞는 거 방지하는 그런거잖아」: 쇼텐가이의 세로 길은 차가 다니는 길이 아니라 지붕 덮인 시장 길이다.
  if (flavor === "shotengai") for (const s2 of streets) s2.arcade = FLAVOR_ARCADE.widths.includes(s2.w) && !(riverGap >= 0 && s2.from <= riverGap && s2.to > riverGap);
  const inStreet = (x: number, k?: number) => streets.some((s2) => x >= s2.x - 1 && x <= s2.x + s2.w && (k === undefined || (k >= s2.from && k <= s2.to)));
  const vSegs: { s: VStreet; y0: number; y1: number; k: number }[] = [];
  for (const s2 of streets) {
    let segStart = s2.from === 0 ? 0 : bands[s2.from - 1]!.gap!.end - (bands[s2.from - 1]!.gap!.river ? 1 : 1);
    for (let k = s2.from; k <= s2.to; k++) {
      const crossRiver = k < s2.to && bands[k]!.gap!.river !== undefined;
      if (crossRiver) continue;                                      // 하천을 건너 다음 띠까지 한 번에 깐다(다리)
      const y1 = k === s2.to ? (k === N - 1 ? H - 1 : bands[k]!.gap!.road0 - 1) : bands[k]!.gap!.road0 - 1;
      vSegs.push({ s: s2, y0: segStart, y1, k });
      if (s2.arcade) {                                               // 시장 길: 판석 바닥(지붕 키트가 띠 구간을 타일 통로로 덮는다), 차로 표시 없음
        fill(s2.x, segStart, s2.w, y1 - segStart + 1, FLAVOR_SIDEWALK, true);
        if (k < N - 1) segStart = bands[k]!.gap!.end - 1;
        continue;
      }
      fill(s2.x, segStart, 1, y1 - segStart + 1, "보도 연석", true);
      fill(s2.x + s2.w - 1, segStart, 1, y1 - segStart + 1, "보도 연석", true);
      fill(s2.x + 1, segStart, s2.lane, y1 - segStart + 1, "생활도로", true);
      if (flavor) {
        fill(s2.x, segStart, 1, y1 - segStart + 1, FLAVOR_SIDEWALK, true);
        fill(s2.x + s2.w - 1, segStart, 1, y1 - segStart + 1, FLAVOR_SIDEWALK, true);
        fill(s2.x + 1, segStart, s2.lane, y1 - segStart + 1, FLAVOR_ROAD, true);
      }
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
      if (rng() < 0.5) stamp("jp-prop-lantern-post", lx + 3, rv.rail - 3, "bank");   // 북쪽 산책로 초롱 기둥
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
      if (flavor) {                                                   // 변형: 따뜻한 아스팔트 위 4칸 폭 줄무늬(얼음색 키트 대신)
        // 동서 길이라 흰 줄이 차 진행 방향(동서)과 나란해야 한다 — 옛 jp-gnd-zebra 는 세로 줄이라 방향이 틀렸다(2026-10-25 J44).
        if (opts.crosswalkTile !== undefined && opts.crosswalkTile >= 0) {
          const cells: { x: number; y: number }[] = [];
          for (let cx = x + 1; cx < x + 5; cx++) for (let y = b.gap.road0; y <= b.gap.road1; y++) cells.push({ x: cx, y });
          steps.push({ tool: "paint_tiles", args: { mapId, layer: "2", mode: "cells", tile: opts.crosswalkTile, cells }, optional: true, note: "road" });
        } else for (let cx = x + 1; cx < x + 5; cx++) for (let y = b.gap.road0; y <= b.gap.road1; y++) stamp(GND.zebra, cx, y, "road");
      } else stamp("jp-road-lane-crosswalk-h", x, b.gap.road0, "road");
      break;
    }
  });
  // 변형 노면(1칸 바닥 키트, 아래층): 연석(세로 길 모퉁이 포함)·路側帯 흰 선·맨홀·빗물받이·금 간 아스팔트·황토 벽돌 — 큰길 건널목과 세로 길 차로는 비운다.
  if (flavor) {
    /** 띠 k 를 지나는 세로 길의 칸 쓰임: 왼쪽 보도 "e"(오른쪽이 길)·오른쪽 보도 "w"·차로 "lane". 아케이드 시장 길은 보도라 큰길 연석이 끊기지 않고 이어진다. */
    const streetCell = (x: number, k: number): "e" | "w" | "lane" | undefined => {
      const s = streets.find((s2) => !s2.arcade && x >= s2.x && x < s2.x + s2.w && k >= s2.from && k <= s2.to);
      return !s ? undefined : x === s.x ? "e" : x === s.x + s.w - 1 ? "w" : "lane";
    };
    const crossing = (x: number, road: number) => crossings.some((c) => c.road === road && x >= c.x && x < c.x + 6);
    const brick = (x: number, y: number) => { if (rng3() < 0.14) stamp(rng3() < 0.6 ? GND.ochre : GND.stain, x, y, "ground"); };
    bands.forEach((b, bi) => {
      const g = b.gap;
      if (!g || g.river) return;
      const manholes = new Set<number>();
      for (let x = 3 + Math.floor(rng3() * 6); x < W - 1; x += 9 + Math.floor(rng3() * 5)) if (!inStreet(x) && !crossing(x, bi)) { stamp(GND.manhole, x, g.road0 + Math.floor(g.roadW / 2), "ground"); manholes.add(x); }
      for (let x = 0; x < W; x++) {
        const north = streetCell(x, bi), south = streetCell(x, bi + 1);
        if (north !== "lane") stamp(north === "e" ? GND.curbSE : north === "w" ? GND.curbSW : GND.curbS, x, g.sw1 + 1, "ground");
        if (south !== "lane") stamp(south === "e" ? GND.curbNE : south === "w" ? GND.curbNW : GND.curbN, x, g.sw2, "ground");
        if (!north) brick(x, g.sw1);
        if (!south) brick(x, g.sw2 + 1);
        if (inStreet(x) || crossing(x, bi)) continue;
        stamp(x % 7 === 3 ? GND.drain : GND.lineN, x, g.road0, "ground");
        if (g.roadW >= 2) stamp(GND.lineS, x, g.road1, "ground");
        if (!manholes.has(x) && g.roadW >= 3 && rng3() < 0.06) stamp(GND.crack, x, g.road0 + 1 + Math.floor(rng3() * (g.roadW - 2)), "ground");
      }
    });
    for (let x = 0; x < W; x++) if (!inStreet(x)) { brick(x, H - 2); brick(x, H - 1); }
    // 세로 길 양옆 보도의 연석(큰길에 닿는 모퉁이 줄은 위에서 찍었다).
    for (const seg of vSegs) if (!seg.s.arcade) for (let y = seg.y0; y <= seg.y1; y++) {
      if (bands.some((bb) => bb.gap && !bb.gap.river && (y === bb.gap.sw1 + 1 || y === bb.gap.sw2))) continue;
      if (bands.some((bb) => bb.gap?.river && y >= bb.gap.sw1 && y <= bb.gap.end)) continue;
      stamp(GND.curbE, seg.s.x, y, "ground");
      stamp(GND.curbW, seg.s.x + seg.s.w - 1, y, "ground");
    }
  }
  /** 변형 접지 그림자(빛 왼쪽 위 → 그림자 오른쪽 아래 45°): 띠마다 이어 붙은 건물 폭을 한 덩어리로 합쳐 두 줄로 드리운다 — 발 아래 보도 줄(왼쪽 끝 사선 시작), 그 아래 연석 줄은 한 칸 오른쪽으로 밀린다.
   *  (2026-10-18 적대 QA: 건물마다 따로 찍어 이웃 건물 사이에 밝은 삼각 틈이 생겼고, 그림자가 보도 한 줄에서 끊겼다.) */
  const shadeSpans: { x: number; w: number; foot: number }[] = [];
  const flavorShade = (x: number, w: number, foot: number) => { shadeSpans.push({ x, w, foot }); };
  const emitShade = () => {
    const byFoot = new Map<number, { x: number; w: number }[]>();
    for (const s of shadeSpans) byFoot.set(s.foot, [...(byFoot.get(s.foot) ?? []), s]);
    for (const [foot, list] of byFoot) {
      list.sort((a, b2) => a.x - b2.x);
      const runs: { x: number; e: number }[] = [];
      for (const s of list) { const last = runs[runs.length - 1]; if (last && s.x <= last.e) last.e = Math.max(last.e, s.x + s.w); else runs.push({ x: s.x, e: s.x + s.w }); }
      const band = bands.find((bb) => bb.foot === foot);
      const curbRow = band?.gap && !band.gap.river;                   // 아래가 도로면 둘째 줄은 연석, 지도 맨 아래 보도면 벽돌
      for (const r of runs) {
        stamp(GND.shadeL, r.x, foot + 1, "ground");
        for (let x = r.x + 1; x < r.e; x++) stamp(GND.shade, x, foot + 1, "ground");
        if (r.e < W) stamp(GND.shadeR, r.e, foot + 1, "ground");
        if (foot + 2 >= H) continue;
        const sh = (id: string, x: number) => { if (x < W && !inStreet(x)) stamp(id, x, foot + 2, "ground"); };
        sh(curbRow ? GND.curbShadeL : GND.shadeL, r.x + 1);
        for (let x = r.x + 2; x <= r.e; x++) sh(curbRow ? GND.curbShade : GND.shade, x);
        sh(curbRow ? GND.curbShadeR : GND.shadeR, r.e + 1);
      }
    }
  };
  const flavorUsed = new Set<string>();                               // 이 지도에 이미 세운 변형 키트 — 다음 구획은 안 쓴 키트부터(좁은 구획에서 큰 키트가 늘 밀리지 않게)

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
  // 변형 띠의 뒷줄 건물(참고 그림 A·B: 큰길 가게 바로 뒤에 좁은 골목을 두고 키·지붕·정면이 제각각인 건물이 붙어 선다).
  const alleySteps: JpStreetStep[] = [];
  let rearAny = false;
  const rearRow = (sx: number, ex: number, top: number, foot: number, floors: number) => {
    rearAny = true;
    let prevRole = "", prevRoof = "";
    for (let x = sx; ex - x >= 4;) {
      const roles = REAR_ROLES.filter((r2) => r2 !== prevRole && !(prevRole === "house" && r2 === "machiya") && !(prevRole === "machiya" && r2 === "house"));
      const role = pick(rng3, roles);
      const look = LOOKS[role] ?? LOOKS.shop!;
      const lo = Math.max(4, Math.min(7, look.width[0])), hi = Math.max(lo, Math.min(7, look.width[1]));
      let hw = lo + Math.floor(rng3() * (hi - lo + 1));
      const rest = ex - x - hw;
      if (rest < 4) hw = ex - x <= SF_MAX_W ? ex - x : ex - x - 4;    // 끝에 4칸 미만이 남으면 마지막 건물이 끝까지(정면 키트 폭 안에서), 아니면 4칸을 남긴다
      const side: "L" | "R" = rng3() < 0.5 ? "L" : "R";
      placed.push({ role, x, foot, w: hw, top });
      let roof = "";
      for (let attempt = 0; attempt < 6; attempt++) {
        const args = randomBuildingArgs(rng3, role, hw, attempt, 99, side, false);
        args.floors = attempt < 4 ? floors : Math.max(0, floors - 1);
        if (args.roof === prevRoof) args.roof = pick(rng3, look.roofs.filter((r2) => r2 !== prevRoof).concat(look.roofs.length > 1 ? [] : look.roofs));
        if (attempt === 0) roof = String(args.roof);
        alleySteps.push({ tool: "build_jp_city_building", args: { mapId, x, y: foot, ...args }, optional: true, note: `try:${placed.length - 1}` });
      }
      prevRole = role; prevRoof = roof;
      x += hw;
    }
  };
  const carsYard = ["jp-prop-car-white", "jp-prop-car-silver", "jp-prop-car-black", "jp-prop-car-blue", "jp-prop-car-red"];
  // 건물 사이 빈터(yard)는 구성이 다 정해진 뒤(가로등·전봇대 자리 확정 뒤)에 칠한다 — 기둥이 선 빈터는 잔디를 걷어 낸다(기둥 머리가 풀밭 위에 뜨던 문제).
  interface YardDesc { gx: number; gw: number; foot: number; top: number; paver: boolean; parking: boolean; car: string; tree: string; noLawn: boolean }
  const yardDescs: YardDesc[] = [];
  // 변형(시타마치·쇼텐가이) 거리에는 초록 띠가 없다 — 2026-10-18 사용자 「초록색 띠 저거 뭐냐. 저거 제거해라」. 생울타리 대신 콘크리트 블록담, 잔디 앞마당 없음.
  const hedge = flavor ? "블록담" : "생울타리";
  const yard = (gx: number, gw: number, foot: number, top: number, paver = false) => {
    const parking = gw >= 6 && rng() < 0.55;                     // (난수 사용 순서는 예전과 같다: 주차장이면 차, 아니고 나무가 설 만하면 나무)
    const car = parking ? pick(rng, carsYard) : carsYard[0]!;
    const tree = !parking && gw >= 4 && foot - 6 >= top ? `jp-prop-tree-${pick(rng, ["zelkova", "ginkgo", "sakura"])}` : "jp-prop-tree-zelkova";
    yardDescs.push({ gx, gw, foot, top, paver, parking, car, tree, noLawn: false });
  };
  const emitYards = () => {
    for (const y of yardDescs) {
      const { gx, gw, foot, top } = y;
      const f = (x: number, yy: number, w: number, h: number, material: string) => { if (w > 0 && h > 0) yardSteps.push({ tool: "fill_region", args: { mapId, rect: { x, y: yy, w, h }, material }, optional: true }); };
      const put = (id: string, x: number, yy: number) => yardSteps.push({ tool: "stamp_object", args: { objectId: `kit:jp_city/${id}`, mapId, x, y: yy }, optional: true, note: "prop" });
      if (y.parking) {                                          // 넓으면 주차장(아스팔트 3줄+블록담+차 한 대)
        f(gx, foot - 2, gw, 3, "생활도로");
        f(gx, foot - 3, gw, 1, "블록담");
        put(y.car, gx + Math.floor((gw - 5) / 2), foot - 2);
      } else if (y.paver) {                                     // 판석 광장 띠: 잔디 대신 광장 꾸밈(나무 + 벤치/화분/돌등롱) — 판석 위 풀 조각이 스티커처럼 붙던 문제
        f(gx, foot, gw, 1, hedge);
        if (gw >= 4 && foot - 6 >= top) put(y.tree, gx + Math.floor((gw - 4) / 2), foot - 5);
        if (gw >= 4) put(gx % 2 ? "jp-prop-bench" : "jp-prop-planter", gx + (gw >= 7 ? 1 : Math.floor((gw - 2) / 2)), foot - 1);
        if (gw >= 7) put("jp-prop-stone-lantern", gx + gw - 2, foot - 2);
      } else if (gw >= 4 && foot - 6 >= top && !y.noLawn && !flavor) {             // 앞마당: 폭 4+ 이고 나무가 설 만한 빈터만 — 위는 블록담, 아래는 생울타리로 경계 지은 잔디 줄 + 가로수
        const rows = Math.min(4, foot - top);
        f(gx, Math.max(top, foot - 4), gw, rows, "잔디");
        if (foot - 5 >= top) f(gx, foot - 5, gw, 1, "블록담");
        f(gx, foot, gw, 1, "생울타리");
        put(y.tree, gx + Math.floor((gw - 4) / 2), foot - 5);
      } else {                                                  // 좁은 틈·기둥 선 틈·변형 거리: 대지 그대로 + 경계 한 줄(잔디 조각을 남기지 않는다)
        f(gx, foot, gw, 1, hedge);
      }
    }
  };
  const parkRects: { x: number; y: number; w: number; h: number }[] = [];
  const nonShopFill = (sx: number, ex: number, b: Band, zone: JpBlockZone) => {
    const w = ex - sx, h = b.foot - b.top + 1;
    if (zone === "park") {
      parkRects.push({ x: sx, y: b.top, w, h });
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
    const paverBand = riverGap >= 0 && bi === riverGap + 1 && style !== "residential";
    const segs = segmentsAround(W, [...streets.filter((s) => bi >= s.from && bi <= s.to), ...riverTrees.filter((t) => t.band + 1 === bi).map((t) => ({ x: t.x - 1, w: 6 }))]);
    for (const [sx, ex] of segs) {
      const w = ex - sx;
      const r = rng();
      let zone: JpBlockZone = "shop";
      if (style === "residential") zone = r < 0.65 ? "house" : r < 0.85 && w >= 9 && w <= 26 ? "park" : "shop";
      else zone = r < 0.14 && w >= 7 ? "house" : r < 0.24 && w >= 9 && w <= 26 ? "park" : r < 0.32 && w >= 9 && w <= 22 ? "parking" : "shop";
      if (flavor && zone !== "house") zone = "shop";                      // 변형: 공원·평면 주차장 대신 키트 줄(코인 주차장 키트가 주차장을 맡는다)
      if (b.foot - b.top < 9 && zone === "park") zone = "shop";
      zones.push({ band: bi, sx, ex, zone });
      if (zone === "park" || zone === "parking") { nonShopFill(sx, ex, b, zone); continue; }
      // 변형 건물 띠: 위에서부터 뒷줄 건물(골목을 향한 문) · 뒷골목 1~2줄 · 앞줄 가게. 하천 건너편 띠(강변 공원)는 뒷줄 없이 앞줄이 띠를 채운다.
      // 띠 높이 R 별 앞줄·골목: 14+ → 7·2(가끔 2층 가게 9·2), 13 → 6·2, 12 → 5·2, 11 → 5·1. 뒷줄은 남는 줄(5+2×층)이고 남는 홀수 한 줄은 뒷줄 지붕 위.
      const R = b.foot - b.top + 1;
      const canRear = !!flavor && !(riverGap >= 0 && bi === riverGap + 1) && R >= REAR_ROW_MIN_BAND && w >= 4;
      const alleyRows = R >= 12 ? REAR_ALLEY_ROWS : 1;
      const baseFront = R >= 14 ? FRONT_ROWS : R >= 13 ? 6 : 5;
      const tallFront = canRear && R - alleyRows - (baseFront + 2) >= 5 && rng3() < 0.3;   // 가끔 키트 없이 2층 가게 줄(뒷줄은 그만큼 낮아진다)
      const fRows = canRear ? (tallFront ? baseFront + 2 : baseFront) : R;
      const fTop = b.foot - fRows + 1;                                 // 앞줄 건물이 쓸 맨 윗줄 — 그 위 골목 줄 바로 위가 뒷줄 건물 발
      const rear = canRear ? { foot: fTop - alleyRows - 1, floors: Math.min(4, Math.floor((fTop - alleyRows - b.top - 5) / 2)) } : undefined;
      if (flavor) {
        fill(sx, b.top, w, R, rear ? FLAVOR_ROAD : FLAVOR_SIDEWALK, true);   // 건물 뒤 땅: 뒷골목은 아스팔트, 큰길 남쪽 띠는 앞 보도 벽돌이 이어진다(회색 자갈 금지)
        if (rear) {
          const rearTop = rear.foot - (4 + 2 * rear.floors);
          if (bi === 0 && rearTop > b.top) fill(sx, b.top, w, 1, hedge, true);   // 뒷줄 지붕 위 남는 한 줄: 지도 끝 담
          rearRow(sx, ex, b.top, rear.foot, rear.floors);
        }
      }
      if (bi === 0 && w >= 8 && !rear) {                              // 맨 뒷줄 뒷마당: 건물이 닿지 않는 지붕 위 빈 대지에 가로수를 드문드문(건물 칸은 나중에 덮는다) — 자갈 한 판이 비어 보이지 않게
        for (let tx = sx + 1 + Math.floor(rng2() * 4); tx + 4 <= ex; tx += 6 + Math.floor(rng2() * 5)) {
          if (rng2() < 0.75) yardSteps.push({ tool: "stamp_object", args: { objectId: `kit:jp_city/jp-prop-tree-${pick(rng2, ["zelkova", "ginkgo", "sakura"])}`, mapId, x: tx, y: b.top + 1 + Math.floor(rng2() * 2) }, optional: true, note: "prop" });
        }
      }
      if (zone === "house" && b.foot - b.top >= 6 && !rear) fill(sx, b.top, w, 1, "블록담", true);          // 주택 구획: 잔디를 통으로 깔지 않고 뒷담만(대지는 자갈 그대로)
      let packW = w, lmEnd = 0;
      if (flavor && zone === "shop") {
        // 변형 키트 줄: 구획 왼쪽부터 빈틈 없이 붙여 세우고(폭의 55% 까지), 나머지는 문 있는 조립 건물.
        const hAvail = tallFront ? 0 : fRows;
        const budget = Math.floor(w * 0.55);
        let used = 0;
        const order = shuffle(rng3, FLAVOR_KITS[flavor].filter((k2) => k2.h <= hAvail));
        for (const k of [...order.filter((k2) => !flavorUsed.has(k2.id)), ...order.filter((k2) => flavorUsed.has(k2.id))]) {
          if (used + k.w > budget) continue;
          const kx = sx + used;
          // 키트 지붕을 앞줄 맨 윗줄(fTop)에 붙인다: 키트(h 5~6)가 앞줄(7줄)보다 낮으면 남는 줄은 키트 앞 벽돌 마당이 된다.
          // (2026-10-18 4등분 확대 QA: 발을 보도에 맞추면 키트 지붕 위에 1~2줄 빈 벽돌 판이 떠 뒷골목·뒷줄과 끊겼다.)
          const kFoot = fTop + k.h - 1;
          stamp(k.id, kx, fTop);
          flavorUsed.add(k.id);
          placed.push({ role: "landmark", x: kx, foot: b.foot, w: k.w, top: fTop, h: b.foot - fTop + 1 });   // 발자국은 앞 마당까지(기둥·소품·빈터 쓰임이 키트 앞을 가리지 않게)
          flavorShade(kx, k.w, kFoot);
          used += k.w;
        }
        packW = w - used; lmEnd = used;
      }
      if (rear && packW >= 7) {                                         // 뒷골목 ↔ 앞 보도 샛길(2칸): 뒷줄 건물 문이 큰길에서 닿게
        fill(sx + lmEnd, fTop, 2, fRows, FLAVOR_SIDEWALK, true);
        lmEnd += 2; packW -= 2;
      } else if (!flavor && zone === "shop" && w >= 18 && rng() < 0.4) {
        const hAvail = b.foot - b.top + 1;
        const fits = LANDMARKS.filter((l) => l.h <= hAvail && l.w + 8 <= w);
        const lm = fits.length ? pick(rng, fits) : undefined;
        if (lm) {
          const lx = rng() < 0.5 ? sx : ex - lm.w;
          stamp(lm.id, lx, b.foot - lm.h + 1);
          placed.push({ role: "landmark", x: lx, foot: b.foot, w: lm.w, top: b.top, h: lm.h });
          packW = w - lm.w - 1; lmEnd = lx === sx ? lm.w + 1 : 0;
        }
      }
      let rolesHere = zone === "house" ? housePool : pool.slice(poolPtr).concat(pool.slice(0, poolPtr));
      if (zone === "shop" && b.foot - b.top + 1 >= 16 && style === "shopping" && !flavor) {            // 키 큰 띠: 고층 빌딩을 사이사이에 섞는다(셋 건너 하나 정도)
        rolesHere = rolesHere.flatMap((r, i) => (i % 3 === 0 ? ["tower", r] : [r]));
      }
      if (flavor) rolesHere = rolesHere.filter((r2, i, a) => i === 0 || r2 !== a[i - 1]);   // 변형: 같은 가게가 나란히 서지 않게
      const packed = packRow(rng, packW, rolesHere, !flavor).map((p2) => ({ ...p2, x: p2.x + lmEnd }));
      if (zone === "shop") poolPtr += packed.length;
      let cur = lmEnd;
      let headBudget = 1;
      for (const bb of packed) { if (bb.x - cur >= 2) yard(sx + cur, bb.x - cur, b.foot, fTop, paverBand); cur = bb.x + bb.w; }
      const endLimit = lmEnd ? w : packW;
      if (endLimit - cur >= 2) yard(sx + cur, endLimit - cur, b.foot, fTop, paverBand);
      for (const bb of packed) {
        const side: "L" | "R" = rng() < 0.5 ? "L" : "R";
        const doorX = sfKitId(bb.role, bb.w, side) ? sx + bb.x + sfDoorCol(bb.w, side) : undefined;
        placed.push({ role: bb.role, x: sx + bb.x, foot: b.foot, w: bb.w, top: fTop, ...(doorX !== undefined ? { doorX } : {}) });
        if (flavor) flavorShade(sx + bb.x, bb.w, b.foot);
        else for (let fx = 0; fx < bb.w; fx++) if (doorX === undefined || sx + bb.x + fx < doorX || sx + bb.x + fx > doorX + 1) stamp("jp-foot-shadow", sx + bb.x + fx, b.foot + 1, "ground");   // 접지 그림자(건물이 뜨지 않게)
        // 같은 건물에 대한 후보 입력 12개(점점 단순) — 첫 성공을 쓴다(buildJpCityBuilding 이 거절하면 다음)
        let headTaken = false;
        for (let attempt = 0; attempt < 12; attempt++) {
          const args = randomBuildingArgs(rng, bb.role, bb.w, attempt, fRows, side, headBudget > 0 && !flavor);   // 변형은 깊은 지붕 키트가 맨 위를 덮으므로 옥상 간판을 달지 않는다
          if (canRear && attempt < 6) args.floors = Math.floor((fRows - 5) / 2);   // 뒷줄 띠: 앞줄 높이를 꼭 맞춰 골목 2줄 위가 바로 뒷줄 건물이 되게
          else if (flavor && attempt < 6) args.floors = Math.max(Number(args.floors), Math.min(Math.floor((fRows - 5) / 2), (LOOKS[bb.role] ?? LOOKS.shop!).floors[1]));   // 변형: 띠 높이를 채우는 쪽으로(건물 뒤 빈 땅을 줄인다)
          if (args.head) headTaken = true;
          buildSteps.push({ tool: "build_jp_city_building", args: { mapId, x: sx + bb.x, y: b.foot, ...args }, optional: true, note: `try:${placed.length - 1}` });
        }
        if (headTaken) headBudget--;                                // 구획당 옥상 간판 하나
      }
    }
  });
  // 맨 위 가장자리 생울타리 — 첫 띠 뒤가 지도 끝까지 열려 보이지 않게(세로 길 어귀는 비운다). 뒷줄 집이 선 변형은 집 지붕이 지도 끝이다.
  if (!rearAny) for (const [sx, ex] of segmentsAround(W, streets.filter((s) => s.from === 0))) fill(sx, 0, ex - sx, 1, hedge, true);
  const yardAt = steps.length;                                  // 빈터 칠은 기둥 자리가 정해진 뒤에 이 자리로 끼워 넣는다
  steps.push(...buildSteps, ...alleySteps);

  // ── 3. 큰길 표식: 외측선(교차로·횡단보도 칸 제외), 보행 신호등
  const skipX = (x: number, road: number) => crossings.some((c) => c.road === road && x >= c.x && x < c.x + 6) || streets.some((s) => x >= s.x && x < s.x + s.w);
  bands.forEach((b, i) => {
    if (flavor || !b.gap || b.gap.river) return;                   // 변형 골목은 흰 외측선 없이 연석·빗물받이로 읽힌다(참고 그림)
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
  const props = ["jp-prop-vending-aka", "jp-prop-vending-sora", "jp-prop-vending-midori", "jp-prop-bike-sora", "jp-prop-bike-aka", "jp-prop-bike-midori", "jp-prop-planter", "jp-prop-pot", "jp-prop-bench", "jp-prop-post-box", "jp-prop-bike-rack", "jp-prop-a-frame", "jp-prop-garbage-net", "jp-prop-bollard", ...(flavor ? [FLAVOR_POSTBOX.id] : [])];
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

  // 큰길 건너편(다음 띠 위) 보도에도 낮은 소품을 드문드문 — 양쪽 보도가 같은 밀도로 읽히게(하천 구간은 제외).
  const lowProps = ["jp-prop-planter", "jp-prop-bench", "jp-prop-bike-rack", "jp-prop-a-frame", "jp-prop-garbage-net", "jp-prop-bollard", "jp-prop-planter"];
  bands.forEach((b, bi) => {
    const g = b.gap, nb = bands[bi + 1];
    if (!g || g.river || !nb) return;
    // 아래 띠의 건물은 낮은 띠에서 지붕이 보도 줄까지 올라온다 → 건물이 선 열에는 놓지 않는다(소품이 지붕 위에 얹히지 않게).
    const shortBand = nb.foot - nb.top + 1 < 9;                    // 띠가 9줄+ 이면 가장 낮은 건물(7~8줄)도 보도 줄에 닿지 않는다
    const nbFree = (x: number, w: number) => !shortBand || !placed.some((pb) => pb.foot === nb.foot && x - 1 < pb.x + pb.w && x + w + 1 > pb.x);
    let px = 2 + Math.floor(rng2() * 5);
    while (px < W - 3) {
      const id = pick(rng2, lowProps);
      const w = propW[id] ?? 1;
      if (nbFree(px, w) && !inStreet(px - 1) && !inStreet(px + w) && !crossings.some((c) => c.road === bi && px + w > c.x - 1 && px < c.x + 7)) stamp(id, px, g.sw2 + 1);
      px += w + 5 + Math.floor(rng2() * 6);
    }
  });

  // ── 5. 차·노면: 큰길마다 일방통행 한 줄(중앙선 없음), 길 위 「30」 표시.
  const cars = ["jp-prop-car-white", "jp-prop-car-silver", "jp-prop-car-black", "jp-prop-car-red", "jp-prop-car-blue", "jp-prop-car-taxi", "jp-prop-car-green", "jp-prop-car-navy"];
  bands.forEach((b, bi) => {
    if (!b.gap || b.gap.river || flavor) return;                   // 변형 골목에는 「30」 노면 표시·차를 두지 않는다
    const eastbound = rng() < 0.5;
    const laneY = b.gap.road0 + (b.gap.roadW >= 4 ? 1 : 0);
    const spans: [number, number][] = crossings.filter((c) => c.road === bi).map((c) => [c.x - 1, c.x + 7] as [number, number]);
    for (const s of streets) spans.push([s.x - 1, s.x + s.w + 4]);
    const markX = 2 + Math.floor(rng() * Math.max(1, W - 12));
    if (!spans.some(([a, e]) => markX < e && markX + 4 > a)) {
      spans.push([markX - 1, markX + 5]);
      // 「30」 키트는 側溝+흰 선 줄을 자기 가장자리 줄에 품고 있다 — 동쪽행은 길 맨 위 두 줄(road0), 서쪽행은 맨 아래 두 줄(road1-1)에 놓아야 그 줄이 외측선에 이어진다(2026-10-13 조화 QA: 한 줄 안쪽에 놓아 회색 막대가 길 가운데 떠 있었다).
      stamp(`jp-mark-30-${eastbound ? "e" : "w"}`, markX, eastbound ? b.gap.road0 : b.gap.road1 - 1, "road");
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
  // 기둥(가로등·전봇대)이 서는 빈터는 잔디를 걷어 낸다 — 기둥 머리가 풀밭·나무 위에 뜨던 문제(조화 QA). 주차장 빈터에는 세우지 않는다.
  const yardsHit = (x: number, w: number, foot: number) => yardDescs.filter((yd) => yd.foot === foot && x < yd.gx + yd.gw && x + w > yd.gx);
  const yardBlocks = (x: number, w: number, foot: number) => yardsHit(x, w, foot).some((yd) => yd.parking);
  const claimYards = (x: number, w: number, foot: number) => yardsHit(x, w, foot).forEach((yd) => { yd.noLawn = true; });
  // 건물 칸은 물론 좌우 한 칸(차양·간판 튀어나옴)까지 비어 있어야 한다.
  const clearAround = (x: number, w: number, foot: number) => clearCols(Math.max(0, x - 1), w + 2, foot);
  bands.forEach((b, bi) => {
    let lx = 2 + Math.floor(rng() * 5);
    while (lx < W - 2) {
      let x = lx;
      while (x < W - 2 && (doorZone(x, b.foot) || inStreet(x, bi) || !clearAround(x, 1, b.foot) || yardBlocks(x, 1, b.foot))) x++;
      if (x < W - 2) { stamp("jp-prop-lamp-post", x, b.foot + 2 - 3); claimYards(x, 1, b.foot); }
      lx = x + 8 + Math.floor(rng() * 3);
    }
    const cand: number[] = [];
    if (bi === 0 || rng() < 0.5) {
      let pxs = 3 + Math.floor(rng() * 5);
      while (pxs < W - 4) {
        let x = pxs;
        while (x < W - 4 && (doorZone(x, b.foot) || doorZone(x + 1, b.foot) || inStreet(x, bi) || inStreet(x + 1, bi) || !clearAround(x, 2, b.foot) || yardBlocks(x, 2, b.foot))) x++;
        if (x < W - 4) cand.push(x);
        pxs = x + 12 + Math.floor(rng() * 5);
      }
    }
    // 전봇대는 전선으로 이어진 것만 남긴다(전선이 가는 곳 없이 혼자 선 기둥 금지). 전선은 건물 위 70%+ 를 지나는 구간만 친다.
    const wireOk = cand.map((x, i) => {
      const nx = cand[i + 1];
      if (nx === undefined || nx - (x + 2) < 2 || nx - (x + 2) > 17) return false;
      let n = 0;
      for (let q = x + 2; q < nx; q++) if (placed.some((pb) => pb.foot === b.foot && q >= pb.x && q < pb.x + pb.w)) n++;
      return n / Math.max(1, nx - x - 2) >= 0.7;
    });
    const poleXs = cand.filter((_, i) => wireOk[i] || wireOk[i - 1]);
    cand.forEach((x, i) => {
      if (!(wireOk[i] || wireOk[i - 1])) return;
      if (flavor) stamp(FLAVOR_POLE.id, x, b.foot + 2 - (FLAVOR_POLE.h - 1));
      else stamp("jp-prop-utility-pole2", x, b.foot + 2 - 4);
      claimYards(x, 2, b.foot);
      const nx = cand[i + 1];
      // 전선 키트는 아래층 칸을 비워 찍으므로 건물 위에 찍으면 1층 외벽을 지운다 → 건물보다 먼저(yardSteps 앞)에 찍고 건물이 아래층을 다시 덮게 한다.
      if (wireOk[i]) wireSteps.push({ tool: "stamp_object", args: { objectId: `kit:jp_city/jp-wire-${nx! - (x + 2) + 3}`, mapId, x: x + 2, y: b.foot + 2 - 4 }, optional: true, note: "prop" });
    });
    poleXsByBand.push(poleXs);
    for (const s of streets) if (!s.arcade && bi >= s.from && bi <= s.to) stamp("jp-prop-curve-mirror", s.x + s.w, b.foot + 2 - 2);
    const busStop = flavor ? FLAVOR_BUS_STOP.id : "jp-bus-stop";
    for (const id of bi === 0 ? [busStop, "jp-hydrant-sign"] : rng() < 0.4 ? [busStop] : []) {
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
    if (flavor === "shitamachi") nearWall(b, FLAVOR_HOKORA.w, (x) => stamp(FLAVOR_HOKORA.id, x, b.foot + 2 - FLAVOR_HOKORA.h), 1);   // 골목 어귀 지장보살 감실
  });
  for (const b of placed) {
    if ((b.role === "izakaya" || b.role === "ramen") && rng() < 0.7) {
      const nx = [b.x - 1, b.x + b.w].find((cx) => cx >= 0 && cx < W - 1 && clearCols(cx, 1, b.foot) && !inStreetAny(cx));   // 문·외벽을 가리지 않게 건물 바로 옆 빈 열에
      if (nx !== undefined) stamp(`jp-prop-nobori-${pick(rng, ["aka", "sora", "midori"])}`, nx, b.foot + 2 - 2);
    }
  }

  emitYards();
  emitShade();
  steps.splice(yardAt, 0, ...yardSteps);
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
      const lh = pb.role === "landmark" ? pb.h : undefined;
      return { x: pb.x, y: pb.foot - (lh ? lh - 1 : 2), w: pb.w, h: lh ?? 3 };
    });
    const hit = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    // 소품끼리는 한 칸 여백을 둔다(옆줄·아랫줄에 바로 붙어 쌓여 보이던 벤치·화분·가로등) — 건물 발자국과는 맞닿아도 된다.
    const hitGap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w + 1 && a.x + a.w + 1 > b.x && a.y < b.y + b.h + 1 && a.y + a.h + 1 > b.y;
    const claimed: { x: number; y: number; w: number; h: number }[] = [];
    for (let i = 0; i < steps.length; i++) {
      const st = steps[i]!;
      // 둑·다리·강변에 찍는 소품(벤치·돌등롱·초롱 기둥·가로등)도 같은 정리 대상이다 — 크기를 아는 것만 본다(둑 벽·물 칸은 PROP_SIZE 에 없어 건드리지 않는다).
      if (st.tool !== "stamp_object" || (st.note !== "prop" && st.note !== "bank" && st.note !== "bridge")) continue;
      const id = String(st.args.objectId ?? "").replace("kit:jp_city/", "");
      const sz = PROP_SIZE[id];
      if (!sz) continue;
      const r = { x: Number(st.args.x), y: Number(st.args.y), w: sz[0], h: sz[1] };
      if (rects.some((b2) => hit(r, b2)) || claimed.some((b2) => hitGap(r, b2))) { steps.splice(i, 1); i--; continue; }
      claimed.push(r);
    }
    propRectsOut.push(...claimed);
  }
  // 쇼텐가이 아케이드: 시장 길 구간마다 큰길 쪽 끝(남쪽, 보는 쪽)에 간판 아치, 북쪽이 큰길에 닿으면 그쪽 어귀에도 아치, 사이는 지붕 줄(세 줄마다 철 아치).
  // 소품 겹침 정리 뒤에 찍어 지붕이 소품·건물 위에 얹힌다(아래층 바닥은 판석 그대로).
  for (const seg of vSegs) {
    if (!seg.s.arcade) continue;
    const { x, w } = seg.s;
    const G = FLAVOR_ARCADE.gateRows;
    // 지도 끝(위 y0=0 · 아래 y1=H-1)은 큰길이 아니라 어귀 아치를 세우지 않고 지붕을 끝까지 잇는다.
    const southGate = seg.y1 < H - 1 ? seg.y1 - G + 1 : -1, northGate = seg.y0 > 0 ? seg.y0 : -1;
    const top = northGate >= 0 ? northGate + G : seg.y0, bottom = southGate >= 0 ? southGate - 1 : seg.y1;
    if (bottom - top + 1 < 2) continue;
    for (let y = top; y <= bottom; y++) stamp(arcadeRoofKit(w, (y - top) % FLAVOR_ARCADE.ribEvery === 1), x, y, "arcade");
    if (northGate >= 0) stamp(arcadeGateKit(w), x, northGate, "arcade");
    if (southGate >= 0) stamp(arcadeGateKit(w), x, southGate, "arcade");
  }
  const zoneNames: Record<JpBlockZone, string> = { shop: "상가", house: "주택", park: "공원", parking: "주차장" };
  return {
    steps,
    buildings: placed,
    propRects: propRectsOut,
    parks: parkRects,
    mapId, seed: opts.seed, style: flavor ?? style,
    walkRows: [...bands.flatMap((b) => (b.gap ? (b.gap.river ? [b.foot + 2, b.gap.sw2] : [b.foot + 2, b.gap.road0, b.gap.road0 + 1, b.gap.sw2]) : [])), H - 2],
    summary: `${flavor ? FLAVOR_KO[flavor] : style === "residential" ? "주택가" : "상가 거리"} ${W}×${H} — 띠 ${N}줄(발 ${bands.map((b) => `y${b.foot}`).join("·")}), 큰길 ${N - 1}(폭 ${roadWs.join("·")}), 세로 길 ${streets.length}${riverGap >= 0 ? ", 하천(가로)" : ""}, 구획 ${zones.map((z) => zoneNames[z.zone]).join("·")}, 건물 ${placed.length}채(${placed.map((p) => p.role).join("·")})`,
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

export function runJpStreetPlan(plan: JpStreetPlan, call: (tool: string, args: Record<string, unknown>) => { rect?: { x0: number; y0: number; w: number; h: number }; doors?: readonly { x: number; y: number }[] } | void, view?: () => LotUseView): { built: number; skipped: number; props: number; buildings: JpStreetBuiltBuilding[]; lotUses: readonly LotUsePlaced[] } {
  let built = 0, skipped = 0, props = 0;
  const buildings: JpStreetBuiltBuilding[] = [];
  const done = new Set<string>();
  for (const step of plan.steps) {
    const tryKey = step.note?.startsWith("try:") ? step.note : undefined;
    if (tryKey && done.has(tryKey)) continue;
    try {
      // 생울타리·블록담·철망은 fill_region 이 받지 않는 선형 위층 오토타일이다 — 그대로 부르면 거절돼 optional 단계가 조용히 사라졌다. 오토타일 모양으로 3층에 직접 찍는다.
      const edge = step.tool === "fill_region" && view ? EDGE_MATERIAL_AUTOTILE[String(step.args.material)] : undefined;
      if (edge) { stampEdgeRect(call as never, view!(), plan.mapId, step.args.rect as { x: number; y: number; w: number; h: number }, edge); continue; }
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
  // 변형 깊은 지붕: 조립 건물(지붕 띠 1~2줄 + 맨 위층)을 3/4 지붕 키트 4줄(기와 비탈·함석·옥상 기물)로 덮는다 — 참고 그림처럼 집마다 지붕 윗면이 깊게 보이게.
  // 1층(3줄)은 남겨야 하므로 키가 7줄 이상인 건물만. 같은 줄 이웃과 같은 지붕이 나란히 서지 않게 고른다.
  if (plan.style === "shitamachi" || plan.style === "shotengai") {
    const pool = FLAVOR_ROOFS[plan.style];
    const rrng = mulberry((plan.seed ^ 0x3c6ef372) >>> 0);
    const lastByFoot = new Map<number, string>();
    for (const b of [...buildings].sort((p, q) => (p.rect?.x0 ?? 0) - (q.rect?.x0 ?? 0))) {
      if (!b.rect || b.rect.h < FLAVOR_ROOF_ROWS + 3) continue;
      const foot = b.rect.y0 + b.rect.h - 1;
      const prev = lastByFoot.get(foot);
      const choices = pool.filter((s) => s !== prev);
      const style = choices[Math.floor(rrng() * choices.length)]!;
      const kit = flavorRoofKit(style, b.rect.w);
      if (!kit) continue;
      const clear = Array.from({ length: FLAVOR_ROOF_ROWS }, () => Array.from({ length: b.rect!.w }, () => -2));
      try {
        call("stamp_layer_block", { mapId: plan.mapId, x: b.rect.x0, y: b.rect.y0, layers: { "3": clear, "4": clear }, reshape: false });
        call("stamp_object", { objectId: `kit:jp_city/${kit}`, mapId: plan.mapId, x: b.rect.x0, y: b.rect.y0 });
        lastByFoot.set(foot, style);
        props++;
      } catch (e) { if (nodeEnvFlag("SFDBG")) console.error("roof fail", kit, String((e as Error).message).slice(0, 200)); }
    }
  }
  // 뒷담: 건물이 띠 꼭대기까지 닿지 않으면 지붕 위 한 줄에 블록담을 둘러 뒤가 허공처럼 비어 보이지 않게 한다(건물 뒤는 블록 안쪽 뒷마당).
  for (const b of buildings) {
    if (!b.rect || b.top === undefined) continue;
    const wy = b.rect.y0 - 1;
    if (wy - b.top >= 2) { try { if (view) stampEdgeRect(call as never, view(), plan.mapId, { x: b.rect.x0, y: wy, w: b.rect.w, h: 1 }, EDGE_MATERIAL_AUTOTILE["블록담"]!); } catch { /* 건너뜀 */ } }
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
  // 빈터 쓰임(2026-10-14): 남은 대지를 코인 주차·골목 자판기·놀이터·텃밭·공사장·광장 꾸밈으로 — 지도를 읽어야 하므로 view 를 준 호출에서만.
  let lotUses: readonly LotUsePlaced[] = [];
  if (view) {
    const rects = [
      ...buildings.filter((b) => b.rect).map((b) => ({ x: b.rect!.x0, y: b.rect!.y0, w: b.rect!.w, h: b.rect!.h })),
      ...plan.buildings.filter((b) => b.role === "landmark" && b.h).map((b) => ({ x: b.x, y: b.foot - b.h! + 1, w: b.w, h: b.h! })),
    ];
    const lot = fillLotUses({ mapId: plan.mapId, seed: plan.seed, style: plan.style === "residential" ? "residential" : "shopping", noGreen: plan.style === "shitamachi" || plan.style === "shotengai", buildings: rects, view, call: (tool, args) => call(tool, args) });
    props += lot.props; lotUses = lot.uses;
    if (nodeEnvFlag("LOTDBG")) console.error("[lot-use]", (lot.emptyBefore * 100).toFixed(1), "→", (lot.emptyAfter * 100).toFixed(1), lot.uses.map((u) => `${u.use}@${u.x},${u.y} ${u.w}x${u.h}`).join(" "));
  }
  return { built, skipped, props, buildings, lotUses };
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
    const added = addMapLocation(map, { name: `${label} 건물`, x: b.rect.x0, y: b.rect.y0, w: b.rect.w, h: b.rect.h, note, tags: ["jp-building", COMPOSED_LAYOUT_TAG, b.role] });
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
  if (/주택가|주택|골목집|동네 집|residential|suburb/iu.test(text) && !/상가|번화|shopping|arcade|상점가|시장|아케이드/iu.test(text)) return "residential";
  return flavorFromText(text) ?? "shopping";
}
