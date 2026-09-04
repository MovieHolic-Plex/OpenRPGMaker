// editor/panels/aiToolLabels.ts
// 툴 이름(snake_case) → 사람이 읽는 한국어 라벨·아이콘·묶음. 작업 타임라인·스튜디오 도구 덱이 함께 쓴다.
//
// 왜 한 모듈인가: 스튜디오 카드(TOOL_SHORT)와 로그 행이 따로 이름을 갖고 있으면 같은 툴이 화면마다
// 다른 이름으로 불린다. 라벨은 "무엇을 한다" 로 끝나는 짧은 명사구 하나로 통일한다.
// 사전에 없는 툴은 지어내지 않고 밑줄만 공백으로 푼다 — 틀린 번역보다 원문이 낫다.

import type { DeckIconName } from "./aiDeckIcons";

export const TOOL_GROUPS = ["build", "people", "inspect", "world", "system"] as const;
export type ToolGroup = (typeof TOOL_GROUPS)[number];

export interface ToolLabelEntry {
  readonly label: string;
  readonly icon: DeckIconName;
  readonly group: ToolGroup;
}

const build = (label: string, icon: DeckIconName): ToolLabelEntry => ({ label, icon, group: "build" });
const people = (label: string, icon: DeckIconName): ToolLabelEntry => ({ label, icon, group: "people" });
const inspect = (label: string, icon: DeckIconName = "search"): ToolLabelEntry => ({ label, icon, group: "inspect" });
const world = (label: string, icon: DeckIconName): ToolLabelEntry => ({ label, icon, group: "world" });
const system = (label: string, icon: DeckIconName = "gear"): ToolLabelEntry => ({ label, icon, group: "system" });

