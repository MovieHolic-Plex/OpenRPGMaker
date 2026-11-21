#!/usr/bin/env node
// Core small-task code may not import a numbered unit or name its id.
// Units plug in through primitives/index.ts (`host`, primitive methods).
//
// Usage: node scripts/check-small-task-layering.mjs   (exit 1 when anything is found)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = new URL("..", import.meta.url).pathname;
const UNIT_IMPORT = /(?:^|\/)units(?:\/|$)/;
const UNIT_ID = /["'](?:0[1-9]|[12]\d|30)-[a-z0-9-]+["']/;
const SKIP_ID_FILES = new Set(["src/editor/smallTask/primitives/ownership.ts"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (path.endsWith("/primitives/units")) continue;
      walk(path, out);
    } else if (name.endsWith(".ts") || name.endsWith(".tsx") || name.endsWith(".mts")) out.push(path);
  }
  return out;
}

function codeLines(source) {
  const lines = [];
  let block = false;
  for (const line of source.split("\n")) {
    let text = line;
    if (block) {
      const end = text.indexOf("*/");
      if (end < 0) {
        lines.push("");
        continue;
      }
      text = text.slice(end + 2);
      block = false;
    }
    while (text.includes("/*")) {
      const start = text.indexOf("/*");
      const end = text.indexOf("*/", start + 2);
      if (end < 0) {
        text = text.slice(0, start);
        block = true;
        break;
      }
      text = text.slice(0, start) + text.slice(end + 2);
    }
    const comment = text.indexOf("//");
    lines.push(comment < 0 ? text : text.slice(0, comment));
  }
  return lines;
}

/** @returns {string[]} */
export function assertSmallTaskLayering() {
  const files = [
    ...walk(join(ROOT, "src/editor/smallTask")).filter(path => !path.endsWith("/primitives/index.ts")),
    join(ROOT, "scripts/lib/piAgentRuntime.ts"),
  ];
  const problems = [];
  for (const path of files) {
    const rel = relative(ROOT, path);
    const source = readFileSync(path, "utf8");
    const lines = codeLines(source);
    lines.forEach((line, index) => {
      for (const match of line.matchAll(/(?:import\s*(?:\(\s*)?|from\s+)["']([^"']+)["']/g)) {
        if (UNIT_IMPORT.test(match[1])) problems.push(`${rel}:${index + 1}: imports a unit module (${match[1]})`);
      }
      if (!SKIP_ID_FILES.has(rel) && UNIT_ID.test(line)) {
        problems.push(`${rel}:${index + 1}: names a numbered unit`);
      }
    });
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = assertSmallTaskLayering();
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
}
