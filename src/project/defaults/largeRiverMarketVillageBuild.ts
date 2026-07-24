/**
 * 100×100 대형 마을 — bbox 선배치 + 비겹침 피드백 + 시공 순서 고정.
 *
 * 1) 강/호수/광장/시장 bbox 확정
 * 2) 집 롯 bbox (겹침 없이, 실패 시 재시도)
 * 3) 맵 생성 → 수역 → 집 → 도로(앵커 연결) → 시장 → NPC
 * 4) QA + 단계 로그
 */
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { runTool } from "@/editor/tools/toolRunner";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { repairMapTreeOrphans, collectMapIdsInTree } from "@/editor/mapTreeActions";
import { isPassable } from "@/project/collision";
import { isMapWaterTile } from "@/editor/tools/queryTools";
import { ensureTilesetHarnesses } from "@/project/tilesetHarness";
import { defaultDatabase, defaultTitleScreenSettings } from "./defaultDatabase";
import { DEFAULT_ITEM_ID, TILE } from "./constants";
import { RM2K3_WOOD_FLOOR_PASSABILITY, SAND_TILE } from "./chipsetMapping";
import { shapeSandAround } from "./sandAutotile";
import { LargeVillageBuildLog } from "./largeVillageBuildLog";
import {
  planLargeVillageBboxes,
  renderPlanAscii,
  overlaps,
  type VillageBboxPlan,
  type BBox,
} from "./largeVillageBboxPlan";
import type { HouseKitId } from "@/editor/houseKit";
import type {
  Command,
  EventPage,
  EventPageGraphic,
  EventPageMovement,
  GameEvent,
  GameMap,
  MapLayoutPlan,
  MapLayoutRegion,
  Project,
} from "../types";
import { setMapLayoutPlan } from "../mapLayoutPlan";

export const LARGE_RIVER_MARKET_VILLAGE_MAP_ID = "map_large_river_market_village";
export const LARGE_RIVER_MARKET_VILLAGE_NAME = "큰 강호 장터 마을";
/** 50×50 하네스 마을 */
export const VILLAGE_50_MAP_ID = "map_harness_village_50";
export const VILLAGE_50_NAME = "하네스 마을 50";

const DEFAULT_MAP_W = 100;
const DEFAULT_MAP_H = 100;
const DEFAULT_HOUSES = 20;
const DEFAULT_NPCS = 50;
const TABLE_L = 234;
const TABLE_M = 235;
const TABLE_R = 236;
const WOOD_BOX = 237;
const FRUIT_L = 202;
const FRUIT_R = 203;
const FIREWOOD = 349;
const FLOWER = 288;
const BENCH_L = 327;
const BENCH_R = 328;
const TREE_TOP = 260;
const TREE_BOTTOM = 290;
const BROADLEAF_TL = 262;
const BROADLEAF_TR = 263;
const BROADLEAF_BL = 292;
const BROADLEAF_BR = 293;
/** 강/호수 채움용 물 본체 (오토타일 바디 계열) */
const WATER_BODY = 120;
const TIMBER_RAIL = 223;
const TIMBER_POST = 193;
const RAIL_L = 468;
const RAIL_M = 469;
const RAIL_R = 470;
const WOOD_FLOOR = RM2K3_WOOD_FLOOR_PASSABILITY.body;
const WOOD_EDGE_W = RM2K3_WOOD_FLOOR_PASSABILITY.edgeWest;
const WOOD_EDGE_E = RM2K3_WOOD_FLOOR_PASSABILITY.edgeEast;
const WOOD_EDGE_N = RM2K3_WOOD_FLOOR_PASSABILITY.edgeNorth;
const WOOD_EDGE_S = RM2K3_WOOD_FLOOR_PASSABILITY.edgeSouth;

const FENCE_TOP_LEFT = 378;
const FENCE_TOP_RAIL = 379;
const FENCE_TOP_RIGHT = 380;
const FENCE_SIDE_RAIL = 408;
const FENCE_BOTTOM_RIGHT = 410;
const FENCE_BOTTOM_LEFT = 438;
const SAND_TILE_SET = new Set<number>(Object.values(SAND_TILE));

const HOUSE_KITS: readonly HouseKitId[] = ["bright-plaster", "blue-stone"];

const FIXED: EventPageMovement = { type: "fixed", speed: 3, frequency: 3 };
const RANDOM: EventPageMovement = { type: "random", speed: 3, frequency: 4 };

type HouseShapeId = "rect" | "L" | "J" | "U" | "tall";
type YardThemeId = "garden" | "workshop" | "storage" | "minimal" | "pathside";

type BuiltHouseRef = {
  readonly lot: BBox;
  /** 울타리·마당용 외접 박스 */
  readonly wing: BBox;
  readonly wings: readonly { x: number; y: number; w: number; h: number }[];
  readonly shape: HouseShapeId;
  readonly yardTheme: YardThemeId;
  readonly doorAt: { x: number; y: number };
  readonly front: { x: number; y: number };
  readonly kitId: HouseKitId;
  /** 울타리는 집과 별개 — 있는 집 / 없는 집 섞음 */
  readonly hasFence: boolean;
  /** 울타리↔집 사이 마당 칸 수 (1~2). 울타리 없으면 0 */
  readonly yardPad: 0 | 1 | 2;
};

const NPC_SPRITES = [
  "tex_easyrpg_charset_people1",
  "tex_easyrpg_charset_people2",
  "tex_easyrpg_charset_people3",
  "tex_easyrpg_charset_people4",
  "tex_easyrpg_charset_actor1",
  "tex_easyrpg_charset_actor2",
] as const;

const CHAT_LINES = [
  "강·호수·광장·시장을 먼저 자리를 잡고, 집은 그 밖에 세웠어.",
  "길이 집 필지를 뚫지 않게 앵커만 이었대.",
  "장터 카운터 앞에서 사고, 옆에서 상인에게 인사해.",
  "호수 낚시꾼 올드는 물가에만 있어.",
  "서·남쪽 강은 마을 외곽 경계야.",
  "광장이 심장, 시장은 광장 옆이야.",
  "어떤 집은 울타리가 있고, 어떤 집은 마당만 있어.",
  "북동 호수 쪽으로 길이 나 있어.",
] as const;

export type LargeRiverMarketVillageBuildResult = {
  readonly project: Project;
  readonly mapId: string;
  readonly villageSummary: string;
  readonly housesBuilt: number;
  readonly npcCount: number;
  readonly shopCounters: number;
  readonly fisher: boolean;
  readonly warnings: readonly string[];
  readonly mapTreeIds: readonly string[];
  readonly logDir: string;
  readonly ok: boolean;
  readonly qa: Record<string, unknown>;
  readonly plan: VillageBboxPlan;
};

export type BuildLargeVillageOptions = {
  readonly seed?: number;
  readonly log?: LargeVillageBuildLog;
  readonly mapW?: number;
  readonly mapH?: number;
  readonly houses?: number;
  readonly npcs?: number;
  readonly mapId?: string;
  readonly mapName?: string;
  /** 기존 맵 전부 삭제 후 이 맵만 남김 (기본 true) */
  readonly wipeAllMaps?: boolean;
};

