import {
  assertUniquePlayerPaths,
  createPlayerArtifactManifest,
  digestFileRecords,
  normalizeRelativePath,
  parsePlayerArtifactManifest,
  playerPathCollisionKey,
  validateFileRecords,
} from "./playerArtifactContract.mjs";
import { contractFail, sha256Value } from "./playerContractCore.mjs";
import { verifyViteDeploymentClosure } from "./playerViteClosure.mjs";

export const PLAYER_DEPLOYMENT_CONTRACT = Object.freeze({
  schemaVersion: 1,
  entryHtml: "player.html",
  entryScript: "player.js",
  viteManifest: "player-manifest.json",
});

export function createPlayerDeploymentManifest({
  files,
  sourceInputs,
  runtimeAssets,
  viteManifestValue,
  sourceRevision = "unknown",
  builtAt = new Date().toISOString(),
  entryHtml = PLAYER_DEPLOYMENT_CONTRACT.entryHtml,
  entryScript = PLAYER_DEPLOYMENT_CONTRACT.entryScript,
  viteManifest = PLAYER_DEPLOYMENT_CONTRACT.viteManifest,
}) {
  const manifest = createPlayerArtifactManifest({ files, sourceInputs, sourceRevision, builtAt });
  const safeRuntimeAssets = validateFileRecords(runtimeAssets, "runtimeAssets", { requireSorted: true });
  assertDisjointPathSets(manifest.files.map((file) => file.path), safeRuntimeAssets.map((file) => file.path));
  const safeEntryHtml = normalizeRelativePath(entryHtml);
  const safeEntryScript = normalizeRelativePath(entryScript);
  const safeViteManifest = normalizeRelativePath(viteManifest);
  assertCanonicalEntries(safeEntryHtml, safeEntryScript, safeViteManifest);
  verifyViteDeploymentClosure({
    artifactFiles: manifest.files,
    viteManifestValue,
    entryHtml: safeEntryHtml,
    entryScript: safeEntryScript,
    viteManifest: safeViteManifest,
  });
  const runtimeAssetDigest = digestFileRecords(safeRuntimeAssets);
  const deployment = Object.freeze({
    schemaVersion: PLAYER_DEPLOYMENT_CONTRACT.schemaVersion,
    entryHtml: safeEntryHtml,
    entryScript: safeEntryScript,
    viteManifest: safeViteManifest,
    artifactPaths: Object.freeze(manifest.files.map((file) => file.path)),
    runtimeAssets: safeRuntimeAssets,
    runtimeAssetDigest,
    deploymentDigest: deploymentDigest({
      artifactDigest: manifest.artifactDigest,
      runtimeAssetDigest,
      entryHtml: safeEntryHtml,
      entryScript: safeEntryScript,
      viteManifest: safeViteManifest,
    }),
  });
  return Object.freeze({ ...manifest, deployment });
}

export function parsePlayerDeploymentManifest(value, options = {}) {
  const manifest = parsePlayerArtifactManifest(value);
  const deployment = manifest.deployment;
  if (!deployment || typeof deployment !== "object" || Array.isArray(deployment)) {
    contractFail("deployment-malformed", "deployment contract is missing or malformed");
  }
  if (deployment.schemaVersion !== PLAYER_DEPLOYMENT_CONTRACT.schemaVersion) {
    contractFail("deployment-schema-mismatch", "deployment schema version mismatch");
  }
  const entryHtml = normalizeRelativePath(deployment.entryHtml);
  const entryScript = normalizeRelativePath(deployment.entryScript);
  const viteManifest = normalizeRelativePath(deployment.viteManifest);
  if (entryHtml !== deployment.entryHtml || entryScript !== deployment.entryScript || viteManifest !== deployment.viteManifest) {
    contractFail("deployment-malformed", "deployment entry paths must be normalized");
  }
  assertCanonicalEntries(entryHtml, entryScript, viteManifest);
  const artifactPaths = validatedPathList(deployment.artifactPaths, "artifactPaths");
  if (!samePaths(artifactPaths, manifest.files.map((file) => file.path))) {
    contractFail("deployment-file-set-mismatch", "deployment artifact paths do not match manifest files");
  }
  const runtimeAssets = validateFileRecords(deployment.runtimeAssets, "runtimeAssets", { requireSorted: true });
  assertDisjointPathSets(manifest.files.map((file) => file.path), runtimeAssets.map((file) => file.path));
  const runtimeAssetDigest = digestFileRecords(runtimeAssets);
  if (deployment.runtimeAssetDigest !== runtimeAssetDigest) {
    contractFail("runtime-asset-digest-mismatch", "runtime asset digest is inconsistent");
  }
  const expectedDeploymentDigest = deploymentDigest({
    artifactDigest: manifest.artifactDigest,
    runtimeAssetDigest,
    entryHtml,
    entryScript,
    viteManifest,
  });
  if (deployment.deploymentDigest !== expectedDeploymentDigest) {
    contractFail("deployment-digest-mismatch", "deployment digest is inconsistent");
  }
  if (options.viteManifestValue !== undefined) {
    verifyViteDeploymentClosure({
      artifactFiles: manifest.files,
      viteManifestValue: options.viteManifestValue,
      entryHtml,
      entryScript,
      viteManifest,
    });
  }
  return Object.freeze({
    ...manifest,
    deployment: Object.freeze({
      schemaVersion: deployment.schemaVersion,
      entryHtml,
      entryScript,
      viteManifest,
      artifactPaths,
      runtimeAssets,
      runtimeAssetDigest,
      deploymentDigest: expectedDeploymentDigest,
    }),
  });
}

function assertCanonicalEntries(entryHtml, entryScript, viteManifest) {
  if (
    entryHtml !== PLAYER_DEPLOYMENT_CONTRACT.entryHtml
    || entryScript !== PLAYER_DEPLOYMENT_CONTRACT.entryScript
    || viteManifest !== PLAYER_DEPLOYMENT_CONTRACT.viteManifest
  ) {
    contractFail("deployment-entry-mismatch", "deployment entry paths do not match the current contract");
  }
}

function validatedPathList(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    contractFail("deployment-malformed", `${label} must be a non-empty array`);
  }
  const paths = value.map(normalizeRelativePath);
  assertUniquePlayerPaths(paths, label);
  const sorted = [...paths].sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
  if (paths.some((filePath, index) => filePath !== sorted[index])) {
    contractFail("deployment-malformed", `${label} must contain sorted paths`);
  }
  return Object.freeze(paths);
}

function assertDisjointPathSets(left, right) {
  const keys = new Set(left.map(playerPathCollisionKey));
  if (right.some((filePath) => keys.has(playerPathCollisionKey(filePath)))) {
    contractFail("duplicate-path", "artifact and runtime asset paths collide");
  }
}

function samePaths(left, right) {
  return left.length === right.length && left.every((filePath, index) => filePath === right[index]);
}

function deploymentDigest({ artifactDigest, runtimeAssetDigest, entryHtml, entryScript, viteManifest }) {
  return sha256Value(JSON.stringify({ artifactDigest, runtimeAssetDigest, entryHtml, entryScript, viteManifest }));
}
