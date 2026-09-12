// 조수 채팅의 실행 계획 — 루프는 Pi 하나다(2026-09-11).
//
// 예전에는 「경로」 enum(`session | pi-agent | pi-team`)이 «어느 루프로 가는가» 를 답했다. 조수 세션을
// deprecated 하면서 답할 것이 없어졌다: 사용자가 고르는 값은 이제 «그 Pi 를 무엇까지 허용하는가»
// 하나이고, 그 답은 자율성 다이얼(`autonomyLevels`)에서 나온다.
//
// 팀도 경로가 아니다 — Pi 루프의 실행 모드(`PiAgentMode`)다. 그 비트의 자리는 `AiConfig.piTeam`
// 하나이고, 컴포저 「팀」 토글과 설정 「Pi 팀 실행」 이 같은 값을 읽는다. 경로 enum 으로 한 번 더
// 인코딩하면 라우트 → `/pi team` 문자열 → 파서 왕복이 생겨 한 비트를 네 곳에서 표현하게 된다.

import type { AutonomyResolution } from "@/ai/autonomyLevels";
import type { PiAgentThinkingLevel } from "./protocol";

export type PiApplyMode = "review" | "auto";
export const DEFAULT_PI_APPLY: PiApplyMode = "review";
/** 팀 실행 기본값. 컴포저 「팀」 토글·설정 「Pi 팀 실행」 이 이 값을 덮는다. */
export const DEFAULT_PI_TEAM = false;

/**
 * 옛 blob 호환 어휘. 경로 enum 이 있던 시절 `executionRoute` 키가 저장돼 있다:
 * `"pi-team"` 은 «Pi + 팀» 이었고, `"session"`·`"pi-agent"` 는 둘 다 «Pi» 다. 새 코드는 이 키를
 * 쓰지 않는다 — 읽는 곳은 `loadAiConfig` 의 승격 한 곳뿐이다(옛 값을 지우면 사용자의 팀 설정이
 * 조용히 사라지고, 남겨 두면 두 어휘가 살아 있는 것처럼 보인다).
 */
export const LEGACY_PI_TEAM_ROUTE = "pi-team";
/** 다이얼 한 값이 이번 실행에 대해 정하는 것 전부. */
export interface PiRunPlan {
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
 * 레벨을 Pi 노브로 푼다. 계획 턴은 쓰이면 안 된다 — 세션에서는 플래너가 실행을 막았고, 지금은
 * 쓰기 툴 미제공(`readOnly`)이 그 역할을 한다.
 */
export function resolvePiRunPlan(autonomy: AutonomyResolution): PiRunPlan {
  return {
    readOnly: autonomy.readOnly || autonomy.planOnly,
    planOnly: autonomy.planOnly,
    maxTurns: autonomy.budgetCap,
    thinkingLevel: autonomy.reasoningEffort,
  };
}

