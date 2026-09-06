import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { aiJobsDirectory, openAiJobsService } from './service.mjs';

/** Task 3 injects its managed browser executor here; never fall back to page-owned work. */
export function aiJobsPlugin(runtime = {}) {
  const services = new Set();
  async function attach(server, preview) {
    const origins = () => {
      const address = server.httpServer?.address();
      if (!address || typeof address === 'string') return [];
      const protocol = (preview ? server.config.preview.https : server.config.server.https) ? 'https' : 'http';
      return ['127.0.0.1', 'localhost', '[::1]'].map(host => `${protocol}://${host}:${address.port}`);
    };
    const execution = typeof runtime === 'function' ? await runtime({ origin: () => origins()[0], cacheDir: server.config.cacheDir }) : runtime;
    const executeJob = execution.executeJob && (async (input, host, signal) => {
      if (!server.httpServer.listening) await once(server.httpServer, 'listening', { signal });
      signal.throwIfAborted();
      return execution.executeJob(input, host, signal);
    });
    const proxy = (preview ? server.config.preview.proxy : server.config.server.proxy)?.['/supabase'];
    const target = typeof proxy === 'object' ? proxy.target : null;
    const normalizedTarget = target ? new URL(String(target)) : null;
    if (normalizedTarget) { normalizedTarget.username = ''; normalizedTarget.password = ''; normalizedTarget.search = ''; normalizedTarget.hash = ''; }
    const configuredBackend = normalizedTarget ? `supabase-proxy:${createHash('sha256').update(normalizedTarget.href.replace(/\/+$/, '') + ':rpg_zzu').digest('hex')}` : null;
    const service = await openAiJobsService({ configuredBackend, directory: aiJobsDirectory(server.config.root), origins, ...execution, executeJob });
    services.add(service);
    server.middlewares.use(service.handler);
    // Preview does not run Rollup closeBundle. Await durable shutdown BEFORE closing
    // its HTTP listener, including live SSE connections and executor teardown.
    const closeServer = server.close.bind(server);
    server.close = async () => {
      try { await service.close(); services.delete(service); }
      finally { await closeServer(); }
    };
    server.httpServer?.once('close', () => { service.close().then(() => services.delete(service), error => server.config.logger.error(String(error))); });
  }
  return {
    name: 'rpgzzu-durable-ai-jobs',
    configureServer: server => attach(server, false),
    configurePreviewServer: server => attach(server, true),
    async closeBundle() { await Promise.all([...services].map(service => service.close())); services.clear(); },
  };
}
