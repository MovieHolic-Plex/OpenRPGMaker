// ai/contextBuilder.ts
// 어시스턴트 시스템 프롬프트(한국어) 조립기. 순수 함수(브라우저 접근 금지).
// 구성: ① 에디터 소개 + 툴 사용 수칙 ② get_project_summary ③ 현재 맵 get_map_region 요약
//       ④ 자주 쓰는 리소스 시맨틱 요약 ⑤ 게임 스타일 문서 발췌 ⑥ 밸런스 상수.
// 토큰 예산(문자 수 근사) 상한을 넘으면 조회 툴 안내로 대체한다.

import { runTool } from "@/editor/tools";
import type { ToolContext } from "@/editor/tools";
import { HOUSE_KITS } from "@/editor/houseKit";
import {
  conceptFacilityWall,
  conceptPlaceCount,
  conceptPlaceFloor,
  conceptPlaceLevel,
  conceptPlaceRole,
  conceptPlaceSize,
  listLiveConceptBundles,
} from "@/editor/conceptBundleResolve";
import { INTERIOR_ROOM_TILESET_ID, interiorVocabFromTileset } from "@/editor/interiorRoomPipeline";
import {
  CONCEPT_FLOOR_MATERIAL_LABELS,
  CONCEPT_PLACE_ROLE_LABELS,
  CONCEPT_PLACE_SIZE_LABELS,
  CONCEPT_WALL_MATERIAL_LABELS,
} from "@/project/types/conceptBundle";
import { HOUSE_TEMPLATE_DEFS } from "@/project/defaults/houseTemplateCatalog";
import { villageAuthoringData } from "@/editor/tools/village/authoringData";
import { describePlacementSurface, surfaceRuleFromClusterRule } from "@/project/placementSurface";
import type { Project, TileGroupMetadata } from "@/project/types";
import { confidenceScore } from "@/project/tilesetPalette";
import { approvedVocabulary } from "@/project/tileVocabulary";
import { aiInstructionsSection } from "./projectInstructions";
import { worldCanonPromptSection } from "./worldCanonContext";
import { AGENT_UX_POLICY_LINES } from "./promptPolicies";
import { EVENT_PAGE_SEMANTICS_BLOCK } from "./eventPageSemantics";
import { buildToolCapabilityIndex } from "./toolCapabilityIndex";
import {
  formatViewportContextBlock,
  mapRegionForContext,
  type MapViewportSnapshot,
} from "./mapViewportContext";

export interface ContextOptions {
  // 현재 에디터에서 열려 있는 맵(있으면 주변 영역을 요약에 포함).
  currentMapId?: string;
  // 시스템+컨텍스트 문자 예산(근사). 초과분은 조회 툴 안내로 대체.
  budgetChars?: number;
  /** 사용자가 지금 보고 있는 맵 카메라 뷰포트(타일 좌표). 없으면 좌상단 fallback. */
  viewport?: MapViewportSnapshot | null;
  /** 매 턴 최신 뷰포트(세션이 send 시 호출). viewport보다 우선. */
  getViewport?: () => MapViewportSnapshot | null | undefined;
  /**
   * 매 턴 최신 현재 맵(세션이 send 시 호출). currentMapId보다 우선.
   * 세션 생성 시점 값으로 고정하면 사용자가 맵을 옮긴 뒤에도 시스템 프롬프트의 타일 어휘·
   * 구조 키트·맵 요약이 이전 맵을 설명해, 라이브 뷰포트 블록과 서로 다른 맵을 가리킨다.
   */
  getCurrentMapId?: () => string | null | undefined;
  /**
   * 프로젝트 한정 성향 조회 키(conversationScopeKey 값). 패널이 넣고 세션이 성향 조회에 쓴다.
   * 없으면 전역 성향만 붙는다 — 전역 성향은 이 값과 무관하게 항상 붙는다(사람의 취향은
   * 프로젝트를 넘어 유지되는 게 요점이다).
   */
  projectScopeKey?: string;
  /**
   * 조립된 사람 성향 블록. 세션이 매 조립 시 buildPreferenceMemorySection 으로 채운다.
   * 이 파일은 localStorage 를 읽지 않는다(머리 주석의 "순수 함수" 계약) — 그래서 조회 키가 아니라
   * 완성된 문자열을 받는다.
   */
  preferenceMemorySection?: string;
}

export function resolveContextMapId(options: ContextOptions): string | undefined {
  return options.getCurrentMapId?.() ?? options.currentMapId ?? undefined;
}

export function resolveContextViewport(options: ContextOptions): MapViewportSnapshot | null {
  const live = options.getViewport?.();
  if (live) return live;
  return options.viewport ?? null;
}

// 기본 문자 예산(현행 동작 기준). tokenBudget.calibratedBudgetChars가 실측 usage로 이 값을 재척도한다.
//
// 12,000 → 13,200 (2026-08-29 modify 진단). 수정/신규 축(대상 선택 규칙·기존 맵 편집 경로)이
// INTRO·라우팅 표에 들어가면서 조립분이 11,978자 → 13,011자(createEmptyToolProject 실측)가 됐다.
// 12,000 을 유지하면 그 초과분을 밸런스 상수·리소스 조회·집 키트·클러스터 규칙 섹션을 통째로
// 버려서 메꾼다 — 수정 축을 넣은 대가로 다른 지침이 조용히 사라지는 교환이라 예산을 올렸다.
//
// 13,200 → 20,000 (2026-08-30) → 100,000 (2026-09-01). 중형 RPG 는 맵 목록·실내 문법·이벤트
// 요약이 2만 자를 쉽게 넘긴다. 조립분은 가진 내용만큼만 자라므로 빈 프로젝트는 그대로 짧고,
// 큰 프로젝트만 꼬리를 덜 자른다. tokenBudget 하한은 기준의 0.5× 이므로 축소 장치는 살아 있다.
//
// 창 비례로 잡지 않는 이유: gemini-3.7-flash 의 창은 1,048,576 토큰(pi-catalog
// google-antigravity 항목)이라 20,000자 ≈ 5,000토큰은 창의 0.5% 다. 1%만 잡아도 40,000자인데
// 포화가 그 아래라 아무 일도 안 하면서, tokenBudget 보정 클램프 하한(기준값의 0.5×)만 같이
// 올려 축소 장치를 죽인다. 비용도 논점이 아니다 — 13,200 대비 +1,700토큰 ≈ 요청당 $0.0013
// (입력 $0.75/1M).
//
// 섹션 드롭 기구는 그대로 남는다: 맵 목록은 맵당 약 130자로 선형 증가해 100맵에서 32,614자가
// 되므로(dropOrder 밖의 summary 섹션) 큰 프로젝트에서는 여전히 꼬리 보호가 필요하다.
export const DEFAULT_BUDGET_CHARS = 100_000;
// 예산 초과 시 잘린 항목 수 노출에 사용.
export interface ContextBudgetReport {
  readonly usedChars: number;
  readonly budgetChars: number;
  readonly trimmedSections: string[];
}

