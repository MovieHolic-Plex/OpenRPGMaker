#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { withTsModule } from "./ontology-ts-loader.mjs";

const HEADLESS_ENTRY = resolve(fileURLToPath(new URL("../src/headless/index.ts", import.meta.url)));
const STORE_ENTRY = resolve(fileURLToPath(new URL("../electron/local-store/store.ts", import.meta.url)));

function usage() {
  return [
    "Usage:",
    "  node scripts/rpgzzu-tools.mjs --list",
    "  node scripts/rpgzzu-tools.mjs --project <file.json|file.rpgzzu> <tool-name> '<args-json>'",
    "  node scripts/rpgzzu-tools.mjs --project-dir <projectDir> <tool-name> '<args-json>'",
  ].join("\n");
}

function parseArgs(argv) {
  const parsed = { list: false, projectPath: undefined, projectDir: undefined, toolName: undefined, toolArgsJson: "{}" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--list") {
      parsed.list = true;
    } else if (arg === "--project") {
      parsed.projectPath = argv[i + 1];
      i += 1;
    } else if (arg === "--project-dir") {
      parsed.projectDir = argv[i + 1];
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
  if (extname(projectPath) === ".rpgzzu") {
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

async function loadProjectFromDirectory(projectDir) {
  return await withTsModule(STORE_ENTRY, "oprn-local-store.mjs", async (storeModule) => {
    const store = await storeModule.openLocalProjectStore({ projectDir });
    try {
      const snapshot = store.loadSnapshot();
      if (!snapshot) throw new Error(`project folder has no document yet: ${projectDir}`);
      return snapshot.project;
    } finally {
      store.close();
    }
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await withTsModule(HEADLESS_ENTRY, "headless.mjs", async (module) => {
    if (args.list) {
      process.stdout.write(`${JSON.stringify({ tools: module.listHeadlessTools() }, null, 2)}\n`);
      return;
    }
    if ((!args.projectPath && !args.projectDir) || !args.toolName) {
      throw new Error(usage());
    }
    const project = args.projectDir
      ? await loadProjectFromDirectory(args.projectDir)
      : loadProject(module, args.projectPath);
    const toolArgs = parseToolArgs(args.toolArgsJson);
    const result = module.runHeadlessTool(project, args.toolName, toolArgs);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
