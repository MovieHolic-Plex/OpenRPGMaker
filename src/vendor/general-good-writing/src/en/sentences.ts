import { stripMarkup } from "../core.ts";
import { stripSpace } from "../text/chars.ts";
import { re } from "../text/regex.ts";

const ABBREVIATIONS = ["e.g.", "i.e.", "vs.", "etc.", "Mr.", "Mrs.", "Ms.", "Dr.", "St.", "No.", "cf.", "approx."] as const;
const ABBREV_MARK = "\u2400";
export const SENT_SPLIT = re(String.raw`(?<=[.!?])\s+|\n+`);
const HEADING_UNIT = re(String.raw`(?m)^\s*#{1,6}\s+(.*)$`);
const LIST_UNIT = re(String.raw`(?m)^\s*(?:[-*•]|\d+[.)])\s+(.*)$`);
const SOFT_WRAP = re(String.raw`(?<![.!?:\n])\n(?!\n)`);
const OWN_UNIT = String.raw`\n\n\1\n\n`;
const WORD = re(String.raw`[A-Za-z0-9]+(?:['’\-][A-Za-z0-9]+)*`);

export function wordCount(text: string): number {
  return WORD.finditer(text).length;
}

function protectAbbreviations(text: string): string {
  return ABBREVIATIONS.reduce((acc, abbr) => acc.replaceAll(abbr, abbr.slice(0, -1) + ABBREV_MARK), text);
}

/**
 * Sentence split for English prose. Hard-wrapped lines are joined (a newline not preceded by sentence-final
 * punctuation is a space); headings and list items always start a new unit; abbreviations do not split.
 */
export function sentences(text: string): string[] {
  const units = LIST_UNIT.sub(HEADING_UNIT.sub(stripMarkup(text), OWN_UNIT), OWN_UNIT);
  const plain = protectAbbreviations(SOFT_WRAP.sub(units, " "));
  return SENT_SPLIT.split(plain)
    .filter((s): s is string => s !== undefined && wordCount(s) >= 2)
    .map((s) => stripSpace(s).replaceAll(ABBREV_MARK, "."));
}
