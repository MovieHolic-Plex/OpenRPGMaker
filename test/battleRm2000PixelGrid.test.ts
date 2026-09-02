// Static invariant audit for the rm2000 battle stylesheet pixel grid.
// Plain fs reads - no DOM, no CSS parsing library. Another node fixes the CSS;
// this test only enumerates the offenders with file:line and the literal.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const SKIN = join(ROOT, "src/styles/runtime/battle-skins/_rm2000.css");
const BATTLE_DIR = join(ROOT, "src/styles/runtime/battle");
const SKINS_DIR = join(ROOT, "src/styles/runtime/battle-skins");

/** Strip /* ... *\/ comments so commented values are ignored. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

/** All numeric px literals (including decimals like 0.5px) with 1-based line numbers. */
function pxLiterals(css: string): Array<{ line: number; value: string }> {
  const out: Array<{ line: number; value: string }> = [];
  const clean = stripComments(css);
  const lines = clean.split("\n");
  lines.forEach((text, i) => {
    const re = /-?\d+(?:\.\d+)?px\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) out.push({ line: i + 1, value: m[0] });
  });
  return out;
}

function fontSizes(css: string): Array<{ line: number; value: string }> {
  const out: Array<{ line: number; value: string }> = [];
  const clean = stripComments(css);
  clean.split("\n").forEach((text, i) => {
    const re = /font-size\s*:\s*(-?\d+(?:\.\d+)?)px\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null)
      out.push({ line: i + 1, value: `${m[1]}px` });
  });
  return out;
}

function listCssFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listCssFiles(p));
    else if (name.endsWith(".css")) out.push(p);
  }
  return out;
}

const RM2000 = readFileSync(SKIN, "utf8");

describe("battle rm2000 pixel grid (static CSS invariants)", () => {
  it("(1) _rm2000.css contains zero !important", () => {
    const hits: string[] = [];
    RM2000.split("\n").forEach((text, i) => {
      if (/!\s*important\b/.test(text)) hits.push(`${SKIN}:${i + 1}: !important`);
    });
    expect(
      hits,
      `${hits.length} !important occurrences in _rm2000.css:\n${hits.join("\n")}`,
    ).toEqual([]);
  });

  it("(2) every px length literal in _rm2000.css is even (0 allowed)", () => {
    const odd = pxLiterals(RM2000).filter(
      ({ value }) => Number.parseFloat(value) % 2 !== 0,
    );
    expect(
      odd,
      `${odd.length} odd px literals in _rm2000.css:\n${odd
        .map((o) => `${SKIN}:${o.line}: ${o.value}`)
        .join("\n")}`,
    ).toEqual([]);
  });

  it("(3) --battle-stage-inset-top is declared exactly once across battle/**/*.css + battle-skins/*.css", () => {
    const decls: string[] = [];
    for (const file of [
      ...listCssFiles(BATTLE_DIR),
      ...listCssFiles(SKINS_DIR),
    ]) {
      const css = readFileSync(file, "utf8");
      css.split("\n").forEach((text, i) => {
        if (/(^|[^\w-])--battle-stage-inset-top\s*:/.test(text))
          decls.push(`${file}:${i + 1}: ${text.trim()}`);
      });
    }
    expect(
      decls,
      `--battle-stage-inset-top declared ${decls.length} times:\n${decls.join("\n")}`,
    ).toHaveLength(1);
  });

  it("(4) distinct font-size px values in _rm2000.css: at most 4 members, all even", () => {
    const sizes = fontSizes(RM2000);
    const byValue = new Map<string, Array<{ line: number; value: string }>>();
    for (const s of sizes) {
      const list = byValue.get(s.value) ?? [];
      list.push(s);
      byValue.set(s.value, list);
    }
    const distinct = [...byValue.keys()];
    const oddSizes = [...byValue.entries()]
      .filter(([v]) => Number.parseFloat(v) % 2 !== 0)
      .map(([, list]) => list)
      .flat();
    expect(
      distinct.length,
      `${distinct.length} distinct font-size px values (max 4): ${distinct.join(", ")}\n` +
        [...byValue.entries()]
          .map(([v, list]) => `${v}: ${list.length}x (first ${SKIN}:${list[0].line})`)
          .join("\n"),
    ).toBeLessThanOrEqual(4);
    expect(
      oddSizes,
      `${oddSizes.length} odd font-size px literals:\n${oddSizes
        .map((o) => `${SKIN}:${o.line}: ${o.value}`)
        .join("\n")}`,
    ).toEqual([]);
  });
});
