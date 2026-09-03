// ai/composerMode.ts
// 컴포저 모드 — 사용자가 조수 입력창에서 고르는 세 갈래. 패널이 세션에 옵션으로 넘기고 세션이 강제한다:
//   do   지시 — 종전 그대로(쓰기 툴 노출, 플래너는 선언이 결정).
//   ask  질문 — 쓰기 툴 스키마 미노출 + 호출 거부. 프로젝트 초안 불변.
//   plan 계획 — 플래너를 항상 돌려 계획만 세우고 그 턴은 실행 없이 끝난다. 「계속」이 실행이다.
// 예전에는 [컨텍스트] 꼬리에 "모드: 질문 — …" 한 문장만 실렸고 세션·툴 노출·플래너는 모드를 몰랐다(2026-09-03 감사).
export const COMPOSER_MODES = ["do", "ask", "plan"] as const;
export type ComposerMode = (typeof COMPOSER_MODES)[number];

export const COMPOSER_MODE_LABEL: Readonly<Record<ComposerMode, string>> = {
  do: "지시",
  ask: "질문",
  plan: "계획",
};
