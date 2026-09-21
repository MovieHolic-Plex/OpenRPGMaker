import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { runBoundedCommand, type CommandReceipt } from "./ice-grand-expanse/boundedCommand.mjs";
import {
  classifyGitSourceStateDrift,
  collectGitSourceState,
  collectPathSet,
  findPathSetDrift,
  type DirtyPathRecord,
} from "./ice-grand-expanse/preflightGit.mjs";
import {
  PreflightError,
  assertNoDirtyOverlap,
  buildSourceManifest,
  collectTreeLocations,
  hashValue,
  normalizeLegacyDbOrigin,
  parsePreflightArgs,
  sha256Bytes,
  stableJson,
} from "./ice-grand-expanse/preflightCore.mjs";
import { loadRemoteConfig, readProtectedBaseline } from "./ice-grand-expanse/preflightRemote.mjs";

export { PreflightError, assertNoDirtyOverlap, buildSourceManifest, collectTreeLocations, normalizeLegacyDbOrigin, parsePreflightArgs, stableJson };

const COMMANDS = [
  { argv: ["npx", "vitest", "run", "test/iceGrandExpansePreflight.test.ts", "test/iceDiagonalTerrain.test.ts", "test/iceGrandAdventure.test.ts", "--configLoader", "runner"], phase: "focused-test", timeoutMs: 5 * 60_000 },
  { argv: ["npm", "test"], phase: "full-test", timeoutMs: 15 * 60_000 },
  { argv: ["npm", "run", "typecheck"], phase: "typecheck", timeoutMs: 10 * 60_000 },
  { argv: ["npm", "run", "build"], phase: "build", timeoutMs: 10 * 60_000 },
] as const;

const TODO1_SOURCE_PATHS = [
  "scripts/preflight-ice-grand-expanse.mts",
  "scripts/ice-grand-expanse/boundedCommand.mts",
  "scripts/ice-grand-expanse/preflightCore.mts",
  "scripts/ice-grand-expanse/preflightGit.mts",
  "scripts/ice-grand-expanse/preflightRemote.mts",
  "test/iceGrandExpansePreflight.test.ts",
  "test/helpers/iceGrandExpansePreflightGitFixture.ts",
] as const;
const TODO1_READ_DEPENDENCIES = [
  ...TODO1_SOURCE_PATHS,
  ".env",
  ".env.local",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "tsconfig.json",
  "tsconfig.app.json",
  "vite.config.ts",
  "vitest.config.ts",
  "test/iceDiagonalTerrain.test.ts",
  "test/iceGrandAdventure.test.ts",
] as const;
const TODO1_PROTECTED_PATHS = new Set<string>(TODO1_READ_DEPENDENCIES);
const RUN_REGION_EXTERNAL_PROVENANCE = {
  after: {
    dirtyInventorySha256: "6ea1680bb424a27025b7160fb09c0928f9ce05ec351fa1accad9fadb88affcdc",
    trackedDiffSha256: "4e425fc3db62811a4c55fca0f38ace672f8a714522164cfb10e4edbeca86edee",
  },
  before: {
    dirtyInventorySha256: "28eeee00d694f5d6ba86877634a482c384998317172a8aedfc380224fc10f18a",
    trackedDiffSha256: "c7df5b514868f89d509c96e99913b82fddf27fa28c91fadd2b351ec3e133af83",
  },
  detectedAt: "2026-07-22T07:45:30.6252719Z",
  path: "src/editor/regionTask/runRegionTask.ts",
  provenanceArtifact: "output/evidence/ice-grand-expanse/addenda/quiet-window-drift-20260722T074530Z.json",
  stableForMs: 30_000,
} as const;

type ArtifactRecord = { readonly path: string; readonly sha256: string };

