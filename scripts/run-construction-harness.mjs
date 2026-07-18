import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VITEST_ENTRY = resolve(REPO_ROOT, "node_modules/vitest/vitest.mjs");
const EVIDENCE_ROOT = resolve(REPO_ROOT, "output/evidence/construction-harness");
const DEFAULT_SEED = "20260718";

const negativeControl = process.argv.slice(2).includes("--negative-control");
const runId = `v1-${new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-")}-${process.pid}`;
const runDirectory = resolve(EVIDENCE_ROOT, runId);
mkdirSync(runDirectory, { recursive: true });

const harnessEnvironment = {
  ...process.env,
  CONSTRUCTION_HARNESS_RUN_DIR: runDirectory,
  CONSTRUCTION_HARNESS_RUN_ID: runId,
  CONSTRUCTION_HARNESS_SEED: DEFAULT_SEED,
  CONSTRUCTION_HARNESS_NEGATIVE_CONTROL: negativeControl ? "1" : "0",
};

const scenarioStatus = runVitest("test/constructionHarness.scenario.test.ts");
const verifierStatus = runVitest("test/constructionHarness.test.ts");

console.log(`Construction harness evidence: ${runDirectory}`);
if (scenarioStatus !== 0 || verifierStatus !== 0) process.exitCode = 1;

function runVitest(testPath) {
  const child = spawnSync(
    process.execPath,
    [VITEST_ENTRY, "run", "--configLoader", "runner", testPath],
    {
      cwd: REPO_ROOT,
      env: harnessEnvironment,
      stdio: "inherit",
    },
  );
  if (child.error !== undefined) {
    console.error(child.error.message);
    return 1;
  }
  return child.status ?? 1;
}
