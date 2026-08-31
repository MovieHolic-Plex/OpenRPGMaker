// ai/plannerSkip.ts
// 짧은/질문/선택-범위 턴은 플래너 LLM 왕복을 건너뛴다.
//
// agentMode auto 는 매 턴 플래너를 돌렸다. 플래너가 action=direct 를 골라도
// 그 결정을 듣기 위해 왕복 한 판을 이미 내므로, "여기 나무 심어줘" 가 수 초
// 침묵한다. 요청 모양만으로 스킵을 정한다 — 스킵 여부를 LLM 에 물으면 같은
// 왕복이다. 진행 중인 WorkPlan 은 세션이 이 함수 밖에서 지킨다.

import { isProtocolLocked } from "./intentClarify";
import { stripContextFooter } from "./modifyIntent";
import { requestNeedsVolumePlan } from "./volumeContract";

export type PlannerSkipReason = "protocol-locked" | "question" | "selection" | "simple";

/** 이 길이 미만이고 다단계 표지가 없으면 플래너를 건너뛴다. */
export const PLANNER_SKIP_MAX_CHARS = 72;

const QUESTION_RE =
  /[?？]|뭐야|무엇|어디|왜 |왜요|설명해|알려줘|알려 줘|보여줘|보여 줘|뭐가|몇 개|몇개|누구/u;

const MULTI_STEP_RE =
  /마을|도시|정착지|퀘스트|스토리|던전|캠페인|시나리오|엔딩|컷신|여러\s*맵|다른\s*맵|맵을\s*더|맵을\s*\d|세계\s*를|탐험|여관|대장간|시장|광장|author_village|build_village|먼저.{0,12}(?:그\s*다음|그리고)|단계로|레이어로/u;

function looksLikeQuestion(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (QUESTION_RE.test(trimmed)) return true;
  return trimmed.length <= 24 && /(?:인가요|인가\?|할까요|해줘\?|야\?)\s*$/u.test(trimmed);
}

function hasSelectionScope(rawText: string): boolean {
  return /사용자 선택 영역:/u.test(rawText);
}

/**
 * 이번 턴의 사용자 메시지(가이드·푸터 포함 가능)를 보고 플래너를 건너뛸지 정한다.
 * 진행 중인 WorkPlan 은 호출부가 막는다 — 이어가기는 플래너가 resume/replan 해야 한다.
 */
export function plannerSkipReason(rawText: string): PlannerSkipReason | null {
  if (isProtocolLocked(rawText)) return "protocol-locked";
  if (hasSelectionScope(rawText)) return "selection";
  const text = stripContextFooter(rawText).trim();
  if (!text) return "simple";
  if (looksLikeQuestion(text)) return "question";
  if (MULTI_STEP_RE.test(text) || requestNeedsVolumePlan(text)) return null;
  if (text.length < PLANNER_SKIP_MAX_CHARS) return "simple";
  return null;
}

export function shouldSkipPlanner(rawText: string): boolean {
  return plannerSkipReason(rawText) !== null;
}
