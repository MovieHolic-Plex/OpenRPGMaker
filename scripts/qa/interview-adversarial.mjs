// Adversarial checks on the real dialog; synthetic drafts only. No live model requests here.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = process.env.INTERVIEW_CAPTURE_URL ?? 'http://127.0.0.1:9812';
const out = 'verify-shots/interview-adversarial';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const checks = [], errors = [];
let page;
const record = (name, pass, evidence) => { checks.push({ name, pass, evidence }); console.log(JSON.stringify({ name, pass })); };
try {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/__interview_adversarial', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><button id="opener">새 게임 만들기</button></body></html>' }));
  await page.goto(base + '/__interview_adversarial');
  await page.evaluate(async () => { await import('/src/styles/index.css'); window.dialog = (await import('/src/editor/ui/projectInterviewDialog.ts')).showProjectInterview; });
  const open = async () => page.evaluate(() => { document.getElementById('opener').focus(); window.confirmCount = 0; window.result = undefined; void window.dialog('story-cutscene').then(result => { window.result = result; window.confirmCount++; }); });
  const close = async () => { await page.keyboard.press('Escape'); };
  const choose = async (index = 0) => { await page.getByTestId(`project-interview-option-${index}`).click(); await page.getByTestId('project-interview-next').click(); };
  const genres = ['romance', 'monster', 'adventure', 'mystery'];
  for (const primary of genres) for (const secondary of [null, ...genres.filter(g => g !== primary)]) {
    await open(); await page.getByTestId('project-interview-genre-' + primary).click();
    if (secondary) await page.getByTestId('project-interview-secondary').selectOption(secondary);
    await page.getByTestId('project-interview-begin').click();
    for (let i = 0; i < (secondary ? 6 : 5); i++) await choose(i % 3);
    await page.getByTestId('project-interview-protagonist').fill('이름과 외형은 사용자만 결정');
    await page.getByTestId('project-interview-confirm').click();
    const data = await page.evaluate(() => ({ result: window.result, count: window.confirmCount }));
    record('complete:' + primary + '+' + (secondary ?? 'single'), data.result?.interview?.genre === primary && (data.result?.interview?.secondary ?? null) === secondary && data.count === 1, { preset: data.result?.presetId, count: data.count });
  }
  for (const width of [320, 360, 390, 768, 850, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 850 ? 600 : 700 }); await open();
    await page.getByTestId('project-interview-begin').click();
    const layout = await page.evaluate(() => {
      const panel = document.querySelector('.cinematic-interview'), body = document.querySelector('.ci-body');
      const r = panel.getBoundingClientRect();
      return { viewport: innerWidth, document: document.documentElement.scrollWidth, panel: panel.scrollWidth, rect: r.toJSON(), bodyOverflow: body.scrollWidth > body.clientWidth + 1,
        inputFont: parseFloat(getComputedStyle(document.querySelector('.ci-input')).fontSize), motionTarget: document.querySelector('.ci-motion').getBoundingClientRect().height };
    });
    record('layout:' + width, layout.document <= width && layout.panel <= layout.rect.width + 1 && !layout.bodyOverflow, layout);
    if (width <= 390) record('touch-readability:' + width, layout.inputFont >= 16 && layout.motionTarget >= 44, layout);
    if (width <= 390) {
      const heading = await page.locator('#project-interview-question').boundingBox();
      record('new-step-heading-visible:' + width, heading && heading.y >= 0 && heading.y + heading.height <= 600, heading);
    }
    if ([320, 850, 1440].includes(width)) {
      await page.waitForFunction(() => document.querySelector('.cinematic-interview')?.getAttribute('data-scene') === 'new:romance');
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${out}/layout-${width}.png` });
    }
    await close();
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await open();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(100);
  const motion = await page.evaluate(() => ({ paused: document.querySelector('.ci-backdrop video').paused, still: document.querySelector('.cinematic-interview').classList.contains('is-still') }));
  record('live-reduced-motion', motion.paused && motion.still, motion); await close();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // A late response for the previous click must not overwrite the most recent scene.
  await page.route('**/new-romance-campus.webp', async route => { await new Promise(r => setTimeout(r, 500)); await route.continue(); });
  await open(); await page.getByTestId('project-interview-begin').click();
  await page.getByTestId('project-interview-option-0').click(); await page.getByTestId('project-interview-option-2').click();
  await page.waitForTimeout(650);
  const latest = await page.locator('.cinematic-interview').getAttribute('data-scene');
  record('rapid-scene-clicks', latest === 'new:romance-town', { latest }); await close(); await page.unroute('**/new-romance-campus.webp');
  // Failed images must recover after the network returns and the same option is picked again.
  await page.route('**/new-romance-palace.webp', route => route.abort());
  await open(); await page.getByTestId('project-interview-begin').click(); await page.getByTestId('project-interview-option-1').click();
  await page.waitForTimeout(120);
  const failureMessage = await page.locator('.ci-status').innerText();
  await page.unroute('**/new-romance-palace.webp'); await page.getByTestId('project-interview-option-1').click(); await page.waitForTimeout(250);
  const recovered = await page.locator('.cinematic-interview').getAttribute('data-scene');
  record('image-failure-retry', recovered === 'new:romance-palace', { failureMessage, recovered }); await close();
  // Long unbroken input and a limit-length summary may not cover controls or spill horizontally.
  await page.setViewportSize({ width: 320, height: 568 }); await open(); await page.getByTestId('project-interview-begin').click();
  const long = '초장문입력'.repeat(200).slice(0, 1000);
  await page.getByTestId('project-interview-answer').fill(long); await page.getByTestId('project-interview-next').click();
  for (let i = 0; i < 4; i++) await choose(0);
  const geometry = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth, bodyOverflow: document.querySelector('.ci-body').scrollWidth > document.querySelector('.ci-body').clientWidth + 1 }));
  record('long-answer-no-overflow', geometry.document <= geometry.width && !geometry.bodyOverflow, geometry);
  await page.getByTestId('project-interview-summary').fill('요'.repeat(4000));
  await page.screenshot({ path: `${out}/long-summary-320.png` });
  await page.getByTestId('project-interview-confirm').evaluate(button => { button.click(); button.click(); });
  const once = await page.evaluate(() => ({ count: window.confirmCount, summaryLength: window.result?.summary.length }));
  record('confirm-once-at-limit', once.count === 1 && once.summaryLength === 4000, once);
  // Focus cannot escape this modal via forward or reverse keyboard navigation.
  await open(); await page.keyboard.press('Shift+Tab');
  const reverse = await page.evaluate(() => document.querySelector('.cinematic-interview').contains(document.activeElement));
  for (let i = 0; i < 20; i++) await page.keyboard.press('Tab');
  const forward = await page.evaluate(() => document.querySelector('.cinematic-interview').contains(document.activeElement));
  await close();
  record('keyboard-focus-and-cancel', reverse && forward && await page.locator('#opener').evaluate(n => n === document.activeElement), { reverse, forward });
  record('uncaught-errors', errors.length === 0, errors);
} finally {
  writeFileSync(`${out}/report.json`, JSON.stringify({ checks, errors, failures: checks.filter(c => !c.pass).map(c => c.name) }, null, 2));
  await browser.close();
}
process.exitCode = checks.some(c => !c.pass) ? 1 : 0;