// ⑥ 밸런스 상수(handoff 검증치). 모델이 수치 감각을 갖도록 명시한다.
const BALANCE_NOTE = [
  "## 밸런스 상수(검증됨)",
  "- 영웅 Lv1 기준: HP 514 / 공격 45 / 방어 59.",
  "- 데미지 공식: power + 공격/2 − 방어/2 (음수면 1로 클램프).",
  "- 새 적/스킬 수치는 이 곡선에 비례해 정하라. 과도한 값은 밸런스를 깨뜨린다.",
].join("\n");

const HIGH_LEVEL_TOOL_ROUTING_BLOCK = [
  // 수정/신규 축(#262 modify 진단). 라우팅 표가 "무엇을 만들 것인가"만 말하고 "만들 것인가
  // 고칠 것인가"를 말하지 않아, "이 침실 좀 고쳐줘"가 신규 시공 경로를 탔다.
  "**대상 선택(라우팅보다 먼저):** 신규 표지(새/새로/추가/create)가 없으면 기존 산출물이 대상이다. '이/여기/지금'은 아래 현재 맵 요약의 mapId다. 수정 요청에 새 맵을 만들지 말고, '새로 만들지 마'면 create_map/duplicate_map/방 세션 시작을 쓰지 않는다.",
  "## 고수준 툴 우선",
  "고수준 툴 우선 — 트랩/즉사=place_trap 또는 make_horror_loop, 체크포인트=place_trap의 checkpoint 관례, 퍼즐=compile_puzzle, 조사=place_examine_hotspots 또는 make_gallery_room(이브 갤러리 원큐), 컷신=script_cutscene 또는 script_cutscene_preset(투더문 프리셋), 추격=make_chase_scene, NPC=place_npc/make_villager(상태별 다중 페이지. 대사 시 faceset changeFace 자동), 상점=set_shop_stock, 사냥터=make_hunting_ground, 조명=set_lighting_volume/set_scene_mood, 수역=fill_region(circle+물 그룹), 야외 집=author_house(kind:\"single\" 또는 kind:\"lots\"), **마을=author_village(target:{kind:\"existing\",mapId} 또는 target:{kind:\"new\",mapId,name,width,height}, countPolicy:\"exact\", bounds 16x16 이상·기존맵 전체 재시공은 fullMap:true). 나무=list_village_tree_assets/plant_tree_clusters(broadleaf-2x2)**, 성채=build_castle, **시설 실내(여관 등)=place_concept(query). 타일셋 개념 꾸러미가 정본이며 사용자가 데이터베이스에서 고친 나무가 시공에 쓰인다. 방 종류 requiredRoles 로 여관을 합성하지 마라. 실내/방 맵 신규=place_concept 또는 start_interior_room_session 또는 run_interior_room_pipeline(반드시 새 mapId·이름). 기존 실내 맵 수정=그 mapId로 furnish_interior_space·fill_region·tile_erase·place_props(대상은 list_interior_room_sessions). 기존 맵 id로 세션 시작은 그 맵을 통째로 지우므로 map-exists로 거부된다. 실내 요청에는 author_house/author_village 금지**, 월드=plan_world/build_world, 퀘스트=define_quest→verify_quest.",
  "upsert_event/upsert_common_event는 위에 없는 커스텀 로직 전용.",
].join("\n");

