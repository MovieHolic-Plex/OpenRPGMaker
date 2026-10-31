// editor/shortRecordName.ts — the short form of a switch/variable name for event lists.
//
// Authors (and the assistant) often write the meaning into the name: 「레버 퍼즐 진행 단계(0~4, 올바르게 당긴 레버 수)」,
// 「평판 — 마을에서의 주인공 평판 (로직은 다음 작업에서 연결)」. Repeated on every line that is noise. The list shows the
// part before the description (bracketed text removed, then cut at the first 「 — 」 / 「. 」 / 「: 」 / 「 = 」 / 「, 」) and keeps
// the full name for the hover title. Never empty: a name that is all description stays whole.
const CLAUSE_BREAK = /\s+[—–]\s+|\s-\s|[.。:：]\s+|\s=\s|,\s+/u;
const BRACKETED = /\s*[(（[［][^()（）[\]［］]*[)）\]］]/gu;

export function shortRecordName(name: string): string {
  const full = name.trim();
  if (!full) return full;
  // brackets first (they may hold commas), innermost first for nested ones
  let unbracketed = full;
  for (let i = 0; i < 3; i += 1) {
    const next = unbracketed.replace(BRACKETED, "");
    if (next === unbracketed) break;
    unbracketed = next;
  }
  const short = (unbracketed.split(CLAUSE_BREAK)[0] ?? unbracketed).replace(/\s{2,}/gu, " ").replace(/[\s%·,]+$/u, "").trim();
  return short || full;
}
