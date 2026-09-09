#!/usr/bin/env node
// Local browser data API QA. No editor boot, remote writes, or mocked stores.
import assert from 'node:assert/strict';
import { firefox } from '@playwright/test';
import { createServer } from 'vite';
import { createServer as createNetServer } from 'node:net';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const expectedHead = process.env.EXPECTED_HEAD ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const out = resolve(root, process.env.EVIDENCE_DIR ?? 'output/evidence/ai-harness/p4/checkpoint-upgrade');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourcePaths = ['src/ai/aiRecordDb.ts', 'src/ai/runCheckpointStore.ts', 'src/ai/conversationStore.ts'];
const report = { scenario: 'checkpoint-upgrade', pass: false, startedAt: new Date().toISOString(),
  expectedHead, root, source: {}, cases: [], requests: [], errors: [], cleanup: {} };
let server, browser, temp, port;
const contexts = new Set();
const responseTasks = [];
const previousCache = process.env.VITE_CACHE_DIR;
async function bounded(promise, label, ms = 60000) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Deadline: ${label}`)), ms);
    })]);
  } finally { clearTimeout(timer); }
}
async function browserPhase(page, input) {
  return bounded(page.evaluate(async ({ phase, version, conversation, checkpoint }) => {
    const name = 'oprn-ai-records';
    function bounded(promise, label) {
      let timer;
      return Promise.race([promise, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Browser deadline: ${label}`)), 30000);
      })]).finally(() => clearTimeout(timer));
    }
    function requestDone(request) {
      return bounded(new Promise((resolve, reject) => {
        request.addEventListener('success', () => resolve(request.result), { once: true });
        request.addEventListener('error', () => reject(request.error), { once: true });
        request.addEventListener('blocked', () => reject(new Error('IDB blocked')), { once: true });
      }), 'IDB request');
    }
    function transactionDone(tx) {
      return bounded(new Promise((resolve, reject) => {
        tx.addEventListener('complete', resolve, { once: true });
        tx.addEventListener('abort', () => reject(tx.error ?? new Error('IDB aborted')), { once: true });
        tx.addEventListener('error', () => reject(tx.error ?? new Error('IDB transaction error')), { once: true });
      }), 'IDB transaction');
    }
    async function inspect() {
      const db = await requestDone(indexedDB.open(name));
      try {
        const stores = [...db.objectStoreNames];
        const tx = db.transaction(stores, 'readonly');
        const done = transactionDone(tx); // Subscribe before scheduling requests.
        const schema = Object.fromEntries(stores.map(name => {
          const store = tx.objectStore(name);
          return [name, { keyPath: store.keyPath, autoIncrement: store.autoIncrement,
            indexes: [...store.indexNames].map(name => {
              const index = store.index(name);
              return { name, keyPath: index.keyPath, unique: index.unique, multiEntry: index.multiEntry };
            }) }];
        }));
        const requests = stores.map(name => requestDone(tx.objectStore(name).getAll()));
        const [rows] = await Promise.all([Promise.all(requests), done]);
        return { version: db.version, stores, schema, rows: Object.fromEntries(stores.map((name, i) => [name, rows[i]])) };
      } finally { db.close(); }
    }
    if (phase === 'seed') {
      const databases = await bounded(indexedDB.databases(), 'fresh database enumeration');
      if (databases.some(db => db.name === name)) throw new Error('Context is not isolated');
      const request = indexedDB.open(name, version);
      let upgradeDone;
      request.addEventListener('upgradeneeded', event => {
        if (event.oldVersion !== 0) throw new Error('Seed must start from absent DB');
        upgradeDone = transactionDone(request.transaction);
        const store = request.result.createObjectStore('conversations', { keyPath: 'id' });
        store.createIndex('savedAt', 'savedAt');
        store.createIndex('projectContextKey', 'projectContextKey');
        store.put(conversation);
        if (version === 2) request.result.createObjectStore('conversationTombstones', { keyPath: 'id' })
          .put({ id: JSON.stringify([conversation.projectContextKey, 'deleted-1']) });
      }, { once: true });
      const db = await requestDone(request);
      try { await upgradeDone; } finally { db.close(); }
      return { phase, origin: location.origin, observation: await inspect() };
    }
    const [records, checkpoints, conversations, config] = await bounded(Promise.all([
      import('/src/ai/aiRecordDb.ts'), import('/src/ai/runCheckpointStore.ts'),
      import('/src/ai/conversationStore.ts'), import('/src/project/supabaseProjectConfig.ts'),
    ]), 'actual Vite-served storage modules');
    if (config.supabaseProjectConfig() !== null) throw new Error('Remote config must be disabled');
    const backend = await bounded(records.aiRecordBackendKind(), 'actual DB upgrade');
    const id = checkpoints.runCheckpointId(checkpoint);
    const key = { conversationId: checkpoint.conversationId, runId: checkpoint.runId, epoch: checkpoint.epoch,
      projectId: checkpoint.projectId, projectContextKey: checkpoint.projectContextKey };
    let save = null;
    if (phase === 'migrate') save = await bounded(checkpoints.saveRunCheckpoint(checkpoint), 'checkpoint durable save');
    const loaded = await bounded(checkpoints.readRunCheckpoint(key), 'checkpoint read');
    const original = await bounded(conversations.loadConversation(conversation.id), 'original conversation API read');
    const tombstone = await bounded(records.isScopedAiRecordDeleted('deleted-1', conversation.projectContextKey), 'tombstone API read');
    const invalidCases = [
      { suffix: 'malformed', reason: 'malformed', changes: { budget: null } },
      { suffix: 'foreign', reason: 'identity-mismatch', changes: { projectId: 'foreign-project' } },
      { suffix: 'future', reason: 'schema-version', changes: { schemaVersion: 99 } },
    ];
    const invalid = [];
    for (const spec of invalidCases) {
      const badKey = { ...key, runId: `${key.runId}-${spec.suffix}` };
      const row = { ...checkpoint, ...badKey, ...spec.changes, id: checkpoints.runCheckpointId(badKey) };
      if (phase === 'migrate') {
        const result = await bounded(records.writeAiRecords(records.AI_RECORD_STORES.runCheckpoints, [row]), 'seed unsupported row');
        if (result !== 'indexeddb') throw new Error('Unsupported row seed was not durable');
      }
      const before = await bounded(records.readAiRecord(records.AI_RECORD_STORES.runCheckpoints, row.id), 'unsupported row before');
      const result = await bounded(checkpoints.readRunCheckpoint(badKey), 'unsupported API read');
      const after = await bounded(records.readAiRecord(records.AI_RECORD_STORES.runCheckpoints, row.id), 'unsupported row after');
      invalid.push({ reason: spec.reason, expected: row, before, result, after });
    }
    return { phase, origin: location.origin, backend, id, save, loaded, original, tombstone, invalid,
      observation: await inspect(), remoteConfigured: config.supabaseProjectConfig() !== null,
      editorBooted: !!window.__oprnEditorStore };
  }, input), `browser phase ${input.phase} v${input.version}`);
}
function checkRead(state, seed, fixture) {
  assert.equal(state.origin, seed.origin);
  assert.equal(state.backend, 'indexeddb');
  assert.equal(state.remoteConfigured, false);
  assert.equal(state.editorBooted, false);
  assert.deepEqual(state.original, fixture.conversation);
  assert.equal(state.tombstone, fixture.version === 2);
  assert.deepEqual(state.loaded, { kind: 'found', durable: true, checkpoint: { ...fixture.checkpoint, id: state.id } });
  const db = state.observation;
  assert.equal(db.version, 3);
  assert.deepEqual(db.stores, ['conversationTombstones', 'conversations', 'runCheckpoints']);
  assert.deepEqual(db.schema.conversations, seed.observation.schema.conversations);
  assert.deepEqual(db.rows.conversations, [fixture.conversation]);
  assert.deepEqual(db.rows.conversationTombstones, fixture.version === 2
    ? seed.observation.rows.conversationTombstones : []);
  assert.deepEqual(db.schema.runCheckpoints, { keyPath: 'id', autoIncrement: false,
    indexes: ['conversationId', 'projectContextKey', 'savedAt'].map(name => ({ name, keyPath: name, unique: false, multiEntry: false })) });
  assert.equal(db.rows.runCheckpoints.length, 4);
  assert.deepEqual(db.rows.runCheckpoints.find(row => row.id === state.id), state.loaded.checkpoint);
  for (const bad of state.invalid) {
    assert.deepEqual(bad.result, { kind: 'unsupported', durable: true, reason: bad.reason });
    assert.deepEqual(bad.before, bad.expected);
    assert.deepEqual(bad.after, bad.expected);
  }
}
try {
  await mkdir(out, { recursive: true });
  // Never overwrite a previous execution's success or failure evidence.
  await writeFile(resolve(out, 'execution.lock'), `${new Date().toISOString()}\n`, { flag: 'wx' });
  report.source.head = git('rev-parse', 'HEAD');
  assert.equal(report.source.head, expectedHead, 'Run only against the verified storage unit');
  report.source.status = git('status', '--porcelain', '--', 'src', 'test', 'vite.config.ts', 'scripts/qa/ai-harness-vite.config.mjs');
  assert.equal(report.source.status, '', 'Product and existing infrastructure must be unchanged');
  report.source.tree = git('rev-parse', 'HEAD^{tree}');
  report.source.hashes = Object.fromEntries(await Promise.all(sourcePaths.map(async path => [path, hash(await readFile(resolve(root, path)))])));
  report.source.harnessSha256 = hash(await readFile(fileURLToPath(import.meta.url)));
  temp = await mkdtemp(resolve(tmpdir(), 'ai-checkpoint-upgrade-'));
  process.env.VITE_CACHE_DIR = resolve(temp, 'vite-cache');
  server = await createServer({ root, configFile: resolve(root, 'scripts/qa/ai-harness-vite.config.mjs'),
    configLoader: 'runner', cacheDir: process.env.VITE_CACHE_DIR, envFile: false,
    define: Object.fromEntries(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_PROJECT_ID', 'VITE_SUPABASE_USE_PROXY']
      .map(key => [`import.meta.env.${key}`, JSON.stringify('')])),
    optimizeDeps: { noDiscovery: true, include: [], entries: [] },
    server: { host: '127.0.0.1', port: 0, strictPort: true, https: false, open: false, hmr: false, watch: null },
    plugins: [{ name: 'checkpoint-minimal-page', configureServer(vite) {
      vite.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/__checkpoint-upgrade') return next();
        res.setHeader('Content-Type', 'text/html');
        res.end('<!doctype html><meta charset="utf-8"><title>Checkpoint upgrade QA</title><main>Local IndexedDB storage QA</main>');
      });
    } }],
  });
  await bounded(server.listen(), 'owned Vite listen');
  const address = server.httpServer.address();
  assert.equal(typeof address, 'object');
  port = address.port;
  const origin = `http://127.0.0.1:${port}`;
  report.server = { origin, port, cacheDir: process.env.VITE_CACHE_DIR, temp };
  browser = await firefox.launch({ headless: true, timeout: 60000, env: { ...process.env, TMPDIR: temp, TMP: temp, TEMP: temp } });
  report.browser = { name: 'firefox', version: browser.version(), isolatedContexts: 2 };
  for (const version of [1, 2]) {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    contexts.add(context);
    const failures = [];
    context.on('page', page => page.on('pageerror', error => failures.push(String(error.stack ?? error))));
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const allowed = url.origin === origin && request.method() === 'GET'
        && (/^\/(?:src\/|@|node_modules\/)/.test(url.pathname) || url.pathname === '/__checkpoint-upgrade');
      report.requests.push({ version, method: request.method(), path: url.origin === origin ? url.pathname : url.origin, allowed });
      if (!allowed) { failures.push(`Forbidden request: ${request.method()} ${url.origin}${url.pathname}`); await route.abort(); }
      else await route.continue();
    });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(60000);
    page.on('response', response => {
      if (!sourcePaths.some(path => new URL(response.url()).pathname === `/${path}`)) return;
      const task = response.body().then(bytes => {
        (report.source.served ??= []).push({ version, url: response.url(), status: response.status(), sha256: hash(bytes) });
        assert.equal(response.status(), 200);
      }).catch(error => { failures.push(String(error.stack ?? error)); });
      responseTasks.push(task);
    });
    const conversation = { id: 'conversation-1', title: 'Preserved', model: 'qa', savedAt: 1,
      projectContextKey: 'local:checkpoint-qa', entries: [{ kind: 'user', text: 'Storage-only original' }] };
    const checkpoint = { schemaVersion: 1, conversationId: conversation.id, runId: 'run-1', epoch: 1,
      projectId: 'checkpoint-qa', projectContextKey: conversation.projectContextKey, savedAt: 2, status: 'active',
      request: { requestId: 'request-1', text: 'Storage-only original', scope: null },
      baseContentIdentity: 'base', currentContentIdentity: 'current', workPlan: null,
      budget: { remainingToolCalls: 2, remainingOutputTokens: 100, remainingAutoRunSteps: 3,
        remainingWorkPlanSteps: 4, ralphAttemptsByItemId: [['item-1', 2]], repeatedToolFailures: [] },
      verification: { requirements: [], findings: [], attempts: [], approaches: [], resolutions: [] },
      acceptance: null, applied: null, save: null, proof: null, pending: null };
    const fixture = { version, conversation, checkpoint };
    const result = { version, fixture, failures };
    report.cases.push(result);
    await page.goto(`${origin}/__checkpoint-upgrade`, { waitUntil: 'load' });
    result.seed = await browserPhase(page, { ...fixture, phase: 'seed' });
    assert.equal(result.seed.observation.version, version);
    assert.deepEqual(result.seed.observation.stores, version === 1 ? ['conversations'] : ['conversationTombstones', 'conversations']);
    assert.deepEqual(result.seed.observation.schema.conversations, { keyPath: 'id', autoIncrement: false,
      indexes: ['projectContextKey', 'savedAt'].map(name => ({ name, keyPath: name, unique: false, multiEntry: false })) });
    await page.reload({ waitUntil: 'load' });
    result.migrated = await browserPhase(page, { ...fixture, phase: 'migrate' });
    assert.deepEqual(result.migrated.save, { durable: true, written: true });
    checkRead(result.migrated, result.seed, fixture);
    await page.reload({ waitUntil: 'load' });
    result.reopened = await browserPhase(page, { ...fixture, phase: 'reopen' });
    checkRead(result.reopened, result.seed, fixture);
    assert.deepEqual(result.reopened.observation, result.migrated.observation);
    assert.deepEqual(result.reopened.loaded, result.migrated.loaded);
    await bounded(Promise.all(responseTasks), 'served module response hashes');
    for (const path of sourcePaths) assert.ok(report.source.served.some(entry => entry.version === version && new URL(entry.url).pathname === `/${path}`));
    assert.deepEqual(failures, []);
    result.pass = true;
    await bounded(context.close(), 'isolated context cleanup');
    contexts.delete(context);
    result.contextClosed = true;
  }
  report.source.finalHead = git('rev-parse', 'HEAD');
  assert.equal(report.source.finalHead, report.source.head);
  assert.equal(git('status', '--porcelain', '--', 'src', 'test', 'vite.config.ts', 'scripts/qa/ai-harness-vite.config.mjs'), '');
  for (const path of sourcePaths) assert.equal(hash(await readFile(resolve(root, path))), report.source.hashes[path]);
  report.assertionsPassed = true;
} catch (error) {
  report.errors.push(String(error.stack ?? error));
} finally {
  async function cleanup(label, fn) {
    try { await bounded(fn(), label); report.cleanup[label] = true; }
    catch (error) { report.cleanup[label] = false; report.errors.push(String(error.stack ?? error)); }
  }
  await cleanup('contextsClosed', async () => { for (const context of contexts) await context.close(); contexts.clear(); });
  await cleanup('browserClosed', async () => {
    if (!browser) return;
    const disconnected = new Promise(resolve => browser.once('disconnected', resolve));
    await Promise.all([disconnected, browser.close()]);
    assert.equal(browser.isConnected(), false);
  });
  await cleanup('serverClosed', async () => { if (server) await server.close(); });
  await cleanup('portFree', async () => {
    if (port === undefined) return;
    const probe = createNetServer();
    try { await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(port, '127.0.0.1', resolve); }); }
    finally { if (probe.listening) await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve())); }
  });
  await cleanup('ownedTempRemoved', async () => {
    if (!temp) return;
    assert.equal(report.cleanup.browserClosed, true, 'Do not remove a live browser profile');
    assert.equal(report.cleanup.serverClosed, true, 'Do not remove a live Vite cache');
    await rm(temp, { recursive: true });
    await assert.rejects(access(temp), { code: 'ENOENT' });
  });
  if (previousCache === undefined) delete process.env.VITE_CACHE_DIR;
  else process.env.VITE_CACHE_DIR = previousCache;
  report.pass = report.assertionsPassed === true && report.errors.length === 0;
  report.finishedAt = new Date().toISOString();
  await mkdir(out, { recursive: true });
  // Exclusive outputs preserve failures and prevent an accidental second run from replacing evidence.
  await writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  await writeFile(resolve(out, 'report.md'), [
    '# Checkpoint upgrade browser QA', '', `Result: ${report.pass ? 'PASS' : 'FAIL'}`,
    `Source HEAD: ${report.source.head ?? 'not captured'}`, `Browser: ${JSON.stringify(report.browser ?? null)}`,
    '', ...report.cases.map(result => `- v${result.version} -> v3: ${result.pass ? 'PASS' : 'FAIL / incomplete'}; context closed: ${result.contextClosed === true}`),
    '', 'Checks: original conversation and index definitions, v2 tombstone, actual storage APIs, durable save, same row after full reload, malformed/foreign/future rows unsupported and unchanged.',
    'Storage API scope only: no execution recovery or exactly-once claim. No game content or Supabase writes. Existing 65-unit evidence was not rerun.',
    '', `Cleanup: ${JSON.stringify(report.cleanup)}`, '', 'JSON observations and served/source hashes: report.json',
    '', ...report.errors.map(error => `\n\`\`\`text\n${error}\n\`\`\``), '',
  ].join('\n'), { flag: 'wx' });
}
console.log(JSON.stringify({ pass: report.pass, report: resolve(out, 'report.json'), errors: report.errors, cleanup: report.cleanup }));
process.exitCode = report.pass ? 0 : 1;
