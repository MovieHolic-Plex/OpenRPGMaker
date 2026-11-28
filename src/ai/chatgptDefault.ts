// 조수 공장 기본 및 ChatGPT(Codex 계정·CLI 구독) 길의 기본 = GPT-6.2 Sol · high — 한 곳(오너 결정 2026-11-28).
// 새 설치(저장된 설정 없음)와 첫 실행 마법사의 첫 순위가 ChatGPT(GPT-6.2 Sol · high)다. Claude·Google 도 그대로 고를 수 있고,
// 이미 저장된 설정은 옮기지 않는다.
//
// ChatGPT 를 고른 설정의 계획·실행·시각·작문·시공·감독과 곁 호출(화면 검수·검토자)이 모두 이 모델 · 이 강도다.
// ChatGPT 구독(Codex CLI) · 편집기 안 ChatGPT 로그인 첫 실행 마법사(planDefaults)도 같은 값을 쓴다.
// 지난 기본: 2026-10-14 Google(Gemini 4 Argon) → 2026-11-16 Claude(Opus 5.5 medium) → 2026-11-19 ChatGPT(Sol 6.2 medium)
// → 2026-11-23 Claude(Sonnet 5.5 high) → 2026-11-28 ChatGPT(GPT-6.2 Sol high).
// 2026-11-19 오너 결정: Terra 로는 게임을 못 만든다 → 저장된 Terra 는 읽을 때 Sol 로 옮긴다. Google·Claude 계정 선택은 유지한다.
//
// 의존이 없는 모듈이다 — 브라우저 번들과 순수 Node(동반 서비스) 양쪽이 상대 경로 + 확장자로 읽는다.

/** 정식 ID. Codex 카탈로그(src/ai/modelCatalog.ts)와 앱 경로 모델표(scripts/lib/ohMyPiModel.ts)에 모두 있다. */
export const ASSISTANT_CHATGPT_MODEL = "gpt-6.2-sol";
export const ASSISTANT_CHATGPT_EFFORT = "high" as const;

// 2026-11-19 오너 결정 — 직접 고른 Terra 도 게임 제작 칸에서는 Sol 로 읽는다.
export function isLegacyTerraModel(model: unknown): boolean {
  return typeof model === "string" && /^(?:openai\/)?gpt-[\d.]+-terra$/iu.test(model.trim());
}

export function atLeastMediumEffort<T extends string>(effort: T | undefined): T | "medium" {
  return effort === "medium" || effort === "high" || effort === "xhigh" || effort === "max" ? effort : "medium";
}
