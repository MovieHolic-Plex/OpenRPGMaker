// editor/dialogue/dialogueMeaningGuard.ts
// 대사 고치기의 뜻 보존 관문(순수, 모델 없음). 원문과 고친 글의 «닻» 을 견주어 뜻이 바뀐 고치기를 거절한다.
//
// 왜(2026-11-04, polish-vs-haww 비교): 내장 윤문 스킬은 게임 대사에선 이겼지만 산문에서 무스킬에 졌고, 그 원인 하나가
// 뜻 흔들림(「창은 안 판다」 → 「창은 돈으론 안 판다」, 「A가 아니라 B」 를 지우며 대비가 빠짐)이었다.
// HAWW(github.com/limhyeonguu-ux/Have-a-way-with-HAWW)의 «앵커가 바뀌면 거절» 방식만 따랐다. 그 저장소는 라이선스가 없어
// 그 저장소의 코드·표·낱말 목록을 이 파일에 옮겨 적지 않는다.
//
// 닻 다섯 가지:
//   number   숫자 다중집합(아라비아 숫자·%·고유어 수량 「세 개」「셋」「열두 명」). 「세 개 → 셋」 은 같은 수라 통과.
//   quote    「」『』"" “” 안의 글(아이템·퀘스트 이름 포함). 빠지거나 바뀌면 거절.
//   name     프로젝트 DB 고유명사(배우·아이템·장비·스킬·적·상태·맵·퀘스트). 원문보다 덜 나오면 거절.
//   hedge    유보·추측 표현(아마·어쩌면·혹시·~ㄹ지도·~것 같다 …). 수가 줄면 거절.
//   polarity 부정(안·못·않·없·아니·말라 …). 부정 수가 바뀌면 거절(둘을 함께 지워도 대비가 빠지므로 홀짝이 아니라 개수로 본다).
// 어미·어순·감탄사·말줄임 정리처럼 말투만 바꾸는 고치기는 닻을 건드리지 않으므로 통과한다.

export type MeaningAnchorKind = "number" | "quote" | "name" | "hedge" | "polarity";
export const MEANING_ANCHOR_KINDS: readonly MeaningAnchorKind[] = ["number", "quote", "name", "hedge", "polarity"];

export interface MeaningGuardIssue {
  readonly kind: MeaningAnchorKind;
  /** 모델이 바로 고칠 수 있는 한국어 한 줄. */
  readonly message: string;
}

export interface MeaningGuardOptions {
  /** 지켜야 할 고유명사(meaningGuardNames 결과). */
  readonly names?: readonly string[];
}

const HANGUL = "가-힣";
/** 수 뒤에 붙는 조사·접미(「셋이」「둘째」「하나만」). */
const PARTICLE = "[이가은는을를도만의씩째에로와과뿐쯤께]";
const COUNTERS = ["개월", "개", "명", "마리", "번", "살", "시간", "시", "달", "해", "년", "장", "권", "자루", "그루", "채", "척", "병", "잔", "걸음", "발", "송이", "알", "줄", "칸", "층", "가지", "군데", "사람", "분", "배", "냥", "닢", "푼", "주", "날", "통", "쌍", "벌", "포기", "덩이", "조각", "방울", "모금", "점", "곳", "쪽", "대", "마디"];
const TENS: readonly (readonly [string, number])[] = [["열", 10], ["스물", 20], ["스무", 20], ["서른", 30], ["마흔", 40], ["쉰", 50]];
/** 홀로 쓰는 꼴(「셋」)과 매김 꼴(「세 개」). 다섯 이상은 꼴이 같다. */
const UNIT_ALONE: readonly (readonly [string, number])[] = [["하나", 1], ["둘", 2], ["셋", 3], ["넷", 4], ["다섯", 5], ["여섯", 6], ["일곱", 7], ["여덟", 8], ["아홉", 9]];
const UNIT_BEFORE: readonly (readonly [string, number])[] = [["한", 1], ["두", 2], ["세", 3], ["석", 3], ["네", 4], ["넉", 4], ["다섯", 5], ["여섯", 6], ["일곱", 7], ["여덟", 8], ["아홉", 9]];

