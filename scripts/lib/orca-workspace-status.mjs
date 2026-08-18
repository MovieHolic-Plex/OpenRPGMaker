// Orca board workspaceStatus lifecycle for agent work windows.
//
// Why: OMO / `npm run wt` open Orca cards but never leave the default
// `in-progress` column. The board then piles every live and abandoned
// window into one status, and the card UI (status + inline-agents)
// re-renders until it breaks. This module is the only place that maps
// create/done/remove/sync onto Orca's four default ids.

export const ORCA_WORKSPACE_STATUS = Object.freeze({
  todo: "todo",
  inProgress: "in-progress",
  inReview: "in-review",
  completed: "completed",
});

export function resolveOrcaCommand(env = process.env) {
  const fromEnv = typeof env.ORCA_CLI_COMMAND === "string" ? env.ORCA_CLI_COMMAND.trim() : "";
  return fromEnv || "orca";
}

export function normalizeWorktreePath(value) {
  return String(value ?? "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/+$/, "");
}

export function repoRootFromGitCommonDir(commonDir) {
  const normalized = normalizeWorktreePath(commonDir);
  if (!normalized) return "";
  if (normalized.endsWith("/.git")) return normalized.slice(0, -5);
  if (normalized.endsWith(".git")) return normalized.slice(0, -4).replace(/\/+$/, "");
  return dirnamePosix(normalized);
}

function dirnamePosix(path) {
  const trimmed = path.replace(/\/+$/, "");
  const index = trimmed.lastIndexOf("/");
  return index <= 0 ? trimmed : trimmed.slice(0, index);
}

export function pathsEqual(left, right) {
  return normalizeWorktreePath(left).toLowerCase() === normalizeWorktreePath(right).toLowerCase();
}

export function parseOrcaEnvelope(payload) {
  if (!payload || typeof payload !== "object") return { ok: false, error: { message: "empty-payload" } };
  if (payload.ok === false) return payload;
  return payload;
}

export function listOrcaWorktreesFromPayload(payload) {
  const parsed = parseOrcaEnvelope(payload);
  const rows = parsed?.result?.worktrees ?? parsed?.worktrees ?? [];
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    id: String(row.id ?? row.worktreeId ?? ""),
    path: normalizeWorktreePath(row.path ?? row.git?.path ?? ""),
    workspaceStatus: typeof row.workspaceStatus === "string" ? row.workspaceStatus : "",
    isMainWorktree: row.isMainWorktree === true,
    displayName: typeof row.displayName === "string" ? row.displayName : "",
    liveTerminalCount: Number(row.liveTerminalCount ?? 0) || 0,
  })).filter((row) => row.id && row.path);
}

export function findOrcaWorktree(orcaWorktrees, path) {
  return orcaWorktrees.find((row) => pathsEqual(row.path, path)) ?? null;
}

/**
 * Decide which Orca `worktree set --workspace-status` calls to make.
 * Never mutates the main checkout unless `includeMain` is true.
 */
export function planOrcaWorkspaceStatusActions({
  command,
  targetPath,
  repoRoot,
  orcaWorktrees = [],
  missingPaths = [],
  includeMain = false,
} = {}) {
  const actions = [];
  const missing = new Set(missingPaths.map(normalizeWorktreePath));
  const repo = normalizeWorktreePath(repoRoot);

  const pushSet = (worktree, status, reason) => {
    if (!worktree?.id) return;
    const isMain = worktree.isMainWorktree || (repo && pathsEqual(worktree.path, repo));
    if (isMain && !includeMain) {
      actions.push({ type: "skip", reason: "main-protected", path: worktree.path, worktree: worktree.id });
      return;
    }
    if (worktree.workspaceStatus === status) {
      actions.push({ type: "skip", reason: "already-set", path: worktree.path, worktree: worktree.id, status });
      return;
    }
    actions.push({
      type: "set",
      worktree: worktree.id,
      path: worktree.path,
      status,
      reason,
    });
  };

  if (command === "create" || command === "setup" || command === "done" || command === "remove" || command === "archive") {
    const status = command === "create" || command === "setup"
      ? ORCA_WORKSPACE_STATUS.inProgress
      : ORCA_WORKSPACE_STATUS.completed;
    const found = findOrcaWorktree(orcaWorktrees, targetPath);
    if (!found) {
      actions.push({ type: "skip", reason: "not-registered", path: normalizeWorktreePath(targetPath) });
      return actions;
    }
    pushSet(found, status, command);
    return actions;
  }

  if (command === "sync") {
    for (const worktree of orcaWorktrees) {
      if (missing.has(normalizeWorktreePath(worktree.path))) {
        pushSet(worktree, ORCA_WORKSPACE_STATUS.completed, "missing-path");
      }
    }
    return actions;
  }

  actions.push({ type: "skip", reason: "unknown-command", command: String(command ?? "") });
  return actions;
}

export function formatOrcaStatusPlan(actions) {
  return actions.map((action) => {
    if (action.type === "set") {
      return `set ${action.status}  ${action.path}  (${action.reason})`;
    }
    return `skip ${action.reason}  ${action.path ?? action.command ?? ""}`;
  });
}
