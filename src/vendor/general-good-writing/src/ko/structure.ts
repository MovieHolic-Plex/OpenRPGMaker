/** Korean structure and rhythm metrics. Thresholds: measured on 29 human essays vs 97 AI texts. */
import { FAMILY, type FamilyHit, type Metric, metric, paragraphs, stripMarkup } from "../core.ts";
import { counter, cpLen, stripSpace } from "../text/chars.ts";
import { mean, pstdev, roundHalfEven } from "../text/num.ts";
import { type Rx, re } from "../text/regex.ts";
import { LEDE_SENTENCES_MAX, ledeAssertionDensity, ledeSentences } from "./lede.ts";
import { ANALOGY_VEHICLES, PATTERNS } from "./patterns.ts";
import { applyRegister, endingKey, plainShare, politeShare, shortSentenceMax } from "./register.ts";
import { METRIC_NOTES as N } from "./strings.ts";
import { OBLIGATION_PARAS_MAX, obligationEndingParagraphs, QUOTED_EMPHASIS_PER_1K_MAX, quotedEmphasisPer1k } from "./surface.ts";

// Metaphor callback: the same vehicle noun used 4+ times in one piece. Human essays (47) stay at 0-2;
// AI long-form docs (302) reach p90 3. The 마구 entry carries its own particle lookahead, so it gets no trailing guard.
export const CALLBACK_MAX = 3;
const VEHICLE_RES: readonly Rx[] = ANALOGY_VEHICLES.split("|").map((v) =>
  re(`(?<![가-힣])(?:${v})${v.includes("(?=") ? "" : "(?:(?![가-힣])|(?=[이가은는을를의에로와과도처마인였입예]))"}`),
);
const SENT_SPLIT = re(String.raw`(?<=[.!?])\s+|\n+`);
const BULLET_LINE = re(String.raw`^\s*(?:[-*•]|\d+[.)])\s+`);
const HEADING_LINE = re(String.raw`^\s*#{1,6}\s+`);
const HEADING_PREFIX = re(String.raw`(?m)^\s*#{1,6}\s+`);
const BULLET_PREFIX = re(String.raw`(?m)^\s*(?:[-*•]|\d+[.)])\s+`);
const ONE_LINER_MAX = 40;
// Body paragraphs of 3+ sentences (tables, bullets, headings excluded). A reader rule (over 1/3 of them)
// flagged 11/36 fit human blog posts; fit humans reach 0.69, AI drafts that fire sit at 0.86-1.0 (bench fit).
const PARA_MULTI_MIN_SENTS = 3;
const PARA_MULTI_SHARE_MAX = 0.8;
// Sentence-length tails (23 essays / 51 agent docs / 4 columns): short_sentence_share >= 0.10 in every human
// essay; 8/23 human essays have no 80-char sentence, so the long share is advisory. Of 80-char+ sentences, humans carry
// a catalog tell in 0.20-0.43, AI prose in 0.33-0.67.
export const LONG_SENT_MIN = 80;
export const LONG_SHARE_MIN = 0.01;
export const LONG_TELL_SHARE_MAX = 0.5;
export const LONG_TELL_MIN_SENTS = 3;
export const SHORT_SENT_MAX = 15;
export const SHORT_SHARE_MIN = 0.1;
export const TAIL_MIN_SENTS = 10;
// The three length-spread metrics read one property (rhythm), the two ending metrics another; each group scores once.
const RHYTHM = "rhythm";
const ENDINGS = "endings";
// Uniform mid-band drafts pass every tail metric yet read as choppy (seven Korean texts): agent drafts sat at
// mid-band share 0.71/0.76 and cv 0.48, human cv is 0.56-0.90; both floors sit below the human minimum with margin.
export const CV_MIN = 0.52;
export const MID_BAND_MIN = 16;
export const MID_BAND_MAX = 40;
export const MID_BAND_SHARE_MAX = 0.68;
// Low-severity tells (translationese, ordinary verbs) sit in human long sentences as often as in AI ones (bench fit split:
// 7/10 external blogs over 0.5 counting them, 0/10 without); only mid and high tells count here.
const SENTENCE_PATTERNS = PATTERNS.filter((p) => !p.raw && !p.tailOnly && p.severity !== "low");
const PARA_CONNECTIVES: readonly { readonly word: string; readonly rx: Rx }[] = [
  "그래서",
  "하지만",
  "그러나",
  "다만",
  "따라서",
  "그러니까",
  "결국",
  "즉",
  "한편",
  "이제",
  "또한",
  "동시에",
  "여기서",
  "이때",
  "먼저",
  "우선",
  "물론",
  "사실",
  "실제로",
  "문제는",
  "핵심은",
  "정리하면",
  "그리고",
  "그런데",
  "오히려",
  "정작",
  "반대로",
  "이렇게",
  "이런",
].map((word) => ({ word, rx: re(`^${word}[ ,]`) }));
const NEG_REDEFINE = re(String.raw`(?:이|가|은|는|게|것이|건) 아니라\b|라기보다|에 가깝(?:다|습니다)|(?:장면|순간)(?:은|이) 없었`);

