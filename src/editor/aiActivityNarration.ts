export type AiActivityPhase = "plan" | "execute" | "review";

export interface AiActivityNarrationInput {
  readonly toolName: string;
  readonly args?: Record<string, unknown>;
  readonly phase?: AiActivityPhase;
  readonly done?: boolean;
  readonly ok?: boolean;
  readonly summary?: string;
  readonly mapName?: string;
}

export interface AiActivityNarration {
  readonly action: string;
  readonly target: string;
  readonly line: string;
}

interface ActionForms {
  readonly running: string;
  readonly done: string;
  readonly failed: string;
}

const forms = (running: string, done: string, failed: string): ActionForms => ({ running, done, failed });

const ACTIONS = {
  work: forms("작업을 진행하는 중", "작업을 마쳤어요", "작업을 마치지 못했어요"),
  inspect: forms("정보를 살펴보는 중", "정보를 살펴봤어요", "정보를 살펴보지 못했어요"),
  inspectMap: forms("맵을 살펴보는 중", "맵을 살펴봤어요", "맵을 살펴보지 못했어요"),
  inspectTile: forms("타일을 살펴보는 중", "타일을 살펴봤어요", "타일을 살펴보지 못했어요"),
  inspectEvent: forms("이벤트를 살펴보는 중", "이벤트를 살펴봤어요", "이벤트를 살펴보지 못했어요"),
  inspectVillage: forms("마을을 살펴보는 중", "마을을 살펴봤어요", "마을을 살펴보지 못했어요"),
  inspectQuality: forms("완성도를 점검하는 중", "완성도를 점검했어요", "완성도를 점검하지 못했어요"),
  inspectQuest: forms("퀘스트를 점검하는 중", "퀘스트를 점검했어요", "퀘스트를 점검하지 못했어요"),
  road: forms("길을 그리는 중", "길을 그렸어요", "길 그리기를 실패했어요"),
  paint: forms("타일을 칠하는 중", "타일을 칠했어요", "타일 칠하기를 실패했어요"),
  fill: forms("영역을 채우는 중", "영역을 채웠어요", "영역 채우기를 실패했어요"),
  erase: forms("영역을 지우는 중", "영역을 지웠어요", "영역 지우기를 실패했어요"),
  // 파괴 규모가 큰 툴은 「영역」「정리」「조정」 같은 부드러운 말로 숨기지 않는다.
  wipeMap: forms("맵 전체를 지우는 중", "맵 전체를 지웠어요", "맵 전체 지우기를 실패했어요"),
  resetProject: forms("프로젝트를 초기화하는 중", "프로젝트를 초기화했어요", "프로젝트 초기화를 실패했어요"),
  deleteResource: forms("리소스를 지우는 중", "리소스를 지웠어요", "리소스 지우기를 실패했어요"),
  scatter: forms("오브젝트를 흩어 놓는 중", "오브젝트를 흩어 놓았어요", "오브젝트 배치를 실패했어요"),
  structure: forms("구조물을 만드는 중", "구조물을 만들었어요", "구조물 만들기를 실패했어요"),
  house: forms("집을 만드는 중", "집을 만들었어요", "집 만들기를 실패했어요"),
  village: forms("마을을 만드는 중", "마을을 만들었어요", "마을 만들기를 실패했어요"),
  person: forms("사람을 만드는 중", "사람을 만들었어요", "사람 만들기를 실패했어요"),
  event: forms("이벤트를 만드는 중", "이벤트를 만들었어요", "이벤트 만들기를 실패했어요"),
  deleteEvent: forms("이벤트를 지우는 중", "이벤트를 지웠어요", "이벤트 지우기를 실패했어요"),
  database: forms("데이터를 정리하는 중", "데이터를 정리했어요", "데이터 정리를 실패했어요"),
  deleteDatabase: forms("데이터를 지우는 중", "데이터를 지웠어요", "데이터 지우기를 실패했어요"),
  createMap: forms("맵을 만드는 중", "맵을 만들었어요", "맵 만들기를 실패했어요"),
  resizeMap: forms("맵 크기를 바꾸는 중", "맵 크기를 바꿨어요", "맵 크기 바꾸기를 실패했어요"),
  deleteMap: forms("맵을 지우는 중", "맵을 지웠어요", "맵 지우기를 실패했어요"),
  editMap: forms("맵을 다듬는 중", "맵을 다듬었어요", "맵 다듬기를 실패했어요"),
  validate: forms("문제를 점검하는 중", "문제를 점검했어요", "문제를 점검하지 못했어요"),
  document: forms("문서를 작성하는 중", "문서를 작성했어요", "문서 작성을 실패했어요"),
  plan: forms("계획을 세우는 중", "계획을 세웠어요", "계획 세우기를 실패했어요"),
  configure: forms("설정을 조정하는 중", "설정을 조정했어요", "설정 조정을 실패했어요"),
  quest: forms("퀘스트를 만드는 중", "퀘스트를 만들었어요", "퀘스트 만들기를 실패했어요"),
  story: forms("이야기를 구성하는 중", "이야기를 구성했어요", "이야기 구성을 실패했어요"),
  battle: forms("전투를 구성하는 중", "전투를 구성했어요", "전투 구성을 실패했어요"),
  world: forms("월드를 구성하는 중", "월드를 구성했어요", "월드 구성을 실패했어요"),
  resource: forms("리소스를 정리하는 중", "리소스를 정리했어요", "리소스 정리를 실패했어요"),
  appearance: forms("외형 그림 후보를 요청하는 중", "외형 그림 후보를 요청했어요", "외형 그림 후보를 요청하지 못했어요"),
  // 이 묶음에 든 툴은 파일을 만들지 않는다 — 「내보냈어요」는 거짓 완료 보고였다(2026-09-17 실측).
  export: forms("내보내기 준비를 점검하는 중", "내보낼 준비를 점검했어요", "내보내기 점검을 마치지 못했어요"),
  play: forms("게임을 시험하는 중", "게임을 시험했어요", "게임 시험을 실패했어요"),
  history: forms("편집 내용을 되돌리는 중", "편집 내용을 되돌렸어요", "편집 내용 되돌리기를 실패했어요"),
  focusView: forms("화면을 옮기는 중", "화면을 옮겼어요", "화면을 옮기지 못했어요"),
  opening: forms("오프닝을 만드는 중", "오프닝을 만들었어요", "오프닝 만들기를 실패했어요"),
  removeOpening: forms("오프닝을 지우는 중", "오프닝을 지웠어요", "오프닝 지우기를 실패했어요"),
  openingImage: forms("오프닝 그림을 만드는 중", "오프닝 그림을 만들었어요", "오프닝 그림 만들기를 실패했어요"),
} as const;

