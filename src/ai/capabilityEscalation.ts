// ai/capabilityEscalation.ts
// 자연어 능력 승격 (2026-08-27 실측). 기존 승격은 `mentionedToolSchemas` 하나뿐이라 사용자가
// 정확한 레지스트리 이름을 타이핑해야만 40툴 도메인 상한을 넘어 툴이 붙었다. 실측: "타이틀 화면
// 바꿔줘" → 도메인 core|map|system 슬라이스 40개에 set_title_screen 이 없고, 이름 언급도 아니어서
// 모델이 "그 기능이 없습니다"로 답했다(openwiki/editor-ai-tools.md 사건 기록).
// 여기서는 요청 문장을 find_tools 와 **같은 매처**(discoveryTools.matchScore)로 전체 활성 레지스트리에
// 채점해 같은 라운드에 최대 6개를 되살린다. 매처가 하나여야 모델이 find_tools 로 찾는 결과와
// 자동 승격 결과가 어긋나지 않는다.
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
// 이 선은 라운드당 예약 없는 40 작업 세트 계약(test/aiToolDiscoveryEscalation.test.ts)과도
// 맞는다 — 약한 추측이 도메인 툴을 밀어내면 손실이 이득보다 크다. 한 단어만 걸린 진짜 의도는
// 모델이 직접 호출하는 find_tools 승격이 다음 라운드에 잡는다.
export const MIN_CAPABILITY_MATCH_SCORE = 20;

/** 제공자(CPEN) 요청당 함수 스키마 상한. */
export const MAX_TURN_TOOL_SCHEMAS = 128;

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
  "delete_resource",
]);

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
  return activeTools()
    .map((tool, index) => ({ name: tool.name, index, score: matchScore(tool.name, tool.description, text) }))
    .filter((candidate) =>
      candidate.score >= MIN_CAPABILITY_MATCH_SCORE
      && !alreadyExposed.has(candidate.name)
      && !ESCALATION_DENYLIST.has(candidate.name))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, MAX_CAPABILITY_ESCALATED_TOOLS)
    .map((candidate) => candidate.name);
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

/**
 * 조립된 라운드 툴 목록을 제공자 상한(128) 안으로 결정론적으로 자른다.
 * 자연어 추측으로 얹은 승격 툴을 뒤에서부터 먼저 버린다 — 이름 언급/계획 요구/코어 툴이
 * 추측 때문에 밀려나면 원래 고치려던 "기능이 없다" 회귀가 되살아난다.
 */
export function clampTurnToolSchemas(
  tools: readonly OpenAiToolSchema[],
  escalatedNames: ReadonlySet<string>,
): OpenAiToolSchema[] {
  if (tools.length <= MAX_TURN_TOOL_SCHEMAS) return [...tools];
  const dropped = new Set<number>();
  let overflow = tools.length - MAX_TURN_TOOL_SCHEMAS;
  for (let index = tools.length - 1; index >= 0 && overflow > 0; index -= 1) {
    if (!escalatedNames.has(tools[index]!.function.name)) continue;
    dropped.add(index);
    overflow -= 1;
  }
  // 승격을 다 버려도 넘치면(계획 요구 툴이 폭증한 경우) 뒤에서부터 더 버린다.
  for (let index = tools.length - 1; index >= 0 && overflow > 0; index -= 1) {
    if (dropped.has(index)) continue;
    dropped.add(index);
    overflow -= 1;
  }
  return tools.filter((_, index) => !dropped.has(index));
}
