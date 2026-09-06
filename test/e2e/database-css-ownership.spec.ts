import { expect, test as base, type Page, type Locator } from '@playwright/test';
import { mkdir, writeFile, readlink, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { DATABASE_PRIMARY_SENTINELS } from '../databasePrimarySentinels';

declare global {
  interface Window { __dbDestinationReady?: Promise<void>; __dbTabReached?: Promise<void>; __dbScroll?: Promise<void>; __dbWheelEnd?: Promise<void>; __dbSearchReady?: Promise<void>; __dbNumeric?: { calls: number[]; events: string[]; text: string[] }; }
}

// Boot has its own bounded fixture lifetime; authoring assertions do not race the
// second topbar render in enterMode or spend their budget downloading the editor.
const test = base.extend({
  page: [async ({ page }, use) => {
    await bootEditor(page);
    await use(page);
  }, { timeout: 60_000 }],
});

let evidenceDirectory: string;

test.beforeEach(async ({}, info) => {
  evidenceDirectory = resolve(process.env.DB_CSS_EVIDENCE ?? 'output/evidence/db-css-ownership', info.project.name);
  await mkdir(evidenceDirectory, { recursive: true });
  const port = process.env.DEV_SERVER_PORT;
  if (!port) throw new Error('Explicit owned DEV_SERVER_PORT required');
  const pid = execFileSync('ss', ['-ltnp', `sport = :${port}`], { encoding: 'utf8' }).match(/pid=(\d+)/)?.[1];
  if (!pid) throw new Error('No owned server listener');
  const cwd = await readlink(`/proc/${pid}/cwd`);
  expect(cwd).toBe(process.cwd());
  const harness = await Promise.all(['test/e2e/database-css-ownership.spec.ts', 'test/databasePrimarySentinels.ts', 'playwright.db-css.config.ts'].map(async path => ({ path, sha256: createHash('sha256').update(await readFile(path)).digest('hex') })));
  await writeFile(resolve(evidenceDirectory, `fingerprint-${info.title.replace(/[^a-z0-9]+/gi, '-')}.json`), JSON.stringify({
    title: info.title, project: info.project.name, server: { port, pid, cwd },
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sourceDiffSha256: createHash('sha256').update(execFileSync('git', ['diff', 'HEAD', '--', 'src'])).digest('hex'), harness,
  }, null, 2));
});

async function bootEditor(page: Page) {
  page.setDefaultTimeout(15_000);
  // Intercept project persistence, not thousands of immutable Vite modules/images.
  // Both remote Supabase and the local /supabase proxy use /rest/v1/.
  await page.route('**/rest/v1/**', async route => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) await route.abort();
    else await route.continue();
  });
  await page.addInitScript(() => {
    localStorage.setItem('oprn:editor-ui-mode', 'expert');
    localStorage.setItem('oprn:standard-welcome-seen', '1');
    localStorage.setItem('oprn:editor-welcome-dismissed', '1');
  });
  await page.goto('/?freshProject=1', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const metrics = page.getByTestId('perf-metrics-json');
  await metrics.waitFor({ state: 'attached', timeout: 60_000 });
  await metrics.evaluate(node => new Promise<void>((resolve, reject) => {
    const finish = () => {
      const metrics: { initialEditRenderMs?: number } = JSON.parse(node.textContent ?? '{}');
      if (typeof metrics.initialEditRenderMs === 'number') { clearTimeout(timer); observer.disconnect(); resolve(); }
    };
    const observer = new MutationObserver(finish);
    const timer = setTimeout(() => { observer.disconnect(); reject(new Error('Editor boot-completion metric deadline')); }, 60_000);
    observer.observe(node, { childList: true, characterData: true, subtree: true });
    finish();
  }));
  await expect(page.locator('body')).toHaveClass(/editor-ui-expert/);
}

async function openDatabase(page: Page) {
  await page.getByTestId('toolbar-database').focus();
  await page.getByTestId('toolbar-database').press('Enter');
  await page.getByTestId('db-tab-search').waitFor();
  await page.evaluate(() => document.fonts.ready);
}

async function navigate(page: Page, tab: string) {
  const group = await page.evaluate(async tab => {
    const { TAB_GROUPS } = await import('/src/editor/panels/database.ts');
    return TAB_GROUPS.find(group => group.tabs.includes(tab))?.slug;
  }, tab);
  if (group) {
    const heading = page.getByTestId(`db-tab-group-${group}`);
    if (await heading.getAttribute('aria-expanded') === 'false') {
      // Existing group disclosures are click-driven divs, not native buttons.
      await heading.click();
    }
  }
  const button = page.locator(`.db-tab[data-tab="${tab}"]`);
  await button.scrollIntoViewIfNeeded();
  await expect(button).toBeVisible();
  const sentinel = tab === 'items' ? '[data-testid="db-field-price"]'
    : tab === 'animations' ? '[data-testid="db-field-animation-frame-width"]'
    : tab === 'scratchConcepts' ? '[data-testid="scratch-concept-tileset-select"]'
    : DATABASE_PRIMARY_SENTINELS[tab];
  await page.evaluate(({ tab, sentinel }) => {
    const root = document.querySelector('.database-modal-body');
    if (!root || !sentinel) throw new Error('Missing destination readiness contract');
    window.__dbDestinationReady = new Promise<void>((resolve, reject) => {
      const finish = () => {
        if (root.querySelector(`.db-tab[data-tab="${tab}"].active`) && root.querySelector(`.db-body ${sentinel}`)) {
          clearTimeout(timer); observer.disconnect(); resolve();
        }
      };
      const observer = new MutationObserver(finish);
      const timer = setTimeout(() => { observer.disconnect(); reject(new Error(`Destination render deadline: ${tab}, ${sentinel}`)); }, 15_000);
      observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      finish();
    });
  }, { tab, sentinel });
  await button.press('Enter');
  await page.evaluate(() => { if (!window.__dbDestinationReady) throw new Error('Missing destination subscription'); return window.__dbDestinationReady; });
  await expect(button).toHaveClass(/active/);
  await renderedReady(page);
}

async function assertAuthoringScroll(form: Locator) {
  const metrics = await form.evaluate(node => ({ overflow: getComputedStyle(node).overflowY, height: node.clientHeight, content: node.scrollHeight }));
  expect(metrics.overflow).toMatch(/^(auto|scroll)$/);
  expect(metrics.content).toBeGreaterThan(metrics.height);
}

async function assertStepper(input: Locator, state = '') {
  const measured = await input.evaluate(node => {
    const style = getComputedStyle(node), outer = node.closest('.db-number-stepper');
    if (!outer) throw new Error('Missing shared stepper');
    return { height: outer.getBoundingClientRect().height, border: style.borderTopWidth, radius: style.borderTopLeftRadius, shadow: style.boxShadow };
  });
  expect(measured, state).toEqual({ height: 32, border: '0px', radius: '0px', shadow: 'none' });
}

