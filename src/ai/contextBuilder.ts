// ai/contextBuilder.ts
// 어시스턴트 시스템 프롬프트(한국어) 조립기. 순수 함수(브라우저 접근 금지).
// 구성: ① 에디터 소개 + 툴 사용 수칙 ② get_project_summary ③ 현재 맵 get_map_region 요약
//       ④ 자주 쓰는 리소스 시맨틱 요약 ⑤ 게임 스타일 문서 발췌 ⑥ 밸런스 상수.
// 토큰 예산(문자 수 근사) 상한을 넘으면 조회 툴 안내로 대체한다.

import { runTool } from "@/editor/tools";
import type { ToolContext } from "@/editor/tools";
import { HOUSE_KITS } from "@/editor/houseKit";
import { structureKitRepeatable } from "@/editor/harnessSuggestion/structureKitModel";
import { describePlacementSurface, surfaceRuleFromClusterRule } from "@/project/placementSurface";
import type { Project, TileGroupMetadata } from "@/project/types";
import { confidenceScore } from "@/project/tilesetPalette";
import { approvedVocabulary } from "@/project/tileVocabulary";
import { aiInstructionsSection } from "./projectInstructions";
import { AGENT_UX_POLICY_LINES } from "./promptPolicies";
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
// 13,200 → 20,000 (2026-08-30 모델 기준 재산정). 이 예산은 목표치가 아니라 **상한**이고 조립분은
// 프로젝트가 가진 내용만큼만 자라다 포화한다(실측: 맵 5개 19,514자에서 멈춤 — 예산을 20,000 에서
// 200,000 으로 올려도 한 글자도 늘지 않는다. 뷰포트를 100×100 으로 키워도 20,580 포화).
// 그래서 20,000 은 "현실적인 프로젝트에서 드롭이 일어나지 않는 지점"이고, 그 위는 무의미하다.
//
// 창 비례로 잡지 않는 이유: gemini-3.7-flash 의 창은 1,048,576 토큰(pi-catalog
// google-antigravity 항목)이라 20,000자 ≈ 5,000토큰은 창의 0.5% 다. 1%만 잡아도 40,000자인데
// 포화가 그 아래라 아무 일도 안 하면서, tokenBudget 보정 클램프 하한(기준값의 0.5×)만 같이
// 올려 축소 장치를 죽인다. 비용도 논점이 아니다 — 13,200 대비 +1,700토큰 ≈ 요청당 $0.0013
// (입력 $0.75/1M).
//
// 섹션 드롭 기구는 그대로 남는다: 맵 목록은 맵당 약 130자로 선형 증가해 100맵에서 32,614자가
// 되므로(dropOrder 밖의 summary 섹션) 큰 프로젝트에서는 여전히 꼬리 보호가 필요하다.
export const DEFAULT_BUDGET_CHARS = 20000;
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
  "고수준 툴 우선 — 트랩/즉사=place_trap 또는 make_horror_loop, 체크포인트=place_trap의 checkpoint 관례, 퍼즐=compile_puzzle, 조사=place_examine_hotspots 또는 make_gallery_room(이브 갤러리 원큐), 컷신=script_cutscene 또는 script_cutscene_preset(투더문 프리셋), 추격=make_chase_scene, NPC=place_npc/make_villager(대사 시 faceset changeFace 자동), 상점=set_shop_stock, 사냥터=make_hunting_ground, 조명=set_lighting_volume/set_scene_mood, 수역=fill_region(circle+물 그룹), 야외 집=author_house(kind:\"single\" 또는 kind:\"lots\"), **마을=author_village(target:{kind:\"existing\",mapId} 또는 target:{kind:\"new\",mapId,name,width,height,plannedMap}, countPolicy:\"exact\"). 나무=list_village_tree_assets/plant_tree_clusters(broadleaf-2x2)**, 성채=build_castle, **실내/방 맵 신규=start_interior_room_session 또는 run_interior_room_pipeline(반드시 새 mapId·이름). 기존 실내 맵 수정=그 mapId로 furnish_interior_space·fill_region·tile_erase·place_props(대상은 list_interior_room_sessions). 기존 맵 id로 세션 시작은 그 맵을 통째로 지우므로 map-exists로 거부된다. 실내 요청에는 author_house/author_village 금지**, 월드=plan_world/build_world, 퀘스트=define_quest→verify_quest.",
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
  "7. 여러 개를 요청받으면(예: NPC 3명, 집 2채) 전부 만들 때까지 멈추지 마세요. 일부만 하고 끝내는 것은 실패입니다.",
  "   사용자가 '진행/계속/진행해/진행하라고'라고 지시하면 추가 확인 질문 없이 끝까지 실행하세요.",
  "8. '깊은 대화'를 요청받으면 choices(선택지)와 분기 대사로 페이지를 풍부하게 구성하세요. lines에 여러 줄을 담을 수 있습니다.",
  "9. 작업이 끝나면 무엇을 변경했는지 한국어로 간결히 요약하세요.",
  "10. 타일을 깔 때는 추측하지 말고 get_tile_info로 의미·배치 규칙(placementRules)을 먼저 확인하세요.",
  "    사용자가 가르친 메타데이터(source=user)가 최우선 근거입니다. 그룹의 placementRules가 있으면 반드시 따르세요.",
  "11. 집/구조물(야외 외장)은 절대 벽 타일로 사각형을 채워 만들지 마세요. 야외 집은 author_house를 우선 사용하고,",
  "    건물 평면은 wings 사각형들의 합집합으로 설계하세요. 길/모래는 paint_road(style=dirt/sand)가 오토타일로 성형합니다.",
  "    **실내·방·인테리어 요청은 야외 집이 아니다.** 현재 맵에 author_house를 올리지 말고",
  "    start_interior_room_session(또는 run_interior_room_pipeline)으로 **새 mapId·요청 이름**의 실내 맵을 시공하세요",
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
  "    **호수/물/길 치우기:** get_map_region의 data.water.bounds로 위치를 잡고, set_build_spec clear에 **confirmDestroy:true**를 넣으세요(물도 비잔디라 구조물 보호에 걸림). 전체 맵 52×52를 show/get_map_region으로 반복 스캔하지 마세요.",
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
  "    단, 기존 구조물 파괴 위험(clear/overExisting/confirmDestroy/builtCells 보호)은 자동 보정하지 않습니다.",
  "    사용자가 맵에서 선택한 영역은 곧 암묵적 명세입니다.",
  "    배치 전 정리: 타일/구조물을 놓을 자리·주변에 기본 타일(잔디)이 아닌 것이 있으면 스스로 판단해",
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
    "배치는 v3 공정 프리미티브 + 고수준 툴. **집·마당:** author_house — LLM은 wings(위치)·kitId·yard 태그만(firewood/mailbox/bench_h/…), 좌표는 코드. **마을:** author_village에 theme·pathStyle·yardStyle 등 의도를 채워라(빈 호출 금지). **place_props:** 숲/들판 산포와 집에서 먼 소품(묘지 등)만 — 구역별, area 넓게, naturalness 0.55~0.7, 동일 인자 턴당 1회. 집 앞 소품을 광장에 몰지 말 것. **자리 줄:** 신도석·좌석·책상 줄은 산포 대신 arrange_rows(axis=통로축·aisleWidth·rowGap·symmetric). 호수: fill_region+circle(get_map_region data.water.bounds). 길: paint_road. 미합의 재료는 맵 목업 후 [이대로 적용]. 재료는 material=타일 라벨/설명만(그룹 id·*VocabId 금지). 모르면 tile_query ask:\"labels\".",
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

