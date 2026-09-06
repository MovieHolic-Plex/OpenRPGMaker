#!/usr/bin/env node
// B1 real-editor regression. Bootstrap and remount observer adapted from
// st_01a0747a/probe-navigation.mjs and probe.mjs. No product/timer mocks.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { firefox } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const run = process.env.MONSTER_QA_RUN ?? 'baseline';
assert.match(run, /^[\w-]+$/);
const out = resolve(root, process.env.MONSTER_QA_OUTPUT ?? `output/evidence/monster-concepts/b1/${run}`);
const host = process.env.MONSTER_QA_HOST ?? '127.0.0.9';
const port = Number(process.env.MONSTER_QA_PORT ?? 19849);
assert.match(host, /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
assert.ok(Number.isInteger(port) && port > 1024 && port < 65536);
const base = `http://localhost:${port}`, target = `http://${host}:${port}`;
const cache = resolve(out, '.qa-vite-cache');
mkdirSync(out, { recursive: true });
const save = (name, value) => writeFileSync(resolve(out, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const digest = value => createHash('sha256').update(value).digest('hex');
const sources = ['databaseModal', 'database', 'databaseMonsterSpeciesView', 'databaseEnemyRecordView', 'databaseRecordViewSession'].map(name => `src/editor/panels/${name}.ts`);
const hashes = () => Object.fromEntries(sources.map(path => [path, digest(readFileSync(resolve(root, path)))]));
const ownership = () => execFileSync('ss', ['-ltnp', `sport = :${port}`], { encoding: 'utf8' });
const results = { run, root, head: git('rev-parse', 'HEAD'), branch: git('branch', '--show-current'), base, target,
  started: new Date().toISOString(), sourceHashes: hashes(), actions: [], defects: [], errors: [], blockedRequests: [], cleanup: {} };
let server, browser, context, page, phase = 'bootstrap', serverLog = '', closing = false;
const check = (condition, kind, facts) => { if (!condition) results.defects.push({ phase, kind, facts }); };
async function portFree() {
  const probe = createServer();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(port, host, resolve); });
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
}
// Signals are armed BEFORE actions. Timeouts bound failures only; no sleeps,
// polling, forced clicks, clock overrides, or post-action reveal helpers.
async function armDOM(expression) {
  await page.evaluate(expression => {
    window.__qaDOM = new Promise((resolve, reject) => {
      const observer = new MutationObserver(test);
      const timer = setTimeout(() => { observer.disconnect(); reject(new Error(`DOM signal timeout: ${expression}`)); }, 90000);
      function test() {
        if (!Function(`return (${expression})`)()) return;
        observer.disconnect(); clearTimeout(timer); resolve(true);
      }
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true }); test();
    });
    window.__qaDOM.catch(() => {});
  }, expression);
}
const domDone = () => page.evaluate(() => window.__qaDOM);
async function tab(slug) {
  const button = page.getByTestId(`db-tab-${slug}`);
  if (!(await button.isVisible())) {
    const group = await button.evaluate(node => {
      let sibling = node.previousElementSibling;
      while (sibling && !sibling.classList.contains('db-tab-group')) sibling = sibling.previousElementSibling;
      return sibling?.dataset.testid;
    });
    assert.ok(group, 'Hidden tab must belong to a collapsible group'); await page.getByTestId(group).click();
  }
  await armDOM(`document.querySelector('[data-testid="db-tab-${slug}"]')?.classList.contains('active')`);
  await button.click(); await domDone();
}
async function armStore(expression) {
  await page.evaluate(expression => {
    window.__qaStore = new Promise((resolve, reject) => {
      const off = window.__oprnEditorStore.subscribe((project, change) => {
        if (!Function('project', `return (${expression})`)(project)) return;
        off(); clearTimeout(timer); resolve({ scope: change.scope, collection: change.collection });
      });
      const timer = setTimeout(() => { off(); reject(new Error(`Store signal timeout: ${expression}`)); }, 15000);
    });
    window.__qaStore.catch(() => {});
  }, expression);
}
const storeDone = () => page.evaluate(() => window.__qaStore);
const snapshot = () => page.evaluate(() => JSON.stringify(window.__oprnEditorStore.getCurrent()));
const database = () => page.evaluate(() => JSON.stringify(window.__oprnEditorStore.getCurrent().database));
const changeCount = () => page.evaluate(() => window.__qaChanges.length);
// Second distinct workspace = actual deferred modal refresh, not arbitrary
// frames. Retain the proven observer plus a rendering-boundary fence.
async function armRenders(count = 2, selector = '[data-testid="db-monster-species-workspace"]') {
  await page.evaluate(({ count, selector }) => {
    window.__qaRenders = [];
    window.__qaRefresh = new Promise((resolve, reject) => {
      let previous = document.querySelector(selector);
      const observer = new MutationObserver(() => {
        const current = document.querySelector(selector);
        if (!current || current === previous) return;
        previous = current; window.__qaRenders.push(window.__qaMeasure());
        if (window.__qaRenders.length !== count) return;
        observer.disconnect(); clearTimeout(timer);
        requestAnimationFrame(() => resolve({ renders: window.__qaRenders, final: window.__qaMeasure(), renderBoundary: true }));
      });
      const timer = setTimeout(() => { observer.disconnect(); reject(new Error(`Missing ${count} native remounts: ${selector}`)); }, 15000);
      observer.observe(document.querySelector('.database-modal-body'), { childList: true, subtree: true });
    });
    window.__qaRefresh.catch(() => {});
  }, { count, selector });
}
const refreshDone = () => page.evaluate(() => window.__qaRefresh);
async function seed(kind) {
  await tab('actors');
  await armRenders(1, '.db-body > :first-child');
  await armStore('project.database.monsterSpecies?.length === 101 && project.database.enemies[0]?.id === "qa-enemy-target"');
  const fixture = await page.evaluate(async kind => {
    const store = window.__oprnEditorStore;
    if (store.isRemotePersistenceEnabled()) throw new Error('Remote persistence must be disabled before fixture writes');
    const { normalizeMonsterSpeciesRecord } = await import('/src/project/monsterCollection.ts');
    const { normalizeEnemyRecord } = await import('/src/project/databaseEnemyTroopRecordModel.ts');
    window.__qaHistory = await import('/src/editor/mapEditHistory.ts');
    window.__qaSpecies = await import('/src/editor/panels/databaseMonsterSpeciesView.ts');
    window.__qaOriginal ??= structuredClone(store.getCurrent().database); window.__qaOff?.();
    store.update(project => {
      project.database = structuredClone(window.__qaOriginal); project.system.monsterCollection = true;
      const enemy = normalizeEnemyRecord({ ...project.database.enemies[0], id: 'qa-enemy-target', name: 'QA Enemy',
        monsterResourceId: undefined, speciesId: kind === 'linked' ? 'qa-species-last' : undefined });
      project.database.enemies = [enemy];
      project.database.monsterSpecies = Array.from({ length: 101 }, (_, index) => normalizeMonsterSpeciesRecord({
        id: index === 100 ? 'qa-species-last' : `qa-species-${index}`, name: `QA Species ${index}`, baseStats: { ...enemy.stats, maxHp: 321 + index },
      }));
    }, { scope: 'database', collection: 'monsterSpecies', label: 'Disposable B1 QA seed' });
    // Fixture-only selection, no reveal request. Action targets are the last row.
    window.__qaSpecies.setSelectedMonsterSpeciesId('qa-species-0');
    return { speciesCount: 101, lastId: 'qa-species-last', remoteEnabled: store.isRemotePersistenceEnabled() };
  }, kind);
  await storeDone(); await refreshDone();
  await page.evaluate(() => {
    window.__qaHistory.resetMapEditHistory(); window.__qaChanges = [];
    window.__qaOff = window.__oprnEditorStore.subscribe((_project, change) => {
      if (window.__qaChanges.length === 50) throw new Error('Unexpected store-update flood');
      window.__qaChanges.push({ scope: change.scope, collection: change.collection });
    });
  });
  return fixture;
}
async function undo(expectedDatabase) {
  await armStore(`JSON.stringify(project.database) === ${JSON.stringify(expectedDatabase)}`); await armRenders();
  await page.keyboard.press('Control+z'); await storeDone(); const refresh = await refreshDone();
  assert.equal(await database(), expectedDatabase, 'One native undo must restore the exact database');
  return { databaseHash: digest(expectedDatabase), nativeRemounts: refresh.renders.length };
}
async function userScroll() {
  const before = await page.evaluate(() => window.__qaMeasure());
  const box = await page.locator('[data-testid="db-monster-species-workspace"] .db-ws-list').boundingBox(); assert.ok(box);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.evaluate(() => {
    window.__qaScroll = new Promise((resolve, reject) => {
      const list = document.querySelector('[data-testid="db-monster-species-workspace"] .db-ws-list');
      // Firefox's injected wheel produces native scroll but no scrollend.
      // Await that exact state change and its rendering boundary instead.
      const clean = () => document.removeEventListener('scroll', done, true);
      const timer = setTimeout(() => { clean(); reject(new Error('User wheel scroll signal timeout')); }, 15000);
      function done(event) {
        if (event.target !== list) return;
        clearTimeout(timer); clean(); requestAnimationFrame(() => resolve(list.scrollTop));
      }
      document.addEventListener('scroll', done, true);
    });
    window.__qaScroll.catch(() => {});
  });
  await page.mouse.wheel(0, before.scrollTop > 600 ? -600 : 600);
  const requested = await page.evaluate(() => window.__qaScroll); assert.notEqual(requested, before.scrollTop, 'Real wheel must move the list');
  const beforeEdit = await database(), editedName = `QA scroll retention ${phase}`;
  await armRenders(1); await armStore(`project.database.monsterSpecies.some(record => record.name === ${JSON.stringify(editedName)})`);
  await page.getByTestId('db-monster-species-name').fill(editedName); await storeDone();
  // Native keyboard traversal leaves the first inspector input (Firefox also focuses scroll containers).
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')), false);
  const refresh = await refreshDone();
  check(Math.abs(refresh.final.scrollTop - requested) <= 1, 'user-scroll-not-respected-after-refresh', { requested, final: refresh.final });
  check(!refresh.final.visible, 'selection-permanently-revealed-after-user-scroll', refresh.final);
  return { requested, afterRefresh: refresh.final.scrollTop, selectedVisible: refresh.final.visible, undo: await undo(beforeEdit) };
}

