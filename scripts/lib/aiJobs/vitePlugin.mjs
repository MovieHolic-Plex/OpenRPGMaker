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
    const service = await openAiJobsService({ directory: aiJobsDirectory(server.config.root), origins, ...runtime });
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