const alt = (pairs: readonly (readonly [string, number])[]) => pairs.map(([word]) => word).sort((a, b) => b.length - a.length).join("|");
const lookup = (pairs: readonly (readonly [string, number])[], word: string | undefined) => (word ? pairs.find(([w]) => w === word)?.[1] ?? 0 : 0);
const COUNTER_ALT = [...COUNTERS].sort((a, b) => b.length - a.length).join("|");
/** 단위 뒤: 조사·비한글·끝, 또는 붙여 쓴 하다 동사(「한잔해야」「한번했다」). 「한 장소」의 「장」은 세지 않는다. */
const AFTER_COUNTER = `(?=${PARTICLE}|[하해했할]|[^${HANGUL}]|$)`;
/** 「세 개」「열두 명」「스무 살」「열 번」 — 매김 꼴 + 단위. */
const COUNTED = new RegExp(`(?<![${HANGUL}])(${alt(TENS)})?(${alt(UNIT_BEFORE)})?\\s?(?:${COUNTER_ALT})${AFTER_COUNTER}`, "gu");
/** 「셋」「열둘이」「하나만」 — 홀로 쓰는 꼴. */
const ALONE = new RegExp(`(?<![${HANGUL}])(${alt(TENS)})?(${alt(UNIT_ALONE)})(?=${PARTICLE}|[^${HANGUL}]|$)`, "gu");
const DIGITS = /\d[\d,]*(?:\.\d+)?\s?(?:%|퍼센트|프로)?/gu;

/** 글 속 수량을 정규화한 값 목록(「3」「30%」「2000」). 순서 없음 — 다중집합으로 견준다. */
export function quantityValues(text: string): string[] {
  const out: string[] = [];
  let rest = text.replace(DIGITS, (raw) => {
    const percent = /%|퍼센트|프로/u.test(raw);
    out.push(raw.replace(/[^\d.]/gu, "").replace(/^0+(?=\d)/u, "") + (percent ? "%" : ""));
    return " ";
  });
  rest = rest.replace(COUNTED, (raw, tens?: string, unit?: string) => {
    const value = lookup(TENS, tens) + lookup(UNIT_BEFORE, unit);
    if (value > 0) out.push(String(value));
    return value > 0 ? " " : raw;
  });
  rest.replace(ALONE, (_raw, tens?: string, unit?: string) => {
    out.push(String(lookup(TENS, tens) + lookup(UNIT_ALONE, unit)));
    return " ";
  });
  return out.sort();
}

const QUOTED = /「([^」\n]{1,80})」|『([^』\n]{1,80})』|"([^"\n]{1,80})"|“([^”\n]{1,80})”/gu;

/** 따옴표 안 글(양끝 공백 제거). 따옴표 종류는 가리지 않는다 — 「불덩이」 → "불덩이" 는 같은 인용이다. */
export function quotedSpans(text: string): string[] {
  return [...text.matchAll(QUOTED)].map((m) => (m[1] ?? m[2] ?? m[3] ?? m[4] ?? "").trim()).filter(Boolean);
}

/** 낱말 앞에서만 시작하는 등장 수(뒤는 조사가 붙어도 된다). */
export function nameOccurrences(text: string, name: string): number {
  let count = 0;
  for (let at = text.indexOf(name); at >= 0; at = text.indexOf(name, at + name.length)) {
    if (at === 0 || !/[\p{L}\p{N}]/u.test(text[at - 1]!)) count += 1;
  }
  return count;
}

/** 추측·유보. 「지도」 는 뒤에 모르/몰·끝맺음이 올 때만(지도를 펼친다는 세지 않는다). */
const HEDGE = /(?<![가-힣])(?:아마|어쥩면|혹시|아무래도|글쎄)|듯|지도(?= ?(?:모르|몰)|요|[.!?…~]|$)|지 ?(?:모르|몰라)|[것거] 같|[나가] (?:보다|봐|봅)|모양이/gu;
/** 부정. 「안」·「못」 은 띄어 쓴 부사만(안개·안녕·못생긴은 세지 않는다), 「지 마」 는 금지 명령. */
const NEGATION = /(?<![가-힣])(?:안|못)(?= )|못(?=하|해|한|할|했)|않|없|아니|아냐|(?<![가-힣])말고(?![가-힣])|지 ?(?:마|말)/gu;

const countOf = (pattern: RegExp, text: string) => (text.match(pattern) ?? []).length;
export const hedgeCount = (text: string) => countOf(HEDGE, text);
export const negationCount = (text: string) => countOf(NEGATION, text);

function multisetMissing(before: readonly string[], after: readonly string[]): string[] {
  const left = new Map<string, number>();
  for (const value of after) left.set(value, (left.get(value) ?? 0) + 1);
  const missing: string[] = [];
  for (const value of before) {
    const n = left.get(value) ?? 0;
    if (n > 0) left.set(value, n - 1); else missing.push(value);
  }
  return missing;
}

const show = (values: readonly string[]) => values.slice(0, 4).map((value) => `「${value}」`).join(" ");

/**
 * 원문과 고친 글의 뜻 닻을 견준다. 빈 배열 = 통과. 제어 코드·줄 수는 dialogueEdits.ts 가 따로 본다.
 * 메시지는 거절된 모델이 다시 고칠 수 있게 무엇을 돌려놓을지 적는다.
 */
