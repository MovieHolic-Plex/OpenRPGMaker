// Actual editor UI with controlled receipt replay. No model call or content write.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const out = resolve('verify-shots/ai-workspace-comfort-20261005');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-features=NetworkChangeNotifier'] });
const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'], viewport: { width: 1600, height: 1000 }, recordVideo: { dir: out + '/video', size: { width: 1600, height: 1000 } } });
const videoStart = Date.now();
const page = await context.newPage();
page.setDefaultTimeout(60000); page.setDefaultNavigationTimeout(300000);
const report = { provenance: 'Actual editor UI, controlled team receipts replay; no new model call, no authored content or canonical SQLite write.', checks: [], errors: [] };
const pending = new Set();
page.on('request', r => pending.add(r.url()));
page.on('requestfinished', r => pending.delete(r.url()));
page.on('requestfailed', r => { pending.delete(r.url()); console.error('request-failed', r.url(), r.failure()?.errorText); });
page.on('pageerror', e => { report.errors.push(e.message); console.error('browser-error', e.message); });
const check = (name, ok, detail) => { report.checks.push({ name, ok, detail }); console.log(name, ok); if (!ok) throw new Error(name + ': ' + JSON.stringify(detail)); };
const shot = async name => {
  const viewport = page.viewportSize();
  await page.setViewportSize({ ...viewport, width: viewport.width + 1 }); await page.setViewportSize(viewport);
  await page.screenshot({ path: out + '/' + name + '.png' });
};
const geometry = () => page.evaluate(() => {
  const rect = s => document.querySelector(s).getBoundingClientRect();
  const panel = document.querySelector('[data-testid=ai-panel]');
  const p = rect('[data-testid=ai-panel]');
  return { dock: rect('[data-testid=editor-ai-dock]').width, canvas: rect('.canvas-area').width,
    panel: p.width, fits: p.left >= 0 && p.right <= innerWidth + 1, folded: panel.classList.contains('is-collapsed'), tab: panel.dataset.workspaceTab,
    composers: ['ai-input', 'ai-member-input'].filter(id => document.querySelector(`[data-testid=${id}]`)?.getClientRects().length).length };
});
async function replay() {
  return page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const { createTeamBoardState, reduceTeamBoard } = await import('/src/ai/piAgent/teamBoardState.ts');
    const { publishTeamActivity } = await import('/src/ai/piAgent/teamActivity.ts');
    const { loadTeamSpec } = await import('/src/ai/piAgent/teamSpecStore.ts');
    const map = Object.values(store.getCurrent().maps)[0];
    const projectId = store.getProjectIdentity().id;
    let state = createTeamBoardState('team', 'UI 확인용 재생 · 작업 현황과 로그 추출', projectId);
    for (const [agentId, role, label, task] of [['workspace-builder','builder','시공 조수','지도 구성 확인'], ['workspace-reviewer','reviewer','검수 조수','지도 연결 검사']]) {
      const member = loadTeamSpec().members.find(m => m.enabled && m.kind === role);
      state = reduceTeamBoard(state, { type: 'agent_spawn', agentId, role, label, memberId: member?.id, mapId: map.id, mapName: map.name, task });
      state = reduceTeamBoard(state, { type: 'agent_event', agentId, event: { type: 'tool_start', id: agentId + '-read', name: 'inspect_map', args: { mapId: map.id, apiKey: 'fixture-secret', evidence: 'UI replay only' } } });
      state = reduceTeamBoard(state, { type: 'agent_event', agentId, event: { type: 'tool_end', id: agentId + '-read', name: 'inspect_map', ok: true, summary: agentId === 'workspace-builder' ? '지도 구성 확인 완료' : '지도 연결 검사 완료', result: { nodes: 3 } } });
    }
    window.__workspaceState = state; window.__workspacePublish = publishTeamActivity;
    publishTeamActivity(state);
    return { projectId, mapId: map.id, traceId: state.trace.id, entries: state.trace.entries.length };
  });
}
let recordStart = 0, recordEnd = 0;
try {
  const base = process.env.QA_BASE_URL ?? 'http://127.0.0.1:9861';
  // Isolate the optional dev disk mirrors; execution archives and downloads stay real.
  await page.route('**/__oprn/ai-activity', route => route.fulfill({ json: { ok: true } }));
  await page.route('**/__oprn/edit-activity', route => route.fulfill({ json: { ok: true } }));
  await page.addInitScript(() => {
    localStorage.setItem('oprn:locale', 'ko'); localStorage.setItem('oprn:standard-welcome-seen', '1'); localStorage.setItem('oprn:editor-welcome-dismissed', '1');
  });
  const url = base + '/?devProject=1&marketTown=1';
  await page.goto(url, { waitUntil: 'domcontentloaded' }); console.log('navigation-ready');
  await page.locator('[data-testid=edit-canvas] canvas').waitFor({ state: 'visible', timeout: 300000 }); console.log('editor-ready');
  const initial = await geometry(); check('first-visit-map-focused', initial.folded && initial.dock === 44, initial);
  check('one-workspace-no-extra-rail', await page.locator('.editor-layout > .ai-team-sidebar').count() === 0);
  await page.getByTestId('ai-collapsed-restore').click(); await page.getByTestId('ai-workspace-logs-toggle').click();
  check('empty-log-actions-disabled', await page.getByTestId('ai-workspace-log-copy').isDisabled() && await page.getByTestId('ai-workspace-log-json').isDisabled());
  await page.getByTestId('ai-workspace-logs-toggle').click(); await page.getByTestId('ai-collapse').click();
  const fixture = await replay(); report.fixture = fixture;
  check('stream-does-not-unfold', (await geometry()).folded);
  await page.getByTestId('ai-collapsed-restore').click();
  const opened = await geometry(); check('overlay-keeps-map-width', opened.dock === 44 && opened.canvas === initial.canvas && opened.panel === 380 && opened.fits, { initial, opened });
  await page.getByTestId('ai-input').fill('대화 지시 초안 · 유지 확인');
  await page.getByTestId('ai-input').evaluate(n => { window.__globalInput = n; n.setSelectionRange(3, 8); });
  recordStart = Date.now();
  await shot('01-conversation'); await page.waitForTimeout(1100);
  await page.getByTestId('ai-workspace-team-tab').click();
  check('single-member-composer', (await geometry()).composers === 1 && await page.getByTestId('ai-member-input').isVisible(), await geometry());
  check('current-result-next-visible', await page.getByTestId('ai-member-current-action').isVisible() && await page.getByTestId('ai-member-result').isVisible() && await page.getByTestId('ai-member-next').isVisible());
  await page.getByTestId('ai-member-input').fill('시공 초안 · 길 연결을 확인해주세요.');
  await page.getByTestId('ai-member-input').evaluate(n => { window.__memberInput = n; n.setSelectionRange(2, 5); });
  await shot('02-selected-assistant'); await page.waitForTimeout(1600);
  await page.locator('[data-agent-id=workspace-reviewer]').click();
  await page.getByTestId('ai-member-input').fill('검수 초안 · 출입구도 살펴봐주세요.');
  await page.locator('[data-agent-id=workspace-builder]').click();
  check('member-draft-preserved', await page.getByTestId('ai-member-input').evaluate(n => n === window.__memberInput && n.value === '시공 초안 · 길 연결을 확인해주세요.'));
  await page.evaluate(() => window.__workspacePublish({ ...window.__workspaceState, task: 'UI 확인용 재생 · 상태 갱신' }));
  check('stream-keeps-selected-tab', (await geometry()).tab === 'team');
  check('stream-keeps-selected-member', await page.getByTestId('ai-member-input').evaluate(n => n.dataset.owner === 'workspace-builder' && n.getClientRects().length > 0));
  check('active-run-reason-visible', await page.getByTestId('ai-member-send').isDisabled() && (await page.getByTestId('ai-member-next').innerText()).length > 0);
  await page.getByTestId('ai-workspace-chat-tab').click();
  check('same-global-input-draft-cursor', await page.getByTestId('ai-input').evaluate(n => n === window.__globalInput && n.value === '대화 지시 초안 · 유지 확인' && n.selectionStart === 3 && n.selectionEnd === 8));
  check('one-conversation-composer', (await geometry()).composers === 1);
  await page.waitForTimeout(1000); await page.getByTestId('ai-workspace-team-tab').click();
  await page.getByTestId('ai-member-map').click();
  check('map-view-folds-workspace', (await geometry()).folded);
  check('map-view-selects-member-map', await page.evaluate(async id => (await import('/src/editor/editorState.ts')).editorState.get().currentMapId === id, fixture.mapId));
  await shot('03-map-focus'); await page.waitForTimeout(1400);
  check('map-view-keeps-project-identity', await page.evaluate(async id => (await import('/src/project/store.ts')).store.getProjectIdentity().id === id, fixture.projectId));
  await page.getByTestId('ai-collapsed-restore').press('Enter');
  check('restore-preserves-member-draft', await page.getByTestId('ai-member-input').inputValue() === '시공 초안 · 길 연결을 확인해주세요.');
  await page.evaluate(async () => {
    const { retainActivityTrace, flushActivityArchive } = await import('/src/ai/activityTraceArchive.ts');
    retainActivityTrace(window.__workspaceState.trace);
    retainActivityTrace({ ...window.__workspaceState.trace, id: 'foreign-ui-proof', projectId: 'foreign-ui-project', serial: 1 });
    await flushActivityArchive();
  });
  await page.getByTestId('ai-workspace-logs-toggle').click();
  await page.locator(`[data-testid=ai-workspace-log-scope] option[value="${fixture.traceId}"]`).waitFor({ state: 'attached' });
  check('archive-project-isolated', await page.locator('[data-testid=ai-workspace-log-scope] option[value="foreign-ui-proof"]').count() === 0);
  await page.getByTestId('ai-workspace-log-scope').selectOption('member');
  await page.getByTestId('ai-workspace-log-copy').click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  check('clipboard-member-scope', copied.includes('지도 구성 확인 완료') && !copied.includes('지도 연결 검사 완료') && !copied.includes('fixture-secret'), { length: copied.length });
  const txtPromise = page.waitForEvent('download'); await page.getByTestId('ai-workspace-log-txt').click();
  const txt = await txtPromise; await txt.saveAs(out + '/selected-member.txt');
  check('txt-actual-download', readFileSync(out + '/selected-member.txt', 'utf8') === copied);
  const jsonPromise = page.waitForEvent('download'); await page.getByTestId('ai-workspace-log-json').click();
  const json = await jsonPromise; await json.saveAs(out + '/selected-member.json');
  const record = JSON.parse(readFileSync(out + '/selected-member.json', 'utf8'));
  check('json-member-projection', record.entries.length > 0 && record.entries.every(e => e.actor === 'workspace-builder') && record.projectId === fixture.projectId);
  await shot('04-log-export'); await page.waitForTimeout(1700);
  await page.getByTestId('ai-workspace-log-scope').selectOption('run');
  const fullPromise = page.waitForEvent('download'); await page.getByTestId('ai-workspace-log-json').click();
  const full = await fullPromise; await full.saveAs(out + '/whole-run.json');
  check('whole-run-projection', JSON.parse(readFileSync(out + '/whole-run.json', 'utf8')).entries.length === fixture.entries);
  await page.getByTestId('ai-workspace-log-scope').selectOption(fixture.traceId);
  const archivePromise = page.waitForEvent('download'); await page.getByTestId('ai-workspace-log-json').click();
  const archive = await archivePromise; await archive.saveAs(out + '/archived-run.json');
  check('archived-run-download', JSON.parse(readFileSync(out + '/archived-run.json', 'utf8')).id === fixture.traceId);
  await page.getByTestId('ai-workspace-log-scope').selectOption('member');
  // Simulate denied clipboard APIs; the earlier clipboard check used the real API.
  await page.evaluate(() => {
    window.__copyWrite = navigator.clipboard.writeText; window.__execCommand = document.execCommand;
    navigator.clipboard.writeText = async () => { throw new Error('UI proof: clipboard denied'); }; document.execCommand = () => false;
  });
  await page.getByTestId('ai-workspace-log-copy').click();
  await page.getByTestId('ai-workspace-log-manual').waitFor({ state: 'visible' });
  const manualText = await page.getByTestId('ai-workspace-log-manual').inputValue();
  await page.evaluate(() => window.__workspacePublish({ ...window.__workspaceState, task: 'UI 확인용 재생 · 복사 중 갱신' }));
  const manualAfter = { visible: await page.getByTestId('ai-workspace-log-manual').isVisible(), text: await page.getByTestId('ai-workspace-log-manual').inputValue() };
  check('manual-copy-survives-stream', manualAfter.visible && manualAfter.text === manualText, { visible: manualAfter.visible, same: manualAfter.text === manualText });
  await page.evaluate(() => { navigator.clipboard.writeText = window.__copyWrite; document.execCommand = window.__execCommand; });
  await page.getByTestId('ai-workspace-logs-toggle').click();
  await page.getByTestId('ai-wide-open').first().click();
  check('wide-shares-live-nodes', await page.getByTestId('ai-input').evaluate(n => n === window.__globalInput) && await page.getByTestId('ai-member-input').evaluate(n => n === window.__memberInput));
  await shot('05-wide'); await page.waitForTimeout(1200);
  await page.getByTestId('ai-wide-dismiss').click();
  check('wide-restores-one-pane', (await geometry()).composers === 1 && await page.getByTestId('ai-team-sidebar').evaluate(n => n.classList.contains('is-embedded') && n.closest('[data-testid=ai-deck]') !== null));
  await page.getByTestId('ai-wide-open').first().click(); await page.getByTestId('ai-member-map').click();
  check('wide-map-reveals-map', await page.getByTestId('ai-assistant-wide').count() === 0 && (await geometry()).folded);
  await page.getByTestId('ai-collapsed-restore').click();
  for (const width of [1024, 700]) {
    await page.setViewportSize({ width, height: 1000 });
    const open = await geometry(); await page.getByTestId('ai-collapse').click(); const folded = await geometry();
    check('responsive-overlay-' + width, open.fits && open.dock === 44 && folded.canvas === open.canvas, { open, folded });
    await page.getByTestId('ai-collapsed-restore').click(); await shot('06-width-' + width);
  }
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.getByTestId('ai-collapse').click(); await shot('07-final-map'); recordEnd = Date.now();
  check('tab-and-fold-preferences-saved', await page.evaluate(() => localStorage.getItem('oprn:ai-panel-collapsed') === '1' && localStorage.getItem('oprn:ai-workspace-tab') === 'team'));
  report.reloadVerification = 'Not included: repeated shared-machine ERR_NETWORK_CHANGED interrupted dev reloads; report verifies saved preference values and live fold/restore instead.';
  // The real export formatter retains more than the payload sanitizer's 120-array limit.
  const exportChecks = await page.evaluate(async () => {
    const { createActivityTrace } = await import('/src/ai/activityTrace.ts');
    const { projectActivityTrace, formatActivityTraceText } = await import('/src/ai/activityTraceExport.ts');
    const trace = { ...createActivityTrace('retention proof'), dropped: 7, entries: Array.from({ length: 201 }, (_, i) => ({ id: String(i), at: Date.now(), actor: 'proof', kind: 'tool', name: 'inspect', status: 'ok', summary: 'Bearer fixture-token', input: { apiKey: 'fixture-secret' } })) };
    const output = projectActivityTrace(trace);
    return { count: output.entries.length, redacted: !JSON.stringify(output).includes('fixture-secret') && !JSON.stringify(output).includes('fixture-token'), dropped: formatActivityTraceText(trace).includes('7건') };
  });
  check('export-retention-and-redaction', exportChecks.count === 201 && exportChecks.redacted && exportChecks.dropped, exportChecks);
  check('no-browser-errors', report.errors.length === 0, report.errors);
  report.passed = true;
} catch (error) { report.failure = error.message; report.pendingRequests = [...pending]; console.error('failed', error.message, report.pendingRequests); await shot('failure').catch(() => {}); throw error; }
finally {
  writeFileSync(out + '/report.json', JSON.stringify(report, null, 2) + '\n');
  const video = await page.video().path(); await context.close(); await browser.close();
  if (report.passed) {
    const result = spawnSync('ffmpeg', ['-y', '-ss', String((recordStart - videoStart) / 1000), '-i', video, '-t', String((recordEnd - recordStart) / 1000), '-an', '-c:v', 'libx264', '-threads', '2', '-preset', 'veryfast', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out + '/ai-workspace-comfort.mp4'], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error('MP4 encode failed: ' + result.stderr.slice(-1000));
  }
}
