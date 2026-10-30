import { type Metric, metric, paragraphs, rawLines, stripMarkup } from "../core.ts";
import { mean, pstdev, roundHalfEven } from "../text/num.ts";
import { type Rx, re } from "../text/regex.ts";
import { sentences, wordCount } from "./sentences.ts";
import {
  isBodyParagraph,
  markupShape,
  metaphorCallback,
  paragraphConnectiveRepeat,
  paragraphSentenceCount,
  startRepeatShare,
} from "./signals.ts";
import { fillNote, METRIC_NOTES, type MetricKey } from "./strings.ts";

export { sentences, wordCount } from "./sentences.ts";

/**
 * English structure/rhythm metrics (word-based). Thresholds come from references/en/evidence/calibration.json (human
 * p90 vs AI median on the mined corpora) and the calibration test pins them to that file. Voice metrics
 * (question_ratio, contraction_per_1k_words, oneliner_para_ratio) stay informational (threshold 0): on a single-author
 * human baseline they measure that author's voice, not AI-ness.
 */

/** Metaphor callback is advisory: PG repeats a vehicle when the essay is literally about it (ladder 9, engine 7). */
const CALLBACK_MAX = 2;
const EM_DASH = re(String.raw`—|–|(?<=\w)--(?=\w)`);
const TRIAD = re(String.raw`\b[A-Za-z]+, [A-Za-z]+, (?:and|or) [A-Za-z]+\b`);
const CONTRACTION = re(String.raw`\b[A-Za-z]+(?:n['’]t|['’](?:re|ll|ve|d|m|s))\b`);
const COLON_LABEL_LINE = re(String.raw`^[^:\n]{1,40}: \S`);
const CURLY_APOSTROPHE = re("(?<=[A-Za-z])’(?=[A-Za-z])");
/** Every branch clears the same lift gate as a pattern; `rather than` and bare `not only` are ordinary English. */
const NEG_REDEFINE = re(
  String.raw`\bnot (?:just|merely|simply) (?:a |an |the )?\w+|\bisn['’]t (?:just|merely|simply|about)\b|\bit['’]s not (?:about )?[^.;\n]{1,40}[,;—] it['’]s\b|\bless about [^.;\n]{1,30} than\b`,
  "i",
);
const ONE_LINER_MAX_WORDS = 12;
/** Web reading: body paragraphs run 1-2 sentences; flag when 3+-sentence paragraphs exceed 35%. */
const PARA_MULTI_MIN_SENTS = 3;
const PARA_MULTI_SHARE_MAX = 0.35;

export type ScoredKey =
  | "sentence_mean_words"
  | "sentence_length_cv"
  | "sentence_start_repeat_share"
  | "para_connective_repeat"
  | "neg_redefine_per_1k_words"
  | "emdash_per_1k_words"
  | "triad_per_1k_words"
  | "bullet_line_ratio"
  | "colon_label_per_1k_words";

/** Scored thresholds = Paul Graham p90 where the AI median sits past it; 0 = informational. */
export const THRESHOLDS: Readonly<Record<ScoredKey, number>> = {
  sentence_mean_words: 0.0,
  sentence_length_cv: 0.0,
  sentence_start_repeat_share: 0.0,
  para_connective_repeat: 0.0,
  neg_redefine_per_1k_words: 0.0,
  emdash_per_1k_words: 2.51,
  triad_per_1k_words: 0.0,
  bullet_line_ratio: 0.01,
  colon_label_per_1k_words: 3.56,
};

type Kind = "int" | "float";
type RowExtra = { readonly note?: string; readonly advisory?: boolean; readonly valueKind?: Kind; readonly thresholdKind?: Kind };
type Direction = "higher-is-bad" | "lower-is-bad";

/** One metric row; ratios, rates and thresholds are floats unless the row says otherwise (counts are ints). */
function row(key: MetricKey, value: number, threshold: number, direction: Direction, extra: RowExtra = {}): Metric {
  return metric({
    key,
    value,
    valueKind: extra.valueKind ?? "float",
    threshold,
    thresholdKind: extra.thresholdKind ?? "float",
    higherIsBad: direction === "higher-is-bad",
    note: extra.note ?? METRIC_NOTES[key],
    advisory: extra.advisory ?? false,
  });
}

