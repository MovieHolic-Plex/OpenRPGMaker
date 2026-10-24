// editor/dialogue/textDiff.ts
// 윤문 검토용 글자 단위 차이(바꾸기 전·후). 대사 한 줄은 짧으므로 LCS 표(O(n·m))로 충분하다.
// 긴 글(합 1200자 초과)은 표가 커지므로 통째 바뀜으로 본다.

export interface TextDiffPart {
  readonly kind: "same" | "del" | "ins";
  readonly text: string;
}

const MAX_CELLS = 600 * 600;

export function diffText(before: string, after: string): TextDiffPart[] {
  const a = Array.from(before);
  const b = Array.from(after);
  if (a.length * b.length > MAX_CELLS) return [{ kind: "del", text: before }, { kind: "ins", text: after }];
  const n = a.length;
  const m = b.length;
  const table: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i]![j] = a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  const parts: TextDiffPart[] = [];
  const push = (kind: TextDiffPart["kind"], text: string): void => {
    const last = parts[parts.length - 1];
    if (last && last.kind === kind) parts[parts.length - 1] = { kind, text: last.text + text };
    else parts.push({ kind, text });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { push("same", a[i]!); i += 1; j += 1; }
    else if (table[i + 1]![j]! >= table[i]![j + 1]!) { push("del", a[i]!); i += 1; }
    else { push("ins", b[j]!); j += 1; }
  }
  while (i < n) { push("del", a[i]!); i += 1; }
  while (j < m) { push("ins", b[j]!); j += 1; }
  return parts;
}
