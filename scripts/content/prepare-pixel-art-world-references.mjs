// Metadata only. Never fetch or bundle the author's artwork.
import { readFile, writeFile } from 'node:fs/promises';
const source = new URL('../../tiledata/pixel-art-world/catalog.json', import.meta.url);
const packs = JSON.parse(await readFile(source, 'utf8'));
for (const pack of packs) {
  if (pack.width !== 256 || pack.tileSize !== 32 || pack.height % 32 || !/^[a-f0-9]{64}$/.test(pack.sha256)) throw Error(`Invalid sheet: ${pack.id}`);
  const count = pack.width * pack.height / 1024;
  if (!Number.isInteger(pack.floorTile) || pack.floorTile < 0 || pack.floorTile >= count) throw Error(`Invalid floor: ${pack.id}`);
  if (new Set(pack.recipes.map(recipe => recipe.id)).size !== pack.recipes.length) throw Error(`Duplicate recipes: ${pack.id}`);
  for (const recipe of pack.recipes) {
    const r = recipe.sourceRect;
    if (Object.values(r).some(v => !Number.isInteger(v)) || r.x < 0 || r.y < 0 || r.width < 1 || r.height < 1 || r.x + r.width > 8 || r.y + r.height > pack.height / 32) throw Error(`Invalid rectangle: ${recipe.id}`);
    recipe.tiles = Array.from({ length: r.height }, (_, y) => Array.from({ length: r.width }, (_, x) => (r.y + y) * 8 + r.x + x));
    if (recipe.tiles.flat().some(tile => tile >= count || tile === pack.floorTile)) throw Error(`Invalid tile: ${recipe.id}`);
  }
}
await writeFile(new URL('../../src/assets/pixelArtWorldCatalog.json', import.meta.url), JSON.stringify(packs, null, 2) + '\n');
console.log(`Prepared ${packs.length} metadata-only packs / ${packs.reduce((n, p) => n + p.recipes.length, 0)} furniture recipes`);
