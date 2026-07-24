import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PLAYER_SOURCE_INPUT_INVENTORY,
  assertSecretScanClean,
  collectFileRecords,
  collectListedFileRecords,
  collectSourceInputRecords,
  compareExactFileSet,
  digestFileRecords,
  normalizeRelativePath,
  scanSecretShapedFiles,
} from "../../../scripts/lib/playerArtifactContract.mjs";
import { parsePlayerDeploymentManifest } from "../../../scripts/lib/playerDeploymentManifest.mjs";
import { assertLockMatchesManifest, parsePlayerArtifactLock } from "./playerSyncLock.mjs";
import { PlayerArtifactSyncError, redactSyncFailure } from "./playerSyncError.mjs";

const DEFAULT_ADAPTERS = Object.freeze({
  readText: (filePath) => readFile(filePath, "utf8"),
  parseJson: (text) => JSON.parse(text),
  collectFileRecords,
  collectListedFileRecords,
  collectSourceInputRecords,
  scanSecretShapedFiles,
});

export async function readVerifiedPlayerBuild(options) {
  const adapters = Object.freeze({ ...DEFAULT_ADAPTERS, ...options.adapters });
  const manifestValue = await readJson({
    filePath: options.paths.manifestPath,
    adapters,
    code: "built-manifest-invalid",
    message: "built player manifest is missing or malformed",
  });
  const viteManifestPath = path.join(options.paths.artifactRoot, "player-manifest.json");
  const viteManifestValue = await readJson({
    filePath: viteManifestPath,
    adapters,
    code: "built-manifest-invalid",
    message: "built Vite manifest is missing or malformed",
  });
  const manifest = await redactSyncFailure({
    code: "built-manifest-invalid",
    message: "built player manifest violates the deployment contract",
    operation: async () => parsePlayerDeploymentManifest(manifestValue, { viteManifestValue }),
  });
  const manifestRelativePath = normalizeRelativePath(
    path.relative(options.paths.artifactRoot, options.paths.manifestPath),
  );
  const artifactFiles = await redactSyncFailure({
    code: "built-artifact-invalid",
    message: "built player artifact inventory is unavailable",
    operation: () => adapters.collectFileRecords(options.paths.artifactRoot, {
      excludePaths: [manifestRelativePath],
    }),
  });
  assertExactRecords({
    expected: manifest.files,
    actual: artifactFiles,
    code: "built-artifact-stale",
    message: "built player files do not match their manifest",
  });
  await assertScanClean({
    root: options.paths.artifactRoot,
    files: artifactFiles,
    adapters,
    code: "built-artifact-unsafe",
    message: "built player failed the redacted release scan",
  });
  const sourceInputs = await redactSyncFailure({
    code: "source-input-invalid",
    message: "current player source inventory is unavailable",
    operation: () => adapters.collectSourceInputRecords(options.paths.repoRoot, {
      inventory: options.sourceInventory ?? PLAYER_SOURCE_INPUT_INVENTORY,
    }),
  });
  assertExactRecords({
    expected: manifest.sourceInputs,
    actual: sourceInputs,
    code: "source-digest-stale",
    message: "built player does not match current source bytes",
  });
  const runtimeAssets = await redactSyncFailure({
    code: "runtime-assets-invalid",
    message: "runtime asset inventory is unavailable",
    operation: () => adapters.collectListedFileRecords(
      options.paths.runtimeAssetRoot,
      manifest.deployment.runtimeAssets.map((entry) => entry.path),
    ),
  });
  assertExactRecords({
    expected: manifest.deployment.runtimeAssets,
    actual: runtimeAssets,
    code: "runtime-assets-stale",
    message: "runtime assets do not match the built deployment contract",
  });
  await assertScanClean({
    root: options.paths.runtimeAssetRoot,
    files: runtimeAssets,
    adapters,
    code: "runtime-assets-unsafe",
    message: "runtime assets failed the redacted release scan",
  });
  return Object.freeze({ manifest, artifactFiles, sourceInputs, runtimeAssets });
}

export async function verifyInstalledPlayerArtifact(options) {
  const adapters = Object.freeze({ ...DEFAULT_ADAPTERS, ...options.adapters });
  const installedFiles = await redactSyncFailure({
    code: "installed-artifact-invalid",
    message: "installed player inventory is unavailable",
    operation: () => adapters.collectFileRecords(options.paths.targetRoot),
  });
  assertExactRecords({
    expected: options.verifiedBuild.manifest.files,
    actual: installedFiles,
    code: "installed-artifact-stale",
    message: "installed player files do not match the current build",
  });
  await assertScanClean({
    root: options.paths.targetRoot,
    files: installedFiles,
    adapters,
    code: "installed-artifact-unsafe",
    message: "installed player failed the redacted release scan",
  });
  const lockValue = await readJson({
    filePath: options.paths.lockPath,
    adapters,
    code: "lock-invalid",
    message: "installed player lock is missing or malformed",
  });
  const lock = await redactSyncFailure({
    code: "lock-invalid",
    message: "installed player lock is missing or malformed",
    operation: async () => parsePlayerArtifactLock(lockValue),
  });
  assertLockMatchesManifest({ lock, manifest: options.verifiedBuild.manifest });
  return Object.freeze({ lock, installedFiles });
}

export function assertExactRecords({ expected, actual, code, message }) {
  const issues = compareExactFileSet(expected, actual);
  if (issues.length > 0 || digestFileRecords(expected) !== digestFileRecords(actual)) {
    throw new PlayerArtifactSyncError(code, message);
  }
}

async function readJson({ filePath, adapters, code, message }) {
  const text = await redactSyncFailure({
    code,
    message,
    operation: () => adapters.readText(filePath),
  });
  return redactSyncFailure({
    code,
    message,
    operation: async () => adapters.parseJson(text),
  });
}

async function assertScanClean({ root, files, adapters, code, message }) {
  return redactSyncFailure({
    code,
    message,
    operation: async () => {
      const findings = await adapters.scanSecretShapedFiles({ root, files });
      assertSecretScanClean(findings);
    },
  });
}
