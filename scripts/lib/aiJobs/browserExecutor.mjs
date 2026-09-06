import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createJobProviderAdapter } from './providerAdapter.mjs';

/** Probes installed runtime only; never installs a browser or uses a user profile. */
export async function createBrowserRuntime({ origin, executablePath, chromium: suppliedChromium, dispatchProvider = createJobProviderAdapter() } = {}) {
  let chromium = suppliedChromium;
  try {
    chromium ??= (await import('playwright')).chromium;
    executablePath ??= chromium.executablePath();
    await access(executablePath, constants.X_OK);
  } catch {
    return { unavailableReason: 'Managed Chromium is unavailable. Install the project Playwright Chromium runtime before submitting AI jobs.' };
  }
  return {
    dispatchProvider,
    async executeJob(input, host, signal) {
      signal.throwIfAborted();
      const base = new URL(typeof origin === 'function' ? origin() : origin);
      if (!['http:', 'https:'].includes(base.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)) throw new Error('Worker bootstrap must be a local server origin');
      const bootstrap = new URL('/ai-job-worker.html', base).href;
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
        await context.route('**/*', async route => {
          const request = route.request();
          const url = new URL(request.url());
          if (url.origin !== base.origin || request.method() !== 'GET') return route.abort('blockedbyclient');
          if (url.pathname === '/@vite/client') return route.fulfill({ contentType: 'text/javascript', body: '' });
          const asset = /^\/(?:assets\/|src\/|node_modules\/\.vite\/|@id\/)/.test(url.pathname)
            || /^\/@fs\/.*\/node_modules\//.test(url.pathname);
          if (request.isNavigationRequest() ? request.url() !== bootstrap : !asset) return route.abort('blockedbyclient');
          // The Node-owned asset transport avoids Chromium network-change invalidation of
          // the dev module graph. The allowlist above applies before fetching; redirects
          // cannot escape to a remote origin or an API endpoint.
          const response = await route.fetch({ maxRedirects: 0, maxRetries: 0 });
          if (response.status() >= 300 && response.status() < 400) return route.abort('blockedbyclient');
          await route.fulfill({ response });
        });
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
            switch (method) {
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
          await page.goto(bootstrap, { waitUntil: 'domcontentloaded' });
          await ready;
          return await page.evaluate(({ input, identity }) => window.__executeAiJob(input, identity), {
            input, identity: { jobId: host.jobId, attemptId: host.attemptId, dependencies: host.dependencies },
          });
        } finally { clearTimeout(timer); }
      } finally {
        signal.removeEventListener('abort', abort);
        await dispose();
      }
    },
  };
}
