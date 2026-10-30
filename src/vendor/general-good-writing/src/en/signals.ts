import { counter, cpLen, stripSpace } from "../text/chars.ts";
import { type Rx, re } from "../text/regex.ts";
import { ANALOGY_VEHICLES } from "./patterns.ts";
import { SENT_SPLIT } from "./sentences.ts";

const VEHICLE_RES: readonly Rx[] = ANALOGY_VEHICLES.split("|").map((v) => re(String.raw`\b(?:${v})s?\b`, "i"));
const FIRST_TOKEN = re("[A-Za-z]+(?:['’][A-Za-z]+)?");
const BULLET_LINE = re(String.raw`^\s*(?:[-*•]|\d+[.)])\s+`);
const HEADING_LINE = re(String.raw`^\s*#{1,6}\s+`);
const TABLE_LINE = re(String.raw`\s*\|`);
const PARA_CONNECTIVES = [
  "However",
  "Moreover",
  "Additionally",
  "Furthermore",
  "Overall",
  "Finally",
  "First",
  "Second",
  "Third",
  "Notably",
  "Crucially",
  "Interestingly",
  "In conclusion",
  "In summary",
  "The bottom line",
] as const;
const CONNECTIVE_RES: readonly (readonly [string, Rx])[] = PARA_CONNECTIVES.map((c) => [c, re(`^${c}[ ,]`)] as const);
const PARA_SENTENCE_MIN_CHARS = 5;
const RUN_MIN = 3;

export function firstToken(sentence: string): string | null {
  const m = FIRST_TOKEN.search(sentence);
  return m === null ? null : m.text.toLowerCase();
}

/** Share of sentences that sit inside a run of RUN_MIN+ consecutive sentences opening with the same token. */
export function startRepeatShare(sents: readonly string[]): number {
  if (sents.length === 0) return 0.0;
  const starts = sents.map(firstToken);
  let inRun = 0;
  let i = 0;
  while (i < starts.length) {
    let j = i;
    while (j + 1 < starts.length && starts[j + 1] === starts[i] && starts[i] !== null) j += 1;
    const run = j - i + 1;
    if (run >= RUN_MIN) inRun += run;
    i = j + 1;
  }
  return inRun / sents.length;
}

/** The most frequent paragraph-opening connective and its count; the first one seen wins a tie. */
export function paragraphConnectiveRepeat(paras: readonly string[]): readonly [string, number] {
  const opening = paras.flatMap((p) => {
    const first = stripSpace(p.split("\n")[0] ?? "");
    const hit = CONNECTIVE_RES.find(([, rx]) => rx.match(first) !== null);
    return hit === undefined ? [] : [hit[0]];
  });
  let best: readonly [string, number] = ["", 0];
  for (const [word, n] of counter(opening)) if (n > best[1]) best = [word, n];
  return best;
}

export type MarkupShape = { readonly bullets: number; readonly headings: number; readonly ratio: number };

export function markupShape(text: string): MarkupShape {
  const lines = text.split("\n").filter((line) => stripSpace(line) !== "");
  const bullets = lines.filter((line) => BULLET_LINE.match(line) !== null).length;
  const headings = lines.filter((line) => HEADING_LINE.match(line) !== null).length;
  return { bullets, headings, ratio: lines.length > 0 ? bullets / lines.length : 0.0 };
}

/** The vehicle noun that recurs most and how many times; ["", 0] when no listed vehicle appears. */
export function metaphorCallback(plain: string): readonly [string, number] {
  let best: readonly [string, number] = ["", 0];
  for (const rx of VEHICLE_RES) {
    const found = rx.finditer(plain);
    const head = found[0];
    if (head !== undefined && found.length > best[1]) best = [head.text.toLowerCase(), found.length];
  }
  return best;
}

/** A body paragraph is neither a heading, a list item nor a table row. */
export function isBodyParagraph(p: string): boolean {
  return HEADING_LINE.match(p) === null && BULLET_LINE.match(p) === null && TABLE_LINE.match(p) === null;
}

export function paragraphSentenceCount(p: string): number {
  return SENT_SPLIT.split(p).filter((s) => s !== undefined && cpLen(stripSpace(s)) >= PARA_SENTENCE_MIN_CHARS).length;
}
