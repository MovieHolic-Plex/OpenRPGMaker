// 실행 경로 — 지시 한 줄이 어느 루프로 가는가. 컴포저의 「경로」 셀렉트(설정과 같은 값)가 기본을 정하고,
// 슬래시 노브(`/pi` `/team` `/loop 3` `/30m`)는 언제나 명시적 Pi 다.
//
// 세션 루프(`src/ai/assistantSession.ts`)는 여기 없다(2026-09-10). 컴포저에서 조수 경로를 없애
// 지시·질문이 전부 Pi 로 간다 — 남은 세션 호출자는 선택 영역 작업·DB AI 바·클러스터 모달·벤치마크다.
//
// 자율성 다이얼도 여기서 Pi 노브로 풀린다: 예전에는 세션이 읽던 값이라 Pi 로 옮기면 다이얼이
// 조용히 무효가 된다(눈에만 살아 있는 컨트롤). 매핑은 한 곳에서 한다.

import type { AutonomyResolution } from "@/ai/autonomyLevels";
import type { PiAgentThinkingLevel } from "./protocol";

export const EXECUTION_ROUTES = ["pi-agent", "pi-team"] as const;
export type ExecutionRoute = (typeof EXECUTION_ROUTES)[number];

export const EXECUTION_ROUTE_LABEL: Readonly<Record<ExecutionRoute, string>> = {
  "pi-agent": "Pi 에이전트",
  "pi-team": "Pi 팀",
};

export const EXECUTION_ROUTE_DESCRIPTION: Readonly<Record<ExecutionRoute, string>> = {
  "pi-agent": "Pi 에이전트 하나가 현재 맵에서 끝까지 일하고 결과를 검토 카드로 낸다.",
  "pi-team": "팀장이 팀원을 나눠 배정하고 검수한다. 진행은 팀 패널과 보드에 보인다.",
};

// 기본은 Pi 에이전트다(2026-09-10): 평문 지시는 현재 맵에서 끝까지 일하는 Pi 로 간다.
export const DEFAULT_EXECUTION_ROUTE: ExecutionRoute = "pi-agent";

export type PiApplyMode = "review" | "auto";
export const DEFAULT_PI_APPLY: PiApplyMode = "review";

export function isExecutionRoute(value: unknown): value is ExecutionRoute {
  return typeof value === "string" && (EXECUTION_ROUTES as readonly string[]).includes(value);
}

/** 다이얼 한 값이 이번 실행에 대해 정하는 것 전부. */
export interface PiRunPlan {
  readonly route: ExecutionRoute;
  /** 쓰기 툴 없이 조회·보고만 한다(읽기 전용 레벨·계획 턴). */
  readonly readOnly: boolean;
  /** 실행하지 않고 계획만 세운다. Pi 에는 세션 플래너가 없으므로 프롬프트 지시로 만들고, readOnly 와 함께 쓴다. */
  readonly planOnly: boolean;
  /** 다이얼의 작업 예산 → Pi 턴 상한. */
  readonly maxTurns: number;
  /** 다이얼의 추론 강도 → Pi thinking level. */
  readonly thinkingLevel: PiAgentThinkingLevel;
}

/**
 * 슬래시 노브가 실제로 파싱됐다는 사실은 호출자(패널)가 파서에게서 받아 넘긴다 —
 * 여기서 문자열을 다시 뜯지 않는다(예전에는 `/pi` 접두사 판정이 이 함수와 파서 두 곳에 있었다).
 */
export function resolvePiRunPlan(input: {
  readonly explicitDirective: boolean;
  readonly preferred: ExecutionRoute;
  readonly autonomy: AutonomyResolution;
}): PiRunPlan {
  const { autonomy } = input;
  const effort: PiAgentThinkingLevel = autonomy.reasoningEffort;
  // 슬래시 노브는 사용자가 직접 쓴 지시다 — 다이얼의 읽기 전용·계획보다 세다(`/team` 을 골랐는데 답만 하면 더 놀랍다).
  if (input.explicitDirective) {
    return { route: "pi-agent", readOnly: false, planOnly: false, maxTurns: autonomy.budgetCap, thinkingLevel: effort };
  }
  // 계획 턴은 쓰이면 안 된다 — 세션에서는 플래너가 실행을 막았고, 여기서는 쓰기 툴 미제공이 그 역할을 한다.
  return {
    route: input.preferred,
    readOnly: autonomy.readOnly || autonomy.planOnly,
    planOnly: autonomy.planOnly,
    maxTurns: autonomy.budgetCap,
    thinkingLevel: effort,
  };
}
