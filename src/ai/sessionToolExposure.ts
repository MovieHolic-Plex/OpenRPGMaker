// ai/sessionToolExposure.ts
//
// Shared by the Pi chat entry point and the legacy AssistantSession.
// The editor assistant keeps a small control plane in the first request and
// expands it with tools named by intent, the active plan, read contracts and
// discovery results. The complete catalog remains an explicit fallback for
// neutral/failed routing and for a discovery miss. This keeps capability
// reachability without paying for every editor schema on every turn.

import { adventureToolNames, type AdventureRequirements } from "./adventureCompletion";
import { capabilityEscalationSchemas } from "./capabilityEscalation";
import { mentionedToolSchemas, planRequiredToolSchemas, toolSchemasForNames } from "./planToolExposure";
import type { IntentDeclaration } from "./intentDeclaration";
import { toOpenAiTools, type OpenAiTool } from "@/editor/tools";
import type { WorkPlan } from "./workPlan";
import { DEFAULT_COMPACTION_SETTINGS, estimateContextTokens } from "./contextCompaction";

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

export interface SessionToolExposureInput {
  readonly requestText: string;
  readonly intent: IntentDeclaration | null;
  readonly discoveredToolNames?: readonly string[];
  readonly requiredReadTools?: readonly string[];
  readonly workPlan?: WorkPlan | null;
  readonly fullCatalogFallback?: boolean;
  /**
   * 이 요청을 받을 모델의 컨텍스트 창. 주면 전체 카탈로그가 창에 안 들어갈 때 폴백도 좁힌 목록(코어+발견 도구)을 쓴다.
   * 실측(2026-10-02): 전체 카탈로그 약 189,000 토큰 + 예비분 16,384 가 claude·glm(200,000)·미지 모델(128,000) 창을 넘어
   * 폴백 턴이 요청 조립에서 죽었다.
   */
  readonly contextWindow?: number;
  /**
   * 이 이름을 조수에게 보이지 않는다 — 몬스터 자산 역방향 잠금(genreLockMonsterAssets.ts)이 몬스터 프로젝트가 아닌 곳의 포켓몬식 도구를 가린다.
   * 전체 카탈로그 폴백·발견 결과·의도 선언·플랜 노출 어디서 왔든 마지막에 한 번 거른다.
   */
  readonly hideTool?: (toolName: string) => boolean;
}

/** 폴백으로 전체 카탈로그를 보내도 대화가 쓸 자리(약 13,000 토큰)가 남는가. */
const CONVERSATION_FLOOR_TOKENS = 13_000;
let fullCatalogTokenCache: { readonly count: number; readonly tokens: number } | undefined;
export function fullCatalogFitsWindow(full: readonly OpenAiTool[], contextWindow: number): boolean {
  if (fullCatalogTokenCache?.count !== full.length) {
    fullCatalogTokenCache = { count: full.length, tokens: estimateContextTokens([{ role: "system", content: JSON.stringify(full) }]) };
  }
  return fullCatalogTokenCache.tokens + DEFAULT_COMPACTION_SETTINGS.reserveTokens + CONVERSATION_FLOOR_TOKENS <= contextWindow;
}

function appendUnique(target: OpenAiTool[], seen: Set<string>, schemas: readonly OpenAiTool[]): void {
  for (const schema of schemas) {
    const name = schema.function.name;
    if (seen.has(name)) continue;
    seen.add(name);
    target.push(schema);
  }
}

