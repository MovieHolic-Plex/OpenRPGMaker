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
//
// #3103 (2026-10-20) made src/project/defaults/defaultAssets.ts keep a module-level table of every bundled
// tileset's reference-document factory (bundledReferenceDocumentsById), so tree-shaking no longer drops these
// files from the player and the release collector: dependency-collector.js grew 57.1MB -> 67.7MB and tripped
// the 64MiB scan limit. Every src/assets/*References.json that holds tileset reference categories is listed
// here; test/playerEditorOnlyAssets.test.ts fails when a new one is added without an entry.
export const PLAYER_EDITOR_ONLY_ASSETS = Object.freeze({
  "src/assets/atlasCartographyReferences.json": "whole",
  "src/assets/beodeulCityReferences.json": "whole",
  "src/assets/beodeulDoorReferences.json": "whole",
  "src/assets/beodeulFacilitiesReferences.json": "whole",
  "src/assets/beodeulFormsReferences.json": "whole",
  "src/assets/beodeulGroundReferences.json": "whole",
  "src/assets/beodeulReviewedReferences.json": "whole",
  "src/assets/desertEastReferences.json": "whole",
  "src/assets/emeraldMonsterReferences.json": "whole",
  "src/assets/gothicManorReferences.json": "whole",
  "src/assets/joseonBaramReferences.json": "whole",
  "src/assets/jpCityReferences.json": "whole",
  "src/assets/jpForestReferences.json": "whole",
  "src/assets/modernCampusInteriorReferences.json": "whole",
  "src/assets/modernCampusReferences.json": "whole",
  "src/assets/modernCityReferences.json": "whole",
  "src/assets/pirateIslesReferences.json": "whole",
  "src/assets/prehistoricReferences.json": "whole",
  "src/assets/sengokuEdoReferences.json": "whole",
  "src/assets/sfStationReferences.json": "whole",
  "src/assets/sharedHandInteriorReferences.json": "whole",
  "src/assets/skyIslandReferences.json": "whole",
  "src/assets/snowNorthReferences.json": "whole",
  "src/assets/steampunkCityReferences.json": "whole",
  "src/assets/wizardingWorldReferences.json": "whole",
  "src/assets/worldmapAuthoringReferences.json": "whole",
  "src/assets/worldmapMaterialReferences.json": "whole",
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
