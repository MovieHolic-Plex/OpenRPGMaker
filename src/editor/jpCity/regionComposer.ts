// 일본 지역 장면(japaneseRegionsCatalog.ts 의 engine:"scene")을 맵 크기·씨앗에 맞춰 도구 호출 단계(fill_region·stamp_object)로 펼친다.
// 1단계: 표면 구획 지도(surface: Uint8Array)를 먼저 완성하고, 최종 surface 에서만 물·논(wet)과 길·광장(path) 마스크를 도출한다.
// 2단계: 랜드마크(put) → 택지(lots)·건물 줄(row) → 선형 기물(line) → 산포 소품(scatter) → 수로/도로 마감 → 구획별 푸아송 식생(fillZones) 순으로 배치한다.
// 3단계: V1~V6 검증기(도달성·논/물 침범 금지·석등/지장 경로 인접·반복/격자 금지·지역 아키타입 허용표·선로/승강장 규칙)를 돌려 위반 목록을 반환한다.
import type { JpRegion, JpRegionCategory, JpRegionOp, JpZoneHint } from "./japaneseRegionsCatalog";

export interface JpRegionStep {
  /** paint_forest: args.kinds(칸마다 0 숲 아님·1 활엽·2 대숲·3 벚나무·4 삼나무·5 단풍·6 소나무·7 신사 섞인 숲(소나무+단풍)·8 산비탈 섞인 숲(삼나무+활엽), 길이 W*H; 6~8 은 r3 오토타일이 있을 때만)·args.seed — forestPainter.paintJpForest 가 칠한다. */
  readonly tool: "fill_region" | "stamp_object" | "paint_forest";
  readonly args: Record<string, unknown>;
  readonly note: string;
}

export interface JpRegionSection4Report {
  readonly v1Failures: number;
  readonly whitelistViolations: number;
  readonly signatureClones: number;
  readonly adjacentClones: number;
  readonly strayTrees: number;
  readonly stairEndpoints: number;
}

export interface JpRegionPlan {
  readonly steps: readonly JpRegionStep[];
  /** 자리가 없어 놓지 못한 키트(id·횟수). */
  readonly unplaced: Readonly<Record<string, number>>;
  readonly placed: number;
  /** V1~V6 및 §4 검증 위반 항목(0개여야 정상). */
  readonly violations: readonly string[];
  /** §4 6대 정량 검수 지표. */
  readonly section4: JpRegionSection4Report;
}

export const JpSurface = {
  FOREST: 1,
  GRASS: 2,
  SOIL: 3,
  ROAD: 4,
  LANE: 5,
  WALK: 6,
  PLAZA: 7,
  LOT: 8,
  YARD: 9,
  WATER: 10,
  PADDY: 11,
  SAND: 12,
  RAIL: 13,
  DECK: 14,
  FIELD: 15,
  TRAIL: 16,
} as const;

type SurfaceId = (typeof JpSurface)[keyof typeof JpSurface];

function isWalkablePathSurface(s: number): boolean {
  return (
    s === JpSurface.ROAD
    || s === JpSurface.LANE
    || s === JpSurface.WALK
    || s === JpSurface.PLAZA
    || s === JpSurface.TRAIL
    || s === JpSurface.DECK
  );
}

function matToSurface(mat: string, hint?: JpZoneHint): SurfaceId {
  if (hint === "field") return JpSurface.FIELD;
  if (hint === "yard") return JpSurface.YARD;
  if (hint === "plaza") return JpSurface.PLAZA;
  if (hint === "forest") return JpSurface.FOREST;
  if (hint === "grass") return JpSurface.GRASS;
  switch (mat) {
    case "숲 바닥(이끼·낙엽)": return JpSurface.FOREST;
    case "잔디":
    case "습원 풀밭": return JpSurface.GRASS;
    case "산길 흙":
    case "자갈 참배길": return JpSurface.TRAIL;
    case "校庭 흙 바닥": return JpSurface.SOIL;
    case "거리 · 도로·정지선": return JpSurface.ROAD;
    case "생활도로":
    case "따뜻한 아스팔트 골목": return JpSurface.LANE;
    case "콘크리트 판석 보도":
    case "보도 연석":
    case "온천가 돌길(이시다타미)": return JpSurface.WALK;
    case "판석 광장":
    case "遊具 밑 ゴムチップ": return JpSurface.PLAZA;
    case "거리 · 주차장": return JpSurface.LOT;
    case "바다":
    case "수로":
    case "연못":
    case "inaka-canal-water":
    case "inaka-river-shallow": return JpSurface.WATER;
    case "논(물 댄 모)":
    case "inaka-paddy-water":
    case "inaka-paddy-summer":
    case "inaka-paddy-golden": return JpSurface.PADDY;
    case "해변 모래사장": return JpSurface.SAND;
    case "선로":
    case "폐선 녹슨 선로": return JpSurface.RAIL;
    case "나무 데크 탐방로": return JpSurface.DECK;
    default: return JpSurface.GRASS;
  }
}
/** 카탈로그의 rg-* 는 칩셋 키트 jp-rg-* 의 줄임이다. */
export function regionKitId(id: string): string { return id.startsWith("jp-") ? id : `jp-${id}`; }

/** 바다·논처럼 오토타일 문법이 없는 단칸 지역 바닥(jp:region-*)을 lowerTiles 에 바로 칠한다. */
export function paintJpRegionGround(
  map: { readonly width: number; readonly height: number; readonly lowerTiles: number[] },
  tileset: { readonly tileGroups?: readonly { readonly id: string; readonly name: string; readonly tileIds: readonly number[] }[] },
  rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
  material: string,
): boolean {
  const norm = material.startsWith("inaka-ground-") ? `inaka-${material.slice("inaka-ground-".length)}` : material;
  const group = (tileset.tileGroups ?? []).find(
    (g) => (g.id.startsWith("jp:region-") || g.id.startsWith("jp:inaka-")) && (g.name === norm || g.id === `jp:${norm}`) && g.tileIds.length === 1,
  );
  const tileId = group?.tileIds[0];
  if (tileId === undefined) return false;
  const x0 = Math.max(0, rect.x), y0 = Math.max(0, rect.y);
  const x1 = Math.min(map.width, rect.x + rect.w), y1 = Math.min(map.height, rect.y + rect.h);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      map.lowerTiles[y * map.width + x] = tileId;
    }
  }
  return true;
}

