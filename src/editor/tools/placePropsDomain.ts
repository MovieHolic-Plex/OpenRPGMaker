import { isPassable } from "@/project/collision";
import { TILE } from "@/project/defaults/constants";
import {
  resolveMaterialByLabel,
  suggestMaterialsByLabel,
  VOCAB_SOFT_CONFIRM_WARNING_PREFIX,
  type VocabLayerHome,
  type VocabSoftConfirm,
} from "@/project/tileVocabulary";
import type { Project } from "@/project/types";
import { inMapBounds, setLower, setUpper } from "./mapHelpers";
import { poissonScatter } from "./naturalScatter";
import { naturalnessArg, naturalnessLabel, rngForTool } from "./naturalToolArgs";
import { isPathSurfaceTile, runScatterObject } from "./placementTools";
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
};

export function placePropsOnDraft(draft: Project, input: PlacePropsInput): ToolExecResult {
  const map = draft.maps[input.mapId];
  if (!map) throw new ToolError(`맵을 찾을 수 없습니다: ${input.mapId}`, { code: "missing-map", mapId: input.mapId });
  const tileset = draft.tilesets[map.tilesetId];
  if (!tileset) throw new ToolError(`타일셋을 찾을 수 없습니다: ${map.tilesetId}`, { code: "tileset-not-found", mapId: map.id });

  const args: Record<string, unknown> = {
    mapId: input.mapId,
    area: input.area,
    material: input.material,
    count: input.count,
    ...(input.minGap === undefined ? {} : { minGap: input.minGap }),
    ...(input.naturalness === undefined ? {} : { naturalness: input.naturalness }),
    ...(input.seed === undefined ? {} : { seed: input.seed }),
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
  const minGap = typeof input.minGap === "number" && Number.isInteger(input.minGap) ? Math.max(0, input.minGap) : 1;
  const signature = `place_props|${map.id}|${input.area.x},${input.area.y},${input.area.w},${input.area.h}|${tileId}|${input.count}|${naturalnessLabel(naturalness)}`;
  const scatter = poissonScatter(
    { x: input.area.x, y: input.area.y, width: input.area.w, height: input.area.h },
    input.count,
    minGap,
    rngForTool(args, signature),
  );
  const declared = tileset.tileMeta?.[tileId]?.defaultLayer;
  const tileHome: VocabLayerHome = declared === "lower" || declared === "upper" ? declared : "perCell";
  const home = layerForVocabTile(tileset, tileHome, tileId);
  let placed = 0;
  for (const cell of scatter.points) {
    if (!inMapBounds(map, cell.x, cell.y)) continue;
    const index = cell.y * map.width + cell.x;
    if (map.upperTiles[index] !== TILE.EMPTY) continue;
    if (!isPassable(draft, map, cell.x, cell.y)) continue;
    if (isPathSurfaceTile(map.lowerTiles[index])) continue;
    if (home === "upper") setUpper(map, cell.x, cell.y, tileId);
    else setLower(map, cell.x, cell.y, tileId);
    placed += 1;
  }
  return withSoftConfirm({
    summary: `${map.name} (${input.area.x},${input.area.y}) ${input.area.w}×${input.area.h}에 소품(${access.matchedLabel || tileId}) ${placed}/${input.count}개 산포 — 자연도 ${naturalnessLabel(naturalness)}.`,
    data: { placed, requested: input.count, tileId, material: access.matchedLabel },
  }, soft);
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
