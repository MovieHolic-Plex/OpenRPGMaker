import { paintForestGroves } from "./forestGroves";
import { forestSetbackJitter } from "./forestContour";
// editor/tools/village/morphologyBuild.ts
// 형태 유형 계획(morphologyPlan)을 맵에 시공한다 — 기존 스탬퍼(킷 집·레시피 집·길 오토타일·울타리 타일·
// 경작지 오토타일)를 그대로 쓴다. 나무만 타일셋에 따라 킷(treeKit.ts)을 고른다 — 합본 마을 원자 또는
// 혼합 칩셋의 숲 나무 확장 띠(큰 참나무 4×5·활엽수 3×4·짙은 나무·덤불·숲 벽).
//
// 두 단계로 나뉜다. ① 봉인 전: 연못 → 뼈대 길 → 필지 위 집 → 문 앞 옆길. ② 봉인 후(layoutPlan 등록 뒤):
// 필지 둘레 울타리 → 밭·과수원·풀밭·산울타리 → 거리 기울기 나무 → 녹지 큰나무. 집을 봉인한 뒤에
// 환경 쓰기가 오는 순서는 기존 시공기와 같다.

import { paintOrganicVillageLake } from "./organicLake";
import { BRIDGE_PLANK_TILE } from "./landscape";
import { stampAuthoredHouseForm } from "@/editor/authoredHouseFormStamp";
import { gableAccentSeed } from "@/editor/gableHouseCompose";
import { tilesetHasHouseParts } from "@/project/defaults/forestHarmonyHouseParts";
import { stampFootprintHouseKit, type HouseKitId, type HouseKitWindowsOption } from "@/editor/houseKit";
import { stampHouseDoorBackground } from "@/editor/houseInteriors";
import { shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import { DEFAULT_FARMLAND_AUTOTILE_GROUP, DEFAULT_TALL_GRASS_AUTOTILE_GROUP } from "@/project/defaults/autotileGroups";
import type { AutotileGroup } from "@/project/types";
import { isWaterChipsetTile } from "@/project/defaults/chipsetMapping";
import { forestCoverageTarget } from "../forestDensity";
import { TILE } from "@/project/defaults/constants";
import type { GameMap, Project } from "@/project/types";
import { mulberry32, type Rng } from "@/util/rng";
import { protectedHouseCells } from "../houseProtection";
import { CONSTRUCTION_TOOLS_V3 } from "../v3";
import {
  coordKey,
  DOOR_BOTTOM_TILE,
  DOOR_TOP_TILE,
  FENCE_BACK_ROWS,
  FENCE_BOTTOM_LEFT,
  FENCE_BOTTOM_RIGHT,
  FENCE_END_LEFT,
  FENCE_END_RIGHT,
  FENCE_GATE_HALF_WIDTH,
  FENCE_SIDE_RAIL,
  FENCE_TOP_LEFT,
  FENCE_TOP_RAIL,
  FENCE_TOP_RIGHT,
  HOUSE_KITS,
  pointInRect,
  requireTool,
  ROAD_TILES,
  type BuiltHouse,
  type Plaza,
  type Point,
  type Rect,
  type VillageIntent,
  templateFormFor,
  templateHasFixedKit,
} from "./constants";
import { applyRoofDeck, houseBlockedCells } from "./houses";
import {
  OCC,
  planVillageMorphology,
  type HouseSlot,
  type MorphologyExit,
  type MorphologyPlan,
  type VillageMorphology,
} from "./morphologyPlan";
import { paintFlowerField, paintMarketDeck, placeMarketDeckProps } from "./plaza";
import { paintRoadStrip } from "./roads";
import {
  canStampTree,
  COMBINED_TOWN_TREE_KIT,
  markTreeStamp,
  stampTree,
  treeStampCells,
  type TreeKit,
  type TreeStamp,
} from "./treeKit";

/**
 * 마을 바깥 나무 경사. 예전 값(문턱 3 · 0 + d×0.07 · 상한 0.5)은 44×26 에서 후보를 184칸으로
 * 좁히고 그중 28칸만 심어, 자유 칸 519칸(맵의 45%)을 맨 잔디로 남겼다(2026-09-18 실측).
 * 문턱 3 은 그대로 둔다 — 2 로 내리면 길 옆 한 칸짜리 틈을 나무 두 그루가 막아 문 도달성 QA 가
 * 깨진다(64×56 green 8채에서 reachable false 재현). 대신 기저 확률을 올려 후보를 촘촘히 심는다.
 */
const TREE_MIN_DISTANCE = 3;
const TREE_BASE_CHANCE = 0.18;
const TREE_STEP = 0.12;

/** 프로브·테스트용 — 마지막 시공의 계획(맵과 대조해 어느 단계가 길을 지웠는지 찾는다). */
export const morphologyDebugSink: { lastPlan?: MorphologyPlan } = {};

export interface MorphologyBuildArgs {
  readonly draft: Project;
  readonly map: GameMap;
  readonly area: Rect;
  readonly seed: number;
  readonly intent: VillageIntent;
  readonly morphology: VillageMorphology;
  readonly maxHouses: number;
  readonly riverWidth?: number;
  /** 물·기존 집·숲 밴드·시작 좌표 등 절대 못 쓰는 칸(index). */
  readonly blocked: ReadonlySet<number>;
  /** 숲 밴드 — 집은 피하고 길은 지난다. */
  readonly softBlocked?: ReadonlySet<number>;
  /** 절벽 띠(고저차) — 집·옆길은 피하고 큰길만 지난다. */
  readonly cliffBlocked?: ReadonlySet<number>;
  /** 나무 어휘. 생략하면 합본 마을 원자(침엽수 1×2·활엽수 2×2). */
  readonly treeKit?: TreeKit;
  readonly windows: HouseKitWindowsOption | undefined;
  readonly paintDoorTiles: boolean;
  readonly warnings: string[];
}

export interface MorphologyFinishReport {
  readonly fenceTiles: number;
  readonly fieldCells: number;
  readonly trees: number;
}

export interface MorphologyBuild {
  readonly plan: MorphologyPlan;
  readonly houses: BuiltHouse[];
  readonly slots: HouseSlot[];
  readonly plaza: Plaza;
  readonly exits: readonly MorphologyExit[];
  /** 집 봉인(layoutPlan 등록) 뒤에 부른다 — 울타리·밭·나무. */
  finish(): MorphologyFinishReport;
  finishWater(): void;
}

export function buildMorphologyVillage(args: MorphologyBuildArgs): MorphologyBuild {
  const { draft, map, area, seed, intent, warnings } = args;
  const rng = mulberry32((seed ^ 0x3c6ef35f) >>> 0);
  const templates = intent.templateCatalog.filter((template) =>
    !templateHasFixedKit(template) || intent.kitMix === "mixed" || template.form?.kitId === intent.kitMix);
  const plan = planVillageMorphology({
    morphology: args.morphology,
    area,
    mapWidth: map.width,
    mapHeight: map.height,
    seed,
    maxHouses: args.maxHouses,
    templates,
    blocked: args.blocked, ...(args.softBlocked ? { softBlocked: args.softBlocked } : {}), ...(args.cliffBlocked ? { cliffBlocked: args.cliffBlocked } : {}),
    roadWidth: intent.roadWidth,
    ...(args.riverWidth !== undefined ? { riverWidth: args.riverWidth } : {}),
  });
  morphologyDebugSink.lastPlan = plan;
  warnings.push(`형태 마을 계획: ${plan.notes.join(" / ")}`);
  const riverCells = new Set(plan.river?.cells.map(cell => cell.y * map.width + cell.x) ?? []);
  const occ = plan.occupancy;
  const W = map.width;
  const lowerAt = (x: number, y: number): number => map.lowerTiles[y * W + x] ?? TILE.EMPTY;
  const upperAt = (x: number, y: number): number => map.upperTiles[y * W + x] ?? TILE.EMPTY;
  const inMap = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < map.height;

  // ① 연못 — 물 fill(타원). 길·집보다 먼저.
  if (plan.pond) paintPond(draft, map, plan.pond, warnings);

  // ② 뼈대 길.
  const paintSkeleton = (): void => {
    for (const stroke of plan.roads) {
      const cells = stroke.cells.filter((cell) => inMap(cell.x, cell.y) && !riverCells.has(cell.y * W + cell.x) && !isWaterChipsetTile(lowerAt(cell.x, cell.y)));
      paintRoadStrip(map, intent.pathStyle, cells);
    }
  };
  if (!plan.river) paintSkeleton();

  // ③ 필지 위 집 — 문은 필지 앞면(남쪽) 행 바로 위.
  const houses: BuiltHouse[] = [];
  const slots: HouseSlot[] = [];
  const usedKits = new Set<HouseKitId>();
  const houseParts = tilesetHasHouseParts(draft.tilesets[map.tilesetId]);
  for (const slot of plan.houses) {
    const { template, bbox } = slot;
    const unused = HOUSE_KITS.filter((id) => !usedKits.has(id));
    const pool = usedKits.size < 3 && unused.length > 0 ? unused : HOUSE_KITS;
    const kitId: HouseKitId = template.kitId
      ?? (templateHasFixedKit(template) ? template.form?.kitId : undefined)
      ?? (intent.kitMix === "mixed" ? pool[Math.floor(rng() * pool.length)]! : intent.kitMix);
    // 박공 조합 형태는 고른 킷으로 합성(부품 칸이 있는 타일셋이면 굴뚝·지붕창 등 0~2개), 고정 레시피는 그대로.
    const form = templateFormFor(template, kitId, houseParts ? gableAccentSeed(template.id, bbox.x, bbox.y, seed) : undefined);
    const stories: 1 | 2 | 3 = template.stories === 3 ? 3 : template.stories === 2 ? 2 : 1;
    const result = form
      ? stampAuthoredHouseForm(map, form, { x: bbox.x, y: bbox.y })
      : stampFootprintHouseKit(map, {
        kitId,
        stories,
        ...(template.lowWall ? { lowWall: true } : {}),
        wings: template.wingsAt(bbox.x, bbox.y),
        windows: args.windows,
      });
    if (!result.ok || !result.doorAt) {
      warnings.push(`형태 마을 집 시공 실패(${template.name}): ${result.reason ?? "문 좌표 없음"}`);
      continue;
    }
    const doorAt = result.doorAt;
    const topIndex = (doorAt.y - 1) * W + doorAt.x;
    const bottomIndex = doorAt.y * W + doorAt.x;
    if (args.paintDoorTiles) {
      map.lowerTiles[topIndex] = DOOR_TOP_TILE;
      map.lowerTiles[bottomIndex] = DOOR_BOTTOM_TILE;
    } else {
      stampHouseDoorBackground(map, doorAt);
    }
    if (template.roofDeck) applyRoofDeck(map, bbox, doorAt);
    const houseIndex = houses.length;
    houses.push({
      bbox,
      doorAt,
      doorTiles: { top: map.lowerTiles[topIndex] ?? DOOR_TOP_TILE, bottom: map.lowerTiles[bottomIndex] ?? DOOR_BOTTOM_TILE },
      front: { x: doorAt.x, y: doorAt.y + 1 },
      kitId,
      stories,
      templateId: template.id,
      ...(form ? { formId: form.id } : {}),
      ...(intent.houseOwners[houseIndex] ? { ownerName: intent.houseOwners[houseIndex] } : {}),
      ...(intent.housePrograms[houseIndex] ? { program: intent.housePrograms[houseIndex] } : {}),
    });
    slots.push(slot);
    usedKits.add(kitId);
  }

  if (plan.river) paintSkeleton();

  // ④ 문 앞 옆길 — 문 앞 칸에서 앞면 방향으로 길까지(최대 6칸), 못 닿으면 4-이웃 BFS.
  const houseCells = houseBlockedCells(houses);
  // 옆길은 절벽 띠를 뚫지 않는다(큰길만 비탈이 된다).
  const spurBlocked = new Set<number>([...args.blocked, ...args.cliffBlocked ?? [], ...riverCells]);
  for (const [index, house] of houses.entries()) {
    const slot = slots[index]!;
    // 계획 옆길은 필지 가운데 열에서 출발했다 — 실제 문(형태마다 위치가 다르다)이 다른 열이면 문 앞에서 그 옆길까지 한 번 더 잇는다.
    const planned = slot.spur !== undefined && plannedSpurUsable(map, area, slot.spur, houseCells, spurBlocked) ? [...slot.spur] : undefined;
    if (planned) {
      paintRoadStrip(map, intent.pathStyle, planned);
      for (const cell of planned) occ[cell.y * W + cell.x] = OCC.spur;
    }
    const spur = spurToRoad(map, area, house.front, slot.frontDir, houseCells, spurBlocked);
    const frontIsRoad = ROAD_TILES.has(map.lowerTiles[house.front.y * W + house.front.x] ?? TILE.EMPTY);
    if (spur.length === 0 && !frontIsRoad) {
      warnings.push(`형태 마을: 집 ${index + 1} 문 앞에서 길을 못 찾았다(${house.front.x},${house.front.y})`);
      continue;
    }
    if (spur.length > 0) {
      paintRoadStrip(map, intent.pathStyle, spur);
      for (const cell of spur) occ[cell.y * W + cell.x] = OCC.spur;
    }
  }

  const finish = (): MorphologyFinishReport => {
    const kit = args.treeKit ?? COMBINED_TOWN_TREE_KIT;
    const sealed = new Set(protectedHouseCells(map).map(({ x, y }) => y * W + x));
    // 물 예정지(blocked)·절벽 띠는 지금 잔디여도 나무를 심지 않는다 — 나중에 물·절벽이 깔리면 수관만 떠 남는다.
    const free = (x: number, y: number): boolean =>
      inMap(x, y) && pointInRect({ x, y }, area) && !sealed.has(y * W + x)
      && !args.blocked.has(y * W + x) && !riverCells.has(y * W + x) && !(args.cliffBlocked?.has(y * W + x) ?? false)
      && lowerAt(x, y) === TILE.GRASS && upperAt(x, y) === TILE.EMPTY && !ROAD_TILES.has(lowerAt(x, y));
    // 마을 공터 — 계획은 자리만 예약하고(OCC.commons) 아무것도 칠하지 않아, 어떤 형태 유형이든
    // 마을 한가운데가 주변 잔디와 구별되지 않았다(2026-09-18 실측: 8×5 공터 40칸 중 채워진 칸 3).
    // layoutPlan 은 그 자리를 role:"plaza" 로 적고 있었으므로 계획과 그림이 어긋나 있었다.
    paintCommons(map, plan.commons, intent, mulberry32((seed ^ 0x6d2b79f5) >>> 0));
    let fenceTiles = 0;
    for (const [index, house] of houses.entries()) if (house.fence) fenceTiles += paintParcelFence(map, area, slots[index]!, house, sealed);
    // On the river default, reserve the natural outer silhouette before planting
    // fields. Otherwise rectangular fields consume the entire edge and dictate
    // the forest shape, regardless of the canopy contour's noise.
    let trees = 0;
    const riverGrove = plan.river && kit.grove && intent.edgeTrees !== "none";
    if (riverGrove && kit.grove) {
      const groveFree = (x: number, y: number): boolean => free(x, y) && !houses.some(({ bbox: b }) =>
        Math.hypot(Math.max(b.x - x, 0, x - (b.x + b.w - 1)) / 3,
          Math.max(b.y - y, 0, y - (b.y + b.h - 1)) / 4) <= 1);
      const grove = paintForestGroves(map, area, kit.grove, groveFree, seed ^ 0x51f15e3d,
        forestCoverageTarget(intent.forestDensity ?? "normal"), undefined, true);
      for (const index of grove.cells) occ[index] = OCC.reserved;
      trees += Math.ceil(grove.cells.size / 12);
    }
    let fieldCells = 0;
    const fieldRng = mulberry32((seed ^ 0x2f6b1a4d) >>> 0);
    for (const field of plan.fields) fieldCells += paintField(map, field.rect, field.kind, free, fieldRng, occ, kit);
    const plant = (stamp: TreeStamp, x: number, y: number): boolean => {
      if (!canStampTree(stamp, x, y, free, occ, W)) return false;
      stampTree(map, stamp, x, y);
      markTreeStamp(occ, W, stamp, x, y);
      trees += 1;
      return true;
    };
    // 녹지 앵커 — 계획은 2×2 자리를 봤으므로 중간 나무가 안 들어가면 작은 나무로.
    for (const anchor of plan.bigTrees) plant(kit.medium, anchor.x, anchor.y) || plant(kit.small, anchor.x, anchor.y);
    // 뒷마당 나무 — 세 필지 중 하나, 뒷마당이 2행 이상일 때.
    for (const [index, slot] of slots.entries()) {
      if (index % 3 !== 1) continue;
      const back = slot.bbox.y - 1 - slot.parcel.y;
      if (back < 3) continue;
      const x = slot.parcel.x + 1, y = slot.parcel.y + 1;
      plant(kit.medium, x, y) || plant(kit.small, x, y);
    }
    if (!riverGrove) trees += paintTreeGradient(map, area, occ, free, intent, mulberry32((seed ^ 0x51f15e3d) >>> 0), kit);
    return { fenceTiles, fieldCells, trees };
  };

  const finishWater = (): void => {
    if (!plan.river) return;
    paintOrganicVillageLake(draft, map, plan.river);
    for (const cell of plan.river.bridge) map.upperTiles[cell.y * W + cell.x] = BRIDGE_PLANK_TILE;
    map.layoutPlan?.regions.push({ id: "village_river", role: "river", label: "마을을 관통하는 강", ...plan.river.bounds,
      tags: ["morphology:river", "continuous-water", "painted-after-trees"] });
  };
  return { plan, houses, slots, plaza: plan.plaza, exits: plan.exits, finish, finishWater };
}

// ───────────────────────── 마을 공터 ─────────────────────────

/**
 * 공터를 주변 잔디와 구별되게 칠한다. 형태 유형은 계획 단계에서 자리만 잡아 두므로(OCC.commons)
 * 여기서 `plazaStyle` 대로 바닥을 깐다 — market 은 장터 데크와 가판, garden 은 꽃밭, empty 는
 * 손대지 않는다(풀 공터가 곧 의도다). 울타리·나무보다 먼저 불러야 나무가 데크 위에 서지 않는다.
 */
function paintCommons(map: GameMap, commons: Rect, intent: VillageIntent, rng: Rng): void {
  // 둘레 한 칸은 접근로로 비운다 — 공터 가장자리까지 깔면 공터에 면한 집의 문 앞 옆길이 사라진다.
  const inner: Rect = { x: commons.x + 1, y: commons.y + 1, w: commons.w - 2, h: commons.h - 2 };
  if (inner.w < 3 || inner.h < 3) return;
  if (intent.plazaStyle === "garden") { paintFlowerField(map, inner, rng); return; }
  if (intent.plazaStyle !== "market") return;
  // 장터 데크는 바닥을 통째로 갈아엎으므로 공터를 가로지르는 길을 먼저 떠 두었다가 되돌린다.
  // (2026-09-18 실측: green 8채가 doors 5/8 · reachable false 로 QA 를 못 넘었다.)
  const saved = new Map<number, number>();
  for (let y = inner.y; y < inner.y + inner.h; y += 1) {
    for (let x = inner.x; x < inner.x + inner.w; x += 1) {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      const index = y * map.width + x;
      const lower = map.lowerTiles[index] ?? TILE.EMPTY;
      if (ROAD_TILES.has(lower)) saved.set(index, lower);
    }
  }
  paintMarketDeck(map, inner);
  for (const [index, tile] of saved) {
    map.lowerTiles[index] = tile;
    map.upperTiles[index] = TILE.EMPTY;
  }
  placeMarketDeckProps(map, inner);
}

// ───────────────────────── 연못 ─────────────────────────

function paintPond(draft: Project, map: GameMap, rect: Rect, warnings: string[]): void {
  try {
    const fill = requireTool(CONSTRUCTION_TOOLS_V3, "fill_region");
    const result = fill.run(draft, { mapId: map.id, rect, material: "물", layer: "lower", shape: "ellipse" });
    if (result.warnings) warnings.push(...result.warnings);
  } catch (err) {
    warnings.push(`형태 마을 연못 실패: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ───────────────────────── 옆길 ─────────────────────────

/** 계획 단계 옆길이 맵에서도 통하는지 — 칸이 모두 영역 안·집 아닌·물 아닌 칸이고, 끝이 길에 붙어야 한다. */
function plannedSpurUsable(map: GameMap, area: Rect, spur: readonly Point[], houseCells: ReadonlySet<string>, blocked: ReadonlySet<number>): boolean {
  const W = map.width;
  const isRoad = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < map.height && ROAD_TILES.has(map.lowerTiles[y * W + x] ?? TILE.EMPTY);
  if (spur.length === 0) return false;
  for (const cell of spur) {
    if (!pointInRect(cell, area) || houseCells.has(coordKey(cell.x, cell.y)) || blocked.has(cell.y * W + cell.x)) return false;
    if (isWaterChipsetTile(map.lowerTiles[cell.y * W + cell.x] ?? TILE.EMPTY)) return false;
  }
  const last = spur[spur.length - 1]!;
  return [[0, 1], [1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => isRoad(last.x + dx!, last.y + dy!));
}

function spurToRoad(
  map: GameMap,
  area: Rect,
  front: Point,
  dir: "down" | "east" | "west",
  houseCells: ReadonlySet<string>,
  blocked: ReadonlySet<number>,
): Point[] {
  const W = map.width;
  const isRoad = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < map.height && ROAD_TILES.has(map.lowerTiles[y * W + x] ?? TILE.EMPTY);
  const passable = (x: number, y: number): boolean =>
    pointInRect({ x, y }, area) && !houseCells.has(coordKey(x, y)) && !blocked.has(y * W + x)
    && !isWaterChipsetTile(map.lowerTiles[y * W + x] ?? TILE.EMPTY);
  if (isRoad(front.x, front.y)) return [];
  const step = dir === "down" ? { dx: 0, dy: 1 } : dir === "east" ? { dx: 1, dy: 0 } : { dx: -1, dy: 0 };
  const straight: Point[] = [];
  let x = front.x, y = front.y;
  for (let i = 0; i < 6; i += 1) {
    if (!passable(x, y)) break;
    straight.push({ x, y });
    x += step.dx; y += step.dy;
    if (isRoad(x, y)) return straight;
  }
  // BFS 폴백 — 문 앞에서 가장 가까운 길 칸까지(최대 10칸).
  const start = coordKey(front.x, front.y);
  const prev = new Map<string, string | null>([[start, null]]);
  const queue: Point[] = [front];
  let head = 0;
  while (head < queue.length) {
    const cell = queue[head++]!;
    if (Math.abs(cell.x - front.x) + Math.abs(cell.y - front.y) > 10) continue;
    for (const next of [{ x: cell.x, y: cell.y + 1 }, { x: cell.x + 1, y: cell.y }, { x: cell.x - 1, y: cell.y }, { x: cell.x, y: cell.y - 1 }]) {
      const key = coordKey(next.x, next.y);
      if (prev.has(key)) continue;
      if (isRoad(next.x, next.y)) {
        const path: Point[] = [];
        let cursor: string | null = coordKey(cell.x, cell.y);
        while (cursor !== null) {
          const [px, py] = cursor.split(",").map(Number) as [number, number];
          path.push({ x: px, y: py });
          cursor = prev.get(cursor) ?? null;
        }
        return path.reverse();
      }
      if (!passable(next.x, next.y)) continue;
      prev.set(key, coordKey(cell.x, cell.y));
      queue.push(next);
    }
  }
  return [];
}

// ───────────────────────── 필지 울타리 ─────────────────────────

/**
 * 필지 울타리 뒷줄이 앉을 행. 필지는 길에 면하려고 집보다 훨씬 깊게 잡히는데(2026-09-18 실측:
 * 5줄짜리 집에 11줄 필지, 지붕 위 5줄) 그 깊이를 그대로 두르면 빈 뒷마당이 울타리에 갇혀
 * 「집보다 큰 울타리」로 읽힌다. 용마루 위 `FENCE_BACK_ROWS` 줄까지만 두른다.
 * 앞줄·좌우 변은 필지 폭을 그대로 쓴다 — 마당은 앞(남쪽)에 있기 때문이다.
 */
export function parcelFenceTop(parcelY: number, bboxY: number): number {
  return Math.max(parcelY, bboxY - FENCE_BACK_ROWS);
}

/**
 * 필지 둘레 울타리(정본 문법): 뒷줄 378/379/380, 세로 변 408, 앞줄 438/379/410 + 문 게이트(409/439 마감).
 * 뒷줄은 용마루 행(bbox.y-1) 위에 있을 때만 친다 — 지붕 위 울타리 금지. 길·소품·봉인 칸은 건너뛴다.
 */
function paintParcelFence(map: GameMap, area: Rect, slot: HouseSlot, house: BuiltHouse, sealed: ReadonlySet<number>): number {
  const W = map.width;
  const { parcel, bbox } = slot;
  const lastX = parcel.x + parcel.w - 1;
  const lastY = parcel.y + parcel.h - 1;
  let placed = 0;
  const setFence = (x: number, y: number, tile: number): void => {
    if (x < 0 || y < 0 || x >= W || y >= map.height || !pointInRect({ x, y }, area)) return;
    const index = y * W + x;
    if (sealed.has(index)) return;
    const lower = map.lowerTiles[index] ?? TILE.EMPTY;
    if (ROAD_TILES.has(lower) || isWaterChipsetTile(lower) || lower !== TILE.GRASS) return;
    if ((map.upperTiles[index] ?? TILE.EMPTY) !== TILE.EMPTY) return;
    map.upperTiles[index] = tile;
    placed += 1;
  };
  const fenceTop = parcelFenceTop(parcel.y, bbox.y);
  const gateL = house.doorAt.x - FENCE_GATE_HALF_WIDTH;
  const gateR = house.doorAt.x + FENCE_GATE_HALF_WIDTH;
  // 앞줄(문 앞 행) — 게이트 양옆 끝 조각, 바깥 끝 모서리.
  for (let x = parcel.x; x <= lastX; x += 1) {
    if (x >= gateL && x <= gateR) continue;
    const tile = x === parcel.x ? FENCE_BOTTOM_LEFT : x === lastX ? FENCE_BOTTOM_RIGHT : x === gateL - 1 ? FENCE_END_RIGHT : x === gateR + 1 ? FENCE_END_LEFT : FENCE_TOP_RAIL;
    setFence(x, lastY, tile);
  }
  // 뒷줄 — 용마루 행보다 위일 때만.
  if (fenceTop < bbox.y) {
    for (let x = parcel.x; x <= lastX; x += 1) {
      setFence(x, fenceTop, x === parcel.x ? FENCE_TOP_LEFT : x === lastX ? FENCE_TOP_RIGHT : FENCE_TOP_RAIL);
    }
  }
  // 세로 변.
  for (let y = fenceTop + 1; y < lastY; y += 1) {
    setFence(parcel.x, y, FENCE_SIDE_RAIL);
    setFence(lastX, y, FENCE_SIDE_RAIL);
  }
  return placed;
}

// ───────────────────────── 밭·과수원·풀밭 ─────────────────────────

function paintGroupCells(map: GameMap, group: AutotileGroup, cells: readonly Point[]): void {
  if (cells.length === 0) return;
  const body = group.memberTileIds[0]!;
  for (const cell of cells) map.lowerTiles[cell.y * map.width + cell.x] = body;
  shapeAutotileGroupAround(map, group, cells);
}

function paintField(
  map: GameMap,
  rect: Rect,
  kind: "farm" | "orchard" | "meadow",
  free: (x: number, y: number) => boolean,
  rng: Rng,
  occ: Uint8Array,
  kit: TreeKit,
): number {
  const W = map.width;
  const cells: Point[] = [];
  for (let y = rect.y; y < rect.y + rect.h; y += 1) for (let x = rect.x; x < rect.x + rect.w; x += 1) if (free(x, y)) cells.push({ x, y });
  if (cells.length < rect.w * rect.h * 0.7) return 0;
  let painted = 0;
  if (kind === "farm") {
    paintGroupCells(map, DEFAULT_FARMLAND_AUTOTILE_GROUP, cells);
    painted = cells.length;
  } else if (kind === "meadow") {
    paintGroupCells(map, DEFAULT_TALL_GRASS_AUTOTILE_GROUP, cells);
    painted = cells.length;
  } else {
    // 과수원 — 2×2 활엽수(합본 마을 원자, 혼합 칩셋에도 같은 번호)를 3칸 간격 격자로, 열마다 반 칸 엇갈림.
    const fruitTree = kit.id === "forest-harmony" ? kit.medium : COMBINED_TOWN_TREE_KIT.big;
    for (let y = rect.y; y + fruitTree.h <= rect.y + rect.h; y += fruitTree.h + 1) {
      const offset = ((y - rect.y) / (fruitTree.h + 1)) % 2 === 1 ? 1 : 0;
      for (let x = rect.x + offset; x + fruitTree.w <= rect.x + rect.w; x += fruitTree.w + 1) {
        if (!canStampTree(fruitTree, x, y, free, occ, W)) continue;
        painted += stampTree(map, fruitTree, x, y);
        markTreeStamp(occ, W, fruitTree, x, y);
      }
    }
  }
  // 산울타리 — 밭 위·아래 바깥 행에 덤불을 한 칸 건너 60%.
  if (kind !== "meadow") {
    for (const y of [rect.y - 1, rect.y + rect.h]) {
      for (let x = rect.x; x < rect.x + rect.w; x += 2) {
        if (rng() > 0.6 || !free(x, y)) continue;
        const shrub = kit.shrubs[0]!;
        if (!canStampTree(shrub, x, y, free, occ, W)) continue;
        painted += stampTree(map, shrub, x, y);
        markTreeStamp(occ, W, shrub, x, y, OCC.field);
      }
    }
  }
  return painted;
}

// ───────────────────────── 나무 ─────────────────────────

/**
 * 거리 기울기 나무 — 마을 세포(길·필지·밭·녹지·연못)에서 멀어질수록 짙어진다.
 * 3칸 안은 비우고, 멀어질수록 큰 나무·숲 덩이가 섞인다. edgeTrees=none 이면 0, dense 면 1.6배.
 * 절벽 띠는 거리 씨앗이 아니다 — 언덕 위·아래 잔디에도 나무가 붙어야 지형이 산다.
 */
function paintTreeGradient(
  map: GameMap,
  area: Rect,
  occ: Uint8Array,
  free: (x: number, y: number) => boolean,
  intent: VillageIntent,
  rng: Rng,
  kit: TreeKit,
): number {
  if (intent.edgeTrees === "none") return 0;
  // `author_village` 는 edgeTrees 를 인자로 받지 않는다 — 모델이 쥔 숲 손잡이는 forestDensity 뿐인데
  // 2026-09-18 까지 그 값이 여기 닿지 않아, 어떤 밀도를 넣어도 마을 바깥이 늘 같은 성긴 덤불밭이었다.
  // normal(0.4) 을 1.0 으로 두고 선언 커버리지 비로 그루 수와 확률을 함께 민다.
  const density = intent.forestDensity
    ? forestCoverageTarget(intent.forestDensity) / forestCoverageTarget("normal")
    : 1;
  const scale = (intent.edgeTrees === "dense" ? 1.6 : 1) * density;
  const W = map.width;
  const dist = new Uint16Array(W * map.height).fill(0xffff);
  const queue: number[] = [];
  for (let y = area.y; y < area.y + area.h; y += 1) {
    for (let x = area.x; x < area.x + area.w; x += 1) {
      const index = y * W + x;
      const value = occ[index] ?? OCC.free;
      if (value !== OCC.free && value !== OCC.cliff) { dist[index] = 0; queue.push(index); }
    }
  }
  let head = 0;
  while (head < queue.length) {
    const index = queue[head++]!;
    const x = index % W, y = Math.floor(index / W);
    const d = dist[index]! + 1;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      if (!pointInRect({ x: nx, y: ny }, area)) continue;
      const nIndex = ny * W + nx;
      if (dist[nIndex]! <= d) continue;
      dist[nIndex] = d;
      queue.push(nIndex);
    }
  }
  if (kit.grove) {
    const groveSeed = Math.floor(rng() * 0xffffffff);
    // The setback bends (never under TREE_MIN_DISTANCE): a constant one copied the fields' and yards'
    // straight edges into the canopy, which then read as a rectangular black void beside them
    // (2026-09-24 lighthouse village review).
    const grove = paintForestGroves(map, area, kit.grove,
      (x, y) => free(x, y) && (occ[y * W + x] === OCC.free || occ[y * W + x] === OCC.commons)
        && dist[y * W + x]! >= TREE_MIN_DISTANCE + Math.max(0, forestSetbackJitter(x, y, groveSeed)),
      groveSeed, forestCoverageTarget(intent.forestDensity ?? "normal"), undefined, true);
    for (const index of grove.cells) occ[index] = OCC.reserved;
    return Math.ceil(grove.cells.size / 12);
  }
  const candidates: number[] = [];
  for (let y = area.y; y < area.y + area.h - 1; y += 1) {
    for (let x = area.x; x < area.x + area.w; x += 1) {
      const index = y * W + x;
      if ((dist[index] ?? 0) >= TREE_MIN_DISTANCE) candidates.push(index);
    }
  }
  for (let i = candidates.length - 1; i > 0; i -= 1) { const j = Math.floor(rng() * (i + 1)); [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!]; }
  // 기준선 0.14/0.5 는 마을 바깥을 늘 「덤불 몇 그루 뿌린 잔디밭」으로 남겼다(2026-09-18 실측:
  // 44×26 가장자리 띠 채움 26%). 기준을 0.22/0.7 로 올리고 밀도 비가 그 위에 곱해진다.
  const cap = Math.floor(area.w * area.h * 0.22 * density);
  let placed = 0;
  const taken = new Set<number>();
  const open = (x: number, y: number): boolean => free(x, y) && !taken.has(y * W + x);
  const place = (stamp: TreeStamp, x: number, y: number): boolean => {
    if (!canStampTree(stamp, x, y, open, occ, W)) return false;
    stampTree(map, stamp, x, y);
    for (const k of treeStampCells(stamp, x, y, W)) { taken.add(k); occ[k] = OCC.reserved; }
    placed += 1;
    return true;
  };
  for (const index of candidates) {
    if (placed >= cap) break;
    const x = index % W, y = Math.floor(index / W);
    const d = dist[index]!;
    const p = Math.min(0.75 * density, (TREE_BASE_CHANCE + (d - TREE_MIN_DISTANCE) * TREE_STEP) * scale);
    if (rng() > p) continue;
    if (taken.has(index) || taken.has(index + W)) continue;
    if (!free(x, y) || !free(x, y + 1)) continue;
    if (kit.id === "combined-town") {
      // 예전 규칙 그대로 — 5칸 밖 30% 활엽수 2×2, 나머지 침엽수 1×2.
      if (d >= 5 && rng() < 0.3 && place(kit.big, x, y)) continue;
      place(kit.small, x, y);
      continue;
    }
    // 숲 나무 킷 — 멀수록 큰 물체. 안 들어가면 한 단계 작은 것으로.
    const roll = rng();
    if (d >= 9 && kit.forest.length > 0 && roll < 0.35) {
      const chunk = kit.forest[Math.floor(rng() * kit.forest.length)]!;
      if (place(chunk, x, y)) continue;
    }
    if (d >= 6 && roll < 0.55 && place(kit.big, x, y)) continue;
    if (d >= 4 && roll < 0.8 && place(kit.medium, x, y)) continue;
    if (roll < 0.9 && place(kit.small, x, y)) continue;
    const shrub = kit.shrubs[Math.floor(rng() * kit.shrubs.length)];
    if (shrub) place(shrub, x, y);
  }
  return placed;
}