// 유저 붓질에서 학습·등록된 구조 킷(내 구조물) — 봇도 같은 킷으로 시공할 수 있음을 알린다.
// 타일 행렬은 여기 다 싣지 않는다(기계 표면) — list_structure_kits로 조회, 시공은 stamp_structure_kit.
function structureKitSection(project: Project, mapId: string | undefined): string {
  const lines: string[] = [];
  for (const tilesetId of currentTilesetIds(project, mapId)) {
    const tileset = project.tilesets[tilesetId];
    for (const kit of tileset?.structureKits ?? []) {
      const size = kit.kind === "house"
        ? {
            width: Math.max(...kit.wings.map((wing) => wing.x + wing.w), 1),
            height: Math.max(...kit.wings.map((wing) => wing.y + wing.h), 1),
          }
        : { width: kit.width, height: kit.height };
      const repeatable = structureKitRepeatable(kit);
      lines.push(
        `- ${kit.name ?? "구조물"} (${kit.id}, ${size.width}x${size.height}`
        + `${kit.ai?.role ? `, ${kit.ai.role}` : ""}, ${repeatable ? "반복 가능" : "한 채 완결"})`,
      );
      if (kit.ai?.description) lines.push(`  설명: ${kit.ai.description.slice(0, 100)}`);
      if (kit.ai?.placementRules) lines.push(`  배치: ${kit.ai.placementRules.slice(0, 100)}`);
      // 배치 조건은 산문이 아니라 **집행되는 조건**이다 — 어기면 stamp_structure_kit 이 거부한다.
      // 그래서 100자 자르기(placementRules)와 달리 전부 싣는다. 조건 수는 실무상 1~3개다.
      for (const condition of kit.ai?.placement ?? []) {
        lines.push(
          `  배치 조건[${condition.strength === "hard" ? "필수" : "권장"}]: ${describePlacementSurface(condition)}`
          + `${condition.message?.trim() ? ` — ${condition.message.trim().slice(0, 60)}` : ""}`,
        );
      }
    }
  }
  if (lines.length === 0) return "";
  return [
    "## 내 구조물(유저가 가르친 구조 킷 — 반복 구조 시공의 최우선 재료)",
    "유저가 손으로 찍어 등록한 반복 단면입니다. 성벽/울타리류 반복 구조 요청 시 개별 타일 대신 이 킷을 쓰세요:",
    ...lines,
    "상세(타일 행렬)는 list_structure_kits, 시공은 stamp_structure_kit(mapId, kitId, origin, repeat).",
  ].join("\n");
}

