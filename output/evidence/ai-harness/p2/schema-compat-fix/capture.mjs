import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const [name, command, ...args] = process.argv.slice(2);
if (!name || !command) throw new Error("Usage: node capture.mjs NAME COMMAND ...ARGS");
const sha256 = data => createHash("sha256").update(data).digest("hex");
function git(...args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}
function identity() {
  const files = ["src/ai/assistantAcceptanceTools.ts", "src/ai/assistantAcceptance.ts", "src/ai/assistantAcceptanceLedger.ts", "src/ai/assistantAcceptanceEvaluation.ts", "src/ai/assistantSession.ts", "src/ai/workPlan.ts", "src/ai/toolVerificationEvidence.ts", "test/toolSchemaProviderCompat.test.ts"];
  return { head: git("rev-parse", "HEAD"), tree: git("rev-parse", "HEAD^{tree}"),
    trackedDiffSha256: sha256(git("diff", "HEAD", "--", "src", "test")),
    files: Object.fromEntries(files.map(file => [file, sha256(readFileSync(file))])) };
}
const before = identity();
const startedAt = new Date().toISOString();
const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, env: process.env });
const log = `${result.stdout ?? ""}${result.stderr ?? ""}`;
writeFileSync(join(dir, `${name}.log`), log);
const report = { cwd: process.cwd(), command, args, env: { TMPDIR: process.env.TMPDIR, VITE_CACHE_DIR: process.env.VITE_CACHE_DIR }, before, after: identity(), startedAt, finishedAt: new Date().toISOString(), exitCode: result.status, signal: result.signal, spawnError: result.error?.message ?? null, logSha256: sha256(log) };
writeFileSync(join(dir, `${name}.json`), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ name, exitCode: report.exitCode, signal: report.signal, log: join(dir, `${name}.log`) }));
process.exit(result.status ?? 1);
