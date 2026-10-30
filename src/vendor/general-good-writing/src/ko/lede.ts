import { stripMarkup } from "../core.ts";
import { cpLen, cpSlice, stripSpace } from "../text/chars.ts";
import { roundHalfEven } from "../text/num.ts";
import { re } from "../text/regex.ts";

const LEDE_CHARS = 800;
export const LEDE_SENTENCES_MAX = 3;
const LONG_PIECE_CHARS = 2000;
const BLOCK_STARTS = ["[[", "#", ">", "|", "-", "*"] as const;
const PARA_SPLIT = re(String.raw`\n\s*\n`);
const SENTENCE_BREAK = re(String.raw`(?<=[.!?])\s+`);
const SCENE_STARTS = re("^(어느|지난|오전|오후|그날|그때|이번|먼저|우선|방법|절차|과정|배경|시작은|이 글|여기서)");
const COMPARISON = re("(배|배로|보다|대비|이상|이하|미만|초과|줄었|늘었|올랐|내렸|떨어|넘|낮)");
const RESULT_VERB = re("(입니다|에요|이에요|예요|이죠|했습니다|됩니다|있습니다|없습니다|맞습니다|잃습니다|남깁니다|벌어져)$");
const DIGIT = re(String.raw`\d`);
const CURRENCY = re(String.raw`[\$₩¥€]`);

function ledeSentencePieces(paragraph: string): string[] {
  return SENTENCE_BREAK.split(paragraph)
    .map((s) => stripSpace(s ?? ""))
    .filter((s) => cpLen(s) > 5);
}

/** Sentence count of the first prose paragraph after the title; 0 for pieces shorter than LONG_PIECE_CHARS. */
export function ledeSentences(text: string): number {
  const plain = stripMarkup(text);
  if (cpLen(plain) < LONG_PIECE_CHARS) return 0;
  const paras = PARA_SPLIT.split(plain)
    .map((p) => stripSpace(p ?? ""))
    .filter((p) => p !== "");
  for (const p of paras.slice(1)) {
    if (cpLen(p) < 60 || p.includes("\n") || BLOCK_STARTS.some((start) => p.startsWith(start))) continue;
    return ledeSentencePieces(p).length;
  }
  return 0;
}

/** A fact, conclusion or measured result (digit, currency, percent, comparison, result verb), not a scene opener. */
function isAssertion(sentence: string): boolean {
  const s = stripSpace(sentence);
  if (s === "" || SCENE_STARTS.match(s) !== null) return false;
  return DIGIT.test(s) || CURRENCY.test(s) || s.includes("%") || COMPARISON.test(s) || RESULT_VERB.test(s);
}

/** Share of assertion sentences in the first LEDE_CHARS characters after the title line. */
export function ledeAssertionDensity(text: string): number {
  const plain = stripMarkup(text);
  const firstNewline = plain.indexOf("\n");
  if (firstNewline < 0) return 0;
  const lede = cpSlice(plain.slice(firstNewline + 1), 0, LEDE_CHARS);
  const sents = ledeSentencePieces(lede);
  if (sents.length === 0) return 0;
  return roundHalfEven(sents.filter(isAssertion).length / sents.length, 2);
}