function splitSentences(text: string): string[] {
  return SENT_SPLIT.split(text)
    .map((s) => stripSpace(s ?? ""))
    .filter((s) => cpLen(s) >= 5);
}

export function sentences(text: string): string[] {
  return splitSentences(BULLET_PREFIX.sub(HEADING_PREFIX.sub(stripMarkup(text), " "), " "));
}

function ratio(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}

/** Share of ending runs of length 3+, and the share of the most frequent ending. */
function endingRuns(sents: readonly string[]): { readonly run3: number; readonly topShare: number } {
  const runs: number[] = [];
  const endings: string[] = [];
  let prev: string | null = null;
  let run = 0;
  for (const s of sents) {
    const e = endingKey(s);
    if (e === null) continue;
    endings.push(e);
    if (e === prev) run += 1;
    else {
      if (prev !== null) runs.push(run);
      prev = e;
      run = 1;
    }
  }
  if (prev !== null) runs.push(run);
  const counts = [...counter(endings).values()];
  return {
    run3: ratio(runs.filter((r) => r >= 3).length, runs.length),
    topShare: ratio(Math.max(0, ...counts), endings.length),
  };
}

/** The paragraph-opening connective used most often (first seen wins a tie) and its count. */
function paragraphConnectiveRepeat(paras: readonly string[]): { readonly word: string; readonly count: number } {
  const openers: string[] = [];
  for (const p of paras) {
    const first = stripSpace(p.split("\n")[0] ?? "");
    const hit = PARA_CONNECTIVES.find((c) => c.rx.match(first) !== null);
    if (hit !== undefined) openers.push(hit.word);
  }
  let best = { word: "", count: 0 };
  for (const [word, count] of counter(openers)) if (count > best.count) best = { word, count };
  return best;
}

function markupShape(text: string): { readonly bullets: number; readonly headings: number; readonly ratio: number } {
  const lines = text.split("\n").filter((line) => stripSpace(line) !== "");
  const bullets = lines.filter((line) => BULLET_LINE.match(line) !== null).length;
  const headings = lines.filter((line) => HEADING_LINE.match(line) !== null).length;
  return { bullets, headings, ratio: ratio(bullets, lines.length) };
}

/** The vehicle noun that recurs most (first listed wins a tie) and how many times; ("", 0) when none appears. */
function metaphorCallback(plain: string): { readonly word: string; readonly count: number } {
  let best = { word: "", count: 0 };
  for (const rx of VEHICLE_RES) {
    const found = rx.finditer(plain);
    const first = found[0];
    if (first !== undefined && found.length > best.count) best = { word: first.text, count: found.length };
  }
  return best;
}

function isBodyParagraph(p: string): boolean {
  return HEADING_LINE.match(p) === null && BULLET_LINE.match(p) === null && !stripSpace(p).startsWith("|");
}

// Typography tells per 1k chars (bench fit): human docs max 2.78 in every corpus, AI long-form median 7.57,
// agent messages median 12.0. Density, not count, because every AI dash and colon already adds a low/mid hit.
export const TYPOGRAPHY_PER_1K_MAX = 3;

export function computeMetrics(text: string, register: string | null = null, hits: readonly FamilyHit[] = []): Metric[] {
  const per1k = (n: number): number => (n * 1000) / Math.max(1, cpLen(stripMarkup(text)));
  const typography = per1k(hits.filter((h) => h.family === FAMILY.TYPOGRAPHY).length);
  const typographyMetric = floatMetric("typography_per_1k", roundHalfEven(typography, 2), TYPOGRAPHY_PER_1K_MAX, true, N.typographyPer1k);
  return applyRegister([...rawMetrics(text), typographyMetric], {
    register,
    tellsPer1k: per1k(hits.length),
    hits,
    plainShare: plainShare(sentences(text)),
  });
}

