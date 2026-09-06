import { execFileSync, spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const out = dirname(fileURLToPath(import.meta.url));
const cases = [
  ["store-base", "/home/main/z-project/rpg-zzu-life-full-p1", "87de73785d1c309bbbe975636414f70bbc73a4b9"],
  ["store-current", "/home/main/z-project/rpg-zzu-life-full-p2", "66f2cdb756a5a95eda07cae6103b82dfe7298b8a"],
];
for (const [label, cwd, expectedHead] of cases) {
  const [head, tree] = execFileSync("git", ["rev-parse", "HEAD", "HEAD^{tree}"], { cwd, encoding: "utf8" }).trim().split("\n");
  if (head !== expectedHead) throw new Error(`Unexpected ${label} HEAD`);
  const command = [
    "--timeout", "900", "/tmp/rpg-zzu-life-full-qa-01a0727b.lock",
    "timeout", "--signal=TERM", "--kill-after=15s", "300s",
    "npm", "test", "--", "test/autosaveStatus.test.ts",
    "test/storePersistence.test.ts", "test/unsavedChangesGuard.test.ts",
    "--maxWorkers=2", "--minWorkers=1", "--reporter=json",
    "--outputFile", join(out, `${label}.report.json`),
  ];
  console.log(`STORE_COMPARE_START ${label}`);
  const started = new Date().toISOString();
  const result = spawnSync("flock", command, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const receipt = {
    label, cwd, head, tree, command: ["flock", ...command], started,
    finished: new Date().toISOString(), exit: result.status, signal: result.signal,
    stdout: result.stdout ?? "", stderr: result.stderr ?? "", error: result.error?.message,
  };
  await writeFile(join(out, `${label}.json`), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`STORE_COMPARE_END ${label} exit=${receipt.exit} signal=${receipt.signal}`);
  if (result.error || result.signal || (result.status !== 0 && result.status !== 1)) {
    process.exitCode = 1;
    break;
  }
}
