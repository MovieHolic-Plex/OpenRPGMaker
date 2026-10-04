// Isolated exported-player admission matrix. No authored project or content DB writes.
// Run from this worktree: TMPDIR=$PWD/.scratch node scripts/qa/runtime/event-battle-reliability.probe.mjs
// QA_BASE_URL may target a lead-owned player-QA server; otherwise an ephemeral server is owned here.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, firefox } from '@playwright/test';
import { startPlayerQaServer, performObservedAction } from '../../lib/runtimeQaRun.mjs';

const out = resolve(process.env.QA_OUT_DIR ?? 'verify-shots/runtime-qa/event-battle-reliability');
const seed = JSON.parse(await readFile(new URL('../../../test/fixtures/projects/battle-v3.json', import.meta.url), 'utf8'));
const cases = [
  ...['action', 'auto', 'parallel'].flatMap(trigger => [
    { id: `invalid-variable-${trigger}`, trigger, invalid: 'variable' },
    { id: `valid-${trigger}`, trigger },
  ]),
  { id: 'empty-troop', trigger: 'action', invalid: 'troop' },
  { id: 'empty-monster-party', trigger: 'action', invalid: 'party' },
  { id: 'hidden-enemies', trigger: 'action', hidden: true },
  { id: 'legacy-enemy-ids', trigger: 'action', legacy: true },
  { id: 'numeric-zero-alias', trigger: 'action', variable: 0 },
];
function fixture(test) {
  const project = structuredClone(seed);
  const map = project.maps[project.startMapId];
  const troop = project.database.troops[0];
  project.commonEvents = [];
  project.system.battleFlow = 'strict';
  project.system.battleUiStyle = 'retro2003';
  project.variables = [{ id: 'selectedTroop', name: 'Selected troop' }];
  project.session.variables = { selectedTroop: test.invalid === 'variable' ? 999999 : (test.variable ?? 1) };
  project.session.monsterParty = [];
  project.session.monsterInstances = {};
  map.bgm = { mode: 'custom', resourceId: 'cc0-bgm-rtp-fld-003' };
  troop.battleEventPages = [];
  if (test.invalid === 'troop') { troop.members = []; troop.enemyIds = []; }
  if (test.invalid === 'party') project.system.battleParty = 'monsters';
  if (test.hidden) troop.members = troop.enemyIds.map(enemyId => ({ enemyId, x: 30, y: 80, hidden: true }));
  if (test.legacy) delete troop.members;
  const battle = { kind: 'battleProcessing', troopId: troop.id, canEscape: true, canLose: false,
    ...(test.invalid === 'variable' || test.variable !== undefined ? { troopSource: 'variable', troopVariableId: 'selectedTroop' } : {}),
    branchOnResult: true,
    victoryBranch: [{ kind: 'setFlag', flag: 'outcomeBranch', value: true }],
    defeatBranch: [{ kind: 'setFlag', flag: 'outcomeBranch', value: true }],
    escapeBranch: [{ kind: 'setFlag', flag: 'outcomeBranch', value: true }],
  };
  map.events = [{ id: 'battle-start', x: 1, y: 0, trigger: { kind: test.trigger }, commands: [], pages: [{
    id: 'battle-page', name: 'Admission', conditions: [], graphic: {}, priority: 'same',
    movement: { type: 'fixed', speed: 3, frequency: 3 }, trigger: { kind: test.trigger },
    commands: [battle, { kind: 'setFlag', flag: 'afterBattle', value: true }],
  }] }];
  // A real second event corrects the runtime variable, not a debug-state mutation.
  if (test.invalid === 'variable' && test.trigger === 'action') map.events.push({
    id: 'repair-variable', x: 0, y: 0, trigger: { kind: 'action' }, commands: [], pages: [{
      id: 'repair-page', name: 'Repair', conditions: [], graphic: {}, priority: 'below',
      movement: { type: 'fixed', speed: 3, frequency: 3 }, trigger: { kind: 'action' },
      commands: [{ kind: 'setVariable', variableId: 'selectedTroop', op: '=', value: 1 }],
    }],
  });
  return project;
}

// Subscribe before each trigger. Only DOM/state mutations wake the observer; no polling or sleeps.
async function observe(page, kind) {
  return await page.evaluateHandle(({ kind, timeout }) => {
    let cancel;
    const promise = new Promise(resolveObservation => {
      const finish = result => { observer.disconnect(); clearTimeout(deadline); resolveObservation(result); };
      const check = () => {
        const title = document.querySelector('[data-testid="title-screen"]');
        const mirror = document.querySelector('[data-testid="runtime-state-json"]');
        const state = mirror?.textContent ? JSON.parse(mirror.textContent) : null;
        const error = document.querySelector('[data-testid="runtime-error"]');
        const battle = document.querySelector('[data-testid="battle-scene"]');
        const ready = state && !title && window.__oprnInput;
        if (kind === 'title' && title) finish({ ok: true });
        if (kind === 'ready' && ready) finish({ ok: true, state });
        const command = battle?.querySelector('[data-testid="actor-command-defend"]');
        const transition = document.querySelector('[data-testid="battle-transition-overlay"]');
        if (kind === 'battle' && ready && command && !transition) finish({ ok: true, state });
        if (kind === 'error' && ready && error && !battle && state.inputEnabled && !state.running) {
          finish({ ok: true, state, message: error.textContent });
        }
      };
      const observer = new MutationObserver(check);
      const deadline = setTimeout(() => finish({ ok: false, error: `Missing ${kind} observation` }), timeout);
      cancel = () => finish({ ok: false, error: 'Observation cancelled' });
      observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true });
      check();
    });
    return { promise, cancel: () => cancel() };
  }, { kind, timeout: 60_000 });
}
async function observed(handle) {
  try {
    const result = await handle.evaluate(entry => entry.promise);
    assert.equal(result.ok, true, result.error);
    return result;
  } finally { await handle.evaluate(entry => entry.cancel()); await handle.dispose(); }
}

