import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const cwd = process.cwd();
const out = dirname(fileURLToPath(import.meta.url));
const [head, tree] = execFileSync("git", ["rev-parse", "HEAD", "HEAD^{tree}"], { cwd, encoding: "utf8" }).trim().split("\n");
if (head !== "34c279bb6a481b18bf428fb985bc4fa4916d1e29") throw new Error("Unexpected final verification HEAD");
execFileSync("git", ["diff", "--exit-code", "66f2cdb7", "HEAD", "--", "src", "scripts", "openwiki", "package.json", "package-lock.json"], { cwd });
const oldReport = await readFile(join(cwd, ".omo/gates-vitest-report.json"));
await writeFile(join(out, "pre-p1-alignment-vitest.json"), oldReport, { flag: "wx" });
await writeFile(join(out, "pre-p1-alignment-archive.json"), `${JSON.stringify({
  sourceHead: "66f2cdb756a5a95eda07cae6103b82dfe7298b8a",
  bytes: oldReport.length, sha256: createHash("sha256").update(oldReport).digest("hex"),
  archive: "pre-p1-alignment-vitest.json", exactBytes: true,
}, null, 2)}\n`, { flag: "wx" });
const jobs = [
  ["final-p1-diagnostics", 300, ["node", ".omo/evidence/life-full-20260906/38/parent-diagnostics.mjs"]],
  ["final-p1-tests", 300, ["npm", "test", "--", "test/p1FoundationSchema.test.ts", "test/p1SessionPersistence.test.ts", "test/lifeRecoveryPersistence.test.ts", "test/lifeRecoveryRecordKeys.test.ts"]],
  ["final-index", 120, ["npm", "run", "openwiki:index", "--", "--check"]],
  ["final-gates", 1200, ["npm", "run", "gates", "--", "--json"]],
];
for (const [label, seconds, command] of jobs) {
  const argv = ["--timeout", "900", "/tmp/rpg-zzu-life-full-qa-01a0727b.lock", "timeout", "--signal=TERM", "--kill-after=15s", `${seconds}s`, ...command];
  const started = new Date().toISOString();
  console.log(`FINAL_STAGE_START ${label}`);
  const result = spawnSync("flock", argv, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const receipt = { cwd, head, tree, command: ["flock", ...argv], started, finished: new Date().toISOString(), exit: result.status, signal: result.signal, error: result.error?.message, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  await writeFile(join(out, `${label}.json`), `${JSON.stringify(receipt, null, 2)}\n`);
  process.stdout.write(receipt.stdout);
  process.stderr.write(receipt.stderr);
  console.log(`FINAL_STAGE_END ${label} exit=${receipt.exit}`);
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}
