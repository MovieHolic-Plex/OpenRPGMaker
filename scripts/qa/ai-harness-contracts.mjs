#!/usr/bin/env node
// P1 only. Reuses map-owned-ai-turns' headed Firefox, cold-CSS boot and event gates.
// Only LLM responses are scripted. Project save/read/mismatch/restore use live Supabase.
import assert from 'node:assert/strict';
import { firefox, expect } from '@playwright/test';
import { mkdir, mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { loadEnv } from 'vite';

const { values } = parseArgs({ options: { scenario: { type: 'string' } } });
assert.equal(values.scenario, 'proof-failure', 'Only P1 proof-failure is implemented');
const root = fileURLToPath(new URL('../../', import.meta.url));
const port = Number(process.env.QA_PORT ?? 19847);
const base = `http://127.0.0.1:${port}`;
const out = resolve(root, process.env.EVIDENCE_DIR ?? 'output/evidence/ai-harness/p1/editor');
const runId = randomUUID();
const projectId = `qa-ai-surface-${runId}`;
const ownerTitle = `QA surface ${runId}`;
const titleToken = ownerTitle;
const hash = text => createHash('sha256').update(text).digest('hex');
const report = { schemaVersion: 1, scenario: values.scenario, runId, projectId,
  sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  mutation: process.env.AI_HARNESS_MUTATION ?? null, pass: false, actions: [], states: {}, errors: [], blocked: [], cleanup: {} };
let config, server, browser, context, page, cacheDir, serverLog = '', gate, created = false, closing = false;
let llmRound = 0, wrote = false;
const commits = new Set();
const routes = new Set();
const record = (type, data = {}) => { const entry = { sequence: report.actions.length + 1, type, ...data }; report.actions.push(entry); console.log(JSON.stringify(entry)); };
const safeError = error => String(error?.stack ?? error).replaceAll(config?.anonKey || '\0', '[REDACTED]');
function deferred() { const d = Promise.withResolvers(); void d.promise.catch(() => {}); return d; }
async function bounded(promise, label) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Deadline: ${label}`)), 60000); })]); }
  finally { clearTimeout(timer); }
}
async function portFree() {
  const probe = createServer();
  await new Promise((yes, no) => { probe.once('error', no); probe.listen(port, '127.0.0.1', yes); });
  await new Promise((yes, no) => probe.close(error => error ? no(error) : yes()));
}
async function rest(table, method = 'GET', body, extra = {}) {
  assert.ok(['projects', 'maps', 'tilesets', 'project_commits', 'project_changes'].includes(table));
  const query = table === 'project_changes' ? extra : { project_id: `eq.${projectId}`, ...extra };
  if (table === 'project_changes') assert.ok(commits.has(query.commit_id?.slice(3)));
  const response = await fetch(`${config.url}/rest/v1/${table}?${new URLSearchParams(query)}`, {
    method, redirect: 'error', signal: AbortSignal.timeout(30000),
    headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, 'Accept-Profile': 'rpg_zzu',
      'Content-Profile': 'rpg_zzu', 'Content-Type': 'application/json', Prefer: 'return=representation', Connection: 'close' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const bytes = await response.text();
  record('real-rest', { table, method, projectId, status: response.status, bytes: bytes.length });
  assert.equal(response.ok, true, `Real ${method} ${table} HTTP ${response.status}`);
  return bytes ? JSON.parse(bytes) : null;
}
function newGate(label) { gate = { label, arrived: deferred(), release: deferred(), completed: deferred(), used: false }; return gate; }
async function observeRemote(label) {
  const [row] = await rest('projects', 'GET', undefined, { select: 'project_id,title,current_json,current_sha256' });
  assert.equal(row?.project_id, projectId);
  assert.equal(row.title, ownerTitle);
  const normalized = await page.evaluate(async projectId => {
    const [sync, cfg, io, drafts] = await Promise.all([import('/src/project/supabaseProjectSync.ts'),
      import('/src/project/supabaseProjectConfig.ts'), import('/src/project/io.ts'), import('/src/project/eventDrafts.ts')]);
    const config = cfg.supabaseProjectConfig();
    if (config.projectId !== projectId) throw new Error('Wrong proof config');
    const read = await sync.loadProjectForPersistenceProof(config);
    return { projectId: read.projectId, normalized: io.serializeForComparison(drafts.projectWithoutEventDrafts(read.project)), sha256: read.sha256 };
  }, projectId);
  const observedIdentity = hash(normalized.normalized);
  record('normalized-remote', { label, projectId: normalized.projectId, observedIdentity, sha256: normalized.sha256 });
  return { row, observedIdentity };
}
async function capture(label) {
  const state = await page.evaluate(async () => {
    await qa.nextRender();
    const proof = qa.session?.getRunEndProof() ?? null;
    const live = qa.store.getCurrent();
    return { proof, title: live.system.titleScreen?.title, metaTitle: live.meta.title,
      mapId: qa.editor.get().currentMapId, sameStore: qa.store === window.__oprnEditorStore,
      remoteEnabled: qa.store.isRemotePersistenceEnabled(), dirty: qa.store.hasUnsavedChanges(),
      sameLiveObject: !qa.capturedLive || live === qa.capturedLive,
      sameLiveBytes: !qa.capturedJson || JSON.stringify(live) === qa.capturedJson,
      sessionCount: qa.sessionCount, result: qa.result,
      toolCalls: qa.events.filter(e => e.type === 'tool_call').map(e => ({ name: e.name, ok: e.result.ok })),
      workItems: qa.session?.getHarnessSnapshot().workPlan?.layers.flatMap(l => l.items.map(i => ({ id: i.id, status: i.status }))),
      savedAuditTokens: qa.session?.getAuditEntries().filter(e => e.kind === 'status' && e.text.split(' ')[0] === 'agent_run_saved').length ?? 0,
      sendDisabled: document.querySelector('[data-testid="ai-send"]').disabled };
  });
  report.states[label] = state;
  record('state', { label, state });
  await page.screenshot({ path: `${out}/${label}.png` });
  assert.equal(state.sameStore, true);
  assert.equal(state.remoteEnabled, true);
  return state;
}
async function send(text) {
  // Subscribe to the exact busy->idle transition before the click, not timer polling.
  await page.evaluate(() => {
    qa.settled = new Promise((resolve, reject) => {
      const send = document.querySelector('[data-testid="ai-send"]');
      let busy = false;
      const timer = setTimeout(() => { observer.disconnect(); reject(new Error('Turn settle deadline')); }, 60000);
      const observer = new MutationObserver(() => {
        if (send.disabled) busy = true;
        if (busy && !send.disabled) { clearTimeout(timer); observer.disconnect(); resolve(); }
      });
      observer.observe(send, { attributes: true, attributeFilter: ['disabled'] });
      qa.disposers.push(() => { clearTimeout(timer); observer.disconnect(); resolve(); });
    });
    void qa.settled.catch(() => {});
  });
  record('composer-send', { text });
  await page.getByTestId('ai-input').fill(text);
  await page.getByTestId('ai-send').click();
}
async function settled() { await page.evaluate(() => qa.settled); }
async function armProof(label) {
  const pending = newGate(label);
  await page.evaluate(() => { qa.proofWaiting = false; });
  return pending;
}
async function runRoute(route) {
  const request = route.request();
  const url = new URL(request.url());
  const method = request.method();
  if (url.origin === base && url.pathname === '/v1/chat/completions') {
    assert.equal(closing, false);
    const body = request.postDataJSON();
    let message;
    if (!body.tools?.length) message = { role: 'assistant', content: JSON.stringify({
      mode: 'modify', space: 'none', needsPlan: true, useSelection: false, clarify: null,
      tools: ['set_title_screen'], summary: 'P1 title proof', action: wrote ? 'resume' : 'new_plan',
      goal: 'Set the title screen', layers: [{ title: 'Title', items: [{ title: 'Title', instruction: 'set_title_screen', successTools: ['set_title_screen'] }] }],
    }) };
    else if (!wrote) {
      assert.ok(body.tools.some(t => t.function.name === 'set_title_screen'));
      wrote = true;
      message = { role: 'assistant', content: '', tool_calls: [{ id: 'qa_title_write', type: 'function',
        function: { name: 'set_title_screen', arguments: JSON.stringify({ title: titleToken, reason: 'P1 accepted revision proof' }) } }] };
    } else message = { role: 'assistant', content: 'QA_FINAL' };
    record('scripted-llm-http', { round: ++llmRound, hasTools: !!body.tools?.length, tool: message.tool_calls?.[0]?.function.name ?? null });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message }] }) });
    return;
  }
  if (url.pathname.includes('/rest/v1/')) {
    const table = url.pathname.split('/rest/v1/')[1];
    if (!['projects', 'maps', 'tilesets', 'project_commits', 'project_changes'].includes(table)) {
      report.blocked.push({ table, method, reason: 'unrelated telemetry/table' }); await route.abort('blockedbyclient'); return;
    }
    assert.equal(url.origin, base);
    if (method === 'POST') {
      const body = request.postDataJSON();
      for (const row of Array.isArray(body) ? body : [body]) {
        if (table === 'project_changes') assert.ok(commits.has(row.commit_id));
        else assert.equal(row.project_id, projectId, 'Browser writes must target run-owned project');
        if (table === 'project_commits') commits.add(row.commit_id);
        if (table === 'projects') { assert.equal(row.title, ownerTitle); created = true; }
      }
    } else if (table === 'project_changes') assert.ok(commits.has(url.searchParams.get('commit_id')?.slice(3)));
    else {
      if (url.searchParams.get('project_id') !== `eq.${projectId}`) {
        report.blocked.push({ table, method, reason: 'unscoped project listing' }); await route.abort('blockedbyclient'); return;
      }
    }
    const entry = { table, method, projectId, path: url.pathname, query: url.search };
    record('browser-real-transport', entry);
    const held = gate;
    if (table === 'projects' && method === 'GET' && held && !held.used && await page.evaluate(() => !!window.qa?.proofWaiting)) {
      held.used = true;
      await page.evaluate(() => { qa.proofWaiting = false; qa.capturedLive = qa.store.getCurrent(); qa.capturedJson = JSON.stringify(qa.capturedLive); });
      held.arrived.resolve();
      await bounded(held.release.promise, held.label);
      record('real-proof-read-released', { label: held.label });
      await route.continue();
      held.completed.resolve();
    } else await route.continue();
    return;
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    report.blocked.push({ method, path: url.pathname, reason: 'non-QA write' }); await route.abort('blockedbyclient'); return;
  }
  await route.continue();
}
await mkdir(out, { recursive: true });
try {
  const env = loadEnv('development', root, '');
  const rawUrl = (env.SUPABASE_UPSTREAM_URL ?? env.VITE_SUPABASE_URL ?? '').trim();
  assert.match(rawUrl, /^https?:\/\/[^/?#@\\\s]+\/?$/i);
  const anonKey = (env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY ?? '').trim();
  let anon = /^sb_publishable_[A-Za-z0-9_-]+$/.test(anonKey);
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(anonKey)) {
    try { anon = JSON.parse(Buffer.from(anonKey.split('.')[1], 'base64url')).role === 'anon'; } catch { anon = false; }
  }
  assert.equal(anon, true, 'Anon/publishable key required');
  const configuredProjectId = env.VITE_SUPABASE_PROJECT_ID?.trim();
  assert.ok(configuredProjectId && configuredProjectId.length <= 200 && !/[\p{C}\\'"`]/u.test(configuredProjectId));
  assert.notEqual(configuredProjectId, projectId);
  config = { url: new URL(rawUrl).origin, anonKey };
  report.configuration = { origin: config.url, anonValidated: true, configuredProjectPresent: true,
    configuredProjectAccessed: false, fixtureProjectId: projectId };
  assert.deepEqual(await rest('projects', 'GET', undefined, { select: 'project_id' }), []);
  report.cleanup.absentBeforeRun = true;
  record('isolated-project-available', { projectId, beforeContentQa: true });
  await portFree();
  await mkdir(resolve(root, '.vite-cache'), { recursive: true });
  cacheDir = await mkdtemp(resolve(root, '.vite-cache/ai-harness-p1-'));
  const ready = deferred();
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--configLoader', 'runner', '--config', 'scripts/qa/ai-harness-vite.config.mjs',
    '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: root, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, DEV_SERVER_NO_TLS: '1', E2E_FREEZE_DEV_SERVER: '1', DEV_SERVER_PORT: String(port),
      VITE_CACHE_DIR: cacheDir, VITE_SUPABASE_PROJECT_ID: projectId, VITE_SUPABASE_USE_PROXY: '1',
      SUPABASE_ANON_KEY: anonKey, SUPABASE_UPSTREAM_URL: config.url, NO_COLOR: '1' },
  });
  server.once('error', ready.reject);
  server.once('exit', (code, signal) => ready.reject(new Error(`Owned Vite exited ${code}/${signal}`)));
  for (const stream of [server.stdout, server.stderr]) stream.on('data', chunk => { serverLog += chunk; if (serverLog.includes(base)) ready.resolve(); });
  await bounded(ready.promise, 'Vite ready');
  const css = await fetch(`${base}/src/styles/index.css`, { signal: AbortSignal.timeout(60000) });
  assert.equal(css.status, 200); assert.ok(css.headers.get('content-type').includes('javascript'));
  record('cold-css-ready', { bytes: (await css.arrayBuffer()).byteLength });
  browser = await firefox.launch({ headless: false });
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  context.setDefaultTimeout(60000);
  await context.addInitScript(() => {
    for (const key of ['oprn:editor-welcome-dismissed', 'oprn:standard-welcome-seen', 'oprn:coachmarks-basic-v1']) localStorage.setItem(key, '1');
    localStorage.setItem('oprn:editor-ui-mode', 'standard');
    localStorage.setItem('oprn:ai-config', JSON.stringify({ agentMode: 'auto' }));
  });
  page = await context.newPage();
  page.on('pageerror', error => report.errors.push(safeError(error)));
  await context.route('**/*', route => {
    const task = runRoute(route).catch(async error => { report.errors.push(safeError(error)); gate?.arrived.reject(error); gate?.completed.reject(error); await route.abort('failed'); });
    routes.add(task); task.then(() => routes.delete(task), () => routes.delete(task)); return task;
  });
  await page.goto(`${base}/?blankProject=1&project=${projectId}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await expect(page.locator('.phaser-container canvas')).toBeVisible({ timeout: 60000 });
  if (await page.getByTestId('standard-welcome-start').isVisible()) await page.getByTestId('standard-welcome-start').click();
  await page.evaluate(async ({ projectId, ownerTitle }) => {
    const [sm, em, mode, sessionModule, cfg] = await Promise.all([import('/src/project/store.ts'), import('/src/editor/editorState.ts'),
      import('/src/app/mode.ts'), import('/src/ai/assistantSession.ts'), import('/src/project/supabaseProjectConfig.ts')]);
    if (sm.store !== window.__oprnEditorStore || sm.store.isRemotePersistenceEnabled()) throw new Error('Fresh-store boot isolation failed');
    if (cfg.supabaseProjectConfig().projectId !== projectId) throw new Error('Wrong isolated project config');
    window.qa = { store: sm.store, editor: em.editorState, mode, events: [], disposers: [], sessionCount: 0 };
    qa.nextRender = () => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('postrender deadline')), 10000);
      mode.getGame().events.once('postrender', () => { clearTimeout(timer); resolve(); });
    });
    qa.store.update(draft => { draft.meta.title = ownerTitle; });
    await qa.store.flush(); // Disabled boot flush clears only this fixture's debounce.
    qa.store._setPersistedBaselineForTest(null);
    qa.store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
    const original = sessionModule.AssistantSession.prototype.sendUserMessage;
    sessionModule.AssistantSession.prototype.sendUserMessage = async function(text, onEvent, signal, options) {
      if (qa.session !== this) { qa.sessionCount++; qa.session = this; }
      const result = await original.call(this, text, event => {
        onEvent(event);
        qa.events.push(structuredClone(event));
        if (event.type === 'persistence_proof' && event.state.status === 'attempted' && event.state.receipt) qa.proofWaiting = true;
      }, signal, options);
      qa.result = structuredClone(result); return result;
    };
    qa.disposers.push(() => { sessionModule.AssistantSession.prototype.sendUserMessage = original; });
    await qa.nextRender();
  }, { projectId, ownerTitle });
  await capture('00-before');
  const first = await armProof('actual remote content mismatch');
  await send(`Use set_title_screen to set the title to ${titleToken}.`);
  await bounded(first.arrived.promise, 'first accepted-save proof read');
  const pending = await capture('01-accepted-read-pending');
  assert.equal(pending.title, titleToken);
  assert.equal(pending.proof.status, 'attempted');
  const accepted = await observeRemote('accepted');
  const receipt = pending.proof.receipt;
  assert.equal(receipt.projectId, projectId);
  assert.equal(accepted.observedIdentity, receipt.contentIdentity);
  const changed = structuredClone(accepted.row.current_json);
  changed.meta.title = `${ownerTitle} remote mismatch`;
  assert.equal((await rest('projects', 'PATCH', { current_json: changed }, { title: `eq.${ownerTitle}` })).length, 1);
  const mismatch = await observeRemote('mismatched');
  assert.notEqual(mismatch.observedIdentity, receipt.contentIdentity);
  assert.equal(mismatch.row.current_sha256, receipt.sha256, 'Same wire hash must not hide changed content');
  first.release.resolve(); await bounded(first.completed.promise, 'read released'); await settled();
  const failed = await capture('02-proof-failed');
  // This is the mutation kill assertion: actual failed proof cannot be promoted by the session.
  assert.equal(failed.proof.verified, false, 'A real content-mismatched read must not be verified');
  assert.equal(failed.proof.status, 'failed'); assert.equal(failed.proof.reason, 'mismatch-content');
  assert.equal(failed.savedAuditTokens, 0);
  assert.equal(failed.sameLiveObject, true); assert.equal(failed.sameLiveBytes, true);
  assert.deepEqual(failed.toolCalls, [{ name: 'set_title_screen', ok: true }, { name: 'run_lint', ok: true }]);
  assert.deepEqual(failed.workItems.map(item => item.status), ['done']);
  assert.equal((await rest('projects', 'PATCH', { current_json: accepted.row.current_json }, { title: `eq.${ownerTitle}` })).length, 1);
  gate = null;
  const postsBeforeRetry = report.actions.filter(a => a.type === 'browser-real-transport' && a.table === 'projects' && a.method !== 'GET').length;
  await send('계속'); await settled();
  const retried = await capture('03-same-revision-retry');
  assert.equal(retried.proof.verified, true); assert.equal(retried.proof.status, 'succeeded');
  assert.deepEqual(retried.proof.receipt, receipt);
  assert.equal(retried.sameLiveObject, true); assert.equal(retried.sameLiveBytes, true);
  assert.equal(retried.sessionCount, 1); assert.deepEqual(retried.toolCalls, failed.toolCalls);
  assert.equal(report.actions.filter(a => a.type === 'browser-real-transport' && a.table === 'projects' && a.method !== 'GET').length, postsBeforeRetry);
  assert.equal((await observeRemote('restored-retry')).observedIdentity, receipt.contentIdentity);
  // Event-gated live edit race: no time-based autosave luck, no store/verifier replacement.
  await page.evaluate(async () => {
    qa.store.update(draft => { draft.meta.description = 'qa-before-proof-race'; });
    qa.store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
    await qa.store.flush();
    qa.store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true });
  });
  const race = await armProof('newer live edit during real proof read');
  await send('계속'); await bounded(race.arrived.promise, 'race proof read');
  await page.evaluate(async () => {
    qa.store.update(draft => { draft.meta.description = 'qa-human-edit-during-read'; });
    qa.store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
    await qa.store.flush();
    qa.store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true });
    qa.capturedLive = qa.store.getCurrent(); qa.capturedJson = JSON.stringify(qa.capturedLive);
  });
  race.release.resolve(); await bounded(race.completed.promise, 'race read released'); await settled();
  const stale = await capture('04-live-edit-preserved');
  assert.equal(stale.proof.verified, false); assert.equal(stale.proof.reason, 'stale');
  assert.equal(stale.proof.proof.kind, 'verified'); assert.equal(stale.proof.proof.isCurrent, false);
  assert.equal(stale.sameLiveObject, true); assert.equal(stale.sameLiveBytes, true); assert.equal(stale.dirty, true);
  assert.equal(await page.evaluate(() => qa.store.getCurrent().meta.description), 'qa-human-edit-during-read');
  gate = null;
  await send('계속'); await settled();
  const latest = await capture('05-latest-revision-verified');
  assert.equal(latest.proof.verified, true); assert.equal(latest.dirty, false);
  assert.deepEqual(latest.toolCalls, failed.toolCalls); assert.equal(latest.sessionCount, 1);
  assert.equal((await observeRemote('latest')).observedIdentity, latest.proof.receipt.contentIdentity);
  assert.deepEqual(report.errors, []);
  report.assertionsPassed = true;
  record('PASS', { projectId, oneAppliedTool: true, sameRevisionRetry: true, localOverwrite: false });
} catch (error) {
  report.failure = safeError(error); process.exitCode = 1; record('FAIL', { error: report.failure });
  if (page && !page.isClosed()) {
    try { await page.screenshot({ path: `${out}/failure.png` }); report.failureEvents = await page.evaluate(() => window.qa?.events ?? []); }
    catch (error) { report.errors.push(safeError(error)); }
  }
} finally {
  closing = true;
  gate?.release.resolve();
  const cleanupStep = async (name, work) => {
    try { await work(); report.cleanup[name] = true; }
    catch (error) { report.cleanup[name] = safeError(error); process.exitCode = 1; }
  };
  await cleanupStep('pageListenersAndTimersClosed', async () => {
    if (page && !page.isClosed()) await page.evaluate(async () => {
      if (!window.qa) return;
      qa.disposers.forEach(dispose => dispose());
      qa.store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
      await qa.store.flush();
      const [activity, vault] = await Promise.all([import('/src/editor/editActivityLog.ts'), import('/src/project/eventDraftVault.ts')]);
      activity._resetEditActivityForTest(); vault._resetEventDraftVaultForTest();
    });
    await bounded(Promise.all([...routes]), 'pending browser routes');
  });
  await cleanupStep('browserClosed', async () => { await context?.close(); await browser?.close(); });
  await cleanupStep('serverClosed', async () => {
    if (server && server.exitCode === null && server.signalCode === null) {
      const exited = new Promise(resolve => server.once('exit', resolve));
      process.kill(-server.pid, 'SIGTERM'); await bounded(exited, 'owned Vite shutdown');
    }
  });
  await cleanupStep('cacheRemoved', async () => { if (cacheDir) await rm(cacheDir, { recursive: true }); });
  await cleanupStep('portReleased', portFree);
  await cleanupStep('remoteDeletedAndAbsent', async () => {
    if (!created) { report.cleanup.remote = 'not-created'; return; }
    const rows = await rest('projects', 'GET', undefined, { select: 'project_id,title' });
    assert.deepEqual(rows, [{ project_id: projectId, title: ownerTitle }], 'Positive run ownership required for cleanup');
    assert.equal((await rest('projects', 'DELETE', undefined, { title: `eq.${ownerTitle}` })).length, 1);
    for (const table of ['projects', 'maps', 'tilesets', 'project_commits']) assert.deepEqual(await rest(table, 'GET', undefined, { select: 'project_id' }), []);
    for (const id of commits) assert.deepEqual(await rest('project_changes', 'GET', undefined, { commit_id: `eq.${id}`, select: 'commit_id' }), []);
    report.cleanup.remote = { projectId, kind: 'deleted-and-absence-verified', commitIds: [...commits] };
  });
  report.pass = report.assertionsPassed === true && !process.exitCode;
  report.cleanup.reusedListener = false;
  report.cleanup.activeRoutes = routes.size;
  report.sourceHashes = Object.fromEntries(await Promise.all(['src/ai/assistantSession.ts', 'src/project/store.ts', 'scripts/qa/ai-harness-contracts.mjs'].map(async path => [path, hash(await readFile(resolve(root, path)))])));
  await writeFile(`${out}/server.log`, serverLog.replaceAll(config?.anonKey || '\0', '[REDACTED]'));
  await writeFile(`${out}/actions.json`, JSON.stringify(report, null, 2) + '\n');
  record('cleanup', report.cleanup);
}
