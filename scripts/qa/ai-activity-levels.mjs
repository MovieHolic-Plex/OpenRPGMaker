// Real editor, deterministic Pi stream. No live model or remote content writes.
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const base = process.env.BASE ?? 'http://127.0.0.1:9836';
const out = resolve('output/evidence/ai-activity-levels');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(20000);
const errors = [], checks = [];
const check = (label, ok) => { checks.push({ label, ok }); if (!ok) throw new Error(label); };
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
page.on('pageerror', e => errors.push(e.message));
let owner;
try {
  await page.addInitScript(() => {
    localStorage.setItem('oprn:editor-ui-mode', 'standard');
    localStorage.setItem('oprn:standard-welcome-seen', '1');
    localStorage.setItem('oprn:coachmarks-basic-v1', '1');
    localStorage.setItem('oprn:editor-welcome-dismissed', '1');
    localStorage.setItem('oprn:ai-config', JSON.stringify({ piApply: 'review', piApplyPolicyVersion: 1, piTeam: true }));
  });
  await page.route('**/rest/v1/**', r => r.fulfill({ json: [] }));
  await page.route('**/__oprn/ai-activity', r => r.fulfill({ json: { ok: true } }));
  await page.route('**/v1/chat/completions', r => r.fulfill({ json: { choices: [{ message: { role: 'assistant', content: JSON.stringify({ harmonious: true, summary: '변경안을 확인했습니다.', findings: [] }) }, finish_reason: 'stop' }] } }));
  await page.route('**/v1/agent/run**', async route => {
    const req = route.request().postDataJSON();
    const mapId = req.currentMapId ?? req.mapIds?.[0] ?? req.project.startMapId;
    const after = structuredClone(req.project); after.maps[mapId].name = '표시 수준 확인';
    const stats = { ms: 84000, turns: 3, toolCalls: 222, toolErrors: 1 };
    const stamp = Date.now() - 84000;
    const events = [
      { type: 'team_start', task: req.task, roles: [] },
      { type: 'agent_spawn', agentId: 'builder-1', role: 'builder', mapId, mapName: '시장 마을', task: '집과 길 배치', label: '시공 담당' },
    ];
    for (let i = 0; i < 220; i++) {
      events.push({ type: 'agent_event', agentId: 'builder-1', event: { type: 'tool_start', id: `read-${i}`, name: 'get_map_region', args: { mapId, x: i % 20, apiKey: 'mock-secret-value', note: 'a'.repeat(240) }, at: stamp + i * 200 } });
      events.push({ type: 'agent_event', agentId: 'builder-1', event: { type: 'tool_end', id: `read-${i}`, name: 'get_map_region', ok: true, summary: '빈터 확인', result: { ok: true, cells: 16 }, durationMs: 18, at: stamp + i * 200 + 18 } });
    }
    for (const [id, name, ok, summary] of [['road-1', 'paint_road', false, '나무와 충돌'], ['road-2', 'paint_road', true, '나무를 피해 길 24칸 연결']]) {
      events.push({ type: 'agent_event', agentId: 'builder-1', event: { type: 'tool_start', id, name, args: { mapId, x: 28, y: 16 }, at: stamp + 50000 } });
      events.push({ type: 'agent_event', agentId: 'builder-1', event: { type: 'tool_end', id, name, ok, summary, result: { ok, changedCells: ok ? 24 : 0, retryOf: ok ? 'road-1' : null }, durationMs: 203, at: stamp + 50203 } });
    }
    events.push(
      { type: 'agent_done', agentId: 'builder-1', ok: true, summary: '길 연결 완료', stats, changedKeys: [`maps.${mapId}`], spills: [], conflicts: [] },
      { type: 'team_report', text: '변경안을 준비했어요. 확인 후 적용해 주세요.' },
      { type: 'done', project: after, stats, changedKeys: [`maps.${mapId}`], spatialProof: req.project.spatialAuthoring ? { baseline: hash(req.project), spatial: hash(req.project.spatialAuthoring), proposed: hash(after) } : null },
    );
    await route.fulfill({ contentType: 'application/x-ndjson', body: events.map(e => JSON.stringify(e)).join('\n') + '\n' });
  });
  await page.goto(`${base}/?devProject=1&marketTown=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const guest = page.getByTestId('login-guest');
  await page.getByTestId('ai-input').or(guest).first().waitFor({ timeout: 120000 });
  if (await guest.isVisible()) await guest.click();
  const level = page.locator('.ai-activity-toolbar [data-testid="ai-activity-level"]');
  await level.waitFor({ timeout: 120000 });
  check('Default is brief and available before first turn', await level.inputValue() === 'brief');
  await page.getByTestId('ai-input').fill('/pi team 마을 이름을 바꿔줘');
  await page.getByTestId('ai-send').click();
  await page.getByTestId('ai-pending-review-apply').waitFor({ timeout: 60000 });
  const view = page.locator('.ai-work-inline .ai-team-board > .ai-activity-view').first();
  await view.waitFor();
  check('Brief shows at most four retained steps', await view.locator('.ai-activity-entry').count() <= 4);
  await page.screenshot({ path: resolve(out, '01-brief.png') });
  await level.selectOption('detail');
  check('Detailed work entries are visible', await view.locator('.ai-activity-entry').count() === 50);
  await page.screenshot({ path: resolve(out, '02-detail.png') });
  await level.selectOption('trace');
  await view.getByLabel('실행 기록 종류').selectOption('error');
  check('Recovered tool error remains searchable', (await view.innerText()).includes('나무와 충돌'));
  await view.getByLabel('실행 기록 종류').selectOption('all');
  await view.getByLabel('실행 기록 검색').fill('read-0');
  check('Trace retains a tool older than the 200-row team cap', await view.locator('.ai-activity-entry').count() === 1);
  await view.locator('.ai-activity-entry > summary').click();
  check('Full arguments exceed old 200-character summary', (await view.locator('pre').first().innerText()).includes('a'.repeat(240)));
  check('Credentials are redacted before retention', !(await view.innerText()).includes('mock-secret-value'));
  await page.screenshot({ path: resolve(out, '03-trace-payload.png') });
  await view.getByLabel('실행 기록 검색').fill('road-2');
  await view.locator('.ai-activity-entry > summary').click();
  check('Tool result and retry reference are available', (await view.innerText()).includes('road-1') && (await view.innerText()).includes('changedCells'));
  await view.getByLabel('실행 기록 검색').fill('');
  const download = page.waitForEvent('download'); await view.getByText('기록 내려받기', { exact: true }).click();
  await (await download).saveAs(resolve(out, 'execution.json'));
  await level.selectOption('none');
  check('Omit hides work but preserves review decision', !(await view.isVisible()) && await page.getByTestId('ai-pending-review-apply').isVisible());
  await page.screenshot({ path: resolve(out, '04-omit-review.png') });
  await level.selectOption('brief');
  await page.getByTestId('ai-team-member').first().click();
  check('Team detail shares brief preference', await page.getByTestId('ai-member-detail').getByTestId('ai-activity-level').inputValue() === 'brief');
  await page.getByTestId('ai-member-detail').getByTestId('ai-activity-level').selectOption('trace');
  check('Team selection updates main preference', await level.inputValue() === 'trace');
  check('Member trace is visible', await page.getByTestId('ai-member-detail').getByTestId('ai-activity-view').isVisible());
  await page.getByTestId('ai-member-close').click();
  await page.setViewportSize({ width: 1024, height: 768 });
  await level.selectOption('brief');
  await page.getByTestId('ai-pending-review').scrollIntoViewIfNeeded();
  check('Review decision visible at 1024px', await page.getByTestId('ai-pending-review-apply').isVisible());
  await page.screenshot({ path: resolve(out, '05-compact.png') });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByTestId('ai-input').fill('다음 작업 초안');
  await page.getByTestId('ai-wide-open').click();
  const wide = page.getByTestId('ai-assistant-wide');
  check('Large window contains the same conversation and team', await wide.getByTestId('ai-input').inputValue() === '다음 작업 초안' && await wide.getByTestId('ai-team-sidebar').isVisible());
  check('Large window opens a member detail beside the conversation', await wide.getByTestId('ai-member-detail').isVisible());
  await level.selectOption('trace');
  await view.getByLabel('실행 기록 검색').fill('road-2');
  const entry = view.locator('.ai-activity-entry').first();
  if (!(await entry.evaluate(node => node.open))) await entry.locator('summary').click();
  check('Expanded trace exposes structured results in the large window', (await entry.innerText()).includes('changedCells'));
  await page.screenshot({ path: resolve(out, '06-wide.png') });
  const bounds = await page.evaluate(() => {
    const dialog = document.querySelector('[data-testid=ai-assistant-wide]').getBoundingClientRect();
    const chat = document.querySelector('[data-testid=ai-panel]').getBoundingClientRect();
    const team = document.querySelector('[data-testid=ai-team-sidebar]').getBoundingClientRect();
    return chat.right <= team.left + 1 && team.right <= dialog.right && chat.width > 550 && team.width > 340;
  });
  check('Large conversation and team use separate nonoverlapping columns', bounds);
  await page.setViewportSize({ width: 1024, height: 768 });
  check('Large review and team remain accessible at 1024px', await wide.getByTestId('ai-pending-review-apply').isVisible() && await wide.getByTestId('ai-member-detail').isVisible());
  await page.screenshot({ path: resolve(out, '07-wide-compact.png') });
  await page.getByTestId('ai-wide-close').click();
  check('Closing restores draft, single session and trace selection', await page.getByTestId('ai-input').inputValue() === '다음 작업 초안' && await page.getByTestId('ai-panel').count() === 1 && await view.getByLabel('실행 기록 검색').inputValue() === 'road-2');
  await page.getByTestId('ai-wide-open').click();
  await page.keyboard.press('Escape');
  check('Escape restores the normal panel and trigger focus', await wide.count() === 0 && await page.getByTestId('ai-wide-open').evaluate(node => node === document.activeElement));
  await view.getByLabel('실행 기록 검색').fill('');
  await page.getByTestId('ai-member-close').click();
  owner = await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const archive = await import('/src/ai/activityTraceArchive.ts');
    await archive.flushActivityArchive();
    const id = store.getProjectIdentity().id;
    const traces = await archive.readActivityArchive(id);
    return { id, count: traces.length, entries: traces.reduce((n,t)=>Math.max(n,t.entries.length),0) };
  });
  check('Execution persists separately from display cap', owner.entries > 220);
  await page.getByTestId('ai-pending-review-discard').click();
  await page.waitForFunction(() => document.querySelector('[data-testid=ai-team-board]')?.getAttribute('data-phase') === '버림');
  await level.selectOption('trace');
  await page.evaluate(async()=>{await (await import('/src/ai/activityTraceArchive.ts')).flushActivityArchive();});
  // Vite may serve timestamped module instances; observe the persisted receipt
  // instead of assuming a dynamic import shares the UI's pending write queue.
  await page.waitForFunction(async id => (await (await import('/src/ai/activityTraceArchive.ts')).readActivityArchive(id)).some(t => t.phase === '버림'), owner.id);
  writeFileSync(resolve(out, 'before-reload.json'), JSON.stringify(await page.evaluate(async id => (await import('/src/ai/activityTraceArchive.ts')).readActivityArchive(id), owner.id), null, 2));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await level.waitFor({ timeout: 120000 });
  check('Display preference survives reload', await level.inputValue() === 'trace');
  const restored = await page.evaluate(async id => (await import('/src/ai/activityTraceArchive.ts')).readActivityArchive(id), owner.id);
  writeFileSync(resolve(out, 'restored.json'), JSON.stringify(restored, null, 2));
  check('Archive survives reload with tool arguments and final phase', restored.some(t=>t.phase==='버림' && t.entries.some(e=>e.kind==='tool' && e.input.callId==='read-0')));
  await level.selectOption('brief');
  await page.evaluate(async () => {
    const { createInlineWorkCard } = await import('/src/editor/panels/aiInlineWorkCard.ts');
    const card = createInlineWorkCard({ title: '영역 작업 표시 확인', onStop: () => { card.finish({ ok: false, message: '중단' }); } });
    card.root.dataset.qaActivity = 'region';
    document.querySelector('[data-testid=ai-panel]').dataset.aiConversation = 'active';
    document.querySelector('.ai-chat-suggestions').hidden = true;
    document.querySelector('.ai-chat-log').append(card.root);
    card.recordActivity({ type: 'tool_start', id: 'region-read', name: 'get_map_region', args: { x: 2, y: 3, width: 4, height: 4 } });
  });
  const region = page.locator('[data-qa-activity="region"]');
  await region.scrollIntoViewIfNeeded();
  check('Region surface shows current read operation by default', (await region.innerText()).includes('영역 읽기 · 실행 중'));
  await level.selectOption('none');
  check('Stop remains available in omit mode', await region.getByRole('button', { name: '중지', exact: true }).isVisible());
  await region.getByRole('button', { name: '중지', exact: true }).click();
  check('Interrupted operation retains visible outcome', (await region.innerText()).includes('중단'));
  await level.selectOption('trace');
  await region.locator('.ai-activity-entry').filter({ hasText: 'get_map_region' }).first().locator('summary').click();
  check('Interrupted call exposes original input', (await region.innerText()).includes('region-read'));
  const lane = await page.evaluate(async () => {
    const { createLaneManager } = await import('/src/editor/panels/aiLaneManager.ts');
    const { store } = await import('/src/project/store.ts');
    const manager = createLaneManager({ runAgent: async (_request, options) => {
      options.onEvent({ type: 'tool_start', id: 'lane-tool', name: 'get_map_region', args: { x: 4, y: 6 } });
      options.onEvent({ type: 'tool_end', id: 'lane-tool', name: 'get_map_region', ok: false, summary: '조회 실패', result: { reason: 'fixture' } });
      throw new Error('검수 연결 끊김');
    } });
    const mapId = store.getCurrent().startMapId;
    manager.add({ id: 'qa-lane', label: '검수', mapIds: [mapId], agentLabel: '검수 담당', provider: 'google-antigravity', model: 'gemini-3.7-flash', instruction: '범위 확인' });
    await manager.start('qa-lane');
    const result = manager.get('qa-lane');
    const facts = { phase: result.trace?.phase, status: result.status, hasResult: result.trace?.entries.some(e => e.name === 'get_map_region' && e.status === 'error' && e.output.reason === 'fixture') };
    manager.dispose();
    return facts;
  });
  check('Follow-up lane retains tool failure and final failure separately', lane.phase === '실패' && lane.status === 'failed' && lane.hasResult);
  check('No browser errors', errors.length === 0);
} finally {
  await page.screenshot({ path: resolve(out, 'last-screen.png') }).catch(()=>{});
  writeFileSync(resolve(out, 'report.json'), JSON.stringify({ checks, errors, owner }, null, 2));
  await browser.close();
}
console.log(JSON.stringify(checks));