const READ_ONLY_MAP = new Set([
  "get_map_region", "get_project_summary", "show_map_region", "highlight_map_region",
  "find_layout_regions", "check_reachability", "analyze_map_tile_usage",
  "survey_layout_adoption", "read_region_reference",
]);
const READ_ONLY_TILE = new Set([
  "tile_query", "query_tiles", "get_tile_info", "find_similar_tiles", "find_unclassified_tiles",
  "list_unclassified_tiles", "render_group_sample", "show_tile_grid", "show_tiles",
  "suggest_group_from_range", "list_structure_kits",
]);
const READ_ONLY_EVENT = new Set([
  "find_events", "get_event", "find_switch_usage", "find_flag_usage", "explain_event",
  "list_npc_graphics", "get_story_state",
]);
const READ_ONLY_VILLAGE = new Set([
  "critique_village", "evaluate_village_layer", "evaluate_village_look", "get_village_session",
  "list_village_tree_assets", "look_at_houses",
]);
const READ_ONLY_QUALITY = new Set([
  "evaluate_game_quality", "evaluate_dungeon_room", "evaluate_interior_room", "run_lint",
  "lint_world", "analyze_map_tile_usage",
]);
const READ_ONLY_QUEST = new Set(["lint_quest", "verify_quest"]);

const FAMILY_BY_TOOL = new Map<string, ActionForms>();

function addFamily(action: ActionForms, names: string): void {
  for (const name of names.split(" ")) FAMILY_BY_TOOL.set(name, action);
}

