#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { withTsModule } from "./ontology-ts-loader.mjs";

const HEADLESS_ENTRY = resolve(fileURLToPath(new URL("../src/headless/index.ts", import.meta.url)));

function usage() {
  return [
    "Usage:",
    "  node scripts/oprn-tools.mjs --list",
    "  node scripts/oprn-tools.mjs --project <file.json|file.oprn> <tool-name> '<args-json>'   (legacy .rpgzzu still opens)",
  ].join("\n");
}

function parseArgs(argv) {
  const parsed = { list: false, projectPath: undefined, toolName: undefined, toolArgsJson: "{}" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--list") {
      parsed.list = true;
    } else if (arg === "--project") {
      parsed.projectPath = argv[i + 1];
      i += 1;
    } else if (!parsed.toolName) {
      parsed.toolName = arg;
    } else {
      parsed.toolArgsJson = arg;
    }
  }
  return parsed;
}

function loadProject(module, projectPath) {
  const bytes = readFileSync(projectPath);
  // 확장자 판정은 src/headless 가 든다(.oprn 우선, 옛 .rpgzzu 도 읽음) — 여기서 문자열을 따로 들지 않는다.
  if (module.isHeadlessPackagePath(projectPath)) {
    return module.loadHeadlessProjectFromPackage(bytes);
  }
  return module.loadHeadlessProject(bytes.toString("utf8"));
}

function parseToolArgs(raw) {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("tool args must be a JSON object");
  }
  return parsed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await withTsModule(HEADLESS_ENTRY, "headless.mjs", async (module) => {
    if (args.list) {
      process.stdout.write(`${JSON.stringify({ tools: module.listHeadlessTools() }, null, 2)}\n`);
      return;
    }
    if (!args.projectPath || !args.toolName) {
      throw new Error(usage());
    }
    const project = loadProject(module, args.projectPath);
    const toolArgs = parseToolArgs(args.toolArgsJson);
    const result = module.runHeadlessTool(project, args.toolName, toolArgs);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