for (const width of [1440, 1024]) {
  test(`animation ordinary scroll owns lower authoring at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openDatabase(page);
    await navigate(page, 'animations');
    const form = page.locator('.animation-detail-form');
    await expect(page.getByTestId('db-animation-preview-status')).toHaveAttribute('data-state', 'ready');
    await assertAuthoringScroll(form);
    expect(await page.getByTestId('db-animation-sheet-preview-surface').evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(280);
    const headerBefore = await page.locator('.database-modal-header').boundingBox();
    expect(headerBefore).not.toBeNull();
    await form.hover({ position: { x: 2, y: 100 } });
    await form.evaluate(node => {
      window.__dbScroll = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('animation wheel produced no scroll')), 5000);
        node.addEventListener('scroll', () => { clearTimeout(timer); resolve(); }, { once: true });
      });
    });
    await page.mouse.wheel(0, 2000);
    await page.evaluate(() => {
      if (!window.__dbScroll) throw new Error('Missing scroll subscription');
      return window.__dbScroll;
    });
    expect(await form.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
    const lowerControl = page.getByTestId('db-animation-cell-x-0');
    await expect(lowerControl).toBeInViewport();
    expect(await lowerControl.evaluate(node => {
      const rect = node.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return hit === node || (hit !== null && node.contains(hit));
    })).toBe(true);
    expect(await page.locator('.database-modal-header').boundingBox()).toEqual(headerBefore);
    await lowerControl.focus();
    await expect(lowerControl).toBeFocused();
  });

  test(`shared stepper is one 32px control at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openDatabase(page);
    await navigate(page, 'items');
    const input = page.getByRole('spinbutton', { name: '가격', exact: true });
    await expect(input).toHaveAttribute('data-testid', 'db-field-price');
    for (const state of ['default', 'hover', 'focus']) {
      if (state === 'hover') await input.hover();
      if (state === 'focus') await input.focus();
      await assertStepper(input, state);
    }
  });
}


