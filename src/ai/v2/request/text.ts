// 요청 글 다듬기 — 낱말 판정 앞에 한 번 거치는 것: 사용자 글만 남기기, 지어 주는 이름·대사 가리기, 절 나누기, 한 글자 낱말을 낱말로만 맞추기.
import { withoutIntentNote } from "@/ai/piAgent/monsterGameRequest";

/** 사용자가 쓴 글(실행기가 뒤에 붙인 의도 메모는 뗀다). */
export const userText = (raw: string): string => withoutIntentNote(String(raw ?? ""));

const PARTICLE = "(?:을|를|이|가|은|는|에|에서|에게|의|으로|로|과|와|도|만|이나|나|이랑|랑|까지|부터|처럼|보다|들|이라|이면|이고|인)";
/**
 * 한 글자(또는 짧은) 낱말을 «낱말»로만 맞추는 정규식 조각 — 앞이 한글이 아니고, 뒤가 조사(두 개까지)이거나 한글이 아니다.
 * 「독」이 독서실을, 「썸」이 썸네일을, 「방」이 방법을 잡지 않게 한다. tails 는 붙여 쓰는 말(숲속·숲길).
 */
export const kw = (word: string, tails = ""): string =>
  `(?<![가-힣])(?:${word})(?=(?:${tails ? `${tails}|` : ""}${PARTICLE}{0,2})(?![가-힣]))`;

/** kw 와 같되 앞에 한글이 붙어도 된다(「다락방」「시계탑」「대나무숲」) — 뒤만 낱말 끝이면 맞춘다. */
export const kwEnd = (word: string, tails = ""): string =>
  `(?:${word})(?=(?:${tails ? `${tails}|` : ""}${PARTICLE}{0,2})(?![가-힣]))`;

const QUOTED = String.raw`(?:「[^」\n]{1,40}」|『[^』\n]{1,40}』|“[^”\n]{1,40}”|‘[^’\n]{1,40}’|"[^"\n]{1,40}"|(?<![A-Za-z])'[^'\n]{1,40}'(?![A-Za-z])|«[^»\n]{1,40}»)`;
const NAME_NOUN = "제목|타이틀|이름|명칭|호칭|별명|title|name";
const RENAME_VERB = String.raw`바꿔|바꾸|변경|수정|고쳐|지어|짓|정해|붙여|불러|해\s*줘|해줘|하자|해\s*주세요`;
/** 이름 낱말 뒤에 온 따옴표 글(「제목은 '별의 노래'」). */
const NAMED_QUOTE = new RegExp(String.raw`((?:${NAME_NOUN})\s*(?:은|는|을|를|이|가|:|=)?\s*)${QUOTED}`, "giu");
/** 따옴표 글 뒤에 이름 붙이기·말하기 꼬리(「'별의 노래'로 바꿔」「"어서 와"라고 말하게」). */
const QUOTE_THEN_TAIL = new RegExp(String.raw`${QUOTED}(?=\s*(?:(?:이)?라(?:고|는)|(?:이)?란\s|(?:으)?로\s*(?:${RENAME_VERB})|고\s*(?:말|대답|외치|적|쓰|써|알려|물어|묻)|하고\s*(?:말|대답|외치|물어|묻)))`, "giu");
/** 따옴표 없이 지어 주는 이름(「주인공 이름을 하린으로 바꿔 줘」). */
const BARE_RENAME = new RegExp(String.raw`((?:${NAME_NOUN})\s*(?:을|를|은|는)\s*)([^\s.!?\n][^.!?\n]{0,29}?)(?=(?:으로|로|라고|이라고)\s*(?:${RENAME_VERB}))`, "giu");

/**
 * 지어 주는 이름·제목과 시키는 대사의 글을 가린다(□) — 그 안의 낱말은 요청의 주제가 아니다.
 * 「게임 제목을 '별의 노래'로 바꿔 줘」의 「노래」가 음악 요청으로, 「"보스를 조심해"라고 말하게」의 「보스」가 전투 요청으로 읽히지 않게.
 * 그 밖의 따옴표(「「여관」 하나 지어 줘」)는 지을 것의 이름이라 그대로 둔다.
 */
export function maskNames(text: string): string {
  return text.replace(NAMED_QUOTE, "$1□").replace(QUOTE_THEN_TAIL, "□").replace(BARE_RENAME, "$1□");
}

/** 절로 나눈다 — 문장 부호, 「~고 」, 그리고·및·이랑. 한 요청에 일이 둘 섞였는지 볼 때 쓴다. */
export function clauses(text: string): string[] {
  return text.split(/[,.!?\n]|(?<=[가-힣])고\s+|그리고|그\s*다음에?|및|이랑\s|(?<=[가-힣])하고\s+/u).map((part) => part.trim()).filter(Boolean);
}
