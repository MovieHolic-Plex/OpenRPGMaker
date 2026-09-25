// Offline local evidence only. Provide original PNGs downloaded by the user.
// Outputs stay in gitignored output/; this script never downloads or publishes art.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pngjs from 'pngjs';
const { PNG } = pngjs;
const input = process.argv[2];
if (!input) throw Error('Usage: node scripts/content/render-pixel-art-world-static-expansion.mjs /absolute/user-png-directory');
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = resolve(root, 'output/paw-static-expansion/rendered');
const packs = JSON.parse(await readFile(new URL('../../src/assets/pixelArtWorldStaticExpansionCatalog.json', import.meta.url), 'utf8'));
await mkdir(output, { recursive: true });
function drawTile(source, target, tile, x, y) {
  if (tile < 0) return;
  for (let py = 0; py < 32; py++) for (let px = 0; px < 32; px++) {
    const si = ((Math.floor(tile / 8) * 32 + py) * source.width + tile % 8 * 32 + px) * 4;
    const di = ((y * 32 + py) * target.width + x * 32 + px) * 4;
    const a = source.data[si + 3] / 255, b = target.data[di + 3] / 255, out = a + b * (1 - a);
    for (let c = 0; c < 3; c++) target.data[di + c] = out ? Math.round((source.data[si + c] * a + target.data[di + c] * b * (1 - a)) / out) : 0;
    target.data[di + 3] = Math.round(out * 255);
  }
}
function render(source, scene) {
  const image = new PNG({ width: scene.width * 32, height: scene.height * 32 });
  for (const layer of [scene.lowerTiles, scene.upperTiles]) layer.forEach((tile, index) => drawTile(source, image, tile, index % scene.width, Math.floor(index / scene.width)));
  return image;
}
function differences(expected, actual) {
  const errors = [];
  for (const [layer, code] of [['lowerTiles', 'LOWER_CELL'], ['upperTiles', 'UPPER_CELL']]) expected[layer].forEach((tile, index) => {
    if (actual[layer][index] !== tile) errors.push({ code, x: index % expected.width, y: Math.floor(index / expected.width) });
  });
  for (const cell of expected.approachCells) {
    const i = cell.y * expected.width + cell.x;
    if (actual.upperTiles[i] !== -1 || !expected.passableTiles.includes(actual.lowerTiles[i])) errors.push({ code: 'APPROACH_BLOCKED', ...cell });
  }
  return errors;
}
const report = [];
for (const pack of packs) {
  const sourcePath = join(resolve(input), pack.filename);
  const bytes = await readFile(sourcePath);
  if (createHash('sha256').update(bytes).digest('hex') !== pack.sha256) throw Error(`Unrecognized original: ${pack.filename}`);
  const source = PNG.sync.read(bytes);
  if (source.width !== pack.width || source.height !== pack.height) throw Error(`Dimension mismatch: ${pack.filename}`);
  for (const scene of pack.scenes) {
    // Lower cells have no backing layer: reject transparent fragments before rendering.
    for (const tile of new Set(scene.lowerTiles)) {
      if (tile < 0) throw Error(`Missing floor in ${scene.id}`);
      for (let py = 0; py < 32; py++) for (let px = 0; px < 32; px++) {
        const alpha = source.data[((Math.floor(tile / 8) * 32 + py) * source.width + tile % 8 * 32 + px) * 4 + 3];
        if (alpha !== 255) throw Error(`Transparent lower tile ${tile} in ${scene.id}; keep its floor and move fragment to upper`);
      }
    }
    const good = render(source, scene);
    await writeFile(join(output, `${scene.id}.png`), PNG.sync.write(good));
    const bad = structuredClone(scene);
    // Use real occupied cells and the scene's own entrance, irrespective of room size.
    const missing = scene.upperTiles.findIndex(tile => tile >= 0);
    const moved = scene.upperTiles.findIndex((tile, index) => tile >= 0 && scene.passableTiles.includes(scene.lowerTiles[index]));
    const entry = scene.approachCells[0];
    const obstruction = scene.upperTiles[missing];
    bad.upperTiles[missing] = -1;
    bad.upperTiles[entry.y * scene.width + entry.x] = obstruction;
    if (moved >= 0) {
      bad.lowerTiles[moved] = scene.upperTiles[moved];
      bad.upperTiles[moved] = -1;
    }
    const errors = differences(scene, bad);
    const incorrect = render(source, bad);
    const comparison = new PNG({ width: good.width * 2 + 8, height: good.height });
    PNG.bitblt(good, comparison, 0, 0, good.width, good.height, 0, 0);
    PNG.bitblt(incorrect, comparison, 0, 0, incorrect.width, incorrect.height, good.width + 8, 0);
    await writeFile(join(output, `${scene.id}-comparison.png`), PNG.sync.write(comparison));
    await writeFile(join(output, `${scene.id}-arrays.json`), JSON.stringify({ expected: scene, incorrect: bad, errors }, null, 2) + '\n');
    report.push({ pack: pack.id, sourcePath, sha256: pack.sha256, scene: scene.id, dimensions: [good.width, good.height], entry: scene.approachCells[0], spawn: { ...scene.approachCells[1], facing: 'north' }, errors, limitation: 'Source-pixel fixture only; no live project write, runtime event execution or AI success-rate claim.' });
  }
  // Inspect every complete rectangle on real floor; no index diagrams or synthetic blocks.
  const tilesAcross = 20, gutter = 1;
  let x = 1, y = 1, rowHeight = 0;
  const parts = [];
  for (const recipe of pack.recipes) {
    const w = recipe.sourceRect.width, h = recipe.sourceRect.height;
    if (x + w + 1 > tilesAcross) { x = 1; y += rowHeight + 2; rowHeight = 0; }
    parts.push({ recipe, x, y }); x += w + 2; rowHeight = Math.max(rowHeight, h);
  }
  const height = y + rowHeight + gutter;
  const sheet = { width: tilesAcross, height, lowerTiles: Array(tilesAcross * height).fill(pack.floorTile), upperTiles: Array(tilesAcross * height).fill(-1) };
  for (const part of parts) part.recipe.tiles.forEach((row, dy) => row.forEach((tile, dx) => { sheet.upperTiles[(part.y + dy) * tilesAcross + part.x + dx] = tile; }));
  await writeFile(join(output, `${pack.id}-parts.png`), PNG.sync.write(render(source, sheet)));
}
await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`Local artwork evidence: ${output}`);