for (const [tab, section, field] of [
  ['actors', 'db-actor-tab-identity', ''],
  ['enemies', 'db-enemy-section-basic-tab', 'db-field-enemy-level'],
  ['lifeCrafting', 'db-life-section-skills', 'db-life-skill-max-level'],
]) {
  test(`equivalent shared roles and ordinary captions in ${tab}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDatabase(page);
    if (tab === 'lifeCrafting') await page.evaluate(async () => {
      const { store } = await import('/src/project/store.ts');
      store.update(project => { project.database.lifeSkills = [{ id: 'css-life-fixture', name: 'CSS test', skillType: 'farming', maxLevel: 10, levelUpRewards: [] }]; }, { scope: 'database', label: 'Test-only CSS fixture' });
    });
    await navigate(page, tab);
    expect(await page.getByTestId(section).evaluate(node => ({ height: node.getBoundingClientRect().height, size: getComputedStyle(node).fontSize, weight: getComputedStyle(node).fontWeight }))).toEqual({ height: 34, size: '13px', weight: '600' });
    const add = page.getByTestId(tab === 'lifeCrafting' ? 'db-life-add' : 'db-add-record');
    expect(await add.evaluate(node => ({ height: node.getBoundingClientRect().height, size: getComputedStyle(node).fontSize, background: getComputedStyle(node).backgroundColor }))).toEqual({ height: 32, size: '12.5px', background: 'rgb(255, 255, 255)' });
    if (field) expect(await page.getByTestId(field).evaluate(node => {
      if (!(node instanceof HTMLInputElement) || !node.labels?.length) throw new Error('Missing native caption');
      const label = node.labels[0];
      const caption = label.classList.contains('db-field') ? label.firstElementChild : label;
      if (!caption) throw new Error('Missing visible caption');
      return getComputedStyle(caption).fontSize;
    })).toBe('12.5px');
  });
}


async function renderedReady(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Font readiness deadline')), 15_000);
      document.fonts.ready.then(() => { clearTimeout(timeout); resolve(); }, reject);
    });
    const images = Array.from(document.querySelectorAll<HTMLImageElement>('.database-modal-window img'))
      .filter(image => image.getBoundingClientRect().width > 0);
    await Promise.all(images.map(image => new Promise<void>((resolve, reject) => {
      const finish = () => { clearTimeout(timeout); image.removeEventListener('load', finish); image.removeEventListener('error', finish); resolve(); };
      const timeout = setTimeout(() => { image.removeEventListener('load', finish); image.removeEventListener('error', finish); reject(new Error(`Image readiness deadline: ${image.currentSrc}`)); }, 15_000);
      image.addEventListener('load', finish, { once: true });
      image.addEventListener('error', finish, { once: true });
      if (image.complete) finish();
    })));
  });
}

for (const viewportWidth of [1440, 1024]) {
 test(`required registered-primary destination matrix at ${viewportWidth}`, async ({ page }) => {
  test.setTimeout(600_000);
  const directory = evidenceDirectory;
  await mkdir(directory, { recursive: true });
  const port = process.env.DEV_SERVER_PORT ?? '9173';
  const listeners = execFileSync('ss', ['-ltnp', `sport = :${port}`], { encoding: 'utf8' });
  const pid = listeners.match(/pid=(\d+)/)?.[1];
  if (!pid) throw new Error(`No owned server on ${port}`);
  const cwd = await readlink(`/proc/${pid}/cwd`);
  expect(cwd).toBe(process.cwd());
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const harnessSha256 = createHash('sha256').update(execFileSync('git', ['diff', 'HEAD', '--', 'test', 'playwright.db-css.config.ts'])).digest('hex');
  const sourceDiffSha256 = createHash('sha256').update(execFileSync('git', ['diff', 'HEAD', '--', 'src'])).digest('hex');
  await openDatabase(page);
  const destinations = await page.evaluate(async () => {
    const { TAB_GROUPS } = await import('/src/editor/panels/database.ts');
    return ['overview', ...TAB_GROUPS.flatMap(group => group.tabs)];
  });
  expect(destinations.length).toBeGreaterThanOrEqual(34);
  expect(new Set(destinations)).toEqual(new Set(Object.keys(DATABASE_PRIMARY_SENTINELS)));
  expect(new Set(destinations).size).toBe(destinations.length);
  const rail = await page.locator('.db-tab[data-tab]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-tab')));
  expect(new Set(rail)).toEqual(new Set(destinations));
  const cases = [];
    const width = viewportWidth;
    await page.setViewportSize({ width, height: 900 });
    for (const destination of destinations) {
      await navigate(page, destination);
      await renderedReady(page);
      // In the valid empty Concepts branch the selector is in the header,
      // outside the absent populated workspace. Keep a real native sentinel.
      const sentinelSelector = destination === 'scratchConcepts' ? '[data-testid="scratch-concept-tileset-select"]' : DATABASE_PRIMARY_SENTINELS[destination];
      const sentinel = page.locator(sentinelSelector).first();
      await expect(sentinel, destination).toBeVisible();
      const measured = await page.locator('.database-modal-window').evaluate(modal => {
        const geometry = (node: Element) => {
          const box = node.getBoundingClientRect(), style = getComputedStyle(node);
          return { class: node.className, testid: node.getAttribute('data-testid'), x: box.x, y: box.y,
            width: box.width, height: box.height, clientWidth: node.clientWidth, clientHeight: node.clientHeight,
            scrollWidth: node.scrollWidth, scrollHeight: node.scrollHeight, overflowX: style.overflowX, overflowY: style.overflowY,
            fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight,
            background: style.backgroundColor, color: style.color, border: style.borderTopWidth, radius: style.borderTopLeftRadius };
        };
        const body = modal.querySelector('.db-body');
        if (!body || body.childElementCount === 0) throw new Error('Missing rendered primary DB surface');
        return { modal: geometry(modal), body: geometry(body),
          scrollers: Array.from(body.querySelectorAll('*')).filter(node => node.clientHeight > 0 && (node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1)).map(geometry),
          controls: Array.from(body.querySelectorAll('input, select, textarea, button, .db-number-stepper, .db-field > span, .db-list-row .db-list-thumb, .db-list-row .db-list-number')).filter(node => node.getBoundingClientRect().width > 0).map(geometry),
          images: Array.from(body.querySelectorAll('img')).filter(node => node.getBoundingClientRect().width > 0).map(node => ({ ...geometry(node), complete: node.complete, naturalWidth: node.naturalWidth, pixelated: getComputedStyle(node).imageRendering, alt: node.alt })),
        };
      });
      const screenshot = `${destination}-${width}.png`;
      await page.screenshot({ path: resolve(directory, screenshot) });
      cases.push({ destination, sentinel: sentinelSelector, viewport: { width, height: 900 }, screenshot, ...measured });
      await writeFile(resolve(directory, `primary-matrix-${viewportWidth}.json`), JSON.stringify({ revision, sourceDiffSha256, harnessSha256, project: test.info().project.name, server: { port, pid, cwd }, destinations, cases }, null, 2));
      expect(measured.modal.x, destination).toBe(12);
      expect(measured.modal.y, destination).toBe(12);
      expect(measured.modal.width, destination).toBe(width - 24);
      expect(measured.modal.height, destination).toBe(876);
      expect(measured.body.width, destination).toBeGreaterThan(0);
      expect(measured.body.height, destination).toBeGreaterThan(0);
    }
  expect(cases).toHaveLength(destinations.length);
  expect(new Set(cases.map(entry => `${entry.destination}:${entry.viewport.width}`)).size).toBe(destinations.length);
 });
}


for (const width of [1440, 1024]) {
  for (const tab of ['opening', 'gameOver']) {
    test(`cinematic ${tab} pane geometry and native focus at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openDatabase(page);
      const before = await page.evaluate(async () => {
        const { store } = await import('/src/project/store.ts');
        return JSON.stringify(store.getCurrent().system);
      });
      await navigate(page, tab);
      const pane = page.getByTestId(`db-cinematic-${tab === 'opening' ? 'opening' : 'game-over'}`);
      const geometry = await pane.evaluate(root => {
        const measure = (node: Element) => {
          const rect = node.getBoundingClientRect();
          return { x: rect.x, right: rect.right, y: rect.y, bottom: rect.bottom,
            width: rect.width, height: rect.height, clientWidth: node.clientWidth, scrollWidth: node.scrollWidth };
        };
        const list = root.querySelector('.db-ws-list-pane');
        const detail = root.querySelector('.db-ws-detail');
        const body = root.querySelector('.db-ws-detail-body');
        if (!list || !detail || !body) throw new Error('Missing cinematic list/detail scroll surfaces');
        return { root: measure(root), list: measure(list), detail: measure(detail), body: measure(body), overflowY: getComputedStyle(body).overflowY };
      });
      expect(geometry.overflowY).toMatch(/^(auto|scroll)$/);
      expect(geometry.list.right).toBeLessThanOrEqual(geometry.detail.x);
      for (const region of [geometry.root, geometry.list, geometry.detail, geometry.body]) {
        expect(region.width).toBeGreaterThan(0);
        expect(region.height).toBeGreaterThan(0);
        expect(region.x).toBeGreaterThanOrEqual(geometry.root.x);
        expect(region.right).toBeLessThanOrEqual(geometry.root.right + 1);
        expect(region.y).toBeGreaterThanOrEqual(geometry.root.y);
        expect(region.bottom).toBeLessThanOrEqual(geometry.root.bottom + 1);
        expect(region.scrollWidth).toBeLessThanOrEqual(region.clientWidth + 1);
      }
      const first = page.locator(DATABASE_PRIMARY_SENTINELS[tab]);
      const next = pane.getByTestId(tab === 'opening' ? 'db-cinematic-skippable' : 'db-cinematic-game-over-message');
      expect(await first.evaluate(node => node.tagName)).toBe('INPUT');
      await expect(first).toHaveAttribute('type', tab === 'opening' ? 'checkbox' : 'text');
      await expect(first).toBeVisible();
      await expect(first).toBeEnabled();
      await first.focus();
      await expect(first).toBeFocused();
      await first.press('Tab');
      await expect(next).toBeFocused();
      await expect(next).toBeInViewport();
      expect(await next.evaluate(node => {
        const rect = node.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return hit === node || (hit !== null && node.contains(hit));
      })).toBe(true);
      expect(await page.evaluate(async () => {
        const { store } = await import('/src/project/store.ts');
        return JSON.stringify(store.getCurrent().system);
      })).toBe(before);
    });
  }
}