export function buildLargeRiverMarketVillageProject(
  options: BuildLargeVillageOptions = {},
): LargeRiverMarketVillageBuildResult {
  const seed = options.seed ?? 42;
  const mapW = options.mapW ?? DEFAULT_MAP_W;
  const mapH = options.mapH ?? DEFAULT_MAP_H;
  const targetHouses = options.houses ?? (mapW <= 60 ? 6 : DEFAULT_HOUSES);
  const targetNpcs = options.npcs ?? (mapW <= 60 ? 10 : DEFAULT_NPCS);
  const mapId = options.mapId ?? (mapW <= 60 ? VILLAGE_50_MAP_ID : LARGE_RIVER_MARKET_VILLAGE_MAP_ID);
  const mapName = options.mapName ?? (mapW <= 60 ? VILLAGE_50_NAME : LARGE_RIVER_MARKET_VILLAGE_NAME);
  const wipeAllMaps = options.wipeAllMaps !== false;
  const log = options.log ?? new LargeVillageBuildLog();
  const toolWarnings: string[] = [];
  const minWater = mapW * mapH >= 8000 ? 800 : Math.floor(mapW * mapH * 0.08);

  try {
    // ── 0) bbox 플랜 (시공 전, 피드백 루프) ──
    log.step("plan-bbox", `기물 bbox 선배치 ${mapW}×${mapH}`);
    const plan = planLargeVillageBboxes({
      mapW,
      mapH,
      houseCount: targetHouses,
      seed,
      maxAttempts: 80,
      // 필지 크기 혼합 (7×7~10×9 등) — 동일 8×8 격자 폐지
      mixLotSizes: true,
      houseGap: mapW <= 60 ? 0 : 1,
    });
    const lotSizeHist = histogramLotSizes(plan.houseLots);
    log.info("plan-result", plan.ok ? "OK" : "BEST-EFFORT", {
      attempts: plan.attempts,
      houses: plan.houseLots.length,
      lotSizes: lotSizeHist,
      issues: plan.issues,
      plaza: plan.plaza,
      market: plan.market,
      lake: plan.lake,
      rivers: plan.rivers,
      map: { w: mapW, h: mapH },
    });
    log.writeAsciiMap("00-plan-bbox.txt", renderPlanAscii(plan, 2));
    if (!plan.ok) {
      log.warn("plan-not-perfect", { issues: plan.issues, houses: plan.houseLots.length });
    }
    if (plan.houseLots.length < targetHouses - 2) {
      log.error("plan-too-few-houses", { got: plan.houseLots.length, need: targetHouses });
    }

    // 겹침 재검증 로그
    log.step("plan-validate", "bbox 쌍별 겹침 재검사");
    const overlapIssues = validateNoOverlap(plan);
    for (const issue of overlapIssues) log.error("bbox-overlap", { issue });
    if (overlapIssues.length === 0) log.info("bbox-overlap", "none");

    log.step("init", wipeAllMaps ? "빈 프로젝트 (맵 전부 없음)" : "빈 프로젝트");
    const project = createEmptyToolProject(mapName);
    project.database = defaultDatabase();
    project.meta = { ...project.meta, title: mapName };
    applyDefaultTitleScreen(project, mapName);
    ensureTilesetHarnesses(project);
    // 전체 맵 트리 초기화 — 다른 맵 없음
    project.maps = {};
    project.mapTree = { mapId: mapId, children: [] };
    const ctx: { project: Project } = { project };

    log.step("create_map", `${mapW}×${mapH} only`);
    runOk(ctx, "create_map", {
      id: mapId,
      name: mapName,
      width: mapW,
      height: mapH,
      border: "none",
    }, toolWarnings, log);

    // ── 1) 수역: 곡선 강 + 원형 호수 ──
    log.step("water", "곡선 강 + 호수");
    let map = requireMap(ctx, mapId);
    const waterRng = mulberry(seed + 11);
    let curvedWater = 0;
    for (const river of plan.rivers) {
      if (river.w <= river.h) {
        curvedWater += paintCurvedRiverWest(map, river, waterRng);
      } else {
        curvedWater += paintCurvedRiverSouth(map, river, waterRng);
      }
    }
    // 호수는 원형 유지
    runOk(ctx, "fill_region", {
      mapId,
      material: "물",
      shape: "circle",
      layer: "lower",
      rect: { x: plan.lake.x, y: plan.lake.y, w: plan.lake.w, h: plan.lake.h },
    }, toolWarnings, log);
    map = requireMap(ctx, mapId);
    log.writeAsciiMap("01-after-water.txt", renderWorldAscii(map, plan, [], 2));
    log.info("water-cells", String(countWater(map)), { curvedRiverCells: curvedWater });

    // ── 2) 집 (건물) — 필지 혼합 크기 + 형태/키트/울타리 분산
    log.step("houses", `집 시공 ${plan.houseLots.length}채 (형태·키트·울타리 분산)`);
    let housesOk = 0;
    const doorFronts: { x: number; y: number }[] = [];
    const houseWings: BBox[] = [];
    const builtHouses: BuiltHouseRef[] = [];
    const houseRng = mulberry(seed + 77);
    const shapeUsed = new Map<HouseShapeId, number>();
    const kitUsed = new Map<HouseKitId, number>();
    let fencedCount = 0;
    const fenceTarget = Math.max(1, Math.floor(plan.houseLots.length * 0.4));
    for (let i = 0; i < plan.houseLots.length; i += 1) {
      const lot = plan.houseLots[i]!;
      // 울타리: 필지 ≥9×9 가능 시, 목표 채수까지 우선 부여 후 확률
      const canFence = lot.w >= 9 && lot.h >= 9;
      let hasFence = false;
      let yardPad: 0 | 1 | 2 = 0;
      if (canFence) {
        const needMoreFence = fencedCount < fenceTarget;
        hasFence = needMoreFence || houseRng() < 0.35;
        if (hasFence) {
          if (lot.w >= 11 && lot.h >= 11) yardPad = houseRng() < 0.45 ? 2 : 1;
          else yardPad = 1;
        }
      }
      if (hasFence && yardPad === 0) hasFence = false;
      // 울타리1 + 옆마당1 = side 2, 남쪽 마당 yardPad
      let side = hasFence ? 2 : 1;
      let north = hasFence ? 2 : 1;
      let south = hasFence ? 1 + yardPad : 1;
      if (hasFence && lot.h - north - south < 5) {
        yardPad = 1;
        south = 2;
      }
      if (hasFence && (lot.w - side * 2 < 5 || lot.h - north - south < 5)) {
        hasFence = false;
        yardPad = 0;
        side = 1;
        north = 1;
        south = 1;
      }
      const maxW = Math.max(5, lot.w - side * 2);
      const maxH = Math.max(5, lot.h - north - south);
      const shape = pickHouseShapeDiverse(maxW, maxH, houseRng, shapeUsed, i, plan.houseLots.length);
      const layout = layoutHouseWings(lot.x + side, lot.y + north, maxW, maxH, shape, houseRng);
      const wing: BBox = {
        id: `${lot.id}-wing`,
        role: "house",
        x: layout.bounds.x,
        y: layout.bounds.y,
        w: layout.bounds.w,
        h: layout.bounds.h,
      };
      for (const fw of layout.wings) {
        houseWings.push({
          id: `${lot.id}-w${fw.x},${fw.y}`,
          role: "house",
          x: fw.x,
          y: fw.y,
          w: fw.w,
          h: fw.h,
        });
      }
      const kitId = pickHouseKitDiverse(i, kitUsed);
      const windowSpacing = 1 + (i % 3);
      const yardTheme = pickYardTheme(houseRng, hasFence);
      const result = runOk(ctx, "build_house_kit", {
        mapId,
        kitId,
        wings: layout.wings.map((fw) => ({ x: fw.x, y: fw.y, w: fw.w, h: fw.h })),
        windows: { spacing: windowSpacing },
        interior: false,
        doorEvent: false,
        door: true,
      }, toolWarnings, log);
      shapeUsed.set(shape, (shapeUsed.get(shape) ?? 0) + 1);
      kitUsed.set(kitId, (kitUsed.get(kitId) ?? 0) + 1);
      if (hasFence) fencedCount += 1;
      const data = (result.data ?? {}) as { doorAt?: { x: number; y: number } };
      const doorAt = data.doorAt ?? {
        x: wing.x + Math.floor(wing.w / 2),
        y: wing.y + wing.h - 1,
      };
      const front = { x: doorAt.x, y: doorAt.y + 1 };
      doorFronts.push(front);
      builtHouses.push({
        lot,
        wing,
        wings: layout.wings,
        shape,
        yardTheme,
        doorAt,
        front,
        kitId,
        hasFence,
        yardPad,
      });
      housesOk += 1;
      if (!data.doorAt) log.warn("house-no-doorAt", { lot: lot.id, wing, shape });
      log.info("house-stamped", lot.id, {
        kitId,
        shape,
        yardTheme,
        wings: layout.wings,
        windowSpacing,
        doorAt,
        hasFence,
        yardPad,
      });
    }
    map = requireMap(ctx, mapId);
    log.writeAsciiMap("02-after-houses.txt", renderWorldAscii(map, plan, houseWings, 2));
    log.info(
      "houses-done",
      `${housesOk}/${plan.houseLots.length} fenced=${builtHouses.filter((h) => h.hasFence).length}`,
      {
        shapes: Object.fromEntries(shapeUsed),
        kits: Object.fromEntries(kitUsed),
        lotSizes: lotSizeHist,
      },
    );

    // 울타리 집 필지 보호 영역 (게이트 제외) — 길·나무·NPC 침범 금지
    const fencedProtected = buildFencedLotProtectedSet(builtHouses);
    log.info("fenced-protected", String(fencedProtected.size), {
      fencedHouses: builtHouses.filter((h) => h.hasFence).length,
    });

    // ── 3) 도로: wing + 울타리 필지 회피 + 구불 간선 ──
    log.step("roads", "구불 간선 + 문 스퍼 (wing·울타리필지 회피)");
    const blocked = buildRoadBlockedSet(plan, houseWings, builtHouses, map);
    const nearWall = buildNearWallSet(houseWings, map.width, map.height);
    const roadRng = mulberry(seed + 404);
    log.info("road-blocked-cells", String(blocked.size), {
      wings: houseWings.length,
      fencedProtected: fencedProtected.size,
      nearWall: nearWall.size,
      market: plan.market,
    });

    const plazaA = plan.roadAnchors.find((a) => a.id === "plaza-center")!;
    const marketA = plan.roadAnchors.find((a) => a.id === "market-front")!;
    const lakeA = plan.roadAnchors.find((a) => a.id === "lake-shore")!;
    const westA = plan.roadAnchors.find((a) => a.id === "river-west-dock")!;
    const southA = plan.roadAnchors.find((a) => a.id === "river-south-dock")!;

    const arterials: { name: string; from: { x: number; y: number }; to: { x: number; y: number } }[] = [
      { name: "plaza-market", from: plazaA, to: marketA },
      { name: "plaza-west", from: westA, to: plazaA },
      { name: "plaza-south", from: southA, to: plazaA },
      { name: "plaza-lake", from: plazaA, to: lakeA },
    ];

    map = requireMap(ctx, mapId);
    let roadCellsPainted = 0;
    let roadThroughHouse = 0;
    const allPainted: { x: number; y: number }[] = [];
    const roadNetwork = new Set<string>();

    const paintRoute = (
      name: string,
      fromRaw: { x: number; y: number },
      toRaw: { x: number; y: number },
      prefer: Set<string> | undefined,
      windy: boolean,
    ) => {
      const from = snapToFree(fromRaw, blocked, map);
      const to = snapToFree(toRaw, blocked, map);
      if (!from || !to) {
        log.warn("road-skip-no-endpoint", { name, from: fromRaw, to: toRaw });
        return;
      }
      const costs = {
        prefer,
        expensive: windy ? nearWall : undefined,
        expensiveCost: 4,
        // 간선에 약한 노이즈 → A*가 직선만 고집하지 않음
        noise: windy ? 0.35 : 0,
        rng: roadRng,
      };
      let route = windy
        ? windyAstar(from, to, blocked, map.width, map.height, costs)
        : astarAvoid(from, to, blocked, map.width, map.height, costs);
      if (!route || route.length === 0) {
        route = astarAvoid(from, to, blocked, map.width, map.height, { prefer });
      }
      if (!route || route.length === 0) {
        log.warn("road-no-path", { name, from, to });
        return;
      }
      const painted = paintSandPath(map, route, blocked);
      roadCellsPainted += painted.length;
      allPainted.push(...painted);
      for (const c of painted) {
        roadNetwork.add(`${c.x},${c.y}`);
        if (isInsideAnyWing(houseWings, c.x, c.y)) roadThroughHouse += 1;
      }
      log.info("road", name, { cells: route.length, painted: painted.length, windy });
    };

    for (const ep of arterials) {
      paintRoute(ep.name, ep.from, ep.to, undefined, true);
    }
    for (let i = 0; i < doorFronts.length; i += 1) {
      const f = doorFronts[i]!;
      const nearest = nearestRoadCell(f, roadNetwork, blocked, map.width, map.height) ?? plazaA;
      // 문 스퍼도 살짝 구불 (짧은 구간은 자동으로 덜 휨)
      paintRoute(`door-${i}-spur`, f, nearest, roadNetwork, true);
    }

    if (allPainted.length > 0) shapeSandAround(map, allPainted);
    log.info("roads-summary", `painted=${roadCellsPainted} throughHouse=${roadThroughHouse}`);
    if (roadThroughHouse > 0) {
      log.error("road-cut-house", { roadThroughHouse });
    }
    map = requireMap(ctx, mapId);
    log.writeAsciiMap("03-after-roads.txt", renderWorldAscii(map, plan, houseWings, 2));

    // ── 4) 광장 + 시장 하네스 (데크·천막·카운터·난간) ──
    log.step("plaza-market", "광장 + 시장 하네스", plan.market);
    decoratePlaza(map, plan.plaza);
    stampMarketHarness(map, plan.market, log);

    // ── 5) 울타리(선택) + 마당 소품 — 집과 별 개념
    log.step("fences-yards", "울타리 + 마당(장작=집 앞, 길 위 금지)");
    let fenceHouses = 0;
    let yardsFilled = 0;
    const yardRng = mulberry(seed + 909);
    for (const h of builtHouses) {
      if (h.hasFence) {
        if (placeHouseFence(map, h)) fenceHouses += 1;
      }
      if (fillHouseYardProps(map, h, yardRng)) yardsFilled += 1;
    }
    log.info("fences-yards-done", `fenced=${fenceHouses}/${builtHouses.length} yards=${yardsFilled}`);

    // ── 6) 숲·나무(1x2 침엽 + 2x2 활엽) + 꽃 ──
    log.step("decor-trees", "숲·나무 2x2 + 꽃 (울타리 필지·길 침범 금지)");
    placeVillagePropsAndTrees(
      ctx,
      map,
      plan,
      houseWings,
      fencedProtected,
      seed,
      toolWarnings,
      log,
      mapId,
    );

    // ── 7) 의자 드묾 + 길 위 소품 청소 + 울타리 안 침범 제거 ──
    log.step("benches-roads", "길가 의자(드묾) + 보호영역 청소");
    map = requireMap(ctx, mapId);
    placeBenchesAlongRoads(map, houseWings, plan, fencedProtected, mulberry(seed + 777), log);
    clearPropsOnRoads(map, log);
    const scrubbed = scrubInvasionsIntoFencedLots(map, builtHouses);
    log.info("fenced-scrub", String(scrubbed));

    map = requireMap(ctx, mapId);
    log.writeAsciiMap("04-after-market.txt", renderWorldAscii(map, plan, houseWings, 2));

    // ── 8) 낚시꾼 + NPC (울타리 안 금지) ──
    log.step("fisher-npcs", `낚시꾼 + 주민 ${targetNpcs}`);
    const fisher = placeFisherAtLake(map, plan.lake, log);
    topUpNpcs(map, ctx.project, plan, targetNpcs, seed, log, fencedProtected);

    // ── 8b) 퀘스트 + 남쪽 몬스터 (대형 맵 중심, 50맵도 최소 배치)
    log.step("quest-monsters", "의뢰 중개인 + 게시판 + 남쪽 몬스터");
    placeVillageQuestAndSouthMonsters(map, ctx.project, plan, log);

    // 시작: 광장
    ctx.project.startMapId = mapId;
    ctx.project.startPos = {
      x: clamp(Math.floor(plan.plaza.x + plan.plaza.w / 2), 0, mapW - 1),
      y: clamp(Math.floor(plan.plaza.y + plan.plaza.h / 2), 0, mapH - 1),
    };
    if (!isPassable(ctx.project, map, ctx.project.startPos.x, ctx.project.startPos.y)) {
      const alt = findPassableInBox(ctx.project, map, plan.plaza);
      if (alt) ctx.project.startPos = alt;
      log.warn("start-adjusted", ctx.project.startPos);
    }

    if (wipeAllMaps) {
      for (const id of Object.keys(ctx.project.maps)) {
        if (id !== mapId) delete ctx.project.maps[id];
      }
      ctx.project.mapTree = { mapId, children: [] };
    }
    repairMapTreeOrphans(ctx.project);

    map = requireMap(ctx, mapId);
    // bbox 설계도 영속 — 타일 시공 후에도 쿼리 가능
    const layoutPlan = buildVillageLayoutPlan(plan, builtHouses, seed, map);
    setMapLayoutPlan(map, layoutPlan);
    log.info("layout-plan-saved", `regions=${layoutPlan.regions.length}`, {
      kind: layoutPlan.kind,
      roles: layoutPlan.regions.reduce<Record<string, number>>((acc, r) => {
        acc[r.role] = (acc[r.role] ?? 0) + 1;
        return acc;
      }, {}),
    });
    log.writeAsciiMap("05-final.txt", renderWorldAscii(map, plan, houseWings, 2));

    // ── 9) QA ──
    log.step("qa", "품질 게이트");
    const qa = runQa(ctx.project, map, plan, houseWings, {
      housesOk,
      fisher: Boolean(fisher),
      overlapIssues: overlapIssues.length,
      targetHouses,
      targetNpcs,
      mapW,
      mapH,
      minWater,
    }, log);

    for (const w of toolWarnings) log.warn(`tool: ${w}`);

    const result: LargeRiverMarketVillageBuildResult = {
      project: ctx.project,
      mapId,
      villageSummary: `${mapW}x${mapH} houses=${housesOk} market@${plan.market.x},${plan.market.y} lake@${plan.lake.x},${plan.lake.y}`,
      housesBuilt: housesOk,
      npcCount: countVisibleNpcs(map),
      shopCounters: map.events.filter((e) => e.id.startsWith("ev_mkt_counter_")).length,
      fisher: Boolean(fisher),
      warnings: [...toolWarnings, ...log.warnings],
      mapTreeIds: [...collectMapIdsInTree(ctx.project.mapTree)],
      logDir: log.outDir,
      ok: qa.ok,
      qa,
      plan,
    };

    log.finish({
      ok: result.ok,
      title: mapName,
      mapId: result.mapId,
      size: { w: mapW, h: mapH },
      housesBuilt: result.housesBuilt,
      npcCount: result.npcCount,
      shopCounters: result.shopCounters,
      fisher: result.fisher,
      waterCells: countWater(map),
      startPos: ctx.project.startPos,
      plan: {
        attempts: plan.attempts,
        ok: plan.ok,
        issues: plan.issues,
        houseLots: plan.houseLots.length,
        market: plan.market,
        plaza: plan.plaza,
        lake: plan.lake,
      },
      qa,
      pipeline: [
        "1 plan bboxes (landmarks → houses, no overlap, feedback)",
        "2 create_map",
        "3 water from plan only",
        "4 houses in lots via build_house_kit",
        "5 roads between anchors",
        "6 market in market bbox",
        "7 fisher + npcs",
        "8 qa",
      ],
    });

    return result;
  } catch (err) {
    log.error("fatal", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    log.finish({ ok: false, fatal: true, error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

// ─── QA ───────────────────────────────────────────────

function runQa(
  project: Project,
  map: GameMap,
  plan: VillageBboxPlan,
  houseWings: readonly BBox[],
  input: {
    housesOk: number;
    fisher: boolean;
    overlapIssues: number;
    targetHouses: number;
    targetNpcs: number;
    mapW: number;
    mapH: number;
    minWater: number;
  },
  log: LargeVillageBuildLog,
): { ok: boolean; checks: Record<string, boolean>; details: Record<string, unknown> } {
  const water = countWater(map);
  const npcs = countVisibleNpcs(map);
  const doorPairs = countDoorPairs(map);
  const marketOk = map.events.some((e) => e.id.startsWith("ev_mkt_counter_"));
  const startOk = isPassable(project, map, project.startPos.x, project.startPos.y);

  // 모래길이 건물 wing(실제 집 질량) 내부를 침범했는지 — 마당/문앞 모래는 허용
  let roadInHouse = 0;
  const sandBodies = new Set<number>(Object.values(SAND_TILE));
  for (const wing of houseWings) {
    for (let y = wing.y; y < wing.y + wing.h; y += 1) {
      for (let x = wing.x; x < wing.x + wing.w; x += 1) {
        const t = map.lowerTiles[y * map.width + x] ?? -1;
        if (sandBodies.has(t)) roadInHouse += 1;
      }
    }
  }

  const houseTol = Math.max(1, Math.floor(input.targetHouses * 0.15));
  const npcTol = Math.max(2, Math.floor(input.targetNpcs * 0.2));
  const checks = {
    sizeOk: map.width === input.mapW && map.height === input.mapH,
    planOk: plan.ok || plan.houseLots.length >= input.targetHouses - houseTol,
    noPlanOverlap: input.overlapIssues === 0,
    housesEnough: input.housesOk >= input.targetHouses - houseTol,
    npcsEnough: npcs >= input.targetNpcs - npcTol,
    waterPresent: water >= input.minWater,
    fisher: input.fisher,
    market: marketOk,
    startPassable: startOk,
    noRoadThroughHouse: roadInHouse === 0,
  };
  const details = {
    water,
    npcs,
    doorPairs,
    housesOk: input.housesOk,
    overlapIssues: input.overlapIssues,
    roadInHouse,
    planAttempts: plan.attempts,
    start: project.startPos,
  };
  for (const [k, v] of Object.entries(checks)) {
    log.qa(v ? `PASS ${k}` : `FAIL ${k}`, { [k]: v, ...details });
  }
  const ok = Object.values(checks).every(Boolean);
  log.qa(ok ? "QA_GATE_PASS" : "QA_GATE_FAIL", { checks, details });
  return { ok, checks, details };
}

function validateNoOverlap(plan: VillageBboxPlan): string[] {
  const issues: string[] = [];
  const boxes = plan.bboxes;
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      if (a.role === "river" && b.role === "river") continue;
      if (overlaps(a, b)) issues.push(`${a.id}×${b.id}`);
    }
  }
  return issues;
}

// ─── house layout ────────────────────────────────────

function eligibleHouseShapes(maxW: number, maxH: number): HouseShapeId[] {
  const out: HouseShapeId[] = ["rect"];
  if (maxW >= 6 && maxH >= 6) {
    out.push("L", "J");
  }
  if (maxW >= 7 && maxH >= 7) out.push("U");
  if (maxH >= 7 && maxW >= 5) out.push("tall");
  return out;
}

/**
 * 형태 분산: 가용 형태 중 사용 횟수가 적은 것을 우선.
 * 초반 집은 비-rect 우선 (가능하면).
 */
function pickHouseShapeDiverse(
  maxW: number,
  maxH: number,
  rng: () => number,
  used: ReadonlyMap<HouseShapeId, number>,
  index: number,
  total: number,
): HouseShapeId {
  const eligible = eligibleHouseShapes(maxW, maxH);
  if (eligible.length === 1) return eligible[0]!;

  // 초반 절반은 rect를 최후 순위로 밀어 형태 풀을 먼저 소진
  const preferNonRect = index < Math.ceil(total * 0.6) && eligible.some((s) => s !== "rect");
  const pool = preferNonRect ? eligible.filter((s) => s !== "rect") : eligible;

  const pickLeast = (shapes: readonly HouseShapeId[]): HouseShapeId => {
    let best = shapes[0]!;
    let bestScore = Infinity;
    for (const shape of shapes) {
      const count = used.get(shape) ?? 0;
      const score = count * 10 + rng();
      if (score < bestScore) {
        bestScore = score;
        best = shape;
      }
    }
    return best;
  };

  const chosen = pickLeast(pool);
  // 비-rect 풀이 이미 과다 사용이면 전체 eligible( rect 포함 )에서 재선택
  if ((used.get(chosen) ?? 0) >= 2 && preferNonRect) {
    return pickLeast(eligible);
  }
  return chosen;
}

function pickHouseKitDiverse(
  index: number,
  used: ReadonlyMap<HouseKitId, number>,
): HouseKitId {
  // 교대 + 사용 적은 쪽 우선
  const a = HOUSE_KITS[0]!;
  const b = HOUSE_KITS[1]!;
  const ca = used.get(a) ?? 0;
  const cb = used.get(b) ?? 0;
  if (ca < cb) return a;
  if (cb < ca) return b;
  return HOUSE_KITS[index % HOUSE_KITS.length]!;
}

function histogramLotSizes(lots: readonly BBox[]): Record<string, number> {
  const h: Record<string, number> = {};
  for (const lot of lots) {
    const key = `${lot.w}x${lot.h}`;
    h[key] = (h[key] ?? 0) + 1;
  }
  return h;
}

function pickYardTheme(rng: () => number, hasFence: boolean): YardThemeId {
  const r = rng();
  if (!hasFence) {
    if (r < 0.4) return "minimal";
    if (r < 0.7) return "pathside";
    return "garden";
  }
  if (r < 0.22) return "garden";
  if (r < 0.42) return "workshop";
  if (r < 0.62) return "storage";
  if (r < 0.8) return "pathside";
  return "minimal";
}

/**
 * ㄱ(L) / ㄴ(J) / ㅁ·ㄷ(U) / 2층(tall) / 직사각.
 * 각 열 높이 ≥5 (house kit 불변식).
 */
function layoutHouseWings(
  ox: number,
  oy: number,
  maxW: number,
  maxH: number,
  shape: HouseShapeId,
  rng: () => number,
): {
  wings: { x: number; y: number; w: number; h: number }[];
  bounds: { x: number; y: number; w: number; h: number };
} {
  const clampSize = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  // 필지를 꽉 채우지 않음 — 1칸 여백 남겨 실루엣·마당이 보이게
  const slackW = maxW >= 7 && rng() < 0.55 ? 1 : 0;
  const slackH = maxH >= 7 && rng() < 0.45 ? 1 : 0;
  const useW = Math.max(5, maxW - slackW);
  const useH = Math.max(5, maxH - slackH);
  const offX = slackW > 0 && rng() < 0.5 ? 1 : 0;
  const offY = 0; // 문은 남측 — 북쪽 정렬 유지
  const bx = ox + offX;
  const by = oy + offY;

  if (shape === "tall") {
    const w = clampSize(5 + Math.floor(rng() * Math.min(2, useW - 4)), 5, useW);
    const h = clampSize(Math.min(useH, 7 + Math.floor(rng() * Math.max(1, useH - 6))), 7, useH);
    const wings = [{ x: bx, y: by, w, h }];
    return { wings, bounds: { x: bx, y: by, w, h } };
  }
  if (shape === "L" && useW >= 6 && useH >= 6) {
    // ㄱ: 남쪽 가로 바 + 서쪽 세로 기둥 — stem 짧게 해 ㄱ 각이 보이게
    const barH = 5;
    const stemW = 3;
    const w = clampSize(5 + Math.floor(rng() * Math.min(3, useW - 4)), 6, useW);
    const h = clampSize(5 + Math.floor(rng() * Math.min(2, useH - 4)), 6, useH);
    const stemH = clampSize(h - 1, 5, h); // 가로 바와 1칸 겹침 이상, 상단 잘림 약하게
    const wings = [
      { x: bx, y: by + h - barH, w, h: barH },
      { x: bx, y: by, w: stemW, h: stemH },
    ];
    return { wings, bounds: { x: bx, y: by, w, h } };
  }
  if (shape === "J" && useW >= 6 && useH >= 6) {
    // ㄴ: 남쪽 가로 바 + 동쪽 세로 기둥
    const barH = 5;
    const stemW = 3;
    const w = clampSize(5 + Math.floor(rng() * Math.min(3, useW - 4)), 6, useW);
    const h = clampSize(5 + Math.floor(rng() * Math.min(2, useH - 4)), 6, useH);
    const stemH = clampSize(h - 1, 5, h);
    const wings = [
      { x: bx, y: by + h - barH, w, h: barH },
      { x: bx + w - stemW, y: by, w: stemW, h: stemH },
    ];
    return { wings, bounds: { x: bx, y: by, w, h } };
  }
  if (shape === "U" && useW >= 7 && useH >= 7) {
    // ㅁ/ㄷ: 북쪽 몸통 + 좌·우 기둥 (남쪽 개방 마당)
    const w = clampSize(7 + Math.floor(rng() * Math.min(2, useW - 6)), 7, useW);
    const h = clampSize(7 + Math.floor(rng() * Math.min(1, useH - 6)), 7, useH);
    const stemW = 3;
    const bodyH = 5;
    const wings = [
      { x: bx, y: by, w, h: bodyH },
      { x: bx, y: by, w: stemW, h },
      { x: bx + w - stemW, y: by, w: stemW, h },
    ];
    return { wings, bounds: { x: bx, y: by, w, h } };
  }
  // rect — 작은 집 / 큰 집 크기 흔들기
  const w = clampSize(5 + Math.floor(rng() * Math.min(3, useW - 4)), 5, useW);
  const h = clampSize(5 + Math.floor(rng() * Math.min(2, useH - 4)), 5, useH);
  const wings = [{ x: bx, y: by, w, h }];
  return { wings, bounds: { x: bx, y: by, w, h } };
}

// ─── stamp helpers ────────────────────────────────────

/**
 * 장터 하네스 — 기존 상점가 데크 규칙 복원 (villageShoppingStreetBuild).
 * lower: 222 body 채움 + 228/229/230/192 가장자리 + 223 남단 베이스
 * upper: 468/469/470 난간, 카운터·상자·과일 (천막 411–443 사용 안 함)
 * 남쪽 중앙 3칸 입구만 개방.
 */
function stampMarketHarness(map: GameMap, market: BBox, log: LargeVillageBuildLog): void {
  // bbox 안쪽 여백 1
  const x = market.x + 1;
  const y = market.y + 1;
  const w = Math.max(8, market.w - 2);
  const h = Math.max(8, market.h - 2);
  const gateX0 = x + Math.floor(w / 2) - 1;
  const gateXs = new Set([gateX0, gateX0 + 1, gateX0 + 2]);

  // 1) 본체: 나무 바닥 body 222
  for (let dy = 0; dy < h; dy += 1) {
    for (let dx = 0; dx < w; dx += 1) {
      setLower(map, x + dx, y + dy, WOOD_FLOOR);
      setUpper(map, x + dx, y + dy, TILE.EMPTY);
    }
  }

  // 2) 가장자리 4방향 (222 base 위 edge 칩)
  for (let dx = 1; dx < w - 1; dx += 1) {
    setLower(map, x + dx, y, WOOD_EDGE_N);
    // 남단: 입구 3칸은 body 유지, 나머지는 edgeS
    if (!gateXs.has(x + dx)) setLower(map, x + dx, y + h - 1, WOOD_EDGE_S);
  }
  for (let dy = 1; dy < h - 1; dy += 1) {
    setLower(map, x, y + dy, WOOD_EDGE_W);
    setLower(map, x + w - 1, y + dy, WOOD_EDGE_E);
  }

  // 3) 남단 베이스 223 + upper 난간 (입구 3칸 비움)
  for (let dx = 0; dx < w; dx += 1) {
    const wx = x + dx;
    const wy = y + h - 1;
    if (gateXs.has(wx)) {
      setLower(map, wx, wy, WOOD_FLOOR);
      setUpper(map, wx, wy, TILE.EMPTY);
      continue;
    }
    setLower(map, wx, wy, TIMBER_RAIL); // 223
    setUpper(map, wx, wy, dx === 0 ? RAIL_L : dx === w - 1 ? RAIL_R : RAIL_M);
  }
  // 모서리 포스트
  setLower(map, x, y, TIMBER_POST);
  setLower(map, x + w - 1, y, TIMBER_POST);
  setLower(map, x, y + h - 1, TIMBER_POST);
  setLower(map, x + w - 1, y + h - 1, TIMBER_POST);

  // 4) 카운터·소품 (데크 위) — 천막 없음
  stampCounter(map, x + 1, y + 2);
  stampCounter(map, x + Math.max(1, w - 6), y + 2);
  if (h >= 9) stampCounter(map, x + Math.floor(w / 2) - 2, y + 5);
  // 대형 데크: 남쪽 쪽 무기 카운터 한 줄 더
  if (w >= 12 && h >= 10) stampCounter(map, x + Math.floor(w / 2) - 2, y + h - 4);
  setUpper(map, x + 1, y + 1, WOOD_BOX);
  setUpper(map, x + 3, y + 1, FRUIT_L);
  setUpper(map, x + 4, y + 1, FRUIT_R);
  setUpper(map, x + Math.max(2, w - 3), y + 1, WOOD_BOX);
  if (h >= 8) setUpper(map, x + Math.floor(w / 2), y + h - 3, WOOD_BOX);

  const stalls: {
    id: string;
    cx: number;
    cy: number;
    nx: number;
    ny: number;
    name: string;
    sprite: string;
    idx: number;
    items: readonly string[];
    shop: string;
    chat: string;
  }[] = [
    {
      id: "potion",
      cx: x + 2,
      cy: y + 2,
      nx: x + 2,
      ny: y + 1,
      name: "포션 상인 루나",
      sprite: "tex_easyrpg_charset_actor1",
      idx: 0,
      items: [DEFAULT_ITEM_ID, "item_hi_potion", "item_ether"],
      shop: "포션은 카운터에서 고르세요.",
      chat: "거래는 앞 카운터에서. 옆에서는 인사만.",
    },
    {
      id: "tools",
      cx: x + Math.max(2, w - 5),
      cy: y + 2,
      nx: x + Math.max(2, w - 5),
      ny: y + 1,
      name: "도구 상인 바르",
      sprite: "tex_easyrpg_charset_people4",
      idx: 1,
      items: ["item_antidote", "item_wake_herb", DEFAULT_ITEM_ID],
      shop: "해독제·각성초, 카운터에서.",
      chat: "장사는 카운터 앞에서.",
    },
    {
      // 무기 상점 — shop 커맨드는 itemIds 만 지원 → 투척·매뉴얼·방어 부적
      id: "weapon",
      cx: x + Math.floor(w / 2) - 1,
      cy: h >= 10 ? y + h - 4 : y + 4,
      nx: x + Math.floor(w / 2) - 1,
      ny: h >= 10 ? y + h - 5 : y + 3,
      name: "무기 상인 칼스",
      sprite: "tex_easyrpg_charset_people3",
      idx: 2,
      items: ["item_throwing_knife", "item_poison_dart", "item_sword_manual", "item_guard_talisman", "item_armor_patch"],
      shop: "무기·투척·방어 부적. 남쪽 몬스터 잡으러 가기 전에 챙기세요.",
      chat: "철검은 대장간 의뢰, 여기서는 실전 소모품이 주력입니다.",
    },
  ];
  if (h >= 9 && w >= 10) {
    stalls.push({
      id: "general",
      cx: x + Math.max(2, Math.floor(w / 2) - 3),
      cy: y + 5,
      nx: x + Math.max(2, Math.floor(w / 2) - 3),
      ny: y + 4,
      name: "잡화 상인 미나",
      sprite: "tex_easyrpg_charset_people2",
      idx: 3,
      items: [DEFAULT_ITEM_ID, "item_antidote"],
      shop: "잡화 카운터입니다.",
      chat: "수다는 여기, 물건은 카운터.",
    });
  }

  for (const s of stalls) {
    // 좌표 클램프
    const cx = clamp(s.cx, x + 1, x + w - 2);
    const cy = clamp(s.cy, y + 1, y + h - 2);
    const nx = clamp(s.nx, x, x + w - 1);
    const ny = clamp(s.ny, y, y + h - 1);
    map.events.push(counterShopEvent(`ev_mkt_counter_${s.id}`, cx, cy, s.name, s.items, s.shop));
    map.events.push(merchantChatEvent(`ev_mkt_npc_${s.id}`, nx, ny, s.name, s.sprite, s.idx, s.chat));
  }
  log.info(
    "market-harness",
    `wood-deck 222+edges+223 gate3@${gateX0} deck=${x},${y} ${w}x${h} stalls=${stalls.length} weapon=yes`,
  );
}

function decoratePlaza(map: GameMap, plaza: BBox): void {
  const cx = plaza.x + Math.floor(plaza.w / 2);
  const cy = plaza.y + Math.floor(plaza.h / 2);
  // 의자/벤치는 길가를 따름 — 광장 중앙에 두지 않음. 장작은 집 앞 전용.
  const put = (x: number, y: number, tile: number) => {
    if (isRoadCell(map, x, y)) return;
    setUpper(map, x, y, tile);
  };
  put(cx - 1, cy - 2, FLOWER);
  put(cx, cy - 2, FLOWER);
  put(cx + 1, cy - 2, FLOWER);
  put(cx, cy + 2, FLOWER);
  put(cx - 2, cy + 3, WOOD_BOX);
}

/**
 * 울타리 = 집과 별 레이어.
 * 필지(lot) 둘레에 올리고, 집(wing)과는 yardPad(1~2) 띄움.
 * 문 앞 남쪽 3칸 게이트. 모래길·물 위 스킵.
 */
function placeHouseFence(map: GameMap, house: BuiltHouseRef): boolean {
  if (!house.hasFence) return false;
  const lot = house.lot;
  if (lot.w < 4 || lot.h < 4) return false;
  const lastX = lot.x + lot.w - 1;
  const lastY = lot.y + lot.h - 1;
  const gateY = lastY;
  const gateXs = new Set<number>();
  for (let dx = -1; dx <= 1; dx += 1) {
    gateXs.add(house.doorAt.x + dx);
    gateXs.add(house.front.x + dx);
  }
  const setFence = (x: number, y: number, tile: number): void => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
    if (y === gateY && gateXs.has(x)) return;
    // 건물 칸에는 울타리 금지 (마당 미확보 시 안전장치)
    if (contains(house.wing, x, y)) return;
    const L = map.lowerTiles[y * map.width + x] ?? -1;
    if (SAND_TILE_SET.has(L)) return;
    if (isMapWaterTile(L)) return;
    map.upperTiles[y * map.width + x] = tile;
  };
  for (let x = lot.x + 1; x < lastX; x += 1) {
    setFence(x, lot.y, FENCE_TOP_RAIL);
    setFence(x, lastY, FENCE_TOP_RAIL);
  }
  for (let y = lot.y + 1; y < lastY; y += 1) {
    setFence(lot.x, y, FENCE_SIDE_RAIL);
    setFence(lastX, y, FENCE_SIDE_RAIL);
  }
  setFence(lot.x, lot.y, FENCE_TOP_LEFT);
  setFence(lastX, lot.y, FENCE_TOP_RIGHT);
  setFence(lot.x, lastY, FENCE_BOTTOM_LEFT);
  setFence(lastX, lastY, FENCE_BOTTOM_RIGHT);
  return true;
}

/** 모래/길 lower 위에는 소품 금지 */
function isRoadCell(map: GameMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return true;
  const L = map.lowerTiles[y * map.width + x] ?? -1;
  return SAND_TILE_SET.has(L);
}

/** 집 바로 남쪽(문 쪽) 앞마당 칸인가 */
function isHouseFrontYard(house: BuiltHouseRef, x: number, y: number): boolean {
  const { wing } = house;
  // 문 행~문 앞 2칸, wing 가로 범위 ±1
  return (
    y >= wing.y + wing.h - 1
    && y <= wing.y + wing.h + 1
    && x >= wing.x - 1
    && x < wing.x + wing.w + 1
  );
}

/**
 * 집 마당 소품 — theme 함수로 집마다 다른 구성.
 * 장작=집 앞만, 의자 없음, 길 위 금지.
 */
function fillHouseYardProps(map: GameMap, house: BuiltHouseRef, rng: () => number): boolean {
  const { lot, wing, doorAt, front, hasFence, yardTheme } = house;
  type Spot = { x: number; y: number; front: boolean };
  const spots: Spot[] = [];
  for (let y = lot.y + 1; y < lot.y + lot.h - 1; y += 1) {
    for (let x = lot.x + 1; x < lot.x + lot.w - 1; x += 1) {
      if (contains(wing, x, y)) continue;
      // 다중 wing 질량 안도 스킵
      if (house.wings.some((fw) => x >= fw.x && x < fw.x + fw.w && y >= fw.y && y < fw.y + fw.h)) continue;
      if (x === doorAt.x && y === doorAt.y) continue;
      if (x === front.x && y === front.y) continue;
      if (Math.abs(x - front.x) <= 1 && y === front.y) continue;
      if (isRoadCell(map, x, y)) continue;
      if (isMapWaterTile(map.lowerTiles[y * map.width + x] ?? -1)) continue;
      const U = map.upperTiles[y * map.width + x] ?? TILE.EMPTY;
      if (U !== TILE.EMPTY && U >= 0) continue;
      const frontYard = isHouseFrontYard(house, x, y);
      if (!hasFence && !frontYard) continue;
      spots.push({ x, y, front: frontYard });
    }
  }
  if (spots.length === 0) return false;
  spots.sort((a, b) => Number(b.front) - Number(a.front) || a.y - b.y || a.x - b.x);

  const used = new Set<string>();
  const place = (x: number, y: number, tile: number, frontOnly = false): boolean => {
    const k = `${x},${y}`;
    if (used.has(k)) return false;
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
    if (house.wings.some((fw) => x >= fw.x && x < fw.x + fw.w && y >= fw.y && y < fw.y + fw.h)) return false;
    if (isRoadCell(map, x, y)) return false;
    if (frontOnly && !isHouseFrontYard(house, x, y)) return false;
    if (isMapWaterTile(map.lowerTiles[y * map.width + x] ?? -1)) return false;
    const U = map.upperTiles[y * map.width + x] ?? TILE.EMPTY;
    if (U !== TILE.EMPTY && U >= 0) return false;
    map.upperTiles[y * map.width + x] = tile;
    used.add(k);
    return true;
  };

  let placed = 0;
  const frontSpots = spots.filter((s) => s.front);
  const sideSpots = spots.filter((s) => !s.front);

  // 테마별 레시피
  switch (yardTheme) {
    case "garden": {
      if (place(doorAt.x - 1, front.y, FLOWER, true)) placed += 1;
      if (place(doorAt.x + 1, front.y, FLOWER, true)) placed += 1;
      for (const s of frontSpots) {
        if (placed >= 5) break;
        if (place(s.x, s.y, FLOWER, true)) placed += 1;
      }
      for (const s of sideSpots) {
        if (placed >= 7) break;
        if (rng() < 0.5 && place(s.x, s.y, FLOWER, false)) placed += 1;
      }
      break;
    }
    case "workshop": {
      if (place(doorAt.x - 1, front.y, WOOD_BOX, true)) placed += 1;
      for (const s of frontSpots) {
        if (place(s.x, s.y, FIREWOOD, true)) {
          placed += 1;
          break;
        }
      }
      let boxes = 0;
      for (const s of [...frontSpots, ...sideSpots]) {
        if (boxes >= 2) break;
        if (place(s.x, s.y, WOOD_BOX, false)) {
          boxes += 1;
          placed += 1;
        }
      }
      break;
    }
    case "storage": {
      for (const s of frontSpots) {
        if (place(s.x, s.y, FIREWOOD, true)) {
          placed += 1;
          break;
        }
      }
      let boxes = 0;
      for (const s of sideSpots) {
        if (boxes >= 3) break;
        if (place(s.x, s.y, WOOD_BOX, false)) {
          boxes += 1;
          placed += 1;
        }
      }
      if (place(doorAt.x + 1, front.y, FLOWER, true)) placed += 1;
      break;
    }
    case "pathside": {
      if (place(doorAt.x - 1, front.y, FLOWER, true)) placed += 1;
      if (place(doorAt.x + 1, front.y, FLOWER, true)) placed += 1;
      // 문 앞 한쪽에만 장작 (50%)
      if (rng() < 0.5) {
        for (const s of frontSpots) {
          if (place(s.x, s.y, FIREWOOD, true)) {
            placed += 1;
            break;
          }
        }
      }
      break;
    }
    case "minimal":
    default: {
      if (rng() < 0.7 && place(doorAt.x - 1, front.y, FLOWER, true)) placed += 1;
      if (rng() < 0.5 && place(doorAt.x + 1, front.y, FLOWER, true)) placed += 1;
      break;
    }
  }

  return placed > 0;
}

/**
 * 의자/벤치: 길 **옆**에 **가끔**만 (마을당 2~4쌍 수준).
 * 울타리 필지·길 위·집 안 금지.
 */
function placeBenchesAlongRoads(
  map: GameMap,
  houseWings: readonly BBox[],
  plan: VillageBboxPlan,
  protectedCells: ReadonlySet<string>,
  rng: () => number,
  log: LargeVillageBuildLog,
): number {
  type Edge = { x: number; y: number };
  const edges: Edge[] = [];
  for (let y = 1; y < map.height - 1; y += 1) {
    for (let x = 1; x < map.width - 2; x += 1) {
      if (isRoadCell(map, x, y) || isRoadCell(map, x + 1, y)) continue;
      if (protectedCells.has(`${x},${y}`) || protectedCells.has(`${x + 1},${y}`)) continue;
      if (isMapWaterTile(map.lowerTiles[y * map.width + x] ?? -1)) continue;
      if (isMapWaterTile(map.lowerTiles[y * map.width + x + 1] ?? -1)) continue;
      if (isInsideAnyWing(houseWings, x, y) || isInsideAnyWing(houseWings, x + 1, y)) continue;
      if (contains(plan.market, x, y) || contains(plan.market, x + 1, y)) continue;
      const U0 = map.upperTiles[y * map.width + x] ?? TILE.EMPTY;
      const U1 = map.upperTiles[y * map.width + x + 1] ?? TILE.EMPTY;
      if ((U0 !== TILE.EMPTY && U0 >= 0) || (U1 !== TILE.EMPTY && U1 >= 0)) continue;
      const nearRoad =
        isRoadCell(map, x - 1, y)
        || isRoadCell(map, x + 2, y)
        || isRoadCell(map, x, y - 1)
        || isRoadCell(map, x, y + 1)
        || isRoadCell(map, x + 1, y - 1)
        || isRoadCell(map, x + 1, y + 1);
      if (!nearRoad) continue;
      edges.push({ x, y });
    }
  }
  shuffle(edges, rng);
  // 드묾: 50맵 2~3, 100맵 3~5
  const target = map.width <= 60
    ? 2 + Math.floor(rng() * 2)
    : 3 + Math.floor(rng() * 3);
  let placed = 0;
  const used = new Set<string>();
  for (const e of edges) {
    if (placed >= target) break;
    const k0 = `${e.x},${e.y}`;
    const k1 = `${e.x + 1},${e.y}`;
    if (used.has(k0) || used.has(k1)) continue;
    if (isRoadCell(map, e.x, e.y) || isRoadCell(map, e.x + 1, e.y)) continue;
    map.upperTiles[e.y * map.width + e.x] = BENCH_L;
    map.upperTiles[e.y * map.width + e.x + 1] = BENCH_R;
    used.add(k0);
    used.add(k1);
    // 넓은 쿨다운 → 드문 배치
    for (let dy = -5; dy <= 5; dy += 1) {
      for (let dx = -6; dx <= 6; dx += 1) {
        used.add(`${e.x + dx},${e.y + dy}`);
      }
    }
    placed += 1;
  }
  log.info("benches-along-roads", String(placed), { target });
  return placed;
}

/** 길(모래) 위에 올라간 소품 upper 제거 — 울타리·건물 제외 */
function clearPropsOnRoads(map: GameMap, log: LargeVillageBuildLog): number {
  const propTiles = new Set<number>([
    FLOWER,
    WOOD_BOX,
    FIREWOOD,
    BENCH_L,
    BENCH_R,
    FRUIT_L,
    FRUIT_R,
    TABLE_L,
    TABLE_M,
    TABLE_R,
    TREE_TOP,
  ]);
  let cleared = 0;
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (!isRoadCell(map, x, y)) continue;
      const U = map.upperTiles[y * map.width + x] ?? TILE.EMPTY;
      if (!propTiles.has(U)) continue;
      map.upperTiles[y * map.width + x] = TILE.EMPTY;
      cleared += 1;
    }
  }
  // 길 위 나무 밑동(lower)도 잔디로 되돌리지 않음 — 밑동 타일만 길과 겹치면 제거
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (!isRoadCell(map, x, y)) continue;
      const L = map.lowerTiles[y * map.width + x] ?? -1;
      if (L === TREE_BOTTOM) {
        // 모래 유지, 밑동만 비정상 — 이미 isRoadCell이면 lower는 모래이므로 스킵
      }
    }
  }
  log.info("clear-props-on-roads", String(cleared));
  return cleared;
}

