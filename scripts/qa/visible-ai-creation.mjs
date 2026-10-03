// Production editor + scripted NDJSON transport + native tool/checkpoint acceptance.
// UI fixture only: no live model, host SQLite writes or generated-game completion claim.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:9812';
const feedbackOnly = process.env.FEEDBACK_ONLY === '1';
const out = 'verify-shots/visible-ai-creation' + (feedbackOnly ? '/feedback-flow' : '');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const watchdog = setTimeout(() => { console.error('QA wall timeout'); void browser.close(); }, 240000);
console.log('browser ready');
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const report = { transport: feedbackOnly ? 'scripted; native read only; no authoring claim' : 'scripted; native tools and acceptance', errors: [], checks: [] };
page.on('console', msg => { if (msg.text().startsWith('QA') || msg.type() === 'error') console.log(msg.text()); });
page.on('crash', () => { report.errors.push('renderer crashed'); console.error('QA renderer crashed'); });
page.on('pageerror', error => report.errors.push(error.message));
const check = (name, passed, detail) => {
  report.checks.push({ name, passed, detail });
  writeFileSync(out + '/report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ name, passed, detail }));
  if (!passed) throw Error(name);
};
await page.addInitScript(({ fixture, feedbackOnly }) => {
  window.__creationFeedbackOnly = feedbackOnly;
  window.__OPRN_E2E_PROJECT__ = fixture;
  localStorage.setItem('oprn:editor-ui-mode', 'expert');
  for (const key of ['oprn:editor-welcome-dismissed', 'oprn:standard-welcome-seen', 'oprn:coachmarks-basic-v1']) localStorage.setItem(key, '1');
  localStorage.setItem('oprn:ai-config', JSON.stringify({ providerId: 'google-antigravity', model: 'gemini-3.8-flash', piApply: 'auto', piTeam: true }));
  localStorage.removeItem('oprn:ai-live-canvas');
  const original = window.fetch.bind(window);
  const qa = window.__creationQa = { stage: 'boot', acks: [], releaseFirst: null, releaseSecond: null, end: null, done: false };
  const read = async init => {
    const stream = new Response(init.body).body;
    return JSON.parse(await new Response(new Headers(init.headers).get('content-encoding') === 'gzip' ? stream.pipeThrough(new DecompressionStream('gzip')) : stream).text());
  };
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('/v1/agent/checkpoint')) {
      const ack = await read(init); qa.acks.push({ ok: ack.ok, issue: ack.issue });
      return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
    }
    if (!url.includes('/v1/agent/run')) return original(input, init);
    const request = await read(init); qa.stage = 'request decoded'; console.log('QA request decoded');
    // Implement the same heavy-key handshake as the real companion. Without
    // its run-id header the client retries against an older-host fallback.
    for (const [key, hash] of Object.entries(request.heavy ?? {})) {
      request.project[key] = JSON.parse(request.heavyBlobs[hash]);
    }
    return new Response(new ReadableStream({ async start(controller) {
      const write = event => controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + '\n'));
      qa.stage = 'loading tool runner';
      const { runTool } = await import('/src/editor/tools/toolRunner.ts');
      const { exportSpatialToolProof } = await import('/src/editor/tools/spatialToolState.ts');
      qa.stage = 'native tools ready'; console.log('QA tools ready');
      const ctx = { project: request.project, currentMapId: request.project.startMapId };
      write({ type: 'start', provider: 'scripted', model: 'scripted', toolCount: 2 });
      await new Promise(resolve => { qa.releaseFirst = () => { setTimeout(resolve, 0); }; });
      console.log('QA first released in stream');
      if (window.__creationFeedbackOnly) {
        const args = { mapId: ctx.currentMapId, x: 0, y: 0, width: 4, height: 4 };
        write({ type: 'tool_start', id: 'read', name: 'get_map_region', args });
        const readResult = runTool(ctx, 'get_map_region', args);
        qa.nativeRead = { ok: readResult.ok, summary: readResult.summary };
        await new Promise(resolve => { qa.releaseSecond = () => { setTimeout(resolve, 0); }; });
        write({ type: 'tool_end', id: 'read', name: 'get_map_region', ok: readResult.ok, summary: readResult.summary });
        qa.done = true;
        write({ type: 'done', project: ctx.project, stats: { ms: 1, turns: 1, toolCalls: 1, toolErrors: readResult.ok ? 0 : 1 }, changedKeys: [] });
        controller.close();
        return;
      }
      const firstArgs = { id: 'qa_visible_scene', name: '보이는 시공 현장', width: 16, height: 12, tilesetId: ctx.project.maps[ctx.currentMapId].tilesetId, bgm: { mode: 'none' } };
      write({ type: 'tool_start', id: 'first', name: 'create_map', args: firstArgs });
      qa.stage = 'first native tool';
      const first = runTool(ctx, 'create_map', firstArgs, { dryRun: false });
      qa.stage = 'first result ' + JSON.stringify(first); console.log(qa.stage);
      if (!first.ok) throw Error(JSON.stringify(first));
      write({ type: 'checkpoint', checkpointId: 'first', label: '첫 맵', toolName: 'create_map', project: ctx.project, spatialProof: exportSpatialToolProof(ctx.project) });
      await new Promise(resolve => { qa.releaseSecond = () => { setTimeout(resolve, 0); }; });
      write({ type: 'tool_end', id: 'first', name: 'create_map', ok: true, summary: first.summary });
      const args = { mapId: 'qa_visible_scene', layer: 'lower', mode: 'rect', tile: 1, from: { x: 3, y: 3 }, to: { x: 8, y: 6 } };
      write({ type: 'tool_start', id: 'second', name: 'paint_tiles', args });
      const second = runTool(ctx, 'paint_tiles', args, { dryRun: false });
      if (!second.ok) throw Error(JSON.stringify(second));
      write({ type: 'checkpoint', checkpointId: 'second', label: '첫 바닥', toolName: 'paint_tiles', project: ctx.project, spatialProof: exportSpatialToolProof(ctx.project) });
      await new Promise(resolve => { qa.end = () => { setTimeout(resolve, 0); }; });
      write({ type: 'tool_end', id: 'second', name: 'paint_tiles', ok: true, summary: second.summary });
      write({ type: 'review', mapId: 'qa_visible_scene', ok: true, summary: 'Scripted review: not vision QA' });
      qa.done = true;
      write({ type: 'done', project: ctx.project, stats: { turns: 1, toolCalls: 2, toolErrors: 0, ms: 1 }, changedKeys: ['maps'] });
      controller.close();
    } }), { headers: { 'Content-Type': 'application/x-ndjson', 'X-Oprn-Run-Id': request.runId } });
  };
}, { fixture: JSON.parse(readFileSync('test/fixtures/projects/event-pages-v3.json', 'utf8')), feedbackOnly });
try {
  await page.goto(base + '/?blankProject=1', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('ai-input').waitFor({ timeout: 90000 });
  // Keep the UI-only fixture small after normal boot adds bundled references.
  // Capture native tool proofs and acceptance against this same reduced baseline.
  await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const current = store.getCurrent();
    const used = new Set(Object.values(current.maps).map(map => map.tilesetId));
    const tilesets = Object.fromEntries(Object.entries(current.tilesets).filter(([id]) => used.has(id)).map(([id, tileset]) => [id, { ...tileset, referenceDocuments: [] }]));
    store.replace({ ...current, tilesets, assets: window.__OPRN_E2E_PROJECT__.assets }, { change: { label: 'QA fixture references trimmed', source: 'qa' } });
    console.log('QA fixture ready');
  });
  await page.getByTestId('ai-input').fill('/team QA 시공 진행 표시');
  const immediate = await page.evaluate(() => {
    const before = performance.now(); document.querySelector('[data-testid="ai-send"]').click();
    const root = document.querySelector('[data-testid="ai-canvas-progress"]');
    return { ms: performance.now() - before, text: root?.textContent, visible: !!root && !root.hidden };
  });
  check('request acknowledged in the same click before model output', immediate.visible, immediate);
  console.log('capturing request');
  await page.screenshot({ path: out + '/01-request.png', timeout: 15000 });
  console.log('request captured');
  await page.waitForFunction(() => typeof window.__creationQa.releaseFirst === 'function', null, { timeout: 45000, polling: 100 });
  console.log('releasing first checkpoint');
  await page.evaluate(() => { window.__creationQa.releaseFirst(); });
  console.log('first released');
  if (feedbackOnly) {
    await page.waitForFunction(() => !!window.__creationQa.nativeRead, null, { timeout: 30000 });
    const result = await page.evaluate(() => ({ tool: window.__creationQa.nativeRead,
      text: document.querySelector('[data-testid="ai-canvas-progress"]')?.textContent, done: window.__creationQa.done }));
    check('native read activity visible while the scripted model stream is open', result.tool.ok && !!result.text && !result.done, result);
    await page.screenshot({ path: out + '/02-native-read.png', timeout: 15000 });
    await page.evaluate(() => { window.__creationQa.releaseSecond(); });
  } else {
  await page.waitForFunction(() => window.__creationQa.acks.length >= 1, null, { timeout: 60000 });
  const first = await page.evaluate(async () => ({ ack: window.__creationQa.acks[0], mapId: (await import('/src/editor/editorState.ts')).editorState.get().currentMapId, done: window.__creationQa.done }));
  check('first accepted new map is visible before the run finishes', first.ack.ok && first.mapId === 'qa_visible_scene' && !first.done, first);
  await page.waitForTimeout(700);
  await page.screenshot({ path: out + '/02-first-map.png' });
  await page.evaluate(() => { window.__creationQa.releaseSecond(); });
  await page.waitForFunction(() => window.__creationQa.acks.length >= 2, null, { timeout: 60000 });
  const second = await page.evaluate(async () => ({ ack: window.__creationQa.acks[1], tile: (await import('/src/project/store.ts')).store.getCurrent().maps.qa_visible_scene.lowerTiles[3 * 16 + 3], done: window.__creationQa.done }));
  check('second native change applied while stream remains open', second.ack.ok && second.tile === 1 && !second.done, second);
  await page.screenshot({ path: out + '/03-live-floor.png' });
  await page.evaluate(() => { window.__creationQa.end(); });
  }
  await page.waitForFunction(() => !window.__oprnAiBridge.status().turnBusy, null, { timeout: 60000 });
  check('progress removed at settlement', await page.getByTestId('ai-canvas-progress').count() === 0);
  check('no page errors', report.errors.length === 0, report.errors);
} catch (error) {
  report.failure = error.message;
  report.stage = await page.evaluate(() => window.__creationQa?.stage).catch(() => 'browser unavailable');
  console.error(report.failure, report.stage);
  report.body = (await page.locator('body').innerText().catch(() => 'unavailable')).slice(-3000);
  console.error(report.body);
  await page.screenshot({ path: out + '/failure.png', timeout: 15000 }).catch(() => {});
  throw error;
} finally {
  writeFileSync(out + '/report.json', JSON.stringify(report, null, 2));
  clearTimeout(watchdog);
  await browser.close();
}
console.log(JSON.stringify(report));
