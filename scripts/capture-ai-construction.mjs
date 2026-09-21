/** Deterministic browser evidence: real editor + Pi client/checkpoint publication, scripted worker.
 * No LLM or remote authored content. BASE=... node scripts/capture-ai-construction.mjs
 */
import { chromium, firefox } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const mode = process.env.MODE ?? 'default';
const base = process.env.BASE ?? 'http://127.0.0.1:9854';
const out = process.env.OUT ?? 'output/evidence/ai-construction-motion';
mkdirSync(out, { recursive: true });
const browser = process.env.BROWSER === 'firefox' ? await firefox.launch() : await chromium.launch({ args: ['--disable-features=NetworkServiceInProcess2', '--disable-background-networking'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
const frames = [];
const capture = async name => { await page.screenshot({ path: `${out}/${name}.png` }); frames.push(name); };
page.on('console', message => { if (message.text().includes('[agent-ghost] reveal frame error')) errors.push(message.text()); });
page.on('requestfailed', r => console.log('requestfailed', new URL(r.url()).pathname, r.failure()?.errorText));
page.on('pageerror', e => { errors.push(String(e)); console.log('pageerror', String(e)); });
await page.addInitScript(() => {
  for (const [key, value] of Object.entries({ 'oprn:editor-ui-mode': 'standard', 'oprn:editor-welcome-dismissed': '1', 'oprn:standard-welcome-seen': '1', 'oprn:coachmarks-basic-v1': '1' })) localStorage.setItem(key, value);
  const probe = window.__construction = { phase: 'boot', release: null, ack: null };
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/v1/agent/checkpoint')) {
      const body = JSON.parse(init.body);
      probe.ack = { ok: body.ok, issue: body.issue };
      probe.resumeAck?.();
      return new Response('{}', { status: 200 });
    }
    if (!url.includes('/v1/agent/run')) return original(input, init);
    const body = JSON.parse(init.body);
    const headers = { 'Content-Type': 'application/x-ndjson' };
    const done = project => ({ type: 'done', project, stats: { ms: 100, turns: 1, toolCalls: 1, toolErrors: 0 }, changedKeys: [] });
    if (body.readOnly) return new Response(JSON.stringify({ type: 'assistant', text: '광장 바닥과 두 집의 위치를 밑그림으로 표시한 뒤 시공합니다.' }) + '\n' + JSON.stringify(done(body.project)) + '\n', { headers });
    probe.mode = body.applyMode;
    const mapId = body.currentMapId ?? body.mapIds[0];
    const next = structuredClone(body.project), map = next.maps[mapId];
    // Minimal visual fixture: >256 changed cells + actual house tool output.
    for (let y = 2; y < 24; y++) for (let x = 2; x < 36; x++) map.lowerTiles[y * map.width + x] = y >= 15 && y <= 18 || x >= 17 && x <= 20 ? 360 : 423;
    const { stampFootprintHouseKit } = await import('/src/editor/houseKit.ts');
    const houses = [{ x: 5, y: 5, w: 8, h: 7 }, { x: 24, y: 5, w: 8, h: 7 }];
    probe.tools = houses.map(w => stampFootprintHouseKit(map, { kitId: 'blue-stone', wings: [w] })).map(r => ({ ok: r.ok }));
    const result = next;
    const spec = { mapId, title: '광장과 두 집', assets: [
      { id: 'ground', kind: 'terrain', x: 2, y: 15, w: 34, h: 4 },
      ...houses.map((r, i) => ({ id: `house-${i}`, kind: 'house', ...r })),
    ], buildOrder: ['ground', 'house-0', 'house-1'] };
    return new Response(new ReadableStream({ async start(controller) {
      const write = event => controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + '\n'));
      write({ type: 'start', provider: body.provider, model: body.model, toolCount: 3 });
      probe.phase = 'ready-plan';
      await new Promise(resolve => { probe.releasePlan = resolve; });
      write({ type: 'execution_status', name: 'set_build_spec', ok: true, summary: '밑그림 표시', data: spec });
      probe.phase = 'blueprint';
      await new Promise(resolve => { probe.release = resolve; });
      write({ type: 'tool_start', id: 'build', name: 'paint_tiles', args: { mapId, mode: 'rect', x: 2, y: 2, w: 34, h: 22, tileId: 423 } });
      if (body.applyMode === 'review') {
        const { diffMapsForDelta } = await import('/src/ai/piAgent/mapDelta.ts');
        write({ type: 'map_delta', maps: diffMapsForDelta(body.project.maps, result.maps) });
        probe.phase = 'review-preview';
        await new Promise(resolve => { probe.release = resolve; });
      } else {
        const ack = new Promise(resolve => { probe.resumeAck = resolve; });
        write({ type: 'checkpoint', checkpointId: 'visual-checkpoint', label: '광장 시공', toolName: 'paint_tiles', project: result });
        probe.phase = 'checkpoint';
        await ack;
      }
      write({ type: 'tool_end', id: 'build', name: 'paint_tiles', ok: true, summary: '광장과 집 배치 완료' });
      write({ type: 'assistant', text: '광장과 두 집을 배치했습니다.' });
      write({ ...done(result), changedKeys: [`maps.${mapId}`] });
      probe.phase = 'done'; controller.close();
    } }), { headers });
  };
});
await page.route('**/v1/chat/completions', r => r.fulfill({ status: 503, json: { error: 'scripted evidence' } }));
await page.route('**/__oprn/ai-activity', r => r.fulfill({ json: { ok: true } }));
await page.route('**/rest/v1/**', r => r.fulfill({ json: [] }));
await page.route('**/auth/**', r => r.fulfill({ json: { ok: true, authenticated: true } }));
try {
await page.clock.install();
await page.goto(`${base}/?blankProject=1`, { waitUntil: 'domcontentloaded' });
const guest = page.getByTestId('login-guest');
await guest.or(page.getByTestId('ai-input')).first().waitFor({ state: 'visible', timeout: 120000 });
if (await guest.isVisible()) await guest.click();
await page.getByTestId('edit-canvas').waitFor({ state: 'visible', timeout: 120000 });
await page.evaluate(async (mode) => {
  const { store } = await import('/src/project/store.ts');
  const { editorState } = await import('/src/editor/editorState.ts');
  const { loadAiConfig, saveAiConfig } = await import('/src/ai/llmClient.ts');
  saveAiConfig({ ...loadAiConfig(), piApply: mode });
  const id = store.getCurrent().startMapId;
  store.updateMap(id, m => { m.name = '시공 연출 검증'; m.width = 40; m.height = 28; m.lowerTiles = Array(1120).fill(240); m.upperTiles = Array(1120).fill(-1); m.events = []; m.layoutPlan = undefined; m.structurePlacements = []; m.lowerTileStacks = undefined; m.upperTileStacks = undefined; });
  store.update(p => { p.startPos = { x: 1, y: 1 }; });
  editorState.set({ zoom: 1.5 });
}, mode);
await page.getByTestId('ai-input').fill('/pi 광장 바닥을 깔고 집 두 채를 배치해줘');
await page.getByTestId('ai-send').click();
await page.waitForFunction(() => window.__construction.phase === 'ready-plan', undefined, { timeout: 120000 });
await page.getByTestId('sidebar-tools').click();
await page.waitForTimeout(2500);
await capture('00-before');
await page.clock.pauseAt(new Date(Date.now() + 1000));
await page.evaluate(() => window.__construction.releasePlan());
await new Promise(resolve => setTimeout(resolve, 150));
await page.clock.runFor(150);
await capture('01-plan-start');
await page.clock.runFor(350);
await capture('02-plan-lines');
await page.clock.runFor(1000);
await capture('03-plan-ready');
await page.evaluate(async () => {
  const ghost = await import('/src/editor/agentGhostPreview.ts');
  const { resolveCurrentMapId } = await import('/src/editor/mapSelection.ts');
  window.__construction.history = [];
  ghost.subscribeAgentGhostPreview(state => window.__construction.history.push({ at: performance.now(), cells: state.previews.reduce((s,p) => s+p.cells.length,0), viewed: resolveCurrentMapId(), maps: state.previews.map(p => p.mapId), hidden: document.hidden }));
  window.__construction.release();
});
for (let frame = 0; frame < 80 && !await page.getByTestId('agent-ghost-preview').count(); frame++) {
  await page.clock.runFor(50);
  await new Promise(resolve => setTimeout(resolve, 25));
}
if (!await page.getByTestId('agent-ghost-preview').count()) throw new Error('No preview during checkpoint');
const during = await page.evaluate(async () => {
  const { getAgentGhostPreviewState } = await import('/src/editor/agentGhostPreview.ts');
  const { store } = await import('/src/project/store.ts');
  return { cells: getAgentGhostPreviewState().previews.reduce((sum, p) => sum + p.cells.length, 0), committed: store.getCurrent().maps[store.getCurrent().startMapId].lowerTiles[82] !== 240 };
});
for (const [delay, name] of [[100,'04-ground-start'],[250,'05-ground-motion'],[350,'06-cursor-middle'],[400,'07-building-motion'],[400,'08-detail-settle'],[500,'09-preview-ready']]) {
  await page.clock.runFor(delay);
  await capture(name);
}
if (mode !== 'review') {
  for (let frame = 0; frame < 60 && !await page.getByTestId('agent-focus-highlight').count(); frame++) {
    await page.clock.runFor(50);
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  if (!await page.getByTestId('agent-focus-highlight').count()) throw new Error('Applied marker missing');
  await page.clock.runFor(100);
  await capture('10-applied-stamp');
}
await page.clock.resume();
if (mode === 'review') await page.evaluate(() => window.__construction.release());
await page.waitForFunction(() => window.__construction.phase === 'done', undefined, { timeout: 60000 });
await page.waitForTimeout(1500);
if (mode === 'review') {
  await page.getByTestId('sidebar-ai').click();
  await page.getByTestId('ai-pending-review-discard').waitFor({ state: 'visible', timeout: 60000 });
  await page.getByTestId('ai-pending-review-discard').click();
} else {
  const confirm = page.getByRole('button', { name: '확인', exact: true });
  if (!await page.evaluate(() => window.__construction.ack?.ok)) throw new Error('Checkpoint failed');
  await confirm.waitFor({ state: 'visible', timeout: 60000 });
  await confirm.click();
}
for (let attempt = 0; attempt < 100; attempt++) {
  if (await page.evaluate(async () => (await import('/src/editor/agentBlueprint.ts')).getAgentBlueprintState().entries.length === 0)) break;
  await page.waitForTimeout(100);
}
await page.waitForTimeout(1000);
await capture(mode === 'review' ? '11-discarded' : '11-complete');
await page.waitForTimeout(2500);
await capture('12-settled');
if (await page.getByTestId('agent-focus-highlight').count()) throw new Error('Completion marker did not clear');
const receipt = await page.evaluate(async () => {
  const { getAgentGhostPreviewState } = await import('/src/editor/agentGhostPreview.ts');
  const { getAgentBlueprintState } = await import('/src/editor/agentBlueprint.ts');
  const { store } = await import('/src/project/store.ts');
  return { mode: window.__construction.mode, ack: window.__construction.ack, tools: window.__construction.tools,
    ghostCells: getAgentGhostPreviewState().previews.reduce((s, p) => s + p.cells.length, 0), blueprint: getAgentBlueprintState().entries.length,
    committed: store.getCurrent().maps[store.getCurrent().startMapId].lowerTiles[82] !== 240 };
});
writeFileSync(`${out}/probe.json`, JSON.stringify({ during, receipt, errors, frames }, null, 2));
console.log(JSON.stringify({ during, receipt, errors, frames }));
if (during.cells <= 256 || during.committed || (mode !== 'review' && !receipt.ack?.ok) || receipt.committed !== (mode !== 'review') || receipt.ghostCells || receipt.blueprint || receipt.tools.some(t => !t.ok) || errors.length) throw new Error('Construction evidence assertions failed');
} catch (error) {
  await page.screenshot({ path: `${out}/failure.png` });
  console.log(JSON.stringify(await page.evaluate(() => ({ probe: { ...window.__construction, release: undefined, releasePlan: undefined, resumeAck: undefined }, text: document.body.innerText.slice(-2000) }))));
  throw error;
} finally { await browser.close(); }
