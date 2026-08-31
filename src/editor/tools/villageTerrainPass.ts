// 방안 E 하이브리드: Blueprint/requirements → 제약 마스크 → 지형 패스(시공 솔버).
// 지금 솔버 = fill_region(오토타일) + place_props. 이후 WFC로 water/forest 마스크만 교체 가능.

import type { GameMap, Project } from "@/project/types";
import {
  broadleafCountFor,
  coniferCountFor,
  DEFAULT_WORLD_GEN_RULES,
  forestBandDepth,
  lakeDiameter,
  resolveWorldGenRules,
  riverBandDepth,
  waterShapeFor,
  type ResolvedWorldGenRules,
} from "@/project/worldGenRules";
import { forestCompositionApplies, plantForestComposition } from "./forestComposition";
import {
  forestDensityFromText,
  forestPackingFor,
  forestPlacementPlan,
  treeFootprintCells,
  type ForestDensity,
} from "./forestDensity";
import type { ToolDefinition } from "./types";
import type { VillageRequirements } from "./villageRequirements";
import { CONSTRUCTION_TOOLS_V3 } from "./v3";

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** 셀 역할 — WFC/시공기가 읽을 제약 마스크 */
export type TerrainCellRole = "water" | "forest" | "buildable" | "blocked";

export interface TerrainConstraintMasks {
  readonly width: number;
  readonly height: number;
  /** row-major: water | forest | buildable | blocked */
  readonly roles: TerrainCellRole[];
  readonly waterRects: readonly Rect[];
  readonly forestRects: readonly Rect[];
  readonly buildableRect: Rect;
  readonly notes: readonly string[];
}

/**
 * requirements(및 향후 Blueprint regions) → 제약 마스크.
 * LLM/Blueprint는 이 마스크만 바꾸면 되고, 채우기는 applyTerrainPass가 담당.
 */
export function buildTerrainConstraintMasks(
  map: Pick<GameMap, "width" | "height">,
  requirements: VillageRequirements,
  area: Rect = { x: 0, y: 0, w: map.width, h: map.height },
  rules: ResolvedWorldGenRules = DEFAULT_WORLD_GEN_RULES,
): TerrainConstraintMasks {
  const { width, height } = map;
  const roles: TerrainCellRole[] = new Array(width * height).fill("buildable");
  const notes: string[] = [];
  const waterRects: Rect[] = [];
  const forestRects: Rect[] = [];

  const shortSide = Math.min(area.w, area.h);
  const strip = riverBandDepth(shortSide, rules.water);
  const forestDepth = forestBandDepth(shortSide, rules.forest);

  let buildable: Rect = area;

  if (requirements.landmarks.includes("river") || requirements.landmarks.includes("harbor")) {
    const side = requirements.riverSide;
    const water = offsetRect(sideRect(area.w, area.h, side, strip), area);
    waterRects.push(water);
    paintRole(roles, width, water, "water");
    buildable = offsetRect(shrinkBuildableAwayFrom(area.w, area.h, side, strip), area);
    notes.push(`mask water@${side} ${water.w}×${water.h}`);
  }

  if (requirements.landmarks.includes("lake")) {
    const size = lakeDiameter(shortSide, rules.water, requirements.landmarks.includes("river"));
    const lake = offsetRect(lakeRect(area.w, area.h, requirements.riverSide, size, requirements.landmarks.includes("river")), area);
    waterRects.push(lake);
    paintRole(roles, width, lake, "water");
    notes.push(`mask lake ${lake.w}×${lake.h}`);
    // 호수만 있을 때 주거를 남동으로
    if (!requirements.landmarks.includes("river") && !requirements.landmarks.includes("harbor")) {
      buildable = {
        x: Math.max(0, lake.x + lake.w - 2),
        y: Math.max(0, lake.y + lake.h - 2),
        w: area.x + area.w - Math.max(0, lake.x + lake.w - 2),
        h: area.y + area.h - Math.max(0, lake.y + lake.h - 2),
      };
    }
  }

  if (requirements.landmarks.includes("forest")) {
    const side = requirements.forestSide;
    const forest = offsetRect(sideRect(area.w, area.h, side, forestDepth), area);
    // 물 마스크와 겹치면 물은 유지, 숲은 물 칸 제외하고 칠함
    forestRects.push(forest);
    paintRole(roles, width, forest, "forest", /* skipWater */ true);
    notes.push(`mask forest@${side} ${forest.w}×${forest.h}`);
  }

  // buildable 밖은 blocked (주거 시공 금지 힌트)
  for (let y = area.y; y < area.y + area.h; y += 1) {
    for (let x = area.x; x < area.x + area.w; x += 1) {
      const i = y * width + x;
      if (roles[i] === "water") continue;
      if (!inRect(x, y, buildable) && roles[i] !== "forest") {
        roles[i] = "blocked";
      }
    }
  }

  return {
    width,
    height,
    roles,
    waterRects,
    forestRects,
    buildableRect: buildable,
    notes,
  };
}

