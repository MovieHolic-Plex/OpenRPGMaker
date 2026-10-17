// project/startRoutePaint.ts
// 첫 구간 길 맵을 칩셋별 재료로 깐다 — 길 한 줄이 입구에서 구간 끝까지 한 번 꺾여 가고, 끝에 마당이 앉는다.
//
// 왜 (2026-10-11 사용자 지적 「현대 타일은 아예 안 쓰고, 길 맵은 다 똑같이 나온다」):
//   뼈대의 길 맵은 늘 시작 맵의 타일셋(= 빈 시작 맵 = 버들항)으로 만들어졌고, 모험 장르는 길을 아예 깔지 않았다(빈 풀밭),
//   스토리는 늘 같은 광장(기둥·산울타리·벤치)이었다. 그리고 컨셉의 tilesetHint(jp_city·조선·마법 학교)는 기획서에 글 한 줄로만
//   들어가 코드가 한 번도 읽지 않았다 — 조수는 「보는 맵의 칩셋 계열」을 따르므로 버들항 빈 맵에서는 현대 거리도 로마풍으로 깔렸다.
// 이 모듈은 칩셋마다 길·마당 재료 이름을 두고, 길 모양은 기획 구상(startVariety)에서 가져온다.

import { createModernCityTileset } from "@/project/defaults/modernCity";
import { translateTiles } from "@/project/objectStamp";
import { isWaterfrontRouteName, type StartPlan } from "@/project/startVariety";
import type { GameMap, Project, TilesetDef } from "@/project/types";
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

/** modern_campus 칩셋에 물 칸이 없으면 modern_city 의 연못 물(23번)을 이식해 반환한다. */
export function ensureCampusWaterTile(project: Project, ts: TilesetDef): number {
  const existing = ts.tileMeta?.findIndex((m) => m && (!m.defaultLayer || m.defaultLayer === "lower") && (m.role === "water" || (m.tags ?? []).includes("water") || m.label === "연못 물"));
  if (existing !== undefined && existing >= 0) return existing;
  const src = project.tilesets.modern_city ?? createModernCityTileset();
  const grafted = translateTiles(src, ts, [23]);
  const wid = grafted.map.get(23) ?? 6;
  if (ts.tileGroups && !ts.tileGroups.some((g) => g.id === "mc:water")) {
    ts.tileGroups.push({ id: "mc:water", name: "연못 물", role: "terrain", description: "강변·연못 물면", placementRules: "강변·연못에 깐다", defaultLayer: "lower", tileIds: [wid] });
  }
  return wid;
}

function stampRiversideKit(
  ts: TilesetDef,
  map: GameMap,
  kitId: string,
  x0: number,
  y0: number,
  reserved: ReadonlySet<number>,
): void {
  const kit = ts.structureKits?.find((k) => k.id === kitId);
  if (!kit) return;
  const W = map.width, H = map.height;
  if (x0 < 0 || y0 < 0 || x0 + kit.width > W || y0 + kit.height > H) return;
  for (let dy = 0; dy < kit.height; dy++) {
    for (let dx = 0; dx < kit.width; dx++) {
      if (reserved.has((y0 + dy) * W + (x0 + dx))) return;
    }
  }
  for (let dy = 0; dy < kit.height; dy++) {
    const row = kit.rows[dy];
    if (!row) continue;
    for (let dx = 0; dx < kit.width; dx++) {
      const idx = (y0 + dy) * W + (x0 + dx);
      const up = row.upperTiles?.[dx];
      if (typeof up === "number" && up >= 0) map.upperTiles[idx] = up;
    }
  }
}

/**
 * 강변·수변·호숫가 산책로를 풍부하게 깐다:
 * - 높이 최소 15줄 확보
 * - 북쪽 4줄(y=0..3, 26.7%) 강물 + y=4 석축/연석 제방 1줄 (romance-waterfront-no-water 기준 15%·2줄 이상 충족)
 * - y=5..8 강변 잔디·화단 공원 띠(5~6칸 간격 가로수·가로등·벤치, NPC 밑 3×2 벽돌 섬 금지)
 * - y=9..12 끊기지 않는 연속 돌 산책로 + 남쪽 연석(보도 중간을 끊는 벽돌 패치 금지)
 * - y=13..H-1 남쪽 잔디·벤치·화분 띠
 */
