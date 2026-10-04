// Production editor + scripted NDJSON transport + native tool/checkpoint acceptance.
// UI fixture only: no live model, host SQLite writes or generated-game completion claim.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const base = process.env.BASE ?? 'http://127.0.0.1:9911';
const feedbackOnly = false;
const out = 'verify-shots/assistant-view-background';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--disable-background-networking', '--js-flags=--max-old-space-size=4096'] });
const watchdog = setTimeout(() => { console.error('QA wall timeout'); void browser.close(); }, 240000);
console.log('browser ready');
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const report = { transport: feedbackOnly ? 'scripted; native read only; no authoring claim' : 'scripted; native tools and acceptance', errors: [], checks: [] };
page.on('console', msg => { if (msg.text().startsWith('QA') || msg.type() === 'error') console.log(msg.text()); });
page.on('crash', () => { report.errors.push('renderer crashed'); console.error('QA renderer crashed'); void browser.close(); });
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
  const qa = window.__creationQa = { stage: 'boot', acks: [], blobs: {}, releaseFirst: null, releaseSecond: null, end: null, done: false };
  const read = async init => {
    const stream = new Response(init.body).body;
    return JSON.parse(await new Response(new Headers(init.headers).get('content-encoding') === 'gzip' ? stream.pipeThrough(new DecompressionStream('gzip')) : stream).text());
  };
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    // Hold the fixture catalog constant: late host libraries can otherwise
    // normalize this transient project into hundreds of MB during a checkpoint.
    if (url.includes('/__oprn/shared-tile-references')) return new Response(JSON.stringify({ revision: 'qa', entries: [] }));
    if (url.includes('/__oprn/shared-content')) return new Response(JSON.stringify({ revision: 'qa', libraries: {} }));
    if (url.includes('/v1/agent/checkpoint')) {
      const ack = await read(init); qa.acks.push({ ok: ack.ok, issue: ack.issue, maps: Object.keys(ack.project?.maps ?? {}) });
      return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
    }
    if (!url.includes('/v1/agent/run')) return original(input, init);
    const request = await read(init); qa.stage = 'request decoded'; console.log('QA request decoded');
    // Implement the same heavy-key handshake as the real companion. Without
    // its run-id header the client retries against an older-host fallback.
    Object.assign(qa.blobs, request.heavyBlobs);
    for (const [key, hash] of Object.entries(request.heavy ?? {})) {
      request.project[key] = JSON.parse(qa.blobs[hash]);
    }
    return new Response(new ReadableStream({ async start(controller) {
      const write = event => controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + '\n'));
      qa.stage = 'loading tool runner';
      const { runTool } = await import('/src/editor/tools/toolRunner.ts');
      const { exportSpatialToolProof } = await import('/src/editor/tools/spatialToolState.ts');
      qa.stage = 'native tools ready'; console.log('QA tools ready');
      const ctx = { project: request.project, currentMapId: request.project.startMapId };
      write({ type: 'start', provider: 'scripted', model: 'scripted', toolCount: 2 });
      if (request.task.includes('QA explicit location')) {
        for (const mapId of ['qa_visible_scene', request.project.startMapId]) {
          const result = runTool(ctx, 'focus_editor_view', { mapId, x: 3, y: 3, w: 6, h: 4 });
          if (!result.ok) throw Error(JSON.stringify(result));
          write({ type: 'agent_event', agentId: 'qa-guide', event: { type: 'tool_end', id: mapId, name: 'focus_editor_view', ok: true, summary: result.summary, result } });
        }
        write({ type: 'done', project: ctx.project, stats: { ms: 1, turns: 1, toolCalls: 2, toolErrors: 0 }, changedKeys: [] });
        controller.close();
        return;
      }
      await new Promise(resolve => { qa.releaseFirst = resolve; });
      console.log('QA first released in stream');
      if (window.__creationFeedbackOnly) {
        const args = { mapId: ctx.currentMapId, x: 0, y: 0, width: 4, height: 4 };
        write({ type: 'tool_start', id: 'read', name: 'get_map_region', args });
        const readResult = runTool(ctx, 'get_map_region', args);
        qa.nativeRead = { ok: readResult.ok, summary: readResult.summary };
        await new Promise(resolve => { qa.releaseSecond = resolve; });
        write({ type: 'tool_end', id: 'read', name: 'get_map_region', ok: readResult.ok, summary: readResult.summary });
        qa.done = true;
        write({ type: 'done', project: ctx.project, stats: { ms: 1, turns: 1, toolCalls: 1, toolErrors: readResult.ok ? 0 : 1 }, changedKeys: [] });
        controller.close();
        return;
      }
      const firstArgs = { id: 'qa_visible_scene', name: '보이는 시공 현장', width: 16, height: 12, tilesetId: ctx.project.maps[ctx.currentMapId].tilesetId, bgm: { mode: 'none' } };
      write({ type: 'tool_start', id: 'first', name: 'create_map', args: firstArgs });
      console.log('QA project chars ' + JSON.stringify(ctx.project).length);
      qa.stage = 'first native tool';
      const first = runTool(ctx, 'create_map', firstArgs, { dryRun: false });
      qa.stage = first.ok ? 'first native tool succeeded' : JSON.stringify(first);
      if (!first.ok) throw Error(JSON.stringify(first));
      write({ type: 'checkpoint', checkpointId: 'first', label: '첫 맵', toolName: 'create_map', project: ctx.project, spatialProof: exportSpatialToolProof(ctx.project) });
      await new Promise(resolve => { qa.releaseSecond = resolve; });
      write({ type: 'tool_end', id: 'first', name: 'create_map', ok: true, summary: first.summary });
      const args = { mapId: 'qa_visible_scene', layer: 'lower', mode: 'rect', tile: 1, from: { x: 3, y: 3 }, to: { x: 8, y: 6 } };
      write({ type: 'tool_start', id: 'second', name: 'paint_tiles', args });
      const second = runTool(ctx, 'paint_tiles', args, { dryRun: false });
      if (!second.ok) throw Error(JSON.stringify(second));
      write({ type: 'checkpoint', checkpointId: 'second', label: '첫 바닥', toolName: 'paint_tiles', project: ctx.project, spatialProof: exportSpatialToolProof(ctx.project) });
      await new Promise(resolve => { qa.end = resolve; });
      write({ type: 'tool_end', id: 'second', name: 'paint_tiles', ok: true, summary: second.summary });
      write({ type: 'review', agentId: 'qa-scripted-review', mapId: 'qa_visible_scene', ok: true, findings: [] });
      qa.done = true;
      write({ type: 'done', project: ctx.project, stats: { turns: 1, toolCalls: 2, toolErrors: 0, ms: 1 }, changedKeys: ['maps'] });
      controller.close();
    } }), { headers: { 'Content-Type': 'application/x-ndjson', 'X-Oprn-Run-Id': request.runId } });
  };
}, { fixture: JSON.parse(readFileSync('test/fixtures/projects/event-pages-v3.json', 'utf8')), feedbackOnly });
try {
  await page.goto(base + '/?blankProject=1', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('ai-input').waitFor({ timeout: 90000 });
  await page.waitForFunction(() => typeof window.__oprnEditCamera === 'function' && !!window.__oprnEditCamera(), null, { timeout: 45000, polling: 100 });
  // Keep the UI-only fixture small after normal boot adds bundled references.
  // Capture native tool proofs and acceptance against this same reduced baseline.
  await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const current = store.getCurrent();
    const { normalizeDatabaseRecords } = await import('/src/project/databaseRecordModel.ts');
    const database = normalizeDatabaseRecords(current.database);
    const used = new Set(Object.values(current.maps).map(map => map.tilesetId));
    const tilesets = Object.fromEntries(Object.entries(current.tilesets).filter(([id]) => used.has(id)).map(([id, tileset]) => [id, { ...tileset, referenceDocuments: [] }]));
    store.replace({ ...current, database, tilesets, assets: window.__OPRN_E2E_PROJECT__.assets }, { change: { label: 'QA fixture references trimmed', source: 'qa' } });
    console.log('QA fixture ready');
  });
  await page.evaluate(async () => {
    const { subscribeEditorCameraFocus } = await import('/src/editor/editorCameraFocus.ts');
    const { editorState } = await import('/src/editor/editorState.ts');
    window.__viewQa = { initialMap: editorState.get().currentMapId, initialCamera: window.__oprnEditCamera?.(), requests: [] };
    subscribeEditorCameraFocus(target => window.__viewQa.requests.push(target));
  });
  await page.getByTestId('ai-input').fill('/team QA 백그라운드 작업');
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
  await page.evaluate(() => {
    const realTimer = window.setTimeout.bind(window);
    const realFrame = window.requestAnimationFrame.bind(window);
    const focusDescriptor = Object.getOwnPropertyDescriptor(document, 'hasFocus');
    const visibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => false });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    window.requestAnimationFrame = () => 0;
    window.setTimeout = (fn, ms, ...args) => ms === 0 || ms === 50 ? 0 : realTimer(fn, ms, ...args);
    window.__viewQa.restore = () => {
      window.setTimeout = realTimer; window.requestAnimationFrame = realFrame;
      if (focusDescriptor) Object.defineProperty(document, 'hasFocus', focusDescriptor); else delete document.hasFocus;
      if (visibilityDescriptor) Object.defineProperty(document, 'visibilityState', visibilityDescriptor); else delete document.visibilityState;
      document.dispatchEvent(new Event('visibilitychange'));
    };
    window.dispatchEvent(new Event('blur')); document.dispatchEvent(new Event('visibilitychange'));
    window.__creationQa.releaseFirst();
  });
  console.log('first released');
  if (feedbackOnly) {
    await page.waitForFunction(() => !!window.__creationQa.nativeRead, null, { timeout: 30000 });
    const result = await page.evaluate(() => ({ tool: window.__creationQa.nativeRead,
      text: document.querySelector('[data-testid="ai-canvas-progress"]')?.textContent, done: window.__creationQa.done }));
    check('native read activity visible while the scripted model stream is open', result.tool.ok && !!result.text && !result.done, result);
    await page.screenshot({ path: out + '/02-native-read.png', timeout: 15000 });
    await page.evaluate(() => { window.__creationQa.releaseSecond(); });
  } else {
  await page.waitForFunction(() => window.__creationQa.acks.length >= 1, null, { timeout: 60000, polling: 100 });
  const first = await page.evaluate(async () => ({ ack: window.__creationQa.acks[0], mapId: (await import('/src/editor/editorState.ts')).editorState.get().currentMapId, done: window.__creationQa.done }));
  check('first checkpoint applied in background without switching maps', first.ack.ok && first.mapId !== 'qa_visible_scene' && !first.done, first);
  await page.waitForTimeout(700);
  await page.screenshot({ path: out + '/02-first-map.png' });
  await page.evaluate(() => { window.__creationQa.releaseSecond(); });
  await page.waitForFunction(() => window.__creationQa.acks.length >= 2, null, { timeout: 60000, polling: 100 });
  const second = await page.evaluate(async () => ({ ack: window.__creationQa.acks[1], tile: (await import('/src/project/store.ts')).store.getCurrent().maps.qa_visible_scene.lowerTiles[3 * 16 + 3], done: window.__creationQa.done }));
  check('second native change applied while stream remains open', second.ack.ok && second.tile === 1 && !second.done, second);
  await page.evaluate(() => { window.__viewQa.restore(); });
  const preserved = await page.evaluate(async () => ({
    initialMap: window.__viewQa.initialMap,
    map: (await import('/src/editor/editorState.ts')).editorState.get().currentMapId,
    requests: window.__viewQa.requests,
    initialCamera: window.__viewQa.initialCamera,
    camera: window.__oprnEditCamera?.(),
  }));
  check('returning to the editor preserves camera and map without delayed navigation',
    preserved.initialMap === preserved.map && preserved.requests.length === 0
      && JSON.stringify(preserved.initialCamera) === JSON.stringify(preserved.camera), preserved);
  await page.screenshot({ path: out + '/03-background-applied.png' });
  await page.evaluate(() => { window.__creationQa.end(); });
  }
  await page.waitForFunction(() => !window.__oprnAiBridge.status().turnBusy, null, { timeout: 60000, polling: 100 });
  check('progress removed at settlement', await page.getByTestId('ai-canvas-progress').count() === 0);
  check('no page errors', report.errors.length === 0, report.errors);
  const navigation = await page.evaluate(async () => {
    const { createAssistantViewNavigation } = await import('/src/editor/assistantViewNavigation.ts');
    const { runPiCommand, plainPiCommand } = await import('/src/editor/panels/aiPiAgentCommand.ts');
    const { editorState } = await import('/src/editor/editorState.ts');
    Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => true });
    const region = { mapId: 'qa_visible_scene', x: 3, y: 3, w: 6, h: 4 };
    const before = editorState.get().currentMapId;
    createAssistantViewNavigation(() => false)('focus_editor_view', region);
    const blocked = editorState.get().currentMapId === before;
    const moved = await runPiCommand(plainPiCommand('QA explicit location', 'single', before), {
      appendBubble() {}, appendCard() {}, setStatus() {}, getCurrentMapId: () => editorState.get().currentMapId,
    }, { readOnly: true, viewNavigation: true });
    const map = editorState.get().currentMapId;
    const requests = window.__viewQa.requests.length;
    return { blocked, moved, map, requests, afterSecond: editorState.get().currentMapId };
  });
  check('explicit location guidance moves once; unsolicited tool calls stay put', navigation.blocked
    && navigation.moved && navigation.map === 'qa_visible_scene' && navigation.requests === 1
    && navigation.afterSecond === 'qa_visible_scene', navigation);
  await page.screenshot({ path: out + '/04-explicit-location.png' });
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
