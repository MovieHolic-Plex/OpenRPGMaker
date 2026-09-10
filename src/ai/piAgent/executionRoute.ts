// 실행 경로 — 지시 한 줄이 어느 루프로 가는가. 사용자는 컴포저의 「경로」 셀렉트(또는 설정)로 기본을 정하고,
// 질문·계획·선택 영역 작업은 기존 조수가 맡는다. `/pi …` 는 언제나 명시적 우선이다.
//
// 팀은 경로가 아니다(2026-09-11): 경로가 답하는 질문은 «어느 루프로 가는가» 하나이고 그 값은 둘뿐이다.
// 팀은 Pi 루프의 실행 모드(`PiAgentMode`)다. 예전에는 `pi-team` 이 세 번째 경로였지만, 그 값은
// 라우트 enum → `/pi team` 문자열 → 파서 → mode 로 **한 비트를 네 번 인코딩**했을 뿐이다. 그 비트의
// 자리는 이제 `AiConfig.piTeam` 하나다.

import type { ComposerMode } from "@/ai/composerMode";

export const EXECUTION_ROUTES = ["session", "pi-agent"] as const;
export type ExecutionRoute = (typeof EXECUTION_ROUTES)[number];

export const EXECUTION_ROUTE_LABEL: Readonly<Record<ExecutionRoute, string>> = {
  session: "조수",
  "pi-agent": "Pi 에이전트",
};

export const EXECUTION_ROUTE_DESCRIPTION: Readonly<Record<ExecutionRoute, string>> = {
  session: "기존 조수 루프. 제안 카드·승인·질문·계획을 모두 지원한다.",
  "pi-agent": "Pi 에이전트가 끝까지 일하고 결과를 검토 카드로 낸다. 팀 모드면 팀장이 맵을 나눠 배정하고 검수한다.",
};

// 옛 blob 의 `executionRoute: "pi-team"` 은 «Pi + 팀» 이었다. loadAiConfig 가 그 값을 보고 경로를
// pi-agent 로, piTeam 을 true 로 승격한다 — 옛 어휘는 여기 한 곳에만 남긴다.
export const LEGACY_PI_TEAM_ROUTE = "pi-team";

// 기본은 Pi 에이전트다(2026-09-10 변경): 생 입력은 현재 맵에서 끝까지 일하는 Pi 로 간다.
// `/pi …` 명시 입력·질문/계획/선택 영역의 세션 고정은 그대로다. 이전 기본(session)은
// 질문·계획 모드에서만 살아남는다.
export const DEFAULT_EXECUTION_ROUTE: ExecutionRoute = "pi-agent";

export type PiApplyMode = "review" | "auto";
export const DEFAULT_PI_APPLY: PiApplyMode = "review";
/** 팀 실행 기본값. 컴포저·설정의 「팀」 토글이 이 값을 덮는다. */
export const DEFAULT_PI_TEAM = false;

export function isExecutionRoute(value: unknown): value is ExecutionRoute {
  return typeof value === "string" && (EXECUTION_ROUTES as readonly string[]).includes(value);
}

export interface RouteDecision {
  readonly route: ExecutionRoute;
  /** 사용자에게 보일 이유(기본 경로에서 벗어났을 때만). */
  readonly reason: string | null;
}

export function resolveExecutionRoute(input: {
  readonly text: string;
  readonly composerMode: ComposerMode;
  readonly preferred: ExecutionRoute;
  readonly selectionTaskActive?: boolean;
}): RouteDecision {
  const trimmed = input.text.trim();
  if (trimmed === "/pi" || trimmed.startsWith("/pi ")) return { route: "pi-agent", reason: null }; // 파서가 agent/team 을 정한다
  if (input.composerMode === "ask") return { route: "session", reason: input.preferred === "session" ? null : "질문은 기존 조수가 답한다" };
  if (input.composerMode === "plan") return { route: "session", reason: input.preferred === "session" ? null : "계획 모드는 기존 조수가 맡는다" };
  if (input.selectionTaskActive) return { route: "session", reason: input.preferred === "session" ? null : "선택 영역 작업은 기존 조수가 맡는다" };
  return { route: input.preferred, reason: null };
}
