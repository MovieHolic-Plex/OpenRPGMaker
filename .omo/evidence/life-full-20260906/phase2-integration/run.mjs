import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const cwd = process.cwd();
const out = dirname(fileURLToPath(import.meta.url));
const [head, tree] = execFileSync("git", ["rev-parse", "HEAD", "HEAD^{tree}"], { cwd, encoding: "utf8" }).trim().split("\n");
if (head !== "66f2cdb756a5a95eda07cae6103b82dfe7298b8a") throw new Error("Unexpected integration HEAD");
await mkdir(out, { recursive: true });
const tests = [
  "lifeRecoveryRecordKeys", "lifeRecovery", "lifeRecoveryPersistence",
  "p0SessionPersistence", "p2SpatialPersistence", "itemTransitions",
  "p0CommerceFinalSafety", "p0EconomySafetyFollowup",
].map(name => `test/${name}.test.ts`);
const jobs = [
  ["diagnostics-quantity", 300, ["node", ".omo/evidence/life-full-20260906/30/diagnostics.mjs"]],
  ["diagnostics-cursors", 300, ["node", ".omo/evidence/life-full-20260906/30/finite-use/diagnostics.mjs"]],
  ["related", 300, ["npm", "test", "--", ...tests, "--maxWorkers=2", "--minWorkers=1"]],
  ["public", 180, ["node", ".omo/evidence/life-full-20260906/30/finite-use/public-roundtrip.mjs"]],
  ["typecheck", 300, ["npm", "run", "typecheck:app"]],
  ["build", 600, ["env", `VITE_CACHE_DIR=${join(out, "build-cache")}`, "npm", "run", "build"]],
  ["index", 120, ["npm", "run", "openwiki:index", "--", "--check"]],
  ["wiki", 120, ["npm", "run", "openwiki:verify"]],
  ["gates", 1200, ["npm", "run", "gates", "--", "--json"]],
];
for (const [label, seconds, command] of jobs) {
  const argv = [
    "--timeout", "900", "/tmp/rpg-zzu-life-full-qa-01a0727b.lock",
    "timeout", "--signal=TERM", "--kill-after=15s", `${seconds}s`, ...command,
  ];
  const started = new Date().toISOString();
  console.log(`STAGE_START ${label}`);
  const result = spawnSync("flock", argv, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const receipt = {
    cwd, head, tree, label, command: ["flock", ...argv], started,
    finished: new Date().toISOString(), exit: result.status, signal: result.signal,
    error: result.error?.message, stdout: result.stdout ?? "", stderr: result.stderr ?? "",
  };
  await writeFile(join(out, `${label}.json`), `${JSON.stringify(receipt, null, 2)}\n`);
  process.stdout.write(receipt.stdout);
  process.stderr.write(receipt.stderr);
  console.log(`STAGE_END ${label} exit=${receipt.exit} signal=${receipt.signal}`);
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}
