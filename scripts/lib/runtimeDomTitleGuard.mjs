// Shipping-runtime guard: native `title` tooltips are a mouse affordance and are
// forbidden by the keyboard-only play contract. CSS static analysis cannot see them
// because they are DOM attribute/property writes in TypeScript.
//
// This is one of TWO enforcement layers for the same contract, because neither can see
// the other's surface:
//   - `scripts/lib/playerInputCss.mjs` parses the shipped CSS import closure and rejects
//     unowned `:hover` / `:active` / `cursor:pointer` rules.
//   - this guard rejects JS-set native `title` attributes in shipping runtime code.
//
// Precision requirement: an ordinary data-model field named `title` (for example the
// `innTextModel` return value, or an authored `ending` command payload) is legitimate.
// Only DOM attribute/property writes are violations. Comments are blanked first so prose
// about tooltips cannot match, and a `title:` key counts only inside a DOM attribute bag.
//
// KNOWN LIMITATION (deliberate): DOM-vs-data is decided by the receiver identifier, not by
// type information. A data-object assignment such as `project.meta.title = "..."` inside the
// scanned scope would therefore be reported as a property write. No such assignment exists in
// `src/player`, and making the guard type-aware would mean running the TypeScript compiler
// inside it, which is disproportionate for this contract. The heuristic fails CLOSED — it
// flags a legitimate write rather than missing a real tooltip — which is the correct
// direction for a contract guard. If a data-object `.title` write ever legitimately belongs
// in `src/player`, rename the field or narrow the scan scope rather than weakening the rule.
import { readFile } from "node:fs/promises";

/** `el(...)` / `document.createElement(...)` attribute bags that carry DOM attributes. */
const DOM_ATTRIBUTE_BAG_KEYS = ["attrs", "dataset"];

export function domTitleViolations(source, file = "<ts>") {
  const clean = stripComments(source);
  const violations = [];

  // 1. Property assignment on a DOM node: `node.title = ...`, `button.title ??= ...`.
  //    A bare `title =` (local variable) or `foo.title === x` comparison is not a write.
  //    `document.title` is the browser tab title, not an element tooltip.
  for (const match of clean.matchAll(/\b([A-Za-z_$][\w$]*)\.title\s*(?:=|\?\?=|\|\|=)(?!=)/gu)) {
    if (match[1] === "document") continue;
    violations.push({ file, kind: "property-write", receiver: match[1], index: match.index ?? 0 });
  }

  // 2. `setAttribute("title", ...)` / `setAttributeNS(..., "title", ...)`.
  for (const match of clean.matchAll(/\.setAttribute(?:NS)?\s*\(\s*(?:[^,()]*,\s*)?["']title["']/gu)) {
    violations.push({ file, kind: "set-attribute", index: match.index ?? 0 });
  }

  // 3. A `title:` key inside a DOM attribute bag (`attrs: { ... }`), which `el()` forwards
  //    verbatim to setAttribute. A `title:` key in any other object literal is a data field.
  for (const key of DOM_ATTRIBUTE_BAG_KEYS) {
    for (const match of clean.matchAll(new RegExp(`\\b${key}\\s*:\\s*\\{`, "gu"))) {
      const open = (match.index ?? 0) + match[0].length - 1;
      const body = balancedBraceBody(clean, open);
      if (body === null) continue;
      const relative = /(?:^|[{,\s])(["']?)title\1\s*:/u.exec(body);
      if (relative) violations.push({ file, kind: "attribute-bag", index: open });
    }
  }

  return violations.map((violation) => ({ ...violation, line: lineOf(clean, violation.index) }));
}

export async function scanRuntimeDomTitles(files) {
  const violations = [];
  for (const file of files) {
    violations.push(...domTitleViolations(await readFile(file, "utf8"), file));
  }
  return violations;
}

const VIOLATION_ADVICE = {
  "property-write": "assigns a native tooltip via a `.title` property write",
  "set-attribute": "sets a native tooltip via setAttribute(\"title\", ...)",
  "attribute-bag": "passes a native `title` attribute through a DOM attribute bag",
};

/**
 * Actionable failure text. A bare list of selectors gets worked around by the next
 * contributor, so name the file/line, the exact form, and where the information belongs.
 */
export function formatDomTitleViolations(violations) {
  if (violations.length === 0) return "";
  const lines = violations.map((violation) => {
    const advice = VIOLATION_ADVICE[violation.kind] ?? "sets a native tooltip";
    const receiver = violation.receiver ? ` (receiver \`${violation.receiver}\`)` : "";
    return `  ${violation.file}:${violation.line} [${violation.kind}] ${advice}${receiver}`;
  });
  return [
    `Native \`title\` tooltips are forbidden in shipping runtime code (${violations.length} found).`,
    "The play surface is keyboard-only: a tooltip is a mouse-only affordance that never",
    "appears for a keyboard player and re-introduces a hover reaction the pointer blocker",
    "cannot suppress. Move the text to `aria-label` (for assistive technology) or to visible",
    "on-screen copy (for every player). Only a documented pointer owner may carry one.",
    ...lines,
  ].join("\n");
}

function balancedBraceBody(source, open) {
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  return null;
}

/** Blanks comments so Korean prose describing tooltips cannot create matches. */
function stripComments(source) {
  let out = "";
  let index = 0;
  const blank = (text) => text.replace(/[^\n]/gu, " ");
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (char === "/" && next === "/") {
      const end = source.indexOf("\n", index);
      const stop = end < 0 ? source.length : end;
      out += blank(source.slice(index, stop));
      index = stop;
      continue;
    }
    if (char === "/" && next === "*") {
      const end = source.indexOf("*/", index + 2);
      const stop = end < 0 ? source.length : end + 2;
      out += blank(source.slice(index, stop));
      index = stop;
      continue;
    }
    out += char;
    index += 1;
  }
  return out;
}

function lineOf(source, index) {
  return source.slice(0, index).split("\n").length;
}