function share(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0.0;
}

export function computeMetrics(text: string): Metric[] {
  const sents = sentences(text);
  const paras = paragraphs(text);
  const plain = stripMarkup(text);
  const lens = sents.map(wordCount);
  const per1k = 1000 / Math.max(1, wordCount(plain));
  const avg = lens.length > 0 ? mean(lens) : 0.0;
  const avgKind: Kind = lens.length > 0 && Number.isInteger(avg) ? "int" : "float";
  const cv = lens.length > 1 && avg !== 0 ? pstdev(lens) / avg : 0.0;
  const [connWord, connN] = paragraphConnectiveRepeat(paras);
  const shape = markupShape(text);
  const oneliners = paras.filter((p) => wordCount(p) <= ONE_LINER_MAX_WORDS).length;
  const questions = share(sents.filter((s) => s.endsWith("?")).length, sents.length);
  const colonLabels = rawLines(text).filter((line) => COLON_LABEL_LINE.match(line) !== null).length;
  const bodyParas = paras.filter(isBodyParagraph);
  const multi = bodyParas.filter((p) => paragraphSentenceCount(p) >= PARA_MULTI_MIN_SENTS).length;
  const [cbWord, cbN] = metaphorCallback(plain);
  const rate = (rx: Rx): number => roundHalfEven(rx.finditer(plain).length * per1k, 2);
  const t = THRESHOLDS;
  const up: Direction = "higher-is-bad";
  const down: Direction = "lower-is-bad";
  return [
    row("sentence_mean_words", roundHalfEven(avg, 1), t.sentence_mean_words, up, { valueKind: avgKind }),
    row("sentence_length_cv", roundHalfEven(cv, 2), t.sentence_length_cv, down),
    row("sentence_start_repeat_share", roundHalfEven(startRepeatShare(sents), 3), t.sentence_start_repeat_share, up),
    row("para_connective_repeat", connN, t.para_connective_repeat, up, {
      valueKind: "int",
      note: fillNote(METRIC_NOTES.para_connective_repeat, { conn_word: connWord }),
    }),
    row("neg_redefine_per_1k_words", rate(NEG_REDEFINE), t.neg_redefine_per_1k_words, up),
    row("emdash_per_1k_words", rate(EM_DASH), t.emdash_per_1k_words, up),
    row("triad_per_1k_words", rate(TRIAD), t.triad_per_1k_words, up),
    row("bullet_line_ratio", roundHalfEven(shape.ratio, 2), t.bullet_line_ratio, up, {
      note: fillNote(METRIC_NOTES.bullet_line_ratio, { bullets: shape.bullets, headings: shape.headings }),
    }),
    row("colon_label_per_1k_words", roundHalfEven(colonLabels * per1k, 2), t.colon_label_per_1k_words, up),
    row("curly_apostrophe_per_1k_words", rate(CURLY_APOSTROPHE), 0.0, up),
    row("oneliner_para_ratio", roundHalfEven(share(oneliners, paras.length), 2), 0.0, down),
    row("question_ratio", roundHalfEven(questions, 3), 0.0, down),
    row("para_multi_sentence_share", roundHalfEven(share(multi, bodyParas.length), 2), PARA_MULTI_SHARE_MAX, up, {
      note: fillNote(METRIC_NOTES.para_multi_sentence_share, { multi, total: bodyParas.length }),
      advisory: true,
    }),
    row("contraction_per_1k_words", rate(CONTRACTION), 0.0, down),
    row("metaphor_callback_max", cbN, CALLBACK_MAX, up, {
      valueKind: "int",
      thresholdKind: "int",
      note: fillNote(METRIC_NOTES.metaphor_callback_max, { word: cbWord === "" ? "-" : cbWord }),
      advisory: true,
    }),
  ];
}
