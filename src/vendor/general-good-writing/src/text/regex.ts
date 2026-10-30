import { CONTROL, type RxFlag, translate } from "./regex-translate.ts";

export { RxError, type RxFlag, translate } from "./regex-translate.ts";

export type RxMatch = {
  readonly text: string;
  readonly start: number;
  readonly end: number;
  readonly groups: readonly (string | undefined)[];
  readonly named: Readonly<Record<string, string | undefined>>;
};

function toMatch(m: RegExpExecArray): RxMatch {
  return { text: m[0], start: m.index, end: m.index + m[0].length, groups: m.slice(1), named: m.groups ?? {} };
}

function expandTemplate(template: string, m: RxMatch): string {
  return template.replace(
    /\\(?:g<([A-Za-z_]\w*|\d+)>|(\d{1,2})|(.))/gs,
    (_all, g: string | undefined, num: string | undefined, other: string | undefined) => {
      if (other !== undefined) return CONTROL[other] !== undefined ? JSON.parse(`"${CONTROL[other]}"`) : `\\${other}`;
      const ref = g ?? num ?? "0";
      if (/^\d+$/.test(ref)) return ref === "0" ? m.text : (m.groups[Number(ref) - 1] ?? "");
      return m.named[ref] ?? "";
    },
  );
}

/** One compiled catalog pattern. Every method takes a fresh copy of the RegExp, so no call leaks `lastIndex` into another. */
export class Rx {
  readonly pattern: string;
  readonly source: string;
  readonly #flags: string;

  constructor(pattern: string, flags: readonly RxFlag[] = []) {
    const t = translate(pattern, flags);
    this.pattern = pattern;
    this.source = t.source;
    this.#flags = t.ignoreCase ? "giu" : "gu";
    this.#re();
  }

  #re(sticky = false): RegExp {
    return new RegExp(this.source, sticky ? `${this.#flags}y` : this.#flags);
  }

  finditer(text: string): RxMatch[] {
    return [...text.matchAll(this.#re())].map(toMatch);
  }

  search(text: string): RxMatch | null {
    const m = this.#re().exec(text);
    return m === null ? null : toMatch(m);
  }

  test(text: string): boolean {
    return this.#re().test(text);
  }

  match(text: string): RxMatch | null {
    const re = this.#re(true);
    re.lastIndex = 0;
    const m = re.exec(text);
    return m === null ? null : toMatch(m);
  }

  fullmatch(text: string): RxMatch | null {
    const full = new RxFull(this.source, this.#flags);
    return full.run(text);
  }

  /** findall: whole matches without groups, the single group with one, a tuple of groups with several. */
  findall(text: string): (string | readonly string[])[] {
    return this.finditer(text).map((m) => {
      if (m.groups.length === 0) return m.text;
      if (m.groups.length === 1) return m.groups[0] ?? "";
      return m.groups.map((g) => g ?? "");
    });
  }

  sub(text: string, repl: string | ((m: RxMatch) => string), count = 0): string {
    let out = "";
    let last = 0;
    let n = 0;
    for (const m of this.finditer(text)) {
      if (count > 0 && n >= count) break;
      out += text.slice(last, m.start) + (typeof repl === "string" ? expandTemplate(repl, m) : repl(m));
      last = m.end;
      n += 1;
    }
    return out + text.slice(last);
  }

  /** split: capture groups are included; a group that did not participate is `undefined`. */
  split(text: string, maxsplit = 0): (string | undefined)[] {
    const out: (string | undefined)[] = [];
    let last = 0;
    let n = 0;
    for (const m of this.finditer(text)) {
      if (maxsplit > 0 && n >= maxsplit) break;
      out.push(text.slice(last, m.start), ...m.groups);
      last = m.end;
      n += 1;
    }
    out.push(text.slice(last));
    return out;
  }
}

class RxFull {
  readonly #re: RegExp;
  constructor(source: string, flags: string) {
    this.#re = new RegExp(`(?:${source})(?![\\s\\S])`, `${flags}y`);
  }
  run(text: string): RxMatch | null {
    this.#re.lastIndex = 0;
    const m = this.#re.exec(text);
    return m === null ? null : toMatch(m);
  }
}

export function re(pattern: string, ...flags: RxFlag[]): Rx {
  return new Rx(pattern, flags);
}
