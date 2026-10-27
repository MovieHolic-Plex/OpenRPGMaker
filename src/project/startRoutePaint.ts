// project/startRoutePaint.ts
// 첫 구간 길 맵을 칩셋별 재료로 깐다 — 길 한 줄이 입구에서 구간 끝까지 한 번 꺾여 가고, 끝에 마당이 앉는다.
//
// 왜 (2026-10-11 사용자 지적 「현대 타일은 아예 안 쓰고, 길 맵은 다 똑같이 나온다」):
//   뼈대의 길 맵은 늘 시작 맵의 타일셋(= 빈 시작 맵 = 버들항)으로 만들어졌고, 모험 장르는 길을 아예 깔지 않았다(빈 풀밭),
//   스토리는 늘 같은 광장(기둥·산울타리·벤치)이었다. 그리고 컨셉의 tilesetHint(jp_city·조선·마법 학교)는 기획서에 글 한 줄로만
//   들어가 코드가 한 번도 읽지 않았다 — 조수는 「보는 맵의 칩셋 계열」을 따르므로 버들항 빈 맵에서는 현대 거리도 로마풍으로 깔렸다.
// 이 모듈은 칩셋마다 길·마당 재료 이름을 두고, 길 모양은 기획 구상(startVariety)에서 가져온다.

import { createJpCityTileset } from "@/project/defaults/jpCity";
import { translateTiles } from "@/project/objectStamp";
import { isWaterfrontRouteName, type StartPlan } from "@/project/startVariety";
import type { GameMap, Project, TilesetDef } from "@/project/types";
import { isWaterRole } from "@/project/tileRoles";
export interface RouteStyle {
  /** 길 폭(칸). */
  readonly roadWidth: number;
  /** fill_region material — 타일 라벨/그룹 이름. */
  readonly road: string;
  readonly yard: string;
  /** 맵 바탕 재료. 칩셋의 「빈 칸」 타일이 잔디가 아닐 때(일본 도시는 흙색 자갈) 길 맵·시작 맵을 이 재료로 먼저 덮는다. 없으면 빈 칸 그대로. */
  readonly ground?: string;
  /** true 면 시작 맵에 큰길을 깔지 않는다(성채 실내 같은 칩셋은 «거리» 가 아니다). */
  readonly noMainStreet?: boolean;
  /** 길 양옆 띠(보도 연석 같은 것). 없으면 생략. 못 칠하면 조용히 건너뛴다(장식이다). */
  readonly edge?: string;
  /** 강변·물가 테마(plan.theme === "river")일 때 북쪽 3~4줄에 깔 물 재료와 그 아래 제방 1줄 재료. */
  readonly water?: string;
  readonly embankment?: string;
}

/** 칩셋 id → 길 재료. 이름은 각 칩셋의 오토타일 그룹 이름이다(show: ensureBundledTilesets 의 autotileGroups). */
export const ROUTE_STYLES: Readonly<Record<string, RouteStyle>> = {
  beodeul_city: { roadWidth: 2, road: "버들항 길 포석", yard: "버들항 광장 판석", water: "버들항 강·운하 물", embankment: "버들항 광장 판석" },
  jp_city: { roadWidth: 3, ground: "잔디", road: "생활도로", yard: "판석 광장", edge: "보도 연석", water: "수로", embankment: "보도 연석" },
  joseon_baram: { roadWidth: 2, road: "조선 흙길", yard: "조선 마당", water: "조선 강·연못", embankment: "조선 마당" },
  wizarding_world: { roadWidth: 2, noMainStreet: true, road: "숲길 흙", yard: "성채 포석(오토타일)" },
  sengoku_edo: { roadWidth: 3, noMainStreet: true, ground: "풀밭", road: "다진 흙길", yard: "돌길(이시다타미)", embankment: "돌길(이시다타미)" },
  sky_island: { roadWidth: 1, noMainStreet: true, ground: "풀밭", road: "디딤돌 길(1)", yard: "광장 자갈 포석" },
  modern_campus: { roadWidth: 2, noMainStreet: true, ground: "캠퍼스 잔디", road: "보도블록", yard: "화강암 판석", edge: "콘크리트 산책로", embankment: "화강암 판석" },
  // 도쿄풍 도시: 시작 맵 거리는 조수가 compose_modern_city_street 로 통째로 짠다 — 큰길을 미리 칠하면 구성기가 replace 를 요구한다.
  modern_city: { roadWidth: 2, noMainStreet: true, ground: "잔디", road: "보도 포석", yard: "보도 포석", edge: "보도+연석", embankment: "보도+연석" },
  desert_east: { roadWidth: 2, noMainStreet: true, ground: "잔잔한 모래", road: "다진 흙길", yard: "사암 포석" },
  snow_north: { roadWidth: 2, noMainStreet: true, ground: "눈밭(바람 물결)", road: "다진 눈길 (설원 오토타일)", yard: "진창 (설원 오토타일)" },
};

