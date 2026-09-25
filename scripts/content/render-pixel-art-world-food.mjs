// Private, read-only browser preparation evidence. No project import/store/save calls.
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const input = process.argv[2], origin = process.argv[3] ?? 'http://127.0.0.1:9877';
if (!input)
    throw Error('Usage: node scripts/content/render-pixel-art-world-food.mjs /absolute/downloads http://127.0.0.1:9877');
const out = resolve('output/paw-food/browser');
await mkdir(out, { recursive: true });
await writeFile(join(out, 'index.html'), '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>Private food preparation</title></head><body></body></html>');
const catalog = JSON.parse(await readFile('src/assets/pixelArtWorldFoodCatalog.json', 'utf8'));
const support = await readFile(join(input, catalog.support.filename));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } }), errors = [], blocked = [];
try {
    page.on('pageerror', e => errors.push(String(e)));
    await page.route('**/*', route => { const r = route.request(), u = new URL(r.url()); if (['http:', 'https:'].includes(u.protocol) && (u.origin !== origin || !['GET', 'HEAD'].includes(r.method()))) {
        blocked.push({ url: r.url(), method: r.method() });
        return route.abort();
    } return route.continue(); });
    await page.goto(origin + '/output/paw-food/browser/index.html');
    const report = [];
    for (const pack of catalog.packs) {
        const bytes = await readFile(join(input, 'by-source/sozai/food', pack.filename));
        const value = await page.evaluate(async ({ id, food, table }) => {
            const { PIXEL_ART_WORLD_FOOD, PIXEL_ART_WORLD_FOOD_SUPPORT } = await import('/src/project/pixelArtWorldFood.ts');
            const { preparePixelArtWorldFood } = await import('/src/editor/pixelArtWorldFoodImport.ts');
            const p = PIXEL_ART_WORLD_FOOD.find(v => v.id === id), file = (b, n) => new File([Uint8Array.from(atob(b), c => c.charCodeAt(0))], n, { type: 'image/png' });
            return preparePixelArtWorldFood(file(food, p.filename), p, file(table, PIXEL_ART_WORLD_FOOD_SUPPORT.filename));
        }, { id: pack.id, food: bytes.toString('base64'), table: support.toString('base64') });
        await writeFile(join(out, `${pack.id}-prepared.json`), JSON.stringify(value, null, 2) + '\n');
        for (const p of value.prepared)
            await writeFile(join(out, `${p.tileset.id === value.prepared[0].tileset.id ? pack.id + '-source' : pack.id + '-atlas'}.png`), Buffer.from(p.dataUrl.split(',')[1], 'base64'));
        const pictures = value.prepared[1].tileset.referenceDocuments[0].images;
        const contact = await page.evaluate(async (pictures) => { const c = document.createElement('canvas'); c.width = 4 * 160; c.height = Math.ceil(pictures.length / 4) * 184; const ctx = c.getContext('2d'); ctx.fillStyle = '#eee'; ctx.fillRect(0, 0, c.width, c.height); ctx.font = '12px sans-serif'; ctx.fillStyle = '#111'; for (let i = 0; i < pictures.length; i++) {
            const im = new Image();
            im.src = pictures[i].dataUrl;
            await im.decode();
            ctx.drawImage(im, 0, 0, 160, 160, (i % 4) * 160, Math.floor(i / 4) * 184, 160, 160);
            ctx.fillText(String(i) + ' ' + pictures[i].id.split('-').slice(-1)[0], i % 4 * 160 + 4, Math.floor(i / 4) * 184 + 176);
        } return c.toDataURL(); }, pictures);
        await writeFile(join(out, `${pack.id}-all-tables.png`), Buffer.from(contact.split(',')[1], 'base64'));
        const refs = value.prepared.flatMap(p => p.tileset.referenceDocuments);
        report.push({ packId: pack.id, sourceFilename: pack.filename, sourceSha256: value.sourceSha256, supportSha256: value.supportSha256, sourceCells: value.prepared[0].tileset.count, rawGroups: value.prepared[0].tileset.tileGroups.length, compositeGroups: value.kits.length, rawObjects: value.prepared[0].tileset.structureKits.length, composedObjects: value.prepared[1].tileset.structureKits.length, categories: refs.length, documents: refs.reduce((a, r) => a + r.documents.length, 0), images: refs.reduce((a, r) => a + r.images.length, 0), excluded: value.excludedCompositionIds });
    }
    const rejection = await page.evaluate(async () => { const { PIXEL_ART_WORLD_FOOD } = await import('/src/project/pixelArtWorldFood.ts'); const { preparePixelArtWorldFood } = await import('/src/editor/pixelArtWorldFoodImport.ts'); try {
        await preparePixelArtWorldFood(new File(['wrong'], 'food.png'), PIXEL_ART_WORLD_FOOD[0], new File(['wrong'], 'table.png'));
        return null;
    }
    catch (e) {
        return String(e);
    } });
    if (!rejection?.includes('확인된 원본과 다릅니다'))
        throw Error('Wrong source was not rejected');
    await page.evaluate(async () => { const { openExternalTilesetCatalog } = await import('/src/editor/panels/externalTilesetCatalog.ts'); openExternalTilesetCatalog(() => { throw Error('Unexpected import mutation'); }); });
    await page.locator('article').filter({ has: page.locator('[data-testid="paw-food-legacy-pizza-file"]') }).screenshot({ path: join(out, 'legacy-pizza-catalog.png') });
    await writeFile(join(out, 'report.json'), JSON.stringify({ report, wrongSourceRejected: rejection, errors, blocked, scope: 'Read-only prepare and catalog display. No import/store/DB writes.' }, null, 2) + '\n');
    await writeFile(join(out, 'install-plan.json'), JSON.stringify({ schemaVersion: 1, artPolicy: 'User originals/private generated PNGs only; do not publish reusable source/derived pixels.', preparedFiles: report.map(p => ({ packId: p.packId, path: join(out, `${p.packId}-prepared.json`) })), rawObjectCount: report.reduce((n, r) => n + r.rawGroups, 0), compositeObjectCount: report.reduce((n, r) => n + r.compositeGroups, 0), excludedComposites: report.flatMap(r => r.excluded), sceneKind: 'Fixed-object5x5assembly; not room or executable map', events: [] }, null, 2) + '\n');
    console.log(JSON.stringify({ packs: report.length, raw: report.reduce((n, r) => n + r.rawGroups, 0), composed: report.reduce((n, r) => n + r.compositeGroups, 0), errors, blocked }));
    if (errors.length || blocked.length)
        process.exitCode = 1;
}
finally {
    await browser.close();
}
