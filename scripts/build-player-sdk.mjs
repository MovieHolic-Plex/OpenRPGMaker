/**
 * Writes the fail-closed player SDK manifest after the Vite player build.
 * Artifact bytes are scanned before the manifest is written, and the manifest
 * binds both the exact artifact set and the explicit current-source inventory.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeReleaseCollector } from "./lib/releaseCollectorBuild.mjs";
import {
  PLAYER_RUNTIME_ASSET_PATHS,
  writePlayerDeploymentManifest,
} from "./lib/playerDeploymentManifest.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactRoot = path.join(repoRoot, "dist", "export-player");

let sourceRevision = "unknown";
try {
  sourceRevision = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
} catch {
  console.warn("sdk-manifest: source revision unavailable; sourceDigest remains authoritative");
}

await writeReleaseCollector(repoRoot, artifactRoot);
const manifest = await writePlayerDeploymentManifest({
  artifactRoot,
  repoRoot,
  runtimeAssetRoot: path.join(repoRoot, "public"),
  runtimeAssetPaths: PLAYER_RUNTIME_ASSET_PATHS,
  sourceRevision,
});
console.log(
  `sdk-manifest: ${manifest.files.length} files + ${manifest.deployment.runtimeAssets.length} runtime assets, artifact ${manifest.artifactVersion}, source ${manifest.sourceDigest.slice(0, 16)}, schema v${manifest.schemaVersion}`,
);
