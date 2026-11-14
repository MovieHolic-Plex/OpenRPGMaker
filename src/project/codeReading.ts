// project/codeReading.ts
// 번호 자물쇠의 답이 «읽은 글» 에서 나오는가 — 경로 빌더(답을 적은 쪽지를 덧붙일지) · 사슬 빌더의 경고 · 정직한 플레이(읽은 적 없는 번호는 넣지 않는다)가 같은 잣대를 쓴다.
// 왜(2026-11-14 r4d-fun): 모델은 노래(«낙타 네 마리 … 달 하나 … 별 일곱 … 모래시계 둘»)로 4-1-7-2 를 풀게 지었는데, 빌더는 글에 «4172» 가 그대로 있어야 알려 준 것으로 봐서
// 답을 통째로 적은 «번호 쪽지» 를 덧붙이고 그 쪽지를 문의 선행 조건으로 걸었다 — 수수께끼가 빈 껍데기가 됐다.
// 읽는 법 넷: 통째로 · 홀로 선 숫자 조각들을 이어서 · 「7 _ 9 _」 처럼 자리별로 겹쳐서 · 한 줄(또는 한 사람의 말 전체)에 차례로 나오는 수 낱말(«네 마리 … 하나 … 일곱 … 둘»).
// 수 낱말은 요청을 가르는 낱말 목록이 아니라 숫자를 읽는 표다. 바깥의 대응이 있어야 풀리는 순서(색 → 숫자)는 읽지 못한다 — 그때는 전처럼 쪽지가 선다.

/** 수 낱말 → 숫자. 고유어는 긴 꼴(하나·둘 — 조사가 붙어도 된다)과 짧은 꼴(한·두 — 홀로 선 낱말일 때만), 영어는 홀로 선 낱말. */
const LONG: Readonly<Record<string, number>> = { 하나: 1, 둘: 2, 셋: 3, 넷: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9 };
const SHORT: Readonly<Record<string, number>> = { 한: 1, 두: 2, 세: 3, 석: 3, 네: 4, 넉: 4, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, zero: 0 };
/** 긴 꼴 뒤에 붙어도 되는 꼬리(조사·어미)의 길이. */
const TAIL = 2;

/** 글 한 덩이에 차례로 나오는 수(숫자 · 수 낱말)를 이어 붙인 것. */
function countedDigits(text: string): string {
  let out = "";
  for (const token of text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) {
    const digits = /^\d+/u.exec(token)?.[0];
    if (digits) { out += digits; continue; }
    if (SHORT[token] !== undefined) { out += String(SHORT[token]); continue; }
    const long = Object.keys(LONG).find((word) => token.startsWith(word) && token.length - word.length <= TAIL);
    if (long) out += String(LONG[long]);
  }
  return out;
}

/** 번호가 그 글들에서 읽히는가. groups = 한 사람(한 고리)의 말씩 묶은 줄들 — 수 낱말은 한 줄 또는 한 묶음 전체가 정확히 그 번호일 때만 센다. */
export function codeReadable(code: string, groups: readonly (readonly string[])[]): boolean {
  if (!code) return true;
  const texts = groups.flat();
  if (texts.some((text) => text.replace(/(?<=\d)[\s·\-.,](?=\d)/gu, "").includes(code))) return true;
  const pieces = new Set(texts.flatMap((text) => text.match(/(?<!\d)\d+(?!\d)/gu) ?? []));
  const built = (rest: string, parts: number): boolean => rest === "" ? parts >= 2
    : [...pieces].some((piece) => piece.length < code.length && rest.startsWith(piece) && built(rest.slice(piece.length), parts + 1));
  if (built(code, 0)) return true;
  const got: (string | undefined)[] = new Array(code.length).fill(undefined);
  for (const text of texts) for (const hit of text.matchAll(/[0-9_＿?○□*](?:[\s·-]*[0-9_＿?○□*])*/gu)) {
    const marks = [...hit[0].replace(/[\s·-]/gu, "")];
    if (marks.length !== code.length) continue;
    marks.forEach((mark, i) => { if (/\d/u.test(mark)) got[i] ??= mark; });
  }
  if (got.join("") === code) return true;
  return groups.some((lines) => lines.some((line) => countedDigits(line) === code) || countedDigits(lines.join(" ")) === code);
}