const INTRO = [
  "당신은 브라우저 기반 2D RPG 에디터의 개발 어시스턴트입니다.",
  "맵·이벤트·데이터베이스(아이템/장비/스킬/클래스/상태/적/액터/트룹/커먼이벤트)·퀘스트를 '툴 호출'로 편집합니다.",
  "",
  AGENT_UX_POLICY_LINES,
  "",
  HIGH_LEVEL_TOOL_ROUTING_BLOCK,
  "",
  "## 작업 수칙(반드시 준수)",
  "1. 모든 쓰기(맵/이벤트/DB 변경)는 제안(dry-run)으로만 반영되며, 리드(사용자)가 수락해야 실제 프로젝트에 적용됩니다.",
  "2. 편집 전 필요한 정보는 조회 툴(get_project_summary, get_map_region, list_resources, get_database_records, find_events 등)로 먼저 확인하세요.",
  "   기존 레코드(아이템/스킬/액터/스위치 등)를 참조할 때는 get_database_records(collection)로 실제 id를 먼저 확인하세요.",
  "3. 쓰기 툴 결과에 issues(오류)가 있으면 그 내용을 읽고 인자를 고쳐 성공할 때까지 재시도하세요.",
  "4. 좌표·타일·리소스 ID는 추측하지 말고 조회 툴로 확인한 값을 사용하세요. 물 위/통행 불가 칸에 NPC를 두지 마세요.",
  "   NPC/주민 배치 = place_npc (통행 불가 칸 자동 착지), 저수준 upsert_event 금지.",
  "5. 파괴적 작업(remove_event 등)은 꼭 필요할 때만, 이유를 먼저 설명하세요.",
  "6. 툴 호출을 아끼지 마세요. 조회·검증·재시도에 필요한 만큼 깊게 사용하세요(제한은 토큰 예산뿐).",
  "   모든 툴 호출에 reason(한 줄)을 넣어라. 사용자 지시의 어느 부분을 이 호출로 처리하는지. 없으면 실행되지 않는다.",
  "7. 여러 개를 요청받으면(예: NPC 3명, 집 2채) 전부 만들 때까지 멈추지 마세요. 일부만 하고 끝내는 것은 실패입니다.",
  "   사용자가 '진행/계속/진행해/진행하라고'라고 지시하면 추가 확인 질문 없이 끝까지 실행하세요.",
  "8. NPC 대화는 두 층이다. 한 만남 안의 분기는 한 페이지의 choices. 상태별 NPC(퀘스트·호감·시간·재방문)는 조건이 다른 페이지 여러 장 — 아래 페이지 의미론. 조건 없는 페이지를 여러 장 만들지 마라.",
  "9. 작업이 끝나면 무엇을 변경했는지 한국어로 간결히 요약하세요. 지원하지 않는 부분은 시도하지 말고 '못 한 것: …' 한 줄로 명시하세요.",
  "10. 타일을 깔 때는 추측하지 말고 get_tile_info로 의미·배치 규칙(placementRules)을 먼저 확인하세요.",
  "    사용자가 가르친 메타데이터(source=user)가 최우선 근거입니다. 그룹의 placementRules가 있으면 반드시 따르세요.",
  "11. 집/구조물(야외 외장)은 절대 벽 타일로 사각형을 채워 만들지 마세요. 야외 집은 author_house를 우선 사용하고,",
  "    건물 평면은 wings 사각형들의 합집합으로 설계하세요. 길/모래는 paint_road(style=dirt/sand)가 오토타일로 성형합니다.",
  "    구조물 스탬프는 사람 팔레트 전용이다. 타일 시공에 쓰지 마세요.",
  "    **실내·방·인테리어 요청은 야외 집이 아니다.** 현재 맵에 author_house를 올리지 말고",
  "    시설(여관 등)은 get_concept_facility → plan 설계 → place_concept({query, mapId, plan})으로 **새 mapId**를 시공하세요. 그 외 실내는 start_interior_room_session(또는 run_interior_room_pipeline)으로 **새 mapId·요청 이름**을 쓰세요",
  "    (rooms[] 역할 테마 → advance_interior_room_build 반복 → evaluate_interior_room). create_map만 하고 멈추지 마세요.",
  "    위반이 남았는데 '조정 중'처럼 얼버무리지 말고, 고쳤는지 남았는지를 정직하게 보고하세요.",
  "12. 기존 이벤트를 수정할 때는 get_event로 현재 페이지/커맨드를 먼저 읽고 그 위에 병합하세요.",
  "    읽지 않고 upsert_event로 덮으면 기존 대사/분기가 사라집니다.",
  "13. 잘못 깔린 타일/구조물을 지울 때는 tile_erase(mapId, rect, layer)를 쓰세요(기본 kind=all: 상·하위 EMPTY).",
  "    새 구조물을 찍기 전, 겹치는 이전 실패물이 있으면 먼저 tile_erase로 정리하세요.",
  "    단, '집/구조물의 주변(근처)을 청소'하라는 요청은 그 구조물을 덮지 말고 둘러싼 빈 칸만 정리하는 뜻입니다 —",
  "    방금 지은 집을 지우지 마세요. 기존 구조물을 정말 철거하려면 파괴적 변경임을 짧게 설명하고 clear 에셋에 confirmDestroy:true를 명시하세요.",
  "    **상점/가게 철거:** find_layout_regions({mapId, query: 사용자 문구})로 상점 영역을 먼저 찾은 뒤,",
  "    tile_erase({mapId, rect, kind:\"market\"})로 지우세요. kind market은 상점 타일만 지우므로 이웃 집·흙길은 그대로 유지됩니다.",
  "    show_map_region은 지운 뒤 결과를 눈으로 확인하는 용도입니다 — 영역 상자(bbox)를 비전으로 추측하지 말고",
  "    find_layout_regions가 돌려준 rect를 그대로 쓰세요.",
  "    **호수/물 치우기:** get_map_region의 data.water.bounds로 위치를 잡고, set_build_spec clear에 **confirmDestroy:true**를 넣으세요(물·벽·절벽은 구조물 보호에 걸림). 전체 맵 52×52를 show/get_map_region으로 반복 스캔하지 마세요.",
  "    스펙 검증기가 구조물을 덮는 clear를 거부하면, 영역을 구조물 바깥으로 좁히거나 confirmDestroy:true로 재제출하세요.",
  "14. 타일의 규칙(레이어/통행/지면 종류)은 set_tile_rules로 설정합니다. 레이어(auto/lower/upper) 변경은",
  "    사용자가 명시적으로 요청했을 때만 confirmedByUser=true로 호출하세요.",
  "15. 스펙 게이트(반드시 준수): 공간 쓰기 작업(집/마을/길/청소/NPC·전투 배치/수역·지면 채우기 등 맵에 무언가를 놓는 일)은",
  "    먼저 set_build_spec으로 밑그림(명세)을 제출해 검증을 통과해야 실행됩니다. 명세 체크리스트 —",
  "    대상 맵, 에셋 목록(종류·개수·각 영역 x,y,w,h·스타일), 통로 너비(pathWidth), 밀도(density), 배치 스타일(layoutStyle).",
  "    맵이 요구 구조물 대비 작으면 author_house/author_village 최소 제약을 계산해 resize_map을 먼저 호출하세요(비파괴 보정).",
  "    수역/지면/바닥 면은 fill_region만 쓴다. 호수·연못: material=\"물\"(타일 라벨/설명, 그룹 id·vocabId 금지), 원형·둥근 요청은 shape=circle(또는 ellipse) 필수 — rect만 쓰면 네모. 나무/바위/꽃은 place_props material=\"침엽수\" 등으로 호수·물 칸 밖(통행 가능 육지)에만 산포; 물 위 place_props 금지.",
  "    사용자가 정하지 않은 항목은 합리적 기본값으로 채우고, 넓은 요청(마을 등)은 명세 요약을 한 줄로 보여준 뒤 진행하세요.",
  "    검증기가 겹침을 거부하면 좌표·buildOrder·맵 크기를 고쳐 재제출하세요. 3회 실패하면 그 계획은 폐기하고 스스로 새 배치를 설계하세요.",
  "    각 빌드 툴 호출이 명세 밖 빈 영역을 쓰면 게이트가 명세를 자동 확장하고 warning으로 통과합니다.",
  "    단, 사용자 맵의 기존 구조물·물·절벽은 밑그림 안이라도 clear+confirmDestroy 또는 overExisting 선언 없이 덮지 않습니다(tile_erase 등 v3 툴 포함).",
  "    사용자가 맵에서 선택한 영역은 곧 암묵적 명세입니다.",
  "    배치 전 정리: 타일/구조물을 놓을 자리·주변에 지형이 아닌 것(벽·물·나무 등)이 있으면 스스로 판단해",
  "    해당 에셋에 overExisting:\"clear\"(정리하고 배치) 또는 \"keep\"(그대로 위에 배치)을 넣어 재제출하세요. 검증기가 이를 강제합니다.",
  "    건설 순서: 마을처럼 여러 구조물을 짓는 복합 건축은 buildOrder([\"clear\",\"terrain\",\"road\",\"house\",\"prop\"]처럼 kind 순서)를 정하고, 그 순서대로 빌드 툴을 호출하세요.",
  "16. 비전(반드시 준수): 당신은 show_tiles/show_tile_grid로 띄운 타일·영역 이미지를 실제로 볼 수 있습니다(멀티모달).",
  "    맵에 뭔가 깐 뒤에는 말로 단정하지 말고 show_map_region으로 결과를 눈으로 확인하세요.",
  "    타일의 의미·라벨·용도를 단정하기 전에 반드시 그 이미지를 눈으로 확인하세요. 번호나 인접 통계만으로 '탁자/침대'처럼",
  "    추측해 라벨을 지어내지 마세요. 설명이 없는(described=false) 타일은 이미지를 보고 보이는 대로 서술하고, 확신이 없으면",
  "    사용자에게 물으세요. 어떤 타일이 무엇인지 사용자에게 물을 때도 먼저 show_tiles로 그 이미지를 띄우세요.",
  "    구조(벽/나무/지붕)는 말로 설명하지 말고 render_group_sample로 조립해 이미지로 보여준 뒤 판단·질문하세요.",
  "17. 인터뷰: analyze_map_tile_usage/get_tile_info에서 이미 설명된(described=true / source=user) 타일은 다시 묻지 마세요.",
  "    기록된 메타데이터가 있으면 그대로 신뢰하고, 설명 없는 타일만 질문 대상으로 삼으세요.",
  // 예산이 31자밖에 남지 않은 자리다(test/aiToolCapabilityIndex "does not push … over its budget").
  // 그래서 "막아 달라는 지시는 18번보다 우선" 을 새 규칙으로 붙이지 않고 이 줄을 줄여 담았다.
  "18. 실내 장식: 통행 불가 타일(돌바닥 342·계단 246)로 지나갈 칸을 막지 마세요. 막아 달라는 지시는 예외 — place_props packing:\"dense\".",
  "    가구/소품 타일이 타일셋에 없으면 없다고 정직하게 말하고 대안(이벤트 소품·NPC·다른 타일셋)을 제안하세요.",
  "    장식 타일은 대개 상위(upper) 레이어입니다 — 바닥을 통행 불가로 덮지 않도록 레이어를 확인하세요.",
  "19. 시각 제안: 집을 짓기 전에 preview_house(mapId, origin, width, height, material)로 결과 이미지를 먼저 띄워",
  "    '이렇게 생긴 집을 지을까요?'처럼 그림으로 제안할 수 있습니다(프로젝트를 바꾸지 않는 읽기 툴 — 스펙 게이트 무관).",
  "20. 메타데이터 저장: 인터뷰로 확정한 타일 메타데이터(set_tile_metadata)는 데이터베이스의 타일셋 지식 화면에 저장됩니다.",
  "    구조물 문법은 집(author_house)가 담당하므로 별도 지형 템플릿을 만들지 마세요.",
  "21. 타일 프리셋: 타일셋에 팔레트 프리셋이 있으면 개별 tile id 대신 presetId+paletteRole을 우선 사용하세요.",
  "22. 스위치/변수를 새로 쓰기 전에 declare_story_flag로 의미를 등록하세요.",
  "23. 이벤트가 왜 안 나오는지는 explain_event로 확인하세요.",
  "24. 다중 맵 월드는 plan_world→build_world→맵별 콘텐츠 순서로.",
].join("\n");

