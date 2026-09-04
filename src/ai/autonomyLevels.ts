// ai/autonomyLevels.ts
// 자율성 다이얼의 코어 모델 매핑 — UI가 고르는 4단계 레벨을 LLM/세션 노브로 푼다.
// UI 파일은 이 모듈을 읽기만 한다(역방향 의존 없음). 실제 세션 배선은 후속 작업.
import type { AiConfig } from "./llmClient";

export const AUTONOMY_LEVEL_IDS = ["confirm", "balanced", "autonomous", "max"] as const;
export type AutonomyLevel = (typeof AUTONOMY_LEVEL_IDS)[number];

export interface AutonomyLevelMeta {
  readonly id: AutonomyLevel;
  readonly label: string;
  readonly description: string;
}

export const AUTONOMY_LEVELS: readonly AutonomyLevelMeta[] = [
  { id: "confirm", label: "확인", description: "계획만 세우고 실행 전에 항상 확인을 받습니다." },
  { id: "balanced", label: "균형", description: "계획을 세우고 통상 예산 안에서 자동으로 실행합니다." },
  { id: "autonomous", label: "자율", description: "더 깊은 추론과 큰 예산으로 장시간 작업을 이어갑니다." },
  { id: "max", label: "최대", description: "가장 강한 추론과 전체 런 예산으로 끝까지 실행합니다." },
];

export interface AutonomyResolution {
  reasoningEffort: NonNullable<AiConfig["reasoningEffort"]>;
  agentMode: NonNullable<AiConfig["agentMode"]>;
  /** 이 레벨이 한 런에서 쓸 수 있는 작업 예산(도구 호출 상한의 의미). */
  budgetCap: number;
  /** true면 계획만 세우고 실행하지 않는다(승인 대기). */
  planOnly: boolean;
}

const RESOLUTIONS: Readonly<Record<AutonomyLevel, AutonomyResolution>> = {
  confirm: { reasoningEffort: "low", agentMode: "chat", budgetCap: 6, planOnly: true },
  balanced: { reasoningEffort: "low", agentMode: "auto", budgetCap: 16, planOnly: false },
  autonomous: { reasoningEffort: "medium", agentMode: "auto", budgetCap: 32, planOnly: false },
  // budgetCap 48 = AGENT_RUN_MAX_TOTAL_STEPS(assistantSession) — 자율 런 전체 예산과 일치.
  max: { reasoningEffort: "high", agentMode: "auto", budgetCap: 48, planOnly: false },
};

/** 레벨을 세션 노브로 푼다. 호출마다 새 객체를 돌려준다(호출자 변이가 테이블을 오염시키지 않는다). */
export function resolveAutonomy(level: AutonomyLevel): AutonomyResolution {
  return { ...RESOLUTIONS[level] };
}
