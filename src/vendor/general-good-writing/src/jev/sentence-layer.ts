import { cpLen, cpSlice } from "../text/chars.ts";
import { asString, field, type JsonObject } from "../text/json.ts";
import { roundHalfEven } from "../text/num.ts";
import type { Client } from "./client.ts";
import { answerFor, type Dismissal, evaluateAnswer, type Finding, finding } from "./finding.ts";
import type { Segmented, Sentence } from "./l0.ts";
import {
  APHORISM_DOC_BUDGET,
  CONTEXT_CHARS,
  FIGURATIVE_DOC_BUDGET,
  HEADING_QUESTIONS,
  LEDE_CHARS,
  type Profile,
  type Question,
  SCORECARD_MIN_HEADINGS,
  sentenceQuestions,
  TERM_USE,
} from "./questions.ts";

export type RegexCandidate = readonly [pid: string, family: string, sentence: string, match: string, term: string];

const specsOf = (qs: readonly Question[]): JsonObject => Object.fromEntries(qs.map((q) => [q.id, q.spec]));

/**
 * Each sentence with the prose that precedes it: the opening (first LEDE_CHARS, where first mentions are glossed) plus
 * the last CONTEXT_CHARS, so a term explained in the lede or just before is not read as assumed.
 */
function withContext(sents: readonly Sentence[]): (readonly [Sentence, string])[] {
  const out: (readonly [Sentence, string])[] = [];
  let acc = "";
  for (const s of sents) {
    const head = cpSlice(acc, 0, LEDE_CHARS);
    const ctx = cpLen(acc) <= LEDE_CHARS + CONTEXT_CHARS ? head : `${head} … ${cpSlice(acc, -CONTEXT_CHARS)}`;
    out.push([s, ctx]);
    acc += `${s.text} `;
  }
  return out;
}

/**
 * Headings are not prose, but a heading that rides on an unexplained term, or that grades someone's claim, is the
 * same defect as a sentence that does; only HEADING_QUESTIONS are asked, with the lede as context. Two or more
 * headings graded as verdicts make the document a fact-check scorecard (`verdict_scorecard`, which gates).
 */
async function headingLayer(client: Client, seg: Segmented, asked: readonly Question[]): Promise<Finding[]> {
  const qs = HEADING_QUESTIONS.flatMap((id) => asked.filter((q) => q.id === id));
  if (qs.length === 0) return [];
  const heads = seg.paragraphs.filter((p) => p.region === "heading" && cpLen(p.text) >= 8);
  if (heads.length === 0) return [];
  const lede = cpSlice(
    seg
      .proseParagraphs()
      .slice(0, 2)
      .map((p) => p.text)
      .join(" "),
    0,
    CONTEXT_CHARS,
  );
  const spec = specsOf(qs);
  const answers = await client.askMany(heads.map((h) => [{ sentence: h.text, context: lede }, spec] as const));
  const out: Finding[] = [];
  const graded: string[] = [];
  heads.forEach((h, i) => {
    const ans = answers[i] ?? null;
    if (ans === null) return;
    for (const q of qs) {
      const e = evaluateAnswer(q, answerFor(ans, q.id));
      if (!e.hit) continue;
      out.push(
        finding({
          layer: "L1",
          question: q.id,
          value: roundHalfEven(e.value, 2),
          text: h.text,
          where: `h${h.idx}`,
          detail: e.detail,
          advisory: q.advisory,
          route: e.route,
        }),
      );
      if (q.id === "claim_grading" && e.route === "flag") graded.push(h.text);
    }
  });
  if (graded.length >= SCORECARD_MIN_HEADINGS) {
    const text = graded.map((t) => cpSlice(t, 0, 40)).join(" / ");
    out.push(
      finding({ layer: "L2", question: "verdict_scorecard", value: graded.length, text, where: "doc", detail: { headings: graded } }),
    );
  }
  return out;
}

/**
 * The sentence battery with position gating: a thesis declaration counts only as a paragraph's first sentence, a
 * reader offer only in the last paragraph, a maxim only as a paragraph's last sentence and past APHORISM_DOC_BUDGET,
 * an unannounced image only past FIGURATIVE_DOC_BUDGET. A budget counts firm hits only: a `??` read inside it does not
 * push the firm ones over.
 */
export async function sentenceLayer(client: Client, seg: Segmented, profile: Profile): Promise<Finding[]> {
  const sents = seg.proseSentences();
  const qs = sentenceQuestions(profile, seg.lang);
  if (sents.length === 0 || qs.length === 0) return [];
  const specs = specsOf(qs);
  const answers = await client.askMany(withContext(sents).map(([s, ctx]) => [{ sentence: s.text, context: ctx }, specs] as const));
  const paraLen = new Map(seg.paragraphs.map((p) => [p.idx, p.proseSentences().length]));
  const lastPara = Math.max(...sents.map((s) => s.para));
  const out: Finding[] = [];
  const aphorisms: Finding[] = [];
  const images: Finding[] = [];
  out.push(...(await headingLayer(client, seg, qs)));
  sents.forEach((s, i) => {
    const where = `p${s.para}.s${s.idx}`;
    const ans = answers[i] ?? null;
    if (ans === null) {
      out.push(
        finding({
          layer: "L1",
          question: "_error",
          value: 0,
          text: s.text,
          where,
          detail: { error: "request failed" },
          advisory: true,
          route: "none",
        }),
      );
      return;
    }
    const isFirst = s.idx === 0;
    const isFinal = s.idx === (paraLen.get(s.para) ?? 1) - 1;
    for (const q of qs) {
      const e = evaluateAnswer(q, answerFor(ans, q.id));
      if (!e.hit) continue;
      if (q.id === "thesis_declaration" && !isFirst) continue;
      if (q.id === "reader_offer" && s.para !== lastPara) continue;
      const f = finding({
        layer: "L1",
        question: q.id,
        value: roundHalfEven(e.value, 2),
        text: s.text,
        where,
        detail: e.detail,
        advisory: q.advisory,
        route: e.route,
      });
      if (q.id === "aphorism_landing") {
        if (isFinal) aphorisms.push(f);
      } else if (q.id === "unannounced_figurative") {
        images.push(f);
      } else {
        out.push(f);
      }
    }
  });
  const firm = (fs: readonly Finding[]): number => fs.filter((f) => f.route === "flag").length;
  if (firm(aphorisms) > APHORISM_DOC_BUDGET) out.push(...aphorisms);
  if (firm(images) > FIGURATIVE_DOC_BUDGET) out.push(...images);
  return out;
}

/**
 * The regex hits whose term Jev reads as literal, quoted or idiomatic rather than figurative; a figurative reading,
 * or a spread answer, keeps the regex verdict.
 */
export async function disambiguate(client: Client, hits: readonly RegexCandidate[]): Promise<Dismissal[]> {
  if (hits.length === 0) return [];
  const spec = { u: TERM_USE.spec };
  const answers = await client.askMany(hits.map(([, , sentence, , term]) => [{ sentence, term }, spec] as const));
  const out: Dismissal[] = [];
  hits.forEach(([pid, family, sentence, match], i) => {
    const ans = answers[i] ?? null;
    if (ans === null) return;
    const e = evaluateAnswer(TERM_USE, answerFor(ans, "u"));
    if (e.hit)
      out.push({ pid, family, sentence, match, reason: asString(field(e.detail, "choice")) ?? "", value: roundHalfEven(e.value, 2) });
  });
  return out;
}