function placeVillagePropsAndTrees(
  ctx: { project: Project },
  map: GameMap,
  plan: VillageBboxPlan,
  houseWings: readonly BBox[],
  protectedCells: ReadonlySet<string>,
  seed: number,
  toolWarnings: string[],
  log: LargeVillageBuildLog,
  mapId: string,
): void {
  const forest = plan.bboxes.find((b) => b.role === "forest");
  const scale = map.width <= 60 ? 0.5 : 1;
  const forestArea = {
    x: forest?.x ?? map.width - 5,
    y: forest?.y ?? Math.floor(map.height * 0.25),
    w: Math.max(5, forest?.w ?? 5),
    h: forest?.h ?? Math.floor(map.height * 0.5),
  };
  // 2x2 활엽 공간
  if (forestArea.w < 6) {
    forestArea.x = Math.max(0, forestArea.x - 1);
    forestArea.w = Math.min(map.width - forestArea.x, Math.max(6, forestArea.w + 2));
  }

  type Band = {
    name: string;
    area: { x: number; y: number; w: number; h: number };
    material: string;
    count: number;
    gap: number;
  };
  // 숲 본체는 곡선 수동 채움 — place_props 는 호수/강/광장 보조만 (1x2 희소)
  const bands: Band[] = [
    {
      name: "lake-west-broadleaf",
      area: {
        x: Math.max(0, plan.lake.x - 5),
        y: plan.lake.y,
        w: 5,
        h: plan.lake.h + 3,
      },
      material: "활엽수",
      count: Math.max(3, Math.floor(8 * scale)),
      gap: 2,
    },
    {
      name: "lake-south-broadleaf",
      area: {
        x: Math.max(0, plan.lake.x - 1),
        y: plan.lake.y + plan.lake.h,
        w: plan.lake.w + 2,
        h: 5,
      },
      material: "활엽수",
      count: Math.max(3, Math.floor(8 * scale)),
      gap: 3,
    },
    {
      name: "river-west-bank-sparse-conifer",
      area: {
        x: Math.max(0, (plan.rivers[0]?.w ?? 4) - 1),
        y: 4,
        w: 4,
        h: Math.max(10, map.height - 12),
      },
      material: "침엽수",
      count: Math.max(3, Math.floor(8 * scale)),
      gap: 3,
    },
    {
      name: "river-south-bank",
      area: {
        x: 6,
        y: Math.max(0, (plan.rivers[1]?.y ?? map.height - 5) - 3),
        w: Math.max(10, map.width - 12),
        h: 4,
      },
      material: "마른나무",
      count: Math.max(3, Math.floor(8 * scale)),
      gap: 3,
    },
    {
      name: "plaza-flowers",
      area: { x: plan.plaza.x, y: plan.plaza.y, w: plan.plaza.w, h: plan.plaza.h },
      material: "꽃",
      count: Math.max(3, Math.floor(6 * scale)),
      gap: 1,
    },
  ];

  let totalProps = 0;
  for (let i = 0; i < bands.length; i += 1) {
    const b = bands[i]!;
    if (b.area.w < 2 || b.area.h < 2) continue;
    try {
      const result = runOk(ctx, "place_props", {
        mapId,
        area: b.area,
        material: b.material,
        count: b.count,
        minGap: b.gap,
        naturalness: 0.55 + (i % 3) * 0.05,
        seed: seed + 200 + i * 31,
      }, toolWarnings, log);
      const data = (result.data ?? {}) as { placed?: number };
      const n = typeof data.placed === "number" ? data.placed : 0;
      totalProps += n;
      log.info("props", b.name, { requested: b.count, placed: n, material: b.material });
    } catch (err) {
      log.warn("props-skip", {
        band: b.name,
        error: err instanceof Error ? err.message.slice(0, 120) : String(err),
      });
    }
  }

  // 숲: sin 곡선 척추 따라 2×2 활엽 중심 + 1×2 침엽 희소
  const curved = stampCurvedForest(
    map,
    plan,
    houseWings,
    protectedCells,
    forestArea,
    seed + 55,
  );
  log.info("forest-curved", `2x2=${curved.broadleaf} 1x2=${curved.conifer}`, forestArea);

  // place_props 가 보호 필지 안에 찍었을 수 있음 → 청소
  const scrubbedTrees = scrubInvasionsIntoProtected(map, protectedCells, true);
  log.info(
    "decor-trees-summary",
    `place_props≈${totalProps} conifer1x2=${curved.conifer} broadleaf2x2=${curved.broadleaf} scrub=${scrubbedTrees}`,
  );
}

