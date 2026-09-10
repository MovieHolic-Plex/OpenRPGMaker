// ai/session/orchestration.ts
// 하네스가 대화 중간에 꽂는 오케스트레이션 메시지의 접두사·단계 지시문과 그 판별.
// 턴이 끝나면 이 판별로 주입분만 걷어낸다 — 사용자 발화와 섞이면 다음 턴이 오염된다.

import type { ChatMessage } from "../llmClient";

export const ORCHESTRATION_PREFIX = "[오케스트레이션] ";

// 배치 지시는 **쓰기끼리**로 한정한다. 읽기 크레딧은 모델에게 전달된 뒤에만 적립되므로
// (ToolReadEvidence.observeDelivered) 조회와 쓰기를 한 응답에 담으면 read-before-write 게이트가
// 반드시 실패한다. 예전 문구는 그 조합을 권장해 게이트와 정면 충돌했다(2026-09-10 실측).
export const EXECUTION_PHASE_HINT = "실행 단계: 계획을 충실히 수행, 누락 없이 완료 후 종료. 새 질문 금지. 한 응답에 여러 tool_calls를 배치해 라운드 수를 최소화하라(예: fill_region + author_house + paint_road를 동시에). 단 조회(get_*·find_*)와 그 값을 쓰는 쓰기 툴은 같은 응답에 담지 말 것 — 조회 결과는 다음 응답에서야 전달되므로 함께 담으면 조회 선행 조건이 반드시 미충족된다.";
export const ZERO_CHANGE_REKICK_HINT = "사용자는 변경을 기대합니다. 질문이 아니면 지금 계획을 세우고 실행하세요";
export const UNBUILT_SPEC_REKICK_HINT =
  "밑그림(set_build_spec)만 확정되었고 실제 배치 툴이 한 번도 호출되지 않았습니다. " +
  "밑그림은 사용자에게 보이지 않고 승인할 대상도 아닙니다 — 다시 밑그림을 제출하지 말고 " +
  "명세의 에셋을 실제로 만드는 배치 툴(place_npc · make_villager · author_house · place_props 등)을 지금 호출하세요.";

export function orchestrationContent(content: string): string {
  return `${ORCHESTRATION_PREFIX}${content}`;
}

export function isOrchestrationMessage(message: ChatMessage, index: number): boolean {
  if (index === 0) return false;
  if (typeof message.content !== "string") return false;
  if (message.role === "user" && message.content.startsWith(ORCHESTRATION_PREFIX)) return true;
  // 핫픽스 전 세션에 남아 있을 수 있는 mid-history system 주입도 턴 종료 시 제거한다.
  if (message.role !== "system") return false;
  return (
    message.content === EXECUTION_PHASE_HINT ||
    message.content.startsWith("검수 단계:") ||
    message.content.startsWith("검수 보완 지시:")
  );
}
