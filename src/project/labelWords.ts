// 타일 이름표가 «이 물건»인가 — 글자 포함이 아니라 물건 이름의 끝 낱말로 맞춘다.
// 왜(2026-11-11 단계×테마 표): 「책」을 품은 이름표를 찾다 설원 「목책」 말뚝을 책으로 깔았고, 「침대」를 찾다 「술통 받침대」를 은신처로 썼다.
// 온전한 낱말로만 맞춰도 모자랐다 — 「안돈(종이 등잔)」이 종이로, 「서류 캐비닛」이 서류로, 「편지 비행(부엉이)」이 편지로 잡혔다.
// 한국어도 영어도 꾸미는 말이 앞이고 물건이 뒤다. 겹낱말(보물상자·이층침대)과 부분 이름(침대 머리맡)은 이 규칙으로 안 잡힌다 —
// 그때는 아무것도 하지 않는 쪽이 틀린 그림을 까는 쪽보다 낫다.

/** 글자·숫자가 아닌 것(빈칸·쉼표·더하기)에서 끊은 낱말들. 소문자. */
const tokens = (text: string): string[] => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
/** 끝에 붙는 번호·한 글자 갈래(「책장 A」「침대 2」「책장 0,1」)는 물건 이름이 아니다. */
const isVariantMark = (token: string): boolean => /^\p{N}+$/u.test(token) || /^[a-z]$/u.test(token);

/**
 * 영어 이름표는 물건 뒤에 설명이 붙는다(「wooden ship bunk bed with pillow at the north end」「hut bed seen from above」) —
 * 설명을 여는 말(전치사·분사)부터는 물건 이름이 아니다. 물건 낱말이 아니라 닫힌 문법 낱말이다.
 */
const TAIL_START = new Set(["with", "seen", "at", "of", "on", "in", "from", "and", "for", "by", "under", "over", "beside", "near", "against"]);

/** 이름표의 물건 이름 낱말들 — 괄호 속 설명과 「묶음 · 」 앞머리, 영어 뒷설명, 끝의 번호·갈래 표시를 뗀다. */
function thingTokens(label: string): string[] {
  const all = tokens(label.replace(/\([^)]*\)/gu, " ").replace(/^.*·/u, "").replace(/[:;].*$/u, ""));
  const cut = all.findIndex((t, i) => i > 0 && TAIL_START.has(t));
  const out = cut > 0 ? all.slice(0, cut) : all;
  while (out.length > 1 && isVariantMark(out[out.length - 1]!)) out.pop();
  return out;
}

/** 이 이름표의 물건이 word 인가 — 물건 이름이 그 낱말로 끝난다(낱말이 여럿이면 그 순서로). */
export function labelNames(label: string, word: string): boolean {
  const want = tokens(word);
  const have = thingTokens(label);
  return want.length > 0 && want.length <= have.length && want.every((w, i) => have[have.length - want.length + i] === w);
}
