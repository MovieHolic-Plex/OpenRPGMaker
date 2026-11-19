// 조수의 공장 기본 = ChatGPT(Codex 계정 로그인) · GPT-6.2 Sol · medium — 한 곳(오너 결정 2026-11-19: 「기본 AI 를 ChatGPT 로」).
//
// 새로 설정하는 사용자(저장된 AI 설정이 없는 사람)의 계획·실행·시각·작문·시공·감독이 모두 이 모델 · 이 강도다.
// ChatGPT 구독(Codex CLI) · 편집기 안 ChatGPT 로그인 첫 실행 마법사(planDefaults)도 같은 값을 쓴다.
// 지난 기본: 2026-10-14 Google(Gemini 4 Argon) → 2026-11-16 Claude(Opus 5.5 medium) → 2026-11-19 ChatGPT(Terra medium).
// 2026-11-19 오너 결정: Terra 로는 게임을 못 만든다 → GPT-6.2 Sol · medium.
// 저장된 Terra 는 읽을 때 Sol 로 옮긴다. Google·Claude 계정 선택은 유지한다.
//
// 의존이 없는 모듈이다 — 브라우저 번들과 순수 Node(동반 서비스) 양쪽이 상대 경로 + 확장자로 읽는다.

/** 정식 ID. Codex 카탈로그(src/ai/modelCatalog.ts)와 앱 경로 모델표(scripts/lib/ohMyPiModel.ts)에 모두 있다. */
export const ASSISTANT_CHATGPT_MODEL = "gpt-6.2-sol";
export const ASSISTANT_CHATGPT_EFFORT = "medium" as const;

// 2026-11-19 오너 결정 — 직접 고른 Terra 도 게임 제작 칸에서는 Sol 로 읽는다.
export function isLegacyTerraModel(model: unknown): boolean {
  return typeof model === "string" && model.trim().toLowerCase() === "gpt-6.1-terra";
}

export function atLeastMediumEffort<T extends string>(effort: T | undefined): T | "medium" {
  return effort === "high" || effort === "xhigh" || effort === "max" ? effort : ASSISTANT_CHATGPT_EFFORT;
}