function rng(seed: number): () => number {
  let s = (seed * 2654435761 + 0x9e3779b9) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 물(WATER) 위에 둘 수 있는 키트 — R4: yukemuri(김)는 절대 물 칸에 두지 않는다. */
function canPlaceOnWater(id: string): boolean {
  const k = regionKitId(id);
  for (const tag of ["fishing-boat", "tetrapod", "lighthouse", "waterfall", "tsuribashi", "bridge", "water-", "stepping-stones", "sluice-gate"]) {
    if (k.includes(tag)) return true;
  }
  return false;
}

/** 논(PADDY) 위에 둘 수 있는 키트 — A7/§3 #27: 허수아비(kakashi)·출렁다리·다랑논 경계 석축(ishigaki)·돌계단만 허용하고, hazakake(볏단걸이)는 논둑(levee)에만 둔다. */
function canPlaceOnPaddy(id: string): boolean {
  const k = regionKitId(id);
  return k === "jp-rg-kakashi" || k === "jp-rg-tsuribashi" || k === "jp-rg-ishigaki" || k.includes("stairs-stone") || k.includes("scarecrow") || k.includes("hasagi");
}

/** A6: 맵당 최대 2회까지만 허용되는 대표(signature) 키트 판별. */
function isSignatureKit(id: string): boolean {
  const k = regionKitId(id);
  return /dagashi|wagashi|dango|izakaya|sento|koban|clinic|books|school$|market-hall|post-office|supermarket|conbini|sanmon|pagoda|honden|tenshu|shoro|ropeway|lighthouse|mujin-eki|tunnel|waterfall|tsuribashi/.test(k);
}

/** 실제 건물(V1 도로 접근성 검사 및 건물 그림자 대상) 판별 — 축구 골대·국기봉·폭포·터널 같은 소품/지형물은 제외한다. */
function isBuildingKit(id: string): boolean {
  const k = regionKitId(id);
  return (
    k.startsWith("jp-bldg-")
    || k.startsWith("jp-recipe-")
    || k === "jp-prop-honden"
    || k === "jp-prop-pagoda5"
    || k === "jp-prop-sanmon6"
    || k.startsWith("jp-prop-nakamise-")
    || k === "jp-rg-tenshu"
    || k === "jp-rg-shoro"
    || k === "jp-rg-lodge"
    || k === "jp-rg-ropeway"
    || k === "jp-rg-mujin-eki"
  );
}

/** 나무·관목 키트 판별(A3/A4/§4.4). */
function isTreeOrBushKit(id: string): boolean {
  const k = regionKitId(id);
  return (
    k.startsWith("jp-prop-tree-")
    || k === "jp-rg-sugi"
    || k === "jp-rg-pine"
    || k === "jp-rg-maple"
    || k === "jp-rg-bamboo-grove" || k === "jp-rg-bamboo-grove-b" || k === "jp-rg-bamboo-clump"
    || k.startsWith("jp-tsutsuji")
  );
}

/** A9: 아키타입별 화이트리스트(ALLOWED_KITS). 목록에 없는 키트는 계획에서 거부·검출한다. */
export const ALLOWED_KITS: Readonly<Record<JpRegionCategory, readonly RegExp[]>> = {
  urban: [
    /^jp-bldg-(house-|shop-|apart-|mansion|office|zakkyo|conbini|supermarket|koban|sento|station-small|row-)/,
    /^jp-recipe-/,
    /^jp-prop-/,
    /^jp-lot-(fountain|clock|planter|kiosk)$/,
    /^jp-(bus-stop|postbox-red|coin-parking|monthly-parking|vending-stripe-alcove|izakaya-brick-wall|pots|gomi-box|keijiban|bike-shelter|pole|pole-wood)/,
    /^jp-rg-yatai$/,
    /^jp-(gnd-|water-|bridge-|foot-shadow)/,
  ],
  residential: [
    /^jp-bldg-house-(hip2|hip2-wide|gable-garage|hiraya|hiraya-gable|shed-modern|flat3|machiya|nagaya|western|nisetai|tile3|terrace)$/,
    /^jp-bldg-(apart-wood2|apart-steel2|danchi5|mansion4|kindergarten|sento|koban|garage-carport-house|coin-laundry|conbini|shrine-haiden)$/,
    /^jp-bldg-shop-(dagashi|wagashi|soba|tabako|cafe|bakery|books|flower|sake)$/,
    /^jp-recipe-(machiya-izakaya|l-machiya-annex)$/,
    /^jp-(monthly-parking|fumikiri-|rail-|pole|pole-wood|gate|gatepost|carport|pots|monohoshi|keijiban|gomi-box|bike-shelter|jungle-gym|tetsubo|hokora-jizo|jizo|torii|tsutsuji)/,
    /^jp-prop-(wall-|gate-|stairs-|tree-|vending-|vend-|bike-|car-|bus|train|catenary-pole|curve-mirror|post-box|stop-sign|lantern-post|stone-lantern|ricksha-cart|bench|lamp-post|planter|pot|bollard|cat-|slide|swing|sandbox|a-frame)/,
    /^jp-lot-(slide|sandbox|clock|fountain|planter|veg)$/,
    /^jp-rg-(ishigaki|fishing-boat|pine|maple|sugi|bamboo-grove|bamboo-grove-b|bamboo-clump)$/,
    /^jp-(gnd-|water-|bridge-|foot-shadow)/,
  ],
  campus_civic: [
    /^jp-bldg-(school|school-gym|office6|kindergarten|conbini|apart-wood2|apart-steel2|mansion4|shrine-haiden)$/,
    /^jp-bldg-house-(hip2|hip2-wide|hiraya|hiraya-gable|shed-modern|western|tile3|machiya)$/,
    /^jp-bldg-shop-(books|cafe|ramen|bakery|wagashi|flower|soba)$/,
    /^jp-school-/,
    /^jp-(goal-l|goal-r|ball-net|chorei-dai|flagpoles|fujidana|biotope|gakkyuen|souko|ninomiya|kadan|tetsubo|jungle-gym|bike-shelter|keijiban|bus-stop|torii|pole|pole-wood|pots|monohoshi|gomi-box|tsutsuji)/,
    /^jp-lot-(clock|fountain|kiosk|planter|slide|sandbox)$/,
    /^jp-prop-(wall-|gate-|stairs-|tree-|bench|lamp-post|planter|hachiko|bus|car-|bike-|vending-|vend-|chozuya|censer|nakamise-|string-lanterns4|stone-lantern|lantern-post|nobori-|swing|sandbox)/,
    /^jp-rg-(ishigaki|shoro|yatai|sugi|pine|maple|bamboo-grove|bamboo-grove-b|bamboo-clump)$/,
    /^jp-(gnd-|water-|bridge-|foot-shadow)/,
  ],
  sacred_historic: [
    /^jp-bldg-shrine-haiden$/,
    /^jp-prop-(honden|pagoda5|sanmon6|kaminarimon|hozomon|chozuya|censer|nakamise-|stone-lantern|lantern-post|string-lanterns4|wall-tsuiji|wall-hedge|wall-board|stairs-stone8|stairs-stone15|tree-|bench|nobori-)/,
    /^jp-(torii|hokora-jizo|jizo|tsutsuji)/,
    /^jp-rg-(ishigaki|tenshu|shoro|stone-ruin|moss-buddha|wakimizu|doshirube|lodge|sugi|pine|maple|bamboo-grove|bamboo-grove-b|bamboo-clump)$/,
    /^jp-(gnd-|water-|bridge-|foot-shadow)/,
  ],
  mountain_nature: [
    /^jp-rg-(bamboo-grove|bamboo-grove-b|bamboo-clump|sugi|pine|maple|ishigaki|stone-ruin|moss-buddha|waterfall|tsuribashi|ropeway|lodge|tunnel|wakimizu|doshirube|mujin-eki)$/,
    /^jp-prop-(stairs-stone8|stairs-stone15|bench|stone-lantern|wall-hedge|wall-board|train8-g)/,
    /^jp-train-car-[ab]$/,
    /^jp-(hokora-jizo|jizo|torii|tsutsuji)/,
    /^jp-(gnd-|water-|bridge-|foot-shadow)/,
  ],
  onsen_rural_coast: [
    /^jp-bldg-house-(machiya|nagaya|hiraya|hiraya-gable|hip2|hip2-wide|western|nisetai|tile3|terrace|shed-modern)$/,
    /^jp-bldg-(sento|conbini|market-hall|warehouse|factory)$/,
    /^jp-bldg-shop-(wagashi|soba|izakaya|sake|fish|sushi|teishoku|cafe|dagashi|tabako|flower)$/,
    /^jp-recipe-(machiya-izakaya|l-machiya-annex)$/,
    /^jp-rg-(rotenburo|yukemuri|ishigaki|kakashi|hazakake|sunflower|tsuribashi|wakimizu|doshirube|lighthouse|fishing-boat|tetrapod|yatai|mujin-eki|sugi|pine|maple|bamboo-grove|bamboo-grove-b|bamboo-clump)$/,
    /^jp-prop-(lantern-post|stone-lantern|ricksha-cart|wall-tsuiji|wall-block|wall-hedge|wall-board|stairs-stone8|tin-stall-|van-white|ad-truck|car-|bus|train8-g|lamp-post|bench|vending-|vend-|tree-|catenary-pole|curve-mirror|stop-sign)/,
    /^jp-(in-ht-bamboo-fence|fumikiri-|rail-|bus-stop|pole|pole-wood|gate|gatepost|pots|monohoshi|gomi-box|bike-shelter|souko|lot-veg|hokora-jizo|jizo|tsutsuji)/,
    /^jp-(gnd-|water-|bridge-|foot-shadow)/,
  ],
};

export function isKitAllowedInRegion(region: JpRegion, id: string): boolean {
  const k = regionKitId(id);
  if (region.forbidKits?.includes(k) || region.forbidKits?.includes(id)) return false;
  if (region.id === "buddhist_temple_pagoda" && k === "jp-torii") return false;
  if (region.no >= 20 && region.no <= 25 && (k.startsWith("jp-bldg-") || k.startsWith("jp-recipe-"))) return false;
  if (region.extraKits?.includes(k) || region.extraKits?.includes(id)) return true;
  const patterns = ALLOWED_KITS[region.category];
  return patterns.some((re) => re.test(k));
}
export function planJpRegionScene(input: {
  readonly region: JpRegion;
  readonly mapId: string;
  readonly width: number;
  readonly height: number;
  readonly seed: number;
  readonly kitSize: (kitId: string) => { readonly w: number; readonly h: number } | undefined;
  /** 칩셋에 붓으로 칠하는 숲 오토타일 r3(jp-forest3-*)이 있는가 — 있으면 FOREST 구획을 paint_forest 로 칠한다. */
  readonly forestAutotile?: boolean;
}): JpRegionPlan {
  const { region, mapId, width: W, height: H, seed, kitSize } = input;
  if (region.engine.kind !== "scene") throw new Error(`${region.id} 은 장면 지역이 아니다(engine ${region.engine.kind})`);
  const rand = rng(seed + region.no * 1009);
  const X = (f: number) => Math.max(0, Math.min(W - 1, Math.round(f * (W - 1))));
  const Y = (f: number) => Math.max(0, Math.min(H - 1, Math.round(f * (H - 1))));
  const snapX = (f: number) => (f <= 0.03 ? 0 : f >= 0.97 ? W - 1 : X(f));
  const snapY = (f: number) => (f <= 0.03 ? 0 : f >= 0.97 ? H - 1 : Y(f));

  const surface = new Uint8Array(W * H);   // 최종 표면 구획 ID(단일 진실 공급원)
  const clearMask = new Uint8Array(W * H); // 1 = clear 영역 또는 band/street 경로
  const path = new Uint8Array(W * H);      // 1 = 길·보도·광장·선로·물·논(onPath 키트만)
  const wet = new Uint8Array(W * H);       // 1 = 물·논(최종 surface 에서만 도출)
  const used = new Uint8Array(W * H);      // 1 = 키트가 점유한 칸

  const fillSteps: JpRegionStep[] = [];
  const stampSteps: JpRegionStep[] = [];
  const stampedRecords: { kit: string; x: number; y: number; w: number; h: number; fromOp: string }[] = [];
  const unplaced: Record<string, number> = {};
  let placed = 0;
  const kitCounts = new Map<string, number>();
  let adjacentClones = 0;
  let catalogWhitelistViolations = 0;

  const fill = (x: number, y: number, w: number, h: number, mat: string, clear: boolean, zoneHint?: JpZoneHint) => {
    x = Math.max(0, x); y = Math.max(0, y); w = Math.min(W - x, w); h = Math.min(H - y, h);
    if (w <= 0 || h <= 0) return;
    fillSteps.push({ tool: "fill_region", args: { mapId, rect: { x, y, w, h }, material: mat }, note: "ground" });
    const z = matToSurface(mat, zoneHint);
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        const i = yy * W + xx;
        surface[i] = z;
        clearMask[i] = clear ? 1 : 0;
      }
    }
  };

  // 1) 구획 바닥 칠하기 (자연 기본 바닥 -> area -> band / street / terrace)
  fill(0, 0, W, H, region.engine.ground, false);
  const rowAndLotOps = region.engine.ops.filter(
    (o): o is Extract<JpRegionOp, { op: "row" | "lots" }> => o.op === "row" || o.op === "lots",
  );
  const footRows = new Set<number>();
  for (const o of rowAndLotOps) footRows.add(Y(o.foot));

  const hCanals: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const vWalks: { x0: number; x1: number; y0: number; y1: number; mat: string }[] = [];
  const hRoads: { x0: number; x1: number; y0: number; y1: number }[] = [];
  let hRailCount = 0;
  let vRailCount = 0;

  // 1A) 건물 기단용 비-clear 판석 광장(area)을 먼저 깔아 가로·세로 길(band/street)을 덮어쓰지 않게 한다.
  for (const op of region.engine.ops) {
    if (op.op === "area" && op.zone === "plaza" && op.clear !== true) {
      const x0 = snapX(op.box[0]), y0 = snapY(op.box[1]), x1 = snapX(op.box[2]), y1 = snapY(op.box[3]);
      fill(x0, y0, x1 - x0 + 1, y1 - y0 + 1, op.mat, false, op.zone);
    }
  }

  for (const op of region.engine.ops) {
    if (op.op === "area") {
      if (op.zone === "plaza" && op.clear !== true) continue;
      const x0 = snapX(op.box[0]), y0 = snapY(op.box[1]), x1 = snapX(op.box[2]), y1 = snapY(op.box[3]);
      fill(x0, y0, x1 - x0 + 1, y1 - y0 + 1, op.mat, op.clear === true, op.zone);
      if (op.mat === "수로" && (x1 - x0 + 1) >= 8 && (y1 - y0 + 1) >= 3) {
        hCanals.push({ x0, x1, y0, y1 });
      }
    } else if (op.op === "band") {
      const [a, b] = op.span ?? [0, 1];
      if (op.dir === "h") {
        const y0 = Y(op.at) - Math.floor(op.size / 2);
        const y = footRows.has(y0) ? y0 + 1 : y0;
        const x0 = snapX(a), x1 = snapX(b);
        fill(x0, y, x1 - x0 + 1, op.size, op.mat, true);
        if (op.mat === "수로" && op.size >= 3) hCanals.push({ x0, x1, y0: y, y1: y + op.size - 1 });
        if (op.mat === "거리 · 도로·정지선" && op.size >= 3) hRoads.push({ x0, x1, y0: y, y1: y + op.size - 1 });
        if (op.mat === "선로" || op.mat === "폐선 녹슨 선로") hRailCount++;
      } else {
        const x = X(op.at) - Math.floor(op.size / 2);
        const y0 = snapY(a), y1 = snapY(b);
        fill(x, y0, op.size, y1 - y0 + 1, op.mat, true);
        const z = matToSurface(op.mat);
        if (z !== JpSurface.WATER && z !== JpSurface.PADDY && op.size >= 2 && op.size <= 6) {
          vWalks.push({ x0: x, x1: x + op.size - 1, y0, y1, mat: op.mat });
        }
        if (op.mat === "선로" || op.mat === "폐선 녹슨 선로") vRailCount++;
      }
    } else if (op.op === "street") {
      const sz = Math.max(1, op.size);
      const half = Math.floor(sz / 2);
      for (let i = 0; i + 1 < op.points.length; i++) {
        const p0 = op.points[i]!, p1 = op.points[i + 1]!;
        const x0 = snapX(p0[0]), y0 = snapY(p0[1]);
        const x1 = snapX(p1[0]), y1 = snapY(p1[1]);
        if (y0 === y1) {
          const lx = Math.min(x0, x1), rx = Math.max(x0, x1);
          const ty = Math.max(0, Math.min(H - sz, y0 - half));
          fill(lx, ty, rx - lx + 1, sz, op.mat, true);
        } else if (x0 === x1) {
          const ty = Math.min(y0, y1), by = Math.max(y0, y1);
          const lx = Math.max(0, Math.min(W - sz, x0 - half));
          fill(lx, ty, sz, by - ty + 1, op.mat, true);
          const z = matToSurface(op.mat);
          if (z !== JpSurface.WATER && z !== JpSurface.PADDY && sz >= 2 && sz <= 6) {
            vWalks.push({ x0: lx, x1: lx + sz - 1, y0: ty, y1: by, mat: op.mat });
          }
        } else {
          const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
          for (let s = 0; s <= steps; s++) {
            const cx = Math.round(x0 + ((x1 - x0) * s) / steps);
            const cy = Math.round(y0 + ((y1 - y0) * s) / steps);
            fill(Math.max(0, Math.min(W - sz, cx - half)), Math.max(0, Math.min(H - sz, cy - half)), sz, sz, op.mat, true);
          }
        }
      }
    } else if (op.op === "terrace") {
      const stairKit = regionKitId(op.stairKit ?? "jp-prop-stairs-stone8");
      const ss = kitSize(stairKit) ?? { w: 8, h: 4 };
      const wallY = Math.max(1, Math.min(H - ss.h - 1, Y(op.y) - Math.floor(ss.h / 2)));
      const mat = op.mat ?? "온천가 돌길(이시다타미)";
      for (const sx of op.stairAt ?? []) {
        const stairX = Math.max(0, Math.min(W - ss.w, X(sx) - Math.floor(ss.w / 2)));
        fill(stairX + 1, Math.max(0, wallY - 2), Math.max(2, ss.w - 2), ss.h + 4, mat, true);
      }
    }
  }

  // R4: 모든 바닥 칠이 끝난 뒤 최종 surface[] 와 clearMask[] 에서만 wet[] 과 path[] 를 도출한다.
  for (let i = 0; i < W * H; i++) {
    const s = surface[i]!;
    wet[i] = (s === JpSurface.WATER || s === JpSurface.PADDY) ? 1 : 0;
    path[i] = (
      clearMask[i] === 1
      || s === JpSurface.RAIL
      || s === JpSurface.DECK
      || s === JpSurface.WATER
      || s === JpSurface.PADDY
    ) ? 1 : 0;
  }

  const waterDepthAt = (x: number, y: number): number => {
    let d = 0;
    for (let yy = y; yy >= 0 && surface[yy * W + x] === JpSurface.WATER; yy--) d++;
    for (let yy = y + 1; yy < H && surface[yy * W + x] === JpSurface.WATER; yy++) d++;
    return d;
  };

  const isVehicleKit = (id: string): boolean => {
    const k = regionKitId(id);
    return /^jp-prop-(car-|bus|van-|ad-truck)/.test(k);
  };

  const canStandOnCell = (id: string, cellIdx: number, isBaseRow: boolean, onPath: boolean): boolean => {
    const k = regionKitId(id);
    const s = surface[cellIdx]!;
    if (s === JpSurface.WATER) {
      if (k === "jp-rg-fishing-boat" && isBaseRow) {
        const xx = cellIdx % W, yy = Math.floor(cellIdx / W);
        if (waterDepthAt(xx, yy) < 4) return false;
      }
      return isBaseRow ? (onPath && canPlaceOnWater(id)) : (onPath || canPlaceOnWater(id));
    }
    if (s === JpSurface.PADDY) {
      return isBaseRow ? (onPath && canPlaceOnPaddy(id)) : (onPath && canPlaceOnPaddy(id));
    }
    if (s === JpSurface.ROAD && isBaseRow && !isVehicleKit(id) && !k.includes("fumikiri")) {
      return false;
    }
    if (path[cellIdx] && !onPath) {
      if (!isBaseRow && isTreeOrBushKit(k) && (s === JpSurface.WALK || s === JpSurface.LANE || s === JpSurface.TRAIL || s === JpSurface.PLAZA || s === JpSurface.YARD)) {
        return true;
      }
      return false;
    }
    return true;
  };

  const free = (id: string, x: number, y: number, w: number, h: number, onPath: boolean, margin: number): boolean => {
    if (x < 0 || y < 0 || x + w > W || y + h > H) return false;
    const baseStart = y + Math.max(0, h - Math.min(h, 2));
    for (let yy = y - margin; yy < y + h + margin; yy++) {
      for (let xx = x - margin; xx < x + w + margin; xx++) {
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const i = yy * W + xx;
        if (used[i]) return false;
        const inside = xx >= x && xx < x + w && yy >= y && yy < y + h;
        if (inside && !canStandOnCell(id, i, yy >= baseStart, onPath)) return false;
      }
    }
    return true;
  };

  const isVWalkCell = (xx: number, yy: number): boolean =>
    vWalks.some((vw) => xx >= vw.x0 && xx <= vw.x1 && yy >= vw.y0 && yy <= vw.y1);

  /** 건물(row·lots) 배치 검사: 물·논·세로길 위는 전 구간 금지, 가로 길(path)은 아랫단 3줄 금지. */
  const freeBuilding = (_id: string, x: number, y: number, w: number, h: number): boolean => {
    if (x < 0 || y < 0 || x + w > W || y + h > H) return false;
    const baseStart = y + Math.max(0, h - Math.min(h, 3));
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        const i = yy * W + xx;
        if (used[i] || wet[i] || isVWalkCell(xx, yy)) return false;
        const s = surface[i]!;
        if (s === JpSurface.RAIL || s === JpSurface.ROAD) return false;
        if (yy >= baseStart && path[i] && s !== JpSurface.PLAZA && s !== JpSurface.YARD) return false;
      }
    }
    return true;
  };

  const stamp = (kit: string, x: number, y: number, w: number, h: number, fromOp = "op") => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) used[yy * W + xx] = 1;
    stampSteps.push({ tool: "stamp_object", args: { objectId: `kit:jp_city/${kit}`, mapId, x, y }, note: kit });
    stampedRecords.push({ kit, x, y, w, h, fromOp });
    if (fromOp !== "decal") kitCounts.set(kit, (kitCounts.get(kit) ?? 0) + 1);
    placed++;
  };

  const miss = (kit: string) => { unplaced[kit] = (unplaced[kit] ?? 0) + 1; };

  const tryAt = (id: string, x: number, y: number, onPath: boolean, jitter: number, fromOp = "put"): boolean => {
    const kit = regionKitId(id), s = kitSize(kit);
    if (!isKitAllowedInRegion(region, id)) { catalogWhitelistViolations++; miss(kit); return false; }
    if (!s) { miss(kit); return false; }
    if (isSignatureKit(kit) && (kitCounts.get(kit) ?? 0) >= 2) return false;
    if (free(id, x, y, s.w, s.h, onPath, 0)) {
      stamp(kit, x, y, s.w, s.h, fromOp);
      return true;
    }
    const ring: [number, number][] = [];
    for (let r = 1; r <= jitter; r++) {
      for (const d of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]] as [number, number][]) ring.push(d);
    }
    for (const [dx, dy] of ring) {
      if (free(id, x + dx, y + dy, s.w, s.h, onPath, 0)) {
        stamp(kit, x + dx, y + dy, s.w, s.h, fromOp);
        return true;
      }
    }
    miss(kit);
    return false;
  };

  /** 건물(b)의 문 앞(foot + 1)에서 가장 가까운 길까지 진입로(apron)를 놓아 V1(A1) 연결을 보장한다. */
  const ensureBuildingApron = (bx: number, foot: number, bw: number, defaultMat = "콘크리트 판석 보도"): void => {
    if (foot + 1 >= H) return;
    for (let xx = bx; xx < bx + bw; xx++) {
      const idx = (foot + 1) * W + xx;
      if (clearMask[idx] === 1 && isWalkablePathSurface(surface[idx]!)) return;
    }
    const doorX = Math.max(0, Math.min(W - 2, bx + Math.floor(bw / 2) - 1));
    let targetY = Math.min(H - 1, foot + 1);
    let foundMat = defaultMat;
    for (let dy = 1; dy <= 6 && foot + dy < H; dy++) {
      const yy = foot + dy;
      let hit = false;
      for (let xx = Math.max(0, bx - 1); xx <= Math.min(W - 1, bx + bw); xx++) {
        const idx = yy * W + xx;
        const s = surface[idx]!;
        if ((clearMask[idx] === 1 || yy === H - 1) && isWalkablePathSurface(s)) {
          targetY = yy;
          if (s === JpSurface.TRAIL) foundMat = "산길 흙";
          else if (s === JpSurface.LANE) foundMat = "생활도로";
          hit = true;
          break;
        }
      }
      if (hit) break;
    }
    const ah = targetY - (foot + 1) + 1;
    fill(doorX, foot + 1, Math.min(2, W - doorX), ah, foundMat, true);
    for (let yy = foot + 1; yy <= targetY; yy++) {
      for (let xx = doorX; xx < Math.min(W, doorX + 2); xx++) {
        path[yy * W + xx] = 1;
      }
    }
  };

  // 2) 키트 배치: terrace(단차·계단·석축) → put(랜드마크·건널목·계단·다리) → lots/row(건물·택지) → line(성벽·가로수·참배길) → scatter 순으로 실행
  const placedBuildings: { x: number; foot: number; w: number; h: number; kit: string }[] = [];
  const ops = region.engine.ops;
  for (const op of ops) if (op.op === "terrace") placeOp(op);
  for (const op of ops) if (op.op === "put") placeOp(op);
  for (const op of ops) if (op.op === "lots" || op.op === "row") placeOp(op);
  for (const op of ops) if (op.op === "line") placeOp(op);
  for (const op of ops) if (op.op === "scatter") placeOp(op);

  for (const b of placedBuildings) {
    ensureBuildingApron(b.x, b.foot, b.w);
  }

  // 3) 마감 디테일: 수로 다리·물결, 도로 차선/횡단보도, 건물 접지 그림자, 구획별 식생(fillZones)
  decorateCanalsAndBridges();
  decorateRoads();
  decorateBuildingShadows();
  fillZones();

  // 4) V1~V6 및 §4 검증
  const { violations, section4 } = validatePlan();

  return { steps: [...fillSteps, ...stampSteps], unplaced, placed, violations, section4 };

  function placeOp(op: JpRegionOp): void {
    switch (op.op) {
      case "area":
      case "band":
      case "street":
        return;
      case "terrace": {
        const stairKit = regionKitId(op.stairKit ?? "jp-prop-stairs-stone8");
        const ss = kitSize(stairKit) ?? { w: 8, h: 4 };
        const wallKit = "jp-rg-ishigaki";
        const ws = kitSize(wallKit) ?? { w: 8, h: 4 };
        const wallY = Math.max(1, Math.min(H - ws.h - 1, Y(op.y) - Math.floor(ws.h / 2)));
        const [a, b] = op.span ?? [0.02, 0.98];
        const startX = X(a), endX = X(b);
        const stairRanges: [number, number][] = [];
        for (const sx of op.stairAt ?? []) {
          const stairX = Math.max(0, Math.min(W - ss.w, X(sx) - Math.floor(ss.w / 2)));
          if (free(stairKit, stairX, wallY, ss.w, ss.h, true, 0)) {
            stamp(stairKit, stairX, wallY, ss.w, ss.h, "terrace-stair");
            stairRanges.push([stairX, stairX + ss.w - 1]);
          }
        }
        if (stairRanges.length > 0) {
          for (const [sx0, sx1] of stairRanges) {
            for (let xx = sx0 - ws.w; xx >= startX; xx -= ws.w) {
              if (stairRanges.some(([a0, a1]) => xx + ws.w - 1 >= a0 && xx <= a1)) continue;
              if (free(wallKit, xx, wallY, ws.w, ws.h, true, 0)) stamp(wallKit, xx, wallY, ws.w, ws.h, "terrace-wall");
            }
            for (let xx = sx1 + 1; xx + ws.w - 1 <= endX; xx += ws.w) {
              if (stairRanges.some(([a0, a1]) => xx + ws.w - 1 >= a0 && xx <= a1)) continue;
              if (free(wallKit, xx, wallY, ws.w, ws.h, true, 0)) stamp(wallKit, xx, wallY, ws.w, ws.h, "terrace-wall");
            }
          }
        } else {
          for (let xx = startX; xx + ws.w - 1 <= endX; xx += ws.w) {
            if (free(wallKit, xx, wallY, ws.w, ws.h, true, 0)) stamp(wallKit, xx, wallY, ws.w, ws.h, "terrace-wall");
          }
        }
        return;
      }
      case "put": {
        const kit = regionKitId(op.kit), s = kitSize(kit);
        if (!isKitAllowedInRegion(region, op.kit)) { catalogWhitelistViolations++; miss(kit); return; }
        if (!s) { miss(kit); return; }
        const x = Math.max(0, Math.min(W - s.w, X(op.at[0]) - Math.floor(s.w / 2)));
        const y = Math.max(0, Math.min(H - s.h, op.foot ? Y(op.at[1]) - s.h + 1 : Y(op.at[1]) - Math.floor(s.h / 2)));
        const isAxial = kit.includes("fumikiri") || kit.includes("stairs") || kit.includes("tsuribashi") || kit.includes("tunnel") || kit.includes("sanmon") || kit.includes("torii") || kit.includes("school-gate");
        const ok = tryAt(op.kit, x, y, op.onPath === true, isAxial ? 1 : 2, "put");
        if (ok && isBuildingKit(kit)) {
          const rec = stampedRecords[stampedRecords.length - 1]!;
          placedBuildings.push({ x: rec.x, foot: rec.y + rec.h - 1, w: rec.w, h: rec.h, kit });
        }
        return;
      }
      case "row": {
        for (const rawId of op.kits) {
          if (!isKitAllowedInRegion(region, rawId)) catalogWhitelistViolations++;
        }
        const x0 = X(op.span[0]), x1 = X(op.span[1]), foot = Y(op.foot), gap = op.gap ?? 1;
        const hasBuildings = op.kits.some((k) => isBuildingKit(k));
        const fallbackPool = region.category === "urban"
          ? ["jp-bldg-shop-flower", "jp-bldg-shop-bakery", "jp-bldg-shop-pharmacy", "jp-bldg-shop-cleaning", "jp-bldg-shop-barber", "jp-bldg-shop-cafe", "jp-bldg-shop-soba", "jp-bldg-shop-teishoku"]
          : ["jp-bldg-house-machiya", "jp-bldg-house-nagaya", "jp-bldg-house-terrace", "jp-bldg-house-tile3", "jp-bldg-shop-soba", "jp-bldg-shop-flower"];
        const queue: string[] = [...op.kits];
        if (hasBuildings) {
          for (const fk of fallbackPool) {
            if (!queue.includes(fk) && isKitAllowedInRegion(region, fk)) queue.push(fk);
          }
        }
        const usedInThisRow = new Set<string>();
        let prevKit = "";
        let x = x0;
        while (x < x1) {
          let placedHere = false;
          for (const id of queue) {
            const kit = regionKitId(id), s = kitSize(kit);
            if (!s || !isKitAllowedInRegion(region, id)) continue;
            if (kit === prevKit) continue;
            if (s.h >= 5 && usedInThisRow.has(kit)) continue;
            if (isSignatureKit(kit) && (kitCounts.get(kit) ?? 0) >= 2) continue;
            if ((kitCounts.get(kit) ?? 0) >= 2 && s.h >= 5) continue;
            if (x + s.w - 1 <= x1 && freeBuilding(id, x, foot - s.h + 1, s.w, s.h)) {
              stamp(kit, x, foot - s.h + 1, s.w, s.h, "row");
              prevKit = kit;
              if (s.h >= 5) usedInThisRow.add(kit);
              if (isBuildingKit(kit)) placedBuildings.push({ x, foot, w: s.w, h: s.h, kit });
              x += s.w + gap;
              placedHere = true;
              break;
            }
          }
          if (!placedHere) x++;
        }
        return;
      }
      case "lots": {
        for (const rawId of op.kits) {
          if (!isKitAllowedInRegion(region, rawId)) catalogWhitelistViolations++;
        }
        const x0 = X(op.span[0]), x1 = X(op.span[1]), foot = Y(op.foot);
        const fenceKit = op.fence === "block"
          ? "jp-prop-wall-block"
          : op.fence === "tsuiji"
            ? "jp-prop-wall-tsuiji"
            : op.fence === "bamboo"
              ? "jp-in-ht-bamboo-fence"
              : op.fence === "none"
                ? ""
                : "jp-prop-wall-hedge";
        const fenceSize = fenceKit ? kitSize(fenceKit) : undefined;
        const yardProps = ["jp-pots", "jp-prop-bike-sora", "jp-monohoshi", "jp-gomi-box", "jp-tsutsuji", "jp-tsutsuji-3"];
        const fallbackHouses = ["jp-bldg-house-hip2", "jp-bldg-house-hiraya", "jp-bldg-house-hiraya-gable", "jp-bldg-house-western", "jp-bldg-house-tile3", "jp-bldg-house-machiya", "jp-bldg-house-shed-modern", "jp-bldg-house-hip2-wide"];
        const queue: string[] = [...op.kits];
        for (const fh of fallbackHouses) {
          if (!queue.includes(fh) && isKitAllowedInRegion(region, fh)) queue.push(fh);
        }
        const usedInThisLotRow = new Set<string>();
        let prevKit = "";
        let x = x0;
        while (x < x1) {
          let placedHere = false;
          for (const id of queue) {
            const kit = regionKitId(id), s = kitSize(kit);
            if (!s || !isKitAllowedInRegion(region, id)) continue;
            if (kit === prevKit || usedInThisLotRow.has(kit)) continue;
            if (isSignatureKit(kit) && (kitCounts.get(kit) ?? 0) >= 2) continue;
            if ((kitCounts.get(kit) ?? 0) >= 2 && s.h >= 5) continue;
            const sideMargin = 2;
            if (x + s.w - 1 <= x1 && freeBuilding(id, x, foot - s.h + 1, s.w, s.h)) {
              const by = foot - s.h + 1;
              const lotW = Math.min(x1 - x + 1, s.w + sideMargin);
                const yardMat = op.yard === "gravel" ? "자갈 참배길" : op.yard === "pave" ? "판석 광장" : "잔디";
                let canPaintYard = true;
                for (let yy = Math.max(0, by + 1); yy <= foot; yy++) {
                  for (let xx = x; xx < x + lotW; xx++) {
                    if (wet[yy * W + xx] || path[yy * W + xx]) canPaintYard = false;
                  }
                }
                if (canPaintYard) {
                  fillSteps.push({ tool: "fill_region", args: { mapId, rect: { x, y: Math.max(0, by + 1), w: lotW, h: foot - Math.max(0, by + 1) + 1 }, material: yardMat }, note: "lot-yard" });
                  for (let yy = Math.max(0, by + 1); yy <= foot; yy++) {
                    for (let xx = x; xx < x + lotW; xx++) surface[yy * W + xx] = JpSurface.YARD;
                  }
                }
                stamp(kit, x, by, s.w, s.h, "lots");
                if (kit === prevKit) adjacentClones++;
                prevKit = kit;
                usedInThisLotRow.add(kit);
                if (isBuildingKit(kit)) placedBuildings.push({ x, foot, w: s.w, h: s.h, kit });
                ensureBuildingApron(x, foot, s.w, op.yard === "gravel" ? "자갈 참배길" : "콘크리트 판석 보도");

                const yardX = x + s.w;
                if (fenceKit && fenceSize && yardX + fenceSize.w - 1 <= x1) {
                  const fy = foot - fenceSize.h + 1;
                  if (free(fenceKit, yardX, fy, fenceSize.w, fenceSize.h, false, 0)) {
                    stamp(fenceKit, yardX, fy, fenceSize.w, fenceSize.h, "lot-fence");
                  }
                }
                const propX = yardX + (fenceSize ? fenceSize.w : 0);
                if (propX < x + lotW) {
                  const yp = yardProps[Math.floor(rand() * yardProps.length)]!;
                  const ys = kitSize(yp);
                  if (ys && isKitAllowedInRegion(region, yp) && propX + ys.w - 1 <= x1 && free(yp, propX, foot - ys.h + 1, ys.w, ys.h, false, 0)) {
                    stamp(yp, propX, foot - ys.h + 1, ys.w, ys.h, "lot-yard");
                  }
                }
              x += lotW;
              placedHere = true;
              break;
            }
          }
          if (!placedHere) x++;
        }
        return;
      }
      case "line": {
        const kit = regionKitId(op.kit), s = kitSize(kit);
        if (!isKitAllowedInRegion(region, op.kit)) { catalogWhitelistViolations++; miss(kit); return; }
        if (!s) { miss(kit); return; }
        if (op.dir === "h") {
          let y = Math.max(0, Math.min(H - s.h, Y(op.at) - Math.floor(s.h / 2)));
          if (kit === "jp-pole" || kit === "jp-pole-wood" || kit === "jp-prop-utility-pole") {
            y = Math.max(0, Math.min(H - s.h, Y(op.at) - s.h + 1));
          }
          const startX = X(op.span[0]);
          const endX = X(op.span[1]);
          if (kit === "jp-rg-ishigaki") {
            let obsX0 = -1, obsX1 = -1;
            for (let xx = startX; xx <= endX; xx++) {
              let blocked = false;
              for (let yy = y; yy < y + s.h; yy++) if (used[yy * W + xx]) blocked = true;
              if (blocked) {
                if (obsX0 < 0) obsX0 = xx;
                obsX1 = xx;
              }
            }
            if (obsX0 >= 0) {
              for (let xx = obsX0 - s.w; xx >= startX; xx -= Math.max(s.w, op.step)) {
                if (free(op.kit, xx, y, s.w, s.h, op.onPath === true, 0)) stamp(kit, xx, y, s.w, s.h, "line");
              }
              for (let xx = obsX1 + 1; xx + s.w - 1 <= endX; xx += Math.max(s.w, op.step)) {
                if (free(op.kit, xx, y, s.w, s.h, op.onPath === true, 0)) stamp(kit, xx, y, s.w, s.h, "line");
              }
              return;
            }
          }
          let x = startX;
          while (x + s.w - 1 <= endX) {
            if (free(op.kit, x, y, s.w, s.h, op.onPath === true, 0)) {
              stamp(kit, x, y, s.w, s.h, "line");
              x += Math.max(s.w, op.step);
            } else {
              x += 1;
            }
          }
        } else {
          const x = Math.max(0, Math.min(W - s.w, X(op.at) - Math.floor(s.w / 2)));
          const endY = Y(op.span[1]);
          let y = Y(op.span[0]);
          while (y + s.h - 1 <= endY) {
            if (free(op.kit, x, y, s.w, s.h, op.onPath === true, 0)) {
              stamp(kit, x, y, s.w, s.h, "line");
              y += Math.max(s.h, op.step);
            } else {
              y += 1;
            }
          }
        }
        return;
      }
      case "scatter": {
        for (const rawId of op.kits) {
          if (!isKitAllowedInRegion(region, rawId)) catalogWhitelistViolations++;
        }
        const x0 = X(op.box[0]), y0 = Y(op.box[1]), x1 = X(op.box[2]), y1 = Y(op.box[3]);
        const allowedKits = op.kits.filter((id) => {
          const k = regionKitId(id);
          if (k === "jp-prop-stone-lantern" || k === "jp-jizo" || k === "jp-rg-moss-buddha" || isTreeOrBushKit(k)) return false;
          return isKitAllowedInRegion(region, id);
        });
        if (!allowedKits.length) return;
        const pts: [number, number][] = [];
        for (let n = 0; n < op.n; n++) {
          const id = allowedKits[Math.floor(rand() * allowedKits.length)]!, kit = regionKitId(id), s = kitSize(kit);
          if (!s) { miss(kit); continue; }
          let ok = false;
          for (let t = 0; t < 60 && !ok; t++) {
            const x = x0 + Math.floor(rand() * Math.max(1, x1 - x0 - s.w + 2));
            const y = y0 + Math.floor(rand() * Math.max(1, y1 - y0 - s.h + 2));
            if (x + s.w - 1 > x1 || y + s.h - 1 > y1) continue;
            const cx = x + s.w / 2, cy = y + s.h / 2;
            if (pts.some(([px, py]) => Math.hypot(cx - px, cy - py) < 4)) continue;
            if (free(id, x, y, s.w, s.h, op.onPath === true, 1)) {
              stamp(kit, x, y, s.w, s.h, "scatter");
              pts.push([cx, cy]);
              ok = true;
            }
          }
          if (!ok) miss(kit);
        }
        return;
      }
    }
  }

  function decorateCanalsAndBridges(): void {
    for (const c of hCanals) {
      const bridgeCols = new Set<number>();
      for (const vw of vWalks) {
        if (vw.x1 < c.x0 || vw.x0 > c.x1 || vw.y0 > c.y0 || vw.y1 < c.y1) continue;
        const bx0 = Math.max(c.x0, vw.x0), bx1 = Math.min(c.x1, vw.x1);
        if (bx1 - bx0 + 1 < 3) continue;
        for (let x = bx0; x <= bx1; x++) bridgeCols.add(x);
        for (let y = c.y0; y <= c.y1; y++) {
          for (let x = bx0; x <= bx1; x++) surface[y * W + x] = JpSurface.WALK;
          const post = y === c.y0 || y === c.y1;
          const railKit = post ? "jp-bridge-post" : "jp-bridge-rail-v";
          if (kitSize(railKit) && !used[y * W + bx0]) stamp(railKit, bx0, y, 1, 1, "decal");
          if (kitSize(railKit) && !used[y * W + bx1]) stamp(railKit, bx1, y, 1, 1, "decal");
          for (let x = bx0 + 1; x < bx1; x++) {
            const deckKit = y === c.y0 ? "jp-bridge-lip" : y === c.y1 ? "jp-bridge-pier" : "jp-bridge-plank";
            if (kitSize(deckKit) && !used[y * W + x]) stamp(deckKit, x, y, 1, 1, "decal");
          }
          if (y > c.y0 && y < c.y1) {
            if (bx0 - 1 >= c.x0 && kitSize("jp-water-dark") && !used[y * W + (bx0 - 1)]) stamp("jp-water-dark", bx0 - 1, y, 1, 1, "decal");
            if (bx1 + 1 <= c.x1 && kitSize("jp-water-dark-r") && !used[y * W + (bx1 + 1)]) stamp("jp-water-dark-r", bx1 + 1, y, 1, 1, "decal");
          }
        }
      }
      for (let x = c.x0; x <= c.x1; x++) {
        if (bridgeCols.has(x)) continue;
        if (kitSize("jp-water-shade") && !used[c.y0 * W + x]) stamp("jp-water-shade", x, c.y0, 1, 1, "decal");
        if (c.y1 > c.y0 && kitSize("jp-water-rim-s") && !used[c.y1 * W + x]) stamp("jp-water-rim-s", x, c.y1, 1, 1, "decal");
        if (c.y1 - c.y0 >= 2 && (x + c.y0) % 5 === 1) {
          const wy = c.y0 + 1 + (x % Math.max(1, c.y1 - c.y0 - 1));
          const glint = x % 10 === 1 ? "jp-water-streak" : "jp-water-glint";
          if (kitSize(glint) && !used[wy * W + x]) stamp(glint, x, wy, 1, 1, "decal");
        }
      }
    }
  }

  function decorateRoads(): void {
    for (const r of hRoads) {
      let cwX = -1;
      for (let tryX = Math.floor((r.x0 + r.x1) / 2) - 2; tryX >= r.x0 + 4; tryX -= 5) {
        let ok = true;
        for (let y = r.y0; y <= r.y1; y++) for (let x = tryX; x < tryX + 4; x++) if (used[y * W + x]) ok = false;
        if (ok) { cwX = tryX; break; }
      }
      if (cwX >= 0 && kitSize("jp-gnd-zebra")) {
        for (let y = r.y0; y <= r.y1; y++) for (let x = cwX; x < cwX + 4; x++) stamp("jp-gnd-zebra", x, y, 1, 1, "decal");
      }
      const midY = r.y0 + Math.floor((r.y1 - r.y0) / 2);
      for (let x = r.x0; x <= r.x1; x++) {
        if (cwX >= 0 && x >= cwX && x < cwX + 4) continue;
        const topId = x % 7 === 3 ? "jp-gnd-drain" : "jp-gnd-asph-line-n";
        if (kitSize(topId) && !used[r.y0 * W + x]) stamp(topId, x, r.y0, 1, 1, "decal");
        if (r.y1 > r.y0 && kitSize("jp-gnd-asph-line-s") && !used[r.y1 * W + x]) stamp("jp-gnd-asph-line-s", x, r.y1, 1, 1, "decal");
        if (x % 11 === 5 && kitSize("jp-gnd-manhole") && !used[midY * W + x]) stamp("jp-gnd-manhole", x, midY, 1, 1, "decal");
      }
    }
  }

  function decorateBuildingShadows(): void {
    if (!kitSize("jp-foot-shadow")) return;
    for (const b of placedBuildings) {
      if (b.foot + 1 >= H) continue;
      for (let x = b.x; x < b.x + b.w; x++) {
        const i = (b.foot + 1) * W + x;
        if (!used[i] && !wet[i] && surface[i] !== JpSurface.RAIL) stamp("jp-foot-shadow", x, b.foot + 1, 1, 1, "decal");
      }
    }
  }

  function fillZones(): void {
    // 숲 팩(jp_forest_pack)이 구워진 칩셋이면 FOREST 구획을 이어지는 수관으로 덮는다(paint_forest 한 단계):
    // 마스크 → 수관 오토타일 → 하늘선 → 수관 머리 → 줄기 띠. 한 그루 키트 흩뿌리기(아래)는 숲 팩이 없는 옛 칩셋에서만 쓴다.
    if (input.forestAutotile || kitSize("jp-forest-bl-sky-0")) {
      paintForestZones();
      return;
    }
    // A3 & A4: 7.5-disc 잔디 산포는 완전히 삭제하고, FOREST 구획에만 겹침 수관 군락(min dist 2.2 + 연속 노이즈 수종)을 채운다.
    const forestPool = region.id === "bamboo_mountain_trail"
      ? ["rg-bamboo-grove", "rg-sugi"]
      : region.id === "gorge_waterfall_trail"
        ? ["rg-maple", "rg-sugi", "rg-pine"]
        : region.season === "autumn"
          ? ["rg-sugi", "rg-maple", "rg-pine", "rg-bamboo-grove"]
          : ["rg-sugi", "rg-pine", "rg-bamboo-grove"];

    const solidNonTree = new Uint8Array(used);
    const trunkUsed = new Uint8Array(used);
    const upperCount = new Uint8Array(used);

    const isForestTreeAllowed = (x: number, y: number, w: number, h: number): boolean => {
      const topIsForest = y <= 1 && surface[y * W + (x + 1)] === JpSurface.FOREST;
      for (let yy = Math.max(0, y + h - 3); yy <= Math.min(H - 1, y + h); yy++) {
        for (let xx = Math.max(0, x - 1); xx <= Math.min(W - 1, x + w); xx++) {
          const idx = yy * W + xx;
          if (clearMask[idx] || path[idx] || wet[idx]) return false;
          if (!topIsForest && surface[idx] !== JpSurface.FOREST) return false;
        }
      }
      return true;
    };

    const forestCandidates: [number, number][] = [];
    for (let y = 0; y <= H - 5; y++) {
      for (let x = 0; x <= W - 3; x++) {
        const baseY = y + 4;
        const topForest = y <= 1 && surface[y * W + (x + 1)] === JpSurface.FOREST;
        if ((surface[baseY * W + (x + 1)] === JpSurface.FOREST || topForest) && !clearMask[baseY * W + (x + 1)]) {
          forestCandidates.push([x, y]);
        }
      }
    }
    for (let i = forestCandidates.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = forestCandidates[i]!;
      forestCandidates[i] = forestCandidates[j]!;
      forestCandidates[j] = tmp;
    }

    // 대숲은 한 덩이 키트만 되풀이하면 같은 꼴이 기둥처럼 쌓인다(R4 VQA) — 넓은 덩이·좁은 덩이·작은 무리를 섞는다.
    const bambooVariant = (): string => {
      const r = rand();
      return r < 0.5 ? "rg-bamboo-grove" : r < 0.82 ? "rg-bamboo-grove-b" : "rg-bamboo-clump";
    };
    const pickSpeciesAt = (x: number, y: number): string => {
      const n = Math.sin(x * 0.21 + seed * 0.9) + Math.cos(y * 0.19 - seed * 0.6) + 0.5 * Math.sin((x - y) * 0.13 + seed * 0.4);
      if (region.id === "bamboo_mountain_trail") {
        const isWest = x + n * 2.5 < W * 0.48;
        return isWest ? (rand() < 0.88 ? bambooVariant() : "rg-sugi") : (rand() < 0.88 ? "rg-sugi" : bambooVariant());
      }
      const idx = Math.max(0, Math.min(forestPool.length - 1, Math.floor(((n + 2.5) / 5.0) * forestPool.length)));
      const id = forestPool[idx]!;
      return id === "rg-bamboo-grove" ? bambooVariant() : id;
    };

    const pendingTrees: { kit: string; x: number; y: number; w: number; h: number }[] = [];

    for (const [x, y] of forestCandidates) {
      const id = pickSpeciesAt(x, y);
      const kit = regionKitId(id), s = kitSize(kit);
      if (!s || !isKitAllowedInRegion(region, id) || x + s.w > W || y + s.h > H) continue;
      if (!isForestTreeAllowed(x, y, s.w, s.h)) continue;

      // X 열이 겹치는 나무끼리는 밑동(y+h) 높이가 최소 3칸 이상 차이나야 앞 나무 수관이 뒤 나무 줄기만 자연스럽게 덮는다.
      // 같은 x 에서 바로 앞뒤(밑동 차 6칸 미만)로 쌓으면 같은 나무가 세로 기둥처럼 줄 선다(R4 VQA) — 그 자리는 옆으로 어긋난 후보에 넘긴다.
      const clashesWithPlaced = pendingTrees.some((pt) => {
        const xOverlap = x < pt.x + pt.w && x + s.w > pt.x;
        const dBase = Math.abs((y + s.h) - (pt.y + pt.h));
        if (xOverlap) return dBase < 3 || (x === pt.x && dBase < 6);
        return false;
      });
      if (clashesWithPlaced) continue;

      let blocked = false;
      const topIsForest = y <= 1 && surface[y * W + (x + 1)] === JpSurface.FOREST;
      for (let yy = y; yy < y + s.h && !blocked; yy++) {
        const isTrunk = yy >= y + s.h - 2;
        for (let xx = x; xx < x + s.w; xx++) {
          const idx = yy * W + xx;
          if (solidNonTree[idx] || upperCount[idx] >= 2) { blocked = true; break; }
          if (isTrunk && (trunkUsed[idx] || (!topIsForest && surface[idx] !== JpSurface.FOREST))) { blocked = true; break; }
        }
      }
      if (blocked) continue;

      for (let yy = y; yy < y + s.h; yy++) {
        for (let xx = x; xx < x + s.w; xx++) {
          const idx = yy * W + xx;
          upperCount[idx] = (upperCount[idx] ?? 0) + 1;
          if (yy >= y + s.h - 2) {
            trunkUsed[idx] = 1;
            used[idx] = 1;
          }
        }
      }
      pendingTrees.push({ kit, x, y, w: s.w, h: s.h });
    }

    pendingTrees.sort((a, b) => (a.y + a.h) - (b.y + b.h) || a.x - b.x);
    for (const t of pendingTrees) {
      stampSteps.push({ tool: "stamp_object", args: { objectId: `kit:jp_city/${t.kit}`, mapId, x: t.x, y: t.y }, note: t.kit });
      stampedRecords.push({ kit: t.kit, x: t.x, y: t.y, w: t.w, h: t.h, fromOp: "fillZone" });
      placed++;
    }
  }

  function paintForestZones(): void {
    // 마스크: 숲 구획 중 키트·길·물·비움 칸과 그 둘레 한 칸(숲 속 소품·건물로 가는 발 디딜 곳)을 뺀다.
    const near = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!used[i] && !path[i] && !wet[i]) continue;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < W && yy < H) near[yy * W + xx] = 1;
        }
      }
    }
    const kinds = new Array<number>(W * H).fill(0);
    const bambooPool = region.id !== "gorge_waterfall_trail";   // 옛 forestPool 과 같은 규칙: 계곡만 대숲이 없다
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (surface[i] !== JpSurface.FOREST || clearMask[i] || near[i]) continue;
        kinds[i] = 1;
      }
    }
    // 폭 1칸 숲 기둥(좌우가 다 비어 있는 칸)은 지운다 — 수관이 막대처럼 선다. 두 번 깎는다.
    for (let pass = 0; pass < 2; pass++) {
      const drop: number[] = [];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (!kinds[i]) continue;
          const l = x > 0 && kinds[i - 1], r = x + 1 < W && kinds[i + 1];
          if (!l && !r) drop.push(i);
        }
      }
      for (const i of drop) kinds[i] = 0;
    }
    // 숲 덩이(4방 연결)마다 한 종류: 대숲 산길은 서쪽 덩이·서쪽 칸이 대숲, 다른 지역은 덩이 노이즈로 가끔 대숲
    const seen = new Uint8Array(W * H);
    let comp = 0;
    for (let y0 = 0; y0 < H; y0++) {
      for (let x0 = 0; x0 < W; x0++) {
        if (!kinds[y0 * W + x0] || seen[y0 * W + x0]) continue;
        const cells: number[] = [];
        const st = [y0 * W + x0];
        seen[y0 * W + x0] = 1;
        while (st.length) {
          const i = st.pop()!;
          cells.push(i);
          const x = i % W, y = (i - x) / W;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const xx = x + dx, yy = y + dy, j = yy * W + xx;
            if (xx >= 0 && yy >= 0 && xx < W && yy < H && kinds[j] && !seen[j]) { seen[j] = 1; st.push(j); }
          }
        }
        if (cells.length < 6) {                 // 자투리(6칸 미만)는 숲 바닥으로 둔다
          for (const i of cells) kinds[i] = 0;
          continue;
        }
        comp++;
        if (region.id === "bamboo_mountain_trail") {
          // 서쪽은 대숲, 동쪽은 삼나무 — 경계 열 한 줄은 비워 두 숲이 서로 가장자리를 갖게 한다
          const n = Math.sin(seed * 0.9) * 2.5;
          for (const i of cells) {
            const x = i % W;
            const edge = W * 0.48 - n;
            kinds[i] = Math.abs(x - edge) < 0.5 ? 0 : x < edge ? 2 : 4;   // 동쪽은 삼나무(옛 흩뿌리기와 같은 짝)
          }
        } else {
          // 덩이마다 수종: 산·신사·절 숲은 삼나무가 주(사토야마 杉林), 봄은 벚나무 숲, 가끔 대숲, 나머지는 활엽(느티나무·잡목)
          const q = rand();
          const sugiBias = /mountain|shrine|temple|gorge|forest_railway|jizo|ropeway|ruins/u.test(region.id) ? 0.55 : 0.2;
          const sakuraBias = region.season === "spring" ? 0.35 : region.id.includes("castle") || region.id.includes("park") ? 0.25 : 0.05;
          const broad = region.season === "autumn" ? 5 : 1;   // 가을 지역의 활엽 숲은 단풍(계약 계절 규칙: 활엽수 잎을 단풍 램프로)
          const k = q < sugiBias ? 4 : q < sugiBias + sakuraBias ? 3 : (bambooPool && cells.length >= 12 && q < sugiBias + sakuraBias + 0.2) ? 2 : broad;
          for (const i of cells) kinds[i] = k;
        }
      }
    }
    if (!kinds.some((k) => k > 0)) return;
    for (let i = 0; i < W * H; i++) if (kinds[i]) used[i] = 1;
    stampSteps.push({ tool: "paint_forest", args: { mapId, kinds, seed, components: comp }, note: "forest" });
  }

  function validatePlan(): { violations: string[]; section4: JpRegionSection4Report } {
    const errs: string[] = [];
    let v1Failures = 0;
    let whitelistViolations = catalogWhitelistViolations;
    let signatureClones = 0;
    let strayTrees = 0;
    let stairEndpoints = 0;

    // 1) A1 / §4.1: 가장자리에서 시작하는 4방향 연결 경로(ROAD/LANE/WALK/PLAZA/TRAIL/DECK + 다리/계단/건널목/문) BFS
    const pathBridge = new Uint8Array(W * H);
    for (const r of stampedRecords) {
      if (
        r.kit.includes("bridge")
        || r.kit.includes("tsuribashi")
        || r.kit.includes("stairs")
        || r.kit.includes("fumikiri")
        || r.kit.includes("school-gate")
        || r.kit.includes("sanmon")
        || r.kit.includes("torii")
      ) {
        for (let yy = r.y; yy < r.y + r.h; yy++) {
          for (let xx = r.x; xx < r.x + r.w; xx++) pathBridge[yy * W + xx] = 1;
        }
      }
    }
    const isConnectedPathCell = (idx: number): boolean => isWalkablePathSurface(surface[idx]!) || pathBridge[idx] === 1;
    const edgeConnected = new Uint8Array(W * H);
    const bfsQueue: number[] = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (x === 0 || x === W - 1 || y === 0 || y === H - 1) {
          const idx = y * W + x;
          if (isConnectedPathCell(idx)) {
            edgeConnected[idx] = 1;
            bfsQueue.push(idx);
          }
        }
      }
    }
    let head = 0;
    while (head < bfsQueue.length) {
      const cur = bfsQueue[head++]!;
      const cx = cur % W, cy = Math.floor(cur / W);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const nIdx = ny * W + nx;
        if (!edgeConnected[nIdx] && isConnectedPathCell(nIdx)) {
          edgeConnected[nIdx] = 1;
          bfsQueue.push(nIdx);
        }
      }
    }

    for (const b of placedBuildings) {
      const checkY = Math.min(H - 1, b.foot + 1);
      let hasEdgeAccess = false;
      for (let xx = Math.max(0, b.x - 1); xx <= Math.min(W - 1, b.x + b.w); xx++) {
        if (edgeConnected[checkY * W + xx] === 1) {
          hasEdgeAccess = true;
          break;
        }
      }
      if (!hasEdgeAccess) {
        v1Failures++;
        errs.push(`V1: building ${b.kit} at (${b.x},${b.foot}) lacks edge-connected path at foot+1`);
      }
    }

    // 2) §4.2: 아키타입 화이트리스트 위반 검사
    for (const r of stampedRecords) {
      if (r.fromOp === "decal") continue;
      if (!isKitAllowedInRegion(region, r.kit)) {
        whitelistViolations++;
        errs.push(`V5: forbidden kit ${r.kit} in ${region.id}`);
      }
    }
    if (whitelistViolations > 0 && errs.every((e) => !e.startsWith("V5:"))) {
      errs.push(`V5: ${whitelistViolations} catalog whitelist violation(s)`);
    }

    // 3) §4.3: 대표(signature) 키트 맵당 최대 2회 및 인접 복제 금지
    for (const [k, count] of kitCounts) {
      if (isSignatureKit(k) && count > 2) {
        signatureClones += count - 2;
        errs.push(`A6: signature kit ${k} appears ${count} times (>2)`);
      }
    }
    if (adjacentClones > 0) {
      errs.push(`A6: ${adjacentClones} adjacent identical building(s)`);
    }

    // 4) §4.4: 고립된 나무/관목 금지 (FOREST·택지(YARD)·길·물가·담장/석축/건물에서 2칸 이내여야 함)
    const structuralRecords = stampedRecords.filter(
      (r) => r.kit.includes("wall-") || r.kit.includes("ishigaki") || r.kit.includes("bamboo-fence") || r.kit.includes("bldg-") || r.kit.includes("recipe-") || r.kit.includes("school") || r.kit.includes("honden") || r.kit.includes("pagoda") || r.kit.includes("tenshu") || r.kit.includes("shoro") || r.kit.includes("sanmon"),
    );
    for (const r of stampedRecords) {
      if (!isTreeOrBushKit(r.kit)) continue;
      const baseY0 = Math.max(r.y, r.y + r.h - 2);
      let anchored = false;
      for (let yy = Math.max(0, baseY0 - 2); yy <= Math.min(H - 1, r.y + r.h - 1 + 2) && !anchored; yy++) {
        for (let xx = Math.max(0, r.x - 2); xx <= Math.min(W - 1, r.x + r.w - 1 + 2); xx++) {
          const s = surface[yy * W + xx]!;
          if (
            s === JpSurface.FOREST
            || s === JpSurface.YARD
            || isWalkablePathSurface(s)
            || s === JpSurface.WATER
          ) {
            anchored = true;
            break;
          }
        }
      }
      if (!anchored) {
        for (const st of structuralRecords) {
          if (st.x <= r.x + r.w + 2 && st.x + st.w >= r.x - 2 && st.y <= r.y + r.h + 2 && st.y + st.h >= r.y - 2) {
            anchored = true;
            break;
          }
        }
      }
      if (!anchored) {
        strayTrees++;
        errs.push(`A3: stray tree/bush ${r.kit} at (${r.x},${r.y})`);
      }
    }

    // 5) §4.5: 모든 돌계단은 석축(ishigaki)을 가로지르고 위·아래 양끝에 길(path)이 닿아야 함
    const ishigakiRecords = stampedRecords.filter((r) => r.kit === "jp-rg-ishigaki");
    for (const r of stampedRecords) {
      if (!r.kit.includes("stairs")) continue;
      const straddlesWall = ishigakiRecords.some((w) => w.y < r.y + r.h && w.y + w.h > r.y);
      let topPath = false;
      let botPath = false;
      const topY = Math.max(0, r.y - 1);
      const botY = Math.min(H - 1, r.y + r.h);
      for (let xx = r.x; xx < r.x + r.w; xx++) {
        if (isWalkablePathSurface(surface[topY * W + xx]!)) topPath = true;
        if (isWalkablePathSurface(surface[botY * W + xx]!)) botPath = true;
      }
      if (!straddlesWall || !topPath || !botPath) {
        stairEndpoints++;
        errs.push(`A10: stair ${r.kit} at (${r.x},${r.y}) missing wall(${straddlesWall}) or path(top:${topPath},bot:${botPath})`);
      }
    }

    // V2: 논/물 위 금지 키트 검사
    for (const r of stampedRecords) {
      if (r.fromOp === "decal") continue;
      const baseRow = r.y + r.h - 1;
      for (let xx = r.x; xx < r.x + r.w; xx++) {
        const s = surface[baseRow * W + xx]!;
        if (s === JpSurface.PADDY && !canPlaceOnPaddy(r.kit)) {
          errs.push(`V2: non-paddy kit ${r.kit} on PADDY at (${xx},${baseRow})`);
          break;
        }
        if (s === JpSurface.WATER && !canPlaceOnWater(r.kit)) {
          errs.push(`V2: non-water kit ${r.kit} on WATER at (${xx},${baseRow})`);
          break;
        }
      }
    }

    // V6: 열차는 반드시 RAIL 위에
    for (const r of stampedRecords) {
      if (r.kit.includes("train")) {
        let onRail = false;
        for (let yy = r.y; yy < r.y + r.h && !onRail; yy++) {
          for (let xx = r.x; xx < r.x + r.w; xx++) {
            if (surface[yy * W + xx] === JpSurface.RAIL) onRail = true;
          }
        }
        if (!onRail) errs.push(`V6: train ${r.kit} at (${r.x},${r.y}) not on RAIL`);
      }
    }

    return {
      violations: errs,
      section4: {
        v1Failures,
        whitelistViolations,
        signatureClones,
        adjacentClones,
        strayTrees,
        stairEndpoints,
      },
    };
  }
}
