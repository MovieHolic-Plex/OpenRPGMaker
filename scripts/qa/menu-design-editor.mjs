// Editor-only selection/preview QA. Runtime behavior is covered by
// runtime/menu-design.probe.mjs through player.html, not this editor shell.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const out = process.env.OPRN_MENU_QA_OUT ?? 'verify-shots/runtime-qa/menu-design';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
try {
  // A temporary editor session tests the control; no game content is authored.
  await page.addInitScript(() => localStorage.setItem('oprn:editor-ui-mode', 'expert'));
  await page.goto(`${process.env.OPRN_QA_EDITOR_URL ?? 'http://127.0.0.1:9999'}/?freshProject=1`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('edit-canvas').waitFor({ state: 'visible', timeout: 120000 });
  for (const button of ['login-guest', 'standard-welcome-start', 'coach-mark-skip']) {
    if (await page.getByTestId(button).isVisible()) await page.getByTestId(button).click();
  }
  await page.getByTestId('toolbar-database').click();
  await page.getByTestId('db-tab-group-system').click();
  await page.getByTestId('db-tab-system').click();
  await page.getByTestId('db-system-studio-card-menu').click();
  await expect(page.getByTestId('db-system-nav-menu')).toHaveAttribute('aria-current', 'true');
  const select = page.getByTestId('db-field-system-menu-ui-style');
  await expect(select.locator('button')).toHaveCount(12);
  const labels = await select.locator('button strong').allTextContents();
  for (const skin of (process.argv.slice(2).length ? process.argv.slice(2) : ['workbench', 'party-first', 'party-first-warm', 'hub', 'sheet', 'classic', 'journal', 'ribbon', 'retro-2000', 'retro-2003', 'classic-xp', 'classic-vx'])) {
    await page.getByTestId(`db-system-menu-skin-${skin}`).click();
    await expect(select.locator('[aria-pressed="true"]')).toHaveCount(1);
    await expect(page.getByTestId(`db-system-menu-skin-${skin}`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId(`db-system-menu-skin-${skin}`).locator('img')).toHaveAttribute('src', `/assets/ui/menu-skins/${skin}.png`);
    await page.waitForFunction(() => {
      const img = document.querySelector('.db-system-menu-skin-card[aria-pressed="true"] img');
      return img?.complete && img.naturalWidth > 0;
    });
    const saved = await page.evaluate(async () => {
      const { store } = await import('/src/project/store.ts');
      const { normalizeSystemRecords } = await import('/src/project/databaseRecordModel.ts');
      return normalizeSystemRecords(JSON.parse(JSON.stringify(store.getCurrent().system))).menuUiStyle;
    });
    expect(saved).toBe(skin === 'workbench' ? undefined : skin);
    await page.getByTestId(`db-system-menu-skin-${skin}`).locator('img').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/editor-${skin}.png` });
  }
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: width === 1024 ? 768 : 1000 });
    await page.getByTestId('db-system-nav-overview').click();
    await expect(page.getByTestId('db-system-studio-card-menu')).toContainText(await select.locator('[aria-pressed="true"] strong').textContent());
    await page.screenshot({ path: `${out}/overview-${width}.png` });
    await page.getByTestId('db-system-studio-card-menu').click();
    await expect(select).toBeVisible();
    expect(await select.evaluate(el => el.closest('[data-system-section]').dataset.systemSection)).toBe('menu');
    expect(await page.locator('.db-system-sections').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: `${out}/menu-section-${width}.png` });
    await page.getByTestId('db-system-nav-display').click();
    await expect(select).toBeHidden();
    await expect(page.getByTestId('db-field-system-resolution-preset')).toBeVisible();
    await page.getByTestId('db-system-nav-menu').click();
  }
  await page.getByTestId('db-system-menu-skin-workbench').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('db-system-menu-skin-workbench')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(async () => (await import('/src/project/store.ts')).store.getCurrent().system.menuUiStyle)).toBeUndefined();
  await writeFile(`${out}/EDITOR.md`, `# Editor menu selection\n\nPASS: 12 preview buttons, one selected card, requested choices round-trip through system normalization, preview PNGs decode, Enter restores the default, 1440/1024px navigation without horizontal overflow.\n\n${labels.map(x => `- ${x}`).join('\n')}\n\n즉시 확인: editor-classic-vx.png\n`);
  console.log('Editor: PASS — 12 choices, previews, normalization and default reset');
} catch (error) {
  await page.screenshot({ path: `${out}/editor-FAIL.png` });
  throw error;
} finally { await browser.close(); }
