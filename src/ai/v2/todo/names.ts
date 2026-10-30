// 할 일 검사기의 느슨한 이름 맞추기 — 모델이 쓴 「해골 기사의 방」「촌장(마을)」「skeleton knight」를
// 프로젝트의 맵·이벤트·아이템 이름에 맞춘다. 공백·문장부호·괄호·끝 조사를 떼고, 영어 낱말 몇 개는 한국어로 바꿔 비교한다.
// 같음 > 포함(두 글자 이상) 순으로 맞고, 못 맞추면 가장 가까운 후보를 돌려 모델이 고칠 수 있게 한다.

const SYNONYMS: ReadonlyArray<[RegExp, string]> = [
  [/skeleton/gu, "해골"],
  [/knight/gu, "기사"],
  [/boss/gu, "보스"],
  [/demon ?lord|demon ?king/gu, "마왕"],
  [/demon/gu, "악마"],
  [/dungeon/gu, "던전"],
  [/cave(rn)?/gu, "동굴"],
  [/village|town/gu, "마을"],
  [/room/gu, "방"],
  [/chief|elder/gu, "촌장"],
  [/merchant/gu, "상인"],
  [/inn/gu, "여관"],
  [/shop|store/gu, "상점"],
  [/forest|woods/gu, "숲"],
  [/castle/gu, "성"],
  [/key/gu, "열쇠"],
  [/potion/gu, "포션"],
  [/evidence|clue/gu, "증거"],
  [/guard/gu, "경비"],
  [/king/gu, "왕"],
];

// 끝 조사는 이름 글자와 겹치지 않는 긴 것만 뗀다 — 「마을」「버들마을」의 「을」, 「여관」의 「관」처럼 이름 끝이 조사 꼴인 낱말이 많다.
const TAIL = /(에게서|에게|한테)$/u;

/** 비교용 꼴: 괄호 안·문장부호·공백을 떼고 소문자·동의어·끝 조사 하나를 정리. */
export function normName(raw: string | undefined | null, keepParens = false): string {
  let s = String(raw ?? "").normalize("NFC").toLowerCase();
  if (!keepParens) s = s.replace(/\([^()]*\)|\[[^[\]]*\]|（[^（）]*）|「|」|『|』/gu, " ");
  for (const [re, ko] of SYNONYMS) s = s.replace(re, ko);
  s = s.replace(/[\s\p{P}\p{S}_]+/gu, "");
  const t = s.replace(TAIL, "");
  return t.length >= 2 ? t : s;
}

/** 두 이름이 같은 것을 가리키나: 0=아님, 2=포함(짧은 쪽 ≥ 긴 쪽 절반), 3=같음. */
export function nameScore(want: string, have: string | undefined | null): number {
  if (!have) return 0;
  let best = 0;
  for (const keep of [false, true]) {
    const a = normName(want, keep), b = normName(have, keep);
    if (!a || !b) continue;
    if (a === b) return 3;
    const short = a.length <= b.length ? a : b, long = a.length <= b.length ? b : a;
    // 부분 일치는 짧은 쪽이 긴 쪽 길이의 절반 이상일 때만 — 「기사」가 「견습 기사단장 훈련장」을 잡지 않게.
    if (short.length >= 2 && short.length * 2 >= long.length && long.includes(short)) best = Math.max(best, 2);
  }
  return best;
}

export const nameMatches = (want: string, have: string | undefined | null): boolean => nameScore(want, have) > 0;

/** 편집 거리(글자 단위, 짧은 이름용). */
function editDistance(a: string, b: string): number {
  const A = [...a], B = [...b];
  let prev = Array.from({ length: B.length + 1 }, (_, i) => i);
  for (let i = 1; i <= A.length; i++) {
    const cur = [i];
    for (let j = 1; j <= B.length; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (A[i - 1] === B[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[B.length]!;
}

/** 이름 후보 가운데 가까운 것 몇 개(맞춤 실패 설명용). */
export function nearestNames(want: string, names: Iterable<string>, n = 3): string[] {
  const a = normName(want);
  const seen = new Set<string>();
  const scored: { name: string; d: number }[] = [];
  for (const name of names) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const b = normName(name);
    if (!b) continue;
    const shared = [...new Set(a)].filter((ch) => b.includes(ch)).length;
    scored.push({ name, d: editDistance(a, b) - shared * 0.5 });
  }
  return scored.sort((x, y) => x.d - y.d).slice(0, n).map((s) => s.name);
}

export const hint = (want: string, names: Iterable<string>): string => {
  const near = nearestNames(want, names);
  return near.length ? ` 가까운 후보: ${near.map((x) => `「${x}」`).join(", ")}` : " 후보가 하나도 없다";
};
