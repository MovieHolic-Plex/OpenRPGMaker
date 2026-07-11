// 방안 E 하이브리드: Blueprint/requirements → 제약 마스크 → 지형 패스(시공 솔버).
// 지금 솔버 = fill_region(오토타일) + place_props. 이후 WFC로 water/forest 마스크만 교체 가능.

import type { GameMap, Project } from "@/project/types";
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
): TerrainConstraintMasks {
  const { width, height } = map;
  const roles: TerrainCellRole[] = new Array(width * height).fill("buildable");
  const notes: string[] = [];
  const waterRects: Rect[] = [];
  const forestRects: Rect[] = [];

  const strip = Math.min(6, Math.max(4, Math.floor(Math.min(width, height) * 0.12)));
  const forestDepth = Math.max(4, Math.floor(Math.min(width, height) * 0.14));

  let buildable: Rect = { x: 0, y: 0, w: width, h: height };

  if (requirements.landmarks.includes("river") || requirements.landmarks.includes("harbor")) {
    const side = requirements.riverSide;
    const water = sideRect(width, height, side, strip);
    waterRects.push(water);
    paintRole(roles, width, water, "water");
    buildable = shrinkBuildableAwayFrom(width, height, side, strip);
    notes.push(`mask water@${side} ${water.w}×${water.h}`);
  }

  if (requirements.landmarks.includes("lake")) {
    const size = Math.max(8, Math.floor(Math.min(width, height) * (requirements.landmarks.includes("river") ? 0.14 : 0.28)));
    const lake = lakeRect(width, height, requirements.riverSide, size, requirements.landmarks.includes("river"));
    waterRects.push(lake);
    paintRole(roles, width, lake, "water");
    notes.push(`mask lake ${lake.w}×${lake.h}`);
    // 호수만 있을 때 주거를 남동으로
    if (!requirements.landmarks.includes("river") && !requirements.landmarks.includes("harbor")) {
      buildable = {
        x: Math.max(0, lake.x + lake.w - 2),
        y: Math.max(0, lake.y + lake.h - 2),
        w: width - Math.max(0, lake.x + lake.w - 2),
        h: height - Math.max(0, lake.y + lake.h - 2),
      };
    }
  }

  if (requirements.landmarks.includes("forest")) {
    const side = requirements.forestSide;
    const forest = sideRect(width, height, side, forestDepth);
    // 물 마스크와 겹치면 물은 유지, 숲은 물 칸 제외하고 칠함
    forestRects.push(forest);
    paintRole(roles, width, forest, "forest", /* skipWater */ true);
    notes.push(`mask forest@${side} ${forest.w}×${forest.h}`);
  }

  // buildable 밖은 blocked (주거 시공 금지 힌트)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
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
): { readonly waterOps: number; readonly forestOps: number; readonly notes: string[] } {
  const fill = requireTool("fill_region");
  const props = requireTool("place_props");
  let waterOps = 0;
  let forestOps = 0;
  const notes = [...masks.notes];

  for (const rect of masks.waterRects) {
    // 강: 긴 축이면 ellipse, 호수에 가까운 정사각이면 circle
    const shape = Math.abs(rect.w - rect.h) <= 2 ? "circle" : "ellipse";
    waterOps += runFill(fill, draft, map.id, rect, shape, warnings);
    notes.push(`terrainPass water ${shape} ${rect.w}×${rect.h}`);
  }

  for (const rect of masks.forestRects) {
    const count = Math.max(8, Math.floor((rect.w * rect.h) / 10));
    const bigCount = Math.max(4, Math.min(10, Math.floor((rect.w * rect.h) / 28)));
    try {
      const result = props.run(draft, {
        mapId: map.id,
        area: rect,
        material: "침엽수",
        count,
        minGap: 2,
        naturalness: 0.6,
        seed: 7700 + rect.x * 13 + rect.y * 7,
      });
      if (result.warnings) warnings.push(...result.warnings);
      const placed = typeof (result.data as { placed?: number } | undefined)?.placed === "number"
        ? (result.data as { placed: number }).placed
        : count;
      forestOps += placed;
      notes.push(`terrainPass forest conifer ~${placed}`);
    } catch (err) {
      warnings.push(err instanceof Error ? err.message : String(err));
    }
    // 2×2 활엽수 대목 — multi-turn forest_big 레이어와 동일 품질 목표
    try {
      const big = props.run(draft, {
        mapId: map.id,
        area: rect,
        material: "활엽수",
        count: bigCount,
        minGap: 3,
        naturalness: 0.55,
        seed: 8800 + rect.x * 17 + rect.y * 11,
      });
      if (big.warnings) warnings.push(...big.warnings);
      const placedBig = typeof (big.data as { placed?: number } | undefined)?.placed === "number"
        ? (big.data as { placed: number }).placed
        : bigCount;
      forestOps += placedBig;
      notes.push(`terrainPass forest broadleaf-2x2 ~${placedBig}`);
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
): {
  readonly masks: TerrainConstraintMasks;
  readonly waterOps: number;
  readonly forestOps: number;
  readonly notes: string[];
} {
  const masks = buildTerrainConstraintMasks(map, requirements);
  const applied = applyTerrainPassFromMasks(draft, map, masks, warnings);
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
): Rect {
  if (!requirements || requirements.landmarks.length === 0) {
    return { x: 0, y: 0, w: map.width, h: map.height };
  }
  return buildTerrainConstraintMasks(map, requirements).buildableRect;
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
