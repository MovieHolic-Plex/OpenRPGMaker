import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { aiJobsPlugin } from '../scripts/lib/aiJobs/vitePlugin.mjs';
import { openAiJobsRepository } from '../scripts/lib/aiJobs/repository.mjs';
import { createBrowserRuntime } from '../scripts/lib/aiJobs/browserExecutor.mjs';
import { createJobProviderAdapter } from '../scripts/lib/aiJobs/providerAdapter.mjs';
import { singleDispatchFetch } from '../scripts/lib/aiJobs/singleDispatchFetch.mjs';
import { httpFixture, submission, inputFor, resultFor } from './aiJobsTestSupport.mjs';

const textRequest = { kind: 'text', provider: 'google-antigravity', body: { model: 'fixture', messages: [] } };
function workerFixture() {
  const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
  let killed = 0;
  child.kill = () => { killed++; queueMicrotask(() => child.emit('close', 0)); return true; };
  const spawnWorker = () => { queueMicrotask(() => child.stdout.write('READY 32123\n')); return child; };
  return { child, spawnWorker, killed: () => killed };
}

test('missing installed Chromium rejects admission explicitly, without durable doomed work', async t => {
  const runtime = await createBrowserRuntime({ origin: 'http://127.0.0.1:19841', executablePath: '/nonexistent/ai-job-chromium' });
  assert.equal(runtime.executeJob, undefined);
  const f = await httpFixture(t, runtime);
  const session = await (await f.request('/session')).json();
  assert.equal(session.generationAvailable, false);
  assert.match(session.unavailableReason, /Chromium/);
  const response = await f.post('', submission(), { 'Idempotency-Key': 'missing-browser' });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /Chromium/);
  assert.equal(f.repository.snapshot().jobs.length, 0);
  assert.equal(f.errors.pop().code, "EXECUTOR_UNAVAILABLE");
});

test('unknown provider operation/URL never starts auth, Bun or paid fetch', async () => {
  let calls = 0;
  const dispatch = createJobProviderAdapter({ resolveKey: async () => { calls++; }, spawnWorker: () => { calls++; } });
  for (const request of [{ kind: 'fetch', url: 'https://example.com' }, { ...textRequest, url: 'https://example.com' },
    { ...textRequest, body: { ...textRequest.body, baseUrl: 'https://example.com' } }]) {
    await assert.rejects(dispatch(request, { signal: new AbortController().signal }), { code: 'PROVIDER_NOT_DISPATCHED' });
  }
  assert.equal(calls, 0);
});

test('Node-only auth is passed only to owned Bun; success closes that process', async () => {
  const f = workerFixture(); let wires = 0;
  const dispatch = createJobProviderAdapter({ resolveKey: async () => 'node-private-fixture', spawnWorker: f.spawnWorker,
    wireFetch: async (url, init) => {
      wires++; assert.equal(url, 'http://127.0.0.1:32123/complete');
      assert.equal(JSON.parse(init.body).apiKey, 'node-private-fixture');
      return Response.json({ completion: { choices: [] } });
    } });
  assert.deepEqual(await dispatch(textRequest, { signal: new AbortController().signal }), { choices: [] });
  assert.equal(wires, 1); assert.equal(f.killed(), 1);
});

test('abort disposes owned provider process and reports unknown dispatched outcome', async () => {
  const f = workerFixture(); const controller = new AbortController(); const entered = Promise.withResolvers();
  const dispatch = createJobProviderAdapter({ resolveKey: async () => 'fixture', spawnWorker: f.spawnWorker,
    wireFetch: async (_url, { signal }) => {
      const stopped = new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
      entered.resolve(); return stopped;
    } });
  const work = dispatch(textRequest, { signal: controller.signal });
  const rejected = assert.rejects(work, error => error.code !== 'PROVIDER_NOT_DISPATCHED');
  await entered.promise; controller.abort(new Error('cancelled'));
  await rejected; assert.ok(f.killed() >= 1);
});

test('actual provider fetch guard blocks SDK paid retry rather than silently spending again', async () => {
  let dispatches = 0;
  const send = singleDispatchFetch(async () => { dispatches++; throw new Error('upstream connection lost'); });
  await assert.rejects(send('https://provider.invalid'), /connection lost/);
  assert.throws(() => send('https://provider.invalid'), /retry blocked/);
  assert.equal(dispatches, 1);
});


test('persisted queued work waits for Vite listening before resolving the worker origin', { timeout: 10000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ai-job-listener-test-'));
  const previous = process.env.AI_JOBS_DIRECTORY;
  process.env.AI_JOBS_DIRECTORY = directory;
  let repository, plugin;
  const httpServer = createServer();
  const subscribed = Promise.withResolvers(), executed = Promise.withResolvers();
  const originalOnce = httpServer.once.bind(httpServer);
  httpServer.once = (event, listener) => {
    if (event === 'listening') subscribed.resolve();
    return originalOnce(event, listener);
  };
  let timer;
  try {
    repository = await openAiJobsRepository({ directory });
    await repository.admit({ idempotencyKey: 'restart-queued', input: await inputFor(repository) });
    await repository.close(); repository = null;
    plugin = aiJobsPlugin({ executeJob: async (input, host) => {
      executed.resolve(httpServer.listening); return resultFor(input, host);
    } });
    await plugin.configureServer({ httpServer, config: { root: process.cwd(), server: {}, preview: {}, logger: { error: error => { throw error; } } },
      middlewares: { use() {} }, close: async () => {} });
    const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Queued executor did not subscribe to Vite listening')), 3000); });
    await Promise.race([subscribed.promise, deadline]); clearTimeout(timer);
    httpServer.listen(0, '127.0.0.1');
    assert.equal(await executed.promise, true);
  } finally {
    clearTimeout(timer);
    if (plugin) await plugin.closeBundle();
    if (repository) await repository.close();
    if (httpServer.listening) await new Promise(resolve => httpServer.close(resolve));
    if (previous === undefined) delete process.env.AI_JOBS_DIRECTORY; else process.env.AI_JOBS_DIRECTORY = previous;
    await rm(directory, { recursive: true, force: true });
  }
});
