/**
 * Segmentation and region tagging. Only `prose` sentences reach Jev; quotes, code, headings, bullets, dialogue, tables
 * and figure captions are tagged here so the judgment layer never scores text the author did not write as prose.
 */
import type { Lang } from "../core.ts";
import { detectLang } from "../detect.ts";
import { cpLen, stripSpace } from "../text/chars.ts";
import { re } from "../text/regex.ts";

export type Region = "prose" | "quote" | "code" | "heading" | "bullet" | "dialogue" | "table" | "figure";

const SENT_KO = re(String.raw`(?<=[.!?…。])\s+`);
const SENT_EN = re(String.raw`(?<=[.!?])\s+(?=[A-Z"“(])`);
/**
 * A quoted span is dialogue (someone else's words, never judged as the author's prose) when it stands alone on the
 * line or is followed by a speech marker (엄마가 물었다, 라고 했다, he said). A quote followed by the author's own
 * predicate ("어색한 문장"이 문제다, "규칙"은 하나다) is the author's emphasis and stays prose (im-not-ai v2.6.2 Do-NOT
 * split).
 */
const SPEECH_MARKER =
  "(?:이?라고|이?라며|이?라는|하고|말|했|물|답|외치|덧붙|웃|중얼|속삭|소리|묻|되뇌|적었|썼|전했|하더|하며|하자|하니|said|asked|replied|whispered|shouted|told|wrote)";
const DIALOGUE = re(
  String.raw`^\s*["“「'].{2,}?["”」']\s*(?:[가-힣A-Za-z ]{0,30}?` + SPEECH_MARKER + String.raw`[가-힣A-Za-z ,]{0,24})?[.!?]?\s*$`,
);
const HEADING_LINE = re(String.raw`^\s*(#{1,6}\s|\d{1,2}(\.\d+)*[.)]?\s+\S)`);
const HEADING_SHORT = re(String.raw`^[^.!?\n]{1,60}\??$`);
const BULLET = re(String.raw`^\s*([-*•·]|\d+[.)])\s+`);
const FIGURE = re(String.raw`^\s*(삽화|그림|사진|표|figure|fig\.|image|table)\s*\d*\s*[·:.]`, "i");
const CITATION = re(String.raw`\[(?:출처|S|ref|\d+)[^\]]*\]`);
const HANGUL_ENDING = re("(다|요|죠|까|네|어|아)[.!?]?$");
const LEADING_SPACE = re(String.raw`^\s+`);
const INLINE_CODE = re("`[^`]*`");
const IMAGE = re(String.raw`!\[[^\]]*\]\([^)]*\)`);
const LINK = re(String.raw`\[([^\]]+)\]\([^)]*\)`);
const URL = re(String.raw`https?://\S+`);
const EMPHASIS = re(String.raw`\*\*|__|(?<!\w)\*|\*(?!\w)|(?<!\w)_|_(?!\w)`);
const SPACE_RUN = re(String.raw`\s+`);
const BLOCK_MARKER = re(String.raw`^\s*(?:>|[-*•·]|\d+[.)])\s?`, "m");
const BLOCK_SPLIT = re(String.raw`\n\s*\n`);
const FENCE = "```";

export type Sentence = { readonly text: string; readonly para: number; readonly idx: number; readonly region: Region };

export class Paragraph {
  readonly text: string;
  readonly idx: number;
  readonly region: Region;
  readonly sentences: readonly Sentence[];

  constructor(text: string, idx: number, region: Region, sentences: readonly Sentence[] = []) {
    this.text = text;
    this.idx = idx;
    this.region = region;
    this.sentences = sentences;
  }

  proseSentences(): Sentence[] {
    return this.sentences.filter((s) => s.region === "prose");
  }
}

export type Section = { readonly title: string; readonly text: string; readonly paragraphs: readonly Paragraph[] };

export class Segmented {
  readonly lang: Lang;
  readonly paragraphs: readonly Paragraph[];

  constructor(lang: Lang, paragraphs: readonly Paragraph[]) {
    this.lang = lang;
    this.paragraphs = paragraphs;
  }

  proseSentences(): Sentence[] {
    return this.paragraphs.flatMap((p) => p.proseSentences());
  }

