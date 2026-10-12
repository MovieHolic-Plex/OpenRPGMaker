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

export interface JpStreetBuilding { readonly role: string; readonly x: number; readonly foot: number; readonly w: number }

export interface JpStreetPlan {
  readonly steps: readonly JpStreetStep[];
  /** 계획한 건물(후보 `try:N` 의 N 번째). 실제로 지어진 것만 `runJpStreetPlan` 결과에 남는다. */
  readonly buildings: readonly JpStreetBuilding[];
  /** 걸어 다니는 큰길 줄(보도 둘 사이) — 시작 칸·문 후보를 고르는 기준. */
  readonly walkRows: readonly number[];
  readonly summary: string;
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
  if (look.heads && attempt < 4 && rng() < 0.45) { args.head = pick(rng, look.heads); delete args.roof; }
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

/** 거리 계획 — 땅 → 도로·보도 → 뒷줄 건물 → 앞줄 건물 → 소품 순서의 도구 호출 목록. */
export function planJpCityStreet(opts: ComposeOptions): JpStreetPlan {
  const { mapId, width: W, height: H } = opts;
  const rng = mulberry((opts.seed ^ 0x9e3779b1) >>> 0);
  const style: JpStreetStyle = opts.style ?? "shopping";
  const steps: JpStreetStep[] = [];
  const fill = (x: number, y: number, w: number, h: number, material: string, optional = false) => {
    if (w > 0 && h > 0) steps.push({ tool: "fill_region", args: { mapId, rect: { x, y, w, h }, material }, optional });
  };

  // ── 가로 구획: 뒷줄 건물 높이 확보(층 4 = 13줄) → 보도·도로·보도 → 앞줄 건물 → 맨 아래 보도
  const roadW = style === "residential" ? 3 : (rng() < 0.7 ? 4 : 3);
  const frontFoot = H - 3;                                       // 앞줄 건물 발 — 아래에 보도 2줄
  const backMin = Math.min(11, Math.floor(H * 0.34));
  const backFoot = backMin + Math.floor(rng() * Math.max(1, Math.floor(H * 0.1)));          // 뒷줄 건물 발
  const sw1 = backFoot + 1, road0 = backFoot + 3, road1 = road0 + roadW - 1, sw2 = road1 + 1;   // 보도(2) · 도로 · 보도(2)
  const frontTop = sw2 + 2;
  const ground = style === "residential" ? "잔디" : "판석 광장";

  fill(0, 0, W, H, ground);
  fill(0, sw1, W, 2, "보도 연석");
  fill(0, road0, W, roadW, "생활도로");
  fill(0, road1 + 1, W, 2, "보도 연석");
  fill(0, H - 2, W, 2, "보도 연석");                                // 맨 아래 가장자리 보도(앞줄 건물 문 앞)
  // 횡단보도: 폭 4 도로에는 횡단보도 도로 키트(6×4)를 겹쳐 찍는다. 면 채우기 재료가 아니라 키트로만 놓을 수 있다.
  const cwX = 3 + Math.floor(rng() * Math.max(1, W - 12));
  if (roadW === 4) steps.push({ tool: "stamp_object", args: { objectId: "kit:jp_city/jp-road-lane-crosswalk-h", mapId, x: cwX, y: road0 }, optional: true, note: "road" });
  // 골목: 지도를 위아래로 가로지르는 샛길 하나(70%) — 양옆 보도 한 칸씩 + 가운데 생활도로. 큰길과 만나는 곳은 도로가 이어진다(사거리).
  const alleyLane = 2 + Math.floor(rng() * 2);
  const alleyX = 4 + Math.floor(rng() * Math.max(1, W - 12 - alleyLane));
  const alleys: { x: number; w: number }[] = [];
  if (rng() < 0.7) {
    alleys.push({ x: alleyX, w: alleyLane + 2 });
    for (const [y0, y1] of [[0, road0 - 1], [road1 + 1, H - 1]] as const) {
      fill(alleyX, y0, 1, y1 - y0 + 1, "보도 연석", true);
      fill(alleyX + alleyLane + 1, y0, 1, y1 - y0 + 1, "보도 연석", true);
    }
    fill(alleyX + 1, 0, alleyLane, H, "생활도로", true);
  }

  // ── 가게 목록
  const mix = style === "residential" ? RESIDENTIAL_MIX : SHOPPING_MIX;
  const wanted = [...(opts.shops ?? [])].filter((r) => LOOKS[r]);
  const filler = shuffle(rng, mix);
  const roles = [...wanted, ...filler];
  const backRoles = [], frontRoles = [];
  roles.forEach((r, i) => (i % 2 === 0 ? backRoles : frontRoles).push(r));

  // 뒷줄: 골목 칸을 피해 두 구간으로 나눠 채운다
  const rows: { foot: number; segs: [number, number][]; roles: string[]; top: number }[] = [
    { foot: backFoot, top: 0, segs: segmentsAround(W, alleys), roles: backRoles },
    { foot: frontFoot, top: frontTop, segs: segmentsAround(W, alleys), roles: frontRoles },
  ];
  const placed: { role: string; x: number; foot: number; w: number }[] = [];
  const buildSteps: JpStreetStep[] = [];
  for (const row of rows) {
    let ri = 0;
    for (const [sx, ex] of row.segs) {
      const packed = packRow(rng, ex - sx, row.roles.slice(ri).concat(row.roles.slice(0, ri)), true);
      ri += packed.length;
      for (const b of packed) {
        placed.push({ role: b.role, x: sx + b.x, foot: row.foot, w: b.w });
        // 같은 건물에 대한 후보 입력 12개(점점 단순) — 첫 성공을 쓴다(buildJpCityBuilding 이 거절하면 다음)
        for (let attempt = 0; attempt < 12; attempt++) {
          buildSteps.push({
            tool: "build_jp_city_building",
            args: { mapId, x: sx + b.x, y: row.foot, ...randomBuildingArgs(rng, b.role, b.w, attempt, row.foot - row.top + 1) },
            optional: true, note: `try:${placed.length - 1}`,
          });
        }
      }
    }
  }
  steps.push(...buildSteps);

  // ── 소품: 보도 바깥줄(도로 쪽)에 낮은 소품을 흩뿌린다 — 문 앞 접근칸(건물 발 바로 아래 줄)은 비운다
  const props = ["jp-prop-vending-aka", "jp-prop-vending-sora", "jp-prop-vending-midori", "jp-prop-bike-sora", "jp-prop-bike-aka", "jp-prop-bike-midori", "jp-prop-planter", "jp-prop-pot", "jp-prop-bench", "jp-prop-post-box", "jp-prop-bike-rack", "jp-prop-a-frame", "jp-prop-garbage-net", "jp-prop-bollard"];
  const propH: Record<string, number> = { "jp-prop-vending-aka": 2, "jp-prop-vending-sora": 2, "jp-prop-vending-midori": 2, "jp-prop-bike-sora": 2, "jp-prop-bike-aka": 2, "jp-prop-bike-midori": 2, "jp-prop-planter": 1, "jp-prop-pot": 2, "jp-prop-bench": 1, "jp-prop-post-box": 2, "jp-prop-bike-rack": 1, "jp-prop-a-frame": 1, "jp-prop-garbage-net": 1, "jp-prop-bollard": 1 };
  const propW: Record<string, number> = { "jp-prop-vending-aka": 2, "jp-prop-vending-sora": 2, "jp-prop-vending-midori": 2, "jp-prop-bike-sora": 2, "jp-prop-bike-aka": 2, "jp-prop-bike-midori": 2, "jp-prop-planter": 2, "jp-prop-pot": 1, "jp-prop-bench": 2, "jp-prop-post-box": 1, "jp-prop-bike-rack": 2, "jp-prop-a-frame": 1, "jp-prop-garbage-net": 2, "jp-prop-bollard": 1 };
  let px = 1 + Math.floor(rng() * 3);
  const rowY = sw1 + 1;                                           // 뒷줄 앞 보도의 도로쪽 줄 — 소품 발
  while (px < W - 3) {
    const id = pick(rng, props);
    const w = propW[id] ?? 1, h = propH[id] ?? 1;
    if (!alleys.some((a) => px + w > a.x - 1 && px < a.x + a.w + 1)) {
      steps.push({ tool: "stamp_object", args: { objectId: `kit:jp_city/${id}`, mapId, x: px, y: rowY - h + 1 }, optional: true, note: "prop" });
    }
    px += w + 2 + Math.floor(rng() * 5);
  }
  px = 2 + Math.floor(rng() * 3);
  const rowY2 = H - 1;                                            // 맨 아래 보도 바깥줄
  while (px < W - 3) {
    const id = pick(rng, props);
    const w = propW[id] ?? 1, h = propH[id] ?? 1;
    steps.push({ tool: "stamp_object", args: { objectId: `kit:jp_city/${id}`, mapId, x: px, y: rowY2 - h + 1 }, optional: true, note: "prop" });
    px += w + 3 + Math.floor(rng() * 6);
  }

  // 차: 도로 한복판에 1~3대(서로 안 겹치게, 횡단보도는 비운다)
  const cars = ["jp-prop-car-white", "jp-prop-car-silver", "jp-prop-car-black", "jp-prop-car-red", "jp-prop-car-blue", "jp-prop-car-taxi", "jp-prop-car-green", "jp-prop-car-navy"];
  const nCars = 1 + Math.floor(rng() * 3);
  const carSpans: [number, number][] = [[cwX - 1, cwX + 4]];
  for (let c = 0; c < nCars; c++) {
    const cx = 1 + Math.floor(rng() * Math.max(1, W - 7));
    if (carSpans.some(([a, b]) => cx < b && cx + 5 > a)) continue;
    carSpans.push([cx, cx + 5]);
    const east = rng() < 0.5;
    steps.push({ tool: "stamp_object", args: { objectId: `kit:jp_city/${pick(rng, cars)}${east ? "" : "-r"}`, mapId, x: cx, y: road0 + (roadW >= 4 ? (east ? 1 : 0) : 0) }, optional: true, note: "prop" });
  }
  // 가로등·노보리: 건물 왼쪽 끝 앞 보도 — 문(오른쪽 끝)과 안 겹치게
  for (const b of placed) {
    if (rng() < 0.3) steps.push({ tool: "stamp_object", args: { objectId: "kit:jp_city/jp-prop-lamp-post", mapId, x: b.x, y: b.foot + 2 - 3 }, optional: true, note: "prop" });
    else if ((b.role === "izakaya" || b.role === "ramen") && rng() < 0.7) steps.push({ tool: "stamp_object", args: { objectId: `kit:jp_city/jp-prop-nobori-${pick(rng, ["aka", "sora", "midori"])}`, mapId, x: b.x + 1, y: b.foot + 2 - 2 }, optional: true, note: "prop" });
  }

  return {
    steps,
    buildings: placed,
    walkRows: [sw1 + 1, road0, road0 + 1, sw2, H - 2],
    summary: `${style === "residential" ? "주택가" : "상가 거리"} ${W}×${H} — 뒷줄 발 y${backFoot}, 도로 y${road0}~${road1}(폭 ${roadW}), 앞줄 발 y${frontFoot}, 골목 ${alleys.length}, 건물 ${placed.length}채(${placed.map((p) => p.role).join("·")})`,
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