/**
 * 동쪽 숲 밴드를 강처럼 sin 으로 흔든 뒤, 곡선을 따라 2×2 활엽을 주력 배치.
 * 1×2 침엽은 가장자리·드문 틈에만.
 */
function stampCurvedForest(
  map: GameMap,
  plan: VillageBboxPlan,
  houseWings: readonly BBox[],
  protectedCells: ReadonlySet<string>,
  forest: { x: number; y: number; w: number; h: number },
  seed: number,
): { broadleaf: number; conifer: number } {
  const rng = mulberry(seed);
  const half = Math.max(2, Math.floor(forest.w / 2));
  const amp = Math.max(1, half - 1);
  const phase = rng() * Math.PI * 2;
  const freq = 0.11 + rng() * 0.07;
  let broadleaf = 0;
  let conifer = 0;

  // 1) 곡선 본체: y 스텝 2 (2×2 격자), x는 sin 중심
  for (let y = forest.y; y < forest.y + forest.h - 1; y += 2) {
    const cx = forest.x + half + Math.round(Math.sin(y * freq + phase) * amp);
    // 폭: 중심 부근 두껍게, 가장자리 듬성
    for (let dx = -half; dx <= half - 1; dx += 2) {
      const x = cx + dx;
      if (x < 0 || x + 1 >= map.width) continue;
      // 중심에서 멀수록 스킵 확률↑ → 곡선 실루엣
      const edge = Math.abs(dx) / Math.max(1, half);
      if (edge > 0.35 && rng() < edge * 0.55) continue;
      if (stampBroadleaf2x2IfFree(map, plan, houseWings, protectedCells, x, y)) {
        broadleaf += 1;
      }
    }
  }

  // 2) 곡선 가장자리·빈 칸에 1×2 침엽 희소 (~15% 시도)
  for (let y = forest.y; y < forest.y + forest.h - 1; y += 1) {
    const cx = forest.x + half + Math.round(Math.sin(y * freq + phase) * amp);
    for (let dx = -half - 1; dx <= half + 1; dx += 1) {
      if (rng() > 0.14) continue;
      const x = cx + dx;
      if (Math.abs(dx) < half * 0.4 && rng() < 0.7) continue; // 중심은 2x2 위주
      if (stampConiferIfFree(map, plan, houseWings, protectedCells, x, y)) conifer += 1;
    }
  }

  // 3) 호수 남·서 쪽 2×2 소량 보강
  for (let i = 0; i < (map.width <= 60 ? 6 : 12); i += 1) {
    if (stampBroadleaf2x2IfFree(
      map,
      plan,
      houseWings,
      protectedCells,
      plan.lake.x + (i % 4) * 2,
      plan.lake.y + plan.lake.h + (i % 2),
    )) broadleaf += 1;
  }

  return { broadleaf, conifer };
}