  proseParagraphs(): Paragraph[] {
    return this.paragraphs.filter((p) => p.region === "prose" && p.proseSentences().length > 0);
  }

  /** Sections split on headings; the text before the first heading is the `(lede)` section. Code, tables and figures are left out. */
  sections(): Section[] {
    const out: Section[] = [];
    let title = "(lede)";
    let buf: Paragraph[] = [];
    const flush = (): void => {
      if (buf.length > 0) out.push({ title, text: buf.map((x) => x.text).join("\n\n"), paragraphs: buf });
    };
    for (const p of this.paragraphs) {
      if (p.region === "heading") {
        flush();
        title = p.text;
        buf = [];
      } else if (p.region === "prose" || p.region === "quote" || p.region === "bullet") {
        buf.push(p);
      }
    }
    flush();
    return out;
  }
}

function stripTrailingQuestionMarks(s: string): string {
  let end = s.length;
  while (end > 0 && s[end - 1] === "?") end -= 1;
  return s.slice(0, end);
}

function looksLikeHeading(block: string): boolean {
  const stripped = stripSpace(block);
  if (stripped.includes("\n") || cpLen(stripped) > 80) return false;
  if (HEADING_LINE.match(stripped) !== null) return true;
  if (HEADING_SHORT.match(stripped) === null) return false;
  return HANGUL_ENDING.search(stripTrailingQuestionMarks(stripped)) === null;
}

function paraRegion(block: string): Region {
  const first = LEADING_SPACE.sub(block, "");
  if (first.startsWith(FENCE) || block.startsWith("    ") || block.startsWith("\t")) return "code";
  if (first.startsWith(">")) return "quote";
  if (first.startsWith("|")) return "table";
  if (FIGURE.match(first) !== null || (first.startsWith("[[") && stripSpace(block).endsWith("]]"))) return "figure";
  if (BULLET.match(first) !== null) return "bullet";
  if (looksLikeHeading(block)) return "heading";
  return "prose";
}

function stripInline(text: string): string {
  const noCode = INLINE_CODE.sub(text, " ");
  const noImage = IMAGE.sub(noCode, " ");
  const linkText = LINK.sub(noImage, String.raw`\1`);
  const noCitation = CITATION.sub(linkText, "");
  const noUrl = URL.sub(noCitation, " ");
  return stripSpace(SPACE_RUN.sub(EMPHASIS.sub(noUrl, ""), " "));
}

function cleanBlock(block: string, region: Region): string {
  if (region === "prose") return stripInline(block);
  if (region === "quote" || region === "bullet") return stripInline(BLOCK_MARKER.sub(block, ""));
  return stripSpace(block);
}

export function splitSentences(text: string, lang: Lang): string[] {
  const pat = lang === "ko" ? SENT_KO : SENT_EN;
  const minLen = lang === "ko" ? 5 : 12;
  return pat
    .split(text)
    .filter((p): p is string => p !== undefined && p !== "" && cpLen(stripSpace(p)) >= minLen)
    .map(stripSpace);
}

function sentenceRegion(sent: string, paraRegion: Region): Region {
  if (paraRegion !== "prose") return paraRegion;
  return DIALOGUE.match(sent) !== null ? "dialogue" : "prose";
}

export function segment(text: string, lang?: Lang): Segmented {
  const resolved = lang ?? detectLang(text);
  const blocks = BLOCK_SPLIT.split(text).filter((b): b is string => b !== undefined && stripSpace(b) !== "");
  const paragraphs: Paragraph[] = [];
  let inFence = false;
  blocks.forEach((block, i) => {
    const fences = block.split(FENCE).length - 1;
    if (fences > 0 || inFence) {
      paragraphs.push(new Paragraph(stripSpace(block), i, "code"));
      if (fences % 2 === 1) inFence = !inFence;
      return;
    }
    const region = paraRegion(block);
    const clean = cleanBlock(block, region);
    const judged = region === "prose" || region === "quote" || region === "bullet";
    const sentences = judged
      ? splitSentences(clean, resolved).map((s, j) => ({ text: s, para: i, idx: j, region: sentenceRegion(s, region) }))
      : [];
    paragraphs.push(new Paragraph(clean, i, region, sentences));
  });
  return new Segmented(resolved, paragraphs);
}
