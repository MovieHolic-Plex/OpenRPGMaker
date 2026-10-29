import { cpLen, cpSlice, sortedByCodePoint } from "../text/chars.ts";
import { field, isJsonObject, type JsonObject } from "../text/json.ts";
import { fixed, roundHalfEven } from "../text/num.ts";
import type { Answers, Client } from "./client.ts";
import { answerFor, choiceOf, type Finding, finding, noulAt } from "./finding.ts";
import type { Paragraph, Region, Section, Segmented } from "./l0.ts";
import {
  ANSWERS_BRIEF,
  ARGUMENT_PARAGRAPH,
  COMPOSED_CHARS,
  COMPOSED_EXERCISE,
  ENDING_KIND,
  ENDING_KIND_FLAGS,
  LEDE_CHARS,
  LEDE_SO_WHAT,
  PARAGRAPH_KIND,
  type Question,
  RESTATEMENT_BUDGET,
  RESTATES_CLAIM,
  SECTION_ENUMERATION,
  SKELETON_REPEAT,
  STUB_DOC_MIN_COUNT,
  STUB_DOC_MIN_SHARE,
  STUB_MAX_MEAN_CHARS,
  STUB_MIN_SENTENCES,
} from "./questions.ts";

const NON_FACT_KINDS: ReadonlySet<string> = new Set(["interpretation", "announcement", "transition"]);
const SETUP_KINDS: ReadonlySet<string> = new Set(["announcement", "transition"]);

const choiceAt = (a: Answers | null | undefined, key: string): string =>
  a === null || a === undefined ? "?" : choiceOf(answerFor(a, key));
const scored = (a: Answers | null | undefined, key: string): number | null => (a === null || a === undefined ? null : noulAt(a, key));
const tagged = (p: Paragraph, v: number): string => `p${p.idx}:${fixed(v, 2)}`;

function withInput(q: Question, key: string, value: string): JsonObject {
  const instructions = field(q.spec, "instructions");
  return { ...q.spec, instructions: { ...(isJsonObject(instructions) ? instructions : {}), [key]: value } };
}

/** Overchopped paragraphs: several short sentences that each lean on the previous one, an argument chopped into stubs. */
export async function overchopLayer(client: Client, seg: Segmented): Promise<Finding[]> {
  const prose = seg.proseParagraphs();
  const cands = prose.filter((p) => {
    const s = p.proseSentences().map((x) => x.text);
    return s.length >= STUB_MIN_SENTENCES && s.reduce((n, x) => n + cpLen(x), 0) / s.length <= STUB_MAX_MEAN_CHARS;
  });
  if (cands.length === 0) return [];
  const answers = await client.askMany(cands.map((p) => [{ paragraph: p.text }, { a: ARGUMENT_PARAGRAPH.spec }] as const));
  const stubs = cands.flatMap((p, i) => {
    const v = scored(answers[i], "a");
    return v !== null && v >= ARGUMENT_PARAGRAPH.threshold ? [[p, v] as const] : [];
  });
  const share = stubs.length / Math.max(1, prose.length);
  if (stubs.length < STUB_DOC_MIN_COUNT && share < STUB_DOC_MIN_SHARE) return [];
  const detail = {
    count: stubs.length,
    share: roundHalfEven(share, 3),
    paragraphs: stubs.map(([p, v]) => tagged(p, v)),
    prose_paragraphs: prose.length,
  };
  const text = stubs
    .slice(0, 4)
    .map(([p]) => cpSlice(p.text, 0, 60))
    .join("; ");
  return [finding({ layer: "L2", question: "overchopped_paragraphs", value: stubs.length, text, where: "doc", detail })];
}

