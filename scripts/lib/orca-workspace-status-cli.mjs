// Best-effort Orca CLI adapter. A missing or unreachable Orca must never
// fail `npm run wt` — the git worktree is still valid without a board card.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import {
  findOrcaWorktree,
  formatOrcaStatusPlan,
  listOrcaWorktreesFromPayload,
  normalizeWorktreePath,
  planOrcaWorkspaceStatusActions,
  repoRootFromGitCommonDir,
  resolveOrcaCommand,
} from "./orca-workspace-status.mjs";

const ORCA_TIMEOUT_MS = 15_000;

export function runOrcaJson(args, { env = process.env, execFile = execFileSync, command = resolveOrcaCommand(env) } = {}) {
  try {
    const stdout = execFile(command, [...args, "--json"], {
      encoding: "utf8",
      timeout: ORCA_TIMEOUT_MS,
      windowsHide: true,
      env,
    });
    return JSON.parse(String(stdout ?? ""));
  } catch (error) {
    const stdout = error?.stdout ? String(error.stdout) : "";
    if (stdout.trim().startsWith("{")) {
      try {
        return JSON.parse(stdout);
      } catch {
        // fall through
      }
    }
    return {
      ok: false,
      error: {
        code: error?.code ?? "orca_unavailable",
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export function loadOrcaWorktrees(options = {}) {
  const payload = runOrcaJson(["worktree", "list"], options);
  if (payload?.ok === false) return { ok: false, worktrees: [], error: payload.error };
  return { ok: true, worktrees: listOrcaWorktreesFromPayload(payload), error: null };
}

export function applyOrcaWorkspaceStatus(actions, options = {}) {
  const applied = [];
  for (const action of actions) {
    if (action.type !== "set") {
      applied.push({ ...action, ok: true });
      continue;
    }
    const payload = runOrcaJson(
      ["worktree", "set", "--worktree", `id:${action.worktree}`, "--workspace-status", action.status],
      options,
    );
    applied.push({
      ...action,
      ok: payload?.ok !== false,
      error: payload?.ok === false ? payload.error : null,
    });
  }
  return applied;
}

export function syncOrcaWorkspaceStatus({
  command,
  targetPath,
  repoRoot,
  includeMain = false,
  exists = existsSync,
  log = console,
  ...orcaOptions
} = {}) {
  const loaded = loadOrcaWorktrees(orcaOptions);
  if (!loaded.ok) {
    log.warn?.(`[orca-status] skip: ${loaded.error?.message ?? "orca unavailable"}`);
    return { ok: false, actions: [], applied: [] };
  }
  const missingPaths = loaded.worktrees
    .filter((worktree) => !exists(worktree.path))
    .map((worktree) => worktree.path);
  const actions = planOrcaWorkspaceStatusActions({
    command,
    targetPath,
    repoRoot,
    orcaWorktrees: loaded.worktrees,
    missingPaths,
    includeMain,
  });
  const applied = applyOrcaWorkspaceStatus(actions, orcaOptions);
  for (const line of formatOrcaStatusPlan(applied)) {
    log.log?.(`[orca-status] ${line}`);
  }
  return { ok: true, actions, applied };
}

export function resolveAgentWorktreePath(name, { repoRoot, repoName = basename(repoRoot), homedir: home = homedir(), exists = existsSync } = {}) {
  if (!name) return null;
  const candidates = [
    join(dirname(repoRoot), `${repoName}-${name}`),
    join(home, "orca", "workspaces", repoName, name),
  ];
  for (const candidate of candidates) {
    if (exists(candidate)) return candidate;
  }
  return candidates[0];
}

export function currentWorktreeSelectorPath({ cwd = process.cwd(), env = process.env } = {}) {
  const fromEnv = typeof env.ORCA_WORKTREE_ID === "string" ? env.ORCA_WORKTREE_ID : "";
  const separator = fromEnv.indexOf("::");
  if (separator > 0) return fromEnv.slice(separator + 2);
  return cwd;
}

export function findRegisteredPath(path, orcaWorktrees) {
  return findOrcaWorktree(orcaWorktrees, normalizeWorktreePath(path));
}

export function resolvePrimaryRepoRoot(cwd = process.cwd(), { execFile = execFileSync } = {}) {
  try {
    const common = execFile("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
      cwd,
      encoding: "utf8",
      windowsHide: true,
    }).trim();
    return repoRootFromGitCommonDir(common) || cwd;
  } catch {
    return cwd;
  }
}
