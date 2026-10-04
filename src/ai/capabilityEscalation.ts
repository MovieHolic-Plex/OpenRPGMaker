// ai/capabilityEscalation.ts
// Deterministic natural-language ranking for the AssistantSession first-round
// candidate set and other explicitly scoped consumers. It never acts as a
// safety/approval gate; an empty or failed route can still use the full fallback.
import { activeTools } from "@/editor/tools";
import { matchScore } from "@/editor/tools/discoveryTools";
import type { OpenAiToolSchema } from "./llmClient";
import { toolSchemasForNames } from "./planToolExposure";

/** 한 라운드에 자연어 매칭으로 얹을 수 있는 최대 툴 수. find_tools 결과 상한(6)과 같게 둔다. */
export const MAX_CAPABILITY_ESCALATED_TOOLS = 6;

// 최소 점수 20 — matchScore 기준으로 요청 단어가 툴 이름/설명에 그대로 등장하면 10점,
// 부분 문자열만 스치면 5점, 요청 문구가 이름/설명에 통째로 들어가면 60점 이상이다. 실측 예:
//   "타이틀 화면 바꿔줘" → set_title_screen 20(타이틀·화면 두 단어 일치) → 승격.
//     같은 문장의 set_project_settings 10, place_door·fill_region·create_map 5 → 탈락.
//   "마을 만들고 NPC 넣고 퀘스트 주고 상성표 만들고 엔딩 조건까지" → 10~15점 대역은
//     tile_erase·make_gallery_room·list_npc_graphics 처럼 어미/조사가 스친 노이즈가 지배한다.
// 즉 우연히 스친 단어 하나로는 툴이 끌려오지 않고, 기능어가 둘 이상 맞아야 승격된다.
export const MIN_CAPABILITY_MATCH_SCORE = 20;

/**
 * 자연어 추측으로는 **절대 얹지 않는** 툴(2026-08-29 modify 진단 근본원인 12).
 *
 * 승격은 요청 단어와 툴 이름·설명의 어휘 일치일 뿐 의도 판정이 아니다. 되돌릴 수 없는 폐기 툴은
 * 그 추측이 한 번만 맞아떨어져도 사용자의 작업물이 사라진다 — 실측 위험 문장: "상점 재고를
 * 초기화해줘"(reset_project), "이 맵 지워버리고 다시"(remove_map). 모델이 정말 필요하다고
 * 판단하면 도메인 노출(system)·이름 언급·find_tools 로 여전히 손에 잡히므로, 막히는 것은
 * "요청 단어가 스쳤다"는 이유만으로 자동으로 얹히는 경로 하나뿐이다.
 */
export const ESCALATION_DENYLIST: ReadonlySet<string> = new Set([
  "reset_project",
  "remove_map",
  // 맵 전체 청소는 remove_map 과 같은 규모의 소실을 만든다 — 이름이 스쳤다는 이유로 얹지 않는다.
  "clear_map",
  "delete_resource",
  // 오프닝 제거는 작성한 장면을 통째로 지운다 — 같은 규칙으로 자동 승격에서 뺀다.
  "remove_opening",
]);

/**
 * 한 툴이 승격되면 같이 얹을 짝. 그림만 만들고 움직임 도구를 못 보면 모델은 이미 노출된 raw script_cutscene 으로
 * 좌표를 손으로 계산한다(2026-10-02 멧돼지 컷신 시험: 그림은 만들고도 3판 모두 raw beat). 승격 상한과 별개로 붙는다.
 */
const ESCALATION_COMPANIONS: Readonly<Record<string, readonly string[]>> = {
  generate_cutscene_art: ["script_cutscene_staged", "preview_cutscene"],
  // 건물 조립 도구는 부품 id 를 조회 도구로 먼저 확인해야 한다 — 한쪽만 승격되면 모델이 id 를 추측한다(UNKNOWN_PART).
  build_jp_city_building: ["list_jp_city_building_parts"],
  list_jp_city_building_parts: ["build_jp_city_building"],
};

function hasSearchableWord(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text);
}

/**
 * 요청 문장과 이번 라운드에 이미 노출된 툴 이름을 받아, 자연어로 요청된 기능에 해당하는
 * 추가 툴 이름을 결정론으로 고른다(점수 내림차순 → 레지스트리 순서, 최대 6개).
 */
export function capabilityEscalatedToolNames(
  requestText: string,
  alreadyExposed: ReadonlySet<string>,
): string[] {
  const text = requestText.trim();
  if (!hasSearchableWord(text)) return [];
  const ranked = activeTools()
    .map((tool, index) => ({ name: tool.name, index, score: matchScore(tool.name, tool.description, text) }))
    .filter((candidate) =>
      candidate.score >= MIN_CAPABILITY_MATCH_SCORE
      && !alreadyExposed.has(candidate.name)
      && !ESCALATION_DENYLIST.has(candidate.name))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, MAX_CAPABILITY_ESCALATED_TOOLS)
    .map((candidate) => candidate.name);
  const known = new Set(activeTools().map((tool) => tool.name));
  const companions = ranked.flatMap((name) => ESCALATION_COMPANIONS[name] ?? [])
    .filter((name) => known.has(name) && !alreadyExposed.has(name) && !ranked.includes(name));
  return [...ranked, ...new Set(companions)];
}

/** 위 결과를 OpenAI 스키마로. deprecated 는 toolSchemasForNames 가 걸러낸다. */
export function capabilityEscalationSchemas(
  requestText: string,
  alreadyExposed: ReadonlySet<string>,
): OpenAiToolSchema[] {
  const names = capabilityEscalatedToolNames(requestText, alreadyExposed);
  if (names.length === 0) return [];
  return toolSchemasForNames(names);
}
