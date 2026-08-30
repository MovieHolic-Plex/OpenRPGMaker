// ai/systemPromptEnvelope.ts
// AI 표면 공용 시스템 프롬프트 봉투 — 정책과 사람 성향이 주입되는 단일 지점.
//
// 왜 필요한가(실측): 전송층은 llmClient.chatCompletion 하나로 모여 있었지만 프롬프트 층은 갈라져 있었다.
// buildSystemPrompt(contextBuilder)은 AssistantSession 경로만 쓰고, 이벤트 커맨드 어시스트·구조 키트
// 편집창·타일셋 분석은 각자 시스템 프롬프트를 손으로 만들어 AGENT_UX_POLICY_LINES 를 한 줄도 못 받았다.
// 정책을 promptPolicies.ts 한 곳에 모아둬도 닿는 범위가 한 경로뿐이면 통합이 아니다.
//
// 봉투를 씌우지 않는 것: ORCHESTRATOR_SYSTEM_PROMPT(workPlan) 와 SUMMARIZATION_SYSTEM_PROMPT
// (contextCompaction). 둘은 사람과 대화하지 않는 내부 플래너·요약기다 — 성향을 넣으면 계획과 요약이
// 취향으로 오염되고, 톤 규칙(3~5문장·초보자 언어)은 JSON/요약 산출물에 해롭다.

import type { AiSurface } from "./assistantEndpoint";
import { buildPreferenceMemorySection } from "./preferenceMemory";
import { AGENT_UX_POLICY_LINES } from "./promptPolicies";

// 표면 어휘는 assistantEndpoint 가 소유한다 — 엔드포인트 정책과 프롬프트 봉투가 같은 표면 목록을
// 봐야 한다. 두 벌로 두면 표면을 하나 늘릴 때 한쪽만 갱신돼 조용히 갈라진다.
export type { AiSurface };

export interface EnvelopeOptions {
  readonly surface: AiSurface;
  /** 채널 고유 지침. 기존 프롬프트 본문을 그대로 넘긴다. */
  readonly body: string;
  /** UX 응답 정책(톤·허위완료 금지·되묻기 규칙). 사람에게 문장을 돌려주는 채널만 켠다. */
  readonly includePolicy?: boolean;
  /** 사람 성향 블록. JSON 전용 채널은 끈다(토큰만 먹고 산출물에 영향이 없다). */
  readonly includeMemory?: boolean;
  /** 프로젝트 한정 성향 조회 키(conversationScopeKey 값). 없으면 전역 성향만 붙는다. */
  readonly projectScopeKey?: string;
  /** 테스트/호출부 주입용. 생략하면 localStorage 기반 buildPreferenceMemorySection. */
  readonly memorySection?: string;
}

/**
 * 조립 순서: [성향] → [정책] → [본문].
 * 성향·정책은 짧은 고정 블록이고 본문은 채널마다 길이가 천차만별이다. 상위에서 프롬프트가 잘릴 때
 * 잘려도 되는 쪽(본문 꼬리)이 뒤에 있어야 고정 블록이 통째로 사라지지 않는다.
 */
export function composeSystemPrompt(options: EnvelopeOptions): string {
  const sections: string[] = [];
  if (options.includeMemory) {
    const memory = options.memorySection ?? buildPreferenceMemorySection(options.projectScopeKey);
    if (memory.trim().length > 0) sections.push(memory);
  }
  if (options.includePolicy) sections.push(AGENT_UX_POLICY_LINES);
  const body = options.body.trim();
  if (body.length > 0) sections.push(body);
  return sections.join("\n\n");
}
