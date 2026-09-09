// ai/autonomyLevels.ts
// 자율성 다이얼의 코어 모델 매핑 — UI가 고르는 5단계 레벨을 LLM/세션 노브로 푼다.
// 이 다이얼이 지시줄의 **유일한** 컨트롤이다: 예전의 모드 3칩(지시/질문/계획)과 추론 강도
// 셀렉트는 여기로 흡수됐다 — 「질문」은 readOnly, 「계획」은 planOnly, 추론은 reasoningEffort.
// UI 파일은 이 모듈을 읽기만 한다(역방향 의존 없음). 세션 배선은 assistantSession 의
// autonomy() 헬퍼가 맡는다(레벨 명시 시에만 적용, 미지정은 종래 동작).
import type { AiConfig } from "./llmClient";

export const AUTONOMY_LEVEL_IDS = ["readonly", "confirm", "balanced", "autonomous", "max"] as const;
export type AutonomyLevel = (typeof AUTONOMY_LEVEL_IDS)[number];

export interface AutonomyLevelMeta {
  readonly id: AutonomyLevel;
  readonly label: string;
  readonly description: string;
}

export const AUTONOMY_LEVELS: readonly AutonomyLevelMeta[] = [
  { id: "readonly", label: "읽기 전용", description: "프로젝트를 바꾸지 않고 조회와 설명만 합니다." },
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
  /**
   * true면 그 턴을 세션의 ask 레일로 보낸다 — 쓰기 툴 스키마 미노출 + 호출 거부 + 초안 불변.
   *
   * 컴포저의 「질문」 칩이 하던 일이다. 칩을 없앤 뒤로 이 레일을 **사용자가 명시적으로** 부르는
   * 유일한 수단이며, 의도 선언의 `mode=question` 자동 승격(assistantSession 의 question→ask)보다
   * 우선한다 — 분류기가 create 로 읽어도 사용자가 고른 읽기 전용이 이긴다.
   */
  readOnly: boolean;
}

const RESOLUTIONS: Readonly<Record<AutonomyLevel, AutonomyResolution>> = {
  // budgetCap 4: 조회 몇 번. confirm(6)과 값을 겹치지 않게 둔다 — 예산은 자율성에 따라 단조 증가한다.
  readonly: { reasoningEffort: "low", agentMode: "chat", budgetCap: 4, planOnly: false, readOnly: true },
  // readonly 는 planOnly 가 아니다: ask 레일은 플래너를 스킵하므로(plannerSkipReasonFor "composer:ask")
  // 계획이 애초에 생기지 않는다. planOnly 를 켜면 실행할 수 없는 계획만 남는다.
  confirm: { reasoningEffort: "low", agentMode: "chat", budgetCap: 6, planOnly: true, readOnly: false },
  balanced: { reasoningEffort: "low", agentMode: "auto", budgetCap: 16, planOnly: false, readOnly: false },
  autonomous: { reasoningEffort: "medium", agentMode: "auto", budgetCap: 32, planOnly: false, readOnly: false },
  // budgetCap 48 = AGENT_RUN_MAX_TOTAL_STEPS(assistantSession) — 자율 런 전체 예산과 일치.
  max: { reasoningEffort: "high", agentMode: "auto", budgetCap: 48, planOnly: false, readOnly: false },
};

/** 레벨을 세션 노브로 푼다. 호출마다 새 객체를 돌려준다(호출자 변이가 테이블을 오염시키지 않는다). */
export function resolveAutonomy(level: AutonomyLevel): AutonomyResolution {
  return { ...RESOLUTIONS[level] };
}