await mkdir(out, { recursive: true });
const server = process.env.QA_BASE_URL ? null : await startPlayerQaServer();
const serverUrl = process.env.QA_BASE_URL ?? server.url;
const browser = process.env.QA_BROWSER === 'firefox'
  ? await firefox.launch({ headless: true })
  : await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
const report = { surface: 'player.html / exportProjectStoreShim', serverUrl, cases: [], failures: [] };
try {
  for (const test of cases.filter(test => !process.env.QA_CASES || process.env.QA_CASES.split(',').includes(test.id))) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
    const pageErrors = [], consoleErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    const project = fixture(test);
    const record = { id: test.id, pageErrors, consoleErrors };
    report.cases.push(record);
    try {
      await page.addInitScript(() => {
        window.__OPENRPG_BOOT__ = { projectUrl: '/__battle-admission/project.json', saveNamespace: 'battle-admission-qa', qaInstrumentation: true };
      });
      await page.route('**/__battle-admission/project.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(project) }));
      await page.goto(`${serverUrl}/player.html`, { waitUntil: 'domcontentloaded' });
      await observed(await observe(page, 'title'));
      const ready = await observe(page, 'ready');
      const outcome = await observe(page, test.invalid ? 'error' : 'battle');
      await page.keyboard.press('Enter');
      await observed(ready);
      if (test.trigger === 'action') await page.evaluate(() => { window.__oprnInput.face('right'); window.__oprnInput.action(); });
      const result = await observed(outcome);
      record.state = result.state;
      if (test.invalid) {
        assert.ok(result.message.trim().length > 0);
        assert.equal(result.state.battleResult, undefined);
        assert.notEqual(result.state.flags.afterBattle, true);
        assert.notEqual(result.state.flags.outcomeBranch, true);
        assert.equal(result.state.audio.bgm?.resourceId, 'cc0-bgm-rtp-fld-003');
        assert.equal(await page.locator('[data-testid="game-over-screen"]').count(), 0);
        record.message = result.message;
        record.errorGeometry = await page.locator('[data-testid="runtime-error"]').evaluate(node => {
          const rect = node.getBoundingClientRect();
          let alpha = 1;
          for (let parent = node; parent; parent = parent.parentElement) {
            const style = getComputedStyle(parent);
            if (style.display === 'none' || style.visibility === 'hidden') alpha = 0;
            alpha *= Number(style.opacity);
          }
          return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, alpha };
        });
        assert.ok(record.errorGeometry.width > 0 && record.errorGeometry.height > 0 && record.errorGeometry.alpha > 0.05);
        assert.ok(record.errorGeometry.x >= 0 && record.errorGeometry.y >= 0 && record.errorGeometry.right <= 1280 && record.errorGeometry.bottom <= 960);
      }
      await page.screenshot({ path: resolve(out, `${test.id}.png`) });
      if (test.invalid === 'variable' && test.trigger === 'action') {
        const correction = await performObservedAction(page, () => page.evaluate(() => {
          window.__oprnInput.face('left'); window.__oprnInput.action();
        }));
        assert.equal(correction.state.variables.selectedTroop, 1);
        const retried = await observe(page, 'battle');
        await page.evaluate(() => { window.__oprnInput.face('right'); window.__oprnInput.action(); });
        await observed(retried);
        assert.equal(await page.locator('[data-testid="runtime-error"]').count(), 0);
        await page.screenshot({ path: resolve(out, 'corrected-variable-retry.png') });
        record.correctedRetry = true;
      }
      assert.deepEqual(pageErrors, []);
      record.passed = true;
    } catch (error) {
      record.failure = String(error);
      record.failureSurface = await page.evaluate(() => ({
        body: document.body.innerText,
        state: document.querySelector('[data-testid="runtime-state-json"]')?.textContent,
      }));
      report.failures.push({ id: test.id, error: String(error) });
      await page.screenshot({ path: resolve(out, `${test.id}-failure.png`) });
    } finally { await page.close(); }
  }
} finally {
  await browser.close(); await server?.close();
  await writeFile(resolve(out, 'results.json'), JSON.stringify(report, null, 2));
  await writeFile(resolve(out, 'SUMMARY.md'), [
    '# Native event battle admission QA', '',
    'Isolated diagnostic copies only; no content DB writes. Console errors are retained for inspection; page errors fail.',
    ...report.cases.map(entry => `- ${entry.id}: ${entry.passed ? 'PASS' : 'FAIL'} - inspect ${entry.id}${entry.passed ? '' : '-failure'}.png`),
    '', 'Inspect corrected-variable-retry.png for error removal and restored valid battle authoring/runtime selection.',
    '', `Failures: ${report.failures.length}`,
  ].join('\n'));
}
console.log(JSON.stringify({ out, passed: report.cases.filter(entry => entry.passed).length, failures: report.failures }, null, 2));
process.exitCode = report.failures.length ? 1 : 0;
