import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { retainRuntime, readTrustedRuntime } from "../scripts/lib/runtimeArchive";
import { createPipelineFixture, PIPELINE_SOURCE_INVENTORY } from "./playerArtifactPipeline.fixture.mjs";
import { writePlayerArtifactManifest } from "../scripts/lib/playerArtifactContract.mjs";
import { writePlayerDeploymentManifest } from "../scripts/lib/playerDeploymentManifest.mjs";

const collector = "var OPRN_RELEASE_COLLECTOR={collectReleaseDependencies:()=>[]};";
async function installCollectors(fixture: Awaited<ReturnType<typeof createPipelineFixture>>, standaloneRoot: string) {
  await writeFile(join(fixture.artifactRoot, "dependency-collector.js"), collector);
  await writeFile(join(standaloneRoot, "dependency-collector.js"), collector);
  await writePlayerDeploymentManifest({ artifactRoot: fixture.artifactRoot, repoRoot: fixture.repoRoot,
    sourceInventory: PIPELINE_SOURCE_INVENTORY, runtimeAssetPaths: ["assets/runtime.png"] });
  await writePlayerArtifactManifest({ artifactRoot: standaloneRoot, repoRoot: fixture.repoRoot, sourceInventory: PIPELINE_SOURCE_INVENTORY });
}

describe("append-only trusted runtime archive", () => {
  it.each(["source", "web", "standalone", "public", "collector"])("rejects changed %s bytes before retention", async kind => {
    const fixture = await createPipelineFixture();
    try {
      const standaloneRoot = join(fixture.root, "standalone");
      await mkdir(standaloneRoot);
      await writeFile(join(standaloneRoot, "standalone.js"), "trusted standalone");
      await writeFile(join(standaloneRoot, "standalone.css"), "body{}");
      await writePlayerArtifactManifest({ artifactRoot: standaloneRoot, repoRoot: fixture.repoRoot, sourceInventory: PIPELINE_SOURCE_INVENTORY });
      const paths: Record<string, string> = { source: join(fixture.repoRoot, "player-source.txt"), web: join(fixture.artifactRoot, "player.js"),
        collector: join(fixture.artifactRoot, "dependency-collector.js"),
        standalone: join(standaloneRoot, "standalone.js"), public: join(fixture.runtimeAssetRoot, "assets/runtime.png") };
      await installCollectors(fixture, standaloneRoot);
      await writeFile(paths[kind], "tampered");
      await expect(retainRuntime({ repoRoot: fixture.repoRoot, sourceInventory: PIPELINE_SOURCE_INVENTORY,
        archiveRoot: join(fixture.root, "archive"), webRoot: fixture.artifactRoot, standaloneRoot, publicRoot: fixture.runtimeAssetRoot })).rejects.toThrow();
    } finally { await rm(fixture.root, { recursive: true, force: true }); }
  });
  it("rejects an arbitrary SDK before trusting an archive", async () => {
    const fixture = await createPipelineFixture();
    try {
      const standaloneRoot = join(fixture.root, "standalone");
      await mkdir(standaloneRoot);
      await writeFile(join(standaloneRoot, "standalone.js"), "trusted standalone");
      await writeFile(join(standaloneRoot, "standalone.css"), "body{}");
      await writePlayerArtifactManifest({ artifactRoot: standaloneRoot, repoRoot: fixture.repoRoot, sourceInventory: PIPELINE_SOURCE_INVENTORY });
      await writeFile(join(fixture.artifactRoot, "sdk-manifest.json"), JSON.stringify({ deployment: { runtimeAssets: [{ path: "assets/runtime.png" }] } }));
      await expect(retainRuntime({ repoRoot: fixture.repoRoot, sourceInventory: PIPELINE_SOURCE_INVENTORY,
        archiveRoot: join(fixture.root, "archive"), webRoot: fixture.artifactRoot, standaloneRoot, publicRoot: fixture.runtimeAssetRoot })).rejects.toThrow();
    } finally { await rm(fixture.root, { recursive: true, force: true }); }
  });
  it("rejects divergent collectors even when both SDKs are self-consistent", async () => {
    const fixture = await createPipelineFixture();
    try {
      const standaloneRoot = join(fixture.root, "standalone");
      await mkdir(standaloneRoot);
      await writeFile(join(standaloneRoot, "standalone.js"), "standalone");
      await writeFile(join(standaloneRoot, "standalone.css"), "body{}");
      await installCollectors(fixture, standaloneRoot);
      await writeFile(join(standaloneRoot, "dependency-collector.js"), `${collector}\n/* different rules */`);
      await writePlayerArtifactManifest({ artifactRoot: standaloneRoot, repoRoot: fixture.repoRoot, sourceInventory: PIPELINE_SOURCE_INVENTORY });
      await expect(retainRuntime({ repoRoot: fixture.repoRoot, sourceInventory: PIPELINE_SOURCE_INVENTORY,
        archiveRoot: join(fixture.root, "archive"), webRoot: fixture.artifactRoot, standaloneRoot, publicRoot: fixture.runtimeAssetRoot })).rejects.toThrow("Matching retained dependency collectors");
    } finally { await rm(fixture.root, { recursive: true, force: true }); }
  });

  it("retains both variants and assets outside destructive build output", async () => {
    const fixture = await createPipelineFixture({ playerJs: "old web", runtimeBytes: "old image" });
    const root = fixture.root;
    try {
      await mkdir(join(root, "standalone"));
      await writeFile(join(root, "standalone/standalone.js"), "old standalone");
      await writeFile(join(root, "standalone/standalone.css"), "body{}");
      await installCollectors(fixture, join(root, "standalone"));
      const options = { repoRoot: fixture.repoRoot, sourceInventory: PIPELINE_SOURCE_INVENTORY,
        archiveRoot: join(root, "archive"), webRoot: fixture.artifactRoot, standaloneRoot: join(root, "standalone"), publicRoot: fixture.runtimeAssetRoot };
      await writePlayerArtifactManifest({ artifactRoot: options.standaloneRoot, repoRoot: fixture.repoRoot, sourceInventory: PIPELINE_SOURCE_INVENTORY });
      const first = await retainRuntime(options);
      expect(first.capabilities).toContain("community-save-isolation-v1");
      const duplicates = await Promise.all([retainRuntime(options), retainRuntime(options)]);
      expect(duplicates.map(value => value.runtimeTarget)).toEqual([first.runtimeTarget, first.runtimeTarget]);
      expect((await readdir(options.archiveRoot)).sort()).toEqual([first.runtimeTarget, "default.json"].sort());
      await writeFile(join(options.webRoot, "player.js"), "new web");
      await writePlayerDeploymentManifest({ artifactRoot: options.webRoot, repoRoot: fixture.repoRoot,
        sourceInventory: PIPELINE_SOURCE_INVENTORY, runtimeAssetPaths: ["assets/runtime.png"] });
      const second = await retainRuntime(options);
      await rm(options.webRoot, { recursive: true });
      await rm(options.publicRoot, { recursive: true });
      expect(second.runtimeTarget).not.toBe(first.runtimeTarget);
      expect(await readTrustedRuntime(options.archiveRoot, first.runtimeTarget)).toEqual(first);
      expect(await readFile(join(options.archiveRoot, first.runtimeTarget, "web/player.js"), "utf8")).toBe("old web");
      expect(await readFile(join(options.archiveRoot, first.runtimeTarget, "public/assets/runtime.png"), "utf8")).toBe("old image");
      await expect(readTrustedRuntime(options.archiveRoot, "f".repeat(64))).rejects.toThrow();
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
