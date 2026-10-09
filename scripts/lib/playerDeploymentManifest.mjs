import { readFile } from "node:fs/promises";
import path from "node:path";
import runtimeAssetInventory from "../../src/player/runtimeAssets.json" with { type: "json" };
import {
  PLAYER_ARTIFACT_CONTRACT,
  assertSecretScanClean,
  assertUniquePlayerPaths,
  collectFileRecords,
  collectListedFileRecords,
  collectSourceInputRecords,
  normalizeRelativePath,
  replaceManifestAtomically,
  scanSecretShapedFiles,
} from "./playerArtifactContract.mjs";
import { contractFail } from "./playerContractCore.mjs";
import {
  PLAYER_DEPLOYMENT_CONTRACT,
  createPlayerDeploymentManifest,
} from "./playerDeploymentContract.mjs";

export {
  PLAYER_DEPLOYMENT_CONTRACT,
  createPlayerDeploymentManifest,
  parsePlayerDeploymentManifest,
} from "./playerDeploymentContract.mjs";
export { verifyViteDeploymentClosure } from "./playerViteClosure.mjs";

export const PLAYER_RUNTIME_ASSET_PATHS = parseRuntimeAssetInventory(runtimeAssetInventory);

export async function writePlayerDeploymentManifest(options) {
  const manifestPath = options.manifestPath
    ?? path.join(options.artifactRoot, PLAYER_ARTIFACT_CONTRACT.manifestFile);
  const manifestRelativePath = normalizeRelativePath(path.relative(options.artifactRoot, manifestPath));
  const files = await collectFileRecords(options.artifactRoot, { excludePaths: [manifestRelativePath] });
  assertSecretScanClean(await scanSecretShapedFiles({ root: options.artifactRoot, files }));
  const sourceInputs = await collectSourceInputRecords(options.repoRoot, { inventory: options.sourceInventory });
  const runtimeAssetRoot = options.runtimeAssetRoot ?? path.join(options.repoRoot, "public");
  const runtimeAssets = await collectListedFileRecords(
    runtimeAssetRoot,
    options.runtimeAssetPaths ?? PLAYER_RUNTIME_ASSET_PATHS,
  );
  assertSecretScanClean(await scanSecretShapedFiles({ root: runtimeAssetRoot, files: runtimeAssets }));
  const viteManifestValue = await readViteManifest(options.artifactRoot);
  const manifest = createPlayerDeploymentManifest({
    files,
    sourceInputs,
    runtimeAssets,
    viteManifestValue,
    sourceRevision: options.sourceRevision,
    builtAt: options.builtAt,
  });
  await replaceManifestAtomically({ manifestPath, manifest, atomicFileOps: options.atomicFileOps });
  return manifest;
}

async function readViteManifest(artifactRoot) {
  try {
    const manifestPath = path.resolve(artifactRoot, PLAYER_DEPLOYMENT_CONTRACT.viteManifest);
    return JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    contractFail("vite-manifest-unreadable", "Vite player manifest is missing or unreadable");
  }
}

function parseRuntimeAssetInventory(value) {
  if (
    !value
    || typeof value !== "object"
    || value.schemaVersion !== 1
    || !Array.isArray(value.paths)
    || value.paths.length === 0
  ) {
    contractFail("invalid-inventory", "runtime asset inventory is malformed");
  }
  const paths = value.paths.map(normalizeRelativePath);
  assertUniquePlayerPaths(paths, "runtime asset inventory");
  const sorted = [...paths].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
  if (paths.some((filePath, index) => filePath !== sorted[index])) {
    contractFail("invalid-inventory", "runtime asset inventory must contain sorted normalized paths");
  }
  return Object.freeze(paths);
}