/** 마스크 → 지형 시공. 솔버 교체 포인트: 이 함수 본문만 WFC로 바꿀 수 있다. */
export function applyTerrainPassFromMasks(
  draft: Project,
  map: GameMap,
  masks: TerrainConstraintMasks,
  warnings: string[],
  rules: ResolvedWorldGenRules = resolveWorldGenRules(draft.system.worldGen),
  forestDensity?: ForestDensity,
): { readonly waterOps: number; readonly forestOps: number; readonly notes: string[] } {
  const fill = requireTool("fill_region");
  const props = requireTool("place_props");
  let waterOps = 0;
  let forestOps = 0;
  const notes = [...masks.notes];
  const forest = rules.forest;

  for (const rect of masks.waterRects) {
    // 강: 긴 축이면 ellipse, 호수에 가까운 정사각이면 circle — 저자가 모양을 고정하면 그 값.
    const shape = waterShapeFor(rect.w, rect.h, rules.water);
    const painted = runFill(fill, draft, map.id, rect, shape, warnings);
    waterOps += painted;
    // 실패(0칸)를 시공 완료로 기록하지 않는다 — 게이트·로그가 이 노트를 근거로 삼는다.
    notes.push(painted > 0
      ? `terrainPass water ${shape} ${rect.w}×${rect.h} (${painted}칸)`
      : `terrainPass water FAILED ${shape} ${rect.w}×${rect.h}`);
  }

  for (const rect of masks.forestRects) {
    // 왜 요청 밀도와 저작 규칙을 함께 받는가: 요청문은 이번 숲의 개수·패킹을 정하지만,
    // 생성 규칙은 밴드 깊이와 수종별 간격·자연도의 정본이다. 요청이 없으면 저작 개수도 그대로 쓴다.
    if (forestDensity && forestCompositionApplies(forestDensity)) {
      const composed = plantForestComposition(draft, {
        mapId: map.id,
        area: rect,
        density: forestDensity,
        seed: 7700 + rect.x * 13 + rect.y * 7,
      });
      warnings.push(...composed.warnings);
      forestOps += composed.placed;
      notes.push(
        `terrainPass forest 합성 ${composed.materials.join("·") || "none"} ~${composed.placed}`
        + ` + 하층식생 ${composed.undergrowthCells}칸 density=${forestDensity}`,
      );
      continue;
    }

    const areaTiles = rect.w * rect.h;
    const densityForPlan = forestDensity ?? "dense";
    // 큰 2×2 원자를 먼저 보호한다. 침엽수를 먼저 패킹하면 활엽수 군락이 들어갈 문이 닫힌다.
    const broadleafPlan = forestPlacementPlan({
      area: rect,
      footprintCells: treeFootprintCells("활엽수"),
      density: densityForPlan,
      share: 0.05,
    });
    const broadleafCount = forestDensity
      ? Math.max(3, broadleafPlan.count)
      : broadleafCountFor(areaTiles, forest);
    try {
      const big = props.run(draft, {
        mapId: map.id,
        area: rect,
        material: "활엽수",
        count: broadleafCount,
        minGap: forest.broadleafGap,
        naturalness: forest.broadleafNaturalness,
        packing: forestDensity ? forestPackingFor(forestDensity) : "natural",
        seed: 8800 + rect.x * 17 + rect.y * 11,
      });
      if (big.warnings) warnings.push(...big.warnings);
      const placedBig = typeof (big.data as { placed?: number } | undefined)?.placed === "number"
        ? (big.data as { placed: number }).placed
        : broadleafCount;
      forestOps += placedBig;
      notes.push(`terrainPass forest broadleaf-2x2 ~${placedBig}`);
    } catch (err) {
      warnings.push(err instanceof Error ? err.message : String(err));
    }

    const coniferPlan = forestPlacementPlan({
      area: rect,
      footprintCells: treeFootprintCells("침엽수"),
      density: densityForPlan,
    });
    const coniferCount = forestDensity ? coniferPlan.count : coniferCountFor(areaTiles, forest);
    try {
      const result = props.run(draft, {
        mapId: map.id,
        area: rect,
        material: "침엽수",
        count: coniferCount,
        minGap: forest.coniferGap,
        naturalness: forest.coniferNaturalness,
        packing: forestDensity ? forestPackingFor(forestDensity) : "natural",
        seed: 7700 + rect.x * 13 + rect.y * 7,
      });
      if (result.warnings) warnings.push(...result.warnings);
      const placed = typeof (result.data as { placed?: number } | undefined)?.placed === "number"
        ? (result.data as { placed: number }).placed
        : coniferCount;
      forestOps += placed;
      notes.push(`terrainPass forest conifer ~${placed}${forestDensity ? ` density=${forestDensity}` : " authored"}`);
    } catch (err) {
      warnings.push(err instanceof Error ? err.message : String(err));
    }
  }

  return { waterOps, forestOps, notes };
}