function rawMetrics(text: string): Metric[] {
  const sents = sentences(text);
  const paras = paragraphs(text);
  const lens = sents.map(cpLen);
  const n = lens.length;
  const meanLen = n > 0 ? mean(lens) : 0;
  const cv = n > 1 && meanLen !== 0 ? pstdev(lens) / meanLen : 0;
  const { run3, topShare } = endingRuns(sents);
  const conn = paragraphConnectiveRepeat(paras);
  const shape = markupShape(text);
  const plain = stripMarkup(text);
  const negPer2k = (NEG_REDEFINE.findall(plain).length / Math.max(1, cpLen(plain))) * 2000;
  const oneliners = paras.filter((p) => cpLen(p) <= ONE_LINER_MAX).length;
  const questions = ratio(sents.filter((s) => s.endsWith("?")).length, n);
  const longSents = sents.filter((s) => cpLen(s) >= LONG_SENT_MIN);
  const shortMax = shortSentenceMax(politeShare(sents), SHORT_SENT_MAX);
  const shortShare = ratio(lens.filter((l) => l <= shortMax).length, n);
  const midBandShare = ratio(lens.filter((l) => MID_BAND_MIN <= l && l <= MID_BAND_MAX).length, n);
  const tailsScored = n >= TAIL_MIN_SENTS;
  const longWithTell = longSents.filter((s) => SENTENCE_PATTERNS.some((p) => p.regex.test(s))).length;
  const longTellThreshold = longSents.length >= LONG_TELL_MIN_SENTS ? LONG_TELL_SHARE_MAX : 0;
  const bodyParas = paras.filter(isBodyParagraph);
  const multi = bodyParas.filter((p) => splitSentences(p).length >= PARA_MULTI_MIN_SENTS).length;
  const callback = metaphorCallback(plain);
  const r = roundHalfEven;
  return [
    metric({
      key: "sentence_mean_chars",
      value: r(meanLen, 1),
      valueKind: n > 0 && Number.isInteger(meanLen) ? "int" : "float",
      threshold: 45,
      thresholdKind: "int",
      higherIsBad: true,
      note: N.sentenceMeanChars,
    }),
    { ...floatMetric("sentence_length_cv", r(cv, 2), tailsScored ? CV_MIN : 0, false, N.sentenceLengthCv), group: RHYTHM },
    {
      ...floatMetric(
        "mid_band_share",
        r(midBandShare, 3),
        tailsScored ? MID_BAND_SHARE_MAX : 0,
        true,
        N.midBandShare(MID_BAND_MIN, MID_BAND_MAX),
      ),
      group: RHYTHM,
    },
    {
      ...floatMetric("long_sentence_share", r(ratio(longSents.length, n), 3), tailsScored ? LONG_SHARE_MIN : 0, false, N.longSentenceShare),
      advisory: true,
    },
    floatMetric(
      "long_sentence_tell_share",
      r(ratio(longWithTell, longSents.length), 2),
      longTellThreshold,
      true,
      N.longSentenceTellShare(longSents.length, longWithTell),
    ),
    {
      ...floatMetric("short_sentence_share", r(shortShare, 3), tailsScored ? SHORT_SHARE_MIN : 0, false, N.shortSentenceShare),
      group: RHYTHM,
    },
    { ...floatMetric("same_ending_run3_share", r(run3, 3), 0.06, true, N.sameEndingRun3Share), group: ENDINGS },
    { ...floatMetric("top_ending_share", r(topShare, 2), 0.6, true, N.topEndingShare), evidence: "estimated", group: ENDINGS },
    metric({
      key: "para_connective_repeat",
      value: conn.count,
      valueKind: "int",
      threshold: 2,
      thresholdKind: "int",
      higherIsBad: true,
      note: N.paraConnectiveRepeat(conn.word),
      evidence: "estimated",
    }),
    floatMetric("neg_redefine_per_2k", r(negPer2k, 2), 1.5, true, N.negRedefinePer2k),
    {
      ...floatMetric("bullet_line_ratio", r(shape.ratio, 2), 0.25, true, N.bulletLineRatio(shape.bullets, shape.headings)),
      evidence: "estimated",
    },
    floatMetric("oneliner_para_ratio", r(ratio(oneliners, paras.length), 2), 0, false, N.onelinerParaRatio),
    floatMetric("question_ratio", r(questions, 3), 0, false, N.questionRatio),
    floatMetric(
      "para_multi_sentence_share",
      r(ratio(multi, bodyParas.length), 2),
      PARA_MULTI_SHARE_MAX,
      true,
      N.paraMultiSentenceShare(multi, bodyParas.length),
    ),
    intMetric("metaphor_callback_max", callback.count, CALLBACK_MAX, N.metaphorCallbackMax(callback.word === "" ? "-" : callback.word)),
    { ...intMetric("lede_sentences", ledeSentences(text), LEDE_SENTENCES_MAX, N.ledeSentences), evidence: "estimated" },
    {
      ...floatMetric("lede_assertion_density", ledeAssertionDensity(text), 0.3, false, N.ledeAssertionDensity),
      advisory: true,
      evidence: "estimated",
    },
    {
      ...floatMetric("quoted_emphasis_per_1k", quotedEmphasisPer1k(text), QUOTED_EMPHASIS_PER_1K_MAX, true, N.quotedEmphasisPer1k),
      advisory: true,
    },
    {
      ...intMetric("obligation_ending_paragraphs", obligationEndingParagraphs(text), OBLIGATION_PARAS_MAX, N.obligationEndingParagraphs),
      advisory: true,
      evidence: "estimated",
    },
  ];
}

/** A ratio or density metric: value and threshold always print as decimals (`0.0`, `1.0`). */
function floatMetric(key: string, value: number, threshold: number, higherIsBad: boolean, note: string): Metric {
  return metric({ key, value, valueKind: "float", threshold, thresholdKind: "float", higherIsBad, note });
}

function intMetric(key: string, value: number, threshold: number, note: string): Metric {
  return metric({ key, value, valueKind: "int", threshold, thresholdKind: "int", higherIsBad: true, note });
}
