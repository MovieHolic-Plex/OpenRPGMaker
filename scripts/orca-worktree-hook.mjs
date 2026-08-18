#!/usr/bin/env node
// Orca repo hook: `orca.yaml` scripts.setup / scripts.archive.
// setup → in-progress, archive → completed. Never fails the Orca lifecycle.
import { syncOrcaWorkspaceStatus, currentWorktreeSelectorPath, resolvePrimaryRepoRoot } from "./lib/orca-workspace-status-cli.mjs";

const hook = process.argv[2];
if (hook !== "setup" && hook !== "archive") {
  console.error("사용: orca-worktree-hook.mjs <setup|archive>");
  process.exit(0);
}

const targetPath = currentWorktreeSelectorPath();
const repoRoot = resolvePrimaryRepoRoot();
syncOrcaWorkspaceStatus({
  command: hook,
  targetPath,
  repoRoot,
});
