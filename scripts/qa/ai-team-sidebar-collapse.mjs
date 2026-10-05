// Editor UI evidence: replay captured live receipts, then inject one completion.
// No new model call and no canonical content writes.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const out = resolve('verify-shots/ai-team-sidebar-collapse-20261005');
mkdirSync(out, { recursive: true });
const captured = JSON.parse(readFileSync('verify-shots/ai-team-exploration-20261005-parallel/report.json', 'utf8')).runs[0].wire.events;
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, recordVideo: { dir: out + '/video', size: { width: 1600, height: 1000 } } });
const videoStart = Date.now();
const page = await context.newPage();
let demoStart = 0;
const report = { provenance: 'Actual editor UI; captured live spawn/tool receipts replayed and one completion injected. No live model request or canonical write.', checks: [], errors: [] };
page.on('pageerror', error => report.errors.push(error.message));
const check = (name, ok, detail) => { report.checks.push({ name, ok, detail }); if (!ok) throw new Error(name + ': ' + JSON.stringify(detail)); };
const sidebar = () => page.getByTestId('ai-team-sidebar');
const toggle = () => page.getByTestId('ai-team-sidebar-collapse');
const screenshot = name => page.screenshot({ path: out + '/' + name + '.png' });
const geometry = () => page.evaluate(() => {
  const team = document.querySelector('[data-testid=ai-team-sidebar]');
  const canvas = document.querySelector('.canvas-area');
  const wide = document.querySelector('.ai-assistant-wide-content');
  const chat = wide?.querySelector('.ai-chat-panel');
  return { teamWidth: team.getBoundingClientRect().width, collapsed: team.dataset.collapsed,
    canvasWidth: canvas.getBoundingClientRect().width, wideWidth: wide?.getBoundingClientRect().width,
    chatWidth: chat?.getBoundingClientRect().width, teamHeight: team.getBoundingClientRect().height,
    dividerVisible: wide ? getComputedStyle(wide.querySelector('.ai-assistant-wide-divider')).display !== 'none' : null,
    teamFits: team.scrollWidth <= team.clientWidth + 1 };
});
const replay = async () => page.evaluate(async events => {
  const { createTeamBoardState, reduceTeamBoard } = await import('/src/ai/piAgent/teamBoardState.ts');
  const { publishTeamActivity } = await import('/src/ai/piAgent/teamActivity.ts');
  let state = createTeamBoardState('team', '기록된 조수 실행 · 창 접기 확인');
  for (const e of events) {
    if (e.type === 'agent_done') break;
    if (e.type === 'agent_spawn') state = reduceTeamBoard(state, { type: 'agent_spawn', agentId: e.actor, role: e.role,
      memberId: e.memberId, label: e.memberId === 'builder' ? '등대 조수' : e.memberId === 'events' ? '부두 조수' : '팀장',
      mapId: e.mapId, mapName: e.mapId === 'team_lighthouse' ? '등대' : '부두', task: e.task, at: e.receivedAt });
    if (['tool_start', 'tool_end'].includes(e.kind)) state = reduceTeamBoard(state, { type: 'agent_event', agentId: e.actor,
      event: { type: e.kind, id: e.id, name: e.name, args: {}, ok: e.ok, summary: e.summary, at: e.receivedAt } });
  }
  window.__teamCollapseState = state;
  publishTeamActivity(state);
}, captured);
try {
  await page.addInitScript(() => {
    localStorage.setItem('oprn:locale', 'ko');
    localStorage.setItem('oprn:standard-welcome-seen', '1');
    localStorage.setItem('oprn:editor-welcome-dismissed', '1');
    localStorage.setItem('oprn:ai-activity-level', 'brief');
  });
  await page.goto((process.env.QA_BASE_URL ?? 'http://127.0.0.1:9861') + '/?devProject=1&marketTown=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__oprnAiBridge?.status?.().panelMounted, null, { timeout: 120000 });
  await page.locator('[data-testid="edit-canvas"] canvas').waitFor({ state: 'visible', timeout: 120000 });
  await replay();
  await page.locator('[data-testid=ai-team-member][data-agent-id=builder-1]').click();
  await page.getByTestId('ai-member-input').fill('같은 조수의 초안을 유지해주세요.');
  await page.getByTestId('ai-member-input').evaluate(input => { window.__teamCollapseInput = input; input.setSelectionRange(2, 6); });
  demoStart = Date.now();
  const before = await geometry();
  await screenshot('01-expanded'); await page.waitForTimeout(800);
  await toggle().click(); await page.waitForTimeout(800);
  const folded = await geometry();
  check('rail-releases-canvas-space', folded.teamWidth === 44 && folded.canvasWidth > before.canvasWidth + 200, { before, folded });
  check('hidden-details-inert', await page.getByTestId('ai-member-detail').evaluate(node => node.inert));
  check('restore-accessible', await toggle().getAttribute('aria-expanded') === 'false');
  await screenshot('02-collapsed');
  await page.evaluate(async () => {
    const { publishTeamActivity } = await import('/src/ai/piAgent/teamActivity.ts');
    publishTeamActivity({ ...window.__teamCollapseState, agents: window.__teamCollapseState.agents.map(agent => agent.agentId === 'builder-1' ? { ...agent, state: '완료', summary: '완료 상태 주입 · 접힘 유지 확인' } : agent) });
  });
  check('update-keeps-folded', (await geometry()).collapsed === 'true');
  check('running-count-updates', await sidebar().locator('.ai-team-collapse-status').innerText() === '1');
  await page.waitForTimeout(800); await toggle().click(); await page.waitForTimeout(800);
  const draft = await page.getByTestId('ai-member-input').evaluate(input => ({ sameNode: input === window.__teamCollapseInput, text: input.value, start: input.selectionStart, end: input.selectionEnd }));
  check('draft-selection-node-preserved', draft.sameNode && draft.text === '같은 조수의 초안을 유지해주세요.' && draft.start === 2 && draft.end === 6, draft);
  check('expanded-width-restored', (await geometry()).teamWidth === before.teamWidth);
  await screenshot('03-restored-draft'); await page.waitForTimeout(800);
  await toggle().click(); await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__oprnAiBridge?.status?.().panelMounted, null, { timeout: 120000 });
  await page.locator('[data-testid="edit-canvas"] canvas').waitFor({ state: 'visible', timeout: 120000 });
  check('reload-remembers-fold', (await geometry()).collapsed === 'true' && await toggle().isVisible());
  await replay(); check('new-activity-keeps-folded', (await geometry()).collapsed === 'true');
  await toggle().click();
  await page.getByTestId('ai-wide-open').click();
  await page.getByTestId('ai-assistant-wide').waitFor();
  for (const width of [1600, 1024, 700]) {
    await page.setViewportSize({ width, height: 1000 });
    const open = await geometry(); await toggle().click(); await page.waitForTimeout(300);
    const shut = await geometry();
    check('wide-collapse-' + width, width > 760 ? shut.teamWidth === 44 && shut.chatWidth > open.chatWidth && !shut.dividerVisible : shut.teamHeight <= 45 && shut.teamFits, { open, shut });
    await screenshot('04-wide-collapsed-' + width);
    await toggle().click(); await page.waitForTimeout(300);
    const restored = await geometry();
    check('wide-restores-' + width, restored.teamWidth > 250 && restored.teamFits, restored);
  }
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.getByTestId('ai-wide-dismiss').click();
  check('wide-returns-live-sidebar', await sidebar().evaluate(node => node.parentElement.classList.contains('editor-layout')));
  check('no-browser-errors', report.errors.length === 0, report.errors);
  report.passed = true;
} catch (error) {
  report.failure = error.message; await screenshot('failure'); throw error;
} finally {
  writeFileSync(out + '/report.json', JSON.stringify(report, null, 2) + '\n');
  const video = await page.video().path();
  await context.close(); await browser.close();
  if (report.passed) {
    const result = spawnSync('ffmpeg', ['-y', '-ss', String((demoStart - videoStart) / 1000), '-i', video, '-t', '12', '-an', '-c:v', 'libx264', '-threads', '2', '-preset', 'veryfast', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out + '/team-sidebar-collapse.mp4'], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error('MP4 encode failed');
  }
}