addFamily(ACTIONS.road, "paint_road lay_path");
addFamily(ACTIONS.paint, "paint_tiles set_tile_grafts set_tile_metadata set_tile_rules set_group_overlay set_group_junction set_animation_strips");
addFamily(ACTIONS.fill, "fill_region arrange_rows mirror_region copy_map_region import_region_reference");
addFamily(ACTIONS.erase, "tile_erase clear_region");
addFamily(ACTIONS.wipeMap, "clear_map");
addFamily(ACTIONS.resetProject, "reset_project");
addFamily(ACTIONS.scatter, "scatter_object plant_tree_clusters place_props");
addFamily(ACTIONS.structure, "stamp_structure stamp_object build_wall build_roof place_door place_window build_castle register_structure_kit");
addFamily(ACTIONS.house, "author_house build_house preview_house furnish_interior_space make_gallery_room place_concept apply_spatial_build upsert_spatial_design edit_spatial_occurrence");
addFamily(ACTIONS.village, "author_village build_village plan_village materialize_village_spec revise_village_plan run_village_pipeline start_village_session advance_village_build run_village_session");
addFamily(ACTIONS.person, "place_npc make_villager author_npc_cast upsert_actor upsert_character_profile add_companion set_npc_schedule configure_companion_rules");
addFamily(ACTIONS.event, "upsert_event duplicate_event move_event create_transfer_pair place_battle_blocker place_trap place_chest place_storage_chest place_savepoint place_examine_hotspots compile_puzzle make_chase_scene configure_object_behavior script_cutscene script_cutscene_preset upsert_common_event upsert_troop_battle_page author_boss_phases");
addFamily(ACTIONS.deleteEvent, "remove_event delete_troop_battle_page");
addFamily(ACTIONS.database, "duplicate_database_record upsert_database_utility upsert_item upsert_enemy upsert_troop define_monster_species define_crop set_type_chart give_starter_monsters upsert_skill upsert_equipment upsert_class define_promotion upsert_state set_session_start set_title_screen upsert_battle_animation upsert_craft_recipe upsert_item_upgrade upsert_tool_action upsert_life_skill upsert_life_system upsert_fish_species upsert_farm_building_type upsert_home_decoration_type upsert_farm_animal_building define_ending set_shop_stock set_sell_prices");
addFamily(ACTIONS.deleteDatabase, "delete_database_record delete_craft_recipe delete_fish_species");
addFamily(ACTIONS.createMap, "create_map duplicate_map generate_map");
addFamily(ACTIONS.resizeMap, "resize_map");
addFamily(ACTIONS.deleteMap, "remove_map");
addFamily(ACTIONS.editMap, "manage_map_tree set_map_properties shift_map set_start_position set_tile_passability set_encounter_table author_wild_route arrange_tall_grass create_farm_plot make_hunting_ground remove_field_spawn configure_roguelike_room upsert_map_connection delete_map_connection link_maps adopt_layout_regions create_map_location delete_map_location update_map_location resolve_map_location");
addFamily(ACTIONS.validate, "lint_world lint_quest run_lint verify_quest evaluate_game_quality evaluate_dungeon_room evaluate_interior_room evaluate_village_layer evaluate_village_look critique_village");
addFamily(ACTIONS.document, "present_doc upsert_village_document delete_village_document generate_walkthrough");
addFamily(ACTIONS.plan, "plan_world propose_tile_vocabulary");
addFamily(ACTIONS.quest, "create_quest create_quest_flags define_quest declare_story_flag define_ending");
addFamily(ACTIONS.story, "author_story_arc make_horror_loop set_life_flower script_cutscene script_cutscene_preset");
addFamily(ACTIONS.battle, "set_action_combat make_action_enemy set_factions simulate_battle tune_enemy author_boss_phases");
addFamily(ACTIONS.world, "build_world link_maps author_world_bridge author_world_mountain");
addFamily(ACTIONS.deleteResource, "delete_resource delete_resource_profile delete_autotile_group delete_tile_group");
addFamily(ACTIONS.resource, "upsert_resource upsert_resource_profile create_tileset set_tileset_properties upsert_autotile_group upsert_palette_preset upsert_tile_group set_audio_description");
addFamily(ACTIONS.appearance, "generate_character_appearance");
addFamily(ACTIONS.export, "export_game check_export_readiness");
addFamily(ACTIONS.play, "play_walkthrough run_scene_test run_action_combat_test");
addFamily(ACTIONS.history, "revert_last_edit");
addFamily(ACTIONS.focusView, "focus_editor_view");
addFamily(ACTIONS.opening, "set_opening edit_opening");
addFamily(ACTIONS.openingImage, "generate_opening_image");
addFamily(ACTIONS.removeOpening, "remove_opening");

