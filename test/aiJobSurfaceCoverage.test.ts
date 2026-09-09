import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../src", import.meta.url));

const WORKER_ONLY = [
  "ai/jobs/",
] as const;

const DEFINITIONS = [
  "ai/llmClient.ts",
  "ai/imageGenerationClient.ts",
  "ai/assistantSession.ts",
  "ai/assistantSessionCore.ts",
] as const;

const PATTERNS = [
  { name: "chatCompletion", re: /(?<!function\s)\bchatCompletion\s*\(/g },
  { name: "generateAiImage", re: /(?<!function\s)\bgenerateAiImage\s*\(/g },
  { name: "AssistantSession", re: /\bnew\s+AssistantSession\s*\(/g },
] as const;

interface Site {
  readonly file: string;
  readonly name: string;
  readonly line: number;
  readonly text: string;
}

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, files);
    else if (entry.endsWith(".ts") || entry.endsWith(".mts")) files.push(path);
  }
  return files;
}

function relativeFile(path: string): string {
  return relative(ROOT, path).replaceAll("\\", "/");
}

function editorCallers(moduleFile: string): string[] {
  const needle = moduleFile.replace(/\.ts$/, "").split("/").pop() ?? moduleFile;
  return walk(ROOT).flatMap(path => {
    const file = relativeFile(path);
    if (file === moduleFile) return [];
    if (!file.startsWith("editor/")) return [];
    const source = readFileSync(path, "utf8");
    if (!source.includes(needle)) return [];
    return [file];
  });
}

function editorImports(moduleFile: string): boolean {
  return editorCallers(moduleFile).length > 0;
}

function classify(file: string): "worker-only" | "infrastructure" | "definition" | "user" {
  if (DEFINITIONS.some(prefix => file === prefix || file.startsWith(prefix))) return "definition";
  if (WORKER_ONLY.some(prefix => file.startsWith(prefix))) return "worker-only";
  if (file.startsWith("evals/") || file.startsWith("benchmark/")) return "infrastructure";
  if (file === "ai/imageGenerationQueue.ts" && !editorImports(file)) return "infrastructure";
  if (file === "editor/operators/operatorIntentClient.ts") {
    const callers = editorCallers(file);
    if (callers.length === 1 && callers[0] === "editor/panels/regionTaskModal.ts") return "infrastructure";
  }
  if (file === "ai/intentDeclarationClient.ts") {
    const callers = editorCallers(file);
    if (callers.every(caller => caller === "editor/panels/aiRegionTaskRunner.ts")) return "infrastructure";
  }
  return "user";
}

function sitesOf(path: string): Site[] {
  const file = relativeFile(path);
  const source = readFileSync(path, "utf8");
  const lines = source.split("\n");
  const sites: Site[] = [];
  for (const pattern of PATTERNS) {
    for (const [index, line] of lines.entries()) {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;
      if (trimmed.includes("export async function chatCompletion") || trimmed.includes("export async function generateAiImage")) continue;
      pattern.re.lastIndex = 0;
      if (pattern.re.test(line)) {
        sites.push({ file, name: pattern.name, line: index + 1, text: trimmed.slice(0, 160) });
      }
    }
  }
  return sites;
}

it("classifies every chatCompletion/generateAiImage/session-ownership call site and leaves no user paid route", () => {
  const sites = walk(ROOT).flatMap(sitesOf);
  expect(sites.length, "scanner found no paid/session call sites").toBeGreaterThan(0);
  const leftover = sites.filter(site => classify(site.file) === "user");
  expect(
    leftover,
    leftover.map(site => `${site.file}:${site.line} ${site.name} ${site.text}`).join("\n"),
  ).toEqual([]);
});

it("traces operator and intent callers instead of exempting those files by path", () => {
  expect(editorCallers("editor/operators/operatorIntentClient.ts")).toEqual(["editor/panels/regionTaskModal.ts"]);
  expect(editorCallers("ai/intentDeclarationClient.ts").every(file =>
    file.startsWith("ai/jobs/") || file === "ai/assistantSessionCore.ts" || file === "editor/panels/aiRegionTaskRunner.ts",
  )).toBe(true);
});