/**
 * 시작 맵 크기 — 컨셉의 칩셋으로 옮긴 빈 시작 맵(20×15)은 거리 한 줄·건물 한 채도 못 놓는다(2026-10-12 jp_city 도그푸딩: 조수가
 * 건물 사각형이 맵 밖이라 build_jp_city_building 을 거절당했다). 칩셋마다 거리·마을 한 장이 서는 크기를 씨앗으로 조금 흔든다.
 */
export function startMapSizeFor(tilesetId: string, plan: StartPlan): { width: number; height: number } | undefined {
  const base = tilesetId === "jp_city" ? { w: 52, h: 34 } : tilesetId === "joseon_baram" ? { w: 48, h: 36 } : tilesetId === "wizarding_world" ? { w: 48, h: 36 } : tilesetId === "sengoku_edo" ? { w: 56, h: 48 } : tilesetId === "sky_island" ? { w: 50, h: 34 } : tilesetId === "modern_campus" ? { w: 48, h: 36 } : tilesetId === "desert_east" ? { w: 48, h: 36 } : tilesetId === "snow_north" ? { w: 46, h: 36 } : tilesetId === "modern_city" ? { w: 60, h: 48 } : undefined;
  if (!base) return undefined;
  return { width: base.w + (plan.seed % 3) * 4, height: base.h + ((plan.seed >> 2) % 3) * 3 };
}

export function routeStyleFor(tilesetId: string): RouteStyle | undefined {
  return ROUTE_STYLES[tilesetId];
}

type Fill = (rect: { x: number; y: number; w: number; h: number }, material: string, optional?: boolean) => void;

/**
 * 길 모양: 입구(0,entryY) → 꺾이는 x → 끝 줄(endY) → 끝 마당(구간 끝 이벤트가 마당 안, x=width-2).
 * 꺾이는 x 와 마당 크기는 씨앗이 정한다. 같은 구상이면 같은 길이다.
 */
export function paintStartRoute(fill: Fill, style: RouteStyle, plan: StartPlan, route: { width: number; height: number; entryY: number; endY: number }): void {
  const { width: W, height: H, entryY, endY } = route;
  const w = style.roadWidth;
  if (style.ground) fill({ x: 0, y: 0, w: W, h: H }, style.ground, true);
  const river = plan.theme === "river" && H >= 14;
  const waterRows = river ? (H >= 15 ? 4 : 3) : 0;
  if (river && style.water) fill({ x: 0, y: 0, w: W, h: waterRows }, style.water, true);
  if (river && style.embankment) fill({ x: 0, y: waterRows, w: W, h: 1 }, style.embankment, true);
  const minRoadY = river ? waterRows + 2 : 0;
  const bendX = Math.max(6, Math.min(W - 9, Math.round(W * (0.3 + ((plan.seed % 97) / 97) * 0.35))));
  const yardW = 4 + (plan.seed % 3);            // 4..6
  const yardH = 3 + ((plan.seed >> 3) % 3);     // 3..5
  const clampY = (y: number, h: number): number => Math.max(minRoadY, Math.min(H - h, y));
  const yardX = W - 1 - yardW;
  const yardY = clampY(endY - Math.floor(yardH / 2), yardH);
  const y1 = clampY(entryY, w), y2 = clampY(endY, w);
  if (style.edge) {
    // 보도 연석: 길 위·아래 한 줄(없는 칸은 건너뜀). 장식이라 실패해도 길은 선다.
    fill({ x: 0, y: Math.max(minRoadY, y1 - 1), w: bendX + w, h: 1 }, style.edge, true);
    fill({ x: 0, y: Math.min(H - 1, y1 + w), w: bendX + w, h: 1 }, style.edge, true);
  }
  fill({ x: 0, y: y1, w: bendX + w, h: w }, style.road);
  fill({ x: bendX, y: Math.min(y1, y2), w, h: Math.abs(y2 - y1) + w }, style.road);
  fill({ x: bendX, y: y2, w: W - bendX, h: w }, style.road);
  fill({ x: yardX, y: yardY, w: yardW, h: yardH }, style.yard);
  // 끝 이벤트 칸(W-2, endY)이 마당 밖이면 길로 덮는다.
  fill({ x: W - 2, y: y2, w: 1, h: 1 }, style.road);
}

/**
 * 시작 맵의 큰길 — 시작 칸 줄을 서쪽 끝에서 동쪽 끝(문)까지 가로지르는 길 한 줄. 컨셉 칩셋으로 옮긴 빈 시작 맵에 AI 가 건물을 앉힐 기준선이다.
 * 빈 땅 한 장에서 시작하면 조수가 거리의 뼈대부터 다시 짜야 해서 칩셋 도구(건물 조립·길 키트)를 쓰기 전에 턴이 끝난다.
 */
