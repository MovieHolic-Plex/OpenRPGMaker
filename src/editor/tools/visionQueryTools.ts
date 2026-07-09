import { TILE } from "@/project/defaults/constants";
import type { GameMap, Project, TileAiMetadata, TileGroupMetadata, TilesetDef } from "@/project/types";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

type SimilarTileScore = {
  readonly distance: number;
  readonly score: number;
  readonly tile: number;
};

const DEFAULT_SIMILAR_TILE_LIMIT = 12;
const MAX_SIMILAR_TILE_LIMIT = 48;

const showMapRegion: ToolDefinition = {
  name: "show_map_region",
  description:
    "맵 영역을 하위/상위 타일 2D 배열로 반환하고 실제 타일 이미지로 보여준다. 맵에 뭔가 깐 뒤 말로 단정하지 말고 이 툴로 결과를 눈으로 확인하라.",
  mode: "read",
  invalidArgsExample: { mapId: "map_1", x: 0, y: 0, w: 10, h: 8 },
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
      w: { type: "integer" },
      h: { type: "integer" },
    },
    required: ["mapId", "x", "y", "w", "h"],
  },
  run(project, args): ToolExecResult {
    const map = requireMap(project, stringArg(args, "mapId"));
    const region = clampedRegion(map, integerArg(args, "x"), integerArg(args, "y"), integerArg(args, "w"), integerArg(args, "h"));
    const lower: number[][] = [];
    const upper: number[][] = [];
    for (let row = 0; row < region.h; row += 1) {
      const lowerRow: number[] = [];
      const upperRow: number[] = [];
      for (let column = 0; column < region.w; column += 1) {
        const index = (region.y + row) * map.width + region.x + column;
        lowerRow.push(map.lowerTiles[index] ?? TILE.EMPTY);
        upperRow.push(map.upperTiles[index] ?? TILE.EMPTY);
      }
      lower.push(lowerRow);
      upper.push(upperRow);
    }
    return {
      summary: `맵 미리보기: (${region.x},${region.y}) ${region.w}×${region.h} (${map.name})`,
      data: { h: region.h, lower, mapId: map.id, upper, w: region.w, x: region.x, y: region.y },
    };
  },
};

const findSimilarTiles: ToolDefinition = {
  name: "find_similar_tiles",
  description:
    "기준 타일과 같이 쓰기 좋은 비슷한 타일 인덱스를 추천한다. 이미지 픽셀을 읽을 수 없는 환경에서는 시트 근접도, role/label, terrainTag, 그룹 정보를 결정적으로 점수화한다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      tilesetId: { type: "string" },
      tileId: { type: "integer" },
      limit: { type: "integer", description: "반환할 후보 수(기본 12)" },
    },
    required: ["tilesetId", "tileId"],
  },
  run(project, args): ToolExecResult {
    const tileset = requireTileset(project, stringArg(args, "tilesetId"));
    const tileId = requireTileIndex(tileset, integerArg(args, "tileId"));
    const limit = limitArg(args.limit);
    const tiles = similarTiles(tileset, tileId).slice(0, limit).map((entry) => entry.tile);
    return {
      summary: `타일 ${tileId}와 비슷한 후보 ${tiles.length}개: ${tiles.join(", ")}`,
      data: { tileId, tiles, tilesetId: tileset.id },
    };
  },
};

export const VISION_QUERY_TOOLS: readonly ToolDefinition[] = [showMapRegion, findSimilarTiles];

function clampedRegion(map: GameMap, xValue: number, yValue: number, wValue: number, hValue: number): { readonly h: number; readonly w: number; readonly x: number; readonly y: number } {
  if (map.width <= 0 || map.height <= 0) throw new ToolError(`맵 크기가 올바르지 않습니다: ${map.id}`, { code: "invalid-map", mapId: map.id });
  const x = Math.max(0, Math.min(map.width - 1, xValue));
  const y = Math.max(0, Math.min(map.height - 1, yValue));
  const w = Math.max(1, Math.min(map.width - x, wValue));
  const h = Math.max(1, Math.min(map.height - y, hValue));
  return { h, w, x, y };
}