async function arcLayer(client: Client, paras: readonly Paragraph[]): Promise<Finding[]> {
  const kinds = await client.askMany(paras.map((p) => [{ paragraph: p.text }, { k: PARAGRAPH_KIND.spec }] as const));
  const seq = paras.map((_, i) => choiceAt(kinds[i], "k"));
  let run = 0;
  let best = 0;
  for (const k of seq) {
    run = NON_FACT_KINDS.has(k) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  const tail = seq
    .slice(-8)
    .map((k) => k.charAt(0))
    .join("");
  const counts = Object.fromEntries(sortedByCodePoint(new Set(seq)).map((k) => [k, seq.filter((x) => x === k).length]));
  const ledeKind = seq[0] ?? "?";
  const detail = { kinds: counts, longest_nonfact_run: best, lede_kind: ledeKind };
  const out = [finding({ layer: "L2", question: "arc_shape", value: best, text: tail, where: "doc", detail, advisory: true })];
  const first = paras[0];
  if (SETUP_KINDS.has(ledeKind) && first !== undefined) {
    out.push(finding({ layer: "L2", question: "lede_is_setup", value: 1, text: cpSlice(first.text, 0, 160), where: "p0" }));
  }
  return out;
}

async function ledeLayer(client: Client, paras: readonly Paragraph[]): Promise<Finding[]> {
  const lede = cpSlice(
    paras
      .slice(0, 3)
      .map((p) => p.text)
      .join(" "),
    0,
    LEDE_CHARS,
  );
  const soWhat = noulAt(await client.ask({ lede }, { q: LEDE_SO_WHAT.spec }), "q");
  if (soWhat >= LEDE_SO_WHAT.threshold) return [];
  return [
    finding({ layer: "L2", question: "lede_no_so_what", value: roundHalfEven(1 - soWhat, 2), text: cpSlice(lede, 0, 160), where: "lede" }),
  ];
}

async function claimLayer(client: Client, paras: readonly Paragraph[], claim: string): Promise<Finding[]> {
  const spec = withInput(RESTATES_CLAIM, "claim", claim);
  const ans = await client.askMany(paras.map((p) => [{ paragraph: p.text }, { r: spec }] as const));
  const hits = paras.flatMap((p, i) => {
    const v = scored(ans[i], "r");
    return v !== null && v >= RESTATES_CLAIM.threshold ? [[p, v] as const] : [];
  });
  if (hits.length <= RESTATEMENT_BUDGET) return [];
  const detail = { paragraphs: hits.map(([p, v]) => tagged(p, v)), budget: RESTATEMENT_BUDGET };
  return [finding({ layer: "L2", question: "claim_restated", value: hits.length, text: claim, where: "doc", detail })];
}

async function briefLayer(client: Client, secs: readonly Section[], brief: string): Promise<Finding[]> {
  const spec = withInput(ANSWERS_BRIEF, "brief", brief);
  const ans = await client.askMany(secs.map((s) => [{ section: cpSlice(s.text, 0, 6000) }, { a: spec }] as const));
  const vals = secs.map((_, i) => scored(ans[i], "a") ?? 0);
  const idx = vals.findIndex((v) => v >= ANSWERS_BRIEF.threshold);
  const first = idx === -1 ? null : idx;
  const silent = secs.filter((_, i) => (vals[i] ?? 0) < ANSWERS_BRIEF.threshold).map((s) => s.title);
  const detail = {
    first_answering_section: first,
    sections: secs.length,
    silent_sections: silent,
    values: vals.map((v) => roundHalfEven(v, 2)),
  };
  return [
    finding({
      layer: "L2",
      question: "brief_resolution",
      value: first ?? secs.length,
      text: brief,
      where: "doc",
      detail,
      advisory: first === 0,
    }),
  ];
}

async function endingLayer(client: Client, secs: readonly Section[], endingFlags: ReadonlySet<string>): Promise<Finding[]> {
  const last = secs.slice(-2);
  const ends = await client.askMany(last.map((s) => [{ section: cpSlice(s.text, -1500) }, { e: ENDING_KIND.spec }] as const));
  const kinds = last.map((_, i) => choiceAt(ends[i], "e"));
  const out: Finding[] = [];
  last.forEach((s, i) => {
    const kind = kinds[i] ?? "?";
    if (endingFlags.has(kind))
      out.push(finding({ layer: "L2", question: "ending_kind", value: 1, text: s.title, where: "tail", detail: { kind } }));
  });
  if (kinds.every((k) => endingFlags.has(k))) {
    const text = last.map((s) => s.title).join(" / ");
    out.push(finding({ layer: "L2", question: "double_ending", value: 1, text, where: "tail", detail: { kinds } }));
  }
  return out;
}

async function sectionShapeLayer(client: Client, secs: readonly Section[]): Promise<Finding[]> {
  const out: Finding[] = [];
  const pairs = secs.slice(1).flatMap((b, i) => {
    const a = secs[i];
    return a === undefined ? [] : [[a, b] as const];
  });
  const skeleton = await client.askMany(
    pairs.map(
      ([a, b]) => [{ section_a: cpSlice(a.text, 0, 4000), section_b: cpSlice(b.text, 0, 4000) }, { s: SKELETON_REPEAT.spec }] as const,
    ),
  );
  pairs.forEach(([a, b], i) => {
    const v = scored(skeleton[i], "s");
    if (v !== null && v >= SKELETON_REPEAT.threshold) {
      out.push(
        finding({
          layer: "L2",
          question: "skeleton_repeat",
          value: roundHalfEven(v, 2),
          text: `${a.title} -> ${b.title}`,
          where: "sections",
        }),
      );
    }
  });
  const marches = await client.askMany(secs.map((s) => [{ section: cpSlice(s.text, 0, 6000) }, { m: SECTION_ENUMERATION.spec }] as const));
  secs.forEach((s, i) => {
    const v = scored(marches[i], "m");
    if (v !== null && v >= SECTION_ENUMERATION.threshold) {
      out.push(finding({ layer: "L2", question: "enumeration_march", value: roundHalfEven(v, 2), text: s.title, where: "section" }));
    }
  });
  return out;
}

const NOT_WRITTEN: ReadonlySet<Region> = new Set<Region>(["code", "table", "figure"]);

/** What `composed_exercise` reads: every block the author wrote (headings, quotes and bullets too, code and tables not), from the start. */
export function composedInput(seg: Segmented): string {
  const blocks = seg.paragraphs.filter((p) => !NOT_WRITTEN.has(p.region)).map((p) => p.text);
  return cpSlice(blocks.join("\n\n"), 0, COMPOSED_CHARS);
}

async function composedLayer(client: Client, seg: Segmented): Promise<Finding[]> {
  const document = composedInput(seg);
  const v = noulAt(await client.ask({ document }, { c: COMPOSED_EXERCISE.spec }), "c");
  if (v < COMPOSED_EXERCISE.threshold) return [];
  return [
    finding({ layer: "L2", question: "composed_exercise", value: roundHalfEven(v, 2), text: cpSlice(document, 0, 160), where: "doc" }),
  ];
}

export type DocumentInputs = { readonly brief: string | null; readonly claim: string | null; readonly endingFlags?: ReadonlySet<string> };

/** The document battery: arc, lede, claim restatement, brief resolution, endings, repeated skeletons and enumeration marches. */
export async function documentLayer(client: Client, seg: Segmented, inputs: DocumentInputs): Promise<Finding[]> {
  const paras = seg.proseParagraphs();
  const secs = seg.sections();
  if (paras.length === 0) return [];
  const out = [...(await arcLayer(client, paras)), ...(await ledeLayer(client, paras))];
  if (COMPOSED_EXERCISE.langs.has(seg.lang)) out.push(...(await composedLayer(client, seg)));
  if (inputs.claim !== null && inputs.claim !== "") out.push(...(await claimLayer(client, paras, inputs.claim)));
  if (inputs.brief !== null && inputs.brief !== "" && secs.length > 0) out.push(...(await briefLayer(client, secs, inputs.brief)));
  if (secs.length >= 2) out.push(...(await endingLayer(client, secs, inputs.endingFlags ?? ENDING_KIND_FLAGS)));
  if (secs.length >= 3) out.push(...(await sectionShapeLayer(client, secs)));
  return out;
}
