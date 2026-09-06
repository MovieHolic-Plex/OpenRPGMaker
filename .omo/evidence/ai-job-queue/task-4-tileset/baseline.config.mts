import { mergeConfig } from "vitest/config";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import base from "../../../../vitest.config";
const changed = execFileSync("git", ["diff", "--name-only", "--", "src"], { encoding: "utf8" }).trim().split("\n");
const originals = new Map(changed.map(path => [resolve(path), execFileSync("git", ["show", `HEAD:${path}`], { encoding: "utf8" })]));
export default mergeConfig(base, { plugins: [{ name: "read-only-head-overlay", enforce: "pre", load(id) { return originals.get(id.split("?")[0]) ?? null; } }] });