/** requirements 한 번에: 마스크 생성 + 지형 패스 (기존 placeRequiredLandmarks 대체 API). */
export function runTerrainConstraintPass(
  draft: Project,
  map: GameMap,
  requirements: VillageRequirements,
  warnings: string[],
  area?: Rect,
  rules: ResolvedWorldGenRules = resolveWorldGenRules(draft.system.worldGen),
): {
  readonly masks: TerrainConstraintMasks;
  readonly waterOps: number;
  readonly forestOps: number;
  readonly notes: string[];
} {
  const masks = buildTerrainConstraintMasks(map, requirements, area, rules);
  const density = forestDensityFromText(requirements.query);
  const applied = applyTerrainPassFromMasks(draft, map, masks, warnings, rules, density);
  return {
    masks,
    waterOps: applied.waterOps,
    forestOps: applied.forestOps,
    notes: applied.notes,
  };
}

export function villageBuildAreaFromMasks(
  map: Pick<GameMap, "width" | "height">,
  requirements: VillageRequirements | undefined,
  rules: ResolvedWorldGenRules = DEFAULT_WORLD_GEN_RULES,
): Rect {
  if (!requirements || requirements.landmarks.length === 0) {
    return { x: 0, y: 0, w: map.width, h: map.height };
  }
  return buildTerrainConstraintMasks(map, requirements, undefined, rules).buildableRect;
}

function sideRect(
  width: number,
  height: number,
  side: "west" | "east" | "north" | "south",
  depth: number,
): Rect {
  if (side === "west") return { x: 0, y: 1, w: depth, h: height - 2 };
  if (side === "east") return { x: width - depth, y: 1, w: depth, h: height - 2 };
  if (side === "north") return { x: 1, y: 0, w: width - 2, h: depth };
  return { x: 1, y: height - depth, w: width - 2, h: depth };
}

function offsetRect(rect: Rect, area: Rect): Rect {
  return { ...rect, x: rect.x + area.x, y: rect.y + area.y };
}

function lakeRect(
  width: number,
  height: number,
  riverSide: "west" | "east" | "north" | "south",
  size: number,
  nearRiver: boolean,
): Rect {
  if (!nearRiver) return { x: 1, y: 1, w: size, h: size };
  if (riverSide === "west") return { x: 1, y: 1, w: size, h: size };
  if (riverSide === "east") return { x: width - size - 1, y: 1, w: size, h: size };
  if (riverSide === "north") return { x: 1, y: 1, w: size, h: size };
  return { x: 1, y: height - size - 1, w: size, h: size };
}

function shrinkBuildableAwayFrom(
  width: number,
  height: number,
  side: "west" | "east" | "north" | "south",
  strip: number,
): Rect {
  if (side === "west") return { x: strip, y: 0, w: width - strip, h: height };
  if (side === "east") return { x: 0, y: 0, w: width - strip, h: height };
  if (side === "north") return { x: 0, y: strip, w: width, h: height - strip };
  return { x: 0, y: 0, w: width, h: height - strip };
}

function paintRole(
  roles: TerrainCellRole[],
  width: number,
  rect: Rect,
  role: TerrainCellRole,
  skipWater = false,
): void {
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      if (x < 0 || y < 0) continue;
      const i = y * width + x;
      if (i < 0 || i >= roles.length) continue;
      if (skipWater && roles[i] === "water") continue;
      roles[i] = role;
    }
  }
}

function inRect(x: number, y: number, r: Rect): boolean {
  return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
}

function runFill(
  fill: ToolDefinition,
  draft: Project,
  mapId: string,
  rect: Rect,
  shape: "rect" | "ellipse" | "circle",
  warnings: string[],
): number {
  try {
    const result = fill.run(draft, {
      mapId,
      rect,
      material: "물",
      layer: "lower",
      shape,
    });
    if (result.warnings) warnings.push(...result.warnings);
    // fill_region은 실제 채운 칸 수를 반환한다 — 추정치(w*h*0.7)는 실측이 없을 때만.
    const filled = (result.data as { filled?: number } | undefined)?.filled;
    if (typeof filled === "number") return filled;
    return Math.max(1, Math.floor(rect.w * rect.h * (shape === "rect" ? 1 : 0.7)));
  } catch (err) {
    warnings.push(err instanceof Error ? err.message : String(err));
    return 0;
  }
}

function requireTool(name: string): ToolDefinition {
  const tool = CONSTRUCTION_TOOLS_V3.find((entry) => entry.name === name);
  if (!tool) throw new Error(`필수 툴 없음: ${name}`);
  return tool;
}
