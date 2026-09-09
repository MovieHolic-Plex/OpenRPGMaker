import { spawnSync, execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const [name, command, ...args] = process.argv.slice(2);
const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
const out = `.omo/evidence/life-full-20260906/14/${name}`;
writeFileSync(`${out}.txt`, result.stdout + result.stderr);
writeFileSync(`${out}.json`, JSON.stringify({ command: [command, ...args], cwd: process.cwd(), head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), tree: execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim(), exit: result.status, signal: result.signal }, null, 2) + "\n");
console.log(result.stdout + result.stderr);
process.exit(result.status ?? 1);
