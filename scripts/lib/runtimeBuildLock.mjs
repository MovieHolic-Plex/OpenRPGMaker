import { PlayerArtifactSyncError, syncFail } from "./runtimeBuildError.mjs";

export const PLAYER_ARTIFACT_LOCK = Object.freeze({
  sentinel: "rpg-zzu/community-player-lock",
  schemaVersion: 1,
});

const SHA256 = /^[a-f0-9]{64}$/u;
const LOCK_KEYS = Object.freeze([
  "artifactContractVersion",
  "artifactDigest",
  "artifactSchemaVersion",
  "artifactVersion",
  "deploymentDigest",
  "deploymentSchemaVersion",
  "installedAt",
  "runtimeAssetDigest",
  "schemaVersion",
  "sentinel",
  "sourceDigest",
  "sourceRevision",
]);

export function createPlayerArtifactLock({ manifest, installedAt }) {
  return Object.freeze({
    sentinel: PLAYER_ARTIFACT_LOCK.sentinel,
    schemaVersion: PLAYER_ARTIFACT_LOCK.schemaVersion,
    artifactContractVersion: manifest.contractVersion,
    artifactSchemaVersion: manifest.schemaVersion,
    deploymentSchemaVersion: manifest.deployment.schemaVersion,
    artifactVersion: manifest.artifactVersion,
    artifactDigest: manifest.artifactDigest,
    sourceDigest: manifest.sourceDigest,
    runtimeAssetDigest: manifest.deployment.runtimeAssetDigest,
    deploymentDigest: manifest.deployment.deploymentDigest,
    sourceRevision: manifest.sourceRevision,
    installedAt,
  });
}

export function parsePlayerArtifactLock(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    syncFail("lock-invalid", "installed player lock is malformed");
  }
  const integers = [
    value.schemaVersion,
    value.artifactContractVersion,
    value.artifactSchemaVersion,
    value.deploymentSchemaVersion,
  ];
  const digests = [
    value.artifactDigest,
    value.sourceDigest,
    value.runtimeAssetDigest,
    value.deploymentDigest,
  ];
  const keys = Object.keys(value).sort();
  if (
    keys.length !== LOCK_KEYS.length
    || keys.some((key, index) => key !== LOCK_KEYS[index])
    ||
    value.sentinel !== PLAYER_ARTIFACT_LOCK.sentinel
    || integers.some((entry) => !Number.isInteger(entry) || entry < 1)
    || typeof value.artifactVersion !== "string"
    || !/^[a-f0-9]{16}$/u.test(value.artifactVersion)
    || digests.some((entry) => typeof entry !== "string" || !SHA256.test(entry))
    || typeof value.sourceRevision !== "string"
    || value.sourceRevision.length === 0
    || typeof value.installedAt !== "string"
    || Number.isNaN(Date.parse(value.installedAt))
  ) {
    syncFail("lock-invalid", "installed player lock is malformed");
  }
  return Object.freeze({ ...value });
}

export function assertLockMatchesManifest({ lock, manifest }) {
  const expected = createPlayerArtifactLock({ manifest, installedAt: lock.installedAt });
  for (const key of Object.keys(expected)) {
    if (lock[key] !== expected[key]) {
      throw new PlayerArtifactSyncError("lock-stale", "installed player lock does not match the current build");
    }
  }
}
