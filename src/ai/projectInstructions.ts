// ai/projectInstructions.ts
// 프로젝트에 고정되는 사용자 지침(감독 규칙). 순수 함수만 담는다.
//
// 왜 필요한가: 지금까지 "우리 게임은 4방향이다", "저 타일셋은 쓰지 마" 같은 항구적 규칙을
// 담을 자리가 없었다. 맵 인터뷰·타일 어휘 학습은 **타일 메타데이터** 층이고(프로젝트 데이터로
// 저장돼 시스템 프롬프트에 요약된다), 자유서술 규칙 층은 비어 있어서 매 새 대화마다 사람이
// 같은 말을 다시 타이핑했다. 대화에 실린 지시는 압축·새 대화·복원에서 전부 사라진다.
//
// 저장 위치는 프로젝트 JSON(`project.aiInstructions`)이다. localStorage 가 아니라 프로젝트인
// 이유: 지침은 그 게임의 성질이지 이 브라우저의 설정이 아니다. 프로젝트를 옮기면 따라가야 한다.
// 필드는 optional 이라 마이그레이션이 없다(aiDocuments·quests·testPresets 와 같은 선례).

/**
 * 상한 1,200자. 시스템 프롬프트 기본 예산이 13,200자(DEFAULT_BUDGET_CHARS)이고 이 블록은
 * **예산 밖 고정분**으로 들어간다 — 무제한이면 사용자가 소설을 넣어 모델 창을 먹는다.
 */
export const AI_INSTRUCTIONS_MAX_CHARS = 1200;

/** 저장 직전 정규화: CRLF 통일 · 앞뒤 공백 제거 · 상한 절단. 빈 값은 빈 문자열(= 미설정). */
export function normalizeAiInstructions(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "";
  const unified = raw.replace(/\r\n?/gu, "\n").trim();
  return unified.length <= AI_INSTRUCTIONS_MAX_CHARS ? unified : unified.slice(0, AI_INSTRUCTIONS_MAX_CHARS).trim();
}

/**
 * 시스템 프롬프트에 넣을 블록. 없으면 null.
 *
 * "충돌하면 이것을 따른다" 를 명시한다 — 명시하지 않으면 INTRO 의 일반 지침과 사용자 규칙이
 * 부딪힐 때 모델이 어느 쪽을 버릴지 알 수 없고, 그 판단은 사용자 것이지 모델 것이 아니다.
 */
export function aiInstructionsSection(raw: string | null | undefined): string | null {
  const text = normalizeAiInstructions(raw);
  if (!text) return null;
  return [
    "## 감독 지침(이 프로젝트 고정 규칙)",
    "사용자가 이 프로젝트에 직접 박아 둔 규칙이다. 아래 다른 지침과 충돌하면 **이 절을 따른다.**",
    "대화가 압축되거나 새 대화로 넘어가도 이 절은 유지된다 — 사용자가 다시 말해 주기를 기대하지 마라.",
    "",
    text,
  ].join("\n");
}
