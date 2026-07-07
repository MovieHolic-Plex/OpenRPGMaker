// editor/tools/v2/tileKnowledgeV2.ts
// 타일 지식 v2 — 메타데이터/그룹/클러스터 규칙/팔레트 프리셋 쓰기 + 통합 조회(tile_query).

import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { unapprovedVocabulary } from "@/project/tileVocabulary";
import type { Project } from "@/project/types";
import { CLUSTER_RULE_TOOLS } from "../clusterRuleTools";
import { PALETTE_PRESET_TOOLS } from "../palettePresetTools";
import { QUERY_TOOLS } from "../queryTools";
import { TERRAIN_TEMPLATE_TOOLS } from "../terrainTemplateTools";
import { TILE_METADATA_TOOLS } from "../tileMetadataTools";
import { VISION_QUERY_TOOLS } from "../visionQueryTools";
import type { ToolDefinition, ToolExecResult } from "../types";
import { byName, coerceEnum, coerceTileIndex, compactArgs, failWithExample } from "./tileToolsV2Support";

const v1SetTileMetadata = byName(TILE_METADATA_TOOLS, "set_tile_metadata");
const v1SetTileRules = byName(TILE_METADATA_TOOLS, "set_tile_rules");
const v1UpsertGroup = byName(TILE_METADATA_TOOLS, "upsert_tile_group");
const v1DeleteGroup = byName(TILE_METADATA_TOOLS, "delete_tile_group");
const v1SetJunction = byName(TILE_METADATA_TOOLS, "set_group_junction");
const v1SetOverlay = byName(TILE_METADATA_TOOLS, "set_group_overlay");
const v1SetClusterRule = byName(CLUSTER_RULE_TOOLS, "set_cluster_rule");
const v1UpsertPreset = byName(PALETTE_PRESET_TOOLS, "upsert_palette_preset");
const v1GetTileInfo = byName(TILE_METADATA_TOOLS, "get_tile_info");
const v1ListUnclassified = byName(TILE_METADATA_TOOLS, "list_unclassified_tiles");
const v1AnalyzeUsage = byName(TILE_METADATA_TOOLS, "analyze_map_tile_usage");
const v1QueryTiles = byName(QUERY_TOOLS, "query_tiles");
const v1FindSimilar = byName(VISION_QUERY_TOOLS, "find_similar_tiles");
const v1ListTemplates = byName(TERRAIN_TEMPLATE_TOOLS, "list_terrain_templates");
const v1GetTemplate = byName(TERRAIN_TEMPLATE_TOOLS, "get_terrain_template");

const META_EXAMPLE = {
  tilesetId: "tiles_default",
  entries: [{ tile: 260, label: "침엽수 상단", role: "prop", passable: false }],
};
const GROUP_EXAMPLE = {
  action: "upsert",
  group: { name: "자연 침엽수", role: "prop", tileIds: [260, 290], defaultLayer: "upper" },
};
const RULE_EXAMPLE = {
  groupId: "conifer_tree",
  rule: { id: "conifer-pair", kind: "adjacency", strength: "hard", params: { requireAboveTile: 290 } },
};
const QUERY_EXAMPLE = { ask: "palette", role: "decor", limit: 20 };

function mergeResults(parts: ToolExecResult[]): ToolExecResult {
  const warnings = parts.flatMap((part) => part.warnings ?? []);
  return {
    summary: parts.map((part) => part.summary).join(" / "),
    ...(warnings.length > 0 ? { warnings } : {}),
    data: parts.length === 1 ? parts[0].data : parts.map((part) => part.data),
  };
}

const META_FIELDS = ["label", "name", "description", "role", "tags"] as const;
const RULE_FIELDS = ["layer", "passable", "terrainTag"] as const;