function buildVillageLayoutPlan(
  plan: VillageBboxPlan,
  houses: readonly BuiltHouseRef[],
  seed: number,
  map: GameMap,
): MapLayoutPlan {
  const cx = map.width / 2;
  const cy = map.height / 2;
  const regions: MapLayoutRegion[] = [];

  for (const r of plan.rivers) {
    regions.push({
      id: r.id,
      role: "river",
      label: r.id.includes("west") ? "서쪽 강" : r.id.includes("south") ? "남쪽 강" : "강",
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      tags: ["water", "river"],
    });
  }
  regions.push({
    id: plan.lake.id,
    role: "lake",
    label: "호수",
    x: plan.lake.x,
    y: plan.lake.y,
    w: plan.lake.w,
    h: plan.lake.h,
    tags: ["water", "lake"],
  });
  regions.push({
    id: plan.plaza.id,
    role: "plaza",
    label: "중앙 광장",
    x: plan.plaza.x,
    y: plan.plaza.y,
    w: plan.plaza.w,
    h: plan.plaza.h,
    tags: ["plaza", "centerish"],
  });
  regions.push({
    id: plan.market.id,
    role: "market",
    label: map.height >= 80 ? "북쪽 상점가(장터·무기)" : "상점(장터 데크)",
    x: plan.market.x,
    y: plan.market.y,
    w: plan.market.w,
    h: plan.market.h,
    tags: ["market", "shop", "weapon", "wood-deck", ...(plan.market.y < map.height * 0.25 ? ["north"] : ["centerish"])],
  });
  for (const b of plan.bboxes) {
    if (b.role !== "forest") continue;
    regions.push({
      id: b.id,
      role: "forest",
      label: "동쪽 곡선 숲",
      x: b.x,
      y: b.y,
      w: b.w,
      h: b.h,
      tags: ["forest", "trees", "curved", "broadleaf-2x2"],
    });
  }

  for (const h of houses) {
    const kitLabel =
      h.kitId === "blue-stone" ? "파랑 지붕 석벽 집"
      : h.kitId === "bright-plaster" ? "밝은 회벽 집"
      : "집";
    const shapeLabel =
      h.shape === "L" ? "ㄱ자"
      : h.shape === "J" ? "ㄴ자"
      : h.shape === "U" ? "ㄷ자"
      : h.shape === "tall" ? "높은"
      : "사각";
    const centerish =
      Math.hypot(h.lot.x + h.lot.w / 2 - cx, h.lot.y + h.lot.h / 2 - cy) < Math.min(map.width, map.height) * 0.28;
    regions.push({
      id: h.lot.id,
      role: "house",
      label: `${kitLabel} (${shapeLabel})`,
      x: h.lot.x,
      y: h.lot.y,
      w: h.lot.w,
      h: h.lot.h,
      kitId: h.kitId,
      shape: h.shape,
      yardTheme: h.yardTheme,
      doorAt: h.doorAt,
      front: h.front,
      hasFence: h.hasFence,
      tags: [
        "house",
        h.kitId,
        h.shape,
        h.yardTheme,
        ...(h.hasFence ? ["fenced"] : []),
        ...(centerish ? ["centerish"] : []),
      ],
    });
  }

  return {
    version: 1,
    kind: "large-river-market-village",
    seed,
    generatedAt: new Date().toISOString(),
    regions,
    roadAnchors: plan.roadAnchors.map((a) => ({ id: a.id, x: a.x, y: a.y })),
    notes: "bbox 설계도 — 시공 후 유지. 영역 이동/질의 시 layoutPlan.regions 사용.",
  };
}

