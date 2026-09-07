// Explicit Task8 entry point. Does not load vite.config, .env, provider handlers or DB proxies.
import { createServer as createVite } from 'vite';
import { createServer as createHttp } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { openAiJobsService } from '../../../../scripts/lib/aiJobs/service.mjs';
import { createQaWire, createQaPersistence, createTask8Runtime, PROJECT_ID } from './qa-wire.mjs';
import { rejectSecrets } from '../../../../scripts/lib/aiJobs/providerOperations.mjs';

export async function startTask8Fixture({ root = process.cwd(), port = 0,
  runId = randomUUID(), temporary, cleanupPath, zodEntry } = {}) {
  if ([9841, 19841].includes(port)) throw new Error('Shared ports are forbidden for Task8');
  temporary ??= await mkdtemp(join(tmpdir(), 'task8-editor-'));
  cleanupPath ??= join(root, '.omo/evidence/ai-job-queue/task-8', `fixture-${runId}-cleanup.json`);
  const browsers = new Set(), browserEvents = [], errors = [], mirrors = [];
  let service, vite, closing, origin, off, finalWireCounts;
  const http = createHttp();
  const wire = createQaWire({ getService: () => service });
  const persistence = createQaPersistence(wire);
  const ownedChromium = { executablePath: () => chromium.executablePath(), async launch(options) {
    const browser = await chromium.launch({ ...options, handleSIGTERM: false, handleSIGINT: false, handleSIGHUP: false });
    browsers.add(browser); browserEvents.push('launched');
    const close = browser.close.bind(browser);
    browser.close = async () => { await close(); browsers.delete(browser); browserEvents.push('closed'); };
    return browser;
  } };
  const counts = () => ({ runId, origin, ...(finalWireCounts ?? wire.counts()), persistence: persistence.status(), mirrorWrites: mirrors.length, activeBrowsers: browsers.size, errors });
  const requestClose = () => { void close().catch(error => { console.error(error); process.exitCode = 1; }); };
  async function close() {
    if (closing) return closing;
    closing = (async () => {
      const receipt = { runId, temporary, removed: false, serviceClosed: false, serverClosed: false, cleanupErrors: [] };
      const record = () => writeFile(cleanupPath, JSON.stringify({ ...receipt, ...counts(), browserEvents }, null, 2));
      async function stage(name, action) {
        receipt.stage = name; await record();
        try { await action(); } catch (error) { receipt.cleanupErrors.push(`${name}: ${error.stack ?? error}`); console.error(error); }
        await record();
      }
      wire.close();
      await stage('service', async () => {
        try { await service?.scheduler.close(); }
        finally {
          // Capture final ledger AFTER draining but BEFORE repository closure.
          finalWireCounts = wire.counts();
          await service?.close(); off?.(); receipt.serviceClosed = true;
        }
      });
      await stage('browsers', async () => {
        const settled = await Promise.allSettled([...browsers].map(b => b.close()));
        const failures = settled.filter(s => s.status === 'rejected');
        if (failures.length) throw new AggregateError(failures.map(f => f.reason));
      });
      await stage('vite', async () => { await vite?.close(); });
      await stage('http', async () => {
        if (http.listening) await new Promise((yes, no) => { http.close(error => error ? no(error) : yes()); http.closeIdleConnections(); });
        receipt.serverClosed = true;
      });
      await stage('temporary', async () => { await rm(temporary, { recursive: true, force: true }); receipt.removed = true; });
      receipt.stage = 'complete'; await record();
      for (const signal of ['SIGTERM', 'SIGINT']) process.removeListener(signal, requestClose);
      if (receipt.cleanupErrors.length) throw new Error('Task8 fixture cleanup incomplete');
      return receipt;
    })(); return closing;
  }
  const json = (res, status, value) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
  async function body(req) {
    if (req.method === 'GET') return {};
    if (!req.headers['content-type']?.startsWith('application/json')) throw Object.assign(new Error('JSON required'), { status: 415 });
    let size = 0; const chunks = [];
    for await (const chunk of req) { size += chunk.length; if (size > 32 * 1024 * 1024) throw Object.assign(new Error('Fixture body too large'), { status: 413 }); chunks.push(chunk); }
    return chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
  }
  try {
    // Listen on the kernel-assigned port; never probe or shutdown a foreign listener.
    http.listen(port, '127.0.0.1'); await once(http, 'listening');
    origin = `http://127.0.0.1:${http.address().port}`;
    const backend = `task8-local:${runId}`;
    const runtime = await createTask8Runtime(wire, { origin, cacheDir: join(temporary, 'cache'), chromium: ownedChromium });
    if (runtime.unavailableReason) throw new Error(runtime.unavailableReason);
    service = await openAiJobsService({ directory: join(temporary, 'jobs'), origins: [origin], ...runtime, configuredBackend: backend,
      onError: error => { errors.push(String(error.stack ?? error)); console.error('TASK8_SERVICE_ERROR', error); } });
    off = service.scheduler.subscribe(event => wire.emit('job-event', { jobId: event.jobId, event }));
    const priorSigtermListeners = new Set(process.listeners('SIGTERM'));
    vite = await createVite({ root, configFile: false, envFile: false, envPrefix: 'TASK8_NO_CLIENT_ENV_', cacheDir: join(temporary, 'cache'),
      define: { 'import.meta.env.VITE_SUPABASE_USE_PROXY': JSON.stringify('1'), 'import.meta.env.VITE_SUPABASE_PROJECT_ID': JSON.stringify(PROJECT_ID) },
      resolve: { alias: { '@': join(root, 'src'), ...(zodEntry ? { zod: await realpath(zodEntry) } : {}) } },
      server: { middlewareMode: true, hmr: { server: http }, fs: { allow: [root, await realpath(join(root, 'node_modules')), ...(zodEntry ? [dirname(await realpath(zodEntry))] : [])], deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**'] } },
    });
    for (const listener of process.listeners('SIGTERM')) if (!priorSigtermListeners.has(listener)) process.removeListener('SIGTERM', listener);
    http.on('request', (req, res) => { void (async () => {
      const url = new URL(req.url, origin), path = url.pathname;
      // CSP is an additional UI safety fence, not the Node provider safety boundary.
      res.setHeader('Content-Security-Policy', "connect-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; form-action 'self'; frame-src 'self'; object-src 'none'");
      if (req.headers.host !== new URL(origin).host || req.headers.origin && req.headers.origin !== origin) {
        wire.violation('foreign-origin', { method: req.method, path }); return json(res, 403, { error: 'Foreign Host/Origin' });
      }
      if (path.startsWith('/__task8/')) {
        if (req.method !== 'POST' || req.headers['x-task8-run-id'] !== runId) return json(res, 403, { error: 'Task8 run identity required' });
        const value = await body(req); let result;
        switch (path.slice('/__task8/'.length)) {
          case 'plan': result = wire.plan(value); break;
          case 'wait': {
            const controller = new AbortController();
            const disconnect = () => { if (!res.writableEnded) controller.abort(); };
            res.once('close', disconnect);
            try { result = await wire.wait(value, controller.signal); } finally { res.removeListener('close', disconnect); } break;
          }
          case 'release': result = wire.release(value); break;
          case 'counts': result = counts(); break;
          case 'persistence/init': result = persistence.initialize(value); break;
          case 'persistence/configure': result = persistence.configure(value); break;
          case 'persistence/snapshot': result = persistence.snapshot(); break;
          case 'shutdown': res.once('finish', requestClose); result = { runId }; break;
          default: return json(res, 404, { error: 'Unknown fixture control' });
        }
        return json(res, 200, result);
      }
      if (req.method === 'POST' && ['/__oprn/edit-activity', '/__oprn/ai-activity'].includes(path)) {
        if (!persistence.status().initialized) throw wire.violation('uninitialized-mirror', { path });
        const entry = await body(req); rejectSecrets(entry);
        mirrors.push({ path, entry }); wire.emit('local-mirror-write', { path }); return json(res, 200, {});
      }
      if (path.startsWith('/supabase/')) return json(res, 200, persistence.request(req.method, url, await body(req)));
      if (path === '/api/ai-jobs' || path.startsWith('/api/ai-jobs/')) return service.handler(req, res, () => json(res, 404, {}));
      if (req.method === 'GET' && path === '/auth/status') return json(res, 200, { connected: true, authKind: 'local', expired: false, env: false, planType: 'task8-controlled' });
      if (req.method === 'GET' && path === '/auth/providers') return json(res, 200, { providers: ['google-antigravity', 'openai-codex'].map(id => ({ id, label: id, authKind: 'local', defaultModel: id === 'openai-codex' ? 'gpt-5.4' : 'gemini-3.7-flash', hasLogin: false, hasRefresh: false })) });
      // ALL legacy API/auth/proxy routes are blocked BEFORE Vite. No real handlers installed.
      if (/^\/(api|v1|auth|supabase)(\/|$)/.test(path) || req.method !== 'GET') {
        wire.violation('legacy-http', { method: req.method, path }); return json(res, 451, { error: 'Task8 forbids legacy/provider HTTP' });
      }
      if (path === '/task8-bootstrap.html') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><title>Task8 backend bootstrap</title></head><body></body></html>'); return; }
      vite.middlewares(req, res, () => json(res, 404, {}));
    })().catch(error => { if (!res.destroyed) json(res, error.status ?? 500, { error: error.message, code: error.code }); }); });
    for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, requestClose);
    return { origin, runId, service, wire, persistence, counts, close, temporary, backend };
  } catch (error) { await close(); throw error; }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const fixture = await startTask8Fixture({ port: Number(process.env.DEV_SERVER_PORT ?? 0), runId: process.env.TASK7_RUN_ID,
    temporary: process.env.TASK7_TEMPORARY, cleanupPath: process.env.TASK7_CLEANUP_PATH, zodEntry: process.env.TASK8_ZOD_ENTRY });
  console.log(`TASK8_EDITOR_READY ${JSON.stringify({ origin: fixture.origin, runId: fixture.runId })}`);
}
