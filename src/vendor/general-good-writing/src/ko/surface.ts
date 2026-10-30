import { paragraphs, stripMarkup } from "../core.ts";
import { cpLen, stripSpace } from "../text/chars.ts";
import { roundHalfEven } from "../text/num.ts";
import { re } from "../text/regex.ts";

// A short Hangul span in quotation marks with no speech marker after it: the author's own emphasis on a concept word,
// not a quotation. Numbers, code and Latin are excluded because agent prose quotes identifiers and UI strings literally.
const QUOTED_EMPHASIS = re(String.raw`["“'‘]([가-힣][가-힣 ]{0,10})["”'’](?!\s*(?:이?라고|이?라는|고 (?:말|했|적|묻)|하고|이?라며|라))`);
export const QUOTED_EMPHASIS_PER_1K_MAX = 1.0;
const OBLIGATION_END = re(
  String.raw`(?:해야(?:만)? (?:한다|합니다|할 것이다|해요)|필요(?:하다|합니다)|(?:이|가) 요구(?:된다|됩니다))[.!]?\s*$`,
);
export const OBLIGATION_PARAS_MAX = 1;
const BLOCK_STARTS = ["#", ">", "|", "-", "*", "[[", "```"] as const;

export function quotedEmphasisPer1k(text: string): number {
  const plain = stripMarkup(text);
  if (plain === "") return 0;
  return roundHalfEven((QUOTED_EMPHASIS.findall(plain).length / cpLen(plain)) * 1000, 2);
}

export function obligationEndingParagraphs(text: string): number {
  const body = paragraphs(text).filter((p) => !BLOCK_STARTS.some((start) => stripSpace(p).startsWith(start)));
  return body.filter((p) => OBLIGATION_END.test(p)).length;
}
