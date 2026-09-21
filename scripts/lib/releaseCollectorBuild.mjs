import { build } from "esbuild";
import path from "node:path";
import { writeFile } from "node:fs/promises";

export async function buildReleaseCollector(repoRoot) {
  const result = await build({ entryPoints: [path.join(repoRoot, "src/project/releaseDependencyCollector.ts")],
    absWorkingDir: repoRoot, bundle: true, write: false, platform: "browser", format: "iife",
    globalName: "OPRN_RELEASE_COLLECTOR", target: "es2022", minify: true, metafile: true,
    define: { "import.meta.env": "{}" }, alias: {
      "@/assets/sharedCastleReferences.json": path.join(repoRoot, "src/player/emptySharedCastleReferences.json"),
      "@": path.join(repoRoot, "src"),
    } });
  if (result.outputFiles.length !== 1 || Object.values(result.metafile.outputs).some(output => output.imports.length)) {
    throw new Error("Release collector must be self-contained");
  }
  return result.outputFiles[0].contents;
}

export async function writeReleaseCollector(repoRoot, artifactRoot) {
  await writeFile(path.join(artifactRoot, "dependency-collector.js"), await buildReleaseCollector(repoRoot));
}
