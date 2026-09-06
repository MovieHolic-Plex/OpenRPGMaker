import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const cwd = process.cwd();
const out = dirname(fileURLToPath(import.meta.url));
const worktree = "/home/main/z-project/rpg-zzu-life-full-p2-life-full-record-keys";
const git = (args, root = cwd) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
const receipt = { cwd, head: git(["rev-parse", "HEAD"]), removed: [], preservedReceipts: [], worktreeRemoved: false };
try {
  assert.equal(git(["rev-parse", "HEAD"], worktree), "6ac1eedb89c0fcefccfa585d2c00fd8b000daa4b");
  assert.equal(git(["status", "--porcelain=v1", "--untracked-files=all"], worktree), "");
  git(["merge-base", "--is-ancestor", "6ac1eedb89c0fcefccfa585d2c00fd8b000daa4b", "HEAD"]);
  for (const name of ["finite-use/postcommit-index-check.json","finite-use/postcommit-index-check.log","finite-use/postcommit-clean.json","finite-use/correction-commit.json","finite-use/postcommit-clean.log","finite-use/correction-commit.log"]) {
    const relative = ".omo/evidence/life-full-20260906/30/" + name;
    assert.ok(readFileSync(join(worktree, relative)).equals(readFileSync(join(cwd, relative))), name);
    receipt.preservedReceipts.push(name);
  }
  const paths = ["dist", ".omo/evidence/life-full-20260906/phase2-integration/build-cache"];
  for (const relative of paths) {
    if (!existsSync(join(cwd, relative))) continue;
    const stat = lstatSync(join(cwd, relative));
    assert.ok(stat.isDirectory() && !stat.isSymbolicLink(), relative);
    assert.equal(git(["ls-files", "--", relative]), "", relative);
  }
  for (const relative of paths) {
    if (!existsSync(join(cwd, relative))) continue;
    rmSync(join(cwd, relative), { recursive: true });
    assert.equal(existsSync(join(cwd, relative)), false);
    receipt.removed.push(relative);
  }
  git(["worktree", "remove", worktree]);
  assert.equal(existsSync(worktree), false);
  receipt.worktreeRemoved = true;
  receipt.ok = true;
} catch (error) {
  receipt.error = String(error?.stack ?? error);
  process.exitCode = 1;
} finally {
  writeFileSync(join(out, "cleanup.json"), JSON.stringify(receipt, null, 2) + "\n");
  console.log(JSON.stringify(receipt));
}
