// ai/session/budgets.ts
// 하네스가 사용자 개입 없이 태울 수 있는 수치 상한. 항목별 Ralph 상한과 턴당 자동 진행
// 상한은 workPlan.ts 가 소유한다 — 여기는 세션이 직접 세는 것만 담는다.

export const MAX_ESCALATED_TOOLS_PER_TURN = 16;

/**
 * 한 항목에서 **같은 쓰기 툴 + 같은 실패 요약**을 연속으로 몇 번까지 허용하는가 (2026-09-03).
 * 스펙 게이트 거부처럼 인자를 바꾸지 않으면 영원히 같은 결과인 실패가 여기서 끊긴다.
 */
export const MAX_REPEATED_TOOL_FAILURES_PER_ITEM = 4;

// 검증 실패 허용 횟수(턴당). 초과하면 계획 폐기를 지시한다 — 루프 방지.
export const MAX_SPEC_REJECTIONS = 3;

/**
 * 자율 런(autonomous driver)의 총 예산 — 자동 계속 턴 수 상한.
 * 턴당 Ralph 상한(MAX_WORK_PLAN_AUTO_STEPS_PER_TURN)과 별개로, 하나의 목표에 대해
 * 하니스가 사용자 개입 없이 소비할 수 있는 총 턴 수를 묶는다. 소진 시
 * agent_run_budget_exhausted 감사를 남기고 멈추며, 사용자의 「계속」 한마디로 재가동된다.
 */
export const AGENT_RUN_MAX_TOTAL_STEPS = 48;
