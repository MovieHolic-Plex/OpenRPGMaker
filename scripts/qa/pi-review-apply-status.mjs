// 실브라우저 검증: 조화 검수가 실패한 런에서 사용자가 검토 카드로 적용한 뒤,
// 「아직 적용하지 않았으니 …」 안내가 「적용됨」 과 동시에 남지 않는지 본다.
// (2026-09-25 회귀. 스크립트 모델만 쓰고 원격 쓰기는 없다 — rest/v1·ai-activity 를 가로챈다.)
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

/** Pi 요청 본문은 gzip 이다(src/ai/piAgent/requestBody.ts) — 평문 JSON 이면 그대로 읽는다. */
const readRequestBody = request => {
  const buffer = request.postDataBuffer();
  if (!buffer) return {};
  try { return JSON.parse(buffer.toString('utf8')); } catch { /* gzip 본문 */ }
  try { return JSON.parse(gunzipSync(buffer).toString('utf8')); } catch { return {}; }
};

const base = process.env.BASE ?? 'http://127.0.0.1:19871';
const out = resolve(process.env.OUT ?? '.omo/evidence/bug-hunt-20260925/browser');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(30000);
const checks = [];
const errors = [];
const check = (label, ok, detail) => {
  checks.push({ label, ok, detail: detail ?? null });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ' :: ' + JSON.stringify(detail) : ''}`);
};
page.on('pageerror', e => errors.push(e.message));
page.on('request', request => { const url = request.url(); if (url.includes('/v1/')) console.log('REQ ' + url); });
let sequence = 0;
try {
  await page.addInitScript(() => {
    localStorage.setItem('oprn:editor-ui-mode', 'standard');
    localStorage.setItem('oprn:standard-welcome-seen', '1');
    localStorage.setItem('oprn:coachmarks-basic-v1', '1');
    localStorage.setItem('oprn:editor-welcome-dismissed', '1');
    localStorage.setItem('oprn:ai-config', JSON.stringify({ piApply: 'review', piTeam: false }));
  });
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
  await page.route('**/__oprn/ai-activity', route => route.fulfill({ json: { ok: true } }));
  // 검수 프로바이더가 죽은 상황 — 조화 검수 호출이 500 으로 실패한다.
  await page.route('**/v1/chat/completions', route => route.fulfill({ status: 500, json: { error: { message: 'review provider down' } } }));
  await page.route('**/v1/agent/run**', async route => {
    const req = readRequestBody(route.request());
    const mapId = req.currentMapId ?? req.mapIds?.[0] ?? req.project.startMapId;
    const after = structuredClone(req.project);
    sequence++;
    after.maps[mapId].name = `검수실패 적용 ${sequence}`;
    const stats = { ms: 900, turns: 2, toolCalls: 1, toolErrors: 0 };
    const events = [
      { type: 'team_start', task: req.task, roles: [] },
      { type: 'agent_spawn', agentId: 'builder-1', role: 'builder', mapId, mapName: '마을', task: '변경안 준비', memberId: 'builder', label: '시공' },
      { type: 'agent_done', agentId: 'builder-1', ok: true, summary: '변경안 준비 완료', stats, changedKeys: [`maps.${mapId}`], spills: [], conflicts: [] },
      { type: 'team_report', text: '변경안을 준비했습니다.' },
      { type: 'done', project: after, stats, changedKeys: [`maps.${mapId}`] },
    ];
    await route.fulfill({ contentType: 'application/x-ndjson', body: events.map(e => JSON.stringify(e)).join('\n') + '\n' });
  });
  await page.goto(`${base}/?devProject=1&marketTown=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const guest = page.getByTestId('login-guest');
  await page.getByTestId('ai-input').or(guest).first().waitFor({ timeout: 120000 });
  if (await guest.isVisible()) await guest.click();
  await page.locator('[data-testid="edit-canvas"] canvas').waitFor({ timeout: 120000 });

  await page.getByTestId('ai-input').fill('/pi team 집 만들어줘');
  await page.getByTestId('ai-send').click();
  // 제작 전 그래픽 선택 카드가 먼저 뜨면 추천 조합으로 진행한다(에디터가 요구하는 사람 결정).
  const choice = page.getByTestId('ai-creation-choice');
  const reviewApply = page.getByTestId('ai-pending-review-apply');
  await choice.or(reviewApply).first().waitFor({ state: 'visible', timeout: 90000 });
  if (await choice.isVisible()) {
    await page.getByTestId('ai-creation-recommend').click();
    await page.getByTestId('ai-creation-start').click();
  }
  await reviewApply.waitFor({ state: 'visible', timeout: 90000 });
  await page.waitForFunction(() => document.querySelector('[data-testid="ai-work-card"]')?.dataset.state === 'done', null, { timeout: 60000 });

  const before = await page.evaluate(() => document.body.innerText);
  check('검수를 못 한 원인이 채팅에 남는다', before.includes('끝까지 확인하지 못했어요'));
  check('적용 전에는 「아직 적용하지 않았으니」 안내가 있다', before.includes('아직 적용하지 않았으니'));
  await page.screenshot({ path: resolve(out, '01-before-apply.png') });

  await page.getByTestId('ai-pending-review-apply').click();
  await page.waitForFunction(() => /적용 완료|적용됨|반영/.test(document.body.innerText), null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => document.body.innerText);
  check('적용 표시가 화면에 있다', /적용 완료|적용됨|반영/.test(after));
  check('적용 뒤에도 「아직 적용하지 않았으니」 가 남지 않는다', !after.includes('아직 적용하지 않았으니'));
  check('페이지 오류 0', errors.length === 0, errors);
  await page.screenshot({ path: resolve(out, '02-after-apply.png') });
} catch (error) {
  checks.push({ label: 'script', ok: false, detail: String(error) });
  console.log('FAIL script :: ' + String(error));
  try { await page.screenshot({ path: resolve(out, '99-failure.png') }); } catch {}
} finally {
  await browser.close();
}
writeFileSync(resolve(out, 'result.json'), JSON.stringify({ checks, errors, sequence }, null, 2));
console.log('SUMMARY ' + checks.filter(c => c.ok).length + '/' + checks.length + ' checks passed');
process.exit(checks.every(c => c.ok) ? 0 : 1);