function cellFreeForTree(
  map: GameMap,
  plan: VillageBboxPlan,
  houseWings: readonly BBox[],
  protectedCells: ReadonlySet<string>,
  x: number,
  y: number,
): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  if (protectedCells.has(`${x},${y}`)) return false;
  if (isInsideAnyWing(houseWings, x, y)) return false;
  if (contains(plan.market, x, y) || contains(plan.plaza, x, y)) return false;
  const L = map.lowerTiles[y * map.width + x] ?? -1;
  if (isMapWaterTile(L) || SAND_TILE_SET.has(L)) return false;
  const U = map.upperTiles[y * map.width + x] ?? TILE.EMPTY;
  if (U !== TILE.EMPTY && U >= 0) return false;
  return true;
}

function stampConiferIfFree(
  map: GameMap,
  plan: VillageBboxPlan,
  houseWings: readonly BBox[],
  protectedCells: ReadonlySet<string>,
  x: number,
  y: number,
): boolean {
  if (!cellFreeForTree(map, plan, houseWings, protectedCells, x, y)) return false;
  if (!cellFreeForTree(map, plan, houseWings, protectedCells, x, y + 1)) return false;
  // 하단 칸 lower 가 잔디여야 밑동 가능
  const L1 = map.lowerTiles[(y + 1) * map.width + x] ?? -1;
  if (L1 !== TILE.GRASS && L1 !== TILE.EMPTY && L1 !== -1 && L1 !== 270 && L1 !== 240) {
    // allow default grass variants only roughly — skip if sand/water already checked
  }
  map.upperTiles[y * map.width + x] = TREE_TOP;
  map.lowerTiles[(y + 1) * map.width + x] = TREE_BOTTOM;
  map.upperTiles[(y + 1) * map.width + x] = TILE.EMPTY;
  return true;
}

/** 활엽수 2×2 원자 */
function stampBroadleaf2x2IfFree(
  map: GameMap,
  plan: VillageBboxPlan,
  houseWings: readonly BBox[],
  protectedCells: ReadonlySet<string>,
  x: number,
  y: number,
): boolean {
  for (let dy = 0; dy < 2; dy += 1) {
    for (let dx = 0; dx < 2; dx += 1) {
      if (!cellFreeForTree(map, plan, houseWings, protectedCells, x + dx, y + dy)) return false;
    }
  }
  map.upperTiles[y * map.width + x] = BROADLEAF_TL;
  map.upperTiles[y * map.width + x + 1] = BROADLEAF_TR;
  map.lowerTiles[(y + 1) * map.width + x] = BROADLEAF_BL;
  map.lowerTiles[(y + 1) * map.width + x + 1] = BROADLEAF_BR;
  map.upperTiles[(y + 1) * map.width + x] = TILE.EMPTY;
  map.upperTiles[(y + 1) * map.width + x + 1] = TILE.EMPTY;
  return true;
}

function setLower(map: GameMap, x: number, y: number, tile: number): void {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
  map.lowerTiles[y * map.width + x] = tile;
}

function placeFisherAtLake(map: GameMap, lake: BBox, log: LargeVillageBuildLog): { x: number; y: number } | null {
  const candidates: { x: number; y: number }[] = [];
  for (let y = lake.y; y < lake.y + lake.h + 3; y += 1) {
    for (let x = lake.x - 3; x < lake.x + lake.w + 2; x += 1) {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      if (isMapWaterTile(map.lowerTiles[y * map.width + x] ?? -1)) continue;
      if ((map.upperTiles[y * map.width + x] ?? -1) >= 0) continue;
      if (map.events.some((e) => e.x === x && e.y === y)) continue;
      const near =
        isWater(map, x + 1, y)
        || isWater(map, x - 1, y)
        || isWater(map, x, y + 1)
        || isWater(map, x, y - 1);
      if (near) candidates.push({ x, y });
    }
  }
  candidates.sort((a, b) => b.y - a.y || a.x - b.x);
  log.info("fisher-candidates", String(candidates.length));
  const pick = candidates[0];
  if (!pick) return null;
  map.events.push({
    id: "ev_fisher_lake",
    x: pick.x,
    y: pick.y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "ev_fisher_lake_page",
        name: "낚시꾼 올드",
        conditions: [],
        graphic: charsetGraphic("tex_easyrpg_charset_people3", 0),
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: FIXED,
        commands: [
          { kind: "text", speaker: "낚시꾼 올드", body: "호수 자리는 미리 잡아 뒀지. 강 쪽은 물살이 세." },
          { kind: "text", speaker: "낚시꾼 올드", body: "한 마리 잡으면 장터로 가져갈 거야." },
        ],
      },
    ],
  });
  return pick;
}

function topUpNpcs(
  map: GameMap,
  project: Project,
  plan: VillageBboxPlan,
  target: number,
  seed: number,
  log: LargeVillageBuildLog,
  fencedProtected: ReadonlySet<string> = new Set(),
): void {
  let count = countVisibleNpcs(map);
  const occupied = new Set(map.events.map((e) => `${e.x},${e.y}`));
  occupied.add(`${project.startPos.x},${project.startPos.y}`);

  // 광장·시장·집 롯 가장자리 근처 우선 (기물 안쪽 침범 최소화)
  const preferred: { x: number; y: number }[] = [];
  const ring = (b: BBox) => {
    for (let x = b.x - 1; x < b.x + b.w + 1; x += 1) {
      preferred.push({ x, y: b.y - 1 });
      preferred.push({ x, y: b.y + b.h });
    }
    for (let y = b.y; y < b.y + b.h; y += 1) {
      preferred.push({ x: b.x - 1, y });
      preferred.push({ x: b.x + b.w, y });
    }
  };
  ring(plan.plaza);
  ring(plan.market);
  for (const h of plan.houseLots) ring(h);

  const rng = mulberry(seed);
  shuffle(preferred, rng);

  // 채수 부족 시 dry 격자 후보 추가 (50 NPC 목표)
  if (preferred.length < target * 3) {
    for (let y = 4; y < map.height - 4; y += 2) {
      for (let x = 6; x < map.width - 8; x += 2) {
        preferred.push({ x, y });
      }
    }
    shuffle(preferred, rng);
  }

  let n = 0;
  const tryPlace = (cell: { x: number; y: number }): boolean => {
    if (count >= target) return false;
    if (cell.x < 0 || cell.y < 0 || cell.x >= map.width || cell.y >= map.height) return false;
    if (occupied.has(`${cell.x},${cell.y}`)) return false;
    if (fencedProtected.has(`${cell.x},${cell.y}`)) return false;
    if (!isPassable(project, map, cell.x, cell.y)) return false;
    if (isMapWaterTile(map.lowerTiles[cell.y * map.width + cell.x] ?? -1)) return false;
    if (plan.houseLots.some((h) => contains(h, cell.x, cell.y))) return false;
    if (contains(plan.market, cell.x, cell.y)) return false;
    if (contains(plan.plaza, cell.x, cell.y) && rng() < 0.4) return false;

    const id = `ev_townsfolk_${n + 1}`;
    map.events.push({
      id,
      x: cell.x,
      y: cell.y,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: `${id}_page`,
          name: `주민 ${n + 1}`,
          conditions: [],
          graphic: charsetGraphic(NPC_SPRITES[n % NPC_SPRITES.length]!, n % 4),
          trigger: { kind: "action" },
          priority: "same",
          overlapForbidden: true,
          movement: n % 3 === 0 ? FIXED : RANDOM,
          commands: [{ kind: "text", speaker: `주민 ${n + 1}`, body: CHAT_LINES[n % CHAT_LINES.length]! }],
        },
      ],
    });
    occupied.add(`${cell.x},${cell.y}`);
    count += 1;
    n += 1;
    return true;
  };

  for (const cell of preferred) {
    if (count >= target) break;
    tryPlace(cell);
  }
  log.info("npc-placed", `${n} added, totalVisible=${count}`);
}

/** 남쪽 몬스터 소탕 퀘스트 + 의뢰 게시판 */
const VILLAGE_QUEST = {
  started: "sw_village_quest_started",
  southA: "sw_village_south_monster_a",
  southB: "sw_village_south_monster_b",
  complete: "sw_village_quest_complete",
  defeatedCount: "var_village_quest_kills",
} as const;

function placeVillageQuestAndSouthMonsters(
  map: GameMap,
  project: Project,
  plan: VillageBboxPlan,
  log: LargeVillageBuildLog,
): void {
  ensureProjectSwitch(project, VILLAGE_QUEST.started, "남쪽 몬스터 의뢰 수락");
  ensureProjectSwitch(project, VILLAGE_QUEST.southA, "남쪽 슬라임 격파");
  ensureProjectSwitch(project, VILLAGE_QUEST.southB, "남쪽 박쥐 격파");
  ensureProjectSwitch(project, VILLAGE_QUEST.complete, "남쪽 몬스터 의뢰 완료");
  ensureProjectVariable(project, VILLAGE_QUEST.defeatedCount, "남쪽 몬스터 격파 수");

  const mkt = plan.market;
  const brokerX = clamp(mkt.x + Math.floor(mkt.w / 2), 1, map.width - 2);
  const brokerY = clamp(mkt.y + mkt.h + 1, 1, map.height - 2);
  const boardX = clamp(brokerX + 2, 1, map.width - 2);
  const boardY = brokerY;

  // 의뢰 게시판 (타일 표지판)
  setUpper(map, boardX, boardY, 320);
  map.events.push(villageQuestBoardEvent(boardX, boardY));
  map.events.push(villageQuestBrokerEvent(brokerX, brokerY));

  // 남쪽 강 북측 풀밭 — 몬스터 2
  const southY = clamp((plan.rivers.find((r) => r.id.includes("south"))?.y ?? map.height - 8) - 3, 4, map.height - 3);
  const midX = Math.floor(map.width / 2);
  const monsters = [
    {
      id: "ev_south_monster_slime",
      name: "남쪽 슬라임",
      x: clamp(midX - 8, 8, map.width - 8),
      y: southY,
      sprite: "tex_easyrpg_charset_monster1",
      idx: 0,
      switchId: VILLAGE_QUEST.southA,
      troopId: "troop_slime_pair",
      intro: "남쪽 강변에서 슬라임이 길을 막았다!",
    },
    {
      id: "ev_south_monster_bat",
      name: "남쪽 박쥐떼",
      x: clamp(midX + 6, 8, map.width - 8),
      y: southY + 1,
      sprite: "tex_easyrpg_charset_monster2",
      idx: 2,
      switchId: VILLAGE_QUEST.southB,
      troopId: "troop_bat_swarm",
      intro: "남쪽 숲 가장자리에서 박쥐떼가 덤벼든다!",
    },
  ] as const;

  for (const m of monsters) {
    // 물/집 안이면 한 칸씩 북으로
    let { x, y } = m;
    for (let t = 0; t < 6; t += 1) {
      if (!isMapWaterTile(map.lowerTiles[y * map.width + x] ?? -1) && !plan.houseLots.some((h) => contains(h, x, y))) break;
      y = Math.max(2, y - 1);
    }
    map.events.push(villageMonsterEvent({ ...m, x, y }));
    log.info("south-monster", m.id, { x, y });
  }
  log.info("quest-placed", `broker@${brokerX},${brokerY} board@${boardX},${boardY} monsters=2`);
}

function ensureProjectSwitch(project: Project, id: string, name: string): void {
  if (!project.switches.some((s) => s.id === id)) {
    project.switches.push({ id, name });
  }
  project.session.switches[id] = project.session.switches[id] ?? false;
}

function ensureProjectVariable(project: Project, id: string, name: string): void {
  if (!project.variables.some((v) => v.id === id)) {
    project.variables.push({ id, name });
  }
  project.session.variables[id] = project.session.variables[id] ?? 0;
}

