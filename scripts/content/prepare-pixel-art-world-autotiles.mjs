// Shared metadata only. No source artwork is fetched, embedded or copied.
import { readFile, writeFile } from 'node:fs/promises';
const packs = JSON.parse(await readFile(new URL('../../tiledata/pixel-art-world/autotiles.json', import.meta.url), 'utf8'));
if (!Array.isArray(packs) || new Set(packs.map(pack => pack.id)).size !== packs.length || new Set(packs.map(pack => pack.sha256)).size !== packs.length) throw Error('Duplicate/invalid autotile catalog');
for (const pack of packs) {
  if (!/^[\w.-]+$/.test(pack.id) || !/^[a-f0-9]{64}$/.test(pack.sha256)
    || !['lower', 'upper'].includes(pack.defaultLayer) || !['solid', 'passable'].includes(pack.passage)
    || !['wall', 'terrain', 'roof', 'fence', 'prop', 'water'].includes(pack.role) || !/^SA-[\w-]+\.png$/.test(pack.filename)) throw Error(`Invalid XP source: ${pack.id}`);
  if (pack.quarterLayout !== 'xp-full-edge-v1' || ![1, 4].includes(pack.frames) || pack.sourceWidth !== 96 * pack.frames || pack.sourceHeight !== 128
    || !['lower-autoshape', 'manual-mask'].includes(pack.placement)
    || (pack.placement === 'lower-autoshape' && (pack.defaultLayer !== 'lower' || pack.shapePolicy !== 'blob'))
    || !['blob', 'rectangle'].includes(pack.shapePolicy) || pack.terrainTag !== 0
    || !['none', 'floor', 'wall', 'roof', 'material'].includes(pack.underlay)
    || !Array.isArray(pack.aliases) || !pack.aliases.length || !Array.isArray(pack.restrictions)
    || !Array.isArray(pack.nonOpaqueMasks)) throw Error(`Invalid XP policy: ${pack.id}`);
  if (pack.frames === 4 && (!(pack.fps > 0) || pack.timingProvenance !== 'editor-default-not-author-specified'
    || pack.framePixelHashes?.length !== 4)) throw Error(`Invalid XP animation: ${pack.id}`);
  for (const alias of pack.aliases) {
    const url = new URL(alias.downloadUrl);
    if (url.protocol !== 'https:' || url.hostname !== 'yms.main.jp' || !url.pathname.endsWith('/' + alias.filename)) throw Error(`Invalid XP alias: ${pack.id}`);
  }
  for (const field of ['name', 'description', 'credit', 'checkedAt']) {
    if (typeof pack[field] !== 'string' || !pack[field].trim()) throw Error(`Missing ${field}: ${pack.id}`);
  }
  for (const field of ['sourcePage', 'downloadUrl', 'termsUrl']) {
    const url = new URL(pack[field]);
    if (url.protocol !== 'https:' || url.hostname !== 'yms.main.jp') throw Error(`Unexpected author URL: ${pack.id}`);
  }
  if (!pack.downloadUrl.endsWith(`/${pack.filename}`)) throw Error(`Filename URL mismatch: ${pack.id}`);
}
await writeFile(new URL('../../src/assets/pixelArtWorldAutotiles.json', import.meta.url), JSON.stringify(packs, null, 2) + '\n');
console.log(`Prepared ${packs.length} metadata-only XP autotile sources`);
