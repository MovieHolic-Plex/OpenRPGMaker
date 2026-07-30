// harnessSuggestion/patternDetect.ts
// 구조 킷 중복 판정용 타입 + 결정적 서명만 남긴다.
// 반복 단면 "감지 엔진"(detectRepeatedSectionPattern)은 조용한 제안 카드와 함께 제거됨.

/** 감지된 반복 단면 패턴 — unit(period×height)이 스탬프 재료, 나머지는 근거(발견 위치·반복 횟수). */
export type DetectedSectionPattern = {
  /** 반복 전체 스팬(맵 좌표). width = repeats * period. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly period: number;
  readonly repeats: number;
  readonly unit: {
    readonly width: number;
    readonly height: number;
    /** row-major(period×height). */
    readonly lower: readonly number[];
    readonly upper: readonly number[];
  };
  /** 등록 중복 판정용 결정적 서명. */
  readonly signature: string;
};

/** 패턴 서명 — 등록 목록과의 결정적 대조 키. */
export function sectionPatternSignature(unit: {
  readonly width: number;
  readonly height: number;
  readonly lower: readonly number[];
  readonly upper: readonly number[];
}): string {
  return `s1:${unit.width}x${unit.height}:${unit.lower.join(",")}|${unit.upper.join(",")}`;
}
