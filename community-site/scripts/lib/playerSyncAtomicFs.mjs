import { lstat, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { containedPath } from "./playerSyncPaths.mjs";
import { PlayerArtifactSyncError, syncFail } from "./playerSyncError.mjs";

export { PLAYER_INSTALL_GUARD, withPlayerInstallGuard } from "./playerSyncGuard.mjs";
export const PLAYER_SYNC_FS = Object.freeze({ lstat, readdir, rename, rm });

export async function cleanInterruptedPlayerTemps({ paths, adapters }) {
  const targetParent = path.dirname(paths.targetRoot);
  const lockParent = path.dirname(paths.lockPath);
  const targetBase = path.basename(paths.targetRoot);
  const lockBase = path.basename(paths.lockPath);
  const targetEntries = await adapters.readdir(targetParent);
  const lockEntries = lockParent === targetParent
    ? targetEntries
    : await adapters.readdir(lockParent);
  const targetBackups = targetEntries.filter((name) => name.startsWith(`.${targetBase}.backup-`));
  const lockBackups = lockEntries.filter((name) => name.startsWith(`.${lockBase}.backup-`));
  if (targetBackups.length > 1 || lockBackups.length > 1) {
    syncFail("transaction-residue", "a prior player replacement has ambiguous backups");
  }
  await restoreInterruptedEntry({
    current: paths.targetRoot,
    backupName: targetBackups[0],
    parent: targetParent,
    directory: true,
  });
  await restoreInterruptedEntry({
    current: paths.lockPath,
    backupName: lockBackups[0],
    parent: lockParent,
    directory: false,
  });
  await removeStagedEntries({ entries: targetEntries, base: targetBase, parent: targetParent, directory: true, adapters });
  await removeStagedEntries({ entries: lockEntries, base: lockBase, parent: lockParent, directory: false, adapters });
}

export async function atomicReplacePlayerInstall(options) {
  const targetParent = path.dirname(options.paths.targetRoot);
  const lockParent = path.dirname(options.paths.lockPath);
  const targetBackup = backupPath(targetParent, options.paths.targetRoot, options.transactionId, "target backup");
  const lockBackup = backupPath(lockParent, options.paths.lockPath, options.transactionId, "lock backup");
  try {
    if (options.targetExists) await options.adapters.rename(options.paths.targetRoot, targetBackup);
    await options.adapters.rename(options.stagedTarget, options.paths.targetRoot);
    if (options.lockExists) await options.adapters.rename(options.paths.lockPath, lockBackup);
    await options.adapters.rename(options.stagedLock, options.paths.lockPath);
  } catch {
    const recovered = await rollbackPlayerInstall({ ...options, targetBackup, lockBackup });
    if (!recovered) {
      throw new PlayerArtifactSyncError("install-rollback-failed", "player installation failed and requires recovery");
    }
    throw new PlayerArtifactSyncError("install-replace-failed", "player installation replacement failed");
  }
  await removeBestEffort(targetBackup, true);
  await removeBestEffort(lockBackup, false);
}

async function rollbackPlayerInstall(options) {
  try {
    await reconcileEntry({
      current: options.paths.lockPath,
      backup: options.lockBackup,
      staged: options.stagedLock,
      hadPrior: options.lockExists,
      directory: false,
    });
    await reconcileEntry({
      current: options.paths.targetRoot,
      backup: options.targetBackup,
      staged: options.stagedTarget,
      hadPrior: options.targetExists,
      directory: true,
    });
    return true;
  } catch {
    return false;
  }
}

async function reconcileEntry({ current, backup, staged, hadPrior, directory }) {
  const backupExists = await nativePathExists(backup);
  if (backupExists) {
    await removeNative(current, directory);
    await rename(backup, current);
  } else if (!hadPrior) {
    await removeNative(current, directory);
  }
  await removeNative(staged, directory);
}

async function restoreInterruptedEntry({ current, backupName, parent, directory }) {
  if (backupName === undefined) return;
  const backup = containedPath({
    root: parent,
    candidate: path.join(parent, backupName),
    label: "interrupted backup",
  });
  await removeNative(current, directory);
  await rename(backup, current);
}

async function removeStagedEntries({ entries, base, parent, directory, adapters }) {
  for (const name of entries.filter((entry) => entry.startsWith(`.${base}.install-`))) {
    const stalePath = containedPath({
      root: parent,
      candidate: path.join(parent, name),
      label: "stale install temp",
    });
    await adapters.rm(stalePath, directory ? { recursive: true, force: true } : { force: true });
  }
}

function backupPath(parent, current, transactionId, label) {
  return containedPath({
    root: parent,
    candidate: path.join(parent, `.${path.basename(current)}.backup-${transactionId}`),
    label,
  });
}

async function nativePathExists(target) {
  try {
    await lstat(target);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function removeNative(target, directory) {
  const safeTarget = directory
    ? containedPath({ root: path.dirname(target), candidate: target, label: "transaction directory" })
    : target;
  await rm(safeTarget, directory ? { recursive: true, force: true } : { force: true });
}

async function removeBestEffort(target, directory) {
  try {
    await removeNative(target, directory);
  } catch {
    // A committed install is valid even if obsolete backup cleanup is deferred.
  }
}
