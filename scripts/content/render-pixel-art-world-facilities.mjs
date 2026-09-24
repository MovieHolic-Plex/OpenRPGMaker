// Local research output only. Never downloads or copies source PNGs into the repository.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import pngjs from 'pngjs';
const { PNG } = pngjs;
const sourceDir = process.argv[2];
if (!sourceDir) throw new Error('Usage: node scripts/content/render-pixel-art-world-facilities.mjs <user-png-directory> [gitignored-output-directory]');
const out = resolve(process.argv[3] ?? new URL('../../output/paw-facilities', import.meta.url).pathname);
await mkdir(out, { recursive: true });
const packs = JSON.parse(await readFile(new URL('../../src/assets/pixelArtWorldFacilitiesCatalog.json', import.meta.url), 'utf8'));
const proof = [];
for (const pack of packs) {
  const bytes = await readFile(join(sourceDir, pack.filename));
  if (createHash('sha256').update(bytes).digest('hex') !== pack.sha256) throw new Error(`Source hash mismatch: ${pack.filename}`);
  const sheet = PNG.sync.read(bytes);
  if (sheet.width !== pack.width || sheet.height !== pack.height) throw new Error(`Source dimensions mismatch: ${pack.filename}`);
  for (const scene of pack.scenes ?? []) {
    const picture = new PNG({ width: scene.width * 32, height: scene.height * 32 });
    for (let i = 0; i < picture.data.length; i += 4) picture.data.set([41, 41, 52, 255], i);
    for (const layer of [scene.lowerTiles, scene.upperTiles]) layer.forEach((tile, index) => {
      if (tile < 0) return;
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const from = ((Math.floor(tile / 8) * 32 + y) * sheet.width + tile % 8 * 32 + x) * 4;
        const to = ((Math.floor(index / scene.width) * 32 + y) * picture.width + index % scene.width * 32 + x) * 4;
        const alpha = sheet.data[from + 3] / 255;
        for (let c = 0; c < 3; c++) picture.data[to + c] = Math.round(sheet.data[from + c] * alpha + picture.data[to + c] * (1 - alpha));
      }
    });
    let groundedObjects = 0;
    for (const placement of scene.placements) {
      const recipe = pack.recipes.find(r => r.id === placement.recipeId);
      if (recipe.placementKind !== 'standing') continue;
      const r = recipe.sourceRect;
      let bottom = -1;
      for (let y = r.height * 32 - 1; y >= 0 && bottom < 0; y--) for (let x = 0; x < r.width * 32; x++) {
        const i = ((r.y * 32 + y) * sheet.width + r.x * 32 + x) * 4;
        if (sheet.data[i + 3]) { bottom = y; break; }
      }
      if (bottom < 0) throw new Error(`Empty standing object: ${recipe.id}`);
      const supportXs = new Set();
      for (let x = 0; x < r.width * 32; x++) {
        const i = ((r.y * 32 + bottom) * sheet.width + r.x * 32 + x) * 4;
        if (sheet.data[i + 3]) supportXs.add(Math.floor(x / 32));
      }
      for (const dx of supportXs) {
        const x = placement.x + dx, y = placement.y + Math.floor(bottom / 32);
        if (!scene.passableTiles.includes(scene.lowerTiles[y * scene.width + x])) throw new Error(`ALPHA_FOOT_NOT_ON_FLOOR ${scene.id}/${recipe.id} at ${x},${y}`);
      }
      groundedObjects++;
    }
    await writeFile(join(out, `${scene.id}.png`), PNG.sync.write(picture));
    const enlarged = new PNG({ width: picture.width * 2, height: picture.height * 2 });
    for (let y = 0; y < enlarged.height; y++) for (let x = 0; x < enlarged.width; x++) {
      const i = (Math.floor(y / 2) * picture.width + Math.floor(x / 2)) * 4;
      enlarged.data.set(picture.data.subarray(i, i + 4), (y * enlarged.width + x) * 4);
    }
    await writeFile(join(out, `${scene.id}-2x.png`), PNG.sync.write(enlarged));
    proof.push({ scene: scene.id, groundedObjects, sourceSha256: pack.sha256, size: [scene.width, scene.height] });
  }
}
await writeFile(join(out, 'grounding-proof.json'), JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify(proof));