function summarySection(project: Project): string {
  const result = runTool({ project }, "get_project_summary", {});
  if (!result.ok || result.data === undefined) return "## 프로젝트 요약\n(요약 조회 실패 — get_project_summary 툴을 호출하세요.)";
  return ["## 프로젝트 요약", "```json", JSON.stringify(result.data, null, 2), "```"].join("\n");
}

/**
 * 현재 맵 컨텍스트 — **머리(header)와 몸통(detail)을 나눠 돌려준다** (#262).
 *
 * header(뷰포트 블록 + `## 현재 맵 요약(이름, mapId, w×h)`)는 예산 밖 고정 버지다. 조립분을
 * 꼬리에서 자르는 구현에서 이 블록이 배열 마지막이라 1순위로 사라졌고, 그러면 "이/여기 좀
 * 고쳐줘"의 대상이 프롬프트에 남지 않아 모델이 새 맵을 만들었다.
 * detail(타일·이벤트 JSON)은 예산 안에서 잘려도 get_map_region 으로 다시 읽을 수 있다.
 */
function mapRegionSection(
  project: Project,
  mapId: string | undefined,
  viewport: MapViewportSnapshot | null,
): { header: string; detail: string } {
  const id =
    (viewport?.mapId && project.maps[viewport.mapId] ? viewport.mapId : null)
    ?? (mapId && project.maps[mapId] ? mapId : null)
    ?? project.startMapId;
  const map = project.maps[id];
  const empty = { header: "", detail: "" };
  if (!map) return empty;
  const region = mapRegionForContext(map, viewport?.mapId === map.id ? viewport : null);
  const ctx: ToolContext = { project };
  const result = runTool(ctx, "get_map_region", {
    mapId: id,
    x: region.x,
    y: region.y,
    w: region.w,
    h: region.h,
  });
  if (!result.ok || result.data === undefined) return empty;
  const headerParts: string[] = [];
  if (viewport && viewport.mapId === map.id) {
    // 시스템 프롬프트는 baseline으로 재조립될 수 있으므로, live draft 전용 통행 격자는 매 턴 사용자 블록에만 둔다.
    headerParts.push(formatViewportContextBlock(viewport, map.name));
  }
  headerParts.push(
    // mapId 를 머리에 박는다 — "이/여기"가 어느 맵인지 모델이 되묻거나 새 맵을 만들지 않게.
    `## 현재 맵 요약(${map.name}, \`${id}\`, ${map.width}×${map.height}) — 사용자가 지금 보고 있는 맵. "이/여기/지금"은 이 mapId를 뜻하며 수정 요청의 기본 대상이다.`,
    viewport && viewport.mapId === map.id
      ? `뷰포트 중심 (${viewport.centerX},${viewport.centerY}) 주변 (${region.x},${region.y}) ${region.w}×${region.h}. 다른 영역은 get_map_region으로 조회하세요.`
      : "좌상단 일부만 표시(뷰포트 없음). 다른 영역은 get_map_region으로 조회하세요.",
  );
  return {
    header: headerParts.join("\n"),
    detail: ["```json", JSON.stringify(result.data, null, 2), "```"].join("\n"),
  };
}

function tileVocabularySection(project: Project, mapId: string | undefined): string {
  const tilesetIds = currentTilesetIds(project, mapId);
  const lines: string[] = [];
  for (const tilesetId of tilesetIds) {
    const tileset = project.tilesets[tilesetId];
    if (!tileset) continue;
    const vocab = approvedVocabulary(tileset);
    // 프리셋도 승인 그룹도 없으면 이 타일셋은 다이제스트에 보탤 것이 없다.
    if ((tileset.palettePresets ?? []).length === 0 && vocab.groups.length === 0) continue;
    lines.push(`### ${tileset.name} (${tileset.id})`);
    for (const preset of tileset.palettePresets ?? []) {
      const slots = preset.slots.map((slot) => `${slot.role}:${slot.tileIds.length}`).join(", ");
      lines.push(`- ${preset.name} (${preset.id}${preset.locked ? ", locked" : ""}, ${preset.origin}) — ${slots || "slot 없음"}`);
    }
    if (vocab.groups.length > 0) {
      const byRole = new Map<string, string[]>();
      for (const group of vocab.groups) {
        const bucket = byRole.get(group.role) ?? [];
        const shape = group.blockSize ?? group.sourceSize;
        const operational = [
          `layer=${group.layerHome}`,
          group.patternKind ? `pattern=${group.patternKind}` : "",
          shape ? `shape=${shape.width}x${shape.height}` : "",
          group.passage ? `passage=${passagePromptLabel(group.passage)}` : "",
        ].filter((entry) => entry.length > 0).join(", ");
        const prose = group.placementRules || group.description;
        bucket.push(`${group.name} [${operational}]${prose ? ` — ${prose.slice(0, 100)}` : ""}`);
        byRole.set(group.role, bucket);
      }
      for (const [role, entries] of byRole) lines.push(`- ${role}: ${entries.join(", ")}`);
    }
    const lowConfidence = (tileset.tileMeta ?? []).filter((meta) => {
      const score = confidenceScore(meta?.confidence);
      return score !== null && score < 0.5;
    }).length;
    if (lowConfidence > 0) lines.push(`- 낮은 신뢰(confidence<0.5) 타일 ${lowConfidence}개`);
  }
  if (lines.length === 0) return "";
  return [
    "## 타일 어휘 다이제스트",
    "배치는 v3 공정 프리미티브 + 고수준 툴. **집·마당:** author_house — LLM은 wings(앵커 위치)·templateId(모양 34종)·kitId(색)·stories/lowWall/chimney·yard 태그만(firewood/mailbox/bench_h/…), 세부 좌표는 코드. 여러 채면 templateId 를 집마다 다르게 주고 look_at_houses 로 확인. **마을:** author_village에 theme·pathStyle·yardStyle·forestDensity 등 의도를 채워라(빈 호출 금지). 숲=forestDensity:\"dense\", 울창/빽빽/통행 불가=\"impassable\", 드문드문=\"sparse\" — 테마 문장을 코드가 읽지 않는다. **place_props:** 숲/들판 산포와 집에서 먼 소품(묘지 등)만 — 구역별, area 넓게, 숲이면 density enum, naturalness 0.55~0.7, 동일 인자 턴당 1회. 집 앞 소품을 광장에 몰지 말 것. **자리 줄:** 신도석·좌석·책상 줄은 산포 대신 arrange_rows(axis=통로축·aisleWidth·rowGap·symmetric). 호수: fill_region+circle(get_map_region data.water.bounds). 길: paint_road. 미합의 재료는 맵 목업 후 [이대로 적용]. 재료는 material=타일 라벨/설명만(그룹 id·*VocabId 금지). 모르면 tile_query ask:\"labels\".",
    trimDigestLines(lines, 700),
  ].join("\n");
}

