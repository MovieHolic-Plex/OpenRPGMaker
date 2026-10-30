/**
 * Lengths, slices and orderings by Unicode code point. JavaScript strings index UTF-16 units, so an emoji or an
 * astral CJK character would count twice; every length, slice and sort that feeds a score, a threshold or a printed
 * snippet goes through these so the calibrated thresholds keep their meaning.
 */

export function cpLen(s: string): number {
  let n = 0;
  for (const _ of s) n += 1;
  return n;
}

export function cpSlice(s: string, start: number, end?: number): string {
  const cps = Array.from(s);
  const norm = (i: number): number => (i < 0 ? Math.max(0, cps.length + i) : Math.min(i, cps.length));
  return cps.slice(norm(start), end === undefined ? cps.length : norm(end)).join("");
}

/** `<` on strings compares UTF-16 units, which misorders astral characters; this compares code points. */
export function compareCodePoints(a: string, b: string): number {
  const ia = a[Symbol.iterator]();
  const ib = b[Symbol.iterator]();
  for (;;) {
    const x = ia.next();
    const y = ib.next();
    if (x.done === true) return y.done === true ? 0 : -1;
    if (y.done === true) return 1;
    const cx = x.value.codePointAt(0) ?? 0;
    const cy = y.value.codePointAt(0) ?? 0;
    if (cx !== cy) return cx < cy ? -1 : 1;
  }
}

export function sortedByCodePoint(xs: Iterable<string>): string[] {
  return [...xs].sort(compareCodePoints);
}

const SPACE_RANGES: readonly (readonly [number, number])[] = [
  [0x09, 0x0d],
  [0x1c, 0x20],
  [0x85, 0x85],
  [0xa0, 0xa0],
  [0x1680, 0x1680],
  [0x2000, 0x200a],
  [0x2028, 0x2029],
  [0x202f, 0x202f],
  [0x205f, 0x205f],
  [0x3000, 0x3000],
];

/** Unicode whitespace as the calibrated rules count it: unlike JavaScript `\s`, U+001C-U+001F are spaces and U+FEFF is not. */
export function isSpace(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? -1;
  return SPACE_RANGES.some(([low, hi]) => cp >= low && cp <= hi);
}

export function splitWhitespace(s: string): string[] {
  const out: string[] = [];
  let token = "";
  for (const ch of s) {
    if (isSpace(ch)) {
      if (token !== "") out.push(token);
      token = "";
    } else token += ch;
  }
  if (token !== "") out.push(token);
  return out;
}

export function stripSpace(s: string): string {
  const cps = Array.from(s);
  let low = 0;
  let hi = cps.length;
  while (low < hi && isSpace(cps[low] ?? "")) low += 1;
  while (hi > low && isSpace(cps[hi - 1] ?? "")) hi -= 1;
  return cps.slice(low, hi).join("");
}

export function counter<K>(items: Iterable<K>): Map<K, number> {
  const out = new Map<K, number>();
  for (const k of items) out.set(k, (out.get(k) ?? 0) + 1);
  return out;
}
