import { readFile } from "node:fs/promises";
import path from "node:path";

// Tileset AI reference documents (study markdown + comparison images) are editor-only authoring aids:
// src/project/webExport.ts already deletes tileset.referenceDocuments from every exported project, and no
// player/battle module reads them. The default-content modules still import the shipped copies, so without
// this step every player artifact carried ~14MB of them (player.js 19MB, dependency-collector.js 18MB), which
// tripped the 16MB secret-scan limit in playerArtifactInventory.mjs. The player, standalone and release
// collector builds load these files with the reference documents emptied instead.
//
// "whole": the file is only reference documents (array or tileset-id -> category map) -> same-shaped empty value.
// "field": a bundled tileset/library whose referenceDocuments field is dropped; the rest (tileMeta, passability,
//          kits) stays because runtime normalisation may still create or backfill the bundled tileset.
export const PLAYER_EDITOR_ONLY_ASSETS = Object.freeze({
  "src/assets/worldmapSelectedReferences.json": "whole",
});

export function stripEditorOnlyJson(mode, text) {
  const value = JSON.parse(text);
  if (mode === "whole") return JSON.stringify(Array.isArray(value) ? [] : {});
  if (mode === "field") return JSON.stringify({ ...value, referenceDocuments: [] });
  throw new Error(`unknown editor-only asset mode: ${mode}`);
}

function modeFor(repoRoot, id) {
  const file = id.split("?")[0];
  if (!path.isAbsolute(file)) return undefined;
  return PLAYER_EDITOR_ONLY_ASSETS[path.relative(repoRoot, file).split(path.sep).join("/")];
}

async function loadStripped(repoRoot, id) {
  const mode = modeFor(repoRoot, id);
  if (!mode) return undefined;
  return stripEditorOnlyJson(mode, await readFile(id.split("?")[0], "utf8"));
}

/** Vite/Rollup plugin: runs before vite:json, which then turns the stripped text into a module. */
export function playerEditorOnlyAssetsVitePlugin() {
  let repoRoot = process.cwd();
  return {
    name: "oprn-player-editor-only-assets",
    enforce: "pre",
    configResolved(config) { repoRoot = config.root; },
    load(id) { return loadStripped(repoRoot, id); },
  };
}

/** esbuild plugin for the release dependency collector. */
export function playerEditorOnlyAssetsEsbuildPlugin(repoRoot) {
  return {
    name: "oprn-player-editor-only-assets",
    setup(build) {
      build.onLoad({ filter: /\.json$/ }, async (args) => {
        const contents = await loadStripped(repoRoot, args.path);
        return contents === undefined ? undefined : { contents, loader: "json" };
      });
    },
  };
}
