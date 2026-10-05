// 조수 패널 「턴 사이 기록」 표면 QA — 실제 편집기 DOM 에서 시드 기록 + 실제 클릭으로 확인한다.
// 이 표면은 이 브라우저의 프론트 액션 링만 읽는다: 라이브 모델 호출도 원격 쓰기도 없다.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const base = process.env.BASE ?? 'http://127.0.0.1:9902';
const out = resolve('verify-shots/ai-between-turn-log');
mkdirSync(out, { recursive: true });

const SEED = [
  { at: '2026-10-05T04:50:00.000Z', seq: 1, surface: 'panel', action: 'click:ai-collapse', testid: 'ai-collapse', label: '조수 접기' },
  { at: '2026-10-05T04:52:30.000Z', seq: 2, surface: 'context-panel', action: 'context-compact', testid: 'ai-context-compact', detail: { before: 18400, after: 5200, kind: 'manual' } },
  { at: '2026-10-05T04:55:10.000Z', seq: 3, surface: 'history-modal', action: 'conversation-delete', testid: 'ai-history-delete', disabled: true, detail: { id: 'c-1' } },
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
const page = await context.newPage();
page.setDefaultTimeout(20000);
page.setDefaultNavigationTimeout(90000);
page.on('dialog', (dialog) => dialog.accept());
const errors = [];
const checks = [];
page.on('pageerror', (error) => errors.push(error.message));
const check = (label, ok) => {
  checks.push({ label, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) throw new Error(label);
};

try {
  await page.addInitScript((seed) => {
    localStorage.setItem('oprn:editor-ui-mode', 'standard');
    localStorage.setItem('oprn:standard-welcome-seen', '1');
    localStorage.setItem('oprn:coachmarks-basic-v1', '1');
    localStorage.setItem('oprn:editor-welcome-dismissed', '1');
    localStorage.setItem('oprn:ai-ui-events', JSON.stringify(seed));
    localStorage.removeItem('oprn:ai-panel-collapsed');
    localStorage.removeItem('oprn:ai-sidebar-collapsed');
  }, SEED);
  await page.route('**/rest/v1/**', (route) => route.fulfill({ json: [] }));
  await page.route('**/__oprn/ai-activity', (route) => route.fulfill({ json: { ok: true } }));
  await page.goto(`${base}/?devProject=1&marketTown=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.locator('[data-testid="edit-canvas"] canvas').waitFor({ timeout: 120000 });
  const guest = page.getByTestId('login-guest');
  if (await guest.isVisible().catch(() => false)) await guest.click();
  await page.waitForTimeout(1500);
  // 조수 창은 저장된 접힘 선택이 없으면 접힌 채로 선다 — 복귀 알약을 눌러 펼친다.
  const restore = page.getByTestId('ai-collapsed-restore');
  if (await restore.isVisible().catch(() => false)) await restore.click();
  await page.getByTestId('ai-panel').waitFor({ state: 'visible', timeout: 60000 });
  // 「표시·실행 기록」 행은 빈/유휴 패널에서 기존 설계로 숨는다(형제 「실행 기록」과 같다).
  // QA 는 턴 하나가 돈 뒤의 상태를 흉내내려고 그 클래스만 걷어낸다 — 제품 변경이 아니다.
  await page.evaluate(() => document.querySelector('[data-testid="ai-panel"]')?.classList.remove('is-assistant-idle'));
  await page.evaluate(() => {
    const view = document.querySelector('[data-testid="ai-workspace-view-options"]');
    if (view instanceof HTMLDetailsElement) view.open = true;
  });
  const section = page.getByTestId('ai-between-turns');
  await section.waitFor({ state: 'attached', timeout: 60000 });
  check('패널이 열려 있다', await page.getByTestId('ai-panel').isVisible());
  check('표면은 접힌 채로 시작한다', (await section.evaluate((node) => node.open)) === false);
  await page.evaluate(() => document.querySelector('[data-testid="ai-between-turns"]')?.querySelector('summary')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.waitForFunction(() => document.querySelector('[data-testid="ai-between-turns"]')?.hasAttribute('open') === true, null, { timeout: 20000 });
  await page.getByTestId('ai-between-turns-list').waitFor();

  const rows = page.getByTestId('ai-between-turns-row');
  check('시드 기록과 이 클릭이 함께 보인다', (await rows.count()) >= 4);
  const text = await page.getByTestId('ai-between-turns-list').innerText();
  check('프론트 액션이 사람이 읽는 이름으로 보인다', text.includes('조수 접기') && text.includes('맥락 압축') && text.includes('대화 삭제'));
  check('의미 이벤트의 결과 수치가 함께 보인다', text.includes('18400') && text.includes('5200'));
  check('비활성 클릭은 그 사실을 밝힌다', text.includes('비활성 상태'));
  check('머리말이 남은 기록 수를 말한다', (await page.getByTestId('ai-between-turns-meta').innerText()).includes('이 브라우저에 남은 기록'));
  await page.screenshot({ path: resolve(out, '01-open-1440.png') });
  await section.screenshot({ path: resolve(out, '02-section-1440.png') });

  const search = page.getByTestId('ai-between-turns-search');
  await search.fill('삭제');
  check('검색은 이름과 testid 를 모두 본다', (await rows.count()) === 1);
  await search.fill('context-compact');
  check('검색은 원문 testid 로도 찾는다', (await rows.count()) === 1);
  await search.fill('없는말');
  check('결과 없음을 말한다', (await page.getByTestId('ai-between-turns-list').innerText()).includes('검색 결과가 없어요.'));
  await search.fill('');

  await page.getByTestId('ai-between-turns-copy').click();
  const status = page.getByTestId('ai-between-turns-status');
  await status.filter({ hasText: '복사했어요' }).waitFor({ timeout: 10000 });
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  check('복사한 글이 기록 문장을 담는다', clipboard.includes('조수 턴 사이 기록 ·') && clipboard.includes('맥락 압축') && clipboard.includes('이유:'));

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-testid="edit-canvas"] canvas').waitFor({ timeout: 120000 });
  await page.waitForTimeout(1500);
  const restore2 = page.getByTestId('ai-collapsed-restore');
  if (await restore2.isVisible().catch(() => false)) await restore2.click();
  await page.evaluate(() => document.querySelector('[data-testid="ai-panel"]')?.classList.remove('is-assistant-idle'));
  await page.evaluate(() => {
    const view = document.querySelector('[data-testid="ai-workspace-view-options"]');
    if (view instanceof HTMLDetailsElement) view.open = true;
  });
  await page.evaluate(() => document.querySelector('[data-testid="ai-between-turns"]')?.querySelector('summary')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.waitForTimeout(500);
  check('새로고침 뒤에도 남아 있다', (await rows.count()) >= 3);
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.screenshot({ path: resolve(out, '03-open-1024.png') });
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.getByTestId('ai-between-turns-clear').click();
  await status.filter({ hasText: '지웠어요' }).waitFor({ timeout: 10000 });
  check('지우면 목록이 비고 그 사실을 말한다', (await rows.count()) === 0 && (await page.getByTestId('ai-between-turns-list').innerText()).includes('아직 턴 사이 기록이 없어요.'));
  const stored = await page.evaluate(() => localStorage.getItem('oprn:ai-ui-events'));
  check('지우기는 이 브라우저 저장까지 함께 비운다', stored === null);
  check('화면 예외가 없다', errors.length === 0);
} finally {
  if (errors.length) console.log('PAGE ERRORS', errors);
  await browser.close();
  console.log(JSON.stringify({ passed: checks.filter((c) => c.ok).length, total: checks.length }));
}