export function paintRiversidePromenade(
  project: Project,
  map: GameMap,
  plan?: Pick<StartPlan, "entryY" | "endY" | "seed">,
): void {
  ensureRiversideHeight(project, map, 15);
  const W = map.width, H = map.height;
  if (!map.lowerOverlayTiles || map.lowerOverlayTiles.length !== W * H) map.lowerOverlayTiles = new Array<number>(W * H).fill(-1);
  if (!map.upperTiles || map.upperTiles.length !== W * H) map.upperTiles = new Array<number>(W * H).fill(-1);
  if (!map.upperOverlayTiles || map.upperOverlayTiles.length !== W * H) map.upperOverlayTiles = new Array<number>(W * H).fill(-1);

  const ts = project.tilesets[map.tilesetId];
  if (map.tilesetId !== "modern_city" && map.tilesetId !== "modern_campus") {
    const waterTile = map.tilesetId === "jp_city" ? 849 : map.tilesetId === "beodeul_city" ? 8 : map.tilesetId === "joseon_baram" ? 48 : map.tilesetId === "sengoku_edo" ? 32 : undefined;
    const embankTile = map.tilesetId === "jp_city" ? 850 : map.tilesetId === "sengoku_edo" ? 34 : undefined;
    if (waterTile !== undefined) {
      for (let y = 0; y < 4; y++) {
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
          const idx = 4 * W + x;
          map.lowerTiles[idx] = embankTile;
          map.upperTiles[idx] = -1;
        }
      }
    }
    return;
  }

  const isCampus = map.tilesetId === "modern_campus";
  const water = isCampus && ts ? ensureCampusWaterTile(project, ts) : 23;
  const embankment = isCampus ? 6 : 10;
  const grass = isCampus ? 1 : 17;
  const grassShade = isCampus ? 4 : 18;
  const flower = isCampus ? 3 : 19;
  const walkTop = isCampus ? 7 : 10;
  const walkMid = isCampus ? 8 : 7;
  const walkAlt = isCampus ? 9 : 8;
  const walkBot = isCampus ? 7 : 9;

  const walkTopY = 9;
  const walkMidY1 = 10;
  const walkMidY2 = 11;
  const walkBotY = 12;

  // 이동 이벤트와 NPC 가 물·제방·나무 줄에 걸리지 않고 연속 산책로(y=9..11) 위에 서도록 정렬한다.
  for (const ev of map.events) {
    const isEdgeGate = ev.x <= 1 || ev.x >= W - 2 || /starter|end|gate|exit|enter/iu.test(ev.id);
    if (isEdgeGate) {
      const targetY = plan?.entryY && ev.x <= 1 ? Math.max(walkMidY1, Math.min(walkMidY2, plan.entryY)) : walkMidY2;
      if (ev.y !== targetY) {
        const prevY = ev.y;
        ev.y = targetY;
        shiftIncomingTransfersToMap(project, map.id, (y) => (Math.abs(y - prevY) <= 1 ? targetY : undefined));
      }
    } else if (ev.y < walkTopY || ev.y > walkBotY) {
      ev.y = walkTopY;
    }
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (y < 4) {
        map.lowerTiles[idx] = water;
      } else if (y === 4) {
        map.lowerTiles[idx] = embankment;
      } else if (y < walkTopY) {
        const isFlower = y === 6 && ((x >= 4 && x <= 6) || (x >= 11 && x <= 13) || (x >= 18 && x <= 19));
        const isShade = y === 7 && (x % 7 >= 1 && x % 7 <= 3);
        map.lowerTiles[idx] = isFlower ? flower : isShade ? grassShade : grass;
      } else if (y === walkTopY) {
        map.lowerTiles[idx] = walkTop;
      } else if (y === walkMidY1 || y === walkMidY2) {
        map.lowerTiles[idx] = (x + y) % 5 === 2 ? walkAlt : walkMid;
      } else if (y === walkBotY) {
        map.lowerTiles[idx] = walkBot;
      } else {
        map.lowerTiles[idx] = grass;
      }
      map.lowerOverlayTiles[idx] = -1;
      map.upperTiles[idx] = -1;
      map.upperOverlayTiles[idx] = -1;
    }
  }

  if (!ts) return;
  const reserved = new Set<number>();
  for (const ev of map.events) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const rx = ev.x + dx, ry = ev.y + dy;
        if (rx >= 0 && rx < W && ry >= 0 && ry < H) reserved.add(ry * W + rx);
      }
    }
  }

  if (isCampus) {
    for (let x = 1; x + 3 <= W; x += 7) {
      stampRiversideKit(ts, map, (Math.floor(x / 7) % 2 === 0) ? "mc-tree-zelkova" : "mc-tree-ginkgo", x, 5, reserved);
    }
    for (let x = 5; x < W - 1; x += 6) {
      stampRiversideKit(ts, map, "mc-lamp", x, 6, reserved);
    }
    for (let x = 3; x + 2 <= W - 1; x += 6) {
      stampRiversideKit(ts, map, (Math.floor(x / 6) % 2 === 0) ? "mc-bench" : "mc-planter", x, 13, reserved);
    }
  } else {
    for (let x = 1; x + 3 <= W; x += 7) {
      stampRiversideKit(ts, map, (Math.floor(x / 7) % 2 === 0) ? "mc-prop-ginkgo-a" : "mc-prop-keyaki-a", x, 5, reserved);
    }
    for (let x = 5; x < W - 1; x += 6) {
      stampRiversideKit(ts, map, "mc-prop-park-lamp-a", x, 6, reserved);
    }
    for (const bx of [3, 19]) {
      if (bx + 2 <= W - 1) stampRiversideKit(ts, map, "mc-in-mci-bench-metal", bx, 8, reserved);
    }
    for (let x = 3; x + 2 <= W - 1; x += 6) {
      stampRiversideKit(ts, map, (Math.floor(x / 6) % 2 === 0) ? "mc-prop-bench-c" : "mc-prop-planter-b", x, 13, reserved);
    }
  }
}

