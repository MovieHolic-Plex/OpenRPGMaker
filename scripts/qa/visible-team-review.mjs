// Real editor + deterministic team response replay; no live model or remote content writes.
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const base = process.env.BASE ?? 'http://127.0.0.1:9829';
const out = resolve(process.env.OUT ?? 'output/evidence/visible-team-review');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(30000);
const checks = [];
const errors = [];
const check = (label, ok, detail) => { checks.push({ label, ok, detail }); if (!ok) throw new Error(label + ': ' + JSON.stringify(detail)); };
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
page.on('pageerror', error => errors.push(error.message));
let mapId;
let sequence = 0;
try {
  await page.addInitScript(() => {
    localStorage.setItem('oprn:editor-ui-mode', 'standard');
    localStorage.setItem('oprn:standard-welcome-seen', '1');
    localStorage.setItem('oprn:coachmarks-basic-v1', '1');
    localStorage.setItem('oprn:editor-welcome-dismissed', '1');
    localStorage.setItem('oprn:ai-config', JSON.stringify({ piApply: 'review', piTeam: true }));
  });
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
  await page.route('**/__oprn/ai-activity', route => route.fulfill({ json: { ok: true } }));
  await page.route('**/v1/chat/completions', route => route.fulfill({ json: { choices: [{ message: { role: 'assistant', content: JSON.stringify({ harmonious: true, summary: '변경안을 확인했습니다.', findings: [] }) }, finish_reason: 'stop' }] } }));
  await page.route('**/v1/agent/run**', async route => {
    const req = route.request().postDataJSON();
    mapId = req.currentMapId ?? req.mapIds?.[0] ?? req.project.startMapId;
    const after = structuredClone(req.project);
    sequence++;
    after.maps[mapId].name = `검토 확인 ${sequence}`;
    const stats = { ms: 1200, turns: 2, toolCalls: 1, toolErrors: 0 };
    const events = [
      { type: 'team_start', task: req.task, roles: [] },
      { type: 'agent_spawn', agentId: 'builder-1', role: 'builder', mapId, mapName: '마을', task: '집 변경안 준비', memberId: 'builder', label: '시공' },
      { type: 'agent_done', agentId: 'builder-1', ok: true, summary: '변경안 준비 완료', stats, changedKeys: [`maps.${mapId}`], spills: [], conflicts: [] },
      { type: 'team_report', text: '변경안을 준비했습니다.' },
      { type: 'done', project: after, stats, changedKeys: [`maps.${mapId}`], spatialProof: req.project.spatialAuthoring ? { baseline: hash(req.project), spatial: hash(req.project.spatialAuthoring), proposed: hash(after) } : null },
    ];
    await route.fulfill({ contentType: 'application/x-ndjson', body: events.map(e => JSON.stringify(e)).join('\n') + '\n' });
  });
  await page.goto(`${base}/?devProject=1&marketTown=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const guest = page.getByTestId('login-guest');
  await page.getByTestId('ai-input').or(guest).first().waitFor({ timeout: 120000 });
  if (await guest.isVisible()) await guest.click();
  await page.locator('[data-testid="edit-canvas"] canvas').waitFor({ timeout: 120000 });
  const submit = async () => {
    await page.getByTestId('ai-input').fill('/pi team 집 만들어줘');
    await page.getByTestId('ai-send').click();
    await page.getByTestId('ai-pending-review-apply').waitFor({ state: 'visible', timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('[data-testid="ai-work-card"]')?.dataset.state === 'done');
  };
  const name = () => page.evaluate(async id => (await import('/src/project/store.ts')).store.getCurrent().maps[id].name, mapId);
  await submit();
  check('Details remain collapsed', !(await page.getByTestId('ai-work-process').first().evaluate(el => el.open)));
  check('Decision outside all collapsed details', await page.getByTestId('ai-pending-review').evaluate(el => !el.closest('details')));
  check('Apply and discard immediately visible', await page.getByTestId('ai-pending-review-apply').isVisible() && await page.getByTestId('ai-pending-review-discard').isVisible());
  check('Draft not applied before click', (await name()) !== '검토 확인 1');
  await page.screenshot({ path: resolve(out, '01-review-visible.png') });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.getByTestId('ai-pending-review').scrollIntoViewIfNeeded();
  check('Apply visible at 1024px', await page.getByTestId('ai-pending-review-apply').isVisible());
  await page.screenshot({ path: resolve(out, '02-review-1024.png') });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByTestId('ai-pending-review-apply').click();
  await page.getByTestId('ai-pending-review').waitFor({ state: 'detached', timeout: 20000 });
  check('No running or review-needed card after apply', await page.locator('[data-testid="ai-work-card"][data-state="running"]').count() === 0 && !(await page.locator('body').innerText()).includes('검토 필요'));
  check('Apply changes canonical project', (await name()) === '검토 확인 1');
  check('Applied outcome has no pending draft', !(await page.locator('body').innerText()).includes('미적용 초안'));
  await page.screenshot({ path: resolve(out, '03-applied.png') });
  await submit();
  await page.getByTestId('ai-pending-review-discard').click();
  check('Discard keeps previous canonical project', (await name()) === '검토 확인 1');
  check('Discard removes decision card', await page.getByTestId('ai-pending-review').count() === 0);
  await page.screenshot({ path: resolve(out, '04-discarded.png') });
  await submit();
  await page.evaluate(async id => {
    const { store } = await import('/src/project/store.ts');
    store.updateMap(id, map => { map.name = '사용자의 후속 수정'; });
  }, mapId);
  await page.getByTestId('ai-pending-review-apply').click();
  await page.getByText('아직 적용되지 않았어요. 다시 적용하거나 버릴 수 있어요.').waitFor();
  check('Failed apply preserves visible retry and discard', await page.getByTestId('ai-pending-review-apply').isEnabled() && await page.getByTestId('ai-pending-review-discard').isVisible());
  check('Failed apply does not create a running card', await page.locator('[data-testid="ai-work-card"][data-state="running"]').count() === 0);
  check('Stale apply preserves user changes', (await name()) === '사용자의 후속 수정');
  await page.screenshot({ path: resolve(out, '05-failed-apply.png') });
  await page.getByTestId('ai-pending-review-discard').click();
  check('No browser errors', errors.length === 0, errors);
} finally {
  writeFileSync(resolve(out, 'report.json'), JSON.stringify({ checks, errors, mode: 'deterministic team stream; real editor and apply/discard paths' }, null, 2));
  await browser.close();
}
console.log(JSON.stringify(checks));
