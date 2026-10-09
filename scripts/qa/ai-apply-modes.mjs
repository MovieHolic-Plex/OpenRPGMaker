// Real editor/store/history with scripted streaming transport; never writes remote content.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:9834';
const out = process.env.QA_OUT || 'output/evidence/ai-apply-modes';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];
try {
  for (const mode of (process.env.QA_MODES?.split(',') || ['yolo', 'auto', 'default', 'review', 'step'])) {
    console.log('mode', mode);
    const page = await browser.newPage({ viewport: { width: Number(process.env.QA_WIDTH || 1440), height: 1000 } });
    await page.addInitScript(() => {
      localStorage.setItem('oprn:editor-ui-mode', 'standard');
      localStorage.setItem('oprn:editor-welcome-dismissed', '1');
      localStorage.setItem('oprn:standard-welcome-seen', '1');
      localStorage.setItem('oprn:coachmarks-basic-v1', '1');
    });
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') console.log('console', msg.text().slice(0, 200)); });
    page.on('pageerror', e => { errors.push(e.message); console.log('pageerror', e.message); });
    await page.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.pathname.endsWith('/auth/status')) return route.fulfill({ json: { connected: true, authKind: 'oauth' } });
      if (url.pathname.endsWith('/chat/completions') && req.method() === 'POST') {
        const body = req.postDataJSON();
        const coverage = String(body.messages[0]?.content).startsWith('REQUEST_COVERAGE_AUDIT');
        const isReview = body.messages.some(m => typeof m.content === 'string' && (m.content.includes('You are Vision') || m.content.includes('map art-direction reviewer')));
        const content = isReview ? { harmonious: true, summary: '변경 확인', findings: [] } : coverage ? { requirements: [{ text: '바닥 한 칸 수정', criteria: [{ kind: 'functionalUnresolved', reason: '타일 확인' }] }], clarifies: [] }
          : { mode: 'modify', space: 'none', facility: null, targetMapId: null, useSelection: false, clarify: null, clarifyOptions: [], needsPlan: false, resetsContext: false, tools: [], summary: '바닥 한 칸 수정' };
        return route.fulfill({ json: { ...(isReview ? { image_delivery: [{ messageIndex: 1, partIndex: 1 }] } : {}), choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(content) } }] } });
      }
      return url.origin === new URL(base).origin || ['image', 'font'].includes(req.resourceType()) ? route.continue() : route.abort();
    });
    await page.goto(`${base}/?blankProject=1`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('ai-input').waitFor({ state: 'attached', timeout: 60000 });
    await page.waitForFunction(() => typeof window.__oprnEditWorldToClient === 'function', undefined, { timeout: 60000 });
    const original = await page.evaluate(async mode => {
      const [{ store }, { editorState }, config] = await Promise.all([
        import('/src/project/store.ts'), import('/src/editor/editorState.ts'), import('/src/ai/llmClient.ts'),
      ]);
      config.saveAiConfig({ ...config.defaultAiConfig(), piApply: mode, piTeam: false });
      const map = Object.values(store.getCurrent().maps)[0];
      editorState.set({ currentMapId: map.id });
      const realFetch = window.fetch;
      const encoder = new TextEncoder();
      let acknowledge;
      window.__applyModeQa = { checkpoint: false, ack: false, finish: null };
      window.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : input.url;
        if (url.includes('/v1/agent/checkpoint')) {
          const ack = JSON.parse(init.body);
          window.__applyModeQa.ack = ack.ok; window.__applyModeQa.ackIssue = ack.issue;
          acknowledge(ack);
          return new Response(JSON.stringify({ ok: true }), { status: 200 });
        }
        if (!url.includes('/v1/agent/run')) return realFetch(input, init);
        const body = JSON.parse(init.body);
        if (body.readOnly) return new Response([
          { type: 'assistant', text: '1. 바닥 한 칸을 수정한다.' },
          { type: 'done', project: body.project, changedKeys: [], stats: { ms: 1, turns: 1, toolCalls: 0, toolErrors: 0 } },
        ].map(event => JSON.stringify(event)).join('\n') + '\n', { headers: { 'Content-Type': 'application/x-ndjson' } });
        const proposed = structuredClone(body.project);
        const target = proposed.maps[map.id];
        target.lowerTiles[0] = target.lowerTiles[0] === 0 ? 1 : 0;
        target.name = '실시간 적용 확인';
        const { authorMergedSpatialProposal, exportSpatialToolProof } = await import('/src/editor/tools/spatialToolState.ts');
        authorMergedSpatialProposal(proposed, body.project);
        const proof = exportSpatialToolProof(proposed);
        return new Response(new ReadableStream({ async start(controller) {
          const write = event => controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
          const heartbeat = setInterval(() => write({ type: 'heartbeat', at: Date.now() }), 5000);
          write({ type: 'start', provider: body.provider, model: body.model, toolCount: 1 });
          if (mode !== 'review') {
            const waiting = new Promise(resolve => { acknowledge = resolve; });
            write({ type: 'checkpoint', checkpointId: 'qa-one', project: proposed, spatialProof: proof, label: '지형 단계', toolName: 'paint_tiles' });
            window.__applyModeQa.checkpoint = true;
            const ack = await waiting;
            if (!ack.ok) { write({ type: 'error', message: ack.issue }); clearInterval(heartbeat); controller.close(); return; }
            if (ack.project) Object.assign(proposed, ack.project);
            if (mode !== 'step') {
              const accepted = structuredClone(proposed);
              proposed.maps[map.id].lowerTiles[1] = proposed.maps[map.id].lowerTiles[1] === 0 ? 1 : 0;
              authorMergedSpatialProposal(proposed, accepted);
              const nextAck = new Promise(resolve => { acknowledge = resolve; });
              write({ type: 'checkpoint', checkpointId: 'qa-two', project: proposed, spatialProof: exportSpatialToolProof(proposed), label: '두 번째 변경', toolName: 'paint_tiles' });
              const second = await nextAck;
              if (!second.ok) { write({ type: 'error', message: second.issue }); clearInterval(heartbeat); controller.close(); return; }
              if (second.project) Object.assign(proposed, second.project);
            }
            await new Promise(resolve => { window.__applyModeQa.finish = resolve; });
          }
          write({ type: 'done', project: proposed, spatialProof: proof, changedKeys: [`maps.${map.id}`], stats: { ms: 1, turns: 1, toolCalls: 1, toolErrors: 0 } });
          clearInterval(heartbeat); controller.close();
        } }), { headers: { 'Content-Type': 'application/x-ndjson' } });
      };
      return { id: map.id, tile: map.lowerTiles[0], secondTile: map.lowerTiles[1], name: map.name };
    }, mode);
    await page.getByTestId('ai-composer-apply-mode').selectOption(mode);
    assert.equal(await page.getByTestId('ai-composer-apply-mode').inputValue(), mode);
    await page.getByTestId('ai-input').fill('왼쪽 위 바닥 한 칸만 바꿔줘');
    await page.getByTestId('ai-send').click();
    const current = () => page.evaluate(async id => {
      const map = (await import('/src/project/store.ts')).store.getCurrent().maps[id];
      return { tile: map.lowerTiles[0], name: map.name };
    }, original.id);
    if (mode === 'review' || mode === 'step') {
      await page.getByTestId('ai-pending-review-apply').last().waitFor({ timeout: 60000 });
      assert.deepEqual(await current(), { tile: original.tile, name: original.name });
      if (mode === 'step') assert.equal(await page.evaluate(() => window.__applyModeQa.ack), false);
      await page.screenshot({ path: `${out}/${mode}-waiting.png` });
      await page.getByTestId('ai-pending-review-apply').last().click();
    }
    await page.waitForFunction(async original => (await import('/src/project/store.ts')).store.getCurrent().maps[original.id].lowerTiles[0] !== original.tile, original, { timeout: 60000 });
    if (mode !== 'review') {
      try { await page.waitForFunction(() => typeof window.__applyModeQa.finish === 'function', undefined, { timeout: 30000 }); } catch (e) { console.log(await page.evaluate(() => window.__applyModeQa)); console.log(await page.locator('body').innerText()); throw e; }
      // The model is still running. This is the real store, not a ghost overlay.
      assert.equal(await page.evaluate(() => window.__applyModeQa.ack), true);
      await page.screenshot({ path: `${out}/${mode}-live.png` });
      await page.evaluate(() => window.__applyModeQa.finish());
    }
    await page.getByTestId('ai-inline-change-view').last().waitFor({ timeout: 60000 });
    const workProcess = page.getByTestId('ai-work-process').last();
    if ((await workProcess.getAttribute('open')) === null) await workProcess.locator(':scope > summary').click();
    const undo = page.getByRole('button', { name: '이 작업 되돌리기', exact: true }).last();
    try { await undo.waitFor({ timeout: 60000 }); } catch (e) {
      console.log(await page.locator("body").innerText());
      await page.screenshot({ path: `${out}/${mode}-failure.png` }); throw e;
    }
    await undo.click();
    await page.waitForFunction(async original => (await import('/src/project/store.ts')).store.getCurrent().maps[original.id].lowerTiles[0] === original.tile, original);
    assert.equal(await page.evaluate(async original => (await import('/src/project/store.ts')).store.getCurrent().maps[original.id].lowerTiles[1], original), original.secondTile);
    results.push({ mode, actualStoreBeforeDone: mode !== 'review', approvalBeforeMutation: ['review', 'step'].includes(mode), undo: true, errors });
    await page.close();
  }
  writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
