/**
 * Register awareness for the Korean structure metrics, fitted on the fit half of a human/AI Korean bench:
 * the speech level of a text, a sentence-ending key that ignores the speech-level suffix, and the metrics a lint
 * profile reads as notices instead of scoring. Evidence: the fit/check bench split (tools/bench).
 */
import { BAND_FIX_AT, FAMILY, type FamilyHit, type Metric, metricFlagged } from "../core.ts";
import { cpSlice } from "../text/chars.ts";
import { re } from "../text/regex.ts";

const LAST_WORD = re(`([가-힣]{1,5})[.!?]?$`);
const POLITE_END = re(`(?:니다|니까|요|죠)[.!?]?$`);
const POLITE_SUFFIX = re(`(?:니다|니까|어요|아요|여요|에요|예요|해요|세요|지요|네요|군요|죠)$`);
const SEUBNIDA = re(`습니다$`);
const PLAIN_END = re(`(?<!니)다[.!?]?$`);

/** A text whose sentences mostly end in 합니다체 or 해요체. */
export const POLITE_SHARE_MIN = 0.5;
/** A text whose sentences mostly end in the plain declarative 해라체 (~다, not ~니다). */
export const PLAIN_SHARE_MIN = 0.5;
/** Short-sentence cutoff in the polite register: 합니다/해요 add about three characters to every sentence. */
export const SHORT_SENT_MAX_POLITE = 18;

export function politeShare(sents: readonly string[]): number {
  if (sents.length === 0) return 0;
  return sents.filter((s) => POLITE_END.search(s) !== null).length / sents.length;
}

/**
 * The ending a run counts: the last two syllables, but in the polite register the predicate syllable before the
 * speech-level suffix too ("있습니다" vs "했습니다", "됩니다" vs "입니다"). Without it every 합니다체 sentence shares the
 * ending "니다", and ordinary formal prose read as a monotone run (same_ending_run3_share fired on 9/10 fit external blogs).
 */
export function endingKey(sentence: string): string | null {
  const m = LAST_WORD.search(sentence);
  if (m === null) return null;
  const word = m.groups[0] ?? "";
  if (SEUBNIDA.search(word) !== null) return cpSlice(word, -4);
  if (POLITE_SUFFIX.search(word) !== null) return cpSlice(word, -3);
  return cpSlice(word, -2);
}

export function plainShare(sents: readonly string[]): number {
  if (sents.length === 0) return 0;
  return sents.filter((s) => PLAIN_END.search(s) !== null).length / sents.length;
}

export function shortSentenceMax(polite: number, plainMax: number): number {
  return polite > POLITE_SHARE_MIN ? SHORT_SENT_MAX_POLITE : plainMax;
}

/** Metrics that never separated human from AI documents on the bench fit split; printed as notices in every register. */
const ADVISORY_ALWAYS: ReadonlySet<string> = new Set(["sentence_mean_chars", "para_connective_repeat"]);

/** Per lint profile: metrics human prose of that register trips as often as AI prose does. */
const ADVISORY_BY_REGISTER: Readonly<Record<string, ReadonlySet<string>>> = {
  report: new Set(["short_sentence_share", "para_multi_sentence_share", "metaphor_callback_max"]),
  blog: new Set(["bullet_line_ratio"]),
};

/**
 * A report written mostly in 해라체 is reference prose (an encyclopedia entry, a history): it lists its items as bullets
 * and its endings collapse to 였다/했다/이다/있다 the way 합니다체 collapses to 니다. Among the fit-half 해라체 reports,
 * bullet_line_ratio fired on 9 of 20 human wiki revisions and 4 of 7 AI reports, same_ending_run3_share on 6 of 20 and
 * 1 of 7; neither decided a fit AI verdict (bench fit).
 */
const ADVISORY_PLAIN_REPORT: ReadonlySet<string> = new Set(["bullet_line_ratio", "same_ending_run3_share", "top_ending_share"]);

/**
 * In a report, a long mean sentence scores again once the text is dense with regex tells (fit: every
 * passing human wiki doc stays under 5.2 hits per 1k chars; the four AI docs the plain notice lost sit at 7.5-9.2).
 */
export const REPORT_MEAN_TELL_DENSITY_MIN = 6;

/**
 * A metric that re-counts what a regex family already scores is a notice while that family has hits in the text
 * (fit: neg_redefine_per_2k decided no AI document and added a second point to three human posts
 * whose 아니라 hits had already scored as neg-redefine).
 */
const COUNTED_BY_FAMILY: Readonly<Record<string, string>> = { neg_redefine_per_2k: FAMILY.NEG_REDEFINE };

/**
 * Per lint profile: metric groups that score only when at least this many of their metrics fire. In blog prose one
 * length-spread metric alone fired on 4 of 36 fit human posts and on none of the AI drafts; the two AI drafts
 * whose rhythm fired failed on two (bench fit).
 */
const GROUP_QUORUM_BY_REGISTER: Readonly<Record<string, Readonly<Record<string, number>>>> = { blog: { rhythm: 2 } };

/** What the register rules read besides the metrics: the lint profile and the regex hits the scan kept. */
export type RegisterContext = {
  readonly register: string | null;
  readonly tellsPer1k: number;
  readonly hits: readonly FamilyHit[];
  /** Share of sentences ending in the plain declarative, from `plainShare`. */
  readonly plainShare: number;
};

function scoredAnyway(key: string, ctx: RegisterContext): boolean {
  return key === "sentence_mean_chars" && ctx.register === "report" && ctx.tellsPer1k >= REPORT_MEAN_TELL_DENSITY_MIN;
}

function noticeOnly(m: Metric, ctx: RegisterContext): boolean {
  const local = ctx.register === null ? undefined : ADVISORY_BY_REGISTER[ctx.register];
  const family = COUNTED_BY_FAMILY[m.key];
  if (family !== undefined && ctx.hits.some((h) => h.family === family)) return true;
  if (ctx.register === "report" && ctx.plainShare > PLAIN_SHARE_MIN && ADVISORY_PLAIN_REPORT.has(m.key)) return true;
  return (ADVISORY_ALWAYS.has(m.key) || local?.has(m.key) === true) && !scoredAnyway(m.key, ctx);
}

/** Scored metrics of a group short of its quorum become notices. */
function applyQuorum(metrics: readonly Metric[], register: string | null): Metric[] {
  const quorum = register === null ? undefined : GROUP_QUORUM_BY_REGISTER[register];
  if (quorum === undefined) return [...metrics];
  const firing = (group: string): number => metrics.filter((m) => m.group === group && !m.advisory && metricFlagged(m)).length;
  return metrics.map((m) => {
    const need = quorum[m.group];
    return need !== undefined && !m.advisory && metricFlagged(m) && firing(m.group) < need ? { ...m, advisory: true } : m;
  });
}

export function applyRegister(metrics: readonly Metric[], ctx: RegisterContext): Metric[] {
  return applyQuorum(
    metrics.map((m) => (noticeOnly(m, ctx) ? { ...m, advisory: true } : m)),
    ctx.register,
  );
}

/**
 * The score at which the fix band starts, per lint profile. Korean blog prose by people carries more catalog tells than
 * the unit was calibrated on: on the fit half, four human posts scored 4.22-4.52 on regex alone while the lowest AI
 * blog draft scored 4.77, so the blog band starts at the midpoint, 4.65 (bench fit).
 */
const FIX_AT_BY_REGISTER: Readonly<Record<string, number>> = { blog: 4.65 };

export function fixAt(register: string | null): number {
  return (register === null ? undefined : FIX_AT_BY_REGISTER[register]) ?? BAND_FIX_AT;
}
