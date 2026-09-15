#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { withTsModule } from "./ontology-ts-loader.mjs";

const STORE_ENTRY = fileURLToPath(new URL("../electron/local-store/store.ts", import.meta.url));
const HEADLESS_ENTRY = fileURLToPath(new URL("../src/headless/index.ts", import.meta.url));

const USAGE = [
  "Usage:",
  "  node scripts/oprn-store.mjs init <projectDir>",
  "  node scripts/oprn-store.mjs info <projectDir>",
  "  node scripts/oprn-store.mjs import-json <projectDir> --json <file.json>",
  "  node scripts/oprn-store.mjs import-package <projectDir> --package <file.oprn|file.rpgzzu>",
  "  node scripts/oprn-store.mjs export-json <projectDir> --out <file.json>",
  "  node scripts/oprn-store.mjs backup <projectDir>",
  "  node scripts/oprn-store.mjs import-supabase <projectDir> --project <id> [--url <url>] [--anon-key <key>]",
].join("\n");

const COMMANDS = ["init", "info", "import-json", "import-package", "export-json", "backup", "import-supabase"];

const parsedArgsSchema = z.object({
  command: z.enum(COMMANDS),
  projectDir: z.string().min(1),
  supabaseProjectId: z.string().min(1).optional(),
  supabaseUrl: z.string().url().optional(),
  supabaseAnonKey: z.string().min(1).optional(),
  jsonPath: z.string().min(1).optional(),
  packagePath: z.string().min(1).optional(),
  outPath: z.string().min(1).optional(),
});

export function parseArgs(argv) {
  const [command, projectDir, ...rest] = argv;
  const options = { jsonPath: undefined, packagePath: undefined, outPath: undefined, supabaseProjectId: undefined, supabaseUrl: undefined, supabaseAnonKey: undefined };
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (flag === "--json") options.jsonPath = value;
    else if (flag === "--package") options.packagePath = value;
    else if (flag === "--out") options.outPath = value;
    else if (flag === "--project") options.supabaseProjectId = value;
    else if (flag === "--url") options.supabaseUrl = value;
    else if (flag === "--anon-key") options.supabaseAnonKey = value;
    else throw new Error(`unknown argument ${flag}\n${USAGE}`);
    index += 1;
  }
  const parsed = parsedArgsSchema.safeParse({ command, projectDir, ...options });
  if (!parsed.success) throw new Error(`${parsed.error.issues.map((issue) => issue.message).join("; ")}\n${USAGE}`);
  return parsed.data;
}

function requirePath(value, flag) {
  if (!value) throw new Error(`${flag} is required for this command\n${USAGE}`);
  return value;
}

function printJson(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await withTsModule(STORE_ENTRY, "oprn-local-store.mjs", async (storeModule) => {
    if (args.command === "init") {
      const store = await storeModule.initLocalProjectStore({ projectDir: args.projectDir });
      printJson({ ...store.info(), projectDir: args.projectDir });
      store.close();
      return;
    }
    const store = await storeModule.openLocalProjectStore({ projectDir: args.projectDir });
    try {
      if (args.command === "info") {
        printJson({ ...store.info(), projectDir: args.projectDir });
        return;
      }
      if (args.command === "backup") {
        printJson({ backupPath: store.backup() });
        return;
      }
      if (args.command === "export-json") {
        const text = store.exportSerialized();
        if (text === null) throw new Error("store has no project document yet");
        const outPath = requirePath(args.outPath, "--out");
        writeFileSync(outPath, text);
        printJson({ outPath, bytes: Buffer.byteLength(text, "utf8") });
        return;
      }
      if (args.command === "import-json" || args.command === "import-package") {
        const sourcePath = args.command === "import-json"
          ? requirePath(args.jsonPath, "--json")
          : requirePath(args.packagePath, "--package");
        const bytes = readFileSync(sourcePath);
        const project = await withTsModule(HEADLESS_ENTRY, "oprn-headless.mjs", async (headless) =>
          args.command === "import-json"
            ? headless.loadHeadlessProject(bytes.toString("utf8"))
            : headless.loadHeadlessProjectFromPackage(bytes));
        const saved = await store.saveProject(project);
        printJson({ kind: saved.kind, sha256: saved.sha256, revision: saved.revision, ...store.info() });
        return;
      }
      if (args.command === "import-supabase") {
        const projectId = requirePath(args.supabaseProjectId, "--project");
        const supabaseUrl = args.supabaseUrl ?? process.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = args.supabaseAnonKey ?? process.env.VITE_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase 자격증명이 필요합니다: --url/--anon-key 또는 VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY 환경변수");
        const headers = { apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}`, Accept: "application/json", "Accept-Profile": "rpg_zzu" };
        const fetchRows = async (table) => {
          const response = await fetch(`${supabaseUrl}/rest/v1/${table}?project_id=eq.${projectId}&select=*`, { headers });
          if (!response.ok) throw new Error(`${table}: ${response.status} ${await response.text()}`);
          return await response.json();
        };
        const storeModule = await withTsModule(STORE_ENTRY, "oprn-local-store.mjs", async (m) => m);
        const store = await storeModule.openLocalProjectStore({ projectDir: args.projectDir });
        try {
          const [projectRows, commitRows, changeRows, activityRows, conversationRows, analysisRows] = await Promise.all([
            fetchRows("projects"), fetchRows("project_commits"), fetchRows("project_changes"),
            fetchRows("ai_activity_logs"), fetchRows("ai_conversations"), fetchRows("ai_analysis_runs"),
          ]);
          const projectRow = projectRows[0];
          if (!projectRow?.current_json) throw new Error(`Supabase에 프로젝트 문서가 없습니다: ${projectId}`);
          const serialized = typeof projectRow.current_json === "string" ? projectRow.current_json : JSON.stringify(projectRow.current_json);
          const saved = await store.saveSerialized(serialized);
          store.bulkImportSupabase({ commits: commitRows, changes: changeRows, aiActivityLogs: activityRows, aiConversations: conversationRows, aiAnalysisRuns: analysisRows });
          const media = await store.separateInlineMedia(store.loadSnapshot()?.project ?? projectFromJson(serialized));
          printJson({ kind: saved.kind, sha256: saved.sha256, revision: saved.revision, projectId, projectDir: args.projectDir, mediaSeparated: media.changed, migratedAssets: media.migratedAssetIds.length, ...store.info() });
        } finally { store.close(); }
        return;
      }
      throw new Error(`unhandled command ${args.command}\n${USAGE}`);
    } finally {
      store.close();
    }
  });
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});