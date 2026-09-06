import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const cwd = "/home/main/z-project/rpg-zzu-life-full-p1";
const out = dirname(fileURLToPath(import.meta.url));
const [head, tree] = execFileSync("git", ["rev-parse", "HEAD", "HEAD^{tree}"], { cwd, encoding: "utf8" }).trim().split("\n");
if (head !== "87de73785d1c309bbbe975636414f70bbc73a4b9") throw new Error("Unexpected phase baseline HEAD");
const argv = [
  "--timeout", "900", "/tmp/rpg-zzu-life-full-qa-01a0727b.lock",
  "timeout", "--signal=TERM", "--kill-after=15s", "1200s",
  "npm", "run", "gates", "--", "--json",
];
const started = new Date().toISOString();
console.log("BASE_FULL_GATES_START");
const result = spawnSync("flock", argv, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const receipt = {
  cwd, head, tree, command: ["flock", ...argv], started,
  finished: new Date().toISOString(), exit: result.status, signal: result.signal,
  error: result.error?.message, stdout: result.stdout ?? "", stderr: result.stderr ?? "",
};
await writeFile(join(out, "base-full-gates.json"), `${JSON.stringify(receipt, null, 2)}\n`);
if (!result.error && !result.signal && (result.status === 0 || result.status === 1)) {
  const report = await readFile(join(cwd, ".omo/gates-vitest-report.json"));
  await writeFile(join(out, "base-full-vitest.json"), report);
}
process.stdout.write(receipt.stdout);
process.stderr.write(receipt.stderr);
console.log(`BASE_FULL_GATES_END exit=${receipt.exit} signal=${receipt.signal}`);
process.exitCode = result.status ?? 1;
