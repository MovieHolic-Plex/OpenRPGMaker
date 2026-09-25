#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildTsModule, withTsModule } from "./ontology-ts-loader.mjs";

const HEADLESS_ENTRY = resolve(fileURLToPath(new URL("../src/headless/index.ts", import.meta.url)));
const STORE_ENTRY = resolve(fileURLToPath(new URL("../electron/local-store/store.ts", import.meta.url)));
const PUBLIC_DIR = resolve(fileURLToPath(new URL("../public", import.meta.url)));
const HISTORY_LIMIT = 20;

function usage() {
  return [
    "Usage:",
    "  node scripts/oprn-tools.mjs --list",
    "  node scripts/oprn-tools.mjs --project <file.json|file.oprn> <tool-name> '<args-json>'   (legacy .rpgzzu still opens)",
    "  node scripts/oprn-tools.mjs --project-dir <projectDir> <tool-name> '<args-json>'",
    "  node scripts/oprn-tools.mjs --new --project <file.json> [<tool-name> '<args-json>']   (create an empty project first)",
    "",
    "Options:",
    "  --write          save a successful write tool's result back to --project (or --out). Without it write tools are dry runs.",
    "  --out <file>     save to this project.json instead of --project (implies --write)",
    "  --new            start from a new empty project (as the editor opens it) when --project does not exist yet",
    "  --bundle <file>  reuse a prebuilt tool bundle; built there on first use (delete it after changing src/)",
    "",
    "With --write, every saved call keeps the previous project in <project>.history/ so revert_last_edit {steps}",
    "and list_edit_history work across calls.",
  ].join("\n");
}