function passagePromptLabel(passage: ReturnType<typeof approvedVocabulary>["groups"][number]["passage"]): string {
  if (!passage) return "unknown";
  if (passage === "mixed") return passage;
  return `up:${passage.up ? "open" : "blocked"},down:${passage.down ? "open" : "blocked"},left:${passage.left ? "open" : "blocked"},right:${passage.right ? "open" : "blocked"}`;
}

function styleSection(project: Project, remaining: number): string {
  const docs = project.villageInfoDocuments ?? [];
  if (docs.length === 0) return "";
  const lines: string[] = ["## 게임 스타일 문서(발췌)"];
  for (const doc of docs) {
    const excerpt = doc.markdown.slice(0, 400);
    lines.push(`### ${doc.title}`, excerpt);
    if (lines.join("\n").length > remaining) break;
  }
  return lines.join("\n");
}

// 자주 쓰는 리소스 시맨틱 안내(전체 목록은 list_resources로 조회 유도).
const RESOURCE_HINT = [
  "## 리소스 조회",
  "타일/차셋/배경/BGM/SE는 list_resources(kind, query)로 시맨틱 검색하세요.",
  "예: list_resources(kind='charset', query='마을 사람'), list_resources(kind='tile', query='물').",
  "차셋 질의는 한국어(주민/전사/노파)와 시트명(people1~5, actor1~4, monster1~3, animal, object1~2) 모두 지원합니다.",
  "결과가 0개면 query='*'로 전체 목록을 훑어본 뒤 정확한 라벨로 다시 검색하세요.",
].join("\n");

type ClusterRuleStrength = "hard" | "medium" | "soft";
type ClusterRuleKind = "adjacency" | "spacing" | "count" | "surface";

interface ClusterRuleHint {
  readonly id: string;
  readonly kind: ClusterRuleKind;
  readonly strength: ClusterRuleStrength;
  readonly message?: string;
  /** surface 규칙은 params 로 조건이 정해지므로 문장 없이도 뜻을 복원할 수 있다. */
  readonly params?: Record<string, unknown>;
}

// 사용자가 가르친 타일 지식(맵 인터뷰 결과) 요약 — 챗봇 타일 깔기의 근거.
// 상세는 get_tile_info로 조회하게 유도하고, 여기서는 존재와 핵심 규칙만 알린다.
function tileSemanticsSection(project: Project): string {
  const lines: string[] = [];
  for (const tileset of Object.values(project.tilesets)) {
    const userTiles = (tileset.tileMeta ?? [])
      .map((meta, tile) => ({ meta, tile }))
      .filter(({ meta }) => meta.source === "user" && (meta.label.trim() || meta.description.trim()));
    // 사용자가 만든(인터뷰로 확정한) 그룹만 — 번들 기본 그룹 규칙은 검색/조회 툴로 충분하다.
    const ruleGroups = (tileset.tileGroups ?? []).filter((group) => group.source === "user" && group.placementRules.trim().length > 0);
    if (userTiles.length === 0 && ruleGroups.length === 0) continue;
    lines.push(`### ${tileset.id} — 사용자가 가르친 타일 ${userTiles.length}개`);
    for (const { meta, tile } of userTiles.slice(0, 20)) {
      const desc = meta.description.trim();
      lines.push(`- ${tile}: ${meta.label.trim() || "(라벨 없음)"}${desc ? ` — ${desc.slice(0, 80)}` : ""}`);
    }
    if (userTiles.length > 20) lines.push(`- …외 ${userTiles.length - 20}개(get_tile_info로 조회)`);
    for (const group of ruleGroups.slice(0, 10)) {
      lines.push(`- [그룹 ${group.name}/${group.role}] 타일 ${group.tileIds.slice(0, 8).join(",")}${group.tileIds.length > 8 ? "…" : ""} — 규칙: ${group.placementRules.slice(0, 120)}`);
    }
  }
  if (lines.length === 0) return "";
  return ["## 타일 지식(사용자가 가르침 — 타일 깔 때 최우선 근거)", ...lines].join("\n");
}

function charsetLabelSection(project: Project): string {
  const taught = (project.charsetLabels ?? []).filter((entry) => entry.label.trim().length > 0);
  if (taught.length === 0) return "";
  const lines = ["## 캐릭터 칩 지식(사용자가 가르침 — NPC 외형 고를 때 최우선 근거)"];
  for (const entry of taught.slice(0, 24)) {
    const tags = entry.tags && entry.tags.length > 0 ? ` [${[...entry.tags].slice(0, 6).join(", ")}]` : "";
    lines.push(`- ${entry.textureKey}#${entry.characterIndex}: ${entry.label.trim()}${tags}`);
  }
  if (taught.length > 24) lines.push(`- …외 ${taught.length - 24}개(list_npc_graphics로 조회)`);
  return lines.join("\n");
}

// 사람이 등록한 구조 킷은 팔레트 스탬프 전용이다. 목록을 시공 재료로 주면
// 모델이 구조물 스탬프로 집을 찍는다(2026-08-31 실측).
function structureKitSection(project: Project, mapId: string | undefined): string {
  const names: string[] = [];
  for (const tilesetId of currentTilesetIds(project, mapId)) {
    const tileset = project.tilesets[tilesetId];
    for (const kit of tileset?.structureKits ?? []) {
      names.push(kit.name ?? kit.id);
    }
  }
  if (names.length === 0) return "";
  const shown = names.slice(0, 12);
  const extra = names.length > 12 ? ` 외 ${names.length - 12}개` : "";
  return [
    "## 구조물 스탬프는 사람 팔레트 전용",
    `사람이 등록한 구조물: ${shown.join(", ")}${extra}.`,
    "타일 시공에 구조물 스탬프를 쓰지 마세요.",
    "집=author_house, 마을=author_village, 벽=build_wall, 지형=fill_region, 소품=place_props.",
  ].join("\n");
}

