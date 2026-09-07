import { isPassable, tileAt, tilePassability } from "@/project/collision";
import { roleCapabilities } from "@/project/tileRoles";
import { TILE } from "@/project/defaults/constants";
import {
  resolveMaterialByLabel,
  suggestMaterialsByLabel,
  VOCAB_SOFT_CONFIRM_WARNING_PREFIX,
  type VocabLayerHome,
  type VocabSoftConfirm,
} from "@/project/tileVocabulary";
import type { GameMap, Project, TilesetDef } from "@/project/types";
import { isTreeTrunkTileId } from "@/project/tilesetHarness";
import { inMapBounds, passableCellCount, setLower, setUpper, type Point } from "./mapHelpers";
import { poissonScatter } from "./naturalScatter";
import { naturalnessArg, naturalnessLabel, rngForTool } from "./naturalToolArgs";
import { isPathSurfaceTile, measurePropRejections, PropPlacementError, propProtectionReasons, runScatterObject, type PropRejectionReason, type ScatterPacking } from "./placementTools";
import { ToolError, type ToolExecResult } from "./types";
import { layerForVocabTile, type Rect } from "./v3/rmTypeExpander";

const PROPS_EXAMPLE = { mapId: "map_1", area: { x: 2, y: 2, w: 18, h: 12 }, material: "침엽수", count: 8, naturalness: 0.6 };

export type PlacePropsInput = {
  readonly mapId: string;
  readonly area: Rect;
  readonly material: string;
  readonly count: number;
  readonly minGap?: number;
  readonly naturalness?: number;
  readonly seed?: number;
  /** "dense"는 빈틈 없이 채워 통행을 막는다. 기본 "natural". */
  readonly packing?: ScatterPacking;
  /** 숲 합성 전용 — 수관이 단의 밑동을 덮지 않게 한다(나무 한 그루가 눈에 보이도록).
   *  산포 경로가 planForestScatter 로 갈라지는 스위치다. */
  readonly trunkVisible?: boolean;
  /** 숲 합성 전용 — 2×2 활엽수를 대각 엇갈림 격자에 세우려고 원점을 직접 준다. */
  readonly origins?: readonly { readonly x: number; readonly y: number }[];
};

/** 산포 거절 문구용 역할 라벨(UI 표시용) — 판정은 roleCapabilities().scatterAsProp 이 한다. */
const NON_PROP_ROLE_LABELS: Readonly<Record<string, string>> = { wall: "벽", roof: "지붕", building: "건물·바닥", castle: "성채", water: "수역" };

