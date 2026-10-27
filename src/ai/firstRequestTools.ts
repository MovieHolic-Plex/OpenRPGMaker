// ai/firstRequestTools.ts
// 첫 요청이 늘 싣는 조회·제어 도구 이름. 의존이 없는 잎 모듈이라 노출 조립기(sessionToolExposure)와
// 프롬프트 색인(toolCapabilityIndex)이 같은 목록을 순환 없이 함께 읽는다.

/** Read/control tools that must remain reachable before any search round. */
export const DISCOVERY_CONTROL_TOOL_NAMES: readonly string[] = [
  "find_tools",
  "list_authoring_presets",
  "read_authoring_preset",
  "read_project_wiki",
  "get_project_summary",
  "get_map_region",
  "find_events",
  "get_event",
  "find_layout_regions",
  "get_database_records",
  "list_resources",
  "focus_editor_view",
];
