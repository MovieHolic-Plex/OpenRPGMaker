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
  upsert_item: build("아이템 수정", "box"),
  upsert_equipment: build("장비 수정", "box"),
  upsert_enemy: people("몬스터 수정", "user"),
  upsert_actor: people("캐릭터 수정", "user"),
  upsert_skill: build("스킬 수정", "spark"),
  list_monster_resources: inspect("몬스터 소재 찾기"),
  get_monster_resource: inspect("몬스터 소재 확인"),
  list_resources: inspect("소재 찾기"),
  list_npc_graphics: inspect("NPC 모습 찾기"),
  // ── 짓기 ──
  author_house: build("집 짓기", "house"),
  build_house: build("집 세우기", "house"),
  build_castle: build("성 짓기", "house"),
  build_wall: build("벽 쌓기", "wall"),
  repair_fence: build("울타리 손보기", "wall"),
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
  move_region: build("영역 옮기기", "grid"),
  shift_map: build("맵 밀기", "grid"),
  generate_map: build("맵 만들기", "map"),
  create_map: build("새 맵", "map"),
  ask_tileset_change: inspect("타일 느낌 바꿀지 묻기", "grid"),
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
  script_cutscene_impact: people("충돌 연출", "book"),
  script_cutscene_staged: people("연출 짜기", "book"),
  generate_cutscene_art: build("컷신 그림 만들기", "spark"),
  preview_cutscene: inspect("컷신 미리보기", "eye"),
  upsert_event: people("이벤트 쓰기", "flag"),
  event_command_assist: people("이벤트 명령 만들기", "flag"),
  move_event: people("이벤트 옮기기", "flag"),
  remove_event: people("이벤트 삭제", "flag"),
  duplicate_event: people("이벤트 복제", "flag"),
  link_maps: people("맵 연결", "link"),
  create_transfer_pair: people("맵 연결", "link"),
  create_time_gate: people("시간의 문 잇기", "link"),
  place_vehicle: build("탈것 세우기", "map"),
  // ── 보기·검사 ──
  // 웹 검색은 프로젝트 조회가 아니라 바깥 검색이다 — inspect(도구 그룹·돋보기 아이콘)으로 둔다.
  // 사전에 없으면 영문 원문이 그대로 보인다(2026-09-21 실측).
  web_search: inspect("웹 검색"),
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
  check_city_form: inspect("도시 형태 검사", "shield"),
  run_lint: inspect("맵 검사", "shield"),
  lint_quest: inspect("퀘스트 검사", "shield"),
  lint_world: inspect("세계 검사", "shield"),
  // "완성도 평가" 아님 — 이 툴은 재미·독창성·페이싱을 채점하지 않고 참조·빈 맵·미호출 엔딩만 본다.
  // 게이트도 아니어서(자문 계약, agentVerification.ts) 방패 대신 돋보기를 쓴다.
  evaluate_game_quality: inspect("무결성 점검"),
  run_action_combat_test: inspect("액션 전투 검증", "shield"),
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
  set_action_combat: system("액션 전투 설정"),
  make_action_enemy: people("액션 적 배치", "user"),
  revert_last_edit: system("마지막 편집 되돌리기", "undo"),
  reset_project: system("프로젝트 초기화"),
  // 「게임 내보내기」는 파일이 생긴다는 뜻으로 읽힌다 — 이 툴은 점검만 한다(exportTools.ts 주석).
  export_game: system("내보내기 점검", "export"),
  check_export_readiness: system("내보내기 점검", "export"),
  // ── 2026-09-23: 사전에 없던 160개. 설명문 첫 문장을 짧은 명사구로 옮겼다 — 영문 원문
  // (「read tileset reference」)이 작업 과정에 그대로 보였다. ──
  read_project_wiki: inspect("설정집 읽기", "book"),
  set_world_canon: world("세계관 정하기", "book"),
  set_party: system("파티 구성"),
  get_world_structure_rules: inspect("월드 지형 규칙 읽기", "map"),
  author_world_bridge: world("다리 놓기", "road"),
  author_world_mountain: world("산 쌓기", "map"),
  read_region_reference: inspect("지역 예시 읽기", "map"),
  import_region_reference: build("등록 장소 가져오기", "map"),
  stamp_object: build("공용 오브젝트 찍기", "map"),
  list_spatial_designs: inspect("공간 설계 찾기", "map"),
  get_geography_vocabulary: inspect("지형 어휘 읽기", "map"),
  get_spatial_design: inspect("공간 설계 읽기", "map"),
  upsert_spatial_design: world("공간 설계", "map"),
  preview_spatial_build: inspect("공간 시공 미리보기", "eye"),
  apply_spatial_build: world("공간 시공", "map"),
  edit_spatial_occurrence: world("시공한 공간 고치기", "map"),
  build_roof: build("지붕 얹기", "house"),
  place_window: build("창문 달기", "house"),
  lay_path: build("길 깔기", "road"),
  arrange_rows: build("줄 맞춰 놓기", "box"),
  tile_erase: build("타일 지우기", "grid"),
  evaluate_village_look: inspect("마을 모양 평가", "shield"),
  critique_village: inspect("마을 점검", "shield"),
  list_village_tree_assets: inspect("나무 목록", "tree"),
  get_village_session: inspect("마을 시공 상태", "list"),
  evaluate_village_layer: inspect("마을 단계 점검", "shield"),
  start_interior_room_session: build("실내 시공 시작", "house"),
  advance_interior_room_build: build("실내 다음 단계", "house"),
  run_interior_room_pipeline: build("실내 한 번에 짓기", "house"),
  evaluate_interior_room: inspect("실내 평가", "shield"),
  list_interior_room_demos: inspect("실내 예시 목록", "house"),
  list_interior_room_sessions: inspect("실내 시공 목록", "house"),
  get_concept_facility: inspect("시설 틀 읽기", "house"),
  start_dungeon_room_session: build("던전 시공 시작", "map"),
  advance_dungeon_room_build: build("던전 다음 단계", "map"),
  run_dungeon_room_pipeline: build("던전 한 번에 짓기", "map"),
  author_wild_route: build("도로·풀숲 짓기", "map"),
  arrange_tall_grass: build("키큰 풀 깔기", "map"),
  evaluate_dungeon_room: inspect("던전 평가", "shield"),
  list_dungeon_room_themes: inspect("던전 테마 목록", "map"),
  list_structure_kits: inspect("구조 킷 목록", "box"),
  register_structure_kit: build("구조 킷 등록", "box"),
  preview_house: inspect("집 미리보기", "house"),
  clear_map: build("맵 전체 비우기", "grid"),
  set_tile_passability: build("타일 통행 설정", "grid"),
  set_encounter_table: world("인카운터 설정", "flag"),
  make_hunting_ground: people("사냥터 만들기", "user"),
  configure_roguelike_room: world("로그라이크 방 설정", "map"),
  create_farm_plot: build("밭 구역 정하기", "grid"),
  list_map_locations: inspect("구역 목록", "pin"),
  resolve_map_location: inspect("구역 찾기", "pin"),
  create_map_location: world("구역 만들기", "pin"),
  update_map_location: world("구역 고치기", "pin"),
  delete_map_location: world("구역 삭제", "pin"),
  survey_layout_adoption: inspect("설계 구역 살펴보기", "selection"),
  adopt_layout_regions: world("설계 구역 옮기기", "selection"),
  remove_field_spawn: people("필드 적 삭제", "user"),
  set_factions: world("진영 정하기", "flag"),
  place_battle_blocker: people("전투 블로커 놓기", "user"),
  make_chase_scene: people("추격 장면 만들기", "user"),
  configure_object_behavior: people("오브젝트 동작 설정", "box"),
  author_npc_cast: people("주민 대사 쓰기", "user"),
  configure_companion_rules: people("동료 규칙", "user"),
  place_examine_hotspots: people("조사 지점 놓기", "search"),
  compile_puzzle: people("퍼즐 만들기", "spark"),
  make_horror_loop: people("호러 루프 만들기", "flag"),
  set_life_flower: people("꽃잎 체력 만들기", "flag"),
  make_gallery_room: people("조사 방 만들기", "search"),
  set_lighting_volume: world("조명 설정", "spark"),
  set_scene_mood: world("분위기 설정", "spark"),
  list_endings: inspect("엔딩 목록", "flag"),
  duplicate_database_record: system("DB 항목 복제"),
  delete_database_record: system("DB 항목 삭제"),
  upsert_database_utility: system("DB 속성 편집"),
  upsert_troop: people("적 그룹 편집", "user"),
  define_monster_species: people("몬스터 종 정의", "user"),
  define_crop: build("작물 정의", "tree"),
  set_type_chart: system("상성표 설정"),
  give_starter_monsters: people("스타팅 몬스터", "user"),
  upsert_class: people("직업 편집", "user"),
  define_promotion: people("승급 조건", "user"),
  upsert_state: system("상태이상 편집"),
  upsert_common_event: people("공통 이벤트 쓰기", "flag"),
  upsert_battle_animation: system("전투 애니메이션 편집"),
  set_session_start: system("시작 상태 설정"),
  upsert_life_skill: system("생활 스킬 편집"),
  upsert_life_system: system("생활 시스템 설정"),
  upsert_craft_recipe: build("제작 레시피 편집", "box"),
  delete_craft_recipe: build("제작 레시피 삭제", "box"),
  upsert_item_upgrade: build("아이템 강화 규칙", "box"),
  upsert_tool_action: system("도구 행동 규칙"),
  configure_life_economy: system("생활·경제 설정"),
  upsert_fish_species: build("어종 편집", "box"),
  delete_fish_species: build("어종 삭제", "box"),
  configure_fishing: system("낚시 설정"),
  configure_seasonal_forage: system("계절 채집 설정"),
  configure_museum: system("박물관 설정"),
  configure_collections: system("도감 설정"),
  upsert_farm_building_type: build("농장 건물 유형", "house"),
  upsert_home_decoration_type: build("집 장식 유형", "box"),
  upsert_farm_animal_building: build("축사 배치", "house"),
  set_session_farm_state: system("시작 농장 상태"),
  create_tileset: system("타일셋 만들기"),
  set_tileset_properties: system("타일셋 속성"),
  upsert_autotile_group: system("오토타일 편집"),
  delete_autotile_group: system("오토타일 삭제"),
  set_animation_strips: system("애니메이션 타일 설정"),
  set_tile_grafts: system("타일 이식"),
  list_tileset_references: inspect("타일셋 참고 목록", "book"),
  read_tileset_reference: inspect("타일셋 참고 읽기", "book"),
  read_spatial_reference: inspect("공간 참고 읽기", "book"),
  get_tile_assembly_part: inspect("조립 부품 읽기", "grid"),
  preview_forest_strip: inspect("숲 띠 미리보기", "tree"),
  validate_tile_assembly: inspect("조립 검사", "shield"),
  inspect_interior_layout: inspect("실내 배치 검사", "shield"),
  inspect_forest_recipe: inspect("숲 조립 살펴보기", "tree"),
  stamp_forest_recipe: build("숲 조립", "tree"),
  inspect_tile_recipe: inspect("조립법 살펴보기", "grid"),
  stamp_tile_recipe: build("조립법 찍기", "house"),
  validate_tile_recipes: inspect("조립법 검사", "shield"),
  upsert_map_connection: world("맵 연결 편집", "link"),
  delete_map_connection: world("맵 연결 삭제", "link"),
  upsert_village_document: world("마을 문서 쓰기", "book"),
  delete_village_document: world("마을 문서 삭제", "book"),
  upsert_resource_profile: system("소재 치수 편집"),
  delete_resource_profile: system("소재 치수 삭제"),
  upsert_character_profile: people("인물 프로필 편집", "user"),
  delete_character_profile: people("인물 프로필 삭제", "user"),
  upsert_test_preset: system("테스트 프리셋 편집"),
  delete_test_preset: system("테스트 프리셋 삭제"),
  manage_flag_slot: system("스위치·변수 슬롯"),
  get_audio_resource: inspect("소리 소재 읽기"),
  recommend_bgm: inspect("배경음 고르기"),
  set_audio_description: system("소리 설명 편집"),
  upsert_resource: system("소재 등록"),
  delete_resource: system("소재 삭제"),
  generate_walkthrough: inspect("공략 순서 만들기", "list"),
  verify_quest: inspect("퀘스트 검증", "shield"),
  declare_story_flag: people("이야기 깃발 등록", "flag"),
  find_flag_usage: inspect("깃발 사용처 찾기", "flag"),
  simulate_battle: inspect("전투 시뮬레이션", "shield"),
  tune_enemy: people("적 능력치 조정", "user"),
  author_boss_phases: people("보스 페이즈", "user"),
  upsert_troop_battle_page: people("전투 이벤트 편집", "flag"),
  delete_troop_battle_page: people("전투 이벤트 삭제", "flag"),
  rename_switch: system("스위치 번호 바꾸기"),
  rename_variable: system("변수 번호 바꾸기"),
  prune_unused: system("안 쓰는 항목 정리"),
  configure_time_system: system("시간 시스템"),
  configure_monster_system: system("몬스터 수집 시스템"),
  get_opening: inspect("오프닝 읽기", "book"),
  set_opening: system("오프닝 설정"),
  edit_opening: system("오프닝 장면 고치기"),
  remove_opening: system("오프닝 삭제"),
  list_opening_media: inspect("오프닝 소재 목록"),
  generate_opening_image: build("오프닝 그림 만들기", "spark"),
  get_game_over: inspect("게임오버 읽기"),
  set_game_over: system("게임오버 화면"),
  generate_game_over_image: build("게임오버 그림 만들기", "spark"),
  generate_image_asset: build("그림 만들기", "spark"),
  generate_title_art: build("타이틀 아트 만들기", "spark"),
  improve_title_screen: system("타이틀 단계 개선"),
  play_walkthrough: inspect("명령 흐름 검사", "shield"),
  run_scene_test: inspect("장면 검사", "shield"),
  find_switch_usage: inspect("스위치 사용처 찾기", "flag"),
  list_project_commits: inspect("변경 이력", "scroll"),
  present_doc: system("설명 문서 쓰기", "book"),
  list_ai_docs: inspect("AI 문서 목록", "book"),
  list_retro_choreographies: inspect("도트 연출 찾기", "spark"),
  read_retro_skill_guide: inspect("스킬 설계 지침 읽기", "book"),
  read_ai_doc: inspect("AI 문서 읽기", "book"),
  generate_character_appearance: build("캐릭터 그림 만들기", "user"),
};

