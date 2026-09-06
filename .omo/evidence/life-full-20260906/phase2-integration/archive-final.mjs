import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const out = dirname(fileURLToPath(import.meta.url));
const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const receipt = JSON.parse(await readFile(join(out, "final-gates.json"), "utf8"));
assert.equal(receipt.head, head);
const bytes = await readFile(".omo/gates-vitest-report.json");
const report = JSON.parse(bytes.toString("utf8"));
assert.equal(report.numTotalTests, 13669);
await writeFile(join(out, "final-full-vitest.json"), bytes, { flag: "wx" });
const manifest = {
  head, archive: "final-full-vitest.json", exactBytes: true,
  bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"),
  total: report.numTotalTests, passed: report.numPassedTests,
  failed: report.numFailedTests, pending: report.numPendingTests,
};
await writeFile(join(out, "final-full-vitest.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify(manifest));
