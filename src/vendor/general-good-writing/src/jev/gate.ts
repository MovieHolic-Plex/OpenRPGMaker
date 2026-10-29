/**
 * The Jev judgment layer: the sentence battery with position gating, regex-hit disambiguation, the document battery
 * (arc, restatement, brief resolution, endings, skeleton, enumeration, overchopped paragraphs), and the gate.
 */
import type { JsonObject } from "../text/json.ts";
import { percent } from "../text/num.ts";
import type { Client, UsageDict } from "./client.ts";
import { documentLayer, overchopLayer } from "./document-layer.ts";
import type { Dismissal, Finding } from "./finding.ts";
import type { Segmented } from "./l0.ts";
import { FAMILY_SHARE_CAP, GATE_MIN_QUESTIONS, GATE_UNCOUNTED, type Profile, SENTENCE_HIT_SHARE_MAX } from "./questions.ts";
import { disambiguate, type RegexCandidate, sentenceLayer } from "./sentence-layer.ts";

export { documentLayer, overchopLayer } from "./document-layer.ts";
export type { Dismissal, Evaluation, Finding } from "./finding.ts";
export { evaluateAnswer, MalformedAnswerError } from "./finding.ts";
export type { RegexCandidate } from "./sentence-layer.ts";
export { disambiguate, sentenceLayer } from "./sentence-layer.ts";

export type Gate = "pass" | "fix";

export type JevResult = {
  readonly profile: string;
  readonly sentences: number;
  readonly paragraphs: number;
  readonly findings: readonly Finding[];
  readonly dismissed: readonly Dismissal[];
  readonly gate: Gate;
  readonly gateReasons: readonly string[];
  readonly usage: UsageDict;
};

export function jevResultJson(r: JevResult): JsonObject {
  return {
    profile: r.profile,
    sentences: r.sentences,
    paragraphs: r.paragraphs,
    gate: r.gate,
    gate_reasons: r.gateReasons,
    findings: r.findings.map((f) => ({
      layer: f.layer,
      question: f.question,
      value: f.value,
      text: f.text,
      where: f.where,
      detail: f.detail,
      advisory: f.advisory,
      route: f.route,
    })),
    dismissed: r.dismissed.map((d) => ({
      pid: d.pid,
      family: d.family,
      sentence: d.sentence,
      match: d.match,
      reason: d.reason,
      value: d.value,
    })),
    usage: r.usage,
  };
}

export const DOC_BLOCKERS: ReadonlySet<string> = new Set([
  "claim_restated",
  "overchopped_paragraphs",
  "double_ending",
  "verdict_scorecard",
  "composed_exercise",
]);

function firmPerQuestion(findings: readonly Finding[]): Map<string, number> {
  const perQuestion = new Map<string, number>();
  for (const f of findings) {
    const counted = !GATE_UNCOUNTED.has(f.question);
    if (f.layer === "L1" && !f.advisory && f.route === "flag" && counted)
      perQuestion.set(f.question, (perQuestion.get(f.question) ?? 0) + 1);
  }
  return perQuestion;
}

/** Firm sentence hits the gate counts (GATE_UNCOUNTED questions left out): each question's flags capped at FAMILY_SHARE_CAP of the prose sentences. */
export function firmSentenceHits(findings: readonly Finding[], sentenceCount: number): number {
  const cap = Math.max(1, Math.trunc(sentenceCount * FAMILY_SHARE_CAP));
  return [...firmPerQuestion(findings).values()].reduce((n, c) => n + Math.min(c, cap), 0);
}

/** The sentence share the gate trips on: counted firm hits over SENTENCE_HIT_SHARE_MAX, from GATE_MIN_QUESTIONS or more questions. */
export function sentenceHitsTrip(findings: readonly Finding[], sentenceCount: number): boolean {
  if (sentenceCount === 0 || firmPerQuestion(findings).size < GATE_MIN_QUESTIONS) return false;
  return firmSentenceHits(findings, sentenceCount) / sentenceCount > SENTENCE_HIT_SHARE_MAX;
}

/**
 * `fix` when firm sentence hits exceed SENTENCE_HIT_SHARE_MAX of the prose sentences (each question capped at
 * FAMILY_SHARE_CAP of them, and from at least GATE_MIN_QUESTIONS questions, so one question alone cannot trip it), when a document blocker fires, or when the brief
 * is answered only after the first section.
 */
export function gateOf(findings: readonly Finding[], sentenceCount: number): readonly [Gate, readonly string[]] {
  const reasons: string[] = [];
  if (sentenceHitsTrip(findings, sentenceCount)) {
    const counted = firmSentenceHits(findings, sentenceCount);
    reasons.push(`sentence hits ${counted}/${sentenceCount} over ${percent(SENTENCE_HIT_SHARE_MAX, 0)}`);
  }
  for (const f of findings) {
    if (f.layer === "L2" && !f.advisory && DOC_BLOCKERS.has(f.question)) reasons.push(f.question);
    if (f.question === "brief_resolution" && !f.advisory) reasons.push(`brief first answered in section ${Math.trunc(f.value)}`);
  }
  return [reasons.length > 0 ? "fix" : "pass", reasons];
}

export type RunOptions = { readonly regexHits: readonly RegexCandidate[]; readonly brief: string | null; readonly claim: string | null };

/** An authority noun read as literal is still kept while hollow_authority fires on the same sentence. */
export async function run(client: Client, seg: Segmented, profile: Profile, opts: RunOptions): Promise<JevResult> {
  const findings = await sentenceLayer(client, seg, profile);
  const hollow = new Set(findings.filter((f) => f.question === "hollow_authority").map((f) => f.text));
  const dismissed = (await disambiguate(client, opts.regexHits)).filter((d) => !(d.family === "authority-noun" && hollow.has(d.sentence)));
  findings.push(...(await overchopLayer(client, seg)));
  if (profile.docBattery)
    findings.push(...(await documentLayer(client, seg, { brief: opts.brief, claim: opts.claim, endingFlags: profile.endingFlags })));
  const sentences = seg.proseSentences().length;
  const [gate, gateReasons] = gateOf(findings, sentences);
  return {
    profile: profile.name,
    sentences,
    paragraphs: seg.proseParagraphs().length,
    findings,
    dismissed,
    gate,
    gateReasons,
    usage: client.usage.asDict(),
  };
}