try {
  results.portOwnershipBefore = ownership(); await portFree();
  server = spawn('npm', ['run', 'dev:worktree', '--', '--host', host, '--port', String(port)], {
    cwd: root, detached: true, env: { ...process.env, VITE_CACHE_DIR: cache }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  results.serverPid = server.pid;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Owned Vite ready signal timeout')), 90000);
    const data = chunk => { serverLog = (serverLog + chunk).slice(-16000); if (serverLog.includes(`${host}:${port}`)) { clearTimeout(timer); resolve(); } };
    server.stdout.on('data', data); server.stderr.on('data', data);
    server.once('error', reject); server.once('exit', (code, signal) => { clearTimeout(timer); reject(new Error(`Owned server exited ${code}/${signal}`)); });
  });
  results.portOwnershipRunning = ownership();
  const listener = results.portOwnershipRunning.split('\n').find(line => line.includes(`${host}:${port}`)); assert.ok(listener, 'Owned address must be listening');
  const pid = listener.match(/pid=(\d+)/)?.[1]; assert.ok(pid);
  assert.equal(Number(execFileSync('ps', ['-o', 'pgid=', '-p', pid], { encoding: 'utf8' }).trim()), server.pid, 'Listener must belong to this runner process group');
  browser = await firefox.launch(); results.browserVersion = browser.version();
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.routeWebSocket('**/*', socket => socket.close());
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === base && ['GET', 'HEAD'].includes(request.method())) {
      try {
        const response = await route.fetch({ url: request.url().replace(base, target), timeout: 120000, maxRedirects: 0, maxRetries: 0 });
        assert.ok(response.url().startsWith(`${target}/`)); assert.ok(response.status() < 300 || response.status() >= 400, 'Redirects may not escape owned transport');
        await route.fulfill({ response });
      } catch (error) {
        if (closing) results.cleanup.cancelledInflightTransports = (results.cleanup.cancelledInflightTransports ?? 0) + 1;
        else { results.errors.push(`Owned transport: ${url.pathname}: ${error.message}`); await route.abort(); }
      }
      return;
    }
    const key = { origin: url.origin, pathname: url.pathname, method: request.method() };
    const existing = results.blockedRequests.find(entry => Object.keys(key).every(k => entry[k] === key[k]));
    if (existing) existing.count++;
    else if (results.blockedRequests.length < 40) results.blockedRequests.push({ ...key, count: 1 });
    else results.errors.push('Blocked-request summary overflow');
    await route.abort('blockedbyclient');
  });
  await context.addInitScript(() => {
    if (location.protocol !== 'http:') return;
    localStorage.setItem('oprn:editor-ui-mode', 'expert'); localStorage.setItem('rpg-zzu:editor-ui-mode', 'expert'); localStorage.setItem('oprn:ai-consent', 'accepted');
  });
  page = await context.newPage(); page.setDefaultTimeout(45000);
  page.on('pageerror', error => { if (results.errors.length < 40) results.errors.push(error.message); });
  await page.goto(`${base}/?freshProject=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await armDOM(`document.querySelector('[data-testid="edit-canvas"]') && window.__oprnEditorStore`); await domDone();
  for (const [button, overlay] of [['login-guest', 'login-modal'], ['standard-welcome-start', 'standard-welcome-card'], ['coach-mark-skip', 'coach-mark-skip']]) {
    if (!(await page.getByTestId(button).isVisible())) continue;
    await armDOM(`!document.querySelector('[data-testid="${overlay}"]')`); await page.getByTestId(button).click(); await domDone();
  }
  results.persistence = await page.evaluate(() => ({ identity: window.__oprnEditorStore.getProjectIdentity(), remoteEnabled: window.__oprnEditorStore.isRemotePersistenceEnabled() }));
  assert.equal(results.persistence.remoteEnabled, false);
  await page.evaluate(() => {
    window.__qaMeasure = () => {
      const workspace = document.querySelector('[data-testid="db-monster-species-workspace"]'); if (!workspace) return { speciesMounted: false };
      const row = workspace.querySelector('[data-record-id][aria-pressed="true"]'), list = workspace.querySelector('.db-ws-list');
      const r = row?.getBoundingClientRect(), lr = list.getBoundingClientRect(), hit = r && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      const id = row?.dataset.recordId, record = window.__oprnEditorStore.getCurrent().database.monsterSpecies.find(record => record.id === id);
      return { id, scrollTop: list.scrollTop, rowTop: r?.top, rowBottom: r?.bottom, listTop: lr.top, listBottom: lr.bottom,
        visible: !!r && r.top >= lr.top - 1 && r.bottom <= lr.bottom + 1, hit: !!row && (hit === row || row.contains(hit)),
        selectedId: window.__qaSpecies?.getSelectedMonsterSpeciesId(), hero: workspace.querySelector('.db-ws-hero-sub')?.textContent,
        inspectorMatches: workspace.querySelector('[data-testid="db-monster-species-name"]')?.value === record?.name,
        selectedCount: workspace.querySelectorAll('[data-record-id][aria-pressed="true"]').length,
        toolbar: ['add', 'duplicate', 'delete'].map(action => {
          const button = workspace.querySelector(`[data-testid="db-monster-species-${action}"]`), br = button.getBoundingClientRect();
          const h = document.elementFromPoint(br.x + br.width / 2, br.y + br.height / 2);
          return { action, enabled: !button.disabled, hit: h === button || button.contains(h) };
        }), search: workspace.querySelector('[data-testid="db-monster-species-search"]').value };
    };
  });
  await armDOM(`document.querySelector('[data-testid="database-modal"]')`); await page.getByTestId('toolbar-database').click(); await domDone();
  matrix: for (const viewport of [{ width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }]) for (const kind of ['linked', 'add', 'duplicate', 'from-enemy']) {
    const { width } = viewport;
    phase = `${width}-${kind}`; console.log(`RUN ${phase}`);
    await page.setViewportSize(viewport);
    const startDefects = results.defects.length, fixture = await seed(kind), originalDatabase = await database();
    await tab(kind === 'linked' || kind === 'from-enemy' ? 'enemies' : 'monster-species');
    if (kind === 'linked' || kind === 'from-enemy') await page.getByTestId('db-enemy-section-basic-tab').click();
    if (kind === 'linked') {
      await armStore('project.database.enemies[0].name === "QA Edited Enemy"'); await page.getByTestId('db-field-name').fill('QA Edited Enemy'); await storeDone();
    }
    const beforeAction = await snapshot(), beforeActionDatabase = await database(), writesBefore = await changeCount();
    await armRenders(); if (kind !== 'linked') await armStore('project.database.monsterSpecies.length === 102');
    const action = kind === 'linked' ? 'db-enemy-open-species' : kind === 'from-enemy' ? 'db-enemy-create-species' : `db-monster-species-${kind}`;
    await page.getByTestId(action).click(); if (kind !== 'linked') await storeDone();
    const refresh = await refreshDone(), expected = await page.evaluate(() => window.__oprnEditorStore.getCurrent().database.monsterSpecies.at(-1).id);
    check(refresh.final.visible && refresh.final.hit, 'selected-species-hidden-after-modal-refresh', refresh);
    check(refresh.final.id === expected && refresh.final.selectedId === expected && refresh.final.hero === expected && refresh.final.inspectorMatches
      && refresh.final.selectedCount === 1 && refresh.final.search === '', 'selection-inspector-disagree', refresh.final);
    check(refresh.final.toolbar.every(button => button.enabled && button.hit), 'toolbar-unreachable', refresh.final.toolbar);
    assert.equal(await changeCount() - writesBefore, kind === 'linked' ? 0 : 1, 'Navigation adds no writes; creation is one atomic write');
    if (kind === 'linked') assert.equal(await snapshot(), beforeAction, 'Navigation must preserve exact project bytes');
    const after = JSON.parse(await database()), before = JSON.parse(beforeActionDatabase);
    if (kind === 'duplicate') {
      const { id: copyId, name: copyName, ...copy } = after.monsterSpecies.at(-1), { id: sourceId, name: sourceName, ...source } = before.monsterSpecies[0];
      assert.notEqual(copyId, sourceId); assert.notEqual(copyName, sourceName); assert.deepEqual(copy, source, 'Toolbar duplicates the selected source');
    }
    if (kind === 'from-enemy') {
      assert.equal(after.enemies[0].speciesId, expected); assert.equal(after.monsterSpecies.at(-1).name, before.enemies[0].name);
      assert.deepEqual(after.monsterSpecies.at(-1).baseStats, before.enemies[0].stats);
    }
    const screenshot = `${phase}.png`; await page.locator('.database-modal-window').screenshot({ path: resolve(out, screenshot), animations: 'disabled' });
    if (process.env.MONSTER_QA_BASELINE === '1' && results.defects.length > startDefects) {
      results.actions.push({ phase, viewport, passed: false, fixture, expected, refresh, navigationAddedWrites: kind === 'linked' ? 0 : undefined,
        screenshot, screenshotHash: digest(readFileSync(resolve(out, screenshot))), stoppedAtFirstProductDefect: true });
      break matrix;
    }
    const scroll = await userScroll(), atomicUndo = await undo(kind === 'linked' ? originalDatabase : beforeActionDatabase);
    assert.equal(await page.evaluate(() => window.__qaHistory.getMapEditHistoryState().canUndo), false, 'No extra undo entries');
    results.actions.push({ phase, viewport, passed: results.defects.length === startDefects, fixture, expected, refresh, actionWrites: kind === 'linked' ? 0 : 1,
      navigationAddedWrites: kind === 'linked' ? 0 : undefined, scroll, atomicUndo, screenshot, screenshotHash: digest(readFileSync(resolve(out, screenshot))) });
    save('actions.json', results); console.log(`${results.defects.length === startDefects ? 'PASS' : 'FAIL'} ${phase}`);
  }
  if (process.env.MONSTER_QA_BASELINE !== '1') assert.equal(results.actions.length, 12);
  results.status = results.defects.length ? 'product-defects' : 'passed';
} catch (error) {
  results.status = 'runner-error'; results.failure = { phase, message: error.message, stack: error.stack }; console.error(error);
} finally {
  closing = true;
  if (context) { await context.close(); results.cleanup.browserContextClosed = true; }
  if (browser) { await browser.close(); results.cleanup.browserClosed = !browser.isConnected(); }
  if (server && server.exitCode === null && server.signalCode === null) {
    const exited = once(server, 'close'); process.kill(-server.pid, 'SIGTERM'); results.cleanup.serverExit = await exited;
  }
  if (server) {
    try { await portFree(); results.cleanup.ownedAddressReleased = true; }
    catch (error) { results.cleanup.ownedAddressReleased = false; results.errors.push(`Cleanup: ${error.message}`); }
  }
  rmSync(cache, { recursive: true, force: true }); results.cleanup.cacheRemoved = true; results.cleanup.portOwnershipAfter = ownership();
  results.cleanup.sourceHashesStable = JSON.stringify(hashes()) === JSON.stringify(results.sourceHashes);
  results.network = { forwardedTarget: target, externalRequestsForwarded: 0, webSocketsBlocked: true,
    supabaseWriteAttempts: results.blockedRequests.filter(r => r.origin.includes('supabase') && !['GET', 'HEAD', 'OPTIONS'].includes(r.method)) };
  if (!results.cleanup.sourceHashesStable || results.errors.length || results.network.supabaseWriteAttempts.length) results.status = 'runner-error';
  results.finished = new Date().toISOString(); results.exitCode = results.status === 'passed' ? 0 : 1;
  save('actions.json', results); save('cleanup.json', results.cleanup); save('qa-server.log', serverLog); save('qa-script.exit', `${results.exitCode}\n`);
  console.log(JSON.stringify({ status: results.status, actions: results.actions.length, defects: results.defects.length, failure: results.failure, cleanup: results.cleanup }, null, 2));
  process.exitCode = results.exitCode;
}