function similarTiles(tileset: TilesetDef, tileId: number): readonly SimilarTileScore[] {
  const sourceMeta = metadataFor(tileset, tileId);
  const sourceTokens = textTokens(sourceMeta);
  const sourceRole = sourceMeta?.role ?? groupRoleForTile(tileset, tileId);
  const sourceTerrain = terrainTagFor(tileset, tileId);
  const sourceGroups = groupsForTile(tileset, tileId);
  const sourceX = tileId % tileset.tilesPerRow;
  const sourceY = Math.floor(tileId / tileset.tilesPerRow);
  const scores: SimilarTileScore[] = [];
  for (let tile = 0; tile < tileset.count; tile += 1) {
    if (tile === tileId) continue;
    const candidateX = tile % tileset.tilesPerRow;
    const candidateY = Math.floor(tile / tileset.tilesPerRow);
    const distance = Math.abs(sourceX - candidateX) + Math.abs(sourceY - candidateY);
    const meta = metadataFor(tileset, tile);
    const score = sheetScore(sourceX, sourceY, candidateX, candidateY)
      + metadataScore(sourceRole, sourceTokens, sourceTerrain, sourceMeta, meta, tileset, tile)
      + groupScore(sourceGroups, tileset, tile);
    scores.push({ distance, score, tile });
  }
  return scores.sort((a, b) => b.score - a.score || a.distance - b.distance || a.tile - b.tile);
}

function sheetScore(sourceX: number, sourceY: number, candidateX: number, candidateY: number): number {
  const dx = Math.abs(sourceX - candidateX);
  const dy = Math.abs(sourceY - candidateY);
  const distance = dx + dy;
  let score = Math.max(0, 28 - distance * 4);
  if (dy === 0) score += 8;
  if (dx === 0) score += 6;
  if (distance === 1) score += 8;
  return score;
}

function metadataScore(
  sourceRole: string | undefined,
  sourceTokens: ReadonlySet<string>,
  sourceTerrain: number,
  sourceMeta: TileAiMetadata | undefined,
  meta: TileAiMetadata | undefined,
  tileset: TilesetDef,
  tile: number
): number {
  let score = 0;
  if (sourceRole && meta?.role === sourceRole) score += 48;
  for (const token of textTokens(meta)) {
    if (sourceTokens.has(token)) score += 7;
  }
  const terrain = terrainTagFor(tileset, tile);
  if (terrain === sourceTerrain) {
    score += 24;
  } else {
    score += Math.max(0, 10 - Math.abs(terrain - sourceTerrain) * 2);
  }
  if (sourceMeta?.defaultLayer !== undefined && meta?.defaultLayer === sourceMeta.defaultLayer) score += 4;
  return score;
}

function groupScore(sourceGroups: readonly TileGroupMetadata[], tileset: TilesetDef, tile: number): number {
  const candidateGroups = groupsForTile(tileset, tile);
  let score = 0;
  for (const sourceGroup of sourceGroups) {
    if (candidateGroups.some((candidate) => candidate.id === sourceGroup.id)) score += 40;
    if (candidateGroups.some((candidate) => candidate.role === sourceGroup.role)) score += 18;
  }
  return score;
}

function textTokens(meta: TileAiMetadata | undefined): ReadonlySet<string> {
  const text = [meta?.label, meta?.description, ...(meta?.tags ?? [])].filter((value): value is string => Boolean(value?.trim())).join(" ");
  return new Set(text.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token) => token.length > 0));
}

function terrainTagFor(tileset: TilesetDef, tile: number): number {
  return metadataFor(tileset, tile)?.terrainTag ?? tileset.terrain[tile] ?? 0;
}

function metadataFor(tileset: TilesetDef, tile: number): TileAiMetadata | undefined {
  return tileset.tileMeta?.[tile];
}

function groupsForTile(tileset: TilesetDef, tile: number): readonly TileGroupMetadata[] {
  return (tileset.tileGroups ?? []).filter((group) => group.tileIds.includes(tile));
}

function groupRoleForTile(tileset: TilesetDef, tile: number): string | undefined {
  return groupsForTile(tileset, tile)[0]?.role;
}

function requireTileset(project: Project, id: string): TilesetDef {
  const tileset = project.tilesets[id];
  if (!tileset) throw new ToolError(`타일셋을 찾을 수 없습니다: ${id}`, { code: "tileset-not-found" });
  return tileset;
}

function requireTileIndex(tileset: TilesetDef, tile: number): number {
  if (!Number.isInteger(tile) || tile < 0 || tile >= tileset.count) {
    throw new ToolError(`타일 인덱스 범위 밖: ${tile} (0~${tileset.count - 1})`, { code: "tile-out-of-range" });
  }
  return tile;
}

function stringArg(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || value.length === 0) throw new ToolError(`${key}가 비어 있습니다.`, { code: "invalid-args" });
  return value;
}

function integerArg(args: Record<string, unknown>, key: string): number {
  const value = args[key];
  if (typeof value !== "number" || !Number.isInteger(value)) throw new ToolError(`${key}는 정수여야 합니다.`, { code: "invalid-args" });
  return value;
}

function limitArg(value: unknown): number {
  if (value === undefined) return DEFAULT_SIMILAR_TILE_LIMIT;
  if (typeof value !== "number" || !Number.isInteger(value)) throw new ToolError("limit은 정수여야 합니다.", { code: "invalid-args" });
  return Math.max(1, Math.min(MAX_SIMILAR_TILE_LIMIT, value));
}