/**
 * 강변·호숫가·수변 이름이 붙은 야외 길 맵이:
 * - 높이가 15 미만이거나
 * - 물 줄이 3줄 미만(예: y=0 한 줄 실개천)이거나
 * - 공원·보도 줄에 3×2 벽돌 섬(20·21번)이 찍혀 보도를 끊고 있으면
 * 강변 산책로 표준 레이아웃(4줄 강물 + 석축 제방 + 연속 보도 + 5~6칸 간격 소품)으로 정비한다.
 */
export function sanitizeRiversidePromenade(project: Project, map: GameMap): boolean {
  const W = map.width, H = map.height;
  let waterCells = 0;
  let row0Water = 0;
  const waterRows = new Set<number>();
  let hasBrickIslandOrCut = false;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = map.lowerTiles[y * W + x] ?? -1;
      if (t === 23 || t === 849 || t === 32 || (t >= 8 && t <= 15 && map.tilesetId === "beodeul_city")) {
        waterCells++;
        waterRows.add(y);
        if (y === 0) row0Water++;
      }
      if (map.tilesetId === "modern_city" && (t === 20 || t === 21) && y >= 3) {
        hasBrickIslandOrCut = true;
      }
    }
  }
  const isRiversideStrip = isWaterfrontRouteName(map.name) || (map.id === "map_segment_route" && row0Water >= Math.ceil(W * 0.5));
  if (!isRiversideStrip) return false;
  const coverage = W * H > 0 ? waterCells / (W * H) : 0;
  if (H >= 15 && waterRows.size >= 3 && coverage >= 0.15 && !hasBrickIslandOrCut) return false;
  paintRiversidePromenade(project, map);
  return true;
}