const tileMetadata: ToolDefinition = {
  name: "tile_metadata",
  description:
    "타일의 의미(label/description/role/tags)와 규칙(layer/passable/terrainTag)을 한 번에 설정한다(v2). entries 항목마다 필요한 필드만 넣으면 의미/규칙이 자동 분배된다. 사용자가 확정한 값이면 confirmedByUser=true(잠금·재감사 보호). 잠긴 타일은 confirmedByUser=true로만 수정 가능.",
  mode: "write",
  version: 2,
  parameters: {
    type: "object",
    properties: {
      tilesetId: { type: "string", description: "기본 tiles_default" },
      confirmedByUser: { type: "boolean" },
      entries: {
        type: "array",
        items: {
          type: "object",
          properties: {
            tile: { type: "integer", description: "타일 인덱스(별칭 tileId/index 허용)" },
            label: { type: "string" },
            description: { type: "string" },
            role: { type: "string", description: "타일 용도 태그(자유 문자열)" },
            tags: { type: "array", items: { type: "string" } },
            layer: { type: "string", enum: ["auto", "lower", "upper"] },
            passable: { type: "boolean" },
            terrainTag: { type: "integer" },
          },
          required: ["tile"],
        },
      },
    },
    required: ["entries"],
  },
  run(draft: Project, args: Record<string, unknown>): ToolExecResult {
    if (!Array.isArray(args.entries) || args.entries.length === 0) {
      failWithExample("entries 배열(1개 이상)이 필요합니다", META_EXAMPLE);
    }
    const metaEntries: Record<string, unknown>[] = [];
    const ruleEntries: Record<string, unknown>[] = [];
    for (const [index, raw] of (args.entries as unknown[]).entries()) {
      if (typeof raw !== "object" || raw === null) failWithExample(`entries[${index}]는 객체여야 합니다`, META_EXAMPLE);
      const entry = raw as Record<string, unknown>;
      const tile = coerceTileIndex(entry, `entries[${index}]`, META_EXAMPLE);
      const meta = Object.fromEntries(META_FIELDS.filter((key) => entry[key] !== undefined).map((key) => [key, entry[key]]));
      const rule = Object.fromEntries(RULE_FIELDS.filter((key) => entry[key] !== undefined).map((key) => [key, entry[key]]));
      if (Object.keys(meta).length === 0 && Object.keys(rule).length === 0) {
        failWithExample(`entries[${index}]에 설정할 필드가 없습니다 — label/role/passable 등 최소 1개`, META_EXAMPLE);
      }
      if (Object.keys(meta).length > 0) metaEntries.push({ tile, ...meta });
      if (Object.keys(rule).length > 0) ruleEntries.push({ tile, ...rule });
    }
    const parts: ToolExecResult[] = [];
    const common = compactArgs({ tilesetId: args.tilesetId, confirmedByUser: args.confirmedByUser });
    if (metaEntries.length > 0) parts.push(v1SetTileMetadata.run(draft, { ...common, entries: metaEntries }));
    if (ruleEntries.length > 0) parts.push(v1SetTileRules.run(draft, { ...common, entries: ruleEntries }));
    return mergeResults(parts);
  },
};

const GROUP_ACTIONS = ["upsert", "delete", "set_junction", "set_overlay"] as const;
const GROUP_ROLES = ["building", "castle", "fence", "roof", "terrain", "water", "wall", "prop"] as const;

