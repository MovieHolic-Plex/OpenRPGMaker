// Focused real-editor contrast proof. Run from the worktree root with its server on 9912.
// No token substitutions, alpha overrides, sleeps, or rounded pass decisions.
import { chromium, expect } from '@playwright/test';
import { Agent, get } from 'node:http';
import { writeFileSync } from 'node:fs';
import Jimp from 'jimp';

const phase = process.argv[2] ?? 'green';
const base = 'http://127.0.0.1:9912';
const out = 'output/evidence/p2-contrast';
const linear = c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const lum = rgb => rgb.slice(0, 3).reduce((sum, c, i) => sum + linear(c) * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const over = (fg, bg) => fg.slice(0, 3).map((c, i) => c * fg[3] + bg[i] * (1 - fg[3]));
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader'] });
const report = { phase, base, threshold: 4.5, measurements: [], failures: [] };
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const agent = new Agent({ keepAlive: false, maxSockets: 8 });
try {
  // Relay unchanged local GETs to avoid unrelated host netlink changes in Chromium.
  await page.route(`${base}/**`, async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'GET' || !(pathname === '/' || /^\/(src|assets|@vite|@id|@fs|node_modules)\//.test(pathname))) return route.fallback();
    const response = await new Promise((resolve, reject) => {
      const request = get(route.request().url(), { agent }, incoming => {
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
  await expect(page.getByTestId('ai-input')).toBeVisible({ timeout: 60000 });
  await expect(page.locator('[data-testid="edit-canvas"] canvas').first()).toBeVisible();
  await page.getByTestId('topbar-ai-settings').click();
  const slider = page.getByRole('slider', { name: '배경 농도', exact: true });
  await expect(slider).toHaveValue('82');
  report.slider = await slider.evaluate(node => ({ min: node.min, max: node.max, step: node.step, default: node.value }));
  expect(report.slider).toEqual({ min: '78', max: '100', step: '1', default: '82' });
  await slider.press('End');
  await expect(slider).toHaveValue('100');
  await slider.press('Home');
  await expect(slider).toHaveValue('78');
  await page.getByTestId('ai-settings-close').click();

  async function measure(state) {
    // Flush style changes, then await the exact finite CSS transitions, not a guessed delay.
    await page.evaluate(async () => {
      document.querySelectorAll('.ai-chat-panel *').forEach(n => getComputedStyle(n).color);
      let timer;
      try {
        await Promise.race([
          Promise.all(document.getAnimations().filter(a => a instanceof CSSTransition).map(a => a.finished)),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('CSS transition did not finish')), 5000); }),
        ]);
      } finally { clearTimeout(timer); }
    });
    const data = await page.evaluate(() => {
      const parse = value => {
        if (value.startsWith('color(srgb ')) {
          const parts = value.slice(11, -1).split('/');
          return [...parts[0].trim().split(/\s+/).map(Number), parts[1] ? Number(parts[1]) : 1];
        }
        const nums = value.match(/[\d.]+/g).map(Number);
        return [nums[0] / 255, nums[1] / 255, nums[2] / 255, nums[3] ?? 1];
      };
      const rows = [];
      const surfaces = [...document.querySelectorAll('.ai-deck, .ai-collapsed-restore')].filter(n => n.checkVisibility());
      for (const surface of surfaces) {
        for (const node of [surface, ...surface.querySelectorAll('*')]) {
          if (!(node instanceof HTMLElement) || !node.checkVisibility() || node.closest('option, svg')) continue;
          const cs = getComputedStyle(node);
          const directText = [...node.childNodes].filter(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
          let pseudo;
          if (node.matches('textarea') && !node.value) pseudo = '::placeholder';
          if (!directText.length && !pseudo && !node.matches('select')) continue;
          const fgStyle = pseudo ? getComputedStyle(node, pseudo) : cs;
          const rects = directText.flatMap(text => { const range = document.createRange(); range.selectNodeContents(text); return [...range.getClientRects()]; });
          if (!rects.length) rects.push(node.getBoundingClientRect());
          let opacity = Number(fgStyle.opacity);
          const backgrounds = [];
          for (let ancestor = node; ancestor; ancestor = ancestor.parentElement) {
            const style = getComputedStyle(ancestor);
            backgrounds.unshift(parse(style.backgroundColor));
            if (ancestor !== node) opacity *= Number(style.opacity);
            if (ancestor === surface) break;
          }
          // Native controls have no exposed text Range. Use the straight inner strip of
          // their computed rounded border, not the bounding-box corners (which paint border).
          const control = node.matches('select, textarea');
          const border = Math.max(...['Top', 'Right', 'Bottom', 'Left'].map(side => parseFloat(cs[`border${side}Width`])));
          const sampleRects = rects.map(r => {
            const radius = Math.min(r.width / 2, r.height / 2, Math.max(...['TopLeft', 'TopRight', 'BottomLeft', 'BottomRight'].map(corner => parseFloat(cs[`border${corner}Radius`]))));
            const insetX = control ? Math.max(border, radius) + 1 : 0.5;
            const insetY = control ? border + 1 : 0.5;
            return [r.x + insetX, r.y + insetY, r.width - 2 * insetX, r.height - 2 * insetY];
          });
          rows.push({ selector: node.className || node.tagName, testid: node.dataset.testid, pseudo, text: (node.value || directText.map(n => n.textContent).join('') || node.placeholder || node.textContent).slice(0, 100), color: fgStyle.color, fg: parse(fgStyle.color), opacity, fontSize: fgStyle.fontSize, backgrounds, rects: rects.map(r => [r.x, r.y, r.width, r.height]), sampleRects, sampleMethod: control ? 'computed rounded-border inner strip' : 'text Range interior' });
        }
      }
      return { globalText2: getComputedStyle(document.documentElement).getPropertyValue('--text-2').trim(), alpha: document.querySelector('.ai-chat-panel').style.getPropertyValue('--ai-background-opacity'), surfaces: surfaces.map(n => ({ class: n.className, background: getComputedStyle(n).backgroundColor, opacity: getComputedStyle(n).opacity, backdrop: getComputedStyle(n).backdropFilter })), rows };
    });
    expect(data.alpha).toBe('78%');
    expect(data.globalText2.toLowerCase()).toBe('#475569');
    for (const surface of data.surfaces) {
      expect(surface.opacity).toBe('1');
      expect(surface.background).toBe('color(srgb 1 1 1 / 0.78)');
      expect(surface.backdrop).toBe('blur(20px) saturate(1.08)');
    }
    const saveShot = ['market-idle', 'market-error', 'market-metadata', 'black-metadata', 'white-metadata', 'market-pill-error', 'black-pill-error'].includes(state);
    if (saveShot) await page.screenshot({ path: `${out}/${phase}-${state}.png`, animations: 'disabled' });
    // Remove only glyph paint, preserving computed color, geometry, backgrounds and filters.
    const hide = await page.addStyleTag({ content: '.ai-deck, .ai-deck *, .ai-deck ::placeholder, .ai-collapsed-restore, .ai-collapsed-restore * { -webkit-text-fill-color: transparent !important; text-shadow: none !important; } .ai-deck select { color: transparent !important; } .ai-deck svg, .ai-collapsed-restore svg { visibility: hidden !important; }' });
    const image = await Jimp.read(await page.screenshot({ ...(saveShot ? { path: `${out}/${phase}-${state}-background.png` } : {}), animations: 'disabled' }));
    await hide.evaluate(node => node.remove());
    for (const row of data.rows) {
      row.bounds = ['black', 'white'].map((name, i) => {
        const bg = row.backgrounds.reduce((bg, fg) => over(fg, bg), [i, i, i]);
        const fg = over([...row.fg.slice(0, 3), row.fg[3] * row.opacity], bg);
        return { name, bg, ratio: contrast(fg, bg) };
      });
      let sampleMin = Infinity, sampleBg, samplePoint, sampleCount = 0;
      for (const [x, y, w, h] of row.sampleRects) {
        for (let iy = Math.max(0, Math.ceil(y)); iy < Math.min(image.bitmap.height, Math.floor(y + h)); iy++) {
          for (let ix = Math.max(0, Math.ceil(x)); ix < Math.min(image.bitmap.width, Math.floor(x + w)); ix++) {
            const { r, g, b } = Jimp.intToRGBA(image.getPixelColor(ix, iy));
            const bg = [r / 255, g / 255, b / 255];
            const ratio = contrast(over([...row.fg.slice(0, 3), row.fg[3] * row.opacity], bg), bg);
            sampleCount++;
            if (ratio < sampleMin) { sampleMin = ratio; sampleBg = bg; samplePoint = [ix, iy]; }
          }
        }
      }
      row.sample = { bg: sampleBg, point: samplePoint, count: sampleCount, ratio: sampleMin };
      row.pass = row.bounds.every(b => b.ratio >= 4.5) && sampleCount > 0 && sampleMin >= 4.5 && row.opacity === 1;
      if (!row.pass) report.failures.push({ state, selector: row.selector, color: row.color, bounds: row.bounds, sample: row.sample, opacity: row.opacity });
    }
    report.measurements.push({ state, ...data });
    writeFileSync(`${out}/${phase}.json`, JSON.stringify(report, null, 2) + '\n');
    console.log(state, data.rows.length, 'labels;', report.failures.filter(f => f.state === state).length, 'failures');
  }

  await measure('market-idle');
  // Restore through the shipped conversation picker; no model calls or project writes.
  await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const { conversationScopeKey, saveConversation } = await import('/src/ai/conversationStore.ts');
    const saved = await saveConversation({
      id: 'p2-contrast', title: 'P2 CONTRAST', model: 'fixture', savedAt: 1788692400000,
      projectContextKey: conversationScopeKey(store.getProjectIdentity(), store.getCurrent()),
      entries: [
        { kind: 'user', text: 'P2 CONTRAST request' },
        { kind: 'tool', name: 'fill_region', args: { x: 0, y: 0, w: 10, h: 10 }, ok: true, summary: 'P2 CONTRAST saved operation summary' },
        { kind: 'tool', name: 'get_map_region', args: { x: 1, y: 1, w: 3, h: 3 }, ok: false, summary: 'P2 CONTRAST failure' },
        { kind: 'assistant', text: 'P2 CONTRAST response with `code`.' },
      ],
    });
    if (!saved.ok || !saved.durable) throw new Error('Conversation fixture was not saved');
  });
  await page.getByTestId('ai-open-conversations').click();
  await page.getByTestId('ai-history-open').first().click();
  await expect(page.locator('.ai-command-row[data-role="assistant"]')).toBeVisible();
  const tools = page.locator('.ai-tool-activity-toggle').first();
  if (await tools.getAttribute('aria-expanded') === 'false') await tools.click();
  await page.locator('.ai-tool-failure > summary').click();
  await measure('market-conversation');
  // The real elements use these owner-published states; exercise every semantic foreground.
  for (const state of ['run', 'attention', 'done', 'error']) {
    await page.evaluate(state => {
      document.querySelector('.ai-deck-rail').dataset.aiState = state;
      const status = document.querySelector('.ai-deck-rail-state .ai-assistant-status');
      status.dataset.statusTone = state === 'run' ? 'running' : state === 'done' ? 'ok' : 'error';
      status.textContent = `P2 CONTRAST ${state}`;
    }, state);
    await measure(`market-${state}`);
  }
  // Additional shipped renderer metadata, without a fake CSS/DOM reimplementation.
  await page.evaluate(async () => {
    const { createConversationLogHost } = await import('/src/editor/panels/aiConversationLog.ts');
    const { store } = await import('/src/project/store.ts');
    const log = document.querySelector('.ai-chat-log');
    log.replaceChildren();
    const host = createConversationLogHost({ log, removeStartScreen() {} });
    host.appendBubble('assistant', 'P2 CONTRAST metadata');
    const reasoning = host.appendReasoning();
    reasoning.body.textContent = 'P2 CONTRAST reasoning';
    reasoning.box.querySelector('button').click();
    const tilesetId = store.getCurrent().maps[store.getCurrent().startMapId].tilesetId;
    host.appendTileThumbs(tilesetId, [1]);
    host.appendTileGrid({ tilesetId, x: 0, y: 0, w: 1, h: 1, lower: [[1]], upper: [[-1]] });
    host.appendBubble('system', 'P2 CONTRAST recap').classList.add('ai-run-recap');
  });
  await measure('market-metadata');
  for (const color of ['black', 'white']) {
    // Only the map-side backdrop is replaced; the shipped deck/range/foreground are untouched.
    await page.locator('.ai-chat-float-host').evaluate((node, color) => node.style.background = color, color);
    await measure(`${color}-metadata`);
  }
  await page.locator('.ai-chat-float-host').evaluate(node => node.style.removeProperty('background'));
  await page.getByTestId('ai-collapse').click();
  await expect(page.getByTestId('ai-collapsed-restore')).toBeVisible();
  for (const state of ['idle', 'run', 'done', 'attention', 'error']) {
    await page.evaluate(async state => {
      const { setRestoreButtonState } = await import('/src/editor/panels/aiDirectorChrome.ts');
      setRestoreButtonState(document.querySelector('.ai-collapsed-restore'), state, `P2 CONTRAST ${state}`, state === 'attention' ? 1 : 0);
    }, state);
    await measure(`market-pill-${state}`);
  }
  for (const color of ['black', 'white']) {
    await page.locator('.ai-chat-float-host').evaluate((node, color) => node.style.background = color, color);
    await measure(`${color}-pill-error`);
  }
  writeFileSync(`${out}/${phase}.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ failures: report.failures, min: Math.min(...report.measurements.flatMap(m => m.rows.flatMap(r => r.bounds.map(b => b.ratio)))) }, null, 2));
} finally {
  await browser.close();
  agent.destroy();
}
process.exitCode = report.failures.length ? 1 : 0;