export function paintMainStreet(fill: Fill, style: RouteStyle, size: { width: number; height: number }, rowY: number): void {
  const w = style.roadWidth;
  const y0 = Math.max(1, Math.min(size.height - w - 1, rowY - Math.floor(w / 2)));
  if (style.edge) {
    fill({ x: 0, y: y0 - 1, w: size.width, h: 1 }, style.edge, true);
    fill({ x: 0, y: y0 + w, w: size.width, h: 1 }, style.edge, true);
  }
  fill({ x: 0, y: y0, w: size.width, h: w }, style.road);
}

function shiftIncomingTransfersToMap(project: Project, targetMapId: string, matchY: (y: number) => number | undefined): void {
  for (const m of Object.values(project.maps)) {
    for (const ev of m.events) {
      for (const page of ev.pages ?? []) {
        for (const cmd of page.commands) {
          if (cmd.kind !== "transfer" || cmd.mapId !== targetMapId) continue;
          const oldY = cmd.y;
          if (!Number.isFinite(oldY)) continue;
          const nextY = matchY(oldY);
          if (nextY !== undefined && nextY !== oldY) {
            cmd.y = nextY;
          }
        }
      }
    }
  }
}

/** 강변·수변 산책로 맵 높이가 15 미만(예: 11)이면 위쪽에 줄을 더해 최소 15줄을 확보하고 기존 이벤트·이동을 함께 내린다. */
export function ensureRiversideHeight(project: Project, map: GameMap, minHeight = 15): number {
  if (map.height >= minHeight) return 0;
  const oldH = map.height;
  const W = map.width;
  const deltaY = minHeight - oldH;
  const padLow = new Array<number>(W * deltaY).fill(map.lowerTiles[0] ?? 0);
  const padEmpty = new Array<number>(W * deltaY).fill(-1);
  map.lowerTiles = [...padLow, ...map.lowerTiles];
  map.lowerOverlayTiles = [...padEmpty, ...(map.lowerOverlayTiles ?? new Array<number>(W * oldH).fill(-1))];
  map.upperTiles = [...padEmpty, ...(map.upperTiles ?? new Array<number>(W * oldH).fill(-1))];
  map.upperOverlayTiles = [...padEmpty, ...(map.upperOverlayTiles ?? new Array<number>(W * oldH).fill(-1))];
  map.height = minHeight;
  for (const ev of map.events) ev.y = Math.min(minHeight - 1, ev.y + deltaY);
  if (project.startMapId === map.id) {
    project.startPos = { ...project.startPos, y: Math.min(minHeight - 1, project.startPos.y + deltaY) };
  }
  shiftIncomingTransfersToMap(project, map.id, (y) => Math.min(minHeight - 1, y + deltaY));
  return deltaY;
}

const RIVER_GROUP_ID = "riverside-pond-water";
/** 8방 오토타일 비트(autotileEngine AUTOTILE_DIR 순서)와 이웃 칸 오프셋. */
const RIVER_NEIGHBORS: readonly (readonly [number, number, number])[] = [
  [1, 0, -1], [2, 1, 0], [4, 0, 1], [8, -1, 0], [16, 1, -1], [32, 1, 1], [64, -1, 1], [128, -1, -1],
];

/**
 * 강물 8방 오토타일(jp_city 「연못」 47모양: 석축 테두리 + 물결)을 현대 칩셋에 이식해 마스크→타일 표를 돌려준다.
 * modern_city 연못 물(23번)은 칸마다 아래쪽 포말 줄이 있어 여러 줄을 쌓으면 자로 그은 가로줄이 됐다(2026-10-18 VQA: 「강이 엉망진창」).
 */
export function ensureRiverWaterAutotile(project: Project, ts: TilesetDef): Readonly<Record<string, number>> {
  const own = ts.autotileGroups?.find((g) => g.id === RIVER_GROUP_ID);
  if (own) return own.variantMap;
  const jp = project.tilesets.jp_city ?? createJpCityTileset();
  const pond = jp.autotileGroups?.find((g) => g.id === "jp-water-pond") ?? createJpCityTileset().autotileGroups!.find((g) => g.id === "jp-water-pond")!;
  const { map } = translateTiles(jp, ts, pond.memberTileIds);
  const t = (n: number) => map.get(n) ?? n;
  const variantMap: Record<string, number> = {};
  for (const [mask, tile] of Object.entries(pond.variantMap)) variantMap[mask] = t(tile);
  const members = pond.memberTileIds.map(t);
  ts.autotileGroups = [...(ts.autotileGroups ?? []), { ...structuredClone(pond), id: RIVER_GROUP_ID, name: "강·연못 물(석축 테두리)", memberTileIds: members, connectTileIds: members, variantMap }];
  return variantMap;
}

