#!/usr/bin/env node
// Real editor QA only. No authored fixture is persisted remotely.
// Reuses the proven Phase 1 Firefox localhost -> owned loopback transport.
// Product code is read-only; fixture writes stay in the disposable local store.
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
const out = resolve(root, process.env.MONSTER_QA_OUTPUT ?? 'output/evidence/monster-concepts/p2');
const host = '127.0.0.7';
const port = 9841;
// The dev-project gate recognizes localhost, not arbitrary loopback aliases.
// Route localhost requests to the owned Vite address without changing product code.
const base = `http://localhost:${port}`;
mkdirSync(out, { recursive: true });
const results = { task: process.env.MONSTER_QA_RUN ?? 'manual', base, started: new Date().toISOString(), driver: 'Playwright Firefox; proven Phase 1 routing', actions: [], layouts: [], defects: [], errors: [], blockedRequests: [], cleanup: {} };
const save = (name, value) => writeFileSync(resolve(out, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
const sourceFiles = ['src/editor/panels/database.ts', 'src/editor/panels/databaseEnemyRecordView.ts', 'src/editor/panels/databaseMonsterSpeciesView.ts', 'src/editor/panels/databaseRecordViewSession.ts', 'src/editor/panels/databaseRecordViews.ts', 'src/styles/database/desktop-record-shell/11-life-authoring.css', 'DESIGN.md', 'openwiki/editor-database.md', 'test/databaseSpeciesSearchNavigation.test.ts', 'src/editor/panels/databaseListVirtualizer.ts', 'src/styles/database/enemies.part-2.css', 'test/databaseListGeometry.test.ts'];
results.head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const digest = value => createHash('sha256').update(value).digest('hex');
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
const record = (name, data = {}) => { const passed = !results.defects.some(defect => defect.phase === name); results.actions.push({ name, passed, ...data }); save('actions.json', results); console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`); };
const check = (ok, detail) => {
  if (ok) return;
  results.defects.push({ phase, ...detail });
  throw new Error(`Product assertion failed in ${phase}: ${JSON.stringify(detail)}`);
};
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
      observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
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
const snapshot = () => page.evaluate(() => JSON.stringify(window.__oprnEditorStore.getCurrent()));
const changes = () => page.evaluate(() => window.__qaChanges);
const history = () => page.evaluate(() => window.__qaHistory.getMapEditHistoryState());
const selectedId = 'qa-species-selected';
const otherId = 'qa-species-other';
const referrerId = 'qa-species-referrer';
const enemyId = 'qa-enemy-target';
async function seed() {
  const fixture = await page.evaluate(async ({ selectedId, otherId, referrerId, enemyId }) => {
    const store = window.__oprnEditorStore;
    const { normalizeMonsterSpeciesRecord } = await import('/src/project/monsterCollection.ts');
    const { normalizeEnemyRecord } = await import('/src/project/databaseEnemyTroopRecordModel.ts');
    const session = await import('/src/editor/panels/databaseRecordViewSession.ts');
    window.__qaHistory = await import('/src/editor/mapEditHistory.ts');
    window.__qaUnsubscribe?.();
    window.__qaOriginal ??= structuredClone(store.getCurrent());
    store.update(project => {
      project.database = structuredClone(window.__qaOriginal.database);
      project.system.monsterCollection = true;
      const original = project.database.enemies[0];
      project.database.enemies = [
        ...Array.from({ length: 100 }, (_, index) => normalizeEnemyRecord({ ...original, id: `qa-filler-${index}`, name: `QA Filler ${index}`, speciesId: undefined })),
        normalizeEnemyRecord({ ...original, id: enemyId, name: 'QA Target Enemy', speciesId: selectedId }),
      ];
      const graphic = { monsterResourceId: original.monsterResourceId, graphicHue: 0, transparent: false, flying: false };
      project.database.monsterSpecies = [
        normalizeMonsterSpeciesRecord({ id: selectedId, name: 'QA Selected 종족', graphic, baseStats: { ...original.stats, maxHp: 321 } }),
        normalizeMonsterSpeciesRecord({ id: otherId, name: 'QA Other 종족', graphic }),
        normalizeMonsterSpeciesRecord({ id: referrerId, name: 'QA Referrer 종족', graphic, baseStats: { ...original.stats, maxHp: 765 }, evolutions: [{ toSpeciesId: selectedId, requires: { level: 20 } }] }),
      ];
    }, { scope: 'database', collection: 'enemies', label: 'Disposable Phase 2 QA seed' });
    session.setViewModeForCollection('enemies', 'list');
    session.setSearchQueryForCollection('enemies', '');
    session.setSelectedRecordId('enemies', enemyId, { reveal: true });
    window.__qaHistory.resetMapEditHistory();
    window.__qaChanges = [];
    window.__qaUnsubscribe = store.subscribe((_project, change) => window.__qaChanges.push(change));
    return { speciesIds: projectIds(store.getCurrent().database.monsterSpecies), enemyId, enemyCount: 101, remoteEnabled: store.isRemotePersistenceEnabled() };
    function projectIds(records) { return records.map(record => record.id); }
  }, { selectedId, otherId, referrerId, enemyId });
  assert.equal(fixture.remoteEnabled, false);
  await tab('enemies');
  await page.getByTestId('db-enemy-section-basic-tab').click();
  await tab('monster-species');
  await page.getByTestId('db-monster-species-search').fill('');
  await page.getByTestId(`db-monster-species-row-${selectedId}`).click();
  return fixture;
}
const activeSpecies = id => `document.querySelector('[data-testid="db-monster-species-row-${id}"]')?.getAttribute('aria-pressed') === 'true' && document.querySelector('[data-testid="db-monster-species-hero"] .db-ws-hero-sub')?.textContent === '${id}'`;
async function speciesSelected(id) {
  assert.equal(await page.getByTestId(`db-monster-species-row-${id}`).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('[data-testid="db-monster-species-hero"] .db-ws-hero-sub').textContent(), id);
  assert.equal(await page.getByTestId('db-monster-species-search').inputValue(), '');
  return reachable(`db-monster-species-row-${id}`, false);
}
async function speciesSearch(value, count) {
  await armDOM(`document.querySelectorAll('.oprn-record-monster-species .db-list-row').length === ${count}`);
  await page.getByTestId('db-monster-species-search').fill(value); await domDone();
  assert.equal(await page.getByTestId('db-monster-species-search').inputValue(), value);
}
async function navigate(id, expression) {
  const hit = await reachable(id);
  assert.equal(hit.hit, true);
  await armDOM(expression); await page.getByTestId(id).click(); await domDone();
  return hit;
}
async function unchanged(before) {
  const after = await snapshot();
  assert.equal(after, before, 'Navigation/filtering must not mutate project bytes');
  assert.equal((await changes()).length, 0);
  assert.equal((await history()).canUndo, false);
  return { projectHash: digest(after), storeUpdates: 0, canUndo: false, projectByteEquivalent: true };
}
async function armEnemyScrollEnd() {
  await page.evaluate(() => {
    window.__qaScrollEnd = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { document.removeEventListener('scrollend', listener, true); reject(new Error('Enemy reveal scrollend timeout')); }, 15000);
      function listener(event) {
        if (!(event.target instanceof Element) || !event.target.matches('.oprn-record-enemies .db-list')) return;
        document.removeEventListener('scrollend', listener, true); clearTimeout(timer);
        // Cross the next rendering boundary after scrollend, so native scroll
        // handlers and ResizeObserver layout work cannot leave a transient pass.
        // This is an event/render fence, not a sleep or a polling retry.
        const list = event.target;
        requestAnimationFrame(() => resolve({ event: 'scrollend', renderBoundary: true, scrollTop: list.scrollTop }));
      }
      document.addEventListener('scrollend', listener, true);
    });
    window.__qaScrollEnd.catch(() => {});
  });
}
const hitExpression = id => `(() => { const n = document.querySelector('[data-testid="${id}"]'); if (!n) return false; const r = n.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return r.width > 20 && r.height > 15 && (hit === n || n.contains(hit)); })()`;
async function reachable(id, scroll = true) {
  if (scroll) await page.getByTestId(id).scrollIntoViewIfNeeded();
  // Resolve and measure atomically: virtualizer scroll events replace row nodes.
  const facts = await page.evaluate(id => {
    const node = document.querySelector(`[data-testid="${id}"]`);
    if (!node) return { id, hit: false, missing: true };
    const r = node.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { id: node.dataset.testid, connected: node.isConnected, pressed: node.getAttribute('aria-pressed'), tag: node.tagName, text: node.innerText, ariaLabel: node.getAttribute('aria-label'), labels: [...(node.labels ?? [])].map(l => l.innerText), width: r.width, height: r.height, x: r.x, y: r.y, hit: hit === node || node.contains(hit), tabIndex: node.tabIndex, disabled: node.disabled ?? false };
  }, id);
  check(facts.hit && facts.width > 20 && facts.height > 15, { kind: 'reachability', facts });
  return facts;
}
async function capture(name) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].filter(i => i.getBoundingClientRect().width && !i.complete).map(i => new Promise(resolve => { i.addEventListener('load', resolve, { once: true }); i.addEventListener('error', resolve, { once: true }); })));
  });
  await page.screenshot({ path: resolve(out, name), animations: 'disabled' });
  results.screenshots ??= [];
  results.screenshots.push({ file: name, sha256: digest(readFileSync(resolve(out, name))), viewport: page.viewportSize() });
}
async function geometry(view, viewport) {
  const facts = await page.evaluate(() => {
    const selectors = ['html', '.database-modal-window', '.database-modal-body', '.db-body', '.oprn-record-enemies', '.db-enemy-studio', '.db-enemy-inspector', '.oprn-record-monster-species', '.db-ws-detail-body', '.db-life-header', '[data-testid="db-monster-species-selection-notice"]'];
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
    const blocked = results.blockedRequests.find(entry => entry.origin === url.origin && entry.pathname === url.pathname && entry.method === request.method());
    if (blocked) blocked.count += 1;
    else results.blockedRequests.push({ origin: url.origin, pathname: url.pathname, method: request.method(), count: 1 });
    return route.abort('blockedbyclient');
  });
  // Do not archive raw Vite responses: import.meta.env can contain credentials.
  await context.addInitScript(() => {
    if (location.protocol !== 'http:') return;
    localStorage.setItem('oprn:editor-ui-mode', 'expert');
    localStorage.setItem('rpg-zzu:editor-ui-mode', 'expert');
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

  for (const viewport of [{ width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
    const size = `${viewport.width}x${viewport.height}`;
    phase = `${size}-search-context`;
    await page.setViewportSize(viewport);
    const fixture = await seed();
    const before = await snapshot();
    await geometry('species-normal', viewport); await capture(`${size}-normal.png`);
    await page.getByTestId('db-monster-species-preview-level').fill('37');
    await page.getByTestId('db-monster-species-search').focus();
    await page.evaluate(() => {
      const get = id => document.querySelector(`[data-testid="${id}"]`);
      window.__qaNodes = { search: get('db-monster-species-search'), inspector: get('db-detail-form'), name: get('db-monster-species-name'), preview: get('db-monster-species-preview-level') };
      window.__qaNodes.body = window.__qaNodes.inspector.querySelector('.db-ws-detail-body');
      window.__qaNodes.scrollTop = window.__qaNodes.body.scrollTop;
    });
    // Native keystrokes; inspect the same active node and caret after every event.
    const caret = [];
    for (const char of 'Other') {
      await page.keyboard.type(char);
      const facts = await page.evaluate(() => {
        const n = window.__qaNodes;
        return { value: n.search.value, caret: n.search.selectionStart, active: document.activeElement === n.search, sameSearch: document.querySelector('[data-testid="db-monster-species-search"]') === n.search, sameInspector: document.querySelector('[data-testid="db-detail-form"]') === n.inspector, sameName: document.querySelector('[data-testid="db-monster-species-name"]') === n.name, preview: n.preview.value, scrollTop: n.body.scrollTop, originalScrollTop: n.scrollTop };
      });
      assert.equal(facts.active && facts.sameSearch && facts.sameInspector && facts.sameName, true);
      assert.equal(facts.caret, facts.value.length); assert.equal(facts.preview, '37'); assert.equal(facts.scrollTop, facts.originalScrollTop);
      caret.push({ length: facts.value.length, caret: facts.caret });
    }
    assert.equal(await page.locator('.oprn-record-monster-species .db-list-row').count(), 1);
    assert.equal(await page.getByTestId(`db-monster-species-row-${otherId}`).count(), 1);
    assert.equal(await page.getByTestId('db-monster-species-selection-notice').getAttribute('data-record-id'), selectedId);
    assert.equal(await page.getByTestId('db-monster-species-selection-notice').isVisible(), true);
    await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight'); await page.keyboard.type('X');
    assert.equal(await page.getByTestId('db-monster-species-search').evaluate(n => /** @type {HTMLInputElement} */ (n).selectionStart), 2);
    await page.keyboard.press('Backspace');
    assert.equal(await page.getByTestId('db-monster-species-search').evaluate(n => /** @type {HTMLInputElement} */ (n).selectionStart), 1);
    const revealHit = await navigate('db-monster-species-reveal-selection', `document.querySelectorAll('.oprn-record-monster-species .db-list-row').length === 3`);
    await speciesSelected(selectedId);
    await geometry('species-reveal', viewport); await capture(`${size}-reveal.png`);
    await speciesSearch('no-species-match', 0);
    const noMatchHit = await reachable('db-monster-species-empty-clear');
    const noticeHit = await reachable('db-monster-species-reveal-selection');
    assert.equal(await page.getByTestId('db-monster-species-selection-notice').isVisible(), true);
    assert.equal(await page.locator('[data-testid="db-monster-species-hero"] .db-ws-hero-sub').textContent(), selectedId);
    await geometry('species-no-match', viewport); await capture(`${size}-no-match.png`);
    await navigate('db-monster-species-empty-clear', `document.querySelectorAll('.oprn-record-monster-species .db-list-row').length === 3`);
    await speciesSelected(selectedId);
    const retained = await page.evaluate(() => ({ inspector: window.__qaNodes.inspector === document.querySelector('[data-testid="db-detail-form"]'), search: window.__qaNodes.search === document.activeElement, preview: window.__qaNodes.preview.value }));
    assert.deepEqual(retained, { inspector: true, search: true, preview: '37' });
    record(phase, { fixture, caret, middleCaret: [2, 1], retained, revealHit, noMatchHit, noticeHit, ...await unchanged(before) });

    phase = `${size}-enemy-to-species`;
    await speciesSearch('Other', 1); await tab('enemies');
    await page.getByTestId('db-enemy-section-basic-tab').click();
    const openSpeciesHit = await navigate('db-enemy-open-species', activeSpecies(selectedId));
    const speciesHit = await speciesSelected(selectedId);
    await geometry('enemy-to-species', viewport);
    record(phase, { sourceEnemyId: enemyId, targetSpeciesId: selectedId, staleQuery: 'Other', openSpeciesHit, speciesHit, ...await unchanged(before) });

    // Both virtualized presentations must reveal the 101st enemy, not the stale selection.
    for (const mode of ['list', 'gallery']) {
      phase = `${size}-species-to-enemy-${mode}`;
      await tab('enemies');
      await page.getByTestId(`db-view-toggle-${mode}`).click();
      const enemySearch = page.locator('.oprn-record-enemies .db-search input');
      await armDOM(`document.querySelector('[data-testid="db-record-${mode === 'list' ? 'row' : 'card'}-qa-filler-0"]')`);
      await enemySearch.fill('QA Filler 0'); await domDone();
      await page.getByTestId(`db-record-${mode === 'list' ? 'row' : 'card'}-qa-filler-0`).click();
      await armDOM(`document.querySelector('[data-testid="db-record-list-empty-clear"]')`);
      await enemySearch.fill('no-enemy-match'); await domDone();
      await tab('monster-species');
      const targetTestId = `db-record-${mode === 'list' ? 'row' : 'card'}-${enemyId}`;
      await armEnemyScrollEnd();
      const linkHit = await navigate(`db-monster-species-open-enemy-${enemyId}`, `document.querySelector('[data-testid="${targetTestId}"]')?.getAttribute('aria-pressed') === 'true' && ${hitExpression(targetTestId)}`);
      const revealScrollEnd = await page.evaluate(() => window.__qaScrollEnd);
      assert.equal(await page.locator('.oprn-record-enemies .db-search input').inputValue(), '');
      assert.equal(await page.getByTestId('db-field-name').inputValue(), 'QA Target Enemy');
      const targetHit = await reachable(targetTestId, false);
      check(targetHit.hit && targetHit.connected && targetHit.pressed === 'true', { kind: 'related-target-reveal', targetTestId, revealScrollEnd, targetHit });
      const virtual = await page.locator('.oprn-record-enemies .db-list').evaluate(n => ({ scrollTop: n.scrollTop, clientHeight: n.clientHeight, scrollHeight: n.scrollHeight, renderedRecords: n.querySelectorAll('[data-record-id]').length }));
      assert.ok(virtual.scrollTop > 0);
      assert.ok(virtual.renderedRecords > 0 && virtual.renderedRecords < 101, 'Enemy reveal must retain virtualization');
      await geometry(`species-to-enemy-${mode}`, viewport);
      await capture(`${size}-navigation-enemy-${mode}.png`);
      const finalTargetHit = await reachable(targetTestId, false);
      const finalScrollTop = await page.locator('.oprn-record-enemies .db-list').evaluate(n => n.scrollTop);
      check(finalTargetHit.connected && finalTargetHit.pressed === 'true' && finalTargetHit.hit, { kind: 'final-related-target-reveal', targetTestId, finalTargetHit });
      assert.equal(finalScrollTop, virtual.scrollTop, 'Reveal scroll must remain settled through capture');
      record(phase, { sourceSpeciesId: selectedId, targetEnemyId: enemyId, index: 100, mode, priorEnemyId: 'qa-filler-0', staleQuery: 'no-enemy-match', linkHit, targetHit, finalTargetHit, finalScrollTop, revealScrollEnd, inspectorMatches: true, virtual, ...await unchanged(before) });
      await navigate('db-enemy-open-species', activeSpecies(selectedId));
    }
    phase = `${size}-evolution-referrer`;
    await speciesSearch('Selected', 1);
    const backlinkHit = await navigate(`db-monster-species-open-referrer-${referrerId}`, activeSpecies(referrerId));
    const referrerHit = await speciesSelected(referrerId);
    assert.equal(await page.getByTestId('db-monster-species-name').inputValue(), 'QA Referrer 종족');
    await geometry('evolution-referrer', viewport); await capture(`${size}-navigation-referrer.png`);
    await speciesSelected(referrerId);
    record(phase, { previousSpeciesId: selectedId, targetSpeciesId: referrerId, backlinkHit, referrerHit, immediateDOMSignal: true, ...await unchanged(before) });

    if (viewport.width === 1440) {
      phase = 'post-backlink-toolbar-duplicate';
      const beforeDuplicate = JSON.parse(await snapshot());
      await armStore();
      await armDOM(`document.querySelectorAll('.oprn-record-monster-species .db-list-row').length === 4`);
      await page.getByTestId('db-monster-species-duplicate').click(); await storeDone(); await domDone();
      const after = JSON.parse(await snapshot());
      const created = after.database.monsterSpecies.at(-1);
      const referrer = beforeDuplicate.database.monsterSpecies.find(s => s.id === referrerId);
      assert.notEqual(created.id, referrerId);
      assert.equal(created.name, `${referrer.name} 사본`);
      assert.deepEqual({ ...created, id: referrer.id, name: referrer.name }, referrer);
      assert.deepEqual(after.database.monsterSpecies.slice(0, -1), beforeDuplicate.database.monsterSpecies);
      assert.deepEqual({ ...after, database: { ...after.database, monsterSpecies: beforeDuplicate.database.monsterSpecies } }, beforeDuplicate);
      await speciesSelected(created.id);
      assert.equal((await changes()).length, 1);
      await page.getByTestId('db-tab-monster-species').focus();
      await armStore(); await page.keyboard.press('Control+z'); await storeDone();
      assert.equal(await snapshot(), before); assert.equal((await history()).canUndo, false);
      record(phase, { targetId: referrerId, createdId: created.id, copiedTargetNotPrevious: true, onlyOneRecordAdded: true, storeUpdatesBeforeUndo: 1, oneKeyboardUndoRestoresProject: true, restoredProjectHash: digest(await snapshot()) });
    }
  }
  results.sourceHashesAfter = hashes();
  assert.deepEqual(results.sourceHashesAfter, results.sourceHashes, 'Rendered source changed during QA');
  results.sourceHashesStable = true;
  results.network = { forwardedOrigin: base, forwardedTarget: `http://${host}:${port}`, externalRequestsForwarded: 0, remotePersistenceEnabled: false, blockedWriteAttempts: results.blockedRequests.filter(r => !['GET', 'HEAD', 'OPTIONS'].includes(r.method)) };
  assert.equal(results.blockedRequests.filter(r => r.origin.includes('supabase') && !['GET', 'HEAD', 'OPTIONS'].includes(r.method)).length, 0, 'Unexpected attempted Supabase write');
  check(results.errors.length === 0, { kind: 'pageerror', errors: results.errors });
  results.status = results.defects.length ? 'product-defects' : 'passed';
} catch (error) {
  results.status = 'failed'; results.failure = { phase, message: error.message, stack: error.stack };
  console.error(error);
  if (page && !page.isClosed()) results.failure.dom = await page.evaluate(() => ({ activeTab: document.querySelector('.db-tab.active')?.getAttribute('data-testid'), search: document.querySelector('.oprn-record-enemies .db-search input')?.value, targets: [...document.querySelectorAll('[data-record-id="qa-enemy-target"]')].map(n => ({ testid: n.dataset.testid, connected: n.isConnected, pressed: n.getAttribute('aria-pressed'), rect: n.getBoundingClientRect().toJSON(), ancestors: [...function*(n) { while (n && n !== document.body) { yield n; n = n.parentElement; } }(n)].map(a => ({ class: a.className, display: getComputedStyle(a).display, scrollTop: a.scrollTop, height: a.clientHeight })) })) }));
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
  results.cleanup.sourceHashesStable = JSON.stringify(hashes()) === JSON.stringify(results.sourceHashes);
  if (!results.cleanup.sourceHashesStable || results.errors.length) results.status = 'failed';
  results.finished = new Date().toISOString();
  results.exitCode = results.status === 'passed' ? 0 : 1;
  save('actions.json', results); save('qa-script.exit', `${results.exitCode}\n`);
  save('cleanup.json', results.cleanup);
  save('qa-server.log', serverLog);
  console.log(JSON.stringify({ status: results.status, actions: results.actions.length, defects: results.defects, cleanup: results.cleanup }, null, 2));
  process.exitCode = results.exitCode;
}