export function placePropsOnDraft(draft: Project, input: PlacePropsInput): ToolExecResult {
  const map = draft.maps[input.mapId];
  if (!map) throw new ToolError(`맵을 찾을 수 없습니다: ${input.mapId}`, { code: "missing-map", mapId: input.mapId });
  const tileset = draft.tilesets[map.tilesetId];
  if (!tileset) throw new ToolError(`타일셋을 찾을 수 없습니다: ${map.tilesetId}`, { code: "tileset-not-found", mapId: map.id });
  if (!Number.isInteger(input.count) || input.count < 1) {
    throw new ToolError(`count는 1 이상이어야 합니다(받은 값: ${JSON.stringify(input.count)}).`, { code: "invalid-args", mapId: map.id });
  }
  if (!Number.isInteger(input.area.w) || !Number.isInteger(input.area.h) || input.area.w < 1 || input.area.h < 1) {
    throw new ToolError(`area.w/h는 1 이상이어야 합니다(받은 값: ${input.area.w}×${input.area.h}).`, { code: "invalid-args", mapId: map.id });
  }

  const args: Record<string, unknown> = {
    mapId: input.mapId,
    area: input.area,
    material: input.material,
    count: input.count,
    ...(input.minGap === undefined ? {} : { minGap: input.minGap }),
    ...(input.naturalness === undefined ? {} : { naturalness: input.naturalness }),
    ...(input.seed === undefined ? {} : { seed: input.seed }),
    ...(input.packing === undefined ? {} : { packing: input.packing }),
    ...(input.trunkVisible === undefined ? {} : { trunkVisible: input.trunkVisible }),
    ...(input.origins === undefined ? {} : { origins: input.origins }),
  };
  const access = resolveMaterialByLabel(tileset, input.material, {
    preferGroup: true,
    preferRoles: ["prop", "terrain"],
  });
  if (access.status === "missing") {
    const suggestions = access.suggestions.length > 0 ? access.suggestions : suggestMaterialsByLabel(tileset, input.material, 5);
    const hint = suggestions.length > 0
      ? ` 비슷한 라벨: ${suggestions.map((suggestion) => `"${suggestion.label}"`).join(", ")}`
      : ` tile_query ask:"labels" 로 조회`;
    throw new ToolError(`${access.message}${hint} — 다시 보낼 형식 예시: ${JSON.stringify(PROPS_EXAMPLE)}`, { code: "material-not-found", mapId: map.id });
  }

  // 소품 툴은 소품만 놓는다 — 바닥·벽·건물·수역 재료가 들어오면 면/벽 툴로 보낸다.
  // 2026-09-03 실측: fill_region 이 「돌바닥」을 거절한 뒤 모델이 place_props 로 우회해 통행 불가 바닥 타일을 산포했다.
  // 2026-09-04 적대적 리뷰: 위 검사는 kind=group 일 때만 걸렸다. 물·벽 재료가 단일 타일로 해석되면
  // (예: 「물」→tile 0, 「흰 집 벽」→tile 318) 검사를 통째로 비껴가 육지에 수역 타일을 박았다.
  // 타일 경로도 타일 메타 역할 + 소속 그룹 역할로 검사한다.
  const propRole = access.kind === "group"
    ? access.group.role
    : (tileset.tileMeta?.[access.tileId]?.role
      ?? tileset.tileGroups?.find((group) => group.tileIds.includes(access.tileId))?.role);
  if (propRole !== undefined && !roleCapabilities(tileset, propRole).scatterAsProp) {
    throw new ToolError(
      `「${input.material}」은(는) ${NON_PROP_ROLE_LABELS[propRole] ?? propRole} 재료라 소품으로 산포할 수 없습니다. `
        + "바닥·지형 면은 fill_region(오토타일 재료) 또는 paint_tiles, 벽은 build_wall 을 쓰세요.",
      { code: "material-not-prop", mapId: map.id },
    );
  }
  if (access.kind === "group" && access.group.patternGrammar) {
    const soft = access.status === "soft" ? access.softConfirm : undefined;
    const scattered = runScatterObject(draft, {
      ...args,
      groupId: access.group.id,
    });
    return withSoftConfirm(scattered, soft);
  }

  const tileId = access.tileId;
  const soft = access.status === "soft" ? access.softConfirm : undefined;
  const naturalness = naturalnessArg(args);
  const dense = input.packing === "dense";
  const minGap = dense
    ? 0
    : typeof input.minGap === "number" && Number.isInteger(input.minGap) ? Math.max(0, input.minGap) : 1;
  const signature = `place_props|${map.id}|${input.area.x},${input.area.y},${input.area.w},${input.area.h}|${tileId}|${input.count}|${naturalnessLabel(naturalness)}`;
  // 밀집은 산포가 아니다 — 영역을 행 우선으로 훑어 놓을 수 있는 칸마다 놓는다.
  const targets = dense
    ? denseCells(input.area)
    : poissonScatter(
      { x: input.area.x, y: input.area.y, width: input.area.w, height: input.area.h },
      input.count,
      minGap,
      rngForTool(args, signature),
    ).points;
  const declared = tileset.tileMeta?.[tileId]?.defaultLayer;
  const tileHome: VocabLayerHome = declared === "lower" || declared === "upper" ? declared : "perCell";
  const home = layerForVocabTile(tileset, tileHome, tileId);
  const passableBefore = passableCellCount(draft, map, input.area);
  // 시작칸·이벤트칸을 덮으면 무결성 게이트가 커밋 전체를 거부한다 — 그룹 경로는 이미 피하는데
  // 단일 타일 경로만 안 피했다(실측: dense 덤불이 시작칸을 막아 숲 시공이 통째로 반려됐다).
  const protectionReasons = propProtectionReasons(draft, map);
  const inBounds = targets.some((cell) => inMapBounds(map, cell.x, cell.y));
  if (!inBounds) {
    const diagnostics = measurePropRejections(denseCells(input.area), { w: 1, h: 1 }, (cell, reasons) => {
      singlePropFits(draft, map, tileset, cell, tileId, protectionReasons, reasons);
    });
    throw new PropPlacementError(
      `「${input.material}」를 ${input.count}개 요청했지만 영역 (${input.area.x},${input.area.y}) ${input.area.w}×${input.area.h} 이(가) 맵(${map.width}×${map.height}) 밖에 있습니다 — 맵 안의 영역을 쓰세요.`,
      map.id, diagnostics,
    );
  }
  let placed = 0;
  for (const cell of targets) {
    if (placed >= input.count) break;
    if (!singlePropFits(draft, map, tileset, cell, tileId, protectionReasons)) continue;
    if (home === "upper") setUpper(map, cell.x, cell.y, tileId);
    else setLower(map, cell.x, cell.y, tileId);
    placed += 1;
  }
  if (placed === 0) {
    const diagnostics = measurePropRejections(denseCells(input.area), { w: 1, h: 1 }, (cell, reasons) => {
      singlePropFits(draft, map, tileset, cell, tileId, protectionReasons, reasons);
    });
    throw new PropPlacementError(
      `${access.matchedLabel || `타일 ${tileId}`}를 ${input.count}개 요청했지만 영역 (${input.area.x},${input.area.y}) ${input.area.w}×${input.area.h} 에 한 개도 놓지 못했습니다`,
      map.id, diagnostics,
    );
  }
  const passableAfter = passableCellCount(draft, map, input.area);
  const dressing = dense
    ? `빈틈 없이 배치 — 통행 가능 칸 ${passableBefore}→${passableAfter}${passableAfter === 0 ? " (완전 차단)" : ""}`
    : `자연도 ${naturalnessLabel(naturalness)}`;
  return withSoftConfirm({
    summary: `${map.name} (${input.area.x},${input.area.y}) ${input.area.w}×${input.area.h}에 소품(${access.matchedLabel || tileId}) ${placed}/${input.count}개 산포 — ${dressing}.`,
    data: {
      placed,
      requested: input.count,
      tileId,
      material: access.matchedLabel,
      packing: dense ? "dense" : "natural",
      passableBefore,
      passableAfter,
    },
  }, soft);
}

