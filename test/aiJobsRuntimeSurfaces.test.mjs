import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { existsSync, constants } from 'node:fs';
import { access, mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, createServer, preview } from 'vite';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const workerPath = '/src/ai/jobs/workerEntry.ts';
const readPaths = ['/api/ai-jobs', '/api/ai-jobs/session', '/api/ai-jobs/events', '/ai-job-worker.html'];

function assertReadRequest(method, url, origin, modulePath) {
  assert.equal(method, 'GET', 'Runtime smoke must never mutate or admit');
  assert.equal(url.origin, origin, 'Runtime smoke must stay on its owned listener');
  assert.equal(url.search, '', 'Runtime smoke uses only exact read endpoints');
  assert(readPaths.includes(url.pathname) || url.pathname === modulePath, 'Unexpected runtime request');
}

function workerModule(html, expectedPath, origin) {
  const sources = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/gi)].map(match => new URL(match[1], origin));
  const matches = sources.filter(url => url.origin === origin && url.pathname === expectedPath && !url.search && !url.hash);
  assert.equal(matches.length, 1, 'HTML must reference exactly the real worker module');
  return matches[0];
}

function assertEmpty(snapshot) {
  for (const key of ['jobs', 'attempts', 'operations', 'events', 'inbox']) assert.deepEqual(snapshot[key], [], key);
}

test('runtime smoke rejects unsafe requests and missing, duplicate or foreign worker entries', () => {
  const origin = 'http://127.0.0.1:12345'; // Parser-only control; no listener or HTTP request.
  for (const [method, path] of [['POST', '/api/ai-jobs'], ['GET', '/v1/chat/completions'],
    ['GET', '/supabase/rest/v1/projects'], ['GET', '/api/ai-jobs?admit=1']]) {
    assert.throws(() => assertReadRequest(method, new URL(path, origin), origin, workerPath));
  }
  assert.throws(() => assertReadRequest('GET', new URL('/api/ai-jobs', 'https://foreign.invalid'), origin, workerPath));
  const script = `<script type="module" src="${workerPath}"></script>`;
  assert.equal(workerModule(script, workerPath, origin).pathname, workerPath);
  for (const html of ['', '<script src="/src/main.ts"></script>', script + script,
    `<script src="https://foreign.invalid${workerPath}"></script>`]) {
    assert.throws(() => workerModule(html, workerPath, origin));
  }
});