function readOnlyAction(toolName: string): ActionForms | undefined {
  if (READ_ONLY_MAP.has(toolName)) return ACTIONS.inspectMap;
  if (READ_ONLY_TILE.has(toolName)) return ACTIONS.inspectTile;
  if (READ_ONLY_EVENT.has(toolName)) return ACTIONS.inspectEvent;
  if (READ_ONLY_VILLAGE.has(toolName)) return ACTIONS.inspectVillage;
  if (READ_ONLY_QUALITY.has(toolName)) return ACTIONS.inspectQuality;
  if (READ_ONLY_QUEST.has(toolName)) return ACTIONS.inspectQuest;
  // `check_` 로 시작하므로 아래 일반 규칙이 먼저 삼킨다 — 내보내기 점검은 「정보를 살펴봤어요」가 아니다.
  if (toolName === "check_export_readiness" || toolName === "export_game") return ACTIONS.export;
  if (/^(?:get|read|list|show|query|analyze|find|suggest|preview|render|explain|check|evaluate)_/.test(toolName)) {
    return ACTIONS.inspect;
  }
  if (/^(?:lint)_/.test(toolName) || toolName === "tile_query" || toolName === "run_lint") {
    return ACTIONS.validate;
  }
  return undefined;
}

function fallbackAction(toolName: string): ActionForms {
  if (/^(?:create|duplicate|resize|remove|shift|manage)_map(?:_|$)/.test(toolName)) return ACTIONS.editMap;
  if (/^(?:upsert|define|duplicate)_/.test(toolName)) return ACTIONS.database;
  if (/^(?:delete|remove|prune)_/.test(toolName)) return ACTIONS.deleteDatabase;
  if (/^(?:plan|propose|revise)_/.test(toolName)) return ACTIONS.plan;
  if (/^(?:author|script|declare)_/.test(toolName)) return ACTIONS.story;
  if (/^(?:configure|set|manage|tune|rename|reset)_/.test(toolName)) return ACTIONS.configure;
  if (/^(?:build|make|materialize|furnish|stamp|place|arrange|compile)_/.test(toolName)) return ACTIONS.structure;
  if (/^(?:paint|fill|lay|scatter|plant|clear|mirror|copy)_/.test(toolName)) return ACTIONS.paint;
  if (/^(?:start|advance|run|give|add|register|link|move)_/.test(toolName)) return ACTIONS.work;
  if (/^(?:export)_/.test(toolName)) return ACTIONS.export;
  if (/^(?:play|simulate)_/.test(toolName)) return ACTIONS.play;
  if (/^(?:present|generate)_/.test(toolName)) return ACTIONS.document;
  return ACTIONS.work;
}

export type AiActivityFamilySource = "read-only" | "mapped" | "fallback" | "generic";

export function aiActivityFamilySource(toolName: string): AiActivityFamilySource {
  if (readOnlyAction(toolName)) return "read-only";
  if (FAMILY_BY_TOOL.has(toolName)) return "mapped";
  return fallbackAction(toolName) === ACTIONS.work ? "generic" : "fallback";
}

function actionForms(toolName: string): ActionForms {
  return readOnlyAction(toolName) ?? FAMILY_BY_TOOL.get(toolName) ?? fallbackAction(toolName);
}

export function aiActivityActionLabel(toolName: string, done = false): string {
  const action = actionForms(toolName);
  return done ? action.done : action.running;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function targetLabel(input: AiActivityNarrationInput): string {
  const args = input.args;
  const nestedRegion = args?.region;
  const region = nestedRegion && typeof nestedRegion === "object" && !Array.isArray(nestedRegion)
    ? nestedRegion as Record<string, unknown>
    : args;
  const x = finiteNumber(region?.x);
  const y = finiteNumber(region?.y);
  const width = finiteNumber(region?.width) ?? finiteNumber(region?.w);
  const height = finiteNumber(region?.height) ?? finiteNumber(region?.h);
  const coordinate = x === undefined || y === undefined ? "" : `(${x},${y})`;
  const size = coordinate && width !== undefined && height !== undefined ? `${width}×${height}` : "";
  const argsMapName = typeof args?.mapName === "string" ? args.mapName.trim() : "";
  return [input.mapName?.trim() || argsMapName, coordinate, size].filter((part): part is string => Boolean(part)).join(" ");
}

export function narrateAiActivity(input: AiActivityNarrationInput): AiActivityNarration {
  const actionSet = actionForms(input.toolName);
  const summary = input.summary?.trim();
  const action = input.done
    ? input.ok === false
      ? actionSet.failed
      : summary || actionSet.done
    : actionSet.running;
  const target = targetLabel(input);
  return {
    action,
    target,
    line: target ? `${action} — ${target}` : action,
  };
}