function schemasForIntent(intent: IntentDeclaration | null): OpenAiTool[] {
  if (!intent) return [];
  const names = [
    ...intent.tools,
    ...(intent.adventure ? adventureToolNames(intent.adventure as AdventureRequirements) : []),
  ];
  // 마을 시공 도구를 고른 요청에는 버들항 조립 도구·검사 도구를 함께 보인다 — 선언이 고른 도구 8개 안에 검사 도구가 없으면
  // 모델이 존재를 모른다(2026-10-01). 옛 이름 author_village 를 선언해도 같은 묶음을 보인다(숲마을 시공기는 2026-10-07 삭제).
  if (names.includes("author_village") || names.includes("author_beodeul_town")) {
    names.push("author_beodeul_town", "check_city_form", "check_reachability");
  }
  // 던전 시공 도구를 고른 요청에는 시공 뒤 확인 도구를 함께 보인다(받침·도달은 도구가 스스로 검사하지만 이벤트 배치 뒤 확인이 필요하다).
  if (names.includes("author_dungeon") || names.includes("author_beodeul_dungeon")) names.push("author_dungeon", "link_world_entrance", "check_reachability", "show_map_region", "run_lint");
  // JRPG 한 장 시공기는 여러 맵을 한 번에 짓는다 — 지은 뒤 통행·그림을 확인할 도구를 함께 보인다.
  if (names.includes("author_jrpg_chapter")) names.push("author_jrpg_chapter", "check_reachability", "show_map_region", "run_lint");
  if (names.some(n => ["author_map_puzzle", "list_puzzle_presets", "compile_puzzle"].includes(n))) names.push("list_puzzle_presets", "author_map_puzzle", "compile_puzzle", "check_reachability", "show_map_region", "run_lint");
  // 퀘스트 저작 도구를 고른 요청에는 같은 묶음과 완료 검사 verify_quest 를 함께 보인다 — 프롬프트는 verify_quest 통과를
  // 완료 기준으로 삼으라고 하는데(promptPolicies), 선언이 create_quest 만 고르면 모델이 검사 도구를 모른다.
  if (names.some(n => ["create_quest", "define_quest", "verify_quest"].includes(n))) names.push("define_quest", "create_quest", "verify_quest");
  if (names.includes("stamp_object")) names.push("list_spatial_designs", "show_map_region");
  if (names.some(n => ["place_npc", "make_villager", "upsert_event", "list_npc_graphics"].includes(n))) names.push("place_npc", "list_npc_graphics");
  return toolSchemasForNames(names) as OpenAiTool[];
}

/** 이벤트 요청 속 장소·지형·사물 낱말 — 말한 것이 맵에 없으면 조수가 먼저 지어야 하는 대상. */
export const SCENE_SETTING_PATTERN = /(화산|용암|마그마|독\s*늪|늪지|유적|성소|신전|제단|협곡|다리|동굴|폭포|성검|중세|심판의\s*빛|태양석|검기|결투장|차원의\s*틈)/u;

export const SCENE_SETTING_NOTE = "[무대 필수] 이 요청이 말한 장소·지형·사물이 요청 좌표 주변에 보이지 않으면 이벤트를 만들기 전에 build_scene_setting({mapId,theme,x,y}) 를 한 번 호출해 무대를 짓는다(x,y = 이벤트 칸). theme: 화산·열풍·심판의 빛·폐허 포격 → volcano, 용암 다리·차원 다리·붕괴 → lava_bridge, 독늪·독안개 → poison_swamp, 유적·성소·신전·제단·성검·결투장·태양의 신전 → ruins_shrine. 지은 뒤 show_map_region 으로 그림을 확인한다. 이벤트만 만들고 끝내면 미완성이다. 맵의 나머지는 보존한다.";

/**
 * Build the registry portion of one AssistantSession request.
 *
 * `fullCatalogFallback` is deliberately explicit. A missing declaration or a
 * search miss must never make a real editor capability unreachable; callers can
 * flip it for the next round without changing execution/approval policy.
 */
export function buildSessionRegistryTools(input: SessionToolExposureInput): OpenAiTool[] {
  const tools = buildSessionRegistryToolsUnfiltered(input);
  return input.hideTool ? tools.filter((tool) => !input.hideTool!(tool.function.name)) : tools;
}

