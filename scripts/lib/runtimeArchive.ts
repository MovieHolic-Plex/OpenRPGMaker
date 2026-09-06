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

/** Build outputs are input only; never replace a directory under an existing digest. */
export async function retainRuntime(options: {
  readonly repoRoot: string;
  readonly sourceInventory?: readonly { readonly kind: string; readonly path: string }[];
  readonly archiveRoot: string;
  readonly webRoot: string;
  readonly standaloneRoot: string;
  readonly publicRoot: string;
}): Promise<RuntimeManifest> {
  const verified = await readVerifiedPlayerBuild({ paths: { repoRoot: options.repoRoot, artifactRoot: options.webRoot,
    manifestPath: join(options.webRoot, "sdk-manifest.json"), runtimeAssetRoot: options.publicRoot }, sourceInventory: options.sourceInventory });
  const standalone = parsePlayerArtifactManifest(JSON.parse(await readFile(join(options.standaloneRoot, "sdk-manifest.json"), "utf8")));
  assertExactRecords({ expected: verified.sourceInputs, actual: standalone.sourceInputs, code: "standalone-source-stale", message: "Standalone source differs from web source" });
  const standaloneFiles: readonly DeploymentFileRecord[] = await collectFileRecords(options.standaloneRoot, { excludePaths: ["sdk-manifest.json"] });
  assertExactRecords({ expected: standalone.files, actual: standaloneFiles, code: "standalone-stale", message: "Standalone artifact differs from its SDK" });
  assertSecretScanClean(await scanSecretShapedFiles({ root: options.standaloneRoot, files: standaloneFiles }));
  if (!standaloneFiles.some(file => file.path === "standalone.js") || !standaloneFiles.some(file => file.path === "standalone.css")) throw new Error("Standalone variant missing");
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
  const runtimeAssets: readonly DeploymentFileRecord[] = verified.runtimeAssets;
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
