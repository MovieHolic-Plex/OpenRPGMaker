/**
 * 대사 본문 앞에 화자 이름이 또 붙은 줄을 걷어 낸다. 이름표(speaker 칸)와 본문이 같은 이름을 두 번 보이면
 * 대사창에 `한지훈` 판 + `한지훈: "반가워!"` 가 겹쳐 나온다(romance-real-2 R07, 실제 Argon 3판 중 2판).
 *
 * 걷는 것은 이름표와 «정확히 같은» 이름이 맨 앞에서 「이름:」·「이름：」·「[이름]」·「【이름】」 로 한 번 더 나온 경우뿐이다.
 * 다른 이름(본문 속 인용)은 건드리지 않는다. 걷은 뒤 본문 전체가 같은 종류의 따옴표로 감싸여 있으면 따옴표도 벗긴다.
 */
const QUOTE_PAIRS: ReadonlyArray<readonly [string, string]> = [['"', '"'], ["“", "”"], ["「", "」"], ["『", "』"], ["'", "'"]];

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function stripSpeakerEcho(body: string, speaker: string | undefined): string {
  const name = speaker?.trim();
  if (!name || !body) return body;
  const head = new RegExp(`^(\\s*)(?:${escapeRegExp(name)}\\s*[:：]|\\[\\s*${escapeRegExp(name)}\\s*\\]|【\\s*${escapeRegExp(name)}\\s*】)[ \\t]*\\n?`, "u");
  const match = head.exec(body);
  if (!match) return body;
  let rest = body.slice(match[0].length);
  const trimmed = rest.trim();
  for (const [open, close] of QUOTE_PAIRS) {
    if (trimmed.length >= 2 && trimmed.startsWith(open) && trimmed.endsWith(close) && !trimmed.slice(1, -1).includes(open)) {
      rest = trimmed.slice(1, -1);
      break;
    }
  }
  // 이름만 있던 줄(본문이 비는 경우)은 원문을 그대로 둔다 — 빈 대사창이 되느니 이름이 한 번 더 보이는 편이 낫다.
  return rest.trim() ? rest : body;
}
