// 공개 기준 커밋(0d4f13e7c8)에서 빠진 테스트 픽스처를 되살린 것. community-site 동기화 경로(별도 저장소)는 뺐다.
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  collectFileRecords,
  collectListedFileRecords,
  collectSourceInputRecords,
} from "../scripts/lib/playerArtifactContract.mjs";
import { createPlayerDeploymentManifest } from "../scripts/lib/playerDeploymentManifest.mjs";

export const PIPELINE_SOURCE_INVENTORY = Object.freeze([
  Object.freeze({ kind: "file", path: "player-source.txt" }),
]);

export async function createPipelineFixture(options = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "rpgzzu-player-pipeline-"));
  const repoRoot = path.join(root, "repo");
  const siteRoot = path.join(repoRoot, "community-site");
  const artifactRoot = path.join(repoRoot, "dist", "export-player");
  const runtimeAssetRoot = path.join(repoRoot, "public");
  await put(repoRoot, "player-source.txt", "current player source");
  await put(siteRoot, "package.json", JSON.stringify({ type: "module" }));
  await put(artifactRoot, "player.html", "<!doctype html><main id=app></main>");
  await put(artifactRoot, "player.js", options.playerJs ?? "import './assets/player.css';");
  await put(artifactRoot, "assets/player.css", ".play-stage{display:block}");
  const viteManifest = {
    "player.html": {
      file: "player.js",
      isEntry: true,
      css: ["assets/player.css"],
    },
  };
  await put(artifactRoot, "player-manifest.json", JSON.stringify(viteManifest));
  await put(runtimeAssetRoot, "assets/runtime.png", options.runtimeBytes ?? "runtime");
  const files = await collectFileRecords(artifactRoot);
  const sourceInputs = await collectSourceInputRecords(repoRoot, { inventory: PIPELINE_SOURCE_INVENTORY });
  const runtimeAssets = await collectListedFileRecords(runtimeAssetRoot, ["assets/runtime.png"]);
  const manifest = createPlayerDeploymentManifest({
    files,
    sourceInputs,
    runtimeAssets,
    viteManifestValue: viteManifest,
    sourceRevision: "fixture-revision",
    builtAt: "2026-07-22T00:00:00.000Z",
  });
  await put(artifactRoot, "sdk-manifest.json", JSON.stringify(options.manifestValue ?? manifest));
  return Object.freeze({ root, repoRoot, siteRoot, artifactRoot, runtimeAssetRoot, manifest });
}

export async function put(root, relativePath, value) {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, value);
}

export async function snapshotTree(root) {
  async function walk(directory, prefix = "") {
    const entries = await readdir(directory, { withFileTypes: true });
    const records = [];
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) records.push(...await walk(fullPath, relativePath));
      else records.push([relativePath, await readFile(fullPath, "utf8")]);
    }
    return records;
  }
  return walk(root);
}

export async function cleanupFixture(fixture) {
  await rm(fixture.root, { recursive: true, force: true });
}
