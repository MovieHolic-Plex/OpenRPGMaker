import { firefox, expect } from '@playwright/test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Own the listener and disposable browser profiles. Never attach to a reused server.
// Run: xvfb-run -a node scripts/qa/map-owned-ai-turns.mjs
const root = fileURLToPath(new URL('../../', import.meta.url));
const port = Number(process.env.QA_PORT ?? 19846);
const base = `http://127.0.0.1:${port}`;
const out = resolve(root, process.env.EVIDENCE_DIR ?? 'output/evidence/map-owned-overlays/phase2/green');
const A = 'qa_map_a';
const B = 'qa_map_b';
const TIMEOUT = 60000;
const log = [];
const states = {};
const errors = [];
const routeErrors = [];
const blockedWrites = [];
const startup = [];
let server;
let browser;
let serverLog = '';
let context;
let page;
let scenario;
let sequence = 0;
let activeLlm;
let cacheDir;

function record(type, data = {}) {
  const entry = { sequence: ++sequence, scenario, type, ...data };
  log.push(entry);
  console.log(JSON.stringify(entry));
}
function deferred(label) {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  // Rejection is still propagated to the consumer; avoid unhandled rejections during cleanup.
  void promise.catch(() => {});
  return { promise, resolve, reject, label };
}
async function bounded(promise, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timeout: ${label}`)), TIMEOUT);
    })]);
  } finally { clearTimeout(timer); }
}

await mkdir(out, { recursive: true });
try {
  // A successful exclusive bind proves the exact host/port was free before launch.
  const probe = createServer();
  await new Promise((yes, no) => { probe.once('error', no); probe.listen(port, '127.0.0.1', yes); });
  await new Promise((yes, no) => probe.close(error => error ? no(error) : yes()));
  record('port-verified-free', { base, root });
  const ready = deferred('Vite ready');
  await mkdir(resolve(root, '.vite-cache'), { recursive: true });
  cacheDir = await mkdtemp(resolve(root, '.vite-cache/map-owned-ai-turns-'));
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--configLoader', 'runner', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: root, detached: true,
    env: { ...process.env, DEV_SERVER_NO_TLS: '1', E2E_FREEZE_DEV_SERVER: '1', DEV_SERVER_PORT: String(port), VITE_CACHE_DIR: cacheDir, NO_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.once('error', ready.reject);
  server.once('exit', (code, signal) => ready.reject(new Error(`Vite exited: ${code}/${signal}`)));
  for (const stream of [server.stdout, server.stderr]) stream.on('data', chunk => {
    serverLog += chunk.toString();
    if (serverLog.includes(base)) ready.resolve();
  });
  await bounded(ready.promise, ready.label);
  // Listening is not module readiness: Firefox aborts the cold, multi-MB CSS
  // module during the initial module fan-out. Await the real Vite transform,
  // including its full body, before navigation; never replace CSS or retry a boot.
  const css = await fetch(`${base}/src/styles/index.css`, { signal: AbortSignal.timeout(TIMEOUT) });
  expect(css.status).toBe(200);
  expect(css.headers.get('content-type')).toContain('javascript');
  const cssBytes = (await css.arrayBuffer()).byteLength;
  expect(cssBytes).toBeGreaterThan(0);
  record('boot-module-ready', { path: '/src/styles/index.css', status: css.status, bytes: cssBytes });
  for (scenario of ['completed', 'aborted']) {
    browser = await firefox.launch({ headless: false });
    await boot();
    const llm = await installLlm();
    await arm('turn-end', 'settled');
    await arm('spec', 'tool', { name: 'set_build_spec' });
    await send(`On QA Map A (${A}), use set_build_spec then clear_region for two separate patches; explicitly skip the remaining work with skip_work_item. Leave the third planned patch untouched.`);
    await wait('spec');
    await bounded(llm.gates[0].arrived.promise, 'first spatial tool requested');
    await capture('01-A-plan');
    expect(states[`${scenario}/01-A-plan`].blueprintEntries.map(entry => entry.status)).toEqual(['planned', 'planned', 'planned']);
    expect(states[`${scenario}/01-A-plan`].blueprintLayer).toBeGreaterThan(0);
    expect(states[`${scenario}/01-A-plan`].chip).not.toBeNull();

    await arm('first-write', 'tool', { name: 'clear_region', x: 3 });
    await arm('first-ghost', 'ghost', { cells: 9 });
    record('release-LLM', { gate: 'first spatial tool' });
    llm.gates[0].release.resolve();
    await wait('first-write');
    await wait('first-ghost');
    await bounded(llm.gates[1].arrived.promise, 'second spatial tool requested');
    await capture('02-A-draft-pending-tool');
    const aDraft = states[`${scenario}/02-A-draft-pending-tool`];
    expect(aDraft.mapDataUnchanged).toEqual({ [A]: true, [B]: true });
    expect(aDraft.filteredGhostCells).toBe(9);
    expect(aDraft.ghostLayer).toBeGreaterThan(0);
    expect(aDraft.blueprintEntries.map(entry => entry.status)).toEqual(['building', 'planned', 'planned']);
    expect(aDraft.runningToolMapId).toBe(A);
    expect(aDraft.chip).not.toBeNull();

    await selectMap(B);
    await capture('03-B-pending-tool');
    assertB(states[`${scenario}/03-B-pending-tool`]);
    await selectMap(A);
    await capture('03a-A-draft-return');
    expect(states[`${scenario}/03a-A-draft-return`].filteredGhostCells).toBe(9);
    expect(states[`${scenario}/03a-A-draft-return`].blueprintEntries).toEqual(aDraft.blueprintEntries);
    expect(states[`${scenario}/03a-A-draft-return`].mapDataUnchanged[A]).toBe(true);
    await selectMap(B);
    await arm('second-start', 'started', { name: 'clear_region', x: 9 });
    await arm('second-write', 'tool', { name: 'clear_region', x: 9 });
    await arm('second-ghost', 'ghost', { cells: 18 });
    record('release-LLM', { gate: 'second spatial tool while viewing B' });
    llm.gates[1].release.resolve();
    await wait('second-start');
    await wait('second-write');
    await wait('second-ghost');
    await bounded(llm.gates[2].arrived.promise, 'terminal tool requested');
    await capture('04-B-late-tool-draft');
    assertB(states[`${scenario}/04-B-late-tool-draft`]);
    expect(states[`${scenario}/04-B-late-tool-draft`].blueprintEntries.map(entry => entry.status)).toEqual(['done', 'building', 'planned']);
    expect(states[`${scenario}/04-B-late-tool-draft`].mapDataUnchanged[A]).toBe(true);

    if (scenario === 'completed') {
      await arm('applied', 'store');
      record('release-LLM', { gate: 'terminal tool and final response' });
      llm.gates[2].release.resolve();
      await wait('applied');
      await wait('turn-end');
      expect(await page.evaluate(() => qa.result.stoppedReason)).toBe('final');
      // Existing apply adapter intentionally focuses accepted changes on A. This is
      // not a B overlay/data leak: record it, then inspect B through its real tree.
      await capture('05a-completion-focus');
      if (await page.evaluate(() => qa.editor.get().currentMapId) !== B) await selectMap(B);
      await capture('05-B-applied');
      assertB(states['completed/05-B-applied']);
      expect(states['completed/05-B-applied'].mapDataUnchanged[A]).toBe(false);
      expect(states['completed/05-B-applied'].blueprintEntries).toEqual([]);
      expect(states['completed/05-B-applied'].allGhostCells).toBe(0);
      expect(states['completed/05-B-applied'].changedLowerCells).toBe(18);
      expect(states['completed/05-B-applied'].changeCards).toBe(1);
      await selectMap(A);
      await capture('06-A-applied-return');
      assertRetired(states['completed/06-A-applied-return']);

      // Same live session and active BuildSpec, not a replacement or fresh conversation.
      await page.evaluate(() => { qa.watchRetired = true; qa.afterApply = JSON.stringify(qa.store.getCurrent().maps); });
      llm.lookup = true;
      await arm('lookup-end', 'settled');
      await arm('lookup-tool', 'tool', { name: 'get_map_region' });
      await page.getByTestId('ai-composer-mode-ask').click();
      await send(`Read QA Map A (${A}) with get_map_region; do not modify anything.`);
      await wait('lookup-tool');
      await bounded(llm.lookupFinal.arrived.promise, 'lookup final response requested');
      await capture('07-A-lookup-in-flight');
      assertRetired(states['completed/07-A-lookup-in-flight'], { running: true });
      llm.lookupFinal.release.resolve();
      await wait('lookup-end');
      await capture('08-A-lookup-settled');
      assertRetired(states['completed/08-A-lookup-settled']);
      expect(states['completed/08-A-lookup-settled'].changedLowerCells).toBe(18);
      expect(await page.evaluate(() => qa.session.getActiveSpec()?.mapId)).toBe(A);
      expect(await page.evaluate(() => qa.sessionCount)).toBe(1);
      expect(await page.evaluate(() => qa.retirementViolations)).toEqual([]);
      expect(await page.evaluate(() => JSON.stringify(qa.store.getCurrent().maps) === qa.afterApply)).toBe(true);
    } else {
      // The real abort control cancels a pending LLM request after real draft writes.
      record('click-abort', { viewedMap: B });
      await page.getByTestId('ai-abort').click();
      await wait('turn-end');
      await capture('05-B-aborted');
      assertB(states['aborted/05-B-aborted']);
      expect(states['aborted/05-B-aborted'].mapDataUnchanged).toEqual({ [A]: true, [B]: true });
      // aiTurnRunner retires presentation on every owner-turn ending, including
      // abort. Retained BuildSpec is not a visible plan or an applied write.
      expect(states['aborted/05-B-aborted'].blueprintEntries).toEqual([]);
      expect(states['aborted/05-B-aborted'].allGhostCells).toBe(0);
      expect(states['aborted/05-B-aborted'].changeCards).toBe(0);
      expect(await page.evaluate(() => qa.result.stoppedReason)).toBe('aborted');
      // Let the intercepted transport finish after abort; it must not execute the late write.
      record('release-LLM', { gate: 'late response after abort' });
      llm.gates[2].release.resolve();
      await bounded(llm.gates[2].delivered.promise, 'aborted route delivery');
      await selectMap(A);
      await capture('06-A-aborted-return');
      assertRetired(states['aborted/06-A-aborted-return']);
      expect(states['aborted/06-A-aborted-return'].mapDataUnchanged).toEqual({ [A]: true, [B]: true });
      expect(states['aborted/06-A-aborted-return'].changeCards).toBe(0);
      expect(await page.evaluate(() => ({ mapId: qa.session.getActiveSpec()?.mapId, assets: qa.session.getActiveSpec()?.assets.length }))).toEqual({ mapId: A, assets: 3 });
      expect(await page.evaluate(() => qa.events.filter(event => event.type === 'tool_started' && event.name === 'skip_work_item'))).toEqual([]);
    }
    const eventLog = await page.evaluate(() => ({ events: qa.events, result: qa.result, bViolations: qa.bViolations }));
    record('session-evidence', eventLog);
    expect(eventLog.events.filter(event => event.type === 'tool_call' && !event.result.ok)).toEqual([]);
    expect(eventLog.bViolations).toEqual([]);
    expect(eventLog.events.find(event => event.type === 'tool_started' && event.name === 'clear_region' && event.args.x === 9)?.viewedMap).toBe(B);
    expect(llm.unexpected).toEqual([]);
    await closeContext();
    await browser.close();
    browser = null;
    record('context-and-browser-closed');
  }
  expect(routeErrors).toEqual([]);
  expect(errors).toEqual([]);
  record('PASS', { assertions: 'actual composer/session/tool/apply; A-only draft and writes; B zero overlays/unchanged; completed retirement and lookup non-revival; abort rollback with no false completion' });
} catch (error) {
  process.exitCode = 1;
  record('FAIL', { error: error.stack ?? String(error) });
  try {
    if (page && !page.isClosed()) {
      await page.screenshot({ path: `${out}/failure.png` });
      record('failure-body', { body: (await page.locator('body').innerText()).slice(-7000) });
      record('failure-dom', { html: (await page.locator('body').innerHTML()).slice(-10000) });
      const evidence = await page.evaluate(() => window.qa ? { events: qa.events, result: qa.result, bViolations: qa.bViolations } : null);
      record('failure-events', { evidence });
    }
  } catch (error) {
    record('failure-evidence-error', { error: error.stack ?? String(error) });
  }
} finally {
  try {
    if (context) await closeContext();
  } catch (error) {
    process.exitCode = 1;
    record('cleanup-error', { step: 'context', error: error.stack ?? String(error) });
  }
  try {
    if (browser) await browser.close();
  } catch (error) {
    process.exitCode = 1;
    record('cleanup-error', { step: 'browser', error: error.stack ?? String(error) });
  }
  try {
    if (server && server.exitCode === null && server.signalCode === null) {
      const exited = new Promise(resolve => server.once('exit', resolve));
      process.kill(-server.pid, 'SIGTERM');
      await bounded(exited, 'owned Vite cleanup');
    }
  } catch (error) {
    process.exitCode = 1;
    record('cleanup-error', { step: 'server', error: error.stack ?? String(error) });
  }
  try {
    if (cacheDir) {
      await rm(cacheDir, { recursive: true });
      record('owned-cache-removed', { path: cacheDir });
    }
  } catch (error) {
    process.exitCode = 1;
    record('cleanup-error', { step: 'cache', error: error.stack ?? String(error) });
  }
  record('cleanup', {
    browserClosed: !browser || !browser.isConnected(),
    ownedServerStopped: !!server && (server.exitCode !== null || server.signalCode !== null),
    reusedListener: false,
  });
  try {
    await writeFile(`${out}/server.log`, serverLog);
  } catch (error) {
    process.exitCode = 1;
    record('cleanup-error', { step: 'server.log', error: error.stack ?? String(error) });
  }
  try {
    await writeFile(`${out}/actions.json`, JSON.stringify({ log, states, errors, routeErrors, blockedWrites, startup }, null, 2));
  } catch (error) {
    process.exitCode = 1;
    record('cleanup-error', { step: 'actions.json', error: error.stack ?? String(error) });
  }
}

async function boot() {
  record('boot-start');
  context = await bounded(browser.newContext({ viewport: { width: 1440, height: 900 } }), 'new browser context');
  context.setDefaultTimeout(TIMEOUT);
  await context.addInitScript(() => {
    for (const key of ['oprn:editor-welcome-dismissed', 'oprn:standard-welcome-seen', 'oprn:coachmarks-basic-v1']) localStorage.setItem(key, '1');
    localStorage.setItem('oprn:editor-ui-mode', 'standard');
    // Exercise the normal one-turn apply path, not autonomous milestone auto-apply.
    localStorage.setItem('oprn:ai-config', JSON.stringify({ agentMode: 'chat' }));
  });
  page = await context.newPage();
  page.on('pageerror', error => errors.push({ scenario, message: error.message }));
  page.on('console', message => startup.push({ scenario, type: 'console', level: message.type(), text: message.text() }));
  page.on('requestfailed', request => startup.push({ scenario, type: 'requestfailed', path: new URL(request.url()).pathname, error: request.failure()?.errorText }));
  page.on('response', response => {
    const path = new URL(response.url()).pathname;
    if (response.status() >= 400 || path === '/src/styles/index.css' || path === '/src/main.ts') startup.push({ scenario, type: 'response', path, status: response.status() });
  });
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      blockedWrites.push({ scenario, method: request.method(), path: url.pathname });
      await route.abort('blockedbyclient');
    } else await route.continue();
  });
  await page.goto(`${base}/?blankProject=1`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await expect(page.locator('.phaser-container canvas')).toBeVisible({ timeout: TIMEOUT });
  if (await page.getByTestId('standard-welcome-start').isVisible()) await page.getByTestId('standard-welcome-start').click();
  await page.evaluate(async () => {
    const [storeModule, editorModule, mode, blueprint, ghost, sessionModule] = await Promise.all([
      import('/src/project/store.ts'), import('/src/editor/editorState.ts'), import('/src/app/mode.ts'),
      import('/src/editor/agentBlueprint.ts'), import('/src/editor/agentGhostPreview.ts'), import('/src/ai/assistantSession.ts'),
    ]);
    if (storeModule.store !== window.__oprnEditorStore) throw new Error('Different store module instance');
    if (storeModule.store.remotePersistenceEnabled) throw new Error('Remote persistence enabled');
    window.qa = { store: storeModule.store, editor: editorModule.editorState, mode, blueprint, ghost,
      signals: {}, events: [], bViolations: [], retirementViolations: [], sessionCount: 0 };
    qa.nextRender = () => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('postrender timeout')), 10000);
      mode.getGame().events.once('postrender', () => { clearTimeout(timer); resolve(); });
    });
    qa.scene = mode.getGame().scene.getScene('EditScene');
    if (!qa.scene.agentBlueprintRenderer) await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('EditScene create timeout')), 30000);
      qa.scene.events.once('create', () => { clearTimeout(timer); resolve(); });
    });
    const project = structuredClone(qa.store.getCurrent());
    const original = project.maps[project.startMapId];
    if (original.width < 18 || original.height < 6) throw new Error('Fixture needs an 18x6 region');
    project.maps = {
      qa_map_a: { ...structuredClone(original), id: 'qa_map_a', name: 'QA Map A - AI target' },
      qa_map_b: { ...structuredClone(original), id: 'qa_map_b', name: 'QA Map B - untouched' },
    };
    project.startMapId = 'qa_map_a';
    project.mapTree = { mapId: 'qa_map_a', children: [{ mapId: 'qa_map_b', children: [] }] };
    qa.store.replaceProject(project);
    qa.editor.set({ currentMapId: 'qa_map_a', selectedEventId: null, selection: null });
    qa.before = structuredClone(qa.store.getCurrent().maps);
    qa.baseMapJson = Object.fromEntries(Object.entries(qa.before).map(([id, map]) => [id, JSON.stringify(map)]));
    // Observation only: delegate the original method, options, signal and event callback unchanged.
    // No overlay setter, runTool replacement, fake proposal, or alternate apply path.
    const originalSend = sessionModule.AssistantSession.prototype.sendUserMessage;
    sessionModule.AssistantSession.prototype.sendUserMessage = async function(text, onEvent, signal, options) {
      if (qa.session !== this) { qa.sessionCount++; qa.session = this; }
      qa.events.push({ type: 'composer-turn', options });
      const result = await originalSend.call(this, text, event => {
        onEvent(event);
        const observed = { ...structuredClone(event), viewedMap: qa.editor.get().currentMapId };
        qa.events.push(observed);
        window.dispatchEvent(new CustomEvent('qa-session-event', { detail: observed }));
      }, signal, options);
      qa.result = structuredClone(result);
      return result;
    };
    qa.snapshot = () => {
      const bp = blueprint.getAgentBlueprintState();
      const gs = ghost.getAgentGhostPreviewState();
      const id = qa.editor.get().currentMapId;
      const chip = document.querySelector('[data-testid="ai-ghost-phase-chip"]');
      const map = qa.store.getCurrent().maps.qa_map_a;
      return {
        currentMapId: id, blueprintMapId: bp.mapId, blueprintEntries: bp.entries,
        blueprintLayer: qa.scene.agentBlueprintLayer.list.length,
        filteredBlueprintCount: blueprint.agentBlueprintForMap(bp, id).length,
        ghostLayer: qa.scene.agentGhostPreviewLayer.list.length,
        filteredGhostCells: ghost.agentGhostPreviewsForMap(gs, id).reduce((sum, preview) => sum + preview.cells.length, 0),
        allGhostCells: gs.previews.reduce((sum, preview) => sum + preview.cells.length, 0),
        runningToolName: gs.runningToolName, runningToolMapId: gs.runningToolMapId,
        chip: chip ? { text: chip.textContent, visible: !!chip.getClientRects().length } : null,
        remotePersistenceEnabled: qa.store.remotePersistenceEnabled,
        moduleStoreIdentity: qa.store === window.__oprnEditorStore,
        mapDataUnchanged: Object.fromEntries(Object.entries(qa.baseMapJson).map(([key, json]) => [key, json === JSON.stringify(qa.store.getCurrent().maps[key])])),
        changedLowerCells: map.lowerTiles.filter((tile, index) => tile !== qa.before.qa_map_a.lowerTiles[index]).length,
        changeCards: document.querySelectorAll('[data-testid="ai-change-card"]').length,
      };
    };
    // Observe every actual rendered frame, not merely screenshots at convenient endpoints.
    mode.getGame().events.on('postrender', () => {
      if (qa.watchRetired && blueprint.getAgentBlueprintState().entries.length) qa.retirementViolations.push(qa.snapshot());
      if (qa.editor.get().currentMapId !== 'qa_map_b') return;
      const state = qa.snapshot();
      if (state.blueprintLayer || state.ghostLayer || state.filteredBlueprintCount || state.filteredGhostCells || state.chip || !state.mapDataUnchanged.qa_map_b) qa.bViolations.push(state);
    });
    qa.store.subscribe(() => {
      if (JSON.stringify(qa.store.getCurrent().maps.qa_map_b) !== qa.baseMapJson.qa_map_b) qa.bViolations.push({ type: 'store-B-mutated' });
    });
    await qa.nextRender();
  });
  await capture('00-A-before');
  record('booted', { remotePersistenceEnabled: false, moduleStoreIdentity: true, agentMode: 'chat' });
}

async function installLlm() {
  const gate = label => ({ arrived: deferred(`${label} arrived`), release: deferred(`${label} release`), delivered: deferred(`${label} delivered`) });
  const script = { gates: [gate('first'), gate('second'), gate('terminal')], lookupFinal: gate('lookup final'), lookup: false, unexpected: [], closing: false };
  activeLlm = script;
  let round = 0;
  let lookupRound = 0;
  const spec = { mapId: A, title: 'A-only patches', assets: [3, 9, 15].map((x, index) => ({ id: `patch_${index}`, kind: 'clear', x, y: 3, w: 3, h: 3, confirmDestroy: true })), buildOrder: ['patch_0', 'patch_1', 'patch_2'] };
  const tool = (name, args) => ({ role: 'assistant', content: '', tool_calls: [{ id: `call_${scenario}_${round}_${lookupRound}`, type: 'function', function: { name, arguments: JSON.stringify({ ...args, reason: 'Map ownership regression fixture' }) } }] });
  // Only this local LLM endpoint is fulfilled; all other writes stay blocked.
  await page.route('**/v1/chat/completions', async route => {
    let held;
    try {
      if (script.closing) { await route.abort('aborted'); return; }
      expect(new URL(route.request().url()).origin).toBe(base);
      const body = route.request().postDataJSON();
      let message;
      if (!(body.tools?.length)) {
        // Both no-tools parsers ignore unrelated fields: valid intent + planner payload.
        // Routing is by body.tools, never prompt prose, model name, or call timing.
        message = { role: 'assistant', content: JSON.stringify({
          mode: script.lookup ? 'question' : 'modify', space: 'none', targetMapId: A,
          needsPlan: !script.lookup, useSelection: false, clarify: null, tools: ['clear_region', 'get_map_region', 'set_map_properties'],
          summary: 'Map ownership regression', action: 'new_plan', goal: 'A-only patches',
          layers: [{ title: 'A patches', items: [{ title: 'Apply patches', instruction: 'Clear two patches on qa_map_a; explicitly skip the remaining patch', successTools: ['set_map_properties'] }] }],
        }) };
        record('LLM-no-tools', { lookup: script.lookup });
      } else if (script.lookup) {
        lookupRound++;
        message = lookupRound === 1 ? tool('get_map_region', { mapId: A, x: 3, y: 3, w: 12, h: 3 }) : { role: 'assistant', content: 'QA_LOOKUP_FINAL' };
        if (lookupRound === 2) held = script.lookupFinal;
        if (lookupRound > 2) throw new Error(`Unexpected lookup round ${lookupRound}`);
        record('LLM-tools', { lookupRound, reply: message });
      } else {
        round++;
        if (round === 1) message = tool('set_build_spec', spec);
        else if (round === 2 || round === 3) {
          message = tool('clear_region', { mapId: A, x: round === 2 ? 3 : 9, y: 3, w: 3, h: 3, layer: 'lower', fill: 'empty' });
          held = script.gates[round - 2];
        } else if (round === 4) {
          message = tool('skip_work_item', { itemId: 'L1-1', note: 'Two patches drafted; third patch intentionally not built.' });
          held = script.gates[2];
        } else if (round === 5) message = { role: 'assistant', content: 'QA_APPLIED_FINAL' };
        else throw new Error(`Unexpected write round ${round}`);
        record('LLM-tools', { round, reply: message });
      }
      if (held) {
        held.pending = true;
        held.arrived.resolve();
        await bounded(held.release.promise, held.release.label);
        if (script.closing) { await route.abort('aborted'); held.delivered.resolve(); return; }
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message }] }) });
      held?.delivered.resolve();
    } catch (error) {
      routeErrors.push(error.message);
      script.unexpected.push(error.message);
      held?.delivered.reject(error);
      record('route-error', { message: error.message });
      await route.abort('failed');
    }
  });
  return script;
}

async function closeContext() {
  const failures = [];
  try {
    if (activeLlm) {
      activeLlm.closing = true;
      const pending = [...activeLlm.gates, activeLlm.lookupFinal].filter(gate => gate.pending);
      for (const gate of pending) gate.release.resolve();
      await bounded(Promise.all(pending.map(gate => gate.delivered.promise)), 'pending LLM cleanup');
    }
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      await context.close();
    } catch (error) {
      failures.push(error);
    } finally {
      activeLlm = null;
      context = null;
      page = null;
    }
  }
  if (failures.length) throw new AggregateError(failures, `Context cleanup failed:\n${failures.map(error => error.stack ?? String(error)).join('\n')}`);
}

async function arm(key, kind, args = {}) {
  await page.evaluate(({ key, kind, args }) => {
    qa.signals[key] = new Promise((resolve, reject) => {
      let cleanup = () => {};
      const timer = setTimeout(() => { cleanup(); reject(new Error(`Signal timeout: ${key}`)); }, 60000);
      const finish = value => { clearTimeout(timer); cleanup(); resolve(value); };
      if (kind === 'tool' || kind === 'started') {
        const listener = event => {
          const e = event.detail;
          if (e.type !== (kind === 'tool' ? 'tool_call' : 'tool_started') || e.name !== args.name || (args.x !== undefined && e.args.x !== args.x)) return;
          if (kind === 'tool' && !e.result.ok) { clearTimeout(timer); cleanup(); reject(new Error(`Tool failed: ${JSON.stringify(e)}`)); }
          else finish(e);
        };
        window.addEventListener('qa-session-event', listener);
        cleanup = () => window.removeEventListener('qa-session-event', listener);
      } else if (kind === 'ghost') {
        cleanup = qa.ghost.subscribeAgentGhostPreview(state => {
          if (state.previews.reduce((sum, preview) => sum + preview.cells.length, 0) === args.cells) finish();
        });
      } else if (kind === 'store') {
        cleanup = qa.store.subscribe(() => {
          if (JSON.stringify(qa.store.getCurrent().maps.qa_map_a) !== qa.baseMapJson.qa_map_a) finish();
        });
      } else if (kind === 'settled') {
        // send.disabled is exactly turnBusy (refreshSendEnabled), including lookup
        // turns which intentionally have no work-plan checklist.
        const send = document.querySelector('[data-testid="ai-send"]');
        let wasBusy = false;
        const observer = new MutationObserver(() => {
          if (send.disabled) wasBusy = true;
          if (wasBusy && !send.disabled) finish();
        });
        observer.observe(send, { attributes: true, attributeFilter: ['disabled'] });
        cleanup = () => observer.disconnect();
      } else throw new Error(`Unknown signal ${kind}`);
    });
    void qa.signals[key].catch(() => {});
  }, { key, kind, args });
}
async function wait(key) {
  await page.evaluate(async key => { await qa.signals[key]; await qa.nextRender(); }, key);
  record('signal', { key });
}
async function send(text) {
  record('composer-send', { text });
  await page.getByTestId('ai-input').fill(text);
  await page.getByTestId('ai-send').click();
}
async function selectMap(id) {
  await page.evaluate(id => {
    qa.mapChanged = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Map selection timeout: ${id}`)), 10000);
      const unsubscribe = qa.editor.subscribe(state => {
        if (state.currentMapId !== id) return;
        clearTimeout(timer); unsubscribe(); resolve(qa.nextRender());
      });
    });
  }, id);
  record('map-tree-click', { id });
  await page.getByTestId(`map-tree-node-${id}`).click();
  await page.evaluate(() => qa.mapChanged);
}
async function capture(label) {
  await page.evaluate(() => qa.nextRender());
  const state = await page.evaluate(() => qa.snapshot());
  states[`${scenario}/${label}`] = state;
  record('snapshot', { label, state });
  expect(state.remotePersistenceEnabled).toBe(false);
  expect(state.moduleStoreIdentity).toBe(true);
  await page.screenshot({ path: `${out}/${scenario}-${label}.png` });
}
function assertB(state) {
  expect(state.currentMapId).toBe(B);
  expect(state.blueprintLayer, 'B must have no actual blueprint renderer children').toBe(0);
  expect(state.ghostLayer, 'B must have no actual ghost renderer children').toBe(0);
  expect(state.filteredBlueprintCount).toBe(0);
  expect(state.filteredGhostCells).toBe(0);
  expect(state.chip, 'A activity chip must not appear on B').toBeNull();
  expect(state.mapDataUnchanged[B], 'B map bytes must remain identical').toBe(true);
}
function assertRetired(state, { running = false } = {}) {
  expect(state.currentMapId).toBe(A);
  expect(state.blueprintEntries, 'Applied blueprint entries must stay retired').toEqual([]);
  expect(state.blueprintLayer).toBe(0);
  expect(state.ghostLayer).toBe(0);
  expect(state.allGhostCells).toBe(0);
  expect(state.mapDataUnchanged[B]).toBe(true);
  if (!running) expect(state.chip).toBeNull();
}