const tileGroup: ToolDefinition = {
  name: "tile_group",
  description:
    "타일 그룹을 관리한다(v2). action=upsert(group 필요: 신규는 id 생략), delete(groupId), set_junction(groupId+junction), set_overlay(groupId+overlay). 그룹은 산포/클러스터 규칙의 단위다.",
  mode: "write",
  version: 2,
  parameters: {
    type: "object",
    properties: {
      tilesetId: { type: "string", description: "기본 tiles_default" },
      action: { type: "string", enum: [...GROUP_ACTIONS] },
      group: {
        type: "object",
        description: "action=upsert 전용. 신규 그룹은 id를 생략하라(자동 발급).",
        properties: {
          id: { type: "string", description: "기존 그룹 수정 시에만" },
          name: { type: "string" },
          role: { type: "string", enum: [...GROUP_ROLES] },
          tileIds: { type: "array", items: { type: "integer" } },
          defaultLayer: { type: "string", enum: ["lower", "upper"] },
          description: { type: "string" },
        },
        required: ["name", "role", "tileIds"],
      },
      groupId: { type: "string", description: "delete/set_junction/set_overlay 전용" },
      junction: { type: "object", description: "set_junction 전용 — 그룹 접합 규칙 객체", additionalProperties: true },
      overlay: { type: "object", description: "set_overlay 전용 — 그룹 오버레이 규칙 객체", additionalProperties: true },
    },
    required: ["action"],
  },
  run(draft: Project, args: Record<string, unknown>): ToolExecResult {
    const action = coerceEnum(args.action, GROUP_ACTIONS, "action", GROUP_EXAMPLE);
    if (action === "upsert") {
      if (typeof args.group !== "object" || args.group === null) failWithExample("action=upsert에는 group 객체가 필요합니다", GROUP_EXAMPLE);
      const group = args.group as Record<string, unknown>;
      if (typeof group.name !== "string" || !Array.isArray(group.tileIds) || group.tileIds.length === 0) {
        failWithExample("group에는 name과 tileIds(1개 이상)가 필요합니다", GROUP_EXAMPLE);
      }
      coerceEnum(group.role, GROUP_ROLES, "group.role", GROUP_EXAMPLE);
      return v1UpsertGroup.run(draft, compactArgs({ tilesetId: args.tilesetId, ...group }));
    }
    if (typeof args.groupId !== "string" || args.groupId.length === 0) {
      failWithExample(`action=${action}에는 groupId가 필요합니다`, { action, groupId: "conifer_tree" });
    }
    if (action === "delete") return v1DeleteGroup.run(draft, compactArgs({ tilesetId: args.tilesetId ?? "tiles_default", groupId: args.groupId }));
    if (action === "set_junction") {
      if (typeof args.junction !== "object" || args.junction === null) failWithExample("set_junction에는 junction 객체가 필요합니다", { action, groupId: "dirt_road", junction: { otherGroupId: "sand", tile: 372 } });
      return v1SetJunction.run(draft, compactArgs({ tilesetId: args.tilesetId ?? "tiles_default", groupId: args.groupId, junction: args.junction }));
    }
    if (typeof args.overlay !== "object" || args.overlay === null) failWithExample("set_overlay에는 overlay 객체가 필요합니다", { action, groupId: "flowers", overlay: { baseGroupId: "grass" } });
    return v1SetOverlay.run(draft, compactArgs({ tilesetId: args.tilesetId ?? "tiles_default", groupId: args.groupId, overlay: args.overlay }));
  },
};

const tileClusterRule: ToolDefinition = {
  name: "tile_cluster_rule",
  description:
    "타일 그룹의 클러스터 규칙을 설정한다(v2). kind: adjacency(동반/인접 배치), spacing(간격), count(개수 한도). strength: hard(배치 강제)/medium(경고)/soft(정보). params는 kind별 파라미터 객체.",
  mode: "write",
  version: 2,
  parameters: {
    type: "object",
    properties: {
      tilesetId: { type: "string", description: "기본 tiles_default" },
      groupId: { type: "string" },
      rule: {
        type: "object",
        properties: {
          id: { type: "string", description: "규칙 id(예: conifer-pair)" },
          kind: { type: "string", enum: ["adjacency", "spacing", "count"] },
          strength: { type: "string", enum: ["hard", "medium", "soft"] },
          params: { type: "object", description: "kind별 파라미터", additionalProperties: true },
        },
        required: ["id", "kind", "strength", "params"],
      },
    },
    required: ["groupId", "rule"],
  },
  run(draft: Project, args: Record<string, unknown>): ToolExecResult {
    if (typeof args.groupId !== "string" || args.groupId.length === 0) failWithExample("groupId가 필요합니다", RULE_EXAMPLE);
    if (typeof args.rule !== "object" || args.rule === null) failWithExample("rule 객체가 필요합니다", RULE_EXAMPLE);
    return v1SetClusterRule.run(draft, compactArgs({ tilesetId: args.tilesetId ?? "tiles_default", groupId: args.groupId, rule: args.rule }));
  },
};

const tilePalettePreset: ToolDefinition = {
  name: "tile_palette_preset",
  description: v1UpsertPreset.description,
  mode: "write",
  version: 2,
  parameters: v1UpsertPreset.parameters,
  run(draft: Project, args: Record<string, unknown>): ToolExecResult {
    return v1UpsertPreset.run(draft, args);
  },
};

const ASK_KINDS = ["tile_info", "unclassified", "palette", "usage", "similar", "terrain_templates", "terrain_template", "unapproved"] as const;

