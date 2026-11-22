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
const UNIT_ID = /["'](?:0[1-9]|[12]\d|30)-[a-z0-9-]+["']/;
const IMPORT_SPECIFIER = /(?:import\s*(?:\(\s*)?|from\s+)["']([^"']+)["']/g;
const SKIP_ID_FILES = new Set(["src/editor/smallTask/primitives/ownership.ts"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (path.endsWith(`${join("primitives", "units")}`)) continue;
      walk(path, out);
    } else if (name.endsWith(".ts") || name.endsWith(".tsx") || name.endsWith(".mts")) out.push(path);
  }
  return out;
}

/** Blank comments. Strings, including `/*` inside them, stay in the text. Newlines stay put. */
export function stripComments(source) {
  let out = "";
  const stack = [{ kind: "code" }];
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    const n = source[i + 1];
    const frame = stack.at(-1);
    if (frame.kind === "line") {
      out += c === "\n" ? "\n" : " ";
      if (c === "\n") stack.pop();
      i++;
      continue;
    }
    if (frame.kind === "block") {
      if (c === "*" && n === "/") {
        out += "  ";
        i += 2;
        stack.pop();
        continue;
      }
      out += c === "\n" ? "\n" : " ";
      i++;
      continue;
    }
    if (frame.kind === "sq" || frame.kind === "dq" || frame.kind === "tmpl") {
      if (c === "\\") {
        out += c + (n ?? "");
        i += n === undefined ? 1 : 2;
        continue;
      }
      if (frame.kind === "tmpl" && c === "$" && n === "{") {
        out += "${";
        i += 2;
        stack.push({ kind: "code", braces: 0 });
        continue;
      }
      out += c;
      i++;
      if ((frame.kind === "sq" && c === "'") || (frame.kind === "dq" && c === '"') || (frame.kind === "tmpl" && c === "`")) stack.pop();
      continue;
    }
    if (c === "/" && n === "/") {
      out += "  ";
      i += 2;
      stack.push({ kind: "line" });
      continue;
    }
    if (c === "/" && n === "*") {
      out += "  ";
      i += 2;
      stack.push({ kind: "block" });
      continue;
    }
    if (c === "'") { out += c; i++; stack.push({ kind: "sq" }); continue; }
    if (c === '"') { out += c; i++; stack.push({ kind: "dq" }); continue; }
    if (c === "`") { out += c; i++; stack.push({ kind: "tmpl" }); continue; }
    if (frame.braces !== undefined) {
      if (c === "{") frame.braces++;
      else if (c === "}") {
        out += c;
        i++;
        if (frame.braces === 0) stack.pop();
        else frame.braces--;
        continue;
      }
    }
    out += c;
    i++;
  }
  return out;
}

/** @param {string} source @param {string} rel @returns {string[]} */
export function problemsInSource(source, rel) {
  const text = stripComments(source);
  const problems = [];
  for (const match of text.matchAll(IMPORT_SPECIFIER)) {
    if (!UNIT_IMPORT.test(match[1])) continue;
    const line = text.slice(0, match.index).split("\n").length;
    problems.push(`${rel}:${line}: imports a unit module (${match[1]})`);
  }
  if (!SKIP_ID_FILES.has(rel)) {
    text.split("\n").forEach((line, index) => {
      if (UNIT_ID.test(line)) problems.push(`${rel}:${index + 1}: names a numbered unit`);
    });
  }
  return problems;
}

/** @returns {string[]} */
export function assertSmallTaskLayering() {
  const files = [
    ...walk(join(ROOT, "src/editor/smallTask")).filter(path => !path.endsWith(`${join("primitives", "index.ts")}`)),
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