function conceptBundleSection(project: Project): string {
  const listed = listLiveConceptBundles(project);
  const lines = [
    "## 개념 꾸러미 (place_concept 이 읽음)",
    "사용자가 데이터베이스 「임시 → 개념 꾸러미」에서 고친 나무가 정본이다. 아래 시설을 지을 때 방 종류 필수 역할로 합성하지 말고 place_concept(query)를 호출하라.",
  ];
  if (listed.length === 0) {
    lines.push("- 지금 프로젝트에는 개념 꾸러미가 없다. 실내 칩셋이면 place_concept 첫 호출이 시설 초안(여관·민가·상점·술집·서재·대장간·교회·창고·길드)을 시드한다.");
    return lines.join("\n");
  }
  // 예산 규율(2026-09-03 실측): 빈 프로젝트의 시스템 프롬프트는 20,000자 예산 중 약 19,250자를 이미 쓴다.
  // 시설마다 한 줄(9시설 ≈ 1,500자)을 기본 초안에도 싣자 뒤의 「게임 스타일 문서(발췌)」가 통째로 밀려났다
  // (`test/worldAiExclusion.test.ts`). 그래서 두 단계다 —
  //   · 초안 그대로(칩셋에 `scratchConceptBundles` 가 없음): 시설명 한 줄. 장소·재질은 코드 초안 값이라
  //     모델이 미리 알 필요가 없다. place_concept 결과와 데이터베이스가 보여 준다.
  //   · 사용자가 고친 나무(칩셋에 배열이 있음): 시설마다 한 줄 — 장소[역할·크기·×개수·바닥]·벽·물건 표시.
  //     사용자 데이터는 마을 저작 절과 같은 이유로 코드 상수 요약보다 앞에 온다.
  let detailed = false;
  for (const entry of listed) {
    const materialized = project.tilesets[entry.tilesetId]?.scratchConceptBundles !== undefined;
    if (!materialized) {
      const labels = entry.bundles.flatMap((bundle) => bundle.facilities.map((facility) => facility.label));
      lines.push(`- ${entry.tilesetName} 기본 초안 ${labels.length}종: ${labels.join("·")} (query=시설명). 장소·바닥·벽은 초안 값 — 데이터베이스에서 고치면 여기에 시설별로 실린다.`);
      continue;
    }
    detailed = true;
    lines.push(`### ${entry.tilesetName} (${entry.tilesetId})`);
    for (const bundle of entry.bundles) {
      for (const facility of bundle.facilities) {
        const wall = conceptFacilityWall(facility);
        const wallNote = wall === "cream" ? "" : ` [벽 ${CONCEPT_WALL_MATERIAL_LABELS[wall]}]`;
        const places = facility.placeIds
          .map((placeId) => bundle.places.find((place) => place.id === placeId))
          .filter((place): place is NonNullable<typeof place> => Boolean(place))
          .map((place) => {
            const things = bundle.things.filter((thing) => thing.placeIds.includes(place.id)).map((thing) => {
              const marks = [
                thing.required ? "*" : "",
                thing.chips.includes("sleep") ? "⌂" : "",
                thing.chips.includes("loot") ? "$" : "",
                thing.chips.includes("transfer") ? "↔" : "",
              ].join("");
              return `${thing.label}${marks}`;
            });
            const count = conceptPlaceCount(place);
            const floor = conceptPlaceFloor(place);
            const level = conceptPlaceLevel(place);
            const plan = [
              CONCEPT_PLACE_ROLE_LABELS[conceptPlaceRole(place)],
              CONCEPT_PLACE_SIZE_LABELS[conceptPlaceSize(place)],
              ...(count > 1 ? [`×${count}`] : []),
              ...(floor === "wood" ? [] : [CONCEPT_FLOOR_MATERIAL_LABELS[floor]]),
              ...(level > 1 ? [`${level}층`] : []),
            ].join("·");
            return `${place.label}[${plan}](${things.length > 0 ? things.join(", ") : "물건 없음"})`;
          });
        lines.push(`- 시설 ${facility.label} (query="${facility.label}")${wallNote}: ${places.join(" → ") || "장소 없음"}`);
      }
    }
  }
  if (detailed) {
    lines.splice(2, 0, "장소의 [역할·크기 ×개수·바닥·층] 과 시설의 벽 재질은 템플릿 값 — plan 에서 고쳐 넘길 수 있다. 2층 이상 장소는 <mapId>_2f 같은 별도 맵으로 서고 계단이 이어진다. 물건 표기: *필수(빼면 경고) · ⌂수면 · $노획 · ↔맵 연결.");
  }
  return lines.join("\n");
}

function interiorCatalogSection(project: Project, mapId: string | undefined): string {
  const tilesetIds = new Set<string>(currentTilesetIds(project, mapId));
  tilesetIds.add(INTERIOR_ROOM_TILESET_ID);
  const lines: string[] = [
    "## 타일셋 실내 문법 (start_interior_room_session / run_interior_room_pipeline 이 읽음)",
    "가구 모양과 방 종류는 데이터베이스 구조물 탭의 그 타일셋 데이터다. 구조물 스탬프로 찍지 마라.",
  ];
  let any = false;
  for (const tilesetId of tilesetIds) {
    const tileset = project.tilesets[tilesetId];
    if (!tileset) continue;
    const vocab = interiorVocabFromTileset(tileset);
    if (vocab.kindsById.size === 0 && vocab.objectsById.size === 0) continue;
    any = true;
    lines.push(`### ${tileset.name} (${tilesetId})`);
    for (const kind of vocab.kindsById.values()) {
      const roles = kind.requiredRoles.length > 0 ? kind.requiredRoles.join(", ") : "필수 없음";
      lines.push(`- 방 ${kind.id} (${kind.label}): 필수 ${roles}${kind.walkway ? " · 복도(바닥 가구 없음)" : ""}`);
    }
    const objects = [...vocab.objectsById.values()].slice(0, 16);
    for (const object of objects) {
      lines.push(
        `- 가구 ${object.id}: ${object.label}`
          + `${object.role ? ` 역할=${object.role}` : ""} 스냅=${object.snap}`
          + `${object.themes.length > 0 ? ` 테마=${object.themes.join(",")}` : ""}`,
      );
    }
    if (vocab.objectsById.size > 16) lines.push(`- …외 ${vocab.objectsById.size - 16}개 가구`);
  }
  if (!any) return "";
  return lines.join("\n");
}

