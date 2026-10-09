import { lstatSync, realpathSync } from "node:fs";
import path from "node:path";
import { syncFail } from "./playerSyncError.mjs";

export function createPlayerSyncPaths(options) {
  const repoRoot = path.resolve(options.repoRoot);
  const siteRoot = path.resolve(options.siteRoot);
  const sitePublicRoot = path.resolve(siteRoot, "public");
  const artifactRoot = containedPath({
    root: repoRoot,
    candidate: options.artifactRoot ?? path.join(repoRoot, "dist", "export-player"),
    label: "artifact root",
  });
  const runtimeAssetRoot = containedPath({
    root: repoRoot,
    candidate: options.runtimeAssetRoot ?? path.join(repoRoot, "public"),
    label: "runtime asset root",
  });
  const targetRoot = containedPath({
    root: sitePublicRoot,
    candidate: options.targetRoot ?? path.join(sitePublicRoot, "player-static"),
    label: "installed target",
  });
  const lockPath = containedPath({
    root: siteRoot,
    candidate: options.lockPath ?? path.join(siteRoot, "player-artifact.lock.json"),
    label: "artifact lock",
  });
  const manifestPath = containedPath({
    root: artifactRoot,
    candidate: options.manifestPath ?? path.join(artifactRoot, "sdk-manifest.json"),
    label: "SDK manifest",
  });
  if (isWithin(targetRoot, artifactRoot) || isWithin(artifactRoot, targetRoot)) {
    syncFail("path-overlap", "player source and installed target must not overlap");
  }
  if (isWithin(targetRoot, runtimeAssetRoot) || isWithin(runtimeAssetRoot, targetRoot)) {
    syncFail("path-overlap", "runtime assets and installed target must not overlap");
  }
  if (isWithin(targetRoot, lockPath)) {
    syncFail("path-overlap", "player lock must remain outside the installed target");
  }
  return Object.freeze({
    repoRoot,
    siteRoot,
    sitePublicRoot,
    artifactRoot,
    runtimeAssetRoot,
    targetRoot,
    lockPath,
    manifestPath,
  });
}

export function containedPath({ root, candidate, label }) {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  if (!strictlyWithin(resolvedRoot, resolvedCandidate)) {
    syncFail("path-escape", `${label} must remain inside its owned root`);
  }
  assertNoReparsePoint(resolvedRoot, resolvedCandidate, label);
  assertPhysicalContainment(resolvedRoot, resolvedCandidate, label);
  return resolvedCandidate;
}

export function isWithin(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative.length === 0 || (
    relative !== ".."
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative)
  );
}

function strictlyWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative.length > 0
    && relative !== ".."
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative);
}

function assertNoReparsePoint(root, candidate, label) {
  const relative = path.relative(root, candidate);
  let current = root;
  for (const segment of ["", ...relative.split(path.sep)]) {
    if (segment.length > 0) current = path.join(current, segment);
    const stats = tryLstat(current);
    if (stats === undefined) break;
    if (stats.isSymbolicLink()) {
      syncFail("path-reparse-point", `${label} must not traverse a symbolic link or junction`);
    }
  }
}

function assertPhysicalContainment(root, candidate, label) {
  const physicalRoot = physicalProjection(root);
  const physicalCandidate = physicalProjection(candidate);
  if (!strictlyWithin(physicalRoot, physicalCandidate)) {
    syncFail("path-escape", `${label} must remain inside its physical owned root`);
  }
}

function physicalProjection(target) {
  const missing = [];
  let cursor = target;
  while (true) {
    try {
      return path.resolve(realpathSync.native(cursor), ...missing.reverse());
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
        syncFail("path-inspection-failed", "player path containment could not be verified");
      }
      const parent = path.dirname(cursor);
      if (parent === cursor) syncFail("path-inspection-failed", "player path containment could not be verified");
      missing.push(path.basename(cursor));
      cursor = parent;
    }
  }
}

function tryLstat(target) {
  try {
    return lstatSync(target);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    syncFail("path-inspection-failed", "player path containment could not be verified");
  }
}
