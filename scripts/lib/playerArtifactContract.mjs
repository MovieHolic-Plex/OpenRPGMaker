import path from "node:path";
import {
  PLAYER_ARTIFACT_CONTRACT,
  compareContractPaths,
  contractFail,
  digestFileRecords,
  normalizeRelativePath,
  validateFileRecords,
} from "./playerContractCore.mjs";
import {
  assertSecretScanClean,
  collectFileRecords,
  collectSourceInputRecords,
  scanSecretShapedFiles,
} from "./playerArtifactInventory.mjs";
import { replaceManifestAtomically } from "./playerManifestAtomicWriter.mjs";

export {
  PLAYER_ARTIFACT_CONTRACT,
  PlayerArtifactContractError,
  assertUniquePlayerPaths,
  digestFileRecords,
  normalizeRelativePath,
  playerPathCollisionKey,
  validateFileRecords,
} from "./playerContractCore.mjs";
export {
  PLAYER_SOURCE_INPUT_INVENTORY,
  assertSecretScanClean,
  collectFileRecords,
  collectListedFileRecords,
  collectSourceInputRecords,
  scanSecretShapedFiles,
} from "./playerArtifactInventory.mjs";
export { replaceManifestAtomically } from "./playerManifestAtomicWriter.mjs";

export function compareExactFileSet(expected, actual) {
  const expectedMap = new Map(validateFileRecords(expected, "expected files", { allowEmpty: true })
    .map((entry) => [entry.path, entry]));
  const actualMap = new Map(validateFileRecords(actual, "actual files", { allowEmpty: true })
    .map((entry) => [entry.path, entry]));
  const issues = [];
  const paths = [...new Set([...expectedMap.keys(), ...actualMap.keys()])].sort(compareContractPaths);
  for (const filePath of paths) {
    const expectedEntry = expectedMap.get(filePath);
    const actualEntry = actualMap.get(filePath);
    if (!actualEntry) issues.push(Object.freeze({ code: "missing", path: filePath }));
    else if (!expectedEntry) issues.push(Object.freeze({ code: "extra", path: filePath }));
    else if (expectedEntry.bytes !== actualEntry.bytes || expectedEntry.sha256 !== actualEntry.sha256) {
      issues.push(Object.freeze({ code: "tampered", path: filePath }));
    }
  }
  return Object.freeze(issues);
}

export function createPlayerArtifactManifest({
  files,
  sourceInputs,
  sourceRevision = "unknown",
  builtAt = new Date().toISOString(),
}) {
  const safeFiles = validateFileRecords(files, "files");
  const safeSources = validateFileRecords(sourceInputs, "sourceInputs");
  const artifactDigest = digestFileRecords(safeFiles);
  return Object.freeze({
    sentinel: PLAYER_ARTIFACT_CONTRACT.sentinel,
    contractVersion: PLAYER_ARTIFACT_CONTRACT.contractVersion,
    schemaVersion: PLAYER_ARTIFACT_CONTRACT.schemaVersion,
    artifactVersion: artifactDigest.slice(0, 16),
    artifactDigest,
    sourceDigest: digestFileRecords(safeSources),
    sourceRevision,
    builtAt,
    files: safeFiles,
    sourceInputs: safeSources,
  });
}

export function parsePlayerArtifactManifest(value) {
  if (!value || typeof value !== "object") contractFail("malformed-manifest", "manifest must be an object");
  if (value.sentinel !== PLAYER_ARTIFACT_CONTRACT.sentinel) contractFail("sentinel-mismatch", "player artifact manifest sentinel mismatch");
  if (value.contractVersion !== PLAYER_ARTIFACT_CONTRACT.contractVersion) contractFail("contract-version-mismatch", "player artifact contract version mismatch");
  if (value.schemaVersion !== PLAYER_ARTIFACT_CONTRACT.schemaVersion) contractFail("schema-version-mismatch", "player artifact schema version mismatch");
  const files = validateFileRecords(value.files, "files", { requireSorted: true });
  const sourceInputs = validateFileRecords(value.sourceInputs, "sourceInputs", { requireSorted: true });
  const artifactDigest = digestFileRecords(files);
  const sourceDigest = digestFileRecords(sourceInputs);
  if (value.artifactDigest !== artifactDigest || value.artifactVersion !== artifactDigest.slice(0, 16)) {
    contractFail("artifact-digest-mismatch", "manifest artifact digest is inconsistent");
  }
  if (value.sourceDigest !== sourceDigest) contractFail("source-digest-mismatch", "manifest source digest is inconsistent");
  if (
    typeof value.sourceRevision !== "string"
    || value.sourceRevision.length === 0
    || typeof value.builtAt !== "string"
    || Number.isNaN(Date.parse(value.builtAt))
  ) {
    contractFail("malformed-manifest", "manifest provenance is malformed");
  }
  return Object.freeze({ ...value, files, sourceInputs });
}

export function verifyPlayerArtifactManifest({ manifest, artifactFiles, sourceInputs }) {
  const parsed = parsePlayerArtifactManifest(manifest);
  const artifactIssues = [...compareExactFileSet(parsed.files, artifactFiles)];
  const sourceIssues = compareExactFileSet(parsed.sourceInputs, sourceInputs)
    .map((issue) => Object.freeze({ ...issue, code: `source-${issue.code}` }));
  if (digestFileRecords(artifactFiles) !== parsed.artifactDigest) {
    artifactIssues.push(Object.freeze({ code: "artifact-digest-mismatch" }));
  }
  if (digestFileRecords(sourceInputs) !== parsed.sourceDigest) {
    sourceIssues.push(Object.freeze({ code: "source-digest-mismatch" }));
  }
  return Object.freeze([...artifactIssues, ...sourceIssues]);
}

export async function writePlayerArtifactManifest(options) {
  const manifestPath = options.manifestPath
    ?? path.join(options.artifactRoot, PLAYER_ARTIFACT_CONTRACT.manifestFile);
  const relativeManifestPath = normalizeRelativePath(path.relative(options.artifactRoot, manifestPath));
  const files = await collectFileRecords(options.artifactRoot, { excludePaths: [relativeManifestPath] });
  assertSecretScanClean(await scanSecretShapedFiles({ root: options.artifactRoot, files }));
  const sourceInputs = await collectSourceInputRecords(options.repoRoot, { inventory: options.sourceInventory });
  const manifest = createPlayerArtifactManifest({
    files,
    sourceInputs,
    sourceRevision: options.sourceRevision,
    builtAt: options.builtAt,
  });
  await replaceManifestAtomically({ manifestPath, manifest, atomicFileOps: options.atomicFileOps });
  return manifest;
}
