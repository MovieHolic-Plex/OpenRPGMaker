// 호환 레이어 잔여 — 구 v2 배치 래퍼(tile_paint 등)는 제거됨.
// V1 툴 이름은 여전히 레지스트리에 deprecated 로 남고, 정준 대체 이름을 가리킨다.

/** 레거시 툴 이름 → 현재 권장 툴 (LLM 비노출 마킹용). */
export const V1_TILE_SUPERSEDED: ReadonlyMap<string, string> = new Map([
  // 배치: v3 정공법
  // paint_tiles remains active: semantic fill cannot replace raw rect/line/cell painting.
  ["clear_region", "tile_erase"],
  // paint_road 는 활성 유지 (흙길 오토타일 본선) — 여기 넣지 않음
  ["scatter_object", "place_props"],
  // build_house, preview_house: construction route manifest에서 관리 (toolRegistry.ts)
  ["stamp_structure", "stamp_object"],
  // set_tile_passability remains active: physical passage is not semantic vocabulary authoring.
  // 지식 쓰기: 승인 어휘
  ["set_tile_metadata", "propose_tile_vocabulary"],
  // set_tile_rules remains active: confirmed runtime layer/passage edits are not vocabulary proposals.
  ["upsert_tile_group", "propose_tile_vocabulary"],
  ["delete_tile_group", "propose_tile_vocabulary"],
  ["set_group_junction", "propose_tile_vocabulary"],
  ["set_group_overlay", "propose_tile_vocabulary"],
  ["set_cluster_rule", "propose_tile_vocabulary"],
  ["upsert_palette_preset", "propose_tile_vocabulary"],
  // 조회: tile_query 통합
  ["get_tile_info", "tile_query"],
  ["list_unclassified_tiles", "tile_query"],
  ["query_tiles", "tile_query"],
  ["analyze_map_tile_usage", "tile_query"],
  ["find_similar_tiles", "tile_query"],
]);

/** @deprecated 구 v2 배치 이름 — 더 이상 레지스트리에 없음. 테스트/문서용. */
export const REMOVED_V2_PLACE_TOOLS: ReadonlyMap<string, string> = new Map([
  ["tile_paint", "fill_region"],
  ["tile_road", "paint_road"],
  ["tile_scatter", "place_props"],
  ["tile_structure", "stamp_object"],
  ["stamp_structure_kit", "stamp_object"],
]);
