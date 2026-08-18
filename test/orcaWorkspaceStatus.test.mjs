import assert from "node:assert/strict";
import { test } from "node:test";
import {
  listOrcaWorktreesFromPayload,
  planOrcaWorkspaceStatusActions,
  repoRootFromGitCommonDir,
  resolveOrcaCommand,
} from "../scripts/lib/orca-workspace-status.mjs";

const BOUNDED = { timeout: 5_000 };

const MAIN = {
  id: "repo::/repo/rpg-zzu",
  path: "/repo/rpg-zzu",
  workspaceStatus: "in-progress",
  isMainWorktree: true,
};
const CHILD = {
  id: "repo::/repo/rpg-zzu-beginner-ui",
  path: "/repo/rpg-zzu-beginner-ui",
  workspaceStatus: "in-progress",
  isMainWorktree: false,
};
const GHOST = {
  id: "repo::/repo/rpg-zzu-old",
  path: "/repo/rpg-zzu-old",
  workspaceStatus: "in-progress",
  isMainWorktree: false,
};
const ORCA_CHILD = {
  id: "repo::/home/orca/workspaces/rpg-zzu/probe",
  path: "/home/orca/workspaces/rpg-zzu/probe",
  workspaceStatus: "in-progress",
  isMainWorktree: false,
};

test("ORCA_CLI_COMMAND wins over the bare orca binary", BOUNDED, () => {
  assert.equal(resolveOrcaCommand({ ORCA_CLI_COMMAND: "orca" }), "orca");
  assert.equal(resolveOrcaCommand({ ORCA_CLI_COMMAND: "  C:/Tools/orca.exe  " }), "C:/Tools/orca.exe");
  assert.equal(resolveOrcaCommand({}), "orca");
});

test("git common dir maps back to the primary checkout", BOUNDED, () => {
  assert.equal(repoRootFromGitCommonDir("C:/Users/USER/Downloads/rpg-zzu/.git"), "C:/Users/USER/Downloads/rpg-zzu");
  assert.equal(repoRootFromGitCommonDir("C:\\Users\\USER\\Downloads\\rpg-zzu\\.git"), "C:/Users/USER/Downloads/rpg-zzu");
});

test("create / setup mark a registered child in-progress", BOUNDED, () => {
  const already = planOrcaWorkspaceStatusActions({
    command: "create",
    targetPath: CHILD.path,
    repoRoot: MAIN.path,
    orcaWorktrees: [MAIN, CHILD],
  });
  assert.deepEqual(already.map((row) => row.reason), ["already-set"]);

  const setup = planOrcaWorkspaceStatusActions({
    command: "setup",
    targetPath: { ...ORCA_CHILD, workspaceStatus: "todo" }.path,
    repoRoot: MAIN.path,
    orcaWorktrees: [MAIN, { ...ORCA_CHILD, workspaceStatus: "todo" }],
  });
  assert.equal(setup[0].type, "set");
  assert.equal(setup[0].status, "in-progress");
});

test("done / remove / archive complete a child and never the main checkout", BOUNDED, () => {
  const done = planOrcaWorkspaceStatusActions({
    command: "done",
    targetPath: CHILD.path,
    repoRoot: MAIN.path,
    orcaWorktrees: [MAIN, CHILD],
  });
  assert.deepEqual(done, [{
    type: "set",
    worktree: CHILD.id,
    path: CHILD.path,
    status: "completed",
    reason: "done",
  }]);

  const mainDone = planOrcaWorkspaceStatusActions({
    command: "done",
    targetPath: MAIN.path,
    repoRoot: MAIN.path,
    orcaWorktrees: [MAIN, CHILD],
  });
  assert.equal(mainDone[0].reason, "main-protected");

  const archive = planOrcaWorkspaceStatusActions({
    command: "archive",
    targetPath: ORCA_CHILD.path,
    repoRoot: MAIN.path,
    orcaWorktrees: [MAIN, ORCA_CHILD],
  });
  assert.equal(archive[0].status, "completed");
  assert.equal(archive[0].reason, "archive");
});

test("unregistered git worktrees are skipped instead of inventing a card", BOUNDED, () => {
  const planned = planOrcaWorkspaceStatusActions({
    command: "create",
    targetPath: "/repo/rpg-zzu-dev-1",
    repoRoot: MAIN.path,
    orcaWorktrees: [MAIN],
  });
  assert.deepEqual(planned, [{ type: "skip", reason: "not-registered", path: "/repo/rpg-zzu-dev-1" }]);
});

test("sync completes missing-path children and leaves live ones alone", BOUNDED, () => {
  const planned = planOrcaWorkspaceStatusActions({
    command: "sync",
    repoRoot: MAIN.path,
    orcaWorktrees: [MAIN, CHILD, GHOST, ORCA_CHILD],
    missingPaths: [GHOST.path],
  });
  assert.deepEqual(planned.filter((row) => row.type === "set"), [{
    type: "set",
    worktree: GHOST.id,
    path: GHOST.path,
    status: "completed",
    reason: "missing-path",
  }]);
  assert.equal(planned.some((row) => row.path === MAIN.path && row.type === "set"), false);
});

test("worktree list envelope is flattened to id/path/status", BOUNDED, () => {
  const rows = listOrcaWorktreesFromPayload({
    ok: true,
    result: {
      worktrees: [
        { id: "a::/x", path: "C:\\Users\\repo\\", workspaceStatus: "in-progress", isMainWorktree: true },
      ],
    },
  });
  assert.deepEqual(rows, [{
    id: "a::/x",
    path: "C:/Users/repo",
    workspaceStatus: "in-progress",
    isMainWorktree: true,
    displayName: "",
    liveTerminalCount: 0,
  }]);
});