export async function runPreflight(argv: readonly string[], cwd = process.cwd()): Promise<void> {
  const args = parsePreflightArgs(argv);
  const out = path.resolve(cwd, args.out);
  const relativeParts = args.out.split("/");
  const runId = relativeParts[3];
  if (!runId) throw new PreflightError("ARGUMENT_INVALID", "Output is missing a run id");
  const runRoot = path.resolve(cwd, "output/evidence/ice-grand-expanse", runId);
  if (await exists(runRoot)) throw new PreflightError("OUTPUT_EXISTS", "Run output already exists");

  const startedAt = new Date().toISOString();
  const config = await loadRemoteConfig(cwd);
  const source = await collectGitSourceState(cwd);
  const readDependencyBaseline = await collectPathSet(cwd, TODO1_READ_DEPENDENCIES);
  const remote = await readProtectedBaseline(config, args.projectId);
  const negative = await missingProjectProbe(config);
  const sourceManifest = await buildSourceManifest({
    gitHeadOrNull: source.gitHeadOrNull,
    runId,
    startedAt,
    legacyDbOriginSha256: remote.legacyDbOriginSha256,
    targetProjectId: args.projectId,
    trackedDiffSha256: source.trackedDiffSha256,
    untrackedInventorySha256: source.untrackedInventorySha256,
  });

  await mkdir(path.dirname(runRoot), { recursive: true });
  await mkdir(runRoot);
  await mkdir(out);
  const artifacts: ArtifactRecord[] = [];
  artifacts.push(await writeArtifact(`${runRoot}/source-manifest.json`, sourceManifest));
  artifacts.push(await writeBoundArtifact(`${out}/dirty-inventory.json`, sourceManifest, {
    dirtyInventory: source.dirtyInventory,
    dirtyInventorySha256: source.dirtyInventorySha256,
    porcelainV2zSha256: source.porcelainV2zSha256,
  }));
  artifacts.push(await writeBoundArtifact(`${out}/scope-manifest.json`, sourceManifest, {
    readDependencies: TODO1_READ_DEPENDENCIES,
    readDependencyInventory: readDependencyBaseline,
    readDependencyInventorySha256: hashValue(readDependencyBaseline),
    writeAllowlist: [...TODO1_SOURCE_PATHS, `${args.out}/**`, `${path.relative(cwd, runRoot).replaceAll("\\", "/")}/source-manifest.json`],
  }));
  artifacts.push(await writeBoundArtifact(`${out}/remote-protected-baseline.json`, sourceManifest, remote));
  artifacts.push(await writeBoundArtifact(`${out}/negative-missing-project.json`, sourceManifest, negative));

  const commandReceipts: CommandReceipt[] = [];
  for (const command of COMMANDS) {
    const receipt = await runBoundedCommand({ argv: command.argv, cwd, phase: command.phase, timeoutMs: command.timeoutMs });
    commandReceipts.push(receipt);
    artifacts.push(await writeBoundArtifact(`${out}/${command.phase}.json`, sourceManifest, receipt));
  }
  const cleanup = {
    boundedCommandsClosed: commandReceipts.every((receipt) => receipt.exitCode !== null || receipt.signal !== null),
    temporaryDirectories: [],
    timedOutPhases: commandReceipts.filter((receipt) => receipt.timedOut).map((receipt) => receipt.phase),
  };
  artifacts.push(await writeBoundArtifact(`${out}/cleanup.json`, sourceManifest, cleanup));
  const finalSource = await collectGitSourceState(cwd);
  const finalReadDependencies = await collectPathSet(cwd, TODO1_READ_DEPENDENCIES);
  const gitDrift = classifyGitSourceStateDrift(source, finalSource, TODO1_PROTECTED_PATHS);
  const dependencyDrift = findPathSetDrift(readDependencyBaseline, finalReadDependencies);
  const protectedDrift = [...new Set([...gitDrift.protectedPaths, ...dependencyDrift])].sort();
  if (protectedDrift.length > 0) {
    await writeBoundArtifact(`${out}/dirty-overlap.json`, sourceManifest, {
      dependencyDrift,
      gitMarkers: gitDrift.gitMarkers,
      protectedPaths: protectedDrift,
    });
    assertNoDirtyOverlap(protectedDrift);
  }
  artifacts.push(await writeBoundArtifact(`${out}/external-drift-addendum.json`, sourceManifest, {
    acceptedExternalBaseline: {
      ...RUN_REGION_EXTERNAL_PROVENANCE,
      baselineAtRunStart: recordsAtPath(source.dirtyInventory, RUN_REGION_EXTERNAL_PROVENANCE.path),
      baselineAtRunEnd: recordsAtPath(finalSource.dirtyInventory, RUN_REGION_EXTERNAL_PROVENANCE.path),
      knownOwningTask: "external concurrent editor/runtime work; exact thread not discoverable",
    },
    duringRun: {
      changedPaths: gitDrift.externalPaths,
      entries: gitDrift.externalPaths.map((changedPath) => ({
        after: recordsAtPath(finalSource.dirtyInventory, changedPath),
        before: recordsAtPath(source.dirtyInventory, changedPath),
        path: changedPath,
      })),
      gitMarkers: gitDrift.gitMarkers,
      observedEndedAt: new Date().toISOString(),
      observedStartedAt: startedAt,
    },
  }));
  const receipt = {
    artifactInventorySha256: hashValue(artifacts),
    artifacts,
    baselineFailures: commandReceipts.filter((item) => item.exitCode !== 0 || item.timedOut).map((item) => ({
      diagnosticIdentities: item.diagnosticIdentities,
      exitCode: item.exitCode,
      phase: item.phase,
      timedOut: item.timedOut,
    })),
    cleanup,
    completedAt: new Date().toISOString(),
    protectedHashes: {
      adventureGameMapSha256: remote.adventure.effectiveGameMapSha256,
      baseProjectSemanticSha256: remote.baseProjectSemanticSha256,
      canonicalGameMapSha256: remote.canonical.effectiveGameMapSha256,
      startTupleSha256: remote.startTupleSha256,
      stripOwnedArtifactsSha256: remote.stripOwnedArtifactsSha256,
    },
    readOnly: true,
    remoteRevision: remote.currentSha256,
  };
  const finalArtifact = await writeBoundArtifact(`${out}/task-1-receipt.json`, sourceManifest, receipt);
  process.stdout.write(`${JSON.stringify({
    artifactInventorySha256: receipt.artifactInventorySha256,
    baselineFailurePhases: receipt.baselineFailures.map((failure) => failure.phase),
    receiptSha256: finalArtifact.sha256,
    runId,
    sourceManifestSha256: sourceManifest.sourceManifestSha256,
    status: "PREFLIGHT_CAPTURED",
  })}\n`);
}

