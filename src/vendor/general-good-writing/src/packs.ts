import type { Lang, LangPack } from "./core.ts";
import { assertNever } from "./detect.ts";
import { PACK as EN_PACK } from "./en/index.ts";
import { PACK as KO_PACK } from "./ko/index.ts";

export function getPack(lang: Lang): LangPack {
  switch (lang) {
    case "ko":
      return KO_PACK;
    case "en":
      return EN_PACK;
    default:
      return assertNever(lang);
  }
}