test('numeric and native control states preserve input and change semantics', async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDatabase(page);
  await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    store.update(project => { project.database.lifeSkills = [{ id: 'css-numeric-life', name: 'CSS fixture', skillType: 'farming', maxLevel: 10, levelUpRewards: [] }]; }, { scope: 'database', label: 'Test-only populated Life fixture' });
  });
  await navigate(page, 'lifeCrafting');
  const life = page.getByTestId('db-life-skill-max-level');
  expect.soft(await life.evaluate(node => getComputedStyle(node).appearance)).toBe('auto');
  await life.fill('11');
  const storedLevel = () => page.evaluate(async () => (await import('/src/project/store.ts')).store.getCurrent().database.lifeSkills[0].maxLevel);
  expect(await storedLevel()).toBe(10);
  await life.press('Tab');
  expect(await storedLevel()).toBe(11);
  // Separate the native primitive state fixture from the live record's deferred
  // refresh. The real Life change path above remains exercised, not mocked.
  await page.evaluate(async () => (await import('/src/editor/panels/databaseModal.ts')).requestDatabaseModalClose('battleTest'));
  await page.getByTestId('database-modal').waitFor({ state: 'hidden' });

  await page.evaluate(async () => {
    const { numberField, textField, selectField, segmentedControl, field } = await import('/src/editor/panels/databaseControls.ts');
    const shell = document.createElement('div');
    shell.className = 'database-modal-backdrop';
    shell.innerHTML = '<div class="database-modal-window"><div class="database-modal-body"><div class="db-body db-shared-workspace"><div class="db-ws-detail-body"></div></div></div></div>';
    document.body.append(shell);
    const host = shell.querySelector('.db-ws-detail-body');
    if (!host) throw new Error('Missing shared primitive CSS host');
    const fixture = document.createElement('section');
    fixture.className = 'db-ws-card'; fixture.dataset.testid = 'css-controls'; fixture.style.width = '420px';
    const state = { calls: [] as number[], events: [] as string[], text: [] as string[] };
    window.__dbNumeric = state;
    const numeric = numberField('긴 한국어 Caption 최대 수치', 'css-number', 0.2, value => state.calls.push(value), { min: 0.1, max: 0.3, step: 0.1 });
    const input = numeric.querySelector('input');
    if (!input) throw new Error('Missing fixture number');
    for (const event of ['input', 'change']) input.addEventListener(event, () => state.events.push(event));
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.dataset.testid = 'css-checkbox';
    fixture.append(numeric,
      numberField('Disabled numeric', 'css-disabled', 7, value => state.calls.push(value), undefined, { disabled: true, disabledReason: 'Test inherited value' }),
      textField('긴 한국어와 English 혼합 이름을 그대로 보존하는 레이블', 'css-text', 'abcd', value => state.text.push(value)),
      selectField('Native selection', 'css-select', 'a', [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], value => state.text.push(value)),
      segmentedControl('Native radio', 'css-radio', 'a', [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], value => state.text.push(value)),
      field('Native check', checkbox));
    host.append(fixture);
  });
  const input = page.getByTestId('css-number');
  await input.scrollIntoViewIfNeeded();
  const measure = () => input.evaluate(node => {
    const wrapper = node.closest('.db-number-stepper');
    if (!wrapper) throw new Error('Missing composite');
    const inner = getComputedStyle(node), outer = getComputedStyle(wrapper);
    return { height: wrapper.getBoundingClientRect().height, border: inner.borderTopWidth, radius: inner.borderTopLeftRadius, shadow: inner.boxShadow, focusShadow: outer.boxShadow };
  });
  for (const state of ['default', 'hover', 'focus']) {
    if (state === 'hover') await input.hover();
    if (state === 'focus') await input.focus();
    const metrics = await measure();
    expect({ height: metrics.height, border: metrics.border, radius: metrics.radius, shadow: metrics.shadow }, state).toEqual({ height: 32, border: '0px', radius: '0px', shadow: 'none' });
    if (state === 'focus') expect(metrics.focusShadow).not.toBe('none');
  }
  await page.getByTestId('css-text').focus();
  await expect(input).not.toBeFocused();
  await page.getByTestId('css-controls').locator('label').filter({ hasText: '긴 한국어 Caption 최대 수치' }).click();
  await expect(input).toBeFocused();
  expect(await page.evaluate(() => window.__dbNumeric?.calls)).toEqual([]);
  await input.press('Tab');
  await page.getByTestId('css-number-inc').click();
  expect(await page.evaluate(() => window.__dbNumeric)).toEqual({ calls: [0.3], events: ['input'], text: [] });
  await expect(page.getByTestId('css-number-inc')).toBeDisabled();
  await page.getByTestId('css-number-inc').evaluate(node => { if (!(node instanceof HTMLButtonElement)) throw new Error('Not button'); node.click(); });
  expect(await page.evaluate(() => window.__dbNumeric?.calls)).toEqual([0.3]);
  await page.getByTestId('css-number-dec').click();
  await expect(input).toHaveValue('0.2');
  await input.fill('');
  await expect(input).toHaveValue('');
  await input.press('Tab');
  await expect(input).toHaveValue('0.1');
  expect(await page.evaluate(() => window.__dbNumeric?.events)).toEqual(['input', 'input', 'input', 'change']);
  await input.fill('0.9');
  await expect(input).toHaveValue('0.3');
  await input.press('Tab');
  for (const [outerWidth, display] of [[122, 'none'], [123, 'flex']] as const) {
    await input.evaluate((node, width) => {
      const wrapper = node.closest<HTMLElement>('.db-number-stepper');
      if (!wrapper) throw new Error('Missing composite');
      wrapper.style.width = `${width}px`;
    }, outerWidth);
    expect(await page.getByTestId('css-number-dec').evaluate(node => getComputedStyle(node).display)).toBe(display);
    expect(await input.evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThan(0);
  }
  const disabled = page.getByTestId('css-disabled');
  await disabled.scrollIntoViewIfNeeded();
  await expect(disabled).toBeDisabled();
  expect(await disabled.evaluate(node => ({ border: getComputedStyle(node).borderTopWidth, radius: getComputedStyle(node).borderTopLeftRadius, shadow: getComputedStyle(node).boxShadow }))).toEqual({ border: '0px', radius: '0px', shadow: 'none' });
  const callsBefore = await page.evaluate(() => window.__dbNumeric?.calls);
  await page.getByTestId('css-disabled-inc').evaluate(node => { if (!(node instanceof HTMLButtonElement)) throw new Error('Not button'); node.click(); });
  expect(await page.evaluate(() => window.__dbNumeric?.calls)).toEqual(callsBefore);
  const text = page.getByTestId('css-text');
  await text.focus();
  await text.evaluate(node => { if (!(node instanceof HTMLInputElement)) throw new Error('Not input'); node.setSelectionRange(2, 2); });
  await page.keyboard.type('X');
  await expect(text).toHaveValue('abXcd');
  expect(await text.evaluate(node => node instanceof HTMLInputElement && document.activeElement === node && node.selectionStart === 3)).toBe(true);
  await page.getByTestId('css-select').selectOption('b');
  await page.getByTestId('css-checkbox').check();
  await expect(page.getByTestId('css-checkbox')).toBeChecked();
  await page.locator('[data-testid="css-radio"] input[value="b"]').check();
  await expect(page.locator('[data-testid="css-radio"] input[value="b"]')).toBeChecked();
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    const caption = page.getByTestId('css-controls').locator('.db-field').filter({ has: text }).locator('span').first();
    expect(await caption.evaluate(node => ({ size: getComputedStyle(node).fontSize, wraps: getComputedStyle(node).whiteSpace, unclipped: node.scrollHeight <= node.clientHeight + 1 }))).toEqual({ size: '12.5px', wraps: 'normal', unclipped: true });
  }
});