export const TOOL_LABELS: Readonly<Record<string, ToolLabelEntry>> = {
  // ── 짓기 ──
  author_house: build("집 짓기", "house"),
  build_house: build("집 세우기", "house"),
  build_castle: build("성 짓기", "house"),
  build_wall: build("벽 쌓기", "wall"),
  paint_road: build("길 놓기", "road"),
  paint_tiles: build("타일 칠하기", "grid"),
  fill_region: build("영역 채우기", "grid"),
  clear_region: build("영역 비우기", "grid"),
  place_props: build("소품 놓기", "box"),
  place_door: build("문 달기", "door"),
  place_chest: build("상자 놓기", "box"),
  place_storage_chest: build("보관 상자 놓기", "box"),
  place_savepoint: build("세이브 지점 놓기", "flag"),
  place_trap: build("함정 놓기", "box"),
  place_concept: build("개념 배치", "spark"),
  stamp_structure: build("건물 찍기", "house"),
  furnish_interior_space: build("실내 꾸미기", "box"),
  plant_tree_clusters: build("나무 심기", "tree"),
  scatter_object: build("흩어 놓기", "tree"),
  mirror_region: build("영역 뒤집기", "grid"),
  copy_map_region: build("영역 복사", "grid"),
  shift_map: build("맵 밀기", "grid"),
  generate_map: build("맵 만들기", "map"),
  create_map: build("새 맵", "map"),
  resize_map: build("맵 크기 바꾸기", "map"),
  remove_map: build("맵 삭제", "map"),
  duplicate_map: build("맵 복제", "map"),
  author_village: build("마을 짓기", "house"),
  build_world: world("세계 짓기", "map"),
  set_build_spec: build("밑그림 확정", "list"),
  // ── 사람·이야기 ──
  place_npc: people("NPC 배치", "user"),
  make_villager: people("주민 만들기", "user"),
  add_companion: people("동료 넣기", "user"),
  set_npc_schedule: people("일과 정하기", "clock"),
  set_shop_stock: people("품목 정하기", "shop"),
  set_sell_prices: people("판매가 정하기", "shop"),
  create_quest: people("퀘스트 만들기", "flag"),
  define_quest: people("퀘스트 정의", "flag"),
  create_quest_flags: people("퀘스트 깃발", "flag"),
  author_story_arc: people("이야기 짜기", "book"),
  script_cutscene: people("연출 쓰기", "book"),
  script_cutscene_preset: people("연출 프리셋", "book"),
  upsert_event: people("이벤트 쓰기", "flag"),
  move_event: people("이벤트 옮기기", "flag"),
  remove_event: people("이벤트 삭제", "flag"),
  duplicate_event: people("이벤트 복제", "flag"),
  link_maps: people("맵 연결", "link"),
  create_transfer_pair: people("맵 연결", "link"),
  // ── 보기·검사 ──
  get_project_summary: inspect("프로젝트 읽기"),
  get_map_region: inspect("영역 읽기", "grid"),
  show_map_region: inspect("영역 보기", "eye"),
  highlight_map_region: inspect("영역 표시", "selection"),
  find_layout_regions: inspect("빈 자리 찾기", "selection"),
  find_events: inspect("이벤트 찾기"),
  get_event: inspect("이벤트 읽기"),
  explain_event: inspect("이벤트 설명", "question"),
  tile_query: inspect("타일 보기", "grid"),
  query_tiles: inspect("타일 찾기", "grid"),
  get_tile_info: inspect("타일 정보", "grid"),
  show_tiles: inspect("타일 보기", "grid"),
  show_tile_grid: inspect("타일 격자 보기", "grid"),
  find_similar_tiles: inspect("닮은 타일 찾기", "grid"),
  analyze_map_tile_usage: inspect("타일 사용 분석", "grid"),
  look_at_houses: inspect("집 살펴보기", "eye"),
  check_reachability: inspect("통행 검사", "shield"),
  run_lint: inspect("맵 검사", "shield"),
  lint_quest: inspect("퀘스트 검사", "shield"),
  lint_world: inspect("세계 검사", "shield"),
  evaluate_game_quality: inspect("완성도 평가", "shield"),
  get_story_state: inspect("이야기 상태 읽기", "book"),
  get_database_records: inspect("DB 읽기"),
  list_edit_history: inspect("편집 이력", "scroll"),
  find_tools: inspect("도구 찾기", "wrench"),
  focus_editor_view: inspect("화면 이동", "pin"),
  // ── 세계·시스템 ──
  plan_world: world("세계 계획", "map"),
  manage_map_tree: world("맵 트리 정리", "map"),
  set_map_properties: world("맵 속성", "gear"),
  set_start_position: world("시작 위치", "pin"),
  define_ending: world("엔딩 정의", "flag"),
  set_project_genre: system("장르 정하기"),
  set_project_settings: system("프로젝트 설정"),
  set_title_screen: system("타이틀 화면"),
  configure_game_systems: system("게임 시스템"),
  revert_last_edit: system("마지막 편집 되돌리기", "undo"),
  reset_project: system("프로젝트 초기화"),
  export_game: system("게임 내보내기", "export"),
};

const READ_PREFIXES = ["get_", "show_", "find_", "list_", "query_", "check_", "lint_", "evaluate_", "explain_", "analyze_", "look_"] as const;

/** 사전에 없으면 밑줄만 공백으로 푼다 — 지어낸 번역은 틀린 번역이다. */
export function toolLabel(name: string): string {
  return TOOL_LABELS[name]?.label ?? name.replace(/_/gu, " ");
}

/** 아이콘 키. 사전에 없으면 조회 접두(get/show/find/…)는 search, 나머지는 wrench. */
export function toolIconKey(name: string): DeckIconName {
  const entry = TOOL_LABELS[name];
  if (entry) return entry.icon;
  return READ_PREFIXES.some((prefix) => name.startsWith(prefix)) ? "search" : "wrench";
}

export function toolGroup(name: string): ToolGroup {
  const entry = TOOL_LABELS[name];
  if (entry) return entry.group;
  return READ_PREFIXES.some((prefix) => name.startsWith(prefix)) ? "inspect" : "build";
}

export const TOOL_LABEL_SUMMARY_LIMIT = 4;

/** 작업 그룹 헤더 요약 — 라벨을 화살표로 잇고 넷을 넘으면 줄임표 하나. */
export function toolLabelSummary(names: readonly string[]): string {
  if (names.length === 0) return "";
  const shown = names.slice(0, TOOL_LABEL_SUMMARY_LIMIT).map(toolLabel);
  if (names.length > TOOL_LABEL_SUMMARY_LIMIT) shown.push("…");
  return shown.join(" → ");
}
