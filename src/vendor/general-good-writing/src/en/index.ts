import { BAND_FIX_AT, type LangPack } from "../core.ts";
import { PATTERNS } from "./patterns.ts";
import { STRINGS } from "./strings.ts";
import { computeMetrics, sentences } from "./structure.ts";

export const PACK: LangPack = {
  code: "en",
  unitChars: 1700,
  patterns: PATTERNS,
  strings: STRINGS,
  sentences,
  computeMetrics,
  fixAt: () => BAND_FIX_AT,
};
