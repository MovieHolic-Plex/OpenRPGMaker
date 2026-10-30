import type { Band, Family, Strings } from "../core.ts";

const FAMILY_LABELS: Readonly<Record<Family, string>> = {
  "neg-redefine": "negated redefinition",
  "authority-noun": "authority noun",
  "metaphor-noun": "metaphor noun",
  personify: "personification",
  "enum-announce": "enumeration announce",
  "meta-guide": "meta guidance",
  takeaway: "takeaway",
  "closing-offer": "closing offer",
  "hedge-tail": "hedge",
  translationese: "translationese",
  "stock-phrase": "stock phrase",
  "banned-word": "AI vocabulary",
  "model-tic": "model tic",
  typography: "typography",
  "aphorism-landing": "aphorism-landing",
  "forced-analogy": "forced analogy",
};

const VERDICTS: Readonly<Record<Band, string>> = {
  pass: "pass: sentence-level touch-ups only",
  fix: "fix: rewrite the flagged sentences and adjust rhythm",
  rewrite: "rewrite: start from the structure",
};

export type MetricKey =
  | "sentence_mean_words"
  | "sentence_length_cv"
  | "sentence_start_repeat_share"
  | "para_connective_repeat"
  | "neg_redefine_per_1k_words"
  | "emdash_per_1k_words"
  | "triad_per_1k_words"
  | "bullet_line_ratio"
  | "colon_label_per_1k_words"
  | "curly_apostrophe_per_1k_words"
  | "oneliner_para_ratio"
  | "question_ratio"
  | "para_multi_sentence_share"
  | "metaphor_callback_max"
  | "contraction_per_1k_words";

/** Note templates; `{name}` placeholders are filled by `fillNote`. */
export const METRIC_NOTES: Readonly<Record<MetricKey, string>> = {
  sentence_mean_words: "mean words per sentence (calibration: references/en/evidence/calibration.json)",
  sentence_length_cv: "sentence-length variation; low = uniform, machine-like rhythm",
  sentence_start_repeat_share: "share of sentences in a run of 3+ opening with the same word",
  para_connective_repeat: "paragraph-initial connective repeated '{conn_word}'",
  neg_redefine_per_1k_words: "'not just X' / 'it's not X, it's Y' per 1K words; human-heavier in English (PG > AI), informational only",
  emdash_per_1k_words: "em dashes per 1K words",
  triad_per_1k_words: "'X, Y, and Z' triads per 1K words",
  bullet_line_ratio: "bullets {bullets} lines, headings {headings}",
  colon_label_per_1k_words: "'Label: text' lines per 1K words",
  curly_apostrophe_per_1k_words: "curly apostrophes per 1K words; informational (GPT signature, but smart-quote editors produce them too)",
  oneliner_para_ratio: "one-line paragraphs (<= 12 words); informational",
  question_ratio: "questions per sentence; informational (voice)",
  para_multi_sentence_share:
    "paragraphs with 3+ sentences {multi}/{total}: web posts run 1-2 sentences per paragraph; split when over",
  metaphor_callback_max:
    "same metaphor vehicle ('{word}') repeated; notice only, never scores (PG repeats a literal ladder or engine): one introduction and one callback",
  contraction_per_1k_words: "contractions per 1K words; informational (voice)",
};

export function fillNote(template: string, values: Readonly<Record<string, string | number>>): string {
  let out = template;
  for (const [name, value] of Object.entries(values)) out = out.replaceAll(`{${name}}`, String(value));
  return out;
}

export const STRINGS: Strings = {
  familyLabels: FAMILY_LABELS,
  verdicts: VERDICTS,
  headerHits: "## Sentence-level hits",
  headerFamilies: "## Hits per family",
  headerMetrics: "## Structure / rhythm metrics",
  thresholdWord: "threshold",
  jev: {
    header: "## Jev judgments",
    sentences: "sentences",
    gate: "gate",
    dismissed: "regex hits dismissed",
    overall: "overall",
    degraded: "local rules only, Jev scoring failed",
    dominant: "one family carries over 60% of the score (may be a personal habit; rewrite capped at fix)",
  },
};