export function checkMeaningPreserved(before: string, after: string, options: MeaningGuardOptions = {}): MeaningGuardIssue[] {
  const issues: MeaningGuardIssue[] = [];
  const numbersBefore = quantityValues(before), numbersAfter = quantityValues(after);
  const numbersLost = multisetMissing(numbersBefore, numbersAfter), numbersAdded = multisetMissing(numbersAfter, numbersBefore);
  if (numbersLost.length || numbersAdded.length) {
    const parts = [numbersLost.length ? `빠짐 ${show(numbersLost)}` : "", numbersAdded.length ? `새로 생김 ${show(numbersAdded)}` : ""].filter(Boolean).join(" · ");
    issues.push({ kind: "number", message: `숫자·수량이 바뀌었다(${parts}) — 원문의 수를 그대로 둔다(「세 개」↔「셋」처럼 같은 수로 바꾸는 것은 된다).` });
  }
  const quotesLost = multisetMissing(quotedSpans(before), quotedSpans(after));
  if (quotesLost.length) {
    issues.push({ kind: "quote", message: `따옴표 안 글이 빠졌거나 바뀌었다(${show(quotesLost)}) — 인용·아이템·퀘스트 이름은 따옴표와 함께 글자 그대로 둔다.` });
  }
  const namesLost = [...new Set(options.names ?? [])].filter((name) => nameOccurrences(after, name) < nameOccurrences(before, name));
  if (namesLost.length) {
    issues.push({ kind: "name", message: `고유명사가 빠졌다(${show(namesLost)}) — 프로젝트 DB 의 이름(인물·아이템·장소·퀘스트·스킬)은 그대로 둔다.` });
  }
  const hedgesBefore = hedgeCount(before), hedgesAfter = hedgeCount(after);
  if (hedgesAfter < hedgesBefore) {
    issues.push({ kind: "hedge", message: `추측·유보 표현이 줄었다(${hedgesBefore} → ${hedgesAfter}) — 「아마·어쥩면·혹시·~지도·~것 같다」를 단정으로 바꾸지 않는다.` });
  }
  const negBefore = negationCount(before), negAfter = negationCount(after);
  if (negAfter !== negBefore) {
    issues.push({ kind: "polarity", message: `부정 표현 수가 바뀌었다(${negBefore} → ${negAfter}) — 「안·못·않·없·아니」를 빼거나 더하면 뜻이 뒤집힌다. 「A가 아니라 B」는 「A 말고 B」처럼 부정을 남겨 고친다.` });
  }
  return issues;
}

/** 한 줄 거절 글 — 도구가 모델에게 돌려주는 꼴. */
export function meaningGuardMessage(issues: readonly MeaningGuardIssue[]): string {
  return `뜻이 바뀌었다: ${issues.map((issue) => issue.message).join(" / ")}`;
}

interface NamedRecords {
  readonly database?: Partial<Record<"actors" | "items" | "equipment" | "skills" | "enemies" | "states", readonly { readonly name?: string }[]>>;
  readonly maps?: Readonly<Record<string, { readonly name?: string }>>;
  readonly quests?: readonly { readonly title?: string }[];
}

/**
 * 지켜야 할 고유명사 — 배우·아이템·장비·스킬·적·상태·맵 이름과 퀘스트 제목.
 * 편집기 기본 DB 에서 온 이름(「공격」「할머니」「회복약」)은 흔한 낱말이라 빼고, 저자가 만든 두 글자 이상 이름만 센다.
 */
export function meaningGuardNames(project: NamedRecords, factoryNames: ReadonlySet<string> = new Set()): string[] {
  const db = project.database ?? {};
  const raw = [
    ...(["actors", "items", "equipment", "skills", "enemies", "states"] as const).flatMap((key) => (db[key] ?? []).map((record) => record.name)),
    ...Object.values(project.maps ?? {}).map((map) => map.name),
    ...(project.quests ?? []).map((quest) => quest.title),
  ];
  const names = new Set<string>();
  for (const value of raw) {
    const name = (value ?? "").trim();
    if (name.length < 2 || name.length > 24 || factoryNames.has(name)) continue;
    names.add(name);
  }
  return [...names];
}

/** 기본 DB(createBlankProject 의 database) 이름 집합 — meaningGuardNames 의 두째 인자. */
export function factoryRecordNames(database: NamedRecords["database"]): Set<string> {
  return new Set((["actors", "items", "equipment", "skills", "enemies", "states"] as const)
    .flatMap((key) => (database?.[key] ?? []).map((record) => (record.name ?? "").trim())).filter(Boolean));
}
