// 타일 지식 통합 조회 — 활성 LLM 툴 (core 노출).
// 구 v2 지식 쓰기 래퍼(tile_metadata/group/…)는 제거. 쓰기는 propose_tile_vocabulary.
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { approvedVocabulary, suggestMaterialsByLabel, unapprovedVocabulary } from "@/project/tileVocabulary";
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
const ASK_KINDS = ["tile_info", "unclassified", "palette", "usage", "similar", "unapproved", "vocab", "labels"] as const;

const tileQuery: ToolDefinition = {
  name: "tile_query",
  description:
    "타일 지식 통합 조회. ask: tile_info(tileIds 상세), unclassified(미분류 목록), palette(role/category/프리셋 필터로 타일 찾기), usage(맵 사용 현황: mapId), similar(비슷한 타일: tileId), unapproved(미승인 요약), vocab(재료 그룹 목록 — 참고용), labels(타일 라벨/설명 목록 — 시공 material 인자용, query 로 필터).",
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
      query: { type: "string", description: "ask=labels 전용: 라벨/설명 검색어(예: 물, 침엽수)" },
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
    if (ask === "vocab") {
      const tilesetId = typeof args.tilesetId === "string" && args.tilesetId ? args.tilesetId : DEFAULT_TILESET_ID;
      const tileset = draft.tilesets[tilesetId];
      if (!tileset) failWithExample(`타일셋을 찾을 수 없습니다: ${tilesetId}`, { ask, tilesetId: DEFAULT_TILESET_ID });
      const vocab = approvedVocabulary(tileset);
      const byRole = new Map<string, number>();
      for (const group of vocab.groups) byRole.set(group.role, (byRole.get(group.role) ?? 0) + 1);
      const roleSummary = [...byRole.entries()].map(([role, count]) => `${role} ${count}`).join(", ");
      return {
        summary: `사용 가능 재료 그룹 ${vocab.groups.length}개(${roleSummary}) + 낱개 타일 ${vocab.tiles.length}개. 시공 시 material 에 타일 라벨/설명을 넣으세요(그룹 id·vocabId 금지). ask:"labels" 로 라벨 목록 조회.`,
        data: {
          tilesetId,
          // 그룹 id는 엔진 내부 참고용 — LLM은 material 라벨을 쓴다.
          groups: vocab.groups.map((g) => ({ name: g.name, role: g.role, layerHome: g.layerHome, ...(g.patternKind ? { patternKind: g.patternKind } : {}) })),
          looseTiles: vocab.tiles.map((t) => ({ tileId: t.tileId, label: t.label, layerHome: t.layerHome })),
        },
      };
    }
    if (ask === "labels") {
      const tilesetId = typeof args.tilesetId === "string" && args.tilesetId ? args.tilesetId : DEFAULT_TILESET_ID;
      const tileset = draft.tilesets[tilesetId];
      if (!tileset) failWithExample(`타일셋을 찾을 수 없습니다: ${tilesetId}`, { ask, tilesetId: DEFAULT_TILESET_ID });
      const limit = typeof args.limit === "number" && Number.isInteger(args.limit) && args.limit > 0 ? Math.min(args.limit, 80) : 40;
      const query = typeof args.query === "string" ? args.query : "";
      const materials = suggestMaterialsByLabel(tileset, query, limit);
      // 라벨이 비어 있으면 전체 스캔 샘플
      const labels: { tileId: number; label: string; description: string; role?: string }[] = [];
      if (materials.length > 0) {
        for (const m of materials) labels.push({ tileId: m.tileId, label: m.label, description: m.description, ...(m.role ? { role: m.role } : {}) });
      } else {
        for (let tileId = 0; tileId < tileset.count && labels.length < limit; tileId += 1) {
          const meta = tileset.tileMeta?.[tileId];
          const label = typeof meta?.label === "string" ? meta.label.trim() : "";
          const description = typeof meta?.description === "string" ? meta.description.trim() : "";
          if (!label && !description) continue;
          labels.push({
            tileId,
            label: label || `타일 ${tileId}`,
            description,
            ...(typeof meta?.role === "string" && meta.role ? { role: meta.role } : {}),
          });
        }
      }
      return {
        summary: `타일 라벨 ${labels.length}개 — place_props/fill_region/build_wall 등의 material 인자에 label 문자열을 넣으세요(그룹 id 금지).`,
        data: { tilesetId, query: query || null, labels },
      };
    }
    return failWithExample("알 수 없는 tile_query ask입니다", QUERY_EXAMPLE);
  },
};

export const TILE_QUERY_TOOLS: readonly ToolDefinition[] = [tileQuery];
