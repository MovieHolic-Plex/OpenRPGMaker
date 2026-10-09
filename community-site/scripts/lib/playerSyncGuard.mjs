import { randomUUID } from "node:crypto";
import { lstat, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { PlayerArtifactSyncError } from "./playerSyncError.mjs";
import { containedPath } from "./playerSyncPaths.mjs";

export const PLAYER_INSTALL_GUARD = Object.freeze({
  sentinel: "rpg-zzu/player-install-guard",
  schemaVersion: 1,
});

export async function withPlayerInstallGuard({ paths, adapters, operation }) {
  const guardPath = containedPath({
    root: paths.siteRoot,
    candidate: path.join(paths.siteRoot, ".player-artifact.sync.lock"),
    label: "install guard",
  });
  const owner = await acquireGuard({ guardPath, adapters });
  try {
    return await operation();
  } finally {
    await removeOwnedGuard({ guardPath, owner, adapters });
  }
}

async function acquireGuard({ guardPath, adapters }) {
  const owner = Object.freeze({
    sentinel: PLAYER_INSTALL_GUARD.sentinel,
    schemaVersion: PLAYER_INSTALL_GUARD.schemaVersion,
    pid: process.pid,
    token: randomUUID(),
    createdAt: new Date().toISOString(),
  });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const acquired = await createGuard({ guardPath, owner, adapters });
    if (acquired !== undefined) return acquired;
    if (attempt > 0 || !(await removeStaleGuard({ guardPath, adapters }))) break;
  }
  throw busyError();
}

async function createGuard({ guardPath, owner, adapters }) {
  let handle;
  let identity;
  try {
    handle = await adapters.open(guardPath, "wx", 0o600);
    identity = identityOf(await handle.stat());
    await handle.writeFile(`${JSON.stringify(owner)}\n`, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    return Object.freeze({ ...owner, identity });
  } catch (error) {
    if (handle !== undefined) await closeBestEffort(handle);
    if (identity !== undefined) {
      await removeOwnedGuard({ guardPath, owner: { ...owner, identity }, adapters });
    }
    if (isErrorCode(error, "EEXIST")) return undefined;
    throw busyError();
  }
}

async function removeStaleGuard({ guardPath, adapters }) {
  const observed = await readGuard({ guardPath, adapters });
  if (observed === undefined || processIsAlive(observed.pid)) return false;
  return removeOwnedGuard({ guardPath, owner: observed, adapters });
}

async function readGuard({ guardPath, adapters }) {
  try {
    const [payload, stats] = await Promise.all([
      adapters.readFile(guardPath, "utf8"),
      adapters.lstat(guardPath),
    ]);
    const record = parseGuard(payload);
    if (record === undefined) return undefined;
    return Object.freeze({ ...record, identity: identityOf(stats) });
  } catch {
    return undefined;
  }
}

async function removeOwnedGuard({ guardPath, owner, adapters }) {
  const current = await readGuard({ guardPath, adapters });
  if (!sameOwner(current, owner)) return false;
  try {
    await adapters.rm(guardPath, { force: true });
    return true;
  } catch {
    const afterFailure = await readGuard({ guardPath, adapters: nativeGuardAdapters });
    if (afterFailure === undefined) return !(await nativePathExists(guardPath));
    if (!sameOwner(afterFailure, owner)) return false;
    try {
      await rm(guardPath, { force: true });
      return true;
    } catch {
      return false;
    }
  }
}

async function nativePathExists(target) {
  try {
    await lstat(target);
    return true;
  } catch (error) {
    return !isErrorCode(error, "ENOENT");
  }
}

function parseGuard(payload) {
  try {
    const value = JSON.parse(payload);
    if (
      value?.sentinel !== PLAYER_INSTALL_GUARD.sentinel
      || value?.schemaVersion !== PLAYER_INSTALL_GUARD.schemaVersion
      || !Number.isSafeInteger(value?.pid)
      || value.pid <= 0
      || typeof value?.token !== "string"
      || value.token.length < 1
      || typeof value?.createdAt !== "string"
    ) return undefined;
    return value;
  } catch {
    return undefined;
  }
}

function sameOwner(left, right) {
  return left !== undefined
    && right !== undefined
    && left.token === right.token
    && left.identity.dev === right.identity.dev
    && left.identity.ino === right.identity.ino;
}

function identityOf(stats) {
  return Object.freeze({ dev: String(stats.dev), ino: String(stats.ino) });
}

function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !isErrorCode(error, "ESRCH");
  }
}

function isErrorCode(error, code) {
  return error instanceof Error && "code" in error && error.code === code;
}

function busyError() {
  return new PlayerArtifactSyncError("install-busy", "another player installation is active");
}

async function closeBestEffort(handle) {
  try {
    await handle.close();
  } catch {
    // Ownership-checked path cleanup handles both open and already-closed handles.
  }
}

const nativeGuardAdapters = Object.freeze({ lstat, readFile, rm });