function houseKitSection(): string {
  const kits = Object.values(HOUSE_KITS).map((kit) => `- ${kit.id}: ${kit.name}`);
  // 모양(templateId)과 색(kitId)은 서로 다른 축이다. 예전에는 색 축만 안내해서
  // "다양성 확보" 지시를 지켜도 같은 사각형의 색만 바뀐 집이 나왔다(2026-08-31).
  const shapes = HOUSE_TEMPLATE_DEFS.map((def) => `${def.id}(${def.w}×${def.h})`).join(", ");
  return [
    "## 집 외관 — 모양 축과 색 축을 **둘 다** 흔들어라",
    `### 모양: author_house 의 templateId (${HOUSE_TEMPLATE_DEFS.length}종)`,
    shapes,
    "templateId 를 생략하면 wings 그대로의 사각형이 된다 — 여러 채를 깔 때 생략하면 결과가 단조로워진다.",
    "templateId 를 주면 wings[0]의 x·y 만 앵커로 쓰이고 치수는 카탈로그가 정한다.",
    "추가 형태 축: stories(1~3, 2층은 h≥9) · lowWall(헛간·창고) · chimney · roofDeck(파랑 평지붕 전용).",
    "### 색: kitId",
    ...kits,
    "kitId 6종은 지붕색 3가지로 접힌다 — blue: blue-stone·slate-wood / orange: bright-plaster·amber-wood / red: timber-hall·aframe-stone. 색군까지 섞어라.",
    "### 시공·검증",
    "2채 이상은 author_house kind=lots + houses[]로 한 번에 호출(개별 single 반복 금지).",
    "집을 깐 직후 **look_at_houses(mapId)** 로 눈으로 확인하라. verdict 가 monotonous/mixed 면 advice 의 안 쓴 templateId 를 골라 다시 깔아라.",
    "wing 제약: w≥3, h≥5 (지붕+벽 포함). windows: false | {} | {spacing:N} (true 불가).",
    "길/모래는 paint_road(style=dirt/sand)가 8방 오토타일로 성형합니다.",
  ].join("\n");
}

/**
 * 사용자가 데이터베이스 「마을」탭에 저장한 형태·프리셋. 구조물 킷 섹션과 같은 발상 —
 * "유저가 정해둔 값이 코드 기본값보다 우선"임을 모델에게 알리고 id를 넘긴다.
 */
function villageAuthoringSection(project: Project): string {
  const { templates, presets } = villageAuthoringData(project);
  if (templates.length === 0 && presets.length === 0) return "";
  const lines: string[] = [];
  if (presets.length > 0) {
    lines.push("### 배치 프리셋 (author_village presetId 로 지정)");
    for (const preset of presets) {
      const bits = [
        preset.houseCount === undefined ? "" : `집 ${preset.houseCount}채`,
        preset.settlementLayout ?? "",
        preset.pathStyle === undefined ? "" : `길 ${preset.pathStyle}`,
        preset.roadWidth === undefined ? "" : `폭 ${preset.roadWidth}`,
        preset.plazaStyle === undefined ? "" : `광장 ${preset.plazaStyle}`,
        preset.yardStyle === undefined ? "" : `마당 ${preset.yardStyle}`,
        preset.groundTheme === undefined ? "" : `지면 ${preset.groundTheme}`,
        preset.npcCount === undefined ? "" : `NPC ${preset.npcCount}`,
      ].filter(Boolean).join(", ");
      lines.push(`- ${preset.name || preset.id} (${preset.id}${bits ? `: ${bits}` : ""})`);
      if (preset.templateIds && preset.templateIds.length > 0) {
        lines.push(`  형태 후보: ${preset.templateIds.join(", ")}`);
      }
      if (preset.note) lines.push(`  메모: ${preset.note.slice(0, 100)}`);
    }
  }
  if (templates.length > 0) {
    lines.push("### 내 집 형태 (housePlans[].templateId 로 지정)");
    for (const template of templates) {
      const kit = template.kitId ? `, 킷 ${template.kitId}` : "";
      lines.push(`- ${template.name || template.id} (${template.id}, ${template.w}x${template.h}${kit})`);
      if (template.note) lines.push(`  메모: ${template.note.slice(0, 100)}`);
    }
  }
  return [
    "## 마을 저작 데이터(유저가 데이터베이스 「마을」탭에서 정한 값 — 코드 기본값보다 우선)",
    "유저가 직접 만든 프리셋과 집 형태입니다. 마을 요청에서 이 id를 쓰면 유저가 정한 값 그대로 시공됩니다:",
    ...lines,
    "author_village({ target, houseCount, countPolicy, presetId }) 로 프리셋을 적용하세요. 목록에 없는 id는 쓰지 마세요.",
  ].join("\n");
}

function clusterRulePreferenceSection(project: Project, mapId: string | undefined): string {
  const tilesetIds = currentTilesetIds(project, mapId);
  const lines: string[] = [];
  let hardCount = 0;
  for (const tilesetId of tilesetIds) {
    const tileset = project.tilesets[tilesetId];
    if (!tileset) continue;
    for (const group of tileset.tileGroups ?? []) {
      for (const rule of clusterRules(group)) {
        if (rule.strength === "hard") {
          hardCount += 1;
          continue;
        }
        lines.push(`- ${tileset.id}/${group.name}: ${strengthLabel(rule.strength)} ${ruleText(rule)}`);
      }
    }
  }
  if (hardCount === 0 && lines.length === 0) return "";
  return [
    "## 클러스터 규칙 선호 힌트",
    "강함 규칙 위반은 커밋이 거부됩니다.",
    "맵을 편집한 뒤 run_lint로 규칙 위반을 확인하세요.",
    ...lines.slice(0, 16),
    lines.length > 16 ? `- …외 ${lines.length - 16}개 규칙은 get_tile_info/run_lint로 확인` : "",
  ].filter((line) => line.length > 0).join("\n");
}

function currentTilesetIds(project: Project, mapId: string | undefined): readonly string[] {
  const id = mapId && project.maps[mapId] ? mapId : project.startMapId;
  const tilesetId = project.maps[id]?.tilesetId;
  if (tilesetId) return [tilesetId];
  return Object.keys(project.tilesets);
}

function clusterRules(group: TileGroupMetadata): readonly ClusterRuleHint[] {
  if (!("rules" in group)) return [];
  const rules = group.rules;
  if (!Array.isArray(rules)) return [];
  return rules.filter(isClusterRuleHint);
}

function isClusterRuleHint(rule: unknown): rule is ClusterRuleHint {
  if (typeof rule !== "object" || rule === null) return false;
  if (!("id" in rule) || typeof rule.id !== "string") return false;
  if (!("kind" in rule) || !isClusterRuleKind(rule.kind)) return false;
  if (!("strength" in rule) || !isClusterRuleStrength(rule.strength)) return false;
  return !("message" in rule) || rule.message === undefined || typeof rule.message === "string";
}

function isClusterRuleKind(value: unknown): value is ClusterRuleKind {
  return value === "adjacency" || value === "spacing" || value === "count" || value === "surface";
}

function isClusterRuleStrength(value: unknown): value is ClusterRuleStrength {
  return value === "hard" || value === "medium" || value === "soft";
}

function strengthLabel(strength: ClusterRuleStrength): string {
  return strength === "medium" ? "중간(권장)" : strength === "soft" ? "느슨함(선호)" : "강함(반드시)";
}

function kindLabel(kind: ClusterRuleKind): string {
  if (kind === "adjacency") return "인접성";
  if (kind === "spacing") return "간격";
  if (kind === "surface") return "배치 면";
  return "개수";
}

function ruleText(rule: ClusterRuleHint): string {
  const message = rule.message?.trim();
  if (message) return message.slice(0, 120);
  // 배치 면은 params 가 조건 그 자체다 — 문장이 없어도 "북쪽(위) 벽에 붙은 바닥"까지 복원한다.
  // 이 규칙은 실제로 집행되므로(찍는 순간 검사) 모델이 조건을 정확히 알아야 한다.
  if (rule.kind === "surface") {
    const surface = surfaceRuleFromClusterRule({ id: rule.id, kind: "surface", params: rule.params ?? {}, strength: "hard" });
    if (surface) return `${describePlacementSurface(surface)}에만 놓입니다(어기면 시공이 거부됨)`;
  }
  return `${kindLabel(rule.kind)} 규칙 ${rule.id}`;
}

