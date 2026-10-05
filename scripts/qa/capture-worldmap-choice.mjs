import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
const out = path.resolve('verify-shots/worldmap-default-choice');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(120000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const report = {};
const pending = new Set();
const messages = [];
page.on('request', request => pending.add(request.url()));
page.on('requestfinished', request => pending.delete(request.url()));
page.on('requestfailed', request => { pending.delete(request.url()); messages.push({url:request.url(),failure:request.failure()}); });
page.on('console', message => { if (message.type() === 'error') messages.push({type:message.type(),text:message.text().slice(0,600)}); });
const diagnosticTimer = setInterval(() => fs.writeFileSync(path.join(out, 'editor-boot-diagnostics.json'), JSON.stringify({pending:[...pending].slice(-20),messages:messages.slice(-10)},null,2)), 15000);
try {
  await page.addInitScript(() => {
    localStorage.setItem('oprn:editor-ui-mode', 'standard');
    localStorage.setItem('oprn:first-edit-guide:seen', '1');
  });
  await page.goto('http://127.0.0.1:9809/?freshProject=1', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '맵', exact: true }).click();
  await page.getByTestId('map-add').waitFor({ timeout: 120000 });
  await page.getByTestId('map-add').click();
  await page.getByTestId('map-create-world-atlas').click();
  const select = page.getByTestId('world-atlas-structure');
  await select.waitFor();
  report.options = await select.locator('option').allTextContents();
  report.generalSelection = await select.inputValue();
  report.themeCount = await page.getByTestId('world-atlas-theme').locator('option').count();
  if (report.options.length !== 7 || report.generalSelection !== 'default' || report.themeCount !== 17) throw new Error('Default mode or themes missing');
  await page.screenshot({ path: path.join(out, 'editor-default.png') });
  await select.selectOption('region-routes');
  if (await page.getByTestId('world-atlas-theme').isVisible()) throw new Error('Theme picker remained visible for Pokemon structure');
  await select.selectOption('default');
  if (!await page.getByTestId('world-atlas-theme').isVisible()) throw new Error('Theme picker did not return for default');
  await page.keyboard.press('Escape');
  await page.getByTestId('world-atlas-create-dialog').waitFor({ state: 'hidden' });
  await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    store.update(project => { project.system.genre = 'monster-collect'; }, { scope: 'project', label: '월드맵 선택 확인: 몬스터 수집', origin: 'tool' });
    const { openWorldAtlasCreateDialog } = await import('/src/editor/panels/worldAtlasCreateDialog.ts');
    openWorldAtlasCreateDialog();
  });
  report.pokemonSelection = await select.inputValue();
  if (report.pokemonSelection !== 'region-routes') throw new Error('Monster genre did not select region-routes');
  await page.screenshot({ path: path.join(out, 'editor-pokemon.png') });
  await page.getByTestId('world-atlas-create-confirm').click();
  await page.getByTestId('world-atlas-create-dialog').waitFor({ state: 'hidden', timeout: 90000 });
  report.pokemonCreated = await page.evaluate(async () => {
    const { store } = await import('/src/project/store.ts');
    return store.getCurrent().worldAtlases?.some(atlas => atlas.structure === 'region-routes') === true;
  });
  if (!report.pokemonCreated) throw new Error('Pokemon maps were not created');
  await page.screenshot({ path: path.join(out, 'editor-pokemon-generated.png') });
  report.errors = errors;
  if (errors.length) throw new Error(JSON.stringify(errors));
  report.note = 'Real editor controls and Pokemon creation; default dispatch and real host build are separately saved/reopened in canonical-readback.json.';
  fs.writeFileSync(path.join(out, 'editor-capture.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} catch (error) {
  fs.writeFileSync(path.join(out, 'editor-failure.json'), JSON.stringify({ message: error.message, report, errors }, null, 2));
  await page.screenshot({ path: path.join(out, 'editor-failure.png') });
  throw error;
} finally {
  clearInterval(diagnosticTimer);
  await browser.close();
}
