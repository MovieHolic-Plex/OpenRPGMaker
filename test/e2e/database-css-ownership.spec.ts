import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window { __dbScroll?: Promise<void>; }
}

async function openDatabase(page: Page) {
  await page.route('**/*', async route => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) await route.abort();
    else await route.continue();
  });
  await page.addInitScript(() => {
    localStorage.setItem('rpg-zzu:editor-ui-mode', 'expert');
    localStorage.setItem('oprn:standard-welcome-seen', '1');
    localStorage.setItem('oprn:editor-welcome-dismissed', '1');
  });
  await page.goto('/?freshProject=1', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('toolbar-database').waitFor({ state: 'visible', timeout: 60_000 });
  await page.getByTestId('toolbar-database').click();
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
    if (await heading.getAttribute('aria-expanded') === 'false') await heading.click();
  }
  await page.getByTestId(`db-tab-${tab}`).click();
  await expect(page.getByTestId(`db-tab-${tab}`)).toHaveClass(/active/);
}

for (const width of [1440, 1024]) {
  test(`animation ordinary scroll owns lower authoring at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openDatabase(page);
    await navigate(page, 'animations');
    const form = page.locator('.animation-detail-form');
    await expect(page.getByTestId('db-animation-preview-status')).toHaveAttribute('data-state', 'ready');
    const metrics = await form.evaluate(node => ({
      overflow: getComputedStyle(node).overflowY, height: node.clientHeight, content: node.scrollHeight,
    }));
    expect(metrics.overflow).toMatch(/^(auto|scroll)$/);
    expect(metrics.content).toBeGreaterThan(metrics.height);
    expect(await page.getByTestId('db-animation-sheet-preview-surface').evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(280);
    const headerBefore = await page.locator('.database-modal-header').boundingBox();
    expect(headerBefore).not.toBeNull();
    await form.hover({ position: { x: 20, y: 100 } });
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
    const input = page.getByTestId('db-field-price');
    await input.waitFor();
    const measure = () => input.evaluate(node => {
      const style = getComputedStyle(node);
      const outer = node.closest('.db-number-stepper');
      if (!outer) throw new Error('Missing shared stepper');
      return { height: outer.getBoundingClientRect().height, border: style.borderTopWidth,
        radius: style.borderTopLeftRadius, shadow: style.boxShadow };
    });
    for (const state of ['default', 'hover', 'focus']) {
      if (state === 'hover') await input.hover();
      if (state === 'focus') await input.focus();
      expect(await measure(), state).toEqual({ height: 32, border: '0px', radius: '0px', shadow: 'none' });
    }
  });
}
