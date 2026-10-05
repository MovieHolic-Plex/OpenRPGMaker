// Actual editor UI, with controlled team state and restore status for layout checks.
// No natural-language/model execution, no authored content or SQLite write.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const out = resolve('verify-shots/ai-dock-collapse-20261005');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, recordVideo: { dir: out + '/video', size: { width: 1600, height: 1000 } } });
const videoStarted = Date.now();
const page = await context.newPage();
page.setDefaultNavigationTimeout(300000);
const report = { provenance: 'Actual editor UI; controlled team state, one bubble and restore status injected for layout checks. No model call or canonical write.', checks: [], errors: [] };
page.on('pageerror', error => report.errors.push(error.message));
let recordingStarted = 0;
const check = (name, ok, details) => { report.checks.push({ name, ok, details }); console.log(name, ok); if (!ok) throw new Error(name + ': ' + JSON.stringify(details)); };
const shot = async name => {
  // Resize requests a complete browser repaint before recording the layout.
  const viewport = page.viewportSize();
  await page.setViewportSize({ ...viewport, width: viewport.width + 1 });
  await page.setViewportSize(viewport);
  await page.screenshot({ path: out + '/' + name + '.png', timeout: 60000 });
};
const geometry = () => page.evaluate(() => {
  const rect = selector => document.querySelector(selector).getBoundingClientRect();
  const dock = document.querySelector('[data-testid=editor-ai-dock]');
  const panel = document.querySelector('[data-testid=ai-panel]');
  return { dock: rect('[data-testid=editor-ai-dock]').width, canvas: rect('.canvas-area').width,
    team: rect('[data-testid=ai-team-sidebar]').width, folded: panel.classList.contains('is-collapsed'),
    fits: dock.scrollWidth <= dock.clientWidth + 1, leftPane: document.querySelector('[data-testid=editor-ai-sidebar]').dataset.pane };
});
try {
  await page.addInitScript(() => {
    localStorage.setItem('oprn:locale', 'ko');
    localStorage.setItem('oprn:standard-welcome-seen', '1');
    localStorage.setItem('oprn:editor-welcome-dismissed', '1');
    for (const key of ['oprn:ai-panel-collapsed', 'oprn:ai-team-sidebar-collapsed']) {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, '0');
    }
  });
  const url = (process.env.QA_BASE_URL ?? 'http://127.0.0.1:9861') + '/?devProject=1&marketTown=1';
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-testid="edit-canvas"] canvas').waitFor({ state: 'visible', timeout: 300000 });
  await page.evaluate(async () => {
    const { createTeamBoardState, reduceTeamBoard } = await import('/src/ai/piAgent/teamBoardState.ts');
    const { publishTeamActivity } = await import('/src/ai/piAgent/teamActivity.ts');
    let state = createTeamBoardState('team', 'UI 배치 확인용 상태');
    state = reduceTeamBoard(state, { type: 'agent_spawn', agentId: 'collapse-ui-agent', role: 'builder', memberId: 'builder', label: '조수', mapId: null, task: '화면 배치 확인', at: Date.now() });
    publishTeamActivity(state);
    const bubble = document.createElement('p'); bubble.dataset.collapseEvidence = 'true';
    bubble.textContent = '화면 확인용 대화 · 접고 펼쳐도 유지됩니다.';
    document.querySelector('[data-testid=ai-chat-log]').append(bubble);
    window.__collapseLogNode = document.querySelector('[data-testid=ai-chat-log]');
  });
  await page.getByTestId('ai-input').fill('작성 중인 AI 지시를 유지해주세요.');
  await page.getByTestId('ai-input').evaluate(input => { window.__collapseInputNode = input; input.setSelectionRange(3, 8); });
  recordingStarted = Date.now();
  const before = await geometry(); await shot('01-expanded'); await page.waitForTimeout(900);
  await page.getByTestId('ai-collapse').click(); await page.waitForTimeout(800);
  const folded = await geometry();
  check('conversation-releases-canvas-width', folded.folded && folded.dock === 44 && folded.canvas > before.canvas + 250, { before, folded });
  check('team-and-left-pane-independent', folded.team === before.team && folded.leftPane === before.leftPane, { before, folded });
  check('deck-inert-and-hidden', await page.getByTestId('ai-deck').evaluate(node => node.inert && !node.getClientRects().length));
  check('conversation-header-hidden', await page.getByTestId('ai-collapse').evaluate(node => !node.getClientRects().length));
  check('restore-visible-and-focused', await page.getByTestId('ai-collapsed-restore').evaluate(node => node.getClientRects().length > 0 && document.activeElement === node && node.getAttribute('aria-expanded') === 'false'));
  await page.evaluate(async () => {
    const { setRestoreButtonState } = await import('/src/editor/panels/aiDirectorChrome.ts');
    setRestoreButtonState(document.querySelector('[data-testid=ai-collapsed-restore]'), 'run', '작업 중', 0);
  });
  check('state-update-does-not-expand', (await geometry()).folded);
  await shot('02-ai-collapsed'); await page.waitForTimeout(900);
  await page.getByTestId('ai-collapsed-restore').press('Enter'); await page.waitForTimeout(800);
  const input = await page.getByTestId('ai-input').evaluate(node => ({ sameNode: node === window.__collapseInputNode, text: node.value, start: node.selectionStart, end: node.selectionEnd }));
  check('draft-and-cursor-preserved', input.sameNode && input.text === '작성 중인 AI 지시를 유지해주세요.' && input.start === 3 && input.end === 8, input);
  check('conversation-node-and-content-preserved', await page.getByTestId('ai-chat-log').evaluate(node => node === window.__collapseLogNode && node.querySelector('[data-collapse-evidence]')?.textContent.includes('접고 펼쳐도')));
  check('restore-by-keyboard', !(await geometry()).folded && await page.getByTestId('ai-collapse').evaluate(node => document.activeElement === node));
  await shot('03-restored-input'); await page.waitForTimeout(900);
  await page.getByTestId('ai-collapse').click();
  await page.getByTestId('ai-team-sidebar-collapse').click(); await page.waitForTimeout(600);
  check('both-can-collapse', (await geometry()).dock === 44 && (await geometry()).team === 44);
  await shot('04-both-collapsed');
  for (const width of [1024, 1600]) {
    await page.setViewportSize({ width, height: 1000 }); await page.waitForTimeout(300);
    const bounds = await geometry(); check('folded-layout-' + width, bounds.dock === 44 && bounds.team === 44 && bounds.fits && bounds.canvas > 200, bounds);
  }
  // Reload into the same context; addInitScript must not overwrite the preference.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-testid="edit-canvas"] canvas').waitFor({ state: 'visible', timeout: 300000 });
  const reloaded = await geometry();
  check('reload-restores-choice', reloaded.folded && reloaded.dock === 44 && reloaded.team === 44, reloaded);
  await page.evaluate(async () => {
    const { openAiAssistantPanel } = await import('/src/editor/aiAssistantBridge.ts');
    if (!openAiAssistantPanel()) throw new Error('AI panel open handler missing');
  });
  check('public-open-restores-ai-only', !(await geometry()).folded && (await geometry()).team === 44, await geometry());
  check('no-browser-errors', report.errors.length === 0, report.errors);
  report.passed = true;
} catch (error) {
  report.failure = error.message; await shot('failure').catch(() => {}); throw error;
} finally {
  writeFileSync(out + '/report.json', JSON.stringify(report, null, 2) + '\n');
  const video = await page.video().path(); await context.close(); await browser.close();
  if (report.passed) {
    const encoded = spawnSync('ffmpeg', ['-y', '-ss', String((recordingStarted - videoStarted) / 1000), '-i', video, '-t', '7', '-an', '-c:v', 'libx264', '-threads', '2', '-preset', 'veryfast', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out + '/ai-dock-collapse.mp4'], { encoding: 'utf8' });
    if (encoded.status !== 0) throw new Error('MP4 encode failed');
  }
}
