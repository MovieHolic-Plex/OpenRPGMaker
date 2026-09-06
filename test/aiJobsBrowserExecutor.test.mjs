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

test('worker transport permits only the configured external Vite cache, not adjacent files', async () => {
  const origin = 'http://127.0.0.1:19841';
  const cacheDir = join(tmpdir(), 'ai-worker-cache fixture');
  const bootstrap = `${origin}/ai-job-worker.html`;
  const frame = { url: () => bootstrap };
  const page = new EventEmitter();
  const bindings = new Map();
  const decisions = [];
  let routeHandler, contextClosed = false, browserClosed = false;
  const context = {
    route: async (_pattern, handler) => { routeHandler = handler; },
    routeWebSocket: async () => {},
    newPage: async () => page,
    close: async () => { contextClosed = true; },
  };
  page.mainFrame = () => frame;
  page.exposeBinding = async (name, handler) => { bindings.set(name, handler); };
  page.goto = async () => {
    const paths = [
      `${origin}/@fs${cacheDir}/deps/zod.js`,
      `${origin}/@fs${join(tmpdir(), 'ai-worker-private')}/metadata.json`,
      `${origin}/@fs${cacheDir}/..%2fprivate.json`,
      'https://other.invalid/assets/runtime.js',
    ];
    for (const path of paths) {
      await routeHandler({
        request: () => ({ url: () => new URL(path).href, method: () => 'GET', isNavigationRequest: () => false }),
        fetch: async () => ({ status: () => 200 }),
        fulfill: async () => { decisions.push('allowed'); },
        abort: async () => { decisions.push('blocked'); },
      });
    }
    await bindings.get('__aiJobReady')({ page, frame });
  };
  page.evaluate = async () => decisions;
  const chromium = {
    executablePath: () => process.execPath,
    launch: async () => ({
      newContext: async () => context,
      close: async () => { browserClosed = true; },
    }),
  };
  const runtime = await createBrowserRuntime({ origin, cacheDir, chromium });
  const result = await runtime.executeJob({}, { jobId: 'cache-job', attemptId: 'cache-attempt', dependencies: [] }, new AbortController().signal);
  assert.deepEqual(result, ['allowed', 'blocked', 'blocked', 'blocked']);
  assert.equal(contextClosed, true);
  assert.equal(browserClosed, true);
});

test('asset routing failures stay owned by the job instead of escaping the async handler', async () => {
  const origin = 'http://127.0.0.1:19841';
  const page = new EventEmitter();
  const controller = new AbortController();
  let handler, escaped, closed = false;
  const context = {
    route: async (_pattern, callback) => { handler = callback; },
    routeWebSocket: async () => {},
    newPage: async () => page,
    close: async () => { closed = true; page.emit('close'); },
  };
  page.mainFrame = () => ({ url: () => `${origin}/ai-job-worker.html` });
  page.exposeBinding = async () => {};
  page.goto = async () => {
    // Playwright dispatches this callback independently of page.goto. Observe
    // escaping errors rather than letting the test process itself crash.
    void handler({
      request: () => ({ url: () => `${origin}/assets/runtime.js`, method: () => 'GET', isNavigationRequest: () => false }),
      fetch: async () => { throw new Error('asset connection reset'); },
      abort: async () => {},
    }).catch(error => { escaped = error; controller.abort(error); });
  };
  page.evaluate = async () => { throw new Error('Unloaded worker must not execute'); };
  const runtime = await createBrowserRuntime({
    origin, chromium: {
      executablePath: () => process.execPath,
      launch: async () => ({ newContext: async () => context, close: async () => {} }),
    },
  });
  const outcome = await runtime.executeJob({}, { jobId: 'asset-job', attemptId: 'asset-attempt', dependencies: [] }, controller.signal)
    .then(() => null, error => error);
  assert.equal(escaped, undefined);
  assert.match(outcome.message, /asset connection reset/);
  assert.equal(closed, true);
});

test('real browser boot tolerates one reset of an allowed static GET without a provider call', { timeout: 30000 }, async t => {
  let scriptRequests = 0;
  const server = createServer((request, response) => {
    if (request.url === '/assets/boot.js') {
      scriptRequests++;
      if (scriptRequests === 1) { request.socket.destroy(); return; }
      response.writeHead(200, { 'Content-Type': 'text/javascript' });
      response.end('window.__executeAiJob = async () => ({ booted: true }); await window.__aiJobReady();');
      return;
    }
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<!doctype html><script type="module" src="/assets/boot.js"></script>');
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });
  const listening = new Promise(resolve => server.once('listening', resolve));
  server.listen(0, '127.0.0.1');
  await listening;
  const runtime = await createBrowserRuntime({
    origin: `http://127.0.0.1:${server.address().port}`,
    dispatchProvider: async () => { throw new Error('Static loading must never dispatch a provider'); },
  });
  const result = await runtime.executeJob({}, { jobId: 'reset-job', attemptId: 'reset-attempt', dependencies: [] }, new AbortController().signal);
  assert.deepEqual(result, { booted: true });
  assert.equal(scriptRequests, 2);
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
    const cacheDir = join(directory, 'vite-cache');
    plugin = aiJobsPlugin(async options => {
      assert.equal(options.cacheDir, cacheDir);
      return { executeJob: async (input, host) => {
        executed.resolve(httpServer.listening); return resultFor(input, host);
      } };
    });
    await plugin.configureServer({ httpServer, config: { root: process.cwd(), cacheDir, server: {}, preview: {}, logger: { error: error => { throw error; } } },
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