async function missingProjectProbe(config: Awaited<ReturnType<typeof loadRemoteConfig>>) {
  try {
    await readProtectedBaseline(config, "missing-ice-project");
    throw new PreflightError("TARGET_IDENTITY_MISMATCH", "Missing-project probe unexpectedly resolved");
  } catch (error) {
    if (error instanceof PreflightError && error.code === "PROJECT_NOT_FOUND") {
      return { code: error.code, projectId: "missing-ice-project", successReceiptCreated: false };
    }
    throw error;
  }
}

async function writeBoundArtifact(
  file: string,
  manifest: Awaited<ReturnType<typeof buildSourceManifest>>,
  payload: unknown,
): Promise<ArtifactRecord> {
  return writeArtifact(file, { runId: manifest.runId, sourceManifestSha256: manifest.sourceManifestSha256, payload });
}

async function writeArtifact(file: string, payload: unknown): Promise<ArtifactRecord> {
  const text = `${stableJson(payload)}\n`;
  await writeFile(file, text, { encoding: "utf8", flag: "wx" });
  return { path: path.relative(process.cwd(), file).replaceAll("\\", "/"), sha256: sha256Bytes(text) };
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

function recordsAtPath(inventory: readonly DirtyPathRecord[], targetPath: string): readonly DirtyPathRecord[] {
  return inventory.filter((entry) => entry.path === targetPath);
}

async function main(): Promise<void> {
  try {
    await runPreflight(process.argv.slice(2));
  } catch (error) {
    if (error instanceof PreflightError) {
      process.stderr.write(`${JSON.stringify({ code: error.code, message: error.message, status: "PREFLIGHT_STOPPED" })}\n`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) await main();
