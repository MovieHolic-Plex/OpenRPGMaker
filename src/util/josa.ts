// 한국어 조사 자동 선택. 마지막 글자의 받침 유무로 이/가·을/를·은/는·와/과를 고른다.
// 끝이 아라비아 숫자면 그 숫자의 한국어 독음 받침을 따른다 (예: "슬라임 2" → "2를", "슬라임 1" → "1을").
// 그 밖의 한글이 아닌 이름(영문 등)은 받침 있는 쪽(첫 번째 형태)을 쓴다.

export type JosaPair = "이/가" | "을/를" | "은/는" | "와/과" | "이(가)" | "을(를)";

// 숫자 독음: 0 영, 1 일, 3 삼, 6 육, 7 칠, 8 팔 은 받침이 있고 2 이, 4 사, 5 오, 9 구 는 없다.
const DIGIT_HAS_BATCHIM: readonly boolean[] = [true, true, false, true, false, false, true, true, true, false];

export function hasBatchim(word: string): boolean {
  const last = word.trimEnd().slice(-1);
  const digit = "0123456789".indexOf(last);
  if (digit >= 0) return DIGIT_HAS_BATCHIM[digit];
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return true;
  return (code - 0xac00) % 28 !== 0;
}

export function josa(word: string, pair: JosaPair): string {
  const [withBatchim, withoutBatchim] = splitPair(pair);
  return hasBatchim(word) ? withBatchim : withoutBatchim;
}

/** 단어에 조사를 붙여 반환한다. 예: withJosa("라르베아", "을/를") → "라르베아를" */
export function withJosa(word: string, pair: JosaPair): string {
  return `${word}${josa(word, pair)}`;
}

function splitPair(pair: JosaPair): [string, string] {
  switch (pair) {
    case "이/가":
      return ["이", "가"];
    case "을/를":
      return ["을", "를"];
    case "은/는":
      return ["은", "는"];
    case "와/과":
      return ["과", "와"];
    case "이(가)":
      return ["이", "가"];
    case "을(를)":
      return ["을", "를"];
  }
}
