// Reproducible, test-only verifier-seam mutation proof. No mutation is committed.
// Run only in the isolated clean QA clone, with a unified-diff apply_patch on PATH:
// APPLY_PATCH=/tmp/apply_patch node output/evidence/ai-harness/p1/remote-mutation-check.mjs
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const dir = resolve(root, "output/evidence/ai-harness/p1");
const path = "src/project/store.ts";
const sha = (value) => createHash("sha256").update(value).digest("hex");
const git = (...args) => {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0);
  return result.stdout.trim();
};
assert.equal(git("branch", "--show-current"), "agent/ai-harness-p1-remote-20260906");
assert.equal(git("status", "--porcelain"), "", "Mutation proof requires a clean isolated clone");
const original = readFileSync(path, "utf8");
const receipt = { sourceSha: git("rev-parse", "HEAD"), cleanBefore: true,
  originalStoreSha256: sha(original), mutationMechanism: "temporary single-line verifier-seam changes using apply_patch; exact byte restoration in finally", runs: [] };
const mutations = [
  { name: "content", step: "changed-real-content", expected: "mismatch",
    from: '      if (observedIdentity !== receipt.contentIdentity) return { kind: "mismatch", receipt, reason: "content" };',
    to: '      if (observedIdentity !== receipt.contentIdentity) return { kind: "verified", receipt, isCurrent: this.isPersistenceReceiptCurrent(receipt) };' },
  { name: "transport", step: "injected-transport-503", expected: "failed",
    from: '      return { kind: "failed", receipt, message: error instanceof Error ? error.message : String(error) };',
    to: '      return { kind: "verified", receipt, isCurrent: this.isPersistenceReceiptCurrent(receipt) }; // QA false-verified transport mutation' },
];
function patch(from, to, label) {
  const current = readFileSync(path, "utf8");
  assert.equal(current.split(from).length, 2, "Mutation seam must be unique");
  const line = current.slice(0, current.indexOf(from)).split("\n").length;
  const input = `--- a/${path}\n+++ b/${path}\n@@ -${line},1 +${line},1 @@\n-${from}\n+${to}\n`;
  const result = spawnSync(process.env.APPLY_PATCH ?? "apply_patch", [], { input, cwd: root, encoding: "utf8" });
  writeFileSync(resolve(dir, `remote-mutation-${label}.patch.log`), `${input}\n${result.stdout ?? ""}${result.stderr ?? ""}`);
  assert.equal(result.status, 0, "apply_patch must succeed");
}
function run(stem) {
  const args = ["scripts/qa/ai-harness-remote-proof.mjs", "--create-isolated-project", "--scenario", "all", "--report", `output/evidence/ai-harness/p1/${stem}.json`];
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", timeout: 180_000, maxBuffer: 8 * 1024 * 1024 });
  writeFileSync(resolve(dir, `${stem}.log`), `${result.stdout ?? ""}${result.stderr ?? ""}`);
  writeFileSync(resolve(dir, `${stem}.receipt`), `command=node ${args.join(" ")}\nexit=${result.status}\nsignal=${result.signal ?? "none"}\n`);
  assert.equal(result.error, undefined, "Harness must terminate naturally within the bound");
  assert.equal(result.signal, null);
  return { result, report: JSON.parse(readFileSync(resolve(dir, `${stem}.json`), "utf8")) };
}
try {
  for (const mutation of mutations) {
    try {
      patch(mutation.from, mutation.to, `${mutation.name}-apply`);
      const mutatedHash = sha(readFileSync(path));
      const { result, report } = run(`remote-red-${mutation.name}`);
      assert.equal(result.status, 1, "False verification must be RED");
      assert.equal(report.pass, false);
      assert.equal(report.failure.name, "AssertionError");
      const failed = report.steps.find((entry) => entry.name === mutation.step);
      assert.equal(failed.kind, "verified", "The seeded regression must actually be reached");
      assert.equal(failed.expected, mutation.expected);
      assert.equal(report.storeSourceSha256, mutatedHash);
      assert.ok(["deleted-and-absence-verified", "permission-limited"].includes(report.cleanup.remote.kind));
      receipt.runs.push({ name: mutation.name, sourceSha256: mutatedHash, exit: result.status,
        actual: failed.kind, expected: failed.expected, assertion: report.failure,
        projectId: report.projectId, cleanup: report.cleanup.remote });
    } finally {
      if (readFileSync(path, "utf8") !== original) patch(mutation.to, mutation.from, `${mutation.name}-restore`);
      assert.equal(readFileSync(path, "utf8"), original, "Restore exact original bytes, not merely behavior");
    }
  }
  receipt.restoredStoreSha256 = sha(readFileSync(path));
  receipt.cleanAfterMutations = git("status", "--porcelain") === "";
  assert.equal(receipt.cleanAfterMutations, true);
  const { result, report } = run("remote");
  assert.equal(result.status, 0);
  assert.equal(report.pass, true);
  assert.equal(report.storeSourceSha256, receipt.originalStoreSha256);
  receipt.restoredGreen = { exit: result.status, projectId: report.projectId, sourceSha: report.sourceSha,
    storeSourceSha256: report.storeSourceSha256, cleanup: report.cleanup.remote };
  receipt.pass = true;
} finally {
  receipt.restored = readFileSync(path, "utf8") === original;
  writeFileSync(resolve(dir, "remote-mutation.json"), JSON.stringify(receipt, null, 2) + "\n");
}
console.log(JSON.stringify(receipt, null, 2));