const READ_PREFIXES = ["get_", "show_", "find_", "list_", "query_", "check_", "lint_", "evaluate_", "explain_", "analyze_", "look_"] as const;

/** 사전에 없으면 밑줄만 공백으로 푼다. 새 툴은 사전에 넣는다 — test/aiToolLabels.coverage 가 빠진 이름을 잡는다. */
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

/**
 * 「간단히 보기」(기본값)의 도구 한 줄 — 처음 온 비개발자에게 보여 줄 말.
 *
 * 2026-09-23 실측: 기본 표시에서 `consult writer · 실행 중`·`DB 읽기`·`타일셋 참고 읽기`·
 * `도구 찾기 · 2건 확인·처리` 가 그대로 보였다. 영문 도구 이름은 풀어 쓰고, 읽기 도구는 하나로 묶고,
 * 건수는 빼며, 사전 라벨에 영문이 섞이면 묶음 말로 바꾼다. 자세히 보기는 `toolLabel` 을 그대로 쓴다.
 */
const BRIEF_TOOL_PHRASES: Readonly<Record<string, readonly [doing: string, done: string]>> = {
  consult_writer: ["대사 쓰는 중", "대사 쓰기 완료"],
  find_tools: ["생각하는 중", "생각 정리 완료"],
};
const BRIEF_GROUP_PHRASES: Readonly<Record<ToolGroup, readonly [doing: string, done: string]>> = {
  inspect: ["프로젝트 살펴보는 중", "프로젝트 살펴보기 완료"],
  build: ["만드는 중", "만들기 완료"],
  people: ["인물 만드는 중", "인물 만들기 완료"],
  world: ["세계 꾸미는 중", "세계 꾸미기 완료"],
  system: ["게임 설정 손보는 중", "게임 설정 완료"],
};

/** `running` 이면 하는 중, 아니면 끝난 말. 실패 표기는 부르는 쪽이 정한다(간단히 보기는 회복한 실패를 숨긴다). */
export function toolBriefLabel(name: string, running: boolean): string {
  const pick = (pair: readonly [string, string]): string => (running ? pair[0] : pair[1]);
  const fixed = BRIEF_TOOL_PHRASES[name];
  if (fixed) return pick(fixed);
  const group = toolGroup(name);
  const label = TOOL_LABELS[name]?.label;
  // 읽기는 무엇을 읽든 사용자에게는 같은 일이다 — 「DB 읽기」·「타일셋 참고 읽기」를 따로 세우지 않는다.
  if (group === "inspect" || !label || /[A-Za-z]/u.test(label)) return pick(BRIEF_GROUP_PHRASES[group]);
  return `${label} · ${running ? "진행 중" : "완료"}`;
}
