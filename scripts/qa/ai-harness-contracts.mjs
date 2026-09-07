#!/usr/bin/env node
// Real-surface contracts. Headed Firefox, cold-CSS boot and exact event gates.
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
import { installBrowserProbe, browserSurface } from './ai-harness-browser.mjs';
import { proofFailureResponse, runProofFailure } from './ai-harness-proof-failure.mjs';
import { createP2Contracts } from './ai-harness-p2.mjs';
import { createR1AskContracts } from './ai-harness-r1-ask.mjs';
import { createNewGoalDraftContracts } from './ai-harness-r21-new-goal.mjs';
import { createWikiContracts } from './ai-harness-wiki.mjs';
import { deleteOwnedFixture } from './ai-harness-cleanup.mjs';
import { isWikiExtraction } from '../../test/wikiTransportFixture.ts';

const { values } = parseArgs({ options: { scenario: { type: 'string' } } });
assert.ok(['proof-failure', 'required-skip', 'outcome-matrix', 'retained-draft-ask', 'wiki-delivery', 'new-goal-draft'].includes(values.scenario), 'Unknown contract scenario');
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
  sourceTree: execFileSync('git', ['rev-parse', 'HEAD^{tree}', 'HEAD:src'], { cwd: root, encoding: 'utf8' }).trim().split('\n'),
  mutation: process.env.AI_HARNESS_MUTATION ?? null, pass: false, actions: [], states: {}, errors: [], blocked: [], cleanup: {} };
let config, server, browser, context, page, cacheDir, serverLog = '', gate, created = false, closing = false;
let llmRound = 0, p2, wiki;
const p1Response = proofFailureResponse(titleToken);
const ownsTitle = title => title === ownerTitle || p2?.ownsTitle(title) === true;
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
  assert.equal(ownsTitle(row.title), true);
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
async function armProof(label) {
  const pending = newGate(label);
  await page.evaluate(() => { qa.proofWaiting = false; });
  return pending;
}
async function runRoute(route) {
  const request = route.request();
  const url = new URL(request.url());
  const method = request.method();
  if (url.origin === base && p2?.interceptPreparation && await p2.interceptPreparation(route)) return;
  if (url.origin === base && url.pathname === '/v1/chat/completions') {
    assert.equal(closing, false);
    const body = request.postDataJSON();
    // Incoming main adds a separate tool-free wiki checkpoint before intent.
    // These scoped contract instructions introduce no lasting wiki facts.
    const wikiExtraction = isWikiExtraction(body.messages);
    const message = wikiExtraction ? wiki ? wiki.extract(body) : { role: 'assistant', content: JSON.stringify({ upserts: [] }) }
      : p2 ? await p2.respond(body) : p1Response(body);
    record('scripted-llm-http', { round: ++llmRound, hasTools: !!body.tools?.length, wikiExtraction, tool: message.tool_calls?.[0]?.function.name ?? null });
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
        if (table === 'projects') { assert.equal(ownsTitle(row.title), true); created = true; }
      }
    } else if (table === 'project_changes') assert.ok(commits.has(url.searchParams.get('commit_id')?.slice(3)));
    else {
      if (url.searchParams.get('project_id') !== `eq.${projectId}`) {
        report.blocked.push({ table, method, reason: 'unscoped project listing' }); await route.abort('blockedbyclient'); return;
      }
    }
    if (table === 'projects' && method === 'PATCH') assert.equal(ownsTitle(request.postDataJSON().title), true);
    const entry = { table, method, projectId, path: url.pathname, query: url.search };
    record('browser-real-transport', entry);
    if (p2 && await p2.intercept(route, entry)) return;
    if (wiki && await wiki.intercept(route, entry)) return;
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
  const cacheRoot = resolve(root, process.env.QA_CACHE_ROOT ?? '.vite-cache');
  await mkdir(cacheRoot, { recursive: true });
  cacheDir = await mkdtemp(resolve(cacheRoot, 'ai-harness-p1-'));
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
  await page.goto(`${base}/?blankProject=1&aiBridge=0&project=${projectId}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await expect(page.locator('.phaser-container canvas')).toBeVisible({ timeout: 60000 });
  if (await page.getByTestId('standard-welcome-start').isVisible()) await page.getByTestId('standard-welcome-start').click();
  await installBrowserProbe(page, { projectId, ownerTitle });
  const surface = browserSurface({ page, report, record, out });
  const harness = { ...surface, page, report, record, out, projectId, ownerTitle, titleToken,
    armProof, bounded, observeRemote, rest, deferred, clearProofGate: () => { gate?.release.resolve(); gate = null; } };
  await surface.capture('00-before');
  if (values.scenario === 'proof-failure') await runProofFailure(harness);
  else if (values.scenario === 'wiki-delivery') { wiki = createWikiContracts(harness); await wiki.run(); }
  else {
    p2 = values.scenario === 'new-goal-draft' ? createNewGoalDraftContracts(harness)
      : values.scenario === 'retained-draft-ask' ? createR1AskContracts(harness) : createP2Contracts(harness);
    await p2.run(values.scenario);
  }
} catch (error) {
  report.failure = safeError(error); process.exitCode = 1; record('FAIL', { error: report.failure });
  if (page && !page.isClosed()) {
    try { await page.screenshot({ path: `${out}/failure.png` }); report.failureEvents = await page.evaluate(() => window.qa?.events ?? []); }
    catch (error) { report.errors.push(safeError(error)); }
  }
} finally {
  closing = true;
  gate?.release.resolve();
  p2?.release();
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
    report.cleanup.remote = await deleteOwnedFixture({ rest, projectId, commits, ownsTitle });
  });
  report.pass = report.assertionsPassed === true && !process.exitCode;
  report.cleanup.reusedListener = false;
  report.cleanup.activeRoutes = routes.size;
  report.sourceHashes = Object.fromEntries(await Promise.all(['src/editor/projectWikiCoordinator.ts', 'src/editor/tools/applyChangesetToStore.ts', 'src/editor/panels/aiChatPanel.ts', 'scripts/qa/ai-harness-wiki.mjs', 'src/ai/assistantSession.ts', 'src/ai/workPlan.ts', 'src/ai/assistantAcceptanceLedger.ts', 'src/project/store.ts',
    'src/editor/panels/aiTurnRunner.ts', 'src/editor/aiAssistantBridge.ts', 'src/ai/activityLog.ts', 'src/ai/runRecap.ts',
    'scripts/qa/ai-harness-contracts.mjs', 'scripts/qa/ai-harness-browser.mjs', 'scripts/qa/ai-harness-proof-failure.mjs',
    'scripts/qa/ai-harness-cleanup.mjs', 'scripts/qa/ai-harness-p2.mjs', 'scripts/qa/ai-harness-p2-scenarios.mjs', 'scripts/qa/ai-harness-p2-observe.mjs', 'scripts/qa/ai-harness-p2-resume.mjs', 'scripts/qa/ai-harness-r1-ask.mjs', 'scripts/qa/ai-harness-r21-new-goal.mjs',
    'src/editor/panels/aiProposalCard.ts'].map(async path => [path, hash(await readFile(resolve(root, path)))])));
  await writeFile(`${out}/server.log`, serverLog.replaceAll(config?.anonKey || '\0', '[REDACTED]'));
  await writeFile(`${out}/actions.json`, JSON.stringify(report, null, 2) + '\n');
  record('cleanup', report.cleanup);
}
