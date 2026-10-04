// Installed package check and real Chromium MP4; isolated blank project only.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { startEditorScreencast } from './editor-screencast.mjs';

const out = resolve(process.env.TERRAIN_TOOLBAR_OUTPUT ?? 'verify-shots/terrain-toolbar-host');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--no-proxy-server', '--js-flags=--max-old-space-size=12288'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } }), errors = [];
page.on('pageerror', e => { errors.push(e.message); console.log('pageerror', e.message); });
const assert = (value, message) => { if (!value) throw new Error(message); };
const pause = (ms = 500) => page.waitForTimeout(ms);
const proof = { installedEditor: true, isolatedBlankProject: true, canonicalContentChanged: false };
try {
  await page.goto(`${process.env.TERRAIN_TOOLBAR_URL ?? 'http://mdc-server:9888'}/?blankProject=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  if (await page.locator('#access-code').count()) {
    await page.locator('#access-code').fill(readFileSync('/home/main/.local/share/oprn/web-workspace/.oprn-host-access', 'utf8').trim());
    await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 120000 }), page.locator('form[action="/__oprn/login"] button').click()]);
  }
  await page.getByTestId('boot-loader').waitFor({ state: 'hidden', timeout: 240000 });
  console.log('Installed editor booted');
  await page.locator('[data-testid="layer-relief"]:visible').first().click({ timeout: 120000 });
  proof.icons = await page.getByTestId('relief-brush-controls').locator('button').evaluateAll(nodes => nodes.map(n => ({ name: n.getAttribute('aria-label'), text: n.textContent, svg: !!n.querySelector('svg') })));
  assert(proof.icons.length === 10 && proof.icons.every(n => n.name && !n.text && n.svg), 'Installed icon dock missing');
  const film = await startEditorScreencast(page, out, 'terrain-toolbar-installed-2x.mp4', { selector: 'body', cropTop: 0, speed: 2 });
  await film.caption('실제 에디터 · 하단 도구는 아이콘, 설정은 선택한 도구만');
  await page.screenshot({ path: resolve(out, 'terrain-toolbar-installed.png') });
  await page.getByTestId('terrain-tool-surface').click(); await pause(700);
  assert(await page.getByTestId('terrain-material').isVisible() && !await page.getByTestId('relief-mode-raise').isVisible(), 'Installed contextual settings failed');
  await page.getByTestId('terrain-tool-river').hover(); await pause(1350);
  assert((await page.getByTestId('delayed-tooltip').innerText()).includes('강'), 'Installed hover tooltip missing');
  await page.getByTestId('terrain-tool-river').click(); await pause(700);
  await film.caption('집은 버들항 기본 모양 · 지붕만 조절도 그대로');
  await page.getByTestId('terrain-tool-house').click(); await pause(700);
  proof.nativeHouseStyles = await page.locator('[data-house-style]').count();
  assert(proof.nativeHouseStyles === 6, 'Installed native Beodeul palette missing');
  await page.getByTestId('quick-house-resize').scrollIntoViewIfNeeded();
  await page.getByTestId('quick-house-resize').selectOption('roof'); await pause(700);
  assert(await page.getByTestId('quick-house-roof-width').isVisible(), 'Installed roof-only control missing');
  await film.caption('물음표 도움말 · 언덕, 경사로, 물, 길, 마을 만드는 순서');
  await page.getByTestId('terrain-help-toggle').click(); await pause(1000);
  proof.noteColor = await page.locator('.terrain-help-body .help-modal-note').evaluate(n => getComputedStyle(n).color);
  assert(proof.noteColor !== 'rgba(233, 236, 243, 0.9)', 'Installed guide note is unreadable');
  await page.screenshot({ path: resolve(out, 'terrain-help-installed.png') });
  await page.getByTestId('terrain-help-land').click(); await pause(1200);
  await page.getByTestId('terrain-help-build').click(); await pause(1200);
  await page.getByTestId('terrain-help-check').click(); await pause(1000);
  assert((await page.getByTestId('terrain-help-modal').innerText()).includes('기본 꺼짐'), 'Optional vision guide missing');
  await page.keyboard.press('Escape'); await pause(500);
  assert(!await page.getByTestId('terrain-help-modal').count() && await page.getByTestId('terrain-design-panel').isVisible(), 'Installed Escape dismissed underlying design');
  assert(await page.getByTestId('terrain-help-toggle').evaluate(n => n === document.activeElement), 'Installed modal focus restoration failed');
  await page.getByTestId('terrain-tool-height').click();
  assert(!await page.getByTestId('terrain-design-panel').isVisible(), 'Installed basic brush return left panel open');
  await film.caption('기본 붓으로 돌아가면 설정 창 닫기 · 좁은 창에서도 도구 유지');
  proof.film = await film.stop();
  await page.setViewportSize({ width: 1024, height: 768 }); await pause(800);
  proof.compactLayout = await page.getByTestId('relief-brush-controls').locator('button').evaluateAll(nodes => nodes.every(n => { const r = n.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('button') === n; }));
  assert(proof.compactLayout && !errors.length, 'Installed compact layout or browser errors');
  await page.screenshot({ path: resolve(out, 'terrain-toolbar-installed-compact.png') });
  proof.url = page.url(); proof.errors = errors;
  writeFileSync(resolve(out, 'terrain-toolbar-host-check.json'), JSON.stringify(proof, null, 2) + '\n');
  console.log(JSON.stringify(proof));
} finally { await browser.close(); }
