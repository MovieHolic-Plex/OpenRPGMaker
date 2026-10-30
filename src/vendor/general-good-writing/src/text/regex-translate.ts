/**
 * The regex dialect every pattern catalog was measured in, on top of JavaScript RegExp. The catalogs depend on rules
 * JavaScript does not follow by default: `\w`, `\b` and `\d` are Unicode-aware (a Hangul syllable is a word
 * character), while JavaScript keeps them ASCII-only even with the `u` flag; `.`, `^` and ` treat only `\n` as a
 * line break; `(?P<name>...)`, `(?P=name)` and `{,n}` are accepted spellings; identity escapes such as `\"` and a lone
 * `{` are literals, which the `u` flag needed for `\p{...}` rejects. `translate` rewrites a catalog pattern into an
 * equivalent `u`-flag source; `Rx` offers search, match, findall, sub and split with the catalog semantics.
 */

export type RxFlag = "i" | "m" | "s" | "x";

export class RxError extends Error {
  override readonly name = "RxError";
  readonly pattern: string;
  constructor(pattern: string, detail: string) {
    super(`cannot translate pattern ${JSON.stringify(pattern)}: ${detail}`);
    this.pattern = pattern;
  }
}

const WORD = String.raw`\p{L}\p{N}_`;
const SPACE = String.raw`\t-\r\x1c-\x20\x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000`;
const DIGIT = String.raw`\p{Nd}`;
const CLASS_ESCAPES: Readonly<Record<string, string>> = { w: WORD, s: SPACE, d: DIGIT };
const NEGATED: Readonly<Record<string, string>> = { W: WORD, S: SPACE, D: DIGIT };
const SYNTAX = new Set(["^", "$", "\\", ".", "*", "+", "?", "(", ")", "[", "]", "{", "}", "|", "/"]);
export const CONTROL: Readonly<Record<string, string>> = { n: "\\n", t: "\\t", r: "\\r", f: "\\f", v: "\\v", a: "\\x07", "0": "\\0" };
const QUANT = /^\{(\d*)(?:(,)(\d*))?\}/;

type Flags = { readonly i: boolean; readonly m: boolean; readonly s: boolean; readonly x: boolean };

function readInlineFlags(src: string, flags: Flags): { readonly rest: string; readonly flags: Flags } {
  const m = /^\(\?([aiLmsux]+)\)/.exec(src);
  if (m === null) return { rest: src, flags };
  const set = m[1] ?? "";
  if (/[aLu]/.test(set)) throw new RxError(src, `unsupported inline flag in (?${set})`);
  return readInlineFlags(src.slice(m[0].length), {
    i: flags.i || set.includes("i"),
    m: flags.m || set.includes("m"),
    s: flags.s || set.includes("s"),
    x: flags.x || set.includes("x"),
  });
}

function escapeOutside(ch: string): string {
  return SYNTAX.has(ch) ? `\\${ch}` : ch === "-" ? "-" : /[A-Za-z0-9]/.test(ch) ? `\\${ch}` : ch;
}

function translateClass(src: string, start: number): { readonly out: string; readonly end: number } {
  let i = start + 1;
  let body = "";
  const negatedSets: string[] = [];
  const negate = src[i] === "^";
  if (negate) i += 1;
  if (src[i] === "]") {
    body += "\\]";
    i += 1;
  }
  while (i < src.length && src[i] !== "]") {
    const ch = src[i] ?? "";
    if (ch === "\\") {
      const next = src[i + 1] ?? "";
      const expanded = CLASS_ESCAPES[next];
      const negated = NEGATED[next];
      if (expanded !== undefined) body += expanded;
      else if (negated !== undefined) negatedSets.push(negated);
      else if (CONTROL[next] !== undefined) body += CONTROL[next];
      else if (next === "U") {
        body += codePointEscape(src, i + 2);
        i += 10;
        continue;
      } else if (/[A-Za-z0-9]/.test(next)) body += `\\${next}`;
      else if (next === "-" || next === "]" || next === "[" || next === "\\" || next === "^") body += `\\${next}`;
      else body += next;
      i += 2;
      continue;
    }
    if (ch === "[") body += "\\[";
    else body += ch;
    i += 1;
  }
  if (i >= src.length) throw new RxError(src, "unterminated character class");
  return { out: classFragment(body, negatedSets, negate), end: i + 1 };
}

/**
 * A class may name a complement (`[\s\S]`, `[\w\D]`), which a `u`-flag class cannot nest. The class becomes the union
 * of its positive members and each complement; a negated class becomes "none of those", spelled as a lookahead.
 */