async function wheelTo(page: Page, testid: string, selector = '.animation-detail-form') {
  const form = page.locator(selector);
  const target = page.getByTestId(testid);
  await form.hover({ position: { x: 2, y: 100 } });
  const maxWheels = await form.evaluate(node => Math.ceil(node.scrollHeight / 200) + 2);
  // Firefox caps large wheel deltas. Use bounded ordinary wheel increments
  // and await the exact requested scroll position before issuing the next one.
  for (let index = 0; index < maxWheels; index += 1) {
    const position = await target.evaluate((node, selector) => {
      const form = node.closest(selector);
      if (!form) throw new Error('Missing authoring scroller');
      const a = node.getBoundingClientRect(), b = form.getBoundingClientRect();
      return { delta: a.top + a.height / 2 - (b.top + b.height / 2), visible: a.top >= b.top && a.bottom <= b.bottom };
    }, selector);
    if (position.visible) break;
    const delta = Math.max(-200, Math.min(200, position.delta));
    await form.evaluate((node, delta) => {
      const before = node.scrollTop;
      const expected = Math.max(0, Math.min(node.scrollHeight - node.clientHeight, before + delta));
      if (Math.abs(expected - before) < 1) throw new Error('Lower control is not reachable within its designated scroller');
      window.__dbWheelEnd = new Promise<void>((resolve, reject) => {
        const finish = () => {
          if (Math.abs(node.scrollTop - expected) <= 1) { clearTimeout(timeout); node.removeEventListener('scroll', finish); resolve(); }
        };
        const timeout = setTimeout(() => { node.removeEventListener('scroll', finish); reject(new Error(`Wheel position deadline: ${node.scrollTop}, expected ${expected}`)); }, 5000);
        node.addEventListener('scroll', finish);
      });
    }, delta);
    await page.mouse.wheel(0, delta);
    await page.evaluate(() => {
      if (!window.__dbWheelEnd) throw new Error('Missing wheel-position subscription');
      return window.__dbWheelEnd;
    });
  }
  await expect(target).toBeInViewport();
  expect(await target.evaluate(node => {
    const r = node.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return hit === node || (hit !== null && node.contains(hit));
  })).toBe(true);
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 900 }, { width: 1024, height: 768 }]) {
  for (const entry of ['first', 'after-battle', 'return', 'reopen']) {
    test(`animation ${entry} lower panels and playback at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await openDatabase(page);
      if (entry === 'return' || entry === 'reopen') {
        await navigate(page, 'animations');
        await renderedReady(page);
      }
      if (entry === 'after-battle') await navigate(page, 'states');
      if (entry === 'return') await navigate(page, 'skills');
      if (entry === 'reopen') {
        await page.keyboard.press('Escape');
        await page.getByTestId('database-modal').waitFor({ state: 'hidden' });
        await expect(page.getByTestId('toolbar-database')).toBeFocused();
        await page.getByTestId('toolbar-database').press('Enter');
      }
      await navigate(page, 'animations');
      await renderedReady(page);
      const header = await page.locator('.database-modal-header').boundingBox();
      expect(await page.locator('.animation-detail-form').evaluate(node => getComputedStyle(node).overflowY)).toBe('auto');
      expect(await page.getByTestId('db-animation-sheet-preview-surface').evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(280);
      await wheelTo(page, 'db-animation-cell-x-0');
      await wheelTo(page, 'db-animation-timing-add');
      await wheelTo(page, 'db-field-animation-frame-width');
      expect(await page.locator('.database-modal-header').boundingBox()).toEqual(header);
      await expect(page.getByTestId('db-animation-play')).toHaveAttribute('aria-pressed', 'true');
      // Observe the existing playback's next frame, not a sleep or a new loop.
      await page.locator('.db-animation-stage-cells').evaluate(layer => new Promise<void>((resolve, reject) => {
        const frame = () => Array.from(layer.children).map(cell => {
          const style = (cell as HTMLElement).style;
          return [style.transform, style.opacity, style.backgroundPosition];
        });
        const initial = JSON.stringify(frame());
        const observer = new MutationObserver(() => {
          if (layer.childElementCount > 0 && JSON.stringify(frame()) !== initial) { observer.disconnect(); clearTimeout(timeout); resolve(); }
        });
        const timeout = setTimeout(() => { observer.disconnect(); reject(new Error('Playback frame did not advance')); }, 5000);
        observer.observe(layer, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
      }));
    });
  }
  test(`animation keyboard and resource dialog at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openDatabase(page);
    await navigate(page, 'animations');
    await renderedReady(page);
    // Native Tab traversal from the sheet controls reaches timing controls.
    await page.getByTestId('db-field-animation-frame-width').focus();
    // Firefox adds native Tab stops for overflowing regions, including the
    // timing panel at 1024px (404px viewport / 644px content). Follow actual
    // focus events instead of predicting an input/button-only tab order.
    const maxTabs = await page.locator('.animation-detail-form').locator('button,input,select,textarea,summary,[tabindex]').count() + 10;
    const focusTrace = [];
    let reached = false;
    for (let index = 0; index < maxTabs && !reached; index += 1) {
      await page.evaluate(() => {
        window.__dbTabReached = new Promise<void>((resolve, reject) => {
          const finish = () => { clearTimeout(timer); resolve(); };
          const timer = setTimeout(() => { document.removeEventListener('focusin', finish); reject(new Error('Native Tab produced no focus event')); }, 5000);
          document.addEventListener('focusin', finish, { once: true });
        });
      });
      await page.keyboard.press('Tab');
      const focus = await page.evaluate(async () => {
        if (!window.__dbTabReached) throw new Error('Missing native focus subscription');
        await window.__dbTabReached;
        const active = document.activeElement;
        return { testid: active?.getAttribute('data-testid'), tag: active?.tagName, class: active?.className };
      });
      focusTrace.push(focus);
      reached = focus.testid === 'db-animation-timing-add';
    }
    await writeFile(resolve(evidenceDirectory, `animation-keyboard-${viewport.width}x${viewport.height}.json`), JSON.stringify({ viewport, focusTrace }, null, 2));
    expect(reached, JSON.stringify(focusTrace)).toBe(true);
    await expect(page.getByTestId('db-animation-timing-add')).toBeFocused();
    await expect(page.getByTestId('db-animation-timing-add')).toBeInViewport();
    const choose = page.getByTestId('db-field-animation-resource-set');
    await choose.click();
    await page.getByTestId('db-field-animation-resource-dialog').waitFor();
    await page.keyboard.press('Escape');
    await page.getByTestId('db-field-animation-resource-dialog').waitFor({ state: 'hidden' });
    await expect(choose).toBeFocused();
    await expect(page.getByTestId('database-modal')).toBeVisible();
  });
}


