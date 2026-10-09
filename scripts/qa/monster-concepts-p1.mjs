#!/usr/bin/env node
// Real editor QA only. No authored fixture is persisted remotely.
// Bun.WebView was probed first (webview-probe.log). Playwright is used here for
// context-wide request interception, native keyboard focus and action tracing.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { firefox } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
assert.equal(process.cwd(), root, 'Run from the assigned worktree');
const out = resolve(root, 'output/evidence/monster-concepts/p1');
const host = '127.0.0.6';
const port = 9841;
// The dev-project gate recognizes localhost, not arbitrary loopback aliases.
// Route localhost requests to the owned Vite address without changing product code.
const base = `http://localhost:${port}`;
mkdirSync(out, { recursive: true });
const results = { task: 'st_01a073c9', base, started: new Date().toISOString(), driver: 'Playwright Firefox; Bun.WebView capability probe retained separately', actions: [], layouts: [], defects: [], errors: [], blockedRequests: [], cleanup: {} };
const save = (name, value) => writeFileSync(resolve(out, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
const sourceFiles = ['src/editor/panels/database.ts', 'src/editor/panels/databaseEnemyRecordView.ts', 'src/editor/panels/databaseMonsterSpeciesView.ts'];
const hashes = () => Object.fromEntries(sourceFiles.map(p => [p, createHash('sha256').update(readFileSync(resolve(root, p))).digest('hex')]));
results.sourceHashes = hashes();
results.portOwnershipBefore = execFileSync('ss', ['-ltnp', 'sport = :9841'], { encoding: 'utf8' });
async function assertPortFree() {
  const probe = createServer();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(port, host, resolve); });
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
}
let server, browser, context, page;
let serverLog = '';
const cache = resolve(out, '.qa-vite-cache');
let phase = 'startup';
const record = (name, data = {}) => { results.actions.push({ name, ...data }); save('actions.json', results); console.log(`PASS ${name}`); };
const check = (ok, detail) => { if (!ok) results.defects.push({ phase, ...detail }); };
// Exact DOM mutation signal, not a fixed delay or polling loop. The observer is
// installed before the action; an already-satisfied state resolves immediately.
async function armDOM(expression) {
  await page.evaluate(expression => {
    window.__qaDOM = new Promise((resolve, reject) => {
      let timer;
      const observer = new MutationObserver(test);
      function test() {
        if (!Function(`return (${expression})`)()) return;
        observer.disconnect(); clearTimeout(timer); resolve(true);
      }
      observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true });
      timer = setTimeout(() => { observer.disconnect(); reject(new Error(`DOM signal timeout: ${expression}`)); }, 90000);
      test();
    });
    window.__qaDOM.catch(() => {});
  }, expression);
}
let failTransport;
const transportFailure = new Promise((_, reject) => { failTransport = reject; });
transportFailure.catch(() => {});
const domDone = () => Promise.race([page.evaluate(() => window.__qaDOM), transportFailure]);
async function tab(slug) {
  const target = page.getByTestId(`db-tab-${slug}`);
  if (!(await target.isVisible())) {
    const groupId = await target.evaluate(node => {
      let previous = node.previousElementSibling;
      while (previous && !previous.classList.contains('db-tab-group')) previous = previous.previousElementSibling;
      return previous?.getAttribute('data-testid');
    });
    assert.ok(groupId, 'Collapsed sidebar tab must have a group');
    await page.getByTestId(groupId).click();
  }
  await armDOM(`document.querySelector('[data-testid="db-tab-${slug}"]')?.classList.contains('active')`);
  await page.getByTestId(`db-tab-${slug}`).click();
  await domDone();
}
async function armStore() {
  await page.evaluate(() => {
    window.__qaStoreSignal = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { off(); reject(new Error('Store signal timeout')); }, 15000);
      const off = window.__oprnEditorStore.subscribe((_project, change) => { off(); clearTimeout(timer); resolve(change); });
    });
    window.__qaStoreSignal.catch(() => {});
  });
}
const storeDone = () => page.evaluate(() => window.__qaStoreSignal);
const snapshot = () => page.evaluate(() => JSON.stringify(window.__oprnEditorStore.getCurrent().database));
const changes = () => page.evaluate(() => window.__qaChanges);
const history = () => page.evaluate(() => window.__qaHistory.getMapEditHistoryState());
async function seed(link, appearance = 'equal') {
  const fixture = await page.evaluate(async ({ link, appearance }) => {
    const store = window.__oprnEditorStore;
    const { normalizeMonsterSpeciesRecord } = await import('/src/project/monsterCollection.ts');
    const { normalizeEnemyRecord } = await import('/src/project/databaseEnemyTroopRecordModel.ts');
    window.__qaHistory = await import('/src/editor/mapEditHistory.ts');
    window.__qaUnsubscribe?.();
    window.__qaOriginal ??= structuredClone(store.getCurrent().database);
    store.update(project => {
      project.database = structuredClone(window.__qaOriginal);
      project.system.monsterCollection = true;
      const enemy = project.database.enemies[0];
      enemy.name = 'QA 전투 슬라임';
      enemy.graphicHue = 0; enemy.transparent = false; enemy.flying = false;
      enemy.stats = { ...enemy.stats, maxHp: 321, attack: 77 };
      const graphic = { monsterResourceId: enemy.monsterResourceId, graphicHue: 0, transparent: false, flying: false };
      if (appearance === 'hue-only') graphic.graphicHue = 90;
      if (appearance === 'all-four') {
        graphic.monsterResourceId = project.database.enemies.find(e => e.monsterResourceId && e.monsterResourceId !== enemy.monsterResourceId)?.monsterResourceId;
        if (!graphic.monsterResourceId) throw new Error('Fixture needs a second shipped monster resource');
        graphic.graphicHue = 135; graphic.transparent = true; graphic.flying = true;
      }
      const explicit = normalizeMonsterSpeciesRecord({ id: 'qa-explicit-species', name: 'QA 포획 성장종', graphic });
      const fallback = normalizeMonsterSpeciesRecord({ id: enemy.id, name: 'QA 같은 ID 호환종', graphic });
      project.database.monsterSpecies = link === 'absent' ? [explicit] : [explicit, fallback];
      enemy.speciesId = link === 'explicit' ? explicit.id : link === 'missing' ? 'qa-missing-species' : undefined;
      // The sample adventure omits default dark:C. The existing generic update
      // normalizer fills it on any edit. Start from that canonical enemy shape
      // so the four-field-only assertion measures copying, not legacy repair.
      project.database.enemies[0] = normalizeEnemyRecord(enemy);
    }, { scope: 'database', collection: 'enemies', label: 'Disposable QA seed' });
    window.__qaHistory.resetMapEditHistory();
    window.__qaChanges = [];
    window.__qaUnsubscribe = store.subscribe((_project, change) => window.__qaChanges.push(change));
    const enemy = store.getCurrent().database.enemies[0];
    return { enemyId: enemy.id, targetId: link === 'explicit' ? 'qa-explicit-species' : enemy.id, remoteEnabled: store.isRemotePersistenceEnabled() };
  }, { link, appearance });
  assert.equal(fixture.remoteEnabled, false);
  await tab('enemies');
  await page.locator('.oprn-record-enemies .db-list-row').first().click();
  await page.getByTestId('db-enemy-section-basic-tab').click();
  return fixture;
}
async function reachable(id) {
  const control = page.getByTestId(id);
  await control.scrollIntoViewIfNeeded();
  const facts = await control.evaluate(node => {
    const r = node.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { id: node.dataset.testid, tag: node.tagName, text: node.innerText, ariaLabel: node.getAttribute('aria-label'), labels: [...(node.labels ?? [])].map(l => l.innerText), width: r.width, height: r.height, x: r.x, y: r.y, hit: hit === node || node.contains(hit), tabIndex: node.tabIndex, disabled: node.disabled ?? false };
  });
  check(facts.hit && facts.width > 20 && facts.height > 15, { kind: 'reachability', facts });
  return facts;
}
async function capture(name) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].filter(i => i.getBoundingClientRect().width && !i.complete).map(i => new Promise(resolve => { i.addEventListener('load', resolve, { once: true }); i.addEventListener('error', resolve, { once: true }); })));
  });
  await page.screenshot({ path: resolve(out, name), animations: 'disabled' });
}
async function geometry(view, viewport) {
  const facts = await page.evaluate(() => {
    const selectors = ['html', '.database-modal-window', '.database-modal-body', '.db-body', '.oprn-record-enemies', '.db-enemy-studio', '.db-enemy-inspector', '.oprn-record-monster-species', '.db-ws-detail-body', '.db-life-header'];
    return selectors.flatMap(selector => [...document.querySelectorAll(selector)].filter(n => n.getBoundingClientRect().width).map(n => ({ selector, clientWidth: n.clientWidth, scrollWidth: n.scrollWidth, overflowX: getComputedStyle(n).overflowX, rect: n.getBoundingClientRect().toJSON() })));
  });
  results.layouts.push({ view, viewport, facts });
  for (const fact of facts) check(fact.scrollWidth <= fact.clientWidth + 1, { kind: 'horizontal-overflow', view, viewport, fact });
}
try {
  await assertPortFree();
  server = spawn('npm', ['run', 'dev:worktree', '--', '--host', host, '--port', String(port)], { cwd: root, detached: true, env: { ...process.env, VITE_CACHE_DIR: cache }, stdio: ['ignore', 'pipe', 'pipe'] });
  results.serverPid = server.pid;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Owned Vite server ready signal timeout')), 90000);
    const onData = chunk => {
      serverLog += chunk.toString(); save('qa-server.log', serverLog);
      if (serverLog.includes(`${host}:${port}`)) { clearTimeout(timer); resolve(); }
    };
    server.stdout.on('data', onData); server.stderr.on('data', onData);
    server.once('error', reject);
    server.once('exit', (code, signal) => { clearTimeout(timer); reject(new Error(`Owned server exited ${code}/${signal}`)); });
  });
  results.portOwnershipRunning = execFileSync('ss', ['-ltnp', 'sport = :9841'], { encoding: 'utf8' });
  browser = await firefox.launch();
  results.browserVersion = browser.version();
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.route('**/*', route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.origin === base) return route.fetch({ url: request.url().replace(base, `http://${host}:${port}`), timeout: 120000, maxRetries: 1 }).then(response => {
      assert.ok(response.url().startsWith(`http://${host}:${port}/`));
      return route.fulfill({ response });
    }).catch(async error => {
      results.errors.push(`HTTP transport: ${new URL(request.url()).pathname}: ${error.message}`);
      failTransport(error);
      await route.abort().catch(abortError => results.errors.push(`Abort during cleanup: ${abortError.message}`));
    });
    if (['data:', 'blob:'].includes(url.protocol)) return route.continue();
    results.blockedRequests.push({ origin: url.origin, pathname: url.pathname, method: request.method() });
    return route.abort('blockedbyclient');
  });
  // Do not archive raw Vite responses: import.meta.env can contain credentials.
  await context.addInitScript(() => {
    if (location.protocol !== 'http:') return;
    localStorage.setItem('oprn:editor-ui-mode', 'expert');
    localStorage.setItem('oprn:editor-ui-mode', 'expert');
    localStorage.setItem('oprn:ai-consent', 'accepted');
  });
  page = await context.newPage(); page.setDefaultTimeout(45000);
  page.on('pageerror', error => results.errors.push(error.message));
  page.on('requestfailed', request => { results.requestFailures ??= []; results.requestFailures.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText }); });
  await page.goto(`${base}/?freshProject=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  results.transport = { browserOrigin: base, httpTarget: `http://${host}:${port}`, mechanism: 'Playwright route.fetch real Vite response; response URL asserted' };
  await armDOM(`document.querySelector('[data-testid="edit-canvas"]') && window.__oprnEditorStore`); await domDone();
  for (const [button, overlay] of [['login-guest', 'login-modal'], ['standard-welcome-start', 'standard-welcome-card'], ['coach-mark-skip', 'coach-mark-skip']]) {
    if (await page.getByTestId(button).isVisible()) {
      await armDOM(`!document.querySelector('[data-testid="${overlay}"]')`);
      await page.getByTestId(button).click(); await domDone();
    }
  }
  results.persistence = await page.evaluate(() => ({ identity: window.__oprnEditorStore.getProjectIdentity(), remoteEnabled: window.__oprnEditorStore.isRemotePersistenceEnabled() }));
  assert.equal(results.persistence.remoteEnabled, false);
  await armDOM(`document.querySelector('[data-testid="database-modal"]')`);
  await page.getByTestId('toolbar-database').click(); await domDone();

  for (const link of ['explicit', 'legacy', 'missing', 'absent']) {
    phase = `relationship-${link}`;
    const fixture = await seed(link);
    const before = await snapshot();
    await tab('monster-species'); await tab('enemies');
    const picker = page.getByTestId('db-picker-enemy-species');
    assert.equal(await picker.inputValue(), link === 'explicit' ? fixture.targetId : link === 'missing' ? 'qa-missing-species' : '');
    const option = await picker.locator('option:checked').evaluate(n => ({ value: n.value, text: n.textContent, disabled: n.disabled }));
    const linked = ['explicit', 'legacy'].includes(link);
    assert.equal(await page.getByTestId('db-enemy-open-species').count(), linked ? 1 : 0);
    if (link === 'legacy') assert.equal(await page.getByTestId('db-enemy-species-legacy').count(), 1);
    if (link === 'missing') { assert.equal(option.disabled, true); assert.equal(await page.getByTestId('db-enemy-species-missing-error').count(), 1); }
    if (link === 'absent') assert.equal(await page.getByTestId('db-enemy-species-unset-warn').count(), 1);
    await reachable('db-picker-enemy-species');
    await capture(`${phase}.png`);
    if (linked) {
      await page.getByTestId('db-enemy-open-species').click();
      assert.equal(await page.locator('.oprn-record-monster-species .db-list-row.active').getAttribute('data-record-id'), fixture.targetId);
    }
    assert.equal(await snapshot(), before); assert.equal((await changes()).length, 0); assert.equal((await history()).canUndo, false);
    record(phase, { fixture, option, renderAndNavigationMutations: 0, databaseByteEquivalent: true });
  }
  phase = 'picker-explicit-to-fallback';
  const fixture = await seed('explicit');
  await armStore(); await page.getByTestId('db-picker-enemy-species').selectOption(''); await storeDone();
  assert.equal(JSON.parse(await snapshot()).enemies[0].speciesId, undefined);
  assert.equal(await page.getByTestId('db-enemy-species-legacy').count(), 1);
  await page.getByTestId('db-enemy-open-species').click();
  assert.equal(await page.locator('.oprn-record-monster-species .db-list-row.active').getAttribute('data-record-id'), fixture.enemyId);
  record(phase, { storedSpeciesId: null, resolvedSpeciesId: fixture.enemyId });

  for (const link of ['explicit', 'legacy']) {
    phase = `replacement-${link}`;
    await seed(link); const before = await snapshot();
    await page.getByTestId('db-enemy-create-species').focus();
    await armDOM(`document.querySelector('[data-testid="app-confirm-modal"]')`);
    await page.keyboard.press('Enter'); await domDone();
    assert.equal(await page.getByTestId('app-modal-cancel').evaluate(n => n === document.activeElement), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.getByTestId('app-modal-confirm').evaluate(n => n === document.activeElement), true);
    await page.keyboard.press('Tab');
    assert.equal(await page.getByTestId('app-modal-cancel').evaluate(n => n === document.activeElement), true);
    const dialog = await page.getByRole('alertdialog').ariaSnapshot();
    await capture(`${phase}-confirm.png`);
    await armDOM(`!document.querySelector('[data-testid="app-confirm-modal"]')`);
    await page.keyboard.press('Escape'); await domDone();
    assert.equal(await snapshot(), before); assert.equal((await changes()).length, 0);
    assert.equal((await history()).canUndo, false);
    assert.equal(await page.getByTestId('db-enemy-create-species').evaluate(n => n === document.activeElement), true);
    await page.keyboard.press('Enter');
    await page.getByTestId('app-modal-confirm').focus();
    await armStore();
    await armDOM(`document.querySelector('[data-testid="db-tab-monster-species"]')?.classList.contains('active')`);
    await page.keyboard.press('Enter'); await storeDone(); await domDone();
    const after = JSON.parse(await snapshot()); const old = JSON.parse(before);
    assert.equal(after.monsterSpecies.length, old.monsterSpecies.length + 1);
    const created = after.monsterSpecies.at(-1);
    assert.deepEqual(after.monsterSpecies.slice(0, -1), old.monsterSpecies);
    assert.deepEqual(after.enemies, old.enemies.map((e, i) => i ? e : { ...e, speciesId: created.id }));
    assert.deepEqual(created.baseStats, old.enemies[0].stats);
    assert.deepEqual({ ...after, enemies: old.enemies, monsterSpecies: old.monsterSpecies }, old);
    assert.equal((await changes()).length, 1);
    assert.equal(await page.locator('.oprn-record-monster-species .db-list-row.active').getAttribute('data-record-id'), created.id);
    await capture(`${phase}-accepted.png`);
    await page.getByTestId('db-tab-monster-species').focus();
    await armStore(); await page.keyboard.press('Control+z'); await storeDone();
    assert.deepEqual(JSON.parse(await snapshot()), old); assert.equal((await history()).canUndo, false);
    record(phase, { cancelByteEquivalent: true, cancelRestoredFocus: true, focusTrap: true, dialog, created, acceptedStoreUpdates: 1, undo: 'one real Control+z restores catalog and link', before: old, after });
  }

  for (const link of ['explicit', 'legacy']) for (const appearance of ['hue-only', 'all-four']) {
    phase = `appearance-${link}-${appearance}`;
    const fixture = await seed(link, appearance);
    const before = JSON.parse(await snapshot());
    const species = before.monsterSpecies.find(s => s.id === fixture.targetId);
    if (appearance === 'hue-only') assert.equal(species.graphic.monsterResourceId, before.enemies[0].monsterResourceId);
    await reachable('db-enemy-species-copy-graphic');
    await armStore(); await page.getByTestId('db-enemy-species-copy-graphic').click(); await storeDone();
    const after = JSON.parse(await snapshot());
    const fields = Object.fromEntries(['monsterResourceId', 'graphicHue', 'transparent', 'flying'].map(key => [key, species.graphic[key]]));
    assert.deepEqual(after, { ...before, enemies: before.enemies.map((e, i) => i ? e : { ...e, ...fields }) });
    assert.equal(await page.getByTestId('db-enemy-species-copy-graphic').count(), 0);
    assert.equal((await changes()).length, 1);
    record(phase, { copiedFields: fields, enemyBefore: before.enemies[0], enemyAfter: after.enemies[0], speciesUnchanged: true, statsUnchanged: true, oneStoreUpdate: true });
  }

  for (const viewport of [{ width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
    phase = `viewport-${viewport.width}`;
    await page.setViewportSize(viewport); await seed('explicit', 'hue-only');
    const before = await snapshot();
    await page.getByTestId('db-enemy-section-basic-tab').click();
    await geometry('enemies', viewport);
    await capture(`enemies-${viewport.width}x${viewport.height}-top.png`);
    const controls = [];
    for (const id of ['db-picker-enemy-species', 'db-enemy-open-species', 'db-enemy-create-species', 'db-enemy-species-copy-graphic']) controls.push(await reachable(id));
    await page.getByTestId('db-picker-enemy-species').focus();
    await page.keyboard.press('Tab');
    const tabDestination = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    assert.equal(tabDestination, 'db-enemy-species-copy-graphic');
    await capture(`enemies-${viewport.width}x${viewport.height}-relationship-focus.png`);
    await page.getByTestId('db-enemy-create-species').click();
    const modalFacts = await reachable('app-modal-confirm');
    await capture(`replacement-${viewport.width}x${viewport.height}.png`);
    await page.getByTestId('app-modal-cancel').click();
    await page.getByTestId('db-enemy-section-basic-tab').focus();
    await page.keyboard.press('End');
    assert.equal(await page.getByTestId('db-enemy-section-rewards-tab').evaluate(n => n === document.activeElement), true);
    await page.keyboard.press('Home');
    assert.equal(await page.getByTestId('db-enemy-section-basic-tab').evaluate(n => n === document.activeElement), true);
    await page.getByTestId('db-enemy-open-species').click();
    await geometry('monster-species', viewport);
    await capture(`species-${viewport.width}x${viewport.height}-top.png`);
    const readiness = await page.getByTestId('db-monster-pipeline').ariaSnapshot();
    const speciesControls = [];
    for (const id of ['db-monster-pipeline-links-action', 'db-monster-pipeline-mode-action', 'db-monster-species-hp']) speciesControls.push(await reachable(id));
    await capture(`species-${viewport.width}x${viewport.height}-inspector.png`);
    assert.equal(await snapshot(), before); assert.equal((await changes()).length, 0);
    record(phase, { controls, modalFacts, speciesControls, readiness, tabDestination, sectionRovingFocus: true, databaseByteEquivalent: true });
  }
  assert.deepEqual(hashes(), results.sourceHashes, 'Rendered source changed during QA');
  check(results.errors.length === 0, { kind: 'pageerror', errors: results.errors });
  results.status = results.defects.length ? 'product-defects' : 'passed';
} catch (error) {
  results.status = 'failed'; results.failure = { phase, message: error.message, stack: error.stack };
  console.error(error);
  if (page && !page.isClosed()) await page.screenshot({ path: resolve(out, 'qa-failure.png') }).catch(e => { results.errors.push(`Failure screenshot: ${e.message}`); });
} finally {
  if (context) {
    await context.close(); results.cleanup.browserContextClosed = true;
  }
  if (browser) { await browser.close(); results.cleanup.browserClosed = !browser.isConnected(); }
  if (server && server.exitCode === null && server.signalCode === null) {
    const exited = once(server, 'close'); process.kill(-server.pid, 'SIGTERM');
    results.cleanup.serverExit = await exited;
  }
  if (server) {
    try { await assertPortFree(); results.cleanup.ownedAddressReleased = true; }
    catch (error) { results.cleanup.ownedAddressReleased = false; results.errors.push(`Server cleanup: ${error.message}`); results.status = 'failed'; }
  }
  rmSync(cache, { recursive: true, force: true }); results.cleanup.cacheRemoved = true;
  results.cleanup.portOwnershipAfter = execFileSync('ss', ['-ltnp', 'sport = :9841'], { encoding: 'utf8' });
  results.finished = new Date().toISOString();
  results.exitCode = results.status === 'passed' ? 0 : 1;
  save('actions.json', results); save('qa-script.exit', `${results.exitCode}\n`);
  save('cleanup.json', results.cleanup);
  save('qa-server.log', serverLog);
  console.log(JSON.stringify({ status: results.status, actions: results.actions.length, defects: results.defects, cleanup: results.cleanup }, null, 2));
  process.exitCode = results.exitCode;
}