const tileQuery: ToolDefinition = {
  name: "tile_query",
  description:
    "타일 지식 통합 조회(v2). ask: tile_info(tileIds 상세), unclassified(미분류 목록), palette(role/category/프리셋 필터로 타일 찾기 — 칠할 타일을 모를 때 여기부터), usage(맵 사용 현황: mapId), similar(비슷한 타일: tileId), terrain_templates(템플릿 목록), terrain_template(템플릿 상세: templateId), unapproved(미승인 어휘 요약 — 배치 전 propose_tile_vocabulary 대상 확인).",
  mode: "read",
  version: 2,
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
      templateId: { type: "string", description: "ask=terrain_template 전용" },
      limit: { type: "integer" },
    },
    required: ["ask"],
  },
  run(draft: Project, args: Record<string, unknown>): ToolExecResult {
    const ask = coerceEnum(args.ask, ASK_KINDS, "ask", QUERY_EXAMPLE);
    if (ask === "tile_info") {
      if (!Array.isArray(args.tileIds) || args.tileIds.length === 0) failWithExample("ask=tile_info에는 tileIds 배열이 필요합니다", { ask, tileIds: [260, 290] });
      return v1GetTileInfo.run(draft, compactArgs({ tileIds: args.tileIds, tilesetId: args.tilesetId }));
    }
    if (ask === "unclassified") return v1ListUnclassified.run(draft, compactArgs({ tilesetId: args.tilesetId ?? "tiles_default", limit: args.limit }));
    if (ask === "palette") return v1QueryTiles.run(draft, compactArgs({ tilesetId: args.tilesetId, role: args.role, category: args.category, presetId: args.presetId, limit: args.limit }));
    if (ask === "usage") {
      if (typeof args.mapId !== "string") failWithExample("ask=usage에는 mapId가 필요합니다", { ask, mapId: "map_1" });
      return v1AnalyzeUsage.run(draft, compactArgs({ mapId: args.mapId }));
    }
    if (ask === "similar") {
      if (args.tileId === undefined) failWithExample("ask=similar에는 tileId가 필요합니다", { ask, tileId: 260 });
      return v1FindSimilar.run(draft, compactArgs({ tilesetId: args.tilesetId ?? "tiles_default", tileId: args.tileId, limit: args.limit }));
    }
    if (ask === "unapproved") {
      // v3 승인 보캐뷸러리: 미승인 그룹/타일 요약(수량 + 대표 id). 승인 편입은 propose_tile_vocabulary.
      const tilesetId = typeof args.tilesetId === "string" && args.tilesetId ? args.tilesetId : DEFAULT_TILESET_ID;
      const tileset = draft.tilesets[tilesetId];
      if (!tileset) failWithExample(`타일셋을 찾을 수 없습니다: ${tilesetId}`, { ask, tilesetId: DEFAULT_TILESET_ID });
      const limit = typeof args.limit === "number" && Number.isInteger(args.limit) && args.limit > 0 ? args.limit : 10;
      const summary = unapprovedVocabulary(tileset, limit);
      return {
        summary: `미승인 어휘: 그룹 ${summary.groupCount}개, 타일 ${summary.tileCount}개 — propose_tile_vocabulary로 어휘를 제안한 뒤, 같은 턴에 곧바로 그 그룹 id로 시공 프리미티브(build_wall 등)를 호출하세요. 미승인 첫 호출 실패는 정상이며 승인 카드에 보류 시공으로 묶입니다(수락 한 번에 시공 완료). 제안만 하고 멈추지 마세요.`,
        data: { tilesetId, ...summary },
      };
    }
    if (ask === "terrain_templates") return v1ListTemplates.run(draft, {});
    if (typeof args.templateId !== "string") failWithExample("ask=terrain_template에는 templateId가 필요합니다", { ask, templateId: "tt_village_core" });
    return v1GetTemplate.run(draft, compactArgs({ templateId: args.templateId, tilesetId: args.tilesetId }));
  },
};

export const TILE_KNOWLEDGE_TOOLS_V2: readonly ToolDefinition[] = [tileQuery, tileMetadata, tileGroup, tileClusterRule, tilePalettePreset];
