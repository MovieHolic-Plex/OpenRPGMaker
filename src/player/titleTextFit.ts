// player/titleTextFit.ts — 타이틀 제목·부제가 320px 논리 화면 오른쪽에서 잘리지 않게 글자 크기와 줄 수를 정한다.
//
// 왜: jrpg-real-1 J05 에서 「잿빛 마석과 두 세계의 연대기」·「아르카디아 연대기: 버들나루와 고대 봉인」과 영문 부제가
// white-space:nowrap 한 줄로 그려져 화면 밖으로 잘렸다(제목 281px 폭 한도에 글자가 375px). 제목은 한 줄이 들어가는 가장 큰
// 글자 크기로, 그래도 안 되면 두 줄로 줄바꿈하고, 부제는 제목 아래에서 이어진다(고정 오프셋이면 두 줄 제목과 겹친다).
// 글자 폭은 폰트 측정 없이 어림한다(전각 1em, 영문 대문자 0.75em, 소문자·숫자 0.6em, 공백 0.35em) — DOM 이 없어도 같은 값이 나온다.

export const TITLE_STAGE_WIDTH = 320;

/** 글자 한 개의 폭(em). */
function glyphEm(char: string): number {
  const code = char.codePointAt(0) ?? 0;
  if (char === " ") return 0.35;
  if (code <= 0x7f) {
    if (/[A-Z]/u.test(char)) return 0.75;
    if (/[.,:;'!|]/u.test(char)) return 0.32;
    return 0.6;
  }
  return 1;
}

/** 문자열 전체 폭(em), 자간 포함. */
export function estimateTextEm(text: string, letterSpacingEm = 0): number {
  let total = 0;
  for (const char of text) total += glyphEm(char) + letterSpacingEm;
  return total;
}

export type TitleFit = {
  /** 제목 글자 크기(논리 px). */
  readonly fontPx: number;
  /** 어림한 줄 수(1~2). */
  readonly lines: number;
  /** 제목이 쓸 수 있는 폭(논리 px). */
  readonly availablePx: number;
};

/**
 * 제목이 left(논리 px)에서 시작할 때 들어갈 글자 크기. basePx 가 한 줄에 들어가면 그대로,
 * 아니면 한 줄이 들어가는 가장 큰 크기(minOneLinePx 이상), 그것도 안 되면 두 줄이 들어가는 가장 큰 크기.
 */
export function fitTitleText(text: string, options: { readonly left: number; readonly basePx: number; readonly letterSpacingEm: number; readonly minOneLinePx?: number; readonly minPx?: number; readonly rightMargin?: number }): TitleFit {
  const availablePx = Math.max(60, TITLE_STAGE_WIDTH - options.left - (options.rightMargin ?? 14));
  const em = estimateTextEm(text.trim(), options.letterSpacingEm);
  const minOne = options.minOneLinePx ?? Math.round(options.basePx * 0.74);
  const minPx = options.minPx ?? 12;
  const oneLineMax = Math.floor((availablePx / Math.max(0.01, em)) * 10) / 10;
  if (oneLineMax >= options.basePx) return { fontPx: options.basePx, lines: 1, availablePx };
  if (oneLineMax >= minOne) return { fontPx: Math.floor(oneLineMax), lines: 1, availablePx };
  // 두 줄 — 줄바꿈 여유(낱말 경계에서 못 나눌 때의 손실)로 폭을 8% 깎는다.
  const twoLineMax = Math.floor(((availablePx * 2 * 0.92) / Math.max(0.01, em)));
  const fontPx = Math.max(minPx, Math.min(options.basePx, twoLineMax));
  const lines = Math.max(1, Math.min(3, Math.ceil((em * fontPx) / (availablePx * 0.96))));
  return { fontPx, lines, availablePx };
}

/** 영문 부제(대문자·넓은 자간)의 글자 크기·자간·줄 수. 한 줄에 들어가게 자간부터 줄이고, 안 되면 줄바꿈한다. */
export function fitTitleSubtitle(text: string, options: { readonly left: number; readonly basePx: number; readonly baseSpacingEm: number; readonly rightMargin?: number }): { readonly fontPx: number; readonly letterSpacingEm: number; readonly lines: number; readonly availablePx: number } {
  const availablePx = Math.max(60, TITLE_STAGE_WIDTH - options.left - (options.rightMargin ?? 14));
  const upper = text.trim().toUpperCase();
  for (const spacing of [options.baseSpacingEm, 0.2, 0.1, 0.04]) {
    if (spacing > options.baseSpacingEm) continue;
    if (estimateTextEm(upper, spacing) * options.basePx <= availablePx) return { fontPx: options.basePx, letterSpacingEm: spacing, lines: 1, availablePx };
  }
  const spacing = Math.min(options.baseSpacingEm, 0.1);
  const lines = Math.max(1, Math.ceil((estimateTextEm(upper, spacing) * options.basePx) / (availablePx * 0.94)));
  return { fontPx: options.basePx, letterSpacingEm: spacing, lines: Math.min(lines, 3), availablePx };
}
