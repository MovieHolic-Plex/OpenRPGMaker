// 타일 이름표에서 물건 찾기 — 글자 포함이 아니라 낱말로.
// 왜(2026-11-11 단계×테마 표): 「책」을 품은 이름표를 찾다 설원 「목책」 말뚝을 책으로 깔았고, 「침대」를 찾다 「술통 받침대」를 은신처로 썼다.
// 둘로 나눈다:
//  - labelHasWord: 맵에 **이미 있는** 물건을 찾을 때 — 이름표(괄호 속 설명은 빼고)에 그 낱말이 온전한 낱말로 있다(「침대 곁 탁자」의 침대처럼 자리를 말하는 것은 빼고).
//    「침대 초록」「화분 고사리」「책장 1w」처럼 갈래가 뒤에 붙는 이름표가 많아서 자리는 따지지 않는다.
//  - labelNames: 맵에 **새로 깔** 그림을 고를 때 — 더 엄하게, 물건 이름이 그 낱말로 끝나야 한다.
//    온전한 낱말만 보면 「서류 캐비닛」이 서류로, 부엉이 「편지 비행」이 편지로 깔린다(꾸미는 말이 앞, 물건이 뒤).
// 겹낱말(보물상자·이층침대·벽시계)은 어느 쪽으로도 안 잡힌다 — 그때는 아무것도 하지 않는 쪽이 틀린 그림을 쓰는 쪽보다 낫다.

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
  const all = tokens(labelWithoutNotes(label).replace(/^.*·/u, "").replace(/[:;].*$/u, ""));
  const cut = all.findIndex((t, i) => i > 0 && TAIL_START.has(t));
  const out = cut > 0 ? all.slice(0, cut) : all;
  while (out.length > 1 && isVariantMark(out[out.length - 1]!)) out.pop();
  return out;
}

/** 괄호 속 설명(재료·부품·모양)을 뗀 이름표 — 「선반 기계(무쇠 침대 + 주축대)」의 침대는 그 물건이 아니다. */
export const labelWithoutNotes = (label: string): string => label.replace(/\([^)]*\)/gu, " ");

/** 자리 낱말(닫힌 문법 낱말) — 「침대 곁 탁자」「사물함 앞 긴 의자」는 탁자·의자다: 바로 뒤에 자리 낱말이 오면 그 낱말은 물건이 아니라 어디인지를 말한다. */
const PLACE_AFTER = new Set(["옆", "곁", "앞", "뒤", "위", "밑", "아래", "안", "속", "밖"]);

/** 이름표에 word 가 온전한 낱말로 있는가(여럿이면 그 순서로 이어서) — 괄호 속 설명은 빼고, 「+」「·」로 이은 물건은 따로 본다. */
export function labelHasWord(label: string, word: string): boolean {
  const want = tokens(word);
  if (!want.length) return false;
  for (const part of labelWithoutNotes(label).split(/[+·,/]/u)) {
    const have = tokens(part);
    for (let i = 0; i + want.length <= have.length; i++) {
      if (want.every((w, k) => have[i + k] === w) && !PLACE_AFTER.has(have[i + want.length] ?? "")) return true;
    }
  }
  return false;
}

/** 이 이름표의 물건이 word 인가 — 물건 이름이 그 낱말로 끝난다(낱말이 여럿이면 그 순서로). */
export function labelNames(label: string, word: string): boolean {
  const want = tokens(word);
  const have = thingTokens(label);
  return want.length > 0 && want.length <= have.length && want.every((w, i) => have[have.length - want.length + i] === w);
}
