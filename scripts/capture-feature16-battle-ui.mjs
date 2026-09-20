// Real editor app only. Run against a parent-owned dev server; no remote project writes.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.AUDIT_BASE;
if (!base) throw new Error('Set AUDIT_BASE to the assigned worktree dev server URL');
const qaUrl = new URL('?freshProject=1', base);
assert.equal(qaUrl.searchParams.get('freshProject'), '1', 'Network isolation is only for freshProject QA');
const out = 'verify-shots/feature16-battle-ui-editor';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
const page = await context.newPage();
let blockedExternalPosts = 0;
// Install before navigation: this disposable freshProject capture must not POST remotely.
// Same-origin editor APIs and external GET assets remain available. Context routing also covers popups.
await context.route('**/*', async route => {
  const request = route.request();
  if (request.method() === 'POST' && new URL(request.url()).origin !== qaUrl.origin) {
    blockedExternalPosts++;
    await route.abort('blockedbyclient');
    return;
  }
  await route.continue();
});
page.setDefaultTimeout(60000);
await page.addInitScript(() => {
  localStorage.setItem('oprn:editor-ui-mode', 'expert');
  localStorage.setItem('oprn:ai-consent', 'accepted');
});
async function openDatabaseAfterBoot() {
  const dismissIds = ['login-guest', 'standard-welcome-start', 'coach-mark-skip'];
  const deadline = Date.now() + 90000;
  let readySince;
  while (Date.now() < deadline) {
    let overlayVisible = false;
    for (const id of dismissIds) {
      const button = page.getByTestId(id);
      if (!(await button.isVisible())) continue;
      overlayVisible = true;
      readySince = undefined;
      try {
        // Native clicks only; a later overlay may cover or replace this one mid-transition.
        await button.click({ timeout: 1000 });
      } catch (error) {
        if (error.name !== 'TimeoutError') throw error;
      }
    }
    if (!overlayVisible && await page.getByTestId('database-modal').isVisible()) {
      readySince ??= Date.now();
      // Recheck for welcome/coachmark layers that appear after canvas/database mounting.
      if (Date.now() - readySince >= 1000) return;
    } else {
      readySince = undefined;
      if (!overlayVisible && await page.getByTestId('edit-canvas').isVisible()) {
        try {
          await page.getByTestId('toolbar-database').click({ timeout: 1000 });
        } catch (error) {
          if (error.name !== 'TimeoutError') throw error;
        }
      }
    }
    await page.waitForTimeout(200);
  }
  const visible = [];
  for (const id of [...dismissIds, 'edit-canvas', 'database-modal']) {
    if (await page.getByTestId(id).isVisible()) visible.push(id);
  }
  throw new Error(`Editor boot/dismiss timed out after 90s; visible: ${visible.join(', ') || 'none'}`);
}
async function tab(slug) {
  const button = page.getByTestId(`db-tab-${slug}`);
  if (!(await button.isVisible())) {
    const groups = page.locator('[data-testid^="db-tab-group-"]');
    for (let i = 0; i < await groups.count(); i++) {
      await groups.nth(i).click();
      if (await button.isVisible()) break;
    }
  }
  await button.click();
}
try {
  await page.goto(qaUrl.href, { waitUntil: 'domcontentloaded' });
  await openDatabaseAfterBoot();
  await tab('troops');
  const troopId = await page.evaluate(() => window.__oprnEditorStore.getCurrent().database.troops.find(t => t.members?.length)?.id);
  assert.ok(troopId, 'default project must have a populated troop');
  await page.getByTestId(`db-record-row-${troopId}`).click();
  const panel = page.getByTestId('feature16-intent-panel');
  await panel.scrollIntoViewIfNeeded();
  await panel.waitFor({ state: 'visible' });
  await page.getByTestId('feature16-intent-add').click();
  const index = await page.locator('[data-testid^="feature16-intent-action-"]').count() - 1;
  await page.getByTestId(`feature16-intent-condition-${index}`).selectOption('turn');
  await page.getByTestId(`feature16-intent-start-${index}`).fill('2');
  await page.getByTestId('feature16-intent-turn').fill('1');
  assert.match(await page.getByTestId(`feature16-intent-prediction-${index}`).innerText(), /턴 조건 불일치/);
  await page.getByTestId('feature16-intent-turn').fill('2');
  assert.match(await page.getByTestId(`feature16-intent-prediction-${index}`).innerText(), /조건 통과/);
  await page.getByTestId('feature16-intent-row').selectOption('back');
  await page.getByTestId(`feature16-intent-prediction-${index}`).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/intent.png`, fullPage: true });
  const element = page.locator('[data-testid^="feature16-intent-element-"]').first();
  await element.selectOption('B');
  await element.scrollIntoViewIfNeeded();
  assert.equal(await element.inputValue(), 'B');
  await page.screenshot({ path: `${out}/weakness.png`, fullPage: true });
  // Return through real navigation, proving edits survive record panel teardown.
  await tab('enemies');
  await tab('troops');
  await page.getByTestId(`db-record-row-${troopId}`).click();
  assert.equal(await page.getByTestId(`feature16-intent-start-${index}`).inputValue(), '2');
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.getByTestId(`feature16-intent-start-${index}`).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/narrow.png`, fullPage: true });
  await writeFile(`${out}/SUMMARY.md`, `Blocked external POST requests: ${blockedExternalPosts}\n\n` + '# feature16 battle editor\n\nReal editor controls: action add, turn condition, row what-if, element edit, panel reopen.\n\nInspect intent.png, weakness.png, narrow.png for clipping and readability.\n');
} finally { await browser.close(); }
