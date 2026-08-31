import { readFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";

const OWNER_SELECTORS = [
  "[data-play-input-owner=\"touch-controls\"]",
  "[data-play-input-owner='touch-controls']",
  "[data-play-input-owner=\"host-fullscreen\"]",
  "[data-play-input-owner='host-fullscreen']",
  "[data-play-input-owner=\"game-file-open\"]",
  "[data-play-input-owner='game-file-open']",
];

export async function shippedCssClosure(entryFile) {
  const files = [];
  const visited = new Set();
  const visit = async (file) => {
    const absolute = resolve(file);
    if (visited.has(absolute)) return;
    visited.add(absolute);
    files.push(absolute);
    const source = await readFile(absolute, "utf8");
    for (const match of source.matchAll(/@import\s+["']([^"']+)["']/gu)) {
      let imported = resolve(dirname(absolute), match[1]);
      if (!extname(imported)) imported += ".css";
      await visit(imported);
    }
  };
  await visit(entryFile);
  return files;
}

export function unownedPointerCss(source, file = "<css>") {
  const clean = source.replace(/\/\*[\s\S]*?\*\//gu, "");
  const violations = [];
  inspectBlocks(clean, file, violations);
  return violations;
}

function inspectBlocks(source, file, violations) {
  let cursor = 0;
  while (cursor < source.length) {
    const open = source.indexOf("{", cursor);
    if (open < 0) return;
    const selectorStart = source.lastIndexOf("}", open - 1) + 1;
    const prelude = source.slice(selectorStart, open).trim();
    const close = matchingBrace(source, open);
    if (close < 0) throw new Error(`${file}: unmatched CSS brace`);
    const body = source.slice(open + 1, close);
    if (prelude.startsWith("@")) {
      inspectBlocks(body, file, violations);
    } else {
      const selectors = prelude.split(",").map((selector) => selector.trim()).filter(Boolean);
      const hasInteractivePseudo = selectors.some((selector) => /:(?:hover|active)\b/u.test(selector));
      const hasPointerCursor = /(?:^|[;{}])\s*cursor\s*:\s*pointer\s*(?:!important\s*)?(?:;|$)/u.test(body);
      if ((hasInteractivePseudo || hasPointerCursor) && selectors.some((selector) => !owned(selector))) {
        violations.push(`${file}: ${prelude.replace(/\s+/gu, " ")}`);
      }
      inspectBlocks(body, file, violations);
    }
    cursor = close + 1;
  }
}

function matchingBrace(source, open) {
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function owned(selector) {
  return OWNER_SELECTORS.some((owner) => selector.includes(owner));
}
