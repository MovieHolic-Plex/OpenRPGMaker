// Focused follow-up: actual composer-created enabled rewind, not a restored DOM fixture.
import { chromium, expect } from '@playwright/test';
import { Agent, get } from 'node:http';
import { writeFileSync } from 'node:fs';
import Jimp from 'jimp';

const phase = process.argv[2] ?? 'green';
const out = 'output/evidence/p2-contrast';
const base = 'http://127.0.0.1:9912';
const instruction = 'P2_REWIND_CONTRAST';
const report = { phase, transport: [], measurements: [], failures: [] };
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const agent = new Agent({ keepAlive: false, maxSockets: 8 });
try {
  await page.route(`${base}/**`, async route => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET' || !(url.pathname === '/' || /^\/(src|assets|@vite|@id|@fs|node_modules)\//.test(url.pathname))) return route.fallback();
    const response = await new Promise((resolve, reject) => {
      const request = get(url, { agent }, incoming => {
        const chunks = [];
        incoming.on('data', chunk => chunks.push(chunk));
        incoming.once('error', reject);
        incoming.once('end', () => resolve({ status: incoming.statusCode, headers: Object.fromEntries(Object.entries(incoming.headers).filter(([, v]) => typeof v === 'string')), body: Buffer.concat(chunks) }));
      });
      request.once('error', reject);
      request.setTimeout(60000, () => request.destroy(new Error('Local GET timeout')));
    });
    await route.fulfill(response);
  });
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }));
  await page.route('**/__oprn/ai-activity', route => route.fulfill({ json: { ok: true } }));
  await page.route('**/v1/chat/completions', async route => {
    const request = route.request().postDataJSON();
    const content = request.tools?.length ? 'P2_REWIND_RESPONSE' : JSON.stringify({ action: 'direct', reason: 'read-only conversation' });
    report.transport.push({ hasTools: Boolean(request.tools?.length), stream: request.stream });
    if (request.stream === true) {
      await route.fulfill({ contentType: 'text/event-stream', body: `data: ${JSON.stringify({ choices: [{ index: 0, delta: { role: 'assistant', content }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n` });
    } else await route.fulfill({ json: { choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }] } });
  });
  await page.addInitScript(() => {
    localStorage.setItem('rpg-zzu:editor-ui-mode', 'standard');
    localStorage.setItem('oprn:standard-welcome-seen', '1');
    localStorage.setItem('oprn:coachmarks-basic-v1', '1');
    localStorage.setItem('oprn:ai-config', JSON.stringify({ agentMode: 'chat' }));
  });
  const ready = page.getByTestId('login-guest').or(page.getByTestId('ai-input')).first().waitFor({ state: 'visible', timeout: 120000 });
  await page.goto(`${base}/?devProject=1&marketTown=1`, { waitUntil: 'commit' });
  await ready;
  if (await page.getByTestId('login-guest').isVisible()) await page.getByTestId('login-guest').click();
  const input = page.getByTestId('ai-input');
  await expect(input).toBeVisible({ timeout: 60000 });
  const done = page.waitForRequest(request => request.url().endsWith('/__oprn/ai-activity') && request.method() === 'POST' && request.postDataJSON().instruction === instruction && request.postDataJSON().result?.stoppedReason !== undefined, { timeout: 60000 });
  await input.fill(instruction);
  await page.getByTestId('ai-send').click();
  report.terminal = (await done).postDataJSON().result;
  expect(report.terminal.stoppedReason).toBe('final');
  expect(report.terminal.appliedCalls).toBe(0);
  const rewind = page.getByTestId('ai-turn-rewind');
  await expect(rewind).toBeVisible();
  await expect(rewind).toBeEnabled();

  const deck = page.locator('.ai-deck');
  const box = await deck.boundingBox();
  // Real map pixels, used as analytical backdrop samples; black/white bound every filtered RGB.
  const hide = await page.addStyleTag({ content: '.ai-deck { visibility: hidden !important; }' });
  const map = await Jimp.read(await page.screenshot({ path: `${out}/rewind-${phase}-map.png` }));
  await hide.evaluate(node => node.remove());
  const backgrounds = [{ name: 'black', rgb: [0, 0, 0] }, { name: 'white', rgb: [1, 1, 1] }];
  for (const fraction of [0.25, 0.5, 0.75]) {
    const point = [Math.floor(box.x + box.width * fraction), Math.floor(box.y + box.height / 2)];
    const { r, g, b } = Jimp.intToRGBA(map.getPixelColor(...point));
    backgrounds.push({ name: `map-${fraction}`, point, rgb: [r / 255, g / 255, b / 255] });
  }
  report.backgrounds = backgrounds;
  for (const alpha of [82, 78, 100]) {
    await page.getByTestId('topbar-ai-settings').click();
    const slider = page.getByRole('slider', { name: '배경 농도', exact: true });
    if (alpha === 82) {
      report.range = await slider.evaluate(node => ({ min: node.min, max: node.max, step: node.step, default: node.value }));
      expect(report.range).toEqual({ min: '78', max: '100', step: '1', default: '82' });
    } else await slider.press(alpha === 78 ? 'Home' : 'End');
    await expect(slider).toHaveValue(String(alpha));
    await page.getByTestId('ai-settings-close').click();
    for (const state of ['rest', 'hover', 'focus', 'active']) {
      await input.focus();
      await page.mouse.move(0, 0);
      if (state === 'hover' || state === 'active') await rewind.hover();
      if (state === 'active') await page.mouse.down();
      if (state === 'focus') {
        await rewind.focus();
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        await expect(rewind).toBeFocused();
      }
      await rewind.evaluate(async node => {
        getComputedStyle(node).opacity;
        let timer;
        try {
          await Promise.race([
            Promise.all(node.getAnimations().filter(a => a instanceof CSSTransition).map(a => a.finished)),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Rewind transition did not finish')), 5000); }),
          ]);
        } finally { clearTimeout(timer); }
      });
      const row = await rewind.evaluate((node, backgrounds) => {
        const rgba = value => {
          if (value.startsWith('color(srgb ')) {
            const [rgb, alpha] = value.slice(11, -1).split('/');
            return [...rgb.trim().split(/\s+/).map(Number), alpha ? Number(alpha) : 1];
          }
          const [r, g, b, a = 1] = value.match(/[\d.]+/g).map(Number);
          return [r / 255, g / 255, b / 255, a];
        };
        const over = (fg, bg) => fg.slice(0, 3).map((c, i) => c * fg[3] + bg[i] * (1 - fg[3]));
        const lum = rgb => rgb.map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
        const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
        const layers = [];
        for (let parent = node; parent; parent = parent.parentElement) {
          const style = getComputedStyle(parent);
          layers.unshift({ selector: parent.className, background: style.backgroundColor, opacity: Number(style.opacity) });
          if (parent.matches('.ai-deck')) break;
        }
        const style = getComputedStyle(node);
        const foreground = rgba(style.color);
        const contrasts = backgrounds.map(background => {
          // Element opacity composites the ENTIRE group (background plus descendants),
          // not just the foreground. This also proves the original .45 failure accurately.
          const paint = (index, backdrop, withText) => {
            if (index === layers.length) return withText ? over(foreground, backdrop) : backdrop;
            const layer = layers[index];
            const painted = paint(index + 1, over(rgba(layer.background), backdrop), withText);
            return over([...painted, layer.opacity], backdrop);
          };
          const bg = paint(0, background.rgb, false);
          const fg = paint(0, background.rgb, true);
          return { background: background.name, bg, fg, ratio: ratio(fg, bg) };
        });
        return { selector: '[data-testid="ai-turn-rewind"]', color: style.color, opacity: layers.reduce((v, layer) => v * layer.opacity, 1), enabled: !node.disabled, visible: node.checkVisibility(), layers, contrasts };
      }, backgrounds);
      row.alpha = alpha;
      row.state = state;
      row.pass = row.enabled && row.visible && row.opacity === 1 && row.contrasts.every(c => c.ratio >= 4.5);
      report.measurements.push(row);
      if (!row.pass) report.failures.push(row);
      if (state === 'active') {
        await page.mouse.move(0, 0);
        await page.mouse.up();
        await expect(rewind).toBeVisible();
      }
      if (state === 'rest') await page.screenshot({ path: `${out}/rewind-${phase}-${alpha}.png` });
      console.log(`${alpha}% ${state}: opacity=${row.opacity}, minimum=${Math.min(...row.contrasts.map(c => c.ratio))}, pass=${row.pass}`);
    }
  }
  // The correction must not hide or disable the action: actually rewind and recover the draft.
  await rewind.click();
  await expect(input).toHaveValue(instruction);
  await expect(page.getByTestId('ai-chat-log')).not.toContainText('P2_REWIND_RESPONSE');
  report.action = 'Enabled rewind restored the instruction and removed the subsequent response';
  writeFileSync(`${out}/rewind-${phase}.json`, JSON.stringify(report, null, 2) + '\n');
} finally {
  await browser.close();
  agent.destroy();
}
process.exitCode = report.failures.length ? 1 : 0;
