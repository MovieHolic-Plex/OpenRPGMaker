#!/usr/bin/env node
// Core small-task code may not import a numbered unit or name its id.
// Units plug in through primitives/index.ts (`host`, primitive methods).
//
// Usage: node scripts/check-small-task-layering.mjs   (exit 1 when anything is found)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const UNIT_IMPORT = /(?:^|\/)units(?:\/|$)/;
const UNIT_ID_BODY = /^(?:0[1-9]|[12]\d|30)-[a-z0-9-]+$/;
const SKIP_ID_FILES = new Set(["src/editor/smallTask/primitives/ownership.ts"]);
const EXPR_KW = new Set(["return", "throw", "case", "else", "do", "await", "yield", "void", "typeof", "delete", "new", "in", "of", "instanceof", "extends"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (path.endsWith(join("primitives", "units"))) continue;
      walk(path, out);
    } else if (name.endsWith(".ts") || name.endsWith(".tsx") || name.endsWith(".mts")) out.push(path);
  }
  return out;
}

function isIdentChar(char) {
  return /[A-Za-z0-9_$]/.test(char) || char > "\u007f";
}

/** @param {string} source @param {string} rel @returns {string[]} */
export function problemsInSource(source, rel) {
  const problems = [];
  const skipIds = SKIP_ID_FILES.has(rel.replaceAll("\\", "/"));
  let i = 0;
  let line = 1;
  let exprAllowed = true;
  /** @type {{ kind: "tmpl" | "code"; braces?: number }[]} */
  const stack = [];

  const noteUnit = (value, at) => {
    if (!skipIds && UNIT_ID_BODY.test(value)) problems.push(`${rel}:${at}: names a numbered unit`);
  };
  const noteImport = (value, at) => {
    if (UNIT_IMPORT.test(value)) problems.push(`${rel}:${at}: imports a unit module (${value})`);
    noteUnit(value, at);
  };

  const skipGap = (start, startLine) => {
    let j = start;
    let ln = startLine;
    while (j < source.length) {
      const c = source[j];
      const n = source[j + 1];
      if (c === " " || c === "\t" || c === "\r" || c === "\f") { j++; continue; }
      if (c === "\n") { ln++; j++; continue; }
      if (c === "/" && n === "/") {
        j += 2;
        while (j < source.length && source[j] !== "\n") j++;
        continue;
      }
      if (c === "/" && n === "*") {
        j += 2;
        while (j < source.length && !(source[j] === "*" && source[j + 1] === "/")) {
          if (source[j] === "\n") ln++;
          j++;
        }
        if (j < source.length) j += 2;
        continue;
      }
      break;
    }
    return { j, ln };
  };

  const readLiteral = (start, startLine) => {
    const quote = source[start];
    if (quote !== "'" && quote !== '"' && quote !== "`") return null;
    let j = start + 1;
    let ln = startLine;
    let value = "";
    while (j < source.length) {
      const c = source[j];
      if (c === "\\") {
        const n = source[j + 1];
        if (n === undefined) return null;
        value += n;
        if (n === "\n") ln++;
        j += 2;
        continue;
      }
      if (c === "\n") {
        if (quote !== "`") return null;
        value += c;
        ln++;
        j++;
        continue;
      }
      if (quote === "`" && c === "$" && source[j + 1] === "{") return { constant: false };
      if (c === quote) return { constant: true, value, end: j + 1, endLine: ln };
      value += c;
      j++;
    }
    return null;
  };

  const peekSpecifier = (start, startLine) => {
    const gap = skipGap(start, startLine);
    if (source[gap.j] === "(") return peekSpecifier(gap.j + 1, gap.ln);
    const literal = readLiteral(gap.j, gap.ln);
    return literal?.constant ? literal : null;
  };

  const tryRegex = (start) => {
    let j = start + 1;
    let inClass = false;
    while (j < source.length) {
      const c = source[j];
      if (c === "\n" || c === "\r") return -1;
      if (c === "\\") {
        j += source[j + 1] === undefined ? 1 : 2;
        continue;
      }
      if (inClass) {
        if (c === "]") inClass = false;
        j++;
        continue;
      }
      if (c === "[") { inClass = true; j++; continue; }
      if (c === "/") {
        j++;
        while (j < source.length && /[a-z]/i.test(source[j])) j++;
        return j;
      }
      j++;
    }
    return -1;
  };

  while (i < source.length) {
    const c = source[i];
    const n = source[i + 1];
    const frame = stack.at(-1);
    if (frame?.kind === "tmpl") {
      if (c === "\\") { i += n === undefined ? 1 : 2; continue; }
      if (c === "\n") { line++; i++; continue; }
      if (c === "$" && n === "{") {
        stack.push({ kind: "code", braces: 0 });
        exprAllowed = true;
        i += 2;
        continue;
      }
      if (c === "`") stack.pop();
      i++;
      continue;
    }
    if (frame?.kind === "code") {
      if (c === "{") { frame.braces = (frame.braces ?? 0) + 1; exprAllowed = true; i++; continue; }
      if (c === "}") {
        i++;
        if ((frame.braces ?? 0) === 0) stack.pop();
        else frame.braces = (frame.braces ?? 0) - 1;
        exprAllowed = true;
        continue;
      }
    }
    if (c === " " || c === "\t" || c === "\r" || c === "\f") { i++; continue; }
    if (c === "\n") { line++; i++; continue; }
    if (c === "/" && n === "/") {
      i += 2;
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && n === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        if (source[i] === "\n") line++;
        i++;
      }
      if (i < source.length) i += 2;
      continue;
    }
    if (c === "/" && n !== "/" && n !== "*") {
      if (exprAllowed) {
        const end = tryRegex(i);
        if (end > i) { i = end; exprAllowed = false; continue; }
      }
      exprAllowed = true;
      i++;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      const literal = readLiteral(i, line);
      if (literal?.constant) {
        noteUnit(literal.value, line);
        i = literal.end;
        line = literal.endLine;
        exprAllowed = false;
        continue;
      }
      if (c === "`") { stack.push({ kind: "tmpl" }); i++; continue; }
      i++;
      continue;
    }
    if (c >= "0" && c <= "9") {
      while (i < source.length && /[0-9A-Za-z._]/.test(source[i])) i++;
      exprAllowed = false;
      continue;
    }
    if (isIdentChar(c) && (i === 0 || !isIdentChar(source[i - 1]))) {
      const wordLine = line;
      const start = i;
      i++;
      while (i < source.length && isIdentChar(source[i])) i++;
      const word = source.slice(start, i);
      let previous = start - 1;
      while (previous >= 0 && " \t\r\n\f".includes(source[previous])) previous--;
      const memberName = source[previous] === ".";
      if ((word === "import" || word === "from") && !memberName) {
        const spec = peekSpecifier(i, line);
        if (spec) {
          noteImport(spec.value, wordLine);
          i = spec.end;
          line = spec.endLine;
          exprAllowed = false;
          continue;
        }
      }
      exprAllowed = !memberName && EXPR_KW.has(word);
      continue;
    }
    if ("=+-*%!~?:,;([{&|^<>".includes(c)) { exprAllowed = true; i++; continue; }
    if (c === ")" || c === "]") { exprAllowed = false; i++; continue; }
    if (c === "}" || c === ".") { exprAllowed = c === "}"; i++; continue; }
    i++;
  }
  return problems;
}

/** @returns {string[]} */
export function assertSmallTaskLayering() {
  const files = [
    ...walk(join(ROOT, "src/editor/smallTask")).filter(path => !path.endsWith(join("primitives", "index.ts"))),
    join(ROOT, "scripts/lib/piAgentRuntime.ts"),
  ];
  return files.flatMap(path => problemsInSource(readFileSync(path, "utf8"), relative(ROOT, path)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = assertSmallTaskLayering();
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
}
