import { cpLen, cpSlice, stripSpace } from "./text/chars.ts";
import { Rx, type RxFlag, re } from "./text/regex.ts";

export const LANGS = ["ko", "en"] as const;
export type Lang = (typeof LANGS)[number];

export const FAMILY = {
  NEG_REDEFINE: "neg-redefine",
  AUTHORITY_NOUN: "authority-noun",
  METAPHOR_NOUN: "metaphor-noun",
  PERSONIFY: "personify",
  ENUM_ANNOUNCE: "enum-announce",
  META_GUIDE: "meta-guide",
  TAKEAWAY: "takeaway",
  CLOSING_OFFER: "closing-offer",
  HEDGE_TAIL: "hedge-tail",
  TRANSLATIONESE: "translationese",
  STOCK_PHRASE: "stock-phrase",
  BANNED_WORD: "banned-word",
  MODEL_TIC: "model-tic",
  TYPOGRAPHY: "typography",
  APHORISM: "aphorism-landing",
  FORCED_ANALOGY: "forced-analogy",
} as const;
export type Family = (typeof FAMILY)[keyof typeof FAMILY];

export const SEVERITIES = ["high", "mid", "low"] as const;
export type Severity = (typeof SEVERITIES)[number];
export type Band = "pass" | "fix" | "rewrite";

export const SEVERITY_WEIGHT: Readonly<Record<Severity, number>> = { high: 3.0, mid: 1.0, low: 0.15 };
export const METRIC_WEIGHT = 1.0;
export const BAND_FIX_AT = 4.0;
export const BAND_REWRITE_AT = 9.0;
export const TAIL_RATIO = 0.15;
/** One family alone never puts a text in the rewrite band (im-not-ai teardown): see `dominantFamily`. */
export const DOMINANT_SHARE = 0.6;

export type Evidence = "measured" | "estimated";

export type Pattern = {
  readonly pid: string;
  readonly family: Family;
  readonly severity: Severity;
  readonly regex: Rx;
  readonly hint: string;
  /** Applies only to sentences inside the last TAIL_RATIO of the text. */
  readonly tailOnly: boolean;
  /** Runs over raw lines (code removed, markup kept) instead of stripped sentences; never combined with `tailOnly`. */
  readonly raw: boolean;
};

export class PatternDefinitionError extends Error {
  override readonly name = "PatternDefinitionError";
}

export type PatternOptions = { readonly tailOnly?: boolean; readonly raw?: boolean; readonly flags?: readonly RxFlag[] };

/** Every catalog pattern is compiled multiline, plus the flags it names. */
export function makePattern(pid: string, family: Family, severity: Severity, rx: string, hint: string, opts: PatternOptions = {}): Pattern {
  const tailOnly = opts.tailOnly ?? false;
  const raw = opts.raw ?? false;
  if (raw && tailOnly) throw new PatternDefinitionError(`${pid}: raw patterns cannot be tail_only`);
  return { pid, family, severity, regex: new Rx(rx, ["m", ...(opts.flags ?? [])]), hint, tailOnly, raw };
}

export type Metric = {
  readonly key: string;
  readonly value: number;
  /** A count is `int`, a ratio or mean is `float`; decides `3` vs `3.0` in the text render. */
  readonly valueKind: "int" | "float";
  readonly threshold: number;
  /** Same rule as `valueKind`, for the printed threshold (`>2` vs `>0.52` vs `>4.0`). */
  readonly thresholdKind: "int" | "float";
  readonly higherIsBad: boolean;
  readonly note: string;
  /** Printed as a notice (`!?`) past its threshold, never scored. */
  readonly advisory: boolean;
  /** `estimated` thresholds are rules of thumb no corpus has been run against; the report marks them `~`. */
  readonly evidence: Evidence;
  /** Metrics measuring one property share a group, and a group scores one point however many of its metrics fire. */
  readonly group: string;
};

export type MetricInit = Omit<Metric, "advisory" | "evidence" | "valueKind" | "thresholdKind" | "group"> &
  Partial<Pick<Metric, "advisory" | "evidence" | "valueKind" | "thresholdKind" | "group">>;

export function metric(init: MetricInit): Metric {
  return {
    advisory: false,
    evidence: "measured",
    valueKind: Number.isInteger(init.value) ? "int" : "float",
    thresholdKind: Number.isInteger(init.threshold) ? "int" : "float",
    group: init.key,
    ...init,
  };
}