test('actual dev and built preview expose only read-tested empty queues and await durable shutdown', { timeout: 180000 }, async t => {
  // Resolve/probe the already installed package before isolating HOME. No launch/install.
  await access(chromium.executablePath(), constants.X_OK);
  const temporary = await mkdtemp(join(tmpdir(), 'ai-jobs-runtime-surfaces-'));
  const envDirectory = join(temporary, 'env');
  await mkdir(envDirectory);
  const previousCwd = process.cwd();
  const previousEnv = { ...process.env };
  const nativeFetch = globalThis.fetch;
  let origin, modulePath, server;
  const requests = [], violations = [], receipts = [];
  const diagnostic = { temporaryRemoved: false, modes: receipts };
  try {
    // vite.config.ts explicitly calls loadEnv(mode, process.cwd(), ''). envDir alone
    // cannot isolate it. Never load a maintainer's .env, auth store or queued records.
    process.chdir(envDirectory);
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, {
      PATH: previousEnv.PATH ?? '', HOME: envDirectory, TMPDIR: temporary,
      DEV_SERVER_NO_TLS: '1', SUPABASE_UPSTREAM_URL: 'http://127.0.0.1:1',
      VITE_CACHE_DIR: join(temporary, 'build-cache'), AI_JOBS_DIRECTORY: join(temporary, 'build-jobs'),
    });
    globalThis.fetch = (input, init = {}) => {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
      const method = init.method ?? (input instanceof Request ? input.method : 'GET');
      try { assertReadRequest(method, url, origin, modulePath); }
      catch (error) { violations.push('outbound-request'); throw error; }
      return nativeFetch(input, init);
    };
    const outDir = join(temporary, 'dist');
    await build({
      root, configFile: join(root, 'vite.config.ts'), configLoader: 'runner', envDir: envDirectory,
      logLevel: 'error', build: { outDir, emptyOutDir: true, copyPublicDir: false, manifest: true },
      plugins: [{
        name: 'test-scope-real-worker-build',
        configResolved(config) {
          const input = config.build.rollupOptions.input;
          assert.equal(input.aiJobWorker, join(root, 'ai-job-worker.html'));
          // Build the configured real entry/closure, not a fabricated HTML fixture or UI.
          config.build.rollupOptions.input = { aiJobWorker: input.aiJobWorker };
        },
      }],
    });
    assert.equal(existsSync(process.env.AI_JOBS_DIRECTORY), false, 'Build must not start the queue');
    const manifest = JSON.parse(await readFile(join(outDir, '.vite/manifest.json'), 'utf8'));
    const emitted = manifest['ai-job-worker.html'];
    assert.equal(emitted.isEntry, true);
    assert(emitted.file.startsWith('assets/') && emitted.file.endsWith('.js'));

    for (const mode of ['dev', 'preview']) {
      const directory = join(temporary, `${mode}-jobs`);
      assert.equal(existsSync(directory), false, 'Never attach to existing jobs');
      process.env.AI_JOBS_DIRECTORY = directory;
      process.env.VITE_CACHE_DIR = join(temporary, `${mode}-cache`);
      modulePath = mode === 'dev' ? workerPath : `/${emitted.file}`;
      let sseResponse;
      const ingress = target => {
        target.middlewares.use((req, res, next) => {
          try {
            assertReadRequest(req.method, new URL(req.url, origin), origin, modulePath);
            requests.push({ mode, method: req.method, path: new URL(req.url, origin).pathname });
            if (req.url === '/api/ai-jobs/events') sseResponse = res;
            next();
          } catch {
            violations.push('inbound-request');
            res.writeHead(451); res.end('Runtime smoke denied unexpected request');
          }
        });
      };
      const options = {
        root, configFile: join(root, 'vite.config.ts'), configLoader: 'runner', envDir: envDirectory,
        logLevel: 'error', build: { outDir },
        server: { host: '127.0.0.1', port: 0, strictPort: true, hmr: false, watch: null },
        preview: { host: '127.0.0.1', port: 0, strictPort: true },
        optimizeDeps: { noDiscovery: true, include: [] },
        plugins: [{ name: 'test-read-only-ingress', enforce: 'pre', configureServer: ingress, configurePreviewServer: ingress }],
      };
      server = mode === 'dev' ? await createServer(options) : await preview(options);
      if (mode === 'dev') {
        // Vite's server.listen() treats port 0 as falsy and selects 5173. Its
        // public HTTP listener still runs Vite's init wrapper, with a real OS port 0.
        const listening = once(server.httpServer, 'listening', { signal: AbortSignal.timeout(15000) });
        server.httpServer.listen(0, '127.0.0.1');
        await listening;
      }
      const address = server.httpServer.address();
      assert(address && typeof address !== 'string');
      assert(![9841, 19841].includes(address.port));
      origin = `http://127.0.0.1:${address.port}`;
      const get = async path => {
        const response = await fetch(new URL(path, origin), { redirect: 'error', signal: AbortSignal.timeout(15000) });
        assert.equal(response.status, 200, `${mode} ${path}`);
        return response;
      };
      const session = await (await get('/api/ai-jobs/session')).json();
      assert.equal(session.generationAvailable, true);
      assert.equal(session.reportAvailable, true);
      assert.equal(session.requiresRestart, false);
      assert.deepEqual((await (await get('/api/ai-jobs')).json()).jobs, []);
      const html = await (await get('/ai-job-worker.html')).text();
      const entry = workerModule(html, modulePath, origin);
      const moduleResponse = await get(entry.pathname);
      assert.match(moduleResponse.headers.get('content-type'), /javascript/);
      const bytes = Buffer.from(await moduleResponse.arrayBuffer());
      if (mode === 'preview') assert.deepEqual(bytes, await readFile(join(outDir, emitted.file)));
      else {
        const transformed = await server.transformRequest(workerPath);
        assert(transformed.map?.mappings, 'The real TypeScript worker must carry its dev source map');
        const sourceMap = Buffer.from(JSON.stringify(transformed.map)).toString('base64');
        assert.deepEqual(bytes, Buffer.from(`${transformed.code}\n//# sourceMappingURL=data:application/json;base64,${sourceMap}`));
        for (const name of ['__aiJobReady', '__executeAiJob', '__renderAiJobReport']) assert(bytes.includes(name));
      }
      const snapshot = () => readFile(join(directory, 'metadata.json'), 'utf8').then(text => JSON.parse(text).snapshot);
      assertEmpty(await snapshot());
      assert.equal(existsSync(join(directory, 'writer.lock')), true);
      // Subscribe to the stream end and HTTP close before invoking the real close API.
      const stream = await get('/api/ai-jobs/events');
      assert.match(stream.headers.get('content-type'), /text\/event-stream/);
      assert(sseResponse && !sseResponse.writableEnded && !sseResponse.destroyed, 'SSE must still be live before close');
      const streamEnded = stream.body.getReader().read();
      let lockPresentAtHttpClose;
      server.httpServer.once('close', () => { lockPresentAtHttpClose = existsSync(join(directory, 'writer.lock')); });
      const closed = once(server.httpServer, 'close', { signal: AbortSignal.timeout(15000) });
      await Promise.all([server.close(), closed]);
      assert.equal((await streamEnded).done, true);
      assert.equal(server.httpServer.listening, false);
      assert.equal(lockPresentAtHttpClose, false, 'Storage close must precede listener close, not race it');
      assertEmpty(await snapshot());
      server = undefined;
      // Reacquisition discriminates completed writer teardown from a merely closed socket.
      const { openAiJobsRepository } = await import('../scripts/lib/aiJobs/repository.mjs');
      const reopened = await openAiJobsRepository({ directory });
      try { assertEmpty(reopened.snapshot()); }
      finally { await reopened.close(); }
      assert.equal(existsSync(join(directory, 'writer.lock')), false);
      receipts.push({ mode, port: address.port, streamEnded: true, listenerClosed: true,
        lockReleasedBeforeHttpClose: true, repositoryReopenedEmpty: true, jobs: 0, operations: 0 });
    }
    assert.deepEqual(violations, []);
    assert.deepEqual(requests, ['dev', 'preview'].flatMap(mode =>
      ['/api/ai-jobs/session', '/api/ai-jobs', '/ai-job-worker.html',
        mode === 'dev' ? workerPath : `/${emitted.file}`, '/api/ai-jobs/events']
        .map(path => ({ mode, method: 'GET', path }))));
  } finally {
    try {
      if (server) await server.close();
      await rm(temporary, { recursive: true, force: true });
      diagnostic.temporaryRemoved = !existsSync(temporary);
    } finally {
      globalThis.fetch = nativeFetch;
      process.chdir(previousCwd);
      for (const key of Object.keys(process.env)) delete process.env[key];
      Object.assign(process.env, previousEnv);
      t.diagnostic(JSON.stringify({ ...diagnostic, requests: requests.length, violations }));
    }
  }
});