test('equipment filtering, selection and gallery', async ({ page }) => {
  test.setTimeout(360_000);
  await openDatabase(page);
  await navigate(page, 'items');
  const equipment = await page.evaluate(async () => {
    const item = (await import('/src/project/store.ts')).store.getCurrent().database.equipment[0];
    if (!item) throw new Error('Missing Equipment fixture');
    return { id: item.id, name: item.name };
  });
  await page.getByTestId('db-catalog-filter-equipment').click();
  await page.getByTestId(`db-record-row-${equipment.id}`).click();
  const search = page.getByTestId('db-catalog-search');
  await search.fill('css-no-matching-record');
  await expect(search).toBeFocused();
  await page.getByTestId('db-catalog-reveal-selection').click();
  await expect(search).toHaveValue('');
  for (const mode of ['gallery', 'list']) {
    await page.getByTestId(`db-view-toggle-${mode}`).click();
    await expect(page.getByTestId(`db-record-${mode === 'list' ? 'row' : 'card'}-${equipment.id}`)).toHaveAttribute('aria-pressed', 'true');
  }
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    const price = page.getByTestId('db-field-price');
    expect(await price.evaluate(node => {
      const wrapper = node.closest('.db-number-stepper');
      if (!wrapper) throw new Error('Missing Equipment stepper');
      return { height: wrapper.getBoundingClientRect().height, border: getComputedStyle(node).borderTopWidth };
    })).toEqual({ height: 32, border: '0px' });
    await page.screenshot({ path: resolve(evidenceDirectory, `equipment-${width}.png`) });
  }
});

test('actor and enemy navigation and portrait failure variant', async ({ page }) => {
  await openDatabase(page);
  for (const [tab, strip] of [['actors', '[data-testid="db-actor-section-tabs"]'], ['enemies', '.db-enemy-inspector-tabs']]) {
    await navigate(page, tab);
    const tabs = page.locator(strip).getByRole('tab');
    await tabs.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.nth(1)).toHaveAttribute('tabindex', '0');
    await page.keyboard.press('Home');
    await expect(tabs.first()).toBeFocused();
    expect(await tabs.first().evaluate(node => getComputedStyle(node).outlineWidth)).toBe('2px');
    const idle = await tabs.nth(1).evaluate(node => getComputedStyle(node).color);
    await tabs.nth(1).hover();
    expect(await tabs.nth(1).evaluate(node => getComputedStyle(node).color)).not.toBe(idle);
    expect(await tabs.nth(1).evaluate(node => node.getBoundingClientRect().height)).toBe(34);
    await tabs.nth(1).evaluate(node => { if (!(node instanceof HTMLButtonElement)) throw new Error('Not a native tab'); node.disabled = true; node.click(); });
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
    expect(await tabs.nth(1).evaluate(node => getComputedStyle(node).opacity)).toBe('0.45');
    await tabs.nth(1).evaluate(node => { if (!(node instanceof HTMLButtonElement)) throw new Error('Not a native tab'); node.disabled = false; });
  }
  await navigate(page, 'actors');
  const portrait = page.locator('.db-list-thumb-probe').first();
  expect(await portrait.evaluate(node => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height }))).toEqual({ width: 36, height: 36 });
  await portrait.evaluate(node => new Promise<void>((resolve, reject) => {
    if (!(node instanceof HTMLImageElement)) throw new Error('Not an image probe');
    const slot = node.parentElement;
    if (!slot) throw new Error('Missing thumbnail slot');
    const timeout = setTimeout(() => reject(new Error('Image error state deadline')), 5000);
    node.addEventListener('error', () => {
      clearTimeout(timeout);
      if (slot.classList.contains('db-image-load-failed') && slot.getBoundingClientRect().width >= 32) resolve();
      else reject(new Error('No sized image-failure placeholder'));
    }, { once: true });
    node.src = 'data:image/png;base64,broken';
  }));

});

for (const mode of ['list', 'gallery']) {
 test(`virtualized linked selection reveal in ${mode}`, async ({ page }) => {
  await openDatabase(page);
  // A test-only distant linked enemy exercises the actual virtualized reveal.
  await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    const { normalizeMonsterSpeciesRecord } = await import('/src/project/monsterCollection.ts');
    store.update(project => {
      const base = project.database.enemies[0];
      if (!base) throw new Error('Missing enemy fixture');
      project.database.enemies = [...Array.from({ length: 100 }, (_, index) => ({ ...structuredClone(base), id: `css-filler-${index}`, name: `Fixture ${index}`, speciesId: undefined })), { ...structuredClone(base), id: 'css-target', name: 'Distant CSS target', speciesId: 'css-species' }];
      project.database.monsterSpecies = [normalizeMonsterSpeciesRecord({ id: 'css-species', name: 'CSS species' })];
    }, { scope: 'database', label: 'Test-only virtual selection fixture' });
    (await import('/src/editor/panels/databaseMonsterSpeciesView.ts')).setSelectedMonsterSpeciesId('css-species');
  });
  const before = await page.evaluate(async () => JSON.stringify((await import('/src/project/store.ts')).store.getCurrent().database));
    await navigate(page, 'enemies');
    await page.getByTestId(`db-view-toggle-${mode}`).click();
    const search = page.locator('.oprn-record-list-pane .db-search input');
    await page.evaluate(() => {
      window.__dbSearchReady = new Promise<void>((resolve, reject) => {
        const finish = () => {
          const root = document.querySelector('.oprn-record-enemies');
          const search = root?.querySelector<HTMLInputElement>('.db-search input');
          const list = root?.querySelector('.db-list');
          if (search?.value === 'stale-no-match' && document.activeElement === search && list && !list.querySelector('.db-list-row,.db-gallery-card')) {
            clearTimeout(timeout); observer.disconnect(); document.removeEventListener('focusin', finish); resolve();
          }
        };
        const observer = new MutationObserver(finish);
        const timeout = setTimeout(() => { observer.disconnect(); document.removeEventListener('focusin', finish); reject(new Error('Search render/focus readiness deadline')); }, 10_000);
        observer.observe(document.body, { childList: true, subtree: true });
        document.addEventListener('focusin', finish);
      });
    });
    await search.fill('stale-no-match');
    await page.evaluate(() => {
      if (!window.__dbSearchReady) throw new Error('Missing search subscription');
      return window.__dbSearchReady;
    });
    await navigate(page, 'monsterSpecies');
    expect(await page.getByTestId('db-monster-species-open-enemy-css-target').count()).toBe(1);
    await page.getByTestId('db-monster-species-open-enemy-css-target').click();
    const target = page.getByTestId(`db-record-${mode === 'list' ? 'row' : 'card'}-css-target`);
    await expect(target).toHaveAttribute('aria-pressed', 'true');
    await expect(target).toBeInViewport();
    await expect(page.locator('.oprn-record-list-pane .db-search input')).toHaveValue('');
    expect(await page.locator('.oprn-record-list-pane .db-list-row, .oprn-record-list-pane .db-gallery-card').count()).toBeLessThan(101);
    await page.screenshot({ path: resolve(evidenceDirectory, `virtual-reveal-${mode}.png`) });
  expect(await page.evaluate(async () => JSON.stringify((await import('/src/project/store.ts')).store.getCurrent().database))).toBe(before);
 });
}

