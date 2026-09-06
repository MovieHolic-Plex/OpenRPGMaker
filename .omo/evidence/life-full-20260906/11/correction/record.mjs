import { spawnSync, execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
const [name, seconds, command, ...args] = process.argv.slice(2);
// Keep Vite's nearest-node_modules config temporary output local, also on replay after cleanup.
mkdirSync(new URL("./node_modules/", import.meta.url), { recursive: true });
const out = new URL(`./${name}.json`, import.meta.url);
const lockArgs = ["--timeout", "900", "/tmp/rpg-zzu-life-full-qa-01a0727b.lock", "timeout", "--signal=TERM", "--kill-after=15s", `${seconds}s`, command, ...args];
const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const sourceHash = createHash("sha256").update(readFileSync("src/project/spatialPlacementTransactions.ts")).digest("hex");
const result = spawnSync("flock", lockArgs, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
writeFileSync(out, JSON.stringify({ command: ["flock", ...lockArgs], cwd: process.cwd(), head, sourceHash,
  exit: result.status, signal: result.signal, error: result.error?.message, stdout: result.stdout, stderr: result.stderr }, null, 2) + "\n", { flag: "wx" });
console.log(result.stdout, result.stderr);
process.exit(result.status ?? 1);
