import { type LangPack, type Pattern, rawLines, type Severity } from "./core.ts";

export type Hit = {
  readonly pid: string;
  readonly family: string;
  readonly family_label: string;
  readonly severity: Severity;
  readonly sentence: string;
  readonly match: string;
  readonly hint: string;
};

function hitsOf(pattern: Pattern, pack: LangPack, where: string): Hit[] {
  const label = pack.strings.familyLabels[pattern.family];
  return pattern.regex.finditer(where).map((m) => ({
    pid: pattern.pid,
    family: pattern.family,
    family_label: label,
    severity: pattern.severity,
    sentence: where,
    match: m.text,
    hint: pattern.hint,
  }));
}

/** Sentence patterns run per sentence (tail-only ones only inside the tail text); raw patterns run per raw line. */
export function regexHits(text: string, pack: LangPack, allowed: ReadonlySet<Severity>, tail: string): Hit[] {
  const sentencePatterns = pack.patterns.filter((p) => !p.raw && allowed.has(p.severity));
  const rawPatterns = pack.patterns.filter((p) => p.raw && allowed.has(p.severity));
  const hits: Hit[] = [];
  for (const sentence of pack.sentences(text)) {
    const inTail = tail.includes(sentence);
    for (const pattern of sentencePatterns) {
      if (pattern.tailOnly && !inTail) continue;
      hits.push(...hitsOf(pattern, pack, sentence));
    }
  }
  if (rawPatterns.length > 0) {
    for (const line of rawLines(text)) for (const pattern of rawPatterns) hits.push(...hitsOf(pattern, pack, line));
  }
  return hits;
}
