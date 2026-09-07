import { copyFile, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { assertSecretScanClean, collectFileRecords, parsePlayerArtifactManifest, scanSecretShapedFiles } from "./playerArtifactContract.mjs";
import { assertExactRecords, readVerifiedPlayerBuild } from "../../community-site/scripts/lib/playerSyncVerification.mjs";
import { runtimeManifestForFiles, jsonBytes, parseRuntimeManifest, type RuntimeManifest } from "../../src/project/gameRelease";
import { sha256HexBytes } from "../../src/util/sha256";
import type { DeploymentFileRecord } from "../../src/project/playerDeploymentTypes";

export const RUNTIME_ARCHIVE_FOLDER = ".runtime-archive";

export async function readTrustedRuntime(archiveRoot: string, target: string): Promise<RuntimeManifest> {
  if (!/^[a-f0-9]{64}$/.test(target)) throw new Error("Invalid runtime target");
  const manifest = await parseRuntimeManifest(JSON.parse(await readFile(join(archiveRoot, target, "runtime.json"), "utf8")));
  if (manifest.runtimeTarget !== target) throw new Error("Runtime target mismatch");
  return manifest;
}

type RuntimeBuildOptions = {
  readonly repoRoot: string;
  readonly sourceInventory?: readonly { readonly kind: string; readonly path: string }[];
  readonly webRoot: string;
  readonly standaloneRoot: string;
  readonly publicRoot: string;
};

async function verifyRuntimeBuild(options: RuntimeBuildOptions): Promise<readonly DeploymentFileRecord[]> {
  const verified = await readVerifiedPlayerBuild({ paths: { repoRoot: options.repoRoot, artifactRoot: options.webRoot,
    manifestPath: join(options.webRoot, "sdk-manifest.json"), runtimeAssetRoot: options.publicRoot }, sourceInventory: options.sourceInventory });
  const standalone = parsePlayerArtifactManifest(JSON.parse(await readFile(join(options.standaloneRoot, "sdk-manifest.json"), "utf8")));
  assertExactRecords({ expected: verified.sourceInputs, actual: standalone.sourceInputs, code: "standalone-source-stale", message: "Standalone source differs from web source" });
  const standaloneFiles: readonly DeploymentFileRecord[] = await collectFileRecords(options.standaloneRoot, { excludePaths: ["sdk-manifest.json"] });
  assertExactRecords({ expected: standalone.files, actual: standaloneFiles, code: "standalone-stale", message: "Standalone artifact differs from its SDK" });
  assertSecretScanClean(await scanSecretShapedFiles({ root: options.standaloneRoot, files: standaloneFiles }));
  if (!standaloneFiles.some(file => file.path === "standalone.js") || !standaloneFiles.some(file => file.path === "standalone.css")) throw new Error("Standalone variant missing");
  const webCollector = verified.artifactFiles.find((file: DeploymentFileRecord) => file.path === "dependency-collector.js");
  const standaloneCollector = standaloneFiles.find(file => file.path === "dependency-collector.js");
  if (!webCollector || !standaloneCollector || webCollector.sha256 !== standaloneCollector.sha256 || webCollector.bytes !== standaloneCollector.bytes) {
    throw new Error("Matching retained dependency collectors are required for both variants");
  }
  return verified.runtimeAssets;
}

/** Read-only reuse proof; archive integrity alone does not prove current sources. */
export async function readCurrentRetainedRuntime(options: {
  readonly repoRoot: string;
  readonly archiveRoot: string;
  readonly sourceInventory?: RuntimeBuildOptions["sourceInventory"];
}): Promise<RuntimeManifest> {
  const pointer: unknown = JSON.parse(await readFile(join(options.archiveRoot, "default.json"), "utf8"));
  if (!pointer || typeof pointer !== "object" || !("runtimeTarget" in pointer) || typeof pointer.runtimeTarget !== "string") throw new Error("Invalid retained default");
  const manifest = await readTrustedRuntime(options.archiveRoot, pointer.runtimeTarget);
  const root = join(options.archiveRoot, manifest.runtimeTarget);
  assertExactRecords({ expected: manifest.files, actual: await collectFileRecords(root, { excludePaths: ["runtime.json"] }),
    code: "retained-runtime-stale", message: "Retained runtime bytes differ from their manifest" });
  await verifyRuntimeBuild({ ...options, webRoot: join(root, "web"), standaloneRoot: join(root, "standalone"), publicRoot: join(root, "public") });
  // SDK source inputs include public/assets and public/generated, but retention
  // also owns other public files. Added/deleted/changed files there invalidate reuse.
  assertExactRecords({ expected: manifest.files.filter(file => file.path.startsWith("public/")).map(file => ({ ...file, path: file.path.slice(7) })),
    actual: await collectFileRecords(join(options.repoRoot, "public")), code: "current-public-stale", message: "Current public assets differ from the retained default" });
  return manifest;
}

/** Build outputs are input only; never replace a directory under an existing digest. */
export async function retainRuntime(options: RuntimeBuildOptions & { readonly archiveRoot: string }): Promise<RuntimeManifest> {
  const runtimeAssets = await verifyRuntimeBuild(options);
  const files: DeploymentFileRecord[] = [];
  const sources = new Map<string, string>();
  for (const [prefix, root] of [["web", options.webRoot], ["standalone", options.standaloneRoot], ["public", options.publicRoot]]) {
    for (const file of await collectFileRecords(root)) {
      const name = `${prefix}/${file.path}`;
      files.push({ ...file, path: name });
      sources.set(name, join(root, file.path));
    }
  }
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const manifest = await runtimeManifestForFiles(files, runtimeAssets.map(file => file.path));
  await parseRuntimeManifest(manifest);
  await mkdir(options.archiveRoot, { recursive: true });
  const stage = await mkdtemp(join(options.archiveRoot, ".stage-"));
  try {
    for (const [name, source] of sources) {
      const destination = join(stage, name);
      await mkdir(join(destination, ".."), { recursive: true });
      await copyFile(source, destination, constants.COPYFILE_EXCL);
    }
    assertExactRecords({ expected: files, actual: await collectFileRecords(stage), code: "archive-copy-stale", message: "Archive inputs changed while retaining" });
    await writeFile(join(stage, "runtime.json"), jsonBytes(manifest), { flag: "wx" });
    try { await rename(stage, join(options.archiveRoot, manifest.runtimeTarget)); }
    catch (error) {
      if (!(error instanceof Error) || !("code" in error) || !["EEXIST", "ENOTEMPTY"].includes(String(error.code))) throw error;
      const existing = await readTrustedRuntime(options.archiveRoot, manifest.runtimeTarget);
      for (const file of existing.files) {
        const bytes = await readFile(join(options.archiveRoot, manifest.runtimeTarget, file.path));
        if (bytes.length !== file.bytes || await sha256HexBytes(bytes) !== file.sha256) throw new Error("Existing runtime archive is corrupt");
      }
    }
    const pointer = join(stage, "default.json");
    await mkdir(stage, { recursive: true });
    await writeFile(pointer, jsonBytes({ runtimeTarget: manifest.runtimeTarget }));
    await rename(pointer, join(options.archiveRoot, "default.json"));
  } finally { await rm(stage, { recursive: true, force: true }); }
  return manifest;
}