function classFragment(body: string, negatedSets: readonly string[], negate: boolean): string {
  if (negatedSets.length === 0) return negate ? `[^${body}]` : `[${body}]`;
  const parts = [...(body === "" ? [] : [`[${body}]`]), ...negatedSets.map((set) => `[^${set}]`)];
  const union = `(?:${parts.join("|")})`;
  return negate ? `(?:(?!${union})[\\s\\S])` : union;
}

function codePointEscape(src: string, at: number): string {
  const hex = src.slice(at, at + 8);
  if (!/^[0-9A-Fa-f]{8}$/.test(hex)) throw new RxError(src, "\\U needs eight hex digits");
  return `\\u{${hex.replace(/^0+(?=.)/, "")}}`;
}

function stripVerbose(src: string): string {
  let out = "";
  let inClass = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i] ?? "";
    if (ch === "\\") {
      out += ch + (src[i + 1] ?? "");
      i += 1;
      continue;
    }
    if (inClass) {
      if (ch === "]") inClass = false;
      out += ch;
      continue;
    }
    if (ch === "[") {
      inClass = true;
      out += ch;
      continue;
    }
    if (/\s/.test(ch)) continue;
    if (ch === "#") {
      while (i < src.length && src[i] !== "\n") i += 1;
      continue;
    }
    out += ch;
  }
  return out;
}

function translateBody(src: string, flags: Flags): string {
  const lineStart = flags.m ? "(?<![^\\n])" : "(?<![\\s\\S])";
  const lineEnd = flags.m ? "(?![^\\n])" : "(?=\\n?(?![\\s\\S]))";
  const wordBoundary = `(?:(?<=[${WORD}])(?![${WORD}])|(?<![${WORD}])(?=[${WORD}]))`;
  const nonBoundary = `(?:(?<=[${WORD}])(?=[${WORD}])|(?<![${WORD}])(?![${WORD}]))`;
  let out = "";
  let i = 0;
  while (i < src.length) {
    const ch = src[i] ?? "";
    if (ch === "\\") {
      const next = src[i + 1];
      if (next === undefined) throw new RxError(src, "trailing backslash");
      i += 2;
      const cls = CLASS_ESCAPES[next];
      const neg = NEGATED[next];
      if (cls !== undefined) out += `[${cls}]`;
      else if (neg !== undefined) out += `[^${neg}]`;
      else if (next === "b") out += wordBoundary;
      else if (next === "B") out += nonBoundary;
      else if (next === "A") out += "(?<![\\s\\S])";
      else if (next === "Z") out += "(?![\\s\\S])";
      else if (CONTROL[next] !== undefined) out += CONTROL[next];
      else if (next === "u" || next === "x") {
        const len = next === "u" ? 4 : 2;
        out += `\\${next}${src.slice(i, i + len)}`;
        i += len;
      } else if (next === "U") {
        out += codePointEscape(src, i);
        i += 8;
      } else if (/[1-9]/.test(next)) out += `\\${next}`;
      else if (/[A-Za-z]/.test(next)) throw new RxError(src, `unsupported escape \\${next}`);
      else out += escapeOutside(next);
      continue;
    }
    if (ch === "[") {
      const { out: cls, end } = translateClass(src, i);
      out += cls;
      i = end;
      continue;
    }
    if (ch === "(" && src.startsWith("(?P<", i)) {
      out += "(?<";
      i += 4;
      continue;
    }
    if (ch === "(" && src.startsWith("(?P=", i)) {
      const close = src.indexOf(")", i);
      out += `\\k<${src.slice(i + 4, close)}>`;
      i = close + 1;
      continue;
    }
    if (ch === "(" && /^\(\?[aiLmsux]+\)/.test(src.slice(i))) throw new RxError(src, "inline flags are only supported at the start");
    if (ch === "{") {
      const q = QUANT.exec(src.slice(i));
      if (q !== null && (q[1] !== "" || q[3] !== undefined)) {
        out += `{${q[1] === "" ? "0" : q[1]}${q[2] ?? ""}${q[3] ?? ""}}`;
        i += q[0].length;
        continue;
      }
      out += "\\{";
      i += 1;
      continue;
    }
    if (ch === "}") out += "\\}";
    else if (ch === ".") out += flags.s ? "[\\s\\S]" : "[^\\n]";
    else if (ch === "^") out += lineStart;
    else if (ch === "$") out += lineEnd;
    else out += ch;
    i += 1;
  }
  return out;
}

export function translate(pattern: string, flags: readonly RxFlag[] = []): { readonly source: string; readonly ignoreCase: boolean } {
  const base: Flags = { i: flags.includes("i"), m: flags.includes("m"), s: flags.includes("s"), x: flags.includes("x") };
  const { rest, flags: f } = readInlineFlags(pattern, base);
  const body = f.x ? stripVerbose(rest) : rest;
  return { source: translateBody(body, f), ignoreCase: f.i };
}
