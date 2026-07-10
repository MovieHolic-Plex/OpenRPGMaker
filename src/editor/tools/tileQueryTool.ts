// 타일 지식 통합 조회 — 활성 LLM 툴 (core 노출).
// 구 v2 지식 쓰기 래퍼(tile_metadata/group/…)는 제거. 쓰기는 propose_tile_vocabulary.
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { unapprovedVocabulary } from "@/project/tileVocabulary";
import type { Project } from "@/project/types";
import { QUERY_TOOLS } from "./queryTools";
import { TILE_METADATA_TOOLS } from "./tileMetadataTools";
import { VISION_QUERY_TOOLS } from "./visionQueryTools";
import type { ToolDefinition, ToolExecResult } from "./types";
import { byName, coerceEnum, compactArgs, failWithExample } from "./toolArgCoerce";

const v1GetTileInfo = byName(TILE_METADATA_TOOLS, "get_tile_info");
const v1ListUnclassified = byName(TILE_METADATA_TOOLS, "list_unclassified_tiles");
const v1AnalyzeUsage = byName(TILE_METADATA_TOOLS, "analyze_map_tile_usage");
const v1QueryTiles = byName(QUERY_TOOLS, "query_tiles");
const v1FindSimilar = byName(VISION_QUERY_TOOLS, "find_similar_tiles");

const QUERY_EXAMPLE = { ask: "palette", role: "decor", limit: 20 };
const ASK_KINDS = ["tile_info", "unclassified", "palette", "usage", "similar", "unapproved"] as const;

const tileQuery: ToolDefinition = {
  name: "tile_query",
  description:
    "타일 지식 통합 조회. ask: tile_info(tileIds 상세), unclassified(미분류 목록), palette(role/category/프리셋 필터로 타일 찾기 — 칠할 타일을 모를 때 여기부터), usage(맵 사용 현황: mapId), similar(비슷한 타일: tileId), unapproved(미승인 어휘 요약(신규 재료 정의가 필요한지 확인용 — 존재하는 재료 시공에는 불필요)).",
  mode: "read",
  version: 3,
  domains: ["core", "tile"],
  parameters: {
    type: "object",
    properties: {
      ask: { type: "string", enum: [...ASK_KINDS] },
      tilesetId: { type: "string" },
      tileIds: { type: "array", items: { type: "integer" }, description: "ask=tile_info 전용" },
      tileId: { type: "integer", description: "ask=similar 전용" },
      mapId: { type: "string", description: "ask=usage 전용" },
      role: { type: "string", description: "ask=palette: 팔레트 role 또는 타일 role" },
      category: { type: "string", description: "ask=palette" },
      presetId: { type: "string", description: "ask=palette" },
      limit: { type: "integer" },
    },
    required: ["ask"],
  },
  run(draft: Project, args: Record<string, unknown>): ToolExecResult {
    const ask = coerceEnum(args.ask, ASK_KINDS, "ask", QUERY_EXAMPLE);
    if (ask === "tile_info") {
      if (!Array.isArray(args.tileIds) || args.tileIds.length === 0) {
        failWithExample("ask=tile_info에는 tileIds 배열이 필요합니다", { ask, tileIds: [260, 290] });
      }
      return v1GetTileInfo.run(draft, compactArgs({ tileIds: args.tileIds, tilesetId: args.tilesetId }));
    }
    if (ask === "unclassified") {
      return v1ListUnclassified.run(draft, compactArgs({ tilesetId: args.tilesetId ?? "tiles_default", limit: args.limit }));
    }
    if (ask === "palette") {
      return v1QueryTiles.run(draft, compactArgs({
        tilesetId: args.tilesetId, role: args.role, category: args.category, presetId: args.presetId, limit: args.limit,
      }));
    }
    if (ask === "usage") {
      if (typeof args.mapId !== "string") failWithExample("ask=usage에는 mapId가 필요합니다", { ask, mapId: "map_1" });
      return v1AnalyzeUsage.run(draft, compactArgs({ mapId: args.mapId }));
    }
    if (ask === "similar") {
      if (args.tileId === undefined) failWithExample("ask=similar에는 tileId가 필요합니다", { ask, tileId: 260 });
      return v1FindSimilar.run(draft, compactArgs({
        tilesetId: args.tilesetId ?? "tiles_default", tileId: args.tileId, limit: args.limit,
      }));
    }
    if (ask === "unapproved") {
      const tilesetId = typeof args.tilesetId === "string" && args.tilesetId ? args.tilesetId : DEFAULT_TILESET_ID;
      const tileset = draft.tilesets[tilesetId];
      if (!tileset) failWithExample(`타일셋을 찾을 수 없습니다: ${tilesetId}`, { ask, tilesetId: DEFAULT_TILESET_ID });
      const limit = typeof args.limit === "number" && Number.isInteger(args.limit) && args.limit > 0 ? args.limit : 10;
      const summary = unapprovedVocabulary(tileset, limit);
      return {
        summary:
          `미승인 어휘: 그룹 ${summary.groupCount}개, 타일 ${summary.tileCount}개 — 존재하는 그룹은 승인 여부와 무관하게 ` +
          "시공 프리미티브(build_wall 등)를 바로 호출할 수 있습니다(미합의는 맵 목업 확인). 새 재료 정의가 필요할 때만 propose_tile_vocabulary를 쓰세요.",
        data: { tilesetId, ...summary },
      };
    }
    return failWithExample("알 수 없는 tile_query ask입니다", QUERY_EXAMPLE);
  },
};

export const TILE_QUERY_TOOLS: readonly ToolDefinition[] = [tileQuery];
