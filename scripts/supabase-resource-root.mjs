import path from "node:path";
import process from "node:process";
import { DEFAULT_EVIDENCE_DIR, rootResourceFiles } from "./supabase-resource-root/catalog.mjs";
import { applyRootUploads, verifyRootUploads } from "./supabase-resource-root/projectUploads.mjs";
import { configFromEnv, loadCurrentJson, upsertCurrentJson, writeBackup, writeJson } from "./supabase-resource-root/supabaseRest.mjs";

async function main() {
  const command = process.argv[2] ?? "verify";
  const evidenceDir = flagValue("--evidence-dir") ?? DEFAULT_EVIDENCE_DIR;
  const config = await configFromEnv();
  const currentJson = await loadCurrentJson(config);
  const resources = await rootResourceFiles();

  if (command === "sync") {
    const backupPath = await writeBackup(currentJson, config.projectId);
    const syncedJson = await applyRootUploads(currentJson, resources);
    await upsertCurrentJson(config, syncedJson);
    const verifiedJson = await loadCurrentJson(config);
    const report = await buildReport("sync", config, await verifyRootUploads(verifiedJson, resources, evidenceDir), evidenceDir);
    report.backupPath = backupPath;
    await writeJson(report.reportPath, report);
    printSummary(report);
    return;
  }

  if (command === "verify") {
    const report = await buildReport("verify", config, await verifyRootUploads(currentJson, resources, evidenceDir), evidenceDir);
    await writeJson(report.reportPath, report);
    printSummary(report);
    if (report.missing.length > 0 || report.mismatched.length > 0) process.exitCode = 1;
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

function flagValue(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  return process.argv[index + 1] ?? null;
}

async function buildReport(mode, config, report, evidenceDir) {
  return {
    ...report,
    mode,
    projectId: config.projectId,
    supabaseUrlHost: new URL(config.url).host,
    reportPath: path.join(evidenceDir, "supabase-resource-root-report.json"),
  };
}

function printSummary(report) {
  console.log(JSON.stringify({
    mode: report.mode,
    projectId: report.projectId,
    expectedCount: report.expectedCount,
    verifiedCount: report.verifiedCount,
    missingCount: report.missing.length,
    mismatchedCount: report.mismatched.length,
    reportPath: path.resolve(report.reportPath),
    localDeleteReadinessPath: report.localDeleteReadinessPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