test('System fonts and runtime preview variants', async ({ page }) => {
  await openDatabase(page);
  await page.setViewportSize({ width: 1024, height: 768 });
  await navigate(page, 'system');
  await page.getByTestId('db-system-nav-font').click();
  const font = page.getByTestId('db-field-system-font-ui');
  await font.selectOption('galmuri11');
  await renderedReady(page);
  expect(await font.evaluate(node => getComputedStyle(node).fontFamily)).toContain('Galmuri11');
  await page.getByTestId('db-system-font-reset').click();
  await renderedReady(page);
  const roles = await page.locator('[data-testid="db-system-font-sample-mono"], [data-testid="db-system-font-sample-pixel"]').evaluateAll(nodes => nodes.map(node => ({ id: node.getAttribute('data-testid'), family: getComputedStyle(node).fontFamily })));
  expect(roles).toHaveLength(2);
  expect(roles.find(role => role.id?.endsWith('-mono'))?.family).toMatch(/mono|D2Coding/i);
  expect(roles.find(role => role.id?.endsWith('-pixel'))?.family).toMatch(/Galmuri|DungGeunMo/i);
  await writeFile(resolve(evidenceDirectory, 'computed-font-roles.json'), JSON.stringify(roles, null, 2));
  const uiFamily = await font.evaluate(node => getComputedStyle(node).fontFamily);
  expect(uiFamily).not.toContain('Galmuri11');
  expect(await font.evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(32);
  expect(await font.evaluate(node => node.getBoundingClientRect().height)).toBeLessThanOrEqual(36);
  await page.screenshot({ path: resolve(evidenceDirectory, 'system-font-1024x768.png') });
  await page.getByTestId('db-system-nav-title').click();
  const preview = page.getByTestId('db-title-workbench-stage');
  await preview.scrollIntoViewIfNeeded();
  expect(await preview.evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThan(100);
  // The System worksheet shares runtime FX, but owns its preview-menu DOM.
  const previewFamily = await preview.locator('.db-title-workbench-menu-item').first().evaluate(node => getComputedStyle(node).fontFamily);
  await writeFile(resolve(evidenceDirectory, 'computed-preview-font.json'), JSON.stringify({ previewFamily, expectedUiFamily: uiFamily }, null, 2));
  expect(previewFamily).toBe(uiFamily);
  await page.screenshot({ path: resolve(evidenceDirectory, 'system-preview-1024x768.png') });
});

test('world document control and typography variants', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await openDatabase(page);
  await navigate(page, 'worldCanon');
  const prose = page.getByTestId('db-world-canon-body');
  expect(await prose.evaluate(node => getComputedStyle(node).fontSize)).toBe('16px');
  expect(await prose.evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(320);
  await navigate(page, 'worldCodex');
  for (const id of ['world-list-toggle', 'world-add-type', 'world-add-entity', 'world-gallery-toggle']) {
    expect(await page.getByTestId(id).evaluate(node => node.getBoundingClientRect().height)).toBe(36);
  }
});

for (const width of [1440, 1024]) {
  test(`distinctive child routes and tileset geometry at ${width}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: 900 });
    await openDatabase(page);
    for (const [parent, child] of [['scratchConcepts', 'structureKits'], ['scratchConcepts', 'tilesetSpaces'], ['scratchConcepts', 'villages'], ['tilesets', 'terrain']]) {
      await navigate(page, parent);
      await page.getByTestId(`db-context-${child}`).click();
      expect(await page.evaluate(async () => (await import('/src/editor/panels/database.ts')).getDatabaseActiveTab())).toBe(child);
      await renderedReady(page);
      await page.screenshot({ path: resolve(evidenceDirectory, `child-${child}-${width}.png`) });
      if (child === 'villages') {
        await page.getByTestId('db-context-worldGen').click();
        await renderedReady(page);
        await page.screenshot({ path: resolve(evidenceDirectory, `child-worldGen-${width}.png`) });
        await page.getByTestId('db-context-back').click();
      }
      await page.getByTestId('db-context-back').click();
      await expect(page.locator(`.db-tab[data-tab="${parent}"]`)).toHaveClass(/active/);
    }
    for (const alias of ['tilesetAutotile', 'tilesetUnlabeled']) {
      await page.getByTestId('db-tab-search').fill(alias);
      await page.locator(`.db-tab[data-tab="${alias}"]`).click();
      await renderedReady(page);
      await expect(page.locator('.db-tab[data-tab="tilesets"]')).toHaveClass(/active/);
      await page.screenshot({ path: resolve(evidenceDirectory, `child-${alias}-${width}.png`) });
    }
    await navigate(page, 'tilesets');
    await page.getByTestId('tileset-section-tab-rules').click();
    const art = page.locator('.tileset-db-click-grid');
    expect(await art.locator('[data-tile]').count()).toBeGreaterThan(0);
    const cell = art.locator('[data-tile]').first();
    expect(await cell.evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThan(0);
    expect(await cell.evaluate(node => node.getBoundingClientRect().width === node.getBoundingClientRect().height)).toBe(true);
  });
}


test('rendered contracts reject reintroduced animation and stepper ownership conflicts', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openDatabase(page);
  await navigate(page, 'animations');
  const form = page.locator('.animation-detail-form');
  await assertAuthoringScroll(form);
  const overflow = await page.addStyleTag({ content: '.database-modal-backdrop .database-modal-window .db-battle-studio-surface { overflow: visible; }' });
  await expect(assertAuthoringScroll(form)).rejects.toThrow();
  await overflow.evaluate(node => node.remove());
  await assertAuthoringScroll(form);
  await navigate(page, 'items');
  const input = page.getByTestId('db-field-price');
  await assertStepper(input);
  const chrome = await page.addStyleTag({ content: '.database-modal-backdrop .database-modal-window .database-modal-body input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]) { border: 1px solid; border-radius: 8px; min-height: 32px; }' });
  await expect(assertStepper(input)).rejects.toThrow();
  await chrome.evaluate(node => node.remove());
  await assertStepper(input);
});

test('shared action hover and disabled native states', async ({ page }) => {
  await openDatabase(page);
  await navigate(page, 'items');
  const length = () => page.evaluate(async () => (await import('/src/project/store.ts')).store.getCurrent().database.equipment.length);
  const before = await length();
  const add = page.getByTestId('db-catalog-add-equipment');
  const idleAdd = await add.evaluate(node => getComputedStyle(node).backgroundColor);
  await add.hover();
  expect(await add.evaluate(node => getComputedStyle(node).backgroundColor)).not.toBe(idleAdd);
  await add.evaluate(node => { if (!(node instanceof HTMLButtonElement)) throw new Error('Not a native action'); node.disabled = true; node.click(); });
  expect(await length()).toBe(before);
  expect(await add.evaluate(node => getComputedStyle(node).opacity)).toBe('0.45');
  await add.evaluate(node => { if (!(node instanceof HTMLButtonElement)) throw new Error('Not a native action'); node.disabled = false; });
});

test('CRUD confirmation and representative shared text contrast', async ({ page }) => {
  await openDatabase(page);
  await navigate(page, 'items');
  const length = () => page.evaluate(async () => (await import('/src/project/store.ts')).store.getCurrent().database.equipment.length);
  const before = await length();
  await page.getByTestId('db-catalog-add-equipment').press('Enter');
  expect(await length()).toBe(before + 1);
  // The confirmation window is time behavior. Freeze its clock, rather than
  // relying on two actions and a screenshot finishing within three seconds.
  await page.clock.install({ time: new Date('2026-09-06T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-06T00:00:01Z'));
  const remove = page.getByTestId('db-delete-selected');
  const idle = await remove.evaluate(node => getComputedStyle(node).backgroundColor);
  await remove.press('Enter');
  await expect(remove).toHaveClass(/confirming/);
  expect(await length()).toBe(before + 1);
  expect(await remove.evaluate(node => getComputedStyle(node).backgroundColor)).not.toBe(idle);
  expect(await remove.evaluate(node => node.getBoundingClientRect().height)).toBe(32);
  await page.screenshot({ path: resolve(evidenceDirectory, 'crud-confirming.png') });
  await remove.press('Enter');
  expect(await length()).toBe(before);
  await page.clock.resume();
  // Measure the originally failing destructive hover tint, not only white idle.
  await remove.hover();
  await remove.evaluate(node => new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Destructive hover transition deadline')), 5000);
    Promise.all(node.getAnimations().map(animation => animation.finished)).then(
      () => { clearTimeout(timer); resolve(); },
      error => { clearTimeout(timer); reject(error); },
    );
  }));
  const samples = await page.locator('.db-catalog-actions button, .db-field > span:first-child').evaluateAll(nodes => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Missing color-compositing context');
    const luminance = (rgb: readonly number[]) => rgb.slice(0, 3).map(v => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    return nodes.filter(node => node.getBoundingClientRect().width > 1 && node.getBoundingClientRect().height > 1 && !node.matches(':disabled')).slice(0, 12).map(node => {
      context.clearRect(0, 0, 1, 1); context.fillStyle = 'white'; context.fillRect(0, 0, 1, 1);
      const chain: Element[] = [];
      for (let parent: Element | null = node; parent; parent = parent.parentElement) chain.unshift(parent);
      for (const parent of chain) { context.fillStyle = getComputedStyle(parent).backgroundColor; context.fillRect(0, 0, 1, 1); }
      const background = Array.from(context.getImageData(0, 0, 1, 1).data);
      context.fillStyle = getComputedStyle(node).color; context.fillRect(0, 0, 1, 1);
      const foreground = Array.from(context.getImageData(0, 0, 1, 1).data);
      const a = luminance(background), b = luminance(foreground);
      return { testid: node.getAttribute('data-testid'), class: node.className, hovered: node.matches(':hover'), text: node.textContent, html: node.outerHTML, foreground, background, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
    });
  });
  expect(samples.length).toBeGreaterThan(0);
  await writeFile(resolve(evidenceDirectory, 'shared-contrast.json'), JSON.stringify(samples, null, 2));
  expect(samples.find(sample => sample.testid === 'db-delete-selected')?.hovered).toBe(true);
  for (const sample of samples) expect(sample.ratio, JSON.stringify(sample)).toBeGreaterThanOrEqual(4.5);
});

for (const width of [1440, 1024]) {
  for (const [tab, lower] of [['classes', 'db-class-promotion-add'], ['troops', 'db-troop-event-add-page']]) {
    test(`real ${tab} main-form lower control wheel access at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openDatabase(page);
      await navigate(page, tab);
      await renderedReady(page);
      const selector = `.oprn-record-${tab} .oprn-detail-form`;
      await assertAuthoringScroll(page.locator(selector));
      await wheelTo(page, lower, selector);
      const ranges = await page.locator('.oprn-record-detail-pane').evaluate(node => {
        const body = node.closest('.db-body');
        if (!body) throw new Error('Missing DB body');
        return [node.scrollHeight - node.clientHeight, body.scrollHeight - body.clientHeight];
      });
      expect(ranges.every(range => range <= 1)).toBe(true);
    });
  }
  test(`narrow captions and intrinsic Battle Commands card action at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openDatabase(page);
    await navigate(page, 'battleCommands');
    const action = page.getByTestId('db-open-classes-tab');
    expect(await action.evaluate(node => {
      const parent = node.parentElement;
      if (!parent) throw new Error('Missing card body');
      return { intrinsic: node.getBoundingClientRect().width < parent.getBoundingClientRect().width, alignment: getComputedStyle(node).justifySelf };
    })).toEqual({ intrinsic: true, alignment: 'start' });
    for (const tab of ['items', 'enemies']) {
      await navigate(page, tab);
      if (tab === 'items') expect(await page.getByTestId('db-field-price').evaluate(node => {
        if (!(node instanceof HTMLInputElement) || !node.labels?.length) throw new Error('Missing item caption');
        return getComputedStyle(node.labels[0]).fontSize;
      })).toBe('12.5px');
      const captions = page.locator('.db-field > span:first-child');
      const measured = await captions.evaluateAll(nodes => nodes.filter(node => node.getBoundingClientRect().width > 1).map(node => {
        const range = document.createRange(); range.selectNodeContents(node);
        const box = node.getBoundingClientRect();
        return { text: node.textContent, width: box.width, font: getComputedStyle(node).fontSize,
          visibleText: Array.from(range.getClientRects()).every(rect => rect.left >= box.left - 1 && rect.right <= box.right + 1),
          unclipped: node.scrollHeight <= node.clientHeight + 1 };
      }));
      expect(measured.length).toBeGreaterThan(0);
      for (const caption of measured) {
        expect(caption.visibleText, JSON.stringify(caption)).toBe(true);
        expect(caption.unclipped, JSON.stringify(caption)).toBe(true);
      }
      await writeFile(resolve(evidenceDirectory, `domain-captions-${tab}-${width}.json`), JSON.stringify(measured, null, 2));
    }
  });
}
