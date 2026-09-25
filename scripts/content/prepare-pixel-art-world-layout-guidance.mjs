import { readFile, writeFile } from 'node:fs/promises';
const markdown = await readFile(new URL('../../tiledata/pixel-art-world/MAPPING-RESEARCH.md', import.meta.url), 'utf8');
await writeFile(new URL('../../src/assets/pixelArtWorldLayoutGuidance.json', import.meta.url), JSON.stringify({ markdown }, null, 2) + '\n');
