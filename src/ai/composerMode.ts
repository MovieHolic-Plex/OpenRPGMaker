// ai/composerMode.ts
// 턴 모드 — 세션이 강제하는 세 갈래. **사용자가 직접 고르지 않는다**: 지시줄의 모드 3칩은 없애고
// 패널이 자율성 다이얼에서 유도한다(readOnly → ask, 그 밖에는 do). 「계획」 칩의 일은 레벨의
// planOnly 가 하므로 `plan` 은 패널이 더 이상 공급하지 않는다 — 세션 분기(finishPlanOnlyTurn 등)와
// 체크포인트 직렬화가 아직 이 값을 읽으므로 어휘만 남긴다. 자세한 배선은
// docs/superpowers/specs/2026-09-09-composer-control-reduction-design.md.
//
// 원래 뜻(세션이 강제하는 내용은 그대로다):
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