function parseArgs(argv) {
  const parsed = { list: false, write: false, fresh: false, projectPath: undefined, projectDir: undefined, outPath: undefined, bundle: undefined, toolName: undefined, toolArgsJson: "{}" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--list") parsed.list = true;
    else if (arg === "--write") parsed.write = true;
    else if (arg === "--new") parsed.fresh = true;
    else if (arg === "--project") { parsed.projectPath = argv[i + 1]; i += 1; }
    else if (arg === "--project-dir") { parsed.projectDir = argv[i + 1]; i += 1; }
    else if (arg === "--out") { parsed.outPath = argv[i + 1]; parsed.write = true; i += 1; }
    else if (arg === "--bundle") { parsed.bundle = argv[i + 1]; i += 1; }
    else if (!parsed.toolName) parsed.toolName = arg;
    else parsed.toolArgsJson = arg;
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

// ── 저장 이력: 헤드리스 호출은 프로세스가 매번 새로 떠서 편집기의 메모리 이력이 없다. 저장 직전 파일을 남긴다. ──
const historyDir = (path) => `${path}.history`;
function historyEntries(path) {
  const dir = historyDir(path);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => /^\d+\.json$/.test(name)).sort().map((name) => resolve(dir, name));
}
function pushHistory(path, label) {
  if (!existsSync(path)) return;
  const dir = historyDir(path);
  mkdirSync(dir, { recursive: true });
  const stamp = String(Date.now()).padStart(15, "0");
  writeFileSync(resolve(dir, `${stamp}.json`), readFileSync(path));
  writeFileSync(resolve(dir, `${stamp}.label`), label);
  const entries = historyEntries(path);
  for (const old of entries.slice(0, Math.max(0, entries.length - HISTORY_LIMIT))) {
    rmSync(old, { force: true });
    rmSync(old.replace(/\.json$/, ".label"), { force: true });
  }
}
function historyLabel(entry) {
  const labelPath = entry.replace(/\.json$/, ".label");
  return existsSync(labelPath) ? readFileSync(labelPath, "utf8") : "편집";
}

function historyResult(path, toolName, toolArgs) {
  const entries = historyEntries(path).reverse();
  if (toolName === "list_edit_history") {
    const limit = Number.isInteger(toolArgs.limit) && toolArgs.limit > 0 ? toolArgs.limit : 10;
    const list = entries.slice(0, limit).map((entry, index) => ({ steps: index + 1, label: historyLabel(entry) }));
    return { ok: true, summary: list.length > 0 ? `편집 기록 ${list.length}건` : "편집 기록이 없습니다", data: { entries: list } };
  }
  const steps = toolArgs.steps === undefined ? 1 : toolArgs.steps;
  if (!Number.isInteger(steps) || steps < 1) return { ok: false, summary: "steps 는 1 이상의 정수여야 합니다" };
  const target = entries[steps - 1];
  if (!target) return { ok: false, summary: "되돌릴 이전 상태가 없습니다", issues: [{ severity: "error", code: "history-empty", message: `저장 이력 ${entries.length}건 — --write 로 저장한 호출만 되돌릴 수 있다` }] };
  const label = historyLabel(target);
  writeFileSync(path, readFileSync(target));
  for (const entry of entries.slice(0, steps)) {
    rmSync(entry, { force: true });
    rmSync(entry.replace(/\.json$/, ".label"), { force: true });
  }
  return { ok: true, summary: `직전 변경을 되돌렸습니다 — ${label}`, data: { restoredSteps: steps } };
}

async function withHeadless(bundlePath, callback) {
  if (!bundlePath) return withTsModule(HEADLESS_ENTRY, "headless.mjs", callback);
  const file = resolve(bundlePath);
  if (!existsSync(file)) {
    mkdirSync(dirname(file), { recursive: true });
    await buildTsModule(HEADLESS_ENTRY, file);
  }
  return callback(await import(pathToFileURL(file).href));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await withHeadless(args.bundle, async (module) => {
    module.setHeadlessPublicRoot(PUBLIC_DIR);
    if (args.list) {
      process.stdout.write(`${JSON.stringify({ tools: module.listHeadlessTools() }, null, 2)}\n`);
      return;
    }
    const creating = args.fresh && args.projectPath && !existsSync(args.projectPath);
    if ((!args.projectPath && !args.projectDir) || (!args.toolName && !creating)) {
      throw new Error(usage());
    }
    if (args.write && args.projectDir) throw new Error("--write saves project.json files; --project-dir (SQLite folder) is read-only here");
    const savePath = args.outPath ?? args.projectPath;
    if (args.write && savePath && module.isHeadlessPackagePath(savePath)) {
      throw new Error(`--write saves project.json — give --out <file.json> for a package input (${savePath})`);
    }
    const toolArgs = parseToolArgs(args.toolArgsJson);
    // 저장 이력으로 되돌리기: 편집기 이력(메모리)은 헤드리스 프로세스마다 비어 있다.
    if (args.write && (args.toolName === "revert_last_edit" || args.toolName === "list_edit_history")) {
      process.stdout.write(`${JSON.stringify(historyResult(savePath, args.toolName, toolArgs), null, 2)}\n`);
      return;
    }
    let project;
    if (creating) {
      project = module.createHeadlessBlankProject();
      writeFileSync(args.projectPath, module.serializeHeadlessProject(project));
      if (!args.toolName) {
        process.stdout.write(`${JSON.stringify({ ok: true, summary: `빈 프로젝트를 만들었습니다: ${args.projectPath}`, data: { startMapId: project.startMapId, maps: Object.keys(project.maps), tilesets: Object.keys(project.tilesets) } }, null, 2)}\n`);
        return;
      }
    } else {
      project = module.normalizeHeadlessProject(args.projectDir
        ? await loadProjectFromDirectory(args.projectDir)
        : loadProject(module, args.projectPath));
    }
    await module.prepareHeadlessTool(args.toolName, toolArgs);
    const { result, project: next } = module.runHeadlessToolWithProject(project, args.toolName, toolArgs);
    if (args.write && result.ok && next !== project) {
      pushHistory(savePath, `${args.toolName}: ${String(result.summary ?? "").slice(0, 120)}`);
      writeFileSync(savePath, module.serializeHeadlessProject(next));
      result.saved = savePath;
    } else if (!args.write && result.ok && next !== project) {
      result.dryRun = "write tool ran on a copy — add --write to save";
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