// 시스템 프롬프트 전체 조립. 예산 초과 섹션은 잘라내고 조회 안내로 대체.
export function buildSystemPrompt(project: Project, options: ContextOptions = {}): string {
  // 툴 능력 색인은 예산 슬라이싱 밖의 고정 버지다. 아래 조립·잘라내기는 색인을 모르는 상태로 진행되고
  // (= 기존 섹션들은 색인 도입 이전과 동일한 예산 공간을 유지), 색인은 마지막에 INTRO 뒤로 삽입된다.
  // 예산에 더해 재조립하는 방식이 아니라 예산 밖으로 믄 이유: tokenBudget.calibratedBudgetChars 가
  // 예산을 6000자까지 줄이면 INTRO(8000자+) 지점에서 슬라이싱이 끈기고, 색인을 예산 안에 놓으면
  // 그 끈김에 통째 사라진다 — 그러면 모델은 존재하는 기능을 다시 "없다"고 오보한다.
  const budget = options.budgetChars ?? DEFAULT_BUDGET_CHARS;
  const sections: string[] = [INTRO, summarySection(project), BALANCE_NOTE, RESOURCE_HINT];
  const currentMapId = resolveContextMapId(options);
  const tileSemantics = tileSemanticsSection(project);
  if (tileSemantics) sections.push(tileSemantics);
  const charsetLabelKnowledge = charsetLabelSection(project);
  if (charsetLabelKnowledge) sections.push(charsetLabelKnowledge);
  const tileVocabulary = tileVocabularySection(project, currentMapId);
  if (tileVocabulary) sections.push(tileVocabulary);
  const structureKits = structureKitSection(project, currentMapId);
  if (structureKits) sections.push(structureKits);
  const conceptBundles = conceptBundleSection(project);
  if (conceptBundles) sections.push(conceptBundles);
  const interiorCatalog = interiorCatalogSection(project, currentMapId);
  if (interiorCatalog) sections.push(interiorCatalog);
  // 사용자 저작 마을 데이터는 코드 상수 요약(집 키트)보다 앞이다 — 예산 초과 시 뒤에서 잘리므로
  // 순서가 곧 우선순위다. 유저가 정한 값이 잘려 나가면 모델이 기본값으로 되돌아간다.
  const villageAuthoring = villageAuthoringSection(project);
  if (villageAuthoring) sections.push(villageAuthoring);
  sections.push(houseKitSection());
  const clusterRulePreferences = clusterRulePreferenceSection(project, currentMapId);
  if (clusterRulePreferences) sections.push(clusterRulePreferences);
  const viewport = resolveContextViewport(options);
  const mapRegion = mapRegionSection(project, currentMapId, viewport);
  if (mapRegion.detail) sections.push(mapRegion.detail);

  let assembled = sections.join("\n\n");
  const remaining = budget - assembled.length;
  if (remaining > 200) {
    const style = styleSection(project, remaining - 100);
    if (style) assembled += `\n\n${style}`;
  }

  if (assembled.length > budget) {
    const overflow = assembled.length - budget;
    const trimmed = assembled.length - budget;
    assembled = `${assembled.slice(0, budget)}\n\n[예산 초과: ${trimmed}자 잘림 · 잘린 구간은 조회 툴(get_map_region 등)로 직접 조회하세요. 모델·사용자 모두에게 고지됨]`;
    void overflow;
  }
  // 현재 맵 머리는 예산 밖 고정 버지 — 절단 뒤에 붙인다(#262).
  if (mapRegion.header) assembled += `\n\n${mapRegion.header}`;
  // 감독 지침도 능력 색인·성향 기억과 같은 **예산 밖 고정분**이다. 예산 안에 두면 tokenBudget 보정이
  // 예산을 6,000자까지 줄인 세션에서 슬라이싱에 통째로 잘려, 사용자가 박아 둔 규칙이 조용히
  // 사라진다 — 사라진 줄 아무도 모르는 것이 이 블록의 최악 실패다(색인을 예산 밖에 둔 이유와 동일).
  return withProjectInstructions(
    withWorldCanon(withFixedBlocks(assembled, options.preferenceMemorySection), project.worldCanon),
    project.aiInstructions,
  );
}

function withProjectInstructions(assembled: string, instructions: string | undefined): string {
  const section = aiInstructionsSection(instructions);
  return section ? `${assembled}\n\n${section}` : assembled;
}

// 세계관 한 장도 감독 지침과 같은 예산 밖 고정분이다. 예전 엔티티 다이제스트(최대 700토큰, 코드카드 덤프)는
// 배제했고(worldAiExclusion), 이것은 이름·전제·금지·법칙 + 본문 600자 상한의 한 장이다.
function withWorldCanon(assembled: string, canon: Project["worldCanon"]): string {
  const section = worldCanonPromptSection(canon);
  return section ? `${assembled}\n\n${section}` : assembled;
}

// 예산 밖 고정 블록: 툴 능력 색인 + 이벤트 페이지 의미론 + 사람 성향.
// 삽입 지점은 INTRO 가 잘리지 않았으면 INTRO 다음, INTRO 자체가 잘린 초소형 예산이라면 맨 앞.
// 어느 경우도 세 블록 전부가 남는다 — 색인은 "어떤 기능이 존재하는가"(상세 지침보다 우선하는 정보),
// 페이지 의미론은 잘리면 모델이 조용히 죽는 이벤트 페이지를 저작하고,
// 성향은 예산 슬라이싱에 걸리면 통째로 사라져 "AI 가 나를 기억하지 못한다"가 그대로 재발한다.
// 성향 블록은 자체 하드캡(12줄/1,200자)이 있어 예산 밖에 둬도 프롬프트를 잡아먹지 않는다.
function withFixedBlocks(assembled: string, preferenceMemorySection?: string): string {
  const index = buildToolCapabilityIndex();
  const memory = preferenceMemorySection?.trim() ?? "";
  const fixed = [index, EVENT_PAGE_SEMANTICS_BLOCK, ...(memory ? [memory] : [])].join("\n\n");
  if (assembled.startsWith(INTRO)) {
    return `${INTRO}\n\n${fixed}${assembled.slice(INTRO.length)}`;
  }
  return `${fixed}\n\n${assembled}`;
}

function trimDigestLines(lines: readonly string[], maxTokens: number): string {
  const full = lines.join("\n");
  if (estimateTokens(full) <= maxTokens) return full;
  const included: string[] = [];
  for (const line of lines) {
    const remaining = lines.length - included.length - 1;
    const candidate = [...included, line, ...(remaining > 0 ? [`…외 ${remaining}개`] : [])].join("\n");
    if (estimateTokens(candidate) > maxTokens) break;
    included.push(line);
  }
  const omitted = lines.length - included.length;
  if (omitted <= 0) return included.join("\n");
  return [...included, `…외 ${omitted}개`].join("\n");
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