/** 구조 키트 하나를 위층에 찍는다. 발자국이 맵 밖이거나 이미 찬 칸(이벤트 주변·앞서 찍은 키트)에 걸치면 찍지 않는다. 찍으면 발자국을 occupied 에 넣는다. */
function stampRiversideKit(
  ts: TilesetDef,
  map: GameMap,
  kitId: string,
  x0: number,
  y0: number,
  occupied: Set<number>,
): boolean {
  const kit = ts.structureKits?.find((k) => k.id === kitId);
  if (!kit) return false;
  const W = map.width, H = map.height;
  if (x0 < 0 || y0 < 0 || x0 + kit.width > W || y0 + kit.height > H) return false;
  for (let dy = 0; dy < kit.height; dy++) {
    for (let dx = 0; dx < kit.width; dx++) {
      if (occupied.has((y0 + dy) * W + (x0 + dx))) return false;
    }
  }
  for (let dy = 0; dy < kit.height; dy++) {
    const row = kit.rows[dy];
    for (let dx = 0; dx < kit.width; dx++) {
      const idx = (y0 + dy) * W + (x0 + dx);
      occupied.add(idx);
      const up = row?.upperTiles?.[dx];
      if (typeof up === "number" && up >= 0) map.upperTiles[idx] = up;
    }
  }
  return true;
}

/** 칩셋별 강변 바닥 재료(lower 타일 번호)와 소품 키트 이름. 캠퍼스 칩셋에 없는 키트는 조용히 건너뛴다. */
const RIVERSIDE_PALETTES = {
  modern_city: {
    grass: 17, grassShade: 18, flower: 19, walkTop: 20, walk: 7, walkAlt: 8, walkBot: 20, paved: 7, pavedAlt: 8, path: 22,
    trees: ["mc-prop-ginkgo-a", "mc-prop-keyaki-a", "mc-prop-blossom-a"], lamp: "mc-prop-park-lamp-a", bench: "mc-prop-bench-c", planter: "mc-prop-planter-b",
  },
  modern_campus: {
    grass: 1, grassShade: 4, flower: 3, walkTop: 7, walk: 8, walkAlt: 9, walkBot: 7, paved: 8, pavedAlt: 9, path: 9,
    trees: ["mc-tree-zelkova", "mc-tree-ginkgo"], lamp: "mc-lamp", bench: "mc-bench", planter: "mc-planter",
  },
} as const;

/**
 * 강변·수변·호숫가 산책로를 깐다(2026-10-18 적대적 VQA: 강이 자로 그은 직선이고 남쪽 절반이 빈 잔디 사각형이었다):
 * - 높이 최소 15줄. 북쪽 강물은 씨앗마다 다른, 맵을 비스듬히 가로지르는 굽이(깊이 3~8줄, 이웃 열과 1줄 넘게 차이 나지 않음) + 굽이 따라 석축 제방 1줄
 *   (romance-waterfront-no-water 기준 물 15%·3줄 이상 유지), 물로 2줄 나간 돌 전망 부두 하나
 * - 제방 아래 잔디·화단 띠에 가로수와 가로등을 번갈아(나무 3줄이 들어가는 자리에만)
 * - 끊기지 않는 연속 돌 산책로 4줄(위 연석 · 포석 2줄 · 아래 연석) — 이동 이벤트·NPC 는 이 줄로 맞춘다
 * - 산책로 남쪽: 6줄 이상이면 세 구획 — 분수 광장(포석 + 분수 + 벤치) · 카페 테라스(테라스 자리·매점) · 꽃 정원(굽은 모래 오솔길·꽃밭·철쭉·벚나무),
 *   맨 아래는 가로등 선 보도. 그보다 얕으면 화단 띠 + 벤치·화분 교대.
 */
