// Real composer/preview/apply/undo, mocked model transport. Isolated blank project only.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:9822';
const out = 'output/evidence/ai-routine-edit';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
let task = '현재 맵 이름을 산책길로 바꿔줘';
let editTile = false;
const calls = { intent: 0, coverage: 0, agents: 0, review: 0 };
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.pathname.endsWith('/auth/status')) return route.fulfill({ json: { connected: true, authKind: 'oauth' } });
    if (url.pathname.endsWith('/chat/completions') && req.method() === 'POST') {
      const body = req.postDataJSON();
      if (String(body.messages[0]?.content).startsWith('REQUEST_COVERAGE_AUDIT')) {
        calls.coverage++;
        return route.fulfill({ json: { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify({ requirements: [{ text: task, criteria: [{ kind: 'functionalUnresolved', reason: '맵 이름은 변경 카드에서 확인' }] }], clarifies: [] }) } }] } });
      }
      const isReview = body.messages.some(m => Array.isArray(m.content) && m.content.some(p => p.type === 'image_url'));
      if (isReview) calls.review++; else calls.intent++;
      return route.fulfill({ json: { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify({ mode: 'modify', space: 'none', facility: null, targetMapId: null, useSelection: false, clarify: null, clarifyOptions: [], needsPlan: false, resetsContext: false, tools: [], summary: '맵 이름 수정' }) } }] } });
    }
    if (url.pathname.endsWith('/v1/agent/run')) {
      calls.agents++;
      const body = req.postDataJSON();
      const project = body.project;
      const map = project.maps[body.mapIds[0]];
      if (editTile) map.lowerTiles[0] = map.lowerTiles[0] === 0 ? 1 : 0;
      else map.name = '산책길';
      return route.fulfill({ contentType: 'application/x-ndjson', body: [
        { type: 'start', provider: body.provider, model: body.model, toolCount: 1 },
        { type: 'assistant', text: editTile ? '바닥 한 칸을 바꿨습니다.' : '맵 이름을 산책길로 바꿨습니다.' },
        { type: 'done', project, changedKeys: [`maps.${body.mapIds[0]}`], stats: { ms: 1, turns: 1, toolCalls: 1, toolErrors: 0 } },
      ].map(e => JSON.stringify(e)).join('\n') + '\n' });
    }
    return url.origin === new URL(base).origin ? route.continue() : route.abort();
  });
  await page.goto(`${base}/?blankProject=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="ai-input"]', { state: 'attached', timeout: 60000 });
  const original = await page.evaluate(async () => {
    const [{ store }, { editorState }, config] = await Promise.all([
      import('/src/project/store.ts'), import('/src/editor/editorState.ts'), import('/src/ai/llmClient.ts'),
    ]);
    config.saveAiConfig({ ...config.defaultAiConfig(), piApply: 'review', piTeam: false, autonomyLevel: 'balanced' });
    const map = Object.values(store.getCurrent().maps)[0];
    editorState.set({ currentMapId: map.id });
    return { id: map.id, name: map.name };
  });
  await page.getByTestId('ai-composer-autonomy').selectOption('balanced');
  assert.equal(await page.getByTestId('ai-team-panel').isVisible(), false);
  await page.getByTestId('ai-composer-team').click();
  await page.getByTestId('ai-team-menu').getByRole('button', { name: '팀으로', exact: true }).click();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByTestId('ai-team-panel').isVisible(), true);
  await page.getByTestId('ai-composer-team').click();
  await page.getByTestId('ai-team-menu').getByRole('button', { name: '혼자', exact: true }).click();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByTestId('ai-team-panel').isVisible(), false);
  await page.getByTestId('ai-input').fill(task);
  await page.getByTestId('ai-send').click();
  await page.getByTestId('ai-team-apply').waitFor({ timeout: 60000 });
  const details = page.getByTestId('ai-run-details').last();
  assert.equal(await details.getAttribute('open'), null);
  await details.locator('summary').focus();
  await details.locator('summary').press('Enter');
  assert.notEqual(await details.getAttribute('open'), null);
  await details.locator('summary').press('Enter');
  assert.equal(await details.getAttribute('open'), null);
  assert.equal(await page.getByTestId('ai-team-apply').isVisible(), true);
  const name = () => page.evaluate(async id => (await import('/src/project/store.ts')).store.getCurrent().maps[id].name, original.id);
  assert.equal(await name(), original.name);
  assert.deepEqual(calls, { intent: 1, coverage: 1, agents: 1, review: 0 });
  await page.getByTestId('ai-team-apply').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/preview.png` });
  await page.getByTestId('ai-team-apply').click();
  await page.waitForFunction(async id => (await import('/src/project/store.ts')).store.getCurrent().maps[id].name === '산책길', original.id);
  const undo = page.locator('.ai-change-card').getByRole('button', { name: /되돌리기/ }).last();
  await undo.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/applied.png` });
  await undo.click();
  await page.waitForFunction(async original => (await import('/src/project/store.ts')).store.getCurrent().maps[original.id].name === original.name, original);
  editTile = true;
  task = '현재 맵 왼쪽 위 바닥 한 칸만 바꿔줘';
  const originalTile = await page.evaluate(async id => (await import('/src/project/store.ts')).store.getCurrent().maps[id].lowerTiles[0], original.id);
  await page.getByTestId('ai-input').fill(task);
  await page.getByTestId('ai-send').click();
  await page.getByTestId('ai-team-discard').waitFor();
  const tilePreview = page.locator('[data-testid="ai-change-card"][data-state="proposed"]').last();
  assert.equal(await tilePreview.getByTestId('ai-change-pair').count(), 1);
  assert.deepEqual(calls, { intent: 2, coverage: 2, agents: 2, review: 0 });
  await page.getByTestId('ai-team-discard').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/tile-preview.png` });
  for (const mode of ['beginner', 'expert']) {
    await page.evaluate(async mode => (await import('/src/editor/editorUiMode.ts')).setEditorUiMode(mode), mode);
    for (const [width, height] of [[1024, 768], [1280, 800], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      await page.getByTestId('ai-team-discard').scrollIntoViewIfNeeded();
      const box = await page.getByTestId('ai-team-apply').boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= height);
      assert.equal(await page.getByTestId('ai-run-details').last().getAttribute('open'), null);
      await page.screenshot({ path: `${out}/compact-${width}-${mode}.png` });
    }
  }
  await page.getByTestId('ai-team-discard').click();
  assert.equal(await page.evaluate(async id => (await import('/src/project/store.ts')).store.getCurrent().maps[id].lowerTiles[0], original.id), originalTile);
  writeFileSync(`${out}/report.json`, JSON.stringify({ calls, previewPreserved: true, applied: true, undoRestored: true, visualPreviewPreserved: true, discardPreserved: true, collapsedRecordKeyboard: true, conditionalTeamPanel: true, viewports: [[1024, 768], [1280, 800], [1440, 900]], modes: ['beginner', 'expert'], transport: 'mock', remoteWrites: false }, null, 2));
  console.log('PASS: existing intent/coverage + one executor, per edit, no planner/reviewer; visual preview, apply, undo and discard verified');
} finally { await browser.close(); }
