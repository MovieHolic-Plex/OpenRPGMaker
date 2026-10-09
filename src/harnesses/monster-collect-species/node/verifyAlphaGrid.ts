/** Focused executable fixture checks; no generation, picks, canonical writes or test runner.
 * node_modules/.bin/vite-node --script src/harnesses/monster-collect-species/node/verifyAlphaGrid.ts -- <out> [sample.png] [baseline-grid.ts]
 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { edgeProfiles, extractGrid } from '../pixel/grid';
import { cloneImage, composeOn, createImage, pixelAt, scaleNearest, setPixel, type Rgba, type RgbaImage } from '../pixel/image';
import { pixelize, toSprite } from '../pixel/pipeline';
import { readPng, writePng } from './png';

const [destination, samplePath, baselinePath] = process.argv.slice(2).filter((arg, index) => !(index === 0 && arg === '--'));
assert(destination, 'Supply a private output directory');
const out = resolve(destination);
mkdirSync(out, { recursive: true });
const report: Record<string, unknown> = {};
const fixture = (background: Rgba): RgbaImage => {
  const image = createImage(64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    setPixel(image, x, y, background);
    if (x >= 16 && x < 48 && y >= 8 && y < 48) setPixel(image, x, y, [255, 255, 255, 255]);
    if (x >= 32 && x < 40 && y >= 16 && y < 24) setPixel(image, x, y, [24, 32, 48, 255]);
    if (x >= 24 && x < 40 && y >= 48 && y < 56) setPixel(image, x, y, [24, 32, 48, 255]);
  }
  return image;
};
const transparent = fixture([255, 255, 255, 0]);
const expected = Uint8Array.from({ length: 64 * 64 }, (_, i) => transparent.data[i * 4 + 3]! < 128 ? 1 : 0);
assert.deepEqual(edgeProfiles(transparent).bg, expected, 'Opaque white connected through hidden white RGB must survive');
const randomized = cloneImage(transparent);
for (let i = 0; i < expected.length; i++) if (expected[i]) randomized.data.set([i % 150, (i * 7) % 150, (i * 13) % 150, i % 128], i * 4);
assert.deepEqual(edgeProfiles(randomized).bg, expected, 'Hidden RGB and alpha0..127 cannot change the foreground mask');
const threshold = cloneImage(transparent);
setPixel(threshold, 0, 0, [255, 255, 255, 127]);
setPixel(threshold, 1, 0, [255, 255, 255, 128]);
assert.equal(edgeProfiles(threshold).bg[0], 1);
assert.equal(edgeProfiles(threshold).bg[1], 0);
for (const [name, background] of [['opaque-flat', [60, 90, 120, 255]], ['opaque-magenta', [255, 0, 255, 255]]] as const) {
  const image = fixture(background);
  assert.deepEqual(edgeProfiles(image).bg, expected, `${name} cleanup must retain white foreground`);
  writePng(join(out, name + '.png'), image);
  const result = pixelize(image, 20, { block: 8 });
  assert.equal(result.block, 8);
  writePng(join(out, name + '-grid.png'), scaleNearest(result.grid, 24));
}
const whiteBackground = fixture([255, 255, 255, 255]);
const flatWithHole = fixture([60, 90, 120, 255]);
setPixel(flatWithHole, 24, 24, [255, 255, 255, 0]);
const holeExpected = new Uint8Array(expected);
holeExpected[24 * 64 + 24] = 1;
assert.deepEqual(edgeProfiles(flatWithHole).bg, holeExpected, 'An internal alpha0 hole must not disable opaque-flat background cleanup');
writePng(join(out, 'opaque-flat-internal-hole.png'), flatWithHole);
// A dark outline encloses a white patch: flood may erase exterior white but cannot cross the outline.
for (let y = 8; y < 48; y++) for (let x = 16; x < 48; x++) setPixel(whiteBackground, x, y, [24, 32, 48, 255]);
for (let y = 16; y < 40; y++) for (let x = 24; x < 40; x++) setPixel(whiteBackground, x, y, [255, 255, 255, 255]);
const whiteMask = edgeProfiles(whiteBackground).bg;
assert.equal(whiteMask[0], 1);
assert.equal(whiteMask[24 * 64 + 32], 0, 'Enclosed white detail survives opaque-white background flood');
writePng(join(out, 'opaque-white.png'), whiteBackground);
for (const block of [1, 41, 2.5, NaN, Infinity]) assert.throws(() => extractGrid(transparent, { block }), /2~40/);
const repaired = pixelize(transparent, 20, { block: 8 });
assert.equal(repaired.block, 8);
assert([...repaired.grid.data].some((value, i) => i % 4 === 0 && value === 255 && repaired.grid.data[i + 3] === 255));
writePng(join(out, 'alpha-white.png'), transparent);
writePng(join(out, 'alpha-white-grid.png'), scaleNearest(repaired.grid, 24));
report.fixtures = { opaqueWhitePreserved: true, hiddenRgbInvariant: true, threshold128Unchanged: true, opaqueFlatCleanup: true, internalHoleKeepsFlatCleanup: true, magentaCleanup: true, opaqueWhiteCleanup: true };

// Exercise the actual import stage exclusively in a private sandbox. Never call pick/build/generation.
const sandbox = join(out, 'cli-sandbox');
process.env.MONSTER_HARNESS_SANDBOX = sandbox;
mkdirSync(join(sandbox, 'data'), { recursive: true });
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const seedBytes = readFileSync(join(repo, 'harness-data/monster-collect-species/seed.json'));
writeFileSync(join(sandbox, 'data/seed.json'), seedBytes);
const speciesId = JSON.parse(seedBytes.toString()).species[0].id as string;
const { run } = await import('./cli');
for (const value of ['1', '41', '2.5', 'NaN', 'Infinity', 'nonsense', 'true']) {
  await assert.rejects(run(['import', '--block', value]), /--block.*2~40/);
}
const provenance: unknown[] = [];
for (const [block, side] of [[8, 'front'], [2, 'back'], [40, 'front']] as const) {
  // Avoid the existing one-second run-id collision for the two front imports.
  if (block === 40) await new Promise(done => setTimeout(done, 1100));
  const raw = join(out, `cli-block-${block}.png`);
  writePng(raw, block === 40 ? scaleNearest(transparent, 8) : transparent);
  assert.equal(await run(['import', '--species', speciesId, '--side', side, '--raw', raw, '--block', String(block)]), 0);
  const directory = join(sandbox, 'runs', speciesId, side);
  const id = readdirSync(directory).sort().at(-1)!;
  const record = JSON.parse(readFileSync(join(directory, id, 'run.json'), 'utf8'));
  assert.equal(record.fixedBlock, block);
  assert.equal(record.candidates.length, 1);
  assert.equal(record.candidates[0].block, block);
  provenance.push({ side, fixedBlock: record.fixedBlock, candidateBlock: record.candidates[0].block, sha256: record.candidates[0].sha256 });
}
report.cli = { invalidRejected: 7, boundary2and40Accepted: true, provenance };
await new Promise(done => setTimeout(done, 1100));
assert.equal(await run(['import', '--species', speciesId, '--side', 'back', '--raw', join(out, 'alpha-white.png')]), 0);
const defaultDirectory = join(sandbox, 'runs', speciesId, 'back');
const defaultRun = readdirSync(defaultDirectory).sort().at(-1)!;
const defaultRecord = JSON.parse(readFileSync(join(defaultDirectory, defaultRun, 'run.json'), 'utf8'));
assert.equal('fixedBlock' in defaultRecord, false);
assert.equal(defaultRecord.candidates.length, 1);
report.defaultImport = { fixedBlockOmitted: true, inferredBlock: defaultRecord.candidates[0].block };

if (samplePath) {
  const source = readPng(samplePath);
  const alphaWhite = cloneImage(source);
  const opaqueMagenta = cloneImage(source);
  for (let i = 0; i < source.width * source.height; i++) if (source.data[i * 4 + 3]! < 128) {
    alphaWhite.data.set([255, 255, 255, source.data[i * 4 + 3]!], i * 4);
    opaqueMagenta.data.set([255, 0, 255, 255], i * 4);
  }
  const current = edgeProfiles(source).bg;
  assert.deepEqual(edgeProfiles(alphaWhite).bg, current);
  assert.deepEqual(edgeProfiles(opaqueMagenta).bg, current);
  const original = pixelize(source, 20, { block: 8 });
  const white = pixelize(alphaWhite, 20, { block: 8 });
  const magenta = pixelize(opaqueMagenta, 20, { block: 8 });
  assert.deepEqual(white.grid, original.grid);
  assert.deepEqual(magenta.grid, original.grid);
  writePng(join(out, 'sample-original.png'), source);
  writePng(join(out, 'sample-alpha-white.png'), alphaWhite);
  writePng(join(out, 'sample-opaque-magenta.png'), opaqueMagenta);
  const preview = composeOn([72, 104, 120, 255], original.grid.width, original.grid.height, original.grid, 0, 0);
  writePng(join(out, 'sample-fixed-grid.png'), scaleNearest(preview, 6));
  writePng(join(out, 'sample-fixed-sprite.png'), scaleNearest(toSprite(original.grid, 'front').sprite, 3));
  const sample: Record<string, unknown> = { path: samplePath, sourceWidth: source.width, sourceHeight: source.height,
    block: original.block, fixedForegroundPixels: current.length - current.reduce((sum, value) => sum + value, 0),
    originalAlphaWhiteAndOpaqueMagentaEqual: true, preparation: 'Only RGB of alpha<128 was whitened for alpha-white variant; visible source pixels are unchanged. Opaque-magenta variant replaces only those background pixels.' };
  sample.actualCorners = [[0, 0], [source.width - 1, 0], [0, source.height - 1], [source.width - 1, source.height - 1]].map(([x, y]) => pixelAt(source, x!, y!));
  const alphaRgb = new Map<string, number>();
  for (let i = 0; i < source.width * source.height; i++) if (source.data[i * 4 + 3]! < 128) {
    const rgb = [...source.data.subarray(i * 4, i * 4 + 3)].join(',');
    alphaRgb.set(rgb, (alphaRgb.get(rgb) ?? 0) + 1);
  }
  sample.actualHiddenRgbMostCommon = [...alphaRgb.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (baselinePath) {
    // Optional historical baseline outside Vite's filesystem allowlist. Node24 strips its TS;
    // fixtures without a baseline stay on the normal vite-node path.
    const baseline = createRequire(import.meta.url)(resolve(baselinePath)) as { edgeProfiles(image: RgbaImage): { bg: Uint8Array }; extractGrid(image: RgbaImage, options: { block: number }): { cells: RgbaImage } };
    const fixtureBefore = baseline.edgeProfiles(transparent).bg;
    const fixtureLost = [...fixtureBefore].filter((value, i) => value && !expected[i]).length;
    assert(fixtureLost > 0, 'Connected opaque white fixture must reproduce the old RGB flood bug');
    report.fixtureBaselineErasedForegroundPixels = fixtureLost;
    const fixtureCells = baseline.extractGrid(transparent, { block: 8 }).cells;
    writePng(join(out, 'alpha-white-baseline-grid.png'), scaleNearest(composeOn([72, 104, 120, 255], fixtureCells.width, fixtureCells.height, fixtureCells, 0, 0), 24));
    const before = baseline.edgeProfiles(alphaWhite).bg;
    sample.alphaWhiteVariantBaselineErasedForegroundPixels = [...before].filter((value, i) => value && !current[i]).length;
    const actualBefore = baseline.edgeProfiles(source).bg;
    sample.actualBaselineErasedForegroundPixels = [...actualBefore].filter((value, i) => value && !current[i]).length;
    const actualCells = baseline.extractGrid(source, { block: 8 }).cells;
    writePng(join(out, 'sample-actual-baseline-grid.png'), scaleNearest(composeOn([72, 104, 120, 255], actualCells.width, actualCells.height, actualCells, 0, 0), 6));
    const cells = baseline.extractGrid(alphaWhite, { block: 8 }).cells;
    writePng(join(out, 'sample-baseline-grid.png'), scaleNearest(composeOn([72, 104, 120, 255], cells.width, cells.height, cells, 0, 0), 6));
  }
  report.sample = sample;
}
report.completed = true;
writeFileSync(join(out, 'record.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
