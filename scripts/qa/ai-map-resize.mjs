// Local editor fixture: real resize tool, publication, config migration and canvas.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:9834';
const out = 'output/evidence/ai-map-resize';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.addInitScript(() => {
    localStorage.setItem('oprn:editor-ui-mode', 'standard');
    localStorage.setItem('oprn:editor-welcome-dismissed', '1');
    localStorage.setItem('oprn:standard-welcome-seen', '1');
  });
  await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
  await page.goto(`${base}/?blankProject=1`);
  await page.waitForFunction(() => typeof window.__oprnEditWorldToClient === 'function', null, { timeout: 60000 });
  await page.waitForTimeout(2000);
  const result = await page.evaluate(async () => {
    const cfg = await import('/src/ai/llmClient.ts');
    localStorage.setItem(cfg.AI_CONFIG_STORAGE_KEY, JSON.stringify({ piApply: 'review' }));
    const migrated = cfg.loadAiConfig().piApply;
    cfg.saveAiConfig({ ...cfg.loadAiConfig(), piApply: 'review' });
    const explicitReview = cfg.loadAiConfig().piApply;
    const { store } = await import('/src/project/store.ts');
    const { runTool } = await import('/src/editor/tools/index.ts');
    const { createPiPublication } = await import('/src/editor/panels/aiPiPublication.ts');
    const { exportSpatialToolProof } = await import('/src/editor/tools/spatialToolState.ts');
    const { editorState } = await import('/src/editor/editorState.ts');
    const project = store.getCurrent();
    const mapId = editorState.get().currentMapId || project.startMapId;
    const original = { width: project.maps[mapId].width, height: project.maps[mapId].height };
    const ctx = { project: structuredClone(project) };
    const tool = runTool(ctx, 'resize_map', { mapId, width: original.width + 8, height: original.height + 6 });
    if (!tool.ok) throw Error(JSON.stringify(tool));
    const statuses = [];
    const publication = createPiPublication(project, migrated, {
      getCurrentMapId: () => mapId, setStatus: status => statuses.push(status),
      appendCard: () => { throw Error('Unexpected approval'); },
    });
    await publication.publish({ project: ctx.project, toolName: 'resize_map', label: tool.summary, spatialProof: exportSpatialToolProof(ctx.project) });
    const actual = store.getCurrent().maps[mapId];
    return { migrated, explicitReview, original, actual: { width: actual.width, height: actual.height }, statuses, publications: publication.count };
  });
  assert.equal(result.migrated, 'default');
  assert.equal(result.explicitReview, 'review');
  assert.equal(result.actual.width, result.original.width + 8);
  assert.equal(result.actual.height, result.original.height + 6);
  assert.equal(result.publications, 1);
  await page.screenshot({ path: `${out}/resized.png` });
  writeFileSync(`${out}/result.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
