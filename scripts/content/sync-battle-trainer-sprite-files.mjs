#!/usr/bin/env node
// Regenerates src/assets/battleTrainerSpriteFiles.json — the authoritative list of files that actually exist under
// public/assets/battle-trainers/<role>/. The release dependency collector needs this because the runtime builds
// /assets/battle-trainers/<role>/<file>.png straight from troop.trainerSprite (battleAssetPrefetch.ts:69,
// emeraldTrainerIntro.ts:40), so the file names never appear in the project JSON and the collector shipped nothing
// (QA-AH119-001: 10 astra trainer sprites 404 in the exported bundle). index.json only knows the 14 shared roles,
// so it cannot answer this on its own.
//
// usage: node scripts/content/sync-battle-trainer-sprite-files.mjs [--check]
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SPRITE_DIR = join(ROOT, "public/assets/battle-trainers");
const OUT = join(ROOT, "src/assets/battleTrainerSpriteFiles.json");

/** @returns {Record<string, string[]>} role -> sorted file names (png only, index.json excluded) */
export function readSpriteFiles(dir = SPRITE_DIR) {
  const files = {};
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pngs = readdirSync(join(dir, entry.name)).filter((name) => name.endsWith(".png")).sort();
    if (pngs.length > 0) files[entry.name] = pngs;
  }
  return files;
}

function main() {
  const current = readSpriteFiles();
  const text = `${JSON.stringify(current, null, 2)}\n`;

  if (process.argv.includes("--check")) {
    const existing = readFileSync(OUT, "utf8");
    if (existing !== text) {
      console.error("battleTrainerSpriteFiles.json is stale — run: node scripts/content/sync-battle-trainer-sprite-files.mjs");
      process.exit(1);
    }
    console.log(`battleTrainerSpriteFiles.json is current (${Object.keys(current).length} roles)`);
    return;
  }

  writeFileSync(OUT, text);
  console.log(`wrote ${OUT} (${Object.keys(current).length} roles, ${Object.values(current).flat().length} files)`);
}

// Importing this module (the vitest sync check) must not write anything.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