function buildSessionRegistryToolsUnfiltered(input: SessionToolExposureInput): OpenAiTool[] {
  if (input.fullCatalogFallback || input.intent === null || input.intent.source === "fallback") {
    const full = toOpenAiTools() as OpenAiTool[];
    // 창이 좁으면 전체를 밀어 넣지 않고 아래 좁힌 목록으로 간다 — 발견 도구가 나머지를 찾아 준다.
    if (input.contextWindow === undefined || fullCatalogFitsWindow(full, input.contextWindow)) return full;
  }

  const tools: OpenAiTool[] = [];
  const seen = new Set<string>();
  const core = toOpenAiTools(undefined, { domains: new Set(["core"]) });
  appendUnique(tools, seen, core);
  appendUnique(tools, seen, toolSchemasForNames(DISCOVERY_CONTROL_TOOL_NAMES) as OpenAiTool[]);
  appendUnique(tools, seen, schemasForIntent(input.intent));
  if (/지도|월드맵|초원|사막|설원|산맥|다리|강.*(?:길|숲)|world.?map|overworld/i.test(input.requestText)) {
    appendUnique(tools, seen, toolSchemasForNames(['fill_region', 'lay_path', 'tile_erase', 'list_tileset_references',
      'read_tileset_reference', 'list_worldmap_icons', 'stamp_worldmap_icon', 'inspect_worldmap_icon', 'show_map_region', 'check_reachability']) as OpenAiTool[]);
  }
  if (/(월드맵|세계\s*지도|지역\s*지도|포켓몬.*(?:도로|지도)|마리오.*(?:맵|지도)|할로우.*지도|스파이어.*지도|world\s*map|overworld)/i.test(input.requestText)) {
    appendUnique(tools, seen, toolSchemasForNames(['list_worldmap_structures', 'read_worldmap_structure_reference', 'author_worldmap_structure', 'inspect_worldmap_structure', 'list_worldmap_themes', 'read_world_terrain', 'edit_world_terrain', 'derive_world_variant', 'link_world_entrance']) as OpenAiTool[]);
  }
  // 이벤트·컷씬 요청이 장소·지형·사물을 말하면 그 무대를 짓는 시공 도구를 처음부터 보인다 — 이벤트 도구만 쥐면 무대 없이 대사만 남는다(2026-10-15 JRPG 파일럿 실측).
  if (SCENE_SETTING_PATTERN.test(input.requestText)) {
    appendUnique(tools, seen, toolSchemasForNames(['build_scene_setting', 'fill_region', 'stamp_object', 'place_props', 'list_spatial_designs', 'get_map_region', 'show_map_region', 'check_reachability', 'list_resources', 'generate_cutscene_art', 'script_cutscene']) as OpenAiTool[]);
  }
  if (/(태양|햇빛|그림자|\bsun(?:light)?\b|\bshadow\b)/i.test(input.requestText)) {
    appendUnique(tools, seen, toolSchemasForNames(["set_map_properties", "inspect_terrain", "show_map_region"]) as OpenAiTool[]);
  }
  // 높이 편집에는 읽기·재편집·통행 검사까지 함께 필요하다. 단어 순위 상한에
  // 걸려 조수가 평면 paint_road로 우회하지 않도록 같은 도구 묶음을 보인다.
  if (/(절벽|경사로|고지|지붕|입체\s*지형|높이\s*지형|높낮이|단차|고도|언덕|구릉|산길|오르막|내리막|계단|평탄화|\bterrain\b|\brelief\b)/i.test(input.requestText)
    || input.intent?.tools.some(name => ["sculpt_relief", "design_terrain", "inspect_terrain", "lay_terrain_road"].includes(name))) {
    appendUnique(tools, seen, toolSchemasForNames(["read_relief", "sculpt_relief", "check_relief", "design_terrain",
      "inspect_terrain", "place_terrain_house", "lay_terrain_road", "place_terrain_ramp", "resize_terrain_house_roof", "check_terrain_access", "show_map_region"]) as OpenAiTool[]);
  }
  if (/(퍼즐|기믹|레버|비밀\s*통로|오르간|화로|점화|발판|미끄럼|컨베이어|다이너마이트|미믹|수수께끼|수문|다리\s*개방|잠입|결계|비석|\bpuzzle\b|\bgimmick\b)/iu.test(input.requestText)) {
    appendUnique(tools, seen, toolSchemasForNames(["list_puzzle_presets", "author_map_puzzle", "compile_puzzle", "tile_change_effect", "check_reachability", "show_map_region", "run_lint"]) as OpenAiTool[]);
  }
  // 「…이 드러난다/나타난다」 — 대사만 쓰고 지도는 그대로인 연출을 막는다(폴른 스타 승강 장치, 2026-10-25).
  if (/(드러나|드러난|드러났|나타나게|나타난다|숨은\s*문|숨겨진\s*(문|통로|계단)|승강\s*장치|비밀\s*문|\breveal)/iu.test(input.requestText)) {
    appendUnique(tools, seen, toolSchemasForNames(["stage_map_reveal", "list_spatial_designs", "find_events", "get_event", "show_map_region"]) as OpenAiTool[]);
  }
  // 보스와 마주 서는 대형·보스 HP 숨김 — 일반 설정 도구를 보인다.
  if (/(대형|횡대|마주\s*(서|보)|일행.*(줄|나란히)|보스\s*HP|HP\s*(숨|가리)|체력\s*(숨|가리))/iu.test(input.requestText)) {
    appendUnique(tools, seen, toolSchemasForNames(["configure_companion_rules", "upsert_enemy", "upsert_troop", "get_database_records"]) as OpenAiTool[]);
  }
  // 전투·저장·필드 적 규칙(폴른 스타 2026-10-25): 자동 전투 끄기·전투 뒤 상태 해제·세이브 포인트 전용·랜덤 조우 끄기·추격 세기·연계기 얼굴.
  if (/(자동\s*전투|오토\s*배틀|auto[-\s]?battle|상태\s*이상.*(풀|해제|남)|전투\s*(뒤|후|끝).*(독|수면|상태)|세이브\s*포인트|저장.*(만|금지|막)|메뉴.*저장)/iu.test(input.requestText)) {
    appendUnique(tools, seen, toolSchemasForNames(["set_project_settings", "upsert_state", "place_savepoint", "set_map_properties", "get_database_records"]) as OpenAiTool[]);
  }
  if (/(랜덤\s*(인카운터|조우)|무작위\s*(조우|전투)|걸을\s*때마다.*전투|조우\s*(없|끄)|필드\s*(몬스터|적)|보이는\s*적|덮치|달려들|멀리서.*(알아|보)|추격.*(빠르|세게|멀리))/iu.test(input.requestText)) {
    appendUnique(tools, seen, toolSchemasForNames(["set_encounter_table", "tune_field_enemies", "place_field_enemy", "upsert_troop"]) as OpenAiTool[]);
  }
  appendUnique(tools, seen, mentionedToolSchemas(input.requestText) as OpenAiTool[]);
  appendUnique(tools, seen, input.discoveredToolNames
    ? toolSchemasForNames(input.discoveredToolNames) as OpenAiTool[]
    : []);
  appendUnique(tools, seen, input.requiredReadTools
    ? toolSchemasForNames(input.requiredReadTools) as OpenAiTool[]
    : []);
  appendUnique(tools, seen, input.workPlan
    ? planRequiredToolSchemas(input.workPlan) as OpenAiTool[]
    : []);

  // 선언 모델이 이미 도구를 골랐으면 낱말 일치 승격을 얹지 않는다. 승격은 요청 낱말과 설명 낱말의 겹침이라
  // 설명이 긴 도구가 늘 이긴다 — 실측(2026-10-07 조수 시험 12과제): 「아이템 가격만 바꿔」에 edit_world_terrain·author_village,
  // 「NPC 이동」에 make_villager(73k자)·upsert_event(69k자)가 붙어 과제마다 평균 6만 자, 최대 18만 자가 매 호출 실렸다.
  // 빠진 도구는 find_tools 와 이름 호출 구제로 여전히 잡힌다.
  if (input.intent?.source === "llm" && input.intent.tools.length > 0) return tools;
  const capability = capabilityEscalationSchemas(input.requestText, seen);
  appendUnique(tools, seen, capability as OpenAiTool[]);
  return tools;
}
