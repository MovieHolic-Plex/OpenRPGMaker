/**
 * Installs or verifies the current-source player artifact for the community app.
 * This command never builds the player. The root `build:community` release path
 * performs build -> sync -> verify -> community build explicitly.
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { installVerifiedPlayerArtifact } from "./lib/playerSyncTransaction.mjs";
import { PlayerArtifactSyncError } from "./lib/playerSyncError.mjs";
import { createPlayerSyncPaths } from "./lib/playerSyncPaths.mjs";
import {
  readVerifiedPlayerBuild,
  verifyInstalledPlayerArtifact,
} from "./lib/playerSyncVerification.mjs";

export async function runPlayerSync(options = {}) {
  const siteRoot = path.resolve(
    options.siteRoot ?? path.dirname(fileURLToPath(new URL("../package.json", import.meta.url))),
  );
  const repoRoot = path.resolve(options.repoRoot ?? path.join(siteRoot, ".."));
  const paths = createPlayerSyncPaths({
    repoRoot,
    siteRoot,
    artifactRoot: options.artifactRoot,
    runtimeAssetRoot: options.runtimeAssetRoot,
    targetRoot: options.targetRoot,
    lockPath: options.lockPath,
    manifestPath: options.manifestPath,
  });
  const verifiedBuild = await readVerifiedPlayerBuild({
    paths,
    sourceInventory: options.sourceInventory,
    adapters: options.verificationAdapters,
  });
  if (options.checkOnly === true) {
    const installed = await verifyInstalledPlayerArtifact({
      paths,
      verifiedBuild,
      adapters: options.verificationAdapters,
    });
    return Object.freeze({ kind: "verified", paths, verifiedBuild, installed });
  }
  const installed = await installVerifiedPlayerArtifact({
    paths,
    verifiedBuild,
    installedAt: options.installedAt,
    transactionId: options.transactionId,
    adapters: options.transactionAdapters,
  });
  return Object.freeze({ kind: "installed", paths, verifiedBuild, installed });
}

async function main() {
  try {
    const checkOnly = process.argv.slice(2).includes("--check");
    const result = await runPlayerSync({ checkOnly });
    const manifest = result.verifiedBuild.manifest;
    if (result.kind === "verified") {
      console.log(`player-sync: verified ${manifest.files.length} files, artifact ${manifest.artifactVersion}`);
    } else {
      console.log(`player-sync: installed ${manifest.files.length} files, artifact ${manifest.artifactVersion}`);
    }
  } catch (error) {
    if (error instanceof PlayerArtifactSyncError) {
      console.error(`player-sync failed [${error.code}]: ${error.message}`);
    } else {
      console.error("player-sync failed [unexpected]: player synchronization failed");
    }
    process.exitCode = 1;
  }
}

const directUrl = process.argv[1] === undefined ? "" : pathToFileURL(path.resolve(process.argv[1])).href;
if (directUrl === import.meta.url) await main();
