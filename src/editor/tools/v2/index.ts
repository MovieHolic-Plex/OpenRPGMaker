// editor/tools/v2/index.ts
// 타일 v2 툴 집합 — v1 타일 툴 25종을 9종으로 대체한다 (2026-07-07 전면 재구축).
// 배경: v1 스키마 부실(중첩 미명세/required-properties 불일치)로 모델 오호출·재시도 폭주.
// v2 계약: 완전한 스키마 + 별칭 수용 + 모든 오류에 "다시 보낼 형식 예시" 동봉. 엔진은 v1 재사용.

import { TILE_KNOWLEDGE_TOOLS_V2 } from "./tileKnowledgeV2";
import { TILE_PLACE_TOOLS_V2 } from "./tilePlaceV2";
import type { ToolDefinition } from "../types";

export const TILE_TOOLS_V2: readonly ToolDefinition[] = [...TILE_PLACE_TOOLS_V2, ...TILE_KNOWLEDGE_TOOLS_V2];

// v2가 대체하는 v1 툴 → 대체 v2 툴 이름. 레지스트리가 이 표로 deprecated 마킹한다.
export const V1_TILE_SUPERSEDED: ReadonlyMap<string, string> = new Map([
  ["paint_tiles", "tile_paint"],
  ["clear_region", "tile_paint"],
  ["paint_road", "tile_road"],
  ["scatter_object", "tile_scatter"],
  ["build_house", "tile_structure"],
  ["stamp_structure", "tile_structure"],
  ["stamp_template_house", "tile_structure"],
  ["preview_house", "tile_structure"],
  ["stamp_terrain_template", "tile_structure"],
  ["set_tile_metadata", "tile_metadata"],
  ["set_tile_rules", "tile_metadata"],
  ["set_tile_passability", "tile_metadata"],
  ["upsert_tile_group", "tile_group"],
  ["delete_tile_group", "tile_group"],
  ["set_group_junction", "tile_group"],
  ["set_group_overlay", "tile_group"],
  ["set_cluster_rule", "tile_cluster_rule"],
  ["upsert_palette_preset", "tile_palette_preset"],
  ["get_tile_info", "tile_query"],
  ["list_unclassified_tiles", "tile_query"],
  ["query_tiles", "tile_query"],
  ["analyze_map_tile_usage", "tile_query"],
  ["find_similar_tiles", "tile_query"],
  ["list_terrain_templates", "tile_query"],
  ["get_terrain_template", "tile_query"],
]);
