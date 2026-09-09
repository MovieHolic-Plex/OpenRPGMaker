// Supplemental real-control exercise: no product/layout or session injection.
// The unchanged required-skip scenario supplies the actual Ask -> Continue boundary.
import assert from 'node:assert/strict';
import { firefox } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const width = Number(process.env.CONTINUE_WIDTH);
const activation = process.env.CONTINUE_ACTIVATION;
assert.ok(width === 1024 || width === 1280);
assert.ok(activation === 'click' || activation === 'keyboard');
const out = resolve(process.env.EVIDENCE_DIR);
const instrumentPath = 'test/aiContinueReachability.mjs';
const instrumentHash = createHash('sha256').update(await readFile(instrumentPath)).digest('hex');
let exercise;
const launch = firefox.launch.bind(firefox);
firefox.launch = async options => {
  const browser = await launch(options);
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async options => {
    const context = await newContext(options);
    const newPage = context.newPage.bind(context);
    context.newPage = async () => {
      const page = await newPage();
      const screenshot = page.screenshot.bind(page);
      const getByTestId = page.getByTestId.bind(page);
      page.getByTestId = testid => {
        const locator = getByTestId(testid);
        if (testid !== 'ai-continue-run') return locator;
        const click = locator.click.bind(locator);
        locator.click = async options => {
          await page.setViewportSize({ width, height: width === 1024 ? 768 : 800 });
          const log = getByTestId('ai-chat-log');
          const beforeScroll = await log.evaluate(node => ({ scrollTop: node.scrollTop, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight }));
          await log.focus();
          await log.press('Control+End');
          await locator.focus();
          exercise = await locator.evaluate(async node => {
            await new Promise((resolve, reject) => {
              const timer = setTimeout(() => reject(new Error('Reachability frame deadline')), 10000);
              requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(timer); resolve(); }));
            });
            const r = node.getBoundingClientRect();
            const log = node.closest('[data-testid="ai-chat-log"]');
            const l = log.getBoundingClientRect();
            const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return { viewport: { width: innerWidth, height: innerHeight }, focused: document.activeElement === node,
              unique: document.querySelectorAll('[data-testid="ai-continue-run"]').length,
              hit: hit === node || node.contains(hit), levelBefore: document.querySelector('[data-testid="ai-composer-autonomy"]').value,
              rect: { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom },
              scrollOwner: { testid: log.dataset.testid, scrollTop: log.scrollTop, clientHeight: log.clientHeight, scrollHeight: log.scrollHeight,
                rect: { x: l.x, y: l.y, right: l.right, bottom: l.bottom } },
              inViewport: r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
              fullyExposed: r.x >= l.x && r.y >= l.y && r.right <= l.right && r.bottom <= l.bottom,
              focusOutline: getComputedStyle(node).outline };
          });
          exercise = { ...exercise, beforeScroll, activation, instrumentPath, instrumentHash };
          await writeFile(`${out}/continue-reachability.json`, JSON.stringify(exercise, null, 2));
          assert.equal(exercise.unique, 1); assert.equal(exercise.levelBefore, 'readonly');
          assert.equal(exercise.focused, true); assert.equal(exercise.hit, true);
          assert.equal(exercise.inViewport, true); assert.equal(exercise.fullyExposed, true);
          await screenshot({ path: `${out}/continue-reachable-${width}-${activation}.png` });
          // Both are native activation of the same existing control and production handler.
          if (activation === 'keyboard') await locator.press('Enter');
          else await click(options);
        };
        return locator;
      };
      return page;
    };
    return context;
  };
  return browser;
};
await import('./aiOutcomeBrowserEvidence.mjs');
const report = JSON.parse(await readFile(`${out}/actions.json`, 'utf8'));
assert.ok(exercise, 'Actual Continue activation was not reached');
assert.equal(report.pass, true);
// 계약 변경: 「계속」은 읽기 전용을 해제하지 않는다 — 다이얼만 승격시킬 수 있다.
assert.equal(report.states['blocked-user-resume-in-flight'].turnOptions.composerMode, 'ask');
assert.deepEqual(report.states['blocked-user-resume-settled'].getter, { execution: 'blocked', goal: 'incomplete', delivery: 'no-change' });
assert.equal(createHash('sha256').update(await readFile(instrumentPath)).digest('hex'), instrumentHash);
await writeFile(`${out}/continue-action-result.json`, JSON.stringify({ pass: true, activation, width,
  source: report.sourceSha, actualOptions: report.states['blocked-user-resume-in-flight'].turnOptions,
  outcome: report.states['blocked-user-resume-settled'].getter, cleanup: report.cleanup }, null, 2));
