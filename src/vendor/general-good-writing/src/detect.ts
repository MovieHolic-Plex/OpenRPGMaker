import { type Lang, stripMarkup } from "./core.ts";
import { splitWhitespace } from "./text/chars.ts";
import { re } from "./text/regex.ts";

const HANGUL = re("[가-힣]");
const LATIN_TOKEN = re("^[A-Za-z][A-Za-z'’\\-]*[.,;:!?)\"']*$");
const KO_RATIO_MIN = 0.3;
const MIN_TOKENS = 5;

/** A token with any Hangul is Korean (particles glue onto foreign nouns: `tool을`); ko when ko/(ko+latin) >= 0.30 or < 5 tokens count. */
export function detectLang(text: string): Lang {
  let ko = 0;
  let latin = 0;
  for (const token of splitWhitespace(stripMarkup(text))) {
    if (HANGUL.test(token)) ko += 1;
    else if (LATIN_TOKEN.match(token) !== null) latin += 1;
  }
  const counted = ko + latin;
  if (counted < MIN_TOKENS) return "ko";
  return ko / counted >= KO_RATIO_MIN ? "ko" : "en";
}

export function assertNever(x: never): never {
  throw new TypeError(`unexpected variant: ${String(x)}`);
}