function houseKitSection(): string {
  const lines = Object.values(HOUSE_KITS).map((kit) => `- ${kit.id}: ${kit.name}`);
  return [
    "## 집 키트 요약",
    ...lines,
    "여러 채 시공 시 각 집에 서로 다른 kitId를 배정해 외관 다양성을 확보하라. 같은 kit 반복 금지.",
    "2채 이상은 author_house kind=lots + houses[]로 한 번에 호출(개별 single 반복 금지).",
    "wing 제약: w≥3, h≥5 (지붕+벽 포함). windows: false | {} | {spacing:N} (true 불가).",
    "길/모래는 paint_road(style=dirt/sand)가 8방 오토타일로 성형합니다.",
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
  const tileVocabulary = tileVocabularySection(project, currentMapId);
  if (tileVocabulary) sections.push(tileVocabulary);
  const structureKits = structureKitSection(project, currentMapId);
  if (structureKits) sections.push(structureKits);
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
  return withProjectInstructions(withFixedBlocks(assembled, options.preferenceMemorySection), project.aiInstructions);
}

function withProjectInstructions(assembled: string, instructions: string | undefined): string {
  const section = aiInstructionsSection(instructions);
  return section ? `${assembled}\n\n${section}` : assembled;
}

// 예산 밖 고정 블록: 툴 능력 색인 + 사람 성향.
// 삽입 지점은 INTRO 가 잘리지 않았으면 INTRO 다음, INTRO 자체가 잘린 초소형 예산이라면 맨 앞.
// 어느 경우도 두 블록 전부가 남는다 — 색인은 "어떤 기능이 존재하는가"(상세 지침보다 우선하는 정보),
// 성향은 예산 슬라이싱에 걸리면 통째로 사라져 "AI 가 나를 기억하지 못한다"가 그대로 재발한다.
// 성향 블록은 자체 하드캡(12줄/1,200자)이 있어 예산 밖에 둬도 프롬프트를 잡아먹지 않는다.
function withFixedBlocks(assembled: string, preferenceMemorySection?: string): string {
  const index = buildToolCapabilityIndex();
  const memory = preferenceMemorySection?.trim() ?? "";
  const fixed = memory ? `${index}\n\n${memory}` : index;
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