export function paintRiversidePromenade(
  project: Project,
  map: GameMap,
  plan?: Partial<Pick<StartPlan, "entryY" | "endY" | "seed">>,
): void {
  ensureRiversideHeight(project, map, 15);
  const W = map.width, H = map.height;
  if (!map.lowerOverlayTiles || map.lowerOverlayTiles.length !== W * H) map.lowerOverlayTiles = new Array<number>(W * H).fill(-1);
  if (!map.upperTiles || map.upperTiles.length !== W * H) map.upperTiles = new Array<number>(W * H).fill(-1);
  if (!map.upperOverlayTiles || map.upperOverlayTiles.length !== W * H) map.upperOverlayTiles = new Array<number>(W * H).fill(-1);

  let a = (Math.floor(plan?.seed ?? 1) >>> 0) || 1;
  const rnd = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const baseWaterDepth = H >= 20 ? 5 : 4;

  const ts = project.tilesets[map.tilesetId];
  if (map.tilesetId !== "modern_city" && map.tilesetId !== "modern_campus") {
    const waterTile = map.tilesetId === "jp_city" ? 849 : map.tilesetId === "beodeul_city" ? 8 : map.tilesetId === "joseon_baram" ? 48 : map.tilesetId === "sengoku_edo" ? 32 : undefined;
    const embankTile = map.tilesetId === "jp_city" ? 850 : map.tilesetId === "sengoku_edo" ? 34 : undefined;
    if (waterTile !== undefined) {
      for (let y = 0; y < baseWaterDepth; y++) {
        for (let x = 0; x < W; x++) {
          const idx = y * W + x;
          map.lowerTiles[idx] = waterTile;
          map.lowerOverlayTiles[idx] = -1;
          map.upperTiles[idx] = -1;
          map.upperOverlayTiles[idx] = -1;
        }
      }
      if (embankTile !== undefined) {
        for (let x = 0; x < W; x++) {
          const idx = baseWaterDepth * W + x;
          map.lowerTiles[idx] = embankTile;
          map.upperTiles[idx] = -1;
        }
      }
    }
    return;
  }

  const isCampus = map.tilesetId === "modern_campus";
  const P = RIVERSIDE_PALETTES[isCampus ? "modern_campus" : "modern_city"];
  if (!ts) throw new Error(`강변 산책로: 맵 ${map.id} 의 타일셋 ${map.tilesetId} 이 프로젝트에 없습니다`);
  const river = ensureRiverWaterAutotile(project, ts);

  // 강 굽이: 사인 두 개를 겹친 깊이(3..base+3), 이웃 열과 한 줄 넘게 차이 나지 않게 다듬는다.
  // 진폭 1.1 → 1.9 도 위쪽 띠로 보였다(2026-10-18 VQA 4회차) — 맵을 0.75 바퀴 가로지르는 긴 굽이(진폭 2.6)로 강이 비스듬히 흐르게 한다.
  const phase = rnd() * Math.PI * 2, phase2 = rnd() * Math.PI * 2;
  const depth: number[] = [];
  for (let x = 0; x < W; x++) {
    const v = baseWaterDepth + 0.5 + 2.6 * Math.sin((x / W) * Math.PI * 2 * 0.75 + phase) + 0.8 * Math.sin((x / W) * Math.PI * 2 * 1.9 + phase2);
    depth.push(Math.max(3, Math.min(baseWaterDepth + 3, Math.round(v))));
  }
  for (let x = 1; x < W; x++) depth[x] = Math.max(depth[x - 1]! - 1, Math.min(depth[x - 1]! + 1, depth[x]!));
  // 열마다 한 줄씩 오르내리면 둑이 계단처럼 깨져 보였다(2026-10-18 사용자 반려 「강은 엉망진창」) — 한 깊이를 최소 4열 이어 긴 둑선이 완만히 꺾이게 한다.
  for (let x = 1, run = 1; x < W; x++) {
    if (depth[x] !== depth[x - 1] && run < 4) { depth[x] = depth[x - 1]!; run++; }
    else run = depth[x] === depth[x - 1] ? run + 1 : 1;
  }
  const deepest = Math.max(...depth);
  // 제방 아래 잔디 띠는 나무(3줄)가 들어가도록 최소 3줄, 남쪽에 최소 2줄 남긴다.
  const walkTopY = Math.min(H - 6, deepest + 4);
  const walkMidY1 = walkTopY + 1;
  const walkMidY2 = walkTopY + 2;
  const walkBotY = walkTopY + 3;
  // 시작 맵이면 주인공을 강물이 아닌 산책로 가운데 줄에 세운다(강 굽이가 씨앗마다 달라 고정 줄은 물에 빠진다).
  if (project.startMapId === map.id) project.startPos = { ...project.startPos, x: Math.min(W - 2, Math.max(1, project.startPos.x)), y: walkMidY1 };
  const southY0 = walkBotY + 1;
  const southRows = H - southY0;

  // 이동 이벤트와 NPC 가 물·제방·나무 줄에 걸리지 않고 연속 산책로 위에 서도록 정렬한다.
  for (const ev of map.events) {
    const isEdgeGate = ev.x <= 1 || ev.x >= W - 2 || /starter|end|gate|exit|enter/iu.test(ev.id);
    if (isEdgeGate) {
      const targetY = plan?.entryY && ev.x <= 1 ? Math.max(walkMidY1, Math.min(walkMidY2, plan.entryY)) : walkMidY2;
      if (ev.y !== targetY) {
        const prevY = ev.y;
        ev.y = targetY;
        shiftIncomingTransfersToMap(project, map.id, (y) => (Math.abs(y - prevY) <= 2 ? targetY : undefined));
      }
    } else if (ev.y < walkTopY || ev.y > walkBotY) {
      ev.y = walkTopY;
    }
  }

  // 바닥: 물(석축 테두리 오토타일) · 물가 화단·잔디 띠 · 산책로 4줄 · 남쪽 잔디(아래에서 구획을 덧칠한다).
  // 부두는 가장 깊고 평평한 둑(세 열 같은 깊이)에서 물 쪽으로 4줄 - 얕은 굽이에 서면 맵 위 가장자리에 붙은 돌덩이로 보였다(VQA 14회차).
  const pierW = 3;
  let pierX = Math.max(2, Math.floor(W * 0.2));
  for (let x = Math.max(2, Math.floor(W * 0.2)); x <= W - pierW - 2; x++) {
    if (depth[x] !== depth[x + 1] || depth[x] !== depth[x + 2]) continue;
    if (depth[x]! > depth[pierX]! || (depth[x] === depth[pierX] && rnd() < 0.3)) pierX = x;
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      const d = depth[x]!;
      const onPier = depth[pierX]! >= 5 && x >= pierX && x < pierX + pierW && y >= d - 3 && y <= d;
      let tile: number;
      if (onPier) tile = x === pierX + 1 ? P.pavedAlt : P.paved;
      else if (y < d) tile = -2;
      else if (y < walkTopY) tile = y === d && (x + d) % 5 <= 1 ? P.flower : y === walkTopY - 1 && (x * 3 + y) % 7 <= 1 ? P.grassShade : P.grass;
      else if (y === walkTopY) tile = P.walkTop;
      else if (y === walkMidY1 || y === walkMidY2) tile = (x * 2 + y) % 5 === 1 ? P.walkAlt : P.walk;
      else if (y === walkBotY) tile = P.walkBot;
      else tile = (x * 5 + y * 3) % 11 === 0 ? P.grassShade : P.grass;
      map.lowerTiles[idx] = tile;
      map.lowerOverlayTiles[idx] = -1;
      map.upperTiles[idx] = -1;
      map.upperOverlayTiles[idx] = -1;
    }
  }
  // 물 칸은 8방 이웃(맵 밖 북쪽·좌우는 물로 이어짐, 부두는 뭍)으로 테두리 모양을 고른다.
  const wet = map.lowerTiles.map((t) => t === -2);
  const isWater = (x: number, y: number): boolean => {
    if (y < 0) return true;
    if (y >= H) return false;
    const cx = Math.max(0, Math.min(W - 1, x));
    return wet[y * W + cx]!;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!wet[y * W + x]) continue;
    let mask = 0;
    for (const [bit, dx, dy] of RIVER_NEIGHBORS) if (isWater(x + dx, y + dy)) mask |= bit;
    map.lowerTiles[y * W + x] = river[String(mask)] ?? river[String(mask & 15)] ?? river["255"]!;
  }
  const paint = (x0: number, y0: number, x1: number, y1: number, tile: number): void => {
    for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) map.lowerTiles[y * W + x] = tile;
  };

  // 남쪽 구획 바닥 — 세 구획(광장·테라스·정원)을 씨앗으로 섞어 놓는다.
  type Block = "plaza" | "terrace" | "garden";
  const blocks: { kind: Block; x0: number; x1: number }[] = [];
  if (southRows >= 6) {
    // 세 구획 순서는 Fisher–Yates, 경계는 ±2칸 흔든다(sort 비교 난수는 씨앗 1·7 이 같은 순서를 냈다 — VQA 4회차).
    const order: Block[] = ["plaza", "terrace", "garden"];
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j]!, order[i]!]; }
    const jitter = () => Math.floor(rnd() * 5) - 2;
    const cuts = [0, Math.floor(W / 3) + jitter(), Math.floor((2 * W) / 3) + jitter(), W];
    for (let k = 0; k < 3; k++) blocks.push({ kind: order[k]!, x0: cuts[k]!, x1: cuts[k + 1]! - 1 });
    const bottomY = H - 1;
    paint(0, bottomY, W - 1, bottomY, P.paved);
    for (const b of blocks) {
      if (b.kind === "plaza") {
        paint(b.x0 + 1, southY0, b.x1 - 1, bottomY - 1, P.paved);
        for (let x = b.x0 + 1; x <= b.x1 - 1; x++) for (let y = southY0; y < bottomY; y++) if ((x + y) % 4 === 0) map.lowerTiles[y * W + x] = P.pavedAlt;
        paint(b.x0, southY0, b.x0, bottomY - 1, P.flower);
        paint(b.x1, southY0, b.x1, bottomY - 1, P.flower);
      } else if (b.kind === "terrace") {
        paint(b.x0 + 1, southY0 + 1, b.x1 - 1, bottomY - 1, P.pavedAlt);
        paint(b.x0, southY0, b.x1, southY0, P.flower);
        const gap = Math.floor((b.x0 + b.x1) / 2);
        paint(gap - 1, southY0, gap + 1, southY0, P.paved);
      } else {
        // 굽은 오솔길: 산책로에서 맨 아래 보도까지 한 줄에 한 칸씩 옆으로 흔들린다.
        let px = Math.floor((b.x0 + b.x1) / 2);
        for (let y = southY0; y < bottomY; y++) {
          paint(px - 1, y, px, y, P.path);
          const step = rnd() < 0.5 ? -1 : 1;
          px = Math.max(b.x0 + 2, Math.min(b.x1 - 2, px + step));
        }
        for (let y = southY0 + 1; y < bottomY; y++) for (let x = b.x0; x <= b.x1; x++) {
          const idx = y * W + x;
          if (map.lowerTiles[idx] === P.path) continue;
          if ((x + 2 * y) % 6 <= 1 && y % 3 !== 0) map.lowerTiles[idx] = P.flower;
        }
      }
    }
  } else {
    for (let x = 0; x < W; x++) if (x % 6 >= 1 && x % 6 <= 3) map.lowerTiles[southY0 * W + x] = P.flower;
  }

  if (!ts) return;
  const occupied = new Set<number>();
  for (const ev of map.events) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const rx = ev.x + dx, ry = ev.y + dy;
        if (rx >= 0 && rx < W && ry >= 0 && ry < H) occupied.add(ry * W + rx);
      }
    }
  }
  // 산책로 4줄과 부두는 비워 둔다(걷는 길).
  for (let y = walkTopY; y <= walkBotY; y++) for (let x = 0; x < W; x++) occupied.add(y * W + x);
  if (depth[pierX]! >= 5) for (let x = pierX; x < pierX + pierW; x++) for (let y = depth[x]! - 3; y <= depth[x]!; y++) occupied.add(y * W + x);

  // 물가 띠: 가로수(나무 3줄이 제방 아래 잔디에 들어가는 자리) 사이사이 가로등, 산책로 쪽 벤치.
  const treeStep = 6 + Math.floor(rnd() * 2);
  const xShift = Math.floor(rnd() * 4);
  let treeK = Math.floor(rnd() * P.trees.length);
  for (let x = 1 + xShift; x + 2 <= W; x += treeStep) {
    const treeY = Math.max(depth[x]!, depth[x + 1]!) + 1;
    if (treeY + 3 > walkTopY) continue;
    if (stampRiversideKit(ts, map, P.trees[treeK % P.trees.length]!, x, treeY, occupied)) treeK++;
    const lampX = x + Math.floor(treeStep / 2) + 1;
    if (lampX < W - 1) stampRiversideKit(ts, map, P.lamp, lampX, walkTopY - 2, occupied);
  }
  // 강이 얕게 물러난 굽이 안쪽은 잔디가 7줄 이상 비므로 3줄 아래에 엇갈린 둘째 줄 나무(자리가 없으면 화분)로 강변 숲을 채운다.
  for (let x = 1 + xShift + Math.floor(treeStep / 2); x + 2 <= W; x += treeStep) {
    const shore = Math.max(depth[x]!, depth[x + 1]!, depth[Math.max(0, x - 1)]!) + 1;
    if (walkTopY - shore < 7) continue;
    if (stampRiversideKit(ts, map, P.trees[treeK % P.trees.length]!, x - 1, shore + 3, occupied)) treeK++;
    else stampRiversideKit(ts, map, P.planter, x, shore + 3, occupied);
  }
  for (let x = 3 + xShift; x + 2 <= W - 1; x += 9) stampRiversideKit(ts, map, "mc-in-mci-bench-metal", x, walkTopY - 1, occupied);

  if (!blocks.length) {
    for (let x = 2 + xShift; x + 2 <= W - 1; x += 6) {
      const flip = (Math.floor(x / 6) + treeK) % 2 === 0;
      stampRiversideKit(ts, map, flip ? P.bench : P.planter, x, Math.min(H - 2, southY0 + 1), occupied);
    }
    return;
  }

  // 남쪽 구획 소품.
  const bottomY = H - 1;
  for (const b of blocks) {
    const cx = Math.floor((b.x0 + b.x1) / 2);
    if (b.kind === "plaza") {
      const fy = southY0 + Math.max(1, Math.floor((bottomY - southY0 - 4) / 2));
      stampRiversideKit(ts, map, "mc-prop-fountain-a", cx - 2, fy, occupied);
      stampRiversideKit(ts, map, P.bench, b.x0 + 1, fy + 1, occupied);
      stampRiversideKit(ts, map, P.bench, b.x1 - 2, fy + 1, occupied);
      stampRiversideKit(ts, map, "mc-prop-bigpot-a", b.x0 + 1, southY0, occupied);
      stampRiversideKit(ts, map, "mc-prop-bigpot-b", b.x1 - 1, southY0, occupied);
      stampRiversideKit(ts, map, P.planter, b.x0 + 1, bottomY - 1, occupied);
      stampRiversideKit(ts, map, P.planter, b.x1 - 1, bottomY - 1, occupied);
    } else if (b.kind === "terrace") {
      stampRiversideKit(ts, map, ["mc-prop-kiosk-a", "mc-prop-kiosk-b", "mc-prop-kiosk-c"][Math.floor(rnd() * 3)]!, b.x0 + 1, southY0 + 1, occupied);
      const terraces = ["mc-prop-terrace-a", "mc-prop-terrace-b", "mc-prop-terrace-c"];
      let k = 0;
      for (let y = southY0 + 2; y + 1 < bottomY; y += 3) {
        for (let x = b.x0 + 4; x + 1 <= b.x1 - 1; x += 3) stampRiversideKit(ts, map, terraces[k++ % 3]!, x, y, occupied);
      }
      stampRiversideKit(ts, map, "mc-prop-vending-a", b.x1 - 1, southY0 + 1, occupied);
      stampRiversideKit(ts, map, "mc-prop-board-b-c", b.x0 + 1, bottomY - 2, occupied);
    } else {
      for (let y = southY0 + 1; y + 2 < bottomY; y += 3) {
        stampRiversideKit(ts, map, rnd() < 0.5 ? "mc-prop-azalea-a" : "mc-prop-azalea-b", b.x0 + 1, y, occupied);
        stampRiversideKit(ts, map, rnd() < 0.5 ? "mc-prop-azalea-a" : "mc-prop-azalea-b", b.x1 - 2, y, occupied);
      }
      stampRiversideKit(ts, map, "mc-prop-blossom-a", b.x0 + 3, southY0 + 1, occupied);
      stampRiversideKit(ts, map, "mc-prop-blossom-b", b.x1 - 4, bottomY - 4, occupied);
    }
  }
  // 맨 아래 보도: 가로등 줄 + 자전거 거치대.
  for (let x = 2 + (xShift % 3); x < W - 1; x += 6) stampRiversideKit(ts, map, P.lamp, x, bottomY - 1, occupied);
  stampRiversideKit(ts, map, "mc-prop-bike-row-a", Math.floor(W / 2) - 1, bottomY, occupied);
}

