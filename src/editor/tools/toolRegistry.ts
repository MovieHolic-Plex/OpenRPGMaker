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
import { PLAY_TOOLS } from "./playTools";
import { PLACEMENT_TOOLS } from "./placementTools";
import { QUERY_TOOLS } from "./queryTools";
import { QUEST_TOOLS } from "./questTools";
import { RANGE_CLASSIFY_TOOLS } from "./rangeClassifyTools";
import { REFACTOR_TOOLS } from "./refactorTools";
import { TERRAIN_TEMPLATE_TOOLS } from "./terrainTemplateTools";
import { TILE_METADATA_TOOLS } from "./tileMetadataTools";
import type { JsonSchema, ToolDefinition } from "./types";
import { VISION_QUERY_TOOLS } from "./visionQueryTools";
import { WORLD_TOOLS } from "./worldTools";

export { PLACEMENT_TOOLS };

// 레지스트리(순서 = 카탈로그 표시 순서).
export const TOOL_REGISTRY: readonly ToolDefinition[] = [
  ...MAP_TOOLS,
  ...MAP_GEN_TOOLS,
  ...EVENT_TOOLS,
  ...DB_TOOLS,
  ...WORLD_TOOLS,
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
];

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

// OpenAI Chat Completions `tools` 배열로 변환.
export function toOpenAiTools(tools: readonly ToolDefinition[] = TOOL_REGISTRY): OpenAiTool[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}