/** Admission stays identical; only the failure census collects overlapping
 * causes instead of stopping at the first veto. Collision uses authored rules. */
function singlePropFits(
  project: Project, map: GameMap, tileset: TilesetDef, cell: Point, tileId: number,
  protectionReasons: ReadonlyMap<string, readonly PropRejectionReason[]>, reasons?: Set<PropRejectionReason>,
): boolean {
  if (!inMapBounds(map, cell.x, cell.y)) {
    reasons?.add("outOfBounds");
    return false;
  }
  const index = cell.y * map.width + cell.x;
  const upperOccupied = map.upperTiles[index] !== TILE.EMPTY;
  if (upperOccupied) {
    if (!reasons) return false;
    reasons.add("upperOccupied");
  }
  const passable = isPassable(project, map, cell.x, cell.y);
  if (!passable && !reasons) return false;
  if (reasons && (upperOccupied || !passable)) {
    // Clearing upper must not be suggested when it would expose blocked lower,
    // even if an authored upper bridge currently makes the cell passable.
    const lowerPass = tilePassability(tileset, tileAt(map, cell.x, cell.y).lower, TILE.EMPTY);
    if (!(lowerPass.up || lowerPass.down || lowerPass.left || lowerPass.right)) reasons.add("lowerImpassable");
    else if (!passable) reasons.add("upperOccupied");
  }
  if (isPathSurfaceTile(map.lowerTiles[index])) {
    if (!reasons) return false;
    reasons.add("protectedSurface");
  }
  const protectedHere = protectionReasons.get(`${cell.x},${cell.y}`);
  // Ungrouped tree bases still acquire a canopy one row north during repair.
  const protectedCanopy = isTreeTrunkTileId(tileId) ? protectionReasons.get(`${cell.x},${cell.y - 1}`) : undefined;
  if (protectedHere || protectedCanopy) {
    if (!reasons) return false;
    for (const reason of [...(protectedHere ?? []), ...(protectedCanopy ?? [])]) reasons.add(reason);
  }
  return !reasons || reasons.size === 0;
}

/** 영역의 모든 칸을 행 우선으로 — 밀집 배치 대상. */
function denseCells(area: Rect): readonly { readonly x: number; readonly y: number }[] {
  const cells: { x: number; y: number }[] = [];
  for (let y = area.y; y < area.y + area.h; y += 1) {
    for (let x = area.x; x < area.x + area.w; x += 1) cells.push({ x, y });
  }
  return cells;
}

function withSoftConfirm(result: ToolExecResult, soft: VocabSoftConfirm | undefined): ToolExecResult {
  if (!soft) return result;
  const warning = `${VOCAB_SOFT_CONFIRM_WARNING_PREFIX}: ${soft.name} — 적용하면 이 재료를 합의합니다`;
  const data = typeof result.data === "object" && result.data !== null && !Array.isArray(result.data)
    ? { ...result.data, vocabSoftConfirm: soft }
    : { vocabSoftConfirm: soft };
  return {
    ...result,
    summary: `${result.summary} (재료 목업 확인 대기)`,
    warnings: [...(result.warnings ?? []), warning],
    data,
  };
}