function villageQuestBoardEvent(x: number, y: number): GameEvent {
  return {
    id: "ev_village_quest_board",
    x,
    y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "page_quest_board",
        name: "의뢰 게시판",
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: FIXED,
        commands: [
          {
            kind: "text",
            speaker: "의뢰 게시판",
            body: "긴급: 남쪽 강변 슬라임·박쥐떼 출몰. 의뢰 중개인 미라에게 문의. 무기 상점에서 투척 무기를 사 가시오.",
          },
        ],
      },
    ],
  };
}

function villageQuestBrokerEvent(x: number, y: number): GameEvent {
  const speaker = "의뢰 중개인 미라";
  const gfx = charsetGraphic("tex_easyrpg_charset_people2", 1);
  return {
    id: "ev_village_quest_broker",
    x,
    y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "page_quest_offer",
        name: speaker,
        conditions: [],
        graphic: gfx,
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: FIXED,
        commands: [
          { kind: "text", speaker, body: "남쪽 강변 몬스터 때문에 상인들이 겁을 먹고 있어. 북쪽 무기 상점에서 채비하고 가 줄래?" },
          {
            kind: "choices",
            prompt: "남쪽 몬스터 두 무리를 정리해 줄래?",
            options: [
              {
                text: "맡는다",
                branch: [
                  { kind: "setSwitch", switchId: VILLAGE_QUEST.started, value: true },
                  { kind: "setVariable", variableId: VILLAGE_QUEST.defeatedCount, op: "=", value: 0 },
                  { kind: "text", speaker, body: "좋아. 남쪽 강 근처 두 무리를 쓰러뜨리고 돌아와." },
                ],
              },
              { text: "나중에", branch: [{ kind: "text", speaker, body: "준비가 되면 다시 찾아와." }] },
            ],
            cancelBehavior: "choice2",
          },
        ],
      },
      {
        id: "page_quest_active",
        name: speaker,
        conditions: [
          { kind: "switch", switchId: VILLAGE_QUEST.started, value: true },
          { kind: "switch", switchId: VILLAGE_QUEST.complete, value: false },
          { kind: "variable", variableId: VILLAGE_QUEST.defeatedCount, op: "<", value: 2 },
        ],
        graphic: gfx,
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: FIXED,
        commands: [{ kind: "text", speaker, body: "아직 남쪽이 위험해. 슬라임과 박쥐를 모두 처리해 줘." }],
      },
      {
        id: "page_quest_reward",
        name: speaker,
        conditions: [
          { kind: "switch", switchId: VILLAGE_QUEST.started, value: true },
          { kind: "switch", switchId: VILLAGE_QUEST.complete, value: false },
          { kind: "variable", variableId: VILLAGE_QUEST.defeatedCount, op: ">=", value: 2 },
        ],
        graphic: gfx,
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: FIXED,
        commands: [
          { kind: "text", speaker, body: "남쪽 길이 열렸어! 시장 사람들이 네 이름을 기억할 거야." },
          { kind: "changeGold", op: "+=", amount: 200 },
          { kind: "changeItem", itemId: DEFAULT_ITEM_ID, op: "+=", amount: 3 },
          { kind: "setSwitch", switchId: VILLAGE_QUEST.complete, value: true },
          { kind: "text", speaker, body: "보상 200G와 포션 3개야. 무기 상인 칼스에게도 인사 해 둬." },
        ],
      },
      {
        id: "page_quest_done",
        name: speaker,
        conditions: [{ kind: "switch", switchId: VILLAGE_QUEST.complete, value: true }],
        graphic: gfx,
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: FIXED,
        commands: [{ kind: "text", speaker, body: "덕분에 남쪽 길이 다시 움직인다. 고마워." }],
      },
    ],
  };
}

function villageMonsterEvent(input: {
  id: string;
  name: string;
  x: number;
  y: number;
  sprite: string;
  idx: number;
  switchId: string;
  troopId: string;
  intro: string;
}): GameEvent {
  const gfx = charsetGraphic(input.sprite, input.idx);
  return {
    id: input.id,
    x: input.x,
    y: input.y,
    trigger: { kind: "playerTouch" },
    commands: [],
    pages: [
      {
        id: `${input.id}_locked`,
        name: input.name,
        conditions: [],
        graphic: gfx,
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: FIXED,
        commands: [
          { kind: "text", speaker: input.name, body: "아직 상대할 이유가 없다. 북쪽 상점가의 의뢰 중개인 미라에게 먼저 가 보자." },
        ],
      },
      {
        id: `${input.id}_battle`,
        name: input.name,
        conditions: [
          { kind: "switch", switchId: VILLAGE_QUEST.started, value: true },
          { kind: "switch", switchId: input.switchId, value: false },
        ],
        graphic: gfx,
        trigger: { kind: "playerTouch" },
        priority: "same",
        overlapForbidden: true,
        movement: FIXED,
        commands: [
          { kind: "text", speaker: input.name, body: input.intro },
          { kind: "battleProcessing", troopId: input.troopId, canEscape: true, canLose: false },
          {
            kind: "fork",
            condition: { kind: "battleResult", result: "victory" },
            then: [
              { kind: "setSwitch", switchId: input.switchId, value: true },
              { kind: "m2Command", commandId: "m2-086-erase-event", fields: {} },
              { kind: "setVariable", variableId: VILLAGE_QUEST.defeatedCount, op: "+=", value: 1 },
              { kind: "changeGold", op: "+=", amount: 30 },
              { kind: "text", speaker: input.name, body: "무리가 흩어졌다. 미라에게 보고하자." },
            ],
          },
        ],
      },
      {
        id: `${input.id}_cleared`,
        name: input.name,
        conditions: [{ kind: "switch", switchId: input.switchId, value: true }],
        graphic: gfx,
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: FIXED,
        commands: [{ kind: "text", speaker: input.name, body: "이 일대는 이미 정리됐다." }],
      },
    ],
  };
}

// ─── util ─────────────────────────────────────────────

function runOk(
  ctx: { project: Project },
  name: string,
  args: Record<string, unknown>,
  toolWarnings: string[],
  log: LargeVillageBuildLog,
) {
  log.info("tool-call", name, argsBrief(args));
  const result = runTool(ctx, name, args);
  if (!result.ok) {
    log.error(`tool-fail ${name}`, { summary: result.summary, issues: result.issues });
    throw new Error(`${name} failed: ${result.summary}`);
  }
  if (result.warnings?.length) {
    toolWarnings.push(...result.warnings);
    log.warn(`tool-warn ${name}: ${result.warnings.join(" | ")}`);
  }
  log.info("tool-ok", name, { summary: result.summary });
  return result;
}

function argsBrief(args: Record<string, unknown>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (Array.isArray(v) && v.length > 4) o[k] = `array(${v.length})`;
    else o[k] = v;
  }
  return o;
}

function requireMap(ctx: { project: Project }, mapId: string): GameMap {
  const map = ctx.project.maps[mapId];
  if (!map) throw new Error(`map missing: ${mapId}`);
  return map;
}

function countWater(map: GameMap): number {
  let n = 0;
  for (const t of map.lowerTiles) if (isMapWaterTile(t)) n += 1;
  return n;
}

function countDoorPairs(map: GameMap): number {
  let n = 0;
  for (const t of map.lowerTiles) if (t === 146) n += 1;
  return n;
}

function countVisibleNpcs(map: GameMap): number {
  return map.events.filter((e) => {
    const g = e.pages?.[0]?.graphic;
    return Boolean(g && !g.transparent && g.sprite);
  }).length;
}

function isWater(map: GameMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  return isMapWaterTile(map.lowerTiles[y * map.width + x] ?? -1);
}

function contains(b: BBox, x: number, y: number): boolean {
  return x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * 울타리로 완전히 둘러싼 필지 내부(둘레 포함) 보호 셀.
 * 남쪽 게이트 3칸만 열어 문 접근 가능.
 */
function buildFencedLotProtectedSet(houses: readonly BuiltHouseRef[]): Set<string> {
  const protectedCells = new Set<string>();
  for (const h of houses) {
    if (!h.hasFence) continue;
    const lot = h.lot;
    const lastY = lot.y + lot.h - 1;
    const gateXs = new Set<number>();
    for (let dx = -1; dx <= 1; dx += 1) {
      gateXs.add(h.doorAt.x + dx);
      gateXs.add(h.front.x + dx);
    }
    for (let y = lot.y; y < lot.y + lot.h; y += 1) {
      for (let x = lot.x; x < lot.x + lot.w; x += 1) {
        if (y === lastY && gateXs.has(x)) continue; // 게이트
        protectedCells.add(`${x},${y}`);
      }
    }
  }
  return protectedCells;
}

/**
 * 도로 금지: wing + 울타리 필지(게이트 제외) + 시장 + 실제 물 타일.
 * 무울타리 집 마당은 길이 문 앞으로 올 수 있음.
 */
function buildRoadBlockedSet(
  plan: VillageBboxPlan,
  houseWings: readonly BBox[],
  builtHouses: readonly BuiltHouseRef[],
  map: GameMap,
): Set<string> {
  const blocked = new Set<string>();
  const mark = (b: BBox) => {
    for (let y = b.y; y < b.y + b.h; y += 1) {
      for (let x = b.x; x < b.x + b.w; x += 1) {
        blocked.add(`${x},${y}`);
      }
    }
  };
  for (const w of houseWings) mark(w);
  // 울타리 집: 필지 전체 차단 (게이트만 개방)
  for (const h of builtHouses) {
    if (!h.hasFence) continue;
    const lot = h.lot;
    const lastY = lot.y + lot.h - 1;
    const gateXs = new Set<number>();
    for (let dx = -1; dx <= 1; dx += 1) {
      gateXs.add(h.doorAt.x + dx);
      gateXs.add(h.front.x + dx);
    }
    for (let y = lot.y; y < lot.y + lot.h; y += 1) {
      for (let x = lot.x; x < lot.x + lot.w; x += 1) {
        if (y === lastY && gateXs.has(x)) continue;
        blocked.add(`${x},${y}`);
      }
    }
  }
  mark(plan.market);
  // 장터 남쪽 입구 3칸 + 바로 남 1행만 개방 (한 줄 전체 개방 금지)
  const m = plan.market;
  const gateX0 = m.x + 1 + Math.floor(Math.max(8, m.w - 2) / 2) - 1;
  for (let dx = 0; dx < 3; dx += 1) {
    const gx = gateX0 + dx;
    blocked.delete(`${gx},${m.y + m.h - 1}`);
    blocked.delete(`${gx},${m.y + m.h}`);
  }
  // 실제 물 타일 (곡선 강 반영)
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (isMapWaterTile(map.lowerTiles[y * map.width + x] ?? -1)) {
        blocked.add(`${x},${y}`);
      }
    }
  }
  return blocked;
}

/** 서쪽 강: y마다 sin 으로 x 중심 흔들기 */
function paintCurvedRiverWest(map: GameMap, river: BBox, rng: () => number): number {
  const half = Math.max(1, Math.floor(river.w / 2));
  const amp = Math.max(1, half);
  const phase = rng() * Math.PI * 2;
  const freq = 0.12 + rng() * 0.08;
  let n = 0;
  for (let y = 0; y < map.height; y += 1) {
    const cx = river.x + half + Math.round(Math.sin(y * freq + phase) * amp);
    for (let dx = -half - 1; dx <= half + 1; dx += 1) {
      const x = cx + dx;
      if (x < 0 || x >= map.width) continue;
      // 가장자리는 듬성하게 → 곡선 느낌
      if (Math.abs(dx) > half && rng() < 0.45) continue;
      map.lowerTiles[y * map.width + x] = WATER_BODY;
      map.upperTiles[y * map.width + x] = TILE.EMPTY;
      n += 1;
    }
  }
  return n;
}

/** 남쪽 강: x마다 sin 으로 y 중심 흔들기 */
function paintCurvedRiverSouth(map: GameMap, river: BBox, rng: () => number): number {
  const half = Math.max(1, Math.floor(river.h / 2));
  const amp = Math.max(1, half);
  const phase = rng() * Math.PI * 2;
  const freq = 0.1 + rng() * 0.07;
  let n = 0;
  for (let x = 0; x < map.width; x += 1) {
    const cy = river.y + half + Math.round(Math.sin(x * freq + phase) * amp);
    for (let dy = -half - 1; dy <= half + 1; dy += 1) {
      const y = cy + dy;
      if (y < 0 || y >= map.height) continue;
      if (Math.abs(dy) > half && rng() < 0.45) continue;
      map.lowerTiles[y * map.width + x] = WATER_BODY;
      map.upperTiles[y * map.width + x] = TILE.EMPTY;
      n += 1;
    }
  }
  return n;
}

/** 울타리 필지 안 침범 제거: 모래 길·외부 소품(꽃/벤치/장작 아닌 마당 소품은 유지?) */
function scrubInvasionsIntoFencedLots(
  map: GameMap,
  houses: readonly BuiltHouseRef[],
): number {
  const protectedCells = buildFencedLotProtectedSet(houses);
  return scrubInvasionsIntoProtected(map, protectedCells, false);
}

