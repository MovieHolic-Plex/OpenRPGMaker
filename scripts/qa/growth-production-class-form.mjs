import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { firefox } from 'playwright';
import { armDomState, finishDomState, blockRemoteWrites } from './growth-tree-evidence.mjs';

const cwd = fileURLToPath(new URL('../../', import.meta.url));
const out = `${cwd}/.omo/evidence/growth-integrated/production-editor`;
await mkdir(out, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--configLoader', 'runner', '--host', '127.0.0.1', '--port', '9898', '--strictPort'], { cwd, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '', browser;
const stopped = new Promise(resolve => server.once('exit', (code, signal) => resolve({ code, signal })));
const ready = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Production preview startup deadline')), 60000);
  const data = chunk => { log += chunk.toString(); if (/Local:.*9898/.test(log)) { clearTimeout(timer); resolve(); } };
  server.stdout.on('data', data); server.stderr.on('data', data);
  server.once('error', error => { clearTimeout(timer); reject(error); });
  server.once('exit', code => { clearTimeout(timer); reject(new Error(`Preview exited ${code}`)); });
});
try {
  await ready;
  browser = await firefox.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const remoteWrites = await blockRemoteWrites(page);
  await page.addInitScript(() => localStorage.setItem('rpg-zzu:editor-ui-mode', 'expert'));
  await page.goto('http://127.0.0.1:9898/?freshProject=1', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByTestId('toolbar-database').click();
  const tab = async id => {
    if (!await page.getByTestId(id).isVisible()) await page.getByTestId('db-tab-group-party').click();
    await page.getByTestId(id).click();
  };
  await tab('db-tab-promotion-tree');
  await page.getByTestId('growth-preset-apply').click();
  const rootId = 'bundle-vanguard-class-0';
  const rootName = await page.getByTestId(`growth-node-${rootId}`).locator('strong').innerText();
  const openClass = async () => {
    await tab('db-tab-classes');
    await armDomState(page, id => Boolean(document.querySelector(`[data-testid="db-record-row-${id}"],[data-testid="db-record-card-${id}"]`)), rootId);
    await page.getByTestId('database-modal').locator('.db-search input[type="search"]').fill(rootName);
    await finishDomState(page);
    const row = page.getByTestId(`db-record-row-${rootId}`);
    await (await row.count() ? row : page.getByTestId(`db-record-card-${rootId}`)).click();
  };
  await openClass();
  const destination = await page.getByTestId('db-picker-class-promotion-to').inputValue();
  const variable = page.getByTestId('db-picker-class-promotion-variable');
  const variableId = await variable.locator('option').evaluateAll(options => options.find(option => option.value)?.value);
  assert.ok(variableId);
  const cases = [];
  for (const ordering of ['threshold-before-variable', 'clear-and-reselect']) {
    if (ordering === 'threshold-before-variable') await page.getByTestId('db-field-class-promotion-at-least').fill('7');
    else { await variable.focus(); await variable.selectOption(''); }
    assert.equal(await page.getByTestId('db-field-class-promotion-at-least').inputValue(), '7', ordering);
    await variable.focus();
    await variable.selectOption(variableId);
    // A different editor surface remounts its controls from persisted store values.
    await tab('db-tab-promotion-tree');
    await page.getByTestId(`growth-node-${rootId}`).click();
    const values = {
      variable: await page.getByTestId(`growth-promotion-variable-${destination}`).inputValue(),
      threshold: await page.getByTestId(`growth-promotion-value-${destination}`).inputValue(),
      rank: await page.getByTestId(`growth-promotion-${destination}-nodes-0-rank`).inputValue(),
      points: await page.getByTestId(`growth-promotion-${destination}-points-0-points`).inputValue(),
      skill: await page.getByTestId(`growth-promotion-${destination}-skills-0`).inputValue(),
    };
    assert.deepEqual(values, { variable: variableId, threshold: '7', rank: '2', points: '3', skill: 'bundle-vanguard-skill-0' });
    await page.screenshot({ path: `${out}/${ordering}.png` });
    cases.push({ ordering, values });
    await openClass();
    assert.equal(await page.getByTestId('db-field-class-promotion-at-least').inputValue(), '7');
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(remoteWrites, []);
  const entry = await page.locator('script[type="module"]').first().getAttribute('src');
  assert.match(entry, /\/assets\/main-.*\.js$/);
  await writeFile(`${out}/proof.json`, JSON.stringify({ entry, cases, errors, remoteWrites, source: 'production build, native UI only; no dev module imports' }, null, 2));
  console.log('Production Classes variable/threshold QA passed');
} finally {
  if (browser) await browser.close();
  if (server.exitCode === null) process.kill(-server.pid, 'SIGTERM');
  let timer;
  await Promise.race([stopped, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Production preview cleanup deadline')), 15000); })]);
  clearTimeout(timer);
  await writeFile(`${out}/server.log`, log);
}
