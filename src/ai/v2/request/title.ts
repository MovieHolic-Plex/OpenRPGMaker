// 요청이 못박은 게임 제목(「」『』"" 로 묶인 것).
import { withoutIntentNote } from "@/ai/piAgent/monsterGameRequest";

/**
 * 요청이 제목을 못박았는데 다른 제목으로 냈다(J71 hf2-mansion-flash 「검은 장미의 비밀」, J73 hf2-mansion-argon 「저택 탈출」 —
 * 요청은 「제목은 「검은 장미 저택」」). 「」『』"" 로 묶인 제목 낱말만 본다(묶지 않은 글은 제목인지 알 수 없다). 게임을 만드는 요청에서만 막는다.
 */
// 게임 제목만 — 앞에 낱말이 붙거나(부제목·subtitle) 게임 안의 다른 제목(책·표지판·챕터·퀘스트·곡…)이면 아니다.
const REQUESTED_TITLE = /(?<![\p{L}\p{N}])(?<!(?:책|표지판?|간판|챕터|퀘스트|노래|곡|장|편지|일기|그림|영화|소설|시|팻말|문서|보고서)\s?)(?:제목|타이틀|title)\s*(?:은|는|을|를|이|가|:|=)?\s*(?:「([^」\n]{1,40})」|『([^』\n]{1,40})』|"([^"\n]{1,40})"|“([^”\n]{1,40})”)(?!\s*(?:은|는|을|를)?\s*(?:말고|대신|쓰지|빼|아니))/giu;

const firstTitle = (text: string): string | undefined => {
  for (const m of text.matchAll(REQUESTED_TITLE)) { const t = m.slice(1).find((g) => g !== undefined)?.trim(); if (t) return t; }
  return undefined;
};

/** 이번 글의 제목이 먼저, 없으면 앞선 요청 메모(J70)의 제목. */
export function requestedTitle(task: string): string | undefined {
  const own = withoutIntentNote(task);
  return firstTitle(own) ?? firstTitle(task.slice(own.length));
}
