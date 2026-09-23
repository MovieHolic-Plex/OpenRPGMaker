// Shared metadata only. No source artwork is fetched, embedded or copied.
import { readFile, writeFile } from 'node:fs/promises';
const packs = JSON.parse(await readFile(new URL('../../tiledata/pixel-art-world/autotiles.json', import.meta.url), 'utf8'));
if (!Array.isArray(packs) || new Set(packs.map(pack => pack.id)).size !== packs.length) throw Error('Duplicate/invalid autotile catalog');
for (const pack of packs) {
  if (!/^[\w.-]+$/.test(pack.id) || !/^[a-f0-9]{64}$/.test(pack.sha256)
    || pack.defaultLayer !== 'lower' || !['solid', 'passable'].includes(pack.passage)
    || !['wall', 'terrain', 'roof'].includes(pack.role) || !/^SA-[\w]+\.png$/.test(pack.filename)) throw Error(`Invalid XP source: ${pack.id}`);
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
