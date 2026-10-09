import { randomUUID } from "node:crypto";
import {
  copyFile,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { collectFileRecords } from "../../../scripts/lib/playerArtifactContract.mjs";
import {
  atomicReplacePlayerInstall,
  cleanInterruptedPlayerTemps,
  withPlayerInstallGuard,
} from "./playerSyncAtomicFs.mjs";
import { createPlayerArtifactLock, parsePlayerArtifactLock } from "./playerSyncLock.mjs";
import { containedPath } from "./playerSyncPaths.mjs";
import { PlayerArtifactSyncError } from "./playerSyncError.mjs";
import { assertExactRecords } from "./playerSyncVerification.mjs";

const DEFAULT_ADAPTERS = Object.freeze({
  collectFileRecords,
  copyFile,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  serializeLock: (value) => `${JSON.stringify(value, null, 2)}\n`,
});

export async function installVerifiedPlayerArtifact(options) {
  const adapters = Object.freeze({ ...DEFAULT_ADAPTERS, ...options.adapters });
  try {
    const transactionId = safeTransactionId(options.transactionId ?? randomUUID());
    return await withPlayerInstallGuard({
      paths: options.paths,
      adapters,
      operation: async () => installWithGuard({ ...options, adapters, transactionId }),
    });
  } catch (error) {
    if (error instanceof PlayerArtifactSyncError) throw error;
    throw new PlayerArtifactSyncError("install-failed", "player installation failed");
  }
}

async function installWithGuard(options) {
  const targetParent = path.dirname(options.paths.targetRoot);
  const lockParent = path.dirname(options.paths.lockPath);
  await options.adapters.mkdir(targetParent, { recursive: true });
  await options.adapters.mkdir(lockParent, { recursive: true });
  await cleanInterruptedPlayerTemps({ paths: options.paths, adapters: options.adapters });
  const stagedTarget = containedPath({
    root: targetParent,
    candidate: path.join(targetParent, `.${path.basename(options.paths.targetRoot)}.install-${options.transactionId}`),
    label: "staged target",
  });
  const stagedLock = containedPath({
    root: lockParent,
    candidate: path.join(lockParent, `.${path.basename(options.paths.lockPath)}.install-${options.transactionId}`),
    label: "staged lock",
  });
  try {
    await options.adapters.mkdir(stagedTarget);
    await copyManifestFiles({
      artifactRoot: options.paths.artifactRoot,
      stagedTarget,
      files: options.verifiedBuild.manifest.files,
      adapters: options.adapters,
    });
    const stagedFiles = await options.adapters.collectFileRecords(stagedTarget);
    assertExactRecords({
      expected: options.verifiedBuild.manifest.files,
      actual: stagedFiles,
      code: "staged-artifact-invalid",
      message: "staged player files failed exact-set rehash verification",
    });
    const lock = createPlayerArtifactLock({
      manifest: options.verifiedBuild.manifest,
      installedAt: options.installedAt ?? new Date().toISOString(),
    });
    parsePlayerArtifactLock(lock);
    await writeStagedLock({ stagedLock, lock, adapters: options.adapters });
    await atomicReplacePlayerInstall({
      paths: options.paths,
      stagedTarget,
      stagedLock,
      transactionId: options.transactionId,
      targetExists: await pathExists(options.paths.targetRoot, options.adapters),
      lockExists: await pathExists(options.paths.lockPath, options.adapters),
      adapters: options.adapters,
    });
    return Object.freeze({ lock, installedFiles: stagedFiles });
  } catch (error) {
    await cleanupStaged({ targetParent, stagedTarget, stagedLock });
    if (error instanceof PlayerArtifactSyncError) throw error;
    throw new PlayerArtifactSyncError("install-failed", "player installation failed");
  }
}

async function copyManifestFiles({ artifactRoot, stagedTarget, files, adapters }) {
  for (const file of files) {
    const source = containedPath({ root: artifactRoot, candidate: path.join(artifactRoot, file.path), label: "artifact file" });
    const destination = containedPath({ root: stagedTarget, candidate: path.join(stagedTarget, file.path), label: "staged file" });
    await adapters.mkdir(path.dirname(destination), { recursive: true });
    await adapters.copyFile(source, destination);
  }
}

async function writeStagedLock({ stagedLock, lock, adapters }) {
  let handle;
  try {
    const payload = adapters.serializeLock(lock);
    if (typeof payload !== "string") throw new TypeError("lock serializer returned non-text");
    handle = await adapters.open(stagedLock, "wx", 0o600);
    await handle.writeFile(payload, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
  } catch {
    if (handle !== undefined) {
      try {
        await handle.close();
      } catch {
        // The outward lock error remains typed and value-free.
      }
    }
    throw new PlayerArtifactSyncError("lock-write-failed", "player artifact lock staging failed");
  }
}

async function pathExists(target, adapters) {
  try {
    await adapters.lstat(target);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function cleanupStaged({ targetParent, stagedTarget, stagedLock }) {
  try {
    await rm(containedPath({ root: targetParent, candidate: stagedTarget, label: "staged target cleanup" }), {
      recursive: true,
      force: true,
    });
  } catch {
    // Best effort; the typed installation failure remains authoritative.
  }
  try {
    await rm(stagedLock, { force: true });
  } catch {
    // Best effort; the typed installation failure remains authoritative.
  }
}

function safeTransactionId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9-]{1,80}$/u.test(value)) {
    throw new PlayerArtifactSyncError("transaction-id-invalid", "player transaction id is malformed");
  }
  return value;
}
