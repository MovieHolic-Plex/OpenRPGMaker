/**
 * 엔딩 그림 카드의 요약 글 — 에필로그 비트에서 만든다. 카드는 내레이션이라 대본처럼 「이름: 대사」를 붙이면
 * 화자 표시가 새어 나온 것처럼 읽혔다(장난감 가게 엔딩 「노장인 제페토: …」, 2026-10-25 심판 J36).
 * 말한 사람이 있는 줄은 「」 안의 인용으로 보이고, 같은 사람의 연이은 말은 한 인용으로 묶는다.
 * 말한 사람이 둘 이상이면 누가 한 말인지 알 수 있게 인용 끝에 「— 이름」을 붙인다(대본 머리말이 아닌 인용 출처).
 * 대사 본문 맨 앞에 저작자가 「이름:」을 직접 써 넣은 줄도 같은 방식으로 떼어 인용으로 바꾼다.
 */
const SCRIPT_PREFIX = /^([^\s:：「」"'“”][^:：「」"'“”\n]{0,15}?)\s*[:：]\s+(\S[\s\S]*)$/u;

type SummaryLine = { readonly text: string; readonly speaker?: string };

/** 「이름: 대사」 꼴로 시작하는 본문이면 이름과 대사로 가른다. 시간(10:30)·목록은 건드리지 않는다. */
export function splitScriptSpeaker(text: string): SummaryLine {
  const match = SCRIPT_PREFIX.exec(text);
  if (!match || /\d$/u.test(match[1]!)) return { text };
  return { speaker: match[1]!.trim(), text: match[2]!.trim() };
}

function unquoted(text: string): string {
  const trimmed = text.trim();
  return /^「[\s\S]*」$/u.test(trimmed) || /^“[\s\S]*”$/u.test(trimmed) || /^"[\s\S]*"$/u.test(trimmed) ? trimmed.slice(1, -1).trim() : trimmed;
}

export function endingSummaryText(beats: readonly Record<string, unknown>[]): string {
  const lines: SummaryLine[] = beats.flatMap((beat) => {
    const raw = typeof beat.text === "string" ? beat.text.trim() : "";
    if (!raw) return [];
    const speaker = typeof beat.speaker === "string" ? beat.speaker.trim() : "";
    const narration = beat.context === "narration";
    if (speaker && !narration) return [{ speaker, text: unquoted(splitScriptSpeaker(raw).text) }];
    const split = splitScriptSpeaker(raw);
    return [split.speaker ? { speaker: split.speaker, text: unquoted(split.text) } : { text: raw }];
  });
  const speakers = new Set(lines.flatMap((line) => (line.speaker ? [line.speaker] : [])));
  const out: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (!line.speaker) { out.push(line.text); continue; }
    const run = [line.text];
    while (lines[i + 1]?.speaker === line.speaker) run.push(lines[++i]!.text);
    out.push(`「${run.join(" ")}」${speakers.size > 1 ? ` — ${line.speaker}` : ""}`);
  }
  return out.join("\n");
}