/**
 * 보호 셀 청소.
 * treesOnly: 나무 관련만 / false: 모래 길 + 벤치 등 침범 소품 제거 (마당 꽃·장작·울타리는 유지)
 */
function scrubInvasionsIntoProtected(
  map: GameMap,
  protectedCells: ReadonlySet<string>,
  treesOnly: boolean,
): number {
  let n = 0;
  const treeUppers = new Set([TREE_TOP, BROADLEAF_TL, BROADLEAF_TR]);
  const treeLowers = new Set([TREE_BOTTOM, BROADLEAF_BL, BROADLEAF_BR]);
  const invaderUpper = new Set([BENCH_L, BENCH_R, TABLE_L, TABLE_M, TABLE_R]);
  for (const key of protectedCells) {
    const [xs, ys] = key.split(",");
    const x = Number(xs);
    const y = Number(ys);
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
    const i = y * map.width + x;
    const L = map.lowerTiles[i] ?? -1;
    const U = map.upperTiles[i] ?? TILE.EMPTY;
    if (!treesOnly && SAND_TILE_SET.has(L)) {
      // 길을 잔디로 되돌림
      map.lowerTiles[i] = 270;
      n += 1;
    }
    if (treeUppers.has(U) || (!treesOnly && invaderUpper.has(U))) {
      map.upperTiles[i] = TILE.EMPTY;
      n += 1;
    }
    if (treeLowers.has(L)) {
      map.lowerTiles[i] = 270;
      n += 1;
    }
  }
  return n;
}

function isInsideAnyWing(wings: readonly BBox[], x: number, y: number): boolean {
  return wings.some((w) => contains(w, x, y));
}

function snapToFree(
  p: { x: number; y: number },
  blocked: Set<string>,
  map: GameMap,
): { x: number; y: number } | null {
  const x0 = clamp(Math.round(p.x), 0, map.width - 1);
  const y0 = clamp(Math.round(p.y), 0, map.height - 1);
  if (!blocked.has(`${x0},${y0}`)) return { x: x0, y: y0 };
  for (let r = 1; r <= 8; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        const x = x0 + dx;
        const y = y0 + dy;
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
        if (!blocked.has(`${x},${y}`)) return { x, y };
      }
    }
  }
  return null;
}

/** BFS: 문앞에서 가장 가까운 기존 도로 셀 (blocked 회피) */
function nearestRoadCell(
  from: { x: number; y: number },
  roadNetwork: Set<string>,
  blocked: Set<string>,
  mapW: number,
  mapH: number,
): { x: number; y: number } | null {
  if (roadNetwork.size === 0) return null;
  const key = (x: number, y: number) => `${x},${y}`;
  const start = key(from.x, from.y);
  if (roadNetwork.has(start) && !blocked.has(start)) return { ...from };
  const q: { x: number; y: number }[] = [{ x: from.x, y: from.y }];
  const seen = new Set<string>([start]);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  let guard = 0;
  while (q.length > 0 && guard++ < mapW * mapH) {
    const cur = q.shift()!;
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= mapW || ny >= mapH) continue;
      const nk = key(nx, ny);
      if (seen.has(nk) || blocked.has(nk)) continue;
      if (roadNetwork.has(nk)) return { x: nx, y: ny };
      seen.add(nk);
      q.push({ x: nx, y: ny });
    }
  }
  return null;
}

/** 집 wing 테두리 1칸(건물 밖) — 간선이 골목으로 끼지 않게 비싸게 */
function buildNearWallSet(wings: readonly BBox[], mapW: number, mapH: number): Set<string> {
  const near = new Set<string>();
  for (const w of wings) {
    for (let y = w.y - 1; y <= w.y + w.h; y += 1) {
      for (let x = w.x - 1; x <= w.x + w.w; x += 1) {
        if (x < 0 || y < 0 || x >= mapW || y >= mapH) continue;
        if (contains(w, x, y)) continue;
        near.add(`${x},${y}`);
      }
    }
  }
  return near;
}

type AstarCosts = {
  prefer?: Set<string>;
  expensive?: Set<string>;
  expensiveCost?: number;
  /** 0~1 셀 비용 노이즈 — 직선 기피 */
  noise?: number;
  rng?: () => number;
};

/**
 * 4방향 A* — blocked 회피.
 * prefer: 이미 깐 길(비용↓). expensive: 집 벽 인접(비용↑). noise: 구불 유도.
 */
function astarAvoid(
  from: { x: number; y: number },
  to: { x: number; y: number },
  blocked: Set<string>,
  mapW: number,
  mapH: number,
  costs?: AstarCosts,
): { x: number; y: number }[] | null {
  const key = (x: number, y: number) => `${x},${y}`;
  const walkable = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < mapW && y < mapH && !blocked.has(key(x, y));

  if (!walkable(from.x, from.y) || !walkable(to.x, to.y)) return null;

  const open: { x: number; y: number; g: number; f: number }[] = [
    { x: from.x, y: from.y, g: 0, f: manhattan(from, to) },
  ];
  const came = new Map<string, string>();
  const gScore = new Map<string, number>([[key(from.x, from.y), 0]]);
  const closed = new Set<string>();
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  const expensiveCost = costs?.expensiveCost ?? 4;
  const noiseAmp = costs?.noise ?? 0;
  const rng = costs?.rng ?? (() => 0.5);

  let guard = 0;
  while (open.length > 0 && guard++ < mapW * mapH * 4) {
    open.sort((a, b) => a.f - b.f);
    const cur = open.shift()!;
    const ck = key(cur.x, cur.y);
    if (cur.x === to.x && cur.y === to.y) {
      return reconstruct(came, ck, from);
    }
    if (closed.has(ck)) continue;
    closed.add(ck);
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!walkable(nx, ny)) continue;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      let stepCost = 1;
      if (costs?.prefer?.has(nk)) stepCost = 0.2;
      else if (costs?.expensive?.has(nk)) stepCost = expensiveCost;
      if (noiseAmp > 0) stepCost += rng() * noiseAmp;
      const tentative = cur.g + stepCost;
      if (tentative >= (gScore.get(nk) ?? Infinity)) continue;
      came.set(nk, ck);
      gScore.set(nk, tentative);
      open.push({ x: nx, y: ny, g: tentative, f: tentative + manhattan({ x: nx, y: ny }, to) });
    }
  }
  return null;
}

/**
 * 구불구불 경로: 직통 A* 위에 옆길 경유점을 꽂고 구간 연결.
 * 막히면 직통으로 폴백.
 */
function windyAstar(
  from: { x: number; y: number },
  to: { x: number; y: number },
  blocked: Set<string>,
  mapW: number,
  mapH: number,
  costs?: AstarCosts,
): { x: number; y: number }[] | null {
  const direct = astarAvoid(from, to, blocked, mapW, mapH, costs);
  if (!direct || direct.length < 10) return direct;

  const rng = costs?.rng ?? mulberry(1);
  const midCount = 1 + Math.floor(rng() * 3); // 1~3 경유
  const waypoints: { x: number; y: number }[] = [from];
  for (let i = 1; i <= midCount; i += 1) {
    const t = i / (midCount + 1);
    const idx = clamp(Math.floor(t * (direct.length - 1)), 1, direct.length - 2);
    const base = direct[idx]!;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len;
    const py = dx / len;
    const amp = 2 + Math.floor(rng() * 4); // 2~5칸 옆
    const sign = rng() < 0.5 ? -1 : 1;
    let picked: { x: number; y: number } | null = null;
    for (let a = amp; a >= 1 && !picked; a -= 1) {
      for (const s of [sign, -sign]) {
        const x = clamp(Math.round(base.x + px * a * s), 0, mapW - 1);
        const y = clamp(Math.round(base.y + py * a * s), 0, mapH - 1);
        if (!blocked.has(`${x},${y}`)) {
          picked = { x, y };
          break;
        }
      }
    }
    waypoints.push(picked ?? base);
  }
  waypoints.push(to);

  const path: { x: number; y: number }[] = [];
  for (let i = 0; i < waypoints.length - 1; i += 1) {
    const seg = astarAvoid(waypoints[i]!, waypoints[i + 1]!, blocked, mapW, mapH, {
      ...costs,
      noise: (costs?.noise ?? 0.35) * 0.6,
    });
    if (!seg || seg.length === 0) return direct;
    if (path.length > 0) path.pop(); // 이어 붙일 때 중복 제거
    path.push(...seg);
  }
  return path.length > 0 ? path : direct;
}

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function reconstruct(
  came: Map<string, string>,
  endKey: string,
  from: { x: number; y: number },
): { x: number; y: number }[] {
  const path: { x: number; y: number }[] = [];
  let cur: string | undefined = endKey;
  while (cur) {
    const [xs, ys] = cur.split(",");
    path.push({ x: Number(xs), y: Number(ys) });
    if (Number(xs) === from.x && Number(ys) === from.y) break;
    cur = came.get(cur);
  }
  path.reverse();
  return path;
}

/** 경로 + 남쪽 1칸(차단 아니면)에 모래 깔기. 집 칸은 절대 안 칠함. */
function paintSandPath(
  map: GameMap,
  route: readonly { x: number; y: number }[],
  blocked: Set<string>,
): { x: number; y: number }[] {
  const painted: { x: number; y: number }[] = [];
  const paint = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
    if (blocked.has(`${x},${y}`)) return;
    map.lowerTiles[y * map.width + x] = SAND_TILE.BODY;
    // 집 지붕/벽 upper 는 건드리지 않음 — 차단 셀이면 이미 return
    painted.push({ x, y });
  };
  for (const c of route) {
    paint(c.x, c.y);
    paint(c.x, c.y + 1);
  }
  return painted;
}

function findPassableInBox(project: Project, map: GameMap, b: BBox): { x: number; y: number } | null {
  for (let y = b.y; y < b.y + b.h; y += 1) {
    for (let x = b.x; x < b.x + b.w; x += 1) {
      if (isPassable(project, map, x, y)) return { x, y };
    }
  }
  return null;
}

/** H=집 wing / R=모래길 / X=집 안 모래(버그) / D=문 / ~=물 / .=잔디 */
function renderWorldAscii(
  map: GameMap,
  _plan: VillageBboxPlan,
  houseWings: readonly BBox[],
  step: number,
): string {
  const sand = new Set<number>(Object.values(SAND_TILE));
  const lines = [`# H=house R=road X=road-in-house D=door ~=water .=grass step=${step}`];
  for (let y = 0; y < map.height; y += step) {
    let row = `${String(y).padStart(3, "0")} `;
    for (let x = 0; x < map.width; x += step) {
      const i = y * map.width + x;
      const L = map.lowerTiles[i] ?? -1;
      const inWing = isInsideAnyWing(houseWings, x, y);
      if (isMapWaterTile(L)) row += "~";
      else if (sand.has(L)) row += inWing ? "X" : "R";
      else if (L === 116 || L === 146) row += "D";
      else if (inWing) row += "H";
      else if (L !== 270 && L !== 240 && L !== -1) row += "#";
      else row += ".";
    }
    lines.push(row);
  }
  return lines.join("\n");
}

function stampCounter(map: GameMap, x: number, y: number): void {
  setUpper(map, x, y, TABLE_L);
  setUpper(map, x + 1, y, TABLE_M);
  setUpper(map, x + 2, y, TABLE_M);
  setUpper(map, x + 3, y, TABLE_R);
}

function setUpper(map: GameMap, x: number, y: number, tile: number): void {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
  map.upperTiles[y * map.width + x] = tile;
}

function counterShopEvent(
  id: string,
  x: number,
  y: number,
  speaker: string,
  itemIds: readonly string[],
  greeting: string,
): GameEvent {
  return {
    id,
    x,
    y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: `${id}_page`,
        name: `${speaker} 카운터`,
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: FIXED,
        commands: [
          { kind: "text", speaker, body: greeting },
          {
            kind: "shop",
            itemIds: [...itemIds],
            allowSell: true,
            quantityMode: "select",
            shopType: "normal",
            messageType: "welcome",
            branchOnTransaction: false,
            transactionBranch: [],
          } satisfies Command,
        ],
      } satisfies EventPage,
    ],
  };
}

function merchantChatEvent(
  id: string,
  x: number,
  y: number,
  speaker: string,
  spriteId: string,
  characterIndex: number,
  line: string,
): GameEvent {
  return {
    id,
    x,
    y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: `${id}_page`,
        name: speaker,
        conditions: [],
        graphic: charsetGraphic(spriteId, characterIndex),
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: FIXED,
        commands: [{ kind: "text", speaker, body: line }],
      },
    ],
  };
}

function charsetGraphic(spriteId: string, characterIndex: number): EventPageGraphic {
  return {
    sprite: { type: "bundled", id: spriteId },
    direction: "down",
    pattern: charsetFrameIndex({ characterIndex, direction: "down", pattern: 1 }),
  };
}

function mulberry(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function shuffle<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = t;
  }
}

function applyDefaultTitleScreen(project: Project, title: string): void {
  const base = defaultTitleScreenSettings();
  project.system = {
    ...project.system,
    titleResourceId: "rpg-zzu-title-field",
    titleScreen: {
      ...base,
      title,
      backgroundResourceId: "rpg-zzu-title-field",
      layout: { ...base.layout },
      menuLabels: { ...base.menuLabels },
    },
  };
}
