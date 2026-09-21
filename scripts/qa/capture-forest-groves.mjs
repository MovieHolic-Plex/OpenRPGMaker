// Visual observations of isolated authoring drafts. No live content or remote writes.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const output = 'output/evidence/forest-groves';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
  await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:9816'}/?devProject=1&marketTown=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const guest = page.getByTestId('login-guest');
  await page.getByTestId('ai-input').or(guest).first().waitFor({ timeout: 120000 });
  if (await guest.isVisible()) await guest.click();
  await page.getByTestId('ai-input').waitFor({ timeout: 120000 });
  const result = await page.evaluate(async () => {
    const { createEmptyToolProject } = await import('/src/editor/tools/emptyProject.ts');
    const { runAuthorVillage } = await import('/src/editor/tools/authorVillageTool.ts');
    const { drawMapTileLayers } = await import('/src/editor/mapTileDraw.ts');
    const { awaitGraftedTilesetImageUrl } = await import('/src/assets/tileGraftImageCache.ts');
    const { tilesetBaseImageUrl } = await import('/src/editor/tilesetImage.ts');
    const { serialize, deserialize } = await import('/src/project/io.ts');
    const ctx = { project: createEmptyToolProject('Forest grove browser observation') };
    const baseline = structuredClone(ctx.project.tilesets.forest_harmony);
    const host = document.createElement('div');
    host.id = 'grove-evidence';
    host.style.cssText = 'position:fixed;inset:20px;z-index:100000;background:#f7f3ea;overflow:auto;padding:24px';
    document.body.append(host);
    window.groveCanvases = {};
    const observations = [];
    for (const scenario of [
      { id: 'village', width: 50, height: 50, houseCount: 2 },
      { id: 'hills', width: 74, height: 52, houseCount: 4, morphology: 'green', relief: 'hills', forestDensity: 'dense' },
      { id: 'compact', width: 80, height: 72, houseCount: 4, composition: 'compact' },
      { id: 'legacy', width: 50, height: 50, houseCount: 2, tilesetId: 'easyrpg_chipset_combined_town' },
    ]) {
      const { id, width, height, tilesetId, ...options } = scenario;
      const built = runAuthorVillage(ctx, { target: { kind: 'new', mapId: id, name: id, width, height, ...(tilesetId ? { tilesetId } : {}) },
        ...options, countPolicy: 'exact', interior: false, seed: 7 });
      const map = ctx.project.maps[id];
      const observation = { id, ok: built.ok, summary: built.summary, qa: built.data.village.structuralQa };
      if (!map) { observation.issues = built.issues; observations.push(observation); continue; }
      const ts = ctx.project.tilesets[map.tilesetId];
      const group = ts.autotileGroups?.find(group => group.id === 'forest_harmony_grove_47');
      const baked = await awaitGraftedTilesetImageUrl(ts, tilesetBaseImageUrl(ts));
      if (!baked) throw Error(`Missing graft bake: ${id}`);
      const atlas = new Image(); atlas.src = baked; await atlas.decode();
      const canvas = document.createElement('canvas');
      canvas.width = width * 16; canvas.height = height * 16;
      drawMapTileLayers(canvas.getContext('2d'), atlas, map, ts, 1);
      window.groveCanvases[id] = canvas;
      observations.push({ ...observation, canopyCells: map.upperTiles.filter(tile => group?.memberTileIds.includes(tile)).length,
        atlas: [atlas.width, atlas.height], tilesetId: map.tilesetId });
    }
    const reloaded = deserialize(serialize(ctx.project));
    const ts = ctx.project.tilesets.forest_harmony;
    return { observations,
      originalSlotsPreserved: ['terrain', 'priority', 'passability', 'tileMeta'].every(key => JSON.stringify(ts[key].slice(0, baseline.count)) === JSON.stringify(baseline[key])),
      reloadedMapsEqual: JSON.stringify(reloaded.maps) === JSON.stringify(ctx.project.maps),
      reloadedGraftsEqual: JSON.stringify(reloaded.tilesets.forest_harmony.tileGrafts) === JSON.stringify(ts.tileGrafts),
      contentPersistence: 'none — isolated in-memory code QA' };
  });
  for (const id of ['village', 'hills', 'compact']) {
    const found = await page.evaluate(id => {
      const canvas = window.groveCanvases[id];
      if (!canvas) return false;
      document.getElementById('grove-evidence').replaceChildren(canvas);
      return true;
    }, id);
    if (found) await page.screenshot({ path: `${output}/${id}.png` });
  }
  result.errors = errors;
  writeFileSync(`${output}/observations.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
