import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [label, seconds, ...command] = process.argv.slice(2);
if (!label || !seconds || !command.length) throw new Error("run.mjs LABEL SECONDS COMMAND [ARGS]");
const cwd = process.cwd();
const evidence = join(cwd, ".omo/evidence/life-full-20260906/30/finite-use");
const temp = mkdtempSync(join(tmpdir(), "st_01a074ed-index-"));
const git = (args, env = process.env) => execFileSync("git", args, { cwd, env, encoding: "utf8" }).trim();
let codeTree;
try {
  const env = { ...process.env, GIT_INDEX_FILE: join(temp, "index") };
  git(["read-tree", "HEAD"], env);
  git(["add", "--", "src/project/lifeStateReconciliation.ts", "src/project/lifeRecovery.ts", "src/project/session.ts", "src/project/itemTransitions.ts", "src/player/saveSlots.ts", "test/lifeRecoveryRecordKeys.test.ts"], env);
  codeTree = git(["write-tree"], env);
} finally { rmSync(temp, { recursive: true }); }
const args = ["--timeout", "900", "/tmp/rpg-zzu-life-full-qa-01a0727b.lock", "timeout", "--signal=TERM", "--kill-after=15s", `${seconds}s`, ...command];
const started = new Date().toISOString();
const result = spawnSync("flock", args, { cwd, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
writeFileSync(join(evidence, `${label}.log`), `${result.stdout ?? ""}${result.stderr ?? ""}`.split("\n").map((line) => line.trimEnd()).join("\n").trimEnd() + "\n");
const receipt = { label, cwd, command: ["flock", ...args], started, finished: new Date().toISOString(), base: "f86474547028cddf795c8e431b2195b7edccd201", head: git(["rev-parse", "HEAD"]), headTree: git(["rev-parse", "HEAD^{tree}"]), codeTree, stdout: result.stdout, stderr: result.stderr, exit: result.status, signal: result.signal, error: result.error?.message };
writeFileSync(join(evidence, `${label}.json`), JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify(receipt, null, 2));
console.log((result.stdout ?? "") + (result.stderr ?? ""));
process.exitCode = result.status ?? 1;