/**
 * 강변·호숫가·수변 이름이 붙은 야외 길 맵이:
 * - 높이가 15 미만이거나
 * - 물 줄이 3줄 미만(예: y=0 한 줄 실개천)이거나
 * - 공원·보도 줄에 3×2 벽돌 섬(20·21번)이 찍혀 보도를 끊고 있으면(산책로 위·아래 연석 줄처럼 한 줄 전체가 벽돌이면 섬이 아니다)
 * 강변 산책로 표준 레이아웃(4줄 강물 + 석축 제방 + 연속 보도 + 5~6칸 간격 소품)으로 정비한다.
 */
export function sanitizeRiversidePromenade(project: Project, map: GameMap): boolean {
  // 물 판정이 modern 칩셋 칸 번호(23 등)뿐이다. jp_city 하천(수로 오토타일)·다른 칩셋의 물은 못 보므로
  // 「강변」 이름 맵에 키트를 찍을 때마다 맨 위 줄을 물로 덮어 건물을 지웠다(2026-10-18 R5 강변 거리 VQA) — 그 칩셋은 손대지 않는다.
  if (map.tilesetId !== "modern_city" && map.tilesetId !== "modern_campus") return false;
  const W = map.width, H = map.height;
  const meta = project.tilesets[map.tilesetId]?.tileMeta;
  // 강물은 칸 설명(role·태그 water — 이식한 연못 오토타일 포함)이나 예전 물 칸 번호로 센다.
  const isWater = (t: number): boolean => t === 23 || t === 849 || t === 32 || (t >= 0 && (isWaterRole(meta?.[t]?.role) || meta?.[t]?.tags?.includes("water") === true));
  let waterCells = 0;
  let row0Water = 0;
  const waterRows = new Set<number>();
  let hasBrickIslandOrCut = false;
  for (let y = 0; y < H; y++) {
    let brick = 0;
    for (let x = 0; x < W; x++) {
      const t = map.lowerTiles[y * W + x] ?? -1;
      if (isWater(t)) {
        waterCells++;
        waterRows.add(y);
        if (y === 0) row0Water++;
      }
      if (t === 20 || t === 21) brick++;
    }
    if (map.tilesetId === "modern_city" && y >= 3 && brick > 0 && brick < W) hasBrickIslandOrCut = true;
  }
  const isRiversideStrip = isWaterfrontRouteName(map.name) || (map.id === "map_segment_route" && row0Water >= Math.ceil(W * 0.5));
  if (!isRiversideStrip) return false;
  const coverage = W * H > 0 ? waterCells / (W * H) : 0;
  if (H >= 15 && waterRows.size >= 3 && coverage >= 0.15 && !hasBrickIslandOrCut) return false;
  paintRiversidePromenade(project, map);
  return true;
}
