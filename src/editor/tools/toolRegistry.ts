// editor/tools/toolRegistry.ts
// 모든 툴(읽기+쓰기)의 단일 레지스트리. 툴 추가 = 각 *Tools.ts 배열에 한 줄 추가로 끝난다.
// toOpenAiTools()로 OpenAI function calling `tools` 배열을 자동 파생한다.

import { BATTLE_TOOLS } from "./battleTools";
import { CLUSTER_RULE_TOOLS } from "./clusterRuleTools";
import { DB_TOOLS } from "./dbTools";
import { EVENT_TOOLS } from "./eventTools";
import { MAP_GEN_TOOLS } from "./generateMapTool";
import { GROUP_LAYOUT_TOOLS } from "./groupLayoutTools";
import { GROUP_SAMPLE_TOOLS } from "./groupSampleTool";
import { HISTORY_TOOLS } from "./historyTools";
import { MAP_TOOLS } from "./mapTools";
import { PALETTE_PRESET_TOOLS } from "./palettePresetTools";
import { PLAY_TOOLS } from "./playTools";
import { PLACEMENT_TOOLS } from "./placementTools";
import { QUERY_TOOLS } from "./queryTools";
import { QUEST_TOOLS } from "./questTools";
import { RANGE_CLASSIFY_TOOLS } from "./rangeClassifyTools";
import { REFACTOR_TOOLS } from "./refactorTools";
import { TERRAIN_TEMPLATE_TOOLS } from "./terrainTemplateTools";
import { TILE_METADATA_TOOLS } from "./tileMetadataTools";
import type { JsonSchema, ToolDefinition } from "./types";
import { TILE_TOOLS_V2, V1_TILE_SUPERSEDED } from "./v2";
import { VOCABULARY_TOOLS_V3 } from "./v3";
import { VISION_QUERY_TOOLS } from "./visionQueryTools";
import { WORLD_TOOLS } from "./worldTools";

export { PLACEMENT_TOOLS };

// v2 재구축(2026-07-07): 모든 기존 툴은 version 1로 태깅하고, 타일 계열 v1은 v2 대체와 함께
// deprecated 처리한다(LLM 노출 제외 — getTool/실행 호환은 유지).
function tagV1(tools: readonly ToolDefinition[]): readonly ToolDefinition[] {
  return tools.map((tool) => {
    const supersededBy = V1_TILE_SUPERSEDED.get(tool.name);
    if (supersededBy) return { ...tool, version: 1 as const, deprecated: true, supersededBy };
    return { ...tool, version: tool.version ?? (1 as const) };
  });
}

// 레지스트리(순서 = 카탈로그 표시 순서). v3 승인 보캐뷸러리 → v2 타일 툴 순으로 앞에 온다.
export const TOOL_REGISTRY: readonly ToolDefinition[] = tagV1([
  ...VOCABULARY_TOOLS_V3,
  ...TILE_TOOLS_V2,
  ...MAP_TOOLS,
  ...MAP_GEN_TOOLS,
  ...EVENT_TOOLS,
  ...DB_TOOLS,
  ...WORLD_TOOLS,
  ...PALETTE_PRESET_TOOLS,
  ...QUEST_TOOLS,
  ...BATTLE_TOOLS,
  ...REFACTOR_TOOLS,
  ...HISTORY_TOOLS,
  ...PLAY_TOOLS,
  ...QUERY_TOOLS,
  ...TILE_METADATA_TOOLS,
  ...CLUSTER_RULE_TOOLS,
  ...GROUP_LAYOUT_TOOLS,
  ...GROUP_SAMPLE_TOOLS,
  ...VISION_QUERY_TOOLS,
  ...PLACEMENT_TOOLS,
  ...RANGE_CLASSIFY_TOOLS,
  ...TERRAIN_TEMPLATE_TOOLS,
]);

const TOOL_BY_NAME = new Map<string, ToolDefinition>(TOOL_REGISTRY.map((tool) => [tool.name, tool]));

export function getTool(name: string): ToolDefinition | undefined {
  return TOOL_BY_NAME.get(name);
}

export function allTools(): readonly ToolDefinition[] {
  return TOOL_REGISTRY;
}

export interface OpenAiTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JsonSchema;
  };
}

// OpenAI Chat Completions `tools` 배열로 변환. deprecated 툴은 LLM에 노출하지 않는다.
export function toOpenAiTools(tools: readonly ToolDefinition[] = TOOL_REGISTRY): OpenAiTool[] {
  return tools.filter((tool) => tool.deprecated !== true).map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}
