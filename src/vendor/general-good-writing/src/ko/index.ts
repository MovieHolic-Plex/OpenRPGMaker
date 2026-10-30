import type { LangPack } from "../core.ts";
import { PATTERNS } from "./patterns.ts";
import { fixAt } from "./register.ts";
import { STRINGS } from "./strings.ts";
import { computeMetrics, sentences } from "./structure.ts";

export const PACK: LangPack = { code: "ko", unitChars: 1000, patterns: PATTERNS, strings: STRINGS, sentences, computeMetrics, fixAt };