export function metricFlagged(m: Metric): boolean {
  if (m.threshold <= 0) return false;
  return m.higherIsBad ? m.value > m.threshold : m.value < m.threshold;
}

export function metricScored(m: Metric): boolean {
  return metricFlagged(m) && !m.advisory;
}

/** METRIC_WEIGHT per metric group with at least one scored metric. */
export function metricPoints(metrics: readonly Metric[]): number {
  return METRIC_WEIGHT * new Set(metrics.filter(metricScored).map((m) => m.group)).size;
}

export type FamilyHit = { readonly family: string };

export type Strings = {
  readonly familyLabels: Readonly<Record<Family, string>>;
  readonly verdicts: Readonly<Record<Band, string>>;
  readonly headerHits: string;
  readonly headerFamilies: string;
  readonly headerMetrics: string;
  readonly thresholdWord: string;
  readonly jev: JevStrings;
};

export type JevStrings = {
  readonly header: string;
  readonly sentences: string;
  readonly gate: string;
  readonly dismissed: string;
  readonly overall: string;
  readonly degraded: string;
  readonly dominant: string;
};

export type LangPack = {
  readonly code: Lang;
  readonly unitChars: number;
  readonly patterns: readonly Pattern[];
  readonly strings: Strings;
  readonly sentences: (text: string) => string[];
  /**
   * `register` is the lint profile name; a pack may score a metric as advisory in a register it does not separate.
   * `hits` are the regex hits the scan kept (after profile mutes and Jev dismissals), for density metrics.
   */
  readonly computeMetrics: (text: string, register?: string | null, hits?: readonly FamilyHit[]) => Metric[];
  /** The score where the fix band starts for a lint profile (`BAND_FIX_AT` unless the pack calibrated that register). */
  readonly fixAt: (register: string | null) => number;
};

const ZERO_WIDTH = re("[\\u200b\\u200c\\u200d\\u2060\\ufeff\\u00ad\\u200e\\u200f\\u202a-\\u202e\\u2066-\\u2069]");
const ODD_SPACE = re("[\\u00a0\\u2000-\\u200a\\u202f\\u205f\\u3000]");

/** NFC-normalise and drop invisible characters before any counting (pasted NFD Hangul triples character counts). */
export function sanitize(text: string): string {
  const nfc = ODD_SPACE.sub(ZERO_WIDTH.sub(text.normalize("NFC"), ""), " ");
  return nfc.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

const FENCE = re("```[\\s\\S]*?```");
const INLINE_CODE = re("`[^`]*`");
const FOOTNOTE_DEF = re("^\\[\\^[^\\]]+\\]:.*$", "m");
const URL = re("https?://\\S+");
const MARKUP = re("[*_>|]+");
const PARA_SPLIT = re("\\n\\s*\\n");

export function stripCode(text: string): string {
  return URL.sub(FOOTNOTE_DEF.sub(INLINE_CODE.sub(FENCE.sub(text, " "), " "), " "), " ");
}

export function stripMarkup(text: string): string {
  return MARKUP.sub(stripCode(text), " ");
}

export function rawLines(text: string): string[] {
  return stripCode(text)
    .split("\n")
    .map(stripSpace)
    .filter((line) => line !== "");
}

export function paragraphs(text: string): string[] {
  const blocks = PARA_SPLIT.split(text)
    .map((p) => stripSpace(p ?? ""))
    .filter((p) => cpLen(p) >= 20);
  if (blocks.length >= 3) return blocks;
  return text
    .split("\n")
    .map(stripSpace)
    .filter((p) => cpLen(p) >= 20);
}

export function tailText(text: string): string {
  const start = Math.trunc(cpLen(text) * (1 - TAIL_RATIO));
  return cpSlice(text, start);
}

export function bandOf(score: number, fixAt: number = BAND_FIX_AT): Band {
  if (score < fixAt) return "pass";
  if (score < BAND_REWRITE_AT) return "fix";
  return "rewrite";
}

/** The family carrying more than DOMINANT_SHARE of the regex score when no metric backs the hits, else null. */
export function dominantFamily(familyWeight: ReadonlyMap<string, number>, metricPoints: number): string | null {
  let total = 0;
  let top: string | null = null;
  let topWeight = Number.NEGATIVE_INFINITY;
  for (const [fam, w] of familyWeight) {
    total += w;
    if (w > topWeight) {
      top = fam;
      topWeight = w;
    }
  }
  if (total <= 0 || metricPoints > 0 || top === null) return null;
  return topWeight / total > DOMINANT_SHARE ? top : null;
}
