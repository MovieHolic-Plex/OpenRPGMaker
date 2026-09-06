import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJobProviderAdapter } from './providerAdapter.mjs';

/** Probes installed runtime only; never installs a browser or uses a user profile. */
export async function createBrowserRuntime({ origin, cacheDir, executablePath, chromium: suppliedChromium, dispatchProvider = createJobProviderAdapter() } = {}) {
  let chromium = suppliedChromium;
  try {
    chromium ??= (await import('playwright')).chromium;
    executablePath ??= chromium.executablePath();
    await access(executablePath, constants.X_OK);
  } catch {
    return { unavailableReason: 'Managed Chromium is unavailable. Run npm run setup:ai-runtime in the project folder, then restart the local server before submitting AI jobs.' };
  }
  return {
    dispatchProvider,
    executeJob: (input, host, signal) => run('generation', input, host, signal),
    renderReport: (result, host, signal) => run('report', result, host, signal),
  };
  async function run(stage, input, host, signal) {
      signal.throwIfAborted();
      const base = new URL(typeof origin === 'function' ? origin() : origin);
      if (!['http:', 'https:'].includes(base.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)) throw new Error('Worker bootstrap must be a local server origin');
      const bootstrap = new URL('/ai-job-worker.html', base).href;
      const assetFailure = Promise.withResolvers();
      const awaitWorker = async work => {
        const outcome = await Promise.race([
          work.then(value => ({ ok: true, value })),
          assetFailure.promise.then(error => ({ ok: false, error })),
        ]);
        if (!outcome.ok) throw outcome.error;
        return outcome.value;
      };
      let browser, context, closing;
      const dispose = () => closing ??= (async () => {
        try { if (context) await context.close(); }
        finally { if (browser) await browser.close(); }
      })();
      // Handles launch races: after launch resolves the abort fence enters finally and closes it.
      const abort = () => { if (browser) void dispose().catch(error => console.error('AI job browser cleanup failed', error)); };
      signal.addEventListener('abort', abort, { once: true });
      try {
        browser = await chromium.launch({ headless: true, executablePath });
        signal.throwIfAborted();
        context = await browser.newContext({ serviceWorkers: 'block', ignoreHTTPSErrors: true, acceptDownloads: false });
        signal.throwIfAborted();
        await context.route('**/*', route => (async () => {
          const request = route.request();
          const url = new URL(request.url());
          if (url.origin !== base.origin || request.method() !== 'GET') return route.abort('blockedbyclient');
          if (url.pathname === '/@vite/client') return route.fulfill({ contentType: 'text/javascript', body: '' });
          let cachedAsset = false;
          if (cacheDir && url.pathname.startsWith('/@fs/')) {
            try {
              const file = fileURLToPath(new URL(`file:///${url.pathname.slice('/@fs/'.length)}`));
              const path = relative(resolve(cacheDir), file);
              cachedAsset = path !== '' && path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
            } catch {
              return route.abort('blockedbyclient');
            }
          }
          const asset = /^\/(?:assets\/|src\/|node_modules\/\.vite\/|@id\/)/.test(url.pathname)
            || /^\/@fs\/.*\/node_modules\//.test(url.pathname) || cachedAsset;
          if (request.isNavigationRequest() ? request.url() !== bootstrap : !asset) return route.abort('blockedbyclient');
          // The Node-owned asset transport avoids Chromium network-change invalidation of
          // the dev module graph. The allowlist above applies before fetching; redirects
          // cannot escape to a remote origin or an API endpoint.
          // Only idempotent, allowlisted static GETs may retry ECONNRESET once.
          // This does not touch the single-dispatch paid provider boundary.
          const response = await route.fetch({ maxRedirects: 0, maxRetries: 1 });
          if (response.status() >= 300 && response.status() < 400) return route.abort('blockedbyclient');
          await route.fulfill({ response });
        })().catch(error => {
          // Playwright route callbacks are independent of goto/evaluate. Keep
          // their errors owned by this attempt; its finally closes the realm.
          assetFailure.resolve(error);
        }));
        await context.routeWebSocket('**/*', socket => socket.close());
        const page = await context.newPage();
        let readyResolve, readyReject;
        const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
        // Attach a handler immediately; navigation may reject before readiness is awaited.
        ready.catch(() => {});
        const timer = setTimeout(() => readyReject(new Error('Isolated worker bootstrap timed out')), 30_000);
        const checkSource = source => {
          signal.throwIfAborted();
          if (source.page !== page || source.frame !== page.mainFrame() || source.frame.url() !== bootstrap) throw new Error('Untrusted job binding source');
        };
        try {
          page.once('pageerror', error => readyReject(error));
          page.once('close', () => readyReject(new Error('Isolated worker closed before ready')));
          await page.exposeBinding('__aiJobReady', source => { checkSource(source); readyResolve(); });
          await page.exposeBinding('__aiJobHost', async (source, method, args) => {
            checkSource(source);
            if (!Array.isArray(args)) throw new Error('Invalid job binding arguments');
            if (stage === 'report' && !['readBlob', 'readJson', 'putBlob', 'putJson', 'saveReport'].includes(method)) throw new Error('Report worker has no generation/provider authority');
            switch (method) {
              case 'saveReport': return host.saveReport(args[0]);
              case 'readBlob': return Array.from(await host.readBlob(args[0]));
              case 'readJson': return host.readJson(args[0]);
              case 'putBlob': return host.putBlob(new Uint8Array(args[0]), args[1]);
              case 'putJson': return host.putJson(args[0]);
              case 'loadCheckpoint': return host.loadCheckpoint();
              case 'saveCheckpoint': return host.saveCheckpoint(args[0]);
              case 'providerOperation': return host.providerOperation(args[0]);
              default: throw new Error(`Unknown job host operation: ${method}`);
            }
          });
          await awaitWorker(page.goto(bootstrap, { waitUntil: 'domcontentloaded' }));
          await awaitWorker(ready);
          return await awaitWorker(page.evaluate(({ stage, input, identity, report }) => stage === 'report'
            ? window.__renderAiJobReport(report, identity) : window.__executeAiJob(input, identity), {
            stage, input, report: stage === 'report' ? host.report : null,
            identity: { jobId: host.jobId, attemptId: host.attemptId, dependencies: host.dependencies },
          }));
        } finally { clearTimeout(timer); }
      } finally {
        signal.removeEventListener('abort', abort);
        await dispose();
      }
  }
}
