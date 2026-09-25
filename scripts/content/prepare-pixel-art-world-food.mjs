// Metadata only: no artwork downloads or payloads in generated bundles.
import { readFile, writeFile } from 'node:fs/promises';
const data = JSON.parse(await readFile(new URL('../../tiledata/pixel-art-world/food.json', import.meta.url), 'utf8'));
if (data.packs.length !== 10)
    throw Error('Expected the ten catalog29 source variants');
const s = data.support;
if (s.canvas.width !== 96 || s.canvas.height !== 96 || s.sourceRect.width !== 96 || s.sourceRect.height !== 64 || s.tableOrigin.x !== 0 || s.tableOrigin.y !== 32 || s.foodAnchor.x !== 48 || s.foodAnchor.y !== 55)
    throw Error('Unsupported support geometry');
const ids = new Set();
for (const p of data.packs) {
    if (ids.has(p.id) || p.columns !== 4 || p.tileSize !== 32 || p.width !== 128 || p.height % 32 || !/^[a-f0-9]{64}$/.test(p.sha256))
        throw Error(`Invalid pack ${p.id}`);
    ids.add(p.id);
    const covered = new Set();
    for (const r of p.recipes) {
        if (ids.has(r.id))
            throw Error(`Duplicate ${r.id}`);
        ids.add(r.id);
        const q = r.pixelRect, b = r.alphaBounds;
        if ([q.x, q.y, q.width, q.height].some(v => !Number.isInteger(v) || v % 32) || q.x < 0 || q.y < 0 || q.width < 32 || q.height < 32 || q.x + q.width > p.width || q.y + q.height > p.height)
            throw Error(`Source bounds ${r.id}`);
        if (r.sourceRect.x * 32 !== q.x || r.sourceRect.y * 32 !== q.y || r.sourceRect.width * 32 !== q.width || r.sourceRect.height * 32 !== q.height)
            throw Error(`Pixel/grid mismatch ${r.id}`);
        if (r.anchor.x !== b.x + Math.floor(b.width / 2) || r.anchor.y !== b.y + b.height - 1)
            throw Error(`Anchor mismatch ${r.id}`);
        if (b.x < 0 || b.y < 0 || b.width < 1 || b.height < 1 || b.x + b.width > q.width || b.y + b.height > q.height)
            throw Error(`Alpha bounds ${r.id}`);
        for (let y = q.y / 32; y < (q.y + q.height) / 32; y++)
            for (let x = q.x / 32; x < (q.x + q.width) / 32; x++) {
                const i = y * 4 + x;
                if (covered.has(i))
                    throw Error(`Overlapping source ${r.id}`);
                covered.add(i);
            }
        r.tiles = Array.from({ length: q.height / 32 }, (_, y) => Array.from({ length: q.width / 32 }, (_, x) => (q.y / 32 + y) * 4 + q.x / 32 + x));
        if (r.composition === 'table' && (b.width > 92 || b.height > 56))
            throw Error(`Cannot safely fit table ${r.id}`);
    }
    if (covered.size !== p.width * p.height / 1024)
        throw Error(`Incomplete source coverage ${p.id}`);
    p.coverage = { cells: covered.size, recipes: p.recipes.length, tableComposites: p.recipes.filter(r => r.composition === 'table').length, excludedCompositionIds: p.recipes.filter(r => r.composition !== 'table').map(r => r.id) };
}
await writeFile(new URL('../../src/assets/pixelArtWorldFoodCatalog.json', import.meta.url), JSON.stringify(data, null, 2) + '\n');
console.log(JSON.stringify(data.packs.map(p => ({ id: p.id, ...p.coverage }))));
